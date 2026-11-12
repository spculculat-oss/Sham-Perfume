/**
 * «لهجات شاهين» — Shaheen speaks the visitor's own Arabic: Egyptian, Gulf, Levantine, Iraqi, Maghrebi,
 * Sudanese, Yemeni, or simple Modern Standard Arabic.
 *
 * Which one: the visitor's own pick (a menu in the voice stage) → the way he actually writes or speaks
 * («وش تبغى» is Gulf, «شو بدك» Levantine …) → the Arab country he is entering from → Egyptian (the store's own).
 * Shared by the browser (speech recognition and voice locale) and the server (the engines' instruction).
 */
export const DIALECTS = ['egyptian', 'gulf', 'levantine', 'iraqi', 'maghrebi', 'sudanese', 'yemeni', 'msa'] as const;
export type Dialect = (typeof DIALECTS)[number];
export type DialectChoice = Dialect | 'auto';

export const isDialect = (value: unknown): value is Dialect => typeof value === 'string' && (DIALECTS as readonly string[]).includes(value);
export const isDialectChoice = (value: unknown): value is DialectChoice => value === 'auto' || isDialect(value);

export const DIALECT_INFO: Record<Dialect, { ar: string; en: string; locale: string; countries: readonly string[]; style: string }> = {
  egyptian: { ar: 'مصري', en: 'Egyptian', locale: 'ar-EG', countries: ['EG'],
    style: 'باللهجة المصرية العامية الطبيعية (زي: إزيك، عايز، دلوقتي، كده، أوي، ماشي، تمام)' },
  gulf: { ar: 'خليجي', en: 'Gulf', locale: 'ar-SA', countries: ['SA', 'AE', 'KW', 'QA', 'BH', 'OM'],
    style: 'باللهجة الخليجية البيضاء المفهومة في السعودية والخليج (زي: هلا والله، وش، أبغى، الحين، زين، مرة، وايد، إن شاء الله)' },
  levantine: { ar: 'شامي', en: 'Levantine', locale: 'ar-JO', countries: ['SY', 'LB', 'JO', 'PS'],
    style: 'باللهجة الشامية (زي: أهلين، شو، بدّك، هلّق، كتير، منيح، هيك، تكرم عينك)' },
  iraqi: { ar: 'عراقي', en: 'Iraqi', locale: 'ar-IQ', countries: ['IQ'],
    style: 'باللهجة العراقية (زي: هلا بيك، شلونك، شنو، هواية، زين، أكو وماكو، هسّه، عيوني)' },
  maghrebi: { ar: 'مغاربي', en: 'Maghrebi', locale: 'ar-MA', countries: ['MA', 'DZ', 'TN', 'LY', 'MR'],
    style: 'بالدارجة المغاربية المفهومة (زي: مرحبا، واش، بزاف، دابا، مزيان، كيفاش، علاش)، وخليها سهلة على كل المغاربة وابعد عن الكلمات الفرنسية الصعبة' },
  sudanese: { ar: 'سوداني', en: 'Sudanese', locale: 'ar-EG', countries: ['SD'],
    style: 'باللهجة السودانية (زي: مرحب، شنو، داير، هسي، كويس شديد، يا زول)' },
  yemeni: { ar: 'يمني', en: 'Yemeni', locale: 'ar-YE', countries: ['YE'],
    style: 'باللهجة اليمنية (زي: أهلين، إيش، أشتي، دحين، قدك، تمام)' },
  msa: { ar: 'فصحى', en: 'Standard Arabic', locale: 'ar-SA', countries: [],
    style: 'بالعربية الفصحى المبسطة السهلة' },
};

/** Speech engines know these Arab countries' own accents; the others use their dialect's locale. */
const COUNTRY_LOCALE: Record<string, string> = {
  EG: 'ar-EG', SA: 'ar-SA', AE: 'ar-AE', KW: 'ar-KW', QA: 'ar-QA', BH: 'ar-BH', OM: 'ar-OM',
  JO: 'ar-JO', LB: 'ar-LB', PS: 'ar-PS', IQ: 'ar-IQ', MA: 'ar-MA', DZ: 'ar-DZ', TN: 'ar-TN', YE: 'ar-YE',
};

export function dialectForCountry(country: unknown): Dialect | undefined {
  const code = typeof country === 'string' ? country.toUpperCase() : '';
  return DIALECTS.find((dialect) => DIALECT_INFO[dialect].countries.includes(code));
}

