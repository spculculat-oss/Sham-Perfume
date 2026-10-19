/**
 * First-run defaults. Everything here is editable from the admin dashboard.
 * Commercial services start enabled but the product catalog starts EMPTY on purpose:
 * the assistant must never quote prices or stock the business has not entered.
 */
import { withShaheenDefaults } from '../config/shaheen';
import { defaultCouncil } from './council';
import type { CoreSettings, KnowledgeDoc, Product, ServiceDef } from './types';

const now = () => new Date().toISOString();

const contactNote = { name: 'notes', labelAr: 'تفاصيل إضافية', labelEn: 'Additional details', type: 'textarea' as const };

export function defaultServices(): ServiceDef[] {
  const t = now();
  return [
    {
      id: 'platform-tools', kind: 'info', order: 1, enabled: true, updatedAt: t,
      nameAr: 'أدوات المنصة والحاسبات', nameEn: 'Platform tools & calculators',
      descriptionAr: 'حاسبة التركيز، الهرم العطري، تخفيف الكحول، التكاليف، محاكي التعتيق، المكتبات والأخبار.',
      descriptionEn: 'Concentration, pyramid, alcohol dilution and costing calculators, maceration simulator, libraries and news.',
      keywords: ['حاسبه', 'حساب', 'تركيز', 'هرم', 'كحول', 'تخفيف', 'تكلفه', 'تعتيق', 'مكتبه', 'موسوعه', 'اخبار', 'calculator', 'pyramid', 'dilution', 'cost', 'maceration', 'library', 'news'],
      formFields: [],
    },
    {
      id: 'store', kind: 'store', order: 2, enabled: true, updatedAt: t,
      nameAr: 'المتجر: عطور وزيوت ومواد خام', nameEn: 'Store: perfumes, oils & raw materials',
      descriptionAr: 'شراء عطور جاهزة وزيوت عطرية ومواد خام وعبوات، مع تتبع الطلب.',
      descriptionEn: 'Buy ready perfumes, fragrance oils, raw materials and packaging, with order tracking.',
      keywords: ['شراء', 'اشتري', 'سعر', 'اسعار', 'بكام', 'متجر', 'منتج', 'زيت', 'زيوت', 'خام', 'عبوه', 'زجاجه', 'متاح', 'مخزون', 'سله', 'buy', 'price', 'shop', 'store', 'product', 'oil', 'stock', 'bottle'],
      formFields: [
        { name: 'address', labelAr: 'عنوان التوصيل', labelEn: 'Delivery address', type: 'textarea', required: true },
        { name: 'payment', labelAr: 'طريقة الدفع المفضلة', labelEn: 'Preferred payment', type: 'select', options: ['cash_on_delivery', 'bank_transfer', 'wallet'], required: true },
      ],
    },
    {
      id: 'custom-formula', kind: 'custom_order', order: 3, enabled: true, updatedAt: t,
      nameAr: 'تركيب عطر مخصص', nameEn: 'Bespoke perfume composition',
      descriptionAr: 'نصمم لك عطراً خاصاً حسب ذوقك والمناسبة والميزانية، ونرسل لك عرض سعر قبل التنفيذ.',
      descriptionEn: 'A perfume designed for your taste, occasion and budget, with a quote before production.',
      keywords: ['مخصص', 'خاص', 'تركيب', 'تركيبه', 'اصمم', 'تصميم', 'هديه', 'توقيع', 'bespoke', 'custom', 'signature', 'design', 'gift'],
      formFields: [
        { name: 'family', labelAr: 'العائلة العطرية المفضلة', labelEn: 'Preferred fragrance family', type: 'select', options: ['oriental', 'woody', 'floral', 'citrus', 'fresh', 'gourmand', 'oud', 'unsure'], required: true },
        { name: 'volume_ml', labelAr: 'الحجم (مل)', labelEn: 'Volume (ml)', type: 'number', required: true },
        { name: 'budget', labelAr: 'الميزانية التقريبية', labelEn: 'Approximate budget', type: 'text' },
        contactNote,
      ],
    },
    {
      id: 'b2b', kind: 'b2b', order: 4, enabled: true, updatedAt: t,
      nameAr: 'الجملة والتصنيع لحساب الغير (B2B)', nameEn: 'Wholesale & private label (B2B)',
      descriptionAr: 'كميات كبيرة، تصنيع بعلامتك التجارية، توريد للمحلات والمصانع، وعروض أسعار رسمية.',
      descriptionEn: 'Bulk quantities, private label manufacturing, supply for shops and factories, formal quotations.',
      keywords: ['جمله', 'كميات', 'كميه كبيره', 'مصنع', 'مصانع', 'توريد', 'علامه تجاريه', 'براند', 'شركه', 'عرض سعر', 'تعاقد', 'wholesale', 'bulk', 'b2b', 'private label', 'factory', 'supply', 'quotation', 'brand'],
      formFields: [
        { name: 'company', labelAr: 'اسم الشركة', labelEn: 'Company name', type: 'text', required: true },
        { name: 'quantity', labelAr: 'الكمية المطلوبة', labelEn: 'Required quantity', type: 'text', required: true },
        { name: 'products', labelAr: 'المنتجات المطلوبة', labelEn: 'Requested products', type: 'textarea', required: true },
        { name: 'country', labelAr: 'الدولة / المدينة', labelEn: 'Country / city', type: 'text' },
      ],
    },
    {
      id: 'consultation', kind: 'consultation', order: 5, enabled: true, updatedAt: t,
      nameAr: 'استشارة خبير عطور', nameEn: 'Perfumer consultation',
      descriptionAr: 'جلسة مع خبير لمراجعة تركيبتك أو خطة مشروعك. للاستشارة الفورية الآلية استخدم شاهين.',
      descriptionEn: 'A session with an expert to review your formula or project plan. For instant AI advice use Shaheen.',
      keywords: ['استشاره', 'خبير', 'جلسه', 'مراجعه تركيبه', 'تدريب', 'كورس', 'consultation', 'expert', 'session', 'training', 'course'],
      formFields: [
        { name: 'topic', labelAr: 'موضوع الاستشارة', labelEn: 'Topic', type: 'textarea', required: true },
        { name: 'preferred_time', labelAr: 'الوقت المناسب', labelEn: 'Preferred time', type: 'text' },
      ],
    },
    {
      id: 'support', kind: 'support', order: 6, enabled: true, updatedAt: t,
      nameAr: 'الدعم وخدمة العملاء', nameEn: 'Customer support',
      descriptionAr: 'شكاوى، استرجاع، مشاكل في الموقع أو الطلبات، والتحدث مع موظف.',
      descriptionEn: 'Complaints, returns, website or order issues, and talking to a human.',
      keywords: ['شكوي', 'مشكله', 'استرجاع', 'استبدال', 'موظف', 'بشري', 'تواصل', 'دعم', 'مساعده', 'complaint', 'problem', 'refund', 'return', 'human', 'agent', 'support', 'help', 'contact'],
      formFields: [
        { name: 'subject', labelAr: 'الموضوع', labelEn: 'Subject', type: 'text', required: true },
        { name: 'order_ref', labelAr: 'رقم الطلب (إن وجد)', labelEn: 'Order reference (if any)', type: 'text' },
        { name: 'message', labelAr: 'الرسالة', labelEn: 'Message', type: 'textarea', required: true },
      ],
    },
  ];
}

