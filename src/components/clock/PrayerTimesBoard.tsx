import { useId, useMemo } from 'react';
import { Moon, Sunrise as SunriseIcon } from 'lucide-react';
import type { SupportedLanguage } from '../../types/i18n';
import { makeT, loc, type LText } from '../../لغات/localize';
import { formatLocalizedNumber } from '../../لغات/numerals';
import { PRAYER_NAMES, type PrayerName } from '../../utils/prayerConfig';
import { prayerDayKey, prayerSunArc, splitPrayerRemaining, type PrayerDay } from '../../utils/prayerTimes';
import { PRAYER_LABELS, prayerFormatters, prayerPlaceLabel, prayerT } from './prayerText';
import { usePrayerCalendar, type PrayerCalendarSettings } from './usePrayerCalendar';
import './prayers.css';

const TEXT = {
  prayers: { ar: 'مواقيت الصلاة', en: 'Prayer times' },
  next: { ar: 'القادمة', en: 'Next' },
  remaining: { ar: 'باقي', en: 'in' },
  hours_short: { ar: 'س', en: 'h' },
  minutes_short: { ar: 'د', en: 'm' },
} satisfies Record<string, LText>;
const ICONS: Partial<Record<PrayerName, typeof Moon>> = { fajr: Moon, sunrise: SunriseIcon, isha: Moon };

