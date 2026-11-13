/**
 * اختبارات بوابة استقبال التحديثات — أول ملف يستقبل أي تطوير من أي منصة:
 * تطبيق الزيادة فقط، إبقاء الملغي ملغياً، وحماية بيانات المستخدمين.
 */
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import {
  analyzePackage, cancelDevelopment, getInstalledDevelopment, listAppliedUpdates,
  listCanceledDevelopments, listInstalledDevelopments, parseDevelopmentPackage,
  receiveDevelopment, restoreDevelopment, validatePackage,
} from '../src/updates/updateGateway';
import { isProtectedStorageKey, snapshotUserData, verifyAndRestoreUserData } from '../src/updates/userDataGuard';
import { LEDGER_LIMIT } from '../src/updates/updatesStore';
import { readJson, safeStorage, UPDATES_INSTALLED_KEY } from '../src/updates/storage';
import type { DevelopmentItem, DevelopmentPackage } from '../src/updates/types';

const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
let memory: Map<string, string>;
beforeEach(() => {
  memory = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
  } });
});
if (original) process.on('exit', () => {
  Object.defineProperty(globalThis, 'localStorage', original);
});

const item = (overrides: Partial<DevelopmentItem> & { id: string }): DevelopmentItem => ({
  kind: 'tool', version: 1, titleAr: 'أداة', titleEn: 'Tool',
  payload: { label: 'demo' }, ...overrides,
});
const pkg = (packageId: string, items: DevelopmentItem[], platform = 'arena'): DevelopmentPackage => ({
  schemaVersion: 1, packageId, platform, items,
});
const reportOf = (report: ReturnType<typeof receiveDevelopment>, id: string) =>
  report.items.find((entry) => entry.id === id)!;

test('أول استقبال: العنصر الجديد فقط هو الذي يُثبّت (الزيادة فقط)', () => {
  const first = receiveDevelopment(pkg('p1', [item({ id: 'tool.a', payload: { v: 1 } })]));
  assert.equal(first.ok, true);
  assert.equal(reportOf(first, 'tool.a').decision, 'applied');
  assert.equal(getInstalledDevelopment('tool.a')?.version, 1);
  assert.equal(listAppliedUpdates().length, 1);
});

test('إعادة إرسال نفس المحتوى: unchanged، ونفس الحزمة: duplicate', () => {
  receiveDevelopment(pkg('p1', [item({ id: 'tool.a', payload: { v: 1 } })]));
  const again = receiveDevelopment(pkg('p2', [item({ id: 'tool.a', payload: { v: 1 } })]));
  assert.equal(reportOf(again, 'tool.a').decision, 'unchanged');
  assert.equal(getInstalledDevelopment('tool.a')?.version, 1);

  const duplicate = receiveDevelopment(pkg('p1', [item({ id: 'tool.a', payload: { v: 1 } })]));
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.items.length, 0);
  assert.equal(listAppliedUpdates().length, 2, 'الحزمة المكررة لا تضيف قيداً');
});

test('الترقية تُقبل فقط إذا كان الإصدار أحدث والمحتوى مختلفاً فعلاً', () => {
  receiveDevelopment(pkg('p1', [item({ id: 'tool.a', version: 1, payload: { v: 1 } })]));

  const bumpOnly = receiveDevelopment(pkg('p2', [item({ id: 'tool.a', version: 9, payload: { v: 1 } })]));
  assert.equal(reportOf(bumpOnly, 'tool.a').decision, 'unchanged', 'رقم إصدار أكبر دون تغيير محتوى ليس زيادة');

  const realUpgrade = receiveDevelopment(pkg('p3', [item({ id: 'tool.a', version: 2, payload: { v: 2 } })]));
  assert.equal(reportOf(realUpgrade, 'tool.a').decision, 'updated');
  assert.equal(getInstalledDevelopment('tool.a')?.version, 2);

  const downgrade = receiveDevelopment(pkg('p4', [item({ id: 'tool.a', version: 1, payload: { v: 0 } })]));
  assert.equal(reportOf(downgrade, 'tool.a').decision, 'stale');
  assert.equal(getInstalledDevelopment('tool.a')?.version, 2);
});

