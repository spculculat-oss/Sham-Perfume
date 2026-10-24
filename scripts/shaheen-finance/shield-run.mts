/**
 * «حارس المدفوعات والعمولات» — GitHub Actions runs it every 6 hours (`.github/workflows/shaheen-finance-shield.yml`):
 *   node --import tsx scripts/shaheen-finance/shield-run.mts
 *
 * 1. Static: the guard is wired in front of both payment paths in `server/checkout.ts`.
 * 2. Drills: the guard is fired at deliberately broken carts (./shield.ts) — a guard that no longer stops them fails.
 * 3. Live (read-only): `GET /api/store/payments?country=…` for a sample of countries — the currency each would be
 *    charged in is its own. No order is created, no card is touched and no customer data is read.
 *
 * Writes `src/data/live/finance-shield.json` for «الفحص الشامل» and the council.
 * Env: SHAM_SHIELD_API_URL (defaults to the live API), SHAM_SHIELD_COUNTRIES (comma-separated override),
 *      SHAM_SHIELD_SKIP_LIVE=1 (offline run: no live pages, the report says so).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import countryCurrency from '../../src/data/country-currency.json';
import fxData from '../../src/data/live/fx-rates.json';
import { currencyFor, type FxTable } from '../../src/utils/pricing';
import { auditShield, type LiveProbe } from './shield';

const env = process.env;
const origin = (env.SHAM_SHIELD_API_URL || 'https://sham-perfume-49bf.vercel.app').trim();
const now = Date.now();
const fx = fxData as FxTable;
const countries = countryCurrency as Record<string, string>;

const DEFAULT_SAMPLE = ['EG', 'SA', 'AE', 'KW', 'QA', 'BH', 'OM', 'JO', 'LB', 'IQ', 'MA', 'DZ', 'TN', 'LY', 'SD', 'YE', 'PS', 'TR',
  'US', 'GB', 'FR', 'DE', 'IT', 'ES', 'NL', 'BE', 'CH', 'SE', 'NO', 'DK', 'PL', 'RU', 'UA', 'IN', 'PK', 'BD', 'CN', 'JP', 'KR',
  'SG', 'MY', 'ID', 'PH', 'TH', 'VN', 'AU', 'NZ', 'CA', 'BR', 'MX', 'AR', 'ZA', 'NG', 'KE', 'GH', 'ET'];
const sample = (env.SHAM_SHIELD_COUNTRIES || '').split(',').map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c) && c in countries);
const probes = sample.length ? sample : DEFAULT_SAMPLE.filter((c) => c in countries);

const checkoutSource = readFileSync(new URL('../../server/checkout.ts', import.meta.url), 'utf8');

const live: LiveProbe[] = [];
const probeFailed: string[] = [];
let gatewayEnabled = false;
let gatewayMode: string | undefined;

const probe = async (country: string) => {
  const official = currencyFor(country, fx);
  try {
    const url = new URL('/api/store/payments', origin);
    url.searchParams.set('country', country);
    if (url.protocol !== 'https:') throw new Error('https only');
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10_000), redirect: 'error' });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const body = (await response.json()) as { enabled?: unknown; currency?: unknown; currencies?: unknown; mode?: unknown };
    if (Array.isArray(body.currencies) && body.currencies.length) gatewayEnabled = true;
    if (typeof body.mode === 'string') gatewayMode = body.mode;
    live.push({
      country,
      official,
      enabled: body.enabled === true,
      ...(typeof body.currency === 'string' && /^[A-Z]{3}$/.test(body.currency) ? { currency: body.currency } : {}),
    });
  } catch (error) {
    probeFailed.push(`${country}:${error instanceof Error ? error.message.slice(0, 24) : 'FAILED'}`);
  }
};

// A small fixed pool: fast enough for 57 countries, gentle on the live server.
// SHAM_SHIELD_SKIP_LIVE=1 (offline runs and unit checks) skips the live pages and says so in the report.
const queue = env.SHAM_SHIELD_SKIP_LIVE === '1' ? [] : [...probes];
await Promise.all(Array.from({ length: 6 }, async () => {
  while (queue.length) {
    const country = queue.shift();
    if (country) await probe(country);
  }
}));

const report = auditShield({ now, checkoutSource, live, probeFailed, gateways: { enabled: gatewayEnabled, ...(gatewayMode ? { mode: gatewayMode } : {}) } });

writeFileSync(new URL('../../src/data/live/finance-shield.json', import.meta.url), `${JSON.stringify(report, null, 1)}\n`);

console.log(report.summaryAr);
for (const line of report.planAr) console.log(`- ${line}`);
for (const note of report.notes) console.log(`! ${note}`);

if (env.GITHUB_STEP_SUMMARY) {
  const failed = report.drills.failed.map((f) => `| ${f.nameAr} | ${f.expected} | ${f.got} | ${f.codes.join(', ') || '—'} |`);
  const mismatch = report.live.mismatches.map((m) => `| ${m.country} | ${m.official} | ${m.charged} |`);
  const lines = [
    '## حارس المدفوعات والعمولات',
    '',
    report.summaryAr,
    '',
    `- الحارس موصول: ${report.guard.wired ? 'نعم' : 'لا'} (${report.guard.calls} نداءات قبل الدفع)`,
    `- الدرجة: ${report.score}/100 · صفحات دفع مقروءة: ${report.live.probed}`,
    '',
    '### الخطة',
    report.planAr.map((l) => `- ${l}`).join('\n') || '- لا يوجد',
    '',
    '### تمارين الأمان الفاشلة',
    '| التمرين | المتوقع | النتيجة | الأسباب |',
    '|---|---|---|---|',
    failed.join('\n') || '| — | — | — | — |',
    '',
    '### دول بتخصم بعملة غير عملتها',
    '| الدولة | عملتها | المخصوم |',
    '|---|---|---|',
    mismatch.join('\n') || '| — | — | — |',
    '',
    '> مفيش بيانات عملاء ولا أرقام بطاقات ولا مبالغ طلبات حقيقية في التقرير.',
  ];
  writeFileSync(env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`, { flag: 'a' });
}
if (env.GITHUB_ACTIONS) {
  const clip = (t: string) => t.replace(/[\r\n%]/g, ' ').slice(0, 2800);
  console.log(`::notice title=Shaheen finance shield::${clip(report.summaryAr)}`);
  if (!report.guard.wired) console.log('::error title=Shaheen finance shield::حارس المدفوعات مش موصول في نقطة الدفع');
  if (report.drills.failed.length) console.log(`::warning title=Shaheen finance shield::${clip(`تمارين فاشلة: ${report.drills.failed.map((f) => f.id).join('، ')}`)}`);
  if (report.live.mismatches.length) console.log(`::warning title=Shaheen finance shield::${clip(`عملات غلط: ${report.live.mismatches.map((m) => m.country).join('، ')}`)}`);
}
