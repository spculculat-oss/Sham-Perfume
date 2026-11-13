/**
 * «تمرين اللغات واللهجات» (npm run voice:languages): every site language and every Arabic dialect, the way Shaheen
 * would say a typical reply — and an honest score of what is right on paper.
 *
 * Per site language (100 + Arabic):
 *   locale   the speech locale is a valid tag, and the visitor's country picks its own accent where one exists;
 *   more     «تحب أكمّلك؟» is asked in that language (not English);
 *   price    «1,250.50 EGP» is said with the currency's name in that language (no «E-G-P» spelled out);
 *   unit     «50 ml» and «20%» are said in full words (where the language has the words);
 *   yes      «yes / go on» in that language is understood as «go on».
 * Per Arabic dialect: number words, everyday words, brand names and «تحب أكمّلك؟» in that dialect.
 *
 * What this cannot measure: how the device voice actually sounds. That depends on the voices installed on the
 * visitor's phone or computer (Shaheen uses only those, no paid voice service). A 100% here means «the text handed to
 * the voice is right», not «a native speaker approved the sound».
 */
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../src/types/i18n';
import { findCountryByCode, WORLD_COUNTRIES } from '../src/data/worldCountries';
import { speechLocaleFor } from '../src/utils/shaheenVoice';
import { spokenReply, wantsMore, numberInWords } from '../src/utils/spokenReply';
import { MORE_WORLD } from '../src/utils/spokenWorld';
import { DIALECTS, type Dialect } from '../src/utils/arabicDialect';
import { regionalLocale } from '../src/utils/languageRegion';

/** «Yes» in each language as a visitor would say it to «want me to go on?» (only the ones we are sure of). */
export const YES_SAMPLES: Partial<Record<SupportedLanguage, string>> = {
  en: 'yes please', fr: 'oui', es: 'sí, sigue', it: 'sì', de: 'ja, weiter', ru: 'да', zh: '继续', tr: 'evet', fa: 'بله', hi: 'हाँ', pt: 'sim',
  id: 'iya, lanjut', ja: 'はい', ko: '네', vi: 'có', th: 'ใช่', pl: 'tak', nl: 'ja, ga door', uk: 'так', el: 'ναι', ms: 'ya, teruskan', cs: 'ano',
  ro: 'da', he: 'כן', ur: 'جی ہاں', sv: 'ja', da: 'ja', fi: 'kyllä', no: 'ja', hu: 'igen', sk: 'ano', hr: 'da', sr: 'da', bg: 'да', sw: 'ndiyo',
  tl: 'oo, sige', zu: 'yebo', af: 'ja',
};

export interface LanguageRow { language: SupportedLanguage; locale: boolean; more: boolean; price: boolean; unit: boolean; yes: boolean | null; sample: string }

const REPLY = 'This perfume costs 1,250.50 EGP for 50 ml, with 20% oil. It lasts 6-8 hours on skin. '.repeat(6);
const validTag = (tag: string) => { try { return Intl.getCanonicalLocales(tag).length === 1; } catch { return false; } };

export function drillLanguage(language: SupportedLanguage): LanguageRow {
  const home = WORLD_COUNTRIES.find((country) => country.primaryLanguage === language)?.code;
  const locale = speechLocaleFor(language, home);
  const localeOk = validTag(locale) && (!home || !regionalLocale(language, home) || locale.endsWith(`-${home}`));
  if (language === 'ar') return { language, locale: localeOk, more: true, price: true, unit: true, yes: wantsMore('أيوه كمّل'), sample: '' };
  const said = spokenReply(REPLY, { language, words: 30, locale });
  const more = MORE_WORLD[language as Exclude<SupportedLanguage, 'ar'>];
  const moreOk = Boolean(more) && said.say.endsWith(more) && (language === 'en' || more !== MORE_WORLD.en);
  const first = spokenReply(REPLY.split('. ')[0]!, { language, words: Infinity, locale }).say;
  const price = !/EGP/.test(first);
  // A language whose CLDR data has no long unit names keeps «ml» / «%»: counted as not done (honest).
  const unit = !/(?<![\p{L}])(?:ml|mL)(?![\p{L}])/u.test(first) && (/%/.test(first) ? /^(?:zh|ja|ko)/.test(language) : true);
  const sample = YES_SAMPLES[language];
  return { language, locale: localeOk, more: moreOk, price, unit, yes: sample ? wantsMore(sample) : null, sample: first };
}

