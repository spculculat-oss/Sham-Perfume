/**
 * «الشحن المجاني» — the one place the site's free-shipping *words* come from, tied to the one place the free
 * shipping *money* comes from (`src/utils/pricing.ts` → `src/data/shipping.json`).
 *
 * The rule: the banner never invents an offer. `shipping.json` holds the merchant's decision
 * (`freeShippingAboveEgp`); when it is absent there is no offer, `freeShippingOffer()` returns `null`, and the
 * banner says nothing about free shipping — the same `quote()` the server charges then also charges shipping.
 * When he does set it, the threshold is shown in the visitor's own currency (`money.price(thresholdEgp)`) and
 * `quote()` really drops the shipping at that amount, so the promise and the receipt cannot disagree.
 *
 * Pure: the table and the already-formatted amount are parameters (`tests/freeShipping.test.ts`).
 */
import { SHIPPING, freeShippingAbove, type ShippingTable } from './pricing';
import type { SupportedLanguage } from '../types/i18n';

/** The merchant's approved offer, in EGP — or `null` when he has approved none. */
export interface FreeShippingOffer { thresholdEgp: number }

export function freeShippingOffer(table: ShippingTable = SHIPPING): FreeShippingOffer | null {
  const thresholdEgp = freeShippingAbove(table);
  return thresholdEgp === null ? null : { thresholdEgp };
}

/**
 * The promise in each site language it has been written in; `amount` is already money in the visitor's currency
 * («٥٠٠ جنيه», «$ 9.05»). A language not listed here reads the English line (Arabic script → the Arabic one),
 * never a broken mix of the two.
 */
const SENTENCE: Partial<Record<SupportedLanguage, (amount: string) => string>> = {
  ar: (a) => `شحن مجاني للطلبات فوق ${a}`,
  en: (a) => `Free shipping on orders over ${a}`,
  fr: (a) => `Livraison offerte dès ${a}`,
  es: (a) => `Envío gratis en pedidos superiores a ${a}`,
  it: (a) => `Spedizione gratuita per ordini superiori a ${a}`,
  de: (a) => `Kostenloser Versand ab ${a}`,
  ru: (a) => `Бесплатная доставка при заказе от ${a}`,
  zh: (a) => `订单满 ${a} 免运费`,
  tr: (a) => `${a} üzeri siparişlerde ücretsiz kargo`,
  fa: (a) => `ارسال رایگان برای سفارش‌های بالای ${a}`,
  is: (a) => `Ókeypis sending á pantanir yfir ${a}`,
  sq: (a) => `Transport falas për porositë mbi ${a}`,
  ps: (a) => `د ${a} څخه پورته فرمایشونو لپاره وړیا لېږد`,
};

/** Languages written in the Arabic script, so the Arabic line reads correctly for them. */
const ARABIC_SCRIPT = new Set<SupportedLanguage>(['ar', 'fa', 'ps', 'ur']);

/** The free-shipping line in the visitor's language, or `''` when there is no approved offer. */
export function freeShippingSentence(offer: FreeShippingOffer | null, amountText: string, lang: SupportedLanguage): string {
  if (!offer) return '';
  const make = SENTENCE[lang] || (ARABIC_SCRIPT.has(lang) ? SENTENCE.ar : SENTENCE.en);
  return make ? make(amountText) : '';
}
