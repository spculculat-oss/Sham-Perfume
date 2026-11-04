/**
 * «تخصصات مساعد شام» — مأخوذة من سجل شاهين نفسه، مش مكتوبة بالنسخ:
 *
 *  - كل أداة ذكاء اصطناعي في الموقع مسجّلة عند شاهين في `src/utils/aiTools.ts`، وكل روبوت في
 *    `src/utils/shaheenOrg.ts` تحت قسم من أقسامه. من السجلين ده بنعرف: إيه شغل «مساعد شام» (الخدمات
 *    والمتجر والطلبات) وإيه شغل شاهين (التركيب والخبرة العطرية ومستشار التسوق والأخبار)، ومين
 *    المسؤول الخلفي عن بيانات المتجر (المستورد ومراجع الصفحات ومدرب الكتالوج).
 *  - دروس العطور التي يكتبها شاهين للمساعد (`src/data/live/sham-training.json` → أداة
 *    `assistant_training`) هي أساس معرفة المساعد بالعطور: يرد بالأساسيات من دروسه، ويحوّل أسئلة
 *    التركيب العميقة لشاهين.
 *
 *  الفائدة: لو اتغيّر سجل الأدوات أو أقسام شاهين، التخصصات والتحويل بينهم بيتغيّروا معاه،
 *  ومراجعة التخصصات (`server/core/specialtyReview.ts`) بتفشل لو أدوارهم اتلخبطت.
 */
import { AI_TOOLS, aiTool, type AiToolId } from '../../src/utils/aiTools';
import { deptOf, botOf } from '../../src/utils/shaheenOrg';
import bundledTraining from '../../src/data/live/sham-training.json';

export type SpecialtyOwner = 'assistant' | 'shaheen';

export interface Specialty {
  id: string;
  owner: SpecialtyOwner;
  name: { ar: string; en: string };
  /** What it actually covers, in one sentence. */
  handles: { ar: string; en: string };
  /** Where the visitor does it (a tab id from src/App.tsx); absent = background work, no page. */
  tab?: string;
  /** The Shaheen registry record that owns it, when it is an AI tool. */
  tool?: AiToolId;
  /** The org-chart robot that produces its data (internal work, never a visitor tool). */
  bot?: string;
  /** A realistic visitor question — the review asks it to the living assistant. */
  sample: { ar: string; en: string };
  /** Words that show the visitor is asking about this specialty. */
  keywords: string[];
  /** Visible to visitors at all (false = internal robot work the assistant must never promise). */
  visitorFacing: boolean;
}

/**
 * The specialties, each tied to its Shaheen record. `tool` / `bot` are the evidence: a test fails if a
 * registry id disappears, so the list can never drift from Shaheen's real organisation.
 */
