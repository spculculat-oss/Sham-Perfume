/**
 * «مناورة دولة الدخول» — Shaheen quotes every price in the currency of the country the visitor enters from.
 *
 * Visitors from many countries (each in his own language, plus the cases where the language is foreign to the country:
 * an Egyptian reading French sees euros) ask about prices. Every reply is passed through exactly what the server does
 * before it answers (src/utils/displayCurrency.ts → replyMoney, then src/utils/chatPrices.ts → localizeChatPrices) and
 * graded: a visitor outside Egypt must never see Egyptian pounds, and a quoted price must carry his own currency.
 * Three sources of replies:
 *   - his own brain (the same order the server answers in — src/utils/maneuverDrills.ts → brainReply);
 *   - AI-platform style answers written every way the pound gets written («EGP1,420», «1420 جنيه مصرى», «LE 900»…);
 *   - a few on the live chat each run (scripts/shaheen-maneuver/run.mts sends the country with the question).
 * A miss becomes a «chat-currency» finding for «دولة المنصة».
 */
import type { SupportedLanguage } from '../types/i18n';
import type { StoreProduct } from './storeCatalog';
import { brainReply } from './maneuverDrills';
import { localizeChatPrices } from './chatPrices';
import { replyMoney } from './displayCurrency';
import { BUNDLED_FX, type FxTable } from './pricing';
import { CHAT_SECTION, type FindingSeverity, type FindingSource, type ManeuverFinding } from './maneuver';

/** Where the visitors enter from, each in the language he reads the site in. */
export const PRICE_ENTRIES: { country: string; language: SupportedLanguage }[] = [
  { country: 'EG', language: 'ar' }, { country: 'EG', language: 'fr' }, { country: 'SA', language: 'ar' }, { country: 'AE', language: 'ar' },
  { country: 'KW', language: 'ar' }, { country: 'QA', language: 'ar' }, { country: 'JO', language: 'ar' }, { country: 'MA', language: 'fr' },
  { country: 'US', language: 'en' }, { country: 'GB', language: 'en' }, { country: 'AU', language: 'en' }, { country: 'CA', language: 'en' },
  { country: 'SA', language: 'en' }, { country: 'FR', language: 'fr' }, { country: 'DE', language: 'de' }, { country: 'TR', language: 'tr' },
  { country: 'MY', language: 'en' }, { country: 'JP', language: 'en' }, { country: 'IN', language: 'en' },
];

/** What visitors really ask about prices, per language (a product, a budget, a range, the cheapest, a gift). */
export const PRICE_QUESTIONS: Partial<Record<SupportedLanguage, string[]>> = {
  ar: ['بكام هاواس آيس؟', 'عايز عطر عود رجالي', 'عايز عطر مسك نسائي تحت 1000 جنيه', 'إيه أرخص عطر عندكم؟', 'رشحلي عطر للصيف', 'عايز هدية لمراتي'],
  en: ['How much is Hawas Ice?', 'I want an oud perfume for men', 'cheapest perfume you have?', 'Recommend a fresh perfume for summer', 'gift for my wife'],
  fr: ['Combien coûte Hawas Ice ?', 'Je veux un parfum oud pour homme', 'un cadeau pour ma femme'],
  de: ['Was kostet Hawas Ice?', 'Ich suche ein Oud Parfum für Männer'],
  tr: ['Hawas Ice ne kadar?', 'Erkek için oud parfüm istiyorum'],
};

/** Answers the way the AI platforms write them — every spelling of the pound that ever reached a visitor. */
export const PLATFORM_SAMPLES: string[] = [
  'سعر هاواس آيس EGP 1,420 والشحن حسب بلدك.',
  'السعر 1420 جنيه مصرى بس، ومعاه عينة.',
  'عندنا اختيارات من 450 لـ 2,300 جنيه.',
  'بـ ١٤٢٠ جنيهًا تقريباً.',
  'The price is EGP1,420 — shipping depends on your country.',
  'It costs 1,420 EGP, and the 50 ml is 900–1,500 EGP.',
  'You can get it for LE 1,420 or the smaller bottle for 900 L.E.',
  'Hawas Ice coûte 1 420 livres égyptiennes (EGP 1 420).',
  'Hawas Ice kostet 1.420 ägyptische Pfund.',
  'Hawas Ice 1420 Mısır lirası.',
  'السعر 1420 ج.م.',
  'سعره 900ج بس.',
  'Options between EGP 900 and EGP 2,300.',
];

/** Egyptian pounds anywhere in what a visitor outside Egypt sees (the amount converted or not, the word alone included). */
const LEAK = /EGP|E£|£E|ج\s?\.\s?م|جنيه(?![\u0600-\u06FF]*\s*(?:استرلين|إسترلين|سودان))|[Ee]gyptian pound|livres? égyptiennes?|libras? egipcias?|ägyptische[n]? Pfund|Mısır lirası|(?<![\u0600-\u06FF])ج(?![\u0600-\u06FF.])\s?$|\d\s?ج(?![\u0600-\u06FF.])|\bL\.E\b|\bLE\s?\d|\d\s?LE\b/;

