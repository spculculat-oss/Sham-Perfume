import React, { useState } from 'react';
import type { SupportedLanguage } from '../types/i18n';
import { formatInputNumber, numeralLocaleTag, parseLocalizedNumber } from '../لغات/numerals';

/**
 * A number field that speaks the SITE language, not the browser's.
 *
 * A native `<input type="number">` renders its digits in the browser's locale
 * (an Arabic-locale browser showed ٦٥٠ on the German cost page), which no page
 * language setting can fully control. This field is a text input whose value
 * is formatted/parsed by «لغات/numerals»: German shows "12,5", Arabic keeps
 * "١٢٫٥", and whatever digits a visitor types (any script the platform speaks)
 * are understood. While the field is focused the visitor's own text is left
 * untouched (typing "12," stays "12,"); on blur it settles to the canonical
 * localized form. The `lang` attribute carries the language's BCP-47 tag so
 * assistive tech and the browser's own picking agree too.
 */
export interface LocalizedNumberInputProps {
  lang: SupportedLanguage;
  value: number;
  /** Called on every keystroke with the parsed value (NaN for an empty/unfinished field). */
  onValue: (value: number) => void;
  className?: string;
  /** Whole numbers only (display precision + numeric keypad). */
  integer?: boolean;
  min?: number;
  max?: number;
  placeholder?: string;
  name?: string;
  id?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

export const LocalizedNumberInput: React.FC<LocalizedNumberInputProps> = ({
  lang,
  value,
  onValue,
  className,
  integer = false,
  min,
  max,
  placeholder,
  name,
  id,
  ariaLabel,
  disabled = false,
}) => {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? formatInputNumber(lang, value, integer);
  return (
    <input
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      lang={numeralLocaleTag(lang)}
      autoComplete="off"
      spellCheck={false}
      disabled={disabled}
      name={name}
      id={id}
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      placeholder={placeholder}
      className={className}
      value={shown}
      onFocus={() => setDraft(formatInputNumber(lang, value, integer))}
      onChange={(e) => {
        setDraft(e.target.value);
        onValue(parseLocalizedNumber(e.target.value));
      }}
      onBlur={() => setDraft(null)}
    />
  );
};
