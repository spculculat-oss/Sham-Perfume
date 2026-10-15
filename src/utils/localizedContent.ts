import { SupportedLanguage, SUPPORTED_LANGUAGES } from '../types/i18n';
import { WORLD_PERFUMES, WorldPerfumeRecipe } from '../data/worldPerfumes';
import { RAW_MATERIALS_DATABASE, RawMaterialItem } from '../data/rawMaterials';
import { PERFUME_NEWS_DATA, PerfumeNewsItem, NEWS_EN_FALLBACK } from '../data/perfumeNews';
import { fmt, localeDate } from './localize';
import { COMMON_LABELS_EXT } from './commonLabelsExt';

/**
 * Direction of a language, derived from the single source of truth
 * (SUPPORTED_LANGUAGES dir field) so every newly enabled RTL language
 * (he, ur, ps, ...) is picked up automatically.
 */
export const isRTL = (lang: SupportedLanguage): boolean =>
  SUPPORTED_LANGUAGES.find((l) => l.code === lang)?.dir === 'rtl';

// ==========================================
// 1. COMMON UI STRINGS DICTIONARY
// ==========================================
export const COMMON_LABELS_BASE: Record<
  'ar' | 'en' | 'fr' | 'es' | 'it' | 'de' | 'ru' | 'zh' | 'tr' | 'fa',
  Record<string, string>
