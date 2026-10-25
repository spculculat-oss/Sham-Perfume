/**
 * «المكسب 50% صافي» — القاعدة اللي صاحب المتجر طلبها (2026-10-26) متحققة في المحرك نفسه:
 * الشحن اللي الزائر بيدفعه = تكلفة الشركة المنشورة للمسار + هامش تجهيز صغير، فالشحن ماياكلش من الـ50%.
 *
 * الاختبار بيقرا الملفات الحقيقية (shipping.json + shipping-costs.json + products.json) وتقرير الشحن،
 * عشان أي رقم يتحرك في أي اتجاه (هامش أقل من التكلفة، أو تكلفة اتغيّرت) يفشل هنا قبل ما يوصل الزائر.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  BUNDLED_FX, HOME_CURRENCY, SHIPPING, SHIPPING_COSTS, convert, handlingFee, netAfterShipping,
  quote, realShipping, shippingCost, shippingIsCostBased, shippingZone, freeShippingAbove, type ShippingTable,
} from '../src/utils/pricing';

const root = new URL('..', import.meta.url).pathname;
const read = (rel: string) => JSON.parse(readFileSync(join(root, rel), 'utf8'));
type Money = { profitPerBottleEgp: number; costBasedDestinations: number; uncoveredDestinations: number; medianShippingMarginEgp: number | null };
const report = read('src/data/live/trade-lanes.json') as { destinations: { code: string; proposedChargedEgp: number | null; costEgp: [number, number] | null }[]; money: Money };
const catalog = (read('src/data/products.json') as { products: { supplierPrice?: number; ourPrice?: number; published?: boolean }[] }).products;

const covered = Object.keys(SHIPPING_COSTS.countries);
const cap = Number(SHIPPING.handling?.capUsd) || 0;
const percent = Number(SHIPPING.handling?.percent) || 0;

test('the cost table is real: every destination has a published cost with a source and a date', () => {
  assert.ok(covered.length >= 70, `only ${covered.length} destinations have a published shipping cost`);
  assert.ok(typeof SHIPPING_COSTS.source === 'string' && SHIPPING_COSTS.source.length > 20, 'the cost table cites its source');
  assert.match(SHIPPING_COSTS.checkedAt, /^\d{4}-\d{2}-\d{2}$/, 'the cost table is dated');
  assert.equal(SHIPPING_COSTS.currency, 'USD');
  for (const code of covered) {
    const row = SHIPPING_COSTS.countries[code];
    assert.ok(row.firstItem > 0, `${code} has a first-bottle cost`);
    assert.ok(row.extraItem > 0, `${code} has an extra-bottle cost`);
    assert.ok(row.carrier, `${code} names the carrier the cost came from`);
  }
});

test('what the visitor pays is the real cost plus the merchant’s margin — never less than the cost', () => {
  for (const code of covered) {
    const real = realShipping(code, 1) as number;
    const charged = shippingCost(code, 1);
    assert.ok(charged >= real, `${code}: charged ${charged} < cost ${real}`);
    const fee = Math.round((charged - real) * 100) / 100;
    assert.equal(fee, handlingFee(real), `${code}: the extra is exactly the handling fee`);
    assert.ok(fee >= 0, `${code}: never a negative fee`);
    if (cap > 0) assert.ok(fee <= cap + 1e-9, `${code}: fee ${fee} is above the cap ${cap}`);
    if (percent > 0 && cap === 0) assert.ok(Math.abs(fee - (real * percent) / 100) < 0.02, `${code}: fee follows the percent`);
  }
});

test('every extra bottle is charged at its own real cost — a heavier order cannot lose money', () => {
  for (const code of covered) {
    const row = SHIPPING_COSTS.countries[code];
    const realTwo = realShipping(code, 2) as number;
    assert.ok(Math.abs(realTwo - (row.firstItem + row.extraItem)) < 0.011, `${code}: the 2nd bottle costs the carrier's next-500 g rate`);
    assert.ok(shippingCost(code, 2) >= realTwo, `${code}: 2 bottles are not under-charged`);
    assert.equal(shippingCost(code, 0), 0, 'an empty order has no shipping');
  }
});

test('the 50% stays net on a real product, in every destination we have a rate for', () => {
  const sold = catalog.filter((p) => p.published !== false && Number(p.supplierPrice) > 0 && Number(p.ourPrice) > 0);
  assert.ok(sold.length > 1000, `the catalogue has ${sold.length} priced products`);
  for (const p of sold.slice(0, 60)) {
    const cost = Number(p.supplierPrice); const price = Number(p.ourPrice);
    for (const code of covered) {
      const net = netAfterShipping(price, cost, code);
      assert.ok(net.costBased, `${code}: priced from a published cost`);
      assert.ok(net.netPercent >= 50, `${code}: the ${price} EGP bottle (cost ${cost}) keeps only ${net.netPercent}%`);
      assert.ok(net.netEgp >= price - cost, `${code}: shipping ate the bottle's own markup`);
    }
  }
  // The median bottle, spelled out: the shipping money is pure margin on top of the 50%.
  const med = [...sold].sort((a, b) => Number(a.ourPrice) - Number(b.ourPrice))[Math.floor(sold.length / 2)];
  const eg = netAfterShipping(Number(med.ourPrice), Number(med.supplierPrice), 'EG');
  assert.ok(eg.marginUsd > 0, 'Egypt pays a margin on the shipping, not a subsidy');
  assert.ok(eg.netPercent > 50, `the median bottle keeps ${eg.netPercent}% in Egypt`);
});

test('a destination with no published rate keeps its zone price and promises nothing more', () => {
  const withoutCost = ['MY'].filter((c) => !covered.includes(c));
  for (const code of withoutCost) {
    assert.equal(shippingIsCostBased(code), false, `${code} has no published rate`);
    const zone = shippingZone(code);
    assert.equal(shippingCost(code, 1), zone.firstItem, `${code} falls back to its zone price`);
    assert.equal(realShipping(code, 1), null);
  }
});

test('free shipping is still off: nothing promises it and no order ships free by accident', () => {
  assert.equal(freeShippingAbove(), null, 'no free-shipping threshold exists in the merchant’s file');
  const q = quote([{ sku: 'A', price: 100000, qty: 3 }], 'EG');
  assert.equal(q.freeShipping, false);
  assert.ok(q.shipping > 0, 'even a huge order pays the shipping');
  assert.equal(Math.round((q.items + q.shipping) * 100) / 100, q.total, 'the total adds up on the receipt');
});

test('the trade report and the price engine agree on every destination', () => {
  assert.equal(report.money.costBasedDestinations, covered.length, 'the report counts exactly the destinations the engine prices from a cost');
  assert.equal(report.money.uncoveredDestinations, report.destinations.length - covered.length);
  assert.ok(report.money.costBasedDestinations > 0);
  assert.ok((report.money.medianShippingMarginEgp || 0) > 0, 'the shipping itself earns something');
  let checked = 0;
  for (const d of report.destinations) {
    if (!covered.includes(d.code)) continue;
    if (d.proposedChargedEgp === null) continue;
    const engine = convert(shippingCost(d.code, 1), SHIPPING.currency, HOME_CURRENCY, BUNDLED_FX);
    assert.ok(Math.abs(engine - d.proposedChargedEgp) <= 1, `${d.code}: report says ${d.proposedChargedEgp} EGP, the engine charges ${engine}`);
    checked += 1;
  }
  assert.ok(checked >= 70, `only ${checked} destinations compared`);
});

test('the shipping table keeps the merchant’s own numbers where they are his call', () => {
  const file = JSON.parse(readFileSync(join(root, 'src/data/shipping.json'), 'utf8')) as ShippingTable & { netMarginPercent?: number };
  assert.equal(file.netMarginPercent, 50, 'the 50% is written in his own file');
  assert.ok(file.handling && file.handling.percent > 0, 'his margin on the shipping is written too');
  for (const zone of [...file.zones, file.default]) {
    assert.ok(zone.firstItem > 0, `${zone.id}: the fallback zone price exists`);
  }
});
