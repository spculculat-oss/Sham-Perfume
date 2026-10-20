/**
 * «الفحص الشامل قبل الاجتماع» — two hours before «مجلس شاهين» (06:10 UTC, the meeting is at 08:15 UTC — right after the daily AI quota renews), every
 * robot under Shaheen's umbrella (src/utils/shaheenOrg.ts) is checked on its own report and its last run:
 *   - problems (late report, failed run, its own numbers below target),
 *   - the fix it proposes,
 *   - development ideas in its specialty.
 * Then the secretary («مشرف شاهين») routes help requests between the tools (handoffs: the reviewer's broken
 * photos → the photo cleaner, weak search pages → the catalog trainer, a late robot → a rerun…). The meeting
 * reads all of it as its agenda. Pure (no network): precheck.mts reads the files and the GitHub runs.
 */
import { BOTS, LEGAL_DECISIONS, botOf, type BotId } from '../../src/utils/shaheenOrg';
import { RERUNNABLE, type Action, type Rerunnable } from './council';

export interface RunInfo { conclusion: string | null; status: string; at: string; url?: string }
export type BotStatus = 'ok' | 'warn' | 'fail' | 'idle';
export interface BotCheck {
  id: BotId;
  status: BotStatus;
  reportAt?: string;
  ageHours?: number;
  lastRun?: RunInfo;
  problems: string[];
  fixes: string[];
  ideas: string[];
  /** Decisions of «المدير القانوني» this bot works under (binding — not problems to fix). */
  legal?: string[];
}
export interface Handoff { from: BotId; to: BotId; textAr: string; action?: Action }
export interface Pressure { active: boolean; reasons: string[] }
export interface PrecheckFile {
  version: 1;
  updatedAt: string;
  /** The meeting this check prepares (next 08:15 UTC). */
  meetingAt: string;
  health: number;
  counts: Record<BotStatus, number>;
  summaryAr: string;
  bots: BotCheck[];
  handoffs: Handoff[];
}

export const isPrecheckFile = (d: unknown): d is PrecheckFile =>
  Boolean(d && typeof d === 'object' && (d as PrecheckFile).version === 1 && Array.isArray((d as PrecheckFile).bots));

type Obj = Record<string, unknown>;
const o = (v: unknown): Obj => (v && typeof v === 'object' ? v as Obj : {});
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const RANK: Record<BotStatus, number> = { idle: 0, ok: 1, warn: 2, fail: 3 };

/** The next meeting time (08:15 UTC) after `now`. */
export function nextMeeting(now: number): string {
  const d = new Date(now);
  const m = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 8, 15);
  return new Date(m > now ? m : m + 86_400_000).toISOString();
}

interface Finding { level: 'warn' | 'fail' | 'note'; problem?: string; fix?: string; idea?: string }

