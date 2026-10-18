/**
 * Public SEO endpoints + the live files.
 *   /api/seo/status          one honest snapshot for the panel (no engine names)
 *   /robots.txt /sitemap.xml /llms.txt /feed.xml /<key>.txt   served by the Node/Vercel deployment
 */
import express from 'express';
import { SEO_AGENT, SITE } from '../../src/seo/site';
import type { SeoService } from './service';

const cache = (res: express.Response, seconds = 300) => res.setHeader('Cache-Control', `public, max-age=${seconds}, s-maxage=${seconds}`);
const xml = (res: express.Response, body: string) => { cache(res); res.type('application/xml').send(body); };
const text = (res: express.Response, body: string, type = 'text/plain') => { cache(res); res.type(type).send(body); };

export function createSeoRouter(service: SeoService) {
  const router = express.Router();

  /** A public snapshot, not the full internal state: no engine names, no raw notes. */
  router.get('/seo/status', async (_req, res) => {
    try {
      const state = await service.loadState();
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        agent: SEO_AGENT.nameAr, role: SEO_AGENT.roleAr, reportsTo: SEO_AGENT.reportsToAr,
        updatedAt: state.updatedAt, nextRunAt: state.nextRunAt, intervalHours: state.intervalHours,
        trust: { level: state.trust.level, since: state.trust.since, cycles: state.trust.cycles },
        audit: { score: state.audit.score, at: state.audit.at, bySeverity: state.audit.bySeverity, pagesChecked: state.audit.pagesChecked, findings: state.audit.findings.slice(0, 20) },
        curriculum: { studied: state.curriculum.studied.length, total: 24, completedAt: state.curriculum.completedAt },
        applied: state.applied.filter((a) => !a.reverted).length,
        coach: state.coach ? { at: state.coach.at, score: state.coach.score, readyForAutonomy: state.coach.readyForAutonomy } : null,
        searchEngines: state.searchEngines,
        mediaReport: state.mediaReport,
        history: state.history.slice(-12),
      });
    } catch {
      res.status(503).json({ error: 'SEO status is unavailable' });
    }
  });

  router.get('/seo/sitemap.xml', async (_req, res) => { xml(res, await service.sitemap()); });
  router.get('/seo/robots.txt', async (_req, res) => { text(res, await service.robots()); });
  router.get('/seo/llms.txt', async (_req, res) => { text(res, await service.llms()); });
  router.get('/seo/feed.xml', async (_req, res) => { xml(res, await service.feed()); });

  return router;
}

/** Root files a crawler asks for first. Registered before the SPA fallback. */
export function createSeoRootRouter(service: SeoService) {
  const router = express.Router();
  router.get('/robots.txt', async (_req, res) => { text(res, await service.robots(), 'text/plain'); });
  router.get('/sitemap.xml', async (_req, res) => { xml(res, await service.sitemap()); });
  router.get('/llms.txt', async (_req, res) => { text(res, await service.llms(), 'text/plain'); });
  router.get('/feed.xml', async (_req, res) => { xml(res, await service.feed()); });
  router.get(`/${SITE.indexNowKey}.txt`, (_req, res) => { text(res, SITE.indexNowKey, 'text/plain'); });
  return router;
}

export { SITE };
