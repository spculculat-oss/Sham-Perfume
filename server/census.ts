/**
 * «روبوت التعداد وإحصاء الزيارات — دولة المنصة» (Server Ledger & Public Statement API)
 *
 * Counts real platform visits and publishes an aggregated, privacy-preserving ledger:
 *   - POST /api/census/visit   -> records one human visit (rate-limited, crawler-filtered, admin routes ignored).
 *   - GET  /api/census/public  -> returns the certified «الكشف العلني» & world heatmap snapshot.
 *   - GET  /api/admin/census   -> full diagnostic + storage view for the owner inside `#admin`.
 *
 * Privacy & serverless resilience:
 *   - Statically imports `../src/data/live/platform-census.json` so Vercel (`index.cjs`) and EdgeOne (`index.mjs`)
 *     have the baseline embedded without runtime filesystem access.
 *   - Daily unique-visitor deduplication uses a one-way salted SHA-256 digest in ephemeral memory only;
 *     raw IP addresses, cookies, and personal identifiers are never persisted anywhere.
 */
import { createHash, randomBytes } from 'node:crypto';
import express from 'express';
import bundledCensus from '../src/data/live/platform-census.json';
import { countryFromHeaders } from './checkout';
import { RateLimiter, clientKey } from './core/rateLimit';
import type { Store } from './core/store';
import { isCountry } from '../src/utils/pricing';
import {
  buildPublicStatement,
  cairoDay,
  mergeCensusReports,
  readCensusReport,
  recordCensusVisit,
  sanitizeCensusSection,
  type CensusDevice,
  type CensusReport,
} from '../src/utils/platformCensus';

const BOT_UA_RE = /(?:googlebot|bingbot|yandexbot|duckduckbot|baiduspider|applebot|facebookexternalhit|twitterbot|linkedinbot|discordbot|telegrambot|slackbot|whatsapp|semrushbot|ahrefsbot|mj12bot|dotbot|petalbot|\bbot\b|spider|crawler|slurp|mediapartners|headlesschrome|phantomjs|lighthouse|pagespeed|pingdom|uptimerobot|statuscake|datadog|curl\/|wget\/|python-requests|go-http-client|apache-httpclient|axios\/|node-fetch|sham-state-census-bot)/i;

export function isBotUserAgent(ua: string | undefined): boolean {
  if (!ua) return false;
  return BOT_UA_RE.test(ua);
}

export function detectDeviceFromUa(ua: string | undefined, hint?: unknown): CensusDevice {
  if (hint === 'mobile' || hint === 'tablet' || hint === 'desktop') return hint;
  const s = (ua || '').toLowerCase();
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/.test(s)) return 'tablet';
  if (/mobi|iphone|ipod|android|blackberry|iemobile|opera mini/.test(s)) return 'mobile';
  return 'desktop';
}

export interface CensusServiceOptions {
  store: Store;
  baseline?: unknown;
  now?: () => Date;
}

