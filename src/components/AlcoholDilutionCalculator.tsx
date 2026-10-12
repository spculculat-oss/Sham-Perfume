import React, { useState } from 'react';
import {
  Beaker,
  Droplet,
  Info,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
} from 'lucide-react';
import { calculateAlcoholDilution, formatNum } from '../utils/calculations';

export const AlcoholDilutionCalculator: React.FC = () => {
  const [initialPurity, setInitialPurity] = useState(96); // e.g. 96%
  const [targetPurity, setTargetPurity] = useState(80); // e.g. 80%
  const [desiredFinalVolume, setDesiredFinalVolume] = useState(1000); // 1000 ml (1 Liter)

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
          حاسبة تخفيف تركيز الكحول الإيثيلي
        </h2>
        <p className="text-stone-500 text-sm mt-1">
          تعديل درجة نقاء الكحول (مثلاً من 96% أو 99.9% إلى 80% أو 85%) باستخدام الماء المقطر وفق معادلة التخفيف وقانون حفظ الكتلة.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Input Parameters */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-5">
            <h3 className="text-sm font-bold text-stone-950 flex items-center gap-2">
              <Beaker className="w-4 h-4 text-amber-700" />
              <span>معايير سائل الكحول والهدف المطلوب</span>
            </h3>

            {/* Initial Purity Input */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label className="font-semibold text-stone-800">
                  تركيز الكحول الخام المتوفر (C₁)
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
                    className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                      initialPurity === val
                        ? 'bg-stone-900 text-white border-stone-900'
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
                  تركيز الكحول النهائي المستهدف للعطر (C₂)
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
                    className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                      targetPurity === val
                        ? 'bg-amber-800 text-white border-amber-800'
                        : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    {val}% {val === 80 ? '(المعيار الذهبي)' : val === 85 ? '(فرنسي راقي)' : ''}
                  </button>
                ))}
              </div>
            </div>

            {/* Desired Volume Input */}
            <div className="pt-2">
              <label className="text-xs font-semibold text-stone-800 mb-1.5 block">
                الحجم الإجمالي المطلوب تحضيره (مل)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="number"
                  min="50"
                  max="100000"
                  step="50"
                  value={desiredFinalVolume}
                  onChange={(e) =>
                    setDesiredFinalVolume(Math.max(1, parseFloat(e.target.value) || 1))
                  }
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm font-mono-numbers text-stone-900 focus:outline-none focus:border-amber-700"
                />
                <div className="flex gap-1.5">
                  {[250, 500, 1000, 5000].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setDesiredFinalVolume(v)}
                      className={`px-2.5 py-1.5 text-xs rounded border transition-colors font-mono-numbers flex-1 ${
                        desiredFinalVolume === v
                          ? 'bg-stone-900 text-white border-stone-900 font-semibold'
                          : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                      }`}
                    >
                      {v >= 1000 ? `${v / 1000}L` : `${v}ml`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Scientific Context Card */}
          <div className="bg-stone-50 p-5 rounded-2xl border border-stone-200/80 space-y-3 text-xs text-stone-600">
            <div className="flex items-center gap-2 font-bold text-stone-900">
              <Info className="w-4 h-4 text-amber-700" />
              <span>لماذا يُخفف الكحول إلى 80% أو 85% في صناعة العطور؟</span>
            </div>
            <ul className="space-y-2 list-disc list-inside leading-relaxed text-[11px] text-stone-600">
              <li>
                <strong className="text-stone-800">إبطاء التبخر السريع:</strong> الكحول المطلق 96% يتبخر بحدة شديدة ويسلب النوتات الافتتاحية خفتها، بينما نسبة 80% تسمح بانتشار أوسع وأهدأ.
              </li>
              <li>
                <strong className="text-stone-800">إذابة الزيوت المتجانسة:</strong> جزيئات الماء المقطر النقية تمنح العطر بريقاً وترطيباً خفيفاً يقلل من وخز الكحول المباشر على الأنف.
              </li>
              <li>
                <strong className="text-stone-800">ملاحظة انكماش الحجم (Contraction):</strong> عند خلط الإيثانول والماء، يحدث انكماش حجمي كيميائي مقداره ~2.5% بسبب الروابط الهيدروجينية، لذا اضبط الحجم النهائي في مخبار القياس.
              </li>
            </ul>
          </div>
        </div>

        {/* Right Column: Dilution Recipe Card */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-md space-y-6">
            <div className="border-b border-stone-100 pb-3">
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wider block">
                وصفة التخفيف الدقيقة
              </span>
              <h3 className="text-lg font-bold text-stone-950 mt-0.5">
                لتحضير {desiredFinalVolume} مل بكفاءة {targetPurity}%
              </h3>
            </div>

            {dilution.isValid ? (
              <div className="space-y-4">
                {/* 1. Alcohol needed */}
                <div className="p-4 bg-stone-50 border border-stone-200/80 rounded-xl flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-stone-900 block">
                      كمية الكحول الخام ({initialPurity}%)
                    </span>
                    <span className="text-[11px] text-stone-500">
                      اسكب في دورق الخلط أولاً
                    </span>
                  </div>
                  <div className="text-left font-mono-numbers">
                    <span className="text-xl font-extrabold text-stone-900 block">
                      {formatNum(dilution.pureAlcoholVolumeNeeded)} مل
                    </span>
                    <span className="text-[10px] text-stone-400">
                      ≈ {formatNum(dilution.pureAlcoholVolumeNeeded * ethanolDensity)} جم
                    </span>
                  </div>
                </div>

                {/* 2. Water needed */}
                <div className="p-4 bg-sky-50/60 border border-sky-200/70 rounded-xl flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-sky-950 block">
                      كمية الماء المقطر النقي
                    </span>
                    <span className="text-[11px] text-sky-700/80">
                      ماء مقطر منزوع الأيونات (كثافة 1.00 جم/مل)
                    </span>
                  </div>
                  <div className="text-left font-mono-numbers">
                    <span className="text-xl font-extrabold text-sky-900 block">
                      {formatNum(dilution.distilledWaterVolumeNeeded)} مل
                    </span>
                    <span className="text-[10px] text-sky-600">
                      = {formatNum(dilution.distilledWaterVolumeNeeded)} جم
                    </span>
                  </div>
                </div>

                {/* Mixing steps & Scientific Volume Contraction */}
                <div className="p-4 bg-amber-50/60 border border-amber-200/70 rounded-xl space-y-2.5 text-xs">
                  <span className="font-bold text-amber-950 block">خطوات التحضير في المعمل:</span>
                  <ol className="space-y-1.5 list-decimal list-inside text-stone-700 text-[11px] leading-relaxed">
                    <li>قس {formatNum(dilution.pureAlcoholVolumeNeeded)} مل ({formatNum(dilution.pureAlcoholVolumeNeeded * ethanolDensity)} جم) من الكحول {initialPurity}% في مخبار جاف.</li>
                    <li>أضف ببطء {formatNum(dilution.distilledWaterVolumeNeeded)} مل من الماء المقطر.</li>
                    <li>حرك بلطف في وعاء زجاجي محكم الإغلاق.</li>
                    <li>اتركه يرتاح لمدة 24 ساعة لتبديد حرارة الامتزاج المجهري قبل استخدامه في العطور.</li>
                  </ol>
                  <div className="pt-2 border-t border-amber-200/60 text-[10px] text-amber-900 leading-relaxed">
                    <strong>💡 ملحوظة كيميائية (الانكماش الحجمي - Volume Contraction):</strong> عند خلط الكحول بالماء يحدث انكماش حجمي بنسبة 2% إلى 3% بسبب الروابط الهيدروجينية الجزيئية بين الإيثانول وجزيئات الماء، ولذلك يعتمد كبار العطارين في غراس على الميزان الوزني الحساس (جم) كمعيار نهائي معتمد.
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{dilution.errorMessage}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
