/**
 * «فهم شاهين للغلطات» — Shaheen understands a question even when it is mistyped, the way a person would:
 *   - a missing or extra letter, two letters swapped, a doubled letter («ياسمبن», «فانيلبا», «عطررر»);
 *   - the «ال» that swallowed a «ل» («الوتس» for «اللوتس», «اليمون» for «الليمون»);
 *   - letters people mix up (ه/ة، ي/ى، ا/أ/إ/ع، س/ص/ث، ز/ذ/ظ، ت/ط، د/ض، ق/ك);
 *   - two words written together («زهرهاللوتس»);
 *   - Arabic typed with the English keyboard («.ivm hgg,js» = «زهرة اللوتس»).
 * He compares every unknown word with the words he knows — his lessons, his raw-materials encyclopaedia, the questions
 * in his memory and a built-in list of perfume words — and takes the closest one when it is clearly the closest.
 * What he understood is shown with the answer («فهمت سؤالك كده: …»), so a wrong guess is visible, never silent.
 * «مدرسة شاهين» drills it every run (spellingDrill): typos of the words of its questions must be understood.
 * Pure (no Node or DOM APIs): used by the server (server/shaheen.ts), the visitor's browser and the school.
 */
import { meaningWords, normalizeQuestion, type MemoryFile } from './shaheenMemory';
import { materialKeys, type LibraryLesson, type LibraryMaterial } from './shaheenLibrary';

