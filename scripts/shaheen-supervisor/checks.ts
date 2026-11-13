/**
 * «مشرف شاهين» — pure logic: automatic answer checks, scoring, Shaheen's review prompt, and the
 * guidance life-cycle (adopt when a tool is weak, keep while it helps, roll back if the tool got worse).
 * Tested in tests/shaheenSupervisor.test.ts.
 */
import { AI_TOOLS, type AiToolId } from '../../src/utils/aiTools';

export interface Probe {
  tool: AiToolId; question: string; answer: string; ms: number; ok: boolean; error?: string;
  findings: Finding[];
}
export interface Finding { severe: boolean; text: string }
export interface Guidance { text: string; since: string; baseline: number }
export interface ToolReport {
  nameAr: string; score: number | null; autoScore: number | null; judged: boolean; status: 'ok' | 'warn' | 'fail' | 'skipped';
  checkedAt: string; strengths: string[]; issues: string[];
  samples: { question: string; excerpt: string; ms: number; ok: boolean; findings: string[] }[];
  history: { at: string; score: number }[];
  guidance?: Guidance; previousGuidance?: Guidance;
  lastEvent: 'updated' | 'rolled_back' | 'kept' | 'none';
}
export interface SupervisorFile {
  version: 1; updatedAt: string; nextReviewAt: string; intervalHours: number;
  summaryAr: string; overall: number | null; tools: Partial<Record<AiToolId, ToolReport>>;
}
export type Ask = (system: string, prompt: string) => Promise<string>;

