/**
 * Publishes a bot's generated data to main without losing it to another bot (importer, news, supervisor).
 *   node scripts/ci/publish.mjs "<commit message>" <path>...
 * Several bots write the same generated files (src/data/live/store-catalog.json, ai-quota.json) and can finish
 * within the same minute. A plain «git pull --rebase» then stops on a conflict and stays half-done, so every
 * retry fails too (seen: the importer lost 30 new products this way). Here a conflict is resolved for what
 * these files are — whole generated snapshots: take the latest main, put this run's newer files on top
 * (the AI quota book is merged so no engine pause is forgotten), check every JSON file still parses, and retry.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const [message, ...paths] = process.argv.slice(2);
if (!message || !paths.length) { console.error('usage: publish.mjs "<message>" <path>...'); process.exit(2); }
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const tryGit = (...args) => { try { git(...args); return true; } catch (e) { console.log(String(e.stderr || e.message).trim().split('\n').slice(-3).join(' / ')); return false; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const QUOTA = 'src/data/live/ai-quota.json';
// «ذاكرة شاهين» and the bots' AI memory: both copies are kept (union), never one bot's copy over another's.
const MEMORIES = new Set(['src/data/live/shaheen-memory.json', 'src/data/live/ai-memory.json']);

git('add', '--', ...paths);
if (!git('diff', '--cached', '--name-only')) { console.log('Nothing new to publish'); process.exit(0); }
git('commit', '-q', '-m', message);
const mine = git('diff', '--name-only', 'HEAD~1', 'HEAD').split('\n').filter(Boolean);
const deleted = new Set(git('diff', '--name-only', '--diff-filter=D', 'HEAD~1', 'HEAD').split('\n').filter(Boolean));
// This run's versions of the files it wrote.
const keep = mkdtempSync(join(tmpdir(), 'publish-'));
for (const f of mine) if (!deleted.has(f)) { mkdirSync(dirname(join(keep, f)), { recursive: true }); copyFileSync(f, join(keep, f)); }

/** Both quota books together: every engine pause survives, the later one wins. */
function mergeQuota(theirsText, oursText) {
  const parse = (t) => { try { return JSON.parse(t); } catch { return { engines: {} }; } };
  const theirs = parse(theirsText); const ours = parse(oursText);
  const engines = { ...(theirs.engines || {}) };
  for (const [id, e] of Object.entries(ours.engines || {})) if (!engines[id] || Date.parse(e.pausedUntil) > Date.parse(engines[id].pausedUntil)) engines[id] = e;
  for (const [id, e] of Object.entries(engines)) if (!(Date.parse(e.pausedUntil) > Date.now())) delete engines[id];
  // The bots' daily use of the free quota («الشات أولاً»): the newer day wins, the same day keeps the higher count.
  let used = ours.used || theirs.used;
  if (ours.used && theirs.used) {
    if (ours.used.day === theirs.used.day) {
      const counts = { ...theirs.used.counts };
      for (const [id, n] of Object.entries(ours.used.counts || {})) counts[id] = Math.max(counts[id] || 0, n);
      used = { day: ours.used.day, counts };
    } else used = ours.used.day > theirs.used.day ? ours.used : theirs.used;
  }
  return `${JSON.stringify({ updatedAt: new Date().toISOString(), engines, ...(used ? { used } : {}) }, null, 1)}\n`;
}

/** Two copies of a memory file together: every entry kept, the newer answer wins, uses are not lost. */
function mergeMemoryText(theirsText, oursText) {
  const parse = (t) => { try { const d = JSON.parse(t); return Array.isArray(d?.entries) ? d : { entries: [] }; } catch { return { entries: [] }; } };
  const theirs = parse(theirsText); const ours = parse(oursText);
  const byId = new Map();
  for (const e of [...theirs.entries, ...ours.entries]) {
    if (!e || typeof e.id !== 'string') continue;
    const mine = byId.get(e.id);
    if (!mine) { byId.set(e.id, e); continue; }
    const newer = Date.parse(e.at) > Date.parse(mine.at) ? e : mine;
    const lastUsed = [mine.lastUsed, e.lastUsed].filter(Boolean).sort().pop();
    byId.set(e.id, { ...newer, hits: Math.max(mine.hits || 0, e.hits || 0), ...(lastUsed ? { lastUsed } : {}) });
  }
  const updatedAt = [theirs.updatedAt, ours.updatedAt].filter(Boolean).sort().pop() || new Date().toISOString();
  return `${JSON.stringify({ version: 1, updatedAt, entries: [...byId.values()] }, null, 1)}\n`;
}

for (let attempt = 1; attempt <= 6; attempt++) {
  if (attempt > 1) await sleep(attempt * 4000);
  if (!tryGit('fetch', '-q', '--depth=50', 'origin', 'main')) continue;
  if (tryGit('rebase', '-q', 'origin/main')) {
    if (tryGit('push', '-q', 'origin', 'HEAD:main')) { console.log(`Published on main (attempt ${attempt})`); process.exit(0); }
    continue;
  }
  // Conflict with another bot's commit: never leave the rebase half-done.
  tryGit('rebase', '--abort');
  git('reset', '-q', '--hard', 'origin/main');
  for (const f of mine) {
    if (deleted.has(f)) { if (existsSync(f)) git('rm', '-q', '--', f); continue; }
    if (f === QUOTA && existsSync(f)) writeFileSync(f, mergeQuota(readFileSync(f, 'utf8'), readFileSync(join(keep, f), 'utf8')));
    else if (MEMORIES.has(f) && existsSync(f)) writeFileSync(f, mergeMemoryText(readFileSync(f, 'utf8'), readFileSync(join(keep, f), 'utf8')));
    // Copied byte for byte: the cleaned product photos (public/store-images) are not text.
    else { mkdirSync(dirname(f), { recursive: true }); copyFileSync(join(keep, f), f); }
  }
  const broken = mine.filter((f) => f.endsWith('.json') && existsSync(f)).filter((f) => { try { JSON.parse(readFileSync(f, 'utf8')); return false; } catch { return true; } });
  if (broken.length) { console.log(`::error::Invalid JSON after merging: ${broken.join(', ')}`); process.exit(1); }
  git('add', '--', ...mine.filter((f) => !deleted.has(f)));
  if (!git('diff', '--cached', '--name-only')) { console.log('Main already has this data'); process.exit(0); }
  git('commit', '-q', '-m', message);
  console.log(`Merged with another bot's update on main (${mine.length} files kept from this run)`);
  if (tryGit('push', '-q', 'origin', 'HEAD:main')) { console.log(`Published on main (attempt ${attempt})`); process.exit(0); }
}
rmSync(keep, { recursive: true, force: true });
console.log('::error::Could not publish on main after 6 attempts');
process.exit(1);
