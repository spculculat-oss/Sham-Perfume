/**
 * «أسعار الصرف الحية»: the day's exchange rates, read by the site's own server.
 *
 * Until 2026-11 a GitHub robot fetched them every two hours and committed src/data/live/fx-rates.json. GitHub
 * Actions now only builds, tests and deploys (docs/ROBOT_DISTRIBUTION.md), so the server asks the public rates
 * service itself: at most once every 6 hours per running instance, kept in memory, with no commit and no GitHub
 * run. The checkout, «بنك شام» and the storefront (GET /api/fx) use the newest of: this answer, the published
 * repository file and the copy bundled in the build. Offline or a bad answer keeps the previous table.
 */
import { BUNDLED_FX, isFxTable, type FxTable } from '../../src/utils/pricing';
import { liveDataEnabled, loadLive } from './liveData';

type Env = Record<string, string | undefined>;
export type DatedFx = FxTable & { updatedAt: string };

export const FX_SOURCE_URL = 'https://open.er-api.com/v6/latest/USD';
export const FX_FRESH_MS = 6 * 3_600_000;
const FX_RETRY_MS = 30 * 60_000;

/** The rates service's answer → our table (USD base, ≥100 currencies, a positive EGP rate), or undefined. */
export function fxFromSource(data: unknown): DatedFx | undefined {
  const d = data as { result?: string; time_last_update_unix?: number; rates?: Record<string, unknown> } | undefined;
  if (!d || typeof d !== 'object' || d.result !== 'success' || !d.rates || typeof d.rates !== 'object') return undefined;
  const at = Number(d.time_last_update_unix);
  if (!Number.isFinite(at) || at <= 0) return undefined;
  const rates = Object.fromEntries(
    Object.entries(d.rates).filter(([code, v]) => /^[A-Z]{3}$/.test(code) && typeof v === 'number' && Number.isFinite(v) && v > 0),
  ) as Record<string, number>;
  const table = { base: 'USD', source: 'open.er-api.com', updatedAt: new Date(at * 1000).toISOString().replace(/\.\d+Z$/, 'Z'), rates };
  return isFxTable(table) && Object.keys(rates).length >= 100 ? table : undefined;
}

const newer = (a: DatedFx, b: DatedFx | undefined) => (b && Date.parse(b.updatedAt) > Date.parse(a.updatedAt) ? b : a);

type Entry = { at: number; data?: DatedFx; pending?: Promise<void> };
const memory = ((globalThis as { __shamLiveFx?: Entry }).__shamLiveFx ??= { at: 0 });

/** Forget the in-memory answer (tests). */
export function resetLiveFx() { memory.at = 0; memory.data = undefined; memory.pending = undefined; }

/** On where the site is really served; SHAM_LIVE_FX=off turns the direct request off (the repository file still counts). */
export const liveFxEnabled = (env: Env) => liveDataEnabled(env) && env.SHAM_LIVE_FX?.trim().toLowerCase() !== 'off';

export async function liveFxRates(env: Env = process.env, request: typeof fetch = fetch, now: () => number = Date.now): Promise<DatedFx> {
  const bundled: DatedFx = { ...BUNDLED_FX, updatedAt: BUNDLED_FX.updatedAt || '1970-01-01T00:00:00Z' };
  const published = await loadLive('fx-rates.json', bundled, isFxTable, env, request).catch(() => bundled);
  if (!liveFxEnabled(env)) return published;
  if (now() - memory.at > FX_FRESH_MS && !memory.pending) {
    const job = (async () => {
      try {
        const response = await request(FX_SOURCE_URL, { signal: AbortSignal.timeout(3000) });
        const table = response.ok ? fxFromSource(await response.json()) : undefined;
        if (table) { memory.data = newer(table, memory.data); memory.at = now(); }
        else memory.at = now() - FX_FRESH_MS + FX_RETRY_MS;
      } catch { memory.at = now() - FX_FRESH_MS + FX_RETRY_MS; }
    })();
    memory.pending = job;
    void job.finally(() => { if (memory.pending === job) memory.pending = undefined; });
    // Only the first request after a cold start waits (briefly); later ones answer at once while it refreshes.
    if (!memory.data) await job;
  }
  return newer(published, memory.data);
}