export const INTERVAL_HOURS = 12;
const VENDOR = /\b(?:gemini|openai|chat ?gpt|gpt-?[345o]|claude|anthropic|deepseek|openrouter|perplexity|llama|mistral|bard)\b|جيميني|جيمناي|شات ?جي ?بي ?تي|كلود|ديب ?سيك/i;
const SELF_AS_AI = /(?:كنموذج لغوي|بصفتي نموذج|أنا نموذج ذكاء|لا أستطيع تصفح|ليس لدي (?:إمكانية|قدرة) الوصول إلى الإنترنت|as an ai(?: language)? model|i am an ai model|i cannot browse|i don'?t have access to (?:the )?internet)/i;
const HIDDEN_FENCE = /```sham-(?:formula|media|tool)[\s\S]*?```/g;

/** The text a visitor actually sees (Shaheen's hidden data fences are rendered by the site, not shown). */
export const visibleText = (answer: string) => answer.replace(HIDDEN_FENCE, '').trim();
const arabicShare = (text: string) => {
  const letters = text.match(/\p{L}/gu) || [];
  return letters.length ? letters.filter((l) => /[\u0600-\u06FF]/.test(l)).length / letters.length : 0;
};

/** Automatic checks on one answer, before Shaheen reads it. */
export function inspectAnswer(answer: string, options: { language?: 'ar' | 'en'; maxChars?: number; vendorNamesAllowed?: boolean; ms?: number } = {}): Finding[] {
  const findings: Finding[] = [];
  const add = (severe: boolean, text: string) => findings.push({ severe, text });
  const text = visibleText(answer);
  if (text.length < 20) { add(true, 'الرد فارغ أو قصير جداً'); return findings; }
  if (!options.vendorNamesAllowed && VENDOR.test(answer)) add(true, 'ظهر اسم شركة أو نموذج ذكاء اصطناعي للزائر');
  if (/\[object Object\]|(?<![\p{L}])(?:undefined|NaN)(?![\p{L}])/u.test(text)) add(true, 'ظهرت قيمة برمجية خام (undefined / NaN / [object Object])');
  if (options.language === 'ar' && arabicShare(text) < 0.3) add(true, 'الرد ليس بالعربية رغم أن السؤال بالعربية');
  if (options.language === 'en' && arabicShare(text) > 0.5) add(true, 'الرد بالعربية رغم أن السؤال بالإنجليزية');
  if (SELF_AS_AI.test(text)) add(false, 'يتكلم عن نفسه كنموذج ذكاء اصطناعي أو يقول إنه لا يصل للإنترنت');
  if ((text.match(/```/g) || []).length % 2) add(false, 'سياج كود غير مغلق يظهر للزائر');
  if (/(?:^|\n)\s*[[{]\s*"[\w-]+"\s*:/.test(text)) add(false, 'يظهر JSON خام في الرد');
  if (options.maxChars && text.length > options.maxChars) add(false, `الرد طويل جداً (${text.length} حرف)`);
  if (options.ms !== undefined && options.ms > 45_000) add(true, `بطء شديد (${Math.round(options.ms / 1000)} ث)`);
  else if (options.ms !== undefined && options.ms > 25_000) add(false, `بطء (${Math.round(options.ms / 1000)} ث)`);
  return findings;
}

/** 0–10 from the automatic checks alone. */
export function autoScore(probes: Probe[]): number | null {
  if (!probes.length) return null;
  const each = probes.map((p) => (!p.ok ? 0 : Math.max(0, 10 - 3 * p.findings.filter((f) => f.severe).length - p.findings.filter((f) => !f.severe).length)));
  return round(each.reduce((a, b) => a + b, 0) / each.length);
}
const round = (n: number) => Math.round(n * 10) / 10;

/** Shaheen's judgement weighs more, but a broken tool can never look healthy. */
export function finalScore(auto: number | null, judge: number | undefined, probes: Probe[]): number | null {
  if (auto === null) return null;
  let score = judge === undefined ? auto : round(0.6 * judge + 0.4 * auto);
  if (probes.some((p) => !p.ok)) score = Math.min(score, 5);
  if (probes.some((p) => p.findings.some((f) => f.severe))) score = Math.min(score, 7);
  return score;
}
export const statusOf = (score: number | null): ToolReport['status'] => (score === null ? 'skipped' : score >= 8 ? 'ok' : score >= 6 ? 'warn' : 'fail');

// ---------------------------------------------------------------- Shaheen's review

export const REVIEW_SYSTEM = `أنت «الخبير شاهين»، خبير العطور والمشرف على كل أدوات الذكاء الاصطناعي في منصة «صمم عطرك مع شام».
تقرأ عينات حقيقية من ردود كل أداة الآن، مع نتائج الفحص الآلي، وتقيّمها بصرامة وإنصاف: صحة المعلومات العطرية والحسابات، الالتزام بطبيعة الأداة، الوضوح وسهولة القراءة، اللغة المناسبة للزائر، عدم الاختلاق، الأمان، وعدم ظهور أي اسم لشركة أو نموذج ذكاء اصطناعي للزائر.
ثم تكتب لكل أداة «توجيهات الجودة» التي ستُضاف إلى تعليماتها لتحسين أدائها: من 3 إلى 6 نقاط قصيرة بصيغة الأمر بالعربية، مبنية على ما رأيته فعلاً في العينات، تحافظ على النقاط السابقة المفيدة، ولا تطلب ميزات غير موجودة، ولا تخالف قواعد الأمان، ولا تذكر أسماء شركات أو نماذج ذكاء اصطناعي، ولا روابط. اترك التوجيهات فارغة إذا كانت الأداة ممتازة ولا تحتاج تغييراً.
أعد JSON فقط بلا أي نص آخر.`;

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)} [اقتطاع من المشرف]` : text);

export function reviewPrompt(tools: { id: AiToolId; guidance?: string; goal?: string; probes: Probe[] }[]) {
  const blocks = tools.map(({ id, guidance, goal, probes }) => {
    const def = AI_TOOLS.find((t) => t.id === id)!;
    const samples = probes.map((p, i) => `  [${i + 1}] السؤال/الطلب: ${p.question}\n  الزمن: ${Math.round(p.ms / 100) / 10} ث${p.ok ? '' : ` · فشل: ${p.error || ''}`}\n  الفحص الآلي: ${p.findings.map((f) => f.text).join('، ') || 'سليم'}\n  الرد: ${clip(visibleText(p.answer), 1800).replace(/\n{3,}/g, '\n\n')}`).join('\n');
    return `### ${id} — ${def.nameAr}\nطبيعة الأداة: ${def.descriptionAr}\n${def.acceptsGuidance ? `التوجيهات الحالية: ${guidance || 'لا يوجد'}` : 'هذه الأداة لا تقرأ توجيهات (قيّمها فقط واترك guidance فارغاً).'}${goal ? `\nهدف التطوير من اجتماع شاهين اليومي: ${goal.slice(0, 400)}${def.acceptsGuidance ? ' (ادمج ما يناسب منه في guidance وقيّم مدى تحققه)' : ' (قيّم مدى تحققه)'}` : ''}\nالعينات:\n${samples}`;
  });
  return `${blocks.join('\n\n')}\n
أعد بالشكل:
{"summary":"جملتان عن حالة أدوات الموقع اليوم","tools":{"<id>":{"score":1,"strengths":["…"],"issues":["…"],"guidance":"- نقطة\\n- نقطة"}}}
score من 1 إلى 10: كن صارماً — 10 فقط لرد بلا أي ملاحظة، 8 لرد جيد فيه ملاحظة صغيرة، 6 لرد مقبول يحتاج تحسيناً واضحاً، وأقل من ذلك لرد خاطئ أو مضلل. اكتب issues محددة (ما الخطأ وأين)، وstrengths قصيرة.
ملاحظة: بعض العينات مقتطعة عمداً بواسطة المشرف ومكتوب عندها «[اقتطاع من المشرف]» — لا تعتبر ذلك عيباً في الأداة.`;
}

export function parseJson(text: string): unknown {
  const body = text.replace(/```(?:json)?/gi, '').trim();
  const start = body.indexOf('{'); const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('No JSON object in the reply');
  return JSON.parse(body.slice(start, end + 1));
}

/** Guidance must be short Arabic advice: no vendor names, links or attempts to lift the rules. */
export function cleanGuidance(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.replace(/\r/g, '').replace(/[\u0590-\u05FF]/g, '').replace(/\n{2,}/g, '\n').trim().slice(0, 900);
  if (text.length < 20 || !/[\u0600-\u06FF]/.test(text) || VENDOR.test(text) || /https?:\/\//i.test(text)) return undefined;
  if (/(?:تجاهل|ألغِ|الغ|اكسر|تخط|تخطى)\S*\s+(?:\S+\s+){0,3}(?:القواعد|التعليمات|قواعد)|ignore (?:all |the )?(?:previous |above )?(?:rules|instructions)/i.test(text)) return undefined;
  return text;
}

export interface Review { summary?: string; tools: Partial<Record<AiToolId, { score?: number; strengths: string[]; issues: string[]; guidance?: string }>> }
export function readReview(reply: unknown): Review {
  const data = (reply && typeof reply === 'object' ? reply : {}) as { summary?: unknown; tools?: unknown };
  const tools: Review['tools'] = {};
  const raw = (data.tools && typeof data.tools === 'object' ? data.tools : {}) as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === 'string' && !VENDOR.test(x)).map((x) => x.trim().slice(0, 240)).filter(Boolean).slice(0, 6);
  for (const def of AI_TOOLS) {
    const r = raw[def.id];
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const score = Number(o.score);
    tools[def.id] = {
      score: Number.isFinite(score) && score >= 1 && score <= 10 ? score : undefined,
      strengths: list(o.strengths), issues: list(o.issues),
      guidance: def.acceptsGuidance ? cleanGuidance(o.guidance) : undefined,
    };
  }
  const summary = typeof data.summary === 'string' && !VENDOR.test(data.summary) ? data.summary.trim().slice(0, 600) : undefined;
  return { summary, tools };
}

// ---------------------------------------------------------------- guidance life-cycle

/**
 * - The tool got clearly worse since the current guidance was adopted → roll back to the previous one.
 * - The tool is below 8.5 and Shaheen wrote new guidance → adopt it (remember the old one and today's score).
 * - Otherwise keep what works.
 */
export function evolveGuidance(previous: ToolReport | undefined, score: number | null, proposed: string | undefined, now: string)
  : Pick<ToolReport, 'guidance' | 'previousGuidance' | 'lastEvent'> {
  const current = previous?.guidance;
  if (score === null) return { guidance: current, previousGuidance: previous?.previousGuidance, lastEvent: current ? 'kept' : 'none' };
  if (current && current.since < now && score <= current.baseline - 1.5) {
    return { guidance: previous?.previousGuidance, previousGuidance: undefined, lastEvent: 'rolled_back' };
  }
  if (proposed && proposed !== current?.text && score < 8.5) {
    return { guidance: { text: proposed, since: now, baseline: score }, previousGuidance: current, lastEvent: 'updated' };
  }
  return { guidance: current, previousGuidance: previous?.previousGuidance, lastEvent: current ? 'kept' : 'none' };
}

export function buildReport(input: {
  previous?: SupervisorFile; probes: Partial<Record<AiToolId, Probe[]>>; review?: Review; now?: Date; skipped?: AiToolId[];
}): SupervisorFile {
  const now = (input.now || new Date()).toISOString();
  const tools: SupervisorFile['tools'] = {};
  for (const def of AI_TOOLS) {
    const probes = input.probes[def.id] || [];
    const prev = input.previous?.tools[def.id];
    if (!probes.length) {
      if (prev) tools[def.id] = { ...prev, status: 'skipped', lastEvent: 'none' };
      continue;
    }
    const judged = input.review?.tools[def.id];
    const auto = autoScore(probes);
    const score = finalScore(auto, judged?.score, probes);
    const autoIssues = [...new Set(probes.flatMap((p) => [...(p.ok ? [] : [`فشل الطلب: ${p.error || 'خطأ'}`]), ...p.findings.map((f) => f.text)]))];
    tools[def.id] = {
      nameAr: def.nameAr, score, autoScore: auto, judged: judged?.score !== undefined, status: statusOf(score), checkedAt: now,
      strengths: judged?.strengths || [], issues: [...autoIssues, ...(judged?.issues || [])].slice(0, 10),
      samples: probes.map((p) => ({ question: p.question.slice(0, 200), excerpt: visibleText(p.answer).slice(0, 300), ms: p.ms, ok: p.ok, findings: p.findings.map((f) => f.text) })),
      history: [...(prev?.history || []), ...(score === null ? [] : [{ at: now, score }])].slice(-30),
      // An outage says nothing about the guidance: only evolve it when every request was answered.
      ...evolveGuidance(prev, probes.every((p) => p.ok) ? score : null, def.acceptsGuidance ? judged?.guidance : undefined, now),
    };
  }
  const scores = Object.values(tools).map((t) => (t?.status === 'skipped' ? null : t?.score)).filter((s): s is number => typeof s === 'number');
  const overall = scores.length ? round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const weak = Object.values(tools).filter((t) => t && (t.status === 'warn' || t.status === 'fail')).map((t) => t!.nameAr);
  return {
    version: 1, updatedAt: now, nextReviewAt: new Date(Date.parse(now) + INTERVAL_HOURS * 3600_000).toISOString(), intervalHours: INTERVAL_HOURS,
    summaryAr: input.review?.summary || (weak.length ? `أدوات تحتاج متابعة: ${weak.join('، ')}.` : 'كل الأدوات المفحوصة سليمة.'),
    overall, tools,
  };
}
