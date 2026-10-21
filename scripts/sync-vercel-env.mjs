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
 *
 * Production pinned by an old Redeploy/rollback: Vercel then stops moving the live site to new builds, so new keys and
 * code never reach visitors. After every sync the newest READY production build is promoted (POST /v10/…/promote)
 * when it is not the live one — that also turns Vercel's automatic go-live back on.
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

const POLL_MS = Number(process.env.SHAM_SYNC_POLL_MS) || 5000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const liveId = async (project) => (await vercel(`/v9/projects/${encodeURIComponent(project)}`))?.targets?.production?.id;

/**
 * The newest production build of the current code: the build of this exact commit if Vercel made one, else the newest
 * build that came from a git push (a «Redeploy» of an old deployment keeps the OLD code), else simply the newest.
 */
function pickNewest(deployments, sha = process.env.GITHUB_SHA) {
  return deployments.find((d) => sha && d.meta?.githubCommitSha === sha)
    || deployments.find((d) => d.source === 'git')
    || deployments[0];
}

/**
 * Makes `target` the live production build unless it already is — or the live build is the same commit (a fresh
 * env rebuild of it, e.g. an earlier sync). Promoting also unpins a rolled-back project.
 */
async function ensureLive(project, target) {
  const live = await liveId(project);
  if (!live || live === target.uid) return true;
  if (target.sha) {
    const liveSha = (await vercel(`/v13/deployments/${encodeURIComponent(live)}`).catch(() => null))?.meta?.githubCommitSha;
    if (liveSha === target.sha) return true;
  }
  await vercel(`/v10/projects/${encodeURIComponent(project)}/promote/${encodeURIComponent(target.uid)}`, { method: 'POST' });
  for (let i = 0; i < 24; i++) {
    if ((await liveId(project)) === target.uid) {
      note('notice', `Vercel ${project}`, `production was pinned to an older build (${live}) — promoted the newest build ${target.uid}; automatic go-live is back on`);
      return true;
    }
    await sleep(POLL_MS);
  }
  note('warning', `Vercel ${project}`, `promote of ${target.uid} requested but production still serves ${live} — check Deployments in Vercel`);
  return false;
}

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
if (!wanted.length) note('notice', 'Vercel sync', 'no usable AI keys in GitHub secrets — nothing to copy, only checking that production is current');

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
    if (changed.length) note('notice', `Vercel ${project}`, `updated ${changed.join(', ')}`);
    else if (wanted.length) note('notice', `Vercel ${project}`, `keys already up to date (${wanted.map((w) => w.key).join(', ')})`);

    const { deployments = [] } = await vercel(`/v6/deployments?projectId=${encodeURIComponent(project)}&target=production&state=READY&limit=20`);
    const newest = pickNewest(deployments);
    if (!newest) { note('warning', `Vercel ${project}`, 'no production deployment yet — next push to main will use the new keys'); continue; }
    let liveCandidate = { uid: newest.uid, sha: newest.meta?.githubCommitSha };
    if (changed.length) {
      const created = await vercel('/v13/deployments?forceNew=1', {
        method: 'POST', body: JSON.stringify({ name: project, deploymentId: newest.uid, target: 'production' }),
      });
      let state = created.readyState;
      for (let i = 0; i < 60 && !['READY', 'ERROR', 'CANCELED'].includes(state); i++) {
        await sleep(POLL_MS);
        state = (await vercel(`/v13/deployments/${created.id}`)).readyState;
      }
      note(state === 'READY' ? 'notice' : 'warning', `Vercel ${project}`, `production redeploy ${state} (${created.url ? `https://${created.url}` : created.id})`);
      if (state !== 'READY') { failures++; continue; }
      liveCandidate = { uid: created.id };
    }
    if (!(await ensureLive(project, liveCandidate))) failures++;
  } catch (error) {
    failures++;
    const hint = / 403 /.test(error.message)
      ? ` — VERCEL_TOKEN was refused: create a new token at https://vercel.com/account/settings/tokens with Scope "${scope}" and store it as the GitHub secret VERCEL_TOKEN`
      : / 401 /.test(error.message) ? ' — VERCEL_TOKEN is invalid or expired: replace the GitHub secret VERCEL_TOKEN' : '';
    note('warning', `Vercel ${project}`, `sync failed: ${error.message}${hint}`);
  }
}
process.exit(failures && process.env.SHAM_SYNC_STRICT === '1' ? 1 : 0);
