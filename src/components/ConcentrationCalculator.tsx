import React, { useState } from 'react';
import {
  Beaker,
  Scale,
  Sparkles,
  Droplets,
  Layers,
  HelpCircle,
  BookmarkPlus,
  DollarSign,
  Info,
  Check,
  Wind,
  BookOpen,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Lightbulb,
  ExternalLink,
  Sliders,
  Hourglass,
  Calendar,
  Bot,
} from 'lucide-react';
import {
  CalculationResult,
  ConcentrationType,
  FormulationState,
  PyramidNote,
  SavedFormula,
} from '../types/perfume';
import { SupportedLanguage } from '../types/i18n';
import {
  BOTTLE_SIZE_PRESETS,
  CONCENTRATION_PRESETS,
} from '../data/presets';
import { formatNum } from '../utils/calculations';
import { useLanguage } from '../context/LanguageContext';
import { FragrancePyramidGraphic } from './FragrancePyramidGraphic';
import { CalculatorCriteriaGuide } from './CalculatorCriteriaGuide';
import { VisualScaleSimulator } from './VisualScaleSimulator';

interface ConcentrationCalculatorProps {
  formulation: FormulationState;
  setFormulation: React.Dispatch<React.SetStateAction<FormulationState>>;
  result: CalculationResult;
  onSaveFormula: () => void;
  onSendToCosting: () => void;
  pyramidNotes?: PyramidNote[];
  setPyramidNotes?: React.Dispatch<React.SetStateAction<PyramidNote[]>>;
  onNavigateToTab?: (tab: string) => void;
  currentLang?: SupportedLanguage;
  currencyCode?: string;
  macerationDays?: number;
  setMacerationDays?: React.Dispatch<React.SetStateAction<number>>;
}

