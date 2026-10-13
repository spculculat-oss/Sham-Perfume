import React, { useState } from 'react';
import {
  Scale,
  Droplets,
  Layers,
  Sparkles,
  Beaker,
  RotateCcw,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  ArrowDown,
  Info,
  Sliders,
} from 'lucide-react';
import { CalculationResult, FormulationState, PyramidNote } from '../types/perfume';
import { SupportedLanguage } from '../types/i18n';
import { formatNum } from '../utils/calculations';
import { isRTL } from '../utils/localizedContent';

interface VisualScaleSimulatorProps {
  formulation: FormulationState;
  result: CalculationResult;
  pyramidNotes?: PyramidNote[];
  currentLang?: SupportedLanguage;
}

export const VisualScaleSimulator: React.FC<VisualScaleSimulatorProps> = ({
  formulation,
  result,
  pyramidNotes = [],
  currentLang = 'ar',
}) => {
  const rtl = isRTL(currentLang);
  const NextArrow = rtl ? ChevronLeft : ChevronRight;
  const PrevArrow = rtl ? ChevronRight : ChevronLeft;

  // Simulator Modes: 'all' (Overall View) or 'step' (Step-by-step Weighing Walkthrough)
  const [simulatorMode, setSimulatorMode] = useState<'all' | 'step'>('all');
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isTared, setIsTared] = useState<boolean>(false);
  const [pipetteDropMode, setPipetteDropMode] = useState<'drops' | 'grams'>('grams');

  // Drops conversion factor (standard laboratory pipette: ~20 to 25 drops per gram of oil, ~30 drops per gram of ethanol)
  const OIL_DROPS_PER_GRAM = 24;
  const ALCOHOL_DROPS_PER_GRAM = 32;

  // Weighing Steps Definition
  const steps = [
    {
      id: 'tare_beaker',
      titleAr: 'الخطوة 1: وضع وعاء الخلط وتصفير الميزان (Tare)',
      titleEn: 'Step 1: Place Beaker on Scale & Tare (Zero)',
      descAr: 'ضع الزجاجة الفارغة أو كاس الخلط الزجاجي (Beaker) على سطح الميزان ثم اضغط زر TARE ليصبح الوزن 0.00 جم.',
      descEn: 'Place the empty bottle or beaker onto the balance pan, then press TARE to reset to 0.00 g.',
      targetGrams: 0,
      cumulativeGrams: 0,
      color: 'bg-stone-300',
      tag: 'TARE 0.00g',
    },
    {
      id: 'oil',
      titleAr: 'الخطوة 2: وزن الزيت العطري الخام بالقطارة',
      titleEn: 'Step 2: Weigh Fragrance Oil via Pipette',
      descAr: `أضف قطرات الزيت العطري الخام ببطء حتى يصل المؤشر بدقة إلى ${formatNum(result.oilWeightGrams)} جم.`,
      descEn: `Add pure fragrance oil slowly using a graduated pipette until the balance displays exactly ${formatNum(result.oilWeightGrams)} g.`,
      targetGrams: result.oilWeightGrams,
      cumulativeGrams: result.oilWeightGrams,
      volumeMl: result.oilVolumeMl,
      color: 'bg-amber-500',
      tag: rtl ? 'الزيت العطري' : 'Fragrance Oil',
    },
    {
      id: 'fixative',
      titleAr: 'الخطوة 3: إضافة المثبت العطري (إن وجد)',
      titleEn: 'Step 3: Add Fixative (if applicable)',
      descAr: result.fixativeWeightGrams > 0
        ? `أضف المثبت (${formatNum(result.fixativeWeightGrams)} جم) ليصبح المجموع التراكمي ${formatNum(result.oilWeightGrams + result.fixativeWeightGrams)} جم.`
        : 'لا يوجد مثبت محدد لهذه التركيبة (0 جم). يمكنك الانتقال للخطوة التالية.',
      descEn: result.fixativeWeightGrams > 0
        ? `Weigh fixative (${formatNum(result.fixativeWeightGrams)} g) bringing cumulative mass to ${formatNum(result.oilWeightGrams + result.fixativeWeightGrams)} g.`
        : 'No fixative required for this formula (0 g). Proceed to next step.',
      targetGrams: result.fixativeWeightGrams,
      cumulativeGrams: result.oilWeightGrams + result.fixativeWeightGrams,
      volumeMl: result.fixativeVolumeMl,
      color: 'bg-emerald-500',
      tag: rtl ? 'المثبت العطري' : 'Fixative',
    },
    {
      id: 'alcohol',
      titleAr: 'الخطوة 4: صب الكحول الإيثيلي المتبقي',
      titleEn: 'Step 4: Pour Ethyl Alcohol (Ethanol)',
      descAr: `صب الكحول بحذر حتى يصل الوزن الإجمالي التراكمي إلى ${formatNum(result.totalWeightGrams - result.waterWeightGrams)} جم.`,
      descEn: `Carefully pour ethanol alcohol until the balance reads ${formatNum(result.totalWeightGrams - result.waterWeightGrams)} g.`,
      targetGrams: result.alcoholWeightGrams,
      cumulativeGrams: result.oilWeightGrams + result.fixativeWeightGrams + result.alcoholWeightGrams,
      volumeMl: result.alcoholVolumeMl,
      color: 'bg-cyan-500',
      tag: rtl ? 'الكحول الإيثيلي' : 'Ethanol',
    },
    {
      id: 'water',
      titleAr: 'الخطوة 5: إضافة الماء المقطر (إن وجد) وإحكام الإغلاق',
      titleEn: 'Step 5: Add Distilled Water & Seal',
      descAr: result.waterWeightGrams > 0
        ? `أضف الماء المقطر (${formatNum(result.waterWeightGrams)} جم). الوزن النهائي الكامل للزجاجة: ${formatNum(result.totalWeightGrams)} جم.`
        : `اكتمل وزن التركيبة بالكامل! الوزن الصافي النهائي: ${formatNum(result.totalWeightGrams)} جم. رج الزجاجة بلطف ودعها للتعتيق.`,
      descEn: result.waterWeightGrams > 0
        ? `Add distilled water (${formatNum(result.waterWeightGrams)} g). Final net formulation weight: ${formatNum(result.totalWeightGrams)} g.`
        : `Formula compounding completed! Final net bottle weight: ${formatNum(result.totalWeightGrams)} g. Shake gently and set for maceration.`,
      targetGrams: result.waterWeightGrams,
      cumulativeGrams: result.totalWeightGrams,
      volumeMl: result.waterVolumeMl,
      color: 'bg-blue-400',
      tag: rtl ? 'الماء المقطر / الإتمام' : 'Water / Completion',
    },
  ];

  const activeStepObj = steps[currentStep];

  // Visual percentages inside the beaker
  const oilHeightPct = Math.max(8, (result.oilVolumeMl / result.totalVolumeMl) * 100);
  const alcoholHeightPct = Math.max(15, (result.alcoholVolumeMl / result.totalVolumeMl) * 100);
  const waterHeightPct = result.waterVolumeMl > 0 ? (result.waterVolumeMl / result.totalVolumeMl) * 100 : 0;
  const fixativeHeightPct = result.fixativeVolumeMl > 0 ? (result.fixativeVolumeMl / result.totalVolumeMl) * 100 : 0;

  return (
    <div className="bg-white rounded-3xl border border-stone-200/90 shadow-md p-5 sm:p-7 space-y-6 animate-in fade-in">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold border border-amber-200 mb-1">
            <Scale className="w-3.5 h-3.5 text-amber-800" />
            <span>{rtl ? 'محاكي ميزان الصياغة البصري (0.01g Digital Balance)' : 'Visual Laboratory Balance Simulator (0.01g)'}</span>
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-stone-950 font-serif-luxury">
            {rtl ? 'توزين المواد الخام بدقة الميزان والقطارة' : 'Precision Gravimetric Weighing & Beaker Simulator'}
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            {rtl
              ? `محاكاة بصرية حية لمقادير زجاجة ${formulation.bottleVolumeMl} مل بتركيز ${formulation.concentrationPercent}% مع حساب القطرات وقيم التصفير (Tare).`
              : `Live visual simulation for a ${formulation.bottleVolumeMl}ml bottle @ ${formulation.concentrationPercent}% with drops and tare values.`}
          </p>
        </div>

        {/* Mode switcher tabs */}
        <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl text-xs font-semibold shrink-0">
          <button
            type="button"
            onClick={() => setSimulatorMode('all')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              simulatorMode === 'all'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            {rtl ? '📊 النظرة الشاملة' : '📊 Overall Mass'}
          </button>
          <button
            type="button"
            onClick={() => {
              setSimulatorMode('step');
              setCurrentStep(1);
            }}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              simulatorMode === 'step'
                ? 'bg-amber-800 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            {rtl ? '🧪 خطوة بخطوة (التصفير)' : '🧪 Step-by-Step (Tare)'}
          </button>
        </div>
      </div>

      {/* Main Interactive Stage: Scale LCD on Left, Glass Beaker on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        
        {/* Left: The Virtual Digital Balance Display */}
        <div className="lg:col-span-7 bg-stone-950 rounded-2xl p-5 sm:p-6 text-white border border-stone-800 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-stone-800/80 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono text-xs font-bold text-stone-300 tracking-wider">
                SHAM PRECISION LAB BALANCE · 0.01g
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-stone-400">
              <button
                type="button"
                onClick={() => setIsTared(!isTared)}
                className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                  isTared
                    ? 'bg-emerald-950 border-emerald-500 text-emerald-300 font-bold'
                    : 'bg-stone-800 border-stone-700 hover:bg-stone-700 text-stone-300'
                }`}
              >
                [TARE] {isTared ? 'TARED' : 'ZERO'}
              </button>
              <button
                type="button"
                onClick={() => setPipetteDropMode(pipetteDropMode === 'grams' ? 'drops' : 'grams')}
                className="px-2 py-0.5 rounded bg-stone-800 border border-stone-700 hover:bg-stone-700 text-stone-300 cursor-pointer"
              >
                {pipetteDropMode === 'grams' ? 'UNIT: g' : 'UNIT: DROPS'}
              </button>
            </div>
          </div>

          {/* Large Glow LCD Readout */}
          <div className="bg-stone-900/90 rounded-xl p-4 sm:p-5 border border-stone-800 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-mono text-stone-400 uppercase tracking-wider mb-1">
                {simulatorMode === 'all'
                  ? (rtl ? 'إجمالي وزن التركيبة الصافي' : 'Net Formulation Mass')
                  : (activeStepObj.tag)}
              </div>
              <div className="text-3xl sm:text-5xl font-mono-numbers font-black tracking-tight text-amber-400 flex items-baseline gap-2">
                <span>
                  {simulatorMode === 'all'
                    ? formatNum(result.totalWeightGrams, 2)
                    : isTared
                    ? '0.00'
                    : formatNum(activeStepObj.cumulativeGrams, 2)}
                </span>
                <span className="text-lg sm:text-2xl font-light text-stone-500 font-sans">
                  {pipetteDropMode === 'grams' ? 'g' : 'drops'}
                </span>
              </div>
            </div>

            <div className="text-right font-mono text-xs space-y-1">
              <div className="text-stone-400">
                {rtl ? 'الحجم:' : 'Vol:'}{' '}
                <span className="text-white font-bold">{formulation.bottleVolumeMl} ml</span>
              </div>
              <div className="text-stone-400">
                {rtl ? 'التركيز:' : 'Conc:'}{' '}
                <span className="text-amber-300 font-bold">{formulation.concentrationPercent}%</span>
              </div>
              <div className="text-stone-500 text-[10px]">
                {rtl ? 'كثافة المركب: ~0.83 جم/مل' : 'Blend Dens: ~0.83 g/ml'}
              </div>
            </div>
          </div>

          {/* Interactive Material Mass Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* Fragrance Oil Card */}
            <div className="p-3 bg-stone-900/80 rounded-xl border border-amber-900/40 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="truncate">{rtl ? 'الزيت العطري' : 'Fragrance Oil'}</span>
              </div>
              <div className="text-base sm:text-lg font-mono-numbers font-extrabold text-amber-200">
                {formatNum(result.oilWeightGrams)} g
              </div>
              <div className="text-[10px] text-stone-400 font-mono-numbers flex justify-between">
                <span>{formatNum(result.oilVolumeMl)} ml</span>
                <span>~{Math.round(result.oilWeightGrams * OIL_DROPS_PER_GRAM)} 💧</span>
              </div>
            </div>

            {/* Alcohol Card */}
            <div className="p-3 bg-stone-900/80 rounded-xl border border-cyan-900/40 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-400">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span className="truncate">{rtl ? 'كحول إيثيلي' : 'Ethanol 96%'}</span>
              </div>
              <div className="text-base sm:text-lg font-mono-numbers font-extrabold text-cyan-200">
                {formatNum(result.alcoholWeightGrams)} g
              </div>
              <div className="text-[10px] text-stone-400 font-mono-numbers flex justify-between">
                <span>{formatNum(result.alcoholVolumeMl)} ml</span>
                <span>~{Math.round(result.alcoholWeightGrams * ALCOHOL_DROPS_PER_GRAM)} 💧</span>
              </div>
            </div>

            {/* Fixative Card */}
            <div className="p-3 bg-stone-900/80 rounded-xl border border-emerald-900/40 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="truncate">{rtl ? 'المثبت العطري' : 'Fixative'}</span>
              </div>
              <div className="text-base sm:text-lg font-mono-numbers font-extrabold text-emerald-200">
                {formatNum(result.fixativeWeightGrams)} g
              </div>
              <div className="text-[10px] text-stone-400 font-mono-numbers flex justify-between">
                <span>{formatNum(result.fixativeVolumeMl)} ml</span>
                <span>~{Math.round(result.fixativeWeightGrams * OIL_DROPS_PER_GRAM)} 💧</span>
              </div>
            </div>

            {/* Distilled Water Card */}
            <div className="p-3 bg-stone-900/80 rounded-xl border border-blue-900/40 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-400">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="truncate">{rtl ? 'ماء مقطر' : 'Distilled Water'}</span>
              </div>
              <div className="text-base sm:text-lg font-mono-numbers font-extrabold text-blue-200">
                {formatNum(result.waterWeightGrams)} g
              </div>
              <div className="text-[10px] text-stone-400 font-mono-numbers flex justify-between">
                <span>{formatNum(result.waterVolumeMl)} ml</span>
                <span>~{Math.round(result.waterWeightGrams * 20)} 💧</span>
              </div>
            </div>
          </div>

          {/* Step-by-Step Navigation if active */}
          {simulatorMode === 'step' && (
            <div className="pt-2 border-t border-stone-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-300">
                  {rtl ? activeStepObj.titleAr : activeStepObj.titleEn}
                </span>
                <span className="font-mono text-stone-400">
                  {currentStep + 1} / {steps.length}
                </span>
              </div>
              <p className="text-xs text-stone-300 leading-relaxed bg-stone-900/60 p-2.5 rounded-lg border border-stone-800">
                {rtl ? activeStepObj.descAr : activeStepObj.descEn}
              </p>
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  disabled={currentStep === 0}
                  onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
                  className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <PrevArrow className="w-3.5 h-3.5" />
                  <span>{rtl ? 'السابق' : 'Previous'}</span>
                </button>

                <div className="flex items-center gap-1">
                  {steps.map((s, idx) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setCurrentStep(idx)}
                      className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
                        currentStep === idx
                          ? 'bg-amber-400 w-5'
                          : 'bg-stone-700 hover:bg-stone-500'
                      }`}
                      title={rtl ? s.titleAr : s.titleEn}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  disabled={currentStep === steps.length - 1}
                  onClick={() => setCurrentStep(prev => Math.min(steps.length - 1, prev + 1))}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-600 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span>{rtl ? 'التالي' : 'Next'}</span>
                  <NextArrow className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Realistic Glass Laboratory Beaker with Layer Fill */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center p-4 bg-stone-50 rounded-2xl border border-stone-200">
          <div className="text-xs font-bold text-stone-700 mb-2 flex items-center gap-1.5">
            <Beaker className="w-4 h-4 text-amber-700" />
            <span>{rtl ? 'مستوى الامتلاء في وعاء الخلط' : 'Glass Beaker Stratified Fill'}</span>
          </div>

          {/* Visual Glass Beaker Body */}
          <div className="relative w-44 h-64 border-4 border-t-0 border-stone-300 rounded-b-3xl bg-stone-100/50 overflow-hidden shadow-inner flex flex-col justify-end">
            
            {/* Beaker Measurement Ticks (Graduations) */}
            <div className="absolute inset-y-0 right-1 flex flex-col justify-between py-4 text-[9px] font-mono font-bold text-stone-400 pointer-events-none select-none">
              <span>{formulation.bottleVolumeMl}ml —</span>
              <span>{Math.round(formulation.bottleVolumeMl * 0.75)}ml —</span>
              <span>{Math.round(formulation.bottleVolumeMl * 0.50)}ml —</span>
              <span>{Math.round(formulation.bottleVolumeMl * 0.25)}ml —</span>
              <span>0ml —</span>
            </div>

            {/* Headspace indicator line */}
            <div className="absolute top-2 left-2 text-[9px] text-stone-400 font-mono flex items-center gap-1">
              <span>↑ {rtl ? 'فراغ هوائي 4%' : 'Headspace 4%'}</span>
            </div>

            {/* Liquid Layers Stack from Bottom to Top */}
            {/* Layer 1: Fragrance Oil (Bottom Layer) */}
            <div
              style={{ height: `${oilHeightPct}%` }}
              className="w-full bg-gradient-to-t from-amber-600 to-amber-500 transition-all duration-500 relative flex items-center justify-center text-amber-950 font-bold text-[10px] shadow-sm border-t border-amber-400/50"
              title={`Fragrance Oil: ${formatNum(result.oilWeightGrams)}g`}
            >
              <span className="truncate px-1 drop-shadow-xs">
                {rtl ? 'زيت خام' : 'Oil'} ({formatNum(result.oilWeightGrams)}g)
              </span>
            </div>

            {/* Layer 2: Fixative (if present) */}
            {result.fixativeWeightGrams > 0 && (
              <div
                style={{ height: `${Math.max(6, fixativeHeightPct)}%` }}
                className="w-full bg-gradient-to-t from-emerald-600 to-emerald-500 transition-all duration-500 relative flex items-center justify-center text-emerald-950 font-bold text-[9px] border-t border-emerald-400/50"
                title={`Fixative: ${formatNum(result.fixativeWeightGrams)}g`}
              >
                <span className="truncate px-1 drop-shadow-xs">
                  {rtl ? 'مثبت' : 'Fix'} ({formatNum(result.fixativeWeightGrams)}g)
                </span>
              </div>
            )}

            {/* Layer 3: Distilled Water (if present) */}
            {result.waterWeightGrams > 0 && (
              <div
                style={{ height: `${Math.max(6, waterHeightPct)}%` }}
                className="w-full bg-gradient-to-t from-blue-400 to-blue-300 transition-all duration-500 relative flex items-center justify-center text-blue-950 font-bold text-[9px] border-t border-blue-200/50"
                title={`Water: ${formatNum(result.waterWeightGrams)}g`}
              >
                <span className="truncate px-1">
                  {rtl ? 'ماء' : 'H₂O'} ({formatNum(result.waterWeightGrams)}g)
                </span>
              </div>
            )}

            {/* Layer 4: Ethanol Alcohol (Upper Carrier Layer) */}
            <div
              style={{ height: `${alcoholHeightPct}%` }}
              className="w-full bg-gradient-to-t from-cyan-300/80 to-cyan-200/60 transition-all duration-500 relative flex items-center justify-center text-cyan-950 font-bold text-[10px] border-t border-cyan-100"
              title={`Ethanol: ${formatNum(result.alcoholWeightGrams)}g`}
            >
              <span className="truncate px-1 drop-shadow-xs">
                {rtl ? 'كحول 96%' : 'Ethanol'} ({formatNum(result.alcoholWeightGrams)}g)
              </span>
            </div>

          </div>

          <div className="mt-3 text-center">
            <span className="text-[11px] font-bold text-stone-800 block">
              {rtl ? 'إجمالي السائل في الزجاجة:' : 'Total Bottle Contents:'}
            </span>
            <span className="text-xs font-mono-numbers font-extrabold text-amber-900">
              {formatNum(result.totalWeightGrams)} g · {formulation.bottleVolumeMl} ml
            </span>
          </div>
        </div>

      </div>

      {/* Individual Pyramid Notes Detailed Grams Breakdown (if Pyramid Notes exist) */}
      {pyramidNotes.length > 0 && (
        <div className="pt-4 border-t border-stone-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-700" />
              <h4 className="text-xs sm:text-sm font-bold text-stone-900">
                {rtl
                  ? `أوزان نوتات الهرم العطري بالجرام (من أصل ${formatNum(result.oilWeightGrams)} جم زيت خام):`
                  : `Individual Pyramid Notes Mass Breakdown (out of ${formatNum(result.oilWeightGrams)}g total oil):`}
              </h4>
            </div>
            <span className="text-[11px] text-stone-500 font-mono-numbers">
              {pyramidNotes.length} {rtl ? 'مكونات عطرية' : 'accords'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {pyramidNotes.map((note) => {
              // Exact note grams in this specific bottle volume
              const noteGrams = (result.oilWeightGrams * note.percentageOfOil) / 100;
              const noteDrops = Math.round(noteGrams * OIL_DROPS_PER_GRAM);

              return (
                <div
                  key={note.id}
                  className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 flex items-center justify-between hover:bg-stone-100/80 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        note.category === 'top'
                          ? 'bg-amber-500'
                          : note.category === 'heart'
                          ? 'bg-stone-600'
                          : 'bg-stone-950'
                      }`}
                    />
                    <div className="min-w-0">
                      <span className="font-bold text-xs text-stone-900 block truncate">
                        {rtl ? note.nameAr : (note.nameEn || note.nameAr)}
                      </span>
                      <span className="text-[10px] text-stone-400 block font-mono-numbers">
                        {note.percentageOfOil}% {rtl ? 'من الزيت' : 'of oil'}
                      </span>
                    </div>
                  </div>

                  <div className="text-left font-mono-numbers shrink-0">
                    <div className="text-xs font-extrabold text-amber-900">
                      {formatNum(noteGrams, 3)} g
                    </div>
                    <div className="text-[10px] text-stone-500">
                      ~{noteDrops} 💧
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Laboratory Tip banner */}
      <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200/70 flex items-start gap-2.5 text-xs text-amber-950">
        <Info className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
        <div className="leading-relaxed text-[11px]">
          <span className="font-bold block mb-0.5">
            {rtl ? 'القاعدة الذهبية لصياغة العطور الاحترافية:' : 'Master Perfumer Golden Weighing Rule:'}
          </span>
          {rtl
            ? 'احرص دائماً على صب الزيت العطري أولاً في الزجاجة أو الوعاء، ثم إضافة الكحول فوقه، وليس العكس؛ حيث يضمن ذلك امتزاج جزيئات الزيت الثقيلة مع الكحول بسرعة ومنع حدوث أي تعكر أو انفصال طبقي.'
            : 'Always add fragrance oils to the vessel first, then pour alcohol over them, not vice versa. This optimizes molecular diffusion and prevents clouding or phase separation.'}
        </div>
      </div>
    </div>
  );
};
