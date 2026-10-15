// Tencent EdgeOne Makers (Pages) Cloud Function: every /api/... request of the site.
// The whole backend lives in ../../server (the same Express app Vercel and Node run). See EDGEONE.md.
import '../../server/edgeone-env';
import express from 'express';
import shamApp from '../../server/app';

/**
 * EdgeOne's runtime re-evaluates this module for EVERY request (its launcher wraps the bundle in a
 * function called per request). Without this cache each request would get a fresh app: the memory
 * store, admin settings, rate limits and news cache would all reset. Keep one app per instance.
 */
type Cache = typeof globalThis & { __shamEdgeOneApp?: express.Express };
const cache = globalThis as Cache;

function createEdgeApp(): express.Express {
  const edge = express();
  edge.disable('x-powered-by');
  // Depending on the runtime the request may arrive with or without the /api mount prefix.
  edge.use((req, _res, next) => {
    if (req.url !== '/api' && !req.url.startsWith('/api/') && !req.url.startsWith('/api?')) {
      req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
    }
    next();
  });
  edge.use(shamApp);
  return edge;
}

const app = (cache.__shamEdgeOneApp ??= createEdgeApp());

export default app;
