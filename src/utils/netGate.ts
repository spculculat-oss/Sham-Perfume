/**
 * «بوابة الإنترنت» — the one door between the platform's robots and the internet (the owner's decision, 2026-11-15:
 * «خلى فيه اداة وسيطة بين الروبوتات والانترنت يلجأوا ليها فى استجلاب المعلومات»).
 *
 * Every robot and every AI tool of the platform may ask it for information; none needs its own way out. It:
 *   - searches the web (the AI platform's live search when connected, else the free encyclopedia) and reads public
 *     pages (http/https, public addresses only — checked again on every redirect, see server/workspace.ts readPage);
 *   - cleans what a robot sends out: card / national-ID / bank numbers, phone numbers, e-mails and anything that
 *     looks like a key never leave the platform;
 *   - refuses pages it must not read: the AI platforms themselves (robots reach them only through the engines, rule
 *     O-10), Google's own result pages (the legal manager's rule), and private or local addresses;
 *   - remembers answers for a while (one question asked by ten robots costs one search) and keeps each robot inside a
 *     daily allowance, so the free quotas last;
 *   - keeps counts only (who asked how often, what failed) — never the questions or the pages — for the owner's suite.
 *
 * Pure (browser-safe): the server's gate (server/core/netGate.ts), the robots' client (scripts/net-gate.mts), the
 * owner's suite and the tests all read it.
 */
import { BOTS } from './shaheenOrg';
import { AI_TOOLS } from './aiTools';
import { maskSensitive } from './ownerAuthority';

export const GATE = {
  id: 'net_gate',
  nameAr: 'بوابة الإنترنت',
  nameEn: 'Internet gateway',
  dutyAr: 'الباب الوحيد بين الروبوتات والإنترنت: أي روبوت محتاج معلومة يطلبها منها، وهي تدوّر وتقرا الصفحات العامة بأمان، وتنضّف أي بيانات حساسة قبل ما تخرج، وتفتكر النتيجة علشان ماتتكررش، وتحافظ على الحصة المجانية.',
} as const;

export const GATE_LIMITS = {
  /** Per robot per day (UTC). */
  perBot: { search: 80, read: 160, ask: 40 },
  /** The whole platform per day: the free quotas are shared. */
  daily: { search: 1500, read: 3000, ask: 600 },
  /** How long an answer is reused. */
  ttlMs: { search: 30 * 60_000, read: 6 * 3600_000, ask: 30 * 60_000 },
  cacheEntries: 400,
  queryChars: 300,
  urlChars: 2000,
  /** What a robot gets back from one page (the rest is summarised as «truncated»). */
  readChars: 20_000,
  /** «ask»: how many of the found pages are read for a fuller answer. */
  askPages: 2,
} as const;

export type GateKind = 'search' | 'read' | 'ask';

/** Who may use the gate: every robot of the platform and every AI tool (the owner's decision: all of them). */
export function gateClients(): { id: string; nameAr: string }[] {
  const out = new Map<string, string>();
  for (const b of BOTS) out.set(b.id, b.nameAr);
  for (const t of AI_TOOLS) if (!out.has(t.id)) out.set(t.id, t.nameAr);
  out.set('owner', 'صاحب الموقع');
  out.set('owner_room', 'شاهين في غرفة صاحب الموقع');
  return [...out.entries()].map(([id, nameAr]) => ({ id, nameAr }));
}
export const isGateClient = (id: unknown): id is string => typeof id === 'string' && gateClients().some((c) => c.id === id);
export const gateClientName = (id: string) => gateClients().find((c) => c.id === id)?.nameAr ?? id;

