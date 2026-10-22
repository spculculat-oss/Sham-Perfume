/**
 * «وكيل شاهين» — the owner's request (2026-10-22): Shaheen must not just repeat an old answer. Before he answers,
 * he understands the question and runs it like a professional agent:
 *   1. Understand: the question as meant (mistyped words read back, Arabic typed on the English keyboard), its
 *      field of science, its kind (definition, explanation, how-to, why, comparison, list) and its subjects. A
 *      question too vague to answer is asked back, never guessed.
 *   2. Plan: which expert of «مدرسة شاهين» owns the field, and which sources to consult — the expert's own reviewed
 *      lessons first, then his library (lessons, the materials encyclopaedia), his memory (old answers are ONE
 *      source among others, weighed by where they came from and how close they are), then open sources. A
 *      comparison is split in two questions, each answered on its own.
 *   3. Gather and weigh: every candidate gets a relevance score and a trust score (reviewed lesson > study answer >
 *      a visitor's old answer); the best wins, a second source adds what the first lacks.
 *   4. Check: no answer below the bar. A field's boundary (medicine is general education, never a diagnosis) is
 *      stated. Nothing solid → he says so honestly and sends the question to the field's expert in the school, who
 *      studies it on the next run (src/utils → server knowledge gaps → scripts/shaheen-school).
 * No AI platform anywhere (rule O-10). Pure: shared by the server (server/shaheen.ts), the visitor's browser
 * (src/utils/browserMemory.ts) and the tests.
 */
import { SCIENCE_TRACKS, type ScienceLesson, type ScienceTrackId } from '../data/sciences';
import { isPersonal, isTimeBound, meaningWords, normalizeQuestion, similarity, type MemoryEntry, type MemoryFile } from './shaheenMemory';
import { lessonExcerpt, searchLibrary, topicWords, type LibraryLesson, type LibraryMaterial } from './shaheenLibrary';
import { buildScienceIndex, scienceExact, scienceHits, type ScienceFieldWords, type ScienceIndex } from './scienceIndex';
import { buildLexicon, understandQuestion, understoodNote, type Lexicon } from './shaheenSpelling';
import { researchAnswer, type Research } from './webResearch';
import { greetingKind, greetingReply } from './shaheenGreeting';
import type { SupportedLanguage } from '../types/i18n';

