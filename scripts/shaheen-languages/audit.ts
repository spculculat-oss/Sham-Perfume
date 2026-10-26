/**
 * «وكيل اللغات» — Shaheen's language specialist, the deterministic core.
 *
 * The merchant asked for a language-specialist robot under Shaheen's management
 * (plus a photo of a GERMAN page whose number fields showed Arabic-Indic digits:
 *  a native `<input type="number">` renders with the visitor's OS/browser locale,
 *  not the site's chosen language). This audit keeps that whole class of bugs
 * away forever, in four checks over the visitor-facing source tree:
 *
 *   1. Native number inputs (`type="number"`) — they follow the BROWSER's
 *      digits, never the site language. Visitor code must use
 *      `LocalizedNumberInput` (src/components) + `src/لغات/numerals.ts`.
 *   2. Bare locale formatting — `.toLocaleString()`, `.toLocaleDateString()`,
 *      `new Intl.NumberFormat()` with no explicit locale: same bug for display.
 *   3. Hard «'ar' | 'en'» clamps — code that turns the site language into
 *      Arabic-or-English language (legitimate only for raw {ar,en} data pairs,
 *      which use the dedicated `lang === 'ar' ? ar : en` shape on DATA, so this
 *      check only flags a clamped language VALUE being assigned/returned).
 *   4. Pack coverage — every supported language × the store/banner/news packs
 *      (computed in run.mts through the public لغات APIs and fed in here).
 *
 * Findings are written to `src/data/live/shaheen-languages.json`; the daily
 * council briefing reads them and can raise an `experience`-area task —
 * exactly how the other Shaheen bots report to their manager. Pure helpers
 * here; scripts/shaheen-languages/run.mts does the file I/O.
 */

/** One source-code finding: repo-relative file + 1-based line. */
export interface LanguageFinding {
  file: string;
  line: number;
}

/** Per-pack coverage facts for one language, computed by the runner. */
export interface LanguagePackCoverage {
  /** Store pack core keys present (STORE_CORE_KEYS size = 100%). */
  storeCore: number;
  /** Store pack keys present overall. */
  storeTotal: number;
  /** Banner pack keys present (BANNER_KEYS size = 100%). */
  banner: number;
  /** News page pack keys present (NEWS_KEYS size = 100%). */
  news: number;
}

export const HEALTHY_NOTE = 'اللغات سليمة: الحزم مكتملة، والأرقام تتبع لغة الموقع في كل واجهات الزوار.';

/** The committed report (src/data/live/shaheen-languages.json). */
export interface LanguageLiveReport {
  version: 1;
  agent: 'shaheen-languages';
  updatedAt: string;
  /** Languages the site supports (SUPPORTED_LANGUAGES.length). */
  languageCount: number;
  /** Languages with a complete store core + banner + news pack. */
  fullyCovered: number;
  /** Languages whose store core, banner or news pack is incomplete. */
  incompletePacks: { lang: string; storeCore: string; banner: string; news: string }[];
  /** Check 1: native number inputs on visitor-facing surfaces (should be 0). */
  publicNumberInputs: LanguageFinding[];
  /** Check 1b: the same on operator-only surfaces (admin console, merchant desks). */
  operatorNumberInputs: LanguageFinding[];
  /** Check 2: browser-locale formatting calls still around. */
  bareLocaleFormatting: LanguageFinding[];
  /** Check 3: hard 'ar'|'en' language clamps. */
  languageClamps: LanguageFinding[];
  /** 0–100: 100 = packs full, no findings and every text translated (translation weighs up to TRANSLATION_WEIGHT). */
  score: number;
  /** Share (%) of the site's texts × languages a visitor reads in his own language — the real coverage. */
  translationCoverage?: number;
  /** Languages with nothing left in English. */
  fullyTranslated?: number;
  notes: string[];
  /** «المترجم الذكي»: what visitors still read in English and what the AI translated (./translator.ts). */
  translation?: TranslationSection;
  /** The link with the design department (the Manus design audit + right-to-left layout signals). */
  design?: DesignSection;
}

