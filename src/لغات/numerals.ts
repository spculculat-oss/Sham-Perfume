/**
 * Numerals in the visitor's own language — the language agent's first law.
 *
 * Why this exists: a native `<input type="number">` renders its digits in the
 * BROWSER's locale (an Egyptian visitor on an Arabic Chrome/Firefox saw ٦٥٠ on
 * a German page). A page must speak ONE language at a time: its numbers are
 * formatted and parsed here, from the site language — never from the browser.
 *
 * Rule: each language gets its LOCALE_MAP locale. Languages whose own digits
 * are Latin are pinned to the `latn` numbering system so a browser can never
 * smuggle other digits in. The Arabic-script home languages (ar, fa, ur, ps,
 * sd) keep their native digits — ٦٥٠ on the Arabic page is correct, wrong on
 * every other page. Parsing is lenient the other way: whatever digits a
 * visitor types (any of the platform's scripts) become a real number.
 */
import type { SupportedLanguage } from '../types/i18n';
import { LOCALE_MAP } from './localize';

/** Languages written with the Arabic script: their own digits are their language's digits. */
const ARABIC_SCRIPT_HOME = new Set<SupportedLanguage>(['ar', 'fa', 'ur', 'ps', 'sd']);

export interface LocalizedNumberOptions {
  /** Fixed fraction digits for read-only display (prices, weights): min = max = this. */
  fractionDigits?: number;
  /** Cap for editable numbers (trailing zeros trimmed). Default 6. */
  maximumFractionDigits?: number;
  /** Thousands grouping. Default true; inputs pass false so typing stays 1:1. */
  grouping?: boolean;
}

/** The BCP-47 tag to hang on a number field so even the browser agrees with the site language. */
export function numeralLocaleTag(lang: SupportedLanguage): string {
  return LOCALE_MAP[lang] || 'en-GB';
}

/** True when the language writes numbers with non-Latin (Arabic-Indic family) digits of its own. */
export function usesNativeDigits(lang: SupportedLanguage): boolean {
  return ARABIC_SCRIPT_HOME.has(lang);
}

/** Format a number for display in `lang` — digits, separators and all. */
export function formatLocalizedNumber(lang: SupportedLanguage, value: number, opts: LocalizedNumberOptions = {}): string {
  const safe = Number.isFinite(value) ? value : 0;
  const fixed = opts.fractionDigits;
  const options: Intl.NumberFormatOptions = {
    useGrouping: opts.grouping ?? true,
    minimumFractionDigits: fixed ?? 0,
    maximumFractionDigits: fixed ?? opts.maximumFractionDigits ?? 6,
  };
  if (!ARABIC_SCRIPT_HOME.has(lang)) options.numberingSystem = 'latn';
  try {
    return new Intl.NumberFormat(numeralLocaleTag(lang), options).format(safe);
  } catch {
    return new Intl.NumberFormat('en-GB', { ...options, numberingSystem: 'latn' }).format(safe);
  }
}

/** What an editable number field shows: no grouping, no forced trailing zeros. */
export function formatInputNumber(lang: SupportedLanguage, value: number, integer = false): string {
  return formatLocalizedNumber(lang, value, {
    grouping: false,
    maximumFractionDigits: integer ? 0 : 6,
  });
}

// Every digit family a platform visitor might type, as [first code point] ranges of 10.
const DIGIT_BASES = [
  0x0660, // Arabic-Indic ٠١٢٣٤٥٦٧٨٩
  0x06f0, // Eastern Arabic-Indic ۰۱۲۳۴۵۶۷۸۹ (Persian/Urdu)
  0x0966, // Devanagari
  0x09e6, // Bengali
  0x0a66, // Gurmukhi (Punjabi)
  0x0ae6, // Gujarati
  0x0b66, // Oriya
  0x0be6, // Tamil
  0x0c66, // Telugu
  0x0ce6, // Kannada
  0x0d66, // Malayalam
  0x0de6, // Sinhala
  0x0e50, // Thai
  0x0ed0, // Lao
  0x1040, // Myanmar
  0x17e0, // Khmer
  0xff10, // Fullwidth
];

/** Map any platform script's digits to Latin 0–9, character by character. */
export function toLatinDigits(text: string): string {
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp >= 0x30 && cp <= 0x39) { out += ch; continue; }
    let mapped: string | undefined;
    for (const base of DIGIT_BASES) {
      if (cp >= base && cp <= base + 9) { mapped = String(cp - base); break; }
    }
    out += mapped ?? ch;
  }
  return out;
}

/**
 * Parse what a visitor typed, whichever digits or decimal separator they used.
 * Accepts '.', ',', the Arabic '٫' as decimals and spaces / '٬' / the other
 * separator as grouping. Returns NaN for empty or non-numeric text, so each
 * caller keeps its own fallback («|| 0», «|| 30», clamps…).
 *
 * Dot/comma rule: with both present the right-most is the decimal. With only
 * commas, an exact grouping shape ("1,000,000") reads as grouped; otherwise a
 * comma is a decimal. A single dot is always a decimal point ("1.000" = 1);
 * repeated dots read as grouping ("1.234.567" = 1234567).
 */
export function parseLocalizedNumber(text: string): number {
  if (typeof text !== 'string') return NaN;
  let s = toLatinDigits(text)
    .replace(/[\s،٬']/g, '') // NBSP, narrow NBSP, Arabic commas/thousands, spaces, apostrophes
    .replace(/٫/g, '.') // Arabic decimal separator
    .replace(/−/g, '-'); // Unicode minus
  if (!s || s === '-' || s === '.' || s === ',') return NaN;

  const dots = s.split('.').length - 1;
  const commas = s.split(',').length - 1;
  if (dots && commas) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (commas) {
    if (/^-?\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '');
    else if (commas > 1) s = s.replace(/,/g, (m, off: number) => (off === s.lastIndexOf(',') ? '.' : ''));
    else s = s.replace(',', '.');
  } else if (dots > 1) {
    s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
