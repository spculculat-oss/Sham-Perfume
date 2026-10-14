/**
 * Engine layer. Language models are interchangeable "renderers": they phrase an answer from the
 * context Sham's orchestrator already gathered. Business logic, data, tools and memory never
 * depend on them. Order of preference is an admin policy; `sham_local` (no model) always closes it.
 *
 *  self_hosted : any OpenAI-compatible server you run (Ollama, vLLM, LM Studio, llama.cpp server)
 *                with open-weight models such as Qwen, Llama, Mistral or DeepSeek open weights.
 *  gemini / openai / claude / deepseek : optional hosted providers (server-side keys only).
 *  sham_local  : Sham's own deterministic composer — works with zero keys and zero cost.
 */
import type { EngineId } from './types';

type Env = Record<string, string | undefined>;
export interface EngineTurn { role: 'user' | 'assistant'; text: string }
export interface EngineStatus { id: EngineId; name: string; model: string; configured: boolean; kind: 'own' | 'self_hosted' | 'hosted' }

const configured = (v?: string) => Boolean(v?.trim() && !/^(MY_|YOUR_|<)/i.test(v.trim()));

export function engineStatuses(env: Env = process.env): EngineStatus[] {
  return [
    { id: 'self_hosted', name: 'Self-hosted open model', model: env.SHAM_LLM_MODEL?.trim() || 'qwen2.5:7b-instruct', configured: configured(env.SHAM_LLM_BASE_URL), kind: 'self_hosted' },
    { id: 'gemini', name: 'Google Gemini', model: env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash', configured: configured(env.GEMINI_API_KEY), kind: 'hosted' },
    { id: 'openai', name: 'OpenAI', model: env.OPENAI_MODEL?.trim() || 'gpt-4o-mini', configured: configured(env.OPENAI_API_KEY), kind: 'hosted' },
    { id: 'claude', name: 'Anthropic Claude', model: env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-4-5', configured: configured(env.ANTHROPIC_API_KEY), kind: 'hosted' },
    { id: 'deepseek', name: 'DeepSeek', model: env.DEEPSEEK_MODEL?.trim() || 'deepseek-chat', configured: configured(env.DEEPSEEK_API_KEY), kind: 'hosted' },
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

export async function callEngine(
  id: Exclude<EngineId, 'sham_local'>,
  system: string,
  turns: EngineTurn[],
  options: { env?: Env; fetch?: typeof fetch; signal: AbortSignal; temperature: number; onToken?: (text: string) => void },
): Promise<string | undefined> {
  const env = options.env || process.env;
  const request = options.fetch || fetch;
  const status = engineStatuses(env).find((e) => e.id === id)!;
  const stream = Boolean(options.onToken);
  let url: string;
  let headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let body: object;
  const openAiShape = () => ({
    model: status.model, temperature: options.temperature, max_tokens: 1200, ...(stream ? { stream: true } : {}),
    messages: [{ role: 'system', content: system }, ...turns.map((t) => ({ role: t.role, content: t.text }))],
  });

  if (id === 'self_hosted') {
    url = `${env.SHAM_LLM_BASE_URL!.trim().replace(/\/+$/, '')}/chat/completions`;
    if (configured(env.SHAM_LLM_API_KEY)) headers.Authorization = `Bearer ${env.SHAM_LLM_API_KEY!.trim()}`;
    body = openAiShape();
  } else if (id === 'gemini') {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(status.model)}:${stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`;
    headers['x-goog-api-key'] = env.GEMINI_API_KEY!.trim();
    body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: turns.map((t) => ({ role: t.role === 'assistant' ? 'model' : 'user', parts: [{ text: t.text }] })),
      generationConfig: { temperature: options.temperature, maxOutputTokens: 1200 },
    };
  } else if (id === 'claude') {
    url = 'https://api.anthropic.com/v1/messages';
    headers = { ...headers, 'x-api-key': env.ANTHROPIC_API_KEY!.trim(), 'anthropic-version': '2023-06-01' };
    body = { model: status.model, system, max_tokens: 1200, temperature: options.temperature, ...(stream ? { stream: true } : {}), messages: turns.map((t) => ({ role: t.role, content: t.text })) };
  } else {
    url = id === 'openai' ? 'https://api.openai.com/v1/chat/completions' : 'https://api.deepseek.com/chat/completions';
    headers.Authorization = `Bearer ${(id === 'openai' ? env.OPENAI_API_KEY : env.DEEPSEEK_API_KEY)!.trim()}`;
    body = openAiShape();
  }

  const response = await request(url, { method: 'POST', headers, body: JSON.stringify(body), signal: options.signal });
  if (!response.ok) return undefined;

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
      if (full.length > 12000) return undefined;
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
  return clean && clean.length <= 12000 ? clean : undefined;
}