> = {
  ar: {
    search: 'بحث...',
    all: 'الكل',
    copy: 'نسخ',
    copied: 'تم النسخ بنجاح!',
    print: 'طباعة بطاقة التصنيع',
    load_in_lab: 'تحميل في حاسبة المعمل',
    add_to_pyramid: 'إضافة للهرم العطري',
    delete: 'حذف',
    save: 'حفظ',
    close: 'إغلاق',
    read_more: 'قراءة التقرير بالكامل',
    back: 'رجوع',
    home: 'الرئيسية',
    notes: 'نوتات عطرية',
    density: 'الكثافة',
    longevity: 'الثبات',
    sillage: 'الفوحان',
    maceration: 'مدة التعتيق',
    days: 'يوماً',
    hours: 'ساعة',
    top_notes: 'النوتات الافتتاحية (العليا)',
    heart_notes: 'نوتات القلب (الوسطى)',
    base_notes: 'نوتات القاعدة (الأساسية)',
    expert_tip: 'نصيحة الخبير شاهين',
    formula_structure: 'توزيع الهرم العطري للزيت (100%)',
    empty_library: 'لا توجد تركيبات محفوظة بعد',
    empty_library_desc: 'قم بتركيب عطرك الأول في حاسبة المعمل واحفظه هنا للرجوع إليه دائماً.',
    apply_to_calculator: 'تطبيق في الحاسبة',
    auto_detect_location: 'تحديد موقعي ولغتي تلقائياً',
    location_detected: 'تم تحديد موقعك ولغتك بنجاح',
    direction_rtl: 'يمين لليسار (RTL)',
    direction_ltr: 'يسار لليمين (LTR)',
  },
  en: {
    search: 'Search...',
    all: 'All',
    copy: 'Copy',
    copied: 'Copied Successfully!',
    print: 'Print Lab Spec Sheet',
    load_in_lab: 'Load in Formulation Calculator',
    add_to_pyramid: 'Add to Fragrance Pyramid',
    delete: 'Delete',
    save: 'Save',
    close: 'Close',
    read_more: 'Read Full Report',
    back: 'Back',
    home: 'Home Hub',
    notes: 'Fragrance Notes',
    density: 'Density',
    longevity: 'Longevity',
    sillage: 'Sillage / Projection',
    maceration: 'Maceration Period',
    days: 'Days',
    hours: 'Hours',
    top_notes: 'Top Notes (Head)',
    heart_notes: 'Heart Notes (Core)',
    base_notes: 'Base Notes (Drydown)',
    expert_tip: 'Master Shahin Lab Tip',
    formula_structure: 'Fragrance Pyramid Oil Breakdown (100%)',
    empty_library: 'No saved formulas yet',
    empty_library_desc: 'Compound your first bespoke fragrance in the lab calculator and save it here.',
    apply_to_calculator: 'Apply in Lab Calculator',
    auto_detect_location: 'Auto-detect my location & language',
    location_detected: 'Location & language detected successfully',
    direction_rtl: 'Right-to-Left (RTL)',
    direction_ltr: 'Left-to-Right (LTR)',
  },
  fr: {
    search: 'Rechercher...',
    all: 'Tous',
    copy: 'Copier',
    copied: 'Copié avec succès !',
    print: 'Imprimer la fiche technique',
    load_in_lab: 'Charger dans le calculateur',
    add_to_pyramid: 'Ajouter à la pyramide',
    delete: 'Supprimer',
    save: 'Enregistrer',
    close: 'Fermer',
    read_more: 'Lire le rapport complet',
    back: 'Retour',
    home: 'Accueil',
    notes: 'Notes olfactives',
    density: 'Densité',
    longevity: 'Tenue',
    sillage: 'Sillage',
    maceration: 'Période de macération',
    days: 'Jours',
    hours: 'Heures',
    top_notes: 'Notes de tête',
    heart_notes: 'Notes de cœur',
    base_notes: 'Notes de fond',
    expert_tip: 'Conseil du Maître Parfumeur Shahin',
    formula_structure: 'Répartition de la pyramide huileuse (100%)',
    empty_library: 'Aucune formule enregistrée',
    empty_library_desc: 'Composez votre première formule dans le calculateur et sauvegardez-la ici.',
    apply_to_calculator: 'Appliquer dans le calculateur',
    auto_detect_location: 'Détecter automatiquement ma position et langue',
    location_detected: 'Position et langue détectées avec succès',
    direction_rtl: 'Droite à Gauche (RTL)',
    direction_ltr: 'Gauche à Droite (LTR)',
  },
  es: {
    search: 'Buscar...',
    all: 'Todos',
    copy: 'Copiar',
    copied: '¡Copiado con éxito!',
    print: 'Imprimir ficha técnica',
    load_in_lab: 'Cargar en la calculadora',
    add_to_pyramid: 'Añadir a la pirámide',
    delete: 'Eliminar',
    save: 'Guardar',
    close: 'Cerrar',
    read_more: 'Leer informe completo',
    back: 'Atrás',
    home: 'Inicio',
    notes: 'Notas olfativas',
    density: 'Densidad',
    longevity: 'Fijación / Longevidad',
    sillage: 'Estela / Proyección',
    maceration: 'Período de maceración',
    days: 'Días',
    hours: 'Horas',
    top_notes: 'Notas de salida (Cabeza)',
    heart_notes: 'Notas de corazón (Cuerpo)',
    base_notes: 'Notas de fondo (Base)',
    expert_tip: 'Consejo del Maestro Shahin',
    formula_structure: 'Distribución de la pirámide olfativa (100%)',
    empty_library: 'Aún no hay fórmulas guardadas',
    empty_library_desc: 'Crea tu primera fórmula en la calculadora del laboratorio y guárdala aquí.',
    apply_to_calculator: 'Aplicar en la calculadora',
    auto_detect_location: 'Detectar mi ubicación e idioma automáticamente',
    location_detected: 'Ubicación e idioma detectados con éxito',
    direction_rtl: 'Derecha a Izquierda (RTL)',
    direction_ltr: 'Izquierda a Derecha (LTR)',
  },
  it: {
    search: 'Cerca...',
    all: 'Tutti',
    copy: 'Copia',
    copied: 'Copiato con successo!',
    print: 'Stampa scheda tecnica',
    load_in_lab: 'Carica nel calcolatore',
    add_to_pyramid: 'Aggiungi alla piramide',
    delete: 'Elimina',
    save: 'Salva',
    close: 'Chiudi',
    read_more: 'Leggi il report completo',
    back: 'Indietro',
    home: 'Home',
    notes: 'Note olfattive',
    density: 'Densità',
    longevity: 'Persistenza',
    sillage: 'Sillage / Scia',
    maceration: 'Periodo di macerazione',
    days: 'Giorni',
    hours: 'Ore',
    top_notes: 'Note di testa',
    heart_notes: 'Note di cuore',
    base_notes: 'Note di fondo',
    expert_tip: 'Consiglio del Maestro Shahin',
    formula_structure: 'Ripartizione piramide olfattiva (100%)',
    empty_library: 'Nessuna formula salvata',
    empty_library_desc: 'Componi la tua prima fragranza nel calcolatore e salvala qui.',
    apply_to_calculator: 'Applica nel calcolatore',
    auto_detect_location: 'Rileva automaticamente posizione e lingua',
    location_detected: 'Posizione e lingua rilevate con successo',
    direction_rtl: 'Da destra a sinistra (RTL)',
    direction_ltr: 'Da sinistra a destra (LTR)',
  },
  de: {
    search: 'Suchen...',
    all: 'Alle',
    copy: 'Kopieren',
    copied: 'Erfolgreich kopiert!',
    print: 'Produktionsblatt drucken',
    load_in_lab: 'Im Laborrechner laden',
    add_to_pyramid: 'Zur Duftpyramide hinzufügen',
    delete: 'Löschen',
    save: 'Speichern',
    close: 'Schließen',
    read_more: 'Vollständigen Bericht lesen',
    back: 'Zurück',
    home: 'Startseite',
    notes: 'Duftnoten',
    density: 'Dichte',
    longevity: 'Haltbarkeit',
    sillage: 'Sillage / Abstrahlung',
    maceration: 'Reifezeit (Mazeration)',
    days: 'Tage',
    hours: 'Stunden',
    top_notes: 'Kopfnoten (Eröffnung)',
    heart_notes: 'Herznoten (Körper)',
    base_notes: 'Basisnoten (Fond)',
    expert_tip: 'Meister-Tipp von Shahin',
    formula_structure: 'Zusammensetzung Duftpyramide (100%)',
    empty_library: 'Noch keine Formeln gespeichert',
    empty_library_desc: 'Erstellen Sie Ihre erste Parfümformel und speichern Sie sie hier.',
    apply_to_calculator: 'Im Rechner anwenden',
    auto_detect_location: 'Standort und Sprache automatisch erkennen',
    location_detected: 'Standort und Sprache erfolgreich erkannt',
    direction_rtl: 'Rechts nach Links (RTL)',
    direction_ltr: 'Links nach Rechts (LTR)',
  },
  ru: {
    search: 'Поиск...',
    all: 'Все',
    copy: 'Копировать',
    copied: 'Успешно скопировано!',
    print: 'Печать спецификации',
    load_in_lab: 'Загрузить в калькулятор',
    add_to_pyramid: 'Добавить в пирамиду',
    delete: 'Удалить',
    save: 'Сохранить',
    close: 'Закрыть',
    read_more: 'Читать полный отчет',
    back: 'Назад',
    home: 'Главная',
    notes: 'Ольфакторные ноты',
    density: 'Плотность',
    longevity: 'Стойкость',
    sillage: 'Шлейф',
    maceration: 'Срок мацерации',
    days: 'Дней',
    hours: 'Часов',
    top_notes: 'Верхние ноты (Голова)',
    heart_notes: 'Ноты сердца (Тело)',
    base_notes: 'Базовые ноты (Шлейф)',
    expert_tip: 'Совет мастера Шахина',
    formula_structure: 'Пирамида концентрата (100%)',
    empty_library: 'Нет сохраненных формул',
    empty_library_desc: 'Создайте свою первую формулу в калькуляторе и сохраните здесь.',
    apply_to_calculator: 'Применить в калькуляторе',
    auto_detect_location: 'Автоопределение страны и языка',
    location_detected: 'Страна и язык успешно определены',
    direction_rtl: 'Справа налево (RTL)',
    direction_ltr: 'Слева направо (LTR)',
  },
  zh: {
    search: '搜索...',
    all: '全部',
    copy: '复制',
    copied: '复制成功！',
    print: '打印实验室配方单',
    load_in_lab: '载入实验室计算器',
    add_to_pyramid: '添加到香气金字塔',
    delete: '删除',
    save: '保存',
    close: '关闭',
    read_more: '阅读完整报告',
    back: '返回',
    home: '主页枢纽',
    notes: '香气音符',
    density: '密度',
    longevity: '留香持久度',
    sillage: '扩散力 / 气场',
    maceration: '陈化陈酿期',
    days: '天',
    hours: '小时',
    top_notes: '前调（头香）',
    heart_notes: '中调（核心体香）',
    base_notes: '后调（底香定香）',
    expert_tip: '沙欣大师专业建议',
    formula_structure: '香精金字塔分布比例（100%）',
    empty_library: '暂无保存的配方',
    empty_library_desc: '在实验室计算器中调配您的第一款香水并在此保存。',
    apply_to_calculator: '应用到实验室计算器',
    auto_detect_location: '根据地理位置自动识别语言',
    location_detected: '已成功根据位置识别语言',
    direction_rtl: '从右至左 (RTL)',
    direction_ltr: '从左至右 (LTR)',
  },
  tr: {
    search: 'Ara...',
    all: 'Tümü',
    copy: 'Kopyala',
    copied: 'Başarıyla kopyalandı!',
    print: 'Üretim Formunu Yazdır',
    load_in_lab: 'Laboratuvar Hesaplayıcıya Yükle',
    add_to_pyramid: 'Koku Piramidine Ekle',
    delete: 'Sil',
    save: 'Kaydet',
    close: 'Kapat',
    read_more: 'Raporun Tamamını Oku',
    back: 'Geri',
    home: 'Ana Sayfa',
    notes: 'Koku Notaları',
    density: 'Yoğunluk',
    longevity: 'Kalıcılık',
    sillage: 'Yayılım / Fark Edilirlik',
    maceration: 'Dinlendirme (Maserasyon)',
    days: 'Gün',
    hours: 'Saat',
    top_notes: 'Üst Notalar (Açılış)',
    heart_notes: 'Orta Notalar (Kalp)',
    base_notes: 'Alt Notalar (Dip / Temel)',
    expert_tip: 'Uzman Şahin Usta Tavsiyesi',
    formula_structure: 'Yağ Konsantresi Piramit Dağılımı (%100)',
    empty_library: 'Henüz kayıtlı formül yok',
    empty_library_desc: 'Laboratuvarda ilk parfüm formülünüzü oluşturun ve buraya kaydedin.',
    apply_to_calculator: 'Hesaplayıcıda Uygula',
    auto_detect_location: 'Konumumu ve dilimi otomatik algıla',
    location_detected: 'Konum ve dil başarıyla algılandı',
    direction_rtl: 'Sağdan Sola (RTL)',
    direction_ltr: 'Soldan Sağa (LTR)',
  },
  fa: {
    search: 'جستجو...',
    all: 'همه',
    copy: 'کپی',
    copied: 'با موفقیت کپی شد!',
    print: 'چاپ برگه ساخت آزمایشگاهی',
    load_in_lab: 'بارگذاری در ماشین‌حساب',
    add_to_pyramid: 'افزودن به هرم بویایی',
    delete: 'حذف',
    save: 'ذخیره',
    close: 'بستن',
    read_more: 'مطالعه کامل گزارش',
    back: 'بازگشت',
    home: 'خانه',
    notes: 'نت‌های بویایی',
    density: 'چگالی',
    longevity: 'ماندگاری',
    sillage: 'پخش بو (سیلاژ)',
    maceration: 'دوره کهنه‌سازی',
    days: 'روز',
    hours: 'ساعت',
    top_notes: 'نت‌های آغازین (بالا)',
    heart_notes: 'نت‌های میانی (قلب)',
    base_notes: 'نت‌های پایه (فرود)',
    expert_tip: 'توصیه استاد شاهین',
    formula_structure: 'توزیع هرم بویایی روغن (%100)',
    empty_library: 'هنوز فرمولی ذخیره نشده است',
    empty_library_desc: 'اولین عطر اختصاصی خود را بسازید و اینجا ذخیره کنید.',
    apply_to_calculator: 'اعمال در ماشین‌حساب',
    auto_detect_location: 'تشخیص خودکار موقعیت و زبان من',
    location_detected: 'موقعیت و زبان با موفقیت تشخیص داده شد',
    direction_rtl: 'راست به چپ (RTL)',
    direction_ltr: 'چپ به راست (LTR)',
  },
};

