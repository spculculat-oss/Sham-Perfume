/**
 * «غرفة شاهين الخاصة» on the server: POST /api/admin/owner-room (mounted under the admin router, so only the admin
 * code reaches it). Shaheen answers the owner, or the secretary summarises the room. Nothing is stored here: no
 * conversation record, no memory, no study list, no log line with the text. Card/ID numbers are hidden before any
 * engine sees the words. Without an engine Shaheen says so honestly and the secretary answers from his notebook.
 */
import express from 'express';
import { callEngine, engineStatuses } from './core/engines';
import type { EngineHealth } from './core/engineHealth';
import { RateLimiter, clientKey } from './core/rateLimit';
import { SHAHEEN_SITE_SETTINGS } from './config/shaheen';
import { handbookBrief } from '../src/utils/botHandbook';
import { OWNER, maskSensitive } from '../src/utils/ownerAuthority';
import { ROOM_LIMITS, secretaryLocalSummary, type RoomMessage, type RoomSpeaker } from '../src/utils/ownerRoom';
import type { ModelEngineId } from './core/types';

type Env = Record<string, string | undefined>;
export class RoomError extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }

export interface RoomRequest { to: 'shaheen' | 'secretary'; history: { by: RoomSpeaker; text: string }[] }

const SPEAKERS = new Set<RoomSpeaker>(['owner', 'shaheen', 'secretary']);
export function validateRoomRequest(body: unknown): RoomRequest {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const to = b.to === 'secretary' ? 'secretary' : b.to === 'shaheen' || b.to === undefined ? 'shaheen' : undefined;
  if (!to) throw new RoomError(400, 'INVALID_REQUEST', 'Unknown participant');
  if (!Array.isArray(b.history) || !b.history.length || b.history.length > ROOM_LIMITS.history) throw new RoomError(400, 'INVALID_HISTORY', 'Invalid room history');
  let size = 0;
  const history = b.history.map((t) => {
    const turn = t as { by?: unknown; text?: unknown };
    if (!turn || !SPEAKERS.has(turn.by as RoomSpeaker) || typeof turn.text !== 'string' || !turn.text.trim() || turn.text.length > ROOM_LIMITS.chars) {
      throw new RoomError(400, 'INVALID_HISTORY', 'Invalid room turn');
    }
    size += turn.text.length;
    return { by: turn.by as RoomSpeaker, text: maskSensitive(turn.text.trim()) };
  });
  if (size > 40_000) throw new RoomError(400, 'INVALID_HISTORY', 'Room history too long');
  if (to === 'shaheen' && history.at(-1)!.by !== 'owner') throw new RoomError(400, 'INVALID_HISTORY', 'Shaheen answers the owner\'s last message');
  return { to, history };
}

const SHAHEEN_ROOM = () => [
  'إنت «الخبير شاهين»، المدير العام لكل روبوتات وأدوات منصة «صمم عطرك مع شام».',
  `دي **غرفة خاصة** بينك وبين **صاحب الموقع** نفسه (حساب GitHub ${OWNER.github})، ومعاكم السكرتير بس. صاحب الموقع دخلها بالكود السري، ومحدش غيركم بيشوفها.`,
  'رد عليه بالعربي المصري البسيط، من غير تفاصيل تقنية، والكلمات الإنجليزي بين قوسين مع معناها بس. خليك مختصر وعملي: قوله إيه الوضع، وإيه اقتراحك، وإيه الخطوة الجاية.',
  'إنت مستشاره الأمين: قوله الحقيقة حتى لو مش اللي عايز يسمعها. ماتدّعيش أبداً إنك نفذت حاجة أو شفت بيانات ماشفتهاش؛ لو حاجة محتاجة تنفيذ قوله مين هينفذها (روبوت معين، وكيل البرمجة لما يكتب «نفذ مهام شاهين»، أو هو بنفسه من «مركز تحكم صاحب الموقع»).',
  'أوامر التحكم (وقف روبوت، فرامل الطوارئ، نظام التطوير الذاتي، الموافقة على التغييرات الكبيرة) بتتنفذ من «مركز تحكم صاحب الموقع» بحسابه على GitHub — دلّه عليها خطوة بخطوة.',
  'ماتطلبش منه ولا تكرر أي بيانات شخصية أو كلمات سر أو مفاتيح أو أرقام بطاقات، ولو كتب حاجة زي كده نبهه بلطف.',
  'ممنوع ذكر أسماء شركات أو تطبيقات الذكاء الاصطناعي اللي وراك.',
  '',
  handbookBrief(undefined, 1800),
].join('\n');

