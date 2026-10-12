import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  Package,
  Layers,
  HelpCircle,
  FileSpreadsheet,
  PieChart,
  Globe,
  Coins,
  ArrowRightLeft,
  Search,
} from 'lucide-react';
import { CalculationResult, CostingState, FormulationState } from '../types/perfume';
import {
  WORLD_CURRENCIES,
  WorldCurrency,
  findCurrencyByCode,
  convertCurrency,
} from '../data/worldCurrencies';
import { calculatePerfumeCosting, formatNum } from '../utils/calculations';
import { SupportedLanguage } from '../types/i18n';
import { isRTL } from '../utils/localizedContent';

interface CostCalculatorProps {
  currentLang?: SupportedLanguage;
  formulation: FormulationState;
  calculationResult: CalculationResult;
  currentCurrencyCode?: string;
}

const POPULAR_CURRENCIES = [
  'SAR', 'AED', 'KWD', 'QAR', 'BHD', 'OMR', 'EGP', 'JOD', 'IQD', 'MAD', 'DZD', 'USD', 'EUR', 'GBP', 'TRY'
];

export const CostCalculator: React.FC<CostCalculatorProps> = ({
  currentLang = 'ar',
  formulation,
  calculationResult,
  currentCurrencyCode = 'SAR',
}) => {
  const rtl = isRTL(currentLang);
  const [costing, setCosting] = useState<CostingState>({
    oilCostPerKg: 650, // default SAR per kg for premium French/Oriental oil
    alcoholCostPerLiter: 35, // default SAR per liter
    bottleUnitCost: 18, // bottle + atomizer + cap
    packagingUnitCost: 12, // luxury outer box + cellophane + labels
    laborAndOverheadPerUnit: 6, // labor & blending
    batchSize: 50, // default batch of 50 bottles
    targetMarginPercent: 80, // 80% markup
    currency: currentCurrencyCode || 'SAR',
  });

  // Comparison custom currency for export benchmarking
  const [comparisonCurrency, setComparisonCurrency] = useState<string>('USD');

  // Sync if parent updates current currency code
  useEffect(() => {
    if (currentCurrencyCode && currentCurrencyCode !== costing.currency) {
      setCosting((prev) => ({ ...prev, currency: currentCurrencyCode }));
    }
  }, [currentCurrencyCode]);

  const costResult = calculatePerfumeCosting(calculationResult, costing);
  const activeCurrency = findCurrencyByCode(costing.currency);

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="border-b border-stone-200/80 pb-5">
        <h2 className="text-xl sm:text-2xl font-bold text-stone-900 font-serif-luxury">
          {rtl ? 'حاسبة التكاليف الصناعية وهوامش الأرباح والتسعير' : 'Manufacturing Costing, Pricing & Profit Margins'}
        </h2>
        <p className="text-stone-500 text-sm mt-1">
          {rtl
            ? 'احسب التكلفة المباشرة للزجاجة والكرتونة، وحدد سعر الجملة وسعر البيع المقترح للمستهلك مع هوامش أرباح التشغيلة.'
            : 'Calculate unit costs per flacon, carton packaging, and optimize wholesale & suggested retail prices with profit forecasts.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Cost Inputs */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-5">
            <div className="space-y-3 pb-3 border-b border-stone-100">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <span className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-amber-700" />
                  <span>{rtl ? 'تكاليف المواد الأولية والتعبئة والتسعير' : 'Raw Materials, Packaging & Compounding Costs'}</span>
                </span>
                
                {/* All World Currencies Selector */}
                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs">
                    <span className="text-base">{activeCurrency.flag}</span>
                    <select
                      value={costing.currency}
                      onChange={(e) =>
                        setCosting((prev) => ({ ...prev, currency: e.target.value }))
                      }
                      className="bg-transparent font-bold text-stone-900 focus:outline-none cursor-pointer max-w-[220px]"
                    >
                      {WORLD_CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.code} - {rtl ? c.nameAr : c.nameEn} ({rtl ? c.symbolAr : c.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Quick Popular Currency Selector Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
                <span className="text-stone-400 font-semibold shrink-0">{rtl ? 'اختيار سريع:' : 'Quick Select:'}</span>
                {POPULAR_CURRENCIES.map((code) => {
                  const curr = findCurrencyByCode(code);
                  const isSelected = costing.currency === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setCosting((prev) => ({ ...prev, currency: code }))}
                      className={`whitespace-nowrap px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-800 text-white shadow-xs scale-105'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      <span>{curr.flag}</span>
                      <span>{code}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Input Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Fragrance Oil Cost */}
              <div>
                <label className="text-xs font-medium text-stone-700 mb-1 block">
                  {rtl ? `سعر الزيت العطري الخام (${costing.currency} / كجم)` : `Raw Perfume Oil Cost (${costing.currency} / kg)`}
                </label>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={costing.oilCostPerKg}
                  onChange={(e) =>
                    setCosting((prev) => ({
                      ...prev,
                      oilCostPerKg: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className={`w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm font-mono-numbers text-stone-900 focus:outline-none focus:border-amber-700 ${rtl ? 'text-right' : 'text-left'}`}
                />
                <span className="text-[10px] text-stone-400">
                  {rtl ? '(الكيلو = 1,000 جرام)' : '(1 kg = 1,000 grams)'}
                </span>
              </div>

              {/* Alcohol Cost */}
              <div>
                <label className="text-xs font-medium text-stone-700 mb-1 block">
                  {rtl ? `سعر الكحول الإيثيلي (${costing.currency} / لتر)` : `Perfumer Ethanol Cost (${costing.currency} / liter)`}
                </label>
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={costing.alcoholCostPerLiter}
                  onChange={(e) =>
                    setCosting((prev) => ({
                      ...prev,
                      alcoholCostPerLiter: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className={`w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm font-mono-numbers text-stone-900 focus:outline-none focus:border-amber-700 ${rtl ? 'text-right' : 'text-left'}`}
                />
                <span className="text-[10px] text-stone-400">
                  {rtl ? '(اللتر = 1,000 مل)' : '(1 liter = 1,000 ml)'}
                </span>
              </div>

              {/* Bottle & Atomizer */}
              <div>
                <label className="text-xs font-medium text-stone-700 mb-1 block">
                  {rtl ? `تكلفة الزجاجة + البخاخ + الغطاء (${costing.currency})` : `Bottle + Atomizer + Cap Unit Cost (${costing.currency})`}
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={costing.bottleUnitCost}
                  onChange={(e) =>
                    setCosting((prev) => ({
                      ...prev,
                      bottleUnitCost: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className={`w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm font-mono-numbers text-stone-900 focus:outline-none focus:border-amber-700 ${rtl ? 'text-right' : 'text-left'}`}
                />
              </div>

              {/* Outer Box & Packaging */}
              <div>
                <label className="text-xs font-medium text-stone-700 mb-1 block">
                  {rtl ? `تكلفة العلبة الفاخرة والملصقات (${costing.currency})` : `Luxury Box + Labels Unit Cost (${costing.currency})`}
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={costing.packagingUnitCost}
                  onChange={(e) =>
                    setCosting((prev) => ({
                      ...prev,
                      packagingUnitCost: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className={`w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm font-mono-numbers text-stone-900 focus:outline-none focus:border-amber-700 ${rtl ? 'text-right' : 'text-left'}`}
                />
              </div>

              {/* Labor & Overhead */}
              <div>
                <label className="text-xs font-medium text-stone-700 mb-1 block">
                  {rtl ? `مصاريف التشغيل والخلط لكل زجاجة (${costing.currency})` : `Labor & Atelier Overhead per Unit (${costing.currency})`}
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={costing.laborAndOverheadPerUnit}
                  onChange={(e) =>
                    setCosting((prev) => ({
                      ...prev,
                      laborAndOverheadPerUnit: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className={`w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm font-mono-numbers text-stone-900 focus:outline-none focus:border-amber-700 ${rtl ? 'text-right' : 'text-left'}`}
                />
              </div>

              {/* Batch Size */}
              <div>
                <label className="text-xs font-medium text-stone-700 mb-1 block">
                  {rtl ? 'حجم دفعة الإنتاج (عدد الزجاجات)' : 'Production Batch Size (Bottles)'}
                </label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  step="10"
                  value={costing.batchSize}
                  onChange={(e) =>
                    setCosting((prev) => ({
                      ...prev,
                      batchSize: Math.max(1, parseInt(e.target.value) || 1),
                    }))
                  }
                  className={`w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm font-mono-numbers text-stone-900 focus:outline-none focus:border-amber-700 ${rtl ? 'text-right' : 'text-left'}`}
                />
              </div>
            </div>

            {/* Profit Margin Slider */}
            <div className="pt-4 border-t border-stone-100 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-stone-800">
                  {rtl ? 'هامش الربح المستهدف للتجزئة (Retail Markup Margin)' : 'Target Retail Markup Margin'}
                </span>
                <span className="font-mono-numbers font-bold text-amber-900 bg-amber-50 px-2.5 py-0.5 rounded">
                  {costing.targetMarginPercent}%
                </span>
              </div>
              <input
                type="range"
                min="20"
                max="300"
                step="5"
                value={costing.targetMarginPercent}
                onChange={(e) =>
                  setCosting((prev) => ({
                    ...prev,
                    targetMarginPercent: parseFloat(e.target.value),
                  }))
                }
                className="w-full accent-amber-800 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-stone-400 font-mono-numbers">
                <span>30% ({rtl ? 'اقتصادي' : 'Economy'})</span>
                <span>80% ({rtl ? 'متوسط تجاري' : 'Standard'})</span>
                <span>150% ({rtl ? 'براند نيش فاخر' : 'Luxury Niche'})</span>
                <span>300% ({rtl ? 'حصري' : 'Exclusive'})</span>
              </div>
            </div>

          </div>
        </div>

        {/* Right Column: Pricing & ROI Dashboard */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-md space-y-6">
            <div className="border-b border-stone-100 pb-3">
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wider block">
                {rtl ? `مؤشرات التسعير والأرباح للزجاجة (${formulation.bottleVolumeMl} مل)` : `Unit Pricing & Profit Metrics (${formulation.bottleVolumeMl} ml)`}
              </span>
              <h3 className="text-lg font-bold text-stone-950 mt-0.5">
                {rtl ? 'تكلفة الإنتاج:' : 'Manufacturing Cost:'} {formatNum(costResult.totalCostPerBottle)} {costing.currency}
              </h3>
            </div>

            {/* Breakdown per Bottle */}
            <div className="space-y-2.5">
              <div className="text-xs font-semibold text-stone-700">
                {rtl ? 'تفاصيل تكلفة الزجاجة الواحدة:' : 'Per-Bottle Cost Breakdown:'}
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-stone-100 text-stone-600">
                  <span>{rtl ? `الزيت العطري (${formatNum(calculationResult.oilWeightGrams)} جم)` : `Perfume Oil (${formatNum(calculationResult.oilWeightGrams)} g)`}</span>
                  <span className="font-mono-numbers font-medium text-stone-900">
                    {formatNum(costResult.oilCostPerBottle)} {costing.currency}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-stone-100 text-stone-600">
                  <span>{rtl ? `الكحول والمذيبات (${formatNum(calculationResult.alcoholVolumeMl)} مل)` : `Ethanol & Solvents (${formatNum(calculationResult.alcoholVolumeMl)} ml)`}</span>
                  <span className="font-mono-numbers font-medium text-stone-900">
                    {formatNum(costResult.alcoholCostPerBottle)} {costing.currency}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-stone-100 text-stone-600">
                  <span>{rtl ? 'الزجاجة والعلبة والتغليف' : 'Flacon, Atomizer & Packaging'}</span>
                  <span className="font-mono-numbers font-medium text-stone-900">
                    {formatNum(costResult.packagingCostPerBottle)} {costing.currency}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-stone-100 text-stone-600">
                  <span>{rtl ? 'المصاريف التشغيلية والعمالة' : 'Overhead & Compounding Labor'}</span>
                  <span className="font-mono-numbers font-medium text-stone-900">
                    {formatNum(costResult.laborCostPerBottle)} {costing.currency}
                  </span>
                </div>
              </div>
            </div>

            {/* Recommended Pricing Targets */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl space-y-1">
                <span className="text-[11px] text-stone-500 font-medium block">
                  {rtl ? 'سعر الجملة المقترح' : 'Suggested Wholesale'}
                </span>
                <div className="text-base font-extrabold text-stone-900 font-mono-numbers">
                  {formatNum(costResult.suggestedWholesalePrice)} {costing.currency}
                </div>
              </div>

              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                <span className="text-[11px] text-amber-900 font-medium block">
                  {rtl ? 'سعر التجزئة المقترح (RRP)' : 'Suggested Retail (RRP)'}
                </span>
                <div className="text-lg font-extrabold text-amber-950 font-mono-numbers">
                  {formatNum(costResult.suggestedRetailPrice)} {costing.currency}
                </div>
                <div className="text-[10px] text-amber-700">
                  {rtl ? 'صافي الربح:' : 'Net Profit:'} +{formatNum(costResult.profitPerBottleRetail)} {costing.currency}
                </div>
              </div>
            </div>

            {/* Batch Totals Summary */}
            <div className="p-4 bg-stone-900 text-white rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-stone-800">
                <span className="text-stone-300 font-medium">
                  {rtl ? `عوائد التشغيلة الإجمالية (${costing.batchSize} عبوة):` : `Batch Financial Forecast (${costing.batchSize} Units):`}
                </span>
                <span className="text-amber-400 font-mono-numbers font-bold">
                  +{costing.targetMarginPercent}% {rtl ? 'ربح' : 'Margin'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] text-stone-400">{rtl ? 'رأس المال المطلوب' : 'Required Capital'}</div>
                  <div className="text-xs sm:text-sm font-bold font-mono-numbers text-stone-200 mt-0.5">
                    {formatNum(costResult.totalBatchCost)} {costing.currency}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-stone-400">{rtl ? 'إجمالي المبيعات' : 'Gross Revenue'}</div>
                  <div className="text-xs sm:text-sm font-bold font-mono-numbers text-white mt-0.5">
                    {formatNum(costResult.totalBatchRevenueRetail)} {costing.currency}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-amber-400">{rtl ? 'صافي الأرباح' : 'Net Profit'}</div>
                  <div className="text-xs sm:text-sm font-bold font-mono-numbers text-amber-400 mt-0.5">
                    +{formatNum(costResult.totalBatchProfitRetail)} {costing.currency}
                  </div>
                </div>
              </div>
            </div>

            {/* Global Multi-Currency Export & Pricing Table */}
            <div className="p-4 sm:p-5 bg-gradient-to-br from-stone-50 via-white to-amber-50/50 border border-amber-200 rounded-2xl shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-stone-200/80 pb-3">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-amber-700" />
                  <span className="text-xs font-bold text-stone-900">
                    {rtl ? 'جدول مقارنة الأسعار بالعملات العالمية والتصدير' : 'Global Multi-Currency Export Benchmarking'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="text-stone-500">{rtl ? 'مقارنة مع:' : 'Compare with:'}</span>
                  <select
                    value={comparisonCurrency}
                    onChange={(e) => setComparisonCurrency(e.target.value)}
                    className="px-2 py-0.5 bg-white border border-stone-300 rounded-lg text-xs font-bold text-stone-800 cursor-pointer"
                  >
                    {WORLD_CURRENCIES.map((c) => (
                      <option key={`comp-${c.code}`} value={c.code}>
                        {c.flag} {c.code} ({rtl ? c.symbolAr : c.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-[11px] text-stone-500 leading-relaxed">
                {rtl
                  ? 'تحويل فوري لتكلفة وسعر بيع الزجاجة الواحدة وفق أسعار الصرف العالمية المرجعية لتسعير عطرك محلياً ودولياً:'
                  : 'Real-time conversion of per-bottle costs and retail pricing across international currencies for export markets:'}
              </p>

              <div className="overflow-x-auto">
                <table className={`w-full ${rtl ? 'text-right' : 'text-left'} text-xs`}>
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-500 font-semibold text-[11px]">
                      <th className="pb-2">{rtl ? 'العملة العالمية' : 'Currency'}</th>
                      <th className="pb-2">{rtl ? 'تكلفة الزجاجة' : 'Unit Cost'}</th>
                      <th className="pb-2">{rtl ? 'سعر الجملة' : 'Wholesale'}</th>
                      <th className="pb-2 text-amber-900 font-bold">{rtl ? 'سعر التجزئة (RRP)' : 'Retail (RRP)'}</th>
                      <th className="pb-2 text-emerald-700">{rtl ? 'صافي الربح' : 'Net Margin'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 font-mono-numbers">
                    {[
                      'USD',
                      'EUR',
                      'GBP',
                      'SAR',
                      'AED',
                      'EGP',
                      'KWD',
                      comparisonCurrency !== 'USD' &&
                      comparisonCurrency !== 'EUR' &&
                      comparisonCurrency !== 'GBP' &&
                      comparisonCurrency !== 'SAR' &&
                      comparisonCurrency !== 'AED' &&
                      comparisonCurrency !== 'EGP' &&
                      comparisonCurrency !== 'KWD'
                        ? comparisonCurrency
                        : 'TRY',
                    ].map((code) => {
                      const curr = findCurrencyByCode(code);
                      const costConv = convertCurrency(costResult.totalCostPerBottle, costing.currency, code);
                      const wholesaleConv = convertCurrency(costResult.suggestedWholesalePrice, costing.currency, code);
                      const retailConv = convertCurrency(costResult.suggestedRetailPrice, costing.currency, code);
                      const profitConv = convertCurrency(costResult.profitPerBottleRetail, costing.currency, code);
                      const isCostingBase = costing.currency === code;

                      return (
                        <tr
                          key={`row-${code}`}
                          className={`hover:bg-amber-50/50 transition-colors ${
                            isCostingBase ? 'bg-amber-100/50 font-bold' : ''
                          }`}
                        >
                          <td className="py-2.5 font-sans flex items-center gap-1.5 font-semibold text-stone-900">
                            <span>{curr.flag}</span>
                            <span>{rtl ? curr.nameAr : curr.nameEn}</span>
                            <span className="text-[10px] text-stone-500 font-mono">({code})</span>
                          </td>
                          <td className="py-2.5 text-stone-700">
                            {formatNum(costConv)} {rtl ? curr.symbolAr : curr.code}
                          </td>
                          <td className="py-2.5 text-stone-800">
                            {formatNum(wholesaleConv)} {rtl ? curr.symbolAr : curr.code}
                          </td>
                          <td className="py-2.5 font-bold text-amber-900">
                            {formatNum(retailConv)} {rtl ? curr.symbolAr : curr.code}
                          </td>
                          <td className="py-2.5 font-bold text-emerald-700">
                            +{formatNum(profitConv)} {rtl ? curr.symbolAr : curr.code}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="pt-2 border-t border-stone-200/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[10px] text-stone-400 font-mono">
                <span>{rtl ? '* أسعار الصرف مرجعية معيارية مبنية على مؤشر الدولار العالمي (160+ عملة عالمية مدعومة).' : '* Exchange rates are benchmark estimates referenced to global indices (160+ currencies supported).'}</span>
                <span className="text-amber-800 font-semibold">{rtl ? 'منصة صمم عطرك مع شام' : 'Sham Parfumerie Atelier'}</span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
