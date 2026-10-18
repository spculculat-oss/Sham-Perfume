import assert from 'node:assert/strict';
import test from 'node:test';
import {
  anchors, assessTrust, copyShare, officialBrandOf, pageKind, rdapRegistered, regionOf, registrableDomain, sellsCopies, trustLinks, trustReason, TRUST_MIN,
} from '../scripts/shaheen-discover/trust';
import { emptySources, interleave, KNOWN_STORES, KNOWN_STORES_BY_REGION, planQueries, vettingQueue, WORLD_QUERIES, type LiveSource } from '../scripts/shaheen-discover/discover';
import { extractProduct, parsePrice } from '../scripts/shaheen-import/extract';

const NOW = Date.parse('2026-10-18T00:00:00.000Z');
const YEARS = (n: number) => new Date(NOW - n * 365.25 * 86_400_000).toISOString();

/** A German perfumery's home page (invented, not a real store): full legal footer. */
const DE_HOME = `<!doctype html><html><head><title>Parfümerie Beispiel</title>
<link rel="stylesheet" href="https://cdn.shopify.com/s/files/theme.css"></head><body>
<header><a href="/collections/nischenduefte">Nischendüfte</a></header>
<p>100% Originalware – autorisierter Händler. Weltweiter Versand.</p>
<footer>
 <a href="/pages/impressum">Impressum</a> <a href="/pages/kontakt">Kontakt</a> <a href="/policies/refund-policy">Widerrufsbelehrung</a>
 <a href="/pages/versand">Versand &amp; Lieferung</a> <a href="/policies/privacy-policy">Datenschutz</a> <a href="/policies/terms-of-service">AGB</a>
 <a href="https://www.instagram.com/beispiel.parfum">Instagram</a>
 <img src="/icons/visa.svg" alt="Visa"><img src="/icons/paypal.svg" alt="PayPal"><img src="/icons/klarna.svg" alt="Klarna">
</footer></body></html>`;
const DE_IMPRESSUM = `<html><body><h1>Impressum</h1><p>Beispiel GmbH, Musterstraße 1, 10115 Berlin</p>
<p>Telefon: +49 30 1234567 · E-Mail: service@parfum-beispiel.de</p><p>Handelsregister: HRB 123456 · USt-IdNr.: DE123456789</p></body></html>`;

test('store CV: an established European perfumery passes with a high score', () => {
  const links = trustLinks(DE_HOME, 'https://parfum-beispiel.de');
  assert.equal(links[0], 'https://parfum-beispiel.de/pages/kontakt', 'contact first');
  assert.ok(links.includes('https://parfum-beispiel.de/policies/contact-information'), 'Shopify\'s legal details page too');
  assert.ok(links.includes('https://parfum-beispiel.de/pages/impressum'));
  assert.ok(links.length <= 6);
  assert.ok(!links.some((u) => u.includes('instagram')), 'only the store\'s own pages');
  const cv = assessTrust({
    host: 'parfum-beispiel.de', finalUrl: 'https://parfum-beispiel.de/', homeHtml: DE_HOME,
    pages: [{ url: 'https://parfum-beispiel.de/pages/impressum', html: DE_IMPRESSUM }], registeredAt: YEARS(9), safeBrowsing: 'clean', now: NOW,
  });
  assert.equal(cv.verdict, 'trusted');
  assert.ok(cv.score >= 90, `score ${cv.score}`);
  assert.deepEqual(cv.flags, []);
  const by = Object.fromEntries(cv.checks.map((c) => [c.id, c]));
  assert.equal(by.age.points, 20);
  assert.equal(by.identity.ok, true);
  assert.equal(by.returns.ok, true);
  assert.equal(by.shipping.detail, 'يشحن دولياً');
  assert.match(by.payment.detail || '', /Visa.*PayPal.*Klarna/);
  assert.equal(by.platform.detail, 'Shopify');
  assert.equal(by.authentic.ok, true);
  assert.equal(cv.checks.reduce((n, c) => n + c.max, 0), 100, 'the checks add up to 100');
});

