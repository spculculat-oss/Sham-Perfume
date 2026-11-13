/**
 * «التحليل المنطقي والرد المنطقي» — the owner's request (2026-10-22): «اعمل انسبيكشن على شاهين وضيفله علم التحليل
 * المنطقي والرد المنطقي لان ردوده مش مظبوطة». An inspection of 40 everyday questions found answers that did not
 * answer the question: «مين اخترع الكهربا؟» got a lesson on electricity with no inventor in it, «ايه احسن عطر للصيف؟»
 * got the old answer about where to keep a perfume, a how-to got an encyclopaedia card, and a simple syllogism or
 * «فاضل كام؟» got no answer at all.
 *
 * This module is the logic every expert of «مدرسة شاهين» applies before answering:
 *   1. Analyse the question: what is asked (a person, a number, a reason, steps, yes/no, a definition…) and its core
 *      subjects (the words that are the topic, not the question's frame).
 *   2. Check every candidate answer against the question: it must cover the core subjects, and it must be the kind of
 *      answer asked for (a «مين» needs a person, a «كام» a number, a «ليه» a reason, a how-to steps, not a card).
 *   3. Lead with the sentence that answers the question («**باختصار:**»), then the explanation.
 *   4. Solve what logic alone can solve, step by step and without guessing: syllogisms (valid / invalid form, and the
 *      reminder that a valid form still needs true premises), conditionals (affirming the consequent, denying the
 *      antecedent), and small word problems («عندي 3 وأكلت واحدة فاضل كام؟»).
 * Pure and deterministic; no AI platform (rule O-10). Shared by the server, the visitor's browser and the tests.
 */
import { meaningWords, normalizeQuestion } from './shaheenMemory';
import { topicWords } from './shaheenLibrary';

// ── 1. Analyse the question ──────────────────────────────────────────────────────────────────────────────────
export type Intent = 'who' | 'when' | 'count' | 'yesno' | 'why' | 'problem' | 'howto' | 'compare' | 'define' | 'explain';

const INTENTS: [Intent, RegExp][] = [
  ['problem', /(اعمل ايه|أعمل ايه|اعمل إيه|أعمل إيه|نعمل ايه|المشكله|المشكلة|مشكله|مشكلة|بيروح بسرعه|بيروح بسرعة|what (?:should|can) i do|problem)/iu],
  ['compare', /(الفرق بين|الفرق ما بين|فرق بين|مقارنه بين|مقارنة بين|قارن بين|ولا احسن|احسن من|أحسن من|افضل من|أفضل من|ايهما|أيهما|difference between|compare|versus|\bvs\.?(?=\s|$))/iu],
  ['who', /(^|\s)(مين|من هو|من هي|من الذي|من اللي|who)(?=\s|$|[؟?])/iu],
  ['when', /(^|\s)(امتي|إمتى|امتى|متى|في اي سنه|في أي سنة|when)(?=\s|$|[؟?])/iu],
  ['count', /(^|\s)(كام|عدد|how many|how much)(?=\s|$|[؟?])/iu],
  // «ليه» is also «his» («الانسان ليه رجلين»): a reason only at the question's start or end.
  ['why', /^(?:ليه|ليش|لماذا|لم|why)(?=\s)|(?:^|\s)(?:ليه|ليش)\s*[؟?]*$|(?:^|\s)(?:لماذا|ايه السبب|إيه السبب|why)(?=\s|$|[؟?])/iu],
  ['howto', /(^|\s)(ازاي|إزاي|ازاى|كيف|طريقه|طريقة|خطوات|how)(?=\s|$|[؟?])/iu],
  ['yesno', /^(?:هل|is|are|does|do|can|should)(?=\s)|(?:^|\s)(?:يبقى|يبقي|اذن|إذن|ولا لا|ولا لأ|صح ولا غلط)(?=\s|$|[؟?])/iu],
  ['define', /(يعني ايه|يعني إيه|ما هو|ما هي|ايه هو|ايه هي|إيه هو|إيه هي|تعريف|معني|معنى|what is|what are|define|meaning of)/iu],
];
export function intentOf(question: string): Intent {
  return INTENTS.find(([, re]) => re.test(question))?.[0] || 'explain';
}

