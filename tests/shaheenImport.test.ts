import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractProduct, parseNotes, parseSitemap, parseSitemapIndex, validateShaheenReading } from '../scripts/shaheen-import/extract';
import { brandPrefix, cleanName, nextIdOf, ourPriceOf, planRun, toStoreProduct, type ImportedProduct } from '../scripts/shaheen-import/transform';
import { reviewProduct, reviewStore } from '../scripts/shaheen-import/review';
import { SOURCES } from '../scripts/shaheen-import/sources';
import { relatedTo, renderIndexPage, renderProductPage } from '../scripts/product-pages/render';
import { storePrompt, auditProduct } from '../scripts/shaheen-store/curate';
import { mergeCatalog, productSlug, type RawProduct } from '../src/utils/storeCatalog';

// A fixed copy of the structure of a real supplier product page (schema.org Product + spec table),
// never the live site.
const URL1 = 'https://www.shamperfume.com/perfumes/zimaya/zimaya-amber-is-great-edp-100ml/';
const CDN = 'https://www.shamperfume.com/cdn/large/zimaya-amber-is-great-eau-de-parfum-100ml';
const LD = {
  '@context': 'https://schema.org', '@type': 'Product', productID: 'AMBER-IS-GREAT-100ML', sku: 'AMBER-IS-GREAT-100ML',
  name: 'Zimaya Amber Is Great Eau De Parfum 100ml',
  description: 'Zimaya Amber Is Great Eau De Parfum 100ml\n\nThe fragrance opens with saffron and jasmine before a heart of amberwood and ambergris.\nPerforms well in Malaysia\'s warm climate.\n\nFragrance Notes:\nTop: Saffron, Jasmine\nMiddle: Amberwood, Ambergris\nBase: Fir Resin, Cedar',
  image: [1, 2, 3, 4, 5].map((n) => `${CDN}-${n}.jpg`), category: 'Perfume',
  additionalProperty: [{ '@type': 'PropertyValue', name: 'Fragrance Family', value: 'Oriental Amber' }],
  brand: { '@type': 'Brand', name: 'Zimaya' }, gtin13: '6290171070283', size: '100ml', audience: { '@type': 'PeopleAudience', suggestedGender: 'unisex' },
  offers: { '@type': 'Offer', url: URL1, priceCurrency: 'MYR', price: 121, availability: 'https://schema.org/InStock',
    priceSpecification: { '@type': 'UnitPriceSpecification', price: 179, priceCurrency: 'MYR', priceType: 'https://schema.org/StrikethroughPrice' } },
};
const page = (ld: unknown = LD) => `<!doctype html><html lang="en-MY"><head><title>Zimaya Amber Is Great | Sham perfume</title>
<meta property="og:image" content="https://www.shamperfume.com/cdn/OGImage/zimaya-1.jpg">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Sham perfume"}</script>
<script type="application/ld+json">${JSON.stringify(ld)}</script></head><body>
<h1>Zimaya Amber Is Great Eau De Parfum 100ml</h1><span>SKU: AMBER-IS-GREAT-100ML</span> <s>RM 179.00</s> <b>RM 121.00</b>
<div>Concentration</div><div>Eau de Parfum</div><div>Family</div><div>Oriental Amber</div><div>Size</div><div>100ml</div><div>Quantity</div>
<div>Fragrance Family Oriental Amber Launch Year 2023 Seasons Spring Fall Winter Best For Office Evening Special Event Daily Wear Longevity Lasting (6-8 hours) Weak Moderate Strong Very Strong Tags x</div>
<img src="${CDN}-1.jpg"><img src="${CDN}-2.jpg"></body></html>`;

test('the sitemap gives every product URL with its photos, without other languages or listings', () => {
  const xml = `<?xml version="1.0"?><urlset>
  <url><loc>${URL1}</loc><lastmod>2026-10-16</lastmod><image:image><image:loc>${CDN}-1.jpg</image:loc></image:image><image:image><image:loc>${CDN}-2.jpg</image:loc></image:image></url>
  <url><loc>https://www.shamperfume.com/ms/perfumes/zimaya/zimaya-amber-is-great-edp-100ml/</loc></url>
  <url><loc>https://www.shamperfume.com/perfumes/new-arrivals/</loc></url>
  <url><loc>${URL1}</loc></url></urlset>`;
  const s = SOURCES[0];
  const entries = parseSitemap(xml, { include: s.productUrl, exclude: s.excludeUrl });
  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0].images, [`${CDN}-1.jpg`, `${CDN}-2.jpg`]);
  assert.deepEqual(parseSitemapIndex('<sitemapindex><sitemap><loc>https://x.example/sitemap-perfumes-1.xml</loc></sitemap></sitemapindex>'), ['https://x.example/sitemap-perfumes-1.xml']);
  assert.deepEqual(parseSitemapIndex(xml), []);
});

