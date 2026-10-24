/**
 * «منهج إدارة المبيعات» — the sales manager's own course, built from the platform's book and its selling craft.
 *
 * Two sources, never invented:
 *  - «كتيب روبوتات شام» (SHAHEEN_HANDBOOK.md, src/utils/botHandbook.ts): every lesson names the handbook
 *    sections it comes from, and the lesson's facts (pricing ×1.5, margin secrecy, direct collection,
 *    confirmation only after the money is seen, no fake numbers or urgency) are the platform's own rules.
 *  - «علم البيع» (src/utils/salesCraft.ts): the principles that sell and the pitfalls that kill a sale,
 *    each from known sales research — the lesson links to the principle ids so the desk and the exams agree.
 *
 * The robot («مدير المبيعات») studies one lesson a day in a fixed rotation, answers its question, and the
 * result is written to its report. Study is honest: a lesson not studied is not a lesson passed.
 */
import { BOTS } from '../utils/shaheenOrg';
import { SALES_PITFALLS, SALES_PRINCIPLES } from '../utils/salesCraft';

export type LessonModule = 'platform' | 'craft' | 'growth' | 'ethics';

export const MODULE_LABEL: Record<LessonModule, { ar: string; en: string }> = {
  platform: { ar: 'كتيب المنصة', en: 'Platform handbook' },
  craft: { ar: 'فن البيع', en: 'Selling craft' },
  growth: { ar: 'النمو والقياس', en: 'Growth & measurement' },
  ethics: { ar: 'الأمانة والخصوصية', en: 'Honesty & privacy' },
};

export interface LessonQuiz {
  qAr: string;
  qEn: string;
  optionsAr: string[];
  optionsEn: string[];
  /** Index into options. */
  correct: number;
  whyAr: string;
}

export interface SalesLesson {
  id: string;
  module: LessonModule;
  titleAr: string;
  titleEn: string;
  /** Handbook sections this lesson is built from (src/utils/botHandbook.ts ids). */
  handbook: string[];
  /** Selling-craft principles this lesson teaches (src/utils/salesCraft.ts ids). */
  principles: string[];
  ideaAr: string;
  ideaEn: string;
  drillAr: string;
  drillEn: string;
  quiz: LessonQuiz;
}

