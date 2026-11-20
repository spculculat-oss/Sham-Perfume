import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ADHAN_RECORDINGS, validAdhanFile, MAX_ADHAN_FILE_BYTES } from '../src/data/adhanVoices';
import { ADHKAR, ADHKAR_CATEGORIES, HISN_AL_MUSLIM_URL } from '../src/data/prayerAdhkar';
import { decodePrayerPreferences, defaultPrayerPreferences, PRAYER_NAMES, REMINDER_PRAYERS, type PrayerPlace } from '../src/utils/prayerConfig';
import { automaticPrayerPlace, gpsPrayerPlace, parsePrayerCities, placeIsConfirmed, prayerSearchKey } from '../src/utils/prayerPlaces';
import { asrForCountry, calculatePrayerCalendar, calculatePrayerDay, duePrayer, methodForCountry, prayerDayKey, prayerSunArc, shiftPrayerDay, splitPrayerRemaining } from '../src/utils/prayerTimes';

const cities = parsePrayerCities(readFileSync(new URL('../src/data/prayerCities.tsv', import.meta.url), 'utf8'));
function city(name: string, country: string): PrayerPlace {
  const value = cities.find((p) => p.cityEn === name && p.country === country);
  assert.ok(value, `${name} / ${country}`);
  return value;
}
function wallMinutes(at: number, timeZone: string): number {
  const [hour, minute] = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at).split(':').map(Number);
  return hour * 60 + minute;
}
const epoch = (key: string) => Date.parse(key);
const cairo = city('Cairo', 'EG');

function timings(place: PrayerPlace, key: string, asr: 'standard' | 'hanafi' = asrForCountry(place.country)) {
  const value = calculatePrayerDay(place, key, methodForCountry(place.country), asr);
  assert.ok(value);
  return value;
}

test('Egyptian method matches the independently published Cairo table to within 1 minute', () => {
  // https://gate.ahram.org.eg/News/5981868.aspx (2026-11-18, Cairo). The source typo
  // "11:40 PM" for Dhuhr is midday in the listed sequence and other published tables.
  const alAhram = [4 * 60 + 52, 6 * 60 + 22, 11 * 60 + 40, 14 * 60 + 37, 16 * 60 + 57, 18 * 60 + 18];
  const day = timings(cairo, '2026-11-18');
  assert.ok(day.reliable);
  for (const [i, name] of PRAYER_NAMES.entries()) assert.ok(Math.abs(wallMinutes(day.times[name]!, cairo.timeZone) - alAhram[i]) <= 1, name);
  assert.deepEqual(day.events.map((e) => e.prayer), REMINDER_PRAYERS);
  const hanafi = timings(cairo, day.key, 'hanafi');
  assert.ok(hanafi.times.asr! - day.times.asr! > 35 * 60_000);
  assert.equal(hanafi.times.maghrib, day.times.maghrib);
  assert.ok(timings(city('Aswan', 'EG'), day.key).times.fajr! < day.times.fajr!);
});

test('each city uses its civil date, correct country method and its own IANA timezone', () => {
  const instant = epoch('2026-11-18T05:30:00Z');
  const ny = city('New York', 'US');
  const la = city('Los Angeles', 'US');
  assert.equal(ny.timeZone, 'America/New_York');
  assert.equal(la.timeZone, 'America/Los_Angeles');
  assert.equal(methodForCountry(ny.country), 'NorthAmerica');
  assert.equal(prayerDayKey(ny.timeZone, instant), '2026-11-18');
  assert.equal(prayerDayKey(la.timeZone, instant), '2026-11-17');
  assert.equal(prayerDayKey(cairo.timeZone, epoch('2026-11-18T22:00:00Z')), '2026-11-19');
  assert.equal(prayerDayKey('Invalid/Zone', instant), undefined);
  assert.equal(shiftPrayerDay('2028-02-28', 1), '2028-02-29');
  assert.notEqual(timings(ny, '2026-11-18').times.dhuhr, timings(la, '2026-11-18').times.dhuhr);
  assert.equal(methodForCountry('SA'), 'UmmAlQura');
  assert.equal(asrForCountry('PK'), 'hanafi');
  assert.equal(methodForCountry('NZ'), 'MuslimWorldLeague');
});

test('DST changes wall-clock readings, not proximity to the solar day', () => {
  const ny = city('New York', 'US');
  const before = timings(ny, '2026-03-07').times.dhuhr!;
  const after = timings(ny, '2026-03-08').times.dhuhr!;
  assert.ok(Math.abs(after - before - 86_400_000) < 5 * 60_000);
  assert.ok(wallMinutes(after, ny.timeZone) - wallMinutes(before, ny.timeZone) >= 58);
  const egyptBefore = timings(cairo, '2026-04-23').times.dhuhr!;
  const egyptAfter = timings(cairo, '2026-04-24').times.dhuhr!;
  assert.ok(wallMinutes(egyptAfter, cairo.timeZone) - wallMinutes(egyptBefore, cairo.timeZone) >= 58);
});

