/** «فحص السيو لكل صفحة» (#182): every built page is judged, not a 4-page sample. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { auditBuiltPages, pageKind } from '../scripts/seo-check-all.mts';
import { productSeoTitle, renderIndexPage } from '../scripts/product-pages/render';
import { mergeCatalog, type RawProduct } from '../src/utils/storeCatalog';

const page = (title: string, description: string, canonical: string) => `<!doctype html><html lang="ar"><head><title>${title}</title>
<meta name="description" content="${description}"><link rel="canonical" href="${canonical}"></head><body><h1>${title}</h1><p>${'نص '.repeat(200)}</p></body></html>`;

test('page kinds follow the built layout', () => {
  assert.equal(pageKind('index.html'), 'home');
  assert.equal(pageKind('p/index.html'), 'product-index');
  assert.equal(pageKind('p/oud-1.html'), 'product');
  assert.equal(pageKind('tools/alcohol-dilution-calculator.html'), 'tool');
});

test('duplicates are found across ALL pages, not only the sampled ones', () => {
  const site = 'https://shop.example/';
  const desc = 'وصف طويل بما يكفي لصفحة منتج في متجر العطور يشرح المنتج والحجم والتركيز للزائر بوضوح.';
  const pages = Array.from({ length: 40 }, (_, i) => ({ path: `p/item-${i}.html`, html: page(`عطر رقم ${i}`, `${desc} ${i}`, `${site}p/item-${i}.html`) }));
  pages.push({ path: 'p/item-twin.html', html: page('عطر رقم 7', `${desc} twin`, `${site}p/item-twin.html`) });
  const result = auditBuiltPages(pages, site);
  assert.equal(result.pages, 41);
  const dup = result.findings.filter((f) => f.id.endsWith(':duplicatedTitle'));
  assert.equal(dup.length, 1);
  assert.match(dup[0]!.detail, /item-7\.html.*item-twin\.html/);
});

test('size variants of one perfume get different titles, and the product index is a full page', () => {
  const base: RawProduct = { id: 1, sku: 'ARM-1', nameAr: 'كلوب دي نوي سيلاج', nameEn: 'Club de Nuit Sillage', brand: 'Armaf', category: 'رجالي', ourPrice: 900, supplierPrice: 600, imageUrl: 'https://images.example/1.jpg', sizeMl: 105 };
  const [big, pen] = mergeCatalog([base, { ...base, id: 2, sku: 'ARM-2', sizeMl: 10 }]);
  assert.notEqual(productSeoTitle(big!), productSeoTitle(pen!));
  assert.match(productSeoTitle(big!), /105 مل/);
  const html = renderIndexPage([big!, pen!], { siteUrl: 'https://shop.example/' });
  const result = auditBuiltPages([{ path: 'p/index.html', html }], 'https://shop.example/');
  assert.deepEqual(result.findings.filter((f) => f.severity !== 'minor').map((f) => f.title), []);
  assert.match(html, /"@type":"CollectionPage"/);
});

test('every Pages build runs the full check', () => {
  const workflow = readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
  assert.match(workflow, /run: bun run check:seo/);
});
