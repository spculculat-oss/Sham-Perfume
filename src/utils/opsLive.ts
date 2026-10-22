/**
 * «مين شغال دلوقتي» — the live layer of the operations map: which bot is running right now, which one is stopped
 * (and why), which one waits for its turn (and when), and which scenario (journey) is moving through the tools.
 *
 * Pure and browser-safe. The admin map (src/admin/ShaheenOpsMapPanel.tsx) feeds it the latest GitHub Actions runs of
 * the public repository (read without any key) and falls back to the pre-meeting check for bots whose last run is
 * older than the live list. Schedules are copied from .github/workflows/*.yml — tests/opsLive.test.ts fails when they
 * drift apart.
 */
import { BOTS, botOf, type Bot, type BotId } from './shaheenOrg';
import { JOURNEYS, type Journey } from './opsMap';
import type { OwnerControls } from './ownerAuthority';
import type { StateOrders } from './platformState';

// ── Schedules (UTC cron, exactly as in the workflow files) and the other triggers ───────────────────────────
export const SCHEDULES: Record<string, string[]> = {
  'aistudio-bridge.yml': ['7,37 * * * *'],
  'live-smoke.yml': ['0 6 * * *'],
  'platform-state.yml': ['27 * * * *'],
  'product-pages-check.yml': ['50 5 * * *'],
  'shaheen-council.yml': ['15 8 * * *'],
  'shaheen-discover.yml': ['17 */6 * * *'],
  'shaheen-doctor.yml': ['*/10 * * * *'],
  'shaheen-finance.yml': ['15 3 * * *'],
  'shaheen-import.yml': ['37 */2 * * *'],
  'shaheen-languages.yml': ['11 9 * * *', '11 21 * * *'],
  'shaheen-manus.yml': ['0 7 * * *', '15 5 * * 3,6', '30 9 * * 1,4'],
  'shaheen-news.yml': ['7 3,15 * * *'],
  'shaheen-patrol.yml': ['52 * * * *'],
  'shaheen-precheck.yml': ['10 6 * * *'],
  'shaheen-school-clock.yml': ['47 * * * *'],
  'shaheen-seo.yml': ['23 */6 * * *'],
};
/** What starts a workflow that has no timetable (or also starts it besides the timetable). */
export const TRIGGERS_AR: Record<string, string> = {
  'pages.yml': 'بيشتغل مع كل تحديث للموقع',
  'aistudio-intake.yml': 'بيشتغل بعد كل نشر للموقع',
  'product-pages-check.yml': 'وكمان بعد كل نشر للموقع',
  'aistudio-zip.yml': 'بيشتغل لما يوصل ملف من الاستوديو',
  'shaheen-inspect.yml': 'بيشتغل لما حد يطلبه',
  'shaheen-keys.yml': 'بيشتغل مع كل تحديث للموقع',
  'shaheen-manus.yml': 'وكمان بعد الفحص الشامل',
  'owner-control.yml': 'بيشتغل لما صاحب الموقع يدّي أمر من حسابه، أو يوافق على تعديل من غرفة شاهين',
};

const field = (spec: string, min: number, max: number): Set<number> => {
  const out = new Set<number>();
  for (const part of spec.split(',')) {
    const [range, stepRaw] = part.split('/');
    const step = stepRaw ? Number(stepRaw) : 1;
    const [a, b] = range === '*' ? [min, max] : range.includes('-') ? range.split('-').map(Number) : [Number(range), stepRaw ? max : Number(range)];
    for (let v = a; v <= b; v += step) out.add(v);
  }
  return out;
};
/** The next time (after `now`) a UTC cron expression fires — minute, hour, day of month, month, day of week. */
export function nextCron(cron: string, now: number): number {
  const [mi, ho, dom, mon, dow] = cron.trim().split(/\s+/);
  const M = field(mi, 0, 59); const H = field(ho, 0, 23); const D = field(dom, 1, 31); const MO = field(mon, 1, 12); const W = field(dow, 0, 6);
  let t = Math.floor(now / 60_000) * 60_000 + 60_000;
  for (let i = 0; i < 60 * 24 * 8; i++, t += 60_000) {
    const d = new Date(t);
    if (M.has(d.getUTCMinutes()) && H.has(d.getUTCHours()) && D.has(d.getUTCDate()) && MO.has(d.getUTCMonth() + 1) && W.has(d.getUTCDay())) return t;
  }
  return NaN;
}
export const nextRunOf = (workflow: string | undefined, now: number): number | undefined => {
  const times = (workflow && SCHEDULES[workflow] || []).map((c) => nextCron(c, now)).filter(Number.isFinite);
  return times.length ? Math.min(...times) : undefined;
};

