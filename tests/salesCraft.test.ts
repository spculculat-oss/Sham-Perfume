import assert from 'node:assert/strict';
import test from 'node:test';
import productsData from '../src/data/products.json';
import catalogFile from '../src/data/live/store-catalog.json';
import { mergeCatalog, type RawProduct, type StoreCatalogFile } from '../src/utils/storeCatalog';
import { namedProducts, productLink, storeAnswer, withContext } from '../src/utils/shaheenBrain';
import { productAnswer } from '../src/utils/shaheenPitch';
import { salesAnswer } from '../src/utils/shaheenSeller';
import { cleanNote, noteAr, readableNotes } from '../src/utils/noteNames';
import { SALES_PITFALLS, SALES_PRINCIPLES, buyerHint, closeLine, polishSale, readBuyer, salesLint, salesPromptBlock } from '../src/utils/salesCraft';
import { linkTools } from '../src/utils/shaheenTools';
import { isShoppingTurn, shoppingBrief, systemInstruction } from '../server/shaheen';
import { productAnswer as pageProductAnswer } from '../server/core/orchestrator';
import { storefrontCatalog } from '../server/core/storeGuide';

const PRODUCTS = mergeCatalog((productsData as { products?: RawProduct[] }).products || [], catalogFile as unknown as StoreCatalogFile);
const link = productLink();
const SET = 'طقم هدايا سبريماسي نوار اند بيربل';
const links = (reply: string) => new Set([...reply.matchAll(/\/p\/([a-z0-9-]+)\.html/g)].map((m) => m[1]));
/** What the owner got on 2026-10-23 («دة رد مش احترافى»), line for line. */
const OLD_REPLY = `**من متجر شام:**
1. [طقم هدايا سبريماسي نوار اند بيربل](https://spculculat-oss.github.io/Sham-Perfume/p/gift-set-supremacy-noir-and-purple-1133.html) — 1,420 جنيه · 100 مل
   - المكونات: القاعدة: Spicy، Musky SUPREMACY PURPLE
**الثبات:** خفيف لمتوسط، جدّده في اليوم.
**الخطوة الجاية:** افتح صفحة «طقم هدايا سبريماسي نوار اند بيربل» واضغط «شراء مباشر» أو ضيفه للسلة — أو اكتبلي «هاخده» وأنا أمشي معاك الطلب خطوة بخطوة. لو السعر مش مريحك قولّي «غالي» وأجيبلك الأوفر، ولو محتار قولّي «مش متأكد» وأوضحلك بصراحة.`;

test('he reads the buyer: style, motive, recipient, urgency, expertise — from the visitor’s own words', () => {
  assert.equal(readBuyer(['بكام؟ باختصار']).style, 'direct');
  assert.equal(readBuyer(['ايه الفرق في التركيز وثباته كام ساعة؟ ومكوناته ايه بالظبط؟']).style, 'analytical');
  assert.equal(readBuyer(['عايز حاجة تلفت النظر وتجنن 🔥']).style, 'expressive');
  assert.equal(readBuyer(['خايف اشتري ومايعجبنيش، مضمون ولا لأ؟']).style, 'cautious');
  assert.equal(readBuyer(['عطر حلو للخروج']).style, 'friendly', 'no signal: the warm default, never a forced box');
  const gift = readBuyer(['عايز هدية لمراتي', 'عيد ميلادها بكرة']);
  assert.equal(gift.motive, 'gift');
  assert.equal(gift.recipient, 'wife');
  assert.equal(gift.urgent, true);
  assert.equal(readBuyer(['غالي شوية']).stage, 'objecting');
  assert.equal(readBuyer(['هاخده']).stage, 'ready');
  assert.equal(readBuyer(['هاخده']).style, 'friendly', 'one short «هاخده» is not a hurried buyer');
  assert.equal(readBuyer(['بدور على extrait قاعدته عود كمبودي وباتشولي']).connoisseur, true);
  assert.equal(readBuyer(['I want a gift for my wife, something to stand out']).recipient, 'wife');
});

