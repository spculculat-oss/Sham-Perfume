/**
 * Task #133 («مجلس شاهين»): product data cleanup — notes the supplier wrote in prose are read without AI
 * (literal words only), and the merchant's hidden demo products leave the store and the reviewer's warnings.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { proseNotes } from '../scripts/shaheen-import/proseNotes';
import { parseNotes } from '../scripts/shaheen-import/extract';
import { reviewStore } from '../scripts/shaheen-import/review';
import { mergeCatalog, type RawProduct } from '../src/utils/storeCatalog';

const ICE = 'Hawas Ice opens with crisp green apple, Italian bergamot and bright lemon, accented by aromatic star anise. Orange blossom joins marine notes, plum and cardamom in the heart, giving the scent both watery freshness and a subtle fruity-spicy dimension. Moss, driftwood, amber and musk define the base, replacing the Hawas\'s warmer patchouli direction with a cooler, mossy impression.';

test('notes written in prose are read into the right layer, from the supplier\'s own words', () => {
  const n = proseNotes(ICE);
  assert.deepEqual(n.top, ['Green Apple', 'Bergamot', 'Lemon', 'Star Anise']);
  assert.deepEqual(n.heart, ['Orange Blossom', 'Marine Notes', 'Plum', 'Cardamom']);
  assert.deepEqual(n.base, ['Moss', 'Driftwood', 'Amber', 'Musk']);
  assert.ok(![...n.top, ...n.heart, ...n.base].includes('Patchouli'), 'a note named only in a comparison is not this perfume\'s');
  for (const note of [...n.top, ...n.heart, ...n.base]) assert.ok(ICE.toLowerCase().includes(note.toLowerCase()), `${note} appears in the text`);
});

test('uncertain text gives no pyramid (an empty one is better than a wrong one)', () => {
  // No layer words at all.
  assert.deepEqual(proseNotes('Lime, rosemary and green apple give Verde its lively character. Patchouli adds earthiness.'), { top: [], heart: [], base: [] });
  // Fewer than 3 notes or a single layer.
  assert.deepEqual(proseNotes('It opens with bergamot.'), { top: [], heart: [], base: [] });
  assert.deepEqual(proseNotes('It opens with bergamot, lemon and mint.'), { top: [], heart: [], base: [] });
  assert.deepEqual(proseNotes(''), { top: [], heart: [], base: [] });
});

test('labelled notes still win; prose is the fallback of the importer\'s note reader', () => {
  assert.deepEqual(parseNotes('Top notes: Apple, Bergamot and Lemon. Heart notes: Rose • Jasmine. Base notes: Musk'), { top: ['Apple', 'Bergamot', 'Lemon'], heart: ['Rose', 'Jasmine'], base: ['Musk'] });
  assert.deepEqual(parseNotes(ICE).base, ['Moss', 'Driftwood', 'Amber', 'Musk']);
});

const demo = { id: 9, sku: 'ALR-003', nameEn: 'Al-Rehab Dubai', nameAr: 'الرحاب دبي', ourPrice: 15, supplierPrice: 10, imageUrl: 'https://images.unsplash.com/photo-1', stockStatus: 'in_stock', category: 'عود' } as unknown as RawProduct;

test('a demo product the merchant hid leaves the store and is reported as hidden, not as a warning', async () => {
  const hidden = { ...demo, published: false } as RawProduct;
  assert.equal(mergeCatalog([hidden]).length, 0);
  const { products, report } = await reviewStore([hidden, demo], { imageBudget: 0 });
  assert.deepEqual(report.items.map((i) => i.status), ['hidden', 'warn']);
  assert.equal(report.summary.hidden, 1);
  assert.equal((products[0] as { published?: boolean }).published, false, 'the merchant\'s choice is kept');
  assert.equal((products[1] as { published?: boolean }).published, undefined, 'his other products are never hidden automatically');
});

test('the store no longer offers the old demo products with impossible prices or stock photos', () => {
  const raw = (JSON.parse(readFileSync(new URL('../src/data/products.json', import.meta.url), 'utf8')) as { products: RawProduct[] }).products;
  const visible = mergeCatalog(raw);
  assert.ok(visible.length > 1000);
  assert.ok(visible.every((p) => !/images\.unsplash\.com/.test(p.imageUrl || '')), 'no stock photos in the store');
  assert.ok(visible.every((p) => p.price >= 30), 'no impossible prices');
});
