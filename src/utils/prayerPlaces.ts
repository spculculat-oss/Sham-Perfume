import tzLookup from '@photostructure/tz-lookup';
import { WORLD_CITIES } from '../data/worldEntryGazetteer';
import type { VisitorEntryLocation } from './visitorLocal';
import type { PrayerPlace } from './prayerConfig';

export interface PrayerGeo { country?: string; timezone?: string; location?: VisitorEntryLocation }
export interface ResolvedPrayerPlace { place: PrayerPlace; source: 'network' | 'timezone' | 'country' | 'manual' | 'gps' }
const zoneCache = new Map<string, string | undefined>();
function canonicalZone(zone?: string): string | undefined {
  if (!zone || zone.length > 80 || /^[+-]/.test(zone)) return undefined;
  if (!zoneCache.has(zone)) {
    if (zoneCache.size > 500) zoneCache.clear();
    try { zoneCache.set(zone, new Intl.DateTimeFormat('en', { timeZone: zone }).resolvedOptions().timeZone); }
    catch { zoneCache.set(zone, undefined); }
  }
  return zoneCache.get(zone);
}

function zoneAt(lat: number, lon: number): string | undefined {
  try {
    const zone = tzLookup(lat, lon);
    return canonicalZone(zone) ? zone : undefined;
  } catch { return undefined; }
}

export function prayerSearchKey(text: string): string {
  return text.normalize('NFKD').replace(/\p{Mark}|ـ/gu, '').toLowerCase().replace(/ٱ/g, 'ا').replace(/[ىی]/g, 'ي').replace(/ة/g, 'ه').replace(/[^\p{Letter}\p{Number}]+/gu, ' ').trim();
}

// Score proportional to great-circle distance, including across the date line.
const rad = Math.PI / 180;
function distanceScore(place: PrayerPlace, lat: number, lon: number): number {
  return Math.sin((place.lat - lat) * rad / 2) ** 2 + Math.cos(lat * rad) * Math.cos(place.lat * rad) * Math.sin((place.lon - lon) * rad / 2) ** 2;
}

/** Compact population-sorted catalog: GeoNames/Natural Earth with our existing bilingual cities for extra coverage. */
export function parsePrayerCities(text: string): PrayerPlace[] {
  const data = text.split('\n').flatMap((line) => {
    if (!line || line.startsWith('#')) return [];
    const [id, cityEn, cityAr, country, y, x, timeZone] = line.trimEnd().split('\t');
    const lat = Number(y), lon = Number(x);
    if (!id || !/^\d+$/.test(id) || !cityEn || !/^[A-Z]{2}$/.test(country || '') || !y || !x
      || !Number.isFinite(lat) || Math.abs(lat) >= 90 || !Number.isFinite(lon) || Math.abs(lon) > 180 || !canonicalZone(timeZone)) return [];
    return [{ key: `gn:${id}`, cityEn, cityAr: cityAr || cityEn, country, lat, lon, timeZone }];
  });
  const curated = WORLD_CITIES.flatMap((city) => {
    // Prefer the IANA zone from the underlying gazetteer for colocated cities.
    const peer = data.find((p) => p.country === city.country && (p.cityEn.toLowerCase() === city.cityEn.toLowerCase()
      || Math.hypot(p.lat - city.lat, p.lon - city.lon) < 0.025));
    const timeZone = peer?.timeZone ?? zoneAt(city.lat, city.lon);
    return timeZone ? [{ ...city, timeZone, key: `city:${city.key}` }] : [];
  });
  return [
    ...curated,
    ...data.filter((p) => !curated.some((c) => c.country === p.country && (p.cityEn.toLowerCase() === c.cityEn.toLowerCase()
      || Math.hypot(p.lat - c.lat, p.lon - c.lon) < 0.025))),
    { key: 'city:kiritimati', country: 'KI', cityAr: 'كيريتيماتي', cityEn: 'Kiritimati', lat: 1.985, lon: -157.477, timeZone: 'Pacific/Kiritimati' },
  ];
}

function citiesInZone(cities: readonly PrayerPlace[], zone?: string, country?: string): PrayerPlace[] {
  const canonical = canonicalZone(zone);
  if (!canonical || /^(UTC|GMT|Etc\/)/i.test(canonical)) return [];
  const pool = country ? cities.filter((p) => p.country === country) : cities;
  const same = pool.filter((p) => p.timeZone === zone);
  return same.length ? same : pool.filter((p) => canonicalZone(p.timeZone) === canonical);
}

/** Use actual edge coords or a known named city. Never use the gazetteer's placeholder
 * Egypt coords for an unknown foreign city, or present a zone's hub as detected. */
export function automaticPrayerPlace(cities: readonly PrayerPlace[], geo: PrayerGeo | undefined, browserZone?: string): ResolvedPrayerPlace | undefined {
  const location = geo?.location;
  const country = geo?.country ?? (location?.country === 'UN' ? undefined : location?.country);
  const pool = country ? cities.filter((p) => p.country === country) : cities;
  if (location && location.country === country && (location.precision === 'edge-city' || location.precision === 'edge-coords')) {
    const cityId = `city:${location.placeId.split(':')[1]}`;
    const city = pool.find((p) => p.key === cityId) ?? pool.find((p) => prayerSearchKey(p.cityEn) === prayerSearchKey(location.cityEn)
      || prayerSearchKey(p.cityAr) === prayerSearchKey(location.cityAr));
    if (location.precision === 'edge-coords' && Number.isFinite(location.lat) && Math.abs(location.lat) < 90
      && Number.isFinite(location.lon) && Math.abs(location.lon) <= 180) {
      const preferred = location.timezone || geo?.timezone;
      const timeZone = preferred?.includes('/') && !preferred.startsWith('Etc/') && canonicalZone(preferred) ? preferred : zoneAt(location.lat, location.lon);
      if (timeZone) return { source: 'network', place: { ...location, key: `edge:${location.placeId}`, timeZone } };
    }
    if (city) return { source: 'network', place: city };
  }
  const suggested = citiesInZone(cities, geo?.timezone, country)[0] ?? citiesInZone(cities, browserZone, country)[0];
  if (suggested) return { source: 'timezone', place: suggested };
  return country && pool.length ? { source: 'country', place: pool[0] } : undefined;
}

/** One user-initiated fix. The selected coords live only in this page's memory. */
export function gpsPrayerPlace(cities: readonly PrayerPlace[], coords: Pick<GeolocationCoordinates, 'latitude' | 'longitude' | 'accuracy'>): ResolvedPrayerPlace | undefined {
  const { latitude: lat, longitude: lon, accuracy } = coords;
  if (!Number.isFinite(lat) || Math.abs(lat) >= 90 || !Number.isFinite(lon) || Math.abs(lon) > 180
    || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 15_000) return undefined;
  const timeZone = zoneAt(lat, lon);
  if (!timeZone) return undefined;
  const peers = citiesInZone(cities, timeZone);
  const nearest = peers.reduce<PrayerPlace | undefined>((best, p) => !best || distanceScore(p, lat, lon) < distanceScore(best, lat, lon) ? p : best, undefined);
  // A timezone may span multiple countries or may not have a representative city.
  const country = nearest ? nearest.country : 'UN';
  return { source: 'gps', place: { key: 'gps', country, cityAr: 'موقع الجهاز', cityEn: 'Device location', lat, lon, timeZone } };
}

export const placeIsConfirmed = (value?: ResolvedPrayerPlace): boolean => Boolean(value && ['network', 'gps', 'manual'].includes(value.source));
