/**
 * Shaheen's background agent (Manus) — its missions besides the languages & design audit (audit.ts):
 *   - «جولة الزائر وتحضير الاجتماع» (tour, daily right after the pre-meeting check, before the 08:15 UTC
 *     meeting): the live site on a phone as a shopper would use it — home → store → a product → the cart → the
 *     checkout page (never paying) → one question to Shaheen — then the visible problems the check found are
 *     looked at on the live site, and «المستشار الميداني» writes his opinion and proposals for the meeting
 *     (a sixth seat at the council table, scripts/shaheen-council/council.ts);
 *   - «المراجع الخارجي» (verify, Mondays and Thursdays after the meeting): the council's development tasks
 *     marked done this week, checked on the live site — fixed or not (a task still broken goes back to the meeting).
 * Every mission spends Manus credits: a monthly budget (MANUS_MONTHLY_CREDITS) is shared by all of them, and the
 * daily tour gives way first. Pure functions: tests/shaheenManus.test.ts. Visitors never see any of it.
 */
import { AREAS, SEVERITIES, SITE_URL, type AuditIssue } from './audit';
import { RERUNNABLE, type Area, type Priority } from '../shaheen-council/council';

export type Mission = 'design' | 'tour' | 'verify';
export const MISSIONS: Mission[] = ['design', 'tour', 'verify'];

/**
 * Which mission a schedule (or a manual choice) runs. Push events only rehearse (no task, no credits).
 * The daily tour starts when the scheduled pre-meeting check finishes (workflow_run); 07:00 is its fallback.
 */
export const SCHEDULES: Record<string, Mission> = { '0 7 * * *': 'tour', '15 5 * * 3,6': 'design', '30 9 * * 1,4': 'verify' };
export function missionFor(schedule?: string, input?: string): Mission | undefined {
  if (input && MISSIONS.includes(input as Mission)) return input as Mission;
  return schedule ? SCHEDULES[schedule.trim()] : undefined;
}

// ── Budget ────────────────────────────────────────────────────────────────────────────────────────────────
export interface MissionRun { at: string; mission: Mission; status: 'done' | 'running' | 'failed' | 'skipped'; credits?: number; note?: string }
export const monthOf = (iso: string) => iso.slice(0, 7);
export const creditsThisMonth = (runs: MissionRun[], now: string) =>
  runs.filter((r) => monthOf(r.at) === monthOf(now)).reduce((sum, r) => sum + (Number(r.credits) || 0), 0);

/** The tour stops at 70% of the monthly budget so the design audit and the reviewer keep their share. */
export function budgetAllows(mission: Mission, used: number, budget: number): { ok: boolean; why?: string } {
  if (!(budget > 0)) return { ok: true };
  const limit = mission === 'tour' ? budget * 0.7 : budget;
  return used < limit ? { ok: true } : { ok: false, why: `${used}/${budget} credits used this month${mission === 'tour' ? ' (the tour stops at 70%)' : ''}` };
}

/** Once a day per mission: a run done (or still running at Manus) today is not started again. */
export const ranToday = (runs: MissionRun[], mission: Mission, now: string) =>
  runs.some((r) => r.mission === mission && r.at.slice(0, 10) === now.slice(0, 10) && (r.status === 'done' || r.status === 'running'));

// ── «جولة الزائر» ─────────────────────────────────────────────────────────────────────────────────────────
export const STEPS = ['home', 'store', 'product', 'cart', 'checkout', 'shaheen'] as const;
export type Step = (typeof STEPS)[number];
export const STEP_AR: Record<Step, string> = { home: 'الصفحة الرئيسية', store: 'المتجر', product: 'صفحة منتج', cart: 'السلة', checkout: 'صفحة الدفع', shaheen: 'شات شاهين' };