/** One spelling for comparing Arabic words: no diacritics or tatweel, one alef, ya and ta marbuta. */
export function normalizeArabic(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Words that give a dialect away (normalized spelling). Words shared by several dialects are left out. */
const MARKERS: Record<Exclude<Dialect, 'msa'>, readonly string[]> = {
  egyptian: ['عايز', 'عايزه', 'عاوز', 'عاوزه', 'دلوقتي', 'دلوقت', 'ازاي', 'ازيك', 'ازيكم', 'كده', 'اوي', 'خالص', 'بتاع', 'بتاعي', 'بتاعه', 'امتي', 'حضرتك', 'مفيش', 'ايه ده'],
  gulf: ['وش', 'ابغي', 'ابغا', 'تبغي', 'تبي', 'ابي', 'الحين', 'وايد', 'عساك', 'يبيله', 'حيل', 'مب', 'هلا والله', 'وشلون', 'ودي'],
  levantine: ['شو', 'بدي', 'بدك', 'بدنا', 'هلق', 'هلء', 'منيح', 'هيك', 'عنجد', 'تكرم', 'لكان', 'هون', 'هنيك', 'مبلا', 'بحكي'],
  iraqi: ['شلونك', 'شنو', 'هوايه', 'اكو', 'ماكو', 'هسه', 'عيوني', 'شكو', 'اغاتي', 'كلش'],
  maghrebi: ['واش', 'بزاف', 'دابا', 'مزيان', 'كيفاش', 'علاش', 'بغيت', 'بغيتي', 'ديال', 'شحال', 'راني', 'نتا', 'نتي', 'برشا', 'باهي', 'ياسر', 'كيداير', 'لاباس', 'يزي'],
  sudanese: ['داير', 'دايره', 'زول', 'هسي', 'ياخ', 'ساي', 'براي', 'كدي', 'زولي'],
  yemeni: ['اشتي', 'تشتي', 'دحين', 'قدك', 'مابش', 'ذلحين'],
};

/**
 * The dialect his own words give away, or undefined when they do not (Standard Arabic, too short, mixed).
 * Several texts can be passed (this message first, then his earlier ones); the first that is clear decides.
 */
export function detectDialect(...texts: readonly string[]): Dialect | undefined {
  for (const text of texts) {
    if (!text || !/[\u0600-\u06FF]/.test(text)) continue;
    const padded = ` ${normalizeArabic(text)} `;
    let best: Dialect | undefined;
    let bestScore = 0;
    let tie = false;
    for (const [dialect, words] of Object.entries(MARKERS) as [Dialect, readonly string[]][]) {
      let score = 0;
      for (const word of words) {
        const marker = normalizeArabic(word);
        if (!marker) continue;
        // Whole words only, with the common one-letter prefixes (و، ف، ب) still matching.
        if (padded.includes(` ${marker} `) || padded.includes(` و${marker} `) || padded.includes(` ف${marker} `) || padded.includes(` ب${marker} `)) score += 1;
      }
      if (score > bestScore) { best = dialect; bestScore = score; tie = false; }
      else if (score && score === bestScore) tie = true;
    }
    if (best && !tie) return best;
  }
  return undefined;
}

/** The dialect this conversation is answered in (see the module note for the order). */
export function resolveDialect({ choice, texts = [], country }: { choice?: unknown; texts?: readonly string[]; country?: unknown }): Dialect {
  if (isDialect(choice)) return choice;
  return detectDialect(...texts) || dialectForCountry(country) || 'egyptian';
}

/** The speech-recognition / voice locale for a dialect (the visitor's own country accent when it is known). */
export function dialectLocale(dialect: Dialect, country?: unknown): string {
  const code = typeof country === 'string' ? country.toUpperCase() : '';
  if (COUNTRY_LOCALE[code] && DIALECT_INFO[dialect].countries.includes(code)) return COUNTRY_LOCALE[code];
  return DIALECT_INFO[dialect].locale;
}

/** The engines' instruction for answering in this dialect (Arabic, like the rest of Shaheen's rules). */
export function dialectInstruction(dialect: Dialect): string {
  const style = DIALECT_INFO[dialect].style;
  return dialect === 'msa'
    ? `رد ${style} لما تكون العربية هي اللغة.`
    : `رد ${style} لما تكون العربية هي اللغة، كأنك واحد من أهل البلد بيتكلم بطبيعته، من غير مبالغة أو تقليد مضحك. لو الزائر كتب أو اتكلم بلهجة تانية، جاريه بلهجته هو.`;
}

const STORAGE_KEY = 'sham_dialect_v1';
/** The browser's localStorage, read without the DOM types (this module is shared with the server). */
const storage = (): { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void } | undefined =>
  (globalThis as { localStorage?: { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void } }).localStorage;

/** The visitor's own pick in this browser ('auto' when he never chose). */
export function savedDialectChoice(): DialectChoice {
  try {
    const value = storage()?.getItem(STORAGE_KEY);
    return isDialectChoice(value) ? value : 'auto';
  } catch { return 'auto'; }
}

export function saveDialectChoice(choice: DialectChoice): void {
  try {
    if (choice === 'auto') storage()?.removeItem(STORAGE_KEY);
    else storage()?.setItem(STORAGE_KEY, choice);
  } catch { /* Private mode: the pick lasts for this visit only. */ }
}
