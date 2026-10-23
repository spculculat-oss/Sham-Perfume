/**
 * «إدارة المخزون والتنبؤ بالمبيعات» — GitHub Actions runs this every 6 hours
 * (`.github/workflows/shaheen-inventory.yml`):  node --import tsx scripts/shaheen-inventory/run.mts
 *
 * Reads the real storefront catalog from the repository, then (when an admin token exists) the numeric stock
 * and the recorded requests through the admin API — read-only. Writes `src/data/live/shaheen-inventory.json`.
 * The forecast uses confirmed/completed requests only; with no sales data the report says so and plans from
 * stock/catalog alone. No customer data and no revenue amounts are copied or printed.
 * Env: SHAM_INVENTORY_API_URL, SHAM_ADMIN_TOKEN, INVENTORY_PUBLISH.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import type { RawProduct, StoreCatalogFile } from '../../src/utils/storeCatalog';
import { adminProducts, adminRequests, buildInventory } from './plan';

const env = process.env;
const origin = (env.SHAM_INVENTORY_API_URL || 'https://sham-perfume-49bf.vercel.app').trim();
const token = env.SHAM_ADMIN_TOKEN?.trim() || '';
const now = Date.now();

const readJson = <T,>(url: URL, fallback: T): T => {
  try { return JSON.parse(readFileSync(url, 'utf8')) as T; } catch { return fallback; }
};
const productsFile = readJson<{ products?: RawProduct[] }>(new URL('../../src/data/products.json', import.meta.url), {});
const catalogFile = readJson<StoreCatalogFile | undefined>(new URL('../../src/data/live/store-catalog.json', import.meta.url), undefined);
const products = Array.isArray(productsFile.products) ? productsFile.products : [];

class ApiError extends Error {
  constructor(public code: string) { super(code); }
}
async function apiGet(path: string): Promise<unknown> {
  const response = await fetch(new URL(path, origin), {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20_000),
    redirect: 'error',
  });
  if (!response.ok) throw new ApiError(`HTTP_${response.status}`);
  return response.json();
}

const liveFailed: string[] = [];
let liveProducts: ReturnType<typeof adminProducts> | undefined;
let liveRequests: ReturnType<typeof adminRequests> | undefined;

if (!token || token.length < 12) {
  liveFailed.push('token:NO_ADMIN_TOKEN');
} else {
  let url: URL | undefined;
  try { url = new URL(origin); } catch { url = undefined; }
  if (!url || url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    liveFailed.push('origin:INVALID_ORIGIN');
  } else {
    const [stockResult, ordersResult] = await Promise.allSettled([apiGet('/api/admin/products'), apiGet('/api/admin/requests')]);
    if (stockResult.status === 'fulfilled') liveProducts = adminProducts(stockResult.value);
    else liveFailed.push(`products:${stockResult.reason instanceof ApiError ? stockResult.reason.code : 'NETWORK'}`);
    if (ordersResult.status === 'fulfilled') liveRequests = adminRequests(ordersResult.value);
    else liveFailed.push(`requests:${ordersResult.reason instanceof ApiError ? ordersResult.reason.code : 'NETWORK'}`);
  }
}

const report = buildInventory({
  now,
  products,
  ...(catalogFile && catalogFile.entries ? { catalog: catalogFile } : {}),
  ...(liveProducts !== undefined || liveRequests !== undefined
    ? { live: { products: liveProducts || [], requests: liveRequests || [] } }
    : {}),
  // An endpoint that answered with zero rows was read — it is not «missing».
  stockRead: liveProducts !== undefined,
  salesRead: liveRequests !== undefined,
  liveFailed,
});

writeFileSync(new URL('../../src/data/live/shaheen-inventory.json', import.meta.url), `${JSON.stringify(report, null, 1)}\n`);

console.log(report.summaryAr);
console.log(`Live stock: ${report.sources.liveStock ? `read (${report.stock?.products ?? 0} products)` : 'not read'} · live sales: ${report.sources.liveSales ? `read (${report.sales.orders} recorded order(s))` : 'not read'}${report.sources.failed.length ? ` — ${report.sources.failed.join(', ')}` : ''}`);
for (const line of report.planAr) console.log(`- ${line}`);

if (env.GITHUB_STEP_SUMMARY) {
  const top = report.restock.slice(0, 15).map((item) => `| ${item.sku} | ${item.nameAr} | ${item.priority} | ${item.reasonAr} |`);
  const forecast = report.forecast.items.slice(0, 10).map((item) => `| ${item.sku} | ${item.units30} | ${item.band} | ${item.coverDays ?? '—'} | ${item.reorderUnits ?? '—'} |`);
  const lines = [
    `## إدارة المخزون والتنبؤ بالمبيعات — ${report.updatedAt}`,
    '',
    report.summaryAr,
    '',
    '### الخطة',
    report.planAr.map((line) => `- ${line}`).join('\n'),
    '',
    `### إعادة التوريد (${report.restock.length})`,
    '| SKU | المنتج | الأولوية | السبب |',
    '|---|---|---|---|',
    top.join('\n') || '| — | — | — | — |',
    '',
    '### التنبؤ',
    report.forecast.noteAr,
    '',
    '| SKU | وحدات 30 يوم | الطلب | تغطية بالأيام | كمية مقترحة |',
    '|---|---|---|---|---|',
    forecast.join('\n') || '| — | — | — | — | — |',
    '',
    '> مفيش أسماء أو أرقام تواصل أو مبالغ مالية في التقرير.',
  ];
  writeFileSync(env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`, { flag: 'a' });
}
if (env.GITHUB_ACTIONS) {
  const clip = (text: string) => text.replace(/[\r\n%]/g, ' ').slice(0, 2800);
  console.log(`::notice title=Shaheen inventory::${clip(report.summaryAr)}`);
  if (!report.sources.liveStock) console.log(`::warning title=Shaheen inventory::${clip(`المخزون الرقمي مش مقروء: ${report.sources.failed.join('، ') || 'سبب غير معروف'}`)}`);
  if (!report.sources.liveSales) console.log(`::warning title=Shaheen inventory::${clip(`سجل الطلبات مش مقروء: ${report.sources.failed.join('، ') || 'سبب غير معروف'}`)}`);
}