export function createCensusService(options: CensusServiceOptions) {
  const { store } = options;
  const nowFn = options.now || (() => new Date());
  const baseline = readCensusReport(options.baseline ?? bundledCensus, nowFn());
  const visitLimiter = new RateLimiter(30, 60_000);

  // Ephemeral, daily-rotated salted visitor set — never written to disk or DB.
  let saltDay = cairoDay(nowFn());
  let dailySalt = randomBytes(16).toString('hex');
  const seenToday = new Set<string>();
  const seenCountryToday = new Set<string>();

  const checkDailyUnique = (fingerprintSource: string, country: string, today: string) => {
    if (today !== saltDay) {
      saltDay = today;
      dailySalt = randomBytes(16).toString('hex');
      seenToday.clear();
      seenCountryToday.clear();
    }
    const digest = createHash('sha256').update(`${dailySalt}|${fingerprintSource}`).digest('hex').slice(0, 16);
    const isUniqueToday = !seenToday.has(digest);
    if (isUniqueToday && seenToday.size < 50_000) seenToday.add(digest);
    const countryDigest = `${country}:${digest}`;
    const isUniqueForCountry = !seenCountryToday.has(countryDigest);
    if (isUniqueForCountry && seenCountryToday.size < 60_000) seenCountryToday.add(countryDigest);
    return { isUniqueToday, isUniqueForCountry };
  };

  let mutating: Promise<unknown> = Promise.resolve();
  const serialize = <T>(work: () => Promise<T>): Promise<T> => {
    const op = mutating.catch(() => {}).then(work);
    mutating = op.catch(() => {});
    return op;
  };

  async function load(): Promise<CensusReport> {
    const now = nowFn();
    const saved = await store.get('census', 'state');
    const storedReport = saved ? readCensusReport(saved, now) : readCensusReport(baseline, now);
    return mergeCensusReports(readCensusReport(baseline, now), storedReport, now);
  }

  async function record(input: {
    headers: Record<string, string | string[] | undefined>;
    ipKey: string;
    body?: Record<string, unknown>;
  }): Promise<{ recorded: boolean; ignoredReason?: string; country?: string; report: CensusReport }> {
    const ua = typeof input.headers['user-agent'] === 'string' ? input.headers['user-agent'] : undefined;
    if (isBotUserAgent(ua)) {
      return { recorded: false, ignoredReason: 'bot', report: await load() };
    }
    const rawSection = typeof input.body?.section === 'string' ? input.body.section : 'home';
    const section = sanitizeCensusSection(rawSection);
    if (!section) {
      return { recorded: false, ignoredReason: 'admin_route', report: await load() };
    }

    const edgeCountry = countryFromHeaders(input.headers);
    const bodyCountry = typeof input.body?.country === 'string' && isCountry(input.body.country.trim().toUpperCase())
      ? input.body.country.trim().toUpperCase()
      : undefined;
    const country = edgeCountry || bodyCountry || 'UN';
    const device = detectDeviceFromUa(ua, input.body?.device);
    const acceptLang = typeof input.headers['accept-language'] === 'string'
      ? input.headers['accept-language'].split(',')[0]?.split(';')[0]?.trim()
      : undefined;
    const lang = typeof input.body?.lang === 'string' && input.body.lang.trim() ? input.body.lang.trim() : (acceptLang || 'ar');

    return serialize(async () => {
      const current = await load();
      const now = nowFn();
      const today = cairoDay(now);
      const { isUniqueToday, isUniqueForCountry } = checkDailyUnique(`${input.ipKey}|${(ua || '').slice(0, 80)}`, country, today);
      const updated = recordCensusVisit(current, {
        country,
        section,
        device,
        lang,
        isUniqueToday,
        isUniqueEver: isUniqueToday && isUniqueForCountry,
        at: now,
      });
      await store.put('census', 'state', { ...updated, id: 'state' });
      return { recorded: true, country, report: updated };
    });
  }

  const router = express.Router();
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  router.get('/public', async (_req, res) => {
    try {
      const now = nowFn();
      const report = await load();
      res.json({
        ok: true,
        report,
        statement: buildPublicStatement(report, now),
        storage: { kind: store.kind, persistent: store.persistent },
      });
    } catch (error) {
      console.error('[Census] GET /public failed:', error instanceof Error ? error.message : error);
      res.status(500).json({ ok: false, error: 'Census unavailable' });
    }
  });

  router.post('/visit', async (req, res) => {
    try {
      const key = clientKey(req);
      if (!visitLimiter.allow(key)) {
        res.status(429).json({ ok: false, recorded: false, code: 'RATE_LIMITED' });
        return;
      }
      const out = await record({
        headers: req.headers as Record<string, string | string[] | undefined>,
        ipKey: key,
        body: req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {},
      });
      res.status(out.recorded ? 201 : 200).json({
        ok: true,
        recorded: out.recorded,
        ...(out.ignoredReason ? { reason: out.ignoredReason } : {}),
        ...(out.country ? { country: out.country } : {}),
        totals: out.report.totals,
      });
    } catch (error) {
      console.error('[Census] POST /visit failed:', error instanceof Error ? error.message : error);
      res.status(500).json({ ok: false, error: 'Could not record visit' });
    }
  });

  return { load, record, router, store };
}
