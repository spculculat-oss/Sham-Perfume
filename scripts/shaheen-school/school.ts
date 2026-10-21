/**
 * «مدرسة شاهين» — Shaheen trains himself to work without any AI service.
 *   1. Exam (no AI): a question bank about perfumery, the site's tools and the store; a question passes when
 *      Shaheen can answer it by himself — from his memory (works in the visitor's browser and on the server,
 *      with every engine down) or from his training library.
 *   2. Study (only while an AI engine is up, a few questions per run): each failed question is answered once
 *      by the expert engine, checked (no vendor names, no apologies, real text), and kept in his memory under
 *      the question and under other ways people ask it — so the next time he answers by himself.
 *   3. Report: the «self-reliance» score, its history, what he studied, what is left
 *      (src/data/live/shaheen-school.json, shown in the admin panel).
 * Pure helpers here; scripts/shaheen-school/run.mts does the I/O.
 */
import { isPersonal, isTimeBound, meaningWords, normalizeQuestion, recallSimilar, worthRemembering, type MemoryFile } from '../../src/utils/shaheenMemory';
import { materialCard, topicWords as libraryTopicWords, type LibraryMaterial } from '../../src/utils/shaheenLibrary';
import { spellingDrill, typoVariants, understandQuestion, wordKey, type Lexicon } from '../../src/utils/shaheenSpelling';
import { academyQuestions, TOOL_FIELDS, TRACKS, trackOf, type TrackId } from './curriculum';

export interface BankQuestion { q: string; lang: 'ar' | 'en'; topic: string; origin: 'curriculum' | 'library' | 'visitors' | 'council' }
export interface TrainingDoc { id: string; title: string; content: string; tags?: string[] }
/**
 * covered: Shaheen answers it by himself everywhere (his memory: the visitor's browser and the server alike).
 * lesson: a lesson of his own library answers it — he can learn it without any AI (see selfLesson).
 */
export interface ExamResult { question: BankQuestion; covered: boolean; score: number; lesson?: TrainingDoc }

export interface SchoolFile {
  version: 1;
  updatedAt: string;
  /** fromLibrary = not yet in memory but answerable from a library lesson (learned on the next run, no AI). */
  reliance: { score: number; covered: number; total: number; fromMemory: number; fromLibrary: number; byLang: Record<string, { covered: number; total: number }> };
  selfTaughtTotal?: number;
  importer?: { localShare: number; aiReadings: number; localReadings: number; skills?: { sites: number; trusted: number; readings: number } };
  studiedTotal: number;
  /** Of studiedTotal: lessons written by «المعلم المحلي» (the open model on the runner, no key). */
  localTaughtTotal?: number;
  /** ai = an AI service taught; local = the open model on the runner; self = only his own library. */
  history: { at: string; score: number; studied: number; mode: 'ai' | 'self' | 'local' }[];
  lastStudied: { q: string; lang: string; at: string; variants: number }[];
  pending: { q: string; lang: string; topic: string }[];
  /**
   * «فهم شاهين للغلطات»: typos of the words of his questions he understood back (drill), and the questions he still
   * answers by himself when their main word is mistyped (exam).
   */
  spelling?: { at: string; tried: number; understood: number; score: number; misses: string[]; questions: { tried: number; answered: number } };
  /** The new academy missions: self-reliance per track (languages, blocks & scheduling, software engineering,
   * graphics & design, web maintenance, AI tools). */
  tracks?: Record<string, { covered: number; total: number; score: number }>;
  /** Every AI tool, its field, and what the school will teach it next («طور كل أداة في مجالها»). */
  tools?: { at: string; items: { id: string; field: string; covered: number; total: number; score: number; focus: string }[] };
  /** The block programs the school built and scheduled (src/data/live/shaheen-blocks.json). */
  blocks?: { at: string; programs: number; scheduled: number; errors: number; nextRuns: { id: string; next: string | null }[] };
}