test('store CV: Japanese and Arabic stores are read in their own language', () => {
  const jp = `<html><body><a href="/law">特定商取引法に基づく表記</a><a href="/contact">お問い合わせ</a><a href="/returns">返品・交換について</a>
    <a href="/privacy">プライバシーポリシー</a><a href="/terms">利用規約</a><p>正規品のみ取り扱い。海外発送対応。</p>
    <p>電話: 03-1234-5678 info@nose.example.jp 住所 東京都渋谷区</p><p>VISA / JCB / PayPay</p><a href="https://x.com/nose_example">X</a></body></html>`;
  const cvJp = assessTrust({ host: 'nose.example.jp', finalUrl: 'https://nose.example.jp/', homeHtml: jp, registeredAt: YEARS(6), now: NOW });
  assert.equal(cvJp.verdict, 'trusted', JSON.stringify(cvJp.checks.filter((c) => !c.ok)));
  const ar = `<html><body><a href="/pages/contact">اتصل بنا</a><a href="/pages/return-policy">سياسة الاسترجاع والاستبدال</a><a href="/pages/shipping">الشحن والتوصيل</a>
    <a href="/pages/privacy">سياسة الخصوصية</a><a href="/pages/terms">الشروط والأحكام</a><p>منتجات أصلية 100% — الوكيل الرسمي. نشحن لجميع الدول.</p>
    <p>السجل التجاري 1010123456 · الرقم الضريبي 300000000000003 · العنوان: الرياض</p><p>هاتف: +966 11 123 4567</p>
    <p>مدى · Apple Pay · تابي</p><a href="https://instagram.com/oud.example">انستجرام</a><script src="https://cdn.salla.network/app.js"></script></body></html>`;
  const cvAr = assessTrust({ host: 'oud.example.sa', finalUrl: 'https://oud.example.sa/', homeHtml: ar, registeredAt: null, now: NOW });
  assert.equal(cvAr.verdict, 'trusted');
  assert.equal(cvAr.checks.find((c) => c.id === 'age')?.ok, null, 'registry without a date is neutral, not a failure');
  assert.equal(cvAr.checks.find((c) => c.id === 'platform')?.detail, 'Salla');
});

test('store CV: red flags reject whatever the score; thin sites are weak', () => {
  const dupes = assessTrust({ host: 'dupes.example.com', finalUrl: 'https://dupes.example.com/', homeHtml: `${DE_HOME}<h2>Designer dupes – inspired by luxury perfumes</h2>`, pages: [{ url: 'https://dupes.example.com/impressum', html: DE_IMPRESSUM }], registeredAt: YEARS(8), now: NOW });
  assert.equal(dupes.verdict, 'rejected');
  assert.match(trustReason(dupes), /مقلّدة/);
  const young = assessTrust({ host: 'parfum-sale.example.shop', finalUrl: 'https://parfum-sale.example.shop/', homeHtml: DE_HOME, registeredAt: YEARS(0.2), now: NOW });
  assert.equal(young.verdict, 'rejected');
  assert.ok(young.flags.some((f) => /جديد جداً/.test(f)));
  assert.ok(young.flags.some((f) => /امتداد/.test(f)));
  const insecure = assessTrust({ host: 'old.example.com', finalUrl: 'http://old.example.com/', homeHtml: DE_HOME, registeredAt: YEARS(10), now: NOW });
  assert.equal(insecure.verdict, 'rejected');
  const flagged = assessTrust({ host: 'p.example.com', finalUrl: 'https://p.example.com/', homeHtml: DE_HOME, registeredAt: YEARS(10), safeBrowsing: 'flagged', now: NOW });
  assert.equal(flagged.verdict, 'rejected');
  const wire = assessTrust({ host: 'w.example.com', finalUrl: 'https://w.example.com/', homeHtml: '<p>Payment by Western Union or MoneyGram</p>', registeredAt: YEARS(3), now: NOW });
  assert.ok(wire.flags.some((f) => /الحوالات/.test(f)));
  const thin = assessTrust({ host: 'thin.example.com', finalUrl: 'https://thin.example.com/', homeHtml: '<html><body><h1>Perfumes</h1><a href="/p/1">Oud</a></body></html>', registeredAt: YEARS(4), now: NOW });
  assert.equal(thin.verdict, 'weak');
  assert.ok(thin.score < TRUST_MIN);
  assert.match(trustReason(thin), /ضعيف \(\d+\/100\): ينقصه/);
});