export const ConcentrationCalculator: React.FC<ConcentrationCalculatorProps> = ({
  formulation,
  setFormulation,
  result,
  onSaveFormula,
  onSendToCosting,
  pyramidNotes = [],
  setPyramidNotes,
  onNavigateToTab,
  currentLang: propLang,
  currencyCode: propCurrency,
  macerationDays = 30,
  setMacerationDays,
}) => {
  const { currentLang: ctxLang, t } = useLanguage();
  const effectiveLang = propLang || ctxLang || 'ar';
  const isRTL = effectiveLang === 'ar' || effectiveLang === 'fa';
  const activeCurrency = propCurrency || formulation.currency || 'SAR';

  // Navigation inside the calculator: formulation, graphic pyramid, criteria guide, or visual scale simulator
  const [activeView, setActiveView] = useState<
    'formulation' | 'pyramid_graphic' | 'criteria_guide' | 'scale_simulator'
  >('formulation');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [showPriceConfig, setShowPriceConfig] = useState(false);
  const [isLiveScaleTared, setIsLiveScaleTared] = useState(false);

  // Raw Materials Benchmark Pricing (Live Real-Time Cost Calculation)
  const [oilPricePerKg, setOilPricePerKg] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('miyaar_perfume_default_oil_price');
      return saved ? parseFloat(saved) || 250 : 250;
    } catch {
      return 250;
    }
  });
  const [alcoholPricePerLiter, setAlcoholPricePerLiter] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('miyaar_perfume_default_alc_price');
      return saved ? parseFloat(saved) || 35 : 35;
    } catch {
      return 35;
    }
  });
  const [fixativePricePerKg, setFixativePricePerKg] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('miyaar_perfume_default_fix_price');
      return saved ? parseFloat(saved) || 85 : 85;
    } catch {
      return 85;
    }
  });
  const [waterPricePerLiter, setWaterPricePerLiter] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('miyaar_perfume_default_water_price');
      return saved ? parseFloat(saved) || 5 : 5;
    } catch {
      return 5;
    }
  });

  const handleUpdatePrice = (
    key: 'oil' | 'alcohol' | 'fixative' | 'water',
    val: number
  ) => {
    const num = Math.max(0, val);
    if (key === 'oil') {
      setOilPricePerKg(num);
      try { localStorage.setItem('miyaar_perfume_default_oil_price', num.toString()); } catch {}
    } else if (key === 'alcohol') {
      setAlcoholPricePerLiter(num);
      try { localStorage.setItem('miyaar_perfume_default_alc_price', num.toString()); } catch {}
    } else if (key === 'fixative') {
      setFixativePricePerKg(num);
      try { localStorage.setItem('miyaar_perfume_default_fix_price', num.toString()); } catch {}
    } else if (key === 'water') {
      setWaterPricePerLiter(num);
      try { localStorage.setItem('miyaar_perfume_default_water_price', num.toString()); } catch {}
    }
  };

  // Real-time raw material costs derived instantly from current formulation state
  const rawCostOil = (result.oilWeightGrams / 1000) * oilPricePerKg;
  const rawCostAlcohol = (result.alcoholVolumeMl / 1000) * alcoholPricePerLiter;
  const rawCostFixative = (result.fixativeWeightGrams / 1000) * fixativePricePerKg;
  const rawCostWater = (result.waterVolumeMl / 1000) * waterPricePerLiter;
  const rawCostTotalSingle = rawCostOil + rawCostAlcohol + rawCostFixative + rawCostWater;
  const rawCostTotalBatch = rawCostTotalSingle * Math.max(1, formulation.batchCount || 1);

  // Quick accordion explanations for each input criterion
  const [expandedCriteria, setExpandedCriteria] = useState<Record<string, boolean>>({});

  const toggleCriterion = (id: string) => {
    setExpandedCriteria((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleBottleSizeSelect = (ml: number) => {
    setFormulation((prev) => ({ ...prev, bottleVolumeMl: ml }));
  };

  const handleConcentrationTypeSelect = (preset: (typeof CONCENTRATION_PRESETS)[0]) => {
    setFormulation((prev) => ({
      ...prev,
      concentrationType: preset.id,
      concentrationPercent: preset.defaultPercentage,
    }));
  };

  const copyRecipeToClipboard = () => {
    const text = isRTL
      ? `📌 تركيبة عطرية - معيار شام
الحجم: ${formulation.bottleVolumeMl} مل | التركيز: ${formulation.concentrationPercent}%
الزيت العطري: ${formatNum(result.oilWeightGrams)} جم (${formatNum(result.oilVolumeMl)} مل)
الكحول الإيثيلي: ${formatNum(result.alcoholWeightGrams)} جم (${formatNum(result.alcoholVolumeMl)} مل)
${result.waterVolumeMl > 0 ? `الماء المقطر: ${formatNum(result.waterWeightGrams)} جم (${formatNum(result.waterVolumeMl)} مل)\n` : ''}${result.fixativeVolumeMl > 0 ? `المثبت: ${formatNum(result.fixativeWeightGrams)} جم (${formatNum(result.fixativeVolumeMl)} مل)\n` : ''}الوزن الإجمالي للزجاجة: ${formatNum(result.totalWeightGrams)} جم`
      : `📌 Fragrance Formulation - Sham Standard
Volume: ${formulation.bottleVolumeMl}ml | Concentration: ${formulation.concentrationPercent}%
Fragrance Oil: ${formatNum(result.oilWeightGrams)}g (${formatNum(result.oilVolumeMl)}ml)
Ethanol: ${formatNum(result.alcoholWeightGrams)}g (${formatNum(result.alcoholVolumeMl)}ml)
${result.waterVolumeMl > 0 ? `Distilled Water: ${formatNum(result.waterWeightGrams)}g (${formatNum(result.waterVolumeMl)}ml)\n` : ''}${result.fixativeVolumeMl > 0 ? `Fixative: ${formatNum(result.fixativeWeightGrams)}g (${formatNum(result.fixativeVolumeMl)}ml)\n` : ''}Net Batch Total: ${formatNum(result.totalWeightGrams)}g`;

    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Section Header with View Mode Switcher */}
      <div className="border-b border-stone-200/80 pb-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold border border-amber-200 mb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-700" />
            <span>
              {isRTL ? 'معمل معيار شام لدقة صناعة العطور' : 'Sham Perfumery Laboratory Standard'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-stone-900 font-serif-luxury">
            {t('calc_title', 'حاسبة نسب التركيز، جرافيك الهرم، ودليل المعايير')}
          </h2>
          <p className="text-stone-500 text-sm mt-1">
            {t('calc_subtitle', 'حدد حجم الزجاجة والتركيز بدقة الميزان (0.01g)، واكتشف جرافيك الهرم التفاعلي وسيناريو ما بعد الرش، واقرأ شرح كل معيار علمياً.')}
          </p>
        </div>

        {/* View Mode Tabs Switcher */}
        <div className="inline-flex p-1 bg-stone-100/90 rounded-2xl border border-stone-200 text-xs font-semibold shrink-0 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveView('formulation')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeView === 'formulation'
                ? 'bg-stone-900 text-white shadow-xs font-bold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Beaker className="w-3.5 h-3.5 text-amber-400" />
            <span>{t('calc_tab_formulation', '🧪 مقادير التركيب وتعبئة الزجاجات')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('pyramid_graphic')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeView === 'pyramid_graphic'
                ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-xs font-bold'
                : 'text-amber-800 hover:text-amber-950 font-bold bg-amber-500/10'
            }`}
          >
            <Wind className="w-3.5 h-3.5" />
            <span>{t('calc_tab_pyramid', '🔺 جرافيك الهرم وسيناريو الرش 💨')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('criteria_guide')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeView === 'criteria_guide'
                ? 'bg-amber-900 text-white shadow-xs font-bold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-500" />
            <span>{t('calc_tab_criteria', '📚 شرح جميع معايير الحاسبة')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('scale_simulator')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeView === 'scale_simulator'
                ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-xs font-bold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Scale className="w-3.5 h-3.5 text-amber-400" />
            <span>{isRTL ? '⚖️ محاكاة وزن المواد والميزان' : '⚖️ Visual Scale Simulator'}</span>
          </button>
        </div>
      </div>

      {/* VIEW: VISUAL SCALE SIMULATOR */}
      {activeView === 'scale_simulator' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-gradient-to-r from-stone-900 via-amber-950 to-stone-900 p-4 sm:p-5 rounded-2xl text-white flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm border border-amber-600/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-lg border border-amber-500/40">
                ⚖️
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-amber-100">
                  {isRTL
                    ? 'المحاكي البصري لوزن المواد الخام وميزان المعمل الرقمي (0.01g)'
                    : 'Visual Laboratory Balance & Raw Materials Compounding Simulator'}
                </h3>
                <p className="text-xs text-stone-300 mt-0.5">
                  {isRTL
                    ? 'محاكاة حية لميزان المعمل، وزن الزيوت والكحول والمثبتات بالجرام والقطرات خطوة بخطوة مع تعبئة المخبار.'
                    : 'Real-time step-by-step weighing walkthrough on digital balance pan (0.01g) with liquid beaker simulation.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveView('formulation')}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-white/10"
              >
                {isRTL ? 'العودة لحاسبة التركيب ←' : 'Back to Formulation ←'}
              </button>
            </div>
          </div>

          <VisualScaleSimulator
            formulation={formulation}
            result={result}
            pyramidNotes={pyramidNotes}
            currentLang={effectiveLang}
          />
        </div>
      )}

      {/* VIEW 1: GRAPHIC FRAGRANCE PYRAMID & SPRAY EVOLUTION */}
      {activeView === 'pyramid_graphic' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-gradient-to-r from-stone-900 via-amber-950 to-stone-900 p-4 sm:p-5 rounded-2xl text-white flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm border border-amber-600/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-lg border border-amber-500/40">
                🔺
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-amber-100">
                  {isRTL
                    ? 'جرافيك الهرم العطري التفاعلي ومحاكي سيناريو ما بعد الرش'
                    : 'Interactive Olfactory Pyramid & Virtual Post-Spray Simulator'}
                </h3>
                <p className="text-xs text-stone-300 mt-0.5">
                  {isRTL
                    ? 'هرم ثلاثي الأبعاد مصنف بترتيب سرعة الطيران (1 إلى 10)، نسب النوتات الدقيقة، ومؤشر الفوحان دقيقة بدقيقة.'
                    : '3D geometric pyramid classified by volatility rank (1 to 10), precise mass ratios, and minute-by-minute sillage tracker.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveView('formulation')}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-white/10"
              >
                {isRTL ? 'العودة لمقادير الحاسبة ←' : 'Return to Calculator ←'}
              </button>
            </div>
          </div>

          <FragrancePyramidGraphic
            pyramidNotes={pyramidNotes}
            setPyramidNotes={setPyramidNotes || (() => {})}
            result={result}
            bottleVolumeMl={formulation.bottleVolumeMl}
            concentrationPercent={formulation.concentrationPercent}
            currentLang={effectiveLang}
          />
        </div>
      )}

      {/* VIEW 2: COMPREHENSIVE CRITERIA GUIDE */}
      {activeView === 'criteria_guide' && (
        <div className="space-y-6 animate-in fade-in">
          <CalculatorCriteriaGuide
            onClose={() => setActiveView('formulation')}
            currentLang={effectiveLang}
          />
        </div>
      )}

      {/* VIEW 3: CORE FORMULATION CALCULATOR (DEFAULT) */}
      {activeView === 'formulation' && (
        <div className="space-y-6 animate-in fade-in">

          {/* Quick Notice Banner with Direct Switch to Pyramid Graphic */}
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-600/15 to-amber-700/10 border border-amber-300/80 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold text-base shrink-0 shadow-xs">
                🔺
              </div>
              <div className={isRTL ? 'text-right' : 'text-left'}>
                <span className="text-xs sm:text-sm font-bold text-amber-950 block">
                  {isRTL
                    ? 'هل تريد رؤية جرافيك الهرم وسيناريو ما بعد الرش لحظة بلحظة لهذه التركيبة؟'
                    : 'Inspect the live Fragrance Pyramid and virtual spray simulation scenario for this formula?'}
                </span>
                <span className="text-[11px] text-stone-600">
                  {isRTL
                    ? 'انقر لعرض الرسم الهرمي التفاعلي ثلاثي الطبقات ومحاكاة التبخر من دقيقة الصفر حتى 18+ ساعة.'
                    : 'Click to inspect the 3-tier interactive pyramid and real-time volatilization curve from 0m to 24h.'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveView('pyramid_graphic')}
                className="px-4 py-2 bg-gradient-to-r from-amber-700 to-amber-800 hover:from-amber-800 hover:to-amber-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Wind className="w-3.5 h-3.5 text-amber-200" />
                <span>{isRTL ? 'فتح جرافيك الهرم التفاعلي 💨' : 'Open Interactive Pyramid 💨'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Form Controls & Inputs with In-Depth Criteria Explanations */}
            <div className="lg:col-span-7 space-y-6">

              {/* 1. Bottle Size Selection */}
              <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-bold text-stone-900 flex items-center gap-2">
                      <Beaker className="w-4 h-4 text-amber-700" />
                      <span>{t('bottle_volume', 'حجم زجاجة العطر المستهدفة')}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => toggleCriterion('bottle_volume')}
                      className="px-2 py-0.5 rounded-full bg-amber-50 hover:bg-amber-100 border border-amber-300 text-[10px] font-bold text-amber-900 flex items-center gap-1 cursor-pointer transition-colors"
                      title={isRTL ? 'اقرأ شرح معيار حجم الزجاجة والفراغ الهوائي' : 'Read bottle volume & headspace guide'}
                    >
                      <HelpCircle className="w-3 h-3 text-amber-700" />
                      <span>{isRTL ? 'شرح المعيار' : 'Criterion Guide'}</span>
                      {expandedCriteria['bottle_volume'] ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                    </button>
                  </div>
                  <div className="text-xs text-stone-500">
                    {isRTL ? 'الحجم الحالي: ' : 'Current: '}
                    <span className="font-bold text-stone-900 font-mono-numbers">{formulation.bottleVolumeMl} ml</span>
                  </div>
                </div>

                {/* Inline Criterion Educational Box */}
                {expandedCriteria['bottle_volume'] && (
                  <div className="p-3.5 bg-amber-50/80 rounded-xl border border-amber-200 text-xs text-stone-800 space-y-1.5 animate-in fade-in">
                    <div className="font-bold text-amber-950 flex items-center gap-1.5">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-700" />
                      <span>{isRTL ? 'معيار الحجم والفراغ الهوائي (Headspace Standard):' : 'Bottle Volume & Headspace Margin Standard:'}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-stone-700">
                      {isRTL
                        ? '• السعة الحجمية: تحدد بدقة كتلة الزيت والكحول والماء الواجب وزنها. • قاعدة الفراغ الهوائي: اترك دائماً فراغاً بنسبة 3% إلى 5% في أعلى الزجاجة لامتصاص تمدد السائل الناتج عن حرارة الجو، ولضمان عمل أنبوب البخاخ دون ضغط مفرط.'
                        : '• Nominal Capacity: Accurately defines the gravimetric mass of oil, alcohol, and fixatives to weigh. • Headspace Rule: Always preserve a 3% to 5% air gap to absorb thermal expansion and ensure leak-free atomizer performance.'}
                    </p>
                  </div>
                )}

                {/* Presets Grid */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {BOTTLE_SIZE_PRESETS.map((preset) => (
                    <button
                      key={preset.ml}
                      type="button"
                      onClick={() => handleBottleSizeSelect(preset.ml)}
                      className={`py-2 px-1 text-center rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        formulation.bottleVolumeMl === preset.ml
                          ? 'bg-amber-900 text-amber-100 shadow-xs ring-1 ring-amber-700 font-bold'
                          : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200'
                      }`}
                    >
                      <span className="block font-bold font-mono-numbers">{preset.ml} ml</span>
                      <span className="text-[10px] opacity-75 block truncate">
                        {isRTL ? preset.labelAr : preset.labelEn}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Custom Bottle Slider */}
                <div className="pt-2">
                  <div className="flex justify-between text-xs text-stone-500 mb-1">
                    <span>{isRTL ? 'تخصيص حجم يدوي' : 'Custom Volume Slider'}</span>
                    <span className="font-mono-numbers text-stone-900 font-bold">{formulation.bottleVolumeMl} ml</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="500"
                    step="5"
                    value={formulation.bottleVolumeMl}
                    onChange={(e) =>
                      setFormulation((prev) => ({
                        ...prev,
                        bottleVolumeMl: parseInt(e.target.value) || 50,
                      }))
                    }
                    className="w-full accent-amber-800 cursor-pointer"
                  />
                </div>
              </div>

              {/* 2. Concentration Selection */}
              <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-bold text-stone-900 flex items-center gap-2">
                      <Scale className="w-4 h-4 text-amber-700" />
                      <span>{t('target_concentration', 'نسبة تركيز الزيت المستهدفة (%)')}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => toggleCriterion('concentration')}
                      className="px-2 py-0.5 rounded-full bg-amber-50 hover:bg-amber-100 border border-amber-300 text-[10px] font-bold text-amber-900 flex items-center gap-1 cursor-pointer transition-colors"
                      title={isRTL ? 'اقرأ شرح معيار نسب التركيز' : 'Read concentration grade guide'}
                    >
                      <HelpCircle className="w-3 h-3 text-amber-700" />
                      <span>{isRTL ? 'شرح المعيار' : 'Criterion Guide'}</span>
                      {expandedCriteria['concentration'] ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                    </button>
                  </div>
                  <div className="text-xs text-stone-500">
                    {isRTL ? 'التركيز الحالي: ' : 'Current: '}
                    <span className="font-bold text-amber-800 font-mono-numbers text-sm">
                      {formulation.concentrationPercent}%
                    </span>
                  </div>
                </div>

                {/* Inline Criterion Educational Box */}
                {expandedCriteria['concentration'] && (
                  <div className="p-3.5 bg-amber-50/80 rounded-xl border border-amber-200 text-xs text-stone-800 space-y-1.5 animate-in fade-in">
                    <div className="font-bold text-amber-950 flex items-center gap-1.5">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-700" />
                      <span>{isRTL ? 'معيار التركيز العطري الدولي (Fragrance Concentration Standard):' : 'International Fragrance Concentration Standard:'}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-stone-700">
                      {isRTL
                        ? '• Extrait (25%-35%): ثبات أقصى 12-24 ساعة مع فوحان حميمي. • EDP (15%-22%): التوازن المعياري العالمي للثبات والانتشار. • EDT (10%-14%): انتعاش يومي فواح. قاعدة ذهبية: لا تزد التركيز فوق 35% تجنباً لكتم الفوحان.'
                        : '• Extrait (25%-35%): Maximum 12-24h longevity with royal intimate presence. • EDP (15%-22%): The benchmark balance of longevity and sillage. • EDT (10%-14%): Fresh daily sillage. Golden Rule: Never exceed 35% to avoid suppressing air diffusion.'}
                    </p>
                  </div>
                )}

                {/* Concentration Presets Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {CONCENTRATION_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleConcentrationTypeSelect(preset)}
                      className={`p-3 text-right rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        formulation.concentrationType === preset.id
                          ? 'bg-amber-950 text-white border-amber-800 shadow-sm'
                          : 'bg-stone-50 hover:bg-stone-100 text-stone-800 border-stone-200'
                      }`}
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="font-bold text-xs">
                          {isRTL ? preset.nameAr : preset.nameEn}
                        </span>
                        <span
                          className={`text-xs font-mono-numbers font-bold px-1.5 py-0.5 rounded ${
                            formulation.concentrationType === preset.id
                              ? 'bg-amber-800 text-amber-200'
                              : 'bg-stone-200 text-stone-700'
                          }`}
                        >
                          {preset.defaultPercentage}%
                        </span>
                      </div>
                      <span className="text-[10px] text-stone-400 mt-1 block truncate">
                        {isRTL ? preset.descriptionAr : preset.descriptionEn}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Custom Concentration Slider */}
                <div className="pt-2">
                  <div className="flex justify-between text-xs text-stone-500 mb-1">
                    <span>{isRTL ? 'تعديل النسبة بدقة (1% إلى 50%)' : 'Fine Adjustment (1% to 50%)'}</span>
                    <span className="font-mono-numbers text-stone-900 font-bold">{formulation.concentrationPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    step="0.5"
                    value={formulation.concentrationPercent}
                    onChange={(e) =>
                      setFormulation((prev) => ({
                        ...prev,
                        concentrationPercent: parseFloat(e.target.value) || 20,
                        concentrationType: 'custom',
                      }))
                    }
                    className="w-full accent-amber-800 cursor-pointer"
                  />
                </div>

                {/* Visual Real-Time Raw Materials Weight Simulation Banner */}
                <div className="mt-3 p-3.5 bg-gradient-to-br from-amber-50 to-stone-50 border border-amber-200/90 rounded-xl space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-950 flex items-center gap-1.5">
                      <Scale className="w-4 h-4 text-amber-700 animate-pulse" />
                      <span>{isRTL ? 'محاكاة وزن المواد الخام اللحظية (دقة 0.01g)' : 'Live Raw Materials Scale Simulation (0.01g)'}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100/90 text-[10px] font-mono-numbers font-bold text-amber-900 border border-amber-300/70">
                      <span>{isRTL ? 'صافي الزجاجة:' : 'Net:'}</span>
                      <strong className="text-amber-950 font-extrabold">{formatNum(result.totalWeightGrams)} g</strong>
                    </span>
                  </div>

                  {/* Real-time Weight Chips per Material */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-white border border-amber-200/90 shadow-2xs">
                      <div className="text-[10px] font-bold text-amber-800 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-600 inline-block" />
                        <span>{isRTL ? 'الزيت العطري' : 'Oil Mass'}</span>
                      </div>
                      <div className="font-mono-numbers font-black text-amber-950 text-sm mt-0.5">
                        {formatNum(result.oilWeightGrams)} g
                      </div>
                      <div className="text-[10px] text-amber-700/80 font-mono-numbers">
                        {formatNum(result.oilVolumeMl)} ml · ~{Math.round(result.oilWeightGrams * 24)} {isRTL ? 'قطرة' : 'drops'}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white border border-stone-200 shadow-2xs">
                      <div className="text-[10px] font-bold text-stone-700 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-stone-400 inline-block" />
                        <span>{isRTL ? 'الكحول الإيثيلي' : 'Ethanol Mass'}</span>
                      </div>
                      <div className="font-mono-numbers font-black text-stone-900 text-sm mt-0.5">
                        {formatNum(result.alcoholWeightGrams)} g
                      </div>
                      <div className="text-[10px] text-stone-500 font-mono-numbers">
                        {formatNum(result.alcoholVolumeMl)} ml
                      </div>
                    </div>

                    {result.fixativeWeightGrams > 0 ? (
                      <div className="p-2.5 rounded-lg bg-white border border-emerald-200 shadow-2xs">
                        <div className="text-[10px] font-bold text-emerald-800 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
                          <span>{isRTL ? 'المثبت العطري' : 'Fixative Mass'}</span>
                        </div>
                        <div className="font-mono-numbers font-black text-emerald-950 text-sm mt-0.5">
                          {formatNum(result.fixativeWeightGrams)} g
                        </div>
                        <div className="text-[10px] text-emerald-600/80 font-mono-numbers">
                          {formatNum(result.fixativeVolumeMl)} ml
                        </div>
                      </div>
                    ) : (
                      <div className="p-2 rounded-lg bg-stone-100/70 border border-stone-200 text-stone-400 flex flex-col justify-center text-[10px]">
                        <span className="font-semibold">{isRTL ? 'المثبت: 0 جم' : 'Fixative: 0g'}</span>
                        <span className="text-[9px] text-stone-400">{isRTL ? '(اختياري)' : '(Optional)'}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-1 flex items-center justify-between border-t border-amber-200/50">
                    <span className="text-[10px] text-stone-500">
                      {isRTL
                        ? 'تحديث لحظي لجرامات المواد مع سحب مؤشر النسبة'
                        : 'Real-time gram adjustment as concentration changes'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveView('scale_simulator')}
                      className="text-[11px] text-amber-800 font-bold hover:text-amber-950 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>{isRTL ? 'المحاكي التفاعلي الموسع ⚖️' : 'Full Simulator ⚖️'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. Alcohol Purity and Batch Count */}
              <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Alcohol Purity */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-stone-900 flex items-center gap-1">
                        <Droplets className="w-3.5 h-3.5 text-amber-700" />
                        <span>{t('alcohol_purity', 'درجة نقاء الكحول (% ABV)')}</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => toggleCriterion('alcohol_purity')}
                        className="text-[10px] text-amber-800 font-bold hover:underline cursor-pointer"
                      >
                        [؟]
                      </button>
                    </div>
                    <select
                      value={formulation.alcoholPercentage}
                      onChange={(e) =>
                        setFormulation((prev) => ({
                          ...prev,
                          alcoholPercentage: parseInt(e.target.value) || 96,
                        }))
                      }
                      className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 font-semibold focus:outline-none"
                    >
                      <option value={96}>{isRTL ? '96% - إيثانول عضوي فاخر (المعيار الدولي)' : '96% - Cosmetic Perfumers Ethanol (Global Standard)'}</option>
                      <option value={99}>{isRTL ? '99% - إيثانول مطلق خالي من الماء تماماً' : '99% - Anhydrous Absolute Ethanol'}</option>
                      <option value={95}>{isRTL ? '95% - كحول تقطير زراعي قياسي' : '95% - Agricultural Distilled Alcohol'}</option>
                    </select>
                    {expandedCriteria['alcohol_purity'] && (
                      <div className="p-2.5 mt-2 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-950 leading-relaxed">
                        {isRTL
                          ? 'الكحول 96% هو الأنسب لإذابة الزيوت دون تعكر. كحول الصيدليات 70% يفسد العطر لاحتوائه على 30% ماء.'
                          : '96% ethanol is the golden standard to solubilize oils without cloudiness. Never use 70% rubbing alcohol.'}
                      </div>
                    )}
                  </div>

                  {/* Batch Production Count */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-stone-900 flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-amber-700" />
                        <span>{t('batch_count', 'عدد العبوات في التشغيلة')}</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => toggleCriterion('batch_count')}
                        className="text-[10px] text-amber-800 font-bold hover:underline cursor-pointer"
                      >
                        [؟]
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="10000"
                        value={formulation.batchCount}
                        onChange={(e) =>
                          setFormulation((prev) => ({
                            ...prev,
                            batchCount: Math.max(1, parseInt(e.target.value) || 1),
                          }))
                        }
                        className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 font-bold font-mono-numbers focus:outline-none"
                      />
                      <span className="text-xs text-stone-500 font-medium whitespace-nowrap">
                        {isRTL ? 'عبوة' : 'bottles'}
                      </span>
                    </div>
                    {expandedCriteria['batch_count'] && (
                      <div className="p-2.5 mt-2 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-950 leading-relaxed">
                        {isRTL
                          ? 'الخلط بالتشغيلة الكاملة يوحد نقاء ورائحة العطر ويقلل هدر الخامات بنسبة تصل لـ 12%.'
                          : 'Batch compounding ensures olfactory uniformity across all bottles and cuts waste by up to 12%.'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Maceration Period & Predicted Maturation Date Box */}
                <div className="mt-4 pt-4 border-t border-stone-200/80 bg-gradient-to-br from-amber-50/70 via-stone-50 to-amber-50/40 p-4 rounded-xl border border-amber-200/80 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Hourglass className="w-4 h-4 text-amber-800 shrink-0" />
                      <div>
                        <span className="font-bold text-xs text-stone-900 block">
                          {isRTL ? 'فترة التعتيق وتاريخ نضوج العطر المتوقع (محاكي التعتيق الزمني)' : 'Maceration Period & Predicted Maturation Date'}
                        </span>
                        <span className="text-[10px] text-stone-500">
                          {isRTL ? 'حساب تاريخ الانتهاء المتوقع بناءً على أيام النظام وتاريخ البدء' : 'Calculates exact completion date from start date & days'}
                        </span>
                      </div>
                    </div>

                    {onNavigateToTab && (
                      <button
                        type="button"
                        onClick={() => onNavigateToTab('maceration_simulator')}
                        className="px-2.5 py-1 rounded-lg bg-amber-800 hover:bg-amber-900 text-white font-bold text-[11px] flex items-center gap-1 shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
                      >
                        <Calendar className="w-3 h-3 text-amber-300" />
                        <span>{isRTL ? 'محاكي التعتيق الزمني ⏳' : 'Aging Simulator ⏳'}</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                    <div className="sm:col-span-5 flex items-center gap-2">
                      <div className="w-full">
                        <label className="text-[10px] font-bold text-stone-600 block mb-1">
                          {isRTL ? 'أيام التعتيق المقررة:' : 'Maceration Days:'}
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="3"
                            max="365"
                            value={macerationDays}
                            onChange={(e) => setMacerationDays?.(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-24 p-2 bg-white border border-stone-300 rounded-lg text-xs font-bold font-mono-numbers text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-800"
                          />
                          <span className="text-xs text-stone-500 font-medium">
                            {isRTL ? 'يوماً' : 'days'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="sm:col-span-7 bg-white p-2.5 rounded-lg border border-amber-300/80 shadow-2xs space-y-0.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-semibold text-stone-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-amber-700" />
                          <span>{isRTL ? 'تاريخ الانتهاء المتوقع للنضوج:' : 'Target Maturation Date:'}</span>
                        </span>
                        <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded text-[9px] border border-emerald-200">
                          {isRTL ? 'تلقائي بالنظام' : 'System Auto'}
                        </span>
                      </div>
                      <div className="font-bold text-xs text-stone-950 font-serif-luxury">
                        {new Date(Date.now() + (macerationDays || 30) * 86400000).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Advanced Chemical & Solvents Accordion */}
              <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm space-y-4">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full flex items-center justify-between text-sm font-semibold text-stone-900 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-amber-700" />
                    <span>{isRTL ? 'إعدادات كيميائية متقدمة (الكثافة، الماء المقطر، المثبتات)' : 'Advanced Chemistry Settings (Density, Water, Fixatives)'}</span>
                  </div>
                  <span className="text-xs text-amber-800 font-bold">
                    {showAdvanced
                      ? isRTL ? 'إخفاء الإعدادات ▲' : 'Hide Settings ▲'
                      : isRTL ? 'تخصيص الإعدادات الكيميائية ▼' : 'Customize Settings ▼'}
                  </span>
                </button>

                {showAdvanced && (
                  <div className="pt-3 border-t border-stone-100 space-y-4 animate-in fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Distilled Water */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-xs font-medium text-stone-700 flex items-center gap-1">
                            <Droplets className="w-3.5 h-3.5 text-sky-500" />
                            <span>{t('distilled_water', 'ماء مقطر')} (Distilled Water)</span>
                          </label>
                          <span className="font-mono-numbers text-stone-900 text-xs font-bold">{formulation.waterPercent}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="10"
                          step="0.5"
                          value={formulation.waterPercent}
                          onChange={(e) =>
                            setFormulation((prev) => ({
                              ...prev,
                              waterPercent: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="w-full accent-amber-800 cursor-pointer mt-1"
                        />
                        <p className="text-[10px] text-stone-500 mt-1">
                          {isRTL ? 'النسبة النموذجية: 0% إلى 2% فقط لترطيب الرذاذ.' : 'Safe benchmark: 0% to 2% max.'}
                        </p>
                      </div>

                      {/* Fixative */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-xs font-medium text-stone-700 flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{t('fixative_ratio', 'مثبت عطري')} (DPG / IPM / Iso E)</span>
                          </label>
                          <span className="font-mono-numbers text-stone-900 text-xs font-bold">{formulation.fixativePercent}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="5"
                          step="0.5"
                          value={formulation.fixativePercent}
                          onChange={(e) =>
                            setFormulation((prev) => ({
                              ...prev,
                              fixativePercent: parseFloat(e.target.value) || 1,
                            }))
                          }
                          className="w-full accent-amber-800 cursor-pointer mt-1"
                        />
                        <p className="text-[10px] text-stone-500 mt-1">
                          {isRTL ? 'النسبة الموصى بها: 0.5% إلى 2% لإبطاء تبخر النوتات الخفيفة.' : 'Recommended ratio: 0.5% to 2%.'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      {/* Oil Density */}
                      <div>
                        <label className="text-xs font-medium text-stone-700 block mb-1">
                          {isRTL ? 'كثافة الزيت العطري (g/ml)' : 'Oil Specific Gravity (g/ml)'}
                        </label>
                        <input
                          type="number"
                          min="0.80"
                          max="1.10"
                          step="0.01"
                          value={formulation.oilDensity}
                          onChange={(e) =>
                            setFormulation((prev) => ({
                              ...prev,
                              oilDensity: parseFloat(e.target.value) || 0.92,
                            }))
                          }
                          className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono-numbers text-stone-900"
                        />
                        <span className="text-[10px] text-stone-400 block mt-0.5">
                          {isRTL ? 'المتوسط: 0.92 جم/مل' : 'Standard benchmark: 0.92 g/ml'}
                        </span>
                      </div>

                      {/* Alcohol Density */}
                      <div>
                        <label className="text-xs font-medium text-stone-700 block mb-1">
                          {isRTL ? 'كثافة الكحول الإيثيلي (g/ml)' : 'Ethanol Specific Gravity (g/ml)'}
                        </label>
                        <input
                          type="number"
                          min="0.75"
                          max="0.85"
                          step="0.01"
                          value={formulation.alcoholDensity}
                          onChange={(e) =>
                            setFormulation((prev) => ({
                              ...prev,
                              alcoholDensity: parseFloat(e.target.value) || 0.80,
                            }))
                          }
                          className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono-numbers text-stone-900"
                        />
                        <span className="text-[10px] text-stone-400 block mt-0.5">
                          {isRTL ? 'الكحول 96% كثافته تقريباً 0.80 جم/مل' : '96% ethanol is ~0.80 g/ml'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Right Column: Live Results & Spec Card */}
            <div className="lg:col-span-5 space-y-6">

              {/* Results Summary Box */}
              <div className="bg-white p-6 rounded-2xl border border-stone-200/90 shadow-md space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                  <div>
                    <h3 className="font-bold text-stone-950 text-base">
                      {t('result_card_title', 'نتائج ومقادير الخلط الدقيقة')}
                    </h3>
                    <div className="text-xs text-stone-500 mt-0.5">
                      {formulation.bottleVolumeMl} ml · {formulation.concentrationPercent}%
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={copyRecipeToClipboard}
                    className="px-3 py-1.5 text-xs text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : null}
                    <span>
                      {copiedSummary
                        ? isRTL ? 'تم النسخ' : 'Copied'
                        : isRTL ? 'نسخ المقادير' : 'Copy Recipe'}
                    </span>
                  </button>
                </div>

                {/* Visual Ingredient Breakdown Ratio Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-medium text-stone-600">
                    <span>{isRTL ? 'توزيع المكونات في الزجاجة' : 'Formula Ratio Breakdown'}</span>
                    <span className="font-mono-numbers font-bold text-stone-900">100%</span>
                  </div>
                  <div className="h-4 rounded-full overflow-hidden flex bg-stone-100 p-0.5 border border-stone-200">
                    <div
                      style={{ width: `${result.oilPercent}%` }}
                      className="bg-amber-600 h-full rounded-r-full transition-all"
                      title={`Oil: ${result.oilPercent}%`}
                    />
                    <div
                      style={{ width: `${result.alcoholPercent}%` }}
                      className="bg-stone-400 h-full transition-all"
                      title={`Ethanol: ${result.alcoholPercent}%`}
                    />
                    {result.waterPercent > 0 && (
                      <div
                        style={{ width: `${result.waterPercent}%` }}
                        className="bg-sky-400 h-full transition-all"
                        title={`Water: ${result.waterPercent}%`}
                      />
                    )}
                    {result.fixativePercent > 0 && (
                      <div
                        style={{ width: `${result.fixativePercent}%` }}
                        className="bg-emerald-600 h-full rounded-l-full transition-all"
                        title={`Fixative: ${result.fixativePercent}%`}
                      />
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-stone-500 pt-1">
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-xs bg-amber-600 inline-block" />
                      {t('result_oil', 'زيت عطري')} ({formatNum(result.oilPercent, 1)}%)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-xs bg-stone-400 inline-block" />
                      {t('result_alcohol', 'كحول')} ({formatNum(result.alcoholPercent, 1)}%)
                    </span>
                    {result.waterPercent > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-xs bg-sky-400 inline-block" />
                        {t('result_water', 'ماء')} ({formatNum(result.waterPercent, 1)}%)
                      </span>
                    )}
                    {result.fixativePercent > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
                        {t('result_fixative', 'مثبت')} ({formatNum(result.fixativePercent, 1)}%)
                      </span>
                    )}
                  </div>
                </div>

                {/* Detailed Ingredients Table */}
                <div className="space-y-3 pt-2">
                  <div className="text-xs font-semibold text-stone-900">
                    {isRTL
                      ? `المقادير للزجاجة الواحدة (${formulation.bottleVolumeMl} مل):`
                      : `Batch Metrics per Single Bottle (${formulation.bottleVolumeMl}ml):`}
                  </div>
                  <div className="divide-y divide-stone-100 border border-stone-200/70 rounded-xl overflow-hidden bg-stone-50/50">
                    
                    {/* Fragrance Oil */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-600" />
                          {t('result_oil', 'الزيت العطري الخام')}
                        </div>
                        <div className="text-[11px] text-stone-500">
                          {isRTL ? 'بالمخبار: ' : 'Volumetric: '}
                          <span className="font-mono-numbers">{formatNum(result.oilVolumeMl)} ml</span>
                        </div>
                      </div>
                      <div className="text-left font-mono-numbers">
                        <div className="text-base font-bold text-amber-900">
                          {formatNum(result.oilWeightGrams)} g
                        </div>
                        <div className="text-[10px] text-stone-400">{isRTL ? 'وزن الميزان' : 'Scale Mass'}</div>
                      </div>
                    </div>

                    {/* Ethanol Alcohol */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-stone-400" />
                          {t('result_alcohol', 'الكحول الإيثيلي (Ethanol)')}
                        </div>
                        <div className="text-[11px] text-stone-500">
                          {isRTL ? 'بالمخبار: ' : 'Volumetric: '}
                          <span className="font-mono-numbers">{formatNum(result.alcoholVolumeMl)} ml</span>
                        </div>
                      </div>
                      <div className="text-left font-mono-numbers">
                        <div className="text-base font-bold text-stone-900">
                          {formatNum(result.alcoholWeightGrams)} g
                        </div>
                        <div className="text-[10px] text-stone-400">{isRTL ? 'وزن الميزان' : 'Scale Mass'}</div>
                      </div>
                    </div>

                    {/* Distilled Water */}
                    {result.waterPercent > 0 && (
                      <div className="p-3.5 flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-sky-900 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-sky-400" />
                            {t('result_water', 'ماء مقطر نقي')}
                          </div>
                          <div className="text-[11px] text-stone-500">
                            {formatNum(result.waterVolumeMl)} ml
                          </div>
                        </div>
                        <div className="text-left font-mono-numbers">
                          <div className="text-sm font-bold text-sky-900">
                            {formatNum(result.waterWeightGrams)} g
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Fixative */}
                    {result.fixativePercent > 0 && (
                      <div className="p-3.5 flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-600" />
                            {t('result_fixative', 'مثبت عطري (DPG/IPM)')}
                          </div>
                          <div className="text-[11px] text-stone-500">
                            {formatNum(result.fixativeVolumeMl)} ml
                          </div>
                        </div>
                        <div className="text-left font-mono-numbers">
                          <div className="text-sm font-bold text-emerald-900">
                            {formatNum(result.fixativeWeightGrams)} g
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Total Net Row */}
                    <div className="p-3.5 bg-stone-100/80 flex items-center justify-between">
                      <div className="text-xs font-bold text-stone-900">
                        {t('result_total_mass', 'الوزن الصافي الإجمالي للعطر')}
                      </div>
                      <div className="text-left font-mono-numbers">
                        <div className="text-base font-extrabold text-stone-900">
                          {formatNum(result.totalWeightGrams)} g
                        </div>
                        <div className="text-[10px] text-stone-500">
                          {result.totalVolumeMl} ml
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Batch Production Totals (if batchCount > 1) */}
                {formulation.batchCount > 1 && (
                  <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-950">
                        {isRTL
                          ? `إجمالي إنتاج التشغيلة (${formulation.batchCount} عبوة):`
                          : `Batch Production Total (${formulation.batchCount} units):`}
                      </span>
                      <span className="text-xs font-mono-numbers font-semibold text-amber-900">
                        {formatNum(result.batchTotalVolumeMl / 1000, 2)} L
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                      <div className="bg-white p-2.5 rounded-lg border border-amber-100">
                        <span className="text-stone-500 block text-[11px]">
                          {isRTL ? 'إجمالي الزيت العطري:' : 'Total Fragrance Oil:'}
                        </span>
                        <span className="font-mono-numbers font-bold text-amber-900 text-sm">
                          {result.batchTotalOilGrams >= 1000
                            ? `${formatNum(result.batchTotalOilGrams / 1000, 3)} kg`
                            : `${formatNum(result.batchTotalOilGrams)} g`}
                        </span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-amber-100">
                        <span className="text-stone-500 block text-[11px]">
                          {isRTL ? 'إجمالي الكحول الإيثيلي:' : 'Total Ethyl Alcohol:'}
                        </span>
                        <span className="font-mono-numbers font-bold text-stone-900 text-sm">
                          {result.batchTotalAlcoholGrams >= 1000
                            ? `${formatNum(result.batchTotalAlcoholGrams / 1000, 3)} kg`
                            : `${formatNum(result.batchTotalAlcoholGrams)} g`}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ======================================================== */}
                {/* 1. AUTOMATIC REAL-TIME RAW MATERIALS COST DISPLAY        */}
                {/* ======================================================== */}
                <div className="p-4 sm:p-5 bg-gradient-to-br from-amber-500/10 via-amber-50 to-stone-50 border-2 border-amber-300/80 rounded-2xl space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-700 text-white flex items-center justify-center font-bold text-sm shadow-2xs">
                        <DollarSign className="w-4 h-4 text-amber-100" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-amber-950 flex items-center gap-2">
                          <span>{isRTL ? 'إجمالي تكلفة المواد الخام التلقائية' : 'Live Raw Materials Total Cost'}</span>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse">
                            {isRTL ? 'تحديث لحظي' : 'Live'}
                          </span>
                        </h4>
                        <span className="text-[10px] text-stone-500">
                          {isRTL
                            ? `محسوبة تلقائياً بأسعار الخامات الافتراضية (${activeCurrency})`
                            : `Calculated dynamically from benchmark prices (${activeCurrency})`}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowPriceConfig(!showPriceConfig)}
                      className="px-2.5 py-1 text-[11px] rounded-lg bg-white border border-amber-200 text-amber-900 font-semibold hover:bg-amber-100 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <Sliders className="w-3 h-3 text-amber-700" />
                      <span>{showPriceConfig ? (isRTL ? 'إخفاء الأسعار ▲' : 'Hide Prices ▲') : (isRTL ? 'تعديل الأسعار ⚙️' : 'Adjust Prices ⚙️')}</span>
                    </button>
                  </div>

                  {/* Primary Total Cost Highlights */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-white p-3.5 rounded-xl border border-amber-200/90 shadow-2xs">
                      <div className="text-[11px] font-medium text-stone-500 mb-0.5">
                        {isRTL ? 'تكلفة المواد للزجاجة الواحدة:' : 'Raw Cost per Single Bottle:'}
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-extrabold text-amber-950 font-mono-numbers">
                          {formatNum(rawCostTotalSingle, 2)}
                        </span>
                        <span className="text-xs font-bold text-amber-800">
                          {activeCurrency}
                        </span>
                        <span className="text-[10px] text-stone-400 font-mono-numbers">
                          / {formulation.bottleVolumeMl} ml
                        </span>
                      </div>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-amber-200/90 shadow-2xs">
                      <div className="text-[11px] font-medium text-stone-500 mb-0.5">
                        {isRTL
                          ? `تكلفة التشغيلة (${formulation.batchCount} عبوة):`
                          : `Total Batch Cost (${formulation.batchCount} units):`}
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-extrabold text-stone-900 font-mono-numbers">
                          {formatNum(rawCostTotalBatch, 2)}
                        </span>
                        <span className="text-xs font-bold text-amber-800">
                          {activeCurrency}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Itemized Cost Breakdown */}
                  <div className="space-y-1.5 pt-1 text-xs">
                    <div className="text-[11px] font-bold text-stone-700 flex items-center justify-between">
                      <span>{isRTL ? 'تفصيل تكلفة المواد لكل عبوة:' : 'Itemized Cost per Bottle:'}</span>
                      <span className="font-mono-numbers text-stone-400 text-[10px]">
                        100% {isRTL ? 'من تكلفة الخامات' : 'of materials'}
                      </span>
                    </div>

                    <div className="bg-white rounded-xl border border-stone-200 divide-y divide-stone-100 overflow-hidden text-[11px]">
                      {/* Oil Cost */}
                      <div className="p-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-xs bg-amber-600 inline-block" />
                          <span className="font-semibold text-stone-800">
                            {isRTL ? 'الزيت العطري الخام' : 'Fragrance Oil'}
                          </span>
                          <span className="text-[10px] text-stone-400 font-mono-numbers">
                            ({formatNum(result.oilWeightGrams, 2)}g @ {oilPricePerKg} {activeCurrency}/kg)
                          </span>
                        </div>
                        <div className="text-left font-mono-numbers font-bold text-amber-900">
                          {formatNum(rawCostOil, 2)} {activeCurrency}
                          <span className="text-[9px] text-stone-400 font-normal ml-1">
                            ({rawCostTotalSingle > 0 ? Math.round((rawCostOil / rawCostTotalSingle) * 100) : 0}%)
                          </span>
                        </div>
                      </div>

                      {/* Alcohol Cost */}
                      <div className="p-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-xs bg-stone-400 inline-block" />
                          <span className="font-semibold text-stone-800">
                            {isRTL ? 'الكحول الإيثيلي' : 'Ethyl Alcohol'}
                          </span>
                          <span className="text-[10px] text-stone-400 font-mono-numbers">
                            ({formatNum(result.alcoholVolumeMl, 1)}ml @ {alcoholPricePerLiter} {activeCurrency}/L)
                          </span>
                        </div>
                        <div className="text-left font-mono-numbers font-bold text-stone-900">
                          {formatNum(rawCostAlcohol, 2)} {activeCurrency}
                          <span className="text-[9px] text-stone-400 font-normal ml-1">
                            ({rawCostTotalSingle > 0 ? Math.round((rawCostAlcohol / rawCostTotalSingle) * 100) : 0}%)
                          </span>
                        </div>
                      </div>

                      {/* Fixative Cost */}
                      {result.fixativeWeightGrams > 0 && (
                        <div className="p-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
                            <span className="font-semibold text-emerald-950">
                              {isRTL ? 'المثبت العطري' : 'Fixative'}
                            </span>
                            <span className="text-[10px] text-stone-400 font-mono-numbers">
                              ({formatNum(result.fixativeWeightGrams, 2)}g @ {fixativePricePerKg} {activeCurrency}/kg)
                            </span>
                          </div>
                          <div className="text-left font-mono-numbers font-bold text-emerald-900">
                            {formatNum(rawCostFixative, 2)} {activeCurrency}
                          </div>
                        </div>
                      )}

                      {/* Water Cost */}
                      {result.waterVolumeMl > 0 && (
                        <div className="p-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-xs bg-sky-400 inline-block" />
                            <span className="font-semibold text-sky-950">
                              {isRTL ? 'الماء المقطر' : 'Distilled Water'}
                            </span>
                            <span className="text-[10px] text-stone-400 font-mono-numbers">
                              ({formatNum(result.waterVolumeMl, 1)}ml @ {waterPricePerLiter} {activeCurrency}/L)
                            </span>
                          </div>
                          <div className="text-left font-mono-numbers font-bold text-sky-900">
                            {formatNum(rawCostWater, 2)} {activeCurrency}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Customizable Benchmark Pricing Drawer */}
                  {showPriceConfig && (
                    <div className="p-3.5 bg-white rounded-xl border border-amber-200/90 space-y-3 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-900 flex items-center gap-1">
                          <Sliders className="w-3.5 h-3.5 text-amber-700" />
                          <span>{isRTL ? 'تخصيص أسعار شراء المواد الافتراضية' : 'Customize Benchmark Raw Material Prices'}</span>
                        </span>
                        <span className="text-[10px] text-stone-400 font-medium">
                          {isRTL ? 'تُحفظ تلقائياً وتحدث الإجمالي' : 'Auto-saved & Live Updated'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="text-[11px] font-medium text-stone-600 block mb-1">
                            {isRTL ? `سعر كيلو الزيت (${activeCurrency}/kg)` : `Oil Price (${activeCurrency}/kg)`}
                          </label>
                          <input
                            type="number"
                            min="10"
                            step="5"
                            value={oilPricePerKg}
                            onChange={(e) => handleUpdatePrice('oil', parseFloat(e.target.value) || 0)}
                            className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg font-mono-numbers font-bold text-stone-900 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-medium text-stone-600 block mb-1">
                            {isRTL ? `سعر لتر الكحول (${activeCurrency}/L)` : `Ethanol Price (${activeCurrency}/L)`}
                          </label>
                          <input
                            type="number"
                            min="5"
                            step="2"
                            value={alcoholPricePerLiter}
                            onChange={(e) => handleUpdatePrice('alcohol', parseFloat(e.target.value) || 0)}
                            className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg font-mono-numbers font-bold text-stone-900 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-medium text-stone-600 block mb-1">
                            {isRTL ? `سعر كيلو المثبت (${activeCurrency}/kg)` : `Fixative Price (${activeCurrency}/kg)`}
                          </label>
                          <input
                            type="number"
                            min="10"
                            step="5"
                            value={fixativePricePerKg}
                            onChange={(e) => handleUpdatePrice('fixative', parseFloat(e.target.value) || 0)}
                            className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg font-mono-numbers font-bold text-stone-900 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-medium text-stone-600 block mb-1">
                            {isRTL ? `سعر لتر الماء المقطر (${activeCurrency}/L)` : `Distilled Water (${activeCurrency}/L)`}
                          </label>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={waterPricePerLiter}
                            onChange={(e) => handleUpdatePrice('water', parseFloat(e.target.value) || 0)}
                            className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg font-mono-numbers font-bold text-stone-900 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ======================================================== */}
                {/* 2. VISUAL REAL-TIME SCALE & BEAKER SIMULATOR PREVIEW     */}
                {/* ======================================================== */}
                <div className="p-4 sm:p-5 bg-stone-900 text-white rounded-2xl border border-stone-800 shadow-md space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm border border-amber-500/30">
                        <Scale className="w-4 h-4 text-amber-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-stone-100 flex items-center gap-2">
                          <span>{isRTL ? 'محاكي وزن المواد والميزان البصري' : 'Visual Scale & Balance Simulator'}</span>
                          <span className="text-[9px] font-mono-numbers px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-300 border border-amber-700/50">
                            ± 0.01 g
                          </span>
                        </h4>
                        <span className="text-[10px] text-stone-400">
                          {isRTL ? 'محاكاة بصرية حية لوزن كل مادة بالجرام والقطرات وتعبئة المخبار' : 'Live gravimetric scale readout & liquid beaker visualization'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveView('scale_simulator')}
                      className="px-2.5 py-1 text-[11px] rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>{isRTL ? 'المحاكي الكامل 🔬' : 'Full Lab View 🔬'}</span>
                    </button>
                  </div>

                  {/* Digital Balance Pan & LCD Display */}
                  <div className="bg-stone-950 p-4 rounded-xl border border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                    {/* Visual Beaker with layered liquids */}
                    <div className="flex items-center gap-3">
                      <div className="relative w-16 h-28 bg-stone-900/90 rounded-b-xl border-2 border-stone-600/60 overflow-hidden flex flex-col justify-end shadow-inner">
                        {/* Graduated Markings */}
                        <div className="absolute inset-y-0 right-1 flex flex-col justify-between py-2 text-[8px] font-mono-numbers text-stone-500 pointer-events-none select-none">
                          <span>-</span>
                          <span>-</span>
                          <span>-</span>
                          <span>-</span>
                        </div>

                        {/* Liquid Layers */}
                        {result.waterPercent > 0 && (
                          <div
                            style={{ height: `${result.waterPercent}%` }}
                            className="w-full bg-sky-400/80 transition-all duration-300 border-b border-sky-300/40"
                            title={`Distilled Water: ${formatNum(result.waterWeightGrams)}g`}
                          />
                        )}
                        {result.fixativePercent > 0 && (
                          <div
                            style={{ height: `${result.fixativePercent}%` }}
                            className="w-full bg-emerald-500/80 transition-all duration-300 border-b border-emerald-300/40"
                            title={`Fixative: ${formatNum(result.fixativeWeightGrams)}g`}
                          />
                        )}
                        <div
                          style={{ height: `${result.alcoholPercent}%` }}
                          className="w-full bg-cyan-600/70 transition-all duration-300 border-b border-cyan-400/40"
                          title={`Ethanol Alcohol: ${formatNum(result.alcoholWeightGrams)}g`}
                        />
                        <div
                          style={{ height: `${result.oilPercent}%` }}
                          className="w-full bg-amber-500/90 transition-all duration-300 shadow-sm"
                          title={`Fragrance Oil: ${formatNum(result.oilWeightGrams)}g`}
                        />
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          <span>{isRTL ? 'الزيت:' : 'Oil:'}</span>
                          <span className="font-mono-numbers text-white font-extrabold">{formatNum(result.oilWeightGrams)} g</span>
                          <span className="text-[10px] text-stone-400 font-mono-numbers">({formatNum(result.oilVolumeMl)} ml · ~{Math.round(result.oilWeightGrams * 24)} {isRTL ? 'قطرة' : 'drops'})</span>
                        </div>
                        <div className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-cyan-400" />
                          <span>{isRTL ? 'الكحول:' : 'Ethanol:'}</span>
                          <span className="font-mono-numbers text-white font-extrabold">{formatNum(result.alcoholWeightGrams)} g</span>
                          <span className="text-[10px] text-stone-400 font-mono-numbers">({formatNum(result.alcoholVolumeMl)} ml)</span>
                        </div>
                        {result.fixativeWeightGrams > 0 && (
                          <div className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            <span>{isRTL ? 'المثبت:' : 'Fixative:'}</span>
                            <span className="font-mono-numbers text-white">{formatNum(result.fixativeWeightGrams)} g</span>
                          </div>
                        )}
                        {result.waterWeightGrams > 0 && (
                          <div className="text-[11px] font-bold text-sky-300 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-sky-400" />
                            <span>{isRTL ? 'الماء:' : 'Water:'}</span>
                            <span className="font-mono-numbers text-white">{formatNum(result.waterWeightGrams)} g</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* LCD Balance Screen with Tare Button */}
                    <div className="bg-black/90 p-3.5 rounded-xl border border-stone-700/80 text-center space-y-2 min-w-[140px] shadow-inner">
                      <div className="text-[9px] text-emerald-400 font-mono flex items-center justify-between px-1">
                        <span>STABLE</span>
                        <span>0.01g</span>
                      </div>
                      <div className="font-mono-numbers text-2xl font-black text-emerald-400 tracking-wider">
                        {isLiveScaleTared ? '0.00' : formatNum(result.totalWeightGrams)}
                        <span className="text-xs text-emerald-600 font-bold ml-1">g</span>
                      </div>
                      <div className="flex items-center justify-center gap-2 pt-1 border-t border-stone-800">
                        <button
                          type="button"
                          onClick={() => setIsLiveScaleTared(!isLiveScaleTared)}
                          className={`px-2.5 py-0.5 rounded text-[10px] font-bold font-mono transition-colors cursor-pointer ${
                            isLiveScaleTared
                              ? 'bg-emerald-600 text-white'
                              : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
                          }`}
                        >
                          TARE (تصفير)
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Direct Action Buttons */}
                <div className="space-y-2 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={onSaveFormula}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5 text-amber-400" />
                      <span>{t('action_save', 'حفظ في الوصفات')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={onSendToCosting}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-amber-800 hover:bg-amber-900 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>{t('action_costing', 'حساب التكلفة والأرباح')}</span>
                    </button>
                  </div>

                  {/* Switch to Pyramid Graphic Button */}
                  <button
                    type="button"
                    onClick={() => setActiveView('pyramid_graphic')}
                    className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
                  >
                    <Wind className="w-4 h-4 text-stone-900" />
                    <span>
                      {isRTL
                        ? 'مشاهدة جرافيك الهرم وسيناريو رش العطر 💨'
                        : 'View Fragrance Pyramid & Spray Simulation 💨'}
                    </span>
                  </button>

                  {/* Criteria Guide Button */}
                  <button
                    type="button"
                    onClick={() => setActiveView('criteria_guide')}
                    className="w-full py-2 px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-amber-700" />
                    <span>
                      {isRTL
                        ? 'دليل وشرح جميع معايير الحاسبة والمعمل 📖'
                        : 'Formulation Criteria & Chemistry Guide 📖'}
                    </span>
                  </button>

                  {/* Maceration Time Simulator Direct Button */}
                  {onNavigateToTab && (
                    <button
                      type="button"
                      onClick={() => onNavigateToTab('maceration_simulator')}
                      className="w-full py-2.5 px-3 bg-gradient-to-r from-amber-900 to-stone-900 hover:from-amber-950 hover:to-black text-amber-300 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer border border-amber-500/30"
                    >
                      <Hourglass className="w-4 h-4 text-amber-400" />
                      <span>
                        {isRTL
                          ? 'محاكي التعتيق الزمني وتاريخ نضوج العطر ⏳'
                          : 'Maceration & Aging Time Simulator ⏳'}
                      </span>
                    </button>
                  )}

                  {/* Ask Shahin AI Button */}
                  <button
                    type="button"
                    onClick={() => {
                      const expectedDate = new Date(Date.now() + (macerationDays || 30) * 86400000).toLocaleDateString('ar-SA', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      });
                      const prompt = `أيها الخبير شاهين (شيخ العطارين)، أعمل على تركيبة بتركيز ${formulation.concentrationPercent}% بحجم ${formulation.bottleVolumeMl} مل (وزن الزيت: ${result.oilWeightGrams.toFixed(2)} جم، الكحول: ${result.alcoholWeightGrams.toFixed(2)} جم).
مدة التعتيق المقررة: ${macerationDays} يوماً، وتاريخ الانتهاء المتوقع: ${expectedDate}.
ما هو تقييمك المخبري لتوازن هذه النسب؟ وكيف أضمن أعلى ثبات وفوحان وأفضل نتيجة تعتيق؟`;
                      window.dispatchEvent(new CustomEvent('open-ai-chat-with-prompt', { detail: prompt }));
                    }}
                    className="w-full py-2.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer border border-amber-300/80"
                  >
                    <Bot className="w-4 h-4 text-amber-800" />
                    <span>
                      {isRTL
                        ? 'استشارة الخبير شاهين حول نسب وتعتيق التركيبة 🧙‍♂️'
                        : 'Consult Master Shahin on Formulation & Aging 🧙‍♂️'}
                    </span>
                  </button>
                </div>

              </div>

              {/* Quick Laboratory Note */}
              <div className="bg-stone-50 p-4 rounded-xl border border-stone-200/70 text-xs text-stone-600 space-y-2">
                <div className="font-semibold text-stone-900 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>
                    {isRTL
                      ? 'معيار ميزان المعمل (الميزان الرقمي vs المخبار):'
                      : 'Laboratory Gravimetric Standard (Digital Scale vs Cylinder):'}
                  </span>
                </div>
                <p className="leading-relaxed text-[11px]">
                  {isRTL
                    ? 'استخدام الميزان الرقمي بالغرام أدق بكثير من المخبار المدرج بالمليلتر، لأن الزيوت العطرية مادة لزجة تلتصق بجدران الأنابيب الزجاجية مسببة فاقداً يصل لـ 1.5 مل في كل عبوة، بينما الميزان يحسب الوزن المباشر بدقة 0.01 جم داخل الزجاجة دون أي فاقد.'
                    : 'Gravimetric digital balance measurement is strictly preferred over volumetric glass cylinders. Viscous essential oils adhere to pipette walls causing up to 1.5ml loss per bottle, while direct scale taring achieves 0.01g precision with zero material waste.'}
                </p>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};