export const emptySchool = (): SchoolFile => ({
  version: 1, updatedAt: new Date(0).toISOString(),
  reliance: { score: 0, covered: 0, total: 0, fromMemory: 0, fromLibrary: 0, byLang: {} },
  studiedTotal: 0, history: [], lastStudied: [], pending: [],
});
export const isSchoolFile = (d: unknown): d is SchoolFile => Boolean(d && typeof d === 'object' && (d as SchoolFile).version === 1 && Array.isArray((d as SchoolFile).history));

/** Questions a perfume lover or a beginner perfumer asks (no prices/news/stock: those change and are never memorised). */
export const CURRICULUM: BankQuestion[] = [
  ...([
    ['basics', 'ايه الفرق بين او دو بارفان واو دو تواليت؟'], ['basics', 'يعني ايه تركيز العطر وايه انواعه؟'], ['basics', 'ايه هي مكونات العطر الاساسية؟'],
    ['pyramid', 'ايه هو الهرم العطري؟'], ['pyramid', 'يعني ايه النوتات العليا والقلب والقاعدة؟'], ['pyramid', 'ليه ريحة العطر بتتغير بعد ساعة من رشه؟'],
    ['families', 'ايه هي العائلات العطرية؟'], ['families', 'ايه الفرق بين العطر الشرقي والعطر الخشبي؟'], ['families', 'يعني ايه عطر فوجير؟'], ['families', 'ايه هو عطر الشيبر؟'],
    ['materials', 'ايه هو العود وليه غالي؟'], ['materials', 'ايه الفرق بين المسك الطبيعي والصناعي؟'], ['materials', 'ايه هو العنبر في العطور؟'], ['materials', 'ايه هو الامبروكسان؟'], ['materials', 'ايه هي الزيوت العطرية الطبيعية؟'], ['materials', 'ايه هو الفانيليا في العطور وبيدي ايه؟'],
    ['making', 'ازاي اعمل عطر في البيت خطوة بخطوة؟'], ['making', 'ايه نسبة الزيت للكحول في العطر؟'], ['making', 'ايه نوع الكحول المستخدم في العطور؟'], ['making', 'ليه العطر بيعكر بعد ما اخلطه؟'], ['making', 'ايه هي المثبتات في العطور؟'], ['making', 'ازاي احسب كمية الزيت لزجاجة 100 مل بتركيز 20%؟'],
    ['maceration', 'يعني ايه تعتيق العطر؟'], ['maceration', 'العطر محتاج يتعتق قد ايه؟'], ['maceration', 'ازاي افلتر العطر بعد التعتيق؟'],
    ['wearing', 'ازاي اخلي العطر يثبت اطول؟'], ['wearing', 'فين احط العطر على الجسم؟'], ['wearing', 'يعني ايه فوحان العطر؟'], ['wearing', 'ينفع ادمج عطرين مع بعض؟'], ['wearing', 'ليه مش بحس بريحة عطري بعد شوية؟'],
    ['choosing', 'ازاي اختار عطر مناسب للصيف؟'], ['choosing', 'ازاي اختار عطر مناسب للشتاء؟'], ['choosing', 'ازاي اختار عطر هدية لحد معرفش ذوقه؟'], ['choosing', 'ايه العطر المناسب للشغل؟'], ['choosing', 'ازاي اجرب العطر قبل ما اشتريه؟'],
    ['storage', 'ازاي احفظ العطر عشان ميبوظش؟'], ['storage', 'العطر بيخلص صلاحيته امتى؟'],
    ['safety', 'هل العطر ممكن يعمل حساسية للجلد؟'], ['safety', 'ايه هي معايير ايفرا للعطور؟'], ['safety', 'هل الميثانول ينفع في العطور؟'],
    ['site', 'ازاي استخدم حاسبة تركيب العطور في موقع شام؟'], ['site', 'ايه فايدة محاكي التعتيق في الموقع؟'], ['site', 'ازاي احفظ تركيبتي في دفتر التركيبات؟'], ['site', 'ازاي احسب تخفيف الكحول من 96 ل 80؟'],
  ] as const).map(([topic, q]) => ({ q, lang: 'ar' as const, topic, origin: 'curriculum' as const })),
  ...([
    ['basics', 'What is the difference between eau de parfum and eau de toilette?'], ['pyramid', 'What are top, heart and base notes?'], ['families', 'What are the main fragrance families?'],
    ['materials', 'What is oud and why is it expensive?'], ['materials', 'What is ambroxan in perfumes?'], ['making', 'How do I make perfume at home step by step?'], ['making', 'What alcohol is used to make perfume?'],
    ['maceration', 'How long should a perfume macerate?'], ['wearing', 'How can I make my perfume last longer?'], ['wearing', 'Where should I apply perfume?'],
    ['choosing', 'How do I choose a perfume for summer?'], ['choosing', 'How do I choose a perfume as a gift?'], ['storage', 'How should I store perfume?'], ['safety', 'Can perfume cause skin allergies?'],
    ['site', 'How do I use the Sham perfume formula calculator?'],
  ] as const).map(([topic, q]) => ({ q, lang: 'en' as const, topic, origin: 'curriculum' as const })),
];

