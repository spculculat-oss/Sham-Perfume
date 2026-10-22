/**
 * «غرفة دولة المنصة» — the owner's private chat with the Platform State (his decision, 2026-10-22), and the State's
 * orders.
 *
 * The State answers from its own rules and the platform's live reports: no outside AI platform (rule O-10), so it
 * works on the main site even when every engine is off. It tells the owner how things stand (decisions, robots,
 * supervision, laws), discusses his orders and decides whether each one is right; an order it accepts becomes a card
 * whose «نفّذ» opens a request from the owner's own GitHub account (GitHub proves who sent it), and the State's robot
 * carries it out within a minute (scripts/state/run.mts). The same judge runs again there, so nothing reaches the
 * robots that the State would not accept.
 *
 * Pure (browser-safe): the owner's suite, the State's robot and the tests all read it.
 */
import { BOTS, type Bot } from './shaheenOrg';
import { OWNER, hasSensitiveNumber, stoppedByOwner, type OwnerControls } from './ownerAuthority';
import { orderableBots } from './ownerDesk';
import { AGENT_LINK, agentLinkStatusAr } from './agentLink';
import {
  STATE, STATE_CONSTITUTION, STATE_MEMBERS, STATE_ORDERS_LIMITS, STATE_OUTCOMES, nextLawId, stateActive,
  type StateOrderAction, type StateOrderEntry, type StateOrders, type StateReport,
} from './platformState';

// ── Orders ──────────────────────────────────────────────────────────────────────────────────────────────────
export interface StateOrder { action: StateOrderAction; target?: string; textAr?: string; whyAr: string }
export const STATE_ORDER_ACTIONS: Record<StateOrderAction, string> = { pause: 'وقف روبوت', resume: 'رجوع روبوت', run: 'تشغيل روبوت دلوقتي', law: 'قانون جديد', repeal: 'إلغاء قانون' };
/** The title prefix of the owner's requests to the State (the owner's desk only reads «[شاهين] »). */
export const STATE_ISSUE_PREFIX = '[الدولة] ';
const MARK = 'sham-state-order';

/** The robots the State may give orders to: every robot with a workflow, except the State itself and the owner's desk. */
export const stateOrderableBots = (): Bot[] => orderableBots().filter((b) => b.id !== 'state');
const botLabel = (id?: string) => (id === AGENT_LINK.id ? AGENT_LINK.nameAr : BOTS.find((b) => b.id === id)?.nameAr ?? id ?? '');
const sharing = (id: string) => { const wf = BOTS.find((b) => b.id === id)?.workflow; return BOTS.filter((b) => wf && b.workflow === wf).map((b) => b.id as string); };

// What a law may not do: reach the owner's data, overrule the owner, or undo the legal manager's binding decisions.
const LAW_OWNER_DATA = /بيانات صاحب الموقع|البيانات الشخصي|مفاتيح صاحب|كلمه السر|كلمة السر|الكود السري|غرفه شاهين|غرفة شاهين|رقم قومي|بطاقه|بطاقة/;
const LAW_OVER_OWNER = /(?:من غير|بدون|ضد|يلغي|تلغي|يمنع|تمنع|يتجاهل|تتجاهل|مايسمعش|ماتسمعش|محدش يسمع).{0,25}صاحب الموقع|صاحب الموقع.{0,25}(?:مالوش|ماليش|ممنوع|ميقدرش|مايقدرش|ملوش)/;
const LAW_LEGAL = /(?:شيل|الغي|الغاء|إلغاء|ألغي|ارجع|رجع|افتح|كمل|كمّل).{0,25}(?:نقل|استيراد) المنتجات|L-03/i;

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
  const law = ctx.orders.laws.find((l) => l.id === (o.target || '').toUpperCase());
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
    const id = o.target.toUpperCase();
    if (next.laws.some((l) => l.id === id)) {
      next.laws = next.laws.filter((l) => l.id !== id);
      entry = { at, action: 'repeal', target: id, noteAr: `ألغيت القانون ${id}: ${o.whyAr}`, by: 'state' };
    }
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

