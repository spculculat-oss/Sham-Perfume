/**
 * «شاهين المحاسب» — answers the owner's money questions («كسبنا كام الشهر ده؟») from the bank's real figures.
 * Deterministic: it reads numbers the ledger already computed and never invents, rounds away or predicts beyond
 * the labelled forecast. Unknown questions get the list of what it can answer, not a guess.
 */
import { major } from './money';
import type { Ageing, BudgetUse, CountryRow, Forecast, ProductRow } from './bankTools';

export interface CurrencyFigures { currency: string; collectedMinor: number; refundsMinor: number; expensesMinor: number; recordedResultMinor: number; netProfitMinor: number | null; paidOrders: number }
export interface AccountantSnapshot {
  today: CurrencyFigures[]; month: CurrencyFigures[];
  products: ProductRow[]; countries: CountryRow[]; budgets: BudgetUse[]; ageing: Ageing[]; forecast: Forecast[];
  waitingConfirmation: number; awaitingTransfer: number;
}
export type AccountantTopic = 'profit' | 'sales' | 'expenses' | 'products' | 'countries' | 'pending' | 'payables' | 'forecast' | 'budget' | 'help';
const TOPICS: [AccountantTopic, RegExp][] = [
  ['pending', /مستني|منتظر|بانتظار|تأكيد|تحويلات|إيصال|ايصال|pending|waiting|confirm|transfers?/i],
  ['payables', /مستحق|علينا|موردين|مورد|ديون|فواتير|سداد|payable|bills?|owe|suppliers?/i],
  ['forecast', /سيول|توقع|الجاي|القادم|هيكون معانا|forecast|cash ?flow|next month/i],
  ['budget', /ميزاني|budget/i],
  ['products', /منتج|برفان|عطر|أكثر مبيع|اكتر مبيع|أكتر|اكتر|product|best.?sell|top/i],
  ['countries', /دول|بلد|country|countries/i],
  ['expenses', /مصاريف|مصروف|صرفنا|صرف|تكالي|expens|spend|spent|costs?/i],
  ['profit', /ربح|أرباح|ارباح|كسب|كسبنا|مكسب|صافي|خسار|profit|earn|net|loss/i],
  ['sales', /مبيع|بيع|بعنا|دخل|حصل|تحصيل|إيراد|ايراد|sales?|revenue|collected|income/i],
];
export function topicOf(question: string): AccountantTopic {
  return TOPICS.find(([, re]) => re.test(question))?.[0] || 'help';
}

