/**
 * «ملجأ شاهين»: البوابة الموحدة للوصول لأي حاجة — للمنظومة (روبوتات وأدوات وتقارير وسير عمل)
 * وللدولة الداخلية (الاجتماع والفحص الشامل والدورية والسكرتير والكتيّب والهيكل وخريطة التشغيل).
 * الاختبارات تحمي: تغطية كل الموارد، وحقيقية كل مسار (مفيش مكان مخترع)، والوصول الصادق
 * (سؤال الوصول يلاقي مكانه الحقيقي أو مفيش إجابة)، وبريف كل روبوت يعرف ملجأه.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { AI_TOOLS } from '../src/utils/aiTools';
import { BOTS, LEGAL_DECISIONS } from '../src/utils/shaheenOrg';
import { handbookBrief } from '../src/utils/botHandbook';
import { consult, SITE_SECTIONS, SPECIALISTS } from '../src/utils/shaheenSpecialists';
import { findRefuge, refugeDirectory, refugeIndex, refugeWay, REFUGE_NOTE_AR } from '../src/utils/shaheenRefuge';

const root = new URL('..', import.meta.url).pathname;

test('the refuge indexes the whole system and the internal state — nothing is left out', () => {
  const ids = new Set(refugeIndex().map((e) => e.id));
  for (const b of BOTS) assert.ok(ids.has(`robot:${b.id}`), `robot ${b.id}`);
  for (const t of AI_TOOLS) assert.ok(ids.has(`tool:${t.id}`), `tool ${t.id}`);
  for (const f of readdirSync(join(root, 'src/data/live'))) assert.ok(ids.has(`report:${f}`), `report ${f}`);
  for (const f of readdirSync(join(root, '.github/workflows'))) assert.ok(ids.has(`workflow:${f}`), `workflow ${f}`);
  for (const s of SITE_SECTIONS) assert.ok(ids.has(`section:${s.id}`), `section ${s.id}`);
  for (const s of SPECIALISTS) assert.ok(ids.has(`science:${s.id}`), `science ${s.id}`);
  for (const st of ['council', 'precheck', 'patrol', 'secretary', 'handbook', 'org', 'opsmap', 'rules']) assert.ok(ids.has(`state:${st}`), `internal state ${st}`);
  const dir = refugeDirectory();
  for (const d of LEGAL_DECISIONS) assert.ok(dir.includes(d.id), `legal decision ${d.id} is in the directory`);
});

test('every place in the refuge is real — no invented paths', () => {
  for (const e of refugeIndex()) {
    if (/^(src\/|\.github\/|scripts\/)/.test(e.at) || e.at.endsWith('.md')) {
      assert.ok(existsSync(join(root, e.at.replace(/\/$/, ''))), `${e.id} → ${e.at}`);
    }
  }
});

test('anyone can reach anything: questions find their real place and owner', () => {
  const way1 = refugeWay('وين ألاقي تقرير مدرسة شاهين؟', 'ar');
  assert.ok(way1?.includes('src/data/live/shaheen-school.json'), 'the school report is reachable');
  assert.ok(way1?.includes('مدرسة شاهين'), 'the answer names its owner');
  assert.ok(way1?.includes('المتخصص') || way1?.includes('الاستشارة'), 'the answer points to the science behind it');

  const way2 = refugeWay('كيف أصل على أداة التصميم؟', 'ar');
  assert.ok(way2?.includes('design'), 'the design tool is reachable');

  const way3 = refugeWay('الوصول لخريطة التشغيل', 'ar');
  assert.ok(way3?.includes('#admin/ops'), 'the internal ops map is reachable');

  const way4 = refugeWay('where can I find the shaheen memory file?', 'en');
  assert.ok(way4?.includes('shaheen-memory.json'), 'the English access works too');

  // مفيش حاجة اسمها كنز: مفيش إجابة مخترعة أبداً
  assert.equal(refugeWay('وين ألاقي كنز مدفون؟', 'ar'), undefined, 'honest: nothing invented');
  // سؤال معرفي مش سؤال وصول → الملجأ مايردش (الذاكرة هي اللي ترد)
  assert.equal(refugeWay('ما هي مدرسة شاهين؟', 'ar'), undefined, 'knowledge questions stay with memory');
});

test('consulting reaches the refuge first for access questions, then memory', async () => {
  const sources = {
    refuge: (q: string, l: string) => refugeWay(q, l),
    recall: () => ({ answer: 'من ذاكرة شاهين' }),
    library: () => 'من مكتبة شاهين',
  };
  const c1 = await consult('وين ألاقي تقرير المدرسة؟', 'ar', sources);
  assert.equal(c1.source, 'refuge');
  assert.equal(c1.ok, true);
  assert.ok(c1.answer.includes('src/data/live/shaheen-school.json'));

  const c2 = await consult('ما هو العود في العطور؟', 'ar', sources);
  assert.equal(c2.source, 'memory', 'knowledge questions still come from memory');

  const hit = findRefuge('تقرير الدورية بالتناوب');
  assert.ok(hit && hit.entry.at === 'src/data/live/shaheen-patrol.json', 'finding the patrol report');
});

test('every robot knows its refuge — the brief carries the way in', () => {
  for (const b of BOTS) {
    const brief = handbookBrief(b.id);
    assert.ok(brief.includes('shaheenRefuge'), `${b.id} knows the refuge path`);
    assert.ok(brief.includes('ملجأ'), `${b.id} knows it as a refuge`);
  }
  assert.ok(REFUGE_NOTE_AR.includes('src/utils/shaheenRefuge.ts'));
});