// ── The school's experts ─────────────────────────────────────────────────────────────────────────────────────
export type FieldId = 'perfume' | ScienceTrackId | 'general';
export interface SchoolExpert {
  field: FieldId;
  nameAr: string;
  nameEn: string;
  /** Words of the field (normalized like meaningWords: no «ال», ة → ه, أ/إ → ا, ى → ي). A stem matches a word's start. */
  words: string[];
  /** The field's line that is never crossed (from its science track when it has one). */
  boundaryAr?: string;
}
const W = (s: string) => s.split(/\s+/).filter(Boolean);
export const SCHOOL_EXPERTS: SchoolExpert[] = [
  { field: 'perfume', nameAr: 'خبير العطور وصناعتها', nameEn: 'Perfumery expert', words: W('عطر عطور عطري برفان بارفان برفيوم نوت نوته نوتات تركيز تعتيق مسك عود عنبر زيت زيوت فوحان فواح ثبات كولونيا تواليت مثبت مثبتات تركيبه بخور صندل ورد ياسمين فانيليا امبروكسان باتشولي برجموت لافندر perfume fragrance scent cologne oud musk ambroxan maceration fixative sillage accord') },
  { field: 'chemistry', nameAr: 'خبير الكيمياء', nameEn: 'Chemistry expert', words: W('كيمياء كيميا كيميائي تفاعل تفاعلات ذره ذرات جزيء جزيئ جزئ مركب مركبات عنصر عناصر حمض احماض قلوي قاعدي اكسده اختزال محلول محاليل ايون ايونات رابطه روابط تساهميه جدول دوري مول تبلور تقطير بلمره بوليمر استر كحولات chemistry chemical molecule acid base reaction atom compound element ion bond solution polymer ester oxidation') },
  { field: 'physics', nameAr: 'خبير الفيزياء', nameEn: 'Physics expert', words: W('فيزياء فيزيا قوه قوي طاقه سرعه تسارع جاذبيه كهرباء كهربي مغناطيس مغناطيسي ضوء موجه موجات حراره ديناميكا نيوتن ضغط كم كمي نسبيه احتكاك عزم كتله physics force energy speed velocity acceleration gravity electricity magnet light wave heat thermodynamics quantum relativity mass momentum') },
  { field: 'biology', nameAr: 'خبير الأحياء', nameEn: 'Biology expert', words: W('احياء بيولوجيا خليه خلايا جين جينات وراثه وراثي كروموسوم بروتين بروتينات انزيم انزيمات تطور نبات نباتات بناء ضوئي تمثيل بكتيريا فطريات كائن كائنات بيئه dna rna biology cell gene genetics protein enzyme evolution photosynthesis organism bacteria ecosystem') },
  { field: 'human-medicine', nameAr: 'خبير الطب البشري', nameEn: 'Human medicine expert', words: W('طب طبي مرض امراض علاج اعالج عالج يعالج قلب ضغط سكري سكر مناعه فيروس فيروسات لقاح لقاحات تطعيم دواء ادويه عظم عظام دم كلي كليه كبد رئه رئتين تنفس اعصاب عصبي مخ دماغ جراحه اسعاف صداع حمي medicine medical disease heart blood vaccine immune lung kidney liver nerve brain surgery') },
  { field: 'veterinary', nameAr: 'خبير الطب البيطري', nameEn: 'Veterinary expert', words: W('بيطري بيطريه قطه قطط كلب كلاب ماشيه بقر ابقار جاموس غنم اغنام ماعز دواجن فراخ دجاج خيل حصان خيول ابل جمل جمال مجترات مزرعه vet veterinary livestock poultry cattle horse camel sheep goat') },
  { field: 'space', nameAr: 'خبير علوم الفضاء', nameEn: 'Space science expert', words: W('فضاء فضائي صاروخ صواريخ مدار مدارات قمر اقمار كوكب كواكب نجم نجوم مجره مجرات شمس شمسي فلك فلكي رائد رواد محطه اطلاق مريخ space rocket orbit satellite planet star galaxy sun moon astronomy launch mars astronaut') },
  { field: 'earth', nameAr: 'خبير علوم الأرض', nameEn: 'Earth science expert', words: W('ارض زلزال زلازل بركان براكين صخر صخور معادن مناخ مناخي طقس محيط محيطات بحار مياه جوفيه تربه جيولوجيا احتباس حراري تصحر فيضان فيضانات اعاصير اعصار غلاف جوي earthquake volcano rock mineral climate weather ocean geology soil flood hurricane atmosphere') },
  { field: 'nuclear', nameAr: 'خبير العلوم النووية', nameEn: 'Nuclear science expert', words: W('نووي نوويه اشعاع اشعاعي مشع مفاعل مفاعلات انشطار اندماج يورانيوم نظير نظائر بلوتونيوم nuclear radiation radioactive reactor fission fusion isotope uranium') },
  { field: 'biosafety', nameAr: 'خبير السلامة والأمن البيولوجي', nameEn: 'Biosafety expert', words: W('وباء اوبئه جائحه ميكروب ميكروبات مضاد مضادات حيوي عدوي معمل معامل وبائيات ممرض ممرضات biosafety biosecurity pandemic epidemic antibiotic microbe pathogen') },
  { field: 'semiconductors', nameAr: 'خبير أشباه الموصلات والإلكترونيات', nameEn: 'Semiconductors expert', words: W('اشباه موصلات موصل شريحه شرائح ترانزستور معالج معالجات رقاقه ويفر الكترونيات الكتروني دائره متكامله ليثوغرافيا لوحه semiconductor chip transistor wafer processor electronics lithography pcb') },
  { field: 'electronic-warfare', nameAr: 'خبير الطيف والحرب الإلكترونية', nameEn: 'Spectrum expert', words: W('تشويش رادار رادارات طيف كهرومغناطيسي ترددات gps jamming radar spectrum') },
  { field: 'war-studies', nameAr: 'خبير الدراسات الاستراتيجية', nameEn: 'Strategic studies expert', words: W('حرب حروب استراتيجيه عسكري عسكريه ردع جيش جيوش تصعيد لوجستيات استخبارات war strategy military deterrence logistics') },
  { field: 'math', nameAr: 'خبير الرياضيات', nameEn: 'Mathematics expert', words: W('رياضيات معادله معادلات جبر هندسه تفاضل تكامل احتمال احتمالات احصاء مثلث مساحه محيط زاويه نظريه اعداد كسور لوغاريتم math mathematics equation algebra geometry calculus probability statistics triangle theorem logarithm') },
  { field: 'computing', nameAr: 'خبير الحاسبات والبرمجة', nameEn: 'Computing expert', words: W('برمجه برنامج كمبيوتر حاسوب حاسب خوارزميه خوارزميات ذكاء اصطناعي شبكه شبكات انترنت بيانات قاعده تشفير سوفتوير هاردوير programming computer algorithm software internet network data database encryption code') },
  { field: 'nutrition', nameAr: 'خبير التغذية', nameEn: 'Nutrition expert', words: W('تغذيه غذاء غذائي اكل طعام فيتامين فيتامينات سعرات دهون كربوهيدرات الياف معادن رجيم دايت nutrition food vitamin calorie diet fiber carbohydrate fat') },
  { field: 'agriculture', nameAr: 'خبير الزراعة', nameEn: 'Agriculture expert', words: W('زراعه زراعي محصول محاصيل سماد اسمده ري بذور بذره حصاد تربه agriculture crop fertilizer irrigation seed harvest farming') },
];
/** Every expert, by field (the science tracks bring their own boundary). */
const TRACKS = Object.fromEntries(SCIENCE_TRACKS.map((t) => [t.id, t])) as Record<string, (typeof SCIENCE_TRACKS)[number]>;
for (const e of SCHOOL_EXPERTS) if (TRACKS[e.field]) e.boundaryAr = TRACKS[e.field].boundaryAr;
export const GENERAL_EXPERT: SchoolExpert = { field: 'general', nameAr: 'باحث المدرسة (المصادر المفتوحة)', nameEn: 'School researcher', words: [] };
export const expertOf = (field: FieldId | string | undefined) => SCHOOL_EXPERTS.find((e) => e.field === field) || GENERAL_EXPERT;
/** The reason on a knowledge gap the agent sends to a field's expert («expert:chemistry»). */
export const EXPERT_GAP_PREFIX = 'expert:';
export const expertGapReason = (field: FieldId) => `${EXPERT_GAP_PREFIX}${field}`;

