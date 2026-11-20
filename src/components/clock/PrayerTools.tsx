import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronRight, MoonStar } from 'lucide-react';
import type { SupportedLanguage } from '../../types/i18n';
import { PRAYER_CLEARED, PRAYER_PREFS_KEY, decodePrayerPreferences, type PrayerPreferences } from '../../utils/prayerConfig';
import type { PrayerGeo } from '../../utils/prayerPlaces';
import { PrayerDialog } from './PrayerDialog';
import { prayerT } from './prayerText';
import './prayer.css';

const Runtime = lazy(() => import('./PrayerToolsRuntime').catch(() => ({ default: function Unavailable({ lang, open, onClose }: {
  lang: SupportedLanguage; open: boolean; onClose: () => void;
}) { return open ? <PrayerDialog lang={lang} onClose={onClose}><p className="prayer-load-note" role="alert">{prayerT(lang)('loadFailed')}</p></PrayerDialog> : null; } })));
const LaunchPrayer = createContext<{ hidden: boolean; open: (launcher: HTMLButtonElement) => void } | null>(null);

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
  const [open, setOpen] = useState(false);
  const saved = useRef(prefs);
  const launcher = useRef<HTMLButtonElement | null>(null);
  const update = useCallback((delta: Partial<PrayerPreferences>) => {
    const next = { ...saved.current, ...delta };
    saved.current = next;
    try { localStorage.setItem(PRAYER_PREFS_KEY, JSON.stringify(next)); } catch { /* Storage may be disabled. */ }
    setPrefs(next);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    window.requestAnimationFrame(() => { if (launcher.current?.isConnected) launcher.current.focus({ preventScroll: true }); });
  }, []);
  const hide = () => { update({ hidden: true }); setInitialized(false); close(); };
  const openFrom = (button: HTMLButtonElement) => {
    launcher.current = button;
    if (prefs.hidden) update({ hidden: false });
    setInitialized(true);
    setOpen(true);
  };
  useEffect(() => {
    const clear = () => {
      saved.current = decodePrayerPreferences(null);
      setPrefs(saved.current);
      setInitialized(false);
      setOpen(false);
    };
    const otherTab = (event: StorageEvent) => {
      if (!event.key || (event.key === PRAYER_PREFS_KEY && event.newValue === null)) { clear(); return; }
      if (event.key !== PRAYER_PREFS_KEY) return;
      saved.current = decodePrayerPreferences(event.newValue);
      setPrefs(saved.current);
      if (saved.current.hidden) { setInitialized(false); setOpen(false); }
    };
    window.addEventListener('storage', otherTab);
    window.addEventListener(PRAYER_CLEARED, clear);
    return () => { window.removeEventListener('storage', otherTab); window.removeEventListener(PRAYER_CLEARED, clear); };
  }, []);
  return <LaunchPrayer.Provider value={{ hidden: prefs.hidden, open: openFrom }}>
    {children}
    {initialized && !prefs.hidden && <Suspense fallback={open ? <PrayerDialog lang={lang} onClose={close}><p className="prayer-load-note" role="status">{prayerT(lang)('loading')}</p></PrayerDialog> : null}>
      <Runtime lang={lang} geo={geo} browserZone={browserZone} open={open} prefs={prefs} update={update} onClose={close} onHide={hide} />
    </Suspense>}
  </LaunchPrayer.Provider>;
}

export function PrayerToolsLauncher({ lang }: { lang: SupportedLanguage }) {
  const feature = useContext(LaunchPrayer);
  const label = prayerT(lang);
  if (!feature) return null;
  return <button type="button" className="prayer-launcher" data-hidden={feature.hidden} data-testid="prayer-tools-launcher"
    aria-haspopup="dialog" aria-label={label(feature.hidden ? 'show' : 'title')} onClick={(event) => feature.open(event.currentTarget)}>
    {feature.hidden ? <span>{label('show')}</span> : <>
      <span className="prayer-launcher-icon"><MoonStar size={25} aria-hidden="true" /></span>
      <span className="prayer-launcher-text"><strong>{label('title')}</strong><span>{label('launcherHelp')}</span><small>{label('launcherQuiet')}</small></span>
      <ChevronRight className="prayer-launcher-arrow" aria-hidden="true" size={17} />
    </>}
  </button>;
}
