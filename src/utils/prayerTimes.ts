/**
 * Prayer times computed on the visitor's own device from their approximate
 * coordinates: no prayer API is called, so the city never leaves the page.
 *
 * The astronomy is the standard solar-position method used by PrayTimes:
 * declination and equation of time give solar noon, and each prayer is an
 * hour angle before or after it. All results are exact UTC instants, so the
 * display can follow any IANA timezone with Intl.
 */

export type PrayerKey = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

export interface PrayerMethod {
  id: string;
  /** Twilight angle below the horizon used for Fajr. */
  fajrAngle: number;
  /** Isha angle, or a fixed number of minutes after Maghrib. */
  ishaAngle?: number;
  ishaMinutes?: number;
  /** Shadow length used for Asr: 1 is the majority (Shafi'i), 2 the Hanafi school. */
  asrFactor: number;
}

export const PRAYER_METHODS: Record<string, PrayerMethod> = {
  egypt: { id: 'egypt', fajrAngle: 19.5, ishaAngle: 17.5, asrFactor: 1 },
  mwl: { id: 'mwl', fajrAngle: 18, ishaAngle: 17, asrFactor: 1 },
  isna: { id: 'isna', fajrAngle: 15, ishaAngle: 15, asrFactor: 1 },
  karachi: { id: 'karachi', fajrAngle: 18, ishaAngle: 18, asrFactor: 1 },
  dubai: { id: 'dubai', fajrAngle: 18.2, ishaAngle: 18.2, asrFactor: 1 },
  turkey: { id: 'turkey', fajrAngle: 18, ishaAngle: 17, asrFactor: 1 },
  ummAlQura: { id: 'ummAlQura', fajrAngle: 18.5, ishaMinutes: 90, asrFactor: 1 },
};

/** Pick the convention most visitors of that country expect; MWL is the world-wide default. */
export function prayerMethodFor(country: string | undefined): PrayerMethod {
  switch (country?.toUpperCase()) {
    case 'EG': case 'SD': case 'LY': case 'SY': case 'JO': return PRAYER_METHODS.egypt;
    case 'SA': return PRAYER_METHODS.ummAlQura;
    case 'AE': return PRAYER_METHODS.dubai;
    case 'PK': case 'IN': case 'BD': case 'AF': return { ...PRAYER_METHODS.karachi, asrFactor: 2 };
    case 'TR': return PRAYER_METHODS.turkey;
    case 'US': case 'CA': return PRAYER_METHODS.isna;
    default: return PRAYER_METHODS.mwl;
  }
}

