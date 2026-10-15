import { PyramidNote } from "../types/perfume";
import newsImg from "../assets/images/perfume_news_global_trends_1791696027070.jpg";
import harvestImg from "../assets/images/grasse_rose_harvest_1791696039244.jpg";
import exhibitionImg from "../assets/images/luxury_perfume_exhibition_1791696134494.jpg";
import labImg from "../assets/images/perfume_lab_compounding_1791692420116.jpg";
import pyramidImg from "../assets/images/perfume_ingredients_pyramid_1791692429360.jpg";

export interface PerfumeNewsKeyNote {
  nameAr: string;
  nameEn?: string;
  type?: string;
  percentageHint?: number;
}

export interface PerfumeNewsItem {
  id: string;
  badge?: string;
  titleAr: string;
  titleEn: string;
  category: "trends" | "exhibitions" | "harvests" | "ifra" | "niche";
  categoryLabelAr: string;
  isHot?: boolean;
  isDailyRefreshed?: boolean;
  summaryAr: string;
  summaryEn?: string;
  contentAr?: string;
  contentEn?: string;
  date?: string;
  dateIso?: string;
  readTime?: string;
  readTimeMinutes?: number;
  source?: string;
  sourceEn?: string;
  imageUrl?: string;
  tags?: string[];
  keyNotes?: PerfumeNewsKeyNote[];
  marketImpact?: string;
  impactEn?: string;
  expertVerdict?: string;
  verdictEn?: string;
  author?: string;
  location?: string;
  fullArticleAr?: string;
  pyramidNotes?: PyramidNote[];
  compoundingFormula?: any;
}

