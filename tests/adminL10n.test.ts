/**
 * Phase 3 — the admin panel is no longer Arabic-only.
 *
 * The panel keys every string by its Arabic source text and resolves the current
 * language, degrading to English and finally to the Arabic source, so a missing
 * translation can never render an empty label.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { ADMIN_STRINGS, T, TP, adminCoverage, adminDir, adminLocale, adminStringCount, listSep, reactiveMap, setAdminLang } from '../src/admin/adminL10n';

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

test('TP() fills runtime values into a translated template', () => {
  setAdminLang('en');
  assert.equal(TP('إشعار البريد متاح: {email}', { email: 'a@b.com' }), 'Email notification available: a@b.com');
  setAdminLang('ar');
  assert.equal(TP('إشعار البريد متاح: {email}', { email: 'a@b.com' }), 'إشعار البريد متاح: a@b.com');
  setAdminLang('en');
  // unknown placeholders and unused vars must not break the message
  assert.equal(TP('إشعار البريد متاح: {email}', {}), 'Email notification available: {email}');
});

test('the list separator and date locale follow the chosen language', () => {
  setAdminLang('en');
  assert.equal(listSep(), ', ');
  assert.equal(adminLocale(), 'en');
  setAdminLang('ar');
  assert.equal(listSep(), '، ');
  assert.equal(adminLocale(), 'ar-EG');
});

test('reactiveMap re-translates its labels when the language changes', () => {
  const labels = reactiveMap(() => ({ ok: T('ممتاز') }));
  setAdminLang('en');
  assert.equal(labels.ok, 'Excellent');
  setAdminLang('ar');
  assert.equal(labels.ok, 'ممتاز');
});

test('no admin screen still ships a hard-coded Arabic label', () => {
  // The only Arabic that may stay in code is the comma inside the CSV split regex.
  const allow = /[,،]/;
  for (const file of ['AdminApp.tsx', 'SupervisorPanel.tsx', 'UpdatesPanel.tsx', 'ShaheenGrowthPanel.tsx', 'SeoPanel.tsx', 'ShaheenCouncilPanel.tsx', 'ShaheenOrgPanel.tsx', 'ShaheenPatrolPanel.tsx', 'ContractsPanel.tsx', 'AiStudioBridgePanel.tsx', 'DesignStudioPanel.tsx', 'OwnerControlPanel.tsx', 'OwnerSuite.tsx', 'OwnerRoom.tsx', 'ChangeCard.tsx', 'OrderCard.tsx', 'OwnerInbox.tsx', 'deskRequest.ts', 'PlatformStatePanel.tsx', 'StateRoom.tsx']) {
    let src = readFileSync(new URL(`../src/admin/${file}`, import.meta.url), 'utf8');
    src = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    src = src.replace(/TP\('(?:[^'\\]|\\.)*'[^)]*\)/g, '').replace(/T\('(?:[^'\\]|\\.)*'\)/g, '');
    const offenders = src
      .split('\n')
      .map((line, index) => [index + 1, line] as const)
      .filter(([, line]) => /[\u0600-\u06FF]/.test(line) && !allow.test(line));
    assert.deepEqual(offenders, [], `${file} still has untranslated Arabic: ${JSON.stringify(offenders.slice(0, 3))}`);
  }
});
