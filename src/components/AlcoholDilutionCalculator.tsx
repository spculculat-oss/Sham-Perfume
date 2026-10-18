import { LegalDisclaimer } from './LegalDisclaimer';
import { LocalizedNumberInput } from './LocalizedNumberInput';
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
import { isRTL } from '../لغات/localizedContent';
import { LText, makeT, fmt } from '../لغات/localize';

interface AlcoholDilutionCalculatorProps {
  currentLang?: SupportedLanguage;
  /** Values Shaheen read from the visitor's question (strength you have → strength you want, final volume). */
  initialFrom?: number;
  initialTarget?: number;
  initialVolumeMl?: number;
}

const S = {
  page_title: {
    ar: 'حاسبة تخفيف تركيز الكحول الإيثيلي',
    en: 'Ethanol Alcohol Dilution Calculator',
    fr: 'Calculateur de dilution de l’éthanol',
    es: 'Calculadora de dilución de etanol',
    it: 'Calcolatore di diluizione dell’etanolo',
    de: 'Ethanol-Verdünnungsrechner',
    ru: 'Калькулятор разведения этанола',
    zh: '乙醇稀释计算器',
    tr: 'Etanol seyreltme hesaplayıcısı',
    fa: 'ماشین‌حساب رقیق‌سازی الکل اتیلیک',
  },
  page_desc: {
    ar: 'تعديل درجة نقاء الكحول (مثلاً من 96% أو 99.9% إلى 80% أو 85%) باستخدام الماء المقطر وفق معادلة التخفيف وقانون حفظ الكتلة.',
    en: 'Precise gravimetric and volumetric calculation of distilled water needed to dilute perfumer ethanol (C₁V₁ = C₂V₂).',
    fr: 'Ajustement du degré d’alcool (ex. de 96 % ou 99,9 % à 80 %) à l’eau distillée selon l’équation de dilution.',
    es: 'Ajuste del grado alcohólico (ej. de 96% a 80%) con agua destilada según la ecuación de dilución.',
    it: 'Regolazione del grado alcolico (es. da 96% a 80%) con acqua distillata secondo l’equazione di diluizione.',
    de: 'Anpassung des Alkoholgrads (z. B. von 96 % auf 80 %) mit destilliertem Wasser nach der Verdünnungsgleichung.',
    ru: 'Корректировка крепости спирта (напр., с 96% до 80%) дистиллированной водой по уравнению разведения.',
    zh: '依据稀释方程与质量守恒定律，用蒸馏水精确调整酒精纯度（如从 96% 降至 80%）。',
    tr: 'Seyreltme denklemine göre distile suyla alkol derecesini ayarlayın (örn. %96’dan %80’e).',
    fa: 'تنظیم درجه خلوص الکل (مثلاً از ۹۶٪ به ۸۰٪) با آب مقطر طبق معادله رقیق‌سازی و قانون بقای جرم.',
  },
  params_title: {
    ar: 'معايير سائل الكحول والهدف المطلوب',
    en: 'Ethanol Concentration Parameters',
    fr: 'Paramètres de concentration d’éthanol',
    es: 'Parámetros de concentración de etanol',
    it: 'Parametri di concentrazione di etanolo',
    de: 'Ethanol-Konzentrationsparameter',
    ru: 'Параметры концентрации этанола',
    zh: '乙醇浓度参数',
    tr: 'Etanol konsantrasyon parametreleri',
    fa: 'پارامترهای غلظت الکل',
  },
  initial_label: {
    ar: 'تركيز الكحول الخام المتوفر (C₁)',
    en: 'Available Raw Alcohol Strength (C₁)',
    fr: 'Degré d’alcool brut disponible (C₁)',
    es: 'Grado alcohólico bruto disponible (C₁)',
    it: 'Grado alcolico grezzo disponibile (C₁)',
    de: 'Verfügbare Rohalkoholstärke (C₁)',
    ru: 'Исходная крепость спирта (C₁)',
    zh: '现有原料酒精浓度 (C₁)',
    tr: 'Mevcut ham alkol derecesi (C₁)',
    fa: 'غلظت الکل خام موجود (C₁)',
  },
  target_label: {
    ar: 'تركيز الكحول النهائي المستهدف للعطر (C₂)',
    en: 'Target Compound Strength (C₂)',
    fr: 'Degré final visé du parfum (C₂)',
    es: 'Grado final deseado del perfume (C₂)',
    it: 'Grado finale desiderato (C₂)',
    de: 'Ziel-Konzentration (C₂)',
    ru: 'Целевая крепость композиции (C₂)',
    zh: '目标最终酒精浓度 (C₂)',
    tr: 'Hedef nihai alkol derecesi (C₂)',
    fa: 'غلظت نهایی هدف عطر (C₂)',
  },
  volume_label: {
    ar: 'الحجم النهائي المطلوب تحضيره (V₂)',
    en: 'Desired Final Batch Volume (V₂)',
    fr: 'Volume final souhaité (V₂)',
    es: 'Volumen final deseado (V₂)',
    it: 'Volume finale desiderato (V₂)',
    de: 'Gewünschtes Endvolumen (V₂)',
    ru: 'Желаемый итоговый объём (V₂)',
    zh: '目标最终配制体积 (V₂)',
    tr: 'İstenen nihai hacim (V₂)',
    fa: 'حجم نهایی موردنیاز (V₂)',
  },
  law_title: {
    ar: 'قانون التخفيف العلمي (C₁V₁ = C₂V₂)',
    en: 'Volumetric Dilution Principle (C₁V₁ = C₂V₂)',
    fr: 'Principe de dilution (C₁V₁ = C₂V₂)',
    es: 'Principio de dilución (C₁V₁ = C₂V₂)',
    it: 'Principio di diluizione (C₁V₁ = C₂V₂)',
    de: 'Verdünnungsprinzip (C₁V₁ = C₂V₂)',
    ru: 'Принцип разведения (C₁V₁ = C₂V₂)',
    zh: '科学稀释定律 (C₁V₁ = C₂V₂)',
    tr: 'Seyreltme prensibi (C₁V₁ = C₂V₂)',
    fa: 'قانون علمی رقیق‌سازی (C₁V₁ = C₂V₂)',
  },
  law_desc: {
    ar: 'عند إضافة الماء للكحول يحدث انكماش طفيف في الحجم المشترك (Volume Contraction) بسبب تشكل الروابط الهيدروجينية، لذلك يُنصح دائماً بالوزن بالجرام بدقة الميزان لضمان مطابقة التركيز الدوائي.',
    en: 'When water is added to ethanol, a minor volume contraction occurs due to hydrogen bonding. For pharmaceutical accuracy, measuring mass in grams on analytical scales is recommended.',
    fr: 'L’ajout d’eau à l’éthanol provoque une légère contraction volumique due aux liaisons hydrogène ; pesez en grammes pour une précision pharmaceutique.',
    es: 'Al añadir agua al etanol ocurre una ligera contracción volumétrica por puentes de hidrógeno; pese en gramos para precisión farmacéutica.',
    it: 'Aggiungendo acqua all’etanolo si verifica una lieve contrazione volumetrica dovuta ai legami idrogeno; pesare in grammi per precisione farmaceutica.',
    de: 'Beim Mischen von Wasser und Ethanol entsteht eine geringe Volumenkontraktion durch Wasserstoffbrücken; wiegen Sie in Gramm für pharmazeutische Genauigkeit.',
    ru: 'При добавлении воды в этанол происходит небольшое сжатие объёма из-за водородных связей; для фармацевтической точности взвешивайте в граммах.',
    zh: '水与乙醇混合时会因氢键产生轻微体积收缩；为确保药学精度，建议以克为单位称量。',
    tr: 'Su ve etanol karıştırıldığında hidrojen bağlarından dolayı hafif hacim daralması olur; eczacılık hassasiyeti için gramla tartın.',
    fa: 'هنگام افزودن آب به الکل به دلیل پیوندهای هیدروژنی، انقباض حجمی جزئی رخ می‌دهد؛ برای دقت دارویی، همیشه بر حسب گرم توزین کنید.',
  },
  results_title: {
    ar: 'نتائج المعايرة والخلط',
    en: 'Compounding Recipe',
    fr: 'Recette de formulation',
    es: 'Receta de compounding',
    it: 'Ricetta di miscelazione',
    de: 'Mischrezept',
    ru: 'Рецепт смешивания',
    zh: '配制配方结果',
    tr: 'Karım reçetesi',
    fa: 'نتایج معیارسازی و ترکیب',
  },
  required_alcohol_tpl: {
    ar: '1. حجم الكحول الخام المتوفر ({p}%) المطلوب:',
    en: '1. Required Raw Alcohol ({p}%):',
    fr: '1. Alcool brut requis ({p} %) :',
    es: '1. Alcohol bruto requerido ({p}%):',
    it: '1. Alcol grezzo richiesto ({p}%):',
    de: '1. Benötigter Rohalkohol ({p}%):',
    ru: '1. Требуемый исходный спирт ({p}%):',
    zh: '1. 所需原料酒精（{p}%）：',
    tr: '1. Gerekli ham alkol (%{p}):',
    fa: '۱. حجم الکل خام موردنیاز ({p}٪):',
  },
  required_water: {
    ar: '2. حجم الماء المقطر الطبي الواجب إضافته:',
    en: '2. Required Medical Distilled Water:',
    fr: '2. Eau distillée médicale à ajouter :',
    es: '2. Agua destilada médica a añadir:',
    it: '2. Acqua distillata medica da aggiungere:',
    de: '2. Benötigtes medizinisches destilliertes Wasser:',
    ru: '2. Требуемая дистиллированная вода:',
    zh: '2. 需加入的医用蒸馏水：',
    tr: '2. Eklenecek tıbbi distile su:',
    fa: '۲. حجم آب مقطر پزشکی که باید اضافه شود:',
  },
  final_volume: {
    ar: 'الحجم النهائي المحضر:',
    en: 'Target Final Volume:',
    fr: 'Volume final préparé :',
    es: 'Volumen final preparado:',
    it: 'Volume finale preparato:',
    de: 'Ziel-Endvolumen:',
    ru: 'Итоговый объём:',
    zh: '最终配制体积：',
    tr: 'Hedef nihai hacim:',
    fa: 'حجم نهایی آماده‌شده:',
  },
  total_weight: {
    ar: 'الوزن الكلي للخليط المخفف:',
    en: 'Total Batch Weight:',
    fr: 'Poids total du lot :',
    es: 'Peso total del lote:',
    it: 'Peso totale del lotto:',
    de: 'Gesamtgewicht der Charge:',
    ru: 'Общий вес смеси:',
    zh: '稀释后混合液总重：',
    tr: 'Toplam parti ağırlığı:',
    fa: 'وزن کل مخلوط رقیق‌شده:',
  },
  mixture_density: {
    ar: 'الكثافة التقديرية للخليط الناتج:',
    en: 'Resulting Mixture Density:',
    fr: 'Densité estimée du mélange :',
    es: 'Densidad estimada de la mezcla:',
    it: 'Densità stimata del miscuglio:',
    de: 'Geschätzte Mischungsdichte:',
    ru: 'Примерная плотность смеси:',
    zh: '混合液估算密度：',
    tr: 'Tahmini karışım yoğunluğu:',
    fa: 'چگالی تقریبی مخلوط حاصل:',
  },
} satisfies Record<string, LText>;

