/**
 * «حارس المدفوعات والعمولات»: the guard stops a broken cart instantly, lets a clean one through, and the daily
 * auditor proves it is still wired in front of both payment paths. No money moves in these tests.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PAYMENT_HELD, SHIELD_LIMITS, reviewCharge, type ShieldInput } from '../src/finance/shield';
import { SHIELD_DRILLS, auditShield } from '../scripts/shaheen-finance/shield';

const now = new Date('2026-10-24T00:00:00Z');
const cart = (over: Partial<ShieldInput> = {}): ShieldInput => ({
  country: 'EG', displayCurrency: 'EGP', chargeCurrency: 'EGP', officialCurrency: 'EGP', accepted: ['EGP'],
  lines: [{ sku: 'A', qty: 2, unit: 500, subtotal: 1000 }], items: 1000, shipping: 75, total: 1075,
  commissionRate: 0.2, supplierCost: 700, ...over,
});

test('a clean cart passes; a broken one is held with the right reason', () => {
  const ok = reviewCharge(cart(), now);
  assert.equal(ok.ok, true);
  assert.equal(ok.verdict, 'pass');
  assert.deepEqual(ok.findings, []);

  const tampered = reviewCharge(cart({ total: 600 }), now);
  assert.equal(tampered.ok, false);
  assert.ok(tampered.findings.some((f) => f.code === 'TOTAL_MATH' && f.level === 'stop'));

  const foreign = reviewCharge(cart({ chargeCurrency: 'EUR', displayCurrency: 'EUR' }), now);
  assert.equal(foreign.ok, false);
  assert.ok(foreign.findings.some((f) => f.code === 'CHARGE_CURRENCY_NOT_COUNTRY'));

  const doubled = reviewCharge(cart({ lines: [{ sku: 'A', qty: 1, unit: 500, subtotal: 500 }, { sku: 'A', qty: 1, unit: 500, subtotal: 500 }], items: 1000 }), now);
  assert.ok(doubled.findings.some((f) => f.code === 'DUPLICATE_LINE'));

  const negative = reviewCharge(cart({ shipping: -75, total: 925 }), now);
  assert.ok(negative.findings.some((f) => f.code === 'INVALID_SHIPPING'));

  const absurd = reviewCharge(cart({ commissionRate: 0.9 }), now);
  assert.ok(absurd.findings.some((f) => f.code === 'COMMISSION_RANGE'));

  assert.equal(PAYMENT_HELD.code, 'PAYMENT_HELD');
  assert.ok(PAYMENT_HELD.ar.length > 10 && PAYMENT_HELD.en.length > 10);
  assert.ok(SHIELD_LIMITS.maxQtyPerLine === 99);
});

test('warnings never stop a sale: the accepted fallback and a below-cost cart are recorded, not blocked', () => {
  const fallback = reviewCharge(cart({ chargeCurrency: 'USD', displayCurrency: 'USD', accepted: ['EGP', 'USD'] }), now);
  assert.equal(fallback.ok, true, 'a currency the gateway really accepts is not a hold');
  assert.ok(fallback.findings.some((f) => f.code === 'CHARGE_CURRENCY_FALLBACK' && f.level === 'warn'));

  const belowCost = reviewCharge(cart({ supplierCost: 9_000 }), now);
  assert.equal(belowCost.ok, true);
  assert.ok(belowCost.findings.some((f) => f.code === 'BELOW_COST' && f.level === 'warn'));

  const precision = reviewCharge(cart({ chargeCurrency: 'JPY', displayCurrency: 'JPY', officialCurrency: 'JPY', accepted: ['JPY'], total: 1075.555 }), now);
  assert.ok(precision.findings.some((f) => f.code === 'PRECISION'), 'a currency\'s own precision is respected');
});

test('every drill keeps holding: the guard still recognises each way money goes wrong', () => {
  for (const drill of SHIELD_DRILLS) {
    const verdict = reviewCharge(drill.input, now);
    if (drill.expect === 'pass') assert.equal(verdict.ok, true, drill.id);
    else {
      assert.equal(verdict.ok, false, `${drill.id} must be held`);
      if (drill.expectCode) assert.ok(verdict.findings.some((f) => f.code === drill.expectCode), `${drill.id} → ${drill.expectCode}`);
    }
  }
});

test('the auditor: the guard is wired in both payment paths of the real checkout', () => {
  const source = readFileSync('server/checkout.ts', 'utf8');
  const report = auditShield({
    now: now.getTime(), checkoutSource: source,
    live: [
      { country: 'EG', official: 'EGP', currency: 'EGP', enabled: true },
      { country: 'SA', official: 'SAR', currency: 'SAR', enabled: true },
      { country: 'FR', official: 'EUR', currency: 'USD', enabled: true },
      { country: 'JP', official: 'JPY', enabled: false },
    ],
    probeFailed: [], gateways: { enabled: true, mode: 'test' },
  });
  assert.equal(report.guard.wired, true, 'reviewCharge must be called before a session AND before a direct receipt');
  assert.equal(report.guard.calls, 2);
  assert.equal(report.drills.failed.length, 0);
  assert.equal(report.drills.passed, SHIELD_DRILLS.length);
  assert.deepEqual(report.live.mismatches, [{ country: 'FR', official: 'EUR', charged: 'USD' }]);
  assert.ok(report.planAr.some((l) => l.includes('FR')));
  assert.ok(report.score < 100 && report.score > 60);
});

test('the auditor fails honestly when the guard is removed', () => {
  const report = auditShield({ now: now.getTime(), checkoutSource: 'const x = 1;', live: [], probeFailed: ['EG:HTTP_503'], gateways: { enabled: false } });
  assert.equal(report.guard.wired, false);
  assert.ok(report.planAr.some((l) => l.includes('reviewCharge')));
  assert.ok(report.notes.some((n) => n.includes('مش موصول')));
  assert.ok(report.score <= 70);
});
