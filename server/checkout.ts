/**
 * «الدفع في متجر شام» — real online payment through Kashier (server/core/kashier.ts).
 *
 *   GET  /api/geo                       the visitor's country (Vercel's x-vercel-ip-country), for prices
 *   GET  /api/store/payments            {enabled, mode, currencies} — no secret, ever
 *   POST /api/store/checkout            cart → amount recomputed HERE from the catalog → Kashier session
 *   GET  /api/store/checkout/:sessionId the payment result, read from Kashier (never from the browser)
 *   POST /api/store/kashier/webhook     Kashier's server-to-server event (HMAC-verified)
 *
 * Stateless on purpose (Vercel functions keep no disk): the whole order — items, contact, address,
 * country — travels in the Kashier session's metaData, so every order is in the Kashier dashboard, and
 * the owner is also notified through SHAM_WEBHOOK_URL (server/core/notify.ts) once it is paid.
 */
import express from 'express';
import { randomBytes } from 'node:crypto';
import productsData from '../src/data/products.json';
import { mergeCatalog, type RawProduct, type StoreCatalogFile, type StoreProduct } from '../src/utils/storeCatalog';
import { BUNDLED_FX, chargeCurrency, currencyFor, isCountry, isFxTable, quote, type FxTable, type ShippingTable } from '../src/utils/pricing';
import { createSession, kashierConfig, KashierError, sessionPayment, verifyWebhook, paymentState, type KashierConfig } from './core/kashier';
import { createNotifier } from './core/notify';
import { liveStoreCatalog, loadLive } from './core/liveData';
import { RateLimiter, clientKey } from './core/rateLimit';
import { corsOrigins } from './cors';

type Env = Record<string, string | undefined>;
export interface CheckoutRouterOptions {
  env?: Env; fetch?: typeof fetch; products?: RawProduct[];
  catalog?: () => Promise<StoreCatalogFile | undefined>; fx?: () => Promise<FxTable>; shipping?: ShippingTable;
}

export const DEFAULT_RETURN_URL = 'https://spculculat-oss.github.io/Sham-Perfume/';
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, max) : '');
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

/** The visitor's country from the edge (Vercel / Cloudflare headers), or undefined. */
export function countryFromHeaders(headers: Record<string, string | string[] | undefined>): string | undefined {
  for (const name of ['x-vercel-ip-country', 'cf-ipcountry', 'x-country-code']) {
    const value = String(headers[name] || '').toUpperCase();
    if (isCountry(value)) return value;
  }
  return undefined;
}

export interface CheckoutInput {
  items: { sku: string; qty: number }[]; country: string; lang: 'ar' | 'en';
  contact: { name: string; email: string; phone: string }; address: { city: string; line: string }; returnUrl?: string;
}

/** Validates the visitor's form. Returns an error code or the clean input. */
export function readCheckout(body: unknown): CheckoutInput | { error: string } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const rawItems = Array.isArray(b.items) ? b.items.slice(0, 30) : [];
  const merged = new Map<string, number>();
  for (const raw of rawItems as { sku?: unknown; qty?: unknown }[]) {
    const qty = Number(raw?.qty);
    if (typeof raw?.sku !== 'string' || !raw.sku || !Number.isInteger(qty) || qty < 1 || qty > 99) return { error: 'INVALID_ITEM' };
    merged.set(raw.sku, Math.min(99, (merged.get(raw.sku) || 0) + qty));
  }
  if (!merged.size) return { error: 'EMPTY_ORDER' };
  const country = str(b.country, 2).toUpperCase();
  if (!isCountry(country)) return { error: 'INVALID_COUNTRY' };
  const c = (b.contact && typeof b.contact === 'object' ? b.contact : {}) as Record<string, unknown>;
  const a = (b.address && typeof b.address === 'object' ? b.address : {}) as Record<string, unknown>;
  const contact = { name: str(c.name, 120), email: str(c.email, 200).toLowerCase(), phone: str(c.phone, 40) };
  const address = { city: str(a.city, 120), line: str(a.line, 300) };
  if (!contact.name) return { error: 'MISSING_NAME' };
  if (!isEmail(contact.email)) return { error: 'INVALID_EMAIL' };
  if (contact.phone.replace(/\D/g, '').length < 7) return { error: 'INVALID_PHONE' };
  if (!address.city || address.line.length < 5) return { error: 'MISSING_ADDRESS' };
  return { items: [...merged].map(([sku, qty]) => ({ sku, qty })), country, lang: b.lang === 'ar' ? 'ar' : 'en', contact, address, returnUrl: str(b.returnUrl, 500) || undefined };
}

