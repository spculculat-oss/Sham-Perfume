/**
 * «ربط المنطقيات وسلاسل الأدوات» — يدير تنفيذ سلاسل الأدوات وفق النية والخدمة،
 * مع إعادة المحاولة عند الأعطال العابرة، وإعادة التخطيط الذكي (Cognitive Re-plan)
 * عندما لا تكفي الأداة الأولى وحدها للإجابة الموثقة.
 */
import type { Repository } from './repository';
import { runToolWithRetry, tools, type ToolResult } from './tools';
import type { ServiceDef } from './types';
import { clampConfidence } from './confidence';

export interface ChainExecutionContext {
  query: string;
  rawMessage: string;
  entities: Record<string, string | number | undefined>;
  service?: ServiceDef;
  lastRequestRef?: string;
  /** Same environment the orchestrator runs with, so the storefront tools read one catalog. */
  env?: Record<string, string | undefined>;
}

export interface ChainStepRecord {
  tool: keyof typeof tools;
  result: ToolResult;
  confidence: number;
  ms: number;
  replanned?: boolean;
}

export interface ChainResult {
  steps: ChainStepRecord[];
  plannedTools: string[];
  replannedTools: string[];
  overallConfidence: number;
  failedSteps: string[];
}

interface PlannedToolCall {
  tool: keyof typeof tools;
  args: unknown;
  weight: number;
}

/** يبني الخطة الأولية لسلسلة الأدوات بما يطابق سياسة الأمان في Sham Core. */
export function buildPrimaryPlan(intent: string, ctx: ChainExecutionContext): PlannedToolCall[] {
  const plan: PlannedToolCall[] = [];
  switch (intent) {
    case 'greeting':
    case 'thanks':
    case 'identity':
    case 'memory_view':
    case 'forget':
      break;
    case 'list_services':
      plan.push({ tool: 'list_services', args: {}, weight: 1.0 });
      break;
    case 'track_order':
      plan.push({
        tool: 'track_order',
        args: { ref: ctx.entities.ref || ctx.lastRequestRef, contact: ctx.entities.email || ctx.entities.phone },
        weight: 1.0,
      });
      break;
    case 'calculate':
      plan.push({
        tool: 'calc_concentration',
        args: { volumeMl: ctx.entities.volumeMl, percent: ctx.entities.percent },
        weight: 1.0,
      });
      break;
    case 'browse_products':
      plan.push({ tool: 'search_catalog', args: { query: ctx.query, maxPrice: typeof ctx.entities.budget === 'number' ? ctx.entities.budget : undefined }, weight: 0.6 });
      // The storefront (products.json + Shaheen's enrichment) is what a visitor can actually buy; the catalog
      // above is the merchant's own rows and may be empty.
      plan.push({ tool: 'search_store', args: { query: ctx.query }, weight: 0.3 });
      plan.push({ tool: 'store_overview', args: {}, weight: 0.1 });
      if (ctx.service) plan.push({ tool: 'prepare_request_form', args: { service: ctx.service }, weight: 0.2 });
      break;
    case 'service_request':
      if (ctx.service?.kind === 'store') {
        plan.push({ tool: 'search_catalog', args: { query: ctx.query, maxPrice: typeof ctx.entities.budget === 'number' ? ctx.entities.budget : undefined }, weight: 0.35 });
        // The store form must list what the shop really sells: the live storefront next to the internal rows.
        plan.push({ tool: 'search_store', args: { query: ctx.query }, weight: 0.3 });
      }
      if (ctx.service) plan.push({ tool: 'prepare_request_form', args: { service: ctx.service }, weight: 0.35 });
      plan.push({ tool: 'retrieve_knowledge', args: { query: ctx.query }, weight: 0.2 });
      break;
    case 'handoff':
      if (ctx.service) plan.push({ tool: 'prepare_request_form', args: { service: ctx.service }, weight: 1.0 });
      break;
    case 'platform_help':
      // Search the guide with the feature's own name so the citation is the right page, not a stray match.
      plan.push({ tool: 'retrieve_knowledge', args: { query: ctx.query }, weight: 1.0 });
      break;
    default:
      plan.push({ tool: 'retrieve_knowledge', args: { query: ctx.query }, weight: 1.0 });
      break;
  }
  return plan;
}

