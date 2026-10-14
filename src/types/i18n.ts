export type SupportedLanguage =
  | 'ar'
  | 'en'
  | 'fr'
  | 'es'
  | 'it'
  | 'de'
  | 'ru'
  | 'zh'
  | 'tr'
  | 'fa'
  // Extended languages — batch 1 (LTR)
  | 'hi'
  | 'pt'
  | 'id'
  | 'ja'
  | 'ko'
  | 'vi'
  | 'th'
  | 'pl'
  | 'nl'
  | 'uk'
  | 'el'
  | 'ms'
  | 'bn'
  | 'cs'
  | 'ro';

export interface LanguageConfig {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  dir: 'rtl' | 'ltr';
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageConfig[] = [
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', dir: 'rtl', flag: '🇸🇦' },
  { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr', flag: '🇬🇧' },
  { code: 'fr', name: 'French', nativeName: 'Français', dir: 'ltr', flag: '🇫🇷' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', dir: 'ltr', flag: '🇪🇸' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', dir: 'ltr', flag: '🇮🇹' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', dir: 'ltr', flag: '🇩🇪' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', dir: 'ltr', flag: '🇷🇺' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', dir: 'ltr', flag: '🇨🇳' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', dir: 'ltr', flag: '🇹🇷' },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی', dir: 'rtl', flag: '🇮🇷' },
  // Extended languages — batch 1 (LTR)
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', dir: 'ltr', flag: '🇮🇳' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', dir: 'ltr', flag: '🇧🇷' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', dir: 'ltr', flag: '🇮🇩' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', dir: 'ltr', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', dir: 'ltr', flag: '🇰🇷' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', dir: 'ltr', flag: '🇻🇳' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', dir: 'ltr', flag: '🇹🇭' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', dir: 'ltr', flag: '🇵🇱' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', dir: 'ltr', flag: '🇳🇱' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', dir: 'ltr', flag: '🇺🇦' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', dir: 'ltr', flag: '🇬🇷' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', dir: 'ltr', flag: '🇲🇾' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', dir: 'ltr', flag: '🇧🇩' },
  { code: 'cs', name: 'Czech', nativeName: 'Čeština', dir: 'ltr', flag: '🇨🇿' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română', dir: 'ltr', flag: '🇷🇴' },
];

export type TranslationKey = string;
