/** Local, UNVERIFIED payment preferences. Legacy XOR encoding is obfuscation, NOT encryption or
 * provider tokenization. Never use this browser-controlled data to authorize payments or calculate profit.
 * New checkout stores no card/wallet data; the provider hosts all payment fields.
 */

export type PaymentServiceType =
  | 'card'
  | 'wallet'
  | 'instapay'
  | 'bnpl'
  | 'express';

export type PaymentProvider =
  | 'visa'
  | 'mastercard'
  | 'mada'
  | 'meeza'
  | 'amex'
  | 'vodafone_cash'
  | 'orange_cash'
  | 'we_pay'
  | 'etisalat_cash'
  | 'stc_pay'
  | 'instapay'
  | 'tabby'
  | 'tamara'
  | 'valu'
  | 'apple_pay'
  | 'google_pay'
  | 'local';

export interface SavedPaymentMethod {
  id: string;
  customerId: string;
  type: PaymentServiceType;
  title: string;
  titleEn: string;
  provider: PaymentProvider;
  identifier: string; // e.g. "•••• •••• •••• 4242" or "010****1234" or "perfumer@instapay"
  holderName: string;
  expiry?: string; // MM/YY for cards
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  metadata?: {
    last4?: string;
    brandName?: string;
    bankName?: string;
    phone?: string;
    ipaHandle?: string;
    installmentsCount?: number;
    colorGradient?: string;
  };
}

export interface PaymentTransactionRecord {
  id: string;
  customerId: string;
  orderRef: string;
  amount: number;
  currency: string;
  paymentMethodId?: string;
  paymentMethodTitle: string;
  provider: PaymentProvider;
  status: 'succeeded' | 'pending' | 'failed' | 'refunded' | 'unverified';
  authCode: string;
  createdAt: string;
}

const VAULT_STORAGE_KEY_PREFIX = 'sham_payment_vault_v1_';
const VAULT_TRANSACTIONS_KEY_PREFIX = 'sham_payment_tx_v1_';
const VAULT_SECRET_KEY = 'sham-perfume-vault-key-2026';

// Legacy reversible obfuscation only (retained to read existing local preferences).

