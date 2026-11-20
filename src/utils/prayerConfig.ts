export const PRAYER_NAMES = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export const REMINDER_PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type PrayerName = typeof PRAYER_NAMES[number];
export type ReminderPrayer = typeof REMINDER_PRAYERS[number];
export const METHODS = ['Egyptian', 'UmmAlQura', 'Dubai', 'Qatar', 'Kuwait', 'Karachi', 'Turkey', 'Singapore', 'Tehran', 'NorthAmerica', 'MoonsightingCommittee', 'MuslimWorldLeague'] as const;
export type PrayerMethod = typeof METHODS[number];
export type AsrRule = 'auto' | 'standard' | 'hanafi';
export type ReminderMode = 'off' | 'visual' | 'audio';
export const ADHAN_VOICE_IDS = ['ahmed-khalaf', 'aaqib-azeez', 'besim-azemi-fajr'] as const;
export type AdhanVoiceId = typeof ADHAN_VOICE_IDS[number];
export type VoiceChoice = AdhanVoiceId | 'device-file';

export interface PrayerPlace {
  key: string;
  country: string;
  cityAr: string;
  cityEn: string;
  lat: number;
  lon: number;
  timeZone: string;
}

export interface PrayerPreferences {
  hidden: boolean;
  cityKey: string | null;
  method: PrayerMethod | 'auto';
  asr: AsrRule;
  prayers: ReminderPrayer[];
  regularVoice: typeof ADHAN_VOICE_IDS[0 | 1];
  fajrVoice: typeof ADHAN_VOICE_IDS[0 | 2];
}

export const PRAYER_PREFS_KEY = 'sham_prayer_preferences_v1';
export const PRAYER_CLAIM_KEY = 'sham_prayer_notice_v1';
export const PRAYER_CLEARED = 'sham-prayer-preferences-cleared';
export const defaultPrayerPreferences = (): PrayerPreferences => ({
  hidden: false, cityKey: null, method: 'auto', asr: 'auto', prayers: [...REMINDER_PRAYERS],
  regularVoice: 'ahmed-khalaf', fajrVoice: 'ahmed-khalaf',
});

/** No opt-in, GPS fix, imported file, or event history in saved preferences. */
export function decodePrayerPreferences(raw: string | null): PrayerPreferences {
  const defaults = defaultPrayerPreferences();
  if (!raw || raw.length > 2000) return defaults;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return defaults;
    const value = parsed as Record<string, unknown>;
    const prayers = value.prayers;
    return {
      hidden: value.hidden === true,
      cityKey: typeof value.cityKey === 'string' && /^(?:gn:[0-9]{1,10}|city:[a-z0-9_:-]{1,80})$/.test(value.cityKey) ? value.cityKey : null,
      method: METHODS.find((method) => method === value.method) ?? 'auto',
      asr: value.asr === 'standard' || value.asr === 'hanafi' ? value.asr : 'auto',
      prayers: Array.isArray(prayers) ? REMINDER_PRAYERS.filter((p) => prayers.includes(p)) : defaults.prayers,
      regularVoice: value.regularVoice === 'aaqib-azeez' ? 'aaqib-azeez' : defaults.regularVoice,
      fajrVoice: value.fajrVoice === 'besim-azemi-fajr' ? 'besim-azemi-fajr' : defaults.fajrVoice,
    };
  } catch { return defaults; }
}

/** Vite's base includes /Sham-Perfume/ on Pages; all media stays same origin. */
export const prayerAssetUrl = (path: string): string => `${import.meta.env?.BASE_URL || '/'}${path}`;
