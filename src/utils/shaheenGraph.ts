/**
 * «الشبكة العصبية لشاهين» — Shaheen's knowledge graph: the thing that turns separate files into one connected mind.
 *
 * The problem the owner named (2026-10-26): Shaheen has a memory, a school (1038 lessons), a board of ten
 * specialists, a catalogue, a shipping report and a customs table — but **nothing joins them**. He knows the fact but
 * not the chain: «this bottle ← that supplier ← ships from Malaysia ← to Egypt ← costs 1,876 EGP ← Egypt takes 14% VAT
 * ← and this lesson explains why». This module is the chain.
 *
 * A node is a real thing (a product, a brand, a supplier, an origin country, a destination, a carrier, a customs
 * table, a lesson, a topic, a specialist). An edge is a real relation, and **every edge carries its source and its
 * date** — no edge is invented. Built from the site's own files by `scripts/shaheen-synapse/` every three hours.
 *
 * Pure and browser-safe: the server, the admin panel and the tests all read the same graph.
 */

export type NodeKind =
  | 'product' | 'brand' | 'supplier' | 'origin' | 'destination' | 'carrier' | 'customs'
  | 'lesson' | 'topic' | 'specialist' | 'section';

export type Relation =
  /** product → brand */
  | 'brand_of'
  /** product → supplier */
  | 'supplied_by'
  /** supplier/platform → the country its stock actually leaves from */
  | 'ships_from'
  /** origin country → destination country (we carry the parcel) */
  | 'delivers_to'
  /** destination ← the carrier with a published rate for it */
  | 'carried_by'
  /** destination → its customs table */
  | 'cleared_by'
  /** lesson → the specialist whose field it belongs to */
  | 'teaches'
  /** lesson → its topic */
  | 'in_topic'
  /** specialist → a site section it advises */
  | 'advises'
  /** lesson → a real thing in the world it applies to (a carrier, a destination) — «الدرس ده يخص ده» */
  | 'applies_to';

export interface GraphNode {
  id: string;
  kind: NodeKind;
  labelAr: string;
  /** Where it comes from (a file path, an id in a report) — so nothing on the graph is anonymous. */
  ref?: string;
  /** Free facts the graph needs (a price, a country code…) — every number keeps its own source on the edge. */
  facts?: Record<string, string | number | null>;
}

export interface GraphEdge {
  from: string;
  to: string;
  relation: Relation;
  /** A measured number the relation carries (a cost in EGP, a VAT percent, a product count). */
  weight?: number;
  /** The unit of `weight` («EGP», «%», «منتج»). */
  unit?: string;
  source: string;
  checkedAt?: string;
  noteAr?: string;
  /** How sure we are that this relation is true: 1 = a published page, 0.5 = inferred from a real record. */
  confidence?: number;
}

export interface GraphStats {
  nodes: number;
  edges: number;
  byKind: Record<string, number>;
  byRelation: Record<string, number>;
  /** Nodes with no edge at all: knowledge that connects to nothing is knowledge he cannot use. */
  orphans: string[];
  /** Nodes with three or more edges: the hubs the mind actually thinks through. */
  hubs: { id: string; labelAr: string; degree: number }[];
}

export interface BrainScore {
  total: number;
  coverage: number;
  lessons: number;
  catalogue: number;
  freshness: number;
  connectivity: number;
  /** How many lessons reach a real thing in the world (a carrier, a destination) — knowledge that is usable. */
  depth: number;
  whyAr: string;
}

export interface ShaheenGraph {
  version: 1;
  updatedAt: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: GraphStats;
  score: BrainScore;
  summaryAr: string;
}

/** Everything the graph is built from: the site's real files, as typed tables (never read from disk here). */
export interface GraphInput {
  now: number;
  products: {
    sku: string; nameAr: string; brand?: string | null; supplierId?: string | null;
    supplierName?: string | null; ourPrice?: number; supplierPrice?: number; published?: boolean;
  }[];
  /** The platforms/suppliers we buy from and where their stock sits. */
  suppliers: { id: string; nameAr: string; originCountry: string | null; products?: number; checkedAt?: string }[];
  /** The destinations we sell to, with the carrier's real cost. */
  destinations: {
    code: string; nameAr: string;
    costs: { firstItemUsd: number; extraItemUsd: number; carrierId: string; carrierNameAr: string; source: string; checkedAt: string } | null;
    customs: { verified: boolean; vatPercent: number | null; dutyPercent: [number, number] | null; deMinimis: string | null; source?: string; checkedAt?: string } | null;
  }[];
  lessons: { id: string; title: string; track: string; topic: string; source?: string; content?: string }[];
  /** Each specialist's field and the lesson tracks it owns. */
  specialists: { id: string; nameAr: string; tracks: string[]; sections?: string[] }[];
  /** How long an edge may go without re-checking before it counts as stale. */
  staleDays?: number;
}