export interface DialectRow { dialect: Dialect; checks: Record<string, boolean>; sample: string }
const DIALECT_EXPECT: Record<Dialect, { eleven: string; now?: RegExp; none?: RegExp; brand: RegExp; more: RegExp }> = {
  egyptian: { eleven: 'حداشر', now: /دلوقتي/, none: /مفيش/, brand: /جوتشي/, more: /تحب أكمّلك/ },
  gulf: { eleven: 'إحدعش', now: /الحين/, none: /ما فيه/, brand: /غوتشي/, more: /تبي أكمل/ },
  levantine: { eleven: 'حدعش', now: /هلق/, none: /ما في/, brand: /غوتشي/, more: /بتحب كمّلك/ },
  iraqi: { eleven: 'دعش', now: /هسة/, none: /ماكو/, brand: /غوتشي/, more: /تريد أكملك/ },
  maghrebi: { eleven: 'حداش', now: /دابا/, none: /ماكاينش/, brand: /غوتشي/, more: /بغيتي نكمّل/ },
  sudanese: { eleven: 'حداشر', now: /هسي/, none: /مافي/, brand: /جوتشي/, more: /داير أكمّل/ },
  yemeni: { eleven: 'إحدعش', now: /دحين/, brand: /غوتشي/, more: /تشتي أكمل/ },
  msa: { eleven: 'أحد عشر', brand: /غوتشي/, more: /هل تريد أن أكمل/ },
};
const DIALECT_REPLY = 'عطر Gucci Bloom متوفر الآن. لا يوجد مثله بهذا السعر. ثمنه 11 دينار فقط. '.repeat(8);

export function drillDialect(dialect: Dialect): DialectRow {
  const expect = DIALECT_EXPECT[dialect];
  const said = spokenReply(DIALECT_REPLY, { language: 'ar', dialect, words: 25 });
  const all = spokenReply(DIALECT_REPLY, { language: 'ar', dialect, words: Infinity }).say;
  const checks: Record<string, boolean> = {
    numbers: numberInWords(11, dialect) === expect.eleven,
    brand: expect.brand.test(all),
    more: expect.more.test(said.say),
    ...(expect.now ? { now: expect.now.test(all) } : {}),
    ...(expect.none ? { none: expect.none.test(all) } : {}),
    digitsGone: !/\d/.test(all),
  };
  return { dialect, checks, sample: all.split('. ').slice(0, 3).join('. ') };
}

export function languageScore(rows: LanguageRow[]): { checks: number; passed: number } {
  let checks = 0; let passed = 0;
  for (const row of rows) for (const ok of [row.locale, row.more, row.price, row.unit, row.yes]) { if (ok === null) continue; checks += 1; if (ok) passed += 1; }
  return { checks, passed };
}

const isMain = typeof process !== 'undefined' && process.argv[1] && /language-drill/.test(process.argv[1]);
if (isMain) {
  const rows = SUPPORTED_LANGUAGES.map((lang) => drillLanguage(lang.code));
  const mark = (ok: boolean | null) => (ok === null ? '·' : ok ? '✓' : '✗');
  console.log('lang  locale more price unit yes   sample');
  for (const row of rows) console.log(`${row.language.padEnd(5)} ${mark(row.locale)}      ${mark(row.more)}    ${mark(row.price)}     ${mark(row.unit)}    ${mark(row.yes)}     ${row.sample.slice(0, 90)}`);
  const { checks, passed } = languageScore(rows);
  console.log(`\nLanguages: ${passed}/${checks} checks (${Math.round((passed / checks) * 100)}%) across ${rows.length} languages.`);
  const missing = rows.filter((row) => !row.unit).map((row) => row.language);
  if (missing.length) console.log(`No long unit names in the platform's data (kept as «ml» / «%»): ${missing.join(', ')}`);
  const dialects = DIALECTS.map(drillDialect);
  let dChecks = 0; let dPassed = 0;
  console.log('\nDialect     checks');
  for (const row of dialects) {
    const entries = Object.entries(row.checks);
    dChecks += entries.length; dPassed += entries.filter(([, ok]) => ok).length;
    console.log(`${row.dialect.padEnd(11)} ${entries.map(([name, ok]) => `${name}:${ok ? '✓' : '✗'}`).join(' ')}\n            ${row.sample}`);
  }
  console.log(`\nDialects: ${dPassed}/${dChecks} checks (${Math.round((dPassed / dChecks) * 100)}%).`);
  const regional = ['CA:fr', 'BE:fr', 'MX:es', 'AR:es', 'US:en', 'AU:en', 'BR:pt', 'PT:pt', 'AT:de', 'CH:de', 'TW:zh', 'HK:zh', 'PH:tl'];
  console.log(`\nCountry accents: ${regional.map((pair) => { const [cc, lang] = pair.split(':') as [string, SupportedLanguage]; return `${findCountryByCode(cc)?.nameEn || cc}/${lang}→${speechLocaleFor(lang, cc)}`; }).join(', ')}`);
}
