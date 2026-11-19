import assert from 'node:assert/strict';
import test from 'node:test';
import { compassPoint, compassXY, nextCompassRotation, normalizeBearing, readCompassBearing } from '../src/utils/visitorCompass';

test('the dial reads absolute heading clockwise from north and follows screen rotation', () => {
  for (const [alpha, expected] of [[0, 0], [270, 90], [180, 180], [90, 270], [360, 0]]) {
    assert.equal(Math.round(readCompassBearing({ absolute: true, alpha })!), expected);
  }
  assert.equal(readCompassBearing({ absolute: true, alpha: 90 }, 90), 0);
  assert.equal(readCompassBearing({ absolute: true, alpha: 90 }, -90), 180);
  assert.equal(Math.round(readCompassBearing({ absolute: true, alpha: 225, beta: 55, gamma: 10 })!), 135);
  assert.equal(readCompassBearing({ absolute: true, alpha: 225, beta: 90, gamma: 10 }), undefined, 'a vertical top edge has no bearing');
  assert.equal(Math.round(readCompassBearing({ absolute: true, alpha: 0, beta: 45, gamma: 45 }, 90)!), 55, 'landscape projects the physical side edge');
});

test('WebKit heading, including north at zero, outranks yaw; unusable samples never become north', () => {
  assert.equal(readCompassBearing({ absolute: false, alpha: 180, webkitCompassHeading: 0, webkitCompassAccuracy: 10 }), 0);
  assert.equal(readCompassBearing({ absolute: false, alpha: null, webkitCompassHeading: 350 }, 90), 80);
  assert.equal(readCompassBearing({ absolute: false, alpha: 270 }), undefined);
  assert.equal(readCompassBearing({ absolute: false, alpha: 200, webkitCompassHeading: 0, webkitCompassAccuracy: -1 }), undefined);
  assert.equal(readCompassBearing({ absolute: true, alpha: 270, webkitCompassHeading: 0, webkitCompassAccuracy: -1 }), 90);
  for (const alpha of [null, Number.NaN, -1, 361, Infinity]) {
    assert.equal(readCompassBearing({ absolute: true, alpha }), undefined);
  }
  assert.equal(readCompassBearing({ absolute: false, alpha: null, webkitCompassHeading: -1 }), undefined);
});

test('dial quadrants, degree normalization and shortest needle path agree', () => {
  assert.equal(compassPoint(359), 'north');
  assert.equal(compassPoint(45), 'northeast');
  assert.equal(compassPoint(90), 'east');
  assert.equal(compassPoint(350), 'north');
  assert.equal(compassPoint(-90), 'west');
  assert.equal(normalizeBearing(Math.round(359.99)), 0);
  assert.equal(nextCompassRotation(359, 0), 360);
  assert.equal(nextCompassRotation(360, 359), 359);
  assert.equal(nextCompassRotation(0, 359), -1);
  assert.deepEqual(compassXY(0, 60, 96), { x: 96, y: 36 });
  assert.deepEqual(compassXY(90, 60, 96), { x: 156, y: 96 });
  const south = compassXY(180, 60, 96);
  assert.ok(Math.abs(south.x - 96) < 1e-6 && Math.abs(south.y - 156) < 1e-6);
  const west = compassXY(270, 60, 96);
  assert.ok(Math.abs(west.x - 36) < 1e-6 && Math.abs(west.y - 96) < 1e-6);
});
