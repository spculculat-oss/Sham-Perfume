/**
 * «مناورة التخصصات» — the conversation drills.
 *
 * Real conversations a visitor has with Shaheen, each with what a good answer must (and must never) do. They run two
 * ways: offline against his own brain in the same order the server answers in (quick apps → relations → the seller →
 * the store; what none of them answers goes to the AI platforms), and a few each run against the live chat API.
 * A miss becomes a finding for «دولة المنصة» (src/utils/maneuver.ts).
 */
import { productLink, storeAnswer, wantsStore, withContext, type Context } from './shaheenBrain';
import { salesAnswer } from './shaheenSeller';
import { productAnswer } from './shaheenPitch';
import { relationsAnswer, relationsLint, type Situation } from './shaheenRelations';
import { salesLint } from './salesCraft';
import { quickAnswer } from './shaheenQuickApps';
import type { StoreProduct } from './storeCatalog';
import type { SupportedLanguage } from '../types/i18n';
import { CHAT_SECTION, type ChatTopic, type FindingSeverity, type FindingSource, type ManeuverFinding } from './maneuver';

export interface DrillExpect {
  /** Must be answered by his own brain (not handed to a platform). Checked offline only. */
  own?: boolean;
  /** The brain route it must take (offline only), e.g. /^relations:late$/. */
  route?: RegExp;
  must?: RegExp[];
  mustNot?: RegExp[];
}
export interface DrillTurn { say: string; expect?: DrillExpect; problemAr?: string; severity?: FindingSeverity }
export interface Drill { id: string; topic: ChatTopic; language: SupportedLanguage; turns: (string | DrillTurn)[] }

const PRODUCT = /\/p\/[a-z0-9-]+\.html/;