test('a product page is read completely from its structured data and spec table', () => {
  const x = extractProduct(page(), URL1)!;
  assert.ok(x);
  assert.equal(x.name, 'Zimaya Amber Is Great Eau De Parfum 100ml');
  assert.equal(x.supplierSku, 'AMBER-IS-GREAT-100ML');
  assert.equal(x.brand, 'Zimaya');
  assert.equal(x.price, 121);
  assert.equal(x.regularPrice, 179);
  assert.equal(x.currency, 'MYR');
  assert.equal(x.inStock, true);
  assert.equal(x.gender, 'unisex');
  assert.equal(x.sizeMl, 100);
  assert.equal(x.concentration, 'Eau de Parfum');
  assert.equal(x.images.length, 6);
  assert.match(x.images.at(-1)!, /OGImage/, 'the cropped share image is the last resort');
  assert.deepEqual(x.notes, { top: ['Saffron', 'Jasmine'], heart: ['Amberwood', 'Ambergris'], base: ['Fir Resin', 'Cedar'] });
  assert.deepEqual(x.families, ['Oriental Amber']);
  assert.deepEqual(x.seasons, ['Spring', 'Fall', 'Winter']);
  assert.ok(x.occasions.includes('Office') && x.occasions.includes('Evening'));
  assert.equal(x.longevity, 'Lasting (6-8 hours)');
  assert.equal(x.barcode, '6290171070283');
  assert.equal(extractProduct('<html><body>no data</body></html>', URL1), null, 'no structured data → null, never a placeholder');
  assert.equal(extractProduct(page({ ...LD, offers: { priceCurrency: 'MYR' } }), URL1), null, 'no price → not imported');
  assert.equal(extractProduct(page({ ...LD, offers: { ...LD.offers, availability: 'https://schema.org/OutOfStock' } }), URL1)!.inStock, false);
});

test('notes are parsed from the usual «Top / Middle / Base» layouts', () => {
  assert.deepEqual(parseNotes('Top notes: Apple, Bergamot and Lemon. Heart notes: Rose • Jasmine. Base notes: Musk'), { top: ['Apple', 'Bergamot', 'Lemon'], heart: ['Rose', 'Jasmine'], base: ['Musk'] });
  assert.deepEqual(parseNotes('A lovely scent.'), { top: [], heart: [], base: [] });
});

test("Shaheen's reading of a page without structured data is accepted only when it matches the page", () => {
  const html = `<html><body><h1>Oud Royal 50ml</h1><p>Price RM 89.00</p><img src="https://cdn.example/oud-1.jpg"></body></html>`;
  const good = validateShaheenReading({ name: 'Oud Royal 50ml', price: 89, images: ['https://cdn.example/oud-1.jpg'], description: 'Rich oud.' }, html, 'https://s.example/p/oud', 'MYR');
  assert.equal(good?.via, 'shaheen');
  assert.equal(good?.sizeMl, 50);
  assert.equal(validateShaheenReading({ name: 'Oud Royal', price: 99, images: ['https://cdn.example/oud-1.jpg'] }, html, 'https://s.example/p/oud', 'MYR'), null, 'a price not on the page is invented');
  assert.equal(validateShaheenReading({ name: 'Oud Royal', price: 89, images: ['https://other.example/fake.jpg'] }, html, 'https://s.example/p/oud', 'MYR'), null, 'a photo not on the page is invented');
  assert.equal(validateShaheenReading({}, html, 'https://s.example/p/oud', 'MYR'), null);
});

