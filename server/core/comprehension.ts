/**
 * «منطق الفهم والاستيعاب وفحص الهلوسة» — بوابة جودة تتحقق من سلامة الرد ومطابقته
 * لحقائق السياق (CONTEXT) وقواعد الأمان قبل اعتماده للزائر.
 */
import { CONFIDENCE_LIMITS, clampConfidence, type ComprehensionVerdict } from './confidence';
export type { ComprehensionVerdict };

const ORDER_REF_RE = /\bSH-[A-Z0-9]{6}\b/gi;
const PRICE_CLAIM_RE = /(?:^|\s|\()(\d{2,6}(?:[.,]\d{1,2})?)\s*(?:EGP|USD|SAR|AED|جنيه|ج\.م|ريال|درهم|دولار)(?=$|\s|[،,.!؟?;:)\]])/giu;
const FALSE_CONFIRM_RE = /(?:تم تأكيد طلبك رسميا|تم سحب المبلغ|تم الدفع بنجاح|تم شحن طلبك الآن|your order has been placed and paid|payment has been charged)/i;
const CARD_SOLICIT_RE = /(?:ابعت رقم البطاقة|أرسل رقم البطاقة|رقم الكارت كاملا|كود الـ?\s*CVV|ادخل كلمة المرور|send your credit card number|share your cvv|enter your password)/i;
const PROMPT_LEAK_RE = /(?:UI CARDS SHOWN UNDER YOUR REPLY:|SAFE DRAFT \(accurate, rephrase)/i;

/** يستخرج الأرقام المرجعية المسموح بذكرها من السياق وسؤال الزائر. */
function allowedNumbers(sources: string[]): Set<string> {
  const nums = new Set<string>();
  for (const src of sources) {
    const normalized = src.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
    for (const m of normalized.matchAll(/\d+(?:\.\d+)?/g)) nums.add(String(Number(m[0])));
  }
  return nums;
}

/** يكشف التكرار المرضي (token loop) في مخرجات النماذج اللغوية. */
function hasSevereRepetition(text: string): boolean {
  const words = text.trim().split(/\s+/);
  if (words.length < 16) return false;
  const counts = new Map<string, number>();
  for (let i = 0; i <= words.length - 4; i++) {
    const gram = words.slice(i, i + 4).join(' ').toLowerCase();
    const next = (counts.get(gram) || 0) + 1;
    if (next >= 4) return true;
    counts.set(gram, next);
  }
  return false;
}

/**
 * يفحص الرد مقابل سؤال الزائر وحقائق الأدوات (CONTEXT) للتأكد من عدم اختلاق أسعار
 * أو أرقام طلبات أو ادعاءات تنفيذ وهمية أو تسريب تعليمات النظام.
 */
export function assessComprehension(
  visitorQuestion: string,
  reply: string,
  lang: 'ar' | 'en',
  contextFacts: string[],
): ComprehensionVerdict {
  const ar = lang === 'ar';
  const missingAr: string[] = [];
  const missingEn: string[] = [];
  let hallucinated = false;
  let confidence = 0.92;

  const trimmed = (reply || '').trim();
  if (!trimmed) {
    return {
      answersQuestion: false,
      hallucinated: false,
      confidence: 0,
      missingAr: ['الرد فارغ'],
      missingEn: ['Reply is empty'],
      reasonAr: 'لم يصدر رد صالح من المحرك',
      reasonEn: 'Engine returned an empty reply',
    };
  }

  const combinedContext = [visitorQuestion, ...contextFacts].join('\n');
  const contextUpper = combinedContext.toUpperCase();

  // 1) فحص اختلاق أرقام طلبات (SH-XXXXXX) غير موجودة في السياق أو رسالة الزائر
  for (const match of trimmed.matchAll(ORDER_REF_RE)) {
    const ref = match[0].toUpperCase();
    if (ref !== 'SH-XXXXXX' && !contextUpper.includes(ref)) {
      hallucinated = true;
      confidence = Math.min(confidence, 0.15);
      missingAr.push(`اختلاق رقم طلب غير موجود في السياق (${ref})`);
      missingEn.push(`Fabricated order reference not in context (${ref})`);
    }
  }

  // 2) فحص اختلاق أسعار بعملات لم ترد أرقامها في السياق أو سؤال الزائر
  const permittedNums = allowedNumbers([visitorQuestion, ...contextFacts]);
  for (const match of trimmed.matchAll(PRICE_CLAIM_RE)) {
    const num = String(Number(match[1].replace(',', '.')));
    if (!permittedNums.has(num)) {
      hallucinated = true;
      confidence = Math.min(confidence, 0.2);
      missingAr.push(`ذكر سعر غير موثق في بيانات شام (${match[0]})`);
      missingEn.push(`Unverified price claim not present in Sham context (${match[0]})`);
    }
  }

  // 3) فحص ادعاء تنفيذ طلب أو تحصيل دفعة دون سجل تتبع فعلي
  const hasFoundOrder = contextFacts.some((f) => /\bFOUND\s+SH-/i.test(f));
  if (!hasFoundOrder && FALSE_CONFIRM_RE.test(trimmed)) {
    hallucinated = true;
    confidence = Math.min(confidence, 0.15);
    missingAr.push('ادعاء تنفيذ طلب أو دفع بدون تأكيد فعلي من الاستمارة');
    missingEn.push('Claimed order placement or payment without actual confirmation');
  }

  // 4) فحص طلب بيانات بطاقة أو كلمة مرور
  if (CARD_SOLICIT_RE.test(trimmed)) {
    hallucinated = true;
    confidence = 0.05;
    missingAr.push('مخالفة أمنية: طلب بيانات بطاقة أو كلمة مرور');
    missingEn.push('Safety violation: solicited card number or password');
  }

  // 5) فحص تكرار الجمل التالف أو تسريب ترويسة النظام الداخلية
  if (hasSevereRepetition(trimmed) || PROMPT_LEAK_RE.test(trimmed)) {
    hallucinated = true;
    confidence = 0.1;
    missingAr.push('تلف في صياغة الرد أو تكرار آلي');
    missingEn.push('Degenerate repetition or prompt header leakage');
  }

  // 6) إشارة استرشادية لتغطية مفردات السؤال (دون رفض الصياغات المختصرة السليمة)
  const qTokens = visitorQuestion
    .toLowerCase()
    .replace(/[^\u0600-\u06FFa-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 3);
  if (qTokens.length > 0 && !qTokens.some((t) => trimmed.toLowerCase().includes(t))) {
    confidence = Math.min(confidence, hallucinated ? confidence : 0.72);
  }

  const finalConfidence = clampConfidence(confidence);
  const answersQuestion = !hallucinated && finalConfidence >= CONFIDENCE_LIMITS.engine;
  return {
    answersQuestion,
    hallucinated,
    confidence: finalConfidence,
    missingAr,
    missingEn,
    reasonAr: answersQuestion
      ? (ar ? 'الرد متزن ومتوافق مع حقائق شام وقواعد الأمان' : 'Reply is coherent and grounded in Sham context')
      : (missingAr[0] || 'الرد خالف ضوابط الدقة وتم الرجوع للمحرك المحلي الموثق'),
    reasonEn: answersQuestion
      ? 'Reply is coherent and grounded in Sham context'
      : (missingEn[0] || 'Reply failed grounding check; falling back to local composer'),
  };
}

export function comprehensionBelowThreshold(confidence: number): boolean {
  return confidence < CONFIDENCE_LIMITS.engine;
}
