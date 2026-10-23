/**
 * «ملجأ شاهين» — البوابة الموحدة للوصول لأي حاجة في المنظومة:
 * لشاهين نفسه، ولأي روبوت، ولأي قسم من أقسام الموقع — في أي وقت، بدون إنترنت وبدون ذكاء اصطناعي.
 *
 * الفهرس بيتبنى من السجلات الحية (BOTS، AI_TOOLS، LEGAL_DECISIONS، أقسام الموقع، المتخصصين)
 * ومن الأماكن الحقيقية في المستودع (تقارير src/data/live وسير العمل في .github/workflows) —
 * كل مورد بمكانه الحقيقي وصاحبه، من غير تخمين ولا مسارات مخترعة (اختبار بيتأكد إن كل مسار موجود فعلاً).
 *
 * بيخدم اتنين:
 * - المنظومة: أي روبوت عايز أي حاجة (تقرير، أداة، سير عمل، قسم، علم) يسأل الملجأ فيوصله.
 * - الدولة الداخلية (تنظيم المنظومة): الاجتماع اليومي، الفحص الشامل، الدورية بالتناوب، السكرتير،
 *   الكتيّب، الهيكل الإداري، وخريطة التشغيل — كلها مفهرسة ب أصحابها.
 */
import { AI_TOOLS, type AiToolDef } from './aiTools';
import { BOTS, LEGAL_DECISIONS, type Bot, type BotId } from './shaheenOrg';
import { matchScore, pickSpecialist, SITE_SECTIONS, SPECIALISTS } from './shaheenSpecialists';

export type RefugeKind =
  | 'robot' | 'tool' | 'report' | 'workflow' | 'section' | 'science' | 'engine' | 'rule' | 'panel' | 'state';

export interface RefugeEntry {
  /** المعرف الموحد: kind:slug */
  id: string;
  kind: RefugeKind;
  nameAr: string;
  nameEn: string;
  /** المكان الحقيقي: مسار ملف أو مسار سير عمل أو تبويب أو معرف — حقيقي دائماً. */
  at: string;
  noteAr: string;
  noteEn: string;
  /** الروبوت المسؤول عن المورد (لو موجود). */
  owner?: BotId;
  keywords: string[];
}

/** كلمات التحضير والربط مش دليل على أي حاجة — تتشال من الفهرسة. */
const STOP = new Set(['على', 'الى', 'إلى', 'هذا', 'هذه', 'ذلك', 'تلك', 'الذي', 'التي', 'اللي', 'كل', 'منه', 'منها', 'فيه', 'فيها', 'له', 'لها', 'كان', 'يكون', 'تكون', 'عند', 'منذ', 'خلال', 'ضمن', 'حول', 'حتى', 'بين', 'مثل', 'غير', 'اما', 'أما', 'لكن', 'أيضا', 'كذلك', 'الان', 'الآن', 'the', 'and', 'for', 'are', 'was', 'were', 'with', 'from', 'that', 'this', 'these', 'those', 'has', 'have', 'had', 'not', 'but', 'you', 'your', 'our', 'his', 'her', 'its', 'they', 'them', 'who', 'what', 'when', 'how', 'why', 'can', 'will', 'about', 'into', 'than', 'then', 'very']);
const words = (text: string) => [...new Set(text.split(/[\s()«»—–,.:]+/).filter((w) => w.length > 2 && !STOP.has(w.toLowerCase())))];

const botEntry = (b: Bot): RefugeEntry => ({
  id: `robot:${b.id}`, kind: 'robot', nameAr: b.nameAr, nameEn: b.nameEn,
  at: b.workflow ? `.github/workflows/${b.workflow}` : b.report ? `src/data/live/${b.report}` : 'src/utils/shaheenOrg.ts',
  noteAr: `روبوت في ${b.dept}${b.report ? ` — تقريره src/data/live/${b.report}` : ''}${b.workflow ? ` — يشغل ${b.workflow}` : ' — عند الطلب (بدون سير عمل آلي)'}`,
  noteEn: `Robot in ${b.dept}${b.report ? ` — report src/data/live/${b.report}` : ''}${b.workflow ? ` — runs ${b.workflow}` : ' — on demand'}`,
  owner: b.id,
  keywords: [b.id, ...b.id.split('_'), ...words(b.nameAr), ...words(b.nameEn)],
});

