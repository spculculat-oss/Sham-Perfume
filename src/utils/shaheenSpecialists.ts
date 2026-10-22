/**
 * «مجلس المتخصصين»: علوم مدرسة شاهين الـ27 موزّعة على متخصصين، يتم اللجوء إليهم في أي وقت،
 * وهما في نفس الوقت استشاريّو الموقع وأقسامه كلها (المتجر، الحاسبات، الدليل، الأخبار، لوحة الإدارة…).
 *
 * التصميم مبني على «الاعتماد على النفس»: المتخصص يرد من علوم المدرسة وذاكرة شاهين ومكتبته —
 * على السيرفر وفي متصفح الزائر، بدون إنترنت وبدون أي تطبيق ذكاء اصطناعي — ولو الإجابة مش
 * موجودة يقول بصراحة إنه هيذاكر السؤال (الصراحة أحسن من التخمين).
 *
 * كل متخصص مسجّل رسمياً في سجل الروبوتات (src/utils/shaheenOrg.ts) بنفس الـ id، وعنده وردية
 * مراقبة وخبير فحص، وعلومه محددة بنطاقه فقط (L-32).
 */
import type { BotId } from './shaheenOrg';

/** مسارات مدرسة شاهين الـ37 (نفس معرفات scripts/shaheen-school/curriculum.ts — اختبار يتأكد من التطابق). */
export type ScienceTrack =
  | 'perfume' | 'prog_langs' | 'blocks' | 'software' | 'graphics' | 'web_care' | 'ai_science' | 'security' | 'quantum' | 'ai_tools'
  | 'ai_projects' | 'it_sciences' | 'frontier' | 'chemistry' | 'physics' | 'math'
  | 'commerce' | 'law' | 'pr' | 'management' | 'history' | 'geography' | 'literature' | 'social'
  | 'psychology' | 'cyber_psych' | 'ux_psych'
  | 'biology' | 'medicine' | 'engineering' | 'earth_space' | 'education' | 'media_info' | 'sports' | 'arts' | 'religion' | 'tourism_ir';

export type SpecialistId = BotId;

export interface Specialist {
  /** نفس معرف الروبوت في سجل BOTS (تُسجَّل المتخصصين رسمياً تحت شاهين). */
  id: SpecialistId;
  nameAr: string;
  nameEn: string;
  /** التخصص (نطاق واحد — L-32): المتخصص خبير في مجاله بس. */
  fieldAr: string;
  fieldEn: string;
  /** العلوم المسندة إليه من مسارات المدرسة الـ27 — كل علم يملكه متخصص واحد بالضبط. */
  tracks: ScienceTrack[];
  /** العلوم كما تُعرض للزائر. */
  sciencesAr: string;
  sciencesEn: string;
  /** كلمات توجيه السؤال (تُطابَق ككلمات كاملة أو عبارات) — عربي وإنجليزي. */
  keywords: string[];
}

/** أقسام الموقع — كل قسم له استشاريون، وأولهم هو المستشار الرئيسي للقسم. */
export interface SiteSection {
  id: string;
  titleAr: string;
  titleEn: string;
  consultants: SpecialistId[];
}

const CONSULT_NOTE_AR = 'يستشاره الزائر وأقسام الموقع كلها في أي وقت حتى من غير إنترنت؛ يرد من علوم مدرسة شاهين وذاكرته ومكتبته ومكتوب على رده مصده. لو الإجابة مش موجودة يقول بصراحة إنه هيذاكر السؤال — الصراحة أحسن من التخمين.';