/** Perfume words (Arabic and English) he always knows, even before any lesson mentions them. */
export const SCENT_WORDS = [
  'لوتس', 'ياسمين', 'فل', 'نرجس', 'زنبق', 'سوسن', 'ايريس', 'اوركيد', 'توبيروز', 'مسك', 'عنبر', 'عود', 'ورد', 'جوري', 'بنفسج', 'قرفه', 'هيل',
  'حبهان', 'زعفران', 'فانيليا', 'كهرمان', 'باتشولي', 'صندل', 'بخور', 'لبان', 'نيرولي', 'برتقال', 'ليمون', 'يوسفي', 'جريب', 'برجموت', 'نعناع',
  'لافندر', 'خزامي', 'اكليل', 'روزماري', 'ريحان', 'مريميه', 'زعتر', 'كافور', 'قهوه', 'كاكاو', 'شوكولاته', 'جوز', 'تين', 'خوخ', 'مشمش',
  'تفاح', 'كمثري', 'اناناس', 'مانجو', 'فراوله', 'توت', 'كرز', 'رمان', 'بطيخ', 'اوكالبتوس', 'صنوبر', 'ارز', 'سرو', 'فيتيفر', 'طحلب', 'جلد',
  'دخان', 'تبغ', 'عسل', 'كراميل', 'لوز', 'بندق', 'فستق', 'زنجبيل', 'فلفل', 'قرنفل', 'يانسون', 'شمر', 'جاردينيا', 'ماجنوليا', 'ليلك',
  'فريزيا', 'فاوانيا', 'كاميليا', 'اقحوان', 'بابونج', 'حناء', 'سدر', 'طائفي', 'بلغاري', 'دمشقي', 'مستكه', 'جاوي', 'لادن', 'امبر', 'كومارين',
  'تونكا', 'امبروكسان', 'جالاكسوليد', 'فانيلين', 'الدهيد', 'الدهيدات', 'زهره', 'زهور', 'زهرة', 'ورده', 'ازهار', 'اعشاب', 'توابل', 'بهارات',
  'خشب', 'اخشاب', 'فواكه', 'حمضيات', 'شرقي', 'خشبي', 'زهري', 'فوجير', 'شيبر', 'منعش', 'بودري', 'جلدي', 'دافئ', 'بارد', 'حار', 'حلو',
  'عطر', 'عطور', 'تركيبه', 'تركيز', 'تعتيق', 'تخمير', 'كحول', 'زيت', 'زيوت', 'دهن', 'مثبت', 'مثبتات', 'ثبات', 'فوحان', 'هرم', 'نوته',
  'نوتات', 'قمه', 'قلب', 'قاعده', 'رجالي', 'حريمي', 'نسائي', 'صيفي', 'شتوي', 'تقطير', 'استخلاص', 'نقع', 'رائحه', 'ريحه', 'بارفان', 'تواليت',
  'كولونيا', 'معطر', 'بخاخ', 'زجاجه', 'رشاش', 'حساسيه', 'ايفرا', 'جلسرين', 'ماء', 'مقطر', 'فلتر', 'تصفيه', 'غليسرين', 'بروبيلين',
  'lotus', 'jasmine', 'rose', 'oud', 'musk', 'amber', 'vanilla', 'sandalwood', 'lavender', 'bergamot', 'patchouli', 'vetiver', 'neroli',
  'tuberose', 'iris', 'violet', 'saffron', 'cardamom', 'cinnamon', 'frankincense', 'myrrh', 'cedar', 'citrus', 'lemon', 'orange', 'mandarin',
  'gardenia', 'magnolia', 'lily', 'peony', 'freesia', 'orchid', 'perfume', 'fragrance', 'cologne', 'maceration', 'fixative', 'alcohol',
  'ambergris', 'incense', 'leather', 'tobacco', 'honey', 'coffee', 'flower', 'flowers', 'blossom', 'notes', 'accord', 'concentration',
];
/** Everyday words: known, so they are never «corrected» into a perfume word. */
const COMMON_WORDS = [
  'في', 'من', 'على', 'عن', 'الى', 'الي', 'او', 'و', 'يا', 'هو', 'هي', 'ده', 'دي', 'دا', 'ايه', 'اي', 'ما', 'ماذا', 'هل', 'كيف', 'ازاي', 'عايز',
  'عاوز', 'عايزه', 'اريد', 'ممكن', 'لو', 'مع', 'اللي', 'التي', 'الذي', 'كده', 'كدا', 'برضه', 'طيب', 'شكرا', 'تقولي', 'قولي', 'اشرح', 'اشرحلي',
  'عرفني', 'حدثني', 'منين', 'اصل', 'تاريخ', 'فرق', 'بين', 'احسن', 'افضل', 'ليه', 'لماذا', 'امتي', 'متي', 'فين', 'اين', 'يعني', 'معلومات',
  'نبات', 'نباتات', 'شجره', 'اشجار', 'فاكهه', 'اعمل', 'اعرف', 'نسبه', 'طويل', 'قصير', 'جميل', 'قوي', 'خفيف', 'ناعم', 'طبيعي', 'صناعي',
  'انواع', 'نوع', 'كام', 'كم', 'كل', 'بعض', 'غير', 'بدون', 'عشان', 'علشان', 'لان', 'بس', 'كمان', 'لسه', 'جدا', 'اكتر', 'اقل', 'زي', 'مثل',
  'سؤال', 'جواب', 'شاهين', 'شام', 'موقع', 'حاسبه', 'متجر', 'بيت', 'البيت', 'جسم', 'جلد', 'شعر', 'هديه', 'شغل', 'صيف', 'شتاء', 'ربيع',
  'لون', 'شكل', 'مكان', 'وقت', 'ساعه', 'يوم', 'مل', 'جرام', 'نقطه', 'نقط', 'هنا', 'هناك', 'انا', 'انت', 'احنا', 'هما', 'عندي', 'عندك',
  'يستخدم', 'استخدم', 'استخدام', 'يدخل', 'تدخل', 'بيدخل', 'بتدخل', 'فايده', 'فوايد', 'مميزات', 'عيوب', 'سعر', 'مصدر', 'منه', 'منها',
  // Everyday words the inspection of 2026-10-22 found «corrected» into a field term (فاضل → تفاضل، مسطحة → مساحة…).
  'فاضل', 'باقي', 'فضل', 'مسطح', 'مسطحه', 'كروي', 'كرويه', 'طائر', 'طاير', 'طيور', 'منطقي', 'منطقيه', 'سببيه', 'سبب', 'حجه', 'مغالطه',
  'استنتاج', 'استقراء', 'نتيجه', 'مقدمه', 'صحيح', 'صح', 'غلط', 'راي', 'برايي', 'دليل', 'اكلت', 'شربت', 'اشتريت', 'اديت', 'ضاع', 'اخترع',
  'اكتشف', 'بطريق', 'بطاريق', 'بطريقه', 'طريقه', 'يبقي', 'يبقى', 'اذن', 'حامل', 'الحامل', 'زرقا', 'زرقاء', 'طياره', 'مبلوله', 'مالح', 'اقنع', 'حد',
  'the', 'a', 'an', 'of', 'to', 'for', 'and', 'or', 'is', 'are', 'what', 'how', 'can', 'i', 'me', 'my', 'in', 'on', 'with', 'please', 'about',
  'tell', 'why', 'when', 'where', 'which', 'best', 'does', 'do', 'it', 'this', 'that', 'explain', 'make', 'smell', 'difference', 'between',
  'hi', 'hello', 'hey', 'thanks', 'good', 'morning', 'evening', 'السلام', 'سلام', 'عليكم', 'مرحبا', 'اهلا', 'هاي', 'ازيك', 'صباح', 'مساء', 'الخير',
];

