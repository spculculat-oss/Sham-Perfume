/** On-demand, bounded knowledge spider. Only the researcher's official public API is allowed.
 * Caches public documents, never questions/answers or personal information. No background crawling.
 */
import { research, researchQueries, type Research } from './webResearch';

type Request = Parameters<typeof research>[0];
export interface SpiderOptions {
  ttlMs?: number;
  maxEntries?: number;
  concurrency?: number;
  now?: () => number;
  userAgent?: string;
  timeoutMs?: number;
}

export function createResearchSpider(request: Request, options: SpiderOptions = {}) {
  const now = options.now ?? Date.now;
  const ttl = Math.max(1, options.ttlMs ?? 15 * 60_000);
  const capacity = Math.max(1, Math.min(500, options.maxEntries ?? 150));
  const concurrency = Math.max(1, Math.min(6, options.concurrency ?? 3));
  const cache = new Map<string, { body: string; expires: number }>();
  const pending = new Map<string, Promise<string>>();
  // Per-origin backoff: one language's quota does not disable another Wikipedia API.
  const cooldowns = new Map<string, number>();
  const deferSource = (origin: string, retryAfter: string | null) => {
    const seconds = retryAfter?.trim();
    const deadline = seconds && /^\d+$/.test(seconds)
      ? now() + Number(seconds) * 1000
      : seconds ? Date.parse(seconds) : NaN;
    const until = Number.isFinite(deadline) && deadline > now() ? deadline : now() + 60_000;
    cooldowns.set(origin, Math.max(cooldowns.get(origin) ?? 0, until));
  };
  const checkSource = (origin: string) => {
    if ((cooldowns.get(origin) ?? 0) > now()) throw new Error('Source cooling down');
    cooldowns.delete(origin);
  };
  let active = 0;
  const waiting: Array<() => void> = [];
  const stats = { hits: 0, requests: 0, failures: 0 };

  const cachedFetch: Request = async (url, init) => {
    const target = new URL(url);
    if (target.protocol !== 'https:' || !/^[a-z]{2}\.wikipedia\.org$/.test(target.hostname)
      || target.pathname !== '/w/api.php' || target.port || target.username || target.password
      || target.searchParams.get('action') !== 'query') throw new Error('Source not allowed');
    const key = target.href;
    const old = cache.get(key);
    if (old && old.expires > now()) {
      cache.delete(key); cache.set(key, old);
      stats.hits++;
      return new Response(old.body, { headers: { 'content-type': 'application/json' } });
    }
    cache.delete(key);
    checkSource(target.origin);
    let work = pending.get(key);
    if (!work) {
      // Hard bound on queued work: fail honestly instead of accumulating visitors indefinitely.
      if (pending.size >= 30) throw new Error('Research busy');
      work = (async () => {
        if (active >= concurrency) await new Promise<void>((resolve) => waiting.push(resolve));
        else active++;
        try {
          init?.signal?.throwIfAborted();
          checkSource(target.origin);
          stats.requests++;
          const response = await request(url, { ...init, signal: AbortSignal.timeout(options.timeoutMs ?? 8000) });
          if (response.status === 429 || response.status === 503) {
            deferSource(target.origin, response.headers.get('retry-after'));
          }
          if (!response.ok) {
            await response.body?.cancel().catch(() => {});
            throw new Error(`HTTP ${response.status}`);
          }
          // Stream with a hard byte budget; never cache unexpectedly large documents.
          const reader = response.body?.getReader();
          if (!reader) throw new Error('Empty response');
          const decoder = new TextDecoder();
          let body = ''; let size = 0;
          try {
            while (true) {
              const chunk = await reader.read();
              if (chunk.done) break;
              size += chunk.value.byteLength;
              if (size > 512_000) throw new Error('Source too large');
              body += decoder.decode(chunk.value, { stream: true });
            }
            body += decoder.decode();
          } finally { await reader.cancel().catch(() => {}); }
          const data: unknown = JSON.parse(body);
          // MediaWiki can return quota/maxlag errors with HTTP 200. Respect them too.
          const code = (data as { error?: { code?: unknown } } | null)?.error?.code;
          if (code === 'ratelimited' || code === 'maxlag') {
            deferSource(target.origin, response.headers.get('retry-after'));
          }
          if (!data || typeof data !== 'object' || 'error' in data || !('query' in data)) {
            throw new Error('Invalid source response');
          }
          cache.set(key, { body, expires: now() + ttl });
          while (cache.size > capacity) cache.delete(cache.keys().next().value!);
          return body;
        } catch (error) { stats.failures++; throw error; }
        finally {
          const next = waiting.shift();
          if (next) next(); else active--;
        }
      })();
      pending.set(key, work);
      void work.finally(() => pending.delete(key)).catch(() => {});
    } else stats.hits++;
    // A caller's deadline must not cancel a document shared with another visitor.
    const body = await new Promise<string>((resolve, reject) => {
      const signal = init?.signal;
      const abort = () => reject(signal?.reason ?? new Error('Research timed out'));
      if (signal?.aborted) { abort(); return; }
      signal?.addEventListener('abort', abort, { once: true });
      work!.then(resolve, reject).finally(() => signal?.removeEventListener('abort', abort));
    });
    return new Response(body, { headers: { 'content-type': 'application/json' } });
  };

  return {
    async search(question: string, lang: string): Promise<Research | undefined> {
      if (!researchQueries(question, lang)) return undefined;
      return research(cachedFetch, question, lang, { userAgent: options.userAgent, timeoutMs: options.timeoutMs });
    },
    status: () => ({ ...stats, cachedDocuments: cache.size, pending: pending.size, active,
      coolingSources: [...cooldowns.values()].filter((until) => until > now()).length }),
    clear: () => cache.clear(),
  };
}