// ── Live runs ────────────────────────────────────────────────────────────────────────────────────────────────
/** The fields used from GitHub's «list workflow runs» answer. */
export interface GhRun {
  id: number; name?: string; path: string; event: string; status: string; conclusion: string | null;
  created_at: string; updated_at: string; run_started_at?: string; html_url: string; head_branch?: string; display_title?: string;
}
export interface GhJob { name: string; status: string; conclusion: string | null; steps?: { name: string; status: string; conclusion: string | null; number: number }[] }
export interface GhWorkflow { path: string; state: string }

export const ACTIVE = new Set(['in_progress', 'queued', 'waiting', 'requested', 'pending']);
const fileOf = (path: string) => path.split('/').pop()?.replace(/@.*$/, '') || path;

/** The newest run of every workflow on main (the list comes newest first). */
export function latestByWorkflow(runs: GhRun[]): Record<string, GhRun> {
  const out: Record<string, GhRun> = {};
  for (const r of runs) {
    if (r.head_branch && r.head_branch !== 'main') continue;
    const f = fileOf(r.path);
    if (!out[f]) out[f] = r;
  }
  return out;
}
/** The newest finished run of every workflow (skipped runs did no work and say nothing). */
export function lastFinishedByWorkflow(runs: GhRun[]): Record<string, GhRun> {
  const out: Record<string, GhRun> = {};
  for (const r of runs) {
    if ((r.head_branch && r.head_branch !== 'main') || r.status !== 'completed' || r.conclusion === 'skipped') continue;
    const f = fileOf(r.path);
    if (!out[f]) out[f] = r;
  }
  return out;
}

export const EVENT_AR: Record<string, string> = {
  schedule: 'في ميعاده', push: 'بعد تحديث للموقع', workflow_run: 'بعد ما أداة تانية خلصت', workflow_dispatch: 'تشغيل يدوي',
  pull_request: 'لمراجعة تعديل جديد', repository_dispatch: 'بطلب من أداة تانية',
};

/** «الخطوة الحالية»: the running step of a running job (number of steps done / all). */
export function currentStep(jobs: GhJob[]): { job: string; step?: string; done: number; total: number } | undefined {
  const job = jobs.find((j) => j.status === 'in_progress') || jobs.find((j) => ACTIVE.has(j.status));
  if (!job) return undefined;
  const steps = job.steps || [];
  const now = steps.find((s) => s.status === 'in_progress') || steps.find((s) => s.status !== 'completed');
  return { job: job.name, step: now?.name, done: steps.filter((s) => s.status === 'completed').length, total: steps.length };
}

// ── Each bot's live state ─────────────────────────────────────────────────────────────────────────────────────
/** `paused`: stopped on purpose — by the owner, by «دولة المنصة», or by the emergency brake (not a fault). */
export type LiveState = 'running' | 'queued' | 'paused' | 'stopped' | 'waiting' | 'ondemand' | 'unknown';
export type PausedBy = 'owner' | 'state' | 'frozen';
export interface BotLive {
  id: BotId;
  state: LiveState;
  /** One plain-Arabic line: what it does now / why it stopped / when it runs next. */
  noteAr: string;
  since?: string;
  next?: string;
  run?: { id: number; url: string; event: string; startedAt: string };
  pausedBy?: PausedBy;
}
/** What the pre-meeting check last saw (fallback for bots whose last run is older than the live list). */
export interface FallbackRun { conclusion: string | null; status: string; at: string; url?: string }

const ON_DEMAND_AR: Partial<Record<BotId, string>> = {
  chat: 'بيشتغل لما زائر يسأل شاهين', store_advisor: 'بيشتغل لما زائر يطلب ترشيح', legal: 'قراراته سارية طول الوقت',
  contracts: 'بيشتغل لما حد من الفريق يجهز رسالة تعاون', admin_agent: 'بيشتغل لما الإدارة تطلب', design_expert: 'بيشتغل مع مراجعات التصميم',
};
const hours = (iso: string, now: number) => (now - Date.parse(iso)) / 3_600_000;

