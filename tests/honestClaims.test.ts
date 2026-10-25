import test from 'node:test';
import assert from 'node:assert/strict';
import { hasClaims, stripClaims, tidySupplierText } from '../src/utils/honestClaims';
import { mergeProduct, productHash, type RawProduct, type StoreEntry } from '../src/utils/storeCatalog';
import { fillSourceBrands } from '../scripts/shaheen-import/transform';
import { articlesFromCollected } from '../server/newsFallback';

test('Arabic: the claim goes, the scent stays', () => {
  assert.equal(stripClaims('عطر يجمع بين العود والعنبر. يترك أثراً دخانياً خشبياً دافئاً يدوم طويلاً.', 'ar'),
    'عطر يجمع بين العود والعنبر. يترك أثراً دخانياً خشبياً دافئاً.');
  assert.equal(stripClaims('عطر غني يجمع بين الشوكولاتة والعود. يمنحك ثباتاً طويلاً وجاذبية فريدة تناسب الجنسين.', 'ar'),
    'عطر غني يجمع بين الشوكولاتة والعود.');
  // Council task #183: a promise about the wearer and promotional adjectives go; the scent stays.
  assert.equal(stripClaims('عطر شرقي خشبي ساحر يجمع بين الزعفران والكراميل ليمنحك شعوراً بالفخامة.', 'ar'), 'عطر شرقي خشبي يجمع بين الزعفران والكراميل.');
  assert.equal(stripClaims('عطر فاخر يمزج بين الجلود الراقية والأخشاب المدخنة.', 'ar'), 'عطر يمزج بين الجلود والأخشاب المدخنة.');
  assert.equal(stripClaims('عطر نسائي زهري بالورد والياسمين. يمنحك إطلالة أنثوية جذابة.', 'ar'), 'عطر نسائي زهري بالورد والياسمين.');
  assert.equal(stripClaims('يمنح الهيل العطر عمقاً دافئاً.', 'ar'), 'يمنح الهيل العطر عمقاً دافئاً.', 'what a note gives the scent is a description');
  assert.equal(stripClaims('عطر منعش بالحمضيات. خيار مثالي للاستخدام اليومي.', 'ar'), 'عطر منعش بالحمضيات. خيار مناسب للاستخدام اليومي.');
  assert.equal(stripClaims('يحقق توازناً مثالياً بين الانتعاش والجاذبية طوال اليوم.', 'ar'), 'يحقق توازناً مناسباً بين الانتعاش والجاذبية.');
  assert.equal(stripClaims('عطر حلو يجمع الفانيليا والمارشميلو في مزيج لا يقاوم.', 'ar'), 'عطر حلو يجمع الفانيليا والمارشميلو.');
  assert.equal(stripClaims('عطر يتميز بالقوة والثبات والأناقة.', 'ar'), 'عطر يتميز بالقوة والأناقة.');
  // An honest disclaimer about longevity is not a claim.
  const disclaimer = 'عطر لطافة — الثبات والفوحان يختلفان باختلاف البشرة والمناخ.';
  assert.equal(stripClaims(disclaimer, 'ar'), disclaimer);
  assert.equal(hasClaims(disclaimer, 'ar'), false);
  assert.equal(hasClaims('عطر يدوم طوال اليوم.', 'ar'), true);
});

