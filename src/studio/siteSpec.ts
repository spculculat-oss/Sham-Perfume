/**
 * «استوديو شاهين — بنّاء المواقع»: a website as data (pages → sections), so Shaheen can build it, change one part on
 * request, and turn it into real pages. The AI platforms write this data when they are open (server task «site»);
 * when they are not (the static copy of the site, or the platforms busy) the builder writes it itself from the
 * visitor's words with the templates below — so building never depends on an outside service.
 * Every value is cleaned here: text is capped and later escaped, links are https/mailto/tel only, images https or
 * data:image only.
 */
import type { Harmony } from './palette';
import { sanitizeSvg } from './logo';

export interface ImageRef { prompt?: string; src?: string; alt?: string }
export interface Item { icon?: string; title?: string; text?: string; price?: string; image?: ImageRef; q?: string; a?: string }
export type SectionType = 'hero' | 'features' | 'about' | 'gallery' | 'products' | 'steps' | 'faq' | 'cta' | 'contact' | 'text';
export const SECTION_TYPES: SectionType[] = ['hero', 'features', 'about', 'gallery', 'products', 'steps', 'faq', 'cta', 'contact', 'text'];
export interface Section {
  id: string; type: SectionType; title?: string; text?: string; button?: string; link?: string; image?: ImageRef; items?: Item[];
  email?: string; phone?: string; whatsapp?: string; address?: string;
}
export interface Page { slug: string; title: string; sections: Section[] }
export interface Theme { base: string; harmony: Harmony; dark: boolean; font?: string; radius: 'sharp' | 'soft' | 'round' }
export interface SiteSpec { name: string; tagline: string; lang: string; dir: 'rtl' | 'ltr'; theme: Theme; pages: Page[]; logo?: string }

