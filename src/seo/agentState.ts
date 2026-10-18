/**
 * The live state of «منارة شاهين»: what he studied, what he found, what he changed, what search
 * engines received, Shaheen's grade, and the trust level that decides how much he may do alone.
 * Pure and shared by the GitHub Actions run, the admin run and the panel, so all three agree.
 */
import type { SeoFinding, Severity } from './audit';
import { validateSeoCopy } from './audit';
import type { SeoTrustLevel } from './site';
import { SEARCH_ENGINES, SEO_AGENT, SITE } from './site';
import type { SeoFaq } from './pages';

export interface SeoPageCopy {
  title: string;
  description: string;
  h1?: string;
  faq?: SeoFaq[];
  source: 'ai' | 'baseline';
  at: string;
}
export interface SeoAppliedChange {
  at: string;
  pageId: string;
  pagePath: string;
  field: 'title' | 'description' | 'h1' | 'faq';
  before: string;
  after: string;
  reason: string;
  reverted?: boolean;
}
export interface SeoAuditSnapshot {
  at: string;
  score: number;
  bySeverity: { critical: number; major: number; minor: number };
  byArea: Record<string, number>;
  findings: SeoFinding[];
  pagesChecked: number;
}
export interface SeoLessonNote {
  id: string;
  titleAr: string;
  at: string;
  takeaway: string;
  checklist: string[];
}
export interface SeoCoach {
  at: string;
  score?: number;
  strengths: string[];
  issues: string[];
  guidance?: string;
  readyForAutonomy: boolean;
  note?: string;
}
export interface SeoSubmission {
  engine: string;
  method: 'indexnow' | 'bing-api' | 'gsc' | 'sitemap' | 'websub';
  at: string;
  urls: number;
  ok: boolean;
  detail?: string;
}
export interface SeoMediaReport {
  at: string;
  headline: string;
  paragraphs: string[];
  boilerplate: string;
  social: string[];
  ideas: string[];
  source: 'ai' | 'local';
}
export interface SeoRun {
  at: string;
  trigger: 'schedule' | 'admin' | 'manual' | 'build';
  auditScore: number;
  findings: number;
  applied: number;
  lessonId?: string;
  engine?: string;
  submitted: number;
  notes: string[];
  ms: number;
}
export interface SeoEngineReport {
  id: string;
  nameAr: string;
  status: 'submitted' | 'ready' | 'owner';
  detail?: string;
  at?: string;
}
/** What the agent can verify without any account (see src/seo/discovery.ts for the catalogue). */
export interface SeoWebSubHub { url: string; status?: number; ok: boolean }
export interface SeoWebSubState { at: string; ok: boolean; feedHash: string; hubs: SeoWebSubHub[] }
export interface SeoCrawlCheck { url: string; status?: number; ok: boolean; reason: string }
export interface SeoCrawlState { at: string; ua: string; checked: number; ok: number; results: SeoCrawlCheck[] }
export interface SeoPageSpeedState {
  at: string; ok: boolean; url: string; status?: number;
  scores: { performance?: number; seo?: number; accessibility?: number; bestPractices?: number };
  vitals?: { lcpMs?: number; cls?: number; tbtMs?: number };
  detail: string;
}
export interface SeoDiscoveryState { webSub?: SeoWebSubState; crawl?: SeoCrawlState; pageSpeed?: SeoPageSpeedState }

