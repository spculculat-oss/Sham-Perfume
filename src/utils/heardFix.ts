/**
 * «شاهين يصحح اللي اتسمع غلط» — before Shaheen answers a spoken question he reads the whole sentence again:
 *   - the speech engine offers a few readings of what was said; the one made of words that make sense wins;
 *   - a word that makes no sense here is replaced by the closest sensible word, comparing how words SOUND
 *     (ص/س، ض/د، ق/أ، ذ/ز… — the letters speech engines mix up, Egyptian «ق» heard as «أ»);
 *   - corrections visitors confirmed and the AI platforms made before (learned pairs) are applied at once;
 *   - when he is not sure about a word that matters (a perfume word), he asks first: «قصدك «عود»؟».
 * Also: «استنى شوية هدخل أشوف البيانات» — the short line he says while he really looks something up.
 * Pure (no DOM, no Node): used by the voice hook in the browser and by tests.
 */
import type { SupportedLanguage } from '../types/i18n';
import { baseLexicon, SCENT_WORDS, wordKey, type Lexicon } from './shaheenSpelling';
import type { Dialect } from './arabicDialect';

export interface HeardFix { from: string; to: string; sure: boolean }
export interface HeardReading {
  /** The sentence with the sure corrections applied. */
  text: string;
  fixes: HeardFix[];
  /** A word that matters and could be wrong: ask the visitor before answering. */
  ask?: { from: string; to: string; corrected: string };
}

/** Letters that sound alike to a speech engine (each group costs little to swap). */
const SOUND_ALIKE = ['نم', 'سصث', 'تطث', 'دضظذ', 'زذظ', 'قأءاعكإآ', 'هحخة', 'جغق', 'يىئ', 'وؤ', 'فڤ'];
const alike = (a: string, b: string) => SOUND_ALIKE.some((group) => group.includes(a) && group.includes(b));

/** Edit distance where a sound-alike swap costs 0.4 (a missing/extra/other letter costs 1). */
export function heardDistance(a: string, b: string): number {
  const n = a.length; const m = b.length;
  const d: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      // «فانيلية» / «فانيليا»: a word's last «ة» is said as «ا».
      const ending = i === n && j === m && 'ها'.includes(a[i - 1]!) && 'ها'.includes(b[j - 1]!);
      const sub = a[i - 1] === b[j - 1] ? 0 : alike(a[i - 1]!, b[j - 1]!) || ending ? 0.4 : 1;
      // A doubled letter heard once (or once heard twice) is a light slip («vanila» / «vanilla»).
      const del = a[i - 1] === a[i - 2] || a[i - 1] === b[j - 1] ? 0.4 : 1;
      const ins = b[j - 1] === b[j - 2] || b[j - 1] === a[i - 1] ? 0.4 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + del, d[i]![j - 1]! + ins, d[i - 1]![j - 1]! + sub);
    }
  }
  return d[n]![m]!;
}

const SCENT_KEYS = new Set(SCENT_WORDS.map((word) => wordKey(word)));
/** Everyday spellings of perfume talk that are right as they are (never «corrected» or asked about). */
const SPOKEN_FORMS = new Set(['برفان', 'بارفيوم', 'بيرفيوم', 'برفيوم', 'بريفيوم', 'ريحه', 'ريحتها', 'ريحته', 'هديه', 'بخاخه', 'ازازه', 'قزازه', 'تستر', 'سامبل']
  .map((word) => wordKey(word)));
const DIALECT_VERB = /^و?(بي|بت|بن|هي|هت|هن|حي|حت|عم)\p{L}{2,}$/u;
const ARTICLE = /^(وال|بال|فال|كال|لل|ال)(?=\p{L}{2,})/u;

/** How sensible a reading is: the share of its words he knows (learned corrections count as known). */
function sense(text: string, lex: Lexicon, learned: Record<string, string>, context: ReadonlySet<string> = NO_CONTEXT): number {
  const keys = text.split(/\s+/).map(wordKey).filter((key) => key.length >= 2);
  if (!keys.length) return 0;
  // The same word twice in a row («عطر عطر») is an echo of the engine, not sense.
  const echoes = keys.filter((key, i) => i > 0 && keys[i - 1] === key).length;
  return (keys.filter((key) => lex.words.has(key) || learned[key] || context.has(key)).length - echoes) / keys.length;
}

