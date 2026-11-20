import { ISLAMIC_LIBRARY_TITLE } from '../library/islamic/entry';
import { SEO_PAGES } from '../seo/pages';
import { loc, type LText } from '../لغات/localize';
import type { SupportedLanguage } from '../types/i18n';

export type PromoVisual =
  | 'home' | 'formula' | 'analysis' | 'pyramid' | 'alcohol' | 'maceration'
  | 'costing' | 'materials' | 'library' | 'islamic_library' | 'news' | 'guide' | 'expert' | 'store'
  | 'community' | 'country' | 'privacy';

export type PlatformPromoAction =
  | { type: 'tab'; tab: string }
  | { type: 'environment-modal' }
  | { type: 'privacy-modal' };

export interface PlatformPromo {
  id: string;
  /** Actual hash route or app tab used by the navigation source. */
  tab: string;
  /** Existing static SEO URL, when this is an indexable page. */
  path?: string;
  action: PlatformPromoAction;
  tag: LText;
  title: LText;
  description: LText;
  visual: PromoVisual;
}

interface PromoCopy {
  tag: LText;
  title: LText;
  description: LText;
  visual: PromoVisual;
}

/** Short, factual ad copy for each indexable page; localized with the platform's translation packs. */
const PAGE_COPY: Record<string, PromoCopy> = {
  concentration: {
    tag: { ar: 'معمل تركيب العطور', en: 'Perfume formulation lab' },
    title: { ar: 'ركّب عطرك بحسابات واضحة', en: 'Build a fragrance with clear calculations' },
    description: { ar: 'احسب نسب الزيت والكحول والماء وفق حجم الزجاجة والتركيز الذي تختاره.', en: 'Calculate fragrance, alcohol, and water amounts for your chosen bottle size and concentration.' },
    visual: 'formula',
  },
  alcohol: {
    tag: { ar: 'أداة تخفيف الكحول', en: 'Alcohol dilution tool' },
    title: { ar: 'خفّف الكحول خطوة بخطوة', en: 'Dilute alcohol step by step' },
    description: { ar: 'أدخل التركيز والحجم المطلوبين لمعرفة كمية الماء اللازمة حسابياً.', en: 'Enter the starting strength and target volume to calculate the water amount.' },
    visual: 'alcohol',
  },
  pyramid: {
    tag: { ar: 'تنسيق النوتات', en: 'Fragrance-note structure' },
    title: { ar: 'رتّب نوتات عطرك في هرم متوازن', en: 'Arrange your notes into a fragrance pyramid' },
    description: { ar: 'استكشف نوتات القمة والقلب والقاعدة، وراجع توزيعها في تركيبتك.', en: 'Explore top, heart, and base notes, then review their distribution in your formula.' },
    visual: 'pyramid',
  },
  molecule_studio: {
    tag: { ar: 'مساحة التركيب والتحليل', en: 'Composition and analysis studio' },
    title: { ar: 'ركّب المواد، وحلّل النسب، وخطّط التحضير', en: 'Compose materials, review ratios, and plan preparation' },
    description: { ar: 'أنشئ تركيبة من المواد العطرية، أو حلّل قائمة مكونات تدخلها، ثم خطّط جدول التحضير والتعتيق.', en: 'Build a formula from fragrance materials, review a supplied ingredient list, then plan preparation and maceration.' },
    visual: 'analysis',
  },
  maceration_simulator: {
    tag: { ar: 'محاكي التعتيق', en: 'Maceration planner' },
    title: { ar: 'تابع خطة تعتيق تركيبتك', en: 'Plan and track formula maceration' },
    description: { ar: 'سجّل تاريخ البداية والمدة المتوقعة لمتابعة مراحل التحضير.', en: 'Set a start date and duration to keep track of preparation milestones.' },
    visual: 'maceration',
  },
  costing: {
    tag: { ar: 'حاسبة التكلفة', en: 'Cost calculator' },
    title: { ar: 'قدّر تكلفة مكونات كل زجاجة', en: 'Estimate ingredient cost per bottle' },
    description: { ar: 'راجع تكلفة التركيبة والعبوة من البيانات التي تدخلها، دون افتراض أسعار الموردين.', en: 'Review formula and bottle costs from the values you enter, without assuming supplier prices.' },
    visual: 'costing',
  },
  raw_materials: {
    tag: { ar: 'موسوعة الخامات', en: 'Raw materials reference' },
    title: { ar: 'اكتشف المواد الخام العطرية', en: 'Explore fragrance materials' },
    description: { ar: 'ابحث في معلومات المواد والعائلات العطرية وراجع ملاحظات السلامة المتاحة.', en: 'Search material and scent-family information, and review the available safety notes.' },
    visual: 'materials',
  },
  islamic_library: {
    tag: ISLAMIC_LIBRARY_TITLE,
    title: { ar: 'اقرأ المصحف وتصفّح كتب التراث', en: 'Read the Quran and browse classical works' },
    description: { ar: 'اقرأ المصحف بالرسم العثماني، واكتشف كتب التفسير والحديث والسيرة وروابط قراءتها عند مصادرها.', en: 'Read the Uthmani Quran and explore tafsir, hadith, and seerah editions at their sources.' },
    visual: 'islamic_library',
  },
  world_perfumes: {
    tag: { ar: 'مكتبة مرجعية تعليمية', en: 'Educational reference library' },
    title: { ar: 'استلهم من أمثلة العطور العالمية', en: 'Explore inspired fragrance studies' },
    description: { ar: 'تصفّح أمثلة تعليمية مستوحاة من النوتات المعلنة؛ وليست تركيبات أصلية مؤكدة.', en: 'Browse educational studies inspired by published notes—not verified original formulas.' },
    visual: 'library',
  },
  perfume_news: {
    tag: { ar: 'مرصد أخبار العطور', en: 'Fragrance news desk' },
    title: { ar: 'تابع أخبار صناعة العطور', en: 'Follow fragrance industry news' },
    description: { ar: 'اقرأ أحدث المواد المتاحة عن الإصدارات والاتجاهات والفعاليات العطرية.', en: 'Read available coverage of fragrance launches, trends, and industry events.' },
    visual: 'news',
  },
  guide: {
    tag: { ar: 'دليل التعتيق والمثبتات', en: 'Maceration and fixatives guide' },
    title: { ar: 'راجع إرشادات التحضير والتعتيق', en: 'Review preparation and maceration guidance' },
    description: { ar: 'تعرّف إلى خطوات التعتيق والترشيح ومعلومات المثبتات مع مراعاة تعليمات المورد والسلامة.', en: 'Review maceration, filtration, and fixative information alongside supplier and safety guidance.' },
    visual: 'guide',
  },
  library: {
    tag: { ar: 'مكتبة تركيباتك', en: 'Your formula library' },
    title: { ar: 'احفظ تركيباتك وارجع إليها', en: 'Save and revisit your formulas' },
    description: { ar: 'نظّم مسوداتك المحفوظة وافتح تفاصيلها عند متابعة العمل.', en: 'Keep saved drafts organized and reopen their details when you continue working.' },
    visual: 'library',
  },
  master_ai: {
    tag: { ar: 'استشارة الخبير شاهين', en: 'Master Shahin consultation' },
    title: { ar: 'اسأل شاهين عن تصميم العطور', en: 'Ask Shahin about fragrance design' },
    description: { ar: 'اطلب إرشاداً حول التركيب والخامات والحسابات؛ تحقّق من السلامة قبل التصنيع.', en: 'Get guidance on formulas, materials, and calculations; verify safety before production.' },
    visual: 'expert',
  },
  designer: {
    tag: { ar: 'معمل المصمم الذكي', en: 'AI designer lab' },
    title: { ar: 'صمّم عطرك مع تحليل توافق النوتات', en: 'Design a fragrance with harmony analysis' },
    description: { ar: 'جرّب نوتاتك، شوف توافقها العطري، ومحاكاة الأداء والثبات على بشرتك قبل التحضير.', en: 'Try your notes, see how they harmonise, and simulate performance and longevity before you mix.' },
    visual: 'analysis',
  },
  studio_3d: {
    tag: { ar: 'استوديو الزجاجة 3D', en: '3D flacon studio' },
    title: { ar: 'شوف زجاجتك قبل ما تتصنّع', en: 'See your flacon before it is made' },
    description: { ar: 'اعرض الزجاجة والتركيبة بمجسم ثلاثي الأبعاد يقرأ نفس بيانات تركيبتك.', en: 'View the bottle and your formula in 3D, reading the same formulation data.' },
    visual: 'analysis',
  },
  perfumer_analytics: {
    tag: { ar: 'تحليلات التركيبات', en: 'Formula analytics' },
    title: { ar: 'شوف أنماط تركيباتك بالأرقام', en: 'See the patterns in your formulas' },
    description: { ar: 'لوحة تحليل تركيبباتك المحفوظة: العائلات، توزيع النوتات، وأكثر الخامات استخدامًا.', en: 'A dashboard over your saved formulas: families, note distribution and most-used materials.' },
    visual: 'analysis',
  },
  perfume_atlas: {
    tag: { ar: 'أطلس العطور', en: 'Fragrance atlas' },
    title: { ar: 'اتنقّل بين مناطق العطور في العالم', en: 'Travel the world of perfume regions' },
    description: { ar: 'خريطة تعليمية لبلاد العطور ومحاصيلها وخاماتها الشهيرة.', en: 'An educational map of perfumery regions, their crops and signature materials.' },
    visual: 'library',
  },
  perfumer_game: {
    tag: { ar: 'تحدي المزج', en: 'Blending challenge' },
    title: { ar: 'اختبر حسّك العطري في تحدي سريع', en: 'Test your nose in a quick challenge' },
    description: { ar: 'لعبة مزج قصيرة تتدرّب فيها على موازنة النوتات قبل التركيب الحقيقي.', en: 'A short blending game that trains note balance before the real mix.' },
    visual: 'pyramid',
  },
  studio_voice: {
    tag: { ar: 'استوديو الصوت', en: 'Voice studio' },
    title: { ar: 'سجّل بصوتك واسمع عطرك', en: 'Record by voice, hear your fragrance' },
    description: { ar: 'تحويل التسجيل لنص، موسيقى مستوحاة من نوتات عطرك، وصوت بشري يقرا ما تكتبه.', en: 'Turn a recording into text, hear music inspired by your notes, and have your words read in a human voice.' },
    visual: 'analysis',
  },
  store: {
    tag: { ar: 'متجر شام', en: 'Sham fragrance shop' },
    title: { ar: 'تصفّح العطور المتاحة وأسعارها', en: 'Browse available fragrances and prices' },
    description: { ar: 'استكشف منتجات المتجر، راجع حالة التوفر والسعر، واختر ما يناسبك.', en: 'Explore store products, check availability and prices, and find a fragrance that suits you.' },
    visual: 'store',
  },
};

