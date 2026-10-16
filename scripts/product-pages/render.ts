/**
 * «صفحة لكل منتج» — a real, standalone HTML page for every product of «متجر شام» (p/<slug>.html) and a
 * product index (p/index.html), generated at build time for GitHub Pages and Vercel. Search engines and
 * WhatsApp/Facebook previews read them (title, description, photo, schema.org Product with the EGP price);
 * visitors see the full product (all photos, notes, description) and continue to the store's cart.
 * Pure: tested in tests/shaheenImport.test.ts.
 */
import { FAMILY_LABEL, GENDER_LABEL, OCCASION_LABEL, SEASON_LABEL, type StoreProduct } from '../../src/utils/storeCatalog';

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
/** Photos mirrored into the site are relative to the site root; pages live one folder down (p/). */
const img = (u: string, siteUrl: string, absolute = false) => (/^https:\/\//.test(u) ? u : absolute ? new URL(u, siteUrl).href : `../${u}`);
const egp = (n: number) => `${n.toLocaleString('ar-EG')} جنيه`;

const STYLE = `*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;background:#faf7f2;color:#1c1917;line-height:1.7}
a{color:#b45309}header{background:#1c1917;color:#fbbf24;padding:12px 20px;display:flex;justify-content:space-between;align-items:center}
header a{color:#fbbf24;text-decoration:none;font-weight:700}main{max-width:1080px;margin:0 auto;padding:20px}
.grid{display:grid;grid-template-columns:1fr;gap:28px}@media(min-width:820px){.grid{grid-template-columns:1fr 1fr}}
.gallery img{width:100%;border-radius:16px;background:#fff;aspect-ratio:1/1;object-fit:contain}.thumbs{display:flex;gap:8px;margin-top:8px;overflow-x:auto}
.thumbs img{width:72px;height:72px;object-fit:cover;border-radius:10px;border:1px solid #e7e5e4;background:#fff}
h1{font-size:1.7rem;margin:.2em 0}.en{color:#78716c;direction:ltr;text-align:start}.price{font-size:1.6rem;font-weight:800;color:#b45309}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}.chip{background:#fef3c7;color:#92400e;border-radius:999px;padding:2px 12px;font-size:.9rem}
.btn{display:inline-block;background:#d97706;color:#fff;padding:12px 22px;border-radius:12px;text-decoration:none;font-weight:700;margin:6px 0 6px 8px}
.btn.alt{background:#1c1917}.notes{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.notes div{background:#fff;border:1px solid #e7e5e4;border-radius:12px;padding:10px}
.notes b{display:block;color:#92400e}section{margin-top:18px}.specs td{padding:4px 10px;border-bottom:1px solid #e7e5e4}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px}.card{background:#fff;border:1px solid #e7e5e4;border-radius:14px;padding:10px;text-decoration:none;color:inherit}
.card img{width:100%;aspect-ratio:1/1;object-fit:contain;border-radius:10px}.card .p{color:#b45309;font-weight:700}footer{color:#78716c;text-align:center;padding:30px;font-size:.9rem}`;

export interface PageOptions { siteUrl: string }

export function productJsonLd(p: StoreProduct, o: PageOptions) {
  return {
    '@context': 'https://schema.org', '@type': 'Product', name: p.name.ar, alternateName: p.name.en !== p.name.ar ? p.name.en : undefined,
    sku: p.sku, brand: p.brand ? { '@type': 'Brand', name: p.brand } : undefined, description: p.description.ar,
    image: p.images.map((u) => img(u, o.siteUrl, true)), url: new URL(`p/${p.slug}.html`, o.siteUrl).href,
    offers: { '@type': 'Offer', priceCurrency: 'EGP', price: p.price, availability: `https://schema.org/${p.inStock ? 'InStock' : 'OutOfStock'}`, url: new URL(`#product=${p.id}`, o.siteUrl).href },
  };
}

export function renderProductPage(p: StoreProduct, related: StoreProduct[], o: PageOptions): string {
  const url = new URL(`p/${p.slug}.html`, o.siteUrl).href;
  const store = `../#product=${encodeURIComponent(String(p.id))}`;
  const title = `${p.name.ar}${p.brand && !p.name.ar.includes(p.brand) ? ` — ${p.brand}` : ''} | متجر شام`;
  const desc = p.description.ar.slice(0, 160);
  const chips = [
    p.gender && GENDER_LABEL[p.gender].ar, ...p.families.map((f) => FAMILY_LABEL[f].ar), ...p.seasons.map((s) => SEASON_LABEL[s].ar),
    ...p.occasions.map((x) => OCCASION_LABEL[x].ar),
  ].filter(Boolean);
  const notes = ([['الافتتاحية', p.notes.top], ['القلب', p.notes.heart], ['القاعدة', p.notes.base]] as const).filter(([, l]) => l.length);
  const specs = [['العلامة', p.brand], ['الحجم', p.sizeMl ? `${p.sizeMl} مل` : ''], ['التركيز', p.concentration], ['الثبات', p.longevity], ['رمز المنتج', p.sku]]
    .filter(([, v]) => v);
  const ld = JSON.stringify(productJsonLd(p, o)).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="product"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">${p.images[0] ? `<meta property="og:image" content="${esc(img(p.images[0], o.siteUrl, true))}">` : ''}
<meta property="product:price:amount" content="${p.price}"><meta property="product:price:currency" content="EGP"><meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${ld}</script><style>${STYLE}</style></head>
<body><header><a href="../">صمم عطرك مع شام</a><a href="index.html">كل منتجات المتجر</a></header>
<main><div class="grid"><div class="gallery">${p.images[0] ? `<img src="${esc(img(p.images[0], o.siteUrl))}" alt="${esc(p.name.ar)}" id="main">` : ''}
<div class="thumbs">${p.images.map((u, i) => `<a href="${esc(img(u, o.siteUrl))}" onclick="document.getElementById('main').src=this.href;return false"><img src="${esc(img(u, o.siteUrl))}" alt="${esc(`${p.name.ar} ${i + 1}`)}" loading="lazy"></a>`).join('')}</div></div>
<div><h1>${esc(p.name.ar)}</h1>${p.name.en !== p.name.ar ? `<div class="en">${esc(p.name.en)}</div>` : ''}
<p class="price">${esc(egp(p.price))}</p><p>${p.inStock ? '✅ متوفر' : '⛔ غير متوفر حالياً'}</p>
<div class="chips">${chips.map((c) => `<span class="chip">${esc(c)}</span>`).join('')}</div>
<a class="btn" href="${store}">أضف للسلة واطلب من المتجر</a><a class="btn alt" href="${store}">اسأل شاهين عن العطر</a>
${specs.length ? `<section><table class="specs">${specs.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table></section>` : ''}
</div></div>
${notes.length ? `<section><h2>الهرم العطري</h2><div class="notes">${notes.map(([k, l]) => `<div><b>${esc(k)}</b>${esc(l.join('، '))}</div>`).join('')}</div></section>` : ''}
<section><h2>الوصف</h2><p>${esc(p.description.ar)}</p>${p.description.en && p.description.en !== p.description.ar ? `<p class="en" dir="ltr">${esc(p.description.en).replace(/\n/g, '<br>')}</p>` : ''}</section>
${related.length ? `<section><h2>قد يعجبك أيضاً</h2><div class="cards">${related.map(card).join('')}</div></section>` : ''}
</main><footer>متجر شام — راجع «الخبير شاهين» بيانات هذا المنتج</footer></body></html>
`;
}

function card(p: StoreProduct) {
  return `<a class="card" href="${esc(p.slug)}.html">${p.images[0] ? `<img src="${esc(/^https:/.test(p.images[0]) ? p.images[0] : `../${p.images[0]}`)}" alt="${esc(p.name.ar)}" loading="lazy">` : ''}<div>${esc(p.name.ar)}</div><div class="p">${esc(egp(p.price))}</div></a>`;
}

export function renderIndexPage(products: StoreProduct[], o: PageOptions): string {
  const url = new URL('p/', o.siteUrl).href;
  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>كل منتجات متجر شام (${products.length})</title><meta name="description" content="كل عطور متجر شام بالصور والأسعار والنوتات — ${products.length} منتج.">
<link rel="canonical" href="${esc(url)}"><style>${STYLE}</style></head>
<body><header><a href="../">صمم عطرك مع شام</a><a href="../#store">افتح المتجر</a></header>
<main><h1>كل منتجات متجر شام (${products.length})</h1><div class="cards">${products.map(card).join('')}</div></main>
<footer>متجر شام</footer></body></html>
`;
}

/** Same closeness rule as the in-store «قد يعجبك أيضاً». */
export function relatedTo(p: StoreProduct, all: StoreProduct[], n = 4) {
  const score = (b: StoreProduct) => b.families.filter((f) => p.families.includes(f)).length * 3 + (p.gender && p.gender === b.gender ? 2 : 0)
    + (p.brand && p.brand === b.brand ? 1 : 0) + (Math.abs(p.price - b.price) <= p.price * 0.3 ? 1 : 0);
  return all.filter((b) => b.sku !== p.sku).map((b) => ({ b, s: score(b) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, n).map((x) => x.b);
}
