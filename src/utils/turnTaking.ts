/**
 * «ترتيب الحوار»: who is talking to whom, and when a turn is over.
 *
 * - The visitor talks; when he pauses, is his sentence finished («عندكم عود بكام؟») or is he still going («أنا عايز
 *   عطر يكون…»)? Clear cases are decided alone; otherwise Shaheen asks «خلصت ولا لسه؟».
 * - While Shaheen talks and someone speaks, he keeps talking for about a second, then judges the words: said to him
 *   («استنى»، «طب بكام؟»، «شاهين…») → he stops and listens; said to someone else («يا ماما هاتي الشاي») → he goes on.
 * - «يتدرب على القطع المناسب»: every time he got it wrong (stopped for nothing, or went on while the visitor was
 *   talking to him) the words and a small bias are kept on this device, so next time he judges like this visitor.
 *
 * Pure functions (no browser API besides an optional localStorage), shared by the voice hook and the tests.
 */
import type { SupportedLanguage } from '../types/i18n';
import type { Dialect } from './arabicDialect';
import { normalizeArabic } from './arabicDialect';
import { mergeHeard } from './shaheenVoice';

const words = (text: string) => normalizeArabic(text).split(' ').filter(Boolean);
const has = (list: readonly string[], set: ReadonlySet<string>) => list.some((word) => set.has(word));
const phrase = (text: string, phrases: readonly string[]) => {
  const padded = ` ${normalizeArabic(text)} `;
  return phrases.some((item) => padded.includes(` ${normalizeArabic(item)} `));
};

/** Words a sentence does not end on: it is going on («أنا عايز عطر يكون…»، «and…»). */
const TRAILING = new Set([
  'و', 'او', 'ولا', 'بس', 'يعني', 'اللي', 'الي', 'عشان', 'علشان', 'لان', 'لانه', 'لو', 'ف', 'في', 'فيه', 'من', 'علي', 'على', 'مع', 'عن', 'ل',
  'ان', 'انه', 'لكن', 'ممكن', 'عايز', 'عاوز', 'عايزه', 'محتاج', 'محتاجه', 'ابغي', 'ابي', 'بدي', 'اريد', 'حابب', 'نفسي', 'زي', 'مثلا', 'كمان',
  'يكون', 'تكون', 'بتاع', 'بتاعه', 'بين', 'لحد', 'قبل', 'بعد', 'حاجه', 'هو', 'هي', 'انا', 'احنا', 'اممم', 'امم', 'ام', 'ااه', 'اه', 'ايوه يعني',
  'and', 'or', 'but', 'so', 'because', 'the', 'a', 'an', 'to', 'with', 'of', 'for', 'if', 'that', 'my', 'um', 'uh', 'like', 'want', 'need', 'is', 'i',
  'about', 'from', 'in', 'on', 'at', 'than', 'some', 'any', 'your', 'et', 'ou', 'mais', 'le', 'la', 'de', 'pour', 'avec', 'un', 'une', 'y', 'o', 'pero', 'el', 'e', 'para', 'con', 'un', 'una', 'und', 'oder', 'aber', 'и', 'или', 'но', 've', 'veya', 'ama', 'که',
]);
/** Words that make a sentence a question or a request (a turn that can be answered). */
const ASKING = new Set([
  'كام', 'بكام', 'ايه', 'ايش', 'وش', 'شو', 'شنو', 'شنهو', 'فين', 'وين', 'امتي', 'متي', 'ازاي', 'كيف', 'شلون', 'ليه', 'ليش', 'هل', 'مين', 'منين',
  'كم', 'بكم', 'ايش', 'اش', 'واش', 'عندك', 'عندكم', 'فيه', 'في', 'يوجد', 'ممكن', 'اقدر', 'نقدر', 'ينفع', 'هينفع', 'يصلح', 'قولي', 'قلي', 'وريني', 'رشحلي', 'رشح', 'انصحني', 'اقترح', 'اختارلي', 'فهمني', 'اشرح', 'ابعتلي', 'احسن', 'افضل',
  'what', 'how', 'where', 'when', 'why', 'which', 'who', 'do', 'does', 'can', 'could', 'is', 'are', 'recommend', 'suggest', 'tell', 'show', 'best',
  'quel', 'quelle', 'comment', 'combien', 'qué', 'cuánto', 'cómo', 'was', 'wie', 'wo', 'что', 'сколько', 'как', 'ne', 'nasıl', 'kaç', 'چه', 'چند',
]);
/** Short replies that are a whole turn by themselves. */
const WHOLE_REPLIES = [
  'ايوه', 'ايوا', 'اه', 'نعم', 'لا', 'لا شكرا', 'مع السلامه', 'في امان الله', 'الله يسلمك', 'تمام', 'ماشي', 'شكرا', 'متشكر', 'تسلم', 'خلاص', 'مع السلامه', 'سلام', 'كمل', 'اكيد', 'طيب', 'اوكي',
  'yes', 'no', 'ok', 'okay', 'thanks', 'thank you', 'bye', 'sure', 'oui', 'non', 'merci', 'sí', 'gracias', 'ja', 'nein', 'danke', 'да', 'нет', 'evet', 'hayır',
];

