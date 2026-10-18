/**
 * منهجية SEO التي يدرسها «منارة شاهين» — 24 درساً عملياً، درس واحد كل دورة (كل 6 ساعات)، ثم
 * يعيد دراسة الدرس المرتبط بأضعف منطقة في فحص الموقع. المنهج مبني على الوثائق الرسمية والآراء
 * المتقنة (Google Search Central، Bing Webmaster Guidelines، schema.org، web.dev Core Web Vitals،
 * IndexNow) ومطبَّق على منصة عطور عربية، لا على نظريات عامة.
 */
export type SeoArea = 'crawl' | 'indexing' | 'titles' | 'content' | 'schema' | 'performance' | 'mobile' | 'international' | 'trust' | 'ai-search' | 'authority' | 'analytics';

export interface SeoLesson {
  id: string;
  area: SeoArea;
  titleAr: string;
  objectiveAr: string;
  whyAr: string;
  checklistAr: string[];
  /** تطبيق محدد على منصة شام (يكتبه المنهج، ويطوره الوكيل بعد الدراسة). */
  applyAr: string;
  /** مصادر رسمية للمنهجية. */
  sources: string[];
}

export const SEO_AREAS: Record<SeoArea, { labelAr: string }> = {
  crawl: { labelAr: 'الزحف والوصول' },
  indexing: { labelAr: 'الفهرسة وخريطة الموقع' },
  titles: { labelAr: 'العناوين والأوصاف' },
  content: { labelAr: 'المحتوى ونية البحث' },
  schema: { labelAr: 'البيانات المنظمة' },
  performance: { labelAr: 'سرعة الصفحة وتجربة المستخدم' },
  mobile: { labelAr: 'الهاتف وسهولة الاستخدام' },
  international: { labelAr: 'تعدد اللغات' },
  trust: { labelAr: 'الثقة والتميز E-E-A-T' },
  'ai-search': { labelAr: 'الظهور في إجابات الذكاء الاصطناعي' },
  authority: { labelAr: 'السلطة والعلاقات العامة' },
  analytics: { labelAr: 'القياس والتعلّم' },
};

