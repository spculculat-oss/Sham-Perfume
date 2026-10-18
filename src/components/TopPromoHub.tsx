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
import { makeT } from '../لغات/localize';
import { isRTL } from '../لغات/localizedContent';
import type { SupportedLanguage } from '../types/i18n';
import productsData from '../data/products.json';
import { storeImageSrc } from '../utils/liveStore';
import { addToCart } from '../utils/storeCart';
import { useStoreCountry, setStoreCountry } from '../utils/storeCheckout';
import {
  formatProductPriceInCountry,
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
  tagAr: string;
  tagEn: string;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  moodAr: string;
  moodEn: string;
}

const SCENES: CommercialScene[] = [
  {
    id: 'scene-man',
    image: commercialMan,
    tagAr: 'إعلان سنيمائي حصري · عطور النيش للرجال',
    tagEn: 'CINEMATIC AD · HAUTE PARFUMERIE POUR HOMME',
    titleAr: 'سحر الرذاذ الأول… هيبة وأناقة تأسر الحواس',
    titleEn: 'The Signature Mist · Aristocratic Allure & Presence',
    subtitleAr: 'تجربة إعلانية سينمائية تجسد فن توزيع ذرات العطر الملكي في إضاءة استوديو دافئة وخامات نادرة.',
    subtitleEn: 'A high-fashion film campaign capturing fine golden perfume droplets in dramatic chiaroscuro illumination.',
    moodAr: 'فوحان ملكي أرستقراطي · عنبر معتق، أخشاب ثمينة، وتبغ فيرجيني فاخر',
    moodEn: 'Royal projection · aged amber, precious woods & refined Virginian notes',
  },
  {
    id: 'scene-woman',
    image: commercialWoman,
    tagAr: 'هوت كوتور باريس · العطر النسائي الساحر',
    tagEn: 'HAUTE COUTURE PARIS · ENCHANTING POUR FEMME',
    titleAr: 'هالة مضيئة من الذرات الذهبية وجاذبية لا تُنسى',
    titleEn: 'Luminous Golden Scent · An Ethereal Feminine Silhouette',
    subtitleAr: 'تناغم رذاذ الزهور الحريرية مع إشراقة الكريستال كلوحة فنية تنبض بالرقي والشاعرية.',
    subtitleEn: 'Silken floral essence swirling with crystal luster, crafted like a timeless high-fashion masterpiece.',
    moodAr: 'أنوثة حالمة · مسك أبيض نقي، ياسمين غراس، وفانيليا مدغشقر المخملية',
    moodEn: 'Dreamy femininity · pure white musk, Grasse jasmine & velvet vanilla',
  },
  {
    id: 'scene-mist',
    image: commercialMist,
    tagAr: 'معمل شام الحرفي · ماكرو تصوير سنيمائي 4K',
    tagEn: 'SHAM MASTER LAB · 4K MACRO CINEMATIC REEL',
    titleAr: 'براعة نثر الزيوت العطرية بدقة الميكرون فائقة الثبات',
    titleEn: 'Precision Mist Atomization · Pure Extract Mastery',
    subtitleAr: 'تصميم فوهة الرش الحرفية لنشر جزيئات العطر المضيئة بنعومة فائقة تمنحك ثباتاً يدوم لأيام.',
    subtitleEn: 'Micro-engineered spray atomization releasing crystal fragrant droplets for everlasting sillage.',
    moodAr: 'ثبات فائق · تركيز نيش إكستري دو بارفان (Extrait de Parfum)',
    moodEn: 'Ultra-longevity · niche Extrait de Parfum laboratory formulation',
  },
];

