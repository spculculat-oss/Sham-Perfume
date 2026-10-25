/**
 * «روبوت الشحن والتجارة الدولية» (bot `trade_lanes`, workflow `.github/workflows/shaheen-trade.yml`,
 * report `src/data/live/trade-lanes.json`) — the merchant's own description of his business, turned into rules:
 *
 *   «إحنا شركة وسيطة… بناخد منتجات من منصات تانية ونعرضها عندنا. فيه حاجة من اتنين: إما المنصة مكلفة بنقل
 *    منتجاتها لأي دولة في العالم — هنا دورنا الوساطة وناخد ربحنا بس؛ أو المنصة مبتشحنش وشغلها محلي بس —
 *    هنا إحنا اللي بنجيب أفضل وأرخص شركة شحن.»
 *
 * So every source platform carries one **mode**, and every order falls into one **lane**:
 *
 *   platform_ships          the source platform delivers worldwide → we only broker: our profit is the markup,
 *                           we arrange nothing, and we promise no delivery of our own.
 *   broker + same country   the platform is local-only and the buyer is in the same country → **local** lane:
 *                           a domestic carrier (cheapest published band, cash on delivery if needed).
 *   broker + another country → **international** lane: a carrier that covers the destination AND carries
 *                           perfume (UN1266 class 3 — most air carriers refuse it), with customs on top.
 *   unknown mode            → nothing is promised to the visitor; the order is confirmed by a human.
 *
 * The review also answers the money question: what we charge for shipping today (src/data/shipping.json, in the
 * visitor's currency) against what the carrier really costs (verified bands), what customs each destination puts
 * on a perfume parcel (src/data/customs.json, every figure with its source and date), and whether a trade
 * agreement can take the duty off — e.g. GAFTA between Arab countries, or Egypt–EU for goods of Egyptian origin.
 *
 * Two laws of this file:
 *   1. **No number without a source and a date.** A band, a duty rate or a threshold with no source is `null`,
 *      the destination is marked «يتأكد», and nothing is promised to the visitor.
 *   2. **It reports, it never promises.** It writes the report; the merchant decides the mode and the carrier.
 *
 * Pure: platforms, carriers, customs, shipping and rates are parameters (`tests/tradeLanes.test.ts`).
 */
import { HOME_CURRENCY, convert, type FxTable, type ShippingTable, type ShippingZone } from '../../src/utils/pricing';

export type Fulfilment = 'platform_ships' | 'broker' | 'unknown';
export type Lane = 'platform' | 'local' | 'international' | 'unknown';

export interface Platform {
  id: string;
  nameAr: string;
  nameEn?: string;
  host?: string | null;
  products?: number;
  originCountry: string | null;
  originConfidence?: 'verified' | 'inferred' | 'unknown';
  fulfilment: Fulfilment;
  /** Country codes the platform delivers to; `['*']` = worldwide. Empty = nothing known. */
  shipsTo: string[];
  source?: string | null;
  checkedAt?: string | null;
}

export interface Carrier {
  id: string;
  nameAr: string;
  nameEn?: string;
  /** The carrier's own country, or `'*'` for an international carrier usable from anywhere. */
  country: string;
  /**
   * The country the published band was quoted **from** (`'*'`/absent = any origin). A rate calculated for parcels
   * leaving Egypt says nothing about parcels leaving Malaysia — using it there would invent a price.
   */
  originCountry?: string | null;
  scope: 'local' | 'international';
  /** Does it take perfume (UN1266 class 3)? `null` = not verified yet — never assume yes. */
  dg: boolean | null;
  cod?: boolean | null;
  /** Published domestic band, in EGP (the merchant's own money). */
  priceBandEgp?: { cairo?: [number, number]; governorates?: [number, number] } | null;
  /** Published international band, in USD, per region key. */
  priceBandUsd?: Record<string, [number, number]> | null;
  /**
   * A published **per-country** band: first 500 g plus each extra 500 g in the source's own currency, and the
   * published surcharge that sits on top of it. `'*'` is the source's own «rest of world» row — never a guess.
   */
  perCountryBand?: {
    currency: string;
    rates: Record<string, [number, number]>;
    surchargePercent?: number;
    sourceAr?: string;
  } | null;
  speedAr?: string;
  noteAr?: string;
  source?: string | null;
  checkedAt?: string | null;
}

export interface CustomsCountry {
  code: string;
  nameAr: string;
  region?: string;
  bloc?: string | null;
  vatPercent: number | null;
  dutyPercent: [number, number] | null;
  deMinimis: { amount: number; currency: string; noteAr?: string } | null;
  confidence: 'official' | 'secondary' | 'unverified';
  agreements: string[];
  restricted: { ar: string } | null;
  source: string | null;
  checkedAt: string | null;
  noteAr?: string;
}

export interface TradeAgreement {
  id: string;
  nameAr: string;
  nameEn?: string;
  members: string[];
  requires: string[];
  caveatAr?: string;
  source?: string | null;
  checkedAt?: string | null;
}

/** The exchange rate a supplier price was converted with, and how many products stand on it. */
export interface RateUsed {
  currency: string;
  rateUsed: number;
  products: number;
}

