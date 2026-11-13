/**
 * «درجة عقل شاهين» — one number, and the four numbers behind it.
 *
 * The owner asked for the mind to be measured and to keep improving, not described. This module turns the six
 * reports the mind's robots publish (`src/data/live/shaheen-*.json`) into the small panel the admin shows:
 *
 *   · درجة العقل   — the graph's own score out of 100 (`shaheen-graph.json`, built by «سينابس»),
 *   · درجة الذكاء  — the examiner's IQ (`shaheen-exam.json`, «الممتحن» grades the agent on its own numbers),
 *   · صحة المناعة  — 100 minus the contradictions found (`shaheen-immune.json`, «مناعة»),
 *   · إجابات فورية — how many instant answers the visitor gets with no engine (`shaheen-reflex.json»).
 *
 * Rules (the same ones every robot obeys):
 *   · **No number without its source and its date** — a report that is missing or stale is shown as «مش متاح»
 *     with its reason, never as a zero that looks like a failure.
 *   · **Nothing here changes a price or a promise** — this reads reports; the merchant decides.
 *
 * Pure and browser-safe: the files are parameters (`tests/shaheenMindLoop.test.ts`, `ShaheenMindPanel`).
 */
export interface MindFiles {
  graph?: unknown;
  immune?: unknown;
  ears?: unknown;
  study?: unknown;
  exam?: unknown;
  reflex?: unknown;
}

export interface MindNumber {
  id: 'brain' | 'iq' | 'immune' | 'reflex';
  labelAr: string;
  labelEn: string;
  /** `null` when the report is missing or unusable — the panel says why instead of showing a zero. */
  value: number | null;
  /** The scale: 100 for the scores, «إجابة» for the reflex table. */
  of: number | null;
  unitAr: string;
  /** The file the number comes from — so the merchant can check it in one click. */
  src: string;
  updatedAt: string | null;
  /** One line of context: the weakest link, the weakest specialist, what is still missing. */
  noteAr: string;
  noteEn: string;
}

export interface MindSnapshot {
  numbers: MindNumber[];
  /** A report older than this is shown, but labelled as old (the robots run daily at most). */
  staleHours: number;
  summaryAr: string;
  summaryEn: string;
}

type Obj = Record<string, unknown>;
const o = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {});
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const iso = (v: unknown): string | null => {
  const s = str(v);
  return s && Number.isFinite(Date.parse(s)) ? s : null;
};

const FILE = {
  brain: 'src/data/live/shaheen-graph.json',
  iq: 'src/data/live/shaheen-exam.json',
  immune: 'src/data/live/shaheen-immune.json',
  reflex: 'src/data/live/shaheen-reflex.json',
};

