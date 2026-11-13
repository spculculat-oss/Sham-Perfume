import { callEngine, engineStatuses } from './core/engines';
import { SHAHEEN_MODE_ORDER, SHAHEEN_SITE_SETTINGS } from './config/shaheen';
import type { ShaheenSettings } from './core/types';
import { ChatError, ENGINE_INFO, systemInstruction, type ChatRequest, type ChatAnswer } from './shaheen';

export interface AgentModelOptions {
  env?: Record<string, string | undefined>; fetch?: typeof fetch; signal?: AbortSignal;
  totalTimeoutMs?: number; systemSuffix?: string; settings?: ShaheenSettings;
}
export type AgentModelCall = (input: ChatRequest, options: AgentModelOptions) => Promise<Pick<ChatAnswer, 'reply' | 'engine'>>;

/** Reuse the current engine adapters and admin settings, without the normal chat's
 * memory/quick-answer/polishing layers rewriting the agent's JSON protocol. */
export const callAgentModel: AgentModelCall = async (input, options) => {
  const env = options.env || process.env;
  const settings = options.settings || SHAHEEN_SITE_SETTINGS;
  if (!settings.enabled) throw new ChatError(503, 'SHAHEEN_DISABLED', 'Shaheen is disabled');
  const statuses = engineStatuses(env);
  const available = settings.engines.flatMap((id) => {
    const engine = statuses.find((candidate) => candidate.id === id);
    return engine?.configured ? [{ ...engine, id }] : [];
  });
  const requested = settings.allowVisitorChoice ? input.model : 'auto';
  const order = requested === 'fast' || requested === 'deep' ? SHAHEEN_MODE_ORDER[requested] : settings.engines;
  // Council is not silently approximated as a single-model tool session.
  if (requested === 'council') throw new ChatError(400, 'INVALID_AGENT_REQUEST', 'Use auto, fast or deep for tool mode');
  const candidates = ['auto', 'fast', 'deep'].includes(requested)
    ? order.flatMap((id) => available.find((engine) => engine.id === id) || [])
    : available.filter((engine) => engine.id === requested);
  if (!candidates.length) throw new ChatError(503, 'PROVIDER_NOT_CONFIGURED', 'No configured model available');
  const total = AbortSignal.any([AbortSignal.timeout(options.totalTimeoutMs || 38000), ...(options.signal ? [options.signal] : [])]);
  let code = 'PROVIDER_UNAVAILABLE';
  // No independent retry: every underlying HTTP attempt is counted by executeAgent's shared budget.
  for (const engine of candidates) {
    if (total.aborted) break;
    const signal = AbortSignal.any([total, AbortSignal.timeout(12000)]);
    let model = settings.models[engine.id] || engine.model;
    try {
      const reply = await callEngine(engine.id, systemInstruction(input.language, settings.instructions, undefined, input) + (options.systemSuffix || ''),
        [...input.conversationHistory, { role: 'user', text: input.message }], {
          env, fetch: options.fetch, signal, temperature: settings.temperature, model,
          maxTokens: settings.maxTokens, maxChars: 32000, onModel: (actual) => { model = actual; },
          onFailure: (_failure, status) => { code = status === 429 ? 'PROVIDER_RATE_LIMITED' : status === 401 || status === 403
            ? 'PROVIDER_AUTH_FAILED' : status === 404 ? 'PROVIDER_MODEL_UNAVAILABLE' : 'PROVIDER_UNAVAILABLE'; },
        });
      if (signal.aborted) { code = 'PROVIDER_TIMEOUT'; continue; }
      if (reply?.trim()) return { reply, engine: { id: engine.id, provider: engine.id, name: ENGINE_INFO[engine.id].name,
        badge: ENGINE_INFO[engine.id].name, model, accentColor: ENGINE_INFO[engine.id].color } };
    } catch { if (signal.aborted) code = 'PROVIDER_TIMEOUT'; }
  }
  if (total.aborted || code === 'PROVIDER_TIMEOUT') throw new ChatError(504, 'PROVIDER_TIMEOUT', 'Agent request timed out or cancelled');
  throw new ChatError(503, code, 'The model did not return an agent action');
};
