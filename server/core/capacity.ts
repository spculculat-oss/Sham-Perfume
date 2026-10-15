/**
 * Capacity layer for «الخبير شاهين» — keeps the expert answering when a thousand visitors ask at once.
 *
 * The web tier scales by itself (Vercel / EdgeOne run as many instances as needed); the scarce
 * resource is the AI provider's quota (requests per minute per project). This module spends that
 * quota carefully:
 *
 *  - AnswerCache: the first question of a conversation (no history) in the same language, mode and
 *    settings is answered from memory. Most visitors click the same suggested questions.
 *  - single flight: identical questions asked at the same moment share ONE provider call.
 *  - ProviderGate: a per-provider circuit breaker + bounded concurrency. After a 429 the provider is
 *    left alone for the delay it asked for; then a single probe goes first and every success doubles
 *    how many requests may run at once (1, 2, 4 … up to the cap) — "slow start", so the queue does
 *    not stampede the quota again. Requests wait in line (bounded) instead of failing or hammering.
 *
 * Everything is in-memory per server instance (no extra service to run). With Fluid compute one
 * instance serves many concurrent visitors, so the cache and the queue are shared by all of them.
 */
import { createHash } from 'node:crypto';

type Env = Record<string, string | undefined>;

/** Same question, written slightly differently → same cache entry (case, spaces, tashkeel, ?!). */
export function normalizeQuestion(text: string): string {
  return text.normalize('NFKC').toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // Arabic diacritics and tatweel
    .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي')
    .replace(/[\s\u200c\u200f\u200e]+/g, ' ')
    .replace(/^[\s?!.,؟،؛:…]+|[\s?!.,؟،؛:…]+$/g, '')
    .trim();
}

export const cacheKey = (parts: unknown[]) => createHash('sha256').update(JSON.stringify(parts)).digest('base64url');

interface Entry<T> { value: T; expires: number }

/** LRU + TTL cache with single-flight loading. */
export class AnswerCache<T> {
  private entries = new Map<string, Entry<T>>();
  private loading = new Map<string, Promise<T>>();
  hits = 0; misses = 0; shared = 0;
  constructor(private maxEntries = 2000, private ttlMs = 6 * 3600_000) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expires <= Date.now()) { this.entries.delete(key); return undefined; }
    this.entries.delete(key); this.entries.set(key, entry); // most recently used last
    return entry.value;
  }

  set(key: string, value: T) {
    this.entries.delete(key);
    this.entries.set(key, { value, expires: Date.now() + this.ttlMs });
    while (this.entries.size > this.maxEntries) this.entries.delete(this.entries.keys().next().value!);
  }

  /**
   * Cached value, or the result of `load` — shared by everyone asking for the same key meanwhile.
   * `load` must not depend on one visitor's abort signal (the others are waiting for it too).
   */
  async getOrLoad(key: string, load: () => Promise<T>, keep: (value: T) => boolean = () => true): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) { this.hits++; return cached; }
    const pending = this.loading.get(key);
    if (pending) { this.shared++; return pending; }
    this.misses++;
    const promise = load().then((value) => { if (keep(value)) this.set(key, value); return value; })
      .finally(() => this.loading.delete(key));
    this.loading.set(key, promise);
    return promise;
  }

  get size() { return this.entries.size; }
  clear() { this.entries.clear(); }
}

export class GateBusyError extends Error {
  constructor(public retryAfterMs: number) { super('All AI providers are busy'); this.name = 'GateBusyError'; }
}

interface ProviderState {
  inFlight: number; cooldownUntil: number; limitedCount: number; lastLimitAt: number; lastDecreaseAt: number;
  /** Requests per minute this provider accepts from this instance: configured, or learned from its 429s. */
  rpm?: number;
  starts: number[]; successes: number[]; // timestamps within the last minute
}
const MINUTE = 60_000;
const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted) { reject(signal.reason); return; }
  const timer = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve(); }, ms);
  const onAbort = () => { clearTimeout(timer); reject(signal!.reason); };
  signal?.addEventListener('abort', onAbort, { once: true });
});

