/**
 * «مختبر عقل شاهين» — the training data for Shaheen's own small model (the owner's request, 2026-10-24).
 *
 * Shaheen already knows a lot: his memory (src/data/live/shaheen-memory.json — every lesson the school reviewed),
 * the assistant's lessons (sham-training.json), the lab's experiments and research (shaheen-lab.json), and his own
 * way of handling people (src/utils/shaheenRelations.ts, run through the field drills). This module turns that
 * into chat examples a small open model can be fine-tuned on (LoRA, scripts/shaheen-brain/train_lora.py).
 *
 * The rules (pure, browser-safe, tested in tests/shaheenBrain.test.ts):
 *   - nothing personal: an e-mail other than the store's, a phone number, a card-like number or a secret-looking
 *     link drops the example (never "cleaned" — dropped);
 *   - no price: prices change every day and live only in the store system, so a model must never learn one;
 *   - no AI vendor or model name: visitors never see who is behind Shaheen;
 *   - visitors' chats are never used (their words are theirs) — only what Shaheen studied and was reviewed;
 *   - the same question twice (after Arabic normalisation) is kept once;
 *   - a stable ~5 % of the answers (with every rephrasing of their question) are held out for the exam
 *     (scripts/shaheen-brain/exam.ts) and never trained on.
 */
import { createHash } from 'node:crypto';
import { STORE_EMAIL } from '../../src/config/contact';

export type BrainLang = 'ar' | 'en';
export type BrainSource = 'memory' | 'lessons' | 'lab' | 'relations';
export interface BrainMessage { role: 'system' | 'user' | 'assistant'; content: string }
export interface BrainExample { id: string; source: BrainSource; lang: BrainLang; messages: BrainMessage[] }
export interface BrainPair { q: string; a: string; lang: BrainLang; source: BrainSource }
export type DropReason = 'personal' | 'price' | 'vendor' | 'short' | 'long' | 'duplicate';

/** The same instructions at training and at inference (the exam and any runner use SHAHEEN_SYSTEM). */
export const SHAHEEN_SYSTEM: Record<BrainLang, string> = {
  ar: 'إنت «شاهين»، خبير متجر شام للعطور ومساعده. بترد بالعربي البسيط الواضح، بدقة وأمانة. '
    + 'لو مش متأكد قول إنك مش متأكد وماتخمّنش. ماتألّفش سعر ولا خصم ولا تعويض ولا ميعاد توصيل ولا سياسة: الأسعار والمخزون من نظام المتجر بس. '
    + 'ماتطلبش أرقام بطاقات ولا كلمات سر أبداً. في الصحة والسلامة انصح بالرجوع لمتخصص.',
  en: 'You are "Shaheen", the expert and assistant of the Sham Perfumes store. Answer clearly, accurately and honestly. '
    + 'If you are not sure, say so instead of guessing. Never invent a price, discount, compensation, delivery date or policy: prices and stock come only from the store system. '
    + 'Never ask for card numbers or passwords. For health and safety, advise seeing a specialist.',
};

export const LIMITS = { minAnswer: 24, maxAnswer: 2400, maxQuestion: 400, evalShare: 5, maxEval: 300 } as const;

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE = /(?:\+|00)?\d[\d\s\-().]{8,}\d/;
const SECRET_LINK = /https?:\/\/\S*[?&](?:token|key|sig|signature|auth|code|password)=/i;
// A price: a number next to a currency (EGP, جنيه, $, ريال …) in either order. Arabic currency words count only as
// whole words («مونتريال» and «حجم» are not prices).
const AR_WORD = (w: string) => `(?<![\\u0621-\\u064A])(?:${w})(?![\\u0621-\\u064A])`;
const CURRENCY = `(?:${AR_WORD('ج\\.م|جنيه|جنيهات|جنيهًا|جنيها|دولار|دولارات|ريال|ريالات|درهم|دراهم|دينار|يورو')}|\\b(?:EGP|USD|SAR|AED|KWD|QAR|MYR|EUR|GBP)\\b|US\\$|\\$|€|£)`;
const PRICE = new RegExp(`(?:\\d[\\d,.٬]*\\s*${CURRENCY})|(?:${CURRENCY}\\s*\\d)`, 'i');
const VENDOR = /\b(?:gemini|gemma|openai|chat\s?gpt|gpt-?\d|anthropic|claude|deepseek|openrouter|perplexity|mistral|manus|llama|qwen|copilot|bard)\b|جيميناي|جيمناي|شات ?جي ?بي ?تي|أوبن ?إيه ?آي|كلود|ديب ?سيك/i;