const NO_CONTEXT: ReadonlySet<string> = new Set();
/** The words of the conversation so far (his last reply, the visitor's last sentences), as word keys. */
export function contextWords(texts: readonly string[]): Set<string> {
  const keys = new Set<string>();
  for (const text of texts) for (const word of text.split(/[^\p{L}\p{M}]+/u)) { const key = wordKey(word); if (key.length >= 3) keys.add(key); }
  return keys;
}

/**
 * The closest sensible word to a heard one, with how far it is and whether it is the only one that close. A word
 * said in the conversation just now (by Shaheen or the visitor) is the likelier meaning: it wins a tie.
 */
function nearest(lex: Lexicon, key: string, context: ReadonlySet<string> = NO_CONTEXT): { word: string; distance: number; unique: boolean; scent: boolean; context: boolean; weight: number } | undefined {
  let best: { word: string; distance: number; weight: number }[] = [];
  const consider = (word: string) => {
    if (word.length < 3) return;
    const distance = heardDistance(key, word);
    if (distance > 1) return;
    const weight = (lex.words.get(word) || 0) + (context.has(word) ? 1000 : 0);
    if (!best.length || distance < best[0]!.distance - 1e-9) best = [{ word, distance, weight }];
    else if (Math.abs(distance - best[0]!.distance) < 1e-9 && !best.some((b) => b.word === word)) best.push({ word, distance, weight });
  };
  for (let len = key.length - 1; len <= key.length + 1; len += 1) for (const word of lex.byLength.get(len) || []) consider(word);
  for (const word of context) if (Math.abs(word.length - key.length) <= 1 && !lex.words.has(word)) consider(word);
  if (!best.length) return undefined;
  best.sort((x, y) => y.weight - x.weight);
  const inContext = best.filter((b) => context.has(b.word)).length;
  const top = best[0]!;
  return { word: top.word, distance: top.distance, weight: top.weight, scent: SCENT_KEYS.has(top.word), context: context.has(top.word),
    unique: best.length === 1 || (context.has(top.word) && inContext === 1) };
}

/**
 * The sentence as Shaheen understands it. `alternatives` = the engine's other readings (best first);
 * `learned` = heard word key → meant word (confirmed by visitors or fixed by the AI platforms before).
 */