export const SPECIALTIES: Specialty[] = [
  {
    id: 'store_discovery', owner: 'assistant',
    name: { ar: 'المتجر: البحث عن منتج', en: 'Store: finding a product' },
    handles: {
      ar: 'يبحث في كتالوج المتجر الحقيقي (اسم، ماركة، عائلة عطرية، مناسبة، ميزانية) ويعرض السعر والمقاس والتوفر ثم يفتح صفحة المنتج.',
      en: 'Searches the real store catalog (name, brand, scent family, occasion, budget), shows price, size and availability, then opens the product page.',
    },
    tab: 'store',
    sample: { ar: 'عندكم عطر عود رجالي للشتا؟', en: 'Do you have a men’s oud perfume for winter?' },
    keywords: ['عندكم', 'متجر', 'منتج', 'سعر', 'بكام', 'متوفر', 'store', 'price', 'product', 'available'],
    visitorFacing: true,
  },
  {
    id: 'store_orders', owner: 'assistant',
    name: { ar: 'الطلبات والتتبع', en: 'Orders and tracking' },
    handles: {
      ar: 'يفتح السلة وإتمام الطلب، ويشرح خطوات الشراء، ويتابع حالة الطلب برقم SH مع بيانات التواصل، ويحوّل للموظف عند التأخير.',
      en: 'Opens the cart and checkout, explains the buying steps, tracks an order by its SH reference with the contact used, and hands off to a human when an order is late.',
    },
    tab: 'store',
    sample: { ar: 'فين طلبي؟', en: 'Where is my order?' },
    keywords: ['طلب', 'طلبي', 'تتبع', 'order', 'tracking', 'checkout'],
    visitorFacing: true,
  },
  {
    id: 'store_policies', owner: 'assistant',
    name: { ar: 'الدفع والشحن والإرجاع', en: 'Payment, shipping and returns' },
    handles: {
      ar: 'وسائل الدفع المتاحة حسب البلد، وحساب الشحن ومدة التوصيل التقديرية، وشروط الإرجاع والاسترداد، وقيود شحن العطور.',
      en: 'Payment methods by country, shipping cost and estimated delivery time, return and refund conditions, and perfume shipping restrictions.',
    },
    tab: 'store',
    sample: { ar: 'إيه وسائل الدفع والشحن بكام؟', en: 'What payment methods do you accept and how much is shipping?' },
    keywords: ['دفع', 'شحن', 'توصيل', 'إرجاع', 'استرداد', 'payment', 'shipping', 'delivery', 'returns'],
    visitorFacing: true,
  },
  {
    id: 'bespoke', owner: 'assistant',
    name: { ar: 'العطر المخصص', en: 'Bespoke perfume' },
    handles: {
      ar: 'ياخد العائلة والمناسبة والحجم والميزانية، ويسجّل طلب عرض سعر لتركيبة خاصة، والفريق يرد بعرض قبل التنفيذ.',
      en: 'Takes family, occasion, volume and budget, then records a bespoke quote request; the team replies with a quote before production.',
    },
    tab: 'store',
    sample: { ar: 'عايز عطر مخصص هدية بحدود 500 جنيه', en: 'I want a bespoke perfume as a gift around 500 EGP' },
    keywords: ['مخصص', 'تركيب خاص', 'bespoke', 'custom perfume'],
    visitorFacing: true,
  },
  {
    id: 'wholesale', owner: 'assistant',
    name: { ar: 'الجملة والتصنيع للغير', en: 'Wholesale and private label' },
    handles: {
      ar: 'يجمع بيانات الشركة والكمية والمنتجات ويحوّلها لطلب عرض سعر رسمي للجملة أو التصنيع بعلامة العميل.',
      en: 'Collects company, quantity and products, then turns it into a formal wholesale or private-label quote request.',
    },
    sample: { ar: 'محتاج عرض سعر جملة لمصنع', en: 'I need a wholesale quote for a factory' },
    keywords: ['جملة', 'كميات', 'تصنيع', 'علامة تجارية', 'wholesale', 'bulk', 'private label'],
    visitorFacing: true,
  },
  {
    id: 'support', owner: 'assistant',
    name: { ar: 'الدعم والشكاوى', en: 'Support and complaints' },
    handles: {
      ar: 'يستقبل شكوى أو استرجاعاً أو مشكلة في الموقع، يسجّلها برقم متابعة، ويحوّل الزائر لموظف بشري عند الحاجة.',
      en: 'Takes a complaint, refund or site issue, records it with a reference, and hands the visitor to a human when needed.',
    },
    sample: { ar: 'عايز أقدم شكوى على طلب متأخر', en: 'I want to complain about a late order' },
    keywords: ['شكوى', 'مشكلة', 'استرجاع', 'دعم', 'موظف', 'complaint', 'support', 'problem'],
    visitorFacing: true,
  },
  {
    id: 'platform_tools', owner: 'assistant',
    name: { ar: 'أدوات المنصة والحاسبات', en: 'Platform tools and calculators' },
    handles: {
      ar: 'يدل الزائر على حاسبة التركيز والهرم والتخفيف والتكاليف ومعمل الجزيئات والمكتبات، ويفتح صفحتها مباشرة.',
      en: 'Points the visitor to the concentration, pyramid, dilution and costing calculators, Molecule Studio and the libraries, and opens the page directly.',
    },
    sample: { ar: 'إزاي أستخدم حاسبة التركيز؟', en: 'How do I use the concentration calculator?' },
    keywords: ['حاسبة', 'معمل', 'مكتبة', 'أداة', 'calculator', 'tool', 'library'],
    visitorFacing: true,
  },
  {
    id: 'privacy_data', owner: 'assistant',
    name: { ar: 'الخصوصية وبيانات الزائر', en: 'Privacy and visitor data' },
    handles: {
      ar: 'يوضّح اللي محفوظ عن الزائر، ويمسح المحادثات والذاكرة بطلبه، ويمنع كتابة كلمات المرور وبيانات البطاقات في المحادثة.',
      en: 'Explains what is stored, erases conversations and memory on request, and blocks passwords and card data in chat.',
    },
    sample: { ar: 'إيه اللي بتعرفه عني؟', en: 'What do you know about me?' },
    keywords: ['خصوصية', 'بياناتي', 'حذف بياناتي', 'privacy', 'my data'],
    visitorFacing: true,
  },
  // ── Shaheen's own specialties: the assistant must know them, name them, and hand over ──
  {
    id: 'formulation', owner: 'shaheen', tool: 'shaheen_chat', tab: 'master_ai',
    name: { ar: 'خبرة التركيب العطري', en: 'Perfume formulation' },
    handles: {
      ar: 'تصميم التركيبات والنسب والتعتيق والمثبتات وتحليل النوتات ومقارنة الأكوردات ومراجعة تركيبة الزائر خطوة بخطوة.',
      en: 'Formula design, percentages, maceration, fixatives, note analysis, accord comparison and reviewing the visitor’s formula step by step.',
    },
    sample: { ar: 'إيه أفضل نسبة عود في تركيبة شرقية؟', en: 'What is the best oud percentage in an oriental formula?' },
    keywords: ['تركيبة', 'نسبة', 'أكورد', 'تعتيق', 'مثبت', 'formula', 'accord', 'percentage'],
    visitorFacing: true,
  },
  {
    id: 'store_advice', owner: 'shaheen', tool: 'store_advisor', tab: 'store',
    name: { ar: 'مستشار التسوق «اسأل شاهين»', en: '“Ask Shaheen” shopping advisor' },
    handles: {
      ar: 'داخل المتجر: الزائر يوصف اللي بيدور عليه وذوقه، وشاهين يرشّح له من منتجات المتجر الحقيقية بسبب لكل اختيار.',
      en: 'Inside the store: the visitor describes what they are after, and Shaheen ranks real store products with a reason for each pick.',
    },
    sample: { ar: 'رشحلي عطر حلو للهدية', en: 'Recommend a sweet perfume as a gift' },
    keywords: ['رشحلي', 'اقترح', 'ذوقي', 'recommend', 'suggest'],
    visitorFacing: true,
  },
  {
    id: 'perfume_news', owner: 'shaheen', tool: 'news_bulletin', tab: 'perfume_news',
    name: { ar: 'أخبار وصيحات العطور', en: 'Perfume news and trends' },
    handles: {
      ar: 'يجمع أخبار العطور الحقيقية من مصادر عامة كل 12 ساعة ويكتب نشرة بالتعليق والمصدر، والمساعد ينقلها ولا يخترعها.',
      en: 'Collects real perfume news from public sources every 12 hours with sources and commentary; the assistant reports it, never invents it.',
    },
    sample: { ar: 'إيه آخر أخبار العطور؟', en: 'What is the latest perfume news?' },
    keywords: ['أخبار', 'صيحات', 'ترند', 'news', 'trends'],
    visitorFacing: true,
  },
  {
    id: 'store_data', owner: 'shaheen', tool: 'store_catalog', bot: 'importer',
    name: { ar: 'تدريب كتالوج المتجر (داخلي)', en: 'Store catalog training (internal)' },
    handles: {
      ar: 'شغل داخلي: شاهين يقرأ صفحات الموردين، ينقل المنتجات بصورها، يصحح الأسماء والأوصاف ويضيف العائلة والنوتات الموثقة، ومراجع الصفحات يخفي المعيب. المساعد ما يوعدش الزائر بتعديل منتج.',
      en: 'Internal work: Shaheen reads supplier pages, imports products with their photos, fixes names and descriptions, adds documented families and notes, and the page reviewer hides faulty items. The assistant never promises a catalogue edit to a visitor.',
    },
    sample: { ar: 'مين اللي بيضيف المنتجات للمتجر؟', en: 'Who adds products to the store?' },
    keywords: ['مين بيضيف', 'مصدر المنتجات', 'who adds products', 'supplier'],
    visitorFacing: false,
  },
  {
    id: 'design', owner: 'shaheen', tool: 'design_agent',
    name: { ar: 'استوديو التصميم (للإدارة)', en: 'Design studio (admin)' },
    handles: {
      ar: 'شغل إداري: خطط تصميم متعددة التخصصات للهوية والتغليف والواجهات، تحت مراجعة بشرية ولا تغيّر الموقع تلقائياً.',
      en: 'Admin work: multidisciplinary design plans for identity, packaging and interfaces, human-reviewed, with no automatic site changes.',
    },
    sample: { ar: 'محتاج تصميم علبة عطر', en: 'I need a perfume box design' },
    keywords: ['تصميم', 'لوجو', 'هوية', 'design', 'packaging design'],
    visitorFacing: false,
  },
  {
    id: 'finance_contracts', owner: 'shaheen', tool: 'finance_agent',
    name: { ar: 'المالية والتعاقدات (داخلي)', en: 'Finance and contracts (internal)' },
    handles: {
      ar: 'شغل داخلي: تحصيل موثّق وتقارير مالية وتعاقدات التجار. المساعد ما يشاركش أرقاماً مالية داخلية ولا يغيّر اتفاقاً.',
      en: 'Internal work: recorded collections, financial reports and merchant contracts. The assistant never shares internal figures or changes an agreement.',
    },
    sample: { ar: 'إيه مبيعاتكم الشهر ده؟', en: 'What are your sales this month?' },
    keywords: ['مبيعات', 'أرباح', 'هامش', 'sales', 'profit', 'margin'],
    visitorFacing: false,
  },
];

