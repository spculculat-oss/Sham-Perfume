// SPDX-License-Identifier: MIT
/** Actual primary language tags from Spellophone 0.2.1 / eSpeak NG 1.52.0 listVoices(). */
import languages from '../data/localVoiceLanguages.json';
const available = new Set(languages);
const ALIASES: Record<string, string> = { zh: 'cmn', no: 'nb', en: 'en-us', fr: 'fr-fr' };
export const LOCAL_VOICE_VARIANTS = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'f1', 'f2', 'f3', 'f4', 'f5'] as const;
export function localVoiceLanguage(language: string): string | undefined {
  const normalized = language.toLowerCase();
  if (available.has(normalized)) return normalized;
  const base = normalized.split('-')[0];
  const code = ALIASES[base] || base;
  return available.has(code) ? code : undefined;
}
export function localVoiceOptions(language: string) {
  const code = localVoiceLanguage(language);
  if (!code) return [];
  return LOCAL_VOICE_VARIANTS.map((variant, index) => ({
    name: `sham-local:${code}:${variant}`, label: `${language === 'ar' ? 'محلي آلي' : 'Local synthetic'} ${String(index + 1).padStart(2, '0')} · ${language}`,
    lang: language, gender: variant.startsWith('f') ? 'female' as const : 'male' as const,
  }));
}
export function resolveLocalVoice(name: string | undefined, language: string) {
  const code = localVoiceLanguage(language);
  const selected = localVoiceOptions(language).find((item) => item.name === name);
  if (!selected || !code) return undefined;
  return { ...selected, engineVoice: `${code}+${selected.name.split(':')[2]}` };
}