export const SPECIALISTS: Specialist[] = [
  {
    id: 'specialist_scents',
    nameAr: 'د. ليان العطور',
    nameEn: 'Dr. Layan Al-Atyar — perfume & chemistry specialist',
    fieldAr: 'العطور والكيمياء',
    fieldEn: 'Perfume & chemistry',
    tracks: ['perfume', 'chemistry'],
    sciencesAr: 'العطور وصناعتها والخلطات والهرم العطري والمواد الخام وتعبئتها، والكيمياء العضوية والتحليلية والصناعية والخضراء',
    sciencesEn: 'Perfume making, formulas, the scent pyramid, raw materials and packaging; organic, analytical, industrial and green chemistry',
    keywords: ['عطر', 'عطور', 'عطورات', 'عطرة', 'عطري', 'رائحة', 'روائح', 'نوتة', 'نوتات', 'خلطة', 'خلطات', 'تركيبة', 'تركيبات', 'تركيز', 'تخمير', 'نضج', 'كحول', 'برغموت', 'عود', 'مسك', 'عنبر', 'فانيليا', 'باتشولي', 'نيرولي', 'لافندر', 'ورد', 'ياسمين', 'صندل', 'زهر', 'زهرة', 'أزهار', 'زيت', 'زيوت', 'تقطير', 'عبوة', 'تعبئة', 'فوحان', 'ثبات', 'هرم', 'معمل', 'مواد خام', 'مادة خام', 'كيمياء', 'كيميائي', 'كيميائية', 'محلول', 'مذيب', 'مولية', 'تفاعل', 'perfume', 'fragrance', 'scent', 'note', 'oud', 'musk', 'amber', 'vanilla', 'bergamot', 'maceration', 'distill', 'essential oil', 'chemistry', 'chemical', 'molecule', 'molarity'],
  },
  {
    id: 'specialist_tech',
    nameAr: 'م. عمر الحاسوب',
    nameEn: 'Eng. Omar Al-Hasib — computing & AI specialist',
    fieldAr: 'الحوسبة والذكاء الاصطناعي',
    fieldEn: 'Computing & AI',
    tracks: ['prog_langs', 'blocks', 'software', 'graphics', 'web_care', 'ai_science', 'quantum', 'ai_tools', 'ai_projects', 'it_sciences'],
    sciencesAr: 'لغات البرمجة وبلوكاتها، وهندسة البرمجة، والجرافيك والديزاين، وصيانة المواقع، والذكاء الاصطناعي ومهاراته وأدواته ومشاريعه، وعلوم تقنية المعلومات، والحوسبة الكمية',
    sciencesEn: 'Programming languages and blocks, software engineering, graphics and design, web care, artificial intelligence (skills, tools, projects), IT sciences and quantum computing',
    keywords: ['برمج', 'برمجة', 'برمجيات', 'كود', 'خوارزمية', 'خوارزميات', 'الذكاء الاصطناعي', 'ذكاء اصطناعي', 'تعلم الآلي', 'شبكة عصبونية', 'قاعدة بيانات', 'قواعد البيانات', 'خادم', 'خوادم', 'استضافة', 'نطاق', 'موقع', 'مواقع', 'ويب', 'واجهة', 'واجهات', 'تطبيق', 'تطبيقات', 'بلوكات', 'جدولة', 'بايثون', 'جافا', 'جافاسكريبت', 'رست', 'لعبة', 'ألعاب', 'جرافيك', 'تصميم', 'ديزاين', 'ألوان', 'خطوط', 'حاسوب', 'كمبيوتر', 'سحابة', 'تخزين', 'كمية', 'بنية', 'اختبار برمجي', 'ai', 'programming', 'code', 'algorithm', 'software', 'database', 'server', 'website', 'web', 'design', 'graphic', 'block', 'coding', 'python', 'javascript', 'quantum', 'model', 'api'],
  },
  {
    id: 'specialist_security',
    nameAr: 'م. سيف الأمن',
    nameEn: 'Eng. Seif Al-Amn — cybersecurity specialist',
    fieldAr: 'الأمن السيبراني',
    fieldEn: 'Cybersecurity',
    tracks: ['security'],
    sciencesAr: 'أمن المعلومات: الهجمات والدفاع عنها، والتشفير والمصادقة، وحماية كلمات السر والخصوصية، والاستجابة للحوادث والتشفير ما بعد الكم',
    sciencesEn: 'Information security: attacks and defence, encryption and authentication, passwords and privacy, incident response and post-quantum cryptography',
    keywords: ['أمن', 'أمان', 'حماية', 'اختراق', 'قرصنة', 'هجوم', 'هجمات', 'تصيّد', 'تصيد', 'تشفير', 'كلمة سر', 'كلمات سر', 'كلمة مرور', 'مصادقة', 'ثغرة', 'ثغرات', 'برمجية خبيثة', 'فيروس', 'جدار حماية', 'خصوصية', 'سيبراني', 'استجابة للحوادث', 'security', 'hacking', 'encryption', 'cryptograph', 'phishing', 'malware', 'password', 'breach', 'vulnerability', 'authentication', 'privacy', 'cyber', 'firewall'],
  },
  {
    id: 'specialist_science',
    nameAr: 'د. هند العلوم',
    nameEn: 'Dr. Hind Al-Ulum — science & math specialist',
    fieldAr: 'الفيزياء والرياضيات والعلوم النادرة',
    fieldEn: 'Physics, math & frontier sciences',
    tracks: ['physics', 'math', 'frontier'],
    sciencesAr: 'الفيزياء وقوانينها (الميكانيكا والكهرباء والضوء والصوت والنسبية والكم والنووي والفلك)، والرياضيات (الجبر والتفاضل والاحتمالات والإحصاء والمصفوفات)، والعلوم النادرة (البصريات والصوتيات والبلورات والنانو والمياه والتربة)',
    sciencesEn: 'Physics and its laws (mechanics, electricity, light, sound, relativity, quantum, nuclear, astronomy), mathematics (algebra, calculus, probability, statistics, matrices) and frontier sciences (optics, acoustics, crystals, nano, water, soil)',
    keywords: ['فيزياء', 'فيزيائي', 'رياضيات', 'رياضية', 'معادلة', 'معادلات', 'جبر', 'تفاضل', 'تكامل', 'احتمالات', 'إحصاء', 'إحصائي', 'مصفوفة', 'مصفوفات', 'تسارع', 'طاقة', 'حرارة', 'ضوء', 'صوت', 'كهرباء', 'مغناطيس', 'نسبية', 'نووي', 'فلك', 'نجم', 'نجوم', 'مجرة', 'بصريات', 'صوتيات', 'بلورات', 'نانو', 'ميكانيكا', 'جاذبية', 'نيوتن', 'أينشتاين', 'physics', 'math', 'mathematics', 'equation', 'algebra', 'calculus', 'probability', 'statistics', 'matrix', 'energy', 'force', 'velocity', 'acceleration', 'optics', 'acoustic', 'crystal', 'nano', 'mechanics', 'astronomy', 'frontier'],
  },
  {
    id: 'specialist_business',
    nameAr: 'أ. طارق التجارة',
    nameEn: 'Tarek Al-Tigara — commerce, law & management specialist',
    fieldAr: 'التجارة والقانون والإدارة والعلاقات العامة',
    fieldEn: 'Commerce, law, management & PR',
    tracks: ['commerce', 'law', 'pr', 'management'],
    sciencesAr: 'التجارة والتجارة الدولية (التسويق والتمويل والمحاسبة واللوجستيات والتصدير وجودة المنتج وحماية المستهلك)، والقوانين المحلية والدولية والعقلية والجريمة الإلكترونية، والإدارة التقنية والعامة والمشاريع والقيادة والمخاطر، والعلاقات العامة وإدارة السمعة والأزمات',
    sciencesEn: 'Commerce and international trade (marketing, finance, accounting, logistics, export, quality, consumer protection), local and international law, technical and general management, projects, leadership, risks, public relations, reputation and crisis management',
    keywords: ['تجارة', 'تجاري', 'تسويق', 'مبيعات', 'شراء', 'بيع', 'سعر', 'أسعار', 'تكلفة', 'تكاليف', 'ربح', 'خسارة', 'محاسبة', 'مالية', 'تمويل', 'استثمار', 'شحن', 'توصيل', 'لوجستيات', 'تصدير', 'استيراد', 'جمارك', 'قانون', 'قوانين', 'قانوني', 'عقد', 'عقود', 'اتفاقية', 'محكمة', 'دعوى', 'ملكية فكرية', 'علامة تجارية', 'إدارة', 'إداري', 'مشروع', 'مشاريع', 'قيادة', 'مخاطر', 'حوكمة', 'علاقات عامة', 'سمعة', 'أزمة', 'إعلام', 'صحافة', 'commerce', 'trade', 'marketing', 'sales', 'price', 'pricing', 'cost', 'profit', 'accounting', 'finance', 'investment', 'shipping', 'export', 'import', 'law', 'legal', 'contract', 'court', 'trademark', 'management', 'project', 'leadership', 'pr', 'reputation', 'crisis'],
  },
  {
    id: 'specialist_society',
    nameAr: 'أ. مريم المجتمع',
    nameEn: 'Mariam Al-Mujtama — humanities, society & psychology specialist',
    fieldAr: 'الإنسان والمجتمع والنفس',
    fieldEn: 'Humanities, society & psychology',
    tracks: ['history', 'geography', 'literature', 'social', 'psychology', 'cyber_psych', 'ux_psych'],
    sciencesAr: 'التاريخ والحضارات، والجغرافيا والمناخ، والأدب والشعر والرواية والفلسفة والترجمة، والعلوم الاجتماعية والسياسة والتربية والأخلاق، وعلم النفس وسلوك المستخدمين وتجربة المستخدم',
    sciencesEn: 'History and civilisations, geography and climate, literature, poetry, novels, philosophy and translation, social sciences, politics, education and ethics, psychology, user behaviour and user experience',
    keywords: ['تاريخ', 'تاريخي', 'حضارة', 'حضارات', 'إسلام', 'إسلامي', 'ثورة', 'ثورات', 'جغرافيا', 'جغرافي', 'مناخ', 'تضاريس', 'بلد', 'بلدان', 'مدينة', 'مدن', 'أدب', 'شعر', 'قصة', 'رواية', 'مسرح', 'فلسفة', 'ترجمة', 'لغة', 'لغات', 'نحو', 'بلاغة', 'مجتمع', 'اجتماع', 'إنسان', 'سياس', 'اقتصاد', 'تربية', 'تعليم', 'أخلاق', 'عولمة', 'نفس', 'نفسي', 'سلوك', 'ذاكرة', 'دافعية', 'شخصية', 'انفعال', 'قلق', 'إدمان', 'تجربة المستخدم', 'history', 'civilization', 'geography', 'climate', 'literature', 'poetry', 'novel', 'philosophy', 'translation', 'language', 'society', 'social', 'politics', 'economy', 'education', 'ethics', 'psychology', 'behavior', 'memory', 'emotion', 'anxiety', 'addiction', 'ux', 'user experience'],
  },
  {
    id: 'specialist_health',
    nameAr: 'د. سلمى الحياة',
    nameEn: 'Dr. Salma Al-Hayat — life & medical sciences specialist',
    fieldAr: 'العلوم البيولوجية والطب والصحة',
    fieldEn: 'Life sciences, medicine & health',
    tracks: ['biology', 'medicine'],
    sciencesAr: 'علم الأحياء والخلية والنبات والحيوان والتشريح والوظائف والوراثة والتكنولوجيا الحيوية والمناعة، والطب والصيدلة والتمريض والإسعافات والتغذية والصحة العامة والأوبئة والأسنان والبيطري والعلاج الطبيعي',
    sciencesEn: 'Biology, cells, plants, animals, anatomy, physiology, genetics, biotechnology and immunity; medicine, pharmacy, nursing, first aid, nutrition, public health, epidemiology, dentistry, veterinary and physiotherapy',
    keywords: ['أحياء', 'بيولوجيا', 'خلية', 'خلايا', 'نبات', 'حيوان', 'تشريح', 'أعضاء', 'وراثة', 'جينات', 'جين', 'مناعة', 'مناعي', 'عدوى', 'أمراض', 'مرض', 'أنسجة', 'تطور', 'أحفور', 'ميكروبات', 'بكتيريا', 'فيروس', 'طب', 'طبي', 'طبيب', 'دواء', 'أدوية', 'صيدلة', 'صيدلي', 'تمريض', 'ممرض', 'إسعافات', 'تغذية', 'غذاء', 'صحة', 'أوبئة', 'وباء', 'أسنان', 'طبيبة', 'بيطري', 'علاج طبيعي', 'إصابات', 'جراحة', 'جهاز المناعة', 'biology', 'cell', 'medicine', 'medical', 'health', 'pharmacy', 'drug', 'nursing', 'nutrition', 'epidemic', 'anatomy', 'genetics', 'immune', 'virus', 'dentist', 'veterinary'],
  },
  {
    id: 'specialist_engineering',
    nameAr: 'م. ياسين الهندسة',
    nameEn: 'Eng. Yassin Al-Handasa — engineering & earth sciences specialist',
    fieldAr: 'الهندسة وعلوم الأرض والفضاء',
    fieldEn: 'Engineering, earth & space sciences',
    tracks: ['engineering', 'earth_space'],
    sciencesAr: 'الهندسة المدنية والميكانيكية والكهربائية والإلكترونيات والصناعية والعمارة والبترول والمناجم والطيران والبحرية والميكاترونكس والطاقة والسيارات، وعلوم الأرض والبيئة والتنوّع والاستدامة وتغير المناخ والآثار والجيوفيزياء والأحافير والفضاء والأقمار',
    sciencesEn: 'Civil, mechanical, electrical, electronics, industrial, architecture, petroleum, mining, aerospace, marine, mechatronics, energy and automotive engineering; earth and environment sciences, sustainability, climate change, archaeology, geophysics, fossils, space and satellites',
    keywords: ['هندسة', 'مهندس', 'مدنية', 'إسكانية', 'جسور', 'طرق', 'ميكانيكا', 'كهرباء', 'كهربائية', 'إلكترونيات', 'صناعية', 'تصنيع', 'عمارة', 'معماري', 'بترول', 'مناجم', 'طيران', 'فضاء', 'بحرية', 'سفن', 'ميكاترونكس', 'روبوتات', 'طاقة', 'نووي', 'سيارات', 'محرك', 'زراعة', 'سلامة مهنية', 'بيئة', 'بيئي', 'تنوّع حيوي', 'استدامة', 'مناخ', 'تلوث', 'تدوير', 'آثار', 'أثري', 'جيوفيزياء', 'أحافير', 'كواكب', 'أقمار', 'رياح', 'مياه موارد', 'engineering', 'civil', 'mechanical', 'electrical', 'electronics', 'architecture', 'petroleum', 'mining', 'aerospace', 'marine', 'robotics', 'energy', 'nuclear', 'automotive', 'ecology', 'environment', 'sustainability', 'climate', 'pollution', 'archaeology', 'satellite', 'planet', 'fossil'],
  },
  {
    id: 'specialist_learning',
    nameAr: 'أ. نورة التربية',
    nameEn: 'Noura Al-Tarbiya — education & information sciences specialist',
    fieldAr: 'التربية والتعليم والاعلام وعلوم المعلومات',
    fieldEn: 'Education & information sciences',
    tracks: ['education', 'media_info'],
    sciencesAr: 'المناهج وطرق التدريس والتربية الخاصة والقياس والتقويم والتعليم الإلكتروني وتكنولوجيا التعليم ودمج ذوي الإعاقة، والاعلام والصحافة والتحقق من المعلومات ومحو الأمية الإعلامية وعلوم المكتبات والأرشيف وعلم البيانات',
    sciencesEn: 'Curricula, teaching methods, special education, assessment, e-learning and inclusion; media, journalism, fact-checking, media literacy, library sciences, archives and data science',
    keywords: ['تربية', 'تعليم', 'تعليمي', 'مناهج', 'منهج', 'تدريس', 'معلم', 'معلمة', 'طالب', 'طلاب', 'مدرسة', 'صف', 'تربية خاصة', 'إعاقة', 'قياس', 'تقويم', 'امتحان', 'تعليم إلكتروني', 'تكنولوجيا التعليم', 'مهووبين', 'امية', 'إعلام', 'إعلامي', 'صحافة', 'صحفي', 'إذاعة', 'تلفزيون', 'تحقق', 'تضليل', 'مكتبات', 'مكتبة', 'أرشيف', 'وثائق', 'فهرسة', 'بيانات', 'ضخمة', 'نشر علمي', 'education', 'teaching', 'curriculum', 'school', 'student', 'special education', 'assessment', 'elearning', 'media', 'journalism', 'factcheck', 'library', 'archive', 'data science', 'big data'],
  },
  {
    id: 'specialist_culture',
    nameAr: 'أ. رضا الثقافة',
    nameEn: 'Reda Al-Thaqafa — arts, sports, faith & diplomacy specialist',
    fieldAr: 'الرياضة والفنون والفلسفة والعقائد والسياحة والعلاقات الدولية',
    fieldEn: 'Sports, arts, philosophy, faith, tourism & international relations',
    tracks: ['sports', 'arts', 'religion', 'tourism_ir'],
    sciencesAr: 'علوم الرياضة والتدريب والتغذية الرياضية والطب الرياضي، والفنون (الرسم والنحت والخط والموسيقى والسينما والتصوير والطهي)، والفلسفة والمنطق والأخلاق والدراسات الإسلامية والدينية المقارنة، وعلم السياحة والضيافة والعلاقات الدولية والدبلوماسية',
    sciencesEn: 'Sports science and training; arts (drawing, sculpture, calligraphy, music, cinema, photography, culinary); philosophy, logic, ethics, Islamic and comparative religion studies; tourism, hospitality, international relations and diplomacy',
    keywords: ['رياضة', 'رياضي', 'تدريب', 'لياقة', 'سباحة', 'قتالية', 'فنون', 'فن', 'رسم', 'نحت', 'خط عربي', 'موسيقى', 'نغمة', 'آلات', 'غناء', 'سينما', 'إخراج', 'تمثيل', 'مونتاج', 'تصوير', 'ديكور', 'طهي', 'طبخ', 'فلسفة', 'منطق', 'أخلاق', 'إسلام', 'إسلامي', 'قرآن', 'سنة نبوية', 'فقه', 'سيرة', 'أديان', 'ديانات', 'عقائد', 'سياحة', 'سياحي', 'فنادق', 'ضيافة', 'سفر', 'علاقات دولية', 'دبلوماسية', 'مفاوضات', 'منظمات دولية', 'نزاعات', 'رياضة ذوي الإعاقة', 'sports', 'sport', 'training', 'fitness', 'swimming', 'art', 'drawing', 'sculpture', 'calligraphy', 'music', 'cinema', 'acting', 'photography', 'cooking', 'philosophy', 'logic', 'islam', 'quran', 'religion', 'tourism', 'hotel', 'hospitality', 'diplomacy', 'negotiation', 'international relations'],
  },
];

