/**
 * «أسعار الصرف الحية» in the browser. The server keeps the day's rates (GET /api/fx). The storefront
 *  1. at start-up, before any price is computed, adopts the rates it kept from an earlier visit when they are newer
 *     than the copy bundled in the build (no waiting, no flicker, the same rates for the whole visit);
 *  2. then quietly asks the server for the newest table and keeps it for the next visit.
 * So prices follow the day's rates without a GitHub robot committing them, and the checkout's drift check
 * (server/checkout.ts) still guards the rare change between two visits. Imported first in src/main.tsx.
 */
import { BUNDLED_FX, isFxTable, type FxTable } from './pricing';
import { apiUrl, isStaticHosting } from './api';

export const FX_STORE_KEY = 'sham_fx_v1';
/** Rates older than this are not adopted: a stale kept copy must never beat a recent build. */
export const FX_MAX_AGE_MS = 21 * 24 * 3_600_000;

type Store = Pick<Storage, 'getItem' | 'setItem'>;
const storeOf = (): Store | undefined => {
  try { return typeof localStorage === 'undefined' ? undefined : localStorage; } catch { return undefined; }
};
const ts = (t: { updatedAt?: string }) => Date.parse(t.updatedAt || '') || 0;

function kept(store: Store | undefined): (FxTable & { updatedAt: string }) | undefined {
  try {
    const data: unknown = JSON.parse(store?.getItem(FX_STORE_KEY) || 'null');
    return isFxTable(data) ? data : undefined;
  } catch { return undefined; }
}

/** Step 1: put the kept rates into the shared table when they are newer (and recent). Returns true if adopted. */
export function adoptKeptFx(store: Store | undefined = storeOf(), target: FxTable = BUNDLED_FX, now = Date.now()): boolean {
  const table = kept(store);
  if (!table || ts(table) <= ts(target) || now - ts(table) > FX_MAX_AGE_MS) return false;
  for (const [code, rate] of Object.entries(table.rates)) if (/^[A-Z]{3}$/.test(code) && Number(rate) > 0) target.rates[code] = rate;
  target.updatedAt = table.updatedAt;
  if (table.source) target.source = table.source;
  return true;
}

/** Step 2: ask the server for its newest table and keep it for the next visit (never changes this visit's prices). */
export async function keepServerFx(request: typeof fetch = fetch, store: Store | undefined = storeOf()): Promise<boolean> {
  if (!store || isStaticHosting) return false;
  try {
    const response = await request(apiUrl('/api/fx'), { signal: AbortSignal.timeout(6000) });
    const data: unknown = response.ok ? await response.json() : undefined;
    if (!isFxTable(data)) return false;
    const current = kept(store);
    if (current && ts(current) >= ts(data)) return false;
    store.setItem(FX_STORE_KEY, JSON.stringify({ base: data.base, source: data.source, updatedAt: data.updatedAt, rates: data.rates }));
    return true;
  } catch { return false; }
}

// Runs once when the app starts (this module is imported before the app's own modules).
if (typeof window !== 'undefined' && !(globalThis as { __shamFxBoot?: boolean }).__shamFxBoot) {
  (globalThis as { __shamFxBoot?: boolean }).__shamFxBoot = true;
  adoptKeptFx();
  window.setTimeout(() => { void keepServerFx(); }, 4000);
}