const L10N = {
  screen_badge: { ar: 'مختارات دار شام الفاخرة', en: 'SHAM CURATED SELECTION' },
  live_commercial: { ar: 'مختارات دار شام', en: 'SHAM SELECTION' },
  product_box_title: { ar: 'العطور المعروضة بالأسعار', en: 'SHOWCASE PRODUCTS & PRICES' },
  product_box_kicker: { ar: 'مختارات دار شام الفاخرة', en: 'SHAM CURATED SELECTION' },
  add_to_cart: { ar: 'أضف للسلة', en: 'Add to Cart' },
  added: { ar: 'تمت الإضافة ✓', en: 'Added ✓' },
  shop_now: { ar: 'تسوّق في المتجر', en: 'Shop in Store' },
  auto_detected: { ar: 'تم تحديد دولتك وعملتك تلقائياً', en: 'Country & currency auto-detected from device' },
  change_country: { ar: 'تغيير العملة والدولة', en: 'Change country/currency' },
  choose_country: { ar: 'اختر دولة التوصيل والعملة المحلية:', en: 'Select shipping country & local currency:' },
  price_label: { ar: 'السعر بالعملة المحلية', en: 'Local price' },
  prev_scene: { ar: 'السابق', en: 'Previous' },
  next_scene: { ar: 'التالي', en: 'Next' },
  pause_reel: { ar: 'إيقاف مؤقت', en: 'Pause' },
  play_reel: { ar: 'تشغيل', en: 'Play' },
  collapse_screen: { ar: 'تصغير العرض', en: 'Minimize' },
  expand_screen: { ar: 'عرض المختارات والمنتجات', en: 'Show Products' },
  in_stock: { ar: 'متوفر للشحن الفوري', en: 'In Stock & Ready to Ship' },
};