export const COMMON_LABELS: Record<SupportedLanguage, Record<string, string>> = {
  ...COMMON_LABELS_BASE,
  ...COMMON_LABELS_EXT,
};

export const getCommonLabel = (key: string, lang: SupportedLanguage): string => {
  return COMMON_LABELS[lang]?.[key] || COMMON_LABELS.en?.[key] || COMMON_LABELS.ar?.[key] || key;
};

// ==========================================
// 2. WORLD PERFUMES LOCALIZATION
// ==========================================
interface LocalizedPerfumeMeta {
  title: string;
  category: string;
  concentration: string;
  description: string;
  sillage: string;
  longevity: string;
  season: string;
  compoundingTips: string;
}

const PERFUME_TRANSLATIONS: Record<string, Record<string, Partial<LocalizedPerfumeMeta>>> = {
  'baccarat-rouge-540': {
    en: {
      title: 'Inspired by: Baccarat Rouge 540 (MFK Accord)',
      category: 'Oriental Floral Amber',
      concentration: 'Extrait de Parfum (24%)',
      description: 'The world\'s most coveted iconic fragrance; a luminous alchemy uniting radiant red saffron, jasmine hedione, crystallized cotton sugar, and warm amberwood.',
      sillage: 'Monstrous Radiant Sillage (10/10)',
      longevity: '24+ Hours Persistent Hold',
      season: 'All Seasons & Royal Occasions',
      compoundingTips: 'The secret lies in the delicate equilibrium between ethyl maltol (sugar note) and amberwood/ambroxan to project ethereal sillage without becoming cloying.',
    },
    fr: {
      title: 'Inspiré de : Baccarat Rouge 540 (Accord MFK)',
      category: 'Oriental Floral Ambré',
      concentration: 'Extrait de Parfum (24%)',
      description: 'Le parfum le plus convoité au monde ; une alchimie lumineuse mariant le safran rouge, l\'hédione jasminée, le sucre caramélisé et le bois ambré chaleureux.',
      sillage: 'Sillage monstrueux et radiant (10/10)',
      longevity: '24+ Heures de tenue magistrale',
      season: 'Toutes saisons et grands soirs',
      compoundingTips: 'L\'équilibre parfait entre l\'éthyl maltol et l\'ambroxyde crée cette aura aérienne si envoûtante sans aucune lourdeur.',
    },
    es: {
      title: 'Inspirado en: Baccarat Rouge 540 (Acorde MFK)',
      category: 'Oriental Floral Ambarado',
      concentration: 'Extrait de Parfum (24%)',
      description: 'La fragancia más codiciada del mundo; una alquimia mágica que une azafrán rojo radiante, jazmín hedione, azúcar caramelizada y madera de ámbar.',
      sillage: 'Estela monstruosa y radiante (10/10)',
      longevity: '24+ Horas de fijación extrema',
      season: 'Todas las estaciones y ocasiones de gala',
      compoundingTips: 'El secreto radica en el equilibrio exacto de etil maltol y ambroxan para lograr esa proyección celestial inigualable.',
    },
  },
  'creed-aventus': {
    en: {
      title: 'Inspired by: Creed Aventus Master Formula',
      category: 'Chypre Fruity Smoky Woody',
      concentration: 'Eau de Parfum (20%)',
      description: 'The king of modern masculine perfumery: succulent grilled pineapple, blackcurrant bud, French birch tar, and majestic oceanic ambergris.',
      sillage: 'Commanding Alpha Projection (9.5/10)',
      longevity: '14-18 Hours Solid Hold',
      season: 'Spring, Summer & Signature Business Wear',
      compoundingTips: 'Birch tar must be precisely dosed to prevent overpowering the vibrant fruit accord. High-grade ambroxan secures the regal drydown.',
    },
    fr: {
      title: 'Inspiré de : Creed Aventus (Formule Maître)',
      category: 'Chypré Fruité Boisé Fumé',
      concentration: 'Eau de Parfum (20%)',
      description: 'L\'icône absolue de la parfumerie masculine : ananas grillé juteux, cassis, bouleau fumé et ambre gris marin majestueux.',
      sillage: 'Projection puissante et conquérante (9.5/10)',
      longevity: '14-18 Heures de tenue remarquable',
      season: 'Printemps, Été & Signature au quotidien',
      compoundingTips: 'Le bouleau fumé doit être dosé au dixième de milligramme pour ne pas masquer l\'ananas frais et le cassis.',
    },
  },
  'tom-ford-tobacco-vanille': {
    en: {
      title: 'Inspired by: Tom Ford Tobacco Vanille Private Blend',
      category: 'Oriental Spicy Gourmand',
      concentration: 'Eau de Parfum (22%)',
      description: 'An opulent private club atmosphere with cured tobacco leaf, creamy Madagascar vanilla pod, aromatic tonka bean, and sweet dried fruits.',
      sillage: 'Warm Velvet Enveloping Sillage (9.5/10)',
      longevity: '20+ Hours Luxurious Hold',
      season: 'Autumn, Winter & Cold Evening Nights',
      compoundingTips: 'Allow at least 45 days of cold maceration to allow vanilla and coumarin crystals to harmonize with the clove and tobacco oils.',
    },
  },
  'dior-sauvage': {
    en: {
      title: 'Inspired by: Dior Sauvage Modern Legend',
      category: 'Aromatic Fougère Woody',
      concentration: 'Eau de Parfum (18%)',
      description: 'Electric freshness unleashed by zesty Reggio Calabria bergamot, Sichuan pepper sparks, and an overdose of clean mineral ambroxan.',
      sillage: 'Magnetic High-Impact Projection (9/10)',
      longevity: '12-16 Hours Enduring Freshness',
      season: 'Year-Round Versatile Signature',
      compoundingTips: 'The key is pairing high concentrations of ambroxan with clean patchouli and cedar to sustain the opening citrus energy for hours.',
    },
  },
  'black-afgano': {
    en: {
      title: 'Inspired by: Nasomatto Black Afgano Dark Alchemy',
      category: 'Dark Woody Smoky Resin',
      concentration: 'Extrait de Parfum (28%)',
      description: 'Hypnotic and enigmatic: dark smoky oud wood, green herbal resins, roasted coffee beans, tobacco leaves, and deep incense fumes.',
      sillage: 'Hypnotic Heavy Sillage (10/10)',
      longevity: '36+ Hours Monumental Hold',
      season: 'Cold Winter & Extravagant Nights',
      compoundingTips: 'Requires minimal top notes and heavy resins. Macerate for 60 days in dark amber bottles to integrate the dark woody depth.',
    },
  },
  'chanel-no-5': {
    en: {
      title: 'Inspired by: Chanel No. 5 The Eternal Legend',
      category: 'Floral Aldehydic Powdery',
      concentration: 'Eau de Parfum (16%)',
      description: 'The golden matriarch of 20th-century luxury: sparkling aliphatic aldehydes lifting May rose from Grasse, Grasse jasmine, and creamy sandalwood.',
      sillage: 'Sophisticated Elegant Sillage (8.5/10)',
      longevity: '12-14 Hours Timeless Aura',
      season: 'Formal Occasions & High Elegance',
      compoundingTips: 'Aldehydes C10, C11, and C12 must be diluted in perfumer\'s alcohol to 1% before compounding to prevent metallic harshness.',
    },
  },
  'tuscan-leather': {
    en: {
      title: 'Inspired by: Tom Ford Tuscan Leather',
      category: 'Luxury Leather Fruity Amber',
      concentration: 'Eau de Parfum (22%)',
      description: 'Raw, supple Tuscan leather softened by ripe wild raspberry, night-blooming jasmine, saffron threads, and warm amber resin.',
      sillage: 'Intense Prestigious Sillage (9.5/10)',
      longevity: '20+ Hours Tenacious Aura',
      season: 'Late Autumn, Winter & Cool Evenings',
      compoundingTips: 'The contrast of sweet raspberry (frambinone) against dry suederal leather creates the unmistakable luxury leather signature.',
    },
  },
  'acqua-di-gio': {
    en: {
      title: 'Inspired by: Giorgio Armani Acqua Di Giò Masterpiece',
      category: 'Marine Aquatic Citrus Aromatic',
      concentration: 'Eau de Toilette (15%)',
      description: 'The definitive Mediterranean sea breeze: crisp marine sea notes, sparkling Italian green mandarin, rosemary, and transparent cedar.',
      sillage: 'Breezy Refreshing Radiance (8/10)',
      longevity: '8-10 Hours Summer Freshness',
      season: 'Summer, Warm Spring & Sports',
      compoundingTips: 'Calone must be kept below 0.8% of the formulation to impart an authentic sea breeze without fishy or harsh undertones.',
    },
  },
};

