import type { SupportedLanguage } from '../../types/i18n';
import { LOCALE_MAP } from '../../لغات/localize';
import { toLatinDigits, usesNativeDigits } from '../../لغات/numerals';

export const NEWS_BOOKMARK_KEY = 'sham_news_bookmarks_v1';

export function readNewsBookmarks(raw: string | null): string[] {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (Array.isArray(value)) {
      return [...new Set(value.filter((id): id is string => typeof id === 'string' && id.trim().length > 0 && id.length <= 180))].slice(0, 500);
    }
  } catch { /* Optional device-local storage. */ }
  return [];
}

export function normalizeNewsQuery(value: string): string {
  return toLatinDigits(value).normalize('NFD').replace(/\p{M}|\u0640/gu, '')
    .replace(/ٱ/g, 'ا').replace(/ى/g, 'ي').toLowerCase().trim();
}

export function matchesNewsQuery(value: string, ...fields: (string | undefined)[]): boolean {
  const query = normalizeNewsQuery(value);
  if (!query) return true;
  const text = normalizeNewsQuery(fields.filter(Boolean).join(' '));
  return query.split(/\s+/).every((token) => text.includes(token));
}

export function newsDate(iso: string | undefined, lang: SupportedLanguage, options?: Intl.DateTimeFormatOptions): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat(LOCALE_MAP[lang] || 'en', {
    day: 'numeric', month: 'short', year: 'numeric', ...options,
    timeZone: 'UTC', numberingSystem: usesNativeDigits(lang) ? undefined : 'latn',
  }).format(date);
}
