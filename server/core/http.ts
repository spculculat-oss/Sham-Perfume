/**
 * HTTP surface of Sham Core.
 *   /api/assistant/*  public visitor API (rate limited)
 *   /api/admin/*      management API (Bearer SHAM_ADMIN_TOKEN, constant-time compare)
 */
import express from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { Repository, ValidationError, publicView } from './repository';
import { AssistantError, Orchestrator, validateChatInput, type ChatOutput, type StreamEvent } from './orchestrator';
import { createNotifier } from './notify';
import { runAdminAgent } from './adminAgent';
import { createStore, type Store } from './store';
import { engineStatuses } from './engines';
import type { CollectionName, RequestStatus } from './types';

type Env = Record<string, string | undefined>;

class RateLimiter {
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

const clientKey = (req: express.Request) => (req.ip || req.socket.remoteAddress || 'unknown');

function sendError(res: express.Response, error: unknown) {
  if (error instanceof ValidationError || error instanceof AssistantError) {
    res.status(error.status).json({ error: error.message, code: error.code });
    return;
  }
  console.error('[Sham Core]', error instanceof Error ? error.message : error);
  res.status(500).json({ error: 'Internal error', code: 'INTERNAL' });
}

const wrap = (fn: (req: express.Request, res: express.Response) => Promise<unknown>) =>
  (req: express.Request, res: express.Response) => { fn(req, res).catch((error) => sendError(res, error)); };

export interface CoreOptions { env?: Env; store?: Store; fetch?: typeof fetch }

export function createShamCore(options: CoreOptions = {}) {
  const env = options.env || process.env;
  let store: Store;
  let storeError: string | undefined;
  try { store = options.store || createStore(env); } catch (error) {
    storeError = error instanceof Error ? error.message : String(error);
    console.error('[Sham Core] storage misconfigured:', storeError);
    store = createStore({ SHAM_STORE: 'memory' });
  }
  const repo = new Repository(store, env);
  const orchestrator = new Orchestrator(repo, { env, fetch: options.fetch });
  const notifier = createNotifier(env, options.fetch);
  const feedbackLimiter = new RateLimiter(60, 10 * 60_000);
  const privacyLimiter = new RateLimiter(10, 10 * 60_000);
  const VISITOR = /^[A-Za-z0-9_-]{8,80}$/;

  const afterChat = async (output: ChatOutput) => {
    if (output.intent === 'handoff') {
      await notifier.send('conversation.handoff', `🙋 زائر يطلب موظفاً — محادثة ${output.conversationId.slice(0, 8)}`, { conversationId: output.conversationId });
    }
  };

  const chatLimiter = new RateLimiter(Number(env.SHAM_CHAT_RATE_PER_MIN) || 20, 60_000);
  const requestLimiter = new RateLimiter(6, 10 * 60_000);
  const trackLimiter = new RateLimiter(10, 10 * 60_000);
  const authFailures = new RateLimiter(10, 15 * 60_000);

  // ---------------- public ----------------
  const assistant = express.Router();
  assistant.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

  assistant.get('/config', wrap(async (_req, res) => {
    const [settings, services] = await Promise.all([repo.settings(), repo.services()]);
    const statuses = engineStatuses(env);
    res.json({
      assistantName: { ar: settings.assistantNameAr, en: settings.assistantNameEn },
      welcome: { ar: settings.welcomeAr, en: settings.welcomeEn },
      currency: settings.currency,
      modelEnhanced: settings.enginePolicy.some((id) => id !== 'sham_local' && statuses.find((s) => s.id === id)?.configured),
      services: services.map(({ id, kind, nameAr, nameEn, descriptionAr, descriptionEn, formFields, siteTab }) => ({ id, kind, nameAr, nameEn, descriptionAr, descriptionEn, formFields, siteTab })),
    });
  }));

  assistant.post('/chat', wrap(async (req, res) => {
    if (!chatLimiter.allow(clientKey(req))) throw new AssistantError(429, 'RATE_LIMITED', 'Too many messages, please wait a minute');
    const input = validateChatInput(req.body);
    const controller = new AbortController();
    res.on('close', () => { if (!res.writableFinished) controller.abort(); });
    const output = await orchestrator.chat(input, { signal: controller.signal });
    await afterChat(output);
    res.json(output);
  }));

  /**
   * Streaming variant (Server-Sent Events over POST): live progress steps, then answer tokens,
   * then a final `done` event with cards, citations and suggestions.
   */
  assistant.post('/chat/stream', async (req, res) => {
    let input;
    try {
      if (!chatLimiter.allow(clientKey(req))) throw new AssistantError(429, 'RATE_LIMITED', 'Too many messages, please wait a minute');
      input = validateChatInput(req.body);
    } catch (error) { sendError(res, error); return; }
    const controller = new AbortController();
    res.on('close', () => { if (!res.writableFinished) controller.abort(); });
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders?.();
    const write = (event: StreamEvent) => { if (!res.writableEnded) res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`); };
    try {
      const output = await orchestrator.chat(input, { signal: controller.signal, onEvent: write });
      await afterChat(output);
    } catch (error) {
      console.error('[Sham Core] stream', error instanceof Error ? error.message : error);
      write({ type: 'error', code: 'INTERNAL', message: 'Internal error' });
    } finally {
      res.end();
    }
  });

  assistant.post('/feedback', wrap(async (req, res) => {
    if (!feedbackLimiter.allow(clientKey(req))) throw new AssistantError(429, 'RATE_LIMITED', 'Too many ratings');
    const feedback = await repo.setFeedback(req.body || {});
    if (feedback.rating === 'down') {
      await notifier.send('feedback.negative', `👎 تقييم سلبي لرد المساعد${feedback.reason ? `: ${feedback.reason}` : ''}`, { conversationId: req.body?.conversationId, messageId: req.body?.messageId });
    }
    res.json({ feedback });
  }));

  /** Visitor memory transparency ("what do you remember about me") and erasure ("forget me"). */
  assistant.get('/me', wrap(async (req, res) => {
    const visitorId = String(req.query.visitorId || '');
    if (!VISITOR.test(visitorId)) throw new AssistantError(400, 'INVALID_VISITOR', 'visitorId is required');
    const profile = await repo.visitor(visitorId);
    res.json({ memory: profile?.memory || {}, conversations: profile?.conversationIds.length || 0, firstSeen: profile?.firstSeen });
  }));
  assistant.delete('/me', wrap(async (req, res) => {
    if (!privacyLimiter.allow(clientKey(req))) throw new AssistantError(429, 'RATE_LIMITED', 'Too many attempts');
    const visitorId = String(req.query.visitorId || '');
    if (!VISITOR.test(visitorId)) throw new AssistantError(400, 'INVALID_VISITOR', 'visitorId is required');
    res.json({ deleted: await repo.deleteVisitorData(visitorId) });
  }));

  /** Polling endpoint so visitors receive human replies after a handoff. */
  assistant.get('/conversations/:id', wrap(async (req, res) => {
    const conversation = await repo.conversation(String(req.params.id));
    if (!conversation || conversation.visitorId !== req.query.visitorId) throw new AssistantError(404, 'NOT_FOUND', 'Conversation not found');
    res.json({
      id: conversation.id, status: conversation.status,
      messages: conversation.messages.map(({ role, text, at, engine, actions, citations }) => ({ role, text, at, engine, actions, citations })),
    });
  }));

  assistant.get('/products', wrap(async (_req, res) => {
    const products = await repo.products();
    res.json({ products: products.map(({ id, sku, nameAr, nameEn, category, price, currency, stock, unit, descriptionAr, descriptionEn, demo }) => ({ id, sku, nameAr, nameEn, category, price, currency, stock, unit, descriptionAr, descriptionEn, demo })) });
  }));

  assistant.post('/requests', wrap(async (req, res) => {
    if (!requestLimiter.allow(clientKey(req))) throw new AssistantError(429, 'RATE_LIMITED', 'Too many requests, please try later');
    const request = await repo.createRequest(req.body);
    if (request.conversationId) {
      const conversation = await repo.conversation(request.conversationId);
      if (conversation && conversation.visitorId === request.visitorId) {
        conversation.memory.lastRequestRef = request.ref;
        conversation.messages.push({ role: 'assistant', text: `✅ ${request.ref}`, at: new Date().toISOString(), engine: 'system', actions: [{ type: 'order_status', request: publicView(request) }] });
        conversation.updatedAt = new Date().toISOString();
        await repo.saveConversation(conversation);
      }
    }
    const service = (await repo.services()).find((x) => x.id === request.serviceId);
    await notifier.send('request.created', `🧾 طلب جديد ${request.ref} — ${service?.nameAr || request.serviceId} — ${request.contact.name}${request.total !== undefined ? ` — ${request.total} ${request.currency}` : ''}`, {
      ref: request.ref, type: request.type, serviceId: request.serviceId, contact: request.contact, total: request.total, currency: request.currency,
    });
    res.status(201).json({ request: publicView(request) });
  }));

  assistant.post('/track', wrap(async (req, res) => {
    if (!trackLimiter.allow(clientKey(req))) throw new AssistantError(429, 'RATE_LIMITED', 'Too many attempts, please try later');
    const request = await repo.trackRequest(req.body?.ref, req.body?.contact);
    if (!request) throw new AssistantError(404, 'NOT_FOUND', 'No request matches this reference and contact');
    res.json({ request: publicView(request) });
  }));

  // ---------------- admin ----------------
  const admin = express.Router();
  const token = env.SHAM_ADMIN_TOKEN?.trim() || '';
  const digest = (v: string) => createHash('sha256').update(v).digest();
  admin.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (token.length < 12) {
      res.status(503).json({ error: 'Admin is disabled. Set SHAM_ADMIN_TOKEN (12+ characters) on the server.', code: 'ADMIN_NOT_CONFIGURED' });
      return;
    }
    const key = clientKey(req);
    const provided = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!provided || !timingSafeEqual(digest(provided), digest(token))) {
      if (!authFailures.allow(key)) { res.status(429).json({ error: 'Too many failed attempts', code: 'RATE_LIMITED' }); return; }
      res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
      return;
    }
    next();
  });

  admin.get('/overview', wrap(async (_req, res) => {
    const [requests, conversations, products, knowledge, services, settings, gaps] = await Promise.all([
      repo.requests(), repo.conversations(), repo.products(true), repo.knowledge(), repo.services(true), repo.settings(), repo.gaps(),
    ]);
    let up = 0; let down = 0;
    for (const c of conversations) for (const m of c.messages) { if (m.feedback?.rating === 'up') up++; else if (m.feedback?.rating === 'down') down++; }
    const since = Date.now() - 24 * 3600_000;
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    for (const r of requests) { byStatus[r.status] = (byStatus[r.status] || 0) + 1; byType[r.type] = (byType[r.type] || 0) + 1; }
    const intents: Record<string, number> = {};
    const engines: Record<string, number> = {};
    for (const c of conversations) for (const m of c.messages) {
      if (m.role === 'user' && m.intent) intents[m.intent] = (intents[m.intent] || 0) + 1;
      if (m.role === 'assistant' && m.engine) engines[m.engine] = (engines[m.engine] || 0) + 1;
    }
    const revenue: Record<string, number> = {};
    for (const r of requests) if (r.total !== undefined && r.currency && r.status !== 'cancelled') revenue[r.currency] = Math.round(((revenue[r.currency] || 0) + r.total) * 100) / 100;
    res.json({
      storage: { kind: store.kind, persistent: store.persistent, error: storeError },
      engines: engineStatuses(env), policy: settings.enginePolicy,
      counts: {
        conversations: conversations.length,
        conversations24h: conversations.filter((c) => Date.parse(c.updatedAt) >= since).length,
        handoffsOpen: conversations.filter((c) => c.status === 'handoff').length,
        requests: requests.length, requestsNew: byStatus.new || 0,
        products: products.length, lowStock: products.filter((p) => p.active && p.stock <= 3).length,
        knowledge: knowledge.length, services: services.length,
        gapsOpen: gaps.filter((g) => g.status === 'open').length, feedbackUp: up, feedbackDown: down,
      },
      notifications: { configured: notifier.configured },
      byStatus, byType, intents, engineUsage: engines, pipelineValue: revenue,
    });
  }));

  // Generic CRUD for managed collections
  const crud = (collection: 'services' | 'products' | 'knowledge') => {
    const list = () => collection === 'services' ? repo.services(true) : collection === 'products' ? repo.products(true) : repo.knowledge();
    const save = (body: never, id?: string) => collection === 'services' ? repo.saveService(body, id) : collection === 'products' ? repo.saveProduct(body, id) : repo.saveKnowledge(body, id);
    admin.get(`/${collection}`, wrap(async (_req, res) => { res.json({ items: await list() }); }));
    admin.post(`/${collection}`, wrap(async (req, res) => { res.status(201).json({ item: await save(req.body as never) }); }));
    admin.put(`/${collection}/:id`, wrap(async (req, res) => { res.json({ item: await save(req.body as never, String(req.params.id)) }); }));
    admin.delete(`/${collection}/:id`, wrap(async (req, res) => { await repo.remove(collection, String(req.params.id)); res.json({ ok: true }); }));
  };
  crud('services'); crud('products'); crud('knowledge');

  admin.get('/requests', wrap(async (req, res) => {
    const status = req.query.status as RequestStatus | undefined;
    const items = (await repo.requests()).filter((r) => !status || r.status === status).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ items });
  }));
  admin.patch('/requests/:id', wrap(async (req, res) => { res.json({ item: await repo.updateRequest(String(req.params.id), req.body || {}) }); }));

  admin.get('/conversations', wrap(async (_req, res) => {
    const items = (await repo.conversations()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 300).map((c) => ({
      id: c.id, visitorId: c.visitorId, status: c.status, language: c.language, serviceId: c.serviceId, updatedAt: c.updatedAt, startedAt: c.startedAt,
      messageCount: c.messages.length, lastMessage: c.messages.at(-1)?.text.slice(0, 140) || '', memory: c.memory,
    }));
    res.json({ items });
  }));
  admin.get('/conversations/:id', wrap(async (req, res) => {
    const conversation = await repo.conversation(String(req.params.id));
    if (!conversation) throw new ValidationError('NOT_FOUND', 'Conversation not found', 404);
    res.json({ item: conversation });
  }));
  admin.post('/conversations/:id/reply', wrap(async (req, res) => {
    const conversation = await repo.conversation(String(req.params.id));
    if (!conversation) throw new ValidationError('NOT_FOUND', 'Conversation not found', 404);
    const text = typeof req.body?.text === 'string' ? req.body.text.trim().slice(0, 4000) : '';
    if (!text) throw new ValidationError('INVALID_MESSAGE', 'Reply text is required');
    conversation.messages.push({ role: 'assistant', text, at: new Date().toISOString(), engine: 'human' });
    conversation.updatedAt = new Date().toISOString();
    await repo.saveConversation(conversation);
    res.json({ item: conversation });
  }));
  admin.patch('/conversations/:id', wrap(async (req, res) => {
    const conversation = await repo.conversation(String(req.params.id));
    if (!conversation) throw new ValidationError('NOT_FOUND', 'Conversation not found', 404);
    if (!['open', 'handoff', 'closed'].includes(req.body?.status)) throw new ValidationError('INVALID_STATUS', 'Unknown status');
    conversation.status = req.body.status;
    conversation.updatedAt = new Date().toISOString();
    await repo.saveConversation(conversation);
    res.json({ item: conversation });
  }));

  // ---- quality: knowledge gaps + rated answers (the learning loop) ----
  admin.get('/gaps', wrap(async (_req, res) => {
    const items = (await repo.gaps()).sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || b.count - a.count || b.lastAt.localeCompare(a.lastAt));
    res.json({ items });
  }));
  admin.patch('/gaps/:id', wrap(async (req, res) => { res.json({ item: await repo.resolveGap(String(req.params.id), req.body || {}) }); }));
  admin.get('/feedback', wrap(async (_req, res) => {
    const items = (await repo.conversations()).flatMap((c) => c.messages.map((m, i) => ({ m, i, c }))
      .filter(({ m }) => m.feedback)
      .map(({ m, i, c }) => ({
        conversationId: c.id, messageId: m.id, rating: m.feedback!.rating, reason: m.feedback!.reason, at: m.feedback!.at,
        question: [...c.messages.slice(0, i)].reverse().find((x) => x.role === 'user')?.text || '', answer: m.text, engine: m.engine, intent: m.intent,
      })))
      .sort((a, b) => b.at.localeCompare(a.at)).slice(0, 300);
    res.json({ items });
  }));

  /** Manus-style operations agent over read-only admin tools. */
  admin.post('/agent', wrap(async (req, res) => {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 1000) : '';
    res.json(await runAdminAgent(repo, message || 'تقرير اليوم', { env, fetch: options.fetch }));
  }));

  admin.post('/notifications/test', wrap(async (_req, res) => {
    if (!notifier.configured) throw new ValidationError('NOT_CONFIGURED', 'Set SHAM_WEBHOOK_URL (https) on the server first', 409);
    res.json({ delivered: await notifier.send('test', '✅ اختبار إشعارات Sham Core', {}) });
  }));

  admin.get('/settings', wrap(async (_req, res) => { res.json({ item: await repo.settings(), engines: engineStatuses(env) }); }));
  admin.put('/settings', wrap(async (req, res) => { res.json({ item: await repo.updateSettings(req.body || {}) }); }));

  /** Sandbox: same pipeline as visitors, plus the full trace. */
  admin.post('/test-chat', wrap(async (req, res) => {
    const input = validateChatInput({ visitorId: 'admin-sandbox', ...req.body });
    res.json(await orchestrator.chat(input, { debug: true }));
  }));

  admin.get('/export', wrap(async (_req, res) => {
    const collections: CollectionName[] = ['settings', 'services', 'products', 'knowledge', 'requests', 'conversations', 'gaps', 'visitors'];
    const out: Record<string, unknown> = { exportedAt: new Date().toISOString(), storage: store.kind };
    for (const c of collections) out[c] = await store.list(c);
    res.setHeader('Content-Disposition', `attachment; filename="sham-core-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(out);
  }));

  return { assistant, admin, repo, orchestrator, store };
}