export type TurnState = 'done' | 'more' | 'unsure';

const NEGATION = new Set(['مش', 'ما', 'مو', 'مب', 'لا', 'not', "don't", 'dont', 'pas']);
const INTENSIFIERS = new Set(['جدا', 'اوي', 'قوي', 'خالص', 'كتير', 'كثير', 'وايد', 'كتير', 'so', 'much', 'very', 'a', 'lot', 'beaucoup', 'mucho', 'muchas', 'sehr', 'كده', 'يا', 'باشا', 'حبيبي']);
const OPENERS = new Set(['بص', 'بصي', 'اسمع', 'اسمعي', 'شوف', 'شوفي', 'بقولك', 'listen', 'look', 'so', 'well', 'écoute', 'mira', 'oye']);
const KNOW = new Set(['اعرف', 'افهم', 'قولي', 'قلي', 'know', 'tell', 'ask', 'savoir', 'saber', 'wissen']);
const YOU = new Set(['انتو', 'انتم', 'انت', 'انتي', 'حضرتك', 'حضرتكم', 'you', 'vous', 'tu', 'usted', 'ustedes']);
const OPEN_VERBS = new Set(['كنت', 'كان', 'كانت', 'بحب', 'بتحب', 'بيحب', 'بنحب', 'بدور', 'بتدور', 'بفكر', 'بتفكر', 'بقول', 'بيقول', 'اسمه', 'اسمها', 'نفسي', 'was', 'were', 'likes', 'loves']);
const CONDITION = new Set(['لو', 'اذا', 'لما', 'if', 'si', 'wenn']);

/** «أريد عطر»، «بدي شي»: a wish with only a general word after it — the details are still coming. */
const GENERAL = new Set(['عطر', 'شي', 'شيء', 'حاجه', 'حاجة', 'ريحه', 'برفان', 'something', 'perfume', 'parfum', 'algo', 'etwas']);
const WISH = new Set(['عايز', 'عاوز', 'عايزه', 'محتاج', 'ابغي', 'ابي', 'بدي', 'اريد', 'بغيت', 'حابب', 'نفسي', 'ودي', 'want', 'need', 'veux', 'quiero', 'voglio', 'möchte']);

/**
 * After the visitor pauses: is the turn over? 'more' = it plainly goes on (ends on «و»، «عشان»، «عايز»…); 'done' = a
 * question, a request or a whole short reply; 'unsure' = could be either (Shaheen asks «خلصت ولا لسه؟»).
 */
