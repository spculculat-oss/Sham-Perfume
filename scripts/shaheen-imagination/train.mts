/**
 * «درّب مرسم شاهين» — the CLI.
 *
 *   npm run train:painter                 كل البنك
 *   npm run train:painter -- --verbose    مع اللي فهمه من كل فكرة
 *   npm run train:painter -- --out DIR    يكتب كل رسمة ملف SVG في DIR عشان تتشاف بالعين
 *
 * مفيش ذكاء اصطناعي ولا شبكة. لو فيه درس واقع الأمر بيرجع بكود 1، ونفس البنك بيتشغل مع كل `npm test`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PAINT_LESSONS, drillLessons } from './lessons';
import { formatPaintReport, runDrill, runPaintTraining } from './bench';

const args = process.argv.slice(2);
const report = runPaintTraining(PAINT_LESSONS);
const at = args.indexOf('--out');
if (at >= 0 && args[at + 1]) {
  mkdirSync(args[at + 1], { recursive: true });
  for (const r of report.results) writeFileSync(join(args[at + 1], `${r.id}.svg`), r.painting.svg);
}
console.log(formatPaintReport(report, args.includes('--verbose')));
const drill = runDrill(drillLessons());
console.log(`التمرين المكثّف (كل عنصر × كل مكان × كل وقت، عربي وإنجليزي): ${drill.pass}/${drill.total} — ${((drill.pass / drill.total) * 100).toFixed(1)}%`);
for (const f of drill.failures.slice(0, 15)) console.log(`✗ ${f.idea} → ${f.problems.join('؛ ')}`);
if (drill.failures.length > 15) console.log(`… و${drill.failures.length - 15} حالة تانية`);
process.exit(report.fail || drill.failures.length ? 1 : 0);
