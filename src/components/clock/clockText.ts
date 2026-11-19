import type { SupportedLanguage } from '../../types/i18n';
import { makeT, type LText } from '../../لغات/localize';
import { formatLocalizedNumber, numeralLocaleTag, usesNativeDigits } from '../../لغات/numerals';

export const CLOCK_TEXT = {
  tools: { ar: 'أدوات الساعة', en: 'Clock tools' },
  alarms: { ar: 'المنبّهات', en: 'Alarms' },
  timer: { ar: 'العداد التنازلي', en: 'Timer' },
  stopwatch: { ar: 'ساعة الإيقاف', en: 'Stopwatch' },
  close: { ar: 'إغلاق أدوات الساعة', en: 'Close clock tools' },
  addAlarm: { ar: 'إضافة منبّه', en: 'Add alarm' },
  edit: { ar: 'تعديل', en: 'Edit' },
  delete: { ar: 'حذف', en: 'Delete' },
  enable: { ar: 'تشغيل المنبّه', en: 'Enable alarm' },
  disable: { ar: 'إيقاف المنبّه', en: 'Disable alarm' },
  alarmName: { ar: 'اسم المنبّه', en: 'Alarm name' },
  alarmPlaceholder: { ar: 'اختياري، مثلاً: الشغل', en: 'Optional, e.g. Work' },
  alarmDefault: { ar: 'منبّه', en: 'Alarm' },
  noAlarms: { ar: 'لسه مفيش منبّهات. اضبط أول منبّه وحدّد الأيام اللي محتاجه فيها.', en: 'No alarms yet. Set your first alarm and choose the days you need it.' },
  repeating: { ar: 'التكرار', en: 'Repeat' },
  once: { ar: 'مرة واحدة', en: 'Once' },
  daily: { ar: 'كل يوم', en: 'Every day' },
  day0: { ar: 'الأحد', en: 'Sun' },
  day1: { ar: 'الإثنين', en: 'Mon' },
  day2: { ar: 'الثلاثاء', en: 'Tue' },
  day3: { ar: 'الأربعاء', en: 'Wed' },
  day4: { ar: 'الخميس', en: 'Thu' },
  day5: { ar: 'الجمعة', en: 'Fri' },
  day6: { ar: 'السبت', en: 'Sat' },
  wallHint: { ar: 'بنحفظ المنطقة الزمنية مع المنبّه. التوقيت بيستخدم ساعة جهازك.', en: 'Alarms keep the selected time zone and use your device’s clock.' },
  next: { ar: 'الموعد الجاي', en: 'Next' },
  snoozed: { ar: 'مؤجّل لحد', en: 'Snoozed until' },
  alarmOff: { ar: 'متوقف', en: 'Off' },
  alarmLimit: { ar: 'وصلت للحد الأقصى للمنبّهات. احذف منبّه لو عايز تضيف واحد جديد.', en: 'Alarm limit reached. Delete an alarm to add another.' },
  invalidAlarm: { ar: 'ادخل ساعة من ٠ لـ٢٣ ودقيقة من ٠ لـ٥٩.', en: 'Enter an hour from 0 to 23 and a minute from 0 to 59.' },
  invalidTimer: { ar: 'ادخل مدة صحيحة أكبر من صفر وأقل من يوم.', en: 'Enter a duration greater than zero and less than a day.' },
  save: { ar: 'احفظ وشغّل', en: 'Save & enable' },
  cancel: { ar: 'إلغاء', en: 'Cancel' },
  hours: { ar: 'ساعات', en: 'Hours' },
  minutes: { ar: 'دقايق', en: 'Minutes' },
  seconds: { ar: 'ثواني', en: 'Seconds' },
  alarmHour: { ar: 'الساعة', en: 'Hour' },
  alarmMinute: { ar: 'الدقيقة', en: 'Minute' },
  minShort: { ar: 'د', en: 'min' },
  presets: { ar: 'مدد سريعة', en: 'Quick presets' },
  start: { ar: 'ابدأ', en: 'Start' },
  pause: { ar: 'وقّف مؤقتًا', en: 'Pause' },
  resume: { ar: 'كمّل', en: 'Resume' },
  reset: { ar: 'إعادة ضبط', en: 'Reset' },
  lap: { ar: 'سجّل لفة', en: 'Lap' },
  lapCount: { ar: 'اللفة', en: 'Lap' },
  split: { ar: 'مدة اللفة', en: 'Split' },
  total: { ar: 'الوقت الكلي', en: 'Total' },
  ready: { ar: 'جاهز', en: 'Ready' },
  running: { ar: 'شغّال', en: 'Running' },
  paused: { ar: 'متوقف مؤقتًا', en: 'Paused' },
  done: { ar: 'الوقت خلص', en: 'Time is up' },
  alarmRinging: { ar: 'المنبّه رنّ', en: 'Alarm ringing' },
  missedAlarm: { ar: 'فات موعد المنبّه', en: 'Missed alarm' },
  snooze: { ar: 'غفوة', en: 'Snooze' },
  dismiss: { ar: 'إيقاف التنبيه', en: 'Dismiss' },
  soundSettings: { ar: 'الصوت والإشعارات', en: 'Sound & notifications' },
  tone: { ar: 'النغمة', en: 'Ringtone' },
  chime: { ar: 'هادية', en: 'Chime' },
  pulse: { ar: 'نبضات', en: 'Pulse' },
  bell: { ar: 'جرس', en: 'Bell' },
  volume: { ar: 'مستوى الصوت', en: 'Volume' },
  testSound: { ar: 'جرّب الصوت', en: 'Test sound' },
  soundOk: { ar: 'الصوت جاهز. ارفع صوت الجهاز لو مش سامع النغمة.', en: 'Sound is ready. Turn up your device if you can’t hear the tone.' },
  soundBlocked: { ar: 'المتصفح مش قادر يشغّل الصوت. التنبيه هيظهر جوه الموقع.', en: 'This browser could not play audio. Alerts will still appear on the site.' },
  enableNotifications: { ar: 'فعّل إشعارات المتصفح', en: 'Enable browser notifications' },
  disableNotifications: { ar: 'أوقف إشعارات المتصفح', en: 'Turn off browser notifications' },
  notificationHint: { ar: 'لو المتصفح بيدعمها، هتظهر الإشعارات لما التبويب يكون في الخلفية.', en: 'On supported browsers, notifications show when the tab is in the background.' },
  notificationBlocked: { ar: 'الإشعارات مش مسموح بيها في المتصفح ده أو في المعاينة.', en: 'Notifications are not allowed in this browser or preview.' },
  keepOpen: { ar: 'خلي الموقع مفتوح عشان التنبيه يشتغل. لو المتصفح وقّف التبويب أو قفلته، الرنّة مش مضمونة. الإعدادات بتتحفظ في المتصفح ده.', en: 'Keep the site open to receive alerts. A suspended or closed tab cannot reliably ring. Settings are saved in this browser.' },
} satisfies Record<string, LText>;