export function turnState(text: string, { answering = false }: { answering?: boolean } = {}): TurnState {
  const raw = text.replace(/\s+/g, ' ').trim();
  const list = words(raw);
  if (!list.length) return 'unsure';
  const last = list[list.length - 1]!;
  const before = list[list.length - 2];
  // «لا مش عايز»: a wish said in the negative is complete.
  if (before && NEGATION.has(before) && WISH.has(last)) return 'done';
  // «شكرا جدا»، «thank you so much»: a whole reply with only «very / so much» after it.
  const head = WHOLE_REPLIES.find((reply) => (`${list.join(' ')} `).startsWith(`${normalizeArabic(reply)} `));
  if (head && list.slice(normalizeArabic(head).split(' ').length).every((word) => INTENSIFIERS.has(word))) return 'done';
  // «أبي أعرف كم…»: «know / tell me» then a question word at the very end — the thing asked about is next.
  if (before && KNOW.has(before) && ASKING.has(last)) return 'more';
  // «انتو بتشحنوا للكويت»: a sentence said to Shaheen («انتو / حضرتك / you …») is a question even without «؟».
  if (list.length >= 3 && YOU.has(list[0]!)) return 'done';
  // «بص يا سيدي»، «listen»: an opener — what he wants to say is next.
  if (list.length <= 3 && OPENERS.has(list[0]!) && !has(list, ASKING)) return 'more';
  // «طب لو أخدت اتنين»: an «if» with no question yet.
  if (list.length <= 6 && list.some((word) => CONDITION.has(word)) && !has(list.filter((word) => !CONDITION.has(word)), ASKING) && !/[?؟]\s*$/u.test(raw)) return 'more';
  // A whole goodbye or thanks («مع السلامة»), even though it holds a word that usually leads on.
  if (list.length <= 3 && WHOLE_REPLIES.some((reply) => normalizeArabic(reply) === list.join(' '))) return 'done';
  if (list.length <= 3 && GENERAL.has(last) && list.slice(0, -1).some((word) => WISH.has(word))) return 'more';
  if (TRAILING.has(last) || (list.length >= 2 && TRAILING.has(`${list[list.length - 2]} ${last}`))) return 'more';
  if (/[?؟]\s*$/u.test(raw)) return 'done';
  // The answer to a question Shaheen just asked («رجالي ولا حريمي؟» → «رجالي»).
  if (answering && list.length <= 4) return 'done';
  if (list.length <= 3 && phrase(raw, WHOLE_REPLIES) && list.every((word) => !TRAILING.has(word) || word === 'اه')) return 'done';
  if (list.length >= 2 && has(list, ASKING)) return 'done';
  // «انا كنت»، «اختي بتحب»: a short start ending on a verb that needs what comes after it.
  if (list.length <= 3 && OPEN_VERBS.has(last)) return 'more';
  // Three words or more that end on a real word (not «و»، «عشان»…): a statement or a yes/no question
  // («هو الشحن مجاني»، «السعر ده شامل الشحن») — said the way people ask without «هل».
  if (list.length >= 3) return 'done';
  return 'unsure';
}

/** His answer to «خلصت ولا لسه؟»: finished, still going, or neither (then it is simply more of his sentence). */
export function finishedAnswer(text: string): 'done' | 'more' | undefined {
  const list = words(text);
  if (!list.length || list.length > 4) return undefined;
  if (phrase(text, ['لسه', 'لسا', 'مش لسه', 'استني', 'استنا', 'ثانيه', 'لحظه', 'ثواني', 'مخلصتش', 'ماخلصتش', 'لا', 'not yet', 'wait', 'no', 'hold on', 'pas encore', 'todavía no', 'noch nicht', 'ещё нет', 'henüz', 'نه هنوز'])) return 'more';
  if (phrase(text, ['خلصت', 'خلاص', 'بس كده', 'بس', 'ايوه', 'ايوا', 'اه', 'نعم', 'تمام', 'يلا', 'رد', 'جاوب', 'اتفضل', 'خلصنا', 'هذا هو', 'بس هيك', 'done', 'yes', "that's it", 'thats it', 'finished', 'go ahead', 'oui', 'fini', 'sí', 'listo', 'ja', 'fertig', 'да', 'всё', 'evet', 'bitti', 'تمام شد'])) return 'done';
  return undefined;
}

