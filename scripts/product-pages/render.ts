/**
 * «صفحة لكل منتج» — a real, standalone HTML page for every product of «متجر شام» (p/<slug>.html) and a
 * product index (p/index.html), generated at build time for GitHub Pages and Vercel. Search engines and
 * WhatsApp/Facebook previews read them (title, description, photo, schema.org Product with the EGP price);
 * visitors see the full product (all photos, notes, description) and continue to the store's cart.
 * Pure: tested in tests/shaheenImport.test.ts.
 */
import { type StoreProduct } from '../../src/utils/storeCatalog';
import { STORE_BASE_LANGS, type StoreTextKey } from '../../src/لغات/storeKeys';
import { storeText } from '../../src/لغات/storeL10n';
import { SUPPORTED_LANGUAGES } from '../../src/types/i18n';

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
/** Photos mirrored into the site are relative to the site root; pages live one folder down (p/). */
const img = (u: string, siteUrl: string, absolute = false) => (/^https:\/\//.test(u) ? u : absolute ? new URL(u, siteUrl).href : `../${u}`);
const egp = (n: number) => `${n.toLocaleString('ar-EG')} جنيه`;
// A photo that no longer loads (e.g. an old illustrative stock photo) shows a neutral placeholder like the
// store does; a broken thumbnail is simply removed. Broken photos are marked data-broken for the page check.
const PLACEHOLDER = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fef3c7"/><stop offset="1" stop-color="#f5f5f4"/></linearGradient></defs><rect width="400" height="400" fill="url(#g)"/><rect x="170" y="110" width="60" height="40" rx="8" fill="#fbbf24" opacity=".55"/><rect x="135" y="150" width="130" height="150" rx="26" fill="#fbbf24" opacity=".35"/></svg>')}`;
/** The page's only script: language switching + a neutral photo when one no longer loads. */

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

/**
 * «صفحة المنتج بلغة الزائر»: the standalone pages are static files, so they carry their chrome in
 * every base language and a tiny script swaps it when the page opens. A visitor whose language has no
 * full page pack reads the English labels — never Arabic (the same rule as the store itself).
 */
const PAGE_KEYS: StoreTextKey[] = [
  'sf_store_name', 'pd_index', 'sf_add_to_cart', 'pd_shop_cta', 'pd_ask_shaheen', 'pd_in_stock', 'sf_out_of_stock',
  'pd_scent_profile', 'pd_notes_pyramid', 'pd_description', 'pd_related', 'pd_footer', 'sf_currency',
  'pd_brand', 'pd_size', 'pd_ml', 'pd_concentration', 'pd_longevity', 'pd_sku', 'pd_top', 'pd_heart', 'pd_base',
  'pd_family', 'pd_gender', 'pd_seasons', 'pd_occasions',
  'family_oud', 'family_oriental', 'family_amber', 'family_woody', 'family_floral', 'family_fresh',
  'family_citrus', 'family_aquatic', 'family_fruity', 'family_gourmand', 'family_musk', 'family_spicy',
  'family_leather', 'family_powdery', 'gender_men', 'gender_women', 'gender_unisex',
  'season_summer', 'season_winter', 'season_spring', 'season_autumn', 'season_all',
  'occasion_daily', 'occasion_evening', 'occasion_work', 'occasion_special', 'occasion_gift',
];

/**
 * The page's own pack, compact on purpose: the key names are written once and every language is an
 * array aligned to them (the same shape as the store's waves), so 51 labels × 10 languages add ~6 KB
 * per page instead of repeating every key name ten times.
 */
export function pageLabelTable(): { keys: StoreTextKey[]; packs: Record<string, string[]> } {
  return {
    keys: PAGE_KEYS,
    packs: Object.fromEntries(STORE_BASE_LANGS.map((lang) => [lang, PAGE_KEYS.map((key) => storeText(lang, key))])),
  };
}

/** Every language the platform offers (so a saved language the page has no pack for still reads English). */
const ALL_LANGS = SUPPORTED_LANGUAGES.map((l) => l.code).join(',');
/** Languages written right-to-left, so the standalone page flips with the visitor's language. */
const PAGE_DIRS = SUPPORTED_LANGUAGES.filter((l) => l.dir === 'rtl').map((l) => l.code).join(',');

const SWITCHER = (table: string) => `<script id="page-l10n" type="application/json">${table}</script>
<script>(function(){try{
var ALL=(${JSON.stringify(ALL_LANGS)}).split(','),RT=(${JSON.stringify(PAGE_DIRS)}).split(',');
var T=JSON.parse(document.getElementById('page-l10n').textContent),K=T.keys;
var s=localStorage.getItem('sham_perfume_user_language')||'';
var l=ALL.indexOf(s)>=0?s:'en',ar=l==='ar';
var vals=(T.packs[l]||T.packs.en)||[];
if(ar)return;
var d=document;d.documentElement.lang=l;d.documentElement.dir=RT.indexOf(l)>=0?'rtl':'ltr';
d.querySelectorAll('[data-l]').forEach(function(e){var i=K.indexOf(e.getAttribute('data-l'));if(i>=0&&vals[i])e.textContent=vals[i]});
d.querySelectorAll('[data-name]').forEach(function(e){e.textContent=e.getAttribute('data-en')||e.getAttribute('data-ar')||''});
var n=new Intl.NumberFormat(l),cur=vals[K.indexOf('sf_currency')]||'EGP';
d.querySelectorAll('[data-price]').forEach(function(e){e.textContent=n.format(Number(e.getAttribute('data-price')))+' '+cur});
var h=d.querySelector('h1[data-name]');if(h)d.title=h.textContent+' | '+(vals[K.indexOf('sf_store_name')]||'');
}catch(e){}})()</script>`;

/** A photo that is gone shows a neutral placeholder (main/cards) or disappears (thumbnail). */
const NO_IMG_FN = `function noImg(i,thumb){i.onerror=null;i.dataset.broken=i.getAttribute('src');if(thumb){i.closest('a').remove();return}i.src=${JSON.stringify(PLACEHOLDER)}}`;

/** One Arabic default label, ready for the markup (the page reads Arabic until the script switches it). */
const arLabel = (key: StoreTextKey) => esc(storeText('ar', key));
/** Marks a label for the language switcher. */
const dl = (key: StoreTextKey) => ` data-l="${key}"`;
const chip = (key: StoreTextKey) => `<span class="chip"${dl(key)}>${arLabel(key)}</span>`;

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
  // Every chip is a store label with a key, so the switcher can read it in the visitor's language.
  const chips = [
    p.gender && chip(`gender_${p.gender}` as StoreTextKey), ...p.families.filter((f) => isFamilyCode(f)).map((f) => chip(familyKey(f))),
    ...p.seasons.map((x) => chip(`season_${x}` as StoreTextKey)), ...p.occasions.map((x) => chip(`occasion_${x}` as StoreTextKey)),
  ].filter(Boolean);
  const notes = ([['pd_top', p.notes.top], ['pd_heart', p.notes.heart], ['pd_base', p.notes.base]] as const).filter(([, l]) => l.length);
  const specs = ([
    ['pd_brand', esc(p.brand)], ['pd_size', p.sizeMl ? `${p.sizeMl} <span${dl('pd_ml')}>${arLabel('pd_ml')}</span>` : ''],
    ['pd_concentration', esc(p.concentration)], ['pd_longevity', esc(p.longevity)], ['pd_sku', esc(p.sku)],
  ] as const).filter(([, v]) => v);
  const ld = JSON.stringify(productJsonLd(p, o)).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="product"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">${p.images[0] ? `<meta property="og:image" content="${esc(img(p.images[0], o.siteUrl, true))}">` : ''}
<meta property="product:price:amount" content="${p.price}"><meta property="product:price:currency" content="EGP"><meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${ld}</script><style>${STYLE}</style><script>${NO_IMG_FN}</script></head>
<body><header><a href="../">صمم عطرك مع شام</a><a href="index.html"${dl('pd_index')}>كل منتجات المتجر</a></header>
<main><div class="grid"><div class="gallery">${p.images[0] ? `<img src="${esc(img(p.images[0], o.siteUrl))}" alt="${esc(p.name.ar)}" id="main" onerror="noImg(this)">` : ''}
<div class="thumbs">${p.images.map((u, i) => `<a href="${esc(img(u, o.siteUrl))}" onclick="document.getElementById('main').src=this.href;return false"><img src="${esc(img(u, o.siteUrl))}" alt="${esc(`${p.name.ar} ${i + 1}`)}" loading="lazy" onerror="noImg(this,1)"></a>`).join('')}</div></div>
<div><h1 data-name data-ar="${esc(p.name.ar)}" data-en="${esc(p.name.en)}">${esc(p.name.ar)}</h1>${p.name.en !== p.name.ar ? `<div class="en">${esc(p.name.en)}</div>` : ''}
<p class="price" data-price="${p.price}">${esc(egp(p.price))}</p><p>${p.inStock ? `✅ <span${dl('pd_in_stock')}>متوفر</span>` : `⛔ <span${dl('sf_out_of_stock')}>غير متوفر حالياً</span>`}</p>
<div class="chips">${chips.map((c) => `<span class="chip">${esc(c)}</span>`).join('')}</div>
<a class="btn" href="${store}"${dl('pd_shop_cta')}>أضف للسلة واطلب من المتجر</a><a class="btn alt" href="${store}"${dl('pd_ask_shaheen')}>اسأل شاهين عن العطر</a>
${specs.length ? `<section><table class="specs">${specs.map(([k, v]) => `<tr><td${dl(k as StoreTextKey)}>${arLabel(k as StoreTextKey)}</td><td>${v}</td></tr>`).join('')}</table></section>` : ''}
</div></div>
${notes.length ? `<section><h2${dl('pd_notes_pyramid')}>الهرم العطري</h2><div class="notes">${notes.map(([k, l]) => `<div><b${dl(k)}>${arLabel(k)}</b>${esc(l.join('، '))}</div>`).join('')}</div></section>` : ''}
<section><h2${dl('pd_description')}>الوصف</h2><p data-name data-ar="${esc(p.description.ar)}" data-en="${esc(p.description.en || p.description.ar)}">${esc(p.description.ar)}</p>${p.description.en && p.description.en !== p.description.ar ? `<p class="en" dir="ltr">${esc(p.description.en).replace(/\n/g, '<br>')}</p>` : ''}</section>
${related.length ? `<section><h2${dl('pd_related')}>قد يعجبك أيضاً</h2><div class="cards">${related.map(card).join('')}</div></section>` : ''}
</main><footer${dl('pd_footer')}>متجر شام — راجع «الخبير شاهين» بيانات هذا المنتج</footer>${SWITCHER(JSON.stringify(pageLabelTable()).replace(/</g, '\\u003c'))}</body></html>
`;
}

function card(p: StoreProduct) {
  return `<a class="card" href="${esc(p.slug)}.html">${p.images[0] ? `<img src="${esc(/^https:/.test(p.images[0]) ? p.images[0] : `../${p.images[0]}`)}" alt="${esc(p.name.ar)}" loading="lazy" onerror="noImg(this)">` : ''}<div data-name data-ar="${esc(p.name.ar)}" data-en="${esc(p.name.en)}">${esc(p.name.ar)}</div><div class="p" data-price="${p.price}">${esc(egp(p.price))}</div></a>`;
}

/** Family codes the store knows; anything else is skipped instead of leaking a raw code into a chip. */
function familyKey(f: string): StoreTextKey {
  return FAMILY_CODES.has(f) ? `family_${f}` as StoreTextKey : 'family_oud';
}
const FAMILY_CODES = new Set(['oud', 'oriental', 'amber', 'woody', 'floral', 'fresh', 'citrus', 'aquatic', 'fruity', 'gourmand', 'musk', 'spicy', 'leather', 'powdery']);
const isFamilyCode = (f: string) => FAMILY_CODES.has(f);

export function renderIndexPage(products: StoreProduct[], o: PageOptions): string {
  const url = new URL('p/', o.siteUrl).href;
  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>كل منتجات متجر شام (${products.length})</title><meta name="description" content="كل عطور متجر شام بالصور والأسعار والنوتات — ${products.length} منتج.">
<link rel="canonical" href="${esc(url)}"><style>${STYLE}</style><script>${NO_IMG_FN}</script></head>
<body><header><a href="../">صمم عطرك مع شام</a><a href="../#store">افتح المتجر</a></header>
<main><h1><span${dl('pd_index')}>كل منتجات المتجر</span> (${products.length})</h1><div class="cards">${products.map(card).join('')}</div></main>
<footer${dl('sf_store_name')}>متجر شام</footer>${SWITCHER(JSON.stringify(pageLabelTable()).replace(/</g, '\\u003c'))}</body></html>
`;
}

/** Same closeness rule as the in-store «قد يعجبك أيضاً». */
export function relatedTo(p: StoreProduct, all: StoreProduct[], n = 4) {
  const score = (b: StoreProduct) => b.families.filter((f) => p.families.includes(f)).length * 3 + (p.gender && p.gender === b.gender ? 2 : 0)
    + (p.brand && p.brand === b.brand ? 1 : 0) + (Math.abs(p.price - b.price) <= p.price * 0.3 ? 1 : 0);
  return all.filter((b) => b.sku !== p.sku).map((b) => ({ b, s: score(b) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, n).map((x) => x.b);
}
