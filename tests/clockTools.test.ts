import assert from 'node:assert/strict';
import test from 'node:test';
import {
  alarmIsArmed, decodeClockTools, initialClockTools, isMissedClockAlert, MAX_ALARMS, MAX_LAPS, MAX_TIMER_MS,
  nextAlarmAt, nextClockDeadline, stopwatchElapsed, timerRemaining, updateClockTools, type AlarmSchedule,
} from '../src/utils/clockTools';
import { durationText } from '../src/components/clock/clockText';

const epoch = (iso: string) => Date.parse(iso);
const now = epoch('2026-11-18T10:00:15Z');
const schedule: AlarmSchedule = { hour: 12, minute: 1, days: [], timeZone: 'Africa/Cairo', label: 'Break' };
const save = (overrides?: Partial<AlarmSchedule>) => updateClockTools(initialClockTools(), { type: 'saveAlarm', id: 'a', schedule: { ...schedule, ...overrides } }, now);
const tick = (s: ReturnType<typeof initialClockTools>, at: number) => updateClockTools(s, { type: 'tick' }, at);

test('alarm uses the clock zone, rolls to tomorrow, and observes chosen weekdays', () => {
  assert.equal(nextAlarmAt(schedule, now), epoch('2026-11-18T10:01:00Z'));
  assert.equal(nextAlarmAt({ ...schedule, minute: 0 }, now), epoch('2026-11-19T10:00:00Z'));
  assert.equal(nextAlarmAt({ ...schedule, days: [5] }, now), epoch('2026-11-20T10:01:00Z'));
  assert.equal(nextAlarmAt({ ...schedule, hour: 0, minute: 0 }, epoch('2026-11-18T21:59:59Z')), epoch('2026-11-18T22:00:00Z'));
  assert.equal(nextAlarmAt({ ...schedule, hour: 18, minute: 30, timeZone: 'Asia/Kathmandu' }, now), epoch('2026-11-18T12:45:00Z'));
});

test('weekly alarm skips the DST spring gap and does not ring twice in the fall', () => {
  const spring: AlarmSchedule = { ...schedule, hour: 2, minute: 30, days: [0], timeZone: 'America/New_York' };
  assert.equal(nextAlarmAt(spring, epoch('2026-03-07T12:00:00Z')), epoch('2026-03-15T06:30:00Z'));
  const fall = { ...spring, hour: 1 };
  const first = epoch('2026-11-01T05:30:00Z');
  assert.equal(nextAlarmAt(fall, epoch('2026-11-01T01:00:00Z')), first);
  assert.equal(nextAlarmAt(fall, first), epoch('2026-11-08T06:30:00Z'));
  assert.equal(nextAlarmAt({ ...fall, days: [] }, epoch('2026-11-01T06:00:00Z')), epoch('2026-11-02T06:30:00Z'));
});

test('one-time alarm fires once after a suspended tab; snooze persists and fires independently', () => {
  const start = save();
  const at = nextClockDeadline(start);
  assert.equal(tick(start, at - 1), start);
  const fired = tick(start, at + 20_000);
  assert.equal(alarmIsArmed(fired.alarms[0]), false);
  assert.deepEqual(fired.alerts, [{ id: 'alarm:a', alarmId: 'a', at }]);
  assert.equal(tick(fired, at + 30_000), fired);
  const preferred = updateClockTools(fired, { type: 'preferences', patch: { snooze: 10 } }, at + 20_000);
  const snoozed = updateClockTools(preferred, { type: 'snooze', id: 'alarm:a' }, at + 20_000);
  assert.equal(snoozed.alerts.length, 0);
  assert.equal(alarmIsArmed(snoozed.alarms[0]), true);
  assert.equal(nextClockDeadline(snoozed), at + 620_000);
  const restored = decodeClockTools(JSON.stringify(snoozed));
  assert.deepEqual(restored, snoozed);
  const again = tick(restored, at + 620_005);
  assert.equal(again.alerts[0].at, at + 620_000);
  assert.ok(isMissedClockAlert(again.alerts[0], at + 750_000));
  assert.equal(alarmIsArmed(again.alarms[0]), false);
});