/** The request the «نفّذ» button opens from the owner's account (the State's robot reads only his own requests). */
export function stateOrderIssue(o: StateOrder): { title: string; body: string } {
  const what = o.action === 'law' ? `${STATE_ORDER_ACTIONS.law}: ${(o.textAr || '').slice(0, 60)}` : o.action === 'repeal' ? `${STATE_ORDER_ACTIONS.repeal} ${o.target}` : `${STATE_ORDER_ACTIONS[o.action]}: ${botLabel(o.target)}`;
  const clean: StateOrder = { action: o.action, ...(o.target ? { target: o.target } : {}), ...(o.textAr ? { textAr: o.textAr.slice(0, STATE_ORDERS_LIMITS.lawChars) } : {}), whyAr: o.whyAr.slice(0, 300) };
  return {
    title: `${STATE_ISSUE_PREFIX}${what}`.slice(0, 120),
    body: [`🏛️ **أمر لـ${STATE.nameAr}** من غرفتها الخاصة في جناح صاحب الموقع.`, '', `- **الأمر:** ${what}`, `- **رأي الدولة:** ${o.whyAr}`, '',
      'الدولة هتنفذه خلال دقيقة وترد هنا، وبعدين تقفل الطلب. اضغط «Submit new issue» (إنشاء الطلب).', '', `<!-- ${MARK} ${JSON.stringify(clean)} -->`].join('\n'),
  };
}
export const stateOrderUrl = (o: StateOrder) => { const i = stateOrderIssue(o); return `https://github.com/${OWNER.repo}/issues/new?title=${encodeURIComponent(i.title)}&body=${encodeURIComponent(i.body)}`; };

/** The order inside the owner's request (anything malformed is dropped). */
export function parseStateOrder(body: string | null | undefined): StateOrder | undefined {
  const m = new RegExp(`<!--\\s*${MARK}\\s+(\\{[\\s\\S]*?\\})\\s*-->`).exec(body || '');
  if (!m) return undefined;
  try {
    const o = JSON.parse(m[1]) as Partial<StateOrder>;
    if (!o || typeof o.action !== 'string' || !(o.action in STATE_ORDER_ACTIONS)) return undefined;
    const target = typeof o.target === 'string' ? o.target.slice(0, 40) : undefined;
    const textAr = typeof o.textAr === 'string' ? o.textAr.slice(0, STATE_ORDERS_LIMITS.lawChars) : undefined;
    if ((o.action === 'law' && !textAr) || (o.action !== 'law' && !target)) return undefined;
    return { action: o.action as StateOrderAction, ...(target ? { target } : {}), ...(textAr ? { textAr } : {}), whyAr: typeof o.whyAr === 'string' ? o.whyAr.slice(0, 300) : '' };
  } catch { return undefined; }
}

// ── The State's chat ────────────────────────────────────────────────────────────────────────────────────────
export interface StateRoomContext {
  controls: OwnerControls;
  orders: StateOrders;
  report: StateReport;
  precheck?: { health?: number; bots?: { id: string; status: string; problems?: string[] }[] };
  /** Open requests waiting for the State (from GitHub, when the suite could read them). */
  pending?: { pulls: number; tasks: number };
}
export interface StateReplyResult { text: string; order?: StateOrder }

export function normalize(text: string): string {
  return text.toLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/\s+/g, ' ').trim();
}
const stem = (w: string) => w.replace(/^(?:وال|بال|فال|لل|ال|و)(?=.{3,})/, '');
const STOP = new Set(['روبوت', 'الروبوت', 'شاهين', 'دوله', 'المنصه', 'منصه', 'بتاع', 'بتاعه', 'خاص', 'اللي', 'كل', 'مع', 'من', 'في', 'على', 'علي']);
const words = (text: string) => normalize(text).split(/[^\p{L}\p{N}_]+/u).filter((w) => w.length >= 3 && !STOP.has(w)).map(stem).filter((w) => w.length >= 3 && !STOP.has(w));

/** Which robot the owner means: by its id, or by the words of its Arabic name. Several equally likely → ask. */
export function findBot(text: string): { bot?: Bot; candidates: Bot[] } {
  const n = normalize(text);
  const bots = stateOrderableBots();
  const byId = bots.find((b) => new RegExp(`(?:^|[^a-z_])${b.id}(?:$|[^a-z_])`).test(n));
  if (byId) return { bot: byId, candidates: [byId] };
  const said = new Set(words(text));
  const scored = bots.map((b) => ({ b, score: words(b.nameAr).filter((w) => said.has(w)).length })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  if (!scored.length) return { candidates: [] };
  const top = scored.filter((x) => x.score === scored[0].score).map((x) => x.b);
  return top.length === 1 ? { bot: top[0], candidates: top } : { candidates: top.slice(0, 5) };
}

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
  'أقدر أعمل معاك الحاجات دي:',
  '- «إيه الوضع؟» أو «إيه المستجدات؟»: تقرير سريع عن قراراتي والروبوتات.',
  '- «قراراتك» أو «قوانين المنصة» أو «مين الأعضاء؟».',
  '- «وقف روبوت الأخبار» أو «رجّع روبوت الأخبار» أو «شغّل الدورية دلوقتي»: أوامر بتنفذها الدولة.',
  '- «قانون جديد: …» أو «الغي القانون P-01»: قوانين المنصة.',
  '- «الربط المباشر» أو «وقف الربط المباشر»: الربط بين وكيل شاهين وشاهين (S-10).',
  'أي أمر بشوفه الأول: لو صح من وجهة نظري بجهزه، ولو لأ بقولك ليه.',
].join('\n');