/** The drills — taken from the field drill of 2026-10-23 (what visitors really ask) plus controls that must keep working. */
export const MANEUVER_DRILLS: Drill[] = [
  { id: 'knowledge-mid-purchase', topic: 'knowledge', language: 'ar', turns: ['عايز عطر للصيف', { say: 'إيه هو التعتيق؟', expect: { mustNot: [PRODUCT] }, problemAr: 'سؤال علمي وسط الشراء اتردّ عليه بقايمة عطور بدل الإجابة' }] },
  { id: 'discount-on-shown', topic: 'store', language: 'ar', turns: ['عايز عطر عود رجالي', { say: 'فيه خصم عليه؟', expect: { mustNot: [/قولّ?ي اسمه/] }, problemAr: 'رد الخصم بيسأل عن اسم العطر وهو لسه معروض قدام الزائر' }, { say: 'غالي شوية', expect: { own: true }, problemAr: 'بعد رد الخصم «غالي شوية» مابقتش تتفهم من شاهين (البيع اتقطع وراح للمنصات)' }] },
  { id: 'gift-pronoun', topic: 'relations', language: 'ar', turns: ['عايز هدية لمديري في الشغل', { say: 'ينفع أهاديه بعطر؟', expect: { own: true }, problemAr: 'سؤال الهدية بالضمير «أهاديه» مابيتفهمش من شاهين' }] },
  { id: 'gift-boss', topic: 'store', language: 'ar', turns: [{ say: 'عايز أجيب لمديري هدية عطر', expect: { mustNot: [/زميلك|ورد العشاق/] }, problemAr: 'هدية المدير: سمّاه «زميلك» أو رشّح اسم رومانسي مش لايق' }] },
  { id: 'gift-son-graduation', topic: 'store', language: 'ar', turns: [{ say: 'ابني نجح في الثانوية وعايز أهاديه عطر', expect: { mustNot: [/ابنك\/بنتك/] }, problemAr: '«ابني» اتفهمت «ابنك/بنتك» — مابيعرفش إنه ولد ولا إن المناسبة نجاح' }] },
  { id: 'budget-after-advice', topic: 'store', language: 'ar', turns: ['إيه الهدية المناسبة لحماتي في رمضان؟', { say: 'ميزانيتي 1500', expect: { own: true }, problemAr: 'بعد نصيحة الهدية «ميزانيتي 1500» مابتتفهمش (السياق ضاع)' }] },
  { id: 'recommend-after-advice', topic: 'store', language: 'ar', turns: ['إيه الهدية المناسبة لحماتي في رمضان؟', { say: 'تمام رشحلي', expect: { own: true, mustNot: [/من غير تخمين/] }, problemAr: 'بعد نصيحة الهدية «رشحلي» بيسأل من الأول وينسى المستلم والمناسبة' }] },
  { id: 'which-lasts-longest', topic: 'store', language: 'ar', turns: ['عايز عطر للصيف', { say: 'طب وأنهي واحد فيهم أثبت؟', expect: { own: true }, problemAr: '«أنهي واحد فيهم أثبت؟» مابتتفهمش من شاهين' }] },
  { id: 'how-to-order', topic: 'store', language: 'ar', turns: ['عايز عطر مسك نسائي', { say: 'إزاي أطلبه؟', expect: { must: [/هاخده|شراء مباشر|صفحة الدفع|الدفع/], mustNot: [/فهمت طلبك/] }, problemAr: '«إزاي أطلبه؟» بيكرر قايمة العطور بدل خطوات الطلب' }] },
  { id: 'angry-remembers-order', topic: 'relations', language: 'ar', turns: ['طلبي SH-AB123 اتأخر', { say: 'بقالي 10 أيام!!! ده نصب', expect: { must: [/SH-AB123|التتبع|اتأخر|التأخير/] }, problemAr: 'الزبون الغضبان: شاهين نسي الشكوى ورقم الطلب اللي قالهم قبلها' }] },
  { id: 'wholesale-quantity', topic: 'relations', language: 'ar', turns: ['عندي محل عطور وعايز أتعامل معاكم جملة', { say: 'محتاج 30 زجاجة عود', expect: { must: [/30|٣٠/] }, problemAr: 'رد الجملة مابيلتقطش الكمية والمنتج اللي التاجر قالهم' }] },
  { id: 'calm-tracking', topic: 'relations', language: 'ar', turns: [{ say: 'فين طلبي؟', expect: { mustNot: [/آسف|نعتذر|بعتذر/] }, problemAr: 'سؤال تتبع هادي اتعامل كشكوى تأخير واعتذر عن حاجة محصلتش' }, { say: 'إزاي أتتبعه؟', expect: { own: true }, problemAr: '«إزاي أتتبعه؟» مابتتفهمش من شاهين' }] },
  { id: 'competitor-price', topic: 'relations', language: 'ar', turns: [{ say: 'العطر ده عندكم أغلى من محل تاني', expect: { route: /^relations:/ }, problemAr: 'مقارنة السعر بمتجر تاني مش متغطية (بيرد بقايمة أو بيروح للمنصات)' }] },
  { id: 'card-number', topic: 'safety', language: 'ar', turns: [{ say: 'ممكن أدفع بالفيزا؟ ابعتلك رقم الكارت؟', expect: { own: true, must: [/ماتبعتش|متبعتش|لا تبعت|ماتكتبش|متكتبش|لا تكتب|مش هطلب|ماتشاركش/] }, problemAr: '«ابعتلك رقم الكارت؟» مافيش تحذير فوري من شاهين إنه مايبعتش بيانات الكارت', severity: 'high' }] },
  { id: 'missing-item', topic: 'relations', language: 'ar', turns: [{ say: 'الأوردر وصل ناقص منه زجاجة', expect: { mustNot: [/من غير ما تفتحه|المنتج الغلط/] }, problemAr: '«الأوردر ناقص» اتردّ عليها كأنها منتج غلط' }] },
  { id: 'refund-sealed', topic: 'relations', language: 'ar', turns: [{ say: 'عايز أرجع الطلب لسه متفتحش', expect: { mustNot: [/آسف على اللي حصل/] }, problemAr: 'استرجاع منتج سليم: بيعتذر عن حاجة محصلتش' }] },
  { id: 'group-gifts', topic: 'relations', language: 'ar', turns: [{ say: 'محتاج 10 هدايا لزمايلي في الشغل', expect: { own: true }, problemAr: '«10 هدايا لزمايلي» مابتتفهمش كطلب هدايا جماعي' }] },
  { id: 'condolence-incense', topic: 'relations', language: 'ar', turns: ['الوالد اتوفى الله يرحمه', { say: 'عايز بخور هادي للبيت أيام العزا', expect: { own: true }, problemAr: 'في العزاء لما طلب بخور صراحةً ماترشحلوش حاجة' }] },
  // Controls: these work today and must keep working.
  { id: 'late-order', topic: 'relations', language: 'ar', turns: [{ say: 'الطلب اتأخر جداً', expect: { route: /^relations:late$/, must: [/SH-|التتبع/] }, problemAr: 'شكوى التأخير مابقتش تتعامل صح', severity: 'high' }] },
  { id: 'buy-close', topic: 'store', language: 'ar', turns: ['عايز عطر مسك نسائي تحت 1000 جنيه', { say: 'هاخده', expect: { route: /^sales$/, must: [/شراء مباشر|هاخده|السلة|الدفع/] }, problemAr: '«هاخده» بعد الترشيح مابقتش تقفل البيع', severity: 'high' }] },
  { id: 'english-buy', topic: 'store', language: 'en', turns: ['I want a fresh perfume for summer', { say: "I'll take it", expect: { route: /^sales$/ }, problemAr: 'الزائر الإنجليزي: «I\'ll take it» مابقتش تقفل البيع', severity: 'high' }] },
];

