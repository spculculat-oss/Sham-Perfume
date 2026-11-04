import { normalize } from './text';

/**
 * «دليل الصفحات» — المساعد لازم يعرف الزائر واقف فين وهو بيرد.
 *
 * نفس الفكرة اللي في «دليل المنصة» (`platformGuide.ts`) بس من ناحية الزائر: كل صفحة في الموقع
 * (تبويب في `src/App.tsx`) ليها سطر يقول للمساعد إيه اللي الزائر شايفه قدامه وإيه اللي يقدر يعمله
 * فيها، وأسئلة واقعية بتتسأل وهو واقف في الصفحة دي — والمراجعة (`server/core/pageReview.ts`) بتسأل
 * الأسئلة دي فعلًا وتفشل لو الرد مش منطقي للصفحة (سعر مش موجود، «مفيش منتجات» والمتجر مليان، حسبة
 * على صفحة مش حاسبة، إلخ).
 *
 * القاعدة: الصفحة بتغيّر **المثال اللي المساعد بيرد بيه** مش الحقيقة. الأسعار والسياسات بتفضل من
 * المتجر الحقيقي، والصفحة بتحدد الترتيب والاختيار والزر — مش بتغيّر رقم أبدًا.
 */

/** The visitor-facing pages, in the same language as `src/App.tsx` (`activeTab`). */
export type PageId =
  | 'home' | 'store' | 'productDetail' | 'concentration' | 'pyramid' | 'alcohol' | 'costing'
  | 'molecule_studio' | 'maceration_simulator' | 'raw_materials' | 'world_perfumes' | 'perfume_news'
  | 'master_ai' | 'library' | 'community' | 'community/merchant' | 'community/me' | 'guide' | 'perfumes' | 'cosmetics'
  | 'perfume_designers' | 'cosmetic_designers';

/** What an answer must contain to count as a sensible answer *on that page*. */
export type PageExpect =
  | 'any'        // a normal, honest answer
  | 'store'      // real store products (name + real price)
  | 'prices'     // the real price range of the store, never "nothing published"
  | 'product'    // the product the visitor is looking at
  | 'orders'     // the SH- order path
  | 'support'    // a request form or a human hand-off
  | 'tool'       // the tool/page it is standing on, or its numbers
  | 'shaheen'    // Shaheen by name + his page
  | 'community'; // the community / merchant area

export interface PageQuestion { ar: string; en: string; expect: PageExpect }

export interface PageGuide {
  id: PageId;
  label: { ar: string; en: string };
  /** One sentence for the prompt: what the visitor is looking at right now. */
  what: { ar: string; en: string };
  /** The most useful thing the assistant can offer while the visitor is on this page. */
  offer: { ar: string; en: string };
  /** Realistic questions asked while standing here — the page review asks exactly these. */
  questions: PageQuestion[];
  /** Products the visitor can be looking at a single one of (product page only). */
  detail?: boolean;
}

