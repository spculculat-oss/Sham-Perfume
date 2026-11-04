/**
 * «روبوت التعداد وإحصاء الزيارات — دولة المنصة» (Server Ledger, Exact Entry Pinpoints & Live Real-Time Counter)
 *
 * Counts real platform visits, pinpoints city/governorate entry points inside each country, tracks live active
 * visitors (`العداد اللحظي`), and publishes an aggregated, privacy-preserving ledger:
 *   - POST /api/census/visit   -> records one human visit or live heartbeat (rate-limited, crawler-filtered, admin routes ignored).
 *   - GET  /api/census/public  -> returns the certified «الكشف العلني», `liveNow` counter, & country/place heatmap snapshot.
 *   - GET  /api/admin/census   -> full diagnostic + storage view for the owner inside `#admin`.
 *
 * Privacy & serverless resilience:
 *   - Statically imports `../src/data/live/platform-census.json` so Vercel (`index.cjs`) and EdgeOne (`index.mjs`)
 *     have the baseline embedded without runtime filesystem access.
 *   - Daily unique-visitor & live presence deduplication uses a one-way salted SHA-256 digest in ephemeral memory only;
 *     raw IP addresses, cookies, and personal identifiers are never persisted anywhere.
 */
import { createHash, randomBytes } from 'node:crypto';
import express from 'express';
import bundledCensus from '../src/data/live/platform-census.json';
import { geoDetailsFromHeaders, resolveVisitorEntryLocation } from '../src/data/worldEntryGazetteer';
import { countryFromHeaders } from './checkout';
import { RateLimiter, clientKey } from './core/rateLimit';
import type { Store } from './core/store';
import { isCountry } from '../src/utils/pricing';
import {
  COUNTRY_COORDS,
  buildPublicStatement,
  cairoDay,
  countryNameAr,
  countryNameEn,
  mergeCensusReports,
  readCensusReport,
  recordCensusVisit,
  sanitizeCensusSection,
  type CensusDevice,
  type CensusLiveNow,
  type CensusReport,
} from '../src/utils/platformCensus';

const BOT_UA_RE = /(?:googlebot|bingbot|yandexbot|duckduckbot|baiduspider|applebot|facebookexternalhit|twitterbot|linkedinbot|discordbot|telegrambot|slackbot|whatsapp|semrushbot|ahrefsbot|mj12bot|dotbot|petalbot|\bbot\b|spider|crawler|slurp|mediapartners|headlesschrome|phantomjs|lighthouse|pagespeed|pingdom|uptimerobot|statuscake|datadog|curl\/|wget\/|python-requests|go-http-client|apache-httpclient|axios\/|node-fetch|sham-state-census-bot)/i;

const ACTIVE_WINDOW_MS = 120_000; // 2 minutes for live online counter
const FIVE_MIN_MS = 5 * 60_000;
const SIXTY_MIN_MS = 60 * 60_000;

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

interface ActivePresenceRow {
  seenMs: number;
  country: string;
  placeId: string;
  cityAr: string;
  cityEn: string;
  lat: number;
  lon: number;
}