export const PRAYER_KEYS: readonly PrayerKey[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const sin = (degrees: number) => Math.sin(degrees * RAD);
const cos = (degrees: number) => Math.cos(degrees * RAD);
const tan = (degrees: number) => Math.tan(degrees * RAD);
const asin = (value: number) => Math.asin(value) * DEG;
const atan2 = (y: number, x: number) => Math.atan2(y, x) * DEG;
const fixAngle = (angle: number) => ((angle % 360) + 360) % 360;
const fixHour = (hour: number) => ((hour % 24) + 24) % 24;

/** Julian day at 0h UT of the given UTC date. */
function julianDay(year: number, month: number, day: number): number {
  let y = year;
  let m = month;
  if (m <= 2) { y -= 1; m += 12; }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5;
}

/** Solar declination (degrees) and equation of time (hours) for a Julian day. */
export function sunPosition(jd: number): { declination: number; equation: number } {
  const d = jd - 2451545.0;
  const g = fixAngle(357.529 + 0.98560028 * d);
  const q = fixAngle(280.459 + 0.98564736 * d);
  const l = fixAngle(q + 1.915 * sin(g) + 0.020 * sin(2 * g));
  const e = 23.439 - 0.00000036 * d;
  const declination = asin(sin(e) * sin(l));
  const rightAscension = fixHour(atan2(cos(e) * sin(l), cos(l)) / 15);
  return { declination, equation: q / 15 - rightAscension };
}

/** Solar noon in UTC hours for a given day and longitude (east positive). */
function solarNoonUTC(jd: number, longitude: number): number {
  return fixHour(12 - sunPosition(jd).equation - longitude / 15);
}

/**
 * Hours from solar noon to the moment the sun sits at `angle` below the horizon
 * (negative values are below). Undefined above the polar circle, where the sun
 * never reaches the angle that day.
 */
function hourAngle(angle: number, jd: number, latitude: number): number | undefined {
  const { declination } = sunPosition(jd);
  const numerator = sin(angle) - sin(latitude) * sin(declination);
  const denominator = cos(latitude) * cos(declination);
  const ratio = numerator / denominator;
  if (!Number.isFinite(ratio) || ratio > 1 || ratio < -1) return undefined;
  return Math.acos(ratio) * DEG / 15;
}

export interface PrayerTimes {
  /** UTC instants, in order: fajr, sunrise, dhuhr, asr, maghrib, isha. */
  times: Record<PrayerKey, number>;
  /** True seconds (ms) of sunrise/sunset so the card can draw the sun's arc. */
  sunset: number;
  /** True above the polar circle, where the sun never sets on that day. */
  estimated: boolean;
  coordinates: { latitude: number; longitude: number };
  method: string;
}

export interface PrayerOptions {
  latitude: number;
  longitude: number;
  /** A Date anywhere inside the wanted day; the day is read in UTC. */
  date: Date;
  method?: PrayerMethod;
}

/**
 * The five prayers plus sunrise for one day. Extra minutes are deliberately
 * small (the classical 1–2 minute precaution) so times stay honest.
 */
export function prayerTimesFor({ latitude, longitude, date, method = PRAYER_METHODS.mwl }: PrayerOptions): PrayerTimes | undefined {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return undefined;
  if (Number.isNaN(date.getTime())) return undefined;
  const jd = julianDay(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const noon = solarNoonUTC(jd, longitude);

  // Refine with the solar position at each prayer's approximate moment.
  const at = (hoursFromNoon: number, estimate: number) => solarNoonUTC(jd + estimate / 24, longitude) + hoursFromNoon;
  const noonRefined = at(0, noon);
  const riseOffset = hourAngle(-0.833, jd + (noonRefined - 6) / 24, latitude);
  const setOffset = hourAngle(-0.833, jd + (noonRefined + 6) / 24, latitude);
  const fajrOffset = hourAngle(-method.fajrAngle, jd + (noonRefined - 6) / 24, latitude);
  // Asr: the sun's altitude when the shadow reaches `asrFactor` times the object.
  const asrAngle = Math.atan(1 / (method.asrFactor + tan(Math.abs(latitude - sunPosition(jd).declination)))) * DEG;
  const asrOffset = hourAngle(asrAngle, jd + (noonRefined + 3) / 24, latitude);
  const ishaOffset = method.ishaAngle === undefined ? undefined : hourAngle(-method.ishaAngle, jd + (noonRefined + 6) / 24, latitude);

  // Above the polar circle a prayer can have no astronomical moment. Fall back
  // to one seventh of the night, the usual high-latitude precaution.
  const polar = riseOffset === undefined || setOffset === undefined;
  const nightHours = polar ? 8 : 24 - (riseOffset! + setOffset!);
  const sunriseHours = riseOffset ?? 6;
  const sunsetHours = setOffset ?? 6;
  const fallbackNight = Math.max(1, nightHours);
  const fajrHours = fajrOffset ?? sunriseHours - fallbackNight / 7;
  const ishaHours = method.ishaMinutes !== undefined
    ? sunsetHours + method.ishaMinutes / 60
    : (ishaOffset ?? sunsetHours + fallbackNight / 7);

  const toEpoch = (hours: number) => {
    if (!Number.isFinite(hours)) return undefined;
    return start + Math.round(fixHour(hours) * 3_600_000);
  };
  const fajr = toEpoch(noonRefined - fajrHours);
  const sunrise = toEpoch(noonRefined - sunriseHours);
  const dhuhr = toEpoch(noonRefined);
  const asr = toEpoch(noonRefined + (asrOffset ?? 3));
  const maghrib = toEpoch(noonRefined + sunsetHours);
  const isha = toEpoch(noonRefined + ishaHours);
  if ([fajr, sunrise, dhuhr, asr, maghrib, isha].some((value) => value === undefined)) return undefined;

  return {
    times: { fajr: fajr!, sunrise: sunrise!, dhuhr: dhuhr!, asr: asr!, maghrib: maghrib!, isha: isha! },
    sunset: maghrib!,
    estimated: polar,
    coordinates: { latitude, longitude },
    method: method.id,
  };
}

export interface NextPrayer {
  key: PrayerKey;
  /** The instant of the upcoming prayer. */
  at: number;
  remainingMs: number;
}

/**
 * The next prayer after `now`. After Isha the answer is tomorrow's Fajr, so the
 * countdown never runs out.
 */
export function nextPrayer(times: PrayerTimes, now: number): NextPrayer | undefined {
  if (!Number.isFinite(now)) return undefined;
  const ordered = PRAYER_KEYS.filter((key) => key !== 'sunrise').map((key) => ({ key, at: times.times[key] }));
  const upcoming = ordered.find((prayer) => prayer.at > now);
  if (upcoming) return { ...upcoming, remainingMs: upcoming.at - now };
  const tomorrow = prayerTimesFor({ ...times.coordinates, date: new Date(times.times.fajr + 24 * 3_600_000), method: PRAYER_METHODS[times.method] });
  if (!tomorrow) return undefined;
  return { key: 'fajr', at: tomorrow.times.fajr, remainingMs: tomorrow.times.fajr - now };
}

/** "1 س 20 د" style remaining time; the labels come from the caller. */
export function splitRemaining(remainingMs: number): { hours: number; minutes: number } {
  const total = Math.max(0, Math.round(remainingMs / 60_000));
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

/** 0 at sunrise, 1 at sunset, and outside that range the clamped edges. */
export function sunProgress(times: PrayerTimes, now: number): number {
  const span = times.times.maghrib - times.times.sunrise;
  if (!(span > 0)) return 0;
  return Math.max(0, Math.min(1, (now - times.times.sunrise) / span));
}

export function isDaylight(times: PrayerTimes, now: number): boolean {
  return now >= times.times.sunrise && now < times.times.maghrib;
}

/** Local clock text for a prayer in the visitor's timezone. */
export function formatPrayerTime(epoch: number, timeZone: string, locale: string, numberingSystem?: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone,
      ...(numberingSystem ? { numberingSystem } : {}),
    }).format(new Date(epoch));
  } catch {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' }).format(new Date(epoch));
  }
}
