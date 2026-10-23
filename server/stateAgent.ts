/**
 * «وكيل صاحب المنصة في روبوت دولة المنصة» (`platform_owner_agent`):
 * AI Agent that comprehends the platform owner's natural-language directives (Egyptian Arabic & English, single or
 * multi-step, with conversation memory), validates every step strictly against the Platform State's constitution,
 * member votes, privacy rules (S-05) and binding legal holds (L-03), and produces ready-to-execute StateOrders for
 * both «غرفة دولة المنصة» and «روبوت دولة المنصة» (`scripts/state/run.mts`).
 *
 * Strictly adheres to O-07, O-10, and S-05:
 *   - Uses optional engines solely via `callEngine` (never direct outside platform URLs), with 100% local fallback.
 *   - Masks sensitive numbers before any model sees the text, and never stores messages or logs on the server.
 *   - Reads quality guidance from Shaheen's supervisor (`supervisorGuidance('platform_owner_agent', ...)`).
 */
import express from 'express';
import { callEngine, engineStatuses } from './core/engines';
import type { EngineHealth } from './core/engineHealth';
import { supervisorGuidance } from './core/liveData';
import { RateLimiter, clientKey } from './core/rateLimit';
import type { ModelEngineId } from './core/types';
import { SHAHEEN_SITE_SETTINGS } from './config/shaheen';
import { AGENT_LINK } from '../src/utils/agentLink';
import { defaultControls, hasSensitiveNumber, maskSensitive, readControls } from '../src/utils/ownerAuthority';
import { emptyStateOrders, readStateOrders, readStateReport, STATE, STATE_CONSTITUTION, STATE_ORDERS_LIMITS, type StateOrders } from '../src/utils/platformState';
import {
  comprehendOwnerCommand,
  findBot,
  judgeStateOrder,
  applyStateOrder,
  normalizeDigits,
  renderComprehensionReply,
  STATE_ORDER_ACTIONS,
  STATE_ROOM_LIMITS,
  stateOrderableBots,
  type OwnerComprehension,
  type StateOrder,
  type StateOrderAction,
  type StateReplyResult,
  type StateRoomContext,
  type StateRoomMessage,
} from '../src/utils/stateRoom';

type Env = Record<string, string | undefined>;

export class StateAgentError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export interface StateAgentInput {
  message: string;
  context?: Partial<StateRoomContext>;
  history?: StateRoomMessage[];
  preferAi?: boolean;
}

export interface StateAgentOutput extends StateReplyResult {
  source: 'ai_agent' | 'local_agent';
  understood: boolean;
}

interface RawAgentJson {
  understood?: unknown;
  summaryAr?: unknown;
  replyAr?: unknown;
  orders?: unknown;
}

const VENDOR_RE = /\b(?:OpenAI|ChatGPT|GPT-?\d|Gemini|Google\s+AI|Claude|Anthropic|DeepSeek|Grok|Perplexity|Manus|Qwen|Llama|Mistral)\b/gi;

/** Clean model prose so no vendor name, raw code block, link, or sensitive number ever reaches the owner or GitHub. */
export function sanitizeAgentText(text: string): string {
  return maskSensitive(text)
    .replace(/```[\s\S]*?```/g, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(VENDOR_RE, 'الوكيل الذكي')
    .replace(/\bundefined\b|\bnull\b|\bNaN\b/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 3000);
}

/** Defensively extract a JSON object from an LLM response (even with markdown fences or surrounding text). */
export function extractAgentJson(raw: string): RawAgentJson | undefined {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  const candidate = (fenced ? fenced[1] : raw).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) return undefined;
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1));
    return parsed && typeof parsed === 'object' ? (parsed as RawAgentJson) : undefined;
  } catch {
    return undefined;
  }
}

