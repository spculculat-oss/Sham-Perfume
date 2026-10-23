/**
 * «غرفة دولة المنصة» — the owner's private chat with the Platform State (his decision, 2026-10-22), and the State's
 * cognitive comprehension & order-planning engine.
 *
 * Pure (browser-safe): works 100% locally in the owner's suite, inside the State's robot (scripts/state/run.mts), and
 * as the deterministic grounding/verification core behind server/stateAgent.ts when an optional AI engine is online.
 */
import { BOTS, type Bot } from './shaheenOrg';
import { OWNER, hasSensitiveNumber, stoppedByOwner, type OwnerControls } from './ownerAuthority';
import { orderableBots } from './ownerDesk';
import { AGENT_LINK, agentLinkStatusAr } from './agentLink';
import {
  STATE, STATE_CONSTITUTION, STATE_MEMBERS, STATE_ORDERS_LIMITS, STATE_OUTCOMES, nextLawId, stateActive, stateVote,
  type StateOrderAction, type StateOrderEntry, type StateOrders, type StateReport,
} from './platformState';

// ── Orders ──────────────────────────────────────────────────────────────────────────────────────────────────
export type { StateOrderAction };
export interface StateOrder { action: StateOrderAction; target?: string; textAr?: string; whyAr: string }
export const STATE_ORDER_ACTIONS: Record<StateOrderAction, string> = {
  pause: 'وقف روبوت',
  resume: 'رجوع روبوت',
  run: 'تشغيل روبوت دلوقتي',
  law: 'قانون جديد',
  repeal: 'إلغاء قانون',
  task: 'مهمة تطوير معتمدة',
};
/** The title prefix of the owner's requests to the State (the owner's desk only reads «[شاهين] »). */
export const STATE_ISSUE_PREFIX = '[الدولة] ';
const MARK = 'sham-state-order';
const PLAN_MARK = 'sham-state-orders';

/** The robots the State may give orders to: every robot with a workflow, except the State itself and the owner's desk. */
export const stateOrderableBots = (): Bot[] => orderableBots().filter((b) => b.id !== 'state');
const botLabel = (id?: string) => (id === AGENT_LINK.id ? AGENT_LINK.nameAr : BOTS.find((b) => b.id === id)?.nameAr ?? id ?? '');
const sharing = (id: string) => { const wf = BOTS.find((b) => b.id === id)?.workflow; return BOTS.filter((b) => wf && b.workflow === wf).map((b) => b.id as string); };

// What a law or task may not do: reach the owner's data, overrule the owner, or undo the legal manager's binding decisions.
const LAW_OWNER_DATA = /بيانات صاحب الموقع|البيانات الشخصي|مفاتيح صاحب|كلمه السر|كلمة السر|الكود السري|غرفه شاهين|غرفة شاهين|رقم قومي|بطاقه|بطاقة/;
const LAW_OVER_OWNER = /(?:من غير|بدون|ضد|يلغي|تلغي|يمنع|تمنع|يتجاهل|تتجاهل|مايسمعش|ماتسمعش|محدش يسمع).{0,25}صاحب الموقع|صاحب الموقع.{0,25}(?:مالوش|ماليش|ممنوع|ميقدرش|مايقدرش|ملوش)/;
const LAW_LEGAL = /(?:شيل|الغي|الغاء|إلغاء|ألغي|ارجع|رجع|افتح|كمل|كمّل).{0,25}(?:نقل|استيراد) المنتجات|L-03/i;

