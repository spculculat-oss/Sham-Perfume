import React, { useState } from 'react';
import {
  Bookmark,
  Search,
  Plus,
  Trash2,
  Printer,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Clock,
  Layers,
  Check,
} from 'lucide-react';
import { SavedFormula } from '../types/perfume';
import { CURATED_FORMULA_PRESETS } from '../data/presets';
import { SupportedLanguage } from '../types/i18n';
import { getCommonLabel, isRTL } from '../utils/localizedContent';

interface FormulaLibraryProps {
  currentLang?: SupportedLanguage;
  savedFormulas: SavedFormula[];
  onLoadFormula: (formula: SavedFormula) => void;
  onDeleteFormula: (id: string) => void;
  onPrintFormula: (formula: SavedFormula) => void;
}

export const FormulaLibrary: React.FC<FormulaLibraryProps> = ({
  currentLang = 'ar',
  savedFormulas,
  onLoadFormula,
  onDeleteFormula,
  onPrintFormula,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'custom' | 'presets'>('all');

  const rtl = isRTL(currentLang);
  const ActionArrow = rtl ? ArrowLeft : ArrowRight;

  const filtered = savedFormulas.filter((f) => {
    const matchesQuery =
      f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.author || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.batchCode || '').toLowerCase().includes(searchQuery.toLowerCase());

    const isPreset = CURATED_FORMULA_PRESETS.some((p) => p.id === f.id);
    if (activeCategory === 'custom') return matchesQuery && !isPreset;
    if (activeCategory === 'presets') return matchesQuery && isPreset;
    return matchesQuery;
  });

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="border-b border-stone-200/80 pb-5">
        <h2 className="text-xl sm:text-2xl font-bold text-stone-900 font-serif-luxury">
          {rtl ? 'مكتبة الوصفات وتاريخ التشغيلات' : 'Formulation Library & Batch Archive'}
        </h2>
        <p className="text-stone-500 text-sm mt-1">
          {rtl
            ? 'تصفح تركيباتك المسجلة، حمّلها مباشرة إلى حاسبة المعمل، أو اطبع بطاقة التشغيلة للمصنع.'
            : 'Browse your saved bespoke formulas, load them directly into the laboratory calculator, or print production spec sheets.'}
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className={`w-4 h-4 text-stone-400 absolute ${rtl ? 'right-3' : 'left-3'} top-3 pointer-events-none`} />
          <input
            type="text"
            placeholder={rtl ? 'بحث بالاسم أو الكود أو المصمم...' : 'Search by formula name, batch code, or author...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full ${rtl ? 'pr-9 pl-4 text-right' : 'pl-9 pr-4 text-left'} py-2 bg-white border border-stone-200 rounded-lg text-xs text-stone-900 focus:outline-none focus:border-amber-700 shadow-2xs`}
          />
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-stone-100 rounded-lg text-xs font-medium">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              activeCategory === 'all'
                ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            {rtl ? `جميع التركيبات (${savedFormulas.length})` : `All Formulas (${savedFormulas.length})`}
          </button>
          <button
            onClick={() => setActiveCategory('presets')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              activeCategory === 'presets'
                ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            {rtl ? 'النماذج الكلاسيكية' : 'Curated Master Presets'}
          </button>
          <button
            onClick={() => setActiveCategory('custom')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              activeCategory === 'custom'
                ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            {rtl ? 'وصفاتي الخاصة' : 'My Custom Recipes'}
          </button>
        </div>
      </div>

      {/* Formula Cards Grid */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-stone-200 text-stone-400 text-sm">
          {getCommonLabel('empty_library', currentLang)} - {getCommonLabel('empty_library_desc', currentLang)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((formula) => {
            const isPreset = CURATED_FORMULA_PRESETS.some((p) => p.id === formula.id);
            return (
              <div
                key={formula.id}
                className="bg-white rounded-2xl border border-stone-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
              >
                <div className="p-5 space-y-4">
                  {/* Top Meta */}
                  <div className="flex items-center justify-between text-xs text-stone-400 font-mono-numbers">
                    <span>{formula.batchCode}</span>
                    <span>{formula.dateCreated}</span>
                  </div>

                  {/* Title & Author */}
                  <div>
                    <h3 className="font-bold text-stone-950 text-base font-serif-luxury">
                      {formula.title}
                    </h3>
                    <div className="text-xs text-amber-800 mt-0.5">
                      {rtl ? 'بإشراف:' : 'Perfumer:'} {formula.author}
                    </div>
                  </div>

                  {/* Quick specs */}
                  <div className="grid grid-cols-2 gap-2 p-3 bg-stone-50 rounded-xl text-xs font-mono-numbers">
                    <div>
                      <span className="text-[10px] text-stone-400 block font-sans">{rtl ? 'الحجم والتركيز:' : 'Volume & Strength:'}</span>
                      <span className="font-semibold text-stone-900">
                        {formula.formulation.bottleVolumeMl} ml · {formula.formulation.concentrationPercent}%
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-stone-400 block font-sans">{rtl ? 'فترة التعتيق:' : 'Maceration:'}</span>
                      <span className="font-semibold text-stone-900">
                        {formula.macerationDays} {rtl ? 'يوماً' : 'Days'}
                      </span>
                    </div>
                  </div>

                  {/* Notes description preview */}
                  {formula.notes && (
                    <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">
                      {formula.notes}
                    </p>
                  )}

                  {/* Pyramid count preview */}
                  <div className="flex items-center gap-2 text-xs text-stone-500 pt-1">
                    <Layers className="w-3.5 h-3.5 text-amber-700" />
                    <span>{formula.pyramidNotes?.length || 0} {rtl ? 'نوتات عطرية مدمجة في الهرم' : 'pyramid notes included'}</span>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="p-4 bg-stone-50/70 border-t border-stone-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => onLoadFormula(formula)}
                    className="flex-1 py-2 px-3 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>{getCommonLabel('load_in_lab', currentLang)}</span>
                    <ActionArrow className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onPrintFormula(formula)}
                    className="p-2 bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-lg text-xs transition-colors cursor-pointer"
                    title={getCommonLabel('print', currentLang)}
                  >
                    <Printer className="w-4 h-4 text-amber-800" />
                  </button>

                  {!isPreset && (
                    <button
                      onClick={() => onDeleteFormula(formula.id)}
                      className="p-2 text-stone-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title={getCommonLabel('delete', currentLang)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
