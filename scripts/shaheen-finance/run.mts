/** Calls the authenticated deployed service. No financial data is committed or printed. */
const env = process.env;
const origin = env.SHAM_FINANCE_API_URL?.trim();
const token = env.SHAM_ADMIN_TOKEN?.trim();
if (!origin || !token || token.length < 12) {
  console.error('Finance scheduler is not configured: set SHAM_FINANCE_API_URL and SHAM_ADMIN_TOKEN.');
  process.exitCode = 1;
} else {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('INVALID_ORIGIN');
    const response = await fetch(`${url.origin}/api/admin/finance/run`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger: 'schedule' }), signal: AbortSignal.timeout(110_000), redirect: 'error',
    });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const data = await response.json() as { run?: { id?: string }; reports?: unknown[] };
    if (!data.run?.id || !Array.isArray(data.reports)) throw new Error('INVALID_RESPONSE');
    console.log('Finance audit completed. Private daily, weekly and monthly reports are in Admin → Finance.');
  } catch {
    console.error('Finance audit did not complete. Check API, admin authorization and durable storage. No amounts or secrets were logged.');
    process.exitCode = 1;
  }
}
