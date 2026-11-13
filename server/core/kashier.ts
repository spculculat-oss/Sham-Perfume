/**
 * Kashier (kashier.io) — the store's card/wallet payment gateway; payouts reach the owner's bank from
 * Kashier's dashboard. Docs: https://developers.kashier.io/docs/accept-payments/payment-sessions
 *
 *   KASHIER_MERCHANT_ID   MID-xxxx-xxx (shown under the user name in the dashboard)
 *   KASHIER_API_KEY       Payment API Key  → `api-key` header, and the HMAC key of webhook signatures
 *   KASHIER_SECRET_KEY    Secret Key       → raw `Authorization` header (not "Bearer")
 *   KASHIER_MODE          test | live      (keys are mode-scoped; default test)
 *   KASHIER_CURRENCIES    currencies the account accepts, e.g. "EGP" or "EGP,USD,EUR,GBP" (default EGP)
 *
 * Key values are never returned, logged or put into an error message.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

type Env = Record<string, string | undefined>;
export const KASHIER_CURRENCIES = ['EGP', 'USD', 'GBP', 'EUR'] as const;

export interface KashierConfig { merchantId: string; apiKey: string; secretKey: string; mode: 'test' | 'live'; currencies: string[] }

export function kashierConfig(env: Env = process.env): KashierConfig | undefined {
  const merchantId = env.KASHIER_MERCHANT_ID?.trim() || '';
  const apiKey = env.KASHIER_API_KEY?.trim() || '';
  const secretKey = env.KASHIER_SECRET_KEY?.trim() || '';
  const selectedMode = env.KASHIER_MODE?.trim().toLowerCase() || 'test';
  if (!/^MID-\d+-\d+$/i.test(merchantId) || !apiKey || !secretKey || apiKey === secretKey || !['test', 'live'].includes(selectedMode)) return undefined;
  const mode = selectedMode as 'test' | 'live';
  const wanted = (env.KASHIER_CURRENCIES || 'EGP').toUpperCase().split(',').map((c) => c.trim());
  if (wanted.some((c) => !(KASHIER_CURRENCIES as readonly string[]).includes(c))) return undefined;
  return { merchantId, apiKey, secretKey, mode, currencies: [...new Set(wanted)] };
}

export const kashierApi = (mode: 'test' | 'live') => (mode === 'live' ? 'https://api.kashier.io' : 'https://test-api.kashier.io');

export class KashierError extends Error {
  constructor(readonly code: string, readonly status: number) { super(`Kashier ${code} (HTTP ${status})`); }
}

export interface SessionRequest {
  order: string; amount: number; currency: string; merchantRedirect: string; serverWebhook?: string;
  display: 'ar' | 'en'; description: string; customer: { email: string; reference: string };
  metaData: Record<string, unknown>; expireMinutes?: number; allowedMethods?: ('card' | 'wallet')[];
}

/** POST /v3/payment/sessions → the hosted checkout page the visitor is sent to. */
export async function createSession(cfg: KashierConfig, input: SessionRequest, request: typeof fetch = fetch): Promise<{ id: string; sessionUrl: string }> {
  const body = {
    expireAt: new Date(Date.now() + (input.expireMinutes || 60) * 60_000).toISOString(),
    maxFailureAttempts: 3, paymentType: 'credit', amount: input.amount.toFixed(2), currency: input.currency,
    order: input.order, merchantRedirect: input.merchantRedirect, display: input.display, type: 'one-time',
    allowedMethods: (input.allowedMethods || ['card', 'wallet']).join(','), merchantId: cfg.merchantId, failureRedirect: false, brandColor: '#b45309',
    defaultMethod: input.allowedMethods?.[0] || 'card', description: input.description.slice(0, 118), customer: input.customer,
    metaData: input.metaData, ...(input.serverWebhook ? { serverWebhook: input.serverWebhook } : {}),
  };
  let response: Response;
  try {
    response = await request(`${kashierApi(cfg.mode)}/v3/payment/sessions`, {
      method: 'POST', headers: { Authorization: cfg.secretKey, 'api-key': cfg.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(15_000),
    });
  } catch { throw new KashierError('UNREACHABLE', 0); }
  const data = await response.json().catch(() => ({})) as { _id?: string; sessionUrl?: string; message?: string; code?: string; error?: { code?: string } };
  if (!response.ok || !data.sessionUrl || !data._id) {
    throw new KashierError(response.status === 401 || response.status === 403 ? 'INVALID_KEYS' : 'REJECTED', response.status);
  }
  if (!safeKashierSessionUrl(data.sessionUrl) || !/^[A-Za-z0-9_-]{6,64}$/.test(data._id)) throw new KashierError('INVALID_RESPONSE', 502);
  return { id: data._id, sessionUrl: data.sessionUrl };
}

export type PaymentState = 'paid' | 'failed' | 'pending';
export interface SessionPayment { state: PaymentState; status: string; order: string; amount: number; currency: string; method?: string; metaData?: Record<string, unknown> }

// APPROVED/AUTHORIZED is not necessarily captured; it must never count as collected money.
const PAID = new Set(['PAID', 'SUCCESS', 'CAPTURED', 'COMPLETED']);
const FAILED = new Set(['FAILED', 'FAILURE', 'EXPIRED', 'ABANDONED', 'CANCELLED', 'CANCELED', 'DECLINED', 'VOIDED', 'REFUNDED']);
export const paymentState = (status: string): PaymentState => (PAID.has(status.toUpperCase()) ? 'paid' : FAILED.has(status.toUpperCase()) ? 'failed' : 'pending');

/** GET /v3/payment/sessions/:id/payment — the only source of truth for "paid" (never the browser). */
export async function sessionPayment(cfg: KashierConfig, sessionId: string, request: typeof fetch = fetch): Promise<SessionPayment> {
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(sessionId)) throw new KashierError('INVALID_SESSION', 400);
  let response: Response;
  try {
    response = await request(`${kashierApi(cfg.mode)}/v3/payment/sessions/${sessionId}/payment`, {
      headers: { Authorization: cfg.secretKey }, signal: AbortSignal.timeout(10_000),
    });
  } catch { throw new KashierError('UNREACHABLE', 0); }
  const body = await response.json().catch(() => ({})) as { data?: { status?: string; merchantOrderId?: string; amount?: string | number; currency?: string; method?: string; metaData?: Record<string, unknown> } };
  if (!response.ok || !body.data) throw new KashierError(response.status === 404 ? 'NOT_FOUND' : 'REJECTED', response.status);
  const d = body.data;
  const status = String(d.status || 'UNKNOWN');
  const amount = Number(d.amount);
  if (!Number.isFinite(amount) || amount <= 0 || !/^[A-Z]{3}$/.test(String(d.currency)) || !/^[A-Za-z0-9_-]{3,100}$/.test(String(d.merchantOrderId))) throw new KashierError('INVALID_RESPONSE', 502);
  return { state: paymentState(status), status, order: String(d.merchantOrderId), amount, currency: String(d.currency), method: d.method, metaData: d.metaData };
}

