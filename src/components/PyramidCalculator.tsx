import { LegalDisclaimer } from './LegalDisclaimer';
import { LocalizedNumberInput } from './LocalizedNumberInput';
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
  Atom,
} from 'lucide-react';
import { CalculationResult, FormulationState, PyramidNote } from '../types/perfume';
import { CURATED_FORMULA_PRESETS, POPULAR_NOTES_DIRECTORY } from '../data/presets';
import { calculatePyramidBreakdown, formatNum } from '../utils/calculations';
import { FragrancePyramidGraphic } from './FragrancePyramidGraphic';
import { PerfumeSpraySimulator } from './PerfumeSpraySimulator';
import { CalculatorCriteriaGuide } from './CalculatorCriteriaGuide';
import compoundingImg from '../assets/images/perfume_lab_compounding_1791692420116.jpg';
import { SupportedLanguage } from '../types/i18n';
import { isRTL } from '../لغات/localizedContent';
import { LText, makeT, fmt, pickArEn } from '../لغات/localize';

interface PyramidCalculatorProps {
  currentLang?: SupportedLanguage;
  formulation: FormulationState;
  pyramidNotes: PyramidNote[];
  setPyramidNotes: React.Dispatch<React.SetStateAction<PyramidNote[]>>;
  result: CalculationResult;
}

