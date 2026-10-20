/**
 * Card and wallet entry, modelled on Stripe Checkout and Adyen Drop-in.
 * The browser may hold the number only while the field is being typed.
 * What is saved is a display token: brand, last 4, expiry, name. Never the
 * full number, never the security code, never a wallet phone.
 */
import { detectCardBrand, getSavedPaymentMethods, savePaymentMethod, updatePaymentMethod, type PaymentProvider, type SavedPaymentMethod } from './customerPaymentVault';

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'mada' | 'meeza';

const PAN = /\d(?:[ -]?\d){12,18}/;

export function assertDisplayOnly(value: string): void {
  if (PAN.test(value) || /\b(cvv|cvc|cid)\b/i.test(value)) throw new Error('SECRET');
}

export function luhnOk(digits: string): boolean {
  if (!/^\d{13,19}$/.test(digits)) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 19);
  const amex = /^3[47]/.test(digits);
  if (amex) {
    return [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10, 15)].filter(Boolean).join(' ');
  }
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

export function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export function cardBrand(digits: string): CardBrand {
  const brand = detectCardBrand(digits);
  if (brand === 'mastercard' || brand === 'amex' || brand === 'mada' || brand === 'meeza') return brand;
  return 'visa';
}

export interface CardToken {
  brand: CardBrand;
  last4: string;
  expMonth: string;
  expYear: string;
  holderName: string;
  postal: string;
}

/** Validates a card the way a hosted field does, then forgets the number and the security code. */
export function tokenizeCard(input: { number: string; expiry: string; cvc: string; name: string; postal?: string }, now = new Date()): CardToken {
  const digits = input.number.replace(/\D/g, '');
  const cvc = input.cvc.replace(/\D/g, '');
  const name = input.name.replace(/\s+/g, ' ').trim();
  const postal = (input.postal || '').trim();
  if (!luhnOk(digits)) throw new Error('INVALID_NUMBER');
  const brand = cardBrand(digits);
  const expiry = formatExpiry(input.expiry);
  const match = /^(\d{2})\/(\d{2})$/.exec(expiry);
  if (!match) throw new Error('INVALID_EXPIRY');
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) throw new Error('INVALID_EXPIRY');
  const expired = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);
  if (expired) throw new Error('INVALID_EXPIRY');
  const cvcLength = brand === 'amex' ? 4 : 3;
  if (cvc.length !== cvcLength) throw new Error('INVALID_CVC');
  if (name.length < 2 || name.length > 40 || /\d/.test(name)) throw new Error('INVALID_NAME');
  if (postal && !/^[A-Za-z0-9 -]{2,12}$/.test(postal)) throw new Error('INVALID_POSTAL');
  const token: CardToken = {
    brand,
    last4: digits.slice(-4),
    expMonth: match[1],
    expYear: match[2],
    holderName: name,
    postal,
  };
  assertDisplayOnly(JSON.stringify(token));
  return token;
}

export function tokenizeWalletPhone(phone: string): { last4: string } {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) throw new Error('INVALID_WALLET');
  return { last4: digits.slice(-4) };
}

export function tokenizeWalletHandle(handle: string): { display: string } {
  const clean = handle.trim().toLowerCase();
  if (!/^[a-z0-9._-]{2,24}(@[a-z0-9.-]+)?$/.test(clean)) throw new Error('INVALID_WALLET');
  const local = clean.split('@')[0];
  const domain = clean.includes('@') ? clean.slice(clean.indexOf('@')) : '';
  return { display: `${local.slice(0, 2)}•••${domain}` };
}

const BRAND_NAME: Record<CardBrand, { ar: string; en: string; provider: PaymentProvider }> = {
  visa: { ar: 'فيزا', en: 'Visa', provider: 'visa' },
  mastercard: { ar: 'ماستركارد', en: 'Mastercard', provider: 'mastercard' },
  amex: { ar: 'أمريكان إكسبريس', en: 'American Express', provider: 'amex' },
  mada: { ar: 'مدى', en: 'mada', provider: 'mada' },
  meeza: { ar: 'ميزة', en: 'Meeza', provider: 'meeza' },
};