const MEETING_AREAS: Area[] = ['ai-tools', 'store', 'content', 'experience', 'reliability'];
const PRIORITIES: Priority[] = ['high', 'medium', 'low'];
const ISSUE_ITEM = {
  type: 'object',
  properties: {
    area: { type: 'string', enum: [...AREAS] },
    severity: { type: 'string', enum: [...SEVERITIES] },
    language: { type: 'string', description: 'Language code where it appears, or "all".' },
    page: { type: 'string', description: 'Where: section/page name or URL hash.' },
    problem: { type: 'string', description: 'What is wrong, in Arabic.' },
    fix: { type: 'string', description: 'The fix to apply, in Arabic.' },
  },
  required: ['area', 'severity', 'language', 'page', 'problem', 'fix'],
  additionalProperties: false,
};
export const TOUR_SCHEMA = {
  type: 'object',
  properties: {
    summaryAr: { type: 'string', description: 'Two sentences in Arabic: how the shopping journey went.' },
    score: { type: 'integer', description: '0-100: how smoothly a shopper can find, choose and reach payment.' },
    journey: {
      type: 'array',
      description: 'One entry per step, in order.',
      items: {
        type: 'object',
        properties: {
          step: { type: 'string', enum: [...STEPS] },
          ok: { type: 'boolean', description: 'true when the step worked as a shopper expects.' },
          seconds: { type: 'integer', description: 'About how long the step took to load/respond.' },
          noteAr: { type: 'string', description: 'What happened, in Arabic (quote visible text when useful).' },
        },
        required: ['step', 'ok', 'seconds', 'noteAr'],
        additionalProperties: false,
      },
    },
    issues: { type: 'array', description: 'Concrete problems, most important first (at most 15).', items: ISSUE_ITEM },
    advisor: {
      type: 'object',
      description: 'Part 2: your opinion and proposals for today\'s development meeting.',
      properties: {
        opinionAr: { type: 'string', description: '120-220 words in Arabic: what you saw on the live site today and what matters most.' },
        proposals: {
          type: 'array',
          description: '2-5 proposals for the meeting, most important first.',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Short title in Arabic.' },
              detail: { type: 'string', description: 'What to change, where, and why (what you saw), in Arabic.' },
              area: { type: 'string', enum: [...MEETING_AREAS] },
              priority: { type: 'string', enum: [...PRIORITIES] },
              rerun: { type: 'string', enum: ['none', ...RERUNNABLE], description: 'A robot to run again now, or "none".' },
            },
            required: ['title', 'detail', 'area', 'priority', 'rerun'],
            additionalProperties: false,
          },
        },
      },
      required: ['opinionAr', 'proposals'],
      additionalProperties: false,
    },
  },
  required: ['summaryAr', 'score', 'journey', 'issues', 'advisor'],
  additionalProperties: false,
};

/** What the meeting already knows: this morning's pre-meeting check, the open tasks, the binding legal decisions. */
export interface MeetingContext { problems: string[]; openTasks: string[]; legal: string[] }

export function tourPrompt(previous?: TourResult, ctx: MeetingContext = { problems: [], openTasks: [], legal: [] }): string {
  const open = previous?.issues.filter((i) => i.severity !== 'low').slice(0, 6).map((i) => `- ${i.page}: ${i.problem}`) || [];
  return [
    'PART 1 — the shopper journey.',
    `You are a shopper testing "Sham Perfume" (${SITE_URL}) on a PHONE (about 390px wide), in Arabic.`,
    'Do this journey in order and report each step (home, store, product, cart, checkout, shaheen):',
    '1. home: open the site, wait for it to load, look at the top of the page.',
    '2. store: open the store, use the search or a filter (e.g. men / a brand).',
    '3. product: open one product page: name, price, photos, notes, the order button.',
    '4. cart: add the product to the cart and open the cart: price, quantity, total.',
    '5. checkout: go to the checkout/payment page and STOP there — never pay, never type card details, never submit an order or a form.',
    '6. shaheen: open the expert chat and send ONE short perfume question (e.g. "عطر عود للصيف؟"); report if an answer came and how long it took.',
    'Report broken images, wrong or missing prices, buttons that do nothing, text cut off, slow steps (over 5 s), and error messages.',
    'Rules: do not buy, do not create accounts, do not fill forms, send at most one chat message. Write summaryAr, noteAr, problem and fix in Arabic.',
    open.length ? `Yesterday these problems were found; say if each one is still there:\n${open.join('\n')}` : '',
    '',
    'PART 2 — you are «المستشار الميداني» (the field advisor) in today\'s development meeting of the site team.',
    'The other members only read reports; you are the one who really opened the site. Fill "advisor":',
    'look on the live site at the visitor-visible problems below, then write opinionAr and 2-5 proposals (what to fix or improve first, and why — from what you saw).',
    ctx.problems.length ? `This morning's automatic check of the site's robots found:\n${ctx.problems.slice(0, 12).map((x) => `- ${x}`).join('\n')}` : 'This morning\'s automatic check found no problems.',
    ctx.openTasks.length ? `Already open development tasks (do not propose them again):\n${ctx.openTasks.slice(0, 12).map((x) => `- ${x}`).join('\n')}` : '',
    'Fixed rules — never propose against them: prices are the product price + 50% + shipping; visitors never see the names of AI companies; no keys or secrets in the code.',
    ctx.legal.length ? `Binding decisions of the legal manager (never propose bypassing them):\n${ctx.legal.map((x) => `- ${x}`).join('\n')}` : '',
  ].filter(Boolean).join('\n');
}

