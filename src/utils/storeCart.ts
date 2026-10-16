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

function write(cart: Cart) {
  try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch { /* private mode: in-memory only */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: cart }));
}

export function addToCart(sku: string, qty = 1) {
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

/** The message the Sham assistant receives when the visitor completes the order. */
/** The message the Sham assistant receives when the visitor completes the order — in their language. */
export function orderMessage(summary: ReturnType<typeof cartSummary>, lang: SupportedLanguage): string {
  const t = makeStoreT(lang);
  const currency = t('sf_currency');
  const items = summary.lines.map((l) => t('cart_order_line', {
    name: storeLocalized(l.product.name, lang), sku: l.product.sku, qty: l.qty,
    subtotal: l.subtotal, currency,
  }));
  // Plain digits on purpose: the hand-off message is read by the assistant, not by the currency formatter.
  return [t('cart_order_intro'), ...items, `${t('sf_total')}: ${summary.total} ${currency}`].join('\n');
}
