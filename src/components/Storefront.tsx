import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Clock,
  Filter,
  Flame,
  History,
  Loader2,
  Minus,
  Package,
  Plus,
  Search,
  Send,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Star,
  Trash2,
  UserPlus,
  X,
  SlidersHorizontal,
  Check,
  TrendingUp,
  CreditCard,
  Lock,
  Smartphone,
  Landmark,
  Wallet,
  CheckCircle2,
  Building,
} from 'lucide-react';
import { ProductPayMethods } from '../bank/ProductPayMethods';
import { CheckoutPayPanel } from './CheckoutPayPanel';
import { requireCustomerLogin } from '../utils/paymentAccess';
import { PaymentEnvironmentModal } from './PaymentEnvironmentModal';
import { StoreSalesCategoryChart } from './StoreSalesCategoryChart';
import { saveMerchant } from '../utils/merchantDataStore';
import { FAMILIES, searchText, type Family, type Gender, type StoreProduct } from '../utils/storeCatalog';
import { productSection, sectionFromHash, STORE_SECTIONS, type StoreSection } from '../utils/storeSections';
import { cosmeticsText } from '../لغات/cosmeticsL10n';
import DirectPaymentCard from './DirectPaymentCard';
import { SafeImage, photoSources } from './SafeImage';
import { reserveDirectOrder, savedDirectOrders, type DirectOrder } from '../utils/directPayment';
import { makeStoreT, storeFamilyLabel, storeGenderLabel, storeLocalized, storeNumber } from '../لغات/storeL10n';
import { isRTL } from '../لغات/localizedContent';
import type { SupportedLanguage } from '../types/i18n';
import { askShaheenStore, loadStoreCatalog, localSuggestion, storeImageSrc, type StoreSuggestion } from '../utils/liveStore';
import { LegalDisclaimer } from './LegalDisclaimer';
import { StoreInvoiceBreakdown } from './StoreInvoiceBreakdown';
import CompleteYourOrder from './CompleteYourOrder';
import { pastPurchases, rememberPurchase } from '../utils/purchaseMemory';
import { addToCart, cartSummary, clearCart, orderMessage, orderRef, orderRequestEmail, removePurchasedItems, setCartQty, useCart, type PricedOrder } from '../utils/storeCart';
import { contactEmail, contactMailto } from '../config/contact';
import {
  CheckoutError,
  countryOptions,
  returnedPayment,
  startCheckout,
  usePayments,
  useStoreMoney,
  type CheckoutForm,
  type PaymentResult,
} from '../utils/storeCheckout';
import { DIRECT_PURCHASE_EVENT, takeDirectPurchase, type DirectPurchase } from '../utils/directPurchase';
import { quote } from '../utils/pricing';
import { useMerchantCartProducts } from '../community/cartItems';

/**
 * Every text string resolves through storeL10n with fallback:
 * visitor's language -> English -> Arabic.
 * Non-Arabic visitors never see Arabic characters.
 */
function storeLabels(lang: SupportedLanguage) {
  const t = makeStoreT(lang);
  return {
    title: t('sf_store_name'),
    search: t('sf_search_ph'),
    storeTagline: t('sf_tagline'),
    searchLabel: t('sf_search_label'),
    searchButton: t('sf_search_btn'),
    searchResults: t('sf_search_results'),
    searchNoResults: t('sf_search_none'),
    searchAll: t('sf_search_all'),
    searchQuickTitle: t('sf_quick_title'),
    searchQuickNotes: [t('family_oud'), t('family_musk'), t('note_vanilla')],
    searchShortcut: 'Ctrl K',
    askTitle: t('sf_ask_title'),
    askHint: t('sf_ask_hint'),
    askPlaceholder: t('sf_ask_ph'),
    ask: t('sf_ask_btn'),
    chips: [t('sf_chip_summer'), t('sf_chip_gift'), t('sf_chip_oud'), t('sf_chip_sweet'), t('sf_chip_budget')],
    byShaheen: t('sf_by_shaheen'),
    aiNoteShaheen: t('sf_ai_note_shaheen'),
    aiNoteQuick: t('sf_ai_note_quick'),
    quick: t('sf_quick_pick'),
    thinking: t('sf_thinking'),
    all: t('sf_all'),
    newOnly: t('sf_new_only'),
    newBadge: t('sf_new_badge'),
    allCategories: t('sf_all_categories'),
    allBrands: t('sf_all_brands'),
    sortNew: t('sf_sort_new'),
    sortPriceLow: t('sf_sort_price_low'),
    sortPriceHigh: t('sf_sort_price_high'),
    sortRating: t('sf_sort_rating'),
    loading: t('sf_loading'),
    more: t('sf_more'),
    found: t('sf_found'),
    noResults: t('sf_no_results'),
    clear: t('sf_clear_filters'),
    clearSearch: t('sf_clear_search'),
    addToCart: t('sf_add_to_cart'),
    buyNow: t('sf_buy_now'),
    added: t('sf_added'),
    details: t('sf_details'),
    currency: t('sf_currency'),
    outOfStock: t('sf_out_of_stock'),
    cart: t('sf_cart'),
    cartEmpty: t('sf_cart_empty'),
    total: t('sf_total'),
    checkout: t('sf_checkout'),
    clearCart: t('sf_clear_cart'),
    becomeMerchant: t('sf_become_merchant'),
    merchantTitle: t('sf_merchant_title'),
    companyName: t('sf_company'),
    email: t('sf_email'),
    phone: t('sf_phone'),
    password: t('sf_password'),
    register: t('sf_register'),
    cancel: t('sf_cancel'),
    fill: t('sf_fill_required'),
    registered: t('sf_registered'),
    shipTo: t('sf_ship_to'),
    itemsTotal: t('sf_items_total'),
    shipping: t('sf_shipping'),
    shippingDays: t('sf_shipping_days'),
    deliveryDetails: t('sf_delivery_details'),
    fullName: t('sf_full_name'),
    city: t('sf_city'),
    address: t('sf_address'),
    payNow: t('sf_pay_now'),
    payContinue: t('sf_pay_continue'),
    payCharge: t('sf_pay_charge'),
    paying: t('sf_paying'),
    payError: t('sf_pay_error'),
    payInvalid: t('sf_pay_invalid'),
    paid: t('sf_paid'),
    payPending: t('sf_pay_pending'),
    payFailed: t('sf_pay_failed'),
    testMode: t('sf_test_mode'),
    back: t('sf_back'),
    orAssistant: t('sf_or_assistant'),
    orderStart: t('sf_order_start'),
    orderSend: t('sf_order_send'),
    orderNote: t('sf_order_note'),
    orderOpened: t('sf_order_opened'),
    directTitle: t('sf_direct_title'),
    directNote: t('sf_direct_note'),
    directReserve: t('sf_direct_reserve'),
    directCodPlace: t('sf_direct_cod_place'),
    directMyOrders: t('sf_direct_my_orders'),
    directKinds: { instapay: t('sf_direct_instapay'), bank_transfer: t('sf_direct_bank'), wallet: t('sf_direct_wallet'), cod: t('sf_direct_cod') } as Record<string, string>,
  };
}

/** Luxury storefront extra labels guarantee zero Arabic leakage for foreign visitors */
function extraLabel(key: string, lang: SupportedLanguage): string {
  const isAr = lang === 'ar';
  const labels: Record<string, { ar: string; en: string }> = {
    hero_kicker: { ar: 'معيار شام · دار العطور الفاخرة', en: 'Sham Standard · Haute Parfumerie' },
    hero_title: { ar: 'عطور النيش المختارة وخامات المعمل الفاخرة', en: 'Curated Niche Scents & Laboratory Extracts' },
    hero_sub: { ar: 'اكتشف أرقى العطور العالمية، الخامات النقية، والتركيبات المتوازنة بإشراف خبراء صناعة العطور.', en: 'Discover distinguished fine fragrances, pure extracts, and expertly balanced formulations.' },
    badge_pure: { ar: '100% خامات نقية', en: '100% Pure Extracts' },
    badge_tested: { ar: 'فحص جودة معملي دقيق', en: 'Laboratory Tested' },
    badge_shipping: { ar: 'شحن آمن ومضمون', en: 'Insured Shipping' },
    badge_shahin: { ar: 'استشارة فورية مع شاهين', en: 'Instant Master Advice' },
    coll_oud: { ar: 'العود والعنبر الملكي', en: 'Royal Oud & Amber' },
    coll_woody: { ar: 'الأخشاب والنيش', en: 'Niche & Woods' },
    coll_citrus: { ar: 'الانتعاش والحمضيات', en: 'Fresh & Citrus' },
    coll_floral: { ar: 'الزهور والورد الفاخر', en: 'Prestige Florals' },
    recent_searches: { ar: 'عمليات البحث الأخيرة', en: 'Recent Searches' },
    clear_history: { ar: 'مسح السجل', en: 'Clear' },
    filter_price: { ar: 'نطاق السعر', en: 'Price Range' },
    price_all: { ar: 'جميع الأسعار', en: 'All Prices' },
    price_under200: { ar: 'أقل من {a}', en: 'Under {a}' },
    price_200to500: { ar: 'من {a} إلى {b}', en: '{a} to {b}' },
    price_above500: { ar: 'أكثر من {b}', en: 'Above {b}' },
    in_stock_only: { ar: 'المتوفر فقط', en: 'In Stock Only' },
    quick_view: { ar: 'معاينة', en: 'Quick View' },
    popular_scents: { ar: 'نوتات رائجة:', en: 'Popular notes:' },
    active_filters: { ar: 'الفلاتر النشطة:', en: 'Active filters:' },
    all_families: { ar: 'كل العائلات', en: 'All Families' },
    view_product: { ar: 'عرض العطر', en: 'View Scent' },
    clear_all: { ar: 'مسح الكل', en: 'Clear All' },
  };
  const item = labels[key];
  if (!item) return '';
  return isAr ? item.ar : item.en;
}

