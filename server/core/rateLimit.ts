import type express from 'express';

/** Sliding-window limiter per client key (in-memory; per server instance). */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private limit: number, private windowMs: number) {}
  allow(key: string): boolean {
    const now = Date.now();
    const recent = (this.hits.get(key) || []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.limit) { this.hits.set(key, recent); return false; }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 5000) for (const [k, v] of this.hits) if (!v.some((t) => now - t < this.windowMs)) this.hits.delete(k);
    return true;
  }
}

/**
 * Per-visitor key for rate limits. On Tencent EdgeOne the platform gateway sets EO-Connecting-IP to the
 * real client address (only trusted there; elsewhere the header could be forged).
 */
export const clientKey = (req: express.Request) => {
  if (process.env.SHAM_PLATFORM === 'edgeone') {
    const eo = req.get('eo-connecting-ip')?.split(',')[0]?.trim();
    if (eo) return eo;
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
};
