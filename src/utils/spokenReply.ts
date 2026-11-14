/**
 * «شاهين بيتكلم مش بيقرا»: a written reply turned into what a person would SAY — before the browser voice reads it.
 *   - the page's structure becomes talk: titles, lists, product cards and «·» separators become flowing sentences;
 *   - numbers, prices, percentages, ranges and units are said the way people say them («٥٠٠ جنيه» → «خمسمية جنيه»,
 *     «20%» → «عشرين في المية», «6-8 ساعات» → «من ست لتمن ساعات»), in the visitor's dialect;
 *   - heavy written words become everyday ones («لذلك» → «عشان كده», «الآن» → «دلوقتي» / «الحين» / «هلق»);
 *   - a long reply is not read to the end: he says the main part and asks «تحب أكمّلك؟» (the rest is in the chat,
 *     and «أيوه / كمّل» goes on from where he stopped, without a new question to the server).
 * Pure (no DOM): the voice hook, the chat's «اسمع الرد» button and the tests use it.
 */
import type { SupportedLanguage } from '../types/i18n';
import type { Dialect } from './arabicDialect';
import { removeMediaBlocks } from './mediaBlock';
import { removeFormulaBlocks } from './aiFormulaExtractor';
import { removeToolBlocks } from './shaheenTools';
import { plainMath } from './shaheenText';
import { talkify } from './talkStyle';
import { arabicBrandNames, MORE_WORLD, speakWorldNumbers, wantsMoreWorld, worldTerms } from './spokenWorld';
import { shaheenSpeechLocale } from './shaheenVoice';

