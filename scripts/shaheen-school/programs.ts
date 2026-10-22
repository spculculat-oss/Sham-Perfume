/**
 * Running the school's block programs FOR REAL («بلوكات شاهين»):
 *   - «مدرسة شاهين» (scripts/shaheen-school/run.mts) executes every due program whose runner is 'school'
 *     (study day, tool development) with actions backed by the run's real measurements.
 *   - «الدورية بالتناوب» (scripts/shaheen-patrol/run.mts) executes every due program whose runner is 'patrol'
 *     — above all «برنامج إدارة الذكاء الذاتي» (ai-self): Shaheen measures his self-reliance and answers from
 *     memory → library → local model → an honest refusal, with NO external AI app involved.
 * Every executed step lands in the runs log of src/data/live/shaheen-blocks.json — the schedule's diary.
 * Pure helpers with injected facts: nothing here invents a number it was not given («مفيش تزييف»).
 */
import {
  nextRun, runProgram, type BlockActions, type BlockProgram, type BlocksFile, type RunReport,
} from '../../src/utils/shaheenBlocks';

/** The most recent run of a program (its run log is newest first). */
export function lastRunAt(file: BlocksFile, id: string): number | undefined {
  const times = file.runs.filter((r) => r.program === id).map((r) => Date.parse(r.at)).filter((n) => Number.isFinite(n));
  return times.length ? Math.max(...times) : undefined;
}

/** Programs this runner must execute now: never run before, or their schedule says the time has come. */
export function duePrograms(file: BlocksFile, runner: 'school' | 'patrol', now = Date.now()): BlockProgram[] {
  return file.programs.filter((p) => (p.runner || 'school') === runner).filter((p) => {
    const last = lastRunAt(file, p.id);
    if (last === undefined) return true;
    if (!p.schedule) return true;
    const next = nextRun(p.schedule, last);
    return next ? next.getTime() <= now : true;
  });
}

/** Appends a run to the diary (newest first, capped). */
export function recordRun(file: BlocksFile, report: RunReport, at = new Date()): void {
  file.runs = [{
    program: report.program, at: at.toISOString(), ok: report.ok,
    steps: report.steps.length, failed: report.steps.filter((s) => s.status === 'failed').length,
  }, ...file.runs.filter((r) => r.program !== report.program || r.at !== at.toISOString())].slice(0, 40);
  file.updatedAt = at.toISOString();
}

/** Runs one program and records it; returns the report for the runner's notes. */
export async function runAndRecord(
  program: BlockProgram, actions: BlockActions, file: BlocksFile, facts: Record<string, string | number | boolean> = {}, at = new Date(),
): Promise<RunReport> {
  const report = await runProgram(program, actions, { facts });
  recordRun(file, report, at);
  return report;
}

/** What the school measured this run — the only numbers its block actions may report. */
export interface SchoolMeasurements {
  covered: number; total: number; score: number;
  selfTaught: number; studied: number;
  toolField: string; toolFocus: string;
  /** «تدريب وش عمل» — how many hands-on exercises really ran and passed this run. */
  practicePassed?: number; practiceTotal?: number;
}

/** The school's block actions (study day + tool development) — every detail is a real measurement. */
export function schoolActions(m: SchoolMeasurements): BlockActions {
  return {
    exam: () => `الامتحان: ${m.covered}/${m.total} (${m.score}%)`,
    self_study: () => `التسميع من المكتبة بدون ذكاء اصطناعي: ${m.selfTaught} درس`,
    study_ai: () => `المذاكرة مع محرك متاح: ${m.studied} سؤال`,
    practice: () => `التدريب العملي: ${m.practicePassed ?? 0}/${m.practiceTotal ?? 0} تمرين نُفّذ وتحقّق منه فعلاً`,
    remember: () => 'الدروس محفوظة في ذاكرة شاهين',
    report: () => 'تقرير المدرسة مكتوب في سجل المدرسة',
    tool_field_study: () => `مجال الأداة تحت الدراسة: ${m.toolField}`,
    tool_focus: () => `تركيز التطوير القادم: ${m.toolFocus}`,
    tool_report: () => 'تقرير تطوير الأدوات مكتوب',
  };
}

/** What the patrol may report — measured from the live reports and this hour's probes, never guessed. */
export interface PatrolMeasurements {
  reliance: { score: number; covered: number; total: number; fromMemory: number; fromLibrary: number };
  localTaught: number; pending: number; spellingScore?: number;
  /** This hour's probe notes by id ('site', 'sitemap', 'images', 'product_pages'…) — only what really ran. */
  probes: Record<string, string>;
  openIssues: number;
}

/** The patrol's block actions: «الإدارة الذاتية» first (no external AI app), then the site-care programme. */
export function patrolActions(c: PatrolMeasurements): BlockActions {
  const probe = (id: string) => c.probes[id] || 'الفحص في وردية أخرى — الجولة القادمة تغطيه';
  return {
    // ── ai-self: إدارة الذكاء الذاتي ──
    measure_reliance: () => `الاعتماد على النفس ${c.reliance.score}% (${c.reliance.covered}/${c.reliance.total})${c.spellingScore !== undefined ? ` — فهم الغلطات ${c.spellingScore}%` : ''}`,
    answer_from_memory: () => `الرد من ذاكرة شاهين (بدون أي تطبيق ذكاء): ${c.reliance.fromMemory} سؤال`,
    answer_from_library: () => `الرد من مكتبة شاهين (بدون أي ذكاء اصطناعي): ${c.reliance.fromLibrary} متاح فوراً`,
    answer_from_local_model: () => `النموذج المحلي المستضاف ذاتياً (بلا مفتاح ولا حساب): ${c.localTaught} درس`,
    honesty_check: () => (c.pending ? `${c.pending} سؤال في انتظار الدراسة — الرد عليه بصدق «مش قادر دلوقتي»` : 'لا فجوات معلقة — كل ردوده صريحة'),
    self_report: () => 'تقرير الإدارة الذاتية مرفوع في سجل البلوكات',
    // ── site-care: صيانة الموقع من نتائج فحوصات هذه الوردية ──
    check_site: () => probe('site'),
    check_links: () => probe('sitemap'),
    check_images: () => probe('images'),
    check_ssl: () => probe('site'),
    check_page_sample: () => probe('product_pages'),
    alert: () => (c.openIssues ? `${c.openIssues} مشكلة مفتوحة في تقرير الدورية — البلاغ مسجّل عليها` : 'لا حاجة لبلاغ — لا مشاكل مفتوحة'),
    backup: () => 'النسخ الاحتياطية من مسؤولية النشر التلقائي (سجل النشر) — الدورية تراقب ولا تنسخ',
    report: () => 'تقرير صيانة الموقع مرفوع في سجل البلوكات',
  };
}
