import { useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, Clock3, LocateFixed, MapPin, MoonStar, Settings2, Sun, Sunrise } from 'lucide-react';
import type { SupportedLanguage } from '../../types/i18n';
import { loc } from '../../لغات/localize';
import { METHODS, PRAYER_NAMES, type AsrRule, type PrayerMethod, type PrayerPlace, type PrayerPreferences } from '../../utils/prayerConfig';
import { prayerSearchKey, type ResolvedPrayerPlace } from '../../utils/prayerPlaces';
import { prayerDayKey, type PrayerDay, type PrayerEvent } from '../../utils/prayerTimes';
import { METHOD_NAMES, PRAYER_LABELS, prayerCountryName, prayerFormatters, prayerT } from './prayerText';

export type GpsState = 'idle' | 'locating' | 'denied' | 'failed';
const placeCity = (lang: SupportedLanguage, place: PrayerPlace) => lang === 'ar' ? place.cityAr : place.cityEn;
export function prayerPlaceLabel(lang: SupportedLanguage, resolved?: ResolvedPrayerPlace): string {
  if (!resolved) return '';
  const { place, source } = resolved;
  const city = placeCity(lang, place);
  // GPS country can be inferred from a neighboring zone; the useful visible datum is the timezone.
  return source === 'gps' || place.country === 'UN' ? city : `${city} · ${prayerCountryName(lang, place.country)}`;
}

