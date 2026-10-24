/**
 * «روبوت مراقبة جودة الترجمة واللغات» (bot `localization_audit`, workflow `.github/workflows/shaheen-localization.yml`,
 * report `src/data/live/shaheen-localization.json`) — the pure money-and-language audit.
 *
 * The merchant's rule: **no visitor ever sees or pays in a currency that is not his country's** — and every money
 * word (total, shipping, currency, cart) is written in the language he chose. This audit checks that, over the
 * site's real tables, every day:
 *
 *   1. Every country → its official currency (`src/data/country-currency.json`), and a real rate for that currency
 *      (`src/data/live/fx-rates.json`). A country whose rate is missing would fall back to US dollars — a finding
 *      with its own fix, never a silent substitution.
 *   2. The currency the gateway is asked to charge (`chargeCurrency`) is the country's own, or a currency the
 *      gateway really accepts — never a third country's money.
 *   3. The money vocabulary in every site language (`src/لغات/storeL10n.ts`): total, shipping, currency, cart …
 *      A missing word means that language's visitor reads English on the cart.
 *   4. Hard-coded amounts in visitor code (`€19.99`, `$ 30`, `ج.م 500`) outside the money engine — a price that
 *      would not follow the visitor's currency at all.
 *   5. The 「language switch」: a visitor who picks a language of another country sees that language's home
 *      currency (French → EUR). The charge stays in his country's currency; the audit reports every such pair so the
 *      owner can decide, and flags a pair where the language is one of his country's own languages as a real bug.
 *
 * Pure (tables and sources are parameters): `tests/localizationAudit.test.ts` drives it with fixtures.
 */
import { decimals } from '../../src/finance/money';

/** The store strings that carry money. A language missing one reads it in English. */
export const MONEY_KEYS = ['sf_currency', 'sf_total', 'sf_shipping', 'sf_shipping_days', 'sf_cart', 'sf_sort_price_low', 'sf_sort_price_high'] as const;
export type MoneyKey = typeof MONEY_KEYS[number];

/** The smallest a money audit can be honest with: the tables it needs. */
export interface MoneyTables {
  /** country code → official currency. */
  countries: Record<string, string>;
  fx: { base: string; updatedAt?: string; rates: Record<string, number> };
  /** Currencies the payment gateway really accepts (empty = no gateway configured). */
  accepted: string[];
  home: string;
}

export interface SourceFile { file: string; code: string }

export interface LocalizationInput extends MoneyTables {
  now: number;
  languages: string[];
  /** The store pack of one language: the money keys it carries. */
  moneyText: (lang: string) => Partial<Record<MoneyKey, string>>;
  /** The language's home country (undefined for Arabic/English/unknown). */
  languageHome: (lang: string) => string | undefined;
  /** Is this language one of the country's own languages? */
  spokenIn: (country: string, lang: string) => boolean;
  /** The currency the page shows for this country + language (src/utils/displayCurrency.ts). */
  displayCurrency: (country: string, lang: string) => string;
  sources: SourceFile[];
}

export interface LocalizationReport {
  version: 1;
  agent: 'localization-audit';
  updatedAt: string;
  tables: { countries: number; currencies: number; languages: number; fxUpdatedAt?: string; fxAgeHours?: number; gateway: boolean };
  /** Countries whose official currency has no rate: the page would show US dollars. */
  rateGaps: { country: string; currency: string; shownAs: string }[];
  /** Countries whose charge currency is neither their own nor an accepted gateway currency. */
  chargeMismatch: { country: string; official: string; charged: string }[];
  /** Official currencies the money engine cannot handle (decimals throws) — a crash risk at checkout. */
  invalidCurrencies: string[];
  /** Money words missing from a site language's pack. */
  moneyTerms: { language: string; missing: MoneyKey[] }[];
  /** Hard-coded amounts in visitor code (file + line + the line, clipped). */
  hardcoded: { file: string; line: number; text: string }[];
  /** The intentional language → home-currency rule, counted for the owner; `bug` = the language is his own. */
  languageSwitch: {
    pairs: number;
    bugs: { country: string; language: string; official: string; shown: string }[];
    examples: { country: string; language: string; official: string; shown: string }[];
  };
  score: number;
  notes: string[];
  planAr: string[];
  summaryAr: string;
}

