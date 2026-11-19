// This is browser-local state. Deadlines, not interval tick counts, are persisted so
// a throttled tab, an in-site navigation, or a reload cannot reset a running tool.
export const CLOCK_TOOLS_KEY = 'sham_clock_tools_v1';
export const CLOCK_TOOLS_CLEARED = 'sham-clock-tools-cleared';
export const MAX_ALARMS = 20;
export const MAX_LAPS = 50;
export const MAX_TIMER_MS = (24 * 60 * 60 - 1) * 1000;
export const RING_GRACE_MS = 2 * 60_000;
export const SNOOZE_MINUTES = [5, 10, 15] as const;
export const CLOCK_TONES = ['chime', 'pulse', 'bell'] as const;
export type ClockTone = typeof CLOCK_TONES[number];
export type ClockSection = 'alarms' | 'timer' | 'stopwatch';
export type SnoozeMinutes = typeof SNOOZE_MINUTES[number];

export interface AlarmSchedule {
  hour: number;
  minute: number;
  days: number[]; // JavaScript weekday numbers; no days means a one-time alarm.
  timeZone: string;
  label: string;
}
export interface ClockAlarm extends AlarmSchedule {
  id: string;
  nextAt: number | null;
  snoozedUntil: number | null;
}
export type Countdown = { durationMs: number } & (
  { status: 'ready' | 'done' } | { status: 'running'; endAt: number } | { status: 'paused'; remainingMs: number }
);
export interface Stopwatch { startedAt: number | null; elapsedMs: number; laps: number[] }
export interface ClockAlert { id: string; alarmId?: string; at: number }
export interface ClockPreferences { tone: ClockTone; volume: number; snooze: SnoozeMinutes; notifications: boolean }
export interface ClockToolsState {
  alarms: ClockAlarm[];
  timer: Countdown;
  stopwatch: Stopwatch;
  alerts: ClockAlert[];
  preferences: ClockPreferences;
}
export const initialClockTools = (): ClockToolsState => ({
  alarms: [], timer: { status: 'ready', durationMs: 5 * 60_000 },
  stopwatch: { startedAt: null, elapsedMs: 0, laps: [] }, alerts: [],
  preferences: { tone: 'chime', volume: 65, snooze: 5, notifications: false },
});

const DAY = 86_400_000;
const MINUTE = 60_000;
const MAX_EPOCH = 8.64e15 - 32 * DAY; // stay inside Date's representable range
const integer = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
const epoch = (v: unknown): v is number => integer(v, 0, MAX_EPOCH);
const validId = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9-]{1,64}$/i.test(v);
const record = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const tone = (v: unknown): v is ClockTone => CLOCK_TONES.some((t) => t === v);
const snooze = (v: unknown): v is SnoozeMinutes => SNOOZE_MINUTES.some((m) => m === v);

const wallFormats = new Map<string, Intl.DateTimeFormat>();
function wallFormat(zone: string): Intl.DateTimeFormat {
  const cached = wallFormats.get(zone);
  if (cached) return cached;
  const format = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone, calendar: 'gregory', numberingSystem: 'latn', hourCycle: 'h23',
    year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
  });
  if (wallFormats.size >= 32) wallFormats.clear();
  wallFormats.set(zone, format);
  return format;
}
function validZone(v: unknown): v is string {
  if (typeof v !== 'string' || v.length < 1 || v.length > 80) return false;
  try { wallFormat(v); return true; } catch { return false; }
}
function wallParts(at: number, zone: string) {
  const fields = Object.fromEntries(wallFormat(zone).formatToParts(at).map(({ type, value }) => [type, Number(value)]));
  return { midnight: Date.UTC(fields.year, fields.month - 1, fields.day), hour: fields.hour, minute: fields.minute };
}
export function alarmLocalTime(at: number, zone: string): Pick<AlarmSchedule, 'hour' | 'minute'> {
  const { hour, minute } = wallParts(at, zone);
  return { hour, minute };
}

