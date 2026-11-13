import assert from 'node:assert/strict';
import test from 'node:test';
import productsData from '../src/data/products.json';
import catalogFile from '../src/data/live/store-catalog.json';
import { mergeCatalog, type RawProduct, type StoreCatalogFile } from '../src/utils/storeCatalog';
import { productLink, storeAnswer, withContext } from '../src/utils/shaheenBrain';
import { salesAnswer } from '../src/utils/shaheenSeller';
import {
  COMMERCE, PUBLIC_RELATIONS, RELATIONS_DRILLS, RELATION_PITFALLS, SOCIOLOGY, polishRelations, readSituation,
  relationsAnswer, relationsLint, relationsPromptBlock, runDrills, socialHint,
} from '../src/utils/shaheenRelations';
import { isComplaintTurn, socialBrief, systemInstruction } from '../server/shaheen';
import { STORE_EMAIL } from '../src/config/contact';

const PRODUCTS = mergeCatalog((productsData as { products?: RawProduct[] }).products || [], catalogFile as unknown as StoreCatalogFile);
const link = productLink();
const ask = (text: string, history: { role: 'user' | 'assistant'; text: string }[] = [], lang = 'ar') => relationsAnswer(withContext(text, history), lang);

test('the three sciences are real knowledge with sources, and every pitfall is named', () => {
  for (const list of [SOCIOLOGY, PUBLIC_RELATIONS, COMMERCE, RELATION_PITFALLS]) {
    assert.ok(list.length >= 6);
    for (const r of list) {
      assert.ok(r.ar.length > 20 && r.en.length > 20 && r.source.length > 5, r.id);
      assert.ok(/[\u0600-\u06FF]/.test(r.ar) && !/[\u0600-\u06FF]/.test(r.en), r.id);
    }
    assert.equal(new Set(list.map((r) => r.id)).size, list.length);
  }
  assert.ok(PUBLIC_RELATIONS.some((r) => /McCollough/.test(r.source)) && PUBLIC_RELATIONS.some((r) => /Coombs/.test(r.source)));
  assert.ok(COMMERCE.some((r) => /Getting to Yes/.test(r.source)));
});

test('training: every real-world drill is read right and answered without a single relationship pitfall', () => {
  assert.ok(RELATIONS_DRILLS.length >= 25);
  const { score, results } = runDrills();
  assert.deepEqual(results.filter((r) => !r.passed), []);
  assert.equal(score, 100);
});

test('he reads people: anger, formality, age, region, order reference, occasion and recipient', () => {
  const angry = readSituation('انتو نصابين!!! فين طلبي SH-7Q2K9');
  assert.equal(angry.anger, 3);
  assert.equal(angry.situation, 'late');
  assert.equal(angry.orderRef, 'SH-7Q2K9');
  assert.equal(readSituation('الطلب اتأخر').anger, 1);
  assert.equal(readSituation('عندك عود؟').anger, 0);
  assert.ok(readSituation('لو سمحت حضرتك عايز أسأل').formal);
  assert.ok(readSituation('أنا ست كبيرة ومش بعرف في النت').elder);
  assert.equal(readSituation('ابغى عطر عود زين').region, 'gulf');
  assert.equal(readSituation('بدي عطر كتير منيح').region, 'levant');
  assert.equal(readSituation('بغيت عطر مزيان بزاف').region, 'maghreb');
  assert.equal(readSituation('عايز عطر حلو اوي').region, 'egypt');
  const gift = readSituation('إيه الهدية المناسبة لحماتي في رمضان؟');
  assert.equal(gift.recipient, 'in_law');
  assert.equal(gift.occasion, 'ramadan');
  // He told us earlier that it is for his boss: the etiquette question still knows the recipient.
  assert.equal(readSituation('ينفع أهادي بعطر؟', ['عايز هدية لمديري']).recipient, 'boss');
});

