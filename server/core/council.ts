/**
 * Sham advisory council — several language models deliberate before the visitor gets one answer.
 *
 *   1. Opinions : every seat answers independently and in parallel (no seat sees another yet).
 *   2. Review   : each seat reads the others' positions under anonymous letters (A, B, C…), points out
 *                 mistakes, unsafe or ungrounded claims and missing points, then states a revised
 *                 position with explicit convergence. Anonymity keeps models from deferring to a brand name.
 *   3. Synthesis: a chair seat (weighted by domain expertise + admin policy) receives automatic
 *                 CONTEXT fact-check audits and disagreement analysis, then writes one consultative reply.
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
const MODEL_ENGINES: ModelEngineId[] = ['self_hosted', 'gemini', 'openai', 'claude', 'deepseek', 'openrouter', 'perplexity'];
/** Intents that can convene the council (never for tracking, calculations, greetings or privacy).
 *  `platform_help` is included: a question about a new tool is worth several expert opinions too. */
export const COUNCIL_INTENTS = ['perfume_expert', 'question', 'service_request', 'browse_products', 'list_services', 'platform_help'] as const;
export const MAX_SEATS = 5;

/** Invalid council settings; the repository maps it to a 400 ValidationError. */
export class CouncilConfigError extends Error {}

/**
 * Calculates domain expertise weight (0.8–1.5) for a council seat given the intent and visitor question.
 * Formulation questions elevate `formulator` & `safety`; skin/allergy/IFRA questions elevate `safety`;
 * pricing/wholesale/B2B questions elevate `commercial` & `customer`.
 */
export function roleExpertiseWeight(role: CouncilRole, intent = 'perfume_expert', question = ''): number {
  const safetyTopic = /(?:حساسية|جلد|حامل|أطفال|امان|سلامة|ifra|allerg|skin|safe|pregnant|irritat)/i.test(question);
  const commercialTopic = /(?:سعر|جملة|كمية|تكلفة|مصنع|تجاري|b2b|wholesale|price|cost|bulk|margin)/i.test(question)
    || intent === 'service_request' || intent === 'browse_products';

  if (safetyTopic) {
    const map: Record<CouncilRole, number> = { safety: 1.45, formulator: 1.25, customer: 1.05, general: 1.0, commercial: 0.9 };
    return map[role];
  }
  if (commercialTopic) {
    const map: Record<CouncilRole, number> = { commercial: 1.4, customer: 1.2, safety: 1.05, general: 1.0, formulator: 0.95 };
    return map[role];
  }
  const map: Record<CouncilRole, number> = { formulator: 1.35, safety: 1.25, customer: 1.05, general: 1.0, commercial: 0.95 };
  return map[role];
}

export interface CouncilFactCheck {
  grounded: boolean;
  unverifiedClaims: string[];
}

/**
 * Automatically checks a seat's text against the grounded `briefing` (`CONTEXT`):
 * flags unverified currency amounts, fabricated `SH-` order references, or unauthorized order claims.
 */
export function auditCouncilFactCheck(text: string, briefing: string): CouncilFactCheck {
  const unverifiedClaims: string[] = [];
  const upperBriefing = briefing.toUpperCase();
  const allowedNums = new Set(
    [...briefing.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).matchAll(/\d+(?:\.\d+)?/g)].map((m) => String(Number(m[0]))),
  );

  for (const m of text.matchAll(/\bSH-[A-Z0-9]{6}\b/gi)) {
    const ref = m[0].toUpperCase();
    if (ref !== 'SH-XXXXXX' && !upperBriefing.includes(ref)) unverifiedClaims.push(`unverified order ref ${ref}`);
  }
  for (const m of text.matchAll(/(?:^|\s|\()(\d{2,6}(?:[.,]\d{1,2})?)\s*(?:EGP|USD|SAR|AED|جنيه|ج\.م|ريال|درهم|دولار)(?=$|\s|[،,.!؟?;:)\]])/giu)) {
    const num = String(Number(m[1].replace(',', '.')));
    if (!allowedNums.has(num)) unverifiedClaims.push(`unverified price ${m[0]}`);
  }
  if (/(?:تم تأكيد طلبك رسميا|تم الدفع بنجاح|order has been placed and paid)/i.test(text)) {
    unverifiedClaims.push('unauthorized order confirmation claim');
  }
  return { grounded: unverifiedClaims.length === 0, unverifiedClaims };
}

export interface DisagreementAnalysis {
  hasDisagreement: boolean;
  agreementScore: number;
  points: string[];
}

/**
 * Detects substantive disagreement across seat opinions/reviews: checks explicit refutation markers,
 * conflicting concentration/dosage percentages, and caution vs. unconditional approval divergence.
 */
