import { useId, useMemo } from 'react';
import { Moon, Sunrise as SunriseIcon } from 'lucide-react';
import type { SupportedLanguage } from '../../types/i18n';
import { makeT, type LText } from '../../لغات/localize';
import { formatLocalizedNumber } from '../../لغات/numerals';
import {
  PRAYER_KEYS,
  formatPrayerTime,
  isDaylight,
  nextPrayer,
  prayerMethodFor,
  prayerTimesFor,
  splitRemaining,
  sunProgress,
  type PrayerKey,
  type PrayerTimes,
} from '../../utils/prayerTimes';
import { clockLocale } from './clockText';
import './prayers.css';

const TEXT = {
  prayers: { ar: 'مواقيت الصلاة', en: 'Prayer times' },
  fajr: { ar: 'الفجر', en: 'Fajr' },
  sunrise: { ar: 'الشروق', en: 'Sunrise' },
  dhuhr: { ar: 'الظهر', en: 'Dhuhr' },
  asr: { ar: 'العصر', en: 'Asr' },
  maghrib: { ar: 'المغرب', en: 'Maghrib' },
  isha: { ar: 'العشاء', en: 'Isha' },
  next: { ar: 'القادمة', en: 'Next' },
  remaining: { ar: 'باقي', en: 'in' },
  hours_short: { ar: 'س', en: 'h' },
  minutes_short: { ar: 'د', en: 'm' },
  now: { ar: 'الوقت الحالي', en: 'Now' },
  city_estimate: { ar: 'حسب موقعك التقريبي', en: 'From your approximate location' },
  no_location: { ar: 'حدّد مدينتك عشان نحسب المواقيت', en: 'Set your city to compute the times' },
  polar: { ar: 'المواقيت تقديرية في خطوط العرض العالية', en: 'Estimated at high latitudes' },
  method_note: { ar: 'حساب فلكي على جهازك', en: 'Computed on your device' },
} satisfies Record<string, LText>;

/** The prayer whose window the visitor is currently in (for the softer "now" mark). */
function prayerOnNow(times: PrayerTimes, now: number): PrayerKey | undefined {
  const ordered = PRAYER_KEYS.filter((key) => key !== 'sunrise');
  let current: PrayerKey | undefined;
  for (const key of ordered) if (now >= times.times[key]) current = key;
  return current;
}

/** One-line next-prayer chip for the compact bar on the other pages. */
export function PrayerChip({ lang, place, now, timeZone }: {
  lang: SupportedLanguage;
  place: { lat: number; lon: number; country: string } | undefined;
  now: Date | undefined;
  timeZone: string;
}) {
  const label = makeT(lang, TEXT);
  const { locale: digitLocale, numberingSystem } = clockLocale(lang);
  const epoch = now?.getTime();
  const day = useMemo(() => {
    if (!place || epoch === undefined) return undefined;
    return prayerTimesFor({ latitude: place.lat, longitude: place.lon, date: new Date(epoch), method: prayerMethodFor(place.country) });
  }, [place, epoch]);
  const upcoming = day && epoch !== undefined ? nextPrayer(day, epoch) : undefined;
  return (
    <span className="prayer-chip" data-state={upcoming ? 'ready' : 'unknown'} data-testid="prayer-chip" title={label('prayers')}>
      <Moon size={13} aria-hidden="true" />
      {upcoming && <>
        <span>{label(PRAYER_TEXT[upcoming.key])}</span>
        <bdi dir="ltr">{formatPrayerTime(upcoming.at, timeZone, digitLocale, numberingSystem)}</bdi>
      </>}
    </span>
  );
}

const PRAYER_TEXT: Record<PrayerKey, keyof typeof TEXT> = {
  fajr: 'fajr', sunrise: 'sunrise', dhuhr: 'dhuhr', asr: 'asr', maghrib: 'maghrib', isha: 'isha',
};
const ICONS: Partial<Record<PrayerKey, typeof Moon>> = { fajr: Moon, sunrise: SunriseIcon, isha: Moon };

