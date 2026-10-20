/**
 * CORS for the static GitHub Pages front-end, which calls this server from another origin.
 * Only the listed origins are allowed (exact match, no wildcards, no cookies): the API uses
 * no cookies, and admin calls carry an explicit Bearer token.
 *
 *   SHAM_CORS_ORIGINS="https://spculculat-oss.github.io,https://example.com"   (comma separated)
 *   SHAM_CORS_ORIGINS="none"  → disable cross-origin access entirely
 */
import type express from 'express';

export const DEFAULT_CORS_ORIGINS = ['https://spculculat-oss.github.io'];

export function corsOrigins(raw: string | undefined): Set<string> {
  if (raw?.trim().toLowerCase() === 'none') return new Set();
  const list = raw?.trim() ? raw.split(',') : DEFAULT_CORS_ORIGINS;
  const origins = new Set<string>();
  for (const item of list) {
    try {
      const url = new URL(item.trim());
      if (url.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(url.hostname)) origins.add(url.origin);
    } catch { /* ignore malformed entries */ }
  }
  return origins;
}

export function corsMiddleware(raw: string | undefined): express.RequestHandler {
  const allowed = corsOrigins(raw);
  return (req, res, next) => {
    const origin = req.headers.origin;
    res.vary('Origin');
    if (!origin || !allowed.has(origin)) { next(); return; }
    res.setHeader('Access-Control-Allow-Origin', origin);
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Sham-Visitor, X-Order-Token');
      res.setHeader('Access-Control-Max-Age', '600');
      res.status(204).end();
      return;
    }
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Retry-After');
    next();
  };
}