test('English: shop slogans and longevity promises go, the notes stay', () => {
  assert.equal(stripClaims('It settles into a base of leather, suede and amber, creating a refined signature with long-lasting depth.', 'en'),
    'It settles into a base of leather, suede and amber, creating a refined signature.');
  assert.equal(stripClaims('A warm woody–amber base that lasts intensely for hours.\nPerfect for men who want a confident scent.', 'en'),
    'A warm woody–amber base.\nSuited for men who want a confident scent.');
  assert.equal(stripClaims('Shop Stardust by Afnan. A luxurious fragrance in UAE with citrus, caramel and amber. Buy perfume online UAE.', 'en'),
    'A luxurious fragrance with citrus, caramel and amber.');
  assert.equal(stripClaims('Try the discovery kit in UAE. Best perfumes for women — sample luxury EDPs. Buy online now.', 'en'), '');
  assert.equal(stripClaims('A captivating Eau de Parfum offering a rich and long-lasting oriental experience.', 'en'),
    'A captivating Eau de Parfum offering a rich and oriental experience.');
  const plain = 'Top Notes: Bergamot, Mint\nHeart Notes: Lavender\nBase Notes: Cedarwood, Amber';
  assert.equal(stripClaims(plain, 'en'), plain);
  assert.equal(hasClaims(plain, 'en'), false);
});

test('the supplier text gets its glued sections back on their own lines — nothing added or removed', () => {
  assert.equal(tidySupplierText('Top Notes: Bergamot, LemonHeart Notes: Lavender, NutmegBase Notes: Cedarwood\nQ: Is it good for office?A: Yes.'),
    'Top Notes: Bergamot, Lemon\nHeart Notes: Lavender, Nutmeg\nBase Notes: Cedarwood\nQ: Is it good for office?\nA: Yes.');
  assert.equal(tidySupplierText('Already clean.\nTop Notes: Rose'), 'Already clean.\nTop Notes: Rose');
});

test('the store shows the description without claims, and a plain true sentence when nothing is left', () => {
  const p: RawProduct = { id: 7, sku: 'LAT-007', nameAr: 'عطر سما', nameEn: 'Sama', brand: 'Lattafa', category: 'نسائي', descriptionAr: '', descriptionEn: '', ourPrice: 1000 };
  const base = mergeProduct(p);
  const entry: StoreEntry = {
    sourceHash: '', editor: 'shaheen', updatedAt: '2026-10-20T00:00:00Z', nameAr: 'عطر سما', nameEn: 'Sama',
    descriptionAr: 'عطر زهري بالورد والمسك الأبيض والفانيليا. يمنحك شعوراً بالأنوثة يدوم طوال اليوم.', descriptionEn: 'The best perfume. Buy it online now.',
    gender: 'women', families: ['floral'], notes: { top: [], heart: [], base: [] }, seasons: [], occasions: [], tags: [],
  };
  entry.sourceHash = productHash(p);
  const shown = mergeProduct(p, entry);
  assert.equal(shown.description.ar, 'عطر زهري بالورد والمسك الأبيض والفانيليا.');
  assert.equal(shown.description.en, 'Sama by Lattafa for women with a floral character.');
  assert.ok(base.description.ar.length > 0);
});

test('a product without a brand gets the brand of its single-brand store only', () => {
  const make = (id: number, supplierId: string, brand?: string): RawProduct => ({ id, sku: `S-${id}`, supplierId, brand });
  const products = [
    ...Array.from({ length: 5 }, (_, i) => make(i, 'afnan-com', 'Afnan Perfumes')),
    make(10, 'afnan-com', 'Unknown'), make(11, 'afnan-com'),
    make(20, 'mixed', 'Lattafa'), make(21, 'mixed', 'Rasasi'), make(22, 'mixed', 'Lattafa'), make(23, 'mixed', 'Lattafa'), make(24, 'mixed', 'Lattafa'), make(25, 'mixed', 'Unknown'),
    make(30, 'small', 'Ajmal'), make(31, 'small', 'Unknown'),
  ];
  assert.deepEqual(fillSourceBrands(products), ['S-10', 'S-11']);
  assert.equal(products.find((p) => p.id === 10)!.brand, 'Afnan Perfumes');
  assert.equal(products.find((p) => p.id === 25)!.brand, 'Unknown');
  assert.equal(products.find((p) => p.id === 31)!.brand, 'Unknown');
  assert.deepEqual(fillSourceBrands(products), []);
});

