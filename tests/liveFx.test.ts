// «أسعار الصرف الحية»: the server reads the day's rates itself (no GitHub robot), the storefront keeps them for the next visit.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { FX_FRESH_MS, FX_SOURCE_URL, fxFromSource, liveFxRates, resetLiveFx } from '../server/core/liveFx';
import { adoptKeptFx, FX_MAX_AGE_MS, FX_STORE_KEY, keepServerFx } from '../src/utils/fxBoot';
import { BUNDLED_FX, type FxTable } from '../src/utils/pricing';

const LIVE = { VERCEL: '1', SHAM_LIVE_DATA_URL: 'https://repo.test/live/' };
const unix = (iso: string) => Date.parse(iso) / 1000;
const rates = (egp: number) => {
  const r: Record<string, number> = { USD: 1, EGP: egp, EUR: 0.9, SAR: 3.75 };
  for (let i = 0; i < 120; i++) r[`X${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}`] = 1 + i;
  return r;
};
const answer = (iso: string, egp = 50) => ({ result: 'success', time_last_update_unix: unix(iso), rates: rates(egp) });
const json = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;

test('the rates service answer becomes our table; anything odd is refused', () => {
  const t = fxFromSource(answer('2026-11-11T00:02:31Z', 49.5))!;
  assert.equal(t.base, 'USD');
  assert.equal(t.updatedAt, '2026-11-11T00:02:31Z');
  assert.equal(t.rates.EGP, 49.5);
  assert.equal(fxFromSource({ ...answer('2026-11-11T00:00:00Z'), result: 'error' }), undefined);
  assert.equal(fxFromSource({ result: 'success', time_last_update_unix: 1, rates: { USD: 1, EGP: 50 } }), undefined, 'too few currencies');
  assert.equal(fxFromSource({ ...answer('2026-11-11T00:00:00Z'), rates: { ...rates(50), EGP: -1 } }), undefined, 'no EGP rate');
  assert.equal(fxFromSource(null), undefined);
});

test('the server asks the rates service itself, at most every 6 hours, and keeps the newest table', async () => {
  resetLiveFx();
  const calls: string[] = [];
  let clock = Date.parse('2026-11-11T08:00:00Z');
  let egp = 50.25;
  const request = (async (url: string) => {
    calls.push(String(url));
    if (String(url) === FX_SOURCE_URL) return json(answer(new Date(clock - 3_600_000).toISOString(), egp));
    return json(undefined, false); // the repository file is unreachable
  }) as unknown as typeof fetch;
  const first = await liveFxRates(LIVE, request, () => clock);
  assert.equal(first.rates.EGP, 50.25, 'the cold start waits for the answer');
  assert.equal(calls.filter((u) => u === FX_SOURCE_URL).length, 1);
  egp = 51;
  clock += FX_FRESH_MS - 60_000;
  assert.equal((await liveFxRates(LIVE, request, () => clock)).rates.EGP, 50.25, 'still fresh: no new request');
  assert.equal(calls.filter((u) => u === FX_SOURCE_URL).length, 1);
  clock += 2 * 60_000;
  const stale = await liveFxRates(LIVE, request, () => clock);
  assert.equal(stale.rates.EGP, 50.25, 'later requests answer at once while it refreshes');
  await new Promise((r) => setTimeout(r, 5));
  assert.equal((await liveFxRates(LIVE, request, () => clock)).rates.EGP, 51);
  assert.equal(calls.filter((u) => u === FX_SOURCE_URL).length, 2);
  resetLiveFx();
});

