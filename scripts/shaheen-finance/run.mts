/**
 * Calls the authenticated deployed service. No financial data is committed or printed.
 * Every failure names its cause as a safe code (configuration / HTTP status / response shape) in a GitHub
 * annotation, so «الفحص الشامل» and the doctor can say what to fix without anyone opening the log.
 */
import { financeFailure } from './explain';

const env = process.env;
const origin = env.SHAM_FINANCE_API_URL?.trim() || 'https://sham-perfume-49bf.vercel.app';
const token = env.SHAM_ADMIN_TOKEN?.trim();
const fail = (code: string) => { console.log(`::error title=Finance audit::${financeFailure(code)}`); process.exitCode = 1; };

if (!token || token.length < 12) fail('NO_ADMIN_TOKEN');
else {
  let url: URL | undefined;
  try { url = new URL(origin); } catch { url = undefined; }
  if (!url || url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') fail('INVALID_ORIGIN');
  else {
    try {
      const response = await fetch(`${url.origin}/api/admin/finance/run`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'schedule' }), signal: AbortSignal.timeout(110_000), redirect: 'error',
      });
      if (!response.ok) {
        // Only the fixed error code is read from the body — never amounts or messages.
        const code = await response.json().then((b: unknown) => { const c = (b as { code?: unknown } | null)?.code; return typeof c === 'string' ? c : ''; }, () => '');
        fail(code === 'ADMIN_NOT_CONFIGURED' ? code : `HTTP_${response.status}`);
      }
      else {
        const data = await response.json().catch(() => ({})) as { run?: { id?: string }; reports?: unknown[] };
        if (!data.run?.id || !Array.isArray(data.reports)) fail('INVALID_RESPONSE');
        else console.log('Finance audit completed. Private daily, weekly and monthly reports are in Admin → Finance.');
      }
    } catch (e) { fail((e as Error)?.name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK'); }
  }
}
