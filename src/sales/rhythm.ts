/**
 * «إيقاع اليوم» — the sales desk's daily to-do list, built from real figures only.
 *
 * It never invents an activity score: every task points to something that exists in the bank, the pipeline
 * or the target, and carries where to go to do it. Money tasks come first (a transfer waiting for the
 * owner's eyes is not a sale yet), then follow-ups, then the gap to the target, then the daily lesson.
 * If the live desk was not read, the list says so instead of pretending the day is clean.
 */
import { major } from '../finance/money';
import { SILENT_AFTER_DAYS, dealActions, silentDeals, type DealAction, type Deal } from './pipeline';
import type { CollectedRow, TargetPace } from './targets';

export type TaskPriority = 'now' | 'today' | 'week';
export type TaskLink = 'bank' | 'pipeline' | 'targets' | 'store' | 'study' | 'insights';

export interface SalesTask {
  id: string;
  priority: TaskPriority;
  titleAr: string;
  titleEn: string;
  whyAr: string;
  whyEn: string;
  link: TaskLink;
  /** The deal this task belongs to, when it is a follow-up. */
  dealId?: string;
}

/** The aggregated, privacy-safe picture the desk needs (no names, phones, e-mails or order references). */
export interface SalesLive {
  today: CollectedRow[];
  month: CollectedRow[];
  waitingConfirmation: number;
  awaitingTransfer: number;
  bestSellers: { sku: string; units: number; currency: string }[];
  countries?: { country: string; paidOrders: number }[];
}

export interface RhythmInput {
  now: number;
  /** null = the live desk was not read (no token, server down): the list must say so. */
  live: SalesLive | null;
  deals: readonly Deal[];
  targets: readonly TargetPace[];
  lessonTitleAr?: string;
}

const fmt = (minor: number, currency: string) => {
  try { return new Intl.NumberFormat('ar-EG', { style: 'currency', currency, maximumFractionDigits: 2 }).format(major(minor, currency)); }
  catch { return `${minor} ${currency}`; }
};

