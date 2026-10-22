/**
 * «فهرس علوم شاهين» — the algorithms that make his sciences appear at once when he needs them.
 *
 * His curriculum is 73 reviewed lessons (src/data/sciences). Until now every question was answered by walking all
 * of them: each lesson's title, question and keywords were re-normalised and re-tokenised for every single question,
 * and the question's words were compared with every lesson's word set. That is fine for one question and wasteful
 * for the thousands a day brings, for the school's study run, and — worst of all — for a visitor on a phone with no
 * network, where a slow answer feels like no answer.
 *
 * This module compiles the curriculum ONCE into a read-only index and answers every later question from it:
 *
 *   1. «الفهرس المعكوس» (inverted index): every word of every lesson points to the lessons that carry it, so a
 *      question only looks at the handful of lessons that share a word with it — never at all 73.
 *   2. «مطابقة الجذوع بالبادئة» (prefix buckets on the first three letters): the same rule the school has always
 *      used (a word matches another when one starts with the other, from four letters up) is kept — but the
 *      candidates come from one small bucket instead of scanning each lesson's vocabulary.
 *   3. «بطاقة السؤال» (normalised-question map): the lesson's own question and the three wordings the school
 *      teaches («اشرحلي …»، «معلومات عن …»، «يعني ايه …») answer in one lookup, with no scoring at all.
 *   4. «ذاكرة الأسئلة المتكررة» (a small LRU): a question asked again — the same visitor retrying, the supervisor's
 *      probe, the next visitor asking the same thing — is answered from the result of the first time.
 *
 * The score of a lesson is exactly the school's reviewed formula (see `scoreLesson` in shaheenAgent.ts): the
 * question's subjects found in the lesson, the field's own words counting half, the lesson's own wording, and
 * whether the topic is named in its title. Nothing here is generated, nothing is guessed: an answer is a lesson
 * the team wrote and reviewed.
 *
 * Pure (no Node or DOM APIs, no AI service): shared by the server (server/shaheen.ts), the visitor's browser
 * (src/utils/browserMemory.ts), the school's study run and the tests. Safe by construction: the lessons carry
 * their own boundaries (SCIENCE_POLICY_AR), and this module only ranks them.
 */
import { SCIENCE_LESSONS, type ScienceLesson, type ScienceTrackId } from '../data/sciences';
import { topicWords } from './shaheenLibrary';
import { meaningWords, normalizeQuestion } from './shaheenMemory';

/** The words that name a field («نووي»، «زلزال»…): a lesson of that field gets half a point for them. */
export type ScienceFieldWords = Partial<Record<ScienceTrackId, string[]>>;

export interface ScienceIndexDoc {
  /** Position of the lesson in `docs` (also its posting id). */
  pos: number;
  lesson: ScienceLesson;
  /** Words of the title, the question and the keywords — the lesson as the school compares it. */
  own: Set<string>;
  /** Words of the title and the keywords: what the lesson is called. */
  title: Set<string>;
  /** Words of the title only: the topic it is named after. */
  name: Set<string>;
  /** Words of its own question, the way the school's similarity reads them, for the similarity score. */
  question: Set<string>;
  /** Its numbers, sorted: «50 مل» never matches «100 مل» (kept ready, so no candidate re-sorts on every question). */
  questionDigits: string;
}

export interface ScienceIndex {
  docs: ScienceIndexDoc[];
  byId: Map<string, ScienceIndexDoc>;
  /** word → positions of the lessons that carry it */
  postings: Map<string, number[]>;
  /** first three letters of a word → every indexed word that starts with them (prefix rule, no full scan) */
  buckets: Map<string, string[]>;
  /** normalised question / taught wording → lesson position (the «بطاقة السؤال» fast path) */
  exact: Map<string, number>;
  fieldWords: ScienceFieldWords;
  buildMs: number;
}

/** Words the school ignores when a question names its subject (same rule as the school's `hits`). */
const hitsStem = (word: string, stem: string) => (stem.length <= 3 ? word === stem : word === stem || word.startsWith(stem));
const PREFIX = 3;

