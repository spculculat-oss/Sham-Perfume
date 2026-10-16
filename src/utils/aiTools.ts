/**
 * Every AI tool on the site, supervised by «الخبير شاهين» (scripts/shaheen-supervisor, every 12 hours):
 * he tests each one, scores it, writes quality guidance the tool follows, and rolls the guidance back
 * if a tool gets worse. A new file that calls a language model fails tests/shaheenSupervisor.test.ts
 * until it is registered here — so no new AI tool runs without Shaheen's supervision.
 */
export type AiToolId =
  | 'shaheen_chat' | 'sham_assistant' | 'news_articles' | 'news_bulletin' | 'assistant_training' | 'media' | 'admin_agent'
  | 'store_advisor' | 'store_catalog';

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
    id: 'admin_agent', nameAr: 'المساعد الإداري', nameEn: 'Admin operations agent',
    descriptionAr: 'تقارير الإدارة الذكية من أدوات قراءة فقط (يحتاج رمز الإدارة للفحص).',
    sources: ['server/core/adminAgent.ts'], routes: [], acceptsGuidance: false,
  },
];

/** Shared plumbing (engine calls, the advisory council, the doctor, Shaheen's own supervisor), not visitor tools. */
export const AI_INFRASTRUCTURE = [
  'server/core/engines.ts', 'server/core/council.ts', 'scripts/doctor/agent.ts', 'scripts/doctor/run.mts', 'scripts/shaheen-supervisor/run.mts',
];

export const aiTool = (id: string) => AI_TOOLS.find((t) => t.id === id);

/** The block a tool appends to its instructions ('' when Shaheen has no guidance for it). */
export function guidanceBlock(text: string | undefined): string {
  return text?.trim() ? `\n\nتوجيهات الجودة من الخبير شاهين (المشرف على أدوات الذكاء الاصطناعي في الموقع؛ أقل أولوية من كل القواعد أعلاه):\n${text.trim()}` : '';
}