/** Each bot's own numbers (from its report): what is wrong, the fix, and an idea to grow. */
function ownChecks(id: BotId, r: Obj, now: number): Finding[] {
  const f: Finding[] = [];
  switch (id) {
    case 'council': {
      const old = arr(r.tasks).map(o).filter((t) => t.status === 'open' && Date.parse(String(t.createdAt || '')) < now - 7 * 86_400_000);
      if (old.length) f.push({ level: 'warn', problem: `${old.length} مهمة تطوير مفتوحة من أكتر من أسبوع`, fix: 'اكتب «نفذ مهام شاهين» في الشات مع وكيل البرمجة' });
      if (o(arr(r.meetings)[0]).mode === 'self') f.push({ level: 'note', idea: 'آخر اجتماع اتعمل من التقارير بدون نقاش — لما الباقات ترجع النقاش يرجع' });
      break;
    }
    case 'secretary': {
      const overall = n(r.overall);
      const tools: Obj[] = Object.entries(o(r.tools)).map(([tid, t]) => ({ tid, ...o(t) }));
      const weak = tools.filter((t) => t.status === 'fail' || (n(t.score) ?? 10) < 6);
      if (weak.length) f.push({ level: 'warn', problem: `أدوات ذكاء اصطناعي ضعيفة: ${weak.map((t) => `${t.nameAr || t.tid} (${n(t.score) ?? 'فشل'})`).join('، ')}`, fix: 'المجلس يحوّلها لمهمة تطوير، والمشرف يشد توجيهاتها' });
      if (overall !== undefined && overall < 7) f.push({ level: 'warn', problem: `متوسط تقييم الأدوات ${overall}/10` });
      const mid = tools.filter((t) => (n(t.score) ?? 0) >= 6 && (n(t.score) ?? 0) < 8).map((t) => String(t.nameAr || t.tid));
      if (mid.length) f.push({ level: 'note', idea: `رفع ${mid.slice(0, 3).join('، ')} لـ 8/10 أو أكتر` });
      break;
    }
    case 'finance': {
      // The finance ledger stays private. Only read the supervisor's already-redacted health result;
      // never copy arbitrary issues, notes, references or amounts into the public meeting report.
      const tool = o(o(r.tools).finance_agent);
      const checked = Date.parse(String(tool.checkedAt || ''));
      const score = n(tool.score) ?? n(tool.autoScore);
      if (!Object.keys(tool).length || tool.status === 'skipped' || !Number.isFinite(checked)) {
        f.push({ level: 'warn', problem: 'الفحص المالي الخاص لم يُتحقق منه', fix: 'راجع إعدادات المصادقة والجدولة في لوحة المالية؛ لا تنشر السجل المالي' });
      } else if (now - checked > 36 * 3_600_000) {
        f.push({ level: 'warn', problem: 'حالة الفحص المالي متأخرة', fix: 'راجع آخر فحص خاص وإعدادات المشرف؛ لا تعاود خصم أي مبلغ' });
      } else if (tool.status === 'fail' || (score ?? 10) < 6) {
        f.push({ level: 'fail', problem: 'فحص الإدارة المالية غير سليم', fix: 'راجع بلاغات لوحة المالية الخاصة؛ اعتماد الحساب والتسوية قرار صاحب المتجر' });
      } else if (tool.status === 'warn') {
        f.push({ level: 'warn', problem: 'الإدارة المالية تحتاج مراجعة خاصة', fix: 'راجع آخر فحص وبلاغات لوحة المالية' });
      }
      break;
    }
    case 'scout': {
      const s = arr(r.sources).map(o);
      const active = s.filter((x) => x.status === 'active').length;
      if (s.length >= 10 && !active) f.push({ level: 'fail', problem: 'مفيش ولا متجر نشط بيتنقل منه', fix: 'مراجعة أسباب الرفض وتوسيع البحث العالمي' });
      else if (active < 5) f.push({ level: 'note', idea: `زيادة المتاجر الموثوقة النشطة (حالياً ${active}) من أوروبا وأمريكا وآسيا` });
      break;
    }
    case 'importer': {
      const sum = o(r.summary);
      const total = n(sum.total) ?? 0;
      if ((n(sum.brokenImages) ?? 0) > 0) f.push({ level: 'warn', problem: `${sum.brokenImages} صورة منتج لا تفتح`, fix: 'المراجع يخفي المنتج لحد ما الصورة تتصلح' });
      if (total && (n(sum.hidden) ?? 0) > total * 0.1) f.push({ level: 'warn', problem: `${sum.hidden} منتج مخفي من ${total}` });
      if (total && (n(sum.warn) ?? 0) > total * 0.4) f.push({ level: 'note', idea: `${sum.warn} منتج عليه ملاحظات — تحسين بياناته مع مدرّب الكتالوج` });
      break;
    }
    case 'catalog': {
      const issues = n(o(r.audit).issues) ?? arr(o(r.audit).issues).length;
      if (issues) f.push({ level: 'note', idea: `${issues} ملاحظة بيانات في الكتالوج تتصلح في الجولات الجاية` });
      break;
    }
    case 'news':
      if (!arr(r.items).length) f.push({ level: 'fail', problem: 'النشرة فاضية (ولا خبر)', fix: 'إعادة تشغيل النشرة ومراجعة مصادر الأخبار' });
      break;
    case 'seo': {
      const score = n(o(r.audit).score);
      if (score !== undefined && score < 60) f.push({ level: 'fail', problem: `تقييم الظهور في البحث ${score}/100`, fix: 'إصلاح الملاحظات الحرجة أولاً' });
      else if (score !== undefined && score < 85) f.push({ level: 'warn', problem: `تقييم الظهور في البحث ${score}/100` });
      if (o(r.trust).level === 'trainee') f.push({ level: 'note', idea: 'المندوب لسه متدرب — يتدرج للاعتماد على النفس بتقييم شاهين' });
      break;
    }
    case 'languages': {
      const pub = arr(r.publicNumberInputs).length;
      const packs = arr(r.incompletePacks).length;
      if (pub) f.push({ level: 'fail', problem: `${pub} حقل أرقام عند الزوار بيتبع لغة المتصفح مش لغة الموقع`, fix: 'تحويلها لحقل الأرقام المترجم' });
      if (packs) f.push({ level: 'warn', problem: `${packs} لغة حزمها ناقصة` });
      const score = n(r.score);
      if (score !== undefined && score < 80) f.push({ level: 'note', idea: `رفع نتيجة اللغات من ${score}/100: ${arr(r.bareLocaleFormatting).length} تنسيق أرقام/تواريخ بلا لغة صريحة` });
      const tr = o(r.translation);
      if (tr.status === 'no_engine') f.push({ level: 'warn', problem: 'المترجم الذكي مش لاقي مفتاح ذكاء اصطناعي شغال', fix: 'مفتاح شغال واحد (جيميناي أو بربلكسيتي) يكفي' });
      else if (tr.status === 'engines_failed') f.push({ level: 'warn', problem: 'المحركات مردتش على المترجم الذكي في آخر دورة' });
      else if ((n(tr.remaining) ?? 0) > 0) f.push({ level: 'note', idea: `المترجم الذكي لسه قدامه ${n(tr.remaining)} نص × لغة بالإنجليزي — بيكمل كل دورة` });
      break;
    }
    case 'design_audit': {
      const score = n(r.score);
      if (score !== undefined && score < 70) f.push({ level: 'warn', problem: `تقييم التصميم واللغات ${score}/100 (${arr(r.issues).length} ملاحظة)`, fix: 'وكيل اللغات وقسم التصميم يشتغلوا على الملاحظات' });
      break;
    }
    case 'visitor_tour': {
      const failed = arr(r.journey).map(o).filter((s) => s.ok === false);
      if (failed.length) f.push({ level: failed.some((s) => s.step === 'cart' || s.step === 'checkout') ? 'fail' : 'warn', problem: `جولة الزائر: خطوات واقعة — ${failed.map((s) => `${String(s.step)}: ${String(s.noteAr || '').slice(0, 80)}`).join('، ')}`, fix: 'إصلاح الخطوة قبل أي تطوير تاني' });
      const score = n(r.score);
      if (score !== undefined && score < 85) f.push({ level: 'note', idea: `رحلة الشراء من الموبايل ${score}/100 — ${arr(r.issues).length} ملاحظة` });
      break;
    }
    case 'verifier': {
      const notFixed = arr(r.checks).map(o).filter((c) => c.verdict === 'not_fixed');
      if (notFixed.length) f.push({ level: 'warn', problem: `${notFixed.length} مهمة اتقفلت ولسه مش متصلحة على الموقع: ${notFixed.map((c) => String(c.title)).join('، ')}`, fix: 'إعادة فتح المهمة في الاجتماع' });
      break;
    }
    case 'school': {
      const rel = n(o(r.reliance).score);
      if (rel !== undefined && rel < 50) f.push({ level: 'fail', problem: `بيرد لوحده على ${rel}% بس من الأسئلة`, fix: 'مذاكرة الأسئلة الناقصة' });
      else if (rel !== undefined && rel < 70) f.push({ level: 'warn', problem: `الاعتماد على النفس ${rel}%` });
      else if (rel !== undefined && rel < 95) f.push({ level: 'note', idea: `يوصل الاعتماد على النفس من ${rel}% لـ 95%` });
      break;
    }
    case 'keys': {
      const paused = Object.entries(o(r.engines)).filter(([, e]) => Date.parse(String(o(e).pausedUntil || '')) > now).map(([e]) => e);
      if (paused.length) f.push({ level: 'warn', problem: `محركات متوقفة مؤقتاً: ${paused.join('، ')}`, fix: 'شحن الرصيد أو انتظار تجدد الباقة — السكرتير يمسك الشغل' });
      break;
    }
    case 'intake': {
      const failing = Object.entries(o(r.checks)).filter(([k, v]) => k !== 'at' && v === 'failure').map(([k]) => k);
      if (failing.length) f.push({ level: 'fail', problem: `فحوص فاشلة في آخر تحديث: ${failing.join('، ')}`, fix: 'إصلاح الفحص قبل أي تحديث جديد' });
      break;
    }
    case 'patrol': {
      const open = arr(r.open).map(o);
      const stuck = open.filter((x) => x.level === 'fail' && x.status !== 'owner' && x.status !== 'fixing');
      if (stuck.length) f.push({ level: 'warn', problem: `${stuck.length} عطل الدورية ماقدرتش تصلحه آلياً`, fix: 'شاهين يشخصه أو يتحول لمهمة تطوير' });
      const rejected = arr(r.reviews).map(o).filter((x) => x.verdict === 'rejected' && Date.parse(String(x.runAt || '')) > now - 86_400_000).length;
      if (rejected) f.push({ level: 'note', idea: `${rejected} شغل اترفض من خبير الفحص آخر 24 ساعة — يتصلح قبل أي تطوير` });
      break;
    }
    case 'studio_bridge': {
      const last = o(arr(r.runs)[0]);
      if (r.status === 'failed') f.push({ level: 'warn', problem: `آخر تحديث من جوجل استوديو كسر فحوص الموقع (${String(last.branch || '')})`, fix: 'مهمة «تحديث من جوجل استوديو» — وكيل البرمجة يصلحه وينشره' });
      else if (r.status === 'review') f.push({ level: 'note', idea: `تحديث من جوجل استوديو مستني موافقة (${String(last.branch || '')})` });
      break;
    }
    default:
      break;
  }
  return f;
}

