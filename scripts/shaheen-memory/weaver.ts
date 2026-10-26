/**
 * «الناسج» — weaver: connects the mind to the data, inside the site and outside it.
 *
 * It weaves every destination's real cost, carrier, customs, zone and agreement into one row, then checks that
 * every edge in the mind graph still resolves to real data. Each thread carries source+date; a missing thread
 * is a "not available" flag, never an invention. This is the connectivity body between the mind and the data.
 *
 * Output: src/data/live/weave.json
 */
import type { FxTable, ShippingCosts, ShippingTable } from '../../src/utils/pricing';
import { convert, currencyFor, realShipping, shippingZone } from '../../src/utils/pricing';
import { isShaheenGraph } from '../../src/utils/shaheenGraph';

export interface WeaveThread {
  destination: string;
  code: string;
  nameAr: string;
  /** Route: platform_ships (the platform ships itself) | broker (we arrange shipping) | unknown. */
  route: 'platform_ships' | 'broker' | 'unknown';
  carrier: { id: string | null; nameAr: string | null; source: string | null; dg: boolean | null };
  cost: { firstItemUsd: number | null; extraItemUsd: number | null; chargedEgp: number | null; source: string | null; checkedAt: string | null };
  zone: { id: string; nameAr: string } | null;
  customs: { verified: boolean; vatPercent: number | null; source: string | null; agreed?: { id: string; nameAr: string } | null };
  /** Is this whole row backed by real, sourced data — or is part of it "not available"? */
  complete: boolean;
  missing: string[];
}

export interface WeaveReport {
  version: 1;
  agent: 'weaver';
  updatedAt: string;
  score: number;
  counts: { complete: number; partial: number; missing: number };
  threads: WeaveThread[];
  graph: { nodes: number; edges: number; edgesWithSource: number; edgesDated: number; orphans: number };
  summaryAr: string;
  planAr: string[];
}

export interface WeaveInput {
  now: number;
  graph: ReturnType<typeof import('../../src/utils/shaheenGraph').buildGraph> extends infer G ? G : never;
  destinations: { code: string; nameAr: string; route: 'platform_ships' | 'broker' | 'unknown'; carrier?: { id: string; nameAr: string; source?: string | null; dg?: boolean | null; checkedAt?: string | null } }[];
  costs: ShippingCosts;
  shipping: ShippingTable;
  customs: { countries?: Record<string, { vatPercent?: number; source?: string | null; checkedAt?: string; agreement?: string | null }>; agreements?: { id: string; nameAr: string }[] };
  fx: FxTable;
}

/** Avoid importing the graph type directly to keep this file browser-safe. */
type GraphNode = { id: string; kind: string };
type GraphEdge = { from: string; to: string; source?: string | null; updatedAt?: string | null };

export function buildWeave(input: WeaveInput): WeaveReport {
  const { now, destinations, costs, shipping, customs, fx } = input;
  const ctry = customs.countries || {};
  const agreements = new Map((customs.agreements || []).map((a) => [a.id, a]));
  const threads: WeaveThread[] = [];
  const nodeIds = new Set<string>();
  let edges = 0, edgesWithSource = 0, edgesDated = 0;

  // Count graph nodes/edges if a graph was passed.
  const g = input.graph as { nodes?: GraphNode[]; edges?: GraphEdge[] } | undefined;
  if (g) {
    for (const n of g.nodes || []) nodeIds.add(n.id);
    for (const e of g.edges || []) {
      edges += 1;
      if (e.source) edgesWithSource += 1;
      if (e.updatedAt) edgesDated += 1;
    }
  }

  for (const d of destinations) {
    const missing: string[] = [];
    const row = ctry[d.code];
    const costRow = costs.countries?.[d.code];
    const charged = realShipping(d.code, 1, shipping);
    const zone = shippingZone(d.code, shipping);
    const carrier = d.carrier;
    const customsInfo = row || {};
    const vat = customsInfo.vatPercent ?? null;
    const agreement = customsInfo.agreement ? agreements.get(customsInfo.agreement) : null;

    if (!costRow && !charged) missing.push('cost');
    if (!carrier?.id) missing.push('carrier');
    if (vat === null) missing.push('customs');
    if (!zone) missing.push('zone');

    let chargedEgp: number | null = null;
    if (charged) {
      try { chargedEgp = Math.round(convert(charged, shipping.currency, 'EGP', fx) * 100) / 100; }
      catch { chargedEgp = null; missing.push('fx'); }
    }

    const complete = missing.length === 0;
    threads.push({
      destination: d.nameAr, nameAr: d.nameAr, code: d.code, route: d.route,
      carrier: { id: carrier?.id ?? null, nameAr: carrier?.nameAr ?? null, source: carrier?.source ?? null, dg: carrier?.dg ?? null },
      cost: {
        firstItemUsd: costRow ? Number(costRow.firstItem) : null,
        extraItemUsd: costRow ? Number(costRow.extraItem) : null,
        chargedEgp,
        source: carrier?.source ?? costs.source ?? null,
        checkedAt: carrier?.checkedAt ?? costs.checkedAt ?? null,
      },
      zone: zone ? { id: zone.id, nameAr: zone.name.ar } : null,
      customs: { verified: vat !== null, vatPercent: vat, source: customsInfo.source ?? null, ...(agreement ? { agreed: agreement } : {}) },
      complete, missing,
    });
  }

  const completeCount = threads.filter((t) => t.complete).length;
  const partialCount = threads.filter((t) => !t.complete && t.missing.length < 3).length;
  const missingCount = threads.filter((t) => t.missing.length >= 3).length;

  // Orphan edges: an edge whose node isn't in the node set (when graph present).
  let orphans = 0;
  if (g) {
    for (const e of g.edges || []) {
      if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) orphans += 1;
    }
  }

  const score = Math.max(0, Math.min(100, 100 - missingCount * 6 - partialCount * 2 - orphans * 4));
  const misses = threads.filter((t) => !t.complete);

  return {
    version: 1, agent: 'weaver', updatedAt: new Date(now).toISOString(),
    score, counts: { complete: completeCount, partial: partialCount, missing: missingCount },
    threads,
    graph: { nodes: nodeIds.size, edges, edgesWithSource, edgesDated, orphans },
    summaryAr: missingCount
      ? `الناسج: ${missingCount} وجهة من غير بيانات كافية · ${completeCount}/${threads.length} مكتملة`
      : `الناسج: ${completeCount}/${threads.length} وجهة مكتملة المصدر والتاريخ · النتيجة ${score}/100`,
    planAr: [
      ...misses.slice(0, 6).map((t) => `${t.destination} (${t.code}): ناقص ${t.missing.join('، ')} — سجله بمصدر وتاريخ`),
      ...(orphans ? [`حافة{(orphans>1)?'ات':''} في شبكة العقل من غير عقدة معروفة: ${orphans} — راجع مصدر البيانات`] : []),
      ...((missingCount || partialCount || orphans) ? [] : ['كل الوجهات مكتملة البيانات وكل حواف الشبكة موثّقة بتاريخها.']),
    ],
  };
}

export const isWeaveReport = (v: unknown): v is WeaveReport => {
  const r = v as WeaveReport | undefined;
  return Boolean(r && r.version === 1 && r.agent === 'weaver' && typeof r.score === 'number' && Array.isArray(r.threads));
};
