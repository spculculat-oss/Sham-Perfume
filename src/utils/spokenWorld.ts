/**
 * «شاهين بيتكلم بكل لغات الموقع»: what spokenReply.ts does for Arabic, for the site's other languages.
 *   - prices are said in the visitor's language with the currency's real name («1 250 livres égyptiennes»,
 *     «50 Egyptian pounds», «pauni za Misri 50») — a device voice reads «EGP» as three letters;
 *   - units and percentages in full words («50 millilitres», «20 Prozent», «yüzde 20»);
 *   - numbers written the English way («1,250.50») re-written the way the language reads them («1 250,50» in French)
 *     — otherwise a French voice says «un virgule deux cent cinquante»;
 *   - ranges «6-8» said «6 à 8» / «6 bis 8»;
 *   - perfume terms and brand names the voice gets wrong: «EDP» → «Eau de Parfum» / «淡香精» / «오 드 퍼퓸», and for an
 *     Arabic voice the Latin brand names in Arabic letters («Dior» → «ديور», «Gucci» → «جوتشي» in Egypt, «غوتشي» in
 *     the Gulf and the Levant, where «ج» is not said «g»);
 *   - «تحب أكمّلك؟» and «أيوه / كمّل» in every site language.
 * Pure (no DOM); uses the platform's own Intl data, so every language the browser knows is covered.
 */
import type { SupportedLanguage } from '../types/i18n';
import type { Dialect } from './arabicDialect';

// ── Prices, units, percentages and numbers in the visitor's language ────────────────────────────────────
/** Signs written next to a price → the currency (ISO 4217). */
const SIGN_CURRENCY: [string, string][] = [
  ['US$', 'USD'], ['UK£', 'GBP'], ['R$', 'BRL'], ['C$', 'CAD'], ['A$', 'AUD'], ['$', 'USD'], ['€', 'EUR'], ['£', 'GBP'], ['₹', 'INR'], ['₺', 'TRY'],
  ['₽', 'RUB'], ['₩', 'KRW'], ['₦', 'NGN'], ['₱', 'PHP'], ['₫', 'VND'], ['₴', 'UAH'], ['₪', 'ILS'], ['฿', 'THB'], ['¥', 'JPY'],
  ['ج.م', 'EGP'], ['ر.س', 'SAR'], ['د.إ', 'AED'], ['د.ك', 'KWD'], ['ر.ق', 'QAR'], ['د.م', 'MAD'],
];
/** ISO codes that are also everyday words or units, so never read as a currency on their own. */
const NOT_A_CURRENCY = new Set(['ALL', 'TOP', 'CUP', 'MOP', 'BOB', 'GEL', 'MDL', 'MAD', 'PEN', 'SOS', 'LSL', 'MNT', 'NAD']);
const KNOWN_CURRENCY = (() => {
  try {
    const list = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('currency');
    if (list?.length) return new Set(list);
  } catch { /* Older engines: the common ones below. */ }
  return new Set(['USD', 'EUR', 'GBP', 'EGP', 'SAR', 'AED', 'KWD', 'QAR', 'BHD', 'OMR', 'JOD', 'MAD', 'TRY', 'INR', 'PKR', 'CNY', 'JPY', 'KRW', 'RUB', 'BRL', 'MXN', 'CAD', 'AUD', 'CHF', 'IDR', 'MYR', 'NGN', 'KES', 'ZAR', 'IRR']);
})();
const THREE_DECIMALS = new Set(['KWD', 'BHD', 'OMR', 'JOD', 'TND', 'LYD', 'IQD']);

