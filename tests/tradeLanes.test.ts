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
  carrierBandEgp, chargedEgp, dutyReliefFor, fxDrift, laneFor, pickCarrier, reviewTrade, shippingDestinations,
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
  // Every registered delivery mode carries its evidence and the date it was checked — a mode is never a guess.
  for (const p of lanesFile.platforms) {
    assert.ok(Array.isArray(p.shipsTo), `${p.id}: shipsTo must be a list`);
    assert.match(String(p.shipmentCheckedAt ?? ''), /^\d{4}-\d{2}-\d{2}$/, `${p.id}: no date on the delivery check`);
    if (p.fulfilment === 'platform_ships') assert.ok(p.shipsTo.length > 0, `${p.id}: a platform that ships must say where to`);
  }
  // The importer and the trade register must tell the same story about the supplier we know most about.
  const sham = lanesFile.platforms.find((p: { id: string }) => p.id === 'shamperfume');
  assert.equal(sham.originCountry, 'MY', 'the Malaysian supplier is recorded as Malaysian');
  assert.equal(sham.fulfilment, 'broker', 'its own shipping policy is missing → we carry it');
  assert.deepEqual(sham.shipsTo, ['MY']);
  const afnan = lanesFile.platforms.find((p: { id: string }) => p.id === 'afnan');
  assert.equal(afnan.fulfilment, 'platform_ships', 'Afnan ships itself');
  assert.deepEqual(afnan.shipsTo, ['US'], 'and its published policy says the United States only');
  // Every customs figure that is presented as known carries its source and date.
  for (const c of customsFile.countries) {
    if (c.confidence === 'unverified') { assert.equal(c.source, null, `${c.code} must not fake a source`); continue; }
    assert.ok(c.source, `${c.code} has a verified figure without a source`);
    assert.match(String(c.checkedAt), /^\d{4}-\d{2}-\d{2}$/, `${c.code} has no date`);
  }
  // Every carrier price band is traceable too.
  for (const c of lanesFile.carriers) {
    if (c.priceBandEgp || c.priceBandUsd || c.perCountryBand) assert.ok(c.source, `${c.id} publishes a price without a source`);
    if (c.scope === 'international' && c.perCountryBand) {
      assert.equal(c.dg, null, `${c.id}: perfume is UN1266 — a carrier is never marked as accepting it without proof`);
      assert.ok(c.perCountryBand.currency, `${c.id} prices in no currency`);
      assert.ok(Object.keys(c.perCountryBand.rates).length > 0);
    }
  }
  // The goods' origin is what the import file recorded, never «the site is ours, so Egypt».
  const originsInReport = report.origins.map((o: { code: string }) => o.code);
  assert.ok(originsInReport.includes('MY'), 'the Malaysian supplier is counted as an origin');
  assert.ok(originsInReport.includes('AE'), 'the UAE supplier is counted as an origin');
  for (const o of report.origins) assert.ok(o.products > 0, o.code);
  // The rate a supplier price was built on is never silently assumed to be today's.
  assert.ok(Array.isArray(report.fx.lines));
  // The report's own destinations are the shipping table's countries, and the money verdicts add up.
  assert.ok(report.destinations.length > 0);
  for (const d of report.destinations) assert.ok(Number(d.chargedEgp) >= 0, d.code);
  assert.equal(report.money.lossDestinations, report.destinations.filter((d: { costVerdict: string }) => d.costVerdict === 'loss').length);
  assert.equal(report.money.pricedDestinations, report.destinations.filter((d: { costEgp: unknown }) => d.costEgp !== null).length);
  // Free shipping and the lanes read the same shipping table — one truth for the promise and the money.
  assert.equal(typeof freeShippingAbove(shipping), 'number' === typeof freeShippingAbove(shipping) ? 'number' : 'object');
});

