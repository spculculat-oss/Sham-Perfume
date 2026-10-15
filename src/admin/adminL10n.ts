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
  // ── Batch 3: shaheen settings, engines, council, agent, quality ────────
  'مفعلة للزوار': { en: 'Enabled for visitors' },
  'المفاتيح وعناوين الخوادم تُضبط في متغيرات بيئة الخادم فقط ولا تظهر هنا. المحرك غير المهيأ يُتخطى تلقائياً.': { en: 'Keys and server URLs are set only in the server environment variables and never shown here. An unconfigured engine is skipped automatically.' },
  'أعلى': { en: 'Up' },
  'أسفل': { en: 'Down' },
  'هوية المساعد': { en: 'Assistant identity' },
  'رسالة الترحيب بالعربية': { en: 'Welcome message in Arabic' },
  'الشخصية وأسلوب الرد': { en: 'Personality and reply style' },
  'العملة الافتراضية': { en: 'Default currency' },
  'مواعيد العمل': { en: 'Working hours' },
  'تواصل مباشر': { en: 'Direct contact' },
  'واتساب / هاتف': { en: 'WhatsApp / phone' },
  'حفظ الإعدادات': { en: 'Save settings' },
  'غير مهيأ — لا يوجد مفتاح/عنوان في متغيرات الخادم': { en: 'Not configured — no key or URL in the server environment variables' },
  'المزوّد رفض الطلب أو رجّع رداً فارغاً — راجع صلاحية المفتاح واسم النموذج والرصيد': { en: 'The provider rejected the request or returned an empty reply — check the key, the model name and the balance' },
  'انتهت المهلة — الخدمة بطيئة أو غير متاحة': { en: 'Timed out — the service is slow or unavailable' },
  'تعذّر الوصول للمزوّد (شبكة/عنوان خاطئ/مفتاح مرفوض)': { en: 'Could not reach the provider (network / wrong URL / rejected key)' },
  'المفتاح غير صالح أو ملغي — أنشئ مفتاحاً جديداً من حساب المزوّد وضعه في متغيرات الخادم': { en: 'The key is invalid or revoked — create a new key in the provider account and put it in the server environment variables' },
  'الحساب بلا رصيد أو انتهت الحصة المجانية — اشحن الرصيد أو فعّل الفوترة عند المزوّد': { en: 'The account has no credit or the free quota ended — top up or enable billing with the provider' },
  'تجاوزت حد الطلبات مؤقتاً — انتظر دقيقة ثم أعد الاختبار': { en: 'Rate limit exceeded temporarily — wait a minute and test again' },
  'اسم النموذج غير متاح لهذا الحساب — اختر نموذجاً آخر من الإعدادات': { en: 'The model name is not available for this account — choose another model in the settings' },
  'المزوّد لا يخدم منطقة الخادم — استخدم خادماً في منطقة مدعومة': { en: 'The provider does not serve the server\'s region — use a server in a supported region' },
  'المزوّد رفض صيغة الطلب — راجع اسم النموذج والإعدادات': { en: 'The provider rejected the request format — check the model name and settings' },
  'خدمة المزوّد متعطلة حالياً — أعد المحاولة لاحقاً': { en: 'The provider service is currently down — try again later' },
  'تمت العودة لإعدادات الملف المشتركة ✅': { en: 'Reverted to the shared file settings ✅' },
  'تم الحفظ ✅ — يظهر فوراً على الموقعين': { en: 'Saved ✅ — it appears immediately on both sites' },
  'إعدادات شات تصميم العطور (النافذة العائمة وصفحة المعمل). نفس الإعدادات تُطبَّق على موقع Vercel وموقع GitHub Pages لأن الاتنين بيستخدموا نفس الخادم.': { en: 'Settings of the perfume-design chat (the floating window and the lab page). The same settings apply to the Vercel site and the GitHub Pages site because both use the same server.' },
  'أي تعديل تحفظه هنا يشتغل فوراً، لكنه ممكن يضيع لما الخادم يعيد التشغيل. عشان يبقى دائم على الموقعين: فعّل': { en: 'Any change you save here works immediately, but it may be lost when the server restarts. To keep it permanent on both sites: enable' },
  'مع بيانات Firebase في Vercel، أو انسخ «الإعداد الدائم» بالأسفل لملف': { en: 'with Firebase data in Vercel, or copy the “permanent configuration” below into the file' },
  'في المستودع.': { en: 'in the repository.' },
  'شاهين مفعّل للزوار': { en: 'Shaheen is enabled for visitors' },
  'السماح للزائر باختيار وضع الرد (سريع / معمّق / مجلس الخبراء) — أسماء المحركات لا تظهر للزوار أبداً': { en: 'Allow the visitor to choose the reply mode (fast / deep / expert council) — engine names are never shown to visitors' },
  'غير جاهز: مفيش ولا محرك مسموح ومهيأ — الزوار هيشوفوا «شاهين غير متصل».': { en: 'Not ready: no allowed and configured engine — visitors will see “Shaheen is offline”.' },
  'المحركات وترتيب «تلقائي»': { en: 'Engines and the “auto” order' },
  '«تلقائي» يجرّب المحركات بالترتيب ده ويتخطى غير المهيأ أو اللي فشل. المحرك غير المسموح يختفي من واجهة الزوار. المفاتيح تُضبط في متغيرات الخادم فقط.': { en: '“Auto” tries the engines in this order and skips unconfigured or failed ones. A disallowed engine disappears from the visitor interface. Keys are set only in the server environment variables.' },
  'تقديم في الترتيب': { en: 'Move up in the order' },
  'تأخير في الترتيب': { en: 'Move down in the order' },
  'أسلوب الردود': { en: 'Reply style' },
  'أقصى طول للرد': { en: 'Maximum reply length' },
  'تعليمات إضافية لشاهين (اختياري — لا تلغي قواعد السلامة)': { en: 'Extra instructions for Shaheen (optional — they do not override the safety rules)' },
  'مثال: اقترح خامات متوفرة في السوق المصري، واذكر البدائل الاقتصادية، واختم بتذكير بطلب عينة من متجر شام.': { en: 'Example: suggest ingredients available in the Egyptian market, mention economical alternatives and finish by reminding the visitor to request a sample from the Sham store.' },
  'حفظ إعدادات شاهين': { en: 'Save Shaheen settings' },
  'رجوع لإعدادات الملف': { en: 'Back to file settings' },
  'فيه تعديلات لم تُحفظ.': { en: 'There are unsaved changes.' },
  'الاختبار يبعت طلب صغير حقيقي لكل محرك مسموح (بالإعدادات المحفوظة).': { en: 'The test sends a small real request to every allowed engine (with the saved settings).' },
  'لا توجد محركات مسموح بها.': { en: 'No engines are allowed.' },
  'ده نفس الإعداد الحالي بصيغة ملف': { en: 'This is the current configuration as a file' },
  '. لما يتحط في المستودع ويتعمل نشر، يبقى هو الأساس على الموقعين حتى بدون تخزين دائم.': { en: '. When it is committed to the repository and deployed it becomes the baseline on both sites even without persistent storage.' },
  'المجلس الاستشاري (نقاش بين نماذج الذكاء الاصطناعي)': { en: 'Advisory council (a discussion between AI models)' },
  'مفعّل': { en: 'Enabled' },
  'تفعيل المقعد': { en: 'Enable the seat' },
  'المحرك': { en: 'Engine' },
  'النموذج': { en: 'Model' },
  'الدور': { en: 'Role' },
  'حذف المقعد': { en: 'Remove the seat' },
  'إضافة مقعد': { en: 'Add a seat' },
  'رئيس المجلس (يكتب الرد النهائي)': { en: 'Council chair (writes the final reply)' },
  'تلقائي (حسب ترتيب المحركات)': { en: 'Auto (following the engine order)' },
  'جولات النقاش (المراجعة المتبادلة)': { en: 'Discussion rounds (peer review)' },
  'بدون نقاش (آراء + خلاصة)': { en: 'No discussion (opinions + summary)' },
  'جولة واحدة (موصى به)': { en: 'One round (recommended)' },
  'جولتان (أبطأ وأغلى)': { en: 'Two rounds (slower and more expensive)' },
  'إظهار النقاش للزائر تحت الرد': { en: 'Show the discussion to the visitor under the reply' },
  'يجتمع المجلس تلقائياً في (والزائر يقدر يطلبه بنفسه من زر المجلس في هذه الأنواع):': { en: 'The council convenes automatically for (and the visitor can request it themselves from the council button in these types):' },
  'حفظ إعدادات المجلس': { en: 'Save council settings' },
  'جرّبه من «مختبر المساعد» بعلامة «استشارة المجلس».': { en: 'Try it from the “assistant sandbox” with the “council consultation” flag.' },
  'لم يرد (فشل أو انتهت المهلة)': { en: 'No reply (failed or timed out)' },
  'ازاي أركّب عطر عود ثابت؟': { en: 'How do I make a long-lasting oud perfume?' },
  'عايز اشتري زيت عود': { en: 'I want to buy oud oil' },
  'محتاج عرض سعر جملة لمحل': { en: 'I need a wholesale quote for a shop' },
  'يعني ايه تعتيق العطر؟': { en: 'What does perfume maceration mean?' },
  '50 مل بتركيز 20%': { en: '50 ml at 20% concentration' },
  'عايز أكلم موظف': { en: 'I want to talk to a staff member' },
  'جرّب نفس مسار الزوار مع عرض كامل لخطوات التنفيذ (التوجيه، الاسترجاع، الأدوات، المحرك)': { en: 'Try the same visitor path with a full display of the execution steps (routing, retrieval, tools, engine)' },
  'اكتب رسالة اختبار…': { en: 'Write a test message…' },
  'رسالة اختبار': { en: 'Test message' },
  'اللغة': { en: 'Language' },
  'استشارة المجلس': { en: 'Council consultation' },
  'المحرك:': { en: 'Engine:' },
  '· النية:': { en: '· Intent:' },
  'تم إرسال إشعار تجريبي ✅': { en: 'Test notification sent ✅' },
  'فشل الإرسال — راجع الرابط': { en: 'Sending failed — check the link' },
  'إرسال إشعار تجريبي': { en: 'Send a test notification' },
  'تقرير اليوم الكامل': { en: 'Full report for today' },
  'إيه الطلبات المتأخرة؟': { en: 'What are the late requests?' },
  'المخزون اللي قرب يخلص': { en: 'Stock that is about to run out' },
  'الزوار سألوا عن إيه ومالقوش إجابة؟': { en: 'What did visitors ask about without getting an answer?' },
  'رضا العملاء عامل إزاي؟': { en: 'How is customer satisfaction doing?' },
  'المبيعات والقيمة المتوقعة': { en: 'Sales and expected value' },
  'فشل التشغيل': { en: 'Run failed' },
  'وكيل عمليات يخطط وينفذ أدوات قراءة فقط على بيانات شام ثم يكتب تقريراً بخطوات قابلة للتنفيذ. لا يعدّل أي بيانات بنفسه.': { en: 'An operations agent that plans and runs read-only tools on Sham\'s data, then writes a report with actionable steps. It never modifies data itself.' },
  'اطلب تقريراً… مثال: إيه اللي محتاج انتباهي النهارده؟': { en: 'Ask for a report… e.g. what needs my attention today?' },
  'طلب للمساعد الإداري': { en: 'Request to the admin assistant' },
  'الوكيل يخطط وينفذ المهام…': { en: 'The agent is planning and executing tasks…' },
  'الخطة المنفذة': { en: 'Executed plan' },
  'الملخص': { en: 'Summary' },
  'فتح ←': { en: 'Open ←' },
  'فشل الحفظ': { en: 'Save failed' },
  'كل سؤال لم يجد إجابة أو رد قيّمه زائر سلبياً يتحول لفجوة. اكتب الإجابة مرة واحدة فتُضاف لقاعدة المعرفة ويستخدمها المساعد فوراً.': { en: 'Every question that found no answer, or a reply a visitor rated negatively, becomes a gap. Write the answer once and it is added to the knowledge base and used by the assistant immediately.' },
  'فجوات مفتوحة': { en: 'Open gaps' },
  'نسبة الرضا': { en: 'Satisfaction rate' },
  'التقييمات': { en: 'Ratings' },
  'فجوات المعرفة': { en: 'Knowledge gaps' },
  'لم يجد المساعد إجابة': { en: 'The assistant found no answer' },
  'عنوان المستند': { en: 'Document title' },
  'الإجابة الصحيحة كما يجب أن يقولها المساعد': { en: 'The correct answer as the assistant should give it' },
  'الإجابة': { en: 'Answer' },
  'أضف الإجابة': { en: 'Add the answer' },
  'تجاهل': { en: 'Ignore' },
  'إعادة فتح': { en: 'Reopen' },
  'آخر التقييمات': { en: 'Latest ratings' },
  'لم يقيّم الزوار أي رد بعد.': { en: 'Visitors have not rated any reply yet.' },
  'تصفير حالة المزوّدين': { en: 'Reset provider status' },
  'تحديث قائمة الموديلات': { en: 'Refresh the model list' },
  'مسح ذاكرة الإجابات': { en: 'Clear the answer memory' },
  '⏳ تحت المراقبة': { en: '⏳ Under observation' },
  '❌ ما اتطبقش': { en: '❌ Not applied' },
  '✅ شغال': { en: '✅ Working' },
  '↩️ اترجع': { en: '↩️ Rolled back' },
  '⚪ من غير تأكيد': { en: '⚪ Unconfirmed' },
  // ── Batch 4: supervisor, doctor, updates intake ────────────────────────
  'طبيب شاهين — الصيانة التلقائية': { en: 'Shaheen Doctor — automatic maintenance' },
  'بيراجع الخبير شاهين كل 10 دقايق من خوادم GitHub (مش من خادم الموقع) وبيصلّح المشاكل لوحده': { en: 'The Shaheen expert reviews every 10 minutes from GitHub servers (not the site server) and fixes problems on its own' },
  'آخر تقرير للطبيب': { en: 'Latest doctor report' },
  'لسه مفيش تقرير — أول فحص بيتعمل خلال 10 دقايق من دمج الطبيب في main.': { en: 'No report yet — the first check runs within 10 minutes of the doctor being merged into main.' },
  'آخر 6 ساعات': { en: 'Last 6 hours' },
  'آخر 6 ساعات:': { en: 'Last 6 hours:' },
  'إصلاحات الكود التلقائية': { en: 'Automatic code fixes' },
  'التغيير': { en: 'Change' },
  'لسه مفيش': { en: 'Nothing yet' },
  'السجل الكامل على GitHub ←': { en: 'Full log on GitHub ←' },
  'الخادم دلوقتي (النسخة اللي ردّت)': { en: 'Current server (the version that answered)' },
  'ردود آخر 10 د': { en: 'Replies in the last 10 min' },
  'أخطاء': { en: 'Errors' },
  'ممتاز': { en: 'Excellent' },
  'يحتاج تحسين': { en: 'Needs improvement' },
  'مشكلة': { en: 'Problem' },
  'لم يُفحص هذه المرة': { en: 'Not checked this time' },
  '✍️ كتب شاهين توجيهات جديدة في هذه المراجعة': { en: '✍️ Shaheen wrote new guidance in this review' },
  '↩️ تراجع شاهين عن آخر توجيهات لأن الأداء قلّ بعدها': { en: '↩️ Shaheen reverted the last guidance because performance dropped after it' },
  '📌 التوجيهات الحالية مستمرة': { en: '📌 The current guidance continues' },
  'مشرف الذكاء الاصطناعي — الخبير شاهين': { en: 'AI supervisor — the Shaheen expert' },
  'كل 12 ساعة يجرّب شاهين كل أداة ذكاء اصطناعي في الموقع بأسئلة حقيقية، يقيّم ردودها، ويكتب لها توجيهات تحسّن أداءها — ويتراجع عنها لو الأداء قلّ.': { en: 'Every 12 hours Shaheen tests every AI tool on the site with real questions, scores their replies and writes guidance that improves their performance — and reverts it if performance drops.' },
  'متوسط جودة الأدوات': { en: 'Average tool quality' },
  'سجل التشغيل': { en: 'Run log' },
  'لسه شاهين ما عملش أول مراجعة — بتشتغل تلقائياً بعد نشرة الأخبار القادمة.': { en: 'Shaheen has not run the first review yet — it runs automatically after the next news publication.' },
  'نقاط القوة': { en: 'Strengths' },
  'الملاحظات': { en: 'Notes' },
  'توجيهات شاهين الحالية للأداة': { en: 'Shaheen\'s current guidance for the tool' },
  'لا توجد — الأداة شغالة كويس بتعليماتها الأصلية.': { en: 'None — the tool works well with its original instructions.' },
  'هذه الأداة لا تعتمد على تعليمات نصية، فشاهين يراقبها وينبّه لمشاكلها فقط.': { en: 'This tool does not rely on text instructions, so Shaheen only monitors it and flags its problems.' },
  'عينات من الفحص': { en: 'Samples from the check' },
  'مثال: أداة جديدة وترقية بيانات تابعة لها': { en: 'Example: a new tool and an upgrade of its data' },
  'حاسبة تكلفة التغليف': { en: 'Packaging cost calculator' },
  'تحسب تكلفة الزجاجة والغطاء والكرتونة والملصق لكل وحدة إنتاج': { en: 'Calculates the cost of the bottle, cap, carton and label per production unit' },
  'أحجام العبوات — تحديث': { en: 'Bottle sizes — update' },
  'ثُبّتت — زيادة جديدة': { en: 'Installed — new addition' },
  'ترقية فعلية': { en: 'Real upgrade' },
  'موجود بنفس المحتوى': { en: 'Already present with identical content' },
  'أقدم من المثبت': { en: 'Older than the installed version' },
  'ملغى — رُفض مجدداً': { en: 'Canceled — rejected again' },
  'مرفوض': { en: 'Rejected' },
  'مؤجل — تبعية ناقصة': { en: 'Deferred — missing dependency' },
  'أداة': { en: 'Tool' },
  'ميزة': { en: 'Feature' },
  'بيانات': { en: 'Data' },
  'محتوى': { en: 'Content' },
  'إعداد': { en: 'Config' },
  'الصق حزمة التطوير (JSON) أولاً.': { en: 'Paste the development package (JSON) first.' },
  'إلغاء إداري من بيئة التحديثات': { en: 'Administrative cancellation from the updates environment' },
  'بيئة استقبال التحديثات': { en: 'Updates intake environment' },
  'أول ما يستقبل أي تطوير قادم من أي منصة: تحليل، مقارنة بالموجود، تطبيق الزيادة فقط، وإبقاء الملغي ملغياً — دون لمس بيانات المستخدمين.': { en: 'It takes any development coming from any platform: analyse it, compare it with what exists, apply only the addition and keep canceled items canceled — without touching user data.' },
  'استقبال حزمة تطوير (JSON)': { en: 'Receive a development package (JSON)' },
  'إدراج مثال جاهز': { en: 'Insert a ready example' },
  'صيغة الحزمة المتوقعة': { en: 'Expected package format' },
  'كل عنصر: id ثابت، وkind (tool/feature/data/content/config)، وversion تصاعدي، وعنوانان، وpayload بيانات تصريحية.': { en: 'Each item: a stable id, a kind (tool/feature/data/content/config), an increasing version, two titles and a declarative payload.' },
  'حقل packageId معرّف فريد للحزمة عند المنصة المصدر، وحقل platform اسم المنصة.': { en: 'The packageId field is a unique identifier of the package at the source platform, and platform is the platform name.' },
  'لا يُثبَّت إلا الجديد فعلاً أو الأحدث فعلاً؛ نفس المحتوى يُتجاهل، والأقدم يُتجاهل.': { en: 'Only genuinely new or genuinely newer items are installed; identical content and older versions are ignored.' },
  'أي عنصر أُلغي سابقاً يُرفض تلقائياً مهما عاد، وأي حمولة تشير لتخزين المستخدمين تُرفض.': { en: 'Any previously canceled item is rejected automatically however it returns, and any payload touching user storage is rejected.' },
  'لا توجد تطويرات مثبتة بعد. استقبل حزمة أولاً.': { en: 'No developments installed yet. Receive a package first.' },
  'الحمولة': { en: 'Payload' },
  'لا توجد تطويرات ملغاة. ما تلغيه هنا لا يعود من أي منصة.': { en: 'No canceled developments. What you cancel here will never come back from any platform.' },
  'لم تُستقبل أي حزمة بعد.': { en: 'No package has been received yet.' },
  'نسخة منقحة': { en: 'Revised version' },
  'لا عناصر': { en: 'No items' },
  'حزمة مستقبلة من قبل بنفس المحتوى — لا جديد': { en: 'A package with identical content was received before — nothing new' },
  'نتيجة التحليل (لم يُكتب شيء)': { en: 'Analysis result (nothing was written)' },
  'تقرير الاستقبال': { en: 'Intake report' },
  'العنصر': { en: 'Item' },
  'القرار': { en: 'Decision' },
  'التفاصيل': { en: 'Details' },
  'بيانات المستخدمين لم تُلمس': { en: 'User data was not touched' },
  'رُدّت بيانات المستخدمين بعد محاولة لمسها': { en: 'User data was blocked after an attempt to touch it' },
  'تحليل مسبق فقط': { en: 'Pre-analysis only' },
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
