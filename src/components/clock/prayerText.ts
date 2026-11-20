import type { SupportedLanguage } from '../../types/i18n';
import { makeT, type LText } from '../../لغات/localize';
import type { PrayerMethod, PrayerName, PrayerPlace } from '../../utils/prayerConfig';
import type { ResolvedPrayerPlace } from '../../utils/prayerPlaces';
import { clockLocale } from './clockText';

const PRAYER_TEXT = {
  title: { ar: 'أوقات الصلاة', en: 'Prayer times' },
  launcherHelp: { ar: 'جدول مدينتك، الأذان والأذكار', en: 'Local times, adhan & adhkar' },
  launcherQuiet: { ar: 'اختياري · من غير صوت تلقائي', en: 'Optional · silent by default' },
  summaryOpen: { ar: 'الأذان والأذكار والإعدادات', en: 'Adhan, adhkar & settings' },
  summaryEstimate: { ar: 'مواعيد تقديرية · راجع تقويم المسجد', en: 'Estimated times · check your mosque’s timetable' },
  show: { ar: 'استرجاع المواقيت والأذكار', en: 'Restore prayer times & adhkar' },
  hiddenStatus: { ar: 'مخفية · التنبيهات متوقفة', en: 'Hidden · reminders off' },
  hide: { ar: 'إخفاء الأداة وإيقاف التنبيهات', en: 'Hide tool and turn reminders off' },
  loading: { ar: 'جاري فتح أوقات الصلاة…', en: 'Opening prayer times…' },
  loadFailed: { ar: 'أوقات الصلاة ما فتحتش. اقفل النافذة وحدّث الصفحة للمحاولة تاني.', en: 'Prayer times could not open. Close this window and reload to try again.' },
  close: { ar: 'إغلاق أوقات الصلاة', en: 'Close prayer times' },
  today: { ar: 'جدول الصلاة', en: 'Schedule' },
  adhan: { ar: 'الأذان والتنبيه', en: 'Adhan & reminders' },
  adhkar: { ar: 'الأذكار والأدعية', en: 'Adhkar & duas' },
  subtitle: { ar: 'أدوات الساعة · حسب توقيت المدينة', en: 'Clock tools · city local time' },
  selectLocation: { ar: 'اختار بلدك ومدينتك عشان يظهر جدول الأوقات.', en: 'Choose your country and city to see prayer times.' },
  locationSettings: { ar: 'المكان وطريقة الحساب', en: 'Location and calculation' },
  network: { ar: 'مكان تقريبي حسب شبكة الدخول', en: 'Approximate location from your network' },
  timezone: { ar: 'مدينة مقترحة حسب المنطقة الزمنية، مش موقعك المؤكد', en: 'A suggested city for your timezone, not a detected location' },
  countryHint: { ar: 'مدينة مقترحة في البلد؛ اختار أقرب مدينة ليك', en: 'A suggested city in your country; choose your nearest city' },
  manual: { ar: 'مدينة اخترتها بنفسك', en: 'City you selected' },
  gps: { ar: 'من موقع الجهاز · الحساب على جهازك فقط', en: 'Device location · calculated on this device only' },
  useGps: { ar: 'استخدم موقعي', en: 'Use my location' },
  locating: { ar: 'جاري تحديد الموقع…', en: 'Finding your location…' },
  gpsDenied: { ar: 'المتصفح لم يسمح بالموقع. تقدر تختار مدينتك يدويًا.', en: 'Location permission was denied. You can choose a city instead.' },
  gpsFailed: { ar: 'الموقع الدقيق مش متاح دلوقتي. جرّب تاني أو اختار مدينة.', en: 'An accurate location is not available right now. Retry or choose a city.' },
  gpsPrivacy: { ar: 'طلب الموقع اختياري. الإحداثيات ما بتتبعتش ولا بتتحفظ.', en: 'Location is optional. Your coordinates are never uploaded or saved.' },
  useSuggested: { ar: 'استخدم المدينة دي', en: 'Use this city' },
  automaticPlace: { ar: 'ارجع للمكان التلقائي', en: 'Use automatic location' },
  country: { ar: 'الدولة / المنطقة', en: 'Country / territory' },
  countryPlaceholder: { ar: 'اختار الدولة', en: 'Choose a country' },
  citySearch: { ar: 'ابحث عن مدينة', en: 'Find a city' },
  cityPlaceholder: { ar: 'اسم المدينة بالعربي أو الإنجليزي', en: 'City name in Arabic or Latin script' },
  city: { ar: 'المدينة', en: 'City' },
  cityChoose: { ar: 'اختار مدينة', en: 'Choose a city' },
  cityNoMatch: { ar: 'المدينة مش موجودة في الدليل. اختار الأقرب أو استخدم موقعك.', en: 'City not in the directory. Choose a nearby city or use your location.' },
  method: { ar: 'طريقة الحساب', en: 'Calculation method' },
  auto: { ar: 'تلقائي حسب البلد', en: 'Automatic for the country' },
  asrRule: { ar: 'حساب العصر', en: 'Asr calculation' },
  standard: { ar: 'ظل واحد (الجمهور)', en: 'One shadow length (standard)' },
  hanafi: { ar: 'ظلان (الحنفي)', en: 'Two shadow lengths (Hanafi)' },
  dateLocal: { ar: 'التاريخ في المدينة المختارة', en: 'Date in selected city' },
  upcoming: { ar: 'الصلاة القادمة', en: 'Next prayer' },
  tomorrow: { ar: 'بكرة', en: 'Tomorrow' },
  previousDay: { ar: 'من جدول امبارح', en: 'From yesterday’s schedule' },
  nextDay: { ar: 'بعد نص الليل', en: 'After midnight' },
  scheduleUnavailable: { ar: 'مفيش جدول كامل صالح للمكان والتاريخ ده. راجع المسجد المحلي؛ التنبيه متوقف لو المواعيد ناقصة.', en: 'A complete schedule is unavailable for this place and date. Check your local mosque; reminders skip incomplete days.' },
  approximate: { ar: 'المواعيد تقديرية، وممكن تختلف عن تقويم المسجد. التذكير بيعتمد على ضبط ساعة جهازك.', en: 'Times are estimates and may differ from your mosque’s timetable. Reminders use your device’s clock.' },
  twilight: { ar: 'أوقات الفجر والعشاء ممكن تكون تقديرية بسبب طول النهار أو الليل.', en: 'Fajr and Isha may be estimated because of long days or nights.' },
  sunriseNote: { ar: 'للعرْض فقط', en: 'Display only' },
  reminders: { ar: 'التذكير عند دخول وقت الصلاة', en: 'Reminder at the start of prayer time' },
  reminderHelp: { ar: 'التنبيه اختياري ومقفول لحد ما تشغّله بنفسك. بيشتغل في الصفحة المفتوحة بس؛ المتصفح ممكن يوقفه في الخلفية. فعّله تاني لو فتحت صفحة جديدة.', en: 'Reminders are optional and off until you turn them on. Keep this page open; the browser may suspend it in the background. Turn reminders on again in a new page.' },
  off: { ar: 'إيقاف التنبيه', en: 'Reminders off' },
  visual: { ar: 'تنبيه صامت على الصفحة', en: 'Silent on-page reminder' },
  audio: { ar: 'تنبيه بصوت الأذان', en: 'Reminder with adhan' },
  enabledVisual: { ar: 'التنبيه الصامت شغّال في الصفحة دي', en: 'Silent reminders are on in this page' },
  enabledAudio: { ar: 'الأذان شغّال في الصفحة دي', en: 'Adhan reminders are on in this page' },
  muted: { ar: 'التنبيه مقفول', en: 'Reminders are off' },
  activateWaiting: { ar: 'جاري إعداد الصوت…', en: 'Preparing sound…' },
  activationBlocked: { ar: 'المتصفح منع الصوت. جرّب زر الصوت تاني، أو استخدم التنبيه الصامت.', en: 'The browser blocked sound. Try the sound button again or use silent reminders.' },
  confirmPlace: { ar: 'أكد المدينة أو استخدم موقعك عشان تشغّل التنبيه.', en: 'Confirm a city or use your location to turn reminders on.' },
  confirmPrayer: { ar: 'اختار صلاة واحدة على الأقل للتذكير.', en: 'Choose at least one prayer for reminders.' },
  whichPrayers: { ar: 'الصلوات اللي تحب تتنبه لها', en: 'Prayers to remind you about' },
  regularVoice: { ar: 'صوت أذان باقي الصلوات', en: 'Voice for other prayers' },
  fajrVoice: { ar: 'صوت أذان الفجر', en: 'Voice for Fajr' },
  deviceVoice: { ar: 'ملف من جهازي', en: 'File from my device' },
  importNote: { ar: 'تقدر تختار تسجيل أذان عندك من جهازك لكل اختيار. اختار تسجيل فجر للفجر. الملف مش هيترفع ومش هيتحفظ بعد قفل أو تحديث الصفحة.', en: 'Use a recording you have on this device, with a Fajr recording for Fajr. Files are not uploaded and are cleared when you close or refresh the page.' },
  invalidFile: { ar: 'اختار ملف MP3 أو M4A أو AAC أو WAV بحجم لحد ١٢ ميجا.', en: 'Choose an MP3, M4A, AAC or WAV file up to 12 MB.' },
  previewRegular: { ar: 'اسمع أذان باقي الصلوات', en: 'Preview regular adhan' },
  previewFajr: { ar: 'اسمع أذان الفجر', en: 'Preview Fajr adhan' },
  stop: { ar: 'إيقاف الصوت', en: 'Stop sound' },
  playing: { ar: 'الأذان شغّال', en: 'Adhan playing' },
  fetchingAudio: { ar: 'جاري تحميل الصوت…', en: 'Loading recording…' },
  playbackError: { ar: 'الصوت مش متاح دلوقتي. جرّب تاني أو اختار تسجيل تاني.', en: 'The recording could not play. Retry or choose another recording.' },
  recordingSources: { ar: 'مصادر وتراخيص التسجيلات', en: 'Recording sources and licenses' },
  reminderVoices: { ar: 'أصوات التنبيه داخل الموقع', en: 'Reminder sounds' },
  listenLibrary: { ar: 'أذان الحرمين وآيا صوفيا والقرّاء', en: 'Adhan from the holy mosques, Hagia Sophia & reciters' },
  listenOnly: { ar: 'استماع من المصدر', en: 'Listen at the source' },
  listenHelp: { ar: 'التسجيلات دي بتفتح عند الناشر في تبويب جديد، ومش أصوات تنبيه. لو التسجيل عندك، اختار «ملف من جهازي» في إعدادات الصوت.', en: 'These recordings open on the publisher’s site in a new tab. They aren’t reminder sounds. To use a recording you have, choose File from my device in the sound settings.' },
  dismiss: { ar: 'إغلاق التذكير', en: 'Dismiss reminder' },
  prayerArrived: { ar: 'حان وقت الصلاة', en: 'It’s time for prayer' },
  readMore: { ar: 'اقرأ حصن المسلم كاملًا', en: 'Read the complete Hisn al-Muslim' },
  collectionNote: { ar: 'مجموعة أذكار من القرآن والسنة مع مصادرها. للكتاب كاملًا، افتح النسخة المنشورة على دار الإسلام.', en: 'A selection of adhkar from the Quran and Sunnah, with references. The full book is available from IslamHouse.' },
  searchAdhkar: { ar: 'ابحث في الأذكار', en: 'Search adhkar' },
  searchExample: { ar: 'مثال: النوم، الاستغفار، السفر', en: 'For example: sleep, forgiveness, travel' },
  allAdhkar: { ar: 'كل الأقسام', en: 'All categories' },
  noAdhkar: { ar: 'مفيش نتائج. جرّب كلمة تانية أو اختار كل الأقسام.', en: 'No results. Try a different word or select all categories.' },
  count: { ar: 'عدّ التكرار', en: 'Count repetition' },
  resetCount: { ar: 'صفّر العدّ', en: 'Reset count' },
  reps: { ar: 'عدد التكرار', en: 'Repetitions' },
  source: { ar: 'المصدر', en: 'Source' },
} satisfies Record<string, LText>;
export const prayerT = (lang: SupportedLanguage) => makeT(lang, PRAYER_TEXT);
export const PRAYER_LABELS: Record<PrayerName, LText> = {
  fajr: { ar: 'الفجر', en: 'Fajr' }, sunrise: { ar: 'الشروق', en: 'Sunrise' }, dhuhr: { ar: 'الظهر', en: 'Dhuhr' },
  asr: { ar: 'العصر', en: 'Asr' }, maghrib: { ar: 'المغرب', en: 'Maghrib' }, isha: { ar: 'العشاء', en: 'Isha' },
};
export const METHOD_NAMES: Record<PrayerMethod, LText> = {
  Egyptian: { ar: 'الهيئة المصرية العامة للمساحة', en: 'Egyptian General Authority of Survey' },
  UmmAlQura: { ar: 'أم القرى · مكة', en: 'Umm al-Qura · Makkah' },
  Dubai: { ar: 'دبي', en: 'Dubai' }, Qatar: { ar: 'قطر', en: 'Qatar' }, Kuwait: { ar: 'الكويت', en: 'Kuwait' },
  Karachi: { ar: 'جامعة العلوم الإسلامية · كراتشي', en: 'University of Islamic Sciences · Karachi' },
  Turkey: { ar: 'تركيا · تقدير ديانت', en: 'Türkiye · Diyanet approximation' },
  Singapore: { ar: 'سنغافورة', en: 'Singapore' }, Tehran: { ar: 'جامعة طهران', en: 'University of Tehran' },
  NorthAmerica: { ar: 'أمريكا الشمالية · ISNA', en: 'North America · ISNA' },
  MoonsightingCommittee: { ar: 'لجنة رؤية الهلال', en: 'Moonsighting Committee' },
  MuslimWorldLeague: { ar: 'رابطة العالم الإسلامي', en: 'Muslim World League' },
};
export type PrayerT = ReturnType<typeof prayerT>;

export function prayerFormatters(lang: SupportedLanguage, timeZone: string) {
  const { locale, numberingSystem } = clockLocale(lang);
  return {
    time: new Intl.DateTimeFormat(locale, { timeZone, numberingSystem, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
    date: new Intl.DateTimeFormat(locale, { timeZone, calendar: 'gregory', numberingSystem, dateStyle: 'full' }),
  };
}

export function prayerCountryName(lang: SupportedLanguage, country: string): string {
  try { return new Intl.DisplayNames([clockLocale(lang).locale], { type: 'region' }).of(country) || country; }
  catch { return country; }
}

export const prayerCityName = (lang: SupportedLanguage, place: PrayerPlace) => lang === 'ar' ? place.cityAr : place.cityEn;

export function prayerPlaceLabel(lang: SupportedLanguage, resolved?: ResolvedPrayerPlace): string {
  if (!resolved) return '';
  const { place, source } = resolved;
  const city = prayerCityName(lang, place);
  // GPS country can be inferred from a neighboring zone; the useful datum is the timezone.
  return source === 'gps' || place.country === 'UN' ? city : `${city} · ${prayerCountryName(lang, place.country)}`;
}
