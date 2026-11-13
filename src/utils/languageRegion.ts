/**
 * «شاهين بيتكلم بلغة بلدك ولهجتها»: a language is not said the same way everywhere. French in Montréal is not
 * French in Paris, Spanish in Mexico City is not Spanish in Madrid, Portuguese in São Paulo is not Portuguese in
 * Lisbon. The site already opens in the language of the country the visitor enters from (geoDetector →
 * `detectEntryLanguageAsync`), and his own pick of a language always wins. This file adds the country's own
 * variant of that language:
 *   - the speech locale (`fr-CA`, `es-MX`, `pt-PT`, `en-US` …) so the device voice and the ear use that accent;
 *   - the engines' instruction («write the way people in Mexico talk», Traditional characters for Taiwan …).
 * Arabic has its own dialect system (arabicDialect.ts); this file is for the other site languages.
 * Pure (no DOM): the browser, the server and the tests share it.
 */
import type { SupportedLanguage } from '../types/i18n';
import { findCountryByCode } from '../data/worldCountries';

/** Countries whose own accent of a language speech engines know (the first is the language's home). */
export const REGIONAL: Partial<Record<SupportedLanguage, readonly string[]>> = {
  en: ['GB', 'US', 'CA', 'AU', 'NZ', 'IE', 'IN', 'ZA', 'NG', 'KE', 'GH', 'PH', 'SG', 'PK', 'TZ', 'HK'],
  fr: ['FR', 'CA', 'BE', 'CH', 'LU'],
  es: ['ES', 'MX', 'US', 'AR', 'CO', 'CL', 'PE', 'VE', 'EC', 'GT', 'CU', 'BO', 'DO', 'HN', 'PY', 'SV', 'NI', 'CR', 'PA', 'UY', 'PR'],
  pt: ['BR', 'PT', 'AO', 'MZ'],
  de: ['DE', 'AT', 'CH'],
  it: ['IT', 'CH'],
  nl: ['NL', 'BE'],
  zh: ['CN', 'TW', 'HK', 'SG'],
  sv: ['SE', 'FI'],
  ms: ['MY', 'SG', 'BN'],
  sw: ['KE', 'TZ'],
  bn: ['BD', 'IN'],
  ta: ['IN', 'LK', 'SG', 'MY'],
  ur: ['PK', 'IN'],
  ro: ['RO', 'MD'],
  el: ['GR', 'CY'],
  tr: ['TR', 'CY'],
  ca: ['ES', 'AD'],
  so: ['SO', 'DJ', 'KE', 'ET'],
  ha: ['NG', 'NE'],
  ne: ['NP', 'IN'],
  sq: ['AL', 'XK', 'MK'],
};

/** The tag speech engines use for a language (some differ from the site's own code). */
const SPEECH_CODE: Partial<Record<SupportedLanguage, string>> = { no: 'nb', tl: 'fil' };

/** `fr` + `CA` → `fr-CA`; undefined when that country has no accent of its own for the language. */
export function regionalLocale(language: SupportedLanguage, country?: unknown): string | undefined {
  const code = typeof country === 'string' ? country.trim().toUpperCase() : '';
  if (language === 'ar' || !/^[A-Z]{2}$/.test(code) || !REGIONAL[language]?.includes(code)) return undefined;
  return `${SPEECH_CODE[language] || language}-${code}`;
}

const LATIN_AMERICA = new Set((REGIONAL.es || []).filter((code) => code !== 'ES'));
/** What changes beyond words and accent (script, forms of address) — said to the engines in Arabic like the rest. */
function variantNote(language: SupportedLanguage, code: string): string {
  if (language === 'zh') return code === 'TW' || code === 'HK' ? 'بالحروف الصينية التقليدية (Traditional)' : 'بالحروف الصينية المبسطة (Simplified)';
  if (language === 'pt') return code === 'BR' ? 'بالبرتغالية البرازيلية (você، ônibus، celular)' : 'بالبرتغالية الأوروبية (tu، autocarro، telemóvel)';
  if (language === 'es') {
    if (code === 'ES') return 'بإسبانية إسبانيا (vosotros، ordenador، coche)';
    if (code === 'AR' || code === 'UY' || code === 'PY') return 'بإسبانية أمريكا اللاتينية بصيغة «vos» المحلية (vos tenés، ustedes)';
    if (LATIN_AMERICA.has(code)) return 'بإسبانية أمريكا اللاتينية (ustedes، computadora، carro)';
  }
  if (language === 'en') return code === 'US' || code === 'PH' ? 'بالإنجليزية الأمريكية (color، apartment، fall)' : 'بالإنجليزية البريطانية في الهجاء (colour، flat، autumn)';
  if (language === 'fr' && code === 'CA') return 'بفرنسية كندا (courriel، magasiner، fin de semaine)';
  if (language === 'fr' && (code === 'BE' || code === 'CH')) return 'بفرنسية بلده (septante، nonante)';
  if (language === 'de' && code === 'CH') return 'بالألمانية السويسرية المكتوبة (ss بدل ß)';
  return '';
}

/**
 * The engines' instruction for the visitor's own variant of a non-Arabic language, or '' when there is none.
 * («اكتب بالفرنسية زي أهل كندا ما بيتكلموا»…). Arabic dialects go through `dialectInstruction` instead.
 */
export function regionInstruction(language: SupportedLanguage, country?: unknown): string {
  if (!regionalLocale(language, country)) return '';
  const code = String(country).trim().toUpperCase();
  let name = findCountryByCode(code)?.nameAr || '';
  if (!name) { try { name = new Intl.DisplayNames(['ar'], { type: 'region' }).of(code) || code; } catch { name = code; } }
  const note = variantNote(language, code);
  return `اكتب ردك ${note ? `${note} ` : ''}وبالكلمات وطريقة الكلام المعتادة عند أهل ${name}، زي واحد من بلدهم بيتكلم طبيعي (من غير مبالغة في العامية).`;
}
