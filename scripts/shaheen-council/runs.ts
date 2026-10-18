/**
 * Reads the robots' reports and their last GitHub Actions run — shared by the pre-meeting check
 * (precheck.mts) and the meeting (run.mts, when the check is missing or old).
 */
import { existsSync, readFileSync } from 'node:fs';
import { BOTS } from '../../src/utils/shaheenOrg';
import type { RunInfo } from './precheck';

const live = (name: string) => new URL(`../../src/data/live/${name}`, import.meta.url);
export const readLive = (name: string): unknown => { try { return existsSync(live(name)) ? JSON.parse(readFileSync(live(name), 'utf8')) : undefined; } catch { return undefined; } };

/** Every report a bot in the structure writes (plus the supervisor's scores for tools with no robot). */
export function readReports(): Record<string, unknown> {
  const names = new Set(BOTS.map((b) => b.report).filter(Boolean) as string[]);
  names.add('ai-supervisor.json');
  return Object.fromEntries([...names].map((n) => [n, readLive(n)]));
}

/** The last run on main of every workflow in the structure (needs a token with actions:read). */
export async function fetchRuns(repo: string, token: string | undefined): Promise<Record<string, RunInfo | undefined>> {
  const out: Record<string, RunInfo | undefined> = {};
  if (!token) return out;
  const files = [...new Set(BOTS.map((b) => b.workflow).filter(Boolean) as string[])];
  await Promise.all(files.map(async (file) => {
    try {
      const r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${file}/runs?branch=main&per_page=1&exclude_pull_requests=true`, {
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' },
        signal: AbortSignal.timeout(15_000),
      });
      const run = r.ok ? ((await r.json()) as { workflow_runs?: { conclusion: string | null; status: string; updated_at: string; html_url: string }[] }).workflow_runs?.[0] : undefined;
      if (run) out[file] = { conclusion: run.conclusion, status: run.status, at: run.updated_at, url: run.html_url };
    } catch { /* unknown → judged on its report alone */ }
  }));
  return out;
}
