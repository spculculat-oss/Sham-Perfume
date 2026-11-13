/**
 * «منتقي الحلول» — يقارن بين المسارات الممكنة (أداة مباشرة، سلسلة أدوات، مجلس استشاري،
 * محرك لغوي، أو سؤال توضيحي للزائر) ويختار المسار الأعلى ثقة والأكثر ملاءمة لسياق الزائر.
 */
import type { ServiceDef } from './types';
import { clampConfidence, type DisambiguationPrompt } from './confidence';

export interface SolutionOption {
  id: string;
  type: 'tool' | 'engine' | 'council' | 'human';
  confidence: number;
  reasonAr: string;
  reasonEn: string;
  args?: Record<string, unknown>;
}

export interface SolutionSelection {
  chosen: SolutionOption;
  alternatives: SolutionOption[];
  needsVisitorClarification: boolean;
  clarificationQuestion?: { ar: string; en: string; options: { id: string; labelAr: string; labelEn: string }[] };
}

/**
 * يقارن الخيارات الممكنة لرسالة الزائر ويختار أفضل حل قابل للتنفيذ.
 * يطلب توضيحاً من الزائر فقط عند وجود التباس حقيقي بين خدمات متنافسة أو طلب إجراء بلا خدمة محددة.
 */
export function selectSolution(
  routedIntent: string,
  confidence: number,
  services: ServiceDef[],
  entities: Record<string, string | number | undefined>,
  visitorMemory: Record<string, unknown>,
  options: { ambiguous?: boolean; disambiguation?: DisambiguationPrompt; consultRequested?: boolean } = {},
): SolutionSelection {
  // 1) عند وجود التباس حقيقي بين خدمات أو طلب مبهم دون سياق سابق، نطلب توضيحاً مباشراً بدلاً من التخمين
  if (options.ambiguous && options.disambiguation) {
    const d = options.disambiguation;
    return {
      chosen: {
        id: 'ask_visitor',
        type: 'human',
        confidence: clampConfidence(confidence),
        reasonAr: 'الطلب يحتمل أكثر من خدمة ويحتاج تحديداً من الزائر',
        reasonEn: 'Request matches multiple services or lacks a target service',
      },
      alternatives: d.options
        .filter((o) => o.id !== 'other')
        .map((o) => ({
          id: `service:${o.id}`,
          type: 'tool' as const,
          confidence: 0.5,
          reasonAr: `خدمة مرشحة: ${o.labelAr}`,
          reasonEn: `Candidate service: ${o.labelEn}`,
          args: { serviceId: o.id },
        })),
      needsVisitorClarification: true,
      clarificationQuestion: { ar: d.questionAr, en: d.questionEn, options: d.options },
    };
  }

  const candidates: SolutionOption[] = [];

  // 2) المجلس الاستشاري عند استشارات التركيب أو طلب المشورة الصريح
  if (options.consultRequested || routedIntent === 'perfume_expert') {
    candidates.push({
      id: 'advisory_council',
      type: 'council',
      confidence: clampConfidence(options.consultRequested ? 0.92 : Math.max(confidence, 0.78)),
      reasonAr: 'مسألة استشارية تستفيد من مداولة خبراء التركيب والسلامة والتكلفة',
      reasonEn: 'Consultative question benefits from multi-role peer review',
    });
  }

  // 3) التحويل البشري المباشر
  if (routedIntent === 'handoff') {
    candidates.push({
      id: 'human_handoff',
      type: 'human',
      confidence: 0.95,
      reasonAr: 'الزائر طلب التحدث مع موظف من فريق شام',
      reasonEn: 'Visitor explicitly asked for a human team member',
    });
  }

  // 4) الأدوات الحتمية الدقيقة (تتبع طلب / حساب تركيز / قائمة الخدمات)
  if (routedIntent === 'track_order') {
    const hasCredentials = Boolean((entities.ref || visitorMemory.lastContactRef || visitorMemory.lastRequestRef) && (entities.phone || entities.email));
    candidates.push({
      id: 'track_order',
      type: 'tool',
      confidence: hasCredentials ? 0.95 : 0.8,
      reasonAr: hasCredentials ? 'بيانات التتبع مكتملة للتحقق الفوري' : 'طلب تتبع يحتاج رقم الطلب ووسيلة التواصل',
      reasonEn: hasCredentials ? 'Tracking credentials present for direct lookup' : 'Order tracking requires reference and contact',
      args: { ref: entities.ref || visitorMemory.lastContactRef || visitorMemory.lastRequestRef, contact: entities.phone || entities.email },
    });
  }

  if (routedIntent === 'calculate' && entities.volumeMl && entities.percent) {
    candidates.push({
      id: 'calc_concentration',
      type: 'tool',
      confidence: 0.95,
      reasonAr: 'حساب رياضي دقيق لنسب الزيت والقاعدة الكحولية',
      reasonEn: 'Deterministic volume concentration calculation',
      args: { volumeMl: entities.volumeMl, percent: entities.percent },
    });
  }

  // 5) مطابقة الخدمات المتاحة + ذاكرة الزائر
  const preferredService = (visitorMemory.preferredService || visitorMemory.lastService) as string | undefined;
  for (const service of services) {
    const match = serviceIntentMatch(routedIntent, service, entities);
    if (match > 0) {
      const memoryBoost = preferredService === service.id ? 0.08 : 0;
      candidates.push({
        id: `service:${service.id}`,
        type: 'tool',
        confidence: clampConfidence(Math.min(0.95, 0.52 + match * 0.14 + memoryBoost)),
        reasonAr: `خدمة «${service.nameAr}» تتطابق مع هدف الزائر`,
        reasonEn: `Service "${service.nameEn}" aligns with visitor goal`,
        args: { serviceId: service.id },
      });
    }
  }

  if (preferredService && services.some((s) => s.id === preferredService) && !candidates.some((c) => c.id === `service:${preferredService}`)) {
    candidates.push({
      id: `service:${preferredService}`,
      type: 'tool',
      confidence: 0.62,
      reasonAr: 'خدمة اهتم بها الزائر مسبقاً في سجله',
      reasonEn: 'Service previously visited in visitor memory',
      args: { serviceId: preferredService },
    });
  }

  // 6) استرجاع المعرفة الموثقة
  if (routedIntent === 'question' || routedIntent === 'perfume_expert') {
    candidates.push({
      id: 'retrieve_knowledge',
      type: 'tool',
      confidence: clampConfidence(Math.max(0.68, confidence)),
      reasonAr: 'البحث في قاعدة معرفة شام الموثقة قبل الصياغة',
      reasonEn: 'Search Sham grounded knowledge base before rendering',
    });
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  const chosen = candidates[0] || {
    id: 'sham_local',
    type: 'engine',
    confidence: clampConfidence(Math.max(0.5, confidence)),
    reasonAr: 'الرد المباشر عبر محرك شام الموثق',
    reasonEn: 'Direct response via Sham grounded composer',
  };

  return {
    chosen,
    alternatives: candidates.slice(1, 4),
    needsVisitorClarification: false,
  };
}

function serviceIntentMatch(intent: string, service: ServiceDef, entities: Record<string, string | number | undefined>): number {
  let score = 0;
  if (intent === 'browse_products' && service.kind === 'store') score += 3;
  if (intent === 'handoff' && service.kind === 'support') score += 3;
  if (intent === 'calculate' && service.kind === 'info') score += 2;
  if (entities.notes && (service.kind === 'custom_order' || service.kind === 'store')) score += 1;
  const hay = `${service.nameAr} ${service.nameEn} ${service.descriptionAr} ${service.descriptionEn}`.toLowerCase();
  if (intent === 'service_request' && service.kind !== 'info') score += 1.5;
  if (hay.includes(intent.toLowerCase())) score += 1.5;
  return score;
}
