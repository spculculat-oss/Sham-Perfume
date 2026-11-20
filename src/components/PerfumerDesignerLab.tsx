import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  Beaker,
  BookmarkPlus,
  Check,
  CheckCircle2,
  Compass,
  Droplets,
  Eye,
  FlaskConical,
  Layers,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  Wind,
  Wrench,
} from 'lucide-react';
import { RAW_MATERIALS_DATABASE } from '../data/rawMaterials';
import type { FormulationState, PyramidNote } from '../types/perfume';
import type { SupportedLanguage } from '../types/i18n';
import { formatNum } from '../utils/calculations';
import { ApiError, ApiUnavailableError, requestApi } from '../utils/api';
import {
  evaluateDesignerTrial,
  generateSampleTestReport,
  type DeveloperFixSuggestion,
  type DesignerSimulationResult,
  type SafetyStatus,
  type SampleApplicationTarget,
  type SampleSkinType,
  type SampleTestReport,
  type SampleWearScenario,
} from '../utils/designerSimulationEngine';
import { SprayKineticsAR3D } from './DesignSimulatorsAR3D';
import { isRTL } from '../لغات/localizedContent';
import { LText, makeT } from '../لغات/localize';

interface PerfumerDesignerLabProps {
  currentLang: SupportedLanguage;
  formulaTitle: string;
  setFormulaTitle: (title: string) => void;
  formulation: FormulationState;
  setFormulation: React.Dispatch<React.SetStateAction<FormulationState>>;
  pyramidNotes: PyramidNote[];
  setPyramidNotes: React.Dispatch<React.SetStateAction<PyramidNote[]>>;
  macerationDays: number;
  setMacerationDays: (days: number) => void;
  isStaticHosting: boolean;
  onSyncNotice?: (msg: string) => void;
  onOpenSaveModal: () => void;
  onOpenSpecModal: () => void;
  onNavigateToTab: (tab: string) => void;
}

type SimStageTab = 'vision' | 'sample_test' | 'pyramid' | 'safety' | 'optimizer';
type OptimizationGoal = 'balanced_luxury' | 'max_longevity' | 'strict_safety' | 'cost_efficiency';

interface AiPatchItem {
  id: string;
  title: string;
  rationale: string;
  impactTag: string;
  actionType: 'add_note' | 'update_note' | 'adjust_carrier';
  noteNameAr?: string;
  noteNameEn?: string;
  category?: 'top' | 'heart' | 'base';
  targetPct?: number;
  concentrationPercent?: number;
  fixativePercent?: number;
  waterPercent?: number;
  macerationDays?: number;
}

interface AiOptimizerResponse {
  success: boolean;
  generatedAt: string;
  goal: string;
  optimization: {
    productDiagnosis: string;
    targetWearerAndOccasion: string;
    manufacturingProtocol: string;
    patches: AiPatchItem[];
  };
}

interface StarterPreset {
  id: string;
  nameAr: string;
  nameEn: string;
  concentrationPercent: number;
  fixativePercent: number;
  waterPercent: number;
  macerationDays: number;
  notes: Omit<PyramidNote, 'id'>[];
}

const STARTER_PRESETS: StarterPreset[] = [
  {
    id: 'royal_oud_rose',
    nameAr: 'عود وورد طائفي ملكي',
    nameEn: 'Royal Oud & Taif Rose',
    concentrationPercent: 25,
    fixativePercent: 1.5,
    waterPercent: 1,
    macerationDays: 42,
    notes: [
      { nameAr: 'زيت برغموت كالابريا الخالي من البرغابتين (Bergamot FCF)', nameEn: 'Calabrian Bergamot FCF', category: 'top', percentageOfOil: 16 },
      { nameAr: 'خلاصة الورد الطائفي النقي (Taif Rose Absolute)', nameEn: 'Taif Rose Absolute', category: 'heart', percentageOfOil: 24 },
      { nameAr: 'هيديون (Hedione)', nameEn: 'Hedione', category: 'heart', percentageOfOil: 16 },
      { nameAr: 'دهن عود كمبودي معتق (Aged Cambodi Oud)', nameEn: 'Aged Cambodian Oud Oil', category: 'base', percentageOfOil: 22 },
      { nameAr: 'زيت خشب الصندل الميسوري النقي', nameEn: 'Mysore Sandalwood Oil', category: 'base', percentageOfOil: 14 },
      { nameAr: 'أمبروكسان نقي (Ambroxan)', nameEn: 'Ambroxan Pure', category: 'base', percentageOfOil: 8 },
    ],
  },
  {
    id: 'citrus_amber_modern',
    nameAr: 'أكورد برغموت وعنبر حديث',
    nameEn: 'Modern Citrus & Ambergris',
    concentrationPercent: 18,
    fixativePercent: 1.2,
    waterPercent: 1.5,
    macerationDays: 25,
    notes: [
      { nameAr: 'زيت برغموت كالابريا الخالي من البرغابتين (Bergamot FCF)', nameEn: 'Calabrian Bergamot FCF', category: 'top', percentageOfOil: 26 },
      { nameAr: 'كالون 1951 (Calone)', nameEn: 'Calone 1951', category: 'top', percentageOfOil: 1 },
      { nameAr: 'لينالول طبيعي عالي النقاوة', nameEn: 'Pure Linalool Natural', category: 'heart', percentageOfOil: 14 },
      { nameAr: 'هيديون (Hedione)', nameEn: 'Hedione', category: 'heart', percentageOfOil: 21 },
      { nameAr: 'إيزو إي سوبر (Iso E Super)', nameEn: 'Iso E Super', category: 'base', percentageOfOil: 22 },
      { nameAr: 'سيتالوكس / أمبروكس سوبر (Cetalox)', nameEn: 'Cetalox / Ambrox Super', category: 'base', percentageOfOil: 16 },
    ],
  },
  {
    id: 'velvet_vanilla_gourmand',
    nameAr: 'فانيليا مخملية وتونكا دافئة',
    nameEn: 'Velvet Vanilla & Tonka',
    concentrationPercent: 22,
    fixativePercent: 2.0,
    waterPercent: 1.0,
    macerationDays: 35,
    notes: [
      { nameAr: 'زيت برغموت كالابريا الخالي من البرغابتين (Bergamot FCF)', nameEn: 'Calabrian Bergamot FCF', category: 'top', percentageOfOil: 12 },
      { nameAr: 'هيديون (Hedione)', nameEn: 'Hedione', category: 'heart', percentageOfOil: 18 },
      { nameAr: 'كشميران (Cashmeran)', nameEn: 'Cashmeran', category: 'heart', percentageOfOil: 12 },
      { nameAr: 'فانيلين نقي وإيثيل فانيلين', nameEn: 'Pure Vanillin', category: 'base', percentageOfOil: 28 },
      { nameAr: 'كومارين وخلاصة بذور التونكا', nameEn: 'Coumarin & Tonka Bean', category: 'base', percentageOfOil: 12 },
      { nameAr: 'زيت باتشولي إندونيسي معتق', nameEn: 'Indonesian Dark Patchouli', category: 'base', percentageOfOil: 18 },
    ],
  },
];

