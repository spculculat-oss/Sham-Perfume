import { CalculationMethod, Coordinates, HighLatitudeRule, Madhab, PrayerTimes } from 'adhan';
import { PRAYER_NAMES, REMINDER_PRAYERS, type AsrRule, type PrayerMethod, type PrayerName, type PrayerPlace, type ReminderPrayer } from './prayerConfig';

const METHODS_BY_COUNTRY: Readonly<Record<string, PrayerMethod>> = {
  EG: 'Egyptian', SA: 'UmmAlQura', AE: 'Dubai', QA: 'Qatar', KW: 'Kuwait', TR: 'Turkey', IR: 'Tehran',
  PK: 'Karachi', IN: 'Karachi', BD: 'Karachi', AF: 'Karachi', SG: 'Singapore',
  US: 'NorthAmerica', CA: 'NorthAmerica', GB: 'MoonsightingCommittee',
};
const HANAFI_COUNTRIES = new Set(['AF', 'BD', 'IN', 'PK', 'TR']);
export const methodForCountry = (country: string): PrayerMethod => METHODS_BY_COUNTRY[country] ?? 'MuslimWorldLeague';
export const asrForCountry = (country: string): Exclude<AsrRule, 'auto'> => HANAFI_COUNTRIES.has(country) ? 'hanafi' : 'standard';

const DAY = 86_400_000;
const civilFormatters = new Map<string, Intl.DateTimeFormat>();
const utcDay = (key: string) => Date.parse(`${key}T00:00:00Z`);

/** Civil date at the chosen city, not at the device, hosting server, or UTC. */
export function prayerDayKey(timeZone: string, at: number): string | undefined {
  if (!Number.isFinite(at)) return undefined;
  try {
    let formatter = civilFormatters.get(timeZone);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat('en-CA-u-ca-gregory-nu-latn', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
      if (civilFormatters.size >= 64) civilFormatters.clear();
      civilFormatters.set(timeZone, formatter);
    }
    const parts = formatter.formatToParts(at);
    return ['year', 'month', 'day'].map((part) => parts.find((item) => item.type === part)?.value).join('-');
  } catch { return undefined; }
}

export function shiftPrayerDay(day: string, days: number): string {
  return new Date(utcDay(day) + days * DAY).toISOString().slice(0, 10);
}

function ummAlQuraRamadan(day: string): boolean {
  // The prayer-day table is civil; Isha is after sunset, when the next Hijri
  // day starts. Use the calculated Umm al-Qura calendar, not a moon-sighting claim.
  try {
    const calendar = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { timeZone: 'UTC', month: 'numeric' });
    return calendar.resolvedOptions().calendar === 'islamic-umalqura'
      && calendar.formatToParts(utcDay(day) + DAY).find((p) => p.type === 'month')?.value === '9';
  } catch { return false; }
}

export interface PrayerEvent { prayer: ReminderPrayer; at: number; day: string }
export interface PrayerDay {
  key: string;
  times: Readonly<Record<PrayerName, number | undefined>>;
  reliable: boolean;
  events: readonly PrayerEvent[];
}

export function calculatePrayerDay(place: PrayerPlace, key: string, method: PrayerMethod, asr: Exclude<AsrRule, 'auto'>): PrayerDay | undefined {
  const day = utcDay(key);
  if (!Number.isFinite(day) || !Number.isFinite(place.lat) || Math.abs(place.lat) >= 90
    || !Number.isFinite(place.lon) || Math.abs(place.lon) > 180 || !prayerDayKey(place.timeZone, day)) return undefined;
  const params = CalculationMethod[method]();
  params.madhab = asr === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  params.highLatitudeRule = Math.abs(place.lat) > 48 ? HighLatitudeRule.SeventhOfTheNight : HighLatitudeRule.MiddleOfTheNight;
  if (method === 'UmmAlQura' && ummAlQuraRamadan(key)) params.ishaInterval = 120;
  const coordinates = new Coordinates(place.lat, place.lon);
  const forSolarDay = (epoch: number) => {
    // Adhan reads getFullYear/Month/Date, then returns UTC instants. Noon avoids
    // a local midnight DST jump even when the device is in a different zone.
    const d = new Date(epoch);
    return new PrayerTimes(coordinates, new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12), params);
  };
  let times = forSolarDay(day);
  const solarDay = prayerDayKey(place.timeZone, times.dhuhr.getTime());
  // Across the date line (e.g. Kiritimati) the sun's longitude date and the
  // legal civil date can differ by one day. Match the city's date of solar noon.
  if (solarDay && solarDay !== key) {
    const delta = day - utcDay(solarDay);
    if (Math.abs(delta) === DAY) times = forSolarDay(day + delta);
  }
  if (prayerDayKey(place.timeZone, times.dhuhr.getTime()) !== key) return undefined;
  const at = Object.fromEntries(PRAYER_NAMES.map((name) => {
    const ms = times[name].getTime();
    return [name, Number.isFinite(ms) ? ms : undefined];
  })) as Record<PrayerName, number | undefined>;
  // Do not claim precise alerts on a polar day with no valid sunrise/sunset, or
  // if estimated twilight crosses another event. Partial display is still useful.
  const reliable = PRAYER_NAMES.every((name, i) => at[name] !== undefined && (i === 0 || at[name]! > at[PRAYER_NAMES[i - 1]]!));
  return { key, times: at, reliable, events: reliable ? REMINDER_PRAYERS.map((prayer) => ({ prayer, at: at[prayer]!, day: key })) : [] };
}

/** Include adjacent solar days: at very late sunsets an Isha can fall after civil midnight.
 * A fixed-interval method can also overlap the next dawn in a very short night; do not ring an ambiguous day. */
export function calculatePrayerCalendar(place: PrayerPlace, key: string, method: PrayerMethod, asr: Exclude<AsrRule, 'auto'>) {
  const [previous, today, next] = [-1, 0, 1].map((i) => calculatePrayerDay(place, shiftPrayerDay(key, i), method, asr));
  const rejected = new Set<string>();
  for (const [left, right] of [[previous, today], [today, next]] as const) {
    if (left?.reliable && right?.reliable && left.times.isha! >= right.times.fajr!) {
      rejected.add(left.key);
      rejected.add(right.key);
    }
  }
  const events = [previous, today, next].flatMap((day) => day && !rejected.has(day.key) ? day.events : []).sort((a, b) => a.at - b.at);
  return { today: today && rejected.has(today.key) ? { ...today, events: [], reliable: false } : today, events };
}

/** Decorative progress between the same sunrise and sunset shown on the clock. */
export function prayerSunArc(times: PrayerDay['times'], at: number) {
  const start = times.sunrise;
  const end = times.maghrib;
  if (start === undefined || end === undefined || end <= start || !Number.isFinite(at)) return undefined;
  return { progress: Math.max(0, Math.min(1, (at - start) / (end - start))), daylight: start <= at && at < end };
}

export function splitPrayerRemaining(ms: number) {
  const total = Math.max(0, Math.round(ms / 60_000));
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

export const PRAYER_REMINDER_GRACE_MS = 60_000;
export function duePrayer(events: readonly PrayerEvent[], selected: readonly ReminderPrayer[], after: number, now: number): PrayerEvent | undefined {
  if (!Number.isFinite(after) || !Number.isFinite(now) || after >= now) return undefined;
  return [...events].reverse().find((event) => selected.includes(event.prayer) && event.at > after && event.at <= now && now - event.at <= PRAYER_REMINDER_GRACE_MS);
}