/**
 * Webhook signature: the `data` keys listed in `data.signatureKeys`, sorted, as `k=urlencoded(v)&…`,
 * HMAC-SHA256 with the Payment API Key, compared with the `x-kashier-signature` header.
 */
export function webhookSignature(data: Record<string, unknown>, apiKey: string): string {
  const keys = (Array.isArray(data.signatureKeys) ? data.signatureKeys : []).filter((k): k is string => typeof k === 'string').sort();
  const payload = keys.map((k) => `${k}=${encodeURIComponent(String(data[k] ?? ''))}`).join('&');
  return createHmac('sha256', apiKey).update(payload).digest('hex');
}

export function verifyWebhook(data: unknown, signature: string | undefined, apiKey: string): data is Record<string, unknown> {
  if (!data || typeof data !== 'object' || Array.isArray(data) || !apiKey || !signature || !/^[a-f0-9]{64}$/i.test(signature.trim())) return false;
  const d = data as Record<string, unknown>;
  const keys = d.signatureKeys;
  if (!Array.isArray(keys) || !keys.length || new Set(keys).size !== keys.length ||
    keys.some((k) => typeof k !== 'string' || !Object.hasOwn(d, k) || !['string', 'number', 'boolean'].includes(typeof d[k])) ||
    ['amount', 'currency', 'merchantOrderId', 'status'].some((k) => !keys.includes(k))) return false;
  const expected = Buffer.from(webhookSignature(data as Record<string, unknown>, apiKey));
  const given = Buffer.from(signature.trim().toLowerCase());
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** The browser may be redirected only to the documented provider-hosted checkout. */
export function safeKashierSessionUrl(value: string): boolean {
  try { const u = new URL(value); return u.protocol === 'https:' && u.hostname === 'payments.kashier.io' && !u.port && !u.username && !u.password && /^\/session\/[A-Za-z0-9_-]{6,64}$/.test(u.pathname); } catch { return false; }
}