export interface PriceCase { id: string; country: string; language: SupportedLanguage; say: string; reply: string; source: FindingSource; kind: 'brain' | 'platform' | 'live' }
type Draft = Omit<ManeuverFinding, 'firstSeen' | 'lastSeen' | 'seen' | 'sectionAr' | 'examinerAr'>;

/** The currency a reply to this visitor must be written in (what the server decides for this request). */
export const expectedCurrency = (country: string, language: SupportedLanguage, fx: FxTable = BUNDLED_FX) => replyMoney({ edgeCountry: country, lang: language, fx }).currency;

/** The server's last step before answering: the reply in the visitor's currency. */
export function serverReply(reply: string, country: string, language: SupportedLanguage, fx: FxTable = BUNDLED_FX): string {
  return localizeChatPrices(reply, expectedCurrency(country, language, fx), language, fx);
}

/** Any currency mark of this currency, as Intl writes it in the visitor's language or as the code. */
function currencyMarks(currency: string, language: SupportedLanguage): string[] {
  const marks = new Set([currency]);
  for (const locale of [language, 'en', 'ar']) {
    try {
      for (const display of ['symbol', 'narrowSymbol', 'code'] as const) {
        const part = new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: display }).formatToParts(1).find((p) => p.type === 'currency');
        if (part?.value) marks.add(part.value.trim());
      }
    } catch { /* unknown locale */ }
  }
  return [...marks].filter(Boolean);
}

/** What went wrong with the money in one reply (empty = right). */
export function priceProblems(reply: string, country: string, language: SupportedLanguage, fx: FxTable = BUNDLED_FX): string[] {
  const currency = expectedCurrency(country, language, fx);
  if (!reply || currency === 'EGP') return [];
  const out: string[] = [];
  const leak = reply.match(LEAK);
  if (leak) out.push(`ظهر «${leak[0].trim()}» لزائر من ${country} (عملته ${currency})`);
  return out;
}

/** True when the reply quotes at least one amount in the visitor's own currency. */
export function quotesIn(reply: string, currency: string, language: SupportedLanguage): boolean {
  return currencyMarks(currency, language).some((mark) => reply.includes(mark));
}

export function gradePriceCase(c: PriceCase, fx: FxTable = BUNDLED_FX): Draft[] {
  const problems = priceProblems(c.reply, c.country, c.language, fx);
  if (!problems.length) return [];
  const severity: FindingSeverity = 'high';
  return [{
    id: `${CHAT_SECTION.id}:price-${c.kind}:${c.country}-${c.language}:${c.id}:chat-currency`, kind: 'error', code: 'chat-currency', topic: 'store', section: CHAT_SECTION.id,
    titleAr: `شاهين كتب السعر بالجنيه المصري لزائر داخل من ${c.country}`,
    detailAr: `الزائر (${c.country} · ${c.language}): «${c.say}» — ${problems.join('، ')}: ${c.reply.replace(/\s+/g, ' ').slice(0, 160)}`.slice(0, 300),
    severity, sources: [c.source],
  }];
}

/** The offline maneuver: his own brain and the platform-style answers, for every entry country. */
export function runPriceDrills(products: StoreProduct[], fx: FxTable = BUNDLED_FX): { findings: Draft[]; cases: PriceCase[]; priced: number } {
  const cases: PriceCase[] = [];
  PRICE_ENTRIES.forEach(({ country, language }) => {
    (PRICE_QUESTIONS[language] || []).forEach((say, i) => {
      const mine = brainReply(products, say, [], language);
      if (mine) cases.push({ id: `q${i}`, country, language, say, reply: serverReply(mine.reply, country, language, fx), source: 'brain', kind: 'brain' });
    });
    PLATFORM_SAMPLES.forEach((sample, i) => cases.push({ id: `s${i}`, country, language, say: '(رد منصة)', reply: serverReply(sample, country, language, fx), source: 'brain', kind: 'platform' }));
  });
  const findings = cases.flatMap((c) => gradePriceCase(c, fx));
  const priced = cases.filter((c) => expectedCurrency(c.country, c.language, fx) !== 'EGP' && quotesIn(c.reply, expectedCurrency(c.country, c.language, fx), c.language)).length;
  return { findings, cases, priced };
}

/** The price questions sent to the live chat this run (rotating every 6 hours, a few at a time). */
export function livePriceDrillsFor(at: Date, count: number): { country: string; language: SupportedLanguage; say: string }[] {
  const all = PRICE_ENTRIES.filter((e) => e.country !== 'EG').flatMap((e) => (PRICE_QUESTIONS[e.language] || []).slice(0, 2).map((say) => ({ ...e, say })));
  if (!all.length || count <= 0) return [];
  const start = (Math.floor(at.getTime() / (6 * 3600_000)) * count) % all.length;
  return Array.from({ length: Math.min(count, all.length) }, (_, i) => all[(start + i) % all.length]);
}