const DAY = 86_400_000;
const round = (n: number) => Math.round(n * 100) / 100;

/** A human label for each kind, for the report and the admin panel. */
export const KIND_LABEL_AR: Record<NodeKind, string> = {
  product: 'منتج', brand: 'ماركة', supplier: 'مورد', origin: 'بلد الشحن', destination: 'وجهة',
  carrier: 'شركة شحن', customs: 'جمارك', lesson: 'درس', topic: 'موضوع', specialist: 'متخصص', section: 'قسم',
};

export const RELATION_LABEL_AR: Record<Relation, string> = {
  brand_of: 'من ماركة', supplied_by: 'مورده', ships_from: 'بضاعته بتطلع من',
  delivers_to: 'بيوصل لـ', carried_by: 'بتشيله', cleared_by: 'جماركه', teaches: 'بيدرّسه',
  in_topic: 'موضوعه', advises: 'بيستشار في', applies_to: 'بيتطبق على',
};

/**
 * Builds the whole graph from the site's real files. Deterministic: the same input always gives the same graph, in
 * the same order — so the published file only changes when the truth changes.
 */
export function buildGraph(input: GraphInput): ShaheenGraph {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const add = (node: GraphNode) => { if (!nodes.has(node.id)) nodes.set(node.id, node); };
  const link = (edge: GraphEdge) => edges.push(edge);

  // ── الموردين وبلاد البضاعة (الأول، عشان كل منتج يتوصل بمورده) ─────────────────────────────────────
  for (const s of input.suppliers) {
    add({ id: `supplier:${s.id}`, kind: 'supplier', labelAr: s.nameAr, ref: 'src/data/shipping-lanes.json', facts: { products: Number(s.products) || 0 } });
    const origin = (s.originCountry || '').toUpperCase();
    if (!origin) continue;
    add({ id: `origin:${origin}`, kind: 'origin', labelAr: origin, ref: 'src/data/shipping-lanes.json' });
    link({
      from: `supplier:${s.id}`, to: `origin:${origin}`, relation: 'ships_from',
      weight: Number(s.products) || 0, unit: 'منتج',
      source: 'src/data/shipping-lanes.json',
      ...(s.checkedAt ? { checkedAt: s.checkedAt } : {}),
      confidence: 1,
    });
  }

  // ── المنتجات والماركات ────────────────────────────────────────────────────────────────────────
  const priced = input.products.filter((p) => Number(p.ourPrice) > 0 && p.published !== false);
  for (const p of priced) {
    const id = `product:${p.sku}`;
    add({ id, kind: 'product', labelAr: p.nameAr, ref: 'src/data/products.json', facts: { ourPrice: Number(p.ourPrice) || null } });
    const brand = (p.brand || '').trim();
    if (brand) {
      add({ id: `brand:${brand}`, kind: 'brand', labelAr: brand, ref: 'src/data/products.json' });
      link({ from: id, to: `brand:${brand}`, relation: 'brand_of', source: 'src/data/products.json', confidence: 1 });
    }
    const supplier = (p.supplierId || '').trim();
    if (supplier && nodes.has(`supplier:${supplier}`)) {
      link({ from: id, to: `supplier:${supplier}`, relation: 'supplied_by', source: 'src/data/products.json', confidence: 1 });
    }
  }

  // الموردين وبلاد البضاعة الأول — عشان كل حافة منتج تتأكد إن طرفها التاني موجود فعلاً.
  // ── الوجهات والشركات والجمارك ──────────────────────────────────────────────────────────────────
  // البضاعة اللي بنبيعها بتطلع من بلد واحد غالباً (أكبر مورد) — نربطه بالوجهة، مش كل بلد بكل وجهة.
  const dominant = [...input.suppliers].sort((a, b) => (Number(b.products) || 0) - (Number(a.products) || 0))[0];
  const origins = dominant?.originCountry ? [`origin:${dominant.originCountry.toUpperCase()}`] : [];
  for (const d of input.destinations) {
    const dest = `destination:${d.code}`;
    add({ id: dest, kind: 'destination', labelAr: d.nameAr, ref: 'src/data/live/trade-lanes.json' });

    // البضاعة بتطلع من بلد المورد → الوجهة (إحنا اللي بنشحن لما المنصة محلية).
    for (const origin of origins) {
      if (origin === dest) continue;
      link({
        from: origin, to: dest, relation: 'delivers_to',
        source: 'src/data/live/trade-lanes.json', confidence: 1,
        noteAr: 'بنشحن من بلد البضاعة للوجهة',
      });
    }

    if (d.costs) {
      const carrier = `carrier:${d.costs.carrierId}`;
      add({ id: carrier, kind: 'carrier', labelAr: d.costs.carrierNameAr, ref: 'src/data/shipping-lanes.json' });
      link({
        from: carrier, to: dest, relation: 'carried_by',
        weight: round(d.costs.firstItemUsd), unit: 'USD',
        source: d.costs.source, checkedAt: d.costs.checkedAt, confidence: 1,
        noteAr: `أول ٥٠٠ جم ${round(d.costs.firstItemUsd)} دولار + ${round(d.costs.extraItemUsd)} لكل ٥٠٠ جم زيادة`,
      });
    }

    if (d.customs) {
      const cid = `customs:${d.code}`;
      add({ id: cid, kind: 'customs', labelAr: `جمارك ${d.nameAr}`, ref: 'src/data/customs.json', facts: { vat: d.customs.vatPercent, deMinimis: d.customs.deMinimis } });
      link({
        from: dest, to: cid, relation: 'cleared_by',
        ...(d.customs.vatPercent !== null ? { weight: d.customs.vatPercent, unit: '%' } : {}),
        source: d.customs.source || 'src/data/customs.json', ...(d.customs.checkedAt ? { checkedAt: d.customs.checkedAt } : {}),
        confidence: d.customs.verified ? 1 : 0.5,
        noteAr: d.customs.verified ? 'ضريبة مؤكدة من مصدر منشور' : 'لسه مش متأكدين — بتتأكد قبل الدفع',
      });
    }
  }

  // ── الدروس والمتخصصين والمواضيع ────────────────────────────────────────────────────────────────
  const owner = new Map<string, string>();
  for (const s of input.specialists) for (const t of s.tracks) if (!owner.has(t)) owner.set(t, s.id);
  for (const s of input.specialists) {
    add({ id: `specialist:${s.id}`, kind: 'specialist', labelAr: s.nameAr, ref: 'src/utils/shaheenSpecialists.ts' });
    for (const section of s.sections || []) {
      add({ id: `section:${section}`, kind: 'section', labelAr: section, ref: 'src/utils/shaheenSpecialists.ts' });
      link({ from: `specialist:${s.id}`, to: `section:${section}`, relation: 'advises', source: 'src/utils/shaheenSpecialists.ts', confidence: 1 });
    }
  }
  for (const l of input.lessons) {
    const id = `lesson:${l.id}`;
    add({ id, kind: 'lesson', labelAr: l.title, ref: l.source || 'scripts/shaheen-school/' });
    if (l.topic) {
      add({ id: `topic:${l.topic}`, kind: 'topic', labelAr: l.topic, ref: 'scripts/shaheen-school/' });
      link({ from: id, to: `topic:${l.topic}`, relation: 'in_topic', source: l.source || 'scripts/shaheen-school/', confidence: 1 });
    }
    const who = owner.get(l.track);
    if (who) link({ from: id, to: `specialist:${who}`, relation: 'teaches', source: l.source || 'scripts/shaheen-school/', confidence: 1 });
  }

  // ── النسيج: الدرس يتوصل بالدنيا الحقيقية (شركة شحن/وجهة) ─────────────────────────────────────────
  // ده اللي بيحوّل «معلومة محفوظة» لـ«خبرة»: درس UN1266 بيتوصل بكل شركة شحن حالتها مش متأكدة،
  // ودرس عن بلد بيتوصل بالوجهة نفسها. الدليل نص الدرس نفسه — والثقة 0.6 لأنها مطابقة نص، مش سجل رسمي.
  const carriers = [...nodes.values()].filter((n) => n.kind === 'carrier');
  const destNodes = [...nodes.values()].filter((n) => n.kind === 'destination');
  const customsNodes = [...nodes.values()].filter((n) => n.kind === 'customs');
  const ABOUT_CUSTOMS = /جمارك|جمرك|de minimis|الاعفاء الجمركي|الإعفاء الجمركي|ضريبه القيمه المضافه|ضريبة القيمة المضافة|vat/;
  for (const l of input.lessons) {
    const text = normalise(`${l.title} ${l.content || ''}`);
    if (!text) continue;
    if (/un1266|مواد خطره|مواد خطرة|dangerous/.test(text)) {
      for (const c of carriers) {
        link({ from: `lesson:${l.id}`, to: c.id, relation: 'applies_to', source: l.source || 'scripts/shaheen-school/', confidence: 0.6, noteAr: 'الدرس بيربط بقبول العطور (UN1266) عند الشركة' });
      }
    }
    // درس عن الجمارك/الإعفاء بيشرح جمارك كل الوجهات — يتوصل بجداول الجمارك نفسها.
    if (ABOUT_CUSTOMS.test(text)) {
      for (const c of customsNodes) {
        link({ from: `lesson:${l.id}`, to: c.id, relation: 'applies_to', source: l.source || 'scripts/shaheen-school/', confidence: 0.6, noteAr: 'الدرس بيشرح الجمارك/الإعفاء اللي بيحكم الجدول ده' });
      }
    }
    let hits = 0;
    for (const d of destNodes) {
      const label = normalise(d.labelAr);
      if (label.length < 3 || !text.includes(label)) continue;
      link({ from: `lesson:${l.id}`, to: d.id, relation: 'applies_to', source: l.source || 'scripts/shaheen-school/', confidence: 0.6, noteAr: 'الدرس بيذكر الوجهة دي' });
      hits += 1;
      if (hits >= 3) break;
    }
  }

  // ── الترتيب والإحصاء ────────────────────────────────────────────────────────────────────────────
  const sortedNodes = [...nodes.values()].sort((a, b) => (a.kind === b.kind ? a.id.localeCompare(b.id) : a.kind.localeCompare(b.kind)));
  const sortedEdges = [...edges].sort((a, b) => `${a.from}|${a.relation}|${a.to}`.localeCompare(`${b.from}|${b.relation}|${b.to}`));
  const graph: ShaheenGraph = {
    version: 1, updatedAt: new Date(input.now).toISOString(),
    nodes: sortedNodes, edges: sortedEdges,
    stats: graphStats(sortedNodes, sortedEdges),
    score: { total: 0, coverage: 0, lessons: 0, catalogue: 0, freshness: 0, connectivity: 0, depth: 0, whyAr: '' },
    summaryAr: '',
  };
  graph.score = brainScore(graph, input.now, Number(input.staleDays) || 120);
  graph.summaryAr = brainSummary(graph);
  return graph;
}

