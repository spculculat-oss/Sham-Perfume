import { algebraInput, solveEngineeringAlgebra, transformEngineeringAlgebra, type AlgebraAction } from './engineeringAlgebra';
import { ENGINEERING_EXPRESSION_LIMIT, ENGINEERING_VARIABLES, EngineeringError, explainEngineeringCalculation, normalizeEngineeringInput, parseEngineeringExpression, type AngleMode, type EngineeringExpression } from './engineeringCalculator';

export const STUDY_QUESTION_LIMIT = 1200;
export const STUDY_ACTIONS = ['calculate', 'solve', 'simplify', 'factor', 'differentiate', 'integrate'] as const;
export type StudyAction = typeof STUDY_ACTIONS[number];
export interface StudyPlan { action: StudyAction; math: string }
export type StudyOutcome =
  | ({ kind: 'calculation' } & ReturnType<typeof explainEngineeringCalculation>)
  | { kind: 'equation'; solution: ReturnType<typeof solveEngineeringAlgebra> }
  | ({ kind: 'algebra'; action: Exclude<AlgebraAction, 'solve'> } & ReturnType<typeof transformEngineeringAlgebra>);

function assertNoFreeMemory(node: EngineeringExpression, bound = false): void {
  if (node.kind === 'identifier' && (node.value.toLowerCase() === 'ans' || ENGINEERING_VARIABLES.includes(node.value as typeof ENGINEERING_VARIABLES[number])) && !(bound && node.value === 'x')) {
    throw new EngineeringError('syntax', 'Use an explicit value or solve a polynomial in x; no stored value is assumed.');
  }
  if (node.kind === 'call' && (node.name === 'f' || node.name === 'g')) throw new EngineeringError('syntax', 'Write the complete formula instead of a stored function.');
  if (node.kind === 'binary') { assertNoFreeMemory(node.left, bound); assertNoFreeMemory(node.right, bound); }
  else if (node.kind === 'unary') assertNoFreeMemory(node.value, bound);
  else if (node.kind === 'call') node.args.forEach((arg, i) => assertNoFreeMemory(arg, bound || i === 0 && ['integral', 'deriv', 'sumx', 'prodx'].includes(node.name)));
}

export function readStudyPlan(value: unknown): StudyPlan | undefined {
  const plan = value as Partial<StudyPlan> | null;
  if (!plan || typeof plan !== 'object' || !STUDY_ACTIONS.includes(plan.action as StudyAction) || typeof plan.math !== 'string' || !plan.math.trim() || plan.math.length > ENGINEERING_EXPRESSION_LIMIT) return;
  const math = algebraInput(plan.math);
  if (privateStudyText(math) || !/^[a-z0-9_ᴇ+×·÷−–²³π√٪°()=.,،٫%!*^/\s-]+$/i.test(normalizeEngineeringInput(math))) return;
  return { action: plan.action!, math };
}

export function runStudyPlan(plan: StudyPlan, angleMode: AngleMode = 'DEG'): StudyOutcome {
  if (plan.action === 'calculate') {
    assertNoFreeMemory(parseEngineeringExpression(plan.math));
    return { kind: 'calculation', ...explainEngineeringCalculation(plan.math, { angleMode, complex: true }) };
  }
  if (plan.action === 'solve') return { kind: 'equation', solution: solveEngineeringAlgebra(plan.math) };
  return { kind: 'algebra', action: plan.action, ...transformEngineeringAlgebra(plan.math, plan.action) };
}

// Recognize only a complete known request, not an arbitrary number extracted from a story.
const commands: readonly [StudyAction, RegExp][] = [
  ['calculate', /^(?:calculate|evaluate|احسب|أحسب)(?:\s*[:：]\s*|\s+)(.+)$/i],
  ['solve', /^(?:solve|حل(?:\s+المعادلة)?)(?:\s*[:：]\s*|\s+)(.+)$/i],
  ['simplify', /^(?:simplify|expand|بس[ّ]?ط|فك الأقواس)(?:\s*[:：]\s*|\s+)(.+)$/i],
  ['factor', /^(?:factor|حلل|حلّل)(?:\s*[:：]\s*|\s+)(.+)$/i],
  ['differentiate', /^(?:differentiate|derivative\s+of|اشتق|مشتقة)(?:\s*[:：]\s*|\s+)(.+)$/i],
  ['integrate', /^(?:integrate|antiderivative\s+of|كامل|تكامل)(?:\s*[:：]\s*|\s+)(.+)$/i],
];
const amount = String.raw`(\d+(?:\.\d+)?)`;
const percent = new RegExp(`^(?:(?:what is|كام|كم|احسب)\\s+)?${amount}\\s*[%٪]\\s*(?:of|من)\\s+${amount}$`, 'i');
const rectangle = new RegExp(`^(?:مساحة مستطيل طوله\\s+${amount}\\s+وعرضه\\s+${amount}|(?:area of (?:a )?rectangle(?: with)?)\\s+length\\s+${amount}\\s+(?:and )?width\\s+${amount})$`, 'i');