test('note names: the import junk is cleaned, the notes are said in Arabic, an English word never enters an Arabic line', () => {
  assert.equal(cleanNote('Musky SUPREMACY PURPLE'), 'Musky');
  assert.equal(cleanNote('Musky Unisex CPO 20 ML PERFUME NOTES'), 'Musky');
  assert.equal(cleanNote('Patchouli "'), 'Patchouli');
  assert.equal(cleanNote('VANILLA'), 'VANILLA', 'a note written all in capitals is still a note');
  assert.deepEqual(readableNotes(['Spicy', 'Musky SUPREMACY PURPLE'], 'ar'), ['توابل', 'مسك']);
  assert.equal(noteAr('creamy woods'), 'أخشاب كريمية');
  assert.equal(noteAr('warm spices'), 'توابل دافئة');
  assert.equal(noteAr('Turkish Rose'), 'ورد تركي');
  assert.equal(noteAr('zzqx flower notes'), undefined, 'unknown: nothing rather than a guess');
  const all = PRODUCTS.flatMap((p) => [...p.notes.top, ...p.notes.heart, ...p.notes.base]);
  for (const n of readableNotes(all, 'ar', 10000)) assert.doesNotMatch(n, /[A-Za-z]/, n);
  const translated = all.filter((n) => noteAr(n)).length / all.length;
  assert.ok(translated >= 0.93, `most catalogue notes are said in Arabic (${Math.round(translated * 100)}%)`);
});

test('the owner’s gift set: a merchant’s pitch, not a label — no junk, no weakness first, no planted objection', () => {
  assert.equal(namedProducts(PRODUCTS, 'بكام سبريماسي نوار اند بيربل؟')[0]?.slug, 'gift-set-supremacy-noir-and-purple-1133', 'the set by its own name, without «طقم هدايا»');
  const a = productAnswer(PRODUCTS, withContext(SET), 'ar', link)!;
  assert.ok(a);
  assert.match(a.reply, /gift-set-supremacy-noir-and-purple-1133/);
  assert.doesNotMatch(a.reply, /SUPREMACY|PURPLE|Spicy|Musky/, 'no import junk, no English notes');
  assert.match(a.reply, /توابل/);
  assert.match(a.reply, /مسك/);
  assert.doesNotMatch(a.reply, /جدّ?ده/, 'never the weakness as a verdict');
  assert.doesNotMatch(a.reply, /«غالي»|«مش متأكد»|لو السعر مش مريحك/, 'never the objections planted for him');
  assert.match(a.reply, /جاهز للإهداء/, 'a gift set sold as a gift');
  assert.match(a.reply, /هاخده/);
  assert.match(a.reply, /شراء مباشر/);
  assert.ok(links(a.reply).size <= 2, 'one product and at most one alternative');
  assert.deepEqual(salesLint(a.reply), []);
  // The old reply falls into exactly the pitfalls the owner saw.
  const old = salesLint(OLD_REPLY);
  for (const id of ['plant_objection', 'negative_first', 'raw_jargon']) assert.ok(old.includes(id), id);
});

