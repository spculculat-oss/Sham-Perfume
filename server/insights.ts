/**
 * «خزنة فهم الزوار» — the server side (src/utils/visitorInsights.ts has the rules and the analysis).
 *
 *   POST   /api/insights/events            a batch of interactions from a visitor who accepted «التحليل»
 *   DELETE /api/insights/me?visitorId=…    the visitor withdraws: his record is erased at once
 *   GET    /api/admin/insights             the owner's summary: people, segments, countries' cultures
 *   GET    /api/admin/insights/profiles/:id  one person's profile and behavioural reading
 *   DELETE /api/admin/insights/profiles/:id  erase one record (a request by e-mail, a mistake)
 *   GET    /api/admin/insights/export      everything, as JSON, for the administration's own studies
 *   GET    /api/insights/together?sku=…  «ناس ذوقهم زيك شافوا كمان»: product codes shared by 3+ people (anonymous)
 *   POST   /api/insights/pulse             «نبض الدول»: anonymous counts from a visitor who has not refused (no id, no text)
 *
 * The summary also carries «نبض الدول» and «دراسة الطلبات» (src/utils/insightsPulse.ts).
 *
 * Stored in the durable store (the database when there is one) behind the admin token — never in the public
 * repository, never sent to an AI platform. Crawlers, admin pages and visitors without consent are not recorded.
 */
import express from 'express';
import { randomUUID } from 'node:crypto';
import productsData from '../src/data/products.json';
import type { Store } from './core/store';
import { RateLimiter, clientKey } from './core/rateLimit';
import { countryFromHeaders } from './core/replyMoney';
import { isBotUserAgent } from './census';
import { mergeCatalog, type RawProduct, type StoreProduct } from '../src/utils/storeCatalog';
import { applyPulse, orderStudies, pulseCountries, pulseExpired, pulseId, readPulse, type PulseBatch, type StudyEntry, type StudyOrder } from '../src/utils/insightsPulse';
import { togetherIndex, applyBatch, expired, insightsSummary, priceYardstick, readBatch, readPerson, type InsightProfile } from '../src/utils/visitorInsights';
import { analyzeSuggestionTopics, isSuggestionStatus, readVisitorSuggestion, suggestionExpired, summarizeVisitorSuggestions, VISITOR_SUGGESTION_RETENTION_DAYS } from '../src/utils/visitorVoice';

export interface InsightsOptions { store: Store; products?: RawProduct[]; now?: () => Date }

const VISITOR = /^[A-Za-z0-9_-]{8,80}$/;