export interface SeoTrustState {
  level: SeoTrustLevel;
  since: string;
  cycles: number;
  cyclesAtLevel: number;
  noteAr: string;
}
export interface SeoState {
  version: 1;
  updatedAt: string;
  nextRunAt: string;
  intervalHours: number;
  identity: { nameAr: string; nameEn: string; roleAr: string; reportsToAr: string; bornAt: string };
  trust: SeoTrustState;
  curriculum: { studied: string[]; notes: SeoLessonNote[]; completedAt?: string };
  audit: SeoAuditSnapshot;
  history: { at: string; score: number; applied: number; shaheen?: number; level: SeoTrustLevel }[];
  applied: SeoAppliedChange[];
  proposals: Record<string, SeoPageCopy>;
  submissions: SeoSubmission[];
  submissionBook: { lastIndexNowAt?: string; urls: string[] };
  coach: SeoCoach | null;
  coachHistory: { at: string; score?: number; readyForAutonomy: boolean }[];
  mediaReport: SeoMediaReport | null;
  engines: { aiAvailable: boolean; lastEngine?: string; studies: number; failures: string[] };
  searchEngines: SeoEngineReport[];
  /** Account-free discovery evidence: last hub ping, crawler-access probe, performance report. */
  discovery: SeoDiscoveryState;
  nextActions: { textAr: string; area?: string; severity?: Severity }[];
  runs: SeoRun[];
  notes: string[];
}

export const SEO_INTERVAL_HOURS = 6;

export function emptySeoState(now = new Date()): SeoState {
  const at = now.toISOString();
  const next = new Date(now.getTime() + SEO_INTERVAL_HOURS * 3600_000).toISOString();
  return {
    version: 1,
    updatedAt: at,
    nextRunAt: next,
    intervalHours: SEO_INTERVAL_HOURS,
    identity: { nameAr: SEO_AGENT.nameAr, nameEn: SEO_AGENT.nameEn, roleAr: SEO_AGENT.roleAr, reportsToAr: SEO_AGENT.reportsToAr, bornAt: at },
    trust: { level: 'trainee', since: at, cycles: 0, cyclesAtLevel: 0, noteAr: 'بدأ التدريب: يدرس المنهج ويفحص الموقع ويقترح، بلا تغيير منشور.' },
    curriculum: { studied: [], notes: [] },
    audit: { at, score: 0, bySeverity: { critical: 0, major: 0, minor: 0 }, byArea: {}, findings: [], pagesChecked: 0 },
    history: [],
    applied: [],
    proposals: {},
    submissions: [],
    submissionBook: { urls: [] },
    coach: null,
    coachHistory: [],
    mediaReport: null,
    engines: { aiAvailable: false, studies: 0, failures: [] },
    searchEngines: SEARCH_ENGINES.map((e) => ({ id: e.id, nameAr: e.nameAr, status: e.status })),
    discovery: {},
    nextActions: [],
    runs: [],
    notes: [],
  };
}

const isObject = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v));

const finite = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);
const shortText = (value: unknown, max = 240): string => (typeof value === 'string' ? value.slice(0, max) : '');