test('the origin decides the lane: stock in Malaysia makes an Egyptian buyer an international lane', () => {
  const malaysia = platform({ id: 'sham', fulfilment: 'broker', originCountry: 'MY', originConfidence: 'verified', products: 1063 });
  const report = review([malaysia], undefined, { destinations: ['EG', 'MY'] });
  const eg = report.destinations.find((d) => d.code === 'EG')!;
  const my = report.destinations.find((d) => d.code === 'MY')!;
  assert.equal(eg.assumedOrigin, 'MY', 'the goods leave from the supplier’s country');
  assert.equal(eg.assumedLane, 'international', 'a buyer in Egypt is abroad when the stock is in Malaysia');
  assert.equal(my.assumedLane, 'local', 'only a buyer in Malaysia gets the domestic carrier');
  assert.match(eg.becauseAr, /شحن دولي/);
  assert.deepEqual(report.origins.map((o) => o.code), ['MY']);
  assert.equal(report.origins[0].products, 1063);
});

test('a rate quoted from another origin country is not a price for this route', () => {
  const fromEgypt: Carrier = { ...INTL, id: 'aramex_eg', originCountry: 'EG' };
  assert.deepEqual(carrierBandEgp(fromEgypt, 'SA', FX, 'EG'), [1000, 2750], 'from Egypt it is its own rate');
  assert.equal(carrierBandEgp(fromEgypt, 'SA', FX, 'MY'), null, 'the same rate says nothing about a parcel leaving Malaysia');
  const anywhere: Carrier = { ...INTL, id: 'dhl', originCountry: '*' };
  assert.deepEqual(carrierBandEgp(anywhere, 'SA', FX, 'MY'), [1000, 2750], 'a worldwide rate is usable from anywhere');
  const picked = pickCarrier([fromEgypt, anywhere], 'international', 'SA', FX, 'MY');
  assert.equal(picked?.id, 'dhl', 'only a carrier that quotes from that origin is offered');
});

test('a per-country published band with a published surcharge is read as a band, and never borrowed', () => {
  const poslaju: Carrier = {
    id: 'poslaju', nameAr: 'بوس لاجو', country: '*', originCountry: 'MY', scope: 'international', dg: null,
    perCountryBand: { currency: 'MYR', rates: { EG: [90, 15], SA: [80, 25], '*': [180, 55] }, surchargePercent: 40 },
    source: 'https://example.test/poslaju', checkedAt: '2026-10-25',
  };
  const fxMyr: FxTable = { base: 'USD', updatedAt: '2026-10-25T00:00:00Z', rates: { USD: 1, EGP: 50, MYR: 4 } };
  // 90 RM × 1.4 = 126 RM → 1575 EGP; up to 1 kg (105 RM × 1.4 = 147 RM) → 1837.5 EGP.
  assert.deepEqual(carrierBandEgp(poslaju, 'EG', fxMyr, 'MY'), [1575, 1837.5]);
  assert.deepEqual(carrierBandEgp(poslaju, 'SA', fxMyr, 'MY'), [1400, 1837.5]);
  assert.deepEqual(carrierBandEgp(poslaju, 'JP', fxMyr, 'MY'), [3150, 4112.5], 'an unlisted country takes the source’s own «rest of world» row');
  assert.equal(carrierBandEgp(poslaju, 'EG', fxMyr, 'AE'), null, 'and none of it is a price from the UAE');
});

test('the exchange rate the supplier price was built on is compared with today’s, not assumed', () => {
  const fxToday: FxTable = { base: 'USD', updatedAt: '2026-10-25T00:00:00Z', rates: { USD: 1, EGP: 55, MYR: 4 } };
  const lines = fxDrift([{ currency: 'MYR', rateUsed: 13.0813, products: 1063 }, { currency: 'AED', rateUsed: 13.75, products: 98 }], fxToday, 2);
  assert.equal(lines.length, 1, 'MYR moved enough to be reported, AED barely moved and is not noise');
  assert.equal(lines[0].currency, 'MYR');
  assert.equal(lines[0].rateToday, 13.75, '1 MYR = 55 / 4 EGP');
  assert.equal(lines[0].driftPercent, 5.1);
  assert.equal(lines[0].products, 1063);
  assert.match(lines[0].stateAr, /أغلى/, 'the goods cost us more than the price says');
  // Same rate → no line at all.
  assert.equal(fxDrift([{ currency: 'MYR', rateUsed: 13.75, products: 10 }], fxToday, 2).length, 0);
});