const toolEntry = (t: AiToolDef): RefugeEntry => ({
  id: `tool:${t.id}`, kind: 'tool', nameAr: t.nameAr, nameEn: t.nameEn,
  at: t.sources[0] ?? 'src/utils/aiTools.ts',
  noteAr: `أداة ذكاء اصطناعي تحت إشراف شاهين — التنفيذ: ${t.sources.join('، ')}${t.routes.length ? ` — واجهات: ${t.routes.join('، ')}` : ''}`,
  noteEn: `AI tool under Shaheen's supervision — implemented in ${t.sources.join(', ')}${t.routes.length ? ` — routes: ${t.routes.join(', ')}` : ''}`,
  keywords: ['أداة', 'أداة ذكاء', 'tool', t.id, ...t.id.split('_'), ...words(t.nameAr), ...words(t.nameEn), ...words(t.descriptionAr).slice(0, 8)],
});

/** التقارير الحية: كل ملف في src/data/live مفهرس — صاحبه الروبوت اللي بكتبه (أو صاحب المدرسة للذاكرة). */
const REPORT_OWNER: Record<string, BotId> = {
  'ai-memory.json': 'teacher', 'ai-quota.json': 'keys', 'ai-supervisor.json': 'school',
  'aistudio-bridge.json': 'studio_bridge', 'aistudio-intake.json': 'intake', 'fx-rates.json': 'finance',
  'image-clean.json': 'images', 'import-sources.json': 'scout', 'manus-audit.json': 'verifier',
  'manus-missions.json': 'verifier', 'seo-agent.json': 'seo', 'seo-pages.json': 'seo',
  'shaheen-blocks.json': 'school', 'shaheen-council.json': 'council', 'shaheen-languages.json': 'languages',
  'shaheen-memory.json': 'school', 'shaheen-news.json': 'news', 'shaheen-patrol.json': 'patrol', 'shaheen-maneuver.json': 'maneuver',
  'shaheen-precheck.json': 'precheck', 'shaheen-school.json': 'school', 'shaheen-skills.json': 'importer',
  'platform-state.json': 'state', 'platform-census.json': 'census', 'shaheen-harvest.json': 'academy', 'shaheen-sciences.json': 'academy', 'shaheen-lab.json': 'lab', 'shaheen-brain.json': 'brain',
  'sham-training.json': 'teacher', 'store-catalog.json': 'catalog', 'store-review.json': 'product_pages',
};
const REPORT_NAMES: Record<string, [string, string]> = {
  'ai-memory.json': ['ذاكرة محركات الذكاء الاصطناعي', 'AI engines memory'],
  'ai-quota.json': ['حالة باقات ومفاتيح الذكاء الاصطناعي', 'AI quota & keys status'],
  'ai-supervisor.json': ['تقييم شاهين لأدوات الذكاء الاصطناعي', "Shaheen's AI-tool scores"],
  'aistudio-bridge.json': ['تقرير بوابة استوديو التصميم', 'Design studio bridge report'],
  'aistudio-intake.json': ['تقرير استقبال تحديثات الاستوديو', 'Studio intake report'],
  'fx-rates.json': ['أسعار صرف العملات اليومية', 'Daily currency rates'],
  'image-clean.json': ['تقرير تنظيف الصور', 'Image cleaning report'],
  'import-sources.json': ['متاجر ومصادر الاستيراد', 'Import sources & stores'],
  'manus-audit.json': ['تدقيق المهام المغلقة', 'Closed-task audit'],
  'manus-missions.json': ['مهام التطوير', 'Development missions'],
  'seo-agent.json': ['تقرير المندوب الإعلامي', 'SEO agent report'],
  'seo-pages.json': ['الصفحات المنشورة للظهور في البحث', 'Published SEO pages'],
  'shaheen-blocks.json': ['برامج البلوكات المجدولة', 'Scheduled block programs'],
  'shaheen-council.json': ['محضر الاجتماع اليومي', 'Daily meeting minutes'],
  'shaheen-languages.json': ['تقرير اللغات والترجمة', 'Languages report'],
  'shaheen-memory.json': ['ذاكرة شاهين المشتركة', "Shaheen's shared memory"],
  'shaheen-news.json': ['نشرة الأخبار الحقيقية', 'Real-news bulletin'],
  'shaheen-patrol.json': ['تقرير الدورية بالتناوب', 'Rotating patrol report'],
  'shaheen-maneuver.json': ['تقرير مناورة التخصصات', 'Specialties field maneuver report'],
  'shaheen-precheck.json': ['الفحص الشامل قبل الاجتماع', 'Pre-meeting full check'],
  'shaheen-school.json': ['تقرير مدرسة شاهين (الاعتماد على النفس)', "Shaheen's school report"],
  'shaheen-skills.json': ['مهارات قراءة المتاجر', 'Store-reading skills'],
  'platform-state.json': ['دولة المنصة — القرارات والتصويتات', 'Platform state — decisions & votes'],
  'platform-census.json': ['خانة التعداد — تقرير وكشف زيارات العالم', 'State census — world visits report & open ledger'],
  'shaheen-harvest.json': ['حصّاد شاهين لإجابات الزوار', "Shaheen's visitor-answers harvester"],
  'shaheen-sciences.json': ['تقرير علوم الأرض عند شاهين', "Shaheen's earth-sciences track report"],
  'shaheen-lab.json': ['تقرير معمل شاهين للتجارب والابتكار', "Shaheen experiments lab report"],
  'shaheen-brain.json': ['تقرير مختبر عقل شاهين (بيانات التدريب والامتحانات والعقل المعتمد)', "Shaheen's brain lab report"],
  'sham-training.json': ['دروس تدريب مساعد شام', 'Sham assistant training lessons'],
  'store-catalog.json': ['كتالوج المتجر', 'Store catalogue'],
  'store-review.json': ['مراجعة صفحات المنتجات', 'Product pages review'],
};
const reportEntry = (file: string): RefugeEntry => {
  const [nameAr, nameEn] = REPORT_NAMES[file] ?? [file, file];
  const owner = REPORT_OWNER[file];
  return {
    id: `report:${file}`, kind: 'report', nameAr, nameEn, at: `src/data/live/${file}`,
    noteAr: `تقرير حي في src/data/live/${file}${owner ? ` — يكتبه «${BOTS.find((b) => b.id === owner)?.nameAr ?? owner}»` : ''}`,
    noteEn: `Live report at src/data/live/${file}`, owner,
    keywords: [file.replace('.json', ''), ...file.replace('.json', '').split('-'), ...words(nameAr), ...words(nameEn)],
  };
};

