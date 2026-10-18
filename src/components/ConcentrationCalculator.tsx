import React, { useState, useMemo } from 'react';
import {
  Beaker,
  Scale,
  Sparkles,
  Droplets,
  Layers,
  HelpCircle,
  BookmarkPlus,
  DollarSign,
  Info,
  Check,
  Wind,
  BookOpen,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Lightbulb,
  ExternalLink,
  Sliders,
  Hourglass,
  Calendar,
  Bot,
} from 'lucide-react';
import {
  CalculationResult,
  ConcentrationType,
  FormulationState,
  PyramidNote,
  SavedFormula,
} from '../types/perfume';
import { SupportedLanguage } from '../types/i18n';
import {
  BOTTLE_SIZE_PRESETS,
  CONCENTRATION_PRESETS,
} from '../data/presets';
import { formatNum } from '../utils/calculations';
import { useLanguage } from '../context/LanguageContext';
import { LText, makeT, fmt, LOCALE_MAP, localeDate } from '../لغات/localize';
import { FragrancePyramidGraphic } from './FragrancePyramidGraphic';
import { CalculatorCriteriaGuide } from './CalculatorCriteriaGuide';
import { VisualScaleSimulator } from './VisualScaleSimulator';

const S = {
  lab_badge: { ar: 'معمل معيار شام لدقة صناعة العطور', en: 'Sham Perfumery Laboratory Standard', fr: 'Laboratoire Standard Sham Parfumerie', es: 'Laboratorio estándar de perfumería Sham', it: 'Laboratorio standard della profumeria Sham', de: 'Sham Parfümerie-Laborstandard', ru: 'Парфюмерная лаборатория стандарта Sham', zh: 'Sham 香水工艺实验室标准', tr: 'Sham Parfümeri Laboratuvar Standardı', fa: 'آزمایشگاه استاندارد صنعت عطر شام' },
  scale_badge: { ar: '⚖️ محاكاة وزن المواد والميزان', en: '⚖️ Visual Scale Simulator', fr: '⚖️ Simulateur de balance visuelle', es: '⚖️ Simulador visual de balanza', it: '⚖️ Simulatore visivo di bilancia', de: '⚖️ Visuelle Waagen-Simulation', ru: '⚖️ Визуальный симулятор весов', zh: '⚖️ 视觉称量模拟器', tr: '⚖️ Görsel terazi simülatörü', fa: '⚖️ شبیه‌ساز بصری ترازو' },
  back_to_formulation: { ar: 'العودة لحاسبة التركيب ←', en: 'Back to Formulation ←', fr: 'Retour à la formulation ←', es: 'Volver a la formulación ←', it: 'Torna alla formulazione ←', de: 'Zurück zur Formulierung ←', ru: 'К формуле ←', zh: '返回配方 ←', tr: 'Formülasyona dön ←', fa: 'بازگشت به فرمولاسیون ←' },
  return_to_calc: { ar: 'العودة لمقادير الحاسبة ←', en: 'Return to Calculator ←', fr: 'Retour au calculateur ←', es: 'Volver a la calculadora ←', it: 'Torna al calcolatore ←', de: 'Zurück zum Rechner ←', ru: 'К калькулятору ←', zh: '返回计算器 ←', tr: 'Hesaplayıcıya dön ←', fa: 'بازگشت به ماشین‌حساب ←' },
  open_pyramid: { ar: 'فتح جرافيك الهرم التفاعلي 💨', en: 'Open Interactive Pyramid 💨', fr: 'Ouvrir la pyramide interactive 💨', es: 'Abrir pirámide interactiva 💨', it: 'Apri piramide interattiva 💨', de: 'Interaktive Pyramide öffnen 💨', ru: 'Открыть интерактивную пирамиду 💨', zh: '打开互动金字塔 💨', tr: 'Etkileşimli piramidi aç 💨', fa: 'باز کردن هرم تعاملی 💨' },
  bottle_guide_tip: { ar: 'اقرأ شرح معيار حجم الزجاجة والفراغ الهوائي', en: 'Read bottle volume & headspace guide', fr: 'Guide volume & espace de tête', es: 'Guía de volumen y espacio de cabeza', it: 'Guida volume e spazio di testa', de: 'Leitfaden Volumen & Luftraum', ru: 'Руководство: объём и «хедспейс»', zh: '瓶容量与顶空指南', tr: 'Şişe hacmi ve hava boşluğu kılavuzu', fa: 'راهنمای حجم بطری و فضای سر' },
  criterion_guide: { ar: 'شرح المعيار', en: 'Criterion Guide', fr: 'Guide du critère', es: 'Guía del criterio', it: 'Guida del criterio', de: 'Kriterien-Leitfaden', ru: 'Описание критерия', zh: '标准说明', tr: 'Kriter kılavuzu', fa: 'راهنمای معیار' },
  current_volume_lbl: { ar: 'الحجم الحالي: ', en: 'Current: ', fr: 'Actuel : ', es: 'Actual: ', it: 'Attuale: ', de: 'Aktuell: ', ru: 'Текущий: ', zh: '当前：', tr: 'Mevcut: ', fa: 'فعلی: ' },
  headspace_std: { ar: 'معيار الحجم والفراغ الهوائي (Headspace Standard):', en: 'Bottle Volume & Headspace Margin Standard:', fr: 'Standard volume & espace de tête :', es: 'Estándar de volumen y espacio de cabeza:', it: 'Standard volume e spazio di testa:', de: 'Standard Volumen & Luftraum:', ru: 'Стандарт объёма и «хедспейса»:', zh: '瓶容量与顶空标准：', tr: 'Hacim ve hava boşluğu standardı:', fa: 'استاندارد حجم و فضای سر:' },
  custom_volume: { ar: 'تخصيص حجم يدوي', en: 'Custom Volume Slider', fr: 'Curseur de volume personnalisé', es: 'Control de volumen personalizado', it: 'Slider volume personalizzato', de: 'Custom-Volumen-Regler', ru: 'Свой ползунок объёма', zh: '自定义容量滑块', tr: 'Özel hacim kaydırıcısı', fa: 'اسلایدر حجم دلخواه' },
  conc_guide_tip: { ar: 'اقرأ شرح معيار نسب التركيز', en: 'Read concentration grade guide', fr: 'Guide des grades de concentration', es: 'Guía de grados de concentración', it: 'Guida dei gradi di concentrazione', de: 'Leitfaden Konzentration', ru: 'Руководство по степени концентрации', zh: '浓度等级指南', tr: 'Konsantrasyon derecesi kılavuzu', fa: 'راهنمای درجه غلظت' },
  current_conc_lbl: { ar: 'التركيز الحالي: ', en: 'Current: ', fr: 'Actuel : ', es: 'Actual: ', it: 'Attuale: ', de: 'Aktuell: ', ru: 'Текущая: ', zh: '当前：', tr: 'Mevcut: ', fa: 'فعلی: ' },
  conc_std: { ar: 'معيار التركيز العطري الدولي (Fragrance Concentration Standard):', en: 'International Fragrance Concentration Standard:', fr: 'Standard international de concentration :', es: 'Estándar internacional de concentración:', it: 'Standard internazionale di concentrazione:', de: 'Internationaler Konzentrationsstandard:', ru: 'Международный стандарт концентрации:', zh: '国际香水浓度标准：', tr: 'Uluslararası konsantrasyon standardı:', fa: 'استاندارد بین‌المللی غلظت عطر:' },
  fine_adjust: { ar: 'تعديل النسبة بدقة (1% إلى 50%)', en: 'Fine Adjustment (1% to 50%)', fr: 'Ajustement fin (1% à 50%)', es: 'Ajuste fino (1% a 50%)', it: 'Regolazione fine (1%–50%)', de: 'Feineinstellung (1% bis 50%)', ru: 'Тонкая настройка (1%–50%)', zh: '精细调节（1% 至 50%）', tr: 'İnce ayar (%1–%50)', fa: 'تنظیم دقیق (۱٪ تا ۵۰٪)' },
  live_scale_lbl: { ar: 'محاكاة وزن المواد الخام اللحظية (دقة 0.01g)', en: 'Live Raw Materials Scale Simulation (0.01g)', fr: 'Simulation live de pesée (0,01 g)', es: 'Simulación de pesaje en vivo (0,01 g)', it: 'Simulazione pesata dal vivo (0,01 g)', de: 'Live-Wiegung (0,01 g)', ru: 'Живая симуляция весов (0,01 г)', zh: '实时称量模拟（0.01g）', tr: 'Canlı hammadde tartım simülasyonu (0,01g)', fa: 'شبیه‌سازی زنده وزن مواد (دقت ۰٫۰۱g)' },
  net_lbl: { ar: 'صافي الزجاجة:', en: 'Net:', fr: 'Net :', es: 'Neto:', it: 'Netto:', de: 'Netto:', ru: 'Нетто:', zh: '净含量：', tr: 'Net: ', fa: 'خالص بطری:' },
  oil_mass: { ar: 'الزيت العطري', en: 'Oil Mass', fr: 'Masse d’huile', es: 'Masa de aceite', it: 'Massa oleosa', de: 'Ölmasse', ru: 'Масса масла', zh: '油的质量', tr: 'Yağ kütlesi', fa: 'جرم روغن' },
  drops_word: { ar: 'قطرة', en: 'drops', fr: 'gouttes', es: 'gotas', it: 'gocce', de: 'Tropfen', ru: 'капель', zh: '滴', tr: 'damla', fa: 'قطره' },
  ethanol_mass: { ar: 'الكحول الإيثيلي', en: 'Ethanol Mass', fr: 'Masse d’éthanol', es: 'Masa de etanol', it: 'Massa di etanolo', de: 'Ethanolmasse', ru: 'Масса этанола', zh: '乙醇质量', tr: 'Etanol kütlesi', fa: 'جرم اتانول' },
  fixative_mass: { ar: 'المثبت العطري', en: 'Fixative Mass', fr: 'Masse de fixateur', es: 'Masa de fijador', it: 'Massa fissante', de: 'Fixiermasse', ru: 'Масса фиксатора', zh: '固定剂质量', tr: 'Sabitleyici kütlesi', fa: 'جرم ثابت‌کننده' },
  fixative_zero: { ar: 'المثبت: 0 جم', en: 'Fixative: 0g', fr: 'Fixateur : 0 g', es: 'Fijador: 0 g', it: 'Fissante: 0 g', de: 'Fixativ: 0 g', ru: 'Фиксатор: 0 г', zh: '固定剂：0g', tr: 'Sabitleyici: 0g', fa: 'ثابت‌کننده: ۰ گرم' },
  optional_lbl: { ar: '(اختياري)', en: '(Optional)', fr: '(Facultatif)', es: '(Opcional)', it: '(Opzionale)', de: '(Optional)', ru: '(необязательно)', zh: '（可选）', tr: '(İsteğe bağlı)', fa: '(اختیاری)' },
  full_simulator: { ar: 'المحاكي التفاعلي الموسع ⚖️', en: 'Full Simulator ⚖️', fr: 'Simulateur complet ⚖️', es: 'Simulador completo ⚖️', it: 'Simulatore completo ⚖️', de: 'Vollsimulator ⚖️', ru: 'Полный симулятор ⚖️', zh: '完整模拟器 ⚖️', tr: 'Tam simülatör ⚖️', fa: 'شبیه‌ساز کامل ⚖️' },
  ethanol_opt_96: { ar: '96% - إيثانول عضوي فاخر (المعيار الدولي)', en: '96% - Cosmetic Perfumers Ethanol (Global Standard)', fr: '96 % - Éthanol parfumerie (standard mondial)', es: '96% - Etanol de perfumería (estándar global)', it: '96% - Etanolo da profumeria (standard globale)', de: '96 % - Parfümerie-Ethanol (Weltstandard)', ru: '96% — парфюмерный этанол (мировой стандарт)', zh: '96% - 化妆品级调香乙醇（全球标准）', tr: '%96 - Parfümeri etanolü (küresel standart)', fa: '٪۹۶ - اتانول عطرسازی (استاندارد جهانی)' },
  ethanol_opt_99: { ar: '99% - إيثانول مطلق خالي من الماء تماماً', en: '99% - Anhydrous Absolute Ethanol', fr: '99 % - Éthanol absolu anhydre', es: '99% - Etanol absoluto anhidro', it: '99% - Etanolo assoluto anidro', de: '99 % - Absolut wasserfreies Ethanol', ru: '99% — абсолютный безводный этанол', zh: '99% - 无水绝对乙醇', tr: '%99 - Susuz mutlak etanol', fa: '٪۹۹ - اتانول مطلق بدون آب' },
  ethanol_opt_95: { ar: '95% - كحول تقطير زراعي قياسي', en: '95% - Agricultural Distilled Alcohol', fr: '95 % - Alcool agricole distillé', es: '95% - Alcohol agrícola destilado', it: '95% - Alcol agricolo distillato', de: '95 % - Landwirtschaftlicher Destillatalkohol', ru: '95% — сельхоздистиллят', zh: '95% - 农业蒸馏酒精', tr: '%95 - Tarımsal damıtık alkol', fa: '٪۹۵ - الکل تقطیر کشاورزی' },
  bottles_word: { ar: 'عبوة', en: 'bottles', fr: 'flacons', es: 'frascos', it: 'flaconi', de: 'Flaschen', ru: 'флаконов', zh: '瓶', tr: 'şişe', fa: 'بطری' },
  maceration_title: { ar: 'فترة التعتيق وتاريخ نضوج العطر المتوقع (محاكي التعتيق الزمني)', en: 'Maceration Period & Predicted Maturation Date', fr: 'Période de macération & date de maturation', es: 'Periodo de maceración y fecha de maduración', it: 'Periodo di macerazione e data di maturazione', de: 'Mazerationszeit & Reifedatum', ru: 'Период мацерации и дата созревания', zh: '浸置期与预计成熟日期', tr: 'Maserasyon süresi ve olgunlaşma tarihi', fa: 'دوره تعریف و تاریخ رسیدن پیش‌بینی‌شده' },
  maceration_desc: { ar: 'حساب تاريخ الانتهاء المتوقع بناءً على أيام النظام وتاريخ البدء', en: 'Calculates exact completion date from start date & days', fr: 'Calcule la date de fin exacte (départ + jours)', es: 'Calcula la fecha exacta de fin (inicio + días)', it: 'Calcola la data esatta di completamento', de: 'Berechnet das exakte Enddatum (Start + Tage)', ru: 'Точный расчёт даты завершения (старт + дни)', zh: '根据起始日期与天数精确计算完成日期', tr: 'Başlangıç ve günlere göre tam bitiş tarihi', fa: 'محاسبه تاریخ پایان دقیق از تاریخ شروع و روزها' },
  aging_sim_btn: { ar: 'محاكي التعتيق الزمني ⏳', en: 'Aging Simulator ⏳', fr: 'Simulateur de maturation ⏳', es: 'Simulador de añejamiento ⏳', it: 'Simulatore di invecchiamento ⏳', de: 'Reifungs-Simulator ⏳', ru: 'Симулятор настаивания ⏳', zh: '熟成模拟器 ⏳', tr: 'Olgunlaşma simülatörü ⏳', fa: 'شبیه‌ساز تعریف ⏳' },
  mac_days_lbl: { ar: 'أيام التعتيق المقررة:', en: 'Maceration Days:', fr: 'Jours de macération :', es: 'Días de maceración:', it: 'Giorni di macerazione:', de: 'Mazerationstage:', ru: 'Дни мацерации:', zh: '浸置天数：', tr: 'Maserasyon günleri:', fa: 'روزهای تعریف:' },
  days_word: { ar: 'يوماً', en: 'days', fr: 'jours', es: 'días', it: 'giorni', de: 'Tage', ru: 'дн.', zh: '天', tr: 'gün', fa: 'روز' },
  maturity_date_lbl: { ar: 'تاريخ الانتهاء المتوقع للنضوج:', en: 'Target Maturation Date:', fr: 'Date de maturation visée :', es: 'Fecha de maduración:', it: 'Data di maturazione:', de: 'Ziel-Reifedatum:', ru: 'Дата созревания:', zh: '目标成熟日期：', tr: 'Hedef olgunlaşma tarihi:', fa: 'تاریخ رسیدن هدف:' },
  system_auto: { ar: 'تلقائي بالنظام', en: 'System Auto', fr: 'Auto (système)', es: 'Auto (sistema)', it: 'Auto (sistema)', de: 'Systemautomatik', ru: 'Авто (система)', zh: '系统自动', tr: 'Sistem otomatiği', fa: 'خودکار سیستم' },
  advanced_chem: { ar: 'إعدادات كيميائية متقدمة (الكثافة، الماء المقطر، المثبتات)', en: 'Advanced Chemistry Settings (Density, Water, Fixatives)', fr: 'Réglages chimiques avancés (densité, eau, fixateurs)', es: 'Ajustes químicos avanzados (densidad, agua, fijadores)', it: 'Impostazioni chimiche avanzate (densità, acqua, fissanti)', de: 'Erweiterte Chemieeinstellungen (Dichte, Wasser, Fixative)', ru: 'Расширенные химические настройки (плотность, вода, фиксаторы)', zh: '高级化学设置（密度、蒸馏水、固定剂）', tr: 'Gelişmiş kimya ayarları (yoğunluk, su, sabitleyici)', fa: 'تنظیمات پیشرفته شیمی (چگالی، آب مقطر، ثابت‌کننده)' },
  hide_settings: { ar: 'إخفاء الإعدادات ▲', en: 'Hide Settings ▲', fr: 'Masquer ▲', es: 'Ocultar ▲', it: 'Nascondi ▲', de: 'Ausblenden ▲', ru: 'Скрыть ▲', zh: '收起设置 ▲', tr: 'Gizle ▲', fa: 'پنهان کردن ▲' },
  customize_settings: { ar: 'تخصيص الإعدادات الكيميائية ▼', en: 'Customize Settings ▼', fr: 'Personnaliser ▼', es: 'Personalizar ▼', it: 'Personalizza ▼', de: 'Anpassen ▼', ru: 'Настроить ▼', zh: '自定义设置 ▼', tr: 'Özelleştir ▼', fa: 'شخصی‌سازی ▼' },
  water_benchmark: { ar: 'النسبة النموذجية: 0% إلى 2% فقط لترطيب الرذاذ.', en: 'Safe benchmark: 0% to 2% max.', fr: 'Référence sûre : 0 % à 2 % max.', es: 'Referencia segura: 0% a 2% máx.', it: 'Riferimento sicuro: 0%–2% max.', de: 'Sicherer Richtwert: 0 bis 2 % max.', ru: 'Безопасный ориентир: 0–2% макс.', zh: '安全参考：最高 0%–2%。', tr: 'Güvenli aralık: en fazla %0–2.', fa: 'محدوده امن: حداکثر ۰ تا ۲ درصد.' },
  fixative_benchmark: { ar: 'النسبة الموصى بها: 0.5% إلى 2% لإبطاء تبخر النوتات الخفيفة.', en: 'Recommended ratio: 0.5% to 2%.', fr: 'Ratio recommandé : 0,5 % à 2 %.', es: 'Proporción recomendada: 0,5% a 2%.', it: 'Rapporto consigliato: 0,5%–2%.', de: 'Empfohlenes Verhältnis: 0,5 bis 2 %.', ru: 'Рекомендуется: 0,5–2%.', zh: '建议比例：0.5%–2%。', tr: 'Önerilen oran: %0,5–2.', fa: 'نسب توصیه‌شده: ۰٫۵ تا ۲ درصد.' },
  oil_sg_lbl: { ar: 'كثافة الزيت العطري (g/ml)', en: 'Oil Specific Gravity (g/ml)', fr: 'Densité de l’huile (g/ml)', es: 'Densidad del aceite (g/ml)', it: 'Densità dell’olio (g/ml)', de: 'Öldichte (g/ml)', ru: 'Плотность масла (г/мл)', zh: '油比重（g/ml）', tr: 'Yağ yoğunluğu (g/ml)', fa: 'چگالی روغن (g/ml)' },
  oil_sg_note: { ar: 'المتوسط: 0.92 جم/مل', en: 'Standard benchmark: 0.92 g/ml', fr: 'Référence : 0,92 g/ml', es: 'Referencia: 0,92 g/ml', it: 'Riferimento: 0,92 g/ml', de: 'Richtwert: 0,92 g/ml', ru: 'Ориентир: 0,92 г/мл', zh: '参考值：0.92 g/ml', tr: 'Referans: 0,92 g/ml', fa: 'مرجع: ۰٫۹۲ گرم بر میلی‌لیتر' },
  ethanol_sg_lbl: { ar: 'كثافة الكحول الإيثيلي (g/ml)', en: 'Ethanol Specific Gravity (g/ml)', fr: 'Densité de l’éthanol (g/ml)', es: 'Densidad del etanol (g/ml)', it: 'Densità dell’etanolo (g/ml)', de: 'Ethandichte (g/ml)', ru: 'Плотность этанола (г/мл)', zh: '乙醇比重（g/ml）', tr: 'Etanol yoğunluğu (g/ml)', fa: 'چگالی اتانول (g/ml)' },
  ethanol_sg_note: { ar: 'الكحول 96% كثافته تقريباً 0.80 جم/مل', en: '96% ethanol is ~0.80 g/ml', fr: 'Éthanol 96 % : ~0,80 g/ml', es: 'Etanol 96%: ~0,80 g/ml', it: 'Etanolo 96%: ~0,80 g/ml', de: '96 %-Ethanol: ca. 0,80 g/ml', ru: 'Этанол 96% ≈ 0,80 г/мл', zh: '96% 乙醇约 0.80 g/ml', tr: '%96 etanol: ~0,80 g/ml', fa: 'اتانول ۹۶٪ حدود ۰٫۸۰ گرم بر میلی‌لیتر' },
  copied_lbl: { ar: 'تم النسخ', en: 'Copied', fr: 'Copié', es: 'Copiado', it: 'Copiato', de: 'Kopiert', ru: 'Скопировано', zh: '已复制', tr: 'Kopyalandı', fa: 'کپی شد' },
  copy_recipe_lbl: { ar: 'نسخ المقادير', en: 'Copy Recipe', fr: 'Copier la recette', es: 'Copiar receta', it: 'Copia ricetta', de: 'Rezept kopieren', ru: 'Скопировать рецепт', zh: '复制配方', tr: 'Tarifi kopyala', fa: 'کپی دستور' },
  breakdown_lbl: { ar: 'توزيع المكونات في الزجاجة', en: 'Formula Ratio Breakdown', fr: 'Répartition dans le flacon', es: 'Distribución en el frasco', it: 'Ripartizione nel flacone', de: 'Verteilung in der Flasche', ru: 'Распределение во флаконе', zh: '瓶内成分占比', tr: 'Şişe içi oran dağılımı', fa: 'توزیع اجزا در بطری' },
  volumetric_lbl: { ar: 'بالمخبار: ', en: 'Volumetric: ', fr: 'Volumétrique : ', es: 'Volumétrico: ', it: 'Volumetrico: ', de: 'Volumetrisch: ', ru: 'По объёму: ', zh: '量筒：', tr: 'Hacimsel: ', fa: 'حجمی: ' },
  scale_mass_lbl: { ar: 'وزن الميزان', en: 'Scale Mass', fr: 'Masse au peson', es: 'Masa en balanza', it: 'Massa in bilancia', de: 'Waagenmasse', ru: 'Масса на весах', zh: '称量质量', tr: 'Terazi kütlesi', fa: 'جرم ترازویی' },
  total_oil_lbl: { ar: 'إجمالي الزيت العطري:', en: 'Total Fragrance Oil:', fr: 'Huile parfum totale :', es: 'Aceite aromático total:', it: 'Olio profumato totale:', de: 'Duftöl gesamt:', ru: 'Масла всего:', zh: '香精油总量：', tr: 'Toplam kokulu yağ:', fa: 'کل روغن عطری:' },
  total_alcohol_lbl: { ar: 'إجمالي الكحول الإيثيلي:', en: 'Total Ethyl Alcohol:', fr: 'Éthanol total :', es: 'Etanol total:', it: 'Etanolo totale:', de: 'Ethanol gesamt:', ru: 'Этанола всего:', zh: '乙醇总量：', tr: 'Toplam etanol:', fa: 'کل اتانول:' },
  live_cost_lbl: { ar: 'إجمالي تكلفة المواد الخام التلقائية', en: 'Live Raw Materials Total Cost', fr: 'Coût matières en direct', es: 'Coste de materias en vivo', it: 'Costo materie dal vivo', de: 'Live-Materialkosten', ru: 'Себестоимость сырья в реальном времени', zh: '原料实时总成本', tr: 'Canlı hammadde maliyeti', fa: 'هزینه زنده مواد اولیه' },
  live_word: { ar: 'تحديث لحظي', en: 'Live', fr: 'Direct', es: 'En vivo', it: 'Dal vivo', de: 'Live', ru: 'Реальное время', zh: '实时', tr: 'Canlı', fa: 'زنده' },
  hide_prices: { ar: 'إخفاء الأسعار ▲', en: 'Hide Prices ▲', fr: 'Masquer les prix ▲', es: 'Ocultar precios ▲', it: 'Nascondi prezzi ▲', de: 'Preise ausblenden ▲', ru: 'Скрыть цены ▲', zh: '收起价格 ▲', tr: 'Fiyatları gizle ▲', fa: 'پنهان کردن قیمت‌ها ▲' },
  adjust_prices: { ar: 'تعديل الأسعار ⚙️', en: 'Adjust Prices ⚙️', fr: 'Ajuster les prix ⚙️', es: 'Ajustar precios ⚙️', it: 'Regola prezzi ⚙️', de: 'Preise anpassen ⚙️', ru: 'Настроить цены ⚙️', zh: '调整价格 ⚙️', tr: 'Fiyatları ayarla ⚙️', fa: 'تنظیم قیمت‌ها ⚙️' },
  cost_per_bottle_lbl: { ar: 'تكلفة المواد للزجاجة الواحدة:', en: 'Raw Cost per Single Bottle:', fr: 'Coût matière par flacon :', es: 'Coste material por frasco:', it: 'Costo materia per flacone:', de: 'Materialkosten je Flasche:', ru: 'Себестоимость на флакон:', zh: '单瓶原料成本：', tr: 'Şişe başına hammadde maliyeti:', fa: 'هزینه مواد هر بطری:' },
  itemized_lbl: { ar: 'تفصيل تكلفة المواد لكل عبوة:', en: 'Itemized Cost per Bottle:', fr: 'Détail par flacon :', es: 'Detalle por frasco:', it: 'Dettaglio per flacone:', de: 'Kostenaufstellung je Flasche:', ru: 'Детализация на флакон:', zh: '单瓶成本明细：', tr: 'Şişe başına maliyet dökümü:', fa: 'ریز هزینه هر بطری:' },
  of_materials: { ar: 'من تكلفة الخامات', en: 'of materials', fr: 'du coût matières', es: 'del coste de materiales', it: 'del costo material', de: 'der Materialkosten', ru: 'от стоимости сырья', zh: '（占原料成本）', tr: 'malzeme maliyetinin', fa: 'از هزینه مواد' },
  oil_cost_lbl: { ar: 'الزيت العطري الخام', en: 'Fragrance Oil', fr: 'Huile parfum', es: 'Aceite aromático', it: 'Olio profumato', de: 'Duftöl', ru: 'Парфюмерное масло', zh: '香精油', tr: 'Kokulu yağ', fa: 'روغن عطری' },
  water_cost_lbl: { ar: 'الماء المقطر', en: 'Distilled Water', fr: 'Eau distillée', es: 'Agua destilada', it: 'Acqua distillata', de: 'Destilliertes Wasser', ru: 'Дистиллированная вода', zh: '蒸馏水', tr: 'Damıtılmış su', fa: 'آب مقطر' },
  price_config_lbl: { ar: 'تخصيص أسعار شراء المواد الافتراضية', en: 'Customize Benchmark Raw Material Prices', fr: 'Personnaliser les prix de référence', es: 'Personalizar precios de referencia', it: 'Personalizza prezzi di riferimento', de: 'Referenzpreise anpassen', ru: 'Настроить эталонные цены', zh: '自定义基准原料价格', tr: 'Referans hammadde fiyatlarını düzenle', fa: 'شخصی‌سازی قیمت‌های مرجع مواد' },
  autosave_note: { ar: 'تُحفظ تلقائياً وتحدث الإجمالي', en: 'Auto-saved & Live Updated', fr: 'Enregistré auto & mis à jour', es: 'Guardado y actualizado automático', it: 'Salvataggio e aggiornamento automatici', de: 'Automatisch gespeichert & live', ru: 'Автосохранение и обновление', zh: '自动保存并实时更新', tr: 'Otomatik kaydedilir ve güncellenir', fa: 'ذخیره خودکار و به‌روزرسانی زنده' },
  visual_scale_lbl: { ar: 'محاكي وزن المواد والميزان البصري', en: 'Visual Scale & Balance Simulator', fr: 'Simulateur visuel de balance', es: 'Simulador visual de balanza', it: 'Simulatore visivo di bilancia', de: 'Visuelle Waagen-Simulation', ru: 'Визуальный симулятор весов', zh: '视觉称重模拟器', tr: 'Görsel terazi simülatörü', fa: 'شبیه‌ساز بصری وزن و ترازو' },
  visual_scale_desc: { ar: 'محاكاة بصرية حية لوزن كل مادة بالجرام والقطرات وتعبئة المخبار', en: 'Live gravimetric scale readout & liquid beaker visualization', fr: 'Lecture gravimétrique en direct et visualisation d’éprouvette', es: 'Lectura gravimétrica en vivo y visualización de probeta', it: 'Lettura gravimetrica dal vivo e becher visualizzato', de: 'Live-Waagenanzeige und Becherglas-Darstellung', ru: 'Живая гравиметрия и визуализация мензурки', zh: '实时称量读数与量杯可视化', tr: 'Canlı tartım okuması ve behür görselleştirmesi', fa: 'نمایش زنده وزن و بصری‌سازی استوانه' },
  full_lab_view: { ar: 'المحاكي الكامل 🔬', en: 'Full Lab View 🔬', fr: 'Vue labo complète 🔬', es: 'Vista de laboratorio 🔬', it: 'Vista laboratorio 🔬', de: 'Komplette Laboransicht 🔬', ru: 'Полный вид лаборатории 🔬', zh: '完整实验室视图 🔬', tr: 'Tam laboratuvar görünümü 🔬', fa: 'نمای کامل آزمایشگاه 🔬' },
  oil_colon: { ar: 'الزيت:', en: 'Oil:', fr: 'Huile :', es: 'Aceite:', it: 'Olio:', de: 'Öl:', ru: 'Масло:', zh: '油：', tr: 'Yağ:', fa: 'روغن:' },
  ethanol_colon: { ar: 'الكحول:', en: 'Ethanol:', fr: 'Éthanol :', es: 'Etanol:', it: 'Etanolo:', de: 'Ethanol:', ru: 'Этанол:', zh: '乙醇：', tr: 'Etanol:', fa: 'اتانول:' },
  fixative_colon: { ar: 'المثبت:', en: 'Fixative:', fr: 'Fixateur :', es: 'Fijador:', it: 'Fissante:', de: 'Fixativ:', ru: 'Фиксатор:', zh: '固定剂：', tr: 'Sabitleyici:', fa: 'ثابت‌کننده:' },
  water_colon: { ar: 'الماء:', en: 'Water:', fr: 'Eau :', es: 'Agua:', it: 'Acqua:', de: 'Wasser:', ru: 'Вода:', zh: '水：', tr: 'Su:', fa: 'آب:' },
  tare_lbl: { ar: 'TARE (تصفير)', en: 'TARE (Zero)', fr: 'TARE (Zéro)', es: 'TARE (Cero)', it: 'TARE (Zero)', de: 'TARE (Null)', ru: 'TARE (тара)', zh: 'TARE（去皮）', tr: 'TARE (Sıfırla)', fa: 'TARE (صفر کردن)' },
  q_mark: { ar: '؟', en: '?', fr: '?', es: '?', it: '?', de: '?', ru: '?', zh: '?', tr: '?', fa: '؟' },
  scale_sim_title: { ar: 'المحاكي البصري لوزن المواد الخام وميزان المعمل الرقمي (0.01g)', en: 'Visual Laboratory Balance & Raw Materials Compounding Simulator', fr: 'Simulateur visuel de balance & compounds (0,01 g)', es: 'Simulador visual de balanza y compuestos (0,01 g)', it: 'Simulatore visivo di bilancia e composti (0,01 g)', de: 'Visuelle Laborwaage & Compoundierung (0,01 g)', ru: 'Визуальный симулятор лабораторных весов (0,01 г)', zh: '视觉实验室天平与原料调配模拟器（0.01g）', tr: 'Görsel laboratuvar terazi ve bileşik simülatörü (0,01g)', fa: 'شبیه‌ساز بصری ترازو آزمایشگاهی و مواد (۰٫۰۱g)' },
  scale_sim_desc: { ar: 'محاكاة حية لميزان المعمل، وزن الزيوت والكحول والمثبتات بالجرام والقطرات خطوة بخطوة مع تعبئة المخبار.', en: 'Real-time step-by-step weighing walkthrough on digital balance pan (0.01g) with liquid beaker simulation.', fr: 'Pesée pas à pas en temps réel sur balance numérique (0,01 g) avec simulation d’éprouvette.', es: 'Pesaje paso a paso en tiempo real en balanza digital (0,01 g) con simulación de probeta.', it: 'Pesatura passo passo in tempo reale su bilancia digitale (0,01 g) con becher simulato.', de: 'Schrittweise Echtzeit-Wägung auf digitaler Waage (0,01 g) mit Becherglas.', ru: 'Пошаговое взвешивание в реальном времени (0,01 г) с мензуркой.', zh: '数字天平上的实时分步称量演练（0.01g），含量杯模拟。', tr: 'Dijital terazide adım adım gerçek zamanlı tartım (0,01g) ve behür simülasyonu.', fa: 'وزن‌کشی گام‌به‌گام زنده روی ترازوی دیجیتال (۰٫۰۱g) با شبیه‌سازی استوانه.' },
  pyramid_graph_title: { ar: 'جرافيك الهرم العطري التفاعلي ومحاكي سيناريو ما بعد الرش', en: 'Interactive Olfactory Pyramid & Virtual Post-Spray Simulator', fr: 'Pyramide olfactive interactive & simulation post-vaporisation', es: 'Pirámide olfativa interactiva y simulación post-pulverización', it: 'Piramide olfattiva interattiva e simulazione post-spruzzo', de: 'Interaktive Duftpyramide & Sprüh-Simulation', ru: 'Интерактивная пирамида и симуляция после распыления', zh: '互动香调金字塔与喷后场景模拟', tr: 'Etkileşimli koku piramidi ve sprey sonrası simülasyon', fa: 'هرم عطری تعاملی و شبیه‌سازی پس از اسپری' },
  pyramid_graph_desc: { ar: 'هرم ثلاثي الأبعاد مصنف بترتيب سرعة الطيران (1 إلى 10)، نسب النوتات الدقيقة، ومؤشر الفوحان دقيقة بدقيقة.', en: '3D geometric pyramid classified by volatility rank (1 to 10), precise mass ratios, and minute-by-minute sillage tracker.', fr: 'Pyramide 3D classée par volatilité (1 à 10), ratios massiques précis et suivi du sillage minute par minute.', es: 'Pirámide 3D clasificada por volatilidad (1 a 10), ratios precisos y estela minuto a minuto.', it: 'Piramide 3D classificata per volatilità (1–10), rapporti precisi e scia minuto per minuto.', de: '3D-Pyramide nach Flüchtigkeit (1–10), präzise Massenverhältnisse und Sillage-Minutentracker.', ru: '3D-пирамида по летучести (1–10), точные массовые доли и шлейф по минутам', zh: '按挥发性（1–10）分类的 3D 金字塔、精确质量配比与逐分钟扩散追踪。', tr: 'Uçuculuk derecesine göre sınıflandırılmış 3B piramit (1–10), net kütle oranları ve dakika dakika iz takibi.', fa: 'هرم سه‌بعدی طبقه‌بندی‌شده براساس فراریت (۱ تا ۱۰)، نسبت‌های دقیق و ردیابی دقیقه‌به‌دقیقه انتشار.' },
  pyramid_prompt_q: { ar: 'هل تريد رؤية جرافيك الهرم وسيناريو ما بعد الرش لحظة بلحظة لهذه التركيبة؟', en: 'Inspect the live Fragrance Pyramid and virtual spray simulation scenario for this formula?', fr: 'Visualiser la pyramide et la simulation post-vulgarisation de cette formule ?', es: '¿Ver la pirámide y la simulación post-spray de esta fórmula?', it: 'Vuoi la piramide e la simulazione post-spruzzo di questa formula?', de: 'Pyramide und Sprüh-Simulation dieser Formel ansehen?', ru: 'Посмотреть пирамиду и симуляцию распыления этой формулы?', zh: '查看此配方的金字塔与喷后模拟？', tr: 'Bu formülün piramidini ve sprey simülasyonunu görmek ister misiniz?', fa: 'هرم و شبیه‌سازی اسپری این فرمول را ببینید؟' },
  pyramid_prompt_desc: { ar: 'انقر لعرض الرسم الهرمي التفاعلي ثلاثي الطبقات ومحاكاة التبخر من دقيقة الصفر حتى 18+ ساعة.', en: 'Click to inspect the 3-tier interactive pyramid and real-time volatilization curve from 0m to 24h.', fr: 'Cliquez pour la pyramide 3 niveaux et la courbe d’évaporation de 0 à 24 h.', es: 'Haga clic para la pirámide de 3 niveles y la curva de evaporación de 0 a 24 h.', it: 'Clicca per la piramide a 3 livelli e la curva di evaporazione 0–24 h.', de: 'Klicken Sie für die 3-stufige Pyramide und Verdunstungskurve (0–24 h).', ru: 'Нажмите: 3-уровневая пирамида и кривая испарения 0–24 ч.', zh: '点击查看三层互动金字塔与 0–24 小时实时蒸发曲线。', tr: '3 katlı piramit ve 0–24 saat buharlaşma eğrisi için tıklayın.', fa: 'برای هرم سه‌لایه و منحنی تبخیر ۰ تا ۲۴ ساعت کلیک کنید.' },
  headspace_note: { ar: '• السعة الحجمية: تحدد بدقة كتلة الزيت والكحول والماء الواجب وزنها. • قاعدة الفراغ الهوائي: اترك دائماً فراغاً بنسبة 3% إلى 5% في أعلى الزجاجة لامتصاص تمدد السائل الناتج عن حرارة الجو، ولضمان عمل أنبوب البخاخ دون ضغط مفرط.', en: '• Nominal Capacity: Accurately defines the gravimetric mass of oil, alcohol, and fixatives to weigh. • Headspace Rule: Always preserve a 3% to 5% air gap to absorb thermal expansion and ensure leak-free atomizer performance.', fr: '• Capacité nominale : définit la masse gravimétrique à peser. • Espace de tête : conservez toujours 3 à 5 % d’air pour absorber la dilatation thermique et garantir un spray sans fuite.', es: '• Capacidad nominal: define la masa gravimétrica a pesar. • Regla del espacio de cabeza: deje siempre un 3–5% de aire para la dilatación térmica y un atomizador sin fugas.', it: '• Capacità nominale: definisce la massa da pesare. • Spazio di testa: lasciare sempre il 3–5% d’aria per l’espansione termica e un erogatore senza perdite.', de: '• Nennkapazität: definiert die abzuwiegende Masse. • Luftraumregel: immer 3–5 % Luft für thermische Ausdehnung und dichtes Zerstäuberventil.', ru: ' • Номинальный объём: определяет точную массу для взвешивания. • Правило «хедспейса»: всегда оставляйте 3–5% воздуха для теплового расширения и корректной работы распылителя.', zh: '• 标称容量：精确确定需称量的油、醇、固定剂质量。• 顶空规则：始终保留 3%–5% 空气间隙，以吸收热膨胀并确保喷头不漏。', tr: '• Nominal kapasite: tartılacak kütleyi tanımlar. • Hava boşluğu kuralı: ısıl genleşme için daima %3–5 hava bırakın.', fa: '• ظرفیت اسمی: جرم دقیق قابل وزن‌کشی را تعیین می‌کند. • قاعده فضای سر: همیشه ۳ تا ۵ درصد هوا برای انبساط حرارتی و عملکرد درست اسپری بگذارید.' },
  conc_std_note: { ar: '• Extrait (25%-35%): ثبات أقصى 12-24 ساعة مع فوحان حميمي. • EDP (15%-22%): التوازن المعياري العالمي للثبات والانتشار. • EDT (8%-14%): انطباع أولي منعش يتناقص تدريجياً. • EDC (3%-6%): نسمات صيفية خفيفة سريعة التطاير.', en: '• Extrait (25%-35%): Maximum 12-24h longevity with royal intimacy. • EDP (15%-22%): The global benchmark for balanced longevity and diffusion. • EDT (8%-14%): A fresh opening that tapers gradually. • EDC (3%-6%): Light summer breezes, quick to evaporate.', fr: '• Extrait (25–35%) : tenue maximale 12–24 h, sillage intime. • EDP (15–22%) : l’équilibre mondial tenue/diffusion. • EDT (8–14%) : ouverture fraîche qui s’estompe. • EDC (3–6%) : brises d’été légères et volatiles.', es: '• Extrait (25–35%): fijación máxima 12–24 h, estela íntima. • EDP (15–22%): equilibrio global fijación/difusión. • EDT (8–14%): apertura fresca que decae. • EDC (3–6%): brisas veraniegas ligeras.', it: '• Extrait (25–35%): tenacia 12–24 h, scia intima. • EDP (15–22%): equilibrio globale tenacia/diffusione. • EDT (8–14%): apertura fresca che sfuma. • EDC (3–6%): brezzi estivi leggeri.', de: '• Extrait (25–35 %): maximale 12–24 h Haltbarkeit, intime Sillage. • EDP (15–22 %): globales Benchmark für Balance. • EDT (8–14 %): frischer Auftakt, langsam abklingend. • EDC (3–6 %): leichte Sommerbrisen.', ru: '• Extrait (25–35%): максимум 12–24 ч, интимный шлейф. • EDP (15–22%): мировой баланс стойкости и шлейфа. • EDT (8–14%): свежее начало, постепенное угасание. • EDC (3–6%): лёгкие летние аккорды.', zh: '• 浓香精 Extrait（25%–35%）：最长 12–24 小时持久，贴身扩散。• 淡香精 EDP（15%–22%）：全球公认的持久与扩散平衡。• 淡香水 EDT（8%–14%）：清新开场，逐渐减弱。• 古龙水 EDC（3%–6%）：轻盈夏日，挥发较快。', tr: '• Extrait (%25–35): en uzun 12–24 saat kalıcılık. • EDP (%15–22): kalıcılık/yayılma dengesi. • EDT (%8–14): taze açılış, yavaşça azalır. • EDC (%3–6): hafif yaz esintileri.', fa: '• اکس trait (۲۵–۳۵٪): حداکثر ۱۲–۲۴ ساعت ماندگاری صمیمی. • EDP (۱۵–۲۲٪): تعادل جهانی ماندگاری و انتشار. • EDT (۸–۱۴٪): شروع تازه که کم‌کم ضعیف می‌شود. • EDC (۳–۶٪): نسیم‌های تابستانی سبک.' },
  live_update_note: { ar: 'تحديث لحظي لجرامات المواد مع سحب مؤشر النسبة', en: 'Real-time gram adjustment as concentration changes', fr: 'Ajustement des grammes en temps réel selon la concentration', es: 'Gramos en tiempo real según la concentración', it: 'Grammi in tempo reale al variare della concentrazione', de: 'Gramm-Aktualisierung in Echtzeit', ru: 'Граммы обновляются в реальном времени', zh: '浓度变化时克数实时更新', tr: 'Konsantrasyon değiştikçe gram real zamanlı güncellenir', fa: 'گرم‌ها با تغییر غلظت به‌صورت زنده به‌روز می‌شوند' },
  alcohol_note: { ar: 'الكحول 96% هو الأنسب لإذابة الزيوت دون تعكر. كحول الصيدليات 70% يفسد العطر لاحتوائه على 30% ماء.', en: '96% ethanol is the golden standard to solubilize oils without clouding. Pharmacy 70% alcohol ruins the perfume with its 30% water content.', fr: 'L’éthanol 96 % dissout les huiles sans trouble. L’alcool de pharmacie à 70 % gâte le parfum (30 % d’eau).', es: 'El etanol al 96% disuelve los aceites sin enturbiar. El alcohol de farmacia al 70% arruina el perfume (30% agua).', it: 'L’etanolo al 96% scioglie gli oli senza opacizzare. Quello farmaceutico al 70% rovina il profumo (30% acqua).', de: '96 %-Ethanol löst Öle klar. Apotheken-Alkohol (70 %) ruiniert das Parfüm durch 30 % Wasser.', ru: 'Этанол 96% растворяет масла без помутнения. Аптечный 70% портит духи (30% воды).', zh: '96% 乙醇溶解精油不浑浊；药房 70% 酒精含 30% 水会毁掉香水。', tr: '%96 etanol yağları bulanmadan çözer. Eczane alkolü %30 su içerdiğinden parfümü bozar.', fa: 'اتانول ۹۶٪ روغن‌ها را بدون کدورت حل می‌کند؛ الکل ۷۰٪ داروخانه به‌دلیل ۳۰٪ آب عطر را خراب می‌کند.' },
  batch_note: { ar: 'الخلط بالتشغيلة الكاملة يوحد نقاء ورائحة العطر ويقلل هدر الخامات بنسبة تصل لـ 12%.', en: 'Batch compounding ensures olfactory uniformity across all bottles and cuts material waste by up to 12%.', fr: 'Le mélange en lot garantit l’homogénéité olfactive et réduit les pertes jusqu’à 12 %.', es: 'Mezclar por lote homogeneiza el aroma y reduce el desperdicio hasta 12%.', it: 'La miscelazione a lotto uniforma l’olfatto e riduce gli sprechi fino al 12%.', de: 'Chargenmischung sichert Gleichmäßigkeit und senkt Abfall bis 12 %.', ru: 'Партия целиком — одинаковый аромат во всех флаконах, минус до 12% отходов.', zh: '整批调配确保所有瓶气味一致，最多可减少 12% 原料浪费。', tr: 'Parti karışımı tüm şişelerde aynı kokuyu sağlar, israfı %12’ye kadar azaltır.', fa: 'اختلاط کل بچ یکنواختی رایحه را تضمین و ضایعات را تا ۱۲٪ کاهش می‌دهد.' },
  cta_pyramid: { ar: 'مشاهدة جرافيك الهرم وسيناريو رش العطر 💨', en: 'View Fragrance Pyramid & Spray Simulation 💨', fr: 'Voir la pyramide et simulation de spray 💨', es: 'Ver pirámide y simulación de spray 💨', it: 'Vedi piramide e simulazione spray 💨', de: 'Pyramide & Sprüh-Simulation ansehen 💨', ru: 'Пирамида и симуляция распыления 💨', zh: '查看香调金字塔与喷洒模拟 💨', tr: 'Piramit ve sprey simülasyonunu gör 💨', fa: 'مشاهده هرم و شبیه‌سازی اسپری 💨' },
  cta_criteria: { ar: 'دليل وشرح جميع معايير الحاسبة والمعمل 📖', en: 'Formulation Criteria & Chemistry Guide 📖', fr: 'Guide des critères & chimie 📖', es: 'Guía de criterios y química 📖', it: 'Guida criteri e chimica 📖', de: 'Leitfaden: Kriterien & Chemie 📖', ru: 'Справочник критериев и химии 📖', zh: '配方标准与化学指南 📖', tr: 'Kriter ve kimya kılavuzu 📖', fa: 'راهنمای معیارها و شیمی 📖' },
  cta_aging: { ar: 'محاكي التعتيق الزمني وتاريخ نضوج العطر ⏳', en: 'Maceration & Aging Time Simulator ⏳', fr: 'Simulateur de macération & maturation ⏳', es: 'Simulador de maceración y añejamiento ⏳', it: 'Simulatore di macerazione e invecchiamento ⏳', de: 'Mazerations- & Reife-Simulator ⏳', ru: 'Симулятор мацерации и настаивания ⏳', zh: '浸置与熟成时间模拟器 ⏳', tr: 'Maserasyon ve olgunlaşma simülatörü ⏳', fa: 'شبیه‌ساز زمان تعریف و رسیدن عطر ⏳' },
  cta_shahin: { ar: 'استشارة الخبير شاهين حول نسب وتعتيق التركيبة 🧙‍♂️', en: 'Consult Master Shahin on Formulation & Aging 🧙‍♂️', fr: 'Consulter Maître Shahin 🧙‍♂️', es: 'Consultar al Maestro Shahin 🧙‍♂️', it: 'Consuluta al Maestro Shahin 🧙‍♂️', de: 'Meister Shahin befragen 🧙‍♂️', ru: 'Спросить мастера Шахина 🧙‍♂️', zh: '咨询 Shahin 大师配方与熟成 🧙‍♂️', tr: 'Usta Shahin’e danış 🧙‍♂️', fa: 'مشورت از استاد شاهین 🧙‍♂️' },
  grav_std: { ar: 'معيار ميزان المعمل (الميزان الرقمي vs المخبار):', en: 'Laboratory Gravimetric Standard (Digital Scale vs Cylinder):', fr: 'Standard gravimétrique (balance vs éprouvette) :', es: 'Estándar gravimétrico (balanza vs probeta):', it: 'Standard gravimetrico (bilancia vs cilindro):', de: 'Gravimetrischer Standard (Waage vs Messzylinder):', ru: 'Гравиметрический стандарт (весы vs мензурка):', zh: '实验室称量标准（电子秤 vs 量筒）：', tr: 'Gravimetrik standart (terazi vs ölçü silindiri):', fa: 'استاندارد وزن‌سنجی (ترازوی دیجیتال در برابر استوانه):' },
  grav_std_note: { ar: 'استخدام الميزان الرقمي بالغرام أدق بكثير من المخبار المدرج بالمليلتر، والأخطاء المسموحة ±0.02 جم لكل 100 جم.', en: 'Gravimetric digital balance measurement is strictly preferred over graduated cylinders; tolerance ±0.02 g per 100 g.', fr: 'La pesée gravimétrique est bien plus précise que l’éprouvette ; tolérance ±0,02 g / 100 g.', es: 'La balanza digital es mucho más precisa que la probeta; tolerancia ±0,02 g / 100 g.', it: 'La bilancia digitale è molto più precisa del cilindro; tolleranza ±0,02 g / 100 g.', de: 'Digitale Wägung ist dem Messzylinder klar überlegen; Toleranz ±0,02 g je 100 g.', ru: 'Взвешивание точнее мерного цилиндра; допуск ±0,02 г на 100 г.', zh: '电子称量远精确于量筒；公差每 100 克 ±0.02 克。', tr: 'Dijital tartım ölçü silindirinden çok daha hassastır; ±0,02 g tolerans.', fa: 'توزین دیجیتال دقیق‌تر از استوانه مدرج است؛ تلورانس ±۰٫۰۲ گرم در ۱۰۰ گرم.' },
  oil_price_tpl: { ar: 'سعر كيلو الزيت ({c}/kg)', en: 'Oil Price ({c}/kg)', fr: 'Prix kg huile ({c}/kg)', es: 'Precio kg aceite ({c}/kg)', it: 'Prezzo kg olio ({c}/kg)', de: 'Ölpreis ({c}/kg)', ru: 'Цена кг масла ({c}/кг)', zh: '油价格（{c}/kg）', tr: 'Yağ fiyatı ({c}/kg)', fa: 'قیمت هر کیلو روغن ({c}/kg)' },
  ethanol_price_tpl: { ar: 'سعر لتر الكحول ({c}/L)', en: 'Ethanol Price ({c}/L)', fr: 'Prix L éthanol ({c}/L)', es: 'Precio L etanol ({c}/L)', it: 'Prezzo L etanolo ({c}/L)', de: 'Ethanolpreis ({c}/L)', ru: 'Цена л этанола ({c}/л)', zh: '乙醇价格（{c}/L）', tr: 'Etanol fiyatı ({c}/L)', fa: 'قیمت هر لیتر اتانول ({c}/L)' },
  fixative_price_tpl: { ar: 'سعر كيلو المثبت ({c}/kg)', en: 'Fixative Price ({c}/kg)', fr: 'Prix kg fixateur ({c}/kg)', es: 'Precio kg fijador ({c}/kg)', it: 'Prezzo kg fissante ({c}/kg)', de: 'Fixativpreis ({c}/kg)', ru: 'Цена кг фиксатора ({c}/кг)', zh: '固定剂价格（{c}/kg）', tr: 'Sabitleyici fiyatı ({c}/kg)', fa: 'قیمت هر کیلو ثابت‌کننده ({c}/kg)' },
  water_price_tpl: { ar: 'سعر لتر الماء المقطر ({c}/L)', en: 'Distilled Water ({c}/L)', fr: 'Eau distillée ({c}/L)', es: 'Agua destilada ({c}/L)', it: 'Acqua distillata ({c}/L)', de: 'Dest. Wasser ({c}/L)', ru: 'Дист. вода ({c}/л)', zh: '蒸馏水（{c}/L）', tr: 'Damıtılmış su ({c}/L)', fa: 'آب مقطر ({c}/L)' },
  single_bottle_tpl: { ar: 'المقادير للزجاجة الواحدة ({v} مل):', en: 'Batch Metrics per Single Bottle ({v}ml):', fr: 'Mesures par flacon ({v} ml) :', es: 'Métricas por frasco ({v} ml):', it: 'Metriche per flacone ({v} ml):', de: 'Werte je Flasche ({v} ml):', ru: 'Показатели на флакон ({v} мл):', zh: '单瓶指标（{v}ml）：', tr: 'Şişe başına metrikler ({v} ml):', fa: 'شاخص‌های هر بطری ({v} میلی‌لیتر):' },
  batch_total_tpl: { ar: 'إجمالي إنتاج التشغيلة ({n} عبوة):', en: 'Batch Production Total ({n} units):', fr: 'Production totale du lot ({n} flacons) :', es: 'Producción total del lote ({n} uds.):', it: 'Produzione totale del lotto ({n} pz.):', de: 'Gesamtproduktion der Charge ({n} Stk.):', ru: 'Итог партии ({n} шт.):', zh: '整批产量（{n} 瓶）：', tr: 'Parti toplam üretimi ({n} adet):', fa: 'کل تولید بچ ({n} بطری):' },
  cost_note_tpl: { ar: 'محسوبة تلقائياً بأسعار الخامات الافتراضية ({c})', en: 'Calculated dynamically from benchmark prices ({c})', fr: 'Calculé selon les prix de référence ({c})', es: 'Calculado con precios de referencia ({c})', it: 'Calcolato dai prezzi di riferimento ({c})', de: 'Aus Referenzpreisen berechnet ({c})', ru: 'Расчёт по эталонным ценам ({c})', zh: '按基准价格动态计算（{c}）', tr: 'Referans fiyatlardan otomatik hesaplanır ({c})', fa: 'بر اساس قیمت‌های مرجع محاسبه می‌شود ({c})' },
  batch_cost_tpl: { ar: 'تكلفة التشغيلة ({n} عبوة):', en: 'Total Batch Cost ({n} units):', fr: 'Coût total du lot ({n} flacons) :', es: 'Coste total del lote ({n} uds.):', it: 'Costo totale del lotto ({n} pz.):', de: 'Gesamtkosten der Charge ({n} Stk.):', ru: 'Себестоимость партии ({n} шт.):', zh: '整批成本（{n} 瓶）：', tr: 'Parti toplam maliyeti ({n} adet):', fa: 'هزینه کل بچ ({n} بطری):' },
  clip_header: { ar: '📌 تركيبة عطرية - معيار شام\nالحجم: {v} مل | التركيز: {c}%', en: '📌 Fragrance Formulation - Sham Standard\nVolume: {v}ml | Concentration: {c}%', fr: '📌 Formulation - Standard Sham\nVolume : {v} ml | Concentration : {c} %', es: '📌 Formulación - Estándar Sham\nVolumen: {v} ml | Concentración: {c}%', it: '📌 Formula - Standard Sham\nVolume: {v} ml | Concentrazione: {c}%', de: '📌 Formulierung - Sham-Standard\nVolumen: {v} ml | Konzentration: {c} %', ru: '📌 Формула — стандарт Sham\nОбъём: {v} мл | Концентрация: {c}%', zh: '📌 香水配方 - Sham 标准\n容量：{v}ml | 浓度：{c}%', tr: '📌 Parfüm Formülü - Sham Standardı\nHacim: {v} ml | Konsantrasyon: %{c}', fa: '📌 فرمول عطر - استاندارد شام\nحجم: {v} میلی‌لیتر | غلظت: {c}٪' },
  clip_oil: { ar: 'الزيت العطري: {w} جم ({v} مل)', en: 'Fragrance Oil: {w}g ({v}ml)', fr: 'Huile parfum : {w} g ({v} ml)', es: 'Aceite aromático: {w} g ({v} ml)', it: 'Olio profumato: {w} g ({v} ml)', de: 'Duftöl: {w} g ({v} ml)', ru: 'Парфюмерное масло: {w} г ({v} мл)', zh: '香精油：{w}g（{v}ml）', tr: 'Kokulu yağ: {w} g ({v} ml)', fa: 'روغن عطری: {w} گرم ({v} میلی‌لیتر)' },
  clip_alcohol: { ar: 'الكحول الإيثيلي: {w} جم ({v} مل)', en: 'Ethanol: {w}g ({v}ml)', fr: 'Éthanol : {w} g ({v} ml)', es: 'Etanol: {w} g ({v} ml)', it: 'Etanolo: {w} g ({v} ml)', de: 'Ethanol: {w} g ({v} ml)', ru: 'Этанол: {w} г ({v} мл)', zh: '乙醇：{w}g（{v}ml）', tr: 'Etanol: {w} g ({v} ml)', fa: 'اتانول: {w} گرم ({v} میلی‌لیتر)' },
  clip_water: { ar: 'الماء المقطر: {w} جم ({v} مل)', en: 'Distilled Water: {w}g ({v}ml)', fr: 'Eau distillée : {w} g ({v} ml)', es: 'Agua destilada: {w} g ({v} ml)', it: 'Acqua distillata: {w} g ({v} ml)', de: 'Dest. Wasser: {w} g ({v} ml)', ru: 'Дист. вода: {w} г ({v} мл)', zh: '蒸馏水：{w}g（{v}ml）', tr: 'Damıtılmış su: {w} g ({v} ml)', fa: 'آب مقطر: {w} گرم ({v} میلی‌لیتر)' },
  clip_fixative: { ar: 'المثبت: {w} جم ({v} مل)', en: 'Fixative: {w}g ({v}ml)', fr: 'Fixateur : {w} g ({v} ml)', es: 'Fijador: {w} g ({v} ml)', it: 'Fissante: {w} g ({v} ml)', de: 'Fixativ: {w} g ({v} ml)', ru: 'Фиксатор: {w} г ({v} мл)', zh: '固定剂：{w}g（{v}ml）', tr: 'Sabitleyici: {w} g ({v} ml)', fa: 'ثابت‌کننده: {w} گرم ({v} میلی‌لیتر)' },
  clip_total: { ar: 'الوزن الإجمالي للزجاجة: {w} جم', en: 'Net Bottle Total: {w}g', fr: 'Poids net flacon : {w} g', es: 'Peso neto frasco: {w} g', it: 'Peso netto flacone: {w} g', de: 'Flasche netto: {w} g', ru: 'Итого во флаконе: {w} г', zh: '瓶内总重量：{w}g', tr: 'Şişe net toplam: {w} g', fa: 'وزن کل بطری: {w} گرم' },
  shahin_prompt_tpl: { ar: 'أيها الخبير شاهين (شيخ العطارين)، أعمل على تركيبة بتركيز {c}% بحجم {v} مل (وزن الزيت: {ow} جم، الكحول: {aw} جم).\nمدة التعتيق المقررة: {d} يوماً، وتاريخ الانتهاء المتوقع: {date}.\nما هو تقييمك المخبري لتوازن هذه النسب؟ وكيف أضمن أعلى ثبات وفوحان وأفضل نتيجة تعتيق؟', en: 'Dear Master Shahin (Dean of Perfumers), I am working on a {c}% concentration formula in a {v}ml bottle (oil: {ow}g, ethanol: {aw}g).\nPlanned maceration: {d} days, expected completion: {date}.\nWhat is your lab assessment of these ratios, and how do I secure maximum longevity, sillage, and maturation quality?', fr: 'Cher Maître Shahin, je travaille sur une formule à {c} % dans un flacon de {v} ml (huile : {ow} g, éthanol : {aw} g).\nMacération prévue : {d} jours, achèvement : {date}.\nQuelle est votre évaluation de ces ratios et comment maximiser tenue, sillage et maturation ?', es: 'Querido Maestro Shahin, trabajo en una fórmula al {c}% en un frasco de {v} ml (aceite: {ow} g, etanol: {aw} g).\nMaceración prevista: {d} días, finalización: {date}.\n¿Cuál es su evaluación de estas proporciones y cómo logro máxima fijación, estela y maduración?', it: 'Caro Maestro Shahin, sto lavorando a una formula al {c}% in flacone da {v} ml (olio: {ow} g, etanolo: {aw} g).\nMacerazione prevista: {d} giorni, completamento: {date}.\nQual è la sua valutazione di questi rapporti e come ottengo massima tenacia, scia e maturazione?', de: 'Lieber Meister Shahin, ich arbeite an einer {c}%-Formel in einem {v}-ml-Fläschchen (Öl: {ow} g, Ethanol: {aw} g).\nGeplante Mazeration: {d} Tage, Fertigstellung: {date}.\nWie bewerten Sie diese Verhältnisse und wie erreiche ich maximale Haltbarkeit, Sillage und Reifung?', ru: 'Уважаемый мастер Шахин, работаю над формулой {c}% во флаконе {v} мл (масло: {ow} г, этанол: {aw} г).\nМацерация: {d} дней, завершение: {date}.\nОцените эти пропорции: как добиться максимальной стойкости, шлейфа и качества настаивания?', zh: '尊敬的 Shahin 大师，我正在调配一款 {c}% 浓度、{v}ml 瓶装的配方（油：{ow}g，乙醇：{aw}g）。\n计划浸置 {d} 天，预计完成：{date}。\n请评估这些比例，并指导如何获得最佳持久度、扩散与熟成效果？', tr: 'Sayın Usta Shahin, {v} ml\'lik şişede %{c} konsantrasyonlu bir formül üzerinde çalışıyorum (yağ: {ow} g, etanol: {aw} g).\nPlanlanan maserasyon: {d} gün, tahmini bitiş: {date}.\nBu oranları nasıl bulursunuz ve en iyi kalıcılık, iz ve olgunlaşma için ne önerirsiniz?', fa: 'استاد شاهین گرامی، روی فرمولی با غلظت {c}٪ در بطری {v} میلی‌لیتری کار می‌کنم (روغن: {ow} گرم، اتانول: {aw} گرم).\nتعریف برنامه‌ریزی‌شده: {d} روز، پایان مورد انتظار: {date}.\nارزیابی شما درباره این نسبت‌ها چیست و چگونه بیشترین ماندگاری، انتشار و کیفیت تعریف را به دست آورم؟' },
  ifra_warning_title: { ar: '⚠️ تنبيه معايير IFRA الدولية: تجاوز سقف الأمان (30%)', en: '⚠️ IFRA Safety Alert: Concentration Exceeds Safe Benchmark (30%)', fr: '⚠️ Alerte de sécurité IFRA : concentration excessive (> 30 %)', es: '⚠️ Alerta de seguridad IFRA: concentración superior al 30%', it: '⚠️ Avviso di sicurezza IFRA: concentrazione oltre il 30%', de: '⚠️ IFRA-Sicherheitswarnung: Konzentration über 30 %', ru: '⚠️ Предупреждение IFRA: концентрация выше 30%', zh: '⚠️ 国际 IFRA 安全警报：浓度超过安全上限（30%）', tr: '⚠️ IFRA Güvenlik Uyarısı: Konsantrasyon %30 sınırını aşıyor', fa: '⚠️ هشدار استانداردهای بین‌المللی IFRA: غلظت بیش از ۳۰٪' },
  ifra_warning_desc: { ar: 'نسبة الزيت العطري الحالية ({c}%) تتجاوز الحد الأقصى الآمن الموصى به لمعايير IFRA الفئة 4 (عطور الرش). الاستخدام بتركيز أعلى من 30% قد يسبب تحسساً تلامسياً للبشرة، انسداداً في أنبوب الرشاش، وترك بقع زيتية على الأقمشة.', en: 'Current fragrance concentration ({c}%) exceeds the 30% safe ceiling recommended under IFRA Category 4 standards (fine spray perfumes). Over-concentration risks contact dermal sensitization, atomizer tube clogging, and textile staining.', fr: 'La concentration actuelle ({c} %) dépasse le seuil sûr de 30 % recommandé par l’IFRA Catégorie 4. Risque d’irritation cutanée, de buse bouchée et de taches.', es: 'La concentración actual ({c}%) supera el límite seguro del 30% de IFRA Categoría 4. Riesgo de sensibilización dérmica, obstrucción del pulverizador y manchas en tejidos.', it: 'La concentrazione ({c}%) supera la soglia sicura del 30% raccomandata da IFRA Categoria 4. Rischio di sensibilizzazione cutanea, blocco dello spray e macchie.', de: 'Die Konzentration ({c} %) überschreitet die empfohlene 30-%-Grenze (IFRA Kategorie 4). Risiko von Hautreizungen, verstopftem Zerstäuber und Flecken.', ru: 'Концентрация ({c}%) превышает безопасный предел 30% (IFRA Категория 4). Риск аллергической реакции кожи, засорения распылителя и пятен на одежде.', zh: '当前香精油浓度（{c}%）超过国际 IFRA 第 4 类标准推荐的 30% 安全阈值。浓度过高可能引发接触性皮炎、喷头导管堵塞并在织物上残留油渍。', tr: 'Mevcut yağ konsantrasyonu (%{c}), IFRA Kategori 4 uyarınca %30 güvenli tavanını aşıyor. Ciltte tahriş, sprey tüpü tıkanması ve kumaş lekesi riski taşır.', fa: 'غلظت روغن کنونی ({c}٪) از سقف ۳۰٪ توصیه‌شده استانداردهای IFRA رده ۴ فراتر است. خطر بروز حساسیت پوستی، گرفتگی لوله افشانه و ایجاد لکه روغنی روی لباس.' },
  ifra_adjust_safe: { ar: 'ضبط تلقائي للحد الآمن (30%) ⚡', en: 'Auto-adjust to Safe Limit (30%) ⚡', fr: 'Ajuster à la limite sûre (30 %) ⚡', es: 'Ajustar al límite seguro (30%) ⚡', it: 'Regola alla soglia sicura (30%) ⚡', de: 'Auf sichere 30 % einstellen ⚡', ru: 'Установить безопасные 30% ⚡', zh: '一键调至安全上限（30%）⚡', tr: 'Güvenli sınıra ayarla (%30) ⚡', fa: 'تنظیم خودکار به حد مجاز (۳۰٪) ⚡' },
  ifra_safe_badge: { ar: 'معتمد وفق معايير IFRA الدولية (الفئة 4: آمن للبشرة)', en: 'Compliant with IFRA Category 4 Standards (Skin-safe fine fragrance)', fr: 'Conforme aux normes IFRA Catégorie 4 (sûr pour la peau)', es: 'Conforme a estándares IFRA Categoría 4 (seguro para la piel)', it: 'Conforme agli standard IFRA Categoria 4 (sicuro per la pelle)', de: 'IFRA-Kategorie 4 konform (hautsicherer Feinduft)', ru: 'Соответствует стандартам IFRA Категории 4 (безопасно для кожи)', zh: '符合国际 IFRA 第 4 类安全标准（亲肤安全）', tr: 'IFRA Kategori 4 standartlarına tam uyumlu (cilt dostu)', fa: 'منطبق بر استانداردهای IFRA رده ۴ (ایمن برای پوست)' },
  ifra_risk_title: { ar: 'مخاطر التركيز غير المتوافق مع IFRA:', en: 'Risks of non-compliant concentration:', fr: 'Risques d’une concentration non conforme :', es: 'Riesgos de una concentración no conforme:', it: 'Rischi di una concentrazione non conforme:', de: 'Risiken einer nicht konformen Konzentration:', ru: 'Риски несоответствия нормам IFRA:', zh: '不符合 IFRA 标准的潜在风险：', tr: 'IFRA uyumsuz konsantrasyon riskleri:', fa: 'خطرات غلظت ناسازگار با IFRA:' },
  ifra_risk_skin: { ar: 'التحسس التلامسي والتهيج الجلدي بسبب فرط تركيز الجزيئات العطرية', en: 'Contact dermal sensitization & irritation due to excess aroma chemical density', fr: 'Sensibilisation cutanée de contact par excès de composés aromatiques', es: 'Sensibilización dérmica por exceso de concentración aromática', it: 'Sensibilizzazione cutanea da eccesso di molecole aromatiche', de: 'Kontaktdermatitis durch zu hohe Riechstoffdichte', ru: 'Контактная сенсибилизация кожи из-за переизбытка аромавеществ', zh: '香精分子过载引起的接触性皮炎与皮肤刺激', tr: 'Aşırı koku molekülü yoğunluğuna bağlı temas hassasiyeti', fa: 'حساسیت تماسی پوست به دلیل تراکم بیش از حد مولکول‌های عطری' },
  ifra_risk_atomizer: { ar: 'انسداد مرشاش الزجاجة وعدم انسياب الرذاذ الدقيق لكثافة السائل الزيتي', en: 'Atomizer clogging & uneven mist due to excessive liquid viscosity', fr: 'Buse obstruée et brumisation irrégulière par viscosité élevée', es: 'Obstrucción del atomizador y nebulización deficiente por viscosidad', it: 'Intasamento dello spray e nebulizzazione irregolare per alta viscosità', de: 'Verstopfter Zerstäuber durch zu hohe Viskosität', ru: 'Засорение распылителя и неравномерное распыление из-за вязкости', zh: '液体粘度过高导致喷头喷管堵塞与水雾不均', tr: 'Aşırı viskozite nedeniyle püskürtücü tıkanması ve damlacık sorunu', fa: 'گرفتگی افشانه و اختلال در پاشش یکنواخت به علت ویسکوزیته بالا' },
  ifra_risk_stain: { ar: 'ترك بقع زيتية داكنة على الأقمشة البيضاء والحريرية صعبة الإزالة', en: 'Dark oil staining on white fabrics and silk resistant to dry cleaning', fr: 'Taches d’huile tenaces sur les tissus blancs et la soie', es: 'Manchas de aceite en tejidos blancos y seda difíciles de eliminar', it: 'Macchie oleose persistenti su tessuti bianchi e seta', de: 'Ölflecken auf hellen Stoffen und Seide', ru: 'Трудновыводимые масляные пятна на белых и шёлковых тканях', zh: '浅色衣物与丝绸织物上残留难洗的油渍斑点', tr: 'Açık renk ve ipek kumaşlarda zor çıkan yağ lekeleri', fa: 'بر جای ماندن لکه‌های روغنی تیره روی پارچه‌های سفید و ابریشم' },
  ifra_restricted_detected: { ar: 'تنبيه مكون مقيد وفق IFRA 51:', en: 'IFRA 51 Restricted Ingredient Detected:', fr: 'Composant restreint IFRA 51 détecté :', es: 'Ingrediente restringido IFRA 51 detectado:', it: 'Ingrediente limitato IFRA 51 rilevato:', de: 'IFRA 51 beschränkter Inhaltsstoff erkannt:', ru: 'Обнаружен ограниченный компонент по IFRA 51:', zh: '检测到 IFRA 51 受限成分：', tr: 'IFRA 51 kısıtlı bileşeni tespit edildi:', fa: 'ماده محدودشده بر اساس استانداردهای IFRA 51 شناسایی شد:' },
} satisfies Record<string, LText>;

