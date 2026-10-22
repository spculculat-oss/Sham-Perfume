/**
 * «بلوكات شاهين» — building and scheduling programming blocks (pure, browser-safe):
 *   1. Build: a program is a tree of blocks (action / condition / loop / wait / schedule / note) with labels
 *      and arguments — like the coloured blocks of visual programming, but serialisable JSON that any robot
 *      or the admin panel can read.
 *   2. Schedule: every program may carry a schedule («every 30 minutes», «every 6 hours», «daily 08:00»,
 *      «weekly sat 08:00», or a 5-field cron like «17 *\/6 * * *») — nextRun() says exactly when it runs next.
 *   3. Run: a safe interpreter that only calls whitelisted actions (never eval): conditions read named facts,
 *      loops are capped, waits are recorded, and every step lands in a run report.
 * «مدرسة شاهين» (scripts/shaheen-school) teaches this and builds its own study and site-maintenance programs
 * from it; nothing here touches the network, the disk, or any AI service.
 */

export type BlockKind = 'action' | 'condition' | 'loop' | 'wait' | 'schedule' | 'note';

export interface BlockCondition {
  /** A named fact from the run context: `siteUp`, `quotaLeft`, `testsPassed`… never an expression. */
  fact: string;
  equals?: string | number | boolean;
  contains?: string;
  atLeast?: number;
}

export interface Block {
  id: string;
  kind: BlockKind;
  /** What the block does, in plain words («فحص صحة الموقع») — shown in checklists and reports. */
  label: string;
  /** For kind 'action': the action id the runner must know (whitelist). */
  action?: string;
  args?: Record<string, string | number | boolean>;
  /** For kind 'condition': when true the children run, otherwise they are skipped. */
  when?: BlockCondition;
  /** For kind 'loop': how many times the children run (1…20). */
  repeat?: number;
  /** For kind 'schedule': a schedule expression, same grammar as BlockProgram.schedule. */
  every?: string;
  /** For kind 'wait': how many minutes the plan waits here (recorded, not slept). */
  minutes?: number;
  /** For kind 'note': the note body. */
  note?: string;
  children?: Block[];
}

export interface BlockProgram {
  id: string;
  title: string;
  goal: string;
  schedule?: string;
  /** Who executes this program for real: 'school' (each school run) or 'patrol' (each patrol run when due). */
  runner?: 'school' | 'patrol';
  blocks: Block[];
  createdAt: string;
}

export interface BlocksFile {
  version: 1;
  updatedAt: string;
  programs: BlockProgram[];
  /** What ran and how it went — the schedule's log. */
  runs: { program: string; at: string; ok: boolean; steps: number; failed: number }[];
}

export const emptyBlocks = (): BlocksFile => ({ version: 1, updatedAt: new Date(0).toISOString(), programs: [], runs: [] });
export const isBlocksFile = (d: unknown): d is BlocksFile =>
  Boolean(d && typeof d === 'object' && (d as BlocksFile).version === 1 && Array.isArray((d as BlocksFile).programs) && Array.isArray((d as BlocksFile).runs));

// ── Scheduling ────────────────────────────────────────────────────────────────────────────────────────────
export type Schedule =
  | { kind: 'every'; minutes: number }
  | { kind: 'daily'; hour: number; minute: number }
  | { kind: 'weekly'; day: number; hour: number; minute: number } // day: 0 = Sunday … 6 = Saturday
  | { kind: 'cron'; minute: number | 'star' | { every: number }; hour: number | 'star' | { every: number }; dayOfMonth: number | 'star' | { every: number }; month: number | 'star' | { every: number }; dayOfWeek: number | 'star' | { every: number } };

const DAY_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const DAY_EN = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const num = (s: string) => (/^\d+$/.test(s) ? Number(s) : NaN);
const cronField = (s: string): number | 'star' | { every: number } | null => {
  if (s === '*') return 'star';
  if (/^\*\/\d+$/.test(s)) return { every: Number(s.slice(2)) };
  const n = num(s);
  return Number.isFinite(n) ? n : null;
};