/** What he is saying to Shaheen (stop, a question, the store) versus to someone near him. */
/** Words that, alone, mean «stop». Said while calling someone else («اسكت يا ولد»), they are not for Shaheen. */
const TO_HIM_STRONG = ['شاهين', 'shaheen', 'استني', 'استنا', 'لحظه', 'ثانيه', 'ثواني', 'وقف', 'اسكت', 'بس بس', 'لا لا', 'كفايه', 'خلاص', 'اصبر', 'stop', 'wait', 'hold on', 'attends', 'espera', 'aspetta', 'warte', 'стоп', 'подожди', 'dur', 'bekle', 'صبر کن', 'وایسا'];
const TO_HIM = new Set([
  'عطر', 'عطور', 'ريحه', 'برفان', 'بارفان', 'سعر', 'سعره', 'بكام', 'كام', 'شحن', 'توصيل', 'اطلب', 'اشتري', 'خصم', 'عود', 'مسك', 'عنبر', 'فانيليا', 'ورد',
  'ثبات', 'فواحه', 'زجاجه', 'مل', 'تستر', 'اوردر', 'طلب', 'منتج', 'انت', 'انتا', 'حضرتك', 'قولي', 'قلي', 'وريني', 'رشحلي', 'انصحني', 'فهمني', 'اعد', 'تاني',
  'الفرق', 'فرق', 'اعرف', 'فاهم', 'فاهمه', 'فهمت', 'مفهمتش', 'مفهمتكش', 'وضح', 'وبعدين', 'اطلبه', 'اطلبها', 'اشتريه', 'متاح', 'موجود', 'discount', 'price', 'cost',
  'men', 'women', 'ship', 'shipping', 'delivery', 'smell', 'long', 'last', 'cheaper', 'other', 'another', 'again', 'mean', 'understand',
  'تانيه', 'كمان', 'اخف', 'اتقل', 'ارخص', 'اغلي', 'غالي', 'رخيص', 'رجالي', 'حريمي', 'نسائي', 'هديه', 'عينه', 'عروض', 'سعرها', 'ريحته', 'ريحتها',
  'طب', 'يعني', 'غير', 'ارخص', 'اغلي', 'احسن', 'افضل', 'ده', 'دي', 'هو', 'ايه', 'ليه', 'ازاي', 'فين', 'perfume', 'scent', 'price', 'shipping', 'order',
  'cheaper', 'you', 'parfum', 'prix', 'perfume', 'precio', 'preis', 'духи', 'цена', 'parfüm', 'fiyat', 'عطری', 'قیمت',
]);
const WANTING = new Set(['عايز', 'عاوز', 'عايزه', 'محتاج', 'ابغي', 'ابي', 'بدي', 'اريد', 'حابب', 'want', 'need', 'veux', 'quiero', 'voglio', 'möchte', 'хочу', 'istiyorum', 'میخواهم']);
/** Calling someone («يا ماما»، «يا أحمد») or telling someone near to do something. */
const ASIDE = new Set([
  'ماما', 'بابا', 'حبيبي', 'حبيبتي', 'حاج', 'ابني', 'بنتي', 'ولاد', 'ياولد', 'تعالي', 'تعالا', 'روح', 'روحي', 'هات', 'هاتي', 'اقفل', 'افتح',
  'الباب', 'الشاي', 'الاكل', 'التليفون', 'الموبايل', 'مستني', 'جاي', 'جايه', 'نازل', 'البيت', 'خليك', 'خليكي', 'اقعد', 'اقعدي', 'نام', 'نامي',
  'هاتلي', 'هاتيلي', 'هاتهولي', 'الميه', 'ميه', 'خد', 'خدو', 'الريموت', 'الشنطه', 'المفتاح', 'coming', 'remote', 'dinner', 'شوفي', 'خدي', 'اسمعي', 'كلي', 'اشربي', 'التلفزيون', 'السفره', 'حطي', 'ولد', 'عيال', 'الولاد', 'بتنادي', 'بينادي', 'معايا', 'كلمني', 'mom', 'dad', 'honey', 'mommy', 'daddy', 'come', 'door', 'phone',
  'maman', 'papa', 'mamá', 'papá', 'mama', 'мама', 'папа', 'anne', 'baba', 'مامان',
]);

/** What he learned on this device about this visitor's interruptions. */
export interface BargeMemory {
  /** Above 0: when unsure, stop for him; below 0: go on. */
  bias: number;
  /** Words he said to Shaheen (+) or to someone else (−). */
  words: Record<string, number>;
}
export const EMPTY_BARGE_MEMORY: BargeMemory = { bias: 0, words: {} };

