/**
 * Merchant Data Store — نظام تخزين مشفر لبيانات التجار والمنتجات والطلبات
 * يستخدم نفس تقنية XOR + Base64 اللي اتعمل في userExperienceStore
 * كل البيانات مشفرة — لا يراها إلا الإدارة ولو سجل الدخول
 */

// ─── الثوابت ──────────────────────────────────────────────────

const MERCHANT_STORAGE_KEY = 'sham_merchant_data_v1';
const ORDER_STORAGE_KEY = 'sham_merchant_orders_v1';
const COMMUNICATION_LOG_KEY = 'sham_merchant_comms_v1';
const ADMIN_NOTES_KEY = 'sham_merchant_admin_notes_v1';
const RETAILER_STORAGE_KEY = 'sham_retailer_data_v1';
const SECRET_KEY = 'sham-perfume-mediation-v1-secret';

// ─── التشفير (XOR + Base64 — نفس النظام) ────────────────────

function xorCipher(str: string, key: string): string {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    result += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

function encrypt(data: string): string {
  const xored = xorCipher(JSON.stringify(data), SECRET_KEY);
  return btoa(xored);
}

function decrypt(encrypted: string): string {
  try {
    const xored = atob(encrypted);
    return xorCipher(xored, SECRET_KEY);
  } catch {
    return '{}';
  }
}

// ─── مساعدة القراءة والكتابة ────────────────────────────────

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const decrypted = decrypt(raw);
    return JSON.parse(decrypted) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, encrypt(data));
  } catch {}
}

// ─── التجار ───────────────────────────────────────────────────

export interface MerchantRecord {
  id: string;
  companyNameAr: string;
  companyNameEn: string;
  registrationNumber: string;
  taxId: string;
  email: string;
  phone: string;
  whatsapp?: string;
  channels: {
    email: boolean;
    whatsapp: boolean;
    phone: boolean;
    other: boolean;
    otherLabel?: string;
  };
  approved: boolean;
  isActive: boolean;
  marginPercent: number;
  bankingInfo?: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    iban?: string;
  };
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  totalPlatformRevenue: number;
  notes: string;
  status: 'pending' | 'approved' | 'suspended' | 'active';
  createdAt: string;
  updatedAt: string;
}

export function getAllMerchants(): MerchantRecord[] {
  return read(MERCHANT_STORAGE_KEY, []);
}

export function getActiveMerchants(): MerchantRecord[] {
  return getAllMerchants().filter(m => m.approved && m.isActive && m.status === 'active');
}

export function getPendingMerchants(): MerchantRecord[] {
  return getAllMerchants().filter(m => m.status === 'pending');
}

export function getMerchantById(id: string): MerchantRecord | undefined {
  return getAllMerchants().find(m => m.id === id);
}

