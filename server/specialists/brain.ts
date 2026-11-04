/**
 * «العقل المدرَّب» بتاع مجلس المتخصصين — the board's trained brain.
 *
 * الوكيل مش بيستنى محرك عشان يفهم السؤال أو يجيب الإجابة الصح: العقل ده بيشتغل **من غير أي ذكاء
 * اصطناعي** وبيعمل خمس حاجات بالترتيب، وكل واحدة منها متدرّبة ومختبرة في `tests/specialistsTraining.test.ts`:
 *
 *   1) **يفهم السؤال**: غلطات الكتابة (حرف ناقص/زيادة، كلمتين لازقين)، العربي المتكتب بكيبورد
 *      إنجليزي، المتابعة القصيرة («طيب ولو 100 مل؟») بترجع لموضوع السؤال اللي قبلها، نوع السؤال
 *      (تعريف/شرح/طريقة/سبب/مقارنة/قائمة)، موضوعاته الأساسية، وهل هو مقارنة بين طرفين.
 *   2) **يوجّهه لمتخصصه**: كلمات المتخصصين + مجال السؤال من علوم المدرسة + استشاريّو القسم اللي
 *      الزائر واقف فيه — مش أول متخصص ييجي في البال.
 *   3) **يجيب السؤال المقصود من الأرشيف**: دروس الخبير المراجَعة **في نطاق المتخصص بس (L-32)**،
 *      مكتبة شاهين وموسوعة المواد الخام، والإجابات المحفوظة في ذاكرته — كل مصدر بدرجة ثقة
 *      وحد أدنى للمطابقة (TRUST/BAR في src/utils/shaheenAgent.ts)، والأقرب×الأوثق هو اللي يتقدّم.
 *   4) **يتأكد إنها الإجابة الصح**: «مين» محتاجة اسم شخص، «كام» محتاجة رقم، «ليه» محتاجة سبب،
 *      و«ازاي» محتاجة خطوات — وأي مصدر بره موضوع السؤال (coverage < 0.5) يتحط على جنب
 *      (src/utils/shaheenReasoning.ts). ولو مفيش مصدر بيجاوب النوع المطلوب: الثقة تنزل درجة.
 *   5) **يعرض الرد بذكاء**: سطر خلاصة في الأول، المصدر التاني اللي بيزوّد معلومة، حدود المجال
 *      الطبي/البيطري، وسطر المصدر — ولو مفيش حاجة صلبة يقول بصراحة ويحوّل السؤال لخبير المجال
 *      في المدرسة يذاكره (مافيش تخمين أبداً).
 *
 * كل ده موجود ومتجرّب في `src/utils/shaheenAgent.ts` (مخ شاهين)، فالمجلس بيستعمله **زي ما هو**
 * بدل ما يخترع نسخة أضعف منه — الفرق الوحيد إن العلوم اللي بيقراها مقصورة على نطاق المتخصص،
 * وإن الرد بيتلف بعرض المجلس (server/specialists/present.ts).
 */
import { SCIENCE_LESSONS, type ScienceLesson, type ScienceTrackId } from '../../src/data/sciences';
import { RAW_MATERIALS_DATABASE } from '../../src/data/rawMaterials';
import { refugeDirectory } from '../../src/utils/shaheenRefuge';
import {
  agentLexicon, expertGapReason, runAgent, scienceIndexFor, understand, SCHOOL_EXPERTS,
  type AgentSources, type AgentUnderstanding, type Confidence, type FieldId, type SourceKind,
} from '../../src/utils/shaheenAgent';
import { buildLexicon, SCENT_WORDS, understoodNote, understandQuestion, type Lexicon, type SpellingFix } from '../../src/utils/shaheenSpelling';
import { meaningWords } from '../../src/utils/shaheenMemory';
import { scienceHits } from '../../src/utils/scienceIndex';
import { topicWords, type LibraryLesson, type LibraryMaterial } from '../../src/utils/shaheenLibrary';
import { normalizeQuestion, type MemoryFile } from '../../src/utils/shaheenMemory';
import {
  matchScore, pickSpecialist, SITE_SECTIONS, SPECIALISTS, type Specialist,
} from '../../src/utils/shaheenSpecialists';
import type { Research } from '../../src/utils/webResearch';
import { lessonsInScope, materialsInScope, ownsField, SCIENCE_TO_TRACKS, type AnswerSource } from './tools';

export { ownsField };

