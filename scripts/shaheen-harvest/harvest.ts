/**
 * «حصّاد شاهين» — the pure part (tested in tests/shaheenHarvest.test.ts; the run is scripts/shaheen-harvest/run.mts).
 *
 * The daily package of the AI platforms renews at midnight Pacific time and whatever is left of it is lost. So, while a
 * package has room, he answers ahead of time the questions visitors are likely to ask (theirs first, then everyday ones)
 * and keeps the good answers in his memory — the day the packages run out he still answers them, from memory.
 *
 *  - In the last two hours before the renewal («use it or lose it») he may use the regular chat models.
 *  - The rest of the day he uses only the open models served with their own, much larger quota (never the chat's).
 */
import { isPersonal, isTimeBound, normalizeQuestion, recall, recallSimilar, worthRemembering, type MemoryFile } from '../../src/utils/shaheenMemory';

export type HarvestMode = 'leftover' | 'open' | 'off';
export interface HarvestQuestion { q: string; lang: 'ar' | 'en'; topic: string; from: 'visitor' | 'bank' | 'school' }
export interface HarvestReport {
  version: 1;
  updatedAt: string;
  /** Answers he holds from the harvest (in the memory file now). */
  total: number;
  /** Bank questions still waiting to be answered. */
  waiting: number;
  runs: { at: string; mode: HarvestMode; asked: number; kept: number; stopped?: string }[];
  lastKept: { q: string; at: string; from: HarvestQuestion['from'] }[];
}

export const HARVEST_LIMITS = {
  /** Per run in the last two hours before the renewal (regular models; it runs once an hour). */
  leftover: 40,
  /** Per run the rest of the day (open models; hourly → about 130 a day at most). */
  open: 6,
  /** Already known when the memory holds this question or one this close to it. */
  known: 0.8,
};

/** The hour (0–23) in Pacific time, when the daily packages renew (daylight saving included). */
export function pacificHour(now: Date): number {
  const h = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hourCycle: 'h23' }).format(now);
  return Number(h) % 24;
}

/** Which models this hour may use: the leftover of the day's package in its last two hours, open models otherwise. */
export function harvestMode(now: Date, env: { HARVEST_MODE?: string } = {}): HarvestMode {
  const forced = env.HARVEST_MODE?.trim();
  if (forced === 'leftover' || forced === 'open' || forced === 'off') return forced;
  return pacificHour(now) >= 22 ? 'leftover' : 'open';
}

const langOf = (q: string): 'ar' | 'en' => (/[\u0600-\u06FF]/.test(q) ? 'ar' : 'en');

/** Questions worth answering ahead: clean, not personal, not about today, not already known. */
export function pickHarvest(candidates: HarvestQuestion[], memory: MemoryFile, limit: number): HarvestQuestion[] {
  const seen = new Set<string>();
  const out: HarvestQuestion[] = [];
  const order = { visitor: 0, school: 1, bank: 2 } as const;
  for (const c of [...candidates].sort((a, b) => order[a.from] - order[b.from])) {
    if (out.length >= limit) break;
    const q = c.q.trim();
    const key = normalizeQuestion(q);
    if (q.length < 6 || q.length > 300 || seen.has(key) || isTimeBound(q) || isPersonal(q)) continue;
    seen.add(key);
    if (recall(memory, q, c.lang, 'auto')) continue;
    const near = recallSimilar(memory, q, c.lang, HARVEST_LIMITS.known);
    if (near) continue;
    out.push({ ...c, q });
  }
  return out;
}

/** The bank file's questions (src/data/shaheen-harvest-bank.json). */
export function bankQuestions(file: unknown): HarvestQuestion[] {
  const list = (file as { questions?: { q?: unknown; lang?: unknown; topic?: unknown }[] } | undefined)?.questions;
  if (!Array.isArray(list)) return [];
  return list.filter((x) => typeof x?.q === 'string' && x.q.trim()).map((x) => ({
    q: String(x.q).trim(), lang: x.lang === 'en' || x.lang === 'ar' ? x.lang : langOf(String(x.q)), topic: typeof x.topic === 'string' ? x.topic : 'general', from: 'bank' as const,
  }));
}

/** Visitors' questions from the server's knowledge gaps (GET /api/admin/gaps). */
export function visitorHarvest(items: { question?: unknown; lang?: unknown; count?: unknown }[]): HarvestQuestion[] {
  return items.filter((x) => typeof x?.question === 'string').sort((a, b) => Number(b.count || 0) - Number(a.count || 0))
    .map((x) => ({ q: String(x.question).trim(), lang: x.lang === 'en' ? 'en' : x.lang === 'ar' ? 'ar' : langOf(String(x.question)), topic: 'visitor', from: 'visitor' as const }));
}

/** What the platform is told on top of Shaheen's usual instruction: the answer will be shown to other visitors later. */
export function harvestBrief(lang: 'ar' | 'en'): string {
  return lang === 'ar'
    ? 'هذه الإجابة ستُحفظ وتُعرض لاحقاً لأي زائر يسأل نفس السؤال: اجعلها عامة وصحيحة لأي شخص، بدون أسعار أو تواريخ أو أخبار أو إشارة لمحادثة سابقة، ومنظّمة بعناوين قصيرة ونقاط، بين 120 و350 كلمة، وبنفس لهجة السؤال.'
    : 'This answer will be saved and shown later to any visitor asking the same question: keep it general and true for anyone, with no prices, dates, news or reference to an earlier conversation, organised with short headings and bullet points, 120–350 words.';
}

const REFUSAL = /لا أستطيع|لا يمكنني|لا أعرف|غير متأكد|I can(?:no|')t|I am unable|I'm unable|I don't know|as an AI|كنموذج لغوي|كذكاء اصطناعي/i;

/** A harvested answer is kept only when it is a real, complete answer fit to be shown to anyone. */
export function harvestCheck(question: string, answer: string): { ok: boolean; why?: string } {
  const a = answer.trim();
  if (a.length < 200) return { ok: false, why: 'short' };
  if (!worthRemembering(question, a)) return { ok: false, why: 'not-worth' };
  if (REFUSAL.test(a.slice(0, 400))) return { ok: false, why: 'refusal' };
  if (langOf(question) === 'ar' && (a.match(/[\u0600-\u06FF]/g) || []).length < a.replace(/\s/g, '').length * 0.5) return { ok: false, why: 'language' };
  // A cut answer (the token limit) ends mid-sentence — never shown to anyone.
  if (!/[.!?؟。…:)\]*_`\u0600-\u06FF\w]\s*$/u.test(a) || /[،,]\s*$/.test(a)) return { ok: false, why: 'cut' };
  return { ok: true };
}

/** Adds this run to the report kept in src/data/live/shaheen-harvest.json. */
export function nextReport(previous: HarvestReport | undefined, run: HarvestReport['runs'][number], kept: { q: string; from: HarvestQuestion['from'] }[], total: number, waiting: number): HarvestReport {
  return {
    version: 1, updatedAt: run.at, total, waiting,
    runs: [run, ...(previous?.runs || [])].slice(0, 48),
    lastKept: [...kept.map((k) => ({ ...k, at: run.at })), ...(previous?.lastKept || [])].slice(0, 30),
  };
}

export function isHarvestReport(x: unknown): x is HarvestReport {
  const r = x as HarvestReport | undefined;
  return Boolean(r && r.version === 1 && Array.isArray(r.runs) && Array.isArray(r.lastKept));
}
