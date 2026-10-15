/**
 * Engine layer. Language models are interchangeable "renderers": they phrase an answer from the
 * context Sham's orchestrator already gathered. Business logic, data, tools and memory never
 * depend on them. Order of preference is an admin policy; `sham_local` (no model) always closes it.
 *
 *  self_hosted : any OpenAI-compatible server you run (Ollama, vLLM, LM Studio, llama.cpp server)
 *                with open-weight models such as Qwen, Llama, Mistral or DeepSeek open weights.
 *  gemini / openai / claude / deepseek : optional hosted providers (server-side keys only).
 *  openrouter  : one key, many hosted models (useful for the advisory council: different vendors per seat).
 *  sham_local  : Sham's own deterministic composer — works with zero keys and zero cost.
 */
import { createHash } from 'node:crypto';
import type { EngineId, ModelEngineId } from './types';

type Env = Record<string, string | undefined>;
export interface EngineTurn { role: 'user' | 'assistant'; text: string }
export interface EngineStatus { id: EngineId; name: string; model: string; configured: boolean; kind: 'own' | 'self_hosted' | 'hosted' }

const configured = (v?: string) => Boolean(v?.trim() && !/^(MY_|YOUR_|<)/i.test(v.trim()));

/** Tencent EdgeOne Makers model gateway (OpenAI-compatible, free monthly tokens for built-in models). */
export const EDGEONE_GATEWAY_URL = 'https://ai-gateway.edgeone.link/v1';
export const EDGEONE_DEFAULT_MODEL = '@makers/deepseek-v4-flash';

/**
 * The "self-hosted / OpenAI-compatible" engine: SHAM_LLM_BASE_URL (+ optional SHAM_LLM_API_KEY), or —
 * when only the EdgeOne gateway key exists (AI_GATEWAY_API_KEY) — Tencent's gateway with a free model.
 */
export function openCompatibleEngine(env: Env) {
  if (configured(env.SHAM_LLM_BASE_URL)) {
    return { baseUrl: env.SHAM_LLM_BASE_URL!.trim(), apiKey: configured(env.SHAM_LLM_API_KEY) ? env.SHAM_LLM_API_KEY!.trim() : '',
      model: env.SHAM_LLM_MODEL?.trim() || 'qwen2.5:7b-instruct', gateway: false };
  }
  if (configured(env.AI_GATEWAY_API_KEY)) {
    return { baseUrl: env.AI_GATEWAY_BASE_URL?.trim() || EDGEONE_GATEWAY_URL, apiKey: env.AI_GATEWAY_API_KEY!.trim(),
      model: env.SHAM_LLM_MODEL?.trim() || EDGEONE_DEFAULT_MODEL, gateway: true };
  }
  return null;
}

