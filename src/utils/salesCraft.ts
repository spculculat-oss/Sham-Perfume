/**
 * «علم البيع» — the owner (2026-10-23), after a product reply that read like a label («القاعدة: Spicy، Musky SUPREMACY
 * PURPLE»، «خفيف لمتوسط، جدّده»، «لو السعر مش مريحك قولّي غالي»): «دة رد مش احترافى» — Shaheen must know how to make
 * the customer convinced, must know what merchants say that makes a sale fail and avoid it, and must read the asker's
 * inclinations and personality.
 *
 * Three parts, all pure and browser-safe (the chat server, the browser fallback and the AI prompts share them):
 *  1. readBuyer: the asker read from his own words — his stage (looking, comparing, ready, objecting), his motive
 *     (a gift, himself, an occasion, a signature scent, value), his style (the four social styles: the direct, the
 *     analytical, the expressive and the cautious buyer), who the gift is for, his budget sensitivity, his expertise
 *     and his urgency. Only what his messages say; nothing is guessed about him beyond that.
 *  2. The craft as data: SALES_PRINCIPLES (what sells) and SALES_PITFALLS (what kills a sale), each from a known body
 *     of sales research, in Arabic and English — fed to the AI engines (salesPromptBlock) and used by his own replies.
 *  3. salesLint / polishSale: the pitfalls detected in a reply (his templates are tested against them), and the
 *     sentences that kill a sale removed from a platform's reply before the visitor reads it.
 */

type Lang = 'ar' | 'en';

// ── 1. Reading the buyer ─────────────────────────────────────────────────────────────────────────────────────────
/** The four social styles, and «friendly» when his words show none of them yet (warm, short, one question). */
export type BuyerStyle = 'direct' | 'analytical' | 'expressive' | 'cautious' | 'friendly';
type Scored = Exclude<BuyerStyle, 'friendly'>;
export type BuyerMotive = 'gift' | 'occasion' | 'signature' | 'value' | 'self';
export type BuyerStage = 'looking' | 'comparing' | 'ready' | 'objecting';
export type Recipient = 'wife' | 'husband' | 'fiancee' | 'fiance' | 'mother' | 'father' | 'sister' | 'brother' | 'friend_m' | 'friend_f' | 'colleague'
  | 'boss' | 'teacher' | 'mother_in_law' | 'father_in_law' | 'son' | 'daughter' | 'child';
/** Recipients a romantic perfume name («ورد العشاق») does not suit. */
export const FORMAL_RECIPIENTS: ReadonlySet<Recipient> = new Set(['colleague', 'boss', 'teacher', 'mother_in_law', 'father_in_law', 'mother', 'father', 'son', 'daughter', 'child', 'sister', 'brother']);

export interface BuyerProfile {
  style: BuyerStyle;
  motive: BuyerMotive;
  stage: BuyerStage;
  recipient?: Recipient;
  /** «غالي»، «ميزانيتي»، «أرخص»: the price weighs on him — lead with value, never with the bill. */
  budgetSensitive: boolean;
  /** He uses the perfumer's words (notes, concentrations, houses): talk to him as a connoisseur. */
  connoisseur: boolean;
  /** «بكرة»، «العيد»، «النهاردة»: he needs it soon — the delivery steps matter more than the story. */
  urgent: boolean;
  /** How strongly each style showed (for the admin's view and the tests). */
  scores: Record<Scored, number>;
}

/** Arabic letters only (the punctuation «؟ ،» is in the Arabic block too and ends a word). */
const AR = '\\u0621-\\u063A\\u0640-\\u065F\\u0670-\\u06D3';
const W = (words: string) => new RegExp(`(?<![${AR}])(?:${words})(?![${AR}])`, 'i');

const DIRECT = [W('بسرعة|بسرعه|على طول|علطول|باختصار|من الآخر|من الاخر|اختصر|اختصارا|اخلص|هات|بكام|كام|السعر بس|ادخل في الموضوع'), /\b(?:quick(?:ly)?|short|briefly|bottom line|just tell me|straight|price only|how much)\b/i];
const ANALYTICAL = [W('ليه|ليش|ازاي|إزاي|الفرق|فرق|مقارنة|قارن|قارنلي|تركيز|تركيزه|كام ساعة|كام ساعه|ساعات|مكونات|مكوناته|نوتات|اصلي|أصلي|الأصلي|تستر|بالظبط|تفاصيل|ثباته|فوحانه|فوحان|بالمل|للمل'), /\b(?:why|how long|difference|compare|vs\.?|versus|concentration|longevity|sillage|notes|ingredients|exactly|details|authentic|original|edp|edt|per ml)\b/i];
const EXPRESSIVE = [W('يجنن|تحفة|تحفه|جامد|جامده|يلفت|ملفت|ملفته|يلفت النظر|يجذب|جذاب|مميز|مميزة|فخم|فخامة|محدش عنده|الناس تسألني|كومبليمنت|ابهر|أبهر|انبهار|عايز اتميز|حضور|حضوري'), /\b(?:wow|amazing|stunning|stand out|compliments?|head-?turner|unique|attention|impress|luxur\w*|gorgeous)\b/i, /\p{Extended_Pictographic}|!!/u];
const CAUTIOUS = [W('خايف|خايفة|قلقان|قلقانة|مضمون|مضمونة|ضمان|يرجع|ترجيع|استرجاع|استبدال|مش متأكد|مش متأكدة|محتار|محتارة|جربت|اتخدعت|اتنصب|حساسية|بشرتي حساسة|رأيكم|تجارب|ينفع|يناسبني|اول مرة|أول مرة'), /\b(?:worried|afraid|guarantee|refund|return|exchange|not sure|unsure|scam|fake|allerg\w*|sensitive skin|first time|safe|reviews?)\b/i];

