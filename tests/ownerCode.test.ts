import test from 'node:test';
import assert from 'node:assert/strict';
import { codeCandidates, plainCode, typedInArabic } from '../src/admin/ownerCode';
import { cleanToken } from '../src/admin/adminApi';
import { adminSecret } from '../server/core/adminSecret';

test('a code typed with the keyboard in Arabic is read as the keys pressed', () => {
  assert.deepEqual(codeCandidates('شسي١٢٣'), ['asd123']);
  assert.deepEqual(codeCandidates('ضصثقفغعهخح'), ['qwertyuiop']);
  assert.deepEqual(codeCandidates('أ'), ['H']);
  // «لا» is one key (b) and also g then h: both are offered, b first.
  assert.deepEqual(codeCandidates('لاشس'), ['bas', 'ghas']);
  assert.ok(typedInArabic('شسي'));
  assert.ok(!typedInArabic('abc123'));
});

test('a Latin code is sent exactly once, unchanged apart from invisible marks and Arabic digits', () => {
  assert.deepEqual(codeCandidates('  Sham-Code_2026 '), ['Sham-Code_2026']);
  assert.deepEqual(codeCandidates('\u200fSham\u200bCode\u200e'), ['ShamCode']);
  assert.equal(plainCode('abc٤٥٦۷'), 'abc4567');
  assert.equal(cleanToken('\u202aabc٤٥٦\n'), 'abc456');
  assert.deepEqual(codeCandidates('   '), []);
});

test('the server reads the saved code without pasted quotes, the whole line or invisible marks', () => {
  assert.equal(adminSecret({ SHAM_ADMIN_TOKEN: ' "abcdefghijklmnop" ' }), 'abcdefghijklmnop');
  assert.equal(adminSecret({ SHAM_ADMIN_TOKEN: "'abcdefghijklmnop'" }), 'abcdefghijklmnop');
  assert.equal(adminSecret({ SHAM_ADMIN_TOKEN: 'SHAM_ADMIN_TOKEN=abcdefghijklmnop' }), 'abcdefghijklmnop');
  assert.equal(adminSecret({ SHAM_ADMIN_TOKEN: '\u200fabcdefghijklmnop\n' }), 'abcdefghijklmnop');
  assert.equal(adminSecret({ SHAM_ADMIN_TOKEN: 'ab"cd' }), 'ab"cd');
  assert.equal(adminSecret({}), '');
});
