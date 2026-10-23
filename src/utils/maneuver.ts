/**
 * «مناورة التخصصات» — the field maneuver of the specialties.
 *
 * Every few hours a robot walks the LIVE site the way a visitor does (a phone browser on every public section, and
 * real conversations with Shaheen), and each section is examined by its own specialist (SITE_SECTIONS consultants).
 * What it finds — errors, and the improvements a section is missing — goes to «دولة المنصة», which decides which
 * sector and which robot each one belongs to (src/utils/stateSectors.ts) and turns the serious ones into tasks.
 *
 * This file is the shared vocabulary (browser-safe): the report, its reader, and the rules that turn what a page
 * showed into findings. The runner is scripts/shaheen-maneuver/run.mts; the chat drills are src/utils/maneuverDrills.ts.
 */
import { SITE_SECTIONS, primaryOf } from './shaheenSpecialists';

export type FindingKind = 'error' | 'idea';
export type FindingSeverity = 'high' | 'medium' | 'low';
/** Where it was seen: the phone browser, a live conversation, Shaheen's own brain offline, the rules, or an AI reviewer. */
export type FindingSource = 'browser' | 'chat-live' | 'brain' | 'rules' | 'ai';
/** What was seen — the State's sector office reads this, never the Arabic wording. */
export type FindingCode =
  | 'page-error' | 'console' | 'http' | 'asset-missing' | 'blank' | 'raw-text' | 'overflow' | 'broken-image' | 'slow'
  | 'no-alt' | 'unnamed-button' | 'no-heading' | 'unreachable'
  | 'chat-expect' | 'chat-own' | 'chat-repeat' | 'chat-lint' | 'chat-vendor' | 'chat-http' | 'chat-empty' | 'chat-lang'
  | 'ai-idea';
/** For conversations: whose craft the miss is (store advice, relations, knowledge, safety). */
export type ChatTopic = 'store' | 'relations' | 'knowledge' | 'safety';

export interface ManeuverFinding {
  /** Stable fingerprint (same problem → same id across runs). */
  id: string;
  kind: FindingKind;
  code: FindingCode;
  topic?: ChatTopic;
  /** SITE_SECTIONS id, or 'shaheen_chat' for the conversations. */
  section: string;
  sectionAr: string;
  titleAr: string;
  detailAr?: string;
  severity: FindingSeverity;
  sources: FindingSource[];
  /** The specialist who examined the section (its first consultant). */
  examinerAr?: string;
  firstSeen: string;
  lastSeen: string;
  /** Runs in a row it was seen. */
  seen: number;
}

export interface SectionResult {
  id: string;
  titleAr: string;
  status: 'ok' | 'warn' | 'fail' | 'skipped';
  errors: number;
  ideas: number;
  loadMs?: number;
  noteAr?: string;
}

export interface ManeuverReport {
  updatedAt: string;
  run: { ms: number; browser: boolean; browserNoteAr?: string; pages: number; drills: number; live: number; ai: boolean };
  sections: SectionResult[];
  findings: ManeuverFinding[];
  /** Problems that were seen before and are gone now (newest first, last 30). */
  resolved: { id: string; titleAr: string; section: string; at: string }[];
}

/** The pseudo-section of the conversations with Shaheen (he lives on every page). */
export const CHAT_SECTION = { id: 'shaheen_chat', titleAr: 'شات الخبير شاهين', titleEn: 'Chat with Shaheen' };
/** Private sections a visitor never opens (the admin panel needs the owner's code). */
export const PRIVATE_SECTIONS = new Set(['admin_panel']);
export const MANEUVER_LIMITS = { findings: 150, resolved: 30, liveDrills: 3 };

/** The public sections the maneuver opens, in order (the product page needs a product id). */
export const fieldSections = () => SITE_SECTIONS.filter((s) => !PRIVATE_SECTIONS.has(s.id));

export const sectionTitle = (id: string) => (id === CHAT_SECTION.id ? CHAT_SECTION.titleAr : SITE_SECTIONS.find((s) => s.id === id)?.titleAr || id);
export const examinerOf = (section: string) => primaryOf(section === CHAT_SECTION.id ? 'master_ai' : section)?.nameAr;