export const getLocalizedPerfume = (recipe: WorldPerfumeRecipe, lang: SupportedLanguage) => {
  if (lang === 'ar') return recipe;
  const translation = PERFUME_TRANSLATIONS[recipe.id]?.[lang] || PERFUME_TRANSLATIONS[recipe.id]?.en;
  if (!translation) {
    return {
      ...recipe,
      nameAr: recipe.nameEn || recipe.nameAr,
    };
  }
  return {
    ...recipe,
    nameAr: translation.title || recipe.nameEn || recipe.nameAr,
    categoryAr: translation.category || recipe.categoryAr,
    concentrationTypeAr: translation.concentration || recipe.concentrationTypeAr,
    descriptionAr: translation.description || recipe.descriptionAr,
    sillage: translation.sillage || recipe.sillage,
    longevity: translation.longevity || recipe.longevity,
    seasonAr: translation.season || recipe.seasonAr,
    compoundingTips: translation.compoundingTips || recipe.compoundingTips,
  };
};

// ==========================================
// 3. RAW MATERIALS LOCALIZATION
// ==========================================
export const getLocalizedRawMaterial = (item: RawMaterialItem, lang: SupportedLanguage) => {
  if (lang === 'ar') return item;
  
  // Clean English translations for non-Arabic locales
  const categoryMap: Record<string, string> = {
    solvent: 'Solvent & Carrier Base',
    fixative: 'Chemical Fixative & Binder',
    aromachemical: 'Modern Aromachemical Molecule',
    natural_essential: 'Pure Essential Oil / Extract',
    natural_resin: 'Natural Resin & Precious Oud',
  };

  const placementMap: Record<string, string> = {
    top: 'Top Note (Opening)',
    heart: 'Heart Note (Middle Bouquet)',
    base: 'Base Note (Deep Fixative)',
    carrier: 'Carrier Solvent & Base',
    all: 'Universal / All Levels',
  };

  return {
    ...item,
    nameAr: item.nameEn || item.nameAr,
    categoryAr: categoryMap[item.category] || item.categoryAr,
    pyramidPlacementAr: placementMap[item.pyramidPlacement] || item.pyramidPlacementAr,
  };
};