const makeTabPromo = (id: string, tab: string, copy: PromoCopy, path?: string): PlatformPromo => ({
  id,
  tab,
  path,
  action: { type: 'tab', tab },
  ...copy,
});

const HOME_PROMO = makeTabPromo('home', 'home', {
  tag: { ar: 'منصة صمم عطرك مع شام', en: 'Design your perfume with Sham' },
  title: { ar: 'مساحة واحدة لتصميم عطرك ومتابعته', en: 'One place to design and refine your fragrance' },
  description: { ar: 'انتقل بين أدوات التركيب والتحليل والمعرفة والمتجر من بوابة واحدة.', en: 'Move between formulation, analysis, reference tools, and the shop from one hub.' },
  visual: 'home',
});

/** Existing app pages that do not have a dedicated, indexable SEO route. */
const ADDITIONAL_PAGE_PROMOS: PlatformPromo[] = [
  // «جديد من جوجل استوديو»: the designer lab and the 3D flacon studio get their own promotion like every page.
  makeTabPromo('designer', 'designer', PAGE_COPY.designer),
  makeTabPromo('perfumer_analytics', 'perfumer_analytics', PAGE_COPY.perfumer_analytics),
  makeTabPromo('perfume_atlas', 'perfume_atlas', PAGE_COPY.perfume_atlas),
  makeTabPromo('perfumer_game', 'perfumer_game', PAGE_COPY.perfumer_game),
  makeTabPromo('studio_voice', 'studio_voice', PAGE_COPY.studio_voice),
  makeTabPromo('studio_3d', 'studio_3d', PAGE_COPY.studio_3d),
  makeTabPromo('workspace', 'workspace', {
    tag: { ar: 'مساحة شاهين · مساعد عام', en: "Shaheen's workspace · general assistant" },
    title: { ar: 'أنجز مهامك في مساحة شاهين', en: 'Get work done in Shaheen’s workspace' },
    description: { ar: 'اطلب المساعدة في الأسئلة والملفات والبحوث، وأنتج مخرجات تناسب مهمتك.', en: 'Get help with questions, files, and research, then create outputs tailored to your task.' },
    visual: 'expert',
  }),
  makeTabPromo('project_studio', 'studio', {
    tag: { ar: 'استوديو المشاريع', en: 'Project Studio' },
    title: { ar: 'نظّم مشاريعك وتركيباتك', en: 'Organize your projects and formulas' },
    description: { ar: 'احفظ مسوداتك، أدر نسخ التركيبة، وتابع عملك من مساحة المشاريع.', en: 'Save drafts, manage formula versions, and continue your work from the project space.' },
    visual: 'formula',
  }),
  makeTabPromo('cosmetics', 'cosmetics', {
    tag: { ar: 'مختبر مستحضرات التجميل', en: 'Cosmetics formulator' },
    title: { ar: 'طوّر تركيبات العناية ومستحضرات التجميل', en: 'Develop cosmetic and personal-care formulas' },
    description: { ar: 'استكشف أدوات تركيب المستحضرات ومكتبتها ومعلوماتها العلمية.', en: 'Explore cosmetic formulation tools, the product library, and supporting science.' },
    visual: 'materials',
  }),
  makeTabPromo('perfume_designers', 'perfume_designers', {
    tag: { ar: 'استوديو مصمم العطور', en: 'Perfume designer studio' },
    title: { ar: 'صمّم تركيبة عطر وراجع توازنها', en: 'Design a perfume and review its balance' },
    description: { ar: 'ابنِ تركيبتك، افحص توزيع النوتات، واحفظ نسخ التصميم.', en: 'Build a formula, review its note balance, and save design versions.' },
    visual: 'formula',
  }),
  makeTabPromo('cosmetic_designers', 'cosmetic_designers', {
    tag: { ar: 'استوديو مصمم مستحضرات التجميل', en: 'Cosmetics designer studio' },
    title: { ar: 'صمّم تركيبات العناية وسجّل نسخها', en: 'Design personal-care formulas and track revisions' },
    description: { ar: 'أنشئ مسودات للمستحضرات وراجع المكونات والتوافق المتاح.', en: 'Create cosmetic drafts and review ingredients and available compatibility checks.' },
    visual: 'materials',
  }),
  makeTabPromo('perfumes', 'perfumes', {
    tag: { ar: 'بوابة العطور', en: 'Perfume hub' },
    title: { ar: 'استكشف أدوات ومراجع صناعة العطور', en: 'Explore perfume-making tools and references' },
    description: { ar: 'انتقل إلى بوابة العطور للوصول إلى أدوات التركيب ومصادر التعلّم.', en: 'Visit the perfume hub for formulation tools and learning resources.' },
    visual: 'home',
  }),
];