export const PERFUME_NEWS_DATA: PerfumeNewsItem[] = [{id:`esxence-milano-trends-2026`,titleAr:`معرض إيسنس ميلانو (Esxence Milano): طفرة عطور الشاي الإمبراطوري والنوتات المائية المعدنية في دور النيش`,titleEn:`Esxence Milano: Rise of Imperial Tea and Mineral Marine Accords`,category:`exhibitions`,categoryLabelAr:`معارض دولية`,isHot:!0,summaryAr:`اختتم معرض إيسنس ميلانو الدولي للعطور أعماله معلناً عن توجه عالمي جديد يقوده الشاي الصيني، البخور الشفاف، والنوتات الملحية الدافئة بعيداً عن الطابع السكري الثقيل.`,contentAr:`شهدت أروقة معرض إيسنس ميلانو (Esxence Milano) لهذا العام حضور أكثر من 300 دار عطور نيش من 40 دولة، حيث أكد كبار صانعي العطور (Master Perfumers) حدوث تحول جذري في ذائقة المستهلكين نحو الروائح التأملية الخفيفة ولكن ذات الثبات الفائق.

برزت نوتات الشاي الصيني الأسود (Oolong) والشاي الأبيض، ممزوجة بجزيئات العنبر الأبيض والميرمية العطرية مع لمسات من الملح الصخري. ويؤكد الخبراء أن استخدام المذيبات الحديثة يسمح بإطالة عمر النوتات العليا الحمضية والعشبية لتستمر لأكثر من 6 ساعات دون فقدان نقائها.`,date:`10 أكتوبر 2026`,dateIso:'2026-10-10',readTime:`3 دقائق`,readTimeMinutes:3,source:`ميلانو - تقرير الاتحاد الأوروبي لمصممي النيش`,sourceEn:'Milan — EU Niche Designers Union Report',imageUrl:exhibitionImg,tags:[`إيسنس ميلانو`,`عطور النيش`,`شاي أولونغ`,`أمبسان`,`صيحات 2026`],keyNotes:[{nameAr:`شاي أولونغ مدخن`,nameEn:`Smoked Oolong Tea`,type:`heart`,percentageHint:18},{nameAr:`برغموت كالابريا الصافي`,nameEn:`Calabrian Bergamot`,type:`top`,percentageHint:25},{nameAr:`عنبر معدني وأمبروكسان`,nameEn:`Mineral Ambergris & Ambroxan`,type:`base`,percentageHint:35},{nameAr:`ميرمية كلاري وزهور الماغنوليا`,nameEn:`Clary Sage & Magnolia`,type:`heart`,percentageHint:22}],marketImpact:`ارتفاع الطلب بنسبة 42% على زيوت الشاي المطلقة ومستخلصات الأعشاب النظيفة.`,expertVerdict:`«المستهلك المعاصر يبحث عن عطر مريح وهادئ يرافقه في الأماكن المغلقة ومساحات العمل دون أن يسبب إزعاجاً، مع ثبات يدوم طويلاً» - الخبير شاهين.`},{id:`grasse-taif-rose-harvest`,titleAr:`مواسم حصاد ورد غراس والورد الطائفي: تقرير جودة الزيوت المطلقة وارتفاع الإنتاجية بنسبة 18%`,titleEn:`Grasse & Taif Rose Harvest: Record Purity and Absolute Oil Yields`,category:`harvests`,categoryLabelAr:`حصاد ومواد خام`,isHot:!0,summaryAr:`سجل موسم قطاف وردة أيار (Rose de Mai) في الريفييرا الفرنسية والورد الجبلي الطائفي موسماً استثنائياً في الكثافة العطرية والنقاء الطبيعي مع انخفاض نسبة الملوثات الكيميائية.`,contentAr:`أعلنت جمعيات مزارعي الورد في مقاطعة غراس بفرنسا ومحافظة الطائف في المملكة العربية السعودية عن انتهاء عمليات التقطير بالبخار والاستخلاص بالمذيبات لإنتاج الزيت الطيار والورد المطلق (Rose Absolute).

أظهرت التحاليل الكروماتوغرافية (GC-MS) زيادة ملحوظة في تركيز مركبات جيرانيول وفينيل إيثيل ألكوهول بنسب تمنح العطر عمقاً مخملياً فريداً. ينصح معمل «شام» مصممي العطور بإضافة نسبة بين 3% إلى 8% من زيت الورد الطبيعي في القلب مع تثبيته بالإيزو إي سوبر والمسك الأبيض لتفادي تطايره السريع.`,date:`8 أكتوبر 2026`,dateIso:'2026-10-08',readTime:`4 دقائق`,readTimeMinutes:4,source:`غراس - المرصد العالمي للزهور العطرية`,sourceEn:'Grasse — Global Aromatic Flora Observatory',imageUrl:harvestImg,tags:[`ورد غراس`,`الورد الطائفي`,`زيوت مطلقة`,`تقطير بخاري`,`مواد طبيعية`],keyNotes:[{nameAr:`ورد دمشقي مطلق (غراس)`,nameEn:`Damask Rose Absolute`,type:`heart`,percentageHint:20},{nameAr:`دهن الورد الطائفي الصافي`,nameEn:`Taif Rose Pure Oil`,type:`heart`,percentageHint:15},{nameAr:`مسك أبيض نظيف ومثبت`,nameEn:`White Musk Fixative`,type:`base`,percentageHint:40},{nameAr:`توت العليق وفلفل وردي`,nameEn:`Pink Pepper & Raspberry`,type:`top`,percentageHint:25}],marketImpact:`استقرار نسبي في أسعار الزيوت المطلقة بعد عامين من التذبذب بسبب الجفاف.`,expertVerdict:`«الوردة الطبيعية لا يمكن تعويضها بالبدائل المصنعة كلياً؛ مجرد 1g في زجاجة 100ml يصنع فرقاً هائلاً في النعومة والروح العطرية» - معمل شام.`},{id:`global-trends-gourmand-evolution`,titleAr:`ثورة العطور التذوقية (Gourmand): الفستق الحلبي، الهيل الأخضر، وحبوب التونكا تتصدر المبيعات العالمية`,titleEn:`The Next Gourmand Wave: Pistachio, Green Cardamom, and Roasted Tonka`,category:`trends`,categoryLabelAr:`صيحات وتقارير`,isHot:!0,summaryAr:`لم تعد العطور الحلوة تقتصر على الفانيليا والسكر المحروق؛ التوجه الحالي يدمج النكهات المكسراتية الفاخرة مع التوابل الباردة والجلود المدبوغة.`,contentAr:`تفيد تقارير مبيعات كبرى أسواق التجزئة في باريس، لندن، ودبي بأن العطور المعتمدة على أكورد الفستق الحلبي الصقلي (Sicilian Pistachio) مع حب الهيل الغواتيمالي حققت نمواً تجاوز 60% في فئتي العطور الرجالية والمشتركة (Unisex).

يرجع هذا النجاح إلى الجمع بين الإحساس اللذيذ الدافئ واللمسة الأرستقراطية غير المبتذلة. تمكن صناع العطور من ضبط تركيزات الفانيلين والإيثيل مالتول بحيث تظل ضمن حدود التوازن ولا تتحول إلى رائحة حلويات رخيصة، عبر مساندتها بالأخشاب العميقة كالصندل وخشب الأرز.`,date:`5 أكتوبر 2026`,dateIso:'2026-10-05',readTime:`3 دقائق`,readTimeMinutes:3,source:`باريس - تقرير مجلة Fragrance Economics`,sourceEn:'Paris — Fragrance Economics Magazine Report',imageUrl:newsImg,tags:[`عطور تذوقية`,`فستق حلبي`,`هيل غواتيمالي`,`تونكا`,`فانيليا مدغشقر`],keyNotes:[{nameAr:`أكورد الفستق والكريمة`,nameEn:`Pistachio Cream Accord`,type:`heart`,percentageHint:25},{nameAr:`حب الهيل الأخضر`,nameEn:`Green Cardamom`,type:`top`,percentageHint:15},{nameAr:`فانيليا بوربون وحبوب تونكا`,nameEn:`Bourbon Vanilla & Tonka`,type:`base`,percentageHint:40},{nameAr:`خشب الصندل الكاليدوني`,nameEn:`New Caledonia Sandalwood`,type:`base`,percentageHint:20}],marketImpact:`تسابق الموردين لتأمين خلاصات الفستق المعالجة بتقنية CO₂ فوق الحرجة.`,expertVerdict:`«المفتاح في إتقان هذا الخط هو عدم زيادة السكر، ودعم القاعدة براتنجات خشبية حادة تكسر الدسامة» - الخبير شاهين.`},{id:`ifra-51-amendment-guide`,titleAr:`تحديثات معايير الأيفرا (IFRA 51st Amendment): إرشادات حاسمة لحماية المستهلكين وضبط نسب مسببات الحساسية`,titleEn:`IFRA 51st Amendment: Compliance Guide for Perfumers and Brand Owners`,category:`ifra`,categoryLabelAr:`لوائح IFRA ومعايير`,isHot:!1,summaryAr:`دخلت حزمة التعديل الحادي والخمسين لمنظمة العطور الدولية حيز التنفيذ الإلزامي، متضمنة قيوداً جديدة على مشتقات طحلب السنديان (Oakmoss) ومركبات الأيزوايجينول.`,contentAr:`أصدرت الجمعية الدولية للعطور (IFRA) وثيقة التنفيذ الإلزامي لشهادات السلامة للمصانع ومصممي العطور المستقلين. تهدف اللوائح الجديدة إلى منع أي تهيجات جلدية أو حساسية ضوئية عند التعرض لأشعة الشمس.

أبرز ما يجب على مصممي العطور في منصة «صمم عطرك مع شام» مراعاته:
1. الحد الأقصى لمطلق طحلب السنديان يجب ألا يتجاوز 0.1% في المنتجات المطبقة على الجلد (الفئة 4).
2. حظر استخدام مادة الليليال (Lilial / Butylphenyl Methylpropional) بشكل قاطع واستبدالها بالفلورالوزون (Floralozone) أو الهيديون (Hedione).
3. مراجعة محتوى البنزيل بنزوات في الزيوت العطرية المعدة للتصدير.`,date:`1 أكتوبر 2026`,dateIso:'2026-10-01',readTime:`5 دقائق`,readTimeMinutes:5,source:`بروكسل - وثيقة الهيئة الدولية للعطور IFRA`,sourceEn:'Brussels — IFRA International Fragrance Association Document',imageUrl:labImg,tags:[`لوائح IFRA`,`طحلب السنديان`,`سلامة العطور`,`هيديون`,`شهادات التصدير`],keyNotes:[{nameAr:`هيديون عالي الكفاءة (Hedione HC)`,nameEn:`Hedione HC`,type:`heart`,percentageHint:25},{nameAr:`طحلب سنديان خالي من الأترانول`,nameEn:`Atranol-Free Oakmoss`,type:`base`,percentageHint:5},{nameAr:`أيزو إي سوبر نقي`,nameEn:`Iso E Super`,type:`base`,percentageHint:45},{nameAr:`لينالول وليناليل أسيتات نقي`,nameEn:`Pure Linalool & Acetate`,type:`top`,percentageHint:25}],marketImpact:`سحب أكثر من 120 مادة كيميائية تقليدية وتدفق استثمارات ضخمة في البدائل الخضراء الآمنة.`,expertVerdict:`«الالتزام بـ IFRA ليس عائقاً للإبداع، بل هو التذكرة الذهبية لدخول عطورك الأسواق العالمية دون أي مخاوف قانونية» - معمل شام.`},{id:`beautyworld-middle-east-dubai`,titleAr:`بيوتي وورلد دبي (Beautyworld Middle East): العود البخوري والأمبروكسان المعدل يتصدران الصفقات الصناعية`,titleEn:`Beautyworld Dubai: Smoky Agarwood and Tailored Ambroxan Lead Industrial Deals`,category:`exhibitions`,categoryLabelAr:`معارض دولية`,isHot:!1,summaryAr:`سجل معرض دبي إبرام شراكات تاريخية لتوريد دهن العود المستدام والمعالج بيولوجياً، مع دمج التقنيات الشرقية الأصيلة في دور العطور الباريسية.`,contentAr:`شهد مركز دبي التجاري العالمي فعاليات النسخة الأكبر من معرض بيوتي وورلد الشرق الأوسط بمشاركة أكثر من 1,800 عارض من كبار مصنعي الزيوت والعبوات وآلات التعبئة والكبس.

أجمع الخبراء على أن الذائقة الخليجية والعربية تقود الابتكار في سوق العطور العالمي بقيمة تتجاوز 12 مليار دولار. وقد شهد المعرض تقديم خامات عود صناعي وطبيعي هجين تمنح فوحاناً استثنائياً دون الحدة الترابية الثقيلة، مما يجعلها مثالية للدمج مع الحمضيات الإيطالية واللافندر الفرنسي.`,date:`28 سبتمبر 2026`,dateIso:'2026-09-28',readTime:`4 دقائق`,readTimeMinutes:4,source:`دبي - المكتب الإعلامي لصناعة التجميل والعطور`,sourceEn:'Dubai — Beauty & Fragrance Industry Media Office',imageUrl:exhibitionImg,tags:[`بيوتي وورلد`,`دبي`,`دهن العود`,`صناعة العطور`,`أمبروكسان`],keyNotes:[{nameAr:`دهن عود كلمنتان مروض`,nameEn:`Tamed Kalimantan Oud`,type:`base`,percentageHint:30},{nameAr:`زعفران إسباني ونوتات جلود`,nameEn:`Spanish Saffron & Leather`,type:`heart`,percentageHint:25},{nameAr:`لبان حوجري عماني نقي`,nameEn:`Pure Omani Frankincense`,type:`base`,percentageHint:25},{nameAr:`لافندر بروفانس الفرنسي`,nameEn:`French Provence Lavender`,type:`top`,percentageHint:20}],marketImpact:`عقود توريد لزيوت العود المستدامة تجاوزت قيمتها 85 مليون دولار.`,expertVerdict:`«الاندماج الشرقي الغربي هو مستقبل صناعة العطور، وأصبح العود مكوناً ثابتاً في أرقى مختبرات العالم» - الخبير شاهين.`},{id:`green-chemistry-fixatives-revolution`,titleAr:`ثورة المثبتات الحيوية: علماء الكيمياء الخضراء يبتكرون مثبتات طبيعية 100% تطيل عمر العطر لـ 48 ساعة`,titleEn:`Green Chemistry Breakthrough: 100% Bio-Based Fixatives with 48h Longevity`,category:`niche`,categoryLabelAr:`إصدارات وتقنيات النيش`,isHot:!1,summaryAr:`نجحت مختبرات الكيمياء الحيوية في سويسرا بإنتاج بدائل حيوية لمركبات الفثالات والبوليمرات البترولية، تقدم ثباتاً فائقاً وتحافظ على استقرار الرائحة في زجاجات العطور.`,contentAr:`تمثل هذه التقنية الثورية نقلة نوعية لصناع العطور الحرفيين؛ حيث تستخلص جزيئات التثبيت الجديدة من نفايات قشور الحمضيات ولحاء الصنوبر المعاد تدويرهما. تتميز هذه المثبتات بأنها عديمة الرائحة تماماً ولا تغير لون السائل العطري حتى بعد سنتين من التعتيق.

يتيح معمل «صمم عطرك مع شام» دمج هذه التوصيات في حاسبة التراكيز مع حساب نسب المثبت الدقيقة (من 0.5% إلى 2%) لضمان انتشار الفوحان على البشرة والملابس بتجانس تام.`,date:`22 سبتمبر 2026`,dateIso:'2026-09-22',readTime:`3 دقائق`,readTimeMinutes:3,source:`جنيف - المعهد السويسري للابتكار العطري`,sourceEn:'Geneva — Swiss Fragrance Innovation Institute',imageUrl:pyramidImg,tags:[`كيمياء خضراء`,`مثبتات حيوية`,`ثبات العطر`,`استدامة`,`تعتيق`],keyNotes:[{nameAr:`مثبت حيوي مستدام (Bio-Fixative)`,nameEn:`Bio-Polymer Fixative`,type:`base`,percentageHint:20},{nameAr:`خشب الأرز الأطلسي المعالج`,nameEn:`Atlas Cedarwood Pure`,type:`base`,percentageHint:30},{nameAr:`زهر البرتقال التونسي (نيرولي)`,nameEn:`Tunisian Neroli`,type:`top`,percentageHint:25},{nameAr:`ياسمين سامباك الصافي`,nameEn:`Jasmine Sambac Absolute`,type:`heart`,percentageHint:25}],marketImpact:`تحول 30% من معامل النيش الأوروبية إلى المثبتات القائمة على التكنولوجيا الحيوية.`,expertVerdict:`«المثبت الذكي هو الذي لا يطمس جمال النوتات بل يرفعها ويعطيها متنفساً تدريجياً على مدار الساعات» - معمل شام.`}];

