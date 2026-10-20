/**
 * Copies Shaheen's AI keys from GitHub Actions secrets into the Vercel projects' environment
 * variables and redeploys production only when something actually changed.
 *
 *   VERCEL_TOKEN     (required) https://vercel.com/account/tokens — scoped to the team
 *   VERCEL_SCOPE     team slug (default sham-de37)
 *   VERCEL_PROJECTS  comma list (default sham-perfume-49bf — the second project only redirects to it)
 *   SHAM_VERIFY_FILE optional JSON from verify-ai-keys.mts: keys proven invalid/without credit are
 *                    NOT pushed, so a bad GitHub secret can never replace a working production key.
 *
 * Keys absent from GitHub are left untouched on Vercel. Values are never printed.
 */
import { existsSync, readFileSync } from 'node:fs';

const API = process.env.VERCEL_API_URL?.trim() || 'https://api.vercel.com';
const token = process.env.VERCEL_TOKEN?.trim();
const scope = process.env.VERCEL_SCOPE?.trim() || 'sham-de37';
const projects = (process.env.VERCEL_PROJECTS || 'sham-perfume-49bf').split(',').map((p) => p.trim()).filter(Boolean);
const TARGETS = ['production', 'preview', 'development'];
const KEYS = {
  GEMINI_API_KEY: 'gemini', OPENAI_API_KEY: 'openai', ANTHROPIC_API_KEY: 'claude',
  DEEPSEEK_API_KEY: 'deepseek', OPENROUTER_API_KEY: 'openrouter', PERPLEXITY_API_KEY: 'perplexity', AI_GATEWAY_API_KEY: 'self_hosted',
  // Not an AI engine: real videos under Shaheen's answers (YouTube Data API v3). Synced as is.
  YOUTUBE_API_KEY: 'youtube',
  // Free e-mail: the store's Gmail «App password» (order updates, sign-in and contract codes). Not an AI engine.
  SHAM_GMAIL_APP_PASSWORD: 'gmail',
  // «الدفع في متجر شام»: the payment server needs them (verified by scripts/verify-payments.mts as `kashier`).
  KASHIER_MERCHANT_ID: 'kashier', KASHIER_API_KEY: 'kashier', KASHIER_SECRET_KEY: 'kashier', KASHIER_MODE: 'kashier', KASHIER_CURRENCIES: 'kashier',
};
const BLOCKING = new Set(['invalid_key', 'no_credit', 'missing']);
const gh = Boolean(process.env.GITHUB_ACTIONS);
const note = (level, title, msg) => { console.log(gh ? `::${level} title=${title}::${msg}` : `[${level}] ${title}: ${msg}`); };

if (!token) { note('warning', 'Vercel sync', 'VERCEL_TOKEN secret is missing — keys stay in GitHub only'); process.exit(0); }

const verify = (() => {
  const file = process.env.SHAM_VERIFY_FILE;
  if (!file || !existsSync(file)) return {};
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return {}; }
})();

async function vercel(path, init = {}) {
  const url = `${API}${path}${path.includes('?') ? '&' : '?'}slug=${encodeURIComponent(scope)}`;
  const response = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = data?.error?.code || response.status;
    throw new Error(`${init.method || 'GET'} ${path.split('?')[0]} → ${response.status} ${code}`);
  }
  return data;
}

const wanted = Object.entries(KEYS).flatMap(([key, engine]) => {
  const value = process.env[key]?.trim();
  if (!value) return [];
  const status = verify[engine];
  if (status && BLOCKING.has(status)) {
    note('warning', `Vercel sync ${key}`, `skipped: the GitHub key failed verification (${status}); production key left as is`);
    return [];
  }
  return [{ key, value }];
});
if (!wanted.length) { note('notice', 'Vercel sync', 'no usable AI keys in GitHub secrets — nothing to sync'); process.exit(0); }

let failures = 0;
for (const project of projects) {
  try {
    const { envs = [] } = await vercel(`/v9/projects/${encodeURIComponent(project)}/env`);
    const changed = [];
    for (const { key, value } of wanted) {
      const existing = envs.filter((e) => e.key === key);
      let same = false;
      if (existing.length === 1 && TARGETS.every((t) => existing[0].target?.includes(t))) {
        const full = await vercel(`/v1/projects/${encodeURIComponent(project)}/env/${existing[0].id}`).catch(() => null);
        same = typeof full?.value === 'string' && full.value === value;
      }
      if (same) continue;
      for (const e of existing) await vercel(`/v9/projects/${encodeURIComponent(project)}/env/${e.id}`, { method: 'DELETE' });
      await vercel(`/v10/projects/${encodeURIComponent(project)}/env`, {
        method: 'POST', body: JSON.stringify({ key, value, type: 'encrypted', target: TARGETS }),
      });
      changed.push(key);
    }
    if (!changed.length) { note('notice', `Vercel ${project}`, `keys already up to date (${wanted.map((w) => w.key).join(', ')})`); continue; }
    note('notice', `Vercel ${project}`, `updated ${changed.join(', ')}`);

    const { deployments = [] } = await vercel(`/v6/deployments?projectId=${encodeURIComponent(project)}&target=production&state=READY&limit=1`);
    if (!deployments[0]) { note('warning', `Vercel ${project}`, 'no production deployment to redeploy — next push to main will use the new keys'); continue; }
    const created = await vercel('/v13/deployments?forceNew=1', {
      method: 'POST', body: JSON.stringify({ name: project, deploymentId: deployments[0].uid, target: 'production' }),
    });
    let state = created.readyState;
    for (let i = 0; i < 60 && !['READY', 'ERROR', 'CANCELED'].includes(state); i++) {
      await new Promise((r) => setTimeout(r, Number(process.env.SHAM_SYNC_POLL_MS) || 5000));
      state = (await vercel(`/v13/deployments/${created.id}`)).readyState;
    }
    note(state === 'READY' ? 'notice' : 'warning', `Vercel ${project}`, `production redeploy ${state} (${created.url ? `https://${created.url}` : created.id})`);
    if (state !== 'READY') failures++;
  } catch (error) {
    failures++;
    note('warning', `Vercel ${project}`, `sync failed: ${error.message}`);
  }
}
process.exit(failures && process.env.SHAM_SYNC_STRICT === '1' ? 1 : 0);