export type Addressee = 'shaheen' | 'other' | 'unsure';

/**
 * Who were these words (heard while Shaheen spoke, his own echo already removed) said to? `strong` = no need to wait
 * the second («استنى»، «شاهين»).
 */
export function addressee(said: string, memory: BargeMemory = EMPTY_BARGE_MEMORY): { to: Addressee; score: number; strong: boolean } {
  const list = words(said);
  if (!list.length) return { to: 'unsure', score: 0, strong: false };
  if (list.includes('شاهين') || list.includes('shaheen')) return { to: 'shaheen', score: 3, strong: true };
  // «يا ماما»، «يا أحمد»، «honey»: calling someone who is not Shaheen; «ألو»: on the phone.
  const calls = list.some((word, i) => (word === 'يا' && list[i + 1] && list[i + 1] !== 'شاهين') || (/^يا\p{L}{2,}/u.test(word) && word !== 'ياريت'))
    || list.some((word) => ['honey', 'mom', 'mommy', 'dad', 'daddy', 'babe', 'sweetie', 'maman', 'mamá'].includes(word));
  const phone = ['الو', 'الوو', 'aló', 'allo', 'алло'].includes(list[0]!);
  const aside = list.some((word) => ASIDE.has(word));
  if (phrase(said, TO_HIM_STRONG) && !calls && !phone && !aside) return { to: 'shaheen', score: 3, strong: true };
  let score = 0;
  if (calls) score -= 2;
  if (phone) score -= 3;
  for (const word of list) {
    if (TO_HIM.has(word)) score += 1;
    if (ASIDE.has(word)) score -= 1.5;
    score += Math.max(-3, Math.min(3, (memory.words[word] || 0) * 0.75));
  }
  if (has(list, ASKING) && !calls && !aside && !phone) score += 1;
  // «لا…»، «أنا عايز…»: answering what he is saying.
  if (['لا', 'لأ', 'no', 'non', 'nein', 'нет', 'hayır', 'نه'].includes(list[0]!)) score += 1;
  if (has(list, WANTING)) score += 0.5;
  if (list.length === 1 && !TO_HIM.has(list[0]!)) score -= 0.5;
  const to: Addressee = score >= 1 ? 'shaheen' : score <= -1 ? 'other' : 'unsure';
  return { to, score, strong: false };
}

/** When the words do not say: his learned bias decides (going on is the default — a reply cut for nothing is worse). */
export function settleUnsure(memory: BargeMemory = EMPTY_BARGE_MEMORY): Exclude<Addressee, 'unsure'> {
  return memory.bias > 0.3 ? 'shaheen' : 'other';
}

/**
 * Learn from a mistake: 'missed' = he went on but the visitor was talking to him; 'false' = he stopped but the visitor
 * was not (silence after, or «كمّل»).
 */
export function learnBarge(memory: BargeMemory, said: string, mistake: 'missed' | 'false'): BargeMemory {
  const step = mistake === 'missed' ? 1 : -1;
  const next = { ...memory.words };
  for (const word of new Set(words(said))) {
    if (word.length < 2) continue;
    next[word] = Math.max(-4, Math.min(4, (next[word] || 0) + step));
  }
  const kept = Object.entries(next).filter(([, value]) => value !== 0).slice(-300);
  return { bias: Math.max(-1, Math.min(1, memory.bias + step * 0.15)), words: Object.fromEntries(kept) };
}

const MEMORY_KEY = 'sham_barge_memory_v1';
export function savedBargeMemory(): BargeMemory {
  try {
    const data = JSON.parse(globalThis.localStorage?.getItem(MEMORY_KEY) || 'null') as Partial<BargeMemory> | null;
    if (!data || typeof data !== 'object') return { ...EMPTY_BARGE_MEMORY, words: {} };
    const bias = typeof data.bias === 'number' && Number.isFinite(data.bias) ? Math.max(-1, Math.min(1, data.bias)) : 0;
    const learned = data.words && typeof data.words === 'object' && !Array.isArray(data.words)
      ? Object.fromEntries(Object.entries(data.words).filter((pair): pair is [string, number] => typeof pair[1] === 'number' && Number.isFinite(pair[1])).slice(-300))
      : {};
    return { bias, words: learned };
  } catch { return { ...EMPTY_BARGE_MEMORY, words: {} }; }
}
export function saveBargeMemory(memory: BargeMemory) {
  try { globalThis.localStorage?.setItem(MEMORY_KEY, JSON.stringify(memory)); } catch { /* Private mode. */ }
}