export function detectCouncilDisagreement(
  positions: Array<{ label: string; role: CouncilRole; text: string }>,
): DisagreementAnalysis {
  if (positions.length < 2) return { hasDisagreement: false, agreementScore: 1, points: [] };
  const points: string[] = [];
  let penalty = 0;

  const disputeCue = /(?:أختلف|غير صحيح|لا أنصح|خطأ في|تحذير|خطر|مخالف|disagree|incorrect|unsafe|contradicts|do not recommend)/i;
  for (const p of positions) {
    if (disputeCue.test(p.text)) {
      penalty += 0.22;
      points.push(`Advisor ${p.label} (${p.role}) raised a critique or safety objection`);
    }
  }

  // Detect conflicting numeric percentage recommendations across seats (spread >= 10 percentage points).
  const seatPercents = positions
    .map((p) => {
      const m = p.text.match(/(\d{1,2}(?:\.\d+)?)\s*(?:%|٪)/);
      return m ? { label: p.label, pct: Number(m[1]) } : undefined;
    })
    .filter((x): x is { label: string; pct: number } => Boolean(x));
  if (seatPercents.length >= 2) {
    const pcts = seatPercents.map((x) => x.pct);
    const spread = Math.max(...pcts) - Math.min(...pcts);
    if (spread >= 10) {
      penalty += 0.25;
      points.push(`Concentration spread across advisors (${Math.min(...pcts)}% vs ${Math.max(...pcts)}%)`);
    }
  }

  const agreementScore = Math.max(0.15, Math.min(1, Number((1 - penalty).toFixed(2))));
  return {
    hasDisagreement: points.length > 0,
    agreementScore,
    points,
  };
}

export function defaultCouncil(): CouncilSettings {
  const seat = (engine: ModelEngineId, role: CouncilRole): CouncilMember => ({ id: `seat-${engine}`, engine, role, enabled: true });
  return {
    enabled: true,
    members: [seat('self_hosted', 'general'), seat('gemini', 'formulator'), seat('claude', 'safety'), seat('openai', 'commercial'), seat('deepseek', 'customer'), seat('perplexity', 'commercial')],
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
  intent?: string;
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
2) Convergence: state AGREE / PARTIALLY AGREE / DISAGREE on disputed points so the council converges toward safe, verified consensus.
3) "Revised position:" your updated recommendation in 1–3 sentences. Change your mind when another seat is right.
${run.briefing}`;
}

function chairSystem(run: CouncilRun, disagreement: DisagreementAnalysis): string {
  const ar = run.lang === 'ar';
  const convergenceNote = disagreement.hasDisagreement
    ? `DISAGREEMENT DETECTED (agreement=${disagreement.agreementScore}): ${disagreement.points.join('; ')}. Weigh higher-expertise seats more heavily, drop any [FACT-CHECK WARNING] claims, and explain the practical resolution clearly.`
    : `CONSENSUS HIGH (agreement=${disagreement.agreementScore}): seats broadly converge; omit "Where advisors differed" unless a substantive nuance remains.`;
  return `You chair Sham's advisory council and write the ONE final consultative reply the visitor reads, in ${run.languageName}${ar ? ' (mirror the visitor\'s dialect, e.g. Egyptian)' : ''}.