test('he does not take ordinary questions for a complaint, a wholesale request or a discount', () => {
  const ordinary = ['عايز عطر لماما', 'ايه الفرق بين العود والمسك', 'عطر ثابت للصيف', 'إيه هو التعتيق', 'عايز عطر للفرح بتاعي',
    'ناقص إيه في التركيبة دي؟', 'بقالي سنة بستخدم العود', 'الكميات في التركيبة كام؟', 'توزيع النوتات في الهرم', 'إيه هو سوق التجار؟',
    'منتج محلي ولا مستورد؟', 'تنزيل التطبيق', 'عندكم عطر تقليد سوفاج؟', 'آخر مرة اشتريت عطر كان حلو', 'شكراً على المعلومة',
    'عندي 20 عطر في البيت', 'العطر ده غالي', 'هاخده', 'عطر رجالي ب 500 جنيه', 'ازاي اعمل عطر عود', 'I love oud perfumes',
    'thank you for the info', 'what is the best price for oud?', 'عطر للمدير'];
  for (const q of ordinary) assert.equal(ask(q, [], /[a-z]/i.test(q) ? 'en' : 'ar'), undefined, q);
  // The seller still answers his own moves.
  assert.ok(salesAnswer(PRODUCTS, withContext('غالي', [{ role: 'user', text: 'عايز عطر عود' }, { role: 'assistant', text: storeAnswer(PRODUCTS, withContext('عايز عطر عود', []), 'ar', link)!.reply }]), 'ar', link));
});

test('scenario — a late order with an angry customer: calm, a real apology, real tracking, no promised date, no blame', () => {
  const a = ask('بقالي اسبوعين مستني ومحدش بيرد!!! انتو نصابين ولا ايه؟ الطلب اتأخر');
  assert.ok(a);
  assert.equal(a!.situation, 'late');
  assert.ok(a!.reading.anger >= 2);
  assert.match(a!.reply, /حقك|متضايق/);
  assert.match(a!.reply, /آسف/);
  assert.match(a!.reply, /SH-/);
  assert.match(a!.reply, /مساعد شام للخدمات/);
  assert.ok(a!.reply.includes(STORE_EMAIL));
  assert.doesNotMatch(a!.reply, /بكرة|خلال \d+ (?:يوم|ساعة)|هنعوضك|خصم/);
  assert.doesNotMatch(a!.reply, /بأدب|ألفاظك|مش مسؤوليتنا/);
  assert.match(a!.reply, /بيانات دفع/);
  assert.deepEqual(relationsLint(a!.reply, a!.situation), []);
});

test('scenario — a doubt about the scent: taken seriously, explained without arguing, and a real review path', () => {
  const a = ask('اشتريت منكم العطر وطلع مضروب، ريحته مش زي اللي في المحل التاني خالص');
  assert.equal(a!.situation, 'scent_doubt');
  assert.match(a!.reply, /بناخدها بجد/);
  assert.match(a!.reply, /مش رد على كلامك/);
  assert.doesNotMatch(a!.reply, /مستحيل|ده مش صحيح|أصلي ١٠٠|أصلي 100/);
  assert.match(a!.reply, /الإرجاع والاسترداد/);
});

test('scenario — a gift for a boss, a mother-in-law in Ramadan, a newborn and a condolence: what is fitting comes first', () => {
  const boss = ask('ينفع أهادي مديري بعطر؟');
  assert.equal(boss!.situation, 'etiquette');
  assert.match(boss!.reply, /محترمة ومش شخصية/);
  const ramadan = ask('إيه الهدية المناسبة لحماتي في رمضان؟');
  assert.match(ramadan!.reply, /رمضان/);
  assert.match(ramadan!.reply, /من غير كحول/);
  const baby = ask('عايز عطر هدية للمولود');
  assert.equal(baby!.situation, 'newborn');
  assert.match(baby!.reply, /مايتحطلوش عطر/);
  const grief = ask('عايز ريحة للبيت عشان العزاء');
  assert.equal(grief!.situation, 'condolence');
  assert.match(grief!.reply, /البقاء لله/);
  assert.doesNotMatch(grief!.reply, /\/p\/|هاخده|السعر|جنيه/);
  assert.deepEqual(relationsLint(grief!.reply, 'condolence'), []);
});

