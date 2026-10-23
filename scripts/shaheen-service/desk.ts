/**
 * «مكتب خدمة العملاء الآلي» — the pure brain of the customer-care robot
 * (`.github/workflows/shaheen-service.yml`, `scripts/shaheen-service/run.mts`):
 *
 *   - audits the support knowledge the site already publishes (`STORE_PLAYBOOK` and the real shipping table),
 *   - reads the live service desk (waiting handoffs, open requests, knowledge gaps, recent ratings) through the
 *     admin API — **aggregated only**: no name, phone, e-mail, order reference, address or message text ever
 *     leaves the server or reaches this file,
 *   - prepares ready replies from the published knowledge (no invented facts, no promises, no discounts),
 *   - writes `src/data/live/shaheen-service.json` for «الفحص الشامل» and the control centre.
 *
 * The robot never sends a message and never changes an order: it prepares the queue and the replies for a human.
 * Pure (no network, no Node): `tests/shaheenService.test.ts` drives it with fixtures.
 */
import { SHIPPING } from '../../src/utils/pricing';
import { STORE_PLAYBOOK } from '../../server/core/storeGuide';

/** The support topics a visitor may need; each one must stay published in the store playbook. */
export const SERVICE_REQUIRED_TOPICS = [
  { id: 'kb-store-buying', whyAr: 'طريقة الشراء وإتمام الطلب' },
  { id: 'kb-store-payment', whyAr: 'وسائل الدفع والأمان' },
  { id: 'kb-store-shipping-guide', whyAr: 'الشحن والتوصيل والتغليف' },
  { id: 'kb-store-tracking', whyAr: 'تتبع الطلب وحالاته' },
  { id: 'kb-store-returns-guide', whyAr: 'الإرجاع والاستبدال والاسترداد' },
  { id: 'kb-store-product-facts', whyAr: 'الأسعار والمخزون والبدائل' },
] as const;

/** A waiting conversation is late after this many hours; an open request after this many. */
export const HANDOFF_SLA_HOURS = 6;
export const REQUEST_SLA_HOURS = 24;
/** Ratings considered «recent» in the report. */
export const FEEDBACK_WINDOW_HOURS = 24;

export type ServicePriority = 'urgent' | 'high' | 'normal';
export interface ServiceQueueItem { priority: ServicePriority; textAr: string }
export interface ServiceTemplate { topic: string; titleAr: string; whenAr: string; replyAr: string }

export interface ServiceKnowledge {
  coverage: number;
  topics: string[];
  missing: string[];
  thin: string[];
  shippingZones: number;
  zonesWithoutDays: string[];
}

export interface ServiceInbox {
  /** null = the live desk could not be read, so the number is unknown — never shown as a zero. */
  openHandoffs: number | null;
  oldestHandoffHours: number | null;
  newRequests: number | null;
  unresolvedRequests: number | null;
  oldestUnresolvedHours: number | null;
  negativeFeedback24h: number | null;
  openGaps: number | null;
  topGapCount: number | null;
}

export interface ServiceLive {
  checked: boolean;
  at?: string;
  /** Safe codes only (`NO_ADMIN_TOKEN`, `HTTP_401`, `TIMEOUT`, …), never a body or a stack. */
  failed: string[];
}

export interface ServiceDeskFile {
  version: 1;
  updatedAt: string;
  desk: { nameAr: string; nameEn: string; modeAr: string };
  live: ServiceLive;
  inbox: ServiceInbox;
  knowledge: ServiceKnowledge;
  templates: ServiceTemplate[];
  queue: ServiceQueueItem[];
  problems: string[];
  fixes: string[];
  ideas: string[];
  summaryAr: string;
  nextAr: string[];
}

export interface ServiceDeskInput {
  now: number;
  live: ServiceLive;
  overview?: Record<string, unknown>;
  requests?: Record<string, unknown>[];
  conversations?: Record<string, unknown>[];
  gaps?: Record<string, unknown>[];
  feedback?: Record<string, unknown>[];
}

const o = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? v as Record<string, unknown> : {});
const n = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const round1 = (value: number) => Math.round(value * 10) / 10;
const isoAgeHours = (value: unknown, now: number): number | undefined => {
  const at = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(at) ? Math.max(0, round1((now - at) / 3_600_000)) : undefined;
};

/** The real shipping table has a stated delivery window for every zone; a missing one is a support gap. */
function zonesWithoutDays(): string[] {
  return [...SHIPPING.zones, SHIPPING.default].filter((zone) => !zone.days).map((zone) => zone.id);
}