/** The engine's own rule (src/utils/pricing.ts): the display currency, or a currency the gateway accepts. */
export function chargeCurrencyOf(display: string, accepted: string[], home: string): string {
  return accepted.includes(display) ? display : (accepted.includes(home) ? home : accepted[0] || home);
}

/** Folded Latin so «€19.99» and «$ 30» are caught, but a CSS `$` or a regex is not. */
const HARD_CODED = /(?:^|[\s>(])(?:€|£|\$)\s?\d{1,5}(?:[.,]\d{1,2})?(?![\w-])|(?:^|[\s>(])\d{1,5}(?:[.,]\d{1,2})?\s?(?:ج\.م|ر\.س|د\.إ|جنية|جنيه|ريال|درهم)(?![\w-])/;

/**
 * Where a fixed amount is not a leak: the money engine itself, the legal documents (they quote the laws' own fines in
 * dollars), the translation packs (their examples are illustrative and localized), the internal bot handbook and the
 * manoeuvre's test prompts.
 */
const MONEY_OWNERS = /^(src\/utils\/(pricing|chatPrices|displayCurrency|countryCurrencyMeta|storeCheckout|priceDrills|botHandbook|maneuverDrills)\.ts|src\/finance\/|src\/data\/|src\/legal\/|src\/bank\/|src\/لغات\/|src\/admin\/)/;
/** A regex, a `$1` replacement or a comment is not a price. */
const NOT_A_PRICE = [/replace\(/, /\/\^/, /\$\d/, /^\s*(\/\/|\*|\/\*)/];

/** Amounts written with a currency symbol in visitor-facing code, with their line. */
export function findHardcodedMoney(sources: SourceFile[]): { file: string; line: number; text: string }[] {
  const hits: { file: string; line: number; text: string }[] = [];
  for (const { file, code } of sources) {
    if (MONEY_OWNERS.test(file)) continue;
    code.split('\n').forEach((line, index) => {
      if (NOT_A_PRICE.some((re) => re.test(line))) return;
      if (HARD_CODED.test(line)) hits.push({ file, line: index + 1, text: line.trim().slice(0, 160) });
    });
  }
  return hits.slice(0, 60);
}

export function auditLocalization(input: LocalizationInput): LocalizationReport {
  const { countries, fx, accepted, home, languages } = input;
  const officialCurrencies = [...new Set(Object.values(countries))];

  const rateGaps = Object.entries(countries)
    .filter(([, currency]) => !(Number(fx.rates[currency]) > 0))
    .map(([country, currency]) => ({ country, currency, shownAs: 'USD' }));

  const invalidCurrencies = officialCurrencies.filter((currency) => {
    try { decimals(currency); return false; } catch { return true; }
  });

  const chargeMismatch: { country: string; official: string; charged: string }[] = [];
  if (accepted.length) {
    for (const [country, official] of Object.entries(countries)) {
      if (!(Number(fx.rates[official]) > 0)) continue;
      const charged = chargeCurrencyOf(official, accepted, home);
      if (charged !== official && !(accepted.includes(charged) && [home, 'USD'].includes(charged))) {
        chargeMismatch.push({ country, official, charged });
      }
    }
  }

  const moneyTerms = languages
    .map((language) => {
      const pack = input.moneyText(language);
      const missing = MONEY_KEYS.filter((key) => !String(pack[key] || '').trim());
      return { language, missing: [...missing] };
    })
    .filter((row) => row.missing.length > 0)
    .sort((a, b) => b.missing.length - a.missing.length || a.language.localeCompare(b.language));

  const pairs = Object.entries(countries).flatMap(([country, official]) =>
    languages.map((language) => ({ country, language, official, shown: input.displayCurrency(country, language) })));
  const switched = pairs.filter((p) => p.shown !== p.official && !(p.shown === 'USD' && !(Number(fx.rates[p.official]) > 0)));
  const bugs = switched.filter((p) => input.spokenIn(p.country, p.language));
  const examples = switched.filter((p) => !input.spokenIn(p.country, p.language)).slice(0, 12);

  const hardcoded = findHardcodedMoney(input.sources);

  const fxAgeHours = fx.updatedAt ? Math.max(0, Math.round((input.now - Date.parse(fx.updatedAt)) / 3_600_000)) : undefined;
  const notes: string[] = [];
  if (!accepted.length) notes.push('بوابة الدفع مش مضبوطة في التشغيل: الفحص اتأكد من عملة العرض بس، ومش قادر يتأكد من عملة الخصم.');
  if (fxAgeHours === undefined) notes.push('تاريخ أسعار الصرف مش موجود — الفحص مايعرفش يقول الأسعار محدثة ولا لأ.');
  else if (fxAgeHours > 48) notes.push(`أسعار الصرف عمرها ${fxAgeHours} ساعة — لازم تتحدث قبل ما نعتمد أي سعر.`);
  if (!Object.keys(countries).length) notes.push('جدول الدول/العملات فاضي — مفيش فحص ممكن.');
  if (bugs.length) notes.push(`${bugs.length} حالة بتظهر عملة مش عملة بلد الزائر وهو بيستخدم لغة من لغات بلده — دي علة حقيقية.`);
  if (examples.length) notes.push(`${switched.length} حالة «لغة تانية → عملة بلد اللغة» (زي الفرنساوي في مصر → يورو) — دي قاعدة مقصودة في العرض، والخصم بيفضل بعملة بلد الزائر، والقرار لصاحب الموقع.`);
  if (hardcoded.length) notes.push(`${hardcoded.length} مبلغ مكتوب بعملة ثابتة في كود الزوار — مش هيتبع عملة الزائر.`);

  const score = Math.max(0, Math.min(100, Math.round(
    100
    - Math.min(30, rateGaps.length * 6)
    - Math.min(30, bugs.length * 3)
    - Math.min(24, hardcoded.length * 3)
    - Math.min(20, moneyTerms.length)
    - Math.min(10, chargeMismatch.length * 5)
    - (invalidCurrencies.length ? 10 : 0)
    - (!accepted.length ? 5 : 0),
  )));

  const planAr = [
    ...(rateGaps.length ? [`${rateGaps.length} دولة عملتها مش في جدول الصرف (${rateGaps.slice(0, 4).map((r) => `${r.country}:${r.currency}`).join('، ')}): تتضاف في تحديث الأسعار أو يتقال للزائر صراحة إن العرض بالدولار.`] : []),
    ...(invalidCurrencies.length ? [`عملات مش معروفة للمحرك المالي: ${invalidCurrencies.join('، ')} — لازم تتضاف قبل ما تُستخدم في الدفع.`] : []),
    ...(moneyTerms.length ? [`${moneyTerms.length} لغة ناقصة كلمات فلوس (أكترها ${moneyTerms[0].language}: ${moneyTerms[0].missing.length}) — المترجم الذكي يكملها.`] : []),
    ...(hardcoded.length ? [`${hardcoded.length} مبلغ ثابت في الكود (أولها ${hardcoded[0].file}:${hardcoded[0].line}) — يتشال ويتحسب من محرك التسعير.`] : []),
    ...(bugs.length ? [`${bugs.length} حالة عرض بعملة غلط للزائر — تتصلح فوراً.`] : []),
    ...(chargeMismatch.length ? [`${chargeMismatch.length} دولة الخصم فيها مش عملتها ولا عملة مقبولة من البوابة.`] : []),
  ];

  const summaryAr = planAr.length
    ? `فحص اللغات والعملات: ${Object.keys(countries).length} دولة و${officialCurrencies.length} عملة و${languages.length} لغة — فيه ${planAr.length} ملاحظة محتاجة شغل.`
    : `فحص اللغات والعملات سليم: ${Object.keys(countries).length} دولة كل واحدة بعملتها، و${languages.length} لغة كلمات الفلوس فيها كاملة.`;

  return {
    version: 1,
    agent: 'localization-audit',
    updatedAt: new Date(input.now).toISOString(),
    tables: { countries: Object.keys(countries).length, currencies: officialCurrencies.length, languages: languages.length, ...(fx.updatedAt ? { fxUpdatedAt: fx.updatedAt } : {}), ...(fxAgeHours !== undefined ? { fxAgeHours } : {}), gateway: accepted.length > 0 },
    rateGaps,
    chargeMismatch,
    invalidCurrencies,
    moneyTerms,
    hardcoded,
    languageSwitch: { pairs: switched.length, bugs, examples },
    score,
    notes,
    planAr,
    summaryAr,
  };
}
