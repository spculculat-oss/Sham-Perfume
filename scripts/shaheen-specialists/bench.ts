/**
 * «تدريب مجلس المتخصصين» — the board's training bench.
 *
 * بيشغّل بنك الأسئلة (`questions.ts`) على الوكيل الحقيقي (`server/specialists/agent.ts`) بنفس
 * الأرشيف اللي بيقابله في الإنتاج:
 *   · دروس مكتبة شاهين (نسخة الموقع المحفوظة من `src/data/live/sham-training.json`)،
 *   · موسوعة المواد الخام، وعلوم مدرسة شاهين (135 درس)، ومتجر شام بمنتجاته الحقيقية،
 *   · ذاكرة شاهين، وملجأ شاهين، ونشرة أخبار العطور.
 *
 * وكله **من غير أي ذكاء اصطناعي ومن غير شبكة**: مفيش مفاتيح في البيئة، و`fetch` بيرمي خطأ — فالنتيجة
 * اللي بتطلع هنا هي اللي هيشوفها الزائر لو المحركات كلها وقفت (الاعتماد على النفس).
 *
 * كل حالة بتتقاس على حاجتين: توقعاتها هي، وقواعد المنصة اللي على كل رد (مصدره مكتوب، لغة الزائر،
 * مفيش اسم مزوّد، مفيش رد أطول من الحد). التقرير بيطلع على الشاشة — مافيش ملف بيتكتب.
 *
 * الاستعمال: node --import tsx scripts/shaheen-specialists/train.mts [--verbose] [اسم مهارة أو حالة]
 */
import { RAW_MATERIALS_DATABASE } from '../../src/data/rawMaterials';
import trainingDocs from '../../src/data/live/sham-training.json';
import { AGENT_LIMITS, runSpecialistAgent, type SpecialistConsultResult } from '../../server/specialists/agent';
import { hasSourceLine } from '../../server/specialists/present';
import { Repository } from '../../server/core/repository';
import { ShaheenMemory } from '../../server/core/memory';
import { createStore } from '../../server/core/store';
import type { LibraryLesson } from '../../src/utils/shaheenLibrary';
import { emptyMemory } from '../../src/utils/shaheenMemory';
import { SKILL_LABELS_AR, TRAINING_CASES, type TrainingCase, type TrainingSkill } from './questions';

/** أي اسم مزوّد أو منصة — ممنوع يظهر للزائر (قاعدة المنصة). */
const VENDOR = /\b(?:gemini|gemma|openai|chat ?gpt|gpt-?\d|claude|anthropic|deepseek|openrouter|perplexity|llama|mistral|qwen|grok|manus|bard|copilot)\b/i;
const ARABIC = /[\u0600-\u06FF]/;

