/**
 * «خريطة تشغيل شام» — the interactive operations map and the tool evaluation (score out of 100) behind it.
 *
 * Pure and browser-safe: the map (src/admin/ShaheenOpsMapPanel.tsx, also at #ops on the Pages site) and the
 * pre-meeting check (scripts/shaheen-council/precheck.ts → failureCauseAr) both use it. Only real data counts:
 * a component without data is left out of the score, and a bot with no data at all is «بدون بيانات» — never a
 * guessed number.
 */
import { BOTS, DEPARTMENTS, LINKS, botOf, type BotId, type DeptId } from './shaheenOrg';
import type { BotCheck, PrecheckFile } from '../../scripts/shaheen-council/precheck';
import type { PatrolFile } from '../../scripts/shaheen-patrol/patrol';

// ── Why a run failed, in plain Arabic ─────────────────────────────────────────────────────────────────────
/** The failed workflow step → what it means for the store owner. First match wins. */
const STEP_CAUSES: [RegExp, string][] = [
  [/regression tests|run tests|npm (run )?test|bun (run )?test/i, 'اختبارات الجودة رفضت النتيجة قبل النشر (الحماية منعت نشر حاجة مكسورة)'],
  [/ask live questions/i, 'أسئلة حقيقية لشاهين على الموقع الحي مارجعش لها رد (محركات الذكاء مش متاحة)'],
  [/product pages|on a phone/i, 'فحص صفحات المنتجات على الموبايل لقى مشكلة'],
  [/finance audit/i, 'الفحص المالي الخاص ماكملش (إعدادات الخادم أو رمز الإدارة)'],
  [/install/i, 'تجهيز الأدوات فشل (تحميل المكتبات)'],
  [/build/i, 'بناء الموقع فشل'],
  [/deploy/i, 'رفع الموقع فشل'],
  [/publish|commit|push/i, 'حفظ النتيجة في المستودع فشل'],
];

/** The cause of a failed run: the step in plain Arabic, then the run's own error lines (already short). */
export function failureCauseAr(step: string | undefined, errors: string[] = []): string[] {
  const out: string[] = [];
  if (step) out.push(STEP_CAUSES.find(([re]) => re.test(step))?.[1] || `فشل في خطوة «${step}»`);
  for (const e of errors.slice(0, 3)) if (!out.includes(e)) out.push(e);
  return out;
}

// ── The score ─────────────────────────────────────────────────────────────────────────────────────────────
export type Grade = 'high' | 'good' | 'warn' | 'fail' | 'idle';
export interface ScorePart { key: 'run' | 'report' | 'quality' | 'own' | 'review'; points: number; weight: number; noteAr: string }
export interface ToolScore {
  id: BotId;
  /** 0–100, or null when there is no data at all. */
  score: number | null;
  grade: Grade;
  parts: ScorePart[];
  /** Plain-Arabic causes of every defect (most important first). */
  causes: string[];
  strengths: string[];
  /** Only the store owner can fix the main cause (keys, credit, a secret). */
  owner: boolean;
  lastRunAt?: string;
  lastRunOk?: boolean;
  runUrl?: string;
  reportAt?: string;
}

/** The supervisor's AI review (src/data/live/ai-supervisor.json). */
export interface SupervisorTool { nameAr?: string; score?: number; status?: string; judged?: boolean; checkedAt?: string; strengths?: string[]; issues?: string[] }
export interface SupervisorFile { updatedAt?: string; tools?: Record<string, SupervisorTool> }

export interface OpsInput { precheck?: PrecheckFile | null; patrol?: PatrolFile | null; supervisor?: SupervisorFile | null }