/** Seconds from a provider's "retry in 23s" / "retry in 1.5s" hint (see failureDetail in engines.ts). */
export function retryHintMs(detail: string | undefined): number | undefined {
  const match = detail?.match(/retry in (\d+(?:\.\d+)?)s/);
  return match ? Math.round(Number(match[1]) * 1000) : undefined;
}

/**
 * Per-provider circuit breaker + rate pacing. AI quotas are "N requests per minute", so the gate paces
 * requests per minute the way TCP paces packets (AIMD): a 429 cuts the pace by 30 % (at most once per
 * 5 s, so one burst of refusals counts once), every answer raises it by one. It settles at what the
 * provider really accepts. A known quota can be set up front instead (SHAM_GEMINI_RPM …). `run` picks the first candidate that may start now, or waits (up to
 * `maxWaitMs`) for one to open; GateBusyError if none does.
 */
export class ProviderGate {
  private states = new Map<string, ProviderState>();
  constructor(public maxConcurrent = 200, public maxWaitMs = 20_000, private configuredRpm: Record<string, number> = {}, private pollMs = 250) {}

  private state(id: string, now = Date.now()): ProviderState {
    let s = this.states.get(id);
    if (!s) this.states.set(id, s = { inFlight: 0, cooldownUntil: 0, limitedCount: 0, lastLimitAt: 0, lastDecreaseAt: 0, rpm: this.configuredRpm[id], starts: [], successes: [] });
    while (s.starts.length && now - s.starts[0] >= MINUTE) s.starts.shift();
    while (s.successes.length && now - s.successes[0] >= MINUTE) s.successes.shift();
    return s;
  }

  /** Can this provider take one more request right now? */
  canStart(id: string, now = Date.now()): boolean {
    const s = this.state(id, now);
    return now >= s.cooldownUntil && s.inFlight < this.maxConcurrent && (s.rpm === undefined || s.starts.length < s.rpm);
  }

  /** The provider refused for quota/rate reasons: pause it and pace it to what it really accepts. */
  limited(id: string, retryMs?: number) {
    const now = Date.now();
    const s = this.state(id, now);
    s.limitedCount++;
    s.lastLimitAt = now;
    if (this.configuredRpm[id] === undefined && now - s.lastDecreaseAt > 5_000) {
      // First refusal: half of what was attempted this minute; afterwards ×0.7 per refusal burst.
      s.rpm = s.rpm === undefined ? Math.max(1, Math.ceil(s.starts.length / 2)) : Math.max(1, Math.floor(s.rpm * 0.7));
      s.lastDecreaseAt = now;
    }
    // Honour the provider's hint, else back off exponentially while refusals continue (2 s → 60 s).
    const backoff = Math.min(MINUTE, 2_000 * 2 ** Math.min(5, s.limitedCount - 1));
    s.cooldownUntil = Math.max(s.cooldownUntil, now + Math.min(120_000, Math.max(1_000, retryMs ?? backoff)));
  }

  succeeded(id: string) {
    const now = Date.now();
    const s = this.state(id, now);
    s.successes.push(now);
    s.limitedCount = 0;
    // Additive increase: each answer lets one more request per minute through (quotas can grow).
    if (s.rpm !== undefined && this.configuredRpm[id] === undefined && now - s.lastLimitAt > 5_000) s.rpm = Math.min(1_000_000, s.rpm + 1);
  }

  /** Milliseconds until this provider may start a request (0 = now). */
  private openingIn(id: string, now = Date.now()): number {
    const s = this.state(id, now);
    let wait = Math.max(0, s.cooldownUntil - now);
    if (s.rpm !== undefined && s.starts.length >= s.rpm) wait = Math.max(wait, s.starts[s.starts.length - s.rpm] + MINUTE - now);
    return wait;
  }

  /** Earliest moment one of the candidates may open (for Retry-After). */
  nextOpening(ids: string[]): number {
    const now = Date.now();
    return Math.max(0, Math.min(...ids.map((id) => this.openingIn(id, now))));
  }

