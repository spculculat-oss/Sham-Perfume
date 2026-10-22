/**
 * «دليل المنصة» — كل ميزة بيشوفها الزائر في منصة شام في مكان واحد، بالمصدر اللي الكود نفسه بيستخدمه:
 *
 *  - `PLATFORM_FEATURES`: الاسم، الشرح المختصر، طريقة الاستخدام، تبويب الموقع اللي بيفتحها، وكلمات البحث.
 *  - `platformKnowledge()`: مستندات قاعدة المعرفة اللي بتتزرع أول مرة، فالمساعد يرد بالاسترجاع حتى من غير
 *    أي مفتاح ذكاء اصطناعي ويقدر يعرض المرجع.
 *  - `matchPlatformFeature()`: يعرف الزائر بيسأل عن أنهي ميزة بالعربي أو الإنجليزي، فيرد رد مباشر
 *    ويعرض زر «افتح الصفحة» بدل ما يضيّع الزائر يدوّر على التبويب.
 *  - `platformCatalog()` و`shippingBrief()`: كتالوج مختصر + جدول الشحن الحقيقي يتضافوا لبرومبت النموذج
 *    عند كل سؤال، فأي تحديث هنا بيوصل للمساعد فوراً من غير ما يتخزن في مكان تاني.
 *
 * القاعدة: مفيش رقم أو وعد متخيّن. الأسعار والمخزون والمواعيد بتيجي من بيانات المنصة بس، واللي مش
 * متأكدين منه بنقول إن فريق شام هو اللي بيأكده.
 */
import { matchesKeyword, normalize } from './text';
import { SHIPPING } from '../../src/utils/pricing';
import { SUPPORTED_LANGUAGES } from '../../src/types/i18n';
import type { KnowledgeDoc } from './types';

export type PlatformGroup = 'lab' | 'reference' | 'workspace' | 'community' | 'shop' | 'help';

export interface PlatformFeature {
  id: string;
  group: PlatformGroup;
  /** Tab id in src/App.tsx; the open_tab card navigates there. Omitted when there is no visitor tab. */
  tab?: string;
  /** Knowledge document id: an existing curated doc, or one of the platform docs created below. */
  docId: string;
  name: { ar: string; en: string };
  /** The direct answer: one sentence. */
  summary: { ar: string; en: string };
  /** How to use it, and its honest limits. */
  details: { ar: string; en: string };
  /** Arabic and English search words (whole-word, inflections tolerated by matchesKeyword). */
  keywords: string[];
  tags: string[];
}

export const PLATFORM_GROUP_LABEL: Record<PlatformGroup, { ar: string; en: string }> = {
  lab: { ar: 'أدوات المعمل والحاسبات', en: 'Lab tools & calculators' },
  reference: { ar: 'المكتبات والمراجع', en: 'Libraries & references' },
  workspace: { ar: 'دفتر الوصفات والخبراء', en: 'Your formulas & experts' },
  community: { ar: 'المجتمع والحساب', en: 'Community & account' },
  shop: { ar: 'المتجر والخدمات', en: 'Store & services' },
  help: { ar: 'الخصوصية والقانون والمساعدة', en: 'Privacy, legal & help' },
};

/**
 * ترتيب الميزات هو ترتيب عرضها في «دليل المنصة» والاقتراحات. كل شرح مكتوب من الكود الفعلي للمنصة،
 * وأي ميزة بتتغيّر لازم تتغيّر هنا معاها (اختبار tests/shamCorePlatform.test.ts بيحرس التبويبات).
 */
