/**
 * Admin panel localization.
 *
 * The admin UI was originally Arabic-only. Its strings are now keyed by their
 * Arabic source text (gettext style): components call `T('النص العربي')` and the
 * helper resolves the current language, degrading to English and finally to the
 * Arabic source, so a missing translation can never render an empty label.
 *
 * Translation waves append entries here; `ar` is always the source text and is
 * therefore never stored explicitly.
 */
import { useEffect, useState } from 'react';
import { getInitialLanguage } from '../utils/i18n';
import { SUPPORTED_LANGUAGES } from '../types/i18n';
import type { SupportedLanguage } from '../types/i18n';

type AdminDict = Partial<Record<SupportedLanguage, string>>;

export const ADMIN_STRINGS: Record<string, AdminDict> = {
  // ── Tabs / navigation ──────────────────────────────────────────────────
  'نظرة عامة': { en: 'Overview' },
  'المساعد الإداري': { en: 'Admin assistant' },
  'الجودة والتعلّم': { en: 'Quality & learning' },
  'الطلبات والعروض': { en: 'Requests & quotes' },
  'إشعارات البريد': { en: 'Email notifications' },
  'المحادثات': { en: 'Conversations' },
  'المنتجات': { en: 'Products' },
  'قاعدة المعرفة': { en: 'Knowledge base' },
  'الخدمات': { en: 'Services' },
  'المحركات والإعدادات': { en: 'Engines & settings' },
  'الخبير شاهين': { en: 'Shaheen the expert' },
  'طبيب شاهين': { en: 'Shaheen doctor' },
  'مشرف الذكاء الاصطناعي': { en: 'AI supervisor' },
  'مختبر المساعد': { en: 'Assistant sandbox' },
  'بيئة التحديثات': { en: 'Update sandbox' },

  // ── Request statuses ───────────────────────────────────────────────────
  'جديد': { en: 'New' },
  'قيد التنفيذ': { en: 'In progress' },
  'عرض سعر': { en: 'Quote' },
  'مؤكد': { en: 'Confirmed' },
  'مكتمل': { en: 'Completed' },
  'ملغي': { en: 'Cancelled' },

  // ── Request types ──────────────────────────────────────────────────────
  'طلب متجر': { en: 'Store order' },
  'عطر مخصص': { en: 'Custom perfume' },
  'عرض جملة': { en: 'Wholesale quote' },
  'استشارة': { en: 'Consultation' },
  'دعم': { en: 'Support' },
  'خدمة': { en: 'Service' },

  // ── Visitor intents ────────────────────────────────────────────────────
  'تحية': { en: 'Greeting' },
  'شكر': { en: 'Thanks' },
  'عرض الخدمات': { en: 'List services' },
  'تتبع': { en: 'Track' },
  'تصفح منتجات': { en: 'Browse products' },
  'طلب خدمة': { en: 'Service request' },
  'تحويل لموظف': { en: 'Handoff to staff' },
  'حساب': { en: 'Calculation' },
  'سؤال خبير': { en: 'Expert question' },
  'سؤال عام': { en: 'General question' },
  'عرض الذاكرة': { en: 'View memory' },
  'حذف البيانات': { en: 'Delete data' },

  // ── Engines / roles ────────────────────────────────────────────────────
  'نموذج مفتوح مستضاف ذاتياً': { en: 'Self-hosted open model' },
  'محرك شام الذاتي': { en: "Sham's own engine" },
  'موظف': { en: 'Staff member' },
  'النظام': { en: 'System' },
  'خبير التركيب والمواد': { en: 'Formulation & materials expert' },
  'المستشار التجاري': { en: 'Commercial advisor' },
  'مراجع السلامة والجودة': { en: 'Safety & quality reviewer' },
  'صوت العميل': { en: 'Voice of the customer' },
  'مستشار عام': { en: 'General advisor' },

  // ── Login / shell ──────────────────────────────────────────────────────
  'رمز الإدارة غير صحيح.': { en: 'Invalid admin token.' },
  'لوحة الإدارة غير مفعلة: اضبط SHAM_ADMIN_TOKEN (12 حرفاً على الأقل) في متغيرات الخادم.': {
    en: 'The admin panel is not enabled: set SHAM_ADMIN_TOKEN (at least 12 characters) in the server environment variables.',
  },
  'محاولات كثيرة فاشلة. انتظر 15 دقيقة.': { en: 'Too many failed attempts. Wait 15 minutes.' },
  'تعذّر الاتصال بالخادم.': { en: 'Could not reach the server.' },
  'إدارة شام — Sham Core': { en: 'Sham Admin — Sham Core' },
  'لوحة الإدارة تحتاج خادم شام (Node.js أو Vercel). نسخة GitHub Pages ثابتة ولا تحتوي على API.': {
    en: 'The admin panel needs the Sham server (Node.js or Vercel). The GitHub Pages build is static and has no API.',
  },
  'أدخل رمز الإدارة المضبوط في متغير الخادم': { en: 'Enter the admin token configured in the server variable' },
  '. يُحفظ الرمز في هذه الجلسة فقط.': { en: '. The token is kept for this session only.' },
  'رمز الإدارة': { en: 'Admin token' },
  'العودة إلى الموقع': { en: 'Back to the site' },
  'مركز إدارة المساعد والخدمات': { en: 'Assistant & services control centre' },
  'الموقع': { en: 'Site' },
  'خروج': { en: 'Log out' },
  'جارٍ التحميل…': { en: 'Loading…' },
  'لا توجد بيانات بعد.': { en: 'No data yet.' },

  // ── Overview tab ───────────────────────────────────────────────────────
  'حالة المساعد والخدمات والطلبات': { en: 'Assistant, services and requests status' },
  'تحديث': { en: 'Refresh' },
  'تنبيه التخزين:': { en: 'Storage warning:' },
  'على سيرفر Node أو': { en: 'on a Node server or' },
  'طلبات جديدة': { en: 'New requests' },
  'تحويلات لموظف مفتوحة': { en: 'Open staff handoffs' },
  'محادثات آخر 24 ساعة': { en: 'Conversations in the last 24 hours' },
  'منتجات مخزونها منخفض': { en: 'Low-stock products' },
  'أسئلة بلا إجابة (فجوات)': { en: 'Unanswered questions (gaps)' },
  'تقييمات إيجابية 👍': { en: 'Positive ratings 👍' },
  'تقييمات سلبية 👎': { en: 'Negative ratings 👎' },
  'نوايا الزوار': { en: 'Visitor intents' },
  'الطلبات حسب الحالة': { en: 'Requests by status' },
  'المحركات التي ردّت فعلياً': { en: 'Engines that actually replied' },
  'الطلبات حسب النوع': { en: 'Requests by type' },
  'قيمة طلبات المتجر (غير الملغاة)': { en: 'Value of store orders (not cancelled)' },
  'لا توجد طلبات متجر بعد.': { en: 'No store orders yet.' },
  'قيمة تقديرية قبل تأكيد الشحن والدفع.': { en: 'Estimated value before shipping and payment are confirmed.' },
  'البنية': { en: 'Structure' },
  'التخزين:': { en: 'Storage:' },
  'المحادثات:': { en: 'Conversations:' },
  '· الطلبات:': { en: '· Requests:' },
  'المعرفة:': { en: 'Knowledge:' },
  'مستند · الخدمات:': { en: 'documents · Services:' },
  // ── Batch 2: requests, emails, conversations, catalogue, services ──────
  '· المنتجات:': { en: '· Products:' },
  'غير مفعلة — اضبط': { en: 'Not enabled — set' },
  'طلبات المتجر، العطور المخصصة، الجملة، الاستشارات مع نظام إشعارات البريد التلقائي للعملاء': { en: 'Store orders, custom perfumes, wholesale and consultations with the automatic customer email notification system' },
  'تصفية حسب الحالة': { en: 'Filter by status' },
  'كل الحالات': { en: 'All statuses' },
  'لا توجد طلبات.': { en: 'No requests.' },
  'العميل:': { en: 'Customer:' },
  'الهاتف:': { en: 'Phone:' },
  'مفعّل للإشعارات': { en: 'Enabled for notifications' },
  'البريد: غير مسجل (الإشعارات بالبريد غير متاحة)': { en: 'Email: not registered (email notifications unavailable)' },
  'المنتج': { en: 'Product' },
  'الكمية': { en: 'Quantity' },
  'السعر': { en: 'Price' },
  'الإجمالي': { en: 'Total' },
  'إلغاء الطلب نهائي ويعيد الكميات للمخزون. متأكد؟': { en: 'Cancelling the order is final and returns the quantities to stock. Are you sure?' },
  'إرسال إشعار بريد إلكتروني للعميل تلقائياً عند تغيير الحالة': { en: 'Send the customer an email notification automatically when the status changes' },
  'ملاحظة خاصة بالعميل تُرفق بالبريد (رقم الشحنة، تفاصيل العرض…)': { en: 'A customer-facing note attached to the email (shipment number, quote details…)' },
  'ملاحظة البريد': { en: 'Email note' },
  'إرسال إشعار بالحالة الحالية فوراً للعميل': { en: 'Send the customer an immediate notification with the current status' },
  'ملاحظة داخلية للإدارة (مذكرات داخلية، موعد توريد…)': { en: 'Internal admin note (internal memos, supply date…)' },
  'ملاحظة داخلية': { en: 'Internal note' },
  'إضافة ملاحظة داخلية': { en: 'Add an internal note' },
  'سجل التحديثات والإشعارات:': { en: 'Updates and notifications log:' },
  'اختر طلباً لعرض التفاصيل وتحديث حالته وإشعاراته.': { en: 'Select a request to see its details, update its status and notifications.' },
  'معاينة إشعار البريد الإلكتروني للعميل': { en: 'Preview the customer email notification' },
  'إلى:': { en: 'To:' },
  'عنوان الرسالة (Subject):': { en: 'Subject:' },
  'تصميم متجاوب ومتوافق مع تطبيقات البريد (Gmail, Outlook, Apple Mail).': { en: 'Responsive design compatible with mail clients (Gmail, Outlook, Apple Mail).' },
  'رسالة تجريبية: طلبك قيد التجهيز بعناية فائقة من مختبرات شام.': { en: 'Sample message: your order is being prepared with great care by Sham laboratories.' },
  'نظام إشعارات البريد الإلكتروني للعملاء': { en: 'Customer email notification system' },
  'إدارة قوالب إشعارات الطلبات وتحديثات الحالات، واختبار الإرسال، ومراجعة سجل البريد المرسل': { en: 'Manage order-notification templates and status updates, test sending and review the sent-mail log' },
  'محاكي آمن (Simulator)': { en: 'Safe simulator' },
  '✅ متصل ومفعل لإرسال الرسائل الحقيقية للعملاء': { en: '✅ Connected and enabled to send real messages to customers' },
  '⚡ يعمل في وضع المحاكاة الآمنة والتدقيق الداخلي (دون استهلاك رصيد خارجي)': { en: '⚡ Running in safe simulator and internal review mode (no external credits used)' },
  'إشعارات تم توليدها وإرسالها للعملاء عند تغيير الحالات': { en: 'Notifications generated and sent to customers when statuses change' },
  'يرسل النظام إشعاراً فورياً بتصميم متجاوب وبطاقة تتبع مباشرة': { en: 'The system sends an instant notification with a responsive design and a live tracking card' },
  'إرسال بريد تجريبي لاختبار النظام': { en: 'Send a test email to check the system' },
  'ملاحظة إضافية للعميل': { en: 'Extra note for the customer' },
  'استعراض مظهر القوالب للعملاء': { en: 'Preview how the templates look to customers' },
  'تصميم فاخر بنمط شام': { en: 'Luxury design in the Sham style' },
  'عنوان الرسالة المتوقع:': { en: 'Expected subject:' },
  'الأستاذ أحمد فؤاد': { en: 'Mr Ahmed Fouad' },
  'العنوان': { en: 'Address' },
  'التجمع الخامس، القاهرة': { en: 'Fifth Settlement, Cairo' },
  'طريقة الدفع': { en: 'Payment method' },
  'الدفع عند الاستلام': { en: 'Cash on delivery' },
  'عطر عود ملكي خاص (EdP)': { en: 'Private royal oud perfume (EdP)' },
  'زيت ورد غراس النقي 30 مل': { en: 'Pure Grasse rose oil, 30 ml' },
  'سجل الإشعارات المرسلة للعملاء': { en: 'Log of notifications sent to customers' },
  'الوقت': { en: 'Time' },
  'رقم الطلب': { en: 'Order number' },
  'العميل والبريد': { en: 'Customer & email' },
  'الحالة المرسلة': { en: 'Sent status' },
  'المزود': { en: 'Provider' },
  'حالة الإرسال': { en: 'Delivery status' },
  'الإجراء': { en: 'Action' },
  'تم الإرسال': { en: 'Sent' },
  'محاكاة ناجحة': { en: 'Simulated successfully' },
  'فشل': { en: 'Failed' },
  'كل محادثات الزوار مع مسار التنفيذ؛ يمكن الرد مباشرة على التحويلات': { en: 'All visitor conversations with the execution trace; you can reply directly to handoffs' },
  'التحويلات فقط': { en: 'Handoffs only' },
  'لا توجد محادثات.': { en: 'No conversations.' },
  'تحويل': { en: 'Handoff' },
  'مغلقة': { en: 'Closed' },
  'حالة المحادثة': { en: 'Conversation status' },
  'مفتوحة (المساعد)': { en: 'Open (assistant)' },
  'مسار التنفيذ': { en: 'Execution trace' },
  'اكتب رداً بشرياً يظهر للزائر في نفس المحادثة…': { en: 'Write a human reply that appears to the visitor in the same conversation…' },
  'رد الموظف': { en: 'Staff reply' },
  'اختر محادثة.': { en: 'Select a conversation.' },
  'حذف نهائي؟': { en: 'Delete permanently?' },
  'إضافة': { en: 'Add' },
  'حذف': { en: 'Delete' },
  'حفظ': { en: 'Save' },
  'إلغاء': { en: 'Cancel' },
  'اختر عنصراً للتعديل أو أضف جديداً.': { en: 'Select an item to edit or add a new one.' },
  'الكتالوج الوحيد الذي يقتبس منه المساعد الأسعار والمخزون': { en: 'The only catalogue the assistant quotes prices and stock from' },
  'الكتالوج فارغ — المساعد لن يذكر أي أسعار حتى تضيف منتجات.': { en: 'The catalogue is empty — the assistant will not mention any prices until you add products.' },
  'تجريبي': { en: 'Draft' },
  'مخفي': { en: 'Hidden' },
  'الاسم بالعربية': { en: 'Name in Arabic' },
  'الفئة': { en: 'Category' },
  'عطر': { en: 'Perfume' },
  'زيت': { en: 'Oil' },
  'مادة خام': { en: 'Raw material' },
  'عبوات': { en: 'Bottles' },
  'طقم': { en: 'Set' },
  'أخرى': { en: 'Other' },
  'العملة': { en: 'Currency' },
  'المخزون': { en: 'Stock' },
  'الوحدة': { en: 'Unit' },
  'الوصف بالعربية': { en: 'Description in Arabic' },
  'كلمات البحث (مفصولة بفواصل)': { en: 'Search keywords (comma-separated)' },
  'ظاهر للزوار': { en: 'Visible to visitors' },
  'المصدر الذي يستند إليه المساعد في الإجابات ويعرضه كمراجع (RAG)': { en: 'The source the assistant relies on for answers and shows as references (RAG)' },
  'لا توجد مستندات.': { en: 'No documents.' },
  'المحتوى (سياسات، أسئلة شائعة، شروط الشحن والاسترجاع…)': { en: 'Content (policies, FAQs, shipping and return terms…)' },
  'وسوم (مفصولة بفواصل)': { en: 'Tags (comma-separated)' },
  'معرف الخدمة المرتبطة (اختياري)': { en: 'Linked service id (optional)' },
  'أضف أي خدمة تجارية جديدة: الكلمات المفتاحية توجّه الزوار إليها، والحقول تحدد استمارة الطلب': { en: 'Add any new commercial service: keywords direct visitors to it and the fields define the request form' },
  'لا توجد خدمات.': { en: 'No services.' },
  'معطلة': { en: 'Disabled' },
  'النوع': { en: 'Type' },
  'معلومات/أدوات': { en: 'Information/tools' },
  'متجر': { en: 'Store' },
  'طلب مخصص': { en: 'Custom request' },
  'جملة B2B': { en: 'B2B wholesale' },
  'خدمة جديدة': { en: 'New service' },
  'الترتيب': { en: 'Order' },
  'كلمات التوجيه (مفصولة بفواصل)': { en: 'Routing keywords (comma-separated)' },
  'حقول الاستمارة (JSON: name, labelAr, labelEn, type, required, options)': { en: 'Form fields (JSON: name, labelAr, labelEn, type, required, options)' },
  'JSON غير صالح — لن تُحفظ الحقول حتى يُصحَّح.': { en: 'Invalid JSON — fields will not be saved until it is fixed.' },
  'مفعّلة للزوار': { en: 'Enabled for visitors' },
  'تم الحفظ ✅': { en: 'Saved ✅' },
  'سياسة اختيار المحرك مع التحويل التلقائي عند الفشل؛ محرك شام الذاتي هو خط الأمان الأخير دائماً': { en: 'Engine selection policy with automatic failover; Sham\'s own engine is always the last line of safety' },
  'نسخة احتياطية': { en: 'Fallback' },
  'ترتيب المحركات': { en: 'Engine order' },
};