export function defaultKnowledge(): KnowledgeDoc[] {
  const t = now();
  const doc = (id: string, title: string, content: string, tags: string[], serviceId?: string): KnowledgeDoc =>
    ({ id, title, content, tags, serviceId, updatedAt: t });
  return [
    doc('kb-about', 'عن منصة صمم عطرك مع شام',
      'منصة شام لتصميم العطور تقدم حاسبات احترافية ومكتبات للمواد الخام والعطور العالمية وأخبار العطور، ومساعد شاهين المتخصص في تصميم التركيبات. يمكن حفظ التركيبات في دفتر الوصفات وطباعة بطاقة تصنيع لكل تركيبة. تضيف شام خدمات تجارية: متجر، تركيب عطور مخصصة، جملة وتصنيع لحساب الغير، واستشارات.',
      ['شام', 'منصه', 'about'], 'platform-tools'),
    doc('kb-concentration', 'حاسبة التركيز',
      'حاسبة التركيز تحسب كمية الزيت العطري والكحول والماء والمثبت حسب حجم الزجاجة ونوع التركيز. التركيزات الشائعة تقريبياً: كولونيا 2 إلى 5 بالمئة، أو دو تواليت 5 إلى 15، أو دو بارفان 15 إلى 20، بارفان أو إكستريه 20 إلى 30 بالمئة. هذه نطاقات تسويقية تقريبية وليست معياراً إلزامياً. افتح تبويب حاسبة التركيز من القائمة.',
      ['تركيز', 'حاسبه', 'edp', 'edt', 'parfum'], 'platform-tools'),
    doc('kb-pyramid', 'حاسبة الهرم العطري',
      'الهرم العطري يقسم الزيت إلى نوتات عليا تظهر أولاً وتتبخر سريعاً، ونوتات قلب، ونوتات قاعدة تدوم أطول. حاسبة الهرم توزع نسب كل نوتة من إجمالي الزيت وتتحقق أن المجموع 100 بالمئة، ويمكن نقلها لحاسبة التركيز.',
      ['هرم', 'نوتات', 'pyramid', 'notes'], 'platform-tools'),
    doc('kb-alcohol', 'حاسبة تخفيف الكحول',
      'حاسبة تخفيف الكحول تحسب كمية الماء المقطر اللازمة لتخفيف كحول بدرجة معينة إلى درجة مطلوبة. التخفيف بالحجم تقريبي بسبب انكماش خليط الكحول والماء.',
      ['كحول', 'تخفيف', 'alcohol', 'dilution'], 'platform-tools'),
    doc('kb-costing', 'حاسبة التكاليف والأرباح',
      'حاسبة التكاليف تجمع تكلفة الزيوت والكحول والعبوة والتغليف والتشغيل وتقترح سعر بيع حسب هامش الربح المطلوب وعملة بلدك.',
      ['تكلفه', 'ربح', 'تسعير', 'cost', 'pricing'], 'platform-tools'),
    doc('kb-maceration', 'التعتيق والتثبيت',
      'التعتيق أو الماسيراشن هو ترك العطر بعد الخلط فترة في مكان مظلم ومعتدل الحرارة ليتجانس. المدة تختلف حسب المواد والتركيز، وكثيراً ما تتراوح بين أسبوعين وعدة أسابيع. محاكي التعتيق ودليل المثبتات في المنصة يشرحان العوامل المؤثرة.',
      ['تعتيق', 'ماسيراشن', 'تثبيت', 'مثبت', 'maceration', 'fixative'], 'platform-tools'),
    doc('kb-safety', 'سلامة المواد العطرية',
      'سلامة أي مادة تعتمد على المادة نفسها والتركيز النهائي ونوع المنتج وشهادة المورد ومعايير IFRA المعمول بها. لا نقدم ضماناً عاماً للأمان. لا تستخدم الزيوت المركزة مباشرة على الجلد ولا تبتلعها. أسئلة الحمل والأطفال والحساسية والربو تحتاج مختصاً مؤهلاً.',
      ['سلامه', 'حساسيه', 'ifra', 'safety'], 'platform-tools'),
    doc('kb-orders', 'كيف أطلب من شام؟',
      'يمكنك الطلب من خلال مساعد شام: اختر الخدمة، املأ بيانات التواصل والتفاصيل، وستحصل على رقم طلب يبدأ بـ SH. يراجع فريق شام الطلب ويتواصل معك لتأكيد السعر النهائي والشحن والدفع. يمكنك تتبع حالة طلبك برقم الطلب مع رقم الهاتف أو البريد المستخدم في الطلب.',
      ['طلب', 'تتبع', 'شحن', 'دفع', 'order', 'tracking'], 'store'),
    doc('kb-custom', 'خطوات طلب عطر مخصص',
      'في العطر المخصص نسألك عن العائلة العطرية والمناسبة والحجم والميزانية. يرسل فريق شام عرض سعر ومقترح تركيبة، وبعد موافقتك يبدأ التحضير والتعتيق. مدة التنفيذ تتحدد في عرض السعر.',
      ['مخصص', 'عرض سعر', 'bespoke'], 'custom-formula'),
    doc('kb-b2b', 'خدمات الجملة والتصنيع لحساب الغير',
      'نستقبل طلبات الكميات الكبيرة والتصنيع بعلامتك التجارية والتوريد للمحلات. أرسل اسم الشركة والكمية والمنتجات المطلوبة وسيعد الفريق عرض سعر رسمياً. الأسعار والحد الأدنى للكميات تحدد في العرض حسب المنتج.',
      ['جمله', 'b2b', 'private label', 'توريد'], 'b2b'),
    doc('kb-privacy', 'الخصوصية وبيانات المحادثات',
      'يحفظ مساعد شام محادثات الخدمة وطلبات العملاء على خادم شام لمتابعتها من الإدارة. لا تكتب كلمات مرور أو بيانات بطاقات بنكية في المحادثة. يمكنك طلب حذف بياناتك عبر خدمة الدعم.',
      ['خصوصيه', 'بيانات', 'privacy'], 'support'),
  ];
}

