/**
 * HTTP surface of Sham Core.
 *   /api/assistant/*  public visitor API (rate limited)
 *   /api/admin/*      management API (Bearer SHAM_ADMIN_TOKEN, constant-time compare)
 */
import { mailProvider, mailProviderLabel } from './mailer';
import express from 'express';
import { FinanceService } from '../finance/service';
import { createFinanceRouter } from '../finance/router';
import { createHash, timingSafeEqual } from 'node:crypto';
import { reviewSpecialtiesCached } from './specialtyReview';
import { Repository, ValidationError, publicView } from './repository';
import { ShaheenMemory } from './memory';
import { AssistantError, Orchestrator, publicEngine, validateChatInput, type ChatOutput, type StreamEvent } from './orchestrator';
import { createNotifier } from './notify';
import { runAdminAgent } from './adminAgent';
import { createLedgerStore, createStore, type Store } from './store';
import { BankService } from '../finance/bank';
import { RateLimiter, clientKey } from './rateLimit';
import { createSeoService } from '../seo/service';
import { probeEngines } from '../shaheen';
import { createDesignBrief, validateDesignRequest } from '../design/assistant';
import { SHAHEEN_SITE_SETTINGS } from '../config/shaheen';
import { engineStatuses } from './engines';
import { activeSeats, councilAvailable, publicTranscript } from './council';
import type { CollectionName, RequestStatus, ServiceRequest } from './types';
import { MAINTENANCE_ACTIONS, ShaheenRuntime, runningVersion, type MaintenanceAction } from './maintenance';
import {
  sendCustomerStatusEmail,
  renderOrderStatusEmail,
  getEmailHistory,
  STATUS_LABELS_AR,
} from './email';

type Env = Record<string, string | undefined>;


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

