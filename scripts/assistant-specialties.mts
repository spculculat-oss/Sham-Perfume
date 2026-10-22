/**
 * «مراجعة تخصصات مساعد شام» — سطر أوامر يعرض نفس المراجعة اللي في لوحة الإدارة:
 *
 *   npm run review:assistant            # تقرير بالعربي
 *   npm run review:assistant -- --json  # نفس التقرير JSON (للربط بأي أداة)
 *
 * بيشتغل من غير أي مفتاح ذكاء اصطناعي: المحرك المحلي هو اللي بيرد على الأسئلة النموذجية، فالتقرير
 * بيتحقق من الرد الحقيقي اللي الزائر هيشوفه لو الخدمات كلها وقعت. راجع server/core/specialtyReview.ts.
 */
import { Repository } from '../server/core/repository';
import { MemoryStore } from '../server/core/store';
import { reviewSpecialties } from '../server/core/specialtyReview';

async function main() {
  const json = process.argv.includes('--json');
  // A fresh in-memory store (the built-in seed) so the check never depends on the deployment's data.
  const repo = new Repository(new MemoryStore(), {});
  const review = await reviewSpecialties(repo, { env: {} });

  if (json) {
    process.stdout.write(`${JSON.stringify(review, null, 2)}\n`);
  } else {
    console.log(`مراجعة تخصصات مساعد شام — ${review.at}`);
    console.log(`النتيجة: ${review.score}% (${review.passed}/${review.total})`);
    console.log(`المتجر: ${review.store.total} منتج منشور (${review.store.inStock} متوفر) · سعر ${review.store.minPrice}–${review.store.maxPrice} جنيه · ${review.store.lessons} درساً من شاهين`);
    for (const note of review.notes) console.log(`ملاحظة: ${note}`);
    for (const check of review.checks) {
      console.log(`\n${check.ok ? '✅' : '❌'} [${check.owner === 'assistant' ? 'المساعد' : 'شاهين'}] ${check.specialty} — ${check.question}`);
      if (!check.ok) {
        console.log(`   المتوقع: ${check.expected}`);
        console.log(`   اللي حصل: ${check.actual}`);
        console.log(`   الإصلاح: ${check.fix}`);
      }
    }
    if (review.registryProblems.length) console.log(`\nمشاكل السجل: ${review.registryProblems.join(' · ')}`);
  }

  // A failing specialty is a real regression: fail the command so a pipeline notices.
  if (review.score < 100) process.exitCode = 1;
}

main().catch((error) => {
  console.error('تعذّر تشغيل المراجعة:', error);
  process.exitCode = 2;
});
