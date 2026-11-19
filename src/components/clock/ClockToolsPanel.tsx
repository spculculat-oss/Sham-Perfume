import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { AlarmClock, Bell, Check, ChevronDown, Flag, Pause, Pencil, Play, Plus, RotateCcw, Settings2, Timer, TimerReset, Trash2, Volume2, X } from 'lucide-react';
import { LocalizedNumberInput } from '../LocalizedNumberInput';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../../types/i18n';
import { formatLocalizedNumber } from '../../لغات/numerals';
import {
  alarmIsArmed, alarmLocalTime, CLOCK_TONES, MAX_ALARMS, MAX_LAPS, MAX_TIMER_MS, SNOOZE_MINUTES, stopwatchElapsed, timerRemaining,
  type AlarmSchedule, type ClockAlarm, type ClockSection,
} from '../../utils/clockTools';
import { alarmTimeText, CLOCK_DAYS, clockLocale, clockT, durationText, type ClockT } from './clockText';
import { clockNotificationState, requestClockNotifications, useDisplayTime, type useClockTools } from './useClockTools';

export const CLOCK_SECTIONS = [
  { id: 'alarms', Icon: Bell }, { id: 'timer', Icon: Timer }, { id: 'stopwatch', Icon: TimerReset },
] as const;
export type ClockToolsController = ReturnType<typeof useClockTools>;
type ToolProps = ClockToolsController & { lang: SupportedLanguage; label: ClockT };
const splitDuration = (ms: number) => [Math.floor(ms / 3_600_000), Math.floor(ms / 60_000) % 60, Math.floor(ms / 1000) % 60];
const validInt = (value: number, max: number) => Number.isInteger(value) && value >= 0 && value <= max;
const localized = (lang: SupportedLanguage, n: number) => formatLocalizedNumber(lang, n, { grouping: false });
const allDays = CLOCK_DAYS.map((_, n) => n);

function ToolNumber({ lang, value, onValue, label, max }: {
  lang: SupportedLanguage; value: number; onValue: (value: number) => void; label: string; max: number;
}) {
  return <label className="clock-number-field">
    <span>{label}</span>
    <LocalizedNumberInput lang={lang} integer value={value} onValue={onValue} min={0} max={max} dir="ltr" />
  </label>;
}

function AlarmEditor({ lang, label, alarm, timeZone, onSave, onCancel }: Pick<ToolProps, 'lang' | 'label'> & {
  alarm?: ClockAlarm; timeZone: string; onSave: (schedule: AlarmSchedule) => void; onCancel: () => void;
}) {
  const [draft, setDraft] = useState<AlarmSchedule>(() => alarm ?? { ...alarmLocalTime(Date.now() + 60_000, timeZone), days: [], label: '', timeZone });
  const [error, setError] = useState(false);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!validInt(draft.hour, 23) || !validInt(draft.minute, 59)) { setError(true); return; }
    onSave(draft);
  };
  return <form className="clock-alarm-editor" onSubmit={submit}>
    <div className="clock-editor-heading"><h3>{label(alarm ? 'edit' : 'addAlarm')}</h3><bdi className="clock-zone" dir="ltr">{draft.timeZone}</bdi></div>
    <div className="clock-time-fields" role="group" aria-label={label('alarms')}>
      <ToolNumber lang={lang} label={label('alarmHour')} value={draft.hour} onValue={(hour) => { setDraft({ ...draft, hour }); setError(false); }} max={23} />
      <ToolNumber lang={lang} label={label('alarmMinute')} value={draft.minute} onValue={(minute) => { setDraft({ ...draft, minute }); setError(false); }} max={59} />
    </div>
    <label className="clock-labeled-field">{label('alarmName')}<input type="text" dir="auto" maxLength={48} placeholder={label('alarmPlaceholder')} value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} /></label>
    <fieldset className="clock-repeat">
      <legend>{label('repeating')}</legend>
      <div className="clock-options">
        <button type="button" aria-pressed={!draft.days.length} onClick={() => setDraft({ ...draft, days: [] })}>{label('once')}</button>
        <button type="button" aria-pressed={draft.days.length === 7} onClick={() => setDraft({ ...draft, days: allDays })}>{label('daily')}</button>
      </div>
      <div className="clock-options">
        {CLOCK_DAYS.map((day, n) => <button key={day} type="button" aria-pressed={draft.days.includes(n)} onClick={() => setDraft({ ...draft, days: draft.days.includes(n) ? draft.days.filter((d) => d !== n) : [...draft.days, n] })}>{label(day)}</button>)}
      </div>
    </fieldset>
    <p className="clock-help">{label('wallHint')}</p>
    {error && <p className="clock-error" role="alert">{label('invalidAlarm')}</p>}
    <div className="clock-actions">
      <button type="submit" className="clock-primary"><Check size={16} aria-hidden="true" />{label('save')}</button>
      <button type="button" onClick={onCancel}>{label('cancel')}</button>
    </div>
  </form>;
}

