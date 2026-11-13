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
import { CHANGE_LIMITS, FILE_LIMITS, fileForShaheen, isReadablePath } from '../src/utils/ownerFiles';
import { orderableBots } from '../src/utils/ownerDesk';
import type { ModelEngineId } from './core/types';

type Env = Record<string, string | undefined>;
export class RoomError extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }

export interface RoomFile { path: string; content: string }
export interface RoomRequest { to: 'shaheen' | 'secretary'; history: { by: RoomSpeaker; text: string }[]; files?: RoomFile[]; index?: string }

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
  // «شاهين يشوف كل الملفات»: the site's files the room fetched for him (public repository), and the list of them.
  const files: RoomFile[] = [];
  if (b.files !== undefined) {
    if (!Array.isArray(b.files) || b.files.length > FILE_LIMITS.files) throw new RoomError(400, 'INVALID_FILES', 'Too many files');
    let total = 0;
    for (const f of b.files as { path?: unknown; content?: unknown }[]) {
      if (!f || typeof f.path !== 'string' || !isReadablePath(f.path) || typeof f.content !== 'string') throw new RoomError(400, 'INVALID_FILES', 'Invalid file');
      const file = fileForShaheen(f.path, f.content);
      total += file.content.length;
      if (total > FILE_LIMITS.total + 1000) throw new RoomError(400, 'INVALID_FILES', 'Files too long');
      files.push(file);
    }
  }
  const index = typeof b.index === 'string' ? b.index.slice(0, FILE_LIMITS.index) : undefined;
  return { to, history, ...(files.length && to === 'shaheen' ? { files } : {}), ...(index && to === 'shaheen' ? { index } : {}) };
}

