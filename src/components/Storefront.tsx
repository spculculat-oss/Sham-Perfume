import React, { useState, useEffect } from 'react';
import { Search, Star, ShoppingCart, UserPlus, Menu, Sparkles, ArrowRight, Package, Check } from 'lucide-react';
import { getApprovedActiveProducts, saveMerchant } from '../utils/merchantDataStore';

const t = {
  ar: {
    title: 'متجر الشام', search: 'ابحث عن عطر...',
    categories: ['الكل', 'رجالي', 'نسائي', 'جديد'],
    featured: 'المنتجات المميزة', seeAll: 'اعرض الكل',
    addToCart: 'أضف للسلة', viewDetails: 'عرض التفاصيل', inStock: 'متاح',
    becomeMerchant: 'تاجر', companyNameAr: 'الاسم عربي',
    email: 'البريد', phone: 'هاتف', password: 'كلمة المرور',
    register: 'سجل الآن', cartTotal: 'المجموع', checkout: 'أتمم الطلب', clearCart: 'مسح السلة',
  },
  en: {
    title: 'Sham Store', search: 'Search...',
    categories: ['All', 'Men', 'Women', 'New'],
    featured: 'Featured Products', seeAll: 'See All',
    addToCart: 'Add to Cart', viewDetails: 'View Details', inStock: 'In Stock',
    becomeMerchant: 'Become Merchant', companyNameAr: 'Company Name (AR)',
    email: 'Email', phone: 'Phone', password: 'Password',
    register: 'Register', cartTotal: 'Total', checkout: 'Checkout', clearCart: 'Clear Cart',
  }
};

interface Props { onClose?: () => void; currentLang: 'ar' | 'en'; retailerId?: string; }

