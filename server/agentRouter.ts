import { supervisorGuidance } from './core/liveData';
import express from 'express';
import { executeAgent } from './agent';
import { agentCapabilities, validateDocuments, ToolInputError } from './agentTools';
import { ChatError, publicChatResult, validateChatRequest } from './shaheen';
import { RateLimiter, clientKey } from './core/rateLimit';
import { capacityConfig, VISITOR_ID } from './core/capacity';
import type { Repository } from './core/repository';
import type { ShaheenRuntime } from './core/maintenance';

/** Separate endpoint: never changes the current chat, voice, specialist or owner-control contracts. */
export function createToolAgentRouter(options: { repo: Repository; runtime?: ShaheenRuntime;
  env?: Record<string, string | undefined>; fetch?: typeof fetch }) {
  const env = options.env || process.env;
  const capacity = capacityConfig(env);
  const visitors = new RateLimiter(capacity.perVisitorPerMin, 60000);
  const ips = new RateLimiter(capacity.perIpPerMin, 60000);
  const active = new Set<string>();
  const router = express.Router();
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.get('/capabilities', async (_req, res) => {
    try {
      const settings = (await options.repo.settings()).shaheen;
      const capabilities = agentCapabilities(env);
      res.json({ ...capabilities, enabled: settings.enabled, ...(settings.enabled ? {} : { tools: [] }) });
    } catch { res.status(503).json({ code: 'SETTINGS_UNAVAILABLE', error: 'Agent configuration unavailable' }); }
  });
  router.post('/chat', async (req, res) => {
    const started = Date.now();
    const controller = new AbortController();
    const cancel = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', cancel);
    let owner: string | undefined;
    let acquired = false;
    try {
      const input = validateChatRequest(req.body);
      if (req.body.webSearch !== undefined && typeof req.body.webSearch !== 'boolean') throw new ChatError(400, 'INVALID_AGENT_REQUEST', 'Search consent must be boolean');
      let documents;
      try { documents = validateDocuments(req.body.documents); }
      catch (error) { if (error instanceof ToolInputError) throw new ChatError(400, 'INVALID_AGENT_REQUEST', error.message); throw error; }
      const ip = clientKey(req);
      const browser = typeof req.body.visitorId === 'string' ? req.body.visitorId : '';
      owner = browser && VISITOR_ID.test(browser) ? `${ip}|${browser}` : ip;
      if (!visitors.allow(owner) || !ips.allow(ip)) throw new ChatError(429, 'RATE_LIMITED', 'Too many requests', 60000);
      if (active.has(owner) || active.size >= Math.max(1, capacity.maxConcurrent)) throw new ChatError(503, 'SHAHEEN_BUSY', 'Agent busy', 4000);
      active.add(owner); acquired = true;
      const saved = (await options.repo.settings()).shaheen;
      const settings = { ...saved, instructions: saved.instructions + await supervisorGuidance('shaheen_chat', env, options.fetch).catch(() => '') };
      const result = await executeAgent(input, documents, { env, settings, signal: controller.signal,
        fetch: options.fetch, allowWebSearch: req.body.webSearch === true });
      options.runtime?.record({ ms: Date.now() - started, status: 200 });
      if (!res.destroyed) res.json({ ...publicChatResult({ reply: result.reply, mode: input.model }, input.message), toolReport: result.agent });
    } catch (error) {
      const status = error instanceof ChatError ? error.status : 500;
      const code = error instanceof ChatError ? error.code : 'AGENT_FAILED';
      options.runtime?.record({ ms: Date.now() - started, status, code });
      if (error instanceof ChatError && error.retryAfterMs) res.setHeader('Retry-After', String(Math.ceil(error.retryAfterMs / 1000)));
      if (!res.destroyed) res.status(status).json({ code, error: error instanceof ChatError ? error.message : 'Agent failed' });
    } finally {
      if (acquired && owner) active.delete(owner);
      res.off('close', cancel);
    }
  });
  return router;
}
