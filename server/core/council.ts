/**
 * Sham advisory council — several language models deliberate before the visitor gets one answer.
 *
 *   1. Opinions : every seat answers independently and in parallel (no seat sees another yet).
 *   2. Review   : each seat reads the others' positions under anonymous letters (A, B, C…), points out
 *                 mistakes, unsafe or ungrounded claims and missing points, then states a revised
 *                 position. Anonymity keeps models from deferring to a brand name. 0–2 rounds.
 *   3. Synthesis: a chair seat writes one consultative reply (bottom line, steps, caveats, where the
 *                 advisors disagreed, next step with Sham) and that reply is streamed to the visitor.
 *
 * The pattern follows public research and tools (multi-agent debate, mixture-of-agents, LLM
 * councils with peer review and a chairman). It is implemented here from scratch on top of Sham's own
 * engine adapters. Seats only ever see Sham's grounded CONTEXT and never get tools or write access.
 * Any seat may fail or time out; the council keeps going with the rest, and the orchestrator falls
 * back to the normal engine policy if nobody answers.
 */
import { randomUUID } from 'node:crypto';
import { callEngine, engineStatuses, MODEL_ID, type EngineTurn } from './engines';
import type { CouncilEntry, CouncilMember, CouncilRole, CouncilSettings, CouncilTranscript, EngineId, ModelEngineId } from './types';

type Env = Record<string, string | undefined>;

export const COUNCIL_ROLES: Record<CouncilRole, { ar: string; en: string; brief: string }> = {
  formulator: { ar: 'خبير التركيب والمواد', en: 'Formulation expert', brief: 'perfumery formulation: notes, accords, materials, concentrations, maceration and technique' },
  commercial: { ar: 'المستشار التجاري', en: 'Commercial advisor', brief: 'cost, pricing logic, quantities, packaging, suppliers, wholesale/private-label viability — but Sham prices only from CONTEXT' },
  safety: { ar: 'مراجع السلامة والجودة', en: 'Safety & quality reviewer', brief: 'safety, IFRA-style usage limits, allergens, labelling, storage, quality control; flag anything risky or uncertain' },
  customer: { ar: 'صوت العميل', en: 'Customer voice', brief: 'the visitor\'s real goal, budget and experience; clarity, practicality and the simplest path to what they want' },
  general: { ar: 'مستشار عام', en: 'General advisor', brief: 'a balanced, practical overall view' },
};
const ROLES = Object.keys(COUNCIL_ROLES) as CouncilRole[];
const MODEL_ENGINES: ModelEngineId[] = ['self_hosted', 'gemini', 'openai', 'claude', 'deepseek', 'openrouter'];
/** Intents that can convene the council (never for tracking, calculations, greetings or privacy). */
export const COUNCIL_INTENTS = ['perfume_expert', 'question', 'service_request', 'browse_products', 'list_services'] as const;
export const MAX_SEATS = 5;

/** Invalid council settings; the repository maps it to a 400 ValidationError. */
export class CouncilConfigError extends Error {}

export function defaultCouncil(): CouncilSettings {
  const seat = (engine: ModelEngineId, role: CouncilRole): CouncilMember => ({ id: `seat-${engine}`, engine, role, enabled: true });
  return {
    enabled: true,
    members: [seat('self_hosted', 'general'), seat('gemini', 'formulator'), seat('claude', 'safety'), seat('openai', 'commercial'), seat('deepseek', 'customer')],
    chair: 'auto',
    rounds: 1,
    intents: ['perfume_expert'],
    showDiscussion: true,
  };
}