/** Is every support answer the visitors need published, complete in both languages, and tagged for search? */
export function serviceKnowledge(): ServiceKnowledge {
  const published = new Map(STORE_PLAYBOOK.map((topic) => [topic.id, topic]));
  const missing = SERVICE_REQUIRED_TOPICS.filter((topic) => !published.has(topic.id)).map((topic) => topic.id);
  const thin = SERVICE_REQUIRED_TOPICS.filter((topic) => {
    const doc = published.get(topic.id);
    if (!doc) return false;
    return doc.body.ar.trim().length < 80
      || doc.body.en.trim().length < 60
      || !doc.title.ar.trim()
      || !doc.title.en.trim()
      || doc.tags.length < 3;
  }).map((topic) => topic.id);
  const coverage = Math.round((100 * (SERVICE_REQUIRED_TOPICS.length - missing.length)) / SERVICE_REQUIRED_TOPICS.length);
  return {
    coverage,
    topics: STORE_PLAYBOOK.map((topic) => topic.id),
    missing,
    thin,
    shippingZones: SHIPPING.zones.length + 1,
    zonesWithoutDays: zonesWithoutDays(),
  };
}

const QUESTION_TAIL = 'لو محتاج متابعة، ابعت رقم الطلب (بيبدأ بـ SH-) وفريق شام هيكمّل معاك.';

/**
 * Ready replies: the published answer itself (the same text the assistant quotes), plus one neutral closing line
 * so a human can send it as is. No new fact, price, discount or delivery promise is added.
 */
export function serviceTemplates(): ServiceTemplate[] {
  const pick = (id: string, whenAr: string, tail: string): ServiceTemplate | undefined => {
    const doc = STORE_PLAYBOOK.find((topic) => topic.id === id);
    if (!doc) return undefined;
    return { topic: doc.id, titleAr: doc.title.ar, whenAr, replyAr: `أهلاً بيك في شام. ${doc.body.ar} ${tail}`.trim() };
  };
  return [
    pick('kb-store-tracking', 'الزائر بيسأل «فين طلبي؟» أو بيدّي رقم SH-', QUESTION_TAIL),
    pick('kb-store-shipping-guide', 'سؤال عن الشحن أو التوصيل أو الجمارك أو منتج وصل تالف', 'لو الطلب وصل تالف، صوّره وابعت الصورة هنا وفريق شام هيتابع معاك.'),
    pick('kb-store-returns-guide', 'طلب إرجاع أو استبدال أو استرداد', QUESTION_TAIL),
    pick('kb-store-payment', 'سؤال عن الدفع أو إنستاباي أو التحويل أو البطاقة', 'لو وسيلة الدفع اللي عايزها مش ظاهرة في صفحة الدفع، قولّي بلدك وأنا أوضح المتاح.'),
    pick('kb-store-product-facts', 'المنتج اللي طلبه نفد أو سأل عن بديل', 'قولّي العائلة العطرية أو الماركة أو الميزانية وأنا أرشح لك المتوفر.'),
    pick('kb-store-buying', 'سؤال عن طريقة الشراء أو إتمام الطلب أو رقم الطلب', QUESTION_TAIL),
  ].filter((template): template is ServiceTemplate => Boolean(template));
}

const UNRESOLVED = new Set(['new', 'in_progress', 'quoted']);
const SOLD = new Set(['confirmed', 'completed']);

/** The last day's ratings, by fixed categories — never the visitor's words. */
export function feedbackCategories(feedback: Record<string, unknown>[], now: number): { down24: number; categories: { id: string; count: number }[] } {
  const down = feedback.filter((item) => {
    const age = isoAgeHours(item.at, now);
    return item.rating === 'down' && age !== undefined && age <= FEEDBACK_WINDOW_HOURS;
  });
  const MATCHERS: { id: string; re: RegExp }[] = [
    { id: 'delivery', re: /شحن|توصيل|متأخر|وصل|deliver|shipping|late|arrive/i },
    { id: 'product', re: /منتج|ريحة|عطر|تالف|مكسور|product|scent|damaged|broken/i },
    { id: 'payment', re: /دفع|فلوس|تحويل|استرداد|payment|refund|money|transfer/i },
    { id: 'price', re: /سعر|غالي|خصم|عرض|price|expensive|discount|offer/i },
  ];
  const tally = new Map<string, number>();
  for (const item of down) {
    const reason = typeof item.reason === 'string' ? item.reason : '';
    const match = MATCHERS.find((m) => m.re.test(reason));
    const id = match?.id || 'other';
    tally.set(id, (tally.get(id) || 0) + 1);
  }
  return { down24: down.length, categories: [...tally.entries()].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count) };
}