test("the store product follows the scenario: regular price → EGP → × 1.5, BRAND-NNN SKU, real URL and every photo", () => {
  const x = extractProduct(page(), URL1)!;
  const now = '2026-10-16T00:00:00.000Z';
  const p = toStoreProduct(x, { source: SOURCES[0], rate: 11.5, now, nextId: 52 });
  assert.equal(p.supplierPriceOriginal, 179, 'a time-limited sale is never the base price');
  assert.equal(p.supplierSalePrice, 121);
  assert.equal(p.supplierPrice, 2058.5);
  assert.equal(p.ourPrice, 3090);
  assert.equal(p.ourPrice, ourPriceOf(2058.5));
  assert.equal(p.sku, 'ZIM-052');
  assert.equal(p.id, 52);
  assert.equal(p.category, 'مختلط');
  assert.equal(p.url, URL1);
  assert.equal(p.images.length, 6);
  assert.equal(p.imageUrl, `${CDN}-1.jpg`);
  assert.equal(p.supplierId, 'shamperfume');
  assert.equal(p.slug, 'zimaya-amber-is-great-eau-de-parfum-100ml-52');
  assert.doesNotMatch(p.descriptionEn || '', /Malaysia/, "the supplier's local marketing is removed");
  assert.match(p.descriptionEn || '', /Top: Saffron/);
  // A refresh keeps identity, Shaheen's Arabic name and the creation date; price and stock follow the supplier.
  const later = toStoreProduct({ ...x, regularPrice: undefined, price: 150, inStock: false }, { source: SOURCES[0], rate: 12, now: '2026-10-17T00:00:00.000Z', nextId: 99, existing: { ...p, nameAr: 'زيمايا أمبر إز جريت' } });
  assert.equal(later.id, 52);
  assert.equal(later.sku, 'ZIM-052');
  assert.equal(later.nameAr, 'زيمايا أمبر إز جريت');
  assert.equal(later.createdAt, now);
  assert.equal(later.stockStatus, 'out_of_stock');
  assert.equal(later.ourPrice, ourPriceOf(1800));
  assert.equal(brandPrefix('Kenz de Rasasi'), 'KEN');
  assert.equal(toStoreProduct({ ...x, brand: 'RASASI' }, { source: SOURCES[0], rate: 11.5, now, nextId: 60 }).brand, 'Rasasi');
  assert.equal(toStoreProduct({ ...x, brand: 'Kenz de Rasasi' }, { source: SOURCES[0], rate: 11.5, now, nextId: 60 }).brand, 'Kenz de Rasasi');
  assert.equal(brandPrefix(''), 'IMP');
  assert.equal(cleanName('Khamrah Mira by Lattafa Malaysia'), 'Khamrah Mira by Lattafa');
  assert.equal(nextIdOf([{ id: 3 }, { id: '51' }, { id: 'x' }] as RawProduct[]), 52);
});

test('each run imports new products first and refreshes the oldest; products that left the supplier are flagged', () => {
  const imported = [
    { url: 'https://s.example/a/', refreshedAt: '2026-10-10T00:00:00Z' },
    { url: 'https://s.example/b/', refreshedAt: '2026-10-01T00:00:00Z' },
    { url: 'https://s.example/gone/', refreshedAt: '2026-10-01T00:00:00Z' },
  ] as ImportedProduct[];
  const urls = ['a', 'b', 'c', 'd', 'e'].map((x) => ({ url: `https://s.example/${x}/` }));
  const plan = planRun(urls, imported, 2, 1);
  assert.deepEqual(plan.fresh.map((u) => u.url), ['https://s.example/c/', 'https://s.example/d/']);
  assert.deepEqual(plan.refresh.map((u) => u.url), ['https://s.example/b/']);
  assert.deepEqual(plan.gone.map((p) => p.url), ['https://s.example/gone/']);
});

const imported = () => toStoreProduct(extractProduct(page(), URL1)!, { source: SOURCES[0], rate: 11.5, now: '2026-10-16T00:00:00.000Z', nextId: 52 });
const merchant: RawProduct = { id: 19, sku: 'GEN-019', nameAr: 'عطر', nameEn: 'Scraped Perfume', descriptionAr: 'جودة عالية وسعر مميز', supplierName: 'Scraped', imageUrl: 'https://images.unsplash.com/photo-1', ourPrice: 120, supplierPrice: 80, stockStatus: 'in_stock' };

test('«مراجع الصفحات» checks price formula, photos, names and flags the old fake fallback products', () => {
  assert.deepEqual(reviewProduct(imported()).critical, []);
  const wrong = reviewProduct({ ...imported(), ourPrice: 100 });
  assert.ok(wrong.critical.some((c) => c.includes('المعادلة')));
  const old = reviewProduct(merchant);
  assert.deepEqual(old.critical, []);
  assert.ok(old.warnings.some((w) => w.includes('احتياطي')));
  assert.ok(old.warnings.some((w) => w.includes('بنك صور')));
  assert.ok(old.warnings.some((w) => w.includes('مصدر حقيقي')));
});

