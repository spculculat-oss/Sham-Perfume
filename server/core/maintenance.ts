/**
 * Runtime view of «الخبير شاهين» for the maintenance agent (scripts/doctor, «طبيب شاهين»).
 *
 * The chat router records the outcome of every visitor message here (status, code, time) — a few numbers
 * in a bounded ring, no visitor text — and exposes its capacity parts (provider gate, answer cache) so the
 * agent can read the health of THIS server instance and apply runtime remedies through the admin API:
 *   GET  /api/admin/maintenance           → snapshot (error rate, latency, providers pausing, cache)
 *   POST /api/admin/maintenance {action}  → clear_answer_cache | reset_provider_gate | refresh_model_list
 * Remedies are cheap and safe: they only drop in-memory state that is rebuilt on the next message.
 */
import type { AnswerCache, ProviderGate } from './capacity';
import { resetGeminiModelCaches } from './engines';

export interface ChatOutcome { at: number; ms: number; status: number; code?: string }
export const MAINTENANCE_ACTIONS = ['clear_answer_cache', 'reset_provider_gate', 'refresh_model_list'] as const;
export type MaintenanceAction = typeof MAINTENANCE_ACTIONS[number];

const KEEP_MS = 60 * 60_000;
const MAX_OUTCOMES = 5000;

const percentile = (sorted: number[], p: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0);

export class ShaheenRuntime {
  readonly startedAt = Date.now();
  private outcomes: ChatOutcome[] = [];
  private gate?: ProviderGate;
  private answers?: AnswerCache<unknown>;
  readonly remedies: { action: MaintenanceAction; at: string }[] = [];

  constructor(readonly version = 'dev') {}

  attach(parts: { gate?: ProviderGate; answers?: AnswerCache<unknown> }) {
    if (parts.gate) this.gate = parts.gate;
    if (parts.answers) this.answers = parts.answers;
  }

  record(outcome: Omit<ChatOutcome, 'at'> & { at?: number }) {
    this.outcomes.push({ at: Date.now(), ...outcome });
    if (this.outcomes.length > MAX_OUTCOMES) this.outcomes.splice(0, this.outcomes.length - MAX_OUTCOMES);
  }

  /** Visitor-message outcomes in the last `windowMs`. Rate-limited visitors (429) are not failures of Shaheen. */
  stats(windowMs = 10 * 60_000, now = Date.now()) {
    this.outcomes = this.outcomes.filter((o) => now - o.at <= KEEP_MS);
    const recent = this.outcomes.filter((o) => now - o.at <= windowMs);
    const served = recent.filter((o) => o.status !== 429);
    const ok = served.filter((o) => o.status === 200);
    const errors: Record<string, number> = {};
    for (const o of served) if (o.status !== 200) errors[o.code || String(o.status)] = (errors[o.code || String(o.status)] || 0) + 1;
    const times = ok.map((o) => o.ms).sort((a, b) => a - b);
    return {
      windowMinutes: Math.round(windowMs / 60_000),
      requests: recent.length,
      rateLimited: recent.length - served.length,
      answered: ok.length,
      errors,
      errorRate: served.length ? Math.round(((served.length - ok.length) / served.length) * 1000) / 1000 : 0,
      latencyMs: { p50: percentile(times, 0.5), p95: percentile(times, 0.95), max: times.at(-1) || 0 },
    };
  }

  snapshot(now = Date.now()) {
    const answers = this.answers;
    return {
      version: this.version,
      uptimeS: Math.round((now - this.startedAt) / 1000),
      window: this.stats(10 * 60_000, now),
      hour: this.stats(60 * 60_000, now),
      providers: this.gate?.snapshot() || {},
      answerCache: answers ? { entries: answers.size, hits: answers.hits, misses: answers.misses, shared: answers.shared } : null,
      remedies: this.remedies.slice(-10),
    };
  }

  act(action: MaintenanceAction): { action: MaintenanceAction; done: boolean } {
    if (action === 'clear_answer_cache') this.answers?.clear();
    else if (action === 'reset_provider_gate') this.gate?.reset();
    else if (action === 'refresh_model_list') resetGeminiModelCaches();
    this.remedies.push({ action, at: new Date().toISOString() });
    if (this.remedies.length > 50) this.remedies.shift();
    return { action, done: true };
  }
}

/** Short commit of the running deployment (Vercel sets VERCEL_GIT_COMMIT_SHA), so the agent can spot stale deploys. */
export const runningVersion = (env: Record<string, string | undefined>) =>
  (env.VERCEL_GIT_COMMIT_SHA || env.SHAM_VERSION || env.GITHUB_SHA || 'dev').trim().slice(0, 40) || 'dev';
