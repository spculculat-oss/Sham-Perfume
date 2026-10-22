/**
 * Tool registry (function calling, provider-neutral). Tools run on Sham's server, read Sham's
 * data, and return structured observations + UI action cards. Tools that change business state
 * (placing orders, opening tickets) are NOT callable by any model: they become a form card the
 * visitor confirms, which is the commerce-safe equivalent of "human approval" in agent systems.
 */
import type { Repository } from './repository';
import { publicView } from './repository';
import type { ActionCard, Citation, Product, ServiceDef } from './types';
import { excerpt, normalize, tokenize } from './text';

export interface ToolContext { repo: Repository; message: string; lang: 'ar' | 'en' }
export interface ToolResult { observation: string; actions?: ActionCard[]; citations?: Citation[]; data?: unknown }
export interface Tool<A = Record<string, unknown>> {
  name: string;
  description: string;
  run(args: A, ctx: ToolContext): Promise<ToolResult>;
}

const productCard = (p: Product) => ({ id: p.id, sku: p.sku, nameAr: p.nameAr, nameEn: p.nameEn, price: p.price, currency: p.currency, stock: p.stock, unit: p.unit });

const synRe = (alts: string) => new RegExp(`(?:^|\\s)(?:وال|بال|لل|ال|و)?(?:${alts})(?=$|\\s)`, 'iu');

/** قاموس مرادفات مجال العطور والتشغيل لتوسيع الاستعلامات عند غياب التطابق اللفظي المباشر. */
const KNOWLEDGE_SYNONYMS: Array<[RegExp, string]> = [
  [synRe('توصيل|مندوب|بيوصل|يوصل|مده الوصول|delivery|courier'), 'شحن توصيل طلبات shipping'],
  [synRe('ترجيع|ارجاع|استرجاع|استبدال|تبديل|refund|exchange|return'), 'استرجاع سياسة استبدال دعم'],
  [synRe('ثبات|فوحان|يدوم|بيثبت|تثبيت|longevity|sillage|projection'), 'تعتيق تركيز تثبيت maceration'],
  [synRe('تخمير|تجانس|نقع|aging|steeping'), 'تعتيق العطر maceration'],
  [synRe('برفان|بارفان|بيرفيوم|عطور'), 'عطر fragrance'],
  [synRe('كميات|كرتونه|تاجر|توزعوا|private label|bulk'), 'جملة تصنيع B2B wholesale'],
];

const CATALOG_SYNONYMS: Array<[RegExp, string]> = [
  [synRe('دهن عود|عود هندي|عود كمبودي|agarwood|oudh'), 'عود زيت oud'],
  [synRe('مسك طهاره|مسك ابيض|white musk'), 'مسك musk'],
  [synRe('عنبر خام|امبر|ambergris'), 'عنبر amber'],
  [synRe('زهري|فل|ورد طائفي|floral'), 'ورد ياسمين rose floral'],
  [synRe('برفان|بارفان|زجاجه عطر'), 'عطر edp perfume'],
];

const GENERIC_BROWSE_TOKENS = new Set([
  'منتج', 'منتجات', 'كتالوج', 'متجر', 'متاح', 'متوفر', 'سعر', 'اسعار', 'بكام', 'عندكم', 'اعرض', 'وريني', 'اشتري', 'عايز', 'عاوز',
  'product', 'products', 'catalog', 'store', 'price', 'prices', 'available', 'stock', 'buy', 'show',
]);

/** يوسّع استعلام البحث المعرفي بمرادفات مجال العطور والشحن دون تلويث الأسئلة غير المرتبطة. */
export function expandKnowledgeQuery(query: string): string[] {
  const norm = ` ${normalize(query)} `;
  const expansions: string[] = [];
  for (const [pattern, terms] of KNOWLEDGE_SYNONYMS) {
    if (pattern.test(norm)) expansions.push(terms);
  }
  return expansions.length ? [`${query} ${expansions.join(' ')}`] : [];
}

/** يوسّع استعلام كتالوج المنتجات بمرادفات النوتات والأسماء الدارجة. */
export function expandCatalogQuery(query: string): string[] {
  const norm = ` ${normalize(query)} `;
  const expansions: string[] = [];
  for (const [pattern, terms] of CATALOG_SYNONYMS) {
    if (pattern.test(norm)) expansions.push(terms);
  }
  return expansions.length ? [`${query} ${expansions.join(' ')}`] : [];
}

/** يطبّع رقم الطلب (يدعم الأرقام العربية، المسافات، الشرطات الطويلة، أو غياب الشرطة مثل SH123456). */
export function normalizeOrderRef(raw?: string): string | undefined {
  if (!raw) return undefined;
  const ascii = raw
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .trim()
    .toUpperCase();
  const match = ascii.match(/\bSH[\s–—-]*([A-Z0-9]{6})\b/) || ascii.match(/^([A-Z0-9]{6})$/);
  return match ? `SH-${match[1]}` : ascii;
}

