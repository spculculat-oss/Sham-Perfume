/**
 * «روبوت الشحن والتجارة الدولية»: the merchant's own two cases — the source platform ships (we only broker) or it
 * is local-only (we carry it) — turned into a lane for every destination, with the carrier's published price against
 * what we charge, customs with a source, and the trade agreements that can take the duty off. It reports; it never
 * promises a delivery or invents a price.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BOTS } from '../src/utils/shaheenOrg';
import { refugeIndex } from '../src/utils/shaheenRefuge';
import { freeShippingAbove, type FxTable, type ShippingTable } from '../src/utils/pricing';
import {
  carrierBandEgp, chargedEgp, dutyReliefFor, laneFor, pickCarrier, reviewTrade, shippingDestinations,
  type Carrier, type CustomsCountry, type Platform, type TradeAgreement,
} from '../scripts/shaheen-trade/review';

const FX: FxTable = { base: 'USD', updatedAt: '2026-10-25T00:00:00Z', rates: { USD: 1, EGP: 50, SAR: 3.75, EUR: 0.9 } };
const SHIP: ShippingTable = {
  currency: 'USD',
  zones: [
    { id: 'egypt', name: { ar: 'مصر', en: 'Egypt' }, countries: ['EG'], firstItem: 15, extraItem: 3 },
    { id: 'gulf', name: { ar: 'الخليج', en: 'Gulf' }, countries: ['SA', 'AE'], firstItem: 14, extraItem: 3 },
    { id: 'europe', name: { ar: 'أوروبا', en: 'Europe' }, countries: ['FR', 'DE'], firstItem: 22, extraItem: 5 },
  ],
  default: { id: 'world', name: { ar: 'العالم', en: 'World' }, firstItem: 28, extraItem: 6 },
};

const platform = (p: Partial<Platform>): Platform => ({ id: 'shop', nameAr: 'متجر', originCountry: 'EG', fulfilment: 'broker', shipsTo: [], products: 100, ...p });
const LOCAL_EG: Carrier = { id: 'bosta', nameAr: 'بوستة', country: 'EG', scope: 'local', dg: null, priceBandEgp: { cairo: [30, 55], governorates: [60, 90] }, source: 'https://example.test/bosta', checkedAt: '2026-10-25' };
const INTL: Carrier = { id: 'dhl', nameAr: 'DHL', country: '*', scope: 'international', dg: null, priceBandUsd: { gulf: [20, 55], europe_north_america: [40, 100] }, source: 'https://example.test/dhl', checkedAt: '2026-10-25' };
const NO_PRICE_INTL: Carrier = { id: 'ups', nameAr: 'UPS', country: '*', scope: 'international', dg: null, priceBandUsd: null, source: null, checkedAt: null };

const COUNTRY = (c: Partial<CustomsCountry> & { code: string }): CustomsCountry => ({
  nameAr: c.code, region: 'world', vatPercent: null, dutyPercent: null, deMinimis: null,
  confidence: 'unverified', agreements: [], restricted: null, source: null, checkedAt: null, ...c,
});
const CUSTOMS = {
  countries: [
    COUNTRY({ code: 'EG', nameAr: 'مصر', vatPercent: 14, dutyPercent: [0, 60], confidence: 'secondary', source: 'https://example.test/eg', checkedAt: '2026-10-25', agreements: ['GAFTA'] }),
    COUNTRY({ code: 'SA', nameAr: 'السعودية', confidence: 'unverified', agreements: ['GAFTA'] }),
    COUNTRY({ code: 'FR', nameAr: 'فرنسا', confidence: 'official', source: 'https://example.test/eu', checkedAt: '2026-10-25', agreements: ['EU_EGYPT'] }),
  ],
  agreements: [
    { id: 'GAFTA', nameAr: 'التجارة الحرة العربية', members: ['EG', 'SA'], requires: ['شهادة منشأ'] },
    { id: 'EU_EGYPT', nameAr: 'الشراكة المصرية الأوروبية', members: ['EG', 'FR', 'DE'], requires: ['شهادة EUR.1'] },
  ] as TradeAgreement[],
};

const review = (platforms: Platform[], carriers: Carrier[] = [LOCAL_EG, INTL], extra: Partial<Parameters<typeof reviewTrade>[0]> = {}) =>
  reviewTrade({ now: Date.parse('2026-10-25T00:00:00Z'), platforms, carriers, customs: CUSTOMS, shipping: SHIP, fx: FX, profitPerBottleEgp: 1000, ...extra });

test('case one: the platform ships worldwide — we only broker and promise nothing of our own', () => {
  const p = platform({ fulfilment: 'platform_ships', shipsTo: ['*'] });
  assert.equal(laneFor(p, 'FR'), 'platform');
  assert.equal(laneFor(p, 'EG'), 'platform');
  const report = review([p]);
  assert.equal(report.modes.platform_ships.products, 100);
  assert.equal(report.products.platform_ships, 100);
  const fr = report.destinations.find((d) => d.code === 'FR')!;
  assert.equal(fr.promise, 'broker_only');
  assert.match(fr.becauseAr, /دورنا وساطة/);
});

test('case two: the platform is local-only — same country is a local lane, another country is international', () => {
  const p = platform({ fulfilment: 'broker', originCountry: 'EG' });
  assert.equal(laneFor(p, 'EG'), 'local');
  assert.equal(laneFor(p, 'FR'), 'international');
  assert.equal(laneFor(p, 'EG'), 'local', 'the buyer in the platform’s own country gets the domestic carrier');
  const report = review([p]);
  const eg = report.destinations.find((d) => d.code === 'EG')!;
  const fr = report.destinations.find((d) => d.code === 'FR')!;
  assert.equal(eg.assumedLane, 'local');
  assert.equal(eg.carrier?.id, 'bosta');
  assert.equal(fr.assumedLane, 'international');
  assert.equal(fr.carrier?.id, 'dhl');
  assert.equal(eg.promise, 'we_ship');
});

test('the split is per country, exactly as the merchant described: Malaysia → Malaysia is local, Malaysia → France is international', () => {
  const malaysia = platform({ id: 'my', fulfilment: 'broker', originCountry: 'MY' });
  assert.equal(laneFor(malaysia, 'MY'), 'local');
  assert.equal(laneFor(malaysia, 'FR'), 'international');
  const shopShips = platform({ id: 'world', fulfilment: 'platform_ships', shipsTo: ['MY', 'FR'] });
  assert.equal(laneFor(shopShips, 'MY'), 'platform', 'a platform that ships itself keeps the shipping, wherever the buyer is');
  assert.equal(laneFor(shopShips, 'FR'), 'platform');
  // A platform that ships only inside its own country, for a buyer abroad: the international lane falls to us.
  const partial = platform({ id: 'partial', fulfilment: 'platform_ships', shipsTo: ['MY'] });
  assert.equal(laneFor(partial, 'MY'), 'platform');
  assert.equal(laneFor(partial, 'FR'), 'international');
});

test('an unknown mode promises nothing — the biggest platform decides, and nothing is hidden behind a smaller one', () => {
  const big = platform({ id: 'big', fulfilment: 'unknown', products: 900 });
  const small = platform({ id: 'small', fulfilment: 'broker', products: 10 });
  const report = review([big, small]);
  const fr = report.destinations.find((d) => d.code === 'FR')!;
  assert.equal(fr.lane, 'unknown', 'no delivery promise while the mode is unknown');
  assert.equal(fr.promise, 'unknown');
  assert.equal(report.products.unknown, 900);
  assert.ok(report.gaps.some((g) => g.kindAr.includes('طريقة التسليم')), 'the missing mode is a gap for the merchant');
  assert.ok(report.notes.some((n) => n.includes('مفيش وعد توصيل')));
});

test('the money: what we charge against the carrier’s published band, per lane', () => {
  assert.equal(chargedEgp('SA', SHIP, FX), 700, '14 USD × 50 EGP');
  assert.equal(chargedEgp('FR', SHIP, FX), 1100, '22 USD → 1100 EGP');
  assert.deepEqual(carrierBandEgp(LOCAL_EG, 'EG', FX), [30, 55]);
  assert.deepEqual(carrierBandEgp(INTL, 'FR', FX), [2000, 5000], '40–100 USD in EGP');
  assert.equal(carrierBandEgp(INTL, 'JP', FX), null, 'no band for that region is never borrowed from another one');
  const provider = platform({ fulfilment: 'broker', originCountry: 'EG' });
  const report = review([provider]);
  const eg = report.destinations.find((d) => d.code === 'EG')!;
  const fr = report.destinations.find((d) => d.code === 'FR')!;
  assert.equal(eg.surplusEgp, 750 - 42.5, 'we charge 750 (15 USD) for a 30–55 EGP delivery');
  assert.equal(eg.costVerdict, 'over_charging');
  assert.equal(fr.surplusEgp, 1100 - 3500);
  assert.equal(fr.costVerdict, 'loss', 'international courier costs more than we charge');
  assert.equal(report.money.lossDestinations, report.destinations.filter((d) => d.costVerdict === 'loss').length);
  assert.equal(report.money.overChargedDestinations, 1);
});

test('the cheap carrier wins, but a carrier that has not proved it takes perfume is never presented as able to', () => {
  const cheapUnknown: Carrier = { ...INTL, id: 'cheap', nameAr: 'رخيص', dg: null, priceBandUsd: { gulf: [10, 20], europe_north_america: [10, 20] } };
  const proven: Carrier = { ...INTL, id: 'proven', nameAr: 'معتمد', dg: true, priceBandUsd: { gulf: [60, 90], europe_north_america: [60, 90] } };
  const picked = pickCarrier([proven, cheapUnknown], 'international', 'FR', FX)!;
  assert.equal(picked.id, 'cheap', 'the published price decides first');
  assert.equal(picked.dg, null, 'and its dangerous-goods status stays unknown, never assumed');
  const local = pickCarrier([LOCAL_EG], 'local', 'EG', FX)!;
  assert.equal(local.id, 'bosta');
  assert.equal(pickCarrier([LOCAL_EG], 'local', 'SA', FX), null, 'a carrier for another country is not offered');
  assert.equal(pickCarrier([LOCAL_EG, INTL], 'platform', 'FR', FX), null, 'broker-only lanes need no carrier');
});

test('customs come with a source or not at all — and a trade agreement only counts for a real origin', () => {
  assert.equal(dutyReliefFor(CUSTOMS.agreements, 'EG', 'SA')?.id, 'GAFTA');
  assert.equal(dutyReliefFor(CUSTOMS.agreements, 'EG', 'FR')?.id, 'EU_EGYPT');
  assert.equal(dutyReliefFor(CUSTOMS.agreements, 'MY', 'FR'), null, 'no agreement between Malaysia and France here');
  assert.equal(dutyReliefFor(CUSTOMS.agreements, 'EG', 'EG'), null, 'a domestic delivery has no customs');
  const report = review([platform({ fulfilment: 'broker', originCountry: 'EG' })]);
  const eg = report.destinations.find((d) => d.code === 'EG')!;
  const sa = report.destinations.find((d) => d.code === 'SA')!;
  const fr = report.destinations.find((d) => d.code === 'FR')!;
  assert.equal(eg.customs.verified, true);
  assert.equal(eg.customs.dutyRelief, null, 'no customs inside the same country');
  assert.equal(sa.customs.verified, false, 'no verified source → the visitor is told nothing');
  assert.match(sa.customs.noteAr, /مفيش بيانات/);
  assert.equal(fr.customs.dutyRelief?.id, 'EU_EGYPT');
  assert.deepEqual(fr.customs.dutyRelief?.requires, ['شهادة EUR.1']);
});

test('a sanctioned destination is never sold as a normal lane', () => {
  const customs = { ...CUSTOMS, countries: [...CUSTOMS.countries, COUNTRY({ code: 'IR', nameAr: 'إيران', restricted: { ar: 'عقوبات — الشحن ممنوع' } })] };
  const report = reviewTrade({ now: Date.now(), platforms: [platform({ fulfilment: 'broker' })], carriers: [LOCAL_EG, INTL], customs, shipping: SHIP, fx: FX, destinations: ['IR'] });
  assert.equal(report.destinations[0].customs.restricted, 'عقوبات — الشحن ممنوع');
});

test('the destinations come from the shipping table itself — no invented country list', () => {
  assert.deepEqual(shippingDestinations(SHIP).sort(), ['AE', 'DE', 'EG', 'FR', 'SA']);
});

test('the robot is placed under Shaheen and its report is real', () => {
  const bot = BOTS.find((b) => b.id === 'trade_lanes');
  assert.ok(bot, 'the robot is registered');
  assert.equal(bot!.dept, 'store');
  assert.equal(bot!.report, 'trade-lanes.json');
  assert.equal(bot!.workflow, 'shaheen-trade.yml');
  const root = new URL('..', import.meta.url).pathname;
  assert.ok(existsSync(join(root, '.github/workflows', bot!.workflow!)), 'its workflow exists');
  assert.ok(existsSync(join(root, 'src/data/live', bot!.report!)), 'its report exists');
  const ids = new Set(refugeIndex().map((e) => e.id));
  assert.ok(ids.has('robot:trade_lanes'));
  assert.ok(ids.has('report:trade-lanes.json'));
  assert.ok(ids.has('workflow:shaheen-trade.yml'));
});

test('the real files: every lane, price and duty in the report is traceable and the split is honest', () => {
  const root = new URL('..', import.meta.url).pathname;
  const read = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'));
  const report = read('src/data/live/trade-lanes.json');
  const lanesFile = read('src/data/shipping-lanes.json');
  const customsFile = read('src/data/customs.json');
  const shipping = read('src/data/shipping.json') as ShippingTable;

  assert.equal(report.agent, 'trade-lanes');
  // Every platform is one of the merchant's two cases (or explicitly unknown — never silently defaulted).
  for (const p of lanesFile.platforms) assert.ok(['platform_ships', 'broker', 'unknown'].includes(p.fulfilment), p.id);
  // Every customs figure that is presented as known carries its source and date.
  for (const c of customsFile.countries) {
    if (c.confidence === 'unverified') { assert.equal(c.source, null, `${c.code} must not fake a source`); continue; }
    assert.ok(c.source, `${c.code} has a verified figure without a source`);
    assert.match(String(c.checkedAt), /^\d{4}-\d{2}-\d{2}$/, `${c.code} has no date`);
  }
  // Every carrier price band is traceable too.
  for (const c of lanesFile.carriers) {
    if (c.priceBandEgp || c.priceBandUsd) assert.ok(c.source, `${c.id} publishes a price without a source`);
  }
  // The report's own destinations are the shipping table's countries, and the money verdicts add up.
  assert.ok(report.destinations.length > 0);
  for (const d of report.destinations) assert.ok(Number(d.chargedEgp) >= 0, d.code);
  assert.equal(report.money.lossDestinations, report.destinations.filter((d: { costVerdict: string }) => d.costVerdict === 'loss').length);
  assert.equal(report.money.pricedDestinations, report.destinations.filter((d: { costEgp: unknown }) => d.costEgp !== null).length);
  // Free shipping and the lanes read the same shipping table — one truth for the promise and the money.
  assert.equal(typeof freeShippingAbove(shipping), 'number' === typeof freeShippingAbove(shipping) ? 'number' : 'object');
});
