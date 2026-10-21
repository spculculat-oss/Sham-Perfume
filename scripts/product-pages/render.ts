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
import { localLongevity } from '../../src/لغات/longevity';
import { SUPPORTED_LANGUAGES } from '../../src/types/i18n';
import { SITE } from '../../src/seo/site';
import { BUNDLED_FX, COUNTRY_CODES, HOME_CURRENCY, ZONE_COUNTRY, currencyFor } from '../../src/utils/pricing';
import { LOCALE_MAP } from '../../src/لغات/localize';

/**
 * p/money.json — what a standalone page needs to show the store's price in the visitor's currency (#169):
 * the same country → currency rule and the same exchange table the store uses, so a shared product page and
 * the cart show the same number. The page keeps the EGP price (and the EGP schema.org offer) until it loads.
 */
export function moneyTable() {
  const currency = Object.fromEntries(COUNTRY_CODES.map((code) => [code, currencyFor(code, BUNDLED_FX)]));
  const used = new Set([HOME_CURRENCY, ...Object.values(currency)]);
  const rates = Object.fromEntries([...used].filter((c) => Number(BUNDLED_FX.rates[c]) > 0).map((c) => [c, BUNDLED_FX.rates[c]]));
  return { home: HOME_CURRENCY, updatedAt: (BUNDLED_FX as { updatedAt?: string }).updatedAt || '', currency, rates, zones: ZONE_COUNTRY, locales: LOCALE_MAP };
}

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
.card img{width:100%;aspect-ratio:1/1;object-fit:contain;border-radius:10px}.card .p{color:#b45309;font-weight:700}.crumb{font-size:.82rem;color:#78716c;margin-bottom:14px}.small{font-size:.8rem;color:#78716c}footer{color:#78716c;text-align:center;padding:30px;font-size:.9rem}footer nav{display:flex;gap:14px;justify-content:center;margin-top:6px}`;

export interface PageOptions { siteUrl: string }

/**
 * «صفحة المنتج بلغة الزائر»: the standalone pages are static files, so they carry their chrome in
 * every base language and a tiny script swaps it when the page opens. A visitor whose language has no
 * full page pack reads the English labels — never Arabic (the same rule as the store itself). With no saved
 * language (a first visit from a search or a shared link) the phone's own language decides, like the store.
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
if(ALL.indexOf(s)<0){var B=navigator.languages||[navigator.language||''];for(var i=0;i<B.length&&ALL.indexOf(s)<0;i++){var g=String(B[i]||'').toLowerCase();s=ALL.indexOf(g)>=0?g:g.split('-')[0]}}
var l=ALL.indexOf(s)>=0?s:'en',ar=l==='ar';
var vals=(T.packs[l]||T.packs.en)||[];
money(l,navigator.languages||[navigator.language||'']);
if(ar)return;
var d=document;d.documentElement.lang=l;d.documentElement.dir=RT.indexOf(l)>=0?'rtl':'ltr';
d.querySelectorAll('[data-l]').forEach(function(e){var i=K.indexOf(e.getAttribute('data-l'));if(i>=0&&vals[i])e.textContent=vals[i]});
d.querySelectorAll('[data-name]').forEach(function(e){e.textContent=e.getAttribute('data-en')||e.getAttribute('data-ar')||''});
var n=new Intl.NumberFormat(l),cur=vals[K.indexOf('sf_currency')]||'EGP';
d.querySelectorAll('[data-price]').forEach(function(e){e.textContent=n.format(Number(e.getAttribute('data-price')))+' '+cur});
var h=d.querySelector('h1[data-name]');if(h)d.title=h.textContent+' | '+(vals[K.indexOf('sf_store_name')]||'');
}catch(e){}
function money(l,langs){try{var c='';try{c=(JSON.parse(localStorage.getItem('sham-store-country')||'null')||{}).code||''}catch(x){}
fetch('money.json').then(function(r){return r.ok?r.json():null}).then(function(m){if(!m||!m.currency)return;
if(!m.currency[c]){c=m.zones[(Intl.DateTimeFormat().resolvedOptions()||{}).timeZone]||'';for(var i=0;!c&&i<langs.length;i++){var g=String(langs[i]||'').split(/[-_]/).slice(1).filter(function(x){return /^[A-Za-z]{2}$/.test(x)})[0];if(g&&m.currency[g.toUpperCase()])c=g.toUpperCase()}}
var cur=m.currency[c],a=m.rates[m.home],b=m.rates[cur];if(!cur||cur===m.home||!(a>0)||!(b>0))return;
var loc=m.locales[l]||'en-GB';
document.querySelectorAll('[data-price]').forEach(function(e){var v=td(Number(e.getAttribute('data-price'))/a*b),f=Math.round(v*100)%100?2:0;
try{e.textContent=new Intl.NumberFormat(loc,{style:'currency',currency:cur,minimumFractionDigits:f,maximumFractionDigits:f}).format(v)}catch(x){e.textContent=v+' '+cur}
e.setAttribute('data-currency',cur)})}).catch(function(){})}catch(e){}}
function td(v){if(!(v>0))return 0;var d=Math.floor(Math.log10(v))+1,s=Math.max(Math.pow(10,d-2)/2,0.05);return Math.round(Math.ceil(v/s-1e-9)*s*100)/100}
})()</script>`;

/** A photo that is gone shows a neutral placeholder (main/cards) or disappears (thumbnail). */
const NO_IMG_FN = `function noImg(i,thumb){i.onerror=null;i.dataset.broken=i.getAttribute('src');if(thumb){i.closest('a').remove();return}i.src=${JSON.stringify(PLACEHOLDER)}}`;

/** One Arabic default label, ready for the markup (the page reads Arabic until the script switches it). */
const arLabel = (key: StoreTextKey) => esc(storeText('ar', key));
/** Marks a label for the language switcher. */
const dl = (key: StoreTextKey) => ` data-l="${key}"`;
const chip = (key: StoreTextKey) => `<span class="chip"${dl(key)}>${arLabel(key)}</span>`;

export function productJsonLd(p: StoreProduct, o: PageOptions) {
  const pageUrl = new URL(`p/${p.slug}.html`, o.siteUrl).href;
  return {
    '@context': 'https://schema.org', '@type': 'Product', name: p.name.ar, alternateName: p.name.en !== p.name.ar ? p.name.en : undefined,
    sku: p.sku, brand: p.brand ? { '@type': 'Brand', name: p.brand } : undefined, description: p.description.ar,
    image: p.images.length ? p.images.map((u) => img(u, o.siteUrl, true)) : [new URL(SITE.ogImage, o.siteUrl).href],
    url: pageUrl, mainEntityOfPage: pageUrl, category: p.category,
    offers: {
      '@type': 'Offer', priceCurrency: 'EGP', price: p.price, itemCondition: 'https://schema.org/NewCondition',
      availability: `https://schema.org/${p.inStock ? 'InStock' : 'OutOfStock'}`, url: pageUrl,
      seller: { '@type': 'Organization', name: SITE.nameAr, url: o.siteUrl },
    },
  };
}

/** 50–60 characters where possible: the product leads, the store name fits if it can. */
export function productSeoTitle(p: StoreProduct) {
  const brand = p.brand && !p.name.ar.includes(p.brand) ? ` — ${p.brand}` : '';
  // The size tells apart variants with one name (105 ml and a 10 ml pen of the same perfume had the same title).
  const size = p.sizeMl && !/\d\s*(?:ml|مل|مللي)/i.test(p.name.ar) ? ` ${p.sizeMl} مل` : '';
  const full = `${p.name.ar}${size}${brand} | متجر شام`;
  if (full.length <= 60) return full;
  const short = `${p.name.ar}${size} | متجر شام`;
  if (short.length <= 60) return short;
  return `${p.name.ar.slice(0, 46).trim()}… | شام`;
}

/** 120–160 characters built only from the product's own data (no invented offer or rating). */
export function productSeoDescription(p: StoreProduct) {
  const clean = (text: string) => text.replace(/\s+/g, ' ').trim();
  let desc = clean(p.description.ar);
  if (desc.length < 110) {
    const notes = [...p.notes.top, ...p.notes.heart, ...p.notes.base].filter(Boolean).slice(0, 5);
    if (notes.length) desc = `${desc} النوتات: ${notes.join('، ')}.`.trim();
  }
  if (desc.length < 110) desc = `${desc} ${p.brand ? `من ${p.brand}. ` : ''}تفاصيل المنتج والسعر في متجر شام.`.trim();
  if (desc.length > 160) desc = `${desc.slice(0, 157).trimEnd()}…`;
  return desc;
}

function breadcrumbJsonLd(p: StoreProduct, o: PageOptions) {
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE.nameAr, item: o.siteUrl },
      { '@type': 'ListItem', position: 2, name: 'متجر شام', item: new URL('p/', o.siteUrl).href },
      { '@type': 'ListItem', position: 3, name: p.name.ar, item: new URL(`p/${p.slug}.html`, o.siteUrl).href },
    ],
  };
}

