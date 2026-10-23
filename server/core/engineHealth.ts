/**
 * «صحة المحركات»: Shaheen remembers which AI engine is failing and why, parks it until it is worth trying again,
 * and sends visitors to the engines that work. A parked engine is never dropped: it moves to the end of the line
 * (still a last resort), and after its time is up the next message tries it again — the first success brings it
 * straight back. No visitor ever waits on an engine known to be down.
 *
 *  invalid_key / no_credit / region_blocked … long pauses (the key, the balance or the country must change)
 *  model_not_found                         … an hour (the Gemini code also looks for another model by itself)
 *  rate_limited                            … the provider's «retry in Ns», else a minute
 *  upstream_error / timeout / empty / bad_request … only after two failures in a row, for a few minutes
 */
import { createHash } from 'node:crypto';
import type { EngineFailure } from './engines';

export type HealthFailure = EngineFailure | 'timeout' | 'empty';
export interface EngineHealthEntry {
  state: 'ok' | 'parked' | 'failing';
  failures: number;
  reason?: HealthFailure;
  parkedUntil?: string;
  lastOkAt?: string;
  lastFailAt?: string;
}

const MIN = 60_000;
/** Next daily renewal of the free quotas (midnight Pacific ≈ 07:00–08:00 UTC): 08:05 UTC. */
export function nextDailyRenewal(now: number): number {
  const next = new Date(now); next.setUTCHours(8, 5, 0, 0);
  if (next.getTime() <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime();
}

/** How long to park an engine after this failure (0 = do not park yet). `streak` counts failures in a row. */
export function parkFor(failure: HealthFailure, detail: string, streak: number, now: number): number {
  const retry = /retry (?:in|after) (\d+(?:\.\d+)?)\s*s/i.exec(detail);
  switch (failure) {
    case 'invalid_key': return 30 * MIN; // re-checked twice an hour: a new key is picked up without waiting long
    case 'no_credit': return /PerDay|per day|daily/i.test(detail) ? Math.min(nextDailyRenewal(now) - now, 12 * 60 * MIN) : 60 * MIN;
    case 'region_blocked': return 6 * 60 * MIN;
    case 'model_not_found': return 60 * MIN;
    case 'rate_limited': return retry ? Math.max(30_000, Math.ceil(Number(retry[1]) * 1000) + 5_000) : MIN;
    // A slow answer is not a dead engine: Shaheen's own time limit cut it. Parked only after three in a row, and
    // briefly — parking it longer made every visitor skip a platform that works (the owner's «Gemini works but is
    // not linked to Shaheen»).
    case 'timeout': return streak >= 3 ? Math.min(3 * MIN, MIN * (streak - 2)) : 0;
    default: return streak >= 2 ? Math.min(10 * MIN, 2 * MIN * (streak - 1)) : 0;
  }
}

export class EngineHealth {
  private entries = new Map<string, { failures: number; reason?: HealthFailure; parkedUntil: number; lastOkAt?: number; lastFailAt?: number }>();
  constructor(private now: () => number = Date.now) {}

  private entry(id: string) {
    let e = this.entries.get(id);
    if (!e) { e = { failures: 0, parkedUntil: 0 }; this.entries.set(id, e); }
    return e;
  }

  ok(id: string) {
    const e = this.entry(id);
    e.failures = 0; e.reason = undefined; e.parkedUntil = 0; e.lastOkAt = this.now();
  }

  fail(id: string, failure: HealthFailure, detail = '') {
    const e = this.entry(id);
    const at = this.now();
    e.failures += 1; e.reason = failure; e.lastFailAt = at;
    const ms = parkFor(failure, detail, e.failures, at);
    if (ms > 0) e.parkedUntil = Math.max(e.parkedUntil, at + ms);
  }

  /** 0 when the engine may be tried now. */
  parkedUntil(id: string): number {
    const t = this.entries.get(id)?.parkedUntil || 0;
    return t > this.now() ? t : 0;
  }

  /** The engines to try, in order: the working ones first (admin order kept), then the parked ones, soonest back first. */
  order<T extends string>(ids: readonly T[]): T[] {
    const ready = ids.filter((id) => !this.parkedUntil(id));
    const parked = ids.filter((id) => this.parkedUntil(id)).sort((a, b) => this.parkedUntil(a) - this.parkedUntil(b));
    return [...ready, ...parked];
  }

  snapshot(ids?: readonly string[]): Record<string, EngineHealthEntry> {
    const iso = (t?: number) => (t ? new Date(t).toISOString() : undefined);
    const out: Record<string, EngineHealthEntry> = {};
    for (const id of ids || [...this.entries.keys()]) {
      const e = this.entries.get(id);
      if (!e) continue;
      const parked = this.parkedUntil(id);
      out[id] = {
        state: parked ? 'parked' : e.failures ? 'failing' : 'ok', failures: e.failures,
        ...(e.reason ? { reason: e.reason } : {}), ...(parked ? { parkedUntil: iso(parked) } : {}),
        ...(e.lastOkAt ? { lastOkAt: iso(e.lastOkAt) } : {}), ...(e.lastFailAt ? { lastFailAt: iso(e.lastFailAt) } : {}),
      };
    }
    return out;
  }

  /** Parks an engine known to be down elsewhere (the bots' quota file) — the first success still brings it back. */
  park(id: string, until: number, reason: HealthFailure) {
    if (until <= this.now()) return;
    const e = this.entry(id);
    e.reason = reason; e.failures = Math.max(1, e.failures); e.parkedUntil = Math.max(e.parkedUntil, until);
  }

  reset() { this.entries.clear(); }
}

/** The environment variables holding each engine's key (same list as the bots' fingerprint, scripts/doctor/agent.ts). */
const ENGINE_KEY_VARS: Record<string, string[]> = {
  gemini: ['GEMINI_API_KEY'], openai: ['OPENAI_API_KEY'], claude: ['ANTHROPIC_API_KEY'], deepseek: ['DEEPSEEK_API_KEY'],
  openrouter: ['OPENROUTER_API_KEY'], perplexity: ['PERPLEXITY_API_KEY'], self_hosted: ['SHAM_LLM_BASE_URL', 'SHAM_LLM_API_KEY', 'AI_GATEWAY_API_KEY'],
};
/** 8 hex characters of a SHA-256 of the key (never reversible) — a new key gives a new fingerprint. */
export function keyPrint(env: Record<string, string | undefined>, id: string): string {
  const parts = (ENGINE_KEY_VARS[id] || []).map((name) => (env[name] || '').trim());
  if (!parts.some(Boolean)) return '';
  return createHash('sha256').update(parts.join('\u0000')).digest('hex').slice(0, 8);
}

/**
 * Every server instance used to start with an empty health record, so after each cold start the first visitors
 * waited on engines the bots already knew were dead (a key out of credit, an invalid key). The bots' quota file
 * (src/data/live/ai-quota.json) now seeds it: an engine paused for its KEY (no credit / invalid) stays parked —
 * only while the key is the same one (a new key in GitHub changes the fingerprint and the pause is ignored).
 * A «chat_reserve» pause is the bots keeping the quota FOR the chat, so it never parks the chat.
 */
export function seedQuotaPauses(health: EngineHealth, file: unknown, env: Record<string, string | undefined>, now = Date.now()): string[] {
  const engines = (file && typeof file === 'object' ? (file as { engines?: unknown }).engines : undefined) as Record<string, { pausedUntil?: string; reason?: string; key?: string }> | undefined;
  if (!engines || typeof engines !== 'object') return [];
  const parked: string[] = [];
  for (const [id, p] of Object.entries(engines)) {
    if (!p || (p.reason !== 'no_credit' && p.reason !== 'invalid_key')) continue;
    const until = Date.parse(p.pausedUntil || '');
    if (!(until > now)) continue;
    const print = keyPrint(env, id);
    if (!print || (p.key && p.key !== print)) continue;
    health.park(id, until, p.reason);
    parked.push(id);
  }
  return parked;
}