/** One row of the desk. Nothing personal is copied: only statuses, ages and aggregate counts. */
export function serviceInbox(input: ServiceDeskInput): ServiceInbox {
  const { now, live, overview, requests, conversations, gaps, feedback } = input;
  const counts = o(overview?.counts);
  const conv = (conversations || []).map(o);
  const req = (requests || []).map(o);
  const openGaps = (gaps || []).map(o).filter((gap) => gap.status === 'open');
  const openHandoffs = conversations ? conv.filter((item) => item.status === 'handoff') : undefined;
  const handoffAges = (openHandoffs || []).map((item) => isoAgeHours(item.updatedAt, now)).filter((age): age is number => age !== undefined);
  const unresolved = requests ? req.filter((item) => UNRESOLVED.has(String(item.status))) : undefined;
  const unresolvedAges = (unresolved || []).map((item) => isoAgeHours(item.createdAt, now)).filter((age): age is number => age !== undefined);
  const newRequests = requests ? req.filter((item) => item.status === 'new').length : undefined;
  const liveReadable = live.checked || live.failed.length === 0;
  return {
    openHandoffs: openHandoffs ? openHandoffs.length : liveReadable ? n(counts.handoffsOpen) ?? null : null,
    oldestHandoffHours: handoffAges.length ? Math.max(...handoffAges) : openHandoffs?.length ? null : null,
    newRequests: newRequests ?? (liveReadable ? n(counts.requestsNew) ?? null : null),
    unresolvedRequests: unresolved ? unresolved.length : null,
    oldestUnresolvedHours: unresolvedAges.length ? Math.max(...unresolvedAges) : null,
    negativeFeedback24h: feedback ? feedbackCategories(feedback.map(o), now).down24 : null,
    openGaps: gaps ? openGaps.length : liveReadable ? n(counts.gapsOpen) ?? null : null,
    topGapCount: openGaps.length ? Math.max(...openGaps.map((gap) => n(gap.count) ?? 1)) : null,
  };
}

const fmt = (value: number | null | undefined, unit = '') => (value === null || value === undefined ? 'غير معروف' : `${Math.round(value)}${unit}`);