/** سير العمل: كل ملف في .github/workflows مفهرس بصاحبه. */
const WORKFLOW_OWNER: Record<string, BotId> = {
  'aistudio-bridge.yml': 'studio_bridge', 'aistudio-intake.yml': 'intake', 'aistudio-zip.yml': 'studio_zip',
  'live-smoke.yml': 'live_check', 'pages.yml': 'deploy', 'product-pages-check.yml': 'product_pages',
  'shaheen-council.yml': 'council', 'shaheen-discover.yml': 'school', 'shaheen-doctor.yml': 'doctor',
  'shaheen-finance.yml': 'finance', 'shaheen-import.yml': 'importer', 'shaheen-inspect.yml': 'inspect',
  'shaheen-keys.yml': 'keys', 'shaheen-languages.yml': 'languages', 'shaheen-manus.yml': 'verifier',
  'shaheen-news.yml': 'news', 'shaheen-patrol.yml': 'patrol', 'shaheen-maneuver.yml': 'maneuver', 'shaheen-precheck.yml': 'precheck',
  'shaheen-seo.yml': 'seo', 'owner-control.yml': 'owner_desk', 'platform-state.yml': 'state', 'platform-census.yml': 'census',
  'shaheen-school-clock.yml': 'academy', 'shaheen-lab.yml': 'lab', 'shaheen-brain.yml': 'brain',
};
const WORKFLOW_NAMES: Record<string, [string, string]> = {
  'aistudio-bridge.yml': ['بوابة استوديو التصميم', 'Design studio bridge'],
  'aistudio-intake.yml': ['استقبال تحديثات الاستوديو', 'Studio updates intake'],
  'aistudio-zip.yml': ['استلام ملفات الاستوديو المضغوطة', 'Studio zip download'],
  'live-smoke.yml': ['فحص شاهين على الموقع الحي', 'Live-site smoke check'],
  'pages.yml': ['بناء ونشر الموقع', 'Build & deploy Pages'],
  'product-pages-check.yml': ['فحص صفحات المنتجات', 'Product pages check'],
  'shaheen-council.yml': ['اجتماع شاهين اليومي', "Shaheen's daily council"],
  'shaheen-discover.yml': ['كشّاف المصادر ومدرسة شاهين', 'Sources scout & school'],
  'shaheen-doctor.yml': ['طبيب شاهين (الصيانة)', 'Shaheen doctor'],
  'shaheen-finance.yml': ['الإدارة المالية', 'Finance'],
  'shaheen-import.yml': ['مستورد شاهين', 'Shaheen importer'],
  'shaheen-inspect.yml': ['مفتش الردود', 'Answers inspector'],
  'shaheen-keys.yml': ['حارس المفاتيح', 'Keys keeper'],
  'shaheen-languages.yml': ['وكيل اللغات', 'Languages agent'],
  'shaheen-manus.yml': ['المراجع الخارجي', 'External reviewer'],
  'shaheen-news.yml': ['مرصد الأخبار', 'News observatory'],
  'shaheen-patrol.yml': ['الدورية بالتناوب', 'Rotating patrol'],
  'shaheen-maneuver.yml': ['مناورة التخصصات', 'Specialties field maneuver'],
  'shaheen-precheck.yml': ['الفحص الشامل', 'Full precheck'],
  'shaheen-seo.yml': ['منارة شاهين (SEO)', 'SEO lighthouse'],
  'owner-control.yml': ['أوامر صاحب الموقع', 'Owner control'],
  'platform-state.yml': ['دولة المنصة (التصويت)', 'Platform state (voting)'],
  'platform-census.yml': ['روبوت التعداد وإحصاء الزيارات', 'Platform state census & visit ledger'],
  'shaheen-school-clock.yml': ['أكاديمية شاهين على مدار الساعة', "Shaheen's academy clock"],
  'shaheen-lab.yml': ['تشغيل معمل شاهين للتجارب', 'Shaheen lab run'],
  'shaheen-brain.yml': ['مختبر عقل شاهين (ملفات التدريب والامتحان)', "Shaheen's brain lab (training data & exam)"],
};
const workflowEntry = (file: string): RefugeEntry => {
  const [nameAr, nameEn] = WORKFLOW_NAMES[file] ?? [file, file];
  const owner = WORKFLOW_OWNER[file];
  return {
    id: `workflow:${file}`, kind: 'workflow', nameAr, nameEn, at: `.github/workflows/${file}`,
    noteAr: `سير عمل على GitHub: .github/workflows/${file}${owner ? ` — يشغّله «${BOTS.find((b) => b.id === owner)?.nameAr ?? owner}»` : ''}`,
    noteEn: `GitHub workflow at .github/workflows/${file}`, owner,
    keywords: [file.replace('.yml', ''), ...file.replace('.yml', '').split('-'), ...words(nameAr), ...words(nameEn)],
  };
};