test('civil table aligns the date line and works in both hemispheres', () => {
  const nearDateLine = city('Kiritimati', 'KI');
  assert.equal(prayerDayKey(nearDateLine.timeZone, epoch('2026-11-18T10:00:00Z')), '2026-11-19');
  const day = timings(nearDateLine, '2026-11-19');
  assert.ok(day.reliable);
  for (const at of Object.values(day.times)) assert.equal(prayerDayKey(nearDateLine.timeZone, at!), day.key);
  const sydney = timings(city('Sydney', 'AU'), '2026-06-20');
  assert.ok(sydney.reliable);
  assert.equal(prayerDayKey('Australia/Sydney', sydney.times.fajr!), '2026-06-20');
});

test('estimates summer twilight but avoids an invented polar schedule', () => {
  const day = timings(city('London', 'GB'), '2026-06-20');
  assert.ok(day.reliable && day.times.fajr! < day.times.sunrise! && day.times.isha! > day.times.maghrib!);
  const polar = timings(city('Tromsø', 'NO'), '2026-06-20');
  assert.equal(polar.reliable, false);
  assert.deepEqual(polar.events, []);
  assert.equal(polar.times.sunrise, undefined);
  assert.equal(calculatePrayerDay({ ...cairo, lat: -90 }, '2026-11-18', 'Egyptian', 'standard'), undefined);
});

test('Isha that follows civil midnight stays attached to its previous solar day', () => {
  const place = city('Anchorage', 'US');
  const zone = place.timeZone;
  const yesterday = '2026-06-20';
  const isha = timings(place, yesterday).times.isha!;
  const key = prayerDayKey(zone, isha)!;
  assert.equal(key, '2026-06-21');
  const midnightCalendar = calculatePrayerCalendar(place, key, 'NorthAmerica', 'standard');
  assert.equal(midnightCalendar.today?.key, key);
  assert.equal(midnightCalendar.events.find((e) => e.at > isha - 1000)?.day, yesterday);
  assert.deepEqual(duePrayer(midnightCalendar.events, ['isha'], isha - 60_000, isha + 1_000), { at: isha, day: yesterday, prayer: 'isha' });
  assert.ok(midnightCalendar.today!.times.fajr! > isha);
});

test('a fixed Isha interval that overlaps the next twilight is not used for reminders', () => {
  const place: PrayerPlace = { key: 'test-is', cityEn: 'Northern Iceland', cityAr: 'شمال آيسلندا', country: 'IS', timeZone: 'Atlantic/Reykjavik', lat: 65.5, lon: -18.09 };
  const key = '2026-06-21';
  const a = calculatePrayerDay(place, key, 'UmmAlQura', 'standard');
  const b = calculatePrayerDay(place, shiftPrayerDay(key, 1), 'UmmAlQura', 'standard');
  assert.ok(a?.reliable && b?.reliable && a.times.isha! > b.times.fajr!);
  const calendar = calculatePrayerCalendar(place, key, 'UmmAlQura', 'standard');
  assert.equal(calendar.today?.reliable, false);
  assert.deepEqual(calendar.events, []);
});

test('Saudi Isha adds 30 minutes in the estimated Umm al-Qura Ramadan calendar', () => {
  const mecca = city('Mecca', 'SA');
  const ordinary = timings(mecca, '2026-11-18');
  const ramadan = timings(mecca, '2026-02-28');
  assert.equal(ordinary.times.isha! - ordinary.times.maghrib!, 90 * 60_000);
  assert.equal(ramadan.times.isha! - ramadan.times.maghrib!, 120 * 60_000);
});