/** The wordings the school teaches for a lesson, so a visitor's usual phrasing answers with no scoring. */
export function scienceWordings(lesson: ScienceLesson): string[] {
  const title = lesson.titleAr.replace(/[؟?.!]+$/, '');
  return [lesson.questionAr, lesson.titleAr, `اشرحلي ${title}`, `معلومات عن ${title}`, `يعني ايه ${title}`];
}

/** Compiles the curriculum into the index. Runs once per process (a few milliseconds); never on a question. */
export function buildScienceIndex(lessons: ScienceLesson[] = SCIENCE_LESSONS, fieldWords: ScienceFieldWords = {}): ScienceIndex {
  const started = performance.now();
  const docs: ScienceIndexDoc[] = [];
  const byId = new Map<string, ScienceIndexDoc>();
  const postings = new Map<string, number[]>();
  const bucketWords = new Map<string, Set<string>>();
  const exact = new Map<string, number>();

  lessons.forEach((lesson, pos) => {
    const ownList = topicWords(`${lesson.titleAr} ${lesson.questionAr} ${lesson.keywords.join(' ')}`);
    const titleList = topicWords(`${lesson.titleAr} ${lesson.keywords.join(' ')}`);
    const doc: ScienceIndexDoc = {
      pos, lesson,
      own: new Set(ownList),
      title: new Set(titleList),
      name: new Set(topicWords(lesson.titleAr)),
      question: new Set(meaningWords(lesson.questionAr)),
      questionDigits: meaningWords(lesson.questionAr).filter((w) => /\d/.test(w)).sort().join(' '),
    };
    docs.push(doc);
    byId.set(lesson.id, doc);
    for (const word of doc.own) {
      const list = postings.get(word);
      if (list) list.push(pos); else postings.set(word, [pos]);
      if (word.length >= PREFIX) {
        const key = word.slice(0, PREFIX);
        const words = bucketWords.get(key);
        if (words) words.add(word); else bucketWords.set(key, new Set([word]));
      }
    }
    for (const wording of scienceWordings(lesson)) {
      const key = normalizeQuestion(wording);
      if (key.length >= 4 && !exact.has(key)) exact.set(key, pos);
    }
  });

  const buckets = new Map<string, string[]>();
  for (const [key, words] of bucketWords) buckets.set(key, [...words]);

  return { docs, byId, postings, buckets, exact, fieldWords, buildMs: performance.now() - started };
}

/* ------------------------------------------ the query engine ------------------------------------------ */

export interface ScienceHit { lesson: ScienceLesson; relevance: number }

interface IndexCache { map: Map<string, ScienceHit[]> }
const CACHES = new WeakMap<ScienceIndex, IndexCache>();
const CACHE_LIMIT = 512;

/** How fast the index is working: builds, questions answered, and how many came from the LRU. */
export interface ScienceIndexStats { docs: number; words: number; buildMs: number; questions: number; cached: number }
const stats = { questions: 0, cached: 0 };
export function scienceIndexStats(index: ScienceIndex): ScienceIndexStats {
  return { docs: index.docs.length, words: index.postings.size, buildMs: Math.round(index.buildMs * 100) / 100, questions: stats.questions, cached: stats.cached };
}
export function resetScienceIndexStats() { stats.questions = 0; stats.cached = 0; }

const cacheOf = (index: ScienceIndex) => {
  let cache = CACHES.get(index);
  if (!cache) { cache = { map: new Map() }; CACHES.set(index, cache); }
  return cache;
};

/** 0…1: how much two questions say the same thing, computed on the lesson's already-indexed words. */
function diceWith(asked: Set<string>, askedDigits: string, doc: ScienceIndexDoc): number {
  if (!asked.size || !doc.question.size) return 0;
  let shared = 0;
  for (const word of asked) if (doc.question.has(word)) shared++;
  // «50 مل» is not «100 مل»: a question with numbers never matches one with other numbers (same rule as memory).
  if (askedDigits !== doc.questionDigits) return 0;
  return (2 * shared) / (asked.size + doc.question.size);
}

/** The prefixes that stand for a question word (the school's rule: from four letters, either side may start the other). */
function formsOf(index: ScienceIndex, word: string): string[] {
  if (word.length < 4) return [];
  const bucket = index.buckets.get(word.slice(0, PREFIX));
  if (!bucket) return [];
  const out: string[] = [];
  for (const candidate of bucket) {
    if (candidate === word || candidate.length < 4) continue;
    if (candidate.startsWith(word) || word.startsWith(candidate)) out.push(candidate);
  }
  return out;
}