const RTL = new Set(['ar', 'fa', 'he', 'ur', 'ps', 'sd']);
const HARMONY_SET = new Set(['complementary', 'analogous', 'triadic', 'split', 'mono']);
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, max) : '');
let counter = 0;
export const newId = () => `s${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Only images we can show safely: https, or a picture made on this page (data:image). */
export function safeImageSrc(v: unknown): string {
  const s = typeof v === 'string' ? v.trim() : '';
  if (/^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(s) && s.length < 6_000_000) return s;
  if (/^blob:https?:\/\//.test(s)) return s;
  try { const u = new URL(s); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; }
}
/** Links a visitor's site may have: its own pages, https, mailto, tel, WhatsApp. */
export function safeLink(v: unknown): string {
  const s = str(v, 400);
  if (!s) return '';
  if (/^#[\w-]{0,60}$/.test(s) || /^[a-z0-9-]{1,40}\.html$/.test(s)) return s;
  if (/^(mailto:[^\s<>"']+|tel:\+?[\d\s()-]{4,20})$/i.test(s)) return s;
  try { const u = new URL(s); return u.protocol === 'https:' && !u.username ? u.href : ''; } catch { return ''; }
}
const email = (v: unknown) => { const s = str(v, 120); return /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(s) ? s : ''; };
const phone = (v: unknown) => { const s = str(v, 30); return /^\+?[\d\s()-]{5,25}$/.test(s) ? s : ''; };
const slugOf = (v: unknown, fallback: string) => {
  const s = str(v, 40).toLowerCase().replace(/\.html$/, '').replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  return s || fallback;
};
function imageRef(v: unknown): ImageRef | undefined {
  if (!v) return undefined;
  if (typeof v === 'string') return safeImageSrc(v) ? { src: safeImageSrc(v) } : { prompt: str(v, 400) };
  if (typeof v !== 'object') return undefined;
  const r = v as Record<string, unknown>;
  const out: ImageRef = {};
  const src = safeImageSrc(r.src || r.url);
  if (src) out.src = src;
  const prompt = str(r.prompt, 400);
  if (prompt) out.prompt = prompt;
  const alt = str(r.alt, 160);
  if (alt) out.alt = alt;
  return out.src || out.prompt ? out : undefined;
}
function item(v: unknown): Item | undefined {
  if (!v || typeof v !== 'object') return typeof v === 'string' && v.trim() ? { title: str(v, 120) } : undefined;
  const r = v as Record<string, unknown>;
  const out: Item = {};
  const put = (k: keyof Item, max: number, from: unknown = r[k]) => { const s = str(from, max); if (s) (out as Record<string, string>)[k] = s; };
  put('icon', 8); put('title', 140, r.title ?? r.name); put('text', 600, r.text ?? r.description); put('price', 40); put('q', 240, r.q ?? r.question); put('a', 900, r.a ?? r.answer);
  const image = imageRef(r.image);
  if (image) out.image = image;
  return Object.keys(out).length ? out : undefined;
}
export function cleanSection(v: unknown): Section | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const r = v as Record<string, unknown>;
  const type = SECTION_TYPES.includes(r.type as SectionType) ? r.type as SectionType : undefined;
  if (!type) return undefined;
  const out: Section = { id: str(r.id, 40).replace(/[^\w-]/g, '') || newId(), type };
  const put = (k: 'title' | 'text' | 'button' | 'address', max: number) => { const s = str(r[k], max); if (s) out[k] = s; };
  put('title', 160); put('text', 2400); put('button', 60); put('address', 240);
  const link = safeLink(r.link); if (link) out.link = link;
  const image = imageRef(r.image); if (image) out.image = image;
  const items = Array.isArray(r.items) ? r.items.slice(0, 12).map(item).filter((x): x is Item => Boolean(x)) : [];
  if (items.length) out.items = items;
  const e = email(r.email); if (e) out.email = e;
  const p = phone(r.phone); if (p) out.phone = p;
  const wa = phone(r.whatsapp); if (wa) out.whatsapp = wa;
  return out;
}
/** Any JSON (from an AI platform, a saved draft or a file) → a safe site, or undefined when it is not one. */
export function cleanSiteSpec(v: unknown, fallbackLang = 'ar'): SiteSpec | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const r = v as Record<string, unknown>;
  const lang = /^[a-z]{2}$/.test(String(r.lang || '')) ? String(r.lang) : fallbackLang;
  const t = (r.theme && typeof r.theme === 'object' ? r.theme : {}) as Record<string, unknown>;
  const base = /^#[0-9a-f]{6}$/i.test(String(t.base || t.primary || '')) ? String(t.base || t.primary).toLowerCase() : '#8a5a2b';
  const theme: Theme = {
    base, harmony: HARMONY_SET.has(String(t.harmony)) ? t.harmony as Harmony : 'complementary', dark: t.dark === true,
    radius: t.radius === 'sharp' || t.radius === 'round' ? t.radius : 'soft', ...(str(t.font, 30) ? { font: str(t.font, 30) } : {}),
  };
  const used = new Set<string>();
  const pages = (Array.isArray(r.pages) ? r.pages : []).slice(0, 8).flatMap((p, i) => {
    if (!p || typeof p !== 'object') return [];
    const pr = p as Record<string, unknown>;
    let slug = i === 0 ? 'index' : slugOf(pr.slug, `page-${i + 1}`);
    while (used.has(slug)) slug = `${slug}-${i + 1}`;
    used.add(slug);
    const sections = (Array.isArray(pr.sections) ? pr.sections : []).slice(0, 14).map(cleanSection).filter((s): s is Section => Boolean(s));
    return sections.length ? [{ slug, title: str(pr.title, 60) || slug, sections }] : [];
  });
  if (!pages.length) return undefined;
  if (pages[0]!.slug !== 'index') pages[0]!.slug = 'index';
  const name = str(r.name, 80) || 'My site';
  const logo = typeof r.logo === 'string' ? sanitizeSvg(r.logo) || undefined : undefined;
  return { name, tagline: str(r.tagline, 200), lang, dir: RTL.has(lang) ? 'rtl' : 'ltr', theme, pages, ...(logo ? { logo } : {}) };
}
/** The first JSON object in an AI reply (it may come inside a ```json fence or with words around it). */
export function jsonFrom(reply: string): unknown {
  const fenced = reply.match(/```(?:json|sham-site|sham-video)?\s*\n([\s\S]*?)```/);
  const body = fenced ? fenced[1]! : reply;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) return undefined;
  try { return JSON.parse(body.slice(start, end + 1)); } catch { return undefined; }
}

