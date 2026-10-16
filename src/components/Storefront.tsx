import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Loader2, Minus, Package, Plus, Search, Send, ShoppingCart, Sparkles, Star, Trash2, UserPlus, X } from 'lucide-react';
import { saveMerchant } from '../utils/merchantDataStore';
import { FAMILY_LABEL, GENDER_LABEL, searchText, type Family, type Gender, type StoreProduct } from '../utils/storeCatalog';
import { askShaheenStore, loadStoreCatalog, localSuggestion, storeImageSrc, type StoreSuggestion } from '../utils/liveStore';
import { addToCart, cartSummary, clearCart, orderMessage, setCartQty, useCart } from '../utils/storeCart';

const t = {
  ar: {
    title: 'متجر شام', search: 'اكتب اسم عطر أو نوتة أو علامة…',
    storeTagline: 'عطور مختارة بعناية', searchLabel: 'ابحث في عطور متجر شام', searchButton: 'بحث',
    searchResults: 'اقتراحات تناسب بحثك', searchNoResults: 'مفيش عطور مطابقة — جرّب اسم أو نوتة تانية.',
    searchAll: 'عرض كل النتائج', searchQuickTitle: 'ابدأ بنوتة بتحبها', searchQuickNotes: ['عود', 'مسك', 'فانيليا'], searchShortcut: 'Ctrl K',
    askTitle: 'اسأل شاهين', askHint: 'قول لشاهين بتدوّر على إيه — المناسبة، الموسم، رجالي ولا نسائي، الميزانية — وهو يختار لك من المتجر.',
    askPlaceholder: 'مثال: عطر رجالي للصيف للشغل تحت 250 جنيه', ask: 'رشّح لي',
    chips: ['رجالي صيفي منعش للشغل', 'هدية نسائية فخمة', 'عود ثابت للسهرات', 'عطر حلو للشتاء', 'أرخص عطور مميزة'],
    byShaheen: 'اختيار شاهين', quick: 'اقتراح سريع', thinking: 'شاهين بيراجع المتجر…',
    all: 'الكل', newOnly: 'الجديد', allCategories: 'كل الفئات', allBrands: 'كل العلامات',
    sortNew: 'الأحدث', sortPriceLow: 'السعر: من الأقل', sortPriceHigh: 'السعر: من الأعلى', sortRating: 'الأعلى تقييماً',
    loading: 'جاري تحميل المنتجات…', more: 'عرض المزيد ({n} منتج)', found: '{count} منتج', noResults: 'لا توجد نتائج — جرّب «اسأل شاهين» أو امسح الفلاتر', clear: 'مسح الفلاتر',
    addToCart: 'أضف للسلة', added: 'أضيف ✓', details: 'التفاصيل', currency: 'جنيه', outOfStock: 'غير متوفر',
    cart: 'السلة', cartEmpty: 'السلة فاضية', total: 'الإجمالي', checkout: 'أتمم الطلب مع مساعد شام', clearCart: 'تفريغ السلة',
    becomeMerchant: 'سجّل كتاجر', merchantTitle: 'تسجيل تاجر', companyName: 'اسم الشركة', email: 'البريد', phone: 'الهاتف',
    password: 'كلمة المرور', register: 'سجّل الآن', cancel: 'إلغاء', fill: 'يرجى تعبئة الحقول المطلوبة', registered: 'تم استلام طلبك، وسيراجعه فريق شام',
  },
  en: {
    title: 'Sham Store', search: 'Search a scent, note or brand…',
    storeTagline: 'Scents, chosen with care', searchLabel: 'Search Sham perfume store', searchButton: 'Search',
    searchResults: 'Scents matching your search', searchNoResults: 'No matching scents — try another name or note.',
    searchAll: 'View all results', searchQuickTitle: 'Start with a note you love', searchQuickNotes: ['Oud', 'Musk', 'Vanilla'], searchShortcut: 'Ctrl K',
    askTitle: 'Ask Shaheen', askHint: 'Tell Shaheen what you are looking for — occasion, season, men or women, budget — and he picks from the store.',
    askPlaceholder: 'e.g. a fresh summer perfume for work under 250 EGP', ask: 'Recommend',
    chips: ['Fresh summer scent for work', 'Luxury gift for her', 'Long-lasting oud for evenings', 'Sweet winter perfume', 'Best budget picks'],
    byShaheen: "Shaheen's pick", quick: 'Quick pick', thinking: 'Shaheen is reviewing the store…',
    all: 'All', newOnly: 'New', allCategories: 'All categories', allBrands: 'All brands',
    sortNew: 'Newest', sortPriceLow: 'Price: low to high', sortPriceHigh: 'Price: high to low', sortRating: 'Top rated',
    loading: 'Loading products…', more: 'Show more ({n} products)', found: '{count} products', noResults: 'No results — try «Ask Shaheen» or clear the filters', clear: 'Clear filters',
    addToCart: 'Add to cart', added: 'Added ✓', details: 'Details', currency: 'EGP', outOfStock: 'Out of stock',
    cart: 'Cart', cartEmpty: 'Your cart is empty', total: 'Total', checkout: 'Complete the order with Sham assistant', clearCart: 'Empty cart',
    becomeMerchant: 'Become a merchant', merchantTitle: 'Merchant registration', companyName: 'Company name', email: 'Email', phone: 'Phone',
    password: 'Password', register: 'Register', cancel: 'Cancel', fill: 'Please fill the required fields', registered: 'Request received — the Sham team will review it',
  },
};