// ── 1. Understand ────────────────────────────────────────────────────────────────────────────────────────────
export type QuestionKind = 'define' | 'explain' | 'howto' | 'why' | 'compare' | 'list';
export interface FieldScore { field: FieldId; score: number }
export interface AgentUnderstanding {
  /** The question as he understood it (typos read back). */
  asked: string;
  /** The line shown above the answer when he read a word differently (so a wrong reading is visible). */
  note: string;
  kind: QuestionKind;
  fields: FieldScore[];
  subjects: string[];
  /** A comparison, split in its two sides. */
  parts?: [string, string];
  /** Too little to work on: he asks back instead of guessing. */
  vague: boolean;
  /** News, prices, today, personal details: not his school's job (other paths answer them). */
  outOfScope: boolean;
}

const KIND: [QuestionKind, RegExp][] = [
  ['compare', /(الفرق بين|الفرق ما بين|فرق بين|مقارنه بين|قارن بين|ولا احسن|احسن من|افضل من|ايهما|difference between|compare|versus|\bvs\.?\b|better than)/iu],
  ['howto', /(ازاي|ازاى|كيف|طريقه|طريقة|خطوات|اعمل|نعمل|how (do|to|can|does|is)|steps|way to)/iu],
  ['why', /(ليه|ليش|لماذا|لم |ايه السبب|سبب|why|reason)/iu],
  ['list', /(انواع|أنواع|اقسام|أقسام|امثله|أمثلة|مكونات|types of|kinds of|examples of|list)/iu],
  ['define', /(يعني ايه|يعني اي|ما هو|ما هي|ما هى|ايه هو|ايه هي|ايه هى|ايه هوا|مين|تعريف|معني|معنى|what is|what are|who is|define|meaning of)/iu],
];
/** Does a question word belong to a field word list (stem at the word's start, short words exactly)? */
const hits = (word: string, stem: string) => (stem.length <= 3 ? word === stem : word === stem || word.startsWith(stem));