export const clockT = (lang: SupportedLanguage) => makeT(lang, CLOCK_TEXT);
export type ClockT = ReturnType<typeof clockT>;
export const CLOCK_DAYS = ['day0', 'day1', 'day2', 'day3', 'day4', 'day5', 'day6'] as const;
const localizedDigits = new Map<SupportedLanguage, string[]>();
const decimalSeparators = new Map<SupportedLanguage, string>();
function clockDigits(lang: SupportedLanguage, native: string): string {
  let digits = localizedDigits.get(lang);
  if (!digits) {
    digits = Array.from({ length: 10 }, (_, n) => formatLocalizedNumber(lang, n, { grouping: false }));
    localizedDigits.set(lang, digits);
  }
  return native.replace(/\d/g, (d) => digits![Number(d)]);
}
export const clockLocale = (lang: SupportedLanguage) => ({ locale: numeralLocaleTag(lang), ...(usesNativeDigits(lang) ? {} : { numberingSystem: 'latn' }) });
const padded = (n: number) => String(n).padStart(2, '0');
export const alarmTimeText = (lang: SupportedLanguage, hour: number, minute: number) => clockDigits(lang, `${padded(hour)}:${padded(minute)}`);
export function durationText(lang: SupportedLanguage, ms: number, stopwatch = false): string {
  const s = stopwatch ? Math.floor(ms / 1000) : Math.ceil(ms / 1000);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor(s / 60) % 60;
  const seconds = s % 60;
  const fraction = Math.floor(ms / 10) % 100;
  // Clock positions stay left-to-right even when the digits themselves are localized.
  let decimal = decimalSeparators.get(lang) ?? '.';
  if (stopwatch && !decimalSeparators.has(lang)) {
    const { locale, numberingSystem } = clockLocale(lang);
    decimal = new Intl.NumberFormat(locale, { numberingSystem }).formatToParts(0.5).find((p) => p.type === 'decimal')?.value ?? '.';
    decimalSeparators.set(lang, decimal);
  }
  return clockDigits(lang, `${!stopwatch || hours ? `${padded(hours)}:` : ''}${padded(minutes)}:${padded(seconds)}${stopwatch ? `${decimal}${padded(fraction)}` : ''}`);
}