test('store CV helpers: copies, registry, regions, links', () => {
  assert.equal(copyShare(['Oud Royal 100ml', 'Inspired by Aventus', 'Baccarat dupe', 'Musk']), 0.5);
  assert.equal(copyShare([]), 0);
  assert.equal(sellsCopies('<p>Inspired by the desert nights of Arabia</p>'), false, 'a poetic «inspired by» is not a copy shop');
  assert.equal(sellsCopies('<p>Best perfume dupes of 2026</p>'), true);
  assert.equal(registrableDomain('shop.example.co.uk'), 'example.co.uk');
  assert.equal(registrableDomain('www.parfum.de'), 'parfum.de');
  assert.equal(registrableDomain('perfumehub.com.my'), 'perfumehub.com.my');
  assert.equal(rdapRegistered({ events: [{ eventAction: 'last changed', eventDate: '2025-01-01T00:00:00Z' }, { eventAction: 'registration', eventDate: '2004-03-02T10:00:00Z' }] }), '2004-03-02T10:00:00.000Z');
  assert.equal(rdapRegistered({}), undefined);
  assert.equal(regionOf('douglas.de'), 'europe');
  assert.equal(regionOf('nose-shop.jp'), 'east-asia');
  assert.equal(regionOf('goldapple.kz'), 'central-asia');
  assert.equal(regionOf('fragrancenet.com', 'USD'), 'americas');
  assert.equal(regionOf('notino.co.uk'), 'europe');
  assert.equal(regionOf('example.com'), 'global');
  assert.deepEqual(anchors('<a href="/a?x=1&amp;y=2">A <b>b</b></a>', 'https://s.example'), [{ href: 'https://s.example/a?x=1&y=2', text: 'A b' }]);
  const icon = `<a class="f" href="/pages/contact"><svg viewBox="0 0 24 24">${'<path d="M0 0h24v24H0z"/>'.repeat(30)}</svg> Contact us</a><a href="mailto:x@y.example">mail</a>`;
  assert.deepEqual(anchors(icon, 'https://s.example'), [{ href: 'https://s.example/pages/contact', text: 'Contact us' }], 'long icons inside a link; no mailto');
});

test('store CV: a Shopify brand shop whose menus are built by script is judged on its standard policy pages', () => {
  // The home page links nothing but products (footer rendered by script).
  const home = `<html><head><script src="https://cdn.shopify.com/s/x.js"></script></head><body><p>Official online store — 100% authentic perfumes</p>
    <a href="/products/oud-royal">Oud Royal</a><a href="https://www.instagram.com/brand.example">IG</a>
    <svg aria-labelledby="pi-visa"><title id="pi-visa">Visa</title></svg><svg aria-labelledby="pi-master"><title id="pi-master">Mastercard</title></svg></body></html>`;
  const links = trustLinks(home, 'https://brand.example.com');
  for (const p of ['/policies/contact-information', '/policies/refund-policy', '/policies/legal-notice', '/policies/shipping-policy', '/policies/privacy-policy', '/policies/terms-of-service']) {
    assert.ok(links.includes(`https://brand.example.com${p}`), p);
  }
  const pages = [
    { url: 'https://brand.example.com/policies/contact-information', html: '<h1>Contact information</h1><p>Trade name: Brand Perfumes LLC</p><p>Phone number: +971 4 123 4567</p><p>Email: care@brand.example.com</p><p>Physical address: Dubai, UAE</p><p>VAT number: 100123456700003</p>' },
    { url: 'https://brand.example.com/policies/refund-policy', html: '<h1>Refund policy</h1><p>30 days.</p>' },
    { url: 'https://brand.example.com/policies/shipping-policy', html: '<h1>Shipping policy</h1><p>We ship worldwide.</p>' },
    { url: 'https://brand.example.com/policies/privacy-policy', html: '<h1>Privacy</h1>' },
    { url: 'https://brand.example.com/policies/terms-of-service', html: '<h1>Terms</h1>' },
  ];
  const cv = assessTrust({ host: 'brand.example.com', finalUrl: 'https://brand.example.com/', homeHtml: home, pages, registeredAt: YEARS(15), now: NOW });
  assert.equal(cv.verdict, 'trusted', JSON.stringify(cv.checks.filter((c) => !c.ok)));
  assert.ok(cv.score >= 90, `score ${cv.score}`);
  const thinHome = assessTrust({ host: 'brand.example.com', finalUrl: 'https://brand.example.com/', homeHtml: home, registeredAt: YEARS(15), now: NOW });
  assert.ok(thinHome.score < cv.score, 'the policy pages are what make the difference');
});

