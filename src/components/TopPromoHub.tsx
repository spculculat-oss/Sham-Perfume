import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Flame,
  Globe,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  Search,
  ShoppingBag,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { makeBannerT } from '../لغات/bannerL10n';
import type { BannerTextKey } from '../لغات/bannerKeys';
import { storeGenderLabel, storeLocalized, storeText } from '../لغات/storeL10n';
import { isRTL } from '../لغات/localizedContent';
import type { SupportedLanguage } from '../types/i18n';
import { loadStoreCatalog, storeImageSrc } from '../utils/liveStore';
import type { StoreProduct } from '../utils/storeCatalog';
import { filterShowcase, isStockPhoto, rankShowcase, thumbWindow, type ShowcaseCategory } from '../utils/promoShowcase';
import { ProductPayMethods } from '../bank/ProductPayMethods';
import { addToCart } from '../utils/storeCart';
import { useStoreCountry, setStoreCountry, useStoreMoney } from '../utils/storeCheckout';
import {
  getCountryMeta,
  TOP_COUNTRIES,
  POPULAR_COUNTRY_CODES,
} from '../utils/countryCurrencyMeta';

import commercialMan from '../assets/images/perfume_art_spray_man_1792313195183.jpg';
import commercialWoman from '../assets/images/perfume_art_spray_woman_1792313196930.jpg';
import commercialMist from '../assets/images/perfume_mist_cinematic_1792313197406.jpg';

interface TopPromoHubProps {
  currentLang?: SupportedLanguage;
  onViewStore?: () => void;
  onSelectProduct?: (productId: number | string) => void;
}

interface CommercialScene {
  id: string;
  image: string;
  /** The scene copy lives in the 100-language banner pack (bannerL10nData1–5). */
  keys: {
    tag: BannerTextKey;
    title: BannerTextKey;
    subtitle: BannerTextKey;
    mood: BannerTextKey;
  };
}

const SCENES: CommercialScene[] = [
  {
    id: 'scene-man',
    image: commercialMan,
    keys: { tag: 'scene_man_tag', title: 'scene_man_title', subtitle: 'scene_man_subtitle', mood: 'scene_man_mood' },
  },
  {
    id: 'scene-woman',
    image: commercialWoman,
    keys: { tag: 'scene_woman_tag', title: 'scene_woman_title', subtitle: 'scene_woman_subtitle', mood: 'scene_woman_mood' },
  },
  {
    id: 'scene-mist',
    image: commercialMist,
    keys: { tag: 'scene_mist_tag', title: 'scene_mist_title', subtitle: 'scene_mist_subtitle', mood: 'scene_mist_mood' },
  },
];

/** Deterministic particle field for the reel's drifting golden mist (stable across renders/SSR). */
const REEL_PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  x: (i * 37 + 11) % 100,
  size: 2 + ((i * 7) % 4),
  dur: 9 + ((i * 5) % 8),
  delay: -((i * 13) % 17),
  alpha: 0.35 + ((i * 3) % 5) / 10,
}));

/** #410: the currency chip in the visitor's language («ج.م» in Arabic), the ISO code only as a fallback. */
function currencyLabel(code: string, lang: SupportedLanguage): string {
  if (!isRTL(lang)) return code; // «EGP» / «USD» read naturally in Latin scripts; «$» alone would be ambiguous
  try {
    const part = new Intl.NumberFormat(lang, { style: 'currency', currency: code, currencyDisplay: 'symbol' }).formatToParts(0).find((p) => p.type === 'currency');
    return (part?.value || code).replace(/[\u200f\u200e\u061c]/g, '').replace(/\.$/, '');
  } catch { return code; }
}