export interface Lexicon {
  /** word key (meaningWords form) → how often he met it (more often = the likelier meaning). */
  words: Map<string, number>;
  /** keys bucketed by length (fast candidate search). */
  byLength: Map<number, string[]>;
}
export interface SpellingFix { from: string; to: string; how: 'article' | 'split' | 'letters' }
export interface Understanding { text: string; changed: boolean; keyboard: boolean; fixes: SpellingFix[] }

const DIALECT_VERB = /^و?(بي|بت|بن|هي|هت|هن)\p{L}{2,}$/u;
const ARTICLE = /^(وال|بال|فال|كال|لل|ال)(?=\p{L}{2,})/u;
/** The form words are compared in (same as meaningWords: no «ال», ة→ه, letter variants unified). */
export const wordKey = (word: string) => normalizeQuestion(word).replace(/[^\p{L}\p{N}]/gu, '').replace(/^(وال|بال|فال|كال|لل|ال)(?=\p{L}{3,})/u, '').replace(/ة$/u, 'ه');

function addWord(lex: Lexicon, key: string, weight: number) {
  if (key.length < 2 || /\d/.test(key)) return;
  const had = lex.words.get(key);
  lex.words.set(key, (had || 0) + weight);
  if (had === undefined) {
    const list = lex.byLength.get(key.length) || [];
    list.push(key); lex.byLength.set(key.length, list);
  }
}

/** Everything he knows the words of: built-in words, his lessons, the encyclopaedia, the questions in his memory. */
export function buildLexicon(src: { lessons?: LibraryLesson[]; materials?: LibraryMaterial[]; memory?: MemoryFile; extra?: string[] } = {}): Lexicon {
  const lex: Lexicon = { words: new Map(), byLength: new Map() };
  for (const w of COMMON_WORDS) addWord(lex, wordKey(w), 50);
  for (const w of SCENT_WORDS) addWord(lex, wordKey(w), 20);
  for (const m of src.materials || []) for (const k of materialKeys(m)) addWord(lex, k, 10);
  for (const l of src.lessons || []) {
    for (const k of meaningWords(`${l.title} ${(l.tags || []).join(' ')}`)) addWord(lex, k, 5);
    for (const k of meaningWords(l.content)) addWord(lex, k, 1);
  }
  for (const e of src.memory?.entries || []) for (const k of meaningWords(e.question)) addWord(lex, k, 2);
  for (const w of src.extra || []) for (const k of meaningWords(w)) addWord(lex, k, 3);
  return lex;
}
let base: Lexicon | undefined;
/** The built-in words only (instant, no data to load). */
export const baseLexicon = () => (base ??= buildLexicon());