export interface TranslationSection {
  at: string;
  /** done = something translated; idle = nothing left; no_engine / quota / engines_failed / budget = stopped. */
  status: 'done' | 'idle' | 'no_engine' | 'quota' | 'engines_failed' | 'budget' | 'off';
  /** Strings × languages still shown in English (after the AI packs). */
  remaining: number;
  /** Strings × languages the AI packs already cover. */
  covered: number;
  /** Strings × languages that need a translation at all (every text × every language but Arabic and English). */
  total?: number;
  /** Languages with nothing left in English. */
  fullyTranslated?: number;
  remainingByTier: Record<string, number>;
  /** Languages with the most English left. */
  worstLanguages: { lang: string; remaining: number }[];
  run: { calls: number; translated: number; rejected: number; droppedByReview: number; reviewed: boolean; engines: string[]; languages: string[]; resumeAt?: string };
  rejectReasons: Record<string, number>;
  /** Units rejected twice are set aside (key = lang|pack|hash) so a hard string never eats the quota. */
  rejectCounts: Record<string, number>;
}

export interface DesignSection {
  at: string;
  auditAt?: string;
  auditScore?: number;
  /** Languages the design audit found half-translated (translated first). */
  priorityLanguages: string[];
  /** English phrases the audit quoted, found in the visitor code. */
  located: { phrase: string; file: string; line: number }[];
  unlocated: string[];
  /** Physical left/right classes in visitor screens (they do not mirror in right-to-left languages). */
  physicalDirection: { total: number; top: { file: string; count: number }[] };
}

/**
 * The sanctioned replacement component itself (its doc comment legitimately
 * mentions the native pattern) and the operator-only consoles, whose Arabic
 * operator runs an Arabic browser by the same choice — still reported, under
 * their own bucket, so the council decides with open eyes.
 */
export const SANCTIONED_FILES: readonly string[] = [
  'src/components/LocalizedNumberInput.tsx',
  // The numerals module that replaces native inputs describes them in prose.
  'src/لغات/numerals.ts',
];

/**
 * Files where an 'ar'|'en' language clamp is a real-world constraint, not a
 * shortcut: the Kashier payment page itself only exists in Arabic/English.
 */
export const CLAMP_SANCTIONED_FILES: readonly string[] = [
  // Kashier and the direct-checkout API carry the catalogue's Arabic/English product-name language, not the UI locale.
  'src/utils/storeCheckout.ts',
  'src/utils/directPayment.ts',
];
export const OPERATOR_FILES: readonly string[] = [
  'src/components/AdminMerchantManagement.tsx',
  'src/components/MerchantWorkspace.tsx',
  'src/community/MerchantPortal.tsx',
];

const isOperatorFile = (file: string): boolean =>
  file.startsWith('src/admin/') || OPERATOR_FILES.includes(file);

const lineOf = (source: string, index: number): number => source.slice(0, index).split('\n').length;

const findAll = (regex: RegExp) => (file: string, source: string): LanguageFinding[] => {
  const out: LanguageFinding[] = [];
  for (const match of source.matchAll(new RegExp(regex.source, 'g'))) {
    out.push({ file, line: lineOf(source, match.index ?? 0) });
  }
  return out;
};

/**
 * Check 1 — native number inputs. Matches the literal DOM spelling and the
 * two JSX brace spellings. Comments/JSDoc mentioning the pattern are allowed
 * ONLY inside SANCTIONED_FILES; elsewhere a programmatic guard test also
 * fails the suite, so a comment typo cannot hide a live input for long.
 */
const findNativeNumberInputsRaw = findAll(/type\s*=\s*(?:"number"|\{\s*"(?:number)"\s*\}|\{\s*'(?:number)'\s*\})/);