// ==========================================
// 4. WORLD PERFUME NEWS LOCALIZATION
// ==========================================
/** Localized "{n} minutes" pattern per language for article read times. */
const READ_TIME_TPL: Record<SupportedLanguage, string> = {
  ar: '{n} دقائق',
  en: '{n} min',
  fr: '{n} min',
  es: '{n} min',
  it: '{n} min',
  de: '{n} Min.',
  ru: '{n} мин',
  zh: '{n} 分钟',
  tr: '{n} dk',
  fa: '{n} دقیقه',
  // Extended languages — batch 1 (LTR)
  hi: '{n} मिनट',
  pt: '{n} min',
  id: '{n} menit',
  ja: '{n}分',
  ko: '{n}분',
  vi: '{n} phút',
  th: '{n} นาที',
  pl: '{n} min',
  nl: '{n} min',
  uk: '{n} хв',
  el: '{n} λεπτά',
  ms: '{n} minit',
  bn: '{n} মিনিট',
  cs: '{n} min',
  ro: '{n} min',
  // Extended languages — batch 2 (RTL)
  he: '{n} דק׳',
  ur: '{n} منٹ',
  ps: '{n} دقیقې',
  // Extended languages — batch 3 (LTR)
  sv: '{n} min',
  da: '{n} min',
  fi: '{n} min',
  no: '{n} min',
  hu: '{n} perc',
  sk: '{n} min',
  sl: '{n} min',
  hr: '{n} min',
  sr: '{n} min',
  bg: '{n} мин',
  lt: '{n} min',
  lv: '{n} min',
  et: '{n} min',
  ka: '{n} წუთი',
  hy: '{n} րոպե',
  // Extended languages — batch 4 (Africa, SE Asia, Oceania)
  tl: '{n} minuto',
  sw: 'dakika {n}',
  am: '{n} ደቂቃ',
  ha: 'minti {n}',
  yo: 'iṣẹju {n}',
  zu: 'amaminithi {n}',
  af: '{n} min',
  so: 'daqiiqo {n}',
  jv: '{n} menit',
  mi: '{n} meneti',
  ne: '{n} मिनेट',
  si: 'මිනිත්තු {n}',
  my: '{n} မိနစ်',
  km: '{n} នាទី',
  lo: '{n} ນາທີ',
};

