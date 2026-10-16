/**
 * Manus — a task agent (plans, browses, works for minutes, then reports), not an instant chat model.
 * Shaheen uses it only for background work in GitHub Actions (e.g. the weekly languages/design audit
 * of the site, scripts/shaheen-manus/run.mts); visitors never talk to it and never see its name.
 * Key: MANUS_API_KEY (repository secret). API v2: https://open.manus.ai/docs/v2/introduction
 */
export const MANUS_BASE = 'https://api.manus.ai';

export type ManusCode = 'ok' | 'not_configured' | 'invalid_key' | 'no_credit' | 'rate_limited' | 'bad_request' | 'upstream_error' | 'timeout' | 'unreachable';

export class ManusError extends Error {
  constructor(public code: ManusCode, message: string) { super(message); }
}

type Fetch = typeof fetch;
interface CallOptions { key?: string; request?: Fetch; timeoutMs?: number }

export const manusConfigured = (env: Record<string, string | undefined> = process.env) => Boolean(env.MANUS_API_KEY?.trim());

/** Maps a Manus error envelope / HTTP status to the site's fixed key codes (no upstream text is trusted as-is). */
export function manusCodeOf(status: number, error?: { code?: string; message?: string }): ManusCode {
  const code = error?.code || '';
  const message = (error?.message || '').toLowerCase();
  if (code === 'unauthenticated' || status === 401) return 'invalid_key';
  if (/credit|quota|balance|insufficient|payment/.test(message) || status === 402) return 'no_credit';
  if (code === 'permission_denied' || status === 403) return 'invalid_key';
  if (code === 'rate_limited' || status === 429) return 'rate_limited';
  if (code === 'invalid_argument' || code === 'not_found' || status === 400 || status === 404) return 'bad_request';
  return 'upstream_error';
}

async function call<T>(method: 'GET' | 'POST', path: string, body: unknown, o: CallOptions = {}): Promise<T> {
  const key = (o.key ?? process.env.MANUS_API_KEY ?? '').trim();
  if (!key) throw new ManusError('not_configured', 'MANUS_API_KEY is not set');
  const request = o.request ?? fetch;
  let res: Response;
  try {
    res = await request(`${MANUS_BASE}${path}`, {
      method,
      headers: { 'x-manus-api-key': key, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(o.timeoutMs ?? 30_000),
    });
  } catch (e) {
    throw new ManusError(/timeout|abort/i.test(String((e as Error)?.name || e)) ? 'timeout' : 'unreachable', String((e as Error)?.message || e).slice(0, 120));
  }
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: { code?: string; message?: string } } & T;
  if (!res.ok || data.ok === false) {
    const code = manusCodeOf(res.status, data.error);
    throw new ManusError(code, `${res.status} ${data.error?.code || ''}`.trim());
  }
  return data;
}

/** A free, read-only check that the key works (no task, no credits). */
export async function manusWhoAmI(o: CallOptions = {}): Promise<{ ok: boolean; code: ManusCode; ms: number }> {
  const start = Date.now();
  try {
    await call('GET', '/v2/user.me', undefined, o);
    return { ok: true, code: 'ok', ms: Date.now() - start };
  } catch (e) {
    return { ok: false, code: e instanceof ManusError ? e.code : 'unreachable', ms: Date.now() - start };
  }
}

export interface ManusTaskOptions extends CallOptions {
  title: string;
  prompt: string;
  /** JSON Schema (root object, every object additionalProperties:false with all properties required). */
  schema?: Record<string, unknown>;
  /** 'lite' (cheapest, default) | 'standard' | 'max'. Free accounts always run as lite. */
  profile?: string;
  locale?: string;
  /** How long to wait for the agent before giving up (the task keeps its result in the Manus account). */
  waitMs?: number;
  pollMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export interface ManusTaskResult<T = unknown> {
  taskId: string;
  taskUrl?: string;
  status: 'stopped' | 'waiting' | 'error' | 'running';
  credits?: number;
  /** The structured result (when a schema was given and the extraction succeeded). */
  value?: T;
  /** The agent's last visible message. */
  text?: string;
  ms: number;
}

interface Message { type?: string; assistant_message?: { content?: string }; structured_output_result?: { success?: boolean; value?: unknown; error?: string } }

/** Creates a task, waits until the agent stops, and returns its structured result. */
export async function runManusTask<T = unknown>(o: ManusTaskOptions): Promise<ManusTaskResult<T>> {
  const start = Date.now();
  const sleep = o.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const created = await call<{ task_id: string; task_url?: string }>('POST', '/v2/task.create', {
    message: { content: o.prompt },
    title: o.title,
    agent_profile: o.profile || 'lite',
    interactive_mode: false,
    hide_in_task_list: false,
    share_visibility: 'private',
    ...(o.locale ? { locale: o.locale } : {}),
    ...(o.schema ? { structured_output_schema: o.schema } : {}),
  }, o);
  const taskId = created.task_id;
  let status: ManusTaskResult['status'] = 'running';
  let credits: number | undefined;
  const waitMs = o.waitMs ?? 30 * 60_000;
  while (Date.now() - start < waitMs) {
    await sleep(o.pollMs ?? 20_000);
    try {
      const d = await call<{ task: { status: ManusTaskResult['status']; credit_usage?: number } }>('GET', `/v2/task.detail?task_id=${encodeURIComponent(taskId)}`, undefined, o);
      status = d.task.status;
      credits = d.task.credit_usage;
    } catch (e) {
      if (e instanceof ManusError && (e.code === 'rate_limited' || e.code === 'timeout' || e.code === 'unreachable' || e.code === 'upstream_error')) continue;
      throw e;
    }
    if (status !== 'running') break;
  }
  const result: ManusTaskResult<T> = { taskId, taskUrl: created.task_url, status, credits, ms: Date.now() - start };
  if (status === 'running') return result;
  // The structured result can arrive a moment after the stop: read the newest messages a few times.
  for (let attempt = 0; attempt < 4; attempt++) {
    const m = await call<{ messages?: Message[] }>('GET', `/v2/task.listMessages?task_id=${encodeURIComponent(taskId)}&order=desc&limit=50`, undefined, o);
    const messages = m.messages || [];
    result.text ??= messages.find((x) => x.type === 'assistant_message' && x.assistant_message?.content)?.assistant_message?.content;
    const structured = messages.find((x) => x.type === 'structured_output_result')?.structured_output_result;
    if (structured?.success) { result.value = structured.value as T; break; }
    if (!o.schema || structured || status !== 'stopped') break;
    await sleep(o.pollMs ?? 20_000);
  }
  return result;
}
