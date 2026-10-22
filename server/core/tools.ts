/**
 * Tool registry (function calling, provider-neutral). Tools run on Sham's server, read Sham's
 * data, and return structured observations + UI action cards. Tools that change business state
 * (placing orders, opening tickets) are NOT callable by any model: they become a form card the
 * visitor confirms, which is the commerce-safe equivalent of "human approval" in agent systems.
 */
import { asksForPlatformOverview } from './platformGuide';
import { findStorefront, priceDigest, storefrontCatalog, storeLine, type StoreItem } from './storeGuide';
import type { Repository } from './repository';
import { publicView } from './repository';
import type { ActionCard, Citation, Product, ServiceDef } from './types';
import { excerpt, tokenize } from './text';

export interface ToolContext { repo: Repository; message: string; lang: 'ar' | 'en'; env?: Record<string, string | undefined> }
export interface ToolResult { observation: string; actions?: ActionCard[]; citations?: Citation[]; data?: unknown }
export interface Tool<A = Record<string, unknown>> {
  name: string;
  description: string;
  run(args: A, ctx: ToolContext): Promise<ToolResult>;
}

const productCard = (p: Product) => ({ id: p.id, sku: p.sku, nameAr: p.nameAr, nameEn: p.nameEn, price: p.price, currency: p.currency, stock: p.stock, unit: p.unit });

/**
 * A passage may only answer a question when it is about the same subject: at least one word of the
 * document's title matched, or three distinct terms did. Without this, a question about «مواعيد الفرع»
 * was answered by the returns policy because it happens to contain «مفتوح» and «يوم».
 */
function aboutSameSubject(hit: { doc: { title: string }; matched: Record<string, number> }): boolean {
  const title = new Set(tokenize(hit.doc.title));
  const terms = Object.keys(hit.matched);
  return terms.some((term) => title.has(term)) || terms.length >= 3;
}

