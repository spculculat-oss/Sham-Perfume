/**
 * «باحث شاهين» — a new question nobody taught him: Shaheen looks it up on the open web, reads the pages he finds,
 * keeps the passages that answer it, compares them (what several sources agree on comes first) and answers from
 * them, with the sources listed under the answer.
 *
 * The source is Wikipedia's official public API (free, no key, no account, made for programs; text under CC BY-SA,
 * so every answer names and links its articles). Search-engine result pages (Google…) are not scraped: their terms
 * forbid it and they block robots.
 * Time-bound (news, prices) and personal questions are never looked up.
 * Pure (fetch is injected): used by the server (server/shaheen.ts), the visitor's browser on GitHub Pages
 * (src/utils/browserMemory.ts) and «مدرسة شاهين», whose local teacher turns the findings into a lesson.
 */
import { greetingKind } from './shaheenGreeting';
import { topicWords } from './shaheenLibrary';
import { isPersonal, isTimeBound, meaningWords, normalizeQuestion } from './shaheenMemory';

export interface WebSource { title: string; url: string; site: 'wikipedia'; lang: string }
export interface WebPassage { text: string; source: WebSource; score: number; matched: number; agreed: number }
export interface Research { question: string; lang: string; query: string; sources: WebSource[]; passages: WebPassage[] }
type Fetch = (input: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<Response>;

/** Wikimedia asks programs to say who they are (servers only: browsers cannot set this header). */
export const RESEARCH_USER_AGENT = 'ShamPerfumeShaheen/1.0 (https://spculculat-oss.github.io/Sham-Perfume/; s.p.culculat@gmail.com)';
const WIKI_LANGS = new Set(['ar', 'en', 'fr', 'de', 'es', 'it', 'tr', 'ru', 'zh', 'ja', 'pt', 'fa', 'ur', 'id', 'ms', 'hi']);
/** The sections at the end of an article that never answer anything. */
const TAIL = /^(مراجع|المراجع|المصادر|مصادر|انظر أيضا|انظر أيضًا|وصلات خارجية|روابط خارجية|ملاحظات|قراءات إضافية|References|See also|External links|Notes|Further reading|Bibliography|Sources)\s*$/m;
const CONTEXT: Record<string, string> = { ar: 'عطور', en: 'perfume' };
const SCENT = /عطر|عطور|رائح|بخور|perfum|fragran|scent|odou?r|aroma|parfum/i;

const clip = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1).replace(/\s+\S*$/, '')}…`);
const wikiLang = (lang: string) => (WIKI_LANGS.has(lang) ? lang : 'en');
export const articleUrl = (lang: string, title: string) => `https://${wikiLang(lang)}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_')).replace(/\(/g, '%28').replace(/\)/g, '%29')}`;

/** Egyptian present-tense verbs («بيتعمل», «وبتتحط») say nothing about the topic. */
const DIALECT_VERB = /^و?(بي|بت)(ت|ن)?\p{L}{3,}$/u;
/** The words that say what the question is about. */
export const researchWords = (question: string) => topicWords(question).filter((w) => w.length >= 2 && !DIALECT_VERB.test(w));

/** The searches to try, most precise first; undefined when the question cannot or must not be looked up. */
export function researchQueries(question: string, lang: string): string[] | undefined {
  if (greetingKind(question) || isTimeBound(question) || isPersonal(question) || normalizeQuestion(question).length < 4) return undefined;
  const words = researchWords(question).filter((w) => w.length >= 3).slice(0, 4);
  if (!words.length) return undefined;
  const context = CONTEXT[lang];
  const tries = [
    words.join(' '),
    context && !words.some((w) => w.startsWith(context.slice(0, 3))) ? [...words, context].join(' ') : '',
    words.length > 2 ? words.slice(0, 2).join(' ') : '',
  ];
  return [...new Set(tries.filter(Boolean))];
}