export function fieldsOf(question: string): FieldScore[] {
  const words = meaningWords(question);
  const joined = ` ${words.join(' ')} `;
  const scored = SCHOOL_EXPERTS.map((e) => {
    let score = 0;
    for (const stem of e.words) {
      if (stem.includes(' ')) { if (joined.includes(` ${stem} `)) score += 2; continue; }
      if (words.some((w) => hits(w, stem))) score += 1;
    }
    return { field: e.field, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  return scored.slice(0, 3);
}

/** «الفرق بين العود والمسك» → [العود, المسك]. */
export function compareParts(question: string): [string, string] | undefined {
  const q = question.replace(/[؟?!.]+$/g, '').trim();
  const m = q.match(/(?:بين|between)\s+(.+?)\s+(?:و\s*|and\s+)(.+)$/iu) || q.match(/^(.+?)\s+(?:ولا|او|أو|or|vs\.?|versus)\s+(.+?)(?:\s+(?:احسن|أحسن|افضل|أفضل|better))?$/iu);
  if (!m) return undefined;
  const a = m[1].trim(); const b = m[2].trim();
  return topicWords(a).length && topicWords(b).length ? [a, b] : undefined;
}

/** The words he knows across his school: perfume words, the fields' words and every science lesson's words. */
let agentLex: Lexicon | undefined;
export function agentLexicon(src: { lessons?: LibraryLesson[]; materials?: LibraryMaterial[]; memory?: MemoryFile } = {}): Lexicon {
  const extra = [...SCHOOL_EXPERTS.flatMap((e) => e.words.filter((w) => !w.includes(' '))),
    ...SCIENCE_TRACKS.flatMap((t) => t.lessons.flatMap((l) => [...l.keywords, ...meaningWords(l.titleAr)]))];
  if (!src.lessons && !src.materials && !src.memory) return agentLex ??= buildLexicon({ extra });
  return buildLexicon({ ...src, extra });
}

export function understand(question: string, lang: string, lex: Lexicon = agentLexicon()): AgentUnderstanding {
  const u = understandQuestion(question, lex);
  const asked = u.changed ? u.text : question;
  const kind = KIND.find(([, re]) => re.test(asked))?.[0] || 'explain';
  const subjects = topicWords(asked);
  const parts = kind === 'compare' ? compareParts(asked) : undefined;
  return {
    asked, note: u.changed ? understoodNote(lang, u) : '', kind, fields: fieldsOf(asked), subjects, parts,
    vague: normalizeQuestion(asked).length < 4 || !subjects.length,
    outOfScope: isTimeBound(asked) || isPersonal(asked),
  };
}

// ── 2. Plan ──────────────────────────────────────────────────────────────────────────────────────────────────
export type SourceKind = 'expert' | 'lesson' | 'material' | 'memory' | 'research';
export interface AgentPlan { expert: SchoolExpert; steps: SourceKind[]; split: boolean }
/** Which expert owns it, and the order he consults his sources (the expert's reviewed lessons always first). */
export function plan(u: AgentUnderstanding): AgentPlan {
  const expert = expertOf(u.fields[0]?.field);
  // A perfume question starts in the perfume library (materials before lessons when it names one material).
  const steps: SourceKind[] = expert.field === 'perfume'
    ? ['material', 'lesson', 'expert', 'memory', 'research']
    : ['expert', 'lesson', 'material', 'memory', 'research'];
  return { expert, steps, split: Boolean(u.parts) };
}

// ── The fast desk: the sciences answered from the index, with no AI and no walk over the curriculum ────────────
/**
 * How sure the desk must be before it answers by itself. Higher than the agent's bar on purpose: the desk answers
 * before his memory is read, so a loose match must not take the place of a better answer — a question that only
 * brushes a lesson (one shared word, «ايه هي الطاقة الشمسية في الفضاء» and the space-security lesson) is left to
 * the agent's full weighing.
 */
export const SCIENCE_DESK_BAR = 0.7;
interface ScienceHitLike { lesson: ScienceLesson; relevance: number }
export interface ScienceDeskAnswer {
  /** The ready answer (the reviewed lesson, its boundary when it has one, and where it comes from). */
  answer: string;
  lesson: ScienceLesson;
  relevance: number;
  /** The other lessons the index found close, offered as follow-ups. */
  related: ScienceLesson[];
}
/**
 * «مكتب الاستعلام السريع»: a visitor's science question answered in one index lookup — no engine, no network and
 * no scan of his memory. The question's own wording answers in one map hit; anything else is scored against the
 * few lessons that share a word with it. Below the bar he says nothing (the agent, the library and the researcher
 * are still there, and he never guesses).
 */
export function scienceDesk(question: string, lang: string, options: { bar?: number; lessons?: ScienceLesson[]; field?: FieldId } = {}): ScienceDeskAnswer | undefined {
  // The curriculum is written, reviewed and bounded in Arabic: another language gets the expert's own answer.
  if (lang !== 'ar') return undefined;
  const asked = question.trim();
  if (normalizeQuestion(asked).length < 6 || isTimeBound(asked) || isPersonal(asked)) return undefined;
  const index = scienceIndexFor(options.lessons);
  const bar = options.bar ?? SCIENCE_DESK_BAR;
  const field = options.field ?? fieldsOf(asked)[0]?.field;
  const exact = scienceExact(index, asked);
  // One lookup: the taught wordings are a map hit, everything else is scored once and kept for the next time.
  const hits = scienceHits(index, asked, { field, limit: 4 });
  const best: ScienceHitLike | undefined = exact ? { lesson: exact, relevance: 1 } : hits[0];
  if (!best || best.relevance < bar) return undefined;
  const related = hits.filter((h) => h.lesson.id !== best.lesson.id && h.relevance >= 0.35).slice(0, 2).map((h) => h.lesson);
  const trackTitle = TRACKS[best.lesson.track]?.titleAr || expertOf(best.lesson.track).nameAr;
  // A medical or veterinary lesson always carries its limit: general education, never a diagnosis or a dose.
  const boundary = best.lesson.track === 'human-medicine' || best.lesson.track === 'veterinary'
    ? `\n\n> ${TRACKS[best.lesson.track]?.boundaryAr || ''}`.trimEnd() : '';
  const more = related.length ? ` وعندي كمان عن: ${related.map((l) => l.titleAr).join('، ')}.` : '';
  const answer = `**${best.lesson.titleAr}**\n\n${best.lesson.answerAr}${boundary}`
    + `\n\n_🎓 من علوم شاهين — مسار «${trackTitle}»، درس مكتوب ومراجَع عندي.${more}_`;
  return { answer, lesson: best.lesson, relevance: best.relevance, related };
}

// ── 3. Gather and weigh ──────────────────────────────────────────────────────────────────────────────────────
export interface AgentSources {
  lessons: LibraryLesson[];
  materials: LibraryMaterial[];
  memory?: MemoryFile;
  /** The school's reviewed science lessons (default: the curriculum shipped with the site). */
  science?: ScienceLesson[];
}
export interface Evidence { kind: SourceKind; id: string; title: string; text: string; relevance: number; trust: number; field?: FieldId }
/** How much each source is trusted (a reviewed lesson beats an old answer; a visitor's old answer is the weakest). */
export const TRUST: Record<SourceKind, number> = { expert: 1, material: 0.95, lesson: 0.9, memory: 0.6, research: 0.7 };
const MEMORY_TRUST: Record<MemoryEntry['source'], number> = { seed: 0.9, study: 0.85, chat: 0.6, probe: 0.5 };
/** The least relevance a source needs before it may answer. */
export const BAR: Record<SourceKind, number> = { expert: 0.42, material: 0.6, lesson: 0.45, memory: 0.55, research: 0 };

const SCIENCE_ALL = () => SCIENCE_TRACKS.flatMap((t) => t.lessons);
const words = (s: string) => topicWords(s);

/* ── «فهرس علوم شاهين»: the curriculum compiled once, so a question never walks all 73 lessons ──────────────── */
const FIELD_WORDS = Object.fromEntries(SCIENCE_TRACKS.map((t) => [t.id, expertOf(t.id).words])) as ScienceFieldWords;
let curriculumIndex: ScienceIndex | undefined;
/** The school's curriculum as a read-only index (built on first use, a few milliseconds, then reused everywhere). */
export const scienceCurriculum = (): ScienceIndex => (curriculumIndex ??= buildScienceIndex(SCIENCE_ALL(), FIELD_WORDS));
const looseIndexes = new WeakMap<ScienceLesson[], ScienceIndex>();
/** The index of another lesson set (the school's own studies, a test's curriculum, an admin preview). */
export function scienceIndexFor(lessons?: ScienceLesson[]): ScienceIndex {
  if (!lessons) return scienceCurriculum();
  const known = looseIndexes.get(lessons);
  if (known) return known;
  const built = buildScienceIndex(lessons, FIELD_WORDS);
  looseIndexes.set(lessons, built);
  return built;
}

/** A science lesson against the question: the question's subjects found in the lesson's title, wording and keywords. */
export function scoreLesson(lesson: ScienceLesson, question: string, field?: FieldId): number {
  const index = scienceCurriculum();
  const doc = index.byId.get(lesson.id);
  if (doc && doc.lesson === lesson) {
    return scienceHits(index, question, { field }).find((hit) => hit.lesson.id === lesson.id)?.relevance ?? 0;
  }
  return scoreLessonNaive(lesson, question, field);
}

/**
 * The reviewed reference formula, kept as written (a lesson outside the index, and the tests' yardstick for the
 * index). It re-normalises the lesson's text on every call — exactly what the index exists to avoid.
 */
export function scoreLessonNaive(lesson: ScienceLesson, question: string, field?: FieldId): number {
  const asked = words(question);
  if (!asked.length) return 0;
  const own = new Set(words(`${lesson.titleAr} ${lesson.questionAr} ${lesson.keywords.join(' ')}`));
  const title = new Set(words(`${lesson.titleAr} ${lesson.keywords.join(' ')}`));
  const found = (w: string, set: Set<string>) => set.has(w) || (w.length >= 4 && [...set].some((x) => x.length >= 4 && (x.startsWith(w) || w.startsWith(x))));
  // A word of the lesson's field («نووي» for a nuclear lesson) counts half: it says the field, not the topic.
  const fieldWords = expertOf(lesson.track).words;
  const direct = asked.filter((w) => found(w, own));
  if (!direct.length) return 0;
  const shared = direct.length + 0.5 * asked.filter((w) => !found(w, own) && fieldWords.some((stem) => hits(w, stem))).length;
  const inTitle = asked.filter((w) => found(w, title)).length;
  // Named in the lesson's own title (not only in its keywords): the lesson is about it.
  const named = asked.some((w) => found(w, new Set(words(lesson.titleAr))));
  let score = 0.55 * (shared / asked.length) + 0.25 * similarity(question, lesson.questionAr) + 0.15 * Math.min(1, inTitle / 2) + (named ? 0.1 : 0);
  if (field && lesson.track === field) score += 0.1;
  // One shared word in a long question is not «about» the lesson.
  if (direct.length === 1 && asked.length >= 3 && !inTitle) score *= 0.5;
  return Math.min(1, score);
}

export function gather(u: AgentUnderstanding, src: AgentSources, lang: string, question = u.asked): Evidence[] {
  const out: Evidence[] = [];
  const field = u.fields[0]?.field;
  // The experts' reviewed lessons (Arabic curriculum): from the index, only the lessons that share a word with it.
  if (lang === 'ar') {
    for (const hit of scienceHits(scienceIndexFor(src.science), question, { field })) {
      if (hit.relevance <= 0.2) continue;
      out.push({ kind: 'expert', id: hit.lesson.id, title: hit.lesson.titleAr, text: hit.lesson.answerAr, relevance: hit.relevance, trust: TRUST.expert, field: hit.lesson.track });
    }
  }
  // His library: lessons, materials, and the closest old answers (searchLibrary weighs them on its own scale).
  for (const r of searchLibrary({ lessons: src.lessons, materials: src.materials, memory: src.memory }, question, lang)) {
    if (r.kind === 'memory') continue;
    const relevance = r.kind === 'lesson' ? Math.min(1, r.score / 6) : r.score;
    out.push({ kind: r.kind, id: r.id, title: r.title, text: r.kind === 'lesson' ? lessonExcerpt(r.text, words(question)) : r.text, relevance, trust: TRUST[r.kind] });
  }
  // Old answers: one source among the others, trusted by where they came from, a little less as they age.
  if (src.memory) {
    const norm = normalizeQuestion(question);
    for (const e of src.memory.entries) {
      if (e.lang !== lang) continue;
      const relevance = normalizeQuestion(e.question) === norm ? 1 : similarity(question, e.question);
      if (relevance < 0.4) continue;
      const ageDays = Math.max(0, (Date.now() - Date.parse(e.at)) / 86_400_000);
      const trust = (MEMORY_TRUST[e.source] ?? 0.5) * (ageDays > 30 ? 0.85 : 1);
      out.push({ kind: 'memory', id: e.id, title: e.question, text: e.answer, relevance, trust });
    }
  }
  return out.filter((e) => e.relevance >= BAR[e.kind]).sort((a, b) => b.relevance * b.trust - a.relevance * a.trust);
}

// ── 4. Decide, check, answer ─────────────────────────────────────────────────────────────────────────────────
export type Confidence = 'high' | 'medium' | 'low';
export interface AgentResult {
  /** The visitor's answer; undefined when he has nothing solid (then `refer` says the expert will study it). */
  answer?: string;
  confidence: Confidence;
  expert: SchoolExpert;
  understanding: AgentUnderstanding;
  used: SourceKind[];
  /** Send the question to the field's expert in the school (nothing solid, or only an old/weak answer). */
  refer: boolean;
  /** He needs the visitor to say more (too vague): `answer` holds the question back. */
  clarify?: boolean;
  /** What he did, step by step (admin panel, tests). */
  trace: string[];
}
const score = (e: Evidence) => e.relevance * e.trust;
export const confidenceOf = (best?: Evidence): Confidence => (!best ? 'low' : score(best) >= 0.6 ? 'high' : score(best) >= 0.4 ? 'medium' : 'low');
const clip = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1).replace(/\s+\S*$/, '')}…`);
const SOURCE_AR: Record<SourceKind, string> = { expert: 'دروس الخبير المراجَعة', lesson: 'مكتبة شاهين', material: 'موسوعة المواد', memory: 'إجابات محفوظة', research: 'مصادر مفتوحة' };
const SOURCE_EN: Record<SourceKind, string> = { expert: 'the expert’s reviewed lessons', lesson: 'Shaheen’s library', material: 'the materials encyclopaedia', memory: 'saved answers', research: 'open sources' };

function body(e: Evidence): string {
  if (e.kind === 'memory') return e.text;
  if (e.kind === 'material') return e.text;
  return `**${e.title}**\n\n${e.text}`;
}
/** The line under every agent answer: who answered and from what. */
export function agentFooter(lang: string, expert: SchoolExpert, used: SourceKind[], refer: boolean): string {
  const ar = lang === 'ar' || lang === 'fa';
  const from = [...new Set(used)].map((k) => (ar ? SOURCE_AR[k] : SOURCE_EN[k])).join(ar ? '، ' : ', ');
  const who = ar ? expert.nameAr : expert.nameEn;
  const later = refer ? (ar ? ' وبعت سؤالك للخبير عشان يذاكره ويرد عليه أوفى المرة الجاية.' : ' Your question was sent to the expert to study for a fuller answer next time.') : '';
  return ar ? `\n\n_🎓 جاوبك ${who} من مدرسة شاهين — المصدر: ${from}.${later}_` : `\n\n_🎓 Answered by Shaheen’s school (${who}) — from ${from}.${later}_`;
}
/** Nothing solid: an honest answer, and the question goes to the field's expert. */
export function referralAnswer(lang: string, expert: SchoolExpert, recorded: boolean): string {
  const ar = lang === 'ar' || lang === 'fa';
  if (ar) return `السؤال ده في مجال **${expert.field === 'general' ? 'عام' : expert.nameAr.replace(/^خبير /, '')}**، ولسه معنديش عنه معلومة أكيدة، ومش هخمّن عليك 🙏${recorded ? `\n\nبعته لـ«${expert.nameAr}» في مدرسة شاهين عشان يدرسه ويتراجع، وهيبقى عندي رده في الدورة الجاية.` : ''}\n\nلو تقدر، اكتب السؤال بتفاصيل أكتر (إيه بالظبط اللي عايز تعرفه؟) وأنا أدوّر تاني.`;
  return `This question is about **${expert.field === 'general' ? 'a general topic' : expert.nameEn.replace(/ expert$/i, '')}**, and I don't have solid information on it yet — I won't guess 🙏${recorded ? `\n\nI sent it to Shaheen's school (${expert.nameEn}) to study and review; the answer will be ready after the next study round.` : ''}\n\nIf you can, add more detail and I'll look again.`;
}
const SMALL_TALK = new Set(W('سلام عليكم مرحبا اهلا اهلين هاي هلو ازيك ازيكم عامل اخبارك تمام شكرا متشكر ميرسي حلو جميل شاهين صباح مساء خير نور فل ok okay thanks thank hello hi hey good morning evening shaheen'));
/** «اعالج الصداع ازاي؟ / اخد دوا ايه؟»: a personal treatment or dose — the school never prescribes. */
const TREATMENT = /(اعالج|أعالج|علاج|اعالجه|دوا |دواء|ادويه|أدوية|جرعه|جرعة|اخد ايه|آخد ايه|اشرب ايه|مضاد|حبوب|treat|cure|dose|dosage|medication|which pill)/iu;
export const medicalAdvice = (u: AgentUnderstanding) => (u.fields[0]?.field === 'human-medicine' || u.fields[0]?.field === 'veterinary') && TREATMENT.test(u.asked) && u.kind !== 'define' && u.kind !== 'list';
export function medicalAnswer(lang: string, expert: SchoolExpert): string {
  const vet = expert.field === 'veterinary';
  if (lang === 'ar' || lang === 'fa') return `ده سؤال عن علاج أو دوا، وده قرار ${vet ? 'الطبيب البيطري' : 'الطبيب'} بعد ما يكشف — مدرسة شاهين بتعلّم معلومات عامة بس، ومش بتوصف علاج ولا جرعات 🙏\n\n- لو الأعراض شديدة أو مفاجئة أو مستمرة، روح للطوارئ أو ${vet ? 'لأقرب عيادة بيطرية' : 'لأقرب طبيب'} فوراً.\n- أقدر أشرحلك بشكل عام إزاي الجسم أو المرض بيشتغل — اسألني مثلاً «ايه هي المناعة؟» أو «ازاي القلب بيشتغل؟».\n\n> ${expert.boundaryAr || ''}`.trimEnd();
  return `That is a treatment or medicine question, and it is ${vet ? 'a veterinarian’s' : 'a doctor’s'} call after an examination — Shaheen's school teaches general knowledge only, never treatments or doses 🙏\n\n- Severe, sudden or lasting symptoms: go to emergency care or ${vet ? 'a vet' : 'a doctor'} now.\n- I can explain in general how the body or a disease works — ask e.g. “what is immunity?”.`;
}
export function clarifyAnswer(lang: string): string {
  return lang === 'ar' || lang === 'fa'
    ? 'عايز أفهم سؤالك صح قبل ما أرد 🙂 ممكن تكتبه بتفاصيل أكتر؟ مثلاً: عن إيه بالظبط، وفي أنهي مجال (عطور، كيمياء، طب، فضاء…)؟'
    : 'I want to understand your question correctly first 🙂 Could you add a little detail — what exactly, and in which field (perfume, chemistry, medicine, space…)?';
}