test('repeating alarm catches up without a backlog; edit, disable, enable, and delete clear its old alert', () => {
  let s = save({ days: [3, 5] });
  s = tick(s, epoch('2026-11-21T12:00:00Z'));
  assert.equal(s.alerts.length, 1);
  assert.equal(s.alarms[0].nextAt, epoch('2026-11-25T10:01:00Z'));
  const later = epoch('2026-11-21T12:00:00Z');
  s = updateClockTools(s, { type: 'toggleAlarm', id: 'a' }, later);
  assert.deepEqual(s.alerts, []);
  assert.equal(nextClockDeadline(s), Infinity);
  s = updateClockTools(s, { type: 'toggleAlarm', id: 'a' }, later);
  assert.equal(nextClockDeadline(s), epoch('2026-11-25T10:01:00Z'));
  s = updateClockTools(s, { type: 'saveAlarm', id: 'a', schedule: { ...schedule, label: 'Edited' } }, later);
  assert.equal(s.alarms[0].label, 'Edited');
  s = updateClockTools(s, { type: 'deleteAlarm', id: 'a' }, later);
  assert.deepEqual(s.alarms, []);
});

test('a repeat due near wake-up still rings even when an older occurrence was missed', () => {
  const s = save({ days: [0, 1, 2, 3, 4, 5, 6] });
  const today = epoch('2026-11-21T10:01:00Z');
  const wake = tick(s, today + 1000);
  assert.equal(wake.alerts[0].at, today);
  assert.equal(isMissedClockAlert(wake.alerts[0], today + 1000), false);
});

test('timer pause/resume, time-skips, reload and reset use an absolute deadline', () => {
  let s = updateClockTools(initialClockTools(), { type: 'startTimer', durationMs: 5000 }, now);
  assert.equal(timerRemaining(s.timer, now + 2300), 2700);
  s = updateClockTools(s, { type: 'pauseTimer' }, now + 2300);
  assert.equal(timerRemaining(s.timer, now + 999_999), 2700);
  s = updateClockTools(s, { type: 'resumeTimer' }, now + 9000);
  assert.equal(nextClockDeadline(s), now + 11_700);
  const finish = tick(decodeClockTools(JSON.stringify(s)), now + 20_000);
  assert.deepEqual(finish.alerts, [{ id: 'timer', at: now + 11_700 }]);
  assert.equal(finish.timer.status, 'done');
  assert.equal(timerRemaining(finish.timer, now + 20_000), 0);
  assert.equal(tick(finish, now + 30_000), finish);
  const reset = updateClockTools(finish, { type: 'resetTimer' }, now + 20_000);
  assert.deepEqual(reset.timer, { status: 'ready', durationMs: 5000 });
  assert.deepEqual(reset.alerts, []);
});

test('stopwatch time and laps survive reload and pause; reset clears both', () => {
  let s = updateClockTools(initialClockTools(), { type: 'startWatch' }, now);
  s = updateClockTools(s, { type: 'lap' }, now + 2430);
  s = updateClockTools(s, { type: 'pauseWatch' }, now + 5430);
  assert.equal(stopwatchElapsed(s.stopwatch, now + 6000), 5430);
  s = updateClockTools(decodeClockTools(JSON.stringify(s)), { type: 'startWatch' }, now + 6000);
  s = updateClockTools(s, { type: 'lap' }, now + 6100);
  assert.deepEqual(s.stopwatch.laps, [2430, 5530]);
  assert.equal(stopwatchElapsed(s.stopwatch, now + 6200), 5630);
  assert.deepEqual(updateClockTools(s, { type: 'resetWatch' }, now + 6300).stopwatch, initialClockTools().stopwatch);
});

test('clock state is bounded, invalid time zones and durations are ignored, and corrupt storage is safe', () => {
  const initial = initialClockTools();
  assert.equal(updateClockTools(initial, { type: 'startTimer', durationMs: MAX_TIMER_MS + 1 }, now), initial);
  assert.equal(save({ timeZone: 'not/a-zone' }).alarms.length, 0);
  assert.deepEqual(decodeClockTools('{invalid'), initial);
  assert.deepEqual(decodeClockTools(JSON.stringify({ alarms: [...Array(3).fill({ hour: 12 })], timer: { durationMs: -3 } })), initial);
  let s = initial;
  for (let i = 0; i < MAX_ALARMS + 2; i++) s = updateClockTools(s, { type: 'saveAlarm', id: `${i}`, schedule }, now);
  assert.equal(s.alarms.length, MAX_ALARMS);
  s = updateClockTools(s, { type: 'startWatch' }, now);
  for (let i = 0; i < MAX_LAPS + 2; i++) s = updateClockTools(s, { type: 'lap' }, now + i * 10);
  assert.equal(s.stopwatch.laps.length, MAX_LAPS);
});

test('tools format time digits in the site language and round a running countdown up', () => {
  assert.equal(durationText('en', 3600999), '01:00:01');
  assert.equal(durationText('ar', 3600999), '٠١:٠٠:٠١');
  assert.equal(durationText('en', 61789, true), '01:01.78');
  assert.equal(durationText('ar', 61789, true), '٠١:٠١٫٧٨');
});
