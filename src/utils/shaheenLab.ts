/**
 * «معمل شاهين للتجارب والابتكار» — Shaheen's Lab for Experiments & Innovation.
 * The lab of the platform's world university: real scientific material per field (theories, laws,
 * methods, tools), designed experiments for every field, a cross-field cooperation map, an index of
 * ESTABLISHED research (real scientists, real years, real findings — never fabricated citations),
 * and a product pipeline that turns proven science into market products.
 * Pure data + pure functions (no Node/DOM): used by scripts/shaheen-lab/run.mts (the lab bot writes
 * src/data/live/shaheen-lab.json) and tested by tests/shaheenLab.test.ts.
 */
import { LAB_EXPERIMENTS, LAB_PRODUCTS, LAB_RESEARCH } from './shaheenLabCatalog';

export { LAB_EXPERIMENTS, LAB_PRODUCTS, LAB_RESEARCH } from './shaheenLabCatalog';
export type { LabExperiment, LabProduct, LabResearch } from './shaheenLabCatalog';

export interface LabField {
  id: string;
  nameAr: string;
  nameEn: string;
  /** المادة العلمية: النظريات والقوانين الراسخة في هذا المجال. */
  scienceAr: string;
  /** المناهج العلمية المستخدمة فيه. */
  methodsAr: string;
  /** الأدوات والمعدات الأساسية. */
  toolsAr: string;
  /** سوق هذا المجال: أين تخدم النتائج الناس. */
  marketAr: string;
}

export interface LabCross {
  id: string;
  /** المجالات المتعاونة (معرفات حقول المعمل). */
  fields: string[];
  titleAr: string;
  whyAr: string;
  sharedAr: string;
  productsAr: string;
}

export const LAB = {
  nameAr: 'معمل شاهين للتجارب والابتكار',
  nameEn: 'Shaheen Lab for Experiments & Innovation',
  missionAr: 'معمل تجارب احترافي لكل المجالات: كل فكرة تُصاغ فرضية، وكل تجربة تُصمم بمتغيرات وضوابط، وكل نتيجة تُوثَّق صادقة، وكل علم راسخ يُقرأ ويُدرَّس، وكل تعاون بين علومين يُجرَّب، وكل نتيجة مثبتة تتحول لمنتج يخدم السوق والعلم.',
  missionEn: 'A professional experiments lab for every field: every idea becomes a hypothesis, every experiment is designed with variables and controls, every result is honestly documented, every established science is taught, cross-field cooperation is tested, and proven results become products that serve market and science.',
  mottoAr: 'نجرّب فنعرف، ونوثّق فنثق، وننتج فنخدم',
} as const;

