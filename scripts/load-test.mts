/**
 * Load test for «الخبير شاهين»: N visitors ask at (almost) the same time, through the real Express
 * router, against a simulated AI provider that behaves like Gemini (latency + a per-minute quota per
 * model that answers 429 RESOURCE_EXHAUSTED). Visitors behave like the site's chat client.
 *
 *   node --import tsx scripts/load-test.mts                      # 1000 visitors, paid-tier quota
 *   VISITORS=1000 PROVIDER_RPM=15 node --import tsx scripts/load-test.mts      # free-tier quota
 *   NAT_IPS=20 node --import tsx scripts/load-test.mts           # visitors share 20 IPs (mobile CGNAT)
 *
 * Env: VISITORS (1000), SPREAD_S (seconds over which they arrive, 5), PROVIDER_RPM (per model per
 * minute, 2000), LATENCY_MS ("1200-3500"), PRESET_SHARE (0.6 = share asking a suggested question),
 * NAT_IPS (0 = every visitor has its own IP), JSON=1 prints a machine-readable summary.
 */
import type { AddressInfo } from 'node:net';
import express from 'express';
import { Repository } from '../server/core/repository';
import { MemoryStore } from '../server/core/store';
import { createShaheenRouter } from '../server/shaheen';

const VISITORS = Number(process.env.VISITORS || 1000);
const SPREAD_S = Number(process.env.SPREAD_S ?? 5);
const PROVIDER_RPM = Number(process.env.PROVIDER_RPM || 2000);
const [LAT_MIN, LAT_MAX] = (process.env.LATENCY_MS || '1200-3500').split('-').map(Number);
const PRESET_SHARE = Number(process.env.PRESET_SHARE ?? 0.6);
const NAT_IPS = Number(process.env.NAT_IPS || 0);

// The site's suggested-question chips: many visitors click the same ones.
const PRESETS = ['ما الفرق بين EDP و EDT؟', 'كيف أثبّت رائحة العطر أطول؟', 'اقترح تركيبة عود وورد', 'ما هو المسك الأبيض؟',
  'كم نسبة الزيت في 50 مل؟', 'لماذا تعكّر عطري؟', 'ما أفضل كحول للعطور؟', 'كيف أعتّق العطر؟'];

// ---------- simulated provider (Gemini-like) ----------
const stats = { calls: 0, ok: 0, refused429: 0, listCalls: 0, inFlight: 0, maxInFlight: 0 };
const windows = new Map<string, number[]>(); // model → timestamps of accepted calls (sliding minute)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];

const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  if (!url.includes('generativelanguage.googleapis.com')) throw new Error(`unexpected request ${url}`);
  if (/\/models\?/.test(url)) {
    stats.listCalls++;
    await sleep(150);
    return json({ models: MODELS.map((m) => ({ name: `models/${m}`, supportedGenerationMethods: ['generateContent'], inputTokenLimit: 1_000_000 })) });
  }
  const model = decodeURIComponent(url.match(/\/models\/([^:]+):/)?.[1] || '');
  stats.calls++;
  const now = Date.now();
  const recent = (windows.get(model) || []).filter((t) => now - t < 60_000);
  if (recent.length >= PROVIDER_RPM) {
    windows.set(model, recent);
    stats.refused429++;
    await sleep(80);
    return json({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: `${Math.ceil((60_000 - (now - recent[0])) / 1000)}s` }] } }, 429);
  }
  recent.push(now); windows.set(model, recent);
  stats.inFlight++; stats.maxInFlight = Math.max(stats.maxInFlight, stats.inFlight);
  try {
    await sleep(LAT_MIN + Math.random() * (LAT_MAX - LAT_MIN));
    if (init?.signal?.aborted) throw init.signal.reason;
    stats.ok++;
    return json({ candidates: [{ content: { parts: [{ text: `### إجابة شاهين\nرد تجريبي (${model}).` }] } }] });
  } finally { stats.inFlight--; }
}) as typeof fetch;