// ── Numbers as people say them ───────────────────────────────────────────────────────────────────────────
interface NumberWords {
  units: string[]; tens: string[]; hundreds: string[];
  /** 3–10 before a counted plural («تلات ساعات», «ثلاث ساعات»). */
  counted: string[];
  thousand: [one: string, two: string, few: string, many: string];
  million: [one: string, two: string, few: string, many: string];
  half: string; quarter: string; threeQuarters: string; point: string; and: string;
  percent: string; to: string; from: string; about: string;
}
const EGYPTIAN: NumberWords = {
  units: ['صفر', 'واحد', 'اتنين', 'تلاتة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'تمانية', 'تسعة', 'عشرة', 'حداشر', 'اتناشر', 'تلتاشر', 'أربعتاشر', 'خمستاشر', 'ستاشر', 'سبعتاشر', 'تمنتاشر', 'تسعتاشر'],
  tens: ['', '', 'عشرين', 'تلاتين', 'أربعين', 'خمسين', 'ستين', 'سبعين', 'تمانين', 'تسعين'],
  hundreds: ['', 'مية', 'ميتين', 'تلتمية', 'ربعمية', 'خمسمية', 'ستمية', 'سبعمية', 'تمنمية', 'تسعمية'],
  counted: ['', '', '', 'تلات', 'أربع', 'خمس', 'ست', 'سبع', 'تمن', 'تسع', 'عشر'],
  thousand: ['ألف', 'ألفين', 'تلاف', 'ألف'], million: ['مليون', 'مليونين', 'ملايين', 'مليون'],
  half: 'نص', quarter: 'ربع', threeQuarters: 'تلت تربع', point: 'فاصلة', and: 'و', percent: 'في المية', to: 'ل', from: 'من', about: 'حوالي',
};
/** A plain spoken Arabic understood everywhere (Gulf, Levant, Iraq, Maghreb, Sudan, Yemen). */
const WHITE: NumberWords = {
  units: ['صفر', 'واحد', 'اثنين', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'إحدعش', 'اثنعش', 'ثلاثطعش', 'أربعطعش', 'خمسطعش', 'ستطعش', 'سبعطعش', 'ثمنطعش', 'تسعطعش'],
  tens: ['', '', 'عشرين', 'ثلاثين', 'أربعين', 'خمسين', 'ستين', 'سبعين', 'ثمانين', 'تسعين'],
  hundreds: ['', 'مية', 'ميتين', 'ثلاثمية', 'أربعمية', 'خمسمية', 'ستمية', 'سبعمية', 'ثمانمية', 'تسعمية'],
  counted: ['', '', '', 'ثلاث', 'أربع', 'خمس', 'ست', 'سبع', 'ثمان', 'تسع', 'عشر'],
  thousand: ['ألف', 'ألفين', 'آلاف', 'ألف'], million: ['مليون', 'مليونين', 'ملايين', 'مليون'],
  half: 'نص', quarter: 'ربع', threeQuarters: 'ثلاث أرباع', point: 'فاصلة', and: 'و', percent: 'بالمية', to: 'ل', from: 'من', about: 'تقريباً',
};
const MSA: NumberWords = {
  ...WHITE,
  units: ['صفر', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'],
  tens: ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'],
  hundreds: ['', 'مئة', 'مئتان', 'ثلاثمئة', 'أربعمئة', 'خمسمئة', 'ستمئة', 'سبعمئة', 'ثمانمئة', 'تسعمئة'],
  thousand: ['ألف', 'ألفان', 'آلاف', 'ألف'], million: ['مليون', 'مليونان', 'ملايين', 'مليون'],
  half: 'نصف', quarter: 'ربع', threeQuarters: 'ثلاثة أرباع', percent: 'بالمئة', to: 'إلى ', about: 'حوالي',
};
/** Levantine (Damascus, Beirut, Amman): «تنين، تلاتة، تمانية، حدعش، تلتمية». */
const LEVANTINE: NumberWords = {
  ...WHITE,
  units: ['صفر', 'واحد', 'تنين', 'تلاتة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'تمانية', 'تسعة', 'عشرة', 'حدعش', 'تنعش', 'تلطعش', 'أربعطعش', 'خمسطعش', 'ستطعش', 'سبعطعش', 'تمنطعش', 'تسعطعش'],
  tens: ['', '', 'عشرين', 'تلاتين', 'أربعين', 'خمسين', 'ستين', 'سبعين', 'تمانين', 'تسعين'],
  hundreds: ['', 'مية', 'ميتين', 'تلتمية', 'أربعمية', 'خمسمية', 'ستمية', 'سبعمية', 'تمنمية', 'تسعمية'],
  counted: ['', '', '', 'تلات', 'أربع', 'خمس', 'ست', 'سبع', 'تمن', 'تسع', 'عشر'],
  threeQuarters: 'تلت تربع', percent: 'بالمية',
};
/** Iraqi: «ثنين، دعش، ثنعش، ثلثمية». */
const IRAQI: NumberWords = {
  ...WHITE,
  units: ['صفر', 'واحد', 'ثنين', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'دعش', 'ثنعش', 'ثلطعش', 'أربعطعش', 'خمسطعش', 'ستطعش', 'سبعطعش', 'ثمنطعش', 'تسعطعش'],
  hundreds: ['', 'مية', 'ميتين', 'ثلثمية', 'أربعمية', 'خمسمية', 'ستمية', 'سبعمية', 'ثمنمية', 'تسعمية'],
};
/** Maghrebi, understood from Rabat to Tunis: «زوج، ربعة، حداش، طناش، تلت مية، فالمية». */
const MAGHREBI: NumberWords = {
  ...WHITE,
  units: ['صفر', 'واحد', 'زوج', 'تلاتة', 'ربعة', 'خمسة', 'ستة', 'سبعة', 'تمنية', 'تسعة', 'عشرة', 'حداش', 'طناش', 'تلطاش', 'ربعطاش', 'خمسطاش', 'سطاش', 'سبعطاش', 'تمنطاش', 'تسعطاش'],
  tens: ['', '', 'عشرين', 'تلاتين', 'ربعين', 'خمسين', 'ستين', 'سبعين', 'تمانين', 'تسعين'],
  hundreds: ['', 'مية', 'ميتين', 'تلتمية', 'ربعمية', 'خمسمية', 'ستمية', 'سبعمية', 'تمنمية', 'تسعمية'],
  counted: ['', '', '', 'تلت', 'ربع', 'خمس', 'ست', 'سبع', 'تمن', 'تسع', 'عشر'],
  thousand: ['ألف', 'ألفين', 'آلاف', 'ألف'],
  threeQuarters: 'تلت ربع', percent: 'فالمية',
};
const NUMBER_SETS: Partial<Record<Dialect, NumberWords>> = { egyptian: EGYPTIAN, sudanese: EGYPTIAN, msa: MSA, levantine: LEVANTINE, iraqi: IRAQI, maghrebi: MAGHREBI };
/** Each dialect's own number words (Gulf and Yemeni use the plain spoken Arabic understood everywhere). */
const wordsFor = (dialect?: Dialect) => NUMBER_SETS[dialect || 'egyptian'] || WHITE;

function under1000(n: number, w: NumberWords): string {
  const h = Math.floor(n / 100); const r = n % 100;
  const rest = r < 20 ? (r ? w.units[r]! : '') : `${r % 10 ? `${w.units[r % 10]} ${w.and}` : ''}${w.tens[Math.floor(r / 10)]}`;
  return [h ? w.hundreds[h]! : '', rest].filter(Boolean).join(` ${w.and}`);
}
function scaled(k: number, names: NumberWords['thousand'], w: NumberWords): string {
  if (k === 1) return names[0];
  if (k === 2) return names[1];
  if (k <= 10) return `${w.counted[k]} ${names[2]}`;
  return `${under1000(k, w)} ${names[3]}`;
}
/** A whole number in words, the way it is said («1250» → «ألف وميتين وخمسين»). Up to 999,999,999. */
export function numberInWords(n: number, dialect?: Dialect): string {
  const w = wordsFor(dialect);
  if (!Number.isFinite(n) || n < 0 || n > 999_999_999) return String(n);
  n = Math.floor(n);
  if (n === 0) return w.units[0]!;
  const millions = Math.floor(n / 1_000_000); const thousands = Math.floor((n % 1_000_000) / 1000); const rest = n % 1000;
  return [millions ? scaled(millions, w.million, w) : '', thousands ? scaled(thousands, w.thousand, w) : '', rest ? under1000(rest, w) : '']
    .filter(Boolean).join(` ${w.and}`);
}
/** «2.5» → «اتنين ونص», «0.25» → «ربع», «7.3» → «سبعة فاصلة تلاتة». */
function decimalInWords(whole: number, fraction: string, dialect?: Dialect): string {
  const w = wordsFor(dialect);
  const f = Number(`0.${fraction}`);
  const named = Math.abs(f - 0.5) < 1e-9 ? w.half : Math.abs(f - 0.25) < 1e-9 ? w.quarter : Math.abs(f - 0.75) < 1e-9 ? w.threeQuarters : '';
  if (!fraction || /^0+$/.test(fraction)) return numberInWords(whole, dialect);
  if (named) return whole ? `${numberInWords(whole, dialect)} ${w.and}${named}` : named;
  return `${numberInWords(whole, dialect)} ${w.point} ${numberInWords(Number(fraction.replace(/0+$/, '') || '0'), dialect)}`;
}

/** Plurals that take the short counting form after 3–10 («تلات ساعات», not «تلاتة ساعات»). */
const SINGULAR_OF: Record<string, string> = {
  ساعات: 'ساعة', أيام: 'يوم', ايام: 'يوم', أسابيع: 'أسبوع', اسابيع: 'أسبوع', شهور: 'شهر', أشهر: 'شهر', اشهر: 'شهر', سنين: 'سنة', سنوات: 'سنة', دقايق: 'دقيقة',
  دقائق: 'دقيقة', مرات: 'مرة', خيارات: 'خيار', اختيارات: 'اختيار', عطور: 'عطر', قطرات: 'قطرة', نقط: 'نقطة', بخات: 'بخة', رشات: 'رشة', ثواني: 'ثانية',
};
const COUNTED_PLURAL = /^(?:خيارات|اختيارات|عطور|ترشيحات|حاجات|نصايح|نصائح|أسئلة|ألوان|خطوات|ساعات|أيام|ايام|أسابيع|اسابيع|شهور|أشهر|اشهر|سنين|سنوات|دقايق|دقائق|مرات|نقط|نقاط|قطرات|أنواع|انواع|طبقات|مكونات|زجاجات|إزازات|ازازات|بخات|رشات|ثواني|ثوان)$/u;

const CURRENCY_AFTER: [RegExp, string][] = [
  [/^(?:ج\.م\.?|جنيه|جنيهاً|جنيها|EGP|LE)/u, 'جنيه'], [/^(?:US\$|USD|\$|دولار)/u, 'دولار'], [/^(?:€|EUR|يورو)/u, 'يورو'],
  [/^(?:UK£|GBP|£)/u, 'جنيه إسترليني'], [/^(?:ر\.س\.?|ر\.ق\.?|ر\.ع\.?|ر\.ي\.?|SAR|QAR|OMR|YER|ريال)/u, 'ريال'],
  [/^(?:د\.إ\.?|د\.م\.?|AED|MAD|درهم)/u, 'درهم'], [/^(?:د\.ك\.?|د\.ب\.?|د\.أ\.?|د\.ا\.?|د\.ع\.?|د\.ج\.?|د\.ت\.?|د\.ل\.?|KWD|BHD|JOD|IQD|DZD|TND|LYD|دينار)/u, 'دينار'],
  [/^(?:ل\.ل\.?|ل\.س\.?|₺|TRY|ليرة)/u, 'ليرة'], [/^(?:ج\.س\.?|SDG)/u, 'جنيه'],
];
const UNIT_AFTER: [RegExp, string][] = [
  [/^(?:مل|ml|mL|ML|ملي|مللي)(?![\p{L}])/u, 'مللي'], [/^(?:كجم|kg|كيلو)(?![\p{L}])/u, 'كيلو'], [/^(?:جم|g|gr|جرام|غرام)(?![\p{L}])/u, 'جرام'],
  [/^(?:°C|°|درجة)(?![\p{L}])/u, 'درجة'], [/^(?:oz|أونصة)(?![\p{L}])/u, 'أونصة'], [/^(?:سم|cm)(?![\p{L}])/u, 'سنتي'],
];
const CURRENCY_BEFORE: [RegExp, string][] = [
  [/(?:US\$|\$|USD\s?)$/u, 'دولار'], [/(?:€|EUR\s?)$/u, 'يورو'], [/(?:UK£|£|GBP\s?)$/u, 'جنيه إسترليني'], [/(?:EGP\s?|LE\s?)$/u, 'جنيه'],
  [/(?:SAR\s?|QAR\s?|OMR\s?)$/u, 'ريال'], [/(?:AED\s?|MAD\s?)$/u, 'درهم'], [/(?:KWD\s?|BHD\s?|JOD\s?)$/u, 'دينار'],
];

const NUMBER = /(\d{1,3}(?:[,٬]\d{3})+|\d+)(?:[.٫](\d+))?/gu;
const toLatinDigits = (text: string) => text.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));

/** Numbers, prices, percentages, ranges, fractions and math signs said in Arabic words. */
export function speakArabicNumbers(input: string, dialect?: Dialect): string {
  const w = wordsFor(dialect);
  let text = toLatinDigits(input).replace(/[\u200E\u200F\u061C]/g, '');
  // Simple fractions and math signs.
  text = text.replace(/(?<![\d/])1\/2(?![\d/])/g, w.half).replace(/(?<![\d/])1\/4(?![\d/])/g, w.quarter).replace(/(?<![\d/])3\/4(?![\d/])/g, w.threeQuarters)
    .replace(/\s*×\s*/g, ' في ').replace(/\s*÷\s*/g, ' على ').replace(/\s*≈\s*/g, ` ${w.about} `).replace(/\s*=\s*(?=\d)|(?<=\d)\s*=\s*/g, dialect === 'msa' ? ' يساوي ' : ' يبقى ')
    .replace(/(?<=\d)\s*\+\s*(?=\d)/g, ' زائد ').replace(/(?<![\p{L}\d])~\s*(?=\d)/gu, `${w.about} `);
  // Ranges: «6-8 ساعات» → «من ست لتمن ساعات».
  text = text.replace(/(?<![\d.,٫٬])(\d+)\s*[-–—]\s*(\d+)(?![\d.,٫٬])(\s*)(\S*)/gu, (_m, a: string, b: string, space: string, noun: string, offset: number, all: string) => {
    const counted = COUNTED_PLURAL.test(noun.replace(/[^\p{L}]+$/u, ''));
    const say = (n: number) => (counted && n >= 3 && n <= 10 ? w.counted[n]! : numberInWords(n, dialect));
    // «من 5-7 أيام» already says «من»: not «من من خمسة لسبعة».
    const from = new RegExp(`(?:^|\\s)${w.from}\\s*$`, 'u').test(all.slice(0, offset)) ? '' : `${w.from} `;
    return `${from}${say(Number(a))} ${w.to}${say(Number(b))}${space}${noun}`;
  });
  // Currency written before the number («€21», «US$23.50», «EGP 1,250»).
  text = text.replace(/(US\$|UK£|USD\s?|EUR\s?|GBP\s?|EGP\s?|SAR\s?|QAR\s?|OMR\s?|AED\s?|MAD\s?|KWD\s?|BHD\s?|JOD\s?|LE\s?|\$|€|£)(\d{1,3}(?:[,٬]\d{3})+|\d+)(?:[.٫](\d+))?/gu,
    (_m, sign: string, whole: string, fraction = '') => `${whole}${fraction ? `.${fraction}` : ''} ${CURRENCY_BEFORE.find(([re]) => re.test(sign))?.[1] || ''}`.trimEnd());
  // A price with a half or a quarter: «16.50 €» → «ستاشر يورو ونص».
  text = text.replace(new RegExp(`(\\d{1,3}(?:[,٬]\\d{3})+|\\d+)[.٫](50?|25|75)\\s*(${CURRENCY_AFTER.map(([re]) => re.source.slice(1)).join('|')})(?![\\p{L}])`, 'gu'),
    (_m, whole: string, fraction: string, sign: string) => {
      const named = fraction.startsWith('5') ? w.half : fraction === '25' ? w.quarter : w.threeQuarters;
      return `${numberInWords(Number(whole.replace(/[,٬]/g, '')), dialect)} ${CURRENCY_AFTER.find(([re]) => re.test(sign))?.[1] || sign} ${w.and}${named}`;
    });
  // «11 ساعات» is said «حداشر ساعة»: from eleven on, the counted noun is singular.
  text = text.replace(/(?<![\d.,٫٬])(\d{2,})(\s+)(\p{L}+)/gu, (m, digits: string, space: string, noun: string) => (Number(digits) >= 11 && SINGULAR_OF[noun] ? `${digits}${space}${SINGULAR_OF[noun]}` : m));
  // Every number left, with what follows it (a currency, a unit, «%», a counted plural).
  return text.replace(NUMBER, (match, whole: string, fraction: string | undefined, offset: number, all: string) => {
    const digits = whole.replace(/[,٬]/g, '');
    // Phone numbers, codes and long references are left as they are.
    if (digits.length > 9 || /[a-z]/i.test(all[offset - 1] || '')) return match;
    const after = all.slice(offset + match.length).replace(/^\s+/, '');
    const n = Number(digits);
    if (/^[%٪]/.test(after)) return `${decimalInWords(n, fraction || '', dialect)} ${w.percent}`;
    const noun = (after.split(/\s+/)[0] || '').replace(/[^\p{L}]+$/u, '');
    if (!fraction && n >= 3 && n <= 10 && COUNTED_PLURAL.test(noun)) return w.counted[n]!;

    if (CURRENCY_AFTER.some(([re]) => re.test(after)) && fraction && fraction.length === 2 && !['00', '50', '25', '75'].includes(fraction)) {
      return `${numberInWords(n, dialect)} ${w.point} ${numberInWords(Number(fraction), dialect)}`;
    }
    return decimalInWords(n, fraction || '', dialect);
  })
    .replace(/(?<=[\p{L}])\s*[%٪]/gu, '')
    .replace(new RegExp(`(?<=[\\p{L}])\\s+(${CURRENCY_AFTER.map(([re]) => re.source.slice(1)).join('|')})(?![\\p{L}])`, 'gu'), (m, sign: string) => ` ${CURRENCY_AFTER.find(([re]) => re.test(sign))?.[1] || sign}`)
    .replace(new RegExp(`(?<=[\\p{L}])\\s*(${UNIT_AFTER.map(([re]) => re.source.slice(1)).join('|')})`, 'gu'), (m, unit: string, offset: number, all: string) => {
      // Only right after a number we just said (a letter, then the unit): «خمسين مل» → «خمسين مللي».
      const before = all.slice(0, offset).split(/\s+/).pop() || '';
      return /[\u0600-\u06FF]$/.test(before) && NUMBER_WORD.test(before) ? ` ${UNIT_AFTER.find(([re]) => re.test(unit))?.[1] || unit}` : m;
    });
}
/** The last word of a number said in words (so «مل» after it is read as «مللي», and nowhere else). */
const NUMBER_WORD = new RegExp(`(?:${[...new Set([...[EGYPTIAN, WHITE, MSA, LEVANTINE, IRAQI, MAGHREBI].flatMap((w) => [...w.units, ...w.tens, ...w.hundreds, ...w.counted]), 'ألف', 'ألفين', 'ألفان', 'آلاف', 'تلاف', 'مليون', 'مليونين', 'ملايين', 'نص', 'نصف', 'ربع', 'تربع', 'أرباع'])].filter((x) => x && !x.includes(' ')).join('|')})$`, 'u');

// ── Everyday words instead of written ones ───────────────────────────────────────────────────────────────
const COMMON_SWAPS: [string, string][] = [['الذي', 'اللي'], ['التي', 'اللي'], ['الذين', 'اللي'], ['اللذان', 'اللي'], ['اللتان', 'اللي']];
const SWAPS: Partial<Record<Dialect, [string, string][]>> = {
  egyptian: [
    ['يجب أن', 'لازم'], ['ينبغي أن', 'المفروض'], ['يمكنك أن', 'ممكن'], ['يمكن أن', 'ممكن'], ['هذا', 'ده'], ['هذه', 'دي'], ['هؤلاء', 'دول'], ['ذلك', 'ده'], ['تلك', 'دي'], ['لماذا', 'ليه'], ['ماذا', 'إيه'], ['كيف', 'إزاي'],
    ['أين', 'فين'], ['متى', 'إمتى'], ['الآن', 'دلوقتي'], ['لذلك', 'عشان كده'], ['لذا', 'عشان كده'], ['لأن', 'عشان'], ['لأنه', 'عشان هو'],
    ['لكن', 'بس'], ['ولكن', 'بس'], ['يجب', 'لازم'], ['ينبغي', 'المفروض'], ['يمكنك', 'ممكن'], ['يمكن', 'ممكن'], ['أريد', 'عايز'],
    ['تريد', 'عايز'], ['نعم', 'أيوه'], ['ليس', 'مش'], ['ليست', 'مش'], ['لا يوجد', 'مفيش'], ['يوجد', 'فيه'], ['جيد', 'كويس'],
    ['جيدة', 'كويسة'], ['كثيراً', 'كتير'], ['كثيرا', 'كتير'], ['أيضاً', 'كمان'], ['أيضا', 'كمان'], ['فقط', 'بس'], ['هناك', 'فيه'],
    ['سوف', 'هـ'], ['جداً', 'قوي'], ['أخرى', 'تانية'],
  ],
  gulf: [
    ['يجب أن', 'لازم'], ['يجب', 'لازم'], ['هؤلاء', 'هذولا'], ['نعم', 'إيه'], ['ليس', 'مو'], ['ليست', 'مو'], ['أيضاً', 'بعد'], ['أيضا', 'بعد'], ['ماذا', 'وش'], ['لماذا', 'ليش'], ['أين', 'وين'], ['الآن', 'الحين'], ['أريد', 'أبي'], ['تريد', 'تبي'], ['لا يوجد', 'ما فيه'],
    ['جيد', 'زين'], ['جيدة', 'زينة'], ['كثيراً', 'وايد'], ['كثيرا', 'وايد'], ['فقط', 'بس'], ['لكن', 'بس'], ['ولكن', 'بس'], ['لذلك', 'عشان كذا'],
    ['يوجد', 'فيه'], ['هناك', 'فيه'],
  ],
  levantine: [
    ['هذا', 'هاد'], ['هذه', 'هاي'], ['ماذا', 'شو'], ['لماذا', 'ليش'], ['أين', 'وين'], ['الآن', 'هلق'], ['أريد', 'بدي'], ['تريد', 'بدك'],
    ['لا يوجد', 'ما في'], ['جيد', 'منيح'], ['جيدة', 'منيحة'], ['كثيراً', 'كتير'], ['كثيرا', 'كتير'], ['فقط', 'بس'], ['لكن', 'بس'], ['ولكن', 'بس'],
    ['متى', 'إيمتى'], ['نعم', 'إي'], ['ليس', 'مش'], ['ليست', 'مش'], ['يجب أن', 'لازم'], ['يجب', 'لازم'], ['يمكنك أن', 'فيك'], ['يمكنك', 'فيك'],
    ['يمكن أن', 'ممكن'], ['يمكن', 'ممكن'], ['هؤلاء', 'هدول'], ['ذلك', 'هداك'], ['تلك', 'هديك'], ['لذلك', 'منشان هيك'], ['لذا', 'منشان هيك'],
    ['لأن', 'لأنو'], ['أيضاً', 'كمان'], ['أيضا', 'كمان'], ['يوجد', 'في'], ['هناك', 'في'], ['جداً', 'كتير'],
  ],
  iraqi: [
    ['ماذا', 'شنو'], ['لماذا', 'ليش'], ['أين', 'وين'], ['الآن', 'هسة'], ['جيد', 'زين'], ['كثيراً', 'هواية'], ['كثيرا', 'هواية'], ['فقط', 'بس'], ['لكن', 'بس'],
    ['ولكن', 'بس'], ['هذه', 'هاي'], ['هؤلاء', 'هذوله'], ['كيف', 'شلون'], ['متى', 'شوكت'], ['نعم', 'إي'], ['ليس', 'مو'], ['ليست', 'مو'],
    ['لا يوجد', 'ماكو'], ['يوجد', 'أكو'], ['هناك', 'أكو'], ['أيضاً', 'هم'], ['أيضا', 'هم'], ['يجب أن', 'لازم'], ['يجب', 'لازم'], ['جداً', 'كلش'],
  ],
  maghrebi: [
    ['ماذا', 'اشنو'], ['لماذا', 'علاش'], ['كيف', 'كيفاش'], ['أين', 'فين'], ['الآن', 'دابا'], ['أريد', 'بغيت'], ['جيد', 'مزيان'], ['كثيراً', 'بزاف'], ['كثيرا', 'بزاف'], ['فقط', 'غير'],
    ['هذا', 'هاد'], ['هذه', 'هادي'], ['هؤلاء', 'هادو'], ['لا يوجد', 'ماكاينش'], ['يوجد', 'كاين'], ['هناك', 'كاين'], ['نعم', 'إيه'], ['ليس', 'ماشي'], ['ليست', 'ماشي'],
    ['تريد', 'بغيتي'], ['جيدة', 'مزيانة'], ['يجب أن', 'خاص'], ['يجب', 'خاص'], ['متى', 'فوقاش'], ['لذلك', 'داكشي علاش'], ['جداً', 'بزاف'],
  ],
  sudanese: [
    ['ماذا', 'شنو'], ['لماذا', 'ليه'], ['أين', 'وين'], ['الآن', 'هسي'], ['جيد', 'كويس'], ['كثيراً', 'شديد'], ['فقط', 'بس'],
    ['هذا', 'ده'], ['هذه', 'دي'], ['أريد', 'داير'], ['تريد', 'داير'], ['لا يوجد', 'مافي'], ['يوجد', 'في'], ['نعم', 'أيوه'], ['ولكن', 'بس'],
    ['يجب أن', 'لازم'], ['يجب', 'لازم'], ['جيدة', 'كويسة'], ['جداً', 'شديد'],
  ],
  yemeni: [
    ['ماذا', 'ايش'], ['لماذا', 'ليش'], ['أين', 'فين'], ['الآن', 'دحين'], ['أريد', 'أشتي'], ['جيد', 'تمام'], ['فقط', 'بس'],
    ['تريد', 'تشتي'], ['نعم', 'ايوه'], ['لا يوجد', 'مابش'], ['ولكن', 'بس'], ['لكن', 'بس'], ['يجب أن', 'لازم'], ['يجب', 'لازم'], ['كثيراً', 'كثير'], ['كثيرا', 'كثير'],
  ],
};
const DEMONSTRATIVES = new Set(['هذا', 'هذه', 'هؤلاء', 'ذلك', 'تلك']);
/** Written Arabic words said the everyday way in the visitor's dialect (whole words only; MSA is left as it is). */
export function everydayWords(text: string, dialect?: Dialect): string {
  if (dialect === 'msa') return text;
  // Egyptian puts «ده / دي / دول» after the noun: «هذا العطر» → «العطر ده».
  let out = (dialect || 'egyptian') !== 'egyptian' ? text : text
    .replace(/(?<![\p{L}\p{M}])(و|ف|ب|وب|فب)?هذا\s+(ال\p{L}+)/gu, (_m, prefix = '', noun: string) => `${prefix}${noun} ده`)
    .replace(/(?<![\p{L}\p{M}])(و|ف|ب|وب|فب)?هذه\s+(ال\p{L}+)/gu, (_m, prefix = '', noun: string) => `${prefix}${noun} دي`)
    .replace(/(?<![\p{L}\p{M}])(و|ف|ب|وب|فب)?هؤلاء\s+(ال\p{L}+)/gu, (_m, prefix = '', noun: string) => `${prefix}${noun} دول`);
  for (const [from, to] of [...(SWAPS[dialect || 'egyptian'] || []), ...COMMON_SWAPS]) {
    // «بهذا السعر» → «بهاد السعر»: «ب» joins only the pointing words (elsewhere it would split real words).
    const prefixes = DEMONSTRATIVES.has(from) ? '(و|ف|ب|وب|فب)?' : '(و|ف)?';
    const re = new RegExp(`(?<![\\p{L}\\p{M}])${prefixes}${from}(?![\\p{L}\\p{M}])`, 'gu');
    out = out.replace(re, (_m, prefix = '') => {
      // «سوف يثبت» → «هيثبت» / «حيثبت» / «بيثبت»: the future mark joins the verb after it.
      if (to.endsWith('ـ')) return `${prefix}${to.slice(0, -1)}\u2063`;
      // «ولكن» is «بس», not «وبس» (that means «and that's all»).
      if (to === 'بس' && prefix === 'و') return to;
      return `${prefix}${to}`;
    });
  }
  // «هـ» + «بيثبت» is «هيثبت» (the future takes the verb without the present «ب»).
  out = out.replace(/\u2063\s*ب(?=[يتنأا]\p{L})/gu, '').replace(/\u2063\s*(?=\p{L})/gu, '').replace(/\u2063/g, '');
  // «تقدر أن تجربه» → «تقدر تجربه»: spoken Arabic drops the written «أن» after these.
  return out.replace(/(?<![\p{L}\p{M}])((?:و|ف)?(?:تقدر|تقدري|فيك|فيكي|ممكن|لازم|بدك|بدي|عايز|عايزة|تبي|أبي|تبغى|بغيتي|بغيت|خاص|المفروض|داير|تشتي|تريد))\s+أن\s+(?=\p{L})/gu, '$1 ');
}

/** Short names that are spelt out letter by letter by browser voices. */
const SPOKEN_NAMES: [RegExp, string][] = [
  [/\bEDP\b/g, 'أو دو بارفان'], [/\bEDT\b/g, 'أو دو تواليت'], [/\bEDC\b/g, 'أو دو كولونيا'], [/\bIFRA\b/g, 'إيفرا'],
  [/\bDPG\b/g, 'دي بي جي'], [/\bDIY\b/g, 'اعملها بنفسك'],
];

// ── The page's structure as talk ─────────────────────────────────────────────────────────────────────────
const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\uFE0F\u20E3]/gu;
/** Machine and page markup removed, one line per idea, the structure kept for the next step. */
function talkLines(text: string, comma = '، '): string[] {
  const shown = plainMath(removeToolBlocks(removeFormulaBlocks(removeMediaBlocks(text))))
    .replace(/^[ \t]*(```|~~~)[^\n]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gm, ' ')
    .replace(/^[ \t]*(```|~~~)[^\n]*(?:\n[\s\S]*)?$/m, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/`([^`\n]+)`/g, '$1');
  const lines: string[] = [];
  for (const raw of shown.split('\n')) {
    let line = raw.replace(/\s+$/, '');
    if (!line.trim()) { lines.push(''); continue; }
    // Notes for the eye only: what he understood (✍️/🎧), table rules, a whole line in italics (a footnote).
    if (/^\s*(?:✍️|🎧)/u.test(line) || /^\s*\|?\s*:?-{2,}/.test(line) || /^\s*_[^_]+_\s*$/.test(line)) continue;
    const sub = /^\s{2,}[-*+•]\s+/.test(line);
    line = line
      .replace(/^\s*\|(.+)\|\s*$/, (_m, cells: string) => cells.split('|').map((c) => c.trim()).filter(Boolean).join('، '))
      .replace(/^\s*#{1,6}\s*/, '')
      .replace(/^\s*(?:[-*+•]|\d+[.)])\s+/, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1').replace(/(?<![\p{L}])_([^_]+)_(?![\p{L}])/gu, '$1')
      .replace(EMOJI, ' ')
      .replace(/\s+[—–]\s+/g, comma).replace(/\s*·\s*/g, comma).replace(/\s*\|\s*/g, comma)
      .replace(/\s*[()[\]{}]\s*/g, comma)
      .replace(/[*_~`>#]+/g, ' ')
      .replace(/\s+/g, ' ').trim();
    if (!line) continue;
    if (sub && lines.length && lines[lines.length - 1]) lines[lines.length - 1] = `${lines[lines.length - 1]!.replace(/[.،:]$/, '')}، ${line}`;
    else lines.push(line);
  }
  return lines;
}
/** Lines into sentences: a title with «:» leads into what follows it, every other line ends as a sentence. */
function sentencesOf(lines: string[], comma = '، '): string[] {
  const out: string[] = [];
  let lead = '';
  for (const line of lines) {
    if (!line) continue;
    const ends = /[.!?؟؛…]$/.test(line);
    if (/:$/.test(line)) { lead = `${lead}${line.replace(/:$/, comma.trim())} `; continue; }
    // «المكونات: الافتتاحية: برجموت» → «المكونات، الافتتاحية برجموت».
    // A label leads its value with a short pause; labels inside it are just said («الافتتاحية برجموت، القلب ورد»).
    let first = true;
    const said = `${lead}${line}`.replace(/:\s+/g, () => (first ? ((first = false), comma) : ' ')).replace(/([،,])\s*[،,]/g, '$1');
    lead = '';
    out.push(...splitSentences(ends ? said : `${said}.`));
  }
  if (lead) out.push(`${lead.trim().replace(/[،,]$/, '')}.`);
  return out;
}
const splitSentences = (text: string) => text.split(/(?<=[.!?؟؛…])\s+/u).map((s) => s.trim()).filter(Boolean);