/** `every 30 minutes` · `every 6 hours` · `daily 08:00` · `weekly sat 08:00` · `17 *\/6 * * *` · Arabic aliases. */
export function parseSchedule(expr: string): Schedule | null {
  const s = (expr || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s || s.length > 60) return null;

  const every = s.match(/^every (\d{1,4}) (minute|minutes|min|hour|hours|day|days)$/);
  if (every) {
    const n = Number(every[1]);
    const unit = every[2].startsWith('min') ? 1 : every[2].startsWith('hour') ? 60 : 1440;
    const minutes = n * unit;
    return minutes > 0 && minutes <= 43_200 ? { kind: 'every', minutes } : null;
  }
  const everyAr = s.match(/^كل (\d{1,4}) (دقيقة|دقايق|ساعة|ساعات|يوم|ايام|أيام)$/);
  if (everyAr) {
    const n = Number(everyAr[1]);
    const u = everyAr[2];
    const unit = u.startsWith('دق') ? 1 : u.startsWith('ساع') ? 60 : 1440;
    const minutes = n * unit;
    return minutes > 0 && minutes <= 43_200 ? { kind: 'every', minutes } : null;
  }

  const hm = /^(\d{1,2}):(\d{2})$/.exec(s.replace(/^(daily|يومياً?|يوميا) /, ''));
  if (/^(daily|يومياً?|يوميا) /.test(s) && hm && Number(hm[1]) < 24 && Number(hm[2]) < 60) {
    return { kind: 'daily', hour: Number(hm[1]), minute: Number(hm[2]) };
  }

  const weekly = s.match(/^(weekly|أسبوعياً?|اسبوعيا|أسبوعيا) ([\p{L}\p{N}]+) (\d{1,2}):(\d{2})$/u);
  if (weekly) {
    const day = DAY_EN.indexOf(weekly[2]) >= 0 ? DAY_EN.indexOf(weekly[2]) : DAY_AR.findIndex((d) => d === weekly[2]);
    // Arabic day names accept the common spellings (hamza and ta-marbuta variants).
    const dayAr: Record<string, number> = { 'الاحد': 0, 'الاثنين': 1, 'الثلاثاء': 2, 'الاربعاء': 3, 'الاربعا': 3, 'الخميس': 4, 'الجمعة': 5, 'الجمعه': 5, 'السبت': 6 };
    const d = day >= 0 ? day : (dayAr[weekly[2].replace(/[أإآ]/g, 'ا').replace(/ة$/, 'ه')] ?? dayAr[weekly[2]] ?? -1);
    if (d < 0 || Number(weekly[3]) >= 24 || Number(weekly[4]) >= 60) return null;
    return { kind: 'weekly', day: d, hour: Number(weekly[3]), minute: Number(weekly[4]) };
  }

  const cron = s.split(' ');
  if (cron.length === 5) {
    const [mi, h, dom, mon, dow] = cron.map(cronField);
    if (mi === null || h === null || dom === null || mon === null || dow === null) return null;
    const okRange = (v: number | 'star' | { every: number }, max: number) =>
      v === 'star' || (typeof v === 'object' ? v.every >= 1 && v.every <= max : v >= 0 && v <= max);
    if (!okRange(mi, 59) || !okRange(h, 23) || !okRange(dom, 31) || !okRange(mon, 12) || !okRange(dow, 6)) return null;
    return { kind: 'cron', minute: mi, hour: h, dayOfMonth: dom, month: mon, dayOfWeek: dow };
  }
  return null;
}

const fieldHit = (v: number | 'star' | { every: number }, actual: number) =>
  v === 'star' || (typeof v === 'object' ? actual % v.every === 0 : v === actual);

/** The first moment strictly after `from` when the schedule runs; null when the expression is unknown. */
export function nextRun(expr: string, from: Date | number = Date.now()): Date | null {
  const plan = parseSchedule(expr);
  if (!plan) return null;
  const start = new Date(from);
  if (plan.kind === 'every') return new Date(start.getTime() + plan.minutes * 60_000);

  const probe = new Date(start.getTime() + 60_000); // strictly after `from`
  probe.setSeconds(0, 0);
  if (plan.kind === 'daily' || plan.kind === 'weekly') {
    for (let add = 0; add <= 8; add++) {
      const day = new Date(probe);
      day.setDate(probe.getDate() + add);
      if (plan.kind === 'weekly' && day.getDay() !== plan.day) continue;
      day.setHours(plan.hour, plan.minute, 0, 0);
      if (day.getTime() > start.getTime()) return day;
    }
    return null;
  }
  // cron: day-by-day search (cheap: only the matching hours and minutes are visited).
  for (let add = 0; add <= 366; add++) {
    const day = new Date(probe);
    day.setDate(probe.getDate() + add);
    if (!fieldHit(plan.dayOfMonth, day.getDate())) continue;
    if (!fieldHit(plan.month, day.getMonth() + 1)) continue;
    if (!fieldHit(plan.dayOfWeek, day.getDay())) continue;
    for (let h = 0; h < 24; h++) {
      if (!fieldHit(plan.hour, h)) continue;
      for (let m = 0; m < 60; m++) {
        if (!fieldHit(plan.minute, m)) continue;
        day.setHours(h, m, 0, 0);
        if (day.getTime() > start.getTime()) return day;
      }
    }
  }
  return null;
}

