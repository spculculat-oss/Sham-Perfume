/**
 * «ذاكرة شاهين» — every question Shaheen answers is kept, so that:
 *  - the same question asked again is answered from memory, without calling any AI engine;
 *  - when no AI engine can be reached (no connection, quota used up), Shaheen still answers from the
 *    closest question he answered before, and says so;
 *  - the memory improves itself: answers that keep being asked rise, unused ones expire, answers that fail
 *    the supervisor's checks (vendor names, raw code, empty) are never kept, and time-bound questions
 *    (news, prices, today…) are never served from memory while the engines are up.
 * Pure (no Node or DOM APIs): shared by the server (server/shaheen.ts), the visitor's browser
 * (src/utils/chatStore.ts) and the scripts that curate src/data/live/shaheen-memory.json.
 */

export interface MemoryEntry {
  /** `${lang}|${style}|${normalized question}` — one entry per question, language and answer style. */
  id: string;
  question: string;
  lang: string;
  /** auto / fast / deep: a deep analysis is not the answer to a quick question. */
  style: string;
  answer: string;
  at: string;
  lastUsed?: string;
  hits: number;
  /**
   * chat = a visitor's question; probe = the supervisor's test question; seed = written by the team;
   * study = «مدرسة شاهين»: a question Shaheen could not answer by himself, studied while an AI engine was up.
   */
  source: 'chat' | 'probe' | 'seed' | 'study';
}
export interface MemoryFile { version: 1; updatedAt: string; entries: MemoryEntry[] }

export const MEMORY_LIMITS = {
  /** Entries kept in the shared file (most useful first). */
  maxEntries: 2000,
  /** An entry unused for this long is forgotten (it is asked again fresh next time). */
  ttlDays: 60,
  /** A remembered answer older than this is not served while the engines are up (it is refreshed instead). */
  freshDays: 30,
  maxAnswerChars: 12_000,
  /** Similarity needed to answer a different wording from memory when no engine answers. */
  offlineSimilarity: 0.55,
};

const DAY = 86_400_000;
export const emptyMemory = (): MemoryFile => ({ version: 1, updatedAt: new Date(0).toISOString(), entries: [] });
export const isMemoryFile = (d: unknown): d is MemoryFile =>
  Boolean(d && typeof d === 'object' && typeof (d as MemoryFile).updatedAt === 'string' && Array.isArray((d as MemoryFile).entries));

/** Same question, different spelling: case, Arabic letter variants, diacritics, tatweel, punctuation, spaces. */
export function normalizeQuestion(text: string): string {
  return text.normalize('NFKC').toLowerCase()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي')
    .replace(/[\s\u200c\u200f\u200e]+/g, ' ')
    .replace(/^[\s?!.,؟،؛:…]+|[\s?!.,؟،؛:…]+$/g, '')
    .trim();
}

/** Visitor-facing answer styles that share one memory (the council is never served from memory). */
export const memoryStyle = (mode: string) => (mode === 'fast' || mode === 'deep' ? mode : 'auto');
export const memoryId = (question: string, lang: string, mode: string) => `${lang}|${memoryStyle(mode)}|${normalizeQuestion(question)}`;

/**
 * Questions whose right answer changes with time or with the visitor: never answered from memory while an
 * engine can answer, and never stored (news, prices, today, orders, personal details).
 */
const word = (list: string) => new RegExp(`(?:^|[^\\p{L}])(?:و|ف|ب|ل|ال|وال|بال|فال|لل)?(?:${list})(?=$|[^\\p{L}])`, 'iu');
const NEWS_OR_NOW = word('اخبار|أخبار|خبر|الخبر|جديد|الجديد|احدث|أحدث|النهارده|النهاردة|انهارده|اليوم|امبارح|أمس|امس|الاسبوع ده|الأسبوع ده|الشهر ده|السنه دي|السنة دي|متاح|متوفر|موجود عندكم|طلبي|اوردر|أوردر|الاوردر|شحن|الشحن|توصيل|التوصيل|عرض|عروض|العروض|خصم|خصومات');
const PRICE = word('سعر|سعره|سعرها|اسعار|أسعار|بكام|بكم|كام جنيه|ثمن|تمن');
const NEWS_EN = /\b(news|latest|newest|today|tonight|yesterday|this (week|month|year)|in stock|available now|order|shipping|delivery|discount|offer|sale)\b/i;
const PRICE_EN = /\b(price|prices|how much|cost now)\b/i;
const YEAR = /(?<!\d)20[2-9]\d(?!\d)/;
// A price question with its own numbers («لو الزيت سعره 1200…») is a calculation: its answer does not change.
const hasNumber = (q: string) => /\d/.test(normalizeQuestion(q));
const PERSONAL = /(اسمي|رقمي|تليفوني|موبايلي|ايميلي|إيميلي|عنواني|my name|my phone|my email|my address|@|\d{7,})/i;
export const isTimeBound = (question: string) =>
  NEWS_OR_NOW.test(question) || NEWS_EN.test(question) || YEAR.test(question) || ((PRICE.test(question) || PRICE_EN.test(question)) && !hasNumber(question));
