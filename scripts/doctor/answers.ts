/**
 * The bots' memory of their own AI work (src/data/live/ai-memory.json): the exact same instructions and
 * prompt are answered from here instead of calling an AI engine again — a run that stopped half-way, a
 * publish that lost a race, or the same product/article/check asked twice. Checked before the engines, so it
 * also works while every engine's quota is paused. A reply that turned out unusable is forgotten at once
 * (`forget`), so a bad answer is never repeated. Entries expire, and the file stays small.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

export interface AnswerEntry { id: string; at: string; lastUsed?: string; hits: number; answer: string }
export interface AnswerFile { version: 1; updatedAt: string; entries: AnswerEntry[] }
export const ANSWER_LIMITS = { maxEntries: 200, ttlDays: 30, maxBytes: 800_000 };
const DAY = 86_400_000;

export const answerKey = (system: string, prompt: string) =>
  createHash('sha256').update(`${system}\0${prompt}`).digest('base64url').slice(0, 32);

export function answerBook(path?: URL, now: () => number = Date.now, limits = ANSWER_LIMITS) {
  let file: AnswerFile = { version: 1, updatedAt: new Date(0).toISOString(), entries: [] };
  if (path) {
    try {
      const data = JSON.parse(readFileSync(path, 'utf8')) as AnswerFile;
      if (Array.isArray(data?.entries)) file = { version: 1, updatedAt: String(data.updatedAt || file.updatedAt), entries: data.entries.filter((e) => e && typeof e.id === 'string' && typeof e.answer === 'string') };
    } catch { /* first run */ }
  }
  let dirty = false;
  let hits = 0;
  const find = (system: string, prompt: string) => { const id = answerKey(system, prompt); return { id, entry: file.entries.find((e) => e.id === id) }; };
  const fresh = (e: AnswerEntry) => now() - Date.parse(e.at) <= limits.ttlDays * DAY;
  return {
    file: () => file,
    /** Answers taken from memory in this run (no AI call). */
    hits: () => hits,
    get(system: string, prompt: string): string | undefined {
      const { entry } = find(system, prompt);
      if (!entry || !fresh(entry)) return undefined;
      entry.hits += 1; entry.lastUsed = new Date(now()).toISOString(); dirty = true; hits++;
      return entry.answer;
    },
    put(system: string, prompt: string, answer: string) {
      if (!answer.trim() || answer.length > limits.maxBytes / 4) return;
      const { id, entry } = find(system, prompt);
      const at = new Date(now()).toISOString();
      if (entry) Object.assign(entry, { answer, at }); else file.entries.push({ id, at, hits: 0, answer });
      dirty = true;
    },
    /** The reply could not be used (did not parse, failed the checks): never serve it again. */
    forget(system: string, prompt: string) {
      const { id } = find(system, prompt);
      const before = file.entries.length;
      file.entries = file.entries.filter((e) => e.id !== id);
      if (file.entries.length !== before) dirty = true;
    },
    save() {
      if (!path || !dirty) return;
      const t = now();
      let entries = file.entries.filter((e) => t - Date.parse(e.lastUsed || e.at) <= limits.ttlDays * DAY)
        .sort((a, b) => Date.parse(b.lastUsed || b.at) - Date.parse(a.lastUsed || a.at)).slice(0, limits.maxEntries);
      while (entries.length && JSON.stringify(entries).length > limits.maxBytes) entries = entries.slice(0, -1);
      file = { version: 1, updatedAt: new Date(t).toISOString(), entries };
      writeFileSync(path, `${JSON.stringify(file, null, 1)}\n`);
      dirty = false;
    },
  };
}
export type AnswerBook = ReturnType<typeof answerBook>;