function AlarmRow({ alarm, lang, label, onEdit, send }: Pick<ToolProps, 'lang' | 'label' | 'send'> & { alarm: ClockAlarm; onEdit: () => void }) {
  const armed = alarmIsArmed(alarm);
  const name = alarm.label || label('alarmDefault');
  const repeat = alarm.days.length === 7 ? label('daily') : alarm.days.length ? alarm.days.map((d) => label(CLOCK_DAYS[d])).join(' · ') : label('once');
  const upcoming = Math.min(alarm.nextAt ?? Infinity, alarm.snoozedUntil ?? Infinity);
  const { locale, numberingSystem } = clockLocale(lang);
  const next = armed ? new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: alarm.timeZone, numberingSystem }).format(upcoming) : '';
  return <li className="clock-alarm-row" data-alarm-armed={armed}>
    <div className="clock-alarm-summary">
      <div><bdi className="clock-alarm-time" dir="ltr">{alarmTimeText(lang, alarm.hour, alarm.minute)}</bdi> <strong dir="auto">{name}</strong></div>
      <span>{repeat} · <bdi dir="ltr">{alarm.timeZone}</bdi></span>
      <span>{armed ? <>{label(upcoming === alarm.snoozedUntil ? 'snoozed' : 'next')} <time dateTime={new Date(upcoming).toISOString()}>{next}</time></> : label('alarmOff')}</span>
    </div>
    <div className="clock-alarm-buttons">
      <button type="button" className="clock-switch" role="switch" aria-checked={armed} aria-label={`${name} · ${label('alarms')}`} title={label(armed ? 'disable' : 'enable')} onClick={() => { void send({ type: 'toggleAlarm', id: alarm.id }); }}><span /></button>
      <button type="button" title={label('edit')} aria-label={`${label('edit')} · ${name}`} onClick={onEdit}><Pencil size={15} aria-hidden="true" /></button>
      <button type="button" title={label('delete')} aria-label={`${label('delete')} · ${name}`} onClick={() => { void send({ type: 'deleteAlarm', id: alarm.id }); }}><Trash2 size={15} aria-hidden="true" /></button>
    </div>
  </li>;
}