const sectionEntry = (id: string, titleAr: string, titleEn: string): RefugeEntry => ({
  id: `section:${id}`, kind: 'section', nameAr: titleAr, nameEn: titleEn, at: `#${id}`,
  noteAr: `قسم من أقسام الموقع — افتحه بالرابط #${id}`,
  noteEn: `Site section — open it at #${id}`,
  keywords: [id, ...id.split('_'), ...words(titleAr), ...words(titleEn), 'قسم', 'قسم الموقع'],
});

const scienceEntry = (id: string, nameAr: string, nameEn: string, fieldAr: string, fieldEn: string): RefugeEntry => ({
  id: `science:${id}`, kind: 'science', nameAr: `${nameAr} — ${fieldAr}`, nameEn, at: 'scripts/shaheen-school/curriculum.ts',
  noteAr: `متخصص علوم مدرسة شاهين (${fieldAr}) — يذاكر دروسه في scripts/shaheen-school/ ويجاوب من الذاكرة والمكتبة`,
  noteEn: `School sciences specialist (${fieldEn}) — curriculum at scripts/shaheen-school/`,
  owner: id as BotId,
  keywords: [id, ...id.split('_'), ...words(nameAr), ...words(fieldAr), ...words(fieldEn), 'متخصص', 'علوم'],
});