/** أقسام الموقع كما تُفتح فعلياً في التطبيق — كل قسم له استشاريوه من المتخصصين. */
export const SITE_SECTIONS: SiteSection[] = [
  { id: 'home', titleAr: 'الرئيسية', titleEn: 'Home', consultants: ['specialist_scents', 'specialist_society', 'specialist_tech', 'specialist_health', 'specialist_culture'] },
  { id: 'store', titleAr: 'المتجر', titleEn: 'Store', consultants: ['specialist_scents', 'specialist_business'] },
  { id: 'productDetail', titleAr: 'صفحة المنتج', titleEn: 'Product page', consultants: ['specialist_scents', 'specialist_business'] },
  { id: 'concentration', titleAr: 'حاسبة التركيز', titleEn: 'Concentration calculator', consultants: ['specialist_scents', 'specialist_science'] },
  { id: 'pyramid', titleAr: 'حاسبة الهرم العطري', titleEn: 'Scent pyramid calculator', consultants: ['specialist_scents'] },
  { id: 'costing', titleAr: 'حاسبة التكلفة', titleEn: 'Costing calculator', consultants: ['specialist_business', 'specialist_scents'] },
  { id: 'guide', titleAr: 'دليل صناعة العطور', titleEn: 'Perfume guide', consultants: ['specialist_scents', 'specialist_society', 'specialist_health'] },
  { id: 'alcohol', titleAr: 'الكحول في العطور', titleEn: 'Alcohol in perfumes', consultants: ['specialist_science', 'specialist_scents', 'specialist_health'] },
  { id: 'maceration_simulator', titleAr: 'محاكي التخمير والنضج', titleEn: 'Maceration simulator', consultants: ['specialist_science', 'specialist_scents'] },
  { id: 'master_ai', titleAr: 'الخبير شاهين', titleEn: 'Shaheen the expert', consultants: ['specialist_tech', 'specialist_security', 'specialist_engineering'] },
  { id: 'perfume_news', titleAr: 'أخبار العطور', titleEn: 'Perfume news', consultants: ['specialist_society', 'specialist_business', 'specialist_culture'] },
  { id: 'raw_materials', titleAr: 'المواد الخام', titleEn: 'Raw materials', consultants: ['specialist_scents', 'specialist_health'] },
  { id: 'world_perfumes', titleAr: 'عطور العالم', titleEn: 'World perfumes', consultants: ['specialist_society', 'specialist_scents', 'specialist_culture'] },
  { id: 'molecule_studio', titleAr: 'استوديو الجزيئات', titleEn: 'Molecule studio', consultants: ['specialist_science', 'specialist_tech', 'specialist_engineering'] },
  { id: 'library', titleAr: 'مكتبة شاهين', titleEn: "Shaheen's library", consultants: ['specialist_society', 'specialist_scents', 'specialist_learning', 'specialist_culture'] },
  { id: 'community', titleAr: 'المجتمع', titleEn: 'Community', consultants: ['specialist_society', 'specialist_business', 'specialist_health', 'specialist_learning', 'specialist_culture'] },
  { id: 'admin_panel', titleAr: 'لوحة الإدارة', titleEn: 'Admin panel', consultants: ['specialist_business', 'specialist_tech', 'specialist_security', 'specialist_engineering'] },
];

