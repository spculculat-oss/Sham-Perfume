import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  ShoppingBag,
  Package,
  ArrowRight,
  Star,
  Shield,
  Cents,
  Minus,
  Plus,
  Trash2,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  CurrencyDollar,
  Eye,
} from 'lucide-react';
import { SupportedLanguage } from '../types/i18n';
import { LText, makeT } from '../utils/localize';
import { getApprovedActiveProducts, getMerchantById, getProductById } from '../utils/merchantDataStore';
import { PLATFORM_MARGIN_PERCENT, calculateRetailPrice, calculatePlatformRevenue, calculateMerchantPayout } from '../config/margin';
import { MerchantProductRecord, MediationOrderRecord } from '../types/merchant';
import { getAllOrders, saveOrder, getOrCreateRetailer, incrementRetailerOrder } from '../utils/merchantDataStore';

const S: Record<string, LText> = {
  title: { ar:'カタログ المنتجات — استكشف واطلب', en:'Product Catalog — Explore & Order', fr:'Catalogue des Produits — Explorer & Commander', es:'Catálogo de Productos — Explorar & Pedir', it:'Catalogo Prodotti — Esplora & Ordina', de:'Produktkatalog — Entdecken & Bestellen', ru:'Каталог Продуктов — Исследовать & Заказать', zh:'产品目录 — 浏览和购买', tr:'Ürün Kataloğu — Keşfet & Sipariş Ver', fa:'کاتالوگ محصولات — کشف و سفارش' },
  search_placeholder: { ar:'ابحث عن منتج...', en:'Search for a product...', fr:'Rechercher un produit...', es:'Buscar un producto...', it:'Cerca un prodotto...', de:'Produkt suchen...', ru:'Поиск продукта...', zh:'搜索产品...', tr:'Ürün ara...', fa:'جستجوی محصول...' },
  categories: { ar:'التصنيفات', en:'Categories', fr:'Catégories', es:'Categorías', it:'Categorie', de:'Kategorien', ru:'Категории', zh:'分类', tr:'Kategoriler', fa:'دسته‌بندی‌ها' },
  all: { ar:'الكل', en:'All', fr:'Tous', es:'Todos', es:'Todos', it:'Tutti', de:'Alle', ru:'Все', zh:'全部', tr:'Tümü', fa:'همه' },
  fragrance: { ar:'عطور', en:'Fragrances', fr:'Parfums', es:'Fragancias', it:'Profumi', de:'Parfüms', ru:'Ароматы', zh:'香水', tr:'Kokular', fa:'عطور' },
  raw_materials: { ar:'خامات', en:'Raw Materials', fr:'Matières Premières', es:'Materias Primas', it:'Materie Prime', de:'Rohstoffe', ru:'Сырье', zh:'原料', tr:'Ham Madde', fa:'همراه' },
  tools: { ar:'أدوات', en:'Tools', fr:'Outils', es:'Herramientas', it:'Strumenti', de:'Werkzeuge', ru:'Инструменты', zh:'工具', tr:'Araçlar', fa:'ابزارها' },
  packaging: { ar:'تغليف', en:'Packaging', fr:'Emballage', es:'Empaque', it:'Imballaggio', de:'Verpackung', ru:'Упаковка', zh:'包装', tr:'Paketleme', fa:'بسته‌بندی' },
  other: { ar:'أخرى', en:'Other', fr:'Autre', es:'Otro', it:'Altro', de:'Sonstige', ru:'Другое', zh:'其他', tr:'Diğer', fa:'دیگر' },
  price_filter: { ar:'السعر (للزبون)', en:'Price (for customer)', fr:'Prix (pour client)', es:'Precio (para cliente)', it:'Prezzo (per cliente)', de:'Preis (für Kunde)', ru:'Цена (для клиента)', zh:'价格 (给客户)', tr:'Fiyat (müşteri için)', fa:'قیمت (برای مشتری)' },
  min_price: { ar:'السعر الأدنى', en:'Min Price', fr:'Prix Minimum', es:'Precio Mínimo', it:'Prezzo Minimo', de:'Mindestpreis', ru:'Минимальная Цена', zh:'最低价格', tr:'Minimum Fiyat', fa:'قیمت حداقل' },
  max_price: { ar:'السعر الأقصى', en:'Max Price', fr:'Prix Maximum', es:'Precio Máximo', it:'Prezzo Massimo', de:'Maximalpreis', ru:'Максимальная Цена', zh:'最高价格', tr:'Maksimum Fiyat', fa:'قیمت حداکثر' },
  apply: { ar:'تطبيق', en:'Apply', fr:'Appliquer', es:'Aplicar', it:'Applica', de:'Anwenden', ru:'Применить', zh:'应用', tr:'Uygula', fa:'اعمال کنید' },
  reset: { ar:'إعادة تعيين', en:'Reset', fr:'Réinitialiser', es:'Reiniciar', it:'Reimposta', de:'Zurücksetzen', ru:'Сбросить', zh:'重置', tr:'Sıfırla', fa:'بازنشانی' },
  featured: { ar:'أ 기타포괄손익반영呈品', en:'Featured Products', fr:'Produits en Vedette', es:'Productos Destacados', it:'Prodotti in Evidenza', de:'Vorgestellte Produkte', ru:'Продукты на Первыхplan', zh:'精选产品', tr:'Öne Çıkan Ürünler', fa:'محصولات سبزپاش' },
  product_card_merchant: { ar:'بتوفر: {merchantName}', en:'Sold by: {merchantName}', fr:'Vendu par: {merchantName}', es:'Vendido por: {merchantName}', it:'Venduto da: {merchantName}', de:'Verkauft von: {merchantName}', ru:'Продается: {merchantName}', zh:'由 {merchantName} 销售', tr:'Satıcı: {merchantName}', fa:'فروشنده: {merchantName}' },
  product_card_cost_price: { ar:'سعر الجملة (للتاجر فقط)', en:'Wholesale price (merchant only)', fr:'Prix de gros (marchand seulement)', es:'Precio mayor (solo comerciante)', it:'Prezzo all\'ingrosso (solo mercante)', de:'Großhandelspreis (nur Händler)', ru:'Оптовая цена (только торговец)', zh:'批发价 (仅商家可见)', tr:'Toplam fiyatı (sadece ticaretçi)', fa:'قیمت پخشی (فقط برای تجار)' },
  product_card_retail_price: { ar:'سعر الشراء للزبون', en:'Purchase price for customer', fr:'Prix d\'achat pour client', es:'Precio de compra para cliente', it:'Prezzo d\'acquisto per cliente', de:'Kaufpreis für Kunde', ru:'Цена покупки для клиента', zh:'客户购买价格', tr:'Müşteri için satın alma fiyatı', fa:'قیمت خرید برای مشتری' },
  product_card_platform_revenue: { ar:'ربح المنصة (٢٥٪)', en:'Platform revenue (25%)', fr:'Revenu plateforme (25%)', es:'Ingreso plataforma (25%)', it:'Guadagno piattaforma (25%)', de:'Plattform-Erlös (25%)', ru:'Доход платформы (25%)', zh:'平台利润 (25%)', tr:'Platform geliri (%25)', fa:'منابع پلتفرم (۲۵٪)' },
  product_card_sku: { ar:'رمز المنتج', en:'SKU', fr:'Réf', es:'SKU', it:'SKU', de:'SKU', ru:'Артикул', zh:'货号', tr:'Stok Kodu', fa:'کد محصول' },
  product_card_stock: { ar:'المتاحة', en:'Available', fr:'Disponible', es:'Disponible', it:'Disponibile', de:'Verfügbar', ru:'Доступно', zh:'库存', tr:'Mevcut', fa:'موجود' },
  add_to_cart: { ar:'أضف للسلة', en:'Add to Cart', fr:'Ajouter au Panier', es:'Añadir al Carrito', it:'Aggiungi al Carrello', de:'In den Warenkorb', ru:'В Корзину', zh:'加入购物车', tr:'Sepete Ekle', fa:'افزودن به سبد' },
  view_details: { ar:'عرض التفاصيل', en:'View Details', fr:'Voir Détails', es:'Ver Detalles', es:'Ver Detalles', it:'Vedi Dettagli', de:'Details Anzeigen', ru:'Просмотр Деталей', zh:'查看详情', tr:'Detayları Gör', fa:'مشاهده جزئیات' },
  cart_empty: { ar:'سلتك فارغة', en:'Your cart is empty', fr:'Votre panier est vide', es:'Tu carrito está vacío', it:'Il tuo carrello è vuoto', de:'Dein Warenkast ist leer', ru:'Ваша корзина пуста', zh:'购物车为空', tr:'Sepetiniz boş', fa:'سبد خرید خالی است' },
  cart_summary: { ar:'ملخص السلة', en:'Cart Summary', fr:'Résumé du Panier', es:'Resumen del Carrito', it:'Sintesi del Carrello', de:'Warenkorb Zusammenfassung', ru:'Итого Корзины', zh:'购物车摘要', tr:'Sepet Özeti', fa:'خلاصه سبد خرید' },
  cart_items: { ar:'المنتجات', en:'Items', fr:'Articles', es:'Artículos', it:'Articoli', de:'Artikel', ru:'Товары', zh:'商品', tr:'Ürünler', fa:'محصولات' },
  cart_qty: { ar:'الكمية', en:'Quantity', fr:'Quantité', es:'Cantidad', it:'Quantità', de:'Menge', ru:'Количество', zh:'数量', tr:'Miktar', fa:'تعداد' },
  cart_item_price: { ar:'سعر الوحدة', en:'Unit Price', fr:'Prix Unitaire', es:'Precio Unitario', it:'Prezzo Unitario', de:'Einzelpreis', ru:'Цена за Единицу', zh:'单价', tr:'Birim Fiyat', fa:'قیمت واحد' },
  cart_item_total: { ar:'الإجمالي', en:'Total', fr:'Total', es:'Total', it:'Totale', de:'Gesamt', ru:'Итого', zh:'合计', tr:'Toplam', fa:'مجموع' },
  cart_platform_revenue_total: { ar:'إجمالي ربح المنصة (٢٥٪)', en:'Total Platform Revenue (25%)', fr:'Revenu Total Plateforme (25%)', es:'Ingreso Total Plataforma (25%)', it:'Guadagno Totale Piattaforma (25%)', de:'Gesamt Plattform-Erlös (25%)', ru:'Общий Доход Платформы (25%)', zh:'平台总利润 (25%)', tr:'Platform Toplam Geliri (%25)', fa:'مجموع منابع پلتفرم (۲۵٪)' },
  cart_total_cost: { ar:'إجمالي تكلفة التاجر', en:'Total Merchant Cost', fr:'Coût Total Marchand', es:'Coste Total Comerciante', it:'Costo Totale Mercante', de:'Gesamtkosten Händler', ru:'Общие Затраты Торговца', zh:'商家总成本', tr:'Ticaretçi Toplam Maliyeti', fa:'هزینه کلی تجار' },
  cart_total_retail: { ar:'إجمالي ما يدفعه الزبون', en:'Total Customer Pays', fr:'Total que paie le Client', es:'Total que paga el Cliente', it:'Totale che paga il Cliente', de:'Gesamtbetrag des Kunden', ru:'Итого что платит Клиент', zh:'客户支付总额', tr:'Müşteri Ödeyeceği Toplam', fa:'مجموعی که مشتری پرداخت می‌کند' },
  checkout: { ar:'إتمام الشراء', en:'Checkout', fr:'Paiement', es:'Pagar', it:'Finalizza Acquisto', de:'Kaufen', ru:'Оформить Заказ', zh:'结账', tr:'Ödeme Yap', fa:'تسویه حساب' },
  checkout_btn: { ar:'تنفيذ الطلب', en:'Place Order', fr:'Passer Commande', es:'Realizar Pedido', it:'Invia Ordine', de:'Bestellung Aufgeben', ru:'Оформить Заказ', zh:'提交订单', tr:'Sipariş Ver', fa:'ارسال سفارش' },
  cart_clear: { ar:'إفراغ السلة', en:'Clear Cart', fr:'Vider Panier', es:'Vaciar Carrito', it:'Svuota Carrello', de:'Warenkorb Leeren', ru:'Очистить Корзину', zh:'清空购物车', tr:'Sepeti Boşalt', fa:'خالی کردن سبد خرید' },
  order_success_title: { ar:'تم الطلب بنجاح!', en:'Order Placed Successfully!', fr:'Commande Passée avec Succès!', es:'¡Pedido Realizado con Éxito!', it:'Ordine Inviato con Successo!', de:'Bestellung Erfolgreich Aufgegeben!', ru:'Заказ Успешно Оформлен!', zh:'订单提交成功！', tr:'Sipariş Başarıyla Verildi!', fa:'سفارش با موفقیت ثبت شد!' },
  order_success_msg: { ar:'شكراً لطلبك! تم إيصال طلبك للتاجر وستتابع المنصة عملية التسليم.', en:'Thank you for your order! Your order has been sent to the merchant and the platform will follow up on delivery.', fr:'Merci pour votre commande! Votre commande a été envoyée au marchand et la plateforme suivra la livraison.', es:'¡Gracias por tu pedido! Tu pedido ha sido enviado al comerciante y la plataforma hará seguimiento de la entrega.', it:'Grazie per il tuo ordine! Il tuo ordine è stato inviato al mercante e la piattaforma seguirà la consegna.', de:'Vielen Dank für Ihre Bestellung! Ihre Bestellung wurde an den Händler gesendet und die Plattform wird die Lieferung verfolgen.', ru:'Спасибо за ваш заказ! Ваш заказ отправлен торговцу и платформа будет следовать за доставкой.', zh:'感谢您的订单！您的订单已发送给商家，平台将跟进发货情况。', tr:'Siparişiniz için teşekkürler! Sipariş ticaretçiye gönderildi ve platform teslimatı takip edecek.', fa:'ممنون بابت سفارش شما! سفارش شما به تجار ارسال شده و پلتفرم بر ر 이행 تحویل خواهد pavilion.' },
  order_number_prefix: { ar:'رقم الطلب:', en:'Order Number:', fr:'Numéro de Commande:', es:'Número de Pedido:', it:'Numero di Ordine:', de:'Bestellnummer:', ru:'Номер Заказа:', zh:'订单号：', tr:'Sipariş Numarası:', fa:'شماره سفارش:' },
  view_orders: { ar:'عرض طلباتي', en:'View My Orders', fr:'Voir Mes Commandes', es:'Ver Mis Pedidos', it:'Vedi I Miei Ordini', de:'Meine Bestellungen Ansehen', ru:'Посмотреть Мои Заказы', zh:'查看我的订单', tr:'Siparişlerimi Gör', fa:'مشاهده سفارشات من' },
  close_modal: { ar:'إغلاق', en:'Close', fr:'Fermer', es:'Cerrar', it:'Chiudi', de:'Schließen', ru:'Закрыть', zh:'关闭', tr:'Kapat', fa:'بستن' },
  no_products_found: { ar:'لم يتم العثور على منتجات', en:'No products found', fr:'Aucun produit trouvé', es:'No se encontraron productos', it:'Nessun prodotto trovato', de:'Keine Produkte gefunden', ru:'Продукты не найдены', zh:'未找到产品', tr:'Ürün bulunamadı', fa:'هیچ محصولی پیدا نشد' },
  products_count: { ar:'منتجات', en:'products', fr:'produits', es:'productos', it:'prodotti', de:'Produkte', ru:'продуктов', zh:'产品', tr:'ürün', fa:'محصول' },
  showing: { ar:'عرض', en:'Showing', fr:'Affichage', es:'Mostrando', it:'Visualizzazione', de:'Anzeige', ru:'Показ', zh:'显示', tr:'Gösterilen', fa:'نمایش' },
  results_for: { ar:'لـ', en:'for', fr:'pour', es:'para', it:'per', de:'für', ru:'для', zh:'的', tr:'için', fa:'برای' },
  search_query: { ar:'الاستعلام', en:'query', fr:'requête', es:'consulta', it:'query', de:'Abfrage', ru:'запрос', zh:'查询', tr:'sorgu', fa:'درخواست' },
};

