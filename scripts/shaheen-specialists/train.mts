/**
 * «درّب مجلس المتخصصين» — the CLI: runs the whole training bank and prints the report.
 *
 *   node --import tsx scripts/shaheen-specialists/train.mts            كل البنك
 *   node --import tsx scripts/shaheen-specialists/train.mts --verbose  مع السؤال والرد والأدوات
 *   node --import tsx scripts/shaheen-specialists/train.mts route      مهارة واحدة أو حالة واحدة
 *
 * مفيش أي ذكاء اصطناعي هنا، ومفيش ملف بيتكتب: التقرير على الشاشة، ولو فيه حالة واقعة الأمر بيرجع
 * بكود 1 (عشان أي تشغيل آلي ياخد باله).
 */
import { TRAINING_CASES, type TrainingCase } from './questions';
import { formatReport, runTraining } from './bench';

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const filters = args.filter((a) => !a.startsWith('--'));
const cases: TrainingCase[] = filters.length
  ? TRAINING_CASES.filter((c) => filters.some((f) => c.id.includes(f) || c.skill.includes(f)))
  : TRAINING_CASES;

if (!cases.length) {
  console.error('مفيش حالة بالاسم ده. الحالات المتاحة:');
  for (const c of TRAINING_CASES) console.error(`  ${c.skill.padEnd(10)} ${c.id}`);
  process.exit(2);
}

const report = await runTraining(cases);
console.log(formatReport(report, { verbose, cases }));
process.exit(report.fail ? 1 : 0);
