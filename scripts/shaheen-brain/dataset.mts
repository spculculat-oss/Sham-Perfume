/**
 * «مختبر عقل شاهين» — builds the training files from what Shaheen already knows (no network, no AI):
 *   node --import tsx scripts/shaheen-brain/dataset.mts
 * Writes shaheen-train.jsonl, shaheen-eval.jsonl and shaheen-card.json to BRAIN_OUT (default: a temp folder —
 * never into the repository). With BRAIN_REPORT=write (the weekly robot on main) the data card also goes into
 * src/data/live/shaheen-brain.json. Step outputs: dir, train, eval, eval_sha.
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mergeCatalog } from '../../src/utils/storeCatalog';
import { buildDataset, fromLab, fromLessons, fromMemory, toJsonl } from './dataset';
import { relationsTalks } from './talks';
import { BRAIN_REPORT, DATA_URL, emptyReport, readReport } from './report';

const root = new URL('../../', import.meta.url);
const json = (path: string) => { try { return JSON.parse(readFileSync(new URL(path, root), 'utf8')); } catch { return undefined; } };

const products = mergeCatalog(json('src/data/products.json')?.products || [], json('src/data/live/store-catalog.json'));
const pairs = [
  ...fromMemory(json('src/data/live/shaheen-memory.json')),
  ...fromLessons(json('src/data/live/sham-training.json')),
  ...fromLab(json('src/data/live/shaheen-lab.json')),
];
const data = buildDataset(pairs, relationsTalks(products));

const out = process.env.BRAIN_OUT?.trim() || join(process.env.RUNNER_TEMP || tmpdir(), 'shaheen-brain');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'shaheen-train.jsonl'), toJsonl(data.train));
writeFileSync(join(out, 'shaheen-eval.jsonl'), toJsonl(data.eval));
writeFileSync(join(out, 'shaheen-card.json'), JSON.stringify(data.card, null, 1) + '\n');

const c = data.card;
console.log(`عقل شاهين — بيانات التدريب: ${c.train} مثال للتدريب، ${c.eval} للامتحان (ذاكرة ${c.bySource.memory}، دروس ${c.bySource.lessons}، معمل ${c.bySource.lab}، تعامل مع الناس ${c.bySource.relations})`);
console.log(`اتشال: شخصي ${c.dropped.personal}، أسعار ${c.dropped.price}، أسماء شركات ${c.dropped.vendor}، قصير ${c.dropped.short}، طويل ${c.dropped.long}، مكرر ${c.dropped.duplicate}`);
console.log(`الملفات في ${out}`);

if (process.env.BRAIN_REPORT === 'write') {
  const path = new URL(BRAIN_REPORT, root);
  const report = existsSync(path) ? readReport(JSON.parse(readFileSync(path, 'utf8'))) : emptyReport();
  report.dataset = { ...c, files: { train: DATA_URL('shaheen-train.jsonl'), eval: DATA_URL('shaheen-eval.jsonl') } };
  report.updatedAt = new Date().toISOString();
  writeFileSync(path, JSON.stringify(report, null, 1) + '\n');
}
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `dir=${out}\ntrain=${c.train}\neval=${c.eval}\neval_sha=${c.sha256.eval}\n`);
