/**
 * «ذاكرة الزائر المنظمة» — تدير تفضيلات الزائر (النوتات العطرية، التركيز، الميزانية،
 * الخدمة المفضلة، آخر رقم طلب) وسجل تفاعلاته، مع تحويل ثنائي نظيف إلى سجل نصي آمن
 * يتوافق مع بطاقة الخصوصية (GDPR / عرض وحذف الذاكرة) دون كائنات مشوهة.
 */
import { CONFIDENCE_LIMITS } from './confidence';

export interface VisitorPreferences {
  name?: string;
  language?: 'ar' | 'en';
  preferredService?: string;
  priceRange?: { min?: number; max?: number; currency?: string };
  perfumeNotes?: string[];
  concentration?: string;
  budget?: number;
  lastContactRef?: string;
  avoidedIntents?: string[];
}

export interface VisitorMemoryState {
  visitorId: string;
  preferences: VisitorPreferences;
  conversationHistory: Array<{
    at: string;
    intent: string;
    serviceId?: string;
    confidence: number;
    answeredWell: boolean;
  }>;
  lastUpdated: string;
}

export function emptyVisitorMemory(visitorId: string): VisitorMemoryState {
  return {
    visitorId,
    preferences: {},
    conversationHistory: [],
    lastUpdated: new Date().toISOString(),
  };
}

/** التوافق مع الاسم المختصر */
export const emptyMemory = emptyVisitorMemory;

/** يبني حالة ذاكرة الزائر المنظمة من قاموس المحادثة النصي المحفوظ. */
export function fromFlatMemory(visitorId: string, flat: Record<string, string> = {}): VisitorMemoryState {
  const state = emptyVisitorMemory(visitorId);
  if (flat.name) state.preferences.name = flat.name;
  if (flat.lastService) state.preferences.preferredService = flat.lastService;
  if (flat.lastRequestRef) state.preferences.lastContactRef = flat.lastRequestRef;
  if (flat.preferredNotes) state.preferences.perfumeNotes = flat.preferredNotes.split('، ').map((s) => s.trim()).filter(Boolean);
  if (flat.concentration) state.preferences.concentration = flat.concentration;
  if (flat.budget && !Number.isNaN(Number(flat.budget))) state.preferences.budget = Number(flat.budget);
  return state;
}

/** يحول حالة الذاكرة المنظمة إلى قيم نصية نظيفة قابلة للحفظ والعرض في بطاقة الخصوصية. */
export function toFlatMemory(state: VisitorMemoryState, existing: Record<string, string> = {}): Record<string, string> {
  const out: Record<string, string> = { ...existing };
  const p = state.preferences;
  if (p.name) out.name = p.name;
  if (p.preferredService) out.lastService = p.preferredService;
  if (p.lastContactRef) out.lastRequestRef = p.lastContactRef;
  if (p.perfumeNotes?.length) out.preferredNotes = [...new Set(p.perfumeNotes)].slice(0, 6).join('، ');
  if (p.concentration) out.concentration = p.concentration;
  if (p.budget !== undefined) out.budget = String(p.budget);
  return out;
}

export function addConversationRecord(
  memory: VisitorMemoryState,
  record: { at: string; intent: string; serviceId?: string; confidence: number; answeredWell: boolean },
): VisitorMemoryState {
  const history = [...memory.conversationHistory, record].slice(-20);
  return { ...memory, conversationHistory: history, lastUpdated: record.at };
}

export function updatePreferences(
  memory: VisitorMemoryState,
  updates: Partial<VisitorPreferences>,
): VisitorMemoryState {
  return {
    ...memory,
    preferences: { ...memory.preferences, ...updates },
    lastUpdated: new Date().toISOString(),
  };
}

/** يستخلص تفضيلات الزائر من الكيانات المستخرجة من رسالته (النوتات، التركيز، الميزانية). */
export function extractPreferencesFromEntities(
  memory: VisitorMemoryState,
  entities: Record<string, string | number | undefined>,
): VisitorMemoryState {
  const updates: Partial<VisitorPreferences> = {};
  if (typeof entities.name === 'string' && entities.name) updates.name = entities.name;
  if (typeof entities.notes === 'string' && entities.notes) {
    const incoming = entities.notes.split(',').map((s) => s.trim()).filter(Boolean);
    updates.perfumeNotes = [...new Set([...(memory.preferences.perfumeNotes || []), ...incoming])].slice(0, 6);
  }
  if (typeof entities.concentrationType === 'string' && entities.concentrationType) {
    updates.concentration = entities.concentrationType;
  }
  if (typeof entities.budget === 'number' && entities.budget > 0) {
    updates.budget = entities.budget;
  }
  return Object.keys(updates).length > 0 ? updatePreferences(memory, updates) : memory;
}

/** يستخلص تفضيلات مؤكدة من نتائج الأدوات (بدون تلويث بطاقة الخصوصية بكائنات غير نصية). */
export function extractPreferencesFromToolResult(
  memory: VisitorMemoryState,
  tool: string,
  result: { data?: unknown; observation?: string },
): VisitorMemoryState {
  const updates: Partial<VisitorPreferences> = {};
  if (tool === 'search_catalog' && result.data) {
    const data = result.data as { matched?: boolean; products?: Array<{ price?: number; currency?: string }> };
    if (data.matched && data.products?.length) {
      const prices = data.products.map((p) => p.price).filter((p): p is number => typeof p === 'number');
      if (prices.length) {
        updates.priceRange = { min: Math.min(...prices), max: Math.max(...prices), currency: data.products[0]?.currency };
      }
    }
  }
  if (tool === 'track_order' && result.data) {
    const req = result.data as { ref?: string };
    if (req.ref) updates.lastContactRef = req.ref;
  }
  return Object.keys(updates).length > 0 ? updatePreferences(memory, updates) : memory;
}

export function memoryBelowThreshold(confidence: number): boolean {
  return confidence < CONFIDENCE_LIMITS.memory;
}

export function suggestServiceFromMemory(
  memory: VisitorMemoryState,
  services: { id: string; nameAr: string; nameEn: string; kind: string }[],
): { id: string; nameAr: string; nameEn: string; reasonAr: string; reasonEn: string } | undefined {
  const lastService = memory.preferences.preferredService || memory.conversationHistory.at(-1)?.serviceId;
  if (!lastService) return undefined;
  const found = services.find((sv) => sv.id === lastService);
  if (!found) return undefined;
  return {
    id: found.id,
    nameAr: found.nameAr,
    nameEn: found.nameEn,
    reasonAr: 'خدمة اهتممت بها سابقاً',
    reasonEn: 'Service from your previous activity',
  };
}
