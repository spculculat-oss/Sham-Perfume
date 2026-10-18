import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractGeneric, parsePrice, productTitle } from '../scripts/shaheen-import/generic';
import { adoptSkill, emptySkills, learnSkill, readWithSkill, recordUse, skillsSummary } from '../scripts/shaheen-import/skills';
import { addAltOffer, perfumeKey, type ImportedProduct } from '../scripts/shaheen-import/transform';
import {
  addCandidates, brandSiteGuesses, domainOf, domainsFromSearch, emptySources, inferProductPattern, isNeverSource, isPerfume,
  CATEGORYISH, judgeSamples, sameSite, pageLinks, parseRobots, planQueries, productCandidates, withPage, spreadSample, toImportSource, vettingQueue, type LiveSource, type Sample,
} from '../scripts/shaheen-discover/discover';
import { buildBank, CURRICULUM, exam, importerShare, parseStudy, pickStudy, selfLesson, type TrainingDoc } from '../scripts/shaheen-school/school';
import { emptyMemory, remember } from '../src/utils/shaheenMemory';

// Fixed copies of common store page structures (never a live site).
const OG_PAGE = `<!doctype html><html><head><title>Khamrah Eau de Parfum 100ml | Oud House</title>
<meta property="og:type" content="product"><meta property="og:site_name" content="Oud House">
<meta property="og:title" content="Lattafa Khamrah Eau de Parfum 100ml">
<meta property="og:image" content="https://oudhouse.example/img/khamrah-1.jpg">
<meta property="og:description" content="A warm gourmand perfume with cinnamon, dates and praline over vanilla and amber.">
<meta property="product:price:amount" content="1,250.00"><meta property="product:price:currency" content="AED">
<meta property="product:brand" content="Lattafa"><meta property="product:availability" content="in stock">
</head><body><h1 class="product-title">Lattafa Khamrah Eau de Parfum 100ml</h1>
<img class="main-photo" src="/img/khamrah-1.jpg"><span class="price">AED 1,250.00</span></body></html>`;

const WOO_PAGE = `<html><head><meta property="og:image" content="https://shop.example/wp/oud-1.jpg"><title>Oud Royal 50ml – Shop</title></head>
<body class="product-template-default single-product"><h1 class="product_title">Royal Oud Attar 50ml</h1>
<p class="price"><del><span class="woocommerce-Price-amount amount"><bdi>500.00&nbsp;<span class="woocommerce-Price-currencySymbol">ج.م</span></bdi></span></del>
<ins><span class="woocommerce-Price-amount amount"><bdi>420.00&nbsp;<span class="woocommerce-Price-currencySymbol">ج.م</span></bdi></span></ins></p>
<img class="wp-post-image" src="https://shop.example/wp/oud-1.jpg"></body></html>`;

test('generic reader: prices in every common format', () => {
  assert.equal(parsePrice('1,250.00'), 1250);
  assert.equal(parsePrice('1.250,50'), 1250.5);
  assert.equal(parsePrice('SAR 99'), 99);
  assert.equal(parsePrice('٩٩٫٥٠ ر.س'), 99.5);
  assert.equal(parsePrice('1 234'), 1234);
  assert.equal(parsePrice('free'), undefined);
  assert.equal(parsePrice(0), undefined);
  assert.equal(productTitle('Oud House | Lattafa Khamrah 100ml'), 'Lattafa Khamrah 100ml');
});

test('generic reader: OpenGraph product page and WooCommerce sale price, without JSON-LD or AI', () => {
  const og = extractGeneric(OG_PAGE, 'https://oudhouse.example/products/khamrah', 'USD');
  assert.ok(og);
  assert.equal(og.price, 1250);
  assert.equal(og.currency, 'AED');
  assert.equal(og.brand, 'Lattafa');
  assert.equal(og.sizeMl, 100);
  assert.equal(og.via, 'generic');
  assert.deepEqual(og.images, ['https://oudhouse.example/img/khamrah-1.jpg']);
  const woo = extractGeneric(WOO_PAGE, 'https://shop.example/product/royal-oud', 'EGP');
  assert.ok(woo);
  assert.equal(woo.price, 420, 'the sale price, not the struck-through one');
  assert.equal(woo.currency, 'EGP');
  assert.equal(woo.name, 'Royal Oud Attar 50ml');
  // Not a product page (no product signal) → nothing is guessed.
  assert.equal(extractGeneric('<html><head><title>Blog</title></head><body><h1>News</h1></body></html>', 'https://x.example/blog', 'USD'), null);
});

