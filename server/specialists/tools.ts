/**
 * «صندوق أدوات مجلس المتخصصين» — كل الأدوات اللي وكيل المتخصصين (server/specialists/agent.ts) بيشتغل بيها.
 *
 * الوكيل بيفهم السؤال، بيوجّهه لمتخصصه، وبعدين يشتغل بالأدوات دي: كلها بتقرا بيانات شام الحقيقية
 * (منهج مدرسة شاهين وعلومها المراجَعة، ذاكرته، مكتبته، موسوعة المواد الخام، حاسبات المعمل، المتجر
 * بأسعاره الحقيقية، نشرة الأخبار، ملجأ شاهين، والمصادر المفتوحة) — ومفيش أداة بتخترع معلومة.
 * كل أداة بترجع «ملاحظة» (observation) مكتوب عليها مصدرها وقوتها (0…1)، والوكيل بيرد منها،
 * ولو مفيش حاجة صلبة يقول بصراحة إنه هيذاكر السؤال (الصراحة أحسن من التخمين).
 *
 * نطاق كل أداة محدود (L-32): المتخصص بياخد الأدوات اللي بتخدم مساراته هو من مدرسة شاهين،
 * والأدوات العامة (التوجيه والملجأ والتسليم والمذاكرة والتوضيح) متاحة لكل المتخصصين.
 *
 * الأدوات بتشتغل على السيرفر وفي الاختبارات من غير أي مفتاح: كل حاجة محلية deterministic،
 * والوحيد اللي بيتصل بره هو «باحث شاهين» والوسايط والمتجر — وكلهم اختياريين وليهم بديل.
 */
import { RAW_MATERIALS_DATABASE } from '../../src/data/rawMaterials';
import { SCIENCE_LESSONS, SCIENCE_TRACKS, type ScienceLesson, type ScienceTrackId } from '../../src/data/sciences';
import { academyPairs, TRACKS as SCHOOL_TRACKS, type AcademyLesson, type TrackId } from '../../scripts/shaheen-school/curriculum';
import { buildScienceIndex, scienceHits, type ScienceIndex } from '../../src/utils/scienceIndex';
import { libraryAnswer, materialCard, type LibraryAnswer, type LibraryLesson, type LibrarySources } from '../../src/utils/shaheenLibrary';
import { fieldsOf, type FieldId } from '../../src/utils/shaheenAgent';
import { isPersonal, isTimeBound, meaningWords } from '../../src/utils/shaheenMemory';
import { findRefuge, refugeWay } from '../../src/utils/shaheenRefuge';
import {
  pickSpecialist, SITE_SECTIONS, specialistOf, type Specialist, type SpecialistId,
} from '../../src/utils/shaheenSpecialists';
import {
  alcoholDilutionIn, concentrationPercentIn, macerationDaysIn, materialIn, questionIntents, volumeMl,
} from '../../src/utils/shaheenTools';
import {
  calculateAlcoholDilution, calculateCosting, calculatePerfumeFormulation, calculatePyramidDistribution,
} from '../../src/utils/calculations';
import { researchAnswer, type Research } from '../../src/utils/webResearch';
import { tools as coreTools } from '../core/tools';
import { liveNews } from '../core/liveData';
import type { Repository } from '../core/repository';
import type { ShaheenMemory } from '../core/memory';
import { searchImages, searchPlace, searchVideos } from '../media';
import type { EngineId } from '../core/types';

type Env = Record<string, string | undefined>;

/** ما الزيارة الواحدة تسمح به: أدوات قليلة ومحدودة الوقت عشان الرد ييجي في ثواني مش في دقايق. */
export const TOOL_LIMITS = { maxCalls: 10, perCallMs: 9000, maxObservationChars: 2600 };

export interface SpecialistToolContext {
  /** السؤال **بعد الفهم** (تصحيح الغلطات والمتابعة) — الأدوات بتدوّر بيه في الأرشيف. */
  question: string;
  /** السؤال كما كتبه الزائر بالظبط — بيتسجل في الفجوات وبيروح مع التسليم. */
  raw?: string;
  /** آخر سؤال من الزائر — المتابعة القصيرة («طيب ولو 100 مل؟») بتكمل على موضوعه. */
  previous?: string;
  lang: 'ar' | 'en';
  specialist: Specialist;
  section?: string;
  repo: Repository;
  memory?: ShaheenMemory;
  /** «مكتبة شاهين»: الدروس + موسوعة المواد + الذاكرة (نفس مصادر شات شاهين). */
  library?: () => Promise<LibrarySources>;
  /** «باحث شاهين»: المصادر المفتوحة (اختياري — من غيره الأداة تقول إنها مش متاحة). */
  research?: (question: string, lang: string) => Promise<Research | undefined>;
  env: Env;
  fetch?: typeof fetch;
  signal: AbortSignal;
  engine?: EngineId;
}

export type ToolCitationKind = 'science' | 'lesson' | 'material' | 'memory' | 'product' | 'news' | 'source' | 'platform' | 'tool';
export interface ToolCitation { id: string; title: string; kind: ToolCitationKind }

/** كروت التنفيذ عند الزائر: تفتح قسم، تسلّم لشاهين/مساعد شام، تعرض صورة أو مكان، أو تنقل لمتخصص تاني. */
export type ToolAction =
  | { type: 'open_tab'; tab: string; title?: string }
  | { type: 'open_chat'; prompt: string; title?: string }
  | { type: 'hand_over'; to: SpecialistId | 'shaheen' | 'sham'; title?: string }
  | { type: 'media'; images: { url: string; title: string; credit?: string }[]; places?: { label: string; lat: number; lon: number }[] };

export interface ToolObservation {
  tool: ToolName;
  /** الحقائق اللي الوكيل يبني عليها رده — من غير أي تزيين. */
  observation: string;
  /** 0…1: قد إيه الملاحظة دي بتجاوب السؤال (الوكيل بيختار الأقوى لو مفيش محرك). */
  strength: number;
  /** رد جاهز من غير ذكاء اصطناعي (لو الأداة تقدر تكتبه لوحدها بمصدره). */
  answer?: string;
  /** مصدر الرد كما يظهر للزائر. */
  source?: AnswerSource;
  citations?: ToolCitation[];
  actions?: ToolAction[];
  followUps?: string[];
  data?: unknown;
}

/** مصدر الرد كما يظهر للزائر (مكتوب على كل رد — قاعدة المنصة). */
export type AnswerSource =
  | 'science' | 'academy' | 'memory' | 'library' | 'material' | 'refuge' | 'calculator'
  | 'store' | 'news' | 'research' | 'knowledge' | 'agent' | 'gap';

export type ToolName =
  | 'school_science' | 'recall_memory' | 'search_library' | 'refuge_way' | 'knowledge_base' | 'open_sources'
  | 'material_card' | 'calc_concentration' | 'calc_dilution' | 'calc_pyramid' | 'calc_cost' | 'maceration_plan'
  | 'safety_check' | 'search_store' | 'store_overview' | 'perfume_news' | 'media_find'
  | 'open_section' | 'hand_over' | 'route_specialist' | 'study_later' | 'clarify';

export interface SpecialistTool {
  name: ToolName;
  /** اسم الأداة كما يظهر للزائر في خطوات الوكيل (من غير أي اسم منصة أو مزوّد). */
  labelAr: string;
  labelEn: string;
  descriptionAr: string;
  descriptionEn: string;
  /** شكل الوسائط المختصر اللي النموذج يكتبه: {"query":"…"} */
  args: string;
  /** مسارات مدرسة شاهين اللي الأداة تخدمها؛ من غير قيمة = متاحة لكل المتخصصين. */
  tracks?: TrackId[];
  run(args: Record<string, unknown>, ctx: SpecialistToolContext): Promise<ToolObservation | undefined>;
}

/* ── مساعدات صغيرة ─────────────────────────────────────────────────────────────────────────────── */
const num = (args: Record<string, unknown>, key: string): number | undefined => {
  const raw = args[key];
  const value = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[,،\s]/g, '')) : NaN;
  return Number.isFinite(value) ? value : undefined;
};
const str = (args: Record<string, unknown>, key: string): string | undefined =>
  typeof args[key] === 'string' && (args[key] as string).trim() ? (args[key] as string).trim().slice(0, 240) : undefined;
const clip = (text: string, max = TOOL_LIMITS.maxObservationChars) => (text.length > max ? `${text.slice(0, max)}…` : text);
const r2 = (n: number) => Math.round(n * 100) / 100;
const words = (text: string) => meaningWords(text);
/** تطابق موضوعي (كلمات المعنى المشتركة) — نفس مقياس المدرسة والمكتبة، من غير أي نموذج. */
const overlap = (question: string, text: string): number => {
  const q = words(question); const t = new Set(words(text));
  if (!q.length || !t.size) return 0;
  const shared = q.filter((w) => [...t].some((x) => x === w || (w.length >= 4 && x.startsWith(w)) || (x.length >= 4 && w.startsWith(x)))).length;
  return shared / Math.min(q.length, 4);
};

let academyCache: AcademyLesson[] | undefined;
const academy = () => (academyCache ??= academyPairs().map((p) => p.lesson));
let scienceCache: ScienceIndex | undefined;
const science = () => (scienceCache ??= buildScienceIndex(SCIENCE_LESSONS));
const trackTitle = (id: TrackId) => SCHOOL_TRACKS.find((t) => t.id === id)?.titleAr || id;

/**
 * علوم المدرسة (src/data/sciences) مساراتها غير مسارات الأكاديمية: الجدول ده بيربط كل مسار علمي
 * بمسارات الأكاديمية اللي تملكه — فعِلم المتخصص يفضّل نطاقه هو (L-32) من غير ما يحرمه من درس مكتوب.
 */
