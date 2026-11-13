/**
 * «شاهين التاجر بيفتكر زبونه»: the SKUs the visitor ordered on this device (newest first, at most 12) — only product
 * codes, never a name, address or payment detail — so the store can offer what completes the last order.
 */
const KEY = 'sham_bought_v1';
const MAX = 12;

export function pastPurchases(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]') as unknown;
    return Array.isArray(raw) ? raw.filter((s): s is string => typeof s === 'string' && s.length > 0 && s.length < 80).slice(0, MAX) : [];
  } catch { return []; }
}

export function rememberPurchase(skus: string[]): string[] {
  const next = [...new Set([...skus.filter(Boolean), ...pastPurchases()])].slice(0, MAX);
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode: nothing kept */ }
  return next;
}