/** Weights of the parts (only parts with data are counted, then rescaled to 100). */
export const WEIGHTS: Record<ScorePart['key'], number> = { run: 35, report: 15, quality: 30, own: 10, review: 10 };
export const GRADE_AT = { high: 85, good: 70, warn: 50 } as const;
// «محركات الذكاء مش متاحة» is the live check's wording for exhausted packages/credit — the owner tops it up,
// no code change fixes it (it used to read like a site outage and become a development task).
const OWNER = /محركات متوقفة|محركات الذكاء مش متاحة|مفتاح|مفاتيح|شحن الرصيد|الفحص المالي|الإدارة المالية|رصيد/;
const isRunProblem = (p: string) => /آخر تشغيل|متأخر|ما كتبش/.test(p);
const clip = (s: string, n = 220) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export const gradeOf = (score: number | null): Grade =>
  score === null ? 'idle' : score >= GRADE_AT.high ? 'high' : score >= GRADE_AT.good ? 'good' : score >= GRADE_AT.warn ? 'warn' : 'fail';

/** One bot's score from the pre-meeting check, the patrol and the supervisor's review. */
export function scoreBot(id: BotId, input: OpsInput): ToolScore {
  const bot = botOf(id);
  const c: BotCheck | undefined = input.precheck?.bots.find((b) => b.id === id);
  const line = input.patrol?.bots?.find((b) => b.id === id);
  const parts: ScorePart[] = [];
  const causes: string[] = [];
  const strengths: string[] = [];
  const add = (key: ScorePart['key'], points: number, noteAr: string) => parts.push({ key, points: Math.max(0, Math.min(1, points)), weight: WEIGHTS[key], noteAr });

  // 1) The last run of its workflow.
  const run = c?.lastRun;
  const runCause = c?.cause || line?.cause;
  if (run && run.status === 'completed') {
    if (run.conclusion === 'success') { add('run', 1, 'آخر تشغيل نجح'); strengths.push('آخر تشغيل نجح'); }
    else if (run.conclusion === 'failure') {
      add('run', 0, 'آخر تشغيل فشل');
      causes.push(runCause?.length ? `آخر تشغيل فشل: ${runCause[0]}` : 'آخر تشغيل فشل (السبب في سجل التشغيل)');
      for (const e of runCause?.slice(1) || []) causes.push(clip(e));
    } else if (run.conclusion === 'skipped') { /* skipped on purpose (e.g. only after a deploy) — no judgement */ }
    else { add('run', 0.5, run.conclusion === 'timed_out' ? 'آخر تشغيل خلص وقته' : 'آخر تشغيل اتلغى'); causes.push(run.conclusion === 'timed_out' ? 'آخر تشغيل خلص وقته قبل ما يكمل' : 'آخر تشغيل اتلغى'); }
  } else if (line?.lastRunAt) {
    add('run', line.lastRunOk ? 1 : 0, line.lastRunOk ? 'آخر تشغيل نجح' : 'آخر تشغيل فشل');
    if (!line.lastRunOk) causes.push(runCause?.length ? `آخر تشغيل فشل: ${runCause[0]}` : 'آخر تشغيل فشل');
  }

  // 2) Its report on time.
  // (The check's own report is the file being read; a bot that never ran is «no data», not «late».)
  const reportAt = c?.reportAt || (id === 'precheck' ? input.precheck?.updatedAt : undefined);
  if (bot?.report && c && (reportAt || parts.length)) {
    const late = c.problems.find((p) => /متأخر|ما كتبش/.test(p));
    if (!reportAt) { add('report', 0, 'لسه ماكتبش تقرير'); causes.push(late || 'لسه ماكتبش تقرير'); }
    else if (!late) { add('report', 1, 'التقرير في ميعاده'); if (bot.everyHours) strengths.push('التقرير في ميعاده'); }
    else { add('report', /جداً/.test(late) ? 0 : 0.5, late); causes.push(late); }
  }

  // 3) The quality of its AI work (the supervisor's review, out of 10).
  const judged = (bot?.aiTools || []).map((t) => input.supervisor?.tools?.[t]).filter((t): t is SupervisorTool => typeof t?.score === 'number');
  if (judged.length) {
    const avg = judged.reduce((s, t) => s + (t.score as number), 0) / judged.length;
    add('quality', avg / 10, `تقييم جودة الشغل ${Math.round(avg * 10) / 10} من 10`);
    for (const t of judged) {
      if ((t.score as number) < 7) for (const i of (t.issues || []).slice(0, 2)) causes.push(clip(`${t.nameAr ? `${t.nameAr}: ` : ''}${i}`));
      for (const s of (t.strengths || []).slice(0, 1)) strengths.push(clip(s, 160));
    }
  }

  // 4) Its own numbers (the problems it reports about its own work).
  if (c && parts.length) {
    const own = c.problems.filter((p) => !isRunProblem(p));
    add('own', 1 - 0.25 * own.length, own.length ? `${own.length} ملاحظة على شغله` : 'أرقامه سليمة');
    for (const p of own) if (!causes.includes(p)) causes.push(clip(p));
  }

  // 5) The expert reviewer's hands-on verdict (patrol), and the probes in its scope.
  const review = input.patrol?.reviews?.filter((r) => r.bot === id).sort((a, b) => b.runAt.localeCompare(a.runAt))[0];
  if (review) {
    add('review', review.verdict === 'approved' ? 1 : 0, review.verdict === 'approved' ? `${review.reviewerAr} وافق على آخر شغل` : `${review.reviewerAr} رفض آخر شغل`);
    if (review.verdict === 'approved') strengths.push(`${review.reviewerAr} جرّب الشغل بإيده ووافق`);
    else for (const d of review.defects.slice(0, 3)) if (!causes.some((x) => x.includes(d))) causes.push(clip(`${review.reviewerAr}: ${d}`));
  }
  for (const item of input.patrol?.open?.filter((i) => i.bot === id) || []) if (!causes.some((x) => x.includes(item.textAr))) causes.push(clip(item.textAr));

  const weight = parts.reduce((s, p) => s + p.weight, 0);
  let score = weight ? Math.round((100 * parts.reduce((s, p) => s + p.points * p.weight, 0)) / weight) : null;
  // A broken run or a broken report is a defect whatever the average says.
  if (score !== null && c?.status === 'fail') score = Math.min(score, GRADE_AT.warn - 1);
  else if (score !== null && c?.status === 'warn') score = Math.min(score, GRADE_AT.high - 1);
  const owner = Boolean(causes.length) && OWNER.test(causes.slice(0, 2).join(' '));
  return {
    id, score, grade: gradeOf(score), parts, causes: [...new Set(causes)], strengths: [...new Set(strengths)].slice(0, 4), owner,
    ...(run?.status === 'completed' ? { lastRunAt: run.at, lastRunOk: run.conclusion === 'success', runUrl: run.url } : line?.lastRunAt ? { lastRunAt: line.lastRunAt, lastRunOk: line.lastRunOk } : {}),
    ...(reportAt ? { reportAt } : {}),
  };
}

