/**
 * One scheduled cycle of «منارة شاهين» from CI or a developer machine.
 *
 *   node --import tsx scripts/seo-agent/run.mts
 *
 * Reads the published state, audits the real deployment, studies the next lesson, applies only copy
 * that passes the guardrails, asks the configured engine for Shaheen's review, submits changed URLs to
 * search engines when SEO_SUBMIT=1, then writes the state and page overrides back. Publishing the two
 * JSON files is the workflow's job (scripts/ci/publish.mjs), never this script's.
 *
 * Env: SEO_SITE_URL (defaults to the main site on GitHub Pages), SEO_SUBMIT=1, SEO_ENGINE_ORDER
 * (comma-separated ids, default gemini,perplexity,deepseek,openai,claude,openrouter,self_hosted) and the engine
 * API keys the site already uses. With no key the cycle still audits, studies and plans.
 */
import { readFileSync, renameSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { callEngine, engineStatuses } from '../../server/core/engines';
import { supervisorGuidance } from '../../server/core/liveData';
import { runSeoCycle, type SeoAsk } from '../../server/seo/agent';
import { readPagesFile, readSeoState } from '../../src/seo/agentState';
import { canonicalSiteUrl } from '../../src/seo/site';
import type { ModelEngineId } from '../../server/core/types';
import { withHandbook } from '../../src/utils/botHandbook';

const env = process.env;
const root = new URL('../..', import.meta.url);
const statePath = new URL('src/data/live/seo-agent.json', root);
const pagesPath = new URL('src/data/live/seo-pages.json', root);
const log = (line: string) => console.log(`[SEO] ${line}`);
const readJson = (url: URL): unknown => {
  try { return JSON.parse(readFileSync(url, 'utf8')); } catch { return undefined; }
};
const writeJson = (url: URL, value: unknown) => {
  mkdirSync(dirname(fileURLToPath(url)), { recursive: true });
  const text = `${JSON.stringify(value, null, 2)}\n`;
  let current = '';
  try { current = readFileSync(url, 'utf8'); } catch { /* new file */ }
  if (current === text) return false;
  const tmp = `${fileURLToPath(url)}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, fileURLToPath(url));
  return true;
};

const DEFAULT_ORDER = 'gemini,perplexity,deepseek,openai,claude,openrouter,self_hosted';
const wanted = (env.SEO_ENGINE_ORDER || DEFAULT_ORDER).split(',').map((id) => id.trim()).filter(Boolean);
const configured = new Set(engineStatuses(env).filter((status) => status.configured && status.id !== 'sham_local').map((status) => status.id));
const order = wanted.filter((id): id is ModelEngineId => configured.has(id as ModelEngineId)) as ModelEngineId[];
let lastEngine: string | undefined;

const ask: SeoAsk | undefined = order.length
  ? async (system, prompt) => {
      for (const id of order) {
        try {
          const text = await callEngine(id, withHandbook('seo', system), [{ role: 'user', text: prompt }], {
            env, temperature: 0.25, maxTokens: 7000, maxChars: 80_000,
            signal: AbortSignal.timeout(120_000),
          });
          if (text?.trim()) { lastEngine = id; return text; }
        } catch { /* try the next configured engine */ }
      }
      throw new Error('no configured engine answered');
    }
  : undefined;

const siteUrl = canonicalSiteUrl(env);
const submit = /^(1|true|yes|on)$/i.test(env.SEO_SUBMIT || '');
const state = readSeoState(readJson(statePath), new Date());
const pagesFile = readPagesFile(readJson(pagesPath));
const guidance = await supervisorGuidance('seo_agent', env).catch(() => '');

log(`الموقع ${siteUrl} · المرحلة ${state.trust.level} · الإرسال ${submit ? 'مفعّل' : 'متوقف'} · المحركات ${order.join(',') || 'لا يوجد (فحص فقط)'}`);

try {
  const result = await runSeoCycle({
    state, pagesFile, siteUrl, env, ask, engine: lastEngine, guidance, submit,
    trigger: 'schedule', now: new Date(), log,
  });
  const stateChanged = writeJson(statePath, result.state);
  const pagesChanged = writeJson(pagesPath, result.pagesFile);
  log(`الحالة: ${result.summary} · التالي ${result.next}`);
  for (const submission of result.submissions) {
    log(`إرسال: ${submission.ok ? 'تم' : 'لم يتم'} — ${submission.detail}`);
  }
  log(stateChanged || pagesChanged ? 'حُفظت نتائج الدورة في src/data/live.' : 'لا تغيير في ملفات الحالة.');
} catch (error) {
  log(`فشلت الدورة: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
