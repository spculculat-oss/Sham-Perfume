import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  ShieldCheck,
  Lock,
  Wallet,
  Plus,
  Trash2,
  CheckCircle2,
  Star,
  Smartphone,
  X,
  Sparkles,
  Landmark,
  FileText,
  Check,
  Building,
  Info,
  Layers,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { isRTL } from '../لغات/localizedContent';
import {
  getSavedPaymentMethods,
  savePaymentMethod,
  deletePaymentMethod,
  setDefaultPaymentMethod,
  getPaymentTransactions,
  detectCardBrand,
  formatCardNumber,
  formatExpiry,
  type SavedPaymentMethod,
  type PaymentProvider,
  type PaymentServiceType,
  type PaymentTransactionRecord,
} from '../utils/customerPaymentVault';

interface Props {
  currentLang?: SupportedLanguage;
  customerId?: string;
  customerName?: string;
  onClose: () => void;
  onSelectMethod?: (method: SavedPaymentMethod) => void;
  selectableMode?: boolean;
}

const PROVIDER_METAS: Record<
  PaymentProvider,
  { nameAr: string; nameEn: string; color: string; badge: string; type: PaymentServiceType }
> = {
  visa: { nameAr: 'فيزا (Visa)', nameEn: 'Visa', color: 'from-blue-700 via-indigo-800 to-stone-900', badge: 'VISA', type: 'card' },
  mastercard: { nameAr: 'ماستركارد (Mastercard)', nameEn: 'Mastercard', color: 'from-amber-600 via-rose-700 to-stone-900', badge: 'MC', type: 'card' },
  mada: { nameAr: 'مدى (Mada)', nameEn: 'Mada', color: 'from-emerald-700 via-teal-800 to-stone-900', badge: 'MADA', type: 'card' },
  meeza: { nameAr: 'ميزة الوطنية (Meeza)', nameEn: 'Meeza', color: 'from-cyan-800 via-blue-900 to-stone-900', badge: 'MEEZA', type: 'card' },
  amex: { nameAr: 'أمريكان إكسبريس (AMEX)', nameEn: 'AMEX', color: 'from-sky-700 via-blue-800 to-stone-900', badge: 'AMEX', type: 'card' },
  vodafone_cash: { nameAr: 'فودافون كاش', nameEn: 'Vodafone Cash', color: 'from-red-600 via-rose-700 to-stone-900', badge: 'VF CASH', type: 'wallet' },
  orange_cash: { nameAr: 'أورنج كاش', nameEn: 'Orange Cash', color: 'from-orange-600 via-amber-700 to-stone-900', badge: 'ORANGE', type: 'wallet' },
  we_pay: { nameAr: 'وي باي (WE Pay)', nameEn: 'WE Pay', color: 'from-purple-700 via-indigo-900 to-stone-900', badge: 'WE PAY', type: 'wallet' },
  etisalat_cash: { nameAr: 'إتصالات كاش', nameEn: 'Etisalat Cash', color: 'from-emerald-600 via-teal-800 to-stone-900', badge: 'ETISALAT', type: 'wallet' },
  stc_pay: { nameAr: 'STC Pay / Urpay', nameEn: 'STC Pay', color: 'from-purple-800 via-violet-900 to-stone-900', badge: 'STC PAY', type: 'wallet' },
  instapay: { nameAr: 'إنستاباي اللحظي (InstaPay)', nameEn: 'InstaPay Direct', color: 'from-violet-700 via-purple-900 to-stone-900', badge: 'INSTAPAY', type: 'instapay' },
  tabby: { nameAr: 'تابي (4 دفعات بدون فوائد)', nameEn: 'Tabby (4 Payments)', color: 'from-emerald-600 via-teal-700 to-stone-900', badge: 'TABBY', type: 'bnpl' },
  tamara: { nameAr: 'تمارا (قسّم مشترياتك)', nameEn: 'Tamara', color: 'from-amber-600 via-orange-700 to-stone-900', badge: 'TAMARA', type: 'bnpl' },
  valu: { nameAr: 'فاليو (valU للتقسيط)', nameEn: 'valU', color: 'from-blue-800 via-cyan-900 to-stone-900', badge: 'VALU', type: 'bnpl' },
  apple_pay: { nameAr: 'آبل باي (Apple Pay)', nameEn: 'Apple Pay', color: 'from-stone-900 via-stone-800 to-black', badge: 'APPLE PAY', type: 'express' },
  google_pay: { nameAr: 'جوجل باي (Google Pay)', nameEn: 'Google Pay', color: 'from-stone-800 via-stone-900 to-black', badge: 'G PAY', type: 'express' },
  cod: { nameAr: 'الدفع عند الاستلام', nameEn: 'Cash on Delivery', color: 'from-amber-800 via-amber-900 to-stone-900', badge: 'COD', type: 'cod' },
};