/** Validates an admin patch (dashboard → PUT /settings). Unknown fields are ignored. */
export function normalizeCouncil(input: unknown, current: CouncilSettings = defaultCouncil()): CouncilSettings {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new CouncilConfigError('council must be an object');
  const patch = input as Partial<CouncilSettings>;
  const next: CouncilSettings = { ...current };
  if (patch.enabled !== undefined) next.enabled = Boolean(patch.enabled);
  if (patch.showDiscussion !== undefined) next.showDiscussion = Boolean(patch.showDiscussion);
  if (patch.rounds !== undefined) {
    const rounds = Number(patch.rounds);
    if (!Number.isInteger(rounds) || rounds < 0 || rounds > 2) throw new CouncilConfigError('rounds must be 0, 1 or 2');
    next.rounds = rounds;
  }
  if (patch.intents !== undefined) {
    if (!Array.isArray(patch.intents) || patch.intents.some((i) => !(COUNCIL_INTENTS as readonly string[]).includes(i))) throw new CouncilConfigError('Unknown council intent');
    next.intents = [...new Set(patch.intents)];
  }
  if (patch.members !== undefined) {
    if (!Array.isArray(patch.members) || patch.members.length > 8) throw new CouncilConfigError('members must be a list of at most 8 seats');
    const seen = new Set<string>();
    next.members = patch.members.map((raw) => {
      const m = (raw || {}) as Partial<CouncilMember>;
      if (!MODEL_ENGINES.includes(m.engine as ModelEngineId)) throw new CouncilConfigError('Unknown council engine');
      if (!ROLES.includes(m.role as CouncilRole)) throw new CouncilConfigError('Unknown council role');
      const model = typeof m.model === 'string' ? m.model.trim() : '';
      if (model && !MODEL_ID.test(model)) throw new CouncilConfigError('Invalid model id');
      let id = typeof m.id === 'string' && /^[a-z0-9-]{3,40}$/.test(m.id) ? m.id : `seat-${randomUUID().slice(0, 8)}`;
      while (seen.has(id)) id = `seat-${randomUUID().slice(0, 8)}`;
      seen.add(id);
      return { id, engine: m.engine as ModelEngineId, role: m.role as CouncilRole, enabled: m.enabled !== false, ...(model ? { model } : {}) };
    });
  }
  if (patch.chair !== undefined) {
    if (typeof patch.chair !== 'string' || (patch.chair !== 'auto' && !next.members.some((m) => m.id === patch.chair))) throw new CouncilConfigError('chair must be "auto" or a seat id');
    next.chair = patch.chair;
  }
  if (next.chair !== 'auto' && !next.members.some((m) => m.id === next.chair)) next.chair = 'auto';
  return next;
}

/** Enabled seats whose provider is configured on this server (at most MAX_SEATS). */
export function activeSeats(council: CouncilSettings, env: Env = process.env): CouncilMember[] {
  const statuses = engineStatuses(env);
  return council.members.filter((m) => m.enabled && statuses.find((s) => s.id === m.engine)?.configured).slice(0, MAX_SEATS);
}

/** A council needs at least two voices, otherwise it is just the normal single-engine answer. */
export function councilAvailable(council: CouncilSettings, env: Env = process.env): boolean {
  return council.enabled && activeSeats(council, env).length >= 2;
}

export function shouldConvene(council: CouncilSettings, intent: string, explicit: boolean, env: Env = process.env): boolean {
  if (!councilAvailable(council, env) || !(COUNCIL_INTENTS as readonly string[]).includes(intent)) return false;
  return explicit || council.intents.includes(intent);
}

export interface CouncilRun {
  question: string;
  history: EngineTurn[];
  /** Grounded briefing from the orchestrator: rules, enabled services, tool observations, safe facts. */
  briefing: string;
  lang: 'ar' | 'en';
  languageName: string;
  council: CouncilSettings;
  enginePolicy: EngineId[];
  temperature: number;
  env?: Env;
  fetch?: typeof fetch;
  signal: AbortSignal;
  seatTimeoutMs?: number;
  /** Visitor-visible progress ("the formulation expert gave an opinion"). */
  onStep: (ar: string, en: string) => void;
  /** Streams the chair's answer. */
  onToken?: (text: string) => void;
  /** The chair failed after streaming part of its answer: the client must drop the partial text. */
  onReset?: () => void;
}

export interface CouncilResult { reply?: string; chair?: ModelEngineId; transcript: CouncilTranscript }

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text);

function seatSystem(member: CouncilMember, label: string, run: CouncilRun): string {
  const role = COUNCIL_ROLES[member.role];
  return `You are seat ${label} on the advisory council of the Sham perfume platform. Your lens: ${role.brief}.
Other seats answer the same visitor question independently. Afterwards seats review each other anonymously, and a chair writes the single reply the visitor reads.
Give YOUR independent professional opinion in ${run.languageName}${run.lang === 'ar' ? ' (simple Modern Standard or Egyptian Arabic)' : ''}, at most ~140 words:
recommendation first, then the key reasoning, then risks or caveats, then what you are unsure about. No greetings, no headings longer than a few words.
${run.briefing}`;
}