export function createCensusService(options: CensusServiceOptions) {
  const { store } = options;
  const nowFn = options.now || (() => new Date());
  const baseline = readCensusReport(options.baseline ?? bundledCensus, nowFn());
  const visitLimiter = new RateLimiter(45, 60_000);

  // Ephemeral, daily-rotated salted visitor set — never written to disk or DB.
  let saltDay = cairoDay(nowFn());
  let dailySalt = randomBytes(16).toString('hex');
  const seenToday = new Set<string>();
  const seenCountryToday = new Set<string>();
  const seenPlaceToday = new Set<string>();

  // Ephemeral live real-time presence («العداد اللحظي») — in-memory only, never persisted.
  const activePresence = new Map<string, ActivePresenceRow>();
  const recentVisitTimestamps: number[] = [];

  const pruneLiveMemory = (nowMs: number) => {
    for (const [k, row] of activePresence.entries()) {
      if (nowMs - row.seenMs > ACTIVE_WINDOW_MS) activePresence.delete(k);
    }
    while (recentVisitTimestamps.length > 0 && nowMs - recentVisitTimestamps[0]! > SIXTY_MIN_MS) {
      recentVisitTimestamps.shift();
    }
  };

  const visitorDigest = (fingerprintSource: string, today: string) => {
    if (today !== saltDay) {
      saltDay = today;
      dailySalt = randomBytes(16).toString('hex');
      seenToday.clear();
      seenCountryToday.clear();
      seenPlaceToday.clear();
    }
    return createHash('sha256').update(`${dailySalt}|${fingerprintSource}`).digest('hex').slice(0, 16);
  };

  const checkDailyUnique = (digest: string, country: string, placeId: string) => {
    const isUniqueToday = !seenToday.has(digest);
    if (isUniqueToday && seenToday.size < 50_000) seenToday.add(digest);
    const countryDigest = `${country}:${digest}`;
    const isUniqueForCountry = !seenCountryToday.has(countryDigest);
    if (isUniqueForCountry && seenCountryToday.size < 60_000) seenCountryToday.add(countryDigest);
    const placeDigest = `${placeId}:${digest}`;
    const isUniquePlace = !seenPlaceToday.has(placeDigest);
    if (isUniquePlace && seenPlaceToday.size < 80_000) seenPlaceToday.add(placeDigest);
    return { isUniqueToday, isUniqueForCountry, isUniquePlace };
  };

  function liveNow(): CensusLiveNow {
    const now = nowFn();
    const nowMs = now.getTime();
    pruneLiveMemory(nowMs);

    const countryCounts = new Map<string, number>();
    const placeCounts = new Map<string, { placeId: string; country: string; cityAr: string; cityEn: string; lat: number; lon: number; count: number }>();

    for (const row of activePresence.values()) {
      if (row.country && row.country !== 'UN') {
        countryCounts.set(row.country, (countryCounts.get(row.country) || 0) + 1);
        const existingP = placeCounts.get(row.placeId);
        if (existingP) existingP.count += 1;
        else {
          placeCounts.set(row.placeId, {
            placeId: row.placeId,
            country: row.country,
            cityAr: row.cityAr,
            cityEn: row.cityEn,
            lat: row.lat,
            lon: row.lon,
            count: 1,
          });
        }
      }
    }

    const last5mVisits = recentVisitTimestamps.filter((t) => nowMs - t <= FIVE_MIN_MS).length;
    const last60mVisits = recentVisitTimestamps.length;

    return {
      asOf: now.toISOString(),
      activeVisitors: activePresence.size,
      last5mVisits,
      last60mVisits,
      activeCountries: [...countryCounts.entries()]
        .map(([code, count]) => ({ code, count }))
        .sort((a, b) => b.count - a.count),
      activePlaces: [...placeCounts.values()].sort((a, b) => b.count - a.count).slice(0, 25),
    };
  }

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
  }): Promise<{ recorded: boolean; ignoredReason?: string; country?: string; placeId?: string; cityAr?: string; report: CensusReport; liveNow: CensusLiveNow }> {
    const ua = typeof input.headers['user-agent'] === 'string' ? input.headers['user-agent'] : undefined;
    if (isBotUserAgent(ua)) {
      return { recorded: false, ignoredReason: 'bot', report: await load(), liveNow: liveNow() };
    }
    const rawSection = typeof input.body?.section === 'string' ? input.body.section : 'home';
    const section = sanitizeCensusSection(rawSection);
    if (!section) {
      return { recorded: false, ignoredReason: 'admin_route', report: await load(), liveNow: liveNow() };
    }

    const edgeCountry = countryFromHeaders(input.headers);
    const bodyCountry = typeof input.body?.country === 'string' && isCountry(input.body.country.trim().toUpperCase())
      ? input.body.country.trim().toUpperCase()
      : undefined;
    const geoHeaders = geoDetailsFromHeaders(input.headers);
    const clientTz = typeof input.body?.tz === 'string' ? input.body.tz.trim().slice(0, 48) : undefined;
    const initialCountry = edgeCountry || bodyCountry;

    const resolvedLoc = resolveVisitorEntryLocation({
      country: initialCountry,
      cityHeader: geoHeaders.city,
      regionHeader: geoHeaders.region,
      latHeader: geoHeaders.lat,
      lonHeader: geoHeaders.lon,
      timezone: geoHeaders.timezone || clientTz,
      fallbackCoords: initialCountry ? COUNTRY_COORDS[initialCountry] : undefined,
      countryNameAr: initialCountry ? countryNameAr(initialCountry) : undefined,
      countryNameEn: initialCountry ? countryNameEn(initialCountry) : undefined,
    });

    const country = resolvedLoc.country || initialCountry || 'UN';
    const now = nowFn();
    const today = cairoDay(now);
    const digest = visitorDigest(`${input.ipKey}|${(ua || '').slice(0, 80)}`, today);

    // Refresh ephemeral real-time presence («العداد اللحظي»)
    pruneLiveMemory(now.getTime());
    if (activePresence.size < 25_000) {
      activePresence.set(digest, {
        seenMs: now.getTime(),
        country,
        placeId: resolvedLoc.placeId,
        cityAr: resolvedLoc.cityAr,
        cityEn: resolvedLoc.cityEn,
        lat: resolvedLoc.lat,
        lon: resolvedLoc.lon,
      });
    }

    // Heartbeat refreshes live presence without incrementing cumulative visit counters
    if (input.body?.kind === 'heartbeat') {
      return {
        recorded: false,
        ignoredReason: 'heartbeat',
        country,
        placeId: resolvedLoc.placeId,
        cityAr: resolvedLoc.cityAr,
        report: await load(),
        liveNow: liveNow(),
      };
    }

    const device = detectDeviceFromUa(ua, input.body?.device);
    const acceptLang = typeof input.headers['accept-language'] === 'string'
      ? input.headers['accept-language'].split(',')[0]?.split(';')[0]?.trim()
      : undefined;
    const lang = typeof input.body?.lang === 'string' && input.body.lang.trim() ? input.body.lang.trim() : (acceptLang || 'ar');

    return serialize(async () => {
      const current = await load();
      const visitNow = nowFn();
      const visitDay = cairoDay(visitNow);
      const { isUniqueToday, isUniqueForCountry, isUniquePlace } = checkDailyUnique(digest, country, resolvedLoc.placeId);
      const updated = recordCensusVisit(current, {
        country,
        city: geoHeaders.city,
        region: geoHeaders.region,
        lat: geoHeaders.lat,
        lon: geoHeaders.lon,
        timezone: geoHeaders.timezone || clientTz,
        section,
        device,
        lang,
        isUniqueToday,
        isUniqueEver: isUniqueToday && isUniqueForCountry,
        isUniquePlace,
        at: visitNow,
      });
      if (recentVisitTimestamps.length < 50_000) {
        recentVisitTimestamps.push(visitNow.getTime());
      }
      void visitDay;
      await store.put('census', 'state', { ...updated, id: 'state' });
      return {
        recorded: true,
        country,
        placeId: resolvedLoc.placeId,
        cityAr: resolvedLoc.cityAr,
        report: updated,
        liveNow: liveNow(),
      };
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
        liveNow: liveNow(),
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
        ...(out.placeId ? { placeId: out.placeId } : {}),
        ...(out.cityAr ? { cityAr: out.cityAr } : {}),
        totals: out.report.totals,
        liveNow: out.liveNow,
      });
    } catch (error) {
      console.error('[Census] POST /visit failed:', error instanceof Error ? error.message : error);
      res.status(500).json({ ok: false, error: 'Could not record visit' });
    }
  });

  return { load, record, liveNow, router, store };
}
