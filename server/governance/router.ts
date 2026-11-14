import express from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Store } from '../core/store';
import { ValidationError } from '../core/repository';
import { RateLimiter, clientKey } from '../core/rateLimit';
import { GovernanceService } from './service';
import { adminSecret } from '../core/adminSecret';

/** Mounted AFTER admin auth. The separate owner secret is never bundled or logged. */
export function createGovernanceRouter(store: Store, env: Record<string, string | undefined>) {
  const router = express.Router();
  const service = new GovernanceService(store);
  const failures = new RateLimiter(10, 15 * 60_000);
  const writes = new RateLimiter(60, 60_000);
  const digest = (s: string) => createHash('sha256').update(s).digest();
  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    const secret = env.SHAM_GOVERNANCE_OWNER_TOKEN?.trim() || '';
    if (secret.length < 24 || secret === adminSecret(env)) {
      res.status(503).json({ code: 'OWNER_NOT_CONFIGURED', error: 'يلزم إعداد مفتاح حوكمة خاص مستقل عن مفتاح الإدارة على الخادم.' }); return;
    }
    const provided = req.get('X-Sham-Owner') || '';
    if (!provided || !timingSafeEqual(digest(provided), digest(secret))) {
      const allowed = failures.allow(clientKey(req));
      res.status(allowed ? 403 : 429).json({ code: allowed ? 'OWNER_REQUIRED' : 'RATE_LIMITED', error: allowed ? 'صلاحية المالك الخاصة مطلوبة.' : 'محاولات كثيرة. حاول لاحقاً.' }); return;
    }
    if (req.method !== 'GET' && !writes.allow(clientKey(req))) {
      res.status(429).json({ code: 'RATE_LIMITED', error: 'طلبات كثيرة. حاول لاحقاً.' }); return;
    }
    next();
  });
  const handle = (fn: (req: express.Request) => Promise<unknown>): express.RequestHandler => (req, res) => {
    fn(req).then((data) => res.json(data)).catch((e) => {
      if (e instanceof ValidationError) res.status(e.status).json({ code: e.code, error: e.message });
      else res.status(500).json({ code: 'GOVERNANCE_UNAVAILABLE', error: 'تعذر الوصول لسجل الحوكمة. لم يتم تأكيد الحفظ؛ حدّث السجل قبل المحاولة.' });
    });
  };
  router.get('/', handle(async () => ({ ...await service.read(), storage: store.kind })));
  router.post('/commands', handle((req) => service.command(req.body)));
  return router;
}
