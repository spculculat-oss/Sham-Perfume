/**
 * «بيتكلم إنجليزي مع العربي» (the owner, 2026-11-14): an Arabic reply still had Latin words in it — perfume notes
 * («top notes», «bergamot»), shop words («free shipping»), product codes and names not in the brand list — and the
 * human voice said those in English, in the middle of Egyptian Arabic.
 *
 * This is the last step before an Arabic line is spoken (server/voiceSpeak.ts, after the brand names of
 * src/utils/spokenWorld.ts and the pronunciations visitors taught): product codes go, common words are said in
 * Arabic, and any Latin word left is written in Arabic letters the way it sounds, so the voice stays Arabic.
 * Pure (no DOM), used by the server and the tests.
 */
import type { Dialect } from './arabicDialect';

/** Words said in Arabic (longest first, so «top notes» wins over «notes»). */
const ARABIC_WORDS: [string, string][] = [
  ['top notes', 'النوتات العليا'], ['head notes', 'النوتات العليا'], ['heart notes', 'نوتات القلب'], ['middle notes', 'نوتات القلب'],
  ['base notes', 'نوتات القاعدة'], ['notes', 'نوتات'], ['note', 'نوتة'], ['long lasting', 'ثباته طويل'], ['long-lasting', 'ثباته طويل'],
  ['longevity', 'الثبات'], ['projection', 'الفوحان'], ['sillage', 'الأثر'], ['free shipping', 'شحن مجاني'], ['shipping', 'الشحن'],
  ['delivery', 'التوصيل'], ['in stock', 'متوفر'], ['out of stock', 'خلصان'], ['tester', 'تستر'], ['sample', 'عينة'], ['gift set', 'طقم هدية'],
  ['unisex', 'للجنسين'], ['for men', 'رجالي'], ['for women', 'حريمي'], ['men', 'رجالي'], ['women', 'حريمي'],
  ['bergamot', 'برغموت'], ['pink pepper', 'فلفل وردي'], ['black pepper', 'فلفل أسود'], ['pepper', 'فلفل'], ['vanilla', 'فانيليا'],
  ['musk', 'مسك'], ['amber', 'عنبر'], ['oud', 'عود'], ['rose', 'ورد'], ['jasmine', 'ياسمين'], ['sandalwood', 'صندل'], ['cedarwood', 'خشب الأرز'],
  ['cedar', 'أرز'], ['patchouli', 'باتشولي'], ['leather', 'جلد'], ['tobacco', 'تبغ'], ['saffron', 'زعفران'], ['lavender', 'لافندر'],
  ['vetiver', 'فيتيفر'], ['citrus', 'حمضيات'], ['lemon', 'ليمون'], ['orange blossom', 'زهر البرتقال'], ['orange', 'برتقال'], ['apple', 'تفاح'],
  ['honey', 'عسل'], ['coffee', 'قهوة'], ['cinnamon', 'قرفة'], ['incense', 'بخور'], ['iris', 'سوسن'], ['tonka bean', 'حبوب التونكا'],
  ['tonka', 'تونكا'], ['woody', 'خشبي'], ['floral', 'زهري'], ['fresh', 'فريش'], ['sweet', 'حلو'], ['spicy', 'حار'], ['oriental', 'شرقي'],
  ['extrait', 'إكستريه'], ['intense', 'إنتنس'], ['orchid', 'أوركيد'], ['black', 'بلاك'], ['wood', 'وود'],
  ['and', 'و'], ['or', 'أو'], ['with', 'مع'], ['the', 'ذا'],
];
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const WORD_RULES = ARABIC_WORDS
  .sort((a, b) => b[0].length - a[0].length)
  .map(([en, ar]) => [new RegExp(`(?<![A-Za-z\\u00C0-\\u024F])${escape(en).replace(/[ -]/g, '[\\s-]+')}(?![A-Za-z\\u00C0-\\u024F])`, 'gi'), ar] as const);

/** Short capitals said letter by letter («DHL» → «دي إتش إل»). */
const LETTER_NAMES: Record<string, string> = {
  A: 'إيه', B: 'بي', C: 'سي', D: 'دي', E: 'إي', F: 'إف', G: 'جي', H: 'إتش', I: 'آي', J: 'جاي', K: 'كيه', L: 'إل', M: 'إم',
  N: 'إن', O: 'أو', P: 'بي', Q: 'كيو', R: 'آر', S: 'إس', T: 'تي', U: 'يو', V: 'في', W: 'دبليو', X: 'إكس', Y: 'واي', Z: 'زد',
};