export interface CoreOptions { env?: Env; store?: Store; fetch?: typeof fetch; runtime?: ShaheenRuntime }

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
  // «بنك شام»: the ledger reuses the community database when the rest of Core runs on temporary memory.
  const finance = new FinanceService(options.store ? store : createLedgerStore(env, store), env, { fetch: options.fetch });
  const bank = new BankService(finance, env, options.fetch || fetch);
  // Shared with the Shaheen chat router: outcomes + capacity parts, read by the maintenance agent.
  const runtime = options.runtime || new ShaheenRuntime(runningVersion(env));
  const orchestrator = new Orchestrator(repo, { env, fetch: options.fetch });
  // «ذاكرة شاهين»: shared with the Shaheen chat router (server/app.ts); exported to the bots below.
  const memory = new ShaheenMemory(store, env, options.fetch);
  const notifier = createNotifier(env, options.fetch);
  // «منارة شاهين»: SEO/media agent — its own state, engines follow the admin policy, runs are manual or scheduled.
  const seo = createSeoService({ repo, env, fetch: options.fetch });
  const seoRunLimiter = new RateLimiter(4, 10 * 60_000);
  const designLimiter = new RateLimiter(8, 10 * 60_000);
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
  // Each council answer costs several model calls; cap it per client (normal chat keeps working when exceeded).
  const councilLimiter = new RateLimiter(Number(env.SHAM_COUNCIL_RATE_PER_HOUR) || 12, 60 * 60_000);
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
      council: { available: councilAvailable(settings.council, env), seats: activeSeats(settings.council, env).length, auto: settings.council.intents, showDiscussion: settings.council.showDiscussion },
      services: services.map(({ id, kind, nameAr, nameEn, descriptionAr, descriptionEn, formFields, siteTab }) => ({ id, kind, nameAr, nameEn, descriptionAr, descriptionEn, formFields, siteTab })),
    });
  }));

  assistant.post('/chat', wrap(async (req, res) => {
    if (!chatLimiter.allow(clientKey(req))) throw new AssistantError(429, 'RATE_LIMITED', 'Too many messages, please wait a minute');
    const input = validateChatInput(req.body);
    const controller = new AbortController();
    res.on('close', () => { if (!res.writableFinished) controller.abort(); });
    const key = clientKey(req);
    const output = await orchestrator.chat(input, { signal: controller.signal, councilGate: () => councilLimiter.allow(key) });
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
      const key = clientKey(req);
      const output = await orchestrator.chat(input, { signal: controller.signal, onEvent: write, councilGate: () => councilLimiter.allow(key) });
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
    const { council } = await repo.settings();
    const lang = conversation.language === 'ar' || conversation.language === 'fa' ? 'ar' : 'en';
    res.json({
      id: conversation.id, status: conversation.status,
      messages: conversation.messages.map(({ id, role, text, at, engine, actions, citations, council: transcript, stopped }) => ({
        id, role, text, at, engine: engine ? publicEngine(engine).id : engine, actions, citations, ...(stopped ? { stopped } : {}),
        ...(transcript && council.showDiscussion ? { council: publicTranscript(transcript, lang, env) } : {}),
      })),
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

  admin.use('/finance', createFinanceRouter(finance, bank));

  // What this server learned (questions + answers, no visitor data): merged into
  // src/data/live/shaheen-memory.json by scripts/shaheen-memory every two hours.
  admin.get('/shaheen-memory', wrap(async (_req, res) => { res.json(await memory.learned()); }));

  /** «مراجعة التخصصات»: هل المساعد عارف المتجر، وعارف حدوده من شاهين؟ (كاش دقيقة، ?fresh=1 لإعادة التشغيل) */
  admin.get('/assistant/specialties', wrap(async (req, res) => {
    res.json(await reviewSpecialtiesCached(repo, { env }, req.query.fresh === '1'));
  }));

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
      emailNotifications: {
        configured: Boolean(mailProvider(env)),
        provider: mailProviderLabel(env),
        sentCount: getEmailHistory().length,
      },
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
  admin.patch('/requests/:id', wrap(async (req, res) => {
    const id = String(req.params.id);
    const existing = (await repo.requests()).find((r) => r.id === id);
    if (!existing) throw new ValidationError('NOT_FOUND', 'Request not found', 404);

    const oldStatus = existing.status;
    const requestedStatus = req.body?.status as RequestStatus | undefined;
    const isStatusChange = Boolean(requestedStatus && requestedStatus !== oldStatus);
    const customEmailNote = typeof req.body?.customEmailNote === 'string' ? req.body.customEmailNote.trim() : undefined;
    const notifyCustomer = req.body?.notifyCustomer !== false;

    let item = await repo.updateRequest(id, req.body || {});

    let emailNotificationResult = undefined;
    if (isStatusChange && notifyCustomer && item.contact.email) {
      emailNotificationResult = await sendCustomerStatusEmail({
        request: item,
        status: item.status,
        customNote: customEmailNote,
      }, env, options.fetch);

      await notifier.send('order.status_changed', `📦 تحديث حالة الطلب ${item.ref}: ${STATUS_LABELS_AR[item.status]} (${item.contact.name})`, {
        ref: item.ref,
        status: item.status,
        contact: item.contact,
        emailDelivery: emailNotificationResult.delivery,
      });

      const noteText = emailNotificationResult.delivery === 'sent'
        ? `✉️ تم إرسال إشعار بريد إلكتروني للعميل (${item.contact.email}): الحالة "${STATUS_LABELS_AR[item.status]}" عبر ${emailNotificationResult.provider}`
        : emailNotificationResult.delivery === 'simulated'
        ? `✉️ تم تسجيل إشعار بريد إلكتروني للعميل (${item.contact.email}): الحالة "${STATUS_LABELS_AR[item.status]}" (محاكاة)`
        : `⚠️ تعذر إرسال بريد للعميل (${item.contact.email}): ${emailNotificationResult.error || 'خطأ'}`;

      item = await repo.updateRequest(item.id, { note: noteText });
    }

    res.json({ item, emailNotification: emailNotificationResult });
  }));

  admin.post('/requests/:id/notify-email', wrap(async (req, res) => {
    const id = String(req.params.id);
    const item = (await repo.requests()).find((r) => r.id === id);
    if (!item) throw new ValidationError('NOT_FOUND', 'Request not found', 404);
    if (!item.contact.email) throw new ValidationError('NO_EMAIL', 'لا يوجد بريد إلكتروني مسجل لهذا العميل', 400);

    const status = (req.body?.status as RequestStatus) || item.status;
    const customNote = typeof req.body?.customNote === 'string' ? req.body.customNote.trim() : undefined;

    const result = await sendCustomerStatusEmail({
      request: item,
      status,
      customNote,
    }, env, options.fetch);

    const noteText = result.delivery === 'sent'
      ? `✉️ تم إرسال إشعار بريد إلكتروني يدوي (${item.contact.email}): الحالة "${STATUS_LABELS_AR[status]}" عبر ${result.provider}`
      : result.delivery === 'simulated'
      ? `✉️ تم تسجيل إشعار بريد إلكتروني تجريبي يدوي (${item.contact.email}): الحالة "${STATUS_LABELS_AR[status]}"`
      : `⚠️ تعذر إرسال بريد يدوي (${item.contact.email}): ${result.error || 'خطأ'}`;

    const updated = await repo.updateRequest(item.id, { note: noteText });
    res.json({ ok: result.success, item: updated, emailNotification: result });
  }));

  admin.get('/requests/:id/email-preview', wrap(async (req, res) => {
    const id = String(req.params.id);
    const item = (await repo.requests()).find((r) => r.id === id);
    if (!item) throw new ValidationError('NOT_FOUND', 'Request not found', 404);

    const status = (req.query.status as RequestStatus) || item.status;
    const customNote = typeof req.query.customNote === 'string' ? req.query.customNote : undefined;

    const preview = renderOrderStatusEmail({
      request: item,
      status,
      customNote,
    });

    res.json({ preview });
  }));

  admin.get('/emails/history', wrap(async (_req, res) => {
    res.json({ items: getEmailHistory() });
  }));

  admin.post('/emails/test', wrap(async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    if (!email || !email.includes('@')) throw new ValidationError('INVALID_EMAIL', 'البريد الإلكتروني غير صحيح', 400);
    const status = (req.body?.status as RequestStatus) || 'in_progress';
    const customNote = typeof req.body?.customNote === 'string' ? req.body.customNote : 'هذه رسالة تجريبية لاختبار نظام إشعارات البريد الإلكتروني للعملاء من لوحة إدارة شام.';

    const dummyRequest: ServiceRequest = {
      id: 'test-req',
      ref: 'SH-DEMO88',
      type: 'order',
      serviceId: 'store',
      status,
      contact: { name: 'عميل تجريبي', email, phone: '+201000000000' },
      fields: { 'العنوان': 'القاهرة، المعادي', 'طريقة الدفع': 'الدفع عند الاستلام' },
      items: [
        { productId: 'demo-oud-oil', sku: 'DEMO-OUD-30', name: 'زيت عود ملكي فاخر', quantity: 1, unitPrice: 450, currency: 'EGP' },
        { productId: 'demo-bottle', sku: 'DEMO-BTL-50', name: 'زجاجة بخاخ 50 مل فاخرة', quantity: 2, unitPrice: 35, currency: 'EGP' },
      ],
      total: 520,
      currency: 'EGP',
      notes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await sendCustomerStatusEmail({
      request: dummyRequest,
      status,
      customNote,
    }, env, options.fetch);

    res.json({ ok: result.success, emailNotification: result });
  }));

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
    const text = typeof req.body?.text === 'string' ? req.body.text.trim().slice(0, 4000) : '';
    if (!text) throw new ValidationError('INVALID_MESSAGE', 'Reply text is required');
    const conversation = await orchestrator.addHumanReply(String(req.params.id), text);
    if (!conversation) throw new ValidationError('NOT_FOUND', 'Conversation not found', 404);
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

  /** «خبير التصميم متعدد التخصصات»: supervised admin-only plans and audits; never creates final assets or applies site changes automatically. */
  admin.post('/design/brief', wrap(async (req, res) => {
    if (!designLimiter.allow(clientKey(req))) throw new AssistantError(429, 'RATE_LIMITED', 'طلبات تصميم كثيرة، انتظر دقائق ثم حاول مرة أخرى.');
    const input = validateDesignRequest(req.body);
    const product = input.productId
      ? (await repo.products()).find((item) => item.id === input.productId)
      : undefined;
    if (input.productId && !product) throw new AssistantError(404, 'PRODUCT_NOT_FOUND', 'المنتج المختار غير موجود أو غير متاح في الكتالوج.');
    const settings = await repo.settings();
    res.json(await createDesignBrief(input, { settings: settings.shaheen, env, fetch: options.fetch, product }));
  }));

  admin.post('/notifications/test', wrap(async (_req, res) => {
    if (!notifier.configured) throw new ValidationError('NOT_CONFIGURED', 'Set SHAM_WEBHOOK_URL (https) on the server first', 409);
    res.json({ delivered: await notifier.send('test', '✅ اختبار إشعارات Sham Core', {}) });
  }));

  const settingsView = async () => ({
    item: await repo.settings(), engines: engineStatuses(env),
    // «صحة المحركات»: parked engines (reason + return time) as Shaheen's chat sees them on this instance.
    health: runtime.health.snapshot(),
    shaheen: { source: await repo.shaheenSource(), defaults: SHAHEEN_SITE_SETTINGS },
    storage: { kind: store.kind, persistent: store.persistent, error: storeError },
  });
  admin.get('/settings', wrap(async (_req, res) => { res.json(await settingsView()); }));
  admin.put('/settings', wrap(async (req, res) => { await repo.updateSettings(req.body || {}); res.json(await settingsView()); }));

  /** «الخبير شاهين»: real one-line request to every allowed engine (wrong key / model / server shows up here). */
  const probeLimiter = new RateLimiter(10, 10 * 60_000);
  admin.post('/shaheen/test', wrap(async (req, res) => {
    if (!probeLimiter.allow(clientKey(req))) throw new AssistantError(429, 'RATE_LIMITED', 'Too many tests, wait a few minutes');
    res.json({ results: await probeEngines((await repo.settings()).shaheen, { env, fetch: options.fetch, health: runtime.health }), health: runtime.health.snapshot() });
  }));

  /** Sandbox: same pipeline as visitors, plus the full trace. */
  admin.post('/test-chat', wrap(async (req, res) => {
    const input = validateChatInput({ visitorId: 'admin-sandbox', ...req.body });
    res.json(await orchestrator.chat(input, { debug: true }));
  }));

  /** Maintenance agent («طبيب شاهين», scripts/doctor): health of this instance + safe runtime remedies. */
  admin.get('/maintenance', wrap(async (_req, res) => {
    const settings = await repo.settings();
    res.json({
      ...runtime.snapshot(),
      engines: engineStatuses(env).filter((e) => e.id !== 'sham_local').map(({ id, configured }) => ({ id, configured })),
      shaheen: { enabled: settings.shaheen.enabled, engines: settings.shaheen.engines },
      storage: { kind: store.kind, persistent: store.persistent, error: storeError },
    });
  }));
  admin.post('/maintenance', wrap(async (req, res) => {
    const requested = Array.isArray(req.body?.actions) ? req.body.actions : [req.body?.action];
    if (!requested.length || requested.some((a: unknown) => !MAINTENANCE_ACTIONS.includes(a as MaintenanceAction))) {
      throw new AssistantError(400, 'INVALID_ACTION', `action must be one of ${MAINTENANCE_ACTIONS.join(', ')}`);
    }
    res.json({ results: (requested as MaintenanceAction[]).map((a) => runtime.act(a)), snapshot: runtime.snapshot() });
  }));

  // ---- «منارة شاهين»: the SEO/media agent (state, files, engines, one run at a time) ----
  admin.get('/seo', wrap(async (_req, res) => {
    const state = await seo.loadState();
    const pages = await seo.pagesFile();
    res.json({
      state, pages, siteUrl: seo.siteUrl, busy: seo.busy(),
      sitemapUrls: seo.sitemapCount(),
      engines: engineStatuses(env).filter((e) => e.id !== 'sham_local').map(({ id, model, configured }) => ({ id, model, configured })),
      storage: { kind: store.kind, persistent: store.persistent, error: storeError },
    });
  }));
  /** 202: the cycle (audit + AI review + submissions) outlives the HTTP request; the panel polls /seo. */
  admin.post('/seo/run', wrap(async (req, res) => {
    if (!seoRunLimiter.allow(clientKey(req))) throw new AssistantError(429, 'RATE_LIMITED', 'Too many SEO runs, wait a few minutes');
    if (seo.busy()) throw new AssistantError(409, 'SEO_BUSY', 'A SEO cycle is already running');
    const submit = req.body?.submit === true;
    void seo.run({ submit, trigger: 'admin' }).catch((error) => console.error('[SEO] run failed:', error));
    res.status(202).json({ accepted: true, submit, startedAt: new Date().toISOString() });
  }));

  admin.get('/export', wrap(async (_req, res) => {
    const collections: CollectionName[] = ['settings', 'services', 'products', 'knowledge', 'requests', 'conversations', 'gaps', 'visitors'];
    const out: Record<string, unknown> = { exportedAt: new Date().toISOString(), storage: store.kind };
    for (const c of collections) out[c] = await store.list(c);
    res.setHeader('Content-Disposition', `attachment; filename="sham-core-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(out);
  }));

  return { assistant, admin, repo, orchestrator, store, runtime, memory, seo, finance, bank };
}
