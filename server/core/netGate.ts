/**
 * «بوابة الإنترنت» on the server (rules: src/utils/netGate.ts). Every robot asks here instead of going out itself:
 *   POST /api/admin/gate        { kind: 'search' | 'read' | 'ask', bot, q? | url?, lang? }
 *   GET  /api/admin/gate/status  today's counts per robot (no questions, no pages)
 * Mounted under the admin router (Bearer SHAM_ADMIN_TOKEN): the robots in GitHub Actions already carry that secret,
 * and server modules call `sharedNetGate(env)` directly. Nothing is stored: answers live in memory for a while.
 */
import express from 'express';
import { languageOf, readPage, ReadError, webSearch } from '../workspace';
import {
  checkGateRequest, emptyUse, gateCacheKey, GATE_LIMITS, type GateAnswer, type GateKind, type GateRequest, type GateStats, type GateUse,
} from '../../src/utils/netGate';

type Env = Record<string, string | undefined>;
type Lookup = (host: string) => Promise<string[]>;

export class GateError extends Error {
  constructor(public status: number, public code: string, public reasonAr: string) { super(code); }
}

export interface NetGateOptions { env: Env; fetch?: typeof fetch; lookup?: Lookup; now?: () => number }

export function createNetGate({ env, fetch: request = fetch, lookup, now = Date.now }: NetGateOptions) {
  const cache = new Map<string, { answer: GateAnswer; expires: number }>();
  const pending = new Map<string, Promise<GateAnswer>>();
  let day = '';
  let total: GateUse = emptyUse();
  let bots: Record<string, GateUse> = {};
  const today = () => new Date(now()).toISOString().slice(0, 10);
  const roll = () => { const d = today(); if (d !== day) { day = d; total = emptyUse(); bots = {}; } };
  const useOf = (bot: string) => (bots[bot] ||= emptyUse());
  const count = (bot: string, key: keyof GateUse) => { roll(); total[key]++; useOf(bot)[key]++; };

  const remember = (key: string, kind: GateKind, answer: GateAnswer) => {
    cache.delete(key);
    cache.set(key, { answer, expires: now() + GATE_LIMITS.ttlMs[kind] });
    while (cache.size > GATE_LIMITS.cacheEntries) cache.delete(cache.keys().next().value!);
  };

  const search = async (r: GateRequest): Promise<GateAnswer> => {
    const found = await webSearch(r.q!, languageOf(r.lang), { env, fetch: request });
    return { kind: 'search', ...(found.answer ? { answer: found.answer.slice(0, 6000) } : {}), sources: found.results.slice(0, 8), via: found.kind, cached: false, at: new Date(now()).toISOString() };
  };
  const read = async (url: string) => {
    const page = await readPage(url, { fetch: request, ...(lookup ? { lookup } : {}) });
    return { url: page.url, title: page.title, text: page.text.slice(0, GATE_LIMITS.readChars), truncated: page.truncated || page.text.length > GATE_LIMITS.readChars };
  };

  const run = async (r: GateRequest): Promise<GateAnswer> => {
    if (r.kind === 'search') return search(r);
    if (r.kind === 'read') {
      const page = await read(r.url!);
      return { kind: 'read', sources: [{ title: page.title, url: page.url, snippet: '' }], page, via: 'page', cached: false, at: new Date(now()).toISOString() };
    }
    // «ask»: search, then read the first pages for a fuller answer (pages that fail are skipped).
    const found = await search(r);
    const pages: GateAnswer['pages'] = [];
    for (const s of found.sources.slice(0, GATE_LIMITS.askPages)) {
      try { const p = await read(s.url); pages.push({ url: p.url, title: p.title, text: p.text.slice(0, 6000) }); } catch { /* the next page */ }
    }
    return { ...found, kind: 'ask', ...(pages.length ? { pages } : {}) };
  };

  return {
    /** One request from one robot: checked, cleaned, counted, answered from memory when it can be. */
    async fetch(body: unknown): Promise<GateAnswer> {
      roll();
      const check = checkGateRequest(body);
      if (!check.ok) {
        const bot = typeof (body as { bot?: unknown })?.bot === 'string' && check.code !== 'NOT_CLIENT' ? (body as { bot: string }).bot : '';
        if (bot) count(bot, 'refused');
        throw new GateError(check.code === 'NOT_CLIENT' ? 403 : 400, check.code, check.reasonAr);
      }
      const r = check.req;
      const key = gateCacheKey(r);
      const kept = cache.get(key);
      if (kept && kept.expires > now()) {
        count(r.bot, 'cached');
        return { ...kept.answer, cached: true, ...(check.removed ? { removed: check.removed } : {}) };
      }
      if (useOf(r.bot)[r.kind] >= GATE_LIMITS.perBot[r.kind]) { count(r.bot, 'refused'); throw new GateError(429, 'BOT_QUOTA', `الروبوت ده خلّص حصته النهارده من البوابة (${GATE_LIMITS.perBot[r.kind]})، وبترجع بكره.`); }
      if (total[r.kind] >= GATE_LIMITS.daily[r.kind]) { count(r.bot, 'refused'); throw new GateError(429, 'DAILY_QUOTA', 'حصة المنصة كلها من البوابة خلصت النهارده — علشان الحصص المجانية ماتخلصش. بترجع بكره.'); }
      count(r.bot, r.kind);
      let work = pending.get(key);
      if (!work) {
        work = run(r).finally(() => pending.delete(key));
        pending.set(key, work);
      }
      try {
        const answer = await work;
        remember(key, r.kind, answer);
        return { ...answer, ...(check.removed ? { removed: check.removed } : {}) };
      } catch (error) {
        count(r.bot, 'failed');
        if (error instanceof ReadError) throw new GateError(error.status === 400 ? 400 : 502, error.code, error.code === 'PRIVATE_ADDRESS' ? 'عنوان داخلي — البوابة بتقرا المواقع العامة بس.' : 'الموقع ماردش أو الصفحة مش مقروءة.');
        throw new GateError(502, 'UPSTREAM', 'البحث مش متاح دلوقتي — جرّب بعد شوية.');
      }
    },
    stats(): GateStats {
      roll();
      return { day, total: { ...total }, bots: Object.fromEntries(Object.entries(bots).map(([k, v]) => [k, { ...v }])), cacheEntries: cache.size, live: Boolean(env.GEMINI_API_KEY?.trim()) };
    },
  };
}
export type NetGate = ReturnType<typeof createNetGate>;

let shared: { env: Env; gate: NetGate } | undefined;
/** The server's one gate (shared by every module, so the counts and the memory are one). */
export function sharedNetGate(env: Env, request?: typeof fetch): NetGate {
  if (!shared || shared.env !== env || request) shared = { env, gate: createNetGate({ env, ...(request ? { fetch: request } : {}) }) };
  return shared.gate;
}

/** Mounted under `/api/admin/gate`. */
export function createNetGateRouter(gate: NetGate) {
  const router = express.Router();
  router.get('/status', (_req, res) => { res.json(gate.stats()); });
  router.post('/', async (req, res) => {
    try { res.json(await gate.fetch(req.body)); }
    catch (error) {
      if (error instanceof GateError) { res.status(error.status).json({ error: error.reasonAr, code: error.code }); return; }
      res.status(500).json({ error: 'خطأ في البوابة', code: 'GATE_ERROR' });
    }
  });
  return router;
}