test('a broken photo hides an imported product (never a merchant product) and the report lists it', async () => {
  const p = imported();
  const fetchMock = (async (url: string) => new Response('<html>', { status: String(url).includes('-1.jpg') ? 404 : 200, headers: { 'content-type': 'text/html' } })) as unknown as typeof fetch;
  const { products, report } = await reviewStore([merchant, p], { request: fetchMock, now: '2026-10-16T00:00:00.000Z' });
  const hidden = products[1] as ImportedProduct;
  assert.equal(hidden.published, false);
  assert.ok(hidden.reviewIssues?.some((i) => i.includes('الصورة لا تفتح')));
  assert.equal(products[0], merchant, "the merchant's own products are reported, never changed");
  assert.equal(report.summary.hidden, 1);
  assert.equal(report.summary.imported, 1);
  assert.equal(report.summary.imagesChecked, 1, 'stock photos are not downloaded');
  assert.equal(report.items.find((i) => i.sku === 'ZIM-052')?.page, 'p/zimaya-amber-is-great-eau-de-parfum-100ml-52.html');
  // The store never shows a hidden product.
  assert.deepEqual(mergeCatalog(products).map((x) => x.sku), ['GEN-019']);
  const okFetch = (async () => new Response('x', { status: 206, headers: { 'content-type': 'image/jpeg' } })) as unknown as typeof fetch;
  const fixed = await reviewStore([merchant, hidden], { request: okFetch });
  assert.equal((fixed.products[1] as ImportedProduct).published, undefined, 'fixed next run → visible again');
});

test('the store shows the imported photos, notes, size and own page; Shaheen gets the supplier notes', () => {
  const [s] = mergeCatalog([imported()]);
  assert.equal(s.images.length, 6);
  assert.deepEqual(s.notes.top, ['Saffron', 'Jasmine']);
  assert.ok(s.families.includes('amber') && s.families.includes('oriental'));
  assert.ok(s.seasons.includes('winter') && s.seasons.includes('autumn'));
  assert.ok(s.occasions.includes('work') && s.occasions.includes('evening'));
  assert.equal(s.gender, 'unisex');
  assert.equal(s.sizeMl, 100);
  assert.equal(s.slug, 'zimaya-amber-is-great-eau-de-parfum-100ml-52');
  assert.equal(productSlug({ id: 7, nameEn: 'Dior Sauvage' }), 'dior-sauvage-7');
  assert.match(storePrompt([imported()]), /supplierNotes/);
  assert.doesNotMatch(storePrompt([merchant]), /supplierNotes/);
  assert.ok(!auditProduct(imported()).includes('الوصف عام ولا يصف الرائحة'), 'Shaheen writes the Arabic text of imports');
});

