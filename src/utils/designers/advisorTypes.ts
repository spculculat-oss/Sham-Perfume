/**
 * «مستشار المصممين» — the shared shapes of the three helpers in the designers' section (perfume and cosmetics):
 *
 *  1. «تعديل مقترح»: concrete edits computed from the simulation, each with its reason, the exact change and its effect.
 *  2. «متخصص يوصّلك لخلطتك»: the designer writes where he wants to go; the specialist understands it (or asks), then
 *     builds the road step by step with a design at every step.
 *  3. «استشارة شاهين»: a score out of 10 with strengths, weaknesses and practical advice.
 *
 * Pure and deterministic, in the browser: it always works, with or without the AI platforms. Words are LText with
 * {placeholders} filled by the page (numbers in the visitor's numerals).
 */
import type { LText } from '../../لغات/localize';

export type MsgVar = string | number | LText;
export interface Msg { t: LText; v?: Record<string, MsgVar> }
export const msg = (t: LText, v?: Record<string, MsgVar>): Msg => (v ? { t, v } : { t });

/** One line's change between two designs (by its material id, else its label). */
export interface LineChange { id?: string; label: string; from: number; to: number }
/** A measured effect of a change: before → after. */
export interface Effect { label: LText; from: MsgVar; to: MsgVar; better: boolean }

export interface Suggestion<D> {
  id: string;
  title: Msg;
  why: Msg;
  /** The design after this edit alone (applied on the current one). */
  design: D;
  /** The same edit as a function, to chain «طبّق الكل». */
  apply: (d: D) => D;
  changes: LineChange[];
  effects: Effect[];
  priority: number;
}

export interface GoalQuestion { id: string; q: Msg; options: { label: LText; add: LText }[] }
export interface GoalStep<D> { say: Msg; design: D; changes: LineChange[] }
export interface GoalPlan<D> {
  /** What the specialist understood, as short lines. */
  understood: Msg[];
  /** Asked when the goal is too vague to build (the page shows them as choices that complete the sentence). */
  questions: GoalQuestion[];
  /** The road: each step's design includes all the steps before it. */
  steps: GoalStep<D>[];
  /** The final design (the last step's), when there is a road. */
  design?: D;
  /** How close the formula is to the goal before and after, 0–100. */
  match?: { from: number; to: number };
  effects: Effect[];
}

export interface Consultation {
  /** 0–10, one decimal. */
  score: number;
  grade: LText;
  /** The parts of the score, each 0–100. */
  parts: { label: LText; value: number }[];
  strengths: Msg[];
  weaknesses: Msg[];
  advice: Msg[];
}

export const VERDICT_TEXT: Record<'pass' | 'warn' | 'fail', LText> = {
  pass: { ar: 'مطابقة', en: 'Compliant' },
  warn: { ar: 'فيها ملاحظات', en: 'Has notes' },
  fail: { ar: 'مش مطابقة', en: 'Not compliant' },
};
export const verdictRank = (v: 'pass' | 'warn' | 'fail') => (v === 'pass' ? 0 : v === 'warn' ? 1 : 2);

export function gradeOf(score10: number): LText {
  if (score10 >= 8.5) return { ar: 'ممتازة — جاهزة للتجربة', en: 'Excellent — ready to test' };
  if (score10 >= 7) return { ar: 'كويسة جداً — لمسات بسيطة', en: 'Very good — small touches' };
  if (score10 >= 5.5) return { ar: 'مقبولة — محتاجة شوية شغل', en: 'Acceptable — needs some work' };
  return { ar: 'محتاجة شغل قبل ما تتخلط', en: 'Needs work before blending' };
}

/** Line-by-line differences between two designs (keyed by id, else label). */
export function diffLines<L extends { label: string; pct: number }>(before: L[], after: L[], idOf: (l: L) => string | undefined): LineChange[] {
  const key = (l: L) => idOf(l) || `~${l.label.trim().toLowerCase()}`;
  const sum = (ls: L[]) => { const m = new Map<string, { id?: string; label: string; pct: number }>(); for (const l of ls) { const k = key(l); const p = m.get(k); m.set(k, { id: idOf(l), label: l.label, pct: (p?.pct || 0) + l.pct }); } return m; };
  const a = sum(before), b = sum(after);
  const out: LineChange[] = [];
  for (const k of new Set([...a.keys(), ...b.keys()])) {
    const x = a.get(k), y = b.get(k);
    const from = Math.round((x?.pct || 0) * 100) / 100, to = Math.round((y?.pct || 0) * 100) / 100;
    if (Math.abs(from - to) >= 0.05) out.push({ id: (y || x)!.id, label: (y || x)!.label, from, to });
  }
  // Removals and additions first, then the biggest moves.
  return out.sort((p, q) => Number(q.from === 0 || q.to === 0) - Number(p.from === 0 || p.to === 0) || Math.abs(q.to - q.from) - Math.abs(p.to - p.from));
}

export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
export const round1 = (n: number) => Math.round(n * 10) / 10;
