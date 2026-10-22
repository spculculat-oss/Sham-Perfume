import type { ScienceTrack } from './types';
import { HUMAN_MEDICINE_LESSONS } from './humanMedicine';
import { VETERINARY_LESSONS } from './veterinary';
import { SPACE_LESSONS } from './space';
import { WAR_STUDIES_LESSONS } from './warStudies';
import { ELECTRONIC_WARFARE_LESSONS } from './electronicWarfare';
import { NUCLEAR_LESSONS } from './nuclear';
import { BIOSAFETY_LESSONS } from './biosafety';
import { SEMICONDUCTOR_LESSONS } from './semiconductors';
import { EARTH_LESSONS } from './earth';
import { CHEMISTRY_LESSONS } from './chemistry';
import { PHYSICS_LESSONS } from './physics';
import { BIOLOGY_LESSONS } from './biology';
import { MATH_LESSONS } from './math';
import { COMPUTING_LESSONS } from './computing';
import { NUTRITION_LESSONS } from './nutrition';
import { AGRICULTURE_LESSONS } from './agriculture';

export * from './types';

/**
 * «علوم الأرض عند شاهين»: the sixteen tracks, in the order he studies them. The first four are the ones visitors
 * ask about most (body, animals, space, earth); the rest are studied in the same run. The last seven (chemistry,
 * physics, biology, mathematics, computing, nutrition, agriculture) were added for «وكيل شاهين»'s experts (2026-10-22).
 */
