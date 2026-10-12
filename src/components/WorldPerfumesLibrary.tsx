import React, { useState } from 'react';
import {
  Sparkles,
  Search,
  Copy,
  Check,
  ArrowRight,
  ArrowLeft,
  Printer,
  Layers,
  Clock,
  Flame,
  Award,
  Compass,
} from 'lucide-react';
import { WORLD_PERFUMES, WorldPerfumeRecipe } from '../data/worldPerfumes';
import { SupportedLanguage } from '../types/i18n';
import { getLocalizedPerfume, getCommonLabel, isRTL } from '../utils/localizedContent';

interface WorldPerfumesLibraryProps {
  currentLang?: SupportedLanguage;
  onLoadWorldFormula: (recipe: WorldPerfumeRecipe) => void;
  onPrintWorldFormula: (recipe: WorldPerfumeRecipe) => void;
}

export const WorldPerfumesLibrary: React.FC<WorldPerfumesLibraryProps> = ({
  currentLang = 'ar',
  onLoadWorldFormula,
  onPrintWorldFormula,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const rtl = isRTL(currentLang);
  const ActionArrow = rtl ? ArrowLeft : ArrowRight;

  const categories = [
    { id: 'all', label: rtl ? `جميع العطور العالمية (${WORLD_PERFUMES.length})` : `All Iconic Perfumes (${WORLD_PERFUMES.length})` },
    { id: 'oriental', label: rtl ? 'شرقي وعنبر (Oriental)' : 'Oriental & Amber' },
    { id: 'woody', label: rtl ? 'خشبي وعود (Woody)' : 'Woody & Oud' },
    { id: 'citrus', label: rtl ? 'حمضيات وأروماتيك (Citrus)' : 'Citrus & Aromatic' },
    { id: 'gourmand', label: rtl ? 'جورماند وتوابل (Gourmand)' : 'Gourmand & Spices' },
    { id: 'floral', label: rtl ? 'زهري وألدهيدي (Floral)' : 'Floral & Aldehydic' },
    { id: 'leather', label: rtl ? 'جلود وتبغ (Leather)' : 'Leather & Tobacco' },
    { id: 'aquatic', label: rtl ? 'بحري ومائي (Aquatic)' : 'Marine & Aquatic' },
  ];

  const filtered = WORLD_PERFUMES.filter((perfume) => {
    const localized = getLocalizedPerfume(perfume, currentLang);
    const matchesSearch =
      localized.nameAr.toLowerCase().includes(search.toLowerCase()) ||
      localized.nameEn.toLowerCase().includes(search.toLowerCase()) ||
      localized.brand.toLowerCase().includes(search.toLowerCase()) ||
      localized.pyramidNotes.some((n) => n.nameAr.toLowerCase().includes(search.toLowerCase()) || n.nameEn.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory =
      selectedCategory === 'all' || perfume.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const handleCopyRecipe = (recipe: WorldPerfumeRecipe) => {
    const localized = getLocalizedPerfume(recipe, currentLang);
    const notesText = localized.pyramidNotes
      .map(
        (n) =>
          `• [${n.category === 'top' ? (rtl ? 'قمة' : 'Top') : n.category === 'heart' ? (rtl ? 'قلب' : 'Heart') : (rtl ? 'قاعدة' : 'Base')}] ${rtl ? n.nameAr : n.nameEn}: ${n.percentageOfOil}%`
      )
      .join('\n');

    const text = `👑 ${rtl ? 'تركيبة' : 'Formula'}: ${localized.nameAr}
${rtl ? 'الدار الأصلية' : 'House'}: ${localized.brand} (${localized.year})
${rtl ? 'التصنيف' : 'Category'}: ${localized.categoryAr} | ${rtl ? 'التركيز' : 'Concentration'}: ${localized.targetConcentration}% (${localized.concentrationTypeAr})
${rtl ? 'الثبات' : 'Longevity'}: ${localized.longevity} | ${rtl ? 'الفوحان' : 'Sillage'}: ${localized.sillage}
${rtl ? 'مدة التعتيق' : 'Maceration'}: ${localized.macerationDays} ${rtl ? 'يوماً' : 'Days'}

🔺 ${rtl ? 'توزيع الهرم العطري لمركب الزيت (100%)' : 'Fragrance Pyramid Oil Breakdown (100%)'}:
${notesText}

💡 ${rtl ? 'نصيحة الخبير شاهين' : 'Master Shahin Advice'}:
${localized.compoundingTips}`;

    navigator.clipboard.writeText(text);
    setCopiedId(recipe.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-stone-200/80 pb-5">
        <div className="flex items-center gap-2">
          <Award className="w-6 h-6 text-amber-700" />
          <h2 className="text-xl sm:text-2xl font-bold text-stone-900 font-serif-luxury">
            {rtl ? 'مكتبة أشهر التركيبات العالمية (World Iconic Perfumes)' : 'World Iconic Perfumes Library & Formula Accords'}
          </h2>
        </div>
        <p className="text-stone-500 text-sm mt-1">
          {rtl
            ? 'الأكوردات والهياكل العطرية لأعظم العطور العالمية (بكرات روج 540، كريد أفينتوس، توم فورد توباكو فانيلا، ديور سوفاج، بلاك أفغانو...) مع نسب المكونات الدقيقة للتحميل في حاسبة المعمل بضغطة زر.'
            : 'Accords and structural olfactory formulas of the world\'s greatest iconic fragrances (Baccarat Rouge 540, Creed Aventus, Tom Ford Tobacco Vanille, Sauvage, Black Afgano...) ready to load directly into the lab calculator.'}
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className={`w-4 h-4 text-stone-400 absolute ${rtl ? 'right-3' : 'left-3'} top-3 pointer-events-none`} />
          <input
            type="text"
            placeholder={rtl ? 'ابحث بالاسم (مثال: بكرات روج، أفينتوس، توم فورد، زعفران...)' : 'Search iconic perfumes (e.g., Baccarat Rouge, Aventus, Tom Ford, Saffron...)'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full ${rtl ? 'pr-9 pl-4 text-right' : 'pl-9 pr-4 text-left'} py-2.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-amber-700 shadow-2xs`}
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-stone-100 rounded-xl text-xs no-scrollbar">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                selectedCategory === c.id
                  ? 'bg-stone-900 text-white font-semibold shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Famous Perfumes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {filtered.map((perfume) => {
          const localized = getLocalizedPerfume(perfume, currentLang);
          return (
            <div
              key={perfume.id}
              className="bg-white rounded-3xl border border-stone-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
            >
              {/* Card Body */}
              <div className="p-6 space-y-5">
                
                {/* Header Info */}
                <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-amber-800 font-semibold mb-1">
                      <span>{localized.brand}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-numbers">{localized.year}</span>
                      <span aria-hidden="true">·</span>
                      <span>{localized.categoryAr}</span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-stone-950 font-serif-luxury">
                      {localized.nameAr}
                    </h3>
                    <div className="text-xs text-stone-400 font-mono-numbers mt-0.5">
                      {localized.nameEn}
                    </div>
                  </div>

                  <div className="text-left shrink-0 font-mono-numbers bg-stone-50 border border-stone-200/80 p-2.5 rounded-xl">
                    <div className="text-sm font-bold text-amber-900">
                      {localized.targetConcentration}%
                    </div>
                    <div className="text-[10px] text-stone-500">{localized.concentrationType.toUpperCase()}</div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                  {localized.descriptionAr}
                </p>

                {/* Specs Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-stone-50 rounded-2xl text-xs">
                  <div>
                    <span className="text-[10px] text-stone-400 block">{rtl ? 'الثبات على الملابس:' : 'Fabric Longevity:'}</span>
                    <span className="font-semibold text-stone-900">{localized.longevity}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 block">{rtl ? 'قوة الفوحان:' : 'Sillage / Projection:'}</span>
                    <span className="font-semibold text-stone-900">{localized.sillage}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 block">{rtl ? 'مدة التعتيق المثالية:' : 'Optimal Maceration:'}</span>
                    <span className="font-bold text-amber-900 font-mono-numbers">{localized.macerationDays} {rtl ? 'يوماً' : 'Days'}</span>
                  </div>
                </div>

                {/* Pyramid Breakdown Table */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-stone-900 flex items-center justify-between">
                    <span>{rtl ? 'جدول توزيع النوتات العطرية لمركب الزيت (100%):' : 'Fragrance Pyramid Oil Breakdown (100%):'}</span>
                    <span className="text-[11px] text-stone-500 font-mono-numbers">
                      {localized.pyramidNotes.length} {rtl ? 'مكونات' : 'Notes'}
                    </span>
                  </div>

                  <div className="border border-stone-200/80 rounded-xl overflow-hidden divide-y divide-stone-100 text-xs">
                    {localized.pyramidNotes.map((note) => (
                      <div
                        key={note.id}
                        className="px-3.5 py-2 flex items-center justify-between hover:bg-stone-50/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              note.category === 'top'
                                ? 'bg-amber-500'
                                : note.category === 'heart'
                                ? 'bg-stone-600'
                                : 'bg-stone-950'
                            }`}
                          />
                          <span className="font-medium text-stone-900 truncate">
                            {rtl ? note.nameAr : (note.nameEn || note.nameAr)}
                          </span>
                          <span className="text-[10px] text-stone-400 hidden sm:inline">
                            ({note.category === 'top' ? (rtl ? 'قمة' : 'Top') : note.category === 'heart' ? (rtl ? 'قلب' : 'Heart') : (rtl ? 'قاعدة' : 'Base')})
                          </span>
                        </div>
                        <div className="font-mono-numbers font-bold text-amber-900 shrink-0 text-left">
                          {note.percentageOfOil}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Master Compounding Advice */}
                <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl text-xs space-y-1">
                  <span className="font-bold text-amber-950 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                    <span>{rtl ? 'نصيحة الخبير شاهين لضبط المركب:' : 'Master Shahin Formula Optimization Tip:'}</span>
                  </span>
                  <p className="text-[11px] text-stone-700 leading-relaxed">
                    {localized.compoundingTips}
                  </p>
                </div>

              </div>

              {/* Bottom Actions */}
              <div className="p-4 bg-stone-50/80 border-t border-stone-200 flex items-center justify-between gap-3">
                <button
                  onClick={() => onLoadWorldFormula(localized)}
                  className="flex-1 py-2.5 px-4 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                >
                  <span>{getCommonLabel('load_in_lab', currentLang)}</span>
                  <ActionArrow className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => handleCopyRecipe(localized)}
                  className="py-2.5 px-3 bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  title={getCommonLabel('copy', currentLang)}
                >
                  {copiedId === perfume.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">{getCommonLabel('copied', currentLang)}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>{getCommonLabel('copy', currentLang)}</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => onPrintWorldFormula(localized)}
                  className="p-2.5 bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-xl transition-colors cursor-pointer"
                  title={getCommonLabel('print', currentLang)}
                >
                  <Printer className="w-4 h-4 text-amber-800" />
                </button>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
};
