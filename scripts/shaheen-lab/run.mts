/**
 * روبوت «المُجرِّب» — معمل شاهين للتجارب والابتكار.
 *   node --import tsx scripts/shaheen-lab/run.mts
 * يكتب التقرير الحي src/data/live/shaheen-lab.json من محتوى المعمل الحقيقي
 * (src/utils/shaheenLab.ts + shaheenLabCatalog.ts): تغطية كل مجال، وفهرس التجارب والأبحاث
 * والمنتجات وروابط التعاون بين العلوم. لا نتائج مزيفة — كل رقم مشتق من المحتوى الموثّق.
 */
import { writeFileSync } from 'node:fs';
import {
  LAB, LAB_CROSS, LAB_EXPERIMENTS, LAB_FIELDS, LAB_PRODUCTS, LAB_RESEARCH,
  labCrossWith, labExperimentsIn, labProductsIn, labResearchIn, labStats,
} from '../../src/utils/shaheenLab';

const OUT = new URL('../../src/data/live/shaheen-lab.json', import.meta.url);

const stats = labStats();
const report = {
  version: 1,
  updatedAt: new Date().toISOString(),
  lab: { nameAr: LAB.nameAr, nameEn: LAB.nameEn, missionAr: LAB.missionAr, mottoAr: LAB.mottoAr },
  counts: {
    fields: stats.fields,
    experiments: stats.experiments,
    research: stats.research,
    products: stats.products,
    crossLinks: stats.crossLinks,
  },
  fields: LAB_FIELDS.map((f) => ({
    id: f.id,
    nameAr: f.nameAr,
    nameEn: f.nameEn,
    scienceAr: f.scienceAr,
    methodsAr: f.methodsAr,
    toolsAr: f.toolsAr,
    marketAr: f.marketAr,
    experiments: labExperimentsIn(f.id).length,
    research: labResearchIn(f.id).length,
    products: labProductsIn(f.id).length,
    cross: labCrossWith(f.id).length,
  })),
  experiments: LAB_EXPERIMENTS.map((e) => ({
    id: e.id, field: e.field, titleAr: e.titleAr, questionAr: e.questionAr,
    hypothesisAr: e.hypothesisAr, steps: e.stepsAr.length, safetyAr: e.safetyAr,
    expectedAr: e.expectedAr, crossWith: e.crossWith,
  })),
  cross: LAB_CROSS.map((c) => ({ id: c.id, titleAr: c.titleAr, fields: c.fields, whyAr: c.whyAr, productsAr: c.productsAr })),
  research: LAB_RESEARCH.map((r) => ({ id: r.id, field: r.field, titleAr: r.titleAr, scientistAr: r.scientistAr, yearAr: r.yearAr, findingAr: r.findingAr })),
  products: LAB_PRODUCTS.map((p) => ({ id: p.id, field: p.field, nameAr: p.nameAr, marketAr: p.marketAr, scienceAr: p.scienceAr, statusAr: p.statusAr })),
  nextStepsAr: [
    `تنفيذ تجارب ${LAB_EXPERIMENTS.length} مصممة على أرض المعمل وتوثيق نتائجها في سجلات لكل مجال`,
    'تحويل المنتجات ذات النتائج المثبتة إلى نماذج أولية قابلة للعرض في المتجر',
    'توسيع خريطة التعاون بين العلوم بتجارب مشتركة جديدة كل شهر',
    'مراجعة الأبحاث الراسخة وإضافة دروسها لمنهج الجامعة حتى يقرأها شاهين بنفسه',
  ],
};

writeFileSync(OUT, JSON.stringify(report, null, 1) + '\n', 'utf8');
console.log(`shaheen-lab.json written — ${stats.fields} fields, ${stats.experiments} experiments, ${stats.research} research, ${stats.products} products, ${stats.crossLinks} cross-links`);