export const specialty = (id: string) => SPECIALTIES.find((s) => s.id === id);
export const assistantSpecialties = () => SPECIALTIES.filter((s) => s.owner === 'assistant');
export const shaheenSpecialties = () => SPECIALTIES.filter((s) => s.owner === 'shaheen');
/** What visitors can actually reach: the assistant answers it, or Shaheen does on his own page. */
export const visitorSpecialties = () => SPECIALTIES.filter((s) => s.visitorFacing);

export interface Lesson { id: string; title: string; tags: string[] }
interface TrainingFile { docs: { id: string; title: string; tags?: string[] }[] }

/**
 * Shaheen's lessons to the assistant (`assistant_training`): the perfumery basis the assistant may
 * answer from. Read-only; refreshed in the repo every 12 hours.
 */
export function assistantLessons(): Lesson[] {
  const file = bundledTraining as unknown as TrainingFile;
  return (file.docs || [])
    .filter((d) => d && typeof d.id === 'string' && d.id.startsWith('shaheen-curriculum-') && typeof d.title === 'string')
    .map((d) => ({ id: d.id, title: d.title, tags: Array.isArray(d.tags) ? d.tags : [] }));
}

/** One line naming the lesson areas — used in the prompt so the assistant knows what it already learned. */
export function lessonAreas(limit = 10): string[] {
  return assistantLessons().slice(0, limit).map((l) => l.title.split(':')[0].split('—')[0].trim());
}

