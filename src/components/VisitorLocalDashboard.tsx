import { useEffect, useState } from 'react';
import {
  CalendarDays,
  Clock3,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  MapPin,
  Sun,
  Thermometer,
  type LucideIcon,
} from 'lucide-react';
import { LOCALE_MAP, makeT, type LText } from '../لغات/localize';
import type { SupportedLanguage } from '../types/i18n';
import {
  browserTimeZone,
  browserVisitorLocation,
  fetchVisitorWeather,
  readVisitorGeo,
  temperatureForVisitor,
  visitorLocale,
  weatherDescription,
  weatherKind,
  type CurrentWeather,
  type VisitorEntryLocation,
  type WeatherKind,
} from '../utils/visitorLocal';
import { apiUrl, isStaticHosting } from '../utils/api';

const TEXT = {
  local_info: { ar: 'معلوماتك المحلية', en: 'Your local details' },
  local_date: { ar: 'التاريخ المحلي', en: 'Local date' },
  local_time: { ar: 'الوقت المحلي', en: 'Local time' },
  current_weather: { ar: 'الطقس الحالي', en: 'Current weather' },
  loading_weather: { ar: 'جاري جلب الطقس…', en: 'Loading current weather…' },
  weather_unavailable: { ar: 'الطقس غير متاح حاليًا', en: 'Weather is temporarily unavailable' },
  location_unavailable: { ar: 'تعذّر تحديد المدينة', en: 'City is not available' },
  approximate_location: { ar: 'مدينة تقريبية حسب المنطقة الزمنية لجهازك', en: 'Approximate city from your device time zone' },
  entry_location: { ar: 'حسب مدينة دخولك', en: 'Based on your entry city' },
  device_time: { ar: 'توقيت جهازك المحلي', en: 'Your device local time' },
  powered_by: { ar: 'بيانات الطقس من', en: 'Weather data by' },
} satisfies Record<string, LText>;

const WEATHER_ICONS: Record<WeatherKind, LucideIcon> = {
  clear: Sun,
  partly: CloudSun,
  cloud: Cloud,
  fog: CloudFog,
  drizzle: CloudRain,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
};

function countryName(country: string | undefined, locale: string): string {
  if (!country) return '';
  try { return new Intl.DisplayNames([locale], { type: 'region' }).of(country) || country; } catch { return country; }
}

function timezoneName(timezone: string | undefined, locale: string, now: Date): string | undefined {
  if (!timezone) return undefined;
  try {
    return new Intl.DateTimeFormat(locale, { timeZone: timezone, timeZoneName: 'short' })
      .formatToParts(now)
      .find((part) => part.type === 'timeZoneName')?.value;
  } catch { return undefined; }
}

