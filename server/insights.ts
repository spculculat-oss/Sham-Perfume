/**
 * «خزنة فهم الزوار» — the server side (src/utils/visitorInsights.ts has the rules and the analysis).
 *
 *   POST   /api/insights/events            a batch of interactions from a visitor who accepted «التحليل»
 *   DELETE /api/insights/me?visitorId=…    the visitor withdraws: his record is erased at once
 *   GET    /api/admin/insights             the owner's summary: people, segments, countries' cultures
 *   GET    /api/admin/insights/profiles/:id  one person's profile and behavioural reading
 *   DELETE /api/admin/insights/profiles/:id  erase one record (a request by e-mail, a mistake)
 *   GET    /api/admin/insights/export      everything, as JSON, for the administration's own studies
 *
 * Stored in the durable store (the database when there is one) behind the admin token — never in the public
 * repository, never sent to an AI platform. Crawlers, admin pages and visitors without consent are not recorded.
 */
import express from 'express';
import productsData from '../src/data/products.json';
import type { Store } from './core/store';
import { RateLimiter, clientKey } from './core/rateLimit';
import { countryFromHeaders } from './core/replyMoney';
import { isBotUserAgent } from './census';
import { mergeCatalog, type RawProduct, type StoreProduct } from '../src/utils/storeCatalog';
import { applyBatch, expired, insightsSummary, priceYardstick, readBatch, readPerson, type InsightProfile } from '../src/utils/visitorInsights';

export interface InsightsOptions { store: Store; products?: RawProduct[]; now?: () => Date }

const VISITOR = /^[A-Za-z0-9_-]{8,80}$/;

export function createInsightsService(options: InsightsOptions) {
  const { store } = options;
  const now = options.now || (() => new Date());
  const catalog: StoreProduct[] = mergeCatalog(options.products || (productsData as { products?: RawProduct[] }).products || []);
  const bySku = new Map(catalog.map((p) => [p.sku, p]));
  const limiter = new RateLimiter(60, 60_000);
  // One write at a time per visitor (two tabs flushing together must not lose events).
  const queues = new Map<string, Promise<unknown>>();
  const serial = <T>(id: string, job: () => Promise<T>): Promise<T> => {
    const next = (queues.get(id) || Promise.resolve()).catch(() => undefined).then(job);
    queues.set(id, next);
    void next.finally(() => { if (queues.get(id) === next) queues.delete(id); });
    return next;
  };

  const all = async (): Promise<InsightProfile[]> => {
    const list = await store.list('insightProfiles');
    const at = now();
    const old = list.filter((p) => expired(p, at));
    // The privacy policy's retention promise: records idle for a year are erased.
    await Promise.all(old.map((p) => store.delete('insightProfiles', p.id).catch(() => false)));
    return list.filter((p) => !expired(p, at));
  };

  const router = express.Router();
  router.post('/events', express.text({ type: 'text/plain', limit: '64kb' }), async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (isBotUserAgent(req.headers['user-agent'])) { res.status(202).json({ recorded: false, reason: 'crawler' }); return; }
    if (!limiter.allow(clientKey(req))) { res.status(429).json({ error: 'Too many requests', code: 'RATE_LIMITED' }); return; }
    let body: unknown = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = undefined; } }
    const batch = readBatch(body);
    if (!batch) { res.status(202).json({ recorded: false, reason: 'refused' }); return; }
    const events = batch.events.filter((e) => !(e.type === 'section' && e.section === 'admin'));
    if (!events.length) { res.status(202).json({ recorded: false, reason: 'admin' }); return; }
    try {
      await serial(batch.visitorId, async () => {
        const previous = await store.get('insightProfiles', batch.visitorId);
        const next = applyBatch(previous, { ...batch, events }, { now: now(), edgeCountry: countryFromHeaders(req.headers), product: (sku) => bySku.get(sku) });
        await store.put('insightProfiles', batch.visitorId, next);
      });
      res.status(202).json({ recorded: true, events: events.length, persistent: store.persistent });
    } catch (error) {
      console.error('[insights] store', error instanceof Error ? error.message : error);
      res.status(503).json({ error: 'Storage unavailable', code: 'STORAGE_UNAVAILABLE' });
    }
  });

  router.delete('/me', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const id = String(req.query.visitorId || '');
    if (!VISITOR.test(id)) { res.status(400).json({ error: 'visitorId required', code: 'INVALID_VISITOR' }); return; }
    const deleted = await serial(id, () => store.delete('insightProfiles', id)).catch(() => false);
    res.json({ deleted });
  });

  /** Mounted under the admin router (the admin token is already checked there). */
  const admin = express.Router();
  admin.get('/', async (_req, res) => {
    res.json({ storage: { kind: store.kind, persistent: store.persistent }, summary: insightsSummary(await all(), catalog, now()) });
  });
  admin.get('/profiles/:id', async (req, res) => {
    const profile = await store.get('insightProfiles', req.params.id);
    if (!profile) { res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' }); return; }
    res.json({ profile, reading: readPerson(profile, priceYardstick(catalog)) });
  });
  admin.delete('/profiles/:id', async (req, res) => {
    res.json({ deleted: await serial(req.params.id, () => store.delete('insightProfiles', req.params.id)) });
  });
  admin.get('/export', async (_req, res) => {
    const profiles = await all();
    const yardstick = priceYardstick(catalog);
    res.setHeader('Content-Disposition', `attachment; filename="sham-visitor-insights-${now().toISOString().slice(0, 10)}.json"`);
    res.json({ exportedAt: now().toISOString(), profiles: profiles.map((p) => ({ ...p, reading: readPerson(p, yardstick) })) });
  });

  return { router, admin, all };
}