/** مصدر الرد في المجلس مقابل مصدر العقل: نفس المعنى باسم المجلس (بيتعرض للزائر). */
export const BRAIN_SOURCE: Record<SourceKind, AnswerSource> = {
  expert: 'science', lesson: 'library', material: 'material', memory: 'memory', research: 'research', reasoning: 'agent',
};

/* ── 1. النطاق (L-32): علوم المتخصص هو بس ─────────────────────────────────────────────────────── */
const scopedScience = new Map<string, ScienceLesson[]>();

/** دروس علوم المدرسة اللي يملكها المتخصص ده — نفس المصفوفة كل مرة عشان الفهرس يتخزن (WeakMap). */
export function scienceForSpecialist(specialist: Specialist): ScienceLesson[] {
  const cached = scopedScience.get(specialist.id);
  if (cached) return cached;
  const own = SCIENCE_LESSONS.filter((l) => (SCIENCE_TO_TRACKS[l.track as ScienceTrackId] || []).some((t) => specialist.tracks.includes(t)));
  scopedScience.set(specialist.id, own);
  return own;
}



/* ── 1ب. قاموس المجلس: الكلمات اللي يعرفها قبل ما «يصحّح» أي كلمة ───────────────────────────── */
/**
 * كلام الزوار اليومي اللي مش في قائمة كلمات المنصة المبنية. من غيره «التصحيح» بيقلب كلمة صح
 * لكلمة تانية («عندكم» ← «عندك»، «واحد» ← «واحده») — والوكيل بيقول للزائر إنه فهم غلط.
 */
const VISITOR_WORDS = [
  // ضمائر وظروف يومية
  'عندكم', 'عندكو', 'عندنا', 'عندك', 'عندي', 'معاكم', 'معانا', 'بتاعكم', 'بتاعنا', 'بتاعتي',
  'حضرتك', 'ياريت', 'ممكن', 'ينفع', 'عايز', 'عايزه', 'محتاج', 'محتاجه', 'لو سمحت', 'كده', 'كمان',
  'دلوقتي', 'النهارده', 'بكرة', 'بكره', 'امبارح', 'اول', 'اخر', 'برضه', 'خالص', 'بس',
  // أعداد وأسئلة
  'واحد', 'واحده', 'واحدة', 'اتنين', 'تلاتة', 'وايه', 'ايه', 'ازاي', 'ليه', 'كام', 'طيب', 'بكام',
  'حاجة', 'حاجات', 'اقدر', 'اعرف', 'تعرف', 'يعرف', 'اعمل', 'تعمل', 'اعرفها', 'عشان',
  // كلمات الزوار عن الطلب والسعر والتوصيل والدراسة
  'سعر', 'اسعار', 'توقع', 'توقعك', 'توقعات', 'جنيه', 'دولار', 'خصم', 'عروض', 'كوبون', 'فاتورة',
  'تفصيل', 'تفاصيل', 'بالتفصيل', 'تسليم', 'استلام', 'مجال', 'مجالات', 'دراسة', 'ادرس', 'أدرس',
  'انجح', 'أنجح', 'نجاح', 'اتعلم', 'أتعلم', 'كورس', 'كورسات',
  'شحن', 'شحنة', 'توصيل', 'عنوان', 'القاهرة', 'الجيزة', 'اسكندرية', 'مصر', 'مصري', 'تليفون',
  'موبايل', 'واتس', 'دفع', 'كارت', 'فيزا', 'ضمان', 'استرجاع', 'مقاس', 'الوان', 'هدية', 'تغليف',
  // كلمات بيتكلم بيها الزائر عن المعرفة نفسها
  'حلال', 'حرام', 'تقرير', 'تقارير', 'مدرسة', 'مدارس', 'فوائد', 'فايدة', 'نصيحة', 'نصايح',
  'طريقة', 'طرق', 'خطوات', 'مقادير', 'وصفة', 'وصفات', 'مكونات', 'معلومة', 'معلومات',
  'تجربة', 'تجارب', 'مشكلة', 'مشاكل', 'سؤال', 'اسئلة', 'اجابة', 'اجابات', 'شرح', 'ملخص',
];

/**
 * نصوص المنصة نفسها — كل كلمة مكتوبة في الموقع (الملجأ، الأقسام، المتخصصون، أسئلة دروس المدرسة،
 * أسماء المواد) كلمة صحيحة، فماينفعش «تصحيح» يقلبها لكلمة تانية («تقرير» ← «تقطير»).
 * إجابات الدروس **مش** هنا: فيها كلام عامي («فوايد»، «بيعرف») وده بيقلب الكلمة الفصحى الصح.
 */
