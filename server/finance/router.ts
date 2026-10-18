/** Mounted ONLY after Sham Core's admin authentication middleware. */
import express from 'express';
import { ValidationError } from '../core/repository';
import { RateLimiter, clientKey } from '../core/rateLimit';
import { isCountry } from '../../src/utils/pricing';
import { FinanceService } from './service';
import type { PeriodKind } from './types';

function periodInput(kind: unknown, offset: unknown): { kind: PeriodKind; offset: number } {
  const k = kind === undefined ? 'daily' : kind;
  const n = offset === undefined ? 0 : Number(offset);
  if (!['daily', 'weekly', 'monthly'].includes(k as string) || !Number.isInteger(n) || n > 0 || n < -366) throw new ValidationError('INVALID_PERIOD', 'اختر فترة يومية أو أسبوعية أو شهرية وإزاحة بين 0 و-366.');
  return { kind: k as PeriodKind, offset: n };
}
export function createFinanceRouter(finance: FinanceService) {
  const router = express.Router();
  const limiter = new RateLimiter(4, 10 * 60_000);
  const wrap = (work: (req: express.Request, res: express.Response) => Promise<unknown>) => (req: express.Request, res: express.Response) => {
    res.setHeader('Cache-Control', 'private, no-store');
    work(req, res).catch((e) => {
      // Never echo database errors, gateway payloads, credentials or user input.
      if (e instanceof ValidationError) res.status(e.status).json({ code: e.code, error: e.message });
      else res.status(503).json({ code: 'FINANCE_UNAVAILABLE', error: 'تعذّر قراءة أو حفظ السجل المالي؛ لم نؤكد نجاح العملية. أعد المحاولة بنفس معرف القيد.' });
    });
  };
  router.get('/', wrap(async (req, res) => {
    const { kind, offset } = periodInput(req.query.period, req.query.offset);
    const country = req.query.country === undefined ? 'EG' : String(req.query.country);
    if (!isCountry(country)) throw new ValidationError('INVALID_COUNTRY', 'بلد غير صالح.');
    res.json(await finance.dashboard(kind, offset, country));
  }));
  router.get('/status', wrap(async (_req, res) => { res.json(await finance.status()); }));
  router.post('/run', wrap(async (req, res) => {
    if (!limiter.allow(clientKey(req))) throw new ValidationError('RATE_LIMITED', 'انتظر قبل إعادة الفحص.', 429);
    res.json(await finance.run(req.body?.trigger === 'schedule' ? 'schedule' : 'admin'));
  }));
  router.put('/registration', wrap(async (req, res) => { res.json({ item: await finance.saveRegistration(req.body) }); }));
  router.post('/entries', wrap(async (req, res) => { res.status(201).json({ item: await finance.addEntry(req.body) }); }));
  router.post('/entries/:id/reverse', wrap(async (req, res) => { res.json({ item: await finance.reverseEntry(String(req.params.id), req.body?.reason) }); }));
  router.post('/issues/:id/acknowledge', wrap(async (req, res) => { await finance.acknowledge(String(req.params.id)); res.json({ ok: true }); }));
  router.post('/review', wrap(async (req, res) => {
    const { kind, offset } = periodInput(req.body?.period, req.body?.offset);
    if (req.body?.confirmed !== true) throw new ValidationError('CONFIRMATION_REQUIRED', 'أكد اكتمال مراجعة المصروفات لهذه الفترة.');
    await finance.reviewExpenses(kind, offset, req.body?.fingerprint); res.json({ ok: true });
  }));
  router.get('/export', wrap(async (_req, res) => {
    const collections = ['financeOrders', 'financeSessions', 'financeEntries', 'financeReports', 'financeReviews', 'financeIssues', 'financeRuns', 'paymentRegistrations'] as const;
    const data: Record<string, unknown> = { exportedAt: new Date().toISOString(), version: 1 };
    for (const c of collections) data[c] = await finance.store.list(c);
    res.setHeader('Content-Disposition', 'attachment; filename="sham-finance-private.json"'); res.json(data);
  }));
  return router;
}
