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
import { PAINT_LESSONS } from './lessons';
import { formatPaintReport, runPaintTraining } from './bench';

const args = process.argv.slice(2);
const report = runPaintTraining(PAINT_LESSONS);
const at = args.indexOf('--out');
if (at >= 0 && args[at + 1]) {
  mkdirSync(args[at + 1], { recursive: true });
  for (const r of report.results) writeFileSync(join(args[at + 1], `${r.id}.svg`), r.painting.svg);
}
console.log(formatPaintReport(report, args.includes('--verbose')));
process.exit(report.fail ? 1 : 0);