/** The whole report: knowledge audit + (when readable) the live desk + prepared replies + the next actions. */
export function buildServiceDesk(input: ServiceDeskInput): ServiceDeskFile {
  const { now, live } = input;
  const knowledge = serviceKnowledge();
  const inbox = serviceInbox(input);
  const templates = serviceTemplates();
  const problems: string[] = [];
  const fixes: string[] = [];
  const ideas: string[] = [];
  const queue: ServiceQueueItem[] = [];

  if (!live.checked) {
    problems.push(`مكتب الدعم لسه ما قراش الحساب الحي${live.failed.length ? ` (${live.failed.join('، ')})` : ''} — الأرقام الحية غير معروفة`);
    fixes.push('راجع SHAM_ADMIN_TOKEN ومسار الخدمة ثم شغّل روبوت خدمة العملاء');
  }
  if (live.checked && live.failed.length) {
    problems.push(`جزء من الحساب الحي ما اتقراش (${live.failed.join('، ')})`);
    fixes.push('راجع نقاط الإدارة المذكورة؛ الأرقام الناقصة مش متخمنة');
  }

  if (knowledge.missing.length) {
    problems.push(`معلومات دعم ناقصة: ${knowledge.missing.join('، ')}`);
    fixes.push('أكمل محاور الدعم الستة في دليل المتجر قبل أي حملة');
  }
  if (knowledge.thin.length) {
    problems.push(`أجوبة دعم مختصرة أو بدون ترجمة/كلمات بحث: ${knowledge.thin.join('، ')}`);
    fixes.push('اكتب الجواب كامل بالعربي والإنجليزي مع كلمات البحث');
  }
  if (knowledge.zonesWithoutDays.length) {
    ideas.push(`مناطق شحن بدون مدة توصيل معلنة: ${knowledge.zonesWithoutDays.join('، ')} — الزائر لازم يعرف المدة قبل الدفع`);
  }

  if ((inbox.openHandoffs ?? 0) > 0) {
    const urgent = (inbox.oldestHandoffHours ?? 0) >= HANDOFF_SLA_HOURS;
    queue.push({
      priority: urgent ? 'urgent' : 'high',
      textAr: `${inbox.openHandoffs} محادثة مستنية موظف${inbox.oldestHandoffHours !== null ? ` (أقدمها ${fmt(inbox.oldestHandoffHours)} ساعة)` : ''} — راجعها من لوحة المحادثات`,
    });
    if (urgent) {
      problems.push(`${inbox.openHandoffs} محادثة مستنية موظف وأقدمها ${fmt(inbox.oldestHandoffHours)} ساعة (الحد ${HANDOFF_SLA_HOURS} ساعات)`);
      fixes.push('ردّ على المحادثات المستنية من لوحة المحادثات؛ الردود الجاهزة في التقرير');
    }
  }
  if ((inbox.newRequests ?? 0) > 0) {
    queue.push({ priority: 'high', textAr: `${inbox.newRequests} طلب جديد لسه ما اتفتحش — راجعه من الطلبات` });
  }
  if ((inbox.unresolvedRequests ?? 0) > 0 && (inbox.oldestUnresolvedHours ?? 0) >= REQUEST_SLA_HOURS) {
    problems.push(`${inbox.unresolvedRequests} طلب مفتوح وأقدمهم ${fmt(inbox.oldestUnresolvedHours)} ساعة (الحد ${REQUEST_SLA_HOURS} ساعة)`);
    fixes.push('راجع الطلبات المفتوحة وحدّث حالتها بالرد الحقيقي');
    queue.push({ priority: 'high', textAr: `${inbox.unresolvedRequests} طلب مفتوح — أقدمهم ${fmt(inbox.oldestUnresolvedHours)} ساعة` });
  }
  if ((inbox.openGaps ?? 0) > 0) {
    queue.push({ priority: 'normal', textAr: `${inbox.openGaps} سؤال الزوار مالقاش إجابة موثقة${inbox.topGapCount && inbox.topGapCount > 1 ? ` (اتكرر ${inbox.topGapCount} مرة)` : ''} — يتحول لدرس` });
    ideas.push('الأسئلة المفتوحة تتحول لدروس في مدرسة شاهين وتدخل الشات بعد المراجعة');
  }
  if ((inbox.negativeFeedback24h ?? 0) > 0) {
    const categories = feedbackCategories((input.feedback || []).map(o), now).categories;
    const split = categories.length ? ` (${categories.map((c) => `${c.id} ${c.count}`).join('، ')})` : '';
    queue.push({ priority: 'normal', textAr: `${inbox.negativeFeedback24h} تقييم سلبي آخر ${FEEDBACK_WINDOW_HOURS} ساعة${split}` });
    if ((inbox.negativeFeedback24h ?? 0) >= 3) problems.push(`${inbox.negativeFeedback24h} تقييم سلبي في آخر ${FEEDBACK_WINDOW_HOURS} ساعة`);
    ideas.push('راجع الردود اللي اتقيّمت سلباً وحسّن الجواب الموثق');
  }
  if (knowledge.coverage === 100 && !problems.length) ideas.push('معلومات الدعم مكتملة — دُرّب عليها قوالب الشات والردود السريعة');

  const modeAr = live.checked ? 'متصل بالحساب الحي — أرقام حقيقية بس' : 'دليل الدعم من الموقع — الأرقام الحية مش متاحة';
  const summaryAr = live.checked
    ? `مكتب خدمة العملاء: ${fmt(inbox.openHandoffs)} محادثة مستنية موظف، ${fmt(inbox.unresolvedRequests)} طلب مفتوح، ${fmt(inbox.openGaps)} سؤال من غير إجابة، ${fmt(inbox.negativeFeedback24h)} تقييم سلبي آخر ${FEEDBACK_WINDOW_HOURS} ساعة — تغطية معلومات الدعم ${knowledge.coverage}% — ${queue.length} بند في الطابور.`
    : `مكتب خدمة العملاء: تغطية معلومات الدعم ${knowledge.coverage}% — الحساب الحي مش مقروء${live.failed.length ? ` (${live.failed.join('، ')})` : ''}، فمفيش أرقام محادثات أو طلبات متخمنة.`;
  const nextAr = [...queue.map((item) => item.textAr), ...fixes].slice(0, 4);

  return {
    version: 1,
    updatedAt: new Date(now).toISOString(),
    desk: {
      nameAr: 'مكتب خدمة العملاء الآلي',
      nameEn: 'Automated customer care desk',
      modeAr,
    },
    live: { ...live, at: live.at || new Date(now).toISOString() },
    inbox,
    knowledge,
    templates,
    queue,
    problems,
    fixes,
    ideas,
    summaryAr,
    nextAr,
  };
}

export function isServiceFile(data: unknown): data is ServiceDeskFile {
  const d = data as ServiceDeskFile;
  return Boolean(d && typeof d === 'object' && d.version === 1 && d.desk && d.inbox && d.knowledge && Array.isArray(d.templates));
}

/** Statuses that count as a completed sale (the inventory robot uses the same rule on the same endpoint). */
export const SERVICE_SOLD_STATUSES = SOLD;
