import { LegalDisclaimer } from './LegalDisclaimer';
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
import { getLocalizedRawMaterial, getCommonLabel, isRTL } from '../لغات/localizedContent';
import { LText, makeT, fmt } from '../لغات/localize';


const S = {
  cat_all: {
    ar: 'جميع المواد (الكل)',
    en: 'All Raw Materials',
    fr: 'Toutes les matières premières',
    es: 'Todas las materias primas',
    it: 'Tutte le materie prime',
    de: 'Alle Rohstoffe',
    ru: 'Всё сырьё',
    zh: '全部原料',
    tr: 'Tüm hammaddeler',
    fa: 'همه مواد',
  },
  cat_solvent: {
    ar: 'المذيبات وحوامل العطر',
    en: 'Solvents & Carriers',
    fr: 'Solvants et supports',
    es: 'Disolventes y soportes',
    it: 'Solventi e veicoli',
    de: 'Lösungsmittel & Träger',
    ru: 'Растворители и носители',
    zh: '溶剂与载体',
    tr: 'Çözücüler ve taşıyıcılar',
    fa: 'حلال‌ها و حامل‌ها',
  },
  cat_fixative: {
    ar: 'المثبتات الكيميائية',
    en: 'Chemical Fixatives',
    fr: 'Fixateurs chimiques',
    es: 'Fijadores químicos',
    it: 'Fissativi chimici',
    de: 'Chemische Fixative',
    ru: 'Химические фиксаторы',
    zh: '化学定香剂',
    tr: 'Kimyasal fiksatörler',
    fa: 'تثبیت‌کننده‌های شیمیایی',
  },
  cat_aromachemical: {
    ar: 'الجزيئات العطرية الحديثة',
    en: 'Modern Molecules',
    fr: 'Molécules modernes',
    es: 'Moléculas modernas',
    it: 'Molecole moderne',
    de: 'Moderne Moleküle',
    ru: 'Современные молекулы',
    zh: '现代香料分子',
    tr: 'Modern moleküller',
    fa: 'مولکول‌های عطری مدرن',
  },
  cat_natural_essential: {
    ar: 'الزيوت الطبيعية والمستخلصات',
    en: 'Essential Oils',
    fr: 'Huiles essentielles',
    es: 'Aceites esenciales',
    it: 'Oli essenziali',
    de: 'Ätherische Öle',
    ru: 'Эфирные масла',
    zh: '天然精油',
    tr: 'Doğal yağlar',
    fa: 'روغن‌های طبیعی و عصاره‌ها',
  },
  cat_natural_resin: {
    ar: 'الصموغ وأدهان العود',
    en: 'Resins & Ouds',
    fr: 'Résines et ouds',
    es: 'Resinas y ouds',
    it: 'Resine e oud',
    de: 'Harze & Oud',
    ru: 'Смолы и уда',
    zh: '树脂与乌木',
    tr: 'Reçineler ve oudlar',
    fa: 'صمغ‌ها و عودها',
  },
  page_title: {
    ar: 'الموسوعة الشاملة لمواد وصناعة العطور (Raw Materials Encyclopedia)',
    en: 'Comprehensive Fragrance Raw Materials Encyclopedia',
    fr: 'Encyclopédie des matières premières du parfum',
    es: 'Enciclopedia de materias primas del perfume',
    it: 'Enciclopedia delle materie prime profumiere',
    de: 'Enzyklopädie der Duftrohstoffe',
    ru: 'Энциклопедия парфюмерного сырья',
    zh: '香水原料综合百科',
    tr: 'Kapsamlı parfüm hammadde ansiklopedisi',
    fa: 'دانشنامه جامع مواد اولیه عطرسازی',
  },
  page_desc: {
    ar: 'دليل كيميائي شامل لجميع المذيبات، المثبتات، الجزيئات العطرية الحديثة، الأدهان الطبيعية، ومعايير الكثافة والسلامة الدولية IFRA.',
    en: 'Comprehensive technical reference for all perfumer solvents, fixatives, modern aroma molecules, natural absolutes, and IFRA safety thresholds.',
    fr: 'Référence technique complète : solvants, fixateurs, molécules modernes, absolus naturels et seuils de sécurité IFRA.',
    es: 'Referencia técnica completa: disolventes, fijadores, moléculas modernas, absolutos naturales y límites IFRA.',
    it: 'Riferimento tecnico completo: solventi, fissativi, molecole moderne, assoluti naturali e limiti IFRA.',
    de: 'Umfassendes Nachschlagewerk: Lösungsmittel, Fixative, moderne Moleküle, Naturabsolues und IFRA-Grenzwerte.',
    ru: 'Полный технический справочник: растворители, фиксаторы, современные молекулы, абсолю и лимиты IFRA.',
    zh: '全面技术参考：溶剂、定香剂、现代香料分子、天然原精与 IFRA 安全阈值。',
    tr: 'Kapsamlı teknik başvuru: çözücüler, fiksatörler, modern moleküller, doğal absolüler ve IFRA güvenlik limitleri.',
    fa: 'مرجع فنی جامع: حلال‌ها، تثبیت‌کننده‌ها، مولکول‌های مدرن، ابسولوهای طبیعی و حدود ایمنی IFRA.',
  },
  search_placeholder: {
    ar: 'ابحث باسم المادة أو رقم كاس (CAS) أو العائلة الشمية...',
    en: 'Search material name, CAS number, or olfactory family...',
    fr: 'Rechercher par nom, n° CAS ou famille olfactive…',
    es: 'Buscar por nombre, número CAS o familia olfativa…',
    it: 'Cerca per nome, numero CAS o famiglia olfattiva…',
    de: 'Nach Name, CAS-Nummer oder Duftfamilie suchen…',
    ru: 'Поиск по названию, номеру CAS или семейству…',
    zh: '搜索原料名称、CAS 号或香族…',
    tr: 'İsim, CAS numarası veya koku ailesine göre ara…',
    fa: 'جستجو با نام ماده، شماره CAS یا خانواده بویی…',
  },
  sg_lbl: {
    ar: 'الكثافة النوعية:',
    en: 'Specific Gravity:',
    fr: 'Densité :',
    es: 'Densidad:',
    it: 'Densità:',
    de: 'Dichte:',
    ru: 'Плотность:',
    zh: '比重：',
    tr: 'Yoğunluk:',
    fa: 'چگالی ویژه:',
  },
  pyramid_lbl: {
    ar: 'الموقع بالهرم:',
    en: 'Pyramid Level:',
    fr: 'Niveau :',
    es: 'Nivel:',
    it: 'Livello:',
    de: 'Ebene:',
    ru: 'Уровень:',
    zh: '香调层：',
    tr: 'Seviye:',
    fa: 'سطح هرم:',
  },
  usage_lbl: {
    ar: 'النسبة الموصى بها:',
    en: 'Recommended Usage:',
    fr: 'Dosage conseillé :',
    es: 'Uso recomendado:',
    it: 'Uso consigliato:',
    de: 'Empfohlene Dosierung:',
    ru: 'Рекомендуемая доза:',
    zh: '建议用量：',
    tr: 'Önerilen kullanım:',
    fa: 'میزان مصرف پیشنهادی:',
  },
  ifra_lbl: {
    ar: 'حد أمان IFRA:',
    en: 'IFRA Safety Limit:',
    fr: 'Limite IFRA :',
    es: 'Límite IFRA:',
    it: 'Limite IFRA:',
    de: 'IFRA-Grenzwert:',
    ru: 'Предел IFRA:',
    zh: 'IFRA 安全限值：',
    tr: 'IFRA güvenlik sınırı:',
    fa: 'حد مجاز IFRA:',
  },
  scent_lbl: {
    ar: 'الرائحة والشعور:',
    en: 'Scent Profile & Nuance:',
    fr: 'Profil olfactif :',
    es: 'Perfil olfativo:',
    it: 'Profilo olfattivo:',
    de: 'Duftprofil:',
    ru: 'Ольфакторный профиль:',
    zh: '香气特征：',
    tr: 'Koku profili:',
    fa: 'پروفایل بویی:',
  },
  role_lbl: {
    ar: 'الدور الوظيفي في العطر:',
    en: 'Technical Role:',
    fr: 'Rôle technique :',
    es: 'Rol técnico:',
    it: 'Ruolo tecnico:',
    de: 'Technische Rolle:',
    ru: 'Техническая роль:',
    zh: '技术作用：',
    tr: 'Teknik rol:',
    fa: 'نقش فنی در عطر:',
  },
  partners_lbl: {
    ar: 'يتوافق بامتياز مع:',
    en: 'Harmonious Partners:',
    fr: 'Accords harmonieux :',
    es: 'Asociaciones armónicas:',
    it: 'Associazioni armoniche:',
    de: 'Harmonische Partner:',
    ru: 'Гармоничные партнёры:',
    zh: '绝佳搭配：',
    tr: 'Uyumlu ortaklar:',
    fa: 'همراهی‌های هماهنگ:',
  },
  added_to_pyramid: {
    ar: 'أُضيفت للهرم!',
    en: 'Added to Pyramid!',
    fr: 'Ajouté à la pyramide !',
    es: '¡Añadido a la pirámide!',
    it: 'Aggiunto alla piramide!',
    de: 'Zur Pyramide hinzugefügt!',
    ru: 'Добавлено в пирамиду!',
    zh: '已加入香调金字塔！',
    tr: 'Piramite eklendi!',
    fa: 'به هرم اضافه شد!',
  },
  add_to_pyramid: {
    ar: 'إضافة للهرم العطري',
    en: 'Add to Pyramid',
    fr: 'Ajouter à la pyramide',
    es: 'Añadir a la pirámide',
    it: 'Aggiungi alla piramide',
    de: 'Zur Pyramide hinzufügen',
    ru: 'Добавить в пирамиду',
    zh: '加入香调金字塔',
    tr: 'Piramite ekle',
    fa: 'افزودن به هرم',
  },
  carrier_note: {
    ar: '💧 سائل حامل يُضبط بحاسبة التراكيز',
    en: '💧 Carrier Solvent managed in Calculator',
    fr: '💧 Solvant porteur géré via le calculateur',
    es: '💧 Disolvente portador gestionado en la calculadora',
    it: '💧 Solvente gestito nel calcolatore',
    de: '💧 Trägersolvens im Rechner verwaltet',
    ru: '💧 Растворитель-носитель настраивается в калькуляторе',
    zh: '💧 载体溶剂由计算器管理',
    tr: '💧 Taşıyıcı çözücü hesaplayıcıda ayarlanır',
    fa: '💧 حلال حامل در ماشین‌حساب تنظیم می‌شود',
  },
  density_word: {
    ar: 'الكثافة',
    en: 'Density',
    fr: 'Densité',
    es: 'Densidad',
    it: 'Densità',
    de: 'Dichte',
    ru: 'Плотность',
    zh: '密度',
    tr: 'Yoğunluk',
    fa: 'چگالی',
  },
  cas_lbl: {
    ar: 'رقم كاس (CAS)',
    en: 'CAS Registry #',
    fr: 'N° CAS',
    es: 'Nº CAS',
    it: 'N° CAS',
    de: 'CAS-Nummer',
    ru: 'Номер CAS',
    zh: 'CAS 号',
    tr: 'CAS numarası',
    fa: 'شماره CAS',
  },
  clip_tpl: {
    ar: `🧪 مواصفات المادة: {name_ar} ({name_en})
الفئة: {cat} | العائلة الشمية: {family}
{cas_line}الكثافة النوعية: {density} g/ml
النسبة الموصى بها: {usage}
حد الأمان وفق IFRA: {ifra}
الموقع في الهرم: {level}

📌 الوصف والشعور:
{profile}

⚙️ الدور الوظيفي في العطر:
{role}

🤝 يمتزج ويتوافق مع:
{partners}

⚠️ احتياطات التعامل:
{precautions}`,
    en: `🧪 Material Specification: {name_ar} ({name_en})
Category: {cat} | Olfactory Family: {family}
{cas_line}Density: {density} g/ml
Recommended Usage: {usage}
IFRA Safety Limit: {ifra}
Pyramid Level: {level}

📌 Scent Profile & Nuance:
{profile}

⚙️ Technical Role:
{role}

🤝 Harmonious Partners:
{partners}

⚠️ Handling Precautions:
{precautions}`,
    fr: `🧪 Spécification matière : {name_ar} ({name_en})
Catégorie : {cat} | Famille olfactive : {family}
{cas_line}Densité : {density} g/ml
Dosage conseillé : {usage}
Limite IFRA : {ifra}
Niveau : {level}

📌 Profil olfactif :
{profile}

⚙️ Rôle technique :
{role}

🤝 Accords harmonieux :
{partners}

⚠️ Précautions d’emploi :
{precautions}`,
    es: `🧪 Especificación: {name_ar} ({name_en})
Categoría: {cat} | Familia olfativa: {family}
{cas_line}Densidad: {density} g/ml
Uso recomendado: {usage}
Límite IFRA: {ifra}
Nivel: {level}

📌 Perfil olfativo:
{profile}

⚙️ Rol técnico:
{role}

🤝 Asociaciones armónicas:
{partners}

⚠️ Precauciones:
{precautions}`,
    it: `🧪 Scheda materia: {name_ar} ({name_en})
Categoria: {cat} | Famiglia olfattiva: {family}
{cas_line}Densità: {density} g/ml
Uso consigliato: {usage}
Limite IFRA: {ifra}
Livello: {level}

📌 Profilo olfattivo:
{profile}

⚙️ Ruolo tecnico:
{role}

🤝 Associazioni armoniche:
{partners}

⚠️ Precauzioni:
{precautions}`,
    de: `🧪 Stoffdatenblatt: {name_ar} ({name_en})
Kategorie: {cat} | Duftfamilie: {family}
{cas_line}Dichte: {density} g/ml
Empfohlene Dosierung: {usage}
IFRA-Grenzwert: {ifra}
Ebene: {level}

📌 Duftprofil:
{profile}

⚙️ Technische Rolle:
{role}

🤝 Harmonische Partner:
{partners}

⚠️ Sicherheitshinweise:
{precautions}`,
    ru: `🧪 Спецификация: {name_ar} ({name_en})
Категория: {cat} | Семейство: {family}
{cas_line}Плотность: {density} г/мл
Рекомендуемая доза: {usage}
Предел IFRA: {ifra}
Уровень: {level}

📌 Ольфакторный профиль:
{profile}

⚙️ Техническая роль:
{role}

🤝 Гармоничные партнёры:
{partners}

⚠️ Меры предосторожности:
{precautions}`,
    zh: `🧪 原料规格：{name_ar}（{name_en}）
类别：{cat} | 香族：{family}
{cas_line}比重：{density} g/ml
建议用量：{usage}
IFRA 限值：{ifra}
香调层：{level}

📌 香气特征：
{profile}

⚙️ 技术作用：
{role}

🤝 绝佳搭配：
{partners}

⚠️ 使用注意：
{precautions}`,
    tr: `🧪 Malzeme spesifikasyonu: {name_ar} ({name_en})
Kategori: {cat} | Koku ailesi: {family}
{cas_line}Yoğunluk: {density} g/ml
Önerilen kullanım: {usage}
IFRA sınırı: {ifra}
Seviye: {level}

📌 Koku profili:
{profile}

⚙️ Teknik rol:
{role}

🤝 Uyumlu ortaklar:
{partners}

⚠️ Önlemler:
{precautions}`,
    fa: `🧪 مشخصات ماده: {name_ar} ({name_en})
دسته: {cat} | خانواده بویی: {family}
{cas_line}چگالی: {density} g/ml
میزان مصرف پیشنهادی: {usage}
حد IFRA: {ifra}
سطح: {level}

📌 پروفایل بویی:
{profile}

⚙️ نقش فنی:
{role}

🤝 همراهی‌های هماهنگ:
{partners}

⚠️ نکات ایمنی:
{precautions}`,
  },
} satisfies Record<string, LText>;