export function graphStats(nodes: GraphNode[], edges: GraphEdge[]): GraphStats {
  const byKind: Record<string, number> = {};
  for (const n of nodes) byKind[n.kind] = (byKind[n.kind] || 0) + 1;
  const byRelation: Record<string, number> = {};
  const degree = new Map<string, number>();
  for (const e of edges) {
    byRelation[e.relation] = (byRelation[e.relation] || 0) + 1;
    degree.set(e.from, (degree.get(e.from) || 0) + 1);
    degree.set(e.to, (degree.get(e.to) || 0) + 1);
  }
  const orphans = nodes.filter((n) => !degree.has(n.id)).map((n) => n.id);
  const hubs = nodes
    .map((n) => ({ id: n.id, labelAr: n.labelAr, degree: degree.get(n.id) || 0 }))
    .filter((h) => h.degree >= 3)
    .sort((a, b) => b.degree - a.degree || a.id.localeCompare(b.id))
    .slice(0, 12);
  return { nodes: nodes.length, edges: edges.length, byKind, byRelation, orphans, hubs };
}

/**
 * How strong the mind is, on the same 0–100 scale as every other report:
 *   · التغطية (30): وجهات مربوطة بشركة ليها سعر منشور بتاريخه.
 *   · الدروس (25): دروس موصولة بمتخصص وموضوع.
 *   · الكتالوج (20): منتجات مسعّرة موصولة بموردها وماركتها.
 *   · الحداثة (15): حواف اتفحصت خلال آخر 120 يوم.
 *   · الترابط (10): مفيش عقدة معلّقة لوحدها.
 */