// ── The builder's own templates (no AI needed) ──────────────────────────────────────────────────────────────
export type SiteKind = 'perfume' | 'store' | 'restaurant' | 'portfolio' | 'company' | 'clinic' | 'education' | 'event';
export const SITE_KINDS: SiteKind[] = ['perfume', 'store', 'restaurant', 'portfolio', 'company', 'clinic', 'education', 'event'];
const KIND_WORDS: Record<SiteKind, RegExp> = {
  perfume: /عطر|عطور|برفان|بارفان|مسك|عود|بخور|perfume|fragrance|parfum|scent|oud/i,
  restaurant: /مطعم|كافيه|كافية|قهوة|مقهى|اكل|أكل|وجبات|حلويات|مخبز|بيتزا|restaurant|cafe|café|coffee|food|bakery|pizza|kitchen/i,
  clinic: /عيادة|عياده|دكتور|طبيب|اسنان|أسنان|علاج|صحة|مستشفى|صيدلية|clinic|doctor|dental|health|medical|pharmacy|therapy/i,
  education: /كورس|دورة|دورات|تعليم|مدرسة|اكاديمية|أكاديمية|مدرس|دروس|تدريب|course|school|academy|tutor|learning|training|class/i,
  event: /فرح|زفاف|حفلة|حفل|مؤتمر|مناسبة|عيد ميلاد|خطوبة|wedding|event|party|conference|birthday|festival/i,
  portfolio: /بورتفوليو|اعمالي|أعمالي|سيرة ذاتية|مصمم|مصور|فنان|شخصي|portfolio|resume|cv|designer|photographer|artist|personal/i,
  store: /متجر|محل|بيع|منتجات|ملابس|اكسسوارات|إكسسوارات|موبايلات|shop|store|products|clothing|fashion|boutique|ecommerce|e-commerce/i,
  company: /شركة|شركه|خدمات|وكالة|مكتب|برمجة|تسويق|استشارات|company|agency|services|studio|startup|consulting|software|marketing/i,
};
export function detectKind(brief: string): SiteKind {
  for (const kind of ['perfume', 'restaurant', 'clinic', 'education', 'event', 'portfolio', 'store', 'company'] as SiteKind[]) if (KIND_WORDS[kind].test(brief)) return kind;
  return 'company';
}
/** «اسمه نور» / «باسم نور» / «named Nour» / «"Nour"» → «Nour». */
export function nameFrom(brief: string): string {
  const m = brief.match(/[«"“']([^«»"“”']{2,40})[»"”']/) || brief.match(/(?:اسمه|اسمها|اسم الموقع|باسم|بإسم|بعنوان|named|called|name is|brand)\s*[:：]?\s*([^\s،,.!?؟]+(?:\s+[^\s،,.!?؟]+)?)/i);
  return m ? m[1]!.trim() : '';
}