test('skills: Shaheen learns where a store puts its data, then reads its other pages without AI', () => {
  const page = (name: string, price: string, img: string) => `<html><head><title>${name}</title></head><body>
<div class="crumbs">Home</div><h2 class="item-name">${name}</h2><div class="item-cost">${price} SAR</div>
<img class="hero-shot" src="https://store.example/i/${img}.jpg"><p class="blurb">Notes of rose and oud.</p></body></html>`;
  const html1 = page('Amber Oud Gold Edition 75ml', '320.00', 'a1');
  const reading = { url: 'https://store.example/item/amber-oud', supplierSku: 'amber-oud', name: 'Amber Oud Gold Edition 75ml', description: '', images: ['https://store.example/i/a1.jpg'], price: 320, currency: 'SAR', inStock: true, families: [], notes: { top: [], heart: [], base: [] }, seasons: [], occasions: [], via: 'shaheen' as const };
  const skill = learnSkill(html1, reading as never, '2026-10-18T00:00:00.000Z');
  assert.ok(skill, 'a skill is learned from a checked reading');
  assert.equal(skill.host, 'store.example');
  const html2 = page('Rose Musk Intense 100ml', '275.50', 'b7');
  const read = readWithSkill(html2, 'https://store.example/item/rose-musk', skill, 'SAR');
  assert.ok(read);
  assert.equal(read.name, 'Rose Musk Intense 100ml');
  assert.equal(read.price, 275.5);
  assert.deepEqual(read.images, ['https://store.example/i/b7.jpg']);
  assert.equal(read.via, 'skill');
  // A page where the recipe finds nothing gives null (no guessing).
  assert.equal(readWithSkill('<html><body><h1>Other layout</h1></body></html>', 'https://store.example/item/x', skill, 'SAR'), null);
  // Trusted after 3 good readings; retired when it keeps failing.
  for (let i = 0; i < 3; i++) recordUse(skill, true);
  assert.equal(skill.status, 'trusted');
  const file = emptySkills();
  assert.equal(adoptSkill(file, skill), true);
  assert.deepEqual(skillsSummary(file), { sites: 1, trusted: 1, trial: 0, retired: 0, readings: 3 });
  const weak = { ...skill, status: 'trial' as const, successes: 0, failures: 0 };
  for (let i = 0; i < 3; i++) recordUse(weak, false);
  assert.equal(weak.status, 'retired');
});

test('one perfume from two stores: one product, the other store kept as an offer (cheapest first)', () => {
  assert.equal(perfumeKey('Lattafa', 'Lattafa Khamrah Eau de Parfum 100ml', 100), perfumeKey('LATTAFA', 'Khamrah EDP by Lattafa', 100));
  assert.notEqual(perfumeKey('Lattafa', 'Khamrah 100ml', 100), perfumeKey('Lattafa', 'Khamrah 100ml', 50));
  assert.equal(perfumeKey(undefined, 'Khamrah', 100), '', 'no brand → never merged');
  assert.equal(perfumeKey('Lattafa', 'Khamrah', undefined), '', 'no size → never merged');
  const p = { id: 1 } as unknown as ImportedProduct;
  addAltOffer(p, { supplierId: 'a', url: 'https://a/1', priceEgp: 900, inStock: true, at: 't' });
  addAltOffer(p, { supplierId: 'b', url: 'https://b/1', priceEgp: 700, inStock: true, at: 't' });
  addAltOffer(p, { supplierId: 'a', url: 'https://a/1', priceEgp: 650, inStock: false, at: 't2' });
  assert.deepEqual(p.altOffers!.map((o) => [o.supplierId, o.priceEgp]), [['b', 700], ['a', 650]], 'one offer per store; in-stock first');
});