export const SEO_CURRICULUM: SeoLesson[] = [
  {
    id: 'seo-01',
    area: 'crawl',
    titleAr: 'كيف يزحف Googlebot ويصل إلى صفحاتك',
    objectiveAr: 'فهم دورة الزحف: الاكتشاف، الجدولة، الزحف، ثم التمرير للفهرسة، وتحديد ما يمنع كل خطوة.',
    whyAr: 'لا ترتيب لصفحة لم يزحف إليها محرك البحث. ملف robots وحالة الصفحة والروابط الداخلية تحدد ما يراه المحرك فعلاً.',
    checklistAr: [
      'اختبر robots.txt: لا يمنع الصفحات المهمة ولا يمنع ملفات الموقع أو الصور.',
      'تأكد أن صفحات الأدوات والمنتجات تُخدم بحالة 200 وليست معتمدة على JavaScript فقط.',
      'راجع الروابط الداخلية: كل صفحة مهمة يجب أن تصل إليها من الصفحة الرئيسية أو خريطة الموقع.',
      'تجنب صفحات مكررة أو نصوص لا نهائية أو معاملات بحث قابلة للفهرسة.',
    ],
    applyAr: 'خريطة شام ثابتة: الصفحة الرئيسية + صفحات الأدوات الثابتة + صفحات المنتجات + صفحة المتجر. ملف robots يسمح بها ويشير إلى خريطة الموقع.',
    sources: ['Google Search Central — Crawling and indexing', 'Bing Webmaster Guidelines — Crawl'],
  },
  {
    id: 'seo-02',
    area: 'indexing',
    titleAr: 'خريطة الموقع والفهرسة السريعة',
    objectiveAr: 'بناء sitemap صحيحة، والتأكد من تضمين كل صفحة قابلة للفهرسة، وإرسالها لمسارات المحركات الصحيحة.',
    whyAr: 'خريطة الموقع ليست ضماناً للفهرسة، لكنها أفضل إشارة للاكتشاف، خصوصاً مع صفحات المنتجات المتغيرة.',
    checklistAr: [
      'XML صالح، روابط مطلقة https، وعدد أقل من 50,000 رابط لكل ملف.',
      'lastmod حقيقية وليست تتغير في كل طلب بدون تغيّر المحتوى.',
      'الخريطة مدرجة في robots.txt، ومسجلة في Search Console وBing Webmaster.',
      'الصفحات المهمة فقط: لا صفحات خطأ ولا نتائج بحث ولا صفحات محجوبة.',
    ],
    applyAr: 'خريطة واحدة تُبنى عند كل نشر وتشمل الأدوات والمنتجات، ويرسلها الوكيل عبر IndexNow، وتُسجَّل في Search Console عند ربط حساب الخدمة.',
    sources: ['Google Search Central — Sitemaps', 'IndexNow protocol'],
  },
  {
    id: 'seo-03',
    area: 'titles',
    titleAr: 'كتابة عنوان الصفحة الذي يصمد في النتائج',
    objectiveAr: 'صياغة عنوان 50–60 حرفاً يصف الصفحة بدقة، يبدأ بالكلمة المفتاحية الأساسية، ويختلف عن عناوين الصفحات الأخرى.',
    whyAr: 'العنوان هو أول إشارة للمستخدم والمحرك. Google يعيد صياغة 76% من العناوين تقريباً، وأكثر الأسباب طول أو حشو أو تضارب مع H1.',
    checklistAr: [
      'عنوان فريد لكل صفحة، يبدأ بالمقصود لا باسم الموقع.',
      'طول 50–60 حرفاً وعدم تكرار الكلمة المفتاحية.',
      'تطابق موضوعي بين العنوان وH1 ومحتوى الصفحة.',
      'لا وعود مطلقة (الأفضل/الأول) ولا أرقام غير موثقة.',
    ],
    applyAr: 'الوكيل يقترح عنواناً لكل صفحة أداة، ويفحصه آلياً قبل اعتماده، ويسجّل قبل/بعد في سجل التغييرات.',
    sources: ['Google Search Central — Influencing title links'],
  },
  {
    id: 'seo-04',
    area: 'titles',
    titleAr: 'وصف التعريف الذي يرفع النقرات',
    objectiveAr: 'كتابة وصف 120–160 حرفاً يشرح الفائدة بدقة ويحفز النقر دون مبالغة.',
    whyAr: 'الوصف ليس عامل ترتيب مباشراً، لكنه يحدد نسبة النقر، وهي إشارة سلوكية وقيمة حقيقية للزائر.',
    checklistAr: [
      'يشرح ما سيجده الزائر ولماذا هو مفيد.',
      'يحتوي الكلمة المفتاحية مرة طبيعية.',
      'لا يكرر العنوان حرفياً ولا يحتوي ادعاءات.',
      'فريد لكل صفحة، ويحتوي الدعوة إلى الإجراء عند المناسبة.',
    ],
    applyAr: 'الوكيل يختار وصفاً عملياً لكل أداة أو منتج، ويقارن الطول بالمعايير قبل النشر.',
    sources: ['Google Search Central — Snippets'],
  },
  {
    id: 'seo-05',
    area: 'content',
    titleAr: 'فهم نية البحث قبل كتابة أي حرف',
    objectiveAr: 'تصنيف الكلمات إلى معلوماتية وتجارية وشرائية وملاحية، ومطابقة الصفحة لنيتها.',
    whyAr: 'صفحة تبيع عطراً لا تُرتَّب لسؤال «كيف أعتق العطر؟». النية تحدد الشكل والمحتوى.',
    checklistAr: [
      'حدد نية كل صفحة والاستعلامات التي تخدمها.',
      'لا تخلط دليل تعليمي مع صفحة بيع في وعاء واحد.',
      'اجعل الدعوة إلى الإجراء مناسبة للمرحلة: تعلم أولاً، ثم اشترِ.',
      'راجع استعلامات Search Console لاحقاً لتأكيد النية.',
    ],
    applyAr: 'صفحات الأدوات معلوماتية/عملية، صفحة المتجر شرائية، والصفحة الرئيسية ملاحية مع مدخل واضح لكل مسار.',
    sources: ['Google Search Quality Rater Guidelines — Needs & intent', 'Bing Webmaster Guidelines — Content'],
  },
  {
    id: 'seo-06',
    area: 'content',
    titleAr: 'التميز E-E-A-T في مجال العطور',
    objectiveAr: 'إظهار الخبرة والتجربة والسلطة والثقة في محتوى العطور، دون شهادات أو أرقام مختلقة.',
    whyAr: 'العطور مجال يمس الجلد والصحة والميزانية؛ الصفحات الغامضة أو المبالغة تُستبعد. الثقة عنوانك الحقيقي.',
    checklistAr: [
      'اذكر من كتب المحتوى ومن راجعه ومصدر المعلومة.',
      'اشرح المنهجية والقيود بدلاً من الوعود المطلقة.',
      'حافظ على اتساق الاسم والنبذة وجهة الاتصال.',
      'امتنع عن الآراء الطبية أو ادعاءات السلامة القاطعة.',
    ],
    applyAr: 'كل صفحة أداة تنسب الشرح إلى الخبير شاهين وتوضح أن الحسابات إرشادية والاختبار على الجلد هو المرجع.',
    sources: ['Google Search Quality Rater Guidelines', 'Google Search Central — Helpful content'],
  },
  {
    id: 'seo-07',
    area: 'content',
    titleAr: 'بنية الصفحة: H1 ثم H2 ثم الفقرات',
    objectiveAr: 'بناء تسلسل عناوين يسهّل القراءة والزحف، مع فقرة أولى تجيب مباشرة.',
    whyAr: 'المحرك والمستخدم يقرآن البنية قبل التفاصيل. H1 واحد وفقرات قصيرة يزيدان الفهم والبقاء.',
    checklistAr: [
      'H1 واحد فقط يطابق موضوع الصفحة.',
      'H2 لكل قسم، H3 للتفاصيل، دون تخطي المستويات.',
      'فقرة أولى من 40–70 كلمة تجيب السؤال الأساسي.',
      'قوائم وخطوات حيث تفيد، لا جدران نص.',
    ],
    applyAr: 'صفحات الأدوات تبدأ بجواب مباشر ثم خطوات مرقمة ثم أسئلة شائعة، وتُبنى آلياً عند النشر.',
    sources: ['MDN — Heading elements', 'Google Search Central — Content structure'],
  },
  {
    id: 'seo-08',
    area: 'content',
    titleAr: 'المحتوى الرقيق والتكرار بين الصفحات',
    objectiveAr: 'ضمان محتوى أصلي مفيد في كل صفحة قابلة للفهرسة، وحل التكرار قبل أن يحلّه المحرك.',
    whyAr: 'صفحات المنتجات المتشابهة أو الصفحات الفارغة تستهلك الزحف وتُضعف الإشارات. الجودة أهم من العدد.',
    checklistAr: [
      'حد أدنى عملي للمحتوى الفريد (دليل + خطوات + أسئلة) لكل صفحة أداة.',
      'أوصاف منتجات فريدة لا قوالب مكررة.',
      'canonical صحيح للنسخ المطابقة، وحذف أو دمج الصفحات بلا قيمة.',
      'لا صفحات وسوم أو ترقيم بلا محتوى مميز مفهرس.',
    ],
    applyAr: 'الوكيل يرصد الصفحات الأقصر من 300 كلمة أو المتشابهة العناوين، ويقترح دمجاً أو توسيعاً بدلاً من إنشاء صفحات جديدة.',
    sources: ['Google Search Central — Duplicate content', 'Bing Webmaster Guidelines — Content quality'],
  },
  {
    id: 'seo-09',
    area: 'schema',
    titleAr: 'البيانات المنظمة: لغة تفهمها المحركات',
    objectiveAr: 'استخدام JSON-LD الصحيح لأنواع الصفحات، دون بيانات وهمية.',
    whyAr: 'البيانات المنظمة تساعد المحرك على فهم الكيان والمنتج والأسئلة، وقد تُحسّن طريقة العرض والنقر.',
    checklistAr: [
      'Organization وWebSite في الصفحة الرئيسية.',
      'Product مع Offer وpriceCurrency وavailability في صفحة المنتج.',
      'FAQPage فقط للأسئلة الظاهرة فعلاً في الصفحة.',
      'BreadcrumbList لكل صفحة داخلية، وWebApplication للأدوات.',
      'تحقق من صحة JSON عند كل نشر.',
    ],
    applyAr: 'مولّد الصفحات يضيف Product وFAQPage وBreadcrumbList وWebApplication تلقائياً من بيانات حقيقية فقط.',
    sources: ['schema.org', 'Google Search Central — Structured data'],
  },
  {
    id: 'seo-10',
    area: 'schema',
    titleAr: 'أخطاء البيانات المنظمة الشائعة',
    objectiveAr: 'اكتشاف الحقول الناقصة، الأنواع الخاطئة، والتقييمات المزيفة.',
    whyAr: 'بيانات منظمة خاطئة أسوأ من غيابها: قد تُلغي الميزة أو تُسبب إجراءً يدوياً.',
    checklistAr: [
      'كل Offer يحتوي السعر والعملة والتوفر.',
      'لا aggregateRating بدون مراجعات حقيقية معروضة.',
      'كل Q/A في FAQPage موجود نصاً في الصفحة.',
      'لا حشو أنواع غير ذات صلة لصفحة واحدة.',
    ],
    applyAr: 'مراجعة آلية قبل النشر: إذا غاب السعر أو العملة في المنتج يُسقط العرض المنظم بدلاً من نشره ناقصاً.',
    sources: ['Google Search Central — Structured data policies'],
  },
  {
    id: 'seo-11',
    area: 'performance',
    titleAr: 'Core Web Vitals: LCP وINP وCLS',
    objectiveAr: 'فهم المؤشرات الثلاثة وأثرها على تجربة الزائر، وكيفية قراءتها من تقارير حقيقية.',
    whyAr: 'التجربة ليست عامل ترتيب سحرياً، لكنها تؤثر في البقاء والتحويل، وتظهر في تقارير تجربة الصفحة.',
    checklistAr: [
      'LCP تحت 2.5 ثانية، INP تحت 200 مللي، CLS أقل من 0.1 في الميدان.',
      'لا صور كبيرة بلا أبعاد أو lazy loading خارج الشاشة الأولى.',
      'تقليل JavaScript غير الضروري في المسار الحرج.',
      'صدّر خطوطاً وحسّنها بدل تحميل عائلات كاملة.',
    ],
    applyAr: 'الوكيل يقيس زمن استجابة الصفحة الرئيسية وحجم HTML، ويسجل المناطق التي تحتاج تحسيناً في تقريره، دون تغيير كود الواجهة.',
    sources: ['web.dev — Core Web Vitals', 'Google Search Central — Page experience'],
  },
  {
    id: 'seo-12',
    area: 'performance',
    titleAr: 'الصور وسرعة العرض',
    objectiveAr: 'تحسين الصور لسرعة أعلى وجودة كافية، مع نص بديل يخدم الوصول.',
    whyAr: 'الصور غالباً أكبر عنصر في الصفحة، وهي أيضاً مدخل بحث بالصور.',
    checklistAr: [
      'WebP/AVIF عند الإمكان، وأحجام مناسبة للعرض الفعلي.',
      'width وheight لتقليل التحول التراكمي CLS.',
      'نص alt وصفي للصور المؤثرة، وفارغ للصور الزخرفية.',
      'أسماء ملفات معبرة للصور المهمة.',
    ],
    applyAr: 'صفحات المنتجات والصور المصغرة تحمل alt ونسب أبعاد؛ الوكيل يرصد الصور بلا alt أو المكسورة.',
    sources: ['web.dev — Image optimization', 'Google Search Central — Image SEO'],
  },
  {
    id: 'seo-13',
    area: 'mobile',
    titleAr: 'الفهرسة من الهاتف أولاً',
    objectiveAr: 'التأكد من أن كل المحتوى والروابط والبيانات تظهر على الهاتف كما على الحاسوب.',
    whyAr: 'Google يفهرس النسخة المحمولة أولاً. محتوى مخفي على الهاتف قد لا يُفهرس.',
    checklistAr: [
      'viewport صحيح وسهولة لمس دون تصغير.',
      'لا محتوى أساسي يظهر على الحاسوب فقط.',
      'لا نصوص أسطر مقطوعة أو أزرار متلاصقة.',
      'اختبر على شاشة صغيرة قبل النشر.',
    ],
    applyAr: 'صفحات الأدوات الثابتة متجاوبة وتضع CTA كبيراً للهاتف، والاختبار الآلي يتحقق من وجود viewport.',
    sources: ['Google Search Central — Mobile-first indexing'],
  },
  {
    id: 'seo-14',
    area: 'international',
    titleAr: 'تعدد اللغات وhreflang',
    objectiveAr: 'تعريف المحرك بلغات الصفحة ونسخها، مع تجنب الإشارات المتضاربة.',
    whyAr: 'شام يخدم أكثر من 100 لغة في الواجهة. إشارات اللغة الخاطئة تربك الفهرسة وتُظهر الصفحة لجمهور غير مناسب.',
    checklistAr: [
      'lang وdir على عنصر html صحيحان.',
      'hreflang متبادل، أو x-default فقط عندما تخدم لغة واحدة نفس URL.',
      'لا canonical يشير إلى نسخة بلغة مختلفة دون بديل.',
      'لا استخدام ترجمة آلية غير مراجعة كمحتوى مفهرس.',
    ],
    applyAr: 'المحتوى الثابت عربي مع x-default على نفس العنوان؛ واجهة الترجمة تُستخدم داخل التطبيق ولا تدّعي نسخاً مفهرسة متعددة.',
    sources: ['Google Search Central — Localized versions', 'Google Search Central — hreflang'],
  },
  {
    id: 'seo-15',
    area: 'trust',
    titleAr: 'الصفحات التي تبني الثقة: من نحن، الاتصال، الخصوصية',
    objectiveAr: 'توفير معلومات واضحة عن الجهة والخصوصية وطرق التواصل، وربطها من كل صفحة.',
    whyAr: 'الثقة تُبنى قبل الشراء. غياب هوية واضحة وسياسة خصوصية يخفض الثقة والتحويل.',
    checklistAr: [
      'هوية المنصة واضحة في التذييل وكل صفحة.',
      'سياسة خصوصية وشروط استخدام منشورة.',
      'قناة تواصل حقيقية ومتاحة.',
      'روابط داخلية لا تتعارض مع محتوى الصفحة.',
    ],
    applyAr: 'تذييل الصفحات الثابتة يعرض اسم شام وروابط السياسات والتواصل، دون اختراع بيانات اتصال.',
    sources: ['Google Search Quality Rater Guidelines — Reputation', 'Bing Webmaster Guidelines — Trust'],
  },
  {
    id: 'seo-16',
    area: 'trust',
    titleAr: 'الروابط الخارجية والاقتباسات',
    objectiveAr: 'الاستشهاد بالمصادر الموثوقة، وتجنب المزارع والروابط المدفوعة.',
    whyAr: 'الاقتباس الجيد يدعم الثقة، والروابط السيئة تفسد السمعة. لا حيلة تُغني عن محتوى صحيح.',
    checklistAr: [
      'أضف مصدراً رسمياً عند ذكر معلومة تنظيمية أو صحية.',
      'لا روابط مدفوعة تمر كتحرير، ولا مبادلة روابط آلياً.',
      'استخدم nofollow/sponsored عند الروابط التجارية المدفوعة.',
      'راجع الروابط المكسورة دورياً.',
    ],
    applyAr: 'الوكيل لا ينشئ حملات روابط؛ يكتفي بالمحتوى والبيانات ويقترح أفكار علاقات عامة صادقة في تقرير المندوب.',
    sources: ['Google Search Essentials — Spam policies', 'Google Search Central — Link spam'],
  },
  {
    id: 'seo-17',
    area: 'ai-search',
    titleAr: 'الظهور في إجابات البحث الذكية',
    objectiveAr: 'فهم كيف تقرأ المساعدات البحثية المحتوى، وكيف يخدم llms.txt والبنية الواضحة هذا الظهور.',
    whyAr: 'البحث يتوزع بين محركات تقليدية ومساعدات تلخص. الفهم والوضوح والمصدر الواضح تصبح أهم.',
    checklistAr: [
      'محتوى حقيقي مفهوم بلا JavaScript (HTML ثابت).',
      'إجابة مباشرة في أعلى الصفحة، ثم تفاصيل.',
      'llms.txt يلخص الموقع وأهم الصفحات.',
      'سماح صريح للزواحف المحترمة في robots.',
      'مصادر وأسماء واضحة لبناء الثقة.',
    ],
    applyAr: 'الموقع ينشر llms.txt مع روابط الأدوات، ويسمح لزواحف البحث الناشئة، وصفحات الأدوات تبدأ بالجواب المباشر.',
    sources: ['llmstxt.org', 'Google Search Central — AI features and your website'],
  },
  {
    id: 'seo-18',
    area: 'ai-search',
    titleAr: 'لا تخدع الزاحف الآلي: نفس المحتوى للجميع',
    objectiveAr: 'ضمان ألا يرى بوت البحث محتوى مختلفاً عن الزائر، وأن يكون التنسيق واضحاً للتلخيص.',
    whyAr: 'الإخفاء (cloaking) مخالفة صريحة. المساعدات تقدر البنية الصادقة.',
    checklistAr: [
      'لا نصوص مخفية ولا حقن كلمات مفتاحية.',
      'لا محتوى مختلف حسب User-Agent.',
      'جداول وقوائم مفهومة في HTML.',
      'روابط nofollow حيث ينبغي، دون إخفاء.',
    ],
    applyAr: 'صفحات الوكيل تُبنى من نفس بيانات الموقع للزوار والزواحف، والفحص يرصد أي اختلاف مقصود.',
    sources: ['Google Search Essentials — Spam policies', 'Bing Webmaster Guidelines'],
  },
  {
    id: 'seo-19',
    area: 'authority',
    titleAr: 'العلاقات العامة الرقمية بدل شراء الروابط',
    objectiveAr: 'بناء ذكر حقيقي للعلامة عبر محتوى يستحق الاقتباس، وتقارير صحفية وشراكات صادقة.',
    whyAr: 'السلطة تُبنى بالسمعة لا بالروابط. شام علامة أدوات؛ القيمة الحقيقية في أن يقتبس الآخرون أدواته وأرقامه.',
    checklistAr: [
      'قصة علامة واضحة: من نحن وماذا نحل.',
      'بيت صحفي (press kit) بصفحات وأرقام حقيقية.',
      'محتوى أصلي يستحق الاقتباس (أدلة، أدوات، بيانات).',
      'تواصل مع صحفيين ومجتمعات عطور بلا إلحاح أو رشوة.',
    ],
    applyAr: 'المندوب الإعلامي يكتب تقريراً أسبوعياً وبيت صحفي مصغراً من بيانات المنصة فقط، ويقترح زوايا محتوى.',
    sources: ['Google Search Quality Rater Guidelines', 'Google Search Central — Links'],
  },
  {
    id: 'seo-20',
    area: 'analytics',
    titleAr: 'القياس: Search Console وBing Webmaster',
    objectiveAr: 'قراءة الانطباعات والنقرات ومتوسط الترتيب والصفحات الأفضل، وتحويلها إلى قرارات.',
    whyAr: 'بلا قياس، تصبح التحسينات تخميناً. الأرقام تكشف الاستعلامات التي تظهر فيها الصفحة دون نقر.',
    checklistAr: [
      'تحقق من ملكية الموقع في Search Console وBing.',
      'راقب الاستعلامات عالية الانطباع منخفضة النقر.',
      'راقب الصفحات التي تظهر على الصفحة الثانية وحدّث محتواها.',
      'اربط كل تغيير بتاريخه في سجل التغييرات.',
    ],
    applyAr: 'الوكيل يسجل كل تغيير ونتيجته في تاريخ التقييم؛ عند ربط Search Console تُضاف بيانات النقر والانطباع إلى تقريره.',
    sources: ['Google Search Console help', 'Bing Webmaster Tools help'],
  },
  {
    id: 'seo-21',
    area: 'analytics',
    titleAr: 'التجربة والاختبار دون الإضرار بالفهرسة',
    objectiveAr: 'اختبار العناوين والدعوات إلى الإجراء بطريقة قابلة للقياس والتراجع.',
    whyAr: 'التغيير العشوائي لا يُقاس. اختبار واحد واضح في كل دورة، مع فترة كافية وتراجع عند الهبوط.',
    checklistAr: [
      'غيّر عنصراً واحداً في كل مرة.',
      'انتظر أسبوعين على الأقل قبل الحكم على تغيير العنوان.',
      'سجّل الفرضية والنتيجة.',
      'تراجع فوراً عند هبوط واضح أو خطأ.',
    ],
    applyAr: 'الوكيل يغيّر عنوان/وصف صفحة واحدة كحد أقصى في الدورة، ويحتفظ بالنسخة السابقة للتراجع.',
    sources: ['Google Search Central — Search experiments', 'Bing Webmaster Guidelines'],
  },
  {
    id: 'seo-22',
    area: 'authority',
    titleAr: 'المحتوى الذي يستحق المشاركة',
    objectiveAr: 'إنتاج أدوات وأدلة أصلية تخدم سؤالاً حقيقياً، لا مقالات عامة مكررة.',
    whyAr: 'المنافسة في «أفضل عطر» شديدة وغير متخصصة. شام يفوز بزاوية عملية: التركيب والحساب.',
    checklistAr: [
      'لكل صفحة سؤال واضح لا يجيب عنه منافس بنفس العمق.',
      'أرقام وأمثلة وحسابات قابلة للتطبيق الجزئي.',
      'تحديث دوري عند تغير المنتجات أو القواعد.',
      'لا حشو مواضيع خارج نطاق العطور.',
    ],
    applyAr: 'خريطة محتوى مشتقة من أسئلة الزوار الحقيقية في «فجوات المعرفة» وطلبات الدعم، لا من قائمة كلمات عشوائية.',
    sources: ['Google Search Central — Creating helpful content', 'Google Search Quality Rater Guidelines'],
  },
  {
    id: 'seo-23',
    area: 'indexing',
    titleAr: 'مراقبة الحالة والأخطاء وإزالة الصفحات',
    objectiveAr: 'التعامل مع 404 و redirects وnoindex والأخطاء في تغطية الفهرسة بسرعة.',
    whyAr: 'الأخطاء الصامتة تسحب صفحات مهمة من الفهرسة. المراقبة الدورية أرخص من استعادة الترتيب.',
    checklistAr: [
      'لا سلسلة تحويلات طويلة أو حلقة.',
      '404 صحيحة لصفحات حُذفت، و410 عند الاقتضاء.',
      'لا noindex عرضي على صفحات مهمة.',
      'راجع تقارير التغطية أسبوعياً.',
    ],
    applyAr: 'فحص الموقع يتأكد من حالة الصفحة الرئيسية وصفحة أداة وصفحة منتج، ويرصد noindex وcanonical غريب.',
    sources: ['Google Search Central — Page status codes', 'Bing Webmaster Guidelines'],
  },
  {
    id: 'seo-24',
    area: 'performance',
    titleAr: 'الاستضافة وTLS وملفات robots والرؤوس',
    objectiveAr: 'تأمين HTTPS وHSTS وضغط النقل ورؤوس الأمان التي تدعم الثقة.',
    whyAr: 'HTTPS أساسي، والضغط والرؤوس الصحيحة تحسّن السرعة والثقة، وأخطاء الإعداد تمنع الزحف.',
    checklistAr: [
      'HTTPS مع شهادة سارية وتحويل دائم من HTTP.',
      'HSTS وX-Content-Type-Options وReferrer-Policy.',
      'ضغط Brotli/Gzip للنصوص.',
      'robots.txt وsitemap.xml وllms.txt على الجذر مباشرة.',
    ],
    applyAr: 'الوكيل يفحص الرؤوس وزمن الاستجابة ووجود ملفات الجذر، ويوصي بإصلاحات فورية عند غيابها.',
    sources: ['web.dev — Security and HTTPS', 'Google Search Central — HTTPS'],
  },
];

export const TOTAL_LESSONS = SEO_CURRICULUM.length;

/** The next lesson to study: an unstudied one first, then the lesson of the weakest audit area. */
export function nextLesson(studied: string[], weakestArea?: SeoArea): SeoLesson {
  const done = new Set(studied);
  const fresh = SEO_CURRICULUM.find((l) => !done.has(l.id));
  if (fresh) return fresh;
  const target = SEO_CURRICULUM.find((l) => l.area === weakestArea);
  if (target) return target;
  // Practice mode cycles through the curriculum in order, so the agent keeps revisiting all of it.
  return SEO_CURRICULUM[(studied.length - TOTAL_LESSONS) % TOTAL_LESSONS];
}

/** A compact study plan for the admin panel (first N lessons with state). */
export function curriculumPlan(studied: string[]) {
  const done = new Set(studied);
  return SEO_CURRICULUM.map((lesson) => ({
    id: lesson.id, area: lesson.area, areaAr: SEO_AREAS[lesson.area].labelAr,
    titleAr: lesson.titleAr, studied: done.has(lesson.id),
  }));
}