/** The part of the reply he had not said yet (from the word he was on), to go on after a false stop. */
export function restOfReply(chunks: readonly string[], index: number, at: number): string {
  const current = chunks[index] || '';
  // Back to the start of the word he was saying.
  let from = Math.max(0, Math.min(at, current.length));
  while (from > 0 && !/\s/u.test(current[from - 1]!)) from -= 1;
  return [current.slice(from), ...chunks.slice(index + 1)].join(' ').replace(/\s+/g, ' ').trim();
}

type Lines = Partial<Record<Dialect | SupportedLanguage, string>>;
const lineFor = (lines: Lines, language: SupportedLanguage, dialect?: Dialect) =>
  (language === 'ar' ? lines[dialect || 'egyptian'] || lines.egyptian : lines[language]) || lines.en!;

const ASK_DONE: Lines = {
  egyptian: 'خلصت ولا لسه؟', gulf: 'خلصت ولا باقي شي؟', levantine: 'خلصت ولا لسا؟', iraqi: 'خلصت لو بعد؟', maghrebi: 'ساليتي ولا مازال؟',
  sudanese: 'خلصت ولا لسه؟', yemeni: 'خلصت ولا باقي؟', msa: 'هل انتهيت أم ما زلت تتحدث؟',
  en: 'Are you done, or is there more?', fr: 'Vous avez terminé, ou il y a autre chose ?', es: '¿Terminaste o hay algo más?', it: 'Hai finito o c’è altro?',
  de: 'Bist du fertig, oder kommt noch was?', ru: 'Вы закончили или ещё что-то?', zh: '你说完了吗，还是还有？', tr: 'Bitirdin mi, yoksa devam mı?', fa: 'تمام شد یا هنوز ادامه دارد؟',
};
const PATIENCE: Lines = {
  egyptian: 'اصبر عليا شوية، براجع البيانات.', gulf: 'اصبر علي شوي، أراجع البيانات.', levantine: 'طوّل بالك شوي، عم راجع المعلومات.',
  iraqi: 'اصبر عليّ شوية، دا أراجع المعلومات.', maghrebi: 'صبر عليا شوية، راني نراجع المعلومات.', sudanese: 'اصبر عليّ شوية، براجع البيانات.',
  yemeni: 'اصبر عليّ شوية، أراجع البيانات.', msa: 'لحظات من فضلك، أراجع البيانات.',
  en: 'Bear with me a moment, I’m checking the details.', fr: 'Un instant, je vérifie les informations.', es: 'Dame un momento, estoy revisando los datos.',
  it: 'Un attimo, sto controllando i dati.', de: 'Einen Moment, ich prüfe die Daten.', ru: 'Минутку, я проверяю данные.', zh: '稍等一下，我在核对资料。',
  tr: 'Bir saniye, bilgileri kontrol ediyorum.', fa: 'کمی صبر کنید، دارم اطلاعات را بررسی می‌کنم.',
};
/** «خلصت ولا لسه؟» in the visitor's language and dialect. */
export const askDoneLine = (language: SupportedLanguage, dialect?: Dialect) => lineFor(ASK_DONE, language, dialect);
/** «اصبر عليا شوية، براجع البيانات.» — said when the answer takes a while. */
export const patienceLine = (language: SupportedLanguage, dialect?: Dialect) => lineFor(PATIENCE, language, dialect);

/** The whole turn: his pieces put together in order (a piece already contained in the last one is not repeated). */
export function joinTurn(parts: readonly string[]): string {
  return parts.reduce((all, part) => mergeHeard(all, part), '');
}
