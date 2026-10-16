import { SUPPORTED_LANGUAGES, type LanguageConfig, type SupportedLanguage } from '../types/i18n';
import { LOCALE_MAP } from './localize';

/**
 * Searching for a language is shared by every picker in the platform — the unified
 * languages button at the top of the page and the world/country modal — so a visitor
 * always gets the same results no matter where the list is opened.
 *
 * Matching is forgiving on purpose: accents, Arabic diacritics, alef/hamza and
 * ta-marbuta spellings plus the language's own name, its English name, its code,
 * its BCP-47 locale and a handful of keywords (endonym, "farsi", "mandarin", …)
 * all find the same entry.
 */

/** The languages visitors of this platform reach for first. */
export const POPULAR_LANGUAGE_CODES: readonly SupportedLanguage[] = [
  'ar', 'en', 'fr', 'es', 'de', 'it', 'tr', 'ru', 'zh', 'fa',
];

/**
 * Extra words that should find a language beyond its `name`, `nativeName`, code and
 * locale — common English words, endonyms in another script and frequent spellings.
 */
const LANGUAGE_KEYWORDS: Partial<Record<SupportedLanguage, readonly string[]>> = {
  ar: ['arabic', 'arab', 'عربي', 'عربى', 'مصري', 'egyptian'],
  en: ['english', 'انجليزي', 'إنجليزي', 'انكليزي', 'english uk'],
  fr: ['french', 'francais', 'français', 'فرنسي'],
  es: ['spanish', 'espanol', 'español', 'castellano', 'اسباني'],
  it: ['italian', 'italiano', 'ايطالي', 'إيطالي'],
  de: ['german', 'deutsch', 'الماني', 'ألماني'],
  ru: ['russian', 'русский', 'russkiy'],
  zh: ['chinese', 'mandarin', '中文', '汉语', '漢語', '普通话', 'صيني'],
  tr: ['turkish', 'turkce', 'türkçe', 'تركي', 'تركية'],
  fa: ['persian', 'farsi', 'پارسی', 'فارسی', 'فارسي', 'فارسی'],
  hi: ['hindi', 'हिंदी', 'हिन्दी'],
  pt: ['portuguese', 'portugues', 'português', 'brasil', 'brazil', 'برتغالي'],
  id: ['indonesian', 'bahasa', 'indonesia'],
  ja: ['japanese', '日本語', 'nihongo', 'ياباني'],
  ko: ['korean', '한국어', 'hangul', 'كوري'],
  vi: ['vietnamese', 'viet', 'tieng viet', 'tiếng việt'],
  th: ['thai', 'ไทย', 'siam', 'تايلاندي'],
  pl: ['polish', 'polski', 'polnisch'],
  nl: ['dutch', 'nederlands', 'holland', 'hollands'],
  uk: ['ukrainian', 'українська', 'ukrainskyi'],
  el: ['greek', 'ελληνικά', 'ellinika', 'يوناني'],
  ms: ['malay', 'melayu', 'malaysia', 'bahasa melayu'],
  bn: ['bengali', 'bangla', 'বাংলা'],
  cs: ['czech', 'cestina', 'čeština', 'bohemian'],
  ro: ['romanian', 'romana', 'română', 'roumain'],
  he: ['hebrew', 'עברית', 'ivrit', 'عبري'],
  ur: ['urdu', 'اردو', 'أردو'],
  ps: ['pashto', 'pashtu', 'pushto', 'پښتو', 'افغاني'],
  sv: ['swedish', 'svenska'],
  da: ['danish', 'dansk'],
  fi: ['finnish', 'suomi'],
  no: ['norwegian', 'norsk', 'bokmal', 'bokmål'],
  hu: ['hungarian', 'magyar'],
  sk: ['slovak', 'slovencina', 'slovenčina', 'slovakian'],
  sl: ['slovenian', 'slovene', 'slovenscina', 'slovenščina'],
  hr: ['croatian', 'hrvatski'],
  sr: ['serbian', 'srpski', 'српски'],
  bg: ['bulgarian', 'български'],
  lt: ['lithuanian', 'lietuviu', 'lietuvių'],
  lv: ['latvian', 'lettish', 'latviesu', 'latviešu'],
  et: ['estonian', 'eesti'],
  ka: ['georgian', 'ქართული', 'kartuli'],
  hy: ['armenian', 'հայերեն', 'hayeren'],
  tl: ['tagalog', 'filipino', 'pilipino'],
  sw: ['swahili', 'kiswahili'],
  am: ['amharic', 'አማርኛ', 'ethiopian'],
  ha: ['hausa', 'هوسا'],
  yo: ['yoruba', 'yorùbá'],
  zu: ['zulu', 'isizulu', 'isizulu'],
  af: ['afrikaans', 'afrikaans'],
  so: ['somali', 'soomaali'],
  jv: ['javanese', 'jawa', 'basa jawa'],
  mi: ['maori', 'māori', 'te reo'],
  ne: ['nepali', 'नेपाली', 'nepalese'],
  si: ['sinhala', 'sinhalese', 'සිංහල'],
  my: ['burmese', 'myanmar', 'ဗမာ', 'မြန်မာ'],
  km: ['khmer', 'cambodian', 'ខ្មែរ'],
  lo: ['lao', 'laotian', 'ລາວ'],
  ta: ['tamil', 'தமிழ்'],
  te: ['telugu', 'తెలుగు'],
  mr: ['marathi', 'मराठी'],
  gu: ['gujarati', 'ગુજરાતી'],
  pa: ['punjabi', 'panjabi', 'ਪੰਜਾਬੀ'],
  kn: ['kannada', 'ಕನ್ನಡ'],
  ml: ['malayalam', 'മലയാളം'],
  or: ['odia', 'oriya', 'ଓଡ଼ିଆ'],
  kk: ['kazakh', 'қазақ', 'kazak'],
  uz: ['uzbek', 'ozbek', "o'zbek", 'ўзбек'],
  az: ['azerbaijani', 'azeri', 'azərbaycan'],
  mn: ['mongolian', 'монгол'],
  ky: ['kyrgyz', 'kirghiz', 'кыргыз'],
  tg: ['tajik', 'tadjik', 'тоҷикӣ'],
  tk: ['turkmen', 'türkmen'],
  is: ['icelandic', 'islenska', 'íslenska'],
  sq: ['albanian', 'shqip'],
  mk: ['macedonian', 'македонски'],
  bs: ['bosnian', 'bosanski'],
  be: ['belarusian', 'беларуская'],
  ca: ['catalan', 'català', 'valencian'],
  eu: ['basque', 'euskara', 'euskera'],
  gl: ['galician', 'galego'],
  mt: ['maltese', 'malti'],
  ga: ['irish', 'gaeilge', 'irish gaelic'],
  cy: ['welsh', 'cymraeg'],
  lb: ['luxembourgish', 'letzebuergesch', 'lëtzebuergesch'],
  gd: ['scottish gaelic', 'gaelic', 'gàidhlig', 'gaidhlig'],
  co: ['corsican', 'corsu'],
  sd: ['sindhi', 'سنڌي', 'सिंधी'],
  as: ['assamese', 'asamiya', 'অসমীয়া'],
  oc: ['occitan', 'occitanie', 'lenga d oc'],
  bo: ['tibetan', 'བོད་སྐད'],
  dz: ['dzongkha', 'bhutanese', 'རྫོང་ཁ'],
  mg: ['malagasy', 'madagascar'],
  sn: ['shona', 'chishona'],
  rw: ['kinyarwanda', 'rwanda', 'ruanda'],
  st: ['sesotho', 'sotho', 'southern sotho'],
  ln: ['lingala'],
  ti: ['tigrinya', 'tigrigna', 'ትግርኛ'],
  om: ['oromo', 'afaan oromo', 'galla'],
  ig: ['igbo', 'ibo', 'asusu igbo'],
};