export function createInsightsService(options: InsightsOptions) {
  const { store } = options;
  const now = options.now || (() => new Date());
  const catalog: StoreProduct[] = mergeCatalog(options.products || (productsData as { products?: RawProduct[] }).products || []);
  const bySku = new Map(catalog.map((p) => [p.sku, p]));
  const limiter = new RateLimiter(60, 60_000);
  // Suggestions are voluntarily submitted, but still rate-limited; client keys are transient and never stored.
  const suggestionLimiter = new RateLimiter(5, 60 * 60_000);
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

  const yardstick = priceYardstick(catalog);
  const product = (sku: string) => bySku.get(sku);
  /** «نبض الدول»: a batch only adds to its country's monthly totals. */
  const pulse = (batch: PulseBatch, country: string | undefined) => {
    const id = pulseId(country, now());
    return serial(`pulse:${id}`, async () => {
      const previous = await store.get('insightPulse', id);
      await store.put('insightPulse', id, applyPulse(previous, batch, { id, product, yardstick }));
    });
  };
  const pulseDocs = async () => {
    const list = await store.list('insightPulse');
    const at = now();
    await Promise.all(list.filter((p) => pulseExpired(p, at)).map((p) => store.delete('insightPulse', p.id).catch(() => false)));
    return list.filter((p) => !pulseExpired(p, at));
  };
  const suggestions = async () => {
    const list = await store.list('visitorSuggestions');
    const at = now();
    const old = list.filter((item) => suggestionExpired(item, at));
    await Promise.all(old.map((item) => store.delete('visitorSuggestions', item.id).catch(() => false)));
    return list.filter((item) => !suggestionExpired(item, at));
  };
  const cleanupIntervalMs = 24 * 60 * 60_000;
  let lastSuggestionCleanup = 0;
  const cleanupSuggestionsIfDue = async () => {
    const at = now().getTime();
    if (at - lastSuggestionCleanup < cleanupIntervalMs) return;
    await suggestions();
    lastSuggestionCleanup = at;
  };
  const logCleanupFailure = (error: unknown) => console.error('[insights] suggestion retention cleanup failed:', error instanceof Error ? error.message : error);
  // Sweep on traffic for serverless hosts and once daily in long-running hosts; idle serverless records expire
  // at 180 days and are physically removed on the first subsequent request.
  const suggestionCleanup = setInterval(() => { void cleanupSuggestionsIfDue().catch(logCleanupFailure); }, cleanupIntervalMs);
  suggestionCleanup.unref?.();
  const cleanupOnRequest: express.RequestHandler = (_req, _res, next) => {
    void cleanupSuggestionsIfDue().catch(logCleanupFailure).finally(() => next());
  };
  const parse = (body: unknown) => { if (typeof body === 'string') { try { return JSON.parse(body) as unknown; } catch { return undefined; } } return body; };

  const router = express.Router();
  router.use(cleanupOnRequest);
  router.post('/pulse', express.text({ type: 'text/plain', limit: '16kb' }), async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (isBotUserAgent(req.headers['user-agent'])) { res.status(202).json({ counted: false, reason: 'crawler' }); return; }
    if (!limiter.allow(clientKey(req))) { res.status(429).json({ error: 'Too many requests', code: 'RATE_LIMITED' }); return; }
    const batch = readPulse(parse(req.body));
    if (!batch) { res.status(202).json({ counted: false, reason: 'refused' }); return; }
    try { await pulse(batch, countryFromHeaders(req.headers)); res.status(202).json({ counted: true, events: batch.events.length }); }
    catch (error) {
      console.error('[insights] pulse', error instanceof Error ? error.message : error);
      res.status(503).json({ error: 'Storage unavailable', code: 'STORAGE_UNAVAILABLE' });
    }
  });

  router.post('/events', express.text({ type: 'text/plain', limit: '64kb' }), async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (isBotUserAgent(req.headers['user-agent'])) { res.status(202).json({ recorded: false, reason: 'crawler' }); return; }
    if (!limiter.allow(clientKey(req))) { res.status(429).json({ error: 'Too many requests', code: 'RATE_LIMITED' }); return; }
    const batch = readBatch(parse(req.body));
    if (!batch) { res.status(202).json({ recorded: false, reason: 'refused' }); return; }
    const events = batch.events.filter((e) => !(e.type === 'section' && e.section === 'admin'));
    if (!events.length) { res.status(202).json({ recorded: false, reason: 'admin' }); return; }
    try {
      await serial(batch.visitorId, async () => {
        const previous = await store.get('insightProfiles', batch.visitorId);
        const next = applyBatch(previous, { ...batch, events }, { now: now(), edgeCountry: countryFromHeaders(req.headers), product });
        await store.put('insightProfiles', batch.visitorId, next);
      });
      // A visitor who accepted is part of his country's pulse too (counts only).
      const counted = readPulse({ events: events.filter((e) => e.type !== 'search' && e.type !== 'chat' && e.type !== 'language' && e.type !== 'country').map((e) => ({ type: e.type, sku: e.sku, section: e.section })), language: batch.language, device: batch.device, hour: batch.hour });
      if (counted) await pulse(counted, countryFromHeaders(req.headers) || batch.country).catch(() => undefined);
      res.status(202).json({ recorded: true, events: events.length, persistent: store.persistent });
    } catch (error) {
      console.error('[insights] store', error instanceof Error ? error.message : error);
      res.status(503).json({ error: 'Storage unavailable', code: 'STORAGE_UNAVAILABLE' });
    }
  });

  /** Voluntary suggestions are separate from analytics consent; no visitor identifier or contact field is accepted. */
  router.post('/suggestions', express.text({ type: 'text/plain', limit: '16kb' }), async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (isBotUserAgent(req.headers['user-agent'])) { res.status(202).json({ accepted: false, reason: 'crawler' }); return; }
    if (!suggestionLimiter.allow(clientKey(req))) { res.status(429).json({ error: 'Too many requests', code: 'RATE_LIMITED' }); return; }
    // Do not claim a suggestion was safely received when this host has only volatile memory storage.
    if (!store.persistent) { res.status(503).json({ error: 'Suggestion storage is not persistent', code: 'STORAGE_UNAVAILABLE' }); return; }
    const read = readVisitorSuggestion(parse(req.body));
    if (!read.ok) {
      const secret = read.reason === 'secret';
      const personal = read.reason === 'personal';
      res.status(400).json({
        error: secret ? 'Remove passwords, verification codes or other secrets before sending.'
          : personal ? 'Remove personal details before sending.' : 'A short suggestion and confirmation are required.',
        code: secret ? 'SENSITIVE_CONTENT' : personal ? 'PERSONAL_DATA' : 'INVALID_SUGGESTION',
      });
      return;
    }
    const at = now().toISOString();
    const id = `suggestion-${randomUUID()}`;
    const item = {
      id, ...read.input, topics: analyzeSuggestionTopics(read.input.text), status: 'new' as const, createdAt: at, updatedAt: at,
    };
    try {
      // Also enforce retention on serverless hosts, where a background timer may be suspended between requests.
      await suggestions();
      const created = await store.create('visitorSuggestions', id, item);
      if (!created) { res.status(503).json({ error: 'Could not save suggestion', code: 'STORAGE_UNAVAILABLE' }); return; }
      res.status(202).json({ accepted: true, redacted: read.redacted, persistent: true });
    } catch (error) {
      console.error('[insights] suggestion storage failed:', error instanceof Error ? error.message : error);
      res.status(503).json({ error: 'Storage unavailable', code: 'STORAGE_UNAVAILABLE' });
    }
  });

  // «ناس ذوقهم زيك شافوا كمان»: product codes only, from pairs at least 3 people share; rebuilt every 10 minutes.
  let together: { at: number; index: Map<string, string[]> } | undefined;
  router.get('/together', async (req, res) => {
    const sku = String(req.query.sku || '');
    if (!/^[A-Za-z0-9_.:@-]{1,80}$/.test(sku)) { res.status(400).json({ error: 'sku required', code: 'INVALID_SKU' }); return; }
    try {
      if (!together || now().getTime() - together.at > 600_000) together = { at: now().getTime(), index: togetherIndex(await all()) };
      res.setHeader('Cache-Control', 'public, max-age=600');
      res.json({ sku, skus: (together.index.get(sku) || []).filter((s) => bySku.has(s)) });
    } catch { res.json({ sku, skus: [] }); }
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
  admin.use(cleanupOnRequest);
  admin.get('/', async (_req, res) => {
    const [profiles, docs, orders, entries] = await Promise.all([
      all(), pulseDocs(), store.list('financeOrders').catch(() => []), store.list('financeEntries').catch(() => []),
    ]);
    res.json({
      storage: { kind: store.kind, persistent: store.persistent }, summary: insightsSummary(profiles, catalog, now()),
      pulse: pulseCountries(docs, now()), orders: orderStudies(orders as StudyOrder[], entries as StudyEntry[], product),
    });
  });
  admin.get('/suggestions', async (_req, res) => {
    const items = await suggestions();
    res.json({
      storage: { kind: store.kind, persistent: store.persistent },
      retentionDays: VISITOR_SUGGESTION_RETENTION_DAYS,
      summary: summarizeVisitorSuggestions(items),
      items: [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 300),
    });
  });
  admin.patch('/suggestions/:id', async (req, res) => {
    const id = String(req.params.id || '');
    if (!/^suggestion-[0-9a-f-]{36}$/i.test(id) || !isSuggestionStatus(req.body?.status)) {
      res.status(400).json({ error: 'Invalid suggestion or status', code: 'INVALID_SUGGESTION' }); return;
    }
    const item = (await suggestions()).find((entry) => entry.id === id);
    if (!item) { res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' }); return; }
    const updated = { ...item, status: req.body.status, updatedAt: now().toISOString() };
    await store.put('visitorSuggestions', id, updated);
    res.json({ item: updated });
  });
  admin.delete('/suggestions/:id', async (req, res) => {
    const id = String(req.params.id || '');
    if (!/^suggestion-[0-9a-f-]{36}$/i.test(id)) { res.status(400).json({ error: 'Invalid suggestion', code: 'INVALID_SUGGESTION' }); return; }
    res.json({ deleted: await store.delete('visitorSuggestions', id) });
  });
  admin.get('/profiles/:id', async (req, res) => {
    const profile = await store.get('insightProfiles', req.params.id);
    if (!profile) { res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' }); return; }
    res.json({ profile, reading: readPerson(profile, yardstick) });
  });
  admin.delete('/profiles/:id', async (req, res) => {
    res.json({ deleted: await serial(req.params.id, () => store.delete('insightProfiles', req.params.id)) });
  });
  admin.get('/export', async (_req, res) => {
    const profiles = await all();
    res.setHeader('Content-Disposition', `attachment; filename="sham-visitor-insights-${now().toISOString().slice(0, 10)}.json"`);
    res.json({ exportedAt: now().toISOString(), profiles: profiles.map((p) => ({ ...p, reading: readPerson(p, yardstick) })), pulse: await pulseDocs(), suggestions: await suggestions() });
  });

  return { router, admin, all };
}