export function engineStatuses(env: Env = process.env): EngineStatus[] {
  const open = openCompatibleEngine(env);
  return [
    { id: 'self_hosted', name: open?.gateway ? 'Tencent EdgeOne Models' : 'Self-hosted open model', model: open?.model || env.SHAM_LLM_MODEL?.trim() || 'qwen2.5:7b-instruct', configured: Boolean(open), kind: 'self_hosted' },
    { id: 'gemini', name: 'Google Gemini', model: env.GEMINI_MODEL?.trim() || GEMINI_DEFAULT_MODEL, configured: configured(env.GEMINI_API_KEY), kind: 'hosted' },
    { id: 'openai', name: 'OpenAI', model: env.OPENAI_MODEL?.trim() || 'gpt-4o-mini', configured: configured(env.OPENAI_API_KEY), kind: 'hosted' },
    { id: 'claude', name: 'Anthropic Claude', model: env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-4-5', configured: configured(env.ANTHROPIC_API_KEY), kind: 'hosted' },
    { id: 'deepseek', name: 'DeepSeek', model: env.DEEPSEEK_MODEL?.trim() || 'deepseek-chat', configured: configured(env.DEEPSEEK_API_KEY), kind: 'hosted' },
    { id: 'openrouter', name: 'OpenRouter', model: env.OPENROUTER_MODEL?.trim() || 'openai/gpt-4o-mini', configured: configured(env.OPENROUTER_API_KEY), kind: 'hosted' },
    { id: 'sham_local', name: 'Sham Core (built-in)', model: 'rules+bm25', configured: true, kind: 'own' },
  ];
}

/**
 * Removes <think>…</think> reasoning blocks from a token stream without waiting for the
 * full answer (open reasoning models such as DeepSeek-R1 / Qwen-QwQ emit them).
 */
export class ThinkFilter {
  private buffer = '';
  private thinking = false;
  push(chunk: string): string {
    this.buffer += chunk;
    let out = '';
    for (;;) {
      if (this.thinking) {
        const end = this.buffer.indexOf('</think>');
        if (end < 0) { this.buffer = this.buffer.slice(-8); return out; }
        this.buffer = this.buffer.slice(end + 8);
        this.thinking = false;
      } else {
        const start = this.buffer.indexOf('<think>');
        if (start >= 0) { out += this.buffer.slice(0, start); this.buffer = this.buffer.slice(start + 7); this.thinking = true; continue; }
        // Keep a possible partial "<think" tag at the end for the next chunk.
        const keep = Math.max(0, ...[1, 2, 3, 4, 5, 6].filter((n) => '<think>'.startsWith(this.buffer.slice(-n))));
        out += this.buffer.slice(0, this.buffer.length - keep);
        this.buffer = this.buffer.slice(this.buffer.length - keep);
        return out;
      }
    }
  }
  flush(): string { const rest = this.thinking ? '' : this.buffer; this.buffer = ''; return rest; }
}

/** Reads a Server-Sent-Events body and yields each `data:` payload. */
async function* sseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      let index: number;
      while ((index = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, index).replace(/\r$/, '');
        pending = pending.slice(index + 1);
        if (line.startsWith('data:')) yield line.slice(5).trim();
      }
    }
    if (pending.startsWith('data:')) yield pending.slice(5).trim();
  } finally {
    reader.releaseLock();
  }
}

/**
 * Gemini 2.5+ "thinks" before answering and those hidden tokens count against maxOutputTokens, so a
 * chat budget could be spent before any visible text (empty or cut answers, long waits). Chat
 * answers here are grounded in the prompt, so thinking is switched off where the model allows it and
 * kept minimal (with extra budget on top) where it cannot be disabled.
 */
export function geminiThinking(model: string, maxTokens: number): Record<string, unknown> {
  const m = model.toLowerCase();
  if (/gemini-2\.5-pro/.test(m)) return { maxOutputTokens: maxTokens + 1024, thinkingConfig: { thinkingBudget: 128 } };
  if (/gemini-2\.5-flash/.test(m)) return { maxOutputTokens: maxTokens, thinkingConfig: { thinkingBudget: 0 } };
  if (/gemini-[3-9]/.test(m)) return { maxOutputTokens: maxTokens + 2048, thinkingConfig: { thinkingLevel: 'low' } };
  if (/gemini-(flash|pro)(-lite)?-latest/.test(m)) return { maxOutputTokens: maxTokens + 2048 };
  return { maxOutputTokens: maxTokens };
}

/** Model ids the admin may type for a council seat (provider slugs such as `qwen2.5:7b`, `anthropic/claude-sonnet-4.5`). */

/**
 * Google retires Gemini model IDs quickly (and limits old ones to projects that used them before),
 * so the default is Google's own rolling alias and a "model not found" answer triggers discovery.
 */
export const GEMINI_DEFAULT_MODEL = 'gemini-flash-latest';

interface GeminiModelInfo { name?: string; supportedGenerationMethods?: string[] }