/** المقارنة من غير تشكيل ولا فرق بين أ/إ/آ ولا ة/ه ولا ى/ي — زي ما الزائر بيكتب فعلاً. */
const fold = (text: string) => text
  .replace(/[\u064B-\u0652\u0640\u0670]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
  .replace(/\s+/g, ' ');

type Doc = { id?: unknown; title?: unknown; content?: unknown; tags?: unknown };
/** دروس المكتبة زي ما الإنتاج بيقرأها (نفس الفلترة في server/core/liveData.ts). */
function bundledLessons(): LibraryLesson[] {
  const docs = ((trainingDocs as { docs?: Doc[] }).docs || []) as Doc[];
  return docs
    .filter((d): d is { id: string; title: string; content: string; tags?: string[] } =>
      Boolean(d) && typeof d.id === 'string' && typeof d.title === 'string' && typeof d.content === 'string')
    .map((d) => ({ id: d.id, title: d.title, content: d.content, tags: Array.isArray(d.tags) ? d.tags.filter((t): t is string => typeof t === 'string') : [] }));
}

interface Core { repo: Repository; memory: ShaheenMemory; env: Record<string, string | undefined>; lessons: LibraryLesson[] }
let core: Core | undefined;

/**
 * بيئة التدريب: مستودع وذاكرة على الذاكرة المؤقتة (مفيش كتابة على القرص أبداً)، وبيانات حية مقفولة
 * (ردود ثابتة)، و`fetch` واقع — أي شبكة في الرد معناها إن الحالة مش معتمدة على نفسها.
 */
export async function trainingCore(): Promise<Core> {
  if (core) return core;
  const env: Record<string, string | undefined> = { SHAM_STORE: 'memory', SHAM_LIVE_DATA: 'off' };
  const offline = (async () => { throw new Error('offline: the training bench never calls the network'); }) as unknown as typeof fetch;
  const store = createStore(env);
  const repo = new Repository(store, env);
  await repo.ready();
  const memory = new ShaheenMemory(store, env, offline, emptyMemory(), store);
  core = { repo, memory, env, lessons: bundledLessons() };
  return core;
}

export interface CaseOutcome {
  id: string;
  skill: TrainingSkill;
  ask: string;
  ok: boolean;
  problems: string[];
  ms: number;
  specialist: string;
  source: string;
  confidence?: string;
  answer: string;
  tools: string[];
  gaps: { question: string; reason?: string }[];
}

export interface TrainingReport {
  outcomes: CaseOutcome[];
  pass: number;
  fail: number;
  totalMs: number;
  lessons: number;
  bySource: Record<string, number>;
}

/** حالة واحدة: تشغّل الوكيل، وتقارن الرد بتوقعات الحالة وبقواعد المنصة على كل رد. */
export async function runCase(item: TrainingCase): Promise<CaseOutcome> {
  const { repo, memory, env, lessons } = await trainingCore();
  const lang = item.lang === 'en' ? 'en' : 'ar';
  const gaps: { question: string; reason?: string }[] = [];
  // مستودع الزيارة: نفس المستودع، بس بنعد الفجوات اللي اتسجلت في الحالة دي.
  const counted = Object.assign(Object.create(repo), {
    recordGap: async (input: Parameters<Repository['recordGap']>[0]) => {
      gaps.push({ question: input.question, ...(input.reason ? { reason: input.reason } : {}) });
      return repo.recordGap(input);
    },
  }) as Repository;
  for (const entry of item.memory || []) await memory.learn({ ...entry, lang, mode: 'auto' }).catch(() => false);

  const started = Date.now();
  const offline = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
  const result: SpecialistConsultResult = await runSpecialistAgent(
    {
      question: item.ask, lang,
      ...(item.previous ? { history: [{ role: 'user' as const, text: item.previous }] } : {}),
      ...(item.section ? { section: item.section } : {}),
      ...(item.specialistId ? { specialistId: item.specialistId } : {}),
    },
    {
      repo: counted, memory, env, fetch: offline,
      library: async () => ({ lessons, materials: RAW_MATERIALS_DATABASE, memory: await memory.all().catch(() => undefined) }),
    },
  );
  const ms = Date.now() - started;

  const problems: string[] = [];
  const answer = result.answer || '';
  const folded = fold(answer);

  /* قواعد المنصة على كل رد — بتتقاس على كل حالة مهما كانت توقعاتها. */
  if (answer.trim().length < 20) problems.push('الرد أقصر من 20 حرف');
  if (answer.length > AGENT_LIMITS.maxAnswerChars) problems.push(`الرد أطول من الحد (${AGENT_LIMITS.maxAnswerChars})`);
  if (!hasSourceLine(answer) && result.source !== 'gap') problems.push('الرد مافيهوش سطر مصدر');
  if (VENDOR.test(answer)) problems.push('الرد فيه اسم مزوّد أو منصة');
  if (lang === 'ar' && !ARABIC.test(answer)) problems.push('سؤال عربي والرد مافيهوش عربي');
  if (lang === 'en' && ARABIC.test(answer) && !/[a-z]{4}/i.test(answer)) problems.push('سؤال إنجليزي والرد عربي');
  if (!result.tools.length) problems.push('مفيش أداة اشتغلت في الزيارة');

  /* توقعات الحالة. */
  const expect = item.expect;
  if (expect.specialist) {
    const wanted = Array.isArray(expect.specialist) ? expect.specialist : [expect.specialist];
    if (!wanted.includes(result.specialist.id)) problems.push(`المتخصص ${result.specialist.id} والمطلوب ${wanted.join(' أو ')}`);
  }
  if (expect.source && !expect.source.includes(result.source)) problems.push(`المصدر ${result.source} والمطلوب ${expect.source.join(' أو ')}`);
  if (expect.ok !== undefined && result.ok !== expect.ok) problems.push(`ok=${result.ok} والمطلوب ${expect.ok}`);
  if (expect.recorded !== undefined && result.recorded !== expect.recorded) problems.push(`recorded=${result.recorded} والمطلوب ${expect.recorded}`);
  if (expect.clarify !== undefined && Boolean(result.clarify) !== expect.clarify) problems.push(`clarify=${Boolean(result.clarify)} والمطلوب ${expect.clarify}`);
  if (expect.minLen !== undefined && answer.length < expect.minLen) problems.push(`طول الرد ${answer.length} وأقل طول ${expect.minLen}`);
  for (const want of expect.has || []) {
    const hit = want instanceof RegExp ? want.test(answer) : folded.includes(fold(String(want)));
    if (!hit) problems.push(`الرد مافيهوش «${String(want)}»`);
  }
  for (const banned of expect.lacks || []) {
    const hit = banned instanceof RegExp ? banned.test(answer) : folded.includes(fold(String(banned)));
    if (hit) problems.push(`الرد فيه «${String(banned)}» وهو ممنوع`);
  }
  if (expect.actionTab && !result.actions.some((a) => a.type === 'open_tab' && a.tab === expect.actionTab)) {
    problems.push(`مافيش زر يفتح «${expect.actionTab}»`);
  }
  if (expect.actionTo && !result.actions.some((a) => a.type === 'hand_over' && a.to === expect.actionTo)) {
    problems.push(`مافيش زر تسليم لـ«${expect.actionTo}»`);
  }
  for (const tool of expect.tools || []) if (!result.tools.some((t) => t.tool === tool)) problems.push(`أداة «${tool}» مااشتغلتش`);

  return {
    id: item.id, skill: item.skill, ask: item.ask, ok: problems.length === 0, problems, ms,
    specialist: result.specialist.id, source: result.source,
    ...(result.confidence ? { confidence: result.confidence } : {}),
    answer, tools: result.tools.map((t) => t.tool), gaps,
  };
}

/** البنك كله بالترتيب — حالة ورا حالة على نفس الأرشيف. */
export async function runTraining(cases: TrainingCase[] = TRAINING_CASES): Promise<TrainingReport> {
  const outcomes: CaseOutcome[] = [];
  for (const item of cases) outcomes.push(await runCase(item));
  const bySource: Record<string, number> = {};
  for (const o of outcomes) bySource[o.source] = (bySource[o.source] || 0) + 1;
  const { lessons } = await trainingCore();
  return {
    outcomes,
    pass: outcomes.filter((o) => o.ok).length,
    fail: outcomes.filter((o) => !o.ok).length,
    totalMs: outcomes.reduce((sum, o) => sum + o.ms, 0),
    lessons: lessons.length,
    bySource,
  };
}

/** التقرير على الشاشة: المهارات، الحالات الواقعة وسببها، والأرقام. */
export function formatReport(report: TrainingReport, options: { verbose?: boolean; cases?: TrainingCase[] } = {}): string {
  const cases = options.cases || TRAINING_CASES;
  const skills = Object.keys(SKILL_LABELS_AR) as TrainingSkill[];
  const lines: string[] = [
    '',
    '╔══════════════════════════════════════════════════════════════════════════╗',
    '   تدريب مجلس المتخصصين — الوكيل وأدواته من غير أي ذكاء اصطناعي',
    '╚══════════════════════════════════════════════════════════════════════════╝',
    `   الأرشيف: ${report.lessons} درس في مكتبة شاهين · ${RAW_MATERIALS_DATABASE.length} مادة خام · علوم مدرسة شاهين · متجر شام الحقيقي`,
    '',
  ];
  for (const skill of skills) {
    const own = report.outcomes.filter((o) => o.skill === skill);
    if (!own.length) continue;
    const pass = own.filter((o) => o.ok).length;
    lines.push(`— ${SKILL_LABELS_AR[skill]}: ${pass}/${own.length}`);
    for (const o of own) {
      const head = `   ${o.ok ? '✓' : '✗'} ${o.id.padEnd(30)} ${o.specialist.replace('specialist_', '').padEnd(12)} ${o.source.padEnd(11)} ${String(o.ms).padStart(4)} م.ث`;
      lines.push(head);
      if (!o.ok) {
        const item = cases.find((c) => c.id === o.id);
        for (const problem of o.problems) lines.push(`       ✗ ${problem}`);
        if (item) lines.push(`       ← المطلوب: ${item.why}`);
      }
      if (options.verbose) {
        lines.push(`       السؤال: ${o.ask}`);
        lines.push(`       الرد: ${o.answer.replace(/\n+/g, ' ⏎ ').slice(0, 400)}`);
        lines.push(`       الأدوات: ${o.tools.join('، ')}`);
      }
    }
    lines.push('');
  }
  const slowest = [...report.outcomes].sort((a, b) => b.ms - a.ms)[0];
  const sources = Object.entries(report.bySource).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ');
  lines.push(`   المجموع: ${report.pass}/${report.outcomes.length} حالة ناجحة · ${report.fail} واقعة`);
  lines.push(`   الوقت: ${report.totalMs} م.ث لكل البنك · متوسط ${Math.round(report.totalMs / Math.max(1, report.outcomes.length))} م.ث · أبطأ حالة ${slowest?.id || '-'} (${slowest?.ms || 0} م.ث)`);
  lines.push(`   مصادر الردود: ${sources}`);
  lines.push('');
  return lines.join('\n');
}