/** Words that frame a question («مين»، «كام»، «الفرق»، «أهمية») — what is asked about is the rest. */
const FRAME = new Set(['حد', 'طريقه', 'بطريقه', 'حاجه', 'حاجات', 'مين', 'كام', 'عدد', 'فرق', 'الفرق', 'بين', 'اهميه', 'فايده', 'فوايد', 'فوائد', 'دور', 'سبب', 'السبب', 'امتي', 'امتى', 'متي',
  'اعرف', 'عرفني', 'قولي', 'قولّي', 'لي', 'ليا', 'بس', 'بالظبط', 'ولا', 'لا', 'صح', 'غلط', 'يبقى', 'يبقي', 'اذن', 'اقدر', 'نقدر', 'بيحصل', 'بتحصل',
  'حصل', 'بيعمل', 'بتعمل', 'اشرحلي', 'وضحلي', 'ممكن', 'يعني', 'معناه', 'هل', 'بجد', 'فعلا', 'عامه', 'عموما', 'الي', 'اللي', 'ده', 'دي', 'who',
  'how', 'many', 'much', 'difference', 'between', 'importance', 'why', 'reason', 'many', 'tell', 'know']);
/** The question's core subjects (what it is about), without the frame words. */
export function coreSubjects(question: string): string[] {
  return topicWords(question).filter((w) => !FRAME.has(w));
}

// ── Matching words the way Arabic writes them ────────────────────────────────────────────────────────────────
/** «بيطير» / «بتطير» / «هيطير» → «طير»: the dialect's verb prefixes off (only on words long enough to keep a root). */
export function stem(word: string): string {
  let w = normalizeQuestion(word).replace(/^(وال|بال|فال|كال|لل|ال)(?=\p{L}{3,})/u, '').replace(/ة$/u, 'ه');
  w = w.replace(/^(بي|بت|بن|هي|هت|هن)(?=\p{L}{3,})/u, '');
  return w;
}
/** The consonant skeleton (long vowels and hamza seats out): «طائر» and «طيور» → «طر», «معدن» and «معادن» → «معدن». */
export function skeleton(word: string): string {
  return stem(word).replace(/[اويءئؤى]/g, '').replace(/ه$/u, '');
}
/** Two words that are the same word (inflected, plural, with or without «ال»). */
export function sameWord(a: string, b: string): boolean {
  const x = stem(a); const y = stem(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.length >= 4 && y.length >= 4 && (x.startsWith(y) || y.startsWith(x))) return true;
  const sx = skeleton(a); const sy = skeleton(b);
  if (sx.length < 2 || sy.length < 2) return false;
  if (sx === sy) return true;
  const [short, long] = sx.length <= sy.length ? [sx, sy] : [sy, sx];
  return short.length >= 2 && long.length - short.length <= 1 && long.startsWith(short) && Math.min(x.length, y.length) >= 3;
}

/** A word's readings: itself, and without a joined «و» («واكلت» → «اكلت»), and without the «ما…ش» negation. */
const variants = (w: string) => [stem(w), ...(w.length >= 5 && w.startsWith('و') ? [stem(w.slice(1))] : []), ...(/^ما?\p{L}{3,}ش$/u.test(w) ? [stem(w.replace(/^ما?/u, '').replace(/ش$/u, ''))] : [])];
export const near = (a: string, b: string) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)));
/** 0…1: how much of the question's core a text covers (the evidence must be about what was asked). */
export function coverage(core: string[], text: string): number {
  if (!core.length) return 1;
  const have = meaningWords(text).map(variants);
  const found = core.filter((c) => { const cv = variants(c); return have.some((hv) => hv.some((h) => cv.some((x) => near(h, x)))); });
  return found.length / core.length;
}

// ── 2. Does an answer fit what was asked? ────────────────────────────────────────────────────────────────────
const PERSON = /(اخترع|اكتشف|ابتكر|طور|طوّر|صمم|أسس|اسس|وضع|العالم|عالِم|المخترع|مكتشف|invent|discover|develop|founded)/u;
const NUMBER = /(\d|[٠-٩]|واحد|اتنين|اثنين|اثنان|تلات|ثلاث|اربع|أربع|خمس|ست|سبع|تمان|ثمان|تسع|عشر|مئه|مية|مائة|ألف|الف|مليون|one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand)/iu;
const REASON = /(لأن|لان|لإن|عشان|علشان|بسبب|السبب|سببه|نتيجه|نتيجة|بيخلي|بيؤدي|يؤدي|because|due to|caused|since)/iu;
const WHEN = /(\d{3,4}|سنه|سنة|قرن|القرن|عام|year|century)/iu;
export interface Candidate { kind: string; text: string; title?: string }
/** Is this the kind of answer the question asks for? (A «مين» needs a person, a «كام» a number, a «ليه» a reason…) */
export function fitsIntent(intent: Intent, c: Candidate): boolean {
  const text = `${c.title || ''} ${c.text}`;
  switch (intent) {
    case 'who': return PERSON.test(text);
    case 'when': return WHEN.test(text);
    case 'count': return NUMBER.test(text);
    case 'why': return REASON.test(text);
    // Steps or a fix, not an encyclopaedia card about one material.
    case 'howto': case 'problem': return c.kind !== 'material';
    default: return true;
  }
}
/** Questions where a wrong kind of answer is no answer at all (better say «مش متأكد» than answer beside the point). */
export const STRICT_INTENT: ReadonlySet<Intent> = new Set(['who', 'when', 'count']);

