/** «إدارة المبيعات» API — mounted under /api/admin/finance/sales (admin authentication is applied above). */
import express from 'express';
import { ValidationError } from '../core/repository';
import { RateLimiter, clientKey } from '../core/rateLimit';
import type { SalesService } from './service';

export function createSalesRouter(sales: SalesService) {
  const router = express.Router();
  const limiter = new RateLimiter(10, 10 * 60_000);
  const wrap = (work: (req: express.Request, res: express.Response) => Promise<unknown>) => (req: express.Request, res: express.Response) => {
    res.setHeader('Cache-Control', 'private, no-store');
    work(req, res).catch((e) => {
      // Never echo storage errors or the owner's input back.
      if (e instanceof ValidationError) res.status(e.status).json({ code: e.code, error: e.message });
      else res.status(503).json({ code: 'SALES_UNAVAILABLE', error: 'تعذّر قراءة أو حفظ مكتب المبيعات؛ العملية لم تُؤكد. أعد المحاولة.' });
    });
  };

  router.get('/', wrap(async (_req, res) => { res.json(await sales.dashboard()); }));
  router.post('/deals', wrap(async (req, res) => { res.status(201).json({ item: await sales.saveDeal(undefined, req.body) }); }));
  router.put('/deals/:id', wrap(async (req, res) => { res.json({ item: await sales.saveDeal(String(req.params.id), req.body) }); }));
  router.post('/deals/:id/move', wrap(async (req, res) => { res.json({ item: await sales.moveDeal(String(req.params.id), req.body) }); }));
  router.delete('/deals/:id', wrap(async (req, res) => { res.json(await sales.deleteDeal(String(req.params.id))); }));
  router.put('/targets', wrap(async (req, res) => { res.json({ item: await sales.saveTarget(req.body) }); }));
  router.post('/study', wrap(async (req, res) => { res.json({ item: await sales.recordStudy(req.body) }); }));
  router.post('/ask', wrap(async (req, res) => {
    if (!limiter.allow(clientKey(req))) throw new ValidationError('RATE_LIMITED', 'انتظر قليلاً قبل سؤال تاني.', 429);
    res.json(await sales.ask(req.body?.question));
  }));
  return router;
}