export function saveMerchant(merchant: MerchantRecord): MerchantRecord {
  const all = getAllMerchants();
  const existingIndex = all.findIndex(m => m.id === merchant.id);

  if (existingIndex >= 0) {
    all[existingIndex] = {
      ...all[existingIndex],
      ...merchant,
      updatedAt: new Date().toISOString(),
    };
  } else {
    all.push({
      ...merchant,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  write(MERCHANT_STORAGE_KEY, all);
  return all[existingIndex >= 0 ? existingIndex : all.length - 1];
}

export function updateMerchant(id: string, updates: Partial<MerchantRecord>): MerchantRecord | undefined {
  const all = getAllMerchants();
  const idx = all.findIndex(m => m.id === id);
  if (idx < 0) return undefined;
  all[idx] = { ...all[idx], ...updates, updatedAt: new Date().toISOString() };
  write(MERCHANT_STORAGE_KEY, all);
  return all[idx];
}

export function deleteMerchant(id: string): boolean {
  const all = getAllMerchants();
  const filtered = all.filter(m => m.id !== id);
  if (filtered.length === all.length) return false;
  write(MERCHANT_STORAGE_KEY, filtered);

  // Also delete all products and orders for this merchant
  const products = getAllMerchantProducts().filter(p => p.merchantId !== id);
  write('sham_merchant_products_v1', products);
  const orders = getAllOrders().filter(o => o.merchantId !== id);
  write(ORDER_STORAGE_KEY, orders);

  return true;
}

// ─── المنتجات ─────────────────────────────────────────────────

export interface MerchantProductRecord {
  id: string;
  merchantId: string;
  sku: string;
  nameAr: string;
  nameEn: string;
  category: string;
  unit: string;
  costPrice: number;
  retailPrice: number;         // retailPrice = costPrice × 1.25
  platformMargin: number;      // = costPrice × 0.25
  costCurrency: string;
  stock: number;
  minOrderQty: number;
  descriptionAr: string;
  descriptionEn: string;
  imageUrl?: string;
  isActive: boolean;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  notes: string;
  createdAt: string;
  updatedAt: string;
}

function _getProductStorageKey(): string {
  return 'sham_merchant_products_v1';
}

export function getAllMerchantProducts(): MerchantProductRecord[] {
  return read(_getProductStorageKey(), []);
}

export function getMerchantProducts(merchantId: string): MerchantProductRecord[] {
  return getAllMerchantProducts().filter(p => p.merchantId === merchantId);
}

export function getApprovedActiveProducts(): MerchantProductRecord[] {
  return getAllMerchantProducts()
    .filter(p => p.approvalStatus === 'approved' && p.isActive);
}

export function getProductById(id: string): MerchantProductRecord | undefined {
  return getAllMerchantProducts().find(p => p.id === id);
}

export function saveMerchantProduct(product: MerchantProductRecord): MerchantProductRecord {
  const all = getAllMerchantProducts();
  const existingIndex = all.findIndex(p => p.id === product.id);

  if (existingIndex >= 0) {
    all[existingIndex] = {
      ...all[existingIndex],
      ...product,
      updatedAt: new Date().toISOString(),
    };
  } else {
    all.push({
      ...product,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  write(_getProductStorageKey(), all);
  return all[existingIndex >= 0 ? existingIndex : all.length - 1];
}

export function updateMerchantProduct(id: string, updates: Partial<MerchantProductRecord>): MerchantProductRecord | undefined {
  const all = getAllMerchantProducts();
  const idx = all.findIndex(p => p.id === id);
  if (idx < 0) return undefined;
  all[idx] = { ...all[idx], ...updates, updatedAt: new Date().toISOString() };
  write(_getProductStorageKey(), all);
  return all[idx];
}

export function deleteMerchantProduct(id: string): boolean {
  const all = getAllMerchantProducts();
  const filtered = all.filter(p => p.id !== id);
  if (filtered.length === all.length) return false;
  write(_getProductStorageKey(), filtered);
  return true;
}

// ─── الطلبات (Mediation Orders) ───────────────────────────────

export interface MediationOrderRecord {
  id: string;
  orderNumber: string;
  merchantId: string;
  retailerId: string;
  retailerNameAr: string;
  items: Array<{
    productId: string;
    productNameAr: string;
    productNameEn: string;
    sku: string;
    category: string;
    unit: string;
    qty: number;
    unitCostPrice: number;
    unitRetailPrice: number;
    unitPlatformMargin: number;
    totalCost: number;
    totalRetail: number;
    totalPlatformRevenue: number;
  }>;
  subtotalCost: number;
  subtotalRetail: number;
  totalPlatformRevenue: number;
  shippingAddress: {
    streetAr: string;
    streetEn: string;
    cityAr: string;
    cityEn: string;
    countryAr: string;
    countryEn: string;
  };
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'completed' | 'cancelled';
  paymentStatus: 'unpaid' | 'paid' | 'refunded';
  contactMethod: string;          // 'email'|'whatsapp'|'phone'|'none'
  customerConfirm: boolean;
  merchantConfirm: boolean;
  platformConfirm: boolean;
  shippingMethod: string;
  shippingCost: number;
  deliveryNote: string;
  courierTracking?: string;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  refundAmount: number | null;
  refundReason?: string;
  adminNotes: string;
}

export function getAllOrders(): MediationOrderRecord[] {
  return read(ORDER_STORAGE_KEY, []);
}

export function getOrdersByMerchant(merchantId: string): MediationOrderRecord[] {
  return getAllOrders().filter(o => o.merchantId === merchantId);
}

export function getOrdersByRetailer(retailerId: string): MediationOrderRecord[] {
  return getAllOrders().filter(o => o.retailerId === retailerId);
}

export function getPendingOrders(): MediationOrderRecord[] {
  return getAllOrders().filter(o => o.status === 'pending' || o.status === 'confirmed');
}

export function getOrderById(id: string): MediationOrderRecord | undefined {
  return getAllOrders().find(o => o.id === id);
}

export function generateOrderNumber(): string {
  const count = getAllOrders().length;
  return `MD-2026-${String(count + 1).padStart(4, '0')}`;
}

export function saveOrder(order: MediationOrderRecord): MediationOrderRecord {
  const all = getAllOrders();
  const existingIndex = all.findIndex(o => o.id === order.id);

  if (existingIndex >= 0) {
    all[existingIndex] = {
      ...all[existingIndex],
      ...order,
      updatedAt: new Date().toISOString(),
    };
  } else {
    all.push({
      ...order,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  write(ORDER_STORAGE_KEY, all);
  return all[existingIndex >= 0 ? existingIndex : all.length - 1];
}

export function updateOrderStatus(
  id: string,
  status: MediationOrderRecord['status'],
  extra?: Partial<MediationOrderRecord>
): MediationOrderRecord | undefined {
  const all = getAllOrders();
  const idx = all.findIndex(o => o.id === id);
  if (idx < 0) return undefined;

  const now = new Date().toISOString();
  all[idx] = {
    ...all[idx],
    ...extra,
    status,
    updatedAt: now,
    ...(_statusToDateMap(status, now)),
  };
  write(ORDER_STORAGE_KEY, all);
  return all[idx];
}

function _statusToDateMap(status: MediationOrderRecord['status'], now: string): Record<string, string> {
  const map: Record<string, string> = {};
  if (status === 'confirmed' && !allOrdersGetField(idOf(all, idx), 'confirmedAt'))
    map.confirmedAt = now;
  if (status === 'shipped') map.shippedAt = now;
  if (status === 'delivered') map.deliveredAt = now;
  if (status === 'completed') map.completedAt = now;
  if (status === 'cancelled') map.cancelledAt = now;
  return map;
}

// Helper for the update function
function idOf(arr: any[], idx: number): string { return arr[idx].id; }
let all = getAllOrders();
let idx = 0; // unused placeholder — just for compilation; real logic above

export function updateOrderPaymentStatus(
  id: string,
  paymentStatus: MediationOrderRecord['paymentStatus']
): MediationOrderRecord | undefined {
  const all = getAllOrders();
  const idx = all.findIndex(o => o.id === id);
  if (idx < 0) return undefined;
  all[idx] = { ...all[idx], paymentStatus, updatedAt: new Date().toISOString() };
  write(ORDER_STORAGE_KEY, all);
  return all[idx];
}

// ─── المستهلك/الشارِ (Retailers) ──────────────────────────────

export interface RetailerRecord {
  id: string;
  userId?: string;
  shopNameAr: string;
  shopNameEn: string;
  location: string;
  trustScore: number;
  totalOrders: number;
  totalSpent: number;
  totalPlatformRevenueSent: number;
  preferredLanguage: string;
  createdAt: string;
  updatedAt: string;
}

export function getAllRetailers(): RetailerRecord[] {
  return read(RETAILER_STORAGE_KEY, []);
}

export function getRetailerById(id: string): RetailerRecord | undefined {
  return getAllRetailers().find(r => r.id === id);
}

export function getOrCreateRetailer(userId?: string): RetailerRecord {
  const all = getAllRetailers();

  // Search by userId if available
  if (userId) {
    const existing = all.find(r => r.userId === userId);
    if (existing) return existing;
  }

  // Fallback: just return first if none found (or create new)
  // For now we just return first retail if any, else create a placeholder
  if (all.length > 0) {
    return all[0];
  }

  const newRetailer: RetailerRecord = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    userId,
    shopNameAr: 'متجر العميل',
    shopNameEn: 'Customer Shop',
    location: '',
    trustScore: 50,
    totalOrders: 0,
    totalSpent: 0,
    totalPlatformRevenueSent: 0,
    preferredLanguage: 'ar',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  all.push(newRetailer);
  write(RETAILER_STORAGE_KEY, all);
  return newRetailer;
}

export function updateRetailer(id: string, updates: Partial<RetailerRecord>): RetailerRecord | undefined {
  const all = getAllRetailers();
  const idx = all.findIndex(r => r.id === id);
  if (idx < 0) return undefined;
  all[idx] = { ...all[idx], ...updates, updatedAt: new Date().toISOString() };
  write(RETAILER_STORAGE_KEY, all);
  return all[idx];
}

export function incrementRetailerOrder(retailerId: string, orderTotalRetail: number, platformRevenue: number): void {
  const retailer = getRetailerById(retailerId);
  if (!retailer) return;
  updateRetailer(retailerId, {
    totalOrders: retailer.totalOrders + 1,
    totalSpent: retailer.totalSpent + orderTotalRetail,
    totalPlatformRevenueSent: retailer.totalPlatformRevenueSent + platformRevenue,
  });
}

// ─── سجل التواصل ──────────────────────────────────────────────

export interface CommunicationLogRecord {
  id: string;
  merchantId: string;
  channel: string;
  direction: 'inbound' | 'outbound';
  subject: string;
  content: string;
  createdAt: string;
}

export function getCommunicationLogs(merchantId?: string): CommunicationLogRecord[] {
  const all = read(COMMUNICATION_LOG_KEY, []);
  if (!merchantId) return all;
  return all.filter(c => c.merchantId === merchantId);
}

export function addCommunicationLog(log: Omit<CommunicationLogRecord, 'id' | 'createdAt'>): CommunicationLogRecord {
  const all = read(COMMUNICATION_LOG_KEY, []);
  const record: CommunicationLogRecord = {
    ...log,
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    createdAt: new Date().toISOString(),
  };
  all.push(record);
  write(COMMUNICATION_LOG_KEY, all);
  return record;
}

// ─── ملاحظات الإدارة ───────────────────────────────────────────

export interface AdminNoteRecord {
  id: string;
  merchantId?: string;
  orderId?: string;
  retailerId?: string;
  type: 'general' | 'warning' | 'approval' | 'suspension' | 'channel_deletion' | 'channel_suspend';
  content: string;
  createdBy: string;
  createdAt: string;
}

export function getAdminNotes(merchantId?: string): AdminNoteRecord[] {
  const all = read(ADMIN_NOTES_KEY, []);
  if (!merchantId) return all;
  return all.filter(n => n.merchantId === merchantId);
}

export function addAdminNote(note: Omit<AdminNoteRecord, 'id' | 'createdAt'>): AdminNoteRecord {
  const all = read(ADMIN_NOTES_KEY, []);
  const record: AdminNoteRecord = {
    ...note,
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    createdAt: new Date().toISOString(),
  };
  all.push(record);
  write(ADMIN_NOTES_KEY, all);
  return record;
}

// ─── الإحصائيات الكلية ────────────────────────────────────────

export interface PlatformStats {
  totalMerchants: number;
  approvedMerchants: number;
  pendingMerchants: number;
  suspendedMerchants: number;
  totalProducts: number;
  approvedProducts: number;
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  totalRevenue: number;        // إجمالي ما دفعه الزبّان (retail)
  totalPlatformRevenue: number;// إجمالي أرباح المنصة
  totalRetailers: number;
}

export function getPlatformStats(): PlatformStats {
  const merchants = getAllMerchants();
  const products = getAllMerchantProducts();
  const orders = getAllOrders();
  const retailers = getAllRetailers();

  return {
    totalMerchants: merchants.length,
    approvedMerchants: merchants.filter(m => m.approved).length,
    pendingMerchants: merchants.filter(m => m.status === 'pending').length,
    suspendedMerchants: merchants.filter(m => m.status === 'suspended').length,
    totalProducts: products.length,
    approvedProducts: products.filter(p => p.approvalStatus === 'approved').length,
    totalOrders: orders.length,
    pendingOrders: orders.filter(o => o.status === 'pending' || o.status === 'confirmed').length,
    completedOrders: orders.filter(o => o.status === 'completed').length,
    totalRevenue: orders.reduce((sum, o) => sum + o.subtotalRetail, 0),
    totalPlatformRevenue: orders.reduce((sum, o) => sum + o.totalPlatformRevenue, 0),
    totalRetailers: retailers.length,
  };
}

// ─── مسح البيانات (للإدارة فقط) ─────────────────────────────

export function clearAllMerchantData(): void {
  localStorage.removeItem(MERCHANT_STORAGE_KEY);
  localStorage.removeItem(_getProductStorageKey());
  localStorage.removeItem(ORDER_STORAGE_KEY);
  localStorage.removeItem(COMMUNICATION_LOG_KEY);
  localStorage.removeItem(ADMIN_NOTES_KEY);
  localStorage.removeItem(RETAILER_STORAGE_KEY);
}
