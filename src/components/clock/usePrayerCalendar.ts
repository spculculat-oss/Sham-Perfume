import { useMemo } from 'react';
import cityData from '../../data/prayerCities.tsv?raw';
import type { PrayerPreferences } from '../../utils/prayerConfig';
import { automaticPrayerPlace, parsePrayerCities, type PrayerGeo, type ResolvedPrayerPlace } from '../../utils/prayerPlaces';
import { asrForCountry, calculatePrayerCalendar, methodForCountry, prayerDayKey, type PrayerEvent } from '../../utils/prayerTimes';

export const PRAYER_CITIES = parsePrayerCities(cityData);
const citiesById = new Map(PRAYER_CITIES.map((city) => [city.key, city]));
export const isPrayerCity = (key: string) => citiesById.has(key);
const EMPTY_CALENDAR = { today: undefined, events: [] as readonly PrayerEvent[] };

export interface PrayerCalendarSettings {
  prefs: PrayerPreferences;
  geo?: PrayerGeo;
  browserZone?: string;
  gps?: ResolvedPrayerPlace;
}

/** One source for the Home sun arc, compact chip, settings and reminders. */
export function usePrayerCalendar({ prefs, geo, browserZone, gps }: PrayerCalendarSettings, now?: number) {
  const manual = prefs.cityKey ? citiesById.get(prefs.cityKey) : undefined;
  const resolved = useMemo<ResolvedPrayerPlace | undefined>(() => manual ? { place: manual, source: 'manual' }
    : gps ?? automaticPrayerPlace(PRAYER_CITIES, geo, browserZone), [manual, gps, geo, browserZone]);
  const place = resolved?.place;
  const country = place?.country || geo?.country || '';
  const method = prefs.method === 'auto' ? methodForCountry(country) : prefs.method;
  const asr = prefs.asr === 'auto' ? asrForCountry(country) : prefs.asr;
  const day = place && now !== undefined ? prayerDayKey(place.timeZone, now) : undefined;
  const { today, events } = useMemo(() => place && day ? calculatePrayerCalendar(place, day, method, asr)
    : EMPTY_CALENDAR, [place, day, method, asr]);
  const upcoming = today?.reliable && now !== undefined ? events.find((event) => event.at > now) : undefined;
  return { resolved, place, method, asr, today, events, upcoming };
}