// ---------- server under test ----------
const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '128kb' }));
app.use('/api', createShaheenRouter({ repo: new Repository(new MemoryStore(), {}), env: { GEMINI_API_KEY: 'load-test-key' }, fetch: fakeFetch }));
const server = app.listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
server.maxConnections = 100_000;
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

// ---------- visitors (behave like src/utils/chatStore.ts) ----------
interface Outcome { status: number; code?: string; ms: number; attempts: number }
const ipOf = (i: number) => NAT_IPS ? `10.0.${Math.floor((i % NAT_IPS) / 250)}.${(i % NAT_IPS) % 250 + 1}` : `10.${Math.floor(i / 65025) % 255}.${Math.floor(i / 255) % 255}.${i % 255 + 1}`;
const visitorIds = Array.from({ length: VISITORS }, (_, i) => `v${i.toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

async function visitor(i: number): Promise<Outcome> {
  await sleep(Math.random() * SPREAD_S * 1000);
  const message = Math.random() < PRESET_SHARE ? PRESETS[i % PRESETS.length] : `سؤال خاص رقم ${i}: ما رأيك في تركيبة ${i % 97} من العنبر؟`;
  const started = Date.now();
  let attempts = 0;
  for (;;) {
    attempts++;
    let status = 0; let code: string | undefined; let retryAfter = 0;
    try {
      const response = await fetch(`${base}/api/chat`, {
        method: 'POST', signal: AbortSignal.timeout(90_000),
        headers: { 'content-type': 'application/json', 'x-forwarded-for': ipOf(i), 'x-sham-visitor': visitorIds[i] },
        body: JSON.stringify({ message, model: 'auto', language: 'ar', conversationHistory: [] }),
      });
      status = response.status;
      const body = await response.json().catch(() => ({})) as { code?: string; reply?: string };
      code = body.code; retryAfter = Number(response.headers.get('retry-after')) || 0;
      if (response.ok && body.reply) return { status, ms: Date.now() - started, attempts };
    } catch (error) { code = (error as Error).name; }
    // The client retries by itself only when the server says "busy, come back" (SHAHEEN_BUSY).
    if (code === 'SHAHEEN_BUSY' && attempts < 4) { await sleep((retryAfter || 5) * 1000 * (0.75 + Math.random() * 0.5)); continue; }
    return { status, code, ms: Date.now() - started, attempts };
  }
}

const t0 = Date.now();
const outcomes = await Promise.all(Array.from({ length: VISITORS }, (_, i) => visitor(i)));
server.close();
const answered = outcomes.filter((o) => o.status === 200);
const failures: Record<string, number> = {};
for (const o of outcomes) if (o.status !== 200) failures[`${o.status} ${o.code || ''}`.trim()] = (failures[`${o.status} ${o.code || ''}`.trim()] || 0) + 1;
const pct = (sorted: number[], p: number) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0;
const lat = answered.map((o) => o.ms).sort((a, b) => a - b);
const summary = {
  visitors: VISITORS, arrivalSpreadS: SPREAD_S, providerRpmPerModel: PROVIDER_RPM, natIps: NAT_IPS || 'none',
  answered: answered.length, answeredPct: Math.round(answered.length / VISITORS * 1000) / 10,
  failures, latencyMs: { p50: pct(lat, 0.5), p95: pct(lat, 0.95), max: lat.at(-1) || 0 },
  retriedVisitors: outcomes.filter((o) => o.attempts > 1).length,
  provider: { calls: stats.calls, answered: stats.ok, refused429: stats.refused429, modelListCalls: stats.listCalls, maxConcurrent: stats.maxInFlight },
  wallS: Math.round((Date.now() - t0) / 100) / 10,
};
if (process.env.JSON) console.log(JSON.stringify(summary));
else console.log(JSON.stringify(summary, null, 2));
process.exit(0);