const ENGINES: RefugeEntry[] = [
  { id: 'engine:memory', kind: 'engine', nameAr: 'ذاكرة شاهين', nameEn: "Shaheen's memory", at: 'src/data/live/shaheen-memory.json', noteAr: 'الرد الأول بدون إنترنت: أقرب سؤال محفوظ في الذاكرة (src/utils/shaheenMemory.ts)', noteEn: 'First offline answer: the closest remembered question', owner: 'school', keywords: ['ذاكرة', 'الذاكرة', 'memory', 'تذكر', 'محفوظ'] },
  { id: 'engine:library', kind: 'engine', nameAr: 'مكتبة شاهين (رد بدون ذكاء اصطناعي)', nameEn: "Shaheen's library", at: 'src/utils/shaheenLibrary.ts', noteAr: 'رد من موسوعة المواد الخام والدروس والذاكرة (src/utils/shaheenLibrary.ts)', noteEn: 'Answers from materials, lessons and memory', owner: 'library', keywords: ['مكتبة', 'المكتبة', 'library', 'موسوعة', 'مواد خام'] },
  { id: 'engine:research', kind: 'engine', nameAr: 'باحث شاهين (المصادر المفتوحة)', nameEn: 'Shaheen researcher (open sources)', at: 'src/utils/webResearch.ts', noteAr: 'بحث في المصادر المفتوحة مع ذكر المصدر (src/utils/webResearch.ts)', noteEn: 'Open-sources research with citations', owner: 'researcher', keywords: ['باحث', 'بحث', 'research', 'مصادر مفتوحة', 'ويكيبيديا'] },
  { id: 'engine:school', kind: 'engine', nameAr: 'مدرسة شاهين (الاعتماد على النفس)', nameEn: "Shaheen's school", at: 'scripts/shaheen-school/', noteAr: 'الامتحان والمذاكرة والدروس: scripts/shaheen-school/ — والتقرير src/data/live/shaheen-school.json', noteEn: 'Exams, study and lessons: scripts/shaheen-school/', owner: 'school', keywords: ['مدرسة', 'المدرسة', 'school', 'مذاكرة', 'امتحان', 'دروس', 'منهج'] },
  { id: 'engine:teacher', kind: 'engine', nameAr: 'المعلم المحلي ومراجع الدروس', nameEn: 'Local teacher & lesson reviewer', at: 'scripts/shaheen-discover/', noteAr: 'نموذج محلي مفتوح على GitHub يكتب دروس الأسئلة الناقصة ويراجعها', noteEn: 'Open local model writing and reviewing missing lessons', owner: 'teacher', keywords: ['معلم', 'المعلم', 'teacher', 'دروس محلية', 'مراجع دروس'] },
  { id: 'engine:brain', kind: 'engine', nameAr: 'مختبر عقل شاهين (نموذجه الخاص)', nameEn: "Shaheen's brain lab (his own model)", at: 'scripts/shaheen-brain/', noteAr: 'ملفات التدريب من ذاكرته، والتدريب على كارت شاشة مجاني، والامتحان قبل الاعتماد — scripts/shaheen-brain/ و SHAHEEN_BRAIN.md', noteEn: 'Training data from his memory, LoRA on a free GPU, an exam before approval — scripts/shaheen-brain/, SHAHEEN_BRAIN.md', owner: 'brain', keywords: ['brain', 'model', 'lora', 'gguf', 'عقل', 'نموذج', 'تدريب', 'امتحان'] },
];

