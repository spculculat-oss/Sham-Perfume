/**
 * Writes SHAHEEN_ORG.md from the registry; with `--svg <file>` also the picture of the map, coloured by
 * today's pre-meeting check:  node --import tsx scripts/shaheen-council/org-doc.mts [--svg map.svg]
 */
import { writeFileSync } from 'node:fs';
import { orgDoc, orgSvg } from './org-doc';
import { runPrecheck } from './precheck';
import { readReports } from './runs';

writeFileSync(new URL('../../SHAHEEN_ORG.md', import.meta.url), orgDoc());
console.log('SHAHEEN_ORG.md written');
const i = process.argv.indexOf('--svg');
if (i > 0 && process.argv[i + 1]) {
  const check = runPrecheck(readReports(), {}, Date.now());
  const status = Object.fromEntries(check.bots.map((b) => [b.id, b.status]));
  const font = process.argv.includes('--font') ? process.argv[process.argv.indexOf('--font') + 1] : undefined;
  writeFileSync(process.argv[i + 1]!, orgSvg(status, { date: new Date().toISOString().slice(0, 10), font }));
  console.log(`${process.argv[i + 1]} written`);
}
