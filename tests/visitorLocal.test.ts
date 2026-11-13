import assert from 'node:assert/strict';
import test from 'node:test';
import {
  browserVisitorCountry,
  fetchVisitorWeather,
  isValidTimeZone,
  readCurrentWeather,
  readVisitorGeo,
  temperatureForVisitor,
  visitorLocale,
  weatherDescription,
  weatherKind,
} from '../src/utils/visitorLocal';
import { resolveDeviceLocation } from '../src/data/worldEntryGazetteer';

test('timezone gives only local time/country; approved device coordinates identify Aswan instead of Cairo', () => {
  assert.equal(browserVisitorCountry('Africa/Cairo', ['ar-EG']), 'EG');
  assert.equal(browserVisitorCountry('Asia/Riyadh', ['ar-SA']), 'SA');
  assert.equal(browserVisitorCountry('America/New_York', ['en-US']), 'US');
  assert.equal(browserVisitorCountry('Not/A-Timezone', []), undefined);

  const aswan = resolveDeviceLocation(24.09, 32.90, 12);
  assert.equal(aswan.cityEn, 'Aswan');
  assert.equal(aswan.cityAr, 'أسوان');
  assert.equal(aswan.country, 'EG');
  assert.equal(aswan.precision, 'device-gps');
  assert.equal(aswan.lat, 24.09);
  assert.equal(aswan.lon, 32.9);

  const uncertain = resolveDeviceLocation(24.09, 32.90, 40_000);
  assert.equal(uncertain.cityEn, 'Your current location', 'coarse GPS accuracy must not claim a named city');
  assert.throws(() => resolveDeviceLocation(91, 32.90), /INVALID_DEVICE_COORDINATES/);
  assert.throws(() => resolveDeviceLocation(0, 0), /INVALID_DEVICE_COORDINATES/);

  assert.equal(isValidTimeZone('Africa/Cairo'), true);
  assert.equal(isValidTimeZone('Not/A-Timezone'), false);
});

test('timezone-only guesses are not sent to the weather service as if they were a city', async () => {
  await assert.rejects(fetchVisitorWeather({
    placeId: 'EG:timezone', country: 'EG', cityAr: 'القاهرة', cityEn: 'Cairo', lat: 30.04, lon: 31.24, precision: 'timezone', timezone: 'Africa/Cairo',
  }), /City-level location is not available/);
});

test('visitor geo replies are validated before use, and local formatting follows the entry country', () => {
  const geo = readVisitorGeo({
    country: 'sa',
    timezone: 'Asia/Riyadh',
    location: { placeId: 'SA:riyadh', country: 'SA', cityAr: 'الرياض', cityEn: 'Riyadh', lat: 24.71, lon: 46.68, precision: 'edge-city' },
  });
  assert.equal(geo.country, 'SA');
  assert.equal(geo.location?.cityEn, 'Riyadh');
  assert.equal(geo.timezone, 'Asia/Riyadh');
  assert.equal(geo.location?.timezone, undefined, 'clock metadata stays separate from city identity');
  const timezoneFallback = readVisitorGeo({ country: 'JP', timezone: 'Asia/Tokyo', location: null });
  assert.equal(timezoneFallback.timezone, 'Asia/Tokyo');
  assert.equal(timezoneFallback.location, undefined, 'a timezone identifies the clock, not a city');
  assert.deepEqual(readVisitorGeo({ country: 'ZZ', location: { cityEn: 'Unknown' } }), {});
  assert.equal(visitorLocale('en', 'US'), 'en-US');
  assert.equal(visitorLocale('ar', 'EG'), 'ar-EG');
});

test('current weather values and conditions are parsed and formatted locally', () => {
  assert.deepEqual(readCurrentWeather({ current: { temperature_2m: 26.5, weather_code: 2, time: '2026-10-24T14:00' } }), {
    temperatureC: 26.5, weatherCode: 2, observedAt: '2026-10-24T14:00',
  });
  assert.deepEqual(readCurrentWeather({ temperatureC: -4, weatherCode: 71 }), { temperatureC: -4, weatherCode: 71 });
  assert.equal(readCurrentWeather({ current: { temperature_2m: 900, weather_code: 2 } }), undefined);
  assert.equal(readCurrentWeather({ current: { temperature_2m: 10, weather_code: 200 } }), undefined);
  assert.deepEqual(temperatureForVisitor(20, 'US'), { value: 68, unit: '°F' });
  assert.deepEqual(temperatureForVisitor(20, 'EG'), { value: 20, unit: '°C' });
  assert.equal(weatherKind(95), 'storm');
  assert.equal(weatherDescription(95, 'ar'), 'عاصفة رعدية');
});