export const TopPromoHub: React.FC<TopPromoHubProps> = ({
  currentLang = 'ar',
  onViewStore,
  onSelectProduct,
}) => {
  const rtl = isRTL(currentLang);
  const L = makeT(currentLang, L10N);

  const [expanded, setExpanded] = useState(true);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [productSlideIndex, setProductSlideIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Record<string | number, boolean>>({});
  const [addedSku, setAddedSku] = useState<string | null>(null);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'men' | 'women' | 'unisex'>('all');

  // Auto-detected visitor country from device & edge
  const [currentCountry, setCurrentCountry] = useStoreCountry();
  const countryMeta = useMemo(() => getCountryMeta(currentCountry, currentLang), [currentCountry, currentLang]);

  // All store products (1,114+ products from the catalog)
  const allStoreProducts = useMemo(() => {
    return (productsData.products || []).filter((p) => (p.ourPrice || 0) > 0);
  }, []);

  // Filtered showcase products based on search & category
  const showcaseProducts = useMemo(() => {
    let list = allStoreProducts;
    if (selectedCategory === 'men') {
      list = list.filter((p) => p.category?.includes('رجالي'));
    } else if (selectedCategory === 'women') {
      list = list.filter((p) => p.category?.includes('نسائي'));
    } else if (selectedCategory === 'unisex') {
      list = list.filter((p) => p.category?.includes('مختلط'));
    }
    if (productSearch.trim()) {
      const q = productSearch.toLowerCase().trim();
      list = list.filter((p) =>
        (p.nameAr && p.nameAr.toLowerCase().includes(q)) ||
        (p.nameEn && p.nameEn.toLowerCase().includes(q)) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.descriptionAr && p.descriptionAr.toLowerCase().includes(q)) ||
        (p.descriptionEn && p.descriptionEn.toLowerCase().includes(q))
      );
    }
    return list;
  }, [allStoreProducts, selectedCategory, productSearch]);

  const activeProduct = showcaseProducts[productSlideIndex] || showcaseProducts[0] || allStoreProducts[0];

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

  // Product slide auto-advance (pauses if user is searching)
  useEffect(() => {
    if (!expanded || showcaseProducts.length < 2 || productSearch.trim()) return;
    const interval = window.setInterval(() => {
      setProductSlideIndex((prev) => (prev + 1) % showcaseProducts.length);
    }, 8500);
    return () => window.clearInterval(interval);
  }, [expanded, showcaseProducts.length, productSearch]);

  const handleNextScene = () => {
    setSceneIndex((prev) => (prev + 1) % SCENES.length);
  };

  const handlePrevScene = () => {
    setSceneIndex((prev) => (prev - 1 + SCENES.length) % SCENES.length);
  };

  const handleNextProduct = () => {
    if (showcaseProducts.length === 0) return;
    setProductSlideIndex((prev) => (prev + 1) % showcaseProducts.length);
  };

  const handlePrevProduct = () => {
    if (showcaseProducts.length === 0) return;
    setProductSlideIndex((prev) => (prev - 1 + showcaseProducts.length) % showcaseProducts.length);
  };

  const handleAddToCart = (e: React.MouseEvent, p: typeof activeProduct) => {
    e.stopPropagation();
    if (!p) return;
    addToCart(p.sku, 1);
    setAddedSku(p.sku);
    setTimeout(() => setAddedSku(null), 2200);
  };

  const handleProductClick = (productId: number | string) => {
    if (onSelectProduct) {
      onSelectProduct(productId);
    } else {
      window.location.hash = `#product=${productId}`;
      if (onViewStore) onViewStore();
    }
  };

  // Convert product price in detected country currency
  const activePriceData = useMemo(() => {
    if (!activeProduct?.ourPrice) {
      return { formatted: '—', symbol: '', countryName: '', flag: '' };
    }
    return formatProductPriceInCountry(activeProduct.ourPrice, currentCountry, currentLang);
  }, [activeProduct, currentCountry, currentLang]);

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
                  {currentLang === 'ar' ? 'مختارات دار شام الفاخرة' : 'Sham Curated Fragrance Selection'}
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
                  <span className="font-medium text-amber-200">{countryMeta.countryName}</span>
                  <span className="font-mono text-amber-400 font-bold px-1 rounded bg-black/40">
                    {currentLang === 'ar' ? countryMeta.symbolAr : countryMeta.symbolEn}
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
                      placeholder={currentLang === 'ar' ? 'ابحث باسم الدولة أو العملة…' : 'Search country or currency…'}
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-black/60 px-3 py-1.5 text-xs text-white placeholder-stone-500 focus:border-amber-400 focus:outline-none mb-2"
                    />

                    <div className="max-h-56 overflow-y-auto space-y-1 pe-1">
                      {filteredCountryCodes.map((code) => {
                        const meta = TOP_COUNTRIES[code] || getCountryMeta(code, currentLang);
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
                      alt={currentLang === 'ar' ? scene.titleAr : scene.titleEn}
                      className="h-full w-full object-cover object-center transform scale-100 transition-transform duration-[8000ms] ease-out hover:scale-105"
                      loading={idx === 0 ? 'eager' : 'lazy'}
                    />
                    {/* Cinema Vignette & Editorial Gradients */}
                    <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/40 to-stone-950/20" />
                    <div className="absolute inset-0 bg-gradient-to-r from-stone-950/80 via-transparent to-stone-950/90" />
                    <div className="absolute inset-0 ring-1 ring-inset ring-white/10" />
                  </div>
                ))}

                {/* Watermark / Commercial Branding */}
                <div className="absolute top-4 start-4 sm:top-6 sm:start-6 z-20">
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/30 bg-black/50 px-3.5 py-1.5 backdrop-blur-md shadow-lg">
                    <span className="flex h-2 w-2 rounded-full bg-red-500 animate-ping" />
                    <span className="text-[10px] sm:text-xs font-bold tracking-widest text-amber-200 uppercase">
                      {currentLang === 'ar' ? activeScene.tagAr : activeScene.tagEn}
                    </span>
                  </div>
                </div>



                {/* Cinema Bottom Subtitles & Story Caption */}
                <div className="absolute bottom-5 start-4 end-4 sm:bottom-7 sm:start-7 sm:end-7 z-20 max-w-xl">
                  <div className="space-y-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 uppercase tracking-widest">
                      <Sparkles className="h-3 w-3 text-amber-400" />
                      {currentLang === 'ar' ? activeScene.moodAr : activeScene.moodEn}
                    </span>
                    <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
                      {currentLang === 'ar' ? activeScene.titleAr : activeScene.titleEn}
                    </h2>
                    <p className="text-xs sm:text-sm text-stone-200/90 leading-relaxed drop-shadow max-w-lg">
                      {currentLang === 'ar' ? activeScene.subtitleAr : activeScene.subtitleEn}
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
                <div>
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/30">
                        <ShoppingBag className="h-4 w-4" />
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                            {L('product_box_title')}
                          </h3>
                          <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-200 text-[10px] font-mono font-bold border border-amber-500/30">
                            {allStoreProducts.length}
                          </span>
                        </div>
                        <p className="text-[10px] text-amber-300/80 font-medium">
                          {currentLang === 'ar' ? `كل عطور المتجر (${showcaseProducts.length} معروضة)` : `All store perfumes (${showcaseProducts.length} shown)`}
                        </p>
                      </div>
                    </div>
                    {/* Device Country indicator inside product box */}
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-black/40 px-2 py-0.5 text-[10px] text-stone-300">
                      <span>{countryMeta.flag}</span>
                      <span className="font-mono text-amber-400 font-bold">{countryMeta.currency}</span>
                    </span>
                  </div>

                  {/* Quick Search & Category Filter for all 1,114 products */}
                  <div className="mt-2.5 space-y-1.5">
                    <div className="relative">
                      <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400 pointer-events-none" />
                      <input
                        type="text"
                        placeholder={currentLang === 'ar' ? `ابحث في كل عطور المتجر (${allStoreProducts.length} عطر)…` : `Search all perfumes (${allStoreProducts.length})…`}
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-black/50 ps-8 pe-8 py-1 text-xs text-white placeholder-stone-500 focus:border-amber-400 focus:outline-none transition-colors"
                      />
                      {productSearch && (
                        <button
                          type="button"
                          onClick={() => setProductSearch('')}
                          className="absolute end-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white text-xs cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Category Filter Pills */}
                    <div className="flex items-center gap-1 overflow-x-auto text-[10px] no-scrollbar py-0.5">
                      {[
                        { id: 'all', labelAr: 'الكل', labelEn: 'All' },
                        { id: 'men', labelAr: 'رجالي', labelEn: 'Men' },
                        { id: 'women', labelAr: 'نسائي', labelEn: 'Women' },
                        { id: 'unisex', labelAr: 'مختلط', labelEn: 'Unisex' },
                      ].map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setSelectedCategory(cat.id as any)}
                          className={`px-2 py-0.5 rounded-lg whitespace-nowrap transition-colors cursor-pointer font-medium ${
                            selectedCategory === cat.id
                              ? 'bg-amber-400 text-stone-950 font-bold'
                              : 'bg-white/5 text-stone-300 hover:bg-white/10'
                          }`}
                        >
                          {currentLang === 'ar' ? cat.labelAr : cat.labelEn}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Active Product Showcase Card */}
                  {activeProduct ? (
                    <div
                      key={activeProduct.id}
                      onClick={() => handleProductClick(activeProduct.id)}
                      className="group relative mt-2.5 cursor-pointer rounded-2xl border border-white/15 bg-gradient-to-b from-stone-900/80 to-stone-950/90 p-3 transition-all hover:border-amber-400/50 hover:shadow-xl hover:shadow-amber-950/40"
                    >
                      {/* Product Image Stage */}
                      <div className="relative mx-auto flex aspect-square w-full max-w-[170px] sm:max-w-[190px] items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(ellipse_at_center,#2d2116_0%,#150e09_100%)] p-2">
                        {activeProduct.imageUrl && !failedImages[activeProduct.id] ? (
                          <img
                            src={storeImageSrc(activeProduct.imageUrl)}
                            alt={currentLang === 'ar' ? activeProduct.nameAr : activeProduct.nameEn}
                            className="h-full w-full object-contain drop-shadow-[0_12px_14px_rgba(0,0,0,0.7)] transition-transform duration-500 group-hover:scale-105"
                            loading="lazy"
                            onError={() => setFailedImages((prev) => ({ ...prev, [activeProduct.id]: true }))}
                          />
                        ) : (
                          <Sparkles className="h-10 w-10 text-amber-500/50" />
                        )}
                        <span className="absolute top-2 start-2 rounded-full border border-amber-300/30 bg-black/70 px-2 py-0.5 text-[9px] font-bold text-amber-200">
                          {activeProduct.brand}
                        </span>
                        {activeProduct.stockStatus === 'out_of_stock' ? (
                          <span className="absolute bottom-2 end-2 rounded-md bg-stone-900/90 border border-stone-600/50 px-1.5 py-0.5 text-[8px] font-bold text-stone-400">
                            {currentLang === 'ar' ? 'غير متوفر' : 'Out of stock'}
                          </span>
                        ) : (
                          <span className="absolute bottom-2 end-2 rounded-md bg-emerald-950/80 border border-emerald-500/40 px-1.5 py-0.5 text-[8px] font-bold text-emerald-300">
                            {L('in_stock')}
                          </span>
                        )}
                      </div>

                      {/* Product Details */}
                      <div className="mt-2.5 space-y-0.5">
                        <h4 className="line-clamp-1 font-serif text-sm sm:text-base font-bold text-white group-hover:text-amber-200 transition-colors">
                          {currentLang === 'ar' ? activeProduct.nameAr : activeProduct.nameEn}
                        </h4>
                        <p className="line-clamp-1 text-[11px] leading-relaxed text-stone-400">
                          {currentLang === 'ar' ? activeProduct.descriptionAr : activeProduct.descriptionEn}
                        </p>
                      </div>

                      {/* CONVERTED PRICE DISPLAY */}
                      <div className="mt-3 flex items-end justify-between border-t border-white/10 pt-2">
                        <div>
                          <span className="block text-[9px] text-stone-400 font-medium">
                            {L('price_label')} ({countryMeta.countryName})
                          </span>
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-mono text-lg sm:text-xl font-black text-amber-300 tracking-tight">
                              {activePriceData.formatted}
                            </span>
                          </div>
                        </div>

                        {/* Interactive Add to Cart button */}
                        {activeProduct.stockStatus === 'out_of_stock' ? (
                          <button
                            type="button"
                            disabled
                            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold bg-stone-800 text-stone-400 cursor-not-allowed opacity-75"
                          >
                            <span>{currentLang === 'ar' ? 'نفد المخزون' : 'Out of stock'}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => handleAddToCart(e, activeProduct)}
                            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all shadow-md cursor-pointer ${
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
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-stone-400 text-xs">
                      {currentLang === 'ar' ? 'لا توجد منتجات مطابقة للبحث' : 'No products match search'}
                    </div>
                  )}

                  {/* Product Carousel Thumbnails & Switcher for all products */}
                  {showcaseProducts.length > 0 && (
                    <div className="mt-3 flex items-center justify-between gap-1.5">
                      <button
                        type="button"
                        onClick={handlePrevProduct}
                        aria-label={L('prev_scene')}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/15 text-stone-300 transition-colors cursor-pointer"
                      >
                        <PreviousIcon className="h-3.5 w-3.5" />
                      </button>

                      {/* Visible Mini Thumbnails Strip of neighboring products */}
                      <div className="flex items-center gap-1 overflow-x-auto py-0.5 px-0.5 no-scrollbar">
                        {(() => {
                          const total = showcaseProducts.length;
                          const visibleCount = Math.min(5, total);
                          const half = Math.floor(visibleCount / 2);
                          let start = productSlideIndex - half;
                          if (start < 0) start = 0;
                          if (start + visibleCount > total) start = Math.max(0, total - visibleCount);
                          const slice = showcaseProducts.slice(start, start + visibleCount);

                          return slice.map((p, i) => {
                            const actualIdx = start + i;
                            const isSelected = actualIdx === productSlideIndex;
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => setProductSlideIndex(actualIdx)}
                                title={currentLang === 'ar' ? p.nameAr : p.nameEn}
                                className={`relative h-7 w-7 rounded-lg overflow-hidden border transition-all shrink-0 cursor-pointer ${
                                  isSelected
                                    ? 'border-amber-400 ring-2 ring-amber-400/50 scale-105'
                                    : 'border-white/10 hover:border-white/30 opacity-60 hover:opacity-100'
                                }`}
                              >
                                <img
                                  src={storeImageSrc(p.imageUrl)}
                                  alt=""
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              </button>
                            );
                          });
                        })()}
                      </div>

                      {/* Product counter */}
                      <span className="font-mono text-[10px] sm:text-[11px] text-amber-300 whitespace-nowrap bg-black/50 px-2 py-0.5 rounded-md border border-white/10">
                        {productSlideIndex + 1} / {showcaseProducts.length}
                      </span>

                      <button
                        type="button"
                        onClick={handleNextProduct}
                        aria-label={L('next_scene')}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/15 text-stone-300 transition-colors cursor-pointer"
                      >
                        <NextIcon className="h-3.5 w-3.5" />
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
              <span className="text-xs font-bold text-amber-200">{currentLang === 'ar' ? 'مختارات دار شام' : 'Sham Selection'}</span>
              <span className="hidden sm:inline-block text-[11px] text-stone-400">· {currentLang === 'ar' ? activeScene.titleAr : activeScene.titleEn}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-950/60 px-2 py-0.5 text-[11px] text-amber-200">
              <span>{countryMeta.flag}</span>
              <span className="font-mono text-amber-400 font-bold">{countryMeta.currency}</span>
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