/** One currency whose supplier prices were built on an older rate than today's. */
export interface FxDriftLine {
  currency: string;
  rateUsed: number;
  rateToday: number;
  /** today ÷ used − 1, in percent: positive = the goods now cost us more than the price says. */
  driftPercent: number;
  products: number;
  stateAr: string;
}

/**
 * Where is the goods, and how many products are there? The lane depends on it, so it is never inferred from
 * «the site is ours» — only from what the import file recorded about the supplier.
 */
export interface OriginGroup {
  code: string;
  nameAr: string;
  products: number;
  platforms: string[];
  fulfilment: Fulfilment[];
  /** The local carrier that could deliver inside this country, if one is registered with a price. */
  localCarrier: { id: string; nameAr: string; priceEgp: [number, number] | null } | null;
}

/** The gap between the rate a supplier price was built on and today's rate — a cost the price does not show. */
export function fxDrift(rates: RateUsed[], fx: FxTable, thresholdPercent = 2): FxDriftLine[] {
  // The table is quoted per one `base`: 1 unit of `c` = rates[HOME] / rates[c] units of the home currency.
  const homePer = (currency: string) => {
    const per = Number(fx.rates[currency.toUpperCase()]);
    const one = Number(fx.rates[HOME_CURRENCY]);
    return per > 0 && one > 0 ? one / per : null;
  };
  const lines: FxDriftLine[] = [];
  for (const r of rates) {
    if (!(r.rateUsed > 0)) continue;
    const now = homePer(r.currency);
    if (now === null) continue;
    const drift = Math.round(((now / r.rateUsed) - 1) * 1000) / 10;
    if (Math.abs(drift) < thresholdPercent) continue;
    lines.push({
      currency: r.currency.toUpperCase(),
      rateUsed: r.rateUsed,
      rateToday: Math.round(now * 10000) / 10000,
      driftPercent: drift,
      products: r.products,
      stateAr: drift > 0
        ? `تكلفة الشراء بقت أغلى ${Math.abs(drift)}% من اللي السعر مبني عليه — الربح المحسوب أعلى من الحقيقي`
        : `تكلفة الشراء بقت أرخص ${Math.abs(drift)}% من اللي السعر مبني عليه — ممكن تنزّل السعر وتكسب أكتر`,
    });
  }
  return lines.sort((a, b) => Math.abs(b.driftPercent) - Math.abs(a.driftPercent));
}

export interface TradeInput {
  now: number;
  platforms: Platform[];
  carriers: Carrier[];
  customs: { countries: CustomsCountry[]; agreements: TradeAgreement[] };
  shipping: ShippingTable;
  fx: FxTable;
  /** The destinations to plan for (country codes). Default: the shipping table's zones + default. */
  destinations?: string[];
  /** What a product earns us: the catalogue's markup (ourPrice − supplierPrice), in EGP. */
  profitPerBottleEgp?: number;
  /** The rate each supplier price was converted with, from the import file. Absent = not measured. */
  ratesUsed?: RateUsed[];
  /** Below this percent the rate difference is noise and is not reported. */
  fxThresholdPercent?: number;
}

/** A destination's lane, price comparison and customs picture. */
export interface DestinationPlan {
  code: string;
  nameAr: string;
  lane: Lane;
  /** The lane if **we** take over the shipping (what the merchant asked to price): local or international. */
  assumedLane: 'local' | 'international' | null;
  /** The country the goods leave from, as the import file recorded it (`null` = unknown, so nothing is priced). */
  assumedOrigin: string | null;
  /** The lane of every platform that has a known mode, so nothing is hidden behind one number. */
  lanesByPlatform: { platform: string; lane: Lane }[];
  /** Why this lane (which platform, which mode). */
  becauseAr: string;
  carrier: { id: string; nameAr: string; speedAr?: string; priceEgp: [number, number] | null; dg: boolean | null; source: string | null } | null;
  alternative: { id: string; nameAr: string; priceEgp: [number, number] | null } | null;
  /** What the visitor is charged for shipping today (first bottle), in EGP. */
  chargedEgp: number;
  /** What the carrier really costs us (band), in EGP, or `null` when unpublished. */
  costEgp: [number, number] | null;
  /** charged − cost at the band's midpoint (positive = we over-charge, negative = we lose), as if we ship it. */
  surplusEgp: number | null;
  /** What one order really leaves us after the carrier's real band: the bottle's markup + `surplusEgp`. */
  netEgp: number | null;
  /** The order itself: does it still make money once the shipping is paid at the published band? */
  orderVerdict: 'profit' | 'thin' | 'loss' | 'unknown';
  /** How much of the bottle's markup survives the real shipping, in percent (100 = the 50% is untouched). */
  keptPercent: number | null;
  /** How much of the markup the real shipping eats, in EGP (0 = nothing eaten). */
  marginEatenEgp: number | null;
  /** The shipping we must charge for the 50% to stay whole: the carrier's own band, in EGP. */
  requiredShippingEgp: [number, number] | null;
  /** What we may tell the visitor: nothing (unknown mode), «المنصة بتشحن», or «إحنا بنشحن». */
  promise: 'broker_only' | 'we_ship' | 'unknown';
  /** The money verdict on the shipping, whether or not we ship it today. */
  costVerdict: 'ok' | 'over_charging' | 'loss' | 'unknown';
  customs: {
    verified: boolean;
    deMinimis: string | null;
    vatPercent: number | null;
    dutyPercent: [number, number] | null;
    restricted: string | null;
    /** A trade agreement that could take the duty off this pair, with what it needs. */
    dutyRelief: { id: string; nameAr: string; requires: string[] } | null;
    noteAr: string;
  };
}