/** المادة العلمية الكاملة لكل مجال — نظريات وقوانين راسخة، مناهج، أدوات، وسوق. */
export const LAB_FIELDS: LabField[] = [
  {
    id: 'chemistry', nameAr: 'الكيمياء', nameEn: 'Chemistry',
    scienceAr: 'قانون حفظ الكتلة، والاتزان الكيميائي، والأحماض والقواعد (أرهينيوس وبرونستيد)، والأكسدة والاختزال، والكيمياء العضوية (الهيدروكربونات ووظائفها)، والترموديناميك الكيميائي (الطاقة الحرة لجيبس) والحركية الكيميائية.',
    methodsAr: 'التحليل الكيميائي (حجيمي ووزني)، والتقطير، والبلورة، والكروماتوغرافيا، وتصميم التجربة المحكومة بمتغير واحد.',
    toolsAr: 'الميزان الدقيق، وجهاز قياس الحموضة، والطيفية، والفرن، والأوانى الزجاجية المدرّجة.',
    marketAr: 'المنظفات، والأدوية، والأسمدة، والعطور، ومعالجة المياه، والبلاستيك الحيوي.',
  },
  {
    id: 'physics', nameAr: 'الفيزياء', nameEn: 'Physics',
    scienceAr: 'قوانين نيوتن للحركة، والديناميكا الحرارية (القانونان الأول والثاني)، والكهرومغناطيسية (معادلات ماكسويل)، والبصريات (الانكسار والتشتت)، والنسبية (E=mc²)، والميكانيكا الكمية (مبدأ الشك).',
    methodsAr: 'التجربة المحكومة، والقياس المتكرر مع حساب الخطأ، والنمذجة الرياضية، والتحقق بالتنبؤ.',
    toolsAr: 'الميزان، والمقياس، والليزر، والوسيلوسكوب، والمستشعرات الرقمية.',
    marketAr: 'الإلكترونيات، والاتصالات، والطاقة، والنقل، والتصوير الطبي.',
  },
  {
    id: 'biology', nameAr: 'الأحياء', nameEn: 'Biology',
    scienceAr: 'نظرية الخلية، والوراثة المندلية، وبنية DNA (واتسون وكريك وفرانكلين)، والتطور بالانتقاء الطبيعي (داروين)، والمناعة، وعلم البيئة (السلاسل الغذائية).',
    methodsAr: 'الملاحظة المنظمة، والمجهر، والزراعة المخبرية، وتضخيم DNA (PCR)، والتجربة الحقلية.',
    toolsAr: 'المجهر، والطراد المركزي، والحضّانات، والألواح المخبرية.',
    marketAr: 'الأدوية، واللقاحات، والزراعة، والتقنية الحيوية، وحماية البيئة.',
  },
  {
    id: 'medicine', nameAr: 'الطب والصحة', nameEn: 'Medicine & health',
    scienceAr: 'علم الأمراض، والصيدلة (الجرعة والاستجابة)، وعلم الأوبئة (منهج جون سنو في الكوليرا)، والمناعة واللقاحات، ووظائف الأعضاء.',
    methodsAr: 'التجربة السريرية المزدوجة التعمية، والرصد الوبائي، ودراسة الحالة والشاهد، والقياس الحيوي.',
    toolsAr: 'أجهزة التصوير، والتحاليل المخبرية، وقياس العلامات الحيوية.',
    marketAr: 'الأدوية، والأجهزة الطبية، والرعاية الصحية، والتغذية العلاجية.',
  },
  {
    id: 'agriculture', nameAr: 'الزراعة', nameEn: 'Agriculture',
    scienceAr: 'دورة النيتروجين، وخصوبة التربة، والوراثة النباتية (الثورة الخضراء لبورلوج)، والري والتصريف، والوقاية من الآفات (الإدارة المتكاملة).',
    methodsAr: 'التجربة الحقلية بمضلعات متقابلة، والمحاصيل الضريبية، وتحليل التربة، وقياس الإنتاجية.',
    toolsAr: 'المحلل الزراعي، والري بالتنقيط، والصوب، ومقاييس الرطوبة.',
    marketAr: 'الغذاء، والسماد العضوي، والبذور المحسنة، وتقنيات الري.',
  },
  {
    id: 'food', nameAr: 'علوم الغذاء', nameEn: 'Food science',
    scienceAr: 'الكيمياء الغذائية (البروتينات والدهون والكربوهيدرات)، والتخمير (الخميرة والبكتيريا النافعة)، والسلامة الغذائية (نظام HACCP)، والتغذية المتوازنة.',
    methodsAr: 'التحليل الغذائي، واختبار الرف، وتجارب الذوق المنظمة، ومراقبة سلسلة التبريد.',
    toolsAr: 'المجهر الغذائي، ومقاييس الملوحة، وأجهزة التعقيم.',
    marketAr: 'الأغذية والمشروبات، والمكملات، والتعبئة الذكية.',
  },
  {
    id: 'materials', nameAr: 'علم المواد', nameEn: 'Materials science',
    scienceAr: 'بنية البلورات، والسبائك (المعدن والمركب)، والبوليمرات، والخزف، والمواد النانوية، وخصائص المرونة والشد والصلادة.',
    methodsAr: 'اختبار الشد والضغط، والفحص المجهري، والتحليل الحراري، وتجارب التقادم.',
    toolsAr: 'الأفران، وماكينات اختبار الشد، والميكروسكوب الإلكتروني.',
    marketAr: 'البناء، والإلكترونيات، والسيارات، والملابس، والتغليف.',
  },
  {
    id: 'energy', nameAr: 'الطاقة', nameEn: 'Energy',
    scienceAr: 'حفظ الطاقة، والتحويل الكهروضوئي (الخلايا الشمسية)، والكهروكيميائية (البطاريات)، وديناميكا الرياح، والكفاءة الحرارية (كارنو).',
    methodsAr: 'قياس الكفاءة، ودورة العمل، وموازنة الطاقة، والتجربة الميدانية للمقارنة.',
    toolsAr: 'الخلايا الشمسية، والعاكسات، ومقاييس التيار والجهد، وحُفّاظ الطاقة.',
    marketAr: 'الكهرباء المنزلية، وتخزين الطاقة، ومركبات الرياح، وكفاءة الاستهلاك.',
  },
  {
    id: 'environment', nameAr: 'البيئة', nameEn: 'Environment',
    scienceAr: 'دورة الكربون، والتنوع الحيوي، والتلوث (الهواء والماء والتربة)، وتغير المناخ (أثر الاحتباس الحراري)، ودورة الأوزون.',
    methodsAr: 'الرصد البيئي، والنمذجة المناخية، وتحليل العينات، ودراسات الأثر.',
    toolsAr: 'أجهزة قياس الهواء، وأخذ العينات، والخرائط الجغرافية.',
    marketAr: 'إعادة التدوير، والطاقة النظيفة، والاستدامة الزراعية.',
  },
  {
    id: 'water', nameAr: 'المياه', nameEn: 'Water',
    scienceAr: 'الدورة الهيدرولوجية، وكيمياء المياه (الحموضة والملوحة)، والمعالجة (الترشيح والتعقيم)، وحركة الجريان السطحي والجوفي.',
    methodsAr: 'تحليل العينات، واختبار العكارة، وتجربة الترشيح متعدد المراحل، والقياس الميداني.',
    toolsAr: 'الفلاتر، ومقاييس الملوحة والحموضة، وأجهزة التعقيم بالأشعة.',
    marketAr: 'مياه الشرب، والري، ومعالجة الصرف، والتحلية.',
  },
  {
    id: 'cosmetics', nameAr: 'العناية والمستحضرات', nameEn: 'Cosmetics & care',
    scienceAr: 'كيمياء الجلد (الحاجز الدهني والسيراميدات)، وعلم التحسس، والترطيب، وتفاعل الصابون (التصبن)، وحماية الشمس.',
    methodsAr: 'اختبار التحمل الجلدي، ودراسات المستهلك المنظمة، والاختبارات المخبرية للثبات.',
    toolsAr: 'مقاييس المرونة الجلدية، وحاضنات الثبات، وعينات الاختبار.',
    marketAr: 'العناية بالبشرة، والصابون الطبيعي، والواقي الشمسي، والشعر.',
  },
  {
    id: 'perfumery', nameAr: 'العطور', nameEn: 'Perfumery',
    scienceAr: 'الكيمياء العطرية (الزيوت المتطايرة والإسترات)، ومبادئ التبخر والثبات، والهرم العطري (القمة والقلب والقاعدة)، والتقطير بالبخار.',
    methodsAr: 'الاستخلاص بالتقطير، والتعتيق (الماسرة)، والتقييم الحسي المنظم، والتحليل الوزني للنسب.',
    toolsAr: 'الماصات، والأوانى الزجاجية الداكنة، والورق الترشيحي، والميزان.',
    marketAr: 'العطور، والزيوت الطبيعية، والبخور، ومستحضرات المعطرة.',
  },
  {
    id: 'computing', nameAr: 'الحوسبة والذكاء الاصطناعي', nameEn: 'Computing & AI',
    scienceAr: 'نظرية التعقيد (P وNP)، ونظرية المعلومات (شانون)، والخوارزميات، وتعلّم الآلة (التعلّم المُشرف والتعزيزي)، والتشفير (المفتاح العام).',
    methodsAr: 'القياس عبر مجموعات اختبار (benchmarks)، والمحاكاة، والتجربة المتكررة على البيانات، والتحقق من الصحة.',
    toolsAr: 'الحاسوب، وبيئات التنفيذ، ومجموعات البيانات، وأدوات القياس.',
    marketAr: 'البرمجيات، والأتمتة، والخدمات الذكية، والتحليلات.',
  },
  {
    id: 'economics', nameAr: 'اقتصاد المنتجات', nameEn: 'Product economics',
    scienceAr: 'العرض والطلب، وقانون التكلفة الهامشية، ومرونة السعر، ودورة حياة المنتج، وتحليل جدوى الاستثمار.',
    methodsAr: 'تحليل السوق، وتجربة التسعير، ودراسات الجدوى، وقياس رضا العملاء.',
    toolsAr: 'الجداول المالية، والاستبيانات، ومؤشرات الأداء.',
    marketAr: 'كل منتجات المعمل: من الفكرة إلى الرف.',
  },
];

