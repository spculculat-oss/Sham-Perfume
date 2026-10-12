import React, { useState } from 'react';
import {
  FlaskConical,
  Search,
  Copy,
  Check,
  Plus,
  Info,
  ShieldCheck,
  Droplet,
  Beaker,
  Scale,
  Sparkles,
  Layers,
} from 'lucide-react';
import { RAW_MATERIALS_DATABASE, RawMaterialItem } from '../data/rawMaterials';
import { PyramidNote } from '../types/perfume';
import { SupportedLanguage } from '../types/i18n';
import { getLocalizedRawMaterial, getCommonLabel, isRTL } from '../utils/localizedContent';

interface RawMaterialsEncyclopediaProps {
  currentLang?: SupportedLanguage;
  onAddMaterialToPyramid: (note: PyramidNote) => void;
}

export const RawMaterialsEncyclopedia: React.FC<RawMaterialsEncyclopediaProps> = ({
  currentLang = 'ar',
  onAddMaterialToPyramid,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [addedId, setAddedId] = useState<string | null>(null);

  const rtl = isRTL(currentLang);

  const categories = [
    { id: 'all', label: rtl ? 'جميع المواد (الكل)' : 'All Raw Materials' },
    { id: 'solvent', label: rtl ? 'المذيبات وحوامل العطر' : 'Solvents & Carriers' },
    { id: 'fixative', label: rtl ? 'المثبتات الكيميائية' : 'Chemical Fixatives' },
    { id: 'aromachemical', label: rtl ? 'الجزيئات العطرية الحديثة' : 'Modern Molecules' },
    { id: 'natural_essential', label: rtl ? 'الزيوت الطبيعية والمستخلصات' : 'Essential Oils' },
    { id: 'natural_resin', label: rtl ? 'الصموغ وأدهان العود' : 'Resins & Ouds' },
  ];

  const filtered = RAW_MATERIALS_DATABASE.filter((item) => {
    const localized = getLocalizedRawMaterial(item, currentLang);
    const matchesSearch =
      localized.nameAr.toLowerCase().includes(search.toLowerCase()) ||
      localized.nameEn.toLowerCase().includes(search.toLowerCase()) ||
      localized.olfactoryFamily.toLowerCase().includes(search.toLowerCase()) ||
      localized.scentProfile.toLowerCase().includes(search.toLowerCase()) ||
      (localized.casNumber && localized.casNumber.includes(search));

    const matchesCategory =
      selectedCategory === 'all' || item.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const handleCopySpecs = (item: RawMaterialItem) => {
    const localized = getLocalizedRawMaterial(item, currentLang);
    const text = `🧪 ${rtl ? 'مواصفات المادة' : 'Material Specification'}: ${localized.nameAr} (${localized.nameEn})
${rtl ? 'الفئة' : 'Category'}: ${localized.categoryAr} | ${rtl ? 'العائلة الشمية' : 'Olfactory Family'}: ${localized.olfactoryFamily}
${localized.casNumber ? `${rtl ? 'رقم كاس (CAS)' : 'CAS Registry #'}: ${localized.casNumber}\n` : ''}${rtl ? 'الكثافة النوعية' : 'Density'}: ${localized.densityGPerMl} g/ml
${rtl ? 'النسبة الموصى بها' : 'Recommended Usage'}: ${localized.recommendedUsagePercent}
${rtl ? 'حد الأمان وفق IFRA' : 'IFRA Safety Limit'}: ${localized.ifraLimitPercent}
${rtl ? 'الموقع في الهرم' : 'Pyramid Level'}: ${localized.pyramidPlacementAr}

📌 ${rtl ? 'الوصف والشعور' : 'Scent Profile & Nuance'}:
${localized.scentProfile}

⚙️ ${rtl ? 'الدور الوظيفي في العطر' : 'Technical Role'}:
${localized.roleInPerfume}

🤝 ${rtl ? 'يمتزج ويتوافق مع' : 'Harmonious Partners'}:
${localized.blendingPartners}

⚠️ ${rtl ? 'احتياطات التعامل' : 'Handling Precautions'}:
${localized.precautions}`;

    navigator.clipboard.writeText(text);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleAdd = (item: RawMaterialItem) => {
    const localized = getLocalizedRawMaterial(item, currentLang);
    const placement =
      item.pyramidPlacement === 'top'
        ? 'top'
        : item.pyramidPlacement === 'heart'
        ? 'heart'
        : 'base';

    const newNote: PyramidNote = {
      id: 'mat-' + Date.now(),
      nameAr: localized.nameAr.split('(')[0].trim(),
      nameEn: localized.nameEn,
      category: placement,
      percentageOfOil: 15,
      description: `${localized.olfactoryFamily} · ${rtl ? 'الكثافة' : 'Density'}: ${localized.densityGPerMl}`,
    };

    onAddMaterialToPyramid(newNote);
    setAddedId(item.id);
    setTimeout(() => setAddedId(null), 2500);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-stone-200/80 pb-5">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-6 h-6 text-amber-700" />
          <h2 className="text-xl sm:text-2xl font-bold text-stone-900 font-serif-luxury">
            {rtl ? 'الموسوعة الشاملة لمواد وصناعة العطور (Raw Materials Encyclopedia)' : 'Comprehensive Fragrance Raw Materials Encyclopedia'}
          </h2>
        </div>
        <p className="text-stone-500 text-sm mt-1">
          {rtl
            ? 'دليل كيميائي شامل لجميع المذيبات، المثبتات، الجزيئات العطرية الحديثة، الأدهان الطبيعية، ومعايير الكثافة والسلامة الدولية IFRA.'
            : 'Comprehensive technical reference for all perfumer solvents, fixatives, modern aroma molecules, natural absolutes, and IFRA safety thresholds.'}
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className={`w-4 h-4 text-stone-400 absolute ${rtl ? 'right-3' : 'left-3'} top-3 pointer-events-none`} />
          <input
            type="text"
            placeholder={rtl ? 'ابحث باسم المادة أو رقم كاس (CAS) أو العائلة الشمية...' : 'Search material name, CAS number, or olfactory family...'}
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

      {/* Materials Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((item) => {
          const localized = getLocalizedRawMaterial(item, currentLang);
          return (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                
                {/* Header */}
                <div className="flex items-start justify-between gap-2 border-b border-stone-100 pb-3">
                  <div>
                    <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                      {localized.categoryAr}
                    </span>
                    <h3 className="text-sm font-bold text-stone-950 font-serif-luxury mt-0.5">
                      {localized.nameAr}
                    </h3>
                    <div className="text-[11px] text-stone-400 font-mono-numbers mt-0.5">
                      {localized.nameEn}
                    </div>
                  </div>

                  {item.casNumber && (
                    <span className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded bg-stone-100 text-stone-600 shrink-0 border border-stone-200/60" title="CAS Number">
                      CAS: {item.casNumber}
                    </span>
                  )}
                </div>

                {/* Chemical & Olfactory Specs */}
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-stone-50 p-2.5 rounded-xl font-mono-numbers">
                  <div>
                    <span className="text-[10px] text-stone-400 block font-sans">{rtl ? 'الكثافة النوعية:' : 'Specific Gravity:'}</span>
                    <span className="font-bold text-stone-900">{item.densityGPerMl} g/ml</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 block font-sans">{rtl ? 'الموقع بالهرم:' : 'Pyramid Level:'}</span>
                    <span className="font-semibold text-stone-800 font-sans">{localized.pyramidPlacementAr}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 block font-sans">{rtl ? 'النسبة الموصى بها:' : 'Recommended Usage:'}</span>
                    <span className="font-semibold text-amber-900">{item.recommendedUsagePercent}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 block font-sans">{rtl ? 'حد أمان IFRA:' : 'IFRA Safety Limit:'}</span>
                    <span className="font-semibold text-emerald-800 font-sans">{item.ifraLimitPercent}</span>
                  </div>
                </div>

                {/* Scent & Role */}
                <div className="space-y-2 text-xs text-stone-600 leading-relaxed">
                  <div>
                    <span className="font-bold text-stone-900 block text-[11px]">{rtl ? 'الرائحة والشعور:' : 'Scent Profile & Nuance:'}</span>
                    <p className="text-[11px] text-stone-600">{localized.scentProfile}</p>
                  </div>

                  <div>
                    <span className="font-bold text-stone-900 block text-[11px]">{rtl ? 'الدور الوظيفي في العطر:' : 'Technical Role:'}</span>
                    <p className="text-[11px] text-stone-600">{localized.roleInPerfume}</p>
                  </div>

                  <div>
                    <span className="font-bold text-stone-900 block text-[11px]">{rtl ? 'يتوافق بامتياز مع:' : 'Harmonious Partners:'}</span>
                    <p className="text-[11px] text-amber-900/90 font-medium">{localized.blendingPartners}</p>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
                {item.category !== 'solvent' ? (
                  <button
                    onClick={() => handleAdd(item)}
                    className="flex-1 py-2 px-3 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {addedId === item.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">{rtl ? 'أُضيفت للهرم!' : 'Added to Pyramid!'}</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5 text-amber-400" />
                        <span>{rtl ? 'إضافة للهرم العطري' : 'Add to Pyramid'}</span>
                      </>
                    )}
                  </button>
                ) : (
                  <span className="flex-1 py-2 px-3 bg-stone-100 text-stone-500 rounded-xl text-[11px] text-center font-medium border border-stone-200/80">
                    {rtl ? '💧 سائل حامل يُضبط بحاسبة التراكيز' : '💧 Carrier Solvent managed in Calculator'}
                  </span>
                )}

                <button
                  onClick={() => handleCopySpecs(item)}
                  className="py-2 px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                  title={getCommonLabel('copy', currentLang)}
                >
                  {copiedId === item.id ? (
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
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
};