export function VisitorLocalDashboard({ currentLang }: { currentLang: SupportedLanguage }) {
  const [now, setNow] = useState(() => new Date());
  const [place, setPlace] = useState<VisitorEntryLocation | undefined>(() => browserVisitorLocation());
  const [entryCountry, setEntryCountry] = useState<string | undefined>(() => place?.country);
  const [timeZone, setTimeZone] = useState<string | undefined>(() => place?.timezone || browserTimeZone());
  const [weather, setWeather] = useState<CurrentWeather | undefined>();
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState(false);
  const label = makeT(currentLang, TEXT);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let live = true;
    let running = false;
    const refresh = async () => {
      if (running) return;
      running = true;
      if (live) setWeatherLoading(true);
      try {
        let nextPlace = browserVisitorLocation();
        let nextCountry = nextPlace?.country;
        let nextTimeZone = browserTimeZone();

        if (!isStaticHosting) {
          try {
            const response = await fetch(apiUrl('/api/geo'), { cache: 'no-store', signal: AbortSignal.timeout(4500) });
            if (response.ok) {
              const geo = readVisitorGeo(await response.json());
              if (geo.country) nextCountry = geo.country;
              if (geo.location) {
                if (geo.location.timezone) nextTimeZone = geo.location.timezone;
                if (geo.location.precision !== 'country') {
                  nextPlace = geo.location;
                } else if (geo.location.timezone) {
                  const timezonePlace = browserVisitorLocation(geo.location.timezone, geo.country ? [`${currentLang}-${geo.country}`] : undefined);
                  if (timezonePlace) nextPlace = timezonePlace;
                }
              }
            }
          } catch {
            // Keep the browser's local time-zone/city fallback when the edge lookup is unavailable.
          }
        }

        if (!live) return;
        setPlace(nextPlace);
        setEntryCountry(nextCountry);
        setTimeZone(nextTimeZone);
        setWeatherError(false);

        if (!nextPlace || nextPlace.precision === 'country') {
          setWeather(undefined);
          setWeatherError(true);
          return;
        }

        const current = await fetchVisitorWeather(nextPlace);
        if (live) setWeather(current);
      } catch {
        if (live) setWeatherError(true);
      } finally {
        running = false;
        if (live) setWeatherLoading(false);
      }
    };

    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 15 * 60_000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [currentLang]);

  const locale = visitorLocale(currentLang, place?.country || entryCountry);
  const localTimeZone = place?.timezone || timeZone;
  const dateOptions: Intl.DateTimeFormatOptions = { dateStyle: 'full', ...(localTimeZone ? { timeZone: localTimeZone } : {}) };
  const timeOptions: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', ...(localTimeZone ? { timeZone: localTimeZone } : {}) };
  let dateText = '';
  let timeText = '';
  try {
    dateText = new Intl.DateTimeFormat(locale, dateOptions).format(now);
    timeText = new Intl.DateTimeFormat(locale, timeOptions).format(now);
  } catch {
    const fallbackLocale = LOCALE_MAP[currentLang] || 'en-GB';
    dateText = new Intl.DateTimeFormat(fallbackLocale, { dateStyle: 'full' }).format(now);
    timeText = new Intl.DateTimeFormat(fallbackLocale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(now);
  }

  const placeCountry = place?.country && place.country !== 'UN' ? place.country : entryCountry;
  const localizedCountry = countryName(placeCountry, locale);
  const city = place && place.precision !== 'country' ? (currentLang === 'ar' ? place.cityAr : place.cityEn) : '';
  const placeText = city ? `${city}${localizedCountry ? ` · ${localizedCountry}` : ''}` : localizedCountry || label('location_unavailable');
  const locationHint = place?.precision === 'timezone' ? label('approximate_location') : place ? label('entry_location') : label('device_time');
  const timezoneLabel = timezoneName(localTimeZone, locale, now);
  const temperature = weather ? temperatureForVisitor(weather.temperatureC, placeCountry || entryCountry) : undefined;
  const condition = weather ? weatherKind(weather.weatherCode) : undefined;
  const ConditionIcon = condition ? WEATHER_ICONS[condition] : Thermometer;

  return (
    <section
      data-testid="visitor-local-dashboard"
      aria-label={label('local_info')}
      className="mx-auto w-full max-w-7xl px-4 pt-3 sm:px-8"
    >
      <div className="overflow-hidden rounded-3xl border border-amber-200/80 bg-gradient-to-r from-white via-amber-50/60 to-white shadow-sm">
        <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-3 md:gap-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-stone-500">
              <CalendarDays className="h-4 w-4 text-amber-700" aria-hidden="true" />
              <span>{label('local_date')}</span>
            </div>
            <time dateTime={now.toISOString()} className="mt-2 block text-sm font-semibold leading-relaxed text-stone-800">
              {dateText}
            </time>
          </div>

          <div className="min-w-0 border-stone-200 md:border-x md:px-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-stone-500">
              <Clock3 className="h-4 w-4 text-amber-700" aria-hidden="true" />
              <span>{label('local_time')}</span>
              {timezoneLabel && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] text-stone-600">{timezoneLabel}</span>}
            </div>
            <time dateTime={now.toISOString()} aria-live="off" dir="auto" className="mt-1 block font-mono text-2xl font-bold tabular-nums tracking-tight text-stone-950 sm:text-3xl">
              {timeText}
            </time>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-stone-500">
              <ConditionIcon className="h-4 w-4 text-amber-700" aria-hidden="true" />
              <span>{label('current_weather')}</span>
            </div>
            {temperature ? (
              <div className="mt-1 flex items-center gap-2">
                <span className="text-2xl font-bold tabular-nums text-stone-950 sm:text-3xl">
                  {new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(temperature.value)}{temperature.unit}
                </span>
                <span className="text-xs text-stone-600">{weather ? weatherDescription(weather.weatherCode, currentLang) : ''}</span>
              </div>
            ) : (
              <p className="mt-2 text-sm font-semibold text-stone-700" aria-live="polite">
                {weatherLoading ? label('loading_weather') : weatherError ? label('weather_unavailable') : label('location_unavailable')}
              </p>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-x-1 text-[10px] text-stone-500">
              <span>{label('powered_by')}</span>
              <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="font-medium underline decoration-stone-300 underline-offset-2 hover:text-stone-800">Open-Meteo</a>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-amber-100 bg-white/60 px-4 py-2 text-xs text-stone-600 sm:px-5">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden="true" />
          <span className="font-semibold text-stone-800">{placeText}</span>
          <span aria-hidden="true">·</span>
          <span>{locationHint}</span>
          {localTimeZone && <span className="hidden sm:inline">· {localTimeZone}</span>}
        </div>
      </div>
    </section>
  );
}
