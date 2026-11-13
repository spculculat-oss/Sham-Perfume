/** A checkout intent, NOT a payment and NOT an addition to the normal basket. */
export interface DirectPurchase { sku: string; qty: number; at: number }
export const DIRECT_PURCHASE_EVENT = 'sham-direct-purchase';
const KEY = 'sham-direct-purchase';
let queued: DirectPurchase | undefined;
export function readDirectPurchase(value: unknown, now = Date.now()): DirectPurchase | undefined {
  const v = value as Partial<DirectPurchase> | null;
  if (!v || typeof v.sku !== 'string' || !v.sku.trim() || v.sku.length > 100 || /[\u0000-\u001f]/.test(v.sku) ||
    !Number.isInteger(v.qty) || v.qty! < 1 || v.qty! > 99 || typeof v.at !== 'number' || !Number.isFinite(v.at) || v.at > now || now - v.at > 15 * 60_000) return;
  return { sku: v.sku, qty: v.qty!, at: v.at };
}
export function requestDirectPurchase(sku: string, qty = 1): boolean {
  const intent = readDirectPurchase({ sku, qty, at: Date.now() });
  if (!intent || typeof window === 'undefined') return false;
  queued = intent;
  try { sessionStorage.setItem(KEY, JSON.stringify(intent)); } catch { /* in-memory handoff still works */ }
  window.location.hash = '#store';
  window.dispatchEvent(new CustomEvent(DIRECT_PURCHASE_EVENT));
  return true;
}
export function takeDirectPurchase(): DirectPurchase | undefined {
  let value: unknown = queued;
  queued = undefined;
  try { if (!value) value = JSON.parse(sessionStorage.getItem(KEY) || 'null'); sessionStorage.removeItem(KEY); } catch { /* no storage */ }
  return readDirectPurchase(value);
}