/** The State's answer to one message of the owner. */
export function stateReply(message: string, ctx: StateRoomContext): StateReplyResult {
  const raw = message.trim();
  const n = normalize(raw);
  if (!n) return { text: HELP };
  if (hasSensitiveNumber(raw)) return { text: '⚠️ رسالتك فيها رقم شكله رقم بطاقة أو رقم قومي أو حساب. أنا مابشوفش بياناتك الشخصية ومابحفظهاش — امسحها من عندك، ومتكتبهاش هنا تاني.' };
  const refuse = (reasonAr: string): StateReplyResult => ({ text: `❌ مش هنفذ ده: ${reasonAr}` });
  const accept = (o: StateOrder, reasonAr: string): StateReplyResult => ({ text: `✅ شايفة إن الأمر ده صح. ${reasonAr}\n\nاضغط «نفّذ» تحت، وأنا هنفذه خلال دقيقة وأسجله في سجلي.`, order: o });
  const decide = (o: StateOrder): StateReplyResult => {
    const v = judgeStateOrder(o, ctx);
    return v.ok ? accept({ ...o, whyAr: o.whyAr || v.reasonAr }, v.reasonAr) : refuse(v.reasonAr);
  };

  // Laws: repeal, then a new one.
  const repeal = /(?:الغي|الغاء|شيل|امسح|احذف|حذف)\s*(?:ال)?قانون\s*(?:رقم\s*)?(p\s*-?\s*\d+)/i.exec(n);
  if (repeal) return decide({ action: 'repeal', target: `P-${String(Number(repeal[1].replace(/\D/g, ''))).padStart(2, '0')}`, whyAr: 'بأمر صاحب الموقع من غرفة الدولة.' });
  const law = /^(?:قانون جديد|ضيف قانون|ضيفي قانون|اضف قانون|اضيفي قانون|حط قانون|حطي قانون|عايز قانون|عاوز قانون)\s*[:：\-–]?\s*([\s\S]+)$/.exec(raw.replace(/[أإآ]/g, 'ا'));
  if (law) return decide({ action: 'law', textAr: law[1].trim(), whyAr: 'قانون اقترحه صاحب الموقع في غرفة الدولة.' });

  // Orders to a robot.
  const now = /(?:دلوقتي|حالا|الان|فورا|now)/.test(n);
  const pauseVerb = /(?:^|\s)(?:وقف|وقفي|اوقف|اوقفي|ايقاف|استوب|pause|عطل|عطلي|اقفل|اقفلي)(?:\s|$)/.test(n);
  const resumeVerb = /(?:^|\s)(?:رجع|رجعي|ارجع|ارجعي|رجوع|resume|فعل|فعلي|تفعيل)(?:\s|$)/.test(n);
  const runVerb = /(?:^|\s)(?:شغل|شغلي|تشغيل|run|شغله|شغليه)(?:\s|$)/.test(n);
  // S-10: the direct link between Shaheen's agent and Shaheen.
  if (/(?:الربط|ربط|agent_link)/.test(n) && /(?:وكيل|شاهين|المباشر|agent_link)/.test(n)) {
    if (pauseVerb) return decide({ action: 'pause', target: AGENT_LINK.id, whyAr: '' });
    if (resumeVerb || runVerb) return decide({ action: 'resume', target: AGENT_LINK.id, whyAr: '' });
    return { text: [`🔗 **${AGENT_LINK.nameAr}:** ${agentLinkStatusAr(ctx.orders, ctx.controls)}.`, '', `- ${STATE_CONSTITUTION.find((r) => r.id === 'S-10')?.textAr ?? ''}`, '- تقدر تقولّي «وقف الربط المباشر» أو «رجّع الربط المباشر».'].join('\n') };
  }
  if (pauseVerb || resumeVerb || runVerb) {
    const { bot, candidates } = findBot(raw);
    if (!bot) {
      if (candidates.length) return { text: `قصدك أنهي واحد؟ ${candidates.map((b) => `«${b.nameAr}»`).join(' أو ')}` };
      if (!/روبوت|الروبوتات|بوت/.test(n) && !now) return unknown();
      return { text: `أنهي روبوت؟ مثلاً: ${stateOrderableBots().slice(0, 6).map((b) => `«${b.nameAr}»`).join('، ')}.` };
    }
    const action: StateOrderAction = pauseVerb ? 'pause' : resumeVerb ? 'resume' : now || !ctx.orders.paused.includes(bot.id) ? 'run' : 'resume';
    return decide({ action, target: bot.id, whyAr: '' });
  }

  if (/(?:قانون|قوانين|دستور|قواعد|لوايح|لوائح)/.test(n)) return { text: lawsText(ctx) };
  if (/(?:قرار|قرارات|وافقتي|رفضتي|وافقت|رفضت)/.test(n)) {
    const d = ctx.report.decisions.slice(0, 10);
    return { text: d.length ? ['**آخر قراراتي:**', ...d.map((x) => `- #${x.number} ${x.title} — ${STATE_OUTCOMES[x.outcome]} (${x.tally.approve} موافقة، ${x.tally.refuse} رفض، ${x.tally.veto} فيتو)`)].join('\n') : 'لسه ماخدتش قرارات. بقرر كل ساعة في تعديلات الروبوتات ومهام المجلس اللي مستنية.' };
  }
  if (/(?:اعضاء|عضو|مين في الدوله|بتصوت|التصويت)/.test(n)) {
    return { text: ['**أعضائي (كل واحد بيصوّت لوحده في نطاقه):**', ...STATE_MEMBERS.map((m) => `- ${m.nameAr}${m.veto ? ' (ليه فيتو)' : ''}: ${m.scopeAr}`), '', 'القرار بالتوافق: 3 موافقات على الأقل ومن غير أي اعتراض.'].join('\n') };
  }
  if (/(?:الوضع|الاوضاع|اخبار|مستجد|جديد|تقرير|حصل ايه|ايه اللي حصل|عامله ايه|حالتك|الحاله|ملخص)/.test(n)) return { text: statusText(ctx) };
  if (/(?:روبوت|الروبوتات|مين واقف|مين شغال|موقوف|واقفين)/.test(n)) {
    const p = pausedList(ctx);
    const failing = (ctx.precheck?.bots || []).filter((b) => b.status === 'fail').map((b) => `${botLabel(b.id)}: ${(b.problems || [])[0] || 'فيه مشكلة'}`).slice(0, 6);
    return { text: [`- موقوف بأمرك: ${p.owner.join('، ') || 'مفيش'}.`, `- موقوف بأمري: ${p.state.join('، ') || 'مفيش'}.`, ...(failing.length ? ['', '**روبوتات عندها مشاكل:**', ...failing.map((x) => `- ${x}`)] : ['- مفيش روبوت عنده عطل مسجل دلوقتي.'])].join('\n') };
  }
  if (/(?:السلام|اهلا|هاي|هلا|صباح|مساء|ازيك|ازيكي|مرحبا)/.test(n)) return { text: `أهلاً بيك يا صاحب الموقع 🏛️ أنا ${STATE.nameAr}. ${STATE.placeAr}\n\n${HELP}` };
  if (/(?:تقدري|بتعملي|تعملي ايه|مساعده|ساعديني|ساعدني|help|ازاي)/.test(n)) return { text: HELP };
  return unknown();
}

