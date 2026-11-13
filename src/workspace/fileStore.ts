/**
 * «ملفاتي»: the visitor's workspace files, kept in his own browser (IndexedDB) — never on the server. Falls back to
 * memory for this page view when storage is blocked (private mode on some browsers).
 */
export interface WsFile { id: string; name: string; type: string; size: number; created: number; blob: Blob }
export type WsFileMeta = Omit<WsFile, 'blob'>;

const DB = 'sham-workspace';
const STORE = 'files';
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
const memory = new Map<string, WsFile>();
const listeners = new Set<() => void>();
export const onFilesChanged = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const changed = () => listeners.forEach((fn) => { try { fn(); } catch { /* a listener's own problem */ } });

let opening: Promise<IDBDatabase | null> | undefined;
function open(): Promise<IDBDatabase | null> {
  if (opening) return opening;
  opening = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') { resolve(null); return; }
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' }); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  return opening;
}
function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return open().then((db) => new Promise<T | undefined>((resolve, reject) => {
    if (!db) { resolve(undefined); return; }
    try {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (error) { reject(error); }
  }));
}

const newId = () => (globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
const MIME_BY_EXT: Record<string, string> = { md: 'text/markdown', txt: 'text/plain', html: 'text/html', css: 'text/css', js: 'text/javascript', py: 'text/x-python', json: 'application/json', csv: 'text/csv', svg: 'image/svg+xml' };
export const mimeOf = (name: string, type = '') => type || MIME_BY_EXT[name.split('.').pop()?.toLowerCase() || ''] || 'application/octet-stream';

export async function saveFile(name: string, data: Blob | string, type?: string): Promise<WsFileMeta> {
  const blob = typeof data === 'string' ? new Blob([data], { type: mimeOf(name, type) }) : data;
  if (blob.size > MAX_FILE_BYTES) throw new RangeError('too_big');
  const file: WsFile = { id: newId(), name: name.slice(0, 120) || 'file', type: mimeOf(name, type || blob.type), size: blob.size, created: Date.now(), blob };
  const stored = await run('readwrite', (s) => s.put(file)).then(() => true, () => false);
  if (!stored || !(await open())) memory.set(file.id, file);
  changed();
  const { blob: _blob, ...meta } = file;
  return meta;
}
export async function listFiles(): Promise<WsFileMeta[]> {
  const all = ((await run<WsFile[]>('readonly', (s) => s.getAll()).catch(() => undefined)) || []).concat([...memory.values()]);
  return all.map(({ blob: _b, ...meta }) => meta).sort((a, b) => b.created - a.created);
}
export async function getFile(id: string): Promise<WsFile | undefined> {
  return memory.get(id) || (await run<WsFile>('readonly', (s) => s.get(id)).catch(() => undefined));
}
export async function deleteFile(id: string) {
  memory.delete(id);
  await run('readwrite', (s) => s.delete(id)).catch(() => undefined);
  changed();
}
export const humanSize = (bytes: number) => (bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`);