test('offline, a bad answer, tests and the off switch keep the published or bundled rates', async () => {
  resetLiveFx();
  const down = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
  assert.equal((await liveFxRates(LIVE, down)).rates.EGP, BUNDLED_FX.rates.EGP);
  resetLiveFx();
  const never = (async () => { throw new Error('must not be called'); }) as unknown as typeof fetch;
  assert.equal((await liveFxRates({}, never)).updatedAt, BUNDLED_FX.updatedAt, 'tests and dev: bundled copy, no request');
  let asked = false;
  const spy = (async (url: string) => { if (String(url) === FX_SOURCE_URL) asked = true; return json(undefined, false); }) as unknown as typeof fetch;
  await liveFxRates({ ...LIVE, SHAM_LIVE_FX: 'off' }, spy);
  assert.equal(asked, false, 'SHAM_LIVE_FX=off');
  resetLiveFx();
});

test('the checkout, «بنك شام» and the storefront use the server rates — no GitHub robot commits them', () => {
  const checkout = readFileSync(new URL('../server/checkout.ts', import.meta.url), 'utf8');
  assert.match(checkout, /liveFxRates\(env, request\)/);
  const finance = readFileSync(new URL('../server/finance/router.ts', import.meta.url), 'utf8');
  assert.equal((finance.match(/liveFxRates\(finance\.env, fetch\)/g) || []).length, 2);
  assert.doesNotMatch(finance, /loadLive\('fx-rates\.json'/);
  const app = readFileSync(new URL('../server/app.ts', import.meta.url), 'utf8');
  assert.match(app, /app\.get\('\/api\/fx'/);
  const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
  assert.equal(main.split('\n')[0], "import './utils/fxBoot';", 'adopted before any price is computed');
  const footer = readFileSync(new URL('../src/components/Footer.tsx', import.meta.url), 'utf8');
  assert.match(footer, /exchangerate-api\.com/, 'the rates service is credited');
});

const memoryStore = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }; };
const table = (iso: string, egp: number): FxTable & { updatedAt: string } => ({ base: 'USD', source: 'open.er-api.com', updatedAt: iso, rates: { USD: 1, EGP: egp, EUR: 0.91 } });

test('the storefront adopts kept rates only when newer and recent, and keeps the server’s newest for the next visit', async () => {
  const now = Date.parse('2026-11-12T10:00:00Z');
  const target = (): FxTable => ({ base: 'USD', updatedAt: '2026-11-05T00:00:00Z', rates: { USD: 1, EGP: 48, EUR: 0.9 } });
  const s = memoryStore();
  assert.equal(adoptKeptFx(s, target(), now), false, 'nothing kept');
  s.setItem(FX_STORE_KEY, JSON.stringify(table('2026-11-11T00:00:00Z', 50)));
  const t = target();
  assert.equal(adoptKeptFx(s, t, now), true);
  assert.equal(t.rates.EGP, 50); assert.equal(t.updatedAt, '2026-11-11T00:00:00Z');
  s.setItem(FX_STORE_KEY, JSON.stringify(table('2026-11-01T00:00:00Z', 47)));
  assert.equal(adoptKeptFx(s, target(), now), false, 'older than the build');
  s.setItem(FX_STORE_KEY, JSON.stringify(table('2026-11-11T00:00:00Z', 50)));
  assert.equal(adoptKeptFx(s, target(), now + FX_MAX_AGE_MS), false, 'too old to trust');
  s.setItem(FX_STORE_KEY, '{bad json');
  assert.equal(adoptKeptFx(s, target(), now), false);

  const k = memoryStore();
  const serve = (body: unknown) => (async () => json(body)) as unknown as typeof fetch;
  assert.equal(await keepServerFx(serve(table('2026-11-12T00:00:00Z', 50.5)), k), true);
  assert.equal(JSON.parse(k.getItem(FX_STORE_KEY)!).rates.EGP, 50.5);
  assert.equal(await keepServerFx(serve(table('2026-11-10T00:00:00Z', 49)), k), false, 'never replaced by an older table');
  assert.equal(await keepServerFx(serve({ base: 'EUR' }), k), false);
  assert.equal(await keepServerFx((async () => { throw new Error('x'); }) as unknown as typeof fetch, k), false);
  assert.equal(JSON.parse(k.getItem(FX_STORE_KEY)!).rates.EGP, 50.5);
});