// ── What leaves the platform ───────────────────────────────────────────────────────────────────────────────
const KEY_LIKE = /AIza[0-9A-Za-z_-]{20,}|\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{16,}|\bgh[pousr]_[A-Za-z0-9]{20,}|\bglpat-[A-Za-z0-9_-]{16,}|\bxox[baprs]-[A-Za-z0-9-]{10,}|\b(?:Bearer|token|key|password|secret)\s*[:=]\s*\S{6,}/gi;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const PHONE = /\+?[0-9٠-٩][0-9٠-٩\s().-]{6,}[0-9٠-٩]/g;
/** A phone is 9–15 digits; a date (2026-11-15), a CAS number (8000-41-7) or a short list of years is not. */
function looksLikePhone(m: string): boolean {
  const digits = (m.match(/[0-9٠-٩]/g) || []).length;
  if (digits < 9 || digits > 15) return false;
  const t = m.trim();
  if (/^[0-9٠-٩]{4}[-/.][0-9٠-٩]{1,2}[-/.][0-9٠-٩]{1,2}$/.test(t)) return false;
  if (/^[0-9٠-٩]{2,7}-[0-9٠-٩]{2}-[0-9٠-٩]$/.test(t)) return false;
  return true;
}

/** A robot's question as it may leave the platform: no keys, no contacts, no personal numbers. */
export function scrubQuery(text: string): { text: string; removed: number } {
  let removed = 0;
  const hide = (re: RegExp, s: string) => s.replace(re, () => { removed++; return ' '; });
  let out = hide(KEY_LIKE, String(text || ''));
  out = hide(EMAIL, out);
  out = out.replace(PHONE, (m) => { if (!looksLikePhone(m)) return m; removed++; return ' '; });
  const masked = maskSensitive(out);
  if (masked !== out) removed++;
  out = masked.replace(/•+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, GATE_LIMITS.queryChars);
  return { text: out, removed };
}

/** Pages the gate never reads for a robot (the server checks the address itself on top of this). */
const BLOCKED_HOSTS: [RegExp, string][] = [
  [/(^|\.)generativelanguage\.googleapis\.com$|(^|\.)api\.openai\.com$|(^|\.)api\.anthropic\.com$|(^|\.)api\.deepseek\.com$|(^|\.)openrouter\.ai$|(^|\.)api\.perplexity\.ai$|(^|\.)api\.manus\.ai$|(^|\.)api\.groq\.com$|(^|\.)api\.mistral\.ai$/i,
    'منصة ذكاء اصطناعي — الروبوتات بتكلمها من المحركات بس (O-10)'],
  [/^(localhost|.*\.local|.*\.internal|metadata\.google\.internal)$/i, 'عنوان داخلي'],
];
export type GateUrlRule = { ok: true; url: string } | { ok: false; reasonAr: string };
export function gateUrlRule(raw: unknown): GateUrlRule {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > GATE_LIMITS.urlChars) return { ok: false, reasonAr: 'رابط مش صالح' };
  let url: URL;
  try { url = new URL(raw.trim()); } catch { return { ok: false, reasonAr: 'رابط مش صالح' }; }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) return { ok: false, reasonAr: 'روابط http و https العامة بس' };
  if (url.port && !['80', '443'].includes(url.port)) return { ok: false, reasonAr: 'بورتات الويب العادية بس' };
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (/^(?:www\.)?google\.[a-z.]+$/i.test(host) && /^\/(?:search|url)\b/.test(url.pathname)) return { ok: false, reasonAr: 'صفحات نتايج جوجل نفسها — قرار المدير القانوني (البحث بيتم من البوابة)' };
  for (const [re, reasonAr] of BLOCKED_HOSTS) if (re.test(host)) return { ok: false, reasonAr };
  // A secret in the link itself (a key in the query string) never leaves.
  if (scrubQuery(decodeURIComponent(url.search)).removed) return { ok: false, reasonAr: 'الرابط فيه بيانات حساسة (مفتاح أو رقم أو إيميل)' };
  return { ok: true, url: url.href };
}

// ── A request ───────────────────────────────────────────────────────────────────────────────────────────────
export interface GateRequest { kind: GateKind; bot: string; q?: string; url?: string; lang: string }
export type GateCheck = { ok: true; req: GateRequest; removed: number } | { ok: false; code: 'NOT_CLIENT' | 'BAD_REQUEST' | 'BLOCKED'; reasonAr: string };

