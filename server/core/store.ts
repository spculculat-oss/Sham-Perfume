/**
 * Storage abstraction. The same core runs on:
 *  - a VPS / Node host  -> FileStore   (JSON file, atomic writes)
 *  - Vercel / Firebase  -> FirestoreStore (REST, service account)
 *  - Vercel + Neon      -> PostgresStore (SHAM_STORE=postgres; the ledger uses it automatically, see createLedgerStore)
 *  - tests / previews   -> MemoryStore (non-persistent, reported in admin)
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { CollectionName, Collections } from './types';
import { FirestoreStore } from './firestoreStore';
import { PostgresStore } from './pgStore';
import { connectPostgres, findDatabase } from '../community/db';

export interface Store {
  readonly kind: 'memory' | 'file' | 'firestore' | 'postgres';
  readonly persistent: boolean;
  get<C extends CollectionName>(collection: C, id: string): Promise<Collections[C] | undefined>;
  list<C extends CollectionName>(collection: C): Promise<Collections[C][]>;
  put<C extends CollectionName>(collection: C, id: string, value: Collections[C]): Promise<void>;
  /** Atomic insert. false means the document already exists; used for immutable, replay-safe ledgers. */
  create<C extends CollectionName>(collection: C, id: string, value: Collections[C]): Promise<boolean>;
  delete(collection: CollectionName, id: string): Promise<boolean>;
}

type Data = { [C in CollectionName]?: Record<string, Collections[C]> };
const clone = <T>(value: T): T => structuredClone(value);

export class MemoryStore implements Store {
  readonly kind: Store['kind'] = 'memory';
  readonly persistent: boolean = false;
  protected data: Data = {};

  async get<C extends CollectionName>(collection: C, id: string) {
    const value = (this.data[collection] as Record<string, Collections[C]> | undefined)?.[id];
    return value ? clone(value) : undefined;
  }
  async list<C extends CollectionName>(collection: C) {
    return Object.values((this.data[collection] || {}) as Record<string, Collections[C]>).map(clone);
  }
  async put<C extends CollectionName>(collection: C, id: string, value: Collections[C]) {
    const bucket = (this.data[collection] ||= {}) as Record<string, Collections[C]>;
    const previous = bucket[id];
    bucket[id] = clone(value);
    try { await this.changed(); } catch (error) { if (previous) bucket[id] = previous; else delete bucket[id]; throw error; }
  }
  async create<C extends CollectionName>(collection: C, id: string, value: Collections[C]) {
    const bucket = (this.data[collection] ||= {}) as Record<string, Collections[C]>;
    if (Object.hasOwn(bucket, id)) return false;
    bucket[id] = clone(value);
    try { await this.changed(); } catch (error) { delete bucket[id]; throw error; }
    return true;
  }
  async delete(collection: CollectionName, id: string) {
    const bucket = this.data[collection] as Record<string, unknown> | undefined;
    if (!bucket || !(id in bucket)) return false;
    delete bucket[id];
    await this.changed();
    return true;
  }
  protected async changed(): Promise<void> { /* memory only */ }
}

export class FileStore extends MemoryStore {
  override readonly kind = 'file' as const;
  override readonly persistent = true;
  private loaded: Promise<void>;
  private writing: Promise<void> = Promise.resolve();
  private mutating: Promise<unknown> = Promise.resolve();
  private mutate<T>(work: () => Promise<T>): Promise<T> {
    const operation = this.mutating.catch(() => {}).then(work);
    this.mutating = operation.catch(() => {});
    return operation;
  }

  constructor(private path: string) {
    super();
    this.loaded = readFile(path, 'utf8')
      .then((raw) => { this.data = JSON.parse(raw) as Data; })
      .catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw new Error(`Cannot read Sham Core data file ${path}: ${error.message}`);
      });
  }
  override async get<C extends CollectionName>(c: C, id: string) { await this.loaded; await this.mutating; return super.get(c, id); }
  override async list<C extends CollectionName>(c: C) { await this.loaded; await this.mutating; return super.list(c); }
  override async put<C extends CollectionName>(c: C, id: string, v: Collections[C]) { await this.loaded; return this.mutate(() => super.put(c, id, v)); }
  override async create<C extends CollectionName>(c: C, id: string, v: Collections[C]) { await this.loaded; return this.mutate(() => super.create(c, id, v)); }
  override async delete(c: CollectionName, id: string) { await this.loaded; return this.mutate(() => super.delete(c, id)); }

  protected override changed() {
    // Serialise writes; write to a temp file then rename so a crash never leaves half a JSON file.
    const snapshot = JSON.stringify(this.data);
    this.writing = this.writing.catch(() => {}).then(async () => {
      await mkdir(dirname(this.path), { recursive: true });
      const temp = `${this.path}.${process.pid}.tmp`;
      await writeFile(temp, snapshot, { encoding: 'utf8', mode: 0o600 });
      await rename(temp, this.path);
    });
    return this.writing;
  }
}

type Env = Record<string, string | undefined>;

export function createStore(env: Env = process.env): Store {
  const requested = (env.SHAM_STORE || '').trim().toLowerCase();
  if (requested === 'firestore') {
    const projectId = env.FIREBASE_PROJECT_ID?.trim();
    const clientEmail = env.FIREBASE_CLIENT_EMAIL?.trim();
    const privateKey = env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('SHAM_STORE=firestore requires FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY');
    }
    return new FirestoreStore({ projectId, clientEmail, privateKey, prefix: env.SHAM_FIRESTORE_PREFIX?.trim() || 'sham_core_' });
  }
  if (requested === 'postgres') {
    const { url } = findDatabase(env);
    if (!url) throw new Error('SHAM_STORE=postgres requires a database URL (DATABASE_URL, POSTGRES_URL or SHAM_DATABASE_URL)');
    return new PostgresStore(() => connectPostgres(url));
  }
  if (requested === 'memory') return new MemoryStore();
  // Serverless platforms (Vercel, Tencent EdgeOne) have no durable disk.
  if (requested === 'file' || (!requested && !env.VERCEL && !env.SHAM_SERVERLESS)) {
    return new FileStore(resolve(env.SHAM_DATA_FILE?.trim() || '.data/sham-core.json'));
  }
  // Serverless without explicit storage: no durable disk. Admin shows this warning.
  return new MemoryStore();
}

/**
 * «بنك شام» needs a durable ledger even when the rest of Sham Core runs on temporary memory (a serverless
 * host without SHAM_STORE). The community's database (Vercel → Storage → Neon) is then reused for the
 * money records only, so a database hiccup can never take the chat down with it.
 */
export function createLedgerStore(env: Env, core: Store): Store {
  if (core.persistent && !(core.kind === 'file' && (env.VERCEL || env.SHAM_SERVERLESS))) return core;
  if ((env.SHAM_LEDGER_STORE || '').trim().toLowerCase() === 'memory') return core;
  const { url } = findDatabase(env);
  return url ? new PostgresStore(() => connectPostgres(url)) : core;
}
