import { SupportedLanguage } from './i18n';

// ─── أنواع التجار ───────────────────────────────────────────

export type MerchantStatus = 'pending' | 'approved' | 'suspended' | 'active';
export type ProductApprovalStatus = 'pending' | 'approved' | 'rejected';
export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'completed' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded';
export type CommunicationChannel = 'email' | 'whatsapp' | 'phone' | 'other';

// بيانات الوسائل الاتصالية للتاجر
export interface MerchantChannels {
  email: boolean;
  whatsapp: boolean;
  phone: boolean;
  other: boolean;
  otherLabel?: string;
}

// تفاصيل الحساب البنكي للتصرفات
export interface MerchantBankingInfo {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  iban?: string;
}

// ─── التاجر (Merchant) ──────────────────────────────────────

export interface Merchant {
  id: string;
  companyNameAr: string;
  companyNameEn: string;
  registrationNumber: string;    // رقم السجل التجاري
  taxId: string;                 // الرقم الضريبي
  email: string;
  phone: string;
  whatsapp?: string;
  channels: MerchantChannels;    // وسائط التواصل (أو منشطة أو مخفية)
  approved: boolean;             // اعتماد من الإدارة
  isActive: boolean;             // مفتوح/مغلق
  marginPercent: number;         // 25% افتراضي — يمكن للإدارة تغييره لاحقاً
  bankingInfo?: MerchantBankingInfo;
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;          // إجمالي المبيعات (retail)
  totalPlatformRevenue: number;  // إجمالي أرباح المنصة من تاجر
  notes: string;                 // ملاحظات الإدارة
  status: MerchantStatus;
  createdAt: string;
  updatedAt: string;
}

// ─── منتج التاجر (MerchantProduct) ──────────────────────────

export interface MerchantProduct {
  id: string;
  merchantId: string;
  sku: string;                      // رمز المنتج (يديرة التاجر)
  nameAr: string;
  nameEn: string;
  category: string;                 // 'عطور', 'خامات', 'أدوات', 'تغليف', 'غير ذلك'
  unit: string;                     // 'لتر', 'جرام', 'زجةقة', 'مجموعة', 'قطعة'
  costPrice: number;                // سعر التاجر الجملة ←基准
  retailPrice: number;              // retailPrice = costPrice × 1.25  ← للعرض
  platformMargin: number;           // 25% من costPrice ← ربح المنصة
  costCurrency: string;             // العملة الافتراضية
  stock: number;                    // الكمية المتاحة
  minOrderQty: number;              // أقل كمية طلب
  descriptionAr: string;
  descriptionEn: string;
  imageUrl?: string;
  isActive: boolean;                // فعال 전시
  approvalStatus: ProductApprovalStatus; // pending/approved/rejected
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// ─── المستهلك/الشارِ (Retailer) ──────────────────────────────

export interface Retailer {
  id: string;
  userId?: string;                   // الربط مع المستخدم (إذا سجّل)
  shopNameAr: string;
  shopNameEn: string;
  location: string;
  trustScore: number;                // 0-100 — درجة الثقة
  totalOrders: number;
  totalSpent: number;                // إجمالي ما انفق
  totalPlatformRevenueSent: number;  // إجمالي ربح المنصة من هذا الزبون
  preferredLanguage: SupportedLanguage;
  createdAt: string;
  updatedAt: string;
}

// ─── حالة الطلب ─────────────────────────────────────────────────

export interface OrderItem {
  productId: string;
  productNameAr: string;
  productNameEn: string;
  sku: string;
  category: string;
  unit: string;
  qty: number;
  unitCostPrice: number;             // سعر الجملة لوحدة الواحدة
  unitRetailPrice: number;           // retailPrice للوحدة (مع 25%)
  unitPlatformMargin: number;        // 25% لوحدة
  totalCost: number;                 // unitCostPrice × qty
  totalRetail: number;               // unitRetailPrice × qty (دفع الزبون)
  totalPlatformRevenue: number;      // (retail - cost) × qty
}

// ─── أمر الوساطة (MediationOrder) ─────────────────────────────

export interface MediationOrder {
  id: string;
  orderNumber: string;               // MD-2026-XXXX
  merchantId: string;                // التاجر المورد
  retailerId: string;                // الزبون الطالب
  retailerNameAr: string;           // اسم متجر الزبون (للاستعراض)
  items: OrderItem[];
  subtotalCost: number;              // إجمالي costPrice = مضافة للتاجر
  subtotalRetail: number;            // إجمالي retailPrice = دفع الزبون
  totalPlatformRevenue: number;      // subtotalRetail - subtotalCost =ربح المنصة
  shippingAddress: {
    streetAr: string;
    streetEn: string;
    cityAr: string;
    cityEn: string;
    countryAr: string;
    countryEn: string;
  };
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  contactMethod: CommunicationChannel | 'none'; // كيف نتواصل مع التاجر في هذا الطلب
  customerConfirm: boolean;          // الزبون وافق على بدء التنفيذ
  merchantConfirm: boolean;          // التاجر وافق على التنفيذ
  platformConfirm: boolean;          // الوسيط وافق على التسليم
  shippingMethod: string;
  shippingCost: number;
  deliveryNote: string;              // ملاحظات التسليم
  courierTracking?: string;          // ر県道 التتبع
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;              // تاريخ التأكيد
  shippedAt?: string;                // تاريخ الشحن
  deliveredAt?: string;              // تاريخ التسليم
  completedAt?: string;              // تاريخ الإغلاق
  cancelledAt?: string;              // تاريخ الإلغاء
  refundAmount: number | null;
  refundReason?: string;
  adminNotes: string;                // ملاحظات الإدارة لكل طلب
}

// ─── سجل التواصل ──────────────────────────────────────────────

export interface CommunicationLog {
  id: string;
  merchantId: string;
  channel: CommunicationChannel;
  direction: 'inbound' | 'outbound';
  subject: string;
  content: string;
  createdAt: string;
}

// ─── ملاحظات الإدارة ────────────────────────────────────────────

export interface AdminNote {
  id: string;
  merchantId?: string;
  orderId?: string;
  retailerId?: string;
  type: 'general' | 'warning' | 'approval' | 'suspension' | 'channel_deletion' | 'channel_suspend';
  content: string;
  createdBy: string;                 // who made this note
  createdAt: string;
}