export const PAGES: PageGuide[] = [
  {
    id: 'home', label: { ar: 'الرئيسية', en: 'Home' },
    what: { ar: 'الزائر في الصفحة الرئيسية: بيشوف أقسام الموقع (المعمل، المتجر، المكتبة، المجتمع) وبيدور على نقطة بداية.', en: 'The visitor is on the home page: the site sections (lab, store, library, community) and a place to start.' },
    offer: { ar: 'اسأله هو عايز يعمل إيه: يشتري عطر جاهز، يركّب تركيبة، يتعلم، أو يسأل عن طلب.', en: 'Ask what they want to do: buy a ready perfume, build a formula, learn, or check an order.' },
    questions: [
      { ar: 'أبدأ منين؟', en: 'Where do I start?', expect: 'any' },
      { ar: 'إيه أسعار المنتجات؟', en: 'What are the product prices?', expect: 'prices' },
    ],
  },
  {
    id: 'store', label: { ar: 'المتجر', en: 'Store' },
    what: { ar: 'الزائر جوه المتجر: بيقلّب المنتجات بصورها وأسعارها ومقاساتها، ويقدر يفتح منتج أو يضيف للسلة.', en: 'The visitor is inside the store, browsing products with photos, prices and sizes; they can open a product or add it to the cart.' },
    offer: { ar: 'رشّح له منتجات من الكتالوج بنفس السعر اللي قدامه، أو ضيّق البحث بالماركة أو العائلة أو الميزانية.', en: 'Recommend products at the price they see, or narrow the search by brand, family or budget.' },
    questions: [
      { ar: 'إيه أسعار المنتجات؟', en: 'What are the prices?', expect: 'prices' },
      { ar: 'عندكم عطر عود رجالي للشتا؟', en: 'Do you have a men’s oud perfume for winter?', expect: 'store' },
      { ar: 'عايز عطر تحت 1000 جنيه', en: 'I want a perfume under 1000 EGP', expect: 'store' },
      { ar: 'عايز أشتري عطر', en: 'I want to buy a perfume', expect: 'store' },
    ],
  },
  {
    id: 'productDetail', label: { ar: 'صفحة منتج', en: 'Product page' },
    what: { ar: 'الزائر واقف على صفحة منتج واحد: بيقرأ تفاصيله ونوتاته وتقييماته وسعره، ومحتاج يعرف المقاس أو الشحن أو يقارنه بمنتج تاني.', en: 'The visitor is on a single product page: details, notes, reviews and price, and may need the size, shipping, or a comparison.' },
    offer: { ar: 'اتكلم عن المنتج اللي قدامه هو بالسعر والتفاصيل الحقيقية، وقارنه بمنتج قريب أو ساعده يكمّل الشراء.', en: 'Talk about the product in front of them with its real price and details, compare it with a nearby one, or help them buy.' },
    detail: true,
    questions: [
      { ar: 'المنتج ده سعره كام؟', en: 'How much is this product?', expect: 'product' },
      { ar: 'إيه المقاس والشحن بتاعه؟', en: 'What size is it and how is it shipped?', expect: 'any' },
    ],
  },
  {
    id: 'concentration', label: { ar: 'حاسبة التركيز', en: 'Concentration calculator' },
    what: { ar: 'الزائر في حاسبة التركيز: بيدخل حجم الزجاجة والنسبة المطلوبة ويطلع له كمية الزيت والقاعدة.', en: 'The visitor is on the concentration calculator: bottle volume + target percentage → oil and base amounts.' },
    offer: { ar: 'احسب له الزيت والقاعدة بالأرقام اللي يقولها، أو اشرحله معنى النسبة.', en: 'Compute oil and base from their numbers, or explain the percentage.' },
    questions: [
      { ar: 'عندي 50 مل وعايز 20%، كام زيت وكام كحول؟', en: '50 ml at 20% — how much oil and alcohol?', expect: 'tool' },
      { ar: 'إيه أسعار المنتجات؟', en: 'What are the prices?', expect: 'prices' },
    ],
  },
  {
    id: 'pyramid', label: { ar: 'الهرم العطري', en: 'Scent pyramid' },
    what: { ar: 'الزائر في الهرم العطري: بيرتّب النوتات (قلب/وسط/قاعدة) ويتعلم إزاي تتبني.', en: 'The visitor is on the scent pyramid: arranging top/heart/base notes and learning how a pyramid is built.' },
    offer: { ar: 'ساعده يوزّع النوتات على الهرم ويشرح الفرق بين المقدمة والقلب والقاعدة.', en: 'Help place notes on the pyramid and explain top vs heart vs base.' },
    questions: [
      { ar: 'إزاي أوزّع النوتات على الهرم؟', en: 'How do I place notes on the pyramid?', expect: 'tool' },
      { ar: 'إيه أسعار المنتجات؟', en: 'What are the prices?', expect: 'prices' },
    ],
  },
  {
    id: 'alcohol', label: { ar: 'الكحول والقاعدة', en: 'Alcohol & base' },
    what: { ar: 'الزائر في صفحة الكحول: بيختار نوع الكحول ودرجته ونسبة التعتيق.', en: 'The visitor is on the alcohol page: choosing the alcohol type, grade and maceration ratio.' },
    offer: { ar: 'اشرح الفرق بين الكحول المستخدم ودرجاته، وحذّره من اللهب والتخزين.', en: 'Explain alcohol grades, and warn about flammability and storage.' },
    questions: [
      { ar: 'إيه أحسن كحول للعطور؟', en: 'Which alcohol is best for perfume?', expect: 'tool' },
      { ar: 'المتجر فيه إيه؟', en: 'What is in the store?', expect: 'prices' },
    ],
  },
  {
    id: 'costing', label: { ar: 'حاسبة التكاليف', en: 'Costing calculator' },
    what: { ar: 'الزائر في حاسبة التكاليف: بيحسب تكلفة الكمية اللي بيعملها من الزيوت والكحول.', en: 'The visitor is on the costing calculator: costing their own batch from oils and alcohol.' },
    offer: { ar: 'احسب التكلفة من الأرقام اللي يديهالك، وما تنشرش هامش المنصة أو سعر مورّد.', en: 'Compute the cost from their figures; never reveal the platform margin or a supplier price.' },
    questions: [
      { ar: 'إزاي أحسب تكلفة 100 مل؟', en: 'How do I cost a 100 ml batch?', expect: 'tool' },
      { ar: 'إيه أسعار المنتجات؟', en: 'What are the prices?', expect: 'prices' },
    ],
  },
  {
    id: 'molecule_studio', label: { ar: 'معمل الجزيئات', en: 'Molecule Studio' },
    what: { ar: 'الزائر في معمل الجزيئات: بيجرب جزيئات عطرية ويشوف أثرها.', en: 'The visitor is in Molecule Studio: trying aroma molecules and their effect.' },
    offer: { ar: 'اشرحله الجزيء اللي بيسأل عنه واستخدامه، وحوّل التركيبات العميقة لشاهين.', en: 'Explain the molecule and its use, and hand deep formulation to Shaheen.' },
    questions: [
      { ar: 'إيه استخدام الجزيئات في العطر؟', en: 'What are molecules used for?', expect: 'tool' },
      { ar: 'إيه أسعار المنتجات؟', en: 'What are the prices?', expect: 'prices' },
    ],
  },
  {
    id: 'maceration_simulator', label: { ar: 'محاكي التعتيق', en: 'Maceration simulator' },
    what: { ar: 'الزائر في محاكي التعتيق: بيشوف التركيبة بتتغير مع الأيام.', en: 'The visitor is on the maceration simulator: watching a blend change over time.' },
    offer: { ar: 'اشرحله مراحل التعتيق والمدة والتخزين.', en: 'Explain maceration stages, timing and storage.' },
    questions: [
      { ar: 'التعتيق بياخد قد إيه؟', en: 'How long does maceration take?', expect: 'tool' },
      { ar: 'المتجر فيه إيه؟', en: 'What is in the store?', expect: 'prices' },
    ],
  },
  {
    id: 'perfumes', label: { ar: 'قسم العطور', en: 'Perfume section' },
    what: { ar: 'الزائر في قسم العطور: أدوات التصميم والحاسبات والموسوعة والمتجر.', en: 'The visitor is in the perfume section: design tools, calculators, the encyclopedia and the store.' },
    offer: { ar: 'وجّهه للأداة المناسبة لسؤاله أو لعطور المتجر الحقيقية.', en: 'Point them to the right tool for their question or to the real store perfumes.' },
    questions: [
      { ar: 'أبدأ منين لو عايز أصمم عطر؟', en: 'Where do I start if I want to design a perfume?', expect: 'any' },
      { ar: 'المتجر فيه إيه؟', en: 'What is in the store?', expect: 'prices' },
    ],
  },
  {
    id: 'cosmetics', label: { ar: 'قسم مستحضرات التجميل', en: 'Cosmetics section' },
    what: { ar: 'الزائر في قسم مستحضرات التجميل: مصمم تركيبات الكريمات والسيرومات والزبدات، مكتبة الخامات، ودروس البشرة والشعر. منتجات التجميل في المتجر لسه قريباً.', en: 'The visitor is in the cosmetics section: the formulator for creams, serums and butters, the ingredient library, and skin and hair lessons. Cosmetic products in the store are coming soon.' },
    offer: { ar: 'اشرحله الخامة أو التركيبة بأمان: حافظة مع أي ماء، اختبار رقعة، ومن غير وعود علاج. ماتخترعش منتجات تجميل مش موجودة في المتجر.', en: 'Explain the ingredient or formula safely: a preservative with any water, a patch test, no treatment claims. Never invent cosmetic products the store does not have.' },
    questions: [
      { ar: 'ليه الكريم اللي فيه ماء لازم مادة حافظة؟', en: 'Why does a cream with water need a preservative?', expect: 'any' },
      { ar: 'المتجر فيه إيه؟', en: 'What is in the store?', expect: 'prices' },
    ],
  },
  {
    id: 'perfume_designers', label: { ar: 'قسم المصممين — عطور', en: 'Designers — perfume' },
    what: { ar: 'الزائر في قسم مصممي العطور: بيكتب تركيبة عطر بنسبها والمعمل بيعمل لها محاكاة كاملة (الطابع والثبات والتشابه والتوافق مع IFRA).', en: 'The visitor is in the perfume designers’ section: writing a perfume formula with its percentages while the lab simulates it fully (character, staying power, resemblance, IFRA compliance).' },
    offer: { ar: 'ساعده يحسن تركيبته: يوازن الهرم، يصلح المواد اللي فوق حدود IFRA بمواد بديلة، ويزود الثبات — وفكّره إن المحاكاة تقريبية ولازم شهادة IFRA من المورد.', en: 'Help improve the formula: balance the pyramid, replace materials above IFRA limits with alternatives, boost staying power — and remind them the simulation is approximate and the supplier’s IFRA certificate is required.' },
    questions: [
      { ar: 'ليه البرغموت المعصور بيطلع غير متوافق؟', en: 'Why is expressed bergamot not compliant?', expect: 'any' },
      { ar: 'إيه أسعار المنتجات؟', en: 'What are the prices?', expect: 'prices' },
    ],
  },
  {
    id: 'cosmetic_designers', label: { ar: 'قسم المصممين — تجميل', en: 'Designers — cosmetics' },
    what: { ar: 'الزائر في قسم مصممي التجميل: بيكتب تركيبة كريم أو سيروم أو زبدة بنسبها والمعمل بيحاكيها (النوع والقوام والحموضة والحافظة وحدود لائحة الاتحاد الأوروبي).', en: 'The visitor is in the cosmetic designers’ section: writing a cream, serum or butter formula while the lab simulates it (type, texture, pH, preservative and EU limits).' },
    offer: { ar: 'اشرحله سبب أي رفض بأمان: حافظة مع أي ماء، مستحلب كفاية، حدود المواد الفعالة، ومن غير وعود علاج. ماتخترعش منتجات تجميل مش موجودة في المتجر.', en: 'Explain any failure safely: a preservative with any water, enough emulsifier, active-ingredient limits, no treatment claims. Never invent cosmetic products the store does not have.' },
    questions: [
      { ar: 'ليه الكريم بتاعي بينفصل؟', en: 'Why does my cream separate?', expect: 'any' },
      { ar: 'المتجر فيه إيه؟', en: 'What is in the store?', expect: 'prices' },
    ],
  },
  {
    id: 'raw_materials', label: { ar: 'المواد الخام', en: 'Raw materials' },
    what: { ar: 'الزائر في موسوعة المواد الخام: بيدور على مادة عطرية وخصائصها وسعرها الداخلي.', en: 'The visitor is in the raw-materials encyclopedia: looking up a material, its properties and its internal price.' },
    offer: { ar: 'اشرحله المادة وخواصها وثباتها، وما تنشرش أسعار الموردين ولا الهامش.', en: 'Explain the material and its strength; never publish supplier prices or margin.' },
    questions: [
      { ar: 'إيه الفرق بين المسك الأبيض والمسك الحيواني؟', en: 'White musk vs animal musk?', expect: 'tool' },
      { ar: 'إيه أسعار المنتجات؟', en: 'What are the prices?', expect: 'prices' },
    ],
  },
  {
    id: 'world_perfumes', label: { ar: 'عطور العالم والكتب', en: 'World perfumes & books' },
    what: { ar: 'الزائر في قسم عطور العالم والكتب: بيقرأ عن عطور ومدارس عطرية ومراجع.', en: 'The visitor is in world perfumes / books: reading about perfumes, schools and references.' },
    offer: { ar: 'اقترحله مدرسة عطرية أو مرجع، ورتّب له قراية مناسبة لمستواه.', en: 'Suggest a perfume school or a reference suited to their level.' },
    questions: [
      { ar: 'أنصحني بكتاب أبدأ بيه', en: 'Which book should I start with?', expect: 'tool' },
      { ar: 'المتجر فيه إيه؟', en: 'What is in the store?', expect: 'prices' },
    ],
  },
  {
    id: 'perfume_news', label: { ar: 'أخبار العطور', en: 'Perfume news' },
    what: { ar: 'الزائر في تبويب أخبار العطور: بيقرأ آخر الأخبار والصيحات بمصادرها.', en: 'The visitor is on Perfume news: the latest news and trends with their sources.' },
    offer: { ar: 'حوّل أسئلة الأخبار للخبير شاهين وزر التبويب، وما تخترعش خبر.', en: 'Send news questions to Shaheen and the tab; never invent a news item.' },
    questions: [
      { ar: 'إيه آخر أخبار العطور؟', en: 'What is the latest perfume news?', expect: 'shaheen' },
      { ar: 'إيه أسعار المنتجات؟', en: 'What are the prices?', expect: 'prices' },
    ],
  },
  {
    id: 'master_ai', label: { ar: 'الخبير شاهين', en: 'Shaheen expert' },
    what: { ar: 'الزائر جوه صفحة «الخبير شاهين»: بيركّب تركيبة ويسأل أسئلة عطور عميقة.', en: 'The visitor is inside the Shaheen expert page: building a formula and asking deep perfumery questions.' },
    offer: { ar: 'ساعده في حدودك (بيانات المتجر والخدمات)، وأسئلة التركيب سيبها لشاهين نفسه اللي قدامه.', en: 'Help within your remit; leave formulation depth to Shaheen, who is right there.' },
    questions: [
      { ar: 'إزاي أرفع نسبة العود في التركيبة؟', en: 'How do I raise the oud ratio?', expect: 'shaheen' },
      { ar: 'إيه أسعار المنتجات؟', en: 'What are the prices?', expect: 'prices' },
    ],
  },
  {
    id: 'library', label: { ar: 'مكتبة التركيبات', en: 'Formula library' },
    what: { ar: 'الزائر في مكتبة التركيبات: بيحفظ تركيباته ويرجع لها ويشاركها.', en: 'The visitor is in the formula library: saving, reopening and sharing formulas.' },
    offer: { ar: 'اشرحله الحفظ والمشاركة والتصدير، وما توعدش بحفظ تلقائي.', en: 'Explain saving, sharing and export; never promise automatic saving.' },
    questions: [
      { ar: 'إزاي أحفظ التركيبة وأشاركها؟', en: 'How do I save and share a formula?', expect: 'tool' },
      { ar: 'المتجر فيه إيه؟', en: 'What is in the store?', expect: 'prices' },
    ],
  },
  {
    id: 'community', label: { ar: 'مجتمع شام', en: 'Sham community' },
    what: { ar: 'الزائر في مجتمع شام: منشورات وتجارب ونقاشات العطور.', en: 'The visitor is in the Sham community: posts, experiences and perfume discussions.' },
    offer: { ar: 'وجّهه للنشر أو المتابعة أو سوق التجار، وما تنشرش حاجة باسمه.', en: 'Guide them to post, follow or the merchant market; never post as them.' },
    questions: [
      { ar: 'إزاي أنشر تجربتي؟', en: 'How do I share my experience?', expect: 'community' },
      { ar: 'إيه أسعار المنتجات؟', en: 'What are the prices?', expect: 'prices' },
    ],
  },
  {
    id: 'community/merchant', label: { ar: 'سوق التجار', en: 'Merchant market' },
    what: { ar: 'الزائر في سوق التجار: بيفتح متجر لعطوره أو بيتصفح متاجر تجار تانيين.', en: 'The visitor is in the merchant market: opening their own shop or browsing other merchants.' },
    offer: { ar: 'اشرحله خطوات فتح المتجر والاتفاقية والمنتجات، وما تعدلش بياناته.', en: 'Explain opening a shop, the agreement and products; never change their data.' },
    questions: [
      { ar: 'إزاي أفتح متجر في سوق التجار؟', en: 'How do I open a merchant shop?', expect: 'community' },
      { ar: 'إيه أسعار المنتجات؟', en: 'What are the prices?', expect: 'prices' },
    ],
  },
  {
    id: 'community/me', label: { ar: 'حسابي', en: 'My account' },
    what: { ar: 'الزائر في صفحة حسابه: طلباته وتركيباته وبياناته.', en: 'The visitor is on their account page: orders, formulas and details.' },
    offer: { ar: 'ساعده في تتبع طلبه أو مسح بياناته، وما تطلبش كلمة مرور أبداً.', en: 'Help track an order or erase their data; never ask for a password.' },
    questions: [
      { ar: 'فين طلبي؟', en: 'Where is my order?', expect: 'orders' },
      { ar: 'إيه اللي بتعرفه عني؟', en: 'What do you know about me?', expect: 'any' },
    ],
  },
  {
    id: 'guide', label: { ar: 'دليل المنصة', en: 'Platform guide' },
    what: { ar: 'الزائر في دليل المنصة: بيقرأ شرح كل أداة وميزة.', en: 'The visitor is in the platform guide: how each tool and feature works.' },
    offer: { ar: 'اشرحله الأداة وافتحها له بالزر.', en: 'Explain the tool and open it with the button.' },
    questions: [
      { ar: 'إيه الأدوات اللي في الموقع؟', en: 'Which tools does the site have?', expect: 'tool' },
      { ar: 'إيه أسعار المنتجات؟', en: 'What are the prices?', expect: 'prices' },
    ],
  },
];

