import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Trash2,
  Sparkles,
  Info,
  Beaker,
  AlertCircle,
  CheckCircle2,
  ListPlus,
  Wind,
  Sliders,
  BookOpen,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { CalculationResult, FormulationState, PyramidNote } from '../types/perfume';
import { CURATED_FORMULA_PRESETS, POPULAR_NOTES_DIRECTORY } from '../data/presets';
import { calculatePyramidBreakdown, formatNum } from '../utils/calculations';
import { FragrancePyramidGraphic } from './FragrancePyramidGraphic';
import { CalculatorCriteriaGuide } from './CalculatorCriteriaGuide';
import compoundingImg from '../assets/images/perfume_lab_compounding_1791692420116.jpg';
import { SupportedLanguage } from '../types/i18n';
import { isRTL } from '../utils/localizedContent';

interface PyramidCalculatorProps {
  currentLang?: SupportedLanguage;
  formulation: FormulationState;
  pyramidNotes: PyramidNote[];
  setPyramidNotes: React.Dispatch<React.SetStateAction<PyramidNote[]>>;
  result: CalculationResult;
}

export const PyramidCalculator: React.FC<PyramidCalculatorProps> = ({
  currentLang = 'ar',
  formulation,
  pyramidNotes,
  setPyramidNotes,
  result,
}) => {
  const [viewMode, setViewMode] = useState<'graphic' | 'compounding' | 'both' | 'guide'>('graphic');
  const [selectedDirectoryCategory, setSelectedDirectoryCategory] = useState<'all' | 'top' | 'heart' | 'base'>('all');
  const [newNoteName, setNewNoteName] = useState('');
  const [newNoteCategory, setNewNoteCategory] = useState<'top' | 'heart' | 'base'>('top');
  const [newNotePct, setNewNotePct] = useState(15);

  const rtl = isRTL(currentLang);
  const ActionArrow = rtl ? ArrowLeft : ArrowRight;

  const breakdown = calculatePyramidBreakdown(
    pyramidNotes,
    result.oilWeightGrams,
    result.oilVolumeMl
  );

  const handleAddCustomNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteName.trim()) return;

    const newNote: PyramidNote = {
      id: 'custom-' + Date.now(),
      nameAr: newNoteName.trim(),
      nameEn: 'Custom Accord',
      category: newNoteCategory,
      percentageOfOil: newNotePct,
    };

    setPyramidNotes((prev) => [...prev, newNote]);
    setNewNoteName('');
    setNewNotePct(10);
  };

  const handleAddFromDirectory = (item: (typeof POPULAR_NOTES_DIRECTORY)[0]) => {
    const defaultPct = item.category === 'top' ? 20 : item.category === 'heart' ? 40 : 30;
    const newNote: PyramidNote = {
      id: 'dir-' + Date.now() + Math.random(),
      nameAr: item.nameAr,
      nameEn: item.nameEn,
      category: item.category as 'top' | 'heart' | 'base',
      percentageOfOil: defaultPct,
      description: `${item.family} · تبخر: ${item.evaporation}`,
    };
    setPyramidNotes((prev) => [...prev, newNote]);
  };

  const handleUpdateNotePct = (id: string, pct: number) => {
    setPyramidNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, percentageOfOil: Math.max(0, pct) } : n))
    );
  };

  const handleDeleteNote = (id: string) => {
    setPyramidNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const handleLoadPreset = (formulaId: string) => {
    const target = CURATED_FORMULA_PRESETS.find((f) => f.id === formulaId);
    if (target) {
      setPyramidNotes(target.pyramidNotes);
    }
  };

  const handleAutoBalanceTo100 = () => {
    if (pyramidNotes.length === 0 || breakdown.totalPercentage <= 0) return;
    const factor = 100 / breakdown.totalPercentage;
    const balanced = pyramidNotes.map((n) => ({
      ...n,
      percentageOfOil: Math.round(n.percentageOfOil * factor * 10) / 10,
    }));
    const sum = balanced.reduce((acc, n) => acc + n.percentageOfOil, 0);
    const diff = Math.round((100 - sum) * 10) / 10;
    if (diff !== 0 && balanced.length > 0) {
      balanced[balanced.length - 1].percentageOfOil = Math.round((balanced[balanced.length - 1].percentageOfOil + diff) * 10) / 10;
    }
    setPyramidNotes(balanced);
  };

  const isBalanced100 = Math.abs(breakdown.totalPercentage - 100) < 0.1;

  return (
    <div className="space-y-8">
      {/* Section Header with View Mode Tabs */}
      <div className="border-b border-stone-200/80 pb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-stone-900 font-serif-luxury">
            {rtl ? 'حاسبة الهرم العطري ومزج الزيوت الخام' : 'Fragrance Pyramid & Accord Balancer'}
          </h2>
          <p className="text-stone-500 text-sm mt-1">
            {rtl
              ? `وزّع إجمالي الزيت العطري (${formatNum(result.oilWeightGrams)} جم) بين نوتات القمة والقلب والقاعدة لتحقيق فوحان وثبات متناسقين.`
              : `Distribute the total fragrance concentrate (${formatNum(result.oilWeightGrams)} g) across top, heart, and base notes for optimal longevity & sillage.`}
          </p>
        </div>

        {/* View mode toggle */}
        <div className="inline-flex p-1 bg-stone-100 rounded-2xl border border-stone-200 text-xs font-semibold shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('graphic')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'graphic'
                ? 'bg-amber-600 text-white shadow-sm font-bold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Wind className="w-3.5 h-3.5" />
            <span>{rtl ? 'جرافيك الهرم وسيناريو الرش 💨' : 'Visual Pyramid & Evaporation 💨'}</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('compounding')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'compounding'
                ? 'bg-stone-900 text-white shadow-sm font-bold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Beaker className="w-3.5 h-3.5" />
            <span>{rtl ? 'جدول موازين المعمل 🧪' : 'Lab Scale Breakdown 🧪'}</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('both')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'both'
                ? 'bg-stone-900 text-white shadow-sm font-bold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{rtl ? 'العرض الشامل 📐' : 'Combined View 📐'}</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('guide')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'guide'
                ? 'bg-amber-900 text-white shadow-sm font-bold'
                : 'text-amber-800 hover:text-amber-950 font-bold bg-amber-500/10'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-500" />
            <span>{rtl ? 'شرح المعايير 📚' : 'Criteria Guide 📚'}</span>
          </button>
        </div>
      </div>

      {/* 0. Criteria Guide View */}
      {viewMode === 'guide' && (
        <div className="animate-in fade-in">
          <CalculatorCriteriaGuide onClose={() => setViewMode('graphic')} />
        </div>
      )}

      {/* Preset Loader Strip (shown when not in guide mode) */}
      {viewMode !== 'guide' && (
      <div className="bg-white p-4 rounded-xl border border-stone-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-stone-800">
          <Sparkles className="w-4 h-4 text-amber-700" />
          <span>{rtl ? 'تراكيب وأهرامات عطرية جاهزة للتجربة:' : 'Curated Iconic Accords & Benchmark Presets:'}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {CURATED_FORMULA_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handleLoadPreset(preset.id)}
              className="px-3 py-1.5 text-xs rounded-md bg-stone-50 hover:bg-amber-50 hover:border-amber-400 border border-stone-200 text-stone-700 font-medium transition-all cursor-pointer"
            >
              {rtl ? preset.title.split('(')[0] : (preset.titleEn || preset.title.split('(')[0])}
            </button>
          ))}
        </div>
      </div>
      )}

      {/* 1. Graphic Fragrance Pyramid & Post-Spray Olfactory Evolution Scenario */}
      {(viewMode === 'graphic' || viewMode === 'both') && (
        <FragrancePyramidGraphic
          pyramidNotes={pyramidNotes}
          setPyramidNotes={setPyramidNotes}
          result={result}
          bottleVolumeMl={formulation.bottleVolumeMl}
          concentrationPercent={formulation.concentrationPercent}
        />
      )}

      {/* Quick Add and Directory in Graphic View */}
      {viewMode === 'graphic' && (
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <span className="text-xs font-bold text-stone-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-amber-600" />
              <span>{rtl ? 'إضافة زيوت عطرية جديدة إلى الهرم:' : 'Add New Fragrance Notes to Pyramid:'}</span>
            </span>
            <button
              type="button"
              onClick={() => setViewMode('compounding')}
              className="text-xs text-amber-700 hover:text-amber-800 font-semibold cursor-pointer flex items-center gap-1"
            >
              <span>{rtl ? 'عرض جدول موازين المعمل الكامل' : 'View Full Lab Compounding Scales'}</span>
              <ActionArrow className="w-3.5 h-3.5" />
            </button>
          </div>

          <form onSubmit={handleAddCustomNote} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-5">
              <input
                type="text"
                placeholder={rtl ? 'اسم الزيت العطري (مثل: برغموت صقلي، ياسمين، دهن عود...)' : 'Note name (e.g., Bergamot, Jasmine, Aged Oud...)'}
                value={newNoteName}
                onChange={(e) => setNewNoteName(e.target.value)}
                className={`w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-amber-600 ${rtl ? 'text-right' : 'text-left'}`}
              />
            </div>

            <div className="sm:col-span-3">
              <select
                value={newNoteCategory}
                onChange={(e) => setNewNoteCategory(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-amber-600"
              >
                <option value="top">{rtl ? 'قمة العطر (Top - الأسرع طيراناً)' : 'Top Note (Fastest Projection)'}</option>
                <option value="heart">{rtl ? 'قلب العطر (Heart - الفوحان المتوسط)' : 'Heart Note (Middle Bouquet)'}</option>
                <option value="base">{rtl ? 'قاعدة العطر (Base - الثبات الأقصى)' : 'Base Note (Maximum Longevity)'}</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={newNotePct}
                  onChange={(e) => setNewNotePct(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono-numbers text-stone-900 focus:outline-none focus:border-amber-600"
                />
                <span className={`absolute ${rtl ? 'left-3' : 'right-3'} top-2.5 text-xs text-stone-400`}>%</span>
              </div>
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>{rtl ? 'إدراج بالهرم' : 'Add Note'}</span>
              </button>
            </div>
          </form>

          {/* Quick Directory Chips */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs text-stone-600">
              <span className="font-semibold flex items-center gap-1.5">
                <ListPlus className="w-3.5 h-3.5 text-amber-700" />
                <span>{rtl ? 'نقر سريع لإضافة أشهر النوتات العالمية إلى الهرم:' : 'Quick Tap to Add Iconic Benchmark Notes:'}</span>
              </span>
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setSelectedDirectoryCategory('all')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${selectedDirectoryCategory === 'all' ? 'bg-stone-900 text-white font-medium' : 'text-stone-500'}`}
                >
                  {rtl ? 'الكل' : 'All'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDirectoryCategory('top')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${selectedDirectoryCategory === 'top' ? 'bg-amber-500 text-stone-950 font-bold' : 'text-stone-500'}`}
                >
                  {rtl ? 'قمة' : 'Top'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDirectoryCategory('heart')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${selectedDirectoryCategory === 'heart' ? 'bg-stone-800 text-white font-bold' : 'text-stone-500'}`}
                >
                  {rtl ? 'قلب' : 'Heart'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDirectoryCategory('base')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${selectedDirectoryCategory === 'base' ? 'bg-amber-950 text-amber-300 font-bold' : 'text-stone-500'}`}
                >
                  {rtl ? 'قاعدة' : 'Base'}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pt-1">
              {POPULAR_NOTES_DIRECTORY.filter(
                (note) => selectedDirectoryCategory === 'all' || note.category === selectedDirectoryCategory
              ).map((note, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAddFromDirectory(note)}
                  className="px-2.5 py-1 text-[11px] rounded-lg bg-stone-50 hover:bg-amber-50 hover:border-amber-300 border border-stone-200 text-stone-800 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3 text-amber-700" />
                  <span>{rtl ? note.nameAr : (note.nameEn || note.nameAr)}</span>
                  <span className="text-[9px] text-stone-400">({note.family})</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. Classic Compounding Laboratory Grid */}
      {(viewMode === 'compounding' || viewMode === 'both') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Visual Pyramid & Balance Indicator */}
        <div className="lg:col-span-5 space-y-6">

          {/* Graphic Fragrance Pyramid */}
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <span className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                {rtl ? 'التوزيع الهرمي الحالي' : 'Current Pyramid Distribution'}
              </span>
              <span
                className={`text-xs font-mono-numbers font-semibold ${
                  isBalanced100 ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {rtl ? 'المجموع:' : 'Total:'} {formatNum(breakdown.totalPercentage, 1)}%
              </span>
            </div>

            {/* Pyramid Layers */}
            <div className="space-y-2 pt-2">
              {/* 1. Top Layer */}
              <div className="relative group bg-amber-50/90 border border-amber-200 rounded-xl p-4 text-center transition-all">
                <div className="text-[11px] font-semibold text-amber-900 uppercase">
                  {rtl ? 'قمة العطر (Top Notes)' : 'Top Notes (Head)'}
                </div>
                <div className="text-xl font-extrabold text-amber-950 font-mono-numbers mt-0.5">
                  {formatNum(breakdown.topPct, 1)}%
                </div>
                <div className="text-[11px] text-amber-800/80 mt-1">
                  {rtl ? 'الوزن:' : 'Weight:'} {formatNum((result.oilWeightGrams * breakdown.topPct) / 100)} g
                </div>
                <div className="text-[10px] text-stone-500 mt-0.5">
                  {rtl ? 'الحمضيات والأعشاب الخفيفة · الفوحان الأولي (15-30 دقيقة)' : 'Citrus & volatile aromatics · Initial projection (15-30 min)'}
                </div>
              </div>

              {/* 2. Heart Layer */}
              <div className="relative group bg-stone-100 border border-stone-200 rounded-xl p-4 text-center transition-all">
                <div className="text-[11px] font-semibold text-stone-800 uppercase">
                  {rtl ? 'قلب العطر (Heart / Middle Notes)' : 'Heart Notes (Bouquet)'}
                </div>
                <div className="text-xl font-extrabold text-stone-900 font-mono-numbers mt-0.5">
                  {formatNum(breakdown.heartPct, 1)}%
                </div>
                <div className="text-[11px] text-stone-700 mt-1">
                  {rtl ? 'الوزن:' : 'Weight:'} {formatNum((result.oilWeightGrams * breakdown.heartPct) / 100)} g
                </div>
                <div className="text-[10px] text-stone-500 mt-0.5">
                  {rtl ? 'الزهور، التوابل، الفواكه · روح العطر وهوية التركيبة (2-6 ساعات)' : 'Florals, spices, sweet fruits · Fragrance signature (2-6 hours)'}
                </div>
              </div>

              {/* 3. Base Layer */}
              <div className="relative group bg-stone-900 text-white rounded-xl p-4 text-center transition-all shadow-sm">
                <div className="text-[11px] font-semibold text-amber-400 uppercase">
                  {rtl ? 'قاعدة العطر (Base Notes)' : 'Base Notes (Fixatives)'}
                </div>
                <div className="text-xl font-extrabold text-white font-mono-numbers mt-0.5">
                  {formatNum(breakdown.basePct, 1)}%
                </div>
                <div className="text-[11px] text-stone-300 mt-1">
                  {rtl ? 'الوزن:' : 'Weight:'} {formatNum((result.oilWeightGrams * breakdown.basePct) / 100)} g
                </div>
                <div className="text-[10px] text-stone-400 mt-0.5">
                  {rtl ? 'العود، الصندل، العنبر، الفانيليا، المسك · الثبات والعمق (8-24+ ساعة)' : 'Oud, sandalwood, amber, vanilla, musks · Tenacity (8-24+ hours)'}
                </div>
              </div>
            </div>

            {/* Validation Message */}
            {!isBalanced100 && (
              <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-lg text-xs text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <span>{rtl ? `مجموع نسب المكونات حالياً هو ${formatNum(breakdown.totalPercentage, 1)}%. يُرجى ضبط النسب ليصبح المجموع 100% بدقة.` : `Total formula sum is currently ${formatNum(breakdown.totalPercentage, 1)}%. Please adjust notes to total exactly 100%.`}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAutoBalanceTo100}
                  className="px-3 py-1.5 bg-amber-800 hover:bg-amber-900 text-amber-50 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>{rtl ? 'موازنة تلقائية لـ 100%' : 'Auto-Balance to 100%'}</span>
                </button>
              </div>
            )}

            {isBalanced100 && (
              <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-lg text-xs text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{rtl ? 'الهرم العطري متكامل بنسبة 100% تماماً.' : 'Fragrance pyramid is perfectly balanced at 100%.'}</span>
              </div>
            )}
          </div>

          {/* Compounding Visual Card */}
          <div className="rounded-2xl overflow-hidden border border-stone-200 shadow-xs relative aspect-[4/3]">
            <img
              src={compoundingImg}
              alt="Laboratory Balance Compounding"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-transparent to-transparent flex items-end p-4">
              <div className="text-white text-xs space-y-0.5">
                <span className="font-bold text-amber-300 block">{rtl ? 'نصيحة الخلط والمزج:' : 'Master Compounding Rule:'}</span>
                <p className="text-[11px] text-stone-200 leading-relaxed">
                  {rtl
                    ? 'امزج نوتات القاعدة أولاً ثم القلب ثم القمة، واترك المزيج الزيتي يرتاح 48 ساعة قبل إضافة الكحول ليتجانس بصورة متكاملة.'
                    : 'Blend base fixatives first, then heart florals, then volatile top notes. Allow 48 hours resting before ethanol introduction.'}
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Manage Oil Ingredients & Library Directory */}
        <div className="lg:col-span-7 space-y-6">

          {/* Add Custom Ingredient Form */}
          <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-sm space-y-3">
            <span className="text-xs font-bold text-stone-900 block">
              {rtl ? 'إضافة زيت عِطري أو نوتة جديدة:' : 'Add Custom Fragrance Oil / Accord:'}
            </span>
            <form onSubmit={handleAddCustomNote} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-5">
                <input
                  type="text"
                  placeholder={rtl ? 'اسم الزيت (مثل: دهن عود تراد، ورد طائفي...)' : 'Oil name (e.g., Oud Cambodi, Taif Rose...)'}
                  value={newNoteName}
                  onChange={(e) => setNewNoteName(e.target.value)}
                  className={`w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-900 focus:outline-none focus:border-amber-700 ${rtl ? 'text-right' : 'text-left'}`}
                />
              </div>

              <div className="sm:col-span-3">
                <select
                  value={newNoteCategory}
                  onChange={(e) => setNewNoteCategory(e.target.value as any)}
                  className="w-full px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-900 focus:outline-none focus:border-amber-700"
                >
                  <option value="top">{rtl ? 'قمة العطر (Top)' : 'Top Note'}</option>
                  <option value="heart">{rtl ? 'قلب العطر (Heart)' : 'Heart Note'}</option>
                  <option value="base">{rtl ? 'قاعدة العطر (Base)' : 'Base Note'}</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    value={newNotePct}
                    onChange={(e) => setNewNotePct(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono-numbers text-stone-900 focus:outline-none focus:border-amber-700"
                  />
                  <span className={`absolute ${rtl ? 'left-2' : 'right-2'} top-2 text-xs text-stone-400`}>%</span>
                </div>
              </div>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="w-full py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{rtl ? 'إضافة' : 'Add'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Active Ingredients Table */}
          <div className="bg-white rounded-xl border border-stone-200/80 shadow-sm overflow-hidden">
            <div className="p-4 bg-stone-50/70 border-b border-stone-200/70 flex items-center justify-between">
              <span className="text-xs font-bold text-stone-900">
                {rtl
                  ? `مكونات الزيت العطري الحالية (${breakdown.notesWithQuantities.length} زيوت)`
                  : `Active Fragrance Concentrates (${breakdown.notesWithQuantities.length} notes)`}
              </span>
              <button
                type="button"
                onClick={() => setPyramidNotes([])}
                className="text-[11px] text-rose-700 hover:text-rose-900 cursor-pointer"
              >
                {rtl ? 'تفريغ القائمة' : 'Clear All'}
              </button>
            </div>

            {breakdown.notesWithQuantities.length === 0 ? (
              <div className="p-8 text-center text-stone-400 text-xs">
                {rtl
                  ? 'لا توجد زيوت مضافة حالياً. اختر من التراكيب الجاهزة بالأعلى أو أضف زيوتاً من الدليل بالأسفل.'
                  : 'No ingredients added yet. Pick a preset above or tap materials in the catalog below.'}
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {breakdown.notesWithQuantities.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 flex items-center justify-between gap-3 hover:bg-stone-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          item.category === 'top'
                            ? 'bg-amber-500'
                            : item.category === 'heart'
                            ? 'bg-stone-600'
                            : 'bg-stone-950'
                        }`}
                      />
                      <div className="truncate">
                        <div className="text-xs font-semibold text-stone-900 truncate">
                          {rtl ? item.nameAr : (item.nameEn || item.nameAr)}
                        </div>
                        <div className="text-[10px] text-stone-400">
                          {item.category === 'top'
                            ? (rtl ? 'قمة العطر' : 'Top Note')
                            : item.category === 'heart'
                            ? (rtl ? 'قلب العطر' : 'Heart Note')
                            : (rtl ? 'قاعدة العطر' : 'Base Note')}
                          {item.description ? ` · ${item.description}` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Weight Display */}
                      <div className="text-left font-mono-numbers">
                        <div className="text-xs font-bold text-amber-900">
                          {formatNum(item.weightGrams)} g
                        </div>
                        <div className="text-[10px] text-stone-400">
                          {formatNum(item.volumeMl)} ml
                        </div>
                      </div>

                      {/* Percentage Controller */}
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={item.percentageOfOil}
                          onChange={(e) =>
                            handleUpdateNotePct(item.id, parseFloat(e.target.value) || 0)
                          }
                          className="w-14 px-2 py-1 bg-stone-50 border border-stone-200 rounded text-xs font-mono-numbers text-center text-stone-900"
                        />
                        <span className="text-[11px] text-stone-500">%</span>
                      </div>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleDeleteNote(item.id)}
                        className="p-1 text-stone-400 hover:text-rose-600 transition-colors cursor-pointer"
                        title={rtl ? 'حذف' : 'Delete'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Add from Common Notes Directory */}
          <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                <ListPlus className="w-4 h-4 text-amber-700" />
                <span>{rtl ? 'دليل أشهر النوتات والمواد العطرية الشائعة (انقر للإضافة):' : 'Iconic Materials Directory (Click to add):'}</span>
              </span>
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  onClick={() => setSelectedDirectoryCategory('all')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    selectedDirectoryCategory === 'all'
                      ? 'bg-stone-900 text-white font-medium'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {rtl ? 'الكل' : 'All'}
                </button>
                <button
                  onClick={() => setSelectedDirectoryCategory('top')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    selectedDirectoryCategory === 'top'
                      ? 'bg-amber-500 text-stone-950 font-bold'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {rtl ? 'قمة' : 'Top'}
                </button>
                <button
                  onClick={() => setSelectedDirectoryCategory('heart')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    selectedDirectoryCategory === 'heart'
                      ? 'bg-stone-800 text-white font-bold'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {rtl ? 'قلب' : 'Heart'}
                </button>
                <button
                  onClick={() => setSelectedDirectoryCategory('base')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    selectedDirectoryCategory === 'base'
                      ? 'bg-amber-950 text-amber-300 font-bold'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {rtl ? 'قاعدة' : 'Base'}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1 max-h-48 overflow-y-auto">
              {POPULAR_NOTES_DIRECTORY.filter(
                (note) =>
                  selectedDirectoryCategory === 'all' ||
                  note.category === selectedDirectoryCategory
              ).map((note, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAddFromDirectory(note)}
                  className="px-2.5 py-1 text-[11px] rounded-md bg-stone-50 hover:bg-amber-100/70 border border-stone-200/60 text-stone-800 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3 text-amber-800" />
                  <span>{rtl ? note.nameAr : (note.nameEn || note.nameAr)}</span>
                  <span className="text-[9px] text-stone-400">({note.family})</span>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
      )}
    </div>
  );
};