/** Text models for chat the key can use, best first: rolling alias → newest stable Flash → Lite → previews. */
export function rankGeminiModels(models: GeminiModelInfo[]): string[] {
  const ids = models
    .filter((m) => typeof m.name === 'string' && (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => m.name!.replace(/^models\//, ''))
    .filter((id) => /^gemini-/.test(id) && !/(image|tts|live|audio|embedding|robotics|computer|vision|learnlm|aqa)/i.test(id));
  const version = (id: string) => Number(id.match(/^gemini-(\d+(?:\.\d+)?)/)?.[1] || 0);
  const rank = (id: string) => [
    /-flash/.test(id) && !/lite/.test(id) && !/(preview|exp)/.test(id),
    /-flash/.test(id) && !/(preview|exp)/.test(id),
    /-flash/.test(id),
    true,
  ].findIndex(Boolean);
  const sorted = [...ids].sort((a, b) => rank(a) - rank(b) || version(b) - version(a) || a.length - b.length);
  return ids.includes('gemini-flash-latest') ? ['gemini-flash-latest', ...sorted.filter((id) => id !== 'gemini-flash-latest')] : sorted;
}

/** Best text model for chat among those the key can use. */
export function pickGeminiModel(models: GeminiModelInfo[]): string | undefined {
  return rankGeminiModels(models)[0];
}

/**
 * Gemini quotas are per model: when one is exhausted (429), these are tried next — Lite first
 * (largest free quota), then other chat models. The model that just failed is excluded.
 */
export function geminiQuotaFallbacks(models: GeminiModelInfo[], failed: string, limit = 3): string[] {
  const ranked = rankGeminiModels(models).filter((id) => id !== failed);
  const lite = ranked.filter((id) => /lite/.test(id) && !/(preview|exp)/.test(id))
    .sort((a, b) => Number(/-latest$/.test(b)) - Number(/-latest$/.test(a)));
  return [...new Set([...lite, ...ranked])].slice(0, limit);
}

/**
 * Safe one-line reason from a provider error body, for the admin probe and the key workflow:
 * only structured fields (status, quota names and limits, retry delay) — never free-text messages.
 */
export function failureDetail(body = ''): string {
  try {
    const err = (JSON.parse(body.slice(0, 8000)) as { error?: { status?: unknown; details?: { violations?: { quotaId?: string; quotaMetric?: string; quotaValue?: string }[]; retryDelay?: string }[] } }).error;
    if (!err) return '';
    const parts: string[] = typeof err.status === 'string' && /^[A-Z_]{3,40}$/.test(err.status) ? [err.status] : [];
    for (const d of err.details || []) {
      for (const v of d.violations || []) parts.push([v.quotaId, v.quotaValue !== undefined ? `limit ${v.quotaValue}` : ''].filter(Boolean).join(' '));
      if (d.retryDelay) parts.push(`retry in ${d.retryDelay}`);
    }
    return parts.filter(Boolean).join(' · ').replace(/(AIza[\w-]{10,}|sk-[\w-]{10,}|key=[^&\s]+)/g, '[redacted]').slice(0, 400);
  } catch {
    return '';
  }
}

type GeminiCache = Map<string, { model: string; at: number; ttl?: number }>;
const geminiSubstitutes: GeminiCache = ((globalThis as { __shamGeminiModels?: GeminiCache }).__shamGeminiModels ??= new Map());
const geminiCacheKey = (apiKey: string, model: string) => `${createHash('sha256').update(apiKey).digest('hex').slice(0, 16)}:${model}`;

async function listGeminiModels(apiKey: string, request: typeof fetch, signal: AbortSignal): Promise<GeminiModelInfo[]> {
  try {
    const response = await request('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', { headers: { 'x-goog-api-key': apiKey }, signal });
    if (!response.ok) return [];
    return (await response.json() as { models?: GeminiModelInfo[] }).models || [];
  } catch {
    return [];
  }
}

async function discoverGeminiModel(apiKey: string, unavailable: string, request: typeof fetch, signal: AbortSignal): Promise<string | undefined> {
  try {
    const models = await listGeminiModels(apiKey, request, signal);
    const picked = pickGeminiModel(models.filter((m) => m.name?.replace(/^models\//, '') !== unavailable));
    if (picked) geminiSubstitutes.set(geminiCacheKey(apiKey, unavailable), { model: picked, at: Date.now() });
    return picked;
  } catch {
    return undefined;
  }
}

export const MODEL_ID = /^[A-Za-z0-9._:/@-]{1,120}$/;

/**
 * Why a provider refused a request, as a fixed code (never the upstream text, which can echo keys
 * or account details). Lets the admin see "invalid key" vs "no credit" vs "wrong model" at a glance.
 */
export type EngineFailure = 'invalid_key' | 'no_credit' | 'rate_limited' | 'model_not_found' | 'region_blocked' | 'bad_request' | 'upstream_error';

export function classifyEngineFailure(status: number, body = ''): EngineFailure {
  const text = body.slice(0, 4000);
  const code = (() => {
    try {
      const err = (JSON.parse(text) as { error?: { code?: unknown; status?: unknown; type?: unknown; details?: { reason?: unknown }[] } }).error || {};
      return [err.code, err.status, err.type, ...(err.details || []).map((d) => d?.reason)].filter((v) => typeof v === 'string').join(' ');
    } catch { return ''; }
  })();
  if (/API_KEY_INVALID|API_KEY_SERVICE_BLOCKED|invalid_api_key|authentication_error|UNAUTHENTICATED/i.test(code) || status === 401) return 'invalid_key';
  if (/insufficient_quota|billing|credit balance|insufficient balance|Insufficient Balance|exceeded your current quota/i.test(`${code} ${text}`) || status === 402) return 'no_credit';
  if (/User location is not supported|unsupported_country|not available in your (country|region)/i.test(text)) return 'region_blocked';
  if (/model_not_found|not_found_error|NOT_FOUND/i.test(code) || status === 404 || /model .* (does not exist|not found)/i.test(text)) return 'model_not_found';
  if (status === 403 || /PERMISSION_DENIED|permission_error/i.test(code)) return 'invalid_key';
  if (status === 429 || /RESOURCE_EXHAUSTED|rate_limit/i.test(code)) return 'rate_limited';
  if (status >= 500 || /overloaded/i.test(code)) return 'upstream_error';
  return 'bad_request';
}


export async function callEngine(
  id: ModelEngineId,
  system: string,
  turns: EngineTurn[],
  options: { env?: Env; fetch?: typeof fetch; signal: AbortSignal; temperature: number; onToken?: (text: string) => void; model?: string; maxTokens?: number; maxChars?: number; onFailure?: (failure: EngineFailure, status: number, detail: string) => void; onModel?: (model: string) => void },
): Promise<string | undefined> {
  const env = options.env || process.env;
  const request = options.fetch || fetch;
  const base = engineStatuses(env).find((e) => e.id === id)!;
  const status = { ...base, model: options.model && MODEL_ID.test(options.model) ? options.model : base.model };
  const requestedModel = status.model;
  if (id === 'gemini') {
    const cached = geminiSubstitutes.get(geminiCacheKey(env.GEMINI_API_KEY!.trim(), status.model));
    if (cached && Date.now() - cached.at < (cached.ttl ?? 6 * 3600_000)) status.model = cached.model;
  }
  const maxTokens = options.maxTokens ?? 1200;
  const maxChars = options.maxChars ?? 12000;
  const stream = Boolean(options.onToken);
  let url: string;
  let headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let body: object;
  const openAiShape = () => ({
    model: status.model, temperature: options.temperature, max_tokens: maxTokens, ...(stream ? { stream: true } : {}),
    messages: [{ role: 'system', content: system }, ...turns.map((t) => ({ role: t.role, content: t.text }))],
  });

  if (id === 'self_hosted') {
    const open = openCompatibleEngine(env)!;
    url = `${open.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    if (open.apiKey) headers.Authorization = `Bearer ${open.apiKey}`;
    body = openAiShape();
  } else if (id === 'gemini') {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(status.model)}:${stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`;
    headers['x-goog-api-key'] = env.GEMINI_API_KEY!.trim();
    body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: turns.map((t) => ({ role: t.role === 'assistant' ? 'model' : 'user', parts: [{ text: t.text }] })),
      generationConfig: { temperature: options.temperature, ...geminiThinking(status.model, maxTokens) },
    };
  } else if (id === 'claude') {
    url = 'https://api.anthropic.com/v1/messages';
    headers = { ...headers, 'x-api-key': env.ANTHROPIC_API_KEY!.trim(), 'anthropic-version': '2023-06-01' };
    body = { model: status.model, system, max_tokens: maxTokens, temperature: options.temperature, ...(stream ? { stream: true } : {}), messages: turns.map((t) => ({ role: t.role, content: t.text })) };
  } else if (id === 'openrouter') {
    url = 'https://openrouter.ai/api/v1/chat/completions';
    headers = { ...headers, Authorization: `Bearer ${env.OPENROUTER_API_KEY!.trim()}`, 'X-Title': 'Sham Core' };
    if (env.APP_URL?.trim()) headers['HTTP-Referer'] = env.APP_URL.trim();
    body = openAiShape();
  } else {
    url = id === 'openai' ? 'https://api.openai.com/v1/chat/completions' : 'https://api.deepseek.com/chat/completions';
    headers.Authorization = `Bearer ${(id === 'openai' ? env.OPENAI_API_KEY : env.DEEPSEEK_API_KEY)!.trim()}`;
    body = openAiShape();
  }

  let usedModel = status.model;
  let response = await request(url, { method: 'POST', headers, body: JSON.stringify(body), signal: options.signal });
  if (id === 'gemini' && response.status === 404) {
    // The configured model was retired or is not open to this key: switch to the best available one.
    const apiKey = env.GEMINI_API_KEY!.trim();
    const better = await discoverGeminiModel(apiKey, status.model, request, options.signal);
    if (better && better !== status.model) {
      usedModel = better;
      url = url.replace(`/models/${encodeURIComponent(status.model)}:`, `/models/${encodeURIComponent(better)}:`);
      body = { ...body, generationConfig: { temperature: options.temperature, ...geminiThinking(better, maxTokens) } };
      response = await request(url, { method: 'POST', headers, body: JSON.stringify(body), signal: options.signal });
    }
  }
  let errorBody: string | undefined;
  if (id === 'gemini' && response.status === 429) errorBody = await response.text().catch(() => '');
  if (errorBody !== undefined && /RESOURCE_EXHAUSTED|QuotaFailure|quota/i.test(errorBody)) {
    // Quota is per model: an exhausted model does not mean the key is dead — try others for an hour.
    const apiKey = env.GEMINI_API_KEY!.trim();
    const original = url.match(/\/models\/([^:]+):/)?.[1];
    const failed = original ? decodeURIComponent(original) : status.model;
    for (const next of geminiQuotaFallbacks(await listGeminiModels(apiKey, request, options.signal), failed)) {
      if (options.signal.aborted) break;
      const nextUrl = url.replace(`/models/${encodeURIComponent(failed)}:`, `/models/${encodeURIComponent(next)}:`);
      const nextBody = { ...body, generationConfig: { temperature: options.temperature, ...geminiThinking(next, maxTokens) } };
      const attempt = await request(nextUrl, { method: 'POST', headers, body: JSON.stringify(nextBody), signal: options.signal });
      if (attempt.ok) {
        geminiSubstitutes.set(geminiCacheKey(apiKey, requestedModel), { model: next, at: Date.now(), ttl: 3600_000 });
        response = attempt; errorBody = undefined; usedModel = next;
        break;
      }
      if (attempt.status !== 429 && attempt.status !== 404) { response = attempt; errorBody = undefined; break; }
      await attempt.body?.cancel().catch(() => {});
    }
  }
  if (!response.ok) {
    const text = errorBody ?? await response.text().catch(() => '');
    if (options.onFailure) options.onFailure(classifyEngineFailure(response.status, text), response.status, failureDetail(text));
    return undefined;
  }
  options.onModel?.(usedModel);

  const isStream = stream && response.body && (response.headers.get('content-type') || '').includes('text/event-stream');
  if (isStream) {
    const filter = new ThinkFilter();
    let full = '';
    const emit = (text: string) => { if (text) { full += text; options.onToken!(text); } };
    for await (const data of sseData(response.body!)) {
      if (!data || data === '[DONE]') continue;
      let event: any;
      try { event = JSON.parse(data); } catch { continue; }
      const piece = id === 'gemini'
        ? (event.candidates?.[0]?.content?.parts || []).filter((p: { thought?: boolean }) => !p.thought).map((p: { text?: string }) => p.text || '').join('')
        : id === 'claude'
          ? (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' ? event.delta.text : '')
          : event.choices?.[0]?.delta?.content || '';
      if (typeof piece === 'string' && piece) emit(filter.push(piece));
      if (full.length > maxChars) return undefined;
    }
    emit(filter.flush());
    return full.trim() || undefined;
  }

  const data = await response.json() as {
    candidates?: { content?: { parts?: { thought?: boolean; text?: string }[] } }[];
    content?: { type: string; text: string }[];
    choices?: { message?: { content?: unknown } }[];
  };
  const reply = id === 'gemini'
    ? data.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text || '').join('')
    : id === 'claude'
      ? data.content?.filter((p) => p.type === 'text').map((p) => p.text).join('\n')
      : data.choices?.[0]?.message?.content;
  if (typeof reply !== 'string') return undefined;
  // Strip visible chain-of-thought some open reasoning models emit (<think>…</think>).
  const clean = reply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  if (clean && options.onToken) options.onToken(clean);
  return clean && clean.length <= maxChars ? clean : undefined;
}