const plainLatin = (word: string) => word.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** One Latin word in Arabic letters, the way it sounds (a reading aid for the voice, not a spelling). */
export function soundInArabic(word: string, dialect: Dialect = 'egyptian'): string {
  if (/^[A-Z]{2,4}$/.test(word)) return word.split('').map((c) => LETTER_NAMES[c] || c).join(' ');
  const g = dialect === 'egyptian' || dialect === 'sudanese' ? 'ج' : 'غ';
  let w = plainLatin(word).replace(/[^a-z]/g, '');
  if (!w) return word;
  // Endings and letter groups first.
  w = w.replace(/tion$/, '\u0001').replace(/ique$/, '\u0002').replace(/eau/g, 'o').replace(/(?<=.{2})e$/, '').replace(/ah$/, '\u0003');
  let out = '';
  for (let i = 0; i < w.length; i += 1) {
    const c = w[i]!; const next = w[i + 1] || ''; const pair = c + next; const first = out === '';
    if (c === '\u0001') { out += 'شن'; continue; }
    if (c === '\u0002') { out += 'يك'; continue; }
    if (c === '\u0003') { out += 'ة'; continue; }
    if (pair === 'sh' || pair === 'ch') { out += 'ش'; i += 1; continue; }
    if (pair === 'th') { out += 'ث'; i += 1; continue; }
    if (pair === 'ph') { out += 'ف'; i += 1; continue; }
    if (pair === 'kh') { out += 'خ'; i += 1; continue; }
    if (pair === 'gh') { out += 'غ'; i += 1; continue; }
    if (pair === 'ck') { out += 'ك'; i += 1; continue; }
    if (pair === 'qu') { out += 'كو'; i += 1; continue; }
    if (pair === 'oo' || pair === 'ou') { out += first ? 'أو' : 'و'; i += 1; continue; }
    if (pair === 'ee' || pair === 'ea' || pair === 'ie') { out += first ? 'إي' : 'ي'; i += 1; continue; }
    if (pair === 'ai' || pair === 'ay' || pair === 'ei') { out += first ? 'إي' : 'ي'; i += 1; continue; }
    if (c === next && !'aeiou'.includes(c)) continue; // double consonants are said once
    const last = i === w.length - 1;
    switch (c) {
      case 'a': out += first ? 'أ' : 'ا'; break;
      case 'e': out += first ? 'إ' : last ? 'ي' : 'ي'; break;
      case 'i': out += first ? 'إ' : 'ي'; break;
      case 'o': out += first ? 'أو' : 'و'; break;
      case 'u': out += first ? 'أو' : 'و'; break;
      case 'y': out += 'ي'; break;
      case 'c': out += 'eiy'.includes(next) && next ? 'س' : 'ك'; break;
      case 'g': out += 'eiy'.includes(next) && next ? 'ج' : g; break;
      case 'j': out += 'ج'; break;
      case 'x': out += 'كس'; break;
      case 'q': out += 'ك'; break;
      case 'v': out += 'ف'; break;
      case 'p': out += 'ب'; break;
      case 'w': out += 'و'; break;
      default: out += ({ b: 'ب', d: 'د', f: 'ف', h: 'ه', k: 'ك', l: 'ل', m: 'م', n: 'ن', r: 'ر', s: 'س', t: 'ت', z: 'ز' } as Record<string, string>)[c] || '';
    }
  }
  return out.replace(/([اىي])\1+/g, '$1').replace(/و{3,}/g, 'وو') || word;
}

/** The Arabic line as the voice should get it: no product codes, common words in Arabic, the rest in Arabic letters. */
export function arabicSpeechText(text: string, dialect: Dialect = 'egyptian'): string {
  if (!/[A-Za-z\u00C0-\u024F]/.test(text)) return text;
  let out = text
    // «SKU: LAT-095», «(LAT-095)»: a code is for the screen, not for the ear.
    .replace(/\b(?:SKU|sku|Sku)\s*[:：#-]?\s*/g, '')
    .replace(/[([]?\b[A-Z]{2,5}-\d{2,5}\b[)\]]?/g, ' ')
    .replace(/(?<![A-Za-z])ml(?![A-Za-z])/gi, 'مللي')
    .replace(/الـ\s*(?=[A-Za-z])/g, 'ال');
  for (const [re, ar] of WORD_RULES) out = out.replace(re, ar);
  out = out.replace(/[A-Za-z\u00C0-\u024F]+(?:['’][A-Za-z]+)?/g, (word) => soundInArabic(word, dialect));
  // «الـ top notes» → «النوتات العليا», «الـ bergamot» → «البرغموت».
  out = out.replace(/الال/g, 'ال');
  return out.replace(/\s+([،,.!?؟])/g, '$1').replace(/\s{2,}/g, ' ').trim();
}