export const SALES_LESSONS: SalesLesson[] = [
  {
    id: 'platform-owner', module: 'platform', titleAr: 'صاحب الموقع فوق الكل — والقرار الكبير بيستنى موافقته', titleEn: 'The owner is above everything — a big decision waits for him',
    handbook: ['owner'], principles: [],
    ideaAr: 'صاحب الموقع هو الوحيد اللي بيوافق على التغيير الكبير والخصومات وقرارات الشراكة. مدير المبيعات بيعرض ويقترح، ومش بيفتح باب وعد مش معتمد — ولا بيستخدم اسمه في الكلام مع عميل.',
    ideaEn: 'Only the owner approves a big change, a discount or a partnership. The sales manager proposes; he never makes an unapproved promise and never speaks in the owner’s name to a customer.',
    drillAr: 'افتح SHAHEEN_ORG.md واقرأ مهام صاحب الموقع، واكتب جملة واحدة تقولها لعميل يطلب خصم كبير من غير ما توعد بحاجة.',
    drillEn: 'Read the owner’s duties in SHAHEEN_ORG.md and write one sentence for a customer asking for a big discount without promising anything.',
    quiz: { qAr: 'عميل جملة طلب خصم ٢٠٪ على أول طلب. تعمل إيه؟', qEn: 'A wholesale customer asks for 20 % off the first order. What do you do?',
      optionsAr: ['أقوله اتخصم خلاص', 'أرفع الطلب لصاحب الموقع وأقول للعميل بصراحة إن القرار عنده', 'أوعد بخصم وأسجله بعدين'],
      optionsEn: ['Tell him it is already approved', 'Take it to the owner and tell the customer honestly that the decision is his', 'Promise the discount and record it later'], correct: 1,
      whyAr: 'الخصم قرار صاحب الموقع، والوعد بغير اعتماد بيكسر ثقة العميل والمنصة.' },
  },
  {
    id: 'platform-identity', module: 'platform', titleAr: 'مين إحنا: تعليم عطور + معمل + متجر — والزائر عمره ما يشوف اسم مزوّد ذكاء اصطناعي', titleEn: 'Who we are: perfume education, a lab and a store — never an AI vendor’s name',
    handbook: ['identity', 'tools'], principles: ['real_proof'],
    ideaAr: 'المنصة بتعلّم وتصمّم وتبيع. في البيع بنستخدم أدوات الموقع الحقيقية (حاسبة التركيز، الهرم العطري، المواد الخام، «اسأل شاهين») كدليل مجاني بيبني الثقة قبل الطلب. ولا مرة نقول للعميل إن الرد من تطبيق ذكاء اصطناعي بالاسم — الرد من «الخبير شاهين»، ومكتوب عليه إنه مولد بالذكاء الاصطناعي (L-06).',
    ideaEn: 'The platform teaches, formulates and sells. In a sale we point to real site tools as free proof that builds trust before ordering, and never name an AI vendor — the answer is «الخبير شاهين»’s, disclosed as AI-generated (L-06).',
    drillAr: 'اختار منتج حقيقي من المتجر واكتب جملتين تربط فيه بين المنتج وأداة مجانية في الموقع (حاسبة أو الهرم) — من غير أي رقم متخمن.',
    drillEn: 'Pick a real store product and write two lines that connect it to a free site tool — with no invented number.',
    quiz: { qAr: 'إيه الدليل الحقيقي اللي ينفع تقوله للعميل؟', qEn: 'Which proof may you really use with a customer?',
      optionsAr: ['«الكل بيشتريه»', 'تركيز العطر والحجم وسعر المل وتقييمات منشورة', '«الأكثر مبيعاً» من غير بيانات'],
      optionsEn: ['“Everyone buys it”', 'Concentration, size, price per ml and published ratings', '“Best seller” without data'], correct: 1,
      whyAr: 'الدليل الحقيقي بيانات المنصة والماركة والتقييم — «الكل بيشتريه» فخ بيفقد المصداقية.' },
  },
  {
    id: 'platform-policies', module: 'platform', titleAr: 'السياسات الملزمة: مفيش تزييف ولا استعجال مزيف ولا بيانات تواصل في المبيعات', titleEn: 'Binding policies: no fake figures, no fake urgency, no contact details in sales',
    handbook: ['policies', 'onboarding'], principles: [],
    ideaAr: 'ممنوع أي رقم متخمن أو نتيجة وهمية، وممنوع «فاضل قطعتين» و«العرض بينتهي النهاردة» لو مش حقيقي. ممنوع تطلب أو تحفظ كلمة سر أو رقم بطاقة. بيانات العميل (تليفون وإيميل وعنوان) مكانها حسابه وطلبه — الفرصة في المكتب ليها اسم مختصر بس. وأي رقم جديد في المنصة لازم مصدره يكون مسجّل، مش تخمين.',
    ideaEn: 'No invented figure, no fake scarcity or expiry, no passwords or card numbers, and no contact details in the sales desk — a deal carries a short label only. Every new platform number must have a registered source, never a guess.',
    drillAr: 'افتح سياسة واحدة من الكتيب واكتب سؤالين بتسألهم لنفسك قبل أي عرض سعر.',
    drillEn: 'Open one handbook policy and write two questions to ask yourself before any quote.',
    quiz: { qAr: 'إيه اللي ممنوع يتكتب في فرصة مبيعات؟', qEn: 'What must never be written in a sales opportunity?',
      optionsAr: ['اسم المنتج والسعر', 'رقم تليفون العميل وعنوانه', 'تاريخ المتابعة الجاية'],
      optionsEn: ['The product and price', 'The customer’s phone and address', 'The next follow-up date'], correct: 1,
      whyAr: 'بيانات التواصل بتفضل في حساب العميل وطلبه، والمكتب بيشتغل بأسماء مختصرة بس.' },
  },
  {
    id: 'platform-pricing', module: 'platform', titleAr: 'التسعير: ×1.5 وتقريب، والهامش مايتقالش للمورد', titleEn: 'Pricing: ×1.5 and rounding — the margin never leaves the store',
    handbook: ['pricing'], principles: ['value'],
    ideaAr: 'سعر البيع = (سعر المورد + شحن وتجهيز ثابت) × 1.5 ويتقرب لأعلى لأقرب ٥ جنيه. الزائر يشوف سعر بلده وعملته ومعه الشحن. الهامش وسعر المورد للإدارة بس، وممنوع يتقال للمورد أو للعميل، وممنوع وعد بخصم مش موجود في صفحة الدفع. لما العميل يقول «غالي» بنشرح القيمة (سعر المل والبخة) ونعرض الأوفر لو موجود، بدون جدال.',
    ideaEn: 'Selling price = (supplier price + fixed packing/shipping) × 1.5, rounded up to the next 5. Margin and supplier price stay with the owner and are never disclosed; no discount that checkout does not have. On “too expensive”, show value per ml and a cheaper road, never argue.',
    drillAr: 'خد منتج بسعر مورد ٤٠٠ جنيه + ٢٥ شحن، احسب السعر بقاعدة المتجر بالورقة، وبعدين اكتب جملة قيمة من غير ما تذكر الهامش.',
    drillEn: 'Take a product at 400 EGP supplier cost + 25 shipping, compute the store price on paper, then write a value line without mentioning margin.',
    quiz: { qAr: 'منتج سعر مورده ٤٠٠ + ٢٥ شحن. السعر بقاعدة المتجر؟', qEn: 'Supplier 400 + 25 shipping. The store price?',
      optionsAr: ['٦٣٥ جنيه', '٦٤٠ جنيه (بعد التقريب لأعلى ٥)', '٧٠٠ جنيه'],
      optionsEn: ['635 EGP', '640 EGP (rounded up to 5)', '700 EGP'], correct: 1,
      whyAr: '(٤٠٠ + ٢٥) × ١.٥ = ٦٣٧.٥، وبعد التقريب لأعلى لأقرب ٥ = ٦٤٠ جنيه.' },
  },
  {
    id: 'platform-money', module: 'platform', titleAr: 'بنك شام: البيع مايتسجلش غير لما تشوف الفلوس', titleEn: 'Sham Bank: a sale is booked only after you see the money',
    handbook: ['money'], principles: [],
    ideaAr: 'التحصيل مباشر: إنستاباي، تحويل بنكي، محفظة، أو دفع عند الاستلام. العميل يحجز، يحوّل من تطبيق بنكه، ويبلّغ برقم العملية؛ وصاحب المتجر يؤكد بعد ما يشوف المبلغ نفسه (أو يطابق كشف حساب). التأكيد من غير رؤية المبلغ ممنوع، والنظام عمره ما بيحرك فلوس ولا بيحفظ بطاقات. طابور «مستني تأكيدك» أول حاجة في إيقاع اليوم.',
    ideaEn: 'Collection is direct: InstaPay, bank transfer, wallet or cash on delivery. The buyer reserves, pays from his bank app and reports the reference; the owner confirms after seeing the money (or matching a statement). No confirmation without seeing it; the system never moves money or stores cards.',
    drillAr: 'اكتب رسالة واحدة بتشرح للعميل خطوات التحويل بالترتيب، ورسالة تانية للتأكيد بعد وصول الفلوس — بدون طلب أي بيانات سرية.',
    drillEn: 'Write one message explaining the transfer steps in order, and one confirming after the money arrives — without asking for secrets.',
    quiz: { qAr: 'عميل قال «حوّلت» ومفيش المبلغ في حسابك. تعمل إيه؟', qEn: 'A buyer says “I sent it” but the money is not in your account. What do you do?',
      optionsAr: ['أأكد الطلب وأبعت البضاعة', 'أطلب منه رقم العملية وأراجع حسابي/الكشف، وما أأكدش غير لما أشوف المبلغ', 'ألغي الطلب على طول وأبلوكه'],
      optionsEn: ['Confirm the order and ship', 'Ask for the transfer reference, check my account/statement and confirm only after seeing the money', 'Cancel and block him at once'], correct: 1,
      whyAr: 'التأكيد قبل رؤية الفلوس بيع خسارة، والرفض الفوري مش من الأمانة — راجع الأول.' },
  },
  {
    id: 'platform-rhythm', module: 'platform', titleAr: 'إيقاع اليوم: فلوس ← متابعة ← فجوة الهدف ← درس', titleEn: 'The daily rhythm: money → follow-ups → target gap → lesson',
    handbook: ['work'], principles: [],
    ideaAr: 'الروبوتات بتشتغل بالتقارير والأرقام الحقيقية مش بالكلام. إيقاع المبيعات يومي: (١) تأكيد التحويلات اللي مستنية عينك، (٢) متابعات الفرص المتأخرة، (٣) الفجوة للهدف الشهري، (٤) مراجعة مخزون الأكثر مبيعاً، (٥) درس اليوم. كل مهمة معاها مكان تنفيذها، ومفيش مهمة من غير سبب من رقم حقيقي.',
    ideaEn: 'Robots work from reports and real numbers. The sales rhythm: confirm waiting transfers, follow up late deals, close the target gap, check best-seller stock, then the daily lesson. Every task names where to do it and the real figure behind it.',
    drillAr: 'رتّب ٥ مهام لليوم بترتيب الأهمية، واكتب تحت كل واحدة الرقم اللي خلاها تيجي في الترتيب ده.',
    drillEn: 'Order five tasks for today and write under each the real figure that put it there.',
    quiz: { qAr: 'إيه أول حاجة في إيقاع اليوم؟', qEn: 'What comes first in the daily rhythm?',
      optionsAr: ['تصميم بوست جديد', 'تأكيد التحويلات اللي مستنية عينك في بنك شام', 'مراجعة خطة الشهر الجاي'],
      optionsEn: ['Designing a new post', 'Confirming waiting transfers in Sham Bank', 'Reviewing next month’s plan'], correct: 1,
      whyAr: 'الفلوس المستنية تأكيد بتوقف طلبات حقيقية — بتتعمل الأول.' },
  },
  {
    id: 'craft-buyer', module: 'craft', titleAr: 'اقرأ الزبون قبل ما تكلّمه', titleEn: 'Read the buyer before you speak',
    handbook: ['identity'], principles: ['mirror'],
    ideaAr: 'أربع طباع: المستعجل (عايز السعر والترشيح في سطرين)، المحلل (أرقام وتركيز وثبات وسعر المل)، المتحمس (إحساس وحضور وتميز)، والحذر (ضمان، إرجاع المختوم، تجارب حقيقية). في المكتب بنقرأ الكلام اللي العميل قاله فعلاً — مش بنحطّه في قالب. ولو مفيش إشارة، الافتراضي دافي وقصير بسؤال واحد.',
    ideaEn: 'Four styles: hurried (price and one pick, two lines), analytical (numbers, concentration, price per ml), expressive (feeling, presence, standing out), cautious (guarantee, sealed returns, real reviews). In the desk we read the buyer’s actual words — no forced label; with no signal, warm and short with one question.',
    drillAr: 'خد آخر ٣ محادثات حقيقية وحدّد لكل واحدة الطبع والمرحلة (بيدور/بيقارن/جاهز/معترض) والدليل من كلامه.',
    drillEn: 'Take the last three real conversations and mark each buyer’s style, stage and the words that show it.',
    quiz: { qAr: 'عميل قال: «الفرق بين الاتنين إيه؟ التركيز والثبات كام ساعة؟» — ده مين؟', qEn: '“What’s the difference? Concentration and how many hours?” — who is this?',
      optionsAr: ['المستعجل', 'المحلل', 'المتحمس'],
      optionsEn: ['The hurried buyer', 'The analytical buyer', 'The expressive buyer'], correct: 1,
      whyAr: 'أسئلة الفرق والتركيز والثبات هي لغة المحلل: أرقام وأسباب.' },
  },
  {
    id: 'craft-needs', module: 'craft', titleAr: 'الاحتياج الأول: سؤال واحد ذكي أهم من عشر مواصفات', titleEn: 'Needs first: one smart question beats ten specs',
    handbook: ['identity'], principles: ['needs_first'],
    ideaAr: 'قبل الترشيح: لمين؟ لإمتى؟ إيه الإحساس اللي عايزه؟ الحرارة والمناسبة والميزانية. الجواب بيحدد العطر والبديل والسعر. السؤال مش استجواب — سؤال واحد في الرسالة، وبعدها ترشيح واضح.',
    ideaEn: 'Before recommending: for whom, by when, what feeling, the occasion, the budget. One question per message, then a clear pick.',
    drillAr: 'اكتب سؤال احتياج واحد لكل نوع: هدية، عطر يومي، مناسبة، حد بيسأل على الأوفر.',
    drillEn: 'Write one needs question for each: a gift, a daily scent, an occasion, a value seeker.',
    quiz: { qAr: 'أهم حاجة تبدأ بيها مع عميل جديد؟', qEn: 'What should you start with for a new buyer?',
      optionsAr: ['قائمة ٦ عطور', 'سؤال واحد عن الاحتياج والمناسبة', 'خصم فوري'],
      optionsEn: ['A list of six perfumes', 'One question about the need and the occasion', 'An instant discount'], correct: 1,
      whyAr: 'الاحتياج بيقلل الاختيارات ويخلي الترشيح مقنع.' },
  },
  {
    id: 'craft-story', module: 'craft', titleAr: 'احكي الريحة كتجربة وحوّل كل ميزة لفايدة', titleEn: 'Tell the scent as an experience, turn features into benefits',
    handbook: ['tools'], principles: ['sensory', 'benefit'],
    ideaAr: '«تركيز إكستريه» ← «بخّتين الصبح يكفوك لحد بالليل». احكي: أول بخة، بعد نص ساعة، واللي بيفضل على الهدوم. استخدم الهرم العطري وأسماء النوتات بالعربي من غير كلام تقني جوه رد عربي.',
    ideaEn: '“Extrait concentration” → “two sprays carry you to the evening”. Tell the first spray, half an hour later, what stays on clothes. Use the pyramid and Arabic note names — no English jargon inside an Arabic reply.',
    drillAr: 'خد ٣ منتجات حقيقية واحكي كل واحد في ٣ سطور تجربة — بدون نسخ وصف المتجر حرفياً.',
    drillEn: 'Take three real products and tell each as a three-line experience — without copying the store description.',
    quiz: { qAr: 'إيه أحسن صياغة لميزة «تركيز إكستريه»؟', qEn: 'Best framing of “extrait concentration”?',
      optionsAr: ['«إكستريه ٣٠٪»', '«بخّتين الصبح بيفضلوا معاك لحد بالليل»', '«أقوى من كل الماركات»'],
      optionsEn: ['“Extrait 30 %”', '“Two sprays in the morning stay with you until evening”', '“Stronger than every brand”'], correct: 1,
      whyAr: 'الفايدة اللي العميل يحسها أقوى من المصطلح، والمقارنة بالماركات التانية ممنوعة.' },
  },
  {
    id: 'craft-objections', module: 'craft', titleAr: 'الاعتراض: قيمة مش جدال، وعيب بصراحة ومعاه حل', titleEn: 'Objections: value not argument, and an honest weakness with its fix',
    handbook: ['pricing'], principles: ['value', 'honest_frame'],
    ideaAr: '«غالي»: ممنوع الجدال أو كلمة «مش غالي خالص». اعرض سعر المل والبخة، وبديل أوفر لو موجود. العيب يتقال كنصيحة ومعاه حل، مش كحكم: «خفيف وراقي — رشّه على الهدوم يعيش أطول».',
    ideaEn: 'On “expensive”: never argue or say “it’s not expensive”. Show price per ml and a cheaper alternative if it exists. A weakness is advice with its fix, not a verdict.',
    drillAr: 'اكتب ردّين على «غالي» — واحد لمنتج فاخر وواحد لمنتج اقتصادي — وصحّحهم بـ salesLint في اختبار المنصة.',
    drillEn: 'Write two replies to “expensive” — one premium, one value — and check both with salesLint.',
    quiz: { qAr: 'أحسن رد على «غالي»؟', qEn: 'Best reply to “too expensive”?',
      optionsAr: ['«ده مش غالي خالص»', '«فهمتك — سعر المل هنا كذا، وفيه البديل ده أوفر لو تحب»', '«خلاص فين المشكلة»'],
      optionsEn: ['“It’s not expensive at all”', '“Fair — here is the price per ml, and this alternative is cheaper if you prefer”', '“So what’s the problem?”'], correct: 1,
      whyAr: 'الاعتراض بيتهدّ بالقيمة والبديل، مش بالجدال.' },
  },
  {
    id: 'craft-close', module: 'craft', titleAr: 'اقفل بخطوة واحدة سهلة', titleEn: 'Close with one easy step',
    handbook: ['identity'], principles: ['soft_close', 'one_pick', 'real_proof'],
    ideaAr: 'نهاية كل محادثة فيها خطوة واحدة واضحة: «أجهزهولك؟» أو رابط المنتج وزر الشراء المباشر. ترشيح واحد وبديل واحد بس لما ليه سبب. ممنوع قايمة اختيارات طويلة أو قصر رد من غير خطوة جاية.',
    ideaEn: 'Every conversation ends with one clear step: “Shall I get it ready?”, a product link and direct buy. One pick and at most one alternative with a reason — no long menu, no reply without a next step.',
    drillAr: 'راجع آخر ٥ ردود بعتها: كل واحد فيه خطوة جاية واحدة؟ عدّل اللي ناقص.',
    drillEn: 'Review your last five replies: does each have one next step? Fix the ones that do not.',
    quiz: { qAr: 'الخطوة الجاية الصح بعد الترشيح؟', qEn: 'The right next step after a recommendation?',
      optionsAr: ['أسيب العميل يقرر لوحده', '«أجهزهولك؟» + رابط المنتج وطريقة الشراء', 'أبعت ٥ اختيارات تانية'],
      optionsEn: ['Leave him alone to decide', '“Shall I get it ready?” + the product link and how to buy', 'Send five more options'], correct: 1,
      whyAr: 'الخطوة الواحدة السهلة بتنقل الاهتمام لطلب حقيقي.' },
  },
  {
    id: 'craft-grow', module: 'craft', titleAr: 'بعد الشرا: إضافة واحدة تفيده فعلاً', titleEn: 'After the sale: one genuinely useful addition',
    handbook: ['tools'], principles: ['cross_sell', 'gift_reassure'],
    ideaAr: 'بعد الطلب اقترح حاجة واحدة أو اتنين يكمّلوا (سبراي صغير للسفر، عطر تاني بطبقات مختلفة) بسبب واضح، واختيارية. في الهدايا طمّن على الذوق والتغليف والاستبدال للمختوم في المدة القانونية. ممنوع استغلال — اقتراح واحد صادق أحسن من ضغط.',
    ideaEn: 'After the order, suggest one or two items that genuinely complete it, with a reason, optional. For gifts reassure on taste, packaging and sealed exchange. One honest suggestion beats pressure.',
    drillAr: 'اختار منتج حقيقي واكتب له إضافة واحدة بسبب حقيقي — من غير ادعاء توفير أو خصم.',
    drillEn: 'Pick a real product and write one addition with a real reason — no invented saving or discount.',
    quiz: { qAr: 'إضافة مناسبة بعد شراء طقم هدايا؟', qEn: 'A suitable addition after a gift set purchase?',
      optionsAr: ['عطر تاني غالي من غير سبب', 'سبراي سفر صغير للعطر نفسه بسبب واضح', 'أي حاجة لمجرد زيادة الفاتورة'],
      optionsEn: ['Another expensive perfume with no reason', 'A small travel spray of the same scent with a clear reason', 'Anything at all to raise the invoice'], correct: 1,
      whyAr: 'الإضافة ليها سبب يخص العميل، وإلا بتبقى ضغط.' },
  },
  {
    id: 'growth-kpis', module: 'growth', titleAr: 'الأرقام اللي بتتحكم: فرص، تحويل، متوسط طلب، تكرار', titleEn: 'The numbers that matter: opportunities, conversion, basket, repeat',
    handbook: ['work', 'money'], principles: [],
    ideaAr: 'الفرص المفتوحة وقيمتها الموزونة بالمرحلة، نسبة الكسب = المقفول كسب ÷ كل المقفول، متوسط الطلب = التحصيل المؤكد ÷ عدد الطلبات المدفوعة، ونسبة التكرار لما يبقى عندك تاريخ. متوسط الطلب مش تقدير — من بنك شام. الفرص من غير خطوة جاية بتتحسب فجوة إدارة مش رقم مبيعات.',
    ideaEn: 'Open opportunities and their stage-weighted value; win rate = won ÷ closed; average order = confirmed collections ÷ paid orders; repeat rate once history exists. Average order comes from Sham Bank, never an estimate. Deals with no next step are a management gap, not a sales figure.',
    drillAr: 'احسب بنفسك من أرقام الشهر: متوسط الطلب، ونسبة الفلوس المؤكدة من قيمة الفرص المفتوحة.',
    drillEn: 'Work out from this month’s real figures: average order and confirmed collections vs weighted open pipeline.',
    quiz: { qAr: 'متوسط الطلب بيتحسب إزاي؟', qEn: 'How is average order value computed?',
      optionsAr: ['مجموع الفرص المفتوحة ÷ عددها', 'التحصيل المؤكد في بنك شام ÷ عدد الطلبات المدفوعة', 'سعر أغلى منتج'],
      optionsEn: ['Open pipeline ÷ count', 'Confirmed Sham Bank collections ÷ paid orders', 'The most expensive product'], correct: 1,
      whyAr: 'المتوسط من فلوس اتقبضت فعلاً، مش من أمنيات خط الأنابيب.' },
  },
  {
    id: 'growth-followup', module: 'growth', titleAr: 'المتابعة: إيقاع محترم، قيمة في كل مرة', titleEn: 'Follow-up: a respectful cadence, value every time',
    handbook: ['work'], principles: ['soft_close'],
    ideaAr: 'متابعة واحدة بعد ٢–٣ أيام، وواحدة بعد أسبوع، وبعدها سيب الباب مفتوح. كل متابعة لازم تضيف حاجة: إجابة سؤال، بديل، توضيح شحن — مش «إيه الأخبار؟». لو العميل قال «مش دلوقتي» نحترمها ونحدد تاريخ بعيد بإذنه. الضغط بيعمل العكس (نظرية الرد بالممانعة).',
    ideaEn: 'One follow-up after 2–3 days, one after a week, then leave the door open. Each one adds something: an answer, an alternative, shipping clarity — not “any news?”. Honour “not now” and agree a later date; pressure backfires.',
    drillAr: 'اكتب ٣ متابعات لمنتج حقيقي، كل واحدة فيها معلومة جديدة، وآخر واحدة فيها «لو مش مناسب دلوقتي قولّي أرجعلك إمتى».',
    drillEn: 'Write three follow-ups for a real product, each with new information, the last offering to come back whenever suits.',
    quiz: { qAr: 'متابعة صح بعد ٣ أيام؟', qEn: 'A good follow-up after three days?',
      optionsAr: ['«إيه الأخبار؟»', '«لقيت سؤال سألته على الشحن — دي المدة والتكلفة، تحب أجهز الطلب؟»', '«العرض هينتهي النهاردة»'],
      optionsEn: ['“Any news?”', '“You asked about shipping — here is the time and cost; shall I prepare the order?”', '“The offer ends today”'], correct: 1,
      whyAr: 'المتابعة بتضيف قيمة حقيقية، والاستعجال المزيف ممنوع.' },
  },
  {
    id: 'growth-review', module: 'growth', titleAr: 'مراجعة أسبوعية ٢٠ دقيقة: سبب واحد وحركة واحدة', titleEn: 'A 20-minute weekly review: one cause, one move',
    handbook: ['work', 'onboarding'], principles: [],
    ideaAr: 'كل أسبوع: افتح المكتب، بص على نسبة الكسب وأسباب الخسارة المسجلة، والفرص اللي وقفت، والأكثر مبيعاً. اختار سبب واحد تتصلح (مثلاً «مفيش متابعة بعد عرض السعر») وحركة واحدة الأسبوع الجاي. سجّل النتيجة في الأسبوع اللي بعده — من غير تحسين وهمي.',
    ideaEn: 'Weekly: open the desk, read win rate, recorded lost reasons, stalled deals and best sellers. Pick one cause (e.g. no follow-up after a quote) and one move for next week; record the result next week — no invented improvement.',
    drillAr: 'اعمل مراجعة الأسبوع ده في ٥ سطور: رقم واحد اتغير، سببه، وحركة الأسبوع الجاي.',
    drillEn: 'Do this week’s review in five lines: one number that moved, why, and next week’s move.',
    quiz: { qAr: 'مراجعة أسبوعية مفيدة فيها إيه؟', qEn: 'A useful weekly review contains what?',
      optionsAr: ['قائمة أمنيات', 'سبب واحد من أسباب الخسارة وحركة واحدة محددة', 'وعد بزيادة المبيعات ١٠٠٪'],
      optionsEn: ['A wish list', 'One real lost reason and one specific move', 'A promise to double sales'], correct: 1,
      whyAr: 'التغيير الصغير المحدد بيتقاس؛ الوعود الكبيرة بتتنسي.' },
  },
  {
    id: 'ethics-honesty', module: 'ethics', titleAr: 'الأمانة والخصوصية: مفيش ضغط، مفيش بيانات، مفيش وعد كاذب', titleEn: 'Honesty and privacy: no pressure, no personal data, no false promise',
    handbook: ['policies', 'money'], principles: [],
    ideaAr: 'قانون المنصة: تحليل الزوار للإدارة وحدها، وبيانات التواصل في حساب العميل وطلبه. في البيع: ممنوع الاستعجال المزيف، والدليل المفبرك، وخصم مش موجود، والكلام الوحش عن المنافسين، والضغط «لازم تاخده». العميل اللي قال «مش دلوقتي» بياخد احترام، واللي طلب حذف بياناته بياخد حقه.',
    ideaEn: 'Platform law: visitor analysis is the administration’s alone and contact details stay in the customer’s account and order. In selling: no fake urgency, fabricated proof, invented discounts, badmouthing competitors or “you must take it”. “Not now” is respected; a deletion request is honoured.',
    drillAr: 'راجع SALES_PITFALLS في salesCraft واكتب مثال واحد على كل فخ بترتكبه شركات بتخسر ثقة.',
    drillEn: 'Read SALES_PITFALLS and write one example of each trap that loses trust.',
    quiz: { qAr: 'عميل قال «هفكر». تعمل إيه؟', qEn: 'A buyer says “I’ll think about it”. What do you do?',
      optionsAr: ['أضغط عليه يشتري النهاردة', 'أحترم القرار، أسأله سؤال واحد عن اللي محتاج يفكر فيه، وأحدد متابعة بإذنه', 'أمسح الفرصة'],
      optionsEn: ['Pressure him to buy today', 'Respect it, ask one question about what he is weighing, and agree a follow-up with his permission', 'Delete the opportunity'], correct: 1,
      whyAr: 'الاحترام والسؤال بيفتحوا باب المتابعة؛ الضغط بيقفله.' },
  },
];