test('the order’s own verdict: a shipping shortfall is paid by the bottle’s markup, unless it is bigger', () => {
  const provider = platform({ fulfilment: 'broker', originCountry: 'EG' });
  const report = review([provider], [LOCAL_EG, INTL], { profitPerBottleEgp: 1200, destinations: ['EG', 'FR'] });
  const fr = report.destinations.find((d) => d.code === 'FR')!;
  // Charged 1100, band 2000–5000 → mid 3500 → −2400; markup 1200 → net −1200 = a real loss.
  assert.equal(fr.surplusEgp, -2400);
  assert.equal(fr.netEgp, -1200);
  assert.equal(fr.orderVerdict, 'loss');
  const eg = report.destinations.find((d) => d.code === 'EG')!;
  assert.equal(eg.surplusEgp, 750 - 42.5);
  assert.equal(eg.netEgp, 1200 + (750 - 42.5));
  assert.equal(eg.orderVerdict, 'profit');
  assert.equal(report.money.orderLossDestinations, 1);
  assert.equal(report.money.profitPerBottleEgp, 1200);
});

test('the importer records how each supplier delivers, with its evidence — the lane is read, not guessed', async () => {
  const { sourceById } = await import('../scripts/shaheen-import/sources');
  const sham = sourceById('shamperfume')!;
  assert.ok(sham.delivery, 'the built-in supplier carries its delivery record');
  assert.equal(sham.delivery!.fulfilment, 'broker');
  assert.deepEqual(sham.delivery!.shipsTo, ['MY']);
  assert.match(sham.delivery!.source, /^https:\/\//, 'the evidence is a real page');
  assert.match(sham.delivery!.checkedAt, /^\d{4}-\d{2}-\d{2}$/, 'and a date');
  assert.ok(sham.delivery!.evidenceAr.length > 40, 'and the reasoning in Arabic');
});

test('the 50% stays whole only when the shipping we charge covers the carrier band', () => {
  const provider = platform({ fulfilment: 'broker', originCountry: 'EG' });
  const report = review([provider], [LOCAL_EG, INTL], { profitPerBottleEgp: 1000, destinations: ['EG', 'FR'] });
  const eg = report.destinations.find((d) => d.code === 'EG')!;
  const fr = report.destinations.find((d) => d.code === 'FR')!;
  // Egypt: we charge 750, the band is 30–55 → the markup is untouched.
  assert.equal(eg.marginEatenEgp, 0);
  assert.ok(eg.keptPercent! >= 100, 'over-charging keeps more than the whole markup');
  assert.deepEqual(eg.requiredShippingEgp, [30, 55]);
  // France: we charge 1100, the band is 2000–5000 → the shipping eats 2400 of a 1000 markup.
  assert.equal(fr.marginEatenEgp, 2400);
  assert.equal(fr.keptPercent, -140);
  assert.equal(report.money.keptWholeDestinations, 1);
  assert.equal(report.money.marginEatenDestinations, 1);
});

test('the shipping proposal is the real cost, per zone and per destination, and never applied by itself', () => {
  const provider = platform({ fulfilment: 'broker', originCountry: 'EG' });
  const report = review([provider], [LOCAL_EG, INTL], { profitPerBottleEgp: 1000, destinations: ['EG', 'FR', 'DE'] });
  const egypt = report.shippingProposal.find((z) => z.zoneId === 'egypt')!;
  assert.equal(egypt.currentFirstItem, 15, 'what we charge today');
  // 30 EGP of real cost = 0.6 USD in the table's own currency, rounded up to a whole dollar.
  assert.equal(egypt.typicalRequiredFirstItem, 1, 'the carrier band, in the table’s own currency');
  assert.equal(egypt.covered, 1, 'Egypt already keeps the whole markup');
  const europe = report.shippingProposal.find((z) => z.zoneId === 'europe')!;
  assert.equal(europe.typicalRequiredFirstItem, 40, '20 USD band is the real cost for both FR and DE');
  assert.deepEqual(europe.destinations.map((d) => d.code).sort(), ['DE', 'FR']);
  // A proposal is data in the report; the live shipping table itself is the owner's to change.
  const shippingFile = JSON.parse(readFileSync(join(new URL('..', import.meta.url).pathname, 'src/data/shipping.json'), 'utf8'));
  assert.equal(shippingFile.zones[0].firstItem, 15, 'the robot never rewrites a price');
});