/** Resolve the selected civil time in its saved zone. Skip a DST gap, and on a
 * fall-back day use only the first occurrence of a repeated wall-clock minute. */
export function nextAlarmAt(schedule: AlarmSchedule, after: number): number | null {
  const { hour, minute, days, timeZone } = schedule;
  const { midnight } = wallParts(after, timeZone);
  for (let plus = 0; plus <= 14; plus++) {
    const day = midnight + plus * DAY;
    if (days.length && !days.includes(new Date(day).getUTCDay())) continue;
    const target = day + (hour * 60 + minute) * MINUTE;
    const offsets = new Set([-DAY, 0, DAY].map((delta) => {
      const sample = target + delta;
      const wall = wallParts(sample, timeZone);
      return wall.midnight + (wall.hour * 60 + wall.minute) * MINUTE - sample;
    }));
    let first = Infinity;
    for (const offset of offsets) {
      const instant = target - offset;
      const same = wallParts(instant, timeZone);
      if (same.midnight === day && same.hour === hour && same.minute === minute) first = Math.min(first, instant);
    }
    if (Number.isFinite(first) && first > after) return first;
  }
  return null;
}

function decodeSchedule(value: unknown): AlarmSchedule | undefined {
  const v = record(value);
  if (!integer(v.hour, 0, 23) || !integer(v.minute, 0, 59) || !validZone(v.timeZone)) return undefined;
  const days = Array.isArray(v.days) ? Array.from(new Set(v.days.slice(0, 7).filter((d) => integer(d, 0, 6)))).sort((a, b) => a - b) : [];
  return { hour: v.hour, minute: v.minute, days, timeZone: v.timeZone, label: typeof v.label === 'string' ? v.label.trim().slice(0, 48) : '' };
}

/** Restore only valid, bounded state. Damaged storage never prevents the clock from loading. */
export function decodeClockTools(raw: string | null): ClockToolsState {
  const start = initialClockTools();
  if (!raw || raw.length > 36_000) return start;
  let v: Record<string, unknown>;
  try { v = record(JSON.parse(raw)); } catch { return start; }
  const ids = new Set<string>();
  if (Array.isArray(v.alarms)) {
    for (const unknownAlarm of v.alarms.slice(0, MAX_ALARMS)) {
      const alarm = record(unknownAlarm);
      const schedule = decodeSchedule(alarm);
      if (!schedule || !validId(alarm.id) || ids.has(alarm.id)) continue;
      ids.add(alarm.id);
      start.alarms.push({ ...schedule, id: alarm.id, nextAt: epoch(alarm.nextAt) ? alarm.nextAt : null, snoozedUntil: epoch(alarm.snoozedUntil) ? alarm.snoozedUntil : null });
    }
  }
  const timer = record(v.timer);
  if (integer(timer.durationMs, 1000, MAX_TIMER_MS)) {
    const durationMs = timer.durationMs;
    if (timer.status === 'running' && epoch(timer.endAt)) start.timer = { status: 'running', durationMs, endAt: timer.endAt };
    else if (timer.status === 'paused' && integer(timer.remainingMs, 1, MAX_TIMER_MS)) start.timer = { status: 'paused', durationMs, remainingMs: timer.remainingMs };
    else start.timer = { status: timer.status === 'done' ? 'done' : 'ready', durationMs };
  }
  const stopwatch = record(v.stopwatch);
  start.stopwatch = {
    startedAt: epoch(stopwatch.startedAt) ? stopwatch.startedAt : null,
    elapsedMs: epoch(stopwatch.elapsedMs) ? stopwatch.elapsedMs : 0,
    laps: Array.isArray(stopwatch.laps) ? stopwatch.laps.slice(0, MAX_LAPS).filter(epoch).sort((a, b) => a - b) : [],
  };
  if (Array.isArray(v.alerts)) {
    const seen = new Set<string>();
    for (const item of v.alerts.slice(0, MAX_ALARMS + 1)) {
      const { id, alarmId, at } = record(item);
      if (!epoch(at) || typeof id !== 'string' || seen.has(id)) continue;
      if (typeof alarmId === 'string' && ids.has(alarmId) && id === `alarm:${alarmId}`) {
        seen.add(id);
        start.alerts.push({ id, alarmId, at });
      } else if (id === 'timer' && start.timer.status === 'done') {
        seen.add(id);
        start.alerts.push({ id, at });
      }
    }
  }
  const p = record(v.preferences);
  start.preferences = {
    tone: tone(p.tone) ? p.tone : start.preferences.tone,
    volume: integer(p.volume, 0, 100) ? p.volume : start.preferences.volume,
    snooze: snooze(p.snooze) ? p.snooze : start.preferences.snooze,
    notifications: p.notifications === true,
  };
  return start;
}