export const PLATFORM_FEATURES: PlatformFeature[] = [
  {
    id: 'concentration', group: 'lab', tab: 'concentration', docId: 'kb-concentration',
    name: { ar: 'حاسبة التركيز', en: 'Concentration calculator' },
    summary: {
      ar: 'تحسب مقادير الزيت العطري والكحول والماء والمثبت حسب حجم الزجاجة ونسبة التركيز.',
      en: 'Calculates the fragrance oil, alcohol, water and fixative amounts for a bottle size and concentration.',
    },
    details: {
      ar: 'اختار حجم الزجاجة ونوع التركيز (كولونيا أو EDT أو EDP أو بارفان) وبتظهر المقادير بالمل والجرام، ومعاها محاكي ميزان دقيق 0.01 جم وزر لنقل النتيجة لحاسبة التكاليف.',
      en: 'Pick the bottle size and concentration (cologne, EDT, EDP or parfum); amounts appear in ml and grams, with a 0.01 g balance simulator and a button that sends the result to the costing calculator.',
    },
    keywords: ['حاسبة التركيز', 'حاسبة التركيب', 'نسبة التركيز', 'تركيز العطر', 'concentration calculator', 'concentration'],
    tags: ['تركيز', 'حاسبة', 'concentration', 'calculator'],
  },
  {
    id: 'pyramid', group: 'lab', tab: 'pyramid', docId: 'kb-pyramid',
    name: { ar: 'حاسبة الهرم العطري', en: 'Fragrance pyramid calculator' },
    summary: {
      ar: 'توزّع نوتات العطر على القمة والقلب والقاعدة وتتأكد أن مجموعها 100%.',
      en: 'Splits the notes across top, heart and base and checks that they add up to 100%.',
    },
    details: {
      ar: 'ضيف النوتات بنسبها لكل طبقة، والحاسبة بتحذّرك لو المجموع مش 100%، وفيها محاكي رش يوضح إزاي العطر بيتطور على الجلد مع الوقت.',
      en: 'Add notes with their share of each layer; it warns you when the total is not 100%, and a spray simulator shows how the scent develops on skin over time.',
    },
    keywords: ['الهرم العطري', 'حاسبة الهرم', 'النوتات العطرية', 'fragrance pyramid', 'pyramid calculator'],
    tags: ['هرم', 'نوتات', 'pyramid', 'notes'],
  },
  {
    id: 'alcohol', group: 'lab', tab: 'alcohol', docId: 'kb-alcohol',
    name: { ar: 'حاسبة تخفيف الكحول', en: 'Alcohol dilution calculator' },
    summary: {
      ar: 'تحسب كمية الماء المقطر اللازمة لتخفيف كحول بدرجة معيّنة إلى الدرجة اللي تحتاجها.',
      en: 'Calculates the distilled water needed to dilute alcohol from one strength to the strength you need.',
    },
    details: {
      ar: 'اكتب الدرجة الحالية والدرجة المطلوبة والحجم، والنتيجة تقديرية بالحجم لأن خلط الكحول والماء بينكمش شوية.',
      en: 'Enter the current strength, the target strength and the volume. The result is a volume estimate because alcohol and water contract slightly when mixed.',
    },
    keywords: ['تخفيف الكحول', 'حاسبة الكحول', 'درجة الكحول', 'alcohol dilution', 'dilution calculator'],
    tags: ['كحول', 'تخفيف', 'alcohol', 'dilution'],
  },
  {
    id: 'costing', group: 'lab', tab: 'costing', docId: 'kb-costing',
    name: { ar: 'حاسبة التكاليف والتسعير', en: 'Costing & pricing calculator' },
    summary: {
      ar: 'تجمع تكلفة الزيوت والكحول والعبوة والتغليف والتشغيل وتقترح سعر بيع حسب هامش الربح.',
      en: 'Adds up oils, alcohol, bottle, packaging and labour, then suggests a selling price for your target margin.',
    },
    details: {
      ar: 'بتشتغل بعملة بلدك المختارة في إعدادات المنصة، وتقدر تجيب الكميات مباشرة من حاسبة التركيز بدل ما تكتبها تاني.',
      en: 'It uses the country currency chosen in the site settings, and can pull the quantities straight from the concentration calculator.',
    },
    keywords: ['حاسبة التكاليف', 'تسعير العطر', 'تكلفة العطر', 'هامش الربح', 'costing calculator', 'pricing'],
    tags: ['تكلفة', 'تسعير', 'cost', 'pricing'],
  },
  {
    id: 'molecule_studio', group: 'lab', tab: 'molecule_studio', docId: 'kb-platform-molecule-studio',
    name: { ar: 'معمل الجزيئات (Molecule Studio)', en: 'Molecule Studio' },
    summary: {
      ar: 'معمل كامل لبناء التركيبة من قاعدة مواد خام معروفة، وتحليل قائمة مكونات، وتخطيط التحضير والتعتيق.',
      en: 'A complete studio to compose from a known raw-material database, analyse an ingredient list, and plan preparation and maceration.',
    },
    details: {
      ar: 'أربع شاشات: «التركيب» تضيف المواد بنسبها لكل نوتة، و«تحليل قائمة» تلصق فيها مكونات تركيبة فتتحقق من الأسماء والنسب، و«التحضير والتعتيق» ترتّب خطوات الوزن والتعتيق، و«مكتبة مرجعية» للمواد بأرقام CAS. النسب تعليمية وليست وصفة تجارية جاهزة، وتقدر تنقل النتيجة للحاسبات.',
      en: 'Four screens: Compose adds materials with their share of each note; Analyze list checks the names and percentages of a pasted formula; Preparation & aging orders the weighing and maceration steps; and a reference library lists materials with CAS numbers. Percentages are educational, not a commercial recipe, and results carry over to the calculators.',
    },
    keywords: ['معمل الجزيئات', 'استوديو الجزيئات', 'المعمل الجزيئي', 'تحليل قائمة', 'تحليل مكونات', 'molecule studio', 'analyze ingredients'],
    tags: ['molecule studio', 'معمل', 'تحليل', 'تركيب'],
  },
  {
    id: 'maceration', group: 'lab', tab: 'maceration_simulator', docId: 'kb-maceration',
    name: { ar: 'محاكي التعتيق ودليل المثبتات', en: 'Maceration simulator & fixatives guide' },
    summary: {
      ar: 'يوضّح مدة التعتيق المناسبة لنوع التركيبة ودور المثبتات، مع محاكي زمني للتعتيق.',
      en: 'Shows a suitable maceration period for each formula type and what fixatives do, with a time simulator.',
    },
    details: {
      ar: 'اختار نوع العطر (حمضي، زهري، شرقي، عود…) وبيظهر مدى التعتيق النموذجي وشرح المثبتات، وفي «دليل التعتيق» تفاصيل النضوج والمذيبات. المدد إرشادية وبتتأثر بالمواد والتركيز والحرارة.',
      en: 'Pick the scent family (citrus, floral, oriental, oud…) to see a typical maceration range and a fixative explanation; the aging guide covers maturation and solvents in depth. Ranges are guidance and depend on materials, concentration and temperature.',
    },
    keywords: ['محاكي التعتيق', 'مدة التعتيق', 'المثبتات', 'ماسيراشن', 'maceration simulator', 'fixatives', 'maceration'],
    tags: ['تعتيق', 'مثبتات', 'maceration', 'fixative'],
  },
  {
    id: 'raw_materials', group: 'reference', tab: 'raw_materials', docId: 'kb-platform-raw-materials',
    name: { ar: 'موسوعة المواد الخام', en: 'Raw materials encyclopedia' },
    summary: {
      ar: 'فهرس مواد عطرية مشروحة بعائلاتها وأرقام CAS وقواعد الأمان وملاحظات الاستخدام.',
      en: 'An index of perfumery materials with families, CAS numbers, safety notes and usage guidance.',
    },
    details: {
      ar: 'فيها بحث وتصنيفات (زيوت طبيعية، مذيبات، مثبتات، جزيئات حديثة، صموغ وأدهان عود)، وتقدر تضيف أي مادة كنوتة في الهرم مباشرة. المعلومات تعليمية، والسلامة النهائية بتتحدد بشهادة المورد وتركيز الاستخدام.',
      en: 'It has search and categories (natural oils, solvents, fixatives, modern molecules, gums and oud oils), and any material can be added straight to the pyramid as a note. The content is educational; final safety follows the supplier certificate and use concentration.',
    },
    keywords: ['موسوعة المواد الخام', 'المواد الخام', 'مواد عطرية', 'raw materials', 'raw material encyclopedia', 'cas'],
    tags: ['مواد خام', 'موسوعة', 'raw materials', 'cas'],
  },
  {
    id: 'world_perfumes', group: 'reference', tab: 'world_perfumes', docId: 'kb-platform-world-perfumes',
    name: { ar: 'مكتبة العطور العالمية', en: 'World perfumes library' },
    summary: {
      ar: 'نماذج أكورد تعليمية مستوحاة من عطور عالمية مشهورة، بنسب توضيحية لا تمثل التركيبات الأصلية.',
      en: 'Educational accord studies inspired by famous perfumes, with illustrative percentages — not the makers’ original formulas.',
    },
    details: {
      ar: 'تفتح العطر وتشوف نوتاته ونسبه التوضيحية، وتقدر تحمّله على حاسبة المعمل أو تطبع بطاقة التركيبة. المكتبة تعليمية وليست تحليلاً مخبرياً ولا تفصح عن وصفة أي دار عطور.',
      en: 'Open a perfume to see its notes and illustrative shares, then load it into the lab calculator or print a formula card. The library is educational — not a laboratory analysis, and it never reveals any perfume house’s recipe.',
    },
    keywords: ['مكتبة العطور العالمية', 'عطور عالمية', 'أكورد', 'world perfumes', 'perfume library'],
    tags: ['عطور عالمية', 'أكورد', 'reference', 'world perfumes'],
  },
  {
    id: 'books', group: 'reference', tab: 'world_perfumes', docId: 'kb-platform-books',
    name: { ar: 'مكتبة الكتب والكتيّبات', en: 'Book library & booklets' },
    summary: {
      ar: 'مكتبة كتب عطور إلكترونية: كتيّبات أصلية كاملة تُقرأ في المتصفح، وفهرس لمراجع عالمية بدون ملفات كتب.',
      en: 'An e-book library: original booklets readable in the browser, plus a catalogue of world references without book files.',
    },
    details: {
      ar: 'الكتيّبات الأصلية (دليل القراءة، دفتر الأدلة، دليل التذوق، كتاب اللمعان) متاحة كاملة بصيغة EPUB بقارئ داخل الموقع، أما المراجع الستة عشر فهي فهرسة فقط لتوثيق بياناتها ولا نرفق نصوصها. التصميم بيتبع لغة الموقع.',
      en: 'The original booklets (reading guide, evidence notebook, scent observation, brilliance) are available in full as EPUB with an in-site reader; the sixteen references are catalogue entries for documentation only and their texts are not attached. The interface follows the site language.',
    },
    keywords: ['مكتبة الكتب', 'كتب العطور', 'كتب', 'كتاب', 'كتيّبات', 'كتاب إلكتروني', 'epub', 'book library', 'books about perfume'],
    tags: ['كتب', 'مكتبة', 'epub', 'books', 'reading'],
  },
  {
    id: 'news', group: 'reference', tab: 'perfume_news', docId: 'kb-platform-news',
    name: { ar: 'أخبار العطور', en: 'Perfume news' },
    summary: {
      ar: 'نشرة أخبار وصيحات من عالم العطور بيجمعها «الخبير شاهين» من مصادر عامة مع ذكر المصدر.',
      en: 'A perfume news and trends digest gathered by the Sham expert from public sources, with sources credited.',
    },
    details: {
      ar: 'التبويب بيعرض آخر الأخبار ويحدّثها تلقائياً، وتقدر تنقل ملاحظة من خبر لحاسبة التركيز أو للهرم. الأخبار تنقل ولا تُخترع: أي خبر بدون مصدر واضح بيتم استبعاده.',
      en: 'The tab shows the latest items and refreshes automatically; a note from a news item can be carried into the concentration calculator or the pyramid. News is reported, never invented: items without a clear source are dropped.',
    },
    // No routing keywords on purpose: «إيه آخر أخبار العطور؟» asks for the news itself, so it must keep
    // going to retrieval (the live digest) instead of being answered with “this is the news page”.
    // The feature still appears in the platform map, its suggestions and its knowledge document.
    keywords: [],
    tags: ['أخبار', 'news', 'trends'],
  },
  {
    id: 'shaheen', group: 'workspace', tab: 'master_ai', docId: 'kb-platform-shaheen',
    name: { ar: 'الخبير شاهين', en: 'Master Shaheen' },
    summary: {
      ar: 'خبير المنصة في تصميم العطور: يساعد في اختيار النوتات والعائلات والثبات والتعتيق خطوة بخطوة.',
      en: 'The platform’s perfumery expert: helps with notes, families, longevity and maceration step by step.',
    },
    details: {
      ar: 'موجود في تبويب «الخبير شاهين»، ويقدر يستلم التركيبة اللي بتبنيها ويحوّلها لحاسبة التركيز أو الهرم أو التكاليف، ويسجلها في دفتر الوصفات ويطبع بطاقة تصنيع. للأسئلة عن الطلبات والمتجر والدعم استخدم «مساعد شام» (أنا).',
      en: 'It lives in the Shaheen tab and can take the formula you are building into the concentration, pyramid or costing calculator, record it in the formula library and print a batch sheet. For orders, store and support questions use the Sham assistant (me).',
    },
    keywords: ['الخبير شاهين', 'شاهين', 'master shaheen', 'shaheen', 'معمل الذكاء', 'الذكاء الاصطناعي للعطور'],
    tags: ['شاهين', 'خبير', 'shaheen', 'formulation'],
  },
  {
    id: 'library', group: 'workspace', tab: 'library', docId: 'kb-platform-formulas',
    name: { ar: 'دفتر الوصفات وبطاقة التصنيع', en: 'Formula library & batch sheet' },
    summary: {
      ar: 'مكان تحفظ فيه تركيباتك، ترجّعها للحاسبة، تطبع بطاقة تصنيع، وتشاركها برابط أو واتساب.',
      en: 'Where you keep your formulas, load them back into the calculator, print a batch sheet and share a link or WhatsApp.',
    },
    details: {
      ar: 'الحفظ من زر الحفظ في حاسبة التركيز أو من الخبير شاهين، والتركيبات بتتحفظ في متصفحك على نفس الجهاز ومش بتروح لسيرفر شام، فلو مسحت بيانات المتصفح بتتمسح. بطاقة التصنيع فيها المكونات والأوزان وخطوات التحضير بدون أي هامش أو تكلفة داخلية.',
      en: 'Save from the concentration calculator or from Master Shaheen. Formulas are stored in your browser on this device and are not sent to Sham’s server, so clearing browser data removes them. The batch sheet lists ingredients, weights and preparation steps with no margin or internal cost.',
    },
    keywords: ['دفتر الوصفات', 'مكتبة الوصفات', 'بطاقة التصنيع', 'تركيباتي', 'formula library', 'batch sheet', 'save formula'],
    tags: ['وصفات', 'تركيبات', 'حفظ', 'formula', 'batch sheet'],
  },
  {
    id: 'community', group: 'community', tab: 'community', docId: 'kb-platform-community',
    name: { ar: 'مجتمع شام', en: 'Sham Community' },
    summary: {
      ar: 'شبكة اجتماعية لصنّاع العطور: منشورات وأصدقاء ونقاش وماسنجر وبريد داخلي وبوابة تجار.',
      en: 'A social network for perfumers: posts, friends, discussions, messenger, internal mail and a merchant portal.',
    },
    details: {
      ar: 'داخل «مجتمع شام»: السوشيال والستوريز والمنشورات، مجلس النقاش، أخبار العطور، الأصدقاء، الإشعارات، الماسنجر، «بريد شام» الداخلي (وارد ومميّز ومرسل ومسودات وأرشيف ومهملات)، و«بوابتي» فيها ملفك وتركيباتك المحفوظة وتعلّمك ومشترياتك وإعدادات الأمان. كل ده بيفتح من تبويب المجتمع، ومحتاج حساب عضو، ولو قاعدة البيانات مش متاحة ببيقول «لسه بيتجهّز» بصراحة.',
      en: 'Inside Sham Community: the social feed, stories and posts, discussions, perfume news, friends, notifications, messenger, internal Sham mail (inbox, starred, sent, drafts, archive, trash) and “My portal” with your profile, saved recipes, learning progress, purchases and security settings. It all opens from the Community tab, needs a member account, and says honestly that it is being prepared when the database is unavailable.',
    },
    keywords: ['مجتمع شام', 'المجتمع', 'سوشيال شام', 'ناسنجر', 'ماسنجر', 'بريد شام', 'بوابة التجار', 'sham community', 'community', 'messenger'],
    tags: ['مجتمع', 'سوشيال', 'ماسنجر', 'community', 'social'],
  },
  {
    id: 'merchant', group: 'community', tab: 'community/merchant', docId: 'kb-platform-merchant',
    name: { ar: 'بوابة التجار ومتجرك في شام', en: 'Merchant portal & your store' },
    summary: {
      ar: 'تفتح متجرك جوه شام: تضيف منتجاتك بسعرك، والإدارة بتراجع وتنشر، وشام بتتولى الدفع والشحن.',
      en: 'Open your store inside Sham: add products at your price, the team reviews and publishes, and Sham handles payment and shipping.',
    },
    details: {
      ar: '«بوابة التجار» فيها لوحة المتجر وأرقام المنتجات والطلبات ومستحقاتك، و«منتجاتي» لإضافة منتج بسعرك وعملتك، و«بيانات المتجر» للشعار والوصف. المنتج بيستنى اعتماد الإدارة قبل النشر، وروابط وأرقام المورّد بتتشال من النص العام. سوق التجار بيعرض متاجر شام للزوار، والزائر بيشتري من صفحة المتجر بالدفع المعتمد.',
      en: 'The merchant portal has the store dashboard with product, order and earnings figures, “My products” to add an item at your own price and currency, and the store file with your logo and description. Each product waits for team approval before publishing, and supplier links or phone numbers are stripped from public text. The merchants’ market lists Sham stores for visitors, who buy from the store page with the approved payment.',
    },
    keywords: ['بوابة التجار', 'بوابة التاجر', 'أفتح متجر', 'افتح متجر', 'أبيع منتجاتي', 'بيع منتجاتي', 'merchant portal', 'sell on sham'],
    tags: ['تاجر', 'متجر', 'merchant', 'seller'],
  },
  {
    id: 'account', group: 'community', tab: 'community/me', docId: 'kb-platform-account',
    name: { ar: 'حسابك وتسجيل الدخول', en: 'Your account & sign-in' },
    summary: {
      ar: 'حساب ببريد وكلمة مرور، مع تأكيد البريد، استعادة كلمة المرور، تحقق بخطوتين ومفتاح مرور بالبصمة.',
      en: 'An account with e-mail and password, e-mail confirmation, password reset, two-step verification and a passkey.',
    },
    details: {
      ar: 'تقدر تدخل بالبريد أو باسم المستخدم، وفيه «نسيت كلمة المرور» بكود على البريد، وقفل مؤقت بعد محاولات غلط، وتحقق بخطوتين (TOTP)، ومفتاح مرور بالبصمة أو الوجه، وإدارة الأجهزة وتنبيه عند أي دخول جديد. متستخدمش كلمة مرور بتاعتك من موقع تاني، ومتكتبش كلمة المرور هنا في المحادثة أبداً.',
      en: 'Sign in with e-mail or username; there is a password reset by e-mail code, a temporary lock after failed attempts, two-step verification (TOTP), a passkey with fingerprint or face, device management and a new-sign-in alert. Never reuse a password from another site and never type your password in this chat.',
    },
    keywords: ['حسابي', 'تسجيل الدخول', 'مفتاح المرور', 'مفتاح مرور', 'التحقق بخطوتين', 'passkey', 'sign in', 'my account', 'password reset'],
    tags: ['حساب', 'دخول', 'password', 'passkey', 'account'],
  },
  {
    id: 'store', group: 'shop', tab: 'store', docId: 'kb-platform-store',
    name: { ar: 'المتجر', en: 'The store' },
    summary: {
      ar: 'عطور جاهزة وزيوت ومواد خام وعبوات بأسعار ومخزون حقيقيين، بسلة وشراء مباشر وتتبّع طلب.',
      en: 'Ready perfumes, oils, raw materials and bottles with real prices and stock, plus a cart, direct purchase and order tracking.',
    },
    details: {
      ar: 'افتح تبويب المتجر وابحث بالفئة أو الاسم. فيه سلة، وزر «شراء مباشر» لمنتج واحد من غير ما تغيّر السلة، وصفحة منتج بتفاصيله وتقييماته. وجوّه المتجر «اسأل شاهين»: تحكي له اللي بتدور عليه وهو يرشّح لك من المنتجات الحقيقية بسبب لكل اختيار. السعر النهائي بيظهر في صفحة إتمام الطلب، والتتبع برقم الطلب مع الهاتف أو البريد المستخدم في الطلب.',
      en: 'Open the store tab and search by category or name. There is a cart, a “buy now” button for one product without touching the cart, and a product page with details and reviews. Inside the store, “Ask Shaheen” lets you describe what you are after and ranks real products with a reason for each pick. The final price appears at checkout, and tracking needs the reference plus the phone or e-mail used in the order.',
    },
    keywords: ['المتجر', 'المتجر الإلكتروني', 'شراء عطر', 'سلة المشتريات', 'رشحلي', 'رشح لي', 'اقترحلي', 'اقترح لي', 'ترشيح عطر', 'store', 'shopping cart', 'buy perfume', 'recommend a perfume'],
    tags: ['متجر', 'شراء', 'store', 'cart'],
  },
  {
    id: 'shipping', group: 'shop', tab: 'store', docId: 'kb-platform-shipping',
    name: { ar: 'الشحن والتوصيل', en: 'Shipping & delivery' },
    summary: {
      ar: 'الشحن بيتحسب حسب منطقة بلدك وعدد الزجاجات، والمدة التقديرية بتظهر مع الشحن في صفحة الطلب.',
      en: 'Shipping depends on your country’s zone and the number of bottles; the estimated time appears with it at checkout.',
    },
    details: {
      ar: 'العطور سائل قابل للاشتعال (UN1266 — Class 3)، فالشحن الجوي محدود وبعض الدول بتمنع أو تقيّد استيراد العطور الكحولية أو مواد معينة مثل خشب العود. الرسوم الجمركية والضرائب في بلدك مسؤولية المستلم وبتظهر بوضوح في صفحة الدفع.',
      en: 'Perfume is a flammable liquid (UN1266 — Class 3), so air shipping is limited and some countries restrict alcohol perfumes or specific materials such as agarwood. Customs duties and local taxes are the recipient’s responsibility and are shown clearly at checkout.',
    },
    keywords: ['الشحن', 'التوصيل', 'مصاريف الشحن', 'مدة الشحن', 'shipping', 'delivery', 'customs'],
    tags: ['شحن', 'توصيل', 'shipping', 'delivery'],
  },
  {
    id: 'privacy', group: 'help', docId: 'kb-privacy',
    name: { ar: 'خصوصيتك وبياناتك', en: 'Your privacy & data' },
    summary: {
      ar: 'المحادثات بتتحفظ على سيرفر شام لمتابعة الطلبات، وتقدر تعرف اللي محفوظ عنك أو تمسحه في أي وقت.',
      en: 'Conversations are kept on Sham’s server to follow up requests; you can see what is stored about you or erase it at any time.',
    },
    details: {
      ar: 'زر «ماذا تعرف عني؟» بيوريك اللي المساعد فاكره، وزر «امسح بياناتي» بيمسح المحادثات والذاكرة نهائياً (الطلبات المسجلة بأرقام SH بتفضل للمحاسبة والمتابعة). متكتبش أرقام بطاقات أو كلمات مرور في المحادثة، وفيه بانر كوكيز وتحكم كامل في المركز القانوني.',
      en: '“What do you know about me?” shows what the assistant remembers, and “erase my data” deletes conversations and memory permanently (submitted SH requests stay for accounting and follow-up). Never type card numbers or passwords in chat; a cookie banner and full controls live in the legal centre.',
    },
    keywords: ['الخصوصية', 'بياناتي', 'حذف بياناتي', 'الكوكيز', 'privacy', 'my data', 'cookies', 'gdpr'],
    tags: ['خصوصية', 'بيانات', 'privacy', 'cookies', 'gdpr'],
  },
  {
    id: 'legal', group: 'help', docId: 'kb-platform-legal',
    name: { ar: 'المركز القانوني', en: 'Legal centre' },
    summary: {
      ar: 'الشروط والأحكام وسياسة الخصوصية والإرجاع والشحن والكوكيز وإفصاح الذكاء الاصطناعي في مكان واحد.',
      en: 'Terms, privacy policy, returns, shipping, cookies and the AI disclosure all in one place.',
    },
    details: {
      ar: 'افتح «المركز القانوني» من تذييل الموقع: نظرة عامة، شروط، خصوصية، إرجاع واسترداد، شحن ومواد خطرة، كوكيز، إفصاح الذكاء الاصطناعي، وتواصل قانوني. صفحة الإرجاع بتشرح شروط الاستبدال والاسترداد للمنتجات، والتواصل القانوني بيبعت لبريد المنصة الرسمي.',
      en: 'Open the Legal Centre from the site footer: overview, terms, privacy, returns & refunds, shipping & dangerous goods, cookies, AI disclosure and legal contact. The returns page explains replacement and refund conditions, and legal contact goes to the platform’s official inbox.',
    },
    keywords: ['الشروط والأحكام', 'المركز القانوني', 'سياسة الخصوصية', 'الإرجاع والاسترداد', 'terms and conditions', 'legal centre', 'refund policy'],
    tags: ['شروط', 'قانوني', 'legal', 'terms', 'refund'],
  },
  {
    id: 'guide', group: 'help', tab: 'guide', docId: 'kb-platform-guide',
    name: { ar: 'دليل المنصة', en: 'Platform guide' },
    summary: {
      ar: 'دليل المنصة بيجمع كل أدوات وميزات شام في مكان واحد، بمكان كل واحدة وطريقة استخدامها.',
      en: 'The platform guide collects every Sham tool and feature in one place, where each one lives and how to use it.',
    },
    details: {
      ar: 'افتح تبويب «الدليل» تشوف الأقسام: أدوات المعمل والحاسبات، المكتبات والمراجع، دفتر الوصفات والخبير شاهين، المجتمع والحساب، والمتجر والشحن — وكل قسم بيوديك على تبويبه. أي أداة جديدة بتظهر هنا مع أول إصدار لها، فالدليل هو المرجع اللي تقدر تعتمد عليه.',
      en: 'Open the Guide tab to see the sections: lab tools and calculators, libraries and references, formulas and Shaheen, community and account, store and shipping — each links to its tab. Every new tool appears here in the release that ships it, so this is the reference you can rely on.',
    },
    keywords: ['دليل الموقع', 'شرح الموقع', 'قائمة الادوات', 'site guide', 'tools list'],
    tags: ['دليل', 'خريطة المنصة', 'guide', 'site map'],
  },
  {
    id: 'languages', group: 'help', docId: 'kb-platform-languages',
    name: { ar: 'اللغات', en: 'Languages' },
    summary: {
      ar: `المنصة متاحة بـ${SUPPORTED_LANGUAGES.length} لغة، ولغة الموقع هي اللي بتحدد لغة النصوص والأرقام.`,
      en: `The platform is available in ${SUPPORTED_LANGUAGES.length} languages, and the site language sets the text and the digits you see.`,
    },
    details: {
      ar: 'غيّر اللغة من زر اللغة في الهيدر أو من إعدادات البلد واللغة؛ الاتجاه بيتقلب تلقائياً للغات اللي من اليمين للشمال، والأرقام بتتكتب بأرقام لغتك. المساعد بيرد بلغة رسالتك.',
      en: 'Change the language from the header language button or the country & language settings; direction flips automatically for right-to-left languages and numbers follow your language’s digits. The assistant replies in the language of your message.',
    },
    keywords: ['اللغات', 'تغيير اللغة', 'لغة الموقع', 'languages', 'change language'],
    tags: ['لغات', 'ترجمة', 'languages', 'i18n'],
  },
];

