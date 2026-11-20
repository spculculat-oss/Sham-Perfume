import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PRAYER_CLAIM_KEY, PRAYER_CLEARED, type ReminderMode, type ReminderPrayer } from '../../utils/prayerConfig';
import { duePrayer, PRAYER_REMINDER_GRACE_MS, type PrayerEvent } from '../../utils/prayerTimes';
import { useAdhanAudio, type AdhanTrack } from './useAdhanAudio';

export interface PrayerNotice { event: PrayerEvent; place: string; mode: Exclude<ReminderMode, 'off'> }

/** Web Locks serialize competing tabs; storage retains only one short deduplication marker. */
function claim(event: PrayerEvent, now: number): boolean {
  const key = `${event.day}:${event.prayer}`;
  try {
    const raw = localStorage.getItem(PRAYER_CLAIM_KEY);
    if (raw) {
      const [said, expires] = raw.split('|');
      if (said === key && Number(expires) >= now && Number(expires) <= now + 2 * PRAYER_REMINDER_GRACE_MS) return false;
    }
    localStorage.setItem(PRAYER_CLAIM_KEY, `${key}|${event.at + PRAYER_REMINDER_GRACE_MS}`);
  } catch { /* Per-page protection still works in private browsing. */ }
  return true;
}

export function usePrayerReminders({ now, events, selected, canArm, fingerprint, placeName, trackFor, mode, setMode }: {
  now: number; events: readonly PrayerEvent[]; selected: readonly ReminderPrayer[]; canArm: boolean;
  fingerprint: string; placeName: string; trackFor: (prayer: ReminderPrayer) => AdhanTrack | undefined;
  mode: ReminderMode; setMode: (mode: ReminderMode) => void;
}) {
  const [activation, setActivation] = useState<'idle' | 'waiting' | 'blocked'>('idle');
  const [notice, setNotice] = useState<PrayerNotice | null>(null);
  const cursor = useRef({ mode: 'off' as ReminderMode, checked: 0, version: 0 });
  const delivered = useRef(new Set<string>());
  const { status, unlock, play, stop } = useAdhanAudio();
  const dismiss = useCallback(() => { stop('reminder'); setNotice(null); }, [stop]);

  const disarm = useCallback(() => {
    cursor.current = { mode: 'off', checked: Date.now(), version: cursor.current.version + 1 };
    setMode('off'); setActivation('idle'); setNotice(null); stop();
  }, [stop, setMode]);

  useLayoutEffect(() => {
    // A changed setting or place must not play an event belonging to the old table.
    cursor.current.checked = Date.now();
    cursor.current.version += 1;
    setNotice(null); setActivation('idle'); stop();
    if (!canArm) disarm();
    // The fingerprint includes the location/method and selected prayers/recordings.
  }, [canArm, fingerprint, stop, disarm]);

  const changeMode = async (next: ReminderMode) => {
    disarm();
    if (!canArm || next === 'off') return;
    const version = cursor.current.version;
    if (next === 'audio') {
      setActivation('waiting');
      const ready = await unlock();
      if (version !== cursor.current.version) return;
      if (!ready) { setActivation('blocked'); return; }
    }
    setActivation('idle');
    cursor.current = { mode: next, checked: Date.now(), version };
    setMode(next);
  };

  useEffect(() => {
    if (!canArm || cursor.current.mode === 'off') return;
    const scheduledMode = cursor.current.mode;
    const version = cursor.current.version;
    // Discard stale React ticks written before activation or before a configuration change.
    if (Math.abs(now - Date.now()) > 2_000 || (now < cursor.current.checked && cursor.current.checked - now <= 2_000)) return;
    const event = duePrayer(events, selected, cursor.current.checked, now);
    cursor.current.checked = now;
    if (!event) return;
    const id = `${event.day}:${event.prayer}`;
    if (delivered.current.has(id)) return;
    delivered.current.add(id);
    if (delivered.current.size > 20) delivered.current.delete(delivered.current.values().next().value!);
    const ring = () => {
      const time = Date.now();
      if (version !== cursor.current.version || time < event.at || time - event.at > PRAYER_REMINDER_GRACE_MS || (scheduledMode === 'audio' && !claim(event, time))) return;
      setNotice({ event, place: placeName, mode: scheduledMode });
      if (scheduledMode === 'audio') {
        const track = trackFor(event.prayer);
        if (track) void play(track, 'reminder');
      }
    };
    if (scheduledMode === 'audio' && navigator.locks?.request) void navigator.locks.request(PRAYER_CLAIM_KEY, ring).catch(ring);
    else ring();
  }, [now, events, canArm, selected, placeName, trackFor, play]);

  useEffect(() => {
    if (!notice) return;
    const age = now - notice.event.at;
    if (age > 8 * 60_000 || (age > 100_000 && !(status.state === 'playing' && status.kind === 'reminder'))) dismiss();
  }, [now, notice, status, dismiss]);

  useEffect(() => {
    window.addEventListener('pagehide', disarm);
    window.addEventListener(PRAYER_CLEARED, disarm);
    return () => {
      cursor.current.version += 1;
      window.removeEventListener('pagehide', disarm);
      window.removeEventListener(PRAYER_CLEARED, disarm);
    };
  }, [disarm]);
  return { mode, notice, activation, changeMode, disarm, dismiss, status, play, stop };
}
