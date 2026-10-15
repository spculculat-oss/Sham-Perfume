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