test('source scout: domains, never-sources, robots.txt', () => {
  assert.equal(domainOf('https://www.Oud-House.ae/products/x'), 'oud-house.ae');
  assert.equal(domainOf('192.168.1.1'), '');
  assert.equal(domainOf('not a domain'), '');
  assert.ok(isNeverSource('amazon.ae'));
  assert.ok(isNeverSource('m.facebook.com'));
  assert.ok(isNeverSource('fragrantica.com'));
  assert.ok(isNeverSource('shop.blocked.com', ['blocked.com']));
  assert.ok(!isNeverSource('oudhouse.ae'));
  const r = parseRobots(`User-agent: *\nDisallow: /checkout\nDisallow: /search*\nAllow: /search/perfume\nCrawl-delay: 2\nSitemap: https://s.example/sitemap.xml\n\nUser-agent: BadBot\nDisallow: /`);
  assert.equal(r.allowed('/products/x'), true);
  assert.equal(r.allowed('/checkout/cart'), false);
  assert.equal(r.allowed('/search?q=oud'), false);
  assert.equal(r.allowed('/search/perfume'), true, 'longer Allow wins');
  assert.equal(r.crawlDelayMs, 2000);
  assert.deepEqual(r.sitemaps, ['https://s.example/sitemap.xml']);
  assert.equal(parseRobots('User-agent: ShaheenImporter\nDisallow: /\n\nUser-agent: *\nAllow: /').allowed('/a'), false, 'our own group wins');
});