const S = {
  title: {
    ar: 'قسم مصمم العطور — معمل التجارب والمحاكاة الحية',
    en: 'Perfume Designer Studio — Live Experimentation & Simulation Lab',
    fr: 'Studio Parfumeur — Laboratoire d’expérimentation et simulation',
    es: 'Estudio del Diseñador — Laboratorio de experimentación y simulación',
    it: 'Studio del Profumiere — Laboratorio di sperimentazione e simulazione',
    de: 'Parfümdesigner-Studio — Live-Experimentier- & Simulationslabor',
    ru: 'Студия парфюмера — Лаборатория живых экспериментов и симуляции',
    zh: '调香师设计室 — 实时实验与全真模拟实验室',
    tr: 'Parfüm Tasarımcısı Stüdyosu — Canlı Deney ve Simülasyon Laboratuvarı',
    fa: 'بخش طراح عطر — آزمایشگاه تجربه زنده و شبیه‌سازی کامل',
  },
  subtitle: {
    ar: 'اختبر تركيباتك في بيئة تجارب معزولة، راقب الذوبانية والتبخر ساعة بساعة، افحص امتثال IFRA، وطبّق تحسينات المطور قبل التنفيذ الفعلي.',
    en: 'Experiment freely in a live sandbox: inspect phase clarity, 12-hour evaporation physics, IFRA Category 4 safety, and developer engineering optimizations before batching.',
    fr: 'Expérimentez en direct : solubilité, courbe d’évaporation 12h, conformité IFRA et optimisations R&D avant production.',
    es: 'Experimenta en vivo: claridad, cinética de evaporación 12h, seguridad IFRA y mejoras de formulación antes de producir.',
    it: 'Sperimenta dal vivo: limpidezza, cinetica di evaporazione 12h, sicurezza IFRA e ottimizzazioni prima della produzione.',
    de: 'Live experimentieren: Löslichkeit, 12h-Verdunstungskinetik, IFRA-Sicherheit und R&D-Optimierungen vor der Abfüllung.',
    ru: 'Экспериментируйте в реальном времени: прозрачность, кинетика 12ч, безопасность IFRA и оптимизация до розлива.',
    zh: '在独立实验台中实时调配：预览澄清度、12小时挥发曲线、IFRA 安全审计与研发优化建议。',
    tr: 'Canlı deney masasında test edin: berraklık, 12 saatlik buharlaşma, IFRA güvenliği ve geliştirici iyileştirmeleri.',
    fa: 'در میز آزمایش زنده بررسی کنید: شفافیت محلول، منحنی تبخیر ۱۲ ساعته، ایمنی IFRA و پیشنهادهای بهبود پیش از تولید.',
  },
  readiness_lbl: { ar: 'جاهزية التصميم', en: 'Design Readiness', fr: 'Maturité', es: 'Preparación', it: 'Prontezza', de: 'Reife', ru: 'Готовность', zh: '设计就绪度', tr: 'Hazırlık', fa: 'آمادگی طراحی' },
  ifra_lbl: { ar: 'سلامة IFRA', en: 'IFRA Safety', fr: 'Sécurité IFRA', es: 'Seguridad IFRA', it: 'Sicurezza IFRA', de: 'IFRA-Sicherheit', ru: 'IFRA', zh: 'IFRA 安全', tr: 'IFRA Güvenliği', fa: 'ایمنی IFRA' },
  longevity_lbl: { ar: 'الثبات المتوقع', en: 'Est. Longevity', fr: 'Tenue est.', es: 'Duración est.', it: 'Durata st.', de: 'Haltbarkeit', ru: 'Стойкость', zh: '预计留香', tr: 'Kalıcılık', fa: 'ماندگاری تخمینی' },
  projection_lbl: { ar: 'أقصى فوحان', en: 'Peak Sillage', fr: 'Sillage max', es: 'Estela máx.', it: 'Scia max', de: 'Sillage-Peak', ru: 'Шлейф', zh: '最大扩散', tr: 'Yayılım', fa: 'اوج پخش بو' },
  sync_btn: { ar: 'اعتماد التصميم بالمعمل', en: 'Commit to Main Lab', fr: 'Appliquer au labo', es: 'Aplicar al lab', it: 'Applica al lab', de: 'Ins Hauptlabor übernehmen', ru: 'Применить в лабораторию', zh: '同步到主实验室', tr: 'Ana Laboratuvara Aktar', fa: 'اعمال در آزمایشگاه اصلی' },
  synced_ok: { ar: 'تمت المزامنة!', en: 'Committed!', fr: 'Appliqué !', es: '¡Aplicado!', it: 'Applicato!', de: 'Übernommen!', ru: 'Применено!', zh: '已同步！', tr: 'Aktarıldı!', fa: 'اعمال شد!' },
  save_btn: { ar: 'حفظ الوصفة', en: 'Save Formula', fr: 'Enregistrer', es: 'Guardar', it: 'Salva', de: 'Speichern', ru: 'Сохранить', zh: '保存配方', tr: 'Kaydet', fa: 'ذخیره فرمول' },
  print_btn: { ar: 'بطاقة التصنيع', en: 'Spec Sheet', fr: 'Fiche tech.', es: 'Ficha técnica', it: 'Scheda tecnica', de: 'Datenblatt', ru: 'Техкарта', zh: '生产规格单', tr: 'Teknik Föy', fa: 'برگه تولید' },
  snap_save: { ar: 'تثبيت مرجع مقارنة A', en: 'Capture Baseline A', fr: 'Capturer Réf. A', es: 'Capturar Ref. A', it: 'Cattura Rif. A', de: 'Referenz A speichern', ru: 'Сохранить эталон A', zh: '保存基准 A', tr: 'Referans A Al', fa: 'ثبت مرجع مقایسه A' },
  snap_clear: { ar: 'مسح المرجع A', en: 'Clear Baseline A', fr: 'Effacer Réf. A', es: 'Borrar Ref. A', it: 'Cancella Rif. A', de: 'Referenz A löschen', ru: 'Сбросить A', zh: '清除基准 A', tr: 'Referans A Temizle', fa: 'پاک کردن مرجع A' },
  bench_title: { ar: 'طاولة التجارب الحية', en: 'Live Experimentation Bench', fr: 'Banc d’expérimentation', es: 'Banco de pruebas', it: 'Banco di prova', de: 'Experimentierbank', ru: 'Стенд экспериментов', zh: '实时实验台', tr: 'Canlı Deney Masası', fa: 'میز آزمایش زنده' },
  starters_lbl: { ar: 'قوالب سريعة:', en: 'Quick Starters:', fr: 'Modèles :', es: 'Plantillas:', it: 'Modelli:', de: 'Vorlagen:', ru: 'Шаблоны:', zh: '快速模板：', tr: 'Şablonlar:', fa: 'الگوهای آماده:' },
  bottle_lbl: { ar: 'الحجم (مل)', en: 'Volume (ml)', fr: 'Volume (ml)', es: 'Volumen (ml)', it: 'Volume (ml)', de: 'Volumen (ml)', ru: 'Объём (мл)', zh: '容量 (ml)', tr: 'Hacim (ml)', fa: 'حجم (ml)' },
  conc_lbl: { ar: 'تركيز الزيت %', en: 'Oil Conc. %', fr: 'Conc. huile %', es: 'Conc. aceite %', it: 'Conc. olio %', de: 'Ölkonz. %', ru: 'Конц. масла %', zh: '香精浓度 %', tr: 'Yağ Oranı %', fa: 'غلظت اسانس %' },
  ethanol_lbl: { ar: 'نقاء الكحول %', en: 'Ethanol ABV %', fr: 'Éthanol %', es: 'Etanol %', it: 'Etanolo %', de: 'Ethanol %', ru: 'Этанол %', zh: '乙醇纯度 %', tr: 'Etanol %', fa: 'خلوص الکل %' },
  water_lbl: { ar: 'الماء المقطر %', en: 'Water %', fr: 'Eau %', es: 'Agua %', it: 'Acqua %', de: 'Wasser %', ru: 'Вода %', zh: '蒸馏水 %', tr: 'Su %', fa: 'آب مقطر %' },
  fixative_lbl: { ar: 'المثبت (DPG) %', en: 'Fixative %', fr: 'Fixateur %', es: 'Fijador %', it: 'Fissante %', de: 'Fixativ %', ru: 'Фиксатор %', zh: '定香剂 %', tr: 'Sabitleyici %', fa: 'ثابت‌کننده %' },
  maceration_lbl: { ar: 'التعتيق (يوم)', en: 'Maceration (d)', fr: 'Macération (j)', es: 'Maceración (d)', it: 'Macerazione (g)', de: 'Reifung (T)', ru: 'Мацерация (д)', zh: '浸置 (天)', tr: 'Maserasyon (g)', fa: 'تعتیق (روز)' },
  temp_lbl: { ar: 'حرارة الاختبار °C', en: 'Ambient Temp °C', fr: 'Temp. °C', es: 'Temp. °C', it: 'Temp. °C', de: 'Temp. °C', ru: 'Темп. °C', zh: '环境温度 °C', tr: 'Ortam Sıcaklığı °C', fa: 'دمای آزمایش °C' },
  humidity_lbl: { ar: 'الرطوبة %', en: 'Humidity %', fr: 'Humidité %', es: 'Humedad %', it: 'Umidità %', de: 'Feuchte %', ru: 'Влажность %', zh: '湿度 %', tr: 'Nem %', fa: 'رطوبت %' },
  notes_bench_lbl: { ar: 'تركيبة النوتات الحية', en: 'Active Notes Dosing', fr: 'Dosage des notes', es: 'Dosificación de notas', it: 'Dosaggio note', de: 'Noten-Dosierung', ru: 'Дозировка нот', zh: '香调实时配比', tr: 'Nota Dozajı', fa: 'دوزینگ نت‌های فعال' },
  normalize_btn: { ar: 'توحيد النسب لـ 100%', en: 'Normalize 100%', fr: 'Normaliser 100%', es: 'Normalizar 100%', it: 'Normalizza 100%', de: 'Auf 100% norm.', ru: 'К 100%', zh: '归一化 100%', tr: '%100 Yap', fa: 'نرمال‌سازی ۱۰۰٪' },
  add_material_ph: { ar: 'ابحث وأضف خامة من موسوعة المعمل (CAS / اسم)...', en: 'Search & add lab ingredient (name or CAS)...', fr: 'Rechercher un ingrédient…', es: 'Buscar ingrediente…', it: 'Cerca ingrediente…', de: 'Rohstoff suchen…', ru: 'Найти сырьё…', zh: '搜索并添加原料…', tr: 'Hammadde ara ve ekle…', fa: 'جستجو و افزودن ماده اولیه...' },
  tab_vision: { ar: 'رؤية التنفيذ والمحاكاة', en: 'Pre-Execution & Kinetics', fr: 'Pré-exécution & Cinétique', es: 'Visión y Cinética', it: 'Visione e Cinetica', de: 'Vorausblick & Kinetik', ru: 'Визуализация и кинетика', zh: '执行预览与动力学', tr: 'Ön İzleme ve Kinetik', fa: 'چشم‌انداز اجرا و سینتیک' },
  tab_sample_test: { ar: 'محاكاة اختبار عينة', en: 'Sample Wear Test', fr: 'Test d’échantillon', es: 'Prueba de muestra', it: 'Test del campione', de: 'Proben-Tragetest', ru: 'Тест образца', zh: '样品试香测试', tr: 'Numune Testi', fa: 'شبیه‌سازی تست نمونه' },
  tab_pyramid: { ar: 'تقييم الهرم والرادار', en: 'Pyramid & Radar', fr: 'Pyramide & Radar', es: 'Pirámide y Radar', it: 'Piramide e Radar', de: 'Pyramide & Radar', ru: 'Пирамида и Радар', zh: '金字塔与雷达评估', tr: 'Piramit ve Radar', fa: 'ارزیابی هرم و رادار' },
  tab_safety: { ar: 'تقييم السلامة IFRA', en: 'IFRA & Safety Audit', fr: 'Audit Sécurité IFRA', es: 'Auditoría IFRA', it: 'Audit Sicurezza IFRA', de: 'IFRA-Sicherheitsaudit', ru: 'Аудит IFRA', zh: 'IFRA 安全审计', tr: 'IFRA Güvenlik Denetimi', fa: 'ارزیابی ایمنی IFRA' },
  tab_optimizer: { ar: 'اقتراحات المطور', en: 'Developer Optimizer', fr: 'Optimiseur R&D', es: 'Optimizador R&D', it: 'Ottimizzatore R&D', de: 'Entwickler-Optimierer', ru: 'Оптимизатор формулы', zh: '研发优化建议', tr: 'Geliştirici İyileştirme', fa: 'پیشنهادهای بهبود توسعه‌دهنده' },
  sample_run_btn: { ar: 'توليد تقرير اختبار العينة الافتراضي', en: 'Generate Sample Wear Report', fr: 'Générer le rapport d’échantillon', es: 'Generar informe de muestra', it: 'Genera report campione', de: 'Probentest-Bericht erstellen', ru: 'Создать отчёт по образцу', zh: '生成样品试香报告', tr: 'Numune Test Raporu Oluştur', fa: 'تولید گزارش آزمایش نمونه' },
  sample_quick_btn: { ar: 'اختبار العينة', en: 'Sample Test', fr: 'Tester échantillon', es: 'Probar muestra', it: 'Test campione', de: 'Probentest', ru: 'Тест образца', zh: '样品测试', tr: 'Numune Testi', fa: 'تست نمونه' },
  tier_top: { ar: 'قمة', en: 'Top', fr: 'Tête', es: 'Salida', it: 'Testa', de: 'Kopf', ru: 'Верх', zh: '前调', tr: 'Üst', fa: 'آغازین' },
  tier_heart: { ar: 'قلب', en: 'Heart', fr: 'Cœur', es: 'Corazón', it: 'Cuore', de: 'Herz', ru: 'Сердце', zh: '中调', tr: 'Kalp', fa: 'میانی' },
  tier_base: { ar: 'قاعدة', en: 'Base', fr: 'Fond', es: 'Fondo', it: 'Fondo', de: 'Basis', ru: 'База', zh: '基调', tr: 'Baz', fa: 'پایه' },
  status_pass: { ar: 'مطابق ومستقر', en: 'Nominal', fr: 'Conforme', es: 'Conforme', it: 'Conforme', de: 'Konform', ru: 'Норма', zh: '合规稳定', tr: 'Uygun', fa: 'ایمن و پایدار' },
  status_caution: { ar: 'تحتاج معايرة', en: 'Calibration Needed', fr: 'À calibrer', es: 'Requiere ajuste', it: 'Da calibrare', de: 'Prüfen', ru: 'Внимание', zh: '需微调', tr: 'Kontrol Gerekli', fa: 'نیازمند تنظیم' },
  status_fail: { ar: 'تعديل حرج مطلوب', en: 'Action Required', fr: 'Action requise', es: 'Acción requerida', it: 'Azione richiesta', de: 'Kritisch', ru: 'Превышение', zh: '需立即修正', tr: 'Müdahale Gerekli', fa: 'نیازمند اصلاح فوری' },
  clarity_title: { ar: 'محاكاة الذوبانية والكتل الفيزيائية (قبل الخلط)', en: 'Solubility, Clarity & Gravimetric Pre-Batch Forecast', fr: 'Solubilité, limpidité et bilan massique', es: 'Solubilidad, claridad y masa', it: 'Solubilità, limpidezza e masse', de: 'Löslichkeit, Klarheit & Masse', ru: 'Растворимость и гравиметрия', zh: '溶解度、澄清度与称重预测', tr: 'Çözünürlük, Berraklık ve Kütle', fa: 'شبیه‌سازی حلالیت، شفافیت و جرم' },
  evap_title: { ar: 'محاكاة التبخر والانتشار على مدار 12 ساعة', en: '12-Hour Evaporation & Sillage Envelope Simulation', fr: 'Cinétique d’évaporation et sillage (12h)', es: 'Curva de evaporación y estela (12h)', it: 'Cinetica di evaporazione e scia (12h)', de: '12h-Verdunstungs- & Sillage-Kurve', ru: 'Кривая испарения и шлейфа (12ч)', zh: '12 小时挥发与扩散包络线模拟', tr: '12 Saatlik Buharlaşma ve Yayılım Eğrisi', fa: 'شبیه‌سازی تبخیر و پخش بو در ۱۲ ساعت' },
  toggle_3d_ar: { ar: 'عرض محاكي الرش ثلاثي الأبعاد والواقع المعزز (3D / AR)', en: 'Interactive 3D / AR Atomization Preview', fr: 'Aperçu 3D / RA de pulvérisation', es: 'Vista 3D / RA de atomización', it: 'Anteprima 3D / AR atomizzazione', de: '3D-/AR-Zerstäubungsvorschau', ru: '3D / AR визуализация спрея', zh: '3D / AR 雾化喷洒实时预览', tr: '3D / AR Püskürtme Önizlemesi', fa: 'نمایش سه‌بعدی و واقعیت افزوده اسپری' },
  ai_opt_btn: { ar: 'توليد خطة تحسين ذكية للمطور', en: 'Generate AI Product Optimization Plan', fr: 'Générer un plan d’optimisation IA', es: 'Generar plan de optimización IA', it: 'Genera piano di ottimizzazione IA', de: 'KI-Produktoptimierung erstellen', ru: 'Создать план оптимизации ИИ', zh: '生成产品研发优化方案', tr: 'YZ Ürün İyileştirme Planı Üret', fa: 'تولید برنامه بهینه‌سازی هوشمند محصول' },
  ai_opt_loading: { ar: 'جارٍ هندسة التعديلات واشتقاق التحسينات...', en: 'Engineering optimization patches...', fr: 'Calcul des optimisations…', es: 'Calculando mejoras…', it: 'Calcolo ottimizzazioni…', de: 'Optimiere Formulierung…', ru: 'Расчёт улучшений…', zh: '正在推导配方优化方案……', tr: 'İyileştirmeler hesaplanıyor…', fa: 'در حال مهندسی پیشنهادهای بهبود...' },
  apply_patch: { ar: 'تطبيق على التجربة', en: 'Apply to Trial', fr: 'Appliquer', es: 'Aplicar', it: 'Applica', de: 'Anwenden', ru: 'Применить', zh: '应用到实验', tr: 'Deneye Uygula', fa: 'اعمال در آزمایش' },
  applied_patch: { ar: 'تم التطبيق', en: 'Applied', fr: 'Appliqué', es: 'Aplicado', it: 'Applicato', de: 'Angewendet', ru: 'Применено', zh: '已应用', tr: 'Uygulandı', fa: 'اعمال شد' },
} as const satisfies Record<string, LText>;

