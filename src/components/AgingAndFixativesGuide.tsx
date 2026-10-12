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

export const AgingAndFixativesGuide: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="border-b border-stone-200/80 pb-5">
        <h2 className="text-xl sm:text-2xl font-bold text-stone-900 font-serif-luxury">
          دليل التعتيق، المثبتات، ومعايير نقاء المعمل
        </h2>
        <p className="text-stone-500 text-sm mt-1">
          المرجع العلمي لصناع العطور: فترات التعتيق النموذجية، خواص المذيبات، وكيفية مضاعفة الثبات والفوحان بأمان.
        </p>
      </div>

      {/* Hero Showcase Card with Generated Ingredients Image */}
      <div className="relative rounded-2xl overflow-hidden border border-stone-200/90 shadow-sm bg-stone-900 text-white">
        <div className="grid grid-cols-1 md:grid-cols-12 items-center">
          <div className="p-6 sm:p-8 md:col-span-7 space-y-3">
            <span className="text-amber-400 text-xs font-semibold uppercase tracking-wider block">
              أسرار نضوج العطر في المعمل
            </span>
            <h3 className="text-2xl sm:text-3xl font-bold font-serif-luxury text-white">
              الفرق بين النضوج (Maturation) والتعتيق (Maceration)
            </h3>
            <p className="text-stone-300 text-xs sm:text-sm leading-relaxed">
              الكثير من المبتدئين يخلطون بين المرحلتين:
              <br />
              <strong>1. النضوج (Maturation):</strong> هو ترك خليط الزيوت العطرية الخام وحدها لتتفاعل جزيئياً لمدة 48 ساعة إلى أسبوعين قبل إضافة أي كحول.
              <br />
              <strong>2. التعتيق (Maceration):</strong> هو مرحلة خلط الزيت مع الكحول والماء والمثبت وترك المزيج في قارورة زجاجية داكنة لعدة أسابيع حتى تتشابك روابط الإيثانول مع الجزيئات العطرية ويزول وخز الكحول الحاد.
            </p>
          </div>
          <div className="md:col-span-5 h-64 md:h-full relative">
            <img
              src={ingredientsImg}
              alt="مكونات العطور الطبيعية: البرغموت، الورد، العود، العنبر، الفانيليا"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>

      {/* Grid: Maceration Timeline by Fragrance Family */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-700" />
          <h3 className="font-bold text-stone-950 text-base">
            جدول فترات التعتيق الموصى بها حسب العائلة العطرية
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 1. Fresh / Citrus */}
          <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <span className="font-bold text-stone-900 text-sm">العطور الحمضية والبحرية</span>
              <span className="text-xs font-mono-numbers font-semibold text-amber-800">
                14 - 21 يوماً
              </span>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              تحتوي على جزيئات ليمونين وبرغموت خفيفة سريعة الأكسدة. التعتيق الزائد عن شهرين قد يضعف نضارتها الصيفية الفواحة.
            </p>
            <div className="p-2.5 bg-stone-50 rounded-lg text-[11px] text-stone-500">
              مثال: كولونيا صيفية، أكوا دي جيو، نسيم البحر.
            </div>
          </div>

          {/* 2. Floral / Gourmand */}
          <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <span className="font-bold text-stone-900 text-sm">العطور الزهرية والفاكهية</span>
              <span className="text-xs font-mono-numbers font-semibold text-amber-800">
                25 - 35 يوماً
              </span>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              الزهور كالياسمين والورد تحتاج شهراً تقريباً لتتحد مع نوتات الفانيليا والمسك وتزول الرائحة الكحولية الحادة.
            </p>
            <div className="p-2.5 bg-stone-50 rounded-lg text-[11px] text-stone-500">
              مثال: ورد طائفي وفانيليا، ياسمين أبيض، فواكه استوائية.
            </div>
          </div>

          {/* 3. Oriental / Woody / Oud */}
          <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <span className="font-bold text-stone-900 text-sm">العطور الشرقية، الأخشاب والعود</span>
              <span className="text-xs font-mono-numbers font-semibold text-amber-800">
                45 - 60+ يوماً
              </span>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              الجزيئات الثقيلة مثل الراتنجات وخشب الصندل والعنبر والعود المعتق تتطلب وقتاً أطول لتصل إلى عمقها المخملي الفاخر.
            </p>
            <div className="p-2.5 bg-stone-50 rounded-lg text-[11px] text-stone-500">
              مثال: سلطان العود، عنبر ملكي، توباكو فانيلا.
            </div>
          </div>
        </div>
      </div>

      {/* Fixatives Directory Table */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center gap-2">
          <Droplet className="w-5 h-5 text-amber-700" />
          <h3 className="font-bold text-stone-950 text-base">
            دليل المثبتات العطرية والمذيبات المتخصصة
          </h3>
        </div>

        <div className="bg-white rounded-xl border border-stone-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-stone-100 text-stone-700 font-semibold border-b border-stone-200">
                <tr>
                  <th className="py-3 px-4">اسم المثبت / المذيب</th>
                  <th className="py-3 px-4">النسبة الموصى بها</th>
                  <th className="py-3 px-4">الدور الوظيفي في العطر</th>
                  <th className="py-3 px-4">التأثير على الفوحان</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                <tr>
                  <td className="py-3 px-4 font-bold text-stone-900">
                    دي بروبيلين جلايكول (DPG)
                  </td>
                  <td className="py-3 px-4 font-mono-numbers font-semibold">0.5% - 2.0%</td>
                  <td className="py-3 px-4 text-stone-600">
                    مذيب ومثبت عديم الرائحة، يبطئ معدل تبخر الزيت ويربطه بالمسامات.
                  </td>
                  <td className="py-3 px-4 text-stone-500">يزيد الثبات بدون التأثير على النوتات.</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-stone-900">
                    أيزوبروبيل ميريستات (IPM)
                  </td>
                  <td className="py-3 px-4 font-mono-numbers font-semibold">0.5% - 1.5%</td>
                  <td className="py-3 px-4 text-stone-600">
                    يمنح رذاذاً ناعماً سريع الامتصاص على الجلد ويقلل من تلطيخ الملابس.
                  </td>
                  <td className="py-3 px-4 text-stone-500">يحسن انتشار الرذاذ الدقيق.</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-stone-900">
                    إيزو إي سوبر (Iso E Super)
                  </td>
                  <td className="py-3 px-4 font-mono-numbers font-semibold">1.0% - 8.0%</td>
                  <td className="py-3 px-4 text-stone-600">
                    جزيء خشبي أرزي مخملي يمنح العطر هالة وإشعاعاً واسعاً (Sillage).
                  </td>
                  <td className="py-3 px-4 text-amber-900 font-medium">فوحان وإشراق ملحوظ.</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-stone-900">
                    أمبروكسان (Ambroxan)
                  </td>
                  <td className="py-3 px-4 font-mono-numbers font-semibold">0.2% - 2.0%</td>
                  <td className="py-3 px-4 text-stone-600">
                    بديل العنبر الأبيض الأسطوري، يثبت قاعدة العطر لأيام مع نكهة جافة دافئة.
                  </td>
                  <td className="py-3 px-4 text-amber-900 font-medium">ثبات استثنائي يدوم 48 ساعة.</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-stone-900">
                    هيديون (Hedione)
                  </td>
                  <td className="py-3 px-4 font-mono-numbers font-semibold">1.0% - 5.0%</td>
                  <td className="py-3 px-4 text-stone-600">
                    مستحلب زهري يمنح العطر انفتاحاً وإشراقاً كضوء الشمس في الافتتاحية.
                  </td>
                  <td className="py-3 px-4 text-stone-500">مضاعف إشراق النوتات الزهرية.</td>
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
          <span>شروط بيئة التعتيق المثالية في المعمل:</span>
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-stone-700">
          <div className="bg-white p-4 rounded-xl border border-stone-200/70 space-y-1">
            <div className="font-bold text-stone-900 flex items-center gap-1.5">
              <Thermometer className="w-4 h-4 text-amber-700" />
              <span>الحرارة المثالية (15°C - 18°C)</span>
            </div>
            <p className="text-stone-500 text-[11px] leading-relaxed">
              الحرارة العالية تسرع أكسدة الروابط، والبرودة المفرطة (كالمجمدات) تجمد الجزيئات وتمنع الامتزاج الكيميائي الطبيعي.
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-stone-200/70 space-y-1">
            <div className="font-bold text-stone-900 flex items-center gap-1.5">
              <SunDim className="w-4 h-4 text-amber-700" />
              <span>الظلام التام (Amber Glass)</span>
            </div>
            <p className="text-stone-500 text-[11px] leading-relaxed">
              الأشعة فوق البنفسجية UV تفكك جزيئات العطور الحساسة؛ استخدم دائماً زجاجاً عسلياً داكناً أو خزانات مظلمة.
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-stone-200/70 space-y-1">
            <div className="font-bold text-stone-900 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-amber-700" />
              <span>الإغلاق المحكم وفلترة الشوائب</span>
            </div>
            <p className="text-stone-500 text-[11px] leading-relaxed">
              أحكم إغلاق العبوات لمنع تبخر الإيثانول، وقم بتمرير العطر عبر ورق فلتر مخبري قبل التعبئة النهائية لصفاء ناصع.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
