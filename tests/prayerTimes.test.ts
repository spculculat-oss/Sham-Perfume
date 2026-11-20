import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  PRAYER_KEYS,
  PRAYER_METHODS,
  formatPrayerTime,
  isDaylight,
  nextPrayer,
  prayerMethodFor,
  prayerTimesFor,
  splitRemaining,
  sunPosition,
  sunProgress,
} from '../src/utils/prayerTimes';

const cairo = { latitude: 30.04, longitude: 31.24 };
const makkah = { latitude: 21.42, longitude: 39.83 };
const at = (day: string) => new Date(`${day}T00:00:00Z`);
const utcClock = (epoch: number) => new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC',
}).format(new Date(epoch));
const minutesBetween = (early: number, late: number) => Math.round((late - early) / 60_000);

test('Cairo prayer times stay within a few minutes of the published ones', () => {
  const times = prayerTimesFor({ ...cairo, date: at('2026-11-20'), method: prayerMethodFor('EG') })!;
  assert.ok(times);
  // Egypt's own convention: Fajr 19.5°, Isha 17.5°. Published on 2026-11-20:
  // Fajr 04:53, Sunrise 06:24, Dhuhr 11:40, Asr 14:36, Maghrib 16:56, Isha 18:17 (Cairo, UTC+2).
  assert.equal(utcClock(times.times.fajr), '02:53');
  assert.equal(utcClock(times.times.sunrise), '04:24');
  assert.equal(utcClock(times.times.dhuhr), '09:40');
  assert.equal(utcClock(times.times.asr), '12:36');
  assert.equal(utcClock(times.times.maghrib), '14:56');
  assert.equal(utcClock(times.times.isha), '16:17');
  assert.equal(times.estimated, false);
  for (const key of PRAYER_KEYS) assert.ok(Number.isFinite(times.times[key]), key);
  assert.ok(times.times.fajr < times.times.sunrise);
  assert.ok(times.times.sunrise < times.times.dhuhr);
  assert.ok(times.times.dhuhr < times.times.asr);
  assert.ok(times.times.asr < times.times.maghrib);
  assert.ok(times.times.maghrib < times.times.isha);
});

test('Makkah and London are computed correctly for their own conventions', () => {
  const makkahTimes = prayerTimesFor({ ...makkah, date: at('2026-06-21'), method: prayerMethodFor('SA') })!;
  // Umm al-Qura: Isha is 90 minutes after Maghrib.
  assert.equal(minutesBetween(makkahTimes.times.maghrib, makkahTimes.times.isha), 90);
  assert.ok(Math.abs(minutesBetween(makkahTimes.times.dhuhr, Date.parse('2026-06-21T09:22:00Z'))) <= 2, 'solar noon in Makkah');

  const london = prayerTimesFor({ latitude: 51.5, longitude: -0.12, date: at('2026-11-20') })!;
  assert.ok(Math.abs(minutesBetween(london.times.dhuhr, Date.parse('2026-11-20T11:46:00Z'))) <= 2, 'solar noon in London');
  assert.ok(london.times.maghrib - london.times.sunrise < 9 * 3_600_000, 'a November London day is short');
});

test('the Hanafi Asr is later than the Shafi’i Asr', () => {
  const shafii = prayerTimesFor({ ...cairo, date: at('2026-11-20'), method: PRAYER_METHODS.egypt })!;
  const hanafi = prayerTimesFor({ ...cairo, date: at('2026-11-20'), method: { ...PRAYER_METHODS.egypt, asrFactor: 2 } })!;
  assert.ok(hanafi.times.asr > shafii.times.asr);
  assert.ok(minutesBetween(shafii.times.asr, hanafi.times.asr) > 30);
});

test('each country gets the convention its visitors expect', () => {
  assert.equal(prayerMethodFor('EG').id, 'egypt');
  assert.equal(prayerMethodFor('sa').id, 'ummAlQura');
  assert.equal(prayerMethodFor('AE').id, 'dubai');
  assert.equal(prayerMethodFor('US').id, 'isna');
  assert.equal(prayerMethodFor('TR').id, 'turkey');
  assert.equal(prayerMethodFor('PK').asrFactor, 2, 'South Asia follows the Hanafi Asr');
  assert.equal(prayerMethodFor(undefined).id, 'mwl');
});