/** Where Kashier sends the visitor back: their page, only if it is one of the site's own origins. */
export function safeReturnUrl(wanted: string | undefined, allowed: Set<string>): string {
  try {
    const url = new URL(wanted || '');
    if (allowed.has(url.origin)) { url.hash = ''; url.search = ''; return url.toString(); }
  } catch { /* fall through */ }
  return DEFAULT_RETURN_URL;
}

export const newOrderRef = () => `SP-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;

export function createCheckoutRouter(options: CheckoutRouterOptions = {}) {
  const env = options.env || process.env;
  const request = options.fetch || fetch;
  const router = express.Router();
  const products = options.products || (productsData as { products?: RawProduct[] }).products || [];
  const catalog = options.catalog || (() => liveStoreCatalog(env, request));
  const bundledFx = { ...BUNDLED_FX, updatedAt: BUNDLED_FX.updatedAt || '1970-01-01T00:00:00Z' };
  const fx = options.fx || (() => loadLive('fx-rates.json', bundledFx, isFxTable, env, request));
  const notifier = createNotifier(env, request);
  const limiter = new RateLimiter(Number(env.SHAM_CHECKOUT_RATE_PER_MIN) || 6, 60_000);
  const allowed = new Set([...corsOrigins(env.SHAM_CORS_ORIGINS), 'https://spculculat-oss.github.io']);
  const announced = new Set<string>(); // one "paid" notification per order per instance

  const config = (): KashierConfig | undefined => kashierConfig(env);
  const announce = async (order: string, text: string, data: Record<string, unknown>) => {
    if (announced.has(order)) return;
    announced.add(order);
    await notifier.send('order.paid', text, data);
  };

  router.get('/geo', (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    const country = countryFromHeaders(req.headers);
    res.json({ country: country || null, source: country ? 'edge' : 'unknown' });
  });

  router.get('/store/payments', (_req, res) => {
    const cfg = config();
    res.json(cfg ? { enabled: true, provider: 'kashier', mode: cfg.mode, currencies: cfg.currencies } : { enabled: false });
  });

  router.post('/store/checkout', async (req, res) => {
    const cfg = config();
    if (!cfg) { res.status(503).json({ error: 'Online payment is not configured yet', code: 'PAYMENTS_NOT_CONFIGURED' }); return; }
    if (!limiter.allow(clientKey(req))) { res.status(429).json({ error: 'Too many requests, please wait a minute', code: 'RATE_LIMITED' }); return; }
    const input = readCheckout(req.body);
    if ('error' in input) { res.status(400).json({ error: 'Invalid order', code: input.error }); return; }

    const list: StoreProduct[] = mergeCatalog(products, await catalog().catch(() => undefined));
    const bySku = new Map(list.map((p) => [p.sku, p]));
    const missing = input.items.find((i) => !bySku.get(i.sku)?.inStock || !(bySku.get(i.sku)!.price > 0));
    if (missing) { res.status(409).json({ error: 'A product is no longer available', code: 'UNAVAILABLE', sku: missing.sku }); return; }

    const rates = await fx().catch(() => bundledFx);
    const lines = input.items.map((i) => ({ sku: i.sku, qty: i.qty, price: bySku.get(i.sku)!.price }));
    const display = quote(lines, input.country, { fx: rates, shipping: options.shipping });
    const charge = quote(lines, input.country, { fx: rates, shipping: options.shipping, currency: chargeCurrency(currencyFor(input.country, rates), cfg.currencies) });

    const ref = newOrderRef();
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
    const webhookBase = env.SHAM_PUBLIC_API_URL?.trim() || (host ? `https://${host}` : '');
    const itemsText = input.items.map((i) => `${i.sku}×${i.qty}`).join(', ');
    try {
      const session = await createSession(cfg, {
        order: ref, amount: charge.total, currency: charge.currency, display: input.lang,
        merchantRedirect: `${safeReturnUrl(input.returnUrl, allowed)}?checkout=${encodeURIComponent(ref)}`,
        serverWebhook: webhookBase ? `${webhookBase.replace(/\/$/, '')}/api/store/kashier/webhook` : undefined,
        description: `Sham Store ${ref} — ${input.items.reduce((s, i) => s + i.qty, 0)} item(s)`,
        customer: { email: input.contact.email, reference: ref },
        metaData: {
          ref, items: itemsText.slice(0, 900), country: input.country, shippingZone: display.zone.id,
          name: input.contact.name, phone: input.contact.phone, email: input.contact.email,
          city: input.address.city, address: input.address.line,
          shownTotal: `${display.total} ${display.currency}`, shipping: `${charge.shipping} ${charge.currency}`,
          displayNotes: { Order: ref, Items: itemsText.slice(0, 200) },
        },
      }, request);
      res.json({ ref, sessionId: session.id, sessionUrl: session.sessionUrl, mode: cfg.mode, charge: { total: charge.total, currency: charge.currency, shipping: charge.shipping }, display: { total: display.total, currency: display.currency } });
    } catch (error) {
      const code = error instanceof KashierError ? error.code : 'FAILED';
      res.status(502).json({ error: 'The payment page could not be opened, please try again', code });
    }
  });

  router.get('/store/checkout/:sessionId', async (req, res) => {
    const cfg = config();
    if (!cfg) { res.status(503).json({ error: 'Online payment is not configured yet', code: 'PAYMENTS_NOT_CONFIGURED' }); return; }
    res.setHeader('Cache-Control', 'no-store');
    try {
      const payment = await sessionPayment(cfg, String(req.params.sessionId), request);
      if (payment.state === 'paid') {
        const m = payment.metaData || {};
        await announce(payment.order, `🛒 طلب مدفوع ${payment.order}: ${payment.amount} ${payment.currency} — ${String(m.items || '')} — ${String(m.name || '')} ${String(m.phone || '')} (${String(m.country || '')})`, { order: payment.order, amount: payment.amount, currency: payment.currency, method: payment.method, ...m });
      }
      res.json({ ref: payment.order, state: payment.state, status: payment.status, amount: payment.amount, currency: payment.currency });
    } catch (error) {
      const e = error instanceof KashierError ? error : new KashierError('FAILED', 502);
      res.status(e.status === 404 || e.status === 400 ? e.status : 502).json({ error: 'Could not read the payment', code: e.code });
    }
  });

  router.post('/store/kashier/webhook', async (req, res) => {
    const cfg = config();
    const data = (req.body as { data?: unknown } | undefined)?.data;
    const signature = String(req.headers['x-kashier-signature'] || '');
    if (!cfg || !verifyWebhook(data, signature, cfg.apiKey)) { res.status(401).end(); return; }
    const d = data as Record<string, unknown>;
    // Notify before answering: a serverless function may be frozen right after it responds (4 s cap).
    if (paymentState(String(d.status || '')) === 'paid' && (req.body as { event?: string }).event === 'pay') {
      const order = String(d.merchantOrderId || '');
      await announce(order, `🛒 طلب مدفوع ${order}: ${String(d.amount)} ${String(d.currency)} (Kashier)`, { order, amount: d.amount, currency: d.currency, method: d.method, transactionId: d.transactionId });
    }
    res.status(200).end(); // Kashier only reads the status code.
  });

  return router;
}
