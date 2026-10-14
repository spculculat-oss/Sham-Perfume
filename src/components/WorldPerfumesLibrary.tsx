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
import { LText, makeT, fmt, pickArEn } from '../utils/localize';


const S = {
  cat_all_tpl: {
    ar: 'جميع العطور العالمية ({n})',
    en: 'All Iconic Perfumes ({n})',
    fr: 'Tous les parfums emblématiques ({n})',
    es: 'Todos los perfumes icónicos ({n})',
    it: 'Tutti i profumi iconici ({n})',
    de: 'Alle ikonischen Düfte ({n})',
    ru: 'Все легендарные ароматы ({n})',
    zh: '全部经典香水（{n}）',
    tr: 'Tüm ikonik parfümler ({n})',
    fa: 'همه عطرهای مشهور جهان ({n})',
  },
  cat_oriental: {
    ar: 'شرقي وعنبر (Oriental)',
    en: 'Oriental & Amber',
    fr: 'Oriental et ambre',
    es: 'Oriental y ámbar',
    it: 'Orientale e ambrato',
    de: 'Orientalisch & Amber',
    ru: 'Восточные и амбровые',
    zh: '东方与琥珀',
    tr: 'Oryantal ve amber',
    fa: 'شرقی و عنبری',
  },
  cat_woody: {
    ar: 'خشبي وعود (Woody)',
    en: 'Woody & Oud',
    fr: 'Boisé et oud',
    es: 'Maderoso y oud',
    it: 'Legnoso e oud',
    de: 'Holzig & Oud',
    ru: 'Древесные и удовые',
    zh: '木质与乌木',
    tr: 'Odunsu ve oud',
    fa: 'چوبی و عود',
  },
  cat_citrus: {
    ar: 'حمضيات وأروماتيك (Citrus)',
    en: 'Citrus & Aromatic',
    fr: 'Agrumes et aromatiques',
    es: 'Cítrico y aromático',
    it: 'Agrumato e aromatico',
    de: 'Zitrus & Aromatisch',
    ru: 'Цитрусовые и ароматические',
    zh: '柑橘与芳香',
    tr: 'Narenciye ve aromatik',
    fa: 'مرکبات و آروماتیک',
  },
  cat_gourmand: {
    ar: 'جورماند وتوابل (Gourmand)',
    en: 'Gourmand & Spices',
    fr: 'Gourmand et épicé',
    es: 'Gourmand y especias',
    it: 'Gourmand e spezie',
    de: 'Gourmand & Gewürze',
    ru: 'Гурманские и пряные',
    zh: '美食调与香料',
    tr: 'Gurme ve baharat',
    fa: 'گورمان و ادویه',
  },
  cat_floral: {
    ar: 'زهري وألدهيدي (Floral)',
    en: 'Floral & Aldehydic',
    fr: 'Floral et aldéhydé',
    es: 'Floral y aldehídico',
    it: 'Floreale e aldeidico',
    de: 'Floral & Aldehydisch',
    ru: 'Цветочные и альдегидные',
    zh: '花香与醛香',
    tr: 'Çiçeksi ve aldehitik',
    fa: 'گلی و آلدهیدی',
  },
  cat_leather: {
    ar: 'جلود وتبغ (Leather)',
    en: 'Leather & Tobacco',
    fr: 'Cuir et tabac',
    es: 'Cuero y tabaco',
    it: 'Pelle e tabacco',
    de: 'Leder & Tabak',
    ru: 'Кожаные и табачные',
    zh: '皮革与烟草',
    tr: 'Deri ve tütün',
    fa: 'چرمی و تنباکو',
  },
  cat_aquatic: {
    ar: 'بحري ومائي (Aquatic)',
    en: 'Marine & Aquatic',
    fr: 'Marin et aquatique',
    es: 'Marino y acuático',
    it: 'Marino e acquatico',
    de: 'Maritim & Aquatisch',
    ru: 'Морские и водные',
    zh: '海洋与水生',
    tr: 'Deniz ve su',
    fa: 'دریایی و آبی',
  },
  page_title: {
    ar: 'مكتبة أشهر التركيبات العالمية (World Iconic Perfumes)',
    en: 'World Iconic Perfumes Library & Formula Accords',
    fr: 'Bibliothèque des parfums emblématiques du monde',
    es: 'Biblioteca de perfumes icónicos del mundo',
    it: 'Libreria dei profumi iconici del mondo',
    de: 'Bibliothek der ikonischen Düfte der Welt',
    ru: 'Библиотека легендарных ароматов мира',
    zh: '世界经典香水配方库',
    tr: 'Dünya ikonik parfüm kütüphanesi',
    fa: 'کتابخانه عطرهای مشهور جهان',
  },
  page_desc: {
    ar: 'الأكوردات والهياكل العطرية لأعظم العطور العالمية (بكرات روج 540، كريد أفينتوس، توم فورد توباكو فانيلا، ديور سوفاج، بلاك أفغانو...) مع نسب المكونات الدقيقة للتحميل في حاسبة المعمل بضغطة زر.',
    en: 'Accords and structural olfactory formulas of the world’s greatest iconic fragrances (Baccarat Rouge 540, Creed Aventus, Tom Ford Tobacco Vanille, Sauvage, Black Afgano...) ready to load directly into the lab calculator.',
    fr: 'Accords et structures des plus grands parfums mondiaux (Baccarat Rouge 540, Creed Aventus, Tom Ford Tobacco Vanille, Sauvage…) prêts à charger dans le calculateur.',
    es: 'Acuerdos y fórmulas de los perfumes más icónicos del mundo (Baccarat Rouge 540, Creed Aventus, Tom Ford Tobacco Vanille, Sauvage…) listos para cargar en la calculadora.',
    it: 'Accordi e formule dei profumi più iconici al mondo (Baccarat Rouge 540, Creed Aventus, Tom Ford Tobacco Vanille, Sauvage…) pronti da caricare nel calcolatore.',
    de: 'Akkorde und Formeln der größten Düfte der Welt (Baccarat Rouge 540, Creed Aventus, Tom Ford Tobacco Vanille, Sauvage…) direkt in den Rechner ladbar.',
    ru: 'Аккорды и структуры величайших ароматов мира (Baccarat Rouge 540, Creed Aventus, Tom Ford Tobacco Vanille, Sauvage…) — загрузка в калькулятор одним нажатием.',
    zh: '世界最经典香水的香调结构与配方（Baccarat Rouge 540、Creed Aventus、Tom Ford Tobacco Vanille、Sauvage 等），一键载入实验室计算器。',
    tr: 'Dünyanın en ikonik parfümlerinin akorları ve formülleri (Baccarat Rouge 540, Creed Aventus, Tom Ford Tobacco Vanille, Sauvage…) hesaplayıcıya tek tıkla yüklenir.',
    fa: 'آکوردها و ساختار عطری مشهورترین عطرهای جهان (بکرا روژ ۵۴۰، کرد اونتوس، تام فورد توباکو وانیل، سواج…) با یک کلیک در ماشین‌حساب بارگذاری می‌شوند.',
  },
  search_placeholder: {
    ar: 'ابحث بالاسم (مثال: بكرات روج، أفينتوس، توم فورد، زعفران...)',
    en: 'Search iconic perfumes (e.g., Baccarat Rouge, Aventus, Tom Ford, Saffron...)',
    fr: 'Rechercher un parfum (ex. Baccarat Rouge, Aventus, Tom Ford…)',
    es: 'Buscar perfumes icónicos (ej. Baccarat Rouge, Aventus, Tom Ford…)',
    it: 'Cerca profumi iconici (es. Baccarat Rouge, Aventus, Tom Ford…)',
    de: 'Ikonische Düfte suchen (z. B. Baccarat Rouge, Aventus, Tom Ford…)',
    ru: 'Поиск ароматов (напр. Baccarat Rouge, Aventus, Tom Ford…)',
    zh: '搜索经典香水（如：Baccarat Rouge、Aventus、Tom Ford…）',
    tr: 'İkonik parfüm ara (ör. Baccarat Rouge, Aventus, Tom Ford…)',
    fa: 'جستجوی عطر (مثال: بکرا روژ، اونتوس، تام فورد، زعفران…)',
  },
  longevity_lbl: {
    ar: 'الثبات على الملابس:',
    en: 'Fabric Longevity:',
    fr: 'Tenue sur tissu :',
    es: 'Duración en tela:',
    it: 'Persistenza su tessuto:',
    de: 'Haltbarkeit auf Stoff:',
    ru: 'Стойкость на ткани:',
    zh: '织物留香：',
    tr: 'Kumaşta kalıcılık:',
    fa: 'ماندگاری روی پارچه:',
  },
  sillage_lbl: {
    ar: 'قوة الفوحان:',
    en: 'Sillage / Projection:',
    fr: 'Sillage / Projection :',
    es: 'Estela / Proyección:',
    it: 'Scia / Proiezione:',
    de: 'Sillage / Projektion:',
    ru: 'Шлейф / Проекция:',
    zh: '扩散力：',
    tr: 'İz / yayılma gücü:',
    fa: 'قدرت انتشار:',
  },
  maceration_lbl: {
    ar: 'مدة التعتيق المثالية:',
    en: 'Optimal Maceration:',
    fr: 'Macération idéale :',
    es: 'Maceración ideal:',
    it: 'Macerazione ideale:',
    de: 'Optimale Reifung:',
    ru: 'Идеальная мацерация:',
    zh: '最佳陈化期：',
    tr: 'İdeal dinlendirme:',
    fa: 'دورۀ کهنه‌سازی ایده‌آل:',
  },
  days_word: {
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
  breakdown_lbl: {
    ar: 'جدول توزيع النوتات العطرية لمركب الزيت (100%):',
    en: 'Fragrance Pyramid Oil Breakdown (100%):',
    fr: 'Répartition de la pyramide olfactive (100 %) :',
    es: 'Desglose de la pirámide olfativa (100 %):',
    it: 'Ripartizione della piramide olfattiva (100%):',
    de: 'Duftpyramiden-Aufschlüsselung (100 %):',
    ru: 'Структура ольфакторной пирамиды (100%):',
    zh: '香调金字塔成分表（100%）：',
    tr: 'Koku piramidi dağılımı (%100):',
    fa: 'جدول توزیع نت‌های عطری (۱۰۰٪):',
  },
  notes_word: {
    ar: 'مكونات',
    en: 'Notes',
    fr: 'notes',
    es: 'notas',
    it: 'note',
    de: 'Noten',
    ru: 'нот',
    zh: '个香材',
    tr: 'nota',
    fa: 'ماده',
  },
  top_word: {
    ar: 'قمة',
    en: 'Top',
    fr: 'Tête',
    es: 'Salida',
    it: 'Testa',
    de: 'Kopf',
    ru: 'Верх',
    zh: '前调',
    tr: 'Üst',
    fa: 'ابتدایی',
  },
  heart_word: {
    ar: 'قلب',
    en: 'Heart',
    fr: 'Cœur',
    es: 'Corazón',
    it: 'Cuore',
    de: 'Herz',
    ru: 'Сердце',
    zh: '中调',
    tr: 'Kalp',
    fa: 'میانی',
  },
  base_word: {
    ar: 'قاعدة',
    en: 'Base',
    fr: 'Fond',
    es: 'Fondo',
    it: 'Fondo',
    de: 'Basis',
    ru: 'База',
    zh: '后调',
    tr: 'Dip',
    fa: 'پایه',
  },
  shahin_tip: {
    ar: 'نصيحة الخبير شاهين لضبط المركب:',
    en: 'Master Shahin Formula Optimization Tip:',
    fr: 'Conseil du maître Shahin :',
    es: 'Consejo del maestro Shahin:',
    it: 'Consiglio del maestro Shahin:',
    de: 'Meister Shahins Formeltipp:',
    ru: 'Совет мастера Шахина:',
    zh: 'Shahin 大师配方调校建议：',
    tr: 'Usta Shahin formül ipucu:',
    fa: 'نکته استاد شاهین برای تنظیم ترکیب:',
  },
  clip_tpl: {
    ar: `👑 تركيبة: {name}
الدار الأصلية: {brand} ({year})
التصنيف: {cat} | التركيز: {conc}% ({conc_type})
الثبات: {longevity} | الفوحان: {sillage}
مدة التعتيق: {mac} يوماً

🔺 توزيع الهرم العطري لمركب الزيت (100%):
{notes}

💡 نصيحة الخبير شاهين:
{tips}`,
    en: `👑 Formula: {name}
House: {brand} ({year})
Category: {cat} | Concentration: {conc}% ({conc_type})
Longevity: {longevity} | Sillage: {sillage}
Maceration: {mac} Days

🔺 Fragrance Pyramid Oil Breakdown (100%):
{notes}

💡 Master Shahin Advice:
{tips}`,
    fr: `👑 Formule : {name}
Maison : {brand} ({year})
Catégorie : {cat} | Concentration : {conc}% ({conc_type})
Tenue : {longevity} | Sillage : {sillage}
Macération : {mac} jours

🔺 Répartition de la pyramide olfactive (100 %) :
{notes}

💡 Conseil du maître Shahin :
{tips}`,
    es: `👑 Fórmula: {name}
Casa: {brand} ({year})
Categoría: {cat} | Concentración: {conc}% ({conc_type})
Duración: {longevity} | Estela: {sillage}
Maceración: {mac} días

🔺 Desglose de la pirámide olfativa (100 %):
{notes}

💡 Consejo del maestro Shahin:
{tips}`,
    it: `👑 Formula: {name}
Casa: {brand} ({year})
Categoria: {cat} | Concentrazione: {conc}% ({conc_type})
Persistenza: {longevity} | Scia: {sillage}
Macerazione: {mac} giorni

🔺 Ripartizione della piramide olfattiva (100%):
{notes}

💡 Consiglio del maestro Shahin:
{tips}`,
    de: `👑 Formel: {name}
Haus: {brand} ({year})
Kategorie: {cat} | Konzentration: {conc}% ({conc_type})
Haltbarkeit: {longevity} | Sillage: {sillage}
Reifung: {mac} Tage

🔺 Duftpyramiden-Aufschlüsselung (100 %):
{notes}

💡 Meister Shahins Rat:
{tips}`,
    ru: `👑 Формула: {name}
Дом: {brand} ({year})
Категория: {cat} | Концентрация: {conc}% ({conc_type})
Стойкость: {longevity} | Шлейф: {sillage}
Мацерация: {mac} дней

🔺 Структура пирамиды (100%):
{notes}

💡 Совет мастера Шахина:
{tips}`,
    zh: `👑 配方：{name}
品牌：{brand}（{year}）
类别：{cat} | 浓度：{conc}%（{conc_type}）
留香：{longevity} | 扩散：{sillage}
陈化：{mac} 天

🔺 香调金字塔成分表（100%）：
{notes}

💡 Shahin 大师建议：
{tips}`,
    tr: `👑 Formül: {name}
Marka: {brand} ({year})
Kategori: {cat} | Konsantrasyon: {conc}% ({conc_type})
Kalıcılık: {longevity} | İz: {sillage}
Dinlendirme: {mac} gün

🔺 Koku piramidi dağılımı (%100):
{notes}

💡 Usta Shahin tavsiyesi:
{tips}`,
    fa: `👑 فرمول: {name}
برند: {brand} ({year})
دسته: {cat} | غلظت: {conc}% ({conc_type})
ماندگاری: {longevity} | انتشار: {sillage}
کهنه‌سازی: {mac} روز

🔺 توزیع هرم عطری (۱۰۰٪):
{notes}

💡 نظر استاد شاهین:
{tips}`,
  },
} satisfies Record<string, LText>;

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
  const L = makeT(currentLang, S);
  const ActionArrow = rtl ? ArrowLeft : ArrowRight;

  const categories = [
    { id: 'all', label: fmt(L('cat_all_tpl'), { n: WORLD_PERFUMES.length }) },
    { id: 'oriental', label: L('cat_oriental') },
    { id: 'woody', label: L('cat_woody') },
    { id: 'citrus', label: L('cat_citrus') },
    { id: 'gourmand', label: L('cat_gourmand') },
    { id: 'floral', label: L('cat_floral') },
    { id: 'leather', label: L('cat_leather') },
    { id: 'aquatic', label: L('cat_aquatic') },
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
          `• [${n.category === 'top' ? L('top_word') : n.category === 'heart' ? L('heart_word') : L('base_word')}] ${pickArEn(currentLang, n.nameAr, n.nameEn || n.nameAr)}: ${n.percentageOfOil}%`
      )
      .join('\n');

    const text = fmt(L('clip_tpl'), {
      name: localized.nameAr,
      brand: localized.brand,
      year: localized.year,
      cat: localized.categoryAr,
      conc: localized.targetConcentration,
      conc_type: localized.concentrationTypeAr,
      longevity: localized.longevity,
      sillage: localized.sillage,
      mac: localized.macerationDays,
      notes: notesText,
      tips: localized.compoundingTips,
    });

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
            {L('page_title')}
          </h2>
        </div>
        <p className="text-stone-500 text-sm mt-1">
          {L('page_desc')}
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className={`w-4 h-4 text-stone-400 absolute ${rtl ? 'right-3' : 'left-3'} top-3 pointer-events-none`} />
          <input
            type="text"
            placeholder={L('search_placeholder')}
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
                    <span className="text-[10px] text-stone-400 block">{L('longevity_lbl')}</span>
                    <span className="font-semibold text-stone-900">{localized.longevity}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 block">{L('sillage_lbl')}</span>
                    <span className="font-semibold text-stone-900">{localized.sillage}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 block">{L('maceration_lbl')}</span>
                    <span className="font-bold text-amber-900 font-mono-numbers">{localized.macerationDays} {L('days_word')}</span>
                  </div>
                </div>

                {/* Pyramid Breakdown Table */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-stone-900 flex items-center justify-between">
                    <span>{L('breakdown_lbl')}</span>
                    <span className="text-[11px] text-stone-500 font-mono-numbers">
                      {localized.pyramidNotes.length} {L('notes_word')}
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
                            {pickArEn(currentLang, note.nameAr, note.nameEn || note.nameAr)}
                          </span>
                          <span className="text-[10px] text-stone-400 hidden sm:inline">
                            ({note.category === 'top' ? L('top_word') : note.category === 'heart' ? L('heart_word') : L('base_word')})
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
                    <span>{L('shahin_tip')}</span>
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