/** Only well-formed evidence survives a read; a corrupt discovery block must never break the cycle. */
function readDiscovery(value: unknown): SeoDiscoveryState {
  const out: SeoDiscoveryState = {};
  if (!isObject(value)) return out;
  if (isObject(value.webSub) && typeof value.webSub.at === 'string') {
    out.webSub = {
      at: shortText(value.webSub.at, 40),
      ok: Boolean(value.webSub.ok),
      feedHash: shortText(value.webSub.feedHash, 32),
      hubs: Array.isArray(value.webSub.hubs)
        ? value.webSub.hubs.filter(isObject).slice(0, 4).map((hub) => ({ url: shortText(hub.url, 200), ok: Boolean(hub.ok), status: finite(hub.status) }))
        : [],
    };
  }
  if (isObject(value.crawl) && typeof value.crawl.at === 'string') {
    const results = Array.isArray(value.crawl.results)
      ? value.crawl.results.filter(isObject).slice(0, 6).map((row) => ({
          url: shortText(row.url, 300), ok: Boolean(row.ok), status: finite(row.status), reason: shortText(row.reason, 200),
        }))
      : [];
    out.crawl = {
      at: shortText(value.crawl.at, 40), ua: shortText(value.crawl.ua, 160),
      checked: results.length, ok: results.filter((row) => row.ok).length, results,
    };
  }
  if (isObject(value.pageSpeed) && typeof value.pageSpeed.at === 'string') {
    const scoresRaw = isObject(value.pageSpeed.scores) ? value.pageSpeed.scores : {};
    const vitalsRaw = isObject(value.pageSpeed.vitals) ? value.pageSpeed.vitals : {};
    out.pageSpeed = {
      at: shortText(value.pageSpeed.at, 40), ok: Boolean(value.pageSpeed.ok), url: shortText(value.pageSpeed.url, 300),
      status: finite(value.pageSpeed.status), detail: shortText(value.pageSpeed.detail),
      scores: {
        performance: finite(scoresRaw.performance), seo: finite(scoresRaw.seo),
        accessibility: finite(scoresRaw.accessibility), bestPractices: finite(scoresRaw.bestPractices),
      },
      vitals: { lcpMs: finite(vitalsRaw.lcpMs), cls: finite(vitalsRaw.cls), tbtMs: finite(vitalsRaw.tbtMs) },
    };
  }
  return out;
}
/** Defensive reader for the live JSON (a corrupt file must never break the site or the admin). */
export function readSeoState(value: unknown, now = new Date()): SeoState {
  const empty = emptySeoState(now);
  if (!isObject(value)) return empty;
  const raw = value as Partial<SeoState>;
  const TRUST_LEVELS: SeoTrustLevel[] = ['trainee', 'guided', 'autonomous'];
  const trustRaw: Record<string, unknown> = isObject(raw.trust) ? raw.trust : {};
  const validEngine = (engine: unknown): engine is SeoEngineReport => isObject(engine)
    && typeof engine.id === 'string' && typeof engine.nameAr === 'string'
    && ['submitted', 'ready', 'owner'].includes(String(engine.status));
  const engines = Array.isArray(raw.searchEngines) ? raw.searchEngines.filter(validEngine) : [];
  return {
    ...empty,
    ...raw,
    version: 1,
    identity: { ...empty.identity, ...(isObject(raw.identity) ? raw.identity : {}) },
    trust: { ...empty.trust, ...trustRaw, level: TRUST_LEVELS.includes(trustRaw.level as SeoTrustLevel) ? trustRaw.level as SeoTrustLevel : empty.trust.level },
    curriculum: { ...empty.curriculum, ...(isObject(raw.curriculum) ? raw.curriculum : {}) },
    audit: { ...empty.audit, ...(isObject(raw.audit) ? raw.audit : {}) },
    engines: { ...empty.engines, ...(isObject(raw.engines) ? raw.engines : {}) },
    submissionBook: { ...empty.submissionBook, ...(isObject(raw.submissionBook) ? raw.submissionBook : {}) },
    applied: Array.isArray(raw.applied) ? raw.applied.filter(isObject) as unknown as SeoAppliedChange[] : [],
    proposals: isObject(raw.proposals) ? raw.proposals as unknown as SeoState['proposals'] : {},
    submissions: Array.isArray(raw.submissions) ? raw.submissions.filter(isObject) as unknown as SeoSubmission[] : [],
    coachHistory: Array.isArray(raw.coachHistory) ? raw.coachHistory.filter(isObject) as unknown as SeoState['coachHistory'] : [],
    history: Array.isArray(raw.history) ? raw.history.filter(isObject) as unknown as SeoState['history'] : [],
    runs: Array.isArray(raw.runs) ? raw.runs.filter(isObject) as unknown as SeoRun[] : [],
    searchEngines: engines.length ? engines : empty.searchEngines,
    discovery: readDiscovery(raw.discovery),
    nextActions: Array.isArray(raw.nextActions) ? raw.nextActions as SeoState['nextActions'] : [],
    notes: Array.isArray(raw.notes) ? raw.notes.filter((n): n is string => typeof n === 'string') : [],
  };
}