export function botLive(bot: Bot, input: { latest: Record<string, GhRun>; finished: Record<string, GhRun>; workflows?: GhWorkflow[]; fallback?: FallbackRun; now: number; pausedBy?: PausedBy }): BotLive {
  const { now } = input;
  const wf = bot.workflow;
  if (!wf) return { id: bot.id, state: 'ondemand', noteAr: ON_DEMAND_AR[bot.id] || 'بيشتغل عند الطلب' };
  const nextAt = nextRunOf(wf, now);
  const next = nextAt ? new Date(nextAt).toISOString() : undefined;
  const disabled = input.workflows?.find((w) => fileOf(w.path) === wf && w.state !== 'active');
  if (disabled) return { id: bot.id, state: 'stopped', noteAr: 'متوقفة: التشغيل الآلي بتاعها اتقفل', next: undefined };

  const live = input.latest[wf];
  if (live && ACTIVE.has(live.status)) {
    const startedAt = live.run_started_at || live.created_at;
    return {
      id: bot.id, state: live.status === 'in_progress' ? 'running' : 'queued', since: startedAt, next,
      noteAr: live.status === 'in_progress' ? `شغالة دلوقتي (${EVENT_AR[live.event] || live.event})` : 'في الطابور، هتبدأ حالاً',
      run: { id: live.id, url: live.html_url, event: live.event, startedAt },
    };
  }
  // Paused on purpose: its gate stops it before any work (a run already going finishes first, shown above).
  if (input.pausedBy) {
    return { id: bot.id, state: 'paused', pausedBy: input.pausedBy, noteAr: PAUSED_AR[input.pausedBy] };
  }
  const done = input.finished[wf];
  const last: FallbackRun | undefined = done ? { conclusion: done.conclusion, status: done.status, at: done.updated_at, url: done.html_url }
    : input.fallback?.status === 'completed' && input.fallback.conclusion !== 'skipped' ? input.fallback : undefined;
  const trigger = TRIGGERS_AR[wf];
  if (!last) return { id: bot.id, state: 'unknown', noteAr: next ? 'لسه ماشتغلتش — أول دور ليها في ميعادها' : trigger || 'لسه ماشتغلتش', next };
  if (last.conclusion === 'failure' || last.conclusion === 'timed_out' || last.conclusion === 'cancelled' || last.conclusion === 'startup_failure') {
    const why = last.conclusion === 'timed_out' ? 'خلص وقتها قبل ما تكمل' : last.conclusion === 'cancelled' ? 'آخر تشغيل اتلغى' : 'آخر تشغيل فشل';
    return { id: bot.id, state: 'stopped', since: last.at, next, noteAr: `واقفة: ${why}${next ? ' — هتحاول تاني في ميعادها' : ''}` };
  }
  if (bot.everyHours && SCHEDULES[wf] && hours(last.at, now) > bot.everyHours * 2) {
    return { id: bot.id, state: 'stopped', since: last.at, next, noteAr: `واقفة: متأخرة (آخر تشغيل من ${Math.round(hours(last.at, now))} ساعة)` };
  }
  return { id: bot.id, state: 'waiting', since: last.at, next, noteAr: next ? 'خلصت شغلها بنجاح ومستنية دورها' : `خلصت شغلها بنجاح — ${trigger || 'بتشتغل عند الطلب'}` };
}

export const PAUSED_AR: Record<PausedBy, string> = {
  owner: 'موقوف بأمر صاحب الموقع', state: 'موقوف بأمر دولة المنصة', frozen: 'موقوف: فرامل الطوارئ شغالة (كل الروبوتات واقفة)',
};
/** Who stopped a bot on purpose: its workflow's gate stops it when any robot sharing that workflow is paused. */
export function pausedByOf(bot: Bot, controls?: OwnerControls, stateOrders?: StateOrders): PausedBy | undefined {
  if (!bot.workflow) return undefined;
  if (controls?.frozen) return 'frozen';
  const together = BOTS.filter((b) => b.workflow === bot.workflow).map((b) => b.id as string);
  if (controls && together.some((id) => controls.paused.includes(id as BotId))) return 'owner';
  if (stateOrders && together.some((id) => stateOrders.paused.includes(id))) return 'state';
  return undefined;
}

export function allLive(input: { runs: GhRun[]; workflows?: GhWorkflow[]; fallback?: Partial<Record<BotId, FallbackRun>>; now: number; controls?: OwnerControls; stateOrders?: StateOrders }): BotLive[] {
  const latest = latestByWorkflow(input.runs); const finished = lastFinishedByWorkflow(input.runs);
  return BOTS.map((b) => botLive(b, { latest, finished, workflows: input.workflows, fallback: input.fallback?.[b.id], now: input.now, pausedBy: pausedByOf(b, input.controls, input.stateOrders) }));
}

