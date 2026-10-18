import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, ShoppingBag, Sparkles } from 'lucide-react';
import { makeBannerT } from '../لغات/bannerL10n';
import { storeFamilyLabel, storeGenderLabel, storeLocalized, storeNumber, storeText } from '../لغات/storeL10n';
import { isRTL } from '../لغات/localizedContent';
import type { SupportedLanguage } from '../types/i18n';
import campaignLifestyle from '../assets/images/store_campaign_lifestyle.jpg';
import productsData from '../data/products.json';
import { storeImageSrc } from '../utils/liveStore';


interface TopPromoHubProps {
  currentLang?: SupportedLanguage;
  onViewStore?: () => void;
}

function PerfumeBottleToggle({ expanded, label, onClick }: { expanded: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={expanded}
      title={label}
      className="group flex h-12 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-200/25 bg-stone-950/90 text-amber-200 shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-amber-200/60 hover:bg-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
    >
      <svg viewBox="0 0 48 64" className="h-10 w-8 transition-transform duration-300 group-hover:scale-105" aria-hidden="true">
        <defs>
          <linearGradient id="sham-bottle-gold" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#fff0c8" />
            <stop offset="0.48" stopColor="#d4a85f" />
            <stop offset="1" stopColor="#8c6030" />
          </linearGradient>
        </defs>
        <path d="M18 4h12v7h4v8l5 6v25a7 7 0 0 1-7 7H16a7 7 0 0 1-7-7V25l5-6v-8h4z" fill="url(#sham-bottle-gold)" stroke="#fff0c8" strokeOpacity=".72" strokeWidth="1.5" />
        <path d="M17 11h14M14 23h20" stroke="#fff6df" strokeOpacity=".52" strokeWidth="1.5" strokeLinecap="round" />
        {expanded
          ? <path d="m17 38 7 7 7-7" fill="none" stroke="#291b10" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          : <path d="m17 43 7-7 7 7" fill="none" stroke="#291b10" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
    </button>
  );
}

export const TopPromoHub: React.FC<TopPromoHubProps> = ({ currentLang = 'ar', onViewStore }) => {
  const rtl = isRTL(currentLang);
  const L = makeBannerT(currentLang);
  const [expanded, setExpanded] = useState(true);
  const [slideIndex, setSlideIndex] = useState(0);
  const [failedProductImage, setFailedProductImage] = useState<number | string | null>(null);

  // Use real product photos where available; avoid the generic placeholder images in the seed catalog.
  const topDeals = productsData.products
    .filter((product) => product.ourPrice > 0 && product.stockStatus !== 'out_of_stock' && typeof product.imageUrl === 'string' && !product.imageUrl.includes('unsplash.com'))
    .sort((a, b) => (b.ourPrice || 0) - (a.ourPrice || 0))
    .slice(0, 5);
  const activeProduct = topDeals[slideIndex] || topDeals[0];
  const productName = storeLocalized(
    activeProduct ? { ar: activeProduct.nameAr, en: activeProduct.nameEn } : undefined,
    currentLang,
  ) || L('no_image');
  const brand = activeProduct?.brand && activeProduct.brand !== 'Unknown' ? activeProduct.brand : L('curated');
  const formattedPrice = activeProduct?.ourPrice
    ? `${storeNumber(Number(activeProduct.ourPrice), currentLang)} ${storeText(currentLang, 'sf_currency')}`
    : '—';
  const rawCategory = activeProduct?.category || '';
  const productCategory = /رجالي/.test(rawCategory)
    ? storeGenderLabel('men', currentLang)
    : /نسائي/.test(rawCategory)
      ? storeGenderLabel('women', currentLang)
      : /مختلط/.test(rawCategory)
        ? storeGenderLabel('unisex', currentLang)
        : /عود/.test(rawCategory)
          ? storeFamilyLabel('oud', currentLang)
          : /مجموعات/.test(rawCategory)
            ? L('cat_sets')
            : /عطور/.test(rawCategory)
              ? L('cat_perfumes')
              : '';
  const PreviousIcon = rtl ? ChevronRight : ChevronLeft;
  const NextIcon = rtl ? ChevronLeft : ChevronRight;
  const StoreArrow = rtl ? ArrowLeft : ArrowRight;

  useEffect(() => {
    if (!expanded || topDeals.length < 2) return;
    const interval = window.setInterval(() => {
      setSlideIndex((current) => (current + 1) % topDeals.length);
    }, 6500);
    return () => window.clearInterval(interval);
  }, [expanded, topDeals.length]);

  const moveSlide = (step: number) => {
    if (!topDeals.length) return;
    setSlideIndex((current) => (current + step + topDeals.length) % topDeals.length);
  };

  return (
    <section
      dir={rtl ? 'rtl' : 'ltr'}
      className={`relative ${expanded ? 'bg-[#0d0907]' : 'bg-[#120d0a]'}`}
      aria-label={L('promo_title')}
    >
      {expanded ? (
        <div className="relative overflow-hidden animate-in fade-in duration-300">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-36 start-[22%] h-80 w-80 rounded-full bg-amber-500/10 blur-[100px]" />
            <div className="absolute -bottom-44 end-[8%] h-96 w-96 rounded-full bg-orange-900/20 blur-[120px]" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/30 to-transparent" />
          </div>

          <div className="relative mx-auto max-w-7xl px-3 py-3 sm:px-6 sm:py-5">
            <div className="grid overflow-hidden rounded-[26px] border border-amber-100/15 bg-[#15110f] shadow-[0_26px_80px_rgba(0,0,0,0.38)] lg:grid-cols-[0.88fr_1.12fr] lg:rounded-[32px]">
              {/* Editorial lifestyle photograph */}
              <div className="relative min-h-[205px] overflow-hidden sm:min-h-[250px] lg:min-h-[375px]">
                <img
                  src={campaignLifestyle}
                  alt={L('campaign_alt')}
                  className="absolute inset-0 h-full w-full object-cover object-[31%_center] transition-transform duration-700 hover:scale-[1.025]"
                  loading="eager"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/20" />
                <div className="absolute inset-0 bg-gradient-to-l from-black/10 via-transparent to-black/25" />
                <div className="absolute start-4 top-4 sm:start-6 sm:top-6">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/30 px-3 py-1.5 text-[9px] font-semibold tracking-[0.16em] text-amber-100 backdrop-blur-md sm:text-[10px]">
                    <Sparkles className="h-3 w-3 text-amber-300" />{L('campaign_kicker')}
                  </span>
                </div>
                <div className="absolute bottom-4 start-4 max-w-[85%] sm:bottom-6 sm:start-6 sm:max-w-[78%]">
                  <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.24em] text-amber-200/90 sm:text-[10px]">{L('promo_title')}</p>
                  <h2 className="font-serif text-xl font-semibold leading-tight text-white sm:text-3xl lg:text-[2.1rem]">{L('campaign_headline')}</h2>
                  <p className="mt-2 max-w-[34ch] text-[11px] leading-relaxed text-white/75 sm:text-sm">{L('campaign_sub')}</p>
                </div>
                <div className="absolute bottom-4 end-4 hidden items-center gap-2 text-[9px] font-medium uppercase tracking-[0.2em] text-white/55 sm:flex">
                  <span className="h-px w-7 bg-amber-200/60" />SHAM · PERFUME
                </div>
              </div>

              {/* Large interactive fragrance showcase */}
              <div className="relative flex min-w-0 flex-col gap-3.5 overflow-hidden bg-gradient-to-br from-[#211911] via-[#18120e] to-[#100d0b] p-3.5 sm:gap-4 sm:p-5 lg:p-7">
                <div className="pointer-events-none absolute -end-16 -top-20 h-64 w-64 rounded-full bg-amber-400/10 blur-[85px]" />
                <div className="relative flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-amber-200/25 bg-amber-200/10 text-amber-200"><Sparkles className="h-4 w-4" /></span>
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold uppercase tracking-[0.23em] text-amber-200/90 sm:text-[10px]">SHAM · SCENT STUDIO</p>
                      <p className="mt-0.5 truncate text-[9px] text-white/45 sm:text-[10px]">{L('featured_note')}</p>
                    </div>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-[9px] font-semibold text-stone-200 sm:text-[10px]">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(252,211,134,0.8)]" />{L('featured_label')}
                  </span>
                </div>

                <div className="relative grid flex-1 grid-cols-[1fr_0.95fr] items-center gap-3 sm:grid-cols-[0.94fr_1.06fr] sm:gap-5">
                  <div className="relative mx-auto w-full max-w-[250px]">
                    <div className="absolute -inset-2 rounded-[26px] bg-amber-300/15 blur-xl" />
                    <div className="relative flex aspect-[0.94] items-center justify-center overflow-hidden rounded-[22px] border border-white/65 bg-[radial-gradient(ellipse_at_50%_38%,#fffdf7_0%,#f1e7d5_58%,#c9b394_100%)] shadow-xl shadow-black/25 sm:rounded-[26px]">
                      {activeProduct?.imageUrl && failedProductImage !== activeProduct.id ? (
                        <img
                          key={activeProduct.id}
                          src={storeImageSrc(activeProduct.imageUrl)}
                          alt={productName}
                          className="h-full w-full object-contain p-2.5 drop-shadow-[0_18px_18px_rgba(40,24,10,0.22)] sm:p-3"
                          loading="lazy"
                          onError={() => setFailedProductImage(activeProduct.id)}
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-amber-900/70">
                          <Sparkles className="h-9 w-9" />
                          <span className="text-[10px] font-bold">{L('no_image')}</span>
                        </div>
                      )}
                      <span className="absolute bottom-2.5 start-2.5 max-w-[calc(100%-1.25rem)] truncate rounded-full border border-white/25 bg-stone-950/70 px-2.5 py-1 text-[9px] font-semibold text-white shadow backdrop-blur sm:bottom-3 sm:start-3 sm:text-[10px]">{brand}</span>
                    </div>
                  </div>

                  <div key={activeProduct?.id ?? 'empty'} className="min-w-0 animate-in fade-in slide-in-from-right-2 duration-300">
                    <p className="text-[9px] font-bold uppercase tracking-[0.19em] text-amber-200/80 sm:text-[10px]">{L('featured_label')}</p>
                    <h3 className="mt-1.5 line-clamp-3 font-serif text-base font-semibold leading-snug text-white sm:mt-2 sm:text-xl lg:text-[1.65rem]">{productName}</h3>
                    <p className="mt-1 truncate text-[10px] font-medium text-stone-300/70 sm:text-xs">{brand}{productCategory ? ` · ${productCategory}` : ''}</p>
                    <div className="my-2.5 h-px w-full bg-gradient-to-r from-amber-200/40 via-white/10 to-transparent sm:my-3.5" />
                    <p className="max-w-[30ch] text-[10px] leading-relaxed text-stone-300/75 sm:text-xs">{L('product_copy')}</p>
                    <div className="mt-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 sm:mt-4">
                      <span className="text-lg font-semibold tracking-tight text-amber-100 sm:text-2xl">{formattedPrice}</span>
                      <span className="text-[9px] font-medium uppercase tracking-[0.15em] text-stone-400">{L('price_label')}</span>
                    </div>
                  </div>
                </div>

                <div className="relative flex items-center justify-between gap-2 border-t border-white/10 pt-3 sm:pt-4">
                  <div className="flex min-w-0 items-center gap-1">
                    <button type="button" onClick={() => moveSlide(-1)} aria-label={L('previous')} title={L('previous')} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-stone-200 transition hover:border-amber-200/40 hover:bg-amber-200/10">
                      <PreviousIcon className="h-4 w-4" />
                    </button>
                    <div className="flex items-center gap-1.5 px-1" aria-label={L('featured_note')}>
                      {topDeals.map((product, index) => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => setSlideIndex(index)}
                          aria-label={`${L('show_product')} ${index + 1}`}
                          aria-current={index === slideIndex ? 'true' : undefined}
                          className={`h-1.5 rounded-full transition-all duration-300 ${index === slideIndex ? 'w-5 bg-amber-300' : 'w-1.5 bg-white/30 hover:bg-white/60'}`}
                        />
                      ))}
                    </div>
                    <button type="button" onClick={() => moveSlide(1)} aria-label={L('next')} title={L('next')} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-stone-200 transition hover:border-amber-200/40 hover:bg-amber-200/10">
                      <NextIcon className="h-4 w-4" />
                    </button>
                  </div>
                  <button type="button" onClick={onViewStore} className="group inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 px-3 text-[10px] font-extrabold text-stone-950 shadow-lg shadow-amber-950/25 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 sm:gap-2 sm:px-4 sm:text-xs">
                    <span>{L('view_store')}</span>
                    <StoreArrow className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="relative mx-auto flex max-w-7xl items-center justify-end gap-2 px-4 pb-2 sm:px-6">
            <span className="hidden text-[10px] font-medium text-stone-500 sm:inline">{L('collapse')}</span>
            <PerfumeBottleToggle expanded={expanded} label={L('collapse')} onClick={() => setExpanded(false)} />
          </div>
        </div>
      ) : (
        <div className="relative overflow-hidden border-y border-amber-200/20 bg-gradient-to-r from-[#110d0b] via-[#20160e] to-[#110d0b] text-white shadow-lg shadow-black/15 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="pointer-events-none absolute inset-y-0 end-0 w-48 bg-gradient-to-l from-amber-300/10 to-transparent" />
          <div className="relative mx-auto flex min-h-[62px] max-w-7xl items-center gap-2.5 px-3 py-2 sm:gap-4 sm:px-6">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-amber-100/30 bg-gradient-to-br from-amber-100 to-[#c8a16a] shadow-md shadow-black/20">
              {activeProduct?.imageUrl && failedProductImage !== activeProduct.id
                ? <img key={`compact-${activeProduct.id}`} src={storeImageSrc(activeProduct.imageUrl)} alt={productName} className="h-full w-full object-contain p-0.5" loading="lazy" onError={() => setFailedProductImage(activeProduct.id)} />
                : <Sparkles className="h-5 w-5 text-amber-950" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-amber-200/80 sm:text-[9px]">{L('compact_eyebrow')}</p>
              <div className="mt-0.5 flex min-w-0 items-center gap-2">
                <p className="truncate text-xs font-semibold text-white sm:text-sm">{productName}</p>
                <span className="hidden shrink-0 text-[10px] text-stone-400 sm:inline">{brand}</span>
              </div>
            </div>
            <span className="hidden shrink-0 text-xs font-bold text-amber-100 sm:inline">{formattedPrice}</span>
            <button type="button" onClick={onViewStore} aria-label={L('compact_cta')} className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-amber-400 px-2.5 text-[10px] font-extrabold text-stone-950 transition hover:bg-amber-300 sm:px-3.5 sm:text-xs">
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">{L('compact_cta')}</span>
            </button>
            <PerfumeBottleToggle expanded={expanded} label={L('expand')} onClick={() => setExpanded(true)} />
          </div>
        </div>
      )}
    </section>
  );
};