test('source scout: perfume-only, product pattern, sample verdicts', () => {
  assert.ok(isPerfume({ name: 'Khamrah Eau de Parfum 100ml', description: '', url: 'u' }));
  assert.ok(isPerfume({ name: 'دهن عود ملكي', description: '', url: 'u' }));
  assert.ok(!isPerfume({ name: 'Matte Lipstick Red', description: 'with a light rose scent', url: 'u' }));
  assert.ok(!isPerfume({ name: 'Leather wallet', description: 'brown', url: 'https://x/wallet' }));
  const pattern = inferProductPattern(['https://www.s.example/products/a-100ml', 'https://s.example/products/b', 'https://s.example/products/c']);
  assert.ok(pattern);
  assert.ok(new RegExp(pattern).test('https://s.example/products/new-one'));
  assert.ok(!new RegExp(pattern).test('https://s.example/blog/post'));
  // Salla-style links: the product shape is learned from the last part («…/p123456»), categories («…/c123») excluded.
  const salla = inferProductPattern(['https://oud.example/ar/oud-royal/p1234567', 'https://oud.example/ar/musk-tahara/p7654321']);
  assert.ok(salla && new RegExp(salla).test('https://oud.example/ar/amber-night/p9999999'));
  assert.ok(salla && !new RegExp(salla).test('https://oud.example/ar/perfumes/c123456'));
  const one = inferProductPattern(['https://oud.example/ar/oud-royal-intense/p1234567']);
  assert.ok(one && new RegExp(one).test('https://oud.example/ar/rose-musk-night/p7777777'), 'one example: the slug is not part of the pattern');
  assert.deepEqual(productCandidates(['https://oud.example/ar/oud-royal/p1234567', 'https://oud.example/ar/blog/how-to', 'https://oud.example/ar/perfumes/c12345', 'https://oud.example/']), ['https://oud.example/ar/oud-royal/p1234567']);
  const prod = (n: number, extra: Partial<{ name: string; currency: string }> = {}) => ({ url: `https://s.example/products/p${n}`, supplierSku: `p${n}`, name: extra.name || `Oud Perfume ${n} 100ml`, description: '', images: ['https://s.example/i.jpg'], price: 100 + n, currency: extra.currency || 'AED', inStock: true, families: [], notes: { top: [], heart: [], base: [] }, seasons: [], occasions: [], via: 'generic' as const });
  const ok: Sample[] = [1, 2, 3, 4, 5, 6].map((n) => ({ url: `https://s.example/products/p${n}`, product: prod(n) as never, status: 200 }));
  const v = judgeSamples(ok);
  assert.equal(v.ok, true);
  assert.equal(v.currency, 'AED');
  const unreadable: Sample[] = ok.map((s, i) => (i < 4 ? { ...s, product: null } : s));
  assert.equal(judgeSamples(ok.map((s, i) => (i < 3 ? { ...s, product: null } : s))).ok, true, 'half read by himself is enough');
  assert.equal(judgeSamples(unreadable).ok, false);
  const shoes: Sample[] = ok.map((s, i) => ({ ...s, product: prod(i, { name: `Running shoes ${i}` }) as never }));
  assert.match(judgeSamples(shoes).reason || '', /ليست عطور/);
  const blocked: Sample[] = ok.map((s) => ({ ...s, product: null, status: 403 }));
  assert.match(judgeSamples(blocked).reason || '', /حماية/);
  assert.deepEqual(spreadSample([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3), [1, 5, 10]);
});

test('source scout: stores without a sitemap are browsed like a visitor (links, categories, pages)', () => {
  const home = `<a href="/collections/oud">Oud</a><a href="https://oud.example/products/royal-oud?variant=1#top">Royal</a>
<a href="/ar/perfumes/c55555">عطور</a><a href="https://other.example/x">x</a><a href="mailto:a@b.c">mail</a><a href="/pages/about-us">About</a>`;
  const links = pageLinks(home, 'https://www.oud.example/');
  assert.deepEqual(links, ['https://www.oud.example/collections/oud', 'https://oud.example/products/royal-oud', 'https://www.oud.example/ar/perfumes/c55555', 'https://www.oud.example/pages/about-us']);
  assert.deepEqual(links.filter((u) => CATEGORYISH.test(u)), ['https://www.oud.example/collections/oud', 'https://www.oud.example/ar/perfumes/c55555']);
  assert.deepEqual(productCandidates(links), ['https://oud.example/products/royal-oud']);
  assert.ok(sameSite('us.arabianoud.com', 'arabianoud.com') && !sameSite('notarabianoud.com', 'arabianoud.com'));
  assert.ok(pageLinks('<a href="https://us.oud.example/p/1">', 'https://oud.example/').length === 1, 'a sub-domain of the store is the store');
  assert.equal(withPage('https://oud.example/collections/oud', 1), 'https://oud.example/collections/oud');
  assert.equal(withPage('https://oud.example/collections/oud', 3), 'https://oud.example/collections/oud?page=3');
  assert.equal(withPage('https://oud.example/shop?sort=new', 2), 'https://oud.example/shop?sort=new&page=2');
  const src = toImportSource({ id: 'b', host: 'oud.example', name: 'B', base: 'https://oud.example', status: 'active', foundBy: 'known-store', foundAt: 't', attempts: 1, crawlPages: ['https://oud.example/collections/oud'], productPattern: '^https://oud\\.example/products/[^?#]+$', currency: 'SAR', rateToEgp: 13 });
  assert.ok(src);
  assert.deepEqual(src.sitemaps, []);
  assert.deepEqual(src.crawl, { pages: ['https://oud.example/collections/oud'], maxPages: 12 });
});

test('source scout: candidates, vetting order, queries, search parsing, import source', () => {
  const file = emptySources();
  const now = '2026-10-18T00:00:00.000Z';
  assert.equal(addCandidates(file, [{ host: 'https://www.oudhouse.ae/x', foundBy: 'seed' }, { host: 'oudhouse.ae', foundBy: 'seed' }, { host: 'noon.com', foundBy: 'seed' }], now), 1);
  assert.equal(file.sources[0].id, 'oudhouse-ae');
  const active: LiveSource = { id: 'a', host: 'a.example', name: 'A', base: 'https://a.example', status: 'active', foundBy: 'seed', foundAt: '2026-09-01T00:00:00.000Z', vettedAt: '2026-10-01T00:00:00.000Z', attempts: 1, sitemaps: ['https://a.example/sitemap.xml'], productPattern: '^https://a\\.example/products/[^?#]+$', currency: 'AED', rateToEgp: 13 };
  file.sources.push(active);
  assert.deepEqual(vettingQueue(file, Date.parse(now), 5).map((s) => s.id), ['oudhouse-ae', 'a'], 'new first, then the weekly re-check');
  const src = toImportSource(active);
  assert.ok(src);
  assert.equal(src.origin, 'discovered');
  assert.equal(src.perfumeOnly, true);
  assert.ok(src.productUrl.test('https://a.example/products/oud'));
  assert.equal(toImportSource({ ...active, status: 'candidate' }), undefined);
  const qs = planQueries(file, ['Lattafa'], Date.parse(now), 3);
  assert.equal(qs.length, 3);
  assert.ok(file.queries.some((q) => q.q.includes('Lattafa')));
  const found = domainsFromSearch({ candidates: [{ content: { parts: [{ text: 'Try www.perfumebox.sa and https://oudshop.com.eg/ar' }] }, groundingMetadata: { groundingChunks: [{ web: { uri: 'https://vertexaisearch.cloud.google.com/x', title: 'scentcity.ae' } }] } }] });
  assert.deepEqual(found.sort(), ['oudshop.com.eg', 'perfumebox.sa', 'scentcity.ae']);
  assert.deepEqual(brandSiteGuesses(['Lattafa', 'Al'], 3).map((g) => g.host), ['lattafa.com', 'lattafaperfumes.com', 'lattafaparfums.com']);
});

const DOCS: TrainingDoc[] = [
  { id: 'd1', title: 'تعتيق العطور', content: 'تعتيق العطر هو ترك الخلطة بعد مزج الزيت بالكحول في مكان مظلم وبارد من أسبوعين إلى ستة أسابيع حتى تتجانس الجزيئات وتنعم الرائحة، ثم تُبرّد وتُفلتر.', tags: ['تعتيق'] },
];

test('Shaheen school: exam, self-study from his own library (no AI), study answers checked', () => {
  const bank = buildBank(DOCS);
  assert.ok(bank.length >= CURRICULUM.length);
  assert.ok(!bank.some((b) => /سعر|عرض|خصم|price|offer/i.test(b.q)), 'no time-bound questions in the bank');
  const memory = emptyMemory();
  const first = exam(bank, memory, DOCS);
  assert.equal(first.reliance.covered, 0);
  const libraryResult = first.results.find((r) => r.lesson);
  assert.ok(libraryResult, 'a question answered by a library lesson');
  const lesson = selfLesson(libraryResult);
  assert.ok(lesson);
  for (const q of [libraryResult.question.q, ...lesson.paraphrases]) remember(memory, { question: q, lang: 'ar', mode: 'auto', answer: lesson.answer, source: 'study' }, new Date('2026-10-18T00:00:00Z'));
  const second = exam(bank, memory, DOCS);
  assert.ok(second.reliance.covered > first.reliance.covered, 'he answers more by himself after studying');
  assert.ok(second.results.find((r) => r.question.q === 'يعني ايه تعتيق العطر؟')?.covered, 'a differently worded question is answered from the lesson too');
  // AI study only for what no lesson covers, at most 2 per topic.
  const todo = pickStudy(second.results, 50);
  assert.ok(todo.every((b) => !second.results.find((r) => r.question === b)?.lesson));
  const topics = new Map<string, number>(); for (const b of todo) topics.set(b.topic, (topics.get(b.topic) || 0) + 1);
  assert.ok([...topics.values()].every((n) => n <= 2));
  const b = { q: 'ايه هو العنبر في العطور؟', lang: 'ar' as const, topic: 'materials', origin: 'curriculum' as const };
  const good = parseStudy('```json\n{"answer":"العنبر في العطور رائحة دافئة حلوة راتنجية، تصنع اليوم غالباً من مزيج لابدانوم وفانيليا وبنزوين، وتعطي العطر عمقاً وثباتاً.","paraphrases":["يعني ايه عنبر في البرفان؟","What is amber?","العنبر"]}\n```', b);
  assert.ok(good);
  assert.deepEqual(good.paraphrases, ['يعني ايه عنبر في البرفان؟'], 'other-language and too-short wordings are dropped');
  assert.equal(parseStudy('{"answer":"آسف، لا أستطيع الإجابة."}', b), null);
  assert.equal(parseStudy('not json', b), null);
});

test('importer independence: share of product pages read without AI', () => {
  assert.deepEqual(importerShare({ import: { sources: [{ via: { 'json-ld': 80, skill: 10, generic: 5, shaheen: 5 } }] } }), { localShare: 95, aiReadings: 5, localReadings: 95 });
  assert.equal(importerShare({}), undefined);
});
