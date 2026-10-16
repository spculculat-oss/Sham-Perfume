import React, { useState, useMemo } from 'react';
import {
  Users,
  DollarSign,
  CheckCircle,
  XCircle,
  RefreshCw,
  Trash2,
  Eye,
  Plus,
  Search,
  Mail,
  MessageSquare,
  Phone,
  Ban,
} from 'lucide-react';
import { SupportedLanguage } from '../types/i18n';
import { LText, makeT } from '../utils/localize';
import { uiLabel } from '../utils/uiTextL10n';
import {
  getAllMerchants, getMerchantById,
  saveMerchant, updateMerchant, deleteMerchant,
  getMerchantProducts, getAllMerchantProducts,
  saveMerchantProduct, updateMerchantProduct, deleteMerchantProduct,
  getAllOrders, getOrdersByMerchant,
  saveOrder, updateOrderStatus, updateOrderPaymentStatus,
  getPlatformStats,
  addAdminNote,
  getAdminNotes,
} from '../utils/merchantDataStore';
import { PLATFORM_MARGIN_PERCENT } from '../config/margin';

const S: Record<string, LText> = {
  page_title: { ar:'لوحة تحكم الإدارة — التجار والطلبات', en:'Admin Dashboard — Merchants & Orders', fr:'Tableau de bord Admin — Marchands', es:'Panel de Admin — Mercaderes', it:'Dashboard Amministratore — Mercanti', de:'Admin-Dashboard — Händler', ru:'Панель администратора — Торговцы', zh:'管理员面板 — 商家', tr:'Yönetici Paneli — Ticaretçiler', fa:'پنل مدیریت — تجار' },
  stats_merchants: { ar:'إجمالي التجار', en:'Total Merchants', fr:'Total Marchands', es:'Total Mercaderes', it:'Totale Mercanti', de:'Gesamt Händler', ru:'Всего Торговцев', zh:'商家总数', tr:'Toplam Ticaretçi', fa:'تعداد کل تجار' },
  stats_approved: { ar:'معتمدين', en:'Approved', fr:'Approuvés', es:'Aprobados', it:'Approvati', de:'Genehmigt', ru:'Одобренные', zh:'已批准', tr:'Onaylananlar', fa:'تایید شده' },
  stats_pending: { ar:'في الانتظار', en:'Pending', fr:'En attente', es:'Pendientes', it:'In attesa', de:'Ausstehend', ru:'Ожидание', zh:'等待中', tr:'Beklemede', fa:'در انتظار' },
  stats_suspended: { ar:'موقوفين', en:'Suspended', fr:'Suspendus', es:'Suspendidos', it:'Sospesi', de:'Gehalt', ru:'Приостановлены', zh:'已暂停', tr:'Askıya Alınmış', fa:'موقوف شده' },
  stats_products: { ar:'إجمالي المنتجات', en:'Total Products', fr:'Total Produits', es:'Total Productos', it:'Totale Prodotti', de:'Gesamt Produkte', ru:'Всего Продуктов', zh:'产品总数', tr:'Toplam Ürün', fa:'تعداد کل محصولات' },
  stats_approved_products: { ar:'معتمدة', en:'Approved Products', fr:'Produits Approuvés', es:'Productos Aprobados', it:'Prodotti Approvati', de:'Genehmigte Produkte', ru:'Одобренные Продукты', zh:'已批准产品', tr:'Onaylanmış Ürünler', fa:'محصولات تایید شده' },
  stats_orders: { ar:'إجمالي الطلبات', en:'Total Orders', fr:'Total Commandes', es:'Total Pedidos', it:'Totale Ordini', de:'Gesamt Bestellungen', ru:'Всего Заказов', zh:'订单总数', tr:'Toplam Sipariş', fa:'تعداد کل سفارشات' },
  stats_pending_orders: { ar:'في الانتظار', en:'Pending Orders', fr:'Commandes en Attente', es:'Pedidos Pendientes', it:'Ordini in Attesa', de:'Ausstehende Bestellungen', ru:'Ожидание Заказов', zh:'待处理订单', tr:'Beklemede Siparişler', fa:'سفارهای در انتظار' },
  stats_completed_orders: { ar:'مكتملة', en:'Completed Orders', fr:'Commandes Terminées', es:'Pedidos Completados', it:'Ordini Completati', de:'Abgeschlossene Bestellungen', ru:'Завершенные Заказы', zh:'已完成订单', tr:'Tamamlanan Siparişler', fa:'سفارهای تکمیل شده' },
  stats_total_revenue: { ar:'إجمالي إيرادات المنصة', en:'Total Platform Revenue', fr:'Revenu Total', es:'Ingreso Total', it:'Ricavi Totali', de:'Gesamtumsatz', ru:'Общий Доход', zh:'平台总收入', tr:'Platform Toplam Geliri', fa:'کل درآمد پلتفرم' },
  stats_platform_revenue: { ar:'أرباح المنصة (٢٥٪)', en:'Platform Revenue (25%)', fr:'Revenus 25%', es:'Ingreso 25%', it:'Guadagno 25%', de:'Erlös 25%', ru:'Доход 25%', zh:'平台利润 (25%)', tr:'Platform Geliri %25', fa:'منابع پلتفرم (٢٥٪)' },
  stats_retailers: { ar:'إجمالي الزبّان', en:'Total Retailers', fr:'Total Détaillants', es:'Total Minoristas', it:'Totale Rivenditori', de:'Gesamt Einzelhändler', ru:'Всего Розничных', zh:'零售商总数', tr:'Toplam Perakende', fa:'تعداد کل خرده‌فروشان' },
  section_merchants: { ar:'إدارة التجار', en:'Merchant Management', fr:'Gestion Marchands', es:'Gestión Mercaderes', it:'Gestione Mercanti', de:'Händlerverwaltung', ru:'Управление Торговцами', zh:'商家管理', tr:'Ticaretçi Yönetimi', fa:'مدیریت تجار' },
  section_products: { ar:'إدارة المنتجات', en:'Product Management', fr:'Gestion Produits', es:'Gestión Productos', it:'Gestione Prodotti', de:'Produktverwaltung', ru:'Управление Продуктами', zh:'产品管理', tr:'Ürün Yönetimi', fa:'مدیریت محصولات' },
  section_orders: { ar:'إدارة الطلبات', en:'Order Management', fr:'Gestion Commandes', es:'Gestión Pedidos', it:'Gestione Ordini', de:'Bestellungsverwaltung', ru:'Управление Заказами', zh:'订单管理', tr:'Sipariş Yönetimi', fa:'مدیریت سفارشات' },
  tab_all: { ar:'جميع التجار', en:'All Merchants', fr:'Tous', es:'Todos', it:'Tutti', de:'Alle', ru:'Все', zh:'所有', tr:'Tümü', fa:'تمام' },
  tab_pending: { ar:'في الانتظار', en:'Pending', fr:'En attente', es:'Pendientes', it:'In attesa', de:'Ausstehend', ru:'Ожидание', zh:'等待', tr:'Beklemede', fa:'در انتظار' },
  tab_approved: { ar:'معتمدين', en:'Approved', fr:'Approuvés', es:'Aprobados', it:'Approvati', de:'Aktiv', ru:'Активные', zh:'批准', tr:'Onaylı', fa:'تایید شده' },
  tab_suspended: { ar:'موقوفين', en:'Suspended', fr:'Suspendus', es:'Suspendidos', it:'Sospesi', de:'Unterbrochen', ru:'Приостановленные', zh:'暂停', tr:'Askıda', fa:'متوقف' },
  search: { ar:'البحث عن تاجر...', en:'Search merchant...', fr:'Rechercher...', es:'Buscar...', it:'Cerca...', de:'Suchen...', ru:'Поиск...', zh:'搜索...', tr:'Ara...', fa:'جستجو...' },
  no_data: { ar:'لا يوجد تجار مسجلين حالياً', en:'No merchants registered yet', fr:'Aucun marchand', es:'Sin comerciantes', it:'Nessun mercante', de:'Keine Händler', ru:'Нет торговцев', zh:'暂无商家', tr:'Hiç ticaretçi yok', fa:'هیچ تجاری ثبت نشده' },
  approve: { ar:'اعتماد', en:'Approve', fr:'Valider', es:'Aprobar', it:'Approva', de:'Genehmigen', ru:'Одобрить', zh:'批准', tr:'Onayla', fa:'تایید' },
  reject: { ar:'رفض', en:'Reject', fr:'Rejeter', es:'Rechazar', it:'Rifiuta', de:'Ablehnen', ru:'Отклонить', zh:'拒绝', tr:'Reddet', fa:'رد' },
  suspend: { ar:'إيقاف', en:'Suspend', fr:'Suspendre', es:'Suspender', it:'Sospendere', de:'Unterbrechen', ru:'Приостановить', zh:'暂停', tr:'Askıya Al', fa:'متوقف' },
  activate: { ar:'تفعيل', en:'Activate', fr:'Activer', es:'Activar', it:'Attiva', de:'Aktivieren', ru:'Активировать', zh:'激活', tr:'Aktif Et', fa:'فعال‌سازی' },
  delete: { ar:'حذف', en:'Delete', fr:'Supprimer', es:'Eliminar', it:'Elimina', de:'Löschen', ru:'Удалить', zh:'删除', tr:'Sil', fa:'حذف' },
  view_products: { ar:'عرض المنتجات', en:'View Products', fr:'Voir Produits', es:'Ver Productos', it:'Vedi Prodotti', de:'Produkte Anzeigen', ru:'Просмотр Продуктов', zh:'查看产品', tr:'Ürünleri Gör', fa:'مشاهده محصولات' },
  add_product: { ar:'إضافة منتج', en:'Add Product', fr:'Ajouter Produit', es:'Añadir Producto', it:'Aggiungi Prodotto', de:'Produkt Hinzufügen', ru:'Добавить Продукт', zh:'添加产品', tr:'Ürün Ekle', fa:'افزودن محصول' },
  view_orders: { ar:'عرض الطلبات', en:'View Orders', fr:'Voir Commandes', es:'Ver Pedidos', it:'Vedi Ordini', de:'Bestellungen Anzeigen', ru:'Просмотр Заказов', zh:'查看订单', tr:'Siparişleri Gör', fa:'مشاهده سفارشات' },
  add_order: { ar:'طلب جديد', en:'New Order', fr:'Nouvelle Commande', es:'Nuevo Pedido', it:'Nuovo Ordine', de:'Neue Bestellung', ru:'Новый Заказ', zh:'新订单', tr:'Yeni Sipariş', fa:'سف_NEW' },
  back: { ar:'العودة', en:'Back', fr:'Retour', es:'Volver', it:'Torna', de:'Zurück', ru:'Вернуться', zh:'返回', tr:'Dön', fa:'بازگشت' },
  margin_label: { ar:'هامش المنصة', en:'Platform Margin', fr:'Marge', es:'Margen', it:'Margine', de:'Marge', ru:'Маржа', zh:'平台利润率', tr:'Kârı Oranı', fa:'حاشیه پلتفرم' },
  margin_desc: { ar:'٢٥٪ من سعر الجملة — يضاف تلقائياً على سعر الزبون', en:'25% of wholesale — added automatically to customer price', fr:'25% du gros — ajouté automatiquement au prix client', es:'25% del mayor — añadido automáticamente al precio cliente', it:'25% del produttore — aggiunto automaticamente al prezzo cliente', de:'25% vom Großhandel — automatisch zum Kundenpreis', ru:'25% от оптовой — автоматически к цене клиента', zh:'批发价25% — 自动添加到客户价格', tr:'Toplam fiyatın %25i — otomatik müşteri fiyatına eklenir', fa:'٢٥٪ از قیمت پخشی — به‌طور خودکار به قیمت مشتری' },
  margin_to_merchant: { ar:'يظهر للتاجر (سعر الجملة)', en:'To merchant (wholesale)', fr:'Au marchand (gros)', es:'Al comerciante (mayor)', it:'Al mercante (ingrosso)', de:'Dem Händler (Großhandel)', ru:'Торговцу (оптовый)', zh:'给商家 (批发价)', tr:'Ticaretçiyeye (toplam)', fa:'تجار (قیمت پخشی)' },
  margin_to_customer: { ar:'يظهر للزبون (سعر البيع)', en:'To customer (retail)', fr:'Au client (détail)', es:'Al cliente (detalle)', it:'Al cliente (dettaglio)', de:'Zum Kunden (Einzelhandel)', ru:'Клиенту (розничный)', zh:'给客户 (零售价)', tr:'Müşteriye (perakende)', fa:'مشتری (قیمت خرده)' },
  customer_pays: { ar:'يدفع الزبون', en:'Customer pays', fr:'Client paie', es:'Cliente paga', it:'Cliente paga', de:'Kunde zahlt', ru:'Клиент платит', zh:'客户支付', tr:'Müşteri öder', fa:'مشتری پرداخت' },
  merchant_receives: { ar:'يستلم التاجر', en:'Merchant gets', fr:'Marchand reçoit', es:'Comerciante recibe', it:'Mercante riceve', de:'Händler erhält', ru:'Торговец получает', zh:'商家收到', tr:'Ticaretçi alır', fa:'تجار دریافت' },
  platform_keeps: { ar:'تحتفظ المنصة', en:'Platform keeps', fr:'Plateforme garde', es:'Plataforma guarda', it:'Piattaforma tiene', de:'Plattform behält', ru:'Платформа сохраняет', zh:'平台保留', tr:'Platform tutar', fa:'پلتفرم نگه' },
  channel_email: { ar:'بريد', en:'Email', fr:'Email', es:'Correo', it:'Email', de:'E-Mail', ru:'Email', zh:'邮箱', tr:'E-posta', fa:'ایمیل' },
  channel_whatsapp: { ar:'واتساب', en:'WhatsApp', fr:'WhatsApp', es:'WhatsApp', it:'WhatsApp', de:'WhatsApp', ru:'WhatsApp', zh:'微信', tr:'WhatsApp', fa:'واتساب' },
  channel_phone: { ar:'هاتف', en:'Phone', fr:'Tél', es:'Teléfono', it:'Telefono', de:'Telefon', ru:'Телефон', zh:'电话', tr:'Telefon', fa:'تلفن' },
  channel_active: { ar:'مفعل', en:'Active', fr:'Actif', es:'Activo', it:'Attivo', de:'Aktiv', ru:'Активен', zh:'活跃', tr:'Aktif', fa:'فعال' },
  channel_inactive: { ar:'غير مفعل', en:'Inactive', fr:'Inactif', es:'Inactivo', it:'Inattivo', de:'Inaktiv', ru:'Неактивен', zh:'不活跃', tr:'Pasif', fa:'غیرفعال' },
  channel_delete: { ar:'حذف القناة', en:'Delete Channel', fr:'Supprimer Canal', es:'Eliminar Canal', it:'Elimina Canale', de:'Kanal Löschen', ru:'Удалить Канал', zh:'删除通道', tr:'Kanal Sil', fa:'حذف کانال' },
  channel_suspend: { ar:'إيقاف مؤقت', en:'Suspend', fr:'Suspendre', es:'Suspender', it:'Sospendere', de:'Unterbrechen', ru:'Приостановить', zh:'暂停', tr:'AskıyaAl', fa:'موقوف' },
  channel_restore: { ar:'استعادة', en:'Restore', fr:'Restaurer', es:'Restaurar', it:'Ripristina', de:'Wiederherstellen', ru:'Восстановить', zh:'恢复', tr:'GeriAl', fa:'بازگرداندن' },
  notes_label: { ar:'ملاحظات الإدارة', en:'Admin Notes', fr:'Notes Admin', es:'Notas Admin', it:'Note Amministratore', de:'Admin-Hinweise', ru:'Заметки Админа', zh:'管理员备注', tr:'Yönetici Notları', fa:'یادداشت‌های مدیر' },
  add_note: { ar:'أضف ملاحظة...', en:'Add a note...', fr:'Ajouter note...', es:'Añadir nota...', it:'Aggiungi nota...', de:'Hinweis hinzufügen...', ru:'Добавить заметку...', zh:'添加备注...', tr:'Not ekleyin...', fa:'یادداشت اضافه کنید...' },
  save_note: { ar:'حفظ الملاحظة', en:'Save Note', fr:'Enregistrer', es:'Guardar', it:'Salva', de:'Speichern', ru:'Сохранить', zh:'保存', tr:'Kaydet', fa:'ذخیره' },
  confirm_delete: { ar:'حذف هذا التاجر؟ سيتم حذف منتجاته وطلباته أيضاً.', en:'Delete this merchant? Products & orders will also be deleted.', fr:'Supprimer? Produits & commandes aussi supprimés.', es:'¿Eliminar? Productos y pedidos también eliminados.', it:'Eliminare? Prodotti e ordini anche eliminati.', de:'Löschen? Produkte & Bestellungen auch gelöscht.', ru:'Удалить? Продукты и заказы также удалены.', zh:'删除此商家？产品和订单也将被删除。', tr:'Sil? Ürünler ve siparişler de silinir.', fa:'از حذف این تجار مطمئن هستید؟ محصولات و سفارشات او نیز حذف می‌شود.' },
  confirm_suspend: { ar:'إيقاف هذا التاجر مؤقتاً؟', en:'Suspend this merchant temporarily?', fr:'Suspendre temporairement?', es:'¿Suspender temporalmente?', it:'Sospendere temporaneamente?', de:'Vorübergehend unterbrechen?', ru:'Временно приостановить?', zh:'暂停此商家？', tr:'Geçici askıya al?', fa:'آیا این تجار موقتاً متوقف شود؟' },
  order_status_pending: { ar:'في الانتظار', en:'Pending', fr:'En attente', es:'Pendiente', it:'In attesa', de:'Ausstehend', ru:'Ожидание', zh:'待处理', tr:'Beklemede', fa:'در انتظار' },
  order_status_confirmed: { ar:'مؤكد', en:'Confirmed', fr:'Confirmé', es:'Confirmado', it:'Confermato', de:'Bestätigt', ru:'Подтвержден', zh:'已确认', tr:'Onaylandı', fa:'تأیید شده' },
  order_status_processing: { ar:'يتم المعالجة', en:'Processing', fr:'En cours', es:'En proceso', it:'In elaborazione', de:'In Bearbeitung', ru:'В обработке', zh:'处理中', tr:'İşleniyor', fa:'در تر)' },
  order_status_shipped: { ar:'مرسل', en:'Shipped', fr:'Expédié', es:'Enviado', it:'Spedito', de:'Versendet', ru:'Отправлен', zh:'已发货', tr:'Gönderildi', fa:'ارسال شده' },
  order_status_delivered: { ar:'تسليم', en:'Delivered', fr:'Livré', es:'Entregado', it:'Consegnato', de:'Zugegangen', ru:'Доставлен', zh:'已送达', tr:'Teslim Edildi', fa:'تحویل شده' },
  order_status_completed: { ar:'مكتمل', en:'Completed', fr:'Terminé', es:'Completado', it:'Completato', de:'Abgeschlossen', ru:'Завершен', zh:'已完成', tr:'Tamamlandı', fa:'تکمیل شده' },
  order_status_cancelled: { ar:'ملغى', en:'Cancelled', fr:'Annulé', es:'Cancelado', it:'Annullato', de:'Storniert', ru:'Отменен', zh:'已取消', tr:'İptal Edildi', fa:'لغو شده' },
};