const hoursSinceIso = (iso: unknown, now: number) => (typeof iso === 'string' && Date.parse(iso) > 0 ? (now - Date.parse(iso)) / 3_600_000 : undefined);

/** Help requests between the tools, from their reports (the secretary routes them). */
export function findHandoffs(reports: Record<string, unknown>, checks: BotCheck[], now: number): Handoff[] {
  const out: Handoff[] = [];
  const review = o(reports['store-review.json']);
  const broken = n(o(review.summary).brokenImages) ?? 0;
  if (broken) out.push({ from: 'importer', to: 'images', textAr: `${broken} صورة منتج لا تفتح — منظف الصور يعيد معالجتها في الدورة الجاية` });
  const sum = o(review.summary);
  if ((n(sum.warn) ?? 0) > (n(sum.total) ?? Infinity) * 0.4) out.push({ from: 'importer', to: 'catalog', textAr: `${sum.warn} منتج عليه ملاحظات — مدرّب الكتالوج يبدأ بيها` });
  const seo = o(reports['seo-agent.json']);
  const contentFindings = arr(o(seo.audit).findings).map(o).filter((x) => /product|منتج|description|وصف|meta|title|عنوان/i.test(`${x.area || ''} ${x.title || ''}`));
  if (contentFindings.length) out.push({ from: 'seo', to: 'catalog', textAr: `${contentFindings.length} ملاحظة بحث عن العناوين والأوصاف — مدرّب الكتالوج يحسنها` });
  const school = o(reports['shaheen-school.json']);
  const pending = arr(school.pending).length;
  if (pending) out.push({ from: 'school', to: 'news', textAr: `${pending} سؤال مدرسة شاهين لسه ما اتذاكرش — دروس المساعد تكتب عنها` });
  const sources = arr(o(reports['import-sources.json']).sources).map(o);
  const unreadable = sources.filter((s) => /غير مقروءة/.test(String(s.reason || ''))).length;
  if (unreadable) out.push({ from: 'scout', to: 'importer', textAr: `${unreadable} متجر صفحاته غير مقروءة بدون ذكاء اصطناعي — مهارات القراءة تتعلمها لما المحرك يتاح` });
  const audit = o(reports['manus-audit.json']);
  if (arr(audit.issues).length && (n(audit.score) ?? 100) < 80) out.push({ from: 'design_audit', to: 'languages', textAr: `${arr(audit.issues).length} ملاحظة تصميم وترجمة — وكيل اللغات يقيسها في فحصه` });
  const missions = o(reports['manus-missions.json']);
  const tour = o(missions.tour);
  if ((hoursSinceIso(tour.at, now) ?? 99) < 48) {
    const pages = arr(tour.issues).map(o).filter((i) => i.area === 'store').length;
    if (pages) out.push({ from: 'visitor_tour', to: 'product_pages', textAr: `${pages} ملاحظة على صفحات المتجر من جولة الزائر — مراجع الصفحات يبدأ بيها` });
  }
  const paused = Object.entries(o(o(reports['ai-quota.json']).engines)).filter(([, e]) => Date.parse(String(o(e).pausedUntil || '')) > now).length;
  if (paused) out.push({ from: 'keys', to: 'secretary', textAr: `${paused} محرك متوقف — السكرتير جاهز ينوب عن شاهين` });
  if (checks.some((c) => c.id === 'finance' && ['warn', 'fail'].includes(c.status))) out.push({ from: 'finance', to: 'secretary', textAr: 'الإدارة المالية تحتاج مراجعة في اللوحة الخاصة؛ لا مبالغ أو بيانات طلبات في التقرير العام' });
  // A late robot whose workflow may be rerun safely: the secretary starts it (once per workflow).
  const started = new Set<string>();
  for (const c of checks) {
    const bot = botOf(c.id);
    if (!bot?.workflow || !c.problems.some((p) => /متأخر/.test(p)) || !RERUNNABLE.includes(bot.workflow as Rerunnable) || started.has(bot.workflow)) continue;
    started.add(bot.workflow);
    out.push({ from: 'secretary', to: c.id, textAr: `${bot.nameAr} متأخر — السكرتير يشغله`, action: { type: 'rerun', workflow: bot.workflow as Rerunnable } });
  }
  return out;
}