/** يطبّع وسيلة التواصل (الأرقام العربية/الفارسية والمسافات الزائدة). */
export function normalizeContact(raw?: string): string | undefined {
  if (!raw) return undefined;
  return raw
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .trim();
}

/** ينفذ الأداة مع إعادة المحاولة تلقائياً عند حدوث خطأ عابر في الطبقة التخزينية. */
export async function runToolWithRetry<A>(
  tool: Tool<A>,
  args: A,
  ctx: ToolContext,
  retries = 1,
): Promise<ToolResult> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await tool.run(args, ctx);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

export const tools = {
  retrieve_knowledge: {
    name: 'retrieve_knowledge',
    description: 'Search Sham knowledge base, services and catalog (BM25 + domain query expansion).',
    async run(args: { query: string }, { repo }) {
      const index = await repo.searchIndex();
      // Relative + absolute thresholds: weak lexical overlaps are dropped instead of shown as answers.
      let raw = index.search(args.query, 6, 1.2).filter((h) => h.doc.kind !== 'product');
      // Cognitive fallback: if exact lexical terms missed, expand domain perfumery/shipping synonyms cleanly.
      if (!raw.length) {
        for (const expanded of expandKnowledgeQuery(args.query)) {
          raw = index.search(expanded, 6, 1.6).filter((h) => h.doc.kind !== 'product');
          if (raw.length) break;
        }
      }
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
      const hits = ordered.filter((h, i) => {
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
    description: 'Find active products with live price and stock (with scent synonym expansion and budget filter).',
    async run(args: { query: string; limit?: number; maxPrice?: number }, { repo }) {
      const products = await repo.products();
      if (!products.length) return { observation: 'CATALOG_EMPTY', data: { matched: false, products: [] } };
      const limit = args.limit || 6;
      const index = await repo.searchIndex();
      let ids = index.search(args.query, limit, 0.3).filter((h) => h.doc.kind === 'product').map((h) => h.doc.id);
      if (!ids.length) {
        for (const expanded of expandCatalogQuery(args.query)) {
          ids = index.search(expanded, limit, 0.4).filter((h) => h.doc.kind === 'product').map((h) => h.doc.id);
          if (ids.length) break;
        }
      }
      const matchedProducts = ids.map((id) => products.find((p) => p.id === id)!).filter(Boolean);
      const withinBudget = typeof args.maxPrice === 'number' && args.maxPrice > 0
        ? (matchedProducts.length ? matchedProducts : products).filter((p) => p.price <= args.maxPrice!)
        : matchedProducts;
      const specificTokens = tokenize(args.query).filter((t) => !GENERIC_BROWSE_TOKENS.has(t));
      const matched = withinBudget.length > 0 && (ids.length > 0 || typeof args.maxPrice === 'number');
      const found = (matched ? withinBudget : products).slice(0, limit);
      return {
        observation: `${matched ? 'MATCHES' : 'NO_MATCH_SHOWING_LATEST'}\n${found.map((p) => `${p.sku} | ${p.nameAr || p.nameEn} | ${p.price} ${p.currency} | stock ${p.stock}${p.demo ? ' | DEMO' : ''}`).join('\n')}`,
        actions: [{ type: 'products', products: found.map(productCard) }],
        // Cite products directly only when matched or browsing generically; never claim an unmatched specific query matched a product.
        citations: matched || specificTokens.length === 0
          ? found.map((p) => ({ id: p.id, title: p.nameAr || p.nameEn, kind: 'product' as const }))
          : [],
        data: { matched, specificQuery: specificTokens.length > 0, products: found },
      };
    },
  } as Tool<{ query: string; limit?: number; maxPrice?: number }>,

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
    description: 'Look up a request by normalized reference + verified contact.',
    async run(args: { ref?: string; contact?: string }, { repo }) {
      const normRef = normalizeOrderRef(args.ref);
      const normContact = normalizeContact(args.contact);
      if (!normRef || !normContact) {
        return { observation: 'NEED_REF_AND_CONTACT', actions: [{ type: 'order_status', ref: normRef }] };
      }
      // Try normalized ref first, plus common O↔0 / I↔1 lookalike character swap while still enforcing strict contact match.
      const candidates = [
        normRef,
        normRef.replace(/^SH-/, '').replace(/0/g, 'O').replace(/1/g, 'I').replace(/^/, 'SH-'),
      ];
      for (const candidate of [...new Set(candidates)]) {
        const request = await repo.trackRequest(candidate, normContact);
        if (request) {
          return { observation: `FOUND ${request.ref} status=${request.status}`, actions: [{ type: 'order_status', request: publicView(request) }], data: request };
        }
      }
      return { observation: 'NOT_FOUND_OR_CONTACT_MISMATCH', actions: [{ type: 'order_status', ref: normRef }] };
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