/** The hash a section opens on (the app routes by location.hash). */
export const sectionHash = (id: string, productId?: string | number) => (id === 'productDetail' ? (productId != null ? `#product=${productId}` : undefined) : `#${id}`);

// ── What a page showed → findings ──────────────────────────────────────────────────────────────────────────────

/** What the phone browser measured on one section (scripts/shaheen-maneuver/browser.ts). */
export interface PageProbe {
  section: string;
  url: string;
  ok: boolean;
  /** Why it could not be opened at all. */
  failure?: string;
  loadMs: number;
  pageErrors: string[];
  consoleErrors: string[];
  /** Failed requests: status (0 = network failure) and the URL. */
  failed: { status: number; url: string }[];
  textLength: number;
  /** Raw program text a visitor must never see (undefined, NaN, [object Object], {{…}}). */
  rawText: string[];
  overflowPx: number;
  brokenImages: number;
  imagesNoAlt: number;
  unnamedButtons: number;
  headings: number;
}

const short = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const hostOf = (u: string) => { try { return new URL(u).host; } catch { return ''; } };
const pathOf = (u: string) => { try { const x = new URL(u); return x.host + x.pathname; } catch { return u; } };
/** Console noise that is not the site's fault (extensions, browser policy notes, aborted media). */
const NOISE = /favicon|chrome-extension|ERR_BLOCKED_BY_CLIENT|net::ERR_ABORTED|Download the React DevTools|third-party cookie|Permissions-Policy|preload(?:ed)? .*not used/i;

type Draft = Omit<ManeuverFinding, 'firstSeen' | 'lastSeen' | 'seen' | 'sectionAr' | 'examinerAr'>;

/** The findings of one page (errors first, then the improvements it is missing). */
export function pageFindings(p: PageProbe): Draft[] {
  const s = p.section;
  const out: Draft[] = [];
  const add = (code: FindingCode, kind: FindingKind, severity: FindingSeverity, titleAr: string, detailAr?: string, key = '') =>
    out.push({ id: `${s}:${code}${key ? `:${key}` : ''}`, kind, code, section: s, titleAr, ...(detailAr ? { detailAr: short(detailAr, 300) } : {}), severity, sources: ['browser'] });
  if (!p.ok) {
    add('unreachable', 'error', 'high', 'القسم مافتحش خالص على الموبايل', p.failure);
    return out;
  }
  const pageErrors = [...new Set(p.pageErrors.map((e) => short(e)))];
  if (pageErrors.length) add('page-error', 'error', 'high', `خطأ برمجي وقت فتح القسم (${pageErrors.length})`, pageErrors.slice(0, 3).join(' | '));
  const logs = [...new Set(p.consoleErrors.filter((e) => !NOISE.test(e)).map((e) => short(e)))];
  if (logs.length) add('console', 'error', 'medium', `أخطاء في سجل المتصفح (${logs.length})`, logs.slice(0, 3).join(' | '));
  const failed = p.failed.filter((f) => !NOISE.test(f.url));
  const server = failed.filter((f) => f.status >= 500 || f.status === 0);
  const missing = failed.filter((f) => f.status >= 400 && f.status < 500);
  if (server.length) add('http', 'error', 'high', `طلبات للسيرفر فشلت (${server.length})`, server.slice(0, 3).map((f) => `${f.status || 'شبكة'} ${pathOf(f.url)}`).join(' | '));
  if (missing.length) {
    add('asset-missing', 'error', missing.some((f) => hostOf(f.url) === hostOf(p.url)) ? 'medium' : 'low',
      `ملفات أو صور مش موجودة (${missing.length})`, missing.slice(0, 3).map((f) => `${f.status} ${pathOf(f.url)}`).join(' | '));
  }
  if (p.textLength < 80) add('blank', 'error', 'high', 'القسم فاضي — الزائر مش شايف محتوى', `طول النص الظاهر ${p.textLength} حرف`);
  if (p.rawText.length) add('raw-text', 'error', 'high', 'كلام برمجي ظاهر للزائر', [...new Set(p.rawText)].slice(0, 4).join(' | '));
  if (p.overflowPx > 8) add('overflow', 'error', 'medium', 'الصفحة أعرض من شاشة الموبايل (فيه سحب جانبي)', `زيادة ${p.overflowPx} بكسل على عرض 390`);
  if (p.brokenImages) add('broken-image', 'error', 'medium', `صور مكسورة (${p.brokenImages})`);
  if (p.loadMs > 9000) add('slow', 'error', 'medium', `القسم بطيء جداً (${Math.round(p.loadMs / 1000)} ثانية)`);
  else if (p.loadMs > 5000) add('slow', 'idea', 'low', `تسريع القسم (بيفتح في ${Math.round(p.loadMs / 1000)} ثواني)`);
  // Improvements: what a careful designer and an accessibility reviewer would add.
  if (p.imagesNoAlt) add('no-alt', 'idea', 'low', `وصف للصور (${p.imagesNoAlt} صورة من غير وصف) — يفيد المكفوفين والظهور في البحث`);
  if (p.unnamedButtons) add('unnamed-button', 'idea', 'low', `أسماء للأزرار اللي عليها أيقونة بس (${p.unnamedButtons}) — قارئ الشاشة مش بيعرف وظيفتها`);
  if (!p.headings) add('no-heading', 'idea', 'low', 'عنوان واضح للقسم في أوله — يسهّل القراءة والبحث');
  return out;
}