export const Storefront: React.FC<Props> = ({ onClose, currentLang, retailerId }) => {
  const lang = t[currentLang];
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('all');
  const [cart, setCart] = useState<Map<string, { p: any; q: number }>>(new Map());
  const [showReg, setShowReg] = useState(false);
  const [form, setForm] = useState({ nameAr: '', email: '', phone: '', pass: '' });
  const [slide, setSlide] = useState(0);

  const products = getApprovedActiveProducts();
  const filtered = products.filter(p => {
    if (cat !== 'all' && (p as any).category !== cat) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(p.nameAr || '').toLowerCase().includes(q) && !(p.nameEn || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const featured = filtered.filter((p: any) => p.isFeatured || (p.rating && p.rating >= 4)).slice(0, 6);
  const newItems = [...filtered].sort((a, b) => {
    const da = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : 0;
    const db = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : 0;
    return db - da;
  }).slice(0, 6);

  const totalItems = Array.from(cart.values()).reduce((s, i) => s + i.q, 0);
  const totalPrice = Array.from(cart.values()).reduce((s, i) => s + (i.p as any).retailPrice * i.q, 0);

  useEffect(() => {
    const iv = setInterval(() => setSlide(s => (s + 1) % Math.max(1, featured.length)), 5000);
    return () => clearInterval(iv);
  }, [featured.length]);

  const addToCart = (product: any) => {
    setCart(prev => {
      const ex = prev.get(product.id);
      if (ex) return new Map(prev).set(product.id, { ...ex, q: ex.q + 1 });
      return new Map(prev).set(product.id, { p: product, q: 1 });
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => {
      const ex = prev.get(id);
      if (!ex) return prev;
      if (ex.q > 1) return new Map(prev).set(id, { ...ex, q: ex.q - 1 });
      const n = new Map(prev); n.delete(id); return n;
    });
  };

  const register = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nameAr || !form.email || !form.pass) {
      alert(currentLang === 'ar' ? 'يرجى تعبئة الحقول' : 'Please fill fields');
      return;
    }
    saveMerchant({
      id: Math.random().toString(36).substr(2, 9),
      companyNameAr: form.nameAr, companyNameEn: form.nameAr,
      registrationNumber: '', taxId: '', email: form.email, phone: form.phone,
      whatsapp: form.phone, channels: { email: true, whatsapp: true, phone: true, other: false },
      approved: false, isActive: true, marginPercent: 25,
      bankingInfo: undefined, totalProducts: 0, totalOrders: 0,
      totalRevenue: 0, totalPlatformRevenue: 0, notes: '',
      status: 'pending', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    setShowReg(false);
    setForm({ nameAr: '', email: '', phone: '', pass: '' });
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-stone-900 text-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="lg:hidden p-2"><Menu className="w-5 h-5" /></button>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold">{lang.title}</span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-4 flex-1 max-w-2xl">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder={lang.search}
                className="w-full pl-10 pr-4 py-2 bg-stone-800 border border-stone-700 rounded-lg text-sm text-white placeholder-stone-400 focus:outline-none focus:border-amber-500" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-2">
              <ShoppingCart className="w-5 h-5" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </button>
            <button onClick={() => setShowReg(true)} className="hidden sm:flex items-center gap-2 px-3 py-2 bg-amber-600 hover:bg-amber-700 rounded-lg text-sm">
              <UserPlus className="w-4 h-4" />
              {lang.becomeMerchant}
            </button>
          </div>
        </div>
      </header>

      <section className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {lang.categories.map(c => (
              <button key={c} onClick={() => setCat(c === 'جديد' || c === 'New' ? 'newArrivals' : c.toLowerCase())}
                className={`px-4 py-2 rounded-full text-sm whitespace-nowrap ${cat === (c === 'جديد' || c === 'New' ? 'newArrivals' : c.toLowerCase()) ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}>
                {c}
              </button>
            ))}
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {featured.length > 0 && (
          <div className="mb-8">
            <div className="flex justify-between mb-4">
              <h2 className="text-2xl font-bold">{lang.featured}</h2>
              <button className="text-amber-600 text-sm flex items-center gap-1">{lang.seeAll} <ArrowRight className="w-4 h-4" /></button>
            </div>
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-amber-50 to-orange-50">
              <div className="flex transition-transform duration-500" style={{ transform: `translateX(-${slide * 100}%)` }}>
                {featured.map(product => (
                  <div key={product.id} className="min-w-full flex items-center justify-center p-4">
                    <div className="max-w-4xl w-full">
                      <div className="grid md:grid-cols-2 gap-6 items-center">
                        <div className="relative aspect-square bg-gradient-to-br from-amber-100 to-stone-100 rounded-xl flex items-center justify-center">
                          <Package className="w-24 h-24 text-amber-400/30" />
                          {(product as any).isNew && (
                            <span className="absolute top-3 left-3 px-2 py-1 bg-emerald-500 text-white text-xs rounded-full">
                              <Sparkles className="w-3 h-3 inline mr-1" /> جديد
                            </span>
                          )}
                        </div>
                        <div className="space-y-3">
                          <h3 className="text-2xl font-bold">{(product as any).nameAr || (product as any).nameEn}</h3>
                          <p className="text-stone-500">{(product as any).category}</p>
                          <div className="flex items-center gap-2 text-amber-400">
                            {(product as any).rating && [1,2,3].map(i => (
                              <Star key={i} className="w-5 h-5 fill-current" />
                            ))}
                          </div>
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => addToCart(product)} className="flex-1 px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-sm">
                              {lang.addToCart}
                            </button>
                            <button className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-sm">{lang.viewDetails}</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {newItems.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">{currentLang === 'ar' ? 'الوصول حديثاً' : 'New Arrivals'}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {newItems.map(product => (
                <div key={product.id} className="bg-white rounded-xl border p-4">
                  <div className="aspect-square bg-gradient-to-br from-amber-100 to-stone-100 rounded-lg flex items-center justify-center mb-3">
                    <Package className="w-12 h-12 text-amber-400/30" />
                  </div>
                  <h3 className="font-bold text-sm line-clamp-2">{(product as any).nameAr || (product as any).nameEn}</h3>
                  <p className="text-xs text-stone-500">{(product as any).category}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-lg font-bold text-amber-900">{(product as any).retailPrice} <span className="text-xs">جنيه</span></span>
                    <button onClick={() => addToCart(product)} className="px-3 py-1 bg-amber-700 hover:bg-amber-800 text-white text-xs rounded">
                      {lang.addToCart}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {cart.size > 0 && (
          <div className="fixed bottom-0 right-0 m-4 bg-white rounded-xl shadow-lg p-4 w-80">
            <h3 className="font-bold mb-2">{lang.cartTotal}: {totalPrice} جنيه</h3>
            <div className="max-h-40 overflow-y-auto mb-2">
              {Array.from(cart.entries()).map(([id, item]) => (
                <div key={id} className="flex items-center justify-between py-1 border-b text-sm">
                  <span>{(item.p as any).nameAr || (item.p as any).nameEn}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-stone-600">{item.q}</span>
                    <button onClick={() => removeFromCart(id)} className="text-red-500"><span className="text-lg">×</span></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCart(new Map())} className="flex-1 px-3 py-2 bg-stone-100 rounded text-sm">{lang.clearCart}</button>
              <button className="flex-1 px-3 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded text-sm">{lang.checkout}</button>
            </div>
          </div>
        )}
      </main>

      {showReg && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">{currentLang === 'ar' ? 'تسجيل تاجر' : 'Merchant Registration'}</h2>
            <form onSubmit={register} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">{lang.companyNameAr} *</label>
                <input type="text" value={form.nameAr} onChange={e => setForm({ ...form, nameAr: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{lang.email} *</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{lang.phone}</label>
                <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{lang.password} *</label>
                <input type="password" value={form.pass} onChange={e => setForm({ ...form, pass: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg" required />
              </div>
              <button type="submit" className="w-full px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg">
                {lang.register}
              </button>
            </form>
            <button onClick={() => setShowReg(false)} className="mt-3 text-sm text-stone-600">
              {currentLang === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
