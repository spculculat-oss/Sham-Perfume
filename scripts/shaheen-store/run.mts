/**
 * «شاهين يدرّب المتجر» — GitHub Actions runs this every 12 hours (.github/workflows/shaheen-news.yml):
 *   node --import tsx scripts/shaheen-store/run.mts
 * Audits src/data/products.json, has «الخبير شاهين» rewrite new/changed/weak products and writes
 * src/data/live/store-catalog.json (read by the store page on GitHub Pages and Vercel, and by the store advisor).
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { guidanceBlock } from '../../src/utils/aiTools';
import type { RawProduct, StoreCatalogFile, StoreEntry } from '../../src/utils/storeCatalog';
import { BATCH, buildCatalogFile, entriesFromShaheen, parseJson, staleProducts, STORE_SYSTEM, storePrompt } from './curate';
import { makeAsk, QuotaExhaustedError, quotaBook } from '../doctor/agent';

const env = process.env;
const DIR = new URL('../../src/data/live/', import.meta.url);
const FILE = new URL('store-catalog.json', DIR);
const read = <T,>(url: URL): T | undefined => { try { return existsSync(url) ? JSON.parse(readFileSync(url, 'utf8')) as T : undefined; } catch { return undefined; } };
const products = read<{ products?: RawProduct[] }>(new URL('../products.json', DIR))?.products || [];
const previous = read<StoreCatalogFile>(FILE);
const supervisor = read<{ tools?: Record<string, { guidance?: { text?: string } }> }>(new URL('ai-supervisor.json', DIR));
const SYSTEM = STORE_SYSTEM + guidanceBlock(supervisor?.tools?.store_catalog?.guidance?.text);
const now = new Date();
const log: string[] = [];
const say = (line: string) => { console.log(line); log.push(line); };

// Works with whatever AI quota is available now: as many batches as the packages allow (STORE_MAX_BATCHES),
// and when they run out it stops, saves when they renew (ai-quota.json) and the next run continues.
const maxBatches = Math.max(1, Number(env.STORE_MAX_BATCHES) || 4);
const stale = staleProducts(products, previous, BATCH * maxBatches);
const pendingAll = staleProducts(products, previous, Number.MAX_SAFE_INTEGER).length;
say(`Products: ${products.length}; waiting for Shaheen: ${pendingAll}; this run up to ${stale.length}`);
const fresh: Record<string, StoreEntry> = {};
const quota = quotaBook(new URL('ai-quota.json', DIR));
let ask: Awaited<ReturnType<typeof makeAsk>>;
try { ask = await makeAsk(env, { quota }); } catch { ask = undefined; }
let resumeAt = 0;
if (ask && stale.length) {
  for (let i = 0; i < stale.length; i += BATCH) {
    const batch = stale.slice(i, i + BATCH);
    try {
      const got = entriesFromShaheen(parseJson(await ask(SYSTEM, storePrompt(batch))), batch, now.toISOString());
      Object.assign(fresh, got);
      say(`Shaheen rewrote ${Object.keys(got).length}/${batch.length} products`);
    } catch (error) {
      if (error instanceof QuotaExhaustedError) { resumeAt = error.resumeAt; break; }
      say(`Batch skipped (${(error as Error).message.slice(0, 120)})`);
    }
  }
} else say(ask ? 'Every product is already trained' : 'No AI engine configured: rule-based clean-up only');
const left = Math.max(0, pendingAll - Object.keys(fresh).length);
if (resumeAt) say(`AI packages used up: ${left} products wait for the renewal at ${new Date(resumeAt).toISOString()} (rule-based text until then)`);
else if (left) say(`${left} products left for the next run`);
quota.save();

const file = buildCatalogFile(products, previous, fresh, now);
mkdirSync(DIR, { recursive: true });
writeFileSync(FILE, `${JSON.stringify(file, null, 1)}\n`);
const byShaheen = Object.values(file.entries).filter((e) => e.editor === 'shaheen').length;
say(`Catalog: ${byShaheen}/${products.length} products written by Shaheen; ${file.audit.issues.length} products with data issues`);

if (env.GITHUB_STEP_SUMMARY) {
  const issues = file.audit.issues.slice(0, 15).map((i) => `- **${i.sku}**: ${i.issues.join('، ')}`);
  appendFileSync(env.GITHUB_STEP_SUMMARY, `## شاهين يدرّب متجر شام — ${now.toISOString()}\n\n${log.map((l) => `- ${l}`).join('\n')}\n\n### مشاكل بيانات التجار\n${issues.join('\n') || 'لا يوجد'}\n`);
}
if (env.GITHUB_ACTIONS) {
  const clean = (t: string) => t.replace(/[\r\n%]/g, ' ').slice(0, 400);
  console.log(`::notice title=Shaheen store::${clean(log.join(' | '))}`);
  const sample = Object.entries(fresh).slice(0, 3).map(([sku, e]) => `${sku}: ${e.nameAr} — ${e.families.join('/')} — ${e.descriptionAr.slice(0, 90)}`);
  if (sample.length) console.log(`::notice title=Store samples::${clean(sample.join(' || '))}`);
}
