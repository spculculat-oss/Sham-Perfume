/**
 * «ذاكرة شاهين» in the visitor's browser: the opening questions this visitor asked and Shaheen's answers
 * (localStorage, at most 100), plus the shared memory shipped with the site (src/data/live/shaheen-memory.json,
 * loaded only when needed). Used when the server cannot be reached at all — no internet, the API is down,
 * or a static copy of the site with no API — so Shaheen still answers what he already knows.
 */
import { curateMemory, emptyMemory, isMemoryFile, recallSimilar, remember, touch, type MemoryFile } from './shaheenMemory';
import { baseLexicon, buildLexicon, understandQuestion, type Lexicon, type Understanding } from './shaheenSpelling';

let researchSpider: ReturnType<typeof import('./researchSpider').createResearchSpider> | undefined;

const KEY = 'shaheen_memory_v1';
const LOCAL_LIMITS = { maxEntries: 100, ttlDays: 60, freshDays: 30, maxAnswerChars: 12_000, offlineSimilarity: 0.55 };

export interface OfflineMemory {
  learn(input: { question: string; lang: string; mode: string; answer: string }): void;
  /** The closest remembered answer (this browser first, then the site's shared memory). */
  recall(question: string, lang: string): Promise<{ answer: string; exact: boolean } | undefined>;
  /** «مكتبة شاهين»: an answer built from his lessons, materials encyclopaedia and memory (no AI, no server). */
  library?(question: string, lang: string): Promise<string | undefined>;
  /** «باحث شاهين»: a new question looked up in open sources (Wikipedia's public API, straight from the browser). */
  research?(question: string, lang: string): Promise<string | undefined>;
  /** «فهم شاهين للغلطات»: the question as he understands it (mistyped words read as the words he knows). */
  understand?(question: string, lang: string): Promise<Understanding>;
}

function readLocal(): MemoryFile {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
    const data: unknown = raw ? JSON.parse(raw) : undefined;
    return isMemoryFile(data) ? data : emptyMemory();
  } catch { return emptyMemory(); }
}
function writeLocal(file: MemoryFile) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(curateMemory(file, Date.now(), LOCAL_LIMITS).file));
  } catch { /* storage full or denied: memory is a bonus, never a blocker */ }
}

let shared: Promise<MemoryFile> | undefined;
const sharedMemory = () => shared ??= import('../data/live/shaheen-memory.json')
  .then((m) => { const data: unknown = (m as { default?: unknown }).default ?? m; return isMemoryFile(data) ? data : emptyMemory(); })
  .catch(() => { shared = undefined; return emptyMemory(); });

let lexicon: Promise<Lexicon> | undefined;
/** Every word he knows: his lessons, the encyclopaedia, the site's memory and this browser's (loaded once, when needed). */
const siteLexicon = () => lexicon ??= Promise.all([import('../data/live/sham-training.json'), import('../data/rawMaterials'), sharedMemory()])
  .then(([lessons, { RAW_MATERIALS_DATABASE }, site]) => {
    const docs = ((lessons as { default?: { docs?: unknown } }).default ?? lessons) as { docs?: { id: string; title: string; content: string }[] };
    return buildLexicon({ lessons: Array.isArray(docs.docs) ? docs.docs : [], materials: RAW_MATERIALS_DATABASE, memory: { ...site, entries: [...readLocal().entries, ...site.entries] } });
  })
  .catch(() => { lexicon = undefined; return baseLexicon(); });

export const browserMemory: OfflineMemory = {
  learn(input) {
    const file = readLocal();
    if (remember(file, { ...input, source: 'chat' })) writeLocal(file);
  },
  async recall(question, lang) {
    const local = readLocal();
    const mine = recallSimilar(local, question, lang);
    if (mine) { touch(mine.entry); writeLocal(local); return { answer: mine.entry.answer, exact: mine.score >= 1 }; }
    // Only in the built site (Vite): tests never see the shipped data.
    if (typeof import.meta.env?.MODE !== 'string') return undefined;
    const site = recallSimilar(await sharedMemory(), question, lang);
    return site ? { answer: site.entry.answer, exact: site.score >= 1 } : undefined;
  },
  async library(question, lang) {
    if (typeof import.meta.env?.MODE !== 'string') return undefined;
    // Loaded only on the day it is needed (no server reachable and nothing close in memory).
    const [{ libraryAnswer }, lessons, { RAW_MATERIALS_DATABASE }, site] = await Promise.all([
      import('./shaheenLibrary'), import('../data/live/sham-training.json'), import('../data/rawMaterials'), sharedMemory(),
    ]);
    const docs = ((lessons as { default?: { docs?: unknown } }).default ?? lessons) as { docs?: { id: string; title: string; content: string }[] };
    const memory = { ...site, entries: [...readLocal().entries, ...site.entries] };
    return libraryAnswer({ lessons: Array.isArray(docs.docs) ? docs.docs : [], materials: RAW_MATERIALS_DATABASE, memory }, question, lang)?.answer;
  },
  async understand(question) {
    // Only in the built site (Vite) are his lessons loaded; elsewhere the built-in perfume words.
    return understandQuestion(question, typeof import.meta.env?.MODE === 'string' ? await siteLexicon() : baseLexicon());
  },
  async research(question, lang) {
    if (typeof import.meta.env?.MODE !== 'string' || typeof fetch !== 'function') return undefined;
    const [{ researchAnswer }, { createResearchSpider }] = await Promise.all([import('./webResearch'), import('./researchSpider')]);
    researchSpider ??= createResearchSpider(fetch.bind(globalThis) as never, { timeoutMs: 9000 });
    const found = await researchSpider.search(question, lang);
    return found ? researchAnswer(found) : undefined;
  },
};
