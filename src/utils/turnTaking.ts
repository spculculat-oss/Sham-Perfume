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
  'et', 'ou', 'mais', 'le', 'la', 'de', 'y', 'o', 'pero', 'el', 'e', 'und', 'oder', 'aber', 'и', 'или', 'но', 've', 'veya', 'ama', 'که',
]);
/** Words that make a sentence a question or a request (a turn that can be answered). */
const ASKING = new Set([
  'كام', 'بكام', 'ايه', 'ايش', 'وش', 'شو', 'شنو', 'شنهو', 'فين', 'وين', 'امتي', 'متي', 'ازاي', 'كيف', 'شلون', 'ليه', 'ليش', 'هل', 'مين', 'منين',
  'عندك', 'عندكم', 'فيه', 'في', 'يوجد', 'قولي', 'قلي', 'وريني', 'رشحلي', 'رشح', 'انصحني', 'اقترح', 'اختارلي', 'فهمني', 'اشرح', 'ابعتلي', 'احسن', 'افضل',
  'what', 'how', 'where', 'when', 'why', 'which', 'who', 'do', 'does', 'can', 'could', 'is', 'are', 'recommend', 'suggest', 'tell', 'show', 'best',
  'quel', 'quelle', 'comment', 'combien', 'qué', 'cuánto', 'cómo', 'was', 'wie', 'wo', 'что', 'сколько', 'как', 'ne', 'nasıl', 'kaç', 'چه', 'چند',
]);
/** Short replies that are a whole turn by themselves. */
const WHOLE_REPLIES = [
  'ايوه', 'ايوا', 'اه', 'نعم', 'لا', 'لا شكرا', 'تمام', 'ماشي', 'شكرا', 'متشكر', 'تسلم', 'خلاص', 'مع السلامه', 'سلام', 'كمل', 'اكيد', 'طيب', 'اوكي',
  'yes', 'no', 'ok', 'okay', 'thanks', 'thank you', 'bye', 'sure', 'oui', 'non', 'merci', 'sí', 'gracias', 'ja', 'nein', 'danke', 'да', 'нет', 'evet', 'hayır',
];

export type TurnState = 'done' | 'more' | 'unsure';

/**
 * After the visitor pauses: is the turn over? 'more' = it plainly goes on (ends on «و»، «عشان»، «عايز»…); 'done' = a
 * question, a request or a whole short reply; 'unsure' = could be either (Shaheen asks «خلصت ولا لسه؟»).
 */
export function turnState(text: string, { answering = false }: { answering?: boolean } = {}): TurnState {
  const raw = text.replace(/\s+/g, ' ').trim();
  const list = words(raw);
  if (!list.length) return 'unsure';
  const last = list[list.length - 1]!;
  if (TRAILING.has(last) || (list.length >= 2 && TRAILING.has(`${list[list.length - 2]} ${last}`))) return 'more';
  if (/[?؟]\s*$/u.test(raw)) return 'done';
  // The answer to a question Shaheen just asked («رجالي ولا حريمي؟» → «رجالي»).
  if (answering && list.length <= 4) return 'done';
  if (list.length <= 3 && phrase(raw, WHOLE_REPLIES) && list.every((word) => !TRAILING.has(word) || word === 'اه')) return 'done';
  if (list.length >= 2 && has(list, ASKING)) return 'done';
  if (list.length >= 6) return 'done';
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
const TO_HIM_STRONG = ['شاهين', 'shaheen', 'استني', 'استنا', 'لحظه', 'ثانيه', 'ثواني', 'وقف', 'اسكت', 'بس بس', 'لا لا', 'كفايه', 'خلاص', 'اصبر', 'stop', 'wait', 'hold on', 'attends', 'espera', 'aspetta', 'warte', 'стоп', 'подожди', 'dur', 'bekle', 'صبر کن', 'وایسا'];
const TO_HIM = new Set([
  'عطر', 'عطور', 'ريحه', 'برفان', 'بارفان', 'سعر', 'سعره', 'بكام', 'كام', 'شحن', 'توصيل', 'اطلب', 'اشتري', 'خصم', 'عود', 'مسك', 'عنبر', 'فانيليا', 'ورد',
  'ثبات', 'فواحه', 'زجاجه', 'مل', 'تستر', 'اوردر', 'طلب', 'منتج', 'انت', 'انتا', 'حضرتك', 'قولي', 'قلي', 'وريني', 'رشحلي', 'انصحني', 'فهمني', 'اعد', 'تاني',
  'طب', 'يعني', 'غير', 'ارخص', 'اغلي', 'احسن', 'افضل', 'ده', 'دي', 'هو', 'ايه', 'ليه', 'ازاي', 'فين', 'perfume', 'scent', 'price', 'shipping', 'order',
  'cheaper', 'you', 'parfum', 'prix', 'perfume', 'precio', 'preis', 'духи', 'цена', 'parfüm', 'fiyat', 'عطری', 'قیمت',
]);
const WANTING = new Set(['عايز', 'عاوز', 'عايزه', 'محتاج', 'ابغي', 'ابي', 'بدي', 'اريد', 'حابب', 'want', 'need', 'veux', 'quiero', 'voglio', 'möchte', 'хочу', 'istiyorum', 'میخواهم']);
/** Calling someone («يا ماما»، «يا أحمد») or telling someone near to do something. */
const ASIDE = new Set([
  'ماما', 'بابا', 'حبيبي', 'حبيبتي', 'حاج', 'ابني', 'بنتي', 'ولاد', 'ياولد', 'تعالي', 'تعالا', 'روح', 'روحي', 'هات', 'هاتي', 'اقفل', 'افتح',
  'الباب', 'الشاي', 'الاكل', 'التليفون', 'الموبايل', 'مستني', 'جاي', 'جايه', 'نازل', 'mom', 'dad', 'honey', 'mommy', 'daddy', 'come', 'door', 'phone',
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
  if (phrase(said, TO_HIM_STRONG)) return { to: 'shaheen', score: 3, strong: true };
  let score = 0;
  // «يا ماما»، «يا أحمد»: calling someone who is not Shaheen.
  const calls = list.some((word, i) => (word === 'يا' && list[i + 1] && list[i + 1] !== 'شاهين') || /^يا\p{L}{2,}/u.test(word) && word !== 'ياريت');
  if (calls) score -= 2;
  for (const word of list) {
    if (TO_HIM.has(word)) score += 1;
    if (ASIDE.has(word)) score -= 1.5;
    score += Math.max(-3, Math.min(3, (memory.words[word] || 0) * 0.75));
  }
  if (has(list, ASKING) && !calls) score += 1;
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