const ARABIC_LETTER = /[\u0621-\u064A]/;
/** Digits of any script as plain digits, for the number checks. */
const westernDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

/** Something personal in the text: an e-mail other than the store's, a phone, a card-like number, a secret link. */
export function hasPersonal(text: string): boolean {
  const t = westernDigits(text);
  for (const m of t.match(EMAIL) || []) if (m.toLowerCase() !== STORE_EMAIL) return true;
  if (SECRET_LINK.test(t)) return true;
  const runs = t.match(/\d[\d\s-]{11,}\d/g) || [];
  if (runs.some((r) => { const n = r.replace(/\D/g, '').length; return n >= 13 && n <= 19; })) return true;
  // Phone-shaped runs (10+ digits); years, year ranges, percentages and formulas are shorter and pass.
  return (t.match(new RegExp(PHONE.source, 'g')) || []).some((m) => m.replace(/\D/g, '').length >= 10);
}
export const hasPrice = (text: string) => PRICE.test(westernDigits(text));
export const hasVendor = (text: string) => VENDOR.test(text);

/** Arabic-aware key for the duplicate check: no diacritics, unified alef/yaa/taa marbuta, no punctuation. */
export function questionKey(q: string): string {
  return q.toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/** Why a question/answer pair cannot be trained on, or undefined when it is fine. */
export function dropReason(q: string, a: string): Exclude<DropReason, 'duplicate'> | undefined {
  const question = q.trim(); const answer = a.trim();
  if (hasPersonal(question) || hasPersonal(answer)) return 'personal';
  if (hasVendor(question) || hasVendor(answer)) return 'vendor';
  if (hasPrice(answer)) return 'price';
  if (answer.length < LIMITS.minAnswer || question.length < 3) return 'short';
  if (answer.length > LIMITS.maxAnswer || question.length > LIMITS.maxQuestion) return 'long';
  return undefined;
}

export const langOf = (text: string): BrainLang => (ARABIC_LETTER.test(text) ? 'ar' : 'en');
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
/** Stable split: the same key always lands on the same side, run after run. */
export const isHeldOut = (key: string) => parseInt(hash(`exam|${key}`).slice(0, 8), 16) % 100 < LIMITS.evalShare;

/* ───── the sources ───── */

interface MemoryFile { entries?: { question?: string; answer?: string; lang?: string; source?: string }[] }
interface LessonsFile { docs?: { title?: string; content?: string }[] }
interface LabFile {
  experiments?: { titleAr?: string; questionAr?: string; hypothesisAr?: string; steps?: unknown; safetyAr?: string; expectedAr?: string }[];
  research?: { titleAr?: string; scientistAr?: string; yearAr?: string; findingAr?: string }[];
}

/** Shaheen's reviewed memory. Visitors' chats and probes are left out: only what he studied and passed review. */
export function fromMemory(file: MemoryFile | undefined): BrainPair[] {
  return (file?.entries || [])
    .filter((e) => (e.source === 'study' || e.source === 'harvest') && e.question && e.answer)
    .map((e) => ({ q: e.question!.trim(), a: e.answer!.trim(), lang: (e.lang === 'en' ? 'en' : langOf(e.question!)) as BrainLang, source: 'memory' as const }));
}

/** The assistant's lessons: «اشرحلي …» → the lesson. */
export function fromLessons(file: LessonsFile | undefined): BrainPair[] {
  return (file?.docs || []).filter((d) => d.title && d.content).map((d) => {
    const lang = langOf(d.title!);
    return { q: lang === 'ar' ? `اشرحلي ${d.title!.trim()}` : `Explain: ${d.title!.trim()}`, a: d.content!.trim(), lang, source: 'lessons' as const };
  });
}

/** The lab: each experiment's question answered with its hypothesis, steps and safety; each research finding. */
export function fromLab(file: LabFile | undefined): BrainPair[] {
  const out: BrainPair[] = [];
  for (const x of file?.experiments || []) {
    if (!x.questionAr || !x.hypothesisAr) continue;
    // The report keeps only the step count; the full steps live in the lab's own data.
    const steps = Array.isArray(x.steps) ? x.steps.filter((s): s is string => typeof s === 'string' && Boolean(s)).map((s, i) => `${i + 1}. ${s}`).join('\n') : '';
    const a = [`الفرضية: ${x.hypothesisAr}`, steps && `خطوات التجربة:\n${steps}`, x.expectedAr && `المتوقع: ${x.expectedAr}`, x.safetyAr && `السلامة: ${x.safetyAr}`].filter(Boolean).join('\n\n');
    out.push({ q: x.questionAr.trim(), a, lang: 'ar', source: 'lab' });
  }
  for (const r of file?.research || []) {
    if (!r.titleAr || !r.findingAr) continue;
    const who = [r.scientistAr, r.yearAr].filter(Boolean).join('، ');
    out.push({ q: `إيه أهم نتيجة في «${r.titleAr.trim()}»؟`, a: `${who ? `${who}: ` : ''}${r.findingAr.trim()}`, lang: 'ar', source: 'lab' });
  }
  return out;
}

/** One conversation of Shaheen's own relations engine (the field drills), already graded clean by the caller. */
export interface RelationsTalk { lang: BrainLang; turns: { user: string; assistant: string }[] }

/* ───── the dataset ───── */

export interface BrainCard {
  builtAt: string;
  train: number; eval: number;
  bySource: Record<BrainSource, number>;
  byLang: Record<BrainLang, number>;
  dropped: Record<DropReason, number>;
  /** Fingerprint of the training file: the trainer and the exam check they use the same data. */
  sha256: { train: string; eval: string };
}
export interface BrainDataset { train: BrainExample[]; eval: BrainExample[]; card: BrainCard }

const single = (p: BrainPair, key: string): BrainExample => ({
  id: hash(`${p.source}|${key}`).slice(0, 16), source: p.source, lang: p.lang,
  messages: [{ role: 'system', content: SHAHEEN_SYSTEM[p.lang] }, { role: 'user', content: p.q }, { role: 'assistant', content: p.a }],
});

export const toJsonl = (rows: BrainExample[]) => rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : '');