test('the pitch follows the buyer: the hurried, the analyst, the cautious, the gift buyer and the enthusiast', () => {
  const ask = (q: string) => productAnswer(PRODUCTS, withContext(q), 'ar', link)!.reply;
  const direct = ask('Hawas Ice بكام؟ باختصار');
  assert.doesNotMatch(direct, /\*\*يناسب:\*\*/, 'the hurried buyer gets it short');
  assert.match(direct, /أجهزهولك؟/);
  const analytical = ask('ايه الفرق والثبات كام ساعة في Hawas Ice وتركيزه ايه؟');
  assert.match(analytical, /الافتتاحية .* · القلب .* · القاعدة/, 'the layers by name');
  assert.match(analytical, /للمل/, 'the value per ml');
  const cautious = ask('خايف اشتري Hawas Ice ومايعجبنيش، مضمون؟');
  assert.match(cautious, /إرجاع أو استبدال/);
  const gift = ask('Hawas Ice ينفع هدية لجوزي؟');
  assert.match(gift, /هدية/);
  assert.match(gift, /جوزك/);
  const fan = ask('Hawas Ice يجنن عايز حاجة تلفت النظر 🔥');
  assert.match(fan, /حضور|بيعبّر عنك/);
  for (const r of [direct, analytical, cautious, gift, fan]) {
    assert.deepEqual(salesLint(r), [], r);
    assert.ok(links(r).size <= 2);
    assert.doesNotMatch(r, /«غالي»|«مش متأكد»/);
  }
  assert.notEqual(direct, analytical);
  const en = productAnswer(PRODUCTS, withContext('Is Hawas Ice a good gift for my wife?'), 'en', link)!.reply;
  assert.match(en, /your wife/);
  assert.match(en, /I'll take it/);
  assert.deepEqual(salesLint(en, 'en'), []);
});

test('every product pitch in the catalogue passes the sales lint (no pitfall, no English note in Arabic)', () => {
  const sample = PRODUCTS.filter((p) => p.inStock && /[a-z]{4}/i.test(p.name.en)).filter((_, i) => i % 23 === 0).slice(0, 45);
  let pitched = 0;
  for (const p of sample) {
    for (const q of [`${p.name.ar} كويس؟`, `${p.name.en} ثباته كام ساعة والفرق ايه؟`]) {
      const a = productAnswer(PRODUCTS, withContext(q), 'ar', link);
      if (!a) continue;
      pitched += 1;
      assert.deepEqual(salesLint(a.reply), [], `${q}\n${a.reply}`);
      const story = /\*\*ريحته:\*\*([^\n]*)/.exec(a.reply)?.[1] || '';
      assert.doesNotMatch(story, /[A-Za-z]/, `${q}: ${story}`);
      assert.doesNotMatch(a.reply, /جدّ?ده في اليوم/);
    }
  }
  assert.ok(pitched >= 30, `pitched ${pitched}`);
});

test('the store answer and the seller keep the craft: one soft close, no objection menu, the buyer’s guarantee', () => {
  const s = storeAnswer(PRODUCTS, withContext('عايز عطر رجالي شتوي تحت 5000'), 'ar', link)!;
  assert.doesNotMatch(s.reply, /«غالي»|«مش متأكد»|لو السعر مش مريحك/);
  assert.deepEqual(salesLint(s.reply), []);
  const history = [{ role: 'user' as const, text: 'خايف اشتري عطر ومايعجبنيش' }, { role: 'assistant' as const, text: s.reply }];
  const buy = salesAnswer(PRODUCTS, withContext('هاخده', history), 'ar', link)!;
  assert.match(buy.reply, /إرجاع أو استبدال/, 'the cautious buyer is reassured when he decides');
  assert.match(buy.reply, /يكمّل معاه/);
  assert.deepEqual(salesLint(buy.reply), []);
});

test('the craft as data, fed to the AI engines; their shopping replies are polished of sale-killing sentences', () => {
  assert.ok(SALES_PRINCIPLES.length >= 10 && SALES_PITFALLS.length >= 12);
  for (const r of [...SALES_PRINCIPLES, ...SALES_PITFALLS]) assert.ok(r.ar && r.en && r.source, r.id);
  const block = salesPromptBlock('ar');
  assert.match(block, /بديل واحد/);
  assert.match(block, /تفتح باب الاعتراض/);
  assert.match(systemInstruction('ar'), /تفتح باب الاعتراض/, 'in Shaheen’s own prompt');
  assert.match(buyerHint(readBuyer(['هدية لماما بكرة']), 'ar'), /والدتك/);
  assert.equal(isShoppingTurn('عايز اشتري عطر هدية'), true);
  assert.equal(isShoppingTurn('ايه هو المسك'), false);
  assert.match(shoppingBrief('بكام؟ باختصار', [], 'ar'), /مستعجل/);
  const ai = 'ده عطر ممتاز للسهرات وثباته عالي. فاضل قطعتين بس الحقه! ولو السعر مش مريحك قولي.\nاكتب «هاخده» وأجهزهولك.';
  const polished = polishSale(ai);
  assert.doesNotMatch(polished, /فاضل قطعتين|لو السعر مش مريحك/);
  assert.match(polished, /عطر ممتاز للسهرات/);
  assert.match(polished, /هاخده/);
  assert.equal(polishSale('ازاي احفظ العطر؟ في مكان بارد.'), 'ازاي احفظ العطر؟ في مكان بارد.');
  assert.match(closeLine({ name: 'X', buyer: readBuyer(['بكام؟ باختصار']), lang: 'ar' }), /أجهزهولك؟/);
});

test('no lab calculators under a product reply («بكام» is the store’s price there, not a production cost)', async () => {
  const a = productAnswer(PRODUCTS, withContext(`بكام ${SET}؟ وثباته؟`), 'ar', link)!;
  assert.deepEqual(linkTools({ question: `بكام ${SET}؟ وثباته؟`, answer: a.reply }), []);
  assert.ok(linkTools({ question: 'تكلفة 100 مل عطر بتركيز 20%', answer: 'التكلفة حوالي…' }).length >= 1, 'a real costing question keeps its tool');
  // The product page (Sham Core): the open product sold in one soft step, no menu of alternatives.
  const { items } = await storefrontCatalog({});
  const item = items.find((i) => i.inStock && i.families.length)!;
  const ar = pageProductAnswer(item, 'ar');
  assert.ok(ar.includes(item.nameAr) && ar.includes(String(item.price)));
  assert.match(ar, /شراء مباشر/);
  assert.doesNotMatch(ar, /بديل قريب/);
  assert.deepEqual(salesLint(ar).filter((x) => x !== 'no_next_step'), []);
});
