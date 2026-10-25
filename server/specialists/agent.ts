/**
 * «وكيل مجلس المتخصصين» — the specialists' board is an AI agent, not a lookup box.
 *
 *   سؤال الزائر ← توجيهه لمتخصصه (نفس مقياس المجلس من غير نموذج) ← خطة أدوات أولى تتشغل فوراً
 *   ← الوكيل (محرك متاح) يقرا الملاحظات ويطلب أدوات تانية وهو شغال ← رد مبني على الملاحظات بس
 *   ← ولو كل المحركات وقفت: نفس الرد يتبني من الأدوات نفسها (من غير ذكاء اصطناعي ولا تخمين)
 *   ← ولو مفيش معلومة صلبة: فجوة صريحة باسم المتخصص («هيذاكر السؤال») وتُسجَّل لمدرسة شاهين.
 *
 * الأدوات كلها في server/specialists/tools.ts: مدرسة شاهين وعلومها، ذاكرته، مكتبته، موسوعة المواد،
 * حاسبات المعمل (التركيز والتخفيف والهرم والتكلفة والتعتيق والسلامة)، المتجر الحقيقي، نشرة الأخبار،
 * ملجأ شاهين، المصادر المفتوحة، والوسايط — وأدوات الوكيل نفسه (التوجيه، التسليم، التوضيح، المذاكرة).
 *
 * قواعد المنصة هنا زي كل الأدوات: مفيش اسم مزوّد أو منصة للزائر، مفيش رقم أو سعر أو رابط مخترع،
 * كل رد مكتوب عليه مصدره، والنطاق بتاع المتخصص بس (L-32)، وأي حاجة بره نطاقه تتسلّم باسمها
 * (الخبير شاهين للتركيبات، مساعد شام للطلبات، أو متخصص تاني من المجلس).
 */
import { callEngine, engineStatuses, scoreEngineOutput, type EngineTurn } from '../core/engines';
import type { EngineHealth } from '../core/engineHealth';
import { platformsOff } from '../core/selfReliance';
import { supervisorGuidance } from '../core/liveData';
import type { Repository } from '../core/repository';
import type { ShaheenMemory } from '../core/memory';
import type { ModelEngineId } from '../core/types';
import { guidanceBlock } from '../../src/utils/aiTools';
import { withHandbook } from '../../src/utils/botHandbook';
import { isPersonal, isTimeBound } from '../../src/utils/shaheenMemory';
import type { LibrarySources } from '../../src/utils/shaheenLibrary';
import type { Research } from '../../src/utils/webResearch';
import {
  consult, specialistOf, type Specialist, type SpecialistId,
} from '../../src/utils/shaheenSpecialists';
import {
  lessonsInScope, materialsInScope, planFirstTools, sourceNote, toolOf, toolsFor, TOOL_LIMITS,
  type AnswerSource, type SpecialistToolContext, type ToolAction, type ToolCall, type ToolCitation, type ToolName, type ToolObservation,
} from './tools';
import { consultBrain, relatedFollowUps, resolveAsked, routeQuestion, type BrainReply } from './brain';
import { present } from './present';
import type { Confidence } from '../../src/utils/shaheenAgent';

type Env = Record<string, string | undefined>;

/** ميزانية الزيارة الواحدة: خادم Vercel بيقفل عند 60 ثانية، فالوكيل بيخلص قبلها بأمان. */
export const AGENT_LIMITS = { totalMs: 44_000, roundMs: 16_000, maxRounds: 3, maxHistory: 4, maxAnswerChars: 4000 };

const VENDOR = /\b(?:gemini|gemma|openai|chat ?gpt|gpt-?\d|claude|anthropic|deepseek|openrouter|perplexity|llama|mistral|qwen|grok|manus|bard|copilot)\b|جيميني|جيمناي|شات ?جي ?بي ?تي|كلود|ديب ?سيك|أوبن ?إيه ?آي/i;
const ARABIC = /[\u0600-\u06FF]/;

export class SpecialistsError extends Error {
  constructor(public code: string, message: string, public status = 400, public retryAfterMs?: number) { super(message); }
}

export interface SpecialistConsultInput {
  question: string;
  lang: string;
  section?: string;
  specialistId?: SpecialistId;
  history?: { role: 'user' | 'assistant'; text: string }[];
}

export interface ToolTrace {
  tool: ToolName;
  /** اسم الأداة كما يظهر للزائر في خطوات الوكيل (من غير أي اسم منصة). */
  labelAr: string;
  labelEn: string;
  ok: boolean;
  ms: number;
}

export interface SpecialistPublic {
  id: SpecialistId;
  nameAr: string;
  nameEn: string;
  fieldAr: string;
  fieldEn: string;
  sciencesAr: string;
  sciencesEn: string;
}