// ── Distance between two words, with the letters people mix up costing less ────────────────────────────────
const CLOSE = ['اأإآءعئ', 'هةح', 'يىئ', 'وؤ', 'زذظ', 'سصث', 'تطث', 'دض', 'ضظ', 'قكء', 'غع', 'خح'];
const near = (a: string, b: string) => CLOSE.some((g) => g.includes(a) && g.includes(b));
/** Damerau–Levenshtein: a missing/extra letter or two swapped = 1, a mixed-up letter = 0.5. */
export function wordDistance(a: string, b: string): number {
  const n = a.length; const m = b.length;
  const d: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const sub = a[i - 1] === b[j - 1] ? 0 : near(a[i - 1]!, b[j - 1]!) ? 0.5 : 1;
      // A doubled letter typed once (or once typed twice) is a light slip.
      const del = a[i - 1] === a[i - 2] ? 0.5 : 1; const ins = b[j - 1] === b[j - 2] ? 0.5 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + del, d[i]![j - 1]! + ins, d[i - 1]![j - 1]! + sub);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
    }
  }
  return d[n]![m]!;
}
/** How far a word may be from the one meant: short words must be nearly right. */
const allowed = (len: number) => (len <= 4 ? 0.5 : len <= 6 ? 1 : len <= 9 ? 1.5 : 2);

const known = (lex: Lexicon, key: string) => lex.words.has(key);
/** The closest known word, when it is clearly the closest; undefined when unsure. */
export function closestWord(lex: Lexicon, key: string): string | undefined {
  if (key.length < 3 || known(lex, key)) return undefined;
  const limit = allowed(key.length);
  let best: { w: string; d: number; f: number }[] = [];
  for (let len = key.length - 2; len <= key.length + 2; len++) {
    for (const w of lex.byLength.get(len) || []) {
      if (w.length < 3) continue;
      const d = wordDistance(key, w);
      // A short word with one letter missing («تريز» → «تركيز») is the commonest slip; a changed letter in a short
      // word usually makes another real word («بلدي» is not «جلدي»).
      if (d > (key.length === 4 && w.length === 5 ? 1 : limit)) continue;
      if (!best.length || d < best[0]!.d) best = [{ w, d, f: lex.words.get(w)! }];
      else if (d === best[0]!.d) best.push({ w, d, f: lex.words.get(w)! });
    }
  }
  if (!best.length) return undefined;
  best.sort((x, y) => y.f - x.f);
  // Two different words just as close and just as common: he does not guess (two spellings of one word are fine).
  const [a, b] = [best[0]!.w, best[1]?.w];
  if (b && best[1]!.f >= best[0]!.f * 0.6 && wordDistance(a, b) > 1 && !a.startsWith(b) && !b.startsWith(a)) return undefined;
  return best[0]!.w;
}

// ── Arabic typed with the English keyboard ─────────────────────────────────────────────────────────────────
const KEYS: Record<string, string> = {
  q: 'ض', w: 'ص', e: 'ث', r: 'ق', t: 'ف', y: 'غ', u: 'ع', i: 'ه', o: 'خ', p: 'ح', '[': 'ج', ']': 'د', a: 'ش', s: 'س', d: 'ي', f: 'ب', g: 'ل',
  h: 'ا', j: 'ت', k: 'ن', l: 'م', ';': 'ك', "'": 'ط', z: 'ئ', x: 'ء', c: 'ؤ', v: 'ر', b: 'لا', n: 'ى', m: 'ة', ',': 'و', '.': 'ز', '/': 'ظ', '`': 'ذ',
};
/** With Shift: the hamza forms (other capitals are read as the plain key — phones capitalise the first letter). */
const SHIFT: Record<string, string> = { H: 'أ', Y: 'إ', N: 'آ', G: 'لأ', T: 'لإ', B: 'لآ', '?': '؟' };
export const fromEnglishKeyboard = (text: string) => [...text]
  .map((c, i, all) => (i > 0 && !/\s/.test(all[i - 1]!) ? SHIFT[c] : c === '?' ? SHIFT[c] : undefined) ?? KEYS[c.toLowerCase()] ?? c).join('');

