/**
 * «شاهين ابن الناس» — the owner (2026-10-23): «عايزك تدخل جوا ذاكرة شاهين علم الاجتماع والعلاقات العامة والتجارة
 * وتدربه كويس بتطبيقات العلوم دي في التعامل مع التعاملات المختلفة».
 *
 * Three sciences, applied to the situations a perfume shop really meets:
 *  1. Sociology — who is speaking and in what world: his dialect and region (gift customs differ between Egypt, the
 *     Gulf, the Levant and the Maghreb), his formality and age cues, the occasion (Ramadan, Eid, Mother's Day, a
 *     wedding, a newborn, a condolence) and the recipient (a mother, a boss…) — and what is fitting there.
 *  2. Public relations — the complaint (late, damaged, wrong item, a doubt about the scent, a refund) handled the way
 *     service-recovery research says: hear, empathise, apologise, resolve with real steps, follow up — calm with an
 *     angry visitor, never defensive, never blaming him, never promising what nobody checked.
 *  3. Commerce — the other kinds of customer: wholesale and resellers, corporate gifts, the discount negotiator, the
 *     loyal customer who comes back, the one who thanks — each with the store's real channels (the «مساعد شام
 *     للخدمات» request forms, the support inbox, the order tracking with its SH- number).
 *
 * readSituation reads the message; relationsAnswer replies when the situation is one of these (and leaves shopping
 * to the seller, src/utils/shaheenSeller.ts and src/utils/shaheenPitch.ts); RELATIONS_DRILLS are the training
 * cases (tests/shaheenRelations.test.ts grades every one); relationsPromptBlock feeds the same science to the AI
 * engines and polishRelations removes from their replies what ruins a relationship. Pure and browser-safe.
 * Honesty is the law: no invented compensation, discount, delivery date, stock, or policy — only the store's facts.
 */
import { STORE_EMAIL } from '../config/contact';
import type { Context } from './shaheenBrain';

type Lang = 'ar' | 'en';
const langOf = (language: string, text = ''): Lang => (/[\u0600-\u06FF]/.test(text) || ((language === 'ar' || language === 'fa') && !/[a-z]{3}/i.test(text)) ? 'ar' : 'en');
/** Arabic letters only (the punctuation «؟ ،» is in the Arabic block too and ends a word). */
const AR = '\\u0621-\\u063A\\u0640-\\u065F\\u0670-\\u06D3';
/** Whole Arabic words, with the joined prefixes «و ف ب ل ال بال لل وال» allowed in front. */
const W = (words: string) => new RegExp(`(?<![${AR}])(?:وال|بال|لل|ال|و|ف|ب|ل)?(?:${words})(?![${AR}])`, 'i');

// ── 1. Reading the situation ────────────────────────────────────────────────────────────────────────────────────
export type Situation =
  | 'late' | 'damaged' | 'wrong_item' | 'missing' | 'scent_doubt' | 'refund' | 'angry'
  | 'tracking' | 'wholesale' | 'corporate' | 'discount' | 'price_match' | 'loyal' | 'praise'
  | 'condolence' | 'newborn' | 'etiquette';
export type Region = 'egypt' | 'gulf' | 'levant' | 'maghreb' | 'unknown';

export interface SocialReading {
  situation?: Situation;
  /** 0 calm · 1 annoyed · 2 angry · 3 insulting — the reply gets calmer and shorter as it rises, never sharper. */
  anger: 0 | 1 | 2 | 3;
  /** «حضرتك / يا فندم / سيادتك»: he speaks formally — he is answered the same way. */
  formal: boolean;
  /** «أنا كبير في السن / على المعاش / حفيدي»: patience, short steps, no jargon. */
  elder: boolean;
  region: Region;
  /** An order reference he gave («SH-…»), repeated back so he sees he was heard. */
  orderRef?: string;
  occasion?: 'ramadan' | 'eid' | 'mothers_day' | 'wedding' | 'newborn' | 'graduation' | 'valentine' | 'condolence';
  recipient?: 'mother' | 'father' | 'boss' | 'colleague' | 'teacher' | 'in_law' | 'partner' | 'friend';
  /** The message itself (for the quantity and product a trader names). */
  said?: string;
}

