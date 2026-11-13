/**
 * «المعلم» — the tutor: turns the mind's weak links into a study plan, and the plan into exam questions whose
 * answers are already written in the site's own files.
 *
 * Where the plan comes from (never invented):
 *   · a destination with no lesson that explains it (the graph's `applies_to` edges say which ones),
 *   · a destination with no published shipping cost, or customs still «not verified»,
 *   · a carrier whose dangerous-goods answer is unknown,
 *   · an immune finding (two numbers for one thing, a promise with nothing behind it).
 *
 * Each practice question carries its expected answer **and the file it came from**, so the examiner can mark it
 * without a model and the merchant can check any line by hand.
 *
 * Pure: the graph, the trade report and the immune report are parameters (`tests/shaheenMindLoop.test.ts`).
 */
import type { ShaheenGraph } from '../../src/utils/shaheenGraph';

export type StudyTargetKind = 'destination' | 'carrier' | 'pricing' | 'consistency' | 'topic';

export interface StudyTarget {
  kind: StudyTargetKind;
  /** The node or the finding it is about. */
  id: string;
  labelAr: string;
  whyAr: string;
  /** The specialist who should study it (his field owns it). */
  specialistId: string;
  priority: number;
}

export type QuestionKind = 'shipping_cost' | 'customs' | 'carrier_rule' | 'origin' | 'rule';

export interface PracticeQuestion {
  id: string;
  question: string;
  kind: QuestionKind;
  /** What a correct answer must contain (a number, a name, a rule) — the examiner grades on this, not on style. */
  expected: string[];
  /** Where the answer is written, so a human can check it in one click. */
  source: string;
  specialistId: string;
  targetId: string;
}

export interface StudyPlan {
  version: 1;
  agent: 'tutor';
  updatedAt: string;
  targets: StudyTarget[];
  questions: PracticeQuestion[];
  covered: { destinations: number; explained: number; priced: number; verifiedCustoms: number };
  summaryAr: string;
  planAr: string[];
}

export interface TutorInput {
  now: number;
  graph: ShaheenGraph;
  destinations: {
    code: string; nameAr: string;
    costUsd: number | null; extraUsd: number | null;
    /** What the site actually charges for the first bottle, in EGP — the number a visitor is promised. */
    chargedEgp: number | null;
    carrierId: string | null; carrierNameAr: string | null; carrierSource: string | null; carrierCheckedAt: string | null;
    carrierDg: boolean | null;
    customsVerified: boolean; vatPercent: number | null; customsSource: string | null;
  }[];
  immuneFindings: { kind: string; severity: string; subject: string; whatAr: string; fixAr: string }[];
  origins: { code: string; nameAr: string; products: number }[];
  /** The specialists and the fields they own. */
  specialists: { id: string; nameAr: string; tracks: string[] }[];
  /** Which specialist owns the store's trade questions. */
  tradeSpecialistId?: string;
  /** Oldest a rate may be before it becomes homework. */
  staleDays?: number;
  /** How many questions the examiner should get (the run is time-boxed). */
  examSize?: number;
  /** Real questions the platform already answered (from Shaheen's memory) — a recall test across every field. */
  recall?: { question: string; answer: string; specialistId: string }[];
  /** How many recall questions to include (spread over the specialists). */
  recallSize?: number;
}

const DAY = 86_400_000;
const round = (n: number) => Math.round(n * 100) / 100;

