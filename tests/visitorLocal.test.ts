import assert from 'node:assert/strict';
import test from 'node:test';
import {
  browserVisitorLocation,
  isValidTimeZone,
  readCurrentWeather,
  readVisitorGeo,
  temperatureForVisitor,
  visitorLocale,
  weatherDescription,
  weatherKind,
} from '../src/utils/visitorLocal';

test('visitor local settings use a city-level timezone fallback without assuming Cairo for everyone', () => {
  const cairo = browserVisitorLocation('Africa/Cairo', ['ar-EG']);
  const riyadh = browserVisitorLocation('Asia/Riyadh', ['ar-SA']);
  const newYork = browserVisitorLocation('America/New_York', ['en-US']);
  assert.equal(cairo?.cityEn, 'Cairo');
  assert.equal(cairo?.country, 'EG');
  assert.equal(riyadh?.cityEn, 'Riyadh');
  assert.equal(riyadh?.country, 'SA');
  assert.equal(newYork?.cityEn, 'New York');
  assert.equal(newYork?.country, 'US');
  assert.equal(browserVisitorLocation('Not/A-Timezone', []), undefined);
  assert.equal(isValidTimeZone('Africa/Cairo'), true);
  assert.equal(isValidTimeZone('Not/A-Timezone'), false);
});

test('visitor geo replies are validated before use, and local formatting follows the entry country', () => {
  const geo = readVisitorGeo({
    country: 'sa',
    location: { placeId: 'SA:riyadh', country: 'SA', cityAr: 'الرياض', cityEn: 'Riyadh', lat: 24.71, lon: 46.68, precision: 'edge-city', timezone: 'Asia/Riyadh' },
  });
  assert.equal(geo.country, 'SA');
  assert.equal(geo.location?.cityEn, 'Riyadh');
  assert.equal(geo.location?.timezone, 'Asia/Riyadh');
  const timezoneFallback = readVisitorGeo({ country: 'JP', location: { placeId: 'JP:tokyo', country: 'JP', cityAr: 'طوكيو (نطاق التوقيت)', cityEn: 'Tokyo (TZ zone)', lat: 35.68, lon: 139.69, precision: 'timezone', timezone: 'Asia/Tokyo' } });
  assert.equal(timezoneFallback.location?.cityEn, 'Tokyo', 'the card shows a clean city name and explains the approximation separately');
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
