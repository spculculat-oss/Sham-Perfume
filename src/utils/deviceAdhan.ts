import { MAX_ADHAN_DURATION_SECONDS, validAdhanFile, type AdhanVariant } from '../data/adhanVoices';

const DATABASE = 'sham-prayer-device-audio';
const STORE = 'recordings';

export interface SavedAdhan {
  name: string;
  audio: Blob;
  selected: boolean;
}
export type SavedAdhanFiles = Partial<Record<AdhanVariant, SavedAdhan>>;

export class InvalidAdhanRecording extends Error {
  constructor(readonly reason: 'file' | 'audio') { super(`Invalid adhan ${reason}`); }
}

/** Make a local copy that doesn't depend on the original file still being on disk.
 * Offline decoding verifies the format and length without enabling playback. */
async function copyAdhan(file: File, signal: AbortSignal): Promise<SavedAdhan> {
  try {
    signal.throwIfAborted();
    const bytes = await file.arrayBuffer();
    signal.throwIfAborted();
    const Offline = window.OfflineAudioContext || (window as Window & { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
    if (!Offline) throw new Error('Offline audio verification unavailable');
    const audio = new Blob([bytes], { type: file.type });
    const decoded = await new Offline(1, 1, 8_000).decodeAudioData(bytes);
    signal.throwIfAborted();
    if (!(decoded.duration > 0 && decoded.duration <= MAX_ADHAN_DURATION_SECONDS)) throw new Error('Adhan duration');
    return { name: file.name, audio, selected: true };
  } catch (error) {
    if (signal.aborted) throw error;
    throw new InvalidAdhanRecording('audio');
  }
}

function readSavedAdhan(input: unknown): SavedAdhan | undefined {
  if (!input || typeof input !== 'object') return;
  const { name, audio, selected } = input as Partial<SavedAdhan>;
  if (typeof name === 'string' && audio instanceof Blob && typeof selected === 'boolean'
    && validAdhanFile({ name, size: audio.size, type: audio.type })) return { name, audio, selected };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    let blocked = false;
    request.onupgradeneeded = () => { request.result.createObjectStore(STORE); };
    request.onerror = () => reject(request.error);
    request.onblocked = () => { blocked = true; reject(new Error('Local recording storage is blocked')); };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      if (blocked) db.close(); else resolve(db);
    };
  });
}

async function withDatabase<T>(signal: AbortSignal, useDatabase: (db: IDBDatabase) => Promise<T>): Promise<T> {
  signal.throwIfAborted();
  const db = await openDatabase();
  try {
    signal.throwIfAborted();
    return await useDatabase(db);
  } finally { db.close(); }
}

type UseStore<T> = (store: IDBObjectStore, result: (value: T) => void) => void;

function runTransaction<T>(db: IDBDatabase, mode: IDBTransactionMode, signal: AbortSignal, useStore: UseStore<T>): Promise<T> {
  signal.throwIfAborted();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const cancel = () => { try { tx.abort(); } catch { /* The transaction has already finished. */ } };
    let value: T;
    signal.addEventListener('abort', cancel, { once: true });
    // Individual requests can succeed before a transaction fails (e.g. storage quota).
    tx.oncomplete = () => { signal.removeEventListener('abort', cancel); resolve(value); };
    tx.onabort = () => { signal.removeEventListener('abort', cancel); reject(tx.error || signal.reason || new Error('Recording transaction aborted')); };
    try { useStore(tx.objectStore(STORE), (result) => { value = result; }); }
    catch (error) { cancel(); reject(error); }
  });
}

function transaction<T>(mode: IDBTransactionMode, signal: AbortSignal, useStore: UseStore<T>): Promise<T> {
  return withDatabase(signal, (db) => runTransaction(db, mode, signal, useStore));
}

export function loadDeviceAdhan(signal: AbortSignal): Promise<SavedAdhanFiles> {
  return transaction('readonly', signal, (store, result) => {
    const files: SavedAdhanFiles = {};
    result(files);
    for (const variant of ['regular', 'fajr'] as const) {
      const request = store.get(variant);
      request.onsuccess = () => {
        const recording = readSavedAdhan(request.result);
        if (recording) files[variant] = recording;
      };
    }
  });
}

export async function saveDeviceAdhan(variant: AdhanVariant, file: File, signal: AbortSignal): Promise<SavedAdhan> {
  if (!validAdhanFile(file)) throw new InvalidAdhanRecording('file');
  return withDatabase(signal, async (db) => {
    // Open before decoding: a concurrent wipe closes this connection on versionchange.
    // A save that was already pending cannot reopen/recreate the deleted store afterwards.
    const recording = await copyAdhan(file, signal);
    return runTransaction(db, 'readwrite', signal, (store, result) => {
      store.put(recording, variant);
      result(recording);
    });
  });
}

export function selectDeviceAdhan(variant: AdhanVariant, selected: boolean, signal: AbortSignal): Promise<SavedAdhan | undefined> {
  return transaction('readwrite', signal, (store, result) => {
    const request = store.get(variant);
    request.onsuccess = () => {
      const saved = readSavedAdhan(request.result);
      if (!saved) { result(undefined); return; }
      const next = { ...saved, selected };
      if (saved.selected !== selected) store.put(next, variant);
      result(next);
    };
  });
}

export function removeDeviceAdhan(variant: AdhanVariant, signal: AbortSignal): Promise<undefined> {
  return transaction('readwrite', signal, (store, result) => { store.delete(variant); result(undefined); });
}

export function deviceAdhanResetChannel(): BroadcastChannel | undefined {
  try { return new BroadcastChannel(`${DATABASE}-reset`); } catch { return undefined; }
}

/** Stop other open prayer dialogs too; no files or filenames are sent between tabs. */
export async function clearDeviceAdhan(): Promise<void> {
  const channel = deviceAdhanResetChannel();
  channel?.postMessage('clear');
  channel?.close();
  if (typeof indexedDB === 'undefined') return;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Local recording deletion is blocked'));
  });
}
