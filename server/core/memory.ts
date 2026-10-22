/**
 * «ذاكرة شاهين» on the server. Two layers:
 *  - learned: every answer this server gives is kept in the Sham Core store (collection `memory`): durable
 *    with Firestore or the file store, per instance with the memory store. GET /api/admin/shaheen-memory
 *    hands it to the bots, which merge it into the shared file.
 *  - shared: src/data/live/shaheen-memory.json — what all instances and the bots learned, shipped in the
 *    build and refreshed from the repository every 30 minutes (server/core/liveData.ts).
 * A repeated opening question is answered from memory without calling any AI engine; when no engine
 * answers at all, the closest remembered question is used (with a short note to the visitor).
 */
import { createHash } from 'node:crypto';
import bundledMemory from '../../src/data/live/shaheen-memory.json';
import {
  emptyMemory, isMemoryFile, isPersonal, isTimeBound, memoryId, mergeMemory, recall, recallSimilar, remember, touch,
  type MemoryEntry, type MemoryFile,
} from '../../src/utils/shaheenMemory';
import { liveDataEnabled, loadLive } from './liveData';
import type { Store } from './store';

type Env = Record<string, string | undefined>;
const recallable = (question: string, mode: string) => mode !== 'council' && !isTimeBound(question) && !isPersonal(question);
const docId = (id: string) => createHash('sha256').update(id).digest('base64url').slice(0, 32);

export interface MemoryHit { entry: MemoryEntry; from: 'learned' | 'shared'; exact: boolean; score: number }

export class ShaheenMemory {
  constructor(private store: Store, private env: Env = process.env, private request: typeof fetch = fetch,
    /** Tests inject the shared file; in dev and tests the bundled copy is never used (no hidden test data). */
    private sharedOverride?: MemoryFile,
    /**
     * A durable copy (the database, when the site has one) of what he learns. On Vercel the main store is often
     * temporary memory, so every instance forgot its visitors' answers before the bots could collect them; the
     * answers are now also written there (never waited on by the visitor) and handed to the bots from there.
     */
    private durable?: Store) {}

  /** What everyone learned (the shared file); empty in tests and dev unless injected. */
  async shared(): Promise<MemoryFile> {
    if (this.sharedOverride) return this.sharedOverride;
    if (!liveDataEnabled(this.env)) return emptyMemory();
    const file = await loadLive('shaheen-memory.json', bundledMemory as unknown as MemoryFile, isMemoryFile, this.env, this.request).catch(() => undefined);
    return file && isMemoryFile(file) ? file : emptyMemory();
  }

  async learned(): Promise<MemoryFile> {
    const entries = await this.store.list('memory').catch(() => [] as MemoryEntry[]);
    return { version: 1, updatedAt: entries.map((e) => e.lastUsed || e.at).sort().pop() || new Date(0).toISOString(), entries };
  }

  /** The remembered answer to this exact question (same language and style), counting the use. */
  async recall(question: string, lang: string, mode: string): Promise<MemoryHit | undefined> {
    if (!recallable(question, mode)) return undefined;
    const own = await this.store.get('memory', docId(memoryId(question, lang, mode))).catch(() => undefined);
    const learned = own && recall({ version: 1, updatedAt: '', entries: [own] }, question, lang, mode);
    if (learned) { await this.used(learned); return { entry: learned, from: 'learned', exact: true, score: 1 }; }
    const shared = recall(await this.shared(), question, lang, mode);
    if (shared) { await this.used({ ...shared }); return { entry: shared, from: 'shared', exact: true, score: 1 }; }
    return undefined;
  }

  /** Everything he remembers (this server's answers and the shared file): «مكتبة شاهين» searches it too. */
  async all(): Promise<MemoryFile> { return mergeMemory(await this.learned(), await this.shared()); }

  /** When no engine answers: the closest remembered question (learned or shared, any style). */
  async recallSimilar(question: string, lang: string): Promise<MemoryHit | undefined> {
    const all = mergeMemory(await this.learned(), await this.shared());
    const best = recallSimilar(all, question, lang);
    if (!best) return undefined;
    await this.used({ ...best.entry });
    return { entry: best.entry, from: 'learned', exact: best.score >= 1, score: best.score };
  }

  /** What the bots collect (GET /api/admin/shaheen-memory): this instance's answers plus the durable copy. */
  async exported(): Promise<MemoryFile> {
    const mine = await this.learned();
    if (!this.durable || this.durable === this.store) return mine;
    const kept = await Promise.race([
      this.durable.list('memory').catch(() => [] as MemoryEntry[]),
      new Promise<MemoryEntry[]>((done) => setTimeout(() => done([]), 8000)),
    ]);
    return mergeMemory(mine, { version: 1, updatedAt: kept.map((e) => e.lastUsed || e.at).sort().pop() || new Date(0).toISOString(), entries: kept });
  }

  /** Keeps an answer Shaheen just gave (ignored when not worth remembering). */
  async learn(input: { question: string; lang: string; mode: string; answer: string }): Promise<boolean> {
    const file = emptyMemory();
    if (!remember(file, { ...input, source: 'chat' })) return false;
    const entry = file.entries[0];
    const old = await this.store.get('memory', docId(entry.id)).catch(() => undefined);
    if (old) { entry.hits = old.hits; entry.lastUsed = old.lastUsed; }
    await this.store.put('memory', docId(entry.id), entry).catch(() => undefined);
    if (this.durable && this.durable !== this.store) void this.durable.put('memory', docId(entry.id), entry).catch(() => undefined);
    return true;
  }

  /** A remembered answer was used: it rises (and the use reaches the shared file through the bots). */
  private async used(entry: MemoryEntry) {
    touch(entry);
    await this.store.put('memory', docId(entry.id), entry).catch(() => undefined);
  }
}