function statusTone(status: SafetyStatus) {
  if (status === 'pass') {
    return {
      pill: 'bg-emerald-50 border-emerald-300 text-emerald-900',
      text: 'text-emerald-700',
      stroke: '#059669',
      glyph: '●',
    };
  }
  if (status === 'caution') {
    return {
      pill: 'bg-amber-50 border-amber-300 text-amber-900',
      text: 'text-amber-700',
      stroke: '#d97706',
      glyph: '▲',
    };
  }
  return {
    pill: 'bg-rose-50 border-rose-300 text-rose-900',
    text: 'text-rose-700',
    stroke: '#e11d48',
    glyph: '✖',
  };
}

export const PerfumerDesignerLab: React.FC<PerfumerDesignerLabProps> = ({
  currentLang,
  formulaTitle,
  setFormulaTitle,
  formulation,
  setFormulation,
  pyramidNotes,
  setPyramidNotes,
  macerationDays,
  setMacerationDays,
  isStaticHosting,
  onSyncNotice,
  onOpenSaveModal,
  onOpenSpecModal,
  onNavigateToTab,
}) => {
  const rtl = isRTL(currentLang);
  const L = makeT(currentLang, S);

  // Isolated Live Sandbox State (seeded from current lab state, never breaks main lab until committed)
  const [trialTitle, setTrialTitle] = useState(formulaTitle);
  const [trialFormulation, setTrialFormulation] = useState<FormulationState>(() => ({ ...formulation }));
  const [trialNotes, setTrialNotes] = useState<PyramidNote[]>(() => pyramidNotes.map((n) => ({ ...n })));
  const [trialMacerationDays, setTrialMacerationDays] = useState<number>(macerationDays || 30);
  const [ambientTempC, setAmbientTempC] = useState<number>(26);
  const [humidityPct, setHumidityPct] = useState<number>(48);

  // Snapshot A for A/B experimental comparison
  const [baselineSnapshot, setBaselineSnapshot] = useState<{
    title: string;
    result: DesignerSimulationResult;
  } | null>(null);

  // UI & Stage controls
  const [activeStage, setActiveStage] = useState<SimStageTab>('vision');
  const [materialQuery, setMaterialQuery] = useState('');
  const [scrubIndex, setScrubIndex] = useState<number>(2); // 30m default probe
  const [show3DAR, setShow3DAR] = useState<boolean>(false);
  const [sprayCount, setSprayCount] = useState<number>(1);
  const [sprayBurstSeq, setSprayBurstSeq] = useState<number>(0);
  const [isContinuousSpray, setIsContinuousSpray] = useState<boolean>(false);
  const [sprayPulsePoint, setSprayPulsePoint] = useState<'wrist' | 'neck' | 'elbow'>('wrist');
  const [sprayView, setSprayView] = useState<'panorama' | 'micro' | 'aura'>('panorama');
  const [committedFlash, setCommittedFlash] = useState<boolean>(false);
  const [appliedPatchIds, setAppliedPatchIds] = useState<string[]>([]);

  // AI Product Optimizer state
  const [optGoal, setOptGoal] = useState<OptimizationGoal>('balanced_luxury');
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiOptResult, setAiOptResult] = useState<AiOptimizerResponse | null>(null);

  // Sample Wear Test Simulator state
  const [sampleSkinType, setSampleSkinType] = useState<SampleSkinType>('balanced');
  const [sampleWearScenario, setSampleWearScenario] = useState<SampleWearScenario>('evening_open');
  const [sampleAppTarget, setSampleAppTarget] = useState<SampleApplicationTarget>('skin_and_fabric');
  const [sampleSprayDose, setSampleSprayDose] = useState<number>(3);
  const [sampleReport, setSampleReport] = useState<SampleTestReport | null>(null);
  const [sampleFingerprint, setSampleFingerprint] = useState<string>('');

  const buildTrialFingerprint = () =>
    JSON.stringify({
      t: trialTitle,
      f: trialFormulation,
      m: trialMacerationDays,
      a: ambientTempC,
      h: humidityPct,
      s: sampleSkinType,
      w: sampleWearScenario,
      p: sampleAppTarget,
      d: sampleSprayDose,
      n: trialNotes.map((n) => `${n.nameEn}:${n.category}:${n.percentageOfOil}`),
    });

  const handleRunSampleTest = () => {
    const report = generateSampleTestReport({
      formulaTitle: trialTitle,
      formulation: trialFormulation,
      pyramidNotes: trialNotes,
      macerationDays: trialMacerationDays,
      ambientTempC,
      humidityPct,
      skinType: sampleSkinType,
      sprayCount: sampleSprayDose,
      wearScenario: sampleWearScenario,
      applicationTarget: sampleAppTarget,
    });
    setSampleReport(report);
    setSampleFingerprint(buildTrialFingerprint());
    setActiveStage('sample_test');
  };

  const isSampleReportStale =
    sampleReport !== null && sampleFingerprint !== buildTrialFingerprint();

  const sim: DesignerSimulationResult = useMemo(
    () =>
      evaluateDesignerTrial({
        formulation: trialFormulation,
        pyramidNotes: trialNotes,
        macerationDays: trialMacerationDays,
        ambientTempC,
        humidityPct,
      }),
    [trialFormulation, trialNotes, trialMacerationDays, ambientTempC, humidityPct],
  );

  const filteredMaterials = useMemo(() => {
    const q = materialQuery.trim().toLowerCase();
    const pool = RAW_MATERIALS_DATABASE.filter((m) => m.pyramidPlacement !== 'carrier');
    if (!q) return pool.slice(0, 8);
    return pool
      .filter(
        (m) =>
          m.nameAr.toLowerCase().includes(q) ||
          m.nameEn.toLowerCase().includes(q) ||
          m.casNumber.toLowerCase().includes(q) ||
          m.olfactoryFamily.toLowerCase().includes(q),
      )
      .slice(0, 10);
  }, [materialQuery]);

  const statusLabel = (s: SafetyStatus) =>
    s === 'pass' ? L('status_pass') : s === 'caution' ? L('status_caution') : L('status_fail');

  const tierLabel = (cat: 'top' | 'heart' | 'base') =>
    cat === 'top' ? L('tier_top') : cat === 'heart' ? L('tier_heart') : L('tier_base');

  const commitToMainLab = () => {
    setFormulaTitle(trialTitle);
    setFormulation(trialFormulation);
    setPyramidNotes(trialNotes);
    setMacerationDays(trialMacerationDays);
    setCommittedFlash(true);
    onSyncNotice?.(
      rtl
        ? `تم اعتماد تجربة «${trialTitle}» في المعمل الرئيسي بنجاح`
        : `Committed trial "${trialTitle}" to the main lab`,
    );
    setTimeout(() => setCommittedFlash(false), 2400);
  };

  const resetFromMainLab = () => {
    setTrialTitle(formulaTitle);
    setTrialFormulation({ ...formulation });
    setTrialNotes(pyramidNotes.map((n) => ({ ...n })));
    setTrialMacerationDays(macerationDays || 30);
    setAppliedPatchIds([]);
  };

  const applyPreset = (preset: StarterPreset) => {
    setTrialTitle(rtl ? preset.nameAr : preset.nameEn);
    setTrialFormulation((prev) => ({
      ...prev,
      concentrationPercent: preset.concentrationPercent,
      fixativePercent: preset.fixativePercent,
      waterPercent: preset.waterPercent,
    }));
    setTrialMacerationDays(preset.macerationDays);
    setTrialNotes(
      preset.notes.map((n, idx) => ({
        ...n,
        id: `preset-${preset.id}-${idx}-${Date.now()}`,
      })),
    );
    setAppliedPatchIds([]);
  };

  const addIngredientFromDb = (mat: (typeof RAW_MATERIALS_DATABASE)[number]) => {
    const placement: 'top' | 'heart' | 'base' =
      mat.pyramidPlacement === 'top' || mat.pyramidPlacement === 'heart' || mat.pyramidPlacement === 'base'
        ? mat.pyramidPlacement
        : 'heart';
    setTrialNotes((prev) => {
      const existingIdx = prev.findIndex(
        (p) => p.nameEn.toLowerCase() === mat.nameEn.toLowerCase() || p.nameAr === mat.nameAr,
      );
      if (existingIdx >= 0) {
        return prev.map((p, i) =>
          i === existingIdx ? { ...p, percentageOfOil: +(p.percentageOfOil + 4).toFixed(1) } : p,
        );
      }
      return [
        ...prev,
        {
          id: `trial-${mat.id}-${Date.now()}`,
          nameAr: mat.nameAr,
          nameEn: mat.nameEn,
          category: placement,
          percentageOfOil: 6,
        },
      ];
    });
    setMaterialQuery('');
  };

  const normalizeNotes = () => {
    const total = trialNotes.reduce((sum, n) => sum + (n.percentageOfOil || 0), 0);
    if (total <= 0) return;
    setTrialNotes((prev) =>
      prev.map((n) => ({
        ...n,
        percentageOfOil: +((n.percentageOfOil / total) * 100).toFixed(1),
      })),
    );
  };

  const applyDeterministicFix = (fix: DeveloperFixSuggestion) => {
    const p = fix.patch;
    if (p.type === 'set_formulation') {
      setTrialFormulation((prev) => ({ ...prev, ...p.updates }));
      if (p.macerationDays !== undefined) setTrialMacerationDays(p.macerationDays);
    } else if (p.type === 'scale_note') {
      const needle = p.noteNameMatch.toLowerCase();
      setTrialNotes((prev) =>
        prev.map((n) =>
          n.nameEn.toLowerCase().includes(needle) || n.nameAr.toLowerCase().includes(needle)
            ? { ...n, percentageOfOil: p.targetOilPercent }
            : n,
        ),
      );
    } else if (p.type === 'add_note') {
      setTrialNotes((prev) => [
        ...prev,
        {
          id: `fix-${Date.now()}`,
          nameAr: p.nameAr,
          nameEn: p.nameEn,
          category: p.category,
          percentageOfOil: p.percentageOfOil,
        },
      ]);
    }
    setAppliedPatchIds((prev) => [...prev, fix.id]);
  };

  const applyAiPatch = (patch: AiPatchItem) => {
    if (patch.actionType === 'adjust_carrier') {
      setTrialFormulation((prev) => ({
        ...prev,
        ...(patch.concentrationPercent !== undefined ? { concentrationPercent: patch.concentrationPercent } : {}),
        ...(patch.fixativePercent !== undefined ? { fixativePercent: patch.fixativePercent } : {}),
        ...(patch.waterPercent !== undefined ? { waterPercent: patch.waterPercent } : {}),
      }));
      if (patch.macerationDays !== undefined) setTrialMacerationDays(patch.macerationDays);
    } else if (patch.actionType === 'update_note' && (patch.noteNameEn || patch.noteNameAr)) {
      const nAr = (patch.noteNameAr || '').toLowerCase();
      const nEn = (patch.noteNameEn || '').toLowerCase();
      setTrialNotes((prev) => {
        const matched = prev.some(
          (n) => (nAr && n.nameAr.toLowerCase().includes(nAr)) || (nEn && n.nameEn.toLowerCase().includes(nEn)),
        );
        if (!matched) {
          return [
            ...prev,
            {
              id: `ai-note-${Date.now()}`,
              nameAr: patch.noteNameAr || patch.noteNameEn || 'Note',
              nameEn: patch.noteNameEn || patch.noteNameAr || 'Note',
              category: patch.category || 'heart',
              percentageOfOil: patch.targetPct ?? 6,
            },
          ];
        }
        return prev.map((n) =>
          (nAr && n.nameAr.toLowerCase().includes(nAr)) || (nEn && n.nameEn.toLowerCase().includes(nEn))
            ? { ...n, percentageOfOil: patch.targetPct ?? n.percentageOfOil }
            : n,
        );
      });
    } else if (patch.noteNameAr || patch.noteNameEn) {
      setTrialNotes((prev) => [
        ...prev,
        {
          id: `ai-add-${Date.now()}`,
          nameAr: patch.noteNameAr || patch.noteNameEn || 'Bridge Note',
          nameEn: patch.noteNameEn || patch.noteNameAr || 'Bridge Note',
          category: patch.category || 'heart',
          percentageOfOil: patch.targetPct ?? 6,
        },
      ]);
    }
    setAppliedPatchIds((prev) => [...prev, patch.id]);
  };

  const runAiOptimization = async () => {
    if (trialNotes.length === 0 || aiLoading) return;
    if (isStaticHosting) {
      setAiError(rtl ? 'التحسين الذكي يتطلب خادماً متصلاً.' : 'AI Optimization requires a live server.');
      return;
    }
    setAiLoading(true);
    setAiError(null);
    const safetySummary = `IFRA Score=${sim.ifraComplianceScore}/100, Clarity=${sim.clarityStatus}, Effective ABV=${sim.effectiveAbv}%, Failed IFRA notes=${
      sim.ifraRows.filter((r) => r.status === 'fail').map((r) => r.nameEn).join(', ') || 'None'
    }`;
    try {
      const res = await requestApi<AiOptimizerResponse>(
        '/api/ai/designer-optimize',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notes: trialNotes,
            formulaTitle: trialTitle,
            formulation: trialFormulation,
            macerationDays: trialMacerationDays,
            ambientTempC,
            humidityPct,
            goal: optGoal,
            safetySummary,
            language: currentLang,
          }),
        },
        45_000,
      );
      setAiOptResult(res);
    } catch (err) {
      if (err instanceof ApiUnavailableError) {
        setAiError(rtl ? 'هذه النسخة ثابتة للعرض ولا تتصل بالخادم.' : 'Static deployment cannot access live optimization.');
      } else if (err instanceof ApiError && err.code === 'MISSING_API_KEY') {
        setAiError(
          rtl
            ? 'مفتاح الذكاء الاصطناعي غير مضبوط على الخادم لتوليد اقتراحات المطور.'
            : 'Server AI key is not configured for developer optimization.',
        );
      } else {
        setAiError(rtl ? 'تعذر توليد خطة التحسين الآن، حاول مجدداً.' : 'Failed to generate optimization plan.');
      }
    } finally {
      setAiLoading(false);
    }
  };

  const readinessTone = statusTone(sim.readinessStatus);
  const safetyTone = statusTone(sim.safetyVerdict);
  const scrubbedPoint = sim.evaporationCurve[scrubIndex] || sim.evaporationCurve[0];

  // Radar SVG geometry
  const radarAxes: { key: keyof typeof sim.radar; labelAr: string; labelEn: string }[] = [
    { key: 'topRadiance', labelAr: 'بريق القمة', labelEn: 'Top Radiance' },
    { key: 'heartCohesion', labelAr: 'ترابط القلب', labelEn: 'Heart Cohesion' },
    { key: 'baseTenacity', labelAr: 'ثبات القاعدة', labelEn: 'Base Tenacity' },
    { key: 'sillageProjection', labelAr: 'قوة الفوحان', labelEn: 'Sillage' },
    { key: 'climateResilience', labelAr: 'تحمّل المناخ', labelEn: 'Climate Fit' },
    { key: 'solubilityClarity', labelAr: 'صفاء الذوبان', labelEn: 'Clarity' },
  ];

  const buildRadarPolygon = (scores: typeof sim.radar, cx: number, cy: number, maxR: number) =>
    radarAxes
      .map((ax, i) => {
        const angle = (Math.PI * 2 * i) / radarAxes.length - Math.PI / 2;
        const r = (scores[ax.key] / 100) * maxR;
        return `${(cx + Math.cos(angle) * r).toFixed(1)},${(cy + Math.sin(angle) * r).toFixed(1)}`;
      })
      .join(' ');

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} className="space-y-4">
      {/* 1. Top Telemetry & Command Ribbon */}
      <div className="bg-stone-950 text-stone-100 rounded-2xl border border-stone-800 px-4 py-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-stone-900 border border-amber-500/40 flex items-center justify-center shrink-0">
              <Compass className="w-5 h-5 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold text-white tracking-tight">
                {L('title')}
              </h1>
              <p className="text-xs text-stone-400 mt-0.5 max-w-3xl">{L('subtitle')}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRunSampleTest}
              className="px-3 py-1.5 rounded-lg bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <FlaskConical className="w-3.5 h-3.5 text-cyan-300" />
              <span>{L('sample_quick_btn')}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                baselineSnapshot
                  ? setBaselineSnapshot(null)
                  : setBaselineSnapshot({ title: trialTitle, result: sim })
              }
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 cursor-pointer transition-colors ${
                baselineSnapshot
                  ? 'bg-cyan-950 border-cyan-500/50 text-cyan-200'
                  : 'bg-stone-900 hover:bg-stone-800 border-stone-700 text-stone-200'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>{baselineSnapshot ? L('snap_clear') : L('snap_save')}</span>
            </button>

            <button
              type="button"
              onClick={commitToMainLab}
              className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              {committedFlash ? <Check className="w-3.5 h-3.5" /> : <FlaskConical className="w-3.5 h-3.5" />}
              <span>{committedFlash ? L('synced_ok') : L('sync_btn')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                commitToMainLab();
                onOpenSaveModal();
              }}
              className="px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-100 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <BookmarkPlus className="w-3.5 h-3.5 text-amber-400" />
              <span>{L('save_btn')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                commitToMainLab();
                onOpenSpecModal();
              }}
              className="px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-100 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-stone-300" />
              <span>{L('print_btn')}</span>
            </button>
          </div>
        </div>

        {/* Live Telemetry Strip */}
        <div className="pt-2.5 border-t border-stone-800 grid grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
          <div className="bg-stone-900/90 border border-stone-800 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
            <span className="text-stone-400">{L('readiness_lbl')}</span>
            <span className="font-mono tabular-nums font-bold text-white flex items-center gap-1.5">
              <span className={readinessTone.text}>{readinessTone.glyph}</span>
              <span>{sim.readinessScore}%</span>
            </span>
          </div>

          <div className="bg-stone-900/90 border border-stone-800 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
            <span className="text-stone-400">{L('ifra_lbl')}</span>
            <span className="font-mono tabular-nums font-bold text-white flex items-center gap-1.5">
              <span className={safetyTone.text}>{safetyTone.glyph}</span>
              <span>{sim.ifraComplianceScore}%</span>
            </span>
          </div>

          <div className="bg-stone-900/90 border border-stone-800 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
            <span className="text-stone-400">{L('longevity_lbl')}</span>
            <span className="font-mono tabular-nums font-bold text-amber-300">
              {sim.estimatedLongevityHours}h
              {baselineSnapshot && (
                <span className="text-[10px] ms-1 text-cyan-300">
                  ({sim.estimatedLongevityHours - baselineSnapshot.result.estimatedLongevityHours >= 0 ? '+' : ''}
                  {(sim.estimatedLongevityHours - baselineSnapshot.result.estimatedLongevityHours).toFixed(1)}h)
                </span>
              )}
            </span>
          </div>

          <div className="bg-stone-900/90 border border-stone-800 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
            <span className="text-stone-400">{L('projection_lbl')}</span>
            <span className="font-mono tabular-nums font-bold text-cyan-300">
              {sim.peakProjectionMeters} m
            </span>
          </div>

          <div className="col-span-2 lg:col-span-1 bg-stone-900/90 border border-stone-800 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
            <span className="text-stone-400">T : H : B</span>
            <span className="font-mono tabular-nums font-bold text-stone-200">
              {Math.round(sim.normalizedTiers.top)} : {Math.round(sim.normalizedTiers.heart)} : {Math.round(sim.normalizedTiers.base)}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Asymmetric Split Console: Left Experimentation Deck + Right Simulation Stage */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* LEFT COLUMN: Experimentation Bench */}
        <aside className="xl:col-span-4 bg-white rounded-2xl border border-stone-200 p-4 space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-700" />
              <h2 className="text-sm font-bold text-stone-950">{L('bench_title')}</h2>
            </div>
            <button
              type="button"
              onClick={resetFromMainLab}
              className="text-[11px] font-semibold text-stone-600 hover:text-stone-900 flex items-center gap-1 cursor-pointer"
              title={rtl ? 'استرجاع قيم المعمل الحالي' : 'Reset from main lab'}
            >
              <RotateCcw className="w-3 h-3" />
              <span>{rtl ? 'مزامنة من المعمل' : 'Reset'}</span>
            </button>
          </div>

          {/* Trial Title + Quick Starters */}
          <div className="space-y-2">
            <input
              type="text"
              value={trialTitle}
              onChange={(e) => setTrialTitle(e.target.value)}
              maxLength={90}
              className="w-full px-3 py-2 rounded-lg bg-stone-50 border border-stone-200 text-xs font-bold text-stone-900 focus:outline-none focus:border-amber-600"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-stone-500 font-medium">{L('starters_lbl')}</span>
              {STARTER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="px-2 py-1 rounded-md bg-stone-100 hover:bg-amber-50 border border-stone-200 text-[11px] font-medium text-stone-700 hover:text-amber-900 cursor-pointer transition-colors"
                >
                  {rtl ? preset.nameAr : preset.nameEn}
                </button>
              ))}
            </div>
          </div>

          {/* Carrier & Climate Calibration Sliders */}
          <div className="space-y-3 pt-2 border-t border-stone-100">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-stone-600">{L('bottle_lbl')}</span>
                  <span className="font-mono tabular-nums font-bold text-stone-900">{trialFormulation.bottleVolumeMl} ml</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={200}
                  step={5}
                  value={trialFormulation.bottleVolumeMl}
                  onChange={(e) => setTrialFormulation((p) => ({ ...p, bottleVolumeMl: Number(e.target.value) }))}
                  className="w-full accent-amber-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-stone-600">{L('conc_lbl')}</span>
                  <span className="font-mono tabular-nums font-bold text-amber-800">{trialFormulation.concentrationPercent}%</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={45}
                  step={1}
                  value={trialFormulation.concentrationPercent}
                  onChange={(e) => setTrialFormulation((p) => ({ ...p, concentrationPercent: Number(e.target.value) }))}
                  className="w-full accent-amber-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-stone-600">{L('ethanol_lbl')}</span>
                  <span className="font-mono tabular-nums font-bold text-stone-900">{trialFormulation.alcoholPercentage}%</span>
                </div>
                <input
                  type="range"
                  min={80}
                  max={99}
                  step={1}
                  value={trialFormulation.alcoholPercentage}
                  onChange={(e) => setTrialFormulation((p) => ({ ...p, alcoholPercentage: Number(e.target.value) }))}
                  className="w-full accent-cyan-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-stone-600">{L('water_lbl')}</span>
                  <span className="font-mono tabular-nums font-bold text-stone-900">{trialFormulation.waterPercent}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={0.5}
                  value={trialFormulation.waterPercent}
                  onChange={(e) => setTrialFormulation((p) => ({ ...p, waterPercent: Number(e.target.value) }))}
                  className="w-full accent-cyan-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-stone-600">{L('fixative_lbl')}</span>
                  <span className="font-mono tabular-nums font-bold text-stone-900">{trialFormulation.fixativePercent}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={6}
                  step={0.2}
                  value={trialFormulation.fixativePercent}
                  onChange={(e) => setTrialFormulation((p) => ({ ...p, fixativePercent: Number(e.target.value) }))}
                  className="w-full accent-amber-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-stone-600">{L('maceration_lbl')}</span>
                  <span className="font-mono tabular-nums font-bold text-stone-900">{trialMacerationDays}d</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={90}
                  step={1}
                  value={trialMacerationDays}
                  onChange={(e) => setTrialMacerationDays(Number(e.target.value))}
                  className="w-full accent-amber-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-stone-600">{L('temp_lbl')}</span>
                  <span className="font-mono tabular-nums font-bold text-stone-900">{ambientTempC}°C</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={45}
                  step={1}
                  value={ambientTempC}
                  onChange={(e) => setAmbientTempC(Number(e.target.value))}
                  className="w-full accent-rose-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-stone-600">{L('humidity_lbl')}</span>
                  <span className="font-mono tabular-nums font-bold text-stone-900">{humidityPct}%</span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={90}
                  step={5}
                  value={humidityPct}
                  onChange={(e) => setHumidityPct(Number(e.target.value))}
                  className="w-full accent-cyan-600 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Interactive Notes Dosing Bench */}
          <div className="space-y-2.5 pt-2 border-t border-stone-100">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900">
                <Droplets className="w-3.5 h-3.5 text-amber-700" />
                <span>{L('notes_bench_lbl')}</span>
                <span className="font-mono tabular-nums text-stone-500">({sim.tierTotals.total}%)</span>
              </div>
              <button
                type="button"
                onClick={normalizeNotes}
                disabled={trialNotes.length === 0}
                className="px-2 py-1 rounded-md bg-stone-100 hover:bg-stone-200 text-[11px] font-semibold text-stone-700 cursor-pointer disabled:opacity-40"
              >
                {L('normalize_btn')}
              </button>
            </div>

            {/* Search Raw Materials DB */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute top-2.5 start-3" />
              <input
                type="text"
                value={materialQuery}
                onChange={(e) => setMaterialQuery(e.target.value)}
                placeholder={L('add_material_ph')}
                className="w-full ps-8 pe-3 py-2 rounded-lg bg-stone-50 border border-stone-200 text-xs text-stone-900 focus:outline-none focus:border-amber-600"
              />
              {materialQuery.trim().length > 0 && (
                <div className="mt-1 max-h-48 overflow-y-auto rounded-xl border border-stone-200 bg-white divide-y divide-stone-100">
                  {filteredMaterials.map((mat) => (
                    <button
                      key={mat.id}
                      type="button"
                      onClick={() => addIngredientFromDb(mat)}
                      className="w-full px-3 py-2 text-start hover:bg-amber-50 flex items-center justify-between gap-2 text-xs cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-stone-900 truncate">
                          {rtl ? mat.nameAr : mat.nameEn}
                        </div>
                        <div className="text-[10px] font-mono text-stone-500">
                          CAS {mat.casNumber} · {mat.pyramidPlacement}
                        </div>
                      </div>
                      <Plus className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    </button>
                  ))}
                  {filteredMaterials.length === 0 && (
                    <div className="px-3 py-2 text-xs text-stone-500">
                      {rtl ? 'لا توجد مادة مطابقة' : 'No matching material'}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick pick chips when query empty */}
            {!materialQuery.trim() && (
              <div className="flex flex-wrap gap-1">
                {filteredMaterials.slice(0, 5).map((mat) => (
                  <button
                    key={mat.id}
                    type="button"
                    onClick={() => addIngredientFromDb(mat)}
                    className="px-2 py-1 rounded-md bg-stone-50 hover:bg-amber-50 border border-stone-200 text-[10px] font-medium text-stone-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-2.5 h-2.5 text-amber-700" />
                    <span className="truncate max-w-[130px]">{rtl ? mat.nameAr.split('(')[0] : mat.nameEn.split('(')[0]}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Active Notes List */}
            <div className="space-y-2 max-h-[340px] overflow-y-auto pe-1">
              {trialNotes.map((note) => (
                <div
                  key={note.id}
                  className="p-2.5 rounded-xl border border-stone-200 bg-stone-50/70 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-stone-900 truncate">
                      {rtl ? note.nameAr || note.nameEn : note.nameEn || note.nameAr}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <select
                        value={note.category}
                        onChange={(e) => {
                          const cat = e.target.value as 'top' | 'heart' | 'base';
                          setTrialNotes((prev) =>
                            prev.map((n) => (n.id === note.id ? { ...n, category: cat } : n)),
                          );
                        }}
                        className="px-1.5 py-0.5 rounded border border-stone-200 bg-white text-[10px] font-semibold text-stone-700"
                      >
                        <option value="top">{L('tier_top')}</option>
                        <option value="heart">{L('tier_heart')}</option>
                        <option value="base">{L('tier_base')}</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setTrialNotes((prev) => prev.filter((n) => n.id !== note.id))}
                        className="p-1 text-stone-400 hover:text-rose-600 cursor-pointer"
                        aria-label="Remove note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0.5}
                      max={60}
                      step={0.5}
                      value={note.percentageOfOil}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setTrialNotes((prev) =>
                          prev.map((n) => (n.id === note.id ? { ...n, percentageOfOil: val } : n)),
                        );
                      }}
                      className="flex-1 accent-amber-600 cursor-pointer"
                    />
                    <span className="w-12 text-end font-mono tabular-nums text-xs font-bold text-stone-900">
                      {note.percentageOfOil}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* RIGHT COLUMN: Multi-Instrument Simulation Stage */}
        <section className="xl:col-span-8 space-y-4">
          {/* Stage Navigation Bar */}
          <div className="bg-white rounded-2xl border border-stone-200 p-1.5 flex flex-wrap gap-1.5">
            {(
              [
                { id: 'vision', label: L('tab_vision'), Icon: Eye },
                { id: 'sample_test', label: L('tab_sample_test'), Icon: FlaskConical },
                { id: 'pyramid', label: L('tab_pyramid'), Icon: Layers },
                { id: 'safety', label: L('tab_safety'), Icon: ShieldCheck },
                { id: 'optimizer', label: L('tab_optimizer'), Icon: Wrench },
              ] as const
            ).map(({ id, label, Icon }) => {
              const active = activeStage === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveStage(id)}
                  className={`flex-1 min-w-[130px] px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-stone-950 text-amber-300'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{label}</span>
                  {id === 'sample_test' && sampleReport && (
                    <span className="font-mono tabular-nums text-[10px] opacity-80">
                      {sampleReport.longevityHours}h
                    </span>
                  )}
                  {id === 'safety' && sim.safetyVerdict === 'fail' && (
                    <span className="text-rose-400 font-mono">!</span>
                  )}
                  {id === 'optimizer' && sim.suggestions.length > 0 && (
                    <span className="font-mono tabular-nums opacity-80">({sim.suggestions.length})</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* STAGE 1: Pre-Execution Vision, Solubility & Evaporation Kinetics */}
          {activeStage === 'vision' && (
            <div className="space-y-4">
              {/* Flacon Phase Clarity & Gravimetric Breakdown */}
              <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Beaker className="w-4 h-4 text-amber-700" />
                    <h3 className="text-sm font-bold text-stone-950">{L('clarity_title')}</h3>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-lg border text-xs font-bold flex items-center gap-1.5 ${
                      statusTone(sim.clarityStatus).pill
                    }`}
                  >
                    <span>{statusTone(sim.clarityStatus).glyph}</span>
                    <span>{statusLabel(sim.clarityStatus)}</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  {/* Visual SVG Flacon Phase Meter */}
                  <div className="md:col-span-4 flex flex-col items-center justify-center p-3 rounded-xl bg-stone-50 border border-stone-200">
                    <svg viewBox="0 0 140 165" className="w-32 h-36">
                      {/* Cap */}
                      <rect x="52" y="10" width="36" height="18" rx="3" fill="#292524" />
                      <rect x="58" y="28" width="24" height="10" fill="#a8a29e" />
                      {/* Bottle shell */}
                      <rect
                        x="28"
                        y="38"
                        width="84"
                        height="114"
                        rx="12"
                        fill={sim.clarityStatus === 'fail' ? '#fef3c7' : '#fffbeb'}
                        stroke="#78716c"
                        strokeWidth="2"
                      />
                      {/* Ethanol Phase */}
                      <rect
                        x="32"
                        y="56"
                        width="76"
                        height="92"
                        rx="8"
                        fill={sim.clarityStatus === 'pass' ? '#fef9c3' : sim.clarityStatus === 'caution' ? '#fde68a' : '#d6d3d1'}
                        opacity={sim.clarityStatus === 'pass' ? 0.55 : 0.85}
                      />
                      {/* Oil Strata at base */}
                      <rect
                        x="32"
                        y={Math.max(66, 148 - Math.round((sim.calculation.oilPercent / 50) * 65))}
                        width="76"
                        height={Math.min(82, Math.round((sim.calculation.oilPercent / 50) * 65))}
                        rx="6"
                        fill="#d97706"
                        opacity="0.72"
                      />
                      <text x="70" y="108" textAnchor="middle" fontSize="11" fontWeight="700" fill="#1c1917">
                        {sim.effectiveAbv}% ABV
                      </text>
                    </svg>
                    <div className="text-[11px] font-mono tabular-nums text-stone-600 mt-1">
                      {rtl ? `الترشيح البارد: ${sim.chillFilterTempC}°C` : `Chill-filter: ${sim.chillFilterTempC}°C`}
                    </div>
                  </div>

                  {/* Gravimetric Telemetry Grid */}
                  <div className="md:col-span-8 space-y-3">
                    <p className="text-xs text-stone-700 leading-relaxed">
                      {rtl ? sim.clarityRiskAr : sim.clarityRiskEn}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono tabular-nums">
                      <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200">
                        <div className="text-[10px] text-stone-500">{rtl ? 'الزيت العطري' : 'Fragrance Oil'}</div>
                        <div className="text-sm font-bold text-amber-800">{formatNum(sim.calculation.oilWeightGrams, 2)} g</div>
                        <div className="text-[10px] text-stone-500">~{sim.totalOilDrops} {rtl ? 'قطرة' : 'drops'}</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200">
                        <div className="text-[10px] text-stone-500">{rtl ? 'الكحول الإيثيلي' : 'Ethanol'}</div>
                        <div className="text-sm font-bold text-stone-900">{formatNum(sim.calculation.alcoholWeightGrams, 2)} g</div>
                        <div className="text-[10px] text-stone-500">{formatNum(sim.calculation.alcoholVolumeMl, 1)} ml</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200">
                        <div className="text-[10px] text-stone-500">{rtl ? 'المثبت والماء' : 'Fixative & Water'}</div>
                        <div className="text-sm font-bold text-stone-900">
                          {formatNum(sim.calculation.fixativeWeightGrams + sim.calculation.waterWeightGrams, 2)} g
                        </div>
                        <div className="text-[10px] text-stone-500">
                          {trialFormulation.fixativePercent}% / {trialFormulation.waterPercent}%
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200">
                        <div className="text-[10px] text-stone-500">{rtl ? 'إجمالي الزجاجة' : 'Total Mass'}</div>
                        <div className="text-sm font-bold text-stone-950">{formatNum(sim.calculation.totalWeightGrams, 2)} g</div>
                        <div className="text-[10px] text-stone-500">{trialFormulation.bottleVolumeMl} ml</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 12-Hour Interactive Evaporation & Sillage Curve */}
              <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Wind className="w-4 h-4 text-cyan-700" />
                    <h3 className="text-sm font-bold text-stone-950">{L('evap_title')}</h3>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-medium">
                    <span className="flex items-center gap-1 text-amber-700">● {L('tier_top')}</span>
                    <span className="flex items-center gap-1 text-rose-700">● {L('tier_heart')}</span>
                    <span className="flex items-center gap-1 text-stone-800">● {L('tier_base')}</span>
                    <span className="flex items-center gap-1 text-cyan-700">— {rtl ? 'الفوحان' : 'Sillage'}</span>
                  </div>
                </div>

                <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                  <svg viewBox="0 0 640 210" className="w-full h-48 overflow-visible">
                    {[0, 25, 50, 75, 100].map((v) => {
                      const y = 175 - (v / 100) * 150;
                      return (
                        <g key={v}>
                          <line x1="36" y1={y} x2="620" y2={y} stroke="#e7e5e4" strokeDasharray="3 3" />
                          <text x="6" y={y + 4} fontSize="10" fill="#78716c" className="font-mono">
                            {v}%
                          </text>
                        </g>
                      );
                    })}
                    {(() => {
                      const xAt = (idx: number) => 42 + (idx / (sim.evaporationCurve.length - 1)) * 572;
                      const yAt = (val: number) => 175 - (val / 100) * 150;
                      const poly = (picker: (p: (typeof sim.evaporationCurve)[number]) => number) =>
                        sim.evaporationCurve.map((pt, i) => `${xAt(i).toFixed(1)},${yAt(picker(pt)).toFixed(1)}`).join(' ');

                      const probeX = xAt(scrubIndex);
                      return (
                        <>
                          <polyline fill="none" stroke="#d97706" strokeWidth="2.2" points={poly((p) => p.topIntensity)} />
                          <polyline fill="none" stroke="#e11d48" strokeWidth="2.2" points={poly((p) => p.heartIntensity)} />
                          <polyline fill="none" stroke="#292524" strokeWidth="2.4" points={poly((p) => p.baseIntensity)} />
                          <polyline fill="none" stroke="#0891b2" strokeWidth="2.6" strokeDasharray="5 3" points={poly((p) => p.compositeSillage)} />
                          <line x1={probeX} y1="20" x2={probeX} y2="178" stroke="#0891b2" strokeWidth="1.5" />
                          {sim.evaporationCurve.map((pt, i) => (
                            <g key={pt.label}>
                              <circle
                                cx={xAt(i)}
                                cy={yAt(pt.compositeSillage)}
                                r={i === scrubIndex ? 5 : 2.5}
                                fill="#0891b2"
                              />
                              <text x={xAt(i)} y="196" textAnchor="middle" fontSize="10" fill="#57534e" className="font-mono">
                                {pt.label}
                              </text>
                            </g>
                          ))}
                        </>
                      );
                    })()}
                  </svg>

                  {/* Interactive Minute Scrubber */}
                  <div className="pt-2 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-[220px]">
                      <span className="text-xs font-semibold text-stone-700 whitespace-nowrap">
                        {rtl ? 'مسح زمني:' : 'Time Probe:'}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={sim.evaporationCurve.length - 1}
                        step={1}
                        value={scrubIndex}
                        onChange={(e) => setScrubIndex(Number(e.target.value))}
                        className="flex-1 accent-cyan-600 cursor-pointer"
                      />
                    </div>
                    {scrubbedPoint && (
                      <div className="flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums">
                        <span className="font-bold text-stone-950">{scrubbedPoint.label}</span>
                        <span className="text-amber-700">T:{scrubbedPoint.topIntensity}%</span>
                        <span className="text-rose-700">H:{scrubbedPoint.heartIntensity}%</span>
                        <span className="text-stone-800">B:{scrubbedPoint.baseIntensity}%</span>
                        <span className="text-cyan-800 font-bold">
                          {rtl ? 'مدى الهالة:' : 'Aura:'} {scrubbedPoint.projectionMeters}m
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Embedded 3D / AR Atomization Viewport Toggle */}
              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-stone-100">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-700" />
                    <span className="text-xs sm:text-sm font-bold text-stone-900">{L('toggle_3d_ar')}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShow3DAR((v) => !v)}
                    className="px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-amber-300 text-xs font-bold cursor-pointer"
                  >
                    {show3DAR ? (rtl ? 'إخفاء المنظار 3D' : 'Hide 3D Stage') : (rtl ? 'تشغيل المحاكي 3D / AR' : 'Launch 3D / AR')}
                  </button>
                </div>
                {show3DAR && (
                  <div className="p-3 bg-stone-950 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        {(['wrist', 'neck', 'elbow'] as const).map((pt) => (
                          <button
                            key={pt}
                            type="button"
                            onClick={() => setSprayPulsePoint(pt)}
                            className={`px-2 py-1 rounded border font-semibold cursor-pointer ${
                              sprayPulsePoint === pt
                                ? 'bg-amber-500 text-stone-950 border-amber-400'
                                : 'bg-stone-900 text-stone-300 border-stone-700 hover:border-stone-500'
                            }`}
                          >
                            {pt === 'wrist' ? (rtl ? 'المعصم' : 'Wrist') : pt === 'neck' ? (rtl ? 'العنق' : 'Neck') : (rtl ? 'المرفق' : 'Elbow')}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {(['panorama', 'micro', 'aura'] as const).map((vw) => (
                          <button
                            key={vw}
                            type="button"
                            onClick={() => setSprayView(vw)}
                            className={`px-2 py-1 rounded border font-semibold cursor-pointer ${
                              sprayView === vw
                                ? 'bg-cyan-500 text-stone-950 border-cyan-400'
                                : 'bg-stone-900 text-stone-300 border-stone-700 hover:border-stone-500'
                            }`}
                          >
                            {vw === 'panorama' ? (rtl ? 'بانوراما' : 'Panorama') : vw === 'micro' ? (rtl ? 'ميكرو جلد' : 'Skin Micro') : (rtl ? 'الهالة' : 'Aura')}
                          </button>
                        ))}
                      </div>
                    </div>
                    <SprayKineticsAR3D
                      currentLang={currentLang}
                      activeView={sprayView}
                      pulsePoint={sprayPulsePoint}
                      skinTemp={Math.min(39, Math.max(33, 35.4 + (ambientTempC - 25) * 0.14))}
                      sprayCount={sprayCount}
                      sprayBurstSeq={sprayBurstSeq}
                      isContinuous={isContinuousSpray}
                      sillageRadiusMeters={scrubbedPoint?.projectionMeters ?? sim.peakProjectionMeters}
                      alcoholRemainingPct={Math.max(0, Math.round(100 - scrubIndex * 11))}
                      oilRemainingOnSkinPct={scrubbedPoint?.compositeSillage ?? 70}
                      onTriggerSpray={() => {
                        setSprayCount((c) => c + 1);
                        setSprayBurstSeq((s) => s + 1);
                        setScrubIndex(0);
                      }}
                      onToggleContinuous={() => setIsContinuousSpray((v) => !v)}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STAGE 1B: Sample Wear & Projection Test Simulator + Graphical Report */}
          {activeStage === 'sample_test' && (
            <div className="space-y-4">
              {/* Sample Test Parameters Deck */}
              <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-stone-950 flex items-center gap-2">
                      <FlaskConical className="w-4 h-4 text-amber-700" />
                      <span>
                        {rtl ? 'محاكاة اختبار العينة المعملي (ثبات العطر وانتشاره)' : 'Virtual Sample Wear & Projection Simulator'}
                      </span>
                    </h3>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      {rtl
                        ? 'حدّد ظروف اختبار العينة ثم أنشئ تقريراً رسومياً شاملاً بناءً على المكونات والتركيز المختارين.'
                        : 'Configure sample testing parameters and generate a graphical longevity & projection report from your active ingredients.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleRunSampleTest}
                    disabled={trialNotes.length === 0}
                    className="px-4 py-2 rounded-xl bg-stone-950 hover:bg-stone-800 disabled:opacity-40 text-amber-300 text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <FlaskConical className="w-3.5 h-3.5" />
                    <span>
                      {isSampleReportStale
                        ? rtl
                          ? 'تحديث تقرير العينة بالمكونات الجديدة'
                          : 'Refresh Report for Updated Formula'
                        : L('sample_run_btn')}
                    </span>
                  </button>
                </div>

                {/* Test Parameters Matrix */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-stone-600 block">
                      {rtl ? 'نوع البشرة المختبرة' : 'Test Skin Chemistry'}
                    </label>
                    <div className="grid grid-cols-3 gap-1 p-1 bg-stone-100 rounded-lg">
                      {(
                        [
                          { id: 'dry', ar: 'جافة', en: 'Dry' },
                          { id: 'balanced', ar: 'متوازنة', en: 'Normal' },
                          { id: 'oily', ar: 'دهنية', en: 'Oily' },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setSampleSkinType(opt.id)}
                          className={`py-1.5 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                            sampleSkinType === opt.id
                              ? 'bg-white text-stone-950 shadow-2xs font-bold'
                              : 'text-stone-600 hover:text-stone-900'
                          }`}
                        >
                          {rtl ? opt.ar : opt.en}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-stone-600 block">
                      {rtl ? 'سيناريو الارتداء والمناخ' : 'Wear Environment'}
                    </label>
                    <select
                      value={sampleWearScenario}
                      onChange={(e) => setSampleWearScenario(e.target.value as SampleWearScenario)}
                      className="w-full px-2.5 py-2 rounded-lg border border-stone-200 bg-stone-50 text-xs font-semibold text-stone-800"
                    >
                      <option value="indoor_ac">{rtl ? 'مكتب / قاعة مكيفة (21°C)' : 'Indoor A/C (21°C)'}</option>
                      <option value="evening_open">{rtl ? 'سهرة ومكان مفتوح (24°C)' : 'Open Evening Breeze (24°C)'}</option>
                      <option value="humid_summer">{rtl ? 'صيف حار ورطب (+33°C)' : 'Warm Humid Summer (+33°C)'}</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-stone-600 block">
                      {rtl ? 'نطاق الرش والاختبار' : 'Application Surface'}
                    </label>
                    <div className="grid grid-cols-2 gap-1 p-1 bg-stone-100 rounded-lg">
                      {(
                        [
                          { id: 'skin_only', ar: 'بشرة فقط', en: 'Skin Only' },
                          { id: 'skin_and_fabric', ar: 'بشرة + قماش', en: 'Skin + Cloth' },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setSampleAppTarget(opt.id)}
                          className={`py-1.5 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                            sampleAppTarget === opt.id
                              ? 'bg-white text-stone-950 shadow-2xs font-bold'
                              : 'text-stone-600 hover:text-stone-900'
                          }`}
                        >
                          {rtl ? opt.ar : opt.en}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] font-semibold text-stone-600">
                      <span>{rtl ? 'جرعة الاختبار (بخات)' : 'Sample Dose'}</span>
                      <span className="font-mono tabular-nums font-bold text-stone-950">
                        {sampleSprayDose} {rtl ? 'بخات' : 'sprays'}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={6}
                      step={1}
                      value={sampleSprayDose}
                      onChange={(e) => setSampleSprayDose(Number(e.target.value))}
                      className="w-full accent-amber-600 cursor-pointer mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Generated Graphical Sample Test Report */}
              {!sampleReport ? (
                <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center mx-auto">
                    <FlaskConical className="w-6 h-6 text-amber-700" />
                  </div>
                  <div className="space-y-1 max-w-md mx-auto">
                    <h4 className="text-sm font-bold text-stone-950">
                      {rtl ? 'جاهز لإجراء اختبار العينة الافتراضي' : 'Ready to Simulate Sample Wear Test'}
                    </h4>
                    <p className="text-xs text-stone-600">
                      {rtl
                        ? 'اضغط على «توليد تقرير اختبار العينة الافتراضي» أعلاه لتحليل الثبات بالساعات، مدى الانتشار بالمتر، ومساهمة كل مكوّن في رسم بياني متكامل.'
                        : 'Click "Generate Sample Wear Report" above to plot hourly longevity, spatial projection halo, and ingredient-by-ingredient performance.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRunSampleTest}
                    disabled={trialNotes.length === 0}
                    className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-stone-950 text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
                  >
                    <FlaskConical className="w-4 h-4" />
                    <span>{L('sample_run_btn')}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Report Summary Metadata Strip */}
                  <div className="bg-stone-950 text-stone-100 rounded-2xl border border-stone-800 p-4 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2 font-mono text-stone-400">
                        <span className="text-amber-300 font-bold">{sampleReport.reportCode}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-sans text-stone-200 font-semibold">{sampleReport.formulaTitle}</span>
                        <span aria-hidden="true">·</span>
                        <span>{sampleReport.noteCount} {rtl ? 'مكوّن' : 'notes'}</span>
                      </div>
                      {isSampleReportStale && (
                        <button
                          type="button"
                          onClick={handleRunSampleTest}
                          className="text-[11px] font-bold text-cyan-300 hover:text-cyan-200 underline cursor-pointer"
                        >
                          {rtl ? 'المكونات تغيرت — اضغط للتحديث' : 'Formula changed — Refresh'}
                        </button>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-stone-200 leading-relaxed">
                      {rtl ? sampleReport.verdictSummaryAr : sampleReport.verdictSummaryEn}
                    </p>
                    <p className="text-[11px] text-amber-300/95">
                      {rtl ? `توصية الاختبار: ${sampleReport.actionableTipAr}` : `Sample Note: ${sampleReport.actionableTipEn}`}
                    </p>
                  </div>

                  {/* Dual Radial SVG Gauges + Concentric Projection Halo Diagram */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Dual Gauges Card */}
                    <div className="lg:col-span-7 bg-white rounded-2xl border border-stone-200 p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Longevity Radial Gauge SVG */}
                      <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex flex-col items-center text-center space-y-2">
                        <div className="text-xs font-bold text-stone-900">
                          {rtl ? 'مؤشر ثبات العطر (Longevity)' : 'Fragrance Longevity'}
                        </div>
                        <svg viewBox="0 0 160 120" className="w-40 h-28">
                          <path
                            d="M 22 98 A 58 58 0 0 1 138 98"
                            fill="none"
                            stroke="#e7e5e4"
                            strokeWidth="12"
                            strokeLinecap="round"
                          />
                          <path
                            d="M 22 98 A 58 58 0 0 1 138 98"
                            fill="none"
                            stroke="#d97706"
                            strokeWidth="12"
                            strokeLinecap="round"
                            strokeDasharray={`${((sampleReport.longevityScore / 100) * 182.2).toFixed(1)} 182.2`}
                          />
                          <text x="80" y="74" textAnchor="middle" fontSize="22" fontWeight="800" fill="#1c1917" className="font-mono">
                            {sampleReport.longevityHours}h
                          </text>
                          <text x="80" y="94" textAnchor="middle" fontSize="11" fontWeight="700" fill="#b45309" className="font-mono">
                            {sampleReport.longevityScore}/100
                          </text>
                        </svg>
                        <div className="text-xs font-bold text-amber-800">
                          {rtl ? sampleReport.longevityGradeAr : sampleReport.longevityGradeEn}
                        </div>
                        <div className="text-[11px] font-mono tabular-nums text-stone-600">
                          {rtl
                            ? `بشرة ${sampleReport.skinFadeHour}س · قماش ${sampleReport.clothingResidualHours}س`
                            : `Skin ${sampleReport.skinFadeHour}h · Cloth ${sampleReport.clothingResidualHours}h`}
                        </div>
                      </div>

                      {/* Projection Radial Gauge SVG */}
                      <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex flex-col items-center text-center space-y-2">
                        <div className="text-xs font-bold text-stone-900">
                          {rtl ? 'مؤشر الانتشار والفوحان (Projection)' : 'Spatial Projection'}
                        </div>
                        <svg viewBox="0 0 160 120" className="w-40 h-28">
                          <path
                            d="M 22 98 A 58 58 0 0 1 138 98"
                            fill="none"
                            stroke="#e7e5e4"
                            strokeWidth="12"
                            strokeLinecap="round"
                          />
                          <path
                            d="M 22 98 A 58 58 0 0 1 138 98"
                            fill="none"
                            stroke="#0891b2"
                            strokeWidth="12"
                            strokeLinecap="round"
                            strokeDasharray={`${((sampleReport.projectionScore / 100) * 182.2).toFixed(1)} 182.2`}
                          />
                          <text x="80" y="74" textAnchor="middle" fontSize="22" fontWeight="800" fill="#1c1917" className="font-mono">
                            {sampleReport.peakProjectionMeters}m
                          </text>
                          <text x="80" y="94" textAnchor="middle" fontSize="11" fontWeight="700" fill="#0e7490" className="font-mono">
                            {sampleReport.projectionScore}/100
                          </text>
                        </svg>
                        <div className="text-xs font-bold text-cyan-800">
                          {rtl ? sampleReport.projectionGradeAr : sampleReport.projectionGradeEn}
                        </div>
                        <div className="text-[11px] font-mono tabular-nums text-stone-600">
                          {rtl
                            ? `ذروة ${sampleReport.peakWindowMinutes}د · استقرار ${sampleReport.settledProjectionMeters}م`
                            : `Peak @${sampleReport.peakWindowMinutes}m · Settled ${sampleReport.settledProjectionMeters}m`}
                        </div>
                      </div>
                    </div>

                    {/* Concentric Aura Projection Map SVG */}
                    <div className="lg:col-span-5 bg-white rounded-2xl border border-stone-200 p-4 flex flex-col items-center justify-between space-y-2">
                      <div className="w-full flex items-center justify-between text-xs">
                        <span className="font-bold text-stone-900">
                          {rtl ? 'خريطة هالة الانتشار المكاني' : 'Spatial Diffusion Halo Map'}
                        </span>
                        <span className="font-mono tabular-nums text-stone-500">0 – 3.0 m</span>
                      </div>
                      <svg viewBox="0 0 220 200" className="w-full max-w-[220px] h-44">
                        {[1, 2, 3].map((mRing) => {
                          const r = (mRing / 3) * 82;
                          return (
                            <g key={mRing}>
                              <circle
                                cx="110"
                                cy="100"
                                r={r}
                                fill="none"
                                stroke="#e7e5e4"
                                strokeDasharray="3 3"
                              />
                              <text x="110" y={100 - r - 3} textAnchor="middle" fontSize="9" fill="#78716c" className="font-mono">
                                {mRing}m
                              </text>
                            </g>
                          );
                        })}
                        {/* Peak Projection Circle */}
                        <circle
                          cx="110"
                          cy="100"
                          r={Math.min(84, (sampleReport.peakProjectionMeters / 3) * 82)}
                          fill="rgba(217, 119, 6, 0.18)"
                          stroke="#d97706"
                          strokeWidth="2"
                        />
                        {/* Settled 3-4h Aura Circle */}
                        <circle
                          cx="110"
                          cy="100"
                          r={Math.min(84, (sampleReport.settledProjectionMeters / 3) * 82)}
                          fill="rgba(8, 145, 178, 0.16)"
                          stroke="#0891b2"
                          strokeWidth="1.8"
                          strokeDasharray="4 2"
                        />
                        {/* Center Wearer */}
                        <circle cx="110" cy="100" r="5" fill="#1c1917" />
                      </svg>
                      <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] font-medium">
                        <span className="text-amber-700">
                          ● {rtl ? `الذروة (${sampleReport.peakProjectionMeters}m)` : `Peak (${sampleReport.peakProjectionMeters}m)`}
                        </span>
                        <span className="text-cyan-700">
                          --- {rtl ? `المستقرة (${sampleReport.settledProjectionMeters}m)` : `Settled (${sampleReport.settledProjectionMeters}m)`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 4-Phase Olfactory Wear Timeline Visual Cards */}
                  <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                      <h4 className="text-sm font-bold text-stone-950">
                        {rtl ? 'مسار تطوّر العينة زمنياً (من البخّة الأولى حتى الأثر)' : 'Chronological Sample Wear Progression'}
                      </h4>
                      <span className="text-[11px] font-mono tabular-nums text-stone-500">
                        {rtl ? 'مؤشر الأثر الكلي:' : 'Trail Index:'} {sampleReport.sillageTrailScore}/100
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      {sampleReport.timelineStages.map((st) => (
                        <div key={st.stageId} className="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
                          <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                            <span className="font-bold text-amber-800">{st.windowLabel}</span>
                            <span className="text-cyan-800 font-bold">{st.radiusMeters}m</span>
                          </div>
                          <div className="text-xs font-bold text-stone-950">
                            {rtl ? st.titleAr : st.titleEn}
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-mono text-stone-500">
                              <span>{rtl ? 'الشدة' : 'Intensity'}</span>
                              <span>{st.intensityPct}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-stone-200 overflow-hidden">
                              <div
                                style={{ width: `${st.intensityPct}%` }}
                                className={`h-full ${
                                  st.stageId === 'opening'
                                    ? 'bg-amber-500'
                                    : st.stageId === 'heart'
                                    ? 'bg-cyan-600'
                                    : st.stageId === 'drydown'
                                    ? 'bg-stone-800'
                                    : 'bg-stone-500'
                                }`}
                              />
                            </div>
                          </div>
                          {(rtl ? st.dominantNotesAr : st.dominantNotesEn).length > 0 && (
                            <div className="text-[11px] font-medium text-stone-700">
                              {(rtl ? st.dominantNotesAr : st.dominantNotesEn).join(' · ')}
                            </div>
                          )}
                          <p className="text-[11px] text-stone-600 leading-relaxed">
                            {rtl ? st.behaviorAr : st.behaviorEn}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Ingredient-by-Ingredient Contribution Bar Matrix */}
                  <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-2.5">
                      <h4 className="text-sm font-bold text-stone-950">
                        {rtl ? 'تأثير المكونات المختارة في الثبات والانتشار' : 'Selected Ingredient Longevity & Projection Attribution'}
                      </h4>
                      <div className="flex items-center gap-3 text-[11px] font-medium">
                        <span className="text-amber-700">● {rtl ? 'مساهمة الثبات %' : 'Longevity Weight %'}</span>
                        <span className="text-cyan-700">● {rtl ? 'دفع الانتشار %' : 'Projection Boost %'}</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {sampleReport.ingredientContributions.map((item) => (
                        <div key={item.noteId} className="space-y-1.5">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-bold text-stone-950 truncate">
                                {rtl ? item.nameAr : item.nameEn}
                              </span>
                              <span className="text-[11px] text-stone-500">
                                · {rtl ? item.roleTagAr : item.roleTagEn}
                              </span>
                            </div>
                            <span className="font-mono tabular-nums text-[11px] text-stone-600">
                              {item.oilPercent}% {rtl ? 'زيت' : 'oil'} · L:{item.longevityContributionPct}% · P:{item.projectionContributionPct}%
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                              <div
                                style={{ width: `${Math.min(100, item.longevityContributionPct)}%` }}
                                className="h-full bg-amber-600"
                              />
                            </div>
                            <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                              <div
                                style={{ width: `${Math.min(100, item.projectionContributionPct)}%` }}
                                className="h-full bg-cyan-600"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STAGE 2: Pyramid Evaluation & 6-Axis Radar */}
          {activeStage === 'pyramid' && (
            <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                {/* 6-Axis Radar SVG */}
                <div className="lg:col-span-6 flex flex-col items-center justify-center p-3 rounded-xl bg-stone-50 border border-stone-200">
                  <svg viewBox="0 0 320 280" className="w-full max-w-[320px] h-64">
                    {[25, 50, 75, 100].map((lvl) => {
                      const pts = radarAxes
                        .map((_, i) => {
                          const a = (Math.PI * 2 * i) / radarAxes.length - Math.PI / 2;
                          const r = (lvl / 100) * 90;
                          return `${(160 + Math.cos(a) * r).toFixed(1)},${(140 + Math.sin(a) * r).toFixed(1)}`;
                        })
                        .join(' ');
                      return <polygon key={lvl} points={pts} fill="none" stroke="#d6d3d1" strokeWidth="1" />;
                    })}
                    {radarAxes.map((ax, i) => {
                      const a = (Math.PI * 2 * i) / radarAxes.length - Math.PI / 2;
                      const x2 = 160 + Math.cos(a) * 90;
                      const y2 = 140 + Math.sin(a) * 90;
                      const lx = 160 + Math.cos(a) * 118;
                      const ly = 140 + Math.sin(a) * 114;
                      return (
                        <g key={ax.key}>
                          <line x1="160" y1="140" x2={x2} y2={y2} stroke="#d6d3d1" strokeWidth="1" />
                          <text
                            x={lx}
                            y={ly}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize="10"
                            fontWeight="600"
                            fill="#44403c"
                          >
                            {rtl ? ax.labelAr : ax.labelEn}
                          </text>
                        </g>
                      );
                    })}
                    {baselineSnapshot && (
                      <polygon
                        points={buildRadarPolygon(baselineSnapshot.result.radar, 160, 140, 90)}
                        fill="rgba(8, 145, 178, 0.14)"
                        stroke="#0891b2"
                        strokeWidth="1.8"
                        strokeDasharray="4 3"
                      />
                    )}
                    <polygon
                      points={buildRadarPolygon(sim.radar, 160, 140, 90)}
                      fill="rgba(217, 119, 6, 0.22)"
                      stroke="#d97706"
                      strokeWidth="2.4"
                    />
                  </svg>
                  <div className="flex items-center gap-4 text-[11px] font-medium">
                    <span className="text-amber-700">● {rtl ? 'التجربة الحية' : 'Live Trial'}</span>
                    {baselineSnapshot && (
                      <span className="text-cyan-700">--- {rtl ? `المرجع A (${baselineSnapshot.title})` : `Baseline A`}</span>
                    )}
                  </div>
                </div>

                {/* Tier Ratios & Diagnostics */}
                <div className="lg:col-span-6 space-y-3">
                  <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-800 leading-relaxed">
                    {rtl ? sim.pyramidVerdictAr : sim.pyramidVerdictEn}
                  </div>

                  {(
                    [
                      { key: 'top', label: L('tier_top'), val: sim.normalizedTiers.top, ideal: '15–28%', bar: 'bg-amber-500' },
                      { key: 'heart', label: L('tier_heart'), val: sim.normalizedTiers.heart, ideal: '30–48%', bar: 'bg-rose-500' },
                      { key: 'base', label: L('tier_base'), val: sim.normalizedTiers.base, ideal: '30–50%', bar: 'bg-stone-800' },
                    ] as const
                  ).map((row) => (
                    <div key={row.key} className="space-y-1">
                      <div className="flex justify-between text-xs font-mono tabular-nums">
                        <span className="font-sans font-bold text-stone-900">{row.label}</span>
                        <span className="text-stone-600">
                          {row.val}% <span className="text-stone-400">({rtl ? 'القياسي' : 'Target'}: {row.ideal})</span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-stone-200 overflow-hidden">
                        <div style={{ width: `${Math.min(100, row.val)}%` }} className={`h-full ${row.bar}`} />
                      </div>
                    </div>
                  ))}

                  <div className="grid grid-cols-2 gap-2 pt-1 font-mono tabular-nums text-xs">
                    {radarAxes.map((ax) => (
                      <div key={ax.key} className="p-2 rounded-lg border border-stone-200 flex items-center justify-between">
                        <span className="font-sans text-[11px] text-stone-600">{rtl ? ax.labelAr : ax.labelEn}</span>
                        <span className="font-bold text-stone-900">{sim.radar[ax.key]}/100</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STAGE 3: IFRA Category 4 & Carrier Safety Audit */}
          {activeStage === 'safety' && (
            <div className="space-y-4">
              {/* Carrier Safety Checks */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {sim.carrierChecks.map((chk) => {
                  const tone = statusTone(chk.status);
                  return (
                    <div key={chk.id} className="bg-white rounded-2xl border border-stone-200 p-3.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-stone-900">
                          {rtl ? chk.labelAr : chk.labelEn}
                        </span>
                        <span className={`text-xs font-mono font-bold ${tone.text}`}>
                          {tone.glyph} {chk.valueLabel}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-600 leading-relaxed">
                        {rtl ? chk.detailAr : chk.detailEn}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Tabular Ingredient IFRA Matrix */}
              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                    <h3 className="text-sm font-bold text-stone-950">
                      {rtl ? 'مصفوفة التدقيق الجلدي وقيود IFRA الفئة 4' : 'IFRA Category 4 Ingredient Audit Matrix'}
                    </h3>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg border text-xs font-bold ${safetyTone.pill}`}>
                    {safetyTone.glyph} {statusLabel(sim.safetyVerdict)} ({sim.ifraComplianceScore}%)
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-start">
                    <thead className="bg-stone-50 border-b border-stone-200 text-stone-600">
                      <tr>
                        <th className="py-2.5 px-3 text-start font-semibold">{rtl ? 'المكوّن' : 'Ingredient'}</th>
                        <th className="py-2.5 px-3 text-start font-semibold">{rtl ? 'من الزيت' : 'Oil %'}</th>
                        <th className="py-2.5 px-3 text-start font-semibold">{rtl ? 'بالمنتج النهائي' : 'Final %'}</th>
                        <th className="py-2.5 px-3 text-start font-semibold">{rtl ? 'سقف IFRA' : 'IFRA Cap'}</th>
                        <th className="py-2.5 px-3 text-start font-semibold">{rtl ? 'الحالة' : 'Status'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {sim.ifraRows.map((row) => {
                        const tone = statusTone(row.status);
                        return (
                          <tr key={row.noteId} className="hover:bg-stone-50/70">
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-stone-900">{rtl ? row.nameAr : row.nameEn}</div>
                              <div className="text-[11px] text-stone-500">
                                {row.casNumber ? `CAS ${row.casNumber} · ` : ''}
                                {rtl ? row.noteAr : row.noteEn}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-mono tabular-nums font-semibold">{row.oilPercent}%</td>
                            <td className="py-2.5 px-3 font-mono tabular-nums font-bold text-stone-900">
                              {row.finalProductPercent}%
                            </td>
                            <td className="py-2.5 px-3 font-mono tabular-nums text-stone-600">
                              {row.ifraCeilingFinalPercent !== null ? `${row.ifraCeilingFinalPercent}%` : '—'}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-bold ${tone.pill}`}>
                                <span>{tone.glyph}</span>
                                <span>{statusLabel(row.status)}</span>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {sim.ifraRows.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-stone-500">
                            {rtl ? 'أضف نوتات على الطاولة لفحص حدود السلامة' : 'Add notes on the bench to inspect IFRA safety'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STAGE 4: Developer Engineering Diagnostics + AI Product Optimizer */}
          {activeStage === 'optimizer' && (
            <div className="space-y-4">
              {/* Instant Deterministic Engineering Fixes */}
              <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-amber-700" />
                    <h3 className="text-sm font-bold text-stone-950">
                      {rtl ? 'إصلاحات هندسية فورية للتجربة الحية' : 'Live Engineering & Formulation Fixes'}
                    </h3>
                  </div>
                  <span className="font-mono tabular-nums text-xs text-stone-500">
                    {sim.suggestions.length}
                  </span>
                </div>

                {sim.suggestions.length === 0 ? (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>
                      {rtl
                        ? 'التصميم متوازن ومطابق لمعايير الذوبانية والسلامة الحالية — يمكنك تشغيل المحسن الذكي لاشتقاق تحسينات تجارية إضافية.'
                        : 'Current trial passes solubility, pyramid, and IFRA checks — run AI Optimizer below for commercial refinement.'}
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {sim.suggestions.map((fix) => {
                      const applied = appliedPatchIds.includes(fix.id);
                      const badgeTone =
                        fix.severity === 'critical'
                          ? 'bg-rose-50 border-rose-200 text-rose-900'
                          : fix.severity === 'recommended'
                          ? 'bg-amber-50 border-amber-200 text-amber-900'
                          : 'bg-stone-100 border-stone-200 text-stone-800';
                      return (
                        <div
                          key={fix.id}
                          className="p-3 rounded-xl border border-stone-200 bg-stone-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${badgeTone}`}>
                                {fix.severity.toUpperCase()}
                              </span>
                              <span className="text-xs font-bold text-stone-900">
                                {rtl ? fix.titleAr : fix.titleEn}
                              </span>
                            </div>
                            <p className="text-[11px] text-stone-600 leading-relaxed">
                              {rtl ? fix.reasonAr : fix.reasonEn}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => applyDeterministicFix(fix)}
                            disabled={applied}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 cursor-pointer transition-colors border ${
                              applied
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800 cursor-default'
                                : 'bg-stone-900 hover:bg-stone-800 border-stone-900 text-white'
                            }`}
                          >
                            {applied ? L('applied_patch') : rtl ? fix.patchLabelAr : fix.patchLabelEn}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* AI Product Developer Optimizer */}
              <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-stone-950 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-700" />
                      <span>
                        {rtl ? 'مساعد تطوير المنتج وتحسين الجودة بالذكاء الاصطناعي' : 'AI R&D Product Optimization Advisor'}
                      </span>
                    </h3>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      {rtl
                        ? 'اختر هدف التطوير لتحصل على توصيات تركيبة قابلة للتطبيق المباشر على التجربة الحية.'
                        : 'Select an engineering goal to receive concrete, 1-click reformulation patches.'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={optGoal}
                      onChange={(e) => setOptGoal(e.target.value as OptimizationGoal)}
                      className="px-3 py-2 rounded-xl border border-stone-200 bg-stone-50 text-xs font-semibold text-stone-800"
                    >
                      <option value="balanced_luxury">{rtl ? 'توازن فاخر وقبول تجاري' : 'Balanced Luxury Appeal'}</option>
                      <option value="max_longevity">{rtl ? 'أقصى ثبات وفوحان (+10 ساعات)' : 'Max Longevity & Sillage'}</option>
                      <option value="strict_safety">{rtl ? 'سلامة IFRA مطلقة وبشرة حساسة' : 'Strict IFRA & Sensitive Skin'}</option>
                      <option value="cost_efficiency">{rtl ? 'تحسين تكلفة التشغيل والجودة' : 'Cost-to-Performance Optimization'}</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => void runAiOptimization()}
                      disabled={aiLoading || trialNotes.length === 0 || isStaticHosting}
                      className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-stone-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      {aiLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      <span>{L('ai_opt_btn')}</span>
                    </button>
                  </div>
                </div>

                {aiLoading && (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-amber-700 animate-spin shrink-0" />
                    <span>{L('ai_opt_loading')}</span>
                  </div>
                )}

                {aiError && !aiLoading && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
                    <span>{aiError}</span>
                  </div>
                )}

                {aiOptResult && !aiLoading && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
                        <div className="text-[11px] font-bold text-stone-500">
                          {rtl ? 'تشخيص المنتج قبل التنفيذ' : 'Pre-Production Diagnosis'}
                        </div>
                        <p className="text-xs text-stone-800 leading-relaxed">
                          {aiOptResult.optimization.productDiagnosis}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
                        <div className="text-[11px] font-bold text-stone-500">
                          {rtl ? 'بروتوكول التصنيع والترشيح' : 'Lab Compounding & Filtration Protocol'}
                        </div>
                        <p className="text-xs text-stone-800 leading-relaxed">
                          {aiOptResult.optimization.manufacturingProtocol}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {aiOptResult.optimization.patches.map((patch) => {
                        const applied = appliedPatchIds.includes(patch.id);
                        return (
                          <div
                            key={patch.id}
                            className="p-3 rounded-xl border border-stone-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-bold text-stone-950">{patch.title}</span>
                                <span className="text-[11px] font-mono text-amber-700 font-semibold">
                                  · {patch.impactTag}
                                </span>
                              </div>
                              <p className="text-[11px] text-stone-600 leading-relaxed">{patch.rationale}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => applyAiPatch(patch)}
                              disabled={applied}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 cursor-pointer transition-colors border ${
                                applied
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800 cursor-default'
                                  : 'bg-stone-950 hover:bg-stone-800 border-stone-950 text-amber-300'
                              }`}
                            >
                              {applied ? L('applied_patch') : L('apply_patch')}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