export interface TradeReport {
  version: 1;
  agent: 'trade-lanes';
  updatedAt: string;
  modes: Record<Fulfilment, { nameAr: string; platforms: string[]; products: number }>;
  platforms: { id: string; nameAr: string; fulfilment: Fulfilment; originCountry: string | null; originConfidence: string; shipsTo: string[]; products: number; noteAr: string }[];
  destinations: DestinationPlan[];
  /** The catalogue counted by whose delivery mode is known — «who ships» in one line. */
  products: { platform_ships: number; broker: number; unknown: number; total: number };
  /** The catalogue counted by **where the goods are** — the first thing a lane needs, and where to ask first. */
  origins: OriginGroup[];
  /** Supplier prices built on an older exchange rate than today's: our real cost is above the price's. */
  fx: { thresholdPercent: number; lines: FxDriftLine[] };
  /**
   * What the shipping table should charge so the 50% stays whole — one line per existing zone, in the table's own
   * currency. A proposal only: the price is the owner's decision (O-06).
   */
  shippingProposal: {
    zoneId: string; nameAr: string; currency: string; countries: number;
    currentFirstItem: number;
    /** The middle real cost inside the zone, in the table's currency — what most countries there actually cost. */
    typicalRequiredFirstItem: number;
    /** The dearest real cost inside the zone (a zone-wide price must cover it). */
    maxRequiredFirstItem: number;
    /** The destination that costs the dearest — named, so the owner sees why. */
    drivenByAr: string | null;
    /** Every destination in the zone with its own real cost, in the table's currency. */
    destinations: { code: string; nameAr: string; requiredFirstItem: number }[];
    /** Destinations in this zone where the real shipping is below what we charge (no change needed). */
    covered: number;
  }[];
  /** What we do not know yet — each line is a question for the merchant or a job for the robot. */
  gaps: { kindAr: string; whatAr: string; fixAr: string }[];
  /** Money at stake, from the catalogue's own numbers. */
  money: {
    profitPerBottleEgp: number; averageChargedEgp: number;
    /** Destinations where the carrier's published band is known, so the comparison is real. */
    pricedDestinations: number;
    overChargedDestinations: number; lossDestinations: number;
    /** Destinations where the shipping alone eats the whole markup: each order there is a real loss. */
    orderLossDestinations: number;
    /** The best and worst net per order, in EGP. */
    bestNetEgp: number | null; worstNetEgp: number | null;
    /** Destinations where the 50% is untouched (the shipping we charge covers the real band). */
    keptWholeDestinations: number;
    /** Destinations where the shipping eats part of the markup. */
    marginEatenDestinations: number;
  };
  score: number;
  notes: string[];
  planAr: string[];
  summaryAr: string;
}

/** Which lane an order from `destination` takes for this platform. */
export function laneFor(platform: Platform, destination: string): Lane {
  const dest = destination.toUpperCase();
  if (platform.fulfilment === 'unknown') return 'unknown';
  if (platform.fulfilment === 'platform_ships') {
    const covered = platform.shipsTo.includes('*') || platform.shipsTo.map((c) => c.toUpperCase()).includes(dest);
    return covered ? 'platform' : 'international';
  }
  // broker: the platform delivers at home only, so we carry it ourselves across borders.
  if (!platform.originCountry) return 'unknown';
  return platform.originCountry.toUpperCase() === dest ? 'local' : 'international';
}

/** The shipping a visitor is charged today for the first bottle to `country`, in EGP. */
export function chargedEgp(country: string, shipping: ShippingTable, fx: FxTable): number {
  const code = country.toUpperCase();
  const zone: ShippingZone | undefined = (shipping.zones || []).find((z) => z.countries?.includes(code)) || shipping.default;
  if (!zone) return 0;
  const home = Math.round(convert(zone.firstItem, shipping.currency, HOME_CURRENCY, fx) * 100) / 100;
  return home;
}