/** Checks and cleans one request before anything goes out. */
export function checkGateRequest(body: unknown): GateCheck {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const kind = b.kind;
  if (kind !== 'search' && kind !== 'read' && kind !== 'ask') return { ok: false, code: 'BAD_REQUEST', reasonAr: 'نوع الطلب لازم يكون search أو read أو ask' };
  if (!isGateClient(b.bot)) return { ok: false, code: 'NOT_CLIENT', reasonAr: 'الروبوت ده مش مسجل في المنصة — البوابة لروبوتات شام بس' };
  const lang = typeof b.lang === 'string' && /^[a-z]{2}$/.test(b.lang) ? b.lang : 'ar';
  if (kind === 'read') {
    const rule = gateUrlRule(b.url);
    if (!rule.ok) return { ok: false, code: 'BLOCKED', reasonAr: rule.reasonAr };
    return { ok: true, req: { kind, bot: b.bot, url: rule.url, lang }, removed: 0 };
  }
  const { text, removed } = scrubQuery(typeof b.q === 'string' ? b.q : '');
  if (text.length < 2) return { ok: false, code: 'BAD_REQUEST', reasonAr: removed ? 'السؤال كان كله بيانات حساسة، فاتشال ومافضلش حاجة تتدوّر' : 'السؤال فاضي' };
  return { ok: true, req: { kind, bot: b.bot, q: text, lang }, removed };
}

/** The key answers are remembered under: the same question from any robot is one search. */
export const gateCacheKey = (r: GateRequest) => `${r.kind}:${r.lang}:${(r.kind === 'read' ? r.url! : r.q!.toLowerCase().replace(/\s+/g, ' ')).slice(0, 400)}`;

// ── What comes back ────────────────────────────────────────────────────────────────────────────────────────
export interface GateSource { title: string; url: string; snippet: string }
export interface GateAnswer {
  kind: GateKind;
  /** A short written answer when the search platform gave one (or the pages read for «ask»). */
  answer?: string;
  sources: GateSource[];
  /** «read» and «ask»: the readable text of the page(s). */
  page?: { url: string; title: string; text: string; truncated: boolean };
  pages?: { url: string; title: string; text: string }[];
  /** Where it came from: the live web, or the encyclopedia when no live search is connected. */
  via: 'web' | 'encyclopedia' | 'page';
  cached: boolean;
  /** Personal or secret bits removed from the question before it left. */
  removed?: number;
  at: string;
}

/** What a robot reads back: the answer and its sources, short enough for an instruction. Untrusted text. */
export function gateBrief(a: GateAnswer, max = 4000): string {
  const lines: string[] = [];
  if (a.answer) lines.push(a.answer.trim());
  if (a.page) lines.push(`# ${a.page.title}\n${a.page.text}`);
  for (const p of a.pages || []) lines.push(`# ${p.title} — ${p.url}\n${p.text}`);
  if (a.sources.length) lines.push(a.sources.map((s, i) => `[${i + 1}] ${s.title} — ${s.url}${s.snippet ? `\n${s.snippet}` : ''}`).join('\n'));
  const text = lines.join('\n\n').trim();
  return (text.length > max ? `${text.slice(0, max)}…` : text) || 'مفيش نتايج.';
}

// ── The counts the owner sees ──────────────────────────────────────────────────────────────────────────────
export interface GateUse { search: number; read: number; ask: number; cached: number; refused: number; failed: number }
export interface GateStats { day: string; total: GateUse; bots: Record<string, GateUse>; cacheEntries: number; live: boolean }
export const emptyUse = (): GateUse => ({ search: 0, read: 0, ask: 0, cached: 0, refused: 0, failed: 0 });

/** The status as the suite shows it: the busiest robots first, and how much of today's allowance is used. */
export function gateSummary(s: GateStats): { usedPercent: number; top: { id: string; nameAr: string; calls: number }[] } {
  const calls = (u: GateUse) => u.search + u.read + u.ask;
  const used = Math.max(s.total.search / GATE_LIMITS.daily.search, s.total.read / GATE_LIMITS.daily.read, s.total.ask / GATE_LIMITS.daily.ask);
  const top = Object.entries(s.bots).map(([id, u]) => ({ id, nameAr: gateClientName(id), calls: calls(u) })).filter((x) => x.calls > 0)
    .sort((a, b) => b.calls - a.calls).slice(0, 8);
  return { usedPercent: Math.min(100, Math.round(used * 100)), top };
}
