import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ADMIN_TIME_ZONE, formatAdminClock } from '../src/admin/adminClock';

test('the admin overview clock shows localized Cairo date and time regardless of device zone', () => {
  const now = new Date('2024-01-15T12:34:56.000Z');
  const clock = formatAdminClock(now, 'en-GB');
  assert.equal(ADMIN_TIME_ZONE, 'Africa/Cairo');
  assert.equal(clock.date, 'Monday, 15 January 2024');
  assert.equal(clock.time, '14:34:56');
  assert.equal(clock.dateTime, now.toISOString());
});

test('the overview shortcuts lead to existing robot-help workflows', () => {
  const source = readFileSync(new URL('../src/admin/AdminApp.tsx', import.meta.url), 'utf8');
  for (const tab of ['agent', 'sandbox', 'supervisor']) {
    assert.match(source, new RegExp(`tab: '${tab}'`), `missing admin help route to ${tab}`);
  }
  assert.match(source, /onClick=\{\(\) => go\(path\.tab\)\}/);
  assert.match(source, /data-testid="admin-date-time"/);
  assert.match(source, /data-testid="admin-robot-help"/);
  assert.match(source, /data-testid="admin-clock-robot-link" type="button" onClick=\{\(\) => go\('opsmap'\)\}/);
});

test('the owner office has its own live clock and shortcuts to Shaheen and robot work', () => {
  const source = readFileSync(new URL('../src/admin/OwnerSuite.tsx', import.meta.url), 'utf8');
  for (const section of ['room', 'org', 'governance', 'inbox']) {
    assert.match(source, new RegExp(`section: '${section}'`), `missing owner-office robot route to ${section}`);
  }
  assert.match(source, /data-testid="owner-date-time"/);
  assert.match(source, /data-testid="owner-robot-help"/);
  assert.match(source, /data-testid="owner-clock-robot-link" type="button" onClick=\{\(\) => go\('ops'\)\}/);
});
