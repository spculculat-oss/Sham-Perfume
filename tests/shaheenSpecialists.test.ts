/**
 * «مجلس المتخصصين»: علوم مدرسة شاهين الـ27 موزعة على متخصصين — استشارة في أي وقت،
 * واستشاريّو جميع أقسام الموقع. الاختبارات تحمي: التوزيع الكامل بدون تكرار، وتغطية كل
 * أقسام الموقع الفعلية، والرد الصادق (ذاكرة ← مكتبة ← فجوة صريحة)، والتسجيل الرسمي
 * للمتخصصين كروبوتات تحت شاهين (سجل + روابط + ورديات + خبراء فحص).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BOTS, botOf, DEPARTMENTS, LINKS } from '../src/utils/shaheenOrg';
import { handbookBrief } from '../src/utils/botHandbook';
import {
  consult, pickSpecialist, primaryOf, sectionsOf, SITE_SECTIONS, SPECIALISTS, specialistOf, specialistsOf,
} from '../src/utils/shaheenSpecialists';
import { TRACKS } from '../scripts/shaheen-school/curriculum';
import { SHIFTS } from '../scripts/shaheen-patrol/shifts';
import { REVIEWERS } from '../scripts/shaheen-patrol/patrol';

test('the sciences are distributed among the specialists: every school track has exactly one owner', () => {
  const schoolTracks = TRACKS.map((t) => t.id as string).sort();
  assert.equal(schoolTracks.length, 44, 'the academy teaches 44 tracks (the world university)');
  const owned = SPECIALISTS.flatMap((s) => s.tracks as string[]);
  assert.deepEqual([...owned].sort(), schoolTracks, 'each track is owned by exactly one specialist');
  for (const s of SPECIALISTS) assert.ok(s.tracks.length >= 1 && s.sciencesAr.length > 10, s.id);
  for (const s of SPECIALISTS) for (const t of s.tracks) assert.ok(schoolTracks.includes(t), `${s.id} owns real school track ${t}`);
});

test('every site section has consultant specialists — and the app’s real sections are all covered', () => {
  for (const sec of SITE_SECTIONS) {
    assert.ok(sec.consultants.length >= 1, `section ${sec.id} has a consultant`);
    for (const id of sec.consultants) assert.ok(specialistOf(id), `section ${sec.id} → known specialist ${id}`);
    assert.equal(sec.consultants[0], primaryOf(sec.id)?.id, `section ${sec.id} names its primary`);
  }
  for (const s of SPECIALISTS) assert.ok(sectionsOf(s.id).length >= 1, `${s.id} consults for site sections`);
  // كل الأقسام اللي التطبيق بيفتحها فعلاً مغطاة باستشاريين
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const tabs = new Set([...app.matchAll(/activeTab === '([a-zA-Z_]+)'/g)].map((m) => m[1]));
  tabs.add('admin_panel');
  for (const tab of tabs) assert.ok(SITE_SECTIONS.some((sec) => sec.id === tab), `live section «${tab}» has consultants`);
});

test('consulting a specialist works at any time: memory first, then the library, else an honest gap', async () => {
  const c1 = await consult('ما هو العود في العطور؟', 'ar', { recall: () => ({ answer: 'الرد من ذاكرة شاهين' }) });
  assert.equal(c1.source, 'memory');
  assert.equal(c1.ok, true);
  assert.equal(c1.specialist.id, 'specialist_scents');
  assert.equal(c1.answer, 'الرد من ذاكرة شاهين');

  const c2 = await consult('ما هو التشفير في الأمن؟', 'ar', { recall: () => undefined, library: () => 'الرد من مكتبة شاهين' });
  assert.equal(c2.source, 'library');
  assert.equal(c2.ok, true);
  assert.equal(c2.specialist.id, 'specialist_security');

  const c3 = await consult('ما هو الهرم العطري في العطور؟', 'ar', { recall: () => undefined });
  assert.equal(c3.source, 'gap');
  assert.equal(c3.ok, false);
  assert.ok(c3.answer.includes(c3.specialist.nameAr), 'the gap names the specialist who will study it');
  assert.ok(c3.answer.includes('الصراحة'), 'honesty beats guessing');

  const c4 = await consult('hello', 'en', { recall: () => undefined });
  assert.equal(c4.source, 'gap');
  assert.ok(c4.answer.includes('guessing is forbidden'), 'the English gap is honest too');

  // اختيار المتخصص بنفسه يغلب التوجيه، والقسم يفضل متسجّل
  const c5 = await consult('سؤال عام جداً', 'ar', { recall: () => ({ answer: 'ر' }) }, 'store', 'specialist_society');
  assert.equal(c5.specialist.id, 'specialist_society');
  assert.equal(c5.section, 'store');
});

test('questions find their specialist in every science', () => {
  assert.equal(pickSpecialist('ما هي قوانين نيوتن في الفيزياء؟').id, 'specialist_science');
  assert.equal(pickSpecialist('قانون الجاذبية والفيزياء').id, 'specialist_science', 'the و prefix is read through');
  assert.equal(pickSpecialist('التاريخ والحضارات القديمة').id, 'specialist_society');
  assert.equal(pickSpecialist('التشفير وحماية الشبكات').id, 'specialist_security');
  assert.equal(pickSpecialist('لغة بايثون والخوارزميات').id, 'specialist_tech');
  assert.equal(pickSpecialist('التكلفة والمحاسبة والعقود').id, 'specialist_business');
  assert.equal(pickSpecialist('كيف أصنع عطراً برائحة متوازنة؟').id, 'specialist_scents');
  // مفيش إشارة ← المستشار الرئيسي للقسم الحالي، وإلا جوهر المنصة
  assert.equal(pickSpecialist('مرحبا', 'store').id, 'specialist_scents');
  assert.equal(pickSpecialist('مرحبا', 'admin_panel').id, 'specialist_business');
  assert.equal(pickSpecialist('مرحبا').id, 'specialist_scents');
});

test('the specialists are registered robots under Shaheen: links, shifts, reviewers and a fitting brief', () => {
  for (const s of SPECIALISTS) {
    const bot = botOf(s.id);
    assert.ok(bot, `${s.id} is registered in BOTS`);
    assert.ok(DEPARTMENTS.some((d) => d.id === bot!.dept), `${s.id} sits in a real department`);
    assert.match(bot!.dutiesAr, /ستشار/, `${s.id} is a site consultant`);
    assert.ok(LINKS.some((l) => l.from === s.id && l.to === 'chat'), `${s.id} consults the site's chat`);
    assert.ok(LINKS.some((l) => l.to === s.id && l.from === 'school'), `${s.id} studies Shaheen's school`);
    assert.ok(REVIEWERS[s.id], `${s.id} has an expert reviewer`);
    const mine = SHIFTS.filter((sh) => sh.bots.includes(s.id));
    assert.equal(mine.length, 1, `${s.id} is monitored in exactly one shift`);
  }
  const all = SHIFTS.flatMap((x) => x.bots);
  assert.equal(new Set(all).size, all.length, 'a role in two shifts');
  assert.deepEqual([...all].sort(), BOTS.map((b) => b.id).sort(), 'every role has a monitoring shift');
  for (const x of SHIFTS) assert.ok(x.bots.length <= 19, x.nameEn);
  for (const s of SPECIALISTS) {
    const brief = handbookBrief(s.id);
    assert.ok(brief.length <= 2200 && brief.includes(`«${s.nameAr}»`), `${s.id} meets itself in the brief`);
  }
});