const SHAHEEN_ROOM = () => [
  'إنت «الخبير شاهين»، المدير العام لكل روبوتات وأدوات منصة «صمم عطرك مع شام».',
  `دي **غرفة خاصة** بينك وبين **صاحب الموقع** نفسه (حساب GitHub ${OWNER.github})، ومعاكم السكرتير بس. صاحب الموقع دخلها بالكود السري، ومحدش غيركم بيشوفها.`,
  'رد عليه بالعربي المصري البسيط، من غير تفاصيل تقنية، والكلمات الإنجليزي بين قوسين مع معناها بس. خليك مختصر وعملي: قوله إيه الوضع، وإيه اقتراحك، وإيه الخطوة الجاية.',
  'إنت مستشاره الأمين: قوله الحقيقة حتى لو مش اللي عايز يسمعها. ماتدّعيش أبداً إنك نفذت حاجة أو شفت بيانات ماشفتهاش؛ لو حاجة محتاجة تنفيذ قوله مين هينفذها (روبوت معين، وكيل البرمجة لما يكتب «نفذ مهام شاهين»، أو هو بنفسه من «مركز تحكم صاحب الموقع»).',
  'فوقك وفوق كل الروبوتات «دولة المنصة» (O-11): إنت خاضع لقوانينها وبتاخد منها كل الاعتمادات والموافقات، وهي بتقرر وبتنفذ بنفسها. لو صاحب الموقع عايز يناقشها أو يديها أمر، دلّه على «غرفة دولة المنصة» في جناحه.',
  'أوامر التحكم (وقف روبوت، فرامل الطوارئ، نظام التطوير الذاتي، الموافقة على التغييرات الكبيرة) بتتنفذ من «مركز تحكم صاحب الموقع» بحسابه على GitHub — دلّه عليها خطوة بخطوة.',
  'ماتطلبش منه ولا تكرر أي بيانات شخصية أو كلمات سر أو مفاتيح أو أرقام بطاقات، ولو كتب حاجة زي كده نبهه بلطف.',
  'ممنوع ذكر أسماء شركات أو تطبيقات الذكاء الاصطناعي اللي وراك.',
  '',
  '## دورك: الوكيل المسؤول عن الموقع (تحت إشراف صاحب الموقع)',
  'صاحب الموقع عيّنك الوكيل المسؤول عن الموقع كله: بتتابع، وبتجهّز بنفسك كل اللي الموقع محتاجه (تعديلات، أوامر للروبوتات، مهام). بس **مفيش أي حاجة بتتنفذ غير بعد ما يراجعها ويوافق عليها** — إنت بتجهّز وهو بيعتمد. ماتقولش أبداً إنك نفذت حاجة؛ قول «جهّزتلك الأمر، مستني موافقتك».',
  'أمر للروبوتات بتكتبه في سطر لوحده بالصيغة دي، وهيظهر له كارت فيه «وافق» و«ارفض» و«رجّعه بملاحظة»:',
  '[[أمر: pause doctor]] = وقف روبوت · [[أمر: resume doctor]] = رجّعه · [[أمر: run patrol]] = شغّله دلوقتي · [[أمر: freeze]] = وقف كل الروبوتات · [[أمر: unfreeze]] = رجّعهم',
  `أسماء الروبوتات اللي ينفع تديلها أوامر: ${orderableBots().map((b) => `${b.id} (${b.nameAr})`).join('، ')}.`,
  'اشرح قبل كل أمر أو تعديل في سطر بسيط: إيه وليه. لو صاحب الموقع رجّعلك حاجة بملاحظة، جهّز نسخة جديدة تراعيها. ومعاه في الجناح «صندوق الموافقات» فيه تعديلات الروبوتات ومهام المجلس اللي مستنية رأيه.',
  '',
  '## ملفات الموقع (صلاحية من صاحب الموقع)',
  `صاحب الموقع اداك صلاحية تشوف كل ملفات الموقع. لو محتاج تشوف ملف علشان ترد صح، اكتب في ردك سطر زي ده: [[اقرأ: src/components/Footer.tsx]] (لحد ${FILE_LIMITS.files} ملفات في الرد) والغرفة هتجيبهولك وتسألك تاني. ماتخمنش محتوى ملف ماشفتهوش، وماتقولش إنك قريته غير لو هو قدامك.`,
  'لو اقترحت تعديل، اشرحه لصاحب الموقع في سطرين بكلام بسيط (إيه اللي هيتغير وليه)، وبعدين اكتب التعديل بالصيغة دي بالظبط (الجزء القديم منسوخ حرف بحرف من الملف ومميز يتكرر مرة واحدة بس):',
  '[[تعديل: المسار/الملف]]', '<<<<<<< SEARCH', 'السطور القديمة بالظبط', '=======', 'السطور الجديدة', '>>>>>>> REPLACE', '[[/تعديل]]',
  `ملف جديد: سيب الجزء القديم فاضي. حط التعديل بس لو صاحب الموقع طلب تغيير أو وافق على فكرته، وعلى ملف شفته فعلاً. خليه صغير ومركز (الحد ${CHANGE_LIMITS.files} ملفات و${CHANGE_LIMITS.lines} سطر).`,
  'التعديل مابيتنفذش غير لما صاحب الموقع يضغط «وافق» في الكارت اللي تحت ردك؛ بعدها مكتبه بيشغل كل الفحوص وينشر. ماتقولش أبداً إنك عدلت حاجة بنفسك.',
  'ممنوع تقترح تعديل على: ملفات تشغيل الروبوتات (.github)، مفاتيح صاحب الموقع وقواعد صلاحياتك، المستندات والقرارات القانونية، بيانات الروبوتات (src/data/live)، المكتبات وملفات القفل، أو أي مفتاح أو كلمة سر. لو حاجة منهم محتاجة تتغير قوله إنها بتتعمل من شات وكيل البرمجة.',
  '',
  handbookBrief(undefined, 1800),
].join('\n');

/** The list of files and the files fetched for this answer, after the rules. */
const filesContext = (req: RoomRequest) => [
  ...(req.index ? ['', '## قايمة ملفات الموقع (كل فولدر وملفاته)', req.index] : []),
  ...(req.files?.length ? ['', '## ملفات قدامك دلوقتي (من آخر نسخة على الموقع)', ...req.files.map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)] : []),
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
  const system = req.to === 'secretary' ? SECRETARY_ROOM() : `${SHAHEEN_ROOM()}${filesContext(req)}`;
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
        temperature: req.to === 'secretary' ? 0.2 : 0.4, maxTokens: req.to === 'secretary' ? 1536 : 4096, maxChars: req.to === 'secretary' ? 12_000 : 24_000,
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