const MORE: Record<string, string> = {
  egyptian: 'تحب أكمّلك الباقي؟', gulf: 'تبي أكمل لك الباقي؟', levantine: 'بتحب كمّلك الباقي؟', iraqi: 'تريد أكملك الباقي؟',
  maghrebi: 'بغيتي نكمّل ليك الباقي؟', sudanese: 'داير أكمّل ليك الباقي؟', yemeni: 'تشتي أكمل لك الباقي؟', msa: 'هل تريد أن أكمل؟',
  en: 'Want me to go on?', fr: 'Je continue ?', es: '¿Sigo?', it: 'Continuo?', de: 'Soll ich weitermachen?', ru: 'Продолжить?',
  zh: '要我继续说吗？', tr: 'Devam edeyim mi?', fa: 'ادامه بدهم؟',
};
const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

export interface SpokenReply {
  /** What he says now. */
  say: string;
  /** What he did not say yet (already in spoken form), for «أيوه / كمّل». */
  rest: string;
}
/**
 * The reply as Shaheen says it. `words` = about how much he says before asking «تحب أكمّلك؟» (Infinity = all of it,
 * for the «اسمع الرد» button). A short tail (under a fifth more) is said too rather than cut.
 */
/**
 * Written-only marks nobody says aloud: source numbers «[1] [2]», crossed-out words, and footnote stars.
 * (Links, code and tables are handled by prepareShaheenSpeech.)
 */