export interface SpecialistConsultResult {
  specialist: SpecialistPublic;
  question: string;
  answer: string;
  /** قد إيه الرد متأكد من مصدره (العقل المدرَّب بيقيسها): عالية/متوسطة/منخفضة. */
  confidence?: Confidence;
  /** المتخصص حوّل السؤال لخبير المدرسة يذاكره عشان يرد أوفى المرة الجاية. */
  studying?: boolean;
  /** الرد سؤال توضيحي للزائر (السؤال كان غامض) — مش إجابة. */
  clarify?: boolean;
  source: AnswerSource;
  /** true = رد من معلومة صلبة؛ false = فجوة صريحة (مفيش تخمين). */
  ok: boolean;
  /** true = الرد صاغه الوكيل بمحرك؛ false = الرد من الأدوات نفسها (من غير ذكاء اصطناعي). */
  ai: boolean;
  /** خطوات الوكيل كما يراها الزائر (الأدوات اللي اشتغلت فعلًا). */
  tools: ToolTrace[];
  citations: ToolCitation[];
  actions: ToolAction[];
  followUps: string[];
  /** السؤال اتسجل لمدرسة شاهين يذاكره. */
  recorded: boolean;
  lang: 'ar' | 'en';
  section?: string;
  ms: number;
}

export interface SpecialistAgentDeps {
  repo: Repository;
  memory?: ShaheenMemory;
  env?: Env;
  fetch?: typeof fetch;
  library?: () => Promise<LibrarySources>;
  research?: (question: string, lang: string) => Promise<Research | undefined>;
  health?: EngineHealth;
  /** عدد المحاولات لكل خطوة (الاختبارات بتحقن 0 عشان ترد فوراً). */
  now?: () => number;
}

export const publicSpecialist = (s: Specialist): SpecialistPublic => ({
  id: s.id, nameAr: s.nameAr, nameEn: s.nameEn, fieldAr: s.fieldAr, fieldEn: s.fieldEn,
  sciencesAr: s.sciencesAr, sciencesEn: s.sciencesEn,
});

/* ── التحقق من المدخلات ───────────────────────────────────────────────────────────────────────── */
const ID = /^[a-z_]{3,40}$/;

export function validateConsultInput(body: unknown): SpecialistConsultInput {
  const b = (body || {}) as Record<string, unknown>;
  const question = typeof b.question === 'string' ? b.question.trim().replace(/\s+/g, ' ').slice(0, 1200) : '';
  if (question.length < 2) throw new SpecialistsError('INVALID_QUESTION', 'A question of at least two characters is required');
  const lang = typeof b.language === 'string' && b.language.toLowerCase().startsWith('en') ? 'en' : 'ar';
  const section = typeof b.section === 'string' && ID.test(b.section) ? b.section : undefined;
  const specialistId = typeof b.specialist === 'string' && ID.test(b.specialist) && specialistOf(b.specialist) ? b.specialist as SpecialistId : undefined;
  const history = Array.isArray(b.history)
    ? (b.history as unknown[]).slice(-AGENT_LIMITS.maxHistory)
      .map((t) => t as { role?: unknown; text?: unknown })
      .filter((t) => (t?.role === 'user' || t?.role === 'assistant') && typeof t.text === 'string')
      .map((t) => ({ role: t.role as 'user' | 'assistant', text: (t.text as string).slice(0, 1200) }))
    : [];
  return { question, lang, ...(section ? { section } : {}), ...(specialistId ? { specialistId } : {}), history };
}

/* ── بروتوكول الأدوات (نصي — يشتغل مع كل المحركات من غير خاصية معينة) ─────────────────────────── */
const TOOL_LINE = /^\s*(?:TOOL|أداة)\s*:?\s*([a-z_]+)\s*(\{[\s\S]*\})?\s*$/i;
const ANSWER_LINE = /^\s*(?:ANSWER|الرد)\s*:?\s*/i;

export interface ParsedTurn { calls: ToolCall[]; answer?: string }

/**
 * النموذج بيكتب سطر `TOOL name {json}` لكل أداة عايزها، أو `ANSWER:` وبعده الرد.
 * بنقرا الاتنين (ولو كتب الرد من غير البروتوكول خالص بنعتبره الرد نفسه) — من غير ما نرمي شغل.
 */
export function parseAgentTurn(text: string): ParsedTurn {
  const raw = (text || '').replace(/```[a-z]*\n?/gi, '').trim();
  if (!raw) return { calls: [] };
  const calls: ToolCall[] = [];
  const answerLines: string[] = [];
  let answering = false;
  for (const line of raw.split('\n')) {
    const call = line.match(TOOL_LINE);
    if (call) {
      answering = false;
      let args: Record<string, unknown> = {};
      if (call[2]) { try { const parsed = JSON.parse(call[2]); if (parsed && typeof parsed === 'object') args = parsed as Record<string, unknown>; } catch { /* وسائط بايظة ← الأداة تتشغل من السؤال نفسه */ } }
      if (/^[a-z_]{3,40}$/.test(call[1])) calls.push({ tool: call[1] as ToolName, args });
      continue;
    }
    if (ANSWER_LINE.test(line)) { answering = true; answerLines.push(line.replace(ANSWER_LINE, '')); continue; }
    if (answering) answerLines.push(line);
  }
  const answer = answerLines.join('\n').trim();
  // رد من غير البروتوكول: النص كله هو الرد (ما دام مفيهوش طلب أداة).
  return { calls: calls.slice(0, 4), ...(answer ? { answer } : (!calls.length && raw.length > 15 ? { answer: raw } : {})) };
}

/* ── تعليمات الوكيل ──────────────────────────────────────────────────────────────────────────── */
export function toolCataloguePrompt(specialist: Specialist, lang: 'ar' | 'en'): string {
  return toolsFor(specialist)
    .map((t) => `- ${t.name}${t.args}: ${lang === 'en' ? t.descriptionEn : t.descriptionAr}`)
    .join('\n');
}

export function specialistSystemPrompt(specialist: Specialist, lang: 'ar' | 'en', guidance = ''): string {
  const ar = lang !== 'en';
  const body = ar
    ? `أنت «${specialist.nameAr}» — ${specialist.fieldAr} في «مجلس المتخصصين» على منصة «شام».
نطاقك (ومتخرجش عنه): ${specialist.sciencesAr}

إزاي تشتغل:
1) اقرا ملاحظات الأدوات اللي اتجمعت لك. دي حقائق من بيانات شام نفسها (مدرسة شاهين وعلومها، ذاكرته، مكتبته، موسوعة المواد، حاسبات المعمل، المتجر، النشرة، الملجأ، المصادر المفتوحة).
2) لو ناقصك حاجة، اطلب أداة — سطر واحد لكل أداة بالشكل ده:
TOOL اسم_الأداة {"الوسيط":"القيمة"}
3) لما تبقى جاهز ترد اكتب:
ANSWER:
وردك هنا.