function decide(u: AgentUnderstanding, p: AgentPlan, ev: Evidence[], lang: string, trace: string[]): Omit<AgentResult, 'understanding' | 'trace'> {
  const ar = lang === 'ar' || lang === 'fa';
  const best = ev[0];
  const confidence = confidenceOf(best);
  if (!best || confidence === 'low') return { confidence: 'low', expert: p.expert, used: [], refer: true };
  // The expert who answered is the one whose lesson won (a chemistry question answered by a medicine lesson says so).
  const expert = best.field ? expertOf(best.field) : p.expert;
  // A second source adds what the first lacks (a different kind, relevant enough, not the same text).
  const second = ev.find((e) => e !== best && e.kind !== best.kind && score(e) >= 0.45 && similarity(e.text.slice(0, 400), best.text.slice(0, 400)) < 0.6);
  let text = body(best);
  if (second) text += `\n\n${ar ? `ومن ${SOURCE_AR[second.kind]}` : `And from ${SOURCE_EN[second.kind]}`}${second.kind === 'memory' ? '' : ` (${clip(second.title, 70)})`}:\n${clip(second.text, 500)}`;
  if (expert.boundaryAr && ar && (expert.field === 'human-medicine' || expert.field === 'veterinary')) text += `\n\n> ${expert.boundaryAr}`;
  const used = [best.kind, ...(second ? [second.kind] : [])];
  // Only an old answer, or a medium match: answered, and the expert still studies it for a better one.
  const refer = (best.kind === 'memory' && best.trust < 0.8) || confidence === 'medium';
  trace.push(`decided: ${best.kind}:${best.id} (${score(best).toFixed(2)}, ${confidence})${second ? ` + ${second.kind}:${second.id}` : ''}`);
  return { answer: text, confidence, expert, used, refer };
}