export const tools = {
  retrieve_knowledge: {
    name: 'retrieve_knowledge',
    description: 'Search Sham knowledge base, services and catalog (BM25).',
    async run(args: { query: string }, { repo }) {
      const index = await repo.searchIndex();
      // Relative + absolute thresholds: weak lexical overlaps are dropped instead of shown as answers.
      const raw = index.search(args.query, 6, 1.2)
        .filter((h) => h.doc.kind !== 'product')
        // «دليل المنصة» lists every feature name, so it would edge into answers about one feature.
        // It is fetched only when the visitor actually asks for the whole map.
        .filter((h) => h.doc.id !== 'kb-platform-guide' || asksForPlatformOverview(args.query));
      // Curated admin knowledge outranks the lessons «الخبير شاهين» writes by itself: a learned lesson
      // must match clearly (never on a stray word) and never win a near tie against a hand-written doc.
      const isTrained = (h: (typeof raw)[number]) => h.doc.id.startsWith('shaheen-');
      const ordered = raw
        .filter((h) => !isTrained(h) || h.score >= 3)
        .map((h) => ({ h, rank: isTrained(h) ? h.score : h.score * 1.15 }))
        .sort((a, b) => b.rank - a.rank)
        .map(({ h }) => h);
      // Coverage-based selection: the best passage always; each extra passage must answer a *significant*
      // part of the question (query terms the stronger passages did not cover, weighted by BM25).
      const covered = new Set<string>();
      const hits = ordered.filter(aboutSameSubject).filter((h, i) => {
        const fresh = Object.entries(h.matched).filter(([t]) => !covered.has(t)).reduce((sum, [, w]) => sum + w, 0);
        if (i > 0 && (h.score < ordered[0].score * 0.45 || fresh < ordered[0].score * 0.4)) return false;
        Object.keys(h.matched).forEach((t) => covered.add(t));
        return true;
      }).slice(0, 3);
      const docs = await repo.allKnowledge();
      const services = await repo.services();
      const passages = hits.map((h) => {
        const full = h.doc.kind === 'knowledge' ? docs.find((d) => d.id === h.doc.id)?.content || h.doc.text
          : `${services.find((s) => s.id === h.doc.id)?.descriptionAr || ''}`;
        return { id: h.doc.id, title: h.doc.title, kind: h.doc.kind, text: excerpt(full, args.query), score: Number(h.score.toFixed(2)) };
      });
      return {
        observation: passages.length ? passages.map((p) => `[${p.id}] ${p.title}: ${p.text}`).join('\n') : 'NO_RESULTS',
        citations: passages.map((p) => ({ id: p.id, title: p.title, kind: p.kind })),
        data: passages,
      };
    },
  } as Tool<{ query: string }>,

  search_catalog: {
    name: 'search_catalog',
    description: 'Find active products with live price and stock.',
    async run(args: { query: string; limit?: number }, { repo }) {
      const products = await repo.products();
      if (!products.length) return { observation: 'CATALOG_EMPTY', data: { matched: false, products: [] } };
      const index = await repo.searchIndex();
      const ids = index.search(args.query, args.limit || 6, 0.3).filter((h) => h.doc.kind === 'product').map((h) => h.doc.id);
      const found = (ids.length ? ids.map((id) => products.find((p) => p.id === id)!).filter(Boolean) : products.slice(0, args.limit || 6));
      return {
        observation: `${ids.length ? 'MATCHES' : 'NO_MATCH_SHOWING_LATEST'}\n${found.map((p) => `${p.sku} | ${p.nameAr || p.nameEn} | ${p.price} ${p.currency} | stock ${p.stock}${p.demo ? ' | DEMO' : ''}`).join('\n')}`,
        actions: [{ type: 'products', products: found.map(productCard) }],
        citations: found.map((p) => ({ id: p.id, title: p.nameAr || p.nameEn, kind: 'product' as const })),
        data: { matched: ids.length > 0, products: found },
      };
    },
  } as Tool<{ query: string; limit?: number }>,

  search_store: {
    name: 'search_store',
    description: 'Search the real Sham storefront catalog (live prices, stock, families) — not the internal orders catalog.',
    async run(args: { query: string; limit?: number }, { lang }) {
      const { items, snapshot } = await storefrontCatalog();
      if (snapshot.empty) return { observation: 'STOREFRONT_EMPTY', data: { matched: false, items: [] as StoreItem[], snapshot } };
      const { picks, matched } = findStorefront(items, args.query, args.limit || 4);
      // No name match is not the same as no products: show the real price range across the catalog so a vague
      // «إيه أسعار المنتجات؟» gets an honest spread (cheapest → median → premium), not four arbitrary items.
      if (!matched) {
        const digest = priceDigest(items, args.limit || 4);
        return {
          observation: `${digest.picks.length ? 'STORE_PRICE_DIGEST' : 'STORE_NO_MATCH'}\n${digest.picks.map((p) => storeLine(p, lang)).join('\n')}`,
          citations: digest.picks.map((p) => ({ id: p.sku, title: lang === 'ar' ? p.nameAr : p.nameEn, kind: 'product' as const })),
          data: { matched: false, items: digest.picks, digest: { min: digest.min, max: digest.max }, snapshot },
        };
      }
      return {
        observation: `STORE_MATCHES\n${picks.map((p) => storeLine(p, lang)).join('\n')}`,
        citations: picks.map((p) => ({ id: p.sku, title: lang === 'ar' ? p.nameAr : p.nameEn, kind: 'product' as const })),
        data: { matched, items: picks, snapshot },
      };
    },
  } as Tool<{ query: string; limit?: number }>,

  store_overview: {
    name: 'store_overview',
    description: 'Live store facts: published products, stock, brands, scent families and the price range.',
    async run(_args, { lang }) {
      const { snapshot } = await storefrontCatalog();
      const ar = lang === 'ar';
      if (snapshot.empty) return { observation: 'STOREFRONT_EMPTY', data: snapshot };
      const observation = ar
        ? `المنتجات المنشورة ${snapshot.total} (متوفر ${snapshot.inStock}) · نطاق السعر ${snapshot.minPrice}–${snapshot.maxPrice} جنيه · ماركات: ${snapshot.brands.map((b) => b.name).join('، ')} · عائلات: ${snapshot.families.map((f) => f.id).join(', ')}`
        : `${snapshot.total} published products (${snapshot.inStock} in stock) · price ${snapshot.minPrice}–${snapshot.maxPrice} EGP · brands: ${snapshot.brands.map((b) => b.name).join(', ')} · families: ${snapshot.families.map((f) => f.id).join(', ')}`;
      return { observation, data: snapshot };
    },
  } as Tool,

  list_services: {
    name: 'list_services',
    description: 'List enabled services.',
    async run(_args, { repo, lang }) {
      const services = await repo.services();
      return {
        observation: services.map((s) => `- ${lang === 'ar' ? s.nameAr : s.nameEn}: ${lang === 'ar' ? s.descriptionAr : s.descriptionEn}`).join('\n'),
        data: services,
      };
    },
  } as Tool,

  prepare_request_form: {
    name: 'prepare_request_form',
    description: 'Return the request form for a service; the visitor submits it (no model can submit).',
    async run(args: { service: ServiceDef }) {
      const s = args.service;
      return {
        observation: `FORM_READY for ${s.id} (${s.kind}); fields: ${s.formFields.map((f) => f.name).join(', ') || 'contact only'}`,
        actions: [{ type: 'request_form', serviceId: s.id, title: s.nameAr, fields: s.formFields }],
      };
    },
  } as Tool<{ service: ServiceDef }>,

  track_order: {
    name: 'track_order',
    description: 'Look up a request by reference + contact used in it.',
    async run(args: { ref?: string; contact?: string }, { repo }) {
      if (!args.ref || !args.contact) {
        return { observation: 'NEED_REF_AND_CONTACT', actions: [{ type: 'order_status', ref: args.ref }] };
      }
      const request = await repo.trackRequest(args.ref, args.contact);
      if (!request) return { observation: 'NOT_FOUND_OR_CONTACT_MISMATCH', actions: [{ type: 'order_status', ref: args.ref }] };
      return { observation: `FOUND ${request.ref} status=${request.status}`, actions: [{ type: 'order_status', request: publicView(request) }], data: request };
    },
  } as Tool<{ ref?: string; contact?: string }>,

  calc_concentration: {
    name: 'calc_concentration',
    description: 'Volume-based perfume concentration split (oil vs. alcohol base).',
    async run(args: { volumeMl: number; percent: number }) {
      const { volumeMl, percent } = args;
      if (!(volumeMl > 0 && volumeMl <= 100000 && percent > 0 && percent <= 100)) return { observation: 'INVALID_INPUT' };
      const oil = Math.round(volumeMl * percent) / 100;
      const base = Math.round((volumeMl - oil) * 100) / 100;
      return {
        observation: `volume=${volumeMl}ml percent=${percent}% oil=${oil}ml base=${base}ml (by volume)`,
        actions: [{ type: 'open_tab', tab: 'concentration' }],
        data: { volumeMl, percent, oil, base },
      };
    },
  } as Tool<{ volumeMl: number; percent: number }>,
};