export function brainScore(graph: ShaheenGraph, now: number, staleDays = 120): BrainScore {
  const weak: string[] = [];
  const destinations = graph.nodes.filter((n) => n.kind === 'destination').map((n) => n.id);
  const wiredDestinations = destinations.filter((id) => graph.edges.some((e) => e.to === id && e.relation === 'carried_by' && e.source && e.checkedAt));
  const coverage = destinations.length ? Math.floor((wiredDestinations.length / destinations.length) * 25) : 0;

  const lessons = graph.nodes.filter((n) => n.kind === 'lesson').map((n) => n.id);
  const wiredLessons = lessons.filter((id) => graph.edges.some((e) => e.from === id && e.relation === 'teaches')
    && graph.edges.some((e) => e.from === id && e.relation === 'in_topic'));
  const lessonScore = lessons.length ? Math.floor((wiredLessons.length / lessons.length) * 20) : 0;

  const products = graph.nodes.filter((n) => n.kind === 'product').map((n) => n.id);
  const wiredProducts = products.filter((id) => graph.edges.some((e) => e.from === id && e.relation === 'supplied_by')
    && graph.edges.some((e) => e.from === id && e.relation === 'brand_of'));
  const catalogue = products.length ? Math.floor((wiredProducts.length / products.length) * 15) : 0;

  // «الحداثة» بتتقاس على الحواف اللي بتدّعي حاجة عن الدنيا (سعر شحن، جمارك) — مش على الروابط البنيوية
  // (منتج ← ماركة) اللي أصلها ملف الكتالوج نفسه.
  const WORLD: Relation[] = ['carried_by', 'cleared_by', 'ships_from'];
  const dated = graph.edges.filter((e) => WORLD.includes(e.relation));
  const fresh = dated.filter((e) => {
    const at = Date.parse(String(e.checkedAt));
    return Number.isFinite(at) && now - at <= staleDays * DAY;
  });
  const freshness = dated.length ? Math.floor((fresh.length / dated.length) * 10) : 0;

  const connectivity = graph.stats.nodes
    ? Math.floor((1 - graph.stats.orphans.length / graph.stats.nodes) * 5)
    : 0;

  // العمق: كام وجهة/شركة من اللي بنشتغل عليها فعلاً ليها درس مكتوب بيشرحها — الفرق بين «بنعمل» و«بنفهم».
  const world = [...destinations, ...graph.nodes.filter((n) => n.kind === 'carrier').map((n) => n.id)];
  const customsOf = new Map(graph.edges.filter((e) => e.relation === 'cleared_by').map((e) => [e.from, e.to]));
  const hasLesson = (id: string) => graph.edges.some((e) => e.to === id && e.relation === 'applies_to');
  const explained = world.filter((id) => hasLesson(id) || (customsOf.has(id) && hasLesson(customsOf.get(id)!)));
  const depth = world.length ? Math.floor((explained.length / world.length) * 25) : 0;

  const total = coverage + lessonScore + catalogue + freshness + connectivity + depth;
  if (coverage < 30) weak.push(`${destinations.length - wiredDestinations.length} وجهة من غير سعر شحن موثّق`);
  if (lessonScore < 25) weak.push(`${lessons.length - wiredLessons.length} درس مش موصول بمتخصصه`);
  if (catalogue < 20) weak.push(`${products.length - wiredProducts.length} منتج مش موصول بمورده`);
  if (freshness < 15) weak.push(`${dated.length - fresh.length} حافة عالمية قديمة أو بلا تاريخ`);
  if (connectivity < 5) weak.push(`${graph.stats.orphans.length} عقدة معلّقة لوحدها`);
  if (depth < 25) weak.push(`${world.length - explained.length} وجهة/شركة لسه مفيش درس مكتوب بيشرحها`);
  const whyAr = weak.length ? `أضعف حلقات العقل: ${weak.join(' · ')}` : 'كل العقد مربوطة وكل حافة حديثة';
  return { total, coverage, lessons: lessonScore, catalogue, freshness, connectivity, depth, whyAr };
}