/** The features whose knowledge is new here (the curated docs above already exist in the seed). */
const PLATFORM_DOC_PREFIX = 'kb-platform-';

export function platformFeature(id: string | undefined): PlatformFeature | undefined {
  return id ? PLATFORM_FEATURES.find((f) => f.id === id) : undefined;
}

/** The same group first (the natural next questions), then the rest — suggestions, not a menu. */
export function relatedPlatformFeatures(feature: PlatformFeature, limit = 2): PlatformFeature[] {
  const sameGroup = PLATFORM_FEATURES.filter((f) => f.id !== feature.id && f.group === feature.group);
  const others = PLATFORM_FEATURES.filter((f) => f.id !== feature.id && f.group !== feature.group);
  return [...sameGroup, ...others].slice(0, limit);
}

/** Best platform feature named in the message, or undefined. Two points is the bar, so one weak word never wins. */
export function matchPlatformFeature(message: string): { feature: PlatformFeature; score: number } | undefined {
  const text = ` ${normalize(message)} `;
  let best: { feature: PlatformFeature; score: number } | undefined;
  for (const feature of PLATFORM_FEATURES) {
    let score = 0;
    for (const keyword of feature.keywords) {
      if (!matchesKeyword(text, keyword)) continue;
      // Every keyword here is curated to be specific (never a generic word), so a single word already
      // counts; a phrase («مكتبة الكتب») is a stronger signal still.
      score += keyword.includes(' ') ? 3 : 2;
    }
    if (score >= 2 && (!best || score > best.score)) best = { feature, score };
  }
  return best;
}