/** The mind, as the four numbers the owner follows — each one only from a report that really exists. */
export function mindSnapshot(files: MindFiles): MindSnapshot {
  const graph = o(files.graph);
  const exam = o(files.exam);
  const immune = o(files.immune);
  const reflex = o(files.reflex);
  const study = o(files.study);
  const ears = o(files.ears);

  // 1) درجة العقل — الشبكة نفسها.
  const brainTotal = num(o(graph.score).total);
  const stats = o(graph.stats);
  const brain: MindNumber = {
    id: 'brain', labelAr: 'درجة العقل', labelEn: 'Mind score',
    value: brainTotal, of: 100, unitAr: 'من 100', src: FILE.brain, updatedAt: iso(graph.updatedAt),
    noteAr: brainTotal === null ? 'تقرير «سينابس» مش موجود — الشبكة لسه مااتبنيتش في التقرير ده'
      : `${num(stats.nodes) ?? 0} عقدة و${num(stats.edges) ?? 0} حافة · ${str(o(graph.score).whyAr)}`.trim(),
    noteEn: brainTotal === null ? 'The synapse report is missing — the graph has not been published yet'
      : `${num(stats.nodes) ?? 0} nodes and ${num(stats.edges) ?? 0} edges`,
  };

  // 2) درجة الذكاء — امتحان الوكيل على أرقام الموقع.
  const iq = num(exam.iq);
  const weakest = arr(exam.bySpecialist).map(o).filter((s) => (num(s.asked) ?? 0) > 0)
    .sort((a, b) => (num(a.percent) ?? 0) - (num(b.percent) ?? 0))[0];
  const misses = arr(exam.misses).map(o);
  const iqNumber: MindNumber = {
    id: 'iq', labelAr: 'درجة الذكاء', labelEn: 'Mind IQ',
    value: iq, of: 100, unitAr: 'من 100', src: FILE.iq, updatedAt: iso(exam.updatedAt),
    noteAr: iq === null ? 'تقرير «الممتحن» مش موجود — مفيش امتحان اتشغّل'
      : `${num(exam.correct) ?? 0}/${num(exam.asked) ?? 0} بإجابة موثّقة`
        + (weakest ? ` · أضعف متخصص: ${str(weakest.nameAr)} (${num(weakest.percent) ?? 0}%)` : '')
        + (misses.length ? ` · أهم اللي فاته: «${str(misses[0].question)}»` : ''),
    noteEn: iq === null ? 'The examiner report is missing'
      : `${num(exam.correct) ?? 0}/${num(exam.asked) ?? 0} answered from a written source`,
  };

  // 3) صحة المناعة — 100 ناقص التعارضات.
  const health = num(immune.health);
  const high = arr(immune.findings).map(o).filter((f) => str(f.severity) === 'high').length;
  const immuneNumber: MindNumber = {
    id: 'immune', labelAr: 'صحة المناعة', labelEn: 'Immune health',
    value: health, of: 100, unitAr: 'من 100', src: FILE.immune, updatedAt: iso(immune.updatedAt),
    noteAr: health === null ? 'تقرير «مناعة» مش موجود — مفيش فحص تعارضات'
      : `${arr(immune.findings).length} تعارض مسجّل، منها ${high} خطير · ${str(immune.summaryAr)}`.trim(),
    noteEn: health === null ? 'The immune report is missing'
      : `${arr(immune.findings).length} findings, ${high} high severity`,
  };

  // 4) الانعكاس — الإجابات الفورية اللي الزائر بياخدها من غير محرك.
  const entries = arr(reflex.entries);
  const shipping = entries.map(o).filter((e) => str(e.kind) === 'shipping').length;
  const reflexNumber: MindNumber = {
    id: 'reflex', labelAr: 'إجابات فورية', labelEn: 'Instant answers',
    value: entries.length || null, of: null, unitAr: 'إجابة', src: FILE.reflex, updatedAt: iso(reflex.updatedAt),
    noteAr: !entries.length ? 'جدول الانعكاس فاضي — لسه مااتبناش'
      : `${shipping} سؤال شحن · الباقي جمارك وقاعدة العطر · الشات بيجاوب بيها من غير محرك ولا إنترنت`,
    noteEn: !entries.length ? 'The reflex table is empty' : `${shipping} shipping answers, the rest customs and the perfume rule`,
  };

  const numbers = [brain, iqNumber, immuneNumber, reflexNumber];
  const strong = numbers.filter((n) => n.value !== null);
  const weak = [...strong].sort((a, b) => {
    const av = a.of ? (a.value! / a.of) * 100 : 100;
    const bv = b.of ? (b.value! / b.of) * 100 : 100;
    return av - bv;
  })[0];
  const pending = num(ears.pending);
  const targets = arr(study.targets).length;
  const summaryAr = strong.length
    ? `العقل: ${numbers.filter((n) => n.of).map((n) => `${n.labelAr} ${n.value ?? '—'}/${n.of}`).join(' · ')}`
      + (weak && weak.id !== 'reflex' ? ` — أضعف رقم: ${weak.labelAr}` : '')
      + (targets ? ` · ${targets} حلقة ضعيفة بقت خطة دراسة` : '')
      + (pending !== null ? ` · ${pending} سؤال لسه من غير جواب` : '')
    : 'مفيش تقارير عقل منشورة لسه — أول تشغيل لـ«سينابس» و«الممتحن» بيبنيها';
  const summaryEn = strong.length
    ? `The mind: ${numbers.filter((n) => n.of).map((n) => `${n.labelEn} ${n.value ?? '—'}/${n.of}`).join(' · ')}`
    : 'No mind reports published yet';

  return { numbers, staleHours: 36, summaryAr, summaryEn };
}

/** True when a number's source report is older than the robots' daily cycle — shown, but labelled. */
export const isStale = (n: MindNumber, now: number, staleHours = 36): boolean =>
  Boolean(n.updatedAt && Number.isFinite(Date.parse(n.updatedAt)) && now - Date.parse(n.updatedAt) > staleHours * 3_600_000);