export const alarmIsArmed = (alarm: ClockAlarm) => alarm.nextAt !== null || alarm.snoozedUntil !== null;
export const isMissedClockAlert = (alert: ClockAlert, now: number) => now - alert.at > RING_GRACE_MS;
export const timerRemaining = (timer: Countdown, now: number) => timer.status === 'running'
  ? Math.min(timer.durationMs, Math.max(0, timer.endAt - now))
  : timer.status === 'paused' ? timer.remainingMs : timer.status === 'ready' ? timer.durationMs : 0;
export const stopwatchElapsed = (watch: Stopwatch, now: number) => watch.elapsedMs + (watch.startedAt === null ? 0 : Math.max(0, now - watch.startedAt));

export function nextClockDeadline(s: ClockToolsState): number {
  let first = s.timer.status === 'running' ? s.timer.endAt : Infinity;
  for (const a of s.alarms) first = Math.min(first, a.nextAt ?? Infinity, a.snoozedUntil ?? Infinity);
  return first;
}

/** Advance from absolute time. Coalesce old repeats and make each deadline fire
 * once, even if the browser paused us past the scheduled minute. */
function advance(s: ClockToolsState, now: number): ClockToolsState {
  if (nextClockDeadline(s) > now) return s;
  const due: ClockAlert[] = [];
  const alarms = s.alarms.map((a) => {
    const regular = a.nextAt !== null && a.nextAt <= now;
    const snoozed = a.snoozedUntil !== null && a.snoozedUntil <= now;
    if (!regular && !snoozed) return a;
    let regularAt = regular ? a.nextAt! : 0;
    if (regular && a.days.length && regularAt < now - RING_GRACE_MS) {
      // If several repeats were suspended, an occurrence just due today should
      // still be eligible to ring; old occurrences coalesce into one notice.
      const recent = nextAlarmAt(a, now - RING_GRACE_MS - 1);
      if (recent !== null && recent <= now) regularAt = recent;
    }
    due.push({ id: `alarm:${a.id}`, alarmId: a.id, at: Math.max(regularAt, snoozed ? a.snoozedUntil! : 0) });
    return { ...a, nextAt: regular ? (a.days.length ? nextAlarmAt(a, now) : null) : a.nextAt, snoozedUntil: snoozed ? null : a.snoozedUntil };
  });
  let timer = s.timer;
  if (timer.status === 'running' && timer.endAt <= now) {
    due.push({ id: 'timer', at: timer.endAt });
    timer = { status: 'done', durationMs: timer.durationMs };
  }
  return { ...s, alarms, timer, alerts: [...due.sort((a, b) => b.at - a.at), ...s.alerts.filter((a) => !due.some((d) => d.id === a.id))] };
}

export type ClockAction =
  | { type: 'tick' | 'pauseTimer' | 'resumeTimer' | 'resetTimer' | 'startWatch' | 'pauseWatch' | 'resetWatch' | 'lap' }
  | { type: 'saveAlarm'; id: string; schedule: AlarmSchedule }
  | { type: 'toggleAlarm' | 'deleteAlarm' | 'dismiss' | 'snooze'; id: string }
  | { type: 'startTimer'; durationMs: number }
  | { type: 'preferences'; patch: Partial<ClockPreferences> };

