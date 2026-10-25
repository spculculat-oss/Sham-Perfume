/**
 * «الشحن والتجارة» على لسان المختص: سؤال الشحن والجمارك **مش طلب أوردر**، ولازم يترد من تقرير
 * الشحن بمصدره — لا من تخمين ولا بتحويل للزائر على «مساعد شام».
 *
 * العطل اللي الملف ده بيحرسه: كلمة «شحن» أو «توصيل» كانت في `ORDER_WORDS`، فأي سؤال عن الشحن كان
 * بيتقرا «عميل عايز يشحن أوردر»، يتحوّل للمساعد، ومايتسجلش فجوة — يعني شاهين مايتعلمهوش أبداً.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { planFirstTools } from '../server/specialists/tools';
import { SPECIALISTS } from '../src/utils/shaheenSpecialists';

const business = SPECIALISTS.find((s) => s.id === 'specialist_business')!;
const scents = SPECIALISTS.find((s) => s.id === 'specialist_scents')!;
const root = new URL('..', import.meta.url).pathname;
const read = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'));

test('a shipping question reaches the trade tool — it is not read as «place an order»', () => {
  for (const question of ['الشحن لمصر بكام؟', 'الجمارك في السعودية كام؟', 'إيه مشاكل شحن العطر دولياً؟', 'بتشحنوا لفين؟']) {
    const plan = planFirstTools(question, business);
    assert.ok(plan.some((p) => p.tool === 'trade_lane'), `«${question}» لم تصل لأداة الشحن`);
    const handover = plan.find((p) => p.tool === 'hand_over');
    assert.ok(!handover || handover.args.service !== true, `«${question}» اتحوّل لطلب خدمة`);
  }
});

test('a real order with delivery is still a service request — the fix did not break the hand-over', () => {
  const plan = planFirstTools('عايز أشتري 3 زجاجات عطر وتوصيل للقاهرة', business);
  const handover = plan.find((p) => p.tool === 'hand_over');
  assert.ok(handover, 'طلب الشراء لازم يوصل لمساعد شام');
  assert.equal(handover!.args.service, true);
});

test('the trade tool answers from the report, with the destination’s own numbers and its date', () => {
  const report = read('src/data/live/trade-lanes.json');
  assert.ok(report.destinations.length > 0);
  assert.match(String(report.updatedAt), /^\d{4}-\d{2}-\d{2}T/, 'التقرير عليه تاريخ');
  // كل وجهة في التقرير ليها وعد واضح — مفيش «مش معروف» مخفي
  for (const d of report.destinations) assert.ok(['broker_only', 'we_ship', 'unknown'].includes(d.promise), d.code);
  // والمنصات اللي بتشحن بنفسها بتقول لفين بالتحديد
  for (const p of report.platforms.filter((x: { fulfilment: string }) => x.fulfilment === 'platform_ships')) {
    assert.ok(Array.isArray(p.shipsTo), `${p.id} منصة بتشحن من غير وجهات`);
  }
});

test('the school now teaches the trade the specialist was missing', () => {
  const curriculum = readFileSync(join(root, 'scripts/shaheen-school/curriculumSociety.ts'), 'utf8');
  for (const topic of ['UN1266', 'بلد المنشأ', 'تكلفة الشحن الدولي', 'الهامش الصافي', 'de minimis']) {
    assert.ok(curriculum.includes(topic), `المنهج مفيهوش «${topic}»`);
  }
});

test('perfume is never presented as a normal parcel — the dangerous-goods rule stays', () => {
  const lanes = read('src/data/shipping-lanes.json');
  const intl = lanes.carriers.filter((c: { scope: string }) => c.scope === 'international');
  assert.ok(intl.length > 0);
  for (const c of intl) {
    assert.notEqual(c.dg, true, `${c.id} قالت إنها بتقبل العطور من غير إثبات`);
  }
  // ومختص العطور يقدر يستدعى أداة الشحن كمان (المادة الخطرة مجاله)
  assert.ok(planFirstTools('ينفع نشحن عطر UN1266 جوي؟', scents).some((p) => p.tool === 'trade_lane'));
});