/** Saves the display token only. Refuses a guest and any payload that still contains a card number. */
export function registerCard(customerId: string, token: CardToken, consent: boolean): SavedPaymentMethod {
  if (!customerId || customerId === 'guest_client') throw new Error('LOGIN_REQUIRED');
  if (!consent) throw new Error('CONSENT_REQUIRED');
  assertDisplayOnly(JSON.stringify(token));
  const brand = BRAND_NAME[token.brand];
  return savePaymentMethod({
    customerId,
    type: 'card',
    title: brand.ar,
    titleEn: brand.en,
    provider: brand.provider,
    identifier: `•••• ${token.last4}`,
    holderName: token.holderName,
    expiry: `${token.expMonth}/${token.expYear}`,
    isDefault: true,
    metadata: { last4: token.last4, brandName: brand.en },
  }, customerId);
}

export function registerWallet(customerId: string, input: {
  provider: PaymentProvider;
  title: string;
  titleEn: string;
  type: 'wallet' | 'instapay' | 'bnpl' | 'express';
  holderName: string;
  phone?: string;
  handle?: string;
  consent: boolean;
}): SavedPaymentMethod {
  if (!customerId || customerId === 'guest_client') throw new Error('LOGIN_REQUIRED');
  if (!input.consent) throw new Error('CONSENT_REQUIRED');
  let identifier = input.titleEn;
  if (input.phone) identifier = `•••• ${tokenizeWalletPhone(input.phone).last4}`;
  else if (input.handle) identifier = tokenizeWalletHandle(input.handle).display;
  const saved = {
    customerId,
    type: input.type,
    title: input.title,
    titleEn: input.titleEn,
    provider: input.provider,
    identifier,
    holderName: input.holderName,
    isDefault: false,
    metadata: { brandName: input.titleEn },
  };
  assertDisplayOnly(JSON.stringify(saved));
  return savePaymentMethod(saved, customerId);
}

const PULL_KEY = 'sham_instrument_pull_v1_';

export interface InstrumentPull {
  id: string;
  customerId: string;
  methodId: string;
  display: string;
  kind: 'card' | 'wallet';
  amountLabel: string;
  orderRef: string;
  /** A request only. Never a collected charge. */
  status: 'requested';
  createdAt: string;
}

export function renewCardExpiry(customerId: string, id: string, expiry: string, now = new Date()): SavedPaymentMethod {
  const match = /^(\d{2})\/(\d{2})$/.exec(formatExpiry(expiry));
  if (!match) throw new Error('INVALID_EXPIRY');
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) throw new Error('INVALID_EXPIRY');
  if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) throw new Error('INVALID_EXPIRY');
  const saved = updatePaymentMethod(id, { expiry: `${match[1]}/${match[2]}` }, customerId);
  if (!saved || saved.type !== 'card') throw new Error('MISSING');
  return saved;
}

function pullKey(customerId: string) {
  return `${PULL_KEY}${customerId.trim().toLowerCase()}`;
}

export function listInstrumentPulls(customerId: string): InstrumentPull[] {
  if (typeof window === 'undefined' || !customerId) return [];
  try {
    const list = JSON.parse(localStorage.getItem(pullKey(customerId)) || '[]') as InstrumentPull[];
    return Array.isArray(list) ? list.filter((row) => row && row.status === 'requested') : [];
  } catch { return []; }
}

/** Records a reuse or a wallet pull against a saved instrument. Does not collect money. */
export function requestInstrumentPull(customerId: string, methodId: string, amountLabel: string): InstrumentPull {
  if (!customerId || customerId === 'guest_client') throw new Error('LOGIN_REQUIRED');
  const method = getSavedPaymentMethods(customerId).find((row) => row.id === methodId);
  if (!method) throw new Error('MISSING');
  const pull: InstrumentPull = {
    id: `pull_${Date.now().toString(36)}`,
    customerId,
    methodId,
    display: `${method.titleEn} ${method.identifier}`,
    kind: method.type === 'card' ? 'card' : 'wallet',
    amountLabel,
    orderRef: `SP-${Date.now().toString(36).toUpperCase()}`,
    status: 'requested',
    createdAt: new Date().toISOString(),
  };
  assertDisplayOnly(`${pull.display} ${pull.amountLabel}`);
  const next = [pull, ...listInstrumentPulls(customerId)].slice(0, 30);
  localStorage.setItem(pullKey(customerId), JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('sham-payment-methods-updated'));
  return pull;
}
