import { lazy, Suspense, useCallback, useEffect, useId, useRef, useState } from 'react';
import { Bell, BellRing, BookOpen, CalendarDays, EyeOff } from 'lucide-react';
import { ADHAN_RECORDINGS, adhanFileUrl, type AdhanVariant } from '../../data/adhanVoices';
import type { SupportedLanguage } from '../../types/i18n';
import { loc } from '../../لغات/localize';
import type { PrayerPreferences, ReminderMode, ReminderPrayer } from '../../utils/prayerConfig';
import { gpsPrayerPlace, placeIsConfirmed, type ResolvedPrayerPlace } from '../../utils/prayerPlaces';
import { PRAYER_CITIES, isPrayerCity, usePrayerCalendar, type PrayerCalendarSettings } from './usePrayerCalendar';
import { useDisplayTime } from './useClockTools';
import { PrayerDialog } from './PrayerDialog';
import { PrayerAdhanPane, type LocalRecordings } from './PrayerAdhanPane';
import { PrayerSchedulePane, type GpsState } from './PrayerSchedulePane';
import { PRAYER_LABELS, prayerPlaceLabel, prayerT } from './prayerText';
import { usePrayerReminders, type PrayerNotice } from './usePrayerReminders';
import type { AdhanTrack } from './useAdhanAudio';

const AdhkarLibrary = lazy(() => import('./AdhkarLibrary').catch(() => ({ default: ({ lang }: { lang: SupportedLanguage }) => <p className="prayer-warn" role="alert">{prayerT(lang)('loadFailed')}</p> })));
const TABS = [{ label: 'today', Icon: CalendarDays }, { label: 'adhan', Icon: Bell }, { label: 'adhkar', Icon: BookOpen }] as const;
type Tab = typeof TABS[number]['label'];

function PrayerReminderNotice({ notice, lang, dismiss, floating, audioError }: {
  notice: PrayerNotice; lang: SupportedLanguage; dismiss: () => void; floating?: boolean; audioError: boolean;
}) {
  const label = prayerT(lang);
  return <div className={`prayer-notice${floating ? ' prayer-notice-float' : ''}`} data-testid="prayer-notice" data-prayer={notice.event.prayer} dir="auto">
    <div className="prayer-notice-content" role="alert"><BellRing size={21} aria-hidden="true" />
      <div><strong>{label('prayerArrived')} · {loc(lang, PRAYER_LABELS[notice.event.prayer])}</strong><p><bdi>{notice.place}</bdi></p>
        {audioError && <p>{label('playbackError')}</p>}
      </div>
    </div>
    <button type="button" onClick={dismiss}>{label('dismiss')}</button>
  </div>;
}