قواعدك (ملزمة):
- ترد من ملاحظات الأدوات بس. مفيش رقم ولا سعر ولا اسم منتج ولا رابط ولا تاريخ من دماغك — لو مفيش ملاحظة فيها المعلومة، قول بصراحة إنك لسه هتذاكر السؤال.
- اسأل أداة واحدة أو اتنين في المرة، ومتكررش أداة رجّعت ملاحظة كاملة.
- سؤال بره نطاقك: سلّمه بصراحة (TOOL hand_over {"to":"shaheen"} للتركيبات والتصميم، {"to":"sham"} للطلبات والمتجر، أو {"to":"specialist_…"} لمتخصص تاني من المجلس) ومتجاوبش فيه.
- سؤال غامض: اسأل الزائر سؤال واحد محدد (TOOL clarify {"question":"…"}).
- الطب والقانون والدين: تعليم عام فقط، من غير تشخيص ولا وصفة ولا جرعة ولا فتوى، وحوّل الزائر لمختص مرخّص عند أي حالة شخصية.
- مفيش أسماء شركات أو نماذج ذكاء اصطناعي في ردك، وماتقولش إنك إنسان.
- ردك بلغة الزائر (${ar ? 'العربية' : 'لغة الزائر'})، واضح ومرتب: Markdown بسيط (### عناوين قصيرة، نقاط، **عريض**، جدول صغير للنِّسب)، وطوله على قد السؤال.
- ابدأ بالإجابة المباشرة، واذكر الأرقام بوحداتها (مل، جم، %، يوم)، واختم بسطر واحد فيه خطوة عملية أو تحذير سلامة لو له محل.`
    : `You are “${specialist.nameEn}” on the specialists' board of the Sham platform.
Your scope (never leave it): ${specialist.sciencesEn}

How you work:
1) Read the tool observations you were given. They are facts from Sham's own data (Shaheen's school and sciences, his memory, his library, the materials encyclopaedia, the lab calculators, the store, the news bulletin, the refuge, the open sources).
2) If something is missing, ask for a tool — one line per tool:
TOOL tool_name {"arg":"value"}
3) When you are ready, write:
ANSWER:
your reply.

