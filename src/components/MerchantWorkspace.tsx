import React, { useState, useMemo } from 'react';
import {
  Package,
  ShoppingBag,
  DollarSign,
  TrendingUp,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Search,
  Edit3,
  Trash2,
  CheckCircle,
  XCircle,
  Eye,
  RefreshCw,
  Ban,
  Settings,
  Shield,
  Clock,
  AlertCircle,
  Star,
  Save,
} from 'lucide-react';
import { SupportedLanguage } from '../types/i18n';
import { LText, loc, makeT } from '../لغات/localize';
import { uiLabel } from '../لغات/uiTextL10n';
import {
  getMerchantById,
  updateMerchant,
  getMerchantProducts,
  saveMerchantProduct,
  updateMerchantProduct,
  deleteMerchantProduct,
  getOrdersByMerchant,
  saveOrder,
  updateOrderStatus,
} from '../utils/merchantDataStore';
import { PLATFORM_MARGIN_PERCENT, calculateRetailPrice } from '../config/margin';

const S: Record<string, LText> = {
  title: { ar:'لوحة التاجر', en:'Merchant Workspace', fr:'Espace Marchand', es:'Espacio Comerciante', it:'Spazio Mercante', de:'Händler Arbeitsbereich', ru:'Рабочее место Торговца', zh:'商家工作空间', tr:'Ticaretçi Çalışma Alanı', fa:'فضای کاری تجار' },
  dashboard: { ar:'لوحة القيادة', en:'Dashboard', fr:'Tableau de Bord', es:'Panel de Control', it:'Dashboard', de:'Dashboard', ru:'Панель Управления', zh:'仪表盘', tr:'Dashboard', fa:'طرح مدیریت' },
  my_products: { ar:'منتجاتي', en:'My Products', fr:'Mes Produits', es:'Mis Productos', it:'I Miei Prodotti', de:'Meine Produkte', ru:'Мои Продукты', zh:'我的产品', tr:'Ürünlerim', fa:'محصولات من' },
  incoming_orders: { ar:'الطلبات الواردة', en:'Incoming Orders', fr:'Commandes Entrantes', es:'Pedidos Entrantes', it:'Ordini In Arrivo', de:'Eingehende Bestellungen', ru:'Входящие Заказы', zh:' incoming订单', tr:'Gelen Siparişler', fa:'سفارشات ورودی' },
  stats_orders: { ar:'إجمالي الطلبات', en:'Total Orders', fr:'Total Commandes', es:'Total Pedidos', it:'Totale Ordini', de:'Gesamt Bestellungen', ru:'Всего Заказов', zh:'订单总数', tr:'Toplam Sipariş', fa:'تعداد کل سفارشات' },
  stats_revenue: { ar:'إجمالي الإيرادات', en:'Total Revenue', fr:'Revenu Total', es:'Ingreso Total', it:'Ricavi Totali', de:'Gesamtumsatz', ru:'Общий Доход', zh:'总收入', tr:'Toplam Gelir', fa:'تعداد کل درآمد' },
  stats_products: { ar:'إجمالي المنتجات', en:'Total Products', fr:'Total Produits', es:'Total Productos', it:'Totale Prodotti', de:'Gesamt Produkte', ru:'Всего Продуктов', zh:'产品总数', tr:'Toplam Ürün', fa:'تعداد کل محصولات' },
  stats_margin: { ar:'هامش المنصة', en:'Platform Margin', fr:'Marge Plateforme', es:'Margen Plataforma', it:'Margine Piattaforma', de:'Plattformmarge', ru:'Маржа Платформы', zh:'平台利润率', tr:'Platform Kârı', fa:'حاشیه پلتفرم' },
  add_product: { ar:'إضافة منتج جديد', en:'Add New Product', fr:'Ajouter Nouveau Produit', es:'Añadir Nuevo Producto', it:'Aggiungi Nuovo Prodotto', de:'Neues Produkt Hinzufügen', ru:'Добавить Новый Продукт', zh:'添加新产品', tr:'Yeni Ürün Ekle', fa:'افزودن محصول جدید' },
  product_name_ar: { ar:'اسم المنتج (عربي)', en:'Product Name (Arabic)', fr:'Nom du Produit (Arabe)', es:'Nombre del Producto (Árabe)', it:'Nome del Prodotto (Arabo)', de:'Produktname (Arabisch)', ru:'Название Продукта (Арабский)', zh:'产品名称 (阿拉伯文)', tr:'Ürün Adı (Arapça)', fa:'نام محصول (عربی)' },
  product_name_en: { ar:'اسم المنتج (إنجليزي)', en:'Product Name (English)', fr:'Nom du Produit (Anglais)', es:'Nombre del Producto (Inglés)', it:'Nome del Prodotto (Inglese)', de:'Produktname (Englisch)', ru:'Название Продукта (Английский)', zh:'产品名称 (英文)', tr:'Ürün Adı (İngilizce)', fa:'نام محصول (انگلیسی)' },
  product_category: { ar:'التصنيف', en:'Category', fr:'Catégorie', es:'Categoría', it:'Categoria', de:'Kategorie', ru:'Категория', zh:'分类', tr:'Kategori', fa:'دسته‌بندی' },
  product_unit: { ar:'الوحدة', en:'Unit', fr:'Unité', es:'Unidad', it:'Unità', de:'Einheit', ru:'Единица', zh:'单位', tr:'Birim', fa:'واحد' },
  product_cost_price: { ar:'سعر الجملة (للتاجر)', en:'Wholesale Price (for merchant)', fr:'Prix de Gros (pour marchand)', es:'Precio al Mayor (para comerciante)', it:'Prezzo all\'Ingresso (per mercante)', de:'Großhandelspreis (für Händler)', ru:'Оптовая Цена (для торговца)', zh:'批发价 (给商家)', tr:'Toplam Fiyat (ticaretçi için)', fa:'قیمت پخشی (برای تجار)' },
  product_retail_price: { ar:'سعر العرض للزبون (مع ٢٥٪)', en:'Retail Price (shown to customer + 25%)', fr:'Prix de Détail (affiché au client + 25%)', es:'Precio de Detalle (mostrado al cliente + 25%)', it:'Prezzo al Dettaglio (mostrato al cliente + 25%)', de:'Verkaufspreis (angezeigt dem Kunden + 25%)', ru:'Цена Розницы (показывается клиенту + 25%)', zh:'零售价 (显示给客户 +25%)', tr:'Perakende Fiyatı (Müşteriye gösterilen + %25)', fa:'قیمت خرده‌فروشی (نمایش داده شده به مشتری + ۲۵٪)' },
  product_stock: { ar:'الكمية المتاحة', en:'Available Stock', fr:'Stock Disponible', es:'Stock Disponible', it:'Stock Disponibile', de:'Verfügbarer Bestand', ru:'Доступный Запас', zh:'可用库存', tr:'Mevcut Stok', fa:'موجودی مشخص' },
  product_min_order: { ar:'أقل كمية طلب', en:'Minimum Order Quantity', fr:'Quantité Minimum de Commande', es:'Cantidad Mínima de Pedido', it:'Quantità Minimum di Ordine', de:'Mindestbestellmenge', ru:'Минимальный Объем Заказа', zh:'最小订购量', tr:'Minimum Sipariş Miktarı', fa:'حداقل تعداد سفارش' },
  product_status: { ar:'حالة المنتج', en:'Product Status', fr:'Statut du Produit', es:'Estado del Producto', it:'Stato del Prodotto', de:'Produktzustand', ru:'Статус Продукта', zh:'产品状态', tr:'Ürün Durumu', fa:'وضعیت محصول' },
  status_pending: { ar:'في الانتظار للموافقة', en:'Pending Approval', fr:'En Attente d\'Approbation', es:'Esperando Aprobación', it:'In Attesa di Approvazione', de:'Zur Genehmigung Ausstehend', ru:'В Ожидании Одобрения', zh:'等待审批', tr:'Onay Bekliyor', fa:'در انتظار تایید' },
  status_approved: { ar:'معتمد ومعرض', en:'Approved & Listed', fr:'Approuvé & Affiché', es:'Aprobado & Mostrado', it:'Approvato & Visualizzato', de:'Genehmigt & Angezeigt', ru:'Одобрен и Выведен', zh:'已批准并展示', tr:'Onaylı ve Listelenmiş', fa:'تایید شده و نمایش داده شده' },
  status_rejected: { ar:'مرفوض', en:'Rejected', fr:'Rejeté', es:'Rechazado', it:'Rifiutato', de:'Abgelehnt', ru:'Отклонен', zh:'已拒绝', tr:'Reddedilmiş', fa:'رد شده' },
  no_products: { ar:'لا توجد منتجات حالياً', en:'No products yet', fr:'Pas encore de produits', es:'Aún no hay productos', it:'Nessun prodotto ancora', de:'Noch keine Produkte', ru:'Пока нет продуктов', zh:'暂无产品', tr:'Henüz ürün yok', fa:'هنوز محصولی نیست' },
  add_first_product: { ar:'أضف منتجاً لأول مرة', en:'Add your first product', fr:'Ajoutez votre premier produit', es:'Añade tu primer producto', it:'Aggiungi il tuo primo prodotto', de:'Füge dein erstes Produkt hinzu', ru:'Добавь свой первый продукт', zh:'添加您的第一个产品', tr:'İlk ürününüzü ekleyin', fa:'اول محصول خود را اضافه کنید' },
  orders_title: { ar:'الطلبات الواردة', en:'Incoming Orders', fr:'Commandes Entrantes', es:'Pedidos Entrantes', it:'Ordini In Arrivo', de:'Eingehende Bestellungen', ru:'Входящие Заказы', zh:'Incoming订单', tr:'Gelen Siparişler', fa:'سفارشات ورودی' },
  order_number: { ar:'رقم الطلب', en:'Order Number', fr:'Numéro de Commande', es:'Número de Pedido', it:'Numero di Ordine', de:'Bestellnummer', ru:'Номер Заказа', zh:'订单号', tr:'Sipariş Numarası', fa:'شماره سفارش' },
  order_customer: { ar:'الزبون', en:'Customer', fr:'Client', es:'Cliente', it:'Cliente', de:'Kunde', ru:'Клиент', zh:'客户', tr:'Müşteri', fa:'مشتری' },
  order_items: { ar:'المنتجات', en:'Items', fr:'Articles', es:'Artículos', it:'Articoli', de:'Artikel', ru:'Товары', zh:'商品', tr:'Ürünler', fa:'محصولات' },
  order_qty: { ar:'الكمية', en:'Quantity', fr:'Quantité', es:'Cantidad', it:'Quantità', de:'Menge', ru:'Количество', zh:'数量', tr:'Miktar', fa:'تعداد' },
  order_retail_price: { ar:'السعر للزبون', en:'Price for Customer', fr:'Prix pour Client', es:'Precio para Cliente', it:'Prezzo per Cliente', de:'Preis für Kunde', ru:'Цена для Клиента', zh:'客户价格', tr:'Müşteri Fiyatı', fa:'قیمت برای مشتری' },
  order_total_retail: { ar:'الإجمالي (يدفع الزبون)', en:'Total (customer pays)', fr:'Total (le client paie)', es:'Total (el cliente paga)', it:'Totale (il cliente paga)', de:'Gesamt (Kunde zahlt)', ru:'Итого (клиент платит)', zh:'总计 (客户支付)', tr:'Toplam (müşteri öder)', fa:'سرمایه (مشتری پرداخت می‌کند)' },
  order_platform_revenue: { ar:'ربح المنصة (٢٥٪)', en:'Platform Revenue (25%)', fr:'Revenu Plateforme (25%)', es:'Ingreso Plataforma (25%)', it:'Guadagno Piattaforma (25%)', de:'Plattform-Erlös (25%)', ru:'Доход Платформы (25%)', zh:'平台利润 (25%)', tr:'Platform Geliri (%25)', fa:'منابع پلتفرم (۲۵٪)' },
  order_cost_to_merchant: { ar:'يستلم التاجر', en:'Merchant receives', fr:'Marchand reçoit', es:'Comerciante recibe', it:'Mercante riceve', de:'Händler erhält', ru:'Торговец получает', zh:'商家收到', tr:'Ticaretçi alır', fa:'تجار دریافت می‌کند' },
  order_status: { ar:'الحالة', en:'Status', fr:'Statut', es:'Estado', it:'Stato', de:'Status', ru:'Статус', zh:'状态', tr:'Durum', fa:'وضعیت' },
  order_confirm: { ar:'تأكيد', en:'Confirm', fr:'Confirmer', es:'Confirmar', it:'Conferma', de:'Bestätigen', ru:'Подтвердить', zh:'确认', tr:'Onayla', fa:'تأیید' },
  order_cancel: { ar:'إلغاء', en:'Cancel', fr:'Annuler', es:'Cancelar', it:'Annulla', de:'Stornieren', ru:'Отменить', zh:'取消', tr:'İptal', fa:'لغو' },
  confirm_dialog_title: { ar:'تأكيد الطلب', en:'Confirm Order', fr:'Confirmer Commande', es:'Confirmar Pedido', it:'Conferma Ordine', de:'Bestellung Bestätigen', ru:'Подтвердить Заказ', zh:'确认订单', tr:'Siparişi Onayla', fa:'تأیید سفارش' },
  confirm_dialog_msg: { ar:'هل تريد تأكيد تنفيذ هذا الطلب؟ سيعرض الزبون سعر البيع وسيتم إشعار التاجر.', en:'Do you want to confirm this order? The customer will see the retail price and the merchant will be notified.', fr:'Voulez-vous confirmer cette commande? Le client verra le prix de détail et le marchand sera notifié.', es:'¿Quieres confirmar este pedido? El cliente verá el precio de detalle y el comerciante será notificado.', it:'Vuoi confermare questo ordine? Il cliente vedrà il prezzo al dettaglio e il mercante sarà notificato.', de:'Möchten Sie diese Bestellung bestätigen? Der Kunde sieht den Verkaufspreis und der Händler wird benachrichtigt.', ru:'Вы хотите подтвердить этот заказ? Клиент увидит розничную цену и торговец будет уведомлен.', zh:'是否确认此订单？客户将看到零售价，商家将被通知。', tr:'Bu siparişi onaylıyor musunuz? Müşteri perakende fiyatını görecek ve ticaretçi bilgilendirilecek.', fa:'آیا می‌خواهید این سفارش را تأیید کنید؟ مشتری قیمت خرده‌فروشی را خواهد دید و تجار مطلع خواهد شد.' },
  pending: { ar:'في الانتظار', en:'Pending', fr:'En attente', es:'Pendiente', it:'In attesa', de:'Ausstehend', ru:'Ожидание', zh:'待处理', tr:'Beklemede', fa:'در انتظار' },
  confirmed: { ar:'مؤكد', en:'Confirmed', fr:'Confirmé', es:'Confirmado', it:'Confermato', de:'Bestätigt', ru:'Подтвержден', zh:'已确认', tr:'Onaylandı', fa:'تأیید شده' },
  processing: { ar:'يتم المعالجة', en:'Processing', fr:'En cours', es:'En proceso', it:'In elaborazione', de:'In Bearbeitung', ru:'В обработке', zh:'处理中', tr:'İşleniyor', fa:'در تر)' },
  shipped: { ar:'مرسل', en:'Shipped', fr:'Expédié', es:'Enviado', it:'Spedito', de:'Versendet', ru:'Отправлен', zh:'已发货', tr:'Gönderildi', fa:'ارسال شده' },
  delivered: { ar:'تسليم', en:'Delivered', fr:'Livré', es:'Entregado', it:'Consegnato', de:'Zugegangen', ru:'Доставлен', zh:'已送达', tr:'Teslim Edildi', fa:'تحویل شده' },
  completed: { ar:'مكتمل', en:'Completed', fr:'Terminé', es:'Completado', it:'Completato', de:'Abgeschlossen', ru:'Завершен', zh:'已完成', tr:'Tamamlandı', fa:'تکمیل شده' },
  cancelled: { ar:'ملغى', en:'Cancelled', fr:'Annulé', es:'Cancelado', it:'Annullato', de:'Storniert', ru:'Отменен', zh:'已取消', tr:'İptal Edildi', fa:'لغو شده' },
  cancel_dialog_title: { ar:'إلغاء الطلب', en:'Cancel Order', fr:'Annuler Commande', es:'Cancelar Pedido', it:'Annulla Ordine', de:'Bestellung Stornieren', ru:'Отменить Заказ', zh:'取消订单', tr:'Siparişi İptal Et', fa:'لغو سفارش' },
  cancel_dialog_msg: { ar:'هل تريد إلغاء هذا الطلب؟', en:'Do you want to cancel this order?', fr:'Voulez-vous annuler cette commande?', es:'¿Quieres cancelar este pedido?', it:'Vuoi annullare questo ordine?', de:'Möchten Sie diese Bestellung stornieren?', ru:'Вы хотите отменить этот заказ?', zh:'是否取消此订单？', tr:'Bu siparişi iptal etmek istiyor musunuz?', fa:'آیا می‌خواهید این سفارش را لغو کنید؟' },
  profile: { ar:'ملف التاجر', en:'Merchant Profile', fr:'Profil Marchand', es:'Perfil Comerciante', it:'Profilo Mercante', de:'Händlerprofil', ru:'Профиль Торговца', zh:'商家资料', tr:'Ticaretçi Profili', fa:'پروفایل تجار' },
  company_name_ar: { ar:'اسم الشركة (عربي)', en:'Company Name (Arabic)', fr:'Nom de l\'Entreprise (Arabe)', es:'Nombre de la Empresa (Árabe)', it:'Nome dell\'Azienda (Arabo)', de:'Firmenname (Arabisch)', ru:'Название Компании (Арабский)', zh:'公司名称 (阿拉伯文)', tr:'Şirket Adı (Arapça)', fa:'نام شرکت (عربی)' },
  company_name_en: { ar:'اسم الشركة (إنجليزي)', en:'Company Name (English)', fr:'Nom de l\'Entreprise (Anglais)', es:'Nombre de la Empresa (Inglés)', it:'Nome dell\'Azienda (Inglese)', de:'Firmenname (Englisch)', ru:'Название Компании (Английский)', zh:'公司名称 (英文)', tr:'Şirket Adı (İngilizce)', fa:'نام شرکت (انگلیسی)' },
  registration_number: { ar:'رقم السجل التجاري', en:'Registration Number', fr:'Numéro d\'Enregistrement', es:'Número de Registro', it:'Numero di Registrazione', de:'Registrierungsnummer', ru:'Регистрационный Номер', zh:'注册号', tr:'Kayıt Numarası', fa:'شماره ثبت' },
  tax_id: { ar:'الرقم الضريبي', en:'Tax ID', fr:'Numéro Fiscal', es:'Identificación Fiscal', it:'Identificativo Fiscale', de:'Steuernummer', ru:'Налоговый ID', zh:'税号', tr:'Vergi Kimliği', fa:'شماره مالیاتی' },
  email: { ar:'البريد الإلكتروني', en:'Email', fr:'Email', es:'Correo', it:'Email', de:'E-Mail', ru:'Эл. почта', zh:'邮箱', tr:'E-posta', fa:'ایمیل' },
  phone: { ar:'الهاتف', en:'Phone', fr:'Téléphone', es:'Teléfono', it:'Telefono', de:'Telefon', ru:'Телефон', zh:'电话', tr:'Telefon', fa:'تلفن' },
  whatsapp: { ar:'واتساب', en:'WhatsApp', fr:'WhatsApp', es:'WhatsApp', it:'WhatsApp', de:'WhatsApp', ru:'WhatsApp', zh:'微信', tr:'WhatsApp', fa:'واتساب' },
  banking_info: { ar:'معلومات الحساب البنكي (لتصريف الأرباح)', en:'Banking Info (for payout)', fr:'Infos Bancaires (pour versement)', es:'Info Bancaria (para pago)', it:'Info Bancarie (per pagamento)', de:'Bankdaten (für Auszahlung)', ru:'Банковская Информация (для выплаты)', zh:'银行信息 (用于付款)', tr:'Bank info (ödeme için)', fa:'اطلاعات حساب بانکی (برای پرداخت)' },
  bank_name: { ar:'اسم البنك', en:'Bank Name', fr:'Nom de la Banque', es:'Nombre del Banco', it:'Nome della Banca', de:'Bankname', ru:'Название Банка', zh:'银行名称', tr:'Bank Adı', fa:'نام بانک' },
  account_number: { ar:'رقم الحساب', en:'Account Number', fr:'Numéro de Compte', es:'Número de Cuenta', it:'Numero di Conto', de:'Kontonummer', ru:'Номер Счета', zh:'账号', tr:'Hesap Numarası', fa:'شماره حساب' },
  account_holder: { ar:'اسم صاحب الحساب', en:'Account Holder', fr:'Titulaire du Compte', es:'Titular de la Cuenta', it:'Titolare del Conto', de:'Kontoinhaber', ru:'Владелец Счета', zh:'账户持有人', tr:'Hesap Sahibi', fa:'صاحب حساب' },
  save_profile: { ar:'حفظ التغييرات', en:'Save Changes', fr:'Enregistrer Modifications', es:'Guardar Cambios', it:'Salva Modifiche', de:'Änderungen Speichern', ru:'Сохранить Изменения', zh:'保存更改', tr:'Değişiklikleri Kaydet', fa:'ذخیره تغییرات' },
  profile_saved: { ar:'تم حفظ التغييرات بنجاح', en:'Changes saved successfully', fr:'Modifications enregistrées avec succès', es:'Cambios guardados con éxito', it:'Modifiche salvate con successo', de:'Änderungen erfolgreich gespeichert', ru:'Изменения успешно сохранены', zh:'更改成功保存', tr:'Değişiklikler başarıyla kaydedildi', fa:'تغییرات با موفقیت ذخیره شده‌اند' },
  admin_warning: { ar:'هذا الجزء فقط للإدارة', en:'This section is for admin only', fr:'Cette section est pour les admins seulement', es:'Esta sección es solo para administradores', it:'Questa sezione è solo per amministratori', de:'Dieser Abschnitt ist nur für Admins', ru:'Этот раздел только для администрации', zh:'此部分仅供管理员使用', tr:'Bu bölüm sadece yöneticiler içindir', fa:'این بخش فقط برای مدیران است' },
  margin_info: { ar:'هامش المنصة: ٢٥٪ — سعر الزبون = سعر الجملة × ١.٢٥', en:'Platform margin: 25% — customer price = wholesale × 1.25', fr:'Marge plateforme: 25% — prix client = gros × 1.25', es:'Margen plataforma: 25% — precio cliente = mayor × 1.25', it:'Margine piattaforma: 25% — prezzo cliente = attingente × 1.25', de:'Plattformmarge: 25% — Kundenpreis = Großhandel × 1.25', ru:'Маржа платформы: 25% — цена клиента = опт × 1.25', zh:'平台利润: 25% — 客户价格 = 批发价 × 1.25', tr:'Platform kârı: %25 — müşteri fiyatı = toplam × 1.25', fa:'حاشیه پلتفرم: ۲۵٪ — قیمت مشتری = قیمت پخشی × ۱.۲۵' },
};