/** A section's verdict from its findings. */
export function sectionStatus(findings: Pick<ManeuverFinding, 'kind' | 'severity'>[]): SectionResult['status'] {
  const errors = findings.filter((f) => f.kind === 'error');
  if (errors.some((f) => f.severity === 'high')) return 'fail';
  return errors.length ? 'warn' : 'ok';
}

/**
 * This run's findings merged with the last report: the same id keeps its first sighting and counts the runs in a row;
 * what a source that ran this time no longer sees is resolved; what a source that did NOT run saw is kept as it was.
 */
export function mergeFindings(previous: ManeuverReport | undefined, now: Draft[], ran: Set<FindingSource>, at: string): { findings: ManeuverFinding[]; resolved: ManeuverReport['resolved'] } {
  const old = new Map((previous?.findings ?? []).map((f) => [f.id, f]));
  const byId = new Map<string, Draft>();
  for (const d of now) {
    const had = byId.get(d.id);
    if (!had) { byId.set(d.id, { ...d, sources: [...d.sources] }); continue; }
    had.sources = [...new Set([...had.sources, ...d.sources])];
    if (rank(d.severity) > rank(had.severity)) had.severity = d.severity;
  }
  const findings: ManeuverFinding[] = [...byId.values()].map((d) => {
    const before = old.get(d.id);
    return { ...d, sectionAr: sectionTitle(d.section), ...(examinerOf(d.section) ? { examinerAr: examinerOf(d.section) } : {}), firstSeen: before?.firstSeen || at, lastSeen: at, seen: (before?.seen || 0) + 1 };
  });
  const resolved = [...(previous?.resolved ?? [])];
  for (const f of old.values()) {
    if (byId.has(f.id)) continue;
    if (f.sources.some((s) => ran.has(s))) resolved.unshift({ id: f.id, titleAr: f.titleAr, section: f.section, at });
    else findings.push(f);
  }
  findings.sort((a, b) => Number(b.kind === 'error') - Number(a.kind === 'error') || rank(b.severity) - rank(a.severity) || a.section.localeCompare(b.section));
  return { findings: findings.slice(0, MANEUVER_LIMITS.findings), resolved: resolved.slice(0, MANEUVER_LIMITS.resolved) };
}

const rank = (s: FindingSeverity) => (s === 'high' ? 3 : s === 'medium' ? 2 : 1);
export const severityRank = rank;

// ── Reader ─────────────────────────────────────────────────────────────────────────────────────────────────────

const KINDS = new Set<FindingKind>(['error', 'idea']);
const SEVERITIES = new Set<FindingSeverity>(['high', 'medium', 'low']);
const str = (v: unknown, n = 400) => (typeof v === 'string' ? v.slice(0, n) : '');

