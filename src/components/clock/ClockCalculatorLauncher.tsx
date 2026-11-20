import { useId } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { SupportedLanguage } from '../../types/i18n';
import { makeT, type LText } from '../../لغات/localize';
import './instruments.css';

export const ENGINEERING_WINDOW_ID = 'engineering-calculator-window';
export type ClockCalculatorState = 'closed' | 'open' | 'minimized';
const TEXT = {
  calculator: { ar: 'حاسبة هندسية', en: 'Engineering calculator' },
  features: { ar: 'حساب عادي وعلمي ومعادلات وتحويل وحدات', en: 'Standard, scientific, equations & unit conversion' },
  closed: { ar: 'افتح النافذة العائمة', en: 'Open floating window' },
  open: { ar: 'ارجع للنافذة', en: 'Focus the window' },
  minimized: { ar: 'استعد النافذة', en: 'Restore the window' },
  loading: { ar: 'بنفتح الحاسبة الهندسية…', en: 'Opening the engineering calculator…' },
} satisfies Record<string, LText>;

// A miniature LCD and keypad distinguish this launcher from the lab calculators.
function CalculatorBadge() {
  return <svg viewBox="0 0 50 68" className="clock-calculator-badge" aria-hidden="true">
    <rect x="1" y="1" width="48" height="66" rx="10" fill="#23272b" stroke="#a68b65" />
    <rect x="6" y="7" width="38" height="20" rx="4" fill="#11191b" stroke="#555d58" />
    <rect x="8" y="9" width="34" height="16" rx="3" fill="#c2d1b7" />
    <path d="M13 14h12m-12 5h6m15-5h-3v5h3v-5m3 5h2" fill="none" stroke="#485c47" strokeLinecap="round" />
    <circle cx="25" cy="35" r="5.5" fill="#444e50" stroke="#737d7d" />
    <path d="M22.5 35h5m-2.5-2.5v5" stroke="#d8dfd7" strokeWidth=".85" strokeLinecap="round" />
    <rect x="8" y="33" width="8" height="4" rx="2" fill="#efc78d" />
    <rect x="34" y="33" width="8" height="4" rx="2" fill="#717b7e" />
    {[44, 51, 58].map((y) => [8, 17, 26, 35].map((x) => <rect key={`${x}:${y}`} x={x} y={y} width="7" height="4" rx="2" fill={x === 35 && y === 58 ? '#a0c1d0' : '#757e81'} />))}
  </svg>;
}

export function ClockCalculatorLauncher({ lang, state, onOpen, compact = false }: {
  lang: SupportedLanguage; state: ClockCalculatorState; onOpen: (launcher: HTMLButtonElement) => void; compact?: boolean;
}) {
  const label = makeT(lang, TEXT);
  const subtitle = useId();
  return <button type="button" className="clock-calculator-launcher" data-compact={compact} title={compact ? label('calculator') : undefined} aria-label={label('calculator')} aria-describedby={subtitle}
    aria-haspopup="dialog" aria-expanded={state === 'open'} aria-controls={state === 'closed' ? undefined : ENGINEERING_WINDOW_ID}
    onClick={(event) => onOpen(event.currentTarget)}>
    <CalculatorBadge />
    <span className="clock-calculator-text"><strong>{label('calculator')}</strong><span>{label('features')}</span><small id={subtitle}>{label(state)}</small></span>
    <ArrowUpRight size={15} className="clock-calculator-popout" aria-hidden="true" />
  </button>;
}

export function ClockCalculatorLoading({ lang }: { lang: SupportedLanguage }) {
  const label = makeT(lang, TEXT);
  return <div id={ENGINEERING_WINDOW_ID} role="status" className="clock-calculator-loading">{label('loading')}</div>;
}