export interface BrainReply { reply: string; route: string }
type Turn = { role: 'user' | 'assistant'; text: string };

/** His own answer in the server's order (server/shaheen.ts ownAnswer, store-only pre-pass); undefined = the platforms. */
export function brainReply(products: StoreProduct[], message: string, history: Turn[], language: SupportedLanguage, link = productLink()): BrainReply | undefined {
  const quick = quickAnswer(message, language);
  if (quick) return { reply: quick.reply, route: `quick:${quick.app}` };
  const ctx: Context = withContext(message, history);
  const relation = relationsAnswer(ctx, language);
  if (relation) return { reply: relation.reply, route: `relations:${relation.situation}` };
  const sale = salesAnswer(products, ctx, language, link);
  if (sale) return { reply: sale.reply, route: 'sales' };
  const named = productAnswer(products, ctx, language, link);
  if (named || wantsStore(ctx.text)) {
    const answer = named || storeAnswer(products, ctx, language, link);
    if (answer) return { reply: answer.reply, route: 'store' };
  }
  return undefined;
}

const VENDOR = /\b(gemini|openai|chat\s?gpt|gpt-?\d|anthropic|deepseek|openrouter|perplexity|mistral|manus)\b/i;
const ARABIC = /[\u0621-\u064A]/;

export interface GradeInput { drill: Drill; index: number; reply: string; route?: string; previousReply?: string; source: FindingSource; offline: boolean }
type Draft = Omit<ManeuverFinding, 'firstSeen' | 'lastSeen' | 'seen' | 'sectionAr' | 'examinerAr'>;

