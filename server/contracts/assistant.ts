/**
 * «مسؤول التعاقدات» — drafts the answer to a store owner's message, for the sender to review and send from his
 * own e-mail (criterion C-01: a real person of the team sends it). The draft follows the legal manager's
 * criteria (server/contracts/policy.ts): the margin's value stays private but nothing untrue is said about it,
 * no store link before approval, no AI company names — and if the store asks whether a person is writing,
 * the answer is honest. Any engine draft that fails checkLetter() is replaced by the approved template.
 */
import { callEngine, engineStatuses } from '../core/engines';
import { supervisorGuidance } from '../core/liveData';
import type { ModelEngineId } from '../core/types';
import { guidanceBlock } from '../../src/utils/aiTools';
import { CONTRACT_CRITERIA, checkLetter, type Sender } from './policy';
import type { Lang } from './documents';
import { withHandbook } from '../../src/utils/botHandbook';

type Env = Record<string, string | undefined>;
export type Topic = 'margin' | 'link' | 'identity' | 'ai' | 'payment' | 'withdraw' | 'exclusive' | 'images' | 'general';

const TOPICS: [Topic, RegExp][] = [
  ['ai', /\b(bot|robot|ai|automated|chatgpt|human|real person)\b|روبوت|بوت|ذكاء|آلي|اوتوماتيك|إنسان|بشري/i],
  ['margin', /margin|markup|profit|commission|how much (do )?you (add|charge|sell)|your price|retail price|هامش|ربح|عمولة|نسبة|بكم (تبيع|هتبيع|ستبيع)|سعر البيع/i],
  ['link', /link|website|site|url|see (your|the) store|رابط|لينك|موقع|متجركم|أشوف/i],
  ['identity', /who are you|company|registration|registered|legit|scam|من أنتم|مين انتو|شركة|سجل|ترخيص|نصب|حقيقية/i],
  ['payment', /pay|payment|ship|shipping|deliver|order|دفع|تدفع|شحن|توصيل|طلب/i],
  ['withdraw', /withdraw|cancel|stop|remove|terminate|سحب|إلغاء|الغاء|إيقاف|حذف|إنهاء/i],
  ['exclusive', /exclusive|only you|حصري|حصرية/i],
  ['images', /photo|image|picture|watermark|صور|الصورة|علامة مائية|لوجو/i],
];
export const topicsOf = (message: string): Topic[] => {
  const found = TOPICS.filter(([, re]) => re.test(message)).map(([t]) => t);
  return found.length ? found : ['general'];
};
export const langOf = (message: string, fallback: Lang = 'ar'): Lang => (/[\u0600-\u06FF]/.test(message) ? 'ar' : /[a-z]{3,}/i.test(message) ? 'en' : fallback);

const LINES: Record<Topic, (s: Sender) => { ar: string; en: string }> = {
  margin: () => ({
    ar: 'بخصوص الأسعار: سعر البيع للمستهلك تحدده منصتنا ويشمل تكاليف التشغيل وهامشنا، ولا نفصح عن تفاصيل التسعير الداخلية، لكن الأهم لكم أن سعركم يصلكم كاملاً عن كل طلب ولا نخصم منه شيئاً.',
    en: 'On pricing: our platform sets the consumer price, which covers our running costs and our margin. We keep our internal pricing private, but what matters for you is that you always receive your full price for every order — nothing is deducted from it.',
  }),
  link: (s) => ({
    ar: `${s.platformName} في مرحلة التجهيز النهائي حالياً، وسأرسل لكم رابط المتجر بنفسي فور موافقتكم وانتهاء المراجعة.`,
    en: `${s.platformName} is in its final setup stage right now; I will send you the store link myself as soon as you agree and our review is complete.`,
  }),
  identity: (s) => ({
    ar: `نحن ${s.registrationNo?.trim() ? `شركة ${s.entityName} (سجل تجاري ${s.registrationNo.trim()})` : `منصة ${s.entityName}`}، وأنا ${s.name} (${s.title}) ويمكنكم التواصل معي مباشرة على ${s.email}${s.phone?.trim() ? ` أو ${s.phone.trim()}` : ''}. والاتفاقية نفسها تحدد بياناتنا والتزاماتنا كتابياً.`,
    en: `We are ${s.registrationNo?.trim() ? `${s.entityName} (registration no. ${s.registrationNo.trim()})` : s.entityName}, and I am ${s.name} (${s.title}); you can reach me directly at ${s.email}${s.phone?.trim() ? ` or ${s.phone.trim()}` : ''}. The agreement itself sets out our details and obligations in writing.`,
  }),
  ai: (s) => ({
    ar: `سؤال في محله: نستخدم أدوات ذكاء اصطناعي في تجهيز المراسلات وتنظيمها، وأنا ${s.name} أراجع كل رسالة بنفسي وأتابع معكم شخصياً.`,
    en: `Fair question: we use AI tools to prepare and organise our correspondence, and I, ${s.name}, review every message myself and follow up with you personally.`,
  }),
  payment: () => ({
    ar: 'عن الطلبات والدفع: نرسل لكم كل طلب كتابياً، تؤكدون التوفر، وندفع القيمة كاملة بسعركم قبل الشحن، ويتم الشحن حسب ما نتفق عليه في كل طلب.',
    en: 'On orders and payment: we send you each order in writing, you confirm availability, and we pay the full amount at your price before it ships; shipping is as we agree for each order.',
  }),
  withdraw: () => ({
    ar: 'ويمكنكم سحب أي منتج أو الموافقة كلها في أي وقت برسالة إيميل، ونزيل المحتوى خلال 48 ساعة.',
    en: 'You can withdraw any product, or your permission entirely, at any time by email, and we remove the content within 48 hours.',
  }),
  exclusive: () => ({
    ar: 'والاتفاقية غير حصرية: أنتم أحرار في البيع في أي مكان آخر، ونحن كذلك.',
    en: 'The agreement is non-exclusive: you are free to sell anywhere else, and so are we.',
  }),
  images: () => ({
    ar: 'بالنسبة للصور: نستخدم صور منتجاتكم وأوصافها كما هي، مع تعديلات تقنية بسيطة (المقاس والخلفية وإزالة بيانات التواصل) دون تغيير المنتج نفسه، وكل ذلك منصوص عليه في الاتفاقية.',
    en: 'About photos: we use your product photos and descriptions as they are, with simple technical edits (size, background, removing contact details) without changing the product itself — all set out in the agreement.',
  }),
  general: () => ({
    ar: 'باختصار: نعرض منتجاتكم على متجرنا، ونطلبها منكم بسعركم لكل طلب وندفع قبل الشحن، والاتفاقية غير حصرية ويمكنكم سحب الموافقة في أي وقت.',
    en: 'In short: we list your products on our marketplace, order them from you at your price for each order and pay before shipping; the agreement is non-exclusive and you can withdraw at any time.',
  }),
};