export const AdminMerchantManagement: React.FC<{
  onClose: () => void;
  currentLang: SupportedLanguage;
}> = ({ onClose, currentLang }) => {
  const L = makeT(currentLang, S);
  const CUR = uiLabel('currency_egp', currentLang);
  const [activeTab, setActiveTab] = useState<'all'|'pending'|'approved'|'suspended'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMerchantId, setSelectedMerchantId] = useState<string|null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [, setShowOrderModal] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string|null>(null);
  const [confirmSuspend, setConfirmSuspend] = useState<string|null>(null);

  const filteredMerchants = useMemo(() => {
    let list = getAllMerchants();
    if (activeTab === 'pending') list = list.filter(m => m.status === 'pending');
    else if (activeTab === 'approved') list = list.filter(m => m.status === 'approved' || m.status === 'active');
    else if (activeTab === 'suspended') list = list.filter(m => m.status === 'suspended');
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(m => m.companyNameAr.toLowerCase().includes(q) || m.companyNameEn.toLowerCase().includes(q) || m.email.toLowerCase().includes(q));
    }
    return list;
  }, [activeTab, searchQuery]);

  const stats = useMemo(() => getPlatformStats(), []);
  const merchant = selectedMerchantId ? getMerchantById(selectedMerchantId) : null;
  const products = selectedMerchantId ? getMerchantProducts(selectedMerchantId) : [];
  const orders = selectedMerchantId ? getOrdersByMerchant(selectedMerchantId) : [];

  const handleApprove = () => {
    if (!merchant) return;
    updateMerchant(merchant.id, { approved: true, status: 'approved' });
    addAdminNote({ merchantId: merchant.id, type: 'approval', content: `تم اعتماد ${merchant.companyNameAr}`, createdBy: 'Admin' });
  };

  const handleReject = () => {
    if (!merchant) return;
    updateMerchant(merchant.id, { approved: false, status: 'suspended' });
    addAdminNote({ merchantId: merchant.id, type: 'warning', content: `تم رفض ${merchant.companyNameAr}`, createdBy: 'Admin' });
  };

  const handleSuspend = () => {
    if (!merchant) return;
    updateMerchant(merchant.id, { status: 'suspended', isActive: false });
    addAdminNote({ merchantId: merchant.id, type: 'suspension', content: `تم إيقاف ${merchant.companyNameAr}`, createdBy: 'Admin' });
    setConfirmSuspend(null);
  };

  const handleActivate = () => {
    if (!merchant) return;
    updateMerchant(merchant.id, { status: 'active', isActive: true });
    addAdminNote({ merchantId: merchant.id, type: 'general', content: `تم تفعيل ${merchant.companyNameAr}`, createdBy: 'Admin' });
  };

  const handleDelete = () => {
    if (!merchant || !confirmDelete) return;
    deleteMerchant(merchant.id);
    addAdminNote({ merchantId: merchant.id, type: 'suspension', content: `تم حذف ${merchant.companyNameAr}`, createdBy: 'Admin' });
    setConfirmDelete(null);
    setSelectedMerchantId(null);
  };

  const toggleChannel = (channel: 'email'|'whatsapp'|'phone', enable: boolean) => {
    if (!merchant) return;
    const ch = { ...merchant.channels };
    (ch as unknown as Record<string, boolean>)[channel] = enable;
    updateMerchant(merchant.id, { channels: ch });
    addAdminNote({ merchantId: merchant.id, type: enable ? 'general' : 'channel_deletion',
      content: `${enable ? 'تفعيل' : 'حذف'} canal ${channel} لـ ${merchant.companyNameAr}`, createdBy: 'Admin' });
  };

  const handleAddNote = () => {
    if (!newNote.trim() || !merchant) return;
    addAdminNote({ merchantId: merchant.id, type: 'general', content: newNote, createdBy: 'Admin' });
    setNewNote('');
  };

  const addProduct = () => {
    if (!merchant) return;
    const product = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      merchantId: merchant.id,
      sku: `SKU-${Date.now()}`,
      nameAr: '', nameEn: '', category: 'عطور', unit: 'زجةقة',
      costPrice: 0, retailPrice: 0, platformMargin: 0,
      costCurrency: 'EGP', stock: 0, minOrderQty: 1,
      descriptionAr: '', descriptionEn: '', imageUrl: undefined,
      isActive: false, approvalStatus: 'pending' as const, notes: '',
      createdAt: '', updatedAt: '',
    };
    saveMerchantProduct(product);
    setShowProductModal(false);
  };

  const approveProduct = (id: string) => updateMerchantProduct(id, { approvalStatus: 'approved' });
  const rejectProduct = (id: string) => updateMerchantProduct(id, { approvalStatus: 'rejected' });

  const updateOrderStatusHandler = (id: string, status: any) => updateOrderStatus(id, status);

  const tabLabels = {
    all: L('tab_all'),
    pending: L('tab_pending'),
    approved: L('tab_approved'),
    suspended: L('tab_suspended'),
  };

  const renderMerchantRow = (m: any) => (
    <tr key={m.id} onClick={() => setSelectedMerchantId(m.id)}
      className="border-b border-stone-100 hover:bg-amber-50/50 cursor-pointer transition-colors">
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-stone-800 to-amber-800 text-amber-200 flex items-center justify-center text-xs font-bold">
            {m.companyNameAr.slice(0, 1)}
          </div>
          <div>
            <div className="text-sm font-semibold text-stone-900">{m.companyNameAr}</div>
            <div className="text-[10px] text-stone-500">{m.email}</div>
          </div>
        </div>
      </td>
      <td className="py-3 px-4 text-xs font-mono text-stone-600">{m.marginPercent}%</td>
      <td className="py-3 px-4 text-center text-sm">{m.totalProducts}</td>
      <td className="py-3 px-4 text-center text-sm">{m.totalOrders}</td>
      <td className="py-3 px-4 text-right text-sm font-mono">{m.totalRevenue.toLocaleString()}</td>
      <td className="py-3 px-4 text-center">
        <div className="flex items-center justify-center gap-1">
          {m.channels.email ? <Mail className="w-3 h-3 text-blue-600"/> : <Mail className="w-3 h-3 text-stone-300"/>}
          {m.channels.whatsapp ? <MessageSquare className="w-3 h-3 text-green-600"/> : <MessageSquare className="w-3 h-3 text-stone-300"/>}
          {m.channels.phone ? <Phone className="w-3 h-3 text-amber-600"/> : <Phone className="w-3 h-3 text-stone-300"/>}
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-1">
          <button onClick={e=>{e.stopPropagation();setSelectedMerchantId(m.id);}} className="p-1.5 rounded hover:bg-stone-100" title="View"><Eye className="w-3.5 h-3.5 text-stone-500"/></button>
          {m.status==='pending' && <>
            <button onClick={e=>{e.stopPropagation();handleApprove();}} className="p-1.5 rounded hover:bg-emerald-100" title="Approve"><CheckCircle className="w-3.5 h-3.5 text-emerald-600"/></button>
            <button onClick={e=>{e.stopPropagation();handleReject();}} className="p-1.5 rounded hover:bg-red-100" title="Reject"><XCircle className="w-3.5 h-3.5 text-red-600"/></button>
          </>}
          {m.status==='approved' && <button onClick={e=>{e.stopPropagation();setConfirmSuspend(m.id);}} className="p-1.5 rounded hover:bg-amber-100" title="Suspend"><Ban className="w-3.5 h-3.5 text-amber-600"/></button>}
          {m.status==='suspended' && <button onClick={e=>{e.stopPropagation();handleActivate();}} className="p-1.5 rounded hover:bg-emerald-100" title="Activate"><RefreshCw className="w-3.5 h-3.5 text-emerald-600"/></button>}
          <button onClick={e=>{e.stopPropagation();setConfirmDelete(m.id);}} className="p-1.5 rounded hover:bg-red-100" title="Delete"><Trash2 className="w-3.5 h-3.5 text-red-600"/></button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-6xl max-h-[95vh] overflow-hidden rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in-95 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50 rounded-t-2xl shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-stone-900 to-amber-950 text-amber-400 flex items-center justify-center font-bold text-lg">Sham</div>
            <div>
              <h1 className="text-lg font-bold text-stone-900 font-serif-luxury">{L('page_title')}</h1>
              <p className="text-xs text-stone-500">{L('margin_desc')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-stone-100 transition-colors"><RefreshCw className="w-4 h-4 text-stone-500"/></button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-72 border-r border-stone-200 flex flex-col bg-stone-50/50 shrink-0 overflow-y-auto">
            {/* Stats Card */}
            <div className="p-4 border-b border-stone-200 space-y-3">
              <div className="text-xs font-bold text-stone-500 uppercase tracking-wider">{L('stats_merchants')}</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: stats.totalMerchants, l: L('stats_merchants'), c: 'bg-amber-50 border-amber-200/60 text-amber-900' },
                  { v: stats.approvedMerchants, l: L('stats_approved'), c: 'bg-emerald-50 border-emerald-200/60 text-emerald-900' },
                  { v: stats.pendingMerchants, l: L('stats_pending'), c: 'bg-amber-100 border-amber-300/60 text-amber-800' },
                  { v: stats.suspendedMerchants, l: L('stats_suspended'), c: 'bg-red-50 border-red-200/60 text-red-800' },
                ].map(s => (
                  <div key={s.l} className={`p-3 rounded-xl border ${s.c}`}>
                    <div className="text-2xl font-bold">{s.v}</div>
                    <div className="text-[10px] font-medium opacity-80">{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Metrics */}
            <div className="p-4 border-b border-stone-200 space-y-2">
              {[
                [stats.totalProducts, L('stats_products')],
                [stats.approvedProducts, L('stats_approved_products')],
                [stats.totalOrders, L('stats_orders')],
                [stats.pendingOrders, L('stats_pending_orders')],
                [stats.completedOrders, L('stats_completed_orders')],
                [stats.totalRetailers, L('stats_retailers')],
                [stats.totalRevenue, L('stats_total_revenue')],
                [stats.totalPlatformRevenue, L('stats_platform_revenue')],
              ].map(([v, l]) => (
                <div key={l} className="flex justify-between items-center py-1 border-b border-stone-100 last:border-0">
                  <span className="text-xs font-bold text-stone-500">{l}</span>
                  <span className="text-sm font-bold text-stone-800">
                    {typeof v === 'number' && v > 0 ? v.toLocaleString() : v}
                    {String(l).includes('revenue') ? ' '+CUR : ''}
                  </span>
                </div>
              ))}
            </div>
            {/* Tabs */}
            <div className="p-3 border-t border-stone-200">
              <div className="text-xs font-bold text-stone-500 uppercase mb-2">{L('section_merchants')}</div>
              {(['all','pending','approved','suspended'] as const).map(tab => (
                <button key={tab} onClick={()=>{setActiveTab(tab);setSelectedMerchantId(null);}}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium mb-1 transition-colors ${
                    activeTab===tab?'bg-amber-100 text-amber-900 font-bold':'text-stone-600 hover:bg-stone-100'
                  }`}>
                  {tab===activeTab?tabLabels[tab]:tabLabels[tab]}
                </button>
              ))}
              <div className="text-xs font-bold text-stone-500 uppercase mt-4 mb-2">{L('section_orders')}</div>
              <button onClick={()=>setShowOrderModal(true)} className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-stone-600 hover:bg-stone-100">
                <Plus className="w-3 h-3 inline mr-1"/> {L('add_order')}
              </button>
            </div>
          </div>

          {/* Main */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Search */}
            <div className="p-4 border-b border-stone-200 flex items-center gap-3 shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400"/>
                <input type="text" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
                  placeholder={L('search')}
                  className="w-full pl-9 pr-4 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"/>
              </div>
              {selectedMerchantId && (
                <button onClick={()=>setSelectedMerchantId(null)} className="px-3 py-2 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium transition-colors">
                  ← {L('back')}
                </button>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4">
              {!selectedMerchantId ? (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-stone-200 text-left">
                      {(['company_col','margin_col','products_col','requests_col','revenue_col','channels_col','actions_col'] as const).map(k=>(
                        <th key={k} className="py-3 px-4 text-xs font-bold text-stone-500 uppercase">{uiLabel(k, currentLang)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMerchants.length===0 ? (
                      <tr><td colSpan={7} className="py-12 text-center text-stone-400">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-50"/>
                        <p className="text-sm">{L('no_data')}</p>
                      </td></tr>
                    ) : filteredMerchants.map(renderMerchantRow)}
                  </tbody>
                </table>
              ) : (
                <div className="space-y-4">
                  {/* Merchant Header */}
                  <div className="p-5 rounded-xl bg-gradient-to-br from-stone-900 to-amber-950 text-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-amber-500/30 flex items-center justify-center text-2xl font-bold">
                          {merchant!.companyNameAr.slice(0,2)}
                        </div>
                        <div>
                          <h2 className="text-xl font-bold font-serif-luxury">{merchant!.companyNameAr}</h2>
                          <p className="text-sm text-amber-200">{merchant!.companyNameEn}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          merchant!.status==='active'?'bg-emerald-500/30 text-emerald-200':
                          merchant!.status==='suspended'?'bg-red-500/30 text-red-200':
                          'bg-amber-500/30 text-amber-200'
                        }`}>{merchant!.status}</span>
                        {merchant!.approved && (
                          <span className="px-3 py-1 rounded-full bg-emerald-500/30 text-emerald-200 text-xs flex items-center gap-1">
                            <CheckCircle className="w-3 h-3"/> {uiLabel('approved', currentLang)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-amber-200/90">
                      <div><span className="text-amber-200/60 text-[10px] block">{L('margin_label')}</span><span className="font-bold text-lg">{merchant!.marginPercent}%</span></div>
                      <div><span className="text-amber-200/60 text-[10px] block">{L('stats_products')}</span><span className="font-bold text-lg">{merchant!.totalProducts}</span></div>
                      <div><span className="text-amber-200/60 text-[10px] block">{uiLabel('requests_col', currentLang)}</span><span className="font-bold text-lg">{merchant!.totalOrders}</span></div>
                      <div><span className="text-amber-200/60 text-[10px] block">{L('stats_total_revenue')}</span><span className="font-bold text-lg">{merchant!.totalRevenue.toLocaleString()}</span></div>
                    </div>
                    <div className="mt-4 p-3 rounded-lg bg-white/10 border border-amber-500/30 grid grid-cols-3 gap-2 text-center">
                      <div className="text-xs text-amber-200/70">{L('margin_to_merchant')}</div>
                      <div className="text-xs text-amber-200/70">{L('margin_to_customer')}</div>
                      <div className="text-xs text-amber-200/70 font-bold">{L('platform_keeps')}</div>
                      <div className="mt-1 font-bold text-lg">{merchant!.marginPercent}%</div>
                      <div className="mt-1 font-bold text-lg text-amber-300">{uiLabel('times_125', currentLang)}</div>
                      <div className="mt-1 font-bold text-lg text-amber-300">{uiLabel('pct_25', currentLang)}</div>
                    </div>
                  </div>

                  {/* Channels */}
                  <div className="p-4 rounded-xl border border-stone-200 bg-stone-50">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-stone-900">{L('notes_label')}</h3>
                      <button onClick={()=>setShowNotes(!showNotes)} className="text-xs px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200">{showNotes?uiLabel('hide', currentLang):L('view')}</button>
                    </div>
                    {showNotes ? (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <input value={newNote} onChange={e=>setNewNote(e.target.value)} placeholder={L('add_note')}
                            className="flex-1 px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"/>
                          <button onClick={handleAddNote} className="px-3 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-medium">
                            {L('save_note')}
                          </button>
                        </div>
                        <div className="border-t border-stone-200 pt-2 max-h-40 overflow-auto">
                          {getAdminNotes(merchant!.id).map(n=>(
                            <div key={n.id} className="p-2 rounded-lg bg-stone-100/80 text-xs text-stone-700 mb-1">
                              <div className="flex items-center gap-2 text-stone-400 mb-0.5">
                                <span className="font-mono text-[10px]">{n.type}</span>
                                <span className="text-[10px]">{n.createdAt.slice(0,10)}</span>
                              </div>
                              <p>{n.content}</p>
                            </div>
                          ))}
                          {getAdminNotes(merchant!.id).length===0 && <p className="text-xs text-stone-400 text-center py-2">{uiLabel('no_notes', currentLang)}</p>}
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {(['email','whatsapp','phone'] as const).map(ch=>(
                          <div key={ch} className="p-3 rounded-lg border border-stone-200 text-center">
                            <div className="flex items-center justify-center gap-1 mb-1">
                              {ch==='email'&&<Mail className="w-3.5 h-3.5 text-stone-500"/>}
                              {ch==='whatsapp'&&<MessageSquare className="w-3.5 h-3.5 text-stone-500"/>}
                              {ch==='phone'&&<Phone className="w-3.5 h-3.5 text-stone-500"/>}
                              <span className="text-xs text-stone-400 ml-1">{L(`channel_${ch}` as keyof typeof S)}</span>
                            </div>
                            <div className="text-[10px] font-medium">
                              {merchant!.channels[ch] ? <span className="text-emerald-700">{L('channel_active')}</span>
                               : <span className="text-stone-400">{L('channel_inactive')}</span>}
                            </div>
                            <div className="flex items-center justify-center gap-1 mt-2">
                              {!merchant!.channels[ch] ? (
                                <button onClick={()=>toggleChannel(ch,true)} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200">{L('channel_restore')}</button>
                              ) : (
                                <>
                                  <button onClick={()=>toggleChannel(ch,false)} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 hover:bg-amber-200">{L('channel_suspend')}</button>
                                  <button onClick={()=>toggleChannel(ch,false)} className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 hover:bg-red-200">{L('channel_delete')}</button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-stone-100/80">
                    {merchant!.status==='pending' && (
                      <>
                        <button onClick={handleApprove} className="flex-1 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-sm font-medium">
                          <CheckCircle className="w-4 h-4 inline mr-1"/> {L('approve')}
                        </button>
                        <button onClick={handleReject} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium">
                          <XCircle className="w-4 h-4 inline mr-1"/> {L('reject')}
                        </button>
                      </>
                    )}
                    {merchant!.status==='approved' && (
                      <button onClick={()=>setConfirmSuspend(merchant!.id)} className="flex-1 px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-sm font-medium">
                        <Ban className="w-4 h-4 inline mr-1"/> {L('suspend')}
                      </button>
                    )}
                    {merchant!.status==='suspended' && (
                      <button onClick={handleActivate} className="flex-1 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-sm font-medium">
                        <RefreshCw className="w-4 h-4 inline mr-1"/> {L('activate')}
                      </button>
                    )}
                    <button onClick={()=>setConfirmDelete(merchant!.id)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium">
                      <Trash2 className="w-4 h-4 inline mr-1"/> {L('delete')}
                    </button>
                  </div>

                  {/* Products */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-bold text-stone-900">{L('section_products')}</h3>
                      <button onClick={()=>setShowProductModal(true)} className="text-xs px-2 py-1 rounded-lg bg-amber-100 text-amber-900 hover:bg-amber-200">
                        <Plus className="w-3 h-3 inline mr-1"/> {L('add_product')}
                      </button>
                    </div>
                    {products.length===0 ? (
                      <p className="text-xs text-stone-400 text-center py-3">{L('no_data')}</p>
                    ) : (
                      <div className="max-h-48 overflow-auto rounded-lg border border-stone-200">
                        {products.map(p=>(
                          <div key={p.id} className="flex items-center justify-between px-4 py-2 border-b border-stone-100 text-xs">
                            <div className="flex items-center gap-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                p.approvalStatus==='approved'?'bg-emerald-100 text-emerald-800':
                                p.approvalStatus==='rejected'?'bg-red-100 text-red-800':'bg-amber-100 text-amber-800'
                              }`}>{p.approvalStatus}</span>
                              <span className="font-medium text-stone-800">{p.nameAr||p.sku}</span>
                            </div>
                            <div className="text-right font-mono">
                              <div className="text-stone-500">{L('margin_to_merchant')}: {p.costPrice}</div>
                              <div className="text-amber-800 font-bold">{L('margin_to_customer')}: {p.retailPrice}</div>
                            </div>
                            <div className="flex items-center gap-1">
                              {p.approvalStatus==='pending' && <>
                                <button onClick={()=>approveProduct(p.id)} className="p-1 rounded hover:bg-emerald-100"><CheckCircle className="w-3 h-3 text-emerald-600"/></button>
                                <button onClick={()=>rejectProduct(p.id)} className="p-1 rounded hover:bg-red-100"><XCircle className="w-3 h-3 text-red-600"/></button>
                              </>}
                              <button onClick={()=>deleteMerchantProduct(p.id)} className="p-1 rounded hover:bg-red-100"><Trash2 className="w-3 h-3 text-red-600"/></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Orders */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-bold text-stone-900">{L('section_orders')}</h3>
                      <button onClick={()=>setShowOrderModal(true)} className="text-xs px-2 py-1 rounded-lg bg-amber-100 text-amber-900 hover:bg-amber-200">
                        <Plus className="w-3 h-3 inline mr-1"/> {L('add_order')}
                      </button>
                    </div>
                    {orders.length===0 ? (
                      <p className="text-xs text-stone-400 text-center py-3">{L('no_data')}</p>
                    ) : (
                      <div className="max-h-60 overflow-auto rounded-lg border border-stone-200">
                        {orders.map(o=>(
                          <div key={o.id} className="flex items-center justify-between px-4 py-2 border-b border-stone-100 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-stone-600">{o.orderNumber}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                o.status==='completed'?'bg-emerald-100 text-emerald-800':
                                o.status==='cancelled'?'bg-red-100 text-red-800':
                                o.status==='shipped'||o.status==='delivered'?'bg-blue-100 text-blue-800':'bg-amber-100 text-amber-800'
                              }`}>{L(`order_status_${o.status}` as keyof typeof S)}</span>
                            </div>
                            <div className="text-right font-mono text-xs">
                              <div>{uiLabel('payment', currentLang)}: {o.subtotalRetail.toLocaleString()}</div>
                              <div className="text-stone-500">{uiLabel('platform_profit', currentLang)}: {o.totalPlatformRevenue.toLocaleString()}</div>
                            </div>
                            <div className="flex items-center gap-1">
                              {o.status==='pending' && <button onClick={()=>updateOrderStatusHandler(o.id,'confirmed')} className="p-1 rounded hover:bg-emerald-100"><CheckCircle className="w-3 h-3 text-emerald-600"/></button>}
                              {o.status==='confirmed' && <button onClick={()=>updateOrderStatusHandler(o.id,'processing')} className="p-1 rounded hover:bg-blue-100"><RefreshCw className="w-3 h-3 text-blue-600"/></button>}
                              {o.status==='processing' && <button onClick={()=>updateOrderStatusHandler(o.id,'shipped')} className="p-1 rounded hover:bg-blue-100"><DollarSign className="w-3 h-3 text-blue-600"/></button>}
                              <button onClick={()=>updateOrderStatusHandler(o.id,'completed')} className="p-1 rounded hover:bg-emerald-100"><CheckCircle className="w-3 h-3 text-emerald-600"/></button>
                              <button onClick={()=>updateOrderStatusHandler(o.id,'cancelled')} className="p-1 rounded hover:bg-red-100"><XCircle className="w-3 h-3 text-red-600"/></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Product Modal */}
        {showProductModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 p-6">
              <h2 className="text-lg font-bold text-stone-900 mb-4 font-serif-luxury">{L('add_product')}</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-stone-700">{L('margin_to_merchant')}</label>
                  <input type="number" className="w-full mt-1 px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" placeholder="10"/>
                  <p className="text-[10px] text-stone-400 mt-1">{L('margin_desc')}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-700">{uiLabel('product_name_ar', currentLang)}</label>
                  <input type="text" className="w-full mt-1 px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" placeholder={uiLabel('example_oud', currentLang)}/>
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-700">{uiLabel('product_name_en', currentLang)}</label>
                  <input type="text" className="w-full mt-1 px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" placeholder="Oud Perfume"/>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs font-medium text-stone-700">{uiLabel('category_label', currentLang)}</label>
                    <select className="w-full mt-1 px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300">
                      <option value="عطور">{uiLabel('cat_perfumes', currentLang)}</option><option value="خامات">{uiLabel('cat_materials', currentLang)}</option><option value="أدوات">{uiLabel('cat_tools', currentLang)}</option><option value="تغليف">{uiLabel('cat_packaging', currentLang)}</option><option value="غير ذلك">{uiLabel('cat_other', currentLang)}</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-medium text-stone-700">{uiLabel('unit_label', currentLang)}</label>
                    <select className="w-full mt-1 px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300">
                      <option value="زجاجة">{uiLabel('u_bottle', currentLang)}</option><option value="لتر">{uiLabel('u_liter', currentLang)}</option><option value="جرام">{uiLabel('u_gram', currentLang)}</option><option value="مجموعة">{uiLabel('u_set', currentLang)}</option><option value="قطعة">{uiLabel('u_piece', currentLang)}</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-3">
                  <button onClick={()=>setShowProductModal(false)} className="px-4 py-2 rounded-lg bg-stone-100 text-stone-700 text-sm font-medium hover:bg-stone-200">{uiLabel('cancel', currentLang)}</button>
                  <button onClick={addProduct} className="px-4 py-2 rounded-lg bg-amber-700 text-white text-sm font-medium hover:bg-amber-800">
                    <Plus className="w-4 h-4 inline mr-1"/> {L('add_product')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Delete */}
        {confirmDelete && merchant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-6 h-6 text-red-600"/>
              </div>
              <h3 className="text-lg font-bold text-stone-900 mb-2">{L('delete')}</h3>
              <p className="text-sm text-stone-600 mb-4">{L('confirm_delete')}</p>
              <div className="flex gap-2">
                <button onClick={()=>setConfirmDelete(null)} className="flex-1 px-4 py-2 rounded-lg bg-stone-100 text-stone-700 text-sm font-medium hover:bg-stone-200">{uiLabel('cancel', currentLang)}</button>
                <button onClick={handleDelete} className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700">{L('delete')}</button>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Suspend */}
        {confirmSuspend && merchant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
                <Ban className="w-6 h-6 text-amber-600"/>
              </div>
              <h3 className="text-lg font-bold text-stone-900 mb-2">{L('suspend')}</h3>
              <p className="text-sm text-stone-600 mb-4">{L('confirm_suspend')}</p>
              <div className="flex gap-2">
                <button onClick={()=>setConfirmSuspend(null)} className="flex-1 px-4 py-2 rounded-lg bg-stone-100 text-stone-700 text-sm font-medium hover:bg-stone-200">{uiLabel('cancel', currentLang)}</button>
                <button onClick={handleSuspend} className="flex-1 px-4 py-2 rounded-lg bg-amber-700 text-white text-sm font-medium hover:bg-amber-800">{L('suspend')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