const STATE: RefugeEntry[] = [
  { id: 'state:council', kind: 'state', nameAr: 'الاجتماع اليومي للتطوير (دولة المنظومة الداخلية)', nameEn: 'Daily development council (internal state)', at: 'src/data/live/shaheen-council.json', noteAr: 'الاجتماع 10:15 بتوقيت القاهرة — المحضر src/data/live/shaheen-council.json والكود scripts/shaheen-council/', noteEn: 'Meeting at 10:15 Cairo — minutes at src/data/live/shaheen-council.json', owner: 'council', keywords: ['اجتماع', 'المجلس', 'council', 'محضر', 'الاجتماع اليومي', 'دولة', 'الدولة الداخلية'] },
  { id: 'state:census', kind: 'state', nameAr: 'خانة التعداد وخريطة العالم الحرارية (دولة المنصة)', nameEn: 'State census & interactive world heatmap', at: 'src/data/live/platform-census.json', noteAr: 'روبوت التعداد في هيكل دولة المنصة: إحصاء الزيارات والكشف العلني وخريطة العالم الحرارية التفاعلية — src/admin/PlatformCensusPanel.tsx والتقرير src/data/live/platform-census.json', noteEn: 'Platform State census robot, open visit ledger & interactive world heatmap — src/data/live/platform-census.json', owner: 'census', keywords: ['تعداد', 'التعداد', 'زيارات', 'الزيارات', 'كشف علني', 'خريطة العالم', 'حرارية', 'census', 'heatmap'] },
  { id: 'state:precheck', kind: 'state', nameAr: 'الفحص الشامل قبل الاجتماع', nameEn: 'Pre-meeting full check', at: 'src/data/live/shaheen-precheck.json', noteAr: 'بيفحص كل أداة وتقرير قبل الاجتماع بساعتين — src/data/live/shaheen-precheck.json', noteEn: 'Checks every tool and report two hours before the meeting', owner: 'precheck', keywords: ['فحص شامل', 'precheck', 'المشاكل', 'قبل الاجتماع'] },
  { id: 'state:maneuver', kind: 'state', nameAr: 'مناورة التخصصات (فحص ميداني)', nameEn: 'Specialties field maneuver', at: 'src/data/live/shaheen-maneuver.json', noteAr: 'كل 6 ساعات: أقسام الموقع الحي على الموبايل ومحادثات تدريب مع شاهين، والكود في scripts/shaheen-maneuver والتصنيف في src/utils/stateSectors.ts', noteEn: 'Every 6 hours: live sections on a phone + chat drills — scripts/shaheen-maneuver', owner: 'maneuver', keywords: ['مناورة', 'المناورة', 'maneuver', 'فحص ميداني', 'التخصصات'] },
  { id: 'state:patrol', kind: 'state', nameAr: 'الدورية بالتناوب (3 ورديات)', nameEn: 'Rotating patrol (3 shifts)', at: 'src/data/live/shaheen-patrol.json', noteAr: 'الدورية كل ساعة والورديات في scripts/shaheen-patrol/shifts.ts والتقرير src/data/live/shaheen-patrol.json', noteEn: 'Hourly patrol — shifts at scripts/shaheen-patrol/shifts.ts', owner: 'patrol', keywords: ['دورية', 'الدورية', 'patrol', 'وردية', 'ورديات', 'تناوب'] },
  { id: 'state:secretary', kind: 'state', nameAr: 'السكرتير — مشرف شاهين', nameEn: 'The secretary — Shaheen supervisor', at: 'src/utils/shaheenOrg.ts', noteAr: 'ينوب عن شاهين ويرأس الاجتماع وقت الضغط — تعريفه في src/utils/shaheenOrg.ts (SECRETARY)', noteEn: 'Deputises for Shaheen and chairs the meeting under pressure', owner: 'secretary', keywords: ['سكرتير', 'السكرتير', 'secretary', 'مشرف شاهين', 'نيابة'] },
  { id: 'state:handbook', kind: 'state', nameAr: 'كتيّب الروبوتات', nameEn: 'Robots handbook', at: 'SHAHEEN_HANDBOOK.md', noteAr: 'السياسات الملزمة لكل الروبوتات — SHAHEEN_HANDBOOK.md (يتولد تلقائياً من src/utils/botHandbook.ts)', noteEn: 'Binding policies for all robots — SHAHEEN_HANDBOOK.md', keywords: ['كتيّب', 'الكتيّب', 'handbook', 'السياسات', 'قواعد'] },
  { id: 'state:org', kind: 'state', nameAr: 'الهيكل الإداري', nameEn: 'Org chart', at: 'SHAHEEN_ORG.md', noteAr: 'الخريطة الكاملة للمنظمة — SHAHEEN_ORG.md (يتولد من السجلات)', noteEn: 'The full organisation map — SHAHEEN_ORG.md', keywords: ['هيكل', 'الهيكل', 'org', 'المنظمة', 'الأقسام', 'الخريطة الإدارية'] },
  { id: 'state:opsmap', kind: 'state', nameAr: 'خريطة التشغيل', nameEn: 'Operations map', at: '#admin/ops', noteAr: 'خريطة الروبوتات والتعاون والرحلات — #admin/ops (أو تبويب «خريطة التشغيل» في لوحة الإدارة)', noteEn: 'Bots, cooperation and journeys map — #admin/ops', keywords: ['خريطة التشغيل', 'ops', 'opsmap', 'الرحلات', 'journeys'] },
  { id: 'state:rules', kind: 'state', nameAr: 'القرارات القانونية الملزمة', nameEn: 'Binding legal decisions', at: 'SHAHEEN_HANDBOOK.md', noteAr: `قرارات المدير القانوني ${LEGAL_DECISIONS.map((d) => d.id).join('، ')} — ملزمة للجميع وموجودة في الكتيّب`, noteEn: `Legal decisions ${LEGAL_DECISIONS.map((d) => d.id).join(', ')} — binding for everyone`, owner: 'legal', keywords: ['قرارات قانونية', 'قانوني', 'legal', 'L-03', 'L-40', 'قرارات'] },
];