test('polar days still return ordered times, flagged as estimates', () => {
  const tromso = prayerTimesFor({ latitude: 69.65, longitude: 18.96, date: at('2026-06-21') });
  assert.ok(tromso, 'a midnight-sun day must not break the card');
  assert.equal(tromso!.estimated, true);
  assert.ok(tromso!.times.fajr < tromso!.times.dhuhr);
  assert.ok(tromso!.times.dhuhr < tromso!.times.maghrib);
  assert.ok(tromso!.times.maghrib < tromso!.times.isha);
  assert.equal(sunPosition(2451545.0).declination < 1, true, 'declination at J2000 is near zero');
});

test('the next prayer rolls over to tomorrow’s Fajr after Isha', () => {
  const times = prayerTimesFor({ ...cairo, date: at('2026-11-20'), method: prayerMethodFor('EG') })!;
  const beforeFajr = nextPrayer(times, Date.parse('2026-11-20T02:00:00Z'))!;
  assert.equal(beforeFajr.key, 'fajr');
  // Sunrise is shown in the strip but is not itself a prayer, so it is never "next".
  const afterFajr = nextPrayer(times, Date.parse('2026-11-20T03:30:00Z'))!;
  assert.equal(afterFajr.key, 'dhuhr');
  const afterAsr = nextPrayer(times, Date.parse('2026-11-20T13:00:00Z'))!;
  assert.equal(afterAsr.key, 'maghrib');
  assert.equal(afterAsr.remainingMs, times.times.maghrib - Date.parse('2026-11-20T13:00:00Z'));
  const lateNight = nextPrayer(times, Date.parse('2026-11-20T20:00:00Z'))!;
  assert.equal(lateNight.key, 'fajr');
  assert.ok(lateNight.at > Date.parse('2026-11-21T00:00:00Z'), 'the countdown moves to the next day');
  assert.ok(lateNight.remainingMs > 0);
  assert.equal(nextPrayer(times, Number.NaN), undefined);
});

test('remaining time, sun arc and daylight read honestly', () => {
  assert.deepEqual(splitRemaining(0), { hours: 0, minutes: 0 });
  assert.deepEqual(splitRemaining(-5000), { hours: 0, minutes: 0 });
  assert.deepEqual(splitRemaining(90 * 60_000), { hours: 1, minutes: 30 });
  const times = prayerTimesFor({ ...cairo, date: at('2026-11-20'), method: prayerMethodFor('EG') })!;
  assert.equal(sunProgress(times, times.times.sunrise), 0);
  assert.equal(sunProgress(times, times.times.maghrib), 1);
  assert.ok(Math.abs(sunProgress(times, times.times.sunrise + (times.times.maghrib - times.times.sunrise) / 2) - 0.5) < 1e-9);
  assert.equal(sunProgress(times, times.times.sunrise - 3_600_000), 0, 'before sunrise the sun waits at the edge');
  assert.equal(isDaylight(times, times.times.dhuhr), true);
  assert.equal(isDaylight(times, times.times.isha), false);
  assert.equal(formatPrayerTime(times.times.fajr, 'Africa/Cairo', 'ar-EG'), '٠٤:٥٣');
  assert.equal(formatPrayerTime(times.times.fajr, 'Bad/Zone', 'en-GB'), '02:53');
});

test('bad coordinates or dates never produce a broken card', () => {
  assert.equal(prayerTimesFor({ latitude: 91, longitude: 0, date: at('2026-11-20') }), undefined);
  assert.equal(prayerTimesFor({ latitude: 0, longitude: 200, date: at('2026-11-20') }), undefined);
  assert.equal(prayerTimesFor({ ...cairo, date: new Date(Number.NaN) }), undefined);
});

test('the prayer board lives beside the clock inside the same card', () => {
  const dashboard = readFileSync(new URL('../src/components/VisitorLocalDashboard.tsx', import.meta.url), 'utf8');
  const board = readFileSync(new URL('../src/components/clock/PrayerTimesBoard.tsx', import.meta.url), 'utf8');
  assert.match(dashboard, /<PrayerTimesBoard lang=\{currentLang\} place=\{prayerPlace\} now=\{now\} timeZone=\{localTimeZone\} \/>/);
  assert.match(board, /data-testid="prayer-times"/);
  assert.match(board, /prayer-arc/);
  assert.match(board, /prayer-strip/);
  assert.doesNotMatch(board, /fetch\(/, 'prayer times are computed on the device, never sent to a prayer API');
});
