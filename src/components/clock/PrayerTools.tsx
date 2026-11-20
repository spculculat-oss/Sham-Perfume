import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { BookOpen, ChevronRight, Eye, MoonStar } from 'lucide-react';
import { ISLAMIC_LIBRARY_HASH, ISLAMIC_LIBRARY_TITLE } from '../../library/islamic/entry';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../../types/i18n';
import { loc } from '../../لغات/localize';
import { PRAYER_CLEARED, PRAYER_PREFS_KEY, decodePrayerPreferences, type PrayerPreferences } from '../../utils/prayerConfig';
import type { PrayerGeo, ResolvedPrayerPlace } from '../../utils/prayerPlaces';
import type { PrayerCalendarSettings } from './usePrayerCalendar';
import { PrayerDialog } from './PrayerDialog';
import { prayerT } from './prayerText';
import './prayer.css';

const Runtime = lazy(() => import('./PrayerToolsRuntime').catch(() => ({ default: function Unavailable({ lang, open, onClose }: {
  lang: SupportedLanguage; open: boolean; onClose: () => void;
}) { return open ? <PrayerDialog lang={lang} onClose={onClose}><p className="prayer-load-note" role="alert">{prayerT(lang)('loadFailed')}</p></PrayerDialog> : null; } })));
const Summary = lazy(() => import('./PrayerTimesBoard').catch(() => ({ default: ({ lang, compact }: { lang: SupportedLanguage; compact: boolean }) => compact ? <PrayerShortcutTitle lang={lang} /> : <></> })));
const LaunchPrayer = createContext<(PrayerCalendarSettings & {
  open: (launcher: HTMLButtonElement) => void;
  shortcut: RefObject<HTMLButtonElement | null>;
}) | null>(null);

function PrayerShortcutTitle({ lang }: { lang: SupportedLanguage }) {
  return <><MoonStar size={14} aria-hidden="true" /><span>{prayerT(lang)('title')}</span></>;
}

function ClockLibraryShortcut({ lang, onNavigate, compact }: {
  lang: SupportedLanguage; onNavigate: (tab: string) => void; compact?: boolean;
}) {
  const title = loc(lang, ISLAMIC_LIBRARY_TITLE);
  return <a href={ISLAMIC_LIBRARY_HASH} className="clock-library-shortcut" title={title} aria-label={title} onClick={(event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    onNavigate(ISLAMIC_LIBRARY_HASH.slice(1));
  }}>
    <BookOpen size={18} aria-hidden="true" />
    {!compact && <span>{loc(lang, { ar: 'مكتبة شام', en: 'Library' })}</span>}
  </a>;
}

const readPreferences = (): PrayerPreferences => {
  try { return decodePrayerPreferences(localStorage.getItem(PRAYER_PREFS_KEY)); }
  catch { return decodePrayerPreferences(null); }
};

/** Sits above both dashboard layouts; the runtime isn't loaded until opened. */
export function PrayerToolsProvider({ lang, geo, browserZone, children }: {
  lang: SupportedLanguage; geo?: PrayerGeo; browserZone?: string; children: ReactNode;
}) {
  const [prefs, setPrefs] = useState(readPreferences);
  const [initialized, setInitialized] = useState(false);
  const [gps, setGps] = useState<ResolvedPrayerPlace>();
  const [open, setOpen] = useState(false);
  const saved = useRef(prefs);
  const launcher = useRef<HTMLButtonElement | null>(null);
  const shortcut = useRef<HTMLButtonElement | null>(null);
  const update = useCallback((delta: Partial<PrayerPreferences>) => {
    const next = { ...saved.current, ...delta };
    saved.current = next;
    try { localStorage.setItem(PRAYER_PREFS_KEY, JSON.stringify(next)); } catch { /* Storage may be disabled. */ }
    setPrefs(next);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    window.requestAnimationFrame(() => {
      // The original launcher can disappear on hide or when the clock layout changes.
      const target = launcher.current?.isConnected ? launcher.current : shortcut.current;
      target?.focus({ preventScroll: true });
    });
  }, []);
  const hide = () => { update({ hidden: true }); setGps(undefined); setInitialized(false); close(); };
  const openFrom = (button: HTMLButtonElement) => {
    launcher.current = button;
    if (saved.current.hidden) update({ hidden: false });
    setInitialized(true);
    setOpen(true);
  };
  useEffect(() => {
    const clear = () => {
      saved.current = decodePrayerPreferences(null);
      setPrefs(saved.current);
      setGps(undefined);
      setInitialized(false);
      setOpen(false);
    };
    const otherTab = (event: StorageEvent) => {
      if (!event.key || (event.key === PRAYER_PREFS_KEY && event.newValue === null)) { clear(); return; }
      if (event.key !== PRAYER_PREFS_KEY) return;
      saved.current = decodePrayerPreferences(event.newValue);
      setPrefs(saved.current);
      if (saved.current.hidden) { setGps(undefined); setInitialized(false); setOpen(false); }
    };
    window.addEventListener('storage', otherTab);
    window.addEventListener(PRAYER_CLEARED, clear);
    return () => { window.removeEventListener('storage', otherTab); window.removeEventListener(PRAYER_CLEARED, clear); };
  }, []);
  return <LaunchPrayer.Provider value={{ prefs, geo, browserZone, gps, open: openFrom, shortcut }}>
    {children}
    {initialized && !prefs.hidden && <Suspense fallback={open ? <PrayerDialog lang={lang} onClose={close}><p className="prayer-load-note" role="status">{prayerT(lang)('loading')}</p></PrayerDialog> : null}>
      <Runtime lang={lang} geo={geo} browserZone={browserZone} gps={gps} setGps={setGps} open={open} prefs={prefs} update={update} onClose={close} onHide={hide} />
    </Suspense>}
  </LaunchPrayer.Provider>;
}

