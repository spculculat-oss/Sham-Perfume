/**
 * «وكيل مجلس المتخصصين» من المتصفح: يكلّم السيرفر (Vercel) — `/api/specialists/*` — ويسأل الوكيل،
 * ويرجع مع الرد **الأدوات اللي اشتغلت** وملاحظاتها ومصادرها وخطوات الزائر التالية.
 *
 * ولو السيرفر مش متاح (من غير إنترنت، أو نسخة GitHub Pages اللي مافيهاش API) الدالة بترجع
 * `undefined` — والواجهة ترد وقتها من ذاكرة المتصفح ومكتبة شاهين وملجئه محلياً (رد المجلس القديم
 * من غير إنترنت، بصراحة إنه من غير وكيل). مافيش نتيجة متخيلة أبداً.
 */
import { ApiUnavailableError, requestApi, visitorId } from './api';

/** الشبكة مقطوعة/السيرفر مش موجود — مش خطأ في السؤال، والواجهة ترد محلياً. */
const unreachable = (err: unknown) => err instanceof ApiUnavailableError || err instanceof TypeError;

// ── شكل الرد (نسخة المتصفح من عقد السيرفر) ─────────────────────────────────────────────────────────────────
export type SpecialistLang = 'ar' | 'en';

export interface BoardSpecialist {
  id: string; nameAr: string; nameEn: string; fieldAr: string; fieldEn: string;
  sciencesAr: string; sciencesEn: string; sections: number;
}
export interface BoardTool { id: string; labelAr: string; labelEn: string; descriptionAr: string; descriptionEn: string }
export interface BoardSection { id: string; titleAr: string; titleEn: string; consultants: string[] }
export interface SpecialistsBoard { ai: boolean; specialists: BoardSpecialist[]; sections: BoardSection[]; tools: BoardTool[]; toolCount: number }

export interface ToolTrace { tool: string; labelAr: string; labelEn: string; ok: boolean; ms: number }
/** مرجع داخلي: `id` رابط خارجي لما `kind === 'source'` (المصادر المفتوحة/الوسايط)، وغير كده معرف داخلي. */
export interface ToolCitation { id: string; title: string; kind: string }
export type SpecialistAction =
  | { type: 'open_tab'; tab: string; title?: string }
  | { type: 'open_chat'; prompt: string; title?: string }
  | { type: 'hand_over'; to: string; title?: string }
  | { type: 'media'; images?: { url: string; title: string; credit?: string }[]; places?: { label: string; lat: number; lon: number }[] };

export interface SpecialistReply {
  specialist: { id: string; nameAr: string; nameEn: string; fieldAr: string; fieldEn: string };
  question: string;
  answer: string;
  /** منين الرد جه بالظبط — بيتعرض للزائر زي ما هو. */
  source: string;
  ok: boolean;
  /** رد من محرك ذكاء اصطناعي (true) ولا من أدوات الموقع نفسها (false). */
  ai: boolean;
  tools: ToolTrace[];
  citations: ToolCitation[];
  actions: SpecialistAction[];
  followUps: string[];
  recorded: boolean;
  lang: SpecialistLang;
  section?: string;
  ms: number;
}

export interface SpecialistAsk {
  question: string;
  lang?: SpecialistLang;
  /** قسم الموقع اللي الزائر واقف فيه — بيساعد التوجيه. */
  section?: string;
  /** لو الزائر اختار متخصص بإيده — التوجيه بيتخطّى. */
  specialist?: string;
  /** آخر كام سؤال ورد — الوكيل بيقراهم عشان يفهم المتابعة («والتاني؟»). */
  history?: { role: 'user' | 'assistant'; text: string }[];
  visitorId?: string;
}

const CONSULT_TIMEOUT_MS = 60_000;
const BOARD_TIMEOUT_MS = 15_000;

/** يسأل الوكيل. `undefined` = السيرفر مش متاح دلوقتي (الواجهة ترد محلياً). */
export async function askSpecialists(input: SpecialistAsk): Promise<SpecialistReply | undefined> {
  try {
    return await requestApi<SpecialistReply>('/api/specialists/consult', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-sham-visitor': input.visitorId ?? visitorId() },
      body: JSON.stringify({
        question: input.question,
        language: input.lang ?? 'ar',
        section: input.section,
        specialist: input.specialist,
        history: input.history?.slice(-8),
        visitorId: input.visitorId ?? visitorId(),
      }),
    }, CONSULT_TIMEOUT_MS);
  } catch (err) {
    if (unreachable(err)) return undefined;
    throw err; // 429/400/500 — الواجهة تقول للزائر الحقيقة وتجرب الرد المحلي
  }
}

/** لوحة المجلس: المتخصصين وأقسامهم وصندوق أدوات الوكيل (بتتحمّل مرة واحدة). */
export async function loadSpecialistsBoard(): Promise<SpecialistsBoard | undefined> {
  try {
    return await requestApi<SpecialistsBoard>('/api/specialists/board', { method: 'GET' }, BOARD_TIMEOUT_MS);
  } catch {
    return undefined; // من غير لوحة السيرفر: المجلس المحلي (shaheenSpecialists) يكفي الواجهة
  }
}
