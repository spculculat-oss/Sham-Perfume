/**
 * «مدير المبيعات» بيسأل: a deterministic advisor over the desk's own figures.
 *
 * Like «شاهين المحاسب», it answers only from what the bank and the pipeline already computed. It never
 * predicts beyond the labelled projection, never invents a product or a number, and an unknown question gets
 * the list of what it can answer — not a guess. Discounts, partnerships and big promises are handed back to
 * the owner by name.
 */
import { major } from '../finance/money';
import type { PipelineSummary, Deal } from './pipeline';
import { STAGE_LABEL } from './pipeline';
import type { SalesHealth, TargetPace } from './targets';
import type { SalesTask } from './rhythm';
import type { StudyProgress } from './playbook';
import type { WeekCompare } from './review';

export interface SalesSnapshot {
  /** false = the live bank/pipeline figures were not read; answers must say so. */
  live: boolean;
  today: { currency: string; collectedMinor: number; paidOrders: number }[];
  month: { currency: string; collectedMinor: number; paidOrders: number }[];
  targets: TargetPace[];
  pipeline: PipelineSummary;
  health: SalesHealth;
  rhythm: SalesTask[];
  study: StudyProgress;
  /** The day's lesson title (for «أذاكر إيه النهارده؟»). */
  lessonTitle: string;
  topProducts: { sku: string; units: number; currency: string }[];
  waitingConfirmation: number;
  awaitingTransfer: number;
  deals: Pick<Deal, 'title' | 'stage' | 'valueMinor' | 'currency' | 'nextActionAt'>[];
  /** The week against the week before — attached only when the owner asks about the week. */
  week?: WeekCompare[];
}

export type SalesTopic = 'today' | 'target' | 'pipeline' | 'sales' | 'products' | 'pending' | 'study' | 'health' | 'loss' | 'week' | 'help';

const TOPICS: [SalesTopic, RegExp][] = [
  ['today', /أعمل إيه|اعمل ايه|النهارده|النهاردة|أبدأ إزاي|ابدأ ازاي|plan|today|what should i do/i],
  ['pending', /مستني|منتظر|تحويل|تأكيد|مدفوعات|pending|transfer|confirm/i],
  ['target', /هدف|تارجت|مستهدف|فاضل|target|quota|goal/i],
  ['pipeline', /فرص|أنابيب|انابيب|خط الأنابيب|خط الانابيب|متابع|pipeline|deals?|follow/i],
  ['products', /منتج|أكثر مبيع|اكتر مبيع|الأكثر|top|best.?sell|product/i],
  ['study', /درس|منهج|أذاكر|اذاكر|تعلم|study|lesson|course/i],
  ['health', /صحة|تقييم|حالة|score|health/i],
  ['loss', /خسار|بنخسر|خسرنا|أسباب|اسباب|lost|losses?|why.*lose/i],
  ['week', /أسبوع|اسبوع|الأسبوع|week|weekly/i],
  ['sales', /مبيع|بعنا|تحصيل|دخل|إيراد|ايراد|sales|revenue|collected/i],
];

export function salesTopicOf(question: string): SalesTopic {
  return TOPICS.find(([, re]) => re.test(question))?.[0] || 'help';
}

const HELP_AR = [
  'أقدر أجاوب من أرقام المكتب نفسها على:',
  '• «أعمل إيه النهارده؟» — إيقاع اليوم بالأولوية.',
  '• «إحنا واقفين فين من الهدف؟» — الهدف وإيقاعه والفجوة اليومية.',
  '• «خط الأنابيب عامل إيه؟» — الفرص والموزون والمتأخر ونسبة الكسب.',
  '• «مستني إيه في البنك؟» — تحويلات مستنية تأكيدك وطلبات محجوزة.',
  '• «إيه الأكثر مبيعاً؟» — من التحصيل المؤكد.',
  '• «أذاكر إيه النهارده؟» — درس المنهج.',
  '• «صحة المبيعات كام؟» — المؤشر وأسبابه.',
  '• «ليه بنخسر؟» — أسباب الخسارة اللي إنت كتبتها بنفسك.',
  '• «الأسبوع ده عامل إيه؟» — الأسبوع ده مقابل اللي فات من التحصيل المؤكد.',
  'مش هخمن رقم مش موجود، والخصومات والشراكات قرار صاحب الموقع.',
].join('\n');