export const isPersonal = (question: string) => PERSONAL.test(normalizeQuestion(question));

const VENDOR = /\b(gemini|openai|chat\s?gpt|gpt-?\d|claude|anthropic|deepseek|openrouter|perplexity|llama|mistral)\b/i;
/** An answer worth remembering: real text, no AI vendor names, no raw code values, not an apology. */
export function worthRemembering(question: string, answer: string): boolean {
  const q = question.trim(); const a = answer.trim();
  if (q.length < 6 || q.length > 600 || a.length < 40 || a.length > MEMORY_LIMITS.maxAnswerChars) return false;
  if (isTimeBound(q) || isPersonal(q)) return false;
  if (VENDOR.test(a)) return false;
  if (/\[object Object\]|(?<![\p{L}])(?:undefined|NaN)(?![\p{L}])/u.test(a)) return false;
  if (/(حاول مرة أخرى|حاول لاحق|try again later|something went wrong|المعذرة على هذا التأخر)/i.test(a)) return false;
  return true;
}

/** Words that carry the meaning of a question (Arabic «ال» and common filler words dropped). */
const STOP = new Set(['في', 'من', 'على', 'عن', 'الى', 'الي', 'او', 'و', 'يا', 'هو', 'هي', 'ده', 'دي', 'دا', 'ايه', 'اي', 'ما', 'ماذا', 'هل', 'كيف', 'ازاي', 'عايز', 'عاوز', 'اريد', 'ممكن', 'لو', 'مع', 'الله', 'the', 'a', 'an', 'of', 'to', 'for', 'and', 'or', 'is', 'are', 'what', 'how', 'can', 'i', 'me', 'my', 'in', 'on', 'with', 'please']);
export function meaningWords(text: string): string[] {
  return [...new Set(normalizeQuestion(text).replace(/[^\p{L}\p{N}%\s]/gu, ' ').split(/\s+/)
    .map((w) => w.replace(/^(وال|بال|فال|كال|لل|ال)(?=\p{L}{3,})/u, '').replace(/ة$/u, 'ه'))
    .filter((w) => w.length >= 2 && !STOP.has(w)))];
}
/** 0…1: how much two questions say the same thing (shared meaning words, Dice coefficient). Numbers must agree. */
export function similarity(a: string, b: string): number {
  const x = meaningWords(a); const y = meaningWords(b);
  if (!x.length || !y.length) return 0;
  const nx = x.filter((w) => /\d/.test(w)).sort().join(' '); const ny = y.filter((w) => /\d/.test(w)).sort().join(' ');
  if (nx !== ny) return 0; // «50 مل» is not «100 مل»: a calculation is never answered for other numbers
  const ys = new Set(y);
  const shared = x.filter((w) => ys.has(w)).length;
  return (2 * shared) / (x.length + y.length);
}

/** The remembered answer to exactly this question (same language and style), if still fresh enough. */
export function recall(file: MemoryFile | undefined, question: string, lang: string, mode: string, now = Date.now(), maxAgeDays = MEMORY_LIMITS.freshDays): MemoryEntry | undefined {
  if (!file || mode === 'council' || isTimeBound(question) || isPersonal(question)) return undefined;
  const id = memoryId(question, lang, mode);
  const entry = file.entries.find((e) => e.id === id);
  return entry && now - Date.parse(entry.at) <= maxAgeDays * DAY ? entry : undefined;
}