function platformTexts(): string[] {
  return [
    refugeDirectory('ar'),
    ...SITE_SECTIONS.map((x) => x.titleAr),
    ...SPECIALISTS.flatMap((x) => [x.nameAr, x.fieldAr, x.sciencesAr, ...(x.keywords || [])]),
    ...SCIENCE_LESSONS.flatMap((l) => [l.questionAr, l.titleAr, ...(l.keywords || [])]),
    ...RAW_MATERIALS_DATABASE.flatMap((m) => [m.nameAr, m.nameEn]),
  ];
}

/** ضمّ قاموس على قاموس (كلمات التاني بتتزود على الأول) — من غير ما نلمس قاموس المنصة نفسه. */
function mergeLexicon(base: Lexicon, more: Lexicon): Lexicon {
  const words = new Map(base.words);
  const byLength = new Map(base.byLength);
  for (const [key, weight] of more.words) {
    const had = words.get(key);
    words.set(key, (had || 0) + weight);
    if (had === undefined) {
      const list = byLength.get(key.length) || [];
      list.push(key);
      byLength.set(key.length, list);
    }
  }
  return { words, byLength };
}

let boardLex: Lexicon | undefined;
/**
 * قاموس المجلس = قاموس المنصة (كلمات العطور ومجالات الخبراء وعناوين الدروس) + **نصوص دروس علوم
 * المدرسة كلها** (أسئلتها وإجاباتها) + كلام الزوار اليومي. النتيجة: الكلمة اللي الزائر كاتبها صح
 * ماتتصححش، والغالية الإملائية الحقيقية بس هي اللي تتقرا وتترد للزائر («✍️ فهمت سؤالك كده»).
 */
export function boardLexicon(): Lexicon {
  return boardLex ??= mergeLexicon(
    agentLexicon(),
    buildLexicon({ materials: RAW_MATERIALS_DATABASE, extra: [...platformTexts(), ...VISITOR_WORDS] }),
  );
}

/**
 * كلمات المجال: العطور والعلوم والمواد — كلمات الموقع نفسها. التصحيح اللي بيبدّل حرف بحرف
 * («تفصيل» ← «توصيل») مايقبلش إلا لو الكلمة الجديدة من دول، لأن الاتنين عادةً كلمات صح ومعنى
 * مختلف، وأغلب غلطات الزوار الحقيقية بتحصل في أسماء المواد والمصطلحات.
 */
const DOMAIN_WORDS = new Set<string>([
  ...SCENT_WORDS,
  ...SCHOOL_EXPERTS.flatMap((e) => e.words),
  ...SCIENCE_LESSONS.flatMap((l) => l.keywords || []),
  ...RAW_MATERIALS_DATABASE.flatMap((m) => meaningWords(`${m.nameAr} ${m.nameEn}`)),
].map((w) => normalizeQuestion(w)));
const isDomainWord = (word: string) => DOMAIN_WORDS.has(normalizeQuestion(word));

/**
 * أسماء المواد الخام في موسوعة شام (الاسم نفسه من غير شرحه). الأسماء دي بالذات هي اللي الزوار
 * بيغلطوا في كتابتها، فلو «التصحيح» وصّل الكلمة لواحدة منها يبقى غلطة كتابة حقيقية تستاهل نردها
 * للزائر («الجلاكسوليد» ← «الجالاكسوليد») حتى لو الفرق كان حرف علة.
 */
