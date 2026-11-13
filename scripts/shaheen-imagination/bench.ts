/**
 * «تدريب مرسم شاهين» — the bench: every lesson goes through the real painter and is scored. No AI, no
 * network, nothing written. A lesson passes when the picture is a sound, repeatable SVG and the painter
 * understood the idea (place, time, subjects, look) — or, for a gap, when it honestly said what is missing.
 */
import { PAINT_SIZES, paintScene, type Painting } from '../../src/utils/shaheenPainter';
import type { PaintLesson } from './lessons';

export interface LessonResult { id: string; idea: string; ok: boolean; beyond: boolean; problems: string[]; painting: Painting }
export interface PaintReport { total: number; pass: number; fail: number; known: number; gaps: string[]; results: LessonResult[] }

const VENDOR = /gemini|openai|chatgpt|dall|midjourney|claude|imagen|stable diffusion/i;

export function soundSvg(p: Painting): string[] {
  const problems: string[] = [];
  if (!p.svg.startsWith('<svg') || !p.svg.trimEnd().endsWith('</svg>')) problems.push('الملف مش SVG كامل');
  if (/NaN|undefined|Infinity/.test(p.svg)) problems.push('أرقام فاسدة في الرسم');
  if (/<script|\son\w+=|href="http/i.test(p.svg)) problems.push('الرسم فيه كود أو رابط خارجي');
  if (VENDOR.test(p.svg)) problems.push('اسم مزوّد ظاهر في الرسم');
  if (!Object.values(PAINT_SIZES).some(([w, h]) => w === p.width && h === p.height)) problems.push('مقاس غير معروف');
  const open = (p.svg.match(/<g[\s>]/g) || []).length, close = (p.svg.match(/<\/g>/g) || []).length;
  if (open !== close) problems.push('مجموعات غير مقفولة');
  return problems;
}

export function runLesson(lesson: PaintLesson): LessonResult {
  const painting = paintScene(lesson.idea, { seed: 7 });
  const problems = soundSvg(painting);
  if (paintScene(lesson.idea, { seed: 7 }).svg !== painting.svg) problems.push('الرسمة مش ثابتة لنفس الفكرة');
  if (lesson.beyond) {
    if (!painting.missing) problems.push('ما اعترفش إن العنصر الرئيسي مش من مفرداته');
  } else {
    if (painting.missing) problems.push(`اعتبر «${painting.missing}» ناقص وهو المفروض يعرفه`);
    if (lesson.setting && painting.setting !== lesson.setting) problems.push(`المكان ${painting.setting} والمطلوب ${lesson.setting}`);
    if (lesson.time && painting.time !== lesson.time) problems.push(`الوقت ${painting.time} والمطلوب ${lesson.time}`);
    if (lesson.look && painting.look !== lesson.look) problems.push(`الأسلوب ${painting.look} والمطلوب ${lesson.look}`);
    for (const s of lesson.subjects || []) if (!painting.subjects.includes(s)) problems.push(`العنصر ${s} ما اترسمش`);
  }
  return { id: lesson.id, idea: lesson.idea, ok: problems.length === 0, beyond: Boolean(lesson.beyond), problems, painting };
}

export function runPaintTraining(lessons: PaintLesson[]): PaintReport {
  const results = lessons.map(runLesson);
  const pass = results.filter((r) => r.ok).length;
  return {
    total: results.length, pass, fail: results.length - pass,
    known: results.filter((r) => !r.beyond && r.ok).length,
    gaps: results.filter((r) => r.beyond && r.painting.missing).map((r) => r.painting.missing as string),
    results,
  };
}

export function formatPaintReport(report: PaintReport, verbose = false): string {
  const lines = [`تدريب مرسم شاهين: ${report.pass}/${report.total} درس ناجح — ${report.known} فكرة بيرسمها كاملة.`];
  for (const r of report.results) {
    if (r.ok && !verbose) continue;
    lines.push(`${r.ok ? '✓' : '✗'} ${r.id}: ${r.idea}`);
    for (const p of r.problems) lines.push(`    - ${p}`);
    if (verbose) lines.push(`    ${r.painting.setting} / ${r.painting.time} / ${r.painting.look} / [${r.painting.subjects.join(', ')}]${r.painting.missing ? ` / ناقص: ${r.painting.missing}` : ''}`);
  }
  if (report.gaps.length) lines.push(`الدروس الجاية (لسه ما يعرفش يرسمها وبيقول كده بصراحة): ${[...new Set(report.gaps)].join('، ')}`);
  return lines.join('\n');
}