test('global scout: regions take turns in the address book, the searches and the queue', () => {
  assert.deepEqual(interleave([[1, 2, 3], [4], [5, 6]]), [1, 4, 5, 2, 6, 3]);
  assert.equal(new Set(KNOWN_STORES).size, KNOWN_STORES.length, 'no store twice');
  const firstSix = KNOWN_STORES.slice(0, 6);
  for (const region of ['arab', 'europe', 'americas', 'east-asia', 'central-asia'] as const) {
    assert.ok(firstSix.some((h) => KNOWN_STORES_BY_REGION[region].includes(h)), `${region} among the first six`);
  }
  const langs = new Set(WORLD_QUERIES.flat().map((q) => q.lang));
  for (const l of ['ar', 'en', 'fr', 'de', 'es', 'ja', 'ko', 'zh', 'ru']) assert.ok(langs.has(l as never), l);
  const file = emptySources();
  const qs = planQueries(file, [], NOW, 5);
  assert.deepEqual(qs.map((q) => q.region), ['arab', 'europe', 'americas', 'east-asia', 'central-asia'], 'one search per region per run');
  const active: LiveSource = { id: 'a', host: 'a.example', name: 'A', base: 'https://a.example', status: 'active', foundBy: 'seed', foundAt: '2026-09-01T00:00:00.000Z', vettedAt: '2026-10-17T00:00:00.000Z', attempts: 1, currency: 'AED', rateToEgp: 13 };
  const cand: LiveSource = { id: 'c', host: 'c.example', name: 'C', base: 'https://c.example', status: 'candidate', foundBy: 'seed', foundAt: '2026-10-01T00:00:00.000Z', attempts: 0 };
  file.sources.push(cand, active);
  assert.deepEqual(vettingQueue(file, NOW, 5).map((s) => s.id), ['a', 'c'], 'an active store without a CV is reviewed first, even if checked yesterday');
});

test('European price formats are read correctly (49,90 € is not 4990)', () => {
  assert.equal(parsePrice('49,90'), 49.9);
  assert.equal(parsePrice('1.234,50 €'), 1234.5);
  assert.equal(parsePrice('¥12,800'), 12800);
  const page = (price: string, cur: string) => `<html><head><script type="application/ld+json">${JSON.stringify({ '@type': 'Product', name: 'Eau de Parfum 100 ml', sku: 'X1', image: 'https://s.example/a.jpg', offers: { '@type': 'Offer', price, priceCurrency: cur } })}</script></head><body></body></html>`;
  assert.equal(extractProduct(page('49,90', 'EUR'), 'https://s.example/p/x1')?.price, 49.9);
  assert.equal(extractProduct(page('120.0000', 'USD'), 'https://s.example/p/x1')?.price, 120, 'the standard format stays as written');
  assert.equal(extractProduct(page('12800', 'JPY'), 'https://s.example/p/x1')?.price, 12800);
});

test('store CV: the brand\'s own house, and pages the site forbids reading', () => {
  const home = `<html><head><script src="https://cdn.shopify.com/s/x.js"></script></head><body><a href="/products/oud">Oud</a><a href="https://instagram.com/brand">IG</a></body></html>`;
  const blocked = ['identity', 'returns', 'shipping', 'privacy', 'terms'] as const;
  assert.equal(pageKind('https://afnan.example/policies/refund-policy'), 'returns');
  assert.equal(pageKind('https://afnan.example/policies/contact-information'), 'identity');
  assert.equal(pageKind('https://afnan.example/pages/impressum'), 'identity');
  assert.equal(officialBrandOf('us.afnan.com', ['Lattafa', 'Afnan']), 'Afnan');
  assert.ok(trustLinks('<img src="//us.afnan.example/cdn/shop/files/a.png"><a href="/products/x">x</a>', 'https://us.afnan.example').includes('https://us.afnan.example/policies/refund-policy'), 'Shopify on its own domain (/cdn/shop/)');
  assert.equal(officialBrandOf('lattafa-perfumes.com', ['Lattafa Perfumes']), 'Lattafa Perfumes');
  assert.equal(officialBrandOf('afnan-sale.shop', ['Afnan']), undefined, 'a look-alike domain is not the brand');
  const old = assessTrust({ host: 'afnan.com', finalUrl: 'https://afnan.com/', homeHtml: home, blocked: [...blocked], brands: ['Afnan'], registeredAt: YEARS(18), now: NOW });
  const id = old.checks.find((c) => c.id === 'identity')!;
  assert.equal(id.ok, true);
  assert.match(id.detail || '', /الرسمي لماركة Afnan/);
  const ret = old.checks.find((c) => c.id === 'returns')!;
  assert.deepEqual([ret.ok, ret.points], [null, 5], 'forbidden page = «could not check», half points');
  const young = assessTrust({ host: 'newshop.example.com', finalUrl: 'https://newshop.example.com/', homeHtml: home, blocked: [...blocked], brands: ['Afnan'], registeredAt: YEARS(1.5), now: NOW });
  assert.equal(young.checks.find((c) => c.id === 'returns')?.points, 0, 'no benefit of the doubt for a young shop');
  assert.ok(young.score < TRUST_MIN);
});