const S = {
  page_title: {
    ar: 'حاسبة الهرم العطري ومزج الزيوت الخام',
    en: 'Fragrance Pyramid & Accord Balancer',
    fr: 'Pyramide olfactive et équilibrage des accords',
    es: 'Pirámide olfativa y equilibrio de acordes',
    it: 'Piramide olfattiva e bilanciamento degli accordi',
    de: 'Duftpyramide & Akkord-Balance',
    ru: 'Пирамида аромата и баланс аккордов',
    zh: '香调金字塔与精油调配',
    tr: 'Koku piramidi ve akor dengeleyici',
    fa: 'حاسبه هرم عطری و ترکیب روغن‌های خام',
  },
  page_desc_tpl: {
    ar: 'وزّع إجمالي الزيت العطري ({g} جم) بين نوتات القمة والقلب والقاعدة لتحقيق فوحان وثبات متناسقين.',
    en: 'Distribute the total fragrance concentrate ({g} g) across top, heart, and base notes for optimal longevity & sillage.',
    fr: 'Répartissez le concentré parfumant total ({g} g) entre notes de tête, de cœur et de fond pour un sillage et une tenue optimaux.',
    es: 'Distribuya el concentrado total ({g} g) entre notas de salida, corazón y fondo para lograr fijación y estela óptimas.',
    it: 'Distribuisci il concentrato totale ({g} g) tra note di testa, cuore e fondo per persistenza e scia ottimali.',
    de: 'Verteilen Sie das gesamte Duftkonzentrat ({g} g) auf Kopf-, Herz- und Basisnoten für optimale Haltbarkeit und Sillage.',
    ru: 'Распределите общий концентрат ({g} г) между верхними, средними и базовыми нотами для оптимальных стойкости и шлейфа.',
    zh: '将香精油总量（{g} g）分配到前调、中调与后调，实现留香与气场的最佳平衡。',
    tr: 'Toplam esans konsantresini ({g} g) üst, kalp ve dip notalar arasında dağıtın; kalıcılık ve sillage için ideal.',
    fa: 'روغن عطری کل ({g} گرم) را بین نت‌های ابتدایی، میانی و پایانی توزیع کنید تا پخش بو و ماندگاری هماهنگی به دست آید.',
  },
  tab_graphic: {
    ar: 'جرافيك الهرم وسيناريو الرش 💨',
    en: 'Visual Pyramid & Evaporation 💨',
    fr: 'Pyramide visuelle & évaporation 💨',
    es: 'Pirámide visual y evaporación 💨',
    it: 'Piramide visiva ed evaporazione 💨',
    de: 'Visuelle Pyramide & Verdunstung 💨',
    ru: 'Визуальная пирамида и испарение 💨',
    zh: '金字塔图与喷洒模拟 💨',
    tr: 'Görsel piramit ve buharlaşma 💨',
    fa: 'نمودار هرم و شبیه‌سازی اسپری 💨',
  },
  tab_compounding: {
    ar: 'جدول موازين المعمل 🧪',
    en: 'Lab Scale Breakdown 🧪',
    fr: 'Détail des pesées 🧪',
    es: 'Desglose de pesadas 🧪',
    it: 'Dettaglio delle pesate 🧪',
    de: 'Labor-Wägetabelle 🧪',
    ru: 'Лабораторная таблица 🧪',
    zh: '实验室称量表 🧪',
    tr: 'Laboratuvar tartım tablosu 🧪',
    fa: 'جدول توزین آزمایشگاه 🧪',
  },
  tab_both: {
    ar: 'العرض الشامل 📐',
    en: 'Combined View 📐',
    fr: 'Vue combinée 📐',
    es: 'Vista combinada 📐',
    it: 'Vista combinata 📐',
    de: 'Kombinierte Ansicht 📐',
    ru: 'Комбинированный вид 📐',
    zh: '综合视图 📐',
    tr: 'Birleşik görünüm 📐',
    fa: 'نمای جامع 📐',
  },
  tab_spray_sim: {
    ar: 'محاكاة رش العطر وثباته 💨',
    en: 'Spray & Skin Simulator 💨',
    fr: 'Simulateur spray & peau 💨',
    es: 'Simulador spray y piel 💨',
    it: 'Simulatore spruzzo e pelle 💨',
    de: 'Sprüh- & Hautsimulator 💨',
    ru: 'Симулятор распыления и кожи 💨',
    zh: '喷雾与肌肤固着模拟 💨',
    tr: 'Püskürtme ve cilt simülatörü 💨',
    fa: 'شبیه‌ساز اسپری و پوست 💨',
  },
  tab_guide: {
    ar: 'شرح المعايير 📚',
    en: 'Criteria Guide 📚',
    fr: 'Guide des critères 📚',
    es: 'Guía de criterios 📚',
    it: 'Guida ai criteri 📚',
    de: 'Kriterien-Leitfaden 📚',
    ru: 'Справочник критериев 📚',
    zh: '参数指南 📚',
    tr: 'Kriterler rehberi 📚',
    fa: 'راهنمای معیارها 📚',
  },
  presets_strip: {
    ar: 'تراكيب وأهرامات عطرية جاهزة للتجربة:',
    en: 'Curated Iconic Accords & Benchmark Presets:',
    fr: 'Accords emblématiques et formules de référence :',
    es: 'Acordes icónicos y fórmulas de referencia:',
    it: 'Accordi iconici e formule di riferimento:',
    de: 'Kuratierte Akkorde & Benchmark-Formeln:',
    ru: 'Избранные аккорды и эталонные формулы:',
    zh: '精选经典香调与标杆配方：',
    tr: 'Özenle seçilmiş ikonik akorlar ve referans formüller:',
    fa: 'ترکیب‌ها و هرم‌های عطری آماده برای آزمایش:',
  },
  add_notes_title: {
    ar: 'إضافة زيوت عطرية جديدة إلى الهرم:',
    en: 'Add New Fragrance Notes to Pyramid:',
    fr: 'Ajouter de nouvelles notes à la pyramide :',
    es: 'Añadir nuevas notas a la pirámide:',
    it: 'Aggiungi nuove note alla piramide:',
    de: 'Neue Duftnoten zur Pyramide hinzufügen:',
    ru: 'Добавить новые ноты в пирамиду:',
    zh: '向金字塔添加新香材：',
    tr: 'Piramide yeni koku notaları ekle:',
    fa: 'افزودن روغن‌های عطری جدید به هرم:',
  },
  view_full_scales: {
    ar: 'عرض جدول موازين المعمل الكامل',
    en: 'View Full Lab Compounding Scales',
    fr: 'Voir le tableau complet des pesées',
    es: 'Ver tabla completa de pesadas',
    it: 'Vedi tabella completa delle pesate',
    de: 'Vollständige Wägetabelle anzeigen',
    ru: 'Открыть полную таблицу взвешиваний',
    zh: '查看完整实验室称量表',
    tr: 'Tam laboratuvar tartım tablosunu gör',
    fa: 'مشاهده جدول کامل توزین آزمایشگاه',
  },
  note_name_ph: {
    ar: 'اسم الزيت العطري (مثل: برغموت صقلي، ياسمين، دهن عود...)',
    en: 'Note name (e.g., Bergamot, Jasmine, Aged Oud...)',
    fr: 'Nom de la note (ex. bergamote, jasmin, oud vieilli...)',
    es: 'Nombre de la nota (ej. bergamota, jazmín, oud añejo...)',
    it: 'Nome della nota (es. bergamotto, gelsomino, oud invecchiato...)',
    de: 'Notenname (z. B. Bergamotte, Jasmin, gereiftes Oud...)',
    ru: 'Название ноты (напр., бергамот, жасмин, выдержанный уд...)',
    zh: '香材名称（如：佛手柑、茉莉、陈化乌木…）',
    tr: 'Nota adı (örn. bergamot, yasemin, yaşlı ud...)',
    fa: 'نام روغن عطری (مثلاً: برغموت، یاس، دهن عود...)',
  },
  opt_top_long: {
    ar: 'قمة العطر (Top - الأسرع طيراناً)',
    en: 'Top Note (Fastest Projection)',
    fr: 'Note de tête (projection la plus rapide)',
    es: 'Nota de salida (proyección más rápida)',
    it: 'Nota di testa (proiezione più rapida)',
    de: 'Kopfnote (schnellste Abstrahlung)',
    ru: 'Верхняя нота (самое быстрое испарение)',
    zh: '前调（挥发最快）',
    tr: 'Üst nota (en hızlı yayılım)',
    fa: 'نت ابتدایی (سریع‌ترین انتشار)',
  },
  opt_heart_long: {
    ar: 'قلب العطر (Heart - الفوحان المتوسط)',
    en: 'Heart Note (Middle Bouquet)',
    fr: 'Note de cœur (bouquet central)',
    es: 'Nota de corazón (bouquet medio)',
    it: 'Nota di cuore (bouquet centrale)',
    de: 'Herznote (mittleres Bouquet)',
    ru: 'Нота сердца (средний букет)',
    zh: '中调（中段花香束）',
    tr: 'Kalp notası (orta buket)',
    fa: 'نت میانی (باکت مرکزی)',
  },
  opt_base_long: {
    ar: 'قاعدة العطر (Base - الثبات الأقصى)',
    en: 'Base Note (Maximum Longevity)',
    fr: 'Note de fond (tenue maximale)',
    es: 'Nota de fondo (fijación máxima)',
    it: 'Nota di fondo (persistenza massima)',
    de: 'Basisnote (maximale Haltbarkeit)',
    ru: 'Базовая нота (максимальная стойкость)',
    zh: '后调（留香最久）',
    tr: 'Dip notası (en yüksek kalıcılık)',
    fa: 'نت پایانی (بیشترین ماندگاری)',
  },
  add_to_pyramid: {
    ar: 'إدراج بالهرم',
    en: 'Add Note',
    fr: 'Ajouter à la pyramide',
    es: 'Añadir a la pirámide',
    it: 'Aggiungi alla piramide',
    de: 'Zur Pyramide',
    zh: '加入金字塔',
    tr: 'Piramide ekle',
    ru: 'В пирамиду',
    fa: 'افزودن به هرم',
  },
  quick_tap: {
    ar: 'نقر سريع لإضافة أشهر النوتات العالمية إلى الهرم:',
    en: 'Quick Tap to Add Iconic Benchmark Notes:',
    fr: 'Ajoutez en un clic les notes emblématiques :',
    es: 'Toque para añadir notas icónicas de referencia:',
    it: 'Tocca per aggiungere note iconiche di riferimento:',
    de: 'Klicken Sie, um ikonische Benchmark-Noten hinzuzufügen:',
    ru: 'Быстрое добавление знаковых нот:',
    zh: '一键添加世界经典香材：',
    tr: 'İkonik notaları tek dokunuşla ekleyin:',
    fa: 'افزودن سریع معروف‌ترین نت‌های جهانی به هرم:',
  },
  cat_all: {
    ar: 'الكل',
    en: 'All',
    fr: 'Toutes',
    es: 'Todas',
    it: 'Tutte',
    de: 'Alle',
    ru: 'Все',
    zh: '全部',
    tr: 'Tümü',
    fa: 'همه',
  },
  cat_top: {
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
  cat_heart: {
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
  cat_base: {
    ar: 'قاعدة',
    en: 'Base',
    fr: 'Fond',
    es: 'Fondo',
    it: 'Fondo',
    de: 'Basis',
    ru: 'База',
    zh: '后调',
    tr: 'Dip',
    fa: 'پایانی',
  },
  current_distribution: {
    ar: 'التوزيع الهرمي الحالي',
    en: 'Current Pyramid Distribution',
    fr: 'Répartition actuelle de la pyramide',
    es: 'Distribución actual de la pirámide',
    it: 'Ripartizione attuale della piramide',
    de: 'Aktuelle Pyramidenverteilung',
    ru: 'Текущее распределение пирамиды',
    zh: '当前金字塔分布',
    tr: 'Mevcut piramit dağılımı',
    fa: 'توزیع فعلی هرم',
  },
  total: {
    ar: 'المجموع:',
    en: 'Total:',
    fr: 'Total :',
    es: 'Total:',
    it: 'Totale:',
    de: 'Gesamt:',
    ru: 'Итого:',
    zh: '合计：',
    tr: 'Toplam:',
    fa: 'مجموع:',
  },
  top_layer_title: {
    ar: 'قمة العطر (Top Notes)',
    en: 'Top Notes (Head)',
    fr: 'Notes de tête',
    es: 'Notas de salida (cabeza)',
    it: 'Note di testa',
    de: 'Kopfnoten',
    ru: 'Верхние ноты',
    zh: '前调',
    tr: 'Üst notalar',
    fa: 'نت‌های ابتدایی (تاپ)',
  },
  top_layer_desc: {
    ar: 'الحمضيات والأعشاب الخفيفة · الفوحان الأولي (15-30 دقيقة)',
    en: 'Citrus & volatile aromatics · Initial projection (15-30 min)',
    fr: 'Agrumes et aromatiques volatils · projection initiale (15-30 min)',
    es: 'Cítricos y aromáticos volátiles · proyección inicial (15-30 min)',
    it: 'Agrumi e aromatici volatili · proiezione iniziale (15-30 min)',
    de: 'Zitrus & flüchtige Aromaten · anfängliche Abstrahlung (15-30 Min.)',
    ru: 'Цитрусы и летучие ароматы · начальный шлейф (15-30 мин)',
    zh: '柑橘与轻盈芳香草本 · 初段气场（15-30 分钟）',
    tr: 'Narenciye ve uçucu aromatikler · ilk yayılım (15-30 dk)',
    fa: 'مرکبات و گیاهان معطر سبک · پخش بو اولیه (۱۵-۳۰ دقیقه)',
  },
  heart_layer_title: {
    ar: 'قلب العطر (Heart / Middle Notes)',
    en: 'Heart Notes (Bouquet)',
    fr: 'Notes de cœur (bouquet)',
    es: 'Notas de corazón (bouquet)',
    it: 'Note di cuore (bouquet)',
    de: 'Herznoten (Bouquet)',
    ru: 'Ноты сердца (букет)',
    zh: '中调（花香束）',
    tr: 'Kalp notaları (buket)',
    fa: 'نت‌های میانی (قلب عطر)',
  },
  heart_layer_desc: {
    ar: 'الزهور، التوابل، الفواكه · روح العطر وهوية التركيبة (2-6 ساعات)',
    en: 'Florals, spices, sweet fruits · Fragrance signature (2-6 hours)',
    fr: 'Fleurs, épices, fruits · signature olfactive (2-6 heures)',
    es: 'Flores, especias, frutas · firma olfativa (2-6 horas)',
    it: 'Fiori, spezie, frutti · firma olfattiva (2-6 ore)',
    de: 'Blüten, Gewürze, Früchte · Duftsignatur (2-6 Stunden)',
    ru: 'Цветы, специи, фрукты · характер аромата (2-6 часов)',
    zh: '花香、辛香、果香 · 香水灵魂与个性（2-6 小时）',
    tr: 'Çiçekler, baharatlar, meyveler · parfümün imzası (2-6 saat)',
    fa: 'گل‌ها، ادویه‌ها، میوه‌ها · روح عطر و هویت ترکیب (۲-۶ ساعت)',
  },
  base_layer_title: {
    ar: 'قاعدة العطر (Base Notes)',
    en: 'Base Notes (Fixatives)',
    fr: 'Notes de fond (fixateurs)',
    es: 'Notas de fondo (fijadores)',
    it: 'Note di fondo (fissativi)',
    de: 'Basisnoten (Fixateure)',
    ru: 'Базовые ноты (фиксаторы)',
    zh: '后调（定香层）',
    tr: 'Dip notaları (fiksatörler)',
    fa: 'نت‌های پایانی (تثبیت‌کننده‌ها)',
  },
  base_layer_desc: {
    ar: 'العود، الصندل، العنبر، الفانيليا، المسك · الثبات والعمق (8-24+ ساعة)',
    en: 'Oud, sandalwood, amber, vanilla, musks · Tenacity (8-24+ hours)',
    fr: 'Oud, santal, ambre, vanille, muscs · tenacité (8-24+ heures)',
    es: 'Oud, sándalo, ámbar, vainilla, almizcles · fijación (8-24+ horas)',
    it: 'Oud, sandalo, ambra, vaniglia, muschi · persistenza (8-24+ ore)',
    de: 'Oud, Sandel, Amber, Vanille, Moschus · Haltbarkeit (8-24+ Std.)',
    ru: 'Уд, сандал, амбра, ваниль, мускусы · стойкость (8-24+ часов)',
    zh: '乌木、檀香、琥珀、香草、麝香 · 深度留香（8-24+ 小时）',
    tr: 'Ud, sandal, amber, vanilya, misk · kalıcılık (8-24+ saat)',
    fa: 'عود، صندل، عنبر، وانیل، مشک · ماندگاری و عمق (۸-۲۴+ ساعت)',
  },
  weight: {
    ar: 'الوزن:',
    en: 'Weight:',
    fr: 'Poids :',
    es: 'Peso:',
    it: 'Peso:',
    de: 'Gewicht:',
    ru: 'Вес:',
    zh: '重量：',
    tr: 'Ağırlık:',
    fa: 'وزن:',
  },
  unbalanced_tpl: {
    ar: 'مجموع نسب المكونات حالياً هو {p}%. يُرجى ضبط النسب ليصبح المجموع 100% بدقة.',
    en: 'Total formula sum is currently {p}%. Please adjust notes to total exactly 100%.',
    fr: 'La somme des composants est de {p} %. Ajustez les notes pour totaliser exactement 100 %.',
    es: 'La suma total es del {p}%. Ajuste las notas para que sumen exactamente 100%.',
    it: 'La somma totale è {p}%. Regola le note per totalizzare esattamente il 100%.',
    de: 'Die Gesamtsumme beträgt derzeit {p}%. Passen Sie die Noten an, sodass exakt 100% entstehen.',
    ru: 'Сумма компонентов сейчас {p}%. Настройте ноты так, чтобы итог составлял ровно 100%.',
    zh: '当前配方总和为 {p}%。请调整各香材使总和恰好为 100%。',
    tr: 'Bileşen toplamı şu an %{p}. Notaları tam %100 olacak şekilde ayarlayın.',
    fa: 'مجموع درصد اجزا در حال حاضر {p}٪ است. لطفاً درصدها را طوری تنظیم کنید که مجموع دقیقاً ۱۰۰٪ شود.',
  },
  auto_balance: {
    ar: 'موازنة تلقائية لـ 100%',
    en: 'Auto-Balance to 100%',
    fr: 'Équilibrer automatiquement à 100 %',
    es: 'Equilibrar automáticamente al 100%',
    it: 'Bilancia automaticamente al 100%',
    de: 'Automatisch auf 100% ausgleichen',
    ru: 'Автобаланс до 100%',
    zh: '自动配平至 100%',
    tr: 'Otomatik %100 dengele',
    fa: 'موازنه خودکار تا ۱۰۰٪',
  },
  balanced: {
    ar: 'الهرم العطري متكامل بنسبة 100% تماماً.',
    en: 'Fragrance pyramid is perfectly balanced at 100%.',
    fr: 'La pyramide olfactive est parfaitement équilibrée à 100 %.',
    es: 'La pirámide olfativa está perfectamente equilibrada al 100%.',
    it: 'La piramide olfattiva è perfettamente bilanciata al 100%.',
    de: 'Die Duftpyramide ist perfekt auf 100% ausbalanciert.',
    ru: 'Пирамида аромата идеально сбалансирована на 100%.',
    zh: '香调金字塔已完美配平至 100%。',
    tr: 'Koku piramidi %100 mükemmel dengede.',
    fa: 'هرم عطری دقیقاً با ۱۰۰٪ کاملاً متوازن است.',
  },
  compounding_tip_title: {
    ar: 'نصيحة الخلط والمزج:',
    en: 'Master Compounding Rule:',
    fr: 'Règle de mélange du maître :',
    es: 'Regla de mezcla del maestro:',
    it: 'Regola di miscelazione del maestro:',
    de: 'Meister-Regel zum Mischen:',
    ru: 'Правило смешивания мастера:',
    zh: '大师调配法则：',
    tr: 'Usta karım kuralı:',
    fa: 'نکته ترکیب و اختلاط:',
  },
  compounding_tip_text: {
    ar: 'امزج نوتات القاعدة أولاً ثم القلب ثم القمة، واترك المزيج الزيتي يرتاح 48 ساعة قبل إضافة الكحول ليتجانس بصورة متكاملة.',
    en: 'Blend base fixatives first, then heart florals, then volatile top notes. Allow 48 hours resting before ethanol introduction.',
    fr: 'Mélangez d’abord les fixateurs de fond, puis les florales du cœur, enfin les notes volatiles de tête. Laissez reposer 48 heures avant d’ajouter l’éthanol.',
    es: 'Mezcle primero los fijadores de fondo, luego las florales del corazón y por último las notas volátiles de salida. Deje reposar 48 horas antes de añadir etanol.',
    it: 'Mescola prima i fissativi di fondo, poi i fiori del cuore e infine le note volatili di testa. Lascia riposare 48 ore prima di aggiungere l’etanolo.',
    de: 'Mischen Sie zuerst die Basis-Fixateure, dann die Herzflorals, zuletzt die flüchtigen Kopfnoten. 48 Stunden ruhen lassen, bevor Ethanol zugegeben wird.',
    ru: 'Сначала смешивайте базовые фиксаторы, затем цветочные ноты сердца, потом летучие верхние ноты. Дайте смеси отдохнуть 48 часов перед добавлением спирта.',
    zh: '先混合后调定香剂，再加入中调花香，最后加入易挥发的前调。加入乙醇前静置 48 小时。',
    tr: 'Önce dip fiksatörleri, sonra kalp çiçeklerini, en son uçucu üst notaları karıştırın. Etanol eklemeden önce 48 saat dinlendirin.',
    fa: 'ابتدا تثبیت‌کننده‌های پایه، سپس گل‌های میانی و در انتها نت‌های فرار ابتدایی را مخلوط کنید. پیش از افزودن الکل، ۴۸ ساعت استراحت دهید.',
  },
  add_custom_title: {
    ar: 'إضافة زيت عِطري أو نوتة جديدة:',
    en: 'Add Custom Fragrance Oil / Accord:',
    fr: 'Ajouter une huile ou un accord personnalisé :',
    es: 'Añadir aceite o acorde personalizado:',
    it: 'Aggiungi olio o accordo personalizzato:',
    de: 'Eigenes Duftöl / Akkord hinzufügen:',
    ru: 'Добавить своё масло или аккорд:',
    zh: '添加自定义精油/香调：',
    tr: 'Özel esans yağı / akor ekle:',
    fa: 'افزودن روغن عطری یا نت جدید:',
  },
  oil_name_ph: {
    ar: 'اسم الزيت (مثل: دهن عود تراد، ورد طائفي...)',
    en: 'Oil name (e.g., Oud Cambodi, Taif Rose...)',
    fr: 'Nom de l’huile (ex. oud cambodgien, rose de Taif...)',
    es: 'Nombre del aceite (ej. oud camboyano, rosa de Taif...)',
    it: 'Nome dell’olio (es. oud cambogiano, rosa di Taif...)',
    de: 'Ölname (z. B. Kambodscha-Oud, Taif-Rose...)',
    ru: 'Название масла (напр., камбоджийский уд, таифская роза...)',
    zh: '精油名称（如：柬埔寨乌木、塔伊夫玫瑰…）',
    tr: 'Yağ adı (örn. Kamboçya ud, Taif gülü...)',
    fa: 'نام روغن (مثلاً: دهن عود کامبوجی، گل محمدی طائفی...)',
  },
  opt_top: {
    ar: 'قمة العطر (Top)',
    en: 'Top Note',
    fr: 'Note de tête',
    es: 'Nota de salida',
    it: 'Nota di testa',
    de: 'Kopfnote',
    ru: 'Верхняя нота',
    zh: '前调',
    tr: 'Üst nota',
    fa: 'نت ابتدایی',
  },
  opt_heart: {
    ar: 'قلب العطر (Heart)',
    en: 'Heart Note',
    fr: 'Note de cœur',
    es: 'Nota de corazón',
    it: 'Nota di cuore',
    de: 'Herznote',
    ru: 'Нота сердца',
    zh: '中调',
    tr: 'Kalp notası',
    fa: 'نت میانی',
  },
  opt_base: {
    ar: 'قاعدة العطر (Base)',
    en: 'Base Note',
    fr: 'Note de fond',
    es: 'Nota de fondo',
    it: 'Nota di fondo',
    de: 'Basisnote',
    ru: 'Базовая нота',
    zh: '后调',
    tr: 'Dip notası',
    fa: 'نت پایانی',
  },
  add: {
    ar: 'إضافة',
    en: 'Add',
    fr: 'Ajouter',
    es: 'Añadir',
    it: 'Aggiungi',
    de: 'Hinzufügen',
    ru: 'Добавить',
    zh: '添加',
    tr: 'Ekle',
    fa: 'افزودن',
  },
  active_ingredients_tpl: {
    ar: 'مكونات الزيت العطري الحالية ({n} زيوت)',
    en: 'Active Fragrance Concentrates ({n} notes)',
    fr: 'Concentrés actifs ({n} notes)',
    es: 'Concentrados activos ({n} notas)',
    it: 'Concentrati attivi ({n} note)',
    de: 'Aktive Duftkonzentrate ({n} Noten)',
    ru: 'Активные концентраты ({n} нот)',
    zh: '当前香精油成分（{n} 种）',
    tr: 'Aktif esans konsantreleri ({n} nota)',
    fa: 'اجزای روغن عطری فعلی ({n} روغن)',
  },
  clear_all: {
    ar: 'تفريغ القائمة',
    en: 'Clear All',
    fr: 'Tout effacer',
    es: 'Vaciar lista',
    it: 'Svuota elenco',
    de: 'Liste leeren',
    ru: 'Очистить всё',
    zh: '清空列表',
    tr: 'Listeyi temizle',
    fa: 'خالی کردن فهرست',
  },
  empty_ingredients: {
    ar: 'لا توجد زيوت مضافة حالياً. اختر من التراكيب الجاهزة بالأعلى أو أضف زيوتاً من الدليل بالأسفل.',
    en: 'No ingredients added yet. Pick a preset above or tap materials in the catalog below.',
    fr: 'Aucun ingrédient ajouté. Choisissez une formule ci-dessus ou ajoutez des matières du catalogue ci-dessous.',
    es: 'Aún no hay ingredientes. Elija una fórmula arriba o añada materiales del catálogo inferior.',
    it: 'Nessun ingrediente aggiunto. Scegli una formula sopra o aggiungi materiali dal catalogo sotto.',
    de: 'Noch keine Zutaten. Wählen Sie oben eine Formel oder fügen Sie Materialien aus dem Katalog hinzu.',
    ru: 'Ингредиенты не добавлены. Выберите формулу выше или добавьте материалы из каталога ниже.',
    zh: '尚未添加精油。可从上方选择现成配方，或从下方目录添加香材。',
    tr: 'Henüz malzeme eklenmedi. Yukarıdan bir formül seçin veya aşağıdaki katalogdan ekleyin.',
    fa: 'هنوز روغنی اضافه نشده است. از ترکیب‌های آماده بالا انتخاب کنید یا از فهرست پایین روغن اضافه کنید.',
  },
  top_note: {
    ar: 'قمة العطر',
    en: 'Top Note',
    fr: 'Note de tête',
    es: 'Nota de salida',
    it: 'Nota di testa',
    de: 'Kopfnote',
    ru: 'Верхняя нота',
    zh: '前调',
    tr: 'Üst nota',
    fa: 'نت ابتدایی',
  },
  heart_note: {
    ar: 'قلب العطر',
    en: 'Heart Note',
    fr: 'Note de cœur',
    es: 'Nota de corazón',
    it: 'Nota di cuore',
    de: 'Herznote',
    ru: 'Нота сердца',
    zh: '中调',
    tr: 'Kalp notası',
    fa: 'نت میانی',
  },
  base_note: {
    ar: 'قاعدة العطر',
    en: 'Base Note',
    fr: 'Note de fond',
    es: 'Nota de fondo',
    it: 'Nota di fondo',
    de: 'Basisnote',
    ru: 'Базовая нота',
    zh: '后调',
    tr: 'Dip notası',
    fa: 'نت پایانی',
  },
  delete: {
    ar: 'حذف',
    en: 'Delete',
    fr: 'Supprimer',
    es: 'Eliminar',
    it: 'Elimina',
    de: 'Löschen',
    ru: 'Удалить',
    zh: '删除',
    tr: 'Sil',
    fa: 'حذف',
  },
  directory_title: {
    ar: 'دليل أشهر النوتات والمواد العطرية الشائعة (انقر للإضافة):',
    en: 'Iconic Materials Directory (Click to add):',
    fr: 'Répertoire des matières emblématiques (cliquez pour ajouter) :',
    es: 'Directorio de materiales icónicos (clic para añadir):',
    it: 'Elenco materiali iconici (clicca per aggiungere):',
    de: 'Verzeichnis ikonischer Materialien (Klick zum Hinzufügen):',
    ru: 'Каталог знаковых материалов (нажмите, чтобы добавить):',
    zh: '经典香材目录（点击添加）：',
    tr: 'İkonik malzeme rehberi (eklemek için tıklayın):',
    fa: 'راهنمای معروف‌ترین نت‌ها و مواد عطری (برای افزودن کلیک کنید):',
  },
  custom_accord: {
    ar: 'أكورد مخصص',
    en: 'Custom Accord',
    fr: 'Accord personnalisé',
    es: 'Acorde personalizado',
    it: 'Accordo personalizzato',
    de: 'Eigener Akkord',
    ru: 'Свой аккорд',
    zh: '自定义香调',
    tr: 'Özel akor',
    fa: 'آکورد سفارشی',
  },
} satisfies Record<string, LText>;

export const PyramidCalculator: React.FC<PyramidCalculatorProps> = ({
  currentLang = 'ar',
  formulation,
  pyramidNotes,
  setPyramidNotes,
  result,
}) => {
  const [viewMode, setViewMode] = useState<'graphic' | 'compounding' | 'both' | 'guide' | 'spray_simulator'>('graphic');
  const [selectedDirectoryCategory, setSelectedDirectoryCategory] = useState<'all' | 'top' | 'heart' | 'base'>('all');
  const [newNoteName, setNewNoteName] = useState('');
  const [newNoteCategory, setNewNoteCategory] = useState<'top' | 'heart' | 'base'>('top');
  const [newNotePct, setNewNotePct] = useState(15);

  const rtl = isRTL(currentLang);
  const L = makeT(currentLang, S);
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
      nameEn: L('custom_accord'),
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
      description: `${item.family} · ${item.evaporation}`,
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
            {L('page_title')}
          </h2>
          <p className="text-stone-500 text-sm mt-1">
            {fmt(L('page_desc_tpl'), { g: formatNum(result.oilWeightGrams) })}
          </p>
        </div>

        {/* View mode toggle */}
        <div className="inline-flex p-1 bg-stone-100 rounded-2xl border border-stone-200 text-xs font-semibold shrink-0 flex-wrap">
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
            <span>{L('tab_graphic')}</span>
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
            <span>{L('tab_compounding')}</span>
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
            <span>{L('tab_both')}</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('spray_simulator')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'spray_simulator'
                ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-sm font-bold ring-2 ring-amber-400/40'
                : 'text-amber-800 hover:text-amber-950 font-bold bg-amber-500/15'
            }`}
          >
            <Atom className="w-3.5 h-3.5 text-amber-500 animate-spin" />
            <span>{L('tab_spray_sim')}</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('guide')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'guide'
                ? 'bg-amber-900 text-white shadow-sm font-bold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-500" />
            <span>{L('tab_guide')}</span>
          </button>
        </div>
      </div>

      {/* 0. Criteria Guide View */}
      {viewMode === 'guide' && (
        <div className="animate-in fade-in">
          <CalculatorCriteriaGuide onClose={() => setViewMode('graphic')} />
        </div>
      )}

      {/* Dedicated Physics Spray & Skin Evaporation Simulator View */}
      {viewMode === 'spray_simulator' && (
        <div className="animate-in fade-in space-y-6">
          <PerfumeSpraySimulator
            pyramidNotes={pyramidNotes}
            bottleVolumeMl={formulation.bottleVolumeMl}
            concentrationPercent={formulation.concentrationPercent}
            result={result}
            currentLang={currentLang}
          />
        </div>
      )}

      {/* Preset Loader Strip (shown when not in guide mode) */}
      {viewMode !== 'guide' && (
      <div className="bg-white p-4 rounded-xl border border-stone-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-stone-800">
          <Sparkles className="w-4 h-4 text-amber-700" />
          <span>{L('presets_strip')}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {CURATED_FORMULA_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handleLoadPreset(preset.id)}
              className="px-3 py-1.5 text-xs rounded-md bg-stone-50 hover:bg-amber-50 hover:border-amber-400 border border-stone-200 text-stone-700 font-medium transition-all cursor-pointer"
            >
              {rtl ? preset.title.split('(')[0] : ((preset as any).titleEn || preset.title.split('(')[0])}
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
              <span>{L('add_notes_title')}</span>
            </span>
            <button
              type="button"
              onClick={() => setViewMode('compounding')}
              className="text-xs text-amber-700 hover:text-amber-800 font-semibold cursor-pointer flex items-center gap-1"
            >
              <span>{L('view_full_scales')}</span>
              <ActionArrow className="w-3.5 h-3.5" />
            </button>
          </div>

          <form onSubmit={handleAddCustomNote} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-5">
              <input
                type="text"
                placeholder={L('note_name_ph')}
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
                <option value="top">{L('opt_top_long')}</option>
                <option value="heart">{L('opt_heart_long')}</option>
                <option value="base">{L('opt_base_long')}</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <div className="relative">
                <LocalizedNumberInput
                  lang={currentLang}
                  min={1}
                  max={100}
                  value={newNotePct}
                  onValue={(n) => setNewNotePct(n || 0)}
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
                <span>{L('add_to_pyramid')}</span>
              </button>
            </div>
          </form>

          {/* Quick Directory Chips */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs text-stone-600 gap-2 flex-wrap">
              <span className="font-semibold flex items-center gap-1.5">
                <ListPlus className="w-3.5 h-3.5 text-amber-700" />
                <span>{L('quick_tap')}</span>
              </span>
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setSelectedDirectoryCategory('all')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${selectedDirectoryCategory === 'all' ? 'bg-stone-900 text-white font-medium' : 'text-stone-500'}`}
                >
                  {L('cat_all')}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDirectoryCategory('top')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${selectedDirectoryCategory === 'top' ? 'bg-amber-500 text-stone-950 font-bold' : 'text-stone-500'}`}
                >
                  {L('cat_top')}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDirectoryCategory('heart')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${selectedDirectoryCategory === 'heart' ? 'bg-stone-800 text-white font-bold' : 'text-stone-500'}`}
                >
                  {L('cat_heart')}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDirectoryCategory('base')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${selectedDirectoryCategory === 'base' ? 'bg-amber-950 text-amber-300 font-bold' : 'text-stone-500'}`}
                >
                  {L('cat_base')}
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
                  <span>{pickArEn(currentLang, note.nameAr, note.nameEn)}</span>
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
                {L('current_distribution')}
              </span>
              <span
                className={`text-xs font-mono-numbers font-semibold ${
                  isBalanced100 ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {L('total')} {formatNum(breakdown.totalPercentage, 1)}%
              </span>
            </div>

            {/* Pyramid Layers */}
            <div className="space-y-2 pt-2">
              {/* 1. Top Layer */}
              <div className="relative group bg-amber-50/90 border border-amber-200 rounded-xl p-4 text-center transition-all">
                <div className="text-[11px] font-semibold text-amber-900 uppercase">
                  {L('top_layer_title')}
                </div>
                <div className="text-xl font-extrabold text-amber-950 font-mono-numbers mt-0.5">
                  {formatNum(breakdown.topPct, 1)}%
                </div>
                <div className="text-[11px] text-amber-800/80 mt-1">
                  {L('weight')} {formatNum((result.oilWeightGrams * breakdown.topPct) / 100)} g
                </div>
                <div className="text-[10px] text-stone-500 mt-0.5">
                  {L('top_layer_desc')}
                </div>
              </div>

              {/* 2. Heart Layer */}
              <div className="relative group bg-stone-100 border border-stone-200 rounded-xl p-4 text-center transition-all">
                <div className="text-[11px] font-semibold text-stone-800 uppercase">
                  {L('heart_layer_title')}
                </div>
                <div className="text-xl font-extrabold text-stone-900 font-mono-numbers mt-0.5">
                  {formatNum(breakdown.heartPct, 1)}%
                </div>
                <div className="text-[11px] text-stone-700 mt-1">
                  {L('weight')} {formatNum((result.oilWeightGrams * breakdown.heartPct) / 100)} g
                </div>
                <div className="text-[10px] text-stone-500 mt-0.5">
                  {L('heart_layer_desc')}
                </div>
              </div>

              {/* 3. Base Layer */}
              <div className="relative group bg-stone-900 text-white rounded-xl p-4 text-center transition-all shadow-sm">
                <div className="text-[11px] font-semibold text-amber-400 uppercase">
                  {L('base_layer_title')}
                </div>
                <div className="text-xl font-extrabold text-white font-mono-numbers mt-0.5">
                  {formatNum(breakdown.basePct, 1)}%
                </div>
                <div className="text-[11px] text-stone-300 mt-1">
                  {L('weight')} {formatNum((result.oilWeightGrams * breakdown.basePct) / 100)} g
                </div>
                <div className="text-[10px] text-stone-400 mt-0.5">
                  {L('base_layer_desc')}
                </div>
              </div>
            </div>

            {/* Validation Message */}
            {!isBalanced100 && (
              <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-lg text-xs text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <span>{fmt(L('unbalanced_tpl'), { p: formatNum(breakdown.totalPercentage, 1) })}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleAutoBalanceTo100()}
                  className="px-3 py-1.5 bg-amber-800 hover:bg-amber-900 text-amber-50 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>{L('auto_balance')}</span>
                </button>
              </div>
            )}

            {isBalanced100 && (
              <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-lg text-xs text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{L('balanced')}</span>
              </div>
            )}
          </div>

          {/* Compounding Visual Card */}
          <div className="rounded-2xl overflow-hidden border border-stone-200 shadow-xs relative aspect-[4/3]">
            <img loading="lazy" decoding="async"
              src={compoundingImg}
              alt="Laboratory Balance Compounding"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-transparent to-transparent flex items-end p-4">
              <div className="text-white text-xs space-y-0.5">
                <span className="font-bold text-amber-300 block">{L('compounding_tip_title')}</span>
                <p className="text-[11px] text-stone-200 leading-relaxed">
                  {L('compounding_tip_text')}
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
              {L('add_custom_title')}
            </span>
            <form onSubmit={handleAddCustomNote} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-5">
                <input
                  type="text"
                  placeholder={L('oil_name_ph')}
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
                  <option value="top">{L('opt_top')}</option>
                  <option value="heart">{L('opt_heart')}</option>
                  <option value="base">{L('opt_base')}</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <div className="relative">
                  <LocalizedNumberInput
                    lang={currentLang}
                    min={1}
                    max={100}
                    value={newNotePct}
                    onValue={(n) => setNewNotePct(n || 0)}
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
                  <span>{L('add')}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Active Ingredients Table */}
          <div className="bg-white rounded-xl border border-stone-200/80 shadow-sm overflow-hidden">
            <div className="p-4 bg-stone-50/70 border-b border-stone-200/70 flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-stone-900">
                {fmt(L('active_ingredients_tpl'), { n: breakdown.notesWithQuantities.length })}
              </span>
              <button
                type="button"
                onClick={() => setPyramidNotes([])}
                className="text-[11px] text-rose-700 hover:text-rose-900 cursor-pointer"
              >
                {L('clear_all')}
              </button>
            </div>

            {breakdown.notesWithQuantities.length === 0 ? (
              <div className="p-8 text-center text-stone-400 text-xs">
                {L('empty_ingredients')}
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
                          {pickArEn(currentLang, item.nameAr, item.nameEn)}
                        </div>
                        <div className="text-[10px] text-stone-400">
                          {item.category === 'top'
                            ? L('top_note')
                            : item.category === 'heart'
                            ? L('heart_note')
                            : L('base_note')}
                          {item.description ? ` · ${item.description}` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Weight Display */}
                      <div className={`${rtl ? 'text-right' : 'text-left'} font-mono-numbers`}>
                        <div className="text-xs font-bold text-amber-900">
                          {formatNum(item.weightGrams)} g
                        </div>
                        <div className="text-[10px] text-stone-400">
                          {formatNum(item.volumeMl)} ml
                        </div>
                      </div>

                      {/* Percentage Controller */}
                      <div className="flex items-center gap-1">
                        <LocalizedNumberInput
                          lang={currentLang}
                          min={0}
                          max={100}
                          value={item.percentageOfOil}
                          onValue={(n) => handleUpdateNotePct(item.id, n || 0)}
                          className="w-14 px-2 py-1 bg-stone-50 border border-stone-200 rounded text-xs font-mono-numbers text-center text-stone-900"
                        />
                        <span className="text-[11px] text-stone-500">%</span>
                      </div>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleDeleteNote(item.id)}
                        className="p-1 text-stone-400 hover:text-rose-600 transition-colors cursor-pointer"
                        title={L('delete')}
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
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                <ListPlus className="w-4 h-4 text-amber-700" />
                <span>{L('directory_title')}</span>
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
                  {L('cat_all')}
                </button>
                <button
                  onClick={() => setSelectedDirectoryCategory('top')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    selectedDirectoryCategory === 'top'
                      ? 'bg-amber-500 text-stone-950 font-bold'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {L('cat_top')}
                </button>
                <button
                  onClick={() => setSelectedDirectoryCategory('heart')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    selectedDirectoryCategory === 'heart'
                      ? 'bg-stone-800 text-white font-bold'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {L('cat_heart')}
                </button>
                <button
                  onClick={() => setSelectedDirectoryCategory('base')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    selectedDirectoryCategory === 'base'
                      ? 'bg-amber-950 text-amber-300 font-bold'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {L('cat_base')}
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
                  <span>{pickArEn(currentLang, note.nameAr, note.nameEn)}</span>
                  <span className="text-[9px] text-stone-400">({note.family})</span>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
      )}
      <LegalDisclaimer type="chemical" lang={currentLang} />
    </div>
  );
};
