import assert from 'node:assert/strict';
import test from 'node:test';
import { KAABA, qiblaAt, qiblaDial } from '../src/utils/qibla';
import { nextCompassRotation, normalizeBearing } from '../src/utils/visitorCompass';

const now = new Date('2026-11-18T00:00:00Z');
const at = (lat: number, lon: number, accuracy = 0) => qiblaAt(lat, lon, accuracy, now);
const close = (a: number | undefined, b: number, tolerance = 1e-5) => {
  assert.ok(a !== undefined && Math.abs(a - b) < tolerance, `${a} ≠ ${b} ± ${tolerance}`);
};

test('Qibla is the initial great-circle bearing from the chosen point, not a planar map angle', () => {
  const points = [
    [30.0444, 31.2357, 136.1373],  // Cairo
    [51.51, -0.13, 118.9872],     // London
    [40.71, -74.01, 58.4791],     // New York: northeast, not the compass direction on a flat map
    [-6.21, 106.85, 295.1510],    // Jakarta
    [-33.87, 151.21, 277.4986],   // Sydney
    [0, KAABA.longitude, 0],      // same meridian, south of the Kaaba
    [45, KAABA.longitude, 180],   // same meridian, north of the Kaaba
  ];
  for (const [lat, lon, bearing] of points) close(at(lat, lon)?.bearing, bearing, 0.001);
  close(at(-20, 180)?.bearing, at(-20, -180)!.bearing);
});

test('no Qibla is reported for a pole, the destination, antipode or an overly uncertain fix', () => {
  for (const [lat, lon, accuracy] of [
    [NaN, 31, 1], [30, Infinity, 4], [-90, 31, 1], [90, 31, 1], [30, 181, 1],
    [30, 31, NaN], [30, 31, -1], [30, 31, 26_000],
    [KAABA.latitude, KAABA.longitude, 0], [-KAABA.latitude, KAABA.longitude - 180, 0],
    [KAABA.latitude - 0.00001, KAABA.longitude, 0], [KAABA.latitude - 0.001, KAABA.longitude, 25],
    [-KAABA.latitude + 0.001, KAABA.longitude - 180, 25],
  ]) assert.equal(at(lat, lon, accuracy), undefined, `invalid or uncertain fix: ${lat}, ${lon}, ${accuracy}`);
  close(at(KAABA.latitude - 0.001, KAABA.longitude, 5)?.bearing, 0);
  close(at(KAABA.latitude + 0.001, KAABA.longitude, 5)?.bearing, 180);
});

test('offline magnetic correction uses NOAA WMM2025 values, and is not extrapolated', () => {
  // NOAA's WMM2025_TEST_VALUES.txt sea-level rows, in degrees east of geographic reference.
  const epoch = new Date('2025-01-01T00:00:00Z');
  close(qiblaAt(80, 0, 0, epoch)?.declination, 1.28, 0.02);
  close(qiblaAt(0, 120, 0, epoch)?.declination, -0.16, 0.02);
  close(qiblaAt(-80, -120, 0, epoch)?.declination, 68.78, 0.02);
  assert.equal(qiblaAt(30, 31, 0, new Date('2024-12-31T23:59:59Z'))?.declination, undefined);
  assert.notEqual(qiblaAt(30, 31, 0, new Date('2029-12-31T23:59:59Z'))?.declination, undefined);
  assert.equal(qiblaAt(30, 31, 0, new Date('2030-01-01T00:00:00Z'))?.declination, undefined);
  assert.equal(at(85, -145)?.declination, undefined, 'weak horizontal magnetic field');
  assert.ok(at(85, -145)?.bearing, 'weak magnetic field does not erase the geographic bearing');
});

test('Qibla arrow lines up with the dial scale, uses signed correction and keeps a short arc through north', () => {
  for (const declination of [-12, 0, 5]) {
    const direction = { bearing: 136, declination };
    const magnetic = 136 - declination;
    assert.deepEqual(qiblaDial(direction, magnetic), { live: true, northRotation: -136, pointerRotation: 0, aligned: true });
    assert.equal(qiblaDial(direction, magnetic - 10).pointerRotation, 10, 'arrow to the right when heading is counterclockwise of target');
    assert.equal(qiblaDial(direction, magnetic + 10).pointerRotation, -10);
    const before = qiblaDial(direction, 359);
    const after = qiblaDial(direction, nextCompassRotation(359, 0));
    close(after.pointerRotation - before.pointerRotation, -1);
    close(normalizeBearing(after.pointerRotation - after.northRotation), direction.bearing);
  }
  assert.equal(qiblaDial({ bearing: 1, declination: 0 }, 359).aligned, true);
  assert.equal(qiblaDial({ bearing: 10, declination: 0 }, 359).aligned, false);
  assert.equal(qiblaDial({ bearing: 136, declination: 0 }, 0).live, true, 'zero is a real heading');
  const map = { live: false, northRotation: 0, pointerRotation: 136, aligned: false };
  assert.deepEqual(qiblaDial({ bearing: 136, declination: 3 }), map);
  assert.deepEqual(qiblaDial({ bearing: 136 }, 136), map);
});