test('«مرصد العطور» without an AI engine: the collected headlines, with source and link, most important first', () => {
  const items = [
    { id: 'a1', url: 'https://example.org/a', source: 'WWD', publishedAt: '2026-10-19T10:00:00Z', category: 'market', importance: 2,
      title: { ar: 'خبر عادي', en: 'Plain news' }, summary: { ar: 'ملخص الخبر العادي.', en: 'Plain summary.' } },
    { id: 'b2', url: 'https://example.org/b', source: 'PR Newswire', publishedAt: '2026-10-20T10:00:00Z', category: 'launch', importance: 5,
      title: { ar: 'إطلاق جديد', en: 'New launch' }, summary: { ar: 'ملخص الإطلاق.', en: 'Launch summary.' } },
    { id: 'c3', url: 'javascript:alert(1)', source: 'X', title: { ar: 'بلا رابط', en: '' }, summary: { ar: 'ملخص.', en: '' } },
  ];
  const out = articlesFromCollected(items, ['/img.jpg'], 'اليوم');
  assert.equal(out.length, 2);
  assert.equal(out[0].id, 'collected-b2');
  assert.equal(out[0].category, 'niche');
  assert.equal(out[0].isHot, true);
  assert.match(out[0].contentAr, /المصدر: PR Newswire — https:\/\/example\.org\/b/);
  assert.equal(out[1].category, 'trends');
  assert.ok(out.every((a) => !/مولّد|ذكاء اصطناعي/.test(`${a.badge} ${a.source} ${a.author}`)));
});

test('the product page never repeats its own title or the notes pyramid inside the description', () => {
  // What the external reviewer saw on a live product page: the name again at the top of «الوصف», and the
  // supplier's «Fragrance Notes» list — which «الهرم العطري» already shows right underneath.
  const p: RawProduct = { id: 252, sku: 'LAT-252', nameAr: 'عطر قمة للرجال من لطافة', nameEn: 'Lattafa Qimmah Eau De Parfum for Men 100ml',
    brand: 'Lattafa', category: 'رجالي', descriptionAr: '', descriptionEn: '', ourPrice: 1200, sizeMl: 100 };
  const sentence = 'The fragrance opens with lavender, cedarwood and saffron before revealing a heart of myrrh.';
  const entry = (descriptionAr: string, descriptionEn: string): StoreEntry => ({
    sourceHash: productHash(p), editor: 'shaheen', updatedAt: '2026-10-24T00:00:00Z',
    nameAr: 'عطر قمة للرجال من لطافة', nameEn: 'Lattafa Qimmah Eau De Parfum for Men 100ml',
    descriptionAr, descriptionEn, gender: 'men', families: ['oriental', 'woody'],
    notes: { top: ['Lavender'], heart: ['Myrrh'], base: ['Oud'] }, seasons: [], occasions: [], tags: [],
  });

  // Name on its own line, then the same name glued to the sentence.
  const echoed = mergeProduct(p, entry('عطر قمة للرجال من لطافة يفتتح بالخزامى وخشب الأرز والزعفران ويقود إلى قلب من المر والأعشاب.',
    `Lattafa Qimmah Eau De Parfum for Men 100ml\nLattafa Qimmah Eau De Parfum for Men 100ml ${sentence}`));
  assert.equal(echoed.description.en, sentence);
  assert.doesNotMatch(echoed.description.en, /Qimmah/);
  assert.match(echoed.description.ar, /الخزامى/, 'the Arabic sentence keeps its own words');

  // Nothing but the name and the notes list: the plain true sentence takes its place.
  const onlyNotes = mergeProduct(p, entry('', 'Aroma Mood – 100 ml Eau de Parfum Unisex\nFragrance Notes:\nTop: Citrus\nHeart: Musk\nBase: Amber'));
  assert.ok(onlyNotes.description.en.length > 0);
  assert.doesNotMatch(onlyNotes.description.en, /Top:|Fragrance Notes/i);
  assert.doesNotMatch(onlyNotes.description.ar, /Top:|Fragrance Notes/i);
});