/** The sentence of a text that answers the question best (the lead line «باختصار»). */
export function keySentence(text: string, question: string): string | undefined {
  const core = coreSubjects(question);
  const intent = intentOf(question);
  const plain = text.replace(/\*\*|__|#+\s*/g, '').replace(/^\s*[-•*]\s*/gm, '');
  const sentences = plain.split(/(?<=[.!؟?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length >= 25 && s.length <= 320);
  if (sentences.length < 3) return undefined;
  const scored = sentences.map((s, i) => ({ s, i, v: coverage(core, s) + (fitsIntent(intent, { kind: 'text', text: s }) && intent !== 'explain' && intent !== 'define' ? 0.6 : 0) - i * 0.01 }));
  const best = scored.sort((a, b) => b.v - a.v)[0];
  // The text already opens with its answer: no lead needed.
  if (!best || best.i === 0 || best.v < 0.5) return undefined;
  return best.s.replace(/[.،,]+$/, '');
}

// ── 4. What logic alone can solve ────────────────────────────────────────────────────────────────────────────
export interface Reasoned {
  kind: 'syllogism-valid' | 'syllogism-invalid' | 'modus-ponens' | 'modus-tollens' | 'affirming-consequent' | 'denying-antecedent' | 'arithmetic';
  answer: string;
  steps: string[];
}

const clean = (q: string) => normalizeQuestion(q).replace(/[؟?!]+/g, ' ').replace(/\s+/g, ' ').trim();
const MARKER = /\s(?:يبقى|يبقي|اذن|فهل|هل|يعني|معناه|معني كده|معنى كده|بالتالي|then|so)\s/u;
const LEAD = /^(?:لو|اذا|طب لو|طيب لو|افترض ان|افترض|if)\s+/u;
const NEG = /(^|\s)(مش|مو|ما|مفيش|لا|ليس|مابي|مابت|not|no)(\s|$)|(^|\s)ما?\S{3,}ش(\s|$)/u;
const wordsOf = (s: string) => s.split(/\s+/).filter((w) => w && !/^(و|ف|كان|كانت|اكيد|فعلا|برضه|بقي|بقى)$/.test(w));
const dropAl = (w: string) => w.replace(/^(وال|بال|فال|ال)(?=\p{L}{2,})/u, '').replace(/^و(?=ال)/u, '');
/** «كل الطيور بتطير» → { all: طيور, pred: [بتطير] }. */
function universal(clause: string): { all: string; raw: string; pred: string[] } | undefined {
  const w = wordsOf(clause.replace(LEAD, ''));
  if (w[0] !== 'كل' || w.length < 3) return undefined;
  return { all: dropAl(w[1]), raw: w[1], pred: w.slice(2) };
}
/** Two predicates say the same thing when they share a real word («ليها رجلين» / «ليه رجلين», «بتوصل الكهربا» / «بيوصل»). */
const predMatches = (a: string[], b: string[]) => a.some((x) => stem(x).length >= 3 && b.some((y) => sameWord(x, y)));
/** Breaks «لو كل A B والـC D يبقى C E» into its three statements. */
function threeClauses(q: string): string[] | undefined {
  const marked = q.replace(LEAD, '').replace(/\s*[،,؛;]\s*/g, ' | ').replace(MARKER, ' | ').replace(/\s(?=وال\p{L})/gu, ' | ').replace(/\s+و\s+/g, ' | ');
  const parts = marked.split('|').map((s) => s.trim().replace(/^و(?=ال)/u, '')).filter(Boolean);
  return parts.length === 3 ? parts : undefined;
}
const TOO_GENERAL: [string, string, string][] = [
  ['طيور', 'طير', 'البطريق والنعام طيور ومع ذلك مش بتطير، فالمقدمة «كل الطيور بتطير» نفسها غلط'],
];
function syllogism(q: string, ar: boolean): Reasoned | undefined {
  const parts = threeClauses(q);
  if (!parts) return undefined;
  const major = universal(parts[0]);
  if (!major) return undefined;
  const minor = wordsOf(parts[1]); const concl = wordsOf(parts[2]);
  if (minor.length < 2 || concl.length < 1) return undefined;
  const subject = dropAl(minor[0]); const middle = minor.slice(1);
  // The conclusion speaks about the same subject («البطريق … البطريق بيطير»), or leaves it out («… بيطير؟»).
  const conclPred = sameWord(concl[0], subject) ? concl.slice(1) : concl;
  if (!conclPred.length) return undefined;
  const minorIsA = middle.some((w) => sameWord(w, major.all));
  const minorHasB = predMatches(middle, major.pred);
  const conclIsB = predMatches(conclPred, major.pred);
  const conclIsA = conclPred.some((w) => sameWord(w, major.all));
  const A = major.raw; const B = major.pred.join(' '); const C = minor[0];
  const said = sameWord(concl[0], subject) ? parts[2] : `${C} ${parts[2]}`;
  if (minorIsA && conclIsB) {
    const wrong = TOO_GENERAL.find(([a, b]) => sameWord(major.all, a) && sameWord(major.pred[0], b));
    const steps = [`المقدمة الكبرى: كل ${A} ${B}`, `المقدمة الصغرى: ${C} من ${A}`, `النتيجة: ${said}`];
    const answer = ar
      ? `**من ناحية الشكل المنطقي: أيوه، النتيجة صحيحة الاستنتاج.** لو «كل ${A} ${B}» و«${C} من ${A}»، يبقى لازم «${said}».\n\n**بس خلي بالك:** الحجة السليمة الشكل نتيجتها مضمونة بس لو المقدمات نفسها صح في الواقع.${wrong ? ` وهنا ${wrong[2]}؛ عشان كده النتيجة غلط في الواقع رغم إن الاستدلال سليم.` : ' فاتأكد إن «كل» دي فعلاً مفيهاش استثناء؛ استثناء واحد يكفي يبطّل النتيجة.'}\n\n**الخطوات:**\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
      : `**Formally, yes: the conclusion follows.** If all ${A} are ${B} and ${C} is a ${A}, then ${C} is ${B}.\n\n**But** a valid form only guarantees the conclusion when the premises are true${wrong ? ' — and here they are not: penguins and ostriches are birds that cannot fly' : '; one exception to «all» breaks it'}.`;
    return { kind: 'syllogism-valid', answer, steps };
  }
  if (minorHasB && conclIsA) {
    const steps = [`المقدمة الكبرى: كل ${A} ${B}`, `المقدمة الصغرى: ${C} ${middle.join(' ')}`, `النتيجة المقترحة: ${C} من ${A} — مش لازمة`];
    const answer = ar
      ? `**لأ، النتيجة مش لازمة منطقياً.** «كل ${A} ${B}» معناها إن ${A} جزء من اللي ${B}، مش إن كل اللي ${B} هو ${A}. فإن «${C}» يشارك ${A} في الصفة دي ما يثبتش إنه منهم — زي «كل القطط ليها عينين، والإنسان له عينين» ما يخليش الإنسان قطة.\n\nالغلطة دي اسمها **«الحد الأوسط غير المستغرق»**: الصفة المشتركة لوحدها مش دليل على نفس النوع.\n\n**الخطوات:**\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
      : `**No, it does not follow.** «All ${A} are ${B}» does not say everything ${B} is a ${A}; sharing a property does not make ${C} a ${A} (the fallacy of the undistributed middle).`;
    return { kind: 'syllogism-invalid', answer, steps };
  }
  return undefined;
}

/** «لو P (يبقى) Q، Q' يبقى P'؟» → which of the four forms it is. */
function conditional(q: string, ar: boolean): Reasoned | undefined {
  if (!LEAD.test(q)) return undefined;
  const segs = q.replace(LEAD, '').split(/\s*[،,؛;.]\s*/).filter(Boolean);
  if (segs.length < 2) return undefined;
  const rule = wordsOf(segs[0].replace(/\s(?:يبقى|يبقي|فان|then)\s/u, ' ')).map(dropAl);
  const rest = segs.slice(1).join(' ');
  const m = rest.match(new RegExp(`^(.*?)${MARKER.source}(.*)$`, 'u'));
  if (!m) return undefined;
  const fact = m[1].replace(/^و/u, '').trim(); const asked = m[2].trim();
  if (!fact || !asked || rule.length < 2) return undefined;
  const pos = (s: string) => wordsOf(s).map(dropAl).flatMap((w) => { const i = rule.findIndex((r) => variants(w).some((v) => sameWord(r, v))); return i >= 0 ? [i] : []; });
  const pf = pos(fact); const pa = pos(asked);
  if (!pf.length || !pa.length) return undefined;
  const factLate = Math.min(...pf) > Math.max(...pa); // the fact is the rule's second half (Q), the question its first (P)
  const factEarly = Math.max(...pf) < Math.min(...pa);
  if (!factLate && !factEarly) return undefined;
  const negFact = NEG.test(fact);
  const head = segs[0].replace(/\s(?:يبقى|يبقي)\s/u, ' ');
  const kind: Reasoned['kind'] = factLate ? (negFact ? 'modus-tollens' : 'affirming-consequent') : (negFact ? 'denying-antecedent' : 'modus-ponens');
  const steps = [`القاعدة: لو ${head}`, `المعطى: ${fact}`, `السؤال: ${asked}`];
  const texts: Record<Reasoned['kind'], [string, string]> = {
    'affirming-consequent': [
      `**مش لازم.** القاعدة بتقول إن الأولى لو حصلت التانية تحصل، لكن ما بتقولش إنها السبب الوحيد للتانية. حصول «${fact}» ممكن يكون لسبب تاني خالص.\n\nالغلطة دي اسمها **«تأكيد التالي»**: من «لو أ يبقى ب» و«ب حصلت» ما ينفعش نستنتج «أ حصلت». مثال: لو مطرت الأرض تتبل، بس الأرض ممكن تتبل من رشاش ميه.`,
      `**Not necessarily** — that is affirming the consequent: «if A then B» and «B» do not prove «A»; B may have another cause.`],
    'modus-tollens': [
      `**أيوه، الاستنتاج سليم بشرط القاعدة تكون صح.** لو الأولى كانت حصلت كانت التانية لازم تحصل، والتانية ما حصلتش، يبقى الأولى ما حصلتش. ده اسمه **«نفي التالي»** وهو صيغة صحيحة.`,
      `**Yes, if the rule holds** — denying the consequent («if A then B», «not B», so «not A») is valid.`],
    'denying-antecedent': [
      `**مش لازم.** القاعدة بتقول إيه اللي يحصل لو الأولى حصلت، لكن ما بتقولش إيه اللي يحصل لو ما حصلتش؛ التانية ممكن تحصل لسبب تاني.\n\nالغلطة دي اسمها **«نفي المقدم»**: من «لو أ يبقى ب» و«أ ما حصلتش» ما ينفعش نستنتج «ب ما حصلتش».`,
      `**Not necessarily** — that is denying the antecedent: «if A then B» and «not A» do not prove «not B».`],
    'modus-ponens': [
      `**أيوه، بشرط القاعدة تكون صح.** القاعدة بتقول لو الأولى حصلت التانية تحصل، والأولى حصلت فعلاً، يبقى التانية لازم تحصل. ده اسمه **«إثبات المقدم»** وهو صيغة صحيحة.`,
      `**Yes, if the rule holds** — affirming the antecedent («if A then B», «A», so «B») is valid.`],
    'syllogism-valid': ['', ''], 'syllogism-invalid': ['', ''], arithmetic: ['', ''],
  };
  const body = texts[kind][ar ? 0 : 1];
  return { kind, steps, answer: ar ? `${body}\n\n**الخطوات:**\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}` : body };
}

// Small word problems: «عندي 3 تفاحات وأكلت واحدة فاضل كام؟»
const NUM_WORDS: Record<string, number> = {
  واحد: 1, واحده: 1, وحده: 1, اتنين: 2, اثنين: 2, اثنان: 2, تلاته: 3, ثلاثه: 3, تلات: 3, ثلاث: 3, اربعه: 4, اربع: 4, خمسه: 5, خمس: 5,
  سته: 6, ست: 6, سبعه: 7, سبع: 7, تمانيه: 8, ثمانيه: 8, تمان: 8, ثمان: 8, تسعه: 9, تسع: 9, عشره: 10, عشر: 10, نص: 0.5, نصها: NaN,
};
const SUB = /^(?:و)?(?:اكلت|كلت|اديت|اعطيت|ادي|ضاع|ضاعت|ضيعت|بعت|صرفت|شربت|دفعت|خسرت|وقع|وقعت|اتكسر|اتكسرت|رميت|سلفت|استخدمت|طلع|خرج|خرجت|اخدوا|خدوا|اخد|خد)(?:\s|$)/u;
const ADD = /^(?:و)?(?:اشتريت|جالي|جاتلي|خدت|اخدت|كسبت|لقيت|اداني|ادوني|جابلي|زودت|زاد|دخل|دخلت|وصلني|ضفت|اضفت)(?:\s|$)/u;
const MONEY = /^(?:جنيه|جنيهات|ريال|دولار|درهم|دينار|ليره|فلوس|pound|dollar)/u;
const ASKS_LEFT = /(فاضل|فضل|باقي|بقي معايا|بقى معايا|يبقي معايا|يبقى معايا|يبقي عندي|يبقى عندي|بقي عندي|بقى عندي|معايا كام|عندي كام|كام دلوقتي|how many (?:are )?left|left)/u;
function numberAt(words: string[], i: number): number | undefined {
  const w = words[i];
  if (w === undefined) return undefined;
  if (/^\d+(?:\.\d+)?$/.test(w)) return Number(w);
  const n = NUM_WORDS[w.replace(/ة$/u, 'ه')];
  return Number.isFinite(n) ? n : undefined;
}
function arithmetic(q: string, ar: boolean): Reasoned | undefined {
  if (!ASKS_LEFT.test(q)) return undefined;
  const words = q.replace(/(\d)([^\d\s.])/g, '$1 $2').split(/\s+/);
  const start = words.findIndex((w) => /^(عندي|معايا|معي|كان|لدي|have)$/.test(w));
  if (start < 0) return undefined;
  let i = start + 1;
  while (i < words.length && numberAt(words, i) === undefined && i < start + 3) i++;
  let total = numberAt(words, i);
  if (total === undefined) return undefined;
  const item = words[i + 1] && !SUB.test(words[i + 1]) && !ADD.test(words[i + 1]) && numberAt(words, i + 1) === undefined ? words[i + 1].replace(/^و/u, '') : '';
  const steps = [`البداية: ${total}${item ? ` ${item}` : ''}`];
  let ops = 0;
  for (let j = i + 1; j < words.length; j++) {
    const phrase = words.slice(j).join(' ');
    const sign = SUB.test(phrase) ? -1 : ADD.test(phrase) ? 1 : 0;
    if (!sign) continue;
    // The amount right after the verb («أكلت واحدة»، «أكلت منهم 2»).
    // «اشتريت بـ4» spends money: buying adds things, paying for them takes money away.
    const pays = sign > 0 && /^(?:و)?(?:اشتريت|ضفت)$/u.test(words[j]) && (/^بـ?$/u.test(words[j + 1] || '') || MONEY.test(item) || /^ب\d/u.test(words[j + 1] || ''));
    let k = j + 1; let n: number | undefined;
    while (k < words.length && k <= j + 3 && (n = numberAt(words, k)) === undefined) k++;
    if (n === undefined) return undefined; // «أكلت شوية»: no number, no guess
    const s = pays ? -1 : sign;
    total += s * n; ops++;
    steps.push(`${s < 0 ? 'ناقص' : 'زائد'} ${n} ← ${total}`);
    j = k;
  }
  if (!ops || total < 0 || !Number.isFinite(total)) return undefined;
  const answer = ar
    ? `**فاضل معاك ${total}${item ? ` ${item.replace(/ات$/u, total === 1 ? 'ه' : 'ات')}` : ''}.**\n\n**الحساب خطوة بخطوة:**\n${steps.map((s, n) => `${n + 1}. ${s}`).join('\n')}`
    : `**${total} left.**\n\n${steps.join(' → ')}`;
  return { kind: 'arithmetic', answer, steps };
}

/** What logic alone answers, step by step; undefined when the question is not one of these forms (no guessing). */
export function reason(question: string, lang = 'ar'): Reasoned | undefined {
  const q = clean(question);
  if (q.length < 8 || q.length > 400) return undefined;
  const ar = lang === 'ar' || lang === 'fa' || /[\u0600-\u06FF]/.test(question);
  return arithmetic(q, ar) || syllogism(q, ar) || conditional(q, ar);
}
