/**
 * The platform language follows the country the visit comes from by network — a VPN switched on counts, even
 * while the page is open — without a refresh. A language the visitor picked himself is never overridden.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { detectEntryLanguageAsync } from '../src/utils/geoDetector';

type Route = (url: string, signal?: AbortSignal | null) => Promise<Response>;
async function withFetch<T>(route: Route, run: () => Promise<T>): Promise<T> {
  const real = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => route(String(input), init?.signal)) as typeof fetch;
  try { return await run(); } finally { globalThis.fetch = real; }
}
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const later = (ms: number, value: () => Response, signal?: AbortSignal | null) => new Promise<Response>((done, fail) => {
  const t = setTimeout(() => done(value()), ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); fail(new Error('aborted')); });
});

test('our server\'s edge country answers first, even when the outside lookup is slow (a VPN)', async () => {
  const asked: string[] = [];
  const hit = await withFetch((url, signal) => {
    asked.push(url);
    return url.endsWith('/api/geo') ? later(10, () => json({ country: 'US', source: 'edge' }), signal) : later(3000, () => json({ country: 'EG' }), signal);
  }, () => detectEntryLanguageAsync());
  assert.deepEqual(hit, { language: 'en', countryCode: 'US', source: 'edge' });
  assert.ok(asked.some((u) => u.endsWith('/api/geo')));
});

test('the outside lookup covers a server that does not know the country', async () => {
  const hit = await withFetch((url, signal) => (url.endsWith('/api/geo') ? later(5, () => json({ country: null, source: 'unknown' }), signal) : later(30, () => json({ country: 'fr' }), signal)),
    () => detectEntryLanguageAsync());
  assert.deepEqual(hit, { language: 'fr', countryCode: 'FR', source: 'ip' });
});

test('a lookup slower than the old 1.2s budget still counts', async () => {
  const hit = await withFetch((url, signal) => (url.endsWith('/api/geo') ? later(1600, () => json({ country: 'DE' }), signal) : Promise.reject(new Error('blocked'))),
    () => detectEntryLanguageAsync());
  assert.equal(hit?.language, 'de');
});

test('no answer in time → null (the language showing stays), never an old stored country', async () => {
  const hit = await withFetch((_url, signal) => later(10_000, () => json({ country: 'US' }), signal), () => detectEntryLanguageAsync(100));
  assert.equal(hit, null);
  const broken = await withFetch(() => Promise.resolve(new Response('nope', { status: 500 })), () => detectEntryLanguageAsync());
  assert.equal(broken, null);
});

test('the app asks again on return to the tab / a network change, and keeps a manual pick', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.ok(app.includes('watchEntryCountry(refine)'), 'the entry country is re-checked without a refresh');
  assert.ok(app.includes('!hasOverride && hit.language !== langRef.current'), 'a manual pick is never overridden; the current language is read fresh');
  const geo = readFileSync(new URL('../src/utils/geoDetector.ts', import.meta.url), 'utf8');
  for (const event of ["'online'", "'focus'", "'visibilitychange'"]) assert.ok(geo.includes(event), event);
});
