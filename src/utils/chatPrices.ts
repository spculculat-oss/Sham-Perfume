/**
 * «شاهين بعملة بلدك»: Shaheen's replies quote prices in the currency of the country the conversation comes from.
 *
 * The store's catalog (and Shaheen's brain, the AI platforms and the history he reads back) speak Egyptian pounds —
 * that stays the single source of truth. At the visitor's end:
 *  - `localizeChatPrices`: every EGP amount in a reply («EGP 1,420», «1,420 جنيه», «900–1,500 EGP») is shown in the
 *    visitor's currency, converted exactly like the product pages do (priceIn: same rate, same tidy rounding), so
 *    the chat and the page always agree. Egypt keeps its pounds.
 *  - `budgetsToHome`: what the visitor writes in his own money («moins de 30 €», «ميزانيتي 300 ريال», or a bare
 *    «under 50» from someone who now sees prices in his currency) reaches the brain in EGP, so the budget is right.
 * Pure (no React, no network): the rates are the site's bundled table, refreshed by the store bot.
 */
import type { SupportedLanguage } from '../types/i18n';
import { LOCALE_MAP } from '../لغات/localize';
import { BUNDLED_FX, HOME_CURRENCY, convert, priceIn, type FxTable } from './pricing';

const ZERO_DECIMALS = new Set(['BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF', 'IDR', 'IQD', 'IRR', 'LBP', 'SYP', 'UZS', 'COP']);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A number as written in any locale: 1,420 · 1.420 · 1 420 · 1420 · 14.5 · 14,5 · ١٤٢٠. */
const D = '[0-9٠-٩]';
const NUM = String.raw`${D}{1,3}(?:[,.\u00a0\u202f ]${D}{3})+(?:[.,]${D}{1,2})?|${D}+(?:[.,]${D}{1,2})?`;
/**
 * Egyptian pounds as anyone writes them: «EGP 1,420», «EGP1420», «£E 900», «1,420 جنيه مصرى», «900 ج.م», «900ج»,
 * «١٤٢٠ جنيهًا», and the names in the site's languages. A pound that is NOT Egyptian (sterling, Sudanese) is never touched.
 */
const EGP_WORDS = String.raw`EGP|E£|£E|ج\s?\.\s?م\.?|جنيه(?![\u0600-\u06FF]*\s*(?:استرلين|إسترلين|سودان|جنوب))(?:اتٍ?|اً|ًا|ا)?(?:\s*مصر(?:ية|يه|ي|ى)(?:اً|ًا)?)?|(?<![\u0600-\u06FF])ج(?![\u0600-\u06FF.])|Egyptian pounds?|livres? égyptiennes?|libras? egipcias?|libras? egípcias?|ägyptische[n]? Pfund|Egyptische ponden?|lire egiziane|lira egiziana|египетских фунтов|египетский фунт|египетских фунта|Mısır lirası|pound Mesir|paun Mesir|مصری پاؤنڈ|پوند مصر|埃及镑|エジプト・?ポンド|이집트 파운드`;
/** «LE 1,420» / «1420 L.E.» — upper case only, so the French «le 15» is never read as money. */
const LE_WORDS = String.raw`L\.E\.?|LE(?![A-Za-z])`;
const DASH = String.raw`\s?[–—-]\s?`;
/** «900–1,500», «من 450 لـ 2,300», «from 450 to 2,300», «de 900 à 1 500»: the connector kept as written. */
const CONNECT = String.raw`\s?(?:[–—-]|to|à|a|bis|al|до|لـ|لحد|إلى|الى|ل)\s?`;

export function parseAmount(raw: string): number {
  const s = raw.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[\u00a0\u202f ]/g, '');
  const lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    const dec = lastComma > lastDot ? ',' : '.';
    return Number(s.replace(dec === ',' ? /\./g : /,/g, '').replace(dec, '.'));
  }
  const sep = lastComma >= 0 ? ',' : lastDot >= 0 ? '.' : '';
  if (!sep) return Number(s);
  const parts = s.split(sep);
  // «1,420» / «1.420.000» are thousands; «14,5» / «14.25» are decimals.
  return parts.length > 2 || parts[parts.length - 1].length === 3 ? Number(parts.join('')) : Number(parts.join('.'));
}

