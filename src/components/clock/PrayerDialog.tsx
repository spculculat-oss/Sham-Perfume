import { useEffect, useId, useRef, type ReactNode } from 'react';
import { MoonStar, X } from 'lucide-react';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../../types/i18n';
import { prayerT } from './prayerText';

export function PrayerDialog({ lang, onClose, children }: { lang: SupportedLanguage; onClose: () => void; children: ReactNode }) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const label = prayerT(lang);
  useEffect(() => {
    const node = dialog.current;
    if (node && !node.open) node.showModal();
    return () => { if (node?.open) node.close(); };
  }, []);
  return <dialog ref={dialog} className="clock-tools-dialog prayer-dialog" aria-labelledby={titleId}
    dir={SUPPORTED_LANGUAGES.find(({ code }) => code === lang)?.dir || 'ltr'}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <header className="clock-tools-header prayer-header">
      <div className="clock-tools-brand"><div className="clock-tools-emblem"><MoonStar size={21} aria-hidden="true" /></div>
        <div><p>{label('subtitle')}</p><h2 id={titleId}>{label('title')}</h2></div>
      </div>
      <button type="button" className="clock-tools-close" aria-label={label('close')} onClick={onClose}><X size={19} aria-hidden="true" /></button>
    </header>
    {children}
  </dialog>;
}