/** The schedule in Arabic words («كل 6 ساعات») — for checklists and the admin panel. */
export function describeSchedule(expr: string): string {
  const plan = parseSchedule(expr);
  if (!plan) return `غير مجدولة (${expr || 'بدون موعد'})`;
  if (plan.kind === 'every') {
    if (plan.minutes < 60) return `كل ${plan.minutes} دقيقة`;
    if (plan.minutes % 1440 === 0) return `كل ${plan.minutes / 1440} يوم`;
    return `كل ${plan.minutes / 60} ساعة`;
  }
  const time = `${plan.kind === 'weekly' ? '' : 'الساعة '}${String('hour' in plan ? plan.hour : 0).padStart(2, '0')}:${String('minute' in plan ? plan.minute : 0).padStart(2, '0')}`;
  if (plan.kind === 'daily') return `يومياً ${time}`;
  if (plan.kind === 'weekly') return `أسبوعياً (${DAY_AR[plan.day]}) ${time}`;
  return `حسب الجدولة ${expr.trim()}`;
}

// ── Building and validating ───────────────────────────────────────────────────────────────────────────────
export type BlockInput = Omit<Block, 'id' | 'children'> & { id?: string; children?: BlockInput[] };
export type ProgramInput = Omit<BlockProgram, 'createdAt' | 'blocks'> & { createdAt?: string; blocks: BlockInput[] };

const KINDS: readonly BlockKind[] = ['action', 'condition', 'loop', 'wait', 'schedule', 'note'];

/** Normalises a spec into a program: every block gets a stable id («b2», «b2.1»…). */
export function buildProgram(input: ProgramInput, now = new Date()): BlockProgram {
  const take = (blocks: BlockInput[], prefix: string): Block[] =>
    blocks.map((b, i) => {
      const id = b.id || `${prefix}${i + 1}`;
      const { children, ...rest } = b;
      return { ...rest, id, ...(children?.length ? { children: take(children, `${id}.`) } : {}) };
    });
  return {
    id: input.id, title: input.title, goal: input.goal, schedule: input.schedule, runner: input.runner,
    createdAt: input.createdAt || now.toISOString(),
    blocks: take(input.blocks, 'b'),
  };
}

const MAX_DEPTH = 4;
const MAX_BLOCKS = 100;

export function validateProgram(p: BlockProgram): string[] {
  const errors: string[] = [];
  if (!p.id?.trim()) errors.push('البرنامج بدون معرّف');
  if (!p.title?.trim()) errors.push('البرنامج بدون عنوان');
  if (!p.blocks?.length) errors.push('البرنامج بدون بلوكات');
  if (p.schedule && !parseSchedule(p.schedule)) errors.push(`موعد الجدولة غير مفهوم: ${p.schedule}`);
  let count = 0;
  const walk = (blocks: Block[], depth: number, path: string) => {
    for (const b of blocks) {
      count++;
      const where = `${path}${b.id || '?'}`;
      if (!b.label?.trim()) errors.push(`البلوك ${where} بدون وصف`);
      if (!KINDS.includes(b.kind)) errors.push(`البلوك ${where} نوعه غير معروف`);
      if (b.kind === 'action' && !b.action?.trim()) errors.push(`بلوك الإجراء ${where} بدون اسم إجراء`);
      if (b.kind === 'condition' && (!b.when?.fact?.trim() || [b.when.equals, b.when.contains, b.when.atLeast].every((v) => v === undefined)))
        errors.push(`بلوك الشرط ${where} بدون حقيقة تُفحص`);
      if (b.kind === 'loop' && (!Number.isInteger(b.repeat) || (b.repeat as number) < 1 || (b.repeat as number) > 20))
        errors.push(`حلقة التكرار ${where} يجب أن تتكرر من 1 إلى 20 مرة`);
      if (b.kind === 'wait' && (!Number.isInteger(b.minutes) || (b.minutes as number) < 0 || (b.minutes as number) > 1440))
        errors.push(`بلوك الانتظار ${where} يجب أن يكون من 0 إلى 1440 دقيقة`);
      if (b.kind === 'schedule' && (!b.every || !parseSchedule(b.every))) errors.push(`بلوك الجدولة ${where} بموعد غير مفهوم`);
      if (b.kind === 'note' && !b.note?.trim() && !b.label?.trim()) errors.push(`بلوك الملاحظة ${where} فارغ`);
      if (depth >= MAX_DEPTH && b.children?.length) errors.push(`البلوكات متداخلة أعمق من ${MAX_DEPTH} مستويات عند ${where}`);
      if (b.children?.length) walk(b.children, depth + 1, `${where}.`);
    }
  };
  walk(p.blocks || [], 1, '');
  if (count > MAX_BLOCKS) errors.push(`البرنامج أكبر من ${MAX_BLOCKS} بلوك (${count})`);
  return errors;
}