export const PAGE_IDS = PAGES.map((p) => p.id);

/** The real page behind a hash / a tab id the widget or the API was given ('' when unknown). */
export function pageGuide(id?: string): PageGuide | undefined {
  if (!id) return undefined;
  const clean = String(id).trim().replace(/^#/, '').split('?')[0].toLowerCase();
  if (!clean) return undefined;
  const exact = PAGES.find((p) => p.id.toLowerCase() === clean);
  if (exact) return exact;
  // Hash variants: «product=12» (a product page), «store/xyz», «community/merchant?tab=…»
  if (/^product=\d+$/.test(clean)) return PAGES.find((p) => p.id === 'productDetail');
  const base = clean.split('/')[0];
  return PAGES.find((p) => p.id.toLowerCase() === base);
}

/** The platform feature each page belongs to — used when a «how do I…» question arrives with no keyword match. */
const PAGE_FEATURE: Partial<Record<PageId, string>> = {
  home: 'guide', store: 'store', productDetail: 'store', concentration: 'concentration', pyramid: 'pyramid',
  alcohol: 'alcohol', costing: 'costing', molecule_studio: 'molecule_studio', maceration_simulator: 'maceration',
  raw_materials: 'raw_materials', world_perfumes: 'world_perfumes', perfume_news: 'news', master_ai: 'shaheen',
  library: 'library', community: 'community', 'community/merchant': 'merchant', 'community/me': 'account', guide: 'guide',
  perfumes: 'guide', cosmetics: 'guide', perfume_designers: 'designers', cosmetic_designers: 'designers',
};

/** The feature id of the page the visitor is on (undefined for an unknown page). */
export function pageFeature(id?: string): string | undefined {
  const page = pageGuide(id);
  return page ? PAGE_FEATURE[page.id] : undefined;
}

/** A «how do I …» question: the page they are standing on is the best hint for which feature they mean. */
export function asksHowTo(message: string): boolean {
  const m = ` ${normalize(message)} `;
  return / (ازاي|كيف|طريقه|how (do|can|to)|where (do|can)|what is the (way|steps)) /.test(m);
}

/** Prompt block: where the visitor is standing, and what is worth offering them there. */
export function pageBrief(lang: 'ar' | 'en', id?: string, productName?: string): string {
  const page = pageGuide(id);
  if (!page) return '';
  const ar = lang === 'ar';
  const name = productName ? (ar ? ` (المنتج المفتوح: ${productName})` : ` (open product: ${productName})`) : '';
  return ar
    ? `الصفحة الحالية للزائر: «${page.label.ar}»${name}. ${page.what.ar} ${page.offer.ar} جاوب بما يناسب مكانه ده، لكن الأسعار والسياسات تفضل من بيانات المتجر الحقيقية بس.`
    : `The visitor is currently on “${page.label.en}”${name}. ${page.what.en} ${page.offer.en} Answer for where they are, but prices and policies still come only from the real store data.`;
}
