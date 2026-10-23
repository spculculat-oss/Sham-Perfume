/**
 * «مناورة التخصصات» — the conversation errors of the field drill (2026-10-23) are fixed and stay fixed: every
 * drill passes against Shaheen's own brain, and each fix is pinned by its own case.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mergeCatalog } from '../src/utils/storeCatalog';
import { brainReply, runBrainDrills } from '../src/utils/maneuverDrills';
import { readSituation, relationsAnswer } from '../src/utils/shaheenRelations';
import { withContext } from '../src/utils/shaheenBrain';
import { saleMove } from '../src/utils/shaheenSeller';
import { readBuyer, RECIPIENT_LABEL } from '../src/utils/salesCraft';
import { quickAnswer } from '../src/utils/shaheenQuickApps';
import { offersCardDetails } from '../src/utils/ownerAuthority';

const json = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const products = mergeCatalog(json('../src/data/products.json').products || [], json('../src/data/live/store-catalog.json'));
type Turn = { role: 'user' | 'assistant'; text: string };
const talk = (says: string[], lang: 'ar' | 'en' = 'ar') => {
  const history: Turn[] = [];
  return says.map((say) => {
    const r = brainReply(products, say, history, lang);
    history.push({ role: 'user', text: say }, { role: 'assistant', text: r?.reply || '…' });
    return r;
  });
};

test('every conversation drill passes against his own brain', () => {
  const { findings } = runBrainDrills(products);
  assert.deepEqual(findings.map((f) => `${f.id}: ${f.titleAr}`), []);
});

test('an offer to send card details is warned at once, in Arabic and English', () => {
  assert.ok(offersCardDetails('ممكن أدفع بالفيزا؟ ابعتلك رقم الكارت؟'));
  assert.ok(offersCardDetails('can I send you my card number?'));
  assert.ok(!offersCardDetails('عايز أدفع بالكارت'));
  assert.ok(!offersCardDetails('what is the cvv'));
  const ar = quickAnswer('أكتبلك بيانات البطاقة؟', 'ar');
  assert.equal(ar?.app, 'privacy');
  assert.match(ar!.reply, /ماتبعتش/);
  assert.match(ar!.reply, /صفحة الدفع/);
  assert.match(quickAnswer('should I give you my card details?', 'en')!.reply, /never send/);
});

test('a calm «where is my order» is tracking (no apology); asked again it is step by step', () => {
  assert.equal(readSituation('فين طلبي؟').situation, 'tracking');
  assert.equal(readSituation('فين طلبي يا جماعة محدش بيرد').situation, 'late');
  assert.equal(readSituation('فين طلبي SH-48213؟ بقالي 10 أيام').situation, 'late');
  const [first, again] = talk(['فين طلبي؟', 'إزاي أتتبعه؟']);
  assert.doesNotMatch(first!.reply, /آسف|نعتذر/);
  assert.notEqual(first!.reply, again!.reply);
  assert.match(again!.reply, /تتبع طلبي/);
});

test('an insult after a complaint keeps the complaint and its order number', () => {
  const [, angry] = talk(['طلبي SH-AB123 اتأخر', 'ده نصب!!!']);
  assert.equal(angry?.route, 'relations:late');
  assert.match(angry!.reply, /SH-AB123/);
});

test('a missing item, a sealed return and a price comparison each get their own answer', () => {
  const missing = relationsAnswer(withContext('الأوردر وصل ناقص منه زجاجة'), 'ar');
  assert.equal(missing?.situation, 'missing');
  assert.doesNotMatch(missing!.reply, /من غير ما تفتحه/);
  const sealed = relationsAnswer(withContext('عايز أرجع الطلب لسه متفتحش'), 'ar');
  assert.doesNotMatch(sealed!.reply, /آسف/);
  const other = relationsAnswer(withContext('لقيته أرخص في نون'), 'ar');
  assert.equal(other?.situation, 'price_match');
  assert.doesNotMatch(other!.reply, /هامش|سعر المورّد|margin/);
});

test('a trader who gives the quantity is heard; a group of gifts is a corporate request', () => {
  const [, follow] = talk(['عندي محل عطور وعايز أتعامل معاكم جملة', 'محتاج 30 زجاجة عود']);
  assert.match(follow!.reply, /30 زجاجة/);
  assert.match(follow!.reply, /عود/);
  assert.equal(readSituation('محتاج 10 هدايا لزمايلي في الشغل').situation, 'corporate');
  assert.equal(readSituation('محتاج 2 هدية لمراتي وامي').situation, undefined);
});

test('«غالي شوية» after the discount answer is still about the perfume on screen', () => {
  const [, discount, price] = talk(['عايز عطر عود رجالي', 'فيه خصم عليه؟', 'غالي شوية']);
  assert.doesNotMatch(discount!.reply, /قولّي اسمه/);
  assert.equal(price?.route, 'sales');
});

test('«إزاي أطلبه؟» closes the sale; a perfumery question mid-purchase is not a store list', () => {
  assert.equal(saleMove('إزاي أطلبه؟'), 'buy');
  const ctx = withContext('إيه هو التعتيق؟', [{ role: 'user', text: 'عايز عطر للصيف' }, { role: 'assistant', text: 'ترشيحات' }]);
  assert.equal(ctx.followUp, false);
  assert.equal(withContext('تمام رشحلي', [{ role: 'user', text: 'إيه الهدية المناسبة لحماتي في رمضان؟' }, { role: 'assistant', text: 'نصيحة' }]).followUp, true);
});

test('the gift: the boss is not «زميلك», the son is «ابنك», no romantic names for formal recipients', () => {
  assert.equal(readBuyer(['عايز أجيب لمديري هدية عطر']).recipient, 'boss');
  assert.equal(readBuyer(['ابني نجح وعايز أهاديه عطر']).recipient, 'son');
  assert.equal(RECIPIENT_LABEL.son.ar, 'ابنك');
  const [boss] = talk(['عايز أجيب لمديري هدية عطر']);
  assert.doesNotMatch(boss!.reply, /زميلك|عشاق/);
  const [son] = talk(['ابني نجح في الثانوية وعايز أهاديه عطر']);
  assert.match(son!.reply, /مبروك النجاح/);
  assert.doesNotMatch(son!.reply, /ابنك\/بنتك/);
});

test('in mourning, asking for incense gets calm advice — no repetition, no selling', () => {
  const [first, second] = talk(['الوالد اتوفى الله يرحمه', 'عايز بخور هادي للبيت أيام العزا']);
  assert.notEqual(first!.reply, second!.reply);
  assert.match(second!.reply, /بخور/);
  assert.doesNotMatch(second!.reply, /\/p\/[a-z0-9-]+\.html/);
});
