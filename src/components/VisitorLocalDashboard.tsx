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
  readHttpDateClock,
  readNetworkClock,
  networkClockAt,
  readVisitorGeo,
  temperatureForVisitor,
  visitorLocale,
  weatherDescription,
  weatherKind,
  type CurrentWeather,
  type NetworkClockAnchor,
  type VisitorEntryLocation,
  type WeatherKind,
} from '../utils/visitorLocal';
import { apiUrl, isStaticHosting } from '../utils/api';
import { ClockToolsLaunchers } from './clock/ClockTools';
import { HomeHeadlineBriefing } from './clock/HomeHeadlineBriefing';
import { clockLocale } from './clock/clockText';
import { ClockCalculatorLauncher, type ClockCalculatorState } from './clock/ClockCalculatorLauncher';
import { VisitorCompass } from './clock/VisitorCompass';

const TEXT = {
  local_info: { ar: 'معلوماتك المحلية', en: 'Your local details' },
  local_date: { ar: 'التاريخ المحلي', en: 'Local date' },
  local_time: { ar: 'الوقت المحلي', en: 'Local time' },
  current_weather: { ar: 'الطقس الحالي', en: 'Current weather' },
  loading_weather: { ar: 'جاري جلب الطقس…', en: 'Loading current weather…' },
  weather_unavailable: { ar: 'الطقس غير متاح حاليًا', en: 'Weather is temporarily unavailable' },
  location_unavailable: { ar: 'الطقس غير متاح من غير مدينة مؤكدة', en: 'Weather needs a confirmed city' },
  city_not_identified: { ar: 'المدينة غير محددة من شبكة الدخول', en: 'Entry network did not identify a city' },
  timezone_only: { ar: 'منطقة التوقيت متاحة؛ المدينة غير مؤكدة', en: 'Visitor timezone is available; city is unconfirmed' },
  clock_syncing: { ar: 'جارٍ مزامنة ساعة الإنترنت…', en: 'Syncing the online clock…' },
  clock_synced: { ar: 'متزامنة عبر الإنترنت', en: 'Internet synced' },
  clock_stale: { ar: 'آخر مزامنة محفوظة', en: 'Showing last sync' },
  clock_unavailable: { ar: 'ساعة الإنترنت غير متاحة', en: 'Online time unavailable' },
  monday: { ar: 'الإثنين', en: 'Monday' },
  tuesday: { ar: 'الثلاثاء', en: 'Tuesday' },
  wednesday: { ar: 'الأربعاء', en: 'Wednesday' },
  thursday: { ar: 'الخميس', en: 'Thursday' },
  friday: { ar: 'الجمعة', en: 'Friday' },
  saturday: { ar: 'السبت', en: 'Saturday' },
  sunday: { ar: 'الأحد', en: 'Sunday' },
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

type ClockSyncState = 'syncing' | 'synced' | 'stale' | 'unavailable';

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export function VisitorLocalDashboard({ currentLang, calculatorState, onOpenCalculator }: {
  currentLang: SupportedLanguage;
  calculatorState: ClockCalculatorState;
  onOpenCalculator: (launcher: HTMLButtonElement) => void;
}) {
  const [now, setNow] = useState<Date | undefined>();
  const [clockAnchor, setClockAnchor] = useState<NetworkClockAnchor | undefined>();
  const [clockSync, setClockSync] = useState<ClockSyncState>('syncing');
  const hasServerClock = useRef(false);
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
    let live = true;
    let running = false;
    const syncClock = async () => {
      if (running) return;
      running = true;
      if (live && !hasServerClock.current) setClockSync('syncing');
      const started = performance.now();
      try {
        let reading: ReturnType<typeof readNetworkClock>;
        if (isStaticHosting) {
          // GitHub Pages has no API: synchronize from the HTTP Date header supplied by its origin/CDN.
          const response = await fetch(window.location.href, { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(4500) });
          reading = readHttpDateClock(response.headers.get('date'));
        } else {
          const response = await fetch(apiUrl('/api/clock'), { cache: 'no-store', signal: AbortSignal.timeout(4500) });
          if (!response.ok) throw new Error(`Clock API returned ${response.status}`);
          reading = readNetworkClock(await response.json());
        }
        const received = performance.now();
        if (!reading || !Number.isFinite(received)) throw new Error('Internet clock response was invalid');
        if (!live) return;
        setClockAnchor({ unixMs: reading.unixMs + Math.max(0, received - started) / 2, performanceMs: received });
        setTimeZone(reading.timezone || browserTimeZone() || 'UTC');
        hasServerClock.current = true;
        setClockSync('synced');
      } catch {
        if (live) setClockSync(hasServerClock.current ? 'stale' : 'unavailable');
      } finally {
        running = false;
      }
    };
    void syncClock();
    const timer = window.setInterval(() => { void syncClock(); }, 60_000);
    return () => { live = false; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!clockAnchor) { setNow(undefined); return; }
    const update = () => {
      const epoch = networkClockAt(clockAnchor, performance.now());
      setNow(epoch === undefined ? undefined : new Date(epoch));
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [clockAnchor]);

  useEffect(() => {
    let live = true;
    let running = false;
    let permissionChecked = false;
    const refresh = async () => {
      if (running) return;
      running = true;
      if (live) setWeatherLoading(true);
      try {
        let nextTimeZone: string | undefined;
        let nextCountry: string | undefined;
        let nextPlace = deviceLocation.current;

        if (!isStaticHosting) {
          try {
            const response = await fetch(apiUrl('/api/geo'), { cache: 'no-store', signal: AbortSignal.timeout(4500) });
            if (response.ok) {
              const geo = readVisitorGeo(await response.json());
              if (geo.country) nextCountry = geo.country;
              if (geo.timezone) nextTimeZone = geo.timezone;
              if (!deviceLocation.current && hasCityPrecision(geo.location)) nextPlace = geo.location;
            }
          } catch {
            // The network clock/timezone is synchronized separately; never infer it from the device clock.
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
        if (nextCountry) setEntryCountry(nextCountry);
        if (nextTimeZone) setTimeZone(nextTimeZone);
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
  // The entry network supplies the IANA zone. UTC is explicit when edge metadata is missing; never use device timezone.
  const localTimeZone = timeZone || 'UTC';
  let dateText = label(clockSync === 'syncing' ? 'clock_syncing' : 'clock_unavailable');
  let digitalTime = '--:--:--';
  const { locale: digitLocale, numberingSystem } = clockLocale(currentLang);
  if (now) {
    try {
      dateText = new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeZone: localTimeZone }).format(now);
      digitalTime = new Intl.DateTimeFormat(digitLocale, { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', numberingSystem, timeZone: localTimeZone }).format(now);
    } catch {
      const fallbackLocale = LOCALE_MAP[currentLang] || 'en-GB';
      dateText = new Intl.DateTimeFormat(fallbackLocale, { dateStyle: 'full', timeZone: 'UTC' }).format(now);
      digitalTime = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone: 'UTC' }).format(now);
    }
  }
  const dayToday = now ? new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: localTimeZone }).format(now) : '';
  const weekdayRows = WEEKDAYS.map((key, index) => {
    const sample = new Date(Date.UTC(2024, 0, 1 + index, 12));
    const enDay = new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: localTimeZone }).format(sample);
    const dayText = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: localTimeZone }).format(sample);
    return { key, dayText, active: Boolean(now && enDay === dayToday) };
  });
  const clockStatusText = clockSync === 'synced' ? label('clock_synced')
    : clockSync === 'stale' ? label('clock_stale')
      : clockSync === 'syncing' ? label('clock_syncing') : label('clock_unavailable');

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
  const timezoneLabel = now ? timezoneName(localTimeZone, locale, now) : undefined;
  const temperature = weather ? temperatureForVisitor(weather.temperatureC, placeCountry || entryCountry) : undefined;
  const condition = weather ? weatherKind(weather.weatherCode) : undefined;
  const ConditionIcon = condition ? WEATHER_ICONS[condition] : Thermometer;

  return (
    <section
      data-testid="visitor-local-dashboard"
      aria-label={label('local_info')}
      className="mx-auto w-full max-w-7xl px-4 pt-3 sm:px-8"
    >
      <div className="overflow-hidden rounded-[28px] border border-amber-100/25 bg-gradient-to-br from-[#735844] via-[#3e2f25] to-[#4f3627] text-white shadow-[0_18px_45px_rgba(73,45,25,0.3)]">
        <div className="visitor-clock-board" dir="ltr">
          <div className="visitor-clock-face">
            <div className="grid grid-cols-[32px_minmax(0,1fr)_64px] items-center gap-2 p-4 sm:grid-cols-[48px_minmax(0,1fr)_112px] sm:gap-5 sm:p-5" dir="ltr">
              <div aria-label={currentLang === 'ar' ? 'أيام الأسبوع' : 'Days of the week'} className="flex flex-col items-start gap-1 border-r border-white/10 pe-2 text-[9px] font-semibold uppercase tracking-wide sm:gap-1.5 sm:text-[11px]">
                {weekdayRows.map((day) => <span key={day.key} className={day.active ? 'text-amber-400' : 'text-slate-400'}>{day.dayText}</span>)}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300 sm:text-xs">
                    <Clock3 className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                    <span>{label('local_time')}</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[9px] font-semibold text-emerald-300 sm:text-[10px]">
                    <span className={`h-1.5 w-1.5 rounded-full ${clockSync === 'synced' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : clockSync === 'stale' ? 'bg-amber-400' : 'bg-slate-500'}`} />
                    {clockStatusText}
                  </span>
                </div>
                <time dateTime={now?.toISOString()} aria-live="off" className="mt-1 block whitespace-nowrap font-mono visitor-clock-digits font-black leading-none tabular-nums tracking-[-0.075em] text-[#e7bd8a] drop-shadow-[0_0_18px_rgba(205,149,94,0.45)]">
                  {digitalTime}
                </time>
                <div className="mt-2 flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-slate-300 sm:text-sm">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                  <time dateTime={now?.toISOString()} className="truncate" dir="auto">{dateText}</time>
                  {timezoneLabel && <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[9px] text-slate-300">{timezoneLabel}</span>}
                </div>
              </div>

              <div className="flex min-w-0 flex-col items-center justify-center gap-1 border-l border-white/10 ps-2 text-center sm:gap-2 sm:ps-5">
                <ConditionIcon className="h-7 w-7 text-sky-100 sm:h-9 sm:w-9" aria-hidden="true" />
                <span className="visitor-clock-temp whitespace-nowrap font-mono font-bold tabular-nums text-white">
                  {temperature ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(temperature.value)}${temperature.unit}` : '—°'}
                </span>
                <span className="max-w-20 text-[9px] leading-tight text-slate-400 sm:text-[10px]">
                  {weather ? weatherDescription(weather.weatherCode, currentLang) : !hasCityPrecision(place) ? label('location_unavailable') : weatherLoading ? label('loading_weather') : weatherError ? label('weather_unavailable') : label('loading_weather')}
                </span>
              </div>
            </div>
            <ClockToolsLaunchers lang={currentLang} timeZone={localTimeZone} />
          </div>
          <HomeHeadlineBriefing lang={currentLang} timeZone={localTimeZone} />
        </div>

        <div className="visitor-instrument-row">
          <VisitorCompass lang={currentLang} />
          <ClockCalculatorLauncher lang={currentLang} state={calculatorState} onOpen={onOpenCalculator} />
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-t border-white/10 bg-white/[0.04] px-4 py-3 text-[10px] text-slate-300 sm:px-5 sm:text-xs">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />
          <span className="font-semibold text-white">{placeText}</span>
          <span aria-hidden="true" className="text-slate-500">·</span>
          <span>{locationHint}</span>
          <span aria-hidden="true" className="text-slate-500">·</span>
          <span dir="ltr" className="font-mono text-slate-400">{localTimeZone}</span>
          <span className="basis-full text-[9px] text-slate-400 sm:basis-auto sm:ms-auto">{label('permission_note')}</span>
          <span className="text-[9px] text-slate-400">{label('powered_by')} <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="underline decoration-slate-500 underline-offset-2 hover:text-white">Open-Meteo</a></span>
          {locationStatus && <span role="status" aria-live="polite" className="basis-full text-[11px] text-rose-300">{locationStatus}</span>}
          <button
            type="button"
            onClick={() => { void requestDeviceLocation(); }}
            disabled={locationRequest === 'loading'}
            title={label('permission_note')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-wait disabled:opacity-60 sm:text-xs"
          >
            <Locate className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{locationRequest === 'loading' ? label('locating') : place?.precision === 'device-gps' ? label('refresh_location') : label('precise_location')}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
