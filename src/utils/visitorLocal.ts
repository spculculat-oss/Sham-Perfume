import { LOCALE_MAP, loc, type LText } from '../لغات/localize';
import type { SupportedLanguage } from '../types/i18n';
import { resolveDeviceLocation, resolveVisitorEntryLocation, type GeoPrecision, type ResolvedEntryLocation } from '../data/worldEntryGazetteer';
import { apiUrl, isStaticHosting } from './api';
import { isCountry } from './pricing';

export interface VisitorEntryLocation extends ResolvedEntryLocation {
  timezone?: string;
}

export interface CurrentWeather {
  temperatureC: number;
  weatherCode: number;
  observedAt?: string;
}

const PRECISIONS = new Set<GeoPrecision>(['edge-coords', 'edge-city', 'device-gps', 'timezone', 'country']);

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function browserTimeZone(): string | undefined {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimeZone(zone) ? zone : undefined;
  } catch {
    return undefined;
  }
}

/** A timezone may identify the country and local clock, but it is never treated as a city. */
export function browserVisitorCountry(
  timezone = browserTimeZone(),
  languages: readonly string[] = typeof navigator === 'undefined' ? [] : (navigator.languages || [navigator.language]),
): string | undefined {
  if (isValidTimeZone(timezone)) {
    const byTimezone = resolveVisitorEntryLocation({ timezone });
    if (byTimezone.country !== 'UN' && isCountry(byTimezone.country)) return byTimezone.country;
  }

  // A language-region such as ar-EG can identify the country, not the visitor's city.
  return languages
    .flatMap((tag) => (typeof tag === 'string' ? tag.split(/[-_]/).slice(1) : []))
    .map((part) => part.toUpperCase())
    .find((part) => isCountry(part));
}

/** Requests precise device coordinates only after the visitor acts or has already granted permission. */
export async function locateVisitorDevice(): Promise<VisitorEntryLocation> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) throw new Error('GEOLOCATION_UNSUPPORTED');
  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => reject(new Error(error.code === 1 ? 'GEOLOCATION_DENIED' : error.code === 3 ? 'GEOLOCATION_TIMEOUT' : 'GEOLOCATION_UNAVAILABLE')),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 120_000 },
    );
  });
  const location = resolveDeviceLocation(position.coords.latitude, position.coords.longitude, position.coords.accuracy);
  const timezone = browserTimeZone();
  return { ...location, ...(timezone ? { timezone } : {}) };
}

export function readVisitorLocation(value: unknown): VisitorEntryLocation | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  const country = typeof raw.country === 'string' ? raw.country.toUpperCase() : '';
  const precision = typeof raw.precision === 'string' && PRECISIONS.has(raw.precision as GeoPrecision)
    ? raw.precision as GeoPrecision
    : undefined;
  const lat = Number(raw.lat);
  const lon = Number(raw.lon);
  const rawCityAr = typeof raw.cityAr === 'string' ? raw.cityAr.trim().slice(0, 100) : '';
  const rawCityEn = typeof raw.cityEn === 'string' ? raw.cityEn.trim().slice(0, 100) : '';
  const cityAr = precision === 'timezone' ? rawCityAr.replace(/\s+\(نطاق التوقيت\)$/, '') : rawCityAr;
  const cityEn = precision === 'timezone' ? rawCityEn.replace(/\s+\(TZ zone\)$/, '') : rawCityEn;
  if ((!isCountry(country) && country !== 'UN') || !precision || !cityAr || !cityEn || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return undefined;
  }
  const placeId = typeof raw.placeId === 'string' && raw.placeId.length < 100
    ? raw.placeId
    : `${country}:${Math.round(lat * 100)}_${Math.round(lon * 100)}`;
  return {
    placeId,
    country,
    cityAr,
    cityEn,
    ...(typeof raw.regionAr === 'string' ? { regionAr: raw.regionAr.slice(0, 100) } : {}),
    ...(typeof raw.regionEn === 'string' ? { regionEn: raw.regionEn.slice(0, 100) } : {}),
    lat,
    lon,
    precision,
    ...(isValidTimeZone(raw.timezone) ? { timezone: raw.timezone } : {}),
  };
}

export function readVisitorGeo(value: unknown): { country?: string; timezone?: string; location?: VisitorEntryLocation } {
  if (!value || typeof value !== 'object') return {};
  const raw = value as Record<string, unknown>;
  const country = typeof raw.country === 'string' && isCountry(raw.country.toUpperCase()) ? raw.country.toUpperCase() : undefined;
  const timezone = isValidTimeZone(raw.timezone) ? raw.timezone : undefined;
  const location = readVisitorLocation(raw.location);
  return { ...(country ? { country } : {}), ...(timezone ? { timezone } : {}), ...(location ? { location } : {}) };
}

