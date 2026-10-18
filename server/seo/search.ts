/**
 * Push channels of «منارة شاهين». Discovery only — nothing here can promise a ranking.
 *
 *  IndexNow : one POST reaches Bing, Yandex, Naver, Seznam and Yep (and therefore DuckDuckGo/Ecosia/Yahoo/Copilot,
 *             which read Bing's index). The key file must already be live at /<key>.txt.
 *  Bing API : optional BING_WEBMASTER_API_KEY (URL batch + feed submission).
 *  Google   : no account needed — sitemap.xml + feed.xml declared in robots.txt, plus a WebSub ping when the
 *             feed changes. A Search Console service account is optional; Google has no IndexNow, and its
 *             Indexing API only covers JobPosting/BroadcastEvent, so the honest channel is discovery files.
 *  WebSub   : publish ping to public hubs (no key, no account) so feed readers and crawlers hear about updates.
 *  Probes   : fetch our own pages as a crawler would (Googlebot UA) and measure performance with the public,
 *             keyless Lighthouse endpoint — the two things an owner would otherwise read in a console.
 * Every function is pure HTTP with timeouts and returns a structured result; nothing throws.
 */
import { createSign } from 'node:crypto';
import { absoluteUrl, SITE } from '../../src/seo/site';
import { indexNowBody } from '../../src/seo/artifacts';
import { CRAWLER_AGENTS, webSubHubs, webSubPingBody, WEBSUB_DEFAULT_HUB } from '../../src/seo/discovery';

type Env = Record<string, string | undefined>;
type Fetch = typeof fetch;
export interface SubmitResult { ok: boolean; status?: number; detail: string; submitted: number; urls?: string[] }

const safe = (text: string, max = 300) => text.replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * Direct endpoints of the engines that accept IndexNow themselves. The shared endpoint below is the
 * normal route (one POST, all engines); these are the fallback when it is unreachable or refuses the
 * batch, so a single outage cannot silence the whole push. No account or key is needed for any of them:
 * the site's own /<key>.txt proves ownership.
 */
export const INDEXNOW_FALLBACKS = [
  'https://www.bing.com/indexnow',
  'https://yandex.com/indexnow',
  'https://search.seznam.cz/indexnow',
  'https://searchadvisor.naver.com/indexnow',
  'https://api.yep.com/indexnow',
];