const SECRETARY_ROOM = () => [
  'إنت «السكرتير — مشرف شاهين» في غرفة صاحب الموقع الخاصة (صاحب الموقع وشاهين وإنت بس).',
  'اكتب لصاحب الموقع ملخص قصير بالعربي المصري، نقاط بس، من غير تفاصيل تقنية:',
  '1) قراراته. 2) طلباته ومين المسؤول عن كل واحد (روبوت/وكيل البرمجة/صاحب الموقع نفسه). 3) اللي لسه مستني رد أو موافقة. 4) أهم نصيحة من شاهين.',
  'ماتخترعش حاجة مش موجودة في المحادثة، وماتكررش أي رقم أو بيانات شخصية.',
].join('\n');

const LABEL: Record<RoomSpeaker, string> = { owner: 'صاحب الموقع', shaheen: 'شاهين', secretary: 'السكرتير' };

export interface RoomAnswer { reply: string; by: 'shaheen' | 'secretary'; offline?: boolean; engine?: string }

export async function roomAnswer(req: RoomRequest, options: { env?: Env; fetch?: typeof fetch; health?: EngineHealth; signal?: AbortSignal } = {}): Promise<RoomAnswer> {
  const env = options.env || process.env;
  const configured = new Set(engineStatuses(env).filter((s) => s.configured).map((s) => s.id));
  const wanted = SHAHEEN_SITE_SETTINGS.engines.filter((id) => configured.has(id)) as ModelEngineId[];
  const order = options.health ? options.health.order(wanted) : wanted;
  const system = req.to === 'secretary' ? SECRETARY_ROOM() : SHAHEEN_ROOM();
  // The secretary reads the whole room as one transcript; Shaheen talks with the owner turn by turn.
  const turns = req.to === 'secretary'
    ? [{ role: 'user' as const, text: `محضر الغرفة:\n${req.history.map((t) => `${LABEL[t.by]}: ${t.text}`).join('\n')}\n\nاكتب الملخص.` }]
    : req.history.map((t) => ({ role: t.by === 'owner' ? 'user' as const : 'assistant' as const, text: t.by === 'secretary' ? `[السكرتير] ${t.text}` : t.text }));
  const total = AbortSignal.any([AbortSignal.timeout(50_000), ...(options.signal ? [options.signal] : [])]);
  for (const id of order) {
    if (total.aborted) break;
    try {
      const reply = await callEngine(id, system, turns, {
        env, fetch: options.fetch, signal: AbortSignal.any([total, AbortSignal.timeout(28_000)]),
        temperature: req.to === 'secretary' ? 0.2 : 0.5, maxTokens: 1536, maxChars: 12_000,
      });
      if (typeof reply === 'string' && reply.trim()) { options.health?.ok(id); return { reply: reply.trim(), by: req.to, engine: id }; }
    } catch { /* next engine; provider errors are never shown */ }
  }
  if (req.to === 'secretary') {
    const messages = req.history.map((t, i): RoomMessage => ({ id: String(i), by: t.by, text: t.text, at: '' }));
    return { reply: secretaryLocalSummary(messages), by: 'secretary', offline: true };
  }
  return {
    reply: 'معلش، محركات الذكاء مش متاحة دلوقتي (الباقة خلصت أو الخدمة واقفة)، فمش هقدر أرد عليك رد كامل. رسالتك محفوظة في الغرفة عندك، والسكرتير سجّل طلبك في المفكرة، وأول ما المحركات ترجع اسألني تاني وأنا أكمل معاك.',
    by: 'shaheen', offline: true,
  };
}

/** The admin sub-router (the admin code is already checked by the parent). Kept out of every log and store. */
export function createOwnerRoomRouter(options: { env?: Env; fetch?: typeof fetch; health?: EngineHealth } = {}) {
  const router = express.Router();
  const limiter = new RateLimiter(30, 60_000);
  router.post('/', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      if (!limiter.allow(clientKey(req))) throw new RoomError(429, 'RATE_LIMITED', 'Too many messages, please wait a minute');
      const input = validateRoomRequest(req.body);
      res.json(await roomAnswer(input, options));
    } catch (error) {
      if (error instanceof RoomError) res.status(error.status).json({ error: error.message, code: error.code });
      else res.status(500).json({ error: 'Room unavailable', code: 'ROOM_FAILED' });
    }
  });
  return router;
}
