/**
 * Push channels of «منارة شاهين». Discovery only — nothing here can promise a ranking.
 *
 *  IndexNow : one POST reaches Bing, Yandex, Naver, Seznam and Yep (and therefore DuckDuckGo/Ecosia/Yahoo/Copilot,
 *             which read Bing's index). The key file must already be live at /<key>.txt.
 *  Bing API : optional BING_WEBMASTER_API_KEY (URL batch + feed submission).
 *  Google   : optional Search Console service account. Google has no IndexNow and its Indexing API only covers
 *             JobPosting/BroadcastEvent, so the honest channel is sitemap submission + verification.
 * Every function is pure HTTP with timeouts and returns a structured result; nothing throws.
 */
import { createSign } from 'node:crypto';
import { absoluteUrl, SITE } from '../../src/seo/site';
import { indexNowBody } from '../../src/seo/artifacts';

type Env = Record<string, string | undefined>;
type Fetch = typeof fetch;
export interface SubmitResult { ok: boolean; status?: number; detail: string; submitted: number; urls?: string[] }

const safe = (text: string, max = 300) => text.replace(/\s+/g, ' ').trim().slice(0, max);

export async function submitIndexNow(input: { siteUrl: string; urls: string[]; fetch?: Fetch; key?: string }): Promise<SubmitResult> {
  const urls = [...new Set(input.urls.filter((u) => /^https:\/\//i.test(u)))].slice(0, 10_000);
  if (!urls.length) return { ok: false, detail: 'لا صفحات جديدة للإرسال.', submitted: 0 };
  try {
    const response = await (input.fetch || fetch)('https://api.indexnow.org/indexnow', {
      method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(indexNowBody(input.siteUrl, urls, input.key || SITE.indexNowKey)),
      signal: AbortSignal.timeout(20_000),
    });
    const text = await response.text().catch(() => '');
    // 200 = accepted, 202 = accepted (key still being validated), 204 = no content: all successful.
    const ok = [200, 202, 204].includes(response.status);
    return { ok, status: response.status, submitted: ok ? urls.length : 0, urls: urls.slice(0, 50), detail: ok ? 'قبلت المحركات الدفع السريع.' : safe(`HTTP ${response.status} ${text}`, 220) };
  } catch (error) {
    return { ok: false, detail: safe(`تعذّر الوصول إلى IndexNow: ${(error as Error).message}`, 220), submitted: 0 };
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