/** يقيس ثقة مخرجات كل أداة بشكل حتمي. */
export function scoreToolResult(toolName: string, result: ToolResult): number {
  const obs = result.observation || '';
  if (!obs || obs === 'NO_RESULTS' || obs === 'CATALOG_EMPTY' || obs === 'INVALID_INPUT') return 0.2;
  if (obs === 'NEED_REF_AND_CONTACT' || obs === 'NOT_FOUND_OR_CONTACT_MISMATCH') return 0.4;
  if (obs.startsWith('NO_MATCH_SHOWING_LATEST')) return 0.5;
  if (toolName === 'retrieve_knowledge' && Array.isArray(result.data) && result.data.length > 0) return 0.9;
  return 0.9;
}

/**
 * ينفذ الخطة الأولية ثم يراجع النتائج؛ وإذا كشفت الملاحظات فجوة يمكن سدّها بأداة مساندة
 * (إعادة تخطيط ذكية / Multi-pass Re-plan) يشغّل الأداة المساندة تلقائياً.
 */
export async function executeCognitiveChain(
  intent: string,
  ctx: ChainExecutionContext,
  repo: Repository,
  lang: 'ar' | 'en',
): Promise<ChainResult> {
  const primary = buildPrimaryPlan(intent, ctx);
  const steps: ChainStepRecord[] = [];
  const failedSteps: string[] = [];
  const replannedTools: string[] = [];
  let weightSum = 0;
  let weightedScore = 0;

  const runStep = async (call: PlannedToolCall, replanned = false) => {
    const t0 = Date.now();
    try {
      const def = tools[call.tool] as unknown as { name: string; description: string; run: (a: unknown, c: { repo: Repository; message: string; lang: 'ar' | 'en'; env?: Record<string, string | undefined> }) => Promise<ToolResult> };
      const result = await runToolWithRetry(def, call.args, { repo, message: ctx.rawMessage, lang, env: ctx.env }, 1);
      const confidence = scoreToolResult(call.tool, result);
      steps.push({ tool: call.tool, result, confidence, ms: Date.now() - t0, ...(replanned ? { replanned: true } : {}) });
      weightSum += call.weight;
      weightedScore += confidence * call.weight;
      if (confidence <= 0.2) failedSteps.push(call.tool);
      return result;
    } catch {
      failedSteps.push(call.tool);
      weightSum += call.weight;
      return undefined;
    }
  };

  for (const call of primary) {
    await runStep(call, false);
  }

  // إعادة التخطيط الذكية (Cognitive Re-plan):
  // 1) سؤال لم يجد إجابة في المقالات المعرفية، لكنه يطابق منتجاً منشوراً في الكتالوج الفعلي (بدرجة عالية) → نربطه بالكتالوج تلقائياً
  if ((intent === 'question' || intent === 'perfume_expert') && steps.some((s) => s.tool === 'retrieve_knowledge' && s.result.observation === 'NO_RESULTS')) {
    const index = await repo.searchIndex();
    const productHit = index.search(ctx.query, 3, 1.5).some((h) => h.doc.kind === 'product');
    if (productHit) {
      replannedTools.push('search_catalog');
      await runStep({ tool: 'search_catalog', args: { query: ctx.query }, weight: 0.6 }, true);
    }
  }

  // 2) تصفح متجر لم يجد منتجاً مطابقاً في الكتالوج، نتحقق إن كانت قاعدة المعرفة تشرح بديلاً (مثل التركيب المخصص)
  if (intent === 'browse_products' && steps.some((s) => s.tool === 'search_catalog' && s.result.observation.startsWith('NO_MATCH_SHOWING_LATEST'))) {
    const index = await repo.searchIndex();
    if (index.search(ctx.query, 2, 1.8).some((h) => h.doc.kind !== 'product')) {
      replannedTools.push('retrieve_knowledge');
      await runStep({ tool: 'retrieve_knowledge', args: { query: ctx.query }, weight: 0.3 }, true);
    }
  }

  return {
    steps,
    plannedTools: primary.map((p) => p.tool),
    replannedTools,
    overallConfidence: weightSum > 0 ? clampConfidence(weightedScore / weightSum) : 1,
    failedSteps,
  };
}