const HELP_EN = [
  'I answer from the desk’s own figures:',
  '• “What should I do today?” — the daily rhythm by priority.',
  '• “Where are we against the target?” — pace and the daily gap.',
  '• “How is the pipeline?” — opportunities, weighted value, overdue, win rate.',
  '• “What is waiting in the bank?” — transfers awaiting confirmation and reserved orders.',
  '• “What sells best?” — from confirmed collections.',
  '• “What should I study today?” — the curriculum lesson.',
  '• “How healthy is sales?” — the score and its drivers.',
  '• “Why are we losing?” — the lost reasons you recorded yourself.',
  '• “How was this week?” — this week against last week from confirmed collections.',
  'I never invent a missing figure; discounts and partnerships are the owner’s decision.',
].join('\n');

export function answerSales(question: string, s: SalesSnapshot, lang: 'ar' | 'en' = /[\u0600-\u06FF]/.test(question) ? 'ar' : 'en'): { topic: SalesTopic; answer: string } {
  const ar = lang === 'ar';
  const t = (a: string, e: string) => (ar ? a : e);
  const fmt = (minor: number, currency: string) => {
    try { return new Intl.NumberFormat(ar ? 'ar-EG' : 'en-GB', { style: 'currency', currency, maximumFractionDigits: 2 }).format(major(minor, currency)); }
    catch { return `${minor} ${currency}`; }
  };
  const num = (n: number) => new Intl.NumberFormat(ar ? 'ar-EG' : 'en-GB').format(n);
  const list = (items: string[]) => items.join(ar ? '، ' : ', ');
  const topic = salesTopicOf(question);
  const notRead = t('مقدرتش أقرأ أرقام المكتب دلوقتي (اتصال الخادم أو التخزين)، فمش هخترع رقم. افتح لوحة المبيعات وجرّب تاني.',
    'I could not read the desk’s figures right now (server or storage), so I will not invent one. Open the sales desk and try again.');
  let answer: string;
  switch (topic) {
    case 'today':
      answer = s.rhythm.length
        ? [t('إيقاع النهارده بالأولوية:', 'Today’s rhythm, by priority:'), ...s.rhythm.slice(0, 6).map((task, i) => `${i + 1}. ${task.titleAr}\n   ${task.whyAr}`)].join('\n')
        : t('مفيش مهام من أرقام حقيقية دلوقتي — يعني مفيش لا تحويلات مستنية ولا متابعات متأخرة. راجع لوحة المتجر أو سجّل فرص جديدة.', 'No tasks from real figures right now — no waiting transfers and no late follow-ups. Review the store or add new opportunities.');
      if (!s.live) answer = `${notRead}\n${answer}`;
      break;
    case 'pending':
      answer = !s.live ? notRead : t(
        `${num(s.waitingConfirmation)} تحويل العميل بلّغ عنه ومستني تأكيدك، و${num(s.awaitingTransfer)} طلب محجوز لسه مستني التحويل. افتح «بنك شام» وشوف الفلوس في حسابك قبل أي تأكيد — التأكيد من غير رؤية المبلغ ممنوع.`,
        `${num(s.waitingConfirmation)} reported transfers await your confirmation and ${num(s.awaitingTransfer)} reserved orders await payment. Open Sham Bank and see the money yourself before confirming — never confirm without seeing it.`);
      break;
    case 'target': {
      const withTarget = s.targets.filter((x) => x.targetMinor > 0);
      if (!s.live) { answer = notRead; break; }
      answer = !withTarget.length
        ? t('مفيش هدف شهري محدد. حدّد الرقم اللي عايز توصله الشهر ده — من غيره مفيش قياس.', 'No monthly target is set. Set the number you want this month — without it there is no measurement.')
        : withTarget.map((x) => {
          const projection = x.projectionMinor === null ? '' : t(` التوقع بآخر الأيام: ${fmt(x.projectionMinor, x.currency)} (تقدير مش وعد).`, ` Projection at this pace: ${fmt(x.projectionMinor, x.currency)} (an estimate, not a promise).`);
          return t(`هدف ${x.currency}: ${fmt(x.targetMinor, x.currency)} · اتحصّل ${fmt(x.collectedMinor, x.currency)} (${x.percent}%) · فاضل ${fmt(x.gapMinor, x.currency)} في ${num(x.daysLeft)} يوم، يعني ${fmt(x.neededPerDayMinor ?? 0, x.currency)} في اليوم.${projection}`,
            `${x.currency} target: ${fmt(x.targetMinor, x.currency)} · collected ${fmt(x.collectedMinor, x.currency)} (${x.percent}%) · remaining ${fmt(x.gapMinor, x.currency)} over ${num(x.daysLeft)} days, i.e. ${fmt(x.neededPerDayMinor ?? 0, x.currency)} a day.${projection}`);
        }).join('\n');
      break;
    }
    case 'pipeline': {
      if (!s.live) { answer = notRead; break; }
      const p = s.pipeline;
      if (!p.openCount && !p.closedCount) { answer = t('خط الأنابيب فاضي — سجّل أول فرصة حقيقية من المتجر أو المكالمات، بخطوة جاية بتاريخ.', 'The pipeline is empty — add the first real opportunity from the store or calls, with a dated next step.'); break; }
      const lines = [t(`${num(p.openCount)} فرصة مفتوحة، منها ${num(p.overdueCount)} متابعة فاتت و${num(p.withoutNextStep)} من غير خطوة جاية. المقفول: ${num(p.wonCount)} كسب و${num(p.lostCount)} خسارة${p.winRate === null ? '' : ` — نسبة الكسب ${p.winRate}%`}.`,
        `${num(p.openCount)} open opportunities, ${num(p.overdueCount)} overdue and ${num(p.withoutNextStep)} with no next step. Closed: ${num(p.wonCount)} won and ${num(p.lostCount)} lost${p.winRate === null ? '' : ` — win rate ${p.winRate}%`}.`)];
      for (const row of p.byCurrency) lines.push(t(`• ${row.currency}: مفتوح ${fmt(row.openMinor, row.currency)} بإجمالي موزون ${fmt(row.weightedMinor, row.currency)} بالمرحلة.`, `• ${row.currency}: open ${fmt(row.openMinor, row.currency)}, stage-weighted ${fmt(row.weightedMinor, row.currency)}.`));
      const stageLine = p.stages.filter((x) => x.count).map((x) => `${STAGE_LABEL[x.stage][ar ? 'ar' : 'en']} ${num(x.count)}`).join(ar ? ' · ' : ' · ');
      if (stageLine) lines.push(t(`التوزيع: ${stageLine}.`, `By stage: ${stageLine}.`));
      lines.push(t('الموزون تقدير باحتمالية المرحلة، مش فلوس مضمونة.', 'The weighted figure is stage-probability, not guaranteed money.'));
      answer = lines.join('\n');
      break;
    }
    case 'sales': {
      if (!s.live) { answer = notRead; break; }
      const today = s.today.filter((x) => x.paidOrders || x.collectedMinor);
      const month = s.month.filter((x) => x.paidOrders || x.collectedMinor);
      if (!today.length && !month.length) { answer = t('مفيش تحصيل مؤكد في الفترة دي. الطلبات المحجوزة مش إيراد لحد ما الفلوس تتحصل وتتأكد في بنك شام.', 'No confirmed collections in this period. Reserved orders are not revenue until the money is collected and confirmed in Sham Bank.'); break; }
      answer = [
        ...today.map((x) => t(`النهارده: ${fmt(x.collectedMinor, x.currency)} من ${num(x.paidOrders)} طلب مدفوع.`, `Today: ${fmt(x.collectedMinor, x.currency)} from ${num(x.paidOrders)} paid orders.`)),
        ...month.map((x) => t(`الشهر ده: ${fmt(x.collectedMinor, x.currency)} من ${num(x.paidOrders)} طلب، ومتوسط الطلب ${fmt(x.paidOrders ? Math.round(x.collectedMinor / x.paidOrders) : 0, x.currency)}.`, `This month: ${fmt(x.collectedMinor, x.currency)} from ${num(x.paidOrders)} orders; average order ${fmt(x.paidOrders ? Math.round(x.collectedMinor / x.paidOrders) : 0, x.currency)}.`)),
      ].join('\n');
      break;
    }
    case 'products':
      answer = !s.topProducts.length
        ? t('مفيش منتجات اتباعت ودفعها اتأكد، فمفيش أكثر مبيعاً أذكره من غير تخمين.', 'No product sales are confirmed yet, so there is no best seller to report without guessing.')
        : t('الأكثر مبيعاً من التحصيل المؤكد: ', 'Best sellers from confirmed collections: ') + list(s.topProducts.slice(0, 3).map((p) => `${p.sku} (${num(p.units)} × ${p.currency})`));
      break;
    case 'study':
      answer = t(`درس النهارده: «${s.lessonTitle}». افتح تبويب «المنهج والتدريب»، اقرأ الدرس وجاوب سؤاله — النتيجة بتتحفظ في تقرير مدير المبيعات.`,
        `Today’s lesson: “${s.lessonTitle}”. Open the curriculum tab, read it and answer its question — the result is saved in the sales manager’s report.`);
      break;
    case 'health':
      answer = !s.live ? notRead : t(`صحة المبيعات ${num(s.health.score)}/١٠٠ — ${s.health.labelAr}.\n${s.health.driversAr.map((d) => `• ${d}`).join('\n')}`,
        `Sales health ${num(s.health.score)}/100 — ${s.health.labelAr}.\n${s.health.driversAr.map((d) => `• ${d}`).join('\n')}`);
      break;
    case 'loss': {
      if (!s.live) { answer = notRead; break; }
      const reasons = s.pipeline.lostReasons;
      const unreasoned = s.pipeline.lostWithoutReason;
      if (!reasons.length && !unreasoned) {
        answer = t('مفيش خسائر مسجلة لسه. أول ما تقفل فرصة بسبب، اكتب السبب بكلامك — ده اللي بيوريك النمط الحقيقي بدل التخمين.', 'No losses recorded yet. When you close an opportunity as lost, write the reason in your own words — that shows the real pattern instead of a guess.');
        break;
      }
      const lines = reasons.map((r) => `• ${r.reason} — ${num(r.count)} ${r.count === 1 ? t('مرة', 'time') : t('مرات', 'times')}`);
      if (unreasoned) lines.push(t(`• ${num(unreasoned)} خسارة من غير سبب مسجل — فجوة، ومش هنسميها سبب من عندنا.`, `• ${num(unreasoned)} losses with no recorded reason — a gap, and no cause is invented for them.`));
      answer = [t('أسباب الخسارة اللي إنت كتبتها:', 'The lost reasons you recorded:'), ...lines, '', t(`نسبة الكسب ${s.pipeline.winRate === null ? 'لسه مفيش مقفول' : `${s.pipeline.winRate}%`} من ${num(s.pipeline.closedCount)} فرصة مقفولة. اختار سبب واحد تصلحه الأسبوع الجاي.`,
        `Win rate ${s.pipeline.winRate === null ? 'not known yet' : `${s.pipeline.winRate}%`} of ${num(s.pipeline.closedCount)} closed opportunities. Pick one cause to fix next week.`)].join('\n');
      break;
    }
    case 'week': {
      if (!s.live) { answer = notRead; break; }
      const week = s.week || [];
      if (!week.length) { answer = t('مفيش تحصيل مؤكد في الأسبوع ده ولا اللي فات، فمفيش مقارنة أقولها من غير اختراع.', 'No confirmed collections this week or last week, so there is no comparison to report without inventing one.'); break; }
      answer = [t('الأسبوع ده مقابل اللي فات (تحصيل مؤكد من بنك شام):', 'This week against last week (confirmed Sham Bank collections):'),
        ...week.map((r) => r.changePercent === null
          ? t(`• ${r.currency}: ${fmt(r.thisWeekMinor, r.currency)} من ${num(r.thisOrders)} طلب — مفيش رقم باعث الأسبوع اللي فات (${num(r.lastOrders)} طلب)، فمفيش نسبة.`, `• ${r.currency}: ${fmt(r.thisWeekMinor, r.currency)} from ${num(r.thisOrders)} orders — last week had nothing to compare (${num(r.lastOrders)} orders), so no percentage.`)
          : t(`• ${r.currency}: ${fmt(r.thisWeekMinor, r.currency)} من ${num(r.thisOrders)} طلب مقابل ${fmt(r.lastWeekMinor, r.currency)} (${r.changePercent >= 0 ? '+' : ''}${r.changePercent}%).`, `• ${r.currency}: ${fmt(r.thisWeekMinor, r.currency)} from ${num(r.thisOrders)} orders versus ${fmt(r.lastWeekMinor, r.currency)} (${r.changePercent >= 0 ? '+' : ''}${r.changePercent}%).`)),
        '', t('المراجعة الكاملة وحركة واحدة للأسبوع الجاي في تبويب «المراجعة».', 'The full review and next week’s one move are in the Review tab.')].join('\n');
      break;
    }
    default:
      answer = ar ? HELP_AR : HELP_EN;
  }
  return { topic, answer };
}