/** Every bot, best first (no data last). */
export function scoreAll(input: OpsInput): ToolScore[] {
  return BOTS.map((b) => scoreBot(b.id, input)).sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.id.localeCompare(b.id));
}

export function summarize(scores: ToolScore[]) {
  const by = (g: Grade) => scores.filter((s) => s.grade === g);
  const measured = scores.filter((s) => s.score !== null);
  return {
    high: by('high'), good: by('good'), warn: by('warn'), fail: by('fail'), idle: by('idle'),
    average: measured.length ? Math.round(measured.reduce((s, x) => s + (x.score as number), 0) / measured.length) : null,
  };
}

// ── Journeys: how a piece of work travels through the tools ───────────────────────────────────────────────
export interface JourneyStep { bot: BotId; ar: string; en: string }
export interface Journey { id: string; nameAr: string; nameEn: string; steps: JourneyStep[] }

export const JOURNEYS: Journey[] = [
  { id: 'product', nameAr: 'منتج جديد يوصل للمتجر', nameEn: 'A new product reaches the store', steps: [
    { bot: 'scout', ar: 'يلاقي متجر عطور موثوق', en: 'Finds a trusted perfume store' },
    { bot: 'legal', ar: 'يتأكد من الإذن المكتوب قبل النقل', en: 'Checks the written permission first' },
    { bot: 'importer', ar: 'ينقل المنتج ويسعّره (+50% + الشحن)', en: 'Imports and prices it (+50% + shipping)' },
    { bot: 'images', ar: 'يشيل أرقام وروابط المورد من الصور', en: 'Removes the supplier marks from photos' },
    { bot: 'catalog', ar: 'يصحح الاسم والوصف والنوتات', en: 'Fixes name, description and notes' },
    { bot: 'deploy', ar: 'يبني الموقع وينشره', en: 'Builds and publishes the site' },
    { bot: 'product_pages', ar: 'يفتح الصفحة على موبايل ويتأكد إنها سليمة', en: 'Opens the page on a phone and checks it' },
    { bot: 'seo', ar: 'يعرّف محركات البحث بالصفحة', en: 'Tells search engines about the page' },
  ] },
  { id: 'order', nameAr: 'زائر بيشتري', nameEn: 'A visitor buys', steps: [
    { bot: 'product_pages', ar: 'صفحة المنتج بعملة بلد الزائر', en: 'Product page in the visitor\'s currency' },
    { bot: 'store_advisor', ar: '«اسأل شاهين» يساعده يختار', en: '«Ask Shaheen» helps them choose' },
    { bot: 'chat', ar: 'شاهين يرد على أسئلته', en: 'Shaheen answers questions' },
    { bot: 'finance', ar: 'طرق الدفع وتسجيل الطلب', en: 'Payment methods and the order record' },
    { bot: 'visitor_tour', ar: 'جولة شراء تجريبية تتأكد إن الرحلة سليمة', en: 'A test shopping tour checks the journey' },
  ] },
  { id: 'news', nameAr: 'خبر جديد', nameEn: 'A news story', steps: [
    { bot: 'news', ar: 'يجمع الأخبار الحقيقية بمصادرها', en: 'Collects real news with sources' },
    { bot: 'secretary', ar: 'يقيّم الجودة ويدي توجيهات', en: 'Scores the quality and guides' },
    { bot: 'school', ar: 'شاهين يذاكر الدروس الجديدة', en: 'Shaheen studies the new lessons' },
    { bot: 'chat', ar: 'يستخدمها في ردوده على الزوار', en: 'Uses them in answers to visitors' },
  ] },
  { id: 'offline', nameAr: 'سؤال جديد والمحركات واقعة', nameEn: 'A new question while the AI engines are down', steps: [
    { bot: 'chat', ar: 'مفيش محرك ذكاء اصطناعي رد', en: 'No AI engine answers' },
    { bot: 'library', ar: 'المكتبة ترد من الموسوعة والدروس والذاكرة', en: 'The library answers from his knowledge' },
    { bot: 'researcher', ar: 'مش في المكتبة؟ الباحث يدور في المصادر المفتوحة', en: 'Not there? The researcher looks it up' },
    { bot: 'teacher', ar: 'المعلم المحلي يكتب الدرس والمراجع يفحصه', en: 'The local teacher writes the lesson; the reviewer checks it' },
    { bot: 'school', ar: 'الدرس يتحفظ في ذاكرة شاهين للمرة الجاية', en: 'The lesson joins his memory for next time' },
  ] },
  { id: 'incident', nameAr: 'عطل في الموقع', nameEn: 'A site problem', steps: [
    { bot: 'patrol', ar: 'الدورية تكتشفه بالتجربة', en: 'The patrol finds it by testing' },
    { bot: 'live_check', ar: 'يتأكد إن شاهين بيرد على الموقع الحي', en: 'Checks Shaheen answers on the live site' },
    { bot: 'doctor', ar: 'الطبيب يكشف ويصلّح', en: 'The doctor diagnoses and fixes' },
    { bot: 'deploy', ar: 'إعادة نشر الموقع', en: 'Redeploys the site' },
    { bot: 'council', ar: 'لو محتاج تطوير يبقى مهمة في الاجتماع', en: 'Needs development → a meeting task' },
  ] },
  { id: 'task', nameAr: 'مهمة تطوير', nameEn: 'A development task', steps: [
    { bot: 'precheck', ar: 'يجمع تقارير كل الأدوات قبل الاجتماع', en: 'Collects every tool\'s report' },
    { bot: 'council', ar: 'الاجتماع اليومي يقرر المهمة', en: 'The daily meeting decides the task' },
    { bot: 'verifier', ar: 'المراجع الخارجي يتأكد إنها اتصلحت فعلاً', en: 'The verifier checks it is really fixed' },
    { bot: 'patrol', ar: 'الدورية تعيد الاختبار', en: 'The patrol tests again' },
  ] },
  { id: 'language', nameAr: 'ترجمة وتصميم', nameEn: 'Translation & design', steps: [
    { bot: 'design_audit', ar: 'تدقيق التصميم واللغات', en: 'Design & language audit' },
    { bot: 'languages', ar: 'المترجم الذكي يكمل الترجمات', en: 'The translator completes texts' },
    { bot: 'design_expert', ar: 'خبير التصميم يراجع ويقترح', en: 'The design expert reviews' },
    { bot: 'chat', ar: 'لغة وأرقام صحيحة للزائر', en: 'Right language and numbers for visitors' },
  ] },
  { id: 'studio', nameAr: 'تحديث من الاستوديو', nameEn: 'An update from the studio', steps: [
    { bot: 'studio_zip', ar: 'يستلم الملف المضغوط', en: 'Receives the ZIP' },
    { bot: 'studio_bridge', ar: 'البوابة تفلتر التعديلات', en: 'The gate filters changes' },
    { bot: 'intake', ar: 'يتأكد إن التحديث سليم', en: 'Checks the update is safe' },
    { bot: 'deploy', ar: 'ينزل على الموقع', en: 'Goes live' },
  ] },
];