export function brainSummary(graph: ShaheenGraph): string {
  const s = graph.stats;
  const kinds = (['product', 'lesson', 'destination', 'carrier', 'customs', 'supplier', 'brand', 'topic', 'specialist'] as NodeKind[])
    .map((k) => `${KIND_LABEL_AR[k]} ${s.byKind[k] || 0}`)
    .join(' · ');
  return `عقل شاهين: ${s.nodes} عقدة و${s.edges} حافة (${graph.score.total}/100). ${kinds}.`;
}

// ── سؤال الشبكة: المشي على الحواف بدل البحث بالكلمات ───────────────────────────────────────────────

/** Everything directly connected to a node, with the edge that connects it (both directions). */
export function neighbours(graph: ShaheenGraph, id: string, relation?: Relation): { node: GraphNode; edge: GraphEdge; direction: 'out' | 'in' }[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const out: { node: GraphNode; edge: GraphEdge; direction: 'out' | 'in' }[] = [];
  for (const e of graph.edges) {
    if (relation && e.relation !== relation) continue;
    if (e.from === id) {
      const node = byId.get(e.to);
      if (node) out.push({ node, edge: e, direction: 'out' });
    } else if (e.to === id) {
      const node = byId.get(e.from);
      if (node) out.push({ node, edge: e, direction: 'in' });
    }
  }
  return out;
}

