import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CLOCK_TOOLS_CLEARED, CLOCK_TOOLS_KEY, decodeClockTools, initialClockTools, isMissedClockAlert, nextClockDeadline, updateClockTools,
  type ClockAction, type ClockAlert, type ClockPreferences, type ClockToolsState,
} from '../../utils/clockTools';

const TONES = {
  chime: [659, 784, 988],
  pulse: [880, 880, 880],
  bell: [784, 523, 659],
} as const;

/** Short, local Web Audio cues; no sound file or network request is required. */
function createClockSound() {
  let context: AudioContext | undefined;
  let playing: (() => void) | undefined;
  const stop = () => { playing?.(); playing = undefined; };
  return {
    stop,
    async unlock(): Promise<boolean> {
      try {
        const Audio = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Audio) return false;
        context ??= new Audio();
        if (context.state !== 'running') await context.resume();
        return context.state === 'running';
      } catch { return false; }
    },
    play(prefs: ClockPreferences, test = false) {
      if (context?.state !== 'running' || !prefs.volume) return;
      stop();
      const ctx = context;
      const master = ctx.createGain();
      master.gain.value = (prefs.volume / 100) * 0.24;
      master.connect(ctx.destination);
      const notes: OscillatorNode[] = [];
      const kind = prefs.tone;
      const firstNote = ctx.currentTime + 0.04;
      for (let i = 0; i < (test ? 1 : 10); i++) {
        TONES[kind].forEach((frequency, j) => {
          const start = firstNote + i * 2.2 + j * 0.22;
          const voice = ctx.createOscillator();
          const envelope = ctx.createGain();
          voice.type = kind === 'pulse' ? 'triangle' : 'sine';
          voice.frequency.value = frequency;
          envelope.gain.setValueAtTime(0.001, start);
          envelope.gain.exponentialRampToValueAtTime(0.75, start + 0.022);
          envelope.gain.exponentialRampToValueAtTime(0.001, start + 0.34);
          voice.connect(envelope).connect(master);
          voice.start(start);
          voice.stop(start + 0.36);
          voice.onended = () => { voice.disconnect(); envelope.disconnect(); };
          notes.push(voice);
        });
      }
      const cancel = () => {
        master.disconnect();
        notes.forEach((note) => { try { note.stop(); } catch { /* Already ended. */ } });
      };
      playing = cancel;
      const last = notes.at(-1)!;
      const cleanLast = last.onended;
      last.onended = (event) => {
        cleanLast?.call(last, event);
        if (playing === cancel) { master.disconnect(); playing = undefined; }
      };
    },
    close() {
      stop();
      if (context) void context.close().catch(() => {});
      context = undefined;
    },
  };
}

interface Saved { raw: string | null; value: ClockToolsState }
function readSaved(previous?: Saved): Saved {
  try {
    const raw = localStorage.getItem(CLOCK_TOOLS_KEY);
    if (previous?.raw === raw) return previous;
    return { raw, value: decodeClockTools(raw) };
  } catch { return previous ?? { raw: null, value: decodeClockTools(null) }; }
}
const sameAlert = (a: ClockAlert, b: ClockAlert) => a.id === b.id && a.at === b.at;
const activatesSound = (action: ClockAction) => ['saveAlarm', 'toggleAlarm', 'snooze', 'startTimer', 'resumeTimer'].includes(action.type);
const hasNotifications = () => typeof Notification !== 'undefined' && window.isSecureContext;
export type NotificationState = NotificationPermission | 'unsupported';
export function clockNotificationState(): NotificationState {
  return hasNotifications() ? Notification.permission : 'unsupported';
}
export async function requestClockNotifications(): Promise<NotificationState> {
  try { return hasNotifications() ? await Notification.requestPermission() : 'unsupported'; }
  catch { return clockNotificationState(); }
}

