import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { BellRing } from 'lucide-react';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../../types/i18n';
import { formatLocalizedNumber } from '../../لغات/numerals';
import { alarmIsArmed, isMissedClockAlert, timerRemaining, type ClockAlert, type ClockSection, type ClockToolsState, type Countdown } from '../../utils/clockTools';
import { CLOCK_SECTIONS, ClockToolsPanel, type ClockToolsController } from './ClockToolsPanel';
import { useClockTools, useDisplayTime } from './useClockTools';
import { clockT, durationText } from './clockText';
import './clock.css';

interface Panel { section: ClockSection; timeZone: string }
const ClockToolsContext = createContext<{ state: ClockToolsState; open: (panel: Panel, button: HTMLButtonElement) => void } | null>(null);
const isRtl = (lang: SupportedLanguage) => SUPPORTED_LANGUAGES.find((item) => item.code === lang)?.dir === 'rtl';

function ClockNotice({ controller, lang, inline }: { controller: ClockToolsController; lang: SupportedLanguage; inline: boolean }) {
  const { state, send } = controller;
  const alert = state.alerts[0];
  if (!alert) return null;
  const label = clockT(lang);
  const alarm = state.alarms.find((item) => item.id === alert.alarmId);
  const title = alarm ? label(isMissedClockAlert(alert, Date.now()) ? 'missedAlarm' : 'alarmRinging') : label('done');
  const extra = state.alerts.length > 1 ? ` +${formatLocalizedNumber(lang, state.alerts.length - 1)}` : '';
  return <div className={inline ? 'clock-notice' : 'clock-notice clock-notice-float'} dir={isRtl(lang) ? 'rtl' : 'ltr'}>
    <div className="clock-notice-text" role="alert"><BellRing size={20} aria-hidden="true" /><div><strong>{title}</strong><p dir="auto">{alarm ? alarm.label || label('alarmDefault') : label('timer')}{extra}</p></div></div>
    <div className="clock-actions">
      {alarm && <button type="button" onClick={() => { void send({ type: 'snooze', id: alert.id }); }}>{label('snooze')} {formatLocalizedNumber(lang, state.preferences.snooze)} {label('minShort')}</button>}
      <button type="button" className="clock-primary" onClick={() => { void send({ type: 'dismiss', id: alert.id }); }}>{label('dismiss')}</button>
    </div>
  </div>;
}

/** Mounted with the visitor shell, not the home tab. Listening continues when
 * the clock panel is closed or the visitor opens another section of the site. */
export function ClockToolsProvider({ lang, children }: { lang: SupportedLanguage; children: ReactNode }) {
  const [panel, setPanel] = useState<Panel | null>(null);
  const launcher = useRef<HTMLButtonElement | null>(null);
  const notify = (alert: ClockAlert, state: ClockToolsState) => {
    const label = clockT(lang);
    // Some mobile browsers expose the API but do not support this constructor.
    try {
      const notification = new Notification(label(alert.alarmId ? 'alarmRinging' : 'done'), {
        body: state.alarms.find((item) => item.id === alert.alarmId)?.label || label(alert.alarmId ? 'alarmDefault' : 'timer'),
        tag: `sham-clock:${alert.id}`, silent: true, lang,
      });
      notification.onclick = () => { window.focus(); notification.close(); };
    } catch { /* The on-site notice always works without browser permission. */ }
  };
  const controller = useClockTools(notify);
  const open = (next: Panel, button: HTMLButtonElement) => { launcher.current = button; setPanel(next); };
  const close = () => {
    setPanel(null);
    requestAnimationFrame(() => { if (launcher.current?.isConnected) launcher.current.focus({ preventScroll: true }); });
  };
  return <ClockToolsContext.Provider value={{ state: controller.state, open }}>
    {children}
    {panel ? <ClockToolsPanel controller={controller} lang={lang} {...panel} onSelect={(section) => setPanel({ ...panel, section })} onClose={close}
      notice={controller.state.alerts.length ? <ClockNotice controller={controller} lang={lang} inline /> : null} />
      : <ClockNotice controller={controller} lang={lang} inline={false} />}
  </ClockToolsContext.Provider>;
}

function TimerBadge({ timer, lang }: { timer: Countdown; lang: SupportedLanguage }) {
  const now = useDisplayTime(timer.status === 'running', 250);
  return <bdi className="clock-launcher-badge" dir="ltr" aria-hidden="true">{durationText(lang, timerRemaining(timer, now))}</bdi>;
}

export function ClockToolsLaunchers({ lang, timeZone }: { lang: SupportedLanguage; timeZone: string }) {
  const tools = useContext(ClockToolsContext);
  if (!tools) return null;
  const { state, open } = tools;
  const label = clockT(lang);
  const alarmCount = state.alarms.filter(alarmIsArmed).length;
  const timerActive = state.timer.status === 'running' || state.timer.status === 'paused';
  return <div className="clock-launchers" role="group" aria-label={label('tools')} dir={isRtl(lang) ? 'rtl' : 'ltr'}>
    {CLOCK_SECTIONS.map(({ id, Icon }) => <button key={id} type="button" aria-haspopup="dialog" aria-label={label(id)} onClick={(event) => open({ section: id, timeZone }, event.currentTarget)}>
      <Icon size={16} aria-hidden="true" /><span>{label(id)}</span>
      {id === 'alarms' && alarmCount > 0 && <span className="clock-launcher-badge" aria-hidden="true">{formatLocalizedNumber(lang, alarmCount)}</span>}
      {id === 'timer' && timerActive && <TimerBadge timer={state.timer} lang={lang} />}
      {id === 'stopwatch' && state.stopwatch.startedAt !== null && <span className="clock-launcher-dot" aria-hidden="true" />}
    </button>)}
  </div>;
}