const COMMUNITY_PROMOS: PlatformPromo[] = [
  makeTabPromo('community_menu', 'community/menu', {
    tag: { ar: 'دليل مجتمع شام', en: 'Sham Community directory' },
    title: { ar: 'اكتشف أقسام وأعضاء المجتمع', en: 'Explore community sections and members' },
    description: { ar: 'افتح دليل المجتمع للعثور على الأعضاء والأقسام المتاحة.', en: 'Open the community directory to find members and available sections.' },
    visual: 'community',
  }),
  makeTabPromo('community', 'community', {
    tag: { ar: 'مجتمع شام · ملتقى صناع العطور', en: 'Sham community · Perfumers’ hub' },
    title: { ar: 'تبادل الخبرة مع مجتمع العطور', en: 'Connect with the fragrance community' },
    description: { ar: 'انضم إلى مساحة النقاش والتعلّم ومشاركة التجارب العطرية.', en: 'Join a space for discussion, learning, and sharing fragrance experiences.' },
    visual: 'community',
  }),
  makeTabPromo('community_discussions', 'community/discussions', {
    tag: { ar: 'مجلس النقاش', en: 'Community discussions' },
    title: { ar: 'ناقش أفكار العطور مع صناعها', en: 'Discuss fragrance ideas with fellow makers' },
    description: { ar: 'افتح مجلس المجتمع للاطلاع على النقاشات والحوارات العطرية.', en: 'Visit the community discussions for conversations about fragrance.' },
    visual: 'community',
  }),
  makeTabPromo('community_news', 'community/news', {
    tag: { ar: 'أخبار مجتمع شام', en: 'Community fragrance news' },
    title: { ar: 'تابع الأخبار من داخل المجتمع', en: 'Follow fragrance news in the community' },
    description: { ar: 'اكتشف صفحة الأخبار والمواد الدورية في ملتقى شام.', en: 'Explore the community’s fragrance news and periodic coverage.' },
    visual: 'news',
  }),
  makeTabPromo('community_friends', 'community/friends', {
    tag: { ar: 'أصدقاء العطور', en: 'Fragrance friends' },
    title: { ar: 'تواصل مع أعضاء مجتمع العطور', en: 'Connect with fragrance community members' },
    description: { ar: 'افتح قسم الأصدقاء وطلبات التواصل داخل مجتمع شام.', en: 'Visit the friends and connection requests area in Sham Community.' },
    visual: 'community',
  }),
  makeTabPromo('community_messenger', 'community/messenger', {
    tag: { ar: 'مراسلة مجتمع شام', en: 'Sham Community messenger' },
    title: { ar: 'واصل الحوار عبر المراسلات', en: 'Continue the conversation in messenger' },
    description: { ar: 'افتح المراسلات لمتابعة المحادثات المباشرة مع الأعضاء.', en: 'Open messenger to continue direct conversations with members.' },
    visual: 'community',
  }),
  makeTabPromo('community_mail', 'community/mail', {
    tag: { ar: 'بريد شام', en: 'Sham Mail' },
    title: { ar: 'راجع بريدك ورسائلك المجتمعية', en: 'Check your community mailbox' },
    description: { ar: 'انتقل إلى مساحة البريد لمتابعة الرسائل الواردة والصادرة.', en: 'Visit the mailbox to manage incoming and sent messages.' },
    visual: 'community',
  }),
  makeTabPromo('community_notifications', 'community/notifications', {
    tag: { ar: 'إشعارات المجتمع', en: 'Community notifications' },
    title: { ar: 'تابع جديد نشاطك في مجتمع شام', en: 'Keep up with your Sham Community activity' },
    description: { ar: 'اطّلع على الإشعارات والتنبيهات المرتبطة بنشاطك.', en: 'Review notifications and updates related to your activity.' },
    visual: 'community',
  }),
  makeTabPromo('community_member_portal', 'community/me', {
    tag: { ar: 'بوابتك في مجتمع شام', en: 'Your Sham Community portal' },
    title: { ar: 'افتح مساحتك وبيانات عضويتك', en: 'Open your member space and profile' },
    description: { ar: 'راجع بوابتك الشخصية وإعدادات العضوية داخل المجتمع.', en: 'Visit your personal portal and membership settings in the community.' },
    visual: 'community',
  }),
  makeTabPromo('community_merchant_portal', 'community/merchant', {
    tag: { ar: 'بوابة التجار', en: 'Merchant portal' },
    title: { ar: 'أدر حضورك التجاري في مجتمع شام', en: 'Manage your merchant presence in Sham Community' },
    description: { ar: 'انتقل إلى مساحة التجار وأدوات إدارة النشاط التجاري المتاحة.', en: 'Visit the merchant area and its available business-management tools.' },
    visual: 'community',
  }),
  makeTabPromo('community_stores', 'community/stores', {
    tag: { ar: 'سوق التجار', en: 'Merchants’ market' },
    title: { ar: 'استكشف متاجر أعضاء المجتمع', en: 'Explore community member stores' },
    description: { ar: 'تصفّح دليل المتاجر وصفحات البائعين ضمن مجتمع شام.', en: 'Browse the store directory and seller pages in Sham Community.' },
    visual: 'store',
  }),
];

