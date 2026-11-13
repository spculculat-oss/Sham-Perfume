import { trackInsight } from './insightsTracker';
import { useEffect, useState } from 'react';
import type { StoreProduct } from './storeCatalog';
import { makeStoreT, storeLocalized } from '../لغات/storeL10n';
import type { SupportedLanguage } from '../types/i18n';

/** The visitor's basket in «متجر شام», shared by the store and the product page and kept across visits. */
const KEY = 'sham-store-cart';
const EVENT = 'sham-store-cart-change';
export type Cart = Record<string, number>; // sku → quantity

export function readCart(): Cart {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}') as unknown;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    return Object.fromEntries(Object.entries(raw as Record<string, unknown>)
      .map(([sku, q]) => [sku, Math.min(99, Math.floor(Number(q)))] as const)
      .filter(([, q]) => Number.isFinite(q) && q > 0));
  } catch { return {}; }
}

const AT_KEY = 'sham-store-cart-at';
/** When the basket last changed (ms), on this device — for «سلتك لسه مستنياك» when he comes back. */
export function cartTouchedAt(): number {
  try { return Number(localStorage.getItem(AT_KEY)) || 0; } catch { return 0; }
}

function write(cart: Cart) {
  try { localStorage.setItem(KEY, JSON.stringify(cart)); localStorage.setItem(AT_KEY, String(Date.now())); } catch { /* private mode: in-memory only */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: cart }));
}

export function addToCart(sku: string, qty = 1) {
  trackInsight('cart', { sku, qty }); // «خزنة فهم الزوار» (only with the visitor's consent)
  const cart = readCart();
  cart[sku] = Math.min(99, (cart[sku] || 0) + qty);
  write(cart);
}
export function setCartQty(sku: string, qty: number) {
  const cart = readCart();
  if (qty > 0) cart[sku] = Math.min(99, Math.floor(qty)); else delete cart[sku];
  write(cart);
}
export const clearCart = () => write({});
/** Remove only the paid cart snapshot. Direct purchases never touch the visitor's existing basket. */
export function removePurchasedItems(items: { sku: string; qty: number }[]) {
  const cart = readCart();
  for (const item of items) {
    if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99) continue;
    if (cart[item.sku]) {
      const remaining = cart[item.sku] - item.qty;
      if (remaining > 0) cart[item.sku] = remaining; else delete cart[item.sku];
    }
  }
  write(cart);
}

export function useCart(): Cart {
  const [cart, setCart] = useState<Cart>(() => (typeof window === 'undefined' ? {} : readCart()));
  useEffect(() => {
    const sync = () => setCart(readCart());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);
  return cart;
}

/** Lines and total from the catalog prices (never a price stored in the browser). */
export function cartSummary(cart: Cart, products: StoreProduct[]) {
  const bySku = new Map(products.map((p) => [p.sku, p]));
  const lines = Object.entries(cart).flatMap(([sku, qty]) => {
    const product = bySku.get(sku);
    return product ? [{ product, qty, subtotal: product.price * qty }] : [];
  });
  return { lines, count: lines.reduce((s, l) => s + l.qty, 0), total: lines.reduce((s, l) => s + l.subtotal, 0) };
}

/**
 * The prices exactly as the visitor saw them in the cart — their currency, already formatted (#169). Without it
 * the message falls back to the catalog's EGP amounts, which is what the hand-off used to send whatever the
 * visitor's country was.
 */
export interface PricedOrder {
  line: (sku: string) => string | undefined;
  shipping?: string;
  total: string;
}

/** The message the Sham assistant (or the store's inbox) receives for this order — in the visitor's language. */
export function orderMessage(summary: ReturnType<typeof cartSummary>, lang: SupportedLanguage, priced?: PricedOrder): string {
  const t = makeStoreT(lang);
  const currency = t('sf_currency');
  const items = summary.lines.map((l) => {
    const shown = priced?.line(l.product.sku);
    return t('cart_order_line', {
      name: storeLocalized(l.product.name, lang), sku: l.product.sku, qty: l.qty,
      subtotal: shown ?? l.subtotal, currency: shown ? '' : currency,
    }).trimEnd();
  });
  // Plain digits for the EGP fallback: the hand-off message is read by a person or the assistant, not a formatter.
  const totals = priced
    ? [...(priced.shipping ? [`${t('sf_shipping')}: ${priced.shipping}`] : []), `${t('sf_total')}: ${priced.total}`]
    : [`${t('sf_total')}: ${summary.total} ${currency}`];
  return [t('cart_order_intro'), ...items, ...totals].join('\n');
}

export interface OrderContact { name: string; email: string; phone: string; city: string; line: string }

/** A short reference the visitor and the store both quote, e.g. «SH-MGX4K2-7QF». */
export function orderRef(now = Date.now(), random = Math.random): string {
  return `SH-${now.toString(36).toUpperCase()}-${Math.floor(random() * 36 ** 3).toString(36).toUpperCase().padStart(3, '0')}`;
}

/**
 * The e-mail a visitor sends when no online payment is active for their country (#169): the order (in the
 * prices they saw), where to deliver, and a reference. It goes to the store's inbox, never to the chat.
 */
export function orderRequestEmail(
  summary: ReturnType<typeof cartSummary>, lang: SupportedLanguage, priced: PricedOrder,
  contact: OrderContact, country: string, ref: string,
): { subject: string; body: string } {
  const t = makeStoreT(lang);
  const clean = (v: string) => v.replace(/\s+/g, ' ').trim().slice(0, 200);
  const body = [
    `${t('sf_order_ref')}: ${ref}`,
    '',
    orderMessage(summary, lang, priced),
    '',
    `${t('sf_delivery_details')}:`,
    `${t('sf_full_name')}: ${clean(contact.name)}`,
    `${t('sf_phone')}: ${clean(contact.phone)}`,
    `${t('sf_email')}: ${clean(contact.email)}`,
    `${t('sf_ship_to')}: ${country}`,
    `${t('sf_city')}: ${clean(contact.city)}`,
    `${t('sf_address')}: ${clean(contact.line)}`,
  ].join('\n');
  return { subject: `${t('sf_order_subject')} ${ref}`, body };
}
