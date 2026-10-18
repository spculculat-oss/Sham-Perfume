/**
 * Server-side home of «منارة شاهين»: loads its state from Sham's store (falling back to the published
 * live file), runs a cycle on demand from the admin panel with the same engines as the rest of the site,
 * and serves the live SEO files (sitemap, robots, llms.txt, feed) for the Node/Vercel deployment.
 */
import bundledSeo from '../../src/data/live/seo-agent.json';
import { canonicalSiteUrl, SITE } from '../../src/seo/site';
import { buildSitemapEntries, renderFeed, renderLlmsTxt, renderRobots, renderSitemap } from '../../src/seo/artifacts';
import { emptyPagesFile, publishedPages, readPagesFile, readSeoState, type SeoPagesFile, type SeoState } from '../../src/seo/agentState';
import type { Repository } from '../core/repository';
import type { ModelEngineId } from '../core/types';
import { callEngine, engineStatuses } from '../core/engines';
import { supervisorGuidance } from '../core/liveData';
import { runSeoCycle, type SeoAsk, type CycleResult } from './agent';
import type { LiveAudit } from './auditLive';
import { productRefs } from './products';

type Env = Record<string, string | undefined>;
interface ServiceOptions { repo: Repository; env?: Env; fetch?: typeof fetch }
export interface SeoRunResult extends CycleResult { engine?: string }

export function createSeoService({ repo, env = process.env, fetch: customFetch }: ServiceOptions) {
  const request = customFetch || fetch;
  const siteUrl = canonicalSiteUrl(env);
  let running: Promise<SeoRunResult> | undefined;

  const loadState = async (): Promise<SeoState> => readSeoState((await repo.seoState()) || (bundledSeo as unknown), new Date());
  const pagesFile = async (): Promise<SeoPagesFile> => publishedPages(await loadState(), emptyPagesFile(), new Date());

  /** Ask with the admin engine policy; returns the first engine that answers and remembers its label. */
  const makeAsk = async (): Promise<{ ask: SeoAsk; engine: () => string | undefined } | undefined> => {
    const settings = await repo.settings();
    const statuses = engineStatuses(env);
    const ready = settings.enginePolicy.filter((id): id is ModelEngineId => id !== 'sham_local' && Boolean(statuses.find((s) => s.id === id)?.configured));
    if (!ready.length) return undefined;
    let last: string | undefined;
    const ask: SeoAsk = async (system, prompt) => {
      for (const id of ready) {
        try {
          const text = await callEngine(id, system, [{ role: 'user', text: prompt }], {
            env, fetch: customFetch, temperature: 0.25, maxTokens: 7000, maxChars: 80_000,
            signal: AbortSignal.timeout(120_000),
          });
          if (text?.trim()) { last = id; return text; }
        } catch { /* next engine */ }
      }
      throw new Error('no AI engine answered');
    };
    return { ask, engine: () => last };
  };

  async function run(options: { submit?: boolean; trigger?: 'admin' | 'schedule' | 'manual'; liveAudit?: LiveAudit } = {}): Promise<SeoRunResult> {
    if (running) throw new Error('A SEO cycle is already running.');
    running = (async () => {
      const state = await loadState();
      const ai = await makeAsk();
      const guidance = await supervisorGuidance('seo_agent', env, request).catch(() => '');
      const result = await runSeoCycle({
        state, pagesFile: await pagesFile(), siteUrl, env, fetch: request,
        ask: ai?.ask, guidance, submit: options.submit ?? false, trigger: options.trigger || 'admin',
        liveAudit: options.liveAudit,
        log: (line) => console.log(`[SEO] ${line}`),
      });
      if (ai) result.state.engines.lastEngine = ai.engine();
      await repo.saveSeoState(result.state);
      return { ...result, engine: ai?.engine() };
    })().finally(() => { running = undefined; });
    return running;
  }

  return {
    siteUrl,
    loadState,
    pagesFile,
    run,
    busy: () => Boolean(running),
    async sitemap() {
      const entries = buildSitemapEntries({ siteUrl, products: productRefs(), now: new Date() });
      return renderSitemap(entries);
    },
    async robots() { return renderRobots(siteUrl); },
    async llms() { return renderLlmsTxt(siteUrl, productRefs()); },
    async feed() { return renderFeed({ siteUrl, products: productRefs() as unknown as { id: string | number; slug: string; nameAr?: string }[], now: new Date() }); },
    /** How many URLs the live sitemap carries (shown in the admin panel). */
    sitemapCount: () => buildSitemapEntries({ siteUrl, products: productRefs(), now: new Date() }).length,
    keyFile: () => SITE.indexNowKey,
    pagesFileFallback: emptyPagesFile,
    readPagesFile,
  };
}

export type SeoService = ReturnType<typeof createSeoService>;
