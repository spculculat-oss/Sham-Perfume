/**
 * «إشارات المعمل» — the recorder of «روبوت سلوك الزائر العطري» (bot `scent_behavior`).
 *
 *   POST /api/lab/signal        one deliberate press of the lab's share button → one anonymous design counted
 *   GET  /api/admin/lab-signals the aggregate counters (admin token) for the robot and the control centre
 *
 * Privacy, by construction: the body is a strict shape (material ids + type + coarse band). Anything else is
 * rejected. No visitor id, no IP, no name, no title and no free text is stored, and nothing is linked to a
 * person: the record is a set of counters (`src/utils/labSignals.ts`). The robot
 * (`scripts/shaheen-scent/run.mts`, report `src/data/live/scent-behavior.json`) reads it with the admin token
 * and proposes new materials; with no token it says honestly that no visitor signal was read.
 */
import express from 'express';
import { EMPTY_LAB_AGGREGATE, addLabSignal, readLabAggregate, readLabSignalPayload, type LabAggregate } from '../src/utils/labSignals';
import { RateLimiter, clientKey } from './core/rateLimit';
import type { Store } from './core/store';
import { isBotUserAgent } from './census';

export interface LabSignalsServiceOptions {
  store: Store;
  now?: () => Date;
}

export function createLabSignalsService(options: LabSignalsServiceOptions) {
  const { store } = options;
  const nowFn = options.now || (() => new Date());
  const limiter = new RateLimiter(20, 60_000);

  async function load(): Promise<LabAggregate> {
    try {
      const saved = await store.get('labSignals', 'state');
      return saved ? readLabAggregate(saved) : { ...EMPTY_LAB_AGGREGATE };
    } catch {
      return { ...EMPTY_LAB_AGGREGATE };
    }
  }

  let mutating: Promise<unknown> = Promise.resolve();
  const serialize = <T,>(work: () => Promise<T>): Promise<T> => {
    const op = mutating.catch(() => {}).then(work);
    mutating = op.catch(() => {});
    return op;
  };

  async function record(raw: unknown, headers: Record<string, string | string[] | undefined>): Promise<{ recorded: boolean; reason?: string }> {
    const ua = typeof headers['user-agent'] === 'string' ? headers['user-agent'] : undefined;
    if (isBotUserAgent(ua)) return { recorded: false, reason: 'bot' };
    const payload = readLabSignalPayload(raw);
    if (!payload) return { recorded: false, reason: 'invalid' };
    return serialize(async () => {
      const current = await load();
      const next = addLabSignal(current, payload, nowFn());
      await store.put('labSignals', 'state', { ...next, id: 'state' });
      return { recorded: true };
    });
  }

  const router = express.Router();
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  router.post('/signal', async (req, res) => {
    if (!limiter.allow(clientKey(req))) {
      res.status(429).json({ ok: false, code: 'RATE_LIMITED' });
      return;
    }
    try {
      const result = await record(req.body, req.headers);
      if (!result.recorded && result.reason === 'invalid') {
        res.status(400).json({ ok: false, code: 'INVALID_SIGNAL' });
        return;
      }
      // An ignored bot request answers 200: a crawler learns nothing about the filter.
      res.json({ ok: true, recorded: result.recorded });
    } catch (error) {
      console.error('[Lab signals] POST /signal failed:', error instanceof Error ? error.message : error);
      res.status(503).json({ ok: false, code: 'LAB_SIGNALS_UNAVAILABLE' });
    }
  });

  return { load, record, router };
}
