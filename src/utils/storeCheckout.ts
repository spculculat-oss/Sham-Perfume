import { useEffect, useState } from 'react';
import { apiUrl, isStaticHosting } from './api';
import { BUNDLED_FX, COUNTRY_CODES, currencyFor, guessCountry, isCountry, priceIn, quote, type Quote, type QuoteLine } from './pricing';
import { LOCALE_MAP } from '../لغات/localize';
import type { SupportedLanguage } from '../types/i18n';
import { getSessionToken } from '../community/api';

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

export interface PaymentsInfo { enabled: boolean; mode?: 'test' | 'live'; currencies?: string[] }
let paymentsInfo: Promise<PaymentsInfo> | undefined;
/** Whether the server can take card payments (false on a static build or before Kashier is set up). */
export function usePayments(): PaymentsInfo | null {
  const [info, setInfo] = useState<PaymentsInfo | null>(null);
  useEffect(() => {
    if (isStaticHosting) { setInfo({ enabled: false }); return; }
    paymentsInfo ??= fetch(apiUrl('/api/store/payments'), { signal: AbortSignal.timeout(6000) })
      .then((r) => (r.ok ? r.json() as Promise<PaymentsInfo> : { enabled: false }))
      .catch(() => { paymentsInfo = undefined; return { enabled: false }; });
    let live = true;
    void paymentsInfo.then((d) => { if (live) setInfo({ enabled: Boolean(d.enabled), mode: d.mode, currencies: d.currencies }); });
    return () => { live = false; };
  }, []);
  return info;
}

export interface CheckoutForm { name: string; email: string; phone: string; city: string; line: string }
export class CheckoutError extends Error { constructor(readonly code: string) { super(code); } }

/** Opens a Kashier payment page for the cart and sends the visitor there. */
export async function startCheckout(items: { sku: string; qty: number }[], country: string, form: CheckoutForm, lang: SupportedLanguage): Promise<void> {
  let response: Response;
  try {
    response = await fetch(apiUrl('/api/store/checkout'), {
      // Signed-in members: the order is also saved in «بوابتي» and reaches the merchants of «متاجر شام».
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(getSessionToken() ? { Authorization: `Bearer ${getSessionToken()}` } : {}) }, signal: AbortSignal.timeout(25_000),
      body: JSON.stringify({
        items, country, lang: lang === 'ar' ? 'ar' : 'en', returnUrl: `${location.origin}${location.pathname}`,
        contact: { name: form.name, email: form.email, phone: form.phone }, address: { city: form.city, line: form.line },
      }),
    });
  } catch { throw new CheckoutError('NETWORK'); }
  const data = await response.json().catch(() => ({})) as { code?: string; ref?: string; sessionId?: string; sessionUrl?: string };
  if (!response.ok || !data.sessionUrl || !data.sessionId || !data.ref) throw new CheckoutError(data.code || 'FAILED');
  try { localStorage.setItem(PENDING_KEY, JSON.stringify({ ref: data.ref, sessionId: data.sessionId, at: Date.now() })); } catch { /* the result is still in Kashier */ }
  window.location.assign(data.sessionUrl);
}

export interface PaymentResult { ref: string; state: 'paid' | 'failed' | 'pending' }

/** Back from Kashier (?checkout=<ref>): asks the server what Kashier really recorded. */
export async function returnedPayment(): Promise<PaymentResult | null> {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(location.search);
  const ref = params.get('checkout');
  if (!ref) return null;
  let pending: { ref?: string; sessionId?: string } = {};
  try { pending = JSON.parse(localStorage.getItem(PENDING_KEY) || '{}'); } catch { /* none */ }
  // Kashier appends its own query (paymentStatus, signature…): keep the address bar clean either way.
  history.replaceState(null, '', `${location.pathname}${location.hash}`);
  if (pending.ref !== ref || !pending.sessionId) return { ref, state: 'pending' };
  try {
    const r = await fetch(apiUrl(`/api/store/checkout/${encodeURIComponent(pending.sessionId)}`), { signal: AbortSignal.timeout(15_000) });
    const d = await r.json() as { ref?: string; state?: PaymentResult['state'] };
    const state = r.ok && d.ref === ref && d.state ? d.state : 'pending';
    if (state === 'paid') { try { localStorage.removeItem(PENDING_KEY); } catch { /* ignore */ } }
    return { ref, state };
  } catch { return { ref, state: 'pending' }; }
}