export const SCIENCE_TO_TRACKS: Record<ScienceTrackId, TrackId[]> = {
  'human-medicine': ['medicine'], veterinary: ['medicine'], nutrition: ['medicine', 'biology'],
  biology: ['biology'], agriculture: ['biology', 'earth_space'], biosafety: ['biology', 'medicine', 'security'],
  space: ['earth_space'], earth: ['earth_space', 'engineering'], semiconductors: ['it_sciences', 'engineering'],
  nuclear: ['physics', 'engineering'], physics: ['physics'], chemistry: ['chemistry', 'perfume'],
  math: ['math'], computing: ['prog_langs', 'software', 'it_sciences', 'ai_science'],
  'war-studies': ['law', 'history'], 'electronic-warfare': ['security', 'threat_analysis'],
  logic: ['ai_science', 'math', 'software'], cosmetics: ['chemistry', 'biology', 'medicine'],
};
const scienceInScope = (lesson: ScienceLesson, specialist: Specialist) =>
  (SCIENCE_TO_TRACKS[lesson.track] || []).some((t) => specialist.tracks.includes(t));

/** هل المتخصص يملك المجال ده؟ (مجال عام = محدش يملكه، ومسار العطور لصاحب العطور وحده.) */
export function ownsField(specialist: Specialist, field: FieldId | undefined): boolean {
  if (!field || field === 'general') return false;
  if (field === 'perfume') return specialist.tracks.includes('perfume');
  return (SCIENCE_TO_TRACKS[field as ScienceTrackId] || []).some((t) => specialist.tracks.includes(t));
}

/* ── نطاق المتخصص في مكتبة شاهين (L-32) ─────────────────────────────────────────────────────────
 * المكتبة فيها دروس عطور ودروس مدرسة. كلمة «المواد» في سؤال عن التجارة («ايه المواد اللي أدرسها
 * علشان أنجح في المجال ده؟») كانت بتجيب درس «المواد الخام الطبيعية» — رد من مجال تاني خالص.
 * فكل درس له مجال (من عنوانه وتاجاته)، والمتخصص مايردش إلا من دروس مجاله هو.
 */
const lessonFieldsCache = new Map<string, FieldId[]>();
/** مجالات الدرس — المجال الضعيف (أقل من نص أقوى مجال) بيتشال: «تكلفة زجاجة عطر» عطور مش دراسات حرب. */
export function lessonFields(lesson: LibraryLesson): FieldId[] {
  const key = lesson.id || lesson.title;
  const cached = lessonFieldsCache.get(key);
  if (cached) return cached;
  const scored = fieldsOf(`${lesson.title} ${(lesson.tags || []).join(' ')}`);
  const top = scored[0]?.score || 0;
  const fields = scored.filter((f) => f.score >= 2 && f.score >= top * 0.5).map((f) => f.field);
  lessonFieldsCache.set(key, fields);
  return fields;
}

/** دروس المكتبة اللي في نطاق المتخصص. درس مجاله مش واضح (مفيش مجال) يفضل متاح: محتوى عام. */
export function lessonsInScope(lessons: LibraryLesson[], specialist: Specialist): LibraryLesson[] {
  return lessons.filter((l) => {
    const fields = lessonFields(l);
    return fields.length === 0 || fields.some((f) => ownsField(specialist, f));
  });
}

/** موسوعة المواد الخام في نطاق المتخصص ده؟ (نفس مسارات أداة «material_card» بالظبط.) */
export function materialsInScope(specialist: Specialist): boolean {
  const tracks = SPECIALIST_TOOLS.find((t) => t.name === 'material_card')?.tracks || [];
  return tracks.some((t) => specialist.tracks.includes(t));
}

/* ── نصوص الردود الجاهزة (عربي/إنجليزي) — كلها بتقول مصدرها ───────────────────────────────────── */
const SRC = {
  science: { ar: '🎓 من علوم شاهين — درس مكتوب ومراجَع في مساره', en: "🎓 From Shaheen's sciences — a written, reviewed lesson" },
  academy: { ar: '🎓 من منهج مدرسة شاهين — درس مكتوب ومراجَع', en: "🎓 From Shaheen's school curriculum — a written, reviewed lesson" },
  memory: { ar: '🧠 من ذاكرة شاهين — إجابة محفوظة من سؤال شبهه', en: "🧠 From Shaheen's memory — a saved answer to a near-identical question" },
  library: { ar: '📚 من مكتبة شاهين — دروسه وموسوعة المواد', en: "📚 From Shaheen's library — his lessons and materials encyclopaedia" },
  material: { ar: '🧪 من موسوعة المواد الخام في شام', en: '🧪 From the Sham raw-materials encyclopaedia' },
  refuge: { ar: '🧭 من ملجأ شاهين — دليل الوصول لأي حاجة في المنظومة', en: '🧭 From the refuge — the index of everything in the platform' },
  calculator: { ar: '🧮 من حاسبات معمل شام — أرقام محسوبة بمعادلات الموقع', en: '🧮 From the Sham lab calculators — computed with the site’s own formulas' },
  store: { ar: '🛍️ من «متجر شام» — المنتجات وأسعارها الحقيقية', en: '🛍️ From the Sham store — its real products and prices' },
  news: { ar: '📰 من نشرة شاهين للأخبار الحقيقية', en: "📰 From Shaheen's real-news bulletin" },
  research: { ar: '🌐 من المصادر المفتوحة (ويكيبيديا) — بالرابط', en: '🌐 From open sources (Wikipedia) — with the link' },
  knowledge: { ar: '📖 من قاعدة معرفة شام وخدماتها', en: '📖 From the Sham knowledge base and services' },
  agent: { ar: '🤖 رد وكيل المتخصصين — مبني على ملاحظات أدواته المكتوبة أعلاه', en: '🤖 Specialists agent answer — built on the tool observations above' },
  gap: { ar: '⏳ محتاج مذاكرة — اتسجل للمدرسة', en: '⏳ Needs studying — noted for the school' },
} as const satisfies Record<AnswerSource | 'agent', { ar: string; en: string }>;
export const sourceNote = (source: AnswerSource | 'agent', lang: string) => (lang === 'en' ? SRC[source].en : SRC[source].ar);

/* ── الأدوات ──────────────────────────────────────────────────────────────────────────────────── */
/**
 * المواد اللي السؤال بيشاور عليها — بالاسم الصريح أو بالكلام («عطر فيه مسك أبيض»).
 * نفس المقياس الموضوعي (كلمات المعنى) في كل الأدوات: مفيش نموذج ولا تخمين.
 */
type RawMaterial = (typeof RAW_MATERIALS_DATABASE)[number];

/* ── الرد الإنجليزي من موسوعة المواد ────────────────────────────────────────────────────────────
 * الموسوعة مكتوبة بالعربي (الوصف، نص IFRA، التنبيهات). الرد الإنجليزي بياخد منها **الأرقام
 * المسجلة** والاسم الإنجليزي والكاس ومكان المادة في الهرم — ومابيت translate كلام ولا بيخترع
 * تحذير: بيقول للزائر إن النص الكامل بالعربي في الموسوعة والزر بيفتحها.
 */
/** كل النسب المئوية المسجلة في نص («2% - 15% من الزيت العطري» ← «2% - 15%»). */
const percentsIn = (value: unknown): string =>
  typeof value === 'string'
    ? (value.match(/\d+(?:[.,]\d+)?\s*(?:-|–|—|إلى|to)?\s*\d*(?:[.,]\d+)?\s*%/g) || []).map((x) => x.replace(/\s+/g, ' ').trim()).join(' · ')
    : '';
const PLACEMENT_EN: Record<string, string> = { top: 'top', heart: 'heart', base: 'base', carrier: 'carrier', all: 'all round' };
const CATEGORY_EN: Record<string, string> = {
  solvent: 'solvent / carrier', fixative: 'fixative', aromachemical: 'aromachemical',
  natural_essential: 'natural essential oil', natural_resin: 'natural resin / absolute',
  animalic: 'animalic note', musk: 'musk', citrus: 'citrus oil', floral: 'floral absolute',
};
const enSlug = (slug?: string) => (slug || '').replace(/_/g, ' ');
const ENCYCLOPAEDIA_EN = 'The scent profile, the full IFRA wording and the precautions are written in Arabic in the encyclopaedia — the button below opens it.';

/** كارت المادة بالإنجليزي: اسم وكاس وأرقام مسجلة ومكان في الهرم — من غير كلام عربي ولا تحذير مخترع. */
function materialCardEn(m: RawMaterial): string {
  const usage = percentsIn(m.recommendedUsagePercent);
  const ifra = percentsIn((m as Record<string, unknown>).ifraLimitPercent);
  return [
    `**${m.nameEn}** (CAS ${m.casNumber})`,
    `- Category: ${CATEGORY_EN[m.category] || enSlug(m.category)} · Place in the pyramid: ${PLACEMENT_EN[m.pyramidPlacement] || enSlug(m.pyramidPlacement)}`,
    usage ? `- Usage recorded in the encyclopaedia: ${usage}` : '',
    ifra ? `- IFRA figure recorded in the encyclopaedia: ${ifra}` : '',
    `- ${ENCYCLOPAEDIA_EN}`,
  ].filter(Boolean).join('\n');
}
/**
 * الاسم ده فعلاً مادة في موسوعة شام؟ (بالعربي أو بالإنجليزي، بـ«ال» أو من غيرها).
 */