/** Phrases that ask for the whole map («دليل المنصة», «إيه الجديد في المنصة؟»). */
const OVERVIEW = [
  'دليل المنصة', 'مميزات المنصة', 'أدوات المنصة', 'ادوات الموقع', 'ادوات الموقع ايه', 'كل الادوات', 'اقسام المنصة', 'خريطة المنصة', 'ايه الجديد في المنصة',
  'الجديد في المنصة', 'كل حاجة عن المنصة', 'platform guide', 'site features', 'platform features', 'what is on the site',
];

export function asksForPlatformOverview(message: string): boolean {
  const text = ` ${normalize(message)} `;
  if (OVERVIEW.some((phrase) => matchesKeyword(text, phrase))) return true;
  // «إيه الأدوات اللي في الموقع؟» / «which tools are on the site?» — tools + the whole platform.
  const asksTools = /(^|\s)ال?(ادوات|أدوات|tools?)(\s|$)/.test(text);
  const wholeSite = /(^|\s)ال?(موقع|منصه|منصة|site|platform)(\s|$)/.test(text);
  return asksTools && wholeSite;
}

/** «إزاي أستخدم …؟» — used as a follow-up chip, so tapping it routes straight back here. */
export function platformQuestion(feature: PlatformFeature, lang: 'ar' | 'en'): string {
  return lang === 'ar' ? `إزاي أستخدم ${feature.name.ar}؟` : `How do I use the ${feature.name.en}?`;
}

