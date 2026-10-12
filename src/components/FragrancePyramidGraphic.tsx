import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Wind,
  Play,
  Pause,
  RotateCcw,
  Clock,
  Activity,
  Layers,
  Award,
  ShieldCheck,
  CheckCircle2,
  Droplets,
  Zap,
  Info,
  ChevronDown,
  ChevronUp,
  Share2,
  Sliders,
  Scale,
} from 'lucide-react';
import { PyramidNote, CalculationResult } from '../types/perfume';
import { SupportedLanguage } from '../types/i18n';
import { formatNum } from '../utils/calculations';
import { useLanguage } from '../context/LanguageContext';
import {
  enrichPyramidNote,
  sortNotesByVolatilityOrder,
  generateCustomSprayScenario,
  getNoteActivityAtMinute,
  EvolutionScenarioStage,
} from '../utils/volatilityHelper';

interface FragrancePyramidGraphicProps {
  pyramidNotes: PyramidNote[];
  setPyramidNotes: React.Dispatch<React.SetStateAction<PyramidNote[]>>;
  result: CalculationResult;
  bottleVolumeMl?: number;
  concentrationPercent?: number;
  currentLang?: SupportedLanguage;
}

export const FragrancePyramidGraphic: React.FC<FragrancePyramidGraphicProps> = ({
  pyramidNotes,
  setPyramidNotes,
  result,
  bottleVolumeMl = 100,
  concentrationPercent = 20,
  currentLang: propLang,
}) => {
  const { currentLang: ctxLang, t } = useLanguage();
  const effectiveLang = propLang || ctxLang || 'ar';
  const isRTL = effectiveLang === 'ar' || effectiveLang === 'fa';

  // Enriched and volatility-sorted notes
  const enrichedNotes = pyramidNotes.map(enrichPyramidNote);
  const sortedNotes = sortNotesByVolatilityOrder(enrichedNotes);

  const topNotes = sortedNotes.filter((n) => n.category === 'top');
  const heartNotes = sortedNotes.filter((n) => n.category === 'heart');
  const baseNotes = sortedNotes.filter((n) => n.category === 'base');

  const topPct = topNotes.reduce((acc, n) => acc + (n.percentageOfOil || 0), 0);
  const heartPct = heartNotes.reduce((acc, n) => acc + (n.percentageOfOil || 0), 0);
  const basePct = baseNotes.reduce((acc, n) => acc + (n.percentageOfOil || 0), 0);
  const totalPct = topPct + heartPct + basePct;
  const isBalanced100 = Math.abs(totalPct - 100) < 0.1;

  // Selected tier for inspection
  const [selectedTier, setSelectedTier] = useState<'all' | 'top' | 'heart' | 'base'>('all');

  // Simulation state: minutes elapsed (0 to 720)
  const [currentMinutes, setCurrentMinutes] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [sprayAnimationActive, setSprayAnimationActive] = useState<boolean>(false);
  const [copiedScenario, setCopiedScenario] = useState<boolean>(false);

  // Scenario generation
  const scenario = generateCustomSprayScenario(pyramidNotes, bottleVolumeMl, concentrationPercent);
  const { stages } = scenario;

  // Determine active stage based on currentMinutes
  const activeStage = stages.reduce((prev, curr) => {
    return currentMinutes >= curr.timeMinutes ? curr : prev;
  }, stages[0]);

  // Animation timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentMinutes((prev) => {
          if (prev >= 720) {
            setIsPlaying(false);
            return 720;
          }
          const increment = playbackSpeed === 1 ? 5 : playbackSpeed === 2 ? 15 : 45;
          return Math.min(720, prev + increment);
        });
      }, 500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, playbackSpeed]);

  const handleTriggerSpray = () => {
    setSprayAnimationActive(true);
    setCurrentMinutes(0);
    setIsPlaying(true);
    setTimeout(() => {
      setSprayAnimationActive(false);
    }, 1800);
  };

  const handleResetSimulation = () => {
    setIsPlaying(false);
    setCurrentMinutes(0);
  };

  const handleUpdateNotePct = (id: string, pct: number) => {
    setPyramidNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, percentageOfOil: Math.max(0, pct) } : n))
    );
  };

  const handleCopyScenario = () => {
    const text = isRTL
      ? `🧪 السيناريو التخيلي لعطر (${bottleVolumeMl} مل - تركيز ${concentrationPercent}%):
${scenario.summaryStory}

المرحلة الحالية [${activeStage.timeLabelAr}]:
• الفوحان: ${activeStage.sillageRating} (${activeStage.sillagePercent}%)
• ما يحدث: ${activeStage.whatHappensTextAr}
• الانطباع الشمي: ${activeStage.olfactoryPerceptionTextAr}
• نصيحة العطار: ${activeStage.adviceForWearerAr}

توزيع الهرم العطري:
- القمة (${topPct}%): ${topNotes.map((n) => `${n.nameAr} ${n.percentageOfOil}%`).join(', ')}
- القلب (${heartPct}%): ${heartNotes.map((n) => `${n.nameAr} ${n.percentageOfOil}%`).join(', ')}
- القاعدة (${basePct}%): ${baseNotes.map((n) => `${n.nameAr} ${n.percentageOfOil}%`).join(', ')}`
      : `🧪 Fragrance Evolution Scenario (${bottleVolumeMl}ml - ${concentrationPercent}% Conc):
${scenario.summaryStoryEn || scenario.summaryStory}

Current Phase [${activeStage.timeLabelEn || activeStage.timeLabelAr}]:
• Sillage: ${activeStage.sillageRatingEn || activeStage.sillageRating} (${activeStage.sillagePercent}%)
• What happens: ${activeStage.whatHappensTextEn || activeStage.whatHappensTextAr}
• Olfactory perception: ${activeStage.olfactoryPerceptionTextEn || activeStage.olfactoryPerceptionTextAr}
• Perfumer advice: ${activeStage.adviceForWearerEn || activeStage.adviceForWearerAr}

Pyramid Distribution:
- Top (${topPct}%): ${topNotes.map((n) => `${n.nameEn || n.nameAr} ${n.percentageOfOil}%`).join(', ')}
- Heart (${heartPct}%): ${heartNotes.map((n) => `${n.nameEn || n.nameAr} ${n.percentageOfOil}%`).join(', ')}
- Base (${basePct}%): ${baseNotes.map((n) => `${n.nameEn || n.nameAr} ${n.percentageOfOil}%`).join(', ')}`;

    navigator.clipboard.writeText(text);
    setCopiedScenario(true);
    setTimeout(() => setCopiedScenario(false), 2500);
  };

  const getNoteWeightGrams = (pct: number) => {
    return (result.oilWeightGrams * pct) / 100;
  };

  const getNoteVolumeMl = (pct: number) => {
    return (result.oilVolumeMl * pct) / 100;
  };

  // Volatility color badge
  const getVolatilityBadge = (rank: number) => {
    if (rank <= 2) {
      return {
        bg: 'bg-amber-100 text-amber-900 border-amber-300',
        text: isRTL ? 'تطاير فوري (أول 15 دقيقة) 💨' : 'Instant Flash (0-15m) 💨',
        highlight: 'text-amber-600',
      };
    } else if (rank <= 4) {
      return {
        bg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
        text: isRTL ? 'تطاير سريع (15-45 دقيقة) ⚡' : 'Fast Evaporation (15-45m) ⚡',
        highlight: 'text-emerald-600',
      };
    } else if (rank <= 6) {
      return {
        bg: 'bg-sky-100 text-sky-900 border-sky-300',
        text: isRTL ? 'تبخر متزن (1-4 ساعات) 🌸' : 'Balanced Mid Bloom (1-4h) 🌸',
        highlight: 'text-sky-600',
      };
    } else if (rank <= 8) {
      return {
        bg: 'bg-indigo-100 text-indigo-900 border-indigo-300',
        text: isRTL ? 'تبخر بطيء (4-8 ساعات) ⏳' : 'Slow Drydown (4-8h) ⏳',
        highlight: 'text-indigo-600',
      };
    } else {
      return {
        bg: 'bg-stone-900 text-amber-300 border-stone-700',
        text: isRTL ? 'ثبات أقصى (12-24+ ساعة) ⚓' : 'Maximum Tenacity (12-24h+) ⚓',
        highlight: 'text-amber-400',
      };
    }
  };

  // Active layer illumination during simulation
  const isTopActive = currentMinutes < 45;
  const isHeartActive = currentMinutes >= 15 && currentMinutes < 300;
  const isBaseActive = currentMinutes >= 120;

  return (
    <div className="space-y-8">
      {/* Visual Pyramid Top Banner & Interactive Controls */}
      <div className="bg-gradient-to-r from-stone-950 via-stone-900 to-amber-950 text-white p-6 sm:p-8 rounded-3xl border border-amber-500/30 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Spray Particle Mist Effect */}
        {sprayAnimationActive && (
          <div className="absolute inset-0 bg-stone-950/85 backdrop-blur-sm flex items-center justify-center z-30 animate-in fade-in zoom-in-95 duration-200 pointer-events-none">
            <div className="text-center space-y-3 p-6 max-w-md">
              <div className="flex items-center justify-center gap-2 text-4xl animate-bounce">
                <span>💨</span>
                <span className="animate-spin text-amber-300">✨</span>
                <span>💧</span>
              </div>
              <div className="text-amber-300 font-extrabold text-xl font-serif-luxury tracking-wide drop-shadow-md">
                {isRTL ? 'تم ضغط رذاذ العطر! (Atomization Flash)' : 'Perfume Atomized! (Atomization Flash)'}
              </div>
              <p className="text-xs text-stone-200 leading-relaxed font-sans">
                {isRTL
                  ? `تفتت السائل إلى ملايين الجزيئات الدقيقة، انطلاق أسرع الجزيئات طيراناً «${scenario.fastestFlyerName}» في محيط 3 أمتار، وبدء العداد الزمني لمسار التبخر...`
                  : `Dispersed into millions of micro-droplets. Fastest volatile note «${scenario.fastestFlyerNameEn || scenario.fastestFlyerName}» radiating across 3 meters...`}
              </p>
              <div className="flex justify-center gap-1.5 pt-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-300 animate-pulse" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-200" />
              </div>
            </div>
          </div>
        )}

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {isRTL
                  ? 'جرافيك الهرم العطري التفاعلي ومحاكي التطور الشمي'
                  : 'Interactive Fragrance Pyramid & Olfactory Evolution'}
              </span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold font-serif-luxury tracking-wide text-white">
              {t('pyramid_title', 'الهرم العطري وسيناريو ما بعد الرش')}
            </h3>
            <p className="text-stone-300 text-xs sm:text-sm leading-relaxed">
              {isRTL
                ? `توزيع جزيئات الزيت العطري (${formatNum(result.oilWeightGrams)} جم) مرتبة هندسياً حسب سرعة التطاير، مع إدراج نسب كل مكون وسيناريو تخيلي حي لما يحدث على مدار 24 ساعة.`
                : `Aromachemical distribution (${formatNum(result.oilWeightGrams)}g concentrate) ordered by molecular volatility rates, featuring real-time 24-hour spray evolution scenario.`}
            </p>
          </div>

          {/* Quick Spray Simulation CTA */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <button
              type="button"
              onClick={handleTriggerSpray}
              className="flex-1 sm:flex-none px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold text-sm shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer group"
            >
              <Wind className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span>{isRTL ? 'محاكاة رش العطر الآن 💨' : 'Simulate Perfume Spray 💨'}</span>
            </button>
            <button
              type="button"
              onClick={handleCopyScenario}
              className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-stone-200 text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer"
              title={isRTL ? 'نسخ ملخص السيناريو التخيلي' : 'Copy scenario summary'}
            >
              <Share2 className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {copiedScenario
                  ? isRTL ? 'تم النسخ بنجاح!' : 'Copied Successfully!'
                  : isRTL ? 'مشاركة السيناريو' : 'Share Scenario'}
              </span>
            </button>
          </div>
        </div>

        {/* Live Metrics Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 mt-6 border-t border-white/10 text-xs">
          <div className="bg-black/30 p-3 rounded-xl border border-white/5">
            <span className="text-stone-400 block text-[11px]">{isRTL ? 'مجموع نسب الهرم:' : 'Pyramid Total Ratio:'}</span>
            <span
              className={`font-mono-numbers text-base font-bold ${
                isBalanced100 ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {formatNum(totalPct, 1)}%
            </span>
            <span className="text-[10px] text-stone-400 block mt-0.5">
              {isBalanced100
                ? isRTL ? '✓ موزون بالكامل 100%' : '✓ Perfectly Balanced 100%'
                : isRTL ? '⚠ يحتاج ضبط للوصول لـ 100%' : '⚠ Adjust to reach 100%'}
            </span>
          </div>

          <div className="bg-black/30 p-3 rounded-xl border border-white/5">
            <span className="text-stone-400 block text-[11px]">{isRTL ? 'أسرع مكون طيراناً:' : 'Fastest Volatile Note:'}</span>
            <span className="text-amber-300 font-semibold truncate block">
              {isRTL ? scenario.fastestFlyerName : (scenario.fastestFlyerNameEn || scenario.fastestFlyerName)}
            </span>
            <span className="text-[10px] text-stone-400 block mt-0.5">
              {isRTL ? 'يتبخر خلال أول 15 دقيقة' : 'Evaporates in first 15 mins'}
            </span>
          </div>

          <div className="bg-black/30 p-3 rounded-xl border border-white/5">
            <span className="text-stone-400 block text-[11px]">{isRTL ? 'أثقل مكون ثباتاً:' : 'Deepest Foundation Anchor:'}</span>
            <span className="text-amber-300 font-semibold truncate block">
              {isRTL ? scenario.deepestAnchorName : (scenario.deepestAnchorNameEn || scenario.deepestAnchorName)}
            </span>
            <span className="text-[10px] text-stone-400 block mt-0.5">
              {isRTL ? 'يرسو ويدوم حتى 24+ ساعة' : 'Anchors & lasts 24+ hours'}
            </span>
          </div>

          <div className="bg-black/30 p-3 rounded-xl border border-white/5">
            <span className="text-stone-400 block text-[11px]">{isRTL ? 'عدد مكونات الزيت:' : 'Oil Ingredients Count:'}</span>
            <span className="text-white font-mono-numbers text-base font-bold">
              {pyramidNotes.length} {isRTL ? 'نوتة' : 'notes'}
            </span>
            <span className="text-[10px] text-stone-400 block mt-0.5">
              {topNotes.length} {isRTL ? 'قمة' : 'top'} · {heartNotes.length} {isRTL ? 'قلب' : 'heart'} · {baseNotes.length} {isRTL ? 'قاعدة' : 'base'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Visual Graphic Pyramid (Left) + Interactive Scenario Simulation (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* ========================================================= */}
        {/* LEFT COLUMN: THE GRAPHIC PYRAMID WITH EMBEDDED INGREDIENTS */}
        {/* ========================================================= */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 sm:p-7 space-y-6">
            
            {/* Pyramid Section Header & Tier Filter */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-100">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5 uppercase tracking-wider">
                  <Layers className="w-4 h-4 text-amber-600" />
                  <span>{isRTL ? 'الرسم التخطيطي للهرم العطري (Fragrance Pyramid)' : 'Fragrance Olfactory Pyramid Architecture'}</span>
                </span>
                <span className="text-[11px] text-stone-500 block">
                  {isRTL
                    ? 'مرتبة من قمة الهرم (الأسرع طيراناً أولاً) إلى القاعدة الراسخة'
                    : 'Tiered from Apex (fastest evaporating) down to the lasting base foundation'}
                </span>
              </div>

              {/* Tier Filter Tabs */}
              <div className="inline-flex p-1 bg-stone-100 rounded-xl text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setSelectedTier('all')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    selectedTier === 'all'
                      ? 'bg-white text-stone-900 shadow-xs font-bold'
                      : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  {isRTL ? 'كامل الهرم' : 'Full Pyramid'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTier('top')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    selectedTier === 'top'
                      ? 'bg-amber-500 text-stone-950 shadow-xs font-bold'
                      : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  {isRTL ? 'القمة' : 'Top'} ({formatNum(topPct, 1)}%)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTier('heart')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    selectedTier === 'heart'
                      ? 'bg-stone-800 text-white shadow-xs font-bold'
                      : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  {isRTL ? 'القلب' : 'Heart'} ({formatNum(heartPct, 1)}%)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTier('base')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    selectedTier === 'base'
                      ? 'bg-amber-950 text-amber-300 shadow-xs font-bold'
                      : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  {isRTL ? 'القاعدة' : 'Base'} ({formatNum(basePct, 1)}%)
                </button>
              </div>
            </div>

            {/* THE VISUAL GRAPHIC PYRAMID STRUCTURE */}
            <div className="space-y-5">

              {/* 3D Geometric Isometric Pyramid Diagram */}
              <div className="bg-gradient-to-b from-stone-900 via-stone-950 to-stone-900 p-4 sm:p-5 rounded-2xl border border-amber-500/25 shadow-lg relative overflow-hidden text-center">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-300 pb-3 mb-2 border-b border-stone-800">
                  <span className="font-bold text-amber-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isRTL ? 'المخطط الهندسي لطبقات الهرم (انقر للتصفية)' : 'Geometric Pyramid Architecture (Click to filter)'}</span>
                  </span>
                  <span className="text-[11px] text-stone-400 font-mono-numbers">
                    {isRTL ? `الطبقة الفاعلة حالياً (${currentMinutes}د): ` : `Active Phase at (${currentMinutes}m): `}
                    <span className="text-amber-400 font-bold">
                      {isTopActive
                        ? isRTL ? 'قمة الهرم (Apex) 💨' : 'Apex (Top Notes) 💨'
                        : isHeartActive
                        ? isRTL ? 'قلب العطر (Heart) 🌸' : 'Core Bouquet (Heart) 🌸'
                        : isRTL ? 'قاعدة العطر (Base) ⚓' : 'Deep Base (Foundation) ⚓'}
                    </span>
                  </span>
                </div>

                <div className="relative max-w-[340px] mx-auto py-2">
                  <svg viewBox="0 0 320 230" className="w-full h-auto drop-shadow-2xl select-none">
                    <defs>
                      <linearGradient id="apexGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fbbf24" />
                        <stop offset="100%" stopColor="#d97706" />
                      </linearGradient>
                      <linearGradient id="heartGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f472b6" />
                        <stop offset="100%" stopColor="#be185d" />
                      </linearGradient>
                      <linearGradient id="baseGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#d97706" />
                        <stop offset="100%" stopColor="#78350f" />
                      </linearGradient>
                      <filter id="glowGold" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="5" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                    </defs>

                    {/* TIER 1: APEX TRIANGLE (Top) */}
                    <polygon
                      points="160,15 215,80 105,80"
                      fill="url(#apexGrad)"
                      stroke="#fde68a"
                      strokeWidth={isTopActive ? '3.5' : '1'}
                      filter={isTopActive ? 'url(#glowGold)' : undefined}
                      className="cursor-pointer transition-all hover:opacity-90"
                      onClick={() => setSelectedTier('top')}
                    />
                    <text x="160" y="52" textAnchor="middle" fill="#1c1917" fontSize="11" fontWeight="800">
                      {isRTL ? 'قمة العطر (Top)' : 'Top Notes (Apex)'}
                    </text>
                    <text x="160" y="68" textAnchor="middle" fill="#451a03" fontSize="10" fontWeight="700">
                      {formatNum(topPct, 1)}% · {isRTL ? 'تطاير فوري' : 'Instant Flash'}
                    </text>

                    {/* TIER 2: HEART TRAPEZOID */}
                    <polygon
                      points="102,86 218,86 260,150 60,150"
                      fill="url(#heartGrad)"
                      stroke="#fbcfe8"
                      strokeWidth={isHeartActive ? '3.5' : '1'}
                      filter={isHeartActive ? 'url(#glowGold)' : undefined}
                      className="cursor-pointer transition-all hover:opacity-90"
                      onClick={() => setSelectedTier('heart')}
                    />
                    <text x="160" y="115" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="800">
                      {isRTL ? 'قلب العطر (Heart)' : 'Heart Notes (Bloom)'}
                    </text>
                    <text x="160" y="132" textAnchor="middle" fill="#fdf2f8" fontSize="11" fontWeight="700">
                      {formatNum(heartPct, 1)}% · {isRTL ? 'زهور وتوابل' : 'Florals & Spices'}
                    </text>

                    {/* TIER 3: BASE TRAPEZOID */}
                    <polygon
                      points="58,156 262,156 308,220 12,220"
                      fill="url(#baseGrad)"
                      stroke="#fed7aa"
                      strokeWidth={isBaseActive ? '3.5' : '1'}
                      filter={isBaseActive ? 'url(#glowGold)' : undefined}
                      className="cursor-pointer transition-all hover:opacity-90"
                      onClick={() => setSelectedTier('base')}
                    />
                    <text x="160" y="185" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="800">
                      {isRTL ? 'قاعدة العطر (Base)' : 'Base Notes (Anchorage)'}
                    </text>
                    <text x="160" y="203" textAnchor="middle" fill="#fef3c7" fontSize="11" fontWeight="700">
                      {formatNum(basePct, 1)}% · {isRTL ? 'أخشاب وعنبر ومسك' : 'Woods, Amber & Musks'}
                    </text>
                  </svg>
                </div>
              </div>

              {/* TIER 1 LIST: TOP NOTES */}
              {(selectedTier === 'all' || selectedTier === 'top') && (
                <div
                  className={`p-5 rounded-2xl border transition-all space-y-4 ${
                    isTopActive
                      ? 'bg-amber-500/10 border-amber-400 shadow-md ring-2 ring-amber-400/20'
                      : 'bg-stone-50/80 border-stone-200'
                  }`}
                >
                  <div className="flex items-center justify-between pb-3 border-b border-stone-200">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500 text-stone-950 font-extrabold text-sm flex items-center justify-center shadow-xs">
                        1
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-sm text-stone-900">
                            {t('pyramid_top_title', 'النوتات الافتتاحية (العليا - Top Notes)')}
                          </h4>
                          {isTopActive && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-950 text-[10px] font-bold animate-pulse">
                              {isRTL ? 'في أوج النشاط 💨' : 'Active Flash 💨'}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-stone-600">
                          {isRTL
                            ? 'أسرع الجزيئات طيراناً (Monoterpenes) · أول ما يشم عند الرش (0 - 15 دقيقة)'
                            : 'Fastest volatilization (Monoterpenes) · First impression upon spraying (0 - 15m)'}
                        </span>
                      </div>
                    </div>

                    <div className="text-left font-mono-numbers">
                      <div className="text-base font-extrabold text-amber-900">
                        {formatNum(topPct, 1)}%
                      </div>
                      <div className="text-[10px] text-stone-500">
                        {formatNum(getNoteWeightGrams(topPct))} g · {formatNum(getNoteVolumeMl(topPct))} ml
                      </div>
                    </div>
                  </div>

                  {/* Notes embedded inside Top Tier */}
                  {topNotes.length === 0 ? (
                    <div className="text-center py-4 text-stone-400 text-xs italic">
                      {isRTL ? 'لم يتم إدراج نوتات قمة بعد.' : 'No top notes added yet.'}
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {topNotes.map((note, idx) => {
                        const badge = getVolatilityBadge(note.volatilityRank || 2);
                        const weight = getNoteWeightGrams(note.percentageOfOil);
                        const volume = getNoteVolumeMl(note.percentageOfOil);
                        const displayName = isRTL ? note.nameAr : (note.nameEn || note.nameAr);

                        return (
                          <div
                            key={note.id}
                            className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-xs hover:border-amber-400 transition-all space-y-2 group"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold flex items-center justify-center shrink-0">
                                  #{idx + 1}
                                </span>
                                <div className="truncate">
                                  <div className="text-xs font-bold text-stone-900 group-hover:text-amber-800 transition-colors">
                                    {displayName}
                                    {note.nameEn && isRTL && (
                                      <span className="text-[10px] text-stone-400 font-normal mr-1.5 font-sans">
                                        ({note.nameEn})
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                    <span className="text-[10px] text-stone-500 font-medium">
                                      {note.scentFamily}
                                    </span>
                                    <span className="text-[9px] text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                      {note.qualityGrade}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <div className="text-left font-mono-numbers">
                                  <div className="text-xs font-extrabold text-amber-900">
                                    {formatNum(weight)} g
                                  </div>
                                  <div className="text-[10px] text-stone-400">
                                    {formatNum(volume)} ml
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 bg-stone-50 px-2 py-1 rounded-lg border border-stone-200">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={note.percentageOfOil}
                                    onChange={(e) =>
                                      handleUpdateNotePct(note.id, parseFloat(e.target.value) || 0)
                                    }
                                    className="w-11 text-center font-mono-numbers text-xs font-bold text-stone-900 bg-transparent focus:outline-none"
                                  />
                                  <span className="text-[10px] font-bold text-stone-600">%</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-stone-100 text-stone-500">
                              <span className="flex items-center gap-1">
                                <span className={`px-1.5 py-0.5 rounded border text-[9px] font-semibold ${badge.bg}`}>
                                  {badge.text}
                                </span>
                                <span>{isRTL ? `مدة التبخر: ${note.evaporationTime}` : `Lifespan: ${note.evaporationTime}`}</span>
                              </span>
                              <span className="text-stone-400">
                                {note.diffusionRadius}
                              </span>
                            </div>

                            {/* Dynamic Note Activity */}
                            {(() => {
                              const activity = getNoteActivityAtMinute(note.volatilityRank || 2, currentMinutes);
                              return (
                                <div className="p-2 rounded-lg bg-stone-50 border border-stone-100 text-[10px] space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-stone-700 flex items-center gap-1">
                                      <Activity className="w-3 h-3 text-amber-600" />
                                      <span>{isRTL ? `حالة النوتة عند (${currentMinutes}د):` : `Presence at (${currentMinutes}m):`}</span>
                                    </span>
                                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${activity.statusBadgeClass}`}>
                                      {activity.statusTextAr}
                                    </span>
                                  </div>
                                  <div className="w-full bg-stone-200 h-1.5 rounded-full overflow-hidden">
                                    <div
                                      className="bg-amber-500 h-full rounded-full transition-all duration-300"
                                      style={{ width: `${activity.activePercent}%` }}
                                    />
                                  </div>
                                  <div className="flex justify-between text-stone-400 text-[9px] font-mono-numbers">
                                    <span>{isRTL ? `النشاط الشمي: ${activity.activePercent}%` : `Active: ${activity.activePercent}%`}</span>
                                    <span>{isRTL ? `المتبخر: ${activity.evaporatedPercent}%` : `Evaporated: ${activity.evaporatedPercent}%`}</span>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TIER 2 LIST: HEART NOTES */}
              {(selectedTier === 'all' || selectedTier === 'heart') && (
                <div
                  className={`p-5 rounded-2xl border transition-all space-y-4 ${
                    isHeartActive
                      ? 'bg-rose-500/10 border-rose-400 shadow-md ring-2 ring-rose-400/20'
                      : 'bg-stone-50/80 border-stone-200'
                  }`}
                >
                  <div className="flex items-center justify-between pb-3 border-b border-stone-200">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-stone-800 text-white font-extrabold text-sm flex items-center justify-center shadow-xs">
                        2
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-sm text-stone-900">
                            {t('pyramid_heart_title', 'نوتات القلب (الوسطى - Heart Notes)')}
                          </h4>
                          {isHeartActive && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-200 text-rose-950 text-[10px] font-bold animate-pulse">
                              {isRTL ? 'في ذروة الفوحان 🌸' : 'Peak Heart Bloom 🌸'}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-stone-600">
                          {isRTL
                            ? 'الزهور والتوابل والفواكه · الرائحة السائدة التي يلاحظها الجميع (2 - 6 ساعات)'
                            : 'Florals, spices, and aromatics · Signature heart perceived by everyone (2 - 6h)'}
                        </span>
                      </div>
                    </div>

                    <div className="text-left font-mono-numbers">
                      <div className="text-base font-extrabold text-stone-900">
                        {formatNum(heartPct, 1)}%
                      </div>
                      <div className="text-[10px] text-stone-500">
                        {formatNum(getNoteWeightGrams(heartPct))} g · {formatNum(getNoteVolumeMl(heartPct))} ml
                      </div>
                    </div>
                  </div>

                  {/* Notes embedded inside Heart Tier */}
                  {heartNotes.length === 0 ? (
                    <div className="text-center py-4 text-stone-400 text-xs italic">
                      {isRTL ? 'لم يتم إدراج نوتات قلب بعد.' : 'No heart notes added yet.'}
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {heartNotes.map((note, idx) => {
                        const badge = getVolatilityBadge(note.volatilityRank || 5);
                        const weight = getNoteWeightGrams(note.percentageOfOil);
                        const volume = getNoteVolumeMl(note.percentageOfOil);
                        const displayName = isRTL ? note.nameAr : (note.nameEn || note.nameAr);

                        return (
                          <div
                            key={note.id}
                            className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-xs hover:border-stone-400 transition-all space-y-2 group"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="w-5 h-5 rounded-full bg-stone-200 text-stone-900 text-[10px] font-bold flex items-center justify-center shrink-0">
                                  #{idx + 1}
                                </span>
                                <div className="truncate">
                                  <div className="text-xs font-bold text-stone-900 group-hover:text-amber-800 transition-colors">
                                    {displayName}
                                    {note.nameEn && isRTL && (
                                      <span className="text-[10px] text-stone-400 font-normal mr-1.5 font-sans">
                                        ({note.nameEn})
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                    <span className="text-[10px] text-stone-500 font-medium">
                                      {note.scentFamily}
                                    </span>
                                    <span className="text-[9px] text-stone-700 bg-stone-100 px-1.5 py-0.2 rounded border border-stone-200">
                                      {note.qualityGrade}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <div className="text-left font-mono-numbers">
                                  <div className="text-xs font-extrabold text-stone-900">
                                    {formatNum(weight)} g
                                  </div>
                                  <div className="text-[10px] text-stone-400">
                                    {formatNum(volume)} ml
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 bg-stone-50 px-2 py-1 rounded-lg border border-stone-200">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={note.percentageOfOil}
                                    onChange={(e) =>
                                      handleUpdateNotePct(note.id, parseFloat(e.target.value) || 0)
                                    }
                                    className="w-11 text-center font-mono-numbers text-xs font-bold text-stone-900 bg-transparent focus:outline-none"
                                  />
                                  <span className="text-[10px] font-bold text-stone-600">%</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-stone-100 text-stone-500">
                              <span className="flex items-center gap-1">
                                <span className={`px-1.5 py-0.5 rounded border text-[9px] font-semibold ${badge.bg}`}>
                                  {badge.text}
                                </span>
                                <span>{isRTL ? `مدة التبخر: ${note.evaporationTime}` : `Lifespan: ${note.evaporationTime}`}</span>
                              </span>
                              <span className="text-stone-400">
                                {note.diffusionRadius}
                              </span>
                            </div>

                            {/* Dynamic Activity */}
                            {(() => {
                              const activity = getNoteActivityAtMinute(note.volatilityRank || 5, currentMinutes);
                              return (
                                <div className="p-2 rounded-lg bg-stone-50 border border-stone-100 text-[10px] space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-stone-700 flex items-center gap-1">
                                      <Activity className="w-3 h-3 text-rose-600" />
                                      <span>{isRTL ? `حالة النوتة عند (${currentMinutes}د):` : `Presence at (${currentMinutes}m):`}</span>
                                    </span>
                                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${activity.statusBadgeClass}`}>
                                      {activity.statusTextAr}
                                    </span>
                                  </div>
                                  <div className="w-full bg-stone-200 h-1.5 rounded-full overflow-hidden">
                                    <div
                                      className="bg-rose-500 h-full rounded-full transition-all duration-300"
                                      style={{ width: `${activity.activePercent}%` }}
                                    />
                                  </div>
                                  <div className="flex justify-between text-stone-400 text-[9px] font-mono-numbers">
                                    <span>{isRTL ? `النشاط الشمي: ${activity.activePercent}%` : `Active: ${activity.activePercent}%`}</span>
                                    <span>{isRTL ? `المتبخر: ${activity.evaporatedPercent}%` : `Evaporated: ${activity.evaporatedPercent}%`}</span>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TIER 3 LIST: BASE NOTES */}
              {(selectedTier === 'all' || selectedTier === 'base') && (
                <div
                  className={`p-5 rounded-2xl border transition-all space-y-4 ${
                    isBaseActive
                      ? 'bg-amber-950/20 border-amber-600 shadow-md ring-2 ring-amber-600/20'
                      : 'bg-stone-900 border-stone-800 text-white'
                  }`}
                >
                  <div className="flex items-center justify-between pb-3 border-b border-stone-800">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500 text-stone-950 font-extrabold text-sm flex items-center justify-center shadow-xs">
                        3
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-sm text-amber-200">
                            {t('pyramid_base_title', 'نوتات القاعدة (الأساسية - Base Notes)')}
                          </h4>
                          {isBaseActive && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-400 text-stone-950 text-[10px] font-bold animate-pulse">
                              {isRTL ? 'رسو وثبات أسطوري ⚓' : 'Deep Anchorage ⚓'}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-stone-400">
                          {isRTL
                            ? 'أثقل الجزيئات (Macrocyclics) · أساس التثبيت والفوحان الحميم (6 - 24+ ساعة)'
                            : 'Heavy high-boiling macrocyclics · Deep foundation & intimate trail (6 - 24h+)'}
                        </span>
                      </div>
                    </div>

                    <div className="text-left font-mono-numbers">
                      <div className="text-base font-extrabold text-amber-400">
                        {formatNum(basePct, 1)}%
                      </div>
                      <div className="text-[10px] text-stone-400">
                        {formatNum(getNoteWeightGrams(basePct))} g · {formatNum(getNoteVolumeMl(basePct))} ml
                      </div>
                    </div>
                  </div>

                  {/* Notes embedded inside Base Tier */}
                  {baseNotes.length === 0 ? (
                    <div className="text-center py-4 text-stone-500 text-xs italic">
                      {isRTL ? 'لم يتم إدراج نوتات قاعدة بعد.' : 'No base notes added yet.'}
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {baseNotes.map((note, idx) => {
                        const badge = getVolatilityBadge(note.volatilityRank || 9);
                        const weight = getNoteWeightGrams(note.percentageOfOil);
                        const volume = getNoteVolumeMl(note.percentageOfOil);
                        const displayName = isRTL ? note.nameAr : (note.nameEn || note.nameAr);

                        return (
                          <div
                            key={note.id}
                            className="bg-stone-950/80 p-3.5 rounded-xl border border-stone-800 shadow-xs hover:border-amber-500/50 transition-all space-y-2 group"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="w-5 h-5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                                  #{idx + 1}
                                </span>
                                <div className="truncate">
                                  <div className="text-xs font-bold text-stone-100 group-hover:text-amber-300 transition-colors">
                                    {displayName}
                                    {note.nameEn && isRTL && (
                                      <span className="text-[10px] text-stone-400 font-normal mr-1.5 font-sans">
                                        ({note.nameEn})
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                    <span className="text-[10px] text-stone-400 font-medium">
                                      {note.scentFamily}
                                    </span>
                                    <span className="text-[9px] text-amber-400 bg-amber-950/80 px-1.5 py-0.2 rounded border border-amber-800/60">
                                      {note.qualityGrade}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <div className="text-left font-mono-numbers">
                                  <div className="text-xs font-extrabold text-amber-400">
                                    {formatNum(weight)} g
                                  </div>
                                  <div className="text-[10px] text-stone-400">
                                    {formatNum(volume)} ml
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 bg-stone-900 px-2 py-1 rounded-lg border border-stone-700">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={note.percentageOfOil}
                                    onChange={(e) =>
                                      handleUpdateNotePct(note.id, parseFloat(e.target.value) || 0)
                                    }
                                    className="w-11 text-center font-mono-numbers text-xs font-bold text-amber-300 bg-transparent focus:outline-none"
                                  />
                                  <span className="text-[10px] font-bold text-amber-400">%</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-stone-800 text-stone-400">
                              <span className="flex items-center gap-1">
                                <span className={`px-1.5 py-0.5 rounded border text-[9px] font-semibold ${badge.bg}`}>
                                  {badge.text}
                                </span>
                                <span>{isRTL ? `مدة الثبات: ${note.evaporationTime}` : `Tenacity: ${note.evaporationTime}`}</span>
                              </span>
                              <span className="text-stone-400">
                                {note.diffusionRadius}
                              </span>
                            </div>

                            {/* Dynamic Activity */}
                            {(() => {
                              const activity = getNoteActivityAtMinute(note.volatilityRank || 9, currentMinutes);
                              return (
                                <div className="p-2 rounded-lg bg-stone-900 border border-stone-800 text-[10px] space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-stone-300 flex items-center gap-1">
                                      <Activity className="w-3 h-3 text-amber-400" />
                                      <span>{isRTL ? `حالة النوتة عند (${currentMinutes}د):` : `Presence at (${currentMinutes}m):`}</span>
                                    </span>
                                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${activity.statusBadgeClass}`}>
                                      {activity.statusTextAr}
                                    </span>
                                  </div>
                                  <div className="w-full bg-stone-800 h-1.5 rounded-full overflow-hidden">
                                    <div
                                      className="bg-amber-400 h-full rounded-full transition-all duration-300"
                                      style={{ width: `${activity.activePercent}%` }}
                                    />
                                  </div>
                                  <div className="flex justify-between text-stone-500 text-[9px] font-mono-numbers">
                                    <span>{isRTL ? `النشاط الشمي: ${activity.activePercent}%` : `Active: ${activity.activePercent}%`}</span>
                                    <span>{isRTL ? `المتبخر: ${activity.evaporatedPercent}%` : `Evaporated: ${activity.evaporatedPercent}%`}</span>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: IMAGINARY POST-SPRAY EVOLUTION SCENARIO & LIVE SIMULATOR */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 space-y-6">
            
            {/* Header */}
            <div className="border-b border-stone-100 pb-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                  <Wind className="w-4 h-4 text-amber-600" />
                  <span>
                    {isRTL
                      ? 'السيناريو التخيلي: ماذا يحدث بعد رش العطر؟'
                      : 'Virtual Scenario: What happens after spraying?'}
                  </span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-mono-numbers font-medium">
                  {currentMinutes < 60
                    ? isRTL ? `${currentMinutes} دقيقة` : `${currentMinutes} mins`
                    : isRTL ? `${Math.floor(currentMinutes / 60)} ساعة و ${currentMinutes % 60} د` : `${Math.floor(currentMinutes / 60)}h ${currentMinutes % 60}m`}
                </span>
              </div>
              <p className="text-[11px] text-stone-500 mt-1">
                {isRTL
                  ? 'محاكاة حسية لرحلة تبخر الجزيئات وتناوب النوتات وتفاعلها مع كيمياء البشرة.'
                  : 'Sensory simulation of molecular evaporation, olfactory succession, and skin chemistry interaction.'}
              </p>
            </div>

            {/* Interactive Timeline Scrubber & Player Controls */}
            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200/80 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-700" />
                  <span>{isRTL ? 'المؤقت الزمني للمحاكاة:' : 'Simulation Timeline:'}</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="p-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{isPlaying ? (isRTL ? 'إيقاف' : 'Pause') : (isRTL ? 'تشغيل' : 'Play')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetSimulation}
                    className="p-1.5 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-700 transition-colors cursor-pointer"
                    title={isRTL ? 'إعادة للبداية' : 'Reset to start'}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <select
                    value={playbackSpeed}
                    onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                    className="px-2 py-1 bg-white border border-stone-300 rounded text-[10px] font-mono-numbers text-stone-800 focus:outline-none"
                  >
                    <option value={1}>1x Speed</option>
                    <option value={2}>2x Speed</option>
                    <option value={5}>5x Speed</option>
                  </select>
                </div>
              </div>

              {/* Slider Scrubber */}
              <div className="space-y-1">
                <input
                  type="range"
                  min="0"
                  max="720"
                  step="5"
                  value={currentMinutes}
                  onChange={(e) => {
                    setIsPlaying(false);
                    setCurrentMinutes(Number(e.target.value));
                  }}
                  className="w-full accent-amber-600 cursor-pointer h-2 bg-stone-200 rounded-lg appearance-none"
                />
                <div className="flex justify-between text-[9px] text-stone-400 font-mono-numbers">
                  <span>0m ({isRTL ? 'الرش' : 'Spray'})</span>
                  <span>1h</span>
                  <span>4h</span>
                  <span>8h</span>
                  <span>12h+</span>
                </div>
              </div>

              {/* Quick Jump Buttons */}
              <div className="grid grid-cols-5 gap-1 pt-1">
                {stages.map((stg) => (
                  <button
                    key={stg.id}
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setCurrentMinutes(stg.timeMinutes);
                    }}
                    className={`p-1 rounded text-[9px] text-center transition-all cursor-pointer truncate ${
                      activeStage.id === stg.id
                        ? 'bg-amber-700 text-white font-bold shadow-xs'
                        : 'bg-white border border-stone-200 text-stone-600 hover:bg-amber-50'
                    }`}
                  >
                    {stg.timeMinutes === 0
                      ? isRTL ? 'الرش' : '0m'
                      : stg.timeMinutes < 60
                      ? `${stg.timeMinutes}m`
                      : `${Math.round(stg.timeMinutes / 60)}h`}
                  </button>
                ))}
              </div>

              {/* Fine Control Steppers */}
              <div className="flex items-center justify-between gap-1 pt-2 border-t border-stone-200/60 text-[10px]">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setCurrentMinutes((prev) => Math.max(0, prev - 15));
                    }}
                    className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-mono transition-colors cursor-pointer border border-stone-200"
                  >
                    -15m
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setCurrentMinutes((prev) => Math.min(720, prev + 15));
                    }}
                    className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-mono transition-colors cursor-pointer border border-stone-200"
                  >
                    +15m
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setCurrentMinutes((prev) => Math.min(720, prev + 60));
                    }}
                    className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-mono transition-colors cursor-pointer border border-stone-200"
                  >
                    +60m
                  </button>
                </div>
                <span className="text-[10px] text-stone-500 font-mono">
                  {isRTL
                    ? `الوقت الفعلي: ${currentMinutes < 60 ? `${currentMinutes} دقيقة` : `${Math.floor(currentMinutes / 60)}س و ${currentMinutes % 60}د`}`
                    : `Elapsed: ${currentMinutes < 60 ? `${currentMinutes} mins` : `${Math.floor(currentMinutes / 60)}h ${currentMinutes % 60}m`}`}
                </span>
              </div>
            </div>

            {/* DYNAMIC SCENARIO STAGE DISPLAY CARD */}
            <div className="space-y-4">
              
              {/* Stage Badge & Title */}
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                    {isRTL ? activeStage.timeLabelAr : (activeStage.timeLabelEn || activeStage.timeLabelAr)}
                  </span>
                  <span className="text-[10px] text-stone-500 font-semibold">
                    {isRTL ? 'المرحلة: ' : 'Phase: '}
                    {activeStage.dominantPhase === 'top'
                      ? isRTL ? 'القمة' : 'Top Notes'
                      : activeStage.dominantPhase === 'heart'
                      ? isRTL ? 'القلب' : 'Heart Notes'
                      : isRTL ? 'القاعدة والجفاف' : 'Base & Drydown'}
                  </span>
                </div>

                <h4 className="font-bold text-stone-900 text-sm font-serif-luxury">
                  {isRTL ? activeStage.stageNameAr : (activeStage.stageNameEn || activeStage.stageNameAr)}
                </h4>
                <p className="text-[11px] text-amber-900/90 font-medium">
                  {isRTL ? activeStage.stageSubtitleAr : (activeStage.stageSubtitleEn || activeStage.stageSubtitleAr)}
                </p>
              </div>

              {/* Live Sillage & Projection Meter */}
              <div className="space-y-2 p-3.5 rounded-xl bg-stone-50 border border-stone-200">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-amber-700" />
                    <span>{isRTL ? 'مؤشر الفوحان والانتشار (Sillage):' : 'Sillage & Projection Metric:'}</span>
                  </span>
                  <span className="font-bold text-amber-900 text-[11px]">
                    {isRTL ? activeStage.sillageRating : (activeStage.sillageRatingEn || activeStage.sillageRating)} ({activeStage.sillagePercent}%)
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-stone-200 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-700 transition-all duration-300"
                    style={{ width: `${activeStage.sillagePercent}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-[10px] text-stone-500 pt-0.5">
                  <span>
                    {isRTL ? `الأثر على الجلد: ${activeStage.skinAdhesionPercent}% متبقٍ` : `Skin adhesion: ${activeStage.skinAdhesionPercent}% remaining`}
                  </span>
                  <span>
                    {isRTL ? activeStage.evaporationStateAr : (activeStage.evaporationStateEn || activeStage.evaporationStateAr)}
                  </span>
                </div>
              </div>

              {/* Visual Scent Radius Radar Aura Graphic */}
              <div className="bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950 rounded-2xl p-4 border border-stone-800 text-white space-y-3 relative overflow-hidden shadow-inner">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-300 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5" />
                    <span>{isRTL ? 'رادار ومحيط انتشار الرائحة (Scent Aura Radar)' : 'Scent Sillage Aura Radar'}</span>
                  </span>
                  <span className="font-mono-numbers text-xs text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded-lg border border-amber-800/80 font-bold">
                    {currentMinutes === 0
                      ? isRTL ? 'محيط الفوحان: ~3.0 أمتار' : 'Projection Radius: ~3.0 meters'
                      : currentMinutes <= 30
                      ? isRTL ? 'محيط الفوحان: ~2.0 أمتار' : 'Projection Radius: ~2.0 meters'
                      : currentMinutes <= 120
                      ? isRTL ? 'محيط الفوحان: ~1.2 أمتار' : 'Projection Radius: ~1.2 meters'
                      : currentMinutes <= 360
                      ? isRTL ? 'محيط الفوحان: ~0.5 متر' : 'Projection Radius: ~0.5 meter'
                      : isRTL ? 'ملاصق للبشرة (~0.1 م)' : 'Skin-Close (~0.1m)'}
                  </span>
                </div>

                {/* Animated Radar concentric circles */}
                <div className="relative w-40 h-40 mx-auto flex items-center justify-center my-1 select-none">
                  {/* Outer Ring 3m */}
                  <div
                    className={`absolute w-40 h-40 rounded-full border border-dashed transition-all duration-700 flex items-center justify-center ${
                      activeStage.sillagePercent >= 85
                        ? 'border-amber-400/60 bg-amber-500/10 shadow-lg shadow-amber-500/20'
                        : 'border-stone-800/50'
                    }`}
                  >
                    <span className="absolute top-1 text-[8px] text-stone-500 font-mono">3.0m</span>
                  </div>

                  {/* Middle Ring 1.5m */}
                  <div
                    className={`absolute w-28 h-28 rounded-full border border-dashed transition-all duration-700 flex items-center justify-center ${
                      activeStage.sillagePercent >= 60
                        ? 'border-amber-400/80 bg-amber-400/15 shadow-md shadow-amber-400/20'
                        : 'border-stone-800/60'
                    }`}
                  >
                    <span className="absolute top-1 text-[8px] text-stone-400 font-mono">1.5m</span>
                  </div>

                  {/* Inner Intimate Ring 0.5m */}
                  <div
                    className={`absolute w-16 h-16 rounded-full border border-dashed transition-all duration-700 flex items-center justify-center ${
                      activeStage.sillagePercent >= 35
                        ? 'border-amber-300 bg-amber-300/20'
                        : 'border-stone-800'
                    }`}
                  >
                    <span className="absolute top-0.5 text-[8px] text-stone-400 font-mono">0.5m</span>
                  </div>

                  {/* Center Silhouette */}
                  <div className="relative z-10 w-9 h-9 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 text-stone-950 font-bold text-xs flex items-center justify-center shadow-lg shadow-amber-500/50 border border-amber-200">
                    👤
                  </div>
                </div>

                <div className="flex items-center justify-between text-[9px] text-stone-400 pt-1 border-t border-stone-800 font-mono">
                  <span>3m ({isRTL ? 'انفجاري' : 'Burst'})</span>
                  <span>1.5m ({isRTL ? 'واسع' : 'Wide'})</span>
                  <span>0.5m ({isRTL ? 'حميمي' : 'Intimate'})</span>
                  <span>0.1m ({isRTL ? 'ملاصق' : 'Skin'})</span>
                </div>
              </div>

              {/* Narrative 1: What happens */}
              <div className="space-y-1.5 p-3.5 rounded-xl bg-white border border-stone-200/90">
                <span className="text-[11px] font-bold text-stone-900 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-600" />
                  <span>{isRTL ? 'ماذا يحدث كيميائياً وفي الأجواء؟' : 'What happens chemically & in the air?'}</span>
                </span>
                <p className="text-xs text-stone-700 leading-relaxed">
                  {isRTL ? activeStage.whatHappensTextAr : (activeStage.whatHappensTextEn || activeStage.whatHappensTextAr)}
                </p>
              </div>

              {/* Narrative 2: Olfactory Perception */}
              <div className="space-y-1.5 p-3.5 rounded-xl bg-stone-900 text-white border border-stone-800">
                <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>
                    {isRTL
                      ? 'الانطباع الشمي للمحيطين بك (ما يشمه الأنف الآن):'
                      : 'Olfactory Perception (What observers perceive):'}
                  </span>
                </span>
                <p className="text-xs text-stone-200 leading-relaxed">
                  {isRTL
                    ? activeStage.olfactoryPerceptionTextAr
                    : (activeStage.olfactoryPerceptionTextEn || activeStage.olfactoryPerceptionTextAr)}
                </p>
              </div>

              {/* Perfumer Advice Box */}
              <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-xs text-amber-950 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-900 block text-[11px]">
                    {isRTL ? 'نصيحة العطار لهذه المرحلة:' : 'Master Perfumer Advice for this phase:'}
                  </span>
                  <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                    {isRTL ? activeStage.adviceForWearerAr : (activeStage.adviceForWearerEn || activeStage.adviceForWearerAr)}
                  </p>
                </div>
              </div>

            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
