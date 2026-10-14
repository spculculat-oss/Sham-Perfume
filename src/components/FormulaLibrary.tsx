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
import { LText, makeT, fmt, localeDate } from '../utils/localize';

interface FormulaLibraryProps {
  currentLang?: SupportedLanguage;
  savedFormulas: SavedFormula[];
  onLoadFormula: (formula: SavedFormula) => void;
  onDeleteFormula: (id: string) => void;
  onPrintFormula: (formula: SavedFormula) => void;
}

const S = {
  page_title: {
    ar: 'مكتبة الوصفات وتاريخ التشغيلات',
    en: 'Formulation Library & Batch Archive',
    fr: 'Bibliothèque de formules et archives',
    es: 'Biblioteca de fórmulas y archivo',
    it: 'Libreria formule e archivio lotti',
    de: 'Formelbibliothek & Chargenarchiv',
    ru: 'Библиотека формул и архив партий',
    zh: '配方库与批次档案',
    tr: 'Formül kütüphanesi ve parti arşivi',
    fa: 'کتابخانه فرمول‌ها و تاریخچه پارت‌ها',
  },
  page_desc: {
    ar: 'تصفح تركيباتك المسجلة، حمّلها مباشرة إلى حاسبة المعمل، أو اطبع بطاقة التشغيلة للمصنع.',
    en: 'Browse your saved bespoke formulas, load them directly into the laboratory calculator, or print production spec sheets.',
    fr: 'Parcourez vos formules enregistrées, chargez-les dans le calculateur ou imprimez les fiches de production.',
    es: 'Explore sus fórmulas guardadas, cárguelas en la calculadora o imprima fichas de producción.',
    it: 'Sfoglia le formule salvate, caricale nel calcolatore o stampa le schede di produzione.',
    de: 'Durchsuchen Sie gespeicherte Formeln, laden Sie sie in den Rechner oder drucken Sie Produktionsblätter.',
    ru: 'Просматривайте сохранённые формулы, загружайте их в калькулятор или печатайте техкарты.',
    zh: '浏览已保存的配方，直接载入实验室计算器，或打印生产规格单。',
    tr: 'Kayıtlı formüllerinizi gözden geçirin, hesaplayıcıya yükleyin veya üretim kartlarını yazdırın.',
    fa: 'فرمول‌های ذخیره‌شده خود را مرور کنید، آن‌ها را در ماشین‌حساب بارگذاری کنید یا کارت تولید را چاپ کنید.',
  },
  search_ph: {
    ar: 'بحث بالاسم أو الكود أو المصمم...',
    en: 'Search by formula name, batch code, or author...',
    fr: 'Rechercher par nom, code de lot ou auteur...',
    es: 'Buscar por nombre, código o autor...',
    it: 'Cerca per nome, codice lotto o autore...',
    de: 'Nach Name, Chargencode oder Autor suchen...',
    ru: 'Поиск по названию, коду партии или автору...',
    zh: '按配方名、批次代码或作者搜索…',
    tr: 'İsim, parti kodu veya tasarımcıya göre ara...',
    fa: 'جستجو بر اساس نام، کد یا طراح...',
  },
  all_formulas_tpl: {
    ar: 'جميع التركيبات ({n})',
    en: 'All Formulas ({n})',
    fr: 'Toutes les formules ({n})',
    es: 'Todas las fórmulas ({n})',
    it: 'Tutte le formule ({n})',
    de: 'Alle Formeln ({n})',
    ru: 'Все формулы ({n})',
    zh: '全部配方（{n}）',
    tr: 'Tüm formüller ({n})',
    fa: 'همه ترکیب‌ها ({n})',
  },
  presets_tab: {
    ar: 'النماذج الكلاسيكية',
    en: 'Curated Master Presets',
    fr: 'Formules de référence',
    es: 'Fórmulas de referencia',
    it: 'Formule di riferimento',
    de: 'Kuratierte Meisterformeln',
    ru: 'Эталонные формулы',
    zh: '精选大师配方',
    tr: 'Seçkin usta formülleri',
    fa: 'فرمول‌های مرجع',
  },
  custom_tab: {
    ar: 'وصفاتي الخاصة',
    en: 'My Custom Recipes',
    fr: 'Mes recettes personnalisées',
    es: 'Mis recetas personalizadas',
    it: 'Le mie ricette personalizzate',
    de: 'Meine eigenen Rezepte',
    ru: 'Мои собственные рецепты',
    zh: '我的自创配方',
    tr: 'Özel reçetelerim',
    fa: 'فرمول‌های سفارشی من',
  },
  perfumer: {
    ar: 'بإشراف:',
    en: 'Perfumer:',
    fr: 'Parfumeur :',
    es: 'Perfumista:',
    it: 'Profumiere:',
    de: 'Parfümeur:',
    ru: 'Парфюмер:',
    zh: '调香师：',
    tr: 'Parfümör:',
    fa: 'طراح:',
  },
  volume_strength: {
    ar: 'الحجم والتركيز:',
    en: 'Volume & Strength:',
    fr: 'Volume & concentration :',
    es: 'Volumen y concentración:',
    it: 'Volume e concentrazione:',
    de: 'Volumen & Stärke:',
    ru: 'Объём и концентрация:',
    zh: '容量与浓度：',
    tr: 'Hacim ve konsantrasyon:',
    fa: 'حجم و غلظت:',
  },
  maceration: {
    ar: 'فترة التعتيق:',
    en: 'Maceration:',
    fr: 'Macération :',
    es: 'Maceración:',
    it: 'Macerazione:',
    de: 'Reifung:',
    ru: 'Мацерация:',
    zh: '陈化期：',
    tr: 'Dinlendirme:',
    fa: 'مدت کهنه‌سازی:',
  },
  days: {
    ar: 'يوماً',
    en: 'Days',
    fr: 'jours',
    es: 'días',
    it: 'giorni',
    de: 'Tage',
    ru: 'дней',
    zh: '天',
    tr: 'gün',
    fa: 'روز',
  },
  notes_count_tpl: {
    ar: '{n} نوتات عطرية مدمجة في الهرم',
    en: '{n} pyramid notes included',
    fr: '{n} notes de pyramide incluses',
    es: '{n} notas de pirámide incluidas',
    it: '{n} note della piramide incluse',
    de: '{n} Pyramidennoten enthalten',
    ru: '{n} нот пирамиды включено',
    zh: '含 {n} 个金字塔香材',
    tr: '{n} piramit notası içerir',
    fa: '{n} نت عطری در هرم',
  },
} satisfies Record<string, LText>;

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
  const L = makeT(currentLang, S);
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
          {L('page_title')}
        </h2>
        <p className="text-stone-500 text-sm mt-1">
          {L('page_desc')}
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className={`w-4 h-4 text-stone-400 absolute ${rtl ? 'right-3' : 'left-3'} top-3 pointer-events-none`} />
          <input
            type="text"
            placeholder={L('search_ph')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full ${rtl ? 'pr-9 pl-4 text-right' : 'pl-9 pr-4 text-left'} py-2 bg-white border border-stone-200 rounded-lg text-xs text-stone-900 focus:outline-none focus:border-amber-700 shadow-2xs`}
          />
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-stone-100 rounded-lg text-xs font-medium flex-wrap">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              activeCategory === 'all'
                ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            {fmt(L('all_formulas_tpl'), { n: savedFormulas.length })}
          </button>
          <button
            onClick={() => setActiveCategory('presets')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              activeCategory === 'presets'
                ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            {L('presets_tab')}
          </button>
          <button
            onClick={() => setActiveCategory('custom')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              activeCategory === 'custom'
                ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            {L('custom_tab')}
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
                    <span>{localeDate(currentLang, new Date(formula.dateCreated), { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>

                  {/* Title & Author */}
                  <div>
                    <h3 className="font-bold text-stone-950 text-base font-serif-luxury">
                      {formula.title}
                    </h3>
                    <div className="text-xs text-amber-800 mt-0.5">
                      {L('perfumer')} {formula.author}
                    </div>
                  </div>

                  {/* Quick specs */}
                  <div className="grid grid-cols-2 gap-2 p-3 bg-stone-50 rounded-xl text-xs font-mono-numbers">
                    <div>
                      <span className="text-[10px] text-stone-400 block font-sans">{L('volume_strength')}</span>
                      <span className="font-semibold text-stone-900">
                        {formula.formulation.bottleVolumeMl} ml · {formula.formulation.concentrationPercent}%
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-stone-400 block font-sans">{L('maceration')}</span>
                      <span className="font-semibold text-stone-900">
                        {formula.macerationDays} {L('days')}
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
                    <span>{fmt(L('notes_count_tpl'), { n: formula.pyramidNotes?.length || 0 })}</span>
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