/** Normalize an LLM-proposed order (resolving Arabic bot names/aliases or law IDs into canonical IDs). */
export function normalizeAgentOrder(item: unknown): StateOrder | undefined {
  if (!item || typeof item !== 'object') return undefined;
  const o = item as Record<string, unknown>;
  const rawAction = typeof o.action === 'string' ? o.action.trim().toLowerCase() : '';
  const actionMap: Record<string, StateOrderAction> = {
    pause: 'pause', stop: 'pause',
    resume: 'resume', unpause: 'resume', start: 'resume',
    run: 'run', dispatch: 'run', trigger: 'run',
    law: 'law', add_law: 'law', new_law: 'law',
    repeal: 'repeal', delete_law: 'repeal', remove_law: 'repeal',
    task: 'task', create_task: 'task', new_task: 'task',
  };
  const action = actionMap[rawAction];
  if (!action || !(action in STATE_ORDER_ACTIONS)) return undefined;

  const whyAr = typeof o.whyAr === 'string' ? sanitizeAgentText(o.whyAr).slice(0, 260) : '';
  if (action === 'law' || action === 'task') {
    const textAr = typeof o.textAr === 'string' ? o.textAr.replace(/\s+/g, ' ').trim().slice(0, STATE_ORDERS_LIMITS.lawChars) : '';
    if (!textAr) return undefined;
    return { action, textAr, whyAr: whyAr || (action === 'law' ? 'قانون بأمر صاحب الموقع.' : 'مهمة بأمر صاحب الموقع.') };
  }

  const rawTarget = typeof o.target === 'string' ? o.target.trim() : '';
  if (!rawTarget) return undefined;
  if (action === 'repeal') {
    const num = /\d+/.exec(normalizeDigits(rawTarget));
    if (!num) return undefined;
    return { action: 'repeal', target: `P-${String(Number(num[0])).padStart(2, '0')}`, whyAr: whyAr || 'بأمر صاحب الموقع.' };
  }

  if (rawTarget === AGENT_LINK.id || /agent_link|الربط المباشر/.test(rawTarget)) {
    return { action, target: AGENT_LINK.id, whyAr };
  }
  if (rawTarget === 'state' || /^(?:دولة المنصة|الدولة)$/.test(rawTarget)) {
    return { action, target: 'state', whyAr };
  }
  const exactBot = stateOrderableBots().find((b) => b.id === rawTarget);
  if (exactBot) return { action, target: exactBot.id, whyAr };
  const resolved = findBot(rawTarget);
  if (resolved.bot) return { action, target: resolved.bot.id, whyAr };
  return undefined;
}

/** Verify & constitutionally judge every LLM-proposed order sequentially against real State context. */
export function verifyAgentPlan(
  parsed: RawAgentJson,
  ctx: StateRoomContext,
  fallback: OwnerComprehension,
): StateReplyResult | undefined {
  const rawList = Array.isArray(parsed.orders) ? parsed.orders.slice(0, 10) : [];
  const normalized = rawList.map(normalizeAgentOrder).filter((x): x is StateOrder => Boolean(x));

  // If the LLM missed valid orders that deterministic comprehension caught cleanly, keep deterministic truth.
  if (!normalized.length && fallback.proposedOrders.length > 0) return undefined;

  if (normalized.length > 0) {
    let workingOrders: StateOrders = {
      paused: [...ctx.orders.paused],
      laws: [...ctx.orders.laws],
      log: [...ctx.orders.log],
    };
    const acceptedOrders: { order: StateOrder; reasonAr: string }[] = [];
    const rejectedOrders: { order?: StateOrder; reasonAr: string }[] = [];
    for (const candidate of normalized) {
      const verdict = judgeStateOrder(candidate, { controls: ctx.controls, orders: workingOrders });
      if (verdict.ok) {
        const clean = { ...candidate, whyAr: candidate.whyAr || verdict.reasonAr };
        acceptedOrders.push({ order: clean, reasonAr: verdict.reasonAr });
        workingOrders = applyStateOrder(workingOrders, clean).orders;
      } else {
        rejectedOrders.push({ order: candidate, reasonAr: verdict.reasonAr });
      }
    }
    const comp: OwnerComprehension = {
      intent: 'order_plan',
      confidence: 0.94,
      understood: true,
      clauses: fallback.clauses,
      proposedOrders: normalized,
      acceptedOrders,
      rejectedOrders,
    };
    const base = renderComprehensionReply(comp, ctx);
    const intro = typeof parsed.summaryAr === 'string' ? sanitizeAgentText(parsed.summaryAr).slice(0, 240) : '';
    const enrichedText = intro && !base.text.includes(intro) ? `🤖 **فهم الوكيل:** ${intro}\n\n${base.text}` : base.text;
    return { ...base, text: enrichedText };
  }

  // Informational / conversational answer when no order was requested.
  if (parsed.understood === true && typeof parsed.replyAr === 'string') {
    const cleanReply = sanitizeAgentText(parsed.replyAr);
    if (cleanReply.length >= 12) {
      return {
        text: cleanReply,
        comprehension: { ...fallback, understood: true, confidence: Math.max(fallback.confidence, 0.85) },
      };
    }
  }
  return undefined;
}