const LATE = W('اتأخر|اتاخر|متأخر|متاخر|لسه موصلش|لسه ماوصلش|ماوصلش|موصلش|مجاش|لسه مجاش|التوصيل اتأخر|الشحنة اتأخرت');
/** «بقالي 10 أيام / بقالي أسبوع مستني» — a long wait is a late order even with calm words. */
const LONG_WAIT = /(?<![\u0621-\u064A])بقال(?:ي|نا|ه|ها)\s+(?:\d+|[٠-٩]+|كام|اكتر من|أكتر من|يومين|اسبوع|أسبوع|اسبوعين|أسبوعين|شهر|تلات|أربع|اربع|خمس)/;
/** «فين طلبي؟ / إزاي أتتبعه؟» — a calm question about where an order is: no apology for what did not happen. */
const TRACKING = W('فين طلبي|فين طلبيتي|فين الطلب|فين الاوردر|فين الأوردر|الطلب فين|الاوردر فين|الأوردر فين|امتى هيوصل|إمتى هيوصل|امتى يوصل|إمتى يوصل|وصل لفين|وصلت لفين|بقى فين|اتتبع|أتتبع|اتتبعه|أتتبعه|اتتبعها|أتتبعها|اتابعه|أتابعه|اتابع الطلب|أتابع الطلب|تتبع الطلب|تتبع طلبي|تتبع الاوردر|تتبع الأوردر|حالة الطلب|حالة طلبي|رقم التتبع');
const TRACKING_EN = /\b(?:where is my (?:order|package|parcel)|track(?:ing)? (?:my |the )?(?:order|package|parcel)|how (?:do|can) i track|order status|tracking number)\b/i;
const LATE_EN = /\b(?:late|delayed|hasn'?t arrived|not arrived|never arrived|still waiting|been waiting (?:for )?(?:\d+|a|two|three) (?:days?|weeks?))\b/i;
const DAMAGED = W('مكسور|مكسورة|اتكسر|اتكسرت|وصل مكسور|وصلت مكسورة|مدلوق|اندلق|سايح|ساح|بيسرّب|بيسرب|مخروم|متخبط|العلبة متبهدلة|البخاخ بايظ|البخاخة بايظة|مبيبخش|مش بيبخ');
const DAMAGED_EN = /\b(?:broken|cracked|leak(?:ed|ing)?|damaged|spilled|smashed|sprayer (?:doesn'?t|does not) work)\b/i;
const WRONG = W('مش اللي طلبته|مش ده اللي طلبته|غير اللي طلبته|بعتولي غلط|وصلني غلط|جالي غلط|طلب غلط|منتج غلط|حجم غلط|لون غلط');
/** «الأوردر وصل ناقص منه زجاجة» — something missing from the parcel is not a wrong item. */
const MISSING = W('الطلب ناقص|الأوردر ناقص|الاوردر ناقص|الطلبية ناقصة|ناقص منه|ناقصة منه|ناقصه منه|ناقص زجاجة|ناقص زجاجه|ناقص حاجة|ناقص حاجه|ماوصلش كله|موصلش كله|جه ناقص|جالي ناقص|وصل ناقص|وصلت ناقصة|وصلني ناقص');
const MISSING_EN = /\b(?:missing item|item (?:is )?missing|something (?:is )?missing|arrived incomplete|incomplete order|missing from (?:my|the) (?:order|package|parcel))\b/i;
const WRONG_EN = /\b(?:wrong (?:item|product|size|order)|not what i ordered)\b/i;
const DOUBT_SCENT = W('طلع مقلد|ده مقلد|دي مقلدة|بتبيعوا مقلد|مضروب|مش اصلي|مش أصلي|مش اوريجينال|ريحته مش زي|ريحتها مش زي|مش نفس الريحة|ريحته غريبة|ريحته وحشة|ريحتها وحشة|مش بيثبت خالص|ثباته وحش|مالوش ثبات|بيطير على طول|ريحة كحول');
const DOUBT_SCENT_EN = /\b(?:fake|counterfeit|not original|not authentic|smells different|smells wrong|smells bad|smells like alcohol|doesn'?t last at all|no longevity)\b/i;
const REFUND = W('عايز فلوسي|رجعولي فلوسي|استرجاع الفلوس|استرداد|ارجع الطلب|أرجع الطلب|ارجّع|عايز ارجعه|عايز ارجعها|عايز الغي|عايز ألغي|الغي الطلب|ألغي الطلب|إلغاء الطلب|الغاء الطلب');
const REFUND_EN = /\b(?:refund|money back|return (?:it|the order|my order)|cancel (?:my|the) order)\b/i;
const INSULT = W('نصابين|نصاب|نصب|نصباية|حرامية|حرامي|زفت|زبالة|قرف|مقرف|اسوأ|أسوأ|فاشلين|كدابين|كذابين|حسبي الله|مش هتعامل معاكم|هشتكيكم|هبلغ عنكم|جهاز حماية المستهلك');
const INSULT_EN = /\b(?:scam(?:mers?)?|thie(?:f|ves)|liars?|worst|disgusting|pathetic|never again|i'?ll report you|consumer protection)\b/i;
const ANNOYED = W('مضايق|متضايق|زعلان|زعلانة|مستاء|مستاءة|مش معقول|حرام عليكم|ايه ده|إيه ده|يعني ايه|مفيش رد|محدش بيرد|ماحدش بيرد');
const ANNOYED_EN = /\b(?:annoyed|upset|frustrated|unacceptable|ridiculous|no one answers|nobody replies)\b/i;

const WHOLESALE = W('جملة|كمية كبيرة|كميات كبيرة|كرتونة|كراتين|دستة|موزع|موزعين|افتح محل|أفتح محل|عندي محل|لمحلي|اعيد بيعه|أعيد بيعه|اعيد البيع|كتاجر');
const WHOLESALE_EN = /\b(?:wholesale|bulk|in bulk|distributor|reseller|resell|my shop|retail store|large quantit\w*|cartons?)\b/i;
const BIG_QTY = /(?:^|\s)(?:[2-9]\d|\d{3,})\s*(?:زجاج[ةه]|ازاز[ةه]|إزاز[ةه]|قطع[ةه]|علب[ةه]|طقم|bottles?|pieces?|units?|sets?)/i;
const CORPORATE = W('هدايا موظفين|هدايا للموظفين|للموظفين|موظفينا|موظفين الشركة|عملاء الشركة|لعملائنا|هدايا شركات|هدية شركة|شركتنا|للشركة|مؤتمر|حفلة الشركة|نهاية السنة للموظفين');
const CORPORATE_EN = /\b(?:corporate gifts?|for (?:our|my) (?:employees|staff|team|clients)|company gifts?|conference|year-end gifts?)\b/i;
/** «العطر ده عندكم أغلى من محل تاني» — a comparison with another shop (answered honestly, no price match promised). */
const PRICE_MATCH = /(?:أ|ا)(?:رخص|غلى)\s+(?:من|عند|في|ف)\s+(?:ال)?(?:محل|مكان|موقع|متجر|صيدلي[ةه]|نون|أمازون|امازون|جوميا|السوق|بره|برا|غيركم)|(?:محل|مكان|موقع|متجر)\s+(?:تاني|تانى|آخر|اخر|تانية|تانيه)|لقيت(?:ه|ها|هم)?\s+(?:ب)?(?:أ|ا)رخص|غيركم\s+(?:ب)?(?:أ|ا)رخص|بيبيعوه\s+(?:ب)?(?:أ|ا)رخص/;
const PRICE_MATCH_EN = /\b(?:cheaper (?:at|on|in|elsewhere|somewhere)|(?:another|other|a different) (?:shop|store|site|website|seller)|found it (?:for less|cheaper)|price match|more expensive than (?:at |on |in )?(?:another|other|amazon|noon))\b/i;
/** «محتاج 10 هدايا لزمايلي» — gifts for a group (colleagues, a team): a corporate-style request. */
const GROUP_GIFT = /(?:(?<!\d)(?:[5-9]|[1-9]\d+)|عشر|عشرين|خمستاشر)\s*(?:هدايا|هديه|هدية)|هدايا\s+(?:ل|لـ\s*)?(?:زمايلي|زملائي|الفريق|فريقي|الموظفين|المكتب|الشغل)|(?:ل|لكل\s+)?(?:زمايلي|زملائي)\s+(?:في|ف)\s+(?:الشغل|المكتب)|\b(?:\d+ gifts|gifts for (?:my )?(?:colleagues|team|coworkers|staff))\b/i;
const DISCOUNT = W('خصم|تخفيض|نزّل السعر|نزل السعر|تنزل شوية|آخر سعر|اخر سعر|كوبون|كود خصم|ممكن تقلل');
const DISCOUNT_EN = /\b(?:discount|coupon|promo code|last price|lower the price|special offer)\b/i;
const LOYAL = W('اشتريت منكم قبل كده|اشتريت منكم قبل|زبون قديم|زبونة قديمة|عميل قديم|دايماً بشتري منكم|دايما بشتري منكم|تاني مرة اشتري|مش أول مرة|مش اول مرة');
const LOYAL_EN = /\b(?:bought from you before|returning customer|regular customer|loyal customer|ordered (?:here|from you) before)\b/i;
const PRAISE = W('وصل وحلو|وصلني وجميل|تسلم ايدكم|تسلم إيدكم|ريحته تجنن|خدمة ممتازة|خدمة محترمة|شكراً على الخدمة|شكرا على الخدمة|شكراً على التغليف|شكرا على التغليف|حبيته جداً|حبيته جدا|عجبني جداً|عجبني جدا|انتو محترمين|إنتو محترمين');
const PRAISE_EN = /\b(?:arrived and (?:it'?s )?(?:great|lovely|perfect)|love(?:d)? it|great service|excellent service|thank you for the (?:fast )?(?:delivery|service|order))\b/i;

const CONDOLENCE = W('عزاء|عزا|العزا|متوفي|متوفى|توفى|توفي|اتوفى|اتوفت|المرحوم|المرحومة|وفاة|البقاء لله');
const CONDOLENCE_EN = /\b(?:condolence|funeral|passed away|bereavement|sympathy gift)\b/i;
const NEWBORN = W('مولود|مولودة|المولود|سبوع|السبوع|ولادة|ولدت|بيبي|رضيع|رضيعة');
const NEWBORN_EN = /\b(?:newborn|new baby|baby shower|just gave birth)\b/i;
const OCCASIONS: [NonNullable<SocialReading['occasion']>, RegExp][] = [
  ['condolence', CONDOLENCE], ['condolence', CONDOLENCE_EN], ['newborn', NEWBORN], ['newborn', NEWBORN_EN],
  ['ramadan', W('رمضان|رمضاني|الإفطار|الافطار|السحور|التراويح')], ['ramadan', /\bramadan\b/i],
  ['eid', W('العيد|عيد الفطر|عيد الأضحى|عيد الاضحى|العيدية')], ['eid', /\beid\b/i],
  ['mothers_day', W('عيد الأم|عيد الام|عيد ماما')], ['mothers_day', /\bmother'?s day\b/i],
  ['wedding', W('فرح|الفرح|فرحي|زفاف|عريس|عروسة|عروسه|كتب الكتاب|خطوبة|الخطوبة|شبكة')], ['wedding', /\b(?:wedding|bride|groom|engagement)\b/i],
  ['graduation', W('تخرج|التخرج|نجاح|نجح|نجحت|الثانوية العامة')], ['graduation', /\b(?:graduation|graduated|passed (?:his|her) exams)\b/i],
  ['valentine', W('فلانتين|الفلانتين|عيد الحب')], ['valentine', /\bvalentine\b/i],
];
const RECIPIENTS: [NonNullable<SocialReading['recipient']>, RegExp][] = [
  ['boss', W('مديري|لمديري|مديرتي|لمديرتي|المدير|رئيسي في الشغل|المدير بتاعي')], ['boss', /\bmy (?:boss|manager)\b/i],
  ['colleague', W('زميلي|زميلتي|لزميلي|لزميلتي|زمايلي|زملائي')], ['colleague', /\bcolleague|coworker\b/i],
  ['teacher', W('المدرس|المدرسة بتاعت|مدرستي|استاذي|أستاذي|الدكتور بتاعي|المعلم|المعلمة')], ['teacher', /\b(?:teacher|professor)\b/i],
  ['in_law', W('حماتي|حمايا|لحماتي|لحمايا|حماي|نسايبي|أهل مراتي|اهل مراتي|أهل جوزي|اهل جوزي')], ['in_law', /\bmother-in-law|father-in-law|in-laws\b/i],
  ['mother', W('ماما|لماما|امي|أمي|لأمي|لامي|والدتي|لوالدتي')], ['mother', /\bmy (?:mom|mother|mum)\b/i],
  ['father', W('بابا|لبابا|ابويا|أبويا|والدي|لوالدي')], ['father', /\bmy (?:dad|father)\b/i],
  ['partner', W('مراتي|لمراتي|زوجتي|جوزي|لجوزي|زوجي|خطيبتي|خطيبي|حبيبتي|حبيبي')], ['partner', /\bmy (?:wife|husband|fianc[eé]e?|girlfriend|boyfriend)\b/i],
  ['friend', W('صاحبي|صاحبتي|لصاحبي|لصاحبتي|صديقي|صديقتي')], ['friend', /\bmy friend\b/i],
];
const ETIQUETTE = W('ينفع اهادي|ينفع أهادي|ينفع اهدي|ينفع أهدي|يصح اهادي|يصح أهادي|يصح اهدي|يصح أهدي|عيب اهادي|عيب أهدي|اهاديه بإيه|أهاديه بإيه|اهاديها بإيه|أهاديها بإيه|هدية مناسبة|الهدية المناسبة|اجيب له ايه|أجيب له إيه|اجيبلها ايه|أجيبلها إيه|اجيبله ايه|أجيبله إيه|اهادي بايه|أهادي بإيه|إيه الهدية|ايه الهدية');
/** «ينفع أهاديه بعطر؟» — the same question with the pronoun joined to the verb. */
const ETIQUETTE_PRON = new RegExp(`(?<![${AR}])(?:ينفع|يصح|عيب|ممكن|اقدر|أقدر|ينفعش)\\s+(?:ا|أ)(?:هادي|هدي|جيب)(?:ه|ها|هم|له|لها|لهم|هوله|هولها)?(?![${AR}])`);
const ETIQUETTE_EN = /\b(?:is it (?:ok|appropriate|okay) to (?:give|gift)|appropriate gift|what (?:should|can) i (?:give|gift|get)|gift etiquette)\b/i;

const FORMAL = W('حضرتك|حضرتكم|سيادتك|سعادتك|يا فندم|يافندم|فندم|لو سمحت|من فضلك|تكرماً|تكرما');
const ELDER = W('كبير في السن|كبيرة في السن|على المعاش|ع المعاش|حفيدي|حفيدتي|أحفادي|احفادي|ست كبيرة|راجل كبير|سني كبير|مش بفهم في النت|مش بعرف في النت');
const GULF = W('ابغى|أبغى|ابي|أبي اشتري|وش|ايش|إيش|زين|حيل|مره حلو|مرة حلو|يعطيك العافية|الله يعافيك|هلا والله|عساك|ريال|درهم|دينار كويتي');
const LEVANT = W('بدي|بدّي|شو|هلق|هلأ|كتير منيح|منيح|عنجد|يسلمو|يسلموا|ليرة|كيفك|شلون');
const MAGHREB = W('بغيت|واش|بزاف|مزيان|دابا|درهم مغربي|ديال|نتاع|بصح|ياسر');
const EGYPT = W('عايز|عاوز|عايزة|ازاي|إزاي|كده|اوي|أوي|خالص|بتاع|بتاعي|ماشي|جنيه|يعني ايه');
const REF = /\bSH-[A-Z0-9-]{3,}\b/i;

const hit = (text: string, ...res: RegExp[]) => res.some((re) => re.test(text));
/** The situations that are a complaint (answered with empathy, an apology where something went wrong, and real steps). */
const COMPLAINTS: readonly Situation[] = ['late', 'damaged', 'wrong_item', 'missing', 'scent_doubt', 'refund', 'angry'];

/** Who is speaking, how, and what about — from the message and what he said before. */
export function readSituation(message: string, said: readonly string[] = []): SocialReading {
  const t = String(message || '').trim();
  const all = [...said.slice(-5), t].join('\n');
  const insults = hit(t, INSULT, INSULT_EN);
  const shouting = (t.match(/!/g) || []).length >= 3 || (/[A-Z]{6,}/.test(t) && t === t.toUpperCase());
  const annoyed = hit(t, ANNOYED, ANNOYED_EN);
  const problem = hit(t, LATE, LATE_EN, DAMAGED, DAMAGED_EN, WRONG, WRONG_EN, MISSING, MISSING_EN, DOUBT_SCENT, DOUBT_SCENT_EN, REFUND, REFUND_EN) || LONG_WAIT.test(t);
  const anger = (insults ? 3 : shouting ? 2 : annoyed ? (problem ? 2 : 1) : problem ? 1 : 0) as SocialReading['anger'];
  const occasion = OCCASIONS.find(([, re]) => re.test(all))?.[0];
  const recipient = RECIPIENTS.find(([, re]) => re.test(all))?.[0];
  const region: Region = hit(all, GULF) ? 'gulf' : hit(all, MAGHREB) ? 'maghreb' : hit(all, LEVANT) ? 'levant' : hit(all, EGYPT) ? 'egypt' : 'unknown';
  // The most specific problem first: a broken bottle that also came late is a damaged order.
  let situation: Situation | undefined;
  if (hit(t, DAMAGED, DAMAGED_EN)) situation = 'damaged';
  else if (hit(t, MISSING, MISSING_EN)) situation = 'missing';
  else if (hit(t, WRONG, WRONG_EN)) situation = 'wrong_item';
  else if (hit(t, DOUBT_SCENT, DOUBT_SCENT_EN)) situation = 'scent_doubt';
  else if (hit(t, REFUND, REFUND_EN)) situation = 'refund';
  else if (hit(t, LATE, LATE_EN) || LONG_WAIT.test(t)) situation = 'late';
  // «فين طلبي؟» asked calmly is a tracking question; with anger it is a late order.
  else if (hit(t, TRACKING, TRACKING_EN)) situation = anger >= 1 || insults ? 'late' : 'tracking';
  else if (insults) situation = 'angry';
  else if (hit(t, CORPORATE, CORPORATE_EN) || GROUP_GIFT.test(t.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)))) situation = 'corporate';
  else if (hit(t, WHOLESALE, WHOLESALE_EN) || BIG_QTY.test(t)) situation = 'wholesale';
  else if (hit(t, CONDOLENCE, CONDOLENCE_EN)) situation = 'condolence';
  else if (hit(t, NEWBORN, NEWBORN_EN) && /عطر|برفان|ريحة|هدية|هديه|perfume|gift|scent/i.test(t)) situation = 'newborn';
  else if (PRICE_MATCH.test(t.replace(/[إآ]/g, 'ا')) || PRICE_MATCH_EN.test(t)) situation = 'price_match';
  else if (hit(t, DISCOUNT, DISCOUNT_EN)) situation = 'discount';
  else if (hit(t, PRAISE, PRAISE_EN)) situation = 'praise';
  else if ((hit(t, ETIQUETTE, ETIQUETTE_EN) || ETIQUETTE_PRON.test(t)) && recipient) situation = 'etiquette';
  else if (hit(t, LOYAL, LOYAL_EN)) situation = 'loyal';
  // An insult right after a complaint («بقالي 10 أيام!!! ده نصب») is that complaint, angrier — not a new topic.
  if (situation === 'angry') {
    const earlier = [...said].reverse().slice(0, 3).map((s) => readSituation(s).situation).find((x) => x && (COMPLAINTS.includes(x) || x === 'tracking') && x !== 'angry');
    if (earlier) situation = earlier === 'tracking' ? 'late' : earlier;
  }
  const ref = REF.exec(all)?.[0]?.toUpperCase();
  return {
    ...(situation ? { situation } : {}), anger, formal: hit(all, FORMAL), elder: hit(all, ELDER), region,
    ...(ref ? { orderRef: ref } : {}), ...(occasion ? { occasion } : {}), ...(recipient ? { recipient } : {}), said: t,
  };
}

// ── 2. The sciences as data ──────────────────────────────────────────────────────────────────────────────────────
export interface Rule { id: string; ar: string; en: string; source: string }

/** Sociology applied: reading people and the world they live in. */
export const SOCIOLOGY: readonly Rule[] = [
  { id: 'context', ar: 'الزبون جزء من مجتمع: بلده ولهجته ومناسباته بتحدد إيه اللي يليق — العود والبخور ليهم مكانة كبيرة في الخليج، والمسك والعود محبوبين في مصر والمغرب، والورد والياسمين في الشام.', en: 'A customer belongs to a society: his country, dialect and occasions decide what is fitting — oud and bakhoor matter greatly in the Gulf, musk and oud are loved in Egypt and the Maghreb, rose and jasmine in the Levant.', source: 'Cultural sociology; Hofstede, Culture’s Consequences (1980)' },
  { id: 'register', ar: 'اللي بيقول «حضرتك» يتردّ عليه بـ«حضرتك»، والكبير في السن ياخد صبر وخطوات قصيرة من غير مصطلحات.', en: 'Whoever says “sir/madam” is answered the same way; an older visitor gets patience and short steps without jargon.', source: 'Communication accommodation theory — H. Giles (1973)' },
  { id: 'occasions', ar: 'المناسبة بتغيّر الهدية: رمضان ريحة هادية للتجمعات والصلاة، والعيد طقم مبهج، وعيد الأم الكلاسيكي الناعم، والفرح فخامة وثبات.', en: 'The occasion shapes the gift: Ramadan a calm scent for gatherings and prayer, Eid a festive set, Mother’s Day a soft classic, a wedding luxury and longevity.', source: 'Gift exchange — M. Mauss, The Gift (1925)' },
  { id: 'relationship', ar: 'العلاقة بتحدد الهدية: للمدير والزميل هدية محترمة ومش شخصية أوي، وللحبيب هدية رومانسية، وللأهل الكبار الريحة المألوفة.', en: 'The relationship decides the gift: for a boss or colleague a respectful, not-too-personal gift; for a partner a romantic one; for elders a familiar scent.', source: 'Social exchange and gift-giving norms — Belk (1979)' },
  { id: 'sensitivity', ar: 'في العزاء والحزن مفيش بيع: كلمة طيبة الأول، ولو سأل عن حاجة مناسبة نرشحله بهدوء (مسك أو عود خفيف للبيت والضيوف).', en: 'At a condolence there is no selling: a kind word first, and if he asks, a calm suggestion (musk or light oud for the home and guests).', source: 'Social norms of mourning; respect before commerce' },
  { id: 'safety_children', ar: 'المولود مايتحطلوش عطر: الهدية تبقى للأم، والريحة بعيد عن الرضيع.', en: 'No perfume on a newborn: the gift is for the mother, and the scent stays away from the baby.', source: 'Paediatric skin safety (fragrance-free advice for infants)' },
];

/** Public relations applied: complaints, anger, reputation. */
export const PUBLIC_RELATIONS: readonly Rule[] = [
  { id: 'heard', ar: 'الشكوى: اسمع، اتعاطف، اعتذر، حلّ بخطوات حقيقية، وقول هيحصل إيه بعد كده.', en: 'A complaint: hear, empathise, apologise, resolve with real steps, and say what happens next.', source: 'HEARD / LATTE service-recovery models (Disney, Starbucks)' },
  { id: 'recovery', ar: 'المشكلة اللي بتتحل كويس بتخلّي الزبون أوفى من قبلها — فالشكوى فرصة مش هجوم.', en: 'A problem solved well can leave a customer more loyal than before — a complaint is a chance, not an attack.', source: 'Service recovery paradox — McCollough & Bharadwaj (1992)' },
  { id: 'calm', ar: 'الزبون الغضبان مايتردّش عليه بنفس النبرة ولا بمحاضرة عن الأسلوب: هدوء، تقدير لزعله، وحل.', en: 'An angry customer is never answered in kind or lectured on his tone: calm, acknowledgement, and a solution.', source: 'De-escalation; emotional contagion — Hatfield et al. (1993)' },
  { id: 'no_blame', ar: 'مانلومش الزبون ولا نقول «مش مسؤوليتنا»؛ لو فيه سبب نشرحه كمعلومة مش كدفاع.', en: 'Never blame the customer or say “not our responsibility”; any cause is explained as information, not defence.', source: 'Situational Crisis Communication Theory — W. T. Coombs (2007)' },
  { id: 'specific', ar: 'الاعتذار الحقيقي بيسمّي المشكلة بالاسم، مش جملة جاهزة.', en: 'A real apology names the problem; it is not a stock phrase.', source: 'Apology research — Lewicki, Polin & Lount (2016)' },
  { id: 'honest_promise', ar: 'مانوعدش بميعاد ولا تعويض محدش اتأكد منه؛ نوعد بالخطوة اللي نقدر عليها.', en: 'Never promise a date or compensation nobody confirmed; promise only the step we control.', source: 'Expectation management — Parasuraman, Zeithaml & Berry, SERVQUAL (1988)' },
  { id: 'privacy', ar: 'بيانات الطلب ماتتطلبش في الشات ولا تتعرض: رقم الطلب مع الهاتف أو الإيميل في صندوق التتبع بس، ومفيش أرقام كروت.', en: 'Order data is never asked for or shown in chat: the reference with the phone or e-mail in the tracking box only, never card numbers.', source: 'Data protection — Egypt Law 151/2020, GDPR' },
];

/** Commerce applied: the different kinds of customer and deal. */
export const COMMERCE: readonly Rule[] = [
  { id: 'segments', ar: 'كل نوع عميل ليه طريق: الفرد يشتري من المتجر، والتاجر والشركة ياخدوا عرض سعر مكتوب من الفريق.', en: 'Each kind of customer has a path: an individual buys from the store; a trader or a company gets a written quote from the team.', source: 'Market segmentation — W. Smith (1956); B2B vs B2C selling' },
  { id: 'qualify', ar: 'في الجملة والشركات اسأل الأسئلة اللي بتبني العرض: الكمية، المنتجات، البلد، الميعاد، وشكل التغليف.', en: 'For wholesale and companies, ask what builds the quote: quantity, products, country, date and packaging.', source: 'Consultative B2B selling — BANT qualification' },
  { id: 'principled', ar: 'التفاوض على المصلحة مش على الموقف: اعرف إيه اللي يهمه فعلاً (الميزانية؟ الكمية؟ السرعة؟) واقترح حل حقيقي.', en: 'Negotiate interests, not positions: learn what truly matters (budget? quantity? speed?) and offer a real solution.', source: 'Principled negotiation — Fisher & Ury, Getting to Yes (1981)' },
  { id: 'no_chat_discount', ar: 'مفيش خصم بيتقال في الشات؛ أي خصم حقيقي بيظهر في صفحة الدفع، وأسعار الكميات من عرض السعر الرسمي.', en: 'No discount is promised in chat; any real discount shows at checkout, and quantity prices come from the official quote.', source: 'Store honesty law; consumer protection — Egypt Law 181/2018' },
  { id: 'loyalty', ar: 'الزبون اللي راجع يتقدّر بالاسم والتجربة اللي فاتت، مش بمكافأة مختلقة.', en: 'A returning customer is valued by remembering his last experience, not by an invented reward.', source: 'Customer lifetime value; relationship marketing — Berry (1983)' },
  { id: 'gratitude', ar: 'الشكر يتردّ بشكر حقيقي ودعوة يكتب تقييمه، من غير ما نبيع له على طول.', en: 'Thanks are met with real thanks and an invitation to leave a review — without selling to him at once.', source: 'Reciprocity and word of mouth — Cialdini (1984); Reichheld (2003)' },
];

/** What ruins a relationship — caught in a reply (his own replies are tested to fall into none). */
export interface RelationPitfall extends Rule { detect: { ar?: RegExp; en?: RegExp } }
export const RELATION_PITFALLS: readonly RelationPitfall[] = [
  { id: 'blame', ar: 'لوم الزبون: «انت اللي غلطت»، «كان لازم تقرا».', en: 'Blaming the customer: “you made a mistake”, “you should have read”.', source: 'SCCT — Coombs (2007)', detect: { ar: /(?:انت|إنت|حضرتك) اللي (?:غلطت|اخترت غلط|طلبت غلط)|كان لازم (?:تقرا|تقرأ|تاخد بالك)|ده ذنبك|دي غلطتك/, en: /(?:it was|that'?s) your (?:fault|mistake)|you should have read/i } },
  { id: 'deny', ar: 'التنصل: «مش مسؤوليتنا»، «مش مشكلتنا».', en: 'Denial: “not our responsibility”, “not our problem”.', source: 'SCCT — Coombs (2007)', detect: { ar: /مش مسؤوليتنا|مش مسئوليتنا|مش مشكلتنا|ملناش دعوة|مالناش دعوة|مش ذنبنا/, en: /not our (?:responsibility|problem|fault)|nothing to do with us/i } },
  { id: 'lecture', ar: 'محاضرة للزبون عن أسلوبه بدل حل مشكلته.', en: 'Lecturing the customer on his tone instead of solving his problem.', source: 'De-escalation practice', detect: { ar: /(?:اتكلم|اتكلّم|ياريت تتكلم) (?:بأدب|باحترام)|راعي ألفاظك|راعي الفاظك|مش هرد عليك/, en: /watch your (?:language|tone)|speak (?:politely|respectfully)|i won'?t answer you/i } },
  { id: 'false_promise', ar: 'وعد بميعاد أو تعويض محدش اتأكد منه.', en: 'Promising a date or compensation nobody confirmed.', source: 'SERVQUAL — expectation management', detect: { ar: /هيوصلك (?:بكرة|النهاردة|خلال \d+)|هنعوضك ب|هتاخد (?:خصم|تعويض|هدية)|هنرجعلك فلوسك فوراً|مضمون يوصل/, en: /it will arrive (?:tomorrow|today|within \d+)|we'?ll compensate you with|you'?ll get (?:a discount|compensation|a free)/i } },
  { id: 'argue', ar: 'الجدال: «مستحيل»، «ده مش صحيح»، «المنتج أصلي غصب عنك».', en: 'Arguing: “impossible”, “that’s not true”.', source: 'Service recovery', detect: { ar: /مستحيل (?:يكون|يحصل)|ده مش صحيح|كلامك غلط|انت بتبالغ|إنت بتبالغ/, en: /that'?s impossible|that'?s not true|you'?re exaggerating/i } },
  { id: 'data_ask', ar: 'طلب بيانات حساسة في الشات (رقم الكارت، الباسورد، الرقم القومي).', en: 'Asking for sensitive data in chat (card number, password, national ID).', source: 'Data protection', detect: { ar: /(?:ابعت|ابعتلي|اكتب|اكتبلي) (?:رقم (?:الكارت|البطاقة|الفيزا)|الباسورد|كلمة السر|الرقم القومي)/, en: /(?:send|give|type) (?:me )?(?:your )?(?:card number|password|national id)/i } },
  { id: 'cold', ar: 'رد بارد جاهز من غير ما يسمّي المشكلة («نعتذر عن الإزعاج» وخلاص).', en: 'A cold stock reply that never names the problem (“sorry for the inconvenience” and nothing else).', source: 'Apology research', detect: {} },
  { id: 'sell_in_grief', ar: 'البيع في موقف حزن أو عزاء.', en: 'Selling into grief or a condolence.', source: 'Social norms', detect: {} },
];

/** The pitfalls a reply falls into. `situation` adds the checks that depend on it. */
export function relationsLint(reply: string, situation?: Situation, lang: Lang = /[\u0600-\u06FF]/.test(reply) ? 'ar' : 'en'): string[] {
  const found = RELATION_PITFALLS.filter((p) => { const re = p.detect[lang] || p.detect.en; return re ? re.test(reply) : false; }).map((p) => p.id);
  const complaint = situation && COMPLAINTS.includes(situation);
  if (complaint) {
    const empathy = lang === 'ar' ? /حقك|فاهمك|فاهم إنك|متضايق|مزعج|زعلك|أنا آسف|آسفين|بعتذر|نعتذر|بناخدها بجد/ : /i understand|you have every right|frustrating|i'?m sorry|we'?re sorry|apolog|take it seriously/i;
    const step = lang === 'ar' ? /SH-|التتبع|الدعم|مساعد شام|إيميل|بريد|صوّر|صور/ : /SH-|track|support|Sham services assistant|e-?mail|photo/i;
    if (!empathy.test(reply) || !step.test(reply)) found.push('cold');
  }
  if (situation === 'condolence' && /\/p\/[a-z0-9-]+\.html|هاخده|شراء مباشر|I'll take it|Buy now/i.test(reply)) found.push('sell_in_grief');
  return [...new Set(found)];
}

/** Sentences that ruin a relationship, removed from a platform's reply in a complaint (never the whole reply). */
export function polishRelations(reply: string): string {
  if (!reply) return reply;
  const rules = RELATION_PITFALLS.filter((p) => p.detect.ar || p.detect.en);
  const bad = (s: string) => rules.some((p) => (p.detect.ar?.test(s)) || (p.detect.en?.test(s)));
  const out = reply.split('\n').map((line) => (bad(line) ? line.split(/(?<=[.!؟?…])\s+/).filter((s) => !bad(s)).join(' ') : line)).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return out.length >= reply.length * 0.4 ? out : reply;
}

/** The three sciences in a few lines, for the AI engines' system prompt. */
export function relationsPromptBlock(lang: Lang): string {
  const pick = (list: readonly Rule[], ids: string[]) => ids.map((id) => list.find((r) => r.id === id)!).map((r) => `- ${r[lang]}`);
  return [
    lang === 'ar' ? 'في التعامل مع الناس (علم الاجتماع والعلاقات العامة والتجارة):' : 'Dealing with people (sociology, public relations, commerce):',
    ...pick(SOCIOLOGY, ['context', 'register', 'occasions', 'relationship', 'sensitivity']),
    ...pick(PUBLIC_RELATIONS, ['heard', 'calm', 'no_blame', 'specific', 'honest_promise', 'privacy']),
    ...pick(COMMERCE, ['segments', 'principled', 'no_chat_discount', 'gratitude']),
    lang === 'ar' ? 'وممنوع: لوم الزبون، «مش مسؤوليتنا»، محاضرة عن الأسلوب، وعد بميعاد أو تعويض مش متأكد منه، الجدال، طلب رقم كارت أو باسورد، والبيع في موقف حزن.' : 'Never: blame the customer, “not our responsibility”, lecture on tone, promise an unconfirmed date or compensation, argue, ask for a card number or password, or sell into grief.',
  ].join('\n');
}

/** How this visitor should be spoken to (for a platform's prompt). */
export function socialHint(r: SocialReading, lang: Lang): string {
  const ar = lang === 'ar';
  const parts: string[] = [];
  if (r.anger >= 2) parts.push(ar ? 'الزائر متضايق جداً: ابدأ بتقدير زعله واعتذار يسمّي المشكلة، رد قصير وهادي، وخطوات حل حقيقية.' : 'The visitor is very upset: start by acknowledging it with an apology that names the problem; short, calm, real steps.');
  else if (r.anger === 1) parts.push(ar ? 'الزائر متضايق: اتعاطف الأول وبعدين الحل.' : 'The visitor is annoyed: empathise first, then solve.');
  if (r.formal) parts.push(ar ? 'بيتكلم برسمية: استخدم «حضرتك».' : 'He speaks formally: answer formally.');
  if (r.elder) parts.push(ar ? 'غالباً كبير في السن: صبر، خطوات قصيرة مرقّمة، ومن غير مصطلحات.' : 'Likely older: patient, short numbered steps, no jargon.');
  const region: Record<Region, { ar: string; en: string } | undefined> = {
    gulf: { ar: 'من الخليج غالباً: العود والبخور ليهم مكانة كبيرة، والشحن بيتحسب لبلده.', en: 'Likely from the Gulf: oud and bakhoor matter; shipping is computed for his country.' },
    levant: { ar: 'من الشام غالباً: الورد والياسمين والمسك محبوبين.', en: 'Likely from the Levant: rose, jasmine and musk are loved.' },
    maghreb: { ar: 'من المغرب العربي غالباً: المسك والعود محبوبين.', en: 'Likely from the Maghreb: musk and oud are loved.' },
    egypt: undefined, unknown: undefined,
  };
  if (region[r.region]) parts.push(region[r.region]![lang]);
  return parts.join(' ');
}

// ── 3. The replies ──────────────────────────────────────────────────────────────────────────────────────────────
const TRACK: Record<Lang, string> = {
  ar: 'افتح «مساعد شام للخدمات» (أيقونة المساعد في الموقع) واكتب رقم الطلب اللي بيبدأ بـ SH- مع رقم الهاتف أو الإيميل اللي طلبت بيهم في صندوق التتبع — هيظهرلك حالة الطلب الحقيقية.',
  en: 'Open the “Sham services assistant” (the assistant icon on the site) and enter the order reference starting with SH- with the phone or e-mail you ordered with in the tracking box — it shows the real status.',
};
const TAG_EN: Record<string, string> = { 'الطلبات': 'Orders', 'الدعم': 'Support' };
const human = (lang: Lang, tag: string) => (lang === 'ar'
  ? `ولو عايز حد من الفريق يتابع معاك بنفسه: اطلب «التحويل لموظف» من «مساعد شام للخدمات»، أو ابعت على ${STORE_EMAIL} وفي العنوان «[شام | ${tag}]» مع رقم الطلب.`
  : `If you want someone from the team to follow up personally: ask for “a human” in the Sham services assistant, or e-mail ${STORE_EMAIL} with “[Sham | ${TAG_EN[tag] || 'Support'}]” and the order reference in the subject.`);
const RETURNS: Record<Lang, string> = {
  ar: 'المنتج اللي وصل تالف أو غلط من حقك تستبدله أو تسترد تمنه، والمختوم اللي متفتحش ينفع يترجع في المدة القانونية لبلدك (في مصر 14 يوم للشراء عن بعد) — والتفاصيل في «مركز القوانين ← الإرجاع والاسترداد».',
  en: 'An item that arrived damaged or wrong can be exchanged or refunded, and a sealed, unopened item can be returned within your country’s legal window (Egypt: 14 days for distance selling) — details in the Legal Centre → Returns & Refunds.',
};
const noCard: Record<Lang, string> = {
  ar: '_ومش هطلب منك أي بيانات دفع في الشات._',
  en: '_And I will never ask for payment details in the chat._',
};

/** Opening words for a complaint, calmer and shorter as the anger rises. */
function acknowledge(r: SocialReading, lang: Lang, what: { ar: string; en: string }, sorry = true): string {
  const ar = lang === 'ar';
  const ref = r.orderRef ? (ar ? ` (طلب ${r.orderRef})` : ` (order ${r.orderRef})`) : '';
  if (r.anger >= 3) return ar ? `فاهم إن${r.formal || r.elder ? ' حضرتك' : 'ك'} متضايق جداً، وده حقك — ${what.ar}${ref}. أنا آسف بجد على اللي حصل، وخليني أقولك نحلها إزاي على طول:`
    : `I understand you are very upset, and you have every right — ${what.en}${ref}. I am truly sorry, and here is how we fix it right away:`;
  if (r.anger === 2) return ar ? `حقك تزعل — ${what.ar}${ref}. أنا آسف على اللي حصل، ودي الخطوات اللي بتحلها:` : `You have every right to be upset — ${what.en}${ref}. I am sorry, and these are the steps that fix it:`;
  // Nothing went wrong yet (a sealed item he wants to return): no apology for what did not happen.
  if (!sorry) return ar ? `${what.ar}${ref} — ودي الخطوات:` : `${what.en}${ref} — here are the steps:`;
  return ar ? `${what.ar}${ref} — وأنا آسف على اللي حصل. نحلها كده:` : `${what.en}${ref} — I am sorry, and I understand how frustrating that is. Here is how we fix it:`;
}

const numbered = (lines: string[]) => lines.map((l, i) => `${i + 1}. ${l}`);
const PRODUCT_LINK = /\/p\/[a-z0-9-]+\.html/;

function complaintReply(r: SocialReading, lang: Lang): string {
  const ar = lang === 'ar';
  const out: string[] = [];
  switch (r.situation) {
    case 'late':
      out.push(acknowledge(r, lang, { ar: 'الطلب اتأخر عن اللي كنت مستنيه', en: 'your order is later than you expected' }),
        ...numbered([TRACK[lang], ar ? 'لو الحالة واقفة أو الميعاد عدّى، الفريق بيتابع مع شركة الشحن — وده بيحصل أسرع لما يوصلهم رقم الطلب.' : 'If the status is stuck or the date has passed, the team follows up with the courier — faster when they have the reference.', human(lang, 'الطلبات')]),
        '', ar ? 'ومش هوعدك بميعاد وصول مش متأكد منه — الحالة الحقيقية هي اللي هتقولنا.' : 'I will not promise an arrival date I am not sure of — the real status will tell us.');
      break;
    case 'damaged':
      out.push(acknowledge(r, lang, { ar: 'وصول الطلب تالف حاجة مزعجة فعلاً', en: 'receiving a damaged order is really frustrating' }),
        ...numbered([ar ? 'صوّر الزجاجة والعلبة والكرتونة زي ما وصلت، ومن فضلك ماترميش حاجة منهم لحد ما الموضوع يتقفل.' : 'Photograph the bottle, its box and the carton as they arrived, and please keep them until the case is closed.', ar ? `ابعت الصور مع رقم الطلب على ${STORE_EMAIL} وفي العنوان «[شام | الدعم]»، أو اطلب «التحويل لموظف» من «مساعد شام للخدمات».` : `Send the photos with the order reference to ${STORE_EMAIL} with “[Sham | Support]” in the subject, or ask for “a human” in the Sham services assistant.`, RETURNS[lang]]));
      break;
    case 'missing':
      out.push(acknowledge(r, lang, { ar: 'إن الطلب يوصلك ناقص حاجة مزعج فعلاً، وحقك يكمل', en: 'an order arriving with something missing is really frustrating, and you are right to want it complete' }),
        ...numbered([ar ? 'صوّر الكرتونة زي ما وصلت والمنتجات اللي جت، ومعاهم الفاتورة أو تفاصيل الطلب (فيها الكمية اللي طلبتها).' : 'Photograph the carton as it arrived and the items that came, with the invoice or order details (they show the quantity you ordered).',
          ar ? `ابعت الصور مع رقم الطلب على ${STORE_EMAIL} وفي العنوان «[شام | الطلبات]»، أو اطلب «التحويل لموظف» من «مساعد شام للخدمات» — والفريق بيراجع الشحنة ويرتب إن الناقص يوصلك أو يرجعلك تمنه.` : `Send the photos with the order reference to ${STORE_EMAIL} with “[Sham | Orders]” in the subject, or ask for “a human” in the Sham services assistant — the team checks the shipment and arranges for the missing item to reach you or its price to be refunded.`,
          ar ? 'لو الطلب جالك على شحنتين، الحالة في صندوق التتبع بتوضح لو فيه جزء لسه في الطريق.' : 'If the order was split into two parcels, the status in the tracking box shows whether part of it is still on its way.']));
      break;
    case 'wrong_item':
      out.push(acknowledge(r, lang, { ar: 'استلامك حاجة غير اللي طلبتها مش مقبول', en: 'receiving something other than what you ordered is not acceptable' }),
        ...numbered([ar ? 'سيب المنتج زي ما هو من غير ما تفتحه، وصوّره هو والفاتورة أو تفاصيل الطلب.' : 'Keep the item unopened and photograph it with the invoice or order details.', ar ? `ابعت الصور ورقم الطلب على ${STORE_EMAIL} وفي العنوان «[شام | الطلبات]» — والفريق بيرتب الاستبدال.` : `Send the photos and the reference to ${STORE_EMAIL} with “[Sham | Orders]” in the subject — the team arranges the exchange.`, RETURNS[lang]]));
      break;
    case 'scent_doubt':
      out.push(ar ? 'ملاحظتك مهمة وبناخدها بجد، وشكراً إنك قلتها بدل ما تسكت عليها.' : 'Your remark matters and we take it seriously — thank you for saying it rather than keeping quiet.',
        ar ? 'قبل أي حكم، فيه حاجات بتغيّر إحساسنا بالريحة فعلاً: أول دقايق بيبان الكحول وبعدين بيهدى، والبشرة والجو بيأثروا في الثبات، والزجاجة الجديدة ساعات بتحتاج كام بخة الأول. ودي معلومة، مش رد على كلامك.' : 'Before any verdict, some things really change how a scent comes across: the alcohol shows for the first minutes and then settles, skin and weather affect longevity, and a new bottle sometimes needs a few sprays first. That is information, not an answer to your point.',
        ...numbered([ar ? 'قولّي لاحظت الفرق في إيه بالظبط (الافتتاحية؟ الثبات؟ الريحة نفسها؟) وبتقارنها بإيه.' : 'Tell me exactly what differs (the opening? longevity? the scent itself?) and what you compare it with.',
          ar ? `ولو حابب الفريق يراجع المنتج نفسه: صوّر الزجاجة والعلبة والكود المطبوع عليها، وابعت على ${STORE_EMAIL} وفي العنوان «[شام | الدعم]».` : `If you would like the team to review the item itself: photograph the bottle, the box and its printed code, and e-mail ${STORE_EMAIL} with “[Sham | Support]” in the subject.`,
          RETURNS[lang]]));
      break;
    case 'refund':
      out.push(acknowledge(r, lang, { ar: 'طلبك إنك ترجّع الطلب أو تسترد فلوسك واضح ومن حقك', en: 'I understand you want to return the order or get your money back' }, r.anger >= 2),
        ...numbered([RETURNS[lang], ar ? 'لو الطلب لسه ماتشحنش، الإلغاء أسهل: اطلبه من «مساعد شام للخدمات» برقم الطلب.' : 'If it has not shipped yet, cancelling is easier: ask the Sham services assistant with the order reference.', human(lang, 'الطلبات')]),
        '', ar ? 'وقولّي لو تحب السبب — مش عشان أقنعك تغيّر رأيك، عشان مانكررش اللي ضايقك.' : 'And tell me the reason if you like — not to change your mind, so that what upset you does not happen again.');
      break;
    default:
      out.push(ar ? `فاهم إن${r.formal || r.elder ? ' حضرتك' : 'ك'} متضايق جداً، وأنا آسف إن تجربتك معانا وصلت للدرجة دي. أنا هنا عشان أحلها مش عشان أجادل.` : 'I understand you are very upset, and I am sorry your experience with us came to this. I am here to fix it, not to argue.',
        ...numbered([ar ? 'قولّي في سطر حصل إيه بالظبط (تأخير؟ منتج تالف أو غلط؟ ريحة مختلفة؟ استرجاع؟).' : 'Tell me in a line what exactly happened (a delay? a damaged or wrong item? a different scent? a refund?).', human(lang, 'الدعم')]));
  }
  out.push('', noCard[lang]);
  return out.join('\n');
}

/** «فين طلبي؟» asked calmly: where to see it, with no apology for a delay nobody mentioned. Asked again: step by step. */
function trackingReply(r: SocialReading, lang: Lang, again: boolean): string {
  const ar = lang === 'ar';
  const ref = r.orderRef ? (ar ? ` (طلب ${r.orderRef})` : ` (order ${r.orderRef})`) : '';
  if (again) {
    return [ar ? `خطوة بخطوة${ref}:` : `Step by step${ref}:`,
      ...numbered(ar ? ['اضغط أيقونة «مساعد شام للخدمات» في ركن الشاشة.', 'اضغط زرار «تتبع طلبي» (أو اكتبها في المساعد).', 'اكتب رقم الطلب اللي بيبدأ بـ SH- ورقم الهاتف أو الإيميل اللي طلبت بيهم.', 'هتظهرلك حالة الطلب الحقيقية وآخر تحديث ليها.']
        : ['Tap the “Sham services assistant” icon in the corner of the screen.', 'Press “Track my order” (or type it in the assistant).', 'Enter the order reference starting with SH- and the phone or e-mail you ordered with.', 'The real status of the order and its latest update appear.']),
      '', ar ? 'مش لاقي رقم الطلب؟ موجود في رسالة تأكيد الطلب اللي وصلتك على الإيميل (لو كتبته وقت الطلب)، أو في صفحة نجاح الطلب.' : 'Can’t find the reference? It is in the order confirmation e-mail (if you gave one when ordering) or on the order success page.',
      human(lang, 'الطلبات')].join('\n');
  }
  return [ar ? `تقدر تعرف طلبك${ref} وصل لفين في ثواني:` : `You can see where your order${ref} is in seconds:`,
    ...numbered([TRACK[lang], ar ? 'رقم الطلب (SH-…) موجود في رسالة تأكيد الطلب وفي صفحة نجاح الطلب.' : 'The reference (SH-…) is in the order confirmation and on the order success page.']),
    '', ar ? 'ولو الحالة واقفة أو الميعاد عدّى، قولّي وأنا أقولك تعمل إيه على طول.' : 'If the status is stuck or the date has passed, tell me and I will tell you what to do right away.'].join('\n');
}

/** «عندكم أغلى من محل تاني»: thanks, how to compare like with like, the honest answer, and a real way to save. */
function priceMatchReply(r: SocialReading, lang: Lang, shown: boolean): string {
  const ar = lang === 'ar';
  return [ar ? `شكراً إن${r.formal ? ' حضرتك' : 'ك'} قلتلي بدل ما تمشي — والمقارنة من حقك.` : 'Thank you for telling me rather than just leaving — comparing is your right.',
    '', ar ? '**عشان المقارنة تبقى عادلة، اتأكد إنها على نفس الحاجة بالظبط:**' : '**For a fair comparison, make sure it is exactly the same thing:**',
    ar ? '- نفس الحجم (50 مل غير 100 مل) ونفس التركيز (ماء عطر EDP غير ماء تواليت EDT).' : '- The same size (50 ml is not 100 ml) and concentration (EDP is not EDT).',
    ar ? '- أصلي ومختوم، مش تستر ولا عبوة مفتوحة أو تقليد — فرق السعر الكبير غالباً بيبان هنا.' : '- Original and sealed — not a tester, an opened bottle or an imitation; a big price gap usually hides here.',
    ar ? '- السعر شامل الشحن ولا من غيره — عندنا الشحن لبلدك بيظهر في صفحة الدفع قبل ما تأكد.' : '- Whether the price includes shipping — ours shows on the payment page before you confirm.',
    '', ar ? '**وبصراحة:** مش هقدر أوعدك بتخفيض أو مطابقة سعر في الشات، وأي خصم حقيقي بيظهر في صفحة الدفع نفسها.' : '**Honestly:** I cannot promise a reduction or a price match in chat; any real discount shows on the payment page itself.',
    ar ? (shown ? 'بس أقدر أوفّرلك بطريقة حقيقية: نفس العطر بحجم أصغر لو موجود، أو عطر قريب منه بسعر أقل — قولّي «عايز بديل أرخص» وأنا أطلعهولك من المتجر.' : 'بس أقدر أوفّرلك بطريقة حقيقية: نفس العطر بحجم أصغر لو موجود، أو عطر قريب منه بسعر أقل — قولّي اسم العطر وأنا أدورلك.')
      : (shown ? 'But I can help you save for real: the same perfume in a smaller size when there is one, or a close perfume for less — say “a cheaper alternative” and I will find it in the store.' : 'But I can help you save for real: the same perfume in a smaller size when there is one, or a close perfume for less — tell me its name and I will look.'),
    ar ? `ولو عايز الفريق يراجع السعر، ابعت لينك المكان التاني على ${STORE_EMAIL} وفي العنوان «[شام | الدعم]».` : `If you would like the team to review the price, send the other shop’s link to ${STORE_EMAIL} with “[Sham | Support]” in the subject.`].join('\n');
}

/** The quantity and the product a trader or a company named («30 زجاجة عود»، «10 هدايا»). */
function orderDetails(text: string): { qty?: number; unit?: string; item?: string } {
  const t = text.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  const q = /(\d{1,6})\s*(زجاج[ةه]|ازاز[ةه]|إزاز[ةه]|قطع[ةه]|علب[ةه]|طقم|اطقم|أطقم|هدي[ةه]|هدايا|كرتون[ةه]|كراتين|دست[ةه]|bottles?|pieces?|units?|sets?|gifts?|boxes)/i.exec(t);
  const item = /(?<![\u0621-\u064A])(?:ال)?(عود|مسك|عنبر|ورد|بخور|فانيليا|زعفران|ياسمين|صندل|منعش|حمضي|خشبي|أطقم هدايا|اطقم هدايا)(?![\u0621-\u064A])|\b(oud|musk|amber|rose|incense|vanilla|fresh|woody|gift sets?)\b/i.exec(t);
  return { ...(q ? { qty: Number(q[1]), unit: q[2] } : {}), ...(item ? { item: item[1] || item[2] } : {}) };
}

/** A trader or a company answering the questions of the quote: what he said is noted, only what is missing is asked. */
function quoteFollowUp(lang: Lang, corporate: boolean, d: { qty?: number; unit?: string; item?: string }): string {
  const ar = lang === 'ar';
  const noted = [d.qty ? `${d.qty} ${d.unit}` : '', d.item ? (ar ? `طابع ${d.item}` : `${d.item} style`) : ''].filter(Boolean).join(' · ');
  const left = corporate
    ? (ar ? ['الميزانية التقريبية للفرد', 'ميعاد التسليم والمدينة', 'لو محتاجين كارت باسم الشركة أو تغليف موحّد'] : ['the rough budget per person', 'the delivery date and city', 'whether you need a card with the company name or uniform wrapping'])
    : (ar ? ['الحجم اللي عايزه (مل) والماركة لو فيه واحدة معيّنة', 'البلد والمدينة', 'هتبيعها في محل ولا أونلاين'] : ['the size you want (ml) and the house if you have one in mind', 'the country and city', 'whether you will resell in a shop or online']);
  return [ar ? `تمام، سجّلت عندي: **${noted}** 👌` : `Noted: **${noted}** 👌`,
    '', ar ? '**فاضل عشان العرض يطلع دقيق:**' : '**Still needed for an accurate quote:**', ...left.map((a) => `- ${a}`),
    '', ar ? `ابعت التفاصيل دي كلها مرة واحدة من «مساعد شام للخدمات» ← «محتاج عرض سعر جملة»، أو على ${STORE_EMAIL} وفي العنوان «[شام | الطلبات]» — والفريق بيرد بعرض مكتوب.` : `Send all of it at once from the Sham services assistant → “I need a wholesale quote”, or to ${STORE_EMAIL} with “[Sham | Orders]” in the subject — the team replies with a written quote.`,
    ar ? '_سعر الكمية بيتحدد في العرض الرسمي — مش هقولك رقم في الشات مش متأكد منه._' : '_The quantity price is set in the official quote — I will not give you a figure in chat I am not sure of._'].join('\n');
}

function wholesaleReply(r: SocialReading, lang: Lang, corporate: boolean): string {
  const ar = lang === 'ar';
  const team = r.recipient === 'colleague' || r.recipient === 'boss';
  const head = corporate
    ? (team ? (ar ? 'هدايا لزمايلك في الشغل فكرة حلوة بتقرّب الفريق، والعطر هدية بتتفتكر.' : 'Gifts for your colleagues are a lovely way to bring the team closer, and a perfume is remembered.')
      : (ar ? 'هدايا الشركات من أحلى الطلبات عندنا، وفكرة إنها تكون عطر بتسيب أثر حلو عند اللي هيستلمها.' : 'Corporate gifts are one of our favourite requests — a perfume leaves a lasting impression on whoever receives it.'))
    : (ar ? `أهلاً بي${r.formal ? ' حضرتك' : 'ك'} — طلبات الجملة والتجار ليها طريق خاص عندنا بعرض سعر مكتوب، مش أسعار المتجر العادية.` : 'Welcome — wholesale and trade orders have their own path with a written quote, not the regular store prices.');
  const d = orderDetails(r.said || '');
  const asks = corporate
    ? (ar ? [d.qty ? 'الميزانية التقريبية للفرد' : 'عدد الهدايا والميزانية التقريبية للفرد', 'رجالي ولا نسائي ولا للجنسين (الأضمن في الشركات: طابع خشبي أو مسك نظيف، أو أطقم الهدايا)', 'ميعاد التسليم والمدينة', 'لو محتاجين كارت باسم الشركة أو تغليف موحّد'] : [d.qty ? 'the rough budget per person' : 'the number of gifts and the rough budget per person', 'men, women or unisex (safest for companies: a woody or clean-musk character, or gift sets)', 'the delivery date and city', 'whether you need a card with the company name or uniform wrapping'])
    : (ar ? ['المنتجات أو الطابع اللي عايزه', 'الكمية التقريبية لكل منتج', 'البلد والمدينة', 'هتبيعها في محل ولا أونلاين ولا للاستخدام'] : ['the products or style you want', 'the rough quantity of each', 'the country and city', 'whether you will resell in a shop, online, or use them yourself']);
  const noted = [d.qty ? `${d.qty} ${d.unit}` : '', d.item ? (ar ? `طابع ${d.item}` : `${d.item} style`) : ''].filter(Boolean).join(' · ');
  return [head, ...(noted ? ['', ar ? `سجّلت عندي: **${noted}**.` : `Noted: **${noted}**.`] : []), '', ar ? '**عشان العرض يطلع دقيق، جهّز:**' : '**For an accurate quote, have ready:**', ...asks.map((a) => `- ${a}`), '',
    ar ? '**إزاي تطلب العرض:** افتح «مساعد شام للخدمات» واختار «محتاج عرض سعر جملة» — الطلب بيوصل الفريق ويردوا عليك بعرض مكتوب.' : '**How to request it:** open the Sham services assistant and choose “I need a wholesale quote” — it reaches the team, who reply with a written quote.',
    ar ? `أو ابعت التفاصيل على ${STORE_EMAIL} وفي العنوان «[شام | الطلبات]».` : `Or send the details to ${STORE_EMAIL} with “[Sham | Orders]” in the subject.`, '',
    ar ? '_أسعار الكميات بتتحدد في العرض الرسمي حسب الكمية والشحن — مش هقولك رقم في الشات مش متأكد منه._' : '_Quantity prices are set in the official quote by quantity and shipping — I will not give you a figure in chat I am not sure of._'].join('\n');
}

function discountReply(r: SocialReading, lang: Lang, shown = false): string {
  const ar = lang === 'ar';
  return [ar ? 'سؤالك في محله، وكلنا بنحب نوفّر.' : 'Fair question — we all like to save.',
    ar ? 'بصراحة: مفيش خصومات بتتقال في الشات، وأي كود خصم حقيقي بيظهر في صفحة الدفع نفسها قبل ما تأكد.' : 'Honestly: no discounts are promised in chat; any real discount code shows on the payment page itself before you confirm.',
    '', ar ? '**بس فيه طرق حقيقية توفّر بيها:**' : '**But there are real ways to save:**',
    shown ? (ar ? '- نفس العطر اللي رشحتهولك بحجم أصغر لو موجود، أو عطر قريب منه بسعر أقل — قولّي «عايز بديل أرخص» وأنا أطلعهولك.' : '- The same perfume I suggested in a smaller size when there is one, or a close one for less — say “a cheaper alternative” and I will find it.')
      : (ar ? '- نفس العطر بحجم أصغر لو موجود، أو عطر قريب في الطابع بسعر أقل — قولّي اسمه وأنا أدورلك.' : '- The same perfume in a smaller size when there is one, or a close style for less — tell me its name and I will look.'),
    ar ? '- لو هتاخد كمية كبيرة، عرض سعر الجملة من «مساعد شام للخدمات» هو الطريق الصح.' : '- For a large quantity, the wholesale quote in the Sham services assistant is the right road.',
    ar ? '- سعر المل في الحجم الكبير غالباً أوفر على المدى الطويل.' : '- The price per ml of a large bottle is usually better value in the long run.',
    '', ar ? `إيه اللي يهم${r.formal ? ' حضرتك' : 'ك'} أكتر: الميزانية برقم معيّن، ولا عطر بعينه؟ قولّي وأنا أجيبلك أحسن حاجة على قدّها.` : 'What matters most to you: a budget figure, or one particular perfume? Tell me and I will find the best within it.'].join('\n');
}

function praiseReply(r: SocialReading, lang: Lang): string {
  const ar = lang === 'ar';
  return [ar ? `كلامك فرّحنا جداً، شكراً${r.formal ? ' لحضرتك' : ''} إنك رجعت تقول رأيك 🌹` : 'Your words made our day — thank you for coming back to tell us 🌹',
    ar ? 'لو حابب، اكتب تقييمك في صفحة المنتج — كلمتين منك بيساعدوا غيرك يختار صح، والفريق بيقرا كل تقييم.' : 'If you like, leave a review on the product page — a few words from you help others choose well, and the team reads every review.',
    ar ? 'وأنا موجود في أي وقت لو احتجت رأي في عطر جديد أو هدية.' : 'And I am here any time you want an opinion on a new perfume or a gift.'].join('\n');
}

function loyalReply(r: SocialReading, lang: Lang): string {
  const ar = lang === 'ar';
  return [ar ? `نورتنا تاني${r.formal ? ' يا فندم' : ''} — رجوعك لينا أحسن شهادة نفتخر بيها.` : 'Welcome back — your return is the best praise we could get.',
    ar ? 'قولّي العطر اللي خدته المرة اللي فاتت وعجبك فيه إيه، وأنا أرشحلك حاجة على نفس الذوق أو تكمّله.' : 'Tell me the perfume you took last time and what you liked about it, and I will suggest something in the same taste or that completes it.'].join('\n');
}

function condolenceReply(r: SocialReading, lang: Lang): string {
  const ar = lang === 'ar';
  return [ar ? 'البقاء لله، وربنا يرحمه ويصبّركم.' : 'My sincere condolences — may they rest in peace, and may you find strength.',
    ar ? 'لو بتسأل عن ريحة للبيت ولاستقبال المعزّين، الأنسب حاجة هادية ونظيفة زي المسك أو العود الخفيف أو البخور الهادي — مش ريحة تقيلة أو حلوة أوي.' : 'If you are asking about a scent for the home while receiving visitors, something calm and clean suits best — musk, a light oud or gentle incense — nothing heavy or very sweet.',
    ar ? 'ولو احتجت أي حاجة بعد كده أنا موجود.' : 'And if you need anything later, I am here.'].join('\n');
}

/** In mourning, when he asks for incense or a scent for the house himself: calm advice, still no selling. */
function condolenceAskReply(lang: Lang): string {
  const ar = lang === 'ar';
  return [ar ? 'ربنا يرحمه ويجعلها آخر الأحزان.' : 'May they rest in peace.',
    '', ar ? '**للبيت أيام العزا، الأنسب:**' : '**For the house during the mourning days:**',
    ar ? '- بخور خفيف وهادي: عود مبخّر خفيف أو لبان دكر/مستكة — بيدّي سكينة من غير ما يتقل على الضيوف.' : '- Light, calm incense: a soft bakhoor oud or frankincense — it brings calm without weighing on guests.',
    ar ? '- بخّر قبل وصول المعزّين بشوية مش والمكان مليان، ومع تهوية كويسة عشان كبار السن ومرضى الحساسية والصدر.' : '- Burn it a little before visitors arrive, not when the room is full, with good ventilation for elders and anyone with allergies or asthma.',
    ar ? '- ولو حابب بديل من غير دخان: معطّر مسك أبيض أو ورد خفيف في المدخل.' : '- For a smoke-free option: a white-musk or light-rose room scent at the entrance.',
    '', ar ? 'ولو حابب أطلعلك المتاح في المتجر بالمواصفات دي، قولّي — من غير أي استعجال.' : 'If you would like me to show what the store has like this, just say so — no rush at all.'].join('\n');
}

function newbornReply(r: SocialReading, lang: Lang): string {
  const ar = lang === 'ar';
  return [ar ? 'مبروك وربنا يبارك فيه/فيها 🤍' : 'Congratulations, and many blessings 🤍',
    ar ? 'نصيحة مهمة الأول: المولود مايتحطلوش عطر ولا يتبخّ جنبه — بشرته حساسة جداً.' : 'One important tip first: no perfume on a newborn or sprayed near the baby — the skin is very sensitive.',
    ar ? 'الهدية الأحلى في السبوع تبقى للأم: ريحة ناعمة ونظيفة (مسك أبيض أو زهور خفيفة) تحسسها بالدلع، وتستخدمها بعيد عن البيبي.' : 'The loveliest gift is for the mother: a soft, clean scent (white musk or light florals) that pampers her, worn away from the baby.',
    ar ? 'تحب أرشحلك من المتجر حاجة بالشكل ده؟ قولّي ميزانيتك.' : 'Shall I suggest something like that from the store? Tell me your budget.'].join('\n');
}

const ETIQUETTE_TIPS: Record<NonNullable<SocialReading['recipient']>, { ar: string; en: string }> = {
  boss: { ar: 'للمدير ينفع، بشرط تبقى هدية محترمة ومش شخصية أوي: طقم هدايا أو عطر بطابع خشبي أو عود هادي، وفي حدود معقولة مش مبالغ فيها — وأحسن تكون من الفريق كله لو في الشغل.', en: 'For a boss it is fine if respectful and not too personal: a gift set or a woody or calm oud scent, at a sensible price — ideally from the whole team.' },
  colleague: { ar: 'للزميل الأضمن ريحة محبوبة عند الأغلب (مسك نظيف أو خشبي خفيف)، وسعر متوسط عشان مايتحرجش.', en: 'For a colleague, a crowd-pleaser (clean musk or light woods) at a moderate price so no one feels awkward.' },
  teacher: { ar: 'للمدرس أو الأستاذ هدية تقدير بسيطة وراقية: مسك أو عود خفيف، ومعاها كلمة شكر مكتوبة.', en: 'For a teacher, a simple, refined thank-you: musk or light oud, with a written note of thanks.' },
  in_law: { ar: 'لأهل الزوج أو الزوجة الأضمن الكلاسيكي المحترم: عود أو مسك أو ورد، وطقم في علبته بيبان أشيك.', en: 'For in-laws, a respectful classic: oud, musk or rose — a boxed set looks most gracious.' },
  mother: { ar: 'للوالدة الريحة المألوفة بتفرّح أكتر من الجريئة: ورد أو مسك أو عود ناعم.', en: 'For a mother, a familiar scent delights more than a bold one: rose, musk or soft oud.' },
  father: { ar: 'للوالد الكلاسيكي الدافي: عود أو عنبر أو خشبي.', en: 'For a father, a warm classic: oud, amber or woods.' },
  partner: { ar: 'للشريك الهدية الرومانسية بتفرق: افتكر الريحة اللي بيحبها أو اللي لابسها دلوقتي، والأضمن طابع قريب منها.', en: 'For a partner a romantic gift: recall the scent they love or wear now — something close to it is safest.' },
  friend: { ar: 'للصاحب حاجة تشبه شخصيته: المرح ليه المنعش والفاكهي، والهادي ليه المسك والخشبي.', en: 'For a friend, something like their personality: fresh or fruity for the lively, musk or woods for the calm.' },
};

function etiquetteReply(r: SocialReading, lang: Lang): string {
  const ar = lang === 'ar';
  const tip = ETIQUETTE_TIPS[r.recipient!][lang];
  const occasion = r.occasion === 'ramadan' ? (ar ? 'وفي رمضان الأنسب ريحة هادية تنفع للتجمعات والصلاة، والعطور الزيتية من غير كحول اختيار حلو لمين بيفضّلها.' : 'In Ramadan a calm scent suits gatherings and prayer; alcohol-free oil perfumes are a nice choice for those who prefer them.')
    : r.occasion === 'eid' ? (ar ? 'وفي العيد أطقم الهدايا بتبان مبهجة وجاهزة.' : 'For Eid, gift sets look festive and ready.')
      : r.occasion === 'mothers_day' ? (ar ? 'وفي عيد الأم كلمة مكتوبة جنب الهدية بتفرق جداً.' : 'On Mother’s Day a handwritten note beside the gift means a lot.') : '';
  return [tip, ...(occasion ? [occasion] : []), '', ar ? 'تحب أرشحلك من المتجر حاجة بالمواصفات دي؟ قولّي الميزانية.' : 'Shall I suggest something like that from the store? Tell me the budget.'].join('\n');
}

export interface RelationsAnswer { reply: string; situation: Situation; reading: SocialReading }

/**
 * His turn when the message is one of these situations: a complaint, anger, wholesale, corporate gifts, a discount
 * request, thanks, a returning customer, a condolence, a newborn gift, gift etiquette. Otherwise undefined.
 */
export function relationsAnswer(ctx: Context, language: string): RelationsAnswer | undefined {
  // The visitor's own last words (a follow-up's context text carries the question before it).
  const asked = (ctx.said?.length ? ctx.said[ctx.said.length - 1] : ctx.text).trim();
  if (!asked || asked.length > 600) return undefined;
  const said = (ctx.said || []).slice(0, -1);
  const reading = readSituation(asked, said);
  const { situation } = reading;
  if (!situation) return undefined;
  const lang = langOf(language, asked);
  // What he said before (the same situation again is answered further, never with the same template twice).
  const before = said.slice(-3).map((s) => readSituation(s).situation);
  const shown = PRODUCT_LINK.test(ctx.lastReply || '') || PRODUCT_LINK.test(ctx.shownReply || '');
  let reply: string;
  if (situation === 'tracking') reply = trackingReply(reading, lang, before.includes('tracking'));
  else if (COMPLAINTS.includes(situation)) reply = complaintReply(reading, lang);
  else if (situation === 'wholesale' || situation === 'corporate') {
    const details = orderDetails(asked);
    const again = before.includes('wholesale') || before.includes('corporate');
    reply = again && (details.qty || details.item) ? quoteFollowUp(lang, situation === 'corporate' || before.includes('corporate'), details) : wholesaleReply(reading, lang, situation === 'corporate');
  }
  else if (situation === 'price_match') reply = priceMatchReply(reading, lang, shown);
  else if (situation === 'discount') reply = discountReply(reading, lang, shown);
  else if (situation === 'condolence' && before.includes('condolence')) reply = condolenceAskReply(lang);
  else if (situation === 'praise') reply = praiseReply(reading, lang);
  else if (situation === 'loyal') reply = loyalReply(reading, lang);
  else if (situation === 'condolence') reply = condolenceReply(reading, lang);
  else if (situation === 'newborn') reply = newbornReply(reading, lang);
  else reply = etiquetteReply(reading, lang);
  return { reply, situation, reading };
}

// ── 4. The training ─────────────────────────────────────────────────────────────────────────────────────────────
/** A real-world case, what he must recognise, and what a good reply must (and must not) contain. */
export interface Drill { say: string; lang: Lang; situation: Situation; must: RegExp[]; mustNot?: RegExp[]; anger?: number; formal?: boolean }

export const RELATIONS_DRILLS: readonly Drill[] = [
  { say: 'طلبي اتأخر بقالي أسبوع ومحدش بيرد', lang: 'ar', situation: 'late', must: [/آسف/, /SH-/, /مساعد شام/], mustNot: [/هيوصلك بكرة/] },
  { say: 'فين طلبي SH-48213؟ بقالي 10 أيام', lang: 'ar', situation: 'late', must: [/SH-48213/, /التتبع/] },
  { say: 'انتو نصابين!!! الطلب ماوصلش وفلوسي راحت', lang: 'ar', situation: 'late', anger: 3, must: [/حقك|متضايق/, /آسف/], mustNot: [/بأدب|ألفاظك/] },
  { say: 'الزجاجة وصلت مكسورة والعطر مدلوق في الكرتونة', lang: 'ar', situation: 'damaged', must: [/صوّر/, /تستبدله أو تسترد/] },
  { say: 'البخاخ بايظ مش بيبخ خالص', lang: 'ar', situation: 'damaged', must: [/صوّر/] },
  { say: 'بعتولي غلط، ده مش اللي طلبته', lang: 'ar', situation: 'wrong_item', must: [/من غير ما تفتحه/, /الاستبدال/] },
  { say: 'العطر ده مضروب مش أصلي، ريحته مش زي اللي عندي', lang: 'ar', situation: 'scent_doubt', must: [/بناخدها بجد/, /الكود/], mustNot: [/مستحيل/, /ده مش صحيح/] },
  { say: 'ثباته وحش خالص بيطير بعد ساعة', lang: 'ar', situation: 'scent_doubt', must: [/البشرة والجو/] },
  { say: 'عايز ارجع الطلب واسترد فلوسي', lang: 'ar', situation: 'refund', must: [/14 يوم/, /الإرجاع والاسترداد/] },
  { say: 'لو سمحت حضرتك عايز الغي الطلب', lang: 'ar', situation: 'refund', formal: true, must: [/الإلغاء/] },
  { say: 'أسوأ تجربة شراء في حياتي، مش هتعامل معاكم تاني', lang: 'ar', situation: 'angry', anger: 3, must: [/آسف/, /مش عشان أجادل/] },
  { say: 'عايز أسعار الجملة، عندي محل عطور', lang: 'ar', situation: 'wholesale', must: [/عرض سعر جملة/, /الكمية/], mustNot: [/\d+ ?%/] },
  { say: 'محتاج 50 زجاجة من عطر واحد', lang: 'ar', situation: 'wholesale', must: [/عرض/] },
  { say: 'عايزين هدايا موظفين لـ 120 موظف آخر السنة', lang: 'ar', situation: 'corporate', must: [/الميزانية التقريبية للفرد/, /عرض سعر جملة/] },
  { say: 'فيه خصم لو اشتريت النهاردة؟', lang: 'ar', situation: 'discount', must: [/صفحة الدفع/, /حجم أصغر/], mustNot: [/هعملك خصم/] },
  { say: 'آخر سعر كام؟ نزّل السعر شوية', lang: 'ar', situation: 'discount', must: [/مفيش خصومات بتتقال في الشات/] },
  { say: 'الطلب وصل وحلو جداً تسلم ايدكم', lang: 'ar', situation: 'praise', must: [/تقييمك/], mustNot: [/\/p\//] },
  { say: 'أنا زبون قديم اشتريت منكم قبل كده', lang: 'ar', situation: 'loyal', must: [/نورتنا/] },
  { say: 'عايز عطر للبيت عشان العزاء، المرحوم كان بيحب المسك', lang: 'ar', situation: 'condolence', must: [/البقاء لله/], mustNot: [/هاخده|شراء مباشر|\/p\//] },
  { say: 'عايز أجيب عطر هدية لمولود في السبوع', lang: 'ar', situation: 'newborn', must: [/مايتحطلوش عطر/, /للأم/] },
  { say: 'ينفع أهادي مديري بعطر؟', lang: 'ar', situation: 'etiquette', must: [/محترمة/] },
  { say: 'إيه الهدية المناسبة لحماتي في رمضان؟', lang: 'ar', situation: 'etiquette', must: [/الكلاسيكي/, /رمضان/] },
  { say: 'فين طلبي؟', lang: 'ar', situation: 'tracking', must: [/SH-/, /التتبع/], mustNot: [/آسف|نعتذر|بعتذر/] },
  { say: 'الأوردر وصل ناقص منه زجاجة', lang: 'ar', situation: 'missing', must: [/صوّر/, /الناقص/], mustNot: [/من غير ما تفتحه/] },
  { say: 'العطر ده عندكم أغلى من محل تاني', lang: 'ar', situation: 'price_match', must: [/نفس الحجم/, /صفحة الدفع/], mustNot: [/هعملك خصم|هنطابق/] },
  { say: 'عايز أرجع الطلب لسه متفتحش', lang: 'ar', situation: 'refund', must: [/14 يوم/], mustNot: [/آسف/] },
  { say: 'محتاج 10 هدايا لزمايلي في الشغل', lang: 'ar', situation: 'corporate', must: [/10 هدايا/, /عرض سعر جملة/] },
  { say: 'ينفع أهاديه بعطر؟ ده مديري', lang: 'ar', situation: 'etiquette', must: [/محترمة/] },
  { say: 'My order is late and nobody replies', lang: 'en', situation: 'late', must: [/sorry/i, /SH-/] },
  { say: 'The bottle arrived broken', lang: 'en', situation: 'damaged', must: [/Photograph/] },
  { say: 'This is fake, it smells different', lang: 'en', situation: 'scent_doubt', must: [/seriously/], mustNot: [/impossible/i] },
  { say: 'Do you sell wholesale? I have a shop', lang: 'en', situation: 'wholesale', must: [/wholesale quote/] },
  { say: 'Any discount code?', lang: 'en', situation: 'discount', must: [/payment page/] },
  { say: 'You are scammers, worst shop ever', lang: 'en', situation: 'angry', anger: 3, must: [/sorry/i], mustNot: [/watch your/i] },
  { say: 'Where is my order?', lang: 'en', situation: 'tracking', must: [/SH-/], mustNot: [/sorry/i] },
  { say: 'One item is missing from my order', lang: 'en', situation: 'missing', must: [/Photograph/, /missing item/] },
  { say: 'I found it cheaper at another shop', lang: 'en', situation: 'price_match', must: [/same size/, /payment page/] },
];

export interface DrillResult { say: string; passed: boolean; problems: string[] }

/** Runs every training case through his replies and grades them (the State's patrol and the tests use it). */
export function runDrills(drills: readonly Drill[] = RELATIONS_DRILLS): { score: number; results: DrillResult[] } {
  const results = drills.map((d): DrillResult => {
    const a = relationsAnswer({ text: d.say, followUp: false, said: [d.say] }, d.lang);
    const problems: string[] = [];
    if (!a) problems.push('no reply');
    else {
      if (a.situation !== d.situation) problems.push(`read as ${a.situation}`);
      for (const re of d.must) if (!re.test(a.reply)) problems.push(`missing ${re}`);
      for (const re of d.mustNot || []) if (re.test(a.reply)) problems.push(`contains ${re}`);
      if (d.anger !== undefined && a.reading.anger < d.anger) problems.push(`anger ${a.reading.anger}`);
      if (d.formal && !a.reading.formal) problems.push('formality missed');
      problems.push(...relationsLint(a.reply, a.situation, d.lang).map((p) => `pitfall ${p}`));
    }
    return { say: d.say, passed: !problems.length, problems };
  });
  return { score: Math.round((results.filter((r) => r.passed).length / Math.max(1, results.length)) * 100), results };
}