test('ما لغيناه قبل ذلك يبقى ملغىً مهما عاد من أي منصة', () => {
  receiveDevelopment(pkg('p1', [item({ id: 'tool.a', payload: { v: 1 } })]));
  cancelDevelopment('tool.a', 'مش محتاجينها', 'not needed');
  assert.equal(getInstalledDevelopment('tool.a'), null);
  assert.equal(listCanceledDevelopments().length, 1);

  const returned = receiveDevelopment(pkg('p2', [
    item({ id: 'tool.a', version: 5, payload: { v: 5 } }),
    item({ id: 'tool.b' }),
  ], 'chatgpt'));
  assert.equal(reportOf(returned, 'tool.a').decision, 'canceled', 'عاد ملغياً فرفض');
  assert.equal(getInstalledDevelopment('tool.a'), null);
  assert.equal(reportOf(returned, 'tool.b').decision, 'applied', 'الباقي لا يعاقب');

  const canceled = listCanceledDevelopments().find((entry) => entry.id === 'tool.a')!;
  assert.equal(canceled.rejectedAttempts, 1, 'تُحتسب محاولة الإعادة المرفوضة');
  assert.ok(canceled.lastAttemptAt);

  // منصة ثالثة تعيد المحاولة: نفس الرفض.
  const third = receiveDevelopment(pkg('p3', [item({ id: 'tool.a', version: 9, payload: { v: 9 } })], 'claude'));
  assert.equal(reportOf(third, 'tool.a').decision, 'canceled');
  assert.equal(listCanceledDevelopments().find((entry) => entry.id === 'tool.a')!.rejectedAttempts, 2);
});

test('الإلغاء الاستباقي: معرّف لم يصل بعد يُلغى فلا يُثبّت عند وصوله', () => {
  cancelDevelopment('tool.future', 'مرفوض مسبقاً');
  const arrived = receiveDevelopment(pkg('p1', [item({ id: 'tool.future' })]));
  assert.equal(reportOf(arrived, 'tool.future').decision, 'canceled');
  assert.equal(getInstalledDevelopment('tool.future'), null);
});

test('الاستعادة: بعد رفع الإلغاء يُثبَّت التطوير عند وصوله من جديد', () => {
  receiveDevelopment(pkg('p1', [item({ id: 'tool.a', payload: { v: 1 } })]));
  cancelDevelopment('tool.a');
  assert.equal(restoreDevelopment('tool.a'), true);
  assert.equal(listCanceledDevelopments().length, 0);
  const again = receiveDevelopment(pkg('p2', [item({ id: 'tool.a', version: 2, payload: { v: 2 } })]));
  // الإلغاء أزال النسخة المثبتة، فعودته بعد الاستعادة تطبيق جديد بالإصدار الأحدث.
  assert.equal(reportOf(again, 'tool.a').decision, 'applied');
  assert.equal(getInstalledDevelopment('tool.a')?.version, 2);
});

test('بيانات المستخدمين لا تُلمس أثناء التطبيق', () => {
  const store = safeStorage();
  store.setItem('sham_perfume_registered_users_db', '[{"id":"usr-1"}]');
  store.setItem('sham_perfume_current_user_session', '{"id":"usr-1"}');
  store.setItem('miyaar_perfume_saved_formulas', '[{"id":"f-1"}]');

  const report = receiveDevelopment(pkg('p1', [
    item({ id: 'tool.a', payload: { v: 1 } }),
    item({ id: 'tool.b' }),
  ]));
  assert.equal(report.ok, true);
  assert.equal(report.userDataPreserved, true);
  assert.equal(store.getItem('sham_perfume_registered_users_db'), '[{"id":"usr-1"}]');
  assert.equal(store.getItem('sham_perfume_current_user_session'), '{"id":"usr-1"}');
  assert.equal(store.getItem('miyaar_perfume_saved_formulas'), '[{"id":"f-1"}]');
  assert.equal(listInstalledDevelopments().length, 2);
});

test('أي حمولة تحاول لمس تخزين المستخدمين تُرفض بالكامل', () => {
  const store = safeStorage();
  store.setItem('sham_perfume_user_experience_v1', '[{"id":"x"}]');

  const report = receiveDevelopment(pkg('p1', [
    item({ id: 'tool.spy', payload: { storageKey: 'sham_perfume_user_experience_v1' } }),
    item({ id: 'tool.wipe', payload: { clearUserCache: true } }),
    item({ id: 'tool.clean' }),
  ]));
  assert.equal(reportOf(report, 'tool.spy').decision, 'rejected');
  assert.equal(reportOf(report, 'tool.wipe').decision, 'rejected');
  assert.equal(reportOf(report, 'tool.clean').decision, 'applied');
  assert.equal(getInstalledDevelopment('tool.spy'), null);
  assert.equal(store.getItem('sham_perfume_user_experience_v1'), '[{"id":"x"}]');
});

