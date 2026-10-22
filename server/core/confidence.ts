/**
 * «نظام درجات الثقة» — كل مكون استدلالي في المنصة يُنتج درجة ثقة معايرة من 0 إلى 1.
 * عند انخفاض الثقة عن الحد الآمن، يسأل النظام الزائر بوضوح أو يرجع للمحرك المحلي الموثوق بدلاً من التخمين.
 */

/** النتيجة الموثقة لأي مكون استدلالي: القيمة + درجة الثقة + سبب القرار بالعربية والإنجليزية. */
export interface Confident<T> {
  value: T;
  confidence: number;
  reasonAr: string;
  reasonEn: string;
}

/** حدود الثقة المعيارية لكل طبقة في Sham Core. */
export const CONFIDENCE_LIMITS = {
  /** التوجيه: أقل من هذا الحد مع التباس فعلي يستدعي سؤال توضيحي للزائر */
  route: 0.45,
  /** المجلس الاستشاري: حد اتفاق المستشارين قبل التنبيه بوجود خلاف جوهري */
  councilAgreement: 0.55,
  /** المحرك اللغوي: أقل من هذا الحد يرجع تلقائياً إلى محرك شام الذاتي الموثق */
  engine: 0.5,
  /** الأدوات وسلاسل التنفيذ: أقل من هذا الحد يفعّل البديل أو إعادة التخطيط */
  tool: 0.5,
  /** ذاكرة الزائر: أقل من هذا الحد لا يُفترض كتفضيل مؤكد */
  memory: 0.5,
} as const;

export interface DisambiguationPrompt {
  questionAr: string;
  questionEn: string;
  options: { id: string; labelAr: string; labelEn: string }[];
}

/** قرار التوجيه المعزز مع الثقة المعايرة والكيانات واحتمال الالتباس. */
export interface RoutingDecision {
  intent: string;
  serviceId?: string;
  /** Which platform feature the visitor asked about (see platformGuide.ts); absent = the whole map. */
  platformId?: string;
  confidence: number;
  entities: Record<string, string | number | undefined>;
  scores: Record<string, number>;
  ambiguous?: boolean;
  disambiguation?: DisambiguationPrompt;
}

/** حكم تنفيذ أداة مع درجة الثقة وقابلية إعادة المحاولة. */
export interface ToolVerdict {
  observation: string;
  confidence: number;
  actions?: unknown[];
  citations?: unknown[];
  data?: unknown;
  retry?: boolean;
  reasonAr?: string;
}

/** حكم الفهم والاستيعاب ومطابقة الحقائق (Grounding & Comprehension Gate). */
export interface ComprehensionVerdict {
  answersQuestion: boolean;
  hallucinated: boolean;
  confidence: number;
  missingAr: string[];
  missingEn: string[];
  reasonAr: string;
  reasonEn: string;
}

/** قاطع دائرة للمحرك عند تكرار الأعطال المتتالية. */
export interface EngineCircuit {
  failures: number;
  firstFailureAt?: number;
  pausedUntil?: number;
}

export function isEnginePaused(circuit: EngineCircuit, now: number): boolean {
  return Boolean(circuit.pausedUntil && now < circuit.pausedUntil);
}

export function recordEngineFailure(circuit: EngineCircuit, now: number, maxFailures = 3, pauseMs = 10 * 60_000): EngineCircuit {
  const failures = circuit.failures + 1;
  if (failures >= maxFailures) {
    return { ...circuit, failures, firstFailureAt: circuit.firstFailureAt ?? now, pausedUntil: now + pauseMs };
  }
  return { ...circuit, failures, firstFailureAt: circuit.firstFailureAt ?? now };
}

export function resetEngineCircuit(_circuit: EngineCircuit): EngineCircuit {
  return { failures: 0 };
}

export function needsDisambiguation(confidence: number, ambiguous = false): boolean {
  return ambiguous || confidence < CONFIDENCE_LIMITS.route;
}

export function engineBelowThreshold(confidence: number): boolean {
  return confidence < CONFIDENCE_LIMITS.engine;
}

export function toolBelowThreshold(confidence: number): boolean {
  return confidence < CONFIDENCE_LIMITS.tool;
}

export function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(3))));
}
