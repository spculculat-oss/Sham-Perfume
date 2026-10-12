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

interface CostCalculatorProps {
  formulation: FormulationState;
  calculationResult: CalculationResult;
  currentCurrencyCode?: string;
}

const POPULAR_CURRENCIES = [
  'SAR', 'AED', 'KWD', 'QAR', 'BHD', 'OMR', 'EGP', 'JOD', 'IQD', 'MAD', 'DZD', 'USD', 'EUR', 'GBP', 'TRY'
];

export const CostCalculator: React.FC<CostCalculatorProps> = ({
  formulation,
  calculationResult,
  currentCurrencyCode = 'SAR',
}) => {
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
          حاسبة التكاليف الصناعية وهوامش الأرباح والتسعير
        </h2>
        <p className="text-stone-500 text-sm mt-1">
          احسب التكلفة المباشرة للزجاجة والكرتونة، وحدد سعر الجملة وسعر البيع المقترح للمستهلك مع هوامش أرباح التشغيلة.
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
                  <span>تكاليف المواد الأولية والتعبئة والتسعير</span>
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
                          {c.flag} {c.code} - {c.nameAr} ({c.symbolAr})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Quick Popular Currency Selector Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
                <span className="text-stone-400 font-semibold shrink-0">اختيار سريع:</span>
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
                  سعر الزيت العطري الخام ({costing.currency} / كجم)
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
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm font-mono-numbers text-stone-900 focus:outline-none focus:border-amber-700"
                />
                <span className="text-[10px] text-stone-400">
                  (الكيلو = 1,000 جرام)
                </span>
              </div>

              {/* Alcohol Cost */}
              <div>
                <label className="text-xs font-medium text-stone-700 mb-1 block">
                  سعر الكحول الإيثيلي ({costing.currency} / لتر)
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
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm font-mono-numbers text-stone-900 focus:outline-none focus:border-amber-700"
                />
                <span className="text-[10px] text-stone-400">
                  (اللتر = 1,000 مل)
                </span>
              </div>

              {/* Bottle & Atomizer */}
              <div>
                <label className="text-xs font-medium text-stone-700 mb-1 block">
                  تكلفة الزجاجة + البخاخ + الغطاء ({costing.currency})
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
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm font-mono-numbers text-stone-900 focus:outline-none focus:border-amber-700"
                />
              </div>

              {/* Outer Box & Packaging */}
              <div>
                <label className="text-xs font-medium text-stone-700 mb-1 block">
                  تكلفة العلبة الفاخرة والملصقات ({costing.currency})
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
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm font-mono-numbers text-stone-900 focus:outline-none focus:border-amber-700"
                />
              </div>

              {/* Labor & Overhead */}
              <div>
                <label className="text-xs font-medium text-stone-700 mb-1 block">
                  مصاريف التشغيل والخلط لكل زجاجة ({costing.currency})
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
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm font-mono-numbers text-stone-900 focus:outline-none focus:border-amber-700"
                />
              </div>

              {/* Batch Size */}
              <div>
                <label className="text-xs font-medium text-stone-700 mb-1 block">
                  حجم دفعة الإنتاج (عدد الزجاجات)
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
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm font-mono-numbers text-stone-900 focus:outline-none focus:border-amber-700"
                />
              </div>
            </div>

            {/* Profit Margin Slider */}
            <div className="pt-4 border-t border-stone-100 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-stone-800">
                  هامش الربح المستهدف للتجزئة (Retail Markup Margin)
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
                <span>30% (اقتصادي)</span>
                <span>80% (متوسط تجاري)</span>
                <span>150% (براند نيش فاخر)</span>
                <span>300% (حصري)</span>
              </div>
            </div>

          </div>
        </div>

        {/* Right Column: Pricing & ROI Dashboard */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-md space-y-6">
            <div className="border-b border-stone-100 pb-3">
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wider block">
                مؤشرات التسعير والأرباح للزجاجة ({formulation.bottleVolumeMl} مل)
              </span>
              <h3 className="text-lg font-bold text-stone-950 mt-0.5">
                تكلفة الإنتاج: {formatNum(costResult.totalCostPerBottle)} {costing.currency}
              </h3>
            </div>

            {/* Breakdown per Bottle */}
            <div className="space-y-2.5">
              <div className="text-xs font-semibold text-stone-700">
                تفاصيل تكلفة الزجاجة الواحدة:
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-stone-100 text-stone-600">
                  <span>الزيت العطري ({formatNum(calculationResult.oilWeightGrams)} جم)</span>
                  <span className="font-mono-numbers font-medium text-stone-900">
                    {formatNum(costResult.oilCostPerBottle)} {costing.currency}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-stone-100 text-stone-600">
                  <span>الكحول والمذيبات ({formatNum(calculationResult.alcoholVolumeMl)} مل)</span>
                  <span className="font-mono-numbers font-medium text-stone-900">
                    {formatNum(costResult.alcoholCostPerBottle)} {costing.currency}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-stone-100 text-stone-600">
                  <span>الزجاجة والعلبة والتغليف</span>
                  <span className="font-mono-numbers font-medium text-stone-900">
                    {formatNum(costResult.packagingCostPerBottle)} {costing.currency}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-stone-100 text-stone-600">
                  <span>المصاريف التشغيلية والعمالة</span>
                  <span className="font-mono-numbers font-medium text-stone-900">
                    {formatNum(costResult.laborCostPerBottle)} {costing.currency}
                  </span>
                </div>
              </div>
            </div>

            {/* Recommended Pricing Targets */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl space-y-1">
                <span className="text-[11px] text-stone-500 font-medium block">سعر الجملة المقترح</span>
                <div className="text-base font-extrabold text-stone-900 font-mono-numbers">
                  {formatNum(costResult.suggestedWholesalePrice)} {costing.currency}
                </div>
              </div>

              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                <span className="text-[11px] text-amber-900 font-medium block">سعر التجزئة المقترح (RRP)</span>
                <div className="text-lg font-extrabold text-amber-950 font-mono-numbers">
                  {formatNum(costResult.suggestedRetailPrice)} {costing.currency}
                </div>
                <div className="text-[10px] text-amber-700">
                  صافي الربح: +{formatNum(costResult.profitPerBottleRetail)} {costing.currency}
                </div>
              </div>
            </div>

            {/* Batch Totals Summary */}
            <div className="p-4 bg-stone-900 text-white rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-stone-800">
                <span className="text-stone-300 font-medium">
                  عوائد التشغيلة الإجمالية ({costing.batchSize} عبوة):
                </span>
                <span className="text-amber-400 font-mono-numbers font-bold">
                  +{costing.targetMarginPercent}% ربح
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] text-stone-400">رأس المال المطلوب</div>
                  <div className="text-xs sm:text-sm font-bold font-mono-numbers text-stone-200 mt-0.5">
                    {formatNum(costResult.totalBatchCost)} {costing.currency}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-stone-400">إجمالي المبيعات</div>
                  <div className="text-xs sm:text-sm font-bold font-mono-numbers text-white mt-0.5">
                    {formatNum(costResult.totalBatchRevenueRetail)} {costing.currency}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-amber-400">صافي الأرباح</div>
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
                    جدول مقارنة الأسعار بالعملات العالمية والتصدير
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="text-stone-500">مقارنة مع:</span>
                  <select
                    value={comparisonCurrency}
                    onChange={(e) => setComparisonCurrency(e.target.value)}
                    className="px-2 py-0.5 bg-white border border-stone-300 rounded-lg text-xs font-bold text-stone-800 cursor-pointer"
                  >
                    {WORLD_CURRENCIES.map((c) => (
                      <option key={`comp-${c.code}`} value={c.code}>
                        {c.flag} {c.code} ({c.symbolAr})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-[11px] text-stone-500 leading-relaxed">
                تحويل فوري لتكلفة وسعر بيع الزجاجة الواحدة وفق أسعار الصرف العالمية المرجعية لتسعير عطرك محلياً ودولياً:
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-500 font-semibold text-[11px]">
                      <th className="pb-2">العملة العالمية</th>
                      <th className="pb-2">تكلفة الزجاجة</th>
                      <th className="pb-2">سعر الجملة</th>
                      <th className="pb-2 text-amber-900 font-bold">سعر التجزئة (RRP)</th>
                      <th className="pb-2 text-emerald-700">صافي الربح</th>
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
                            <span>{curr.nameAr}</span>
                            <span className="text-[10px] text-stone-500 font-mono">({code})</span>
                          </td>
                          <td className="py-2.5 text-stone-700">
                            {formatNum(costConv)} {curr.symbolAr}
                          </td>
                          <td className="py-2.5 text-stone-800">
                            {formatNum(wholesaleConv)} {curr.symbolAr}
                          </td>
                          <td className="py-2.5 font-bold text-amber-900">
                            {formatNum(retailConv)} {curr.symbolAr}
                          </td>
                          <td className="py-2.5 font-bold text-emerald-700">
                            +{formatNum(profitConv)} {curr.symbolAr}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="pt-2 border-t border-stone-200/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[10px] text-stone-400 font-mono">
                <span>* أسعار الصرف مرجعية معيارية مبنية على مؤشر الدولار العالمي (160+ عملة عالمية مدعومة).</span>
                <span className="text-amber-800 font-semibold">منصة صمم عطرك مع شام</span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