/** A compact map for the model prompt: what exists, where it opens and what it does (no invented facts). */
export function platformCatalog(lang: 'ar' | 'en' = 'ar'): string {
  const groups = Object.keys(PLATFORM_GROUP_LABEL) as PlatformGroup[];
  return groups
    .map((group) => {
      const lines = PLATFORM_FEATURES.filter((f) => f.group === group)
        .map((f) => `  - ${f.name[lang]}${f.tab ? ` [${f.tab}]` : ''}: ${f.summary[lang]}`)
        .join('\n');
      return `${PLATFORM_GROUP_LABEL[group][lang]}:\n${lines}`;
    })
    .join('\n');
}

/** The live shipping table (same file the storefront and the payment server use) as one prompt block. */
export function shippingBrief(lang: 'ar' | 'en' = 'ar'): string {
  const zones = [...SHIPPING.zones, SHIPPING.default]
    .map((z) => `${z.name[lang]}: ${z.firstItem} ${SHIPPING.currency} ${lang === 'ar' ? 'لأول زجاجة' : 'first bottle'} + ${z.extraItem} ${SHIPPING.currency} ${lang === 'ar' ? 'لكل زجاجة زيادة' : 'each extra bottle'}${z.days ? ` (${z.days} ${lang === 'ar' ? 'يوم تقديرياً' : 'days approx.'})` : ''}`)
    .join('; ');
  return lang === 'ar'
    ? `جدول الشحن الحالي (بالدولار، ويتحوّل لعملة الزائر في صفحة الدفع): ${zones}. العطور مواد قابلة للاشتعال UN1266 Class 3، وبعض الدول تمنع أو تقيّد الاستيراد.`
    : `Current shipping table (USD, converted to the visitor's currency at checkout): ${zones}. Perfume is flammable (UN1266 Class 3); some countries restrict imports.`;
}

