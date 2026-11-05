import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AdminApiError } from '../src/admin/adminApi';
import { GOVERNANCE_ENV_NAME, governanceErrorText, newGovernanceKey } from '../src/admin/GovernancePanel';
import { setAdminLang } from '../src/admin/adminL10n';

test('«اعمل مفتاح جديد» makes a long, URL-safe, unpredictable governance key on the owner\'s device', () => {
  const keys = new Set(Array.from({ length: 50 }, () => newGovernanceKey()));
  assert.equal(keys.size, 50, 'never repeats');
  for (const k of keys) {
    assert.equal(k.length, 43, '32 random bytes');
    assert.match(k, /^[A-Za-z0-9_-]+$/, 'safe to paste anywhere — no spaces, quotes or padding');
    assert.ok(k.length >= 24, 'the server refuses keys shorter than 24');
  }
  assert.equal(GOVERNANCE_ENV_NAME, 'SHAM_GOVERNANCE_OWNER_TOKEN');
  assert.match(readFileSync(new URL('../server/governance/router.ts', import.meta.url), 'utf8'), new RegExp(`env\\.${GOVERNANCE_ENV_NAME}`));
});

test('the key and the governance data never touch browser storage or the network from the key maker', () => {
  const src = readFileSync(new URL('../src/admin/GovernancePanel.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /localStorage|sessionStorage|indexedDB|document\.cookie/);
  assert.match(src, /crypto\.getRandomValues/);
  const maker = src.slice(src.indexOf('function KeyMaker'), src.indexOf('const blank'));
  assert.doesNotMatch(maker, /fetch\(|adminRequest|sendBeacon/, 'the new key is only shown to the owner');
});

test('each server refusal tells the owner what to do in plain words', () => {
  setAdminLang('ar');
  assert.match(governanceErrorText(new AdminApiError(503, 'OWNER_NOT_CONFIGURED', 'x')), /اعمل مفتاح جديد/);
  assert.match(governanceErrorText(new AdminApiError(403, 'OWNER_REQUIRED', 'x')), /إعادة نشر/);
  assert.match(governanceErrorText(new AdminApiError(429, 'RATE_LIMITED', 'x')), /ربع ساعة/);
  assert.match(governanceErrorText(new AdminApiError(503, 'GOVERNANCE_STORAGE_REQUIRED', 'x')), /قاعدة البيانات/);
  assert.equal(governanceErrorText(new Error('boom')), 'boom');
});

test('the governance record uses the durable store (the connected Neon database), not the temporary core memory', () => {
  const http = readFileSync(new URL('../server/core/http.ts', import.meta.url), 'utf8');
  assert.match(http, /admin\.use\('\/governance', createGovernanceRouter\(durable, env\)\)/);
});
