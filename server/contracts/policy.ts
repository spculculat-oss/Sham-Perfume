/**
 * «معايير المدير القانوني للتعاقدات» — the binding criteria of the contracts system (decision L-40; the full
 * opinion: docs/legal/رأي-المدير-القانوني-نظام-التعاقدات.md). Every letter the contracts officer drafts is
 * checked here before it can leave; a letter with a problem is never shown as ready to send.
 * Pure functions (shared by the server, the admin panel and tests/contracts.test.ts).
 */

export const POLICY_VERSION = 1;
export const LEGAL_DECISION_ID = 'L-40';

export interface Criterion { id: string; textAr: string }
export const CONTRACT_CRITERIA: Criterion[] = [
  { id: 'C-01', textAr: 'الخطابات بأسلوب بشري طبيعي وباسم شخص حقيقي من الفريق يراجعها ويبعتها بنفسه؛ ممنوع الادعاء الكاذب إن المرسل مش بيستخدم أدوات ذكاء اصطناعي لو اتسأل.' },
  { id: 'C-02', textAr: 'هوية حقيقية: الاسم التجاري والإيميل والتليفون؛ كلمة «شركة» بس لو فيه سجل تجاري.' },
  { id: 'C-03', textAr: 'شرح صادق: وسيط بيع مستقل، لا وكالة حصرية، ولا ادعاء «موزع معتمد» لأي ماركة.' },
  { id: 'C-04', textAr: 'قيمة هامش الربح سرية: ممنوع ذكر النسبة أو الرقم، وممنوع الكذب بخصوصها — «سعر المستهلك بتحدده المنصة».' },
  { id: 'C-05', textAr: 'المنصة تحت التجهيز: رابط المتجر مايتبعتش قبل الموافقة والاعتماد؛ رابط صفحة التوقيع بس.' },
  { id: 'C-06', textAr: 'ترخيص غير حصري وقابل للإلغاء للأسماء والصور والأوصاف والأسعار وتعديلات الصور التقنية؛ المورد يضمن الأصالة وحق الصور.' },
  { id: 'C-07', textAr: 'المورد يسحب أي منتج أو الإذن كله بإيميل، والمنصة تشيله خلال 48 ساعة.' },
  { id: 'C-08', textAr: 'كل خطاب أول فيه طريقة إلغاء المراسلات («لو مش مهتم رد بكلمة لا»)، وتتنفذ.' },
  { id: 'C-09', textAr: 'إيميلات وأسماء المتاجر مشفرة، وسجل التوقيع محفوظ طول الاتفاقية + 5 سنين.' },
  { id: 'C-10', textAr: 'التوقيع لوحده مش كفاية: اعتماد المدير القانوني من لوحة الإدارة، وبعدها بس المستورد يقرا المتجر ده بالذات.' },
];

/** Signature levels: ours today; a certified (e.g. ITIDA-licensed) provider can be added from the services registry. */
export const SIGNATURE_LEVELS = [
  { id: 'email_code', textAr: 'توقيع إلكتروني موثق: رابط خاص للإيميل الرسمي + كود تحقق على نفس الإيميل + بصمة النص' },
  { id: 'email_reply', textAr: 'موافقة برد من الإيميل الرسمي للمتجر (لما خدمة الإيميل مش متاحة)' },
  { id: 'certified', textAr: 'مزود توقيع معتمد (مثل جهة مرخصة من إيتيدا) — يتضاف لاحقاً من سجل الخدمات' },
] as const;
export type Verification = 'email_code' | 'email_reply';

export interface Sender {
  /** A real person of the team who reviews and sends the letters (C-01). */
  name: string;
  title: string;
  /** The trading name of the platform's business (C-02). */
  entityName: string;
  /** Commercial registration — only with it may the letters say «شركة» / "company" (C-02). */
  registrationNo?: string;
  email: string;
  phone?: string;
  /** The platform's public name (shown in the letters; its link only after approval — C-05). */
  platformName: string;
  governingLaw: string;
}
export const EMPTY_SENDER: Sender = { name: '', title: '', entityName: '', registrationNo: '', email: '', phone: '', platformName: '', governingLaw: 'جمهورية مصر العربية' };

const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
/** The fields that must be filled before any letter is drafted. */
export function missingSender(s: Partial<Sender>): (keyof Sender)[] {
  const out: (keyof Sender)[] = [];
  if (!s.name?.trim() || s.name.trim().length < 3) out.push('name');
  if (!s.title?.trim()) out.push('title');
  if (!s.entityName?.trim()) out.push('entityName');
  if (!s.email?.trim() || !EMAIL.test(s.email.trim())) out.push('email');
  if (!s.platformName?.trim()) out.push('platformName');
  if (!s.governingLaw?.trim()) out.push('governingLaw');
  return out;
}

export type Stage = 'outreach' | 'reminder' | 'reply' | 'welcome';
export interface Problem { id: string; textAr: string }