export function PrayerSchedulePane({ lang, cities, resolved, prefs, onUpdate, onCity, onGps, onAutomatic, gpsState, method, asr, now, today, upcoming,
  settingsOpen, onSettings, hasGps, suggestedCountry }: {
  lang: SupportedLanguage; cities: readonly PrayerPlace[]; resolved?: ResolvedPrayerPlace; prefs: PrayerPreferences;
  onUpdate: (prefs: Partial<PrayerPreferences>) => void; onCity: (key: string) => void; onGps: () => void; onAutomatic: () => void;
  gpsState: GpsState; method: PrayerMethod; asr: Exclude<AsrRule, 'auto'>; now: number; today?: PrayerDay; upcoming?: PrayerEvent;
  settingsOpen: boolean; onSettings: (open: boolean) => void; hasGps: boolean; suggestedCountry?: string;
}) {
  const label = prayerT(lang);
  const [draftCountry, setDraftCountry] = useState<string>();
  const [search, setSearch] = useState('');
  const { country, timeZone } = resolved?.place ?? {};
  const { place, source } = resolved ?? {};
  const format = useMemo(() => prayerFormatters(lang, timeZone ?? 'UTC'), [lang, timeZone]);
  const countryRows = useMemo(() => Array.from(new Set(cities.map((city) => city.country))).map((code) => [code, prayerCountryName(lang, code)] as const)
    .sort((a, b) => a[1].localeCompare(b[1])), [cities, lang]);
  const fallbackCountry = country || suggestedCountry;
  const selectedCountry = draftCountry ?? (countryRows.some(([code]) => code === fallbackCountry) ? fallbackCountry : '') ?? '';
  const cityRows = useMemo(() => {
    const parts = prayerSearchKey(search).split(' ').filter(Boolean);
    return cities.filter((city) => city.country === selectedCountry && (!parts.length || parts.every((part) => prayerSearchKey(`${city.cityEn} ${city.cityAr}`).includes(part))));
  }, [cities, search, selectedCountry]);
  const selectedCity = cityRows.some((p) => prefs.cityKey === p.key) ? prefs.cityKey || '' : '';
  const recommendation = place && (source === 'timezone' || source === 'country');
  const eventDay = timeZone && upcoming ? prayerDayKey(timeZone, upcoming.at) : undefined;
  const onSelectCity = (key: string) => { onCity(key); setSearch(''); };

  return <div className="prayer-pane prayer-schedule-pane" data-prayer-place-source={source}>
    {place && timeZone ? <>
      <div className="prayer-local-hero">
        <div className="prayer-local-meta">
          <span className="prayer-overline"><MapPin size={14} aria-hidden="true" />{label('dateLocal')}</span>
          <h3 data-testid="prayer-place" dir="auto">{prayerPlaceLabel(lang, resolved)}</h3>
          <p className="prayer-local-date"><CalendarDays size={14} aria-hidden="true" /><time dateTime={today?.key}>{format.date.format(now)}</time> <bdi>{timeZone}</bdi></p>
          {source && <p className="prayer-location-note">{label(source === 'country' ? 'countryHint' : source)}</p>}
          {recommendation && <button type="button" className="prayer-confirm-place" onClick={() => onSelectCity(place.key)}>{label('useSuggested')}</button>}
        </div>
        {upcoming && <div className="prayer-next" data-testid="prayer-next">
          <span className="prayer-overline"><Clock3 size={14} aria-hidden="true" />{label('upcoming')}</span>
          <strong>{loc(lang, PRAYER_LABELS[upcoming.prayer])} <time dir="ltr" dateTime={new Date(upcoming.at).toISOString()}>{format.time.format(upcoming.at)}</time></strong>
          {eventDay && today && eventDay > today.key && <small>{label('tomorrow')}</small>}
          {today && upcoming.day < today.key && <small>{label('previousDay')}</small>}
        </div>}
      </div>
      <ul className="prayer-timings" aria-label={label('today')}>
        {PRAYER_NAMES.map((name) => {
          const at = today?.times[name];
          const Icon = name === 'sunrise' ? Sunrise : name === 'fajr' || name === 'isha' || name === 'maghrib' ? MoonStar : Sun;
          return <li key={name} data-testid={`prayer-${name}`} data-next={upcoming?.prayer === name && upcoming.day === today?.key}>
            <Icon size={18} aria-hidden="true" /><span>{loc(lang, PRAYER_LABELS[name])}</span>
            {at !== undefined ? <time dir="ltr" dateTime={new Date(at).toISOString()}>{format.time.format(at)}</time> : <span aria-label={label('scheduleUnavailable')}>—</span>}
            {name === 'sunrise' && <small>{label('sunriseNote')}</small>}
            {at !== undefined && today && prayerDayKey(timeZone, at)! > today.key && <small>{label('nextDay')}</small>}
          </li>;
        })}
      </ul>
      {!today?.reliable && <p className="prayer-warn" role="status">{label('scheduleUnavailable')}</p>}
      <p className="prayer-help prayer-method-note">{loc(lang, METHOD_NAMES[method])} · {label(asr)}<br />{label('approximate')}{Math.abs(place.lat) > 48 && ` ${label('twilight')}`}</p>
    </> : <div className="prayer-card"><h3>{label('today')}</h3><p>{label('selectLocation')}</p></div>}
    <details className="prayer-card prayer-details" open={settingsOpen || !resolved} onToggle={(event) => onSettings(event.currentTarget.open)}>
      <summary><Settings2 size={17} aria-hidden="true" /><strong>{label('locationSettings')}</strong><ChevronDown size={16} aria-hidden="true" /></summary>
      <div className="prayer-details-body">
        <div className="prayer-actions">
          <button type="button" className="prayer-action-primary" disabled={gpsState === 'locating'} onClick={onGps}><LocateFixed size={15} aria-hidden="true" />{label(gpsState === 'locating' ? 'locating' : 'useGps')}</button>
          {(prefs.cityKey || hasGps) && <button type="button" onClick={() => { setDraftCountry(undefined); setSearch(''); onAutomatic(); }}>{label('automaticPlace')}</button>}
        </div>
        <p className="prayer-help">{label('gpsPrivacy')}</p>
        {gpsState !== 'idle' && gpsState !== 'locating' && <p className="prayer-warn" role="status">{label(gpsState === 'denied' ? 'gpsDenied' : 'gpsFailed')}</p>}
        <div className="prayer-field-grid">
          <label>{label('country')}<select aria-label={label('country')} value={selectedCountry} onChange={(event) => { setDraftCountry(event.target.value); setSearch(''); }}>
            <option value="">{label('countryPlaceholder')}</option>{countryRows.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select></label>
          <label>{label('citySearch')}<input type="search" dir="auto" value={search} placeholder={label('cityPlaceholder')} maxLength={80} disabled={!selectedCountry} onChange={(event) => setSearch(event.target.value)} /></label>
        </div>
        <label>{label('city')}<select aria-label={label('city')} value={selectedCity} disabled={!cityRows.length} onChange={(event) => { if (event.target.value) onSelectCity(event.target.value); }}>
          <option value="">{label('cityChoose')}</option>{cityRows.map((city) => <option key={city.key} value={city.key}>{placeCity(lang, city)} · {city.timeZone}</option>)}
        </select></label>
        {selectedCountry && !cityRows.length && <p className="prayer-help" role="status">{label('cityNoMatch')}</p>}
        <div className="prayer-field-grid">
          <label>{label('method')}<select aria-label={label('method')} value={prefs.method} onChange={(event) => onUpdate({ method: event.target.value as PrayerMethod | 'auto' })}>
            <option value="auto">{label('auto')}</option>{METHODS.map((name) => <option key={name} value={name}>{loc(lang, METHOD_NAMES[name])}</option>)}
          </select></label>
          <label>{label('asrRule')}<select aria-label={label('asrRule')} value={prefs.asr} onChange={(event) => onUpdate({ asr: event.target.value as AsrRule })}>
            {(['auto', 'standard', 'hanafi'] as const).map((name) => <option key={name} value={name}>{label(name)}</option>)}
          </select></label>
        </div>
        <p className="prayer-help"><a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a> · <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Natural Earth</a> · <a href="https://github.com/batoulapps/adhan-js" target="_blank" rel="noreferrer">Adhan JS</a></p>
      </div>
    </details>
  </div>;
}