/**
 * The lessons that answer a question, best first — the school's exact scoring formula, computed from the index.
 * `field` (the question's field) gives the field's own lessons the small bonus the school gives them.
 */
export function scienceHits(index: ScienceIndex, question: string, options: { field?: string; minRelevance?: number; limit?: number } = {}): ScienceHit[] {
  const limit = options.limit ?? index.docs.length;
  const minRelevance = options.minRelevance ?? 0;
  const key = `${options.field || '-'}|${normalizeQuestion(question)}`;
  const cache = cacheOf(index);
  stats.questions++;
  const cached = cache.map.get(key);
  if (cached) {
    stats.cached++;
    // Refresh the LRU position: the questions asked again are the ones kept.
    cache.map.delete(key); cache.map.set(key, cached);
    return cached.filter((h) => h.relevance >= minRelevance).slice(0, limit);
  }

  const asked = topicWords(question);
  const hits: ScienceHit[] = [];
  if (asked.length) {
    // The similarity score reads the question the way the school always has (it keeps words the topic filter drops).
    const askedMeaning = new Set(meaningWords(question));
    const askedDigits = [...askedMeaning].filter((w) => /\d/.test(w)).sort().join(' ');
    const forms = new Map<string, string[]>();
    // Every lesson that shares a word (or a stem of it) with the question — nothing else can score above zero.
    const candidates = new Set<number>();
    for (const word of asked) {
      for (const pos of index.postings.get(word) || []) candidates.add(pos);
      const variants = formsOf(index, word);
      forms.set(word, variants);
      for (const variant of variants) for (const pos of index.postings.get(variant) || []) candidates.add(pos);
    }
    const field = options.field as ScienceTrackId | undefined;
    for (const pos of candidates) {
      const doc = index.docs[pos]!;
      const foundIn = (word: string, set: Set<string>) => set.has(word) || (forms.get(word) || []).some((f) => set.has(f));
      const direct = asked.filter((word) => foundIn(word, doc.own));
      if (!direct.length) continue;
      const fieldWords = index.fieldWords[doc.lesson.track] || [];
      // A word of the lesson's field («نووي» for a nuclear lesson) counts half: it says the field, not the topic.
      const directSet = new Set(direct);
      const half = 0.5 * asked.filter((word) => !directSet.has(word) && fieldWords.some((stem) => hitsStem(word, stem))).length;
      const shared = direct.length + half;
      const inTitle = asked.filter((word) => foundIn(word, doc.title)).length;
      const named = asked.some((word) => foundIn(word, doc.name));
      let relevance = 0.55 * (shared / asked.length) + 0.25 * diceWith(askedMeaning, askedDigits, doc)
        + 0.15 * Math.min(1, inTitle / 2) + (named ? 0.1 : 0);
      if (field && doc.lesson.track === field) relevance += 0.1;
      // One shared word in a long question is not «about» the lesson.
      if (direct.length === 1 && asked.length >= 3 && !inTitle) relevance *= 0.5;
      if (relevance > 0) hits.push({ lesson: doc.lesson, relevance: Math.min(1, relevance) });
    }
  }
  hits.sort((a, b) => b.relevance - a.relevance || a.lesson.id.localeCompare(b.lesson.id));
  if (cache.map.size >= CACHE_LIMIT) cache.map.delete(cache.map.keys().next().value as string);
  cache.map.set(key, hits);
  return hits.filter((h) => h.relevance >= minRelevance).slice(0, limit);
}

/** The lesson a question names word-for-word (its own question, or one of the wordings the school teaches). */
export function scienceExact(index: ScienceIndex, question: string): ScienceLesson | undefined {
  const pos = index.exact.get(normalizeQuestion(question));
  return pos === undefined ? undefined : index.docs[pos]!.lesson;
}

/** How many lessons and wordings the index holds, for the panel and the benchmark (no question needed). */
export function scienceIndexSummary(index: ScienceIndex) {
  return { lessons: index.docs.length, words: index.postings.size, wordings: index.exact.size, buildMs: Math.round(index.buildMs * 100) / 100, cacheLimit: CACHE_LIMIT };
}