export function buildDataset(pairs: BrainPair[], talks: RelationsTalk[], now = new Date()): BrainDataset {
  const dropped: Record<DropReason, number> = { personal: 0, price: 0, vendor: 0, short: 0, long: 0, duplicate: 0 };
  const seen = new Set<string>();
  const train: BrainExample[] = []; const held: BrainExample[] = [];
  for (const p of pairs) {
    const why = dropReason(p.q, p.a);
    if (why) { dropped[why] += 1; continue; }
    const key = questionKey(p.q);
    if (!key || seen.has(key)) { dropped.duplicate += 1; continue; }
    seen.add(key);
    const ex = single(p, key);
    // Only single questions are held out: the exam asks one question and compares with the reviewed answer.
    // The split goes by the ANSWER, so the rephrasings of one question (same reviewed answer) all land on the same
    // side — a model never sees the exam's answer under another wording.
    if (isHeldOut(questionKey(p.a).slice(0, 600)) && held.length < LIMITS.maxEval) held.push(ex); else train.push(ex);
  }
  for (const t of talks) {
    const turns = t.turns.filter((x) => x.user.trim() && x.assistant.trim());
    if (!turns.length) continue;
    const why = turns.map((x) => dropReason(x.user, x.assistant)).find(Boolean);
    if (why) { dropped[why] += 1; continue; }
    const key = questionKey(turns.map((x) => x.user).join(' | '));
    if (seen.has(key)) { dropped.duplicate += 1; continue; }
    seen.add(key);
    train.push({
      id: hash(`relations|${key}`).slice(0, 16), source: 'relations', lang: t.lang,
      messages: [{ role: 'system', content: SHAHEEN_SYSTEM[t.lang] }, ...turns.flatMap((x) => [{ role: 'user' as const, content: x.user.trim() }, { role: 'assistant' as const, content: x.assistant.trim() }])],
    });
  }
  const all = [...train, ...held];
  const count = <K extends string>(keys: readonly K[], pick: (e: BrainExample) => K) => Object.fromEntries(keys.map((k) => [k, all.filter((e) => pick(e) === k).length])) as Record<K, number>;
  return {
    train, eval: held,
    card: {
      builtAt: now.toISOString(), train: train.length, eval: held.length,
      bySource: count(['memory', 'lessons', 'lab', 'relations'] as const, (e) => e.source),
      byLang: count(['ar', 'en'] as const, (e) => e.lang),
      dropped,
      sha256: { train: hash(toJsonl(train)), eval: hash(toJsonl(held)) },
    },
  };
}
