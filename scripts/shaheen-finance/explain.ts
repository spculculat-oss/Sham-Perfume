/** Safe, fixed explanations for the finance scheduler's failure codes (no amounts, tokens or payloads). */
export function financeFailure(code: string): string {
  const known: Record<string, string> = {
    NO_ADMIN_TOKEN: 'NO_ADMIN_TOKEN: the SHAM_ADMIN_TOKEN secret is missing or too short in GitHub Actions secrets (it must equal SHAM_ADMIN_TOKEN on Vercel).',
    INVALID_ORIGIN: 'INVALID_ORIGIN: SHAM_FINANCE_API_URL must be a bare https origin such as https://sham-perfume-49bf.vercel.app',
    ADMIN_NOT_CONFIGURED: 'ADMIN_NOT_CONFIGURED: SHAM_ADMIN_TOKEN is not set on Vercel (sham-perfume-49bf → Settings → Environment Variables, then Redeploy) — the admin panel and this audit stay off until it is.',
    HTTP_401: 'HTTP_401: the engine refused the admin token — SHAM_ADMIN_TOKEN in GitHub secrets differs from the one on Vercel.',
    HTTP_403: 'HTTP_403: the engine refused the admin token — SHAM_ADMIN_TOKEN in GitHub secrets differs from the one on Vercel.',
    HTTP_404: 'HTTP_404: the finance route is not on this engine — check SHAM_FINANCE_API_URL points at the production engine.',
    HTTP_429: 'HTTP_429: the finance run was rate limited; the next scheduled run retries.',
    HTTP_503: 'HTTP_503: the engine could not read or save the private finance book (admin token not configured on Vercel, or durable storage unavailable).',
    INVALID_RESPONSE: 'INVALID_RESPONSE: the engine answered without a finance run — an older deployment may be live.',
    TIMEOUT: 'TIMEOUT: the engine did not answer within 110 s.',
    NETWORK: 'NETWORK: the engine could not be reached.',
  };
  return known[code] || `${code}: unexpected answer from the engine.`;
}
