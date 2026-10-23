import { useEffect, useState } from 'react';
import { apiUrl, isStaticHosting } from './api';
import { BUNDLED_FX, COUNTRY_CODES, currencyFor, guessCountry, isCountry, priceIn, quote, type Quote, type QuoteLine } from './pricing';
import { LOCALE_MAP } from '../لغات/localize';
import { budgetsToHome, localizeChatPrices } from './chatPrices';
import type { SupportedLanguage } from '../types/i18n';
import { getSessionToken } from '../community/api';
import type { DirectMethod } from './directPayment';

/**
 * The visitor's side of «الدفع في متجر شام»: their country (and so currency + shipping), prices in that
 * currency, and the trip to Kashier's payment page and back. Every amount is recomputed by the server.
 */
const COUNTRY_KEY = 'sham-store-country';
const COUNTRY_EVENT = 'sham-store-country-change';
const PENDING_KEY = 'sham-store-pending-payment';

function savedCountry(): { code: string; manual: boolean } | undefined {
  try {
    const raw = JSON.parse(localStorage.getItem(COUNTRY_KEY) || 'null') as { code?: string; manual?: boolean } | null;
    return raw && isCountry(raw.code) ? { code: raw.code, manual: Boolean(raw.manual) } : undefined;
  } catch { return undefined; }
}

export function setStoreCountry(code: string, manual = true) {
  if (!isCountry(code)) return;
  try { localStorage.setItem(COUNTRY_KEY, JSON.stringify({ code, manual })); } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent(COUNTRY_EVENT, { detail: code }));
}

/** The visitor's country right now, outside React: his own choice or the server's edge country (saved), else a guess. */
export function currentStoreCountry(): string {
  if (typeof window === 'undefined') return 'EG';
  try { return savedCountry()?.code || guessCountry(navigator.languages || [], Intl.DateTimeFormat().resolvedOptions().timeZone || ''); } catch { return 'EG'; }
}

/**
 * «شاهين بعملة بلدك» for a chat window: replies shown in the currency of the country the conversation comes from
 * (asking the server's edge country once, like the store), and the visitor's own amounts sent to the brain in EGP.
 */
export function useChatPrices(lang: SupportedLanguage) {
  const [country] = useStoreCountry();
  const currency = currencyFor(country, BUNDLED_FX);
  return {
    country, currency,
    show: (text: string) => localizeChatPrices(text, currency, lang, BUNDLED_FX),
    outgoing: (text: string) => budgetsToHome(text, currency, lang, BUNDLED_FX),
  };
}

let geoAsked = false;
/** The visitor's country: their own choice → the server's edge country → time zone / language → Egypt. */
export function useStoreCountry(): [string, (code: string) => void] {
  const [country, setCountry] = useState<string>(() => {
    if (typeof window === 'undefined') return 'EG';
    return savedCountry()?.code || guessCountry(navigator.languages || [], Intl.DateTimeFormat().resolvedOptions().timeZone || '');
  });
  useEffect(() => {
    const sync = () => setCountry(savedCountry()?.code || country);
    window.addEventListener(COUNTRY_EVENT, sync);
    if (!savedCountry()?.manual && !geoAsked && !isStaticHosting) {
      geoAsked = true;
      fetch(apiUrl('/api/geo'), { signal: AbortSignal.timeout(4000) })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { country?: string } | null) => { if (d && isCountry(d.country)) setStoreCountry(d.country, false); })
        .catch(() => undefined);
    }
    return () => window.removeEventListener(COUNTRY_EVENT, sync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return [country, (code: string) => setStoreCountry(code, true)];
}

/** Every country, named in the visitor's language, sorted for a picker. */
export function countryOptions(lang: SupportedLanguage): { code: string; name: string }[] {
  let names: Intl.DisplayNames | undefined;
  try { names = new Intl.DisplayNames([LOCALE_MAP[lang] || 'en'], { type: 'region' }); } catch { names = undefined; }
  return COUNTRY_CODES.flatMap((code) => {
    let name = code;
    try { name = names?.of(code) || code; } catch { return []; }
    return name && name !== code ? [{ code, name }] : [];
  }).sort((a, b) => a.name.localeCompare(b.name, LOCALE_MAP[lang] || 'en'));
}

/** «١٬٢٥٠ جنيه» for Egypt (the store's own wording), «SAR 312.50» / «312,50 €» everywhere else. */
export function formatMoney(amount: number, currency: string, lang: SupportedLanguage, egpLabel: string): string {
  const locale = LOCALE_MAP[lang] || 'en-GB';
  const fraction = Math.round(amount * 100) % 100 ? 2 : 0;
  if (currency === 'EGP') {
    try { return `${new Intl.NumberFormat(locale, { maximumFractionDigits: fraction }).format(amount)} ${egpLabel}`; } catch { return `${amount} ${egpLabel}`; }
  }
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: fraction, maximumFractionDigits: fraction }).format(amount);
  } catch { return `${amount} ${currency}`; }
}

/** One price function for the whole store page: catalog EGP → the visitor's currency, formatted. */
export function useStoreMoney(lang: SupportedLanguage, egpLabel: string) {
  const [country, setCountry] = useStoreCountry();
  const currency = currencyFor(country, BUNDLED_FX);
  return {
    country, setCountry, currency,
    price: (egp: number) => formatMoney(priceIn(egp, currency, BUNDLED_FX), currency, lang, egpLabel),
    money: (amount: number) => formatMoney(amount, currency, lang, egpLabel),
    quote: (lines: QuoteLine[]): Quote => quote(lines, country, { fx: BUNDLED_FX }),
  };
}

