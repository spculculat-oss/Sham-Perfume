import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  SKY_PHASES,
  SKY_THEMES,
  hourInZone,
  nextSkyPhase,
  skyGlowX,
  skyPhaseAtHour,
  skyPhaseFor,
  skyTilt,
} from '../src/utils/clockSky';

test('the glass light follows the local hour through a full day', () => {
  assert.equal(skyPhaseAtHour(5), 'dawn');
  assert.equal(skyPhaseAtHour(6.9), 'dawn');
  assert.equal(skyPhaseAtHour(7), 'morning');
  assert.equal(skyPhaseAtHour(11), 'noon');
  assert.equal(skyPhaseAtHour(15), 'afternoon');
  assert.equal(skyPhaseAtHour(18), 'dusk');
  assert.equal(skyPhaseAtHour(20), 'night');
  assert.equal(skyPhaseAtHour(0), 'night');
  assert.equal(skyPhaseAtHour(4.5), 'night');
  assert.equal(skyPhaseAtHour(-2), 'night', 'negative hours wrap into the evening');
  assert.equal(skyPhaseAtHour(Number.NaN), 'night', 'an unknown hour never breaks the card');
  for (const hour of [0, 5, 8, 12, 17, 19, 23]) assert.ok(SKY_PHASES.includes(skyPhaseAtHour(hour)));
});

test('every phase has a theme and the manual play wraps around the day', () => {
  for (const phase of SKY_PHASES) {
    const theme = SKY_THEMES[phase];
    for (const colour of [theme.glow, theme.wash, theme.sheen, theme.base]) assert.match(colour, /^(rgba?\(|#)/);
  }
  assert.equal(nextSkyPhase('night'), 'dawn');
  assert.equal(nextSkyPhase('dawn'), 'morning');
  assert.equal(new Set(SKY_PHASES.map(nextSkyPhase)).size, SKY_PHASES.length, 'the cycle visits every phase once');
});

test('the visitor hour is read in their own zone, with UTC as the explicit fallback', () => {
  const now = new Date('2026-11-13T19:30:00Z');
  assert.equal(hourInZone(now, 'Africa/Cairo'), 21);
  assert.equal(hourInZone(now, 'UTC'), 19);
  assert.equal(hourInZone(now, 'Not/A-Timezone'), undefined);
  assert.equal(hourInZone(new Date(Number.NaN), 'UTC'), undefined);
  assert.equal(skyPhaseFor(now, 'Africa/Cairo'), 'night');
  assert.equal(skyPhaseFor(new Date('2026-11-13T09:00:00Z'), 'UTC'), 'morning');
  assert.equal(skyPhaseFor(undefined, 'UTC'), 'night', 'before the internet clock answers the glass stays calm');
});

test('a drag turns the shine but never past the edge, and the pointer glides across the glass', () => {
  assert.equal(skyTilt(0, 600), 0);
  assert.equal(skyTilt(600, 600), 22);
  assert.equal(skyTilt(-600, 600), -22);
  assert.equal(skyTilt(30, 600), 9);
  assert.equal(skyTilt(30, 0), 0);
  assert.equal(skyTilt(Number.NaN, 600), 0);
  assert.equal(skyGlowX(0, 0, 500), 4);
  assert.equal(skyGlowX(500, 0, 500), 96);
  assert.equal(skyGlowX(250, 0, 500), 50);
  assert.equal(skyGlowX(50, 100, 500), 4, 'a pointer outside the card is pinned to the edge');
  assert.equal(skyGlowX(10, 0, 0), 50);
});

test('the clock card and the shared compact bar both carry the living glass', () => {
  const dashboard = readFileSync(new URL('../src/components/VisitorLocalDashboard.tsx', import.meta.url), 'utf8');
  const legend = readFileSync(new URL('../src/components/clock/ClockSkyLegend.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/components/clock/clock.css', import.meta.url), 'utf8');
  assert.match(dashboard, /visitor-clock-compact-shell clock-glass/, 'the shared compact bar uses the glass');
  assert.match(dashboard, /clock-glass overflow-hidden rounded-\[28px\]/, 'the Home card keeps its bronze body and gains the glass');
  assert.match(dashboard, /className="clock-glass-sheen"/);
  assert.match(dashboard, /useClockSky\(now/);
  assert.match(dashboard, /<ClockSkyLegend sky=\{sky\} lang=\{currentLang\} compact \/>/);
  assert.match(legend, /toggleCompass/);
  assert.match(legend, /sky\.cycle/);
  assert.match(css, /\.clock-glass-sheen/);
  assert.match(css, /prefers-reduced-motion/);
});
