import React, { useState, useEffect } from 'react';
import { ChevronDown, Sparkles, ShoppingCart, ArrowRight, Star, Tag, Zap } from 'lucide-react';
import { makeT } from '../utils/localize';
import { isRTL } from '../utils/localizedContent';
import productsData from '../data/products.json';

const S = {
  promo_title: { ar: 'متجر الشام', en: 'Sham Perfume Store' },
  promo_sub: { 
    ar: '16+ عطر فاخر بأسعار مميزة - تسليم سريع - شحن مجاني لطلبات فوق 500 جنيه',
    en: '16+ Luxury Perfumes at Special Prices - Fast Delivery - Free Shipping on orders over 500 EGP'
  },
  promo_deals: { 
    ar: 'خصومات حصرية', 
    en: 'Exclusive Deals' 
  },
  promo_banner: {
    ar: '🔥 عرض محدود: خصم 20% على جميع العطور الرجالية!',
    en: '🔥 Limited Offer: 20% off all men fragrances!'
  },
  view_store: { ar: 'تصفح المتجر', en: 'Browse Store' },
  top_banner: {
    ar: '🛍️ منتجات جدید من شاما برفume | 特價中 | Nouveautés',
    en: '🛍️ New from Shama Perfumes | 特價中 | New Arrivals'
  },
  trust_badges: {
    ar: 'شحن مجاني فوق 500 جنيه | توصيل خلال 3-5 أيام | ضمان استرجاع 30 يوم | دفع آمن 100%',
    en: 'Free Shipping over 500 EGP | Delivery in 3-5 days | 30-day return guarantee | 100% Secure Payment'
  }
};

interface TopPromoHubProps {
  currentLang?: 'ar' | 'en';
  onViewStore?: () => void;
}