/** The training library's lessons become questions too («حدثني عن …»). */
export function libraryQuestions(docs: TrainingDoc[], max = 40): BankQuestion[] {
  return docs.slice(0, max).map((d) => ({ q: `حدثني عن ${d.title.replace(/[؟?.!]+$/, '')}`, lang: 'ar' as const, topic: 'library', origin: 'library' as const }));
}

/** Questions the daily meeting («مجلس شاهين») asked him to study. */
export const councilQuestions = (qs: string[]): BankQuestion[] =>
  qs.map((q) => q.trim()).filter((q) => q.length >= 8 && q.length <= 200).slice(0, 12)
    .map((q) => ({ q, lang: /[\u0600-\u06FF]/.test(q) ? 'ar' as const : 'en' as const, topic: 'council', origin: 'council' as const }));

/**
 * Questions visitors asked while no engine answered (the server's knowledge gaps, reason «shaheen_offline»):
 * what people really want to know comes first. Personal, time-bound and shopping questions are not studied.
 */
export function visitorQuestions(gaps: { question?: unknown; status?: unknown; reason?: unknown; count?: unknown }[], max = 12): BankQuestion[] {
  return gaps
    .filter((g) => g && g.status === 'open' && g.reason === 'shaheen_offline' && typeof g.question === 'string')
    .sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0))
    .map((g) => String(g.question).trim())
    .filter((q) => q.length >= 8 && q.length <= 300 && !isPersonal(q) && !isTimeBound(q) && meaningWords(q).length >= 2)
    .slice(0, max)
    .map((q) => ({ q, lang: /[\u0600-\u06FF]/.test(q) ? 'ar' as const : 'en' as const, topic: 'visitors', origin: 'visitors' as const }));
}