/** The build-time copy file: only validated, published entries are written here. */
export interface SeoPagesFile {
  version: 1;
  updatedAt: string;
  agent: string;
  trust: SeoTrustLevel;
  pages: Record<string, SeoPageCopy>;
  noteAr: string;
}
export function emptyPagesFile(now = new Date()): SeoPagesFile {
  return { version: 1, updatedAt: now.toISOString(), agent: SEO_AGENT.nameAr, trust: 'trainee', pages: {}, noteAr: 'لم يعتمد الوكيل أي نص بعد؛ الصفحات تستخدم نصوصها الأساسية.' };
}
export function readPagesFile(value: unknown): SeoPagesFile {
  const empty = emptyPagesFile();
  if (!isObject(value)) return empty;
  const pages: Record<string, SeoPageCopy> = {};
  if (isObject(value.pages)) {
    for (const [id, raw] of Object.entries(value.pages)) {
      if (!isObject(raw) || typeof raw.title !== 'string' || typeof raw.description !== 'string') continue;
      pages[id] = {
        title: raw.title, description: raw.description,
        h1: typeof raw.h1 === 'string' ? raw.h1 : undefined,
        faq: Array.isArray(raw.faq) ? raw.faq.filter((f): f is SeoFaq => isObject(f) && typeof f.q === 'string' && typeof f.a === 'string').slice(0, 5) : undefined,
        source: raw.source === 'ai' ? 'ai' : 'baseline',
        at: typeof raw.at === 'string' ? raw.at : new Date().toISOString(),
      };
    }
  }
  return { version: 1, updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : empty.updatedAt, agent: SEO_AGENT.nameAr, trust: value.trust === 'guided' || value.trust === 'autonomous' ? value.trust : 'trainee', pages, noteAr: typeof value.noteAr === 'string' ? value.noteAr : empty.noteAr };
}

/** The published copy file for this state. A trainee publishes nothing: proposals stay internal. */
export function publishedPages(state: SeoState, existing?: SeoPagesFile, now = new Date()): SeoPagesFile {
  const base = existing ? { ...existing, pages: { ...existing.pages } } : emptyPagesFile(now);
  if (state.trust.level === 'trainee') {
    return { ...base, updatedAt: now.toISOString(), trust: 'trainee', noteAr: 'الوكيل ما زال متدرباً: كل النصوص مقترحات داخلية ولا تُنشر حتى يصل إلى مرحلة «يعمل بتوجيه شاهين».' };
  }
  for (const [id, copy] of Object.entries(state.proposals)) {
    const problems = validateSeoCopy(copy, { requireFaq: false });
    if (problems.length) continue;
    base.pages[id] = { ...copy, source: 'ai', at: copy.at || now.toISOString() };
  }
  return {
    ...base,
    updatedAt: now.toISOString(),
    trust: state.trust.level,
    noteAr: state.trust.level === 'autonomous'
      ? 'نصوص اعتمدها منارة شاهين بعد فحص آلي، تحت مراجعة دورية من الخبير شاهين.'
      : 'نصوص اعتمدها منارة شاهين في مرحلة التوجيه بعد فحص آلي ومراجعة شاهين.',
  };
}

/** A safe override for the build: invalid or stale copy silently falls back to the baseline. */
export function copyOverride(file: SeoPagesFile | undefined, pageId: string): SeoPageCopy | undefined {
  const copy = file?.pages?.[pageId];
  if (!copy || file?.trust === 'trainee') return undefined;
  const problems = validateSeoCopy(copy, { maxDesc: 170 });
  if (problems.length) return undefined;
  return copy;
}

/** Record a validated copy proposal (and the change history when it is published). */
export function proposeCopy(state: SeoState, pageId: string, pagePath: string, copy: SeoPageCopy, before: { title: string; description: string }, reason: string, now = new Date()) {
  state.proposals[pageId] = copy;
  const at = now.toISOString();
  if (copy.title !== before.title) state.applied.push({ at, pageId, pagePath, field: 'title', before: before.title, after: copy.title, reason });
  if (copy.description !== before.description) state.applied.push({ at, pageId, pagePath, field: 'description', before: before.description, after: copy.description, reason });
  // Keep history bounded.
  if (state.applied.length > 300) state.applied = state.applied.slice(-300);
}