const latinWords = (text: string) => text.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 2);
/**
 * The question typed in Arabic with the English keyboard on, converted; undefined when it reads as English (or as
 * nothing he knows). Decided by the words: the Arabic reading must be words he knows (or near them), the English not.
 */
export function keyboardFix(text: string, lex: Lexicon = baseLexicon()): string | undefined {
  if (/[\u0600-\u06FF]/.test(text) || !/[a-z]/i.test(text)) return undefined;
  const converted = fromEnglishKeyboard(text);
  const arabic = converted.split(/\s+/).map(wordKey).filter((w) => w.length >= 2);
  if (!arabic.length) return undefined;
  const arKnown = arabic.filter((w) => known(lex, w) || (w.length >= 4 && closestWord(lex, w))).length;
  const english = latinWords(text);
  const enKnown = english.filter((w) => known(lex, w) || (w.length >= 5 && closestWord(lex, w))).length;
  if (arKnown === 0 || arKnown <= enKnown || arKnown * 2 < arabic.length) return undefined;
  return converted.replace(/\s+/g, ' ').trim();
}

// ── The question, understood ───────────────────────────────────────────────────────────────────────────────
/** One word: known as is, or the word meant (with its «ال» kept), or two words written together. */
function fixWord(lex: Lexicon, raw: string): { text: string; how: SpellingFix['how'] } | undefined {
  const norm = normalizeQuestion(raw);
  const t = norm.replace(/(\p{L})\1{2,}/gu, '$1'); // «عطررر» → «عطر»
  const key = wordKey(t);
  // Egyptian verbs («بتروح», «هيعمل») are many and rarely perfume words: never «corrected».
  if (DIALECT_VERB.test(key)) return undefined;
  // Numbers, «What's», «e-mail»: left as typed. Latin words under 5 letters are too short to guess.
  if (key.length < 3 || /\d/.test(key) || /[^\p{L}]/u.test(norm) || (/^[a-z]+$/.test(key) && key.length < 5)) return undefined;
  if (known(lex, key)) return t !== norm ? { text: t, how: 'letters' } : undefined;
  const article = t.match(ARTICLE)?.[1] || '';
  const stem = t.slice(article.length).replace(/ة$/u, 'ه');
  // «الوتس» → «اللوتس»: the «ل» of the word swallowed by the article's.
  if (article && known(lex, `ل${stem}`)) return { text: `${article}ل${stem}`, how: 'article' };
  const meant = closestWord(lex, key);
  if (meant) return { text: `${article}${meant}`, how: 'letters' };
  // «زهرهاللوتس» → «زهره اللوتس»: two words with the space missing.
  if (t.length >= 6) {
    let split: { a: string; b: string; f: number } | undefined;
    for (let i = 2; i <= t.length - 2; i++) {
      const a = t.slice(0, i); const b = t.slice(i);
      const ka = wordKey(a); const kb = wordKey(b);
      if (ka.length < 2 || kb.length < 2 || !known(lex, ka) || !known(lex, kb)) continue;
      const f = Math.min(lex.words.get(ka)!, lex.words.get(kb)!);
      if (!split || f > split.f) split = { a, b, f };
    }
    if (split) return { text: `${split.a} ${split.b}`, how: 'split' };
  }
  return undefined;
}