/** Typical misspellings/keyboard slips that still deserve to find the language. */
const LANGUAGE_TYPOS: Partial<Record<SupportedLanguage, readonly string[]>> = {
  de: ['duetsch', 'germa'],
  fr: ['francais', 'frence'],
  en: ['englsh', 'englsh', 'anglias'],
  ar: ['arab', 'ارابيك'],
  es: ['espnol', 'spanis'],
  ru: ['russan', 'rosyjski'],
  zh: ['chineese', 'chinise'],
  tr: ['turkisch', 'turkis'],
  fa: ['farssi', 'persain'],
  ja: ['japanesse', 'japanes'],
};

const haystackCache = new Map<string, string>();

/**
 * Fold a query/heystack into a comparable form: lowercase, no accents, no Arabic
 * diacritics, unified alef/ya/ta-marbuta spellings, single spaces.
 */
export function normalizeQuery(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u064b-\u065f\u0670\u0640]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[’'`´]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Everything a visitor may type to reach this language, pre-folded and cached. */
export function languageHaystack(lang: LanguageConfig): string {
  const cached = haystackCache.get(lang.code);
  if (cached) return cached;
  const parts: string[] = [
    lang.name,
    lang.nativeName,
    lang.code,
    LOCALE_MAP[lang.code] || '',
    lang.dir,
    ...(LANGUAGE_KEYWORDS[lang.code] ?? []),
    ...(LANGUAGE_TYPOS[lang.code] ?? []),
  ];
  const haystack = normalizeQuery(parts.join(' '));
  haystackCache.set(lang.code, haystack);
  return haystack;
}

/** True when every word of the query appears somewhere in the language's haystack. */
export function isLanguageMatch(lang: LanguageConfig, rawQuery: string): boolean {
  const query = normalizeQuery(rawQuery);
  if (!query) return true;
  if (lang.flag && rawQuery.trim() === lang.flag) return true;
  const haystack = languageHaystack(lang);
  return query.split(' ').every((word) => haystack.includes(word));
}

/**
 * Lower is better. Exact code / locale and name prefixes float to the top so typing
 * «ar» puts العربية first instead of any language that merely contains "ar".
 */
export function languageMatchRank(lang: LanguageConfig, rawQuery: string): number {
  const query = normalizeQuery(rawQuery);
  if (!query) return 0;
  const code = lang.code.toLowerCase();
  const native = normalizeQuery(lang.nativeName);
  const name = normalizeQuery(lang.name);
  if (query === code) return 0;
  if (native.startsWith(query) || name.startsWith(query)) return 1;
  if (normalizeQuery(String(LOCALE_MAP[lang.code] || '')).startsWith(query)) return 2;
  if (query.split(' ').some((word) => code === word || native.split(' ').some((part) => part === word))) return 3;
  return 4;
}

/**
 * The languages to show for a search query. An empty query keeps the curated
 * platform order; anything else is ranked so the best match comes first.
 */
export function filterLanguages(rawQuery: string): LanguageConfig[] {
  const matches = SUPPORTED_LANGUAGES.filter((lang) => isLanguageMatch(lang, rawQuery));
  if (!normalizeQuery(rawQuery)) return matches;
  return matches
    .map((lang, index) => ({ lang, rank: languageMatchRank(lang, rawQuery), index }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.lang);
}

/** How many languages the platform offers right now (never a hard-coded number). */
export const languageCount = (): number => SUPPORTED_LANGUAGES.length;

/** Look up one language by code, tolerating unknown or missing values. */
export function findLanguage(code: string | null | undefined): LanguageConfig | undefined {
  if (!code) return undefined;
  return SUPPORTED_LANGUAGES.find((lang) => lang.code === code);
}

/** The quick-pick row: popular codes that actually exist in SUPPORTED_LANGUAGES. */
export function popularLanguages(): LanguageConfig[] {
  return POPULAR_LANGUAGE_CODES
    .map((code) => findLanguage(code))
    .filter((lang): lang is LanguageConfig => Boolean(lang));
}

/** Split a result list into «الأكثر استخداماً» and the rest, for a friendlier empty state. */
export function splitPopular(languages: readonly LanguageConfig[]): {
  popular: LanguageConfig[];
  rest: LanguageConfig[];
} {
  const popularCodes = new Set(POPULAR_LANGUAGE_CODES);
  return {
    popular: languages.filter((lang) => popularCodes.has(lang.code)),
    rest: languages.filter((lang) => !popularCodes.has(lang.code)),
  };
}