/** The raw-materials encyclopaedia as lessons: «ايه هو الأمبروكسان؟» is learned from its card, with no AI. */
const shortName = (name: string) => name.replace(/\s*\(.*$/, '').replace(/\s*\/.*$/, '').trim();
export const materialDocs = (materials: LibraryMaterial[]): TrainingDoc[] =>
  materials.map((m) => ({ id: m.id, title: shortName(m.nameAr), content: materialCard(m, 'ar'), tags: ['material'] }));
export const materialQuestions = (materials: LibraryMaterial[]): BankQuestion[] =>
  materials.map((m) => ({ q: `ايه هو ${shortName(m.nameAr)}؟`, lang: 'ar' as const, topic: 'materials', origin: 'library' as const }));

/**
 * The advanced curriculum the local teacher works through, a few lessons per session: perfume design for every
 * family and occasion, and the problems people really meet while making perfume. Grounded on his library.
 */
const FAMILIES = ['شرقي', 'خشبي', 'زهري', 'حمضي منعش', 'فوجير', 'جورماند حلو', 'عنبري', 'مسكي نظيف', 'عودي'];
const OCCASIONS = ['للصيف', 'للشتاء', 'للسهرات', 'للشغل اليومي'];
export const ADVANCED: BankQuestion[] = [
  ...FAMILIES.flatMap((family) => OCCASIONS.map((occasion) => ({ q: `اقترح تركيبة عطر ${family} ${occasion} بالنسب`, lang: 'ar' as const, topic: `design-${family}`, origin: 'curriculum' as const }))),
  ...([
    ['problems', 'العطر بتاعي ريحته كحول قوية اعمل ايه؟'], ['problems', 'ليه العطر اللي عملته ريحته اختفت بسرعة؟'], ['problems', 'العطر لونه اتغير بعد شهر هل باظ؟'],
    ['problems', 'ازاي اقلل حدة نوتة طاغية في التركيبة؟'], ['problems', 'العطر طلع تقيل وخانق ازاي اخففه؟'], ['problems', 'ليه العطر بيعمل حساسية لبعض الناس؟'],
    ['problems', 'العطر ريحته على الجلد غير في الزجاجة ليه؟'], ['problems', 'ازاي اعرف ان الزيت العطري مغشوش؟'],
    ['skills', 'ازاي ادرب انفي على تمييز الروايح؟'], ['skills', 'ازاي اوثق تجاربي في تركيب العطور؟'], ['skills', 'ازاي اختبر عطر جديد قبل ما اعمل منه كمية كبيرة؟'],
    ['skills', 'ايه الادوات اللي محتاجها عشان ابدأ اركب عطور؟'], ['skills', 'ازاي اوزن مكونات العطر بدقة؟'], ['skills', 'يعني ايه اكورد في العطور وازاي اعمله؟'],
    ['business', 'ازاي احسب تكلفة العطر اللي بعمله قبل ما ابيعه؟'], ['business', 'ايه اللي لازم يتكتب على ملصق زجاجة العطر؟'], ['business', 'ازاي احافظ على ثبات جودة العطر من دفعة للتانية؟'],
    ['culture', 'ايه تاريخ العطور عند العرب؟'], ['culture', 'ايه الفرق بين العطور الفرنسية والعطور العربية؟'], ['culture', 'ايه هو البخور وازاي بيتعمل؟'],
  ] as const).map(([topic, q]) => ({ q, lang: 'ar' as const, topic, origin: 'curriculum' as const })),
  ...([
    ['problems', 'Why does my homemade perfume smell too much of alcohol?'], ['problems', 'How can I make my perfume last longer on the skin?'],
    ['skills', 'What tools do I need to start making perfume at home?'], ['skills', 'What is an accord in perfumery?'],
    ['design', 'Suggest a fresh citrus perfume formula for summer with percentages'], ['design', 'Suggest a warm oriental perfume formula for winter with percentages'],
  ] as const).map(([topic, q]) => ({ q, lang: 'en' as const, topic: `${topic}-en`, origin: 'curriculum' as const })),
];

export function buildBank(docs: TrainingDoc[], council: string[] = [], visitors: BankQuestion[] = [], materials: LibraryMaterial[] = []): BankQuestion[] {
  const seen = new Set<string>();
  return [...visitors, ...CURRICULUM, ...libraryQuestions(docs), ...materialQuestions(materials), ...councilQuestions(council), ...ADVANCED, ...academyQuestions()].filter((b) => {
    const k = `${b.lang}|${normalizeQuestion(b.q)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Per-track self-reliance (the academy missions + the original perfume curriculum). */
export function trackStats(results: ExamResult[]): Record<string, { covered: number; total: number; score: number }> {
  const out: Record<string, { covered: number; total: number; score: number }> = {};
  for (const t of TRACKS) out[t.id] = { covered: 0, total: 0, score: 0 };
  for (const r of results) {
    const s = (out[trackOf(r.question.topic)] ||= { covered: 0, total: 0, score: 0 });
    s.total++;
    if (r.covered) s.covered++;
  }
  for (const s of Object.values(out)) s.score = s.total ? Math.round((s.covered / s.total) * 100) : 0;
  return out;
}

/** Every AI tool with the progress of its field — and the next question its field will study (the focus). */
export function toolStats(results: ExamResult[], at: string): NonNullable<SchoolFile['tools']> {
  const items = Object.entries(TOOL_FIELDS).map(([id, t]) => {
    const mine = results.filter((r) => r.question.topic === `tool-${id}`);
    const covered = mine.filter((r) => r.covered);
    const focus = mine.find((r) => !r.covered)?.question.q || 'مجاله مكتمل — يُراجع بالتقرير القادم';
    return {
      id, field: t.field,
      covered: covered.length, total: mine.length,
      score: mine.length ? Math.round((covered.length / mine.length) * 100) : 0,
      focus,
    };
  });
  return { at, items };
}

/** Words every perfume question shares: they never decide which lesson answers a question («العنبر في العطور» ≠ «تعتيق العطور»). */
const GENERIC = new Set(['عطر', 'عطور', 'عطري', 'برفان', 'بارفان', 'perfume', 'perfumes', 'fragrance', 'يعني', 'حدثني', 'اشرحلي', 'اشرح', 'معلومات', 'انواع', 'نوع', 'كل', 'شيء', 'حاجه']);
const topicWords = (t: string) => meaningWords(t).filter((w) => !GENERIC.has(w));
const topicMatch = (q: string, title: string) => {
  const x = topicWords(q); const y = topicWords(title);
  if (!x.length || !y.length) return 0;
  const ys = new Set(y);
  const shared = x.filter((w) => ys.has(w)).length;
  return shared ? (2 * shared) / (x.length + y.length) : 0;
};

/** The library lesson that answers a question, when one clearly does: its topic words, not just «العطور» (Arabic lessons for Arabic questions). */
export function lessonFor(b: BankQuestion, docs: TrainingDoc[]): TrainingDoc | undefined {
  if (b.lang !== 'ar') return undefined;
  let best: { d: TrainingDoc; s: number } | undefined;
  for (const d of docs) {
    const s = topicMatch(b.q, d.title);
    if (s >= 0.6 && (!best || s > best.s)) best = { d, s };
  }
  return best?.d;
}

/** Can Shaheen answer this by himself? From his memory (exact or close question); else, is there a lesson to learn from? */
export function examOne(b: BankQuestion, memory: MemoryFile, docs: TrainingDoc[]): ExamResult {
  const hit = recallSimilar(memory, b.q, b.lang);
  if (hit) return { question: b, covered: true, score: hit.score };
  return { question: b, covered: false, score: 0, lesson: lessonFor(b, docs) };
}

/**
 * Self-study without AI: the library lesson becomes the answer, kept under the question and the usual
 * ways of asking about the topic («ايه هو …», «اشرحلي …»). Null when the lesson is not a usable answer.
 */
export function selfLesson(r: ExamResult): { answer: string; paraphrases: string[] } | null {
  const d = r.lesson;
  if (!d) return null;
  const answer = d.content.trim();
  if (!worthRemembering(r.question.q, answer)) return null;
  const t = d.title.replace(/[؟?.!]+$/, '');
  const single = t.replace(/العطور/g, 'العطر');
  const paraphrases = [...new Set([`ايه هو ${t}`, `يعني ايه ${t}`, `اشرحلي ${t}`, `معلومات عن ${t}`, ...(single !== t ? [`يعني ايه ${single}`, `ايه هو ${single}`] : [])])]
    .filter((p) => normalizeQuestion(p) !== normalizeQuestion(r.question.q));
  return { answer, paraphrases };
}

export function exam(bank: BankQuestion[], memory: MemoryFile, docs: TrainingDoc[]) {
  const results = bank.map((b) => examOne(b, memory, docs));
  const covered = results.filter((r) => r.covered);
  const byLang: Record<string, { covered: number; total: number }> = {};
  for (const r of results) {
    const l = (byLang[r.question.lang] ||= { covered: 0, total: 0 });
    l.total++; if (r.covered) l.covered++;
  }
  return {
    results,
    reliance: {
      score: results.length ? Math.round((covered.length / results.length) * 100) : 0,
      covered: covered.length, total: results.length,
      fromMemory: covered.length,
      fromLibrary: results.filter((r) => !r.covered && r.lesson).length,
      byLang,
    },
  };
}

/** Next questions to study with an AI engine (no lesson of his own): topics with the most gaps first, so his knowledge grows evenly. */
export function pickStudy(results: ExamResult[], max: number): BankQuestion[] {
  const gaps = results.filter((r) => !r.covered && !r.lesson).map((r) => r.question);
  const perTopic = new Map<string, number>();
  for (const g of gaps) perTopic.set(g.topic, (perTopic.get(g.topic) || 0) + 1);
  const taken = new Map<string, number>();
  // Visitors' real questions first; then the topics with the most gaps.
  return [...gaps]
    .sort((a, b) => Number(b.origin === 'visitors') - Number(a.origin === 'visitors') || (perTopic.get(b.topic)! - perTopic.get(a.topic)!) || Number(a.origin === 'library') - Number(b.origin === 'library'))
    .filter((g) => { const n = taken.get(g.topic) || 0; if (n >= (g.origin === 'visitors' ? max : 2)) return false; taken.set(g.topic, n + 1); return true; })
    .slice(0, max);
}

export const STUDY_SYSTEM = `أنت «الخبير شاهين»، خبير العطور وصناعتها في موقع «شام». تدرس سؤالاً لتحفظ إجابته وتجيب به الزوار لاحقاً بدون مساعدة.
اكتب إجابة خبير دقيقة وعملية وواضحة لغير المتخصص، 80–220 كلمة، بلغة السؤال (المصرية المبسطة إن كان بالعربية العامية).
لا تذكر أي شركة أو تطبيق ذكاء اصطناعي، ولا أسعاراً أو أخباراً أو عروضاً أو مواعيد (تتغير)، ولا تعتذر.
ثم اكتب 4 صيغ أخرى يسأل بها الناس نفس السؤال (بنفس اللغة: عامية وفصحى وصيغة قصيرة).
أعد JSON فقط: {"answer":"…","paraphrases":["…","…","…","…"]}`;

/** For «المعلم المحلي»: a small open model writes clearer, safer Arabic in simple standard Arabic, close to the references. */
export const LOCAL_TEACHER_STYLE = `
تعليمات إضافية: اكتب الإجابة العربية بالعربية الفصحى المبسطة الواضحة (لا تكتب بالعامية)، بجمل قصيرة ونقاط عند الحاجة.
اعتمد على المراجع المرفقة، ولا تذكر معلومة أو نسبة لست متأكداً منها، ولا تكتب أي حروف غير عربية إلا أسماء المواد.`;

/**
 * «المراجع»: every lesson the local teacher writes is checked by a second, strict pass before it is kept —
 * wrong, unsafe or off-topic advice is thrown away (the question is studied again next time).
 */
export const REVIEW_SYSTEM = `أنت مراجع خبير في العطور وصناعتها وسلامتها، صارم جداً.
ستُعطى سؤالاً وإجابة مقترحة. ارفض الإجابة إذا كان فيها: معلومة خاطئة، نصيحة غير منطقية أو ضارة أو غير آمنة، كلام لا يجيب عن السؤال، أو تخمين بأرقام ونسب غير معقولة.
أجب بسطر واحد فقط: «OK» إن كانت صحيحة ومفيدة وآمنة، أو «REJECT: السبب باختصار».`;
export const reviewPrompt = (b: BankQuestion, answer: string) => `السؤال: ${b.q}\n\nالإجابة المقترحة:\n${answer}`;
/** The reviewer's verdict: kept only on a clear OK. */
export function parseReview(reply: string): { ok: boolean; reason: string } {
  const text = (reply || '').replace(/[*_`#>]/g, '').trim();
  if (/\bREJECT\b|مرفوض|ارفض/i.test(text)) return { ok: false, reason: text.replace(/^.*?REJECT\s*:?\s*/i, '').slice(0, 120) || 'rejected' };
  if (/^\s*(OK|موافق|مقبول|صحيح)\b/i.test(text)) return { ok: true, reason: '' };
  return { ok: false, reason: `unclear verdict (${text.slice(0, 40)})` };
}

/** The study question, with what his own library already says (the teacher must agree with it, not invent). */
export function studyPrompt(b: BankQuestion, references = ''): string {
  const q = `السؤال (${b.lang === 'ar' ? 'عربي' : 'English'}): ${b.q}`;
  return references ? `${q}\n\nمراجع من مكتبة شاهين (اعتمد عليها ولا تخالفها، ولا تنسخها حرفياً):\n${references}` : q;
}

/** Scripts a small open model sometimes slips into (Chinese, Japanese, Korean, Cyrillic): never kept. */
const FOREIGN_SCRIPT = /[\u0400-\u04FF\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/;

/** The engine's study answer, checked: a real answer worth remembering, and paraphrases in the same language. */
/** Small open models often break lines inside JSON strings: escape the control characters found inside strings. */
export function escapeControlsInStrings(text: string): string {
  let out = ''; let inString = false; let escaped = false;
  for (const ch of text) {
    if (inString) {
      if (escaped) { escaped = false; out += ch; continue; }
      if (ch === '\\') { escaped = true; out += ch; continue; }
      if (ch === '"') inString = false;
      else if (ch === '\n') { out += '\\n'; continue; }
      else if (ch === '\r') continue;
      else if (ch === '\t') { out += '\\t'; continue; }
    } else if (ch === '"') inString = true;
    out += ch;
  }
  return out;
}

/** Last resort for a small model's broken JSON: the answer text and the quoted wordings after «paraphrases». */
function looseStudy(raw: string): { answer?: unknown; paraphrases?: unknown } | undefined {
  const a = raw.match(/"answer"\s*:\s*"([\s\S]*?)"\s*(?:,?\s*"paraphrases"|\]?\s*}\s*$)/);
  if (!a) return undefined;
  const tail = raw.slice(raw.indexOf('"paraphrases"') >= 0 ? raw.indexOf('"paraphrases"') + 13 : raw.length);
  const paraphrases = [...tail.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
  return { answer: a[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'), paraphrases };
}

/** A study answer checked: the lesson to keep, or why it was not kept (for the report). */
export function studyCheck(reply: string, b: BankQuestion): { lesson: { answer: string; paraphrases: string[] } } | { reason: string } {
  const body = (reply || '').replace(/```(?:json)?/gi, '');
  let data: { answer?: unknown; paraphrases?: unknown } | undefined;
  const raw = body.slice(body.indexOf('{'), body.lastIndexOf('}') + 1);
  try { data = JSON.parse(raw); } catch {
    try { data = JSON.parse(escapeControlsInStrings(raw)); } catch { data = looseStudy(raw); }
  }
  if (!data) return { reason: `unreadable answer (${(reply || '').length} characters)` };
  const answer = typeof data.answer === 'string' ? data.answer.trim() : '';
  if (FOREIGN_SCRIPT.test(answer)) return { reason: 'slipped into another script (Chinese/Cyrillic…)' };
  if (!worthRemembering(b.q, answer)) return { reason: `not worth keeping (${answer.length} characters, or names a vendor)` };
  if (b.lang === 'ar' && !/[\u0600-\u06FF]/.test(answer)) return { reason: 'not in Arabic' };
  // An Arabic answer is mostly Arabic (a few Latin names like «EDP» or «Ambroxan» are fine).
  if (b.lang === 'ar' && (answer.match(/[A-Za-z]/g) || []).length > (answer.match(/[\u0600-\u06FF]/g) || []).length / 3) return { reason: 'too much Latin script for an Arabic answer' };
  const arabic = (t: string) => /[\u0600-\u06FF]/.test(t);
  const paraphrases = (Array.isArray(data.paraphrases) ? data.paraphrases : [])
    .filter((p): p is string => typeof p === 'string')
    .map((p) => p.trim())
    // A one-word «question» («العنبر») is too broad to answer from memory.
    .filter((p) => p.length >= 6 && p.length <= 200 && !FOREIGN_SCRIPT.test(p) && meaningWords(p).length >= 2 && (b.lang === 'ar' ? arabic(p) : !arabic(p)) && normalizeQuestion(p) !== normalizeQuestion(b.q))
    .slice(0, 4);
  return { lesson: { answer, paraphrases } };
}

export function parseStudy(reply: string, b: BankQuestion): { answer: string; paraphrases: string[] } | null {
  const checked = studyCheck(reply, b);
  return 'lesson' in checked ? checked.lesson : null;
}

/** How much of the importer's reading was done by Shaheen himself (JSON-LD, own reader, learned skills) vs AI. */
export function importerShare(review: unknown): SchoolFile['importer'] | undefined {
  const sources = ((review as { import?: { sources?: unknown[]; skills?: { sites: number; trusted: number; readings: number } } })?.import?.sources || []) as { via?: Record<string, number>; viaShaheen?: number }[];
  if (!sources.length) return undefined;
  let local = 0; let ai = 0;
  for (const s of sources) {
    for (const [k, v] of Object.entries(s.via || {})) { if (k === 'shaheen') ai += v; else local += v; }
    if (!s.via && s.viaShaheen) ai += s.viaShaheen;
  }
  const skills = (review as { import?: { skills?: { sites: number; trusted: number; readings: number } } })?.import?.skills;
  const total = local + ai;
  return { localShare: total ? Math.round((local / total) * 100) : 100, aiReadings: ai, localReadings: local, ...(skills ? { skills } : {}) };
}

/**
 * «فهم شاهين للغلطات» — the spelling exam: every question he answers by himself, asked again with its main word
 * mistyped (a letter dropped, or the article's «ل» swallowed) must still be answered by himself, through what he
 * understands it to mean.
 */
export function spellingExam(results: ExamResult[], memory: MemoryFile, docs: TrainingDoc[], lex: Lexicon, max = 60): { tried: number; answered: number; misses: string[] } {
  let tried = 0; let answered = 0; const misses: string[] = [];
  for (const r of results) {
    if (tried >= max) break;
    if (!r.covered || r.question.lang !== 'ar') continue;
    const words = r.question.q.split(/\s+/);
    const main = words.map((w, i) => ({ w, i, k: wordKey(w) })).filter((x) => x.k.length >= 5 && libraryTopicWords(x.w).length && lex.words.has(x.k))
      .sort((a, b) => b.k.length - a.k.length)[0];
    const typo = main && typoVariants(main.k).find((v) => v.kind === 'drop' && !lex.words.has(wordKey(v.text)));
    if (!main || !typo) continue;
    const prefix = main.w.match(/^(وال|بال|فال|كال|لل|ال)/)?.[1] || '';
    const q = words.map((w, i) => (i === main.i ? prefix + typo.text : w)).join(' ');
    tried++;
    const understood = understandQuestion(q, lex);
    if (examOne({ ...r.question, q: understood.text }, memory, docs).covered) answered++;
    else if (misses.length < 6) misses.push(`${q} → ${understood.text}`);
  }
  return { tried, answered, misses };
}

/** The drill and the exam together, as the school reports them. */
export function spellingReport(bank: BankQuestion[], results: ExamResult[], memory: MemoryFile, docs: TrainingDoc[], lex: Lexicon, at: string): NonNullable<SchoolFile['spelling']> {
  const drill = spellingDrill(lex, bank.filter((b) => b.lang === 'ar').flatMap((b) => libraryTopicWords(b.q)), 150);
  const questions = spellingExam(results, memory, docs, lex);
  return { at, ...drill, misses: [...drill.misses.slice(0, 4), ...questions.misses.slice(0, 4)], questions: { tried: questions.tried, answered: questions.answered } };
}