/** The question as he understood it: mistyped words replaced by the words meant (only when he is sure). */
export function understandQuestion(question: string, lex: Lexicon = baseLexicon()): Understanding {
  const typed = keyboardFix(question, lex);
  const source = typed ?? question;
  const fixes: SpellingFix[] = [];
  const text = source.split(/(\s+)/).map((part) => {
    const m = part.match(/^([^\p{L}\p{N}]*)([\p{L}\p{N}][\s\S]*?)([^\p{L}\p{N}]*)$/u);
    if (!m) return part;
    const fixed = fixWord(lex, m[2]!);
    if (!fixed) return part;
    fixes.push({ from: m[2]!, to: fixed.text, how: fixed.how });
    return `${m[1]}${fixed.text}${m[3]}`;
  }).join('');
  return { text, changed: Boolean(typed) || fixes.length > 0, keyboard: Boolean(typed), fixes };
}

/** The line in front of an answer to a mistyped question: what he understood (so a wrong guess is visible). */
export function understoodNote(lang: string, u: Understanding): string {
  if (!u.changed) return '';
  return lang === 'ar' ? `✍️ _فهمت سؤالك كده: «${u.text}»_\n\n` : `✍️ _I read your question as: “${u.text}”_\n\n`;
}

// ── «مدرسة شاهين»: the spelling drill ──────────────────────────────────────────────────────────────────────
/** Typical slips of one word (deterministic): a letter dropped, two swapped, one doubled, a mixed-up letter, the article's «ل». */
export function typoVariants(word: string): { kind: string; text: string }[] {
  const w = normalizeQuestion(word);
  if (w.length < 4) return [];
  const mid = Math.floor(w.length / 2);
  const swaps: Record<string, string> = { ي: 'ب', ه: 'ة', س: 'ص', ز: 'ذ', ت: 'ط', د: 'ض', ق: 'ك', ا: 'ع', و: 'ؤ', ر: 'ز', ن: 'ت', ل: 'ك', م: 'ن', ب: 'ي' };
  const at = [...w].findIndex((c, i) => i > 0 && i < w.length - 1 && swaps[c]);
  const out = [
    { kind: 'drop', text: w.slice(0, mid) + w.slice(mid + 1) },
    { kind: 'swap', text: w.slice(0, mid - 1) + w[mid] + w[mid - 1] + w.slice(mid + 1) },
    { kind: 'double', text: w.slice(0, mid) + w[mid] + w.slice(mid) },
    at > 0 ? { kind: 'letter', text: w.slice(0, at) + swaps[w[at]!] + w.slice(at + 1) } : undefined,
    w.startsWith('ل') ? { kind: 'article', text: `ال${w.slice(1)}` } : undefined,
    { kind: 'keyboard', text: [...`ال${w}`].map((c) => Object.keys(KEYS).find((k) => KEYS[k] === c) ?? c).join('') },
  ].filter((v): v is { kind: string; text: string } => Boolean(v) && v!.text !== w);
  return out;
}

export interface SpellingDrill { tried: number; understood: number; score: number; misses: string[] }
/** Typos of the words he knows must be understood back as the same word (a typo that is itself a known word is skipped). */
export function spellingDrill(lex: Lexicon, words: string[], maxWords = 80): SpellingDrill {
  const targets = [...new Set(words.map(wordKey))].filter((k) => k.length >= 5 && known(lex, k) && !/\d|[a-z]/.test(k) && !DIALECT_VERB.test(k)).slice(0, maxWords);
  let tried = 0; let understood = 0; const misses: string[] = [];
  for (const target of targets) {
    for (const v of typoVariants(target)) {
      if (v.kind !== 'keyboard' && v.kind !== 'article' && known(lex, wordKey(v.text))) continue;
      tried++;
      const u = understandQuestion(v.text, lex);
      const got = u.text.split(/\s+/).map(wordKey);
      if (got.includes(target)) understood++;
      else if (misses.length < 8) misses.push(`${v.text} → ${u.text} (${target})`);
    }
  }
  return { tried, understood, score: tried ? Math.round((100 * understood) / tried) : 100, misses };
}