const GIFT = [W('هدية|هديه|هدايا|اهادي|أهادي|اهدي|أهدي|عيد ميلاد|عيد ميلادها|عيد ميلاده|عيد الأم|عيد الام|فلانتين|الفلانتين|عيد جواز|ذكرى جوازنا|نجاحه|نجاحها|تخرجه|تخرجها'), /\b(?:gift|present|birthday|anniversary|valentine|mother'?s day|for my (?:wife|husband|mom|mother|dad|father|girlfriend|boyfriend|fianc[eé]e?|friend|sister|brother|boss|colleague))\b/i];
const OCCASION = [W('فرح|فرحي|خطوبة|خطوبتي|كتب كتاب|سهرة|سهره|حفلة|حفله|مقابلة شغل|انترفيو|إنترفيو|اجتماع|ميتنج|عزومة|خروجة|ديت'), /\b(?:wedding|engagement|party|interview|meeting|date night|date|event|gala)\b/i];
const SIGNATURE = [W('يومي|يوميا|يومياً|كل يوم|اعتمده|أعتمده|بصمتي|توقيعي|ريحتي|عطري الأساسي|عطري الاساسي|الشغل|المكتب|الجامعة'), /\b(?:signature|daily|every ?day|office|work|go-?to|university|school)\b/i];
const VALUE = [W('غالي|غالى|مكلف|ارخص|أرخص|اوفر|أوفر|ميزانيتي|ميزانية|في حدود|تحت|اقتصادي|سعر كويس|يستاهل'), /\b(?:cheap(?:er|est)?|budget|afford\w*|value|under \d+|worth it|expensive)\b/i];
const READY = [W('هاخده|هاخدها|خلاص|اطلبه|اطلبها|اطلبهولي|ضيفه|ضيفها|اشتريه|اشتريها|احجزه|ازاي اطلب|إزاي اطلب|ازاي ادفع'), /\b(?:i'?ll take it|buy it|order it|add (?:it )?to (?:the |my )?cart|how (?:do|can) i (?:order|pay))\b/i];
const COMPARING = [W('ولا|أو|او|احسن من|أحسن من|افضل من|أفضل من|الفرق|قارن|انهي|أنهي|ايهم|أيهم|بين'), /\b(?:or|better than|vs\.?|versus|which one|compare|difference)\b/i];
const OBJECTING = [W('غالي|غالى|مكلف|مش متأكد|مش مقتنع|هفكر|مش عاجبني|ماعجبنيش|خايف'), /\b(?:too expensive|not sure|let me think|don'?t like|not convinced)\b/i];
const URGENT = [W('بكرة|بكره|النهاردة|النهارده|الليلة|الليله|الأسبوع ده|الاسبوع ده|مستعجل|مستعجلة|ضروري|بسرعة يوصل|يلحق|العيد'), /\b(?:tomorrow|today|tonight|this week|urgent|asap|in time for)\b/i];
const CONNOISSEUR = /(?<![\u0621-\u064A])(?:نوتات|نوتة|الافتتاحية|القاعدة|القلب|اكورد|أكورد|إكسترية|اكستريه|اكسترية|بارفان|تواليت|نيش|عود كمبودي|عود هندي|أمبروكسان|امبروكسان|إيزو|ايزو|سيلاج|فوحان|عنبر رمادي|باتشولي|فيتيفر|تونكا|لابدانوم)(?![\u0621-\u064A])|\b(?:notes?|accords?|extrait|edp|edt|niche|sillage|projection|ambroxan|iso e|vetiver|patchouli|tonka|labdanum|oud)\b/i;

const RECIPIENTS: [Recipient, RegExp][] = [
  ['wife', /(?<![\u0621-\u064A])(?:لمراتي|مراتي|لزوجتي|زوجتي|للمدام|المدام|لحرمي)(?![\u0621-\u064A])|\bmy wife\b/i],
  ['husband', /(?<![\u0621-\u064A])(?:لجوزي|جوزي|لزوجي|زوجي)(?![\u0621-\u064A])|\bmy husband\b/i],
  ['fiancee', /(?<![\u0621-\u064A])(?:لخطيبتي|خطيبتي|لحبيبتي|حبيبتي)(?![\u0621-\u064A])|\bmy (?:fianc[eé]e|girlfriend)\b/i],
  ['fiance', /(?<![\u0621-\u064A])(?:لخطيبي|خطيبي|لحبيبي|حبيبي)(?![\u0621-\u064A])|\bmy (?:fianc[eé]|boyfriend)\b/i],
  ['mother', /(?<![\u0621-\u064A])(?:لماما|ماما|لأمي|لامي|أمي|امي|لوالدتي|والدتي)(?![\u0621-\u064A])|\bmy (?:mom|mother|mum)\b/i],
  ['father', /(?<![\u0621-\u064A])(?:لبابا|بابا|لأبويا|لابويا|أبويا|ابويا|لوالدي|والدي)(?![\u0621-\u064A])|\bmy (?:dad|father)\b/i],
  ['sister', /(?<![\u0621-\u064A])(?:لأختي|لاختي|أختي|اختي)(?![\u0621-\u064A])|\bmy sister\b/i],
  ['brother', /(?<![\u0621-\u064A])(?:لأخويا|لاخويا|أخويا|اخويا|لأخي|أخي)(?![\u0621-\u064A])|\bmy brother\b/i],
  ['friend_f', /(?<![\u0621-\u064A])(?:لصاحبتي|صاحبتي|لصديقتي|صديقتي)(?![\u0621-\u064A])|\bmy (?:girl ?friend|female friend|best friend \(she\))\b/i],
  ['friend_m', /(?<![\u0621-\u064A])(?:لصاحبي|صاحبي|لصديقي|صديقي)(?![\u0621-\u064A])|\bmy friend\b/i],
  ['boss', /(?<![\u0621-\u064A])(?:لمديري|مديري|لمديرتي|مديرتي|لرئيسي|رئيسي في الشغل)(?![\u0621-\u064A])|\bmy (?:boss|manager)\b/i],
  ['colleague', /(?<![\u0621-\u064A])(?:لزميلي|زميلي|لزميلتي|زميلتي|لزمايلي|زمايلي|لزملائي|زملائي)(?![\u0621-\u064A])|\bmy (?:colleagues?|coworkers?)\b/i],
  ['teacher', /(?<![\u0621-\u064A])(?:لأستاذي|لاستاذي|أستاذي|استاذي|لمدرسي|مدرسي|لمدرستي|مدرستي|للمدرس|للمدرسة)(?![\u0621-\u064A])|\bmy (?:teacher|professor)\b/i],
  ['mother_in_law', /(?<![\u0621-\u064A])(?:لحماتي|حماتي)(?![\u0621-\u064A])|\bmy mother-in-law\b/i],
  ['father_in_law', /(?<![\u0621-\u064A])(?:لحمايا|حمايا|لحمايا|حماي)(?![\u0621-\u064A])|\bmy father-in-law\b/i],
  ['son', /(?<![\u0621-\u064A])(?:لابني|ابني|لإبني|إبني)(?![\u0621-\u064A])|\bmy son\b/i],
  ['daughter', /(?<![\u0621-\u064A])(?:لبنتي|بنتي)(?![\u0621-\u064A])|\bmy daughter\b/i],
  ['child', /(?<![\u0621-\u064A])(?:لولادي|ولادي|لعيالي|عيالي)(?![\u0621-\u064A])|\bmy (?:kids|children)\b/i],
];
export const RECIPIENT_LABEL: Record<Recipient, Record<Lang, string>> = {
  wife: { ar: 'مراتك', en: 'your wife' }, husband: { ar: 'جوزك', en: 'your husband' }, fiancee: { ar: 'خطيبتك', en: 'your fiancée' },
  fiance: { ar: 'خطيبك', en: 'your fiancé' }, mother: { ar: 'والدتك', en: 'your mother' }, father: { ar: 'والدك', en: 'your father' },
  sister: { ar: 'أختك', en: 'your sister' }, brother: { ar: 'أخوك', en: 'your brother' }, friend_m: { ar: 'صاحبك', en: 'your friend' },
  friend_f: { ar: 'صاحبتك', en: 'your friend' }, colleague: { ar: 'زميلك', en: 'your colleague' }, boss: { ar: 'مديرك', en: 'your boss' },
  teacher: { ar: 'أستاذك', en: 'your teacher' }, mother_in_law: { ar: 'حماتك', en: 'your mother-in-law' }, father_in_law: { ar: 'حماك', en: 'your father-in-law' },
  son: { ar: 'ابنك', en: 'your son' }, daughter: { ar: 'بنتك', en: 'your daughter' }, child: { ar: 'ولادك', en: 'your children' },
};

const hits = (res: RegExp[], text: string) => res.reduce((n, re) => n + (re.test(text) ? 1 : 0), 0);

/**
 * The buyer read from his messages (oldest first; the newest weighs double). A style only wins with a real signal;
 * with none he is treated as the friendly default (warm, short, one question), never forced into a box.
 */
export function readBuyer(messages: readonly string[]): BuyerProfile {
  const said = messages.map((m) => String(m || '').trim()).filter(Boolean).slice(-6);
  const now = said[said.length - 1] || '';
  const all = said.join('\n');
  const scores: Record<Scored, number> = { direct: 0, analytical: 0, expressive: 0, cautious: 0 };
  said.forEach((m, i) => {
    const w = i === said.length - 1 ? 2 : 1;
    scores.direct += hits(DIRECT, m) * w;
    scores.analytical += hits(ANALYTICAL, m) * w + ((m.match(/[؟?]/g) || []).length >= 2 ? w : 0);
    scores.expressive += hits(EXPRESSIVE, m) * w;
    scores.cautious += hits(CAUTIOUS, m) * w;
  });
  // Message after message in a few words («بكام؟»، «فين؟»، «طيب») is the direct buyer's mark — one short «هاخده» is not.
  const avg = said.length ? said.reduce((n, m) => n + m.length, 0) / said.length : 0;
  if (said.length >= 2 && said.every((m) => m.length <= 15)) scores.direct += 1;
  if (avg >= 120) scores.analytical += 1;
  // Ties go to the more careful reading: caution before enthusiasm, numbers before speed.
  const order: Scored[] = ['cautious', 'analytical', 'expressive', 'direct'];
  const top = Math.max(...order.map((s) => scores[s]));
  const style: BuyerStyle = top <= 0 ? 'friendly' : order.find((s) => scores[s] === top)!;
  const recipient = RECIPIENTS.find(([, re]) => re.test(all))?.[0];
  const motive: BuyerMotive = hits(GIFT, all) || recipient ? 'gift' : hits(VALUE, now) ? 'value' : hits(OCCASION, all) ? 'occasion' : hits(SIGNATURE, all) ? 'signature' : hits(VALUE, all) ? 'value' : 'self';
  const stage: BuyerStage = hits(READY, now) ? 'ready' : hits(OBJECTING, now) ? 'objecting' : hits(COMPARING, now) ? 'comparing' : 'looking';
  return {
    style, motive, stage, ...(recipient ? { recipient } : {}),
    budgetSensitive: hits(VALUE, all) > 0, connoisseur: (all.match(new RegExp(CONNOISSEUR.source, 'gi')) || []).length >= 2,
    urgent: hits(URGENT, all) > 0, scores,
  };
}

// ── 2. The craft ────────────────────────────────────────────────────────────────────────────────────────────────
export interface SalesRule { id: string; ar: string; en: string; source: string }

/** What sells — each rule from a known body of sales research (the source is for the admin and the curious). */
export const SALES_PRINCIPLES: readonly SalesRule[] = [
  { id: 'needs_first', ar: 'افهم احتياجه الأول: سؤال واحد ذكي (لمين؟ لإمتى؟ إيه الإحساس اللي عايزه؟) أهم من عشر مواصفات.', en: 'Understand the need first: one smart question (for whom? when? what feeling?) beats ten specifications.', source: 'SPIN Selling — N. Rackham (1988)' },
  { id: 'benefit', ar: 'حوّل كل ميزة لفايدة يحسها: «تركيز إكستريه» ← «بخّتين الصبح يكفوك لحد بالليل».', en: 'Turn every feature into a felt benefit: “extrait concentration” → “two sprays in the morning carry you to the evening”.', source: 'Feature–Advantage–Benefit selling' },
  { id: 'sensory', ar: 'احكي الريحة كتجربة: أول بخة، بعد شوية، واللي بيفضل على الهدوم — مش قائمة مكونات.', en: 'Tell the scent as an experience: the first spray, a little later, what stays on the clothes — not an ingredient list.', source: 'Sensory marketing — A. Krishna (2012)' },
  { id: 'one_pick', ar: 'ترشيح واحد واضح وبديل واحد بس لو فيه سبب؛ الاختيارات الكتير بتأجل القرار.', en: 'One clear recommendation and at most one alternative with a reason; too many choices postpone the decision.', source: 'Choice overload — Iyengar & Lepper (2000)' },
  { id: 'mirror', ar: 'كلّم كل زبون بطريقته: المستعجل باختصار وسعر، المحلل بالأرقام والأسباب، المتحمس بالإحساس والحضور، والحذر بالضمانات والصراحة.', en: 'Speak each buyer’s language: the hurried one briefly with the price, the analyst with numbers and reasons, the enthusiast with feeling and presence, the cautious one with guarantees and candour.', source: 'Social Styles — Merrill & Reid (1981)' },
  { id: 'honest_frame', ar: 'العيب يتقال بصراحة لكن في صورة نصيحة ومعاه الحل: «خفيف وراقي، ورشّه على الهدوم يعيش أطول».', en: 'Say a weakness honestly, framed as advice with its fix: “light and refined — spray it on clothes and it lasts longer”.', source: 'Two-sided persuasion — Crowley & Hoyer (1994)' },
  { id: 'real_proof', ar: 'الدليل الحقيقي بس: تقييمات منشورة، الماركة، التركيز، الحجم — من غير «الكل بيشتريه».', en: 'Real proof only: published ratings, the house, the concentration, the size — never “everyone buys it”.', source: 'Social proof — R. Cialdini (1984), within the store’s honesty law' },
  { id: 'value', ar: 'لما يقول «غالي»: ماتجادلش؛ اعرض القيمة (سعر المل والبخة) وطريق أوفر لو موجود.', en: 'On “too expensive”: never argue; show the value (price per ml and per spray) and a cheaper road if there is one.', source: 'Value-based objection handling' },
  { id: 'soft_close', ar: 'اقفل بخطوة واحدة سهلة وسؤال واحد بيفترض الاهتمام: «أجهزهولك؟» — مش قائمة اختيارات.', en: 'Close with one easy step and one question that assumes interest: “Shall I get it ready for you?” — not a menu.', source: 'Assumptive / soft close' },
  { id: 'gift_reassure', ar: 'في الهدية طمّنه: ذوق آمن، تغليف جاهز لو موجود، واستبدال المختوم في المدة القانونية.', en: 'For a gift, reassure: a safe taste, ready packaging when there is, and exchange of sealed items within the legal window.', source: 'Risk reversal' },
  { id: 'cross_sell', ar: 'بعد الشرا: حاجة واحدة أو اتنين يكمّلوا بسبب واضح، واختيارية خالص.', en: 'After the purchase: one or two items that complete it, with a clear reason, entirely optional.', source: 'Cross-selling' },
];

/** What kills a sale — and how he catches it in a reply (when a pattern can catch it). */
export interface SalesPitfall extends SalesRule { detect?: { ar?: RegExp; en?: RegExp } }
export const SALES_PITFALLS: readonly SalesPitfall[] = [
  { id: 'plant_objection', ar: 'إنك تفتح باب الاعتراض بنفسك: «لو السعر مش مريحك…»، «لو محتار قولّي…».', en: 'Opening the door to an objection yourself: “if the price doesn’t suit you…”, “if you’re unsure, tell me…”.', source: 'Objection prevention',
    detect: { ar: /لو (?:السعر|سعره) (?:مش مريح|عالي|غالي|كبير)|لو (?:مش|مو) (?:مقتنع|عاجب)|لو محتار قول|قولّ?ي «غالي»|قولّ?ي «مش متأكد»/, en: /if the price (?:doesn'?t suit|is too high)|if you(?:'re| are) (?:unsure|not sure), (?:say|tell)|say “too expensive”|say "too expensive"/i } },
  { id: 'negative_first', ar: 'تقديم العيب كأنه حكم: «ثباته ضعيف»، «جدّده في اليوم».', en: 'Stating a weakness as a verdict: “weak longevity”, “reapply during the day”.', source: 'Framing effect — Tversky & Kahneman (1981)',
    detect: { ar: /جدّ?ده في اليوم|ثباته ضعيف|مش بيثبت|مابيثبتش|بيطير بسرعة/, en: /reapply (?:it )?during the day|weak longevity|doesn'?t last/i } },
  { id: 'raw_jargon', ar: 'أسماء نوتات بالإنجليزي أو كلام تقني جوه رد عربي.', en: 'Raw English note names or technical jargon inside an Arabic reply.', source: 'Fluency — processing ease builds trust',
    detect: { ar: /(?:الافتتاحية|القلب|القاعدة|المكونات|ريحته|أول بخة)[^\n]{0,40}?[:،]\s*[A-Za-z]{3,}/ } },
  { id: 'too_many', ar: 'عرض منتجات كتير مرة واحدة؛ الزبون بيتوه ويأجل.', en: 'Showing many products at once; the buyer gets lost and postpones.', source: 'Choice overload — Iyengar & Lepper (2000)' },
  { id: 'fake_urgency', ar: 'استعجال مزيف: «فاضل قطعتين»، «العرض بينتهي النهاردة».', en: 'Fake urgency: “only two left”, “the offer ends today”.', source: 'Store honesty law; consumer protection (Egypt Law 181/2018)',
    detect: { ar: /فاضل (?:\d|قطع|حبة|كام)|آخر قطعة|لفترة محدودة|العرض (?:هينتهي|بينتهي|ينتهي)|الحق(?:ه| قبل)/, en: /only \d+ left|limited time|offer ends|hurry|last chance/i } },
  { id: 'fake_proof', ar: 'دليل مش حقيقي: «الكل بيشتريه»، «الأكثر مبيعاً» من غير بيانات.', en: 'Unverified proof: “everyone buys it”, “best seller” without data.', source: 'Store honesty law',
    detect: { ar: /الكل بيشتري|الناس كلها (?:بتاخد|بتشتري|بتحب)|الأكثر مبيع|كل اللي جربوه/, en: /everyone (?:is buying|loves|buys)|best ?seller|everybody buys/i } },
  { id: 'invented_discount', ar: 'وعد بخصم مش موجود في صفحة الدفع.', en: 'Promising a discount that the checkout does not have.', source: 'Store honesty law',
    detect: { ar: /(?:هعملك|هديك|أعملك|اعملك) خصم|خصم خاص (?:ليك|ليكي)|خصم \d+ ?%|\d+ ?% ?خصم/, en: /(?:i'?ll|i will|let me) give you (?:a )?discount|special discount for you|\d+% off/i } },
  { id: 'pressure', ar: 'الضغط: «لازم تاخده»، «اشتري دلوقتي قبل ما تندم».', en: 'Pressure: “you must take it”, “buy now before you regret it”.', source: 'Reactance theory — J. Brehm (1966)',
    detect: { ar: /لازم (?:تاخده|تاخدها|تشتريه|تشتريها|تشتري)|اشتري(?:ه|ها)? دلوقتي قبل|هتندم/, en: /you (?:must|have to) (?:buy|take) it|buy (?:it )?now before|you'?ll regret/i } },
  { id: 'bash_others', ar: 'الكلام الوحش عن الماركات أو المحلات التانية.', en: 'Badmouthing other houses or shops.', source: 'Spontaneous trait transference — Skowronski et al. (1998)',
    detect: { ar: /(?:الماركات|المحلات|المتاجر) (?:التانية|الثانية|الباقية) (?:وحشة|نصابين|بتغش|زبالة)/, en: /other (?:brands|shops|stores) are (?:bad|scams|cheating|garbage)/i } },
  { id: 'self_doubt', ar: 'التردد في الكلام: «مش عارف هيعجبك ولا لأ»، «يمكن ميعجبكش».', en: 'Hesitant wording: “I don’t know if you’ll like it”, “maybe you won’t like it”.', source: 'Confidence and persuasion — source credibility (Hovland, 1953)',
    detect: { ar: /مش عارف (?:إذا|اذا|هل)? ?(?:هيعجبك|هتحبه)|يمكن ميعجبكش|ممكن ميعجبكش|مش ضامن/, en: /i don'?t know if you'?ll like|maybe you won'?t like/i } },
  { id: 'argue_price', ar: 'الجدال في السعر: «ده مش غالي خالص».', en: 'Arguing about the price: “it’s not expensive at all”.', source: 'Value-based objection handling',
    detect: { ar: /(?:ده|السعر|هو) مش غالي(?: خالص| أبداً| ابدا)?|انت غلطان/, en: /it'?s not expensive(?: at all)?|you'?re wrong/i } },
  { id: 'cheap_word', ar: 'وصف المنتج بـ«رخيص» بدل «اقتصادي» أو «أوفر».', en: 'Calling the product “cheap” instead of “good value”.', source: 'Price-quality inference',
    detect: { ar: /(?:عطر|برفان|ريحة|منتج) رخيص/, en: /\bcheap (?:perfume|fragrance|product)\b/i } },
  { id: 'menu_close', ar: 'قايمة اختيارات طويلة في الآخر بدل خطوة واحدة واضحة.', en: 'A long menu of options at the end instead of one clear step.', source: 'Decision fatigue' },
  { id: 'no_next_step', ar: 'رد عن منتج من غير خطوة جاية واضحة (يطلبه إزاي).', en: 'A product reply with no clear next step (how to order it).', source: 'Closing' },
];

/** The pitfalls a reply falls into (his own templates are tested to fall into none). */
export function salesLint(reply: string, lang: Lang = /[\u0600-\u06FF]/.test(reply) ? 'ar' : 'en'): string[] {
  const found: string[] = [];
  for (const p of SALES_PITFALLS) {
    const re = p.detect?.[lang] || (lang === 'ar' ? p.detect?.en : undefined);
    if (re && re.test(reply)) found.push(p.id);
  }
  const products = new Set([...reply.matchAll(/\/p\/([a-z0-9-]+)\.html/g)].map((m) => m[1]));
  if (products.size > 3) found.push('too_many');
  const asks = (reply.match(/قولّ?ي «|اكتب(?:لي)? «|say “|tell me “|write “/g) || []).length;
  if (asks >= 3) found.push('menu_close');
  if (products.size && !/هاخده|شراء مباشر|أجهز|اجهز|السلة|I'?ll take it|Buy now|get it ready|cart/i.test(reply)) found.push('no_next_step');
  return [...new Set(found)];
}

/** Sentences that kill a sale, removed from a platform's reply (never his own facts, never a whole reply). */
const POLISH: readonly string[] = ['plant_objection', 'fake_urgency', 'fake_proof', 'invented_discount', 'pressure', 'bash_others', 'self_doubt', 'argue_price'];
export function polishSale(reply: string): string {
  if (!reply) return reply;
  const rules = SALES_PITFALLS.filter((p) => POLISH.includes(p.id) && p.detect);
  const bad = (s: string) => rules.some((p) => (p.detect!.ar && p.detect!.ar.test(s)) || (p.detect!.en && p.detect!.en.test(s)));
  // Sentence by sentence inside each line: «… الحقه قبل ما يخلص!» goes, the rest of the line stays.
  const lines = reply.split('\n').map((line) => {
    if (!bad(line)) return line;
    const parts = line.split(/(?<=[.!؟?…])\s+/);
    const kept = parts.filter((s) => !bad(s));
    return kept.join(' ');
  });
  const out = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return out.length >= reply.length * 0.4 ? out : reply;
}

// ── 3. For the AI engines ───────────────────────────────────────────────────────────────────────────────────────
const STYLE_HINT: Record<BuyerStyle, Record<Lang, string>> = {
  direct: { ar: 'الزبون مستعجل ومباشر: رد قصير جداً — الترشيح، السعر، سبب واحد، وخطوة الطلب.', en: 'The buyer is hurried and direct: very short — the pick, the price, one reason, the order step.' },
  analytical: { ar: 'الزبون محلل: أرقام وأسباب — التركيز، الثبات المتوقع، سعر المل، والفرق عن البديل.', en: 'The buyer is analytical: numbers and reasons — concentration, expected longevity, price per ml, and how it differs from the alternative.' },
  expressive: { ar: 'الزبون متحمس وبيدور على التميز: احكي الإحساس والحضور والمناسبة اللي هيلمع فيها.', en: 'The buyer is enthusiastic and wants to stand out: tell the feeling, the presence and the moment it will shine.' },
  friendly: { ar: 'لسه مفيش إشارة واضحة لطبعه: رد دافي وقصير، ترشيح واحد، وسؤال واحد يكشف احتياجه.', en: 'No clear sign of his style yet: warm and short, one pick, one question that reveals the need.' },
  cautious: { ar: 'الزبون حذر: طمّنه بالصراحة — ذوق آمن، الدليل الحقيقي، وسياسة إرجاع المختوم — من غير ضغط.', en: 'The buyer is cautious: reassure with candour — a safe taste, real proof and the sealed-item return policy — no pressure.' },
};
const MOTIVE_HINT: Record<BuyerMotive, Record<Lang, string>> = {
  gift: { ar: 'الدافع هدية: ركّز على إنه هيعجب اللي هيستلمه وعلى التغليف والاستبدال، واسأل عن ذوقه في سؤال واحد.', en: 'The motive is a gift: focus on the recipient enjoying it, the packaging and the exchange; ask about their taste in one question.' },
  occasion: { ar: 'الدافع مناسبة: اربط العطر بالمناسبة نفسها وبميعاد التوصيل.', en: 'The motive is an occasion: tie the perfume to that occasion and to the delivery time.' },
  signature: { ar: 'الدافع عطر يومي/توقيع: ركّز على إنه مريح كل يوم ومش بيزهق ومناسب للشغل.', en: 'The motive is a daily/signature scent: focus on everyday comfort, not tiring, office-friendly.' },
  value: { ar: 'الميزانية مهمة عنده: ابدأ بالقيمة (سعر المل والبخة) ومن غير كلمة «رخيص».', en: 'Budget matters to him: lead with value (per ml and per spray), never the word “cheap”.' },
  self: { ar: 'بيشتري لنفسه: اربط العطر بشخصيته وبالإحساس اللي عايزه.', en: 'Buying for himself: tie the perfume to his personality and the feeling he wants.' },
};

/** One paragraph for a platform's prompt: how this buyer should be spoken to. */
export function buyerHint(p: BuyerProfile, lang: Lang): string {
  const parts = [STYLE_HINT[p.style][lang], MOTIVE_HINT[p.motive][lang]];
  if (p.recipient) parts.push(lang === 'ar' ? `الهدية لـ${RECIPIENT_LABEL[p.recipient].ar}.` : `The gift is for ${RECIPIENT_LABEL[p.recipient].en}.`);
  if (p.urgent) parts.push(lang === 'ar' ? 'محتاجه قريب: اذكر خطوات الطلب والتوصيل بوضوح.' : 'Needs it soon: state the order and delivery steps clearly.');
  if (p.connoisseur) parts.push(lang === 'ar' ? 'خبير بالعطور: كلّمه بلغة العطّار من غير تبسيط زيادة.' : 'A connoisseur: use the perfumer’s language without over-simplifying.');
  return parts.join(' ');
}

/** The craft in a few lines, for the AI engines' system prompt (what sells, and what never to say). */
export function salesPromptBlock(lang: Lang): string {
  const pick = (ids: string[], list: readonly SalesRule[]) => ids.map((id) => list.find((r) => r.id === id)!).map((r) => `- ${r[lang]}`);
  const head = lang === 'ar' ? 'لما الزائر يسأل عن منتج أو عايز يشتري، اتكلم زي تاجر عطور محنك وأمين:' : 'When the visitor asks about a product or wants to buy, speak like a seasoned, honest perfume merchant:';
  const never = lang === 'ar' ? 'وممنوع تماماً:' : 'Never:';
  return [head, ...pick(['needs_first', 'sensory', 'benefit', 'one_pick', 'mirror', 'honest_frame', 'real_proof', 'soft_close'], SALES_PRINCIPLES),
    never, ...pick(['plant_objection', 'negative_first', 'raw_jargon', 'fake_urgency', 'fake_proof', 'invented_discount', 'pressure', 'bash_others', 'menu_close'], SALES_PITFALLS)].join('\n');
}

// ── 4. The close ────────────────────────────────────────────────────────────────────────────────────────────────
export interface CloseInput { name: string; buyer: BuyerProfile; lang: Lang; /** The one alternative shown, if any. */ alt?: string }

/**
 * One soft, assumptive close in this buyer's language: at most one question, then the one step to order. Never a
 * menu, never the objections planted for him («لو غالي قولّي…»), never pressure.
 */
export function closeLine({ name, buyer, lang, alt }: CloseInput): string {
  const ar = lang === 'ar';
  const who = buyer.recipient ? RECIPIENT_LABEL[buyer.recipient][lang] : '';
  let ask = '';
  if (buyer.motive === 'gift' && buyer.style !== 'direct' && buyer.style !== 'analytical') {
    ask = who ? (ar ? `اختيار يليق بـ${who} 🎁` : `A choice worthy of ${who} 🎁`)
      : (ar ? 'الهدية لمين؟ قولّي في كلمة وأأكدلك إنه مناسب.' : 'Who is the gift for? Tell me in a word and I will confirm it fits.');
  } else if (buyer.style === 'analytical') {
    ask = alt ? (ar ? `تحب أقارنهولك بـ«${alt}» في الثبات وسعر المل؟` : `Shall I compare it with “${alt}” on longevity and price per ml?`)
      : (ar ? 'محتاج رقم أو تفصيلة تانية قبل ما تقرر؟' : 'Need any other figure or detail before you decide?');
  } else if (buyer.style === 'expressive') {
    ask = ar ? `«${name}» اختيار بيعبّر عنك ✨` : `“${name}” is a choice that speaks for you ✨`;
  } else if (buyer.style === 'cautious') {
    ask = ar ? 'وعشان تطمن: المنتج المختوم ليه حق إرجاع أو استبدال في المدة القانونية لبلدك.' : 'For peace of mind: a sealed item can be returned or exchanged within your country’s legal window.';
  } else if (buyer.style === 'friendly') {
    ask = ar ? 'هتلبسه أكتر في النهار ولا في السهرات؟ قولّي وأأكدلك إنه الأنسب ليك.' : 'Will you wear it more by day or in the evening? Tell me and I will confirm it is the best fit.';
  }
  const order = buyer.style === 'direct'
    ? (ar ? `أجهزهولك؟ اكتب «هاخده» وأبعتلك خطوات الطلب في دقيقة، أو من صفحته اضغط «شراء مباشر».` : `Shall I get it ready? Write “I'll take it” and I'll send the order steps in a minute, or press “Buy now” on its page.`)
    : (ar ? `ولما تحب: اكتب «هاخده» وأجهزهولك، أو من صفحته اضغط «شراء مباشر».` : `Whenever you like: write “I'll take it” and I'll get it ready, or press “Buy now” on its page.`);
  const soon = buyer.urgent ? (ar ? ' ومدة التوصيل لبلدك بتظهر في صفحة الدفع قبل التأكيد.' : ' The delivery time to your country shows on the payment page before you confirm.') : '';
  return [ask, order + soon].filter(Boolean).join(' ');
}
