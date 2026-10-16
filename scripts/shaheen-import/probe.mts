/**
 * TEMP probe: what a shamperfume.com product page and its sitemap contain.
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const clean = (t: string) => t.replace(/[\r\n%]/g, ' ').replace(/\s+/g, ' ').slice(0, 1000);
const note = (title: string, msg: string) => console.log(`::notice title=${title}::${clean(msg)}`);
const get = async (url: string) => {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' }, signal: AbortSignal.timeout(20000) });
  return { status: r.status, body: await r.text(), type: r.headers.get('content-type') || '' };
};
const mode = process.env.PROBE_MODE || 'product';
const BASE = 'https://www.shamperfume.com';

if (mode === 'sitemap') {
  for (const s of ['sitemap-static.xml', 'sitemap-perfumes-1.xml', 'sitemap-perfumes-2.xml', 'sitemap-perfumes-3.xml']) {
    const r = await get(`${BASE}/${s}`);
    const locs = [...r.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const imgs = (r.body.match(/<image:loc>/g) || []).length;
    note(s, `${r.status} | ${locs.length} urls, ${imgs} image tags | first: ${locs.slice(0, 6).join(' ')} | sample xml: ${r.body.slice(0, 500)}`);
  }
  const idx = await get(`${BASE}/sitemap.xml`);
  note('sitemap index', [...idx.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).join(' '));
} else {
  const url = process.env.PROBE_URL || `${BASE}/perfumes/kenz-de-rasasi/hawas-for-him-le-parfum/`;
  const r = await get(url);
  const b = r.body;
  note('page', `${r.status} ${url} ${b.length}b | title=${(b.match(/<title[^>]*>([^<]*)/i) || [])[1]} | lang=${(b.match(/<html[^>]*lang="([^"]+)/) || [])[1]}`);
  const lds = [...b.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  lds.forEach((ld, i) => { if (ld.includes('"Product"')) { const j = JSON.parse(ld); note('offers', JSON.stringify(j.offers).slice(0, 1000)); note('product keys', `${Object.keys(j).join(',')} | brand=${JSON.stringify(j.brand)} | images=${(j.image || []).length} | sku=${j.sku} | rating=${JSON.stringify(j.aggregateRating)} | props=${JSON.stringify(j.additionalProperty || '').slice(0, 400)}`); note('desc tail', String(j.description).slice(-700)); } });
  const metas = [...b.matchAll(/<meta[^>]+(?:property|name)="((?:og|product|twitter):[^"]+|description)"[^>]+content="([^"]*)"/g)].map((m) => `${m[1]}=${m[2]}`);
  note('meta', metas.join(' | '));
  const imgs = [...new Set([...b.matchAll(/(?:src|data-src|href)="(https?:[^"]+\.(?:jpe?g|png|webp|avif)[^"]*)"/gi)].map((m) => m[1]))];
  note('images', `${imgs.length}: ${imgs.slice(0, 12).join(' ')}`);
  const text = b.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const i = text.search(/RM\s?\d/);
  note('text', `prices: ${(text.match(/RM\s?[\d,.]+/g) || []).slice(0, 10).join(', ')} | around: ${text.slice(Math.max(0, i - 300), i + 500)}`);
  const desc = text.search(/Notes|Top|Description|Fragrance/i);
  note('text2', text.slice(desc, desc + 900));
  const islands = [...b.matchAll(/<astro-island[^>]*component-url="([^"]+)"[^>]*props="([^"]{0,600})/g)].map((m) => `${m[1]} :: ${m[2].replace(/&quot;/g, '"')}`);
  note('islands', islands.slice(0, 4).join(' || ') || 'none');
}