type Sort = 'new' | 'priceLow' | 'priceHigh' | 'rating';
type PriceFilter = 'all' | 'under200' | '200to500' | 'above500';

interface Props {
  onClose?: () => void;
  currentLang: SupportedLanguage;
  retailerId?: string;
  signedIn?: boolean;
  onRequireAuth?: () => void;
  shaheenQuery?: { text: string; at: number } | null;
}

function ProductImage({ product, className }: { product: StoreProduct; className: string }) {
  // Every photo the product has, then a placeholder — never a blank card (#169).
  return <SafeImage sources={photoSources(product.imageUrl, product.images)} alt={storeLocalized(product.name, 'ar')}
    className={`${className} transition-transform duration-500 group-hover:scale-105`} />;
}

/** Highlight matched search keywords inside text */
function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return <>{text}</>;
  try {
    const pattern = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    const parts = text.split(pattern);
    return (
      <>
        {parts.map((part, i) =>
          pattern.test(part) ? (
            <mark key={i} className="bg-amber-200/90 text-amber-950 font-bold px-0.5 rounded">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  } catch {
    return <>{text}</>;
  }
}

export const Storefront: React.FC<Props> = ({ currentLang, shaheenQuery, retailerId, signedIn = false, onRequireAuth }) => {
  const L = useMemo(() => storeLabels(currentLang), [currentLang]);
  const dir = isRTL(currentLang) ? 'rtl' : 'ltr';
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    loadStoreCatalog()
      .then((list) => {
        if (live) setProducts(list);
      })
      .catch(() => undefined)
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);

  // The merchant asked (in AI Studio) for the whole catalogue on one page; images load lazily.
  const PAGE = 500;
  const ALL = 5000;
  const [limit, setLimit] = useState(ALL);

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchBarRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Recent Searches stored in localStorage
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const s = localStorage.getItem('sham_store_recent_searches');
      return s ? JSON.parse(s).slice(0, 5) : [];
    } catch {
      return [];
    }
  });

  const saveSearchTerm = (term: string) => {
    const clean = term.trim();
    if (!clean) return;
    setRecentSearches((prev) => {
      const next = [clean, ...prev.filter((x) => x.toLowerCase() !== clean.toLowerCase())].slice(0, 5);
      try {
        localStorage.setItem('sham_store_recent_searches', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem('sham_store_recent_searches');
    } catch {}
  };

  // Filters
  const [gender, setGender] = useState<Gender | 'all'>('all');
  const [family, setFamily] = useState<Family | 'all'>('all');
  const [category, setCategory] = useState('all');
  // «العطور» / «مستحضرات التجميل»: a link can open one section (#store?section=cosmetics).
  const [section, setSection] = useState<StoreSection | 'all'>(() => {
    try { return sectionFromHash(window.location.hash); } catch { return 'all'; }
  });
  const sectionCount = useMemo(() => ({
    perfumes: products.filter((p) => productSection(p) === 'perfumes').length,
    cosmetics: products.filter((p) => productSection(p) === 'cosmetics').length,
  }), [products]);
  const [brand, setBrand] = useState('all');
  const [newOnly, setNewOnly] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [priceRange, setPriceRange] = useState<PriceFilter>('all');
  const [sort, setSort] = useState<Sort>('new');

  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(), [products]);
  const brands = useMemo(() => [...new Set(products.map((p) => p.brand).filter(Boolean))].sort(), [products]);
  const allFamiliesList = useMemo(() => FAMILIES, []);

  // Filtered products list
  const shown = useMemo(() => {
    const words = search.toLowerCase().split(/\s+/).filter(Boolean);
    const list = products.filter((p) => {
      if (section !== 'all' && productSection(p) !== section) return false;
      if (gender !== 'all' && p.gender !== gender && !(p.gender === 'unisex')) return false;
      if (family !== 'all' && !p.families.includes(family)) return false;
      if (category !== 'all' && p.category !== category) return false;
      if (brand !== 'all' && p.brand !== brand) return false;
      if (newOnly && !p.isNew) return false;
      if (inStockOnly && !p.inStock) return false;
      if (priceRange === 'under200' && p.price >= 200) return false;
      if (priceRange === '200to500' && (p.price < 200 || p.price > 500)) return false;
      if (priceRange === 'above500' && p.price <= 500) return false;
      if (words.length) {
        const text = searchText(p);
        if (!words.every((w) => text.includes(w))) return false;
      }
      return true;
    });

    const time = (p: StoreProduct) => (p.createdAt ? Date.parse(p.createdAt) || 0 : 0);
    return list.sort((a, b) =>
      sort === 'priceLow'
        ? a.price - b.price
        : sort === 'priceHigh'
        ? b.price - a.price
        : sort === 'rating'
        ? (b.rating || 0) - (a.rating || 0)
        : time(b) - time(a)
    );
  }, [products, search, section, gender, family, category, brand, newOnly, inStockOnly, priceRange, sort]);

  useEffect(() => {
    setLimit(ALL);
  }, [search, section, gender, family, category, brand, newOnly, inStockOnly, priceRange, sort]);

  const hasActiveFilters =
    search.trim() !== '' ||
    gender !== 'all' ||
    family !== 'all' ||
    category !== 'all' ||
    brand !== 'all' ||
    newOnly ||
    inStockOnly ||
    priceRange !== 'all';

  const resetFilters = () => {
    setSearch('');
    setSection('all');
    setGender('all');
    setFamily('all');
    setCategory('all');
    setBrand('all');
    setNewOnly(false);
    setInStockOnly(false);
    setPriceRange('all');
  };

  useEffect(() => {
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (event.target instanceof Node && !searchBarRef.current?.contains(event.target)) {
        setSearchFocused(false);
      }
    };
    const handleSearchShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
        setSearchFocused(true);
      }
      if (event.key === 'Escape' && searchFocused) {
        setSearchFocused(false);
        searchInputRef.current?.blur();
      }
    };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', handleSearchShortcut);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', handleSearchShortcut);
    };
  }, [searchFocused]);

  // «اسأل شاهين» AI Concierge
  const [wish, setWish] = useState('');
  const [advice, setAdvice] = useState<StoreSuggestion | null>(null);
  const [thinking, setThinking] = useState(false);
  const askId = useRef(0);
  const panel = useRef<HTMLDivElement>(null);

  const ask = async (text: string) => {
    const message = text.trim();
    if (message.length < 2) return;
    const id = ++askId.current;
    setWish(message);
    setAdvice(localSuggestion(products, message, currentLang));
    setThinking(true);
    const better = await askShaheenStore(products, message, currentLang);
    if (id !== askId.current) return;
    setThinking(false);
    if (better) setAdvice(better);
    else {
      setAdvice(
        (prev) =>
          prev && {
            ...prev,
            reply: localSuggestion(products, message, currentLang).reply.replace(
              /\s*[—-]\s*شاهين.*$|\s*[—-]\s*Shaheen.*$/,
              ''
            ),
          }
      );
    }
  };

  useEffect(() => {
    if (!shaheenQuery?.text) return;
    void ask(shaheenQuery.text);
    panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shaheenQuery?.at]);

  // Cart
  const cart = useCart();
  const [directPurchase, setDirectPurchase] = useState<DirectPurchase | null>(null);
  const basketCount = Object.values(cart).reduce((n, qty) => n + qty, 0);
  const checkoutItems = directPurchase ? { [directPurchase.sku]: directPurchase.qty } : cart;
  const merchantItems = useMerchantCartProducts(checkoutItems);
  const summary = cartSummary(checkoutItems, merchantItems.length ? [...products, ...merchantItems] : products);
  const [cartOpen, setCartOpen] = useState(false);
  const [justAdded, setJustAdded] = useState('');

  const add = (p: StoreProduct) => {
    addToCart(p.sku);
    setJustAdded(p.sku);
    setTimeout(() => setJustAdded((s) => (s === p.sku ? '' : s)), 1500);
  };

  // Pricing & Payments
  const money = useStoreMoney(currentLang, L.currency);
  const countries = useMemo(() => countryOptions(currentLang), [currentLang]);
  const payments = usePayments(money.country);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'wallet'>('card');
  // «بنك شام»: InstaPay / bank transfer / wallet / cash on delivery straight to the store — no gateway.
  const directMethods = payments?.direct || [];
  const [directChoice, setDirectChoice] = useState('');
  const chosenDirect = directMethods.find((m) => m.id === directChoice) || (!payments?.enabled ? directMethods[0] : undefined);
  const canPay = Boolean(payments?.enabled || directMethods.length);
  const [directOrders, setDirectOrders] = useState<DirectOrder[]>(() => (typeof window === 'undefined' ? [] : savedDirectOrders()));
  const [activeDirect, setActiveDirect] = useState('');
  useEffect(() => {
    const sync = () => setDirectOrders(savedDirectOrders());
    window.addEventListener('sham-direct-orders', sync);
    return () => window.removeEventListener('sham-direct-orders', sync);
  }, []);
  const visibleDirect = directOrders.filter((o) => o.ref === activeDirect || ((o.state === 'awaiting_payment' || o.state === 'claimed') && Date.now() - o.at < 14 * 86400_000)).slice(0, 3);
  const chosenMethod = chosenDirect ? undefined : payments?.methods.some((m) => m.id === paymentMethod) ? paymentMethod : payments?.methods[0]?.id;
  const chargedBill = payments?.currency ? quote(summary.lines.map((l) => ({ sku: l.product.sku, price: l.product.price, qty: l.qty })), money.country, { currency: payments.currency }) : null;
  const bill = money.quote(summary.lines.map((l) => ({ sku: l.product.sku, price: l.product.price, qty: l.qty })));
  const lineTotal = new Map(bill.lines.map((l) => [l.sku, l.subtotal]));
  // The order exactly as the cart shows it — the visitor's currency, never the catalog's EGP (#169).
  const priced: PricedOrder = {
    line: (sku) => (lineTotal.has(sku) ? money.money(lineTotal.get(sku) as number) : undefined),
    shipping: bill.shipping ? money.money(bill.shipping) : undefined,
    total: money.money(bill.total),
  };
  /** Secondary path: talk the order through with the assistant (prices as shown in the cart). */
  const checkout = () => {
    if (!summary.lines.length) return;
    window.dispatchEvent(new CustomEvent('open-sham-assistant', { detail: orderMessage(summary, currentLang, priced) }));
    setCartOpen(false);
  };
  const [orderSent, setOrderSent] = useState('');
  const [step, setStep] = useState<'cart' | 'form'>('cart');
  const [payForm, setPayForm] = useState<CheckoutForm>({ name: '', email: '', phone: '', city: '', line: '' });
  const [paying, setPaying] = useState(false);
  const [payMessage, setPayMessage] = useState('');
  const [payResult, setPayResult] = useState<PaymentResult | null>(null);
  // «شاهين التاجر»: what was just ordered (this visit) and what was ordered before on this device.
  const [justOrdered, setJustOrdered] = useState<string[]>([]);
  const [boughtBefore, setBoughtBefore] = useState<string[]>(() => (typeof window === 'undefined' ? [] : pastPurchases()));
  const [hideForYou, setHideForYou] = useState(false);
  const ordered = (skus: string[]) => { if (!skus.length) return; setJustOrdered(skus); setBoughtBefore(rememberPurchase(skus)); };

  useEffect(() => {
    void returnedPayment().then((result) => {
      if (!result) return;
      setPayResult(result);
      if (result.state === 'paid' && result.mode === 'live' && result.cartItems) removePurchasedItems(result.cartItems);
      if (result.state === 'paid' && result.cartItems) ordered(result.cartItems.map((i) => i.sku));
    });
  }, []);

  const buyNow = (product: StoreProduct, qty = 1) => {
    if (!product.inStock) return;
    if (!signedIn && !requireCustomerLogin()) { onRequireAuth?.(); return; }
    setDirectPurchase({ sku: product.sku, qty, at: Date.now() });
    setCartOpen(true); setStep('form'); setPayMessage(''); setSearchFocused(false);
  };
  useEffect(() => {
    const receive = () => {
      const intent = takeDirectPurchase();
      if (intent) {
        if (!signedIn && !requireCustomerLogin()) { onRequireAuth?.(); return; }
        setDirectPurchase(intent); setCartOpen(true); setStep('form'); setPayMessage('');
      }
    };
    receive();
    window.addEventListener(DIRECT_PURCHASE_EVENT, receive);
    return () => window.removeEventListener(DIRECT_PURCHASE_EVENT, receive);
  }, [signedIn, onRequireAuth]);
  const changeCheckoutQty = (sku: string, qty: number) => {
    if (directPurchase) setDirectPurchase({ ...directPurchase, qty: Math.min(99, Math.max(1, qty)) });
    else setCartQty(sku, qty);
  };

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paying) return;
    if (!signedIn && !requireCustomerLogin()) { onRequireAuth?.(); return; }
    if (!canPay) { setPayMessage(currentLang === 'ar' ? 'استخدم البطاقة أو المحفظة المحفوظة. إرسال الطلب للمتجر آخر خيار بالأسفل.' : 'Use a saved card or wallet. Sending the order to the store is the last option below.'); return; }
    if (chosenDirect) {
      setPaying(true); setPayMessage('');
      try {
        const items = summary.lines.map((l) => ({ sku: l.product.sku, qty: l.qty }));
        const order = await reserveDirectOrder(items, money.country, payForm, currentLang, chosenDirect.id);
        setActiveDirect(order.ref); setDirectOrders(savedDirectOrders());
        ordered(items.map((i) => i.sku));
        // The order is placed: it leaves the basket (a direct purchase never touched it).
        if (directPurchase) setDirectPurchase(null); else removePurchasedItems(items);
        setStep('cart');
      } catch (error) {
        setPayMessage(error instanceof Error && ['INVALID_EMAIL', 'INVALID_PHONE', 'MISSING_ADDRESS', 'MISSING_NAME'].includes((error as { code?: string }).code || '') ? L.payInvalid : L.payError);
      } finally { setPaying(false); }
      return;
    }
    if (!payments?.enabled || !chosenMethod) { setPayMessage(L.payError); return; }
    setPaying(true); setPayMessage('');
    try {
      await startCheckout(summary.lines.map((l) => ({ sku: l.product.sku, qty: l.qty })), money.country, payForm, currentLang, chosenMethod, directPurchase ? 'direct' : 'cart');
    } catch (error) {
      setPayMessage(error instanceof CheckoutError && ['INVALID_EMAIL', 'INVALID_PHONE', 'MISSING_ADDRESS', 'MISSING_NAME'].includes(error.code) ? L.payInvalid : L.payError);
      // Keep the cart and delivery details. A failed redirect or gateway call is NEVER a payment.
    } finally { setPaying(false); }
  };

  const sendToStore = () => {
    if (!signedIn && !requireCustomerLogin()) { onRequireAuth?.(); return; }
    if (!summary.lines.length) return;
    const ref = orderRef();
    const mail = orderRequestEmail(summary, currentLang, priced, payForm, countries.find((c) => c.code === money.country)?.name || money.country, ref);
    setOrderSent(ref);
    ordered(summary.lines.map((l) => l.product.sku));
    window.location.href = contactMailto('orders', currentLang, mail.subject, mail.body);
  };

  // The price bands are catalog amounts (200 / 500 EGP) shown in the visitor's own currency (#169).
  const priceBand = (band: Exclude<PriceFilter, 'all'>) =>
    extraLabel(`price_${band}`, currentLang).replace('{a}', money.price(200)).replace('{b}', money.price(500));

  const countryPicker = (testId: string) => (
    <label className="inline-flex items-center gap-1.5 text-xs text-stone-600">
      <span>{L.shipTo}</span>
      <select
        value={money.country}
        onChange={(e) => money.setCountry(e.target.value)}
        data-testid={testId}
        className="max-w-[11rem] px-2 py-1.5 bg-white border border-stone-200 rounded-lg text-xs"
      >
        {countries.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );

  const openDetails = (p: StoreProduct) => {
    window.location.hash = `#product=${p.id}`;
  };

  // Merchant registration & Sales Analytics Dashboard
  const [showReg, setShowReg] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [form, setForm] = useState({ nameAr: '', email: '', phone: '', pass: '' });
  const register = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nameAr || !form.email || !form.pass) {
      alert(L.fill);
      return;
    }
    const now = new Date().toISOString();
    saveMerchant({
      id: Math.random().toString(36).slice(2, 11),
      companyNameAr: form.nameAr,
      companyNameEn: form.nameAr,
      registrationNumber: '',
      taxId: '',
      email: form.email,
      phone: form.phone,
      whatsapp: form.phone,
      channels: { email: true, whatsapp: true, phone: true, other: false },
      approved: false,
      isActive: true,
      marginPercent: 25,
      bankingInfo: undefined,
      totalProducts: 0,
      totalOrders: 0,
      totalRevenue: 0,
      totalPlatformRevenue: 0,
      notes: '',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });
    setShowReg(false);
    setForm({ nameAr: '', email: '', phone: '', pass: '' });
    alert(L.registered);
  };

  const price = money.price;

  // Luxury Card Rendering adhering strictly to the zero-pill discipline with subtle warm gradient
  const card = (p: StoreProduct, why?: string, pick?: boolean) => {
    const isAdded = justAdded === p.sku;
    return (
      <article
        key={p.sku}
        className={`group bg-gradient-to-b ${
          pick
            ? 'from-amber-50/70 via-white to-amber-50/40 border-amber-400 shadow-md ring-1 ring-amber-300/40'
            : 'from-white via-stone-50/30 to-amber-50/25 hover:from-white hover:via-amber-50/15 hover:to-amber-50/40 border-stone-200/80 hover:border-amber-300/80 hover:shadow-xl'
        } rounded-2xl border overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-0.5`}
        data-testid={pick ? 'store-pick' : 'store-product'}
      >
        <div className="relative overflow-hidden aspect-square bg-gradient-to-b from-stone-100/60 via-stone-50/40 to-transparent">
          <button
            type="button"
            onClick={() => openDetails(p)}
            className="w-full h-full block cursor-pointer focus:outline-none"
            title={L.details}
          >
            <ProductImage product={p} className="w-full h-full" />
          </button>

          {/* Luxury Status Tags (clean subtle corners) */}
          <div className="absolute top-2 start-2 flex flex-col gap-1 pointer-events-none">
            {p.isNew && (
              <span className="px-2 py-0.5 bg-emerald-700/90 text-white text-[10px] font-semibold tracking-wide rounded-md backdrop-blur-xs shadow-xs">
                {L.newBadge}
              </span>
            )}
          </div>
          {!p.inStock && (
            <div className="absolute top-2 end-2 pointer-events-none">
              <span className="px-2 py-0.5 bg-stone-900/85 text-stone-200 text-[10px] font-medium rounded-md backdrop-blur-xs">
                {L.outOfStock}
              </span>
            </div>
          )}
        </div>

        <div className="p-4 flex flex-col gap-2 flex-1">
          {/* Brand kicker - clean unboxed typography */}
          <div className="flex items-center justify-between text-[11px] text-stone-500">
            <span className="font-semibold text-amber-800 uppercase tracking-wider line-clamp-1">
              {p.brand || p.category}
            </span>
            {p.rating ? (
              <span className="inline-flex items-center gap-1 font-bold text-stone-800">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span>{p.rating}</span>
              </span>
            ) : null}
          </div>

          {/* Product Title */}
          <button
            type="button"
            onClick={() => openDetails(p)}
            className="text-start font-bold text-sm text-stone-900 line-clamp-2 hover:text-amber-800 transition-colors cursor-pointer leading-snug"
          >
            <HighlightMatch text={storeLocalized(p.name, currentLang)} query={search} />
          </button>

          {/* Olfactory Metadata - Clean unboxed text with typographic separators */}
          <div className="flex items-center flex-wrap gap-1 text-[11px] text-stone-500">
            {p.gender && <span>{storeGenderLabel(p.gender, currentLang)}</span>}
            {p.families.length > 0 && (
              <>
                <span aria-hidden="true" className="text-stone-300">·</span>
                <span className="text-stone-700 font-medium">
                  {p.families.slice(0, 2).map((f) => storeFamilyLabel(f, currentLang)).join(' / ')}
                </span>
              </>
            )}
            {p.sizeMl ? (
              <>
                <span aria-hidden="true" className="text-stone-300">·</span>
                <span>{p.sizeMl}ml</span>
              </>
            ) : null}
          </div>

          {/* Perfumer AI rationale if recommended */}
          {why && (
            <p className="text-[11px] leading-relaxed text-amber-950 bg-amber-50/70 border border-amber-200/70 rounded-xl p-2.5 mt-1">
              <Sparkles className="inline w-3 h-3 text-amber-600 me-1.5 shrink-0" />
              <span>{why}</span>
            </p>
          )}

          <ProductPayMethods lang={currentLang} country={money.country} productName={storeLocalized(p.name, currentLang)} productKey={p.sku} compact />
          {/* Price & Action */}
          <div className="mt-auto pt-3 border-t border-stone-100 space-y-2">
            <div>
              <span className="text-base font-extrabold text-stone-900 font-mono-numbers">
                {price(p.price)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              data-testid="store-add-to-cart"
              disabled={!p.inStock}
              onClick={() => add(p)}
              className={`px-2 py-2.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 shadow-2xs ${
                isAdded
                  ? 'bg-emerald-700 text-white'
                  : 'bg-stone-900 hover:bg-amber-700 disabled:bg-stone-200 disabled:text-stone-400 text-white active:scale-95'
              }`}
            >
              {isAdded ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{L.added}</span>
                </>
              ) : (
                <>
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>{L.addToCart}</span>
                </>
              )}
            </button>
            <button type="button" onClick={() => buyNow(p)} disabled={!p.inStock} data-testid="store-buy-now" className="px-2 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:bg-stone-200 disabled:text-stone-400 text-white text-[11px] sm:text-xs font-bold inline-flex items-center justify-center gap-1 transition-colors cursor-pointer">
              <CreditCard className="w-3.5 h-3.5 shrink-0" /><span>{L.buyNow}</span>
            </button>
            </div>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="min-h-screen bg-stone-50" dir={dir}>
      {/* Sticky High-End Search & Command Header */}
      <header
        className="sticky z-30 border-b border-white/10 bg-stone-950/95 text-white shadow-xl shadow-stone-950/20 backdrop-blur-xl transition-all"
        style={{ top: 'var(--sham-global-header-height, 0px)' }}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-2.5 px-3 py-2.5 sm:gap-4 sm:px-4 sm:py-3.5">
          {/* Store Brand Emblem */}
          <div className="flex shrink-0 items-center gap-3">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-300/40 bg-gradient-to-br from-amber-400 via-amber-600 to-stone-900 shadow-md shadow-amber-950/40">
              <Sparkles className="relative h-5 w-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <span className="block text-sm font-extrabold tracking-wide text-white">{L.title}</span>
              <span className="block text-[10px] font-medium text-amber-200/80">{L.storeTagline}</span>
            </div>
          </div>

          {/* Search Engine Command Bar */}
          <div className="relative min-w-0 flex-1" ref={searchBarRef}>
            <div
              className={`pointer-events-none absolute -inset-1 rounded-[1.4rem] bg-gradient-to-r from-amber-500/30 via-orange-500/15 to-amber-300/25 blur-md transition-opacity duration-300 ${
                searchFocused ? 'opacity-100' : 'opacity-40'
              }`}
            />
            <form
              role="search"
              aria-label={L.searchLabel}
              onSubmit={(event) => {
                event.preventDefault();
                if (search.trim()) saveSearchTerm(search.trim());
                setSearchFocused(false);
                searchInputRef.current?.blur();
              }}
            >
              <div
                className={`relative flex h-12 items-center gap-2 rounded-2xl border p-1.5 shadow-inner transition-all duration-200 ${
                  searchFocused
                    ? 'border-amber-400/90 bg-stone-900 ring-2 ring-amber-400/30'
                    : 'border-white/15 bg-stone-900/90 hover:border-amber-300/50'
                }`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-700 text-stone-950 shadow-sm shadow-amber-950/40">
                  <Search className="h-4 w-4" />
                </span>
                <input
                  ref={searchInputRef}
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  placeholder={L.search}
                  aria-label={L.searchLabel}
                  aria-expanded={searchFocused}
                  aria-controls={searchFocused ? 'store-search-suggestions' : undefined}
                  autoComplete="off"
                  enterKeyHint="search"
                  data-testid="store-search"
                  className="min-w-0 flex-1 appearance-none bg-transparent py-2 text-start text-sm text-white outline-none placeholder:text-stone-400 focus:ring-0 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      searchInputRef.current?.focus();
                    }}
                    aria-label={L.clearSearch}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-stone-400 transition hover:bg-white/10 hover:text-white cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : (
                  <kbd className="hidden shrink-0 rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-[10px] font-medium text-stone-400 lg:inline-flex">
                    {L.searchShortcut}
                  </kbd>
                )}
                <button
                  type="submit"
                  aria-label={L.searchButton}
                  className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 px-3 text-white font-bold shadow-sm transition hover:from-amber-400 hover:to-amber-600 active:scale-95 cursor-pointer sm:px-4"
                >
                  <Search className="h-4 w-4 sm:hidden" />
                  <span className="hidden text-xs font-extrabold sm:inline">{L.searchButton}</span>
                  <ArrowUpRight className="hidden h-3.5 w-3.5 sm:block" />
                </button>
              </div>
            </form>

            {/* Predictive Search Suggestions & Instant Results */}
            {searchFocused && (
              <div
                id="store-search-suggestions"
                className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-stone-200 bg-white text-stone-800 shadow-2xl shadow-stone-950/30 animate-in fade-in zoom-in-95"
                data-testid="store-search-suggestions"
              >
                {search.trim() ? (
                  <>
                    <div className="flex items-center justify-between gap-3 border-b border-stone-100 bg-stone-50/90 px-4 py-2.5">
                      <span className="flex min-w-0 items-center gap-2 text-xs font-bold text-stone-700">
                        <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                        <span className="truncate">{L.searchResults}</span>
                      </span>
                      <span className="shrink-0 text-xs font-bold text-amber-900 font-mono-numbers">
                        {shown.length} {extraLabel('view_product', currentLang)}
                      </span>
                    </div>

                    {shown.length ? (
                      <div className="max-h-80 overflow-y-auto p-2 divide-y divide-stone-100">
                        {shown.slice(0, 6).map((product) => (
                          <div
                            key={product.sku}
                            className="group flex items-center justify-between gap-3 p-2 rounded-xl transition hover:bg-amber-50/70"
                            data-testid="store-search-suggestion"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                saveSearchTerm(search);
                                setSearchFocused(false);
                                openDetails(product);
                              }}
                              className="flex items-center gap-3 min-w-0 flex-1 text-start cursor-pointer focus:outline-none"
                            >
                              <ProductImage product={product} className="h-12 w-12 shrink-0 rounded-xl border border-stone-200" />
                              <div className="min-w-0 flex-1">
                                <span className="block truncate text-xs font-bold text-stone-900 group-hover:text-amber-900">
                                  <HighlightMatch text={storeLocalized(product.name, currentLang)} query={search} />
                                </span>
                                <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-stone-500">
                                  <span className="truncate">{product.brand || product.category}</span>
                                  {product.families.length > 0 && (
                                    <>
                                      <span>·</span>
                                      <span className="text-amber-800 font-medium">
                                        {storeFamilyLabel(product.families[0], currentLang)}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </button>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs font-extrabold text-stone-900 font-mono-numbers">
                                {price(product.price)}
                              </span>
                              <button
                                type="button"
                                disabled={!product.inStock}
                                onClick={() => add(product)}
                                className="p-1.5 rounded-lg bg-stone-900 hover:bg-amber-700 disabled:bg-stone-200 text-white transition-colors cursor-pointer"
                                title={L.addToCart}
                              >
                                <ShoppingCart className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" disabled={!product.inStock} onClick={() => buyNow(product)} title={L.buyNow} aria-label={L.buyNow} className="p-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 disabled:bg-stone-200 text-white transition-colors"><CreditCard className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() => {
                            saveSearchTerm(search);
                            setSearchFocused(false);
                            document.querySelector('[data-testid="store-grid"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }}
                          className="mt-2 flex w-full items-center justify-between rounded-xl border-t border-stone-100 p-2.5 text-xs font-bold text-amber-900 transition hover:bg-amber-50 cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5">
                            <Search className="w-3.5 h-3.5 text-amber-700" />
                            <span>{L.searchAll}</span>
                          </span>
                          <span className="font-mono-numbers text-amber-800 font-extrabold">{shown.length}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-6 text-center text-xs text-stone-500 space-y-2">
                        <Search className="h-6 w-6 text-stone-400" />
                        <p className="font-medium">{L.searchNoResults}</p>
                        <button
                          type="button"
                          onClick={() => {
                            setSearch('');
                            searchInputRef.current?.focus();
                          }}
                          className="text-amber-800 font-bold hover:underline"
                        >
                          {extraLabel('clear_all', currentLang)}
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-4 space-y-4">
                    {/* Recent Searches */}
                    {recentSearches.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between text-xs font-bold text-stone-700 mb-2">
                          <span className="flex items-center gap-1.5">
                            <History className="w-3.5 h-3.5 text-amber-600" />
                            <span>{extraLabel('recent_searches', currentLang)}</span>
                          </span>
                          <button
                            type="button"
                            onClick={clearRecentSearches}
                            className="text-[11px] text-stone-400 hover:text-stone-700 cursor-pointer"
                          >
                            {extraLabel('clear_history', currentLang)}
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {recentSearches.map((term) => (
                            <button
                              key={term}
                              type="button"
                              onClick={() => {
                                setSearch(term);
                                searchInputRef.current?.focus();
                              }}
                              className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-amber-100 text-stone-700 hover:text-amber-900 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Clock className="w-3 h-3 text-stone-400" />
                              <span>{term}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Quick Trending Olfactory Notes */}
                    <div>
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-stone-700">
                        <Flame className="h-3.5 w-3.5 text-amber-600" />
                        <span>{L.searchQuickTitle}</span>
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {L.searchQuickNotes.map((note) => (
                          <button
                            key={note}
                            type="button"
                            onClick={() => {
                              setSearch(note);
                              saveSearchTerm(note);
                              searchInputRef.current?.focus();
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200/80 bg-amber-50/70 px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:border-amber-400 hover:bg-amber-100 cursor-pointer"
                          >
                            <Search className="h-3 w-3 text-amber-600" />
                            <span>{note}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cart Opener */}
          <button
            type="button"
            onClick={() => { setDirectPurchase(null); setStep('cart'); setPayMessage(''); setCartOpen(true); }}
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 transition hover:border-amber-300/40 hover:bg-amber-400/10 cursor-pointer"
            title={L.cart}
            aria-label={L.cart}
            data-testid="store-cart-button"
          >
            <ShoppingCart className="h-5 w-5 text-white" />
            {basketCount > 0 && (
              <span className="absolute -top-1 -end-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-xs font-extrabold text-stone-950 shadow-sm">
                {storeNumber(basketCount, currentLang)}
              </span>
            )}
          </button>

          {/* Store Sales Analytics (Recharts Pie Chart) Button */}
          <button
            type="button"
            onClick={() => setShowAnalytics(true)}
            className="hidden shrink-0 items-center gap-2 rounded-2xl border border-stone-200/90 bg-white/90 px-3.5 py-2 text-xs font-bold text-stone-800 transition hover:bg-stone-50 hover:text-amber-800 sm:flex cursor-pointer shadow-2xs"
            data-testid="store-dashboard-button"
            title={currentLang === 'ar' ? 'لوحة تحكم مبيعات المتجر (مخطط Recharts)' : 'Store Sales Dashboard (Recharts Pie Chart)'}
          >
            <TrendingUp className="h-4 w-4 text-amber-600" />
            <span>{currentLang === 'ar' ? 'تحليل المبيعات' : 'Sales Analytics'}</span>
          </button>

          {/* Customer Saved Payment Methods / Vault Button */}
          <button
            type="button"
            onClick={() => { if (!signedIn && !requireCustomerLogin()) { onRequireAuth?.(); return; } setShowPaymentModal(true); }}
            className="flex shrink-0 items-center gap-2 rounded-2xl border border-stone-200/90 bg-white/90 px-3.5 py-2 text-xs font-bold text-stone-800 transition hover:bg-stone-50 hover:text-amber-800 cursor-pointer shadow-2xs"
            data-testid="store-vault-button"
            title={currentLang === 'ar' ? 'تسجيل البطاقات والمحافظ' : 'Register cards and wallets'}
          >
            <CreditCard className="h-4 w-4 text-emerald-600" />
            <span className="hidden sm:inline">{currentLang === 'ar' ? 'بطاقاتي' : 'My cards'}</span>
          </button>

          {/* Become Merchant Button */}
          <button
            type="button"
            onClick={() => setShowReg(true)}
            className="hidden shrink-0 items-center gap-2 rounded-2xl border border-amber-300/30 bg-gradient-to-r from-amber-500 to-amber-600 px-3.5 py-2 text-xs font-bold text-stone-950 transition hover:from-amber-400 hover:to-amber-500 sm:flex cursor-pointer"
            data-testid="store-merchant-button"
          >
            <UserPlus className="h-4 w-4" />
            <span>{L.becomeMerchant}</span>
          </button>
        </div>
      </header>

      {/* Main Luxury Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-6 space-y-6">
        {payResult && (
          <div
            role="status"
            data-testid="store-payment-result"
            className={`flex items-start justify-between gap-3 rounded-2xl border p-4 text-sm ${
              payResult.state === 'paid'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : payResult.state === 'failed'
                ? 'border-red-200 bg-red-50 text-red-900'
                : 'border-amber-200 bg-amber-50 text-amber-900'
            }`}
          >
            <span>
              {(payResult.mode === 'test' ? L.testMode : payResult.state === 'paid' ? L.paid : payResult.state === 'failed' ? L.payFailed : L.payPending).replace(
                '{ref}',
                payResult.ref
              )}
            </span>
            <button type="button" onClick={() => setPayResult(null)} className="p-0.5 cursor-pointer" aria-label={L.cancel}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {justOrdered.length > 0 ? (
          <CompleteYourOrder products={products} basis={products.filter((p) => justOrdered.includes(p.sku))} lang={currentLang} variant="after" price={money.price}
            onAdd={add} onOpen={openDetails} added={justAdded} inCart={[...Object.keys(cart), ...justOrdered]} onDismiss={() => setJustOrdered([])} />
        ) : !hideForYou && boughtBefore.length > 0 ? (
          <CompleteYourOrder products={products} basis={products.filter((p) => boughtBefore.slice(0, 3).includes(p.sku))} lang={currentLang} variant="forYou" price={money.price}
            onAdd={add} onOpen={openDetails} added={justAdded} inCart={[...Object.keys(cart), ...boughtBefore]} onDismiss={() => setHideForYou(true)} />
        ) : null}

        {/* Haute Parfumerie Hero Presentation */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950 text-white border border-amber-500/20 shadow-2xl p-6 sm:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/15 via-transparent to-transparent pointer-events-none" />

          <div className="relative z-10 max-w-3xl space-y-3">
            <span className="inline-block text-[11px] font-bold tracking-widest text-amber-400 uppercase">
              {extraLabel('hero_kicker', currentLang)}
            </span>
            <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
              {extraLabel('hero_title', currentLang)}
            </h1>
            <p className="text-xs sm:text-sm text-stone-300 leading-relaxed max-w-2xl">
              {extraLabel('hero_sub', currentLang)}
            </p>

            {/* Zero-Pill Metric Discipline */}
            <div className="pt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-amber-200/90 font-medium">
              <span>{extraLabel('badge_pure', currentLang)}</span>
              <span aria-hidden="true" className="text-amber-500/50">·</span>
              <span>{extraLabel('badge_tested', currentLang)}</span>
              <span aria-hidden="true" className="text-amber-500/50">·</span>
              <span>{extraLabel('badge_shipping', currentLang)}</span>
              <span aria-hidden="true" className="text-amber-500/50">·</span>
              <span>{extraLabel('badge_shahin', currentLang)}</span>
            </div>

            {/* Quick Collections Jump Links */}
            <div className="pt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFamily('oud')}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-amber-500/20 text-white hover:text-amber-200 text-xs font-semibold border border-white/10 transition-colors cursor-pointer"
              >
                {extraLabel('coll_oud', currentLang)}
              </button>
              <button
                type="button"
                onClick={() => setFamily('woody')}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-amber-500/20 text-white hover:text-amber-200 text-xs font-semibold border border-white/10 transition-colors cursor-pointer"
              >
                {extraLabel('coll_woody', currentLang)}
              </button>
              <button
                type="button"
                onClick={() => setFamily('citrus')}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-amber-500/20 text-white hover:text-amber-200 text-xs font-semibold border border-white/10 transition-colors cursor-pointer"
              >
                {extraLabel('coll_citrus', currentLang)}
              </button>
              <button
                type="button"
                onClick={() => setFamily('floral')}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-amber-500/20 text-white hover:text-amber-200 text-xs font-semibold border border-white/10 transition-colors cursor-pointer"
              >
                {extraLabel('coll_floral', currentLang)}
              </button>
            </div>
          </div>
        </section>

        <ProductPayMethods
          lang={currentLang}
          country={money.country}
          heading={currentLang === 'ar' ? 'وسائل الدفع المتاحة لمنتجات المتجر في بلدك' : 'Payment methods available for store products in your country'}
        />

        {/* The store's two sections: perfumes and cosmetics (same pricing). */}
        <nav className="flex items-center gap-2 overflow-x-auto pb-1" data-testid="store-sections" aria-label={cosmeticsText(currentLang, 'sectionAll')}>
          {(['all', ...STORE_SECTIONS] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSection(s)}
              aria-pressed={section === s}
              className={`px-4 py-2 rounded-2xl text-sm font-bold whitespace-nowrap transition-all cursor-pointer border ${
                section === s ? 'bg-amber-800 text-white border-amber-800 shadow-xs' : 'bg-white text-stone-700 border-stone-200 hover:border-amber-400'
              }`}
            >
              {cosmeticsText(currentLang, s === 'all' ? 'sectionAll' : s === 'perfumes' ? 'sectionPerfumes' : 'sectionCosmetics')}
              {s === 'cosmetics' && !sectionCount.cosmetics && (
                <span className="ms-2 px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px]">{cosmeticsText(currentLang, 'comingSoon')}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Olfactory Scent Families Ribbon (Interactive Segmented Bar) */}
        <section className="bg-white rounded-2xl p-3 border border-stone-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-stone-800 px-1">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>{extraLabel('all_families', currentLang)}</span>
            </span>
            {family !== 'all' && (
              <button
                type="button"
                onClick={() => setFamily('all')}
                className="text-[11px] text-amber-800 hover:underline cursor-pointer"
              >
                {extraLabel('clear_all', currentLang)}
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            <button
              type="button"
              onClick={() => setFamily('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                family === 'all'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              {L.all}
            </button>
            {allFamiliesList.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFamily(family === f ? 'all' : f)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  family === f
                    ? 'bg-amber-700 text-white shadow-xs'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                {storeFamilyLabel(f, currentLang)}
              </button>
            ))}
          </div>
        </section>

        {/* Multi-Dimensional Filter & Sort Toolstrip */}
        <section className="bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200/80 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Gender Segmented Control */}
            <div className="inline-flex p-1 bg-stone-100 rounded-xl">
              <button
                type="button"
                onClick={() => setGender('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  gender === 'all' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {L.all}
              </button>
              {(['men', 'women', 'unisex'] as Gender[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    gender === g ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {storeGenderLabel(g, currentLang)}
                </button>
              ))}
            </div>

            {/* Quick Toggles: New & In-Stock */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setNewOnly(!newOnly)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                  newOnly
                    ? 'bg-amber-700 border-amber-700 text-white'
                    : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                }`}
              >
                {L.newOnly}
              </button>
              <button
                type="button"
                onClick={() => setInStockOnly(!inStockOnly)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                  inStockOnly
                    ? 'bg-emerald-700 border-emerald-700 text-white'
                    : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                }`}
              >
                {extraLabel('in_stock_only', currentLang)}
              </button>
            </div>
          </div>

          {/* Secondary Dropdown Controls Bar */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-stone-100 text-xs">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-2.5 py-1.5 bg-stone-50 hover:bg-white border border-stone-200 rounded-xl text-xs font-medium cursor-pointer"
            >
              <option value="all">{L.allCategories}</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="px-2.5 py-1.5 bg-stone-50 hover:bg-white border border-stone-200 rounded-xl text-xs font-medium cursor-pointer"
            >
              <option value="all">{L.allBrands}</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            <select
              value={priceRange}
              onChange={(e) => setPriceRange(e.target.value as PriceFilter)}
              className="px-2.5 py-1.5 bg-stone-50 hover:bg-white border border-stone-200 rounded-xl text-xs font-medium cursor-pointer"
            >
              <option value="all">{extraLabel('price_all', currentLang)}</option>
              <option value="under200">{priceBand('under200')}</option>
              <option value="200to500">{priceBand('200to500')}</option>
              <option value="above500">{priceBand('above500')}</option>
            </select>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="px-2.5 py-1.5 bg-stone-50 hover:bg-white border border-stone-200 rounded-xl text-xs font-medium cursor-pointer"
            >
              <option value="new">{L.sortNew}</option>
              <option value="priceLow">{L.sortPriceLow}</option>
              <option value="priceHigh">{L.sortPriceHigh}</option>
              <option value="rating">{L.sortRating}</option>
            </select>

            {countryPicker('store-country')}

            <div className="ms-auto flex items-center gap-2">
              <span className="text-xs text-stone-500 font-mono-numbers">
                {L.found.replace('{count}', String(shown.length))}
              </span>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-xs font-bold text-amber-800 hover:underline cursor-pointer"
                >
                  {L.clear}
                </button>
              )}
            </div>
          </div>

          {/* Active Filter Badges Bar */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
              <span className="text-stone-400 font-medium text-[11px]">{extraLabel('active_filters', currentLang)}</span>
              {search && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 text-xs">
                  <span>«{search}»</span>
                  <button type="button" onClick={() => setSearch('')} className="hover:text-amber-700 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {family !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-stone-100 text-stone-800 border border-stone-200 text-xs">
                  <span>{storeFamilyLabel(family, currentLang)}</span>
                  <button type="button" onClick={() => setFamily('all')} className="hover:text-stone-900 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {gender !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-stone-100 text-stone-800 border border-stone-200 text-xs">
                  <span>{storeGenderLabel(gender, currentLang)}</span>
                  <button type="button" onClick={() => setGender('all')} className="hover:text-stone-900 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {priceRange !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-stone-100 text-stone-800 border border-stone-200 text-xs">
                  <span>{priceBand(priceRange)}</span>
                  <button type="button" onClick={() => setPriceRange('all')} className="hover:text-stone-900 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {category !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-stone-100 text-stone-800 border border-stone-200 text-xs">
                  <span>{category}</span>
                  <button type="button" onClick={() => setCategory('all')} className="hover:text-stone-900 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {brand !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-stone-100 text-stone-800 border border-stone-200 text-xs">
                  <span>{brand}</span>
                  <button type="button" onClick={() => setBrand('all')} className="hover:text-stone-900 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>
          )}
        </section>

        {/* «اسأل شاهين» Bespoke Fragrance Concierge */}
        <section
          ref={panel}
          className="rounded-3xl border border-amber-300/60 bg-gradient-to-br from-amber-50/80 via-white to-amber-100/40 p-5 sm:p-6 shadow-sm"
          data-testid="store-ask"
        >
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="w-9 h-9 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-800 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <h2 className="font-extrabold text-stone-900 text-base">{L.askTitle}</h2>
              <p className="text-xs text-stone-600">{L.askHint}</p>
            </div>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); void ask(wish); }} className="flex gap-2 mt-3">
            <input
              value={wish}
              onChange={(e) => setWish(e.target.value)}
              placeholder={L.askPlaceholder}
              maxLength={500}
              data-testid="store-ask-input"
              className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl border border-amber-200 bg-white text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 shadow-2xs"
            />
            <button
              type="submit"
              disabled={wish.trim().length < 2}
              data-testid="store-ask-send"
              className="px-5 py-2.5 rounded-xl bg-amber-800 hover:bg-amber-900 disabled:bg-stone-300 text-white text-sm font-bold inline-flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
            >
              {thinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>{L.ask}</span>
            </button>
          </form>
          <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1">
            {L.chips.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => void ask(c)}
                className="px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 hover:border-amber-300 transition-colors cursor-pointer"
              >
                {c}
              </button>
            ))}
          </div>

          {advice && (
            <div className="mt-5 space-y-3 pt-4 border-t border-amber-200/60" data-testid="store-picks">
              <div className="flex items-start gap-2.5">
                <span
                  className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold ${
                    advice.source === 'shaheen' ? 'bg-amber-800 text-white' : 'bg-stone-200 text-stone-800'
                  }`}
                >
                  {advice.source === 'shaheen' ? L.byShaheen : L.quick}
                </span>
                <p className="text-sm text-stone-800 leading-relaxed font-medium">
                  {thinking ? L.thinking : advice.reply}
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {advice.picks.map((p) => card(p.product, p.why, true))}
              </div>
              {!thinking && (
                <p className="text-[11px] text-stone-500" data-testid="store-ai-note">
                  {advice.source === 'shaheen' ? L.aiNoteShaheen : L.aiNoteQuick}
                </p>
              )}
            </div>
          )}
        </section>

        {/* Product Catalog Grid */}
        {section === 'cosmetics' && !loading && !sectionCount.cosmetics ? (
          <div className="text-center py-14 bg-gradient-to-b from-rose-50 to-white rounded-3xl border border-rose-200/70 p-8 space-y-3" data-testid="store-cosmetics-soon">
            <Sparkles className="w-10 h-10 mx-auto text-rose-400" />
            <p className="text-lg font-black text-stone-900">{cosmeticsText(currentLang, 'storeTitle')} — {cosmeticsText(currentLang, 'comingSoon')}</p>
            <p className="text-sm text-stone-600 max-w-xl mx-auto leading-relaxed">{cosmeticsText(currentLang, 'comingSoonText')}</p>
            <a href="#cosmetics" className="inline-block px-5 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-sm font-bold">
              {cosmeticsText(currentLang, 'tabFormulator')}
            </a>
          </div>
        ) : loading && !products.length ? (
          <div className="text-center py-16 space-y-3" data-testid="store-loading">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-amber-700" />
            <p className="text-sm font-medium text-stone-500">{L.loading}</p>
          </div>
        ) : shown.length ? (
          <>
            <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" data-testid="store-grid">
              {shown.slice(0, limit).map((p) => card(p))}
            </section>
            {shown.length > limit && (
              <div className="text-center mt-8">
                <button
                  type="button"
                  onClick={() => setLimit(limit + PAGE)}
                  data-testid="store-more"
                  className="px-7 py-3 rounded-2xl border border-amber-400/80 bg-white hover:bg-amber-50 text-amber-950 text-sm font-bold shadow-xs transition-all cursor-pointer active:scale-95"
                >
                  {L.more.replace('{n}', String(shown.length - limit))}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16 bg-white rounded-3xl border border-stone-200/80 p-8 space-y-3">
            <Package className="w-10 h-10 mx-auto text-stone-300" />
            <p className="text-sm font-bold text-stone-700">{L.noResults}</p>
            <button
              type="button"
              onClick={resetFilters}
              className="px-4 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold cursor-pointer"
            >
              {L.clear}
            </button>
          </div>
        )}
      </main>

      {/* Cart Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end" onClick={() => setCartOpen(false)}>
          <aside
            className="w-full max-w-sm h-full bg-white p-5 flex flex-col overflow-y-auto shadow-2xl"
            role="dialog" aria-modal="true" aria-label={directPurchase ? L.buyNow : L.cart}
            onClick={(e) => e.stopPropagation()}
            data-testid="store-cart"
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="font-extrabold text-lg text-stone-900 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-amber-700" />
                <span>{directPurchase ? L.buyNow : L.cart}</span>
              </h3>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className="p-1 rounded-lg hover:bg-stone-100 text-stone-500 cursor-pointer"
                title={L.cancel}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {visibleDirect.length > 0 && (
              <div className="space-y-2 my-3" data-testid="direct-orders">
                <p className="text-xs font-bold text-stone-700">{L.directMyOrders}</p>
                {visibleDirect.map((o) => <DirectPaymentCard key={o.ref} order={o} lang={currentLang} onChange={() => setDirectOrders(savedDirectOrders())} />)}
              </div>
            )}
            {directPurchase && <p className="text-xs text-amber-900 bg-amber-50 p-2 rounded-lg my-2">{currentLang === 'ar' ? 'شراء هذا المنتج فقط. محتويات سلتك الأخرى محفوظة كما هي.' : 'Buy only this product. Your existing basket stays unchanged.'}</p>}
            {summary.lines.length ? (
              <>
                <div className="shrink-0 divide-y divide-stone-100 py-2">
                  {summary.lines.map(({ product, qty }) => (
                    <div key={product.sku} className="py-3 flex items-center gap-3">
                      <ProductImage product={product} className="w-12 h-12 rounded-xl shrink-0 border border-stone-200" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-stone-900 line-clamp-1">
                          {storeLocalized(product.name, currentLang)}
                        </p>
                        <p className="text-xs font-semibold text-stone-500 font-mono-numbers">
                          {money.money(lineTotal.get(product.sku) ?? 0)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 bg-stone-100 rounded-lg p-0.5">
                        <button
                          type="button"
                          onClick={() => changeCheckoutQty(product.sku, qty - 1)}
                          disabled={Boolean(directPurchase && qty <= 1) || paying}
                          aria-label={currentLang === 'ar' ? 'تقليل الكمية' : 'Decrease quantity'}
                          className="p-1 rounded hover:bg-white text-stone-700 cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-bold font-mono-numbers">{storeNumber(qty, currentLang)}</span>
                        <button
                          type="button"
                          onClick={() => changeCheckoutQty(product.sku, qty + 1)}
                          disabled={qty >= 99 || paying}
                          aria-label={currentLang === 'ar' ? 'زيادة الكمية' : 'Increase quantity'}
                          className="p-1 rounded hover:bg-white text-stone-700 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {step === 'cart' && !directPurchase && (
                  <CompleteYourOrder products={products} basis={summary.lines.map((l) => l.product)} lang={currentLang} variant="cart" price={money.price}
                    onAdd={add} onOpen={(p) => { setCartOpen(false); openDetails(p); }} added={justAdded} inCart={summary.lines.map((l) => l.product.sku)} />
                )}

                <div className="border-t border-stone-100 pt-4 space-y-2.5">
                  {countryPicker('store-cart-country')}
                  <p className="flex justify-between text-xs text-stone-600">
                    <span>{L.itemsTotal}</span>
                    <span className="font-mono-numbers">{money.money(bill.items)}</span>
                  </p>
                  <p className="flex justify-between text-xs text-stone-600" data-testid="store-cart-shipping">
                    <span>
                      {L.shipping}
                      {bill.zone.days ? (
                        <span className="block text-[10px] text-stone-400">
                          {L.shippingDays.replace('{days}', bill.zone.days)}
                        </span>
                      ) : null}
                    </span>
                    <span className="font-mono-numbers">{money.money(bill.shipping)}</span>
                  </p>
                  <p className="flex justify-between text-sm font-extrabold text-stone-900 pt-1 border-t border-stone-100">
                    <span>{L.total}</span>
                    <span data-testid="store-cart-total" className="font-mono-numbers text-amber-900">
                      {money.money(bill.total)}
                    </span>
                  </p>
                  {/* L-05 UN1266 + L-09 VAT Invoice + L-36 Payment Disclosure */}
                  <StoreInvoiceBreakdown subtotal={bill.items} shipping={bill.shipping} country={money.country} currency={money.currency} money={money.money} lang={currentLang} />
                  <LegalDisclaimer type="shipping" lang={currentLang} compact />
                  <p className="text-[10px] text-stone-500 leading-relaxed">
                    {currentLang === 'ar' ? 'الأسعار لا تشمل ضريبة بلدك/الجمارك. الإرجاع: تواصل خلال 14 يومًا عبر التاجر المسؤول (المنصة وسيط).' : 'Prices exclude your country VAT/customs. Returns: contact merchant within 14 days (platform is intermediary).'}
                  </p>

                  {step === 'form' ? (
                    <div className="space-y-3" data-testid="store-checkout-form">
                      <div className="flex items-center justify-between pt-1">
                        <p className="text-sm font-bold text-stone-900">{L.deliveryDetails}</p>
                      </div>

                      {payments?.mode === 'test' && (
                        <p className="text-[11px] rounded-lg bg-sky-50 text-sky-800 px-2 py-1">{L.testMode}</p>
                      )}
                      {(
                        [
                          ['name', L.fullName, 'text', 'name'],
                          ['email', L.email, 'email', 'email'],
                          ['phone', L.phone, 'tel', 'tel'],
                          ['city', L.city, 'text', 'address-level2'],
                          ['line', L.address, 'text', 'street-address'],
                        ] as const
                      ).map(([key, label, type, auto]) => (
                        <input
                          key={key}
                          type={type}
                          required
                          autoComplete={auto}
                          placeholder={label}
                          aria-label={label}
                          value={payForm[key]}
                          onChange={(e) => setPayForm({ ...payForm, [key]: e.target.value })}
                          className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs focus:outline-none focus:border-amber-600"
                        />
                      ))}

                      {signedIn && retailerId ? (
                        <CheckoutPayPanel
                          lang={currentLang}
                          country={money.country}
                          customerId={retailerId}
                          amountLabel={money.money(bill.total)}
                          onStoreEmail={sendToStore}
                        />
                      ) : (
                        <button type="button" onClick={() => { requireCustomerLogin(); onRequireAuth?.(); }} className="w-full rounded-xl bg-stone-900 py-2.5 text-sm font-bold text-white" data-testid="checkout-sign-in">{currentLang === 'ar' ? 'سجّل الدخول لحفظ البطاقة أو المحفظة' : 'Sign in to save a card or wallet'}</button>
                      )}
                      {canPay && <fieldset className="rounded-xl border border-stone-200 bg-stone-50 p-3 space-y-3" data-testid="real-payment-methods">
                        <legend className="text-xs font-bold px-1">{currentLang === 'ar' ? 'وسائل الدفع المفعّلة لبلدك' : 'Enabled methods for your country'}</legend>
                        {payments?.methods.map((m) => <label key={m.id} className="flex items-center gap-2 text-xs">
                          <input type="radio" name="paymentMethod" value={m.id} checked={!chosenDirect && chosenMethod === m.id} onChange={() => { setPaymentMethod(m.id); setDirectChoice(''); }} />
                          {m.id === 'card' ? (currentLang === 'ar' ? 'بطاقة بنكية' : 'Bank card') : (currentLang === 'ar' ? 'محفظة مصرية' : 'Egyptian mobile wallet')}
                        </label>)}
                        {directMethods.length > 0 && <div className="space-y-2 pt-1" data-testid="direct-methods">
                          <p className="text-[11px] font-bold text-emerald-800">{L.directTitle}</p>
                          {directMethods.map((m) => <label key={m.id} className="flex items-center gap-2 text-xs">
                            <input type="radio" name="paymentMethod" value={m.id} checked={chosenDirect?.id === m.id} onChange={() => setDirectChoice(m.id)} />
                            <span>{L.directKinds[m.kind] || m.label}{m.label && m.label !== L.directKinds[m.kind] ? <span className="text-stone-500"> · {m.label}</span> : null}</span>
                          </label>)}
                          <p className="text-[11px] text-stone-600">{L.directNote}</p>
                        </div>}
                        {!canPay && (payments === null ? <p role="status" className="text-xs text-stone-600">{L.loading}</p> : <ProductPayMethods lang={currentLang} country={money.country} heading={currentLang === 'ar' ? 'وسائل الدفع المتاحة لطلبك' : 'Payment methods available for this order'} />)}
                        {payments?.enabled && !chosenDirect && <p className="text-[11px] text-stone-600 flex items-start gap-2"><ShieldCheck className="w-4 h-4 shrink-0" />{currentLang === 'ar' ? 'تُدخل بيانات البطاقة أو المحفظة داخل صفحة البوابة فقط. لا تحفظ شام رقم البطاقة أو رمز CVV، والتأكيد من البوابة هو إثبات الدفع.' : 'Enter card or wallet details only on the gateway page. Sham does not save card numbers or CVVs; only a verified gateway response confirms payment.'}</p>}
                        {chargedBill && !chosenDirect && <p className="text-xs font-semibold" data-testid="charge-currency">{L.payCharge.replace('{amount}', `${chargedBill.total} ${chargedBill.currency}`)}</p>}
                      </fieldset>}

                      {payMessage && (
                        <p className="text-xs text-red-700" role="alert">
                          {payMessage}
                        </p>
                      )}
                      {orderSent && !canPay && (
                        <p className="text-xs rounded-lg bg-emerald-50 text-emerald-800 px-2 py-1.5" role="status" data-testid="order-by-email-sent">
                          {L.orderOpened.replace('{email}', contactEmail('orders'))} <span className="font-mono">({orderSent})</span>
                        </p>
                      )}

                      {canPay && (
                        <button
                          type="button"
                          disabled={paying}
                          onClick={(e) => { void pay(e); }}
                          data-testid="store-pay"
                          className="w-full py-2 text-xs font-bold text-stone-600 underline"
                        >
                          {paying ? L.paying : (chosenDirect ? (chosenDirect.kind === 'cod' ? L.directCodPlace : L.directReserve) : L.payContinue)}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setStep('cart')}
                        className="w-full py-1.5 text-xs text-stone-600 hover:underline cursor-pointer"
                      >
                        {L.back}
                      </button>
                    </div>
                  ) : canPay ? (
                    <>
                      <button
                        type="button"
                        onClick={() => { if (!signedIn && !requireCustomerLogin()) { onRequireAuth?.(); return; } setStep('form'); }}
                        data-testid="store-pay-start"
                        className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold cursor-pointer transition-all shadow-xs"
                      >
                        {signedIn ? (currentLang === 'ar' ? 'ادفع بالبطاقة أو المحفظة' : 'Pay by card or wallet') : (currentLang === 'ar' ? 'سجّل الدخول للدفع' : 'Sign in to pay')}
                      </button>
                      <button
                        type="button"
                        onClick={checkout}
                        className="w-full py-1.5 text-xs text-amber-800 hover:underline cursor-pointer text-center"
                      >
                        {L.orAssistant}
                      </button>
                    </>
                  ) : (
                    <div className="space-y-2">
                      {payments === null ? <p className="text-xs text-stone-600" role="status">{L.loading}</p> : <ProductPayMethods lang={currentLang} country={money.country} heading={currentLang === 'ar' ? 'وسائل الدفع المتاحة لطلبك' : 'Payment methods available for this order'} />}
                      {/* #169: the main button continues to the delivery form (the order then goes to the store's inbox), not to the chat. */}
                      <button type="button" onClick={() => { if (!signedIn && !requireCustomerLogin()) { onRequireAuth?.(); return; } setStep('form'); setOrderSent(''); }} disabled={payments === null} data-testid="store-order-start"
                        className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:bg-stone-400 text-white text-sm font-bold cursor-pointer transition-all shadow-xs">{signedIn ? (currentLang === 'ar' ? 'ادفع بالبطاقة أو المحفظة' : 'Pay by card or wallet') : (currentLang === 'ar' ? 'سجّل الدخول للدفع' : 'Sign in to pay')}</button>
                      <button type="button" onClick={checkout} className="w-full py-1.5 text-xs text-amber-800 hover:underline cursor-pointer text-center">{L.orAssistant}</button>
                    </div>
                  )}

                  {step === 'cart' && !directPurchase && (
                    <button
                      type="button"
                      onClick={clearCart}
                      className="w-full py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{L.clearCart}</span>
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="py-16 text-center space-y-2">
                <ShoppingCart className="w-8 h-8 text-stone-300 mx-auto" />
                <p className="text-sm font-semibold text-stone-500">{directPurchase && loading ? L.loading : directPurchase ? L.outOfStock : L.cartEmpty}</p>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* Store Sales Analytics (Recharts Pie Chart) Modal */}
      {showAnalytics && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl p-4 sm:p-6 w-full max-w-4xl shadow-2xl relative my-auto animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowAnalytics(false)}
              className="absolute top-4 end-4 p-2 rounded-full hover:bg-stone-100 text-stone-500 hover:text-stone-900 transition-colors cursor-pointer"
              aria-label={currentLang === 'ar' ? 'إغلاق' : 'Close'}
            >
              <X className="w-5 h-5" />
            </button>
            <StoreSalesCategoryChart
              currentLang={currentLang}
              currencyCode={L.currency}
            />
          </div>
        </div>
      )}

      {/* Customer Payment Vault & Professional Environment Modal */}
      {showPaymentModal && <PaymentEnvironmentModal currentLang={currentLang} customerId={signedIn ? retailerId : undefined} onRequireAuth={onRequireAuth} onClose={() => setShowPaymentModal(false)} />}

      {/* Merchant Registration Modal */}
      {showReg && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h2 className="text-lg font-extrabold text-stone-900">{L.merchantTitle}</h2>
            <form onSubmit={register} className="space-y-3">
              {(
                [
                  ['nameAr', L.companyName, 'text', true],
                  ['email', L.email, 'email', true],
                  ['phone', L.phone, 'tel', false],
                  ['pass', L.password, 'password', true],
                ] as const
              ).map(([key, label, type, required]) => (
                <div key={key}>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {label}
                    {required ? ' *' : ''}
                  </label>
                  <input
                    type={type}
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    required={required}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs focus:outline-none focus:border-amber-700"
                  />
                </div>
              ))}
              <button
                type="submit"
                className="w-full py-2.5 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                {L.register}
              </button>
            </form>
            <button
              type="button"
              onClick={() => setShowReg(false)}
              className="w-full text-center text-xs text-stone-500 hover:underline cursor-pointer"
            >
              {L.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