Use the council record below: keep what the seats agree on, resolve disagreements with reasoning, drop claims a reviewer showed to be wrong or that contradict CONTEXT.
${convergenceNote}
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
  // Visitors see neutral advisor letters, never vendors or model names (those stay in the admin trace).
  const name = (e: CouncilEntry) => `المستشار ${e.label}`;
  const nameEn = (e: CouncilEntry) => `Advisor ${e.label}`;
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
      run.onStep(`رأي ${COUNCIL_ROLES[member.role].ar} (${name(entry)})`, `${COUNCIL_ROLES[member.role].en} (${nameEn(entry)}) gave an opinion`);
    }
  }));
  const voices = entries.filter((e) => e.ok);
  const finish = (outcome: CouncilTranscript['outcome'], chairEntry?: CouncilEntry): CouncilTranscript => ({
    entries, rounds: Math.max(0, ...entries.map((e) => e.reviews.length)), outcome, ms: Date.now() - started,
    ...(chairEntry ? { chair: { memberId: chairEntry.memberId, engine: chairEntry.engine, model: chairEntry.model } } : {}),
  });
  if (!voices.length || run.signal.aborted) return { transcript: finish('failed') };

  // Automatic CONTEXT fact-checking on initial opinions before peer review & synthesis.
  const audits = new Map(voices.map((e) => [e.memberId, auditCouncilFactCheck(e.opinion || '', run.briefing)]));

  // 2) Anonymous peer review rounds with fact-check flags & convergence requirement.
  for (let round = 1; round <= run.council.rounds && voices.length >= 2 && !run.signal.aborted; round++) {
    run.onStep(`جولة النقاش ${round}: كل مستشار يراجع آراء الباقين`, `Debate round ${round}: advisors review each other`);
    const positions = new Map(voices.map((e) => [e.memberId, e.reviews.at(-1) || e.opinion!]));
    await Promise.all(voices.map(async (entry) => {
      const member = seats.find((m) => m.id === entry.memberId)!;
      const others = voices.filter((o) => o !== entry).map((o) => {
        const audit = audits.get(o.memberId);
        const flag = audit && !audit.grounded ? `\n[FACT-CHECK WARNING: ${audit.unverifiedClaims.join('; ')}]` : '';
        return `### Position ${o.label} (lens: ${COUNCIL_ROLES[o.role].en})\n${positions.get(o.memberId)}${flag}`;
      }).join('\n\n');
      const text = `VISITOR QUESTION:\n${run.question}\n\nYOUR PREVIOUS POSITION (${entry.label}):\n${positions.get(entry.memberId)}\n\nOTHER POSITIONS:\n${others}`;
      const review = await ask(member, reviewSystem(member, entry.label, run), [{ role: 'user', text }], 350, Math.min(seatTimeout, 12000));
      if (review) {
        entry.reviews.push(clip(review, 2000));
        audits.set(entry.memberId, auditCouncilFactCheck(`${entry.opinion || ''}\n${review}`, run.briefing));
      }
    }));
  }
  if (run.signal.aborted) return { transcript: finish('failed') };

  // 3) Expertise weighting + substantive disagreement detection + chair synthesis.
  const weights = new Map(voices.map((e) => [e.memberId, roleExpertiseWeight(e.role, run.intent, run.question)]));
  const disagreement = detectCouncilDisagreement(voices.map((e) => ({
    label: e.label,
    role: e.role,
    text: e.reviews.at(-1) || e.opinion || '',
  })));

  const order = run.council.chair !== 'auto' ? voices.filter((e) => e.memberId === run.council.chair) : [];
  function rank(id: EngineId) { const i = run.enginePolicy.indexOf(id); return i < 0 ? 99 : i; }
  const byPolicyAndExpertise = [...voices].sort((a, b) =>
    rank(a.engine) - rank(b.engine) || (weights.get(b.memberId) || 1) - (weights.get(a.memberId) || 1),
  );
  const chairs = [...order, ...byPolicyAndExpertise.filter((e) => !order.includes(e))];
  const record = voices.map((e) => {
    const w = (weights.get(e.memberId) || 1).toFixed(2);
    const audit = audits.get(e.memberId);
    const auditLine = audit && !audit.grounded ? `\n[FACT-CHECK WARNING: ${audit.unverifiedClaims.join('; ')}]` : '';
    return `### Advisor ${e.label} (lens: ${COUNCIL_ROLES[e.role].en}, expertise-weight: ${w})\nOpinion: ${e.opinion}${e.reviews.map((r, i) => `\nReview round ${i + 1}: ${r}`).join('')}${auditLine}`;
  }).join('\n\n');
  const turns: EngineTurn[] = [...history.slice(-4), { role: 'user', text: `VISITOR QUESTION:\n${run.question}\n\nCOUNCIL RECORD:\n${record}` }];
  run.onStep('رئيس المجلس يكتب الرد الاستشاري', 'The chair is writing the consultative answer');
  for (const entry of chairs) {
    if (run.signal.aborted) break;
    const member = seats.find((m) => m.id === entry.memberId)!;
    let streamed = false;
    let reply: string | undefined;
    try {
      reply = await callEngine(member.engine, chairSystem(run, disagreement), turns, {
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

/** What visitors may see of the discussion: roles and anonymous letters only (no vendors, models, ids or timings). */
export function publicTranscript(t: CouncilTranscript, lang: 'ar' | 'en', _env: Env = process.env) {
  return {
    outcome: t.outcome, rounds: t.rounds,
    entries: t.entries.filter((e) => e.ok).map((e) => ({
      label: e.label, role: lang === 'ar' ? COUNCIL_ROLES[e.role].ar : COUNCIL_ROLES[e.role].en,
      engine: '', opinion: e.opinion || '', reviews: e.reviews,
      chair: t.chair?.memberId === e.memberId,
    })),
  };
}
export type PublicCouncil = ReturnType<typeof publicTranscript>;
