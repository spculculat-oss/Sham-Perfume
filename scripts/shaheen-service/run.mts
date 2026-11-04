/**
 * «مكتب خدمة العملاء الآلي» — GitHub Actions runs this every 6 hours
 * (`.github/workflows/shaheen-service.yml`):  node --import tsx scripts/shaheen-service/run.mts
 *
 * Reads the live service desk through the admin API (read-only) and writes
 * `src/data/live/shaheen-service.json`. Only aggregate numbers leave the server: no name, phone, e-mail,
 * order reference, address or message text is read into the report or printed in the log.
 * Without a token (or when the server is down) it still audits the published support knowledge and says
 * plainly that the live desk was not read — no invented number.
 * Env: SHAM_SERVICE_API_URL, SHAM_ADMIN_TOKEN, SERVICE_PUBLISH.
 */
import { writeFileSync } from 'node:fs';
import { buildServiceDesk, type ServiceLive } from './desk';

const env = process.env;
const origin = (env.SHAM_SERVICE_API_URL || 'https://sham-perfume-49bf.vercel.app').trim();
const token = env.SHAM_ADMIN_TOKEN?.trim() || '';
const now = Date.now();

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

const ENDPOINTS = {
  overview: '/api/admin/overview',
  requests: '/api/admin/requests',
  conversations: '/api/admin/conversations',
  gaps: '/api/admin/gaps',
  feedback: '/api/admin/feedback',
} as const;
type EndpointName = keyof typeof ENDPOINTS;

let live: ServiceLive = { checked: false, at: new Date(now).toISOString(), failed: [] };
const data: Partial<Record<EndpointName, unknown>> = {};

if (!token || token.length < 12) {
  live.failed = ['token:NO_ADMIN_TOKEN'];
} else {
  let url: URL | undefined;
  try { url = new URL(origin); } catch { url = undefined; }
  if (!url || url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    live.failed = ['origin:INVALID_ORIGIN'];
  } else {
    const names = Object.keys(ENDPOINTS) as EndpointName[];
    const results = await Promise.allSettled(names.map((name) => apiGet(ENDPOINTS[name])));
    results.forEach((result, i) => {
      const name = names[i];
      if (result.status === 'fulfilled') data[name] = result.value;
      else {
        const code = result.reason instanceof ApiError ? result.reason.code : (result.reason as Error)?.name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK';
        live.failed.push(`${name}:${code}`);
      }
    });
    // The three core endpoints define whether the desk is readable; gaps/feedback are a bonus.
    live.checked = ['overview', 'requests', 'conversations'].every((name) => data[name as EndpointName] !== undefined);
  }
}

const asRows = (value: unknown): Record<string, unknown>[] | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const items = (value as { items?: unknown }).items;
  return Array.isArray(items) ? items.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object')) : undefined;
};
const asObject = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' ? value as Record<string, unknown> : undefined;
/** Only the fields the desk needs: no name, contact, message text or order reference ever reaches the brain. */
const only = (rows: Record<string, unknown>[] | undefined, keys: string[]) =>
  rows?.map((row) => Object.fromEntries(keys.filter((key) => key in row).map((key) => [key, row[key]])));

const report = buildServiceDesk({
  now,
  live,
  ...(asObject(data.overview) ? { overview: asObject(data.overview) } : {}),
  ...(only(asRows(data.requests), ['status', 'createdAt']) ? { requests: only(asRows(data.requests), ['status', 'createdAt']) } : {}),
  ...(only(asRows(data.conversations), ['status', 'updatedAt']) ? { conversations: only(asRows(data.conversations), ['status', 'updatedAt']) } : {}),
  ...(only(asRows(data.gaps), ['status', 'count']) ? { gaps: only(asRows(data.gaps), ['status', 'count']) } : {}),
  ...(only(asRows(data.feedback), ['rating', 'reason', 'at']) ? { feedback: only(asRows(data.feedback), ['rating', 'reason', 'at']) } : {}),
});

writeFileSync(new URL('../../src/data/live/shaheen-service.json', import.meta.url), `${JSON.stringify(report, null, 1)}\n`);

console.log(report.summaryAr);
console.log(`Knowledge coverage: ${report.knowledge.coverage}% (${report.knowledge.missing.length} missing, ${report.knowledge.thin.length} thin)`);
console.log(`Live desk: ${report.live.checked ? 'read' : 'not read'}${report.live.failed.length ? ` — ${report.live.failed.join(', ')}` : ''}`);
for (const item of report.queue) console.log(`- [${item.priority}] ${item.textAr}`);

if (env.GITHUB_STEP_SUMMARY) {
  const lines = [
    `## مكتب خدمة العملاء الآلي — ${report.updatedAt}`,
    '',
    report.summaryAr,
    '',
    '### الطابور',
    report.queue.length ? report.queue.map((item) => `- **${item.priority}** — ${item.textAr}`).join('\n') : '- مفيش حاجة مستنية',
    '',
    '### معلومات الدعم',
    `- التغطية: ${report.knowledge.coverage}%`,
    `- ناقص: ${report.knowledge.missing.join('، ') || 'لا يوجد'}`,
    `- مختصر أو ناقص الترجمة: ${report.knowledge.thin.join('، ') || 'لا يوجد'}`,
    `- مناطق شحن بدون مدة: ${report.knowledge.zonesWithoutDays.join('، ') || 'لا يوجد'}`,
    '',
    '### الردود الجاهزة',
    report.templates.map((template) => `- **${template.titleAr}** — ${template.whenAr}`).join('\n') || '- لا يوجد',
    '',
    '> الأرقام الحية مجمّعة فقط: مفيش أسماء أو أرقام تواصل أو أرقام طلبات في التقرير.',
  ];
  writeFileSync(env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`, { flag: 'a' });
}
if (env.GITHUB_ACTIONS) {
  const clip = (text: string) => text.replace(/[\r\n%]/g, ' ').slice(0, 2800);
  console.log(`::notice title=Shaheen customer care::${clip(report.summaryAr)}`);
  if (!report.live.checked) console.log(`::warning title=Shaheen customer care::${clip(`الحساب الحي مش مقروء: ${report.live.failed.join('، ') || 'سبب غير معروف'}`)}`);
}