/** Undo the most recent published copy change (used when the score drops after it). */
export function rollbackLastApplied(state: SeoState, now = new Date()): SeoAppliedChange | undefined {
  const last = [...state.applied].reverse().find((c) => !c.reverted);
  if (!last) return undefined;
  last.reverted = true;
  const copy = state.proposals[last.pageId];
  if (copy) {
    if (last.field === 'title') copy.title = last.before;
    if (last.field === 'description') copy.description = last.before;
  }
  state.notes.push(`${now.toISOString()}: تراجع تلقائي عن «${last.field}» في ${last.pagePath} بعد هبوط التقييم.`);
  return last;
}

export interface TrustInput { coachScore?: number; readyForAutonomy?: boolean; now?: Date }
/** Graduation and demotion are explicit, logged, and never depend on the agent's own opinion alone. */
export function advanceTrust(state: SeoState, input: TrustInput = {}): { level: SeoTrustLevel; changed: boolean; noteAr: string } {
  const now = (input.now || new Date()).toISOString();
  const atLevel = state.trust.cyclesAtLevel;
  const studied = state.curriculum.studied.length;
  const score = state.audit.score;
  const coach = input.coachScore ?? 0;
  let level = state.trust.level;
  let note = state.trust.noteAr;
  if (level === 'trainee' && state.trust.cycles >= 4 && studied >= 6 && score >= 72 && coach >= 7) {
    level = 'guided';
    note = 'اجتاز التدريب الأولي: 6 دروس على الأقل، 4 دورات، تقييم فحص 72+ و7/10 من شاهين. يبدأ تطبيق التحسينات الآمنة.';
  } else if (level === 'guided' && atLevel >= 4 && studied >= 20 && score >= 85 && coach >= 8.5 && input.readyForAutonomy === true && state.history.length >= 4) {
    level = 'autonomous';
    note = 'اعتمد على نفسه: 20 درساً، 4 دورات بتوجيه، فحص 85+، 8.5/10 من شاهين، وسجل بلا انحدار.';
  } else if (level === 'autonomous' && coach > 0 && coach < 6) {
    level = 'guided';
    note = 'عودة إلى التوجيه: تقييم شاهين هبط عن 6/10 في هذه الدورة.';
  }
  if (level !== state.trust.level) {
    state.trust = { ...state.trust, level, since: now, cyclesAtLevel: 0, noteAr: note };
    state.notes.push(`${now}: ${level === 'guided' ? 'انتقل إلى مرحلة التوجيه' : level === 'autonomous' ? 'انتقل إلى الاعتماد على النفس' : 'عاد إلى التوجيه'} — ${note}`);
    return { level, changed: true, noteAr: note };
  }
  state.trust = { ...state.trust, cyclesAtLevel: atLevel + 1, noteAr: note };
  return { level, changed: false, noteAr: note };
}

/** Was the score drop after a published change big enough to revert it? */
export function regression(history: SeoState['history'], current: number, appliedCount: number): boolean {
  if (!appliedCount) return false;
  const prev = history.at(-1)?.score;
  return typeof prev === 'number' && current < prev - 8;
}

/** IndexNow is polite: at most once per 20 hours, and only real pages, never API routes. */
export function submissionPlan(state: SeoState, urls: { loc: string; lastmod?: string }[], now = new Date()): { urls: string[]; reason: string } {
  const last = state.submissionBook.lastIndexNowAt ? Date.parse(state.submissionBook.lastIndexNowAt) : 0;
  const known = new Set(state.submissionBook.urls);
  const fresh = urls.filter((u) => !known.has(u.loc)).map((u) => u.loc);
  if (now.getTime() - last < 20 * 3600_000 && fresh.length < 3) {
    return { urls: [], reason: 'آخر إرسال لأقل من 20 ساعة ولا توجد صفحات جديدة كافية — نحترم حدود المحركات.' };
  }
  const priority = urls.filter((u) => /\/$|\/tools\/|\/p\/[^/]+\.html$/.test(u.loc));
  return { urls: [...new Set([...fresh, ...priority.map((u) => u.loc)])].slice(0, 200), reason: fresh.length >= 3 ? 'صفحات جديدة منذ آخر إرسال + أهم الصفحات.' : 'إرسال دوري لأهم الصفحات عبر IndexNow.' };
}

