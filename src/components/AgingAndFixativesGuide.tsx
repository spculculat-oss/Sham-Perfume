import React from 'react';
import {
  Clock,
  ShieldCheck,
  Droplet,
  Beaker,
  Thermometer,
  SunDim,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';
import ingredientsImg from '../assets/images/perfume_ingredients_pyramid_1791692429360.jpg';
import { SupportedLanguage } from '../types/i18n';
import { FormulationState } from '../types/perfume';
import { isRTL } from '../utils/localizedContent';
import { MacerationTimeSimulator } from './MacerationTimeSimulator';

interface AgingAndFixativesGuideProps {
  currentLang?: SupportedLanguage;
  formulation?: FormulationState;
  onOpenConsultation?: (prompt: string) => void;
  onNavigateToTab?: (tab: string) => void;
}

export const AgingAndFixativesGuide: React.FC<AgingAndFixativesGuideProps> = ({
  currentLang = 'ar',
  formulation,
  onOpenConsultation,
  onNavigateToTab,
}) => {
  const rtl = isRTL(currentLang);

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="border-b border-stone-200/80 pb-5">
        <h2 className="text-xl sm:text-2xl font-bold text-stone-900 font-serif-luxury">
          {rtl
            ? 'دليل التعتيق، المثبتات، ومحاكي نضوج العطر المعملي'
            : 'Maceration Protocol, Fixatives & Laboratory Standards'}
        </h2>
        <p className="text-stone-500 text-sm mt-1">
          {rtl
            ? 'المرجع العلمي لصناع العطور: محاكي التعتيق الزمني، فترات التعتيق النموذجية، خواص المذيبات، وكيفية مضاعفة الثبات والفوحان بأمان.'
            : 'Scientific guide for perfumers: benchmark maceration timelines, maturation forecasting, and safe sillage/longevity optimization.'}
        </p>
      </div>

      {/* Hero Showcase Card with Generated Ingredients Image */}
      <div className="relative rounded-2xl overflow-hidden border border-stone-200/90 shadow-sm bg-stone-900 text-white">
        <div className="grid grid-cols-1 md:grid-cols-12 items-center">
          <div className="p-6 sm:p-8 md:col-span-7 space-y-3">
            <span className="text-amber-400 text-xs font-semibold uppercase tracking-wider block">
              {rtl ? 'أسرار نضوج العطر في المعمل' : 'Laboratory Maturation Secrets'}
            </span>
            <h3 className="text-2xl sm:text-3xl font-bold font-serif-luxury text-white">
              {rtl
                ? 'الفرق بين النضوج (Maturation) والتعتيق (Maceration)'
                : 'Maturation vs. Maceration: Scientific Distinction'}
            </h3>
            <p className="text-stone-300 text-xs sm:text-sm leading-relaxed">
              {rtl ? (
                <>
                  الكثير من المبتدئين يخلطون بين المرحلتين:
                  <br />
                  <strong>1. النضوج (Maturation):</strong> هو ترك خليط الزيوت العطرية الخام وحدها لتتفاعل جزيئياً لمدة 48 ساعة إلى أسبوعين قبل إضافة أي كحول.
                  <br />
                  <strong>2. التعتيق (Maceration):</strong> هو مرحلة خلط الزيت مع الكحول والماء والمثبت وترك المزيج في قارورة زجاجية داكنة لعدة أسابيع حتى تتشابك روابط الإيثانول مع الجزيئات العطرية ويزول وخز الكحول الحاد.
                </>
              ) : (
                <>
                  Crucial stages often misunderstood by perfumers:
                  <br />
                  <strong>1. Maturation:</strong> Letting the raw botanical/aromatic concentrate rest unblended for 48 hours to 2 weeks before ethanol introduction, allowing molecular ester cross-linking.
                  <br />
                  <strong>2. Maceration:</strong> Resting the fully diluted alcoholic compound (oil + perfumer ethanol + distilled water + fixative) in dark amber glass for weeks, letting harsh ethanol spikes dissipate into a smooth sillage.
                </>
              )}
            </p>
          </div>
          <div className="md:col-span-5 h-64 md:h-full relative">
            <img
              src={ingredientsImg}
              alt="Natural Perfume Ingredients"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>

      {/* FEATURED TOOL: MACERATION TIME SIMULATOR */}
      <MacerationTimeSimulator
        currentLang={currentLang}
        initialMacerationDays={formulation ? (formulation.concentrationType === 'extrait' ? 50 : 30) : 30}
        formulaTitle={rtl ? 'تركيبة معمل الشام المختارة' : 'Selected Formulation'}
        batchCode="BATCH-2026-SHAM"
        onOpenConsultation={onOpenConsultation}
      />

      {/* Grid: Maceration Timeline by Fragrance Family */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-700" />
          <h3 className="font-bold text-stone-950 text-base">
            {rtl ? 'جدول فترات التعتيق الموصى بها حسب العائلة العطرية' : 'Recommended Maceration Timeline by Olfactory Family'}
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 1. Fresh / Citrus */}
          <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <span className="font-bold text-stone-900 text-sm">
                {rtl ? 'العطور الحمضية والبحرية' : 'Citrus & Marine Aquatics'}
              </span>
              <span className="text-xs font-mono-numbers font-semibold text-amber-800">
                {rtl ? '14 - 21 يوماً' : '14 - 21 Days'}
              </span>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              {rtl
                ? 'تحتوي على جزيئات ليمونين وبرغموت خفيفة سريعة الأكسدة. التعتيق الزائد عن شهرين قد يضعف نضارتها الصيفية الفواحة.'
                : 'Dominated by volatile limonene and bergaptene molecules. Over-maceration beyond 60 days can oxidize sparkling top notes.'}
            </p>
            <div className="p-2.5 bg-stone-50 rounded-lg text-[11px] text-stone-500">
              {rtl ? 'مثال: كولونيا صيفية، أكوا دي جيو، نسيم البحر.' : 'e.g., Summer Cologne, Acqua di Gio, Marine Ozone.'}
            </div>
          </div>

          {/* 2. Floral / Gourmand */}
          <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <span className="font-bold text-stone-900 text-sm">
                {rtl ? 'العطور الزهرية والفاكهية' : 'Florals & Sweet Gourmand'}
              </span>
              <span className="text-xs font-mono-numbers font-semibold text-amber-800">
                {rtl ? '25 - 35 يوماً' : '25 - 35 Days'}
              </span>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              {rtl
                ? 'الزهور كالياسمين والورد تحتاج شهراً تقريباً لتتحد مع نوتات الفانيليا والمسك وتزول الرائحة الكحولية الحادة.'
                : 'Heart notes like Jasmine and Rose de Mai require 4 weeks to harmonize with vanilla and musk without alcoholic harshness.'}
            </p>
            <div className="p-2.5 bg-stone-50 rounded-lg text-[11px] text-stone-500">
              {rtl ? 'مثال: ورد طائفي وفانيليا، ياسمين أبيض، فواكه استوائية.' : 'e.g., Rose Taifi & Vanilla, White Jasmine, Sweet Fruits.'}
            </div>
          </div>

          {/* 3. Oriental / Woody / Oud */}
          <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <span className="font-bold text-stone-900 text-sm">
                {rtl ? 'العطور الشرقية، الأخشاب والعود' : 'Oriental, Woody & Precious Oud'}
              </span>
              <span className="text-xs font-mono-numbers font-semibold text-amber-800">
                {rtl ? '45 - 60+ يوماً' : '45 - 60+ Days'}
              </span>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              {rtl
                ? 'الجزيئات الثقيلة مثل الراتنجات وخشب الصندل والعنبر والعود المعتق تتطلب وقتاً أطول لتصل إلى عمقها المخملي الفاخر.'
                : 'Heavy resinous molecules, sandalwood santalols, and aged oud oils require extended time to unlock their velvet opulence.'}
            </p>
            <div className="p-2.5 bg-stone-50 rounded-lg text-[11px] text-stone-500">
              {rtl ? 'مثال: سلطان العود، عنبر ملكي، توباكو فانيلا.' : 'e.g., Sultan Oud, Amber Imperial, Tobacco Vanille.'}
            </div>
          </div>
        </div>
      </div>

      {/* Fixatives Directory Table */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center gap-2">
          <Droplet className="w-5 h-5 text-amber-700" />
          <h3 className="font-bold text-stone-950 text-base">
            {rtl ? 'دليل المثبتات العطرية والمذيبات المتخصصة' : 'Compounding Fixatives & Technical Solvents Guide'}
          </h3>
        </div>

        <div className="bg-white rounded-xl border border-stone-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className={`w-full ${rtl ? 'text-right' : 'text-left'} text-xs`}>
              <thead className="bg-stone-100 text-stone-700 font-semibold border-b border-stone-200">
                <tr>
                  <th className="py-3 px-4">{rtl ? 'اسم المثبت / المذيب' : 'Fixative / Solvent'}</th>
                  <th className="py-3 px-4">{rtl ? 'النسبة الموصى بها' : 'Usage Ratio'}</th>
                  <th className="py-3 px-4">{rtl ? 'الدور الوظيفي في العطر' : 'Functional Role'}</th>
                  <th className="py-3 px-4">{rtl ? 'التأثير على الفوحان' : 'Impact on Sillage'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                <tr>
                  <td className="py-3 px-4 font-bold text-stone-900">
                    {rtl ? 'دي بروبيلين جلايكول (DPG)' : 'Dipropylene Glycol (DPG)'}
                  </td>
                  <td className="py-3 px-4 font-mono-numbers font-semibold">0.5% - 2.0%</td>
                  <td className="py-3 px-4 text-stone-600">
                    {rtl
                      ? 'مذيب ومثبت عديم الرائحة، يبطئ معدل تبخر الزيت ويربطه بالمسامات.'
                      : 'Odorless carrier solvent; moderates evaporation curve and binds to skin.'}
                  </td>
                  <td className="py-3 px-4 text-stone-500">
                    {rtl ? 'يزيد الثبات بدون التأثير على النوتات.' : 'Enhances longevity without muting top notes.'}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-stone-900">
                    {rtl ? 'أيزوبروبيل ميريستات (IPM)' : 'Isopropyl Myristate (IPM)'}
                  </td>
                  <td className="py-3 px-4 font-mono-numbers font-semibold">0.5% - 1.5%</td>
                  <td className="py-3 px-4 text-stone-600">
                    {rtl
                      ? 'يمنح رذاذاً ناعماً سريع الامتصاص على الجلد ويقلل من تلطيخ الملابس.'
                      : 'Emollient ester; delivers ultra-fine mist atomization and prevents textile staining.'}
                  </td>
                  <td className="py-3 px-4 text-stone-500">
                    {rtl ? 'يحسن انتشار الرذاذ الدقيق.' : 'Optimizes nozzle droplet dispersion.'}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-stone-900">
                    {rtl ? 'إيزو إي سوبر (Iso E Super)' : 'Iso E Super'}
                  </td>
                  <td className="py-3 px-4 font-mono-numbers font-semibold">1.0% - 8.0%</td>
                  <td className="py-3 px-4 text-stone-600">
                    {rtl
                      ? 'جزيء خشبي أرزي مخملي يمنح العطر هالة وإشعاعاً واسعاً (Sillage).'
                      : 'Velvety woody-cedar molecule providing extraordinary diffuse projection.'}
                  </td>
                  <td className="py-3 px-4 text-amber-900 font-medium">
                    {rtl ? 'فوحان وإشراق ملحوظ.' : 'Expansive aura & magnetic trail.'}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-stone-900">
                    {rtl ? 'أمبروكسان (Ambroxan)' : 'Ambroxan (C16H28O)'}
                  </td>
                  <td className="py-3 px-4 font-mono-numbers font-semibold">0.2% - 2.0%</td>
                  <td className="py-3 px-4 text-stone-600">
                    {rtl
                      ? 'بديل العنبر الأبيض الأسطوري، يثبت قاعدة العطر لأيام مع نكهة جافة دافئة.'
                      : 'Clean ambergris molecule anchoring base foundation for days with dry warmth.'}
                  </td>
                  <td className="py-3 px-4 text-amber-900 font-medium">
                    {rtl ? 'ثبات استثنائي يدوم 48 ساعة.' : 'Exceptional 48h tenacity.'}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-stone-900">
                    {rtl ? 'هيديون (Hedione)' : 'Hedione (Kharismal)'}
                  </td>
                  <td className="py-3 px-4 font-mono-numbers font-semibold">1.0% - 5.0%</td>
                  <td className="py-3 px-4 text-stone-600">
                    {rtl
                      ? 'مستحلب زهري يمنح العطر انفتاحاً وإشراقاً كضوء الشمس في الافتتاحية.'
                      : 'Transparent floral jasmine note acting as luminous radiance booster.'}
                  </td>
                  <td className="py-3 px-4 text-stone-500">
                    {rtl ? 'مضاعف إشراق النوتات الزهرية.' : 'Multiplies heart floral radiance.'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Laboratory Golden Rules & Environment Control */}
      <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200 space-y-4">
        <h4 className="font-bold text-stone-950 text-sm flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-700" />
          <span>{rtl ? 'شروط بيئة التعتيق المثالية في المعمل:' : 'Optimal Laboratory Aging Conditions:'}</span>
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-stone-700">
          <div className="bg-white p-4 rounded-xl border border-stone-200/70 space-y-1">
            <div className="font-bold text-stone-900 flex items-center gap-1.5">
              <Thermometer className="w-4 h-4 text-amber-700" />
              <span>{rtl ? 'الحرارة المثالية (15°C - 18°C)' : 'Stable Temp (15°C - 18°C)'}</span>
            </div>
            <p className="text-stone-500 text-[11px] leading-relaxed">
              {rtl
                ? 'الحرارة العالية تسرع أكسدة الروابط، والبرودة المفرطة (كالمجمدات) تجمد الجزيئات وتمنع الامتزاج الكيميائي الطبيعي.'
                : 'High heat accelerates oxidation, while freezing traps molecular esterification.'}
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-stone-200/70 space-y-1">
            <div className="font-bold text-stone-900 flex items-center gap-1.5">
              <SunDim className="w-4 h-4 text-amber-700" />
              <span>{rtl ? 'الظلام التام (Amber Glass)' : 'Zero UV Exposure (Amber Glass)'}</span>
            </div>
            <p className="text-stone-500 text-[11px] leading-relaxed">
              {rtl
                ? 'الأشعة فوق البنفسجية UV تفكك جزيئات العطور الحساسة؛ استخدم دائماً زجاجاً عسلياً داكناً أو خزانات مظلمة.'
                : 'UV rays degrade delicate terpenes; store in amber or violet glass chambers.'}
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-stone-200/70 space-y-1">
            <div className="font-bold text-stone-900 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-amber-700" />
              <span>{rtl ? 'الإغلاق المحكم وفلترة الشوائب' : 'Hermetic Seal & Micro-Filtration'}</span>
            </div>
            <p className="text-stone-500 text-[11px] leading-relaxed">
              {rtl
                ? 'أحكم إغلاق العبوات لمنع تبخر الإيثانول، وقم بتمرير العطر عبر ورق فلتر مخبري قبل التعبئة النهائية لصفاء ناصع.'
                : 'Prevent ethanol loss with airtight seals; pass through lab filter paper before final bottling.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