/** The whole map, grouped, for the built-in answer when no AI key is configured. */
export function platformOverviewText(lang: 'ar' | 'en'): string {
  const groups = Object.keys(PLATFORM_GROUP_LABEL) as PlatformGroup[];
  const body = groups
    .map((group) => {
      const names = PLATFORM_FEATURES.filter((f) => f.group === group).map((f) => f.name[lang]).join(' · ');
      return `• ${PLATFORM_GROUP_LABEL[group][lang]}: ${names}`;
    })
    .join('\n');
  const tail = lang === 'ar'
    ? '\n\nاسألني عن أي واحدة بالاسم وأنا أشرحلك خطواتها وأفتحلك صفحتها، أو قولّي «بتقدموا خدمات ايه؟» للخدمات التجارية.'
    : '\n\nName any of them and I will explain its steps and open its page, or ask “What services do you offer?” for the commercial services.';
  return (lang === 'ar' ? 'دي خريطة منصة شام الحالية:\n' : 'This is the current map of the Sham platform:\n') + body + tail;
}

/**
 * Knowledge documents for the platform features, seeded with the rest. Existing curated docs
 * (concentration, pyramid, …) are reused, never duplicated.
 */
export function platformKnowledge(): KnowledgeDoc[] {
  const updatedAt = new Date().toISOString();
  return PLATFORM_FEATURES
    .filter((f) => f.docId.startsWith(PLATFORM_DOC_PREFIX))
    .map((f): KnowledgeDoc => ({
      id: f.docId,
      title: f.name.ar,
      // The guide documents the live map — a copy of it would go stale the day a new tool ships.
      content: f.id === 'guide' ? `كل أقسام المنصة الحالية:\n${platformOverviewText('ar')}` : `${f.summary.ar} ${f.details.ar}`,
      tags: [...f.tags, f.name.en, ...f.keywords],
      updatedAt,
    }));
}