export const getLocalizedNewsArticle = (article: PerfumeNewsItem, lang: SupportedLanguage) => {
  if (lang === 'ar') return article;

  const categoryMap: Record<string, string> = {
    trends: 'Global Trends & Analytics',
    exhibitions: 'International Exhibitions & Salons',
    harvests: 'Botanical Harvests & Yields',
    ifra: 'IFRA Regulations & Safety',
    niche: 'Haute Parfumerie & Niche Houses',
  };

  const en = NEWS_EN_FALLBACK[article.id];
  const ext = article as PerfumeNewsItem & {
    summaryEn?: string;
    contentEn?: string;
    verdictEn?: string;
    impactEn?: string;
    dateIso?: string;
    readTimeMinutes?: number;
    sourceEn?: string;
  };

  return {
    ...article,
    titleAr: article.titleEn || article.titleAr,
    categoryLabelAr: categoryMap[article.category] || article.categoryLabelAr,
    summaryAr: ext.summaryEn || en?.summary || article.summaryAr,
    contentAr: ext.contentEn || en?.content || article.contentAr,
    expertVerdict: ext.verdictEn || en?.verdict || article.expertVerdict,
    marketImpact: ext.impactEn || en?.impact || article.marketImpact,
    date: ext.dateIso
      ? localeDate(lang, new Date(`${ext.dateIso}T00:00:00`), { day: 'numeric', month: 'long', year: 'numeric' })
      : article.date,
    readTime: typeof ext.readTimeMinutes === 'number'
      ? fmt(READ_TIME_TPL[lang], { n: ext.readTimeMinutes })
      : article.readTime,
    source: ext.sourceEn || article.source,
  };
};
