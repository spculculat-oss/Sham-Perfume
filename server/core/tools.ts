/**
 * Tool registry (function calling, provider-neutral). Tools run on Sham's server, read Sham's
 * data, and return structured observations + UI action cards. Tools that change business state
 * (placing orders, opening tickets) are NOT callable by any model: they become a form card the
 * visitor confirms, which is the commerce-safe equivalent of "human approval" in agent systems.
 */
import type { Repository } from './repository';
import { publicView } from './repository';
import type { ActionCard, Citation, Product, ServiceDef } from './types';
import { excerpt } from './text';

export interface ToolContext { repo: Repository; message: string; lang: 'ar' | 'en' }
export interface ToolResult { observation: string; actions?: ActionCard[]; citations?: Citation[]; data?: unknown }
export interface Tool<A = Record<string, unknown>> {
  name: string;
  description: string;
  run(args: A, ctx: ToolContext): Promise<ToolResult>;
}

const productCard = (p: Product) => ({ id: p.id, sku: p.sku, nameAr: p.nameAr, nameEn: p.nameEn, price: p.price, currency: p.currency, stock: p.stock, unit: p.unit });

export const tools = {
  retrieve_knowledge: {
    name: 'retrieve_knowledge',
    description: 'Search Sham knowledge base, services and catalog (BM25).',
    async run(args: { query: string }, { repo }) {
      const index = await repo.searchIndex();
      // Relative + absolute thresholds: weak lexical overlaps are dropped instead of shown as answers.
      const raw = index.search(args.query, 6, 1.2).filter((h) => h.doc.kind !== 'product');
      // Coverage-based selection: the best passage always; each extra passage must answer a *significant*
      // part of the question (query terms the stronger passages did not cover, weighted by BM25).
      const covered = new Set<string>();
      const hits = raw.filter((h, i) => {
        const fresh = Object.entries(h.matched).filter(([t]) => !covered.has(t)).reduce((sum, [, w]) => sum + w, 0);
        if (i > 0 && (h.score < raw[0].score * 0.45 || fresh < raw[0].score * 0.4)) return false;
        Object.keys(h.matched).forEach((t) => covered.add(t));
        return true;
      }).slice(0, 3);
      const docs = await repo.knowledge();
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