export function renderProductPage(p: StoreProduct, related: StoreProduct[], o: PageOptions): string {
  const url = new URL(`p/${p.slug}.html`, o.siteUrl).href;
  const homeUrl = o.siteUrl;
  const store = `../#product=${encodeURIComponent(String(p.id))}`;
  const title = productSeoTitle(p);
  const desc = productSeoDescription(p);
  const ogImage = p.images[0] ? img(p.images[0], o.siteUrl, true) : new URL(SITE.ogImage, o.siteUrl).href;
  // Every chip is a store label with a key, so the switcher can read it in the visitor's language.
  const chips = [
    p.gender && chip(`gender_${p.gender}` as StoreTextKey), ...p.families.filter((f) => isFamilyCode(f)).map((f) => chip(familyKey(f))),
    ...p.seasons.map((x) => chip(`season_${x}` as StoreTextKey)), ...p.occasions.map((x) => chip(`occasion_${x}` as StoreTextKey)),
  ].filter(Boolean);
  const notes = ([['pd_top', p.notes.top], ['pd_heart', p.notes.heart], ['pd_base', p.notes.base]] as const).filter(([, l]) => l.length);
  const specs = ([
    ['pd_brand', esc(p.brand)], ['pd_size', p.sizeMl ? `${p.sizeMl} <span${dl('pd_ml')}>${arLabel('pd_ml')}</span>` : ''],
    ['pd_concentration', esc(p.concentration)], ['pd_longevity', p.longevity ? `<span data-name data-ar="${esc(localLongevity(p.longevity, 'ar'))}" data-en="${esc(localLongevity(p.longevity, 'en'))}">${esc(localLongevity(p.longevity, 'ar'))}</span>` : ''], ['pd_sku', esc(p.sku)],
  ] as const).filter(([, v]) => v);
  const ld = JSON.stringify(productJsonLd(p, o)).replace(/</g, '\\u003c');
  const breadcrumb = JSON.stringify(breadcrumbJsonLd(p, o)).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${esc(url)}"><link rel="alternate" hreflang="ar" href="${esc(url)}"><link rel="alternate" hreflang="x-default" href="${esc(url)}">
<meta property="og:type" content="product"><meta property="og:site_name" content="${esc(SITE.nameAr)}"><meta property="og:locale" content="${SITE.locale}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(ogImage)}"><meta property="og:image:alt" content="${esc(p.name.ar)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(ogImage)}">
<meta property="product:price:amount" content="${p.price}"><meta property="product:price:currency" content="EGP"><meta name="theme-color" content="${SITE.themeColor}">
<link rel="alternate" type="application/rss+xml" title="${esc(SITE.nameAr)}" href="${esc(new URL('feed.xml', o.siteUrl).href)}"><link rel="icon" href="../favicon.svg" type="image/svg+xml">
<script type="application/ld+json">${ld}</script><script type="application/ld+json">${breadcrumb}</script><style>${STYLE}</style><script>${NO_IMG_FN}</script></head>
<body><header><a href="../">صمم عطرك مع شام</a><a href="index.html"${dl('pd_index')}>كل منتجات المتجر</a></header>
<main><nav class="crumb" aria-label="مسار التنقل"><a href="${esc(homeUrl)}">الرئيسية</a> ← <a href="index.html">متجر شام</a> ← ${esc(p.name.ar)}</nav>
<div class="grid"><div class="gallery">${p.images[0] ? `<img src="${esc(img(p.images[0], o.siteUrl))}" alt="${esc(p.name.ar)}" width="800" height="800" id="main" onerror="noImg(this)">` : ''}
<div class="thumbs">${p.images.map((u, i) => `<a href="${esc(img(u, o.siteUrl))}" onclick="document.getElementById('main').src=this.href;return false"><img src="${esc(img(u, o.siteUrl))}" alt="${esc(`${p.name.ar} ${i + 1}`)}" loading="lazy" onerror="noImg(this,1)"></a>`).join('')}</div></div>
<div><h1 data-name data-ar="${esc(p.name.ar)}" data-en="${esc(p.name.en)}">${esc(p.name.ar)}</h1>${p.name.en !== p.name.ar ? `<div class="en">${esc(p.name.en)}</div>` : ''}
<p class="price" data-price="${p.price}">${esc(egp(p.price))}</p><p>${p.inStock ? `✅ <span${dl('pd_in_stock')}>متوفر</span>` : `⛔ <span${dl('sf_out_of_stock')}>غير متوفر حالياً</span>`}</p>
<div class="chips">${chips.join('')}</div>
<a class="btn" href="${store}"${dl('pd_shop_cta')}>أضف للسلة واطلب من المتجر</a><a class="btn alt" href="${store}"${dl('pd_ask_shaheen')}>اسأل شاهين عن العطر</a>
${specs.length ? `<section><table class="specs">${specs.map(([k, v]) => `<tr><td${dl(k as StoreTextKey)}>${arLabel(k as StoreTextKey)}</td><td>${v}</td></tr>`).join('')}</table></section>` : ''}
</div></div>
${notes.length ? `<section><h2${dl('pd_notes_pyramid')}>الهرم العطري</h2><div class="notes">${notes.map(([k, l]) => `<div><b${dl(k)}>${arLabel(k)}</b>${esc(l.join('، '))}</div>`).join('')}</div></section>` : ''}
<section><h2${dl('pd_description')}>الوصف</h2><p data-name data-ar="${esc(p.description.ar)}" data-en="${esc(p.description.en || p.description.ar)}">${esc(p.description.ar)}</p></section>
<p class="small">آخر تحديث لبيانات المنتج: ${esc((p.createdAt || new Date().toISOString()).slice(0, 10))} · <a href="../">كل أدوات المعمل</a> · <a href="../tools/">أدوات شام</a></p>
${related.length ? `<section><h2${dl('pd_related')}>قد يعجبك أيضاً</h2><div class="cards">${related.map(card).join('')}</div></section>` : ''}
</main><footer${dl('pd_footer')}>متجر شام — راجع «الخبير شاهين» بيانات هذا المنتج<nav><a href="../">الرئيسية</a><a href="index.html">كل المنتجات</a><a href="../tools/">الأدوات</a></nav></footer>${SWITCHER(JSON.stringify(pageLabelTable()).replace(/</g, '\\u003c'))}</body></html>
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
  const title = `كل منتجات متجر شام (${products.length})`;
  const brands = [...new Set(products.map((p) => p.brand).filter((b) => b && b !== 'Unknown'))];
  // A real summary (the full-site SEO check found a 54-character description and no structured data here).
  const desc = `كل عطور متجر شام في صفحة واحدة: ${products.length} منتج بالصور والأسعار والنوتات المنشورة${brands.length ? ` من ${brands.length} علامة منها ${brands.slice(0, 3).join(' و')}` : ''}.`;
  const ogImage = new URL(SITE.ogImage, o.siteUrl).href;
  const ld = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, description: desc, url, inLanguage: 'ar',
    isPartOf: { '@type': 'WebSite', name: SITE.nameAr, url: o.siteUrl },
    breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE.nameAr, item: o.siteUrl }, { '@type': 'ListItem', position: 2, name: 'متجر شام', item: url },
    ] },
    mainEntity: { '@type': 'ItemList', numberOfItems: products.length, itemListElement: products.slice(0, 100).map((p, i) => ({
      '@type': 'ListItem', position: i + 1, url: new URL(`p/${p.slug}.html`, o.siteUrl).href, name: p.name.ar,
    })) },
  }).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${esc(url)}"><link rel="alternate" hreflang="ar" href="${esc(url)}"><link rel="alternate" hreflang="x-default" href="${esc(url)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="${esc(SITE.nameAr)}"><meta property="og:locale" content="${SITE.locale}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(ogImage)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(ogImage)}">
<script type="application/ld+json">${ld}</script>
<style>${STYLE}</style><script>${NO_IMG_FN}</script></head>
<body><header><a href="../">صمم عطرك مع شام</a><a href="../#store">افتح المتجر</a></header>
<main><h1><span${dl('pd_index')}>كل منتجات المتجر</span> (${products.length})</h1><h2${dl('sf_all')}>الكل</h2><div class="cards">${products.map(card).join('')}</div></main>
<footer${dl('sf_store_name')}>متجر شام</footer>${SWITCHER(JSON.stringify(pageLabelTable()).replace(/</g, '\\u003c'))}</body></html>
`;
}

/** Same closeness rule as the in-store «قد يعجبك أيضاً». */
export function relatedTo(p: StoreProduct, all: StoreProduct[], n = 4) {
  const score = (b: StoreProduct) => b.families.filter((f) => p.families.includes(f)).length * 3 + (p.gender && p.gender === b.gender ? 2 : 0)
    + (p.brand && p.brand === b.brand ? 1 : 0) + (Math.abs(p.price - b.price) <= p.price * 0.3 ? 1 : 0);
  return all.filter((b) => b.sku !== p.sku).map((b) => ({ b, s: score(b) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, n).map((x) => x.b);
}
