import { useEffect, useRef, useState } from 'react';
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
  Locate,
  Sun,
  Thermometer,
  type LucideIcon,
} from 'lucide-react';
import { LOCALE_MAP, makeT, type LText } from '../لغات/localize';
import type { SupportedLanguage } from '../types/i18n';
import {
  browserTimeZone,
  browserVisitorCountry,
  fetchVisitorWeather,
  locateVisitorDevice,
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
  location_unavailable: { ar: 'الطقس غير متاح من غير مدينة مؤكدة', en: 'Weather needs a confirmed city' },
  city_not_identified: { ar: 'المدينة غير محددة من شبكة الدخول', en: 'Entry network did not identify a city' },
  timezone_only: { ar: 'الساعة حسب توقيت جهازك؛ المدينة مش مؤكدة', en: 'Clock follows your device zone; city is unconfirmed' },
  entry_location: { ar: 'حسب مدينة شبكة الدخول', en: 'Based on the entry network city' },
  device_location: { ar: 'حسب موقع الجهاز بعد موافقتك', en: 'Based on your device location' },
  precise_location: { ar: 'حدّد موقعي بدقة', en: 'Use precise location' },
  refresh_location: { ar: 'حدّث موقعي', en: 'Refresh my location' },
  locating: { ar: 'بنحدد موقعك…', en: 'Finding your location…' },
  location_denied: { ar: 'اسمح للموقع من إعدادات المتصفح عشان نحدد مدينتك', en: 'Allow location in your browser settings to identify your city' },
  location_timeout: { ar: 'تحديد الموقع أخد وقت طويل؛ جرّب تاني', en: 'Location timed out; try again' },
  location_unsupported: { ar: 'المتصفح مش بيدعم تحديد الموقع', en: 'This browser does not support location' },
  location_failed: { ar: 'ماقدرناش نحدد موقعك دلوقتي', en: 'Could not determine your location right now' },
  permission_note: { ar: 'موقع الجهاز مش هيتحدد إلا بموافقتك؛ الطقس يستخدم إحداثيات تقريبية', en: 'Device location is used only with permission; weather uses rounded coordinates' },
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

type LocationRequestState = 'idle' | 'loading' | 'ready' | 'denied' | 'timeout' | 'unsupported' | 'failed';

function hasCityPrecision(location: VisitorEntryLocation | undefined): location is VisitorEntryLocation {
  return Boolean(location && ['edge-city', 'edge-coords', 'device-gps'].includes(location.precision));
}

export function VisitorLocalDashboard({ currentLang }: { currentLang: SupportedLanguage }) {
  const [now, setNow] = useState(() => new Date());
  const [place, setPlace] = useState<VisitorEntryLocation | undefined>();
  const [entryCountry, setEntryCountry] = useState<string | undefined>(() => browserVisitorCountry());
  const [timeZone, setTimeZone] = useState<string | undefined>(() => browserTimeZone());
  const [weather, setWeather] = useState<CurrentWeather | undefined>();
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState(false);
  const [locationRequest, setLocationRequest] = useState<LocationRequestState>('idle');
  const deviceLocation = useRef<VisitorEntryLocation | undefined>(undefined);
  const label = makeT(currentLang, TEXT);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let live = true;
    let running = false;
    let permissionChecked = false;
    const refresh = async () => {
      if (running) return;
      running = true;
      if (live) setWeatherLoading(true);
      try {
        let nextTimeZone = browserTimeZone();
        let nextCountry = browserVisitorCountry(nextTimeZone);
        let nextPlace = deviceLocation.current;

        if (!isStaticHosting) {
          try {
            const response = await fetch(apiUrl('/api/geo'), { cache: 'no-store', signal: AbortSignal.timeout(4500) });
            if (response.ok) {
              const geo = readVisitorGeo(await response.json());
              if (geo.country) nextCountry = geo.country;
              if (!nextTimeZone && geo.timezone) nextTimeZone = geo.timezone;
              if (!deviceLocation.current && hasCityPrecision(geo.location)) nextPlace = geo.location;
            }
          } catch {
            // Keep the device's local time and country; do not guess a city from its timezone.
          }
        }

        // Reuse device location only when permission was already granted; never trigger a prompt on page load.
        if (!permissionChecked && !deviceLocation.current) {
          permissionChecked = true;
          try {
            if (typeof navigator !== 'undefined' && navigator.permissions) {
              const permission = await navigator.permissions.query({ name: 'geolocation' });
              if (permission.state === 'granted') {
                const precise = await locateVisitorDevice();
                deviceLocation.current = precise;
                nextPlace = precise;
                if (precise.country !== 'UN') nextCountry = precise.country;
                nextTimeZone = precise.timezone || nextTimeZone;
                if (live) setLocationRequest('ready');
              }
            }
          } catch {
            // The CDN city remains available if a previously granted device lookup is temporarily unavailable.
          }
        }

        if (deviceLocation.current) nextPlace = deviceLocation.current;
        if (!live) return;
        setPlace(nextPlace);
        setEntryCountry(nextCountry);
        setTimeZone(nextTimeZone);
        setWeatherError(false);

        if (!hasCityPrecision(nextPlace)) {
          setWeather(undefined);
          setWeatherError(true);
          return;
        }

        const current = await fetchVisitorWeather(nextPlace);
        if (live) setWeather(current);
      } catch {
        if (live) {
          setWeather(undefined);
          setWeatherError(true);
        }
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

  const requestDeviceLocation = async () => {
    setLocationRequest('loading');
    try {
      const precise = await locateVisitorDevice();
      deviceLocation.current = precise;
      setPlace(precise);
      if (precise.country !== 'UN') setEntryCountry(precise.country);
      setTimeZone(precise.timezone || browserTimeZone());
      setWeatherLoading(true);
      setWeather(undefined);
      setWeatherError(false);
      setLocationRequest('ready');
      try {
        setWeather(await fetchVisitorWeather(precise));
      } catch {
        setWeather(undefined);
        setWeatherError(true);
      } finally {
        setWeatherLoading(false);
      }
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      setLocationRequest(code === 'GEOLOCATION_DENIED' ? 'denied' : code === 'GEOLOCATION_TIMEOUT' ? 'timeout' : code === 'GEOLOCATION_UNSUPPORTED' ? 'unsupported' : 'failed');
    }
  };

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
  const city = hasCityPrecision(place) ? (currentLang === 'ar' ? place.cityAr : place.cityEn) : '';
  const placeText = city
    ? `${city}${localizedCountry ? ` · ${localizedCountry}` : ''}`
    : `${localizedCountry ? `${localizedCountry} · ` : ''}${label('city_not_identified')}`;
  const locationHint = place?.precision === 'device-gps'
    ? label('device_location')
    : hasCityPrecision(place) ? label('entry_location') : label('timezone_only');
  const locationStatus = locationRequest === 'denied' ? label('location_denied')
    : locationRequest === 'timeout' ? label('location_timeout')
      : locationRequest === 'unsupported' ? label('location_unsupported')
        : locationRequest === 'failed' ? label('location_failed') : '';
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
                {!hasCityPrecision(place) ? label('location_unavailable') : weatherLoading ? label('loading_weather') : weatherError ? label('weather_unavailable') : label('loading_weather')}
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
          <span className="basis-full text-[10px] text-stone-500 sm:basis-auto sm:ms-auto">{label('permission_note')}</span>
          {locationStatus && <span role="status" aria-live="polite" className="basis-full text-[11px] text-rose-700 sm:basis-auto">{locationStatus}</span>}
          <button
            type="button"
            onClick={() => { void requestDeviceLocation(); }}
            disabled={locationRequest === 'loading'}
            title={label('permission_note')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-950 transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-wait disabled:opacity-60"
          >
            <Locate className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{locationRequest === 'loading' ? label('locating') : place?.precision === 'device-gps' ? label('refresh_location') : label('precise_location')}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