interface ConcentrationCalculatorProps {
  formulation: FormulationState;
  setFormulation: React.Dispatch<React.SetStateAction<FormulationState>>;
  result: CalculationResult;
  onSaveFormula: () => void;
  onSendToCosting: () => void;
  pyramidNotes?: PyramidNote[];
  setPyramidNotes?: React.Dispatch<React.SetStateAction<PyramidNote[]>>;
  onNavigateToTab?: (tab: string) => void;
  currentLang?: SupportedLanguage;
  currencyCode?: string;
  macerationDays?: number;
  setMacerationDays?: React.Dispatch<React.SetStateAction<number>>;
}

export const ConcentrationCalculator: React.FC<ConcentrationCalculatorProps> = ({
  formulation,
  setFormulation,
  result,
  onSaveFormula,
  onSendToCosting,
  pyramidNotes = [],
  setPyramidNotes,
  onNavigateToTab,
  currentLang: propLang,
  currencyCode: propCurrency,
  macerationDays = 30,
  setMacerationDays,
}) => {
  const { currentLang: ctxLang, t } = useLanguage();
  const effectiveLang = propLang || ctxLang || 'ar';
  const isRTL = effectiveLang === 'ar' || effectiveLang === 'fa';
  const L = makeT(effectiveLang, S);
  const activeCurrency = propCurrency || formulation.currency || 'SAR';

  // Navigation inside the calculator: formulation, graphic pyramid, criteria guide, or visual scale simulator
  const [activeView, setActiveView] = useState<
    'formulation' | 'pyramid_graphic' | 'criteria_guide' | 'scale_simulator'
  >('formulation');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [showPriceConfig, setShowPriceConfig] = useState(false);
  const [isLiveScaleTared, setIsLiveScaleTared] = useState(false);

  // Raw Materials Benchmark Pricing (Live Real-Time Cost Calculation)
  const [oilPricePerKg, setOilPricePerKg] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('miyaar_perfume_default_oil_price');
      return saved ? parseFloat(saved) || 250 : 250;
    } catch {
      return 250;
    }
  });
  const [alcoholPricePerLiter, setAlcoholPricePerLiter] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('miyaar_perfume_default_alc_price');
      return saved ? parseFloat(saved) || 35 : 35;
    } catch {
      return 35;
    }
  });
  const [fixativePricePerKg, setFixativePricePerKg] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('miyaar_perfume_default_fix_price');
      return saved ? parseFloat(saved) || 85 : 85;
    } catch {
      return 85;
    }
  });
  const [waterPricePerLiter, setWaterPricePerLiter] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('miyaar_perfume_default_water_price');
      return saved ? parseFloat(saved) || 5 : 5;
    } catch {
      return 5;
    }
  });

  // IFRA Standards & Category 4 Safety Check
  const restrictedNotesBreaches = useMemo(() => {
    if (!pyramidNotes || !pyramidNotes.length) return [];
    const restrictions: Array<{ pattern: RegExp; name: string; limit: number; reason: string }> = [
      { pattern: /oakmoss|evernia|طحلب السنديان/i, name: isRTL ? 'طحلب السنديان (Oakmoss)' : 'Oakmoss (Evernia)', limit: 0.1, reason: isRTL ? 'يحتوي على الأترانورين المسبب للحساسية التلامسية' : 'Restricted to 0.1% due to dermal allergens' },
      { pattern: /damascenone|داماسينون/i, name: isRTL ? 'بيتا داماسينون (beta-Damascenone)' : 'beta-Damascenone', limit: 0.043, reason: isRTL ? 'كيتون وردي فائق القوة مقيد وفق IFRA 51' : 'Potent rose ketone capped at 0.043% under IFRA 51' },
      { pattern: /coumarin|تونكا|كومارين/i, name: isRTL ? 'كومارين / بذور التونكا (Coumarin)' : 'Coumarin / Tonka Extract', limit: 1.5, reason: isRTL ? 'محدد بنسبة 1.5% لتفادي الحساسية الجلدية' : 'Capped at 1.5% to prevent dermal sensitization' },
      { pattern: /cinnamon|قرفة|سينامالدهيد|cinnamaldehyde/i, name: isRTL ? 'سينامالدهيد / زيت القرفة' : 'Cinnamaldehyde / Cinnamon Oil', limit: 0.05, reason: isRTL ? 'مهيج قوي للبشرة مقيد بنسبة 0.05%' : 'Strong skin irritant capped at 0.05%' },
      { pattern: /eugenol|clove|قرنفل|يوجينول/i, name: isRTL ? 'يوجينول / زيت القرنفل (Eugenol)' : 'Eugenol / Clove Oil', limit: 0.5, reason: isRTL ? 'مقيد بنسبة 0.5% لتفادي الحساسية' : 'Restricted to 0.5% max limit' },
      { pattern: /cashmeran|كشميران/i, name: isRTL ? 'كشميران (Cashmeran)' : 'Cashmeran', limit: 3.8, reason: isRTL ? 'الحد الأقصى في عطور الفئة 4 هو 3.8%' : 'Category 4 ceiling is 3.8%' },
      { pattern: /iso e super|إيزو إي سوبر/i, name: isRTL ? 'إيزو إي سوبر (Iso E Super)' : 'Iso E Super', limit: 21.4, reason: isRTL ? 'الحد الأقصى المسموح به 21.4%' : 'Category 4 ceiling is 21.4%' },
    ];

    const breaches: Array<{ name: string; actualPct: number; limit: number; reason: string }> = [];
    for (const note of pyramidNotes) {
      const combined = `${note.nameAr || ''} ${note.nameEn || ''}`;
      for (const r of restrictions) {
        if (r.pattern.test(combined)) {
          const finishedPct = (Number(note.percentageOfOil || 0) / 100) * (formulation.concentrationPercent / 100) * 100;
          if (finishedPct > r.limit) {
            breaches.push({
              name: r.name,
              actualPct: Number(finishedPct.toFixed(3)),
              limit: r.limit,
              reason: r.reason,
            });
          }
        }
      }
    }
    return breaches;
  }, [pyramidNotes, formulation.concentrationPercent, isRTL]);

  const isOver30 = formulation.concentrationPercent > 30;
  const hasIfraWarning = isOver30 || restrictedNotesBreaches.length > 0;

  const handleUpdatePrice = (
    key: 'oil' | 'alcohol' | 'fixative' | 'water',
    val: number
  ) => {
    const num = Math.max(0, val);
    if (key === 'oil') {
      setOilPricePerKg(num);
      try { localStorage.setItem('miyaar_perfume_default_oil_price', num.toString()); } catch {}
    } else if (key === 'alcohol') {
      setAlcoholPricePerLiter(num);
      try { localStorage.setItem('miyaar_perfume_default_alc_price', num.toString()); } catch {}
    } else if (key === 'fixative') {
      setFixativePricePerKg(num);
      try { localStorage.setItem('miyaar_perfume_default_fix_price', num.toString()); } catch {}
    } else if (key === 'water') {
      setWaterPricePerLiter(num);
      try { localStorage.setItem('miyaar_perfume_default_water_price', num.toString()); } catch {}
    }
  };

  // Real-time raw material costs derived instantly from current formulation state
  const rawCostOil = (result.oilWeightGrams / 1000) * oilPricePerKg;
  const rawCostAlcohol = (result.alcoholVolumeMl / 1000) * alcoholPricePerLiter;
  const rawCostFixative = (result.fixativeWeightGrams / 1000) * fixativePricePerKg;
  const rawCostWater = (result.waterVolumeMl / 1000) * waterPricePerLiter;
  const rawCostTotalSingle = rawCostOil + rawCostAlcohol + rawCostFixative + rawCostWater;
  const rawCostTotalBatch = rawCostTotalSingle * Math.max(1, formulation.batchCount || 1);

  // Quick accordion explanations for each input criterion
  const [expandedCriteria, setExpandedCriteria] = useState<Record<string, boolean>>({});

  const toggleCriterion = (id: string) => {
    setExpandedCriteria((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleBottleSizeSelect = (ml: number) => {
    setFormulation((prev) => ({ ...prev, bottleVolumeMl: ml }));
  };

  const handleConcentrationTypeSelect = (preset: (typeof CONCENTRATION_PRESETS)[0]) => {
    setFormulation((prev) => ({
      ...prev,
      concentrationType: preset.id,
      concentrationPercent: preset.defaultPercentage,
    }));
  };

  const copyRecipeToClipboard = () => {
    const text = [
      fmt(L('clip_header'), { v: formulation.bottleVolumeMl, c: formulation.concentrationPercent }),
      fmt(L('clip_oil'), { w: formatNum(result.oilWeightGrams), v: formatNum(result.oilVolumeMl) }),
      fmt(L('clip_alcohol'), { w: formatNum(result.alcoholWeightGrams), v: formatNum(result.alcoholVolumeMl) }),
      ...(result.waterVolumeMl > 0 ? [fmt(L('clip_water'), { w: formatNum(result.waterWeightGrams), v: formatNum(result.waterVolumeMl) })] : []),
      ...(result.fixativeVolumeMl > 0 ? [fmt(L('clip_fixative'), { w: formatNum(result.fixativeWeightGrams), v: formatNum(result.fixativeVolumeMl) })] : []),
      fmt(L('clip_total'), { w: formatNum(result.totalWeightGrams) }),
    ].join('\n');
    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Section Header with View Mode Switcher */}
      <div className="border-b border-stone-200/80 pb-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold border border-amber-200 mb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-700" />
            <span>
              {L('lab_badge')}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-stone-900 font-serif-luxury">
            {t('calc_title', 'حاسبة نسب التركيز، جرافيك الهرم، ودليل المعايير')}
          </h2>
          <p className="text-stone-500 text-sm mt-1">
            {t('calc_subtitle', 'حدد حجم الزجاجة والتركيز بدقة الميزان (0.01g)، واكتشف جرافيك الهرم التفاعلي وسيناريو ما بعد الرش، واقرأ شرح كل معيار علمياً.')}
          </p>
        </div>

        {/* View Mode Tabs Switcher */}
        <div className="inline-flex p-1 bg-stone-100/90 rounded-2xl border border-stone-200 text-xs font-semibold shrink-0 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveView('formulation')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeView === 'formulation'
                ? 'bg-stone-900 text-white shadow-xs font-bold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Beaker className="w-3.5 h-3.5 text-amber-400" />
            <span>{t('calc_tab_formulation', '🧪 مقادير التركيب وتعبئة الزجاجات')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('pyramid_graphic')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeView === 'pyramid_graphic'
                ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-xs font-bold'
                : 'text-amber-800 hover:text-amber-950 font-bold bg-amber-500/10'
            }`}
          >
            <Wind className="w-3.5 h-3.5" />
            <span>{t('calc_tab_pyramid', '🔺 جرافيك الهرم وسيناريو الرش 💨')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('criteria_guide')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeView === 'criteria_guide'
                ? 'bg-amber-900 text-white shadow-xs font-bold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-500" />
            <span>{t('calc_tab_criteria', '📚 شرح جميع معايير الحاسبة')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('scale_simulator')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeView === 'scale_simulator'
                ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-xs font-bold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Scale className="w-3.5 h-3.5 text-amber-400" />
            <span>{L('scale_badge')}</span>
          </button>
        </div>
      </div>

      {/* VIEW: VISUAL SCALE SIMULATOR */}
      {activeView === 'scale_simulator' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-gradient-to-r from-stone-900 via-amber-950 to-stone-900 p-4 sm:p-5 rounded-2xl text-white flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm border border-amber-600/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-lg border border-amber-500/40">
                ⚖️
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-amber-100">
                  {L('scale_sim_title')}
                </h3>
                <p className="text-xs text-stone-300 mt-0.5">
                  {L('scale_sim_desc')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveView('formulation')}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-white/10"
              >
                {L('back_to_formulation')}
              </button>
            </div>
          </div>

          <VisualScaleSimulator
            formulation={formulation}
            result={result}
            pyramidNotes={pyramidNotes}
            currentLang={effectiveLang}
          />
        </div>
      )}

      {/* VIEW 1: GRAPHIC FRAGRANCE PYRAMID & SPRAY EVOLUTION */}
      {activeView === 'pyramid_graphic' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-gradient-to-r from-stone-900 via-amber-950 to-stone-900 p-4 sm:p-5 rounded-2xl text-white flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm border border-amber-600/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-lg border border-amber-500/40">
                🔺
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-amber-100">
                  {L('pyramid_graph_title')}
                </h3>
                <p className="text-xs text-stone-300 mt-0.5">
                  {L('pyramid_graph_desc')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveView('formulation')}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-white/10"
              >
                {L('return_to_calc')}
              </button>
            </div>
          </div>

          <FragrancePyramidGraphic
            pyramidNotes={pyramidNotes}
            setPyramidNotes={setPyramidNotes || (() => {})}
            result={result}
            bottleVolumeMl={formulation.bottleVolumeMl}
            concentrationPercent={formulation.concentrationPercent}
            currentLang={effectiveLang}
          />
        </div>
      )}

      {/* VIEW 2: COMPREHENSIVE CRITERIA GUIDE */}
      {activeView === 'criteria_guide' && (
        <div className="space-y-6 animate-in fade-in">
          <CalculatorCriteriaGuide
            onClose={() => setActiveView('formulation')}
            currentLang={effectiveLang}
          />
        </div>
      )}

      {/* VIEW 3: CORE FORMULATION CALCULATOR (DEFAULT) */}
      {activeView === 'formulation' && (
        <div className="space-y-6 animate-in fade-in">

          {/* Quick Notice Banner with Direct Switch to Pyramid Graphic */}
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-600/15 to-amber-700/10 border border-amber-300/80 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold text-base shrink-0 shadow-xs">
                🔺
              </div>
              <div className={isRTL ? 'text-right' : 'text-left'}>
                <span className="text-xs sm:text-sm font-bold text-amber-950 block">
                  {L('pyramid_prompt_q')}
                </span>
                <span className="text-[11px] text-stone-600">
                  {L('pyramid_prompt_desc')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveView('pyramid_graphic')}
                className="px-4 py-2 bg-gradient-to-r from-amber-700 to-amber-800 hover:from-amber-800 hover:to-amber-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Wind className="w-3.5 h-3.5 text-amber-200" />
                <span>{L('open_pyramid')}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Form Controls & Inputs with In-Depth Criteria Explanations */}
            <div className="lg:col-span-7 space-y-6">

              {/* 1. Bottle Size Selection */}
              <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-bold text-stone-900 flex items-center gap-2">
                      <Beaker className="w-4 h-4 text-amber-700" />
                      <span>{t('bottle_volume', 'حجم زجاجة العطر المستهدفة')}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => toggleCriterion('bottle_volume')}
                      className="px-2 py-0.5 rounded-full bg-amber-50 hover:bg-amber-100 border border-amber-300 text-[10px] font-bold text-amber-900 flex items-center gap-1 cursor-pointer transition-colors"
                      title={L('bottle_guide_tip')}
                    >
                      <HelpCircle className="w-3 h-3 text-amber-700" />
                      <span>{L('criterion_guide')}</span>
                      {expandedCriteria['bottle_volume'] ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                    </button>
                  </div>
                  <div className="text-xs text-stone-500">
                    {L('current_volume_lbl')}
                    <span className="font-bold text-stone-900 font-mono-numbers">{formulation.bottleVolumeMl} ml</span>
                  </div>
                </div>

                {/* Inline Criterion Educational Box */}
                {expandedCriteria['bottle_volume'] && (
                  <div className="p-3.5 bg-amber-50/80 rounded-xl border border-amber-200 text-xs text-stone-800 space-y-1.5 animate-in fade-in">
                    <div className="font-bold text-amber-950 flex items-center gap-1.5">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-700" />
                      <span>{L('headspace_std')}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-stone-700">
                      {L('headspace_note')}
                    </p>
                  </div>
                )}

                {/* Presets Grid */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {BOTTLE_SIZE_PRESETS.map((preset) => (
                    <button
                      key={preset.ml}
                      type="button"
                      onClick={() => handleBottleSizeSelect(preset.ml)}
                      className={`py-2 px-1 text-center rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        formulation.bottleVolumeMl === preset.ml
                          ? 'bg-amber-900 text-amber-100 shadow-xs ring-1 ring-amber-700 font-bold'
                          : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200'
                      }`}
                    >
                      <span className="block font-bold font-mono-numbers">{preset.ml} ml</span>
                      <span className="text-[10px] opacity-75 block truncate">
                        {isRTL ? preset.labelAr : preset.labelEn}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Custom Bottle Slider */}
                <div className="pt-2">
                  <div className="flex justify-between text-xs text-stone-500 mb-1">
                    <span>{L('custom_volume')}</span>
                    <span className="font-mono-numbers text-stone-900 font-bold">{formulation.bottleVolumeMl} ml</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="500"
                    step="5"
                    value={formulation.bottleVolumeMl}
                    onChange={(e) =>
                      setFormulation((prev) => ({
                        ...prev,
                        bottleVolumeMl: parseInt(e.target.value) || 50,
                      }))
                    }
                    className="w-full accent-amber-800 cursor-pointer"
                  />
                </div>
              </div>

              {/* 2. Concentration Selection */}
              <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-bold text-stone-900 flex items-center gap-2">
                      <Scale className="w-4 h-4 text-amber-700" />
                      <span>{t('target_concentration', 'نسبة تركيز الزيت المستهدفة (%)')}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => toggleCriterion('concentration')}
                      className="px-2 py-0.5 rounded-full bg-amber-50 hover:bg-amber-100 border border-amber-300 text-[10px] font-bold text-amber-900 flex items-center gap-1 cursor-pointer transition-colors"
                      title={L('conc_guide_tip')}
                    >
                      <HelpCircle className="w-3 h-3 text-amber-700" />
                      <span>{L('criterion_guide')}</span>
                      {expandedCriteria['concentration'] ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                    </button>
                  </div>
                  <div className="text-xs text-stone-500">
                    {L('current_conc_lbl')}
                    <span className="font-bold text-amber-800 font-mono-numbers text-sm">
                      {formulation.concentrationPercent}%
                    </span>
                  </div>
                </div>

                {/* Inline Criterion Educational Box */}
                {expandedCriteria['concentration'] && (
                  <div className="p-3.5 bg-amber-50/80 rounded-xl border border-amber-200 text-xs text-stone-800 space-y-1.5 animate-in fade-in">
                    <div className="font-bold text-amber-950 flex items-center gap-1.5">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-700" />
                      <span>{L('conc_std')}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-stone-700">
                      {L('conc_std_note')}
                    </p>
                  </div>
                )}

                {/* Concentration Presets Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {CONCENTRATION_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleConcentrationTypeSelect(preset)}
                      className={`p-3 text-right rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        formulation.concentrationType === preset.id
                          ? 'bg-amber-950 text-white border-amber-800 shadow-sm'
                          : 'bg-stone-50 hover:bg-stone-100 text-stone-800 border-stone-200'
                      }`}
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="font-bold text-xs">
                          {isRTL ? preset.nameAr : preset.nameEn}
                        </span>
                        <span
                          className={`text-xs font-mono-numbers font-bold px-1.5 py-0.5 rounded ${
                            formulation.concentrationType === preset.id
                              ? 'bg-amber-800 text-amber-200'
                              : 'bg-stone-200 text-stone-700'
                          }`}
                        >
                          {preset.defaultPercentage}%
                        </span>
                      </div>
                      <span className="text-[10px] text-stone-400 mt-1 block truncate">
                        {isRTL ? preset.descriptionAr : preset.descriptionEn}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Custom Concentration Slider */}
                <div className="pt-2">
                  <div className="flex justify-between text-xs text-stone-500 mb-1">
                    <span>{L('fine_adjust')}</span>
                    <span className="font-mono-numbers text-stone-900 font-bold">{formulation.concentrationPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    step="0.5"
                    value={formulation.concentrationPercent}
                    onChange={(e) =>
                      setFormulation((prev) => ({
                        ...prev,
                        concentrationPercent: parseFloat(e.target.value) || 20,
                        concentrationType: 'custom',
                      }))
                    }
                    className="w-full accent-amber-800 cursor-pointer"
                  />
                </div>

                {/* IFRA International Standards Visual Warning System */}
                {hasIfraWarning ? (
                  <div
                    className="mt-3 p-4 rounded-xl border-2 border-rose-500/80 bg-gradient-to-br from-rose-950/20 via-amber-950/15 to-stone-900/40 text-stone-900 shadow-md animate-in fade-in space-y-3"
                    role="alert"
                    data-testid="ifra-warning-alert"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <div className="p-2 rounded-xl bg-rose-500/20 text-rose-600 border border-rose-400/40 shrink-0">
                          <ShieldAlert className="w-5 h-5 text-rose-600 animate-pulse" />
                        </div>
                        <div>
                          <h4 className="text-xs sm:text-sm font-extrabold text-rose-900 flex items-center gap-1.5 flex-wrap">
                            <span>{L('ifra_warning_title')}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              {formulation.concentrationPercent}%
                            </span>
                          </h4>
                          <p className="text-[11px] leading-relaxed text-rose-950 mt-1">
                            {fmt(L('ifra_warning_desc'), { c: formulation.concentrationPercent })}
                          </p>
                        </div>
                      </div>
                      {isOver30 && (
                        <button
                          type="button"
                          onClick={() =>
                            setFormulation((prev) => ({
                              ...prev,
                              concentrationPercent: 30,
                              concentrationType: 'extrait',
                            }))
                          }
                          className="self-start sm:self-center shrink-0 px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                          title="Auto-adjust to 30%"
                        >
                          <span>{L('ifra_adjust_safe')}</span>
                        </button>
                      )}
                    </div>

                    {/* Scientific risks breakdown */}
                    <div className="pt-2 border-t border-rose-200/60">
                      <div className="text-[11px] font-bold text-rose-900 mb-1.5 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        <span>{L('ifra_risk_title')}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px]">
                        <div className="p-2 rounded-lg bg-white/90 border border-rose-200 text-rose-900 flex items-start gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                          <span>{L('ifra_risk_skin')}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-white/90 border border-rose-200 text-rose-900 flex items-start gap-1.5">
                          <Droplets className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                          <span>{L('ifra_risk_atomizer')}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-white/90 border border-rose-200 text-rose-900 flex items-start gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                          <span>{L('ifra_risk_stain')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Restricted Ingredient Breaches */}
                    {restrictedNotesBreaches.length > 0 && (
                      <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-950 text-xs space-y-1">
                        <div className="font-bold text-[11px] flex items-center gap-1 text-amber-900">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                          <span>{L('ifra_restricted_detected')}</span>
                        </div>
                        {restrictedNotesBreaches.map((b, idx) => (
                          <div
                            key={idx}
                            className="text-[10px] text-amber-900 flex items-center justify-between border-b border-amber-200/60 pb-1 last:border-0 last:pb-0"
                          >
                            <span>{b.name} — {b.reason}</span>
                            <span className="font-mono-numbers font-bold text-rose-700">
                              {b.actualPct}% &gt; {b.limit}%
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className="mt-2.5 px-3 py-2 rounded-lg bg-emerald-50/90 border border-emerald-200/80 flex items-center justify-between text-xs text-emerald-900"
                    data-testid="ifra-safe-indicator"
                  >
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="text-[11px] font-semibold">{L('ifra_safe_badge')}</span>
                    </div>
                    <span className="text-[10px] font-mono-numbers font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded border border-emerald-300">
                      {formulation.concentrationPercent}% ≤ 30%
                    </span>
                  </div>
                )}

                {/* Visual Real-Time Raw Materials Weight Simulation Banner */}
                <div className="mt-3 p-3.5 bg-gradient-to-br from-amber-50 to-stone-50 border border-amber-200/90 rounded-xl space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-950 flex items-center gap-1.5">
                      <Scale className="w-4 h-4 text-amber-700 animate-pulse" />
                      <span>{L('live_scale_lbl')}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100/90 text-[10px] font-mono-numbers font-bold text-amber-900 border border-amber-300/70">
                      <span>{L('net_lbl')}</span>
                      <strong className="text-amber-950 font-extrabold">{formatNum(result.totalWeightGrams)} g</strong>
                    </span>
                  </div>

                  {/* Real-time Weight Chips per Material */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-white border border-amber-200/90 shadow-2xs">
                      <div className="text-[10px] font-bold text-amber-800 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-600 inline-block" />
                        <span>{L('oil_mass')}</span>
                      </div>
                      <div className="font-mono-numbers font-black text-amber-950 text-sm mt-0.5">
                        {formatNum(result.oilWeightGrams)} g
                      </div>
                      <div className="text-[10px] text-amber-700/80 font-mono-numbers">
                        {formatNum(result.oilVolumeMl)} ml · ~{Math.round(result.oilWeightGrams * 24)} {L('drops_word')}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white border border-stone-200 shadow-2xs">
                      <div className="text-[10px] font-bold text-stone-700 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-stone-400 inline-block" />
                        <span>{L('ethanol_mass')}</span>
                      </div>
                      <div className="font-mono-numbers font-black text-stone-900 text-sm mt-0.5">
                        {formatNum(result.alcoholWeightGrams)} g
                      </div>
                      <div className="text-[10px] text-stone-500 font-mono-numbers">
                        {formatNum(result.alcoholVolumeMl)} ml
                      </div>
                    </div>

                    {result.fixativeWeightGrams > 0 ? (
                      <div className="p-2.5 rounded-lg bg-white border border-emerald-200 shadow-2xs">
                        <div className="text-[10px] font-bold text-emerald-800 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
                          <span>{L('fixative_mass')}</span>
                        </div>
                        <div className="font-mono-numbers font-black text-emerald-950 text-sm mt-0.5">
                          {formatNum(result.fixativeWeightGrams)} g
                        </div>
                        <div className="text-[10px] text-emerald-600/80 font-mono-numbers">
                          {formatNum(result.fixativeVolumeMl)} ml
                        </div>
                      </div>
                    ) : (
                      <div className="p-2 rounded-lg bg-stone-100/70 border border-stone-200 text-stone-400 flex flex-col justify-center text-[10px]">
                        <span className="font-semibold">{L('fixative_zero')}</span>
                        <span className="text-[9px] text-stone-400">{L('optional_lbl')}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-1 flex items-center justify-between border-t border-amber-200/50">
                    <span className="text-[10px] text-stone-500">
                      {L('live_update_note')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveView('scale_simulator')}
                      className="text-[11px] text-amber-800 font-bold hover:text-amber-950 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>{L('full_simulator')}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. Alcohol Purity and Batch Count */}
              <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Alcohol Purity */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-stone-900 flex items-center gap-1">
                        <Droplets className="w-3.5 h-3.5 text-amber-700" />
                        <span>{t('alcohol_purity', 'درجة نقاء الكحول (% ABV)')}</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => toggleCriterion('alcohol_purity')}
                        className="text-[10px] text-amber-800 font-bold hover:underline cursor-pointer"
                      >
                        [{L('q_mark')}]
                      </button>
                    </div>
                    <select
                      value={formulation.alcoholPercentage}
                      onChange={(e) =>
                        setFormulation((prev) => ({
                          ...prev,
                          alcoholPercentage: parseInt(e.target.value) || 96,
                        }))
                      }
                      className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 font-semibold focus:outline-none"
                    >
                      <option value={96}>{L('ethanol_opt_96')}</option>
                      <option value={99}>{L('ethanol_opt_99')}</option>
                      <option value={95}>{L('ethanol_opt_95')}</option>
                    </select>
                    {expandedCriteria['alcohol_purity'] && (
                      <div className="p-2.5 mt-2 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-950 leading-relaxed">
                        {L('alcohol_note')}
                      </div>
                    )}
                  </div>

                  {/* Batch Production Count */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-stone-900 flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-amber-700" />
                        <span>{t('batch_count', 'عدد العبوات في التشغيلة')}</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => toggleCriterion('batch_count')}
                        className="text-[10px] text-amber-800 font-bold hover:underline cursor-pointer"
                      >
                        [{L('q_mark')}]
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="10000"
                        value={formulation.batchCount}
                        onChange={(e) =>
                          setFormulation((prev) => ({
                            ...prev,
                            batchCount: Math.max(1, parseInt(e.target.value) || 1),
                          }))
                        }
                        className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 font-bold font-mono-numbers focus:outline-none"
                      />
                      <span className="text-xs text-stone-500 font-medium whitespace-nowrap">
                        {L('bottles_word')}
                      </span>
                    </div>
                    {expandedCriteria['batch_count'] && (
                      <div className="p-2.5 mt-2 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-950 leading-relaxed">
                        {L('batch_note')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Maceration Period & Predicted Maturation Date Box */}
                <div className="mt-4 pt-4 border-t border-stone-200/80 bg-gradient-to-br from-amber-50/70 via-stone-50 to-amber-50/40 p-4 rounded-xl border border-amber-200/80 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Hourglass className="w-4 h-4 text-amber-800 shrink-0" />
                      <div>
                        <span className="font-bold text-xs text-stone-900 block">
                          {L('maceration_title')}
                        </span>
                        <span className="text-[10px] text-stone-500">
                          {L('maceration_desc')}
                        </span>
                      </div>
                    </div>

                    {onNavigateToTab && (
                      <button
                        type="button"
                        onClick={() => onNavigateToTab('maceration_simulator')}
                        className="px-2.5 py-1 rounded-lg bg-amber-800 hover:bg-amber-900 text-white font-bold text-[11px] flex items-center gap-1 shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
                      >
                        <Calendar className="w-3 h-3 text-amber-300" />
                        <span>{L('aging_sim_btn')}</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                    <div className="sm:col-span-5 flex items-center gap-2">
                      <div className="w-full">
                        <label className="text-[10px] font-bold text-stone-600 block mb-1">
                          {L('mac_days_lbl')}
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="3"
                            max="365"
                            value={macerationDays}
                            onChange={(e) => setMacerationDays?.(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-24 p-2 bg-white border border-stone-300 rounded-lg text-xs font-bold font-mono-numbers text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-800"
                          />
                          <span className="text-xs text-stone-500 font-medium">
                            {L('days_word')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="sm:col-span-7 bg-white p-2.5 rounded-lg border border-amber-300/80 shadow-2xs space-y-0.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-semibold text-stone-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-amber-700" />
                          <span>{L('maturity_date_lbl')}</span>
                        </span>
                        <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded text-[9px] border border-emerald-200">
                          {L('system_auto')}
                        </span>
                      </div>
                      <div className="font-bold text-xs text-stone-950 font-serif-luxury">
                        {new Date(Date.now() + (macerationDays || 30) * 86400000).toLocaleDateString(LOCALE_MAP[effectiveLang], {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Advanced Chemical & Solvents Accordion */}
              <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm space-y-4">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full flex items-center justify-between text-sm font-semibold text-stone-900 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-amber-700" />
                    <span>{L('advanced_chem')}</span>
                  </div>
                  <span className="text-xs text-amber-800 font-bold">
                    {showAdvanced
                      ? L('hide_settings')
                      : L('customize_settings')}
                  </span>
                </button>

                {showAdvanced && (
                  <div className="pt-3 border-t border-stone-100 space-y-4 animate-in fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Distilled Water */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-xs font-medium text-stone-700 flex items-center gap-1">
                            <Droplets className="w-3.5 h-3.5 text-sky-500" />
                            <span>{t('distilled_water', 'ماء مقطر')} (Distilled Water)</span>
                          </label>
                          <span className="font-mono-numbers text-stone-900 text-xs font-bold">{formulation.waterPercent}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="10"
                          step="0.5"
                          value={formulation.waterPercent}
                          onChange={(e) =>
                            setFormulation((prev) => ({
                              ...prev,
                              waterPercent: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="w-full accent-amber-800 cursor-pointer mt-1"
                        />
                        <p className="text-[10px] text-stone-500 mt-1">
                          {L('water_benchmark')}
                        </p>
                      </div>

                      {/* Fixative */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-xs font-medium text-stone-700 flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{t('fixative_ratio', 'مثبت عطري')} (DPG / IPM / Iso E)</span>
                          </label>
                          <span className="font-mono-numbers text-stone-900 text-xs font-bold">{formulation.fixativePercent}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="5"
                          step="0.5"
                          value={formulation.fixativePercent}
                          onChange={(e) =>
                            setFormulation((prev) => ({
                              ...prev,
                              fixativePercent: parseFloat(e.target.value) || 1,
                            }))
                          }
                          className="w-full accent-amber-800 cursor-pointer mt-1"
                        />
                        <p className="text-[10px] text-stone-500 mt-1">
                          {L('fixative_benchmark')}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      {/* Oil Density */}
                      <div>
                        <label className="text-xs font-medium text-stone-700 block mb-1">
                          {L('oil_sg_lbl')}
                        </label>
                        <input
                          type="number"
                          min="0.80"
                          max="1.10"
                          step="0.01"
                          value={formulation.oilDensity}
                          onChange={(e) =>
                            setFormulation((prev) => ({
                              ...prev,
                              oilDensity: parseFloat(e.target.value) || 0.92,
                            }))
                          }
                          className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono-numbers text-stone-900"
                        />
                        <span className="text-[10px] text-stone-400 block mt-0.5">
                          {L('oil_sg_note')}
                        </span>
                      </div>

                      {/* Alcohol Density */}
                      <div>
                        <label className="text-xs font-medium text-stone-700 block mb-1">
                          {L('ethanol_sg_lbl')}
                        </label>
                        <input
                          type="number"
                          min="0.75"
                          max="0.85"
                          step="0.01"
                          value={formulation.alcoholDensity}
                          onChange={(e) =>
                            setFormulation((prev) => ({
                              ...prev,
                              alcoholDensity: parseFloat(e.target.value) || 0.80,
                            }))
                          }
                          className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono-numbers text-stone-900"
                        />
                        <span className="text-[10px] text-stone-400 block mt-0.5">
                          {L('ethanol_sg_note')}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Right Column: Live Results & Spec Card */}
            <div className="lg:col-span-5 space-y-6">

              {/* Results Summary Box */}
              <div className="bg-white p-6 rounded-2xl border border-stone-200/90 shadow-md space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                  <div>
                    <h3 className="font-bold text-stone-950 text-base">
                      {t('result_card_title', 'نتائج ومقادير الخلط الدقيقة')}
                    </h3>
                    <div className="text-xs text-stone-500 mt-0.5">
                      {formulation.bottleVolumeMl} ml · {formulation.concentrationPercent}%
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={copyRecipeToClipboard}
                    className="px-3 py-1.5 text-xs text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : null}
                    <span>
                      {copiedSummary
                        ? L('copied_lbl')
                        : L('copy_recipe_lbl')}
                    </span>
                  </button>
                </div>

                {/* Visual Ingredient Breakdown Ratio Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-medium text-stone-600">
                    <span>{L('breakdown_lbl')}</span>
                    <span className="font-mono-numbers font-bold text-stone-900">100%</span>
                  </div>
                  <div className="h-4 rounded-full overflow-hidden flex bg-stone-100 p-0.5 border border-stone-200">
                    <div
                      style={{ width: `${result.oilPercent}%` }}
                      className="bg-amber-600 h-full rounded-r-full transition-all"
                      title={`Oil: ${result.oilPercent}%`}
                    />
                    <div
                      style={{ width: `${result.alcoholPercent}%` }}
                      className="bg-stone-400 h-full transition-all"
                      title={`Ethanol: ${result.alcoholPercent}%`}
                    />
                    {result.waterPercent > 0 && (
                      <div
                        style={{ width: `${result.waterPercent}%` }}
                        className="bg-sky-400 h-full transition-all"
                        title={`Water: ${result.waterPercent}%`}
                      />
                    )}
                    {result.fixativePercent > 0 && (
                      <div
                        style={{ width: `${result.fixativePercent}%` }}
                        className="bg-emerald-600 h-full rounded-l-full transition-all"
                        title={`Fixative: ${result.fixativePercent}%`}
                      />
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-stone-500 pt-1">
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-xs bg-amber-600 inline-block" />
                      {t('result_oil', 'زيت عطري')} ({formatNum(result.oilPercent, 1)}%)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-xs bg-stone-400 inline-block" />
                      {t('result_alcohol', 'كحول')} ({formatNum(result.alcoholPercent, 1)}%)
                    </span>
                    {result.waterPercent > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-xs bg-sky-400 inline-block" />
                        {t('result_water', 'ماء')} ({formatNum(result.waterPercent, 1)}%)
                      </span>
                    )}
                    {result.fixativePercent > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
                        {t('result_fixative', 'مثبت')} ({formatNum(result.fixativePercent, 1)}%)
                      </span>
                    )}
                  </div>
                </div>

                {/* Detailed Ingredients Table */}
                <div className="space-y-3 pt-2">
                  <div className="text-xs font-semibold text-stone-900">
                    {fmt(L('single_bottle_tpl'), { v: formulation.bottleVolumeMl })}
                  </div>
                  <div className="divide-y divide-stone-100 border border-stone-200/70 rounded-xl overflow-hidden bg-stone-50/50">
                    
                    {/* Fragrance Oil */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-600" />
                          {t('result_oil', 'الزيت العطري الخام')}
                        </div>
                        <div className="text-[11px] text-stone-500">
                          {L('volumetric_lbl')}
                          <span className="font-mono-numbers">{formatNum(result.oilVolumeMl)} ml</span>
                        </div>
                      </div>
                      <div className="text-left font-mono-numbers">
                        <div className="text-base font-bold text-amber-900">
                          {formatNum(result.oilWeightGrams)} g
                        </div>
                        <div className="text-[10px] text-stone-400">{L('scale_mass_lbl')}</div>
                      </div>
                    </div>

                    {/* Ethanol Alcohol */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-stone-400" />
                          {t('result_alcohol', 'الكحول الإيثيلي (Ethanol)')}
                        </div>
                        <div className="text-[11px] text-stone-500">
                          {L('volumetric_lbl')}
                          <span className="font-mono-numbers">{formatNum(result.alcoholVolumeMl)} ml</span>
                        </div>
                      </div>
                      <div className="text-left font-mono-numbers">
                        <div className="text-base font-bold text-stone-900">
                          {formatNum(result.alcoholWeightGrams)} g
                        </div>
                        <div className="text-[10px] text-stone-400">{L('scale_mass_lbl')}</div>
                      </div>
                    </div>

                    {/* Distilled Water */}
                    {result.waterPercent > 0 && (
                      <div className="p-3.5 flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-sky-900 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-sky-400" />
                            {t('result_water', 'ماء مقطر نقي')}
                          </div>
                          <div className="text-[11px] text-stone-500">
                            {formatNum(result.waterVolumeMl)} ml
                          </div>
                        </div>
                        <div className="text-left font-mono-numbers">
                          <div className="text-sm font-bold text-sky-900">
                            {formatNum(result.waterWeightGrams)} g
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Fixative */}
                    {result.fixativePercent > 0 && (
                      <div className="p-3.5 flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-600" />
                            {t('result_fixative', 'مثبت عطري (DPG/IPM)')}
                          </div>
                          <div className="text-[11px] text-stone-500">
                            {formatNum(result.fixativeVolumeMl)} ml
                          </div>
                        </div>
                        <div className="text-left font-mono-numbers">
                          <div className="text-sm font-bold text-emerald-900">
                            {formatNum(result.fixativeWeightGrams)} g
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Total Net Row */}
                    <div className="p-3.5 bg-stone-100/80 flex items-center justify-between">
                      <div className="text-xs font-bold text-stone-900">
                        {t('result_total_mass', 'الوزن الصافي الإجمالي للعطر')}
                      </div>
                      <div className="text-left font-mono-numbers">
                        <div className="text-base font-extrabold text-stone-900">
                          {formatNum(result.totalWeightGrams)} g
                        </div>
                        <div className="text-[10px] text-stone-500">
                          {result.totalVolumeMl} ml
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Batch Production Totals (if batchCount > 1) */}
                {formulation.batchCount > 1 && (
                  <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-950">
                        {fmt(L('batch_total_tpl'), { n: formulation.batchCount })}
                      </span>
                      <span className="text-xs font-mono-numbers font-semibold text-amber-900">
                        {formatNum(result.batchTotalVolumeMl / 1000, 2)} L
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                      <div className="bg-white p-2.5 rounded-lg border border-amber-100">
                        <span className="text-stone-500 block text-[11px]">
                          {L('total_oil_lbl')}
                        </span>
                        <span className="font-mono-numbers font-bold text-amber-900 text-sm">
                          {result.batchTotalOilGrams >= 1000
                            ? `${formatNum(result.batchTotalOilGrams / 1000, 3)} kg`
                            : `${formatNum(result.batchTotalOilGrams)} g`}
                        </span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-amber-100">
                        <span className="text-stone-500 block text-[11px]">
                          {L('total_alcohol_lbl')}
                        </span>
                        <span className="font-mono-numbers font-bold text-stone-900 text-sm">
                          {result.batchTotalAlcoholGrams >= 1000
                            ? `${formatNum(result.batchTotalAlcoholGrams / 1000, 3)} kg`
                            : `${formatNum(result.batchTotalAlcoholGrams)} g`}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ======================================================== */}
                {/* 1. AUTOMATIC REAL-TIME RAW MATERIALS COST DISPLAY        */}
                {/* ======================================================== */}
                <div className="p-4 sm:p-5 bg-gradient-to-br from-amber-500/10 via-amber-50 to-stone-50 border-2 border-amber-300/80 rounded-2xl space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-700 text-white flex items-center justify-center font-bold text-sm shadow-2xs">
                        <DollarSign className="w-4 h-4 text-amber-100" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-amber-950 flex items-center gap-2">
                          <span>{L('live_cost_lbl')}</span>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse">
                            {L('live_word')}
                          </span>
                        </h4>
                        <span className="text-[10px] text-stone-500">
                          {fmt(L('cost_note_tpl'), { c: activeCurrency })}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowPriceConfig(!showPriceConfig)}
                      className="px-2.5 py-1 text-[11px] rounded-lg bg-white border border-amber-200 text-amber-900 font-semibold hover:bg-amber-100 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <Sliders className="w-3 h-3 text-amber-700" />
                      <span>{showPriceConfig ? (L('hide_prices')) : (L('adjust_prices'))}</span>
                    </button>
                  </div>

                  {/* Primary Total Cost Highlights */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-white p-3.5 rounded-xl border border-amber-200/90 shadow-2xs">
                      <div className="text-[11px] font-medium text-stone-500 mb-0.5">
                        {L('cost_per_bottle_lbl')}
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-extrabold text-amber-950 font-mono-numbers">
                          {formatNum(rawCostTotalSingle, 2)}
                        </span>
                        <span className="text-xs font-bold text-amber-800">
                          {activeCurrency}
                        </span>
                        <span className="text-[10px] text-stone-400 font-mono-numbers">
                          / {formulation.bottleVolumeMl} ml
                        </span>
                      </div>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-amber-200/90 shadow-2xs">
                      <div className="text-[11px] font-medium text-stone-500 mb-0.5">
                        {fmt(L('batch_cost_tpl'), { n: formulation.batchCount })}
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-extrabold text-stone-900 font-mono-numbers">
                          {formatNum(rawCostTotalBatch, 2)}
                        </span>
                        <span className="text-xs font-bold text-amber-800">
                          {activeCurrency}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Itemized Cost Breakdown */}
                  <div className="space-y-1.5 pt-1 text-xs">
                    <div className="text-[11px] font-bold text-stone-700 flex items-center justify-between">
                      <span>{L('itemized_lbl')}</span>
                      <span className="font-mono-numbers text-stone-400 text-[10px]">
                        100% {L('of_materials')}
                      </span>
                    </div>

                    <div className="bg-white rounded-xl border border-stone-200 divide-y divide-stone-100 overflow-hidden text-[11px]">
                      {/* Oil Cost */}
                      <div className="p-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-xs bg-amber-600 inline-block" />
                          <span className="font-semibold text-stone-800">
                            {L('oil_cost_lbl')}
                          </span>
                          <span className="text-[10px] text-stone-400 font-mono-numbers">
                            ({formatNum(result.oilWeightGrams, 2)}g @ {oilPricePerKg} {activeCurrency}/kg)
                          </span>
                        </div>
                        <div className="text-left font-mono-numbers font-bold text-amber-900">
                          {formatNum(rawCostOil, 2)} {activeCurrency}
                          <span className="text-[9px] text-stone-400 font-normal ml-1">
                            ({rawCostTotalSingle > 0 ? Math.round((rawCostOil / rawCostTotalSingle) * 100) : 0}%)
                          </span>
                        </div>
                      </div>

                      {/* Alcohol Cost */}
                      <div className="p-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-xs bg-stone-400 inline-block" />
                          <span className="font-semibold text-stone-800">
                            {L('ethanol_mass')}
                          </span>
                          <span className="text-[10px] text-stone-400 font-mono-numbers">
                            ({formatNum(result.alcoholVolumeMl, 1)}ml @ {alcoholPricePerLiter} {activeCurrency}/L)
                          </span>
                        </div>
                        <div className="text-left font-mono-numbers font-bold text-stone-900">
                          {formatNum(rawCostAlcohol, 2)} {activeCurrency}
                          <span className="text-[9px] text-stone-400 font-normal ml-1">
                            ({rawCostTotalSingle > 0 ? Math.round((rawCostAlcohol / rawCostTotalSingle) * 100) : 0}%)
                          </span>
                        </div>
                      </div>

                      {/* Fixative Cost */}
                      {result.fixativeWeightGrams > 0 && (
                        <div className="p-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
                            <span className="font-semibold text-emerald-950">
                              {L('fixative_mass')}
                            </span>
                            <span className="text-[10px] text-stone-400 font-mono-numbers">
                              ({formatNum(result.fixativeWeightGrams, 2)}g @ {fixativePricePerKg} {activeCurrency}/kg)
                            </span>
                          </div>
                          <div className="text-left font-mono-numbers font-bold text-emerald-900">
                            {formatNum(rawCostFixative, 2)} {activeCurrency}
                          </div>
                        </div>
                      )}

                      {/* Water Cost */}
                      {result.waterVolumeMl > 0 && (
                        <div className="p-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-xs bg-sky-400 inline-block" />
                            <span className="font-semibold text-sky-950">
                              {L('water_cost_lbl')}
                            </span>
                            <span className="text-[10px] text-stone-400 font-mono-numbers">
                              ({formatNum(result.waterVolumeMl, 1)}ml @ {waterPricePerLiter} {activeCurrency}/L)
                            </span>
                          </div>
                          <div className="text-left font-mono-numbers font-bold text-sky-900">
                            {formatNum(rawCostWater, 2)} {activeCurrency}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Customizable Benchmark Pricing Drawer */}
                  {showPriceConfig && (
                    <div className="p-3.5 bg-white rounded-xl border border-amber-200/90 space-y-3 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-900 flex items-center gap-1">
                          <Sliders className="w-3.5 h-3.5 text-amber-700" />
                          <span>{L('price_config_lbl')}</span>
                        </span>
                        <span className="text-[10px] text-stone-400 font-medium">
                          {L('autosave_note')}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="text-[11px] font-medium text-stone-600 block mb-1">
                            {fmt(L('oil_price_tpl'), { c: activeCurrency })}
                          </label>
                          <input
                            type="number"
                            min="10"
                            step="5"
                            value={oilPricePerKg}
                            onChange={(e) => handleUpdatePrice('oil', parseFloat(e.target.value) || 0)}
                            className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg font-mono-numbers font-bold text-stone-900 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-medium text-stone-600 block mb-1">
                            {fmt(L('ethanol_price_tpl'), { c: activeCurrency })}
                          </label>
                          <input
                            type="number"
                            min="5"
                            step="2"
                            value={alcoholPricePerLiter}
                            onChange={(e) => handleUpdatePrice('alcohol', parseFloat(e.target.value) || 0)}
                            className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg font-mono-numbers font-bold text-stone-900 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-medium text-stone-600 block mb-1">
                            {fmt(L('fixative_price_tpl'), { c: activeCurrency })}
                          </label>
                          <input
                            type="number"
                            min="10"
                            step="5"
                            value={fixativePricePerKg}
                            onChange={(e) => handleUpdatePrice('fixative', parseFloat(e.target.value) || 0)}
                            className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg font-mono-numbers font-bold text-stone-900 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-medium text-stone-600 block mb-1">
                            {fmt(L('water_price_tpl'), { c: activeCurrency })}
                          </label>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={waterPricePerLiter}
                            onChange={(e) => handleUpdatePrice('water', parseFloat(e.target.value) || 0)}
                            className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg font-mono-numbers font-bold text-stone-900 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ======================================================== */}
                {/* 2. VISUAL REAL-TIME SCALE & BEAKER SIMULATOR PREVIEW     */}
                {/* ======================================================== */}
                <div className="p-4 sm:p-5 bg-stone-900 text-white rounded-2xl border border-stone-800 shadow-md space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm border border-amber-500/30">
                        <Scale className="w-4 h-4 text-amber-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-stone-100 flex items-center gap-2">
                          <span>{L('visual_scale_lbl')}</span>
                          <span className="text-[9px] font-mono-numbers px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-300 border border-amber-700/50">
                            ± 0.01 g
                          </span>
                        </h4>
                        <span className="text-[10px] text-stone-400">
                          {L('visual_scale_desc')}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveView('scale_simulator')}
                      className="px-2.5 py-1 text-[11px] rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>{L('full_lab_view')}</span>
                    </button>
                  </div>

                  {/* Digital Balance Pan & LCD Display */}
                  <div className="bg-stone-950 p-4 rounded-xl border border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                    {/* Visual Beaker with layered liquids */}
                    <div className="flex items-center gap-3">
                      <div className="relative w-16 h-28 bg-stone-900/90 rounded-b-xl border-2 border-stone-600/60 overflow-hidden flex flex-col justify-end shadow-inner">
                        {/* Graduated Markings */}
                        <div className="absolute inset-y-0 right-1 flex flex-col justify-between py-2 text-[8px] font-mono-numbers text-stone-500 pointer-events-none select-none">
                          <span>-</span>
                          <span>-</span>
                          <span>-</span>
                          <span>-</span>
                        </div>

                        {/* Liquid Layers */}
                        {result.waterPercent > 0 && (
                          <div
                            style={{ height: `${result.waterPercent}%` }}
                            className="w-full bg-sky-400/80 transition-all duration-300 border-b border-sky-300/40"
                            title={`Distilled Water: ${formatNum(result.waterWeightGrams)}g`}
                          />
                        )}
                        {result.fixativePercent > 0 && (
                          <div
                            style={{ height: `${result.fixativePercent}%` }}
                            className="w-full bg-emerald-500/80 transition-all duration-300 border-b border-emerald-300/40"
                            title={`Fixative: ${formatNum(result.fixativeWeightGrams)}g`}
                          />
                        )}
                        <div
                          style={{ height: `${result.alcoholPercent}%` }}
                          className="w-full bg-cyan-600/70 transition-all duration-300 border-b border-cyan-400/40"
                          title={`Ethanol Alcohol: ${formatNum(result.alcoholWeightGrams)}g`}
                        />
                        <div
                          style={{ height: `${result.oilPercent}%` }}
                          className="w-full bg-amber-500/90 transition-all duration-300 shadow-sm"
                          title={`Fragrance Oil: ${formatNum(result.oilWeightGrams)}g`}
                        />
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          <span>{L('oil_colon')}</span>
                          <span className="font-mono-numbers text-white font-extrabold">{formatNum(result.oilWeightGrams)} g</span>
                          <span className="text-[10px] text-stone-400 font-mono-numbers">({formatNum(result.oilVolumeMl)} ml · ~{Math.round(result.oilWeightGrams * 24)} {L('drops_word')})</span>
                        </div>
                        <div className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-cyan-400" />
                          <span>{L('ethanol_colon')}</span>
                          <span className="font-mono-numbers text-white font-extrabold">{formatNum(result.alcoholWeightGrams)} g</span>
                          <span className="text-[10px] text-stone-400 font-mono-numbers">({formatNum(result.alcoholVolumeMl)} ml)</span>
                        </div>
                        {result.fixativeWeightGrams > 0 && (
                          <div className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            <span>{L('fixative_colon')}</span>
                            <span className="font-mono-numbers text-white">{formatNum(result.fixativeWeightGrams)} g</span>
                          </div>
                        )}
                        {result.waterWeightGrams > 0 && (
                          <div className="text-[11px] font-bold text-sky-300 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-sky-400" />
                            <span>{L('water_colon')}</span>
                            <span className="font-mono-numbers text-white">{formatNum(result.waterWeightGrams)} g</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* LCD Balance Screen with Tare Button */}
                    <div className="bg-black/90 p-3.5 rounded-xl border border-stone-700/80 text-center space-y-2 min-w-[140px] shadow-inner">
                      <div className="text-[9px] text-emerald-400 font-mono flex items-center justify-between px-1">
                        <span>STABLE</span>
                        <span>0.01g</span>
                      </div>
                      <div className="font-mono-numbers text-2xl font-black text-emerald-400 tracking-wider">
                        {isLiveScaleTared ? '0.00' : formatNum(result.totalWeightGrams)}
                        <span className="text-xs text-emerald-600 font-bold ml-1">g</span>
                      </div>
                      <div className="flex items-center justify-center gap-2 pt-1 border-t border-stone-800">
                        <button
                          type="button"
                          onClick={() => setIsLiveScaleTared(!isLiveScaleTared)}
                          className={`px-2.5 py-0.5 rounded text-[10px] font-bold font-mono transition-colors cursor-pointer ${
                            isLiveScaleTared
                              ? 'bg-emerald-600 text-white'
                              : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
                          }`}
                        >
                          {L('tare_lbl')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Direct Action Buttons */}
                <div className="space-y-2 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={onSaveFormula}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5 text-amber-400" />
                      <span>{t('action_save', 'حفظ في الوصفات')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={onSendToCosting}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-amber-800 hover:bg-amber-900 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>{t('action_costing', 'حساب التكلفة والأرباح')}</span>
                    </button>
                  </div>

                  {/* Switch to Pyramid Graphic Button */}
                  <button
                    type="button"
                    onClick={() => setActiveView('pyramid_graphic')}
                    className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
                  >
                    <Wind className="w-4 h-4 text-stone-900" />
                    <span>
                      {L('cta_pyramid')}
                    </span>
                  </button>

                  {/* Criteria Guide Button */}
                  <button
                    type="button"
                    onClick={() => setActiveView('criteria_guide')}
                    className="w-full py-2 px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-amber-700" />
                    <span>
                      {L('cta_criteria')}
                    </span>
                  </button>

                  {/* Maceration Time Simulator Direct Button */}
                  {onNavigateToTab && (
                    <button
                      type="button"
                      onClick={() => onNavigateToTab('maceration_simulator')}
                      className="w-full py-2.5 px-3 bg-gradient-to-r from-amber-900 to-stone-900 hover:from-amber-950 hover:to-black text-amber-300 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer border border-amber-500/30"
                    >
                      <Hourglass className="w-4 h-4 text-amber-400" />
                      <span>
                        {L('cta_aging')}
                      </span>
                    </button>
                  )}

                  {/* Ask Shahin AI Button */}
                  <button
                    type="button"
                    onClick={() => {
                      const expectedDate = localeDate(
                        effectiveLang,
                        new Date(Date.now() + (macerationDays || 30) * 86400000),
                        {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        }
                      );
                      const prompt = fmt(L('shahin_prompt_tpl'), {
                        c: formulation.concentrationPercent,
                        v: formulation.bottleVolumeMl,
                        ow: result.oilWeightGrams.toFixed(2),
                        aw: result.alcoholWeightGrams.toFixed(2),
                        d: macerationDays,
                        date: expectedDate,
                      });
                      window.dispatchEvent(new CustomEvent('open-ai-chat-with-prompt', { detail: prompt }));
                    }}
                    className="w-full py-2.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer border border-amber-300/80"
                  >
                    <Bot className="w-4 h-4 text-amber-800" />
                    <span>
                      {L('cta_shahin')}
                    </span>
                  </button>
                </div>

              </div>

              {/* Quick Laboratory Note */}
              <div className="bg-stone-50 p-4 rounded-xl border border-stone-200/70 text-xs text-stone-600 space-y-2">
                <div className="font-semibold text-stone-900 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>
                    {L('grav_std')}
                  </span>
                </div>
                <p className="leading-relaxed text-[11px]">
                  {L('grav_std_note')}
                </p>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};