/** A carrier's published band for this destination, in EGP — or `null` when it publishes none. */
export function carrierBandEgp(carrier: Carrier, destination: string, fx: FxTable, from?: string | null): [number, number] | null {
  // A band quoted from another origin country is not a price for this route.
  const quotedFrom = (carrier.originCountry || '*').toUpperCase();
  if (from && quotedFrom !== '*' && quotedFrom !== from.toUpperCase()) return null;
  if (carrier.perCountryBand) {
    const { currency, rates, surchargePercent } = carrier.perCountryBand;
    const row = rates[destination.toUpperCase()] || rates['*'];
    if (!row) return null;
    const lift = 1 + (Number(surchargePercent) || 0) / 100;
    // One bottle: the first 500 g is the floor, up to 1 kg is the ceiling (a 100 ml bottle + its box).
    const low = convert(row[0] * lift, currency, HOME_CURRENCY, fx);
    const high = convert((row[0] + row[1]) * lift, currency, HOME_CURRENCY, fx);
    return [Math.round(low * 100) / 100, Math.round(high * 100) / 100];
  }
  if (carrier.priceBandEgp) {
    const cairo = carrier.priceBandEgp.cairo;
    const gov = carrier.priceBandEgp.governorates;
    const band = cairo || gov;
    return band ? [band[0], band[1]] : null;
  }
  if (carrier.priceBandUsd) {
    const code = destination.toUpperCase();
    const regionOf = (c: string) =>
      ['SA', 'AE', 'KW', 'QA', 'BH', 'OM', 'JO'].includes(c) ? 'gulf'
        : ['GB', 'IE', 'FR', 'DE', 'IT', 'ES', 'PT', 'NL', 'BE', 'LU', 'AT', 'CH', 'SE', 'NO', 'DK', 'FI', 'IS', 'PL', 'CZ', 'SK', 'HU', 'RO', 'BG', 'GR', 'HR', 'SI', 'RS', 'BA', 'ME', 'MK', 'AL', 'EE', 'LV', 'LT', 'CY', 'MT', 'UA', 'MD', 'TR', 'US', 'CA', 'MX'].includes(c) ? 'europe_north_america'
          : null;
    const key = regionOf(code);
    // No published band for this region = unknown. A band for another region is never reused as a guess.
    const band = key ? carrier.priceBandUsd[key] : undefined;
    if (!band) return null;
    return [Math.round(convert(band[0], 'USD', HOME_CURRENCY, fx) * 100) / 100, Math.round(convert(band[1], 'USD', HOME_CURRENCY, fx) * 100) / 100];
  }
  return null;
}

/**
 * The best carrier for a lane: the cheapest published band wins, and a carrier that only *might* take perfume is
 * never presented as able to (its `dg` stays `null`, and the destination is marked «يتأكد»).
 */
export function pickCarrier(carriers: Carrier[], lane: Lane, destination: string, fx: FxTable, from?: string | null): Carrier | null {
  if (lane !== 'local' && lane !== 'international') return null;
  const code = destination.toUpperCase();
  const pool = carriers.filter((c) => (lane === 'local' ? c.scope === 'local' && c.country.toUpperCase() === code : c.scope === 'international'));
  const scored = pool.map((c) => ({ c, band: carrierBandEgp(c, destination, fx, from) }));
  // A published price first (unknown prices cannot be compared), then the cheapest, then a verified DG carrier.
  scored.sort((a, b) => {
    const ap = a.band ? 0 : 1;
    const bp = b.band ? 0 : 1;
    if (ap !== bp) return ap - bp;
    if (a.band && b.band && a.band[0] !== b.band[0]) return a.band[0] - b.band[0];
    const ad = a.c.dg === true ? 0 : 1;
    const bd = b.c.dg === true ? 0 : 1;
    return ad - bd;
  });
  return scored[0]?.c || null;
}

/** Can a trade agreement take the duty off a parcel going from `from` to `to`? */
export function dutyReliefFor(agreements: TradeAgreement[], from: string | null, to: string): TradeAgreement | null {
  if (!from) return null;
  const a = from.toUpperCase();
  const b = to.toUpperCase();
  if (a === b) return null;
  return agreements.find((x) => x.members.map((m) => m.toUpperCase()).includes(a) && x.members.map((m) => m.toUpperCase()).includes(b)) || null;
}

/** The destinations the shipping table already prices (its zones + the default zone). */
export function shippingDestinations(shipping: ShippingTable): string[] {
  const zones = [...(shipping.zones || []), shipping.default].filter(Boolean) as ShippingZone[];
  return [...new Set(zones.flatMap((z) => (z.countries || []).map((c) => c.toUpperCase())))];
}

const round = (n: number) => Math.round(n * 100) / 100;