export function recordRun(state: SeoState, run: SeoRun, now = new Date()) {
  state.runs = [...state.runs, run].slice(-60);
  state.updatedAt = now.toISOString();
  state.nextRunAt = new Date(now.getTime() + (state.intervalHours || SEO_INTERVAL_HOURS) * 3600_000).toISOString();
  state.history = [...state.history, { at: run.at, score: run.auditScore, applied: run.applied, shaheen: state.coach?.score, level: state.trust.level }].slice(-90);
}

/** Deterministic media report when no AI engine answers: still useful, never invented. */
export function localMediaReport(state: SeoState, now = new Date()): SeoMediaReport {
  const critical = state.audit.bySeverity.critical;
  const top = state.audit.findings.filter((f) => f.severity === 'critical' || f.severity === 'major').slice(0, 3);
  return {
    at: now.toISOString(),
    headline: `${SITE.nameAr}: أدوات تركيب العطور في متناول الجميع`,
    paragraphs: [
      `${SITE.nameAr} منصة عربية تجمع حاسبات تركيب العطور والهرم العطري والتعتيق والتكاليف في مكان واحد، إلى جانب موسوعة مواد خام ومكتبة عطور عالمية ومتجر عطور جاهزة.`,
      critical
        ? `أجرى «${SEO_AGENT.nameAr}» فحصاً فنياً حديثاً للموقع؛ المؤشر الحالي ${state.audit.score}/100 مع ${critical} ملاحظة حرجة قيد المعالجة. لا تُنشر الأرقام قبل إغلاقها.`
        : `أجرى «${SEO_AGENT.nameAr}» فحصاً فنياً حديثاً للموقع بمؤشر ${state.audit.score}/100، ويواصل تحسين العناوين والأوصاف وبيانات الصفحات.`,
      top.length ? `أولويات العمل الحالية: ${top.map((f) => f.title).join('، ')}.` : 'لا توجد أعطال ظاهرة في الأساسيات التقنية حالياً.',
    ],
    boilerplate: `${SITE.nameAr} — منصة عربية لتصميم العطور وتركيبها. المحتوى والتحسينات تحت إشراف «${SEO_AGENT.reportsToAr}».`,
    social: [
      `تعلّم تركيب عطرك خطوة بخطوة: حاسبة نسب دقيقة، هرم عطري، ودليل تعتيق — كل ذلك في ${SITE.nameAr}.`,
      `عطرك القادم يبدأ بحساب: زيت، كحول، ماء… ثم وقت للتعتيق. جرّب المعمل في ${SITE.nameAr}.`,
      `من فكرة إلى زجاجة: احسب التكلفة والربح قبل أن تخلط أول قطرة — ${SITE.nameAr}.`,
    ],
    ideas: [
      'دليل مصور: من اختيار النوتات إلى زجاجة جاهزة.',
      'كيف تحسب تكلفة عطر 50 مل قبل شراء الخامات؟',
    ],
    source: 'local',
  };
}

export function isSeoPagesFile(value: unknown): value is SeoPagesFile {
  return isObject(value) && value.version === 1 && isObject(value.pages);
}

/** Human summary for the panel and the job log. */
export function stateSummary(state: SeoState): string {
  const t = state.trust;
  return `${t.level} · فحص ${state.audit.score}/100 · ${state.curriculum.studied.length} درساً · ${state.applied.filter((a) => !a.reverted).length} تحسيناً منشوراً`;
}