/** Keep the existing clock's sun arc and next-prayer chip, but use the same settings as the dialog. */
export function PrayerClockSummary({ lang, now, onNavigate, compact = false }: {
  lang: SupportedLanguage; now?: Date; onNavigate: (tab: string) => void; compact?: boolean;
}) {
  const feature = useContext(LaunchPrayer);
  if (!feature) return null;
  const hidden = feature.prefs.hidden;
  const dir = SUPPORTED_LANGUAGES.find((language) => language.code === lang)?.dir;
  const summary = !hidden && <Suspense fallback={compact ? <PrayerShortcutTitle lang={lang} /> : null}>
    <Summary lang={lang} now={now?.getTime()} compact={compact} prefs={feature.prefs} geo={feature.geo} browserZone={feature.browserZone} gps={feature.gps} />
  </Suspense>;
  if (compact) return <div className="prayer-clock-actions" dir={dir}>
    <button type="button" ref={feature.shortcut} className="prayer-compact-shortcut" data-hidden={hidden}
      data-testid="prayer-compact-shortcut" aria-haspopup="dialog" onClick={(event) => feature.open(event.currentTarget)}>
      {hidden ? <><Eye size={14} aria-hidden="true" /><span>{prayerT(lang)('show')}</span></> : summary}
    </button>
    <ClockLibraryShortcut lang={lang} onNavigate={onNavigate} compact />
  </div>;
  return <div className="prayer-clock-panel" dir={dir}>
    {summary}
    <div className="prayer-clock-actions" data-hidden={hidden}>
      <PrayerToolsLauncher lang={lang} embedded />
      <ClockLibraryShortcut lang={lang} onNavigate={onNavigate} />
    </div>
  </div>;
}

export function PrayerToolsLauncher({ lang, embedded = false }: { lang: SupportedLanguage; embedded?: boolean }) {
  const feature = useContext(LaunchPrayer);
  const statusId = useId();
  const label = prayerT(lang);
  if (!feature) return null;
  const hidden = feature.prefs.hidden;
  // The compact header already shows Restore; don't duplicate it in the expanded tools.
  if (hidden && !embedded) return null;
  return <button type="button" ref={embedded ? feature.shortcut : undefined} className={`prayer-launcher${embedded ? ' prayer-launcher-summary' : ''}`} data-hidden={hidden} data-testid="prayer-tools-launcher"
    aria-haspopup="dialog" aria-describedby={hidden ? statusId : undefined}
    aria-label={hidden ? label('show') : embedded ? `${label('title')} · ${label('summaryOpen')}` : label('title')} onClick={(event) => feature.open(event.currentTarget)}>
    {hidden ? <>
      <span className="prayer-launcher-icon"><Eye size={19} aria-hidden="true" /></span>
      <span className="prayer-launcher-text"><strong>{label('show')}</strong><small id={statusId}>{label('hiddenStatus')}</small></span>
      <ChevronRight className="prayer-launcher-arrow" aria-hidden="true" size={15} />
    </> : embedded ? <>
      <MoonStar size={15} aria-hidden="true" /><span>{label('summaryOpen')}</span>
      <ChevronRight className="prayer-launcher-arrow" aria-hidden="true" size={15} />
    </> : <>
      <span className="prayer-launcher-icon"><MoonStar size={25} aria-hidden="true" /></span>
      <span className="prayer-launcher-text"><strong>{label('title')}</strong><span>{label('launcherHelp')}</span><small>{label('launcherQuiet')}</small></span>
      <ChevronRight className="prayer-launcher-arrow" aria-hidden="true" size={17} />
    </>}
  </button>;
}