test('every product gets a standalone page with share preview, schema.org price in EGP and a way back to the cart', () => {
  const list = mergeCatalog([imported(), { ...merchant, id: 20, sku: 'SHM-020', nameEn: 'Amber <Night>', supplierName: 'Shama Perfumes', category: 'مختلط' }]);
  const html = renderProductPage(list[0], relatedTo(list[0], list), { siteUrl: 'https://spculculat-oss.github.io/Sham-Perfume/' });
  assert.match(html, /<link rel="canonical" href="https:\/\/spculculat-oss\.github\.io\/Sham-Perfume\/p\/zimaya-amber-is-great-eau-de-parfum-100ml-52\.html">/);
  assert.match(html, /"priceCurrency":"EGP","price":3090/);
  assert.match(html, /og:image" content="https:\/\/www\.shamperfume\.com\/cdn\/large\//);
  assert.match(html, /href="\.\.\/#product=52"/);
  assert.match(html, /الهرم العطري/);
  assert.doesNotMatch(html, /shamperfume\.com\/perfumes|Sham perfume|MYR|supplier/i, 'visitors never see the supplier or its price');
  const other = renderProductPage(list[1], [], { siteUrl: 'https://x.example/' });
  assert.match(other, /Amber &lt;Night&gt;/);
  assert.doesNotMatch(other, /<Night>/);
  assert.match(renderIndexPage(list, { siteUrl: 'https://x.example/' }), /href="zimaya-amber-is-great-eau-de-parfum-100ml-52\.html"/);
});

test("the supervisor's importer probe reads the reviewer's report", async () => {
  const { mkdtempSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { pathToFileURL } = await import('node:url');
  const { PROBES } = await import('../scripts/shaheen-supervisor/probes');
  const dir = mkdtempSync(join(tmpdir(), 'import-probe-'));
  const now = new Date('2026-10-16T06:00:00Z');
  const ctx = { site: 'https://site.example', run: 0, now: now.getTime(), liveDir: pathToFileURL(`${dir}/`), fetch: fetch };
  const [missing] = await PROBES.store_import(ctx);
  assert.equal(missing.ok, false);
  const { report } = await reviewStore([merchant, imported()], { request: (async () => new Response('x', { headers: { 'content-type': 'image/jpeg' } })) as unknown as typeof fetch, now: now.toISOString(),
    importInfo: { sources: [{ id: 'shamperfume', added: 1, refreshed: 0, failedCount: 0, sitemapProducts: 1000 }] } });
  writeFileSync(join(dir, 'store-review.json'), JSON.stringify(report));
  const [probe] = await PROBES.store_import(ctx);
  assert.equal(probe.ok, true);
  assert.match(probe.answer, /\+1 جديد/);
  assert.ok(!probe.findings.some((f) => f.severe));
});

test("an imported product's notes come from the supplier, or from its own description through Shaheen — never invented", async () => {
  const { notesFor } = await import('../scripts/shaheen-store/curate');
  const empty = { top: [], heart: [], base: [] };
  const supplier = { top: ['Saffron'], heart: [], base: ['Cedar'] };
  const prose = { ...imported(), notes: undefined, descriptionEn: 'Bergamot and mandarin open it; a mint and ginger heart; sandalwood and musk in the drydown.' } as RawProduct;
  assert.deepEqual(notesFor(prose, supplier, { top: ['Lemon'], heart: [], base: [] }), supplier);
  assert.deepEqual(notesFor(prose, empty, { top: ['Bergamot', 'Mandarin', 'Vanilla'], heart: ['Mint', 'Ginger'], base: ['Sandalwood', 'Oud'] }),
    { top: ['Bergamot', 'Mandarin'], heart: ['Mint', 'Ginger'], base: ['Sandalwood'] });
  assert.deepEqual(notesFor(merchant, empty, { top: ['Lemon'], heart: [], base: [] }).top, ['Lemon'], 'famous perfumes of the merchant: the old rule');
});

test('AI packages: a used-up quota pauses the engine until it renews, and the job continues after the renewal', async () => {
  const { makeAsk, pauseUntil, quotaBook, QuotaExhaustedError } = await import('../scripts/doctor/agent');
  const { mkdtempSync, readFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { pathToFileURL } = await import('node:url');
  const now = Date.parse('2026-10-16T06:00:00Z');
  assert.equal(pauseUntil(429, 'rate_limited', 'RESOURCE_EXHAUSTED · GenerateRequestsPerDayPerProjectPerModel-FreeTier limit 20 · retry in 64535s', now), now + 64565_000);
  assert.equal(new Date(pauseUntil(429, 'rate_limited', 'GenerateRequestsPerDayPerProjectPerModel-FreeTier limit 20', now)!).toISOString(), '2026-10-16T08:05:00.000Z');
  assert.equal(new Date(pauseUntil(402, 'no_credit', '', Date.parse('2026-10-16T09:00:00Z'))!).toISOString(), '2026-10-17T08:05:00.000Z');
  assert.equal(pauseUntil(429, 'rate_limited', 'PerMinute', now), now + 65_000);
  assert.equal(pauseUntil(400, 'bad_request', '', now), undefined, 'other errors never pause an engine');

  const file = pathToFileURL(join(mkdtempSync(join(tmpdir(), 'quota-')), 'ai-quota.json'));
  let calls = 0;
  let exhausted = true;
  const request = (async (url: string) => {
    if (String(url).includes('/models?')) return new Response(JSON.stringify({ models: [] }), { status: 200 });
    calls++;
    return exhausted
      ? new Response(JSON.stringify({ error: { status: 'RESOURCE_EXHAUSTED', details: [{ violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier', quotaValue: '20' }] }, { retryDelay: '64535s' }] } }), { status: 429 })
      : new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }), { status: 200 });
  }) as unknown as typeof fetch;
  const env = { GEMINI_API_KEY: 'test-key' };
  const quota = quotaBook(file);
  const ask = (await makeAsk(env, { quota, request }))!;
  await assert.rejects(ask('s', 'p'), (e: unknown) => e instanceof QuotaExhaustedError && e.resumeAt > Date.now() + 60_000);
  quota.save();
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).engines.gemini.reason, 'rate_limited');
  // The next run reads the pause and spends no request until the renewal.
  const before = calls;
  const nextRun = (await makeAsk(env, { quota: quotaBook(file), request }))!;
  await assert.rejects(nextRun('s', 'p'), QuotaExhaustedError);
  assert.equal(calls, before);
  // After the renewal it continues.
  exhausted = false;
  const renewed = quotaBook(file, () => Date.now() + 70_000_000);
  const later = (await makeAsk(env, { quota: renewed, request }))!;
  assert.equal(await later('s', 'p'), '{"ok":true}');
  assert.deepEqual(renewed.file().engines, {});
});