function buildSystemPrompt(ctx: StateRoomContext, guidance: string): string {
  const bots = stateOrderableBots().map((b) => `- ${b.id}: ${b.nameAr}`).join('\n');
  const laws = ctx.orders.laws.length
    ? ctx.orders.laws.map((l) => `- ${l.id}: ${l.textAr}`).join('\n')
    : '- لا توجد قوانين مضافة حالياً';
  const failing = (ctx.precheck?.bots || []).filter((b) => b.status === 'fail').map((b) => b.id).join(', ') || 'none';
  return [
    `أنت وكيل الذكاء الاصطناعي الرسمي لـ«${STATE.nameAr}» المختص بفهم واستيعاب أوامر صاحب المنصة وتحويلها إلى خطة أوامر تنفيذية دقيقة لروبوت دولة المنصة.`,
    'القواعد الدستورية الملزمة:',
    ...STATE_CONSTITUTION.slice(0, 6).map((c) => `- ${c.id}: ${c.textAr}`),
    '- ممنوع تماماً ذكر أسماء شركات أو نماذج ذكاء اصطناعي خارجية أو اختراع روبوت غير موجود في القائمة أدناه.',
    '- ممنوع قبول أي أمر يمس بيانات صاحب الموقع الشخصية أو مفاتيحه أو يتجاوز قرارات المدير القانوني الملزمة (مثل وقف نقل المنتجات L-03).',
    '- الرد لصاحب المنصة بالعربي المصري البسيط الواضح المختصر بدون مصطلحات تقنية معقدة.',
    '',
    `حالة دولة المنصة الآن: selfDevelopment=${ctx.controls.selfDevelopment}, frozen=${ctx.controls.frozen}`,
    `الروبوتات الموقوفة بأمر صاحب الموقع: ${ctx.controls.paused.join(', ') || 'none'}`,
    `الروبوتات الموقوفة بأمر الدولة: ${ctx.orders.paused.join(', ') || 'none'}`,
    `الروبوتات المتعطلة في آخر فحص: ${failing}`,
    '',
    'الروبوتات المتاحة للأوامر (استخدم الـ id بدقة في حقل target):',
    `- ${AGENT_LINK.id}: ${AGENT_LINK.nameAr} (يدعم pause و resume فقط)`,
    bots,
    '',
    'قوانين المنصة المضافة حالياً:',
    laws,
    '',
    'أنواع الأوامر المسموحة فقط في مصفوفة orders:',
    '1) {"action":"pause","target":"<bot_id>","whyAr":"سبب مختصر بالمصري"}',
    '2) {"action":"resume","target":"<bot_id>","whyAr":"سبب مختصر بالمصري"}',
    '3) {"action":"run","target":"<bot_id>","whyAr":"سبب مختصر بالمصري"}',
    '4) {"action":"law","textAr":"نص القانون الواضح","whyAr":"سبب مختصر بالمصري"}',
    '5) {"action":"repeal","target":"P-01","whyAr":"سبب مختصر بالمصري"}',
    '6) {"action":"task","textAr":"وصف مهمة التطوير أو الصيانة بوضوح","whyAr":"سبب مختصر بالمصري"}',
    '',
    'أرجع JSON فقط بدون أي نص خارجي بهذا الشكل الدقيق:',
    '{"understood":true,"summaryAr":"ملخص فهمك لقصد صاحب المنصة في سطر واحد بالمصري","replyAr":"رد عربي مصري بسيط لو الرسالة سؤال أو دردشة بدون أمر تنفيذي","orders":[]}',
    'إذا كانت الرسالة خارج نطاق إدارة المنصة تماماً ولا علاقة لها بالروبوتات أو القوانين أو المهام (مثل طلب صورة قطة)، اجعل understood=false و orders=[].',
    guidance,
  ].filter(Boolean).join('\n');
}

export function normalizeStateAgentContext(raw?: Partial<StateRoomContext>): StateRoomContext {
  return {
    controls: raw?.controls ? readControls(raw.controls) : { ...defaultControls(), selfDevelopment: 'state' },
    orders: raw?.orders ? readStateOrders(raw.orders) : emptyStateOrders(),
    report: raw?.report ? readStateReport(raw.report) : readStateReport(null),
    ...(raw?.precheck ? { precheck: raw.precheck } : {}),
    ...(raw?.pending ? { pending: raw.pending } : {}),
  };
}

export function validateStateAgentInput(body: unknown): StateAgentInput {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  if (typeof b.message !== 'string' || !b.message.trim()) {
    throw new StateAgentError(400, 'INVALID_MESSAGE', 'Owner message is required');
  }
  if (b.message.length > STATE_ROOM_LIMITS.chars * 2) {
    throw new StateAgentError(400, 'MESSAGE_TOO_LONG', 'Owner message exceeds maximum length');
  }
  const history = Array.isArray(b.history)
    ? b.history
        .filter((m): m is StateRoomMessage => Boolean(m && typeof m === 'object' && ((m as StateRoomMessage).by === 'owner' || (m as StateRoomMessage).by === 'state') && typeof (m as StateRoomMessage).text === 'string'))
        .slice(-12)
        .map((m) => ({
          id: String(m.id || ''),
          by: m.by,
          text: maskSensitive(m.text.slice(0, STATE_ROOM_LIMITS.chars)),
          at: String(m.at || ''),
          ...(m.order ? { order: m.order } : {}),
          ...(Array.isArray(m.orders) ? { orders: m.orders.slice(0, 10) } : {}),
        }))
    : undefined;
  return {
    message: b.message.trim(),
    context: b.context && typeof b.context === 'object' ? (b.context as Partial<StateRoomContext>) : undefined,
    ...(history?.length ? { history } : {}),
    preferAi: b.preferAi !== false,
  };
}