const decimalSign = (locale: string) => {
  try { return new Intl.NumberFormat(locale).formatToParts(1.5).find((part) => part.type === 'decimal')?.value || '.'; } catch { return '.'; }
};
/** The written number as a value: «1,250.50», «1.250,50», «1 250,5», «12,5» (in a comma-decimal language). */
/** The value and how many decimals were written («12.50» keeps its two: said «twelve fifty», not «twelve point five»). */
function readWritten(raw: string, locale: string, threeDecimals = false): { n: number; digits: number } | undefined {
  const text = raw.replace(/[\s\u00A0\u202F']/g, '');
  const lastDot = text.lastIndexOf('.'); const lastComma = text.lastIndexOf(',');
  let whole = text; let fraction = '';
  if (lastDot >= 0 && lastComma >= 0) {
    const at = Math.max(lastDot, lastComma);
    whole = text.slice(0, at); fraction = text.slice(at + 1);
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sign = lastDot >= 0 ? '.' : ',';
    const parts = text.split(sign);
    const tail = parts[parts.length - 1]!;
    // «1,250» / «1.250»: a group of three is a thousands mark (unless the currency has three decimals);
    // «12,5» / «12.50»: a decimal mark.
    const grouping = parts.length > 2 || (tail.length === 3 && !(threeDecimals && sign === decimalSign(locale)));
    if (!grouping) { whole = parts.slice(0, -1).join(''); fraction = tail; }
  }
  whole = whole.replace(/[.,]/g, '');
  if (!/^\d+$/.test(whole) || (fraction && !/^\d+$/.test(fraction))) return undefined;
  return { n: Number(`${whole}.${fraction || '0'}`), digits: /^0+$/.test(fraction) ? 0 : Math.min(3, fraction.length) };
}
const fractionOf = (n: number) => (Number.isInteger(n) ? 0 : Math.min(3, String(n).split('.')[1]?.length || 0));
const CURRENCY_SIGNS = /[$€£¥₹₺₽₩₦₱₫₴₪฿]/u;

/** «1250.5 EGP» in the visitor's language with the currency's name; undefined when the language has no data. */
export function sayPrice(n: number, currency: string, locale: string, written?: number): string | undefined {
  const digits = written ?? fractionOf(n);
  try {
    const named = new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'name', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
    // Some languages have no names (the code or sign comes back) or a broken pattern («EGP 1.250 lirası0»): build it instead.
    if (!named.includes(currency) && !CURRENCY_SIGNS.test(named) && !/\p{L}\p{N}/u.test(named)) return named;
  } catch { return undefined; }
  try {
    const name = new Intl.DisplayNames([locale], { type: 'currency' }).of(currency);
    if (!name || name === currency) return undefined;
    return `${new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n)} ${name}`;
  } catch { return undefined; }
}

const UNITS: [RegExp, string][] = [
  [/^(?:ml|mL|ML|millilit(?:er|re)s?)(?![\p{L}])/u, 'milliliter'], [/^(?:fl\.?\s?oz)(?![\p{L}])/u, 'fluid-ounce'], [/^oz(?![\p{L}])/u, 'ounce'],
  [/^kg(?![\p{L}])/u, 'kilogram'], [/^(?:g|gr)(?![\p{L}])/u, 'gram'], [/^cm(?![\p{L}])/u, 'centimeter'], [/^°C(?![\p{L}])/u, 'celsius'],
  [/^L(?![\p{L}])/u, 'liter'],
];
/** Unit words the platform's data lacks for a few languages (only ones we are sure of). */
const UNIT_WORDS: Record<string, Partial<Record<string, string>>> = {
  vi: { percent: 'phần trăm' }, gl: { percent: 'por cento' }, lb: { percent: 'Prozent' }, tg: { milliliter: 'миллилитр', percent: 'фоиз' },
  ml: { milliliter: 'മില്ലിലിറ്റർ', percent: 'ശതമാനം' }, mt: { milliliter: 'millilitri', percent: 'fil-mija' },
};
/** «50 ml» → «50 millilitres»; undefined when the language only has the short form (the voice reads it as letters). */
export function sayUnit(n: number, unit: string, locale: string, written?: number): string | undefined {
  const digits = written ?? fractionOf(n);
  try {
    const out = new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'long', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
    if (!/(?:^|[\s\d])(?:mL|fl oz|oz|kg|g|cm|°C|L|%)(?:$|[\s\d])/u.test(out) || /^(?:zh|ja|ko|yue)/i.test(locale)) return out;
    const word = UNIT_WORDS[locale.split('-')[0]!.toLowerCase()]?.[unit];
    return word ? `${new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n)} ${word}` : undefined;
  } catch { return undefined; }
}

/** «6 à 8», «6 bis 8», «6 到 8»: the word between the two ends of a range (only where it is certain). */
const RANGE_WORD: Partial<Record<SupportedLanguage, string>> = {
  en: 'to', fr: 'à', es: 'a', it: 'a', pt: 'a', de: 'bis', nl: 'tot', sv: 'till', da: 'til', no: 'til', ru: 'до', uk: 'до', pl: 'do',
  cs: 'až', ro: 'până la', el: 'έως', tr: 'ile', fa: 'تا', ur: 'سے', hi: 'से', zh: '到', ja: 'から', id: 'sampai', ms: 'hingga', vi: 'đến',
  th: 'ถึง', he: 'עד', ca: 'a', gl: 'a',
};

const NUM = String.raw`\d{1,3}(?:[.,\u00A0\u202F]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?`;
const signPattern = SIGN_CURRENCY.map(([sign]) => sign.replace(/[.$^|()[\]{}*+?\\]/g, '\\$&')).join('|');

/**
 * Numbers, prices, units, percentages and ranges said in the visitor's language (any site language but Arabic,
 * which has its own number words in spokenReply.ts). `locale` is the speech locale (`fr-CA`, `es-MX` …).
 */
export function speakWorldNumbers(input: string, language: SupportedLanguage, locale: string): string {
  if (language === 'ar') return input;
  let text = input.replace(/[\u200E\u200F\u061C]/g, '');
  const currencyOf = (mark: string) => {
    const sign = SIGN_CURRENCY.find(([s]) => s === mark)?.[1];
    if (sign) return sign === 'JPY' && language === 'zh' ? 'CNY' : sign;
    const code = mark.toUpperCase();
    return /^[A-Z]{3}$/.test(mark) && KNOWN_CURRENCY.has(code) && !NOT_A_CURRENCY.has(code) ? code : undefined;
  };
  const price = (raw: string, mark: string, original: string) => {
    const currency = currencyOf(mark.trim());
    if (!currency) return original;
    const read = readWritten(raw, locale, THREE_DECIMALS.has(currency));
    return read === undefined ? original : sayPrice(read.n, currency, locale, read.digits) || original;
  };
  // A sign or code before the number: «€21», «US$ 23.50», «EGP 1,250».
  text = text.replace(new RegExp(`(?<![\\p{L}])(${signPattern}|[A-Z]{3})\\s?(${NUM})(?![\\d])`, 'gu'), (m, mark: string, raw: string) => price(raw, mark, m));
  // After the number: «1,250 EGP», «16.50 €», «90 $».
  text = text.replace(new RegExp(`(?<![\\d.,])(${NUM})\\s?(${signPattern}|[A-Z]{3})(?![\\p{L}])`, 'gu'), (m, raw: string, mark: string) => price(raw, mark, m));
  // Units and percentages right after a number.
  text = text.replace(new RegExp(`(?<![\\d.,\\p{L}])(${NUM})\\s?(%|٪|fl\\.?\\s?oz|millilit(?:er|re)s?|ml|mL|ML|oz|kg|gr|g|cm|°C|L)(?![\\p{L}])`, 'gu'), (m, raw: string, mark: string) => {
    const read = readWritten(raw, locale);
    if (read === undefined) return m;
    if (mark === '%' || mark === '٪') return sayUnit(read.n, 'percent', locale, read.digits) || m;
    const unit = UNITS.find(([re]) => re.test(mark))?.[1];
    return unit ? sayUnit(read.n, unit, locale, read.digits) || m : m;
  });
  // A number written the English way («1,250.50») in a comma-decimal language, or the other way round.
  const decimal = decimalSign(locale);
  text = text.replace(/(?<![\d.,\p{L}])(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+[.,]\d{1,2})(?![\d.,]?\d)/gu, (m) => {
    const english = /^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(m) && (m.includes('.') || m.split(',').length > 2);
    const european = /^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(m) && (m.includes(',') || m.split('.').length > 2);
    const shortDecimal = /^\d+[.,]\d{1,2}$/.test(m) && !m.includes(decimal);
    if (!english && !european && !shortDecimal) return m;
    const n = english ? Number(m.replace(/,/g, '')) : european ? Number(m.replace(/\./g, '').replace(',', '.')) : Number(m.replace(',', '.'));
    if ((english && decimal === '.') || (european && decimal === ',')) return m;
    try { return new Intl.NumberFormat(locale, { maximumFractionDigits: 3, useGrouping: n >= 10000 }).format(n); } catch { return m; }
  });
  // Ranges: «6-8 heures» → «6 à 8 heures» (not dates, codes or phone numbers).
  const to = RANGE_WORD[language];
  if (to) text = text.replace(/(?<![\d.,/\-–])(\d{1,3})\s?[-–—]\s?(\d{1,3})(?![\d.,/\-–])/gu, `$1 ${to} $2`);
  return text;
}

// ── Words the voices get wrong ──────────────────────────────────────────────────────────────────────────
type Terms = [edp: string, edt: string, edc: string, parfum: string];
const LATIN_TERMS: Terms = ['Eau de Parfum', 'Eau de Toilette', 'Eau de Cologne', 'Parfum'];
const TERMS: Partial<Record<SupportedLanguage, Terms>> = {
  ru: ['о де парфюм', 'о де туалет', 'о де колон', 'парфюм'], uk: ['о де парфюм', 'о де туалет', 'о де колон', 'парфум'],
  bg: ['о дьо парфюм', 'о дьо тоалет', 'о дьо колон', 'парфюм'], be: ['о дэ парфюм', 'о дэ туалет', 'о дэ калон', 'парфума'],
  kk: ['о де парфюм', 'о де туалет', 'о де колон', 'парфюм'], mk: ['о де парфем', 'о де тоалет', 'о де колон', 'парфем'],
  zh: ['淡香精', '淡香水', '古龙水', '香精'], ja: ['オードパルファム', 'オードトワレ', 'オーデコロン', 'パルファム'],
  ko: ['오 드 퍼퓸', '오 드 뚜왈렛', '오 드 코롱', '퍼퓸'], fa: ['ادو پرفیوم', 'ادو تویلت', 'ادکلن', 'پرفیوم'],
  ur: ['او ڈی پرفیوم', 'او ڈی ٹوائلٹ', 'او ڈی کولون', 'پرفیوم'], he: ['או דה פרפיום', 'או דה טואלט', 'או דה קולון', 'פרפיום'],
  hi: ['ओ द परफ़्यूम', 'ओ द टॉयलेट', 'ओ द कोलोन', 'परफ़्यूम'], el: ['ο ντε παρφέν', 'ο ντε τουαλέτ', 'κολόνια', 'άρωμα'],
  th: ['โอ เดอ พาร์ฟูม', 'โอ เดอ ทอยเลตต์', 'โอ เดอ โคโลญจน์', 'พาร์ฟูม'],
};
/** For an English voice: French and Italian house names said the way perfume people say them. */
const ENGLISH_SAYS: [RegExp, string][] = [
  [/Herm[eè]s/g, 'Air-mez'], [/Guerlain/g, 'Gair-lan'], [/Givenchy/g, 'Zhee-von-shee'], [/Lanc[oô]me/g, 'Lon-kome'],
  [/Yves Saint[- ]Laurent/g, 'Eve San Lo-ron'], [/Bvlgari/g, 'Bulgari'], [/Xerjoff/g, 'Zer-joff'], [/Lattafa/g, 'La-tah-fa'],
  [/Amouage/g, 'Ah-moo-ahzh'], [/Moschino/g, 'Mos-kee-no'], [/Kurkdjian/g, 'Kurk-jee-an'],
];
/**
 * Latin brand and perfume names in Arabic letters, so an Arabic voice says them instead of spelling them out.
 * «G» is a hard «g»: «ج» in Egyptian and Sudanese (said «g» there), «غ» elsewhere (where «ج» is «j»).
 */
const ARABIC_SAYS: [string, string][] = [
  ['Maison Francis Kurkdjian', 'ميزون فرانسيس كوركدجيان'], ['Yves Saint Laurent', 'إيف سان لوران'], ['Jean Paul Gaultier', 'جان بول Gوتييه'],
  ['Dolce & Gabbana', 'دولتشي آند Gابانا'], ['Dolce and Gabbana', 'دولتشي آند Gابانا'], ['Carolina Herrera', 'كارولينا هيريرا'],
  ['Narciso Rodriguez', 'نارسيسو رودريGيز'], ['Parfums de Marly', 'بارفان دو مارلي'], ['Baccarat Rouge', 'باكارا روج'], ['Bleu de Chanel', 'بلو دو شانيل'],
  ['Giorgio Armani', 'جورجيو أرماني'], ['Paco Rabanne', 'باكو رابان'], ['Calvin Klein', 'كالفن كلاين'], ['Hugo Boss', 'هيوGو بوس'], ['Tom Ford', 'توم فورد'],
  ['Jo Malone', 'جو مالون'], ['Swiss Arabian', 'سويس أرابيان'], ['Arabian Oud', 'أرابيان عود'], ['Le Labo', 'لو لابو'], ['Viktor & Rolf', 'فيكتور آند رولف'],
  ['Mont Blanc', 'مون بلان'], ['Montblanc', 'مون بلان'], ['Dior', 'ديور'], ['Chanel', 'شانيل'], ['YSL', 'إيف سان لوران'], ['Creed', 'كريد'],
  ['Aventus', 'أفينتوس'], ['Sauvage', 'سوفاج'], ['Armani', 'أرماني'], ['Versace', 'فيرساتشي'], ['Gucci', 'Gوتشي'], ['Prada', 'برادا'],
  ['Hermès', 'إيرميس'], ['Hermes', 'إيرميس'], ['Guerlain', 'Gيرلان'], ['Givenchy', 'جيفنشي'], ['Lancôme', 'لانكوم'], ['Lancome', 'لانكوم'],
  ['Rabanne', 'رابان'], ['Burberry', 'بربري'], ['Bvlgari', 'بولGاري'], ['Bulgari', 'بولGاري'], ['Cartier', 'كارتييه'], ['Valentino', 'فالنتينو'],
  ['Lattafa', 'لطافة'], ['Rasasi', 'الرصاصي'], ['Ajmal', 'أجمل'], ['Amouage', 'أمواج'], ['Kilian', 'كيليان'], ['Xerjoff', 'زيرجوف'], ['Initio', 'إينيشيو'],
  ['Byredo', 'بايريدو'], ['Azzaro', 'أزارو'], ['Davidoff', 'دافيدوف'], ['Lacoste', 'لاكوست'], ['Mancera', 'مانسيرا'], ['Montale', 'مونتال'],
  ['Nishane', 'نيشان'], ['Afnan', 'أفنان'], ['Armaf', 'أرماف'], ['Moschino', 'موسكينو'], ['Chloé', 'كلوي'], ['Chloe', 'كلوي'], ['Kenzo', 'كينزو'],
  ['Eau de Parfum', 'أو دو بارفان'], ['Eau de Toilette', 'أو دو تواليت'], ['Eau de Cologne', 'أو دو كولونيا'], ['Extrait de Parfum', 'إكستريه دو بارفان'],
];
// Everyday words («Oud», «Rose», «Intense») are left alone: inside a product name («Oud Royal») half in Arabic letters
// sounds worse than the name as written.
const latinWord = (name: string) => new RegExp(`(?<![A-Za-z\\u00C0-\\u024F])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')}(?![A-Za-z\\u00C0-\\u024F])`, 'gi');
const ARABIC_RULES = ARABIC_SAYS.map(([name, say]) => [latinWord(name), say] as const);
const HARD_G_AS_JEEM = new Set<Dialect>(['egyptian', 'sudanese']);

/** Latin perfume and brand names in an Arabic sentence, in Arabic letters for the visitor's dialect. */
export function arabicBrandNames(text: string, dialect?: Dialect): string {
  if (!/[A-Za-z]/.test(text)) return text;
  const g = HARD_G_AS_JEEM.has(dialect || 'egyptian') ? 'ج' : 'غ';
  let out = text;
  for (const [re, say] of ARABIC_RULES) out = out.replace(re, say.replace(/G/g, g));
  return out;
}

/** «EDP», brand names and other words the visitor's voice would spell out or misread, said his language's way. */
export function worldTerms(text: string, language: SupportedLanguage): string {
  if (language === 'ar') return text;
  const [edp, edt, edc, parfum] = TERMS[language] || LATIN_TERMS;
  let out = text
    .replace(/(?<![A-Za-z])EDP(?![A-Za-z])/g, edp).replace(/(?<![A-Za-z])EDT(?![A-Za-z])/g, edt).replace(/(?<![A-Za-z])EDC(?![A-Za-z])/g, edc)
    .replace(/(?<![A-Za-z])(?:Extrait|EXDP)(?![A-Za-z])/g, `Extrait de ${parfum === 'Parfum' ? 'Parfum' : parfum}`);
  if (language === 'en') for (const [re, say] of ENGLISH_SAYS) out = out.replace(re, say);
  return out;
}

// ── «Want me to go on?» / «yes, go on» in every site language ─────────────────────────────────────────────
export const MORE_WORLD: Record<Exclude<SupportedLanguage, 'ar'>, string> = {
  en: 'Want me to go on?', fr: 'Je continue ?', es: '¿Sigo?', it: 'Continuo?', de: 'Soll ich weitermachen?', ru: 'Продолжить?',
  zh: '要我继续说吗？', tr: 'Devam edeyim mi?', fa: 'ادامه بدهم؟', hi: 'क्या मैं आगे बताऊँ?', pt: 'Quer que eu continue?', id: 'Mau saya lanjutkan?',
  ja: '続けましょうか？', ko: '계속할까요?', vi: 'Bạn có muốn tôi nói tiếp không?', th: 'ให้เล่าต่อไหม?', pl: 'Mam mówić dalej?', nl: 'Zal ik verdergaan?',
  uk: 'Продовжити?', el: 'Να συνεχίσω;', ms: 'Nak saya teruskan?', bn: 'আরও বলব?', cs: 'Mám pokračovat?', ro: 'Să continui?', he: 'להמשיך?',
  ur: 'کیا میں آگے بتاؤں؟', ps: 'نور هم ووایم؟', sv: 'Ska jag fortsätta?', da: 'Skal jeg fortsætte?', fi: 'Jatkanko?', no: 'Skal jeg fortsette?',
  hu: 'Folytassam?', sk: 'Mám pokračovať?', sl: 'Naj nadaljujem?', hr: 'Da nastavim?', sr: 'Da nastavim?', bg: 'Да продължа ли?', lt: 'Ar tęsti?',
  lv: 'Vai turpināt?', et: 'Kas jätkan?', ka: 'გავაგრძელო?', hy: 'Շարունակե՞մ', tl: 'Itutuloy ko ba?', sw: 'Niendelee?', am: 'ልቀጥል?',
  ha: 'In ci gaba?', yo: 'Ṣé kí n máa bá a lọ?', zu: 'Ngiqhubeke?', af: 'Moet ek aangaan?', so: 'Ma sii wadaa?', jv: 'Tak terusaké?',
  mi: 'Me haere tonu ahau?', ne: 'म अझै भनूँ?', si: 'මම දිගටම කියන්නද?', my: 'ဆက်ပြောရမလား?', km: 'ចង់ឲ្យខ្ញុំបន្តទេ?', lo: 'ໃຫ້ຂ້ອຍສືບຕໍ່ບໍ?',
  ta: 'தொடரட்டுமா?', te: 'కొనసాగించమంటారా?', mr: 'पुढे सांगू का?', gu: 'આગળ કહું?', pa: 'ਕੀ ਮੈਂ ਅੱਗੇ ਦੱਸਾਂ?', kn: 'ಮುಂದುವರಿಸಲೇ?',
  ml: 'തുടരട്ടെ?', or: 'ମୁଁ ଆଗକୁ କହିବି କି?', kk: 'Жалғастырайын ба?', uz: 'Davom ettiraymi?', az: 'Davam edim?', mn: 'Үргэлжлүүлэх үү?',
  ky: 'Уланта берейинби?', tg: 'Идома диҳам?', tk: 'Dowam etdireýinmi?', is: 'Á ég að halda áfram?', sq: 'Të vazhdoj?', mk: 'Да продолжам?',
  bs: 'Da nastavim?', be: 'Працягнуць?', ca: 'Continuo?', eu: 'Jarraitzea nahi duzu?', gl: 'Continúo?', mt: 'Inkompli?',
  ga: 'An leanfaidh mé ar aghaidh?', cy: 'Ga i barhau?', lb: 'Soll ech weidermaachen?', gd: 'An cùm mi orm?', co: 'Continuu?',
  sd: 'ڇا مان اڳتي ٻڌايان؟', as: 'মই আগবাঢ়িম নেকি?', oc: 'Contunhi?', bo: 'མུ་མཐུད་དགོས་སམ།', dz: 'འཕྲོ་མཐུད་དགོཔ་ཨིན་ན?',
  mg: 'Hanohy ve aho?', sn: 'Ndienderere here?', rw: 'Nkomeze?', st: 'Na ke tswele pele?', ln: 'Nakoba?', ti: 'ክቕጽል ድየ?',
  om: 'Itti fufuu?', ig: 'Ka m gaa n’ihu?',
};

const fold = (text: string) => text.toLowerCase().normalize('NFC').replace(/\p{M}/gu, '').replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
/** «No» in the site's languages (folded): said first, it is never «go on». */
const NO_WORDS = new Set(['não', 'nao', 'tidak', 'nggak', 'いいえ', 'いや', '아니', '아니요', 'không', 'nie', 'ні', 'όχι', 'नहीं', 'לא', 'nej', 'ei', 'nem',
  'hayır', 'hayir', 'nee', 'не', 'نه', 'نہیں', 'hapana', 'yok'].map(fold));
/** «Yes / go on / continue» in the site's languages (folded). */
const YES_WORDS = new Set(['sim', 'claro', 'continua', 'continuar', 'continuez', 'vas y', 'weiter', 'ja bitte', 'devam', 'lanjut', 'lanjutkan', 'teruskan', 'ya', 'iya',
  'はい', 'うん', '続けて', '네', '응', '계속', '계속해', 'có', 'vâng', 'tiếp', 'tiếp đi', 'ใช่', 'ต่อ', 'tak', 'dalej', 'так', 'продовжуй', 'ναι', 'συνέχισε',
  'हाँ', 'हां', 'जी', 'ano', 'pokračuj', 'da', 'continuă', 'כן', 'תמשיך', 'جی', 'ہاں', 'ja', 'fortsæt', 'fortsätt', 'fortsett', 'kyllä', 'joo', 'jatka',
  'igen', 'folytasd', 'verder', 'ga door', 'ndiyo', 'endelea', 'yebo', 'oo', 'sige', 'иә', 'ha', 'bəli', 'hə', 'ok', 'd’accord', 'dacord', 'vale', 'sì', 'va bene',
  '继续', '好', '好的', 'продолжай', 'давай', 'بله', 'آره', 'ادامه'].map(fold));
/** «Go on» said in any of the site's other languages («sim», «はい», «weiter», «tiếp đi» …). */
export function wantsMoreWorld(text: string): boolean {
  const t = fold(text);
  if (!t) return false;
  const words = t.split(' ');
  if (words.some((word) => NO_WORDS.has(word))) return false;
  if (YES_WORDS.has(t)) return true;
  for (let size = Math.min(2, words.length); size >= 1; size -= 1) {
    for (let i = 0; i + size <= words.length; i += 1) if (YES_WORDS.has(words.slice(i, i + size).join(' '))) return true;
  }
  // Languages written without spaces (Chinese, Japanese, Thai): the word inside the phrase.
  return /[\u3040-\u30FF\u4E00-\u9FFF\u0E00-\u0E7F]/u.test(t) && ['继续', 'はい', '続けて', 'ใช่', 'ต่อ'].some((word) => t.includes(fold(word)));
}