/** The registry seam: every specialty that names a Shaheen record must still exist in it. */
export function registryProblems(): string[] {
  const problems: string[] = [];
  for (const s of SPECIALTIES) {
    if (s.tool && !aiTool(s.tool)) problems.push(`${s.id}: AI tool “${s.tool}” is not in AI_TOOLS`);
    if (s.bot && !botOf(s.bot)) problems.push(`${s.id}: bot “${s.bot}” is not in Shaheen's org chart`);
  }
  if (!aiTool('sham_assistant')) problems.push('the sham_assistant tool is missing from AI_TOOLS');
  return problems;
}

/** Who is responsible for a department of Shaheen's organisation (for internal hand-off wording). */
export function departmentHead(dept: 'store' | 'content' | 'experience' | 'reliability' | 'leadership'): string {
  return deptOf(dept).headAr;
}

/** Prompt block: the assistant's own remit, Shaheen's remit, and the lessons that ground it. */
export function specialtyBrief(lang: 'ar' | 'en'): string {
  const ar = lang === 'ar';
  const mine = assistantSpecialties().map((s) => `- ${s.name[lang]}: ${s.handles[lang]}`).join('\n');
  const his = visitorSpecialties().filter((s) => s.owner === 'shaheen').map((s) => `- ${s.name[lang]}: ${s.handles[lang]}${s.tab ? ` [${s.tab}]` : ''}`).join('\n');
  const internal = shaheenSpecialties().filter((s) => !s.visitorFacing).map((s) => s.name[lang]).join(' · ');
  const lessons = assistantLessons().length;
  const areas = lessonAreas(8).join(' · ');
  return ar
    ? `تخصصاتك أنت (جاوبها بنفسك من بيانات شام):\n${mine}\nتخصصات الخبير شاهين (اذكرها بالاسم وحوّل الزائر لصفحتها، ولا تدّعيها لنفسك):\n${his}\nأساس معرفتك بالعطور: ${lessons} درساً كتبها لك شاهين (${areas} …). جاوب الأساسيات منها، وأسئلة التركيب العميقة والتصميم حوّلها لشاهين.\nشغل داخلي لشاهين لا تُفصح عن أرقامه ولا توعد الزائر به: ${internal}.`
    : `Your specialties (answer them yourself from Sham's data):\n${mine}\nMaster Shaheen's specialties (name them, send the visitor to their page, never claim them):\n${his}\nYour perfumery basis: ${lessons} lessons Shaheen wrote for you (${areas} …). Answer the basics from them and hand deep formulation or design questions to Shaheen.\nShaheen's internal work — never disclose its figures or promise it: ${internal}.`;
}

/** The short hand-off sentence the assistant uses when a question belongs to Shaheen. */
export function shaheenHandoff(lang: 'ar' | 'en', topic?: 'formulation' | 'advice' | 'news'): string {
  const ar = lang === 'ar';
  if (topic === 'advice') return ar ? 'لاختيار عطر على ذوقك، افتح المتجر واستخدم «اسأل شاهين» — بيرشّح لك من منتجات المتجر الحقيقية بسبب لكل اختيار.' : 'To pick a scent for your taste, open the store and use “Ask Shaheen” — he ranks real store products with a reason for each pick.';
  if (topic === 'news') return ar ? 'آخر أخبار العطور وصيحاتها بيجمعها الخبير شاهين في تبويب «أخبار العطور» مع المصدر.' : 'The latest perfume news is gathered by Master Shaheen in the Perfume news tab, with sources.';
  return ar ? 'أسئلة التركيب والنسب والتعتيق دي تخصص «الخبير شاهين» في تبويب المعمل — افتحه من الزر تحت وهيوصل معاك لنسب دقيقة.' : 'Formula percentages, accords and maceration belong to Master Shaheen in the lab tab — open it below and he will work through the numbers with you.';
}
