import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { BRAND_SPELLINGS, fixArabicEntry, fixArabicText, isLatinOnlyName, NAME_FIXES } from '../src/utils/arabicProductNames';
import { reviewCatalog } from '../scripts/shaheen-catalog/review';
import { productHash, type RawProduct, type StoreCatalogFile } from '../src/utils/storeCatalog';

const entry = (nameAr: string, descriptionAr = 'عطر خشبي.', tags: string[] = []) => ({ nameAr, descriptionAr, tags });

test('#514: one spelling per brand, whole words only', () => {
  assert.equal(fixArabicText('ليجاسي باي ميسون ألامبرا', '', true), 'ليجاسي من ميزون الحمراء');
  assert.equal(fixArabicText('لوكس نايت لايف من ميزون البهاما'), 'لوكس نايت لايف من ميزون الحمراء');
  assert.equal(fixArabicText('مهيب للرجال من الوطنحية'), 'مهيب للرجال من الوطنية');
  assert.equal(fixArabicText('موسوف أرد الزعفران 100 مل'), 'موسوف أرض الزعفران 100 مل');
  assert.equal(fixArabicText('كاندي بوب باي جراندور توبيز', '', true), 'كاندي بوب من غراندور توبيز');
  assert.equal(fixArabicText('حواء ريد بواسطة زامايا'), 'حواء ريد من زيمايا');
  assert.equal(fixArabicText('طقم ناين بي ام هوم'), 'طقم ناين بي إم هوم');
  assert.equal(fixArabicText('ناو روج من راف', 'RAV-1103'), 'ناو روج من ريف');
  assert.equal(fixArabicText('ريف روز من فورف لطافة', 'LAT-309'), 'ريف روز من فورف لطافة', 'Rave only for Rave products');
  assert.equal(fixArabicText('عطر باي'), 'عطر باي', '«باي» → «من» only in names');
  assert.equal(fixArabicText('غراندوري'), 'غراندوري');
  for (const [re] of BRAND_SPELLINGS) assert.ok(re.flags.includes('u') && re.flags.includes('g'));
});

test('#514: names read wrongly from English are corrected, the rest is untouched', () => {
  assert.equal(fixArabicEntry('ARM-901', entry('فيروس من أرماف')).nameAr, 'فيروتشي من أرماف');
  assert.equal(fixArabicEntry('AFN-397', entry('نايت دايف باي أفنان 100 مل')).nameAr, 'ناين إيه إم دايف من أفنان 100 مل');
  const oud = fixArabicEntry('LAT-052', entry('أمير العود 30 مل من لطافة', 'عطر أمير العود بحجم 30 مل.', ['عطر أمير العود', 'Lattafa']));
  assert.equal(oud.nameAr, 'عود مود 30 مل من لطافة');
  assert.equal(oud.descriptionAr, 'عطر عود مود بحجم 30 مل.');
  assert.deepEqual(oud.tags, ['عطر عود مود', 'Lattafa']);
  assert.equal(fixArabicEntry('LAT-095', entry('خمري ميرة', 'الأميرة')).descriptionAr, 'الأميرة', 'swaps are whole words');
  assert.equal(fixArabicEntry('ALW-548', entry('Tanzanite by Al Wataniah')).nameAr, 'تنزانيت من الوطنية نوال 100 مل ماء عطر');
  const same = entry('يارا من لطافة');
  assert.equal(fixArabicEntry('LAT-097', same), same, 'an entry with nothing to fix is returned as is');
  assert.ok(isLatinOnlyName('Selena by Al Wataniah'));
  assert.ok(!isLatinOnlyName('سيلينا 100 مل'));
});

test('#514: the published catalog is clean, and cleaning it again changes nothing', () => {
  const file = JSON.parse(readFileSync('src/data/live/store-catalog.json', 'utf8')) as StoreCatalogFile;
  const bad = /ميسون ألامبرا|مايسون|ميصون|البهاما|الوطنحية|الوطنعية|أرد الزعفران|جراندور|بجيرامي|بوجايرامي|زامايا|نايت دايف|فيروس/u;
  for (const [sku, e] of Object.entries(file.entries)) {
    assert.doesNotMatch(`${e.nameAr} ${e.descriptionAr}`, bad, sku);
    assert.ok(!isLatinOnlyName(e.nameAr), `${sku}: Arabic name in Latin letters`);
    assert.equal(fixArabicEntry(sku, e), e, `${sku} is not stable`);
  }
  for (const sku of Object.keys(NAME_FIXES)) assert.ok(file.entries[sku], `${sku} is a real product`);
});

test('#514: the products review reads what the page shows, not the supplier’s raw text', () => {
  const p = { id: 1, sku: 'LAT-1', nameAr: 'Yara by Lattafa', nameEn: 'Yara by Lattafa', descriptionAr: '', brand: 'Lattafa', ourPrice: 3000, imageUrl: 'https://x/y.jpg' } as unknown as RawProduct;
  const base = { now: Date.parse('2026-11-13'), products: [p], shipping: { zones: [] } as never, fx: { rates: {} } as never, homeCountry: 'EG', freeShippingAboveEgp: null };
  assert.equal(reviewCatalog(base).arabic.namesInLatin, 1);
  const edited = { sourceHash: productHash(p), editor: 'shaheen', updatedAt: '2026-11-13', nameAr: 'يارا من لطافة', nameEn: 'Yara by Lattafa',
    descriptionAr: 'عطر نسائي من لطافة يجمع بين الأوركيد والفانيليا بحجم 100 مل.', descriptionEn: 'A women’s perfume.', families: [], notes: { top: [], heart: [], base: [] }, seasons: [], occasions: [], tags: [] };
  const seen = reviewCatalog({ ...base, catalog: { entries: { 'LAT-1': edited } } as never });
  assert.equal(seen.arabic.namesInLatin, 0);
});
