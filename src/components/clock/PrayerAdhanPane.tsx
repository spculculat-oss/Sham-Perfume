import { useState } from 'react';
import { Bell, BellOff, ExternalLink, Headphones, Play, Upload, Volume2, VolumeX } from 'lucide-react';
import { ADHAN_RECORDINGS, FAMOUS_ADHAN_LINKS, validAdhanFile, type AdhanVariant } from '../../data/adhanVoices';
import type { SupportedLanguage } from '../../types/i18n';
import { loc } from '../../لغات/localize';
import { REMINDER_PRAYERS, type AdhanVoiceId, type PrayerPreferences, type ReminderMode } from '../../utils/prayerConfig';
import { PRAYER_LABELS, prayerT } from './prayerText';
import type { usePrayerReminders } from './usePrayerReminders';

export type LocalRecordings = Partial<Record<AdhanVariant, File>>;
const variants = ['regular', 'fajr'] as const;
const modes = [{ name: 'off', Icon: BellOff }, { name: 'visual', Icon: Bell }, { name: 'audio', Icon: Volume2 }] as const;

export function PrayerAdhanPane({ lang, prefs, update, canArm, hasPlace, hasSchedule, audio, files, onFile, onPreview, onChoosePlace }: {
  lang: SupportedLanguage; prefs: PrayerPreferences; update: (delta: Partial<PrayerPreferences>) => void;
  canArm: boolean; hasPlace: boolean; hasSchedule: boolean; audio: ReturnType<typeof usePrayerReminders>; files: LocalRecordings;
  onFile: (variant: AdhanVariant, file?: File) => void; onPreview: (variant: AdhanVariant) => void; onChoosePlace: () => void;
}) {
  const label = prayerT(lang);
  const [fileError, setFileError] = useState<AdhanVariant>();
  const chooseFile = (variant: AdhanVariant, file?: File) => {
    if (!file) return;
    if (!validAdhanFile(file)) { setFileError(variant); return; }
    setFileError(undefined);
    onFile(variant, file);
  };
  const pickVoice = (variant: AdhanVariant, id: string) => {
    if (id === 'device-file' || !Object.hasOwn(ADHAN_RECORDINGS[variant], id)) return;
    onFile(variant, undefined);
    setFileError(undefined);
    update(variant === 'fajr' ? { fajrVoice: id as PrayerPreferences['fajrVoice'] } : { regularVoice: id as PrayerPreferences['regularVoice'] });
  };
  const { status } = audio;
  const canStop = status.state === 'playing' || status.state === 'loading';
  const changeMode = (next: ReminderMode) => { void audio.changeMode(next); };
  return <div className="prayer-pane">
    <section className="prayer-card prayer-reminder-settings">
      <h3><Bell size={18} aria-hidden="true" />{label('reminders')}</h3>
      <p className="prayer-help">{label('reminderHelp')}</p>
      <div className="prayer-modes" role="group" aria-label={label('reminders')}>
        {modes.map(({ name, Icon }) => <button key={name} type="button" aria-pressed={audio.mode === name} disabled={name !== 'off' && (!canArm || !hasSchedule || audio.activation === 'waiting')}
          onClick={() => changeMode(name)}><Icon size={17} aria-hidden="true" />{label(name)}</button>)}
      </div>
      <p className="prayer-mode-status" data-testid="prayer-reminder-state" data-mode={audio.mode} role="status">{label(audio.activation === 'waiting' ? 'activateWaiting' : audio.mode === 'audio' ? 'enabledAudio' : audio.mode === 'visual' ? 'enabledVisual' : 'muted')}</p>
      {audio.activation === 'blocked' && <p className="prayer-warn" role="alert">{label('activationBlocked')}</p>}
      {!hasPlace && <div className="prayer-actions"><p className="prayer-help">{label('confirmPlace')}</p><button type="button" onClick={onChoosePlace}>{label('locationSettings')}</button></div>}
      {hasPlace && !hasSchedule && <p className="prayer-help">{label('scheduleUnavailable')}</p>}
      {!prefs.prayers.length && <p className="prayer-help">{label('confirmPrayer')}</p>}
      <fieldset className="prayer-checks">
        <legend>{label('whichPrayers')}</legend>
        <div>{REMINDER_PRAYERS.map((name) => <label key={name}>
          <input type="checkbox" checked={prefs.prayers.includes(name)} onChange={(event) => update({ prayers: REMINDER_PRAYERS.filter((p) => p === name ? event.target.checked : prefs.prayers.includes(p)) })} />{loc(lang, PRAYER_LABELS[name])}
        </label>)}</div>
      </fieldset>
    </section>
    <section className="prayer-card prayer-voices">
      <h3><Headphones size={18} aria-hidden="true" />{label('adhan')}</h3>
      <div className="prayer-voice-grid">
        {variants.map((variant) => {
          const title = label(variant === 'fajr' ? 'fajrVoice' : 'regularVoice');
          const builtin = variant === 'fajr' ? prefs.fajrVoice : prefs.regularVoice;
          const file = files[variant];
          return <div key={variant} className="prayer-voice">
            <label>{title}<select aria-label={title} value={file ? 'device-file' : builtin} onChange={(event) => pickVoice(variant, event.target.value)}>
              {Object.entries(ADHAN_RECORDINGS[variant]).map(([id, voice]) => <option key={id} value={id}>{loc(lang, voice.title)}</option>)}
              {file && <option value="device-file">{label('deviceVoice')} · {file.name.slice(0, 64)}</option>}
            </select></label>
            <button type="button" onClick={() => onPreview(variant)}><Play size={15} aria-hidden="true" />{label(variant === 'fajr' ? 'previewFajr' : 'previewRegular')}</button>
            <label className="prayer-file"><Upload size={15} aria-hidden="true" />{label('deviceVoice')}<input type="file" aria-label={`${label('deviceVoice')} · ${title}`} accept="audio/mpeg,audio/mp4,audio/aac,audio/wav,.mp3,.m4a,.aac,.wav" onChange={(event) => {
              chooseFile(variant, event.target.files?.[0]);
              event.target.value = '';
            }} /></label>
            {fileError === variant && <p className="prayer-warn" role="alert">{label('invalidFile')}</p>}
          </div>;
        })}
      </div>
      <p className="prayer-help">{label('importNote')}</p>
      {canStop && <div className="prayer-actions"><button type="button" onClick={() => audio.stop()}><VolumeX size={16} aria-hidden="true" />{label('stop')}</button></div>}
      {status.state !== 'idle' && <p className={status.state === 'blocked' || status.state === 'error' ? 'prayer-warn' : 'prayer-mode-status'} role="status" data-testid="adhan-playback" data-state={status.state}>
        {label(status.state === 'playing' ? 'playing' : status.state === 'loading' ? 'fetchingAudio' : status.state === 'blocked' ? 'activationBlocked' : 'playbackError')} · <bdi>{status.name}</bdi>
      </p>}
      <details className="prayer-credit"><summary>{label('recordingSources')}</summary><ul>
        {variants.flatMap((variant) => Object.keys(ADHAN_RECORDINGS[variant]).map((id) => {
          const recording = ADHAN_RECORDINGS[variant][id as AdhanVoiceId]!;
          return <li key={`${id}:${variant}`}><a href={recording.source} target="_blank" rel="noreferrer">{recording.credit}</a> · <a href={recording.licenseUrl} target="_blank" rel="noreferrer">{recording.license}</a></li>;
        }))}
      </ul></details>
    </section>
    <details className="prayer-card prayer-details prayer-famous">
      <summary><Headphones size={16} aria-hidden="true" /><strong>{label('famous')}</strong><ExternalLink size={14} aria-hidden="true" /></summary>
      <div className="prayer-details-body"><p className="prayer-help">{label('famousNote')}</p><ul>
        {FAMOUS_ADHAN_LINKS.map((item) => <li key={item.url}><a href={item.url} target="_blank" rel="noreferrer">{loc(lang, item.title)} <ExternalLink size={13} aria-hidden="true" /></a><small>{item.publisher}</small></li>)}
      </ul></div>
    </details>
  </div>;
}
