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
import { failureCauseAr } from '../../src/utils/opsMap';
import { OWNER_STOPPED_AR, stoppedByOwner, type OwnerControls } from '../../src/utils/ownerAuthority';

export interface RunInfo {
  conclusion: string | null; status: string; at: string; url?: string;
  /** When it failed: the first failed step and the run's own error annotations (runs.ts → failureDetail). */
  failedStep?: string; errors?: string[];
}
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
  /** Why the last run failed, in plain Arabic (src/utils/opsMap.ts → failureCauseAr). */
  cause?: string[];
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
      // «فهم شاهين للغلطات»: mistyped words he must still understand.
      const spell = n(o(r.spelling).score);
      if (spell !== undefined && spell < 80) f.push({ level: 'warn', problem: `بيفهم ${spell}% بس من الكلمات المكتوبة غلط`, fix: 'مراجعة قاموس شاهين (src/utils/shaheenSpelling.ts) والأمثلة اللي فشلت في تقرير المدرسة' });
      break;
    }
    case 'teacher': {
      // The teacher shares the school's report: its own part is the latest sessions' mode and the lessons it wrote.
      const recent = arr(r.history).map(o).slice(0, 4);
      const pending = arr(r.pending).length;
      if (pending && recent.length && !recent.some((h) => h.mode === 'local' || h.mode === 'ai')) f.push({ level: 'warn', problem: `${pending} سؤال مستني المذاكرة والمعلم المحلي ماكتبش دروس آخر ${recent.length} جولات`, fix: 'مراجعة خطوة «المعلم المحلي» في shaheen-discover.yml (تحميل النموذج أو تشغيله)' });
      else if (!n(r.localTaughtTotal)) f.push({ level: 'note', idea: 'المعلم المحلي لسه مسجلش دروس في التقرير — أول جولة على main هتبدأ' });
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
    case 'census': {
      const totals = o(r.totals);
      const visits = n(totals.visits) ?? 0;
      const countries = n(totals.countriesCount) ?? 0;
      if (visits === 0) f.push({ level: 'note', idea: 'خانة التعداد شغالة وجاهزة — لسه ما تسجلتش زيارات في الكشف العلني (بدون أرقام وهمية)' });
      else f.push({ level: 'note', idea: `الكشف العلني يرصد ${visits} زيارة من ${countries} دولة حول العالم` });
      break;
    }
    case 'service': {
      // «مكتب خدمة العملاء»: knowledge coverage + the live desk, aggregated only (no names or contact data).
      const live = o(r.live);
      const inbox = o(r.inbox);
      const knowledge = o(r.knowledge);
      if (live.checked !== true) {
        f.push({ level: 'warn', problem: 'مكتب الدعم ما قراش الحساب الحي في آخر دورة — الأرقام الحية غير معروفة', fix: 'راجع SHAM_ADMIN_TOKEN ومسار الخدمة ثم شغّل روبوت خدمة العملاء' });
      }
      const handoffs = n(inbox.openHandoffs) ?? 0;
      const handoffAge = n(inbox.oldestHandoffHours) ?? 0;
      if (handoffs) {
        f.push({
          level: handoffAge >= 6 ? 'warn' : 'note',
          problem: `${handoffs} محادثة مستنية موظف${handoffAge ? ` (أقدمها ${Math.round(handoffAge)} ساعة)` : ''}`,
          fix: 'راجع لوحة المحادثات وابعت الرد المناسب؛ الردود الجاهزة في تقرير مكتب الدعم',
        });
      }
      const unresolved = n(inbox.unresolvedRequests) ?? 0;
      const requestAge = n(inbox.oldestUnresolvedHours) ?? 0;
      if (unresolved && requestAge >= 24) {
        f.push({ level: 'warn', problem: `${unresolved} طلب مفتوح وأقدمهم ${Math.round(requestAge)} ساعة (الحد 24 ساعة)`, fix: 'راجع الطلبات المفتوحة وحدّث حالتها بالرد الحقيقي' });
      }
      const coverage = n(knowledge.coverage) ?? 0;
      if (coverage < 100) {
        f.push({ level: coverage < 70 ? 'fail' : 'warn', problem: `معلومات الدعم ناقصة (${coverage}%)`, fix: 'أكمل محاور الشراء والدفع والشحن والتتبع والإرجاع في دليل المتجر' });
      }
      const gaps = n(inbox.openGaps) ?? 0;
      if (gaps) f.push({ level: 'note', idea: `${gaps} سؤال الزوار مالاقاش إجابة موثقة — يتحول لدرس في مدرسة شاهين` });
      const negative = n(inbox.negativeFeedback24h) ?? 0;
      if (negative >= 3) f.push({ level: 'note', idea: `${negative} تقييم سلبي في آخر 24 ساعة — راجع الردود المتكررة وحسّنها` });
      break;
    }
    case 'inventory': {
      // «إدارة المخزون والتنبؤ»: real stock/catalog numbers, plus a forecast only when real sales exist.
      const sources = o(r.sources);
      const catalog = o(r.catalog);
      const forecast = o(r.forecast);
      const restock = arr(r.restock).map(o);
      if (sources.liveStock !== true) {
        f.push({ level: 'warn', problem: 'المخزون الرقمي مش مقروء — الفحص اعتمد على حالة «متوفر/نفد» في الكتالوج', fix: 'راجع SHAM_ADMIN_TOKEN أو مسار المنتجات؛ الأعداد الحقيقية تظهر أول ما يتقرأ الحساب' });
      }
      if (sources.liveSales !== true) {
        f.push({ level: 'warn', problem: 'سجل الطلبات مش مقروء — التنبؤ بالمبيعات متوقف لحد ما يتقرأ', fix: 'راجع SHAM_ADMIN_TOKEN ومسار الطلبات في السيرفر؛ مفيش أرقام مبيعات متخمنة' });
      }
      const published = n(catalog.published) ?? 0;
      const out = n(catalog.outOfStock) ?? 0;
      if (published && out > published * 0.4) {
        f.push({ level: 'warn', problem: `${out} منتج غير متوفر من ${published}`, fix: 'راجع قائمة إعادة التوريد وابدأ بالمنتجات المميزة والأكثر طلباً' });
      }
      const featuredOut = n(catalog.featuredOut) ?? 0;
      if (featuredOut) {
        f.push({ level: 'warn', problem: `${featuredOut} منتج مميز غير متوفر على واجهة المتجر`, fix: 'أعد توريده أو استبدله بمنتج متوفر من نفس العائلة' });
      }
      const urgentRestock = restock.filter((item) => item.priority === 'urgent').length;
      const future = o(forecast.totals);
      const urgentForecast = n(future.urgent) ?? 0;
      if (urgentRestock || urgentForecast) {
        f.push({ level: 'warn', problem: `${Math.max(urgentRestock, urgentForecast)} منتج محتاج إعادة توريد عاجلة`, fix: 'راجع الكميات المقترحة في تقرير المخزون واطلبها قبل مدة التوريد' });
      }
      if (forecast.basis !== 'live') {
        f.push({ level: 'note', idea: 'التنبؤ بالمبيعات بيشتغل من الطلبات المؤكدة/المكتملة المسجلة بس — أول ما تتسجل أرقام حقيقية يتحسب تلقائياً' });
      }
      const plans = arr(r.planAr);
      if (plans.length) f.push({ level: 'note', idea: String(plans[0]) });
      break;
    }
    case 'scent_behavior': {
      // «سلوك الزائر العطري»: honest when the counters are unreadable, and the proposals are the value.
      const signals = o(r.signals);
      if (signals.read !== true) {
        f.push({ level: 'warn', problem: 'عدّاد إشارات المعمل مش مقروء — التحليل من محتوى المعمل والمتجر بس', fix: 'راجع SHAM_ADMIN_TOKEN ومسار /api/admin/lab-signals؛ والسيرفر لازم يكون منشور' });
      } else if ((n(signals.designs) ?? 0) === 0) {
        f.push({ level: 'note', idea: 'مفيش تركيبة اتشاركت لحد الآن — نشجع الزائر على زرار «شارك التركيبة مجهولة» في المعمل' });
      }
      const proposals = arr(r.proposals).map(o);
      if (proposals.length) f.push({ level: 'note', idea: `${proposals.length} مادة جديدة مرشحة من الخامات: ${proposals.slice(0, 3).map((p) => String(p.nameAr || '')).join('، ')}` });
      const score = n(r.score);
      if (score !== undefined && score < 60) f.push({ level: 'warn', problem: `درجة رضا المعمل ${score}/100 — فيه عائلات ناقصة أو أسماء طلبها الزوار ومش في البنك` });
      break;
    }
    case 'localization_audit': {
      // «العملات والمصطلحات»: a wrong currency shown to a visitor is a real fault, not a note.
      const bugs = arr(o(r.languageSwitch).bugs);
      if (bugs.length) f.push({ level: 'fail', problem: `${bugs.length} حالة بتظهر عملة غير عملة بلد الزائر`, fix: 'راجع src/utils/displayCurrency.ts والحالات في التقرير؛ الخصم لازم يفضل بعملة البلد' });
      const gaps = arr(r.rateGaps);
      if (gaps.length) f.push({ level: 'warn', problem: `${gaps.length} عملة رسمية من غير سعر صرف (${gaps.slice(0, 3).map((g) => `${o(g).country}:${o(g).currency}`).join('، ')})`, fix: 'حدّث أسعار الصرف أو وضّح للزائر إن العرض بالدولار' });
      const terms = arr(r.moneyTerms);
      if (terms.length) f.push({ level: 'warn', problem: `${terms.length} لغة ناقصة كلمات الفلوس`, fix: 'المترجم الذكي يكمل مفاتيح الفلوس (sf_total، sf_shipping، sf_currency…)' });
      const hard = arr(r.hardcoded);
      if (hard.length) f.push({ level: 'warn', problem: `${hard.length} مبلغ مكتوب بعملة ثابتة في كود الزوار`, fix: 'يتشال ويتحسب من محرك التسعير (src/utils/pricing.ts)' });
      break;
    }
    case 'catalog_review': {
      // «مراجعة المنتجات»: a price that loses money is a real fault, the rest is the owner's decision.
      const below = arr(r.belowShipping).filter((x) => o(x).sellable === true);
      if (below.length) f.push({ level: 'fail', problem: `${below.length} منتج معروض سعره أقل من تكلفة توصيله — خسارة في كل بيعة`, fix: 'ارفع سعر المنتج أو أوقف عرضه لحد ما صاحب المتجر يقرر (src/data/products.json)' });
      const breaks = arr(r.ruleBreaks);
      if (breaks.length) f.push({ level: 'warn', problem: `${breaks.length} منتج سعره مش على قاعدة السعر (التكلفة × 1.5)`, fix: 'أعد تسعير المنتجات دي بمستورد شاهين أو صحّح السعر يدوي' });
      const outliers = arr(r.outliers);
      if (outliers.length) f.push({ level: 'warn', problem: `${outliers.length} سعر أقل من 1% من متوسط المتجر — غالباً عملة غلط`, fix: 'اتأكد السعر بالجنيه قبل ما يفضل معروض' });
      const garbled = arr(r.garbledNames);
      if (garbled.length) f.push({ level: 'warn', problem: `${garbled.length} اسم منتج فيه حروف تالفة`, fix: 'مدرّب الكتالوج يكتب الاسم العربي الصحيح' });
      const generic = Number(o(r.arabic).genericDescriptions) || 0;
      if (generic) f.push({ level: 'note', idea: `${generic} منتج وصفه العربي لسه الجملة العامة — مدرّب الكتالوج يكتب وصف حقيقي` });
      const missing = Number(o(r.missing).noSourcePage) || 0;
      if (missing) f.push({ level: 'note', idea: `${missing} منتج مالوش صفحة مصدر — مراجع الصفحات يراجع مصدره` });
      const fs = o(r.freeShipping);
      if (fs.on !== true) f.push({ level: 'note', idea: 'الشحن المجاني مقفول — القرار في سطر واحد في src/data/shipping.json لما صاحب المتجر يوافق' });
      else {
        const zones = arr(fs.zones).filter((z) => Number(o(z).productsAbove) === 0);
        if (zones.length) f.push({ level: 'note', idea: `الشحن المجاني فوق ${fs.thresholdEgp} مش بيوصله أي منتج في ${zones.map((z) => String(o(z).nameAr)).slice(0, 3).join('، ')} — راجع الرقم` });
      }
      break;
    }
    case 'trade_lanes': {
      // «الشحن والتجارة»: a shipping price that loses money, an unregistered delivery mode, or a missing customs
      // source are findings; everything else is a decision for the merchant.
      const money = o(r.money);
      const loss = Number(money.lossDestinations) || 0;
      if (loss) f.push({ level: 'warn', problem: `${loss} وجهة لو إحنا اللي بنشحن تكلفة الشحن فيها أكبر من اللي بنحصّله`, fix: 'عدّل سعر الشحن أو فعّل ممر الوساطة للمنصات اللي بتشحن بنفسها' });
      const over = Number(money.overChargedDestinations) || 0;
      if (over) f.push({ level: 'note', idea: `${over} وجهة بنحصّل فيها شحن أكتر من ضعف تكلفته — تقليلها بيرفع التحويل` });
      const modes = o(r.modes);
      const unknown = Number(o(modes.unknown).products) || 0;
      if (unknown) f.push({ level: 'warn', problem: `${unknown} منتج من منصة طريقة تسليمها مش مسجلة (وساطة ولا إحنا بنشحن)`, fix: 'صاحب المتجر يحدد fulfilment لكل منصة في src/data/shipping-lanes.json' });
      const gaps = arr(r.gaps).filter((g) => String(o(g).kindAr) === 'الجمارك');
      if (gaps.length) f.push({ level: 'warn', problem: String(o(gaps[0]).whatAr), fix: String(o(gaps[0]).fixAr) });
      const dg = arr(r.gaps).filter((g) => String(o(g).kindAr) === 'المواد الخطرة');
      if (dg.length) f.push({ level: 'warn', problem: String(o(dg[0]).whatAr), fix: 'اتأكد من قبول العطور UN1266 مع كل شركة قبل عرض الشحن الدولي' });
      // The order's own verdict: the shipping shortfall after the bottle's markup has paid for it.
      const orderLoss = Number(money.orderLossDestinations) || 0;
      if (orderLoss) f.push({ level: 'warn', problem: `${orderLoss} وجهة الطلب فيها بخسارة حتى بعد مكسب العطر (أسوأ صافي ${Number(money.worstNetEgp) || 0} ج.م)`, fix: 'ارفع سعر الشحن في الوجهات دي أو أوقف الشحن لها لحد ما سعر الشحن يتأكد' });
      else if (loss) f.push({ level: 'note', idea: `${loss} وجهة الشحن فيها أغلى من اللي بنحصّله، بس مكسب العطر لسه بيغطيه — راقب الفرق` });
      // Where the goods sit, and whether the rate we charge was even quoted from there.
      const origins = arr(r.origins) as Record<string, unknown>[];
      const distant = origins.filter((x) => String(x.code) !== 'EG');
      if (distant.length) {
        f.push({ level: 'note', idea: `البضاعة متنوعة المصادر: ${origins.map((x) => `${String(x.nameAr)} ${Number(x.products)} منتج`).join('، ')} — الممر المحلي والدولي بيتحدد بكل بلد لوحده` });
      }
      const noRate = arr(r.gaps).filter((g) => String(o(g).kindAr) === 'سعر الشحن الدولي');
      if (noRate.length) f.push({ level: 'warn', problem: String(o(noRate[0]).whatAr), fix: 'يتجاب سعر منشور من الشركة اللي بتشحن من بلد البضاعة نفسها' });
      // A supplier price built on an old exchange rate is a cost the price does not show.
      const fxLines = arr(o(r.fx).lines);
      if (fxLines.length) {
        const worst = fxLines.map((l) => Number(o(l).driftPercent) || 0).sort((a, b) => Math.abs(b) - Math.abs(a))[0] || 0;
        f.push({
          level: Math.abs(worst) >= 5 ? 'warn' : 'note',
          ...(Math.abs(worst) >= 5
            ? { problem: `سعر الصرف اتحرك ${worst}% من يوم ما السعر اتحسب — التكلفة الحقيقية أعلى من المسجلة`, fix: 'إعادة تسعير المنتجات على سعر الصرف الحالي' }
            : { idea: `سعر الصرف اتحرك ${worst}% من يوم ما السعر اتحسب — تحت حد الخطر، بس راقبه` } as { idea: string }),
        });
      }
      break;
    }
    case 'finance_shield': {
      // «حارس المدفوعات»: the guard must be wired and must still stop every broken cart.
      const guard = o(r.guard);
      const drills = o(r.drills);
      if (guard.wired !== true) f.push({ level: 'fail', problem: 'حارس المدفوعات مش موصول في نقطة الدفع', fix: 'أرجع نداء reviewCharge في مساري الدفع في server/checkout.ts قبل أي مبلغ' });
      const failed = arr(drills.failed);
      if (failed.length) f.push({ level: 'fail', problem: `${failed.length} تمرين أمان فشل (${failed.map((x) => String(o(x).nameAr || o(x).id)).join('، ')})`, fix: 'راجع src/finance/shield.ts؛ الحارس لازم يوقف السلة المتلاعب فيها' });
      const mismatches = arr(o(r.live).mismatches);
      if (mismatches.length) f.push({ level: 'warn', problem: `${mismatches.length} دولة صفحة الدفع فيها بتخصم بعملة غير عملتها`, fix: 'راجع عملة حساب البوابة وKASHIER_CURRENCIES' });
      const notes = arr(r.notes);
      if (notes.length) f.push({ level: 'note', idea: String(notes[0]) });
      break;
    }
    case 'sales': {
      // «مدير المبيعات»: the live desk, the pipeline and the target — from confirmed figures only.
      const live = o(r.live);
      const pipeline = o(r.pipeline);
      const health = o(r.health);
      const targets = arr(r.targets).map(o);
      if (live.checked !== true) {
        f.push({ level: 'warn', problem: 'مكتب المبيعات ما قراش أرقام بنك شام في آخر دورة — الفجوة للهدف غير معروفة', fix: 'راجع SHAM_ADMIN_TOKEN ومسار المالية ثم شغّل روبوت المبيعات؛ مفيش أرقام متخمنة' });
      }
      const overdue = n(pipeline.overdueCount) ?? 0;
      if (overdue) f.push({ level: 'warn', problem: `${overdue} متابعة مبيعات فات موعدها`, fix: 'افتح «بنك شام ← إدارة المبيعات ← إيقاع اليوم» وحدّد خطوة جديدة لكل فرصة، أو أقفلها بسبب مسجل' });
      const noStep = n(pipeline.withoutNextStep) ?? 0;
      if (noStep) f.push({ level: 'note', idea: `${noStep} فرصة مفتوحة من غير خطوة جاية — تاريخ وإجراء واحد لكل فرصة بيرفع نسبة الكسب` });
      const score = n(health.score);
      if (score !== undefined && score < 50) f.push({ level: score < 30 ? 'fail' : 'warn', problem: `صحة المبيعات ${score}/100 — ${String(health.labelAr || '')}`, fix: 'راجع أسباب الصحة في تقرير المبيعات: الهدف، المتابعات، والتحويلات المستنية' });
      const behind = targets.filter((t) => t.pace === 'behind');
      if (behind.length) f.push({ level: 'note', idea: `${behind.length} عملة تحت إيقاع الهدف الشهري — راجع الفجوة اليومية بدل الانتظار لآخر الشهر` });
      if (!o(r.study).lessonId) f.push({ level: 'warn', problem: 'مفيش درس منهج مسجّل في آخر دورة', fix: 'تأكد إن روبوت المبيعات بيقرا SALES_PLAYBOOK.md ويسجّل درس اليوم وسؤاله في تقريره' });
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
  const auditIssues = arr(audit.issues).map(o);
  if (auditIssues.length && (n(audit.score) ?? 100) < 80) out.push({ from: 'design_audit', to: 'languages', textAr: `${auditIssues.length} ملاحظة تصميم وترجمة — وكيل اللغات يقيسها في فحصه` });
  const designIssues = auditIssues.filter((issue) => issue.area === 'design');
  if (designIssues.length && (n(audit.score) ?? 100) < 80) out.push({ from: 'design_audit', to: 'design_expert', textAr: `${designIssues.length} ملاحظة تصميم مرئية — خبير التصميم يراعيها في التصورات الجديدة` });
  const designCheck = checks.find((check) => check.id === 'design_expert');
  if (designCheck && ['warn', 'fail'].includes(designCheck.status)) {
    const designTool = o(o(reports['ai-supervisor.json']).tools).design_agent;
    const issueCount = arr(o(designTool).issues).length;
    const score = n(o(designTool).score) ?? n(o(designTool).autoScore);
    out.push({ from: 'design_expert', to: 'council', textAr: `تصميم شاهين يحتاج مراجعة${score === undefined ? '' : ` — ${score}/10`}${issueCount ? `، ${issueCount} ملاحظة جودة` : ''}؛ راجع التوجيه والمنهج قبل الدورة التالية` });
  }
  const missions = o(reports['manus-missions.json']);
  const tour = o(missions.tour);
  if ((hoursSinceIso(tour.at, now) ?? 99) < 48) {
    const pages = arr(tour.issues).map(o).filter((i) => i.area === 'store').length;
    if (pages) out.push({ from: 'visitor_tour', to: 'product_pages', textAr: `${pages} ملاحظة على صفحات المتجر من جولة الزائر — مراجع الصفحات يبدأ بيها` });
  }
  const paused = Object.entries(o(o(reports['ai-quota.json']).engines)).filter(([, e]) => Date.parse(String(o(e).pausedUntil || '')) > now).length;
  if (paused) out.push({ from: 'keys', to: 'secretary', textAr: `${paused} محرك متوقف — السكرتير جاهز ينوب عن شاهين` });
  if (checks.some((c) => c.id === 'finance' && ['warn', 'fail'].includes(c.status))) out.push({ from: 'finance', to: 'secretary', textAr: 'الإدارة المالية تحتاج مراجعة في اللوحة الخاصة؛ لا مبالغ أو بيانات طلبات في التقرير العام' });
  // «مكتب خدمة العملاء»: waiting conversations → the secretary (aggregated only, never the visitor's data).
  const desk = o(o(reports['shaheen-service.json']).inbox);
  const waiting = n(desk.openHandoffs) ?? 0;
  const late = n(desk.oldestHandoffHours) ?? 0;
  if (waiting) out.push({ from: 'service', to: 'secretary', textAr: `${waiting} محادثة مستنية موظف${late ? ` (أقدمها ${Math.round(late)} ساعة)` : ''} — المشرف يتأكد إن كل واحدة اترد عليها` });
  const unanswered = n(desk.openGaps) ?? 0;
  if (unanswered) out.push({ from: 'service', to: 'catalog', textAr: `${unanswered} سؤال عن المتجر مالاقاش إجابة موثقة — راجع بيانات المنتجات والبدائل` });
  // «إدارة المخزون»: what ran out → the importer, and the advisor needs in-stock alternatives.
  const stock = o(reports['shaheen-inventory.json']);
  const restock = arr(stock.restock).map(o).filter((item) => item.priority === 'urgent');
  if (restock.length) out.push({ from: 'inventory', to: 'importer', textAr: `${restock.length} منتج عاجل نفد أو قرب يخلص — المستورد يجهز إعادة التوريد من المتاجر المعتمدة` });
  const outCount = n(o(stock.catalog).outOfStock) ?? 0;
  if (outCount) out.push({ from: 'inventory', to: 'store_advisor', textAr: `${outCount} منتج غير متوفر — المستشار يرشح البدائل المتاحة من نفس العائلة العطرية` });
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
export function runPrecheck(reports: Record<string, unknown>, runs: Record<string, RunInfo | undefined>, now: number, controls?: OwnerControls): PrecheckFile {
  const bots: BotCheck[] = [];
  for (const bot of BOTS) {
    const c: BotCheck = { id: bot.id, status: 'idle', problems: [], fixes: [], ideas: [] };
    // «صاحب الموقع» paused it (or froze every robot): not late, not broken, nobody restarts it — it waits for him.
    if (controls && bot.workflow && stoppedByOwner(controls, bot.id)) {
      c.ideas.push(OWNER_STOPPED_AR);
      bots.push(c);
      continue;
    }
    let level: BotStatus = 'idle';
    const raise = (s: BotStatus) => { if (RANK[s] > RANK[level]) level = s; };
    const run = bot.workflow ? runs[bot.workflow] : undefined;
    if (run) {
      c.lastRun = run;
      if (run.conclusion === 'failure') {
        raise('fail'); c.problems.push('آخر تشغيل فشل');
        const why = failureCauseAr(run.failedStep, run.errors);
        if (why.length) c.cause = why;
        c.fixes.push(why.length ? `أصلح سبب الفشل: ${why[0]}` : 'افتح سجل التشغيل وأصلح سبب الفشل');
      }
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
