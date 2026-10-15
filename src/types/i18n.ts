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
  | 'ro'
  // Extended languages — batch 2 (RTL)
  | 'he'
  | 'ur'
  | 'ps'
  // Extended languages — batch 3 (LTR: Nordics, Balkans, Baltics, Caucasus)
  | 'sv'
  | 'da'
  | 'fi'
  | 'no'
  | 'hu'
  | 'sk'
  | 'sl'
  | 'hr'
  | 'sr'
  | 'bg'
  | 'lt'
  | 'lv'
  | 'et'
  | 'ka'
  | 'hy'
  // Extended languages — batch 4 (LTR: Africa, SE Asia, Oceania)
  | 'tl'
  | 'sw'
  | 'am'
  | 'ha'
  | 'yo'
  | 'zu'
  | 'af'
  | 'so'
  | 'jv'
  | 'mi'
  | 'ne'
  | 'si'
  | 'my'
  | 'km'
  | 'lo'
  // Extended languages — batch 5 (LTR: Indian subcontinent, Central Asia)
  | 'ta'
  | 'te'
  | 'mr'
  | 'gu'
  | 'pa'
  | 'kn'
  | 'ml'
  | 'or'
  | 'kk'
  | 'uz'
  | 'az'
  | 'mn'
  | 'ky'
  | 'tg'
  | 'tk';

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
  // Extended languages — batch 2 (RTL)
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', dir: 'rtl', flag: '🇮🇱' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', dir: 'rtl', flag: '🇵🇰' },
  { code: 'ps', name: 'Pashto', nativeName: 'پښتو', dir: 'rtl', flag: '🇦🇫' },
  // Extended languages — batch 3 (LTR: Nordics, Balkans, Baltics, Caucasus)
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', dir: 'ltr', flag: '🇸🇪' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk', dir: 'ltr', flag: '🇩🇰' },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi', dir: 'ltr', flag: '🇫🇮' },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk', dir: 'ltr', flag: '🇳🇴' },
  { code: 'hu', name: 'Hungarian', nativeName: 'Magyar', dir: 'ltr', flag: '🇭🇺' },
  { code: 'sk', name: 'Slovak', nativeName: 'Slovenčina', dir: 'ltr', flag: '🇸🇰' },
  { code: 'sl', name: 'Slovenian', nativeName: 'Slovenščina', dir: 'ltr', flag: '🇸🇮' },
  { code: 'hr', name: 'Croatian', nativeName: 'Hrvatski', dir: 'ltr', flag: '🇭🇷' },
  { code: 'sr', name: 'Serbian', nativeName: 'Srpski', dir: 'ltr', flag: '🇷🇸' },
  { code: 'bg', name: 'Bulgarian', nativeName: 'Български', dir: 'ltr', flag: '🇧🇬' },
  { code: 'lt', name: 'Lithuanian', nativeName: 'Lietuvių', dir: 'ltr', flag: '🇱🇹' },
  { code: 'lv', name: 'Latvian', nativeName: 'Latviešu', dir: 'ltr', flag: '🇱🇻' },
  { code: 'et', name: 'Estonian', nativeName: 'Eesti', dir: 'ltr', flag: '🇪🇪' },
  { code: 'ka', name: 'Georgian', nativeName: 'ქართული', dir: 'ltr', flag: '🇬🇪' },
  { code: 'hy', name: 'Armenian', nativeName: 'Հայերեն', dir: 'ltr', flag: '🇦🇲' },
  // Extended languages — batch 4 (LTR: Africa, SE Asia, Oceania)
  { code: 'tl', name: 'Tagalog', nativeName: 'Filipino', dir: 'ltr', flag: '🇵🇭' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', dir: 'ltr', flag: '🇰🇪' },
  { code: 'am', name: 'Amharic', nativeName: 'አማርኛ', dir: 'ltr', flag: '🇪🇹' },
  { code: 'ha', name: 'Hausa', nativeName: 'Hausa', dir: 'ltr', flag: '🇳🇬' },
  { code: 'yo', name: 'Yoruba', nativeName: 'Yorùbá', dir: 'ltr', flag: '🇳🇬' },
  { code: 'zu', name: 'Zulu', nativeName: 'isiZulu', dir: 'ltr', flag: '🇿🇦' },
  { code: 'af', name: 'Afrikaans', nativeName: 'Afrikaans', dir: 'ltr', flag: '🇿🇦' },
  { code: 'so', name: 'Somali', nativeName: 'Soomaali', dir: 'ltr', flag: '🇸🇴' },
  { code: 'jv', name: 'Javanese', nativeName: 'Basa Jawa', dir: 'ltr', flag: '🇮🇩' },
  { code: 'mi', name: 'Maori', nativeName: 'Te Reo Māori', dir: 'ltr', flag: '🇳🇿' },
  { code: 'ne', name: 'Nepali', nativeName: 'नेपाली', dir: 'ltr', flag: '🇳🇵' },
  { code: 'si', name: 'Sinhala', nativeName: 'සිංහල', dir: 'ltr', flag: '🇱🇰' },
  { code: 'my', name: 'Burmese', nativeName: 'မြန်မာ', dir: 'ltr', flag: '🇲🇲' },
  { code: 'km', name: 'Khmer', nativeName: 'ខ្មែរ', dir: 'ltr', flag: '🇰🇭' },
  { code: 'lo', name: 'Lao', nativeName: 'ລາວ', dir: 'ltr', flag: '🇱🇦' },
  // Extended languages — batch 5 (LTR: Indian subcontinent, Central Asia)
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', dir: 'ltr', flag: '🇮🇳' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', dir: 'ltr', flag: '🇮🇳' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', dir: 'ltr', flag: '🇮🇳' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', dir: 'ltr', flag: '🇮🇳' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', dir: 'ltr', flag: '🇮🇳' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', dir: 'ltr', flag: '🇮🇳' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', dir: 'ltr', flag: '🇮🇳' },
  { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', dir: 'ltr', flag: '🇮🇳' },
  { code: 'kk', name: 'Kazakh', nativeName: 'Қазақ тілі', dir: 'ltr', flag: '🇰🇿' },
  { code: 'uz', name: 'Uzbek', nativeName: 'Oʻzbekcha', dir: 'ltr', flag: '🇺🇿' },
  { code: 'az', name: 'Azerbaijani', nativeName: 'Azərbaycan dili', dir: 'ltr', flag: '🇦🇿' },
  { code: 'mn', name: 'Mongolian', nativeName: 'Монгол хэл', dir: 'ltr', flag: '🇲🇳' },
  { code: 'ky', name: 'Kyrgyz', nativeName: 'Кыргызча', dir: 'ltr', flag: '🇰🇬' },
  { code: 'tg', name: 'Tajik', nativeName: 'Тоҷикӣ', dir: 'ltr', flag: '🇹🇯' },
  { code: 'tk', name: 'Turkmen', nativeName: 'Türkmençe', dir: 'ltr', flag: '🇹🇲' },
];

export type TranslationKey = string;