const SPECIAL_PROMOS: PlatformPromo[] = [
  {
    id: 'country_settings',
    tab: 'country_modal',
    action: { type: 'environment-modal' },
    tag: { ar: 'إعدادات البلد والبيئة', en: 'Country and environment settings' },
    title: { ar: 'اضبط بلد المعمل وبيئته', en: 'Set your lab country and environment' },
    description: { ar: 'راجع إعدادات البلد والعملة والبيئة من نافذة المعمل الحالية.', en: 'Review the country, currency, and environment settings in the lab controls.' },
    visual: 'country',
  },
  {
    id: 'privacy_settings',
    tab: 'privacy_modal',
    action: { type: 'privacy-modal' },
    tag: { ar: 'الخصوصية وإدارة البيانات', en: 'Privacy and data controls' },
    title: { ar: 'راجع خيارات الخصوصية والبيانات', en: 'Review privacy and data options' },
    description: { ar: 'افتح مركز الخصوصية لإدارة الخيارات والبيانات المرتبطة بحسابك.', en: 'Open the privacy center to manage options and data associated with your account.' },
    visual: 'privacy',
  },
];

const missingCopy = SEO_PAGES.filter((page) => !PAGE_COPY[page.tab]);
if (missingCopy.length) throw new Error(`Missing cinematic promo copy for SEO pages: ${missingCopy.map((page) => page.tab).join(', ')}`);