export function buildStudyPlan(input: TutorInput): StudyPlan {
  const trade = input.tradeSpecialistId || input.specialists.find((s) => s.tracks.includes('commerce'))?.id || 'specialist_business';
  const staleDays = Number(input.staleDays) || 120;
  const targets: StudyTarget[] = [];
  const questions: PracticeQuestion[] = [];

  // Which destinations does a lesson already explain (through the destination itself or its customs table)?
  const customsOf = new Map(input.graph.edges.filter((e) => e.relation === 'cleared_by').map((e) => [e.from, e.to]));
  const explained = (id: string) => input.graph.edges.some((e) => e.relation === 'applies_to' && e.to === id)
    || (customsOf.has(id) && input.graph.edges.some((e) => e.relation === 'applies_to' && e.to === customsOf.get(id)));

  for (const d of input.destinations) {
    const nodeId = `destination:${d.code}`;
    const hasLesson = explained(nodeId);

    // 1) الشحن بكام ومن أي شركة — سؤال بيتكرر من كل زائر.
    if (d.costUsd !== null && d.carrierNameAr) {
      questions.push({
        id: `q-ship-${d.code}`,
        question: `الشحن لـ${d.nameAr} بكام؟ ومن أي شركة؟`,
        kind: 'shipping_cost',
        // الرقم اللي الزائر بيتوعّد بيه (اللي الموقع بيحصّله فعلًا) + اسم الشركة اللي على المسار.
        expected: [...(d.chargedEgp !== null ? [String(Math.round(d.chargedEgp))] : [String(round(d.costUsd))]), d.carrierNameAr],
        source: d.carrierSource || 'src/data/shipping-costs.json',
        specialistId: trade,
        targetId: nodeId,
      });
    } else {
      targets.push({
        kind: 'destination', id: nodeId, labelAr: d.nameAr,
        whyAr: `${d.nameAr}: مفيش تعريفة شحن منشورة — سعرها منطقة، ومفيش وعد إنه يغطي التكلفة`,
        specialistId: trade, priority: 90,
      });
    }

    // 2) الجمارك — رقم منشور ولا «بتتأكد».
    if (d.customsVerified && d.vatPercent !== null) {
      questions.push({
        id: `q-customs-${d.code}`,
        question: `جمارك ${d.nameAr} كام في المية؟`,
        kind: 'customs',
        expected: [String(d.vatPercent)],
        source: d.customsSource || 'src/data/customs.json',
        specialistId: trade,
        targetId: nodeId,
      });
    } else {
      targets.push({
        kind: 'destination', id: nodeId, labelAr: d.nameAr,
        whyAr: `${d.nameAr}: الجمارك لسه مش متأكدين منها — والزائر لازم يسمع «بتتأكد قبل الدفع» مش رقم مخترع`,
        specialistId: trade, priority: 60,
      });
    }

    // 3) درس بيشرح الوجهة — العمق اللي الشبكة بتقيسه.
    if (!hasLesson) {
      targets.push({
        kind: 'topic', id: nodeId, labelAr: d.nameAr,
        whyAr: `${d.nameAr}: مفيش درس مكتوب بيشرح شحنها وجمركها — المعرفة موجودة كأرقام بس، مش كفهم`,
        specialistId: trade, priority: 40,
      });
    }
  }

  // 4) شركة شحن قبولها للعطور مش متأكد / تعريفتها قديمة.
  for (const node of input.graph.nodes.filter((n) => n.kind === 'carrier')) {
    const used = input.destinations.filter((d) => d.carrierNameAr === node.labelAr);
    if (!used.length) continue;
    if (used[0].carrierDg !== true) {
      targets.push({
        kind: 'carrier', id: node.id, labelAr: node.labelAr,
        whyAr: `«${node.labelAr}»: ${used[0].carrierDg === false ? 'بترفض العطور (UN1266)' : 'لسه مش مؤكد إنها بتقبل العطور (UN1266)'} — وهي اللي بتحمل ${used.length} وجهة`,
        specialistId: trade, priority: 95,
      });
      questions.push({
        id: `q-dg-${node.id}`,
        question: `شركة ${node.labelAr} بتقبل شحن العطور (UN1266)؟`,
        kind: 'carrier_rule',
        expected: ['مش متأكد', 'يتأكد'],
        source: 'src/data/shipping-lanes.json',
        specialistId: trade,
        targetId: node.id,
      });
    }
    const at = Date.parse(String(used[0].carrierCheckedAt || ''));
    if (Number.isFinite(at) && input.now - at > staleDays * DAY) {
      targets.push({
        kind: 'carrier', id: node.id, labelAr: node.labelAr,
        whyAr: `«${node.labelAr}»: التعريفة اتفحصت آخر مرة من ${Math.floor((input.now - at) / DAY)} يوم`,
        specialistId: trade, priority: 50,
      });
    }
  }

  // 5) من هنا تطلع البضاعة — سؤال «بيتصنع فين؟» ليه إجابة حقيقية في الملفات.
  for (const o of input.origins.filter((x) => x.products > 0).slice(0, 3)) {
    questions.push({
      id: `q-origin-${o.code}`,
      question: `البضاعة اللي بتتباع بتطلع من ${o.nameAr}؟`,
      kind: 'origin',
      expected: [o.nameAr, String(o.products)],
      source: 'src/data/shipping-lanes.json',
      specialistId: trade,
      targetId: `origin:${o.code}`,
    });
  }

  // 6) تعارضات المناعة: كل تعارض خطير بقى هدف دراسة لصاحب المجال.
  for (const f of input.immuneFindings.filter((x) => x.severity === 'high' || x.severity === 'medium').slice(0, 8)) {
    targets.push({
      kind: f.kind === 'contradiction' ? 'consistency' : 'pricing', id: `immune:${f.subject}`, labelAr: f.subject,
      whyAr: f.whatAr, specialistId: trade, priority: f.severity === 'high' ? 85 : 45,
    });
  }

  // أسئلة استرجاع حقيقية من ذاكرة شاهين: العقل لازم يفتكر اللي اتعلمه، مش بس يقرا ملفات الشحن.
  const recallSize = Math.max(0, Math.min(8, Number(input.recallSize) ?? 6));
  const seenSpecialist = new Set<string>();
  for (const item of input.recall || []) {
    if (recallSize === 0 || seenSpecialist.size >= recallSize) break;
    const expected = anchors(String(item.answer || ''));
    if (!expected.length) continue;
    // سؤال واحد لكل متخصص — عشان الامتحان يعدّي على كل المجالات مش مجال واحد.
    if (seenSpecialist.has(item.specialistId)) continue;
    seenSpecialist.add(item.specialistId);
    questions.push({
      id: `q-recall-${item.specialistId}-${questions.length}`,
      question: item.question,
      kind: 'rule',
      expected,
      source: 'src/data/live/shaheen-memory.json',
      specialistId: item.specialistId,
      targetId: `specialist:${item.specialistId}`,
    });
  }

  targets.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  const examSize = Math.max(4, Math.min(40, Number(input.examSize) || 12));
  // اسئلة الملفات الأول (أدقّ حاجة نقيسها)، وبعدين أسئلة الاسترجاع — ومن غير تكرار.
  const tradeQuestions = questions.filter((q) => q.kind !== 'rule');
  const recallQuestions = questions.filter((q) => q.kind === 'rule');
  const questionsPicked = [...tradeQuestions.slice(0, examSize), ...recallQuestions].slice(0, examSize + recallQuestions.length);

  const covered = {
    destinations: input.destinations.length,
    explained: input.destinations.filter((d) => explained(`destination:${d.code}`)).length,
    priced: input.destinations.filter((d) => d.costUsd !== null).length,
    verifiedCustoms: input.destinations.filter((d) => d.customsVerified && d.vatPercent !== null).length,
  };

  const top = targets.slice(0, 5).map((t) => t.labelAr);
  const planAr = [
    ...(targets.length
      ? [`${targets.length} حلقة ضعيفة في العقل، أهمها: ${top.join('، ')} — كل واحدة بقت مهمة دراسة لمتخصصها.`]
      : ['مفيش حلقات ضعيفة: كل وجهة وشركة ليها سعر موثّق وشرح مكتوب.']),
    `${questionsPicked.length} سؤال امتحان جاهز، إجابته مكتوبة في الملفات نفسها — الممتحن بيصحح عليها من غير أي تخمين.`,
    `العمق: ${covered.explained} من ${covered.destinations} وجهة ليها درس بيشرحها · ${covered.priced} بسعر شحن منشور · ${covered.verifiedCustoms} بجمارك مؤكدة.`,
  ];

  return {
    version: 1, agent: 'tutor', updatedAt: new Date(input.now).toISOString(),
    targets, questions: questionsPicked, covered,
    summaryAr: `المعلم: ${targets.length} حلقة ضعيفة اتحولت لخطة دراسة · ${questionsPicked.length} سؤال امتحان بإجابات موثّقة`,
    planAr,
  };
}

/** The facts a correct recall answer must carry: the numbers in the stored answer, else its longest words. */
export function anchors(answer: string): string[] {
  // الرقم الأكبر في الإجابة هو أدقّ حاجة نقيسها: رقم صغير (10، 15) بيتكرر في أي كلام، والكبير بيميّز الإجابة.
  const numbers = [...new Set([...answer.matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => m[1]).filter((n) => Number(n) >= 20))];
  if (numbers.length) return [numbers.sort((a, b) => Number(b) - Number(a))[0]];
  const words = answer.replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter((w) => w.length >= 6);
  return [...new Set(words)].slice(0, 2);
}

/** The guard the workflow uses: a plan without questions or with a question missing its source is refused. */
export const isStudyPlan = (v: unknown): v is StudyPlan => {
  const p = v as StudyPlan | undefined;
  return Boolean(p && p.version === 1 && p.agent === 'tutor' && typeof p.updatedAt === 'string'
    && Array.isArray(p.targets) && Array.isArray(p.questions)
    && p.questions.every((q) => q.source && q.question && Array.isArray(q.expected) && q.expected.length > 0));
};
