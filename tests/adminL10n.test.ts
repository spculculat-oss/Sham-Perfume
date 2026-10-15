/**
 * Phase 3 — the admin panel is no longer Arabic-only.
 *
 * The panel keys every string by its Arabic source text and resolves the current
 * language, degrading to English and finally to the Arabic source, so a missing
 * translation can never render an empty label.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { ADMIN_STRINGS, T, adminCoverage, adminDir, adminStringCount, setAdminLang } from '../src/admin/adminL10n';

test('Arabic is the source language and always renders the original text', () => {
  setAdminLang('ar');
  assert.equal(T('نظرة عامة'), 'نظرة عامة');
  assert.equal(T('قاعدة المعرفة'), 'قاعدة المعرفة');
  assert.equal(T('رمز الإدارة'), 'رمز الإدارة');
  assert.equal(adminDir(), 'rtl');
});

test('English translations resolve for the admin shell', () => {
  setAdminLang('en');
  assert.equal(T('نظرة عامة'), 'Overview');
  assert.equal(T('المساعد الإداري'), 'Admin assistant');
  assert.equal(T('مختبر المساعد'), 'Assistant sandbox');
  assert.equal(T('مكتمل'), 'Completed');
  assert.equal(adminDir(), 'ltr');
});

test('a language without its own entry degrades to English, never to an empty label', () => {
  setAdminLang('fr');
  assert.equal(T('نظرة عامة'), 'Overview');
  setAdminLang('fa');
  assert.equal(T('الخدمات'), 'Services');
  assert.equal(adminDir(), 'rtl');
});

test('unknown strings pass through untouched (nothing can go blank)', () => {
  setAdminLang('en');
  assert.equal(T('نص غير موجود في القاموس'), 'نص غير موجود في القاموس');
});

test('the dictionary carries the admin shell with full English coverage', () => {
  assert.ok(adminStringCount() >= 300, `expected a populated dictionary, got ${adminStringCount()}`);
  assert.equal(adminCoverage('en'), adminStringCount());
  for (const entry of Object.values(ADMIN_STRINGS)) {
    const english = entry.en;
    assert.equal(typeof english, 'string');
    assert.ok((english ?? '').length > 0);
  }
});