type Copy = { name: string; tagline: string; hero: string; cta: string; color: string; heroPrompt: string; features: [string, string, string][]; offerTitle: string; offers: [string, string, string][]; about: string; steps: [string, string][]; faq: [string, string][] };
const AR: Record<SiteKind, Copy> = {
  perfume: { name: 'دار العطر', tagline: 'عطور تحكي عنك', hero: 'تشكيلة عطور مختارة بعناية، بثبات يدوم وروائح تليق بكل مناسبة.', cta: 'اكتشف العطور', color: '#8a5a2b', heroPrompt: 'luxury perfume bottles on dark marble with warm golden light, elegant product photography',
    features: [['🌿', 'مكونات أصلية', 'زيوت عطرية مختارة من أفضل المصادر.'], ['⏳', 'ثبات طويل', 'تركيزات مدروسة تفضل معاك طول اليوم.'], ['🎁', 'تغليف هدايا', 'تغليف أنيق جاهز للإهداء.']],
    offerTitle: 'عطورنا', offers: [['عود ملكي', 'دافئ وعميق للمساء.', 'oud perfume bottle with smoky wood background'], ['ورد الطائف', 'زهري ناعم ومنعش.', 'rose perfume bottle with fresh pink roses'], ['مسك أبيض', 'نظيف وهادي لكل يوم.', 'white musk perfume bottle soft white background']],
    about: 'بدأنا بشغف بالعطور وحب للتفاصيل، وهدفنا نقدّم لك عطر يعبّر عن شخصيتك بجودة تستحقها.', steps: [['اختار العطر', 'تصفّح التشكيلة واختار اللي يناسبك.'], ['اطلب بسهولة', 'أكّد طلبك في دقيقة.'], ['استلم', 'نوصّلك لحد باب البيت.']],
    faq: [['العطور أصلية؟', 'أيوه، كل منتجاتنا من مصادر موثوقة.'], ['التوصيل بياخد قد إيه؟', 'بيختلف حسب مدينتك، وبنبلغك بالموعد عند تأكيد الطلب.']] },
  store: { name: 'متجري', tagline: 'كل اللي تحتاجه في مكان واحد', hero: 'منتجات مختارة بجودة عالية وأسعار مناسبة، وتجربة شراء سهلة.', cta: 'تسوّق الآن', color: '#0e7490', heroPrompt: 'modern bright retail store shelves with stylish products, clean lifestyle photography',
    features: [['🚚', 'توصيل سريع', 'نوصّل طلبك في أسرع وقت.'], ['🔒', 'دفع آمن', 'طرق دفع موثوقة وآمنة.'], ['↩️', 'استرجاع سهل', 'سياسة استرجاع واضحة.']],
    offerTitle: 'منتجات مميزة', offers: [['منتج مميز ١', 'وصف قصير للمنتج.', 'stylish product on clean studio background'], ['منتج مميز ٢', 'وصف قصير للمنتج.', 'trendy accessory product photography'], ['منتج مميز ٣', 'وصف قصير للمنتج.', 'elegant gift box product photo']],
    about: 'إحنا متجر بيهتم بجودة كل منتج وبراحة العميل من أول طلب لحد ما يوصله.', steps: [['اختار', 'تصفّح واختار منتجاتك.'], ['اطلب', 'أكّد طلبك بخطوات بسيطة.'], ['استلم', 'يوصلك لحد عندك.']],
    faq: [['إزاي أطلب؟', 'اختار المنتج واضغط اطلب وكمّل البيانات.'], ['ينفع أرجّع المنتج؟', 'أيوه حسب سياسة الاسترجاع الموضحة.']] },
  restaurant: { name: 'مطعمنا', tagline: 'طعم يفضل في البال', hero: 'أكل طازة بمكونات مختارة، وأجواء دافية تستاهل تجربها مع حبايبك.', cta: 'شوف المنيو', color: '#c2410c', heroPrompt: 'cozy warm restaurant interior with delicious plated dishes, food photography',
    features: [['🥗', 'مكونات طازة', 'بنختار مكوناتنا كل يوم.'], ['👨‍🍳', 'طهاة محترفين', 'وصفات بلمسة خاصة.'], ['🛵', 'توصيل', 'وجبتك توصلك سخنة.']],
    offerTitle: 'من المنيو', offers: [['طبق الشيف', 'اختيار الشيف المميز.', 'gourmet signature dish on plate'], ['مشويات', 'مشويات على الفحم.', 'grilled meat platter food photography'], ['حلويات', 'حلو البيت.', 'beautiful dessert plate']],
    about: 'من مطبخنا لسفرتك: بنطبخ بحب وبنهتم إن كل طبق يطلع على أحسن صورة.', steps: [['اختار وجبتك', 'من المنيو.'], ['اطلب', 'أونلاين أو بالتليفون.'], ['استمتع', 'في المطعم أو في البيت.']],
    faq: [['فيه حجز؟', 'أيوه، تقدر تحجز من صفحة التواصل.'], ['فيه أكل نباتي؟', 'فيه اختيارات نباتية في المنيو.']] },
  portfolio: { name: 'أعمالي', tagline: 'أفكار تتحوّل لتصميمات', hero: 'أهلاً! ده معرض لأهم أعمالي ومشاريعي، وأقدر أساعدك في مشروعك الجاي.', cta: 'شوف أعمالي', color: '#4338ca', heroPrompt: 'creative designer workspace with laptop and sketches, soft natural light',
    features: [['🎨', 'تصميم', 'هويات بصرية وواجهات.'], ['📷', 'تصوير', 'صور بتحكي قصة.'], ['💡', 'أفكار', 'حلول مبتكرة لمشروعك.']],
    offerTitle: 'مشاريع مختارة', offers: [['مشروع ١', 'وصف قصير للمشروع.', 'minimal brand identity mockup'], ['مشروع ٢', 'وصف قصير للمشروع.', 'mobile app interface mockup'], ['مشروع ٣', 'وصف قصير للمشروع.', 'editorial photography portfolio']],
    about: 'أنا بحب أحوّل الأفكار لحاجة الناس تشوفها وتحسّها. بشتغل بتركيز على التفاصيل وبتواصل واضح.', steps: [['نتكلم', 'نفهم فكرتك وأهدافك.'], ['نصمّم', 'مسودات ومراجعات.'], ['نسلّم', 'ملفات نهائية جاهزة.']],
    faq: [['المشروع بياخد قد إيه؟', 'حسب حجمه، وبنتفق على جدول واضح من الأول.'], ['بتشتغل أونلاين؟', 'أيوه مع عملاء من أي مكان.']] },
  company: { name: 'شركتنا', tagline: 'حلول تكبّر شغلك', hero: 'بنساعد الشركات والأفراد يوصلوا لأهدافهم بحلول عملية وفريق محترف.', cta: 'اطلب استشارة', color: '#1e40af', heroPrompt: 'modern office team collaborating, bright professional corporate photography',
    features: [['🚀', 'سرعة في التنفيذ', 'خطط واضحة ومواعيد محترمة.'], ['🤝', 'شراكة حقيقية', 'بنشتغل معاك كأننا جزء من فريقك.'], ['📈', 'نتائج', 'بنقيس اللي بنعمله.']],
    offerTitle: 'خدماتنا', offers: [['خدمة ١', 'وصف قصير للخدمة.', 'business strategy meeting'], ['خدمة ٢', 'وصف قصير للخدمة.', 'digital marketing analytics dashboard'], ['خدمة ٣', 'وصف قصير للخدمة.', 'software development team at work']],
    about: 'فريق بخبرة متنوعة، هدفنا نقدّم شغل بجودة عالية ونبني علاقة طويلة مع كل عميل.', steps: [['تواصل', 'احكيلنا عن احتياجك.'], ['خطة', 'نقترح حل وخطة واضحة.'], ['تنفيذ', 'ننفّذ ونتابع معاك.']],
    faq: [['بتشتغلوا مع شركات صغيرة؟', 'أيوه، مع كل الأحجام.'], ['إزاي أبدأ؟', 'ابعتلنا من صفحة التواصل.']] },
  clinic: { name: 'عيادتنا', tagline: 'صحتك أولاً', hero: 'رعاية طبية باهتمام حقيقي، في مكان مريح ومجهّز.', cta: 'احجز موعد', color: '#0f766e', heroPrompt: 'clean modern medical clinic reception, calm bright healthcare photography',
    features: [['🩺', 'أطباء متخصصين', 'خبرة ورعاية.'], ['🕒', 'مواعيد مرنة', 'احجز في الوقت المناسب لك.'], ['🧼', 'تعقيم كامل', 'معايير نظافة عالية.']],
    offerTitle: 'خدماتنا', offers: [['كشف واستشارة', 'تقييم شامل لحالتك.', 'doctor consultation friendly'], ['متابعة', 'خطة متابعة واضحة.', 'healthcare follow up'], ['فحوصات', 'فحوصات أساسية.', 'medical checkup equipment']],
    about: 'بنؤمن إن كل مريض يستاهل وقت واهتمام وشرح واضح لحالته.', steps: [['احجز', 'اختار الموعد.'], ['زورنا', 'كشف واستشارة.'], ['تابع', 'خطة علاج ومتابعة.']],
    faq: [['إزاي أحجز؟', 'من صفحة التواصل أو بالتليفون.'], ['المعلومات دي بديل عن الكشف؟', 'لأ، المحتوى للتعريف فقط واستشر الطبيب دايماً.']] },
  education: { name: 'أكاديميتنا', tagline: 'اتعلّم بطريقة أسهل', hero: 'كورسات عملية بشرح بسيط، تتعلّم منها بالخطوة وتطبّق على طول.', cta: 'شوف الكورسات', color: '#7e22ce', heroPrompt: 'students learning together in bright modern classroom with laptops',
    features: [['🎓', 'مدربين خبرة', 'شرح عملي وواضح.'], ['🧩', 'تطبيق عملي', 'مشاريع وتمارين.'], ['📜', 'شهادة', 'شهادة إتمام للكورس.']],
    offerTitle: 'الكورسات', offers: [['كورس للمبتدئين', 'من الصفر خطوة بخطوة.', 'beginner online course laptop'], ['كورس متقدم', 'مهارات أعمق.', 'advanced workshop training'], ['ورشة عملية', 'تطبيق مباشر.', 'hands on workshop students']],
    about: 'بنصمّم كل كورس علشان تفهم مش بس تحفظ، وتطلع بمهارة تقدر تستخدمها.', steps: [['اختار الكورس', 'المناسب لمستواك.'], ['سجّل', 'في دقيقة.'], ['اتعلّم', 'وطبّق.']],
    faq: [['الكورسات أونلاين؟', 'فيه أونلاين وحضوري حسب الكورس.'], ['محتاج خبرة قبل كده؟', 'فيه كورسات للمبتدئين تماماً.']] },
  event: { name: 'مناسبتنا', tagline: 'يوم مايتنسيش', hero: 'يشرّفنا حضورك وتشاركنا فرحتنا. كل التفاصيل هنا.', cta: 'أكّد حضورك', color: '#be185d', heroPrompt: 'elegant event venue decorated with flowers and warm lights, celebration',
    features: [['📅', 'الميعاد', 'اكتب التاريخ والساعة هنا.'], ['📍', 'المكان', 'اكتب العنوان هنا.'], ['👗', 'الدريس كود', 'اكتب التفاصيل هنا.']],
    offerTitle: 'البرنامج', offers: [['الاستقبال', 'وصول الضيوف.', 'elegant reception welcome flowers'], ['الحفل', 'الفقرة الرئيسية.', 'celebration stage lights'], ['العشاء', 'على شرفكم.', 'elegant dinner table setting']],
    about: 'شكراً إنك جزء من يومنا. وجودك هيفرق معانا.', steps: [['أكّد الحضور', 'من صفحة التواصل.'], ['احضر', 'في الميعاد.'], ['احتفل', 'معانا.']],
    faq: [['ينفع أجيب حد معايا؟', 'ياريت تبلغنا وإنت بتأكد الحضور.'], ['فيه أماكن ركن؟', 'اكتب التفاصيل هنا.']] },
};
const EN: Record<SiteKind, Copy> = {
  perfume: { name: 'Maison Scent', tagline: 'Fragrances that tell your story', hero: 'A carefully chosen collection with lasting character and scents for every occasion.', cta: 'Explore scents', color: '#8a5a2b', heroPrompt: AR.perfume.heroPrompt,
    features: [['🌿', 'Genuine ingredients', 'Oils chosen from trusted sources.'], ['⏳', 'Long lasting', 'Balanced concentrations that stay with you.'], ['🎁', 'Gift wrapping', 'Elegant, ready to give.']],
    offerTitle: 'Our fragrances', offers: [['Royal Oud', 'Warm and deep for the evening.', AR.perfume.offers[0]![2]], ['Taif Rose', 'Soft, fresh floral.', AR.perfume.offers[1]![2]], ['White Musk', 'Clean and calm, every day.', AR.perfume.offers[2]![2]]],
    about: 'We started with a love of scent and detail. Our aim: a fragrance that speaks for you, with the quality you deserve.', steps: [['Choose', 'Browse and pick your scent.'], ['Order', 'Confirm in a minute.'], ['Receive', 'Delivered to your door.']],
    faq: [['Are the perfumes genuine?', 'Yes, everything comes from trusted sources.'], ['How long is delivery?', 'It depends on your city; we confirm the date with your order.']] },
  store: { name: 'My Store', tagline: 'Everything you need, in one place', hero: 'Quality products at fair prices, with an easy way to shop.', cta: 'Shop now', color: '#0e7490', heroPrompt: AR.store.heroPrompt,
    features: [['🚚', 'Fast delivery', 'Your order, quickly.'], ['🔒', 'Secure payment', 'Trusted payment methods.'], ['↩️', 'Easy returns', 'A clear returns policy.']],
    offerTitle: 'Featured products', offers: [['Product one', 'A short description.', AR.store.offers[0]![2]], ['Product two', 'A short description.', AR.store.offers[1]![2]], ['Product three', 'A short description.', AR.store.offers[2]![2]]],
    about: 'We care about the quality of every product and your comfort from order to delivery.', steps: [['Pick', 'Browse and choose.'], ['Order', 'A few simple steps.'], ['Receive', 'Delivered to you.']],
    faq: [['How do I order?', 'Choose a product, press order and add your details.'], ['Can I return a product?', 'Yes, under the returns policy shown.']] },
  restaurant: { name: 'Our Kitchen', tagline: 'Taste worth remembering', hero: 'Fresh food from chosen ingredients, in a warm place to share with friends.', cta: 'See the menu', color: '#c2410c', heroPrompt: AR.restaurant.heroPrompt,
    features: [['🥗', 'Fresh ingredients', 'Chosen every day.'], ['👨‍🍳', 'Skilled chefs', 'Recipes with a personal touch.'], ['🛵', 'Delivery', 'Arrives hot.']],
    offerTitle: 'From the menu', offers: [['Chef’s plate', 'The chef’s signature.', AR.restaurant.offers[0]![2]], ['Grill', 'Charcoal grilled.', AR.restaurant.offers[1]![2]], ['Desserts', 'Homemade sweets.', AR.restaurant.offers[2]![2]]],
    about: 'From our kitchen to your table: we cook with care so every plate is at its best.', steps: [['Choose', 'From the menu.'], ['Order', 'Online or by phone.'], ['Enjoy', 'Here or at home.']],
    faq: [['Can I book a table?', 'Yes, from the contact page.'], ['Vegetarian options?', 'Yes, on the menu.']] },
  portfolio: { name: 'My Work', tagline: 'Ideas turned into design', hero: 'Hello! Here are my favourite projects — and I’d love to help with your next one.', cta: 'See my work', color: '#4338ca', heroPrompt: AR.portfolio.heroPrompt,
    features: [['🎨', 'Design', 'Identities and interfaces.'], ['📷', 'Photography', 'Pictures that tell a story.'], ['💡', 'Ideas', 'Fresh solutions for your project.']],
    offerTitle: 'Selected projects', offers: [['Project one', 'A short description.', AR.portfolio.offers[0]![2]], ['Project two', 'A short description.', AR.portfolio.offers[1]![2]], ['Project three', 'A short description.', AR.portfolio.offers[2]![2]]],
    about: 'I love turning ideas into things people can see and feel, with care for detail and clear communication.', steps: [['Talk', 'We understand your goals.'], ['Design', 'Drafts and reviews.'], ['Deliver', 'Final files, ready.']],
    faq: [['How long does a project take?', 'It depends on its size; we agree a clear timeline first.'], ['Do you work remotely?', 'Yes, with clients anywhere.']] },
  company: { name: 'Our Company', tagline: 'Solutions that grow your business', hero: 'We help companies and people reach their goals with practical solutions and a professional team.', cta: 'Get in touch', color: '#1e40af', heroPrompt: AR.company.heroPrompt,
    features: [['🚀', 'Fast delivery', 'Clear plans, kept deadlines.'], ['🤝', 'Real partnership', 'We work as part of your team.'], ['📈', 'Results', 'We measure what we do.']],
    offerTitle: 'Our services', offers: [['Service one', 'A short description.', AR.company.offers[0]![2]], ['Service two', 'A short description.', AR.company.offers[1]![2]], ['Service three', 'A short description.', AR.company.offers[2]![2]]],
    about: 'A team with varied experience, aiming for high-quality work and long relationships with every client.', steps: [['Contact', 'Tell us what you need.'], ['Plan', 'We propose a clear plan.'], ['Deliver', 'We build and follow up.']],
    faq: [['Do you work with small businesses?', 'Yes, of every size.'], ['How do I start?', 'Write to us from the contact page.']] },
  clinic: { name: 'Our Clinic', tagline: 'Your health first', hero: 'Medical care with real attention, in a comfortable, well-equipped place.', cta: 'Book a visit', color: '#0f766e', heroPrompt: AR.clinic.heroPrompt,
    features: [['🩺', 'Specialists', 'Experience and care.'], ['🕒', 'Flexible hours', 'Book a time that suits you.'], ['🧼', 'Hygiene', 'High standards.']],
    offerTitle: 'Our services', offers: [['Consultation', 'A full assessment.', AR.clinic.offers[0]![2]], ['Follow-up', 'A clear plan.', AR.clinic.offers[1]![2]], ['Check-ups', 'Basic tests.', AR.clinic.offers[2]![2]]],
    about: 'We believe every patient deserves time, attention and a clear explanation.', steps: [['Book', 'Choose a time.'], ['Visit', 'Consultation.'], ['Follow up', 'Treatment plan.']],
    faq: [['How do I book?', 'From the contact page or by phone.'], ['Is this a substitute for a visit?', 'No — this content is for information only; always consult a doctor.']] },
  education: { name: 'Our Academy', tagline: 'Learning made easier', hero: 'Practical courses explained simply — learn step by step and apply right away.', cta: 'See courses', color: '#7e22ce', heroPrompt: AR.education.heroPrompt,
    features: [['🎓', 'Experienced trainers', 'Clear, practical teaching.'], ['🧩', 'Hands-on', 'Projects and exercises.'], ['📜', 'Certificate', 'On completion.']],
    offerTitle: 'Courses', offers: [['Beginners', 'From zero, step by step.', AR.education.offers[0]![2]], ['Advanced', 'Deeper skills.', AR.education.offers[1]![2]], ['Workshop', 'Learn by doing.', AR.education.offers[2]![2]]],
    about: 'Every course is designed so you understand, not just memorise — and leave with a skill you can use.', steps: [['Choose', 'The right level.'], ['Enrol', 'In a minute.'], ['Learn', 'And apply.']],
    faq: [['Are courses online?', 'Online and in person, depending on the course.'], ['Do I need experience?', 'There are courses for complete beginners.']] },
  event: { name: 'Our Celebration', tagline: 'A day to remember', hero: 'We would be honoured to have you with us. All the details are here.', cta: 'RSVP', color: '#be185d', heroPrompt: AR.event.heroPrompt,
    features: [['📅', 'Date', 'Write the date and time here.'], ['📍', 'Venue', 'Write the address here.'], ['👗', 'Dress code', 'Write the details here.']],
    offerTitle: 'Programme', offers: [['Welcome', 'Guests arrive.', AR.event.offers[0]![2]], ['Ceremony', 'The main moment.', AR.event.offers[1]![2]], ['Dinner', 'In your honour.', AR.event.offers[2]![2]]],
    about: 'Thank you for being part of our day — your presence means a lot.', steps: [['RSVP', 'From the contact page.'], ['Come', 'On time.'], ['Celebrate', 'With us.']],
    faq: [['Can I bring a guest?', 'Please tell us when you RSVP.'], ['Is there parking?', 'Write the details here.']] },
};
const LABELS = {
  ar: { home: 'الرئيسية', about: 'من نحن', contact: 'تواصل معنا', why: 'ليه تختارنا؟', how: 'إزاي بنشتغل', faq: 'أسئلة شائعة', ready: 'جاهز تبدأ؟', readyText: 'كلّمنا النهارده وخلّينا نساعدك.', contactText: 'ابعتلنا رسالة وهنرد عليك في أقرب وقت.', send: 'تواصل معنا', gallery: 'من أعمالنا' },
  en: { home: 'Home', about: 'About', contact: 'Contact', why: 'Why choose us', how: 'How it works', faq: 'Questions', ready: 'Ready to start?', readyText: 'Get in touch today and let us help.', contactText: 'Send us a message and we’ll reply soon.', send: 'Contact us', gallery: 'Gallery' },
};

