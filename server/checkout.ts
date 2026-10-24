/**
 * «الدفع في متجر شام» — real online payment through Kashier (server/core/kashier.ts).
 *
 *   GET  /api/geo                       the visitor's country (Vercel's x-vercel-ip-country), for prices
 *   GET  /api/store/payments            {enabled, mode, currencies} — no secret, ever
 *   POST /api/store/checkout            cart → amount recomputed HERE from the catalog → Kashier session
 *   GET  /api/store/checkout/:sessionId the payment result, read from Kashier (never from the browser)
 *   POST /api/store/kashier/webhook     Kashier's server-to-server event (HMAC-verified)
 *
 * Every order is saved to the private finance ledger BEFORE opening a payment session.
 * Both callbacks re-read the provider result and match the original amount/currency/session.
 * Test payments never trigger fulfilment or enter real profit reports.
 */
import express from 'express';
import { randomBytes } from 'node:crypto';
import { FinanceService } from './finance/service';
import { BankService } from './finance/bank';
import { MemoryStore } from './core/store';
import { ValidationError } from './core/repository';
import { toMinor } from '../src/finance/money';
import { PAYMENT_HELD, reviewCharge } from '../src/finance/shield';
import productsData from '../src/data/products.json';
import { mergeCatalog, type RawProduct, type StoreCatalogFile, type StoreProduct } from '../src/utils/storeCatalog';
import { customerPayOffer } from '../src/bank/worldPay';
import { BUNDLED_FX, chargeCurrency, currencyFor, isCountry, isFxTable, quote, type FxTable, type ShippingTable } from '../src/utils/pricing';
import { createSession, kashierConfig, KashierError, sessionPayment, verifyWebhook, type KashierConfig } from './core/kashier';
import { containsCardSecret, stripeCardNetwork, verdictFromProvider } from '../src/utils/cardNetwork';
import { createNotifier } from './core/notify';
import { liveStoreCatalog, loadLive } from './core/liveData';
import { RateLimiter, clientKey } from './core/rateLimit';
import { corsOrigins } from './cors';

type Env = Record<string, string | undefined>;
export interface CheckoutRouterOptions {
  finance?: FinanceService;
  /** «بنك شام»: direct collection (InstaPay, bank transfer, wallets, cash on delivery) — no gateway needed. */
  bank?: BankService;
  env?: Env; fetch?: typeof fetch; products?: RawProduct[];
  catalog?: () => Promise<StoreCatalogFile | undefined>; fx?: () => Promise<FxTable>; shipping?: ShippingTable;
  /** «متاجر شام»: registered merchants' published products (`mp_…` skus), priced on the server (merchant price + 50 %). */
  merchantProducts?: (skus: string[]) => Promise<{ sku: string; price: number; inStock: boolean }[]>;
  /** Called once the payment page is open (records the merchants' orders). Failures never block the payment. */
  onCheckout?: (info: {
    ref: string; req: express.Request; input: CheckoutInput; shippingUsd: number; total: number; currency: string;
    /** The site's own products in this order (name, picture and EGP price from the catalog). */
    catalogLines: { sku: string; qty: number; price: number; name: string; image?: string }[];
  }) => Promise<void>;
  /** Called when Kashier confirms a payment (verified server-side). */
  onPaid?: (ref: string) => Promise<void>;
  /**
   * The signed-in customer behind the request (a real, server-verified account session).
   * When given, card/wallet payments through the gateway answer 401 LOGIN_REQUIRED for visitors,
   * demo logins and browser-only local profiles. «بنك شام» direct orders (InstaPay, bank transfer,
   * wallet, cash on delivery) are open to visitors — the merchant confirms receipt after seeing the money.
   */
  customer?: (req: express.Request) => Promise<{ id: string } | undefined>;
}

export const DEFAULT_RETURN_URL = 'https://spculculat-oss.github.io/Sham-Perfume/';
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, max) : '');
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

import { countryFromHeaders } from './core/replyMoney';
export { countryFromHeaders };

export interface CheckoutInput {
  items: { sku: string; qty: number }[]; country: string; lang: 'ar' | 'en'; method?: 'card' | 'wallet';
  contact: { name: string; email: string; phone: string }; address: { city: string; line: string }; returnUrl?: string;
}