function unknown(): StateReplyResult {
  return { text: `مش متأكدة إني فهمت قصدك، ومش هخمّن. ${HELP}` };
}

// ── The room as kept in the owner's browser (sealed with his code, like Shaheen's room) ─────────────────────
export const STATE_ROOM_KEY = 'sham_state_room_v1';
export interface StateRoomMessage { id: string; by: 'owner' | 'state'; text: string; at: string; order?: StateOrder; sent?: boolean }
export interface StateRoomData { version: 1; messages: StateRoomMessage[] }
/** Questions the room suggests before the first message (the State speaks Arabic, so they stay Arabic). */
export const STATE_ROOM_STARTERS = ['إيه المستجدات؟', 'قوانين المنصة', 'مين الروبوتات الواقفة؟', 'مين الأعضاء؟'];
export const STATE_ROOM_LIMITS = { messages: 200, chars: 2000 } as const;
export function readStateRoom(x: unknown): StateRoomData {
  const d = (x && typeof x === 'object' ? x : {}) as Partial<StateRoomData>;
  const messages = (Array.isArray(d.messages) ? d.messages : [])
    .filter((m): m is StateRoomMessage => Boolean(m && (m.by === 'owner' || m.by === 'state') && typeof m.id === 'string' && typeof m.text === 'string' && typeof m.at === 'string'))
    .map((m) => ({ id: m.id, by: m.by, text: m.text.slice(0, 8000), at: m.at, ...(m.order && parseStateOrder(`<!-- ${MARK} ${JSON.stringify(m.order)} -->`) ? { order: parseStateOrder(`<!-- ${MARK} ${JSON.stringify(m.order)} -->`) } : {}), ...(m.sent ? { sent: true } : {}) }))
    .slice(-STATE_ROOM_LIMITS.messages);
  return { version: 1, messages };
}