export function defaultSettings(): CoreSettings & { id: string } {
  return {
    id: 'core',
    assistantNameAr: 'مساعد شام',
    assistantNameEn: 'Sham Assistant',
    welcomeAr: 'أهلاً بك في شام 👋 أنا مساعد شام للخدمات. أقدر أساعدك في الأدوات والحاسبات، الطلبات والمتجر، العطور المخصصة، الجملة، الاستشارات والدعم. تحب تبدأ بإيه؟',
    welcomeEn: 'Welcome to Sham 👋 I am the Sham services assistant. I can help with tools and calculators, store orders, bespoke perfumes, wholesale, consultations and support. Where would you like to start?',
    personaAr: 'ودود، مختصر، مهني، يتحدث بلهجة الزائر عند الإمكان، ولا يعد بأسعار أو مواعيد غير موجودة في البيانات.',
    enginePolicy: ['self_hosted', 'gemini', 'openai', 'claude', 'deepseek', 'openrouter', 'perplexity', 'sham_local'],
    temperature: 0.3,
    council: defaultCouncil(),
    shaheen: withShaheenDefaults(undefined),
    currency: 'EGP',
    handoffContact: '',
    businessHours: '',
    updatedAt: now(),
  };
}

/** Optional demo catalog, only when SHAM_SEED_DEMO=true. Marked demo so admin and visitors can tell. */
export function demoProducts(): Product[] {
  const t = now();
  const p = (id: string, sku: string, nameAr: string, nameEn: string, category: Product['category'], price: number, stock: number, unit: string, tags: string[]): Product =>
    ({ id, sku, nameAr, nameEn, category, price, currency: 'EGP', stock, unit, tags, active: true, demo: true,
      descriptionAr: `${nameAr} — منتج تجريبي لعرض المتجر`, descriptionEn: `${nameEn} — demo product`, updatedAt: t });
  return [
    p('demo-oud-oil', 'DEMO-OUD-30', 'زيت عود تجريبي', 'Demo oud oil', 'oil', 450, 12, '30ml', ['عود', 'oud', 'شرقي']),
    p('demo-rose-oil', 'DEMO-ROSE-30', 'زيت ورد تجريبي', 'Demo rose oil', 'oil', 380, 0, '30ml', ['ورد', 'rose', 'زهري']),
    p('demo-bottle', 'DEMO-BTL-50', 'زجاجة بخاخ 50 مل تجريبية', 'Demo 50ml spray bottle', 'packaging', 35, 200, 'piece', ['زجاجه', 'bottle', 'عبوه']),
  ];
}