export function reviewTrade(input: TradeInput): TradeReport {
  const { platforms, carriers, customs, shipping, fx } = input;
  const now = new Date(input.now).toISOString();
  const profit = Number(input.profitPerBottleEgp) > 0 ? Number(input.profitPerBottleEgp) : 0;
  const customsOf = (code: string) => customs.countries.find((c) => c.code.toUpperCase() === code.toUpperCase()) || null;

  // ── modes ──
  const modes = {
    platform_ships: { nameAr: 'المنصة بتشحن (وساطة)', platforms: [] as string[], products: 0 },
    broker: { nameAr: 'إحنا بنشحن', platforms: [] as string[], products: 0 },
    unknown: { nameAr: 'مش معروف', platforms: [] as string[], products: 0 },
  };
  for (const p of platforms) {
    const m = modes[p.fulfilment] || modes.unknown;
    m.platforms.push(p.id);
    m.products += Number(p.products) || 0;
  }

  // ── destinations ──
  const destinations: string[] = (input.destinations && input.destinations.length ? input.destinations : shippingDestinations(shipping)).map((c) => c.toUpperCase());
  const plans: DestinationPlan[] = destinations.map((code) => {
    const country = customsOf(code);
    // The lane follows the platform the goods come from: the biggest platform that has an origin decides.
    // The biggest platform decides what we say out loud (no mode is never out-shouted by a smaller one).
    const dominant = [...platforms].sort((a, b) => (Number(b.products) || 0) - (Number(a.products) || 0))[0];
    const platform = dominant;
    const lane: Lane = platform ? laneFor(platform, code) : 'unknown';
    const lanesByPlatform = platforms.map((p) => ({ platform: p.id, lane: laneFor(p, code) }));
    // If we take the shipping over: home country → local carrier, everywhere else → international one. The home is
    // the **dominant platform's** recorded origin (the goods we actually sell), never «our own country» by default.
    const home = (platform?.originCountry || platforms.find((p) => p.originCountry)?.originCountry || null)?.toUpperCase() || null;
    const assumedLane: 'local' | 'international' | null = home ? (home === code ? 'local' : 'international') : null;
    const carrier: Carrier | null = pickCarrier(carriers, assumedLane || 'international', code, fx, home);
    const others = carriers
      .filter((c) => c.id !== carrier?.id && (assumedLane === 'local' ? c.scope === 'local' && c.country.toUpperCase() === code : c.scope === 'international'))
      .map((c) => ({ c, band: carrierBandEgp(c, code, fx, home) }))
      .filter((x) => x.band)
      .sort((a, b) => (a.band![0] - b.band![0]));
    const band = carrier && assumedLane ? carrierBandEgp(carrier, code, fx, home) : null;
    const charged = chargedEgp(code, shipping, fx);
    const mid = band ? round((band[0] + band[1]) / 2) : null;
    const surplus = mid === null ? null : round(charged - mid);
    // The shipping is only half the story: the bottle's own markup is what pays for it.
    const net = surplus === null ? null : round(profit + surplus);
    // «مكسبنا 50% تكون صافية»: النسبة اللي بتفضل من الهامش بعد ما الشحن الحقيقي ياخد حقه.
    const keptPercent = net === null || profit <= 0 ? null : round((net / profit) * 100);
    const marginEaten = surplus === null || surplus >= 0 ? (surplus === null ? null : 0) : round(-surplus);
    const orderVerdict: DestinationPlan['orderVerdict'] = net === null ? 'unknown'
      : net < 0 ? 'loss'
        : profit > 0 && net < profit * 0.25 ? 'thin' : (profit > 0 ? 'profit' : 'thin');
    const promise: DestinationPlan['promise'] = lane === 'platform' ? 'broker_only' : lane === 'local' || lane === 'international' ? 'we_ship' : 'unknown';
    // The money verdict stands on its own: it is the carrier's published band against what we charge today.
    const costVerdict: DestinationPlan['costVerdict'] = !assumedLane || surplus === null ? 'unknown'
      : surplus < 0 ? 'loss'
        : surplus > charged * 0.5 ? 'over_charging' : 'ok';
    const relief = dutyReliefFor(customs.agreements, platform?.originCountry || null, code);
    const verified = Boolean(country && country.confidence !== 'unverified');
    return {
      code,
      nameAr: country?.nameAr || code,
      lane,
      assumedLane,
      assumedOrigin: home,
      lanesByPlatform,
      becauseAr: !platform ? 'مفيش منصة مسجلة'
        : platform.fulfilment === 'unknown' ? `طريقة تسليم «${platform.nameAr}» لسه مش مسجلة — مفيش وعد توصيل`
          : platform.fulfilment === 'platform_ships' && lane === 'platform' ? `«${platform.nameAr}» بتشحن للعالم — دورنا وساطة بس`
            : lane === 'local' ? `العميل في نفس بلد المنصة (${platform.originCountry}) — شحن محلي`
              : `البضاعة في ${home || 'بلد مش مسجل'} والعميل في بلد تاني — شحن دولي${home ? '' : ' (بلد الشحن مش مسجل)'}`,
      carrier: carrier ? { id: carrier.id, nameAr: carrier.nameAr, speedAr: carrier.speedAr, priceEgp: band, dg: carrier.dg, source: carrier.source || null } : null,
      alternative: others[0] ? { id: others[0].c.id, nameAr: others[0].c.nameAr, priceEgp: others[0].band! } : null,
      chargedEgp: charged,
      costEgp: band,
      surplusEgp: surplus,
      netEgp: net,
      orderVerdict,
      keptPercent,
      marginEatenEgp: marginEaten,
      requiredShippingEgp: band,
      promise,
      costVerdict,
      customs: {
        verified,
        deMinimis: country?.deMinimis ? `${country.deMinimis.amount} ${country.deMinimis.currency}` : null,
        vatPercent: country?.vatPercent ?? null,
        dutyPercent: country?.dutyPercent ?? null,
        restricted: country?.restricted?.ar || null,
        dutyRelief: relief ? { id: relief.id, nameAr: relief.nameAr, requires: relief.requires } : null,
        noteAr: country?.noteAr || 'مفيش بيانات جمركية متأكد منها — يتأكد قبل أي وعد للزائر.',
      },
    };
  });

  // ── products per lane (the catalogue, seen from each platform's mode) ──
  // The catalogue, counted by whose mode is known — the honest headline of «who ships».
  const products = {
    platform_ships: platforms.filter((p) => p.fulfilment === 'platform_ships').reduce((s2, p) => s2 + (Number(p.products) || 0), 0),
    broker: platforms.filter((p) => p.fulfilment === 'broker').reduce((s2, p) => s2 + (Number(p.products) || 0), 0),
    unknown: platforms.filter((p) => p.fulfilment === 'unknown').reduce((s2, p) => s2 + (Number(p.products) || 0), 0),
    total: platforms.reduce((s2, p) => s2 + (Number(p.products) || 0), 0),
  };

  // ── where the goods are: the first thing a lane needs ──
  const originMap = new Map<string, { products: number; platforms: string[]; fulfilment: Fulfilment[] }>();
  for (const p of platforms) {
    const raw = (p.originCountry || '').toUpperCase();
    if (!raw || p.originConfidence === 'unknown') continue;
    const row = originMap.get(raw) || { products: 0, platforms: [], fulfilment: [] };
    row.products += Number(p.products) || 0;
    row.platforms.push(p.id);
    row.fulfilment.push(p.fulfilment);
    originMap.set(raw, row);
  }
  const customsName = (code: string) => customsOf(code)?.nameAr || code;
  const localFor = (code: string) => {
    const c = pickCarrier(carriers, 'local', code, fx, code);
    return c ? { id: c.id, nameAr: c.nameAr, priceEgp: carrierBandEgp(c, code, fx, code) } : null;
  };
  const origins: OriginGroup[] = [...originMap.entries()]
    .map(([code, row]) => ({ code, nameAr: customsName(code), ...row, localCarrier: localFor(code) }))
    .sort((a, b) => b.products - a.products);

  // ── the rate the supplier price was built on, against today's ──
  const fxThresholdPercent = Number(input.fxThresholdPercent) > 0 ? Number(input.fxThresholdPercent) : 2;
  const fxLines = fxDrift(input.ratesUsed || [], fx, fxThresholdPercent);

  // ── gaps: what we still do not know ──
  const gaps: TradeReport['gaps'] = [];
  for (const p of platforms.filter((x) => x.fulfilment === 'unknown')) {
    gaps.push({ kindAr: 'طريقة التسليم', whatAr: `«${p.nameAr}» (${p.products || 0} منتج): بتشحن للعالم ولا محلية بس؟`, fixAr: 'صاحب المتجر يحدد الوضع في src/data/shipping-lanes.json (platform_ships أو broker)' });
  }
  for (const p of platforms.filter((x) => !x.originCountry)) {
    gaps.push({ kindAr: 'بلد المنشأ', whatAr: `«${p.nameAr}»: بلد المنشأ مش مسجل — من غيرها مفيش تقسيم محلي/دولي`, fixAr: 'يتسجل originCountry للمنصة' });
  }
  const unverified = customs.countries.filter((c) => c.confidence === 'unverified' && destinations.includes(c.code));
  if (unverified.length) gaps.push({ kindAr: 'الجمارك', whatAr: `${unverified.length} دولة من الوجهات مفيهاش بيانات جمركية متأكد منها (${unverified.slice(0, 5).map((c) => c.code).join('، ')}${unverified.length > 5 ? '…' : ''})`, fixAr: 'الروبوت يجيب المصدر الرسمي لكل دولة ويسجله بتاريخه' });
  const noDg = carriers.filter((c) => c.scope === 'international' && c.dg === null);
  if (noDg.length) gaps.push({ kindAr: 'المواد الخطرة', whatAr: `${noDg.length} شركة شحن دولية لسه مش متأكدين إنها بتقبل العطور (UN1266)`, fixAr: 'يتأكد من كل شركة قبل ما نعرض توصيل دولي — العطر سائل قابل للاشتعال' });
  // The local carriers that matter are the ones in the countries where the goods actually sit — not for all 74.
  const missingLocalOrigin = origins.filter((o) => !o.localCarrier || !o.localCarrier.priceEgp);
  if (missingLocalOrigin.length) {
    gaps.push({
      kindAr: 'شركات محلية',
      whatAr: `البضاعة في ${missingLocalOrigin.map((o) => `${o.nameAr} (${o.products} منتج)`).join('، ')} ومفيش سعر شحن محلي منشور فيها — يعني مفيش سعر توصيل جوّه البلد دي`,
      fixAr: 'يتسجل سعر منشور لشركة محلية في كل بلد فيها بضاعة، وإلا التوصيل الداخلي يبقى «يتأكد»',
    });
  }
  const quotedFrom = (c: Carrier, origin: string) => {
    const from = (c.originCountry || '*').toUpperCase();
    return from === '*' || from === origin.toUpperCase();
  };
  const noIntlFromOrigin = origins.filter((o) => !carriers.some((c) => c.scope === 'international' && quotedFrom(c, o.code) && (c.priceBandUsd || c.priceBandEgp || c.perCountryBand)));
  if (noIntlFromOrigin.length) {
    gaps.push({
      kindAr: 'سعر الشحن الدولي',
      whatAr: `مفيش سعر شحن دولي منشور من ${noIntlFromOrigin.map((o) => o.nameAr).join('، ')} — كل أسعار الشحن المسجلة محسوبة من مصر`,
      fixAr: 'يتجاب سعر منشور من شركة دولية بتشحن من بلد البضاعة (ومصدره وتاريخه) — أي رقم من غير مصدر يبقى «مش متاح»',
    });
  }
  for (const line of fxLines) {
    gaps.push({
      kindAr: 'سعر الصرف',
      whatAr: `${line.products} منتج سعره مبني على ${line.rateUsed} ج.م/${line.currency}، وسعر النهاردة ${line.rateToday} (فرق ${line.driftPercent > 0 ? '+' : ''}${line.driftPercent}%)`,
      fixAr: 'إعادة تسعير المنتجات دي على سعر الصرف الحالي — أو شرح إن التكلفة تغيّرت',
    });
  }
  const noLocalDest = destinations.filter((c) => !carriers.some((x) => x.scope === 'local' && x.country.toUpperCase() === c) && !origins.some((o) => o.code === c));
  if (noLocalDest.length) gaps.push({ kindAr: 'شركات محلية', whatAr: `${noLocalDest.length} وجهة مفيهاش شركة شحن محلية مسجلة`, fixAr: 'الروبوت يبحث عن أفضل شركة محلية في كل دولة بسعر منشور' });

  // ── money ──
  const known = plans.filter((p) => p.costVerdict !== 'unknown');
  const overCharged = known.filter((p) => p.costVerdict === 'over_charging').length;
  const loss = known.filter((p) => p.costVerdict === 'loss').length;
  const orderLoss = known.filter((p) => p.orderVerdict === 'loss').length;
  const nets = known.map((p) => p.netEgp).filter((n): n is number => n !== null);
  const bestNet = nets.length ? Math.max(...nets) : null;
  const worstNet = nets.length ? Math.min(...nets) : null;
  const averageCharged = plans.length ? round(plans.reduce((s, p) => s + p.chargedEgp, 0) / plans.length) : 0;
  // «الـ٥٠٪ كاملة» = الشحن اللي بنحصّله بيغطي تكلفته الحقيقية، فمفيش مليم بيتخصم من الهامش.
  const keptWhole = known.filter((p) => (p.marginEatenEgp ?? 1) === 0).length;
  const marginEaten = known.filter((p) => (p.marginEatenEgp ?? 0) > 0).length;

  // ── what the shipping table should charge so the 50% stays whole ──
  // Grouped by the table's own zones (so it is directly applicable), and the highest real cost in the zone wins —
  // a zone price that covers the dearest destination in it never eats the markup anywhere inside it.
  const shippingProposal: TradeReport['shippingProposal'] = [];
  const allZones = [...(shipping.zones || []), shipping.default].filter(Boolean) as ShippingZone[];
  const toTable = (egp: number) => Math.ceil(convert(egp, HOME_CURRENCY, shipping.currency, fx));
  for (const zone of allZones) {
    const codes = (zone.countries || []).map((c) => c.toUpperCase()).filter((c) => plans.some((p) => p.code === c));
    if (!codes.length) continue;
    const inside = plans.filter((p) => codes.includes(p.code));
    const priced = inside.filter((p) => p.requiredShippingEgp?.[0] !== null && p.requiredShippingEgp !== null);
    const required = priced.map((p) => p.requiredShippingEgp![0]).sort((a, b) => a - b);
    const base = {
      zoneId: zone.id, nameAr: zone.name?.ar || zone.id, currency: shipping.currency, countries: codes.length,
      currentFirstItem: zone.firstItem,
      covered: inside.filter((p) => (p.marginEatenEgp ?? 1) === 0).length,
    };
    if (!required.length) {
      shippingProposal.push({ ...base, typicalRequiredFirstItem: zone.firstItem, maxRequiredFirstItem: zone.firstItem, drivenByAr: null, destinations: [] });
      continue;
    }
    const mid = required[Math.floor(required.length / 2)];
    const max = required[required.length - 1];
    const dearest = priced.find((p) => p.requiredShippingEgp![0] === max) || null;
    shippingProposal.push({
      ...base,
      typicalRequiredFirstItem: toTable(mid),
      maxRequiredFirstItem: toTable(max),
      drivenByAr: dearest?.nameAr || null,
      destinations: priced.map((p) => ({ code: p.code, nameAr: p.nameAr, requiredFirstItem: toTable(p.requiredShippingEgp![0]) })),
    });
  }

  // ── score: what we know, weighted by what costs money ──
  const totalDest = plans.length || 1;
  const knownCustoms = plans.filter((p) => p.customs.verified).length;
  const laneKnown = plans.filter((p) => p.promise !== 'unknown').length;
  const priced = plans.filter((p) => p.costEgp !== null).length;
  const originKnown = platforms.length ? platforms.filter((p) => p.originCountry && p.originConfidence !== 'unknown').length / platforms.length : 0;
  const score = Math.max(0, Math.min(100, Math.round(
    (laneKnown / totalDest) * 40 + (knownCustoms / totalDest) * 25 + (priced / totalDest) * 20
      + (loss === 0 ? 10 : 0) + originKnown * 5,
  )));

  const notes: string[] = [];
  const planAr: string[] = [];
  if (modes.unknown.products) {
    notes.push(`${modes.unknown.products} منتج من منصة لسه مش مسجل بتشحن ولا محلية بس — مفيش وعد توصيل ليهم.`);
    planAr.push(`حدد طريقة تسليم ${modes.unknown.platforms.join('، ')} (وساطة أو إحنا بنشحن) — أكبر بند ناقص.`);
  }
  if (overCharged) {
    notes.push(`${overCharged} وجهة إحنا بنحصّل شحن فيها أكتر من ضعف تكلفته الحقيقية — ده بيقلل التحويل.`);
    planAr.push(`راجع سعر الشحن في ${overCharged} وجهة (الزائر بيدفع أكتر من التكلفة بكثير) — الشحن الزيادة بيطرد العميل.`);
  }
  if (profit > 0) notes.push(`مكسب الزجاجة (٥٠٪) ${profit} ج.م — والـ٥٠٪ بتفضل كاملة في ${keptWhole} وجهة بس من ${known.length}.`);
  if (loss) {
    notes.push(`${marginEaten} وجهة الشحن فيها بياكل من الهامش — الشحن اللي بنحصّله أقل من تكلفته الحقيقية.`);
    if (orderLoss) notes.push(`وفي ${orderLoss} وجهة الشحن بياكل الهامش كله وزيادة — الطلب هناك بخسارة حقيقية (أسوأها ${worstNet} ج.م).`);
    else if (worstNet !== null) notes.push(`أقل صافي طلب ${worstNet} ج.م — لسه موجب، بس مكسبه مش ٥٠٪ كامل.`);
  }
  const pricedPlans = plans.filter((p) => p.costEgp !== null);
  if (pricedPlans.length) {
    const cheapest = [...pricedPlans].sort((a, b) => (a.costEgp![0] - b.costEgp![0])).slice(0, 3);
    planAr.push(`لو إحنا اللي بنشحن، أرخص المسارات: ${cheapest.map((p) => `${p.nameAr} بـ${p.costEgp![0]}–${p.costEgp![1]} ج.م`).join('، ')}.`);
    planAr.push('عشان الـ٥٠٪ تفضل صافية: الشحن يتاخد بسعره الحقيقي (زي ما في جدول المقترح تحت) — والفرق ده مش بيتحمل من الهامش.');
  }
  const needRaise = shippingProposal.filter((z) => z.typicalRequiredFirstItem > z.currentFirstItem);
  if (needRaise.length) {
    planAr.push(`الشحن الحقيقي أغلى من اللي بنحصّله في ${needRaise.length} منطقة: ${needRaise.map((z) => `${z.nameAr} بياخد ${z.currentFirstItem} والمتوسط الحقيقي ${z.typicalRequiredFirstItem} ${z.currency}`).join('، ')} — والفرق بيتخصم من الـ٥٠٪. القرار لصاحب المتجر.`);
  }
  const reliefs = plans.filter((p) => p.customs.dutyRelief);
  if (reliefs.length) planAr.push(`${reliefs.length} وجهة ممكن تتلغي جمركها باتفاقية تجارية (${[...new Set(reliefs.map((r) => r.customs.dutyRelief!.id))].join('، ')}) — بس محتاجة ${reliefs[0].customs.dutyRelief!.requires.join(' + ')}.`);
  if (noDg.length) planAr.push(`${noDg.length} شركة دولية: تأكد قبول العطور (UN1266) قبل أي بيع دولي — الرفض بعد البيع = إلغاء وسمعة.`);
  if (modes.platform_ships.products) planAr.push(`${modes.platform_ships.products} منتج من منصات بتشحن بنفسها — الوساطة بس، والتأكد إن المنصة بترجع وتتعوض لو حصلت مشكلة.`);
  if (origins.length) planAr.push(`البضاعة في: ${origins.map((o) => `${o.nameAr} — ${o.products} منتج${o.localCarrier?.priceEgp ? ` (محلي: ${o.localCarrier.nameAr} ${o.localCarrier.priceEgp[0]}–${o.localCarrier.priceEgp[1]} ج.م)` : ' (مفيش سعر محلي منشور)'}`).join('، ')}.`);
  for (const line of fxLines) notes.push(`سعر الصرف: ${line.products} منتج سعره مبني على ${line.rateUsed} ج.م/${line.currency} وسعر النهاردة ${line.rateToday} — ${line.stateAr}.`);

  const summaryAr = `الشحن والتجارة: ${plans.length} وجهة — ${laneKnown} وجهة ممرها معروف، ${knownCustoms} دولة بجمارك متأكد منها، ${known.length} وجهة بسعر شحن مقارن${loss ? `، و${loss} وجهة لو إحنا بنشحن بتخسر` : ''}${origins.length ? ` · البضاعة في ${origins.map((o) => o.code).join('، ')}` : ''}${fxLines.length ? ` · ${fxLines.length} عملة سعر صرفها قديم` : ''}.`;

  return {
    version: 1, agent: 'trade-lanes', updatedAt: now,
    modes,
    platforms: platforms.map((p) => ({
      id: p.id, nameAr: p.nameAr, fulfilment: p.fulfilment, originCountry: p.originCountry,
      originConfidence: p.originConfidence || 'unknown', shipsTo: p.shipsTo || [], products: Number(p.products) || 0,
      noteAr: p.fulfilment === 'unknown' ? 'محتاج قرار صاحب المتجر' : p.fulfilment === 'platform_ships' ? 'وساطة — المنصة بتشحن' : 'إحنا بنشحن',
    })),
    destinations: plans, products, origins, fx: { thresholdPercent: fxThresholdPercent, lines: fxLines }, gaps,
    shippingProposal,
    money: {
      profitPerBottleEgp: profit, averageChargedEgp: averageCharged, pricedDestinations: known.length,
      overChargedDestinations: overCharged, lossDestinations: loss,
      orderLossDestinations: orderLoss, bestNetEgp: bestNet, worstNetEgp: worstNet,
      keptWholeDestinations: keptWhole, marginEatenDestinations: marginEaten,
    },
    score, notes, planAr, summaryAr,
  };
}