export const TopPromoHub: React.FC<TopPromoHubProps> = ({
  currentLang = 'ar',
  onViewStore,
  onSelectProduct,
}) => {
  const rtl = isRTL(currentLang);
  const L = makeBannerT(currentLang);

  const [expanded, setExpanded] = useState(true);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [productSlideIndex, setProductSlideIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [catalog, setCatalog] = useState<StoreProduct[] | null>(null);
  const [catalogFailed, setCatalogFailed] = useState(false);
  // Why the product carousel is holding still: the visitor is looking at / touching / typing in it,
  // or the banner is off screen / the tab is hidden (no work nobody sees).
  const [productHover, setProductHover] = useState(false);
  const [productFocus, setProductFocus] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const [slideDir, setSlideDir] = useState<1 | -1>(1);
  const sectionRef = useRef<HTMLElement | null>(null);
  const swipeRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const swipedRef = useRef(false);
  const [addedSku, setAddedSku] = useState<string | null>(null);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ShowcaseCategory>('all');

  // Auto-detected visitor country from device & edge
  const [currentCountry, setCurrentCountry] = useStoreCountry();
  const countryMeta = useMemo(() => getCountryMeta(currentCountry, currentLang), [currentCountry, currentLang]);

  // The same cleaned catalog the store shows (names, photos, gender, stock) — loaded as its own chunk, so the
  // 3 MB product list is not part of every page's first download.
  useEffect(() => {
    let alive = true;
    loadStoreCatalog()
      .then((list) => { if (alive) setCatalog(list); })
      .catch(() => { if (alive) setCatalogFailed(true); });
    return () => { alive = false; };
  }, []);

  const allStoreProducts = useMemo(() => rankShowcase((catalog || []).filter((p) => p.price > 0)), [catalog]);
  const showcaseProducts = useMemo(
    () => filterShowcase(allStoreProducts, selectedCategory, productSearch),
    [allStoreProducts, selectedCategory, productSearch],
  );
  const safeIndex = showcaseProducts.length ? Math.min(productSlideIndex, showcaseProducts.length - 1) : 0;
  const activeProduct: StoreProduct | undefined = showcaseProducts[safeIndex];
  const money = useStoreMoney(currentLang, currentLang === 'ar' ? 'ج.م' : 'EGP');

  /** First photo of the product that has not failed to load (falls back to its other photos). */
  const photoOf = (p: StoreProduct): string | undefined => (p.images.length ? p.images : p.imageUrl ? [p.imageUrl] : []).find((u) => !failedImages[u]);
  const markFailed = (url: string) => setFailedImages((prev) => (prev[url] ? prev : { ...prev, [url]: true }));

  // Active scene
  const activeScene = SCENES[sceneIndex] || SCENES[0];

  // Reset slide index when search or category filter changes
  useEffect(() => {
    setProductSlideIndex(0);
  }, [selectedCategory, productSearch]);

  // Autoplay timer for the commercial scenes
  useEffect(() => {
    if (!expanded || !isPlaying) return;
    const interval = window.setInterval(() => {
      setSceneIndex((prev) => (prev + 1) % SCENES.length);
    }, 7000);
    return () => window.clearInterval(interval);
  }, [expanded, isPlaying]);

  // Off screen or hidden tab: hold the carousel still.
  useEffect(() => {
    const el = sectionRef.current;
    const onVis = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    let io: IntersectionObserver | undefined;
    if (el && typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0.15 });
      io.observe(el);
    }
    return () => { document.removeEventListener('visibilitychange', onVis); io?.disconnect(); };
  }, [expanded]);

  const productPaused = !isPlaying || productHover || productFocus || Boolean(productSearch.trim()) || !onScreen || !pageVisible;
  const PRODUCT_DWELL_MS = 6500;

  // Product auto-advance: one timer per slide, so choosing a product (arrows, thumbnails, swipe) always
  // gives the visitor a full dwell time on it instead of jumping away a second later.
  useEffect(() => {
    if (!expanded || productPaused || showcaseProducts.length < 2) return;
    const timer = window.setTimeout(() => {
      setSlideDir(1);
      setProductSlideIndex((prev) => (prev + 1) % showcaseProducts.length);
    }, PRODUCT_DWELL_MS);
    return () => window.clearTimeout(timer);
  }, [expanded, productPaused, showcaseProducts.length, safeIndex]);

  const handleNextScene = () => {
    setSceneIndex((prev) => (prev + 1) % SCENES.length);
  };

  const handlePrevScene = () => {
    setSceneIndex((prev) => (prev - 1 + SCENES.length) % SCENES.length);
  };

  const goToProduct = (index: number, dir: 1 | -1) => {
    const total = showcaseProducts.length;
    if (!total) return;
    setSlideDir(dir);
    setProductSlideIndex(((index % total) + total) % total);
  };
  const handleNextProduct = () => goToProduct(safeIndex + 1, 1);
  const handlePrevProduct = () => goToProduct(safeIndex - 1, -1);

  // Finger swipe on the product card (mobile): a clear horizontal flick changes the product; in RTL the
  // next product comes from the left, so the swipe direction follows the reading direction.
  const onSwipeStart = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    swipeRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    swipedRef.current = false;
  };
  const onSwipeEnd = (e: React.PointerEvent) => {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.4 || Date.now() - start.t > 800) return;
    swipedRef.current = true;
    const forward = rtl ? dx > 0 : dx < 0;
    if (forward) handleNextProduct(); else handlePrevProduct();
  };

  const handleAddToCart = (e: React.MouseEvent, p: StoreProduct | undefined) => {
    e.stopPropagation();
    if (!p) return;
    addToCart(p.sku, 1);
    setAddedSku(p.sku);
    setTimeout(() => setAddedSku(null), 2200);
  };

  // Opens the product's own page. (Previously it also switched to the store tab, which overwrote the
  // product link — the visitor landed on the store list instead of the product.)
  const handleProductClick = (productId: number | string) => {
    if (swipedRef.current) { swipedRef.current = false; return; }
    if (onSelectProduct) {
      onSelectProduct(productId);
      return;
    }
    window.location.hash = `#product=${productId}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Same price function as the store page (catalog EGP → the visitor's currency), so both always agree.
  const activePrice = activeProduct ? money.price(activeProduct.price) : '—';

  // Filtered countries for selector
  const filteredCountryCodes = useMemo(() => {
    if (!countrySearch.trim()) return POPULAR_COUNTRY_CODES;
    const q = countrySearch.toLowerCase().trim();
    return Object.keys(TOP_COUNTRIES).filter((code) => {
      const meta = TOP_COUNTRIES[code];
      return (
        code.toLowerCase().includes(q) ||
        meta.nameAr.toLowerCase().includes(q) ||
        meta.nameEn.toLowerCase().includes(q) ||
        meta.currency.toLowerCase().includes(q)
      );
    });
  }, [countrySearch]);

  const selectNewCountry = (code: string) => {
    setCurrentCountry(code);
    setStoreCountry(code, true);
    setShowCountryPicker(false);
  };

  const PreviousIcon = rtl ? ChevronRight : ChevronLeft;
  const NextIcon = rtl ? ChevronLeft : ChevronRight;
  const ArrowDir = rtl ? ArrowLeft : ArrowRight;

  return (
    <section
      ref={sectionRef}
      dir={rtl ? 'rtl' : 'ltr'}
      className="relative w-full bg-[#070504] border-b border-amber-500/20 text-white selection:bg-amber-500/30 font-sans"
      aria-label={L('screen_badge')}
    >
      {expanded ? (
        <div className="relative mx-auto max-w-7xl px-2 py-3 sm:px-6 sm:py-5 animate-in fade-in duration-500">
          {/* CINEMA DISPLAY SCREEN FRAME & BEZEL */}
          <div className="relative overflow-hidden rounded-[24px] sm:rounded-[32px] border-2 border-[#3d2c1c]/90 bg-[#0d0907] shadow-[0_24px_80px_rgba(0,0,0,0.85)] ring-1 ring-amber-400/25">
            {/* Ambient Screen Edge Glow */}
            <div className="pointer-events-none absolute -inset-1 rounded-[34px] bg-gradient-to-r from-amber-500/10 via-orange-600/10 to-amber-500/10 blur-xl opacity-75" />

            {/* SCREEN TOP BEZEL / CINEMA METRICS BAR */}
            <div className="relative z-20 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-gradient-to-r from-stone-950/95 via-[#18110c]/95 to-stone-950/95 px-3 py-2 text-[10px] sm:px-5 sm:py-2.5 sm:text-xs backdrop-blur-md">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <Sparkles className="h-3 w-3" />
                </span>
                <span className="text-xs font-bold tracking-wide text-amber-200">
                  {L('screen_title')}
                </span>
              </div>

              {/* Detected Device Country & Currency Badge */}
              <div className="relative flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCountryPicker((prev) => !prev)}
                  title={L('change_country')}
                  className="group flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-950/60 hover:bg-amber-900/70 px-2.5 py-1 text-[11px] font-semibold text-amber-100 transition-all shadow-sm hover:border-amber-300"
                >
                  <span className="text-sm leading-none">{countryMeta.flag}</span>
                  <span className="font-medium text-amber-200 max-w-[6.5rem] truncate sm:max-w-none">{countryMeta.countryName}</span>
                  <span className="font-mono text-amber-400 font-bold px-1 rounded bg-black/40">
                    {money.currency !== countryMeta.currency ? money.currency : currentLang === 'ar' ? countryMeta.symbolAr : countryMeta.symbolEn}
                  </span>
                  <ChevronDown className="h-3 w-3 text-amber-300/80 transition-transform group-hover:translate-y-0.5" />
                </button>

                {/* Autoplay / Playback Controls */}
                <div className="flex items-center gap-1 border-s border-white/15 ps-2">
                  <button
                    type="button"
                    onClick={() => setIsPlaying((p) => !p)}
                    title={isPlaying ? L('pause_reel') : L('play_reel')}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-amber-400/20 hover:text-amber-300 text-stone-300 transition-colors"
                  >
                    {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpanded(false)}
                    title={L('collapse_screen')}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/15 text-stone-400 transition-colors"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Country & Currency Picker Popover */}
                {showCountryPicker && (
                  <div
                    className={`absolute ${rtl ? 'left-0' : 'right-0'} top-full mt-2 z-50 w-72 sm:w-80 rounded-2xl border border-amber-300/30 bg-[#16100c]/98 p-3 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200`}
                  >
                    <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-200">
                        <Globe className="h-3.5 w-3.5 text-amber-400" />
                        <span>{L('choose_country')}</span>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                        {L('auto_detected')}
                      </span>
                    </div>

                    <input
                      type="text"
                      placeholder={L('search_country')}
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-black/60 px-3 py-1.5 text-xs text-white placeholder-stone-500 focus:border-amber-400 focus:outline-none mb-2"
                    />

                    <div className="max-h-56 overflow-y-auto space-y-1 pe-1">
                      {filteredCountryCodes.map((code) => {
                        const meta = getCountryMeta(code, currentLang);
                        const isCurrent = code === currentCountry;
                        return (
                          <button
                            key={code}
                            type="button"
                            onClick={() => selectNewCountry(code)}
                            className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs transition-colors cursor-pointer ${
                              isCurrent
                                ? 'bg-amber-400 text-stone-950 font-bold shadow'
                                : 'text-stone-200 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-base leading-none">{meta.flag}</span>
                              <span>{currentLang === 'ar' ? meta.nameAr : meta.nameEn}</span>
                            </div>
                            <span className="font-mono text-[11px] opacity-80">
                              {currentLang === 'ar' ? meta.symbolAr : meta.symbolEn} ({meta.currency})
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* SCREEN VIEWPORT: CINEMATIC COMMERCIAL REEL + INTEGRATED PRODUCT DRAWER */}
            <div className="relative grid min-h-[460px] sm:min-h-[520px] lg:min-h-[580px] lg:grid-cols-[1.28fr_0.72fr]">
              {/* THE CINEMA STAGE: ART COMMERCIAL WITH HIGH-FASHION PERSON SPRAYING PERFUME */}
              <div className="relative overflow-hidden min-h-[300px] sm:min-h-[360px] lg:min-h-full">
                {/* Background Crossfading Images */}
                {SCENES.map((scene, idx) => (
                  <div
                    key={scene.id}
                    className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                      idx === sceneIndex ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                    }`}
                  >
                    <img
                      src={scene.image}
                      alt={L(scene.keys.title)}
                      className={`sham-reel-img sham-reel-motion-${idx % 3} h-full w-full object-cover object-center`}
                      data-paused={isPlaying ? undefined : 'true'}
                      loading={idx === 0 ? 'eager' : 'lazy'}
                    />
                    {/* Cinema Vignette & Editorial Gradients */}
                    <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/40 to-stone-950/20" />
                    <div className="absolute inset-0 bg-gradient-to-r from-stone-950/80 via-transparent to-stone-950/90" />
                    <div className="absolute inset-0 ring-1 ring-inset ring-white/10" />
                  </div>
                ))}

                {/* Living mist: golden particles drifting over the reel (pure CSS, no video weight) */}
                <div aria-hidden="true" className="sham-reel-mist pointer-events-none absolute inset-0 z-[15] overflow-hidden" data-paused={isPlaying ? undefined : 'true'}>
                  {REEL_PARTICLES.map((pt, i) => (
                    <span
                      key={i}
                      className="sham-reel-particle"
                      style={{
                        left: `${pt.x}%`,
                        width: `${pt.size}px`,
                        height: `${pt.size}px`,
                        animationDuration: `${pt.dur}s`,
                        animationDelay: `${pt.delay}s`,
                        opacity: pt.alpha,
                      }}
                    />
                  ))}
                  <div className="sham-reel-sheen absolute inset-0" />
                </div>

                {/* Watermark / Commercial Branding */}
                <div className="absolute top-4 start-4 sm:top-6 sm:start-6 z-20">
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/30 bg-black/50 px-3.5 py-1.5 backdrop-blur-md shadow-lg">
                    <span className="flex h-2 w-2 rounded-full bg-red-500 animate-ping" />
                    <span className="text-[10px] sm:text-xs font-bold tracking-widest text-amber-200 uppercase">
                      {L(activeScene.keys.tag)}
                    </span>
                  </div>
                </div>



                {/* Cinema Bottom Subtitles & Story Caption */}
                <div className="absolute bottom-5 start-4 end-4 sm:bottom-7 sm:start-7 sm:end-7 z-20 max-w-xl">
                  <div key={activeScene.id} className="sham-reel-caption space-y-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 uppercase tracking-widest">
                      <Sparkles className="h-3 w-3 text-amber-400" />
                      {L(activeScene.keys.mood)}
                    </span>
                    <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
                      {L(activeScene.keys.title)}
                    </h2>
                    <p className="text-xs sm:text-sm text-stone-200/90 leading-relaxed drop-shadow max-w-lg">
                      {L(activeScene.keys.subtitle)}
                    </p>
                  </div>

                  {/* Scene Navigation Bar */}
                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePrevScene}
                      aria-label={L('prev_scene')}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/20 bg-black/60 text-white backdrop-blur-md hover:bg-amber-400 hover:text-stone-950 transition-colors"
                    >
                      <PreviousIcon className="h-4 w-4" />
                    </button>
                    <div className="flex items-center gap-1.5 px-2">
                      {SCENES.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setSceneIndex(i)}
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            i === sceneIndex ? 'w-6 bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]' : 'w-2 bg-white/30 hover:bg-white/60'
                          }`}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={handleNextScene}
                      aria-label={L('next_scene')}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/20 bg-black/60 text-white backdrop-blur-md hover:bg-amber-400 hover:text-stone-950 transition-colors"
                    >
                      <NextIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* INTEGRATED PRODUCT SHOWCASE BOX (خانة عرض كافة منتجات المتجر) */}
              <div className="relative z-20 flex flex-col justify-between border-t lg:border-t-0 lg:border-s border-amber-500/20 bg-gradient-to-b from-[#1b130e]/95 via-[#130d09]/98 to-[#0a0705]/98 p-4 sm:p-5 backdrop-blur-xl">
                {/* Box Header */}
                <div
                  onPointerEnter={(e) => { if (e.pointerType === 'mouse') setProductHover(true); }}
                  onPointerLeave={(e) => { if (e.pointerType === 'mouse') setProductHover(false); }}
                  onFocusCapture={(e) => {
                    // Typing a search or moving with the keyboard holds the carousel; a tap/click on an arrow does not.
                    const el = e.target as HTMLElement;
                    let keyboard = false;
                    try { keyboard = el.matches(':focus-visible'); } catch { keyboard = false; }
                    setProductFocus(el instanceof HTMLInputElement || keyboard);
                  }}
                  onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setProductFocus(false); }}
                >
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/10">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/30">
                        <ShoppingBag className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide truncate">
                            {L('product_box_title')}
                          </h3>
                          {catalog && (
                            <span className="px-1.5 rounded-full bg-amber-500/20 text-amber-200 text-[10px] font-mono font-bold border border-amber-500/30">
                              {allStoreProducts.length}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-amber-300/80 font-medium truncate">
                          {!catalog
                            ? L('loading_products')
                            : productSearch.trim() || selectedCategory !== 'all'
                              ? L('matching_count', { count: showcaseProducts.length })
                              : L('newest_first')}
                        </p>
                      </div>
                    </div>
                    {/* Device Country indicator inside product box */}
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/30 bg-black/40 px-2 py-0.5 text-[10px] text-stone-300">
                      <span>{countryMeta.flag}</span>
                      <span className="font-mono text-amber-400 font-bold">{currencyLabel(money.currency, currentLang)}</span>
                    </span>
                  </div>

                  {/* Quick Search & Category Filter for every store product */}
                  <div className="mt-2.5 space-y-1.5">
                    <div className="relative">
                      <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400 pointer-events-none" />
                      <input
                        type="search"
                        enterKeyHint="search"
                        aria-label={L('search_products_label')}
                        placeholder={L('search_products_placeholder', { count: allStoreProducts.length || '…' })}
                        value={productSearch}
                        onChange={(e) => { setProductSearch(e.target.value); setProductSlideIndex(0); }}
                        className="w-full rounded-xl border border-white/10 bg-black/50 ps-8 pe-8 py-1.5 text-xs text-white placeholder-stone-500 focus:border-amber-400 focus:outline-none transition-colors [&::-webkit-search-cancel-button]:hidden"
                      />
                      {productSearch && (
                        <button
                          type="button"
                          onClick={() => { setProductSearch(''); setProductSlideIndex(0); }}
                          aria-label={L('clear_search')}
                          className="absolute end-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white text-xs cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Category Filter Pills */}
                    <div className="flex items-center gap-1 overflow-x-auto text-[10px] no-scrollbar py-0.5" role="group" aria-label={L('category_label')}>
                      {(['all', 'men', 'women', 'unisex'] as ShowcaseCategory[]).map((catId) => (
                        // catId aliases the pill's category; labels come from the store pack.
                        <button
                          key={catId}
                          type="button"
                          aria-pressed={selectedCategory === catId}
                          onClick={() => { setSelectedCategory(catId); setProductSlideIndex(0); }}
                          className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-colors cursor-pointer font-medium ${
                            selectedCategory === catId
                              ? 'bg-amber-400 text-stone-950 font-bold'
                              : 'bg-white/5 text-stone-300 hover:bg-white/10'
                          }`}
                        >
                          {catId === 'all' ? storeText(currentLang, 'sf_all') : storeGenderLabel(catId, currentLang)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Active Product Showcase Card */}
                  {!catalog && !catalogFailed ? (
                    <div className="mt-2.5 rounded-2xl border border-white/10 bg-stone-900/60 p-3 animate-pulse" aria-hidden="true">
                      <div className="mx-auto aspect-square w-full max-w-[170px] sm:max-w-[190px] rounded-xl bg-white/5" />
                      <div className="mt-3 h-4 w-2/3 rounded bg-white/10" />
                      <div className="mt-2 h-3 w-1/2 rounded bg-white/5" />
                      <div className="mt-4 h-8 rounded-xl bg-white/5" />
                    </div>
                  ) : activeProduct ? (
                    <div
                      role="link"
                      tabIndex={0}
                      aria-label={`${storeLocalized(activeProduct.name, currentLang)} — ${activePrice}`}
                      onClick={() => handleProductClick(activeProduct.id)}
                      onKeyDown={(e) => {
                        if (e.target !== e.currentTarget) return;
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleProductClick(activeProduct.id); }
                        else if (e.key === 'ArrowRight') { e.preventDefault(); if (rtl) handlePrevProduct(); else handleNextProduct(); }
                        else if (e.key === 'ArrowLeft') { e.preventDefault(); if (rtl) handleNextProduct(); else handlePrevProduct(); }
                      }}
                      onPointerDown={onSwipeStart}
                      onPointerUp={onSwipeEnd}
                      onPointerCancel={() => { swipeRef.current = null; }}
                      className="group relative mt-2.5 cursor-pointer touch-pan-y select-none overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-b from-stone-900/80 to-stone-950/90 p-3 transition-colors hover:border-amber-400/50 hover:shadow-xl hover:shadow-amber-950/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    >
                      <div key={activeProduct.sku} className={slideDir === 1 ? 'sham-product-in-next' : 'sham-product-in-prev'} data-rtl={rtl ? 'true' : undefined}>
                        {/* Product Image Stage */}
                        <div className="relative mx-auto flex aspect-square w-full max-w-[170px] sm:max-w-[190px] items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(ellipse_at_center,#2d2116_0%,#150e09_100%)] p-2">
                          {(() => {
                            const src = photoOf(activeProduct);
                            return src ? (
                              <img
                                key={src}
                                src={storeImageSrc(src)}
                                alt={storeLocalized(activeProduct.name, currentLang)}
                                draggable={false}
                                decoding="async"
                                className={`h-full w-full drop-shadow-[0_12px_14px_rgba(0,0,0,0.7)] transition-transform duration-500 group-hover:scale-105 ${isStockPhoto(src) ? 'object-cover rounded-lg' : 'object-contain'}`}
                                onError={() => markFailed(src)}
                              />
                            ) : (
                              <div className="flex flex-col items-center gap-1.5 text-amber-500/60">
                                <Sparkles className="h-10 w-10" />
                                <span className="text-[10px] font-bold text-amber-200/70">{activeProduct.brand || L('brand_house')}</span>
                              </div>
                            );
                          })()}
                          {activeProduct.brand && (
                            <span className="absolute top-2 start-2 max-w-[80%] truncate rounded-full border border-amber-300/30 bg-black/70 px-2 py-0.5 text-[9px] font-bold text-amber-200">
                              {activeProduct.brand}
                            </span>
                          )}
                          {activeProduct.inStock ? (
                            <span className="absolute bottom-2 end-2 rounded-md bg-emerald-950/80 border border-emerald-500/40 px-1.5 py-0.5 text-[8px] font-bold text-emerald-300">
                              {L('in_stock')}
                            </span>
                          ) : (
                            <span className="absolute bottom-2 end-2 rounded-md bg-stone-900/90 border border-stone-600/50 px-1.5 py-0.5 text-[8px] font-bold text-stone-400">
                              {L('out_of_stock')}
                            </span>
                          )}
                        </div>

                        {/* Product Details */}
                        <div className="mt-2.5 space-y-0.5">
                          <h4 className="line-clamp-1 font-serif text-sm sm:text-base font-bold text-white group-hover:text-amber-200 transition-colors" dir="auto">
                            {storeLocalized(activeProduct.name, currentLang)}
                          </h4>
                          <p className="line-clamp-1 text-[11px] leading-relaxed text-stone-400" dir="auto">
                            {storeLocalized(activeProduct.description, currentLang)}
                          </p>
                        </div>

                        {/* CONVERTED PRICE DISPLAY */}
                        <div className="mt-3 flex items-end justify-between gap-2 border-t border-white/10 pt-2">
                          <div className="min-w-0">
                            <span className="block truncate text-[9px] text-stone-400 font-medium">
                              {L('price_label')} ({countryMeta.countryName})
                            </span>
                            <span className="font-mono text-lg sm:text-xl font-black text-amber-300 tracking-tight whitespace-nowrap">
                              {activePrice}
                            </span>
                          </div>

                          {/* Interactive Add to Cart button */}
                          {activeProduct.inStock ? (
                            <button
                              type="button"
                              onClick={(e) => handleAddToCart(e, activeProduct)}
                              onPointerDown={(e) => e.stopPropagation()}
                              onPointerUp={(e) => e.stopPropagation()}
                              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all shadow-md cursor-pointer ${
                                addedSku === activeProduct.sku
                                  ? 'bg-emerald-500 text-white shadow-emerald-900/50 scale-105'
                                  : 'bg-gradient-to-r from-amber-400 to-orange-500 text-stone-950 hover:brightness-110 active:scale-95'
                              }`}
                            >
                              {addedSku === activeProduct.sku ? (
                                <>
                                  <Check className="h-3.5 w-3.5" />
                                  <span>{L('added')}</span>
                                </>
                              ) : (
                                <>
                                  <ShoppingBag className="h-3.5 w-3.5" />
                                  <span>{L('add_to_cart')}</span>
                                </>
                              )}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled
                              className="flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold bg-stone-800 text-stone-400 cursor-not-allowed opacity-75"
                            >
                              <span>{L('sold_out')}</span>
                            </button>
                          )}
                        </div>
                        <div
                          className="mt-2"
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                          onPointerUp={(e) => e.stopPropagation()}
                        >
                          <ProductPayMethods
                            lang={currentLang}
                            country={currentCountry}
                            productName={storeLocalized(activeProduct.name, currentLang)}
                            productKey={activeProduct.sku}
                          />
                        </div>
                      </div>

                      {/* Dwell progress: shows when the next product comes, and freezes while paused */}
                      {showcaseProducts.length > 1 && (
                        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/5" aria-hidden="true">
                          <div
                            key={`${activeProduct.sku}-${showcaseProducts.length}-${productPaused ? 'p' : 'r'}`}
                            className="sham-product-progress h-full bg-gradient-to-r from-amber-400 to-orange-500"
                            data-paused={productPaused ? 'true' : undefined}
                            style={{ animationDuration: `${PRODUCT_DWELL_MS}ms` }}
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2.5 rounded-2xl border border-white/10 bg-stone-900/60 px-3 py-8 text-center text-xs text-stone-400">
                      {catalogFailed
                        ? L('load_failed')
                        : L('no_matches')}
                      {(productSearch || selectedCategory !== 'all') && !catalogFailed && (
                        <button
                          type="button"
                          onClick={() => { setProductSearch(''); setSelectedCategory('all'); setProductSlideIndex(0); }}
                          className="mt-3 block mx-auto rounded-lg border border-amber-400/40 px-3 py-1 text-amber-200 hover:bg-amber-500/10"
                        >
                          {L('show_all')}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Product Carousel Thumbnails & Switcher */}
                  {showcaseProducts.length > 1 && (
                    <div className="mt-3 flex items-center justify-between gap-1.5">
                      <button
                        type="button"
                        onClick={handlePrevProduct}
                        aria-label={L('prev_product')}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/15 text-stone-300 transition-colors cursor-pointer"
                      >
                        <PreviousIcon className="h-4 w-4" />
                      </button>

                      {/* Neighbouring products (wraps around the list) */}
                      <div className="flex min-w-0 items-center gap-1 py-0.5 px-0.5">
                        {thumbWindow(showcaseProducts.length, safeIndex).map((idx) => {
                          const p = showcaseProducts[idx];
                          const src = photoOf(p);
                          const isSelected = idx === safeIndex;
                          return (
                            <button
                              key={p.sku}
                              type="button"
                              onClick={() => goToProduct(idx, idx < safeIndex ? -1 : 1)}
                              title={storeLocalized(p.name, currentLang)}
                              aria-label={storeLocalized(p.name, currentLang)}
                              aria-current={isSelected ? 'true' : undefined}
                              className={`relative flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden border bg-[#1a120c] transition-all shrink-0 cursor-pointer ${
                                isSelected
                                  ? 'border-amber-400 ring-2 ring-amber-400/50 scale-105'
                                  : 'border-white/10 hover:border-white/30 opacity-60 hover:opacity-100'
                              }`}
                            >
                              {src ? (
                                <img
                                  src={storeImageSrc(src)}
                                  alt=""
                                  draggable={false}
                                  loading="lazy"
                                  decoding="async"
                                  onError={() => markFailed(src)}
                                  className={`h-full w-full ${isStockPhoto(src) ? 'object-cover' : 'object-contain bg-white'}`}
                                />
                              ) : (
                                <Sparkles className="h-3.5 w-3.5 text-amber-500/60" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Product counter */}
                      <span className="font-mono text-[10px] sm:text-[11px] text-amber-300 whitespace-nowrap bg-black/50 px-2 py-0.5 rounded-md border border-white/10" aria-live="polite">
                        {safeIndex + 1} / {showcaseProducts.length}
                      </span>

                      <button
                        type="button"
                        onClick={handleNextProduct}
                        aria-label={L('next_product')}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/15 text-stone-300 transition-colors cursor-pointer"
                      >
                        <NextIcon className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Bottom CTA Button */}
                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={onViewStore}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/10 hover:bg-amber-500/20 py-2.5 px-3 text-xs font-bold text-amber-200 transition-colors"
                  >
                    <span>{L('shop_now')}</span>
                    <ArrowDir className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpanded(false)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/40 hover:bg-white/10 text-stone-400 hover:text-white transition-colors"
                    title={L('collapse_screen')}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* MINIMIZED DISPLAY BAR WITH ACCESSIBILITY TO EXPAND */
        <div className="relative mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-2 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-200">{L('live_commercial')}</span>
              <span className="hidden sm:inline-block text-[11px] text-stone-400">· {L(activeScene.keys.title)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-950/60 px-2 py-0.5 text-[11px] text-amber-200">
              <span>{countryMeta.flag}</span>
              <span className="font-mono text-amber-400 font-bold">{currencyLabel(money.currency, currentLang)}</span>
            </span>
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-1.5 text-xs font-bold text-stone-950 hover:brightness-110 shadow-sm cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{L('expand_screen')}</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