function encryptPayload(data: unknown): string {
  try {
    const jsonStr = JSON.stringify(data);
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(jsonStr);
    const keyBytes = encoder.encode(VAULT_SECRET_KEY);
    const encrypted = new Uint8Array(dataBytes.length);
    for (let i = 0; i < dataBytes.length; i++) {
      encrypted[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    let bin = '';
    const chunk = 8192;
    for (let i = 0; i < encrypted.length; i += chunk) {
      bin += String.fromCharCode(...encrypted.subarray(i, i + chunk));
    }
    return btoa(bin);
  } catch {
    return '';
  }
}

function decryptPayload<T>(encrypted: string, fallback: T): T {
  try {
    const decoded = atob(encrypted);
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      bytes[i] = decoded.charCodeAt(i);
    }
    const keyBytes = new TextEncoder().encode(VAULT_SECRET_KEY);
    const decrypted = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      decrypted[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
    }
    const json = new TextDecoder().decode(decrypted);
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

function getStorageKey(customerId?: string): string {
  const cleanId = (customerId || 'guest_client').trim().toLowerCase();
  return `${VAULT_STORAGE_KEY_PREFIX}${cleanId}`;
}

function getTxStorageKey(customerId?: string): string {
  const cleanId = (customerId || 'guest_client').trim().toLowerCase();
  return `${VAULT_TRANSACTIONS_KEY_PREFIX}${cleanId}`;
}

export function getSavedPaymentMethods(customerId?: string): SavedPaymentMethod[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getStorageKey(customerId));
    const list = raw ? decryptPayload<SavedPaymentMethod[]>(raw, []) : [];
    // Remove ONLY the old generated preview examples from the view, never a customer's own aliases.
    return Array.isArray(list) ? list.filter((m) => m && !/^pay_(card|mada|wallet|instapay)_seed_/.test(m.id)) : [];
  } catch { return []; }
}

export function savePaymentMethod(
  method: Omit<SavedPaymentMethod, 'id' | 'createdAt' | 'updatedAt'>,
  customerId?: string
): SavedPaymentMethod {
  const current = getSavedPaymentMethods(customerId);
  const now = new Date().toISOString();
  const id = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // إذا تم تحديد هذه الوسيلة كافتراضية، نزيل الافتراضي عن البقية
  const updatedCurrent = method.isDefault
    ? current.map((m) => ({ ...m, isDefault: false }))
    : current;

  const newMethod: SavedPaymentMethod = {
    ...method,
    id,
    customerId: customerId || 'guest_client',
    createdAt: now,
    updatedAt: now,
  };

  const nextList = [newMethod, ...updatedCurrent];
  try {
    localStorage.setItem(getStorageKey(customerId), encryptPayload(nextList));
    window.dispatchEvent(new CustomEvent('sham-payment-methods-updated'));
  } catch {}

  return newMethod;
}

export function deletePaymentMethod(id: string, customerId?: string): boolean {
  const current = getSavedPaymentMethods(customerId);
  const filtered = current.filter((m) => m.id !== id);
  if (filtered.length === current.length) return false;

  // إذا كانت المحذوفة هي الافتراضية وهناك بطاقات أخرى، نجعل الأولى افتراضية
  if (filtered.length > 0 && !filtered.some((m) => m.isDefault)) {
    filtered[0].isDefault = true;
  }

  try {
    localStorage.setItem(getStorageKey(customerId), encryptPayload(filtered));
    window.dispatchEvent(new CustomEvent('sham-payment-methods-updated'));
    return true;
  } catch {
    return false;
  }
}

export function setDefaultPaymentMethod(id: string, customerId?: string): boolean {
  const current = getSavedPaymentMethods(customerId);
  let changed = false;
  const updated = current.map((m) => {
    if (m.id === id) {
      changed = true;
      return { ...m, isDefault: true, updatedAt: new Date().toISOString() };
    }
    return { ...m, isDefault: false };
  });

  if (!changed) return false;

  try {
    localStorage.setItem(getStorageKey(customerId), encryptPayload(updated));
    window.dispatchEvent(new CustomEvent('sham-payment-methods-updated'));
    return true;
  } catch {
    return false;
  }
}

export function getDefaultPaymentMethod(customerId?: string): SavedPaymentMethod | undefined {
  const list = getSavedPaymentMethods(customerId);
  return list.find((m) => m.isDefault) || list[0];
}

// ─── سجل المعاملات والمدفوعات ─────────────────────────────────

export function getPaymentTransactions(customerId?: string): PaymentTransactionRecord[] {
  if (typeof window === 'undefined') return [];
  const key = getTxStorageKey(customerId);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const list = decryptPayload<PaymentTransactionRecord[]>(raw, []);
    return Array.isArray(list) ? list.map((tx) => ({ ...tx, status: 'unverified' as const, authCode: '' })) : [];
  } catch {
    return [];
  }
}

export function recordPaymentTransaction(
  tx: Omit<PaymentTransactionRecord, 'id' | 'createdAt'>,
  customerId?: string
): PaymentTransactionRecord {
  const current = getPaymentTransactions(customerId);
  const newTx: PaymentTransactionRecord = {
    ...tx,
    status: 'unverified', authCode: '',
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  const nextList = [newTx, ...current.slice(0, 49)];
  try {
    localStorage.setItem(getTxStorageKey(customerId), encryptPayload(nextList));
  } catch {}
  return newTx;
}

// ─── محاكاة كشف نوع البطاقة وتنسيق الرقم ────────────────────────

export function detectCardBrand(number: string): PaymentProvider {
  const clean = number.replace(/\D/g, '');
  if (/^4/.test(clean)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(clean)) return 'mastercard';
  if (/^(588845|4578|4579|4008|4017|4092|4847|9682)/.test(clean)) return 'mada';
  if (/^3[47]/.test(clean)) return 'amex';
  if (/^5078/.test(clean)) return 'meeza';
  return 'visa';
}

export function formatCardNumber(value: string): string {
  const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
  const matches = v.match(/\d{4,16}/g);
  const match = (matches && matches[0]) || '';
  const parts = [];

  for (let i = 0, len = match.length; i < len; i += 4) {
    parts.push(match.substring(i, i + 4));
  }

  if (parts.length) {
    return parts.join(' ');
  } else {
    return value;
  }
}

export function formatExpiry(value: string): string {
  const clean = value.replace(/\D/g, '').slice(0, 4);
  if (clean.length >= 3) {
    return `${clean.slice(0, 2)}/${clean.slice(2)}`;
  }
  return clean;
}