interface ProductCatalogProps {
  onClose: () => void;
  currentLang: SupportedLanguage;
  retailerId: string;
}

export const ProductCatalog: React.FC<ProductCatalogProps> = ({ onClose, currentLang, retailerId }) => {
  const L = makeT(currentLang, S);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [minPrice, setMinPrice] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(10000);
  const [cart, setCart] = useState<Map<string, { product: MerchantProductRecord; qty: number }>>(new Map());
  const [showCart, setShowCart] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<MediationOrderRecord | null>(null);

  const allProducts = getApprovedActiveProducts();

  const merchantMap = useMemo(() => {
    const map = new Map<string, { id: string; nameAr: string; nameEn: string }>();
    allProducts.forEach(p => {
      if (p.merchantId && !map.has(p.merchantId)) {
        const m = getMerchantById(p.merchantId);
        if (m) map.set(p.merchantId, { id: m.id, nameAr: m.companyNameAr, nameEn: m.companyNameEn });
      }
    });
    return map;
  }, [allProducts]);

  const filteredProducts = useMemo(() => {
    return allProducts.filter(p => {
      if (activeCategory !== 'all' && p.category !== activeCategory) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!p.nameAr.toLowerCase().includes(q) && !p.nameEn.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q)) return false;
      }
      if (p.retailPrice < minPrice || p.retailPrice > maxPrice) return false;
      return true;
    });
  }, [allProducts, activeCategory, searchQuery, minPrice, maxPrice]);

  const cartTotalCost = Array.from(cart.values()).reduce((sum, item) => sum + item.product.costPrice * item.qty, 0);
  const cartTotalRetail = Array.from(cart.values()).reduce((sum, item) => sum + item.product.retailPrice * item.qty, 0);
  const cartPlatformRevenue = Array.from(cart.values()).reduce((sum, item) => sum + item.product.platformMargin * item.qty, 0);
  const cartCount = Array.from(cart.values()).reduce((sum, item) => sum + item.qty, 0);

  const addToCart = (product: MerchantProductRecord) => {
    setCart(prev => {
      const existing = prev.get(product.id);
      if (existing) {
        if (existing.qty < product.stock) {
          return new Map(prev).set(product.id, { ...existing, qty: existing.qty + 1 });
        }
      } else {
        return new Map(prev).set(product.id, { product, qty: 1 });
      }
      return prev;
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const existing = prev.get(productId);
      if (!existing) return prev;
      if (existing.qty > 1) {
        return new Map(prev).set(productId, { ...existing, qty: existing.qty - 1 });
      }
      return new Map(prev).delete(productId));
    });
  };

  const clearCart = () => setCart(new Map());

  const placeOrder = () => {
    if (cart.size === 0) return;

    const retailer = getOrCreateRetailer(retailerId);
    const merchantId = Array.from(cart.values())[0].product.merchantId;
    const merchant = getMerchantById(merchantId);

    const items: MediationOrderRecord['items'] = Array.from(cart.values()).map(item => ({
      productId: item.product.id,
      productNameAr: item.product.nameAr,
      productNameEn: item.product.nameEn,
      sku: item.product.sku,
      category: item.product.category,
      unit: item.product.unit,
      qty: item.qty,
      unitCostPrice: item.product.costPrice,
      unitRetailPrice: item.product.retailPrice,
      unitPlatformMargin: item.product.platformMargin,
      totalCost: item.product.costPrice * item.qty,
      totalRetail: item.product.retailPrice * item.qty,
      totalPlatformRevenue: item.product.platformMargin * item.qty,
    }));

    const order: MediationOrderRecord = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      orderNumber: `MD-2026-${String(getAllOrders().length + 1).padStart(4, '0')}`,
      merchantId,
      retailerId,
      retailerNameAr: retailer.shopNameAr || 'عميل',
      items,
      subtotalCost: cartTotalCost,
      subtotalRetail: cartTotalRetail,
      totalPlatformRevenue: cartPlatformRevenue,
      shippingAddress: { streetAr:'', streetEn:'', cityAr:'', cityEn:'', countryAr:'', countryEn:'' },
      status: 'pending',
      paymentStatus: 'unpaid',
      contactMethod: 'none',
      customerConfirm: true,
      merchantConfirm: false,
      platformConfirm: false,
      shippingMethod: 'pending',
      shippingCost: 0,
      deliveryNote: '',
      createdAt: '',
      updatedAt: '',
      confirmedAt: undefined,
      shippedAt: undefined,
      deliveredAt: undefined,
      completedAt: undefined,
      cancelledAt: undefined,
      refundAmount: null,
      refundReason: undefined,
      adminNotes: '',
    };

    saveOrder(order);
    incrementRetailerOrder(retailerId, cartTotalRetail, cartPlatformRevenue);
    clearCart();
    setOrderSuccess(order);
  };

  const categories = [
    { key:'all', label:L('all', currentLang) },
    { key:'عطور', label:L('fragrance', currentLang) },
    { key:'خامات', label:L('raw_materials', currentLang) },
    { key:'أدوات', label:L('tools', currentLang) },
    { key:'تغليف', label:L('packaging', currentLang) },
    { key:'غير ذلك', label:L('other', currentLang) },
  ];

  if (orderSuccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-600"/>
          </div>
          <h2 className="text-xl font-bold text-stone-900 mb-2 font-serif-luxury">{L('order_success_title', currentLang)}</h2>
          <p className="text-sm text-stone-600 mb-4">{L('order_success_msg', currentLang)}</p>
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/60 mb-4">
            <span className="text-xs text-stone-500">{L('order_number_prefix', currentLang)}</span>
            <span className="text-lg font-bold text-amber-900 font-mono">{orderSuccess.orderNumber}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg bg-amber-700 text-white text-sm font-medium hover:bg-amber-800 transition-colors">
              {L('close_modal', currentLang)}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-6xl max-h-[95vh] overflow-hidden rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in-95 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-gradient-to-r from-stone-900 to-amber-950 text-white rounded-t-2xl shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/30 flex items-center justify-center text-amber-300 font-bold">
              <ShoppingBag className="w-5 h-5"/>
            </div>
            <div>
              <h1 className="text-lg font-bold font-serif-luxury">{L('title', currentLang)}</h1>
              <p className="text-sm text-amber-200/80">
                {filteredProducts.length} {L('products_count', currentLang)} {L('showing', currentLang)} {filteredProducts.length}
                {L('results_for', currentLang)} "{searchQuery || activeCategory}"
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={()=>setShowCart(!showCart)} className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
              showCart ? 'bg-amber-600 text-white' : 'bg-white/10 hover:bg-white/20 text-white'
            }`}>
              <ShoppingBag className="w-4 h-4"/>
              <span className="text-xs font-bold">{cartCount}</span>
            </button>
            <button onClick={onClose} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
              <ChevronUp className="w-4 h-4"/>
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Categories Sidebar */}
          <div className="w-56 border-r border-stone-200 bg-stone-50/50 p-4 shrink-0 overflow-y-auto">
            <h3 className="text-xs font-bold text-stone-500 uppercase mb-3">{L('categories', currentLang)}</h3>
            <div className="space-y-1">
              {categories.map(cat => (
                <button key={cat.key} onClick={()=>setActiveCategory(cat.key)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeCategory===cat.key?'bg-amber-100 text-amber-900 font-bold':'text-stone-600 hover:bg-stone-100'
                  }`}>
                  {cat.label}
                  {cat.key!=='all' && (
                    <span className="ml-1 text-[10px] opacity-60">
                      ({allProducts.filter(p=>p.category===cat.key).length})
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-stone-200">
              <h3 className="text-xs font-bold text-stone-500 uppercase mb-2">{L('price_filter', currentLang)}</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Cents className="w-3.5 h-3.5 text-stone-400"/>
                  <input type="number" value={minPrice} onChange={e=>setMinPrice(parseFloat(e.target.value)||0)}
                    className="flex-1 px-2 py-1 rounded border border-stone-200 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300"/>
                </div>
                <div className="flex items-center gap-2">
                  <Cents className="w-3.5 h-3.5 text-stone-400"/>
                  <input type="number" value={maxPrice} onChange={e=>setMaxPrice(parseFloat(e.target.value)||10000)}
                    className="flex-1 px-2 py-1 rounded border border-stone-200 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300"/>
                </div>
                <button onClick={()=>{setMinPrice(0);setMaxPrice(10000);}} className="text-xs text-stone-400 hover:text-stone-600 w-full text-center py-1">
                  {L('reset', currentLang)}
                </button>
              </div>
            </div>
          </div>

          {/* Products Grid */}
          <div className="flex-1 overflow-auto p-6">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-12 h-12 mx-auto text-stone-300 mb-3"/>
                <p className="text-stone-500">{L('no_products_found', currentLang)}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProducts.map(product => {
                  const merchant = merchantMap.get(product.merchantId);
                  return (
                    <div key={product.id} className="p-4 rounded-xl border border-stone-200 hover:shadow-md transition-shadow group">
                      <div className="relative">
                        <div className="w-full h-32 rounded-lg bg-gradient-to-br from-amber-50 to-stone-100 flex items-center justify-center">
                          <Package className="w-8 h-8 text-amber-400/60"/>
                        </div>
                        <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          {L('product_card_stock', currentLang)}: {product.stock}
                        </span>
                      </div>
                      <div className="mt-3">
                        <div className="font-bold text-stone-900 text-sm line-clamp-2">{product.nameAr}</div>
                        <div className="text-xs text-stone-500 mt-0.5">{product.category} — {product.unit}</div>
                        <div className="text-xs text-stone-400 mt-0.5">
                          {merchant ? L('product_card_merchant', currentLang).replace('{merchantName}', merchant.nameAr) : ''}
                        </div>
                      </div>
                      <div className="mt-3 p-3 rounded-lg bg-amber-50/80 border border-amber-200/40">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-stone-500">{L('product_card_retail_price', currentLang)}</span>
                          <div className="text-right">
                            <span className="text-lg font-bold text-amber-900 font-mono">{product.retailPrice}</span>
                            <span className="text-xs text-amber-700">جنيه</span>
                          </div>
                        </div>
                        <div className="flex justify-between text-[10px] text-stone-400">
                          <span>{L('product_card_cost_price', currentLang)}: {product.costPrice} جنيه</span>
                          <span>{L('product_card_platform_revenue', currentLang)}: {product.platformMargin} جنيه</span>
                        </div>
                        <div className="mt-2 text-[10px] text-stone-400">
                          SKU: {product.sku} | {product.approvalStatus}
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        {product.stock > 0 ? (
                          <>
                            <button onClick={()=>addToCart(product)} className="flex-1 px-3 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1">
                              <Plus className="w-3 h-3"/> {L('add_to_cart', currentLang)}
                            </button>
                            <button className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-medium transition-colors">
                              {L('view_details', currentLang)}
                            </button>
                          </>
                        ) : (
                          <button disabled className="flex-1 px-3 py-2 bg-stone-100 text-stone-400 rounded-lg text-xs font-medium cursor-not-allowed">
                            نفذ
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Cart Drawer */}
        {showCart && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50 rounded-t-2xl shrink-0">
                <div className="flex items-center gap-3">
                  <ShoppingBag className="w-5 h-5 text-amber-700"/>
                  <h2 className="text-lg font-bold text-stone-900 font-serif-luxury">{L('cart_summary', currentLang)}</h2>
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-xs font-bold">{cartCount} {L('products_count', currentLang)}</span>
                </div>
                <button onClick={()=>setShowCart(false)} className="p-2 rounded-lg hover:bg-stone-100 text-stone-500">
                  <ChevronUp className="w-4 h-4"/>
                </button>
              </div>

              <div className="flex flex-1 overflow-hidden">
                {/* Cart Items */}
                <div className="flex-1 overflow-auto p-4">
                  {cart.size === 0 ? (
                    <div className="text-center py-8">
                      <ShoppingBag className="w-10 h-10 mx-auto text-stone-300 mb-2"/>
                      <p className="text-stone-500 text-sm">{L('cart_empty', currentLang)}</p>
                      <button onClick={()=>setShowCart(false)} className="mt-3 px-4 py-2 bg-amber-700 text-white rounded-lg text-sm font-medium hover:bg-amber-800">
                        {L('close_modal', currentLang)}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {Array.from(cart.entries()).map(([productId, item]) => {
                        const merchant = merchantMap.get(item.product.merchantId);
                        return (
                          <div key={productId} className="p-3 rounded-xl border border-stone-200">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-50 to-stone-100 flex items-center justify-center">
                                  <Package className="w-4 h-4 text-amber-400/60"/>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-bold text-stone-900 truncate">{item.product.nameAr}</div>
                                  <div className="text-xs text-stone-500">{item.product.category} — {merchant?.nameAr || 'Unknown'}</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-bold text-amber-900">{item.product.retailPrice} جنيه</div>
                                <span className="text-xs text-stone-400">{L('product_card_retail_price', currentLang)}</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <div className="flex items-center gap-2">
                                <button onClick={()=>removeFromCart(productId)} className="p-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-600">
                                  <Minus className="w-3 h-3"/>
                                </button>
                                <span className="text-sm font-bold w-6 text-center">{item.qty}</span>
                                <button onClick={()=>addToCart(item.product)} className="p-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-600 disabled:opacity-40">
                                  <Plus className="w-3 h-3"/>
                                </button>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-bold text-stone-900">{(item.product.retailPrice * item.qty).toLocaleString()} جنيه</div>
                                <button onClick={()=>removeFromCart(productId)} className="text-xs text-red-600 hover:text-red-800 mt-0.5 inline-block">
                                  <Trash2 className="w-3 h-3 inline"/> {L('cart_clear', currentLang)}
                                </button>
                              </div>
                            </div>
                            <div className="mt-1 text-[10px] text-stone-400 border-t border-stone-100 pt-1">
                              <div className="flex justify-between">
                                <span>{L('product_card_cost_price', currentLang)}: {item.product.costPrice} جنيه</span>
                                <span>{L('product_card_platform_revenue', currentLang)}: {item.product.platformMargin} جنيه</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Cart Summary */}
                {cart.size > 0 && (
                  <div className="w-72 border-l border-stone-200 bg-stone-50 p-4 shrink-0 overflow-y-auto">
                    <h3 className="text-xs font-bold text-stone-500 uppercase mb-3">{L('cart_summary', currentLang)}</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-stone-600">{L('cart_items', currentLang)}:</span>
                        <span className="font-bold">{cartCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-600">{L('cart_platform_revenue_total', currentLang)}:</span>
                        <span className="text-amber-700 font-bold">{cartPlatformRevenue.toLocaleString()} جنيه</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-500">{L('cart_total_cost', currentLang)}:</span>
                        <span className="text-blue-700 font-bold">{cartTotalCost.toLocaleString()} جنيه</span>
                      </div>
                      <div className="border-t border-stone-200 mt-2 pt-2 flex justify-between font-bold">
                        <span className="text-stone-900">{L('cart_total_retail', currentLang)}:</span>
                        <span className="text-emerald-700 text-lg">{cartTotalRetail.toLocaleString()} جنيه</span>
                      </div>
                    </div>
                    <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200/60">
                      <div className="flex items-center gap-1 mb-1">
                        <Shield className="w-4 h-4 text-emerald-600"/>
                        <span className="text-xs font-bold text-emerald-900">{L('admin_warning', currentLang)}</span>
                      </div>
                      <p className="text-[10px] text-emerald-700 mt-1">
                        {L('margin_info', currentLang)}
                      </p>
                    </div>
                    <button onClick={placeOrder} className="w-full mt-3 px-4 py-3 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2">
                      <ShoppingBag className="w-4 h-4"/>
                      {L('checkout_btn', currentLang)}
                    </button>
                    <button onClick={clearCart} className="w-full mt-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-medium transition-colors">
                      {L('cart_clear', currentLang)}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