/** Validates the visitor's form. Returns an error code or the clean input. */
export function readCheckout(body: unknown): CheckoutInput | { error: string } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  if (!Array.isArray(b.items) || b.items.length > 30) return { error: 'INVALID_ITEM' };
  if (b.method !== undefined && !['card', 'wallet'].includes(String(b.method))) return { error: 'METHOD_UNAVAILABLE' };
  const rawItems = b.items;
  const merged = new Map<string, number>();
  for (const raw of rawItems as { sku?: unknown; qty?: unknown }[]) {
    const qty = Number(raw?.qty);
    if (typeof raw?.sku !== 'string' || !raw.sku || !Number.isInteger(qty) || qty < 1 || qty > 99) return { error: 'INVALID_ITEM' };
    const total = (merged.get(raw.sku) || 0) + qty;
    if (total > 99) return { error: 'INVALID_ITEM' };
    merged.set(raw.sku, total);
  }
  if (!merged.size) return { error: 'EMPTY_ORDER' };
  const country = typeof b.country === 'string' ? b.country.trim().toUpperCase() : '';
  if (!isCountry(country)) return { error: 'INVALID_COUNTRY' };
  const c = (b.contact && typeof b.contact === 'object' ? b.contact : {}) as Record<string, unknown>;
  const a = (b.address && typeof b.address === 'object' ? b.address : {}) as Record<string, unknown>;
  const contact = { name: str(c.name, 120), email: str(c.email, 200).toLowerCase(), phone: str(c.phone, 40) };
  const address = { city: str(a.city, 120), line: str(a.line, 300) };
  if (!contact.name) return { error: 'MISSING_NAME' };
  if (!isEmail(contact.email)) return { error: 'INVALID_EMAIL' };
  if (contact.phone.replace(/\D/g, '').length < 7) return { error: 'INVALID_PHONE' };
  if (!address.city || address.line.length < 5) return { error: 'MISSING_ADDRESS' };
  return { items: [...merged].map(([sku, qty]) => ({ sku, qty })), country, ...(b.method ? { method: b.method as 'card' | 'wallet' } : {}), lang: b.lang === 'ar' ? 'ar' : 'en', contact, address, returnUrl: str(b.returnUrl, 500) || undefined };
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
  // Isolated routers default to a non-persistent sandbox. The application injects Sham Core's store.
  const finance = options.finance || new FinanceService(new MemoryStore(), env, { fetch: request });
  if (options.onPaid) finance.onPaid = options.onPaid;
  const bank = options.bank || new BankService(finance, env, request);
  const wrap = (work: (req: express.Request, res: express.Response) => Promise<unknown>) => (req: express.Request, res: express.Response) => {
    work(req, res).catch((e) => {
      res.status(e instanceof ValidationError ? e.status : 503).json({ code: e instanceof ValidationError ? e.code : 'FINANCE_UNAVAILABLE', error: 'Payment could not be verified or recorded. Please retry.' });
    });
  };
  const verifyLimiter = new RateLimiter(60, 60_000);
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

  /** Server-side prices for the cart (the browser's numbers are never trusted). */
  const priceItems = async (input: CheckoutInput) => {
    const list: StoreProduct[] = mergeCatalog(products, await catalog().catch(() => undefined));
    const bySku = new Map<string, { inStock: boolean; price: number }>(list.map((p) => [p.sku, p]));
    const merchantSkus = input.items.map((i) => i.sku).filter((sku) => sku.startsWith('mp_'));
    if (merchantSkus.length && options.merchantProducts) {
      for (const p of await options.merchantProducts(merchantSkus).catch(() => [])) bySku.set(p.sku, p);
    }
    const missing = input.items.find((i) => !bySku.get(i.sku)?.inStock || !(bySku.get(i.sku)!.price > 0));
    const lines = missing ? [] : input.items.map((i) => ({ sku: i.sku, qty: i.qty, price: bySku.get(i.sku)!.price }));
    return { list, lines, missing, rates: await fx().catch(() => bundledFx) };
  };
  const syncOrder = async (ref: string, req: express.Request, input: CheckoutInput, list: StoreProduct[], lines: { sku: string; qty: number; price: number }[], rates: FxTable, total: number, currency: string) => {
    if (!options.onCheckout) return;
    const catalogBySku = new Map(list.map((p) => [p.sku, p]));
    const catalogLines = input.items.filter((i) => catalogBySku.has(i.sku) && !i.sku.startsWith('mp_')).map((i) => {
      const p = catalogBySku.get(i.sku)!;
      return { sku: i.sku, qty: i.qty, price: p.price, name: input.lang === 'ar' ? p.name.ar || p.name.en : p.name.en || p.name.ar, image: p.imageUrl };
    });
    await options.onCheckout({ ref, req, input, catalogLines, shippingUsd: quote(lines, input.country, { fx: rates, shipping: options.shipping, currency: 'USD' }).shipping, total, currency })
      .catch(async () => { await finance.issue('ORDER_SYNC_FAILED', 'تعذّر إرسال الطلب للمجتمع', 'السجل المالي محفوظ؛ طابق الطلب مع بوابة التجار قبل التسليم.', 'critical', ref); });
  };

  router.get('/geo', (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    const country = countryFromHeaders(req.headers);
    res.json({ country: country || null, source: country ? 'edge' : 'unknown' });
  });

  router.get('/store/card-network', (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    const stripe = stripeCardNetwork(env);
    const check = verdictFromProvider({ connected: Boolean(stripe), mode: stripe?.mode });
    res.json({ connected: check.connected, verdict: check.verdict, reason: check.reason, ...(stripe ? { mode: stripe.mode } : {}) });
  });

  router.post('/store/card-network', (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    const raw = JSON.stringify(req.body ?? {});
    if (containsCardSecret(raw)) { res.status(400).json({ code: 'CARD_NOT_ACCEPTED', verdict: 'unconfirmed' }); return; }
    res.status(400).json({ code: 'HOSTED_FIELD_REQUIRED', verdict: 'unconfirmed' });
  });

  router.get('/store/payments', wrap(async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    const country = req.query.country === undefined ? 'EG' : String(req.query.country);
    if (!isCountry(country)) { res.status(400).json({ code: 'INVALID_COUNTRY' }); return; }
    const cfg = config();
    const direct = await bank.publicMethods(country, currencyFor(country, BUNDLED_FX)).catch(() => []);
    const offer = customerPayOffer(country).methods.map(({ id, nameAr, nameEn }) => ({ id, nameAr, nameEn, chargeable: false }));
    if (!cfg) { res.json({ enabled: false, country, methods: [], direct, offer }); return; }
    const currency = chargeCurrency(currencyFor(country, BUNDLED_FX), cfg.currencies);
    const methods = await finance.methods(country, currency);
    res.json({ enabled: methods.length > 0, mode: cfg.mode, currencies: cfg.currencies, currency, country, methods, direct, offer });
  }));

  /** Payment needs a signed-in account (owner's rule): visitors and local-only profiles are refused here, not just in the page. */
  const signedIn = async (req: express.Request, res: express.Response) => {
    if (!options.customer) return true;
    const who = await options.customer(req).catch(() => undefined);
    if (who?.id) return true;
    res.status(401).json({ error: 'Please sign in to your account before paying', code: 'LOGIN_REQUIRED' });
    return false;
  };

  router.post('/store/checkout', wrap(async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    const cfg = config();
    if (!cfg) { res.status(503).json({ error: 'Online payment is not configured yet', code: 'PAYMENTS_NOT_CONFIGURED' }); return; }
    if (!(await signedIn(req, res))) return;
    if (!limiter.allow(clientKey(req))) { res.status(429).json({ error: 'Too many requests, please wait a minute', code: 'RATE_LIMITED' }); return; }
    const input = readCheckout(req.body);
    if ('error' in input) { res.status(400).json({ error: 'Invalid order', code: input.error }); return; }

    const { list, lines, missing, rates } = await priceItems(input);
    if (missing) { res.status(409).json({ error: 'A product is no longer available', code: 'UNAVAILABLE', sku: missing.sku }); return; }
    const display = quote(lines, input.country, { fx: rates, shipping: options.shipping });
    const charge = quote(lines, input.country, { fx: rates, shipping: options.shipping, currency: chargeCurrency(currencyFor(input.country, rates), cfg.currencies) });

    // «حارس المدفوعات والعمولات»: the cart is reviewed on the server, right before any money moves.
    const verdict = reviewCharge({
      country: input.country, displayCurrency: display.currency, chargeCurrency: charge.currency,
      accepted: cfg.currencies, lines: charge.lines, items: charge.items, shipping: charge.shipping, total: charge.total,
      officialCurrency: currencyFor(input.country, rates),
    });
    if (!verdict.ok) {
      console.warn('[finance_shield] payment held:', verdict.findings.filter((f) => f.level === 'stop').map((f) => f.code).join(','));
      res.status(409).json({ error: PAYMENT_HELD.en, code: PAYMENT_HELD.code, message: PAYMENT_HELD.ar });
      return;
    }

    const methods = await finance.methods(input.country, charge.currency);
    if (!methods.length || (input.method && !methods.some((m) => m.id === input.method))) {
      res.status(409).json({ error: 'No approved payment method for this country and currency', code: 'METHOD_UNAVAILABLE' }); return;
    }
    const ref = newOrderRef();
    // Never construct an authenticated provider callback from a visitor-controlled Host header.
    const webhookBase = env.SHAM_PUBLIC_API_URL?.trim().replace(/\/$/, '') || '';
    await finance.recordOrder({ ref, provider: 'kashier', mode: cfg.mode, country: input.country, currency: charge.currency,
      totalMinor: toMinor(charge.total, charge.currency), shippingChargedMinor: toMinor(charge.shipping, charge.currency),
      lines: charge.lines.map((l) => ({ sku: l.sku, qty: l.qty, unitMinor: toMinor(l.unit, charge.currency) })) });
    const started = Date.now();
    const itemsText = input.items.map((i) => `${i.sku}×${i.qty}`).join(', ');
    try {
      const session = await createSession(cfg, {
        order: ref, amount: charge.total, currency: charge.currency, display: input.lang,
        allowedMethods: (input.method ? [input.method] : methods.map((m) => m.id)) as ('card' | 'wallet')[],
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
      await finance.recordSession(ref, cfg.mode, session.id);
      await finance.observation(cfg.mode, 'create', true, Date.now() - started);
      if (cfg.mode === 'live') await syncOrder(ref, req, input, list, lines, rates, charge.total, charge.currency);
      res.json({ ref, sessionId: session.id, sessionUrl: session.sessionUrl, mode: cfg.mode, charge: { total: charge.total, currency: charge.currency, shipping: charge.shipping }, display: { total: display.total, currency: display.currency } });
    } catch (error) {
      await finance.observation(cfg.mode, 'create', false, Date.now() - started, error instanceof KashierError ? error.code : 'FAILED');
      const code = error instanceof KashierError ? error.code : 'FINANCE_UNAVAILABLE';
      res.status(502).json({ error: 'The payment page could not be opened, please try again', code });
    }
  }));

  /* ───── «بنك شام»: pay the store directly (InstaPay, bank transfer, wallet, cash on delivery) ───── */
  const directLimiter = new RateLimiter(Number(env.SHAM_CHECKOUT_RATE_PER_MIN) || 6, 60_000);
  const orderToken = (req: express.Request) => String(req.headers['x-order-token'] || '');
  router.post('/store/checkout/direct', wrap(async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    if (!directLimiter.allow(clientKey(req))) { res.status(429).json({ error: 'Too many requests, please wait a minute', code: 'RATE_LIMITED' }); return; }
    // «بنك شام» للدفع المباشر متاح للزائر أيضاً: التاجر يؤكد الدفع بعد ما يشوف الفلوس، ولا يطلب حساباً مسجلاً.
    const { method: _ignored, ...body } = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const input = readCheckout(body);
    if ('error' in input) { res.status(400).json({ error: 'Invalid order', code: input.error }); return; }
    const accountId = typeof req.body?.account === 'string' ? req.body.account : '';
    const method = (await bank.publicMethods(input.country, currencyFor(input.country, BUNDLED_FX))).find((m) => m.id === accountId);
    if (!method) { res.status(409).json({ error: 'This payment method is not available', code: 'METHOD_UNAVAILABLE' }); return; }
    const { list, lines, missing, rates } = await priceItems(input);
    if (missing) { res.status(409).json({ error: 'A product is no longer available', code: 'UNAVAILABLE', sku: missing.sku }); return; }
    const charge = quote(lines, input.country, { fx: rates, shipping: options.shipping, currency: method.currency });
    // «حارس المدفوعات»: the same instant review before a direct receipt (InstaPay, transfer, wallet, cash).
    const verdict = reviewCharge({
      country: input.country, displayCurrency: currencyFor(input.country, rates), chargeCurrency: charge.currency,
      accepted: [method.currency], lines: charge.lines, items: charge.items, shipping: charge.shipping, total: charge.total,
      officialCurrency: currencyFor(input.country, rates),
    });
    if (!verdict.ok) {
      console.warn('[finance_shield] direct payment held:', verdict.findings.filter((f) => f.level === 'stop').map((f) => f.code).join(','));
      res.status(409).json({ error: PAYMENT_HELD.en, code: PAYMENT_HELD.code, message: PAYMENT_HELD.ar });
      return;
    }
    const ref = newOrderRef();
    const receipt = await bank.createDirect({ ref, accountId: method.id, country: input.country, currency: charge.currency,
      totalMinor: toMinor(charge.total, charge.currency), shippingChargedMinor: toMinor(charge.shipping, charge.currency),
      lines: charge.lines.map((l) => ({ sku: l.sku, qty: l.qty, unitMinor: toMinor(l.unit, charge.currency) })), contact: input.contact });
    await syncOrder(ref, req, input, list, lines, rates, charge.total, charge.currency);
    await notifier.send('order.paid', `🧾 طلب جديد بالدفع المباشر ${ref} (${method.kind}): ${receipt.amount} ${receipt.currency} — ينتظر الدفع`, { order: ref, kind: method.kind, state: 'awaiting_payment' }).catch(() => false);
    res.status(201).json(receipt);
  }));
  router.get('/store/checkout/direct/:ref', wrap(async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    if (!verifyLimiter.allow(clientKey(req))) { res.status(429).json({ code: 'RATE_LIMITED' }); return; }
    res.json(await bank.publicView(String(req.params.ref), orderToken(req)));
  }));
  router.post('/store/checkout/direct/:ref/claim', wrap(async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    if (!directLimiter.allow(clientKey(req))) { res.status(429).json({ code: 'RATE_LIMITED' }); return; }
    res.json(await bank.claim(String(req.params.ref), orderToken(req), req.body));
  }));

  const confirm = async (payment: Awaited<ReturnType<typeof sessionPayment>>, cfg: KashierConfig, sessionId: string) => {
    const first = await finance.confirmPayment(payment, cfg.mode, sessionId);
    if (payment.state === 'paid' && cfg.mode === 'live') {
      if (first) await announce(payment.order, `🛒 طلب مدفوع ${payment.order}: ${payment.amount} ${payment.currency}`, { order: payment.order, amount: payment.amount, currency: payment.currency });
    }
  };

  router.get('/store/checkout/:sessionId', wrap(async (req, res) => {
    const cfg = config();
    if (!cfg) { res.status(503).json({ code: 'PAYMENTS_NOT_CONFIGURED' }); return; }
    if (!verifyLimiter.allow(clientKey(req))) { res.status(429).json({ code: 'RATE_LIMITED' }); return; }
    res.setHeader('Cache-Control', 'no-store');
    const started = Date.now();
    try {
      const payment = await sessionPayment(cfg, String(req.params.sessionId), request);
      await confirm(payment, cfg, String(req.params.sessionId));
      await finance.observation(cfg.mode, 'verify', true, Date.now() - started);
      res.json({ ref: payment.order, state: payment.state, status: payment.status, amount: payment.amount, currency: payment.currency, mode: cfg.mode });
    } catch (error) {
      await finance.observation(cfg.mode, 'verify', false, Date.now() - started, error instanceof KashierError || error instanceof ValidationError ? error.code : 'FAILED');
      if (error instanceof ValidationError) { res.status(error.status).json({ code: error.code, error: 'Payment not matched to the order' }); return; }
      const e = error instanceof KashierError ? error : new KashierError('FAILED', 502);
      res.status(e.status === 404 || e.status === 400 ? e.status : 502).json({ error: 'Could not read the payment', code: e.code });
    }
  }));

  router.post('/store/kashier/webhook', wrap(async (req, res) => {
    const cfg = config();
    const data = (req.body as { data?: unknown } | undefined)?.data;
    const signature = String(req.headers['x-kashier-signature'] || '');
    if (!cfg || !verifyWebhook(data, signature, cfg.apiKey)) { res.status(401).end(); return; }
    const d = data as Record<string, unknown>;
    const ref = String(d.merchantOrderId || '');
    const session = await finance.sessionFor(ref, cfg.mode);
    // Signed webhook is a hint, not proof of capture: event name is not among signatureKeys.
    // Re-read our stored session, then match BOTH the signed amount and the provider's result.
    await finance.validatePayment({ order: ref, amount: Number(d.amount), currency: String(d.currency), state: 'pending', status: String(d.status) }, cfg.mode);
    if (!session) { res.status(503).end(); return; } // creation race: provider retries, do not drop it
    const started = Date.now();
    try {
      const payment = await sessionPayment(cfg, session.sessionId, request);
      await confirm(payment, cfg, session.sessionId);
      await finance.observation(cfg.mode, 'verify', true, Date.now() - started);
    } catch (error) {
      await finance.observation(cfg.mode, 'verify', false, Date.now() - started, error instanceof ValidationError ? error.code : 'FAILED');
      throw error; // non-2xx: retry rather than silently losing a financial event
    }
    res.status(200).end();
  }));

  return router;
}