function reviewSystem(member: CouncilMember, label: string, run: CouncilRun): string {
  return `You are seat ${label} (lens: ${COUNCIL_ROLES[member.role].brief}) on Sham's advisory council, now in the PEER REVIEW round.
You will see your previous position and the other seats' positions under anonymous letters. Judge the content only.
In ${run.languageName}, at most ~110 words:
1) Critique: concrete errors, unsafe or ungrounded claims (anything about Sham prices, stock, policies or timelines that is not in CONTEXT), and important missing points. Name the letter you criticise.
2) "Revised position:" your updated recommendation in 1–3 sentences. Change your mind when another seat is right.
${run.briefing}`;
}

function chairSystem(run: CouncilRun): string {
  const ar = run.lang === 'ar';
  return `You chair Sham's advisory council and write the ONE final consultative reply the visitor reads, in ${run.languageName}${ar ? ' (mirror the visitor\'s dialect, e.g. Egyptian)' : ''}.
Use the council record below: keep what the seats agree on, resolve disagreements with reasoning, drop claims a reviewer showed to be wrong or that contradict CONTEXT.
Never mention seat letters, model names, vendors or that you are an AI council; speak as Sham's advisor. At most ~230 words.
Use these short sections with headings in the reply language:
${ar ? '«الخلاصة» (جملة أو اثنتان)، «التوصية» (خطوات مرقمة)، «تنبيهات» (المخاطر وحدود المعلومة)، «نقطة خلاف» (فقط لو المستشارين اختلفوا فعلاً)، «الخطوة الجاية مع شام» (خدمة أو استمارة أو موظف من الخدمات المتاحة فقط).' : '"Bottom line" (1–2 sentences), "Recommendation" (numbered steps), "Caveats", "Where advisors differed" (only if they did), "Next step with Sham" (a service, form or human from ENABLED SERVICES only).'}
${run.briefing}`;
}