function isKnownMaterial(name: string): boolean {
  const n = name.trim().toLowerCase().replace(/^\u0627\u0644/u, '');
  if (n.length < 2) return false;
  return RAW_MATERIALS_DATABASE.some((m) => {
    const keys = `${m.nameAr} ${m.nameEn}`.toLowerCase();
    return keys.includes(n) || n.includes(m.nameEn.toLowerCase().replace(/\s*[(\u2014\u2013-].*$/u, ''));
  });
}

/**
 * المادة اللي السؤال بيسأل عنها. `materialIn` العامة بتقبض على أول كلمتين بعد «what is» فبتقول إن
 * «What is the maximum IFRA concentration for galaxolide?» بيسأل عن مادة اسمها «the maximum» — ودي
 * مش مادة. فبنقبل الاسم بس لو موجود في الموسوعة، وغير كده بندوّر على اسم المادة **جوه السؤال نفسه**
 * (galaxolide مكتوبة فيه) — أحسن من إن سؤال حقيقي عن حدود IFRA يرجع فجوة.
 */
/**
 * مادة **اسمها مكتوب في السؤال نفسه** (الاسم الكامل من الموسوعة، مش كلمة من عائلتها أو نوعها) —
 * أطول اسم يتطابق هو الأدق. «ماء» في سؤال عن الحافظات مش اسم مادة كامل، فماتعتبرش سؤال عن مادة.
 */
function materialNamed(text: string): RawMaterial | undefined {
  const t = ` ${text.toLowerCase()} `;
  let best: { material: RawMaterial; len: number } | undefined;
  for (const m of RAW_MATERIALS_DATABASE) {
    for (const full of [m.nameAr, m.nameEn]) {
      const name = String(full || '').replace(/\s*[(\u2014\u2013-].*$/u, '').trim().toLowerCase();
      if (name.length >= 3 && t.includes(name) && (!best || name.length > best.len)) best = { material: m, len: name.length };
    }
  }
  return best?.material;
}

function materialAsked(text: string): string | undefined {
  const name = materialIn(text);
  if (!name) return undefined;
  if (isKnownMaterial(name)) return name;
  // الاسم اللي اقبض عليه مش مادة في الموسوعة («What is the maximum…» ← «the maximum»): ندوّر على
  // اسم المادة الحقيقي جوه السؤال نفسه (galaxolide) بدل ما سؤال عن حدود IFRA يضيع ويرجع فجوة.
  const named = materialNamed(text);
  return named ? `${named.nameAr} ${named.nameEn}`.replace(/\s*[(\u2014\u2013-].*$/u, '').trim() : undefined;
}

function materialHits(text: string, limit = 5): { material: RawMaterial; score: number }[] {
  const asked = (materialIn(text) || text).toLowerCase();
  const q = words(asked);
  return RAW_MATERIALS_DATABASE
    .map((m) => {
      const keys = [m.nameAr, m.nameEn, m.id.replace(/^mat-/, '').replace(/-/g, ' '), m.olfactoryFamily, m.categoryAr]
        .join(' ').toLowerCase();
      const score = q.filter((w) => w.length >= 3 && keys.includes(w)).length + (keys.includes(asked) ? 2 : 0);
      return { material: m, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export const SPECIALIST_TOOLS: SpecialistTool[] = [
  {
    name: 'school_science',
    labelAr: 'ذاكر من مدرسة شاهين وعلومها', labelEn: "Studied Shaheen's school and sciences",
    descriptionAr: 'يدور على السؤال في منهج مدرسة شاهين (39 مسار) وفي دروس علومها المراجَعة — ضمن نطاق المتخصص فقط.',
    descriptionEn: "Searches the question in Shaheen's school curriculum (39 tracks) and his reviewed science lessons — inside the specialist's scope only.",
    args: '{"query":"نص السؤال أو موضوعه"}',
    run: async (args, ctx) => {
      const query = str(args, 'query') || ctx.question;
      const mine = academy().filter((l) => ctx.specialist.tracks.includes(l.track));
      const scored = mine
        .map((l) => ({ l, s: Math.max(overlap(query, `${l.title} ${l.tags?.join(' ') || ''}`), overlap(query, l.content) * 0.8) }))
        .filter((x) => x.s >= 0.34)
        .sort((a, b) => b.s - a.s);
      const lessons = scienceHits(science(), query, { limit: 4, minRelevance: 0.34 })
        .filter((h) => scienceInScope(h.lesson, ctx.specialist))
        .map((h) => ({ lesson: h.lesson, relevance: h.relevance }));
      const bestLesson = lessons[0];
      const bestAcademy = scored[0];
      if (!bestLesson && !bestAcademy) return undefined;
      // درس العلوم أطول وأدق (مكتوب ومراجَع ومعه حدود المجال) — يفضل على درس الأكاديمية المختصر.
      const useLesson = bestLesson && bestLesson.relevance >= 0.5;
      const track = SCIENCE_TRACKS.find((t) => t.id === bestLesson?.lesson.track);
      const boundary = track?.boundaryAr ? `\n\n> ${track.boundaryAr}` : '';
      const answer = ctx.lang === 'en'
        ? undefined
        : useLesson
          ? `**${bestLesson!.lesson.titleAr}**\n\n${bestLesson!.lesson.answerAr}${boundary}\n\n_${sourceNote('science', 'ar')} — مسار «${track?.titleAr || ''}»._`
          : bestAcademy
            ? `**${bestAcademy.l.title}**\n\n${bestAcademy.l.content}\n\n_${sourceNote('academy', 'ar')} — مسار «${trackTitle(bestAcademy.l.track)}»._`
            : undefined;
      const related = [...lessons.slice(1, 3).map((h) => h.lesson.titleAr), ...scored.slice(1, 3).map((x) => x.l.title)].slice(0, 3);
      return {
        tool: 'school_science',
        observation: clip([
          ...lessons.slice(0, 2).map((h) => `[علوم ${h.lesson.track}] ${h.lesson.titleAr} (قوة ${r2(h.relevance)}): ${h.lesson.answerAr.slice(0, 700)}`),
          ...scored.slice(0, 3).map((x) => `[منهج ${x.l.track}] ${x.l.title} (قوة ${r2(x.s)}): ${x.l.content.slice(0, 500)}`),
        ].join('\n\n')),
        strength: Math.min(0.95, useLesson ? 0.55 + bestLesson!.relevance * 0.45 : 0.4 + (bestAcademy?.s || 0) * 0.5),
        ...(answer ? { answer, source: (useLesson ? 'science' : 'academy') as AnswerSource } : {}),
        citations: [
          ...lessons.slice(0, 2).map((h) => ({ id: h.lesson.id, title: h.lesson.titleAr, kind: 'science' as const })),
          ...scored.slice(0, 2).map((x) => ({ id: x.l.id, title: x.l.title, kind: 'lesson' as const })),
        ],
        followUps: related,
        data: { lessons: lessons.slice(0, 2).map((h) => h.lesson.id), academy: scored.slice(0, 3).map((x) => x.l.id) },
      };
    },
  },

  {
    name: 'recall_memory',
    labelAr: 'دوّر في ذاكرة شاهين', labelEn: "Searched Shaheen's memory",
    descriptionAr: 'أقرب سؤال محفوظ في ذاكرة شاهين (نفس السؤال الأول، وبعدين شبهه).',
    descriptionEn: "The closest question saved in Shaheen's memory (the same question first, then a near one).",
    args: '{}',
    run: async (_args, ctx) => {
      if (!ctx.memory || isPersonal(ctx.question) || isTimeBound(ctx.question)) return undefined;
      const hit = await ctx.memory.recall(ctx.question, ctx.lang, 'auto').catch(() => undefined)
        || await ctx.memory.recallSimilar(ctx.question, ctx.lang, 0.78).catch(() => undefined);
      if (!hit?.entry.answer) return undefined;
      const answer = `${hit.entry.answer}\n\n_${sourceNote('memory', ctx.lang)}${hit.exact ? '' : ctx.lang === 'en' ? ' (a near question)' : ' (سؤال قريب منه)'}._`;
      return {
        tool: 'recall_memory',
        observation: clip(`[ذاكرة] ${hit.entry.question || ctx.question} → ${hit.entry.answer}`),
        strength: hit.exact ? 1 : Math.min(0.85, 0.5 + hit.score * 0.4),
        answer, source: 'memory',
        citations: [{ id: `memory:${hit.entry.id}`, title: hit.entry.question || ctx.question, kind: 'memory' }],
        data: { exact: hit.exact, score: r2(hit.score), from: hit.from },
      };
    },
  },

  {
    name: 'search_library',
    labelAr: 'دوّر في مكتبة شاهين', labelEn: "Searched Shaheen's library",
    descriptionAr: 'دروس شاهين وموسوعة المواد الخام وذاكرته — رد جاهز بمصدره من غير ذكاء اصطناعي.',
    descriptionEn: "Shaheen's lessons, the raw-materials encyclopaedia and his memory — a ready answer with its source, without AI.",
    args: '{}',
    run: async (_args, ctx) => {
      if (!ctx.library) return undefined;
      const src = await ctx.library().catch(() => undefined);
      if (!src) return undefined;
      const found: LibraryAnswer | undefined = libraryAnswer(src, ctx.question, ctx.lang);
      if (!found) return undefined;
      return {
        tool: 'search_library',
        observation: clip(`[مكتبة ${found.kind}] ${found.references.map((r) => `${r.title} (${r2(r.score)})`).join(' · ')}\n${found.answer}`),
        strength: found.kind === 'material' ? 0.88 : found.kind === 'lesson' ? 0.82 : 0.62,
        answer: found.answer, source: found.kind === 'material' ? 'material' : 'library',
        citations: found.references.slice(0, 3).map((r) => ({ id: r.id, title: r.title, kind: (r.kind === 'memory' ? 'memory' : r.kind === 'lesson' ? 'lesson' : 'material') as ToolCitation['kind'] })),
        data: { kind: found.kind },
      };
    },
  },

  {
    name: 'refuge_way',
    labelAr: 'سأل ملجأ شاهين (الوصول لأي حاجة)', labelEn: 'Asked the refuge (reach anything)',
    descriptionAr: '«وين ألاقي…» — يوصّل الزائر أو أي روبوت للمكان الحقيقي لأي حاجة في المنظومة (تقرير، أداة، قسم، علم، قرار).',
    descriptionEn: '“Where do I find…” — points the visitor (or any robot) at the real place of anything in the platform.',
    args: '{}',
    run: async (_args, ctx) => {
      const way = refugeWay(ctx.question, ctx.lang);
      if (!way) return undefined;
      const found = findRefuge(ctx.question);
      return {
        tool: 'refuge_way',
        observation: clip(`[ملجأ] ${way}`),
        strength: found && found.score >= 4 ? 0.9 : 0.72,
        answer: `${way}\n\n_${sourceNote('refuge', ctx.lang)}._`, source: 'refuge',
        citations: found ? [{ id: found.entry.id, title: found.entry.nameAr, kind: 'platform' }] : [],
        ...(found?.entry.kind === 'section' ? { actions: [{ type: 'open_tab' as const, tab: found.entry.at.replace(/^#/, ''), title: found.entry.nameAr }] } : {}),
      };
    },
  },

  {
    name: 'knowledge_base',
    labelAr: 'دوّر في قاعدة معرفة شام', labelEn: "Searched Sham's knowledge base",
    descriptionAr: 'قاعدة معرفة الموقع وخدماته (الشحن والاسترجاع والطلبات والعطور المخصصة والجملة) — نفس فهرس مساعد شام.',
    descriptionEn: "The site's knowledge base and services (shipping, returns, orders, bespoke, wholesale) — the Sham assistant's own index.",
    args: '{"query":"كلمات البحث"}',
    run: async (args, ctx) => {
      const query = str(args, 'query') || ctx.question;
      const out = await coreTools.retrieve_knowledge.run({ query }, { repo: ctx.repo, message: ctx.question, lang: ctx.lang, env: ctx.env });
      if (out.observation === 'NO_RESULTS') return undefined;
      return {
        tool: 'knowledge_base',
        observation: clip(out.observation),
        strength: 0.7,
        citations: (out.citations || []).map((c) => ({ id: c.id, title: c.title, kind: (c.kind === 'product' ? 'product' : 'lesson') as ToolCitation['kind'] })),
        data: out.data,
      };
    },
  },

  {
    name: 'open_sources',
    labelAr: 'دوّر في المصادر المفتوحة', labelEn: 'Searched the open sources',
    descriptionAr: '«باحث شاهين»: سؤال جديد مش في الذاكرة ولا المكتبة — يدور في المصادر المفتوحة ويرد بالخلاصة ورابطها.',
    descriptionEn: "Shaheen's researcher: a new question, not in memory or library — looks it up in open sources and answers with the summary and its link.",
    args: '{"query":"السؤال كما يُبحث"}',
    run: async (args, ctx) => {
      if (!ctx.research) return undefined;
      const query = str(args, 'query') || ctx.question;
      const found = await ctx.research(query, ctx.lang).catch(() => undefined);
      if (!found) return undefined;
      return {
        tool: 'open_sources',
        observation: clip(researchAnswer(found)),
        strength: 0.66,
        answer: `${researchAnswer(found)}\n\n_${sourceNote('research', ctx.lang)}._`, source: 'research',
        citations: found.sources.slice(0, 3).map((s) => ({ id: s.url, title: s.title, kind: 'source' as const })),
        data: { sources: found.sources.map((s) => s.url) },
      };
    },
  },

  {
    name: 'material_card',
    labelAr: 'فتح موسوعة المواد الخام', labelEn: 'Opened the raw-materials encyclopaedia',
    descriptionAr: 'كارت مادة خام باسمها: رائحتها ومكانها في الهرم ونسبتها المعتادة وحد IFRA ودورها وتنبيهاتها.',
    descriptionEn: 'A raw-material card by name: its scent, pyramid place, usual share, IFRA limit, role and precautions.',
    args: '{"name":"اسم المادة"}',
    tracks: ['perfume', 'chemistry', 'biology', 'medicine'],
    run: async (args, ctx) => {
      const hit = materialHits(str(args, 'name') || ctx.question, 1)[0];
      if (!hit) return undefined;
      const card = ctx.lang === 'en' ? materialCardEn(hit.material) : materialCard(hit.material as never, ctx.lang);
      return {
        tool: 'material_card',
        observation: clip(card),
        strength: Math.min(0.95, 0.6 + hit.score * 0.08),
        answer: `${card}\n\n_${sourceNote('material', ctx.lang)}._`, source: 'material',
        citations: [{ id: hit.material.id, title: hit.material.nameAr, kind: 'material' }],
        actions: [{ type: 'open_tab', tab: 'raw_materials', title: ctx.lang === 'en' ? 'Raw materials' : 'موسوعة المواد الخام' }],
        data: { id: hit.material.id, ifra: (hit.material as Record<string, unknown>).ifraLimitPercent },
      };
    },
  },

  {
    name: 'calc_concentration',
    labelAr: 'حسب التركيز والمقادير', labelEn: 'Calculated the concentration split',
    descriptionAr: 'مقادير الزيت والكحول والماء والمثبت بالمل والجرام لحجم زجاجة ونسبة تركيز.',
    descriptionEn: 'Oil, alcohol, water and fixative amounts in ml and grams for a bottle size and a concentration.',
    args: '{"volumeMl":50,"percent":20,"batch":1,"waterPercent":0,"fixativePercent":0}',
    tracks: ['perfume', 'chemistry', 'math', 'commerce'],
    run: async (args, ctx) => {
      const volume = num(args, 'volumeMl') ?? volumeMl(ctx.question) ?? 50;
      const percent = num(args, 'percent') ?? concentrationPercentIn(ctx.question)
        ?? (ctx.previous ? concentrationPercentIn(ctx.previous) : undefined)
        ?? firstPercentIn(ctx.question) ?? (ctx.previous ? firstPercentIn(ctx.previous) : undefined) ?? 20;
      if (!(volume > 0 && volume <= 100000) || !(percent > 0 && percent <= 100)) return undefined;
      const result = calculatePerfumeFormulation({
        bottleVolumeMl: volume, batchCount: num(args, 'batch') ?? 1, concentrationPercent: percent,
        concentrationType: 'edp', alcoholPercentage: 96, waterPercent: num(args, 'waterPercent') ?? 0,
        fixativePercent: num(args, 'fixativePercent') ?? 0, oilDensity: 0.92, alcoholDensity: 0.8, unitMode: 'ml',
      });
      const ar = ctx.lang !== 'en';
      const lines = ar
        ? [`زجاجة ${volume} مل بتركيز ${percent}%:`,
          `- الزيت العطري: ${r2(result.oilVolumeMl)} مل (${r2(result.oilWeightGrams)} جم)`,
          `- الكحول: ${r2(result.alcoholVolumeMl)} مل (${r2(result.alcoholWeightGrams)} جم)`,
          result.waterPercent ? `- الماء المقطر: ${r2(result.waterVolumeMl)} مل` : '',
          result.fixativePercent ? `- المثبت: ${r2(result.fixativeVolumeMl)} مل` : '',
          `- الإجمالي: ${r2(result.totalWeightGrams)} جم${result.batchTotalVolumeMl > volume ? ` · التشغيلة ${r2(result.batchTotalVolumeMl)} مل` : ''}`].filter(Boolean)
        : [`${volume} ml at ${percent}% concentration:`,
          `- Fragrance oil: ${r2(result.oilVolumeMl)} ml (${r2(result.oilWeightGrams)} g)`,
          `- Alcohol: ${r2(result.alcoholVolumeMl)} ml (${r2(result.alcoholWeightGrams)} g)`,
          result.waterPercent ? `- Distilled water: ${r2(result.waterVolumeMl)} ml` : '',
          result.fixativePercent ? `- Fixative: ${r2(result.fixativeVolumeMl)} ml` : '',
          `- Total: ${r2(result.totalWeightGrams)} g`].filter(Boolean);
      return {
        tool: 'calc_concentration',
        observation: lines.join('\n'),
        strength: 0.95,
        answer: `${lines.join('\n')}\n\n_${sourceNote('calculator', ctx.lang)}._`, source: 'calculator',
        citations: [{ id: 'calc-concentration', title: ar ? 'حاسبة التركيز' : 'Concentration calculator', kind: 'tool' }],
        actions: [{ type: 'open_tab', tab: 'concentration', title: ar ? 'حاسبة التركيز' : 'Concentration calculator' }],
        data: result,
      };
    },
  },

  {
    name: 'calc_dilution',
    labelAr: 'حسب تخفيف الكحول', labelEn: 'Calculated the alcohol dilution',
    descriptionAr: 'تخفيف كحول من نسبة لأقل: كام مل كحول أصلي وكام مل ماء مقطر لحجم نهائي.',
    descriptionEn: 'Diluting alcohol down: how many ml of the original spirit and of distilled water for a target volume.',
    args: '{"from":96,"to":80,"targetVolumeMl":500}',
    tracks: ['perfume', 'chemistry', 'math'],
    run: async (args, ctx) => {
      const found = alcoholDilutionIn(ctx.question);
      const from = num(args, 'from') ?? found.from;
      const to = num(args, 'to') ?? found.to;
      const target = num(args, 'targetVolumeMl') ?? volumeMl(ctx.question) ?? 500;
      if (!from || !to) return undefined;
      const out = calculateAlcoholDilution(from, to, target);
      if (!out.isValid) return undefined;
      const ar = ctx.lang !== 'en';
      const lines = ar
        ? [`عشان تعمل ${target} مل كحول ${to}% من كحول ${from}%:`,
          `- خد ${r2(out.pureAlcoholVolumeNeeded)} مل من الكحول ${from}%`,
          `- ضيف ${r2(out.distilledWaterVolumeNeeded)} مل ماء مقطر`,
          `- معامل التخفيف: ${r2(out.dilutionFactor)}`]
        : [`To make ${target} ml of ${to}% alcohol from ${from}%:`,
          `- take ${r2(out.pureAlcoholVolumeNeeded)} ml of the ${from}% spirit`,
          `- add ${r2(out.distilledWaterVolumeNeeded)} ml of distilled water`,
          `- dilution factor: ${r2(out.dilutionFactor)}`];
      return {
        tool: 'calc_dilution', observation: lines.join('\n'), strength: 0.95,
        answer: `${lines.join('\n')}\n\n_${sourceNote('calculator', ctx.lang)}._`, source: 'calculator',
        citations: [{ id: 'calc-dilution', title: ar ? 'حاسبة تخفيف الكحول' : 'Alcohol dilution calculator', kind: 'tool' }],
        actions: [{ type: 'open_tab', tab: 'alcohol', title: ar ? 'حاسبة الكحول' : 'Alcohol calculator' }],
        data: out,
      };
    },
  },

  {
    name: 'calc_pyramid',
    labelAr: 'وزّع الهرم العطري', labelEn: 'Split the scent pyramid',
    descriptionAr: 'توزيع النوتات على القمة والقلب والقاعدة ومقاديرها من وزن الزيت، مع التأكد إن المجموع 100%.',
    descriptionEn: 'Splits the notes across top, heart and base with their amounts from the oil weight, and checks the total is 100%.',
    args: '{"top":30,"heart":40,"base":30,"oilMl":10}',
    tracks: ['perfume', 'chemistry', 'math', 'graphics'],
    run: async (args, ctx) => {
      const top = num(args, 'top'); const heart = num(args, 'heart'); const base = num(args, 'base');
      if (top === undefined && heart === undefined && base === undefined) return undefined;
      const notes = ([['top', top], ['heart', heart], ['base', base]] as const)
        .filter(([, v]) => typeof v === 'number' && v > 0)
        .map(([category, v], i) => ({ id: `n${i}`, nameAr: category === 'top' ? 'القمة' : category === 'heart' ? 'القلب' : 'القاعدة', nameEn: category, category, percentageOfOil: v! }));
      const oilMl = num(args, 'oilMl') ?? 10;
      const out = calculatePyramidDistribution(notes, oilMl * 0.92, oilMl);
      const ar = ctx.lang !== 'en';
      const warn = Math.abs(out.totalPercentage - 100) > 0.01
        ? (ar ? `⚠️ المجموع ${r2(out.totalPercentage)}% مش 100% — ظبط النسب.` : `⚠️ The total is ${r2(out.totalPercentage)}%, not 100% — adjust the shares.`)
        : '';
      const lines = [
        ar ? `توزيع الهرم على ${oilMl} مل زيت:` : `Pyramid split of ${oilMl} ml of oil:`,
        ...out.notesWithQuantities.map((n) => `- ${ar ? n.nameAr : n.nameEn}: ${r2(n.percentageOfOil)}% = ${r2(n.volumeMl!)} مل (${r2(n.weightGrams!)} جم)`),
        warn,
      ].filter(Boolean);
      return {
        tool: 'calc_pyramid', observation: lines.join('\n'), strength: warn ? 0.8 : 0.92,
        answer: `${lines.join('\n')}\n\n_${sourceNote('calculator', ctx.lang)}._`, source: 'calculator',
        citations: [{ id: 'calc-pyramid', title: ar ? 'حاسبة الهرم العطري' : 'Scent pyramid calculator', kind: 'tool' }],
        actions: [{ type: 'open_tab', tab: 'pyramid', title: ar ? 'حاسبة الهرم العطري' : 'Scent pyramid calculator' }],
        data: out,
      };
    },
  },

  {
    name: 'calc_cost',
    labelAr: 'حسب التكلفة وسعر البيع', labelEn: 'Calculated the cost and selling price',
    descriptionAr: 'تكلفة الزجاجة من سعر الزيت والكحول والعبوة والشغل، وسعر البيع المقترح بهامش الربح المطلوب.',
    descriptionEn: 'The bottle cost from the oil, alcohol, packaging and labour prices, and the suggested retail price at the wanted margin.',
    args: '{"volumeMl":50,"percent":20,"oilCostPerKg":3000,"alcoholCostPerLiter":200,"bottleUnitCost":15,"packagingUnitCost":5,"laborAndOverheadPerUnit":5,"batchSize":100,"targetMarginPercent":50}',
    tracks: ['commerce', 'perfume', 'math', 'management'],
    run: async (args, ctx) => {
      const volume = num(args, 'volumeMl') ?? volumeMl(ctx.question) ?? 50;
      const percent = num(args, 'percent') ?? concentrationPercentIn(ctx.question) ?? firstPercentIn(ctx.question) ?? 20;
      const oilCostPerKg = num(args, 'oilCostPerKg');
      if (oilCostPerKg === undefined) return undefined;
      const formulation = calculatePerfumeFormulation({
        bottleVolumeMl: volume, batchCount: num(args, 'batchSize') ?? 1, concentrationPercent: percent,
        concentrationType: 'edp', alcoholPercentage: 96, waterPercent: 0, fixativePercent: 0,
        oilDensity: 0.92, alcoholDensity: 0.8, unitMode: 'ml',
      });
      const out = calculateCosting(formulation, {
        oilCostPerKg, alcoholCostPerLiter: num(args, 'alcoholCostPerLiter') ?? 0,
        bottleUnitCost: num(args, 'bottleUnitCost') ?? 0, packagingUnitCost: num(args, 'packagingUnitCost') ?? 0,
        laborAndOverheadPerUnit: num(args, 'laborAndOverheadPerUnit') ?? 0,
        batchSize: num(args, 'batchSize') ?? 1, targetMarginPercent: num(args, 'targetMarginPercent') ?? 50,
      });
      const ar = ctx.lang !== 'en';
      const lines = ar
        ? [`تكلفة الزجاجة ${volume} مل (${percent}%):`,
          `- الزيت: ${r2(out.oilCostPerBottle)} · الكحول: ${r2(out.alcoholCostPerBottle)} · العبوة والتغليف: ${r2(out.packagingCostPerBottle)} · الشغل: ${r2(out.laborCostPerBottle)}`,
          `- إجمالي التكلفة: ${r2(out.totalCostPerBottle)}`,
          `- سعر البيع المقترح (هامش ${num(args, 'targetMarginPercent') ?? 50}%): ${r2(out.suggestedRetailPrice)} · جملة: ${r2(out.suggestedWholesalePrice)}`,
          `- ربح الزجاجة: ${r2(out.profitPerBottleRetail)} · التشغيلة: تكلفة ${r2(out.totalBatchCost)} وربح ${r2(out.totalBatchProfitRetail)}`]
        : [`Cost of one ${volume} ml bottle (${percent}%):`,
          `- oil ${r2(out.oilCostPerBottle)} · alcohol ${r2(out.alcoholCostPerBottle)} · packaging ${r2(out.packagingCostPerBottle)} · labour ${r2(out.laborCostPerBottle)}`,
          `- total cost: ${r2(out.totalCostPerBottle)}`,
          `- suggested retail (margin ${num(args, 'targetMarginPercent') ?? 50}%): ${r2(out.suggestedRetailPrice)} · wholesale: ${r2(out.suggestedWholesalePrice)}`,
          `- profit per bottle: ${r2(out.profitPerBottleRetail)}`];
      return {
        tool: 'calc_cost', observation: lines.join('\n'), strength: 0.95,
        answer: `${lines.join('\n')}\n\n_${sourceNote('calculator', ctx.lang)}._`, source: 'calculator',
        citations: [{ id: 'calc-cost', title: ar ? 'حاسبة التكلفة' : 'Costing calculator', kind: 'tool' }],
        actions: [{ type: 'open_tab', tab: 'costing', title: ar ? 'حاسبة التكلفة' : 'Costing calculator' }],
        data: out,
      };
    },
  },

  {
    name: 'maceration_plan',
    labelAr: 'رسم خطة التعتيق', labelEn: ' Drew the maceration plan',
    descriptionAr: 'مدة التعتيق المناسبة للعائلة العطرية (نفس أرقام محاكي التعتيق في الموقع) وتقييم مدة يذكرها الزائر.',
    descriptionEn: 'The maceration period for the scent family (the same numbers as the site simulator), and a check of a period the visitor names.',
    args: '{"family":"oriental","days":55}',
    tracks: ['perfume', 'chemistry', 'biology'],
    run: async (args, ctx) => {
      // نفس مدد «محاكي التخمير والنضج» في الموقع (src/components/MacerationTimeSimulator.tsx) — مفيش رقم مخترع.
      const PRESETS: { id: string; ar: string; en: string; days: number; words: string[] }[] = [
        { id: 'citrus_aquatic', ar: 'الحمضية والبحرية المنعشة', en: 'Citrus & marine aquatics', days: 18, words: ['حمضي', 'حمضيه', 'بحري', 'منعش', 'صيفي', 'كولونيا', 'citrus', 'marine', 'aquatic', 'fresh', 'cologne'] },
        { id: 'floral_fruity', ar: 'الزهرية والفاكهية الحلوة', en: 'Floral bouquets & sweet fruits', days: 30, words: ['زهر', 'زهري', 'وردي', 'ياسمين', 'فاكه', 'حلو', 'floral', 'flower', 'rose', 'jasmine', 'fruity', 'sweet'] },
        { id: 'woody_spicy', ar: 'الخشبية والتوابل والراتنجات', en: 'Woods, spices & resins', days: 42, words: ['خشب', 'خشبي', 'صندل', 'ارز', 'أرز', 'توابل', 'بهار', 'راتنج', 'woody', 'wood', 'sandalwood', 'cedar', 'spicy', 'resin'] },
        { id: 'oriental_oud', ar: 'الشرقية والعود المعتق والعنبر', en: 'Orientals, aged oud & amber', days: 55, words: ['شرقي', 'عود', 'عنبر', 'مسك', 'امبر', 'عنبري', 'oriental', 'oud', 'agarwood', 'amber', 'musk'] },
        { id: 'royal_attar', ar: 'الأتار الملكي المعتق', en: 'Aged royal attar', days: 75, words: ['اتار', 'أتار', 'دهن عود', 'ملكي', 'attar', 'royal', 'pure oil'] },
      ];
      const text = `${str(args, 'family') || ''} ${ctx.question}`.toLowerCase();
      const picked = PRESETS
        .map((p) => ({ p, score: p.words.filter((w) => text.includes(w.toLowerCase())).length }))
        .filter((x) => x.score > 0).sort((a, b) => b.score - a.score)[0]?.p;
      const asked = num(args, 'days') ?? macerationDaysIn(ctx.question);
      const ar = ctx.lang !== 'en';
      const lines: string[] = [];
      if (!picked && !asked) {
        // سؤال عام عن التعتق («كام يوم؟»): السلّم الكامل بأرقام المحاكي نفسه — مفيش رقم مخترع.
        const ladder = PRESETS.map((p) => (ar ? `- ${p.ar}: ${p.days} يوماً` : `- ${p.en}: ${p.days} days`)).join('\n');
        lines.push(ar
          ? `مدة التعتيق حسب العائلة العطرية (نفس أرقام محاكي التعتيق في الموقع):\n${ladder}\nوالقاعدة في كل الحالات: مكان مظلم بدرجة 18–22°م، رج خفيف كل يومين، وتجربة بعد كل مرحلة.`
          : `Maceration by scent family (the same numbers as the site simulator):\n${ladder}\nThe rule in every case: a dark place at 18–22 °C, a gentle swirl every two days, and a test after each stage.`);
      }
      if (picked) {
        lines.push(ar
          ? `العائلة «${picked.ar}» تحتاج تقريباً ${picked.days} يوماً تعتيق في مكان مظلم بدرجة 18–22°م مع رج خفيف كل يومين.`
          : `The “${picked.en}” family needs about ${picked.days} days of maceration in the dark at 18–22 °C, with a gentle swirl every two days.`);
      }
      if (asked) {
        const target = picked?.days;
        lines.push(ar
          ? (target ? (asked >= target ? `المدة اللي ذكرتها (${asked} يوماً) كافية — ${target} يوماً هو المرجع للعائلة دي.` : `⚠️ ${asked} يوماً أقل من المرجع (${target} يوماً) للعائلة دي: الفوحان هيقل والثبات هيضعف.`) : `المدة المذكورة: ${asked} يوماً.`)
          : (target ? (asked >= target ? `The period you named (${asked} days) is enough — ${target} days is the reference for this family.` : `⚠️ ${asked} days is below the reference (${target} days) for this family: projection and longevity will suffer.`) : `The period you named: ${asked} days.`));
      }
      return {
        tool: 'maceration_plan', observation: lines.join('\n'), strength: 0.85,
        answer: `${lines.join('\n')}\n\n_${sourceNote('calculator', ctx.lang)}._`, source: 'calculator',
        citations: [{ id: 'maceration', title: ar ? 'محاكي التخمير والنضج' : 'Maceration simulator', kind: 'tool' }],
        actions: [{ type: 'open_tab', tab: 'maceration_simulator', title: ar ? 'محاكي التعتيق' : 'Maceration simulator' }],
        data: { preset: picked?.id, days: asked, referenceDays: picked?.days },
      };
    },
  },

  {
    name: 'safety_check',
    labelAr: 'فحص سلامة التركيبة', labelEn: 'Checked the formula safety',
    descriptionAr: 'يقرا حدود IFRA والتنبيهات المكتوبة في موسوعة المواد لكل مادة في السؤال — من غير أي نصيحة طبية.',
    descriptionEn: 'Reads the IFRA limits and the precautions written in the materials encyclopaedia for every material in the question — never medical advice.',
    args: '{"materials":["عود","مسك"]}',
    tracks: ['perfume', 'chemistry', 'medicine', 'biology'],
    run: async (args, ctx) => {
      const names = Array.isArray(args.materials) ? (args.materials as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 8) : [];
      const asked = names.length ? names : [materialAsked(ctx.question)].filter((x): x is string => Boolean(x));
      const q = asked.map((n) => n.toLowerCase());
      const named = q.length
        ? RAW_MATERIALS_DATABASE.filter((m) => q.some((n) => `${m.nameAr} ${m.nameEn}`.toLowerCase().includes(n) || n.includes(m.nameEn.toLowerCase()))).slice(0, 5)
        : [];
      // من غير أسماء صريحة («عطر فيه مسك أبيض»): المواد اللي السؤال شاور عليها بكلامه — الأقوى مطابقة.
      const found = materialHits(ctx.question, 5);
      const strong = found.filter((x) => x.score >= 2).map((x) => x.material);
      const hits: RawMaterial[] = named.length ? named : strong.length ? strong : found.slice(0, 1).map((x) => x.material);
      if (!hits.length) return undefined;
      const ar = ctx.lang !== 'en';
      const lines = hits.map((m) => {
        const ifra = (m as Record<string, unknown>).ifraLimitPercent;
        const usageEn = percentsIn(m.recommendedUsagePercent);
        const ifraEn = percentsIn(ifra);
        return ar
          ? `- **${m.nameAr.replace(/\s*\(.*$/, '')}**: النسبة المعتادة ${m.recommendedUsagePercent || '—'}${typeof ifra === 'string' ? ` · IFRA: ${ifra}` : ''}${m.precautions ? ` · تنبيه: ${m.precautions}` : ''}`
          : `- **${m.nameEn}** (CAS ${m.casNumber}): usage recorded ${usageEn || '—'}${ifraEn ? ` · IFRA figure on record: ${ifraEn}` : ''} · ${PLACEMENT_EN[m.pyramidPlacement] || enSlug(m.pyramidPlacement)} note`;
      });
      const footer = ar
        ? '\n\nالأرقام دي من موسوعة المواد في شام، والمرجع النهائي دائماً أحدث كود IFRA قبل أي تصنيع. جرّب على الجلد مخففاً الأول، وفي حالة الأطفال أو الحمل أو الأمراض المزمنة استشر مختصاً.'
        : `\n\nThese figures come from the Sham materials encyclopaedia; the final reference is always the latest IFRA code before any production. Patch-test diluted, and for children, pregnancy or chronic illness consult a professional. ${ENCYCLOPAEDIA_EN}`;
      return {
        // فوق رد المكتبة: سؤال السلامة يستاهل حدود IFRA والتنبيهات مش كارت مادة عام.
        tool: 'safety_check', observation: clip(lines.join('\n')), strength: 0.92,
        answer: `${ar ? 'فحص السلامة للمواد المذكورة:' : 'Safety check of the named materials:'}\n${lines.join('\n')}${footer}\n\n_${sourceNote('material', ctx.lang)}._`,
        source: 'material',
        citations: hits.map((m) => ({ id: m.id, title: m.nameAr, kind: 'material' as const })),
        actions: [{ type: 'open_tab', tab: 'raw_materials', title: ar ? 'موسوعة المواد الخام' : 'Raw materials' }],
        data: { materials: hits.map((m) => m.id) },
      };
    },
  },

  {
    name: 'search_store',
    labelAr: 'دوّر في «متجر شام»', labelEn: 'Searched the Sham store',
    descriptionAr: 'منتجات المتجر الحقيقية بأسعارها ومخزونها وعائلاتها العطرية — مفيش منتج أو سعر مخترع.',
    descriptionEn: "The store's real products with their live prices, stock and scent families — never an invented product or price.",
    args: '{"query":"ما يبحث عنه الزائر","limit":4}',
    run: async (args, ctx) => {
      const out = await coreTools.search_store.run({ query: str(args, 'query') || ctx.question, limit: num(args, 'limit') ?? 4 },
        { repo: ctx.repo, message: ctx.question, lang: ctx.lang, env: ctx.env }).catch(() => undefined);
      if (!out || out.observation === 'STOREFRONT_EMPTY') return undefined;
      const items = ((out.data as { items?: { sku: string; nameAr: string; nameEn: string; price: number; currency?: string }[] })?.items) || [];
      const listed = out.observation.startsWith('STORE_MATCHES') || out.observation.startsWith('STORE_PRICE_DIGEST');
      const body = out.observation.split('\n').slice(1).join('\n').trim();
      const ar = ctx.lang !== 'en';
      // رد جاهز من غير ذكاء اصطناعي: سطور المتجر نفسها (منتجات وأسعار حقيقية من الخادم).
      const answer = listed && body
        ? `${ar ? 'من «متجر شام» — منتجات حقيقية بأسعارها ومخزونها:' : 'From the Sham store — real products with their prices and stock:'}\n${body}\n\n_${sourceNote('store', ctx.lang)}._`
        : undefined;
      return {
        tool: 'search_store', observation: clip(out.observation), strength: out.observation.startsWith('STORE_MATCHES') ? 0.8 : 0.5,
        ...(answer ? { answer, source: 'store' as AnswerSource } : {}),
        citations: items.slice(0, 4).map((p) => ({ id: p.sku, title: ctx.lang === 'en' ? p.nameEn : p.nameAr, kind: 'product' as const })),
        actions: [{ type: 'open_tab', tab: 'store', title: ctx.lang === 'en' ? 'The Sham store' : 'متجر شام' }],
        data: out.data,
      };
    },
  },

  {
    name: 'store_overview',
    labelAr: 'قرا حالة المتجر', labelEn: 'Read the store snapshot',
    descriptionAr: 'أرقام المتجر الحقيقية: عدد المنتجات والمتوفر ونطاق الأسعار والماركات والعائلات.',
    descriptionEn: "The store's real numbers: published products, stock, price range, brands and families.",
    args: '{}',
    tracks: ['commerce', 'management', 'math'],
    run: async (_args, ctx) => {
      const out = await coreTools.store_overview.run({}, { repo: ctx.repo, message: ctx.question, lang: ctx.lang, env: ctx.env }).catch(() => undefined);
      if (!out || out.observation === 'STOREFRONT_EMPTY') return undefined;
      return { tool: 'store_overview', observation: clip(out.observation), strength: 0.7, source: 'store', data: out.data };
    },
  },

  {
    name: 'perfume_news',
    labelAr: 'قرا نشرة أخبار العطور', labelEn: 'Read the perfume-news bulletin',
    descriptionAr: 'أخبار العطور الحقيقية اللي جمعها شاهين (كل 12 ساعة) — مفيش خبر مخترع.',
    descriptionEn: "The real perfume news Shaheen collected (every 12 hours) — never an invented headline.",
    args: '{"limit":4}',
    tracks: ['commerce', 'pr', 'media_info', 'perfume', 'social'],
    run: async (args, ctx) => {
      const news = await liveNews(ctx.env, ctx.fetch).catch(() => undefined);
      const items = (news?.items || []).slice(0, num(args, 'limit') ?? 4);
      if (!items.length) return undefined;
      const ar = ctx.lang !== 'en';
      const lines = items.map((i) => `- ${ar ? i.title.ar : i.title.en} (${i.source})${i.url ? ` — ${i.url}` : ''}`);
      return {
        tool: 'perfume_news', observation: clip(lines.join('\n')), strength: 0.6,
        answer: `${lines.join('\n')}\n\n_${sourceNote('news', ctx.lang)}._`, source: 'news',
        citations: items.map((i) => ({ id: i.id, title: ar ? i.title.ar : i.title.en, kind: 'news' as const })),
        actions: [{ type: 'open_tab', tab: 'perfume_news', title: ar ? 'أخبار العطور' : 'Perfume news' }],
      };
    },
  },

  {
    name: 'media_find',
    labelAr: 'دوّر على صورة أو مكان', labelEn: 'Looked for an image or a place',
    descriptionAr: 'صور حرة وفيديوهات ومكان على الخريطة لموضوع في الرد (بحسب ما يطلبه الزائر).',
    descriptionEn: 'Free images, videos and a map place for a topic in the answer (when the visitor asks for one).',
    args: '{"query":"الموضوع","kind":"image|video|place"}',
    run: async (args, ctx) => {
      const query = str(args, 'query');
      if (!query) return undefined;
      const kind = str(args, 'kind') || 'image';
      const signal = ctx.signal;
      if (kind === 'place') {
        const places = await searchPlace(query, { fetch: ctx.fetch, signal, lang: ctx.lang }).catch(() => undefined);
        if (!places?.places.length) return undefined;
        return {
          tool: 'media_find', observation: places.places.map((p) => `[مكان] ${p.label} (${p.lat}, ${p.lon})`).join('\n'), strength: 0.5,
          actions: [{ type: 'media', images: [], places: places.places.map((p) => ({ label: p.label, lat: p.lat, lon: p.lon })) }],
        };
      }
      if (kind === 'video') {
        const videos = await searchVideos(query, { env: ctx.env, fetch: ctx.fetch, signal, lang: ctx.lang, limit: 3 }).catch(() => undefined);
        if (!videos?.videos.length) return undefined;
        return { tool: 'media_find', observation: videos.videos.map((v) => `[فيديو] ${v.title} — ${v.channel}`).join('\n'), strength: 0.45 };
      }
      const images = await searchImages(query, { fetch: ctx.fetch, signal, limit: 3 }).catch(() => undefined);
      if (!images?.images.length) return undefined;
      return {
        tool: 'media_find', observation: images.images.map((i) => `[صورة] ${i.title}${i.author ? ` — ${i.author}` : ''}`).join('\n'), strength: 0.45,
        actions: [{ type: 'media', images: images.images.slice(0, 3).map((i) => ({ url: i.large || i.thumb, title: i.title, credit: `${i.author || ''} · ${i.license || ''} · ${i.page}`.trim() })) }],
        citations: images.images.slice(0, 3).map((i) => ({ id: i.page, title: i.title, kind: 'source' as const })),
      };
    },
  },

  {
    name: 'route_specialist',
    labelAr: 'وجّه السؤال لمتخصصه', labelEn: 'Routed the question to its specialist',
    descriptionAr: 'يعرض أنسب متخصص للسؤال من مجلس المتخصصين (لو السؤال خرج عن نطاق المتخصص الحالي).',
    descriptionEn: "Suggests the board's best specialist for the question (when it leaves the current specialist's scope).",
    args: '{"question":"السؤال"}',
    run: async (args, ctx) => {
      const query = str(args, 'question') || ctx.question;
      // نفس مقياس التوجيه اللي بيستخدمه المجلس من غير نموذج (pickSpecialist/matchScore) — مفيش معيار مخترع.
      const best = pickSpecialist(query, ctx.section);
      if (!best || best.id === ctx.specialist.id) return undefined;
      const ar = ctx.lang !== 'en';
      return {
        tool: 'route_specialist',
        observation: `[توجيه] الأنسب: ${best.nameAr} (${best.fieldAr})`,
        strength: 0.5,
        actions: [{ type: 'hand_over', to: best.id, title: ar ? best.nameAr : best.nameEn }],
        data: { specialist: best.id },
      };
    },
  },

  {
    name: 'open_section',
    labelAr: 'جهّز رابط القسم', labelEn: 'Prepared the section link',
    descriptionAr: 'يبعت الزائر لقسم حقيقي في الموقع (حاسبة، متجر، دليل، مواد خام، أخبار، مكتبة…).',
    descriptionEn: 'Sends the visitor to a real section of the site (calculators, store, guide, raw materials, news, library…).',
    args: '{"tab":"معرف القسم"}',
    run: async (args, ctx) => {
      const tab = str(args, 'tab');
      const section = SITE_SECTIONS.find((s) => s.id === tab);
      if (!section) return undefined;
      const ar = ctx.lang !== 'en';
      return {
        tool: 'open_section',
        observation: `[قسم] ${ar ? section.titleAr : section.titleEn} (#${section.id})`,
        strength: 0.4,
        actions: [{ type: 'open_tab', tab: section.id, title: ar ? section.titleAr : section.titleEn }],
      };
    },
  },

  {
    name: 'hand_over',
    labelAr: 'سلّم السؤال لصاحبه', labelEn: 'Handed the question over',
    descriptionAr: 'تسليم صريح: الخبير شاهين للتركيبات والتصميم، مساعد شام للطلبات والمتجر، أو متخصص تاني من المجلس.',
    descriptionEn: 'An explicit hand-over: Master Shaheen for formulations and design, the Sham assistant for orders and the store, or another board specialist.',
    args: '{"to":"shaheen|sham|specialist_id","note":"سبب التسليم"}',
    run: async (args, ctx) => {
      const to = str(args, 'to') as 'shaheen' | 'sham' | SpecialistId | undefined;
      if (!to) return undefined;
      const target = to === 'shaheen' || to === 'sham' ? undefined : specialistOf(to);
      if (to !== 'shaheen' && to !== 'sham' && !target) return undefined;
      const ar = ctx.lang !== 'en';
      // السؤال اللي بيتعرض للزائر يكون بكلامه هو: الملاحظة اللي جاية من خطة الأدوات هي نسخة البحث
      // المصححة، فترجع لأصل سؤال الزائر (ماينفعش نقول له كلام ماكتبهوش).
      const noteArg = str(args, 'note');
      const note = noteArg && ctx.raw && noteArg === ctx.question ? ctx.raw : noteArg;
      const text = to === 'shaheen'
        ? (ar ? 'ده شغل «الخبير شاهين» (تصميم التركيبات والحسابات المعملية) — سلّمته له باسمه.' : 'This is Master Shaheen’s work (formula design and lab calculations) — handed over to him by name.')
        : to === 'sham'
          ? (ar ? 'ده طلب أو خدمة — «مساعد شام» هو اللي ينفذه (طلب، جملة، دعم، تتبع).' : 'This is an order or a service — the Sham assistant executes it (orders, wholesale, support, tracking).')
          : (ar ? `ده نطاق «${target!.nameAr}» (${target!.fieldAr}) — حوّلته له.` : `This is the scope of ${target!.nameEn} — routed to them.`);
      return {
        tool: 'hand_over',
        observation: `${text}${note ? ` — ${note}` : ''}`,
        strength: 0.55,
        answer: `${text}${note ? `\n${note}` : ''}`,
        actions: to === 'shaheen'
          ? [{ type: 'open_chat', prompt: ctx.raw || ctx.question, title: ar ? 'الخبير شاهين' : 'Master Shaheen' }]
          : [{ type: 'hand_over', to, title: target ? (ar ? target.nameAr : target.nameEn) : undefined }],
        data: { to, service: Boolean(args.service) },
      };
    },
  },

  {
    name: 'study_later',
    labelAr: 'سجّل السؤال للمذاكرة', labelEn: 'Noted the question for study',
    descriptionAr: 'سؤال ملقاش إجابة صلبة: يتسجل في فجوات المعرفة عشان مدرسة شاهين تذاكره — من غير تخمين.',
    descriptionEn: "A question with no solid answer: noted in the knowledge gaps so Shaheen's school studies it — never guessed.",
    args: '{"reason":"ليه مفيش إجابة"}',
    run: async (args, ctx) => {
      const askedGap = ctx.raw || ctx.question;
      if (isPersonal(askedGap) || isTimeBound(askedGap)) return undefined;
      // «expert:chemistry» بتوصل لخبير المجال في المدرسة (scripts/shaheen-school/school.ts بيقرأها) —
      // وأي سبب تاني يفضل باسم المتخصص عشان تقرير المجلس يعرف فجواته.
      const why = str(args, 'reason');
      const reason = why && why.startsWith('expert:') ? why.slice(0, 60)
        : `specialists:${ctx.specialist.id}${why ? `:${why.slice(0, 60)}` : ''}`;
      const gap = await ctx.repo.recordGap({ question: askedGap, source: 'no_answer', reason }).catch(() => undefined);
      return {
        tool: 'study_later',
        observation: gap ? `[فجوة] اتسجلت للمذاكرة (${ctx.specialist.nameAr})` : '[فجوة] السؤال مااتسجلش (التخزين مش متاح)',
        strength: 0.3,
        source: 'gap',
        data: { recorded: Boolean(gap) },
      };
    },
  },

  {
    name: 'clarify',
    labelAr: 'طلب توضيح من الزائر', labelEn: 'Asked the visitor to clarify',
    descriptionAr: 'سؤال غامض أو ناقص: يسأل الزائر سؤال واحد محدد بدل ما يخمّن.',
    descriptionEn: 'A vague or incomplete question: asks the visitor one specific question instead of guessing.',
    args: '{"question":"السؤال اللي محتاجه من الزائر"}',
    run: async (args, ctx) => {
      const ask = str(args, 'question');
      if (!ask) return undefined;
      return { tool: 'clarify', observation: `[توضيح] ${ask}`, strength: 0.35, answer: ask, data: { clarify: true } };
    },
  },
];

export const toolOf = (name: string): SpecialistTool | undefined => SPECIALIST_TOOLS.find((t) => t.name === name);
/** أدوات المتخصص: العامة + اللي بتخدم مساراته (L-32 — محدش يشتغل بره نطاقه). */
export const toolsFor = (specialist: Specialist): SpecialistTool[] =>
  SPECIALIST_TOOLS.filter((t) => !t.tracks || t.tracks.some((track) => specialist.tracks.includes(track)));
export const toolNamesFor = (specialist: Specialist): ToolName[] => toolsFor(specialist).map((t) => t.name);

/** فهرس الأدوات كما يُعرض في لوحة الإدارة وفي خطوات الوكيل (من غير أي اسم مزوّد). */
export const toolCatalogue = (specialist: Specialist) => toolsFor(specialist).map((t) => ({
  id: t.name, labelAr: t.labelAr, labelEn: t.labelEn, descriptionAr: t.descriptionAr, descriptionEn: t.descriptionEn, args: t.args,
}));

/* ── خطة الوكيل الأولى (من غير نموذج): الأدوات اللي تتشغل فوراً على السؤال ─────────────────────── */
export interface ToolCall { tool: ToolName; args: Record<string, unknown> }

const ACCESS_WORDS = /(وين|أين|where|find|ألاقي|الاقي|ادور|أدور|مكان|report|تقرير|روبوت|robot|workflow|سير عمل|قسم|سجل)/i;
const SHOP_WORDS = /(اشتري|شراء|buy|order|طلب|سعر|price|بكام|متاح|متوفر|stock|available|product|منتج)/i;
/**
 * أول نسبة مئوية في السؤال — للزائر اللي كتبها من غير كلمة «تركيز» («how much alcohol for a
 * 100ml bottle at 15%?»). مش بديلاً عن `concentrationPercentIn` (الأدق): ده آخر محاولة قبل
 * الافتراضي 20%، عشان الحاسبة ماتردش برقم غير الرقم اللي الزائر كتبه.
 */
const firstPercentIn = (text?: string): number | undefined => {
  const m = (text || '').replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).match(/(\d+(?:[.,]\d+)?)\s*%/);
  const n = m ? Number(m[1]!.replace(',', '.')) : NaN;
  return Number.isFinite(n) && n >= 0.5 && n <= 100 ? n : undefined;
};

const CALC_WORDS = /(احسب|احسبي|كام|كم|calculate|how much|how many|نسبة|تركيز|تخفيف|تكلفة|هرم|مقادير)/i;
/** سؤال عن الأخبار نفسها (مش «عايز عطر جديد») — النشرة الحقيقية اللي جمعها شاهين هي الرد. */
const NEWS_WORDS = /(اخبار|أخبار|النشرة|نشرة|ترند|تريند|صيحات|موضه|موضة|\bnews\b|\bheadlines?\b|\btrends?\b|\blatest launch\w*\b)/i;
/** طلب أو خدمة صريحة — صاحبها «مساعد شام» (طلبات، جملة، شحن، دفع، تتبع). */
const ORDER_WORDS = /(أطلب|اطلب|اطلبي|هشتري|أشتري|اشتري|بالجملة|جملة|توصيل|شحن|السلة|سلة|دفع|أتتبع|تتبع الطلب|طلبية|\bplace (?:an )?order\b|\bwholesale\b|\bcheckout\b|\bdeliver\w*\b|\btrack (?:my|the) order\b|\bi (?:want|need) to (?:buy|order)\b)/i;
/** سؤال سلامة (حساسية/حمل/بشرة/IFRA) — موسوعة المواد هي المرجع، مش التخمين. */
const SAFETY_WORDS = /(حساسية|تحسس|حامل|حمل|رضاعة|رضيع|أطفال|اطفال|ربو|بشرة|جلد|تهيج|آمن|امن|خطر|تسمم|\bifra\b|\balerg\w*\b|\bpregnan\w*\b|\bskin\b|\birritat\w*\b|\bsafe(?:ty)?\b|\btoxic\w*\b)/i;

/**
 * الخطة الأولى: كل أداة ممكن تفيد في السؤال ده بتتشغل قبل أي نموذج — فالوكيل دايماً عنده حقائق
 * على الأرض يرد منها (ولو المحركات كلها وقفت، الرد يطلع من هنا بنفسه).
 */
export function planFirstTools(question: string, specialist: Specialist, section?: string, previous?: string): ToolCall[] {
  const available = new Set(toolNamesFor(specialist));
  const plan: ToolCall[] = [];
  const push = (tool: ToolName, args: Record<string, unknown> = {}) => {
    if (available.has(tool) && !plan.some((p) => p.tool === tool)) plan.push({ tool, args });
  };
  if (ACCESS_WORDS.test(question)) push('refuge_way');
  push('recall_memory');
  push('school_science', { query: question });
  push('search_library');
  const material = materialAsked(question);
  if (material) push('material_card', { name: material });
  const intents = questionIntents(question, previous);
  if (CALC_WORDS.test(question) || intents.some((i) => ['concentration', 'alcohol', 'costing', 'pyramid', 'maceration'].includes(i))) {
    // الحاسبات اللي بتاخد مقادير من الزائر (حجم/نسبة/تكلفة) ماتشتغلش من غير رقم في السؤال: من غير رقم
    // هتقول أرقام افتراضية من عندها وتقدمها كأنها إجابة — زي «ما هي أقصى نسبة IFRA للجالاكسوليد؟»
    // (سؤال سلامة، مش عملية حسابية). أما جدول التعتيق فمعلومات جاهزة من الموقع فبيشتغل من غير رقم.
    const hasNumber = /[\d٠-٩]/.test(question) || Boolean(previous && /[\d٠-٩]/.test(previous));
    if (hasNumber && (intents.includes('concentration') || concentrationPercentIn(question))) push('calc_concentration');
    if (hasNumber && (intents.includes('alcohol') || alcoholDilutionIn(question).from)) push('calc_dilution');
    if (hasNumber && intents.includes('costing')) push('calc_cost');
    if (hasNumber && intents.includes('pyramid')) push('calc_pyramid');
    if (intents.includes('maceration') || macerationDaysIn(question)) push('maceration_plan');
  }
  if (SHOP_WORDS.test(question) || intents.includes('store') || section === 'store' || section === 'productDetail') push('search_store', { query: question });
  if (SAFETY_WORDS.test(question)) push('safety_check');
  if (NEWS_WORDS.test(question)) push('perfume_news');
  if (!plan.some((p) => p.tool === 'knowledge_base')) push('knowledge_base', { query: question });
  // التسليم والوضوح قرار الوكيل (النموذج) — ومن غير نموذج خطة التسليم دي بتبقى آخر رد صادق
  // بدل فجوة مالهاش صاحب. `service: true` = طلب صريح (تصميم تركيبة، أو طلب/جملة/شحن) فصاحبه
  // أولى بالرد من أي درس قريب؛ وغير كده التسليم اقتراح بعد ما ترد العلوم والمتجر.
  const order = ORDER_WORDS.test(question);
  const hand = intents.includes('formula') ? 'shaheen' : order || intents.includes('store') ? 'sham' : undefined;
  const service = Boolean(intents.includes('formula') || order);
  const out = plan.slice(0, 6);
  if (hand && available.has('hand_over')) out.push({ tool: 'hand_over', args: { to: hand, note: question, service } });
  return out;
}