const ENTITY_WORDS = new Set<string>(
  RAW_MATERIALS_DATABASE
    .flatMap((m) => [m.nameAr, m.nameEn])
    .flatMap((name) => String(name || '').split(/[(|\u2014\u2013-]/u)[0].trim().split(/\s+/u))
    .map((w) => normalizeQuestion(w))
    .filter((w) => w.length >= 4),
);
/** الكلمة (أو شكلها من غير «ال» ولواحقها) اسم من أسماء مواد الموقع؟ */
const isEntityWord = (word: string) => {
  const w = normalizeQuestion(word);
  return ENTITY_WORDS.has(w) || ENTITY_WORDS.has(stripAffix(word));
};

/* ── 1ج. قراءة السؤال: التصحيح اللي نعترف به للزائر ──────────────────────────────────────────── */
const PROCLITIC = /^(?:و|ف|ب|ك|ل|ال|لل|وال|بال|فال|كال)/u;
const ENCLITIC = /(?:ات|ين|ون|ان|كم|كن|ك|نا|ها|ه|ي|ت|تم|وا)$/u;
const stripAffix = (word: string) => normalizeQuestion(word).replace(PROCLITIC, '').replace(ENCLITIC, '');

/**
 * «بمكونات» ← «مكونات»، «أشتري» ← «اشتريت»: نفس الكلمة بحرف زائد في الأول أو الآخر. الاتنين
 * صح، فمافيش «تصحيح» — ولو قلناه للزائر يبقى بنقوله إن كلامه كان غلط وهو مش غلط.
 */
export const sameWordAffix = (from: string, to: string): boolean => {
  const a = normalizeQuestion(from); const b = normalizeQuestion(to);
  if (a === b) return true;
  const sa = stripAffix(a); const sb = stripAffix(b);
  return sa === b || a === sb || sa === sb;
};

/** حروف بتتزاد أو تتغير بين صيغ الكلمة الواحدة (حروف علة ولواحق) — من غير ما الجذر يتغير. */
const STEM_NOISE = /[اويىئة]/gu;
/** حروف بتزيد في أول الجذر بين صيغ الكلمة الواحدة (تصغير/صغير، يستثمر/استثمر). */
const DERIVATION = /^[تسمناي]/u;
/** جذر الكلمة من غير لواحقها ومن غير حروف العلة — اللي بيفضل ثابت بين صيغها. */
const skeleton = (word: string) => stripAffix(word).replace(STEM_NOISE, '');

/**
 * «استثمر» ← «استثمار»، «العطور» ← «عطر»: نفس الجذر بصيغة تانية. الاتنين كلام صح، فمافيش «تصحيح»
 * نقوله للزائر — إلا لو الكلمة الجديدة اسم من أسماء مواد الموقع (أسماء بتتكتب غلط كتير).
 * والغلط الإملائي الحقيقي بيغيّر حرف أصلي في الجذر («تعتبق» ← «تعتيق») فبيفضل يتصلّح.
 */
export const sameWordStem = (from: string, to: string): boolean => {
  const a = skeleton(from); const b = skeleton(to);
  if (a.length < 2 || b.length < 2) return false;
  if (a === b) return true;
  const long = a.length > b.length ? a : b;
  const short = a.length > b.length ? b : a;
  // صيغة من نفس الجذر بحرف زيادة في أوله («صغير» ← «تصغير»): الاتنين كلام صح، فمافيش تصحيح.
  return long.length - short.length <= 2 && long.endsWith(short) && DERIVATION.test(long.slice(0, long.length - short.length));
};

export interface Reading { asked: string; note: string; fixes: SpellingFix[]; keyboard: boolean }

/**
 * السؤال كما يقراه المجلس — وقراءتين مش قراءة واحدة:
 *   · `asked`: النص اللي بيدور في الأرشيف. كل تصحيحات القاموس اللي ما بتقلبش معنى السؤال بتتطبق
 *     عليه، لأن الكلمة الصح بتتفهم أحسن في البحث («لعلامة» ← «علامه» بتخلي الكلمة معروفة للقاموس).
 *   · `note`: اللي نقوله للزائر («✍️ فهمت سؤالك كده: …») — عن **التصحيحات الآمنة بس**، لأن ماينفعش
 *     نقول للزائر إن كلامه غلط وهو صح:
 *       - نفس الكلمة بحرف زائد في الأول أو الآخر (بمكونات/مكونات) → مايتعرضش؛
 *       - نفس الجذر بصيغة تانية (استثمر/استثمار) → مايتعرضش، إلا لو وصّل الكلمة لاسم مادة من
 *         موسوعة الموقع (الجلاكسوليد/الجالاكسوليد) فدي غلطة كتابة حقيقية تستاهل الرد؛
 *       - حرف متبدل في نفس الطول (بالتفصيل/توصيل) → مايتعرضش إلا لو الكلمة الجديدة من كلمات المجال،
 *         لأن أغلب غلطات الزوار الحقيقية في أسماء المواد والمصطلحات.
 * الكيبورد الإنجليزي بيتحول كله.
 */
/**
 * التصحيح اللي ما بيقلبش معنى السؤال: الاستبدال اللي بيحوّل كلمة صح لكلمة صح تانية من غير ما تكون
 * من كلمات المجال («بالتفصيل» ← «توصيل») مرفوض — بيغيّر نوع السؤال نفسه (سؤال عن التفاصيل يبقى طلب
 * توصيل). أما صيغ الكلمة الواحدة (أشتري/اشتريت) فبتفضل في نص البحث لأنها بتساعد القاموس يفهم الكلمة.
 */
/** نفس الطول بحرف متبدل — تصحيح خطر (كل واحدة من الاتنين كلمة صح ومعنى مختلف). */
const substitutionOnly = (from: string, to: string) => {
  const a = normalizeQuestion(from); const b = normalizeQuestion(to);
  return a.length === b.length && a !== b;
};

/**
 * التصحيح اللي يتطبق على نص البحث: كل تصحيح مايقلبش نوع السؤال. الاستبدال في نفس الطول
 * لكلمة مش من كلمات المجال مرفوض («بالتفصيل» ← «توصيل» بيحوّل السؤال لطلب توصيل)،
 * أما صيغ الكلمة الواحدة فبتفضل في نص البحث لأنها بتخلي الكلمة معروفة للقاموس («لعلامة» ← «علامه»).
 */
const searchable = (f: SpellingFix) => !substitutionOnly(f.from, f.to) || isDomainWord(f.to);

/**
 * التصحيح اللي **نقوله للزائر**: كلمة من كلمات الموقع (مصطلح عطر أو علم أو اسم مادة) وصلت لشكلها
 * الصح. غلطات الزوار الحقيقية في الموقع ده بتحصل في الأسماء والمصطلحات دي بالذات؛ أما تبديل كلمة
 * يومية صح بكلمة يومية تانية («صغير» ← «تصغير») فمش تصحيح، وقوله للزائر معناه إننا
 * بنصحح كلام صح.
 */
const announceable = (f: SpellingFix) => searchable(f) && !sameWordAffix(f.from, f.to)
  && (!sameWordStem(f.from, f.to) || isEntityWord(f.to))
  && (isDomainWord(f.to) || isEntityWord(f.to));

export function readQuestion(question: string, lang: string): Reading {
  const u = understandQuestion(question, boardLexicon());
  const fixes = u.fixes.filter(announceable);
  const apply = (list: SpellingFix[]) => {
    let out = u.keyboard && !list.length ? u.text : question;
    for (const f of list) if (out.includes(f.from)) out = out.replace(f.from, f.to);
    return out;
  };
  const asked = apply(u.fixes.filter(searchable)).trim();   // للبحث في الأرشيف
  const shown = apply(fixes).trim();                        // اللي بيتعرض للزائر
  const changed = shown !== question.trim();
  return {
    asked: asked || question.trim(),
    note: changed || u.keyboard ? understoodNote(lang, { text: shown, changed: true, keyboard: u.keyboard, fixes }) : '',
    fixes, keyboard: u.keyboard,
  };
}

/* ── 2. فهم السؤال ────────────────────────────────────────────────────────────────────────────── */
const FOLLOW_UP_AR = /^(?:طيب|طب|ولو|و|ثم|بعدين|بعدها|كمل|كمّل|أكمل|اكمل|تاني|ثاني|كمان|أيضاً|ايضا|غير كده|نفسه|برضه|زياده|زيادة|ناقص)/u;
const FOLLOW_UP_EN = /^(?:and|also|so|then|what about|how about|the other|another|more|less|ok(?:ay)?(?:,| so)?|same)\b/i;
/** أدوات استفهام بس — سؤال منها لوحده («كام؟»، «ليه؟») مافيهوش موضوع، فيكمل على اللي قبله. */
const QUESTION_ONLY = new Set(['ايه', 'ما', 'ماهي', 'ماهو', 'ليه', 'لماذا', 'ازاي', 'كيف', 'كام', 'كم', 'اد', 'ادي', 'امتى', 'متى', 'فين', 'اين', 'who', 'what', 'why', 'how', 'when', 'where', 'which', 'and', 'so', 'ok', 'yes', 'no']);

/** متابعة بالأرقام («ولو 100 مل؟»، «و45 يوم؟»): قصيرة وفيها رقم وموضوعها في السؤال اللي قبلها. */
const NUMERIC_FOLLOW = /^\W{0,4}(?:[\d٠-٩]+(?:[.,\d٠-٩]*)\s*)+\S{0,20}$/u;

/**
 * السؤال كما يُفهم: المتابعة القصيرة بترجع لموضوع السؤال اللي قبلها («طيب ولو 100 مل؟» + سؤال
 * التركيز ← السؤال كامل)، والسؤال المستقل يفضل زي ما هو (مايلزقش بموضوع قديم بالغلط).
 */
export function resolveAsked(question: string, previous?: string): string {
  const q = (question || '').trim();
  const p = (previous || '').trim();
  if (!p || p === q) return q;
  if (FOLLOW_UP_AR.test(q) || FOLLOW_UP_EN.test(q) || NUMERIC_FOLLOW.test(normalizeQuestion(q).slice(0, 60))) {
    return `${q} ${p}`.trim().slice(0, 600);
  }
  // سؤال قصير **ومفيهوش موضوع من عنده** («والتاني؟»، «أوفى؟»، «كام؟») — يكمل على اللي قبله.
  // سؤال موضوعه واضح («ايه هو المسك؟») يفضل لوحده: لزقه بسؤال قديم بيرد على سؤال مااتسألش.
  const own = topicWords(q).filter((w) => !QUESTION_ONLY.has(w));
  return own.length === 0 && normalizeQuestion(q).length <= 24 ? `${q} ${p}`.trim().slice(0, 600) : q;
}

/* ── 2ب. أسئلة تكمل بيها: من نطاق المتخصص نفسه ───────────────────────────────────────────────── */
/**
 * أقرب دروس في **نطاق المتخصص** لسؤال الزائر (مش أي درس في المدرسة) — بتتحول لأسئلة جاهزة
 * للزائر يضغط عليها. المنهج مكتوب ومراجَع بالعربي، فالمتابعة العربية بس.
 */
export function relatedFollowUps(question: string, specialist: Specialist, lang: string, limit = 2): string[] {
  if (lang !== 'ar') return [];
  const lessons = scienceForSpecialist(specialist);
  if (!lessons.length) return [];
  const asked = normalizeQuestion(question);
  return scienceHits(scienceIndexFor(lessons), question, { limit: 5 })
    .filter((h) => h.relevance >= 0.3 && normalizeQuestion(h.lesson.questionAr || h.lesson.titleAr) !== asked)
    .slice(0, limit)
    .map((h) => (h.lesson.questionAr || `ايه هو ${h.lesson.titleAr}؟`).trim())
    .filter(Boolean);
}

/* ── 3. التوجيه: كل سؤال لمتخصصه ──────────────────────────────────────────────────────────────── */
export interface Routing {
  specialist: Specialist;
  /** السؤال بعد الفهم (تصحيح الغلطات + المتابعة). */
  asked: string;
  understanding: AgentUnderstanding;
  score: number;
  trace: string;
}

/** أقل نقطة تخلّي السؤال «ملوش مجال واضح» — وقتها يكمل على مجال السؤال اللي قبله في نفس الزيارة. */
export const CONTINUITY_BAR = 1;

/**
 * أطول كلمة متخصصة اتطابقت في السؤال — التعادل في النقاط يكسبه الأكثر تحديداً: «خطة تسويق لعلامة
 * عطور» تجارة (تسويق) مش عطور (عطور)، لأن التخصص في السؤال هو الفعل مش الموضوع.
 */
function longestKeyword(question: string, keywords: string[]): number {
  const q = normalizeQuestion(question);
  let longest = 0;
  for (const k of keywords) {
    const word = normalizeQuestion(k);
    if (word.length >= 3 && q.includes(word) && word.length > longest) longest = word.length;
  }
  return longest;
}

/** نقاط كل متخصص في سؤال: كلماته + مجالات السؤال (النطاق الرسمي، L-32) + استشاريّو القسم. */
function scoreBoard(asked: string, understanding: AgentUnderstanding, sectionId?: string): { specialist?: Specialist; score: number } {
  const section = sectionId ? SITE_SECTIONS.find((s) => s.id === sectionId) : undefined;
  let best: Specialist | undefined;
  let bestScore = 0;
  let bestWord = 0;
  for (const s of SPECIALISTS) {
    const keywords = matchScore(asked, s.keywords);
    // مجال العطور هو موضوع الموقع نفسه (أي سؤال فيه «عطر»): مايديش أفضلية لحد. التخصص بيبان من
    // كلمة المتخصص ومن مجال العلوم — «خطة تسويق لعلامة عطور» تجارة، مش عطور.
    const fields = understanding.fields.reduce((sum, f) => sum + (f.field !== 'perfume' && ownsField(s, f.field) ? f.score * 1.5 : 0), 0);
    const consultants = section?.consultants.includes(s.id) ? (section.consultants[0] === s.id ? 2 : 1) : 0;
    const score = keywords + fields + consultants;
    const word = longestKeyword(asked, s.keywords);
    // التعادل (بنفس النقاط لحد جزء من الألف) يكسبه صاحب أطول كلمة متخصصة — الأكثر تحديداً للسؤال.
    if (score > bestScore + 1e-9 || (Math.abs(score - bestScore) <= 1e-9 && score > 0 && word > bestWord)) { best = s; bestScore = score; bestWord = word; }
  }
  return { ...(best ? { specialist: best } : {}), score: bestScore };
}

export function routeQuestion(question: string, opts: { lang?: string; section?: string; previous?: string } = {}): Routing {
  const lang = opts.lang === 'en' ? 'en' : 'ar';
  const read = readQuestion(resolveAsked(question, opts.previous), lang);
  const asked = read.asked;
  // نوع السؤال ومجالاته وموضوعاته من مخ شاهين — بس سطر «فهمت سؤالك» هو قراءة المجلس هو.
  const understanding: AgentUnderstanding = { ...understand(asked, lang, boardLexicon()), note: read.note };
  const own = scoreBoard(asked, understanding, opts.section);
  let specialist = own.specialist;
  let score = own.score;
  let via = '';
  // «ايه المواد اللي أدرسها علشان أنجح في المجال ده؟» — مافيهاش ولا كلمة متخصصة ولا مجال. الزيارة
  // الواحدة موضوع واحد لحد ما الزائر يغيره: فالسؤال ده يكمل على مجال السؤال اللي قبله (تجارة مثلاً)
  // بدل ما يقع على أول متخصص ويقوله كلام من مجال تاني.
  if (opts.previous && score < CONTINUITY_BAR) {
    const prevRead = readQuestion(opts.previous, lang);
    const prev = scoreBoard(prevRead.asked, understand(prevRead.asked, lang, boardLexicon()), opts.section);
    if (prev.specialist && prev.score > score) {
      specialist = prev.specialist; score = prev.score; via = ' · كمّل على مجال السؤال اللي قبله';
    }
  }
  const firstChoice = specialist || pickSpecialist(asked, opts.section);
  // سؤال فلوس الشحن والتجارة (شحن/جمارك + رقم أو «أغلى/أرخص/هامش») شغل متخصص التجارة — مش العلوم.
  // قبل كده سؤال «الشحن أغلى من اللي بنحصّله، أعمل إيه؟» كان بيروح لـ«د. هند العلوم» لمجرد «50%»،
  // والملاحظات بتتسجل فجوة والسؤال مالوش صاحب. الاختيار هنا بيحترم نطاق كل متخصص (L-32).
  // بنقرا السؤال الأصلي كمان: مصحّح الكتابة بيحوّل «وجهة» لـ«واجهة» (كلمة حقيقية اتقرت غلط)،
  // فالسؤال كان بيتحوّل للمتخصص التقني بدل التجارة.
  const raw = `${question} ${asked}`;
  const tradeMoney = /(شحن|توصيل|جمارك|تصدير|استيراد|لوجستيات|وجهة|وجهات|هامش|الهامش|هامشي)/i.test(raw) && /(هامش|مكسب|ربح|خسارة|خسران|صافي|بكام|كام|أغلى|ارخص|أرخص|تكلفة|سعر|%|دولار|جنيه|فاتورة)/i.test(raw);
  const business = tradeMoney && firstChoice.id !== 'specialist_business' ? SPECIALISTS.find((x) => x.id === 'specialist_business') : undefined;
  const chosen = business || firstChoice;
  const tradeNote = business ? ' · سؤال شحن/فلوس → متخصص التجارة' : '';
  const trace = `routed: ${chosen.id} (${score.toFixed(1)} = كلمات المتخصصين + مجالات السؤال${opts.section ? ' + استشاريّو القسم' : ''})${via}${tradeNote}${read.note ? ' · typos read back' : ''}`;
  return { specialist: chosen, asked, understanding, score, trace };
}

/* ── 4. الأرشيف والإجابة الصح ─────────────────────────────────────────────────────────────────── */
export interface BrainReply {
  /** الرد الجاهز — undefined معناه مفيش معلومة صلبة (الوكيل يقولها بصراحة ويسجّل السؤال). */
  answer?: string;
  source: AnswerSource;
  confidence: Confidence;
  used: SourceKind[];
  /** السؤال اتحوّل لخبير المجال في المدرسة يذاكره (مفيش إجابة صلبة، أو إجابة قديمة/متوسطة). */
  refer: boolean;
  /** محتاج الزائر يوضّح (سؤال غامض). */
  clarify: boolean;
  /** «فهمت سؤالك كده: …» — بتظهر للزائر فوق الرد. */
  note: string;
  /** أخبار وأسعار وتفاصيل شخصية: مش شغل المدرسة (مسارات تانية في الموقع بتجاوبها). */
  outOfScope: boolean;
  /** سبب الفجوة اللي تتسجل للمدرسة («expert:chemistry») عشان توصل للخبير الصح. */
  gapReason?: string;
  expertField?: FieldId;
  /** خطوات العقل — بتظهر في تقرير التدريب ولوحة الإدارة. */
  trace: string[];
}

export interface BrainInput {
  question: string;
  lang: 'ar' | 'en';
  specialist: Specialist;
  lessons: LibraryLesson[];
  materials: LibraryMaterial[];
  memory?: MemoryFile;
  research?: (question: string, lang: string) => Promise<Research | undefined>;
  /** الوكيل هيسجّل السؤال للمدرسة لو مفيش إجابة صلبة (السيرفر بيسجل، المتصفح لأ). */
  willRecord?: boolean;
}

/**
 * التحية في المجلس: بتقول للزائر مين اللي بيرد ومجاله، وإزاي يسأل — مش شخصية تانية من الشات.
 */
export function boardGreeting(specialist: Specialist, lang: string): string {
  return lang === 'en'
    ? `Hello — you are on the Sham specialists' board, talking to ${specialist.nameEn}.\n\nAsk me anything in my field (${specialist.fieldEn}) and every answer will tell you where it came from. If your question belongs to another specialist, I will say so and hand it over — no guessing.`
    : `أهلاً بيك في مجلس المتخصصين — أنا ${specialist.nameAr}، ${specialist.fieldAr}.\n\nاسألني أي سؤال في مجالي، وكل رد هيقولك مصدره. ولو سؤالك من مجال غيري هقولك بصراحة وأحوّله لصاحبه — مافيش تخمين.`;
}

/**
 * يسأل العقل المدرَّب: يفهم ← يجمع الأدلة من الأرشيف في نطاق المتخصص ← يتأكد إنها بتجاوب السؤال
 * المطلوب ← يعرض الرد بمصدره. من غير أي محرك ومن غير شبكة (إلا «باحث شاهين» لو متاح).
 */
export async function consultBrain(input: BrainInput): Promise<BrainReply> {
  const sources: AgentSources = {
    // نطاق المتخصص (L-32): دروس مجاله هو، وموسوعة المواد بس لو المواد من مجاله.
    lessons: lessonsInScope(input.lessons, input.specialist),
    materials: materialsInScope(input.specialist) ? input.materials : [],
    ...(input.memory ? { memory: input.memory } : {}),
    science: scienceForSpecialist(input.specialist),
  };
  const out = await runAgent(input.question, input.lang, {
    sources, lexicon: boardLexicon(),
    ...(input.research ? { research: input.research } : {}),
    ...(input.willRecord ? { willRecord: true } : {}),
  });
  const used = out.used;
  const field = out.expert?.field;
  // سطر «فهمت سؤالك» اللي كتبه مخ شاهين بيتشال: المجلس هو المسؤول عن القراءة اللي بيقولها للزائر.
  const read = readQuestion(input.question, input.lang);
  const body = (out.answer || '').replace(/^\s*✍️[^\n]*\n+/, '').trim();
  // تحية أو كلام صغير: المجلس يعرف الزائر بالمتخصص اللي بيرد مش بشخصية تانية.
  const smallTalk = out.trace.some((t) => t.startsWith('small talk')) && !out.clarify;
  const answer = smallTalk ? boardGreeting(input.specialist, input.lang) : body ? `${read.note}${body}` : undefined;
  return {
    ...(answer ? { answer } : {}),
    note: read.note,
    // مصدر الرد = مصدر أقوى دليل استُعمل. ولو الرد اتبنى من غير أرشيف (سلامة/مقدمة/خارج النطاق)
    // فالمصدر «وكيل المتخصصين» — مش «مكتبة» على الفاضي.
    source: used.length ? BRAIN_SOURCE[used[0]] : 'agent',
    confidence: out.confidence,
    used,
    refer: out.refer,
    clarify: Boolean(out.clarify),

    outOfScope: Boolean(out.understanding?.outOfScope),
    // مجال عام = مافيش خبير مجال في المدرسة يذاكره: الفجوة تتسجل باسم المتخصص من غير سبب علمي.
    ...(field && field !== 'general' ? { expertField: field, gapReason: expertGapReason(field) } : {}),
    trace: out.trace,
  };
}
