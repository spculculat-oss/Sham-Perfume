/**
 * Writes «صفحة لكل منتج» into a built site: <out>/p/<slug>.html for every product and <out>/p/index.html.
 *   node --import tsx scripts/product-pages.mts docs https://spculculat-oss.github.io/Sham-Perfume/
 *   node --import tsx scripts/product-pages.mts dist https://sham-perfume-49bf.vercel.app/
 * Uses the same data as the store page: src/data/products.json + Shaheen's src/data/live/store-catalog.json.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { mergeCatalog, type RawProduct, type StoreCatalogFile } from '../src/utils/storeCatalog';
import { relatedTo, renderIndexPage, renderProductPage } from './product-pages/render';

const [outArg = 'dist', siteArg] = process.argv.slice(2);
const env = process.env;
// GitHub Pages (docs/) or Vercel (dist/): the public address used in canonical links and share previews.
const siteUrl = (siteArg || (outArg.startsWith('docs')
  ? env.PAGES_SITE_URL || 'https://spculculat-oss.github.io/Sham-Perfume/'
  : env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}/` : 'https://sham-perfume-49bf.vercel.app/')).replace(/\/?$/, '/');
const root = new URL('../', import.meta.url);
const json = <T,>(path: string): T => JSON.parse(readFileSync(new URL(path, root), 'utf8')) as T;
const products = json<{ products?: RawProduct[] }>('src/data/products.json').products || [];
let catalog: StoreCatalogFile | undefined;
try { catalog = json<StoreCatalogFile>('src/data/live/store-catalog.json'); } catch { catalog = undefined; }
const list = mergeCatalog(products, catalog);

const out = new URL(`${outArg.replace(/\/?$/, '/')}p/`, root);
mkdirSync(out, { recursive: true });
for (const p of list) writeFileSync(new URL(`${p.slug}.html`, out), renderProductPage(p, relatedTo(p, list), { siteUrl }));
writeFileSync(new URL('index.html', out), renderIndexPage(list, { siteUrl }));
console.log(`Product pages: ${list.length} pages + index in ${outArg}/p/ (${siteUrl})`);