/** The full check: every bot in the structure, its status, problems, fixes, ideas; then the handoffs. */
export function runPrecheck(reports: Record<string, unknown>, runs: Record<string, RunInfo | undefined>, now: number): PrecheckFile {
  const bots: BotCheck[] = [];
  for (const bot of BOTS) {
    const c: BotCheck = { id: bot.id, status: 'idle', problems: [], fixes: [], ideas: [] };
    let level: BotStatus = 'idle';
    const raise = (s: BotStatus) => { if (RANK[s] > RANK[level]) level = s; };
    const run = bot.workflow ? runs[bot.workflow] : undefined;
    if (run) {
      c.lastRun = run;
      if (run.conclusion === 'failure') { raise('fail'); c.problems.push('آخر تشغيل فشل'); c.fixes.push('افتح سجل التشغيل وأصلح سبب الفشل'); }
      else if (run.conclusion === 'cancelled' || run.conclusion === 'timed_out') { raise('warn'); c.problems.push(run.conclusion === 'timed_out' ? 'آخر تشغيل خلص وقته' : 'آخر تشغيل اتلغى'); }
      else if (run.conclusion === 'success' || run.status !== 'completed') raise('ok');
    }
    const whole = bot.report && bot.id !== 'precheck' ? reports[bot.report] : undefined;
    // Bots sharing one report (the background agent's missions) are measured on their own part of it.
    const report = bot.section ? o(whole)[bot.section] : whole;
    if (bot.report && bot.id !== 'precheck') {
      const at = String(o(report)[bot.section ? 'at' : 'updatedAt'] || '');
      const age = Date.parse(at) > 0 ? (now - Date.parse(at)) / 3_600_000 : undefined;
      if (age === undefined) { c.problems.push('لسه ما كتبش تقرير'); }
      else {
        c.reportAt = at; c.ageHours = Math.round(age * 10) / 10;
        raise('ok');
        if (bot.everyHours && age > bot.everyHours * 4) { raise('fail'); c.problems.push(`التقرير متأخر جداً (${Math.round(age)} ساعة، المفروض كل ${bot.everyHours})`); c.fixes.push('إعادة تشغيل الروبوت ومراجعة سبب التوقف'); }
        else if (bot.everyHours && age > bot.everyHours * 2) { raise('warn'); c.problems.push(`التقرير متأخر (${Math.round(age)} ساعة، المفروض كل ${bot.everyHours})`); c.fixes.push('إعادة تشغيل الروبوت'); }
        for (const x of ownChecks(bot.id, o(report), now)) {
          if (x.level !== 'note') raise(x.level);
          if (x.problem) c.problems.push(x.problem);
          if (x.fix) c.fixes.push(x.fix);
          if (x.idea) c.ideas.push(x.idea);
        }
      }
    }
    if (bot.id === 'precheck' || bot.id === 'legal') raise('ok');
    // «المدير القانوني»: the decisions in force for this bot (for the legal manager himself: all of them).
    const legal = LEGAL_DECISIONS.filter((x) => x.bot === bot.id || bot.id === 'legal').map((x) => `${x.id}: ${x.textAr}`);
    if (legal.length) c.legal = legal;
    // A tool with no robot of its own (the chat, the advisor) is measured by the supervisor.
    if (!bot.workflow && bot.aiTools?.length) {
      const tools = o(o(reports['ai-supervisor.json']).tools);
      const scored = bot.aiTools.map((t) => ({ t, x: o(tools[t]) })).filter((y) => Object.keys(y.x).length);
      for (const { t, x } of scored) {
        const score = n(x.score) ?? n(x.autoScore);
        raise(x.status === 'fail' || (score ?? 10) < 6 ? 'warn' : 'ok');
        if (x.status === 'fail' || (score ?? 10) < 6) c.problems.push(`تقييم ${x.nameAr || t}: ${score ?? 'فشل'}/10`);
        else if ((score ?? 10) < 8) c.ideas.push(`رفع ${x.nameAr || t} من ${score}/10`);
      }
    }
    c.status = level;
    bots.push(c);
  }
  const handoffs = findHandoffs(reports, bots, now);
  const counts = { ok: 0, warn: 0, fail: 0, idle: 0 } as Record<BotStatus, number>;
  for (const b of bots) counts[b.status]++;
  const measured = bots.length - counts.idle;
  const health = measured ? Math.round((100 * (counts.ok + counts.warn * 0.5)) / measured) : 0;
  return {
    version: 1,
    updatedAt: new Date(now).toISOString(),
    meetingAt: nextMeeting(now),
    health,
    counts,
    summaryAr: `الفحص الشامل قبل الاجتماع: ${counts.ok} سليمة، ${counts.warn} محتاجة انتباه، ${counts.fail} فيها عطل، ${counts.idle} بدون بيانات — صحة الأدوات ${health}% — ${handoffs.length} طلب مساعدة بين الأدوات.`,
    bots,
    handoffs,
  };
}

/**
 * When the secretary deputises for Shaheen: no AI engine, quotas used up, the chair did not answer, or high
 * pressure (many urgent items or broken robots at once).
 */
export function pressureOf(i: { engines: number; quotaOut?: boolean; chairFailed?: boolean; spoke?: number; urgent: number; failing: number }): Pressure {
  const reasons: string[] = [];
  if (!i.engines) reasons.push('مفيش محرك ذكاء اصطناعي متاح');
  if (i.quotaOut) reasons.push('باقات المحركات خلصت أثناء الاجتماع');
  if (i.engines && i.spoke !== undefined && i.spoke < 2) reasons.push('المحركات مشغولة (أقل من خبيرين اتكلموا)');
  if (i.chairFailed) reasons.push('شاهين ما قدرش يكتب المحضر');
  if (i.urgent >= 5) reasons.push(`ضغط: ${i.urgent} ملاحظة عاجلة`);
  if (i.failing >= 3) reasons.push(`ضغط: ${i.failing} روبوت فيهم عطل`);
  return { active: reasons.length > 0, reasons };
}
