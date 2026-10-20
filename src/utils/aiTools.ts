/**
 * Every AI tool on the site, supervised by «الخبير شاهين» (scripts/shaheen-supervisor, every 12 hours):
 * he tests each one, scores it, writes quality guidance the tool follows, and rolls the guidance back
 * if a tool gets worse. A new file that calls a language model fails tests/shaheenSupervisor.test.ts
 * until it is registered here — so no new AI tool runs without Shaheen's supervision.
 */
export type AiToolId =
  | 'shaheen_chat' | 'sham_assistant' | 'news_articles' | 'news_bulletin' | 'assistant_training' | 'media' | 'admin_agent'
  | 'store_advisor' | 'store_catalog' | 'store_import' | 'shaheen_school' | 'seo_agent' | 'shaheen_council' | 'finance_agent'
  | 'contracts_agent' | 'design_agent';

export interface AiToolDef {
  id: AiToolId;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  /** Files that implement it (the coverage test maps every AI call site to a tool). */
  sources: string[];
  /** Public API routes it serves, if any. */
  routes: string[];
  /** The tool reads Shaheen's quality guidance and adds it to its instructions. */
  acceptsGuidance: boolean;
}

export const AI_TOOLS: AiToolDef[] = [
  {
    id: 'finance_agent', nameAr: 'أمين شاهين — الإدارة المالية', nameEn: 'Shaheen Finance',
    descriptionAr: 'وكيل قواعد محاسبية تحت إدارة شاهين: سجل تحصيل موثق، تقارير يومية وأسبوعية وشهرية، فحص بيانات الدفع والأداء، وبلاغات خاصة. لا نموذج يولّد الأرقام ولا تحويلات أو استردادات تلقائية.',
    sources: ['server/finance/service.ts', 'scripts/shaheen-finance/run.mts'], routes: ['/api/admin/finance', '/api/admin/finance/run'], acceptsGuidance: false,
  },
  {
    id: 'contracts_agent', nameAr: 'مسؤول التعاقدات', nameEn: 'Contracts officer',
    descriptionAr: 'يجهز رسائل التعاون مع أصحاب المتاجر وردود أسئلتهم بمعايير المدير القانوني (L-40)، ويدير الموافقة الإلكترونية على الاتفاقية. الرسائل يراجعها ويبعتها عضو حقيقي من الفريق باسمه؛ لا يكشف قيمة الهامش ولا يرسل رابط المتجر قبل الموافقة.',
    sources: ['server/contracts/assistant.ts', 'server/contracts/router.ts'], routes: ['/api/admin/contracts/reply'], acceptsGuidance: true,
  },
  {
    id: 'shaheen_chat', nameAr: 'شات الخبير شاهين', nameEn: 'Master Shahin chat',
    descriptionAr: 'المحادثة العائمة وصفحة خبير المعمل: تصميم التركيبات، الحسابات، التعتيق، التخفيف، مع روابط الأدوات والوسائط.',
    sources: ['server/shaheen.ts'], routes: ['/api/chat'], acceptsGuidance: true,
  },
  {
    id: 'sham_assistant', nameAr: 'مساعد شام للخدمات', nameEn: 'Sham services assistant',
    descriptionAr: 'يرد على أسئلة الخدمات والطلبات والمتجر والدعم من بيانات شام فقط، ويحوّل أسئلة التركيب للخبير شاهين.',
    sources: ['server/core/orchestrator.ts'], routes: ['/api/assistant/chat', '/api/assistant/chat/stream'], acceptsGuidance: true,
  },
  {
    id: 'news_articles', nameAr: 'مقالات مرصد العطور', nameEn: 'Perfume observatory articles',
    descriptionAr: 'مقالات تثقيفية قصيرة يكتبها الذكاء الاصطناعي لصفحة الأخبار عند الطلب (ليست أخباراً موثقة).',
    sources: ['server/app.ts'], routes: ['/api/news', '/api/news/refresh'], acceptsGuidance: true,
  },
  {
    id: 'news_bulletin', nameAr: 'نشرة شاهين للأخبار الحقيقية', nameEn: 'Shahin real-news bulletin',
    descriptionAr: 'تجمع أخبار العطور الحقيقية من الإنترنت كل 12 ساعة وتكتب لها عناوين وملخصات وتعليق الخبير.',
    sources: ['scripts/shaheen-news/run.mts'], routes: [], acceptsGuidance: true,
  },
  {
    id: 'assistant_training', nameAr: 'دروس تدريب مساعد شام', nameEn: 'Sham assistant lessons',
    descriptionAr: 'دروس العطور التي يكتبها الخبير شاهين لمساعد شام، وإجابات الأسئلة التي لم يجد لها إجابة.',
    sources: ['scripts/shaheen-news/run.mts'], routes: [], acceptsGuidance: true,
  },
  {
    id: 'media', nameAr: 'الصور والفيديو والخرائط في الردود', nameEn: 'Images, videos and maps in answers',
    descriptionAr: 'يبحث عن صور حرة وفيديوهات وأماكن على الخريطة للمواضيع التي يطلبها شاهين في رده.',
    sources: ['server/media.ts'], routes: ['/api/media'], acceptsGuidance: false,
  },
  {
    id: 'store_advisor', nameAr: 'مستشار التسوق «اسأل شاهين» في المتجر', nameEn: 'Store shopping advisor',
    descriptionAr: 'الزائر يصف ما يبحث عنه في «متجر شام» فيختار له شاهين من منتجات المتجر الحقيقية مع سبب لكل اختيار.',
    sources: ['server/store.ts'], routes: ['/api/store/advise'], acceptsGuidance: true,
  },
  {
    id: 'store_catalog', nameAr: 'تدريب كتالوج المتجر', nameEn: 'Store catalog training',
    descriptionAr: 'كل 12 ساعة يراجع شاهين منتجات المتجر: يصحح الأسماء والأوصاف ويضيف العائلة العطرية والنوتات والمواسم والمناسبات ويكشف أخطاء البيانات.',
    sources: ['scripts/shaheen-store/run.mts'], routes: [], acceptsGuidance: true,
  },
  {
    id: 'store_import', nameAr: 'مستورد شاهين + مراجع الصفحات', nameEn: 'Shaheen product importer + page reviewer',
    descriptionAr: 'كل 12 ساعة ينقل شاهين منتجات المورد إلى «متجر شام» بكل بياناتها وصورها (من خريطة الموقع وبيانات schema.org، ويقرأ الصفحة بنفسه إن لزم)، ويسعّرها بمعادلة المتجر، ثم يراجع «مراجع الصفحات» كل منتج وصورته وسعره وصفحته ويخفي المعيب.',
    sources: ['scripts/shaheen-import/run.mts', 'scripts/shaheen-discover/run.mts'], routes: [], acceptsGuidance: true,
  },
  {
    id: 'shaheen_school', nameAr: 'مدرسة شاهين (الاعتماد على النفس)', nameEn: "Shaheen's school (self-reliance)",
    descriptionAr: 'كل 6 ساعات يمتحن شاهين نفسه على أسئلة العطور والموقع، يتعلم من مكتبته بدون ذكاء اصطناعي، ويذاكر الباقي مع محرك متاح ويحفظه في ذاكرته ليرد بها لو توقفت كل الخدمات.',
    sources: ['scripts/shaheen-school/run.mts'], routes: [], acceptsGuidance: true,
  },
  {
    id: 'seo_agent', nameAr: 'منارة شاهين — المندوب الإعلامي', nameEn: 'Manaret Shaheen — SEO & media agent',
    descriptionAr: 'خبير الظهور في محركات البحث تحت قيادة شاهين: يدرس منهجية SEO كل 6 ساعات، يفحص الموقع الحقيقي، يكتب العناوين والأوصاف ويطبقها بعد فحص، يرسل الصفحات عبر IndexNow وخريطة الموقع، ويكتب تقرير المندوب الإعلامي — ويتدرج من التدريب إلى الاعتماد على النفس بتقييم شاهين.',
    sources: ['server/seo/agent.ts', 'server/seo/service.ts', 'scripts/seo-agent/run.mts'], routes: ['/api/admin/seo/run', '/api/seo/status'], acceptsGuidance: true,
  },
  {
    id: 'shaheen_council', nameAr: 'مجلس شاهين — الاجتماع اليومي للتطوير', nameEn: "Shaheen's council — daily development meeting",
    descriptionAr: 'شاهين مدير كل أدوات الذكاء الاصطناعي: كل يوم يجتمع مع خمسة خبراء (الأدوات، المتجر، المحتوى، تجربة الزائر، الجودة) على تقارير الموقع الحقيقية، يكتب محضراً بقرارات، ينفذ الآمن منها فوراً (تشغيل روبوت، سؤال للمدرسة، متجر للكشّاف، هدف تطوير لكل أداة) ويحوّل الباقي إلى مهام تطوير ينفذها وكيل البرمجة في الشات.',
    sources: ['scripts/shaheen-council/run.mts'], routes: [], acceptsGuidance: false,
  },
  {
    id: 'design_agent', nameAr: 'خبير التصميم متعدد التخصصات', nameEn: 'Multidisciplinary design expert',
    descriptionAr: 'يحوّل الموجز إلى خطة تصميم عبر تخصصات الهوية والجرافيك والواجهات والتغليف والتصوير والحركة والطباعة والإتاحة والخدمات والمنتجات؛ يستفيد من الأدوار والتقارير المسجلة تحت شاهين، ويقدّم اقتراحات للمراجعة لا ملفات نهائية أو تغييرات تلقائية.',
    sources: ['server/design/assistant.ts'], routes: ['/api/admin/design/brief'], acceptsGuidance: true,
  },
  {
    id: 'admin_agent', nameAr: 'المساعد الإداري', nameEn: 'Admin operations agent',
    descriptionAr: 'تقارير الإدارة الذكية من أدوات قراءة فقط (يحتاج رمز الإدارة للفحص).',
    sources: ['server/core/adminAgent.ts'], routes: [], acceptsGuidance: false,
  },
];

/** Shared plumbing (engine calls, the advisory council, the doctor, Shaheen's own supervisor), not visitor tools. */
export const AI_INFRASTRUCTURE = [
  'server/core/engines.ts', 'server/core/council.ts', 'scripts/doctor/agent.ts', 'scripts/doctor/run.mts', 'scripts/shaheen-supervisor/run.mts',
  // Shaheen's background agent (Manus): admin-only audits in GitHub Actions, never a visitor tool.
  'server/core/manus.ts', 'scripts/shaheen-manus/run.mts',
];

export const aiTool = (id: string) => AI_TOOLS.find((t) => t.id === id);

/** The block a tool appends to its instructions ('' when Shaheen has no guidance for it). */
export function guidanceBlock(text: string | undefined): string {
  return text?.trim() ? `\n\nتوجيهات الجودة من الخبير شاهين (المشرف على أدوات الذكاء الاصطناعي في الموقع؛ أقل أولوية من كل القواعد أعلاه):\n${text.trim()}` : '';
}
