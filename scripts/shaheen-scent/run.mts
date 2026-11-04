/**
 * «روبوت سلوك الزائر العطري» — GitHub Actions runs it every day (`.github/workflows/shaheen-scent.yml`):
 *   node --import tsx scripts/shaheen-scent/run.mts
 *
 * Reads (read-only):
 *   - the anonymous design counters from `GET /api/admin/lab-signals` (admin token; counters only),
 *   - the lab's material bank (`src/utils/designers/perfumeMaterials.ts`),
 *   - the raw-materials encyclopedia (`src/data/rawMaterials.ts`),
 *   - the storefront catalogue (`src/data/products.json` + Shaheen's `store-catalog.json`).
 * Writes `src/data/live/scent-behavior.json` — read by «الفحص الشامل» and the council.
 *
 * Honesty: with no token or a failed endpoint the report says «العدّاد الحي مش مقروء» and analyses content only.
 * No personal data, no titles and no free text ever enter the report.
 * Env: SHAM_SCENT_API_URL, SHAM_ADMIN_TOKEN.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { PERFUME_MATERIALS } from '../../src/utils/designers/perfumeMaterials';
import { RAW_MATERIALS_DATABASE } from '../../src/data/rawMaterials';
import { FAMILIES, mergeCatalog, type RawProduct, type StoreCatalogFile } from '../../src/utils/storeCatalog';
import { EMPTY_LAB_AGGREGATE, readLabAggregate, type LabAggregate } from '../../src/utils/labSignals';
import { analyzeScentBehaviour, type BankMaterial, type RawMaterial } from './behaviour';

const env = process.env;
const origin = (env.SHAM_SCENT_API_URL || 'https://sham-perfume-49bf.vercel.app').trim();
const token = env.SHAM_ADMIN_TOKEN?.trim() || '';
const now = Date.now();

const readJson = <T,>(url: URL, fallback: T): T => {
  try { return JSON.parse(readFileSync(url, 'utf8')) as T; } catch { return fallback; }
};
const productsFile = readJson<{ products?: RawProduct[] }>(new URL('../../src/data/products.json', import.meta.url), {});
const catalogFile = readJson<StoreCatalogFile | undefined>(new URL('../../src/data/live/store-catalog.json', import.meta.url), undefined);
const products = mergeCatalog(Array.isArray(productsFile.products) ? productsFile.products : [], catalogFile);

let aggregate: LabAggregate = { ...EMPTY_LAB_AGGREGATE };
let signalsRead = false;
let signalsNoteAr = 'مفيش مفتاح إدارة على السيرفر — العدّاد الحي مش مقروء.';

if (!token || token.length < 12) {
  signalsNoteAr = 'مفيش مفتاح إدارة (SHAM_ADMIN_TOKEN) في التشغيل — العدّاد الحي مش مقروء.';
} else {
  try {
    const url = new URL('/api/admin/lab-signals', origin);
    if (url.protocol !== 'https:') throw new Error('origin must be https');
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
      redirect: 'error',
    });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const body = (await response.json()) as { aggregate?: unknown };
    aggregate = readLabAggregate(body.aggregate);
    signalsRead = true;
    signalsNoteAr = 'العدّاد الحي مقروء من السيرفر (أعداد مجهولة فقط: خامات ونوع تركيز، من غير أي بيانات شخصية).';
  } catch (error) {
    signalsNoteAr = `تعذّر قراءة العدّاد الحي (${error instanceof Error ? error.message.slice(0, 40) : 'UNKNOWN'}) — التحليل من المحتوى بس.`;
  }
}

const bank: BankMaterial[] = PERFUME_MATERIALS.map((m) => ({ id: m.id, name: m.name, layer: m.layer, tags: [...m.tags] }));
const raw: RawMaterial[] = RAW_MATERIALS_DATABASE.map((m) => ({
  id: m.id, nameAr: m.nameAr, nameEn: m.nameEn, category: m.category, categoryAr: m.categoryAr,
  olfactoryFamily: m.olfactoryFamily, pyramidPlacement: String(m.pyramidPlacement),
}));

const report = analyzeScentBehaviour({
  now,
  aggregate,
  signalsRead,
  signalsNoteAr,
  bank,
  raw,
  storeFamilies: [...FAMILIES],
  products: products.map((p) => ({ families: [...p.families], inStock: p.inStock })),
});

writeFileSync(new URL('../../src/data/live/scent-behavior.json', import.meta.url), `${JSON.stringify(report, null, 1)}\n`);

console.log(report.summaryAr);
for (const line of report.planAr) console.log(`- ${line}`);
if (report.notes.length) for (const note of report.notes) console.log(`! ${note}`);

if (env.GITHUB_STEP_SUMMARY) {
  const propose = report.proposals.map((p) => `| ${p.nameAr} | ${p.family} | ${p.reasonAr} |`);
  const cover = report.coverage.filter((c) => c.bankMaterials <= 1).map((c) => `| ${c.nameAr} | ${c.bankMaterials} | ${c.products} |`);
  const lines = [
    '## روبوت سلوك الزائر العطري',
    '',
    report.summaryAr,
    '',
    `- التركيبات المتشاركة: ${report.signals.read ? report.signals.designs : 'العدّاد مش مقروء'}`,
    `- الدرجة: ${report.score}/100`,
    '',
    '### الخطة',
    report.planAr.map((l) => `- ${l}`).join('\n') || '- لا يوجد',
    '',
    '### عائلات ناقصة في بنك المعمل',
    '| العائلة | خامات المعمل | منتجات المتجر |',
    '|---|---|---|',
    cover.join('\n') || '| — | — | — |',
    '',
    '### مواد مقترحة للإضافة',
    '| المادة | العائلة | السبب |',
    '|---|---|---|',
    propose.join('\n') || '| — | — | — |',
    '',
    '> مجهول بالكامل: أسماء الخامات ونوع التركيز بس، من غير أسماء أو عناوين أو أي بيانات شخصية.',
  ];
  writeFileSync(env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`, { flag: 'a' });
}
if (env.GITHUB_ACTIONS) {
  const clip = (t: string) => t.replace(/[\r\n%]/g, ' ').slice(0, 2800);
  console.log(`::notice title=Shaheen scent behaviour::${clip(report.summaryAr)}`);
  if (!signalsRead) console.log(`::warning title=Shaheen scent behaviour::${clip(report.signals.noteAr)}`);
}