type Sort = 'new' | 'priceLow' | 'priceHigh' | 'rating';
interface Props { onClose?: () => void; currentLang: 'ar' | 'en'; retailerId?: string; shaheenQuery?: { text: string; at: number } | null }

function ProductImage({ product, className }: { product: StoreProduct; className: string }) {
  const [broken, setBroken] = useState(false);
  if (!product.imageUrl || broken) {
    return <div className={`${className} bg-gradient-to-br from-amber-100 to-stone-100 flex items-center justify-center`}><Package className="w-10 h-10 text-amber-400/50" /></div>;
  }
  // Real product photos (bottle on white) are shown whole; illustrative stock photos fill the frame.
  const fit = /unsplash\.com/.test(product.imageUrl) ? 'object-cover' : 'object-contain bg-white';
  return <img src={storeImageSrc(product.imageUrl)} alt={product.name.ar} loading="lazy" onError={() => setBroken(true)} className={`${className} ${fit}`} />;
}

export const Storefront: React.FC<Props> = ({ currentLang, shaheenQuery }) => {
  const L = t[currentLang];
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    loadStoreCatalog().then((list) => { if (live) setProducts(list); }).catch(() => undefined).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);
  // Large catalogs: show a page of products at a time.
  const PAGE = 48;
  const [limit, setLimit] = useState(PAGE);

  // Filters and the live scent-finder search.
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchBarRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [gender, setGender] = useState<Gender | 'all'>('all');
  const [family, setFamily] = useState<Family | 'all'>('all');
  const [category, setCategory] = useState('all');
  const [brand, setBrand] = useState('all');
  const [newOnly, setNewOnly] = useState(false);
  const [sort, setSort] = useState<Sort>('new');
  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(), [products]);
  const brands = useMemo(() => [...new Set(products.map((p) => p.brand).filter(Boolean))].sort(), [products]);
  const families = useMemo(() => [...new Set(products.flatMap((p) => p.families))], [products]);

  const shown = useMemo(() => {
    const words = search.toLowerCase().split(/\s+/).filter(Boolean);
    const list = products.filter((p) => {
      if (gender !== 'all' && p.gender !== gender && !(p.gender === 'unisex')) return false;
      if (family !== 'all' && !p.families.includes(family)) return false;
      if (category !== 'all' && p.category !== category) return false;
      if (brand !== 'all' && p.brand !== brand) return false;
      if (newOnly && !p.isNew) return false;
      if (words.length) { const text = searchText(p); if (!words.every((w) => text.includes(w))) return false; }
      return true;
    });
    const time = (p: StoreProduct) => (p.createdAt ? Date.parse(p.createdAt) || 0 : 0);
    return list.sort((a, b) => sort === 'priceLow' ? a.price - b.price : sort === 'priceHigh' ? b.price - a.price
      : sort === 'rating' ? (b.rating || 0) - (a.rating || 0) : time(b) - time(a));
  }, [products, search, gender, family, category, brand, newOnly, sort]);
  useEffect(() => { setLimit(PAGE); }, [search, gender, family, category, brand, newOnly, sort]);
  const filtered = search || gender !== 'all' || family !== 'all' || category !== 'all' || brand !== 'all' || newOnly;
  const resetFilters = () => { setSearch(''); setGender('all'); setFamily('all'); setCategory('all'); setBrand('all'); setNewOnly(false); };

  useEffect(() => {
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (event.target instanceof Node && !searchBarRef.current?.contains(event.target)) setSearchFocused(false);
    };
    const handleSearchShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
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

  // «اسأل شاهين»
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
    setAdvice(localSuggestion(products, message, currentLang)); // instant, then Shaheen upgrades it
    setThinking(true);
    const better = await askShaheenStore(products, message, currentLang);
    if (id !== askId.current) return;
    setThinking(false);
    if (better) setAdvice(better);
    else setAdvice((prev) => prev && { ...prev, reply: localSuggestion(products, message, currentLang).reply.replace(/\s*[—-]\s*شاهين.*$|\s*[—-]\s*Shaheen.*$/, '') });
  };
  // Opened from Shaheen's chat («ترشيحات من متجر شام»): ask right away with the visitor's words.
  useEffect(() => {
    if (!shaheenQuery?.text) return;
    void ask(shaheenQuery.text);
    panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shaheenQuery?.at]);

  // Cart
  const cart = useCart();
  const summary = cartSummary(cart, products);
  const [cartOpen, setCartOpen] = useState(false);
  const [justAdded, setJustAdded] = useState('');
  const add = (p: StoreProduct) => { addToCart(p.sku); setJustAdded(p.sku); setTimeout(() => setJustAdded((s) => (s === p.sku ? '' : s)), 1500); };
  const checkout = () => {
    if (!summary.lines.length) return;
    window.dispatchEvent(new CustomEvent('open-sham-assistant', { detail: orderMessage(summary, currentLang) }));
    setCartOpen(false);
  };
  const openDetails = (p: StoreProduct) => { window.location.hash = `#product=${p.id}`; };

  // Merchant registration
  const [showReg, setShowReg] = useState(false);
  const [form, setForm] = useState({ nameAr: '', email: '', phone: '', pass: '' });
  const register = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nameAr || !form.email || !form.pass) { alert(L.fill); return; }
    const now = new Date().toISOString();
    saveMerchant({
      id: Math.random().toString(36).slice(2, 11), companyNameAr: form.nameAr, companyNameEn: form.nameAr,
      registrationNumber: '', taxId: '', email: form.email, phone: form.phone, whatsapp: form.phone,
      channels: { email: true, whatsapp: true, phone: true, other: false }, approved: false, isActive: true, marginPercent: 25,
      bankingInfo: undefined, totalProducts: 0, totalOrders: 0, totalRevenue: 0, totalPlatformRevenue: 0, notes: '',
      status: 'pending', createdAt: now, updatedAt: now,
    });
    setShowReg(false); setForm({ nameAr: '', email: '', phone: '', pass: '' }); alert(L.registered);
  };

  const chip = (active: boolean) => `px-3 py-1.5 rounded-full text-xs whitespace-nowrap border transition-colors ${active ? 'bg-amber-600 border-amber-600 text-white' : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'}`;
  const price = (n: number) => `${n.toLocaleString(currentLang === 'ar' ? 'ar-EG' : 'en-US')} ${L.currency}`;

  const card = (p: StoreProduct, why?: string, pick?: boolean) => (
    <div key={p.sku} className={`bg-white rounded-2xl border ${pick ? 'border-amber-300 shadow-md' : 'border-stone-200'} overflow-hidden flex flex-col`} data-testid={pick ? 'store-pick' : 'store-product'}>
      <button type="button" onClick={() => openDetails(p)} className="relative block cursor-pointer" title={L.details}>
        <ProductImage product={p} className="w-full aspect-square" />
        {p.isNew && <span className="absolute top-2 start-2 px-2 py-0.5 bg-emerald-500 text-white text-[10px] rounded-full">{currentLang === 'ar' ? 'جديد' : 'New'}</span>}
        {!p.inStock && <span className="absolute top-2 end-2 px-2 py-0.5 bg-stone-700 text-white text-[10px] rounded-full">{L.outOfStock}</span>}
      </button>
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <button type="button" onClick={() => openDetails(p)} className="text-start font-bold text-sm text-stone-900 line-clamp-2 hover:text-amber-800 cursor-pointer">{p.name[currentLang]}</button>
        <div className="flex items-center gap-2 text-[11px] text-stone-500">
          {p.brand && <span>{p.brand}</span>}
          {p.gender && <span>· {GENDER_LABEL[p.gender][currentLang]}</span>}
          {p.rating ? <span className="inline-flex items-center gap-0.5 text-amber-600"><Star className="w-3 h-3 fill-current" />{p.rating}</span> : null}
        </div>
        {p.families.length > 0 && (
          <div className="flex flex-wrap gap-1">{p.families.slice(0, 3).map((f) => <span key={f} className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 text-[10px]">{FAMILY_LABEL[f][currentLang]}</span>)}</div>
        )}
        {why && <p className="text-[11px] leading-relaxed text-stone-700 bg-amber-50/60 rounded-lg p-2"><Sparkles className="inline w-3 h-3 text-amber-600 me-1" />{why}</p>}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span className="font-bold text-amber-900 text-sm">{price(p.price)}</span>
          <button type="button" disabled={!p.inStock} onClick={() => add(p)}
            className="px-2.5 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 disabled:bg-stone-300 text-white text-[11px] cursor-pointer">
            {justAdded === p.sku ? L.added : L.addToCart}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-50" dir={currentLang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Keep the store's sticky search bar below the site header so language menus stay on top. */}
      <header className="sticky z-30 border-b border-white/10 bg-stone-950/95 text-white shadow-lg shadow-stone-950/10 backdrop-blur-xl" style={{ top: 'var(--sham-global-header-height, 0px)' }}>
        <div className="mx-auto flex max-w-7xl items-center gap-2.5 px-3 py-2.5 sm:gap-4 sm:px-4 sm:py-3">
          <div className="flex shrink-0 items-center gap-2.5">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-300/30 bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 shadow-md shadow-amber-950/30">
              <span className="absolute inset-0 rounded-2xl bg-white/10" />
              <Sparkles className="relative h-5 w-5 text-stone-950" />
            </div>
            <div className="hidden sm:block">
              <span className="block text-sm font-extrabold tracking-wide text-white">{L.title}</span>
              <span className="block text-[10px] font-medium text-amber-200/75">{L.storeTagline}</span>
            </div>
          </div>

          <div className="relative min-w-0 flex-1" ref={searchBarRef}>
            <div className={`pointer-events-none absolute -inset-1 rounded-[1.35rem] bg-gradient-to-r from-amber-400/30 via-orange-500/10 to-amber-200/20 blur-md transition-opacity ${searchFocused ? 'opacity-100' : 'opacity-60'}`} />
            <form role="search" aria-label={L.searchLabel} onSubmit={(event) => { event.preventDefault(); setSearchFocused(false); searchInputRef.current?.blur(); }}>
              <div className={`relative flex h-12 items-center gap-1.5 rounded-2xl border p-1.5 shadow-inner transition-all ${searchFocused ? 'border-amber-300/70 bg-stone-900 ring-2 ring-amber-400/20' : 'border-white/15 bg-stone-900/85 hover:border-amber-300/40'}`}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-amber-600 text-stone-950 shadow-sm shadow-amber-950/30">
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
                  <button type="button" onClick={() => { setSearch(''); searchInputRef.current?.focus(); }} aria-label={currentLang === 'ar' ? 'مسح البحث' : 'Clear search'} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-stone-400 transition hover:bg-white/10 hover:text-white">
                    <X className="h-4 w-4" />
                  </button>
                ) : (
                  <kbd className="hidden shrink-0 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-medium text-stone-400 lg:inline-flex">{L.searchShortcut}</kbd>
                )}
                <button type="submit" aria-label={L.searchButton} className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-2.5 text-stone-950 shadow-sm transition hover:from-amber-400 hover:to-orange-400 active:scale-[0.98] sm:px-4">
                  <Search className="h-4 w-4 sm:hidden" />
                  <span className="hidden text-xs font-extrabold sm:inline">{L.searchButton}</span>
                  <ArrowUpRight className="hidden h-3.5 w-3.5 sm:block" />
                </button>
              </div>
            </form>

            {searchFocused && (
              <div id="store-search-suggestions" className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-stone-200 bg-white text-stone-800 shadow-2xl shadow-stone-950/25 animate-in fade-in zoom-in-95" data-testid="store-search-suggestions">
                {search.trim() ? (
                  <>
                    <div className="flex items-center justify-between gap-3 border-b border-stone-100 bg-stone-50/90 px-3.5 py-2.5">
                      <span className="flex min-w-0 items-center gap-2 text-xs font-bold text-stone-700">
                        <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                        <span className="truncate">{L.searchResults}</span>
                      </span>
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">{shown.length}</span>
                    </div>
                    {shown.length ? (
                      <div className="max-h-72 overflow-y-auto p-1.5">
                        {shown.slice(0, 5).map((product) => (
                          <button key={product.sku} type="button" onClick={() => { setSearchFocused(false); openDetails(product); }} className="group flex w-full items-center gap-2.5 rounded-xl p-2 text-start transition hover:bg-amber-50 focus:bg-amber-50 focus:outline-none" data-testid="store-search-suggestion">
                            <ProductImage product={product} className="h-11 w-11 shrink-0 rounded-xl border border-stone-200" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-bold text-stone-900 group-hover:text-amber-900">{product.name[currentLang]}</span>
                              <span className="mt-0.5 block truncate text-[10px] text-stone-500">{[product.brand || product.category, product.families.slice(0, 1).map((family) => FAMILY_LABEL[family][currentLang]).join('')].filter(Boolean).join(' · ')}</span>
                            </span>
                            <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-amber-900">
                              <span>{price(product.price)}</span>
                              <ArrowUpRight className="h-3.5 w-3.5 text-amber-600 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                            </span>
                          </button>
                        ))}
                        <button type="button" onClick={() => { setSearchFocused(false); document.querySelector('[data-testid="store-grid"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className="mt-1 flex w-full items-center justify-between rounded-xl border-t border-stone-100 px-3 py-2.5 text-xs font-bold text-amber-800 transition hover:bg-amber-50">
                          <span>{L.searchAll}</span><span>{shown.length}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 px-4 py-5 text-xs text-stone-500">
                        <Search className="h-4 w-4 shrink-0 text-stone-400" />{L.searchNoResults}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-3.5">
                    <p className="mb-2.5 flex items-center gap-2 text-xs font-bold text-stone-700"><Sparkles className="h-3.5 w-3.5 text-amber-600" />{L.searchQuickTitle}</p>
                    <div className="flex flex-wrap gap-2">
                      {L.searchQuickNotes.map((note) => (
                        <button key={note} type="button" onClick={() => { setSearch(note); searchInputRef.current?.focus(); }} className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:border-amber-400 hover:bg-amber-100">
                          <Search className="h-3 w-3" />{note}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <button type="button" onClick={() => setCartOpen(true)} className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 transition hover:border-amber-300/40 hover:bg-amber-400/10 cursor-pointer" title={L.cart} aria-label={L.cart} data-testid="store-cart-button">
            <ShoppingCart className="h-5 w-5" />
            {summary.count > 0 && <span className="absolute -top-1 -end-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-xs font-bold text-stone-950">{summary.count}</span>}
          </button>
          <button type="button" onClick={() => setShowReg(true)} className="hidden shrink-0 items-center gap-2 rounded-xl border border-amber-300/30 bg-amber-500 px-3 py-2 text-sm font-bold text-stone-950 transition hover:bg-amber-400 sm:flex">
            <UserPlus className="h-4 w-4" />{L.becomeMerchant}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5 space-y-6">
        {/* «اسأل شاهين» */}
        <section ref={panel} className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-4 sm:p-5 shadow-sm" data-testid="store-ask">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-8 h-8 rounded-full bg-amber-600 text-white flex items-center justify-center"><Sparkles className="w-4 h-4" /></span>
            <h2 className="font-bold text-stone-900">{L.askTitle}</h2>
          </div>
          <p className="text-xs text-stone-600 mb-3">{L.askHint}</p>
          <form onSubmit={(e) => { e.preventDefault(); void ask(wish); }} className="flex gap-2">
            <input value={wish} onChange={(e) => setWish(e.target.value)} placeholder={L.askPlaceholder} maxLength={500} data-testid="store-ask-input"
              className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-amber-200 bg-white text-sm focus:outline-none focus:border-amber-500" />
            <button type="submit" disabled={wish.trim().length < 2} data-testid="store-ask-send"
              className="px-4 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:bg-stone-300 text-white text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer">
              {thinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}{L.ask}
            </button>
          </form>
          <div className="flex gap-1.5 mt-2.5 overflow-x-auto pb-1">
            {L.chips.map((c) => <button key={c} type="button" onClick={() => void ask(c)} className={chip(false)}>{c}</button>)}
          </div>
          {advice && (
            <div className="mt-4 space-y-3" data-testid="store-picks">
              <div className="flex items-start gap-2">
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${advice.source === 'shaheen' ? 'bg-amber-600 text-white' : 'bg-stone-200 text-stone-700'}`}>
                  {advice.source === 'shaheen' ? L.byShaheen : L.quick}
                </span>
                <p className="text-sm text-stone-800 leading-relaxed">{thinking ? L.thinking : advice.reply}</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{advice.picks.map((p) => card(p.product, p.why, true))}</div>
            </div>
          )}
        </section>

        {/* Filters */}
        <section className="space-y-2.5">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button type="button" onClick={() => setGender('all')} className={chip(gender === 'all')}>{L.all}</button>
            {(['men', 'women', 'unisex'] as Gender[]).map((g) => <button key={g} type="button" onClick={() => setGender(g)} className={chip(gender === g)}>{GENDER_LABEL[g][currentLang]}</button>)}
            <button type="button" onClick={() => setNewOnly(!newOnly)} className={chip(newOnly)}>{L.newOnly}</button>
            <span className="w-px bg-stone-200 mx-1" />
            {families.map((f) => <button key={f} type="button" onClick={() => setFamily(family === f ? 'all' : f)} className={chip(family === f)}>{FAMILY_LABEL[f][currentLang]}</button>)}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs">
              <option value="all">{L.allCategories}</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={brand} onChange={(e) => setBrand(e.target.value)} className="px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs">
              <option value="all">{L.allBrands}</option>{brands.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs">
              <option value="new">{L.sortNew}</option><option value="priceLow">{L.sortPriceLow}</option>
              <option value="priceHigh">{L.sortPriceHigh}</option><option value="rating">{L.sortRating}</option>
            </select>
            <span className="text-xs text-stone-500">{L.found.replace('{count}', String(shown.length))}</span>
            {filtered && <button type="button" onClick={resetFilters} className="text-xs text-amber-700 hover:underline cursor-pointer">{L.clear}</button>}
          </div>
        </section>

        {loading && !products.length ? (
          <p className="text-center text-sm text-stone-500 py-10" data-testid="store-loading">{L.loading}</p>
        ) : shown.length ? (
          <>
            <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3" data-testid="store-grid">{shown.slice(0, limit).map((p) => card(p))}</section>
            {shown.length > limit && (
              <div className="text-center mt-5">
                <button type="button" onClick={() => setLimit(limit + PAGE)} data-testid="store-more"
                  className="px-6 py-2.5 rounded-xl border border-amber-300 bg-white hover:bg-amber-50 text-amber-900 text-sm font-semibold cursor-pointer">
                  {L.more.replace('{n}', String(shown.length - limit))}
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="text-center text-sm text-stone-500 py-10">{L.noResults}</p>
        )}
      </main>

      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={() => setCartOpen(false)}>
          <aside className="w-full max-w-sm h-full bg-white p-4 flex flex-col" onClick={(e) => e.stopPropagation()} data-testid="store-cart">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-lg">{L.cart}</h3>
              <button type="button" onClick={() => setCartOpen(false)} className="p-1 cursor-pointer" title={L.cancel}><X className="w-5 h-5" /></button>
            </div>
            {summary.lines.length ? (
              <>
                <div className="flex-1 overflow-y-auto divide-y">
                  {summary.lines.map(({ product, qty, subtotal }) => (
                    <div key={product.sku} className="py-2.5 flex items-center gap-2">
                      <ProductImage product={product} className="w-12 h-12 rounded-lg shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold line-clamp-1">{product.name[currentLang]}</p>
                        <p className="text-xs text-stone-500">{price(subtotal)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => setCartQty(product.sku, qty - 1)} className="p-1 rounded border cursor-pointer"><Minus className="w-3 h-3" /></button>
                        <span className="w-6 text-center text-sm">{qty}</span>
                        <button type="button" onClick={() => setCartQty(product.sku, qty + 1)} className="p-1 rounded border cursor-pointer"><Plus className="w-3 h-3" /></button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-3 space-y-2">
                  <p className="flex justify-between font-bold"><span>{L.total}</span><span data-testid="store-cart-total">{price(summary.total)}</span></p>
                  <button type="button" onClick={checkout} className="w-full py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold cursor-pointer">{L.checkout}</button>
                  <button type="button" onClick={clearCart} className="w-full py-2 rounded-xl bg-stone-100 text-stone-700 text-xs inline-flex items-center justify-center gap-1 cursor-pointer"><Trash2 className="w-3.5 h-3.5" />{L.clearCart}</button>
                </div>
              </>
            ) : <p className="text-sm text-stone-500 text-center py-10">{L.cartEmpty}</p>}
          </aside>
        </div>
      )}

      {showReg && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">{L.merchantTitle}</h2>
            <form onSubmit={register} className="space-y-3">
              {([['nameAr', L.companyName, 'text', true], ['email', L.email, 'email', true], ['phone', L.phone, 'tel', false], ['pass', L.password, 'password', true]] as const).map(([key, label, type, required]) => (
                <div key={key}>
                  <label className="block text-sm font-medium mb-1">{label}{required ? ' *' : ''}</label>
                  <input type={type} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} required={required} className="w-full px-3 py-2 border rounded-lg" />
                </div>
              ))}
              <button type="submit" className="w-full px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg">{L.register}</button>
            </form>
            <button type="button" onClick={() => setShowReg(false)} className="mt-3 text-sm text-stone-600">{L.cancel}</button>
          </div>
        </div>
      )}
    </div>
  );
};