export function findNativeNumberInputs(file: string, source: string): { public: LanguageFinding[]; operator: LanguageFinding[] } {
  if (SANCTIONED_FILES.includes(file)) return { public: [], operator: [] };
  const all = findNativeNumberInputsRaw(file, source);
  return isOperatorFile(file) ? { public: [], operator: all } : { public: all, operator: [] };
}

/**
 * Check 2 — locale-free formatting: the browser decides the digits/separators.
 * `toLocaleString('ar-EG')`, `new Intl.NumberFormat(tag)` are fine; empty or
 * options-only calls are not. (An Intl constructor whose first token is an
 * identifier counts as explicit — maybe a VARIABLE, but certainly a choice.)
 */
export function findBareLocaleFormatting(file: string, source: string): LanguageFinding[] {
  const hits: LanguageFinding[] = [];
  for (const match of source.matchAll(/\.toLocale(?:String|DateString|TimeString)\(\s*(\)|\{)/g)) {
    hits.push({ file, line: lineOf(source, match.index ?? 0) });
  }
  for (const match of source.matchAll(/new\s+Intl\.\w+\(\s*(\)|\{|undefined\b)/g)) {
    hits.push({ file, line: lineOf(source, match.index ?? 0) });
  }
  return hits;
}

/**
 * Check 3 — a language collapsed to 'ar'|'en' as a VALUE
 * (`x === 'ar' ? 'ar' : 'en'`). Data ternaries (`lang === 'ar' ? item.nameAr :
 * item.nameEn`) are the sanctioned {ar,en} pattern and do not match: both
 * arms here must be the literal language codes.
 */
const findLanguageClampsRaw = findAll(/(?:===|!==|==|!=)\s*'(?:ar|en)'\s*\?\s*'(?:ar|en)'\s*:\s*'(?:ar|en)'/);

export function findLanguageClamps(file: string, source: string): LanguageFinding[] {
  if (CLAMP_SANCTIONED_FILES.includes(file)) return [];
  return findLanguageClampsRaw(file, source);
}

/** Compose the report the workflow commits (deterministic; easy to unit-test). */
export function buildLanguageReport(input: {
  at: string;
  languages: readonly string[];
  storeCoreSize: number;
  bannerSize: number;
  newsSize: number;
  coverage: Record<string, LanguagePackCoverage>;
  publicNumberInputs: LanguageFinding[];
  operatorNumberInputs: LanguageFinding[];
  bareLocaleFormatting: LanguageFinding[];
  languageClamps: LanguageFinding[];
}): LanguageLiveReport {
  const incompletePacks = input.languages
    .map((lang) => ({ lang, cov: input.coverage[lang] }))
    .filter(({ cov }) => !cov || cov.storeCore < input.storeCoreSize || cov.banner < input.bannerSize || cov.news < input.newsSize)
    .map(({ lang, cov }) => ({
      lang,
      storeCore: `${cov?.storeCore ?? 0}/${input.storeCoreSize}`,
      banner: `${cov?.banner ?? 0}/${input.bannerSize}`,
      news: `${cov?.news ?? 0}/${input.newsSize}`,
    }));

  let score = 100;
  // Visitor-visible bug class — the German-page photo. The heaviest penalty.
  score -= Math.min(50, input.publicNumberInputs.length * 10);
  // Browser-locale formatting leaks thevisitor's digits into read-only numbers.
  score -= Math.min(25, input.bareLocaleFormatting.length * 1);
  // A language falling back to English is acceptable, never invisible.
  score -= Math.min(20, incompletePacks.length * 4);
  // Hard clamps quietly downgrade 98 languages to English.
  score -= Math.min(15, input.languageClamps.length * 5);
  // Operator consoles are Arabic-first by trade; tracked, not punished hard.
  score -= Math.min(10, input.operatorNumberInputs.length > 0 ? 4 : 0);
  score = Math.max(0, Math.round(score));

  const notes: string[] = [];
  if (input.publicNumberInputs.length > 0) {
    notes.push(
      `حقول أرقام بلغة متصفح الزائر في واجهات الزوار: ${input.publicNumberInputs.length} — حوّلها إلى LocalizedNumberInput حتى تتبع أرقام لغة الموقع.`,
    );
  }
  if (input.bareLocaleFormatting.length > 0) {
    notes.push(
      `تنسيق أرقام/تواريخ بدون لغة صريحة: ${input.bareLocaleFormatting.length} موضع — مرّر لغة الموقع (formatLocalizedNumber/storeNumber).`,
    );
  }
  if (incompletePacks.length > 0) {
    notes.push(`حزم لغات غير مكتملة: ${incompletePacks.map((p) => p.lang).join('، ')} (احتياطي إنجليزي الآن).`);
  }
  if (input.languageClamps.length > 0) {
    notes.push(`تقليل صارم للغة إلى عربي/إنجليزي في ${input.languageClamps.length} موضع — راجع إن كان المقصود زوج بيانات {ar,en} أم لغة واجهة.`);
  }
  if (!notes.length) notes.push(HEALTHY_NOTE);

  return {
    version: 1,
    agent: 'shaheen-languages',
    updatedAt: input.at,
    languageCount: input.languages.length,
    fullyCovered: input.languages.length - incompletePacks.length,
    incompletePacks,
    publicNumberInputs: input.publicNumberInputs,
    operatorNumberInputs: input.operatorNumberInputs,
    bareLocaleFormatting: input.bareLocaleFormatting,
    languageClamps: input.languageClamps,
    score,
    notes,
  };
}

/** How much of the score the real translation coverage decides. */
export const TRANSLATION_WEIGHT = 40;

/**
 * «لا تعلن الاكتمال»: the packs check alone said «اللغات سليمة» with 90% of the texts still in English. After the smart
 * translator measured the real gap, the score loses up to TRANSLATION_WEIGHT points and the first note says how much is
 * translated — «complete» only when nothing is left in English.
 */
export function applyTranslationCoverage(report: LanguageLiveReport, t: Pick<TranslationSection, 'remaining' | 'total' | 'fullyTranslated'>): LanguageLiveReport {
  const total = Number(t.total) || 0;
  if (total <= 0) return report;
  const remaining = Math.min(total, Math.max(0, t.remaining));
  const coverage = (total - remaining) / total;
  const pct = Math.floor(coverage * 1000) / 10;
  const notes = report.notes.filter((n) => n !== HEALTHY_NOTE);
  if (remaining > 0) {
    notes.unshift(`الترجمة مش مكتملة: ${pct}% بس من نصوص الموقع مترجمة لكل اللغات (${report.languageCount - 2} لغة غير العربي والإنجليزي، المكتمل منها ${t.fullyTranslated ?? 0}) — ${remaining} نص × لغة لسه بيظهر للزائر بالإنجليزي.${report.incompletePacks.length ? '' : ' حزم المتجر والشريط والأخبار الأساسية بس هي اللي مكتملة.'}`);
  } else if (!notes.length) notes.push(HEALTHY_NOTE);
  return {
    ...report, notes, translationCoverage: pct, fullyTranslated: t.fullyTranslated,
    score: Math.max(0, Math.round(report.score - (1 - coverage) * TRANSLATION_WEIGHT)),
  };
}

/** Shape guard for readers (the council briefing, tests). */
export function isLanguageLiveReport(value: unknown): value is LanguageLiveReport {
  const v = value as LanguageLiveReport | null | undefined;
  return Boolean(
    v &&
      v.version === 1 &&
      v.agent === 'shaheen-languages' &&
      typeof v.updatedAt === 'string' &&
      typeof v.languageCount === 'number' &&
      typeof v.score === 'number' &&
      Array.isArray(v.publicNumberInputs) &&
      Array.isArray(v.operatorNumberInputs) &&
      Array.isArray(v.bareLocaleFormatting) &&
      Array.isArray(v.languageClamps) &&
      Array.isArray(v.incompletePacks) &&
      Array.isArray(v.notes),
  );
}