const PANELS: RefugeEntry[] = [
  ['overview', 'نظرة عامة', 'Overview'], ['census', 'التعداد وخريطة العالم', 'State census & world heatmap'], ['opsmap', 'خريطة التشغيل', 'Operations map'], ['finance', 'بنك شام والمالية', 'Bank & finance'],
  ['community', 'المجتمع', 'Community'], ['contracts', 'التعاقدات', 'Contracts'], ['agent', 'المساعد الإداري', 'Admin agent'],
  ['quality', 'الجودة والتعلّم', 'Quality & learning'], ['requests', 'الطلبات والعروض', 'Requests & quotes'], ['emails', 'إشعارات البريد', 'Email notices'],
  ['conversations', 'المحادثات', 'Conversations'], ['products', 'المنتجات', 'Products'], ['knowledge', 'قاعدة المعرفة', 'Knowledge base'],
  ['services', 'الخدمات', 'Services'], ['engines', 'المحركات والإعدادات', 'Engines & settings'], ['shaheen', 'الخبير شاهين', 'Shaheen growth'],
  ['design', 'استوديو التصميم', 'Design studio'], ['doctor', 'طبيب شاهين', 'Shaheen doctor'], ['supervisor', 'إدارة الذكاء الاصطناعي', 'AI supervision'],
  ['seo', 'منارة شاهين', 'SEO lighthouse'],
].map(([id, titleAr, titleEn]) => ({
  id: `panel:${id}`, kind: 'panel' as const, nameAr: `لوحة الإدارة — ${titleAr}`, nameEn: `Admin panel — ${titleEn}`,
  at: `#admin → ${id}`, noteAr: `تبويب «${titleAr}» في لوحة الإدارة (#admin)`, noteEn: `The “${titleEn}” tab in the admin panel (#admin)`,
  keywords: [id, ...id.split('_'), ...words(titleAr), ...words(titleEn), 'لوحة', 'الإدارة'],
}));

/** الفهرس الكامل — يتبنى من السجلات الحية في كل استدعاء (أو يتحفظ مرة واحدة عند أول طلب). */
let cached: RefugeEntry[] | undefined;
export function refugeIndex(): RefugeEntry[] {
  if (cached) return cached;
  const extraReports = Object.keys(REPORT_NAMES);
  const extraWorkflows = Object.keys(WORKFLOW_NAMES);
  cached = [
    ...BOTS.map(botEntry),
    ...AI_TOOLS.map(toolEntry),
    ...extraReports.map(reportEntry),
    ...extraWorkflows.map(workflowEntry),
    ...SITE_SECTIONS.map((s) => sectionEntry(s.id, s.titleAr, s.titleEn)),
    ...SPECIALISTS.map((s) => scienceEntry(s.id, s.nameAr, s.nameEn, s.fieldAr, s.fieldEn)),
    ...ENGINES, ...STATE, ...PANELS,
  ];
  return cached;
}

/** أولوية كسر التعادل: المورد الأدق (تقرير/أداة) قبل الروبوتات المتعددة. */
const KIND_RANK: Record<RefugeKind, number> = { report: 9, tool: 8, workflow: 7, state: 6, engine: 5, rule: 4, section: 3, science: 2, panel: 1, robot: 0 };

/** أقرب مورد للسؤال — أعلى تطابق كلمات يفوز، ونوع المورد يكسر التعادل. */
export function findRefuge(question: string): { entry: RefugeEntry; score: number } | undefined {
  let best: { entry: RefugeEntry; score: number } | undefined;
  for (const entry of refugeIndex()) {
    const keys = [...new Set([...entry.keywords, ...words(entry.nameAr), ...words(entry.nameEn)])];
    const score = matchScore(question, keys);
    if (score > 0 && (!best || score > best.score || (score === best.score && KIND_RANK[entry.kind] > KIND_RANK[best.entry.kind]))) best = { entry, score };
  }
  return best;
}

/** كلمات قوية معناها «عايز أوصل لحاجة» — وحدها كفاية. */
const ACCESS_PHRASES = ['كيف اصل', 'كيف أصل', 'ازاي اوصل', 'ازاي أصل', 'إزاي أوصل', 'كيفية الوصول', 'الوصول ل', 'الوصول إلى', 'توصلني', 'اعرف منين', 'اعرف من وين', 'وين ألاقي', 'وين الاقي', 'وين أجد', 'وين اجد', 'فين ألاقي', 'منين ألاقي', 'منين أجد', 'الملجأ', 'ملجأ', 'فهرس', 'الدليل الداخلي', 'where is the', 'where can i', 'where do i', 'how do i reach', 'how do i get', 'how do i find', 'how to reach', 'how to find', 'how to access', 'access to', 'the refuge'];
/** كلمات ضعيفة وحدها مش كفاية — محتاجة قوية (درجة عالية) مع المورد. */
const ACCESS_WORDS = ['وين', 'فين', 'أين', 'أين', 'الوصول', 'توصل', 'أوصل', 'المرجع', 'مرجع', 'سجل', 'where', 'reach', 'find', 'access', 'refuge'];