function ArcIcon({ kind }: { kind: PrayerKey }) {
  const Icon = ICONS[kind];
  if (Icon) return <Icon className="prayer-icon" size={14} aria-hidden="true" />;
  // Dhuhr, Asr and Maghrib get their own little sun graphic at the matching height.
  const y = kind === 'dhuhr' ? 6 : kind === 'asr' ? 10 : 14;
  return (
    <svg className="prayer-icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M1.4 14.2a6.6 6.6 0 0 1 13.2 0" fill="none" stroke="currentColor" strokeWidth="1.1" opacity="0.4" />
      <circle cx="8" cy={y} r={kind === 'dhuhr' ? 2.5 : 2.2} fill="currentColor" />
      {kind !== 'dhuhr' && <path d={`M8 ${y - 4.1}V${y - 3.1}M${8 + 3} ${y}H${8 + 4}M${8 - 3} ${y}H${8 - 4}`} stroke="currentColor" strokeWidth="1" strokeLinecap="round" />}
      {kind === 'maghrib' && <path d="M1.2 15h13.6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />}
    </svg>
  );
}

/** The sun's daily arc: sunrise and sunset at the ends, the current sun on the path. */
function SunArc({ times, now }: { times: PrayerTimes; now: number }) {
  const progress = sunProgress(times, now);
  const daylight = isDaylight(times, now);
  // The path is a parabola sampled into a polyline so the sun can sit exactly on it.
  const x = 6 + progress * 196;
  const y = 46 - 34 * Math.sin(Math.PI * progress);
  return (
    <svg className="prayer-arc" viewBox="0 0 208 58" role="img" aria-hidden="true">
      <defs>
        <linearGradient id="prayer-arc-day" x1="0" x2="1">
          <stop offset="0" stopColor="#f9c98f" stopOpacity="0.95" />
          <stop offset="0.5" stopColor="#ffe9c2" />
          <stop offset="1" stopColor="#f0916b" stopOpacity="0.95" />
        </linearGradient>
        <radialGradient id="prayer-arc-glow">
          <stop offset="0" stopColor="#ffe2ac" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffe2ac" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d="M6 46 Q104 -14 202 46" fill="none" stroke="#ffe6c326" strokeWidth="5" strokeLinecap="round" />
      <path d="M6 46 Q104 -14 202 46" fill="none" stroke="url(#prayer-arc-day)" strokeWidth={daylight ? 1.9 : 1.1}
        strokeLinecap="round" strokeDasharray={daylight ? undefined : '3 4'} opacity={daylight ? 1 : 0.55} />
      <line x1="2" y1="46" x2="206" y2="46" stroke="#ffe6c333" strokeWidth="1" />
      <circle cx="6" cy="46" r="2.4" fill="#ffd9a1" />
      <circle cx="202" cy="46" r="2.4" fill="#f4a17b" />
      {daylight && <circle cx={x} cy={y} r="12" fill="url(#prayer-arc-glow)" />}
      <circle className="prayer-sun" cx={x} cy={y} r={daylight ? 4.2 : 3.2} fill={daylight ? '#fff3d4' : '#cbc2b8'} />
    </svg>
  );
}

export function PrayerTimesBoard({ lang, place, now, timeZone }: {
  lang: SupportedLanguage;
  /** The visitor's confirmed city or entry location; undefined while unknown. */
  place: { lat: number; lon: number; country: string } | undefined;
  /** The internet-synchronized clock, so the countdown never trusts the device wall clock. */
  now: Date | undefined;
  /** The visitor's IANA zone, the same one the clock digits use. */
  timeZone: string;
}) {
  const label = makeT(lang, TEXT);
  const titleId = useId();
  const { locale: digitLocale, numberingSystem } = clockLocale(lang);

  // `now` advances every second in the clock bar; recomputing the countdown is cheap.
  const epoch = now?.getTime();
  const day = useMemo(() => {
    if (!place || epoch === undefined) return undefined;
    return prayerTimesFor({
      latitude: place.lat,
      longitude: place.lon,
      date: new Date(epoch),
      method: prayerMethodFor(place.country),
    });
  }, [place, epoch]);

  if (!place) {
    return (
      <section className="prayer-board" aria-labelledby={titleId} data-testid="prayer-times" data-state="unknown">
        <h2 id={titleId} className="prayer-title"><Moon size={14} aria-hidden="true" />{label('prayers')}</h2>
        <p className="prayer-empty">{label('no_location')}</p>
      </section>
    );
  }
  if (!day) return null;

  const upcoming = epoch === undefined ? undefined : nextPrayer(day, epoch);
  const remaining = upcoming ? splitRemaining(upcoming.remainingMs) : undefined;
  const currentKey = prayerOnNow(day, epoch ?? 0);

  return (
    <section className="prayer-board" aria-labelledby={titleId} data-testid="prayer-times" data-state="ready" data-polar={day.estimated}>
      <header className="prayer-head">
        <h2 id={titleId} className="prayer-title"><Moon size={14} aria-hidden="true" />{label('prayers')}</h2>
        <span className="prayer-place">{label('city_estimate')}</span>
      </header>

      <div className="prayer-hero">
        <SunArc times={day} now={epoch ?? day.times.sunrise} />
        {upcoming && remaining ? (
          <div className="prayer-countdown">
            <span className="prayer-next-label">{label('next')} · {label(PRAYER_TEXT[upcoming.key])}</span>
            <bdi dir="ltr" className="prayer-next-time">
              {formatPrayerTime(upcoming.at, timeZone, digitLocale, numberingSystem)}
            </bdi>
            <span className="prayer-remaining" aria-live="off">
              {label('remaining')}{' '}
              {remaining.hours > 0 && <bdi dir="ltr">{formatLocalizedNumber(lang, remaining.hours, { grouping: false })}{label('hours_short')} </bdi>}
              <bdi dir="ltr">{formatLocalizedNumber(lang, remaining.minutes, { grouping: false })}{label('minutes_short')}</bdi>
            </span>
          </div>
        ) : <span className="prayer-countdown" />}
      </div>

      <ol className="prayer-strip">
        {PRAYER_KEYS.map((key) => {
          const active = upcoming?.key === key;
          const passed = currentKey === key;
          return (
            <li key={key} data-key={key} data-next={active} data-current={passed}>
              <ArcIcon kind={key} />
              <span className="prayer-name">{label(PRAYER_TEXT[key])}</span>
              <bdi dir="ltr" className="prayer-time">{formatPrayerTime(day.times[key], timeZone, digitLocale, numberingSystem)}</bdi>
              {active && <span className="prayer-badge">{label('next')}</span>}
            </li>
          );
        })}
      </ol>

      <footer className="prayer-foot">
        <span>{day.estimated ? label('polar') : label('method_note')}</span>
      </footer>
    </section>
  );
}
