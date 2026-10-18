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
import { meaningWords, normalizeQuestion, recallSimilar, worthRemembering, type MemoryFile } from '../../src/utils/shaheenMemory';

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
  history: { at: string; score: number; studied: number; mode: 'ai' | 'self' }[];
  lastStudied: { q: string; lang: string; at: string; variants: number }[];
  pending: { q: string; lang: string; topic: string }[];
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

export function buildBank(docs: TrainingDoc[], council: string[] = []): BankQuestion[] {
  const seen = new Set<string>();
  return [...CURRICULUM, ...libraryQuestions(docs), ...councilQuestions(council)].filter((b) => {
    const k = `${b.lang}|${normalizeQuestion(b.q)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
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
  return [...gaps]
    .sort((a, b) => (perTopic.get(b.topic)! - perTopic.get(a.topic)!) || Number(a.origin === 'library') - Number(b.origin === 'library'))
    .filter((g) => { const n = taken.get(g.topic) || 0; if (n >= 2) return false; taken.set(g.topic, n + 1); return true; })
    .slice(0, max);
}

export const STUDY_SYSTEM = `أنت «الخبير شاهين»، خبير العطور وصناعتها في موقع «شام». تدرس سؤالاً لتحفظ إجابته وتجيب به الزوار لاحقاً بدون مساعدة.
اكتب إجابة خبير دقيقة وعملية وواضحة لغير المتخصص، 80–220 كلمة، بلغة السؤال (المصرية المبسطة إن كان بالعربية العامية).
لا تذكر أي شركة أو تطبيق ذكاء اصطناعي، ولا أسعاراً أو أخباراً أو عروضاً أو مواعيد (تتغير)، ولا تعتذر.
ثم اكتب 4 صيغ أخرى يسأل بها الناس نفس السؤال (بنفس اللغة: عامية وفصحى وصيغة قصيرة).
أعد JSON فقط: {"answer":"…","paraphrases":["…","…","…","…"]}`;

/** The engine's study answer, checked: a real answer worth remembering, and paraphrases in the same language. */
export function parseStudy(reply: string, b: BankQuestion): { answer: string; paraphrases: string[] } | null {
  const body = (reply || '').replace(/```(?:json)?/gi, '');
  let data: { answer?: unknown; paraphrases?: unknown };
  try { data = JSON.parse(body.slice(body.indexOf('{'), body.lastIndexOf('}') + 1)); } catch { return null; }
  const answer = typeof data.answer === 'string' ? data.answer.trim() : '';
  if (!worthRemembering(b.q, answer)) return null;
  if (b.lang === 'ar' && !/[\u0600-\u06FF]/.test(answer)) return null;
  const arabic = (t: string) => /[\u0600-\u06FF]/.test(t);
  const paraphrases = (Array.isArray(data.paraphrases) ? data.paraphrases : [])
    .filter((p): p is string => typeof p === 'string')
    .map((p) => p.trim())
    // A one-word «question» («العنبر») is too broad to answer from memory.
    .filter((p) => p.length >= 6 && p.length <= 200 && meaningWords(p).length >= 2 && (b.lang === 'ar' ? arabic(p) : !arabic(p)) && normalizeQuestion(p) !== normalizeQuestion(b.q))
    .slice(0, 4);
  return { answer, paraphrases };
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