export function updateClockTools(previous: ClockToolsState, action: ClockAction, now: number): ClockToolsState {
  const s = advance(previous, now);
  switch (action.type) {
    case 'tick': return s;
    case 'saveAlarm': {
      const schedule = decodeSchedule(action.schedule);
      const existing = s.alarms.some((a) => a.id === action.id);
      if (!schedule || !validId(action.id) || (!existing && s.alarms.length >= MAX_ALARMS)) return s;
      const alarm: ClockAlarm = { ...schedule, id: action.id, nextAt: nextAlarmAt(schedule, now), snoozedUntil: null };
      return { ...s, alarms: existing ? s.alarms.map((a) => a.id === alarm.id ? alarm : a) : [...s.alarms, alarm], alerts: s.alerts.filter((a) => a.alarmId !== alarm.id) };
    }
    case 'toggleAlarm':
    case 'deleteAlarm': {
      if (!s.alarms.some((a) => a.id === action.id)) return s;
      const alarms = action.type === 'deleteAlarm' ? s.alarms.filter((a) => a.id !== action.id) : s.alarms.map((a) => a.id !== action.id
        ? a : { ...a, nextAt: alarmIsArmed(a) ? null : nextAlarmAt(a, now), snoozedUntil: null });
      return { ...s, alarms, alerts: s.alerts.filter((a) => a.alarmId !== action.id) };
    }
    case 'dismiss': return { ...s, alerts: s.alerts.filter((a) => a.id !== action.id) };
    case 'snooze': {
      const alarmId = s.alerts.find((a) => a.id === action.id)?.alarmId;
      if (!alarmId) return s;
      return { ...s, alerts: s.alerts.filter((a) => a.id !== action.id), alarms: s.alarms.map((a) => a.id !== alarmId
        ? a : { ...a, snoozedUntil: now + s.preferences.snooze * MINUTE }) };
    }
    case 'startTimer':
      if (!integer(action.durationMs, 1000, MAX_TIMER_MS)) return s;
      return { ...s, timer: { status: 'running', durationMs: action.durationMs, endAt: now + action.durationMs }, alerts: s.alerts.filter((a) => a.id !== 'timer') };
    case 'pauseTimer': return s.timer.status === 'running'
      ? { ...s, timer: { status: 'paused', durationMs: s.timer.durationMs, remainingMs: timerRemaining(s.timer, now) } } : s;
    case 'resumeTimer': return s.timer.status === 'paused'
      ? { ...s, timer: { status: 'running', durationMs: s.timer.durationMs, endAt: now + s.timer.remainingMs } } : s;
    case 'resetTimer': return { ...s, timer: { status: 'ready', durationMs: s.timer.durationMs }, alerts: s.alerts.filter((a) => a.id !== 'timer') };
    case 'startWatch': return s.stopwatch.startedAt === null ? { ...s, stopwatch: { ...s.stopwatch, startedAt: now } } : s;
    case 'pauseWatch': return s.stopwatch.startedAt !== null
      ? { ...s, stopwatch: { ...s.stopwatch, elapsedMs: stopwatchElapsed(s.stopwatch, now), startedAt: null } } : s;
    case 'resetWatch': return { ...s, stopwatch: initialClockTools().stopwatch };
    case 'lap': return s.stopwatch.startedAt === null || s.stopwatch.laps.length >= MAX_LAPS
      ? s : { ...s, stopwatch: { ...s.stopwatch, laps: [...s.stopwatch.laps, Math.max(s.stopwatch.laps.at(-1) ?? 0, stopwatchElapsed(s.stopwatch, now))] } };
    case 'preferences': return { ...s, preferences: { ...s.preferences, ...action.patch } };
  }
}