export function localStudyPlan(question: string): StudyPlan | undefined {
  if (question.length > STUDY_QUESTION_LIMIT) return;
  const clean = algebraInput(question.trim().replace(/[?؟。]+\s*$/, ''));
  let plan: StudyPlan | undefined;
  const normalized = normalizeEngineeringInput(clean);
  const fraction = normalized.match(percent);
  const shape = normalized.match(rectangle);
  if (fraction) plan = { action: 'calculate', math: `${fraction[1]}% * ${fraction[2]}` };
  else if (shape) plan = { action: 'calculate', math: `${shape[1] ?? shape[3]} * ${shape[2] ?? shape[4]}` };
  else for (const [action, pattern] of commands) {
    const match = clean.match(pattern);
    if (match) { plan = { action, math: match[1] }; break; }
  }
  const input = readStudyPlan(plan ?? { action: clean.includes('=') ? 'solve' : 'calculate', math: clean });
  if (!input) return;
  // Do not reinterpret prose as math. Bare polynomials are expanded, never evaluated at x = 0.
  try {
    if (input.action === 'calculate') assertNoFreeMemory(parseEngineeringExpression(input.math));
  } catch (error) {
    if (!plan && error instanceof EngineeringError && /x/i.test(input.math)) {
      try { transformEngineeringAlgebra(input.math, 'simplify'); return { ...input, action: 'simplify' }; } catch { return; }
    }
    return;
  }
  return input;
}

export type TutorReply = { kind: 'local'; plan: StudyPlan } | { kind: 'suggestion'; hint: string; plan?: StudyPlan } | { kind: 'unavailable' };
/** Student text is sent only by a separate opt-in button. Help reject obvious personal data and keys. */
export function privateStudyText(question: string) {
  return /https?:\/\/|\bwww\.|[\w.+%-]+@[\w.-]+\.[a-z]{2,}|\b(?:api.?key|password|secret|bearer)\s*[:=]|(?:كلمة المرور|رقم الهاتف)\s*[:=]/i.test(question);
}

export function readTutorReply(value: unknown): TutorReply | undefined {
  const reply = value as { kind?: unknown; hint?: unknown; plan?: unknown } | null;
  if (reply?.kind === 'unavailable') return { kind: 'unavailable' };
  const plan = readStudyPlan(reply?.plan);
  if (reply?.kind === 'local' && plan) return { kind: 'local', plan };
  if (reply?.kind === 'suggestion' && typeof reply.hint === 'string') {
    const hint = reply.hint.trim();
    if (!hint || hint.length > 520 || privateStudyText(hint) || /[<>\u0000-\u0008]|```/.test(hint)) return;
    return { kind: 'suggestion', hint, ...(plan ? { plan } : {}) };
  }
}

/** Check a numerical attempt independently, not the meaning of the question or the student's reasoning. */
export function compareStudyAnswer(value: ReturnType<typeof explainEngineeringCalculation>['value'], attempt: string, angle: AngleMode) {
  const checked = runStudyPlan({ action: 'calculate', math: attempt }, angle);
  if (checked.kind !== 'calculation') return 'different';
  const actual = checked.value;
  if (value.exact && actual.exact && value.exact.symbol === actual.exact.symbol) {
    return value.exact.numerator === actual.exact.numerator && value.exact.denominator === actual.exact.denominator ? 'exact' : 'different';
  }
  const equal = (a: number, b: number) => Math.abs(a - b) <= 1e-8 * Math.max(Math.abs(a), Math.abs(b));
  return equal(value.re, actual.re) && equal(value.im, actual.im) ? 'close' : 'different';
}
