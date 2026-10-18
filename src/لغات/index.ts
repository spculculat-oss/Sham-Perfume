/**
 * بوابة اللغات — نقطة ربط واحدة بين ملفات اللغات وبين شاهين والواجهات.
 *
 * كل ما يخص التعريب في المشروع صار تحت `src/لغات`، ومن هنا يقرأ شاهين أو أي شاشة
 * ما تحتاجه دون معرفة أسماء الملفات الداخلية:
 *
 *   import { SUPPORTED_LANGUAGES, t, uiLabel, contentLabel, noteMetric } from '../لغات';
 *
 * أو تقرير جاهز للعرض/الرد:
 *
 *   import { languageCatalogue, languageReport } from '../لغات';
 *   languageReport('ar'); // «100 لغة مدعومة، الإعدادات كاملة…»
 */
export * from './localize';
export * from './numerals';
export * from './i18n';
export * from './localizedContent';
export * from './contentLabels';
export * from './noteL10n';
export * from './uiTextL10n';
export { COMMON_LABELS_EXT } from './commonLabelsExt';

export {
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
  type LanguageConfig,
} from '../types/i18n';

import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../types/i18n';
import { LOCALE_MAP } from './localize';
import { CONTENT_LABELS_ALL, CONTENT_LABEL_KEYS } from './contentLabels';
import type { ContentLabelKey } from './contentLabels';
import { NOTE_METRICS } from './noteL10n';
import { UI_TEXT } from './uiTextL10n';

/** How much of the platform a single language actually carries today. */
export interface LanguageCoverage {
  code: SupportedLanguage;
  /** English name, e.g. "Egyptian Arabic". */
  name: string;
  /** The name the speakers use, e.g. "العربية". */
  nativeName: string;
  dir: 'rtl' | 'ltr';
  /** Canonical BCP-47 locale used for dates and numbers. */
  locale: string;
  contentLabels: { translated: number; total: number };
  uiLabels: { translated: number; total: number };
  noteMetrics: { translated: number; total: number };
}

/** The flat list of the 15 content-label keys (news 5 + materials 5 + placements 5). */
export const ALL_CONTENT_LABEL_KEYS: readonly ContentLabelKey[] = Object.values(CONTENT_LABEL_KEYS)
  .flatMap((group) => Object.values(group))
  .sort() as ContentLabelKey[];

const countIn = (pack: Record<string, unknown> | undefined, keys: readonly string[]): number =>
  pack ? keys.filter((key) => typeof pack[key] === 'string' && (pack[key] as string).length > 0).length : 0;

/**
 * Coverage report for every platform language, ready to be quoted by Shaheen
 * ("بنشتغل بكام لغة؟ وبأي تغطية؟") or rendered in an admin screen.
 */
export function languageCatalogue(): LanguageCoverage[] {
  const uiKeys = Object.keys(UI_TEXT);
  const noteKeys = Object.keys(NOTE_METRICS.en ?? {});
  return SUPPORTED_LANGUAGES.map((language) => {
    const code = language.code;
    const contentPack = CONTENT_LABELS_ALL[code] as Record<string, unknown> | undefined;
    return {
      code,
      name: language.name,
      nativeName: language.nativeName,
      dir: language.dir,
      locale: LOCALE_MAP[code],
      contentLabels: {
        translated: countIn(contentPack, ALL_CONTENT_LABEL_KEYS),
        total: ALL_CONTENT_LABEL_KEYS.length,
      },
      uiLabels: { translated: countIn(UI_TEXT as Record<string, unknown>, uiKeys), total: uiKeys.length },
      noteMetrics: { translated: countIn(NOTE_METRICS[code], noteKeys), total: noteKeys.length },
    };
  });
}

/** One language as a single line of Arabic, for Shaheen's replies and the admin panel. */
export function languageReport(code: SupportedLanguage): string {
  const entry = languageCatalogue().find((item) => item.code === code);
  if (!entry) return `اللغة «${code}» غير مدعومة.`;
  const { translated: labels, total: labelsTotal } = entry.contentLabels;
  const { translated: ui } = entry.uiLabels;
  const { translated: notes } = entry.noteMetrics;
  return (
    `${entry.nativeName} (${entry.name}) — ${entry.dir === 'rtl' ? 'يمين←يسار' : 'يسار←يمين'}، ` +
    `الوسوم ${labels}/${labelsTotal}، عناصر الواجهة ${ui}، مقاييس الهرم ${notes}.`
  );
}

/** The one-line summary Shaheen can state about the whole platform. */
export function languagesSummary(): string {
  const all = languageCatalogue();
  const full = all.filter((item) => item.contentLabels.translated === item.contentLabels.total).length;
  return `منصة شام بتدعم ${all.length} لغة، منها ${full} لغة بتغطية كاملة للوسوم (${full}/${all.length}).`;
}

/** Does the platform ship this language? */
export function isLanguageSupported(code: string): code is SupportedLanguage {
  return SUPPORTED_LANGUAGES.some((language) => language.code === code);
}

/**
 * نصوص المتجر — «متجر شام» بيتكلم لغات المنصة كلها من هنا (storeL10n.ts).
 * الواجهة تطلب مفتاحاً بلغة الزائر: `storeText(lang, 'sf_add_to_cart')` أو `makeStoreT(lang)`،
 * والحل: لغة الزائر ← الإنجليزية ← العربية ← المفتاح، فما حدش يشوف عربي غير لو اختار عربي.
 */
export * from './storeKeys';
export * from './storeL10n';

/**
 * نصوص بنر المنتجات (أعلى الصفحة الرئيسية) — كل لغة من لغات المنصة شايلة
 * الـ46 سلسلة كلها (bannerL10n.ts): مشاهد البنر وصندوق المنتجات ومنتقي
 * الدولة/العملة: `bannerText(lang, 'add_to_cart')` أو `makeBannerT(lang)`،
 * ومفاتيح العدّاد بتاخد `{ count }`.
 */
export * from './bannerKeys';
export * from './bannerL10n';
