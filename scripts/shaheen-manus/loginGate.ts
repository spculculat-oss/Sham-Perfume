/** Shared by the tour cleaner, the pre-meeting check and the council so all read the checkout step the same way. */
const LOGIN_RE = /تسجيل\s*(?:ال)?دخول|سجّ?ل\s*(?:ال)?دخول|تسجيل\s*الحساب|log\s*-?in|sign\s*-?in/i;
const REAL_FAULT_RE = /فاضي|فاضية|بيضا|معطل|معطّل|مش\s*شغال|لا\s*يعمل|لم\s*(?:يفتح|تفتح|يظهر|تظهر)|خطأ|error|crash|blank|broken|اختف|ضاع|مكسور/i;

/**
 * #462 — payment only after a real verified sign-in is the site's own rule (#311). A checkout step that stopped at
 * the sign-in window is the journey working as designed, not a fallen step — unless the note also reports a fault.
 */
export function isExpectedLoginGate(step: { step: string; ok: boolean; noteAr: string }): boolean {
  return step.step === 'checkout' && !step.ok && LOGIN_RE.test(step.noteAr) && !REAL_FAULT_RE.test(step.noteAr);
}

export function acceptLoginGate<T extends { step: string; ok: boolean; noteAr: string }>(step: T): T {
  return isExpectedLoginGate(step) ? { ...step, ok: true, noteAr: `صفحة الدفع طلبت تسجيل الدخول قبل الدفع — ده المقصود (الدفع بعد حساب متأكد بس). ${step.noteAr}`.slice(0, 300) } : step;
}


/** Same judgement on a raw journey row read back from `manus-missions.json`. */
export function journeyRowOk(row: Record<string, unknown>): boolean {
  if (row.ok !== false) return true;
  return isExpectedLoginGate({ step: String(row.step ?? ''), ok: false, noteAr: String(row.noteAr ?? '') });
}
