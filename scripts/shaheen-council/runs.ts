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

const api = async (url: string, token: string): Promise<unknown> => {
  const r = await fetch(url, {
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' },
    signal: AbortSignal.timeout(15_000),
  });
  return r.ok ? r.json() : undefined;
};

/** Error annotations that say nothing on their own (the runner's generic exit line, platform notices). */
const NOISE = /^Process completed with exit code|ubuntu-latest label|Node\.js \d+ actions are deprecated|script "[^"]+" exited with code|error: \|-\s*$/i;

/**
 * Why a failed run failed, without its log (logs need a separate download host): the first failed step and the
 * run's own error annotations — every bot writes its cause as `::error title=…::…`. Clipped; never the log.
 */
export async function failureDetail(repo: string, runId: number, token: string): Promise<Pick<RunInfo, 'failedStep' | 'errors'>> {
  const jobs = (await api(`https://api.github.com/repos/${repo}/actions/runs/${runId}/jobs?per_page=20`, token) as {
    jobs?: { id: number; conclusion: string | null; steps?: { name: string; conclusion: string | null }[] }[];
  } | undefined)?.jobs || [];
  const failed = jobs.filter((j) => j.conclusion === 'failure');
  const failedStep = failed.flatMap((j) => j.steps || []).find((s) => s.conclusion === 'failure')?.name;
  const errors: string[] = [];
  for (const job of failed.slice(0, 2)) {
    const notes = await api(`https://api.github.com/repos/${repo}/check-runs/${job.id}/annotations?per_page=50`, token) as
      { annotation_level?: string; title?: string; message?: string }[] | undefined;
    for (const a of notes || []) {
      if (a.annotation_level !== 'failure') continue;
      const line = [a.title, (a.message || '').split('\n')[0]].filter(Boolean).join(' — ').trim();
      if (line && !NOISE.test(line) && !errors.includes(line)) errors.push(line.length > 180 ? `${line.slice(0, 177)}…` : line);
    }
  }
  return { ...(failedStep ? { failedStep } : {}), ...(errors.length ? { errors: errors.slice(0, 4) } : {}) };
}

/** The last run on main of every workflow in the structure (needs a token with actions:read), with the cause when it failed. */
export async function fetchRuns(repo: string, token: string | undefined): Promise<Record<string, RunInfo | undefined>> {
  const out: Record<string, RunInfo | undefined> = {};
  if (!token) return out;
  const files = [...new Set(BOTS.map((b) => b.workflow).filter(Boolean) as string[])];
  await Promise.all(files.map(async (file) => {
    try {
      const data = await api(`https://api.github.com/repos/${repo}/actions/workflows/${file}/runs?branch=main&per_page=10&exclude_pull_requests=true`, token) as
        { workflow_runs?: { id: number; conclusion: string | null; status: string; updated_at: string; html_url: string }[] } | undefined;
      // The latest run that actually did its work: one still running, or skipped by its own condition (a check
      // that only follows a deploy), says nothing about the bot — judge the last finished one instead.
      const runs = data?.workflow_runs || [];
      const run = runs.find((r) => r.status === 'completed' && r.conclusion !== 'skipped') || runs[0];
      if (!run) return;
      out[file] = { conclusion: run.conclusion, status: run.status, at: run.updated_at, url: run.html_url };
      if (run.conclusion === 'failure') {
        try { Object.assign(out[file]!, await failureDetail(repo, run.id, token)); } catch { /* the failure stands without its cause */ }
      }
    } catch { /* unknown → judged on its report alone */ }
  }));
  return out;
}