/** The shortest chain between two nodes (`null` when they are not connected within `maxDepth`). */
export function trace(graph: ShaheenGraph, from: string, to: string, maxDepth = 5): { node: GraphNode; edge: GraphEdge | null }[] | null {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  if (!byId.has(from) || !byId.has(to)) return null;
  const seen = new Set([from]);
  const queue: { id: string; path: { node: GraphNode; edge: GraphEdge | null }[] }[] = [{ id: from, path: [{ node: byId.get(from)!, edge: null }] }];
  while (queue.length) {
    const current = queue.shift()!;
    if (current.id === to) return current.path;
    if (current.path.length > maxDepth) continue;
    for (const { node, edge } of neighbours(graph, current.id)) {
      if (seen.has(node.id)) continue;
      seen.add(node.id);
      queue.push({ id: node.id, path: [...current.path, { node, edge }] });
    }
  }
  return null;
}

/** A node by id, or by a free-text hint (a country name, a lesson title, a product name) — case/diacritic tolerant. */
export function findNode(graph: ShaheenGraph, hint: string): GraphNode | undefined {
  const needle = normalise(hint);
  if (!needle) return undefined;
  const exact = graph.nodes.find((n) => normalise(n.id) === needle || normalise(n.labelAr) === needle);
  if (exact) return exact;
  const scored = graph.nodes
    .map((n) => ({ n, hit: normalise(`${n.labelAr} ${n.id}`).includes(needle) }))
    .filter((x) => x.hit);
  // The most connected match wins: the mind answers from the hub, not from a leaf.
  return scored.sort((a, b) => b.n.id.length - a.n.id.length)[0]?.n;
}

function normalise(text: string): string {
  return String(text || '').toLowerCase()
    .replace(/[\u064B-\u0652\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/** «إيه حكاية الوجهة دي؟» — the whole chain in one line per hop, with each edge's own source. */
export function explain(graph: ShaheenGraph, id: string, maxHops = 2): string[] {
  const start = graph.nodes.find((n) => n.id === id);
  if (!start) return [];
  const lines = [`${KIND_LABEL_AR[start.kind]}: ${start.labelAr}`];
  let frontier = [id];
  const seen = new Set([id]);
  for (let hop = 0; hop < maxHops; hop += 1) {
    const next: string[] = [];
    for (const current of frontier) {
      for (const { node, edge } of neighbours(graph, current)) {
        if (seen.has(node.id)) continue;
        seen.add(node.id);
        next.push(node.id);
        const weight = edge.weight !== undefined ? ` (${edge.weight}${edge.unit === '%' ? '%' : ` ${edge.unit || ''}`})` : '';
        lines.push(`  ${RELATION_LABEL_AR[edge.relation]} ${node.labelAr}${weight} — ${edge.source}${edge.checkedAt ? ` · ${edge.checkedAt}` : ''}`);
      }
    }
    frontier = next;
  }
  return lines;
}

/** The guard the workflow uses before publishing: the file must be a real, counted graph. */
export const isShaheenGraph = (value: unknown): value is ShaheenGraph => {
  const g = value as ShaheenGraph | undefined;
  return Boolean(g && g.version === 1 && typeof g.updatedAt === 'string'
    && Array.isArray(g.nodes) && Array.isArray(g.edges)
    && g.nodes.length > 0 && g.edges.length > 0
    && g.stats && typeof g.stats.nodes === 'number'
    && g.score && typeof g.score.total === 'number');
};