  /**
   * Runs `attempt(id)` on the first open candidate, in order. `attempt` returns 'ok' (done), 'next'
   * (that provider failed, try the following one) or 'limited' (quota hit: provider is paced and the
   * next one is tried). Waits for a provider to open when all are paused, paced or saturated.
   */
  async run<T, Id extends string = string>(candidates: Id[], attempt: (id: Id) => Promise<{ outcome: 'ok'; value: T } | { outcome: 'next' | 'limited'; retryMs?: number }>,
    signal?: AbortSignal): Promise<T | undefined> {
    const tried = new Set<Id>();
    const deadline = Date.now() + this.maxWaitMs;
    for (;;) {
      if (signal?.aborted) throw signal.reason;
      const open = candidates.find((id) => !tried.has(id) && this.canStart(id));
      if (open) {
        const s = this.state(open);
        const startedAt = Date.now();
        s.inFlight++; s.starts.push(startedAt);
        let result: Awaited<ReturnType<typeof attempt>>;
        try { result = await attempt(open); } finally { s.inFlight--; }
        if (result.outcome === 'ok') { this.succeeded(open); return result.value; }
        if (result.outcome === 'limited') {
          // A refused request used no quota: it must not count against the pace.
          const index = s.starts.lastIndexOf(startedAt);
          if (index >= 0) s.starts.splice(index, 1);
          this.limited(open, result.retryMs);
          continue; // may reopen later
        }
        tried.add(open); // a real failure: do not retry this provider for this question
        continue;
      }
      const remaining = candidates.filter((id) => !tried.has(id));
      if (!remaining.length) return undefined; // every provider answered with a real failure
      const opening = this.nextOpening(remaining);
      if (Date.now() + opening > deadline) throw new GateBusyError(Math.max(1_000, opening));
      const wait = Math.max(this.pollMs, Math.min(opening || this.pollMs, 2_000));
      await sleep(wait * (0.8 + Math.random() * 0.4), signal); // jitter: waiters do not wake in lockstep
    }
  }

  snapshot() {
    const now = Date.now();
    return Object.fromEntries([...this.states.keys()].map((id) => {
      const s = this.state(id, now);
      return [id, { inFlight: s.inFlight, coolingMs: Math.max(0, s.cooldownUntil - now), rpm: s.rpm ?? null, startedLastMinute: s.starts.length }];
    }));
  }
}

const num = (raw: string | undefined, fallback: number, min: number, max: number) => {
  const n = Number(raw);
  return Number.isFinite(n) && raw?.trim() ? Math.min(max, Math.max(min, n)) : fallback;
};

/** Capacity settings (all optional) — see README «السعة والزوار المتزامنون». */
export function capacityConfig(env: Env) {
  return {
    cacheTtlMs: num(env.SHAM_ANSWER_CACHE_MINUTES, 360, 0, 7 * 24 * 60) * 60_000,
    cacheEntries: num(env.SHAM_ANSWER_CACHE_ENTRIES, 2000, 0, 50_000),
    maxConcurrent: num(env.SHAM_PROVIDER_MAX_CONCURRENT, 300, 1, 900),
    queueWaitMs: num(env.SHAM_QUEUE_WAIT_SECONDS, 20, 0, 50) * 1000,
    perVisitorPerMin: num(env.SHAM_SHAHEEN_RATE_PER_MIN, 10, 1, 1000),
    perIpPerMin: num(env.SHAM_SHAHEEN_RATE_PER_IP_MIN, 300, 1, 100_000),
    /** Known quota per provider and minute, e.g. SHAM_GEMINI_RPM=1000 (otherwise learned from 429s). */
    providerRpm: Object.fromEntries(['gemini', 'deepseek', 'openai', 'claude', 'self_hosted', 'openrouter']
      .map((id) => [id, num(env[`SHAM_${id.toUpperCase()}_RPM`], NaN, 1, 1_000_000)])
      .filter(([, rpm]) => Number.isFinite(rpm))) as Record<string, number>,
  };
}

/** Anonymous per-browser id (random, set by the site) — lets visitors behind one shared IP be told apart. */
export const VISITOR_ID = /^[A-Za-z0-9_-]{8,64}$/;