/** The weakest step decides a journey's health. */
export function journeyHealth(j: Journey, scores: ToolScore[]): { grade: Grade; weakest?: BotId } {
  const order: Grade[] = ['fail', 'warn', 'good', 'high'];
  let worst: { grade: Grade; weakest?: BotId } = { grade: 'idle' };
  for (const s of j.steps) {
    const g = scores.find((x) => x.id === s.bot)?.grade || 'idle';
    if (g === 'idle') continue;
    if (worst.grade === 'idle' || order.indexOf(g) < order.indexOf(worst.grade)) worst = { grade: g, weakest: s.bot };
  }
  return worst;
}

// ── Layout of the map (SVG user units) ────────────────────────────────────────────────────────────────────
export const MAP = { width: 1240, height: 790, nodeW: 220, nodeH: 42, top: 210, gap: 54 } as const;
/** Columns right-to-left (Arabic reading order): leadership first. */
export const DEPT_ORDER: DeptId[] = ['leadership', 'store', 'content', 'experience', 'reliability'];
export const deptX = (dept: DeptId) => MAP.width - 130 - DEPT_ORDER.indexOf(dept) * 245;
export const ROOT = { x: MAP.width / 2, y: 52 };

/** Short label for a node: the name before its bracket/dash note. */
export const shortName = (nameAr: string) => nameAr.split(/\s+[(—]/)[0].trim();

export interface NodePos { id: BotId; dept: DeptId; x: number; y: number }
export function layout(): NodePos[] {
  return DEPARTMENTS.flatMap((d) => BOTS.filter((b) => b.dept === d.id).map((b, i) => ({ id: b.id, dept: d.id, x: deptX(d.id), y: MAP.top + i * MAP.gap })));
}

/** Who this bot helps and who helps it (the cooperation links). */
export const helps = (id: BotId) => LINKS.filter((l) => l.from === id);
export const helpedBy = (id: BotId) => LINKS.filter((l) => l.to === id);