/** Convert Eastern Arabic (٠-٩) and Persian (۰-۹) digits into ASCII digits. */
export function normalizeDigits(text: string): string {
  return text
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

export function normalize(text: string): string {
  return normalizeDigits(text)
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The State's judgement on an order (S-08): is it right, and why. Run in the room and again by its robot. */
export function judgeStateOrder(o: StateOrder, ctx: { controls: OwnerControls; orders: StateOrders }): { ok: boolean; reasonAr: string } {
  if (!stateActive(ctx.controls)) {
    return { ok: false, reasonAr: ctx.controls.frozen ? 'فرامل الطوارئ شغالة، والدولة واقفة مع كل الروبوتات.' : 'الموافقات معاك دلوقتي، فالدولة مابتنفذش أوامر — سلّمها الموافقات من مكتبك (state_rule) وهي تكمل.' };
  }
  // S-10: the direct link between Shaheen's agent and Shaheen is under the State's eye — it may pause it or bring it back.
  if (o.target === AGENT_LINK.id && (o.action === 'pause' || o.action === 'resume' || o.action === 'run')) {
    const paused = ctx.orders.paused.includes(AGENT_LINK.id);
    if (o.action === 'run') return { ok: false, reasonAr: `«${AGENT_LINK.nameAr}» مش روبوت بيتشغّل — هو شغال مع كل سؤال، والدولة بتوقفه أو ترجّعه بس.` };
    if (o.action === 'pause') {
      if (paused) return { ok: false, reasonAr: `«${AGENT_LINK.nameAr}» واقف بأمر الدولة أصلاً.` };
      return { ok: true, reasonAr: `هوقف «${AGENT_LINK.nameAr}»: شاهين هيرجع لوكيله بس لما المنصات تقف، والزوار هيفضلوا يتجاوبوا. (S-10)` };
    }
    if (!paused) return { ok: false, reasonAr: `«${AGENT_LINK.nameAr}» شغال أصلاً.` };
    return { ok: true, reasonAr: `هرجّع «${AGENT_LINK.nameAr}»: الوكيل يفكر مع شاهين في كل سؤال تاني. (S-10)` };
  }
  if (o.action === 'pause' || o.action === 'resume' || o.action === 'run') {
    const bot = stateOrderableBots().find((b) => b.id === o.target);
    if (!bot) return { ok: false, reasonAr: o.target === 'state' ? 'الدولة مابتديش أوامر لنفسها — مفاتيحها مع صاحب الموقع.' : 'الروبوت ده مش في قايمة اللي الدولة بتديهم أوامر.' };
    const byOwner = stoppedByOwner(ctx.controls, bot.id);
    const byState = sharing(bot.id).some((id) => ctx.orders.paused.includes(id));
    if (o.action === 'pause') {
      if (byOwner) return { ok: false, reasonAr: `«${bot.nameAr}» موقوف بأمر صاحب الموقع أصلاً.` };
      if (ctx.orders.paused.includes(bot.id)) return { ok: false, reasonAr: `«${bot.nameAr}» واقف بأمر الدولة أصلاً.` };
      return { ok: true, reasonAr: `هوقف «${bot.nameAr}» لحد ما أرجّعه. الموقع نفسه بيفضل شغال للزوار، واللي بيشتغلوا معاه في نفس التشغيل هيقفوا معاه.` };
    }
    if (o.action === 'resume') {
      if (byOwner) return { ok: false, reasonAr: `«${bot.nameAr}» موقوف بأمر صاحب الموقع، وأمره فوق الدولة — بيرجع من مكتبه بس.` };
      if (!ctx.orders.paused.includes(bot.id)) return { ok: false, reasonAr: `«${bot.nameAr}» مش واقف بأمر الدولة.` };
      return { ok: true, reasonAr: `هرجّع «${bot.nameAr}» يشتغل في مواعيده تاني.` };
    }
    if (byOwner || byState) return { ok: false, reasonAr: `«${bot.nameAr}» واقف دلوقتي — لازم يرجع الأول قبل ما يشتغل.` };
    return { ok: true, reasonAr: `هشغّل «${bot.nameAr}» دلوقتي برّه مواعيده، ومفتاح صاحب الموقع وقرارات المدير القانوني بتتطبق عليه زي العادة.` };
  }
  if (o.action === 'law') {
    const text = (o.textAr || '').replace(/\s+/g, ' ').trim();
    if (text.length < 8) return { ok: false, reasonAr: 'نص القانون قصير ومش واضح — اكتبه في جملة كاملة.' };
    if (text.length > STATE_ORDERS_LIMITS.lawChars) return { ok: false, reasonAr: `القانون طويل — خليه لحد ${STATE_ORDERS_LIMITS.lawChars} حرف.` };
    if (hasSensitiveNumber(text)) return { ok: false, reasonAr: 'فيه رقم شكله رقم بطاقة أو رقم قومي — ممنوع يتكتب في قوانين المنصة.' };
    const n = normalize(text);
    if (LAW_OWNER_DATA.test(n) || LAW_OWNER_DATA.test(text)) return { ok: false, reasonAr: 'القانون بيقرب من بيانات صاحب الموقع أو مفاتيحه أو غرفته، ودي برّه سلطة الدولة.' };
    if (LAW_OVER_OWNER.test(text) || LAW_OVER_OWNER.test(n)) return { ok: false, reasonAr: 'القانون بيحط حد على صاحب الموقع، وصاحب الموقع فوق الدولة وقوانينها.' };
    if (LAW_LEGAL.test(text) || LAW_LEGAL.test(n)) return { ok: false, reasonAr: 'ده ضد قرار ملزم للمدير القانوني (وقف نقل المنتجات L-03)، ومحدش يتجاوزه.' };
    if (ctx.orders.laws.some((l) => normalize(l.textAr) === n)) return { ok: false, reasonAr: 'القانون ده موجود أصلاً.' };
    if (ctx.orders.laws.length >= STATE_ORDERS_LIMITS.laws) return { ok: false, reasonAr: `قوانين المنصة وصلت ${STATE_ORDERS_LIMITS.laws} — الغي قانون قديم الأول.` };
    return { ok: true, reasonAr: `هضيفه لقوانين المنصة برقم ${nextLawId(ctx.orders)}، وكل الروبوتات وشاهين هيقروه في الكتيب بتاعهم.` };
  }
  if (o.action === 'task') {
    const text = (o.textAr || '').replace(/\s+/g, ' ').trim();
    if (text.length < 8) return { ok: false, reasonAr: 'وصف المهمة قصير ومش واضح — اكتب المطلوب في جملة واضحة.' };
    if (text.length > STATE_ORDERS_LIMITS.lawChars) return { ok: false, reasonAr: `وصف المهمة طويل — خليه لحد ${STATE_ORDERS_LIMITS.lawChars} حرف.` };
    if (hasSensitiveNumber(text)) return { ok: false, reasonAr: 'المهمة فيها رقم شكله رقم بطاقة أو رقم قومي — ممنوع يتسجل في مهام المنصة.' };
    const n = normalize(text);
    if (LAW_OWNER_DATA.test(n) || LAW_OWNER_DATA.test(text)) return { ok: false, reasonAr: 'المهمة بتقرب من بيانات صاحب الموقع أو مفاتيحه أو غرفته، ودي برّه سلطة الدولة.' };
    if (LAW_OVER_OWNER.test(text) || LAW_OVER_OWNER.test(n)) return { ok: false, reasonAr: 'المهمة بتحط قيد على صاحب الموقع، وصاحب الموقع فوق الدولة.' };
    if (LAW_LEGAL.test(text) || LAW_LEGAL.test(n)) return { ok: false, reasonAr: 'المهمة ضد قرار ملزم للمدير القانوني (وقف نقل المنتجات L-03)، ومحدش يتجاوزه.' };
    const vote = stateVote({ kind: 'task', title: text, body: o.whyAr || '' });
    if (!vote.approved) return { ok: false, reasonAr: vote.summaryAr };
    return { ok: true, reasonAr: `أعضاء الدولة راجعوا المهمة ووافقوا عليها (${vote.tally.approve} موافقة) — هفتحها كمهمة معتمدة ينفذها وكيل البرمجة / وكيل ملك المنصة.` };
  }
  const law = ctx.orders.laws.find((l) => l.id === normalizeDigits(o.target || '').toUpperCase());
  if (!law) return { ok: false, reasonAr: `مفيش قانون برقم ${o.target || '؟'} — قوانين الدستور (S-..) ثابتة، والقوانين اللي بتتلغي بتبدأ بـ P.` };
  return { ok: true, reasonAr: `هلغي القانون ${law.id}: «${law.textAr}».` };
}

/** Carries out an order the State accepted (its robot does this, then publishes the file). */
export function applyStateOrder(orders: StateOrders, o: StateOrder, now = new Date()): { orders: StateOrders; changed: boolean; noteAr: string } {
  const at = now.toISOString();
  const next: StateOrders = { paused: [...orders.paused], laws: [...orders.laws], log: [...orders.log] };
  let entry: StateOrderEntry | undefined;
  if (o.action === 'pause' && o.target && !next.paused.includes(o.target)) {
    next.paused.push(o.target);
    entry = { at, action: 'pause', target: o.target, noteAr: `وقفت «${botLabel(o.target)}»: ${o.whyAr}`, by: 'state' };
  } else if (o.action === 'resume' && o.target && next.paused.includes(o.target)) {
    next.paused = next.paused.filter((id) => id !== o.target);
    entry = { at, action: 'resume', target: o.target, noteAr: `رجّعت «${botLabel(o.target)}»: ${o.whyAr}`, by: 'state' };
  } else if (o.action === 'run' && o.target) {
    entry = { at, action: 'run', target: o.target, noteAr: `شغّلت «${botLabel(o.target)}» دلوقتي: ${o.whyAr}`, by: 'state' };
  } else if (o.action === 'law' && o.textAr) {
    const id = nextLawId(next);
    next.laws.push({ id, textAr: o.textAr.replace(/\s+/g, ' ').trim().slice(0, STATE_ORDERS_LIMITS.lawChars), at });
    entry = { at, action: 'law', target: id, noteAr: `قانون جديد ${id}: ${o.textAr.trim().slice(0, 120)}`, by: 'state' };
  } else if (o.action === 'repeal' && o.target) {
    const id = normalizeDigits(o.target).toUpperCase();
    if (next.laws.some((l) => l.id === id)) {
      next.laws = next.laws.filter((l) => l.id !== id);
      entry = { at, action: 'repeal', target: id, noteAr: `ألغيت القانون ${id}: ${o.whyAr}`, by: 'state' };
    }
  } else if (o.action === 'task' && o.textAr) {
    const label = o.target || 'مهمة';
    entry = { at, action: 'task', target: label, noteAr: `مهمة تطوير معتمدة (${label}): ${o.textAr.trim().slice(0, 120)}`, by: 'state' };
  }
  if (!entry) return { orders, changed: false, noteAr: 'مفيش حاجة اتغيرت.' };
  next.log = [entry, ...next.log].slice(0, STATE_ORDERS_LIMITS.log);
  return { orders: next, changed: true, noteAr: entry.noteAr };
}

/** The owner resumed a robot from his desk: the State's pause on it goes too (his order is above the State's). */
export function ownerResumes(orders: StateOrders, bot: string, now = new Date()): { orders: StateOrders; changed: boolean } {
  const ids = new Set(sharing(bot).length ? sharing(bot) : [bot]);
  if (!orders.paused.some((id) => ids.has(id))) return { orders, changed: false };
  const entry: StateOrderEntry = { at: now.toISOString(), action: 'resume', target: bot, noteAr: `صاحب الموقع رجّع «${botLabel(bot)}» من مكتبه، فوقف الدولة عليه اتشال.`, by: 'owner' };
  return { orders: { ...orders, paused: orders.paused.filter((id) => !ids.has(id)), log: [entry, ...orders.log].slice(0, STATE_ORDERS_LIMITS.log) }, changed: true };
}

const cleanOrder = (o: StateOrder): StateOrder => ({
  action: o.action,
  ...(o.target ? { target: o.target.slice(0, 40) } : {}),
  ...(o.textAr ? { textAr: o.textAr.slice(0, STATE_ORDERS_LIMITS.lawChars) } : {}),
  whyAr: o.whyAr.slice(0, 300),
});

const orderSummaryLine = (o: StateOrder): string => (
  o.action === 'law' || o.action === 'task'
    ? `${STATE_ORDER_ACTIONS[o.action]}: ${(o.textAr || '').slice(0, 60)}`
    : o.action === 'repeal'
      ? `${STATE_ORDER_ACTIONS.repeal} ${o.target}`
      : `${STATE_ORDER_ACTIONS[o.action]}: ${botLabel(o.target)}`
);

/** The request the «نفّذ» button opens from the owner's account (the State's robot reads only his own requests). */
export function stateOrderIssue(o: StateOrder): { title: string; body: string } {
  const what = orderSummaryLine(o);
  const clean = cleanOrder(o);
  return {
    title: `${STATE_ISSUE_PREFIX}${what}`.slice(0, 120),
    body: [`🏛️ **أمر لـ${STATE.nameAr}** من غرفتها الخاصة في جناح صاحب الموقع.`, '', `- **الأمر:** ${what}`, `- **رأي الدولة:** ${o.whyAr}`, '',
      'الدولة هتنفذه خلال دقيقة وترد هنا، وبعدين تقفل الطلب. اضغط «Submit new issue» (إنشاء الطلب).', '', `<!-- ${MARK} ${JSON.stringify(clean)} -->`].join('\n'),
  };
}

/** Issue builder for either a single order (exact legacy shape) or a multi-order execution plan. */
export function stateOrderPlanIssue(orders: StateOrder[]): { title: string; body: string } {
  if (orders.length <= 1 && orders[0]) return stateOrderIssue(orders[0]);
  const cleaned = orders.slice(0, 10).map(cleanOrder);
  const firstWhat = cleaned[0] ? orderSummaryLine(cleaned[0]) : 'خطة أوامر';
  const title = `${STATE_ISSUE_PREFIX}${firstWhat} (+${cleaned.length - 1} أوامر)`.slice(0, 120);
  const lines = cleaned.map((o, idx) => `${idx + 1}. **${orderSummaryLine(o)}** — ${o.whyAr}`);
  return {
    title,
    body: [
      `🏛️ **خطة أوامر لـ${STATE.nameAr}** (${cleaned.length} خطوات) من غرفتها الخاصة في جناح صاحب الموقع.`,
      '',
      ...lines,
      '',
      'الدولة هتراجع وتنفذ كل خطوة خلال دقيقة وترد هنا بالتفصيل، وبعدين تقفل الطلب. اضغط «Submit new issue» (إنشاء الطلب).',
      '',
      `<!-- ${PLAN_MARK} ${JSON.stringify(cleaned)} -->`,
    ].join('\n'),
  };
}

export const stateOrderUrl = (o: StateOrder) => { const i = stateOrderIssue(o); return `https://github.com/${OWNER.repo}/issues/new?title=${encodeURIComponent(i.title)}&body=${encodeURIComponent(i.body)}`; };
export const stateOrderPlanUrl = (orders: StateOrder[]) => { const i = stateOrderPlanIssue(orders); return `https://github.com/${OWNER.repo}/issues/new?title=${encodeURIComponent(i.title)}&body=${encodeURIComponent(i.body)}`; };

function sanitizeParsedOrder(raw: unknown): StateOrder | undefined {
  const o = raw as Partial<StateOrder> | undefined;
  if (!o || typeof o.action !== 'string' || !(o.action in STATE_ORDER_ACTIONS)) return undefined;
  const target = typeof o.target === 'string' && o.target.trim() ? o.target.trim().slice(0, 40) : undefined;
  const textAr = typeof o.textAr === 'string' && o.textAr.trim() ? o.textAr.trim().slice(0, STATE_ORDERS_LIMITS.lawChars) : undefined;
  const needsText = o.action === 'law' || o.action === 'task';
  if ((needsText && !textAr) || (!needsText && !target)) return undefined;
  return { action: o.action as StateOrderAction, ...(target ? { target } : {}), ...(textAr ? { textAr } : {}), whyAr: typeof o.whyAr === 'string' ? o.whyAr.slice(0, 300) : '' };
}

/** Parse ALL structured orders inside an issue body (supports both multi-order plan and single order). */
export function parseStateOrders(body: string | null | undefined): StateOrder[] {
  const src = body || '';
  const multi = new RegExp(`<!--\\s*${PLAN_MARK}\\s+(\\[[\\s\\S]*?\\])\\s*-->`).exec(src);
  if (multi) {
    try {
      const parsed = JSON.parse(multi[1]);
      if (Array.isArray(parsed)) {
        const list = parsed.map(sanitizeParsedOrder).filter((x): x is StateOrder => Boolean(x)).slice(0, 10);
        if (list.length) return list;
      }
    } catch { /* fall through */ }
  }
  const single = parseStateOrder(src);
  return single ? [single] : [];
}

/** The order inside the owner's request (anything malformed is dropped). */
export function parseStateOrder(body: string | null | undefined): StateOrder | undefined {
  const m = new RegExp(`<!--\\s*${MARK}\\s+(\\{[\\s\\S]*?\\})\\s*-->`).exec(body || '');
  if (!m) return undefined;
  try {
    return sanitizeParsedOrder(JSON.parse(m[1]));
  } catch { return undefined; }
}

// ── Cognitive Comprehension & Natural-Language Bot / Law Matching ───────────────────────────────────────────
export interface StateRoomContext {
  controls: OwnerControls;
  orders: StateOrders;
  report: StateReport;
  precheck?: { health?: number; bots?: { id: string; status: string; problems?: string[] }[] };
  /** Open requests waiting for the State (from GitHub, when the suite could read them). */
  pending?: { pulls: number; tasks: number };
}

export type OwnerIntentKind =
  | 'order_plan' | 'status' | 'laws' | 'decisions' | 'members'
  | 'robots' | 'agent_link' | 'greeting' | 'help' | 'clarify' | 'sensitive' | 'unknown';

export interface OwnerComprehension {
  intent: OwnerIntentKind;
  confidence: number;
  understood: boolean;
  resolvedAnaphora?: string;
  clauses: string[];
  proposedOrders: StateOrder[];
  acceptedOrders: { order: StateOrder; reasonAr: string }[];
  rejectedOrders: { order?: StateOrder; reasonAr: string }[];
}

export interface StateReplyResult {
  text: string;
  order?: StateOrder;
  orders?: StateOrder[];
  comprehension?: OwnerComprehension;
}

const stem = (w: string) => w.replace(/^(?:وال|بال|فال|لل|ال|و)(?=.{3,})/, '');
const STOP = new Set(['روبوت', 'الروبوت', 'شاهين', 'دوله', 'المنصه', 'منصه', 'بتاع', 'بتاعه', 'خاص', 'اللي', 'كل', 'مع', 'من', 'في', 'على', 'علي', 'دلوقتي', 'حالا', 'فورا', 'شويه', 'تاني']);
const words = (text: string) => normalize(text).split(/[^\p{L}\p{N}_]+/u).filter((w) => w.length >= 3 && !STOP.has(w)).map(stem).filter((w) => w.length >= 3 && !STOP.has(w));

/** Colloquial Egyptian Arabic & English phrases owners naturally use to refer to each robot. */
const BOT_ALIASES: Record<string, string[]> = {
  news: ['الاخبار', 'اخبار', 'النشره', 'نشره الاخبار', 'المجله'],
  patrol: ['الدوريه', 'دوريه', 'الورديه', 'المراقبه الدوريه'],
  doctor: ['الدكتور', 'دكتور', 'الطبيب', 'طبيب', 'الصيانه', 'صيانه الموقع'],
  scout: ['الكشاف', 'كشاف', 'كشاف المصادر', 'كشاف المتاجر', 'البحث عن متاجر'],
  importer: ['المستورد', 'مستورد', 'نقل المنتجات', 'مراجع الصفحات'],
  images: ['منظف الصور', 'تنظيف الصور'],
  catalog: ['الكتالوج', 'كتالوج', 'مدرب الكتالوج', 'مدرب المتجر'],
  product_pages: ['فاحص صفحات المنتجات', 'صفحات المنتجات', 'فحص الموبايل'],
  seo: ['السيو', 'سيو', 'مناره', 'المناره', 'محركات البحث'],
  teacher: ['المعلم', 'المعلم المحلي', 'مراجع الدروس'],
  languages: ['المترجم', 'وكيل اللغات', 'الترجمه', 'اللغات'],
  design_audit: ['تدقيق التصميم', 'مراجعه التصميم'],
  visitor_tour: ['جوله الزائر', 'المستشار الميداني', 'الجوله الميدانيه'],
  inspect: ['فاحص الاجابات', 'فحص الاجابات'],
  school: ['المدرسه', 'مدرسه شاهين'],
  academy: ['الاكاديميه', 'اكاديميه شاهين', 'اكاديميه'],
  lab: ['المعمل', 'معمل شاهين', 'المجرب', 'التجارب'],
  verifier: ['المراجع الخارجي'],
  live_check: ['فحص الموقع الحي', 'فحص شاهين الحي'],
  keys: ['حارس المفاتيح', 'المفاتيح', 'فحص الباقات'],
  intake: ['مستقبل التحديثات', 'تحديثات استوديو'],
  studio_bridge: ['بوابه جوجل استوديو', 'بوابه استوديو', 'جوجل استوديو'],
  studio_zip: ['الملفات المضغوطه', 'مستلم الملفات المضغوطه'],
  deploy: ['بناء ونشر الموقع', 'نشر الموقع', 'النشر', 'بناء الموقع'],
  council: ['المجلس', 'الاجتماع اليومي', 'اجتماع شاهين'],
  secretary: ['السكرتير', 'مشرف شاهين'],
  precheck: ['الفحص الشامل', 'فحص قبل الاجتماع'],
  maneuver: ['مناوره التخصصات', 'المناوره', 'الفحص الميداني'],
  finance: ['الماليه', 'البنك', 'امين الماليه', 'الاداره الماليه'],
};

/** Which robot the owner means: by its id, colloquially known alias, or words of its Arabic name. */
export function findBot(text: string): { bot?: Bot; candidates: Bot[] } {
  const n = normalize(text);
  const bots = stateOrderableBots();
  const byId = bots.find((b) => new RegExp(`(?:^|[^a-z_])${b.id}(?:$|[^a-z_])`).test(n));
  if (byId) return { bot: byId, candidates: [byId] };

  // Check exact colloquial alias phrases first (longest match wins so specific phrases beat broad words).
  let bestAliasLen = 0;
  let aliasMatches: Bot[] = [];
  for (const b of bots) {
    const aliases = BOT_ALIASES[b.id] || [];
    for (const alias of aliases) {
      const na = normalize(alias);
      const re = new RegExp(`(?:^|\\s)(?:وال|بال|لل|ال|و)?${na.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|\\s|[،,؟!])`);
      if (re.test(n)) {
        if (na.length > bestAliasLen) { bestAliasLen = na.length; aliasMatches = [b]; }
        else if (na.length === bestAliasLen && !aliasMatches.some((x) => x.id === b.id)) aliasMatches.push(b);
      }
    }
  }
  if (aliasMatches.length === 1) return { bot: aliasMatches[0], candidates: aliasMatches };

  const said = new Set(words(text));
  const scored = bots.map((b) => {
    const aliasWords = (BOT_ALIASES[b.id] || []).flatMap(words);
    const vocab = new Set([...words(b.nameAr), ...aliasWords]);
    const hitsCount = [...said].filter((w) => vocab.has(w)).length;
    return { b, score: hitsCount };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  if (!scored.length) return { candidates: [] };
  const top = scored.filter((x) => x.score === scored[0].score).map((x) => x.b);
  return top.length === 1 ? { bot: top[0], candidates: top } : { candidates: top.slice(0, 5) };
}

/** Resolve pronouns / follow-up references («وقفه», «شغّله دلوقتي», «الغيه») from recent conversation history. */
function resolveAnaphoraTarget(kind: 'bot' | 'law', history?: StateRoomMessage[]): string | undefined {
  if (!history?.length) return undefined;
  for (let i = history.length - 1; i >= Math.max(0, history.length - 8); i--) {
    const m = history[i];
    const allOrders = [...(m.orders || []), ...(m.order ? [m.order] : [])];
    if (kind === 'law') {
      for (const o of allOrders) {
        if ((o.action === 'law' || o.action === 'repeal') && o.target && /^P-\d+$/i.test(o.target)) return o.target.toUpperCase();
      }
      const lawRef = /\b(P-\d+)\b/i.exec(normalizeDigits(m.text));
      if (lawRef) return lawRef[1].toUpperCase();
    } else {
      for (const o of allOrders) {
        if ((o.action === 'pause' || o.action === 'resume' || o.action === 'run') && o.target) return o.target;
      }
      if (/(?:الربط المباشر|agent_link)/.test(normalize(m.text))) return AGENT_LINK.id;
      const found = findBot(m.text);
      if (found.bot) return found.bot.id;
    }
  }
  return undefined;
}

/** Normalize text while keeping an exact character-offset map back into `src` (preserves original Arabic orthography on slices!). */
function normalizeWithMap(src: string): { norm: string; map: number[] } {
  const chars: string[] = [];
  const map: number[] = [];
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (/[\u064B-\u065F\u0670\u0640]/.test(ch)) continue;
    let c = ch;
    if (c >= '\u0660' && c <= '\u0669') c = String(c.charCodeAt(0) - 0x0660);
    else if (c >= '\u06F0' && c <= '\u06F9') c = String(c.charCodeAt(0) - 0x06f0);
    else if (/[أإآ]/.test(c)) c = 'ا';
    else if (c === 'ى') c = 'ي';
    else if (c === 'ة') c = 'ه';
    else if (c === 'ؤ') c = 'و';
    else if (c === 'ئ') c = 'ي';
    chars.push(c.toLowerCase());
    map.push(i);
  }
  map.push(src.length);
  return { norm: chars.join(''), map };
}

/** Split multi-directive owner messages safely without cutting inside a single law or task sentence. */
export function splitOwnerDirectives(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const { norm, map } = normalizeWithMap(trimmed);
  const directiveLookahead = '(?=\\s*(?:وقف|وقفي|اوقف|اوقفي|ايقاف|عطل|عطلي|اقفل|اقفلي|رجع|رجعي|ارجع|ارجعي|فعل|فعلي|شغل|شغلي|تشغيل|قوم|قومي|قانون\\s*جديد|ضيف\\s*قانون|ضيفي\\s*قانون|اضف\\s*قانون|اضيفي\\s*قانون|حط\\s*قانون|حطي\\s*قانون|عايز\\s*قانون|عاوز\\s*قانون|اعمل\\s*قانون|الغي\\s*(?:ال)?قانون|الغاء\\s*(?:ال)?قانون|شيل\\s*(?:ال)?قانون|امسح\\s*(?:ال)?قانون|احذف\\s*(?:ال)?قانون|مهمه\\s*جديده|اعمل\\s*مهمه|اعملي\\s*مهمه|افتح\\s*مهمه|افتحي\\s*مهمه|سجل\\s*مهمه|سجلي\\s*مهمه|pause\\b|resume\\b|run\\b))';
  const splitter = new RegExp(`(?:[\\n؛;]+|(?:\\s*[،,]?\\s*(?:وبعدين|وبعدها|وكمان|وثم|ثم|وبالمره)\\s+)${directiveLookahead}|\\s+و${directiveLookahead})`, 'gi');
  const parts: string[] = [];
  let lastRawIdx = 0;
  let match: RegExpExecArray | null;
  while ((match = splitter.exec(norm)) !== null) {
    const segStartRaw = lastRawIdx;
    const segEndRaw = map[match.index] ?? trimmed.length;
    const seg = trimmed.slice(segStartRaw, segEndRaw).trim();
    if (seg) parts.push(seg);
    lastRawIdx = map[match.index + match[0].length] ?? trimmed.length;
    if (match[0].length === 0) splitter.lastIndex++;
  }
  const tail = trimmed.slice(lastRawIdx).trim();
  if (tail) parts.push(tail);
  return parts.length ? parts : [trimmed];
}

const PAUSE_RE = /(?:^|\s)(?:وقف|وقفي|وقفه|وقفيها|اوقف|اوقفي|اوقفه|ايقاف|استوب|pause|عطل|عطلي|عطله|اقفل|اقفلي|اقفله|هدي)(?:\s|$)/;
const RESUME_RE = /(?:^|\s)(?:رجع|رجعي|رجعه|رجعيها|ارجع|ارجعي|رجوع|resume|فعل|فعلي|فعله|تفعيل|فك\s*الايقاف|شيل\s*الايقاف)(?:\s|$)/;
const RUN_RE = /(?:^|\s)(?:شغل|شغلي|شغله|شغليها|تشغيل|run|قوم|قومي|قومه|قوميها|ابدا|ابدئي)(?:\s|$)/;
const ANAPHORA_BOT_RE = /(?:وقفه|وقفيها|اوقفه|عطله|اقفله|رجعه|رجعيها|فعله|شغله|شغليها|قومه|قوميها|(?:وقف|رجع|شغل|قوم)\s*(?:ده|دي|الروبوت\s*ده))(?:$|\s)/;
const ANAPHORA_LAW_RE = /(?:^|\s)(?:الغيه|الغيها|شيله|شيلها|امسحه|امسحها|احذفه|احذفها|(?:الغي|شيل|امسح|احذف)\s*(?:القانون\s*ده|القاعده\s*دي))(?:$|\s)/;

const when = (iso?: string) => (iso && Date.parse(iso) > 0 ? new Date(iso).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' }) : '—');
const pausedList = (ctx: StateRoomContext) => ({
  owner: BOTS.filter((b) => b.workflow && ctx.controls.paused.includes(b.id)).map((b) => b.nameAr),
  state: ctx.orders.paused.map(botLabel),
});

function statusText(ctx: StateRoomContext): string {
  const active = stateActive(ctx.controls);
  const p = pausedList(ctx);
  const recent = ctx.report.decisions.slice(0, 5);
  const health = typeof ctx.precheck?.health === 'number' ? ctx.precheck.health : ctx.report.supervision.health;
  const problems = ctx.report.supervision.problems.slice(0, 5);
  return [
    active ? '🏛️ **أنا ماسكة كل الموافقات دلوقتي**، وبقرر وبنفذ بنفسي.' : ctx.controls.frozen ? '⛔ فرامل الطوارئ شغالة، وأنا واقفة مع كل الروبوتات.' : '⏸️ الموافقات معاك إنت دلوقتي، فأنا بتابع بس ومابقررش.',
    `- آخر تقرير ليا: ${when(ctx.report.updatedAt)}.`,
    ...(ctx.pending ? [`- مستني قراري: ${ctx.pending.pulls} تعديل من الروبوتات و${ctx.pending.tasks} مهمة من المجلس (بقرر فيهم كل ساعة).`] : []),
    `- صحة الأدوات: ${typeof health === 'number' ? `${health}%` : 'لسه مفيش قياس'}.`,
    `- موقوف بأمرك: ${p.owner.join('، ') || 'مفيش'}. موقوف بأمري: ${p.state.join('، ') || 'مفيش'}.`,
    ...(recent.length ? ['', '**آخر قراراتي:**', ...recent.map((d) => `- #${d.number} ${d.title} — ${STATE_OUTCOMES[d.outcome]}`)] : ['', 'لسه ماخدتش قرارات.']),
    ...(problems.length ? ['', '**اللي شايفاه محتاج متابعة:**', ...problems.map((x) => `- ${x}`)] : []),
  ].join('\n');
}

function lawsText(ctx: StateRoomContext): string {
  return [
    '**دستوري (ثابت، ومحدش يغيره غير صاحب الموقع):**', ...STATE_CONSTITUTION.map((r) => `- ${r.id}: ${r.textAr}`), '',
    '**قوانين المنصة اللي اتضافت:**', ...(ctx.orders.laws.length ? ctx.orders.laws.map((l) => `- ${l.id}: ${l.textAr}`) : ['- لسه مفيش. قولّي «قانون جديد: …» وأنا أراجعه.']),
  ].join('\n');
}

const HELP = [
  'أقدر أفهم أوامرك بطريقتك العادية وأنفذها فوراً في روبوت دولة المنصة:',
  '- «إيه الوضع؟» أو «إيه المستجدات؟»: تقرير سريع عن قراراتي والروبوتات.',
  '- «قراراتك» أو «قوانين المنصة» أو «مين الأعضاء؟».',
  '- «وقف روبوت الأخبار» أو «رجّعه وشغّله دلوقتي» أو «شغّل الروبوتات العطلانة»: أوامر فردية أو مجمّعة في رسالة واحدة.',
  '- «قانون جديد: …» أو «الغي القانون P-01»: إدارة قوانين المنصة.',
  '- «مهمة جديدة: …» أو «اعمل مهمة لـ…»: فتح مهمة تطوير معتمدة بعد تصويت أعضاء الدولة.',
  '- «الربط المباشر» أو «وقف الربط المباشر»: الربط بين وكيل شاهين وشاهين (S-10).',
  'كل أمر براجعه الأول على الدستور والقوانين: السليم بجهّزه للتنفيذ الفوري، والمخالف بشرحلك سببه.',
].join('\n');

interface ClauseParseOutcome {
  kind: 'orders' | 'clarify' | 'none_failing' | 'none';
  orders?: StateOrder[];
  clarifyText?: string;
  anaphora?: string;
}

function parseSingleClause(clause: string, ctx: StateRoomContext, workingOrders: StateOrders, history?: StateRoomMessage[]): ClauseParseOutcome {
  const raw = clause.trim();
  const n = normalize(raw);
  if (!n) return { kind: 'none' };

  // 1. Repeal law (explicit P-XX or pronoun reference to last discussed law).
  const repealExplicit = /(?:الغي|الغاء|شيل|امسح|احذف|حذف)\s*(?:ال)?(?:قانون|قاعده)\s*(?:رقم\s*)?(p\s*-?\s*\d+)/i.exec(n);
  if (repealExplicit) {
    const id = `P-${String(Number(repealExplicit[1].replace(/\D/g, ''))).padStart(2, '0')}`;
    return { kind: 'orders', orders: [{ action: 'repeal', target: id, whyAr: 'بأمر صاحب الموقع من غرفة الدولة.' }] };
  }
  if (ANAPHORA_LAW_RE.test(n)) {
    const prevLaw = resolveAnaphoraTarget('law', history);
    if (prevLaw) {
      return { kind: 'orders', orders: [{ action: 'repeal', target: prevLaw, whyAr: 'بأمر صاحب الموقع من غرفة الدولة.' }], anaphora: prevLaw };
    }
  }

  // 2. Add a new law (colloquial & formal forms, including leading conjunctions like «وضيف قانون» / «وكمان حط قانون»).
  const { norm: clauseNorm, map: clauseMap } = normalizeWithMap(raw);
  const lawMatch = /^(?:(?:و|ف)?(?:ثم\s+|كمان\s+|بعدين\s+|بعدها\s+|طب\s+)*)(?:و|ف)?(?:قانون جديد|قاعده جديده|ضيف قانون|ضيفي قانون|اضف قانون|اضيفي قانون|حط قانون|حطي قانون|عايز قانون|عاوز قانون|اعمل قانون|اعملي قانون|سجل قانون)\s*(?:بيقول|ينص علي|ان)?\s*[:：\-–]?\s*([\s\S]+)$/.exec(clauseNorm);
  if (lawMatch) {
    const startNormIdx = clauseNorm.length - lawMatch[1].length;
    const bodyText = raw.slice(clauseMap[startNormIdx] ?? 0).trim();
    return { kind: 'orders', orders: [{ action: 'law', textAr: bodyText, whyAr: 'قانون اقترحه صاحب الموقع في غرفة الدولة.' }] };
  }

  // 3. Create an approved development/maintenance task («مهمة جديدة: ...» / «واعمل مهمة: ...»).
  const taskMatch = /^(?:(?:و|ف)?(?:ثم\s+|كمان\s+|بعدين\s+|بعدها\s+|طب\s+)*)(?:و|ف)?(?:مهمه جديده|اعمل مهمه|اعملي مهمه|افتح مهمه|افتحي مهمه|سجل مهمه|سجلي مهمه|عايز مهمه|عاوز مهمه|ضيف مهمه|ضيفي مهمه)\s*(?:تطوير|صيانه|اصلاح|ل|علشان|عشان|بخصوص)?\s*[:：\-–]?\s*([\s\S]+)$/.exec(clauseNorm);
  if (taskMatch) {
    const startNormIdx = clauseNorm.length - taskMatch[1].length;
    const bodyText = raw.slice(clauseMap[startNormIdx] ?? 0).trim();
    return { kind: 'orders', orders: [{ action: 'task', textAr: bodyText, whyAr: 'مهمة طلبها صاحب الموقع واعتمدتها دولة المنصة.' }] };
  }

  // 4. Robot / direct-link control verbs.
  const now = /(?:دلوقتي|حالا|الان|فورا|في الحال|now)/.test(n);
  const pauseVerb = PAUSE_RE.test(n);
  const resumeVerb = RESUME_RE.test(n);
  const runVerb = RUN_RE.test(n);

  // 4a. Direct link S-10.
  if (/(?:الربط|ربط|agent_link)/.test(n) && /(?:وكيل|شاهين|المباشر|agent_link)/.test(n)) {
    if (pauseVerb) return { kind: 'orders', orders: [{ action: 'pause', target: AGENT_LINK.id, whyAr: '' }] };
    if (resumeVerb || runVerb) return { kind: 'orders', orders: [{ action: 'resume', target: AGENT_LINK.id, whyAr: '' }] };
  }

  // 4b. Fleet command: re-run all failing robots right now («شغّل الروبوتات العطلانة»).
  if ((runVerb || resumeVerb) && /(?:العطلانه|الواقعه|البايظه|اللي وقعت|اللي فشلت|الفاشله)/.test(n)) {
    const orderable = new Set(stateOrderableBots().map((b) => b.id as string));
    const seenWf = new Set<string>();
    const targets: StateOrder[] = [];
    for (const b of ctx.precheck?.bots || []) {
      const bot = BOTS.find((x) => x.id === b.id);
      if (b.status !== 'fail' || !bot?.workflow || !orderable.has(bot.id)) continue;
      if (stoppedByOwner(ctx.controls, bot.id) || workingOrders.paused.includes(bot.id)) continue;
      if (seenWf.has(bot.workflow)) continue;
      seenWf.add(bot.workflow);
      targets.push({ action: 'run', target: bot.id, whyAr: 'إعادة تشغيل روبوت عطلان بأمر صاحب الموقع.' });
    }
    return targets.length ? { kind: 'orders', orders: targets } : { kind: 'none_failing' };
  }

  // 4c. Specific robot (by name/id/alias, explicit self-target 'state', or pronoun from conversation history).
  if (pauseVerb || resumeVerb || runVerb) {
    if (/(?:نفسك|دوله المنصه|الدوله نفسها)(?:\s|$)/.test(n) && !findBot(raw).bot) {
      const action: StateOrderAction = pauseVerb ? 'pause' : resumeVerb ? 'resume' : 'run';
      return { kind: 'orders', orders: [{ action, target: 'state', whyAr: '' }] };
    }
    const { bot, candidates } = findBot(raw);
    if (bot) {
      const action: StateOrderAction = pauseVerb ? 'pause' : resumeVerb ? 'resume' : now || !workingOrders.paused.includes(bot.id) ? 'run' : 'resume';
      return { kind: 'orders', orders: [{ action, target: bot.id, whyAr: '' }] };
    }
    if (candidates.length > 1) {
      return { kind: 'clarify', clarifyText: `قصدك أنهي واحد؟ ${candidates.map((b) => `«${b.nameAr}»`).join(' أو ')}` };
    }
    // Check anaphora pronoun («وقفه», «رجّعه», «شغّله دلوقتي») against recent room messages!
    if (ANAPHORA_BOT_RE.test(n) || (history?.length && /^(?:طب\s*)?(?:وقفه|وقفيها|رجعه|رجعيها|شغله|شغليها|قومه|قوميها)(?:\s+(?:دلوقتي|حالا|تاني|فورا))?$/.test(n))) {
      const prevBot = resolveAnaphoraTarget('bot', history);
      if (prevBot) {
        const action: StateOrderAction = pauseVerb ? 'pause' : resumeVerb ? 'resume' : prevBot === AGENT_LINK.id ? 'resume' : now || !workingOrders.paused.includes(prevBot) ? 'run' : 'resume';
        return { kind: 'orders', orders: [{ action, target: prevBot, whyAr: '' }], anaphora: botLabel(prevBot) };
      }
    }
    if (/روبوت|الروبوتات|بوت/.test(n) || now) {
      return { kind: 'clarify', clarifyText: `أنهي روبوت؟ مثلاً: ${stateOrderableBots().slice(0, 6).map((b) => `«${b.nameAr}»`).join('، ')}.` };
    }
  }

  return { kind: 'none' };
}

/**
 * Structured cognitive comprehension of an owner message:
 * splits compound directives, resolves follow-up pronouns from conversation history,
 * simulates state transitions sequentially across multi-step orders, and judges every order constitutionally.
 */
export function comprehendOwnerCommand(message: string, ctx: StateRoomContext, history?: StateRoomMessage[]): OwnerComprehension {
  const raw = message.trim();
  const n = normalize(raw);
  if (!n) {
    return { intent: 'help', confidence: 1, understood: true, clauses: [], proposedOrders: [], acceptedOrders: [], rejectedOrders: [] };
  }
  if (hasSensitiveNumber(raw)) {
    return { intent: 'sensitive', confidence: 1, understood: true, clauses: [raw], proposedOrders: [], acceptedOrders: [], rejectedOrders: [] };
  }

  const clauses = splitOwnerDirectives(raw);
  let workingOrders: StateOrders = {
    paused: [...ctx.orders.paused],
    laws: [...ctx.orders.laws],
    log: [...ctx.orders.log],
  };
  const virtualHistory: StateRoomMessage[] = [...(history || [])];
  const proposedOrders: StateOrder[] = [];
  const acceptedOrders: { order: StateOrder; reasonAr: string }[] = [];
  const rejectedOrders: { order?: StateOrder; reasonAr: string }[] = [];
  const clarifications: string[] = [];
  let sawNoneFailing = false;
  let resolvedAnaphora: string | undefined;

  for (const clause of clauses) {
    const parsed = parseSingleClause(clause, ctx, workingOrders, virtualHistory);
    if (parsed.anaphora && !resolvedAnaphora) resolvedAnaphora = parsed.anaphora;
    if (parsed.kind === 'none_failing') {
      sawNoneFailing = true;
      continue;
    }
    if (parsed.kind === 'clarify' && parsed.clarifyText) {
      clarifications.push(parsed.clarifyText);
      continue;
    }
    if (parsed.kind === 'orders' && parsed.orders?.length) {
      for (const candidate of parsed.orders) {
        proposedOrders.push(candidate);
        const verdict = judgeStateOrder(candidate, { controls: ctx.controls, orders: workingOrders });
        if (verdict.ok) {
          const accepted = { ...candidate, whyAr: candidate.whyAr || verdict.reasonAr };
          acceptedOrders.push({ order: accepted, reasonAr: verdict.reasonAr });
          // Simulate state change so subsequent steps in the SAME message see the updated state (e.g., resume -> run, law P-01 -> law P-02)!
          workingOrders = applyStateOrder(workingOrders, accepted).orders;
          virtualHistory.push({ id: 'sim', by: 'state', text: verdict.reasonAr, at: '', order: accepted });
        } else {
          rejectedOrders.push({ order: candidate, reasonAr: verdict.reasonAr });
        }
      }
    }
  }

  if (proposedOrders.length > 0) {
    return {
      intent: 'order_plan',
      confidence: resolvedAnaphora ? 0.88 : 0.96,
      understood: true,
      ...(resolvedAnaphora ? { resolvedAnaphora } : {}),
      clauses,
      proposedOrders,
      acceptedOrders,
      rejectedOrders,
    };
  }
  if (clarifications.length > 0) {
    return {
      intent: 'clarify',
      confidence: 0.75,
      understood: true,
      clauses,
      proposedOrders: [],
      acceptedOrders: [],
      rejectedOrders: clarifications.map((reasonAr) => ({ reasonAr })),
    };
  }
  if (sawNoneFailing) {
    return {
      intent: 'robots',
      confidence: 0.92,
      understood: true,
      clauses,
      proposedOrders: [],
      acceptedOrders: [],
      rejectedOrders: [{ reasonAr: 'بصيت على كل الروبوتات دلوقتي ومفيش أي روبوت عطلان محتاج إعادة تشغيل.' }],
    };
  }

  // Informational & conversational intents.
  if (/(?:الربط|ربط|agent_link)/.test(n) && /(?:وكيل|شاهين|المباشر|agent_link)/.test(n)) {
    return { intent: 'agent_link', confidence: 0.95, understood: true, clauses, proposedOrders: [], acceptedOrders: [], rejectedOrders: [] };
  }
  if (/(?:قانون|قوانين|دستور|قواعد|لوايح|لوائح)/.test(n)) {
    return { intent: 'laws', confidence: 0.9, understood: true, clauses, proposedOrders: [], acceptedOrders: [], rejectedOrders: [] };
  }
  if (/(?:قرار|قرارات|وافقتي|رفضتي|وافقت|رفضت)/.test(n)) {
    return { intent: 'decisions', confidence: 0.9, understood: true, clauses, proposedOrders: [], acceptedOrders: [], rejectedOrders: [] };
  }
  if (/(?:اعضاء|عضو|مين في الدوله|بتصوت|التصويت)/.test(n)) {
    return { intent: 'members', confidence: 0.92, understood: true, clauses, proposedOrders: [], acceptedOrders: [], rejectedOrders: [] };
  }
  if (/(?:الوضع|الاوضاع|اخبار|مستجد|جديد|تقرير|حصل ايه|ايه اللي حصل|عامله ايه|حالتك|الحاله|ملخص)/.test(n)) {
    return { intent: 'status', confidence: 0.9, understood: true, clauses, proposedOrders: [], acceptedOrders: [], rejectedOrders: [] };
  }
  if (/(?:روبوت|الروبوتات|مين واقف|مين شغال|موقوف|واقفين)/.test(n)) {
    return { intent: 'robots', confidence: 0.9, understood: true, clauses, proposedOrders: [], acceptedOrders: [], rejectedOrders: [] };
  }
  if (/(?:السلام|اهلا|هاي|هلا|صباح|مساء|ازيك|ازيكي|مرحبا)/.test(n)) {
    return { intent: 'greeting', confidence: 0.95, understood: true, clauses, proposedOrders: [], acceptedOrders: [], rejectedOrders: [] };
  }
  if (/(?:تقدري|بتعملي|تعملي ايه|مساعده|ساعديني|ساعدني|help|ازاي)/.test(n)) {
    return { intent: 'help', confidence: 0.95, understood: true, clauses, proposedOrders: [], acceptedOrders: [], rejectedOrders: [] };
  }

  return { intent: 'unknown', confidence: 0.2, understood: false, clauses, proposedOrders: [], acceptedOrders: [], rejectedOrders: [] };
}

/** Render a StateReplyResult cleanly from a comprehension verdict (used by stateReply and by server/stateAgent.ts). */
export function renderComprehensionReply(comp: OwnerComprehension, ctx: StateRoomContext): StateReplyResult {
  if (comp.intent === 'sensitive') {
    return {
      text: '⚠️ رسالتك فيها رقم شكله رقم بطاقة أو رقم قومي أو حساب. أنا مابشوفش بياناتك الشخصية ومابحفظهاش — امسحها من عندك، ومتكتبهاش هنا تاني.',
      comprehension: comp,
    };
  }
  if (comp.intent === 'order_plan') {
    const accepted = comp.acceptedOrders;
    const rejected = comp.rejectedOrders;
    const contextNote = comp.resolvedAnaphora ? `_(فهمت من كلامك اللي فات إن قصدك: ${comp.resolvedAnaphora})_\n\n` : '';
    if (accepted.length === 1 && rejected.length === 0) {
      const { order, reasonAr } = accepted[0];
      return {
        text: `${contextNote}✅ شايفة إن الأمر ده صح. ${reasonAr}\n\nاضغط «نفّذ» تحت، وأنا هنفذه خلال دقيقة وأسجله في سجلي.`,
        order,
        orders: [order],
        comprehension: comp,
      };
    }
    if (accepted.length > 0) {
      const lines = [
        `${contextNote}✅ فهمت أوامرك وجهّزتلك **${accepted.length} خطوات** للتنفيذ في روبوت دولة المنصة:`,
        ...accepted.map((x, idx) => `${idx + 1}. **${orderSummaryLine(x.order)}** — ${x.reasonAr}`),
        ...(rejected.length ? ['', '**خطوات استبعدتها بالأسباب:**', ...rejected.map((r) => `- ❌ ${r.reasonAr}`)] : []),
        '',
        'اضغط «نفّذ» تحت، وأنا هنفذ الخطوات المقبولة كلها خلال دقيقة وأرد عليك بالتفصيل في الطلب.',
      ];
      const list = accepted.map((x) => x.order);
      return { text: lines.join('\n'), order: list[0], orders: list, comprehension: comp };
    }
    return {
      text: rejected.map((r) => `❌ مش هنفذ ده: ${r.reasonAr}`).join('\n'),
      comprehension: comp,
    };
  }
  if (comp.intent === 'clarify') {
    return { text: comp.rejectedOrders.map((r) => r.reasonAr).join('\n'), comprehension: comp };
  }
  if (comp.intent === 'agent_link') {
    return {
      text: [`🔗 **${AGENT_LINK.nameAr}:** ${agentLinkStatusAr(ctx.orders, ctx.controls)}.`, '', `- ${STATE_CONSTITUTION.find((r) => r.id === 'S-10')?.textAr ?? ''}`, '- تقدر تقولّي «وقف الربط المباشر» أو «رجّع الربط المباشر».'].join('\n'),
      comprehension: comp,
    };
  }
  if (comp.intent === 'laws') return { text: lawsText(ctx), comprehension: comp };
  if (comp.intent === 'decisions') {
    const d = ctx.report.decisions.slice(0, 10);
    return {
      text: d.length
        ? ['**آخر قراراتي:**', ...d.map((x) => `- #${x.number} ${x.title} — ${STATE_OUTCOMES[x.outcome]} (${x.tally.approve} موافقة، ${x.tally.refuse} رفض، ${x.tally.veto} فيتو)`)].join('\n')
        : 'لسه ماخدتش قرارات. بقرر كل ساعة في تعديلات الروبوتات ومهام المجلس اللي مستنية.',
      comprehension: comp,
    };
  }
  if (comp.intent === 'members') {
    return {
      text: ['**أعضائي (كل واحد بيصوّت لوحده في نطاقه):**', ...STATE_MEMBERS.map((m) => `- ${m.nameAr}${m.veto ? ' (ليه فيتو)' : ''}: ${m.scopeAr}`), '', 'القرار بالتوافق: 3 موافقات على الأقل ومن غير أي اعتراض.'].join('\n'),
      comprehension: comp,
    };
  }
  if (comp.intent === 'status') return { text: statusText(ctx), comprehension: comp };
  if (comp.intent === 'robots') {
    if (comp.rejectedOrders.length) return { text: `✅ ${comp.rejectedOrders[0].reasonAr}`, comprehension: comp };
    const p = pausedList(ctx);
    const failing = (ctx.precheck?.bots || []).filter((b) => b.status === 'fail').map((b) => `${botLabel(b.id)}: ${(b.problems || [])[0] || 'فيه مشكلة'}`).slice(0, 6);
    return {
      text: [`- موقوف بأمرك: ${p.owner.join('، ') || 'مفيش'}.`, `- موقوف بأمري: ${p.state.join('، ') || 'مفيش'}.`, ...(failing.length ? ['', '**روبوتات عندها مشاكل:**', ...failing.map((x) => `- ${x}`)] : ['- مفيش روبوت عنده عطل مسجل دلوقتي.'])].join('\n'),
      comprehension: comp,
    };
  }
  if (comp.intent === 'greeting') {
    return { text: `أهلاً بيك يا صاحب الموقع 🏛️ أنا ${STATE.nameAr}. ${STATE.placeAr}\n\n${HELP}`, comprehension: comp };
  }
  if (comp.intent === 'help') return { text: HELP, comprehension: comp };
  return { text: `مش متأكدة إني فهمت قصدك، ومش هخمّن. ${HELP}`, comprehension: comp };
}

/** The State's synchronous local answer to one message of the owner (with optional conversation memory). */
export function stateReply(message: string, ctx: StateRoomContext, history?: StateRoomMessage[]): StateReplyResult {
  const raw = message.trim();
  if (!normalize(raw)) return { text: HELP };
  const comp = comprehendOwnerCommand(raw, ctx, history);
  return renderComprehensionReply(comp, ctx);
}

// ── The room as kept in the owner's browser (sealed with his code, like Shaheen's room) ─────────────────────
export const STATE_ROOM_KEY = 'sham_state_room_v1';
export interface StateRoomMessage {
  id: string;
  by: 'owner' | 'state';
  text: string;
  at: string;
  order?: StateOrder;
  orders?: StateOrder[];
  sent?: boolean;
}
export interface StateRoomData { version: 1; messages: StateRoomMessage[] }
/** Questions the room suggests before the first message (the State speaks Arabic, so they stay Arabic). */
export const STATE_ROOM_STARTERS = ['إيه المستجدات؟', 'قوانين المنصة', 'مين الروبوتات الواقفة؟', 'مين الأعضاء؟'];
export const STATE_ROOM_LIMITS = { messages: 200, chars: 2000 } as const;
export function readStateRoom(x: unknown): StateRoomData {
  const d = (x && typeof x === 'object' ? x : {}) as Partial<StateRoomData>;
  const messages = (Array.isArray(d.messages) ? d.messages : [])
    .filter((m): m is StateRoomMessage => Boolean(m && (m.by === 'owner' || m.by === 'state') && typeof m.id === 'string' && typeof m.text === 'string' && typeof m.at === 'string'))
    .map((m) => {
      const validSingle = m.order ? parseStateOrder(`<!-- ${MARK} ${JSON.stringify(m.order)} -->`) : undefined;
      const validMany = Array.isArray(m.orders) ? parseStateOrders(`<!-- ${PLAN_MARK} ${JSON.stringify(m.orders)} -->`) : [];
      return {
        id: m.id,
        by: m.by,
        text: m.text.slice(0, 8000),
        at: m.at,
        ...(validSingle ? { order: validSingle } : validMany[0] ? { order: validMany[0] } : {}),
        ...(validMany.length ? { orders: validMany } : {}),
        ...(m.sent ? { sent: true } : {}),
      };
    })
    .slice(-STATE_ROOM_LIMITS.messages);
  return { version: 1, messages };
}