let currentLang: SupportedLanguage = 'ar';
try {
  currentLang = getInitialLanguage();
} catch {
  currentLang = 'ar';
}

/** The language the admin panel is currently rendering with. */
export function getAdminLang(): SupportedLanguage {
  return currentLang;
}

/** Switch the admin panel language (called by the shell when the app language changes). */
export function setAdminLang(lang: SupportedLanguage): void {
  if (SUPPORTED_LANGUAGES.some(l => l.code === lang)) currentLang = lang;
}

/**
 * Translate an admin string, keyed by its Arabic source text.
 * Resolution order: current language → English → Arabic source.
 */
export function T(text: string): string {
  // Arabic is the source language: the key itself is the Arabic string.
  if (currentLang === 'ar') return text;
  const entry = ADMIN_STRINGS[text];
  if (!entry) return text;
  return entry[currentLang] || entry.en || text;
}

/** Writing direction for the admin panel, following the current language. */
export function adminDir(): 'rtl' | 'ltr' {
  const cfg = SUPPORTED_LANGUAGES.find(l => l.code === currentLang);
  return (cfg?.dir as 'rtl' | 'ltr') || 'rtl';
}

/** Number of translated admin strings for a language (used by tests / audits). */
export function adminCoverage(lang: SupportedLanguage): number {
  return Object.values(ADMIN_STRINGS).filter(entry => Boolean(entry[lang])).length;
}

/** Total number of admin strings in the dictionary. */
export function adminStringCount(): number {
  return Object.keys(ADMIN_STRINGS).length;
}

/**
 * Keeps the admin panel in sync with the language chosen on the public site.
 * Re-renders when another tab changes the stored language.
 */
export function useAdminLanguage(): SupportedLanguage {
  const [lang, setLang] = useState<SupportedLanguage>(() => getAdminLang());

  useEffect(() => {
    setAdminLang(lang);
    const onStorage = () => {
      const next = getInitialLanguage();
      setAdminLang(next);
      setLang(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [lang]);

  return lang;
}
