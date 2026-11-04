/**
 * «قاموس أخطاء الدفع» — كل كود في مسار الفلوس لازم يكون له تفسير عربي وإصلاح.
 * اللي الاختبارات دي بتحميه:
 *   · أي كود خطأ يظهر في كود الدفع/السجل/البوابة لازم يكون في القاموس، ومفيش كود مجهول يُعرض على الزائر.
 *   · explainFault يرجع جملة للزائر + تفسير للمالك + جهة المسؤولة لكل كود معروف.
 *   · الكود غير المعروف يرجع "غير موثّق" مع تحذير، jamais رقم أو تخمين.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { FAULTS, explainFault, faultCodes, isKnownFault } from '../src/finance/errors';

const root = new URL('..', import.meta.url).pathname;
const readText = (rel: string) => readFileSync(new URL('../'+rel, import.meta.url), 'utf8');

// كل الكود اللي يظهر في مسار الدفع لازم يكون موثّق
const USED_FILES = [
  'server/checkout.ts', 'server/finance/service.ts', 'src/utils/cardNetwork.ts',
  'src/utils/storeCheckout.ts', 'src/finance/shield.ts',
];

test('قاموس الأخطاء: مفيش كود مستخدم من غير تفسير', () => {
  const used = new Set<string>();
  for (const f of USED_FILES) {
    const text = readText(f);
    for (const m of text.matchAll(/code:?\s*[:=]\s*'([A-Z][A-Z_]{2,})'/g)) used.add(m[1]);
    for (const m of text.matchAll(/error\('([A-Z][A-Z_]{2,})'/g)) used.add(m[1]);
    for (const m of text.matchAll(/KashierError\('([A-Z][A-Z_]{2,})'/g)) used.add(m[1]);
  }
  const known = new Set(FAULTS.map((f) => f.code));
  const unexplained = [...used].filter((c) => !known.has(c));
  assert.equal(unexplained.length, 0, `هناك أكواد غير موثّقة في القاموس: ${unexplained.join('، ')}`);
});

test('cause: explainFault يرجع تفسير لكل كود معروف', () => {
  for (const f of FAULTS) {
    const ar = explainFault(f.code, 'ar');
    const en = explainFault(f.code, 'en');
    assert.equal(ar.code, f.code);
    assert.ok(ar.ar && ar.ar.length > 0);
    assert.ok(en.en && en.en.length > 0);
    assert.ok(ar.whyAr && ar.whyAr.length > 0);
    assert.ok(ar.fixAr && ar.fixAr.length > 0);
    assert.ok(['visitor', 'merchant', 'gateway', 'robot'].includes(ar.owner));
    assert.ok(['stop', 'warn'].includes(ar.level));
  }
});

test('cause: الكود غير المعروف يرجع "غير موثّق" مع تحذير، Jamais رقم', () => {
  const unk = explainFault('CODE_MISH_MASH_999', 'ar');
  assert.equal(unk.code, 'CODE_MISH_MASH_999');
  assert.equal(unk.level, 'warn');
  assert.ok(/مش موث/.test(unk.ar));
  assert.equal(isKnownFault('CODE_MISH_MASH_999'), false);
  assert.equal(isKnownFault('PAYMENT_HELD'), true);
});
