/**
 * The reflex's inputs, read from the site's own files — shared by «العقل» (scripts/shaheen-mind/run.mts) and
 * «تسعير شام» (scripts/shaheen-store/fx.mts).
 *
 * Why the exchange-rate step rebuilds it too: the reflex answers carry EGP numbers. When the importer refreshed
 * the day's rates, the shipping answer still showed the old rate's number until the mind ran again — the
 * regression tests caught that drift and every import was refused (2026-10-28). Rebuilding the table right after
 * the rates change keeps «الشحن لمصر بكام؟» equal to what the checkout charges.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { convert, shippingCost, type FxTable, type ShippingCosts, type ShippingTable } from '../../src/utils/pricing';
import { SPECIALISTS } from '../../src/utils/shaheenSpecialists';
import { buildReflex, isReflexReport, type ReflexInput } from './reflex';

export interface TradeLanes {
  destinations: {
    code: string; nameAr: string; promise: string;
    costEgp: [number, number] | null; costExtraEgp?: number | null;
    carrier: { id: string; nameAr: string; source?: string | null } | null;
    customs: { verified: boolean; vatPercent: number | null; source?: string | null };
  }[];
  origins: { code: string; nameAr: string; products: number }[];
}
export interface ShippingLanes { carriers: { id: string; nameAr: string; dg: boolean | null; source?: string; checkedAt?: string }[] }

export const tradeSpecialistId = SPECIALISTS.find((s) => s.tracks.includes('commerce'))?.id || 'specialist_business';

/** One row per destination: the carrier, the customs and the EGP the checkout charges for the first bottle. */
export function reflexDestinations(trade: TradeLanes, lanes: ShippingLanes, costs: ShippingCosts, shipping: ShippingTable, fx: FxTable) {
  const carrierOf = (id: string | null | undefined) => (id ? lanes.carriers.find((c) => c.id === id) : undefined);
  return trade.destinations.map((d) => {
    const row = costs.countries?.[d.code];
    const carrier = carrierOf(d.carrier?.id);
    return {
      code: d.code, nameAr: d.nameAr,
      costUsd: row ? Number(row.firstItem) : null,
      extraUsd: row ? Number(row.extraItem) : null,
      chargedEgp: row ? Math.round(convert(shippingCost(d.code, 1, shipping), shipping.currency, 'EGP', fx) * 100) / 100 : null,
      carrierId: d.carrier?.id || null, carrierNameAr: d.carrier?.nameAr || null,
      carrierSource: d.carrier?.source || carrier?.source || null,
      carrierCheckedAt: carrier?.checkedAt || costs.checkedAt || null,
      carrierDg: carrier?.dg ?? null,
      customsVerified: Boolean(d.customs.verified), vatPercent: d.customs.vatPercent,
      customsSource: d.customs.source || 'src/data/customs.json',
    };
  });
}

/** Rebuild src/data/live/shaheen-reflex.json from the files on disk (no network, no AI). Returns the entry count. */
export function rebuildReflexFromFiles(now = Date.now()): number {
  const read = (rel: string) => JSON.parse(readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8'));
  const costs = read('src/data/shipping-costs.json') as ShippingCosts;
  const shipping: ShippingTable = { ...(read('src/data/shipping.json') as ShippingTable), costs };
  const fx = read('src/data/live/fx-rates.json') as FxTable;
  const destinations = reflexDestinations(read('src/data/live/trade-lanes.json') as TradeLanes, read('src/data/shipping-lanes.json') as ShippingLanes, costs, shipping, fx);
  const input: ReflexInput = { now, shipping, fx, destinations, tradeSpecialistId };
  const reflex = buildReflex(input);
  if (!isReflexReport(reflex)) throw new Error('reflex table is not valid');
  writeFileSync(new URL('../../src/data/live/shaheen-reflex.json', import.meta.url), `${JSON.stringify(reflex, null, 1)}\n`);
  return reflex.entries.length;
}