/** Reads the report file (tolerant: anything broken is dropped, never thrown). */
export function readManeuverReport(raw: unknown): ManeuverReport | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  if (!str(r.updatedAt)) return undefined;
  const run = (r.run && typeof r.run === 'object' ? r.run : {}) as Record<string, unknown>;
  const findings = (Array.isArray(r.findings) ? r.findings : []).flatMap((x): ManeuverFinding[] => {
    if (!x || typeof x !== 'object') return [];
    const f = x as Record<string, unknown>;
    const id = str(f.id, 160); const titleAr = str(f.titleAr, 300); const section = str(f.section, 60);
    if (!id || !titleAr || !section || !KINDS.has(f.kind as FindingKind)) return [];
    const severity = SEVERITIES.has(f.severity as FindingSeverity) ? f.severity as FindingSeverity : 'low';
    const sources = (Array.isArray(f.sources) ? f.sources : []).filter((s): s is FindingSource => typeof s === 'string' && ['browser', 'chat-live', 'brain', 'rules', 'ai'].includes(s));
    return [{
      id, kind: f.kind as FindingKind, code: (str(f.code, 40) || 'ai-idea') as FindingCode, ...(str(f.topic, 20) ? { topic: str(f.topic, 20) as ChatTopic } : {}),
      section, sectionAr: str(f.sectionAr, 120) || sectionTitle(section), titleAr, ...(str(f.detailAr) ? { detailAr: str(f.detailAr) } : {}),
      severity, sources: sources.length ? sources : ['rules'], ...(str(f.examinerAr, 120) ? { examinerAr: str(f.examinerAr, 120) } : {}),
      firstSeen: str(f.firstSeen, 40) || str(r.updatedAt), lastSeen: str(f.lastSeen, 40) || str(r.updatedAt), seen: Math.max(1, Number(f.seen) || 1),
    }];
  }).slice(0, MANEUVER_LIMITS.findings);
  const sections = (Array.isArray(r.sections) ? r.sections : []).flatMap((x): SectionResult[] => {
    if (!x || typeof x !== 'object') return [];
    const s = x as Record<string, unknown>;
    const status = ['ok', 'warn', 'fail', 'skipped'].includes(s.status as string) ? s.status as SectionResult['status'] : 'skipped';
    return str(s.id, 60) ? [{ id: str(s.id, 60), titleAr: str(s.titleAr, 120) || sectionTitle(str(s.id, 60)), status, errors: Number(s.errors) || 0, ideas: Number(s.ideas) || 0, ...(Number(s.loadMs) ? { loadMs: Number(s.loadMs) } : {}), ...(str(s.noteAr) ? { noteAr: str(s.noteAr) } : {}) }] : [];
  });
  const resolved = (Array.isArray(r.resolved) ? r.resolved : []).flatMap((x) => {
    const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    return str(o.id, 160) ? [{ id: str(o.id, 160), titleAr: str(o.titleAr, 300), section: str(o.section, 60), at: str(o.at, 40) }] : [];
  }).slice(0, MANEUVER_LIMITS.resolved);
  return {
    updatedAt: str(r.updatedAt),
    run: { ms: Number(run.ms) || 0, browser: run.browser === true, ...(str(run.browserNoteAr) ? { browserNoteAr: str(run.browserNoteAr) } : {}), pages: Number(run.pages) || 0, drills: Number(run.drills) || 0, live: Number(run.live) || 0, ai: run.ai === true },
    sections, findings, resolved,
  };
}

/** One line for the step summary and the State's log. */
export function maneuverSummaryAr(r: ManeuverReport): string {
  const errors = r.findings.filter((f) => f.kind === 'error');
  const high = errors.filter((f) => f.severity === 'high').length;
  const ideas = r.findings.length - errors.length;
  return `مناورة التخصصات: ${r.run.pages} قسم اتفتح على الموبايل و${r.run.drills + r.run.live} محادثة تدريب — ${errors.length} خطأ (${high} خطير) و${ideas} فكرة تطوير، و${r.resolved.filter((x) => x.at === r.updatedAt).length} مشكلة اتحلت من آخر مرة.`;
}