export const lessonById = (id: string) => SALES_LESSONS.find((l) => l.id === id);
export const lessonsIn = (module: LessonModule) => SALES_LESSONS.filter((l) => l.module === module);

const DAY = 86_400_000;
/** The lesson of the day: a fixed rotation from 2026-01-01, so every robot and every screen agrees. */
export function lessonOfDay(now: number, offset = 0): SalesLesson {
  const start = Date.UTC(2026, 0, 1);
  const index = Math.floor((now - start) / DAY) + offset;
  const wrapped = ((index % SALES_LESSONS.length) + SALES_LESSONS.length) % SALES_LESSONS.length;
  return SALES_LESSONS[wrapped];
}

/** The next `days` lessons, today first (no repeats inside the plan). */
export function studyPlan(now: number, days = 7): SalesLesson[] {
  return Array.from({ length: Math.max(1, Math.min(days, SALES_LESSONS.length)) }, (_, i) => lessonOfDay(now, i));
}

export interface StudyAnswer { lessonId: string; choice: number }
export interface StudyResult { lessonId: string; correct: boolean; choice: number; at: string }

/** Grades the robot's or the owner's answers against the lesson's true answer. */
export function gradeStudy(answers: readonly StudyAnswer[], at: string): StudyResult[] {
  return answers.flatMap((answer) => {
    const lesson = lessonById(answer.lessonId);
    if (!lesson) return [];
    return [{ lessonId: lesson.id, correct: answer.choice === lesson.quiz.correct, choice: answer.choice, at }];
  });
}