export async function runCouncil(run: CouncilRun): Promise<CouncilResult> {
  const started = Date.now();
  const statuses = engineStatuses(run.env || process.env);
  const seats = activeSeats(run.council, run.env || process.env);
  const seatTimeout = run.seatTimeoutMs ?? 15000;
  const signalFor = (ms: number) => AbortSignal.any([run.signal, AbortSignal.timeout(ms)]);
  const entries: CouncilEntry[] = seats.map((m, i) => ({
    memberId: m.id, label: String.fromCharCode(65 + i), engine: m.engine,
    model: m.model || statuses.find((s) => s.id === m.engine)!.model, role: m.role, reviews: [], ok: false, ms: 0,
  }));
  const name = (e: CouncilEntry) => seatTag(e, statuses);
  const ask = async (member: CouncilMember, system: string, turns: EngineTurn[], maxTokens: number, ms: number) => {
    try {
      return await callEngine(member.engine, system, turns, { env: run.env, fetch: run.fetch, temperature: Math.max(run.temperature, 0.4), signal: signalFor(ms), model: member.model, maxTokens });
    } catch { return undefined; }
  };

  run.onStep(`انعقاد المجلس الاستشاري: ${seats.length} مستشارين`, `Convening the advisory council: ${seats.length} advisors`);
  const history = run.history.slice(-6);

  // 1) Independent opinions, in parallel.
  await Promise.all(seats.map(async (member, i) => {
    const entry = entries[i];
    const t = Date.now();
    const opinion = await ask(member, seatSystem(member, entry.label, run), [...history, { role: 'user', text: run.question }], 450, seatTimeout);
    entry.ms = Date.now() - t;
    if (opinion) {
      entry.opinion = clip(opinion, 2500); entry.ok = true;
      run.onStep(`رأي ${COUNCIL_ROLES[member.role].ar} (${name(entry)})`, `${COUNCIL_ROLES[member.role].en} (${name(entry)}) gave an opinion`);
    }
  }));
  const voices = entries.filter((e) => e.ok);
  const finish = (outcome: CouncilTranscript['outcome'], chairEntry?: CouncilEntry): CouncilTranscript => ({
    entries, rounds: Math.max(0, ...entries.map((e) => e.reviews.length)), outcome, ms: Date.now() - started,
    ...(chairEntry ? { chair: { memberId: chairEntry.memberId, engine: chairEntry.engine, model: chairEntry.model } } : {}),
  });
  if (!voices.length || run.signal.aborted) return { transcript: finish('failed') };

  // 2) Anonymous peer review rounds.
  for (let round = 1; round <= run.council.rounds && voices.length >= 2 && !run.signal.aborted; round++) {
    run.onStep(`جولة النقاش ${round}: كل مستشار يراجع آراء الباقين`, `Debate round ${round}: advisors review each other`);
    const positions = new Map(voices.map((e) => [e.memberId, e.reviews.at(-1) || e.opinion!]));
    await Promise.all(voices.map(async (entry) => {
      const member = seats.find((m) => m.id === entry.memberId)!;
      const others = voices.filter((o) => o !== entry).map((o) => `### Position ${o.label} (lens: ${COUNCIL_ROLES[o.role].en})\n${positions.get(o.memberId)}`).join('\n\n');
      const text = `VISITOR QUESTION:\n${run.question}\n\nYOUR PREVIOUS POSITION (${entry.label}):\n${positions.get(entry.memberId)}\n\nOTHER POSITIONS:\n${others}`;
      const review = await ask(member, reviewSystem(member, entry.label, run), [{ role: 'user', text }], 350, Math.min(seatTimeout, 12000));
      if (review) entry.reviews.push(clip(review, 2000));
    }));
  }
  if (run.signal.aborted) return { transcript: finish('failed') };

  // 3) Synthesis by the chair (fixed seat, else policy order), streamed to the visitor.
  const order = run.council.chair !== 'auto' ? voices.filter((e) => e.memberId === run.council.chair) : [];
  const byPolicy = [...voices].sort((a, b) => rank(a.engine) - rank(b.engine));
  function rank(id: EngineId) { const i = run.enginePolicy.indexOf(id); return i < 0 ? 99 : i; }
  const chairs = [...order, ...byPolicy.filter((e) => !order.includes(e))];
  const record = voices.map((e) => `### Advisor ${e.label} (lens: ${COUNCIL_ROLES[e.role].en})\nOpinion: ${e.opinion}${e.reviews.map((r, i) => `\nReview round ${i + 1}: ${r}`).join('')}`).join('\n\n');
  const turns: EngineTurn[] = [...history.slice(-4), { role: 'user', text: `VISITOR QUESTION:\n${run.question}\n\nCOUNCIL RECORD:\n${record}` }];
  run.onStep('رئيس المجلس يكتب الرد الاستشاري', 'The chair is writing the consultative answer');
  for (const entry of chairs) {
    if (run.signal.aborted) break;
    const member = seats.find((m) => m.id === entry.memberId)!;
    let streamed = false;
    let reply: string | undefined;
    try {
      reply = await callEngine(member.engine, chairSystem(run), turns, {
        env: run.env, fetch: run.fetch, temperature: run.temperature, signal: signalFor(Math.max(seatTimeout, 18000)), model: member.model, maxTokens: 900,
        onToken: run.onToken ? (t) => { streamed = true; run.onToken!(t); } : undefined,
      });
    } catch { reply = undefined; }
    if (reply) return { reply, chair: entry.engine, transcript: finish(voices.length >= 2 ? 'synthesis' : 'single', entry) };
    if (run.signal.aborted) break;
    if (streamed) run.onReset?.();
  }
  return { transcript: finish('failed') };
}

/** Short seat name: the vendor for hosted APIs, the model for routers/self-hosted servers that host many models. */
function seatTag(e: Pick<CouncilEntry, 'engine' | 'model'>, statuses: ReturnType<typeof engineStatuses>) {
  return e.engine === 'self_hosted' || e.engine === 'openrouter' ? e.model : statuses.find((s) => s.id === e.engine)?.name || e.engine;
}

/** What visitors may see of the discussion (no internal ids or timings). */
export function publicTranscript(t: CouncilTranscript, lang: 'ar' | 'en', env: Env = process.env) {
  const statuses = engineStatuses(env);
  return {
    outcome: t.outcome, rounds: t.rounds,
    entries: t.entries.filter((e) => e.ok).map((e) => ({
      label: e.label, role: lang === 'ar' ? COUNCIL_ROLES[e.role].ar : COUNCIL_ROLES[e.role].en,
      engine: seatTag(e, statuses), opinion: e.opinion || '', reviews: e.reviews,
      chair: t.chair?.memberId === e.memberId,
    })),
  };
}
export type PublicCouncil = ReturnType<typeof publicTranscript>;
