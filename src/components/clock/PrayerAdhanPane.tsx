import { Bell, BellOff, BookOpen, CheckCircle2, ChevronDown, ExternalLink, FileAudio, Headphones, Landmark, Play, Trash2, Volume2, VolumeX } from 'lucide-react';
import { ADHAN_LISTENING_GROUPS } from '../../data/adhanListening';
import { ADHAN_RECORDINGS, type AdhanVariant } from '../../data/adhanVoices';
import type { SupportedLanguage } from '../../types/i18n';
import { loc } from '../../لغات/localize';
import { formatLocalizedNumber } from '../../لغات/numerals';
import { REMINDER_PRAYERS, type AdhanVoiceId, type PrayerPreferences, type ReminderMode, type VoiceChoice } from '../../utils/prayerConfig';
import { PRAYER_LABELS, prayerT } from './prayerText';
import type { useDeviceAdhan } from './useDeviceAdhan';
import type { usePrayerReminders } from './usePrayerReminders';

const variants = ['regular', 'fajr'] as const;
const modes = [{ name: 'off', Icon: BellOff }, { name: 'visual', Icon: Bell }, { name: 'audio', Icon: Volume2 }] as const;

function AdhanListeningLibrary({ lang }: { lang: SupportedLanguage }) {
  const label = prayerT(lang);
  return <details className="prayer-card prayer-details prayer-listening">
    <summary>
      <Headphones size={18} aria-hidden="true" />
      <span className="prayer-listening-title"><strong>{label('listenLibrary')}</strong><small>{label('listenOnly')}</small></span>
      <ChevronDown className="prayer-listening-chevron" size={16} aria-hidden="true" />
    </summary>
    <div className="prayer-details-body">
      <p className="prayer-help">{label('listenHelp')}</p>
      <div className="prayer-listening-grid">
        {ADHAN_LISTENING_GROUPS.map(({ id, title, links }) => {
          const Icon = id === 'reciters' ? BookOpen : Landmark;
          return <section className="prayer-listening-group" data-collection={id} key={id}>
            <h3><Icon size={15} aria-hidden="true" />{loc(lang, title)}</h3>
            <ul>{links.map((entry) => <li key={entry.url}>
              <a href={entry.url} target="_blank" rel="noopener noreferrer">
                <span>
                  <strong>{loc(lang, entry.title)}</strong>
                  <small><bdi>{loc(lang, entry.publisher)}</bdi>{entry.year && <> · <bdi>{formatLocalizedNumber(lang, entry.year, { grouping: false })}</bdi></>}</small>
                </span>
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            </li>)}</ul>
          </section>;
        })}
      </div>
    </div>
  </details>;
}

export function PrayerAdhanPane({ lang, prefs, update, canArm, hasPlace, hasSchedule, audio, recordings, onVoice, onPreview, onChoosePlace }: {
  lang: SupportedLanguage; prefs: PrayerPreferences; update: (delta: Partial<PrayerPreferences>) => void;
  canArm: boolean; hasPlace: boolean; hasSchedule: boolean; audio: ReturnType<typeof usePrayerReminders>; recordings: ReturnType<typeof useDeviceAdhan>;
  onVoice: (variant: AdhanVariant, choice: VoiceChoice) => void; onPreview: (variant: AdhanVariant) => void; onChoosePlace: () => void;
}) {
  const label = prayerT(lang);
  const { status } = audio;
  const canStop = status.state === 'playing' || status.state === 'loading';
  const changeMode = (next: ReminderMode) => { void audio.changeMode(next); };
  return <div className="prayer-pane">
    <AdhanListeningLibrary lang={lang} />
    <section className="prayer-card prayer-reminder-settings">
      <h3><Bell size={18} aria-hidden="true" />{label('reminders')}</h3>
      <p className="prayer-help">{label('reminderHelp')}</p>
      <div className="prayer-modes" role="group" aria-label={label('reminders')}>
        {modes.map(({ name, Icon }) => <button key={name} type="button" aria-pressed={audio.mode === name} disabled={name !== 'off' && (!canArm || !hasSchedule || audio.activation === 'waiting' || (name === 'audio' && recordings.loading))}
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
      <h3><Volume2 size={18} aria-hidden="true" />{label('reminderVoices')}</h3>
      <div className="prayer-voice-grid">
        {variants.map((variant) => {
          const title = label(variant === 'fajr' ? 'fajrVoice' : 'regularVoice');
          const builtin = variant === 'fajr' ? prefs.fajrVoice : prefs.regularVoice;
          const file = recordings.files[variant];
          const feedback = recordings.feedback[variant];
          const pending = feedback && 'pending' in feedback ? feedback.pending : undefined;
          const chooseFile = label(file ? 'replaceFile' : 'chooseAndSave');
          const busy = recordings.loading || Boolean(pending);
          return <div key={variant} className="prayer-voice" data-voice-variant={variant}>
            <label>{title}<select aria-label={title} disabled={busy} value={file?.selected ? 'device-file' : builtin} onChange={(event) => {
              const choice = event.currentTarget.value as VoiceChoice;
              if ((choice === 'device-file' && file) || Object.hasOwn(ADHAN_RECORDINGS[variant], choice)) onVoice(variant, choice);
            }}>
              {Object.entries(ADHAN_RECORDINGS[variant]).map(([id, voice]) => <option key={id} value={id}>{loc(lang, voice.title)}</option>)}
              {file && <option value="device-file">{label('deviceVoice')}</option>}
            </select></label>
            <button type="button" disabled={busy} onClick={() => onPreview(variant)}><Play size={15} aria-hidden="true" />{label(variant === 'fajr' ? 'previewFajr' : 'previewRegular')}</button>
            <label className="prayer-file" data-disabled={busy}><FileAudio size={15} aria-hidden="true" />{chooseFile}
              <input type="file" disabled={busy} aria-label={`${chooseFile} · ${title}`} accept="audio/mpeg,audio/mp4,audio/aac,audio/wav,.mp3,.m4a,.aac,.wav" onChange={(event) => {
                const picked = event.currentTarget.files?.[0];
                if (picked) void recordings.save(variant, picked);
                event.currentTarget.value = '';
              }} />
            </label>
            <p className="prayer-mode-status prayer-file-status" role="status">
              {pending ? label(pending === 'save' ? 'savingFile' : pending === 'remove' ? 'removingFile' : 'choosingFile')
                : feedback && 'removed' in feedback ? label('fileDeleted')
                : file && <><CheckCircle2 size={14} aria-hidden="true" /><span>{label('savedFile')} · <bdi title={file.name}>{file.name}</bdi></span></>}
            </p>
            {file && <button type="button" className="prayer-delete-file" aria-label={`${label('deleteFile')} · ${title}`} disabled={busy} onClick={() => { void recordings.remove(variant); }}>
              <Trash2 size={15} aria-hidden="true" />{label('deleteFile')}
            </button>}
            {feedback && 'issue' in feedback && <p className="prayer-warn" role="alert">{label(feedback.issue)}</p>}
          </div>;
        })}
      </div>
      {recordings.loading && <p className="prayer-help" role="status">{label('loadingFiles')}</p>}
      {recordings.readFailed && <p className="prayer-warn" role="alert">{label('loadFilesFailed')}</p>}
      <p className="prayer-help">{label('importNote')} {label('fileLimits')}</p>
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
  </div>;
}