const URLS = /\bhttps?:\/\/[^\s<>"')»]+/gi;
/** The only link allowed before approval: the signing page (server/contracts/router.ts). */
export const SIGN_PATH = '/api/contracts/s/';
const VENDOR = /\b(gemini|gpt|openai|chatgpt|claude|anthropic|deepseek|openrouter|perplexity|manus|llama|mistral|qwen|grok)\b|جيميني|شات ?جي ?بي ?تي|كلود|ديب ?سيك|مانوس/i;
const DENIES_AI = /(?:مش|لست|لستُ|مو|ليس|ماني|مانيش)\s+(?:روبوت|بوت|آلة|ذكاء)|\bnot\s+(?:a\s+)?(?:bot|robot|an?\s+ai|ai)\b|\bi(?:'m| am)\s+(?:a\s+)?(?:real\s+)?(?:human|person)\b(?!.*\bteam\b)|بشري ?100|إنسان حقيقي ومش/i;
const PERCENT = /\d+(?:[.,]\d+)?\s*(?:%|٪|percent|بالمي[ةه]|في المي[ةه])|[×x]\s*1[.,]\d|\b1[.,]\d\s*x\b/i;
const MARGIN_NUMBER = /(?:هامش|ربح|markup|margin)[^\n.]{0,25}?\d/i;
const AUTHORIZED = /وكيل\s+(?:معتمد|رسمي|حصري)|موزع\s+(?:معتمد|رسمي|حصري)|authori[sz]ed\s+(?:dealer|distributor|reseller|retailer)|official\s+(?:dealer|distributor|partner)/i;
const EXCLUSIVE = /(?<!غير\s)(?<!non-)(?<!non\s)(?:حصري|exclusive)/i;
const COMPANY = /(?:^|[\s(«"])(?:شركة|شركه)(?=[\s.,،:)»"]|$)|\b(?:our|a)\s+company\b|\bwe\s+are\s+a\s+company\b|\bsdn\.?\s*bhd\b|\bllc\b|\bltd\b/i;
const OPT_OUT = /مش مهتم|غير مهتم|not interested|no longer wish|unsubscribe/i;

/** Checks a letter against the legal manager's criteria. `ok` = it may be sent. */
export function checkLetter(text: string, stage: Stage, sender: Partial<Sender>, opts: { siteUrl?: string } = {}): { ok: boolean; problems: Problem[] } {
  const problems: Problem[] = [];
  const add = (id: string, textAr: string) => { if (!problems.some((p) => p.id === id && p.textAr === textAr)) problems.push({ id, textAr }); };
  const body = String(text || '');
  for (const url of body.match(URLS) || []) {
    const signing = url.includes(SIGN_PATH);
    const site = opts.siteUrl && url.replace(/\/+$/, '').startsWith(opts.siteUrl.replace(/\/+$/, ''));
    if (stage === 'welcome' ? !(signing || site) : !signing) add('C-05', `رابط مش مسموح قبل الموافقة: ${url.slice(0, 80)}`);
  }
  if (stage !== 'welcome' && /github\.io|vercel\.app|sham-perfume/i.test(body.replace(URLS, ''))) add('C-05', 'اسم موقع المتجر مكتوب في الخطاب قبل الموافقة');
  if (PERCENT.test(body) || MARGIN_NUMBER.test(body)) add('C-04', 'فيه نسبة أو رقم لهامش الربح — قيمة الهامش سرية');
  if (VENDOR.test(body)) add('C-01', 'فيه اسم شركة ذكاء اصطناعي');
  if (DENIES_AI.test(body)) add('C-01', 'فيه ادعاء إن المرسل مش بيستخدم أدوات ذكاء اصطناعي / إنه «إنسان مش بوت» — الرد لازم يكون صادق');
  if (AUTHORIZED.test(body)) add('C-03', 'فيه ادعاء «وكيل/موزع معتمد» — ممنوع');
  if (EXCLUSIVE.test(body)) add('C-03', 'فيه وعد أو طلب «حصرية» — الاتفاقية غير حصرية');
  if (!sender.registrationNo?.trim() && COMPANY.test(body)) add('C-02', 'كلمة «شركة» من غير سجل تجاري — اكتب «منصة» أو «نشاط تجاري» أو أضف رقم السجل في الإعدادات');
  if (sender.name && !body.includes(sender.name.trim())) add('C-01', 'اسم المرسل الحقيقي مش موجود في الخطاب');
  if (sender.email && !body.toLowerCase().includes(sender.email.trim().toLowerCase())) add('C-02', 'إيميل التواصل مش موجود في الخطاب');
  if (stage === 'outreach' && !OPT_OUT.test(body)) add('C-08', 'مفيش طريقة لإلغاء المراسلات («لو مش مهتم رد بكلمة لا»)');
  for (const field of missingSender(sender)) add('C-02', `بيانات المرسل ناقصة: ${field}`);
  return { ok: problems.length === 0, problems };
}

/** A store domain, normalised (no scheme, no www, no path). */
export function normalizeDomain(input: string): string {
  const d = String(input || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[/?#].*$/, '');
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d) ? d : '';
}