const formatWay = (entry: RefugeEntry, lang: string, question: string): string => {
  const specialist = pickSpecialist(question);
  return lang === 'en'
    ? `How to reach “${entry.nameEn}”: ${entry.at} — ${entry.noteEn}${entry.owner ? ` — responsible: ${BOTS.find((b) => b.id === entry.owner)?.nameEn ?? entry.owner}` : ''}. The specialist behind the science: ${specialist.nameEn}.`
    : `الوصول لـ«${entry.nameAr}»: ${entry.at} — ${entry.noteAr}${entry.owner ? ` — المسؤول: «${BOTS.find((b) => b.id === entry.owner)?.nameAr ?? entry.owner}»` : ''}. والاستشارة العلمية: المتخصص «${specialist.nameAr}» (${specialist.fieldAr}).`;
};

/**
 * إجابة «إزاي أوصل لكذا»: مورد حقيقي بمكانه الحقيقي وصاحبه، أو مفيش (undefined) —
 * والمتخصص اللي ورا السؤال مذكور. بتترجع بس لما يكون السؤال فعلاً سؤال وصول.
 */
export function refugeWay(question: string, lang: string): string | undefined {
  const hit = findRefuge(question);
  if (!hit) return undefined;
  const q = question.toLowerCase();
  const strong = ACCESS_PHRASES.some((p) => q.includes(p));
  const weak = ACCESS_WORDS.some((w) => q.split(/[^\p{L}\p{N}]+/u).includes(w));
  if (strong || (weak && hit.score >= 4)) return formatWay(hit.entry, lang, question);
  return undefined;
}

/** الفهرس كنص جاهز (للروبوتات وأي طرف تاني): كل مورد في سطر بمكانه الحقيقي. */
export function refugeDirectory(lang = 'ar'): string {
  const groups: [RefugeKind, string, string][] = [
    ['robot', lang === 'en' ? 'Robots' : 'الروبوتات', ''],
    ['tool', lang === 'en' ? 'AI tools' : 'أدوات الذكاء الاصطناعي', ''],
    ['report', lang === 'en' ? 'Live reports' : 'التقارير الحية', ''],
    ['workflow', lang === 'en' ? 'Workflows' : 'سير العمل', ''],
    ['section', lang === 'en' ? 'Site sections' : 'أقسام الموقع', ''],
    ['science', lang === 'en' ? 'Sciences & specialists' : 'العلوم والمتخصصون', ''],
    ['engine', lang === 'en' ? 'Knowledge engines' : 'محركات المعرفة', ''],
    ['rule', lang === 'en' ? 'Legal decisions' : 'القرارات القانونية', ''],
    ['state', lang === 'en' ? 'Internal state' : 'الدولة الداخلية', ''],
    ['panel', lang === 'en' ? 'Admin panels' : 'لوحات الإدارة', ''],
  ];
  const lines = [lang === 'en' ? 'Shaheen’s refuge — the unified index (every place is real):' : 'ملجأ شاهين — الفهرس الموحّد (كل الأماكن حقيقية):'];
  for (const [kind, title] of groups) {
    const rows = refugeIndex().filter((e) => e.kind === kind);
    if (!rows.length) continue;
    lines.push(`\n— ${title} (${rows.length}):`);
    for (const e of rows) lines.push(`  • ${lang === 'en' ? e.nameEn : e.nameAr} — ${e.at}`);
  }
  for (const d of LEGAL_DECISIONS) lines.push(`  • ${d.id}: ${d.textAr.slice(0, 60)}… — SHAHEEN_HANDBOOK.md`);
  return lines.join('\n');
}

/** الكلمة الدالة على «المنظومة والدولة الداخلية» في خطاب الروبوتات. */
export const REFUGE_NOTE_AR = 'ملجأك لأي حاجة داخل المنظومة وخارجها: ملجأ شاهين (src/utils/shaheenRefuge.ts) — فهرس موحّد فيه كل روبوت وأداة وتقرير وسير عمل وقسم وعلم وقرار قانوني بمكانه الحقيقي وصاحبه. اسأل فيه «وين ألاقي…» فيوصلك من غير تخمين.';