export function speechTidy(text: string): string {
  return text
    .replace(/~~[^~\n]{1,200}~~[ \t]?/g, '')
    .replace(/[ \t]*\[\d{1,3}\](?!\()/g, '')
    .replace(/(?<=\p{L})(?:\u00B9|\u00B2|\u00B3|[\u2070-\u2079])+/gu, '');
}

export function spokenReply(text: string, { language, dialect, words = 45, opener = false, locale }: {
  language: SupportedLanguage; dialect?: Dialect; words?: number;
  /** «بص،» / «بصراحة،» now and then, like talk (the live voice conversation; not the «اسمع الرد» button). */
  opener?: boolean;
  /** The speech locale (`fr-CA`, `es-MX` …): numbers and prices are said that country's way. */
  locale?: string;
}): SpokenReply {
  const arabic = language === 'ar';
  const speechLocale = locale || shaheenSpeechLocale(language);
  const prepared = (sentence: string) => {
    let s = sentence;
    if (arabic) {
      for (const [re, name] of SPOKEN_NAMES) s = s.replace(re, name);
      // A product code («SKU: LAT-095») is for the screen, not for the ear (before its digits become words).
      s = s.replace(/(?<![A-Za-z])SKU\s*[:：#]?\s*/gi, '').replace(/[([]?(?<![A-Za-z])[A-Z]{2,5}-\d{2,5}(?!\d)[)\]]?/g, ' ');
      s = arabicBrandNames(everydayWords(speakArabicNumbers(s, dialect), dialect), dialect);
    } else {
      s = speakWorldNumbers(worldTerms(s, language), language, speechLocale);
    }
    return s.replace(/^[\s،,]+/u, '').replace(/\s+([،,.!?؟])/g, '$1').replace(/[،,]+(?=[.!?؟]|$)/gu, '').replace(/([،,])[،,]+/gu, '$1').replace(/\s+/g, ' ').trim();
  };
  // «شاهين بيحكي مش بيقرا» (talkStyle.ts): lists, labels, steps and written verbs re-said as talk first.
  // Arabic and Persian pause on «،»; the other languages' voices on «,».
  const comma = arabic || language === 'fa' ? '، ' : ', ';
  const sentences = sentencesOf(talkLines(talkify(speechTidy(text), { language, dialect, opener }), comma), comma).map(prepared).filter((s) => /[\p{L}\p{N}]/u.test(s));
  if (!sentences.length) return { say: '', rest: '' };
  const total = sentences.reduce((sum, s) => sum + wordCount(s), 0);
  if (!Number.isFinite(words) || total <= words * 1.2) return { say: sentences.join(' '), rest: '' };
  const said: string[] = [];
  let count = 0;
  for (const sentence of sentences) {
    if (said.length >= 1 && count + wordCount(sentence) > words) break;
    said.push(sentence);
    count += wordCount(sentence);
  }
  const rest = sentences.slice(said.length).join(' ');
  if (!rest) return { say: said.join(' '), rest: '' };
  // Already ending on a question to him: that question is the turn's end, the rest waits in the chat.
  const ask = /[?؟？;]$/.test(said[said.length - 1]!) ? '' : ` ${arabic ? MORE[dialect || 'egyptian'] : MORE_WORLD[language as Exclude<SupportedLanguage, 'ar'>] || MORE.en}`;
  return { say: `${said.join(' ')}${ask}`, rest };
}

/** «أيوه / كمّل / قول كمان / go on»: he wants the rest of what Shaheen was saying. */
export function wantsMore(text: string): boolean {
  const t = ` ${text.toLowerCase().replace(/\p{M}/gu, '').replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ').trim()} `;
  if (/ (لا|لأ|مش عايز|خلاص|no|nope|non|nein|нет) /u.test(t)) return false;
  return wantsMoreWorld(text) || / (ايوه|أيوه|ايوا|أيوة|اه|آه|نعم|اكيد|أكيد|تمام|كمل|كمّل|كملي|اكمل|أكمل|كمله|زود|قول كمان|كمان|وبعدين|يلا|ياريت|يا ريت|ok|okay|yes|yeah|sure|go on|continue|more|oui|sí|si|ja|да|evet|بله|آره|ابي|أبي|بدي|اي|إي|يب) /u.test(t);
}