export const MerchantWorkspace: React.FC<{
  onClose: () => void;
  currentLang: SupportedLanguage;
  merchantId: string;
}> = ({ onClose, currentLang, merchantId }) => {
  const L = makeT(currentLang, S);
  const CUR = uiLabel('currency_egp', currentLang);
  const merchant = useMemo(() => getMerchantById(merchantId), [merchantId]);
  const [activeTab, setActiveTab] = useState<'dashboard'|'products'|'orders'|'profile'>('dashboard');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ nameAr:'', nameEn:'', category:'عطور', unit:'زجةقة', costPrice:0, stock:0, minOrderQty:1, descriptionAr:'', descriptionEn:'' });
  const [editProductId, setEditProductId] = useState<string|null>(null);
  const [editProduct, setEditProduct] = useState({ nameAr:'', nameEn:'', category:'عطور', unit:'زجةقة', costPrice:0, stock:0, minOrderQty:1, descriptionAr:'', descriptionEn:'' });
  const [confirmCancelOrder, setConfirmCancelOrder] = useState<string|null>(null);

  const products = merchantId ? getMerchantProducts(merchantId) : [];
  const orders = merchantId ? getOrdersByMerchant(merchantId) : [];
  const approvedProducts = products.filter(p => p.approvalStatus === 'approved' && p.isActive);

  const totalRevenue = useMemo(() => orders.reduce((sum, o) => sum + o.totalPlatformRevenue, 0), [orders]);
  const totalOrders = orders.length;
  const totalProducts = products.length;
  const approvedCount = products.filter(p => p.approvalStatus === 'approved').length;

  const handleSaveProduct = () => {
    if (!merchantId) return;
    if (editProductId) {
      updateMerchantProduct(editProductId, {
        nameAr: editProduct.nameAr, nameEn: editProduct.nameEn,
        category: editProduct.category, unit: editProduct.unit,
        costPrice: editProduct.costPrice,
        retailPrice: calculateRetailPrice(editProduct.costPrice),
        platformMargin: editProduct.costPrice * (PLATFORM_MARGIN_PERCENT / 100),
        stock: editProduct.stock, minOrderQty: editProduct.minOrderQty,
        descriptionAr: editProduct.descriptionAr, descriptionEn: editProduct.descriptionEn,
        isActive: true, approvalStatus: 'pending' as const,
      });
      setEditProductId(null);
      setShowAddProduct(false);
    } else {
      const product = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        merchantId,
        sku: `SKU-${Date.now()}`,
        nameAr: newProduct.nameAr, nameEn: newProduct.nameEn,
        category: newProduct.category, unit: newProduct.unit,
        costPrice: newProduct.costPrice,
        retailPrice: calculateRetailPrice(newProduct.costPrice),
        platformMargin: newProduct.costPrice * (PLATFORM_MARGIN_PERCENT / 100),
        costCurrency: 'EGP',
        stock: newProduct.stock,
        minOrderQty: newProduct.minOrderQty,
        descriptionAr: newProduct.descriptionAr, descriptionEn: newProduct.descriptionEn,
        imageUrl: undefined,
        isActive: false,
        approvalStatus: 'pending' as const,
        notes: '',
        createdAt: '', updatedAt: '',
      };
      saveMerchantProduct(product);
      setNewProduct({ nameAr:'', nameEn:'', category:'عطور', unit:'زجةقة', costPrice:0, stock:0, minOrderQty:1, descriptionAr:'', descriptionEn:'' });
      setShowAddProduct(false);
    }
  };

  const startEdit = (product: any) => {
    setEditProductId(product.id);
    setEditProduct({
      nameAr: product.nameAr, nameEn: product.nameEn,
      category: product.category, unit: product.unit,
      costPrice: product.costPrice,
      stock: product.stock, minOrderQty: product.minOrderQty,
      descriptionAr: product.descriptionAr, descriptionEn: product.descriptionEn,
    });
    setShowAddProduct(true);
  };

  const handleSaveEdit = () => {
    if (!editProductId || !merchantId) return;
    updateMerchantProduct(editProductId, {
      nameAr: editProduct.nameAr, nameEn: editProduct.nameEn,
      category: editProduct.category, unit: editProduct.unit,
      costPrice: editProduct.costPrice,
      retailPrice: calculateRetailPrice(editProduct.costPrice),
      platformMargin: editProduct.costPrice * (PLATFORM_MARGIN_PERCENT / 100),
      stock: editProduct.stock, minOrderQty: editProduct.minOrderQty,
      descriptionAr: editProduct.descriptionAr, descriptionEn: editProduct.descriptionEn,
      isActive: true, approvalStatus: 'pending' as const,
    });
    setEditProductId(null);
    setShowAddProduct(false);
  };

  const deleteProduct = (id: string) => {
    deleteMerchantProduct(id);
  };

  const confirmOrder = (orderId: string) => {
    updateOrderStatus(orderId, 'confirmed');
  };

  const cancelOrder = (orderId: string) => {
    updateOrderStatus(orderId, 'cancelled');
    setConfirmCancelOrder(null);
  };

  if (!merchant) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-amber-500 mb-3"/>
          <h2 className="text-xl font-bold text-stone-900 mb-2">{L('title')}</h2>
          <p className="text-stone-600">Merchant not found</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-amber-700 text-white rounded-lg">{L('back')}</button>
        </div>
      </div>
    );
  }

  const tabs = [
    { key:'dashboard', label:L('dashboard'), icon:Package },
    { key:'products', label:L('my_products'), icon:ShoppingBag },
    { key:'orders', label:L('incoming_orders'), icon:DollarSign },
    { key:'profile', label:L('profile'), icon:Settings },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-6xl max-h-[95vh] overflow-hidden rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in-95 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-gradient-to-r from-stone-900 to-amber-950 text-white rounded-t-2xl shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/30 flex items-center justify-center text-amber-300 font-bold text-lg">
              {merchant.companyNameAr.slice(0,2)}
            </div>
            <div>
              <h1 className="text-lg font-bold font-serif-luxury">{L('title')}</h1>
              <p className="text-sm text-amber-200/80">{merchant.companyNameAr} — {merchant.companyNameEn}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
            <RefreshCw className="w-4 h-4"/>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-200 bg-stone-50/50 px-6 shrink-0">
          {tabs.map(tab => (
            <button key={tab.key} onClick={()=>setActiveTab(tab.key)}
              className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab===tab.key
                  ? 'bg-amber-100 text-amber-900 font-bold'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}>
              <tab.icon className="w-4 h-4"/>
              {tab.label}
              {tab.key==='dashboard' && (
                <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-700 text-white text-[10px] font-bold">
                  {totalOrders}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { label:L('stats_orders'), value:totalOrders, color:'bg-amber-50 border-amber-200/60 text-amber-900', icon:ShoppingBag },
                  { label:L('stats_revenue'), value:totalRevenue.toLocaleString()+' '+CUR, color:'bg-emerald-50 border-emerald-200/60 text-emerald-900', icon:DollarSign },
                  { label:L('stats_products'), value:`${approvedCount}/${totalProducts}`, color:'bg-blue-50 border-blue-200/60 text-blue-900', icon:Package },
                  { label:L('stats_margin'), value:`${PLATFORM_MARGIN_PERCENT}%`, color:'bg-purple-50 border-purple-200/60 text-purple-900', icon:TrendingUp },
                ].map(s => (
                  <div key={s.label} className={`p-5 rounded-xl border ${s.color}`}>
                    <div className="flex items-center justify-between mb-3">
                      <s.icon className="w-5 h-5 opacity-70"/>
                      <div className="text-2xl font-bold">{s.value}</div>
                    </div>
                    <div className="text-xs font-medium opacity-80">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Margin Info */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-amber-50 to-stone-100 border border-amber-200/60">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-700 flex items-center justify-center text-white shrink-0">
                    <TrendingUp className="w-5 h-5"/>
                  </div>
                  <div>
                    <h3 className="font-bold text-stone-900 mb-1">{L('margin_info')}</h3>
                    <p className="text-sm text-stone-600">
                      {uiLabel('wholesale_price', currentLang)}: <strong>{merchant?.companyNameAr}</strong> ←
                      {uiLabel('offer_price', currentLang)}: <strong>{uiLabel('wholesale_x125', currentLang)}</strong>
                      {uiLabel('platform_profit', currentLang)}: <strong>{uiLabel('platform_share_25', currentLang)}</strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* Recent Orders */}
              <div>
                <h3 className="text-lg font-bold text-stone-900 mb-3">{L('orders_title')} — Recent</h3>
                {orders.length === 0 ? (
                  <div className="p-6 rounded-xl bg-stone-50 border border-stone-200 text-center">
                    <ShoppingBag className="w-10 h-10 mx-auto text-stone-300 mb-3"/>
                    <p className="text-sm text-stone-500">{L('no_products')}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orders.slice(0,5).map(order => (
                      <div key={order.id} className="p-4 rounded-xl border border-stone-200 hover:bg-stone-50 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold text-stone-900">{order.orderNumber}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              order.status==='completed'?'bg-emerald-100 text-emerald-800':
                              order.status==='cancelled'?'bg-red-100 text-red-800':
                              'bg-amber-100 text-amber-800'
                            }`}>{L(`order_${order.status}` as keyof typeof S)}</span>
                          </div>
                          <div className="text-right text-xs text-stone-500">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="space-y-1 text-sm">
                          {order.items.map(item => (
                            <div key={item.productId} className="flex justify-between">
                              <span className="text-stone-700">{item.productNameAr} × {item.qty}</span>
                              <span className="font-mono text-stone-600">{item.totalRetail.toLocaleString()} {CUR}</span>
                            </div>
                          ))}
                          <div className="border-t border-stone-200 mt-2 pt-2 flex justify-between font-bold">
                            <span>{L('order_total_retail')}:</span>
                            <span className="text-emerald-700">{order.subtotalRetail.toLocaleString()} {CUR}</span>
                          </div>
                          <div className="flex justify-between text-xs text-stone-500">
                            <span>{L('order_platform_revenue')}:</span>
                            <span className="text-amber-700 font-bold">{order.totalPlatformRevenue.toLocaleString()} {CUR}</span>
                          </div>
                          <div className="flex justify-between text-xs text-stone-500">
                            <span>{L('order_cost_to_merchant')}:</span>
                            <span className="text-blue-700 font-bold">{order.subtotalCost.toLocaleString()} {CUR}</span>
                          </div>
                        </div>
                        {order.status !== 'completed' && order.status !== 'cancelled' && (
                          <div className="mt-3 flex gap-2">
                            <button onClick={()=>confirmOrder(order.id)} className="flex-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-medium transition-colors">
                              {L('order_confirm')}
                            </button>
                            <button onClick={()=>setConfirmCancelOrder(order.id)} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-colors">
                              {L('order_cancel')}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Active Products */}
              <div>
                <h3 className="text-lg font-bold text-stone-900 mb-3">{L('my_products')} — Active</h3>
                {approvedProducts.length === 0 ? (
                  <div className="p-6 rounded-xl bg-stone-50 border border-stone-200 text-center">
                    <Package className="w-10 h-10 mx-auto text-stone-300 mb-3"/>
                    <p className="text-sm text-stone-500 mb-2">{L('no_products')}</p>
                    <button onClick={()=>setShowAddProduct(true)} className="px-4 py-2 bg-amber-700 text-white rounded-lg text-sm font-medium hover:bg-amber-800 transition-colors">
                      <Plus className="w-4 h-4 inline mr-1"/> {L('add_first_product')}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {approvedProducts.map(product => (
                      <div key={product.id} className="p-4 rounded-xl border border-stone-200 hover:shadow-sm transition-shadow">
                        <div className="flex items-start justify-between mb-2">
                          <div className="font-bold text-stone-900">{product.nameAr}</div>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            {L('status_approved')}
                          </span>
                        </div>
                        <div className="text-xs text-stone-500 mb-2">{product.category} — {product.unit}</div>
                        <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                          <div className="p-2 rounded-lg bg-amber-50 border border-amber-200/40">
                            <div className="text-xs text-stone-500">{L('product_cost_price')}</div>
                            <div className="font-bold text-amber-900 font-mono">{product.costPrice} {CUR}</div>
                          </div>
                          <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200/40">
                            <div className="text-xs text-stone-500">{L('product_retail_price')}</div>
                            <div className="font-bold text-emerald-900 font-mono">{product.retailPrice} {CUR}</div>
                          </div>
                        </div>
                        <div className="flex justify-between text-xs text-stone-500">
                          <span>{L('product_stock')}: {product.stock}</span>
                          <span>{L('product_min_order')}: {product.minOrderQty}</span>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button onClick={()=>startEdit(product)} className="flex-1 px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded text-xs font-medium transition-colors">
                            <Edit3 className="w-3 h-3 inline mr-0.5"/> {uiLabel('edit', currentLang)}
                          </button>
                          <button onClick={()=>deleteProduct(product.id)} className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs font-medium transition-colors">
                            <Trash2 className="w-3 h-3 inline"/>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'products' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-stone-900">{L('my_products')}</h2>
                <button onClick={()=>setShowAddProduct(true)} className="px-4 py-2 bg-amber-700 text-white rounded-xl text-sm font-medium hover:bg-amber-800 transition-colors flex items-center gap-2">
                  <Plus className="w-4 h-4"/> {L('add_product')}
                </button>
              </div>
              {products.length === 0 ? (
                <div className="p-8 rounded-xl bg-stone-50 border border-stone-200 text-center">
                  <Package className="w-12 h-12 mx-auto text-stone-300 mb-3"/>
                  <p className="text-stone-500 mb-3">{L('no_products')}</p>
                  <button onClick={()=>setShowAddProduct(true)} className="px-4 py-2 bg-amber-700 text-white rounded-lg text-sm font-medium hover:bg-amber-800 transition-colors">
                    <Plus className="w-4 h-4 inline mr-1"/> {L('add_first_product')}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {products.map(product => (
                    <div key={product.id} className="p-4 rounded-xl border border-stone-200 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-stone-800 to-amber-800 text-amber-200 flex items-center justify-center font-bold">
                          {product.nameAr.slice(0,1)}
                        </div>
                        <div>
                          <div className="font-bold text-stone-900">{product.nameAr}</div>
                          <div className="text-xs text-stone-500">{product.category} — {product.unit} | SKU: {product.sku}</div>
                          <div className="flex gap-3 mt-1 text-sm">
                            <span className="text-stone-500">{L('product_cost_price')}: <strong className="text-amber-900">{product.costPrice}</strong> {CUR}</span>
                            <span className="text-emerald-700 font-bold">{L('product_retail_price')}: <strong>{product.retailPrice}</strong> {CUR}</span>
                          </div>
                          <div className="text-xs text-stone-500 mt-1">
                            {L('product_stock')}: {product.stock} | {L('product_min_order')}: {product.minOrderQty}
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold mt-1 inline-block ${
                            product.approvalStatus==='approved'?'bg-emerald-100 text-emerald-800':
                            product.approvalStatus==='pending'?'bg-amber-100 text-amber-800':'bg-red-100 text-red-800'
                          }`}>
                            {product.approvalStatus=== 'approved' ? L('status_approved') :
                             product.approvalStatus=== 'pending' ? L('status_pending') : L('status_rejected')}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={()=>startEdit(product)} className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-xs font-medium transition-colors">
                          <Edit3 className="w-3.5 h-3.5 inline mr-0.5"/> {L('edit')}
                        </button>
                        <button onClick={()=>deleteProduct(product.id)} className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-xs font-medium transition-colors">
                          <Trash2 className="w-3.5 h-3.5 inline"/>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-stone-900">{L('orders_title')}</h2>
              {orders.length === 0 ? (
                <div className="p-8 rounded-xl bg-stone-50 border border-stone-200 text-center">
                  <DollarSign className="w-12 h-12 mx-auto text-stone-300 mb-3"/>
                  <p className="text-stone-500">{L('no_products')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map(order => (
                    <div key={order.id} className="p-4 rounded-xl border border-stone-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-stone-900">{order.orderNumber}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            order.status==='completed'?'bg-emerald-100 text-emerald-800':
                            order.status==='cancelled'?'bg-red-100 text-red-800':
                            'bg-amber-100 text-amber-800'
                          }`}>{L(`order_${order.status}` as keyof typeof S)}</span>
                        </div>
                        <span className="text-xs text-stone-500">{new Date(order.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="space-y-1 text-sm">
                        {order.items.map(item => (
                          <div key={item.productId} className="flex justify-between">
                            <span className="text-stone-700">{item.productNameAr} × {item.qty} {item.unit}</span>
                            <span className="font-mono text-stone-600">{item.totalRetail.toLocaleString()} {CUR}</span>
                          </div>
                        ))}
                        <div className="border-t border-stone-200 mt-2 pt-2 flex justify-between font-bold text-sm">
                          <span>{L('order_total_retail')}:</span>
                          <span className="text-emerald-700">{order.subtotalRetail.toLocaleString()} {CUR}</span>
                        </div>
                        <div className="flex justify-between text-xs text-stone-500 mt-1">
                          <span>{L('order_platform_revenue')}: <span className="text-amber-700 font-bold">{order.totalPlatformRevenue.toLocaleString()} {CUR}</span></span>
                          <span>{L('order_cost_to_merchant')}: <span className="text-blue-700 font-bold">{order.subtotalCost.toLocaleString()} {CUR}</span></span>
                        </div>
                      </div>
                      {order.status !== 'completed' && order.status !== 'cancelled' && (
                        <div className="mt-3 flex gap-2">
                          <button onClick={()=>confirmOrder(order.id)} className="flex-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-medium transition-colors">
                            {L('order_confirm')}
                          </button>
                          <button onClick={()=>setConfirmCancelOrder(order.id)} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-colors">
                            {L('order_cancel')}
                          </button>
                        </div>
                      )}
                      {order.status === 'cancelled' && (
                        <p className="text-xs text-red-600 mt-2">{loc(currentLang, {ar:'تم إلغاء هذا الطلب', en:'This order has been cancelled', fr:'Cette commande a été annulée', es:'Este pedido ha sido cancelado', it:'Questo ordine è stato annullato', de:'Diese Bestellung wurde storniert', ru:'Этот заказ был отменен', zh:'此订单已被取消', tr:'Bu sipariş iptal edilmiştir', fa:'این سفارش لغو شده است'})}</p>
                      )}
                      {order.status === 'completed' && (
                        <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3"/>
                          {loc(currentLang, {ar:'اكتمل بنجاح', en:'Completed successfully', fr:'Terminé avec succès', es:'Completado con éxito', it:'Completato con successo', de:'Erfolgreich abgeschlossen', ru:'Успешно завершен', zh:'成功完成', tr:'Başarıyla tamamlandı', fa:'با موفقیت تکمیل شده'})}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-stone-900">{L('profile')}</h2>
              {/* Warning for non-admin */}
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200/60 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5"/>
                <p className="text-xs text-amber-800">{L('admin_warning')}</p>
              </div>

              {/* Company Info */}
              <div className="p-5 rounded-xl border border-stone-200">
                <h3 className="text-sm font-bold text-stone-900 mb-3">{L('profile')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-stone-600 mb-1 block">{L('company_name_ar')}</label>
                    <input value={merchant.companyNameAr} onChange={e=>updateMerchant(merchant.id,{companyNameAr:e.target.value})}
                      className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"/>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-stone-600 mb-1 block">{L('company_name_en')}</label>
                    <input value={merchant.companyNameEn} onChange={e=>updateMerchant(merchant.id,{companyNameEn:e.target.value})}
                      className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"/>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-stone-600 mb-1 block">{L('registration_number')}</label>
                    <input value={merchant.registrationNumber || ''} onChange={e=>updateMerchant(merchant.id,{registrationNumber:e.target.value})}
                      className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"/>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-stone-600 mb-1 block">{L('tax_id')}</label>
                    <input value={merchant.taxId || ''} onChange={e=>updateMerchant(merchant.id,{taxId:e.target.value})}
                      className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"/>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-stone-600 mb-1 block">{L('email')}</label>
                    <input type="email" value={merchant.email} onChange={e=>updateMerchant(merchant.id,{email:e.target.value})}
                      className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"/>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-stone-600 mb-1 block">{L('phone')}</label>
                    <input value={merchant.phone} onChange={e=>updateMerchant(merchant.id,{phone:e.target.value})}
                      className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"/>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-stone-600 mb-1 block">{L('whatsapp')}</label>
                    <input value={merchant.whatsapp || ''} onChange={e=>updateMerchant(merchant.id,{whatsapp:e.target.value})}
                      className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"/>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-stone-600 mb-1 block">{uiLabel('platform_margin_label', currentLang)}: {merchant.marginPercent}%</label>
                    <p className="text-xs text-stone-500 mt-1">{L('margin_info')}</p>
                  </div>
                </div>
              </div>

              {/* Banking Info */}
              <div className="p-5 rounded-xl border border-stone-200">
                <h3 className="text-sm font-bold text-stone-900 mb-3">{L('banking_info')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-stone-600 mb-1 block">{L('bank_name')}</label>
                    <input value={merchant.bankingInfo?.bankName || ''} onChange={e=>updateMerchant(merchant.id,{bankingInfo:{bankName:e.target.value,accountNumber:merchant.bankingInfo?.accountNumber||'',accountHolder:merchant.bankingInfo?.accountHolder||'',iban:merchant.bankingInfo?.iban}})}
                      className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"/>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-stone-600 mb-1 block">{L('account_number')}</label>
                    <input value={merchant.bankingInfo?.accountNumber || ''} onChange={e=>updateMerchant(merchant.id,{bankingInfo:{bankName:merchant.bankingInfo?.bankName||'',accountNumber:e.target.value,accountHolder:merchant.bankingInfo?.accountHolder||'',iban:merchant.bankingInfo?.iban}})}
                      className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"/>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-medium text-stone-600 mb-1 block">{L('account_holder')}</label>
                    <input value={merchant.bankingInfo?.accountHolder || ''} onChange={e=>updateMerchant(merchant.id,{bankingInfo:{bankName:merchant.bankingInfo?.bankName||'',accountNumber:merchant.bankingInfo?.accountNumber||'',accountHolder:e.target.value,iban:merchant.bankingInfo?.iban}})}
                      className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"/>
                  </div>
                </div>
              </div>

              {/* Channels */}
              <div className="p-5 rounded-xl border border-stone-200">
                <h3 className="text-sm font-bold text-stone-900 mb-3">{L('profile')} — Channels</h3>
                <div className="grid grid-cols-3 gap-3">
                  {(['email','whatsapp','phone'] as const).map(ch=>(
                    <div key={ch} className="p-3 rounded-lg bg-stone-50 border border-stone-200 text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        {ch==='email'&&<Mail className="w-4 h-4 text-stone-500"/>}
                        {ch==='whatsapp'&&<MessageSquare className="w-4 h-4 text-stone-500"/>}
                        {ch==='phone'&&<Phone className="w-4 h-4 text-stone-500"/>}
                        <span className="text-xs text-stone-600">{L(`channel_${ch}` as keyof typeof S)}</span>
                      </div>
                      <div className="text-xs font-medium">
                        {merchant.channels[ch] ? <span className="text-emerald-700">{L('channel_active')}</span>
                         : <span className="text-stone-400">{L('channel_inactive')}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <button onClick={onClose} className="px-4 py-2 bg-amber-700 text-white rounded-xl text-sm font-medium hover:bg-amber-800 transition-colors">
                  {L('back')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Add/Edit Product Modal */}
        {(showAddProduct || editProductId) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 p-6">
              <h2 className="text-lg font-bold text-stone-900 mb-4 font-serif-luxury">
                {editProductId ? L('product_name_ar')+' ('+uiLabel('edit', currentLang)+')' : L('add_product')}
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-stone-700">{L('product_name_ar')}</label>
                  <input value={editProductId ? editProduct.nameAr : newProduct.nameAr} onChange={e=>{
                    if(editProductId) setEditProduct({...editProduct, nameAr:e.target.value});
                    else setNewProduct({...newProduct, nameAr:e.target.value});
                  }} className="w-full mt-1 px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"/>
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-700">{L('product_name_en')}</label>
                  <input value={editProductId ? editProduct.nameEn : newProduct.nameEn} onChange={e=>{
                    if(editProductId) setEditProduct({...editProduct, nameEn:e.target.value});
                    else setNewProduct({...newProduct, nameEn:e.target.value});
                  }} className="w-full mt-1 px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"/>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs font-medium text-stone-700">{L('product_category')}</label>
                    <select value={editProductId ? editProduct.category : newProduct.category} onChange={e=>{
                      if(editProductId) setEditProduct({...editProduct, category:e.target.value});
                      else setNewProduct({...newProduct, category:e.target.value});
                    }} className="w-full mt-1 px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300">
                      {['ع스토랑','خامات','أدوات','تغليف','غير ذلك'].map(c=><option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-medium text-stone-700">{L('product_unit')}</label>
                    <select value={editProductId ? editProduct.unit : newProduct.unit} onChange={e=>{
                      if(editProductId) setEditProduct({...editProduct, unit:e.target.value});
                      else setNewProduct({...newProduct, unit:e.target.value});
                    }} className="w-full mt-1 px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300">
                      {['زجةقة','لتر','جرام','مجموعة','قطعة'].map(u=><option key={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-700">{L('product_cost_price')}</label>
                  <input type="number" value={editProductId ? editProduct.costPrice : newProduct.costPrice} onChange={e=>{
                    if(editProductId) setEditProduct({...editProduct, costPrice:parseFloat(e.target.value)||0});
                    else setNewProduct({...newProduct, costPrice:parseFloat(e.target.value)||0});
                  }} className="w-full mt-1 px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"/>
                  <p className="text-[10px] text-stone-400 mt-1">
                    {L('product_retail_price')}: <strong>{((editProductId?editProduct.costPrice:newProduct.costPrice)*1.25).toFixed(2)}</strong> {CUR} ({uiLabel('with_pct', currentLang)} {String(PLATFORM_MARGIN_PERCENT)+'%'})
                  </p>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs font-medium text-stone-700">{L('product_stock')}</label>
                    <input type="number" value={editProductId ? editProduct.stock : newProduct.stock} onChange={e=>{
                      if(editProductId) setEditProduct({...editProduct, stock:parseInt(e.target.value)||0});
                      else setNewProduct({...newProduct, stock:parseInt(e.target.value)||0});
                    }} className="w-full mt-1 px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"/>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-medium text-stone-700">{L('product_min_order')}</label>
                    <input type="number" value={editProductId ? editProduct.minOrderQty : newProduct.minOrderQty} onChange={e=>{
                      if(editProductId) setEditProduct({...editProduct, minOrderQty:parseInt(e.target.value)||1});
                      else setNewProduct({...newProduct, minOrderQty:parseInt(e.target.value)||1});
                    }} className="w-full mt-1 px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"/>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-3">
                  <button onClick={()=>{setShowAddProduct(false);setEditProductId(null);}} className="px-4 py-2 rounded-lg bg-stone-100 text-stone-700 text-sm font-medium hover:bg-stone-200">{uiLabel('cancel', currentLang)}</button>
                  <button onClick={editProductId ? handleSaveEdit : handleSaveProduct} className="px-4 py-2 rounded-lg bg-amber-700 text-white text-sm font-medium hover:bg-amber-800">
                    <Save className="w-4 h-4 inline mr-1"/>
                    {editProductId ? uiLabel('save_edit', currentLang) : L('add_product')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Cancel Modal */}
        {confirmCancelOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                <XCircle className="w-6 h-6 text-red-600"/>
              </div>
              <h3 className="text-lg font-bold text-stone-900 mb-2">{L('cancel_dialog_title')}</h3>
              <p className="text-sm text-stone-600 mb-4">{L('cancel_dialog_msg')}</p>
              <div className="flex gap-2">
                <button onClick={()=>setConfirmCancelOrder(null)} className="flex-1 px-4 py-2 rounded-lg bg-stone-100 text-stone-700 text-sm font-medium hover:bg-stone-200">{uiLabel('cancel', currentLang)}</button>
                <button onClick={()=>cancelOrder(confirmCancelOrder)} className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700">{L('order_cancel')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