export interface StudyProgress {
  studied: number;
  correct: number;
  percent: number | null;
  /** Consecutive days with at least one studied lesson, counted from the newest result. */
  streakDays: number;
  weak: string[];
}

export function studyProgress(results: readonly StudyResult[], now: number): StudyProgress {
  if (!results.length) return { studied: 0, correct: 0, percent: null, streakDays: 0, weak: [] };
  const correct = results.filter((r) => r.correct).length;
  const days = new Set(results.map((r) => new Date(r.at).toISOString().slice(0, 10)));
  let streak = 0;
  for (let i = 0; ; i++) {
    const key = new Date(now - i * DAY).toISOString().slice(0, 10);
    if (!days.has(key)) break;
    streak++;
    if (i > 400) break;
  }
  const weak = [...new Set(results.filter((r) => !r.correct).map((r) => r.lessonId))];
  return { studied: results.length, correct, percent: Math.round(correct / results.length * 100), streakDays: streak, weak };
}

/** The curriculum in a few lines, for the sales robot's report and its AI brief. */
export function salesCurriculumBrief(max = 900): string {
  const count = (n: number) => `${n} ${n === 1 ? 'درس' : 'دروس'}`;
  const modules = (Object.keys(MODULE_LABEL) as LessonModule[]).map((m) => `${MODULE_LABEL[m].ar}: ${count(lessonsIn(m).length)}`).join(' · ');
  const text = [
    `منهج إدارة المبيعات (${SALES_LESSONS.length} درساً) — ${modules}.`,
    `مصادره: «كتيب روبوتات شام» (أقسام: ${[...new Set(SALES_LESSONS.flatMap((l) => l.handbook))].join('، ')}) و«علم البيع» (${SALES_PRINCIPLES.length} مبدأ، ${SALES_PITFALLS.length} فخ).`,
    `قواعد ثابتة: السعر ×1.5 وتقريب لأعلى ٥ · الهامش مايتقالش · البيع مايتسجلش غير بعد رؤية الفلوس في بنك شام · مفيش رقم متخمن ولا استعجال مزيف ولا بيانات تواصل في سجل المبيعات.`,
    `الروبوت المسؤول: «${BOTS.find((b) => b.id === 'sales')?.nameAr || 'مدير المبيعات'}» — درس يومي، تقرير كل ٦ ساعات، ومكتبه قسم داخل «بنك شام».`,
  ].join('\n');
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** SALES_PLAYBOOK.md — the course in a readable file (generated; a test keeps it current). */
export function salesPlaybookDoc(): string {
  const out: string[] = [
    '# منهج إدارة المبيعات — قسم «إدارة المبيعات» داخل «بنك شام»',
    '',
    '> ملف مولَّد تلقائياً من `src/sales/playbook.ts` — لا تعدله يدوياً. للتحديث: `node --import tsx scripts/shaheen-sales/playbook-doc.mts`.',
    '',
    salesCurriculumBrief(2000),
    '',
    '## كيف يعمل المكتب',
    '',
    '- مكانه في لوحة الإدارة: **«بنك شام والمالية» ← «بنك شام» ← «إدارة المبيعات»** (تبويب كامل تحت البنك).',
    '- كل رقم للتحصيل أو الطلبات المدفوعة يأتي من دفتر «بنك شام» المؤكد فقط؛ الفرص والهدف والإيقاع تُبنى عليه ولا تُخترع.',
    '- «مدير المبيعات» روبوت مسجّل في هيكل شاهين (`src/utils/shaheenOrg.ts`)، تقريره `src/data/live/shaheen-sales.json`، وسير عمله `.github/workflows/shaheen-sales.yml`.',
    '- بيانات التواصل ممنوعة في سجل المبيعات: الفرصة باسم مختصر فقط، والتفاصيل في حساب العميل وطلبه.',
    '- الخصم والشراكة والتغيير الكبير: قرار صاحب الموقع. المكتب يقترح ولا يوعد.',
    '',
    '## الدروس',
    '',
  ];
  for (const module of Object.keys(MODULE_LABEL) as LessonModule[]) {
    out.push(`### ${MODULE_LABEL[module].ar}`, '');
    for (const lesson of lessonsIn(module)) {
      out.push(`#### ${lesson.titleAr} (\`${lesson.id}\`)`, '', `- **من الكتيب:** ${lesson.handbook.join('، ')}`);
      if (lesson.principles.length) out.push(`- **من علم البيع:** ${lesson.principles.join('، ')}`);
      out.push('', lesson.ideaAr, '', `**تمرين:** ${lesson.drillAr}`, '', `**سؤال الدرس:** ${lesson.quiz.qAr}`,
        ...lesson.quiz.optionsAr.map((o, i) => `- ${i === lesson.quiz.correct ? '✅' : '•'} ${o}`), '', `> ${lesson.quiz.whyAr}`, '');
    }
  }
  out.push('## المبادئ اللي بتتبيع', '', ...SALES_PRINCIPLES.map((p) => `- **${p.id}** — ${p.ar} (${p.source})`), '');
  out.push('## الفخاخ اللي بتقتل البيع', '', ...SALES_PITFALLS.map((p) => `- **${p.id}** — ${p.ar} (${p.source})`), '');
  return out.filter((line) => line !== undefined).join('\n').trimEnd();
}