/** When no engine answers: the closest question Shaheen answered before (any style), if close enough. */
export function recallSimilar(file: MemoryFile | undefined, question: string, lang: string, threshold = MEMORY_LIMITS.offlineSimilarity): { entry: MemoryEntry; score: number } | undefined {
  if (!file || isPersonal(question)) return undefined;
  const norm = normalizeQuestion(question);
  let best: { entry: MemoryEntry; score: number } | undefined;
  for (const entry of file.entries) {
    if (entry.lang !== lang) continue;
    const score = normalizeQuestion(entry.question) === norm ? 1 : similarity(question, entry.question);
    if (score >= threshold && (!best || score > best.score || (score === best.score && entry.hits > best.entry.hits))) best = { entry, score };
  }
  return best;
}

/** Adds (or refreshes) an answer; an answer that is not worth remembering is ignored. Returns whether it was kept. */
export function remember(file: MemoryFile, input: { question: string; lang: string; mode: string; answer: string; source?: MemoryEntry['source'] }, now = new Date()): boolean {
  if (input.mode === 'council' || !worthRemembering(input.question, input.answer)) return false;
  const id = memoryId(input.question, input.lang, input.mode);
  const at = now.toISOString();
  const old = file.entries.find((e) => e.id === id);
  if (old) Object.assign(old, { answer: input.answer.trim(), at, question: input.question.trim(), source: old.source === 'chat' ? 'chat' : input.source || old.source });
  else file.entries.push({ id, question: input.question.trim(), lang: input.lang, style: memoryStyle(input.mode), answer: input.answer.trim(), at, hits: 0, source: input.source || 'chat' });
  file.updatedAt = at;
  return true;
}

/** A remembered answer was used again (it rises in the memory and is kept longer). */
export function touch(entry: MemoryEntry, now = new Date()) { entry.hits += 1; entry.lastUsed = now.toISOString(); }

/** Merges another copy of the memory (another server instance, another bot run): newest answer, summed hits. */
export function mergeMemory(base: MemoryFile, other: MemoryFile | undefined): MemoryFile {
  if (!other) return base;
  const byId = new Map(base.entries.map((e) => [e.id, { ...e }]));
  for (const e of other.entries) {
    if (!e || typeof e.id !== 'string' || typeof e.answer !== 'string') continue;
    const mine = byId.get(e.id);
    if (!mine) { byId.set(e.id, { ...e }); continue; }
    const newer = Date.parse(e.at) > Date.parse(mine.at) ? e : mine;
    const lastUsed = [mine.lastUsed, e.lastUsed].filter(Boolean).sort().pop();
    byId.set(e.id, { ...newer, hits: Math.max(mine.hits, e.hits), lastUsed });
  }
  return { version: 1, updatedAt: [base.updatedAt, other.updatedAt].sort().pop()!, entries: [...byId.values()] };
}

/**
 * Keeps the memory healthy: drops entries unused for `ttlDays`, entries that no longer pass the checks, and
 * the least useful ones beyond `maxEntries` (most asked and most recent first).
 */
export function curateMemory(file: MemoryFile, now = Date.now(), limits = MEMORY_LIMITS): { file: MemoryFile; removed: number } {
  const alive = file.entries.filter((e) => {
    const last = Date.parse(e.lastUsed || e.at);
    // What «مدرسة شاهين» studied is kept 3× longer: it is his fallback for days when no engine answers.
    const ttl = e.source === 'study' ? limits.ttlDays * 3 : limits.ttlDays;
    return now - last <= ttl * DAY && worthRemembering(e.question, e.answer);
  });
  const ranked = alive.sort((a, b) => b.hits - a.hits || Date.parse(b.lastUsed || b.at) - Date.parse(a.lastUsed || a.at)).slice(0, limits.maxEntries);
  return { file: { version: 1, updatedAt: new Date(now).toISOString(), entries: ranked }, removed: file.entries.length - ranked.length };
}

/** The short line added under an answer given from memory because no engine answered. */
export function offlineNote(lang: string, exact: boolean): string {
  const ar = lang === 'ar' || lang === 'fa';
  if (exact) return ar ? '\n\n_📚 من ذاكرة شاهين — إجابة محفوظة لنفس السؤال._' : '\n\n_📚 From Shaheen’s memory — a saved answer to this same question._';
  return ar ? '\n\n_📚 من ذاكرة شاهين — إجابة محفوظة لسؤال قريب من سؤالك؛ اسأل تاني بعد شوية لإجابة جديدة._'
    : '\n\n_📚 From Shaheen’s memory — a saved answer to a question close to yours; ask again shortly for a fresh one._';
}