test('automatic place never equates a timezone with confirmed location', () => {
  assert.ok(new Set(cities.map((c) => c.country)).size >= 200);
  assert.ok(new Set(cities.map((c) => c.timeZone)).size >= 300);
  const inferred = automaticPrayerPlace(cities, {}, 'Africa/Cairo');
  assert.equal(inferred?.place.key, cairo.key);
  assert.equal(inferred?.source, 'timezone');
  assert.equal(placeIsConfirmed(inferred), false);
  assert.equal(automaticPrayerPlace(cities, undefined, 'UTC'), undefined);
  const foreign = automaticPrayerPlace(cities, { country: 'CA' }, 'Africa/Cairo');
  assert.equal(foreign?.place.country, 'CA');
  assert.equal(foreign?.source, 'country');
  assert.equal(placeIsConfirmed(foreign), false);
  const cali = automaticPrayerPlace(cities, { country: 'US' }, 'US/Pacific');
  assert.equal(cali?.place.timeZone, 'America/Los_Angeles');
  const unknown = { country: 'US', cityEn: 'No Such City', cityAr: 'No Such City', placeId: 'US:no_such_city', lat: 26.8, lon: 30.8, precision: 'edge-city' } as const;
  assert.equal(automaticPrayerPlace(cities, { country: 'US', location: unknown })?.source, 'country');
  const actual = automaticPrayerPlace(cities, { country: 'US', location: { ...unknown, cityEn: 'Los Angeles', placeId: 'US:los_angeles' } });
  assert.equal(actual?.source, 'network');
  assert.equal(actual?.place.timeZone, 'America/Los_Angeles');
  assert.ok(actual!.place.lon < -110);
});

test('GPS rejects uncertain locations, resolves a local timezone only, and cannot read a fake city', () => {
  const coords = { latitude: 43.65, longitude: -79.38, accuracy: 20 };
  assert.equal(gpsPrayerPlace(cities, coords)?.place.timeZone, 'America/Toronto');
  assert.equal(gpsPrayerPlace(cities, coords)?.place.country, 'CA');
  assert.equal(gpsPrayerPlace(cities, { ...coords, accuracy: 50_000 }), undefined);
  assert.equal(gpsPrayerPlace(cities, { ...coords, latitude: Infinity }), undefined);
  assert.equal(prayerSearchKey('أَذْكارُ الصَّباح'), 'اذكار الصباح');
  assert.equal(prayerSearchKey('São Luís'), 'sao luis');
});

test('an opt-in prayer deadline fires only across a recent boundary and never for sunrise', () => {
  const day = timings(cairo, '2026-11-18');
  const at = day.times.fajr!;
  assert.equal(duePrayer(day.events, REMINDER_PRAYERS, at - 60_000, at)?.prayer, 'fajr');
  assert.equal(duePrayer(day.events, ['dhuhr'], at - 1, at), undefined);
  assert.equal(duePrayer(day.events, REMINDER_PRAYERS, at, at + 10), undefined, 'no retroactive alert when armed at or after prayer time');
  assert.equal(duePrayer(day.events, REMINDER_PRAYERS, at - 5, at + 61_000), undefined);
  const sunrise = day.times.sunrise!;
  assert.equal(duePrayer(day.events, REMINDER_PRAYERS, sunrise - 1, sunrise), undefined);
});

test('only validated display choices persist, without an opt-in, private coordinates or file names', () => {
  assert.deepEqual(decodePrayerPreferences('{'), defaultPrayerPreferences());
  assert.deepEqual(decodePrayerPreferences('null'), defaultPrayerPreferences());
  const value = decodePrayerPreferences(JSON.stringify({
    hidden: true, cityKey: 'city:cairo', method: 'Egyptian', asr: 'hanafi', mode: 'audio', lat: 30.044432, lon: 31.23572,
    prayers: ['sunrise', 'dhuhr', 'fajr', 'dhuhr'], regularVoice: 'aaqib-azeez', fajrVoice: 'besim-azemi-fajr', custom: 'my-drive.wav',
  }));
  assert.deepEqual(value, { hidden: true, cityKey: 'city:cairo', method: 'Egyptian', asr: 'hanafi', prayers: ['fajr', 'dhuhr'], regularVoice: 'aaqib-azeez', fajrVoice: 'besim-azemi-fajr' });
  assert.equal(decodePrayerPreferences('{"cityKey":"https://other.example"}').cityKey, null);
  assert.equal(decodePrayerPreferences('{"fajrVoice":"aaqib-azeez"}').fajrVoice, 'ahmed-khalaf');
});