/** Accepts either our compact API reply or Open-Meteo's documented `current` object. */
export function readCurrentWeather(value: unknown): CurrentWeather | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  const current = raw.current && typeof raw.current === 'object' ? raw.current as Record<string, unknown> : raw;
  const rawTemperature = raw.temperatureC ?? current.temperature_2m;
  const rawCode = raw.weatherCode ?? current.weather_code;
  const temperatureC = typeof rawTemperature === 'number' ? rawTemperature : typeof rawTemperature === 'string' && rawTemperature.trim() ? Number(rawTemperature) : Number.NaN;
  const weatherCode = typeof rawCode === 'number' ? rawCode : typeof rawCode === 'string' && rawCode.trim() ? Number(rawCode) : Number.NaN;
  if (!Number.isFinite(temperatureC) || temperatureC < -100 || temperatureC > 70 || !Number.isInteger(weatherCode) || weatherCode < 0 || weatherCode > 99) return undefined;
  const observedAt = typeof raw.observedAt === 'string' ? raw.observedAt.slice(0, 40) : typeof current.time === 'string' ? current.time.slice(0, 40) : undefined;
  return { temperatureC, weatherCode, ...(observedAt ? { observedAt } : {}) };
}

export function visitorLocale(language: SupportedLanguage, country?: string): string {
  const base = LOCALE_MAP[language] || 'en-GB';
  if (!country || !isCountry(country)) return base;
  const parts = base.split('-');
  const candidate = `${parts[0]}${parts.length === 3 ? `-${parts[1]}` : ''}-${country}`;
  try {
    new Intl.DateTimeFormat(candidate).format(0);
    return candidate;
  } catch {
    return base;
  }
}

export function temperatureForVisitor(temperatureC: number, country?: string): { value: number; unit: '°C' | '°F' } {
  return country === 'US'
    ? { value: (temperatureC * 9) / 5 + 32, unit: '°F' }
    : { value: temperatureC, unit: '°C' };
}

export type WeatherKind = 'clear' | 'partly' | 'cloud' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm';

export function weatherKind(code: number): WeatherKind {
  if (code === 0) return 'clear';
  if (code === 1 || code === 2) return 'partly';
  if (code === 3) return 'cloud';
  if (code === 45 || code === 48) return 'fog';
  if ([51, 53, 55, 56, 57].includes(code)) return 'drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([95, 96, 99].includes(code)) return 'storm';
  return 'cloud';
}

const WEATHER_TEXT: Record<WeatherKind, LText> = {
  clear: { ar: 'سماء صافية', en: 'Clear sky' },
  partly: { ar: 'غائم جزئيًا', en: 'Partly cloudy' },
  cloud: { ar: 'غائم', en: 'Cloudy' },
  fog: { ar: 'ضباب', en: 'Fog' },
  drizzle: { ar: 'رذاذ', en: 'Drizzle' },
  rain: { ar: 'ممطر', en: 'Rain' },
  snow: { ar: 'ثلوج', en: 'Snow' },
  storm: { ar: 'عاصفة رعدية', en: 'Thunderstorm' },
};

export function weatherDescription(code: number, language: SupportedLanguage): string {
  return loc(language, WEATHER_TEXT[weatherKind(code)]);
}

/** City-only coordinates are rounded again before being sent to the weather service. */
export async function fetchVisitorWeather(location: VisitorEntryLocation): Promise<CurrentWeather> {
  if (location.precision === 'country' || location.precision === 'timezone') throw new Error('City-level location is not available.');
  const latitude = Math.round(location.lat * 100) / 100;
  const longitude = Math.round(location.lon * 100) / 100;
  const query = new URLSearchParams({ latitude: latitude.toFixed(2), longitude: longitude.toFixed(2) });

  if (!isStaticHosting) {
    try {
      const response = await fetch(apiUrl(`/api/weather?${query.toString()}`), { cache: 'no-store', signal: AbortSignal.timeout(6500) });
      if (!response.ok) throw new Error(`Weather API returned ${response.status}.`);
      const weather = readCurrentWeather(await response.json());
      if (!weather) throw new Error('Weather response was invalid.');
      return weather;
    } catch {
      // A static Pages deployment can still show weather if its API server is temporarily unavailable.
    }
  }

  const providerQuery = new URLSearchParams({
    latitude: latitude.toFixed(2),
    longitude: longitude.toFixed(2),
    current: 'temperature_2m,weather_code',
    timezone: 'auto',
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${providerQuery.toString()}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(6500),
  });
  if (!response.ok) throw new Error(`Weather provider returned ${response.status}.`);
  const weather = readCurrentWeather(await response.json());
  if (!weather) throw new Error('Weather provider response was invalid.');
  return weather;
}