export interface Proposal { title: string; detail: string; area: Area; priority: Priority; rerun?: (typeof RERUNNABLE)[number] }
export interface Advisor { opinionAr: string; proposals: Proposal[] }
/** No AI company names, no links, nothing against the legal manager's product-import pause (L-03). */
const VENDOR = /gemini|gpt|openai|chatgpt|claude|anthropic|deepseek|openrouter|perplexity|manus|llama|mistral|qwen|grok|جيميني|كلود|ديب ?سيك|مانوس/i;
const AGAINST_LEGAL = /scrap|crawl|SHAM_ALLOW_SCRAPE|(?:سحب|نقل|استيراد|استئناف)\s+(?:ال)?منتجات|إذن المورد/i;
export function cleanAdvisor(raw: unknown): Advisor | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const opinionAr = clip(r.opinionAr, 1800).replace(/https?:\/\/\S+/g, '');
  const proposals = (Array.isArray(r.proposals) ? r.proposals : []).flatMap((x): Proposal[] => {
    if (!x || typeof x !== 'object') return [];
    const p = x as Record<string, unknown>;
    const title = clip(p.title, 120); const detail = clip(p.detail, 900);
    if (title.length < 4 || VENDOR.test(`${title} ${detail}`) || AGAINST_LEGAL.test(`${title} ${detail}`)) return [];
    const rerun = RERUNNABLE.find((w) => w === p.rerun);
    return [{ title, detail, area: MEETING_AREAS.includes(p.area as Area) ? p.area as Area : 'experience', priority: PRIORITIES.includes(p.priority as Priority) ? p.priority as Priority : 'medium', ...(rerun ? { rerun } : {}) }];
  }).slice(0, 5);
  if (opinionAr.length < 40 && !proposals.length) return undefined;
  return { opinionAr: VENDOR.test(opinionAr) ? opinionAr.replace(new RegExp(VENDOR.source, 'gi'), '—') : opinionAr, proposals };
}

export interface TourStep { step: Step; ok: boolean; seconds: number; noteAr: string }
export interface TourResult { at: string; summaryAr: string; score: number; journey: TourStep[]; issues: AuditIssue[]; advisor?: Advisor; taskId?: string; credits?: number }

const clip = (v: unknown, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
function cleanIssues(raw: unknown, max: number): AuditIssue[] {
  return (Array.isArray(raw) ? raw : []).flatMap((x): AuditIssue[] => {
    if (!x || typeof x !== 'object') return [];
    const i = x as Record<string, unknown>;
    const problem = clip(i.problem, 400);
    if (!problem) return [];
    return [{
      area: AREAS.includes(i.area as AuditIssue['area']) ? (i.area as AuditIssue['area']) : 'store',
      severity: SEVERITIES.includes(i.severity as AuditIssue['severity']) ? (i.severity as AuditIssue['severity']) : 'low',
      language: clip(i.language, 12) || 'ar', page: clip(i.page, 120), problem, fix: clip(i.fix, 400),
    }];
  }).slice(0, max);
}

/** The agent's output is data, never trusted as-is: known steps only, trimmed text, bounded numbers. */
export function cleanTour(raw: unknown, at: string): TourResult | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const journey = (Array.isArray(r.journey) ? r.journey : []).flatMap((x): TourStep[] => {
    if (!x || typeof x !== 'object') return [];
    const s = x as Record<string, unknown>;
    if (!STEPS.includes(s.step as Step)) return [];
    return [{ step: s.step as Step, ok: s.ok === true, seconds: Math.max(0, Math.min(600, Math.round(Number(s.seconds) || 0))), noteAr: clip(s.noteAr, 300) }];
  }).filter((s, i, all) => all.findIndex((y) => y.step === s.step) === i);
  const summaryAr = clip(r.summaryAr, 500);
  if (!summaryAr && !journey.length) return undefined;
  const advisor = cleanAdvisor(r.advisor);
  return { at, summaryAr, score: Math.max(0, Math.min(100, Math.round(Number(r.score) || 0))), journey, issues: cleanIssues(r.issues, 15), ...(advisor ? { advisor } : {}) };
}