function ArcIcon({ kind }: { kind: PrayerName }) {
  const Icon = ICONS[kind];
  if (Icon) return <Icon className="prayer-icon" size={14} aria-hidden="true" />;
  const y = kind === 'dhuhr' ? 6 : kind === 'asr' ? 10 : 14;
  return (
    <svg className="prayer-icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M1.4 14.2a6.6 6.6 0 0 1 13.2 0" fill="none" stroke="currentColor" strokeWidth="1.1" opacity="0.4" />
      <circle cx="8" cy={y} r={kind === 'dhuhr' ? 2.5 : 2.2} fill="currentColor" />
      {kind !== 'dhuhr' && <path d={`M8 ${y - 4.1}V${y - 3.1}M11 ${y}H12M5 ${y}H4`} stroke="currentColor" strokeWidth="1" strokeLinecap="round" />}
      {kind === 'maghrib' && <path d="M1.2 15h13.6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />}
    </svg>
  );
}

/** A decorative clock arc, not an ephemeris. The endpoints are the displayed sunrise and sunset. */
function SunArc({ today, now }: { today: PrayerDay; now: number }) {
  const id = useId();
  const sun = prayerSunArc(today.times, now);
  if (!sun) return null;
  const { daylight, progress } = sun;
  const x = 6 + progress * 196;
  const y = 46 - 120 * progress * (1 - progress);
  return (
    <svg className="prayer-arc" viewBox="0 0 208 58" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-day`} x1="0" x2="1">
          <stop offset="0" stopColor="#f9c98f" stopOpacity="0.95" />
          <stop offset="0.5" stopColor="#ffe9c2" />
          <stop offset="1" stopColor="#f0916b" stopOpacity="0.95" />
        </linearGradient>
        <radialGradient id={`${id}-glow`}>
          <stop offset="0" stopColor="#ffe2ac" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffe2ac" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d="M6 46 Q104 -14 202 46" fill="none" stroke="#ffe6c326" strokeWidth="5" strokeLinecap="round" />
      <path d="M6 46 Q104 -14 202 46" fill="none" stroke={`url(#${id}-day)`} strokeWidth={daylight ? 1.9 : 1.1}
        strokeLinecap="round" strokeDasharray={daylight ? undefined : '3 4'} opacity={daylight ? 1 : 0.55} />
      <line x1="2" y1="46" x2="206" y2="46" stroke="#ffe6c333" strokeWidth="1" />
      <circle cx="6" cy="46" r="2.4" fill="#ffd9a1" />
      <circle cx="202" cy="46" r="2.4" fill="#f4a17b" />
      {daylight && <circle cx={x} cy={y} r="12" fill={`url(#${id}-glow)`} />}
      <circle className="prayer-sun" cx={x} cy={y} r={daylight ? 4.2 : 3.2} fill={daylight ? '#fff3d4' : '#cbc2b8'} />
    </svg>
  );
}

/** The clock's preview uses network-synchronized time for the countdown and the same civil table as the dialog. */
export default function PrayerTimesBoard({ lang, now, compact, ...settings }: PrayerCalendarSettings & {
  lang: SupportedLanguage; now?: number; compact: boolean;
}) {
  const label = makeT(lang, TEXT);
  const copy = prayerT(lang);
  const titleId = useId();
  const { resolved, place, today, events, upcoming } = usePrayerCalendar(settings, now);
  const zone = place?.timeZone;
  const format = useMemo(() => prayerFormatters(lang, zone ?? 'UTC'), [lang, zone]);
  const placeName = prayerPlaceLabel(lang, resolved);
  const source = resolved?.source;
  if (compact) return upcoming ? <span className="prayer-chip" data-testid="prayer-chip" title={`${label('prayers')} · ${placeName}`}>
    <Moon size={13} aria-hidden="true" /><span>{loc(lang, PRAYER_LABELS[upcoming.prayer])}</span>
    <time dir="ltr" dateTime={new Date(upcoming.at).toISOString()}>{format.time.format(upcoming.at)}</time>
  </span> : null;
  const remaining = upcoming && now !== undefined ? splitPrayerRemaining(upcoming.at - now) : undefined;
  const current = now === undefined ? undefined : events.filter((event) => event.at <= now).at(-1);
  const eventDay = zone && upcoming ? prayerDayKey(zone, upcoming.at) : undefined;
  return (
    <section className="prayer-board" aria-labelledby={titleId} data-testid="prayer-times" data-state={today ? 'ready' : 'unknown'}
      data-polar={today && !today.reliable} data-place-source={source}>
      <header className="prayer-head">
        <h2 id={titleId} className="prayer-title"><Moon size={14} aria-hidden="true" />{label('prayers')}</h2>
        {placeName && <bdi className="prayer-place">{placeName}</bdi>}
      </header>
      {!today && <p className="prayer-empty">{copy(place ? 'loading' : 'selectLocation')}</p>}
      {today && <>
        <div className="prayer-hero">
          {now !== undefined && <SunArc today={today} now={now} />}
          {upcoming && remaining && <div className="prayer-countdown">
            <span className="prayer-next-label">{label('next')} · {loc(lang, PRAYER_LABELS[upcoming.prayer])}</span>
            <time dir="ltr" className="prayer-next-time" dateTime={new Date(upcoming.at).toISOString()}>{format.time.format(upcoming.at)}</time>
            <span className="prayer-remaining">
              {label('remaining')}{' '}
              {remaining.hours > 0 && <bdi dir="ltr">{formatLocalizedNumber(lang, remaining.hours, { grouping: false })}{label('hours_short')} </bdi>}
              <bdi dir="ltr">{formatLocalizedNumber(lang, remaining.minutes, { grouping: false })}{label('minutes_short')}</bdi>
              {eventDay && eventDay > today.key && ` · ${copy('tomorrow')}`}
              {upcoming.day < today.key && ` · ${copy('previousDay')}`}
            </span>
          </div>}
        </div>
        <ol className="prayer-strip">
          {PRAYER_NAMES.map((key) => {
            const active = upcoming?.prayer === key && upcoming.day === today.key;
            const at = today.times[key];
            return <li key={key} data-key={key} data-next={active} data-current={current?.prayer === key && current.day === today.key}>
              <ArcIcon kind={key} /><span className="prayer-name">{loc(lang, PRAYER_LABELS[key])}</span>
              {at === undefined ? <span className="prayer-time">—</span> : <time dir="ltr" className="prayer-time" dateTime={new Date(at).toISOString()}>{format.time.format(at)}</time>}
              {active && <span className="prayer-badge">{label('next')}</span>}
            </li>;
          })}
        </ol>
      </>}
      {source && <footer className="prayer-foot">
        <span>{copy(source === 'country' ? 'countryHint' : source)}</span>
        {today && <span>{copy(today.reliable ? 'summaryEstimate' : 'scheduleUnavailable')}</span>}
      </footer>}
    </section>
  );
}
