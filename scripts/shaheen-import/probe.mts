/**
 * TEMP probe: how do the supplier sites answer from GitHub Actions? (platform, APIs, sitemap, JSON-LD)
 */
const SITES = (process.env.PROBE_SITES || 'https://www.shamperfume.com,https://shamperfume.com,https://shamaperfumes.com,https://www.shamaperfumes.com').split(',');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const clean = (t: string) => t.replace(/[\r\n%]/g, ' ').replace(/\s+/g, ' ').slice(0, 900);
const note = (title: string, msg: string) => console.log(`::notice title=${title}::${clean(msg)}`);

async function get(url: string) {
  const start = Date.now();
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/json,*/*', 'Accept-Language': 'ar,en;q=0.8' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    const body = await r.text();
    return { status: r.status, url: r.url, type: r.headers.get('content-type') || '', server: `${r.headers.get('server') || ''} ${r.headers.get('x-powered-by') || ''}`, body, ms: Date.now() - start };
  } catch (e) { return { status: 0, url, type: '', server: '', body: String((e as Error).cause || (e as Error).message), ms: Date.now() - start }; }
}

for (const site of SITES) {
  const home = await get(site);
  const b = home.body;
  const hints = ['cdn.shopify', 'Shopify.theme', 'wp-content', 'woocommerce', 'salla', 'zid.sa', 'Magento', 'expandcart', 'youcan', 'wix', 'squarespace', 'next/static', 'laravel', 'opencart', 'route=product', 'catalog/view'].filter((h) => b.toLowerCase().includes(h.toLowerCase()));
  const links = [...new Set([...b.matchAll(/href="([^"#]+)"/g)].map((m) => m[1]))].filter((h) => /product|perfume|عطر|shop|collection|category|item/i.test(h)).slice(0, 25);
  note(`HOME ${site}`, `${home.status} → ${home.url} | ${home.ms}ms | ${home.type} | server=${home.server} | ${b.length} bytes | hints=${hints.join(',')} | title=${(b.match(/<title[^>]*>([^<]*)/i) || [])[1] || ''} | links=${links.join(' ')}${home.status === 0 ? ` | error=${b}` : ''}`);
  if (home.status === 0) continue;
  const origin = new URL(home.url).origin;
  for (const path of ['/products.json?limit=3', '/wp-json/wc/store/v1/products?per_page=2', '/sitemap.xml', '/robots.txt', '/perfumes', '/perfumes/kenz-de-rasasi', '/sitemap_index.xml', '/product-sitemap.xml']) {
    const r = await get(origin + path);
    const ld = (r.body.match(/application\/ld\+json/g) || []).length;
    const sample = r.type.includes('json') || path.endsWith('.xml') || path.endsWith('.txt') ? r.body.slice(0, 600) : `ld=${ld} og:image=${/og:image/.test(r.body)} price=${(r.body.match(/[\d,.]+\s*(?:ج\.?م|جنيه|EGP|LE)/i) || [])[0] || ''} links=${[...new Set([...r.body.matchAll(/href="([^"#]+)"/g)].map((m) => m[1]))].filter((h) => /product|perfume|عطر/i.test(h)).slice(0, 12).join(' ')}`;
    note(`${new URL(origin).host}${path}`.slice(0, 80), `${r.status} → ${r.url} | ${r.type} | ${r.body.length}b | ${sample}`);
  }
}