/** «27,50 €» in French, «SAR 312» in English, «‏312 ر.س.‏» in Arabic — the visitor's own way of writing money. */
export function formatAmount(amount: number, currency: string, lang: SupportedLanguage): string {
  // Western digits, like every other number in Shaheen's replies («لـ100 مل»), in the visitor's own currency style.
  const locale = `${LOCALE_MAP[lang] || 'en-GB'}-u-nu-latn`;
  const whole = ZERO_DECIMALS.has(currency) || amount >= 1000 || Math.abs(amount - Math.round(amount)) < 0.005;
  const value = whole ? Math.round(amount) : amount;
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

/** One EGP amount in the visitor's currency: catalog prices exactly like the product pages, small amounts (per ml) precisely. */
function inCurrency(egp: number, currency: string, fx: FxTable): number {
  if (egp >= 100) return priceIn(egp, currency, fx);
  const v = convert(egp, HOME_CURRENCY, currency, fx);
  return v >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100;
}

/** Every Egyptian-pound amount in a reply, shown in the visitor's currency. Egypt (or an unknown rate) keeps the text. */
export function localizeChatPrices(text: string, currency: string, lang: SupportedLanguage, fx: FxTable = BUNDLED_FX): string {
  if (!text || currency === HOME_CURRENCY || !(Number(fx.rates[currency]) > 0) || !(Number(fx.rates[HOME_CURRENCY]) > 0)) return text;
  const show = (raw: string) => { const n = parseAmount(raw); return Number.isFinite(n) && n > 0 ? formatAmount(inCurrency(n, currency, fx), currency, lang) : raw; };
  const range = (a: string, b: string) => `${show(a)} – ${show(b)}`;
  let out = text;
  for (const [words, flags] of [[EGP_WORDS, 'giu'], [LE_WORDS, 'gu']] as const) {
    out = out
      // Ranges first: «EGP 900–1,500», «900–1,500 EGP», «من 900 لـ 1500 جنيه» stays two prices.
      .replace(new RegExp(String.raw`(?:${words})\s?(${NUM})${DASH}(?:(?:${words})\s?)?(${NUM})(?!${D})`, flags), (_, a: string, b: string) => range(a, b))
      .replace(new RegExp(String.raw`(?<![0-9٠-٩.,])(${NUM})(${CONNECT})(${NUM})\s?(?:${words})`, flags), (_, a: string, link: string, b: string) => `${show(a)}${/[–—-]/.test(link) ? ' – ' : link}${show(b)}`)
      // Single amounts, the currency before or after.
      .replace(new RegExp(String.raw`(?:${words})\s?(${NUM})(?!${D})`, flags), (_, a: string) => show(a))
      .replace(new RegExp(String.raw`(?<![0-9٠-٩.,])(${NUM})\s?(?:${words})`, flags), (_, a: string) => show(a));
  }
  return out;
}

// ── The visitor's own money → EGP for the brain ─────────────────────────────────────────────────────────────────
const ARABIC_NAMES: [RegExp, string][] = [
  [/^EUR$/, 'يورو'], [/^USD$/, 'دولار(?:\\s*أمريكي)?'], [/^SAR$/, 'ريال(?:\\s*سعودي)?|ر\\.س'], [/^AED$/, 'درهم(?:\\s*إماراتي|\\s*اماراتي)?|د\\.إ|د\\.ا'],
  [/^QAR$/, 'ريال(?:\\s*قطري)?|ر\\.ق'], [/^KWD$/, 'دينار(?:\\s*كويتي)?|د\\.ك'], [/^BHD$/, 'دينار(?:\\s*بحريني)?|د\\.ب'], [/^OMR$/, 'ريال(?:\\s*عماني)?|ر\\.ع'],
  [/^(YER)$/, 'ريال(?:ات)?'], [/^(MAD)$/, 'درهم|دراهم|درهم\\s*مغربي'],
  [/^(JOD|IQD|LYD|TND|DZD|RSD)$/, 'دينار|دنانير'], [/^GBP$/, 'جنيه(?:\\s*)?(?:استرليني|إسترليني)|باوند'], [/^TRY$/, 'ليرة|ليره'],
  [/^(LBP|SYP)$/, 'ليرة|ليره'], [/^MYR$/, 'رينجت|رنجت'], [/^SDG$/, 'جنيه(?:\\s*)?سوداني'],
];
const LATIN_NAMES: [RegExp, string][] = [
  [/^EUR$/, 'euros?|eur'], [/^(USD|CAD|AUD|NZD|SGD|HKD)$/, 'dollars?|dólares?|dollari|bucks'], [/^(SAR|QAR|OMR|YER)$/, 'riyals?|rials?'],
  [/^(AED|MAD)$/, 'dirhams?'], [/^(KWD|JOD|BHD|IQD|LYD|TND|DZD)$/, 'dinars?'], [/^GBP$/, 'pounds?(?: sterling)?|livres? sterling|quid'], [/^TRY$/, 'lira|lire|liras'],
  [/^MYR$/, 'ringgit'], [/^INR$/, 'rupees?|roupies?'], [/^PKR$/, 'rupees?'], [/^CHF$/, 'francs?(?: suisses?)?|franken'], [/^RUB$/, 'рубл\\S*|roubles?|rubles?'],
];

function currencyWords(currency: string, lang: SupportedLanguage): string {
  const words = new Set<string>([escape(currency)]);
  for (const display of ['symbol', 'narrowSymbol'] as const) {
    try {
      const sym = new Intl.NumberFormat('en', { style: 'currency', currency, currencyDisplay: display }).formatToParts(1).find((p) => p.type === 'currency')?.value;
      if (sym && sym !== currency) words.add(escape(sym));
      const own = new Intl.NumberFormat(LOCALE_MAP[lang] || 'en', { style: 'currency', currency, currencyDisplay: display }).formatToParts(1).find((p) => p.type === 'currency')?.value;
      if (own && own !== currency) words.add(escape(own));
    } catch { /* unknown to Intl */ }
  }
  for (const [re, w] of [...ARABIC_NAMES, ...LATIN_NAMES]) if (re.test(currency)) words.add(w);
  return [...words].sort((a, b) => b.length - a.length).join('|');
}

/** Budget words before a bare number, in the languages the site speaks most. */
const BUDGET = String.raw`تحت|أقل من|اقل من|مش أكتر من|مش اكتر من|لحد|في حدود|حدود|ميزانيتي|ميزانية|بحد أقصى|فوق|أكتر من|اكتر من|under|below|less than|budget(?: is| of)?|up to|max(?:imum)?|over|above|more than|moins de|sous|jusqu'à|jusqu’à|maximum|plus de|budget de|unter|bis zu|bis|höchstens|über|menos de|hasta|más de|presupuesto(?: de)?|meno di|fino a|più di|bütçem|altında|kadar|до|меньше|больше|бюджет`;
const NOT_MONEY = String.raw`\s?(?:ml|مل|مللي|ملي|%|ساعة|ساعات|hours?|heures?|h\b|g\b|جرام|grams?|سنة|years?|ans|بخة|sprays?)`;

/** The visitor's amounts in his own currency, rewritten in EGP for the brain («moins de 30 €» → «moins de 1,750 EGP»). */
export function budgetsToHome(text: string, currency: string, lang: SupportedLanguage, fx: FxTable = BUNDLED_FX): string {
  if (!text || currency === HOME_CURRENCY || !(Number(fx.rates[currency]) > 0) || !(Number(fx.rates[HOME_CURRENCY]) > 0)) return text;
  const cur = currencyWords(currency, lang);
  const egp = (raw: string) => { const n = parseAmount(raw); return Number.isFinite(n) && n > 0 ? `${Math.round(convert(n, currency, HOME_CURRENCY, fx))} EGP` : raw; };
  const curRe = String.raw`(?:${cur})`;
  return text
    .replace(new RegExp(String.raw`${curRe}\s?(${NUM})(?![\d])`, 'giu'), (_, a: string) => egp(a))
    .replace(new RegExp(String.raw`(?<![\d.,])(${NUM})\s?${curRe}(?![\p{L}])`, 'giu'), (_, a: string) => egp(a))
    // A bare number after a budget word (not already EGP, not ml / hours / %).
    .replace(new RegExp(String.raw`((?:${BUDGET})\s*(?:ال)?\s*)(${NUM})(?![\d.,]|\s?EGP|\s?(?:${EGP_WORDS})|${NOT_MONEY})`, 'giu'), (_, w: string, a: string) => `${w}${egp(a)}`);
}
