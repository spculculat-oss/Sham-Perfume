import { aiText } from './aiPacks';
import type { SupportedLanguage } from '../types/i18n';

/**
 * Phase 4 (4/n) — units and short laboratory/shop labels.
 *
 * A handful of screenshots-worth of text (the currency unit, millilitre marks,
 * "edit"/"cancel", the marketplace counters, the spray-simulator readouts) used
 * to be typed straight into JSX in Arabic, so every language saw Arabic.
 *
 * Every entry carries `en`, so the resolver can never fall back to Arabic for a
 * non-Arabic visitor: language -> English -> Arabic -> key.
 */
const PACK = {
  // ---- units & currency -------------------------------------------------
  currency_egp: {
    ar: 'جنيه',
    en: 'EGP',
    fr: 'EGP',
    es: 'EGP',
    it: 'EGP',
    de: 'EGP',
    ru: 'EGP',
    zh: 'EGP',
    tr: 'EGP',
    fa: 'پوند',
  },
  unit_ml: { ar: 'مل', en: 'ml', fr: 'ml', es: 'ml', it: 'ml', de: 'ml', ru: 'мл', zh: '毫升', tr: 'ml', fa: 'میلی‌لیتر' },
  unit_tools: { ar: 'أداة', en: 'tools', fr: 'outils', es: 'herramientas', it: 'strumenti', de: 'Tools', ru: 'инструментов', zh: '个工具', tr: 'araç', fa: 'ابزار' },
  unit_activities: { ar: 'نشاط', en: 'activities', fr: 'activités', es: 'actividades', it: 'attività', de: 'Aktivitäten', ru: 'активностей', zh: '条动态', tr: 'aktivite', fa: 'فعالیت' },
  unit_orders: { ar: 'طلب', en: 'orders', fr: 'commandes', es: 'pedidos', it: 'ordini', de: 'Bestellungen', ru: 'заказов', zh: '个订单', tr: 'sipariş', fa: 'سفارش' },

  // ---- generic actions --------------------------------------------------
  edit: { ar: 'تعديل', en: 'Edit', fr: 'Modifier', es: 'Editar', it: 'Modifica', de: 'Bearbeiten', ru: 'Изменить', zh: '编辑', tr: 'Düzenle', fa: 'ویرایش' },
  save_edit: { ar: 'حفظ التعديل', en: 'Save changes', fr: 'Enregistrer', es: 'Guardar cambios', it: 'Salva modifiche', de: 'Änderungen speichern', ru: 'Сохранить', zh: '保存修改', tr: 'Değişiklikleri kaydet', fa: 'ذخیره تغییرات' },
  cancel: { ar: 'إلغاء', en: 'Cancel', fr: 'Annuler', es: 'Cancelar', it: 'Annulla', de: 'Abbrechen', ru: 'Отмена', zh: '取消', tr: 'İptal', fa: 'لغو' },
  close: { ar: 'إغلاق', en: 'Close', fr: 'Fermer', es: 'Cerrar', it: 'Chiudi', de: 'Schließen', ru: 'Закрыть', zh: '关闭', tr: 'Kapat', fa: 'بستن' },
  close_menu: { ar: 'إغلاق القائمة', en: 'Close menu', fr: 'Fermer le menu', es: 'Cerrar el menú', it: 'Chiudi il menu', de: 'Menü schließen', ru: 'Закрыть меню', zh: '关闭菜单', tr: 'Menüyü kapat', fa: 'بستن منو' },
  hide: { ar: 'إخفاء', en: 'Hide', fr: 'Masquer', es: 'Ocultar', it: 'Nascondi', de: 'Ausblenden', ru: 'Скрыть', zh: '隐藏', tr: 'Gizle', fa: 'پنهان' },
  admin_panel: { ar: 'الإدارة', en: 'Admin', fr: 'Administration', es: 'Administración', it: 'Amministrazione', de: 'Verwaltung', ru: 'Админка', zh: '管理', tr: 'Yönetim', fa: 'مدیریت' },
  admin_panel_title: { ar: 'لوحة تحكم الإدارة', en: 'Administration dashboard', fr: 'Tableau de bord admin', es: 'Panel de administración', it: 'Pannello di amministrazione', de: 'Verwaltungs-Dashboard', ru: 'Панель администратора', zh: '管理控制台', tr: 'Yönetim paneli', fa: 'داشبورد مدیریت' },
  approved: { ar: 'معتمد', en: 'Approved', fr: 'Approuvé', es: 'Aprobado', it: 'Approvato', de: 'Genehmigt', ru: 'Одобрено', zh: '已批准', tr: 'Onaylı', fa: 'تأییدشده' },
  certified: { ar: 'المعتمد', en: 'Certified', fr: 'Certifié', es: 'Certificado', it: 'Certificato', de: 'Zertifiziert', ru: 'Утверждено', zh: '已认证', tr: 'Onaylı', fa: 'تأییدشده' },
  sold_out: { ar: 'نفذ', en: 'Sold out', fr: 'Épuisé', es: 'Agotado', it: 'Esaurito', de: 'Ausverkauft', ru: 'Нет в наличии', zh: '售罄', tr: 'Tükendi', fa: 'ناموجود' },

  // ---- header dropdown ---------------------------------------------------
  group_tools_desc: {
    ar: 'جميع أدوات الحسابات المعملية - الكيمياء، المخاليط، والتكلفة',
    en: 'All laboratory calculation tools — chemistry, blends and costing',
  },
  group_explore_desc: {
    ar: 'مكتبة العطور، الخامات، الإخباريات، والأدلة المرجعية',
    en: 'Library of perfumes, raw materials, news and reference guides',
  },
  group_home_desc: { ar: 'العودة للصفحة الرئيسية', en: 'Back to the home hub' },
  group_ai_desc: {
    ar: 'خبير المعمل الذكي بالذكاء الاصطناعي',
    en: 'The laboratory’s AI perfumery expert',
  },

  // ---- marketplace / merchant workspace ----------------------------------
  requests_col: { ar: 'الطلبات', en: 'Requests' },
  company_col: { ar: 'الشركة', en: 'Company' },
  margin_col: { ar: 'هامش', en: 'Margin' },
  products_col: { ar: 'المنتجات', en: 'Products' },
  revenue_col: { ar: 'الإيرادات', en: 'Revenue' },
  channels_col: { ar: 'القنوات', en: 'Channels' },
  actions_col: { ar: 'الإجراءات', en: 'Actions' },
  example_oud: { ar: 'عطر عود', en: 'Oud perfume' },
  product_name_ar: { ar: 'اسم المنتج عربي', en: 'Product name (Arabic)' },
  product_name_en: { ar: 'اسم المنتج English', en: 'Product name (English)' },
  no_notes: { ar: 'لا توجد ملاحظات', en: 'No notes yet' },
  payment: { ar: 'الدفع', en: 'Payment' },
  platform_profit: { ar: 'ربح المنصة', en: 'Platform profit' },
  wholesale_price: { ar: 'سعر الجملة', en: 'Wholesale price' },
  offer_price: { ar: 'سعر العرض للزبون', en: 'Customer offer price' },
  wholesale_x125: { ar: 'سعر الجملة × 1.25', en: 'Wholesale × 1.25' },
  platform_share_25: { ar: '٢٥٪ من سعر الجملة', en: '25% of the wholesale price' },
  times_125: { ar: '× ١.٢٥', en: '× 1.25' },
  pct_25: { ar: '٢٥٪', en: '25%' },
  top_profit: { ar: 'أعلى ربح', en: 'Highest profit' },
  golden_size: { ar: 'الحجم الذهبي', en: 'Golden size' },

  category_label: { ar: 'التصنيف', en: 'Category' },
  unit_label: { ar: 'الوحدة', en: 'Unit' },
  cat_perfumes: { ar: 'عطور', en: 'Perfumes' },
  cat_materials: { ar: 'خامات', en: 'Raw materials' },
  cat_tools: { ar: 'أدوات', en: 'Tools' },
  cat_packaging: { ar: 'تغليف', en: 'Packaging' },
  cat_other: { ar: 'غير ذلك', en: 'Other' },
  u_bottle: { ar: 'زجاجة', en: 'Bottle' },
  u_liter: { ar: 'لتر', en: 'Litre' },
  u_gram: { ar: 'جرام', en: 'Gram' },
  u_set: { ar: 'مجموعة', en: 'Set' },
  u_piece: { ar: 'قطعة', en: 'Piece' },
  platform_margin_label: { ar: 'هامش المنصة', en: 'Platform margin' },
  with_pct: { ar: 'مع', en: 'with' },

  // ---- spray simulator ---------------------------------------------------
  sim_tagline: {
    ar: 'محاكاة خروج العطر وثباته على مسام الجلد والتبخر الزمني (Atomizer ➔ Skin Fixation ➔ Evaporation)',
    en: 'Simulating how the perfume leaves the atomizer, fixes on the skin and evaporates over time (Atomizer ➔ Skin Fixation ➔ Evaporation)',
  },
  skin_residue: { ar: 'رسو في الطبقة الدهنية', en: 'Anchoring in the lipid layer' },
  air_aura: { ar: 'الهالة العطرية في الجو', en: 'Airborne scent aura' },
  evap_legend: { ar: 'الدليل اللوني لسرعة تطاير الجزيئات', en: 'Molecular evaporation legend' },
  alcohol_evaporated: { ar: 'تبخر الكحول بالكامل 💨', en: 'Alcohol fully evaporated 💨' },
  alcohol_flash: { ar: 'وميض تبخر سريع', en: 'Fast evaporation flash' },
  emissive_active: { ar: 'انبعاث فوار نشط', en: 'Active effervescent release' },
  velvet_drift: { ar: 'تطاير مخملي هادئ', en: 'Calm velvet drift' },
  sillage_huge: { ar: 'فوحان خارق للمكان', en: 'Room-filling sillage' },
  aura_elegant: { ar: 'هالة شخصية أنيقة', en: 'Elegant personal aura' },
  skin_close: { ar: 'ثبات ملاصق للبشرة', en: 'Close-to-skin tenacity' },
  tier_top: { ar: 'قمة (Top Notes)', en: 'Top notes' },
  tier_heart: { ar: 'قلب (Heart Notes)', en: 'Heart notes' },
  tier_base: { ar: 'قاعدة (Base Notes)', en: 'Base notes' },
  tl_spray: { ar: 'لحظة الرش', en: 'Spray moment' },
  tl_top: { ar: 'القمة', en: 'Top' },
  tl_heart: { ar: 'القلب', en: 'Heart' },
  tl_base: { ar: 'القاعدة', en: 'Base' },
  tl_drydown: { ar: 'الدراي داون', en: 'Dry-down' },
  tl_trail: { ar: 'أثر دائم', en: 'Lasting trail' },
} as const;

export const UI_TEXT = PACK;

export type UiTextKey = keyof typeof UI_TEXT;

/** Resolve a UI label for the active language (language -> English -> Arabic -> key). */
export function uiLabel(key: UiTextKey, lang: SupportedLanguage = 'ar'): string {
  const entry: Partial<Record<SupportedLanguage, string>> = UI_TEXT[key];
  return entry[lang] || aiText(lang, entry.en) || entry.en || entry.ar || key;
}
