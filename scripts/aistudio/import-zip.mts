/**
 * A project downloaded from Google AI Studio («Download» → ZIP), run through the bridge's filter when AI Studio
 * cannot push to GitHub («Failed to push commit to GitHub»). Same rules as aistudio-bridge.yml (bridge.ts):
 * robots' data, workflows, legal documents, lock files, keys and card numbers never come in; a file equal to an
 * older site version is a stale copy and is skipped; everything else is listed for the coding agent to review.
 *
 *   node --import tsx scripts/aistudio/import-zip.mts <download.zip>           → the plan only (nothing changes)
 *   node --import tsx scripts/aistudio/import-zip.mts <download.zip> --apply   → also writes the files into the
 *                                                                               working tree (then: lint, tests, PR)
 *   … --only=<path>,<path>  limits --apply to the files the agent accepted.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { commitFromDir, gitBytes, planImport } from './bridge';

const [zip, ...flags] = process.argv.slice(2);
if (!zip) { console.error('usage: import-zip.mts <download.zip> [--apply] [--only=a,b]'); process.exit(2); }
const apply = flags.includes('--apply');
const only = flags.find((f) => f.startsWith('--only='))?.slice(7).split(',').filter(Boolean);

const tmp = mkdtempSync(join(tmpdir(), 'aistudio-zip-'));
try {
  execFileSync('unzip', ['-q', '-o', zip, '-d', tmp], { stdio: 'inherit' });
  // A ZIP holding one top-level folder: that folder is the project.
  let root = tmp;
  for (;;) {
    const entries = readdirSync(root).filter((e) => e !== '__MACOSX');
    if (entries.length === 1 && statSync(join(root, entries[0])).isDirectory() && entries[0] !== 'src') root = join(root, entries[0]);
    else break;
  }
  const head = commitFromDir(process.cwd(), root, `AI Studio download: ${zip.split('/').pop()}`);
  const plan = planImport(gitBytes(process.cwd()), { head });
  const chosen = only ? plan.files.filter((f) => only.includes(f.path)) : plan.files;

  console.log(`ZIP ${zip} → ${head.slice(0, 7)}: ${plan.files.length} file(s) differ from the site, ${plan.skipped.length} left out`);
  for (const f of plan.files) console.log(`  + ${f.path} [${f.action}, ${f.how}]${f.reason ? ` — ${f.reason}` : ''}`);
  for (const s of plan.skipped) console.log(`  − ${s.path} — ${s.reason}`);
  writeFileSync(process.env.ZIP_PLAN || join(tmpdir(), 'aistudio-zip-plan.json'), JSON.stringify({ ...plan, head, files: plan.files.map(({ content: _c, ...rest }) => rest) }, null, 1));

  if (apply) {
    for (const f of chosen) {
      if (f.action === 'delete') continue; // a download never deletes site files
      mkdirSync(dirname(f.path), { recursive: true });
      writeFileSync(f.path, f.content!);
    }
    console.log(`Applied ${chosen.filter((f) => f.action !== 'delete').length} file(s) to the working tree — now run lint and tests.`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