/** A whole site from a few words, without any AI: the kind of site, its name, its language and one or several pages. */
export function briefToSpec(brief: string, { language = 'ar', base, onePage }: { language?: string; base?: string; onePage?: boolean } = {}): SiteSpec {
  const ar = /[\u0600-\u06FF]/.test(brief) || (!/[A-Za-z]/.test(brief) && language === 'ar');
  const kind = detectKind(brief);
  const c = (ar ? AR : EN)[kind];
  const L = ar ? LABELS.ar : LABELS.en;
  const name = nameFrom(brief) || c.name;
  const single = onePage ?? /صفحة واحدة|صفحه واحده|لاندنج|landing|one[- ]page|single page/i.test(brief);
  const email = brief.match(/[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}/i)?.[0];
  const tel = brief.match(/\+?\d[\d\s-]{7,16}\d/)?.[0];
  const hero: Section = { id: newId(), type: 'hero', title: name, text: c.hero, button: c.cta, link: single ? '#offers' : 'contact.html', image: { prompt: c.heroPrompt, alt: name } };
  const features: Section = { id: newId(), type: 'features', title: L.why, items: c.features.map(([icon, title, text]) => ({ icon, title, text })) };
  const offers: Section = { id: 'offers', type: kind === 'portfolio' || kind === 'event' ? 'gallery' : 'products', title: c.offerTitle,
    items: c.offers.map(([title, text, prompt]) => ({ title, text, image: { prompt, alt: title } })) };
  const about: Section = { id: newId(), type: 'about', title: L.about, text: c.about, image: { prompt: `${c.heroPrompt}, team and atmosphere`, alt: L.about } };
  const steps: Section = { id: newId(), type: 'steps', title: L.how, items: c.steps.map(([title, text]) => ({ title, text })) };
  const faq: Section = { id: newId(), type: 'faq', title: L.faq, items: c.faq.map(([q, a]) => ({ q, a })) };
  const cta: Section = { id: newId(), type: 'cta', title: L.ready, text: L.readyText, button: L.send, link: single ? '#contact' : 'contact.html' };
  const contact: Section = { id: 'contact', type: 'contact', title: L.contact, text: L.contactText, ...(email ? { email } : {}), ...(tel ? { phone: tel.trim() } : {}) };
  const pages: Page[] = single
    ? [{ slug: 'index', title: L.home, sections: [hero, features, offers, about, steps, faq, contact] }]
    : [
      { slug: 'index', title: L.home, sections: [hero, features, offers, cta] },
      { slug: 'about', title: L.about, sections: [about, steps, faq] },
      { slug: 'contact', title: L.contact, sections: [contact] },
    ];
  return { name, tagline: c.tagline, lang: ar ? 'ar' : 'en', dir: ar ? 'rtl' : 'ltr', theme: { base: base || c.color, harmony: 'complementary', dark: false, radius: 'soft' }, pages };
}

/** Every image the site still needs drawn (a prompt without a picture). */
export function missingImages(spec: SiteSpec): ImageRef[] {
  const out: ImageRef[] = [];
  for (const page of spec.pages) for (const s of page.sections) {
    if (s.image?.prompt && !s.image.src) out.push(s.image);
    for (const it of s.items || []) if (it.image?.prompt && !it.image.src) out.push(it.image);
  }
  return out;
}
/** A deep copy (the builder edits copies, so «تراجع» can go back). */
export const cloneSpec = (spec: SiteSpec): SiteSpec => JSON.parse(JSON.stringify(spec)) as SiteSpec;