export function fixHeard(heard: string, { alternatives = [], learned = {}, lexicon = baseLexicon(), context = NO_CONTEXT }: {
  alternatives?: readonly string[]; learned?: Record<string, string>; lexicon?: Lexicon;
  /** «التخمين من سياق الكلام»: words of the conversation just now (see contextWords). */
  context?: ReadonlySet<string>;
} = {}): HeardReading {
  const readings = [heard, ...alternatives].map((reading) => reading.replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (!readings.length) return { text: '', fixes: [] };
  // The reading that makes the most sense (ties keep the engine's own order).
  let chosen = readings[0]!;
  let chosenSense = sense(chosen, lexicon, learned, context);
  for (const reading of readings.slice(1)) {
    const value = sense(reading, lexicon, learned, context);
    if (value > chosenSense + 0.15) { chosen = reading; chosenSense = value; }
  }
  const fixes: HeardFix[] = [];
  let ask: HeardReading['ask'];
  const parts = chosen.split(' ');
  const out = parts.map((part, index) => {
    const match = part.match(/^([^\p{L}]*)(\p{L}+)([^\p{L}]*)$/u);
    if (!match) return part;
    const word = match[2]!;
    const key = wordKey(word);
    if (key.length < 3 || lexicon.words.has(key) || context.has(key) || SPOKEN_FORMS.has(key) || DIALECT_VERB.test(key) || (/^[a-z]+$/i.test(key) && key.length < 5)) return part;
    // «وفانيلية»: the «و» of «and» stays, the word after it is what is checked.
    const and = /^و\p{L}{3,}$/u.test(word) && !word.match(ARTICLE) && !lexicon.words.has(key) ? 'و' : '';
    if (and && (lexicon.words.has(key.slice(1)) || SPOKEN_FORMS.has(key.slice(1)))) return part;
    const article = and ? '' : word.match(ARTICLE)?.[1] || '';
    const own = and ? key.slice(1) : key;
    const learnedWord = learned[own];
    if (learnedWord) {
      fixes.push({ from: word, to: `${and}${article}${learnedWord}`, sure: true });
      return `${match[1]}${and}${article}${learnedWord}${match[3]}`;
    }
    const near = nearest(lexicon, own, context);
    if (!near) return part;
    const meant = `${and}${article}${near.word}`;
    // One sound-alike letter and nothing else as close: sure.
    if (near.unique && near.distance <= 0.4) {
      fixes.push({ from: word, to: meant, sure: true });
      return `${match[1]}${meant}${match[3]}`;
    }
    // A word that could be meant (but he is not sure) — a perfume word, a word said in the conversation just now, or a
    // common word close enough: asked once, before answering.
    const worthAsking = near.scent || near.context || (near.weight >= 20 && own.length >= 5 && near.distance <= 0.8);
    // «ثابت» / «ثبات»: one root in two forms (only the long vowels differ) — a real word, not misheard.
    const sameRoot = own.replace(/[اويىآأإ]/gu, '') === near.word.replace(/[اويىآأإ]/gu, '');
    if (!ask && worthAsking && !sameRoot && near.distance <= 1) {
      const corrected = parts.map((p, i) => (i === index ? `${match[1]}${meant}${match[3]}` : p)).join(' ');
      ask = { from: word, to: meant, corrected };
    }
    return part;
  });
  const text = out.join(' ');
  if (ask) {
    // The question's sentence carries the sure fixes too.
    const askedWords = text.split(' ');
    const at = askedWords.findIndex((p) => p.includes(ask!.from));
    if (at >= 0) askedWords[at] = askedWords[at]!.replace(ask.from, ask.to);
    ask = { ...ask, corrected: askedWords.join(' ') };
  }
  return { text, fixes, ...(ask ? { ask } : {}) };
}

/** The visitor's answer to «قصدك …؟»: yes, no, or something else (a new sentence). */
export function confirmAnswer(text: string): 'yes' | 'no' | undefined {
  const t = ` ${text.toLowerCase().replace(/\p{M}/gu, '').replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ').trim()} `;
  if (/ (لا|لأ|لاء|لاا|مش كده|مش كدا|مو|مب|لا مش|no|nope|non|nein|нет|hayır|نه) /u.test(t)) return 'no';
  if (/ (ايوه|أيوه|ايوا|أيوة|ايوة|اه|آه|ايه|إيه|اي|إي|نعم|صح|صحيح|بالظبط|بالضبط|اكيد|أكيد|تمام|مظبوط|هو ده|هي دي|يب|yes|yeah|yep|right|exactly|oui|sí|si|ja|да|evet|بله|آره) /u.test(t)) return 'yes';
  return undefined;
}

const ASK: Record<string, (word: string) => string> = {
  egyptian: (w) => `قصدك «${w}»؟`, gulf: (w) => `تقصد «${w}»؟`, levantine: (w) => `قصدك «${w}»؟`, iraqi: (w) => `تقصد «${w}»؟`,
  maghrebi: (w) => `باغي تقول «${w}»؟`, sudanese: (w) => `قصدك «${w}»؟`, yemeni: (w) => `تقصد «${w}»؟`, msa: (w) => `هل تقصد «${w}»؟`,
  en: (w) => `Did you mean “${w}”?`, fr: (w) => `Vous voulez dire « ${w} » ?`, es: (w) => `¿Quieres decir «${w}»?`, it: (w) => `Intendi «${w}»?`,
  de: (w) => `Meinst du „${w}“?`, ru: (w) => `Вы имели в виду «${w}»?`, zh: (w) => `你是说“${w}”吗？`, tr: (w) => `“${w}” mı demek istedin?`, fa: (w) => `منظورتان «${w}» است؟`,
};
const REPEAT: Record<string, string> = {
  egyptian: 'معلش ماسمعتكش كويس، ممكن تعيد تاني؟', gulf: 'المعذرة ما سمعتك زين، ممكن تعيد؟', levantine: 'عفوًا ما سمعتك منيح، فيك تعيد؟',
  iraqi: 'العفو ما سمعتك زين، تكدر تعيد؟', maghrebi: 'سمح ليا ما سمعتكش مزيان، عاود عافاك؟', sudanese: 'معليش ما سمعتك كويس، ممكن تعيد؟',
  yemeni: 'المعذرة ما سمعتك تمام، ممكن تعيد؟', msa: 'عذرًا، لم أسمعك جيدًا، هل يمكنك الإعادة؟',
  en: 'Sorry, I didn’t catch that — could you say it again?', fr: 'Pardon, je n’ai pas bien entendu, vous pouvez répéter ?',
  es: 'Perdona, no te oí bien, ¿puedes repetirlo?', it: 'Scusa, non ho sentito bene, puoi ripetere?', de: 'Entschuldige, das habe ich nicht verstanden – kannst du es wiederholen?',
  ru: 'Извините, не расслышал, повторите, пожалуйста.', zh: '抱歉，我没听清，可以再说一遍吗？', tr: 'Pardon, tam duyamadım, tekrar eder misin?', fa: 'ببخشید، خوب نشنیدم، می‌شود تکرار کنید؟',
};
/** «معلش ماسمعتكش كويس، ممكن تعيد؟» in the visitor's language and dialect. */
export function repeatLine(language: SupportedLanguage, dialect?: Dialect): string {
  return language === 'ar' ? REPEAT[dialect || 'egyptian']! : REPEAT[language] || REPEAT.en!;
}

/** «قصدك «عود»؟» in the visitor's language and dialect. */
export function confirmQuestion(language: SupportedLanguage, dialect: Dialect | undefined, word: string): string {
  return (language === 'ar' ? ASK[dialect || 'egyptian'] : ASK[language] || ASK.en)!(word);
}

const LOOKUP_WORDS = [
  'سعر', 'اسعار', 'أسعار', 'بكام', 'بكم', 'متوفر', 'متاح', 'موجود عندكم', 'عندكم', 'المتجر', 'متجر', 'مخزون', 'شحن', 'توصيل',
  'طلبي', 'اوردر', 'أوردر', 'ابحث', 'دورلي', 'دور لي', 'دوّر', 'شوفلي', 'شوف لي', 'ارخص', 'أرخص', 'اغلى', 'أغلى', 'عروض', 'ترشحلي',
  'ترشح لي', 'رشحلي', 'رشح لي', 'تنصحني', 'price', 'cost', 'how much', 'in stock', 'available', 'stock', 'shipping', 'delivery',
  'my order', 'search', 'look up', 'find me', 'recommend', 'prix', 'precio', 'prezzo', 'preis', 'цена', 'fiyat', 'قیمت', '价格', '多少钱',
];
/** A question Shaheen answers by looking data up: the store, prices, stock, delivery, or a search (whole words only). */
const ARABIC_LOOKUP = LOOKUP_WORDS.filter((word) => /[\u0600-\u06FF]/.test(word));
const OTHER_LOOKUP = LOOKUP_WORDS.filter((word) => !/[\u0600-\u06FF]/.test(word) && !/[\u4E00-\u9FFF]/.test(word));
// Arabic stems take a prefix («وعندكم»، «بالسعر») and an ending («سعره»); other words must be whole («cost», not «costume»).
const LOOKUP = new RegExp(`(?<!\\p{L})(?:و|ف|ب|ال|وال)?(?:${ARABIC_LOOKUP.join('|')})|(?<!\\p{L})(?:${OTHER_LOOKUP.join('|')})(?!\\p{L})|价格|多少钱`, 'iu');
export const needsLookup = (text: string) => LOOKUP.test(text);

const FILLER: Record<string, string> = {
  egyptian: 'ثواني أدخل أشوفلك البيانات.', gulf: 'لحظة أشيّك لك على البيانات.', levantine: 'لحظة خليني شوفلك المعلومات.', iraqi: 'لحظة أشوفلك المعلومات.',
  maghrebi: 'تسنّى شوية نشوف ليك المعلومات.', sudanese: 'لحظة أشوف ليك البيانات.', yemeni: 'لحظة أشوف لك البيانات.', msa: 'لحظة من فضلك، سأراجع البيانات.',
  en: 'One moment, let me check the details.', fr: 'Un instant, je vérifie les informations.', es: 'Un momento, reviso los datos.', it: 'Un attimo, controllo i dati.',
  de: 'Einen Moment, ich schaue kurz nach.', ru: 'Минутку, сейчас проверю данные.', zh: '请稍等，我查一下资料。', tr: 'Bir saniye, bilgilere bakıyorum.', fa: 'یک لحظه، اطلاعات را بررسی می‌کنم.',
};
/** «استنى شوية هدخل أشوف البيانات» in the visitor's language and dialect. */
export function lookupFiller(language: SupportedLanguage, dialect?: Dialect): string {
  return language === 'ar' ? FILLER[dialect || 'egyptian']! : FILLER[language] || FILLER.en!;
}

/** A heard→meant pair worth learning: two real words (letters only, short), not the same word. */
export function learnablePair(from: unknown, to: unknown): { from: string; to: string } | undefined {
  if (typeof from !== 'string' || typeof to !== 'string') return undefined;
  const a = from.trim(); const b = to.trim();
  if (!a || !b || a.length > 24 || b.length > 24 || /\s/.test(a) || /\s/.test(b)) return undefined;
  if (!/^\p{L}+$/u.test(a) || !/^\p{L}+$/u.test(b)) return undefined;
  const ka = wordKey(a); const kb = wordKey(b);
  if (ka.length < 2 || kb.length < 2 || ka === kb) return undefined;
  // Only into a word Shaheen knows (a perfume or everyday word): never a name, a place or anything personal.
  if (!baseLexicon().words.has(kb)) return undefined;
  return { from: ka, to: kb };
}

const NOTE: Record<string, (pairs: string) => string> = {
  ar: (p) => `🎧 سمعت ${p}`, en: (p) => `🎧 I heard ${p}`, fr: (p) => `🎧 J’ai entendu ${p}`, es: (p) => `🎧 Oí ${p}`,
  it: (p) => `🎧 Ho sentito ${p}`, de: (p) => `🎧 Gehört: ${p}`, ru: (p) => `🎧 Я услышал ${p}`, zh: (p) => `🎧 我听到的是 ${p}`,
  tr: (p) => `🎧 Duyduğum: ${p}`, fa: (p) => `🎧 شنیدم ${p}`,
};
const AS: Record<string, string> = { ar: 'وفهمتها', en: 'and took it as', fr: 'et compris', es: 'y entendí', it: 'e ho capito', de: '→', ru: 'и понял как', zh: '理解为', tr: '→', fa: 'و فهمیدم' };
/** «🎧 سمعت «عوض» وفهمتها «عود»» — shown under the visitor's spoken message, so a wrong guess is visible. */
export function heardNote(language: SupportedLanguage, fixes: readonly { from: string; to: string }[]): string {
  if (!fixes.length) return '';
  const as = AS[language] || AS.en!;
  const pairs = fixes.slice(0, 3).map((fix) => `«${fix.from}» ${as} «${fix.to}»`).join('، ');
  return (NOTE[language] || NOTE.en!)(pairs);
}

/**
 * The engine's readings of one utterance as whole sentences: its best guess first, then the same sentence with
 * one part replaced by that part's next-best reading (`results` = per recognised part, its readings best first).
 */
export function readingsFrom(results: readonly (readonly string[])[]): string[] {
  const clean = (text: string) => text.replace(/\s+/g, ' ').trim();
  const best = results.map((part) => part[0] || '');
  const out = [clean(best.join(' '))];
  results.forEach((part, index) => {
    for (const other of part.slice(1, 4)) {
      const reading = clean(best.map((text, i) => (i === index ? other : text)).join(' '));
      if (reading && !out.includes(reading)) out.push(reading);
    }
  });
  return out.filter(Boolean);
}

/** A question Shaheen asked («قصدك «عود»؟») and is waiting on. */
export interface PendingConfirm {
  /** What was heard, with only the sure fixes (sent when he says no). */
  original: string;
  /** The same with the asked word too (sent when he says yes). */
  corrected: string;
  from: string; to: string;
  fixes: HeardFix[];
}
export type VoicePlan =
  | { action: 'ask'; say: string; pending: PendingConfirm }
  | { action: 'repeat'; say: string }
  | { action: 'send'; text: string; heard: { from: string; to: string; confirmed?: boolean }[]; filler?: string };

const NO_WORDS = /^(لا|لأ|لاء|لاا|مش|كده|كدا|قصدي|قصدى|اقصد|أقصد|انا|أنا|no|nope|i|mean|meant|non|je|veux|dire)$/iu;

/**
 * What to do with a spoken sentence: ask about one unsure word first, or send it (with the sure corrections, and the
 * «ثواني أشوفلك البيانات» line when the answer needs a real look-up). `pending` = the question he is answering now.
 */
export function planVoiceTurn(said: string, { pending, alternatives = [], learned = {}, lexicon, language, dialect, context, confidence }: {
  pending?: PendingConfirm | null; alternatives?: readonly string[]; learned?: Record<string, string>; lexicon?: Lexicon;
  language: SupportedLanguage; dialect?: Dialect;
  /** The conversation just now (his last reply, the visitor's last sentences): a misheard word is guessed from it. */
  context?: readonly string[];
  /** How sure the speech engine was (0–1; 0 or missing = it did not say). */
  confidence?: number;
}): VoicePlan {
  const send = (text: string, heard: Extract<VoicePlan, { action: 'send' }>['heard']): VoicePlan => {
    const filler = needsLookup(text) ? lookupFiller(language, dialect) : undefined;
    return { action: 'send', text, heard, ...(filler ? { filler } : {}) };
  };
  const sure = (fixes: HeardFix[]) => fixes.filter((fix) => fix.sure).map(({ from, to }) => ({ from, to }));
  if (pending) {
    const answer = confirmAnswer(said);
    if (answer === 'yes') return send(pending.corrected, [...sure(pending.fixes), { from: pending.from, to: pending.to, confirmed: true }]);
    if (answer === 'no') {
      // «لا، عنبر»: the word he meant, said right after the no.
      const rest = said.replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter((word) => word && !NO_WORDS.test(word));
      if (rest.length === 1 && rest[0] !== pending.from) {
        const meant = rest[0]!;
        // «لا، عنبر» where «عنبر» sounds like what was heard: a mishearing, learned (his way of saying it). A word
        // that sounds nothing like it is not learned: he may simply have changed his mind.
        const misheard = heardDistance(wordKey(pending.from), wordKey(meant)) <= 1.2;
        return send(pending.original.replace(pending.from, meant), [...sure(pending.fixes), { from: pending.from, to: meant, ...(misheard ? { confirmed: true } : {}) }]);
      }
      return send(pending.original, sure(pending.fixes));
    }
    // Neither yes nor no: a new sentence (the question is dropped).
  }
  if (language !== 'ar' && language !== 'en') return send(said.replace(/\s+/g, ' ').trim(), []);
  const known = context?.length ? contextWords(context) : undefined;
  const reading = fixHeard(said, { alternatives, learned, ...(lexicon ? { lexicon } : {}), ...(known ? { context: known } : {}) });
  // The engine itself was unsure and most of the sentence makes no sense: «ممكن تعيد؟» instead of answering a guess
  // (a wrong guess is how a conversation jumps to another topic).
  if (confidence !== undefined && confidence > 0 && confidence < 0.45 && sense(reading.text, lexicon || baseLexicon(), learned, known) < 0.5) {
    return { action: 'repeat', say: repeatLine(language, dialect) };
  }
  if (reading.ask) {
    return { action: 'ask', say: confirmQuestion(language, dialect, reading.ask.to.replace(ARTICLE, '')), pending: {
      original: reading.text, corrected: reading.ask.corrected, from: reading.ask.from, to: reading.ask.to, fixes: reading.fixes,
    } };
  }
  return send(reading.text, sure(reading.fixes));
}

/** «قصدك «عود»؟» as chat messages: what he heard, then Shaheen's question (nothing goes to the server). */
/** The shape of a chat message (chatStorage's ChatMessage; not imported, so the server never loads browser code). */
interface AskMessage {
  id: string; role: 'user' | 'assistant'; text: string; timestamp: string;
  aiEngine?: { id: string; name: string; badge: string; provider: 'shaheen' };
}
export function askMessages(heard: string, question: string, language: string, now = new Date()): AskMessage[] {
  const timestamp = now.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' });
  const stamp = `${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`;
  return [
    { id: `user-heard-${stamp}`, role: 'user', text: heard, timestamp },
    { id: `bot-ask-${stamp}`, role: 'assistant', text: question, timestamp, aiEngine: { id: 'auto', name: 'الخبير شاهين', badge: 'شاهين', provider: 'shaheen' } },
  ];
}

/** The line shown while Shaheen looks the visitor's last question up (only when it really needs a look-up). */
export function lookingUpLine(messages: readonly { role: string; text: string }[], language: SupportedLanguage, dialect?: Dialect): string | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]!.role !== 'user') continue;
    return needsLookup(messages[index]!.text.replace(/\n\n🎧 [^\n]*$/u, '')) ? lookupFiller(language, dialect) : undefined;
  }
  return undefined;
}