interface RawMaterialsEncyclopediaProps {
  currentLang?: SupportedLanguage;
  onAddMaterialToPyramid: (note: PyramidNote) => void;
  /** A material Shaheen was asked about: the encyclopedia opens filtered on it. */
  initialSearch?: string;
}

export const RawMaterialsEncyclopedia: React.FC<RawMaterialsEncyclopediaProps> = ({
  currentLang = 'ar',
  onAddMaterialToPyramid,
  initialSearch = '',
}) => {
  const [search, setSearch] = useState(initialSearch);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [addedId, setAddedId] = useState<string | null>(null);

  const rtl = isRTL(currentLang);
  const L = makeT(currentLang, S);

  const categories = [
    { id: 'all', label: L('cat_all') },
    { id: 'solvent', label: L('cat_solvent') },
    { id: 'fixative', label: L('cat_fixative') },
    { id: 'aromachemical', label: L('cat_aromachemical') },
    { id: 'natural_essential', label: L('cat_natural_essential') },
    { id: 'natural_resin', label: L('cat_natural_resin') },
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
    const casLine = localized.casNumber ? `${L('cas_lbl')}: ${localized.casNumber}\n` : '';
    const text = fmt(L('clip_tpl'), {
      name_ar: localized.nameAr,
      name_en: localized.nameEn,
      cat: localized.categoryAr,
      family: localized.olfactoryFamily,
      cas_line: casLine,
      density: localized.densityGPerMl,
      usage: localized.recommendedUsagePercent,
      ifra: localized.ifraLimitPercent,
      level: localized.pyramidPlacementAr,
      profile: localized.scentProfile,
      role: localized.roleInPerfume || '',
      partners: localized.blendingPartners || '',
      precautions: localized.precautions || '',
    });

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
      description: `${localized.olfactoryFamily} · ${L('density_word')}: ${localized.densityGPerMl}`,
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
                    <span className="text-[10px] text-stone-400 block font-sans">{L('sg_lbl')}</span>
                    <span className="font-bold text-stone-900">{item.densityGPerMl} g/ml</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 block font-sans">{L('pyramid_lbl')}</span>
                    <span className="font-semibold text-stone-800 font-sans">{localized.pyramidPlacementAr}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 block font-sans">{L('usage_lbl')}</span>
                    <span className="font-semibold text-amber-900">{item.recommendedUsagePercent}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 block font-sans">{L('ifra_lbl')}</span>
                    <span className="font-semibold text-emerald-800 font-sans">{item.ifraLimitPercent}</span>
                  </div>
                </div>

                {/* Scent & Role */}
                <div className="space-y-2 text-xs text-stone-600 leading-relaxed">
                  <div>
                    <span className="font-bold text-stone-900 block text-[11px]">{L('scent_lbl')}</span>
                    <p className="text-[11px] text-stone-600">{localized.scentProfile}</p>
                  </div>

                  <div>
                    <span className="font-bold text-stone-900 block text-[11px]">{L('role_lbl')}</span>
                    <p className="text-[11px] text-stone-600">{localized.roleInPerfume}</p>
                  </div>

                  <div>
                    <span className="font-bold text-stone-900 block text-[11px]">{L('partners_lbl')}</span>
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
                        <span className="text-emerald-400">{L('added_to_pyramid')}</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5 text-amber-400" />
                        <span>{L('add_to_pyramid')}</span>
                      </>
                    )}
                  </button>
                ) : (
                  <span className="flex-1 py-2 px-3 bg-stone-100 text-stone-500 rounded-xl text-[11px] text-center font-medium border border-stone-200/80">
                    {L('carrier_note')}
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
      <LegalDisclaimer type="chemical" lang={currentLang} />
    </div>
  );
};