Binding rules:
- Answer only from the observations. Never invent a number, price, product name, link or date; when no observation carries it, say plainly that you will study the question.
- Ask for one or two tools at a time, and never repeat a tool that already returned a full observation.
- A question outside your scope: hand it over explicitly (TOOL hand_over {"to":"shaheen"} for formulations, {"to":"sham"} for orders and the store, {"to":"specialist_…"} for another board member) and do not answer it.
- A vague question: ask one specific question back (TOOL clarify {"question":"…"}).
- Medicine, law and faith: general education only — no diagnosis, prescription, dose or ruling; refer personal cases to a licensed professional.
- Never name an AI company or model, and never claim to be human.
- Answer in the visitor's language, clear and organised (simple Markdown), as long as the question needs.
- Start with the direct answer, give numbers with their units (ml, g, %, days), and close with one practical step or safety note where it belongs.`;
  return withHandbook(specialist.id, body + guidanceBlock(guidance));
}

/** بلوك الحقائق اللي النموذج يبني عليه (مفيش غيرها في السياق). */
export function factsBlock(observations: ToolObservation[], lang: 'ar' | 'en', max = 9000): string {
  const head = lang === 'en' ? 'TOOL OBSERVATIONS (your only facts):' : 'ملاحظات الأدوات (هي دي حقائقك بس):';
  let out = '';
  for (const o of observations) {
    const piece = `\n[${o.tool}] (strength ${o.strength.toFixed(2)})\n${o.observation}\n`;
    if (out.length + piece.length > max) break;
    out += piece;
  }
  return out.trim() ? `${head}\n${out.trim()}` : (lang === 'en' ? 'NO OBSERVATIONS YET — ask for a tool or say you will study the question.' : 'مفيش ملاحظات لسه — اطلب أداة أو قول إنك هتذاكر السؤال.');
}

/* ── الرد من غير نموذج: نفس منطق المجلس (ذاكرة ← مكتبة ← فجوة صريحة) + أدوات المعمل والمتجر ────── */
const GAP_TOOLS: ToolName[] = ['study_later'];

/** أدوات التوجيه والتسليم — ملاحظاتها للوكيل، مش ردود للزائر. */
export const CONTROL_TOOLS: ToolName[] = ['clarify', 'hand_over', 'study_later', 'route_specialist', 'open_section', 'media_find'];
/** أقل قوة لملاحظة تُعتبر رداً صلباً من غير محرك (فوق الدرس القريب في المكتبة). */
export const EVIDENCE_FLOOR = 0.6;

export function bestEvidence(observations: ToolObservation[], skip: ToolName[] = []): ToolObservation | undefined {
  return observations
    .filter((o) => o.answer && !skip.includes(o.tool))
    .sort((a, b) => b.strength - a.strength)[0];
}

/**
 * أدوات **بيانات الموقع الدقيقة**: أرقامها من حاسبات شام، ومنتجاتها وأسعارها من متجرها، وحدودها
 * من موسوعة المواد — فتردّها قبل أي كلام عام من الأرشيف. الرقم في القيمة = أقل قوة تقبلها
 * (`material_card` محتاج مطابقة قوية عشان كارت مادة واحدة ماياخدش مكان مقارنة أو درس).
 */
const PRECISE_FLOOR: Partial<Record<ToolName, number>> = {
  calc_concentration: 0.5, calc_dilution: 0.5, calc_pyramid: 0.5, calc_cost: 0.5, maceration_plan: 0.5,
  safety_check: 0.5, refuge_way: 0.5, search_store: 0.5, store_overview: 0.5, perfume_news: 0.5,
  material_card: 0.8, trade_lane: 0.5,
};
export function bestPrecise(observations: ToolObservation[], outOfScope = false): ToolObservation | undefined {
  return observations
    .filter((o) => o.answer && (PRECISE_FLOOR[o.tool] ?? 1) <= o.strength)
    // سؤال خارج النطاق («إيه توقعك لسعر X بكرة؟»): النشرة الحقيقية أو منتج **اتلاقى فعلاً في
    // المتجر** بس — ملخص أسعار عام مش رد على سؤال عن توقع، والرد عليه بيه يبقى تخمين.
    .filter((o) => !outOfScope || o.tool === 'perfume_news' || o.tool === 'trade_lane' || (o.tool === 'search_store' && (o.data as { matched?: boolean } | undefined)?.matched))
    .sort((a, b) => b.strength - a.strength)[0];
}

/** مصادر الرد اللي أصلها درس (منهج/مكتبة/علوم/قاعدة معرفة) — دي اللي بيتقال عليها «أقرب حاجة مكتوبة». */
const LESSON_SOURCES = new Set<string>(['science', 'academy', 'library', 'knowledge']);

/** أقرب درس مش بيرد على السؤال بالظبط: بنقولها بصراحة بدل ما يتقدم على إنه الإجابة. */
const NEAR_MISS = {
  ar: 'مافيش مصدر في أرشيف المدرسة بيرد على سؤالك بالظبط — والتخمين ممنوع، فسجلت سؤالك للمدرسة تذاكره. دي أقرب حاجة مكتوبة عندنا (ممكن ماتكونش هي الإجابة):\n\n',
  en: "Nothing in the school's archive answers your exact question, and guessing is forbidden — so the question is noted for the school. This is the closest written material we have (it may not be the answer):\n\n",
};

/**
 * سؤال خارج نطاق العلوم (سعر لحظي، خبر لسه طالع، حالة شخصية): مافيش تخمين فيه، ومافيش وعد إن
 * المدرسة «هتذاكره» — لأن الإجابة مش معلومة تتذاكر. بنقول للزائر فين الحاجة الحقيقية.
 */
const OUT_OF_SCOPE_NOTE = {
  ar: 'ده سؤال عن سعر لحظي أو خبر لسه طالع أو حالة شخصية — والمجلس مايخمنش في دول، ومافيش درس يتذاكر فيهم. الأرقام الحقيقية في «متجر شام»، وأخبار العطور في نشرتها، والحالة الشخصية مكانها عند مختص.\n\n',
  en: 'This is a live price, a breaking headline or a personal case — the board does not guess those, and there is no lesson to study for them. Real numbers are in the Sham store, perfume news in its bulletin, and a personal case belongs with a professional.\n\n',
};

/** العقل مقفول أو وقع: الوكيل يكمل بأدواته من غير ما يوقع الزيارة. */
const NO_BRAIN: BrainReply = { source: 'library', confidence: 'low', used: [], refer: false, clarify: false, note: '', outOfScope: false, trace: [] };

/** أرشيف المدرسة بيدخل في حقائق المحرك: النموذج يبني على درس مراجَع بدل ما يبدأ من الصفر. */
function archiveBlock(brain: BrainReply, lang: string): string {
  if (!brain.answer || brain.clarify) return '';
  const head = lang === 'en' ? 'FROM THE SCHOOL ARCHIVE (reviewed material — build on it, never invent beyond it)' : 'من أرشيف المدرسة (مادة مراجَعة — ابني عليها وماتزودش عليها من دماغك)';
  return `\n\n${head}:\n${brain.answer.slice(0, 1400)}`;
}

/** ترتيب المصادر اللي «consult» بيمشي عليها — نفس رد المجلس من غير إنترنت، بس بأدوات السيرفر. */
async function localConsult(question: string, lang: 'ar' | 'en', observations: ToolObservation[], section: string | undefined, specialist: Specialist) {
  const find = (tool: ToolName) => observations.find((o) => o.tool === tool && o.answer);
  return consult(question, lang, {
    refuge: () => find('refuge_way')?.answer,
    recall: () => { const o = find('recall_memory'); return o ? { answer: o.answer! } : undefined; },
    library: () => find('search_library')?.answer ?? find('school_science')?.answer,
  }, section, specialist.id);
}

/* ── الوكيل ──────────────────────────────────────────────────────────────────────────────────── */
export async function runSpecialistAgent(input: SpecialistConsultInput, deps: SpecialistAgentDeps): Promise<SpecialistConsultResult> {
  const env = deps.env || process.env;
  const started = Date.now();
  const lang: 'ar' | 'en' = input.lang === 'en' ? 'en' : 'ar';
  const total = AbortSignal.any([AbortSignal.timeout(AGENT_LIMITS.totalMs)]);
  // آخر سؤال من الزائر: المتابعة القصيرة («طيب ولو 100 مل؟») بتكمل على موضوعه.
  const previous = [...(input.history || [])].reverse().find((t) => t.role === 'user')?.text;
  // 0) فهم السؤال وتوجيهه: غلطات الكتابة، الكيبورد الإنجليزي، المتابعة، نوع السؤال، ومجاله.
  const routed = routeQuestion(input.question, { lang, ...(input.section ? { section: input.section } : {}), ...(previous ? { previous } : {}) });
  const specialist = (input.specialistId && specialistOf(input.specialistId)) || routed.specialist;
  const asked = routed.asked || resolveAsked(input.question, previous);
  const understanding = routed.understanding;

  // المكتبة بتتقرا مرة واحدة في الزيارة، وبتيجي **في نطاق المتخصص** (L-32): الأدوات والعقل
  // المدرَّب والرد المحلي بيشربوا من نفس الكاس، فمفيش حاجة تقدر ترد من مجال متخصص تاني.
  let cachedLibrary: Promise<LibrarySources> | undefined;
  const library = () => (cachedLibrary ??= (async (): Promise<LibrarySources> => {
    try {
      const src = deps.library ? await deps.library() : { lessons: [], materials: [] };
      return {
        lessons: lessonsInScope(src.lessons || [], specialist),
        materials: materialsInScope(specialist) ? src.materials || [] : [],
        ...(src.memory ? { memory: src.memory } : {}),
      };
    } catch { return { lessons: [], materials: [] }; }
  })());

  // السؤال اللي قبله بيوصل للأدوات **لو السؤال ده متابعة فعلاً** («طيب ولو 100 مل؟») — سؤال
  // مستقل بموضوعه («ايه هو المسك؟») ماياخدش حسابة السؤال اللي قبله بالغلط.
  const followUp = asked.trim() !== input.question.trim();
  const ctx: SpecialistToolContext = {
    question: asked, raw: input.question, ...(followUp && previous ? { previous } : {}), lang, specialist,
    section: input.section, repo: deps.repo, memory: deps.memory, library, research: deps.research, env,
    fetch: deps.fetch, signal: total,
  };

  const traces: ToolTrace[] = [];
  const observations: ToolObservation[] = [];
  const callsMade = new Set<string>();

  /** يشغّل أداة واحدة: بحد وقت، ومن غير ما يرمي الوكيل لو وقعت (الملاحظة الفاضية = «malqatsh»). */
  const runOne = async (call: ToolCall): Promise<ToolObservation | undefined> => {
    const key = `${call.tool}:${JSON.stringify(call.args).slice(0, 160)}`;
    if (callsMade.has(key) || callsMade.size >= TOOL_LIMITS.maxCalls || total.aborted) return undefined;
    callsMade.add(key);
    const tool = toolOf(call.tool);
    if (!tool) return undefined;
    // نطاق المتخصص (L-32): أداة بره مساراته ماتشتغلش حتى لو النموذج طلبها.
    if (!toolsFor(specialist).some((t) => t.name === tool.name)) return undefined;
    const from = Date.now();
    try {
      const out = await Promise.race([
        tool.run(call.args, ctx),
        new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), TOOL_LIMITS.perCallMs)),
      ]);
      traces.push({ tool: tool.name, labelAr: tool.labelAr, labelEn: tool.labelEn, ok: Boolean(out), ms: Date.now() - from });
      if (out) observations.push(out);
      return out;
    } catch {
      traces.push({ tool: tool.name, labelAr: tool.labelAr, labelEn: tool.labelEn, ok: false, ms: Date.now() - from });
      return undefined;
    }
  };

  // 1) الخطة الأولى: الحقائق على الأرض قبل أي نموذج (ولو المحركات وقفت، الرد يطلع منها).
  for (const call of planFirstTools(asked, specialist, input.section, followUp ? previous : undefined)) await runOne(call);

  // سطر «فهمت سؤالك كده» من العقل المدرَّب — بيتحط بعد ما العقل يشتغل، وقبل أي رد يتبني.
  let understood = '';
  const finish = (partial: {
    answer: string; source: AnswerSource; ok: boolean; ai: boolean; recorded?: boolean;
    used?: ToolObservation[]; followUps?: string[]; confidence?: Confidence; studying?: boolean; step?: boolean; clarify?: boolean;
  }): SpecialistConsultResult => {
    const used = partial.used || observations.filter((o) => o.answer === partial.answer);
    const actions: ToolAction[] = [];
    const citations: ToolCitation[] = [];
    for (const o of [...used, ...observations.filter((x) => x.actions?.some((a) => a.type === 'hand_over'))]) {
      for (const a of o.actions || []) if (!actions.some((x) => JSON.stringify(x) === JSON.stringify(a))) actions.push(a);
      for (const c of o.citations || []) if (!citations.some((x) => x.id === c.id)) citations.push(c);
    }
    const followUps = [...new Set([...(partial.followUps || []), ...used.flatMap((o) => o.followUps || [])])].filter(Boolean).slice(0, 3);
    // «فهمت سؤالك كده: …» فوق الرد — لو العقل قرا كلمة بشكل مختلف، الزائر يشوف قراها إزاي.
    const noted = understood && !partial.answer.includes(understood) ? `${understood}\n\n${partial.answer}` : partial.answer;
    return {
      specialist: publicSpecialist(specialist),
      question: input.question,
      // العرض: مصدر الرد مكتوب دايمًا، والطول مظبوط، والخطوة الجاية قبل سطر المصدر.
      answer: present(noted, { source: partial.source, lang, actions, step: partial.step, max: AGENT_LIMITS.maxAnswerChars }).trim(),
      source: partial.source,
      ok: partial.ok,
      ai: partial.ai,
      ...(partial.confidence ? { confidence: partial.confidence } : {}),
      ...(partial.studying ? { studying: true } : {}),
      ...(partial.clarify ? { clarify: true } : {}),
      tools: traces,
      citations: citations.slice(0, 6),
      actions: actions.slice(0, 4),
      followUps,
      recorded: Boolean(partial.recorded),
      lang,
      ...(input.section ? { section: input.section } : {}),
      ms: Date.now() - started,
    };
  };

  // 2) سؤال محفوظ بنفسه في ذاكرة شاهين: يترد فوراً من غير ما ندفع أي رصيد (زي شات شاهين).
  const exact = observations.find((o) => o.tool === 'recall_memory' && (o.data as { exact?: boolean } | undefined)?.exact);
  if (exact?.answer) return finish({ answer: exact.answer, source: 'memory', ok: true, ai: false, used: [exact], confidence: 'high' });

  // 2ب) العقل المدرَّب (من غير أي محرك): يفهم السؤال، يجيب السؤال المقصود من الأرشيف في نطاق
  //     المتخصص (L-32)، يتأكد إن المصدر بيجاوب النوع المطلوب، ويعرض الرد بمصدره.
  const sources = await library();
  const memoryFile = sources.memory ?? (deps.memory ? await deps.memory.all().catch(() => undefined) : undefined);
  const brain: BrainReply = await consultBrain({
    question: asked, lang, specialist, lessons: sources.lessons, materials: sources.materials,
    ...(memoryFile ? { memory: memoryFile } : {}),
    ...(deps.research ? { research: deps.research } : {}),
    willRecord: true,
  }).catch(() => NO_BRAIN);
  // سطر «فهمت سؤالك كده» من قراءة المجلس للسؤال الأصلي — العقل بياخد السؤال بعد القراءة دي،
  // فلو اعتمدنا عليه مايبانش أي تصحيح للزائر.
  understood = routed.understanding.note || brain.note;

  // 3) الوكيل بمحرك متاح: يقرا الملاحظات، يطلب أدوات تانية، ويكتب الرد.
  const settings = await deps.repo.settings().catch(() => undefined);
  const policy = (settings?.shaheen.engines || []) as ModelEngineId[];
  const configured = new Set(engineStatuses(env).filter((e) => e.configured).map((e) => e.id));
  const wanted = policy.filter((id) => configured.has(id));
  const engines = deps.health ? deps.health.order(wanted) : wanted;
  const aiOn = Boolean(settings?.shaheen.enabled) && engines.length > 0 && !platformsOff(env);
  const guidance = aiOn ? await supervisorGuidance('specialists_agent', env, deps.fetch).catch(() => '') : '';
  const system = specialistSystemPrompt(specialist, lang, guidance);
  const turns: EngineTurn[] = [
    ...(input.history || []).slice(-AGENT_LIMITS.maxHistory),
    { role: 'user', text: `${lang === 'en' ? 'The visitor asks' : 'الزائر بيسأل'}${input.section ? ` (${lang === 'en' ? 'section' : 'قسم'}: ${input.section})` : ''}: ${asked}\n\n${factsBlock(observations, lang)}${archiveBlock(brain, lang)}` },
  ];

  let aiAnswer: string | undefined;
  if (aiOn) {
    for (let round = 0; round < AGENT_LIMITS.maxRounds && !aiAnswer && !total.aborted; round++) {
      let text: string | undefined;
      let engine: ModelEngineId | undefined;
      for (const id of engines) {
        if (total.aborted) break;
        const signal = AbortSignal.any([total, AbortSignal.timeout(AGENT_LIMITS.roundMs)]);
        try {
          const out = await callEngine(id, system, turns, {
            env, fetch: deps.fetch, signal, temperature: settings?.shaheen.temperature ?? 0.4,
            model: settings?.shaheen.models[id] || undefined, maxTokens: 2048, maxChars: 16000,
          });
          if (out?.trim()) { text = out.trim(); engine = id; deps.health?.ok(id); break; }
          deps.health?.fail(id, 'empty');
        } catch {
          deps.health?.fail(id, signal.aborted ? 'timeout' : 'upstream_error');
        }
      }
      if (!text || !engine) break;
      const parsed = parseAgentTurn(text);
      if (parsed.answer) { aiAnswer = parsed.answer.slice(0, AGENT_LIMITS.maxAnswerChars); break; }
      if (!parsed.calls.length) break;
      turns.push({ role: 'assistant', text });
      const fresh: ToolObservation[] = [];
      for (const call of parsed.calls) {
        const out = await runOne(call);
        if (out) fresh.push(out);
      }
      turns.push({ role: 'user', text: factsBlock(fresh, lang, 6000) });
    }
  }

  // 4) فحص الرد: لغة الزائر، مفيش اسم مزوّد، ومفيش رقم أو مرجع مش موجود في الملاحظات.
  const facts = observations.map((o) => `${o.observation} ${o.answer || ''}`);
  const usable = (text: string) => {
    if (text.trim().length < 20 || VENDOR.test(text)) return false;
    if (lang === 'ar' && !ARABIC.test(text)) return false;
    if (lang === 'en' && ARABIC.test(text) && !/[a-z]{4}/i.test(text)) return false;
    const score = scoreEngineOutput(text, facts);
    return !score.issues.some((i) => i.startsWith('ungrounded_price') || i.startsWith('ungrounded_ref') || i === 'empty_output');
  };

  // 5) الرد النهائي — والترتيب ده هو «التدريب» كله: بيانات الموقع الدقيقة ← العقل المدرَّب ←
  //    التسليم الصريح ← باقي الأدلة ← الرد المحلي المجرب ← التوضيح ← الفجوة الصادقة. مافيش تخمين.
  const local = await localConsult(input.question, lang, observations, input.section, specialist);
  const outOfScope = Boolean(understanding.outOfScope);
  const precise = bestPrecise(observations, outOfScope);
  const evidence = bestEvidence(observations, CONTROL_TOOLS);

  if (aiAnswer && usable(aiAnswer)) {
    const answer = `${aiAnswer.trim()}\n\n_${sourceNote('agent', lang)}._`;
    // مصدر رد الوكيل = مصدر أقوى ملاحظة بني عليها (ولو مفيش ملاحظة صلبة: «وكيل المتخصصين»).
    const source: AnswerSource = evidence?.source || brain.source || 'agent';
    // يتحفظ في ذاكرة شاهين عشان يترد من غير أي محرك المرة الجاية (الاعتماد على النفس).
    if (deps.memory && !isPersonal(input.question) && !isTimeBound(input.question)) {
      await deps.memory.learn({ question: input.question, lang, mode: 'auto', answer }).catch(() => false);
    }
    return finish({ answer, source, ok: true, ai: true, used: observations.filter((o) => o.strength >= 0.5).slice(0, 4) });
  }

  // (أ) طلب أو خدمة صريحة («عايز أشتري/اطلب/أكلم حد»): مفيش معلومة بترد على طلب — صاحبه أولى،
  //     فيتحسب قبل أرقام المتجر (قايمة المنتجات مش رد على «عايز أشتري»).
  const service = observations.find((o) => o.tool === 'hand_over' && o.answer && (o.data as { service?: boolean } | undefined)?.service);
  if (service?.answer) return finish({ answer: service.answer, source: 'agent', ok: true, ai: false, used: [service] });

  // (ب) أرقام ومنتجات الموقع نفسها: الحاسبات، موسوعة المواد، المتجر، النشرة، الملجأ، السلامة، التعتيق.
  //     استثناء: مقارنة بين طرفين («الفرق بين X وY») — العقل بيرد على كل طرف من مصدره أحسن من كارت واحد.
  if (precise?.answer && !understanding.parts) {
    return finish({ answer: precise.answer, source: precise.source || 'calculator', ok: true, ai: false, used: [precise], confidence: 'high' });
  }

  // (ج) العقل المدرَّب: دروس الخبير المراجَعة ← المكتبة والموسوعة ← الذاكرة ← المصادر المفتوحة،
  //     بعد ما يتأكد إن المصدر بيجاوب **نوع** السؤال وموضوعه (مين←شخص، كام←رقم، ليه←سبب).
  if (brain.answer && (brain.confidence !== 'low' || brain.clarify)) {
    // رد العقل من موسوعة المواد ياخد معه زر الأداة اللي فتحت نفس الكارت (الموسوعة) ومراجعها.
    const support = brain.source === 'material' ? observations.filter((o) => o.tool === 'material_card') : [];
    return finish({
      answer: brain.answer, source: brain.source, ok: !brain.clarify, ai: false, used: support,
      confidence: brain.confidence, ...(brain.refer ? { studying: true } : {}), ...(brain.clarify ? { clarify: true } : {}),
      followUps: relatedFollowUps(asked, specialist, lang),
    });
  }

  // (د) درس قريب من السؤال بس مش بيرد عليه: العقل المدرَّب فحصه ورفضه، فماتقدمش على إنه الإجابة —
  //     بنقول للزائر إنها أقرب حاجة مكتوبة، وبنسجل السؤال للمدرسة تذاكره (أحسن من درس جانبي).
  const lesson = evidence?.answer && LESSON_SOURCES.has(evidence.source || '') && !outOfScope
    && !(lang === 'en' && ARABIC.test(evidence.answer)) ? evidence : undefined;
  if (lesson?.answer) {
    for (const tool of GAP_TOOLS) await runOne({ tool, args: { reason: brain.gapReason || 'near_miss' } });
    const recorded = observations.some((o) => o.tool === 'study_later' && (o.data as { recorded?: boolean } | undefined)?.recorded);
    return finish({
      answer: `${NEAR_MISS[lang]}${lesson.answer}`, source: lesson.source || 'library', ok: true, ai: false,
      used: [lesson], confidence: 'low', recorded, ...(recorded ? { studying: true } : {}),
    });
  }

  // (هـ) أقوى ملاحظة صلبة من الأدوات نفسها (ملجأ، وسيلة، مصدر مفتوح — حاجة مش درس).
  if (evidence?.answer && evidence.strength >= EVIDENCE_FLOOR && !outOfScope) {
    return finish({ answer: evidence.answer, source: evidence.source || 'science', ok: true, ai: false, used: [evidence], confidence: 'medium' });
  }

  // (د2) كارت مادة في مقارنة العقل ماكملهاش: طرف واحد بمصدره أحسن من لا شيء.
  if (precise?.answer) return finish({ answer: precise.answer, source: precise.source || 'material', ok: true, ai: false, used: [precise], confidence: 'medium' });

  // (هـ2) «consult» المجرب: الملجأ ← الذاكرة ← المكتبة ← فجوة (نفس رد المجلس من غير إنترنت).
  const solid = local.source !== 'gap'
    ? { answer: local.answer, source: (local.source === 'refuge' ? 'refuge' : local.source === 'memory' ? 'memory' : 'library') as AnswerSource, ok: true }
    : undefined;
  if (solid && !outOfScope) return finish({ answer: solid.answer, source: solid.source, ok: true, ai: false, confidence: 'medium' });

  // (و) ملاحظة أضعف (وسيلة، مصدر مفتوح) أحسن من لا شيء — بمصدرها.
  if (evidence?.answer && !outOfScope) {
    return finish({ answer: evidence.answer, source: evidence.source || 'library', ok: true, ai: false, used: [evidence], confidence: 'low' });
  }

  // (ز) تسليم صريح (سؤال تركيبات أو طلب) أولى من فجوة: النص + زر التسليم لصاحبه.
  const handOver = observations.find((o) => o.tool === 'hand_over' && o.answer);
  if (handOver?.answer) return finish({ answer: handOver.answer, source: 'agent', ok: true, ai: false, used: [handOver] });

  // (ح) توضيح: سؤال غامض يتسأل عنه الزائر أحسن من رد مبني على التخمين.
  const clarify = observations.find((o) => o.tool === 'clarify' && o.answer);
  if (clarify?.answer) return finish({ answer: clarify.answer, source: 'agent', ok: false, ai: false, used: [clarify], clarify: true });

  // (ط) الزائر اختار متخصص بنفسه والسؤال من مجال غيره: مايردش من مجال تاني ولا يوعده بمذاكرة
  //     حاجة مش عنده — يقوله بصراحة ويحوّله لصاحبه في المجلس بزر.
  if (input.specialistId) {
    await runOne({ tool: 'route_specialist', args: { question: asked } });
    const home = observations.find((o) => o.tool === 'route_specialist' && (o.data as { specialist?: string } | undefined)?.specialist);
    const target = home && specialistOf((home.data as { specialist: string }).specialist as SpecialistId);
    if (home && target) {
      return finish({
        answer: lang === 'en'
          ? `That question belongs to ${target.nameEn}. I am ${specialist.nameEn} — my field is ${specialist.fieldEn}, so I will not answer it from another field. Switch to them with the button below and they will answer from their own archive.`
          : `سؤالك ده من مجال «${target.nameAr}» (${target.fieldAr}) — وأنا ${specialist.nameAr} (${specialist.fieldAr})، فماهردش عليه من مجال غيري ولا هقولك كلام مش من مصدر. حوّل له من الزر اللي تحت الرد، وهو يرد عليك من أرشيفه هو.`,
        source: 'agent', ok: false, ai: false, used: [home],
      });
    }
  }

  // 6) فجوة صريحة: مفيش تخمين، والسؤال يتسجل لمدرسة شاهين يذاكره.
  const gapReason = outOfScope ? 'out_of_scope' : brain.gapReason || (aiOn ? 'engine_no_ground' : 'no_engine');
  for (const tool of GAP_TOOLS) await runOne({ tool, args: { reason: gapReason } });
  const recorded = observations.some((o) => o.tool === 'study_later' && (o.data as { recorded?: boolean } | undefined)?.recorded);
  return finish({
    answer: outOfScope ? `${OUT_OF_SCOPE_NOTE[lang]}${local.answer}` : local.answer,
    source: 'gap', ok: false, ai: false, recorded, ...(recorded ? { studying: true } : {}), confidence: 'low', used: [],
  });
}
