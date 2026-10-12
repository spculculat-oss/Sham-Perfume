import React, { useState } from 'react';
import {
  Beaker,
  Droplet,
  Info,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  Scale,
} from 'lucide-react';
import { calculateAlcoholDilution, formatNum } from '../utils/calculations';
import { SupportedLanguage } from '../types/i18n';
import { isRTL } from '../utils/localizedContent';

interface AlcoholDilutionCalculatorProps {
  currentLang?: SupportedLanguage;
}

export const AlcoholDilutionCalculator: React.FC<AlcoholDilutionCalculatorProps> = ({
  currentLang = 'ar',
}) => {
  const [initialPurity, setInitialPurity] = useState(96); // e.g. 96%
  const [targetPurity, setTargetPurity] = useState(80); // e.g. 80%
  const [desiredFinalVolume, setDesiredFinalVolume] = useState(1000); // 1000 ml (1 Liter)

  const rtl = isRTL(currentLang);
  const dilution = calculateAlcoholDilution(initialPurity, targetPurity, desiredFinalVolume);

  const handleInitialChange = (val: number) => {
    setInitialPurity(val);
    if (val <= targetPurity) {
      setTargetPurity(Math.max(50, val - 5));
    }
  };

  const ethanolDensity = initialPurity >= 99 ? 0.789 : initialPurity >= 95 ? 0.805 : 0.82;

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="border-b border-stone-200/80 pb-5">
        <h2 className="text-xl sm:text-2xl font-bold text-stone-900 font-serif-luxury">
          {rtl ? 'حاسبة تخفيف تركيز الكحول الإيثيلي' : 'Ethanol Alcohol Dilution Calculator'}
        </h2>
        <p className="text-stone-500 text-sm mt-1">
          {rtl
            ? 'تعديل درجة نقاء الكحول (مثلاً من 96% أو 99.9% إلى 80% أو 85%) باستخدام الماء المقطر وفق معادلة التخفيف وقانون حفظ الكتلة.'
            : 'Precise gravimetric and volumetric calculation of distilled water needed to dilute perfumer ethanol (C₁V₁ = C₂V₂).'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Input Parameters */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-5">
            <h3 className="text-sm font-bold text-stone-950 flex items-center gap-2">
              <Beaker className="w-4 h-4 text-amber-700" />
              <span>{rtl ? 'معايير سائل الكحول والهدف المطلوب' : 'Ethanol Concentration Parameters'}</span>
            </h3>

            {/* Initial Purity Input */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label className="font-semibold text-stone-800">
                  {rtl ? 'تركيز الكحول الخام المتوفر (C₁)' : 'Available Raw Alcohol Strength (C₁)'}
                </label>
                <span className="font-mono-numbers font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded">
                  {initialPurity}%
                </span>
              </div>
              <input
                type="range"
                min="70"
                max="100"
                step="0.5"
                value={initialPurity}
                onChange={(e) => handleInitialChange(parseFloat(e.target.value))}
                className="w-full accent-amber-800 cursor-pointer"
              />
              <div className="flex gap-2">
                {[96, 99.9, 95].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleInitialChange(val)}
                    className={`px-2.5 py-1 text-xs rounded border transition-colors cursor-pointer ${
                      initialPurity === val
                        ? 'bg-stone-900 text-white border-stone-900 font-bold'
                        : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    {val}%
                  </button>
                ))}
              </div>
            </div>

            {/* Target Purity Input */}
            <div className="space-y-2 pt-2">
              <div className="flex justify-between items-center text-xs">
                <label className="font-semibold text-stone-800">
                  {rtl ? 'تركيز الكحول النهائي المستهدف للعطر (C₂)' : 'Target Compound Strength (C₂)'}
                </label>
                <span className="font-mono-numbers font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded">
                  {targetPurity}%
                </span>
              </div>
              <input
                type="range"
                min="50"
                max={initialPurity - 1}
                step="0.5"
                value={targetPurity}
                onChange={(e) => setTargetPurity(parseFloat(e.target.value))}
                className="w-full accent-amber-800 cursor-pointer"
              />
              <div className="flex gap-2">
                {[80, 85, 70, 75].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setTargetPurity(val)}
                    className={`px-2.5 py-1 text-xs rounded border transition-colors cursor-pointer ${
                      targetPurity === val
                        ? 'bg-amber-900 text-white border-amber-900 font-bold'
                        : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    {val}%
                  </button>
                ))}
              </div>
            </div>

            {/* Final Batch Volume */}
            <div className="space-y-2 pt-2">
              <div className="flex justify-between items-center text-xs">
                <label className="font-semibold text-stone-800">
                  {rtl ? 'الحجم النهائي المطلوب تحضيره (V₂)' : 'Desired Final Batch Volume (V₂)'}
                </label>
                <span className="font-mono-numbers font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded">
                  {desiredFinalVolume} ml
                </span>
              </div>
              <input
                type="number"
                min="50"
                max="50000"
                step="50"
                value={desiredFinalVolume}
                onChange={(e) => setDesiredFinalVolume(Math.max(10, parseFloat(e.target.value) || 0))}
                className={`w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm font-mono-numbers ${rtl ? 'text-right' : 'text-left'} focus:bg-white focus:outline-none focus:border-amber-700`}
              />
              <div className="flex gap-2">
                {[250, 500, 1000, 5000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setDesiredFinalVolume(val)}
                    className={`px-2.5 py-1 text-xs rounded border transition-colors cursor-pointer ${
                      desiredFinalVolume === val
                        ? 'bg-stone-900 text-white border-stone-900 font-bold'
                        : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    {val >= 1000 ? `${val / 1000}L` : `${val}ml`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Scientific Info Box */}
          <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl text-xs space-y-2 text-stone-700 leading-relaxed">
            <div className="font-bold text-amber-950 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-amber-800" />
              <span>{rtl ? 'قانون التخفيف العلمي (C₁V₁ = C₂V₂)' : 'Volumetric Dilution Principle (C₁V₁ = C₂V₂)'}</span>
            </div>
            <p>
              {rtl
                ? 'عند إضافة الماء للكحول يحدث انكماش طفيف في الحجم المشترك (Volume Contraction) بسبب تشكل الروابط الهيدروجينية، لذلك يُنصح دائماً بالوزن بالجرام بدقة الميزان لضمان مطابقة التركيز الدوائي.'
                : 'When water is added to ethanol, a minor volume contraction occurs due to hydrogen bonding. For pharmaceutical accuracy, measuring mass in grams on analytical scales is recommended.'}
            </p>
          </div>
        </div>

        {/* Right Column: Dilution Results */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-stone-900 text-white p-6 rounded-3xl border border-stone-800 shadow-xl space-y-6">
            <div className="border-b border-stone-800 pb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{rtl ? 'نتائج المعايرة والخلط' : 'Compounding Recipe'}</span>
              </h3>
              <span className="text-[11px] font-mono text-stone-400">
                {targetPurity}% ABV
              </span>
            </div>

            {/* Main Required Quantities */}
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-stone-800/80 border border-stone-700/80 space-y-1">
                <span className="text-[11px] text-stone-300 block">
                  {rtl ? `1. حجم الكحول الخام المتوفر (${initialPurity}%) المطلوب:` : `1. Required Raw Alcohol (${initialPurity}%):`}
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono-numbers text-white">
                    {formatNum(dilution.requiredInitialVolumeMl, 2)}
                  </span>
                  <span className="text-xs font-semibold text-amber-400 font-mono-numbers">
                    ml ({formatNum(dilution.requiredInitialVolumeMl * ethanolDensity, 2)} g)
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/50 space-y-1">
                <span className="text-[11px] text-amber-200 block">
                  {rtl ? '2. حجم الماء المقطر الطبي الواجب إضافته:' : '2. Required Medical Distilled Water:'}
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono-numbers text-amber-400">
                    {formatNum(dilution.requiredWaterVolumeMl, 2)}
                  </span>
                  <span className="text-xs font-semibold text-emerald-300 font-mono-numbers">
                    ml ({formatNum(dilution.requiredWaterVolumeMl, 2)} g)
                  </span>
                </div>
              </div>
            </div>

            {/* Summary Specifications */}
            <div className="p-4 bg-stone-950/60 rounded-2xl border border-stone-800 text-xs space-y-2">
              <div className="flex justify-between text-stone-400">
                <span>{rtl ? 'الحجم النهائي المحضر:' : 'Target Final Volume:'}</span>
                <span className="font-mono-numbers font-bold text-white">{desiredFinalVolume} ml</span>
              </div>
              <div className="flex justify-between text-stone-400">
                <span>{rtl ? 'الوزن الكلي للخليط المخفف:' : 'Total Batch Weight:'}</span>
                <span className="font-mono-numbers font-bold text-amber-300">
                  {formatNum(dilution.requiredInitialVolumeMl * ethanolDensity + dilution.requiredWaterVolumeMl, 2)} g
                </span>
              </div>
              <div className="flex justify-between text-stone-400">
                <span>{rtl ? 'الكثافة التقديرية للخليط الناتج:' : 'Resulting Mixture Density:'}</span>
                <span className="font-mono-numbers text-stone-300">
                  {targetPurity >= 85 ? '0.835 g/ml' : targetPurity >= 80 ? '0.850 g/ml' : '0.875 g/ml'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