test('bundled recordings match the licensed assets and Fajr has its own files', () => {
  assert.match(ADHAN_RECORDINGS.fajr['ahmed-khalaf']!.file, /fajr/);
  assert.ok(!ADHAN_RECORDINGS.fajr['aaqib-azeez']);
  assert.ok(!ADHAN_RECORDINGS.regular['besim-azemi-fajr']);
  const hashes: Record<string, string> = {
    'ahmed-khalaf.mp3': '48ce7a63922bc666be0d4919056a31445ace775b3b7ffc4ab07325d8edf9ddb6',
    'ahmed-khalaf-fajr.mp3': '18b43fca35558ed05de0cbf8fcf468fd606e17cacb688bfed065e45787f56378',
    'aaqib-azeez.mp3': '0faa59e2028bbb2f60a670b53ec89ffcf628f3c195b43fb41d9bdbc99000c1b3',
    'besim-azemi-fajr.m4a': 'b0e80a61d22faae3613e360bad2edc89ce296e8b6c0fe1b5f0a6ce2b17196ce2',
  };
  for (const group of Object.values(ADHAN_RECORDINGS)) for (const voice of Object.values(group)) {
    const bytes = readFileSync(new URL(`../public/audio/adhan/${voice.file}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), hashes[voice.file]);
    assert.ok(voice.credit && voice.source.startsWith('https://') && voice.licenseUrl.startsWith('https://creativecommons.org/'));
  }
  assert.ok(validAdhanFile({ type: 'audio/mpeg', name: 'فجر.MP3', size: 5 }));
  assert.ok(!validAdhanFile({ type: 'text/html', name: 'test.mp3', size: 4096 }));
  assert.ok(!validAdhanFile({ type: 'audio/mpeg', name: 'large.mp3', size: MAX_ADHAN_FILE_BYTES + 1 }));
});

test('the local adhkar collection has auditable sources, categories and verbatim Quran references', () => {
  const quran = readFileSync(new URL('../src/data/prayerQuran.txt', import.meta.url), 'utf8');
  const verses = new Set([...quran.matchAll(/^(\d+)\|(\d+)\|/gm)].map((m) => `${m[1]}:${m[2]}`));
  assert.match(quran, /Tanzil Quran Text \(Uthmani, Version 1\.1\)/);
  assert.ok(ADHKAR.length >= 45);
  assert.equal(new Set(ADHKAR.map((e) => e.id)).size, ADHKAR.length);
  for (const item of ADHKAR) {
    assert.ok(item.source.url.startsWith('https://sunnah.com/'));
    assert.ok(item.categories.every((c) => Object.hasOwn(ADHKAR_CATEGORIES, c)));
    assert.ok(item.text || item.verses?.every((verse) => verses.has(verse)));
    assert.ok(item.repeat === undefined || Number.isInteger(item.repeat) && item.repeat > 0);
  }
  for (const category of Object.keys(ADHKAR_CATEGORIES)) assert.ok(ADHKAR.some((item) => item.categories.some((c) => c === category)));
  assert.match(HISN_AL_MUSLIM_URL, /^https:\/\/islamhouse\.com\//);
});


test('the clock sun arc and countdown use the selected city’s civil timetable', () => {
  const day = timings(cairo, '2026-11-18');
  const rise = day.times.sunrise!;
  const set = day.times.maghrib!;
  assert.deepEqual(prayerSunArc(day.times, rise - 60_000), { progress: 0, daylight: false });
  assert.deepEqual(prayerSunArc(day.times, rise), { progress: 0, daylight: true });
  assert.deepEqual(prayerSunArc(day.times, (rise + set) / 2), { progress: 0.5, daylight: true });
  assert.deepEqual(prayerSunArc(day.times, set), { progress: 1, daylight: false });
  assert.equal(prayerSunArc({ ...day.times, sunrise: undefined }, rise), undefined);
  assert.deepEqual(splitPrayerRemaining(90 * 60_000), { hours: 1, minutes: 30 });
  assert.deepEqual(splitPrayerRemaining(-1000), { hours: 0, minutes: 0 });
  const calendar = calculatePrayerCalendar(cairo, day.key, 'Egyptian', 'standard');
  assert.equal(calendar.events.find((event) => event.at > day.times.fajr!)?.prayer, 'dhuhr');
  assert.deepEqual(calendar.events.find((event) => event.at > day.times.isha!), timings(cairo, '2026-11-19').events[0]);
});

test('the Home board and compact chip share the reminder location and calendar without a prayer API', () => {
  const clock = readFileSync(new URL('../src/components/VisitorLocalDashboard.tsx', import.meta.url), 'utf8');
  const board = readFileSync(new URL('../src/components/clock/PrayerTimesBoard.tsx', import.meta.url), 'utf8');
  const runtime = readFileSync(new URL('../src/components/clock/PrayerToolsRuntime.tsx', import.meta.url), 'utf8');
  assert.match(clock, /<PrayerClockSummary lang=\{currentLang\} now=\{now\} \/>/);
  assert.match(clock, /<PrayerClockSummary lang=\{currentLang\} now=\{now\} compact \/>/);
  for (const text of [board, runtime]) assert.match(text, /usePrayerCalendar\(/);
  for (const fragment of ['data-testid="prayer-times"', 'data-testid="prayer-chip"', 'prayer-arc', 'prayer-strip']) assert.ok(board.includes(fragment), fragment);
  assert.doesNotMatch(board, /fetch\(/);
});