export const SCIENCE_TRACKS: ScienceTrack[] = [
  {
    id: 'human-medicine', titleAr: 'الطب البشري', titleEn: 'Human medicine',
    summaryAr: 'أجهزة الجسم، القلب والتنفس والأعصاب، المناعة والتطعيم، الاستقلاب والكلى، العدوى، والإسعاف الأولي.',
    boundaryAr: 'تعليم عام فقط: مفيش تشخيص ولا وصفات ولا جرعات، وأي شكوى شخصية مكانها الطبيب.',
    lessons: HUMAN_MEDICINE_LESSONS,
  },
  {
    id: 'veterinary', titleAr: 'الطب البيطري', titleEn: 'Veterinary medicine',
    summaryAr: 'تشريح الحيوان، الطب الوقائي في المزارع، الأمراض المشتركة، تغذية المجترات، الحيوانات الأليفة والخيل والإبل، الدواجن، وسلامة الغذاء.',
    boundaryAr: 'إرشاد بيطري عام: مفيش جرعات ولا علاج ذاتي، والقرار للطبيب البيطري المرخّص.',
    lessons: VETERINARY_LESSONS,
  },
  {
    id: 'space', titleAr: 'علوم الفضاء وصواريخ الإطلاق', titleEn: 'Space science and launch vehicles',
    summaryAr: 'المدارات، مبدأ الدفع، المحركات والوقود، المراحل والهيكل، التوجيه والملاحة، رحلة الإطلاق، الأقمار، وأمن الفضاء.',
    boundaryAr: 'فضاء مدني سلمي: مفيش تصميم أسلحة ولا رؤوس حربية ولا استهداف ولا تكامل عسكري.',
    lessons: SPACE_LESSONS,
  },
  {
    id: 'war-studies', titleAr: 'دراسات الحرب والاستراتيجية', titleEn: 'War and strategic studies',
    summaryAr: 'الاستراتيجية، مستويات الحرب، اللوجستيات، الاستخبارات، الردع وإدارة التصعيد، القانون الدولي الإنساني، الحروب غير المتماثلة، وبناء السلام.',
    boundaryAr: 'دراسة أكاديمية وقانونية: مفيش تكتيكات إيذاء ولا استهداف ولا خطط عمليات ولا تعليمات تصنيع.',
    lessons: WAR_STUDIES_LESSONS,
  },
  {
    id: 'electronic-warfare', titleAr: 'الحرب الإلكترونية والطيف', titleEn: 'Electronic warfare and spectrum',
    summaryAr: 'الطيف والرادار، مكونات الحرب الإلكترونية، فهم التشويش، مقاومته، إدارة الانبعاثات، الملاحة والتوقيت، أمن أنظمة التحكم، والقانون.',
    boundaryAr: 'مفاهيم دفاعية: مفيش تعليمات بناء أجهزة تشويش ولا خطط هجوم ولا استهداف.',
    lessons: ELECTRONIC_WARFARE_LESSONS,
  },
  {
    id: 'nuclear', titleAr: 'العلوم النووية', titleEn: 'Nuclear science',
    summaryAr: 'بنية النواة، الانشطار والاندماج، المفاعلات، الإشعاع والحماية، النظائر في الطب والصناعة، الحوادث، الضمانات، والنفايات.',
    boundaryAr: 'فيزياء سلمية ووقاية وضمانات: مفيش تصميم أسلحة ولا تعليمات تعامل مع مواد انشطارية.',
    lessons: NUCLEAR_LESSONS,
  },
  {
    id: 'biosafety', titleAr: 'السلامة والأمن البيولوجي', titleEn: 'Biosafety and biosecurity',
    summaryAr: 'الأحياء الدقيقة، الوبائيات، التشخيص الجيني، اللقاحات، مقاومة المضادات الحيوية، مستويات المعامل، اتفاقية الأسلحة البيولوجية، والصحة الواحدة.',
    boundaryAr: 'صحة عامة ووقاية: مفيش تعزيز خطورة مسببات المرض ولا إنتاج أو نشر ولا تعليمات تسليح.',
    lessons: BIOSAFETY_LESSONS,
  },
  {
    id: 'semiconductors', titleAr: 'إلكترونيات أشباه الموصلات', titleEn: 'Semiconductors and complex electronics',
    summaryAr: 'فيزياء أشباه الموصلات، تصميم الشرائح، تصنيع الويفر، الليثوغرافيا، التغليف والاختبار، تجميع اللوحات، الأنظمة المدمجة، وأمن سلسلة الإمداد.',
    boundaryAr: 'هندسة وتصنيع: مفيش نسخ دوائر محمية ولا اختراق ولا تعطيل أنظمة الغير.',
    lessons: SEMICONDUCTOR_LESSONS,
  },
  {
    id: 'earth', titleAr: 'علوم الأرض', titleEn: 'Earth sciences',
    summaryAr: 'بنية الأرض، الزلازل والبراكين، الصخور والمعادن، المياه، الغلاف الجوي والطقس، المناخ، المحيطات، التربة والتنوع الحيوي، والكوارث.',
    boundaryAr: 'علوم طبيعية وتطبيقات بيئية: مفيش تعليمات لأعمال تدميرية أو تلويث متعمد.',
    lessons: EARTH_LESSONS,
  },
  {
    id: 'chemistry', titleAr: 'الكيمياء', titleEn: 'Chemistry',
    summaryAr: 'الذرة والجدول الدوري، الروابط والجزيئات، التفاعلات ووزن المعادلات، الأحماض والقواعد، الكيمياء العضوية، والمحاليل وسلامة المعمل.',
    boundaryAr: 'كيمياء للفهم والصناعة الآمنة: مفيش تحضير متفجرات ولا سموم ولا مواد مخدرة، ولا خلط مواد خطرة في البيت.',
    lessons: CHEMISTRY_LESSONS,
  },
  {
    id: 'physics', titleAr: 'الفيزياء', titleEn: 'Physics',
    summaryAr: 'قوانين نيوتن والحركة، الطاقة وتحولاتها، الحرارة وانتقالها، الموجات والصوت والضوء، الكهرباء والمغناطيسية، والنسبية وميكانيكا الكم.',
    boundaryAr: 'فيزياء تعليمية وتطبيقات مدنية: مفيش تعليمات أسلحة ولا تعديل أجهزة بشكل خطر على الكهرباء أو الإشعاع.',
    lessons: PHYSICS_LESSONS,
  },
  {
    id: 'biology', titleAr: 'الأحياء', titleEn: 'Biology',
    summaryAr: 'الخلية، الحمض النووي والوراثة، البناء الضوئي والتنفس، التطور والانتقاء الطبيعي، النظم البيئية، والكائنات الدقيقة.',
    boundaryAr: 'أحياء عامة: مفيش تعديل كائنات ممرضة ولا تجارب على كائنات خارج المعامل المرخصة، والأسئلة الطبية مكانها الطبيب.',
    lessons: BIOLOGY_LESSONS,
  },
  {
    id: 'math', titleAr: 'الرياضيات', titleEn: 'Mathematics',
    summaryAr: 'النسب والتناسب، الجبر والمعادلات، الهندسة والمساحات والحجوم، الإحصاء، الاحتمالات، والتفاضل والتكامل.',
    boundaryAr: 'رياضيات للفهم والتطبيق: مفيش حل امتحانات نيابة عن الطالب أثناء الامتحان ولا وعود ربح في القمار.',
    lessons: MATH_LESSONS,
  },
  {
    id: 'computing', titleAr: 'الحاسبات والبرمجة', titleEn: 'Computing and programming',
    summaryAr: 'الكمبيوتر من جوه، الخوارزميات، أساسيات البرمجة، الإنترنت والشبكات، قواعد البيانات، والأمن السيبراني للمستخدم.',
    boundaryAr: 'حوسبة وحماية: مفيش اختراق حسابات أو أنظمة الغير ولا برامج ضارة ولا تجاوز حماية.',
    lessons: COMPUTING_LESSONS,
  },
  {
    id: 'nutrition', titleAr: 'التغذية', titleEn: 'Nutrition',
    summaryAr: 'العناصر الغذائية الكبرى، الفيتامينات والمعادن، توازن الطاقة والوزن، الماء والسوائل، سلامة الغذاء، والطبق الصحي.',
    boundaryAr: 'تغذية عامة: مفيش أنظمة علاجية ولا جرعات مكملات، وأصحاب الأمراض المزمنة والحوامل يرجعوا للطبيب أو أخصائي التغذية.',
    lessons: NUTRITION_LESSONS,
  },
  {
    id: 'agriculture', titleAr: 'الزراعة', titleEn: 'Agriculture',
    summaryAr: 'التربة والتسميد، الري وترشيد المياه، المحاصيل والمواسم، المكافحة المتكاملة للآفات، الزراعة المنزلية، والنباتات العطرية والطبية.',
    boundaryAr: 'زراعة آمنة: مفيش خلط مبيدات بنفسك ولا جرعات خارج الملصق، والمبيدات المسجلة بس وبإرشاد مهندس زراعي.',
    lessons: AGRICULTURE_LESSONS,
  },
];

export const SCIENCE_LESSONS = SCIENCE_TRACKS.flatMap((track) => track.lessons);

/** Track of a lesson id («earth-03» → earth), used by the report and the panel. */
export const SCIENCE_TRACK_BY_ID = Object.fromEntries(SCIENCE_TRACKS.map((t) => [t.id, t])) as Record<string, ScienceTrack>;