export function dailyRhythm(input: RhythmInput): SalesTask[] {
  const tasks: SalesTask[] = [];
  const { live } = input;
  if (!live) {
    tasks.push({
      id: 'live-not-read', priority: 'now', link: 'insights',
      titleAr: 'افتح لوحة المبيعات — أرقام اليوم لم تُقرأ',
      titleEn: 'Open the sales desk — today’s figures were not read',
      whyAr: 'مفيش اتصال بأرقام بنك شام دلوقتي، فمفيش قائمة مبنية على أرقام حقيقية. مش هنخترع يوم هادي.',
      whyEn: 'The bank figures could not be read, so there is no list built on real numbers. A quiet day is never invented.',
    });
  } else {
    if (live.waitingConfirmation > 0) {
      tasks.push({
        id: 'confirm-transfers', priority: 'now', link: 'bank',
        titleAr: `أكّد ${live.waitingConfirmation} تحويل في بنك شام`,
        titleEn: `Confirm ${live.waitingConfirmation} transfer${live.waitingConfirmation === 1 ? '' : 's'} in Sham Bank`,
        whyAr: 'العميل قال إنه حوّل. افتح حسابك أو إنستاباي، شوف الفلوس بنفسك، وبعدها بس أكّد — التأكيد من غير رؤية المبلغ ممنوع.',
        whyEn: 'The buyer says the money was sent. Check your account or InstaPay yourself and only then confirm — never confirm without seeing it.',
      });
    }
    if (live.awaitingTransfer > 0) {
      tasks.push({
        id: 'awaiting-transfer', priority: 'today', link: 'bank',
        titleAr: `${live.awaitingTransfer} طلب محجوز مستني التحويل`,
        titleEn: `${live.awaitingTransfer} reserved order${live.awaitingTransfer === 1 ? '' : 's'} awaiting payment`,
        whyAr: 'ابعت تعليمات الدفع مرة واحدة بلطف، ولو العميل سأل رد بالتفاصيل. ممنوع استعجال مزيف أو «فاضل قطعتين».',
        whyEn: 'Send the payment instructions once, kindly; answer questions with details. No fake urgency or “only two left”.',
      });
    }
  }

  const actions: DealAction[] = dealActions(input.deals, input.now, 'Africa/Cairo', 3);
  for (const action of actions) {
    const label = action.deal.title;
    tasks.push({
      id: `deal-${action.deal.id}`, priority: 'today', link: 'pipeline', dealId: action.deal.id,
      titleAr: action.state === 'overdue' ? `تابع «${label}» — متأخر ${action.lateDays} يوم` : action.state === 'today' ? `خطوة «${label}» مستحقة النهارده` : `حدّد خطوة جاية لـ«${label}»`,
      titleEn: action.state === 'overdue' ? `Follow up “${label}” — ${action.lateDays} day${action.lateDays === 1 ? '' : 's'} late` : action.state === 'today' ? `Next step for “${label}” is due today` : `Give “${label}” a next step`,
      whyAr: action.whyAr, whyEn: 'A pipeline only moves on the next step written down, not on good intentions.',
    });
  }
  const noNext = input.deals.filter((d) => (d.stage !== 'won' && d.stage !== 'lost') && !d.nextActionAt).length;
  if (noNext > actions.filter((a) => a.state === 'idle').length) {
    tasks.push({
      id: 'pipeline-idle', priority: 'today', link: 'pipeline',
      titleAr: `${noNext} فرصة من غير خطوة جاية`,
      titleEn: `${noNext} opportunities with no next step`,
      whyAr: 'اختر لكل واحدة تاريخ وإجراء واحد واضح. الفرصة اللي مالهاش خطوة بتنسى.',
      whyEn: 'Give each one a date and one clear action. An opportunity with no step is forgotten.',
    });
  }

  // «الفرص الساكتة»: not late yet, but nothing moved on them for a week while their next step is still far.
  const silent = silentDeals(input.deals, input.now, 'Africa/Cairo', SILENT_AFTER_DAYS, Math.max(1, input.deals.length));
  const silentCount = silent.length;
  if (silent.length) {
    const first = silent[0];
    tasks.push({
      id: 'deals-silent', priority: 'today', link: 'pipeline',
      titleAr: `${silentCount} فرصة ساكتة — أقدمها «${first.deal.title}» من ${first.silentDays} يوم`,
      titleEn: `${silentCount} quiet opportunit${silentCount === 1 ? 'y' : 'ies'} — oldest “${first.deal.title}” untouched for ${first.silentDays} days`,
      whyAr: 'خطوتها الجاية لسه بعيدة، بس مفيش أي حركة عليها من أكتر من أسبوع. لمستها واحدة بقيمة حقيقية النهارده أحسن من استنى الميعاد.',
      whyEn: 'Their next step is still ahead, but nothing has moved for over a week. One useful touch today beats waiting for the date.',
    });
  }

  const behind = input.targets.filter((t) => t.targetMinor > 0 && (t.pace === 'behind' || t.pace === 'on') && t.daysLeft > 0);
  if (!input.targets.some((t) => t.targetMinor > 0)) {
    tasks.push({
      id: 'target-missing', priority: 'today', link: 'targets',
      titleAr: 'حدّد هدف الشهر',
      titleEn: 'Set this month’s target',
      whyAr: 'من غير رقم مستهدف، الشغل اليومي مش بيتقاس ومش بيتحسن.',
      whyEn: 'Without a target number, daily work cannot be measured or improved.',
    });
  } else for (const target of behind.slice(0, 2)) {
    tasks.push({
      id: `target-${target.currency}`, priority: target.pace === 'behind' ? 'today' : 'week', link: 'targets',
      titleAr: `محتاج ${fmt(target.neededPerDayMinor ?? target.gapMinor, target.currency)} في اليوم للهدف`,
      titleEn: `Need ${fmt(target.neededPerDayMinor ?? target.gapMinor, target.currency)} a day to reach the target`,
      whyAr: `فاضل ${fmt(target.gapMinor, target.currency)} في ${target.daysLeft} يوم. الرقم من التحصيل المؤكد في بنك شام، والتوقع تقدير مش وعد.`,
      whyEn: `Remaining: ${fmt(target.gapMinor, target.currency)} over ${target.daysLeft} days. The figure is confirmed ledger collections; the projection is an estimate, not a promise.`,
    });
  }

  if (live?.bestSellers.length) {
    const top = live.bestSellers[0];
    tasks.push({
      id: `stock-${top.sku}`, priority: 'week', link: 'store',
      titleAr: `راجع مخزون الأكثر مبيعاً: ${top.sku}`,
      titleEn: `Check stock of the best seller: ${top.sku}`,
      whyAr: 'اللي بيتبيع بسرعة ماينفعش يخلص من غير تنبيه — الطلب الحقيقي هو اللي يحدد إعادة التوريد.',
      whyEn: 'A fast seller must not run out unnoticed — real demand decides reordering.',
    });
  }

  if (input.lessonTitleAr) {
    tasks.push({
      id: 'study-today', priority: 'week', link: 'study',
      titleAr: `درس النهارده: ${input.lessonTitleAr}`,
      titleEn: `Today’s lesson: ${input.lessonTitleAr}`,
      whyAr: 'مدير المبيعات بيذاكر كتيب المنصة ومنهج البيع كل يوم — الدرس بيتبني من الكتيب نفسه مش من كلام عام.',
      whyEn: 'The sales manager studies the platform handbook and the selling curriculum daily — the lesson is built from the handbook itself.',
    });
  }

  const RANK: Record<TaskPriority, number> = { now: 0, today: 1, week: 2 };
  return tasks.sort((a, b) => RANK[a.priority] - RANK[b.priority]).slice(0, 12);
}
