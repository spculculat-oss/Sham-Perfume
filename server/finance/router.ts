/** Mounted ONLY after Sham Core's admin authentication middleware. */
import express from 'express';
import { ValidationError } from '../core/repository';
import { RateLimiter, clientKey } from '../core/rateLimit';
import { isCountry } from '../../src/utils/pricing';
import { FinanceService } from './service';
import type { BankService } from './bank';
import type { SalesService } from '../sales/service';
import { createSalesRouter } from '../sales/router';
import { BUNDLED_FX, isFxTable, type FxTable } from '../../src/utils/pricing';
import { PLATFORM_HOLDER } from '../../src/bank/shamLedger';
import { ShamBooks, readMoneyBody } from './shamBooks';
import { loadLive } from '../core/liveData';
import type { PeriodKind } from './types';

function periodInput(kind: unknown, offset: unknown): { kind: PeriodKind; offset: number } {
  const k = kind === undefined ? 'daily' : kind;
  const n = offset === undefined ? 0 : Number(offset);
  if (!['daily', 'weekly', 'monthly'].includes(k as string) || !Number.isInteger(n) || n > 0 || n < -366) throw new ValidationError('INVALID_PERIOD', 'اختر فترة يومية أو أسبوعية أو شهرية وإزاحة بين 0 و-366.');
  return { kind: k as PeriodKind, offset: n };
}
export function createFinanceRouter(finance: FinanceService, bank?: BankService, sales?: SalesService) {
  const router = express.Router();
  const limiter = new RateLimiter(4, 10 * 60_000);
  const statementLimiter = new RateLimiter(20, 10 * 60_000);
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
  // «إدارة المبيعات»: the desk inside «بنك شام» — the pipeline, targets, rhythm and study over the same real figures.
  if (sales) router.use('/sales', createSalesRouter(sales));
  if (bank) {
    // «بنك شام»: direct collection, statement matching, payables, budgets, analytics and «شاهين المحاسب».
    const bundled = { ...BUNDLED_FX, updatedAt: BUNDLED_FX.updatedAt || '1970-01-01T00:00:00Z' };
    router.get('/bank', wrap(async (_req, res) => {
      const fx: FxTable = await loadLive('fx-rates.json', bundled, isFxTable, finance.env, fetch).catch(() => bundled);
      res.json(await bank.dashboard(fx));
    }));
    router.post('/bank/accounts', wrap(async (req, res) => { res.status(201).json({ item: await bank.saveAccount(undefined, req.body) }); }));
    router.put('/bank/accounts/:id', wrap(async (req, res) => { res.json({ item: await bank.saveAccount(String(req.params.id), req.body) }); }));
    router.post('/bank/direct/:ref/confirm', wrap(async (req, res) => { res.json({ item: await bank.confirm(String(req.params.ref), req.body) }); }));
    router.post('/bank/direct/:ref/reject', wrap(async (req, res) => { res.json({ item: await bank.reject(String(req.params.ref), req.body?.reason) }); }));
    router.post('/bank/statement', express.text({ type: 'text/*', limit: '600kb' }), wrap(async (req, res) => {
      if (!statementLimiter.allow(clientKey(req))) throw new ValidationError('RATE_LIMITED', 'انتظر قليلاً قبل مطابقة كشف آخر.', 429);
      const text = typeof req.body === 'string' ? req.body : req.body?.text;
      res.json(await bank.matchStatement(text, req.query.currency ?? req.body?.currency));
    }));
    router.post('/bank/payables', wrap(async (req, res) => { res.status(201).json({ item: await bank.addPayable(req.body) }); }));
    router.post('/bank/payables/:id/pay', wrap(async (req, res) => { res.json({ item: await bank.payPayable(String(req.params.id)) }); }));
    router.post('/bank/payables/:id/cancel', wrap(async (req, res) => { res.json({ item: await bank.cancelPayable(String(req.params.id)) }); }));
    router.put('/bank/budgets', wrap(async (req, res) => { res.json({ item: await bank.setBudget(req.body) }); }));
    router.post('/bank/ask', wrap(async (req, res) => { res.json(await bank.ask(req.body?.question)); }));
    const books = new ShamBooks(finance.store, () => new Date().toISOString(), () => finance.persistent);
    const house = () => books.open(PLATFORM_HOLDER);
    router.get('/bank/sham', wrap(async (_req, res) => { res.json(await house()); }));
    router.post('/bank/sham/import', wrap(async (_req, res) => {
      const dash = await bank.dashboard();
      res.json(await books.importConfirmed(dash.balances.map((row) => ({ currency: row.currency, minor: row.collectedMinor }))));
    }));
    router.get('/bank/sham/resolve', wrap(async (req, res) => {
      if (!(await books.exists(String(req.query.number || '')))) throw new ValidationError('UNKNOWN_ACCOUNT', 'لا يوجد حساب شام بهذا الرقم. يجب أن يفتح صاحبه البنك أولاً.', 404);
      res.json({ ok: true });
    }));
    router.post('/bank/sham/transfer', wrap(async (req, res) => { res.json(await books.transfer(PLATFORM_HOLDER, readMoneyBody(req.body))); }));
    router.post('/bank/sham/hold', wrap(async (req, res) => { res.json(await books.hold(PLATFORM_HOLDER, readMoneyBody(req.body))); }));
    router.post('/bank/sham/release', wrap(async (req, res) => { res.json(await books.release(PLATFORM_HOLDER, readMoneyBody(req.body).postingId)); }));
    router.post('/bank/sham/convert', wrap(async (req, res) => {
      const body = readMoneyBody(req.body);
      const rates: FxTable = await loadLive('fx-rates.json', bundled, isFxTable, finance.env, fetch).catch(() => bundled);
      res.json(await books.convert(PLATFORM_HOLDER, body, rates));
    }));
  }
  router.get('/export', wrap(async (_req, res) => {
    const collections = ['financeOrders', 'financeSessions', 'financeEntries', 'financeReports', 'financeReviews', 'financeIssues', 'financeRuns', 'paymentRegistrations', 'bankAccounts', 'bankDirect', 'bankPayables', 'bankBudgets', 'bankAudit', 'shamHolders', 'shamPostings', 'shamImports', 'salesDeals', 'salesTargets', 'salesStudy', 'salesAudit'] as const;
    const data: Record<string, unknown> = { exportedAt: new Date().toISOString(), version: 1 };
    for (const c of collections) data[c] = await finance.store.list(c);
    res.setHeader('Content-Disposition', 'attachment; filename="sham-finance-private.json"'); res.json(data);
  }));
  return router;
}