/** The program as an ordered checklist (children indented) — what the runner will do, step by step. */
export function programChecklist(p: BlockProgram): string[] {
  const lines: string[] = [];
  const walk = (blocks: Block[], depth: number) => {
    for (const b of blocks) {
      const pad = '  '.repeat(depth - 1);
      const kind = { action: 'إجراء', condition: 'شرط', loop: `تكرار ×${b.repeat ?? 1}`, wait: `انتظار ${b.minutes ?? 0} د`, schedule: `جدولة: ${b.every ? describeSchedule(b.every) : ''}`, note: 'ملاحظة' }[b.kind];
      lines.push(`${pad}${b.id}. ${b.label} (${kind})`);
      if (b.children?.length) walk(b.children, depth + 1);
    }
  };
  walk(p.blocks, 1);
  return lines;
}

// ── Running (safe: whitelisted actions only, no eval) ─────────────────────────────────────────────────────
export interface RunContext { facts?: Record<string, string | number | boolean> }
export interface RunStep { id: string; label: string; status: 'done' | 'skipped' | 'failed' | 'waited'; detail?: string }
export interface RunReport { program: string; startedAt: string; finishedAt: string; ok: boolean; steps: RunStep[] }
export type BlockActions = Record<string, (args: Block['args'], ctx: RunContext) => Promise<string | void> | string | void>;

const conditionHit = (when: BlockCondition, facts: Record<string, string | number | boolean>): boolean => {
  const v = facts[when.fact];
  if (when.equals !== undefined) return v === when.equals;
  if (when.contains !== undefined) return typeof v === 'string' && v.includes(when.contains);
  if (when.atLeast !== undefined) return typeof v === 'number' && v >= when.atLeast;
  return Boolean(v);
};

/** Runs the program against a whitelist of actions. Unknown actions fail their step; nothing else executes. */
export async function runProgram(p: BlockProgram, actions: BlockActions, ctx: RunContext = {}): Promise<RunReport> {
  const started = new Date();
  const steps: RunStep[] = [];
  const facts = ctx.facts || {};

  const runBlocks = async (blocks: Block[]): Promise<void> => {
    for (const b of blocks) {
      if (b.kind === 'note') { steps.push({ id: b.id, label: b.label, status: 'done', detail: b.note }); continue; }
      if (b.kind === 'wait') { steps.push({ id: b.id, label: b.label, status: 'waited', detail: `انتظر ${b.minutes ?? 0} دقيقة` }); continue; }
      if (b.kind === 'schedule') {
        const next = b.every ? nextRun(b.every) : null;
        steps.push({ id: b.id, label: b.label, status: next ? 'done' : 'failed', detail: next ? `التشغيل القادم: ${next.toISOString()}` : 'موعد غير مفهوم' });
        continue;
      }
      if (b.kind === 'condition') {
        if (conditionHit(b.when!, facts)) await runBlocks(b.children || []);
        else steps.push({ id: b.id, label: b.label, status: 'skipped', detail: `الشرط «${b.when!.fact}» غير محقق` });
        continue;
      }
      if (b.kind === 'loop') {
        const times = Math.min(Math.max(b.repeat || 1, 1), 20);
        for (let i = 1; i <= times; i++) await runBlocks((b.children || []).map((c) => ({ ...c, id: `${b.id}.${i}.${c.id}` })));
        steps.push({ id: b.id, label: b.label, status: 'done', detail: `تكرر ${times} مرات` });
        continue;
      }
      // action
      const fn = b.action ? actions[b.action] : undefined;
      if (!fn) { steps.push({ id: b.id, label: b.label, status: 'failed', detail: `إجراء غير مسجل: ${b.action || '—'}` }); continue; }
      try {
        const detail = await fn(b.args, ctx);
        steps.push({ id: b.id, label: b.label, status: 'done', ...(detail ? { detail: String(detail).slice(0, 200) } : {}) });
      } catch (error) {
        steps.push({ id: b.id, label: b.label, status: 'failed', detail: (error as Error).message.slice(0, 200) });
      }
    }
  };

  await runBlocks(p.blocks);
  const failed = steps.filter((s) => s.status === 'failed').length;
  return { program: p.id, startedAt: started.toISOString(), finishedAt: new Date().toISOString(), ok: failed === 0, steps };
}
