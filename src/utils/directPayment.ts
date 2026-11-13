/**
 * The buyer's side of «بنك شام»: pay the store directly (InstaPay, bank transfer, mobile wallet, cash on
 * delivery). The server prices the order and reserves it; the browser keeps only the order number and its
 * one-time token so the buyer can report the transfer and follow the status. No card or wallet data, ever.
 */
import { apiUrl, isStaticHosting } from './api';
import { getSessionToken } from '../community/api';
import type { CheckoutForm } from './storeCheckout';
import type { SupportedLanguage } from '../types/i18n';

export type DirectKind = 'instapay' | 'bank_transfer' | 'wallet' | 'cod';
export interface DirectMethod { id: string; kind: DirectKind; label: string; currency: string }
export type DirectState = 'awaiting_payment' | 'claimed' | 'paid' | 'rejected' | 'expired';
export interface DirectOrder {
  ref: string; token: string; kind: DirectKind; label: string; instructions: string;
  amount: string; currency: string; expiresAt: string; state: DirectState; at: number;
}
export class DirectPaymentError extends Error { constructor(readonly code: string) { super(code); } }

const KEY = 'sham-direct-orders';
const MAX_KEEP = 10;
const valid = (o: unknown): o is DirectOrder => {
  const d = o as DirectOrder;
  return Boolean(d && typeof d.ref === 'string' && /^SP-[A-Z0-9-]{4,40}$/.test(d.ref) && typeof d.token === 'string' && d.token.length >= 20 && typeof d.amount === 'string');
};
export function savedDirectOrders(): DirectOrder[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list.filter(valid).slice(0, MAX_KEEP) : [];
  } catch { return []; }
}
export function rememberDirectOrder(order: DirectOrder) {
  try {
    const list = [order, ...savedDirectOrders().filter((o) => o.ref !== order.ref)].slice(0, MAX_KEEP);
    localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('sham-direct-orders'));
  } catch { /* private mode: the buyer still sees the details on screen */ }
}
export function forgetDirectOrder(ref: string) {
  try { localStorage.setItem(KEY, JSON.stringify(savedDirectOrders().filter((o) => o.ref !== ref))); window.dispatchEvent(new CustomEvent('sham-direct-orders')); } catch { /* ignore */ }
}

async function call<T>(path: `/api/${string}`, init: RequestInit = {}): Promise<T> {
  if (isStaticHosting) throw new DirectPaymentError('OFFLINE');
  let response: Response;
  try { response = await fetch(apiUrl(path), { ...init, signal: AbortSignal.timeout(20_000) }); } catch { throw new DirectPaymentError('NETWORK'); }
  const data = await response.json().catch(() => ({})) as T & { code?: string };
  if (!response.ok) throw new DirectPaymentError(data.code || 'FAILED');
  return data;
}

/** Reserves the order at the server's price and returns the payment instructions. */
export async function reserveDirectOrder(items: { sku: string; qty: number }[], country: string, form: CheckoutForm, lang: SupportedLanguage, account: string): Promise<DirectOrder> {
  const token = getSessionToken();
  const r = await call<Omit<DirectOrder, 'state' | 'at'>>('/api/store/checkout/direct', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ items, country, account, lang: lang === 'ar' ? 'ar' : 'en', contact: { name: form.name, email: form.email, phone: form.phone }, address: { city: form.city, line: form.line } }),
  });
  const order: DirectOrder = { ...r, state: 'awaiting_payment', at: Date.now() };
  if (!valid(order)) throw new DirectPaymentError('FAILED');
  rememberDirectOrder(order);
  return order;
}
export async function refreshDirectOrder(order: DirectOrder): Promise<DirectOrder> {
  const view = await call<{ state: DirectState; instructions: string; label: string; expiresAt: string }>(`/api/store/checkout/direct/${encodeURIComponent(order.ref)}`, { headers: { 'X-Order-Token': order.token } });
  const next = { ...order, state: view.state, instructions: view.instructions || order.instructions, label: view.label || order.label, expiresAt: view.expiresAt || order.expiresAt };
  rememberDirectOrder(next);
  return next;
}
export async function claimDirectOrder(order: DirectOrder, claim: { payerName: string; transferRef: string; amount: string; paidAt: string }): Promise<DirectOrder> {
  const r = await call<{ state: DirectState }>(`/api/store/checkout/direct/${encodeURIComponent(order.ref)}/claim`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Order-Token': order.token }, body: JSON.stringify(claim),
  });
  const next = { ...order, state: r.state };
  rememberDirectOrder(next);
  return next;
}