test('حارس البيانات يرد أي مفتاح محمي تغيّر أثناء التطبيق', () => {
  const store = safeStorage();
  store.setItem('sham_perfume_user_orders_v1', '[{"id":"o-1"}]');
  const snapshot = snapshotUserData();
  store.setItem('sham_perfume_user_orders_v1', '[]');
  store.setItem('sham_perfume_user_analytics_v1', '{}');
  const verification = verifyAndRestoreUserData(snapshot);
  assert.equal(verification.preserved, false);
  assert.deepEqual(verification.restored.sort(), ['sham_perfume_user_analytics_v1', 'sham_perfume_user_orders_v1']);
  assert.equal(store.getItem('sham_perfume_user_orders_v1'), '[{"id":"o-1"}]');
  assert.equal(store.getItem('sham_perfume_user_analytics_v1'), null, 'المفتاح الدخيل يُحذف');
});

test('مفاتيح بوابة التحديثات نفسها ليست بيانات مستخدمين', () => {
  assert.equal(isProtectedStorageKey('sham_updates_installed_v1'), false);
  assert.equal(isProtectedStorageKey('sham_updates_ledger_v1'), false);
  assert.equal(isProtectedStorageKey('sham_perfume_user_experience_v1'), true);
  assert.equal(isProtectedStorageKey('miyaar_perfume_saved_formulas'), true);
  assert.equal(isProtectedStorageKey('shaheen_engine_choice'), true);
});

test('التبعيات: المؤجل يثبت عند وصول تبعيته، والملغاة تمنع الاعتماد عليها', () => {
  const first = receiveDevelopment(pkg('p1', [item({ id: 'tool.child', requires: ['tool.parent'] })]));
  assert.equal(reportOf(first, 'tool.child').decision, 'deferred');
  assert.equal(getInstalledDevelopment('tool.child'), null);

  const second = receiveDevelopment(pkg('p2', [
    item({ id: 'tool.parent' }),
    item({ id: 'tool.child', requires: ['tool.parent'] }),
  ]));
  assert.equal(reportOf(second, 'tool.parent').decision, 'applied');
  assert.equal(reportOf(second, 'tool.child').decision, 'applied');

  // تبعية ملغاة: التطوير الذي يعتمد عليها يؤجل.
  cancelDevelopment('tool.parent');
  const third = receiveDevelopment(pkg('p3', [item({ id: 'tool.child2', requires: ['tool.parent'] })]));
  assert.equal(reportOf(third, 'tool.child2').decision, 'deferred');
});

test('replaces: البديل يثبت والعنصر القديم يُزال من المثبتات', () => {
  receiveDevelopment(pkg('p1', [item({ id: 'tool.old', payload: { v: 1 } })]));
  const report = receiveDevelopment(pkg('p2', [
    item({ id: 'tool.new', replaces: 'tool.old', payload: { v: 2 } }),
  ]));
  assert.equal(reportOf(report, 'tool.new').decision, 'applied');
  assert.equal(getInstalledDevelopment('tool.old'), null);
  assert.equal(getInstalledDevelopment('tool.new')?.version, 1);

  // داخل الحزمة نفسها: القديم لا يثبت لأن البديل يحل محله.
  const samePackage = receiveDevelopment(pkg('p3', [
    item({ id: 'tool.older', payload: { v: 1 } }),
    item({ id: 'tool.newer', replaces: 'tool.older', payload: { v: 2 } }),
  ]));
  assert.equal(reportOf(samePackage, 'tool.older').decision, 'stale');
  assert.equal(reportOf(samePackage, 'tool.newer').decision, 'applied');
  assert.equal(getInstalledDevelopment('tool.older'), null);
});

test('الحزم غير الصالحة ترفض كلياً مع سبب واضح', () => {
  const cases: Array<{ pkg: unknown; errorAr: string }> = [
    { pkg: { schemaVersion: 2, packageId: 'x', platform: 'arena', items: [] }, errorAr: 'إصدار المخطط' },
    { pkg: { schemaVersion: 1, platform: 'arena', items: [item({ id: 'tool.a' })] }, errorAr: 'معرّف الحزمة' },
    { pkg: { schemaVersion: 1, packageId: 'x', platform: 'arena', items: [] }, errorAr: 'لا تحتوي' },
    { pkg: { schemaVersion: 1, packageId: 'x', platform: 'arena', items: [item({ id: 'X' })] }, errorAr: 'المعرف' },
    {
      pkg: {
        schemaVersion: 1, packageId: 'x', platform: 'arena',
        items: [item({ id: 'tool.a' }), item({ id: 'tool.a', payload: { v: 2 } })],
      }, errorAr: 'مكرر',
    },
    { pkg: { schemaVersion: 1, packageId: 'x', platform: 'arena', items: [item({ id: 'tool.a', requires: ['tool.a'] })] }, errorAr: 'نفسه' },
    { pkg: { schemaVersion: 1, packageId: 'x', platform: 'arena', items: [item({ id: 'tool.a', replaces: 'tool.a' })] }, errorAr: 'replaces' },
  ];
  for (const { pkg: bad, errorAr } of cases) {
    const report = receiveDevelopment(bad);
    assert.equal(report.ok, false, JSON.stringify(bad));
    assert.ok(report.errorAr?.includes(errorAr), `${report.errorAr} يجب أن يحتوي «${errorAr}»`);
    assert.equal(listInstalledDevelopments().length, 0);
    assert.equal(listAppliedUpdates().length, 0);
  }
  assert.equal(validatePackage('not an object').ok, false);
});