function AlarmsPanel({ lang, label, state, send, timeZone }: ToolProps & { timeZone: string }) {
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const alarm = state.alarms.find((a) => a.id === editing);
  const adding = editing === 'new';
  const full = state.alarms.length >= MAX_ALARMS;
  const endEdit = () => { setEditing(null); requestAnimationFrame(() => addRef.current?.focus()); };
  if (adding || alarm) return <AlarmEditor key={editing} lang={lang} label={label} alarm={alarm} timeZone={timeZone} onCancel={endEdit} onSave={(schedule) => {
    const id = alarm?.id ?? (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
    void send({ type: 'saveAlarm', id, schedule });
    endEdit();
  }} />;
  return <div className="clock-panel">
    <div className="clock-panel-heading">
      <bdi dir="ltr" className="clock-zone">{timeZone}</bdi>
      <button ref={addRef} className="clock-primary" type="button" disabled={full} onClick={() => setEditing('new')}><Plus size={16} aria-hidden="true" />{label('addAlarm')}</button>
    </div>
    {state.alarms.length ? <ul className="clock-alarm-list">
      {state.alarms.map((a) => <AlarmRow key={a.id} alarm={a} lang={lang} label={label} send={send} onEdit={() => setEditing(a.id)} />)}
    </ul> : <div className="clock-tool-empty"><Bell size={21} aria-hidden="true" /><p>{label('noAlarms')}</p></div>}
    {full && <p className="clock-help">{label('alarmLimit')}</p>}
  </div>;
}

function ClockReadout({ status, text, active, children }: { status: string; text: string; active: boolean; children?: ReactNode }) {
  return <div className="clock-readout" data-running={active}>
    <span className="clock-readout-state"><i aria-hidden="true" />{status}</span>
    <bdi className="clock-readout-digits" dir="ltr" aria-live="off">{text}</bdi>
    {children}
  </div>;
}

function TimerPanel({ lang, label, state: { timer }, send }: ToolProps) {
  const [draft, setDraft] = useState(() => splitDuration(timer.durationMs));
  const [error, setError] = useState(false);
  const running = timer.status === 'running';
  const paused = timer.status === 'paused';
  const editable = !running && !paused;
  const now = useDisplayTime(running, 125);
  const duration = (draft[0] * 3600 + draft[1] * 60 + draft[2]) * 1000;
  const valid = draft.every((value, i) => validInt(value, i ? 59 : 23)) && duration > 0 && duration <= MAX_TIMER_MS;
  const remaining = timerRemaining(timer, now);
  const display = timer.status === 'ready' ? (valid ? duration : 0) : remaining;
  const start = (event: FormEvent) => {
    event.preventDefault();
    if (!editable) return;
    if (!valid) { setError(true); return; }
    setError(false);
    void send({ type: 'startTimer', durationMs: duration });
  };
  return <form className="clock-panel" onSubmit={start}>
    <ClockReadout text={durationText(lang, display)} status={label(timer.status)} active={running}>
      {(running || paused) && <progress value={remaining} max={timer.durationMs} aria-label={label('timer')} />}
    </ClockReadout>
    {editable && <>
      <div className="clock-options" role="group" aria-label={label('presets')}>
        {[1, 5, 10, 25].map((value) => <button key={value} type="button" aria-pressed={duration === value * 60_000} onClick={() => { setDraft([0, value, 0]); setError(false); }}>{localized(lang, value)} {label('minShort')}</button>)}
      </div>
      <div className="clock-time-fields" role="group" aria-label={label('timer')}>
        {(['hours', 'minutes', 'seconds'] as const).map((key, i) => <ToolNumber key={key} lang={lang} label={label(key)} max={i ? 59 : 23} value={draft[i]} onValue={(value) => { setDraft(draft.map((old, j) => i === j ? value : old)); setError(false); }} />)}
      </div>
    </>}
    {error && <p className="clock-error" role="alert">{label('invalidTimer')}</p>}
    <div className="clock-actions">
      {running ? <button type="button" className="clock-primary" onClick={() => { void send({ type: 'pauseTimer' }); }}><Pause size={16} aria-hidden="true" />{label('pause')}</button>
        : paused ? <button type="button" className="clock-primary" onClick={() => { void send({ type: 'resumeTimer' }); }}><Play size={16} aria-hidden="true" />{label('resume')}</button>
          : <button type="submit" className="clock-primary"><Play size={16} aria-hidden="true" />{label('start')}</button>}
      <button type="button" onClick={() => { setDraft(splitDuration(timer.durationMs)); setError(false); void send({ type: 'resetTimer' }); }}><RotateCcw size={16} aria-hidden="true" />{label('reset')}</button>
    </div>
  </form>;
}

function StopwatchPanel({ lang, label, state: { stopwatch }, send }: ToolProps) {
  const running = stopwatch.startedAt !== null;
  const now = useDisplayTime(running, 90);
  const elapsed = stopwatchElapsed(stopwatch, now);
  return <div className="clock-panel">
    <ClockReadout text={durationText(lang, elapsed, true)} status={label(running ? 'running' : elapsed ? 'paused' : 'ready')} active={running} />
    <div className="clock-actions">
      <button type="button" className="clock-primary" onClick={() => { void send({ type: running ? 'pauseWatch' : 'startWatch' }); }}>{running ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}{label(running ? 'pause' : elapsed ? 'resume' : 'start')}</button>
      <button type="button" disabled={!running || stopwatch.laps.length >= MAX_LAPS} onClick={() => { void send({ type: 'lap' }); }}><Flag size={16} aria-hidden="true" />{label('lap')}</button>
      <button type="button" onClick={() => { void send({ type: 'resetWatch' }); }}><RotateCcw size={16} aria-hidden="true" />{label('reset')}</button>
    </div>
    {!!stopwatch.laps.length && <table className="clock-laps">
      <thead><tr><th scope="col">{label('lapCount')}</th><th scope="col">{label('split')}</th><th scope="col">{label('total')}</th></tr></thead>
      <tbody>{stopwatch.laps.map((total, i, laps) => <tr key={i}>
        <td>{localized(lang, i + 1)}</td>
        <td><bdi dir="ltr">{durationText(lang, total - (laps[i - 1] ?? 0), true)}</bdi></td>
        <td><bdi dir="ltr">{durationText(lang, total, true)}</bdi></td>
      </tr>).reverse()}</tbody>
    </table>}
  </div>;
}

function SoundSettings({ state, send, testSound, lang, label }: ToolProps) {
  const [tested, setTested] = useState<boolean>();
  const [permission, setPermission] = useState(clockNotificationState);
  const prefs = state.preferences;
  const notifications = prefs.notifications && permission === 'granted';
  const { locale, numberingSystem } = clockLocale(lang);
  const volumeText = new Intl.NumberFormat(locale, { numberingSystem, style: 'percent', maximumFractionDigits: 0 }).format(prefs.volume / 100);
  return <details className="clock-settings">
    <summary><Settings2 size={16} aria-hidden="true" /><span>{label('soundSettings')}</span><ChevronDown size={16} aria-hidden="true" /></summary>
    <div className="clock-settings-body">
      <div className="clock-settings-grid">
        <label className="clock-labeled-field">{label('tone')}<select value={prefs.tone} onChange={(event) => {
          const tone = CLOCK_TONES.find((item) => item === event.target.value);
          if (tone) void send({ type: 'preferences', patch: { tone } });
        }}>{CLOCK_TONES.map((tone) => <option key={tone} value={tone}>{label(tone)}</option>)}</select></label>
        <label className="clock-labeled-field">{label('snooze')}<select value={prefs.snooze} onChange={(event) => {
          const snooze = SNOOZE_MINUTES.find((value) => String(value) === event.target.value);
          if (snooze) void send({ type: 'preferences', patch: { snooze } });
        }}>{SNOOZE_MINUTES.map((value) => <option key={value} value={value}>{localized(lang, value)} {label('minShort')}</option>)}</select></label>
      </div>
      <label className="clock-labeled-field">{label('volume')} · {volumeText}<input type="range" min="0" max="100" step="5" value={prefs.volume} onChange={(event) => { void send({ type: 'preferences', patch: { volume: Number(event.target.value) } }); }} /></label>
      <div className="clock-actions">
        <button type="button" disabled={prefs.volume === 0} onClick={async () => setTested(await testSound())}><Volume2 size={16} aria-hidden="true" />{label('testSound')}</button>
        <button type="button" disabled={permission === 'unsupported' || permission === 'denied'} aria-pressed={notifications} onClick={async () => {
          if (notifications) { void send({ type: 'preferences', patch: { notifications: false } }); return; }
          const result = await requestClockNotifications();
          setPermission(result);
          void send({ type: 'preferences', patch: { notifications: result === 'granted' } });
        }}><Bell size={16} aria-hidden="true" />{label(notifications ? 'disableNotifications' : 'enableNotifications')}</button>
      </div>
      {tested !== undefined && <p className="clock-help" role="status">{label(tested ? 'soundOk' : 'soundBlocked')}</p>}
      <p className="clock-help">{label(permission === 'denied' || permission === 'unsupported' ? 'notificationBlocked' : 'notificationHint')}</p>
    </div>
  </details>;
}

export function ClockToolsPanel({ controller, lang, section, timeZone, onSelect, onClose, notice }: {
  controller: ClockToolsController; lang: SupportedLanguage; section: ClockSection; timeZone: string;
  onSelect: (section: ClockSection) => void; onClose: () => void; notice?: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const label = clockT(lang);
  const rtl = SUPPORTED_LANGUAGES.find((item) => item.code === lang)?.dir === 'rtl';
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (typeof element.showModal === 'function') {
      if (!element.open) element.showModal();
      return () => { if (element.open) element.close(); };
    }
    element.setAttribute('open', '');
  }, []);
  const props = { ...controller, lang, label };
  return <dialog id="clock-tools-dialog" ref={dialog} className="clock-tools-dialog" dir={rtl ? 'rtl' : 'ltr'} aria-labelledby="clock-tools-title" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <header className="clock-tools-header">
      <div className="clock-tools-brand"><span className="clock-tools-emblem"><AlarmClock size={22} aria-hidden="true" /></span><h2 id="clock-tools-title">{label('tools')}</h2></div>
      <button type="button" className="clock-tools-close" aria-label={label('close')} autoFocus onClick={onClose}><X size={19} aria-hidden="true" /></button>
    </header>
    <div className="clock-tool-tabs" role="group" aria-label={label('tools')}>
      {CLOCK_SECTIONS.map(({ id, Icon }) => <button type="button" key={id} aria-pressed={id === section} onClick={() => onSelect(id)}><Icon size={16} aria-hidden="true" />{label(id)}</button>)}
    </div>
    {notice && <div className="clock-dialog-notice">{notice}</div>}
    <div className="clock-tools-content">
      {section === 'alarms' ? <AlarmsPanel {...props} timeZone={timeZone} /> : section === 'timer' ? <TimerPanel {...props} /> : <StopwatchPanel {...props} />}
      <SoundSettings {...props} />
      <p className="clock-help clock-keep-open">{label('keepOpen')}</p>
    </div>
  </dialog>;
}