export interface PaymentsInfo {
  enabled: boolean; country: string; mode?: 'test' | 'live'; currency?: string; currencies?: string[]; methods: { id: 'card' | 'wallet'; name: string }[];
  /** «بنك شام»: pay the store directly (InstaPay, bank transfer, wallet, cash on delivery). */
  direct?: DirectMethod[];
}
/** Country-scoped, short-lived result. Changing country never reuses another country's eligibility. */
export function usePayments(country = 'EG'): PaymentsInfo | null {
  const [info, setInfo] = useState<PaymentsInfo | null>(null);
  useEffect(() => {
    const disabled: PaymentsInfo = { enabled: false, country, methods: [] };
    if (isStaticHosting) { setInfo(disabled); return; }
    const controller = new AbortController();
    setInfo(null);
    fetch(apiUrl(`/api/store/payments?country=${encodeURIComponent(country)}`), { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(6000)]) })
      .then(async (r) => r.ok ? await r.json() as PaymentsInfo : disabled)
      .then((d) => { if (!controller.signal.aborted) setInfo({ ...d, country, enabled: Boolean(d.enabled && d.methods?.length), methods: d.methods || [], direct: Array.isArray(d.direct) ? d.direct.filter((m) => m && typeof m.id === 'string' && ['instapay', 'bank_transfer', 'wallet', 'cod'].includes(m.kind)).slice(0, 8) : [] }); })
      .catch(() => { if (!controller.signal.aborted) setInfo(disabled); });
    return () => controller.abort();
  }, [country]);
  return info?.country === country ? info : null;
}

export interface CheckoutForm { name: string; email: string; phone: string; city: string; line: string }
export class CheckoutError extends Error { constructor(readonly code: string) { super(code); } }

/** Opens a Kashier payment page for the cart and sends the visitor there. */
export async function startCheckout(items: { sku: string; qty: number }[], country: string, form: CheckoutForm, lang: SupportedLanguage, method?: 'card' | 'wallet', context: 'cart' | 'direct' = 'cart'): Promise<void> {
  let response: Response;
  try {
    response = await fetch(apiUrl('/api/store/checkout'), {
      // Signed-in members: the order is also saved in «بوابتي» and reaches the merchants of «متاجر شام».
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(getSessionToken() ? { Authorization: `Bearer ${getSessionToken()}` } : {}) }, signal: AbortSignal.timeout(25_000),
      body: JSON.stringify({
        items, country, method, lang: lang === 'ar' ? 'ar' : 'en', returnUrl: `${location.origin}${location.pathname}`,
        contact: { name: form.name, email: form.email, phone: form.phone }, address: { city: form.city, line: form.line },
      }),
    });
  } catch { throw new CheckoutError('NETWORK'); }
  const data = await response.json().catch(() => ({})) as { code?: string; ref?: string; sessionId?: string; sessionUrl?: string };
  if (!response.ok || !data.sessionUrl || !data.sessionId || !data.ref) throw new CheckoutError(data.code || 'FAILED');
  try {
    const u = new URL(data.sessionUrl);
    if (u.protocol !== 'https:' || u.hostname !== 'payments.kashier.io' || u.port || u.username || u.password || !/^\/session\/[A-Za-z0-9_-]{6,64}$/.test(u.pathname)) throw new Error();
  } catch { throw new CheckoutError('INVALID_PAYMENT_URL'); }
  try { localStorage.setItem(PENDING_KEY, JSON.stringify({ ref: data.ref, sessionId: data.sessionId, at: Date.now(), items, context })); } catch { /* the result is still in Kashier */ }
  window.location.assign(data.sessionUrl);
}

export interface PaymentResult { ref: string; state: 'paid' | 'failed' | 'pending'; mode?: 'test' | 'live'; cartItems?: { sku: string; qty: number }[] }

/** Back from Kashier (?checkout=<ref>): asks the server what Kashier really recorded. */
export async function returnedPayment(): Promise<PaymentResult | null> {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(location.search);
  const ref = params.get('checkout');
  if (!ref) return null;
  let pending: { ref?: string; sessionId?: string; context?: string; items?: { sku: string; qty: number }[] } = {};
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(PENDING_KEY) || '{}');
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) pending = stored;
  } catch { /* none */ }
  // Kashier appends its own query (paymentStatus, signature…): keep the address bar clean either way.
  history.replaceState(null, '', `${location.pathname}${location.hash}`);
  if (pending.ref !== ref || !pending.sessionId) return { ref, state: 'pending' };
  try {
    const r = await fetch(apiUrl(`/api/store/checkout/${encodeURIComponent(pending.sessionId)}`), { signal: AbortSignal.timeout(15_000) });
    const d = await r.json() as { ref?: string; state?: PaymentResult['state']; mode?: PaymentResult['mode'] };
    const state = r.ok && d.ref === ref && ['paid', 'failed', 'pending'].includes(d.state || '') && ['live', 'test'].includes(d.mode || '') ? d.state! : 'pending';
    if (state === 'paid') { try { localStorage.removeItem(PENDING_KEY); } catch { /* ignore */ } }
    const cartItems = pending.context === 'cart' && Array.isArray(pending.items) ? pending.items.filter((i) => i && typeof i.sku === 'string' && Number.isInteger(i.qty) && i.qty > 0 && i.qty <= 99).slice(0, 30) : undefined;
    return { ref, state, mode: d.mode, cartItems };
  } catch { return { ref, state: 'pending' }; }
}