test('scenario — wholesale, corporate gifts and a discount: the official quote, the right questions, no invented price', () => {
  const shop = ask('أنا عندي محل وعايز أشتري بالجملة');
  assert.equal(shop!.situation, 'wholesale');
  assert.match(shop!.reply, /محتاج عرض سعر جملة/);
  assert.match(shop!.reply, /الكمية/);
  assert.doesNotMatch(shop!.reply, /\d+ ?%|جنيه/);
  const corp = ask('شركتنا عايزة هدايا للموظفين، حوالي 80 واحد');
  assert.equal(corp!.situation, 'corporate');
  assert.match(corp!.reply, /الميزانية التقريبية للفرد/);
  assert.match(corp!.reply, /كارت باسم الشركة/);
  const qty = ask('محتاج 40 زجاجة');
  assert.equal(qty!.situation, 'wholesale');
  const deal = ask('ممكن خصم لو أخدت اتنين؟');
  assert.equal(deal!.situation, 'discount');
  assert.match(deal!.reply, /مفيش خصومات بتتقال في الشات/);
  assert.match(deal!.reply, /إيه اللي يهمك/);
  assert.doesNotMatch(deal!.reply, /هعملك|هنزلك|خصم \d/);
});

test('praise and a returning customer: thanked without being sold to', () => {
  const thanks = ask('الطلب وصل وحلو جداً، خدمة ممتازة');
  assert.equal(thanks!.situation, 'praise');
  assert.match(thanks!.reply, /تقييمك/);
  assert.doesNotMatch(thanks!.reply, /\/p\/|جنيه|اشتري/);
  const back = ask('أنا عميل قديم ومش أول مرة أشتري منكم');
  assert.equal(back!.situation, 'loyal');
  assert.doesNotMatch(back!.reply, /مكافأة|نقاط|خصم/);
});

test('formality is mirrored, and English visitors get English', () => {
  const formal = ask('لو سمحت حضرتك الزجاجة وصلت مكسورة');
  assert.equal(formal!.situation, 'damaged');
  assert.ok(formal!.reading.formal);
  const en = ask('Where is my order? It is very late!!!', [], 'en');
  assert.equal(en!.situation, 'late');
  assert.doesNotMatch(en!.reply, /[\u0621-\u064A]{2,}/);
  assert.match(en!.reply, /sorry/i);
});

test('the AI engines get the same science, and a complaint reply is cleaned of blame, denial and lectures', () => {
  const block = relationsPromptBlock('ar');
  assert.match(block, /اسمع، اتعاطف، اعتذر/);
  assert.match(block, /مانلومش الزبون/);
  assert.ok(systemInstruction('ar').includes(block));
  assert.ok(isComplaintTurn('الطلب وصل مكسور'));
  assert.ok(!isComplaintTurn('عايز عطر عود'));
  assert.match(socialBrief('انتو حرامية!!! الطلب ماوصلش', [], 'ar'), /متضايق جداً/);
  assert.equal(socialBrief('عايز عطر عود', [], 'ar'), '');
  assert.match(socialHint(readSituation('ابغى هدية عود'), 'ar'), /الخليج/);
  const raw = 'أنا آسف على التأخير. بس الحقيقة دي مش مسؤوليتنا، دي شركة الشحن. ابعت رقم الطلب SH- على الدعم وهنتابع معاك.\nوياريت تتكلم بأدب. هيوصلك بكرة إن شاء الله.';
  const clean = polishRelations(raw);
  assert.doesNotMatch(clean, /مش مسؤوليتنا|بأدب|هيوصلك بكرة/);
  assert.match(clean, /آسف/);
  assert.match(clean, /SH-/);
  assert.deepEqual(relationsLint(clean, 'late'), []);
  assert.ok(relationsLint(raw, 'late').includes('deny'));
  assert.ok(relationsLint('نعتذر عن الإزعاج.', 'late').includes('cold'));
});