/** The approved answer, built from the legal manager's wording only. */
export function templateReply(message: string, s: Sender, contactName = '', lang?: Lang): string {
  const l = lang || langOf(message);
  const lines = topicsOf(message).slice(0, 3).map((t) => LINES[t](s)[l]);
  const hello = l === 'ar' ? `أهلاً ${contactName || 'بكم'}،\n\nشكراً على ردكم.` : `Hello ${contactName || 'there'},\n\nThank you for your reply.`;
  const close = l === 'ar' ? 'لأي سؤال آخر أنا موجود.' : 'Happy to answer anything else.';
  const sign = [l === 'ar' ? 'مع خالص التحية،' : 'Kind regards,', s.name, `${s.title} — ${s.platformName}`, s.email, ...(s.phone?.trim() ? [s.phone.trim()] : [])].join('\n');
  return [hello, '', ...lines, '', close, '', sign].join('\n');
}

export const REPLY_SYSTEM = (s: Sender, lang: Lang) => `You draft an email reply for ${s.name} (${s.title} at ${s.entityName}, platform «${s.platformName}»), a real person who will review it and send it from his own email (${s.email}).
Write in the first person as ${s.name}, natural and warm, ${lang === 'ar' ? 'in clear Modern Standard Arabic' : 'in plain English'}, at most 150 words, then sign with his name, title, platform and email.
Facts you may use (nothing else): we are an independent sales intermediary for perfumes; we list the store's products, order each one from the store at its price and pay in full before shipping, then sell to the customer at our own price which includes our margin and costs; the agreement is non-exclusive, the store may withdraw any product or all permission by email and we remove it within 48 hours; photos may get technical edits (size, background, removing contact details) without changing the product; the platform is in its final setup stage and the store link is sent only after the store agrees and our review is complete.
Binding rules from the legal manager:
${CONTRACT_CRITERIA.map((c) => `- ${c.id}: ${c.textAr}`).join('\n')}
In practice: never state the margin's value, a percentage or a multiplier — say the consumer price is set by the platform and the store always receives its full price; never include any link; never name any AI company; never claim to be an authorised dealer or offer exclusivity;${s.registrationNo?.trim() ? '' : ' never call us a "company" (we are a platform / business);'} if asked whether a person or a bot is writing, answer honestly: we use AI tools to prepare the correspondence and ${s.name} reviews every message personally. Return only the email body.`;

export interface Draft { text: string; source: 'ai' | 'template'; engine?: string; check: ReturnType<typeof checkLetter>; topics: Topic[] }

export async function draftReply(input: { message: string; sender: Sender; contactName?: string; lang?: Lang }, options: { env?: Env; fetch?: typeof fetch; signal?: AbortSignal } = {}): Promise<Draft> {
  const env = options.env || process.env;
  const message = String(input.message || '').slice(0, 4000);
  const lang = input.lang || langOf(message);
  const topics = topicsOf(message);
  const template = templateReply(message, input.sender, input.contactName, lang);
  const engines = engineStatuses(env).filter((e) => e.configured && e.id !== 'sham_local').map((e) => e.id as ModelEngineId);
  if (engines.length) {
    const guidance = await supervisorGuidance('contracts_agent', env, options.fetch || fetch).catch(() => '');
    for (const id of engines) {
      try {
        const text = (await callEngine(id, withHandbook('contracts', REPLY_SYSTEM(input.sender, lang) + guidanceBlock(guidance)), [{ role: 'user', text: `The store's message:\n${message}` }], {
          env, fetch: options.fetch, temperature: 0.4, maxTokens: 700,
          signal: AbortSignal.any([AbortSignal.timeout(15000), ...(options.signal ? [options.signal] : [])]),
        }))?.trim();
        if (!text) continue;
        const check = checkLetter(text, 'reply', input.sender);
        if (check.ok) return { text, source: 'ai', engine: id, check, topics };
      } catch { /* the next engine, then the template */ }
    }
  }
  return { text: template, source: 'template', check: checkLetter(template, 'reply', input.sender), topics };
}