export function useClockTools(notify: (alert: ClockAlert, state: ClockToolsState) => void) {
  const [initial] = useState(readSaved);
  const [state, setState] = useState(initial.value);
  const latest = useRef(initial);
  const [sound] = useState(createClockSound);
  const audioAlert = useRef<ClockAlert | null>(null);
  const mounted = useRef(false);
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  const send = useCallback((action: ClockAction): Promise<void> => {
    // Resume in the gesture itself (before waiting on any cross-tab lock).
    if (activatesSound(action)) void sound.unlock();
    const apply = () => {
      if (!mounted.current) return;
      const disk = readSaved(latest.current);
      const now = Date.now();
      const next = updateClockTools(disk.value, action, now);
      if (next === latest.current.value) return;
      let raw = disk.raw;
      if (next !== disk.value) {
        try {
          const serialized = JSON.stringify(next);
          localStorage.setItem(CLOCK_TOOLS_KEY, serialized);
          raw = serialized;
        } catch { /* Private-mode storage can be blocked. Tools still work in this tab. */ }
      }
      latest.current = { raw, value: next };
      setState(next);
      if (audioAlert.current && (!next.preferences.volume || !next.alerts.some((a) => sameAlert(a, audioAlert.current!)))) {
        sound.stop();
        audioAlert.current = null;
      }
      const due = next.alerts.filter((a) => !isMissedClockAlert(a, now) && !disk.value.alerts.some((b) => sameAlert(a, b)));
      if (due.length) {
        audioAlert.current = due[0];
        try { sound.play(next.preferences); } catch { /* Visual alert is independent of audio. */ }
        if (next.preferences.notifications && clockNotificationState() === 'granted' && document.hidden) notifyRef.current(due[0], next);
      }
    };
    // One active page claims a deadline; other open tabs receive the updated visual notice
    // through storage, but do not replay the ringtone. Fall back on browsers without locks.
    if (navigator.locks) return navigator.locks.request(CLOCK_TOOLS_KEY, apply).catch(apply);
    apply();
    return Promise.resolve();
  }, [sound]);

  useEffect(() => {
    mounted.current = true;
    const wake = () => { void send({ type: 'tick' }); };
    const storage = (event: StorageEvent) => { if (!event.key || event.key === CLOCK_TOOLS_KEY) wake(); };
    const clear = () => {
      const value = initialClockTools();
      latest.current = { raw: null, value };
      audioAlert.current = null;
      sound.stop();
      setState(value);
    };
    const unlock = () => {
      if (nextClockDeadline(latest.current.value) !== Infinity && latest.current.value.preferences.volume) void sound.unlock();
    };
    wake();
    window.addEventListener('pageshow', wake);
    window.addEventListener('focus', wake);
    window.addEventListener('storage', storage);
    window.addEventListener(CLOCK_TOOLS_CLEARED, clear);
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', wake);
    return () => {
      mounted.current = false;
      window.removeEventListener('pageshow', wake);
      window.removeEventListener('focus', wake);
      window.removeEventListener('storage', storage);
      window.removeEventListener(CLOCK_TOOLS_CLEARED, clear);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      document.removeEventListener('visibilitychange', wake);
      sound.close();
    };
  }, [send, sound]);

  useEffect(() => {
    let stopped = false;
    let handle: number | undefined;
    const schedule = () => {
      const at = nextClockDeadline(latest.current.value);
      if (stopped || !Number.isFinite(at)) return;
      // Sleep until a deadline, with a periodic checkpoint in case the device clock changes.
      handle = window.setTimeout(() => { void send({ type: 'tick' }).finally(schedule); }, Math.min(30_000, Math.max(16, at - Date.now())));
    };
    schedule();
    return () => { stopped = true; if (handle !== undefined) window.clearTimeout(handle); };
  }, [state.alarms, state.timer, send]);

  const testSound = async () => {
    try {
      const ok = await sound.unlock();
      if (ok && mounted.current) sound.play(latest.current.value.preferences, true);
      return ok;
    } catch { return false; }
  };
  return { state, send, testSound };
}

/** Repaint ONLY a visible running display, not the entire site or its stored state. */
export function useDisplayTime(active: boolean, rate: number): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, rate);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, [active, rate]);
  return active ? now : Date.now();
}