/**
 * Full navigation inventory: home, every SEO-backed page, non-SEO app pages, actual community navigation
 * sections, and the two settings portals HomeHub opens as modals. Dynamic product detail pages remain
 * promoted by the existing live product carousel, whose cards link to each product's own page.
 */
export const PLATFORM_PROMOS: PlatformPromo[] = [
  HOME_PROMO,
  ...SEO_PAGES.map((page) => makeTabPromo(page.id, page.tab, PAGE_COPY[page.tab], page.path)),
  ...ADDITIONAL_PAGE_PROMOS,
  ...COMMUNITY_PROMOS,
  ...SPECIAL_PROMOS,
];

export interface LocalizedPlatformPromo extends Omit<PlatformPromo, 'tag' | 'title' | 'description'> {
  tag: string;
  title: string;
  description: string;
}

export const PLATFORM_PROMO_UI = {
  discover: { ar: 'اكتشف القسم', en: 'Explore this section' },
  pageSpotlight: { ar: 'منصة شام · قسم مميز', en: 'SHAM PLATFORM · FEATURED SECTION' },
} satisfies Record<string, LText>;

export function localizedPlatformPromos(lang: SupportedLanguage): LocalizedPlatformPromo[] {
  return PLATFORM_PROMOS.map((promo) => ({
    ...promo,
    tag: loc(lang, promo.tag),
    title: loc(lang, promo.title),
    description: loc(lang, promo.description),
  }));
}