export const PaymentEnvironmentModal: React.FC<Props> = ({
  currentLang = 'ar',
  customerId = 'guest_client',
  customerName = 'عميل شام',
  onClose,
  onSelectMethod,
  selectableMode = false,
}) => {
  const rtl = isRTL(currentLang);
  const [activeTab, setActiveTab] = useState<'methods' | 'add' | 'services' | 'security' | 'history'>('methods');
  const [methods, setMethods] = useState<SavedPaymentMethod[]>([]);
  const [transactions, setTransactions] = useState<PaymentTransactionRecord[]>([]);

  // Form State for Adding New Payment Method
  const [serviceType, setServiceType] = useState<PaymentServiceType>('card');
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState(customerName);
  const [expiry, setExpiry] = useState('');
  const [cardNickname, setCardNickname] = useState('');
  const [walletPhone, setWalletPhone] = useState('');
  const [walletProvider, setWalletProvider] = useState<PaymentProvider>('vodafone_cash');
  const [instapayHandle, setInstapayHandle] = useState('');
  const [bnplProvider, setBnplProvider] = useState<PaymentProvider>('tabby');
  const [isDefault, setIsDefault] = useState(false);
  const [savedSuccessMsg, setSavedSuccessMsg] = useState('');

  const loadData = () => {
    setMethods(getSavedPaymentMethods(customerId));
    setTransactions(getPaymentTransactions(customerId));
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('sham-payment-methods-updated', handleUpdate);
    return () => window.removeEventListener('sham-payment-methods-updated', handleUpdate);
  }, [customerId]);

  const detectedBrand = detectCardBrand(cardNumber);

  const handleAddMethod = (e: React.FormEvent) => {
    e.preventDefault();

    if (serviceType === 'card') {
      const cleanDigits = cardNumber.replace(/\D/g, '');
      if (cleanDigits.length < 13) return;
      const last4 = cleanDigits.slice(-4);
      const brand = detectedBrand;
      const meta = PROVIDER_METAS[brand];

      savePaymentMethod(
        {
          customerId,
          type: 'card',
          title: cardNickname.trim() || `${meta.nameAr} •••• ${last4}`,
          titleEn: cardNickname.trim() || `${meta.nameEn} •••• ${last4}`,
          provider: brand,
          identifier: `•••• •••• •••• ${last4}`,
          holderName: cardHolder.trim() || customerName,
          expiry: expiry.trim() || '12/28',
          isDefault,
          metadata: {
            last4,
            brandName: meta.nameEn,
            colorGradient: meta.color,
          },
        },
        customerId
      );
    } else if (serviceType === 'wallet') {
      const meta = PROVIDER_METAS[walletProvider];
      const cleanPhone = walletPhone.trim();
      const maskedPhone = cleanPhone.length > 7
        ? `${cleanPhone.slice(0, 3)} •••• ${cleanPhone.slice(-4)}`
        : cleanPhone;

      savePaymentMethod(
        {
          customerId,
          type: 'wallet',
          title: `${meta.nameAr} (${cleanPhone})`,
          titleEn: `${meta.nameEn} (${cleanPhone})`,
          provider: walletProvider,
          identifier: maskedPhone,
          holderName: cardHolder.trim() || customerName,
          isDefault,
          metadata: {
            phone: cleanPhone,
            brandName: meta.nameEn,
            colorGradient: meta.color,
          },
        },
        customerId
      );
    } else if (serviceType === 'instapay') {
      const handle = instapayHandle.includes('@') ? instapayHandle.trim() : `${instapayHandle.trim()}@instapay`;
      savePaymentMethod(
        {
          customerId,
          type: 'instapay',
          title: `إنستاباي (${handle})`,
          titleEn: `InstaPay (${handle})`,
          provider: 'instapay',
          identifier: handle,
          holderName: cardHolder.trim() || customerName,
          isDefault,
          metadata: {
            ipaHandle: handle,
            brandName: 'InstaPay',
            colorGradient: PROVIDER_METAS.instapay.color,
          },
        },
        customerId
      );
    } else if (serviceType === 'bnpl') {
      const meta = PROVIDER_METAS[bnplProvider];
      savePaymentMethod(
        {
          customerId,
          type: 'bnpl',
          title: `${meta.nameAr} - تقسيط مرن`,
          titleEn: `${meta.nameEn} - Flexible Installments`,
          provider: bnplProvider,
          identifier: 'معتمد ومؤهل للتقسيط 4 دفعات',
          holderName: cardHolder.trim() || customerName,
          isDefault,
          metadata: {
            installmentsCount: 4,
            brandName: meta.nameEn,
            colorGradient: meta.color,
          },
        },
        customerId
      );
    }

    setSavedSuccessMsg(
      currentLang === 'ar'
        ? 'تم حفظ وسيلة الدفع وتأمينها بنجاح في محفظتك!'
        : 'Payment method securely saved to your wallet!'
    );

    // Reset Form
    setCardNumber('');
    setExpiry('');
    setCardNickname('');
    setWalletPhone('');
    setInstapayHandle('');
    setIsDefault(false);
    loadData();

    setTimeout(() => {
      setSavedSuccessMsg('');
      setActiveTab('methods');
    }, 1500);
  };

  const handleDelete = (id: string) => {
    deletePaymentMethod(id, customerId);
    loadData();
  };

  const handleSetDefault = (id: string) => {
    setDefaultPaymentMethod(id, customerId);
    loadData();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      dir={rtl ? 'rtl' : 'ltr'}
    >
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden border border-stone-200 relative my-auto animate-in fade-in zoom-in-95 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-stone-950 via-stone-900 to-amber-950 text-white p-4 sm:p-6 shrink-0 border-b border-amber-900/40 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 end-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-stone-300 hover:text-white transition-colors cursor-pointer"
            aria-label={currentLang === 'ar' ? 'إغلاق' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-stone-950 flex items-center justify-center font-bold shadow-md shrink-0">
              <ShieldCheck className="w-7 h-7 text-stone-950" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-xl font-extrabold text-white">
                  {currentLang === 'ar'
                    ? 'بيئة الدفع الآمنة ومحفظة العميل'
                    : 'Secure Payment Environment & Customer Vault'}
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  PCI-DSS Level 1 · 256-Bit SSL
                </span>
              </div>
              <p className="text-xs text-stone-300 mt-1 max-w-xl">
                {currentLang === 'ar'
                  ? 'إدارة وحفظ البطاقات والمحافظ الإلكترونية وخدمات إنستاباي والتقسيط للدفع الفوري بنقرة واحدة.'
                  : 'Manage and securely tokenize your cards, mobile wallets, InstaPay, and BNPL for 1-click checkout.'}
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto mt-5 pt-3 border-t border-white/10 text-xs">
            {[
              {
                id: 'methods',
                label: currentLang === 'ar' ? `وسائل الدفع المحفوظة (${methods.length})` : `Saved Methods (${methods.length})`,
                icon: CreditCard,
              },
              {
                id: 'add',
                label: currentLang === 'ar' ? '+ إضافة وسيلة دفع' : '+ Add Payment Method',
                icon: Plus,
              },
              {
                id: 'services',
                label: currentLang === 'ar' ? 'خدمات الدفع المعتمدة' : 'Supported Gateways',
                icon: Layers,
              },
              {
                id: 'security',
                label: currentLang === 'ar' ? 'الأمان والتشفير' : 'Security & Trust',
                icon: Lock,
              },
              {
                id: 'history',
                label: currentLang === 'ar' ? 'سجل العمليات' : 'Payment History',
                icon: FileText,
              },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-amber-500 text-stone-950 shadow-xs'
                      : 'text-stone-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: SAVED METHODS */}
          {activeTab === 'methods' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-stone-900">
                    {currentLang === 'ar' ? 'وسائل الدفع الجاهزة للاستخدام' : 'Saved Payment Methods for 1-Click Checkout'}
                  </h3>
                  <p className="text-xs text-stone-500">
                    {currentLang === 'ar'
                      ? 'تُحفظ البطاقات والمحافظ برمز أمان مشفر (Token) وفق معايير الحماية المصرفية.'
                      : 'Cards and wallets are safely tokenized following banking PCI standards.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('add')}
                  className="px-3 py-1.5 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{currentLang === 'ar' ? 'إضافة وسيلة جديدة' : 'Add New'}</span>
                </button>
              </div>

              {methods.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50 space-y-3">
                  <CreditCard className="w-10 h-10 text-stone-300 mx-auto" />
                  <p className="text-sm font-bold text-stone-700">
                    {currentLang === 'ar' ? 'لا توجد وسائل دفع محفوظة حتى الآن' : 'No saved payment methods yet'}
                  </p>
                  <p className="text-xs text-stone-500 max-w-md mx-auto">
                    {currentLang === 'ar'
                      ? 'أضف بطاقتك الائتمانية أو محفظتك الإلكترونية لحفظها وتسريع عمليات الشراء المستقبلية.'
                      : 'Add your credit card or mobile wallet to enable quick 1-click purchases.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('add')}
                    className="mt-2 px-4 py-2 bg-amber-800 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{currentLang === 'ar' ? 'إضافة أول وسيلة دفع' : 'Add First Payment Method'}</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {methods.map((method) => {
                    const meta = PROVIDER_METAS[method.provider] || PROVIDER_METAS.visa;
                    return (
                      <div
                        key={method.id}
                        className={`rounded-2xl p-4 sm:p-5 border transition-all relative overflow-hidden flex flex-col justify-between ${
                          method.isDefault
                            ? 'border-amber-400 bg-gradient-to-br from-amber-50/60 to-white ring-2 ring-amber-400/40 shadow-sm'
                            : 'border-stone-200 bg-white hover:border-amber-200 hover:shadow-xs'
                        }`}
                      >
                        {/* Top Bar inside card */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-stone-900 text-white font-mono text-[10px] font-bold tracking-wider">
                              {meta.badge}
                            </span>
                            <span className="font-extrabold text-stone-900 text-sm">
                              {currentLang === 'ar' ? method.title : method.titleEn}
                            </span>
                          </div>
                          {method.isDefault && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold flex items-center gap-1 shrink-0">
                              <Star className="w-3 h-3 text-amber-600 fill-amber-500" />
                              <span>{currentLang === 'ar' ? 'الافتراضية' : 'Default'}</span>
                            </span>
                          )}
                        </div>

                        {/* Identifier & Holder */}
                        <div className="my-3 space-y-1">
                          <div className="text-base font-mono font-bold text-stone-800 tracking-wider">
                            {method.identifier}
                          </div>
                          <div className="text-xs text-stone-500 flex items-center justify-between">
                            <span>{method.holderName}</span>
                            {method.expiry && (
                              <span className="font-mono">{method.expiry}</span>
                            )}
                          </div>
                        </div>

                        {/* Card Actions */}
                        <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2 text-xs">
                          {selectableMode ? (
                            <button
                              type="button"
                              onClick={() => onSelectMethod?.(method)}
                              className="px-3 py-1 bg-amber-800 hover:bg-amber-900 text-white font-bold rounded-lg cursor-pointer"
                            >
                              {currentLang === 'ar' ? 'اختيار للدفع الآن' : 'Select for Payment'}
                            </button>
                          ) : (
                            <div>
                              {!method.isDefault && (
                                <button
                                  type="button"
                                  onClick={() => handleSetDefault(method.id)}
                                  className="text-stone-600 hover:text-amber-800 font-semibold cursor-pointer"
                                >
                                  {currentLang === 'ar' ? 'تعيين كافتراضية' : 'Set as default'}
                                </button>
                              )}
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDelete(method.id)}
                            className="p-1.5 text-stone-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                            title={currentLang === 'ar' ? 'حذف الوسيلة' : 'Delete'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ADD NEW PAYMENT METHOD */}
          {activeTab === 'add' && (
            <div className="space-y-5 max-w-2xl mx-auto">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-stone-900">
                  {currentLang === 'ar' ? 'إضافة وسيلة دفع جديدة وحفظها' : 'Add & Save New Payment Method'}
                </h3>
                <p className="text-xs text-stone-500">
                  {currentLang === 'ar'
                    ? 'اختر الخدمة المالية التي تفضلها ليتم حفظها في ملفك برمز أمان مصرفي مشفر.'
                    : 'Select your preferred payment gateway service to tokenize securely.'}
                </p>
              </div>

              {/* Service Type Switcher */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'card', label: currentLang === 'ar' ? 'بطاقة بنكية' : 'Card', icon: CreditCard },
                  { id: 'wallet', label: currentLang === 'ar' ? 'محفظة ذكية' : 'Mobile Wallet', icon: Smartphone },
                  { id: 'instapay', label: currentLang === 'ar' ? 'إنستاباي' : 'InstaPay', icon: Landmark },
                  { id: 'bnpl', label: currentLang === 'ar' ? 'تقسيط مرن' : 'BNPL / Tabby', icon: Sparkles },
                ].map((s) => {
                  const Icon = s.icon;
                  const isCur = serviceType === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setServiceType(s.id as PaymentServiceType)}
                      className={`p-3 rounded-2xl border text-center flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                        isCur
                          ? 'border-amber-600 bg-amber-50 text-amber-900 font-bold ring-1 ring-amber-400'
                          : 'border-stone-200 bg-stone-50/60 hover:bg-white text-stone-700'
                      }`}
                    >
                      <Icon className="w-5 h-5 text-amber-700" />
                      <span className="text-xs">{s.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Form by Service Type */}
              <form onSubmit={handleAddMethod} className="space-y-4 bg-stone-50 p-4 sm:p-6 rounded-2xl border border-stone-200">
                {serviceType === 'card' && (
                  <div className="space-y-3">
                    {/* Interactive Live Card Preview */}
                    <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-amber-950 text-white p-5 rounded-2xl shadow-lg space-y-4 max-w-sm mx-auto border border-amber-500/20">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono tracking-widest text-amber-300">SHAM PAY VAULT</span>
                        <span className="px-2 py-0.5 rounded bg-white/20 text-white font-mono text-xs font-bold uppercase">
                          {detectedBrand}
                        </span>
                      </div>
                      <div className="text-lg font-mono tracking-widest text-center text-amber-100">
                        {cardNumber ? formatCardNumber(cardNumber) : '•••• •••• •••• ••••'}
                      </div>
                      <div className="flex items-center justify-between text-xs text-stone-300 font-mono">
                        <div>
                          <span className="block text-[9px] text-stone-400">CARDHOLDER</span>
                          <span className="font-bold text-white uppercase">{cardHolder || 'CUSTOMER NAME'}</span>
                        </div>
                        <div>
                          <span className="block text-[9px] text-stone-400">EXPIRES</span>
                          <span className="font-bold text-white">{expiry || 'MM/YY'}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        {currentLang === 'ar' ? 'رقم البطاقة (16 رقماً)' : 'Card Number'}
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={19}
                        placeholder="4242 •••• •••• 4242"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-mono focus:outline-none focus:border-amber-700"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-stone-700 mb-1">
                          {currentLang === 'ar' ? 'تاريخ الانتهاء' : 'Expiry Date'}
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={5}
                          placeholder="MM/YY"
                          value={expiry}
                          onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-mono focus:outline-none focus:border-amber-700"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-stone-700 mb-1">
                          {currentLang === 'ar' ? 'اسم صاحب البطاقة' : 'Cardholder Name'}
                        </label>
                        <input
                          type="text"
                          required
                          placeholder={customerName}
                          value={cardHolder}
                          onChange={(e) => setCardHolder(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs focus:outline-none focus:border-amber-700"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        {currentLang === 'ar' ? 'اسم توضيحي للبطاقة (اختياري)' : 'Card Nickname (Optional)'}
                      </label>
                      <input
                        type="text"
                        placeholder={currentLang === 'ar' ? 'مثال: فيزا البنك الأهلي' : 'e.g. My Primary Card'}
                        value={cardNickname}
                        onChange={(e) => setCardNickname(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs focus:outline-none focus:border-amber-700"
                      />
                    </div>
                  </div>
                )}

                {serviceType === 'wallet' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        {currentLang === 'ar' ? 'مزود المحفظة الإلكترونية' : 'Wallet Provider'}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'vodafone_cash', label: 'فودافون كاش' },
                          { id: 'orange_cash', label: 'أورنج كاش' },
                          { id: 'we_pay', label: 'وي باي (WE)' },
                          { id: 'etisalat_cash', label: 'إتصالات كاش' },
                          { id: 'stc_pay', label: 'STC Pay / Urpay' },
                        ].map((w) => (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => setWalletProvider(w.id as any)}
                            className={`p-2.5 rounded-xl border text-xs font-bold text-start cursor-pointer transition-colors ${
                              walletProvider === w.id
                                ? 'bg-amber-800 text-white border-amber-800'
                                : 'bg-white text-stone-700 border-stone-200'
                            }`}
                          >
                            {w.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        {currentLang === 'ar' ? 'رقم هاتف المحفظة' : 'Mobile Number'}
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="010XXXXXXXX"
                        value={walletPhone}
                        onChange={(e) => setWalletPhone(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-mono focus:outline-none focus:border-amber-700"
                      />
                    </div>
                  </div>
                )}

                {serviceType === 'instapay' && (
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-900 leading-relaxed">
                      {currentLang === 'ar'
                        ? 'إنستاباي: التحويل الفوري اللحظي عبر البنك المركزي المصري. أدخل عنوان الدفع اللحظي (IPA) أو رقم الموبايل المسجل.'
                        : 'InstaPay: Instant bank transfer certified by Central Bank of Egypt. Enter your IPA handle.'}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        {currentLang === 'ar' ? 'عنوان الدفع اللحظي (IPA) أو رقم الموبايل' : 'IPA Handle or Phone'}
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="username@instapay"
                        value={instapayHandle}
                        onChange={(e) => setInstapayHandle(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-mono focus:outline-none focus:border-amber-700"
                      />
                    </div>
                  </div>
                )}

                {serviceType === 'bnpl' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        {currentLang === 'ar' ? 'اختر خدمة التقسيط المعتمدة' : 'Select BNPL Service'}
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'tabby', label: 'تابي (Tabby)', desc: '4 دفعات بدون فوائد' },
                          { id: 'tamara', label: 'تمارا (Tamara)', desc: 'قسمها براحتك' },
                          { id: 'valu', label: 'فاليو (valU)', desc: 'خطط تمويل مرنة' },
                        ].map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => setBnplProvider(b.id as any)}
                            className={`p-3 rounded-xl border text-center cursor-pointer transition-colors ${
                              bnplProvider === b.id
                                ? 'bg-amber-800 text-white border-amber-800'
                                : 'bg-white text-stone-700 border-stone-200'
                            }`}
                          >
                            <span className="block font-bold text-xs">{b.label}</span>
                            <span className="block text-[10px] opacity-80 mt-0.5">{b.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Default Checkbox */}
                <label className="flex items-center gap-2 cursor-pointer pt-2">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="w-4 h-4 accent-amber-800 rounded"
                  />
                  <span className="text-xs font-bold text-stone-700">
                    {currentLang === 'ar' ? 'تعيين كوسيلة دفع رئيسية في حسابي' : 'Set as primary default payment method'}
                  </span>
                </label>

                {savedSuccessMsg && (
                  <div className="p-3 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{savedSuccessMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Lock className="w-4 h-4" />
                  <span>{currentLang === 'ar' ? 'تشفير وحفظ وسيلة الدفع' : 'Encrypt & Save Payment Method'}</span>
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: SUPPORTED SERVICES */}
          {activeTab === 'services' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-stone-900">
                  {currentLang === 'ar' ? 'بوابة خدمات الدفع المعتمدة لدى شام' : 'All Integrated Payment Services on Sham'}
                </h3>
                <p className="text-xs text-stone-500">
                  {currentLang === 'ar'
                    ? 'نظام مدفوعات شامل يغطي كافة الوسائل النقدية والرقمية والتقسيط في الوطن العربي والعالم.'
                    : 'Comprehensive payment network spanning cards, digital wallets, instant bank networks, and installments.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(PROVIDER_METAS).map(([providerKey, meta]) => (
                  <div
                    key={providerKey}
                    className="p-3.5 rounded-2xl border border-stone-200 bg-stone-50/60 hover:bg-white hover:shadow-xs transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-md bg-stone-900 text-white font-mono text-[10px] font-bold">
                        {meta.badge}
                      </span>
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        {currentLang === 'ar' ? 'مفعّل ✓' : 'Active ✓'}
                      </span>
                    </div>
                    <div className="font-bold text-xs text-stone-900">
                      {currentLang === 'ar' ? meta.nameAr : meta.nameEn}
                    </div>
                    <div className="text-[11px] text-stone-500">
                      {meta.type === 'card' && (currentLang === 'ar' ? 'دفع فوري عبر البطاقات البنكية الدولية والمحلية' : 'Direct credit/debit card processing')}
                      {meta.type === 'wallet' && (currentLang === 'ar' ? 'شحن وخصم فوري عبر المحفظة ورقم الموبايل' : 'Mobile wallet one-touch settlement')}
                      {meta.type === 'instapay' && (currentLang === 'ar' ? 'تحويل لحظي بالتعاون مع البنك المركزي المصري' : 'Direct instant account settlement')}
                      {meta.type === 'bnpl' && (currentLang === 'ar' ? 'تقسيم الفاتورة على 4 دفعات ميسرة بدون أي فوائد' : 'Split into 4 interest-free installments')}
                      {meta.type === 'express' && (currentLang === 'ar' ? 'سداد فوري بنقرة واحدة عبر بصمة الوجه أو الإصبع' : 'One-touch biometric express checkout')}
                      {meta.type === 'cod' && (currentLang === 'ar' ? 'الدفع نقداً عند استلام الشحنة لباب المنزل' : 'Cash upon parcel delivery')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: SECURITY & PCI COMPLIANCE */}
          {activeTab === 'security' && (
            <div className="space-y-4 max-w-2xl mx-auto">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-stone-900 via-stone-850 to-amber-950 text-white space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-6 h-6 text-emerald-400" />
                  <h3 className="font-extrabold text-base">
                    {currentLang === 'ar' ? 'بروتوكولات الأمان والحماية المالية المتقدمة' : 'Advanced Financial Security & Vault Compliance'}
                  </h3>
                </div>
                <p className="text-xs text-stone-300 leading-relaxed">
                  {currentLang === 'ar'
                    ? 'في منصة شام، نتبع أعلى معايير أمان بطاقات الدفع العالمية (PCI-DSS Level 1) مع تقنية الترميز الآمن (Tokenization). لا يتم تخزين رموز التحقق (CVV) أو أرقام السر إطلاقاً.'
                    : 'On Sham Platform, we enforce PCI-DSS Level 1 compliance with zero-knowledge tokenization. CVV and PIN codes are never stored on any server.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    titleAr: 'تشفير 256-Bit SSL/TLS',
                    titleEn: '256-Bit SSL/TLS',
                    descAr: 'اتصال مشفر بين متصفح العميل وبوابات الدفع الرسمية لمنع أي اعتراض للبيانات.',
                    descEn: 'End-to-end encryption between client browser and gateway nodes.',
                  },
                  {
                    titleAr: 'التحقق الثنائي 3D Secure 2.0',
                    titleEn: '3D Secure 2.0 OTP',
                    descAr: 'تأكيد العمليات المصرفية عبر رمز OTP لضمان أن صاحب البطاقة هو من يقوم بالشراء.',
                    descEn: 'Biometric and OTP authentication by issuing card banks.',
                  },
                  {
                    titleAr: 'الترميز المالي (Tokenization)',
                    titleEn: 'Zero-Knowledge Tokenization',
                    descAr: 'استبدال رقم البطاقة برمز فريد معتمد لا يمكن استخدامه خارج المنصة.',
                    descEn: 'Raw numbers replaced with masked cryptographic tokens.',
                  },
                  {
                    titleAr: 'الامتثال للمعايير المصرفية',
                    titleEn: 'Central Bank Verified',
                    descAr: 'معتمد للمحافظ المصرية والخليجية وشبكة إنستاباي ومدى وفق الأطر التنظيمية.',
                    descEn: 'Fully compliant with national electronic transaction directives.',
                  },
                ].map((item, i) => (
                  <div key={i} className="p-3.5 rounded-xl border border-stone-200 bg-stone-50 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-stone-900">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{currentLang === 'ar' ? item.titleAr : item.titleEn}</span>
                    </div>
                    <p className="text-[11px] text-stone-600 leading-relaxed">
                      {currentLang === 'ar' ? item.descAr : item.descEn}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: TRANSACTION HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-stone-900">
                  {currentLang === 'ar' ? 'سجل العمليات والمدفوعات' : 'Payment History & Receipts'}
                </h3>
                <p className="text-xs text-stone-500">
                  {currentLang === 'ar'
                    ? 'عرض وتوثيق المدفوعات السابقة المنفذة عبر المتجر مع أرقام التفويض البنكي.'
                    : 'Review previous transactions and authorization reference receipts.'}
                </p>
              </div>

              {transactions.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-stone-200 bg-stone-50 space-y-2">
                  <FileText className="w-8 h-8 text-stone-300 mx-auto" />
                  <p className="text-xs font-bold text-stone-600">
                    {currentLang === 'ar' ? 'لا توجد مدفوعات مسجلة حتى الآن' : 'No transactions recorded yet'}
                  </p>
                  <p className="text-[11px] text-stone-400">
                    {currentLang === 'ar'
                      ? 'عند إتمام أول طلب شراء ستظهر تفاصيل العملية وإيصالها هنا.'
                      : 'Completed orders will appear here with authorization receipts.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 overflow-hidden bg-white">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                      <div className="space-y-0.5">
                        <div className="font-bold text-stone-900 flex items-center gap-2">
                          <span>{tx.orderRef}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">
                            {tx.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-stone-500">
                          {tx.paymentMethodTitle} · {new Date(tx.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-end font-mono">
                        <div className="font-extrabold text-stone-900 text-sm">
                          {tx.amount.toLocaleString()} {tx.currency}
                        </div>
                        <div className="text-[10px] text-stone-400">Auth: {tx.authCode}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