export function answerFinance(question: string, s: AccountantSnapshot, lang: 'ar' | 'en' = /[\u0600-\u06FF]/.test(question) ? 'ar' : 'en'): { topic: AccountantTopic; answer: string } {
  const ar = lang === 'ar';
  const t = (a: string, e: string) => (ar ? a : e);
  const fmt = (minor: number, currency: string) => {
    try { return new Intl.NumberFormat(ar ? 'ar-EG' : 'en-GB', { style: 'currency', currency, maximumFractionDigits: 2 }).format(major(minor, currency)); }
    catch { return `${minor} ${currency}`; }
  };
  const num = (n: number) => new Intl.NumberFormat(ar ? 'ar-EG' : 'en-GB').format(n);
  const list = (items: string[]) => items.join(ar ? '، ' : ', ');
  const topic = topicOf(question);
  const none = t('لسه مفيش قيود حقيقية في الفترة دي، فمفيش رقم أقوله من غير تخمين.', 'There are no real entries for this period yet, so there is no figure to report without guessing.');
  let answer: string;
  switch (topic) {
    case 'profit':
      answer = !s.month.length ? none : s.month.map((c) => c.netProfitMinor !== null
        ? t(`صافي ربح الشهر ده: ${fmt(c.netProfitMinor, c.currency)} (التقرير مراجَع ومكتمل).`, `Net profit this month: ${fmt(c.netProfitMinor, c.currency)} (reviewed and complete).`)
        : t(`ناتج القيود المسجلة الشهر ده: ${fmt(c.recordedResultMinor, c.currency)}. ده مؤشر مبدئي مش صافي ربح، لأن في تكاليف ناقصة أو المصروفات لسه متراجعتش.`, `Recorded result this month: ${fmt(c.recordedResultMinor, c.currency)}. This is preliminary, not net profit: some costs are missing or expenses are not reviewed yet.`)).join('\n');
      break;
    case 'sales':
      answer = !s.month.length ? none : [
        ...s.today.map((c) => t(`النهارده: ${fmt(c.collectedMinor, c.currency)} من ${num(c.paidOrders)} طلب مدفوع.`, `Today: ${fmt(c.collectedMinor, c.currency)} from ${num(c.paidOrders)} paid orders.`)),
        ...s.month.map((c) => t(`الشهر ده: ${fmt(c.collectedMinor, c.currency)} من ${num(c.paidOrders)} طلب، والمرتجعات ${fmt(c.refundsMinor, c.currency)}.`, `This month: ${fmt(c.collectedMinor, c.currency)} from ${num(c.paidOrders)} orders; refunds ${fmt(c.refundsMinor, c.currency)}.`)),
      ].join('\n');
      break;
    case 'expenses': {
      const lines = s.month.filter((c) => c.expensesMinor).map((c) => t(`المصروفات العامة الشهر ده: ${fmt(c.expensesMinor, c.currency)}.`, `Operating expenses this month: ${fmt(c.expensesMinor, c.currency)}.`));
      const over = s.budgets.filter((b) => b.state === 'over' || b.state === 'warning');
      if (over.length) lines.push(t(`انتبه: ${list(over.map((b) => `${b.category} ${b.percent}%`))} من الميزانية.`, `Watch: ${list(over.map((b) => `${b.category} ${b.percent}%`))} of budget.`));
      answer = lines.length ? lines.join('\n') : t('مفيش مصروفات عامة متسجلة الشهر ده.', 'No operating expenses recorded this month.');
      break;
    }
    case 'products':
      answer = !s.products.length ? t('لسه مفيش منتجات اتباعت ودفعها اتأكد.', 'No product sales confirmed yet.')
        : t('الأكتر مبيعاً: ', 'Best sellers: ') + list(s.products.slice(0, 3).map((p) => `${p.sku} (${num(p.units)} × ${fmt(p.revenueMinor, p.currency)})`));
      break;
    case 'countries':
      answer = !s.countries.length ? t('لسه مفيش طلبات مدفوعة نقارن بيها الدول.', 'No paid orders to compare countries yet.')
        : t('أعلى الدول تحصيلاً: ', 'Top countries by collections: ') + list(s.countries.slice(0, 3).map((c) => `${c.country} ${fmt(c.collectedMinor, c.currency)}`));
      break;
    case 'pending':
      answer = t(`${num(s.waitingConfirmation)} طلب العميل بلّغ إنه حوّل ومستني تأكيدك، و${num(s.awaitingTransfer)} طلب محجوز لسه مستني التحويل. أكّد بس بعد ما تشوف الفلوس في حسابك.`,
        `${num(s.waitingConfirmation)} orders report a transfer and wait for your confirmation; ${num(s.awaitingTransfer)} reserved orders still wait for payment. Confirm only after you see the money in your account.`);
      break;
    case 'payables':
      answer = !s.ageing.length ? t('مفيش فواتير مستحقة مفتوحة.', 'No open bills.') : s.ageing.map((a) => t(
        `متأخر: ${fmt(a.overdueMinor, a.currency)} (${num(a.overdue)} فاتورة) · خلال أسبوع: ${fmt(a.dueWeekMinor, a.currency)} · خلال شهر: ${fmt(a.dueMonthMinor, a.currency)}.`,
        `Overdue: ${fmt(a.overdueMinor, a.currency)} (${num(a.overdue)} bills) · within a week: ${fmt(a.dueWeekMinor, a.currency)} · within a month: ${fmt(a.dueMonthMinor, a.currency)}.`)).join('\n');
      break;
    case 'forecast':
      answer = !s.forecast.length ? none : s.forecast.map((f) => t(
        `تقدير الـ٣٠ يوم الجايين: صافي ${fmt(f.projectedNetMinor, f.currency)}، وبعد سداد المستحقات ${fmt(f.projectedAfterPayablesMinor, f.currency)}. (تقدير من متوسط آخر ${num(f.basisDays)} يوم${f.confidence === 'low' ? '، والبيانات لسه قليلة' : ''}.)`,
        `Next 30 days estimate: net ${fmt(f.projectedNetMinor, f.currency)}, after bills ${fmt(f.projectedAfterPayablesMinor, f.currency)}. (Average of the last ${num(f.basisDays)} days${f.confidence === 'low' ? '; little data so far' : ''}.)`)).join('\n');
      break;
    case 'budget':
      answer = !s.budgets.length ? t('لسه محددتش ميزانيات. حددها من تبويب الميزانيات.', 'No budgets set yet. Add them in the Budgets tab.')
        : s.budgets.map((b) => b.monthlyMinor === null ? t(`${b.category}: صرفنا ${fmt(b.spentMinor, b.currency)} من غير ميزانية.`, `${b.category}: spent ${fmt(b.spentMinor, b.currency)} without a budget.`)
          : t(`${b.category}: ${fmt(b.spentMinor, b.currency)} من ${fmt(b.monthlyMinor, b.currency)} (${b.percent}%).`, `${b.category}: ${fmt(b.spentMinor, b.currency)} of ${fmt(b.monthlyMinor, b.currency)} (${b.percent}%).`)).join('\n');
      break;
    default:
      answer = t('أقدر أجاوبك عن: الربح، المبيعات، المصروفات، أكتر منتج بيتباع، أحسن الدول، التحويلات المستنية تأكيد، المستحقات علينا، السيولة المتوقعة، والميزانيات.',
        'I can answer about: profit, sales, expenses, best sellers, top countries, transfers waiting for confirmation, bills we owe, the cash forecast and budgets.');
  }
  return { topic, answer };
}