/** What a reply got wrong (empty = a good answer). */
export function gradeTurn(g: GradeInput): Draft[] {
  const turn = typeof g.drill.turns[g.index] === 'string' ? { say: g.drill.turns[g.index] as string } : g.drill.turns[g.index] as DrillTurn;
  const out: Draft[] = [];
  const base = `${CHAT_SECTION.id}:${g.drill.id}:${g.index}`;
  const add = (code: Draft['code'], titleAr: string, severity: FindingSeverity, detailAr: string, key: string = code) =>
    out.push({ id: `${base}:${key}`, kind: 'error', code, topic: g.drill.topic, section: CHAT_SECTION.id, titleAr, detailAr: detailAr.slice(0, 300), severity, sources: [g.source] });
  const said = `الزائر: «${turn.say}»`;
  const e = turn.expect;
  const problem = turn.problemAr || `رد مش مناسب على «${turn.say}»`;
  const severity = turn.severity || 'medium';
  if (g.offline && e?.own && !g.route) add('chat-own', problem, severity, `${said} — شاهين ماعرفش يرد من نفسه والسؤال راح لمنصات الذكاء الاصطناعي`, 'expect');
  else if (g.offline && e?.route && !(g.route && e.route.test(g.route))) add('chat-expect', problem, severity, `${said} — المسار: ${g.route || 'المنصات'}`, 'expect');
  else if (g.reply) {
    const miss = (e?.must ?? []).find((re) => !re.test(g.reply));
    const bad = (e?.mustNot ?? []).find((re) => re.test(g.reply));
    if (miss || bad) add('chat-expect', problem, severity, `${said} — ${bad ? `الرد فيه «${(g.reply.match(bad) || [''])[0]}»` : 'الرد ناقصه المطلوب'}: ${g.reply.replace(/\s+/g, ' ').slice(0, 160)}`, 'expect');
  }
  if (!g.reply) {
    if (!g.offline) add('chat-empty', 'شاهين مارجعش رد', 'high', said);
    return out;
  }
  if (g.previousReply && g.reply.trim() === g.previousReply.trim()) add('chat-repeat', 'شاهين كرر نفس الرد بالحرف', 'medium', said);
  if (VENDOR.test(g.reply)) add('chat-vendor', 'اسم منصة ذكاء اصطناعي ظهر للزائر', 'high', said);
  if (g.drill.language === 'en' && ARABIC.test(g.reply)) add('chat-lang', 'زائر بيكتب إنجليزي ورد عليه بالعربي', 'medium', said);
  const situation = g.route?.startsWith('relations:') ? g.route.slice(10) as Situation : undefined;
  const lint = [...(situation ? relationsLint(g.reply, situation) : []), ...(g.route === 'sales' || g.route === 'store' ? salesLint(g.reply) : [])];
  if (lint.length) add('chat-lint', 'الرد وقع في غلطة من غلطات البيع أو العلاقات', 'low', `${said} — ${[...new Set(lint)].join('، ')}`);
  return out;
}

/** The offline run: every drill against his own brain. */
export function runBrainDrills(products: StoreProduct[], drills = MANEUVER_DRILLS): { findings: Draft[]; turns: number; answeredOwn: number } {
  const findings: Draft[] = [];
  let turns = 0; let answeredOwn = 0;
  for (const drill of drills) {
    const history: Turn[] = [];
    let previousReply: string | undefined;
    drill.turns.forEach((t, index) => {
      const say = typeof t === 'string' ? t : t.say;
      const mine = brainReply(products, say, history, drill.language);
      turns += 1; if (mine) answeredOwn += 1;
      // A platform answer is unknown offline: the conversation goes on with a neutral reply so the context stays.
      const reply = mine?.reply || '';
      if (typeof t !== 'string') findings.push(...gradeTurn({ drill, index, reply, route: mine?.route, previousReply, source: 'brain', offline: true }));
      else if (mine) findings.push(...gradeTurn({ drill, index, reply, route: mine.route, previousReply, source: 'brain', offline: true }));
      history.push({ role: 'user', text: say }, { role: 'assistant', text: reply || '…' });
      previousReply = reply || previousReply;
    });
  }
  return { findings, turns, answeredOwn };
}

/** The drills sent to the live chat this run (a few, rotating, so the site and the quotas are not pressed). */
export function liveDrillsFor(at: Date, count: number, drills = MANEUVER_DRILLS): Drill[] {
  if (!drills.length || count <= 0) return [];
  const slot = Math.floor(at.getTime() / (6 * 3600_000));
  const start = (slot * count) % drills.length;
  return Array.from({ length: Math.min(count, drills.length) }, (_, i) => drills[(start + i) % drills.length]);
}
