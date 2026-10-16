import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Minus, Package, Plus, Search, Send, ShoppingCart, Sparkles, Star, Trash2, UserPlus, X } from 'lucide-react';
import { saveMerchant } from '../utils/merchantDataStore';
import { FAMILY_LABEL, GENDER_LABEL, mergeCatalog, searchText, type Family, type Gender, type StoreProduct } from '../utils/storeCatalog';
import { askShaheenStore, loadStoreCatalog, localSuggestion, storeProducts, type StoreSuggestion } from '../utils/liveStore';
import { addToCart, cartSummary, clearCart, orderMessage, setCartQty, useCart } from '../utils/storeCart';

const t = {
  ar: {
    title: 'متجر شام', search: 'ابحث بالاسم أو العلامة أو النوتة (عود، فانيليا، مسك…)',
    askTitle: 'اسأل شاهين', askHint: 'قول لشاهين بتدوّر على إيه — المناسبة، الموسم، رجالي ولا نسائي، الميزانية — وهو يختار لك من المتجر.',
    askPlaceholder: 'مثال: عطر رجالي للصيف للشغل تحت 250 جنيه', ask: 'رشّح لي',
    chips: ['رجالي صيفي منعش للشغل', 'هدية نسائية فخمة', 'عود ثابت للسهرات', 'عطر حلو للشتاء', 'أرخص عطور مميزة'],
    byShaheen: 'اختيار شاهين', quick: 'اقتراح سريع', thinking: 'شاهين بيراجع المتجر…',
    all: 'الكل', newOnly: 'الجديد', allCategories: 'كل الفئات', allBrands: 'كل العلامات',
    sortNew: 'الأحدث', sortPriceLow: 'السعر: من الأقل', sortPriceHigh: 'السعر: من الأعلى', sortRating: 'الأعلى تقييماً',
    found: '{count} منتج', noResults: 'لا توجد نتائج — جرّب «اسأل شاهين» أو امسح الفلاتر', clear: 'مسح الفلاتر',
    addToCart: 'أضف للسلة', added: 'أضيف ✓', details: 'التفاصيل', currency: 'جنيه', outOfStock: 'غير متوفر',
    cart: 'السلة', cartEmpty: 'السلة فاضية', total: 'الإجمالي', checkout: 'أتمم الطلب مع مساعد شام', clearCart: 'تفريغ السلة',
    becomeMerchant: 'سجّل كتاجر', merchantTitle: 'تسجيل تاجر', companyName: 'اسم الشركة', email: 'البريد', phone: 'الهاتف',
    password: 'كلمة المرور', register: 'سجّل الآن', cancel: 'إلغاء', fill: 'يرجى تعبئة الحقول المطلوبة', registered: 'تم استلام طلبك، وسيراجعه فريق شام',
  },
  en: {
    title: 'Sham Store', search: 'Search by name, brand or note (oud, vanilla, musk…)',
    askTitle: 'Ask Shaheen', askHint: 'Tell Shaheen what you are looking for — occasion, season, men or women, budget — and he picks from the store.',
    askPlaceholder: 'e.g. a fresh summer perfume for work under 250 EGP', ask: 'Recommend',
    chips: ['Fresh summer scent for work', 'Luxury gift for her', 'Long-lasting oud for evenings', 'Sweet winter perfume', 'Best budget picks'],
    byShaheen: "Shaheen's pick", quick: 'Quick pick', thinking: 'Shaheen is reviewing the store…',
    all: 'All', newOnly: 'New', allCategories: 'All categories', allBrands: 'All brands',
    sortNew: 'Newest', sortPriceLow: 'Price: low to high', sortPriceHigh: 'Price: high to low', sortRating: 'Top rated',
    found: '{count} products', noResults: 'No results — try «Ask Shaheen» or clear the filters', clear: 'Clear filters',
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
  return <img src={product.imageUrl} alt={product.name.ar} loading="lazy" onError={() => setBroken(true)} className={`${className} object-cover`} />;
}

export const Storefront: React.FC<Props> = ({ currentLang, shaheenQuery }) => {
  const L = t[currentLang];
  const [products, setProducts] = useState<StoreProduct[]>(() => mergeCatalog(storeProducts()));
  useEffect(() => { let live = true; loadStoreCatalog().then((list) => { if (live) setProducts(list); }).catch(() => undefined); return () => { live = false; }; }, []);

  // Filters
  const [search, setSearch] = useState('');
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
  const filtered = search || gender !== 'all' || family !== 'all' || category !== 'all' || brand !== 'all' || newOnly;
  const resetFilters = () => { setSearch(''); setGender('all'); setFamily('all'); setCategory('all'); setBrand('all'); setNewOnly(false); };

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
      <header className="bg-stone-900 text-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center"><Sparkles className="w-5 h-5 text-white" /></div>
            <span className="text-lg font-bold">{L.title}</span>
          </div>
          <div className="flex-1 relative min-w-0">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={L.search} data-testid="store-search"
              className="w-full ps-9 pe-3 py-2 bg-stone-800 border border-stone-700 rounded-lg text-sm text-white placeholder-stone-400 focus:outline-none focus:border-amber-500" />
          </div>
          <button type="button" onClick={() => setCartOpen(true)} className="relative p-2 cursor-pointer" title={L.cart} data-testid="store-cart-button">
            <ShoppingCart className="w-5 h-5" />
            {summary.count > 0 && <span className="absolute -top-1 -end-1 min-w-5 h-5 px-1 bg-amber-500 text-white text-xs font-bold rounded-full flex items-center justify-center">{summary.count}</span>}
          </button>
          <button type="button" onClick={() => setShowReg(true)} className="hidden sm:flex items-center gap-2 px-3 py-2 bg-amber-600 hover:bg-amber-700 rounded-lg text-sm cursor-pointer">
            <UserPlus className="w-4 h-4" />{L.becomeMerchant}
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

        {shown.length ? (
          <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3" data-testid="store-grid">{shown.map((p) => card(p))}</section>
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