// ── «المراجع الخارجي» ─────────────────────────────────────────────────────────────────────────────────────
export interface DoneTask { id: string; title: string; detail: string; closedAt?: string; url?: string }
/** The council tasks closed as done in the last `days` days and not verified yet. */
export function tasksToVerify(tasks: { id: string; title: string; detail: string; status: string; closedAt?: string; url?: string }[], verified: string[], now: number, days = 7, max = 5): DoneTask[] {
  return tasks.filter((t) => t.status === 'done' && !verified.includes(t.id) && Date.parse(t.closedAt || '') > now - days * 86_400_000)
    .slice(0, max).map(({ id, title, detail, closedAt, url }) => ({ id, title, detail, closedAt, url }));
}

export const VERDICTS = ['fixed', 'not_fixed', 'cannot_tell'] as const;
export type Verdict = (typeof VERDICTS)[number];
export const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    summaryAr: { type: 'string', description: 'One or two sentences in Arabic.' },
    checks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The task id exactly as given.' },
          verdict: { type: 'string', enum: [...VERDICTS] },
          evidenceAr: { type: 'string', description: 'What you saw on the live site, in Arabic.' },
        },
        required: ['id', 'verdict', 'evidenceAr'],
        additionalProperties: false,
      },
    },
  },
  required: ['summaryAr', 'checks'],
  additionalProperties: false,
};

export function verifyPrompt(tasks: DoneTask[]): string {
  return [
    `You are the external reviewer of "Sham Perfume" (${SITE_URL}). The development team says these tasks are DONE.`,
    'Check each one on the LIVE site (desktop and a ~390px phone) and give a verdict: fixed, not_fixed, or cannot_tell (when it cannot be seen from the site).',
    'Be strict and concrete: name the page and quote what you saw. Do not buy, do not create accounts, do not fill forms.',
    'Write summaryAr and evidenceAr in Arabic. Use each task id exactly as given.',
    '',
    ...tasks.map((t) => `### ${t.id}\n${t.title}\n${t.detail.slice(0, 700)}`),
  ].join('\n');
}

export interface VerifyCheck { id: string; title: string; verdict: Verdict; evidenceAr: string; url?: string }
export interface VerifyResult { at: string; summaryAr: string; checks: VerifyCheck[]; taskId?: string; credits?: number }
export function cleanVerify(raw: unknown, tasks: DoneTask[], at: string): VerifyResult | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const checks = (Array.isArray(r.checks) ? r.checks : []).flatMap((x): VerifyCheck[] => {
    if (!x || typeof x !== 'object') return [];
    const c = x as Record<string, unknown>;
    const task = tasks.find((t) => t.id === c.id);
    if (!task) return [];
    return [{ id: task.id, title: task.title, verdict: VERDICTS.includes(c.verdict as Verdict) ? (c.verdict as Verdict) : 'cannot_tell', evidenceAr: clip(c.evidenceAr, 400), url: task.url }];
  }).filter((c, i, all) => all.findIndex((y) => y.id === c.id) === i);
  if (!checks.length) return undefined;
  return { at, summaryAr: clip(r.summaryAr, 400), checks };
}

// ── The missions file (src/data/live/manus-missions.json) ─────────────────────────────────────────────────
export interface MissionsFile { version: 1; updatedAt: string; tour?: TourResult; verify?: VerifyResult; verified: string[]; runs: MissionRun[] }
export const emptyMissions = (): MissionsFile => ({ version: 1, updatedAt: '1970-01-01T00:00:00.000Z', verified: [], runs: [] });
export const isMissionsFile = (d: unknown): d is MissionsFile => Boolean(d && typeof d === 'object' && (d as MissionsFile).version === 1 && Array.isArray((d as MissionsFile).runs));

export function recordRun(file: MissionsFile, run: MissionRun, result?: { tour?: TourResult; verify?: VerifyResult }): MissionsFile {
  const next: MissionsFile = { ...file, updatedAt: run.at, runs: [run, ...file.runs].slice(0, 60) };
  if (result?.tour) next.tour = result.tour;
  if (result?.verify) {
    next.verify = result.verify;
    // A verdict is final for "fixed"; "not fixed" / "cannot tell" may be checked again after a new fix.
    next.verified = [...new Set([...file.verified, ...result.verify.checks.filter((c) => c.verdict === 'fixed').map((c) => c.id)])].slice(-200);
  }
  return next;
}