export const TopPromoHub: React.FC<TopPromoHubProps> = ({ currentLang = 'ar', onViewStore }) => {
  const rtl = isRTL(currentLang);
  const L = makeT(currentLang, S);
  const [expanded, setExpanded] = useState(true);
  const [slideIndex, setSlideIndex] = useState(0);

  // Get top deals from products
  const topDeals = productsData.products
    ? productsData.products
        .filter((p: any) => p.ourPrice > 0)
        .sort((a: any, b: any) => (b.ourPrice || 0) - (a.ourPrice || 0))
        .slice(0, 4)
    : [];

  // Auto-rotate banner
  useEffect(() => {
    if (!expanded) return;
    const interval = setInterval(() => {
      setSlideIndex(prev => (prev + 1) % Math.max(1, topDeals.length));
    }, 4000);
    return () => clearInterval(interval);
  }, [expanded, topDeals.length]);

  // Product images for banner
  const bannerImages = topDeals.map(p => p.imageUrl || 'https://images.unsplash.com/photo-1594032445763-59aef710e0ba?w=400&h=200&fit=crop');

  return (
    <section className="relative bg-gradient-to-r from-amber-600 via-amber-500 to-orange-600 text-white overflow-hidden" aria-label={L('promo_title')}>
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',
        backgroundSize: '40px 40px'
      }} />
      
      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="absolute w-2 h-2 bg-white/30 rounded-full animate-pulse"
            style={{
              left: `${10 + i * 15}%`,
              top: `${20 + Math.sin(i) * 10}%`,
              animationDelay: `${i * 0.5}s`,
            }}
          />
        ))}
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-8 py-4">
        {/* Top toolbar for promotions */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-black/20 rounded-xl p-3 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-amber-200" />
            <span className="text-xs font-medium bg-white/20 px-2 py-1 rounded-full">{L('promo_deals')}</span>
            <span className="text-xs bg-red-500/30 px-2 py-1 rounded-full">{currentLang === 'ar' ? 'عرض محدود' : 'Limited Time'}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-sm">
              <Sparkles className="w-4 h-4 text-amber-200" />
              <span className="font-medium">{currentLang === 'ar' ? 'خصم 20%' : '20% OFF'}</span>
            </div>
            <div className="flex items-center gap-1 text-sm">
              <Zap className="w-4 h-4 text-yellow-200" />
              <span>{currentLang === 'ar' ? 'شحن مجاني' : 'Free Shipping'}</span>
            </div>
            <button className="flex items-center gap-1 text-sm bg-white/20 hover:bg-white/30 px-2 py-1 rounded-full transition">
              <ShoppingCart className="w-4 h-4" />
              <span className="hidden sm:inline">{currentLang === 'ar' ? 'سلة المشتريات' : 'Cart'}</span>
            </button>
          </div>
        </div>

        {/* Main promo content with toggle */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Left side - Promo content */}
          <div className={`flex-1 ${rtl ? 'order-2 md:order-2' : 'order-1 md:order-1'}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <Sparkles className="w-6 h-6 text-amber-300" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                  <span>{L('promo_title')}</span>
                  <span className="text-sm bg-red-500 px-2 py-0.5 rounded-full font-normal">
                    {currentLang === 'ar' ? 'افتح الآن' : 'OPEN NOW'}
                  </span>
                </h2>
                <p className="text-sm text-amber-100/80 mt-1">{L('promo_sub')}</p>
              </div>
            </div>

            {/* Expandable promo details with toggle */}
            <div className={`overflow-hidden transition-all duration-300 ${expanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="mt-3 bg-black/20 rounded-xl p-4 backdrop-blur-sm">
                {/* Auto-rotating deals carousel */}
                <div className="relative min-h-[100px]">
                  {topDeals.length > 0 && (
                    <>
                      {topDeals.map((product, idx) => (
                        <div key={product.id}
                          className={`absolute inset-0 p-3 rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm transition-all duration-500 ${
                            slideIndex === idx ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {product.imageUrl && (
                              <img src={product.imageUrl} alt={product.nameAr || product.nameEn}
                                className="w-16 h-16 rounded-lg object-cover border border-white/30 shadow-lg"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <h4 className="font-bold text-sm truncate">{product.nameAr || product.nameEn}</h4>
                                <span className="text-lg font-bold">{product.ourPrice} <span className="text-xs">جنيه</span></span>
                              </div>
                              <div className="text-xs text-amber-100/80">
                                {product.brand} · {product.category}
                              </div>
                              <div className="mt-2 flex gap-2">
                                <button className="flex-1 px-3 py-1.5 bg-white text-amber-900 text-xs rounded-lg font-medium hover:bg-amber-50 transition">
                                  {L('view_store')}
                                </button>
                                <button className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs rounded-lg transition flex items-center gap-1">
                                  <ShoppingCart className="w-3 h-3" />
                                  اضف
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {/* Slide indicators */}
                      <div className="flex justify-center gap-2 mt-3">
                        {[...Array(topDeals.length)].map((_, idx) => (
                          <button key={idx} onClick={() => setSlideIndex(idx)}
                            className={`w-2 h-2 rounded-full transition-all ${
                              slideIndex === idx ? 'bg-white w-4' : 'bg-white/50 hover:bg-white/70'
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Trust badges */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {L('trust_badges').split(' | ').map((badge: string, i: number) => (
                    <div key={i} className="flex items-center gap-1 text-xs bg-white/20 px-2 py-1 rounded-full">
                      {i === 0 && <Star className="w-3 h-3 text-amber-300" />}
                      {i === 1 && <Zap className="w-3 h-3 text-yellow-200" />}
                      {i === 2 && <ShoppingCart className="w-3 h-3 text-green-300" />}
                      {badge}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Toggle + Quick stats */}
          <div className="flex flex-col items-end gap-2">
            <div className="bg-black/30 rounded-xl p-3 backdrop-blur-sm text-center">
              <div className="text-3xl font-bold">{productsData.products?.length || 0}</div>
              <div className="text-xs text-amber-100/80">
                {currentLang === 'ar' ? 'منتج في المتجر' : 'Products in Store'}
              </div>
            </div>
            <div className="bg-black/30 rounded-xl p-3 backdrop-blur-sm text-center">
              <div className="text-3xl font-bold">
                {productsData.products?.filter(p => p.ourPrice > 0).reduce((sum: any, p: any) => sum + (p.ourPrice || 0), 0) || 0}
              </div>
              <div className="text-xs text-amber-100/80">
                {currentLang === 'ar' ? 'إجمالي الأسعار' : 'Total Value'}
              </div>
            </div>

            {/* Toggle button (arrow) */}
            <button 
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl transition text-sm font-medium"
            >
              <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
              <span>{expanded ? (currentLang === 'ar' ? 'طي التفاصيل' : 'Hide Details') : (currentLang === 'ar' ? '顯示詳細信息' : 'Show Details')}</span>
            </button>
          </div>
        </div>

        {/* View Store CTA */}
        <div className="mt-4 text-center">
          <button 
            onClick={onViewStore}
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-amber-900 rounded-xl font-bold text-sm hover:bg-amber-50 transition shadow-lg"
          >
            <ArrowRight className="w-4 h-4" />
            {currentLang === 'ar' ? 'تصفح متجر الشام الآن' : 'Browse Sham Perfume Store Now'}
          </button>
        </div>
      </div>
    </section>
  );
};