/** خريطة التعاون بين العلوم — أين تتقاطع المجالات وتنتج أقوى. */
export const LAB_CROSS: LabCross[] = [
  { id: 'chem-med', fields: ['chemistry', 'medicine'], titleAr: 'الكيمياء × الطب', whyAr: 'كل دواء مركب كيميائي بجرعة محسوبة، والصيدلة كيمياء تطبيقية على جسم الإنسان.', sharedAr: 'تجارب التفاعلات الدوائية وقياس الذوبان والوصول الحيوي.', productsAr: 'أدوية محسنة الجرعة، ومستحضرات توصيل الدواء.' },
  { id: 'bio-agri', fields: ['biology', 'agriculture'], titleAr: 'الأحياء × الزراعة', whyAr: 'الزراعة تطبيق لوراثة النبات وعلم التربة والميكروبيوم.', sharedAr: 'تجارب نمو النبات، وتحسين البذور، والحماية البيولوجية من الآفات.', productsAr: 'بذور محسنة، وأسمادة حيوية، ومضادات حيوية نباتية.' },
  { id: 'phys-energy', fields: ['physics', 'energy'], titleAr: 'الفيزياء × الطاقة', whyAr: 'الطاقة تحويل فيزيائي: ضوء لكهرباء، وحركة لتيار، وحرارة لشغل.', sharedAr: 'تجارب كفاءة الخلايا الشمسية وتخزين الطاقة.', productsAr: 'ألواح منزلية، ومحطات شحن صغيرة، وحلول عزل حراري.' },
  { id: 'chem-food', fields: ['chemistry', 'food'], titleAr: 'الكيمياء × الغذاء', whyAr: 'الطبخ والتخمير تفاعلات كيميائية، والسلامة الغذائية كيمياء تحليلية.', sharedAr: 'تجارب التخمير، وقياس العناصر الغذائية، واختبار الحفظ.', productsAr: 'مخللات صحية، ومشروبات تخمير، ومنتجات حفظ طبيعية.' },
  { id: 'water-env', fields: ['water', 'environment'], titleAr: 'المياه × البيئة', whyAr: 'نقاء الماء صحة البيئة، ومعالجة الصرف حماية للنظم الحيوية.', sharedAr: 'تجارب تنقية المياه ورصد التلوث.', productsAr: 'فلاتر منزلية، وحلول معالجة صديقة للبيئة.' },
  { id: 'cosm-chem', fields: ['cosmetics', 'chemistry'], titleAr: 'العناية × الكيمياء', whyAr: 'كل مستحضر عناية تركيبة كيميائية متوازنة بين الفعالية والسلامة.', sharedAr: 'تجارب التصبن، وثبات التركيبات، وتحمل البشرة.', productsAr: 'صابون طبيعي، ومرطبات سيراميدات، وواقي شمسي.' },
  { id: 'perf-chem', fields: ['perfumery', 'chemistry'], titleAr: 'العطور × الكيمياء', whyAr: 'العطر كيمياء متطايرة: استخلاص وتقطير وتفاعلات إسترات.', sharedAr: 'تجارب التقطير والتعتيق وقياس الثبات.', productsAr: 'عطور طبيعية ثابتة، وزيوت عطرية مركزة.' },
  { id: 'ai-econ', fields: ['computing', 'economics'], titleAr: 'الذكاء الاصطناعي × الاقتصاد', whyAr: 'التحليل الذكي يقرأ السوق أسرع ويختبر التسعير بمحاكاة قبل الإطلاق.', sharedAr: 'تجارب تحليل الطلب، ونماذج التسعير، وتوقع المبيعات.', productsAr: 'أدوات تسعير ذكية، وتقارير سوق آلية.' },
  { id: 'mat-energy', fields: ['materials', 'energy'], titleAr: 'علم المواد × الطاقة', whyAr: 'قفزة البطاريات والألواح تأتي من مواد جديدة قبل أي تصميم.', sharedAr: 'تجارب المواد الجديدة للتخزين والتحويل.', productsAr: 'بطاريات أطول عمراً، وعزل حراري متقدم.' },
  { id: 'med-food', fields: ['medicine', 'food'], titleAr: 'الطب × الغذاء', whyAr: 'الغذاء الدواء الأول: الوقاية بالتغذية مدعومة بأبحاث سريرية.', sharedAr: 'تجارب الأغراض الغذائية وأثرها على المؤشرات الحيوية.', productsAr: 'أغذية وظيفية، وخطط غذائية متوازنة.' },
  { id: 'comp-med', fields: ['computing', 'medicine'], titleAr: 'الحوسبة × الطب', whyAr: 'التحليل الآلي يسرّع التشخيص ويكشف الأنماط التي لا تراها العين.', sharedAr: 'تجارب تحليل الصور الطبية، وتوقع الأوبئة.', productsAr: 'أدوات تشخيص مساعدة، وأنظمة إنذار مبكر.' },
  { id: 'agri-env', fields: ['agriculture', 'environment'], titleAr: 'الزراعة × البيئة', whyAr: 'الزراعة المستدامة تحافظ على التربة والماء وتنتج غذاءً ببصمة أقل.', sharedAr: 'تجارب الكمبوست، ومكافحة التصحر، وكفاءة المياه.', productsAr: 'سماد عضوي، ونظم ري موفّرة.' },
  { id: 'phys-comp', fields: ['physics', 'computing'], titleAr: 'الفيزياء × الحوسبة', whyAr: 'المحاكاة الفيزيائية بالحاسوب تختبر التصميمات قبل التصنيع.', sharedAr: 'تجارب المحاكاة (الإجهادات، الحرارة، الجريان).', productsAr: 'مصممات محاكاة، وأدوات تحقق هندسية.' },
  { id: 'food-agri', fields: ['food', 'agriculture'], titleAr: 'الغذاء × الزراعة', whyAr: 'سلسلة الطعام من التربة للرف: جودة المحصول تحدد جودة المنتج.', sharedAr: 'تجارب من الحقل للمطبخ: أصناف وطرق حفظ.', productsAr: 'منتجات غذائية من محاصيل محسنة.' },
];

export const labField = (id: string) => LAB_FIELDS.find((f) => f.id === id);
export const labExperimentsIn = (field: string) => LAB_EXPERIMENTS.filter((e) => e.field === field);
export const labResearchIn = (field: string) => LAB_RESEARCH.filter((r) => r.field === field);
export const labProductsIn = (field: string) => LAB_PRODUCTS.filter((p) => p.field === field);
export const labCrossWith = (field: string) => LAB_CROSS.filter((c) => c.fields.includes(field));

/** إحصاءات المعمل الحقيقية المشتقة من المحتوى (ما يكتبه الروبوت في تقريره). */
export function labStats() {
  return {
    fields: LAB_FIELDS.length,
    experiments: LAB_EXPERIMENTS.length,
    research: LAB_RESEARCH.length,
    products: LAB_PRODUCTS.length,
    crossLinks: LAB_CROSS.length,
    byField: LAB_FIELDS.map((f) => ({
      id: f.id,
      nameAr: f.nameAr,
      experiments: labExperimentsIn(f.id).length,
      research: labResearchIn(f.id).length,
      products: labProductsIn(f.id).length,
      cross: labCrossWith(f.id).length,
    })),
  };
}