export default function PrayerToolsRuntime({ lang, geo, browserZone, gps, setGps, open, prefs, update, onClose, onHide }: PrayerCalendarSettings & {
  lang: SupportedLanguage; open: boolean; setGps: (place?: ResolvedPrayerPlace) => void;
  update: (delta: Partial<PrayerPreferences>) => void; onClose: () => void; onHide: () => void;
}) {
  const label = prayerT(lang);
  const [mode, setMode] = useState<ReminderMode>('off');
  const [tab, setTab] = useState<Tab>('today');
  const [locationSettingsOpen, setLocationSettingsOpen] = useState(false);
  const [gpsState, setGpsState] = useState<GpsState>('idle');
  const gpsToken = useRef(0);
  const [custom, setCustom] = useState<LocalRecordings>({});
  const fileRevision = useRef(0);
  const tabBody = useRef<HTMLDivElement>(null);
  const sectionId = useId();
  const active = open || mode !== 'off';
  const now = useDisplayTime(active, 1000);
  const { resolved, place, method, asr, today, events, upcoming } = usePrayerCalendar({ prefs, geo, browserZone, gps }, active ? now : undefined);
  const confirmed = placeIsConfirmed(resolved);
  const trackForVariant = useCallback((variant: AdhanVariant): AdhanTrack | undefined => {
    const file = custom[variant];
    if (file) return { file, name: file.name.slice(0, 80) };
    const voice = ADHAN_RECORDINGS[variant][variant === 'fajr' ? prefs.fajrVoice : prefs.regularVoice];
    return voice ? { name: loc(lang, voice.title), url: adhanFileUrl(voice) } : undefined;
  }, [custom, prefs.fajrVoice, prefs.regularVoice, lang]);
  const trackFor = useCallback((name: ReminderPrayer) => trackForVariant(name === 'fajr' ? 'fajr' : 'regular'), [trackForVariant]);
  const fingerprint = JSON.stringify([place?.key, place?.lat, place?.lon, place?.timeZone, method, asr, prefs.prayers, prefs.fajrVoice, prefs.regularVoice, fileRevision.current]);
  const canArm = confirmed && prefs.prayers.length > 0;
  const audio = usePrayerReminders({ now, events, selected: prefs.prayers, canArm, fingerprint, placeName: prayerPlaceLabel(lang, resolved), trackFor, mode, setMode });

  useEffect(() => () => { gpsToken.current += 1; }, []);
  const cancelGps = () => { gpsToken.current += 1; if (gpsState !== 'idle') setGpsState('idle'); };
  const close = () => { cancelGps(); audio.stop('preview'); onClose(); };
  const selectCity = (key: string) => {
    if (!isPrayerCity(key)) return;
    cancelGps(); setGps(undefined); update({ cityKey: key });
  };
  const selectAutomatic = () => { cancelGps(); setGps(undefined); update({ cityKey: null }); };
  const requestGps = () => {
    const token = ++gpsToken.current;
    if (!navigator.geolocation) { setGpsState('failed'); return; }
    setGpsState('locating');
    try {
      navigator.geolocation.getCurrentPosition(({ coords }) => {
        if (token !== gpsToken.current) return;
        const location = gpsPrayerPlace(PRAYER_CITIES, coords);
        if (!location) { setGpsState('failed'); return; }
        setGps(location); update({ cityKey: null }); setGpsState('idle');
      }, (error) => {
        if (token === gpsToken.current) setGpsState(error.code === 1 ? 'denied' : 'failed');
      }, { enableHighAccuracy: true, maximumAge: 60_000, timeout: 12_000 });
    } catch { setGpsState('failed'); }
  };
  const pickFile = (variant: AdhanVariant, file?: File) => {
    if (!file && !custom[variant]) return;
    fileRevision.current += 1;
    setCustom((old) => ({ ...old, [variant]: file }));
  };
  const preview = (variant: AdhanVariant) => {
    const track = trackForVariant(variant);
    if (track) void audio.play(track, 'preview');
  };
  const jumpTo = (next: Tab) => {
    if (tab === 'adhan' && next !== tab) audio.stop('preview');
    setTab(next);
    if (tabBody.current) tabBody.current.scrollTop = 0;
  };
  const notice = audio.notice && <PrayerReminderNotice notice={audio.notice} lang={lang} dismiss={audio.dismiss} floating={!open}
    audioError={audio.status.state !== 'idle' && audio.status.kind === 'reminder' && (audio.status.state === 'error' || audio.status.state === 'blocked')} />;
  if (!open) return notice || null;
  return <PrayerDialog lang={lang} onClose={close}>
    <nav className="prayer-nav" aria-label={label('title')}>
      {TABS.map(({ Icon, label: key }) => <button key={key} type="button" aria-controls={sectionId} aria-pressed={tab === key} onClick={() => jumpTo(key)}><Icon size={17} aria-hidden="true" />{label(key)}</button>)}
    </nav>
    {notice}
    <div ref={tabBody} id={sectionId} className="prayer-scroll">
      {tab === 'today' && <PrayerSchedulePane lang={lang} cities={PRAYER_CITIES} resolved={resolved} prefs={prefs} onUpdate={update} onCity={selectCity} onGps={requestGps} onAutomatic={selectAutomatic}
        gpsState={gpsState} method={method} asr={asr} now={now} today={today} upcoming={upcoming} settingsOpen={locationSettingsOpen} onSettings={setLocationSettingsOpen} hasGps={!!gps} suggestedCountry={geo?.country} />}
      {tab === 'adhan' && <PrayerAdhanPane lang={lang} prefs={prefs} update={update} canArm={canArm} hasPlace={confirmed} hasSchedule={Boolean(today?.reliable)} audio={audio}
        files={custom} onFile={pickFile} onPreview={preview} onChoosePlace={() => { setLocationSettingsOpen(true); jumpTo('today'); }} />}
      {tab === 'adhkar' && <Suspense fallback={<p className="prayer-load-note" role="status">{label('loading')}</p>}><AdhkarLibrary lang={lang} /></Suspense>}
    </div>
    <footer className="prayer-dialog-footer"><button type="button" onClick={() => { cancelGps(); audio.disarm(); onHide(); }}><EyeOff size={16} aria-hidden="true" />{label('hide')}</button></footer>
  </PrayerDialog>;
}
