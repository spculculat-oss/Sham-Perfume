#!/usr/bin/env -S node --import tsx
/**
 * «روبوت التعداد وإحصاء الزيارات — دولة المنصة» (bot id: `census`)
 *
 * Collects the live visit ledger from the API server (when `SHAM_API_BASE_URL` / `VITE_API_BASE_URL` is configured),
 * merges it monotonically with `src/data/live/platform-census.json`, writes the updated ledger, and issues
 * the certified «التقرير والكشف العلني لصاحب المنصة» to the log and `$GITHUB_STEP_SUMMARY`.
 *
 * Strictly real counts only — never fabricates visits or countries.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  CENSUS_BOT,
  emptyCensusReport,
  mergeCensusReports,
  normalizeCensusReport,
  plainTextStatement,
  readCensusReport,
  type CensusReport,
} from '../../src/utils/platformCensus';

const ROOT = process.cwd();
const OUT_FILE = resolve(ROOT, 'src/data/live', CENSUS_BOT.reportFile);

async function fetchLiveApiCensus(baseUrl: string): Promise<CensusReport | undefined> {
  const clean = baseUrl.trim().replace(/\/+$/, '');
  if (!clean) return undefined;
  const endpoint = clean.endsWith('/api') ? `${clean}/census/public` : `${clean}/api/census/public`;
  try {
    const res = await fetch(endpoint, {
      headers: { Accept: 'application/json', 'User-Agent': 'sham-state-census-bot/1.0' },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { report?: unknown };
    return body?.report ? readCensusReport(body.report) : undefined;
  } catch {
    return undefined;
  }
}

async function main() {
  const now = new Date();
  let diskReport = emptyCensusReport(now.toISOString());
  if (existsSync(OUT_FILE)) {
    try {
      diskReport = readCensusReport(JSON.parse(readFileSync(OUT_FILE, 'utf8')), now);
    } catch {
      diskReport = emptyCensusReport(now.toISOString());
    }
  }

  const apiBase = process.env.SHAM_API_BASE_URL || process.env.VITE_API_BASE_URL || '';
  const liveReport = apiBase ? await fetchLiveApiCensus(apiBase) : undefined;
  const merged = liveReport
    ? mergeCensusReports(diskReport, liveReport, now)
    : normalizeCensusReport({ ...diskReport, updatedAt: diskReport.totals.visits > 0 ? diskReport.updatedAt : now.toISOString() }, now);

  mkdirSync(dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, `${JSON.stringify(merged, null, 1)}\n`, 'utf8');

  const statementText = plainTextStatement(merged, 'ar', now);
  console.log(statementText);

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `## 🏛️ خانة التعداد — دولة المنصة\n\n\`\`\`text\n${statementText}\n\`\`\`\n`,
      'utf8',
    );
  }
}

await main();