test('parseDevelopmentPackage: تحليل النص الوارد من منصة أخرى', () => {
  const valid = parseDevelopmentPackage(JSON.stringify(pkg('p1', [item({ id: 'tool.a' })])));
  assert.equal(valid.ok, true);

  const notJson = parseDevelopmentPackage('{broken');
  assert.equal(notJson.ok, false);

  const badPackage = parseDevelopmentPackage(JSON.stringify({ schemaVersion: 1, packageId: '', platform: 'x', items: [] }));
  assert.equal(badPackage.ok, false);
});

test('التحليل المسبق (dryRun) لا يكتب شيئاً ولا يلغي شيئاً', () => {
  const report = analyzePackage(pkg('p1', [
    item({ id: 'tool.a', payload: { v: 1 } }),
    item({ id: 'tool.canceled' }),
  ]));
  assert.equal(report.dryRun, true);
  assert.equal(reportOf(report, 'tool.a').decision, 'applied', 'يتوقع التثبيت دون أن يثبّت');
  assert.equal(listInstalledDevelopments().length, 0);
  assert.equal(listAppliedUpdates().length, 0);

  cancelDevelopment('tool.canceled');
  const after = analyzePackage(pkg('p2', [item({ id: 'tool.canceled' })]));
  assert.equal(reportOf(after, 'tool.canceled').decision, 'canceled');
  assert.equal(listCanceledDevelopments().find((e) => e.id === 'tool.canceled')!.rejectedAttempts, 0, 'التحليل لا يحتسب محاولة');
});

test('النسخة المنقحة من نفس المعرف تُعالج ويشار إليها كمراجعة', () => {
  receiveDevelopment(pkg('p1', [item({ id: 'tool.a', payload: { v: 1 } })]));
  const revision = receiveDevelopment(pkg('p1', [item({ id: 'tool.a', version: 2, payload: { v: 2 } })]));
  assert.equal(revision.duplicate, false);
  assert.equal(reportOf(revision, 'tool.a').decision, 'updated');
  const ledger = listAppliedUpdates();
  assert.equal(ledger.length, 2);
  assert.equal(ledger[0].revision, true);
  assert.equal(ledger[0].counts.updated, 1);
  assert.equal(ledger[1].revision, false);
});

test('سجل التحديثات محدود الحجم والأحدث أولاً', () => {
  for (let i = 0; i < 25; i++) {
    receiveDevelopment(pkg(`p${i}`, [item({ id: `tool.t${i}` })]));
  }
  const ledger = listAppliedUpdates();
  assert.equal(ledger.length, 25);
  assert.equal(ledger[0].packageId, 'p24');
  assert.ok(ledger.length <= LEDGER_LIMIT);
});

test('بيانات تخزين فاسدة لا تسقط البوابة', () => {
  safeStorage().setItem(UPDATES_INSTALLED_KEY, 'not json at all');
  const installed = readJson<Record<string, unknown>>(UPDATES_INSTALLED_KEY, {});
  assert.deepEqual(installed, {});
  const report = receiveDevelopment(pkg('p1', [item({ id: 'tool.a' })]));
  assert.equal(report.ok, true);
  assert.equal(getInstalledDevelopment('tool.a')?.id, 'tool.a');
});

test('مقارنة عميقة مستقلة عن ترتيب المفاتيح', () => {
  receiveDevelopment(pkg('p1', [item({ id: 'tool.a', payload: { x: 1, y: { b: 2, a: 3 } } })]));
  const reordered = receiveDevelopment(pkg('p2', [item({ id: 'tool.a', payload: { y: { a: 3, b: 2 }, x: 1 } })]));
  assert.equal(reportOf(reordered, 'tool.a').decision, 'unchanged');
});