export const AlcoholDilutionCalculator: React.FC<AlcoholDilutionCalculatorProps> = ({
  currentLang = 'ar',
  initialFrom,
  initialTarget,
  initialVolumeMl,
}) => {
  const [initialPurity, setInitialPurity] = useState(initialFrom ?? 96); // e.g. 96%
  const [targetPurity, setTargetPurity] = useState(initialTarget ?? Math.min(80, (initialFrom ?? 96) - 1)); // e.g. 80%
  const [desiredFinalVolume, setDesiredFinalVolume] = useState(initialVolumeMl ?? 1000); // 1000 ml (1 Liter)

  const rtl = isRTL(currentLang);
  const L = makeT(currentLang, S);
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
          {L('page_title')}
        </h2>
        <p className="text-stone-500 text-sm mt-1">
          {L('page_desc')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Input Parameters */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-5">
            <h3 className="text-sm font-bold text-stone-950 flex items-center gap-2">
              <Beaker className="w-4 h-4 text-amber-700" />
              <span>{L('params_title')}</span>
            </h3>

            {/* Initial Purity Input */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label className="font-semibold text-stone-800">
                  {L('initial_label')}
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
                  {L('target_label')}
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
                  {L('volume_label')}
                </label>
                <span className="font-mono-numbers font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded">
                  {desiredFinalVolume} ml
                </span>
              </div>
              <LocalizedNumberInput
                lang={currentLang}
                min={50}
                max={50000}
                value={desiredFinalVolume}
                onValue={(n) => setDesiredFinalVolume(Math.max(10, n || 0))}
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
              <span>{L('law_title')}</span>
            </div>
            <p>
              {L('law_desc')}
            </p>
          </div>
        </div>

        {/* IFRA Legal Disclaimer — L-04 Fix */}
        <div className="lg:col-span-12">
          <LegalDisclaimer type="chemical" lang={currentLang} />
        </div>

        {/* Right Column: Dilution Results */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-stone-900 text-white p-6 rounded-3xl border border-stone-800 shadow-xl space-y-6">
            <div className="border-b border-stone-800 pb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{L('results_title')}</span>
              </h3>
              <span className="text-[11px] font-mono text-stone-400 shrink-0">
                {targetPurity}% ABV
              </span>
            </div>

            {/* Main Required Quantities */}
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-stone-800/80 border border-stone-700/80 space-y-1">
                <span className="text-[11px] text-stone-300 block">
                  {fmt(L('required_alcohol_tpl'), { p: initialPurity })}
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
                  {L('required_water')}
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
                <span>{L('final_volume')}</span>
                <span className="font-mono-numbers font-bold text-white">{desiredFinalVolume} ml</span>
              </div>
              <div className="flex justify-between text-stone-400">
                <span>{L('total_weight')}</span>
                <span className="font-mono-numbers font-bold text-amber-300">
                  {formatNum(dilution.requiredInitialVolumeMl * ethanolDensity + dilution.requiredWaterVolumeMl, 2)} g
                </span>
              </div>
              <div className="flex justify-between text-stone-400">
                <span>{L('mixture_density')}</span>
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