/**
 * The whole agent: understand → plan → gather → (open sources when the school has nothing) → decide → check.
 * `research` is optional (the server and the browser pass Wikipedia's keyless lookup; tests inject a fake).
 */
export async function runAgent(question: string, lang: string, ctx: {
  sources: AgentSources;
  research?: (question: string, lang: string) => Promise<Research | undefined>;
  lexicon?: Lexicon;
  /** The caller records a referred question for the school (the server does; the browser cannot). */
  willRecord?: boolean;
}): Promise<AgentResult> {
  const trace: string[] = [];
  const u = understand(question, lang, ctx.lexicon || agentLexicon());
  const p = plan(u);
  trace.push(`understood: kind=${u.kind} fields=${u.fields.map((f) => `${f.field}:${f.score}`).join(',') || '-'} subjects=${u.subjects.slice(0, 6).join(' ')}${u.note ? ' (typos read back)' : ''}`);
  trace.push(`plan: ${p.expert.field} expert; ${p.steps.join(' → ')}${p.split ? '; comparison split in two' : ''}`);
  if (u.outOfScope) return { confidence: 'low', expert: p.expert, understanding: u, used: [], refer: false, trace: [...trace, 'out of scope (news, prices, personal) — left to the other paths'] };
  // A greeting or small talk is answered as such, never looked up as a question.
  const greeting = greetingKind(question);
  if (greeting || (u.subjects.length && u.subjects.every((w) => SMALL_TALK.has(w)))) {
    return { answer: greeting ? greetingReply(greeting, lang as SupportedLanguage) : clarifyAnswer(lang), clarify: !greeting, confidence: 'high', expert: p.expert, understanding: u, used: [], refer: false, trace: [...trace, 'small talk — answered as such'] };
  }
  if (medicalAdvice(u)) {
    return { answer: u.note + medicalAnswer(lang, p.expert), confidence: 'high', expert: p.expert, understanding: u, used: [], refer: false, trace: [...trace, 'personal treatment/dose question — general guidance and the doctor, never a prescription'] };
  }
  if (u.vague) return { answer: clarifyAnswer(lang), clarify: true, confidence: 'low', expert: p.expert, understanding: u, used: [], refer: false, trace: [...trace, 'too vague — asked back'] };

  // A comparison: each side answered on its own, then put side by side.
  if (u.parts) {
    const sides = u.parts.map((part) => gather({ ...u, fields: fieldsOf(part).length ? fieldsOf(part) : u.fields }, ctx.sources, lang, part)[0]);
    trace.push(`compare: ${u.parts.map((part, i) => `${part} → ${sides[i] ? `${sides[i]!.kind}:${sides[i]!.id}` : 'nothing'}`).join(' | ')}`);
    // Both sides live in one lesson («الانشطار والاندماج»): that lesson answers the comparison.
    if (sides[0] && sides[1] && sides[0].id === sides[1].id) trace.push('compare: one lesson covers both sides');
    else if (sides.every((s) => s && confidenceOf(s) !== 'low')) {
      const ar = lang === 'ar' || lang === 'fa';
      const used = sides.map((s) => s!.kind);
      const expert = sides[0]!.field ? expertOf(sides[0]!.field) : p.expert;
      const text = u.parts.map((part, i) => `### ${part}\n${clip(sides[i]!.text, 900)}`).join('\n\n')
        + `\n\n${ar ? '**الخلاصة:** ده عن الطرفين من مصادري؛ لو عايز مقارنة في نقطة معينة (الريحة، الثبات، الاستخدام، الأمان…) قولّي.' : '**In short:** here is each side from my sources; ask about a specific point to compare them on.'}`;
      const refer = sides.some((s) => (s!.kind === 'memory' && s!.trust < 0.8) || confidenceOf(s) === 'medium');
      return { answer: u.note + text + agentFooter(lang, expert, used, refer), confidence: sides.every((s) => confidenceOf(s) === 'high') ? 'high' : 'medium', expert, understanding: u, used, refer, trace };
    }
  }

  const ev = gather(u, ctx.sources, lang);
  trace.push(`gathered: ${ev.slice(0, 5).map((e) => `${e.kind}:${e.id}=${score(e).toFixed(2)}`).join(', ') || 'nothing in the school'}`);
  let d = decide(u, p, ev, lang, trace);
  // The school has nothing solid: the researcher reads open sources (not for shopping, news or personal questions).
  if (!d.answer && ctx.research) {
    const found = await ctx.research(u.asked, lang).catch(() => undefined);
    trace.push(found ? `research: ${found.sources.length} open sources read` : 'research: nothing found');
    if (found) {
      const text = researchAnswer(found, { recorded: Boolean(ctx.willRecord) });
      return { answer: u.note + text, confidence: 'medium', expert: p.expert, understanding: u, used: ['research'], refer: true, trace };
    }
  }
  if (!d.answer) { trace.push(`refer to ${p.expert.field} expert`); return { ...d, understanding: u, trace }; }
  d = { ...d, answer: u.note + d.answer + agentFooter(lang, d.expert, d.used, d.refer) };
  return { ...d, understanding: u, trace };
}