export const specialistOf = (id: string): Specialist | undefined => SPECIALISTS.find((s) => s.id === id);
export const specialistsOf = (sectionId: string): Specialist[] => {
  const section = SITE_SECTIONS.find((s) => s.id === sectionId);
  return (section?.consultants ?? []).map((id) => specialistOf(id)).filter((s): s is Specialist => Boolean(s));
};
export const primaryOf = (sectionId: string): Specialist | undefined => specialistsOf(sectionId)[0];
export const sectionsOf = (id: SpecialistId): SiteSection[] => SITE_SECTIONS.filter((s) => s.consultants.includes(id));

const normalize = (text: string) => text
  .toLowerCase()
  .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
  .replace(/[أإآٱ]/g, 'ا')
  .replace(/ة/g, 'ه')
  .replace(/ى/g, 'ي');

const wordsOf = (text: string) => normalize(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
/** الكلمة مع صورها: من غير حروف العطف/الجر الموصولة (والفزياء ← فيزياء) ومن غير أداة التعريف «ال» (العود ← عود). */
const formsOf = (w: string): string[] => {
  const out = [w];
  let x = w;
  for (const p of ['و', 'ف', 'ب', 'ل', 'ك']) {
    if (x.length > 5 && x.startsWith(p) && !x.startsWith('ال')) { x = x.slice(p.length); out.push(x); } else break;
  }
  for (const f of [...out]) if (f.length > 4 && f.startsWith('ال')) out.push(f.slice(2));
  return out;
};

/** درجة تطابق السؤال مع تخصص: العبارات تُطابَق كنص (درجتين)، والكلمات الطويلة بالمطابقة أو البداية (درجة)، والقصيرة كلمة كاملة (درجتين). */
export function matchScore(question: string, keywords: string[]): number {
  const flat = ` ${wordsOf(question).join(' ')} `;
  const forms = wordsOf(question).flatMap(formsOf);
  let score = 0;
  for (const k of keywords) {
    const key = normalize(k);
    if (key.includes(' ')) { if (flat.includes(` ${key} `) || flat.includes(` ${key}`) || flat.includes(`${key} `)) score += 2; continue; }
    if (key.length <= 3) { if (forms.includes(key)) score += 2; continue; }
    if (forms.some((w) => w === key)) score += 2;
    else if (forms.some((w) => w.startsWith(key))) score += 1;
  }
  return score;
}

/**
 * توجيه السؤال لأقرب متخصص: كلمات السؤال تُطابَق مع كلمات تخصص كل متخصص، والأعلى نقاطاً يفوز؛
 * لو مفيش إشارة، المستشار الرئيسي للقسم الحالي، وإلا متخصص العطور (جوهر المنصة).
 */
export function pickSpecialist(question: string, sectionId?: string): Specialist {
  let best: Specialist | undefined;
  let bestScore = 0;
  for (const s of SPECIALISTS) {
    const score = matchScore(question, s.keywords);
    if (score > bestScore) { best = s; bestScore = score; }
  }
  return best ?? primaryOf(sectionId ?? '') ?? SPECIALISTS[0];
}

export type ConsultSourceKind = 'refuge' | 'memory' | 'library' | 'gap';

export interface ConsultSources {
  /** «ملجأ شاهين»: الوصول لأي حاجة في المنظومة (تقارير وأدوات وأقسام وعلوم وقرارات) — ييجي الأول لو السؤال سؤال وصول. */
  refuge?(question: string, lang: string): string | undefined | Promise<string | undefined>;
  /** أقرب سؤال في ذاكرة شاهين (نفس اللغة أولى). */
  recall(question: string, lang: string): { answer: string } | undefined | Promise<{ answer: string } | undefined>;
  /** رد من موسوعة المواد ودروس المكتبة والذاكرة — بدون ذكاء اصطناعي. */
  library?(question: string, lang: string): string | undefined | Promise<string | undefined>;
}

export interface Consultation {
  specialist: Specialist;
  question: string;
  answer: string;
  source: ConsultSourceKind;
  /** true = رد من العلوم؛ false = فجوة صريحة (مفيش تخمين). */
  ok: boolean;
  section?: string;
}

/**
 * استشارة متخصص في أي وقت: «ملجأ شاهين» الأول لو السؤال سؤال وصول لأي حاجة، ثم ذاكرة شاهين
 * ثم مكتبته، وإلا فجوة صريحة باسم المتخصص («هيذاكر السؤال») — بدون إنترنت وبدون ذكاء اصطناعي وبدون تخمين.
 */
export async function consult(
  question: string,
  lang: string,
  sources: ConsultSources,
  sectionId?: string,
  specialistId?: SpecialistId,
): Promise<Consultation> {
  const specialist = (specialistId && specialistOf(specialistId)) || pickSpecialist(question, sectionId);
  const q = question.trim();
  const viaRefuge = await sources.refuge?.(q, lang);
  if (viaRefuge) return { specialist, question: q, answer: viaRefuge, source: 'refuge', ok: true, section: sectionId };
  const remembered = await sources.recall(q, lang);
  if (remembered?.answer) return { specialist, question: q, answer: remembered.answer, source: 'memory', ok: true, section: sectionId };
  const fromLibrary = await sources.library?.(q, lang);
  if (fromLibrary) return { specialist, question: q, answer: fromLibrary, source: 'library', ok: true, section: sectionId };
  const answer = lang === 'en'
    ? `Your question is not in Shaheen's memory or library yet, and guessing is forbidden. ${specialist.nameEn} — ${specialist.fieldEn} — will study it and answer later. Try rephrasing with clearer words in the meantime.`
    : `سؤالك ده لسه مش في ذاكرة شاهين ولا في مكتبته، والتخمين ممنوع. «${specialist.nameAr}» (${specialist.fieldAr}) هيذاكره ويترد عليك بعدين. جرّب تعيد صياغته بكلمات أوضح. ${CONSULT_NOTE_AR}`;
  return { specialist, question: q, answer, source: 'gap', ok: false, section: sectionId };
}