// =========================================
// ENGLISH CONTENT FALLBACK
// Full English bodies for the six seed articles so that non-Arabic
// readers (any UI language) always get complete English article
// content instead of leaking Arabic on the news page.
// =========================================
export interface NewsEnFallback {
  summary: string;
  content: string;
  impact: string;
  verdict: string;
}

export const NEWS_EN_FALLBACK: Record<string, NewsEnFallback> = {
  'esxence-milano-trends-2026': {
    summary: 'The international Esxence perfume fair concluded by announcing a new global direction led by Chinese tea, transparent incense, and warm salty notes — far removed from the heavy sugary character of past seasons.',
    content: 'This year’s halls of Esxence Milano hosted more than 300 niche perfume houses from 40 countries, where master perfumers confirmed a radical shift in consumer taste toward light, meditative scents with exceptional longevity.\n\nBlack Chinese tea (Oolong) and white tea notes stood out, blended with white amber molecules and aromatic clary sage touched with rock salt. Experts confirm that modern solvents extend the life of citrus and herbal top notes so they last more than 6 hours without losing their clarity.',
    impact: 'A 42% surge in demand for absolute tea oils and clean herbal extracts.',
    verdict: '“The modern consumer seeks a calm, comfortable fragrance for enclosed spaces and workplaces — one that never disturbs, yet lasts” — Master Shahin.',
  },
  'grasse-taif-rose-harvest': {
    summary: 'The Rose de Mai harvest on the French Riviera and the mountain Taif rose recorded an exceptional season in aromatic density and natural purity, with lower levels of chemical contaminants.',
    content: 'Rose-grower associations in France’s Grasse district and Saudi Arabia’s Taif province announced the completion of steam distillation and solvent extraction to produce rose otto and rose absolute.\n\nGC-MS chromatographic analyses showed a marked rise in geraniol and phenethyl alcohol concentrations at levels that give the perfume a unique velvety depth. The Sham lab advises perfumers to add 3% to 8% natural rose oil in the heart, anchored with Iso E Super and white musk to prevent rapid evaporation.',
    impact: 'Relative price stability for absolute oils after two years of drought-driven volatility.',
    verdict: '“Natural rose can never be fully replaced by synthetic substitutes; just 1g in a 100ml bottle makes an enormous difference in softness and aromatic soul” — Sham Lab.',
  },
  'global-trends-gourmand-evolution': {
    summary: 'Sweet perfumes are no longer limited to vanilla and burnt sugar; the current trend blends luxurious nutty flavours with cool spices and tanned leathers.',
    content: 'Retail sales reports from Paris, London, and Dubai confirm that fragrances built on a Sicilian pistachio accord with Guatemalan cardamom achieved growth exceeding 60% in the men’s and unisex categories.\n\nThis success stems from combining a warm, delicious feel with an understated aristocratic touch. Perfumers managed to calibrate vanillin and ethyl maltol concentrations to stay within balance and never drift into cheap-candy territory, supported by deep woods such as sandalwood and cedarwood.',
    impact: 'Suppliers racing to secure supercritical CO₂-processed pistachio extracts.',
    verdict: '“The key to mastering this line is not overdoing the sugar, and anchoring the base with sharp woody resins that break the richness” — Master Shahin.',
  },
  'ifra-51-amendment-guide': {
    summary: 'The 51st amendment package of the International Fragrance Association has entered mandatory enforcement, including new restrictions on oakmoss derivatives and isoegenol compounds.',
    content: 'IFRA has issued the mandatory enforcement document for safety certificates covering factories and independent perfumers. The new regulations aim to prevent any skin irritation or photosensitivity upon sun exposure.\n\nKey points for perfumers on the Design Your Perfume with Sham platform:\n1. The maximum oakmoss absolute must not exceed 0.1% in products applied to skin (Category 4).\n2. Lilial (Butylphenyl Methylpropional) is categorically banned — replace it with Floralozone or Hedione.\n3. Review benzyl benzoate content in fragrance oils intended for export.',
    impact: 'More than 120 traditional chemicals withdrawn, with massive investment flowing into safe green alternatives.',
    verdict: '“IFRA compliance is not an obstacle to creativity — it is the golden ticket that takes your perfumes into global markets without legal worries” — Sham Lab.',
  },
  'beautyworld-middle-east-dubai': {
    summary: 'The Dubai fair recorded historic partnerships for supplying sustainable, biologically treated oud oil, alongside the integration of authentic Eastern techniques into Parisian perfume houses.',
    content: 'The Dubai World Trade Centre hosted the largest edition of Beautyworld Middle East, with more than 1,800 exhibitors among the leading manufacturers of oils, bottles, and filling and capping machinery.\n\nExperts agreed that Gulf and Arab taste is driving innovation in the global fragrance market, now worth more than $12 billion. The fair unveiled hybrid synthetic-natural oud materials that deliver exceptional sillage without heavy earthy harshness, making them ideal for blending with Italian citrus and French lavender.',
    impact: 'Sustainable oud oil supply contracts exceeded $85 million in value.',
    verdict: '“The East-West fusion is the future of perfumery, and oud has become a permanent ingredient in the world’s finest laboratories” — Master Shahin.',
  },
  'green-chemistry-fixatives-revolution': {
    summary: 'Swiss biochemistry laboratories have succeeded in producing bio-based alternatives to phthalate compounds and petroleum polymers, delivering superior fixation while preserving scent stability inside perfume bottles.',
    content: 'This breakthrough technology is a qualitative leap for artisan perfumers: the new fixative molecules are extracted from recycled citrus-peel waste and pine bark. These fixatives are completely odourless and do not alter the colour of the perfume liquid even after two years of maceration.\n\nThe Design Your Perfume with Sham lab lets you integrate these recommendations into the concentration calculator with precise fixative ratios (from 0.5% to 2%) to guarantee even sillage on skin and fabric.',
    impact: '30% of European niche laboratories have switched to biotechnology-based fixatives.',
    verdict: '“A smart fixative never masks the beauty of the notes — it lifts them and lets them breathe gradually over the hours” — Sham Lab.',
  },
};