// ── «بيعمل إيه دلوقتي» in plain Arabic ───────────────────────────────────────────────────────────────────────
/** A workflow step's name (English, from the workflow file) as a short Arabic phrase; undefined when unknown. */
const STEP_AR: [RegExp, string][] = [
  [/^set up job$/i, 'بيبدأ ويجهّز نفسه'],
  [/^(post |complete job)/i, 'بيخلّص ويقفل'],
  [/owner'?s switch|may this robot run|gate/i, 'بيسأل مفتاح صاحب الموقع ودولة المنصة'],
  [/checkout|check out|read the owner/i, 'بيجيب آخر نسخة من الموقع'],
  [/set ?up (node|pinned bun|bun)|node\.js|setup-node|setup-bun/i, 'بيجهّز أدوات التشغيل'],
  [/install|dependencies/i, 'بيجهّز المكتبات'],
  [/cache/i, 'بيجهّز الملفات المحفوظة'],
  [/lint|type ?check/i, 'بيراجع الكود'],
  [/\btests?\b|smoke|check/i, 'بيفحص ويختبر'],
  [/build/i, 'بيبني الموقع'],
  [/deploy|pages/i, 'بينشر الموقع'],
  [/publish|save|commit|push/i, 'بيحفظ نتيجة شغله على الموقع'],
  [/upload|artifact/i, 'بيرفع الملفات'],
  [/vote|decide/i, 'الأعضاء بيصوّتوا وبيقرروا'],
  [/import|scout|discover|fetch|collect|bring/i, 'بيجمع البيانات'],
  [/translat|languag/i, 'بيترجم'],
  [/news|lesson/i, 'بيجهّز الأخبار والدروس'],
  [/review|inspect|patrol|audit/i, 'بيراجع ويفحص'],
  [/report|summary|meeting|minutes/i, 'بيكتب التقرير'],
];
export function stepAr(step?: string): string | undefined {
  if (!step) return undefined;
  return STEP_AR.find(([re]) => re.test(step))?.[1];
}
/** The bot's job in one short line (the first clause of its duties). */
export function dutyShort(bot: Bot, max = 110): string {
  const first = bot.dutiesAr.split(/[؛.]\s/)[0].trim();
  return first.length > max ? `${first.slice(0, max - 1).trimEnd()}…` : first;
}

// ── What happened lately ─────────────────────────────────────────────────────────────────────────────────────
export type FeedKind = 'running' | 'queued' | 'success' | 'failed' | 'cancelled';
export interface FeedItem { id: number; at: string; workflow: string; bots: BotId[]; kind: FeedKind; event: string; url: string }
/** The latest runs on main as a log, newest first: who started, who finished well, who failed (skipped runs did nothing). */
export function activityFeed(runs: GhRun[], limit = 15): FeedItem[] {
  const out: FeedItem[] = [];
  for (const r of [...runs].sort((a, b) => b.updated_at.localeCompare(a.updated_at))) {
    if ((r.head_branch && r.head_branch !== 'main') || r.conclusion === 'skipped') continue;
    const workflow = fileOf(r.path);
    const kind: FeedKind = r.status === 'in_progress' ? 'running' : ACTIVE.has(r.status) ? 'queued'
      : r.conclusion === 'success' || r.conclusion === 'neutral' ? 'success' : r.conclusion === 'cancelled' ? 'cancelled' : 'failed';
    out.push({ id: r.id, at: kind === 'running' || kind === 'queued' ? r.run_started_at || r.created_at : r.updated_at, workflow, bots: BOTS.filter((b) => b.workflow === workflow).map((b) => b.id), kind, event: r.event, url: r.html_url });
    if (out.length >= limit) break;
  }
  return out;
}

// ── The scenario moving right now ───────────────────────────────────────────────────────────────────────────
export interface LiveScenario { journey: Journey; step: number; bot: BotId }
/** Every journey with a running step (the first running step of each), the most advanced first. */
export function liveScenarios(live: BotLive[]): LiveScenario[] {
  const running = new Set(live.filter((l) => l.state === 'running' || l.state === 'queued').map((l) => l.id));
  const out: LiveScenario[] = [];
  for (const j of JOURNEYS) {
    const i = j.steps.findIndex((s) => running.has(s.bot));
    if (i >= 0) out.push({ journey: j, step: i, bot: j.steps[i].bot });
  }
  return out.sort((a, b) => b.step - a.step);
}

export const LIVE_ORDER: LiveState[] = ['running', 'queued', 'stopped', 'paused', 'waiting', 'unknown', 'ondemand'];
export const liveName = (id: BotId) => botOf(id)?.nameAr || id;