async function getJson(fetchFn: Fetch, url: string, signal?: AbortSignal, userAgent?: string): Promise<unknown> {
  const response = await fetchFn(url, { headers: userAgent ? { 'User-Agent': userAgent, 'Api-User-Agent': userAgent } : undefined, signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/** Titles of the articles Wikipedia's own search finds (official API, CORS-open: works from a browser too). */
export async function wikiSearch(fetchFn: Fetch, query: string, lang: string, limit = 3, signal?: AbortSignal, userAgent?: string): Promise<string[]> {
  return (await wikiSearchInfo(fetchFn, query, lang, limit, signal, userAgent)).titles;
}
/** The titles, and Wikipedia's own spelling suggestion («هل تقصد») when the words look mistyped. */
export async function wikiSearchInfo(fetchFn: Fetch, query: string, lang: string, limit = 3, signal?: AbortSignal, userAgent?: string): Promise<{ titles: string[]; suggestion?: string }> {
  const url = `https://${wikiLang(lang)}.wikipedia.org/w/api.php?action=query&list=search&format=json&formatversion=2&origin=*&utf8=1&srprop=&srinfo=suggestion&srlimit=${limit}&srsearch=${encodeURIComponent(query)}`;
  const data = await getJson(fetchFn, url, signal, userAgent) as { query?: { search?: { title?: unknown }[]; searchinfo?: { suggestion?: unknown } } };
  const suggestion = data.query?.searchinfo?.suggestion;
  return {
    titles: (data.query?.search || []).map((r) => r.title).filter((t): t is string => typeof t === 'string'),
    suggestion: typeof suggestion === 'string' && suggestion.trim() && normalizeQuestion(suggestion) !== normalizeQuestion(query) ? suggestion.trim() : undefined,
  };
}

/** An article's plain text, without its references and link sections. */
export async function wikiText(fetchFn: Fetch, title: string, lang: string, signal?: AbortSignal, userAgent?: string): Promise<string> {
  const url = `https://${wikiLang(lang)}.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exsectionformat=plain&redirects=1&format=json&formatversion=2&origin=*&titles=${encodeURIComponent(title)}`;
  const data = await getJson(fetchFn, url, signal, userAgent) as { query?: { pages?: { extract?: unknown }[] } };
  const text = String(data.query?.pages?.[0]?.extract || '');
  const tail = text.search(TAIL);
  return (tail > 0 ? text.slice(0, tail) : text).slice(0, 30_000);
}

/** The sentences of a text that talk about the question's topic, scored by how many of its words they carry. */
export function findPassages(text: string, words: string[], source: WebSource): WebPassage[] {
  const asked = new Set(words);
  const out: WebPassage[] = [];
  for (const raw of text.split(/\n+|(?<=[.!؟?])\s+/)) {
    // Pronunciation brackets emptied by the plain-text export («Ambergris ( or ; Latin: …») are tidied.
    const sentence = raw.replace(/\s+/g, ' ').replace(/\(\s*(?:or\s*)?[;,]\s*/g, '(').replace(/\(\s*\)/g, '').trim();
    // Headings, list stubs and run-on blocks are not answers.
    if (sentence.length < 40 || sentence.length > 600 || !/[.!؟?:،,]/.test(sentence)) continue;
    const has = new Set(meaningWords(sentence));
    const matched = [...asked].filter((w) => has.has(w)).length;
    if (!matched) continue;
    out.push({ text: sentence, source, matched, agreed: 1, score: matched / asked.size + (sentence.length >= 70 && sentence.length <= 320 ? 0.05 : 0) });
  }
  return out;
}

const overlap = (a: string, b: string) => {
  const x = meaningWords(a); const y = new Set(meaningWords(b));
  return x.length ? x.filter((w) => y.has(w)).length / Math.max(x.length, y.size) : 0;
};

/**
 * The analysis: the best passages across all the sources, one idea each (near-duplicates merged), a passage that
 * other sources confirm (same topic words in their text) ranked higher. Only passages about the question are kept.
 */
export function analyse(texts: { source: WebSource; text: string }[], question: string, max = 4, topic?: string[]): WebPassage[] {
  const words = topic?.length ? topic : researchWords(question);
  if (!words.length) return [];
  const needed = Math.max(1, Math.ceil(Math.min(words.length, 4) / 2));
  const all = texts.flatMap((t) => findPassages(t.text, words, t.source)).filter((p) => p.matched >= needed);
  // Confirmed = another source says much the same thing (shares most of the passage's words).
  for (const p of all) {
    const others = new Set(all.filter((q) => q.source.url !== p.source.url && overlap(p.text, q.text) >= 0.45).map((q) => q.source.url));
    p.agreed = 1 + others.size;
    p.score += 0.25 * others.size;
  }
  const picked: WebPassage[] = [];
  for (const p of all.sort((a, b) => b.score - a.score)) {
    if (picked.length >= max) break;
    if (picked.some((q) => overlap(p.text, q.text) >= 0.6)) continue;
    picked.push(p);
  }
  return picked;
}

/** Look the question up: search, read the top articles, analyse. Undefined when nothing solid was found. */
export async function research(fetchFn: Fetch, question: string, lang: string, options: { articles?: number; timeoutMs?: number; userAgent?: string } = {}): Promise<Research | undefined> {
  const queries = researchQueries(question, lang);
  if (!queries) return undefined;
  const signal = AbortSignal.timeout(options.timeoutMs ?? 9000);
  // The plain search and the one in the perfume context, merged: an article named after the topic first.
  const max = options.articles ?? 3;
  let words = researchWords(question);
  const found: string[] = []; let query = ''; let suggestion: string | undefined;
  for (const q of queries) {
    const hits = await wikiSearchInfo(fetchFn, q, lang, max, signal, options.userAgent).catch(() => ({ titles: [] as string[], suggestion: undefined }));
    suggestion ??= hits.suggestion;
    if (hits.titles.length && !query) query = q;
    for (const t of hits.titles) if (!found.includes(t)) found.push(t);
    if (found.length >= max * 2) break;
  }
  let named = (t: string) => meaningWords(t).some((w) => words.includes(w));
  // A mistyped word («زهره وتس»): no article is named after it, and Wikipedia suggests the spelling it knows —
  // he searches that, and reads the articles with the suggested words.
  if (suggestion && !found.some(named)) {
    const fixed = researchWords(suggestion);
    const hits = fixed.length ? await wikiSearch(fetchFn, suggestion, lang, max, signal, options.userAgent).catch(() => []) : [];
    if (hits.length) {
      words = [...new Set([...fixed, ...words])];
      named = (t: string) => meaningWords(t).some((w) => fixed.includes(w));
      found.unshift(...hits.filter((t) => !found.includes(t)));
      query = suggestion;
    }
  }
  const titles = [...found.filter(named), ...found.filter((t) => !named(t))].slice(0, max);
  if (!titles.length) return undefined;
  const texts = (await Promise.all(titles.map(async (title) => {
    const text = await wikiText(fetchFn, title, lang, signal, options.userAgent).catch(() => '');
    return text ? { source: { title, url: articleUrl(lang, title), site: 'wikipedia' as const, lang: wikiLang(lang) }, text } : undefined;
  }))).filter((t): t is { source: WebSource; text: string } => Boolean(t));
  // Shaheen's field is perfume: an article that never mentions scent («عود» the instrument) is left out — unless none does.
  const scented = texts.filter((t) => SCENT.test(t.text));
  const passages = analyse(scented.length ? scented : texts, question, 4, query === suggestion ? researchWords(suggestion!) : undefined);
  if (!passages.length) return undefined;
  const used = new Set(passages.map((p) => p.source.url));
  return { question, lang, query, sources: texts.map((t) => t.source).filter((s) => used.has(s.url)), passages };
}

/** The visitor's answer: the findings as points (confirmed ones marked), the sources, and an honest note. */
export function researchAnswer(r: Research, options: { recorded?: boolean } = {}): string {
  const ar = r.lang === 'ar';
  const head = ar ? '🔎 **بحثت لك في المصادر المفتوحة على الإنترنت، ودي خلاصة اللي لقيته:**' : '🔎 **I looked this up in open sources online; here is what I found:**';
  const confirmed = ar ? ' _(أكتر من مصدر بيأكدها)_' : ' _(confirmed by more than one source)_';
  const points = r.passages.map((p) => `• ${clip(p.text, 420)}${p.agreed > 1 ? confirmed : ''}`).join('\n');
  const sources = r.sources.map((s) => `[${ar ? 'ويكيبيديا' : 'Wikipedia'}: ${s.title}](${s.url})`).join(' · ');
  const note = ar
    ? `\n\n_المعلومات دي متجمعة تلقائيًا من مصادر عامة (ويكيبيديا، رخصة CC BY-SA) ومش مراجعة من خبير — اتأكد منها قبل ما تعتمد عليها.${options.recorded ? ' سؤالك اتسجل عشان أذاكره وأرد عليه أحسن المرة الجاية.' : ''}_`
    : `\n\n_Collected automatically from open sources (Wikipedia, CC BY-SA), not reviewed by an expert — please double-check.${options.recorded ? ' Your question was noted so he studies it for next time.' : ''}_`;
  return `${head}\n\n${points}\n\n${ar ? '**المصادر:**' : '**Sources:**'} ${sources}${note}`;
}

/** For the school's teacher: the findings as references, bounded. */
export function researchBlock(r: Research | undefined, max = 1800): string {
  if (!r) return '';
  let out = '';
  for (const p of r.passages) {
    const piece = `\n— ${p.source.title} (ويكيبيديا):\n${clip(p.text, 500)}\n`;
    if (out.length + piece.length > max) break;
    out += piece;
  }
  return out;
}