/**
 * Main entry point: runs privacy screening, deterministic cognitive comprehension, optional supervised LLM reasoning
 * (`callEngine` + `supervisorGuidance`), post-LLM constitutional verification (`judgeStateOrder` + `stateVote`),
 * and guaranteed offline local fallback.
 */
export async function runStateOwnerAgent(
  input: StateAgentInput,
  options: { env?: Env; fetch?: typeof fetch; health?: EngineHealth; signal?: AbortSignal; localOnly?: boolean } = {},
): Promise<StateAgentOutput> {
  const ctx = normalizeStateAgentContext(input.context);
  const rawMessage = input.message.trim();

  // Immediate privacy shield (S-05): never send card/ID numbers to any engine.
  if (hasSensitiveNumber(rawMessage)) {
    const local = renderComprehensionReply(comprehendOwnerCommand(rawMessage, ctx, input.history), ctx);
    return { ...local, source: 'local_agent', understood: true };
  }

  const localComp = comprehendOwnerCommand(rawMessage, ctx, input.history);
  const localReply = renderComprehensionReply(localComp, ctx);

  if (options.localOnly) {
    return { ...localReply, source: 'local_agent', understood: localComp.understood };
  }

  const env = options.env || process.env;
  const configured = new Set(engineStatuses(env).filter((s) => s.configured && s.id !== 'sham_local').map((s) => s.id));
  const wanted = SHAHEEN_SITE_SETTINGS.engines.filter((id) => configured.has(id)) as ModelEngineId[];
  const engines = options.health ? options.health.order(wanted) : wanted;

  const shouldConsultAi = engines.length > 0 && (input.preferAi !== false || !localComp.understood || localComp.intent === 'clarify');
  if (shouldConsultAi) {
    const guidance = await supervisorGuidance('platform_owner_agent', env, options.fetch).catch(() => '');
    const system = buildSystemPrompt(ctx, guidance);
    const recentTurns = (input.history || []).slice(-6).map((m) => ({
      role: m.by === 'owner' ? ('user' as const) : ('assistant' as const),
      text: maskSensitive(m.text).slice(0, 1200),
    }));
    const turns = [...recentTurns, { role: 'user' as const, text: maskSensitive(rawMessage) }];
    const total = AbortSignal.any([AbortSignal.timeout(35_000), ...(options.signal ? [options.signal] : [])]);

    for (const id of engines) {
      if (total.aborted) break;
      try {
        const reply = await callEngine(id, system, turns, {
          env,
          fetch: options.fetch,
          signal: AbortSignal.any([total, AbortSignal.timeout(20_000)]),
          temperature: 0.15,
          maxTokens: 1024,
          maxChars: 8000,
        });
        if (typeof reply === 'string' && reply.trim()) {
          options.health?.ok(id);
          const parsed = extractAgentJson(reply);
          if (parsed) {
            const verified = verifyAgentPlan(parsed, ctx, localComp);
            if (verified) {
              return { ...verified, source: 'ai_agent', understood: Boolean(verified.comprehension?.understood ?? true) };
            }
          }
        }
      } catch {
        /* Fall through to next configured engine or deterministic local agent */
      }
    }
  }

  return { ...localReply, source: 'local_agent', understood: localComp.understood };
}

/** Mounted under `/api/admin/state-agent` (protected by `Bearer SHAM_ADMIN_TOKEN`; stores zero data). */
export function createStateAgentRouter(options: { env?: Env; fetch?: typeof fetch; health?: EngineHealth } = {}) {
  const router = express.Router();
  const limiter = new RateLimiter(30, 60_000);
  router.post('/', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      if (!limiter.allow(clientKey(req))) {
        throw new StateAgentError(429, 'RATE_LIMITED', 'Too many state agent requests, wait a minute');
      }
      const input = validateStateAgentInput(req.body);
      const out = await runStateOwnerAgent(input, options);
      res.json(out);
    } catch (error) {
      if (error instanceof StateAgentError) {
        res.status(error.status).json({ error: error.message, code: error.code });
      } else {
        res.status(500).json({ error: 'State agent unavailable', code: 'STATE_AGENT_FAILED' });
      }
    }
  });
  return router;
}