export async function submitIndexNow(input: { siteUrl: string; urls: string[]; fetch?: Fetch; key?: string; fallbacks?: string[] }): Promise<SubmitResult> {
  const urls = [...new Set(input.urls.filter((u) => /^https:\/\//i.test(u)))].slice(0, 10_000);
  if (!urls.length) return { ok: false, detail: 'لا صفحات جديدة للإرسال.', submitted: 0 };
  const request = input.fetch || fetch;
  const body = JSON.stringify(indexNowBody(input.siteUrl, urls, input.key || SITE.indexNowKey));
  const post = (endpoint: string) => request(endpoint, {
    method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' },
    body, signal: AbortSignal.timeout(20_000),
  });
  // 200 = accepted, 202 = accepted (key still being validated), 204 = no content: all successful.
  const accepted = (status: number) => [200, 202, 204].includes(status);
  let firstFailure = '';
  try {
    const response = await post('https://api.indexnow.org/indexnow');
    const text = await response.text().catch(() => '');
    if (accepted(response.status)) {
      return { ok: true, status: response.status, submitted: urls.length, urls: urls.slice(0, 50), detail: 'قبلت المحركات الدفع السريع.' };
    }
    firstFailure = `HTTP ${response.status} ${safe(text, 120)}`;
  } catch (error) {
    firstFailure = `تعذّر الوصول إلى نقطة التجميع: ${(error as Error).message}`;
  }
  // Fallback: ask the engines directly, stopping at the first acceptance.
  for (const endpoint of (input.fallbacks || INDEXNOW_FALLBACKS).slice(0, 5)) {
    try {
      const response = await post(endpoint);
      await response.text().catch(() => '');
      if (accepted(response.status)) {
        const host = new URL(endpoint).host;
        return {
          ok: true, status: response.status, submitted: urls.length, urls: urls.slice(0, 50),
          detail: safe(`قُبل الدفع عبر ${host} بعد تعذّر النقطة المشتركة (${firstFailure}).`, 240),
        };
      }
    } catch { /* try the next direct endpoint */ }
  }
  return { ok: false, detail: safe(`لم يقبل أي محرك الدفع: ${firstFailure}`, 240), submitted: 0 };
}

export interface WebSubHubResult { url: string; status?: number; ok: boolean }
export interface WebSubResult extends SubmitResult { hubs: WebSubHubResult[] }

/**
 * Publish ping to WebSub hubs: `hub.mode=publish&hub.url=<feed>`.
 *
 * It is a notification, not an index request: it tells feed readers (and anything subscribed to the
 * feed) that the document changed. Hubs answer 204 on success; a retired hub is recorded, not fatal,
 * because the remaining hubs still carry the ping.
 */
export async function submitWebSub(input: { siteUrl: string; env?: Env; fetch?: Fetch; hubs?: string[] }): Promise<WebSubResult> {
  const hubs = (input.hubs || webSubHubs(input.env || {})).slice(0, 4);
  const feedUrl = absoluteUrl('feed.xml', input.siteUrl);
  const request = input.fetch || fetch;
  const results: WebSubHubResult[] = [];
  for (const hub of hubs) {
    try {
      const response = await request(hub, {
        method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded; charset=utf-8' },
        body: webSubPingBody(feedUrl).toString(), signal: AbortSignal.timeout(15_000),
      });
      await response.text().catch(() => '');
      results.push({ url: hub, status: response.status, ok: [200, 202, 204].includes(response.status) });
    } catch {
      results.push({ url: hub, ok: false });
    }
  }
  const accepted = results.filter((hub) => hub.ok);
  return {
    ok: accepted.length > 0, hubs: results, submitted: accepted.length,
    status: accepted[0]?.status,
    detail: accepted.length
      ? `أُشعر ${accepted.length} من ${results.length} محاور بأن الخلاصة تغيّرت.`
      : 'لم يستجب أي محور إشعار؛ الإشعار اختياري ولا يوقف الظهور.',
  };
}

export interface CrawlCheck { url: string; status?: number; ok: boolean; reason: string }
export interface CrawlProbe { at: string; ua: string; checked: number; ok: number; results: CrawlCheck[] }

/**
 * Fetch pages with the crawler's own user agent and look for anything that blocks indexing.
 *
 * This is the part of an index-coverage report that can be reproduced from outside the property:
 * status code, content type, X-Robots-Tag and the page's own robots meta. It cannot say whether a URL
 * is indexed, and it never claims to.
 */
export async function probeCrawlerAccess(input: { urls: string[]; fetch?: Fetch; ua?: string; limit?: number }): Promise<CrawlProbe> {
  const request = input.fetch || fetch;
  const ua = input.ua || CRAWLER_AGENTS.googlebot;
  const urls = [...new Set(input.urls)].slice(0, input.limit || 3);
  const results: CrawlCheck[] = [];
  for (const url of urls) {
    try {
      const response = await request(url, {
        headers: { 'user-agent': ua, accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8' },
        redirect: 'follow', signal: AbortSignal.timeout(20_000),
      });
      const type = response.headers.get('content-type') || '';
      const xRobots = response.headers.get('x-robots-tag') || '';
      const html = type.includes('html') ? await response.text().catch(() => '') : '';
      if (!response.ok) results.push({ url, status: response.status, ok: false, reason: `رمز الاستجابة ${response.status}` });
      else if (type && !type.includes('html')) results.push({ url, status: response.status, ok: false, reason: `نوع المحتوى ${type.split(';')[0]}` });
      else if (/noindex|none/i.test(xRobots)) results.push({ url, status: response.status, ok: false, reason: 'ترويسة X-Robots-Tag تمنع الفهرسة' });
      else if (/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*(noindex|none)/i.test(html)) results.push({ url, status: response.status, ok: false, reason: 'وسم robots داخل الصفحة يمنع الفهرسة' });
      else results.push({ url, status: response.status, ok: true, reason: 'الصفحة متاحة والفهرسة غير محجوبة' });
    } catch (error) {
      results.push({ url, ok: false, reason: safe(`تعذّر الطلب: ${(error as Error).message}`, 160) });
    }
  }
  return { at: new Date().toISOString(), ua, checked: results.length, ok: results.filter((r) => r.ok).length, results };
}

export interface PageSpeedResult {
  ok: boolean; at: string; url: string; status?: number;
  scores: { performance?: number; seo?: number; accessibility?: number; bestPractices?: number };
  vitals?: { lcpMs?: number; cls?: number; tbtMs?: number };
  detail: string;
}

/**
 * Performance without an account: the public Lighthouse endpoint accepts a URL and returns category
 * scores plus the metrics behind them. No key, no property ownership; it is rate-limited, so a cycle
 * asks at most once a day and treats a failure as "not measured", never as a pass.
 */
export async function probePageSpeed(input: { url: string; fetch?: Fetch; strategy?: 'mobile' | 'desktop' }): Promise<PageSpeedResult> {
  const strategy = input.strategy || 'mobile';
  const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  endpoint.searchParams.set('url', input.url);
  endpoint.searchParams.set('strategy', strategy);
  for (const category of ['performance', 'seo', 'accessibility', 'best-practices']) endpoint.searchParams.append('category', category);
  const at = new Date().toISOString();
  try {
    const response = await (input.fetch || fetch)(endpoint.href, { signal: AbortSignal.timeout(90_000) });
    const body = await response.json().catch(() => ({})) as {
      error?: { message?: string };
      lighthouseResult?: {
        categories?: Record<string, { score?: number }>;
        audits?: Record<string, { numericValue?: number }>;
      };
    };
    if (!response.ok || !body.lighthouseResult) {
      return { ok: false, at, url: input.url, status: response.status, scores: {}, detail: safe(`تعذّر القياس: ${body.error?.message || `HTTP ${response.status}`}`, 220) };
    }
    const category = (id: string) => {
      const score = body.lighthouseResult?.categories?.[id]?.score;
      return typeof score === 'number' ? Math.round(score * 100) : undefined;
    };
    const audit = (id: string) => {
      const value = body.lighthouseResult?.audits?.[id]?.numericValue;
      return typeof value === 'number' ? Math.round(value * 1000) / 1000 : undefined;
    };
    const scores = { performance: category('performance'), seo: category('seo'), accessibility: category('accessibility'), bestPractices: category('best-practices') };
    const vitals = { lcpMs: audit('largest-contentful-paint'), cls: audit('cumulative-layout-shift'), tbtMs: audit('total-blocking-time') };
    return { ok: true, at, url: input.url, status: response.status, scores, vitals, detail: 'قياس Lighthouse العام (بلا مفتاح).' };
  } catch (error) {
    return { ok: false, at, url: input.url, scores: {}, detail: safe(`تعذّر الوصول إلى القياس: ${(error as Error).message}`, 220) };
  }
}

/** Bing Webmaster API: submit the sitemap feed and (optionally) a URL batch. */
export async function submitBing(input: { siteUrl: string; urls: string[]; env: Env; fetch?: Fetch }): Promise<SubmitResult> {
  const key = input.env.BING_WEBMASTER_API_KEY?.trim();
  if (!key) return { ok: false, detail: 'BING_WEBMASTER_API_KEY غير مضبوط (اختياري).', submitted: 0 };
  const request = input.fetch || fetch;
  const siteUrl = input.siteUrl.replace(/\/+$/, '/');
  const post = (method: string, body: unknown) => request(`https://ssl.bing.com/webmaster/api.svc/json/${method}?apikey=${encodeURIComponent(key)}`, {
    method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000),
  });
  try {
    const feed = await post('SubmitFeed', { siteUrl, feedUrl: absoluteUrl('sitemap.xml', input.siteUrl) });
    const urls = input.urls.slice(0, 500);
    let urlsOk = feed.ok;
    if (urls.length) {
      const batch = await post('SubmitUrlBatch', { siteUrl, urlList: urls });
      urlsOk = batch.ok;
    }
    return { ok: feed.ok || urlsOk, status: feed.status, submitted: urls.length, detail: feed.ok ? `سُلّمت الخريطة${urls.length ? ` و${urls.length} رابطاً` : ''} إلى Bing.` : safe(`Bing HTTP ${feed.status}`, 220) };
  } catch (error) {
    return { ok: false, detail: safe(`تعذّر الوصول إلى Bing: ${(error as Error).message}`, 220), submitted: 0 };
  }
}

const b64url = (text: string | Buffer) => Buffer.from(text).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Google Search Console: OAuth JWT for a service account, then PUT the sitemap. */
export async function submitGoogleSitemap(input: { siteUrl: string; env: Env; fetch?: Fetch }): Promise<SubmitResult> {
  const raw = input.env.GSC_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return { ok: false, detail: 'حساب خدمة Search Console غير مربوط (اختياري لكنه يفعّل إرسال الخريطة إلى Google آلياً).', submitted: 0 };
  let creds: { client_email?: string; private_key?: string };
  try { creds = JSON.parse(raw) as typeof creds; } catch { return { ok: false, detail: 'GSC_SERVICE_ACCOUNT_JSON ليس JSON صالحاً.', submitted: 0 }; }
  if (!creds.client_email || !creds.private_key) return { ok: false, detail: 'حساب الخدمة بلا client_email أو private_key.', submitted: 0 };
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: creds.client_email, scope: 'https://www.googleapis.com/auth/webmasters',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }));
  let assertion: string;
  try {
    const signer = createSign('RSA-SHA256');
    signer.update(`${header}.${claims}`);
    assertion = `${header}.${claims}.${signer.sign(creds.private_key.replace(/\\n/g, '\n'), 'base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
  } catch (error) {
    return { ok: false, detail: safe(`تعذّر توقيع طلب Google: ${(error as Error).message}`, 220), submitted: 0 };
  }
  const request = input.fetch || fetch;
  try {
    const tokenResponse = await request('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
      signal: AbortSignal.timeout(20_000),
    });
    const token = await tokenResponse.json().catch(() => ({})) as { access_token?: string; error_description?: string };
    if (!tokenResponse.ok || !token.access_token) return { ok: false, status: tokenResponse.status, detail: safe(`Google OAuth: ${token.error_description || tokenResponse.status}`, 220), submitted: 0 };
    const property = input.env.GSC_SITE_URL?.trim() || input.siteUrl;
    const sitemap = absoluteUrl('sitemap.xml', input.siteUrl);
    const response = await request(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/sitemaps/${encodeURIComponent(sitemap)}`, {
      method: 'PUT', headers: { authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(20_000),
    });
    const body = await response.text().catch(() => '');
    return {
      ok: response.ok, status: response.status, submitted: response.ok ? 1 : 0,
      detail: response.ok ? `أُرسلت خريطة الموقع إلى Search Console (${property}).` : safe(`Search Console HTTP ${response.status} ${body}`, 240),
    };
  } catch (error) {
    return { ok: false, detail: safe(`تعذّر الوصول إلى Search Console: ${(error as Error).message}`, 220), submitted: 0 };
  }
}
