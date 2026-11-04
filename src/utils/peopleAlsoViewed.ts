/**
 * «ناس ذوقهم زيك شافوا كمان» — the browser side of GET /api/insights/together (server/insights.ts): product codes
 * that at least three different visitors looked at together. Anonymous by construction; nothing is sent but the
 * product code of the page.
 */
import { apiUrl, isStaticHosting } from './api';

const cache = new Map<string, Promise<string[]>>();

export function peopleAlsoViewed(sku: string): Promise<string[]> {
  if (isStaticHosting || typeof fetch !== 'function') return Promise.resolve([]);
  const hit = cache.get(sku);
  if (hit) return hit;
  const job = fetch(apiUrl(`/api/insights/together?sku=${encodeURIComponent(sku)}`), { credentials: 'omit' })
    .then((r) => (r.ok ? r.json() as Promise<{ skus?: unknown }> : { skus: [] }))
    .then((d) => (Array.isArray(d.skus) ? d.skus.filter((s): s is string => typeof s === 'string').slice(0, 8) : []))
    .catch(() => []);
  cache.set(sku, job);
  return job;
}
