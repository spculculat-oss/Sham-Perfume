import React, { useEffect, useState } from 'react';
import { Printer, X, CheckCircle, Calendar, Hash, User, ShieldCheck, ArrowRight, ArrowLeft, Copy, Check } from 'lucide-react';
import {
  CalculationResult,
  FormulationState,
  PyramidNote,
  SavedFormula,
} from '../types/perfume';
import { calculatePyramidBreakdown, formatNum } from '../utils/calculations';

import { UserDetailedAddress, FACILITY_TYPE_LABELS } from '../types/address';
import { SupportedLanguage } from '../types/i18n';
import { isRTL, getCommonLabel } from '../utils/localizedContent';
import { LText, makeT, fmt, pickArEn } from '../utils/localize';

interface ManufacturingSpecSheetProps {
  formulaTitle: string;
  author: string;
  batchCode: string;
  notes: string;
  macerationDays: number;
  formulation: FormulationState;
  pyramidNotes: PyramidNote[];
  calculationResult: CalculationResult;
  detailedAddress?: UserDetailedAddress;
  currentLang?: SupportedLanguage;
  onClose: () => void;
}


const S = {
  doc_title: {
    ar: 'بطاقة مواصفات تصنيع العطر الرسمية (Batch Spec Sheet)',
    en: 'Official Perfume Batch Manufacturing Spec Sheet',
    fr: 'Fiche technique officielle de fabrication (Batch)',
    es: 'Ficha oficial de especificaciones de fabricación',
    it: 'Scheda tecnica ufficiale di produzione',
    de: 'Offizielles Produktionsdatenblatt',
    ru: 'Официальная техкарта производства партии',
    zh: '官方香水生产规格单（批次表）',
    tr: 'Resmi üretim spesifikasyon kartı',
    fa: 'کارت مشخصات رسمی تولید عطر (Spec Sheet)',
  },
  copy_tooltip: {
    ar: 'نسخ ملخص البطاقة',
    en: 'Copy summary',
    fr: 'Copier le résumé',
    es: 'Copiar resumen',
    it: 'Copia riepilogo',
    de: 'Zusammenfassung kopieren',
    ru: 'Скопировать сводку',
    zh: '复制摘要',
    tr: 'Özeti kopyala',
    fa: 'کپی خلاصه کارت',
  },
  copied: {
    ar: 'تم النسخ!',
    en: 'Copied!',
    fr: 'Copié !',
    es: '¡Copiado!',
    it: 'Copiato!',
    de: 'Kopiert!',
    ru: 'Скопировано!',
    zh: '已复制！',
    tr: 'Kopyalandı!',
    fa: 'کپی شد!',
  },
  copy: {
    ar: 'نسخ',
    en: 'Copy',
    fr: 'Copier',
    es: 'Copiar',
    it: 'Copia',
    de: 'Kopieren',
    ru: 'Копировать',
    zh: '复制',
    tr: 'Kopyala',
    fa: 'کپی',
  },
  print_btn: {
    ar: 'طباعة',
    en: 'Print Spec Sheet',
    fr: 'Imprimer la fiche',
    es: 'Imprimir ficha',
    it: 'Stampa scheda',
    de: 'Datenblatt drucken',
    ru: 'Печать техкарты',
    zh: '打印规格单',
    tr: 'Kartı yazdır',
    fa: 'چاپ کارت',
  },
  close: {
    ar: 'إغلاق ✕',
    en: 'Close ✕',
    fr: 'Fermer ✕',
    es: 'Cerrar ✕',
    it: 'Chiudi ✕',
    de: 'Schließen ✕',
    ru: 'Закрыть ✕',
    zh: '关闭 ✕',
    tr: 'Kapat ✕',
    fa: 'بستن ✕',
  },
  close_tooltip: {
    ar: 'إغلاق التقرير (Escape)',
    en: 'Close (Escape)',
    fr: 'Fermer (Échap)',
    es: 'Cerrar (Escape)',
    it: 'Chiudi (Escape)',
    de: 'Schließen (Esc)',
    ru: 'Закрыть (Escape)',
    zh: '关闭（Esc）',
    tr: 'Kapat (Escape)',
    fa: 'بستن گزارش (Escape)',
  },
  brand: {
    ar: 'صمم عطرك مع شام · مختبر وحاسبة العطور',
    en: 'Sham Perfume Atelier & Compounding Laboratory',
    fr: 'Sham · Laboratoire et calculateur de parfumerie',
    es: 'Sham · Laboratorio y calculadora de perfumería',
    it: 'Sham · Laboratorio e calcolatore di profumeria',
    de: 'Sham · Parfümlabor & Rechner',
    ru: 'Sham · Лаборатория и калькулятор парфюмерии',
    zh: 'Sham · 香水实验室与计算器',
    tr: 'Sham · Parfüm laboratuvarı ve hesaplayıcı',
    fa: 'شام · آزمایشگاه و ماشین‌حساب عطر',
  },
  doc_type: {
    ar: 'وثيقة تصنيع وتشغيلة إنتاج عطرية معتمدة وفق معايير الجودة والتعتيق',
    en: 'Certified Production Batch Specification & Quality Control Document',
    fr: 'Document certifié de spécification de lot et contrôle qualité',
    es: 'Documento certificado de especificación y control de calidad',
    it: 'Documento certificato di specifica e controllo qualità',
    de: 'Zertifizierte Chargenspezifikation & Qualitätskontrolle',
    ru: 'Сертифицированная спецификация партии и контроль качества',
    zh: '经认证的生产批次规格与质量控制文件',
    tr: 'Sertifikalı parti spesifikasyonu ve kalite kontrol belgesi',
    fa: 'سند تولید معتبر و مشخصات پارت مطابق استانداردهای کیفیت و کهنه‌سازی',
  },
  batch_id: {
    ar: 'رقم التشغيلة: ',
    en: 'Batch ID: ',
    fr: 'N° de lot : ',
    es: 'ID de lote: ',
    it: 'ID lotto: ',
    de: 'Chargen-Nr.: ',
    ru: 'Номер партии: ',
    zh: '批次编号：',
    tr: 'Parti No: ',
    fa: 'شماره پارت: ',
  },
  date_issued: {
    ar: 'تاريخ الإصدار: ',
    en: 'Date Issued: ',
    fr: 'Date d’émission : ',
    es: 'Fecha de emisión: ',
    it: 'Data di emissione: ',
    de: 'Ausstellungsdatum: ',
    ru: 'Дата выпуска: ',
    zh: '签发日期：',
    tr: 'Yayın tarihi: ',
    fa: 'تاریخ صدور: ',
  },
  maceration_done: {
    ar: 'اكتمال التعتيق: ',
    en: 'Target Maceration: ',
    fr: 'Fin de macération : ',
    es: 'Fin de maceración: ',
    it: 'Fine macerazione: ',
    de: 'Reifungsende: ',
    ru: 'Завершение мацерации: ',
    zh: '陈化完成：',
    tr: 'Dinlendirme bitişi: ',
    fa: 'پایان کهنه‌سازی: ',
  },
  days: {
    ar: 'يوم',
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
  frag_title: {
    ar: 'اسم العطر',
    en: 'Fragrance Title',
    fr: 'Nom du parfum',
    es: 'Nombre del perfume',
    it: 'Nome del profumo',
    de: 'Duftname',
    ru: 'Название аромата',
    zh: '香水名称',
    tr: 'Parfüm adı',
    fa: 'نام عطر',
  },
  default_title: {
    ar: 'عطر مخصص',
    en: 'Bespoke Perfume',
    fr: 'Parfum sur mesure',
    es: 'Perfume a medida',
    it: 'Profumo su misura',
    de: 'Maßgeschneiderter Duft',
    ru: 'Индивидуальный парфюм',
    zh: '定制香水',
    tr: 'Özel parfüm',
    fa: 'عطر سفارشی',
  },
  perfumer_lbl: {
    ar: 'مصمم العطر / المعمل',
    en: 'Perfumer / Atelier',
    fr: 'Parfumeur / Atelier',
    es: 'Perfumista / Atelier',
    it: 'Profumiere / Atelier',
    de: 'Parfümeur / Atelier',
    ru: 'Парфюмер / Ателье',
    zh: '调香师/工作室',
    tr: 'Parfümör / Atölye',
    fa: 'طراح عطر / آزمایشگاه',
  },
  default_author: {
    ar: 'معمل شام',
    en: 'Sham Atelier',
    fr: 'Atelier Sham',
    es: 'Atelier Sham',
    it: 'Atelier Sham',
    de: 'Sham Atelier',
    ru: 'Ателье Sham',
    zh: 'Sham 工作室',
    tr: 'Sham Atölyesi',
    fa: 'آزمایشگاه شام',
  },
  volume_batch: {
    ar: 'حجم الزجاجة والكمية',
    en: 'Bottle Volume & Batch',
    fr: 'Volume du flacon et lot',
    es: 'Volumen del frasco y lote',
    it: 'Volume flacone e lotto',
    de: 'Flakonvolumen & Charge',
    ru: 'Объём флакона и партия',
    zh: '瓶装容量与批量',
    tr: 'Şişe hacmi ve parti',
    fa: 'حجم بطری و تعداد',
  },
  bottles: {
    ar: 'عبوة',
    en: 'Bottles',
    fr: 'flacons',
    es: 'frascos',
    it: 'flaconi',
    de: 'Flakons',
    ru: 'флаконов',
    zh: '瓶',
    tr: 'şişe',
    fa: 'عدد',
  },
  conc_class: {
    ar: 'فئة التركيز',
    en: 'Concentration',
    fr: 'Concentration',
    es: 'Concentración',
    it: 'Concentrazione',
    de: 'Konzentration',
    ru: 'Концентрация',
    zh: '浓度等级',
    tr: 'Konsantrasyon',
    fa: 'دسته غلظت',
  },
  facility_default: {
    ar: 'مقر المعمل العطري',
    en: 'Atelier Facility',
    fr: 'Locaux de l’atelier',
    es: 'Instalación del atelier',
    it: 'Sede dell’atelier',
    de: 'Atelier-Standort',
    ru: 'Помещение ателье',
    zh: '工作室地址',
    tr: 'Atölye tesisi',
    fa: 'موقع آزمایشگاه عطری',
  },
  zip: {
    ar: 'الرمز البريدي: ',
    en: 'ZIP: ',
    fr: 'Code postal : ',
    es: 'C.P.: ',
    it: 'CAP: ',
    de: 'PLZ: ',
    ru: 'Индекс: ',
    zh: '邮编：',
    tr: 'PK: ',
    fa: 'کد پستی: ',
  },
  tel: {
    ar: 'الهاتف: ',
    en: 'Tel: ',
    fr: 'Tél : ',
    es: 'Tel.: ',
    it: 'Tel.: ',
    de: 'Tel.: ',
    ru: 'Тел.: ',
    zh: '电话：',
    tr: 'Tel: ',
    fa: 'تلفن: ',
  },
  section1: {
    ar: '1. جدول المقادير الكيميائية الأساسية (Formulation Breakdown)',
    en: '1. Core Chemical Formulation Breakdown',
    fr: '1. Détail chimique de la formule',
    es: '1. Desglose químico de la fórmula',
    it: '1. Dettaglio chimico della formula',
    de: '1. Chemische Formelaufschlüsselung',
    ru: '1. Химический состав формулы',
    zh: '1. 核心化学配方明细',
    tr: '1. Temel kimyasal formül dökümü',
    fa: '۱. جدول مقادیر شیمیایی اصلی',
  },
  th_component: {
    ar: 'المكون الكيميائي',
    en: 'Chemical Component',
    fr: 'Composant chimique',
    es: 'Componente químico',
    it: 'Componente chimico',
    de: 'Chemische Komponente',
    ru: 'Химический компонент',
    zh: '化学成分',
    tr: 'Kimyasal bileşen',
    fa: 'جزء شیمیایی',
  },
  th_ratio: {
    ar: 'النسبة المئوية',
    en: 'Ratio %',
    fr: 'Proportion %',
    es: 'Proporción %',
    it: 'Percentuale %',
    de: 'Anteil %',
    ru: 'Доля %',
    zh: '百分比',
    tr: 'Oran %',
    fa: 'درصد',
  },
  th_weight: {
    ar: 'الوزن للعبوة (جم)',
    en: 'Per Bottle (g)',
    fr: 'Par flacon (g)',
    es: 'Por frasco (g)',
    it: 'Per flacone (g)',
    de: 'Pro Flakon (g)',
    ru: 'На флакон (г)',
    zh: '单瓶重量 (g)',
    tr: 'Şişe başına (g)',
    fa: 'وزن هر عدد (گرم)',
  },
  th_volume: {
    ar: 'الحجم للعبوة (مل)',
    en: 'Per Bottle (ml)',
    fr: 'Par flacon (ml)',
    es: 'Por frasco (ml)',
    it: 'Per flacone (ml)',
    de: 'Pro Flakon (ml)',
    ru: 'На флакон (мл)',
    zh: '单瓶容量 (ml)',
    tr: 'Şişe başına (ml)',
    fa: 'حجم هر عدد (میلی‌لیتر)',
  },
  th_batch_tpl: {
    ar: 'إجمالي التشغيلة ({n})',
    en: 'Total Batch ({n})',
    fr: 'Lot total ({n})',
    es: 'Lote total ({n})',
    it: 'Lotto totale ({n})',
    de: 'Gesamtcharge ({n})',
    ru: 'Вся партия ({n})',
    zh: '批次总量（{n}）',
    tr: 'Toplam parti ({n})',
    fa: 'کل پارت ({n})',
  },
  row_oil: {
    ar: 'مركب الزيت العطري الخام (Fragrance Oil)',
    en: 'Raw Fragrance Oil Compound',
    fr: 'Concentré d’huile de parfum',
    es: 'Compuesto de aceite de fragancia',
    it: 'Composto di olio aromatico',
    de: 'Duftöl-Rohkomponente',
    ru: 'Парфюмерное масло (концентрат)',
    zh: '香精油浓缩复合物',
    tr: 'Esans yağı bileşimi',
    fa: 'ترکیب روغن عطری خام',
  },
  row_ethanol: {
    ar: 'الكحول الإيثيلي الطبي (Ethanol Alcohol)',
    en: 'Medical Perfumer Ethanol (Alcohol)',
    fr: 'Éthanol pharmaceutique',
    es: 'Etanol médico',
    it: 'Etanolo farmaceutico',
    de: 'Pharmazeutisches Ethanol',
    ru: 'Медицинский этанол',
    zh: '医药级乙醇',
    tr: 'Tıbbi etanol',
    fa: 'الکل اتیلیک طبی',
  },
  row_water: {
    ar: 'ماء مقطر نقي (Pure Distilled Water)',
    en: 'Pure Medical Distilled Water',
    fr: 'Eau distillée pure',
    es: 'Agua destilada pura',
    it: 'Acqua distillata pura',
    de: 'Reines destilliertes Wasser',
    ru: 'Чистая дистиллированная вода',
    zh: '纯净蒸馏水',
    tr: 'Saf distile su',
    fa: 'آب مقطر خالص',
  },
  row_fix: {
    ar: 'مثبت عطري (DPG / IPM / Iso E Super)',
    en: 'Fixative (DPG / IPM / Iso E Super)',
    fr: 'Fixateur (DPG / IPM / Iso E Super)',
    es: 'Fijador (DPG / IPM / Iso E Super)',
    it: 'Fissativo (DPG / IPM / Iso E Super)',
    de: 'Fixateur (DPG / IPM / Iso E Super)',
    ru: 'Фиксатор (DPG / IPM / Iso E Super)',
    zh: '定香剂（DPG / IPM / Iso E Super）',
    tr: 'Fiksatör (DPG / IPM / Iso E Super)',
    fa: 'تثبیت‌کننده (DPG / IPM / Iso E Super)',
  },
  row_total: {
    ar: 'الصافي الإجمالي للعبوة والتشغيلة',
    en: 'Total Batch Compounding Yield',
    fr: 'Rendement total du lot',
    es: 'Rendimiento total del lote',
    it: 'Resa totale del lotto',
    de: 'Gesamtausbeute der Charge',
    ru: 'Общий выход партии',
    zh: '批次总产出',
    tr: 'Toplam parti verimi',
    fa: 'عملکرد خالص کل پارت',
  },
  section2: {
    ar: '2. تفاصيل وتوزيع الهرم العطري (Olfactory Notes Spec)',
    en: '2. Olfactory Pyramid Note Distribution Spec',
    fr: '2. Répartition des notes de la pyramide',
    es: '2. Distribución de notas de la pirámide',
    it: '2. Distribuzione delle note della piramide',
    de: '2. Verteilung der Pyramidennoten',
    ru: '2. Распределение нот пирамиды',
    zh: '2. 香调金字塔分布规格',
    tr: '2. Piramit nota dağılımı',
    fa: '۲. توزیع نت‌های هرم عطری',
  },
  th_note: {
    ar: 'اسم النوتة / الزيت',
    en: 'Fragrance Note / Oil',
    fr: 'Note / Huile',
    es: 'Nota / Aceite',
    it: 'Nota / Olio',
    de: 'Note / Öl',
    ru: 'Нота / Масло',
    zh: '香材/精油',
    tr: 'Nota / Yağ',
    fa: 'نام نت / روغن',
  },
  th_level: {
    ar: 'الطبقة الهرمية',
    en: 'Pyramid Level',
    fr: 'Niveau de la pyramide',
    es: 'Nivel de la pirámide',
    it: 'Livello della piramide',
    de: 'Pyramidenebene',
    ru: 'Уровень пирамиды',
    zh: '金字塔层',
    tr: 'Piramit seviyesi',
    fa: 'سطح هرم',
  },
  th_oil_pct: {
    ar: 'النسبة من الزيت',
    en: '% of Oil',
    fr: '% de l’huile',
    es: '% del aceite',
    it: '% dell’olio',
    de: '% des Öls',
    ru: '% от масла',
    zh: '占油比',
    tr: 'Yağ oranı',
    fa: 'درصد از روغن',
  },
  top_note: {
    ar: 'قمة (Top)',
    en: 'Top Note',
    fr: 'Tête (Top)',
    es: 'Salida (Top)',
    it: 'Testa (Top)',
    de: 'Kopf (Top)',
    ru: 'Верх (Top)',
    zh: '前调',
    tr: 'Üst (Top)',
    fa: 'ابتدایی (Top)',
  },
  heart_note: {
    ar: 'قلب (Heart)',
    en: 'Heart Note',
    fr: 'Cœur (Heart)',
    es: 'Corazón (Heart)',
    it: 'Cuore (Heart)',
    de: 'Herz (Heart)',
    ru: 'Сердце (Heart)',
    zh: '中调',
    tr: 'Kalp (Heart)',
    fa: 'میانی (Heart)',
  },
  base_note: {
    ar: 'قاعدة (Base)',
    en: 'Base Note',
    fr: 'Fond (Base)',
    es: 'Fondo (Base)',
    it: 'Fondo (Base)',
    de: 'Basis (Base)',
    ru: 'База (Base)',
    zh: '后调',
    tr: 'Dip (Base)',
    fa: 'پایانی (Base)',
  },
  th_batch_total: {
    ar: 'إجمالي التشغيلة',
    en: 'Batch Total',
    fr: 'Total du lot',
    es: 'Total del lote',
    it: 'Totale del lotto',
    de: 'Chargen gesamt',
    ru: 'Итого по партии',
    zh: '批次合计',
    tr: 'Parti toplamı',
    fa: 'کل پارت',
  },
  protocol_title: {
    ar: 'بروتوكول الخلط في المعمل:',
    en: 'Laboratory Compounding Protocol:',
    fr: 'Protocole de formulation :',
    es: 'Protocolo de compounding:',
    it: 'Protocollo di miscelazione:',
    de: 'Labor-Mischprotokoll:',
    ru: 'Протокол смешивания:',
    zh: '实验室调配规程：',
    tr: 'Laboratuvar karım protokolü:',
    fa: 'پروتکل ترکیب در آزمایشگاه:',
  },
  protocol_1: {
    ar: 'استخدام ميزان رقمي بدقة 0.01 جرام.',
    en: 'Precision analytical balance (0.01g resolution).',
    fr: 'Balance analytique de précision (0,01 g).',
    es: 'Balanza analítica de precisión (0.01 g).',
    it: 'Bilancia analitica di precisione (0.01 g).',
    de: 'Präzise Analysenwaage (0,01 g).',
    ru: 'Прецизионные аналитические весы (0,01 г).',
    zh: '使用 0.01g 精度分析天平。',
    tr: '0.01g hassasiyetli analitik terazi.',
    fa: 'استفاده از ترازوی دیجیتال با دقت ۰.۰۱ گرم.',
  },
  protocol_2: {
    ar: 'خلط نوتات الزيوت العطرية أولاً في درجة حرارة 20°C - 24°C.',
    en: 'Blend raw concentrate first at controlled 20°C - 24°C.',
    fr: 'Mélanger d’abord le concentré à 20-24 °C.',
    es: 'Mezclar primero el concentrado a 20-24 °C.',
    it: 'Miscelare prima il concentrato a 20-24 °C.',
    de: 'Zuerst das Konzentrat bei 20-24 °C mischen.',
    ru: 'Сначала смешивать концентрат при 20-24 °C.',
    zh: '先在 20-24°C 下混合精油浓缩物。',
    tr: 'Önce konsantreyi 20-24 °C’de karıştırın.',
    fa: 'ابتدا نت‌های روغنی را در دمای ۲۰-۲۴ درجه مخلوط کنید.',
  },
  protocol_3: {
    ar: 'إضافة الكحول المصفى والإغلاق المحكم الفوري لمنع تبخر النوتات العلوية.',
    en: 'Add perfumer ethanol; seal hermetically to preserve head notes.',
    fr: 'Ajouter l’éthanol ; fermer hermétiquement pour préserver les notes de tête.',
    es: 'Añadir etanol; sellar herméticamente para preservar las notas altas.',
    it: 'Aggiungere etanolo; sigillare ermeticamente per preservare le note di testa.',
    de: 'Ethanol zugeben; luftdicht versiegeln, um Kopfnoten zu bewahren.',
    ru: 'Добавить этанол; герметично закрыть для сохранения верхних нот.',
    zh: '加入乙醇后立即密封，防止前调挥发。',
    tr: 'Etanol ekleyin; üst notaları korumak için hava sızdırmaz kapatın.',
    fa: 'افزودن الکل تصفیه‌شده و دربندی فوری و محکم برای جلوگیری از تبخر نت‌های بالایی.',
  },
  protocol_4: {
    ar: 'ترج الزجاجة بلطف لمدة دقيقة واحدة حتى تمام التجانس.',
    en: 'Gentle uniform agitation for 60 seconds until complete clarity.',
    fr: 'Agitation douce et uniforme pendant 60 secondes.',
    es: 'Agitación suave y uniforme durante 60 segundos.',
    it: 'Agitazione dolce e uniforme per 60 secondi.',
    de: 'Sanftes gleichmäßiges Schwenken für 60 Sekunden.',
    ru: 'Мягкое равномерное взбалтывание в течение 60 секунд.',
    zh: '轻轻摇匀 60 秒至完全均质。',
    tr: 'Tam berraklığa kadar 60 saniye nazikçe çalkalayın.',
    fa: 'بطری را یک دقیقه به‌ملایمت تکان دهید تا همگن کامل شود.',
  },
  conditions_title: {
    ar: 'شروط التعتيق والحفظ:',
    en: 'Maceration & Quality Conditions:',
    fr: 'Conditions de macération :',
    es: 'Condiciones de maceración:',
    it: 'Condizioni di macerazione:',
    de: 'Reifungs- und Lagerbedingungen:',
    ru: 'Условия мацерации и хранения:',
    zh: '陈化与保存条件：',
    tr: 'Dinlendirme koşulları:',
    fa: 'شرایط کهنه‌سازی و نگهداری:',
  },
  cond_1: {
    ar: 'الحفظ في مكان مظلم تماماً بعيداً عن أشعة الشمس والحرارة.',
    en: 'Total darkness in amber glass containers.',
    fr: 'Obscurité totale dans du verre ambré.',
    es: 'Oscuridad total en envases de vidrio ámbar.',
    it: 'Buio totale in contenitori di vetro ambrato.',
    de: 'Vollständige Dunkelheit in Braunglas.',
    ru: 'Полная темнота в тёмном стекле.',
    zh: '琥珀玻璃瓶中完全避光保存。',
    tr: 'Amber cam kaplarda tam karanlık.',
    fa: 'نگهداری در محل کاملاً تاریک و دور از نور خورشید و گرما.',
  },
  cond_2: {
    ar: 'درجة حرارة التخزين المثالية: 15°C إلى 18°C.',
    en: 'Optimal cellar temperature: 15°C - 18°C.',
    fr: 'Température optimale : 15-18 °C.',
    es: 'Temperatura óptima: 15-18 °C.',
    it: 'Temperatura ottimale: 15-18 °C.',
    de: 'Optimale Temperatur: 15-18 °C.',
    ru: 'Оптимальная температура: 15-18 °C.',
    zh: '最佳储存温度：15-18°C。',
    tr: 'İdeal sıcaklık: 15-18 °C.',
    fa: 'دمای مطلوب نگهداری: ۱۵ تا ۱۸ درجه.',
  },
  cond_3_tpl: {
    ar: 'التعتيق المستهدف: {d} يوماً لإتمام استقرار الروابط الجزيئية.',
    en: 'Target maceration period: {d} days for esterification.',
    fr: 'Macération visée : {d} jours pour l’estérification.',
    es: 'Maceración objetivo: {d} días para la esterificación.',
    it: 'Macerazione target: {d} giorni per l’esterificazione.',
    de: 'Ziel-Mazerationszeit: {d} Tage zur Veresterung.',
    ru: 'Целевая мацерация: {d} дней для этерификации.',
    zh: '目标陈化期：{d} 天以完成酯化稳定。',
    tr: 'Hedef dinlendirme: esterifikasyon için {d} gün.',
    fa: 'کهنه‌سازی هدف: {d} روز برای تثبیت پیوندهای مولکولی.',
  },
  cond_4: {
    ar: 'إجراء اختبار الفلترة (Filtration) قبل التعبئة النهائية عند اللزوم.',
    en: 'Perform lab micro-filtration prior to final bottling.',
    fr: 'Micro-filtration en laboratoire avant l’embouteillage final.',
    es: 'Microfiltración de laboratorio antes del embotellado final.',
    it: 'Micro-filtrazione di laboratorio prima dell’imbottigliamento finale.',
    de: 'Labormikrofiltration vor der Endabfüllung.',
    ru: 'Лабораторная микрофильтрация перед финальным розливом.',
    zh: '灌装前按需进行微孔过滤。',
    tr: 'Son dolum öncesi laboratuvar mikro filtrasyonu.',
    fa: 'انجام آزمون فیلتراسیون قبل از پرکردن نهایی در صورت لزوم.',
  },
  formulator_lbl: {
    ar: 'مسؤول التركيب والتصنيع:',
    en: 'Compounding Chemist / Formulator:',
    fr: 'Chimiste formulateur :',
    es: 'Químico formulador:',
    it: 'Chimico formulatore:',
    de: 'Formulierungschemiker:',
    ru: 'Химик-формулятор:',
    zh: '配方化学师：',
    tr: 'Formülasyon kimyageri:',
    fa: 'مسئول ترکیب و تولید:',
  },
  signature: {
    ar: 'التوقيع والاعتماد',
    en: 'Signature & Date',
    fr: 'Signature et date',
    es: 'Firma y fecha',
    it: 'Firma e data',
    de: 'Unterschrift & Datum',
    ru: 'Подпись и дата',
    zh: '签名与日期',
    tr: 'İmza ve tarih',
    fa: 'امضا و تأیید',
  },
  qc_lbl: {
    ar: 'مراقبة الجودة وفحص المعمل:',
    en: 'Quality Control & Lab Inspection:',
    fr: 'Contrôle qualité et inspection :',
    es: 'Control de calidad e inspección:',
    it: 'Controllo qualità e ispezione:',
    de: 'Qualitätskontrolle & Prüfung:',
    ru: 'Контроль качества и инспекция:',
    zh: '质量控制与检验：',
    tr: 'Kalite kontrol ve denetim:',
    fa: 'کنترل کیفیت و بازرسی آزمایشگاه:',
  },
  stamp: {
    ar: 'ختم التشغيلة',
    en: 'Batch Stamp & Release',
    fr: 'Tampon et validation du lot',
    es: 'Sello y liberación del lote',
    it: 'Timbro e rilascio del lotto',
    de: 'Chargenstempel & Freigabe',
    ru: 'Штамп и выпуск партии',
    zh: '批次盖章放行',
    tr: 'Parti mührü ve onay',
    fa: 'مهر پارت و تأیید نهایی',
  },
  print_doc: {
    ar: 'طباعة المستند الرسمي',
    en: 'Print Official Document',
    fr: 'Imprimer le document officiel',
    es: 'Imprimir documento oficial',
    it: 'Stampa documento ufficiale',
    de: 'Offizielles Dokument drucken',
    ru: 'Печать официального документа',
    zh: '打印正式文件',
    tr: 'Resmi belgeyi yazdır',
    fa: 'چاپ سند رسمی',
  },
  copy_summary: {
    ar: 'نسخ ملخص البطاقة',
    en: 'Copy Spec Summary',
    fr: 'Copier le résumé',
    es: 'Copiar resumen',
    it: 'Copia riepilogo',
    de: 'Spezifikation kopieren',
    ru: 'Скопировать сводку',
    zh: '复制规格摘要',
    tr: 'Özeti kopyala',
    fa: 'کپی خلاصه مشخصات',
  },
  copied_ok: {
    ar: 'تم النسخ بنجاح',
    en: 'Copied!',
    fr: 'Copié !',
    es: '¡Copiado!',
    it: 'Copiato!',
    de: 'Kopiert!',
    ru: 'Скопировано!',
    zh: '已复制！',
    tr: 'Kopyalandı!',
    fa: 'با موفقیت کپی شد',
  },
  close_return: {
    ar: 'إغلاق التقرير والعودة لحاسبة المعمل',
    en: 'Close and Return to Workbench',
    fr: 'Fermer et revenir à l’atelier',
    es: 'Cerrar y volver al taller',
    it: 'Chiudi e torna al banco',
    de: 'Schließen und zur Werkbank',
    ru: 'Закрыть и вернуться к верстаку',
    zh: '关闭并返回工作台',
    tr: 'Kapat ve çalışma masasına dön',
    fa: 'بستن گزارش و بازگشت به میز کار',
  },
  close_fab: {
    ar: 'إغلاق التقرير ✕',
    en: 'Close ✕',
    fr: 'Fermer ✕',
    es: 'Cerrar ✕',
    it: 'Chiudi ✕',
    de: 'Schließen ✕',
    ru: 'Закрыть ✕',
    zh: '关闭报告 ✕',
    tr: 'Kapat ✕',
    fa: 'بستن گزارش ✕',
  },
  clipboard_tpl: {
    ar: `📋 [بطاقة تصنيع معملية - صمم عطرك مع شام]
العطر: {title} ({code})
المصمم: {author} | التاريخ: {date}
الحجم: {vol} مل × {count} عبوة ({conc})
الزيت العطري الخام: {oil} جم ({oilBatch} جم للتشغيلة)
الكحول الإيثيلي: {alc} جم ({alcBatch} جم للتشغيلة)
المثبت: {fix} جم | الماء: {water} جم
صافي الزجاجة: {net} جم | إجمالي التشغيلة: {batchTotal} جم
فترة التعتيق: {days} يوماً (جاهز في {ready})`,
    en: `📋 [Batch Manufacturing Spec - Sham Perfume Atelier]
Fragrance: {title} ({code})
Perfumer: {author} | Date: {date}
Volume: {vol} ml x {count} bottles ({conc})
Fragrance oil: {oil} g ({oilBatch} g batch total)
Ethanol: {alc} g ({alcBatch} g batch total)
Fixative: {fix} g | Water: {water} g
Net per bottle: {net} g | Batch total: {batchTotal} g
Maceration: {days} days (ready {ready})`,
    fr: `📋 [Fiche de fabrication - Atelier Sham]
Parfum : {title} ({code})
Parfumeur : {author} | Date : {date}
Volume : {vol} ml x {count} flacons ({conc})
Huile de parfum : {oil} g ({oilBatch} g lot total)
Éthanol : {alc} g ({alcBatch} g lot total)
Fixateur : {fix} g | Eau : {water} g
Net par flacon : {net} g | Total du lot : {batchTotal} g
Macération : {days} jours (prêt {ready})`,
    es: `📋 [Ficha de fabricación - Atelier Sham]
Perfume: {title} ({code})
Perfumista: {author} | Fecha: {date}
Volumen: {vol} ml x {count} frascos ({conc})
Aceite de fragancia: {oil} g ({oilBatch} g lote total)
Etanol: {alc} g ({alcBatch} g lote total)
Fijador: {fix} g | Agua: {water} g
Neto por frasco: {net} g | Total del lote: {batchTotal} g
Maceración: {days} días (listo {ready})`,
    it: `📋 [Scheda di produzione - Atelier Sham]
Profumo: {title} ({code})
Profumiere: {author} | Data: {date}
Volume: {vol} ml x {count} flaconi ({conc})
Olio aromatico: {oil} g ({oilBatch} g lotto totale)
Etanolo: {alc} g ({alcBatch} g lotto totale)
Fissativo: {fix} g | Acqua: {water} g
Netto per flacone: {net} g | Totale lotto: {batchTotal} g
Macerazione: {days} giorni (pronto {ready})`,
    de: `📋 [Produktionsdatenblatt - Sham Atelier]
Duft: {title} ({code})
Parfümeur: {author} | Datum: {date}
Volumen: {vol} ml x {count} Flakons ({conc})
Duftöl: {oil} g ({oilBatch} g Charge gesamt)
Ethanol: {alc} g ({alcBatch} g Charge gesamt)
Fixateur: {fix} g | Wasser: {water} g
Netto pro Flakon: {net} g | Charge gesamt: {batchTotal} g
Mazerationszeit: {days} Tage (fertig {ready})`,
    ru: `📋 [Техкарта производства — ателье Sham]
Аромат: {title} ({code})
Парфюмер: {author} | Дата: {date}
Объём: {vol} мл x {count} флаконов ({conc})
Парфюмерное масло: {oil} г ({oilBatch} г на партию)
Этанол: {alc} г ({alcBatch} г на партию)
Фиксатор: {fix} г | Вода: {water} г
Нетто на флакон: {net} г | Итого по партии: {batchTotal} г
Мацерация: {days} дней (готово {ready})`,
    zh: `📋 [生产规格单 - Sham 工作室]
香水：{title}（{code}）
调香师：{author} | 日期：{date}
容量：{vol} ml × {count} 瓶（{conc}）
香精油：{oil} g（批次 {oilBatch} g）
乙醇：{alc} g（批次 {alcBatch} g）
定香剂：{fix} g | 水：{water} g
单瓶净重：{net} g | 批次总量：{batchTotal} g
陈化期：{days} 天（{ready} 完成）`,
    tr: `📋 [Üretim kartı - Sham Atölyesi]
Parfüm: {title} ({code})
Parfümör: {author} | Tarih: {date}
Hacim: {vol} ml x {count} şişe ({conc})
Esans yağı: {oil} g (parti {oilBatch} g)
Etanol: {alc} g (parti {alcBatch} g)
Fiksatör: {fix} g | Su: {water} g
Şişe neti: {net} g | Parti toplamı: {batchTotal} g
Dinlendirme: {days} gün (hazır {ready})`,
    fa: `📋 [کارت تولید - آزمایشگاه شام]
عطر: {title} ({code})
طراح: {author} | تاریخ: {date}
حجم: {vol} میلی‌لیتر × {count} عدد ({conc})
روغن عطری: {oil} گرم ({oilBatch} گرم کل پارت)
الکل: {alc} گرم ({alcBatch} گرم کل پارت)
تثبیت‌کننده: {fix} گرم | آب: {water} گرم
خالص هر بطری: {net} گرم | کل پارت: {batchTotal} گرم
کهنه‌سازی: {days} روز (آماده {ready})`,
  },
} satisfies Record<string, LText>;

export const ManufacturingSpecSheet: React.FC<ManufacturingSpecSheetProps> = ({
  formulaTitle,
  author,
  batchCode,
  notes,
  macerationDays,
  formulation,
  pyramidNotes,
  calculationResult,
  detailedAddress,
  currentLang = 'ar',
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const rtl = isRTL(currentLang);
  const L = makeT(currentLang, S);
  const ActionArrow = rtl ? ArrowLeft : ArrowRight;

  const currentDate = new Date().toISOString().split('T')[0];
  const targetDate = new Date(Date.now() + macerationDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const breakdown = calculatePyramidBreakdown(
    pyramidNotes,
    calculationResult.oilWeightGrams,
    calculationResult.oilVolumeMl
  );

  // Close on Escape key press and lock background scroll
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handlePrint = () => {
    window.print();
  };

  const handleCopySummary = () => {
    const text = fmt(L('clipboard_tpl'), {
      title: formulaTitle || L('default_title'),
      code: batchCode,
      author: author || L('default_author'),
      date: currentDate,
      vol: String(formulation.bottleVolumeMl),
      count: String(formulation.batchCount),
      conc: `${formulation.concentrationPercent}% - ${formulation.concentrationType.toUpperCase()}`,
      oil: formatNum(calculationResult.oilWeightGrams),
      oilBatch: formatNum(calculationResult.batchTotalOilGrams),
      alc: formatNum(calculationResult.alcoholWeightGrams),
      alcBatch: formatNum(calculationResult.batchTotalAlcoholGrams),
      fix: formatNum(calculationResult.fixativeWeightGrams),
      water: formatNum(calculationResult.waterWeightGrams),
      net: formatNum(calculationResult.totalWeightGrams),
      batchTotal: formatNum(calculationResult.batchTotalWeightGrams),
      days: String(macerationDays),
      ready: targetDate,
    });
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white w-full max-w-4xl rounded-2xl sm:rounded-3xl shadow-2xl border border-stone-200 overflow-hidden text-stone-900 print:border-none print:shadow-none print:rounded-none relative my-4 sm:my-8"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Sticky Top Modal Controls (Hidden in Print) */}
        <div className="sticky top-0 z-50 p-3.5 sm:p-4 bg-stone-950 text-white flex items-center justify-between no-print shadow-lg border-b border-stone-800">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs sm:text-sm font-bold truncate max-w-[200px] sm:max-w-none text-stone-100">
              {L('doc_title')}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopySummary}
              className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              title={L('copy_tooltip')}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copied ? L('copied') : L('copy')}</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-amber-700 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{L('print_btn')}</span>
            </button>
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-md border border-rose-500 hover:scale-105 active:scale-95"
              title={L('close_tooltip')}
            >
              <X className="w-4 h-4" />
              <span>{L('close')}</span>
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-8 sm:p-10 space-y-8 bg-white print:p-0">
          
          {/* Header Brand Lockup */}
          <div className="flex justify-between items-start border-b-2 border-stone-900 pb-6">
            <div>
              <div className="text-2xl font-bold tracking-tight text-stone-950 font-serif-luxury">
                {L('brand')}
              </div>
              <div className="text-xs text-stone-500 mt-1">
                {L('doc_type')}
              </div>
            </div>
            <div className={`${rtl ? 'text-left' : 'text-right'} font-mono-numbers text-xs space-y-1`}>
              <div>
                <span className="text-stone-400">{L('batch_id')}</span>
                <span className="font-bold text-stone-900">{batchCode || 'SHAM-BATCH-01'}</span>
              </div>
              <div>
                <span className="text-stone-400">{L('date_issued')}</span>
                <span>{currentDate}</span>
              </div>
              <div>
                <span className="text-stone-400">{L('maceration_done')}</span>
                <span className="font-semibold text-amber-900">{targetDate} ({macerationDays} {L('days')})</span>
              </div>
            </div>
          </div>

          {/* Perfume Identity Card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-stone-50 rounded-xl border border-stone-200/80 text-xs">
            <div>
              <span className="text-stone-400 block text-[10px]">{L('frag_title')}</span>
              <span className="font-bold text-stone-900 text-sm">{formulaTitle || L('default_title')}</span>
            </div>
            <div>
              <span className="text-stone-400 block text-[10px]">{L('perfumer_lbl')}</span>
              <span className="font-semibold text-stone-900">{author || L('default_author')}</span>
            </div>
            <div>
              <span className="text-stone-400 block text-[10px]">{L('volume_batch')}</span>
              <span className="font-semibold text-stone-900 font-mono-numbers">
                {formulation.bottleVolumeMl} ml × {formulation.batchCount} {L('bottles')}
              </span>
            </div>
            <div>
              <span className="text-stone-400 block text-[10px]">{L('conc_class')}</span>
              <span className="font-bold text-amber-900 font-mono-numbers">
                {formulation.concentrationPercent}% ({formulation.concentrationType.toUpperCase()})
              </span>
            </div>
          </div>

          {/* Perfume Atelier Facility & Detailed Address Lockup */}
          {detailedAddress && (
            <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/80 text-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm">📍</span>
                <span className="font-bold text-stone-900">
                  {detailedAddress.labOrFacilityName || L('facility_default')}:
                </span>
                <span className="text-stone-600">
                  {detailedAddress.city}
                  {detailedAddress.district ? `${rtl ? '، ' : ', '}${detailedAddress.district}` : ''}
                  {detailedAddress.street ? `${rtl ? '، ' : ', '}${detailedAddress.street}` : ''}
                  {` — ${pickArEn(currentLang, detailedAddress.countryNameAr, detailedAddress.countryNameEn || detailedAddress.countryNameAr)}`}
                </span>
              </div>
              <div className="flex items-center gap-3 text-stone-500 font-mono text-[11px]">
                {detailedAddress.postalCode && (
                  <span>{L('zip')}{detailedAddress.postalCode}</span>
                )}
                {detailedAddress.phoneNumber && (
                  <span>{L('tel')}{detailedAddress.phoneNumber}</span>
                )}
              </div>
            </div>
          )}

          {/* Primary Formula Breakdown Table */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
              {L('section1')}
            </h4>
            <div className="border border-stone-200 rounded-xl overflow-hidden">
              <table className={`w-full ${rtl ? 'text-right' : 'text-left'} text-xs`}>
                <thead className="bg-stone-100 text-stone-700 font-semibold border-b border-stone-200">
                  <tr>
                    <th className="py-2.5 px-4">{L('th_component')}</th>
                    <th className="py-2.5 px-4">{L('th_ratio')}</th>
                    <th className="py-2.5 px-4 font-mono-numbers">{L('th_weight')}</th>
                    <th className="py-2.5 px-4 font-mono-numbers">{L('th_volume')}</th>
                    <th className="py-2.5 px-4 font-mono-numbers">{fmt(L('th_batch_tpl'), { n: formulation.batchCount })}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-mono-numbers">
                  <tr>
                    <td className="py-2.5 px-4 font-sans font-medium text-stone-900">
                      {L('row_oil')}
                    </td>
                    <td className="py-2.5 px-4">{formatNum(calculationResult.oilPercent, 1)}%</td>
                    <td className="py-2.5 px-4 font-bold text-amber-900">{formatNum(calculationResult.oilWeightGrams)} g</td>
                    <td className="py-2.5 px-4">{formatNum(calculationResult.oilVolumeMl)} ml</td>
                    <td className="py-2.5 px-4 font-bold">{formatNum(calculationResult.batchTotalOilGrams)} g</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-sans font-medium text-stone-900">
                      {L('row_ethanol')}
                    </td>
                    <td className="py-2.5 px-4">{formatNum(calculationResult.alcoholPercent, 1)}%</td>
                    <td className="py-2.5 px-4 font-bold">{formatNum(calculationResult.alcoholWeightGrams)} g</td>
                    <td className="py-2.5 px-4">{formatNum(calculationResult.alcoholVolumeMl)} ml</td>
                    <td className="py-2.5 px-4 font-bold">{formatNum(calculationResult.batchTotalAlcoholGrams)} g</td>
                  </tr>
                  {calculationResult.waterPercent > 0 && (
                    <tr>
                      <td className="py-2.5 px-4 font-sans font-medium text-stone-900">
                        {L('row_water')}
                      </td>
                      <td className="py-2.5 px-4">{formatNum(calculationResult.waterPercent, 1)}%</td>
                      <td className="py-2.5 px-4">{formatNum(calculationResult.waterWeightGrams)} g</td>
                      <td className="py-2.5 px-4">{formatNum(calculationResult.waterVolumeMl)} ml</td>
                      <td className="py-2.5 px-4 font-bold">{formatNum(calculationResult.batchTotalWaterGrams)} g</td>
                    </tr>
                  )}
                  {calculationResult.fixativePercent > 0 && (
                    <tr>
                      <td className="py-2.5 px-4 font-sans font-medium text-stone-900">
                        {L('row_fix')}
                      </td>
                      <td className="py-2.5 px-4">{formatNum(calculationResult.fixativePercent, 1)}%</td>
                      <td className="py-2.5 px-4">{formatNum(calculationResult.fixativeWeightGrams)} g</td>
                      <td className="py-2.5 px-4">{formatNum(calculationResult.fixativeVolumeMl)} ml</td>
                      <td className="py-2.5 px-4 font-bold">{formatNum(calculationResult.batchTotalFixativeGrams)} g</td>
                    </tr>
                  )}
                  <tr className="bg-stone-50/80 font-bold text-stone-950">
                    <td className="py-3 px-4 font-sans">{L('row_total')}</td>
                    <td className="py-3 px-4">100%</td>
                    <td className="py-3 px-4">{formatNum(calculationResult.totalWeightGrams)} g</td>
                    <td className="py-3 px-4">{calculationResult.totalVolumeMl} ml</td>
                    <td className="py-3 px-4 text-amber-900">{formatNum(calculationResult.batchTotalWeightGrams)} g ({formatNum(calculationResult.batchTotalVolumeMl / 1000, 2)} L)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Pyramid Breakdown Table (if notes present) */}
          {breakdown.notesWithQuantities.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                {L('section2')}
              </h4>
              <div className="border border-stone-200 rounded-xl overflow-hidden">
                <table className={`w-full ${rtl ? 'text-right' : 'text-left'} text-xs`}>
                  <thead className="bg-stone-100 text-stone-700 font-semibold border-b border-stone-200">
                    <tr>
                      <th className="py-2.5 px-4">{L('th_note')}</th>
                      <th className="py-2.5 px-4">{L('th_level')}</th>
                      <th className="py-2.5 px-4">{L('th_oil_pct')}</th>
                      <th className="py-2.5 px-4 font-mono-numbers">{L('th_weight')}</th>
                      <th className="py-2.5 px-4 font-mono-numbers">{L('th_batch_total')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 font-mono-numbers">
                    {breakdown.notesWithQuantities.map((note) => (
                      <tr key={note.id}>
                        <td className="py-2.5 px-4 font-sans font-medium text-stone-900">
                          {pickArEn(currentLang, note.nameAr, note.nameEn || note.nameAr)}
                        </td>
                        <td className="py-2.5 px-4 font-sans text-stone-600">
                          {note.category === 'top'
                            ? L('top_note')
                            : note.category === 'heart'
                            ? L('heart_note')
                            : L('base_note')}
                        </td>
                        <td className="py-2.5 px-4">{note.percentageOfOil}%</td>
                        <td className="py-2.5 px-4 font-semibold text-amber-900">
                          {formatNum(note.weightGrams)} g
                        </td>
                        <td className="py-2.5 px-4 font-bold">
                          {formatNum(note.weightGrams * formulation.batchCount)} g
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Laboratory Instructions & Quality Protocols */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs">
            <div className="p-4 bg-stone-50 rounded-xl border border-stone-200/80 space-y-2">
              <span className="font-bold text-stone-900 block">{L('protocol_title')}</span>
              <ul className="space-y-1 list-disc list-inside text-stone-600 text-[11px] leading-relaxed">
                <li>{L('protocol_1')}</li>
                <li>{L('protocol_2')}</li>
                <li>{L('protocol_3')}</li>
                <li>{L('protocol_4')}</li>
              </ul>
            </div>

            <div className="p-4 bg-stone-50 rounded-xl border border-stone-200/80 space-y-2">
              <span className="font-bold text-stone-900 block">{L('conditions_title')}</span>
              <ul className="space-y-1 list-disc list-inside text-stone-600 text-[11px] leading-relaxed">
                <li>{L('cond_1')}</li>
                <li>{L('cond_2')}</li>
                <li>{fmt(L('cond_3_tpl'), { d: macerationDays })}</li>
                <li>{L('cond_4')}</li>
              </ul>
            </div>
          </div>

          {/* Signatures Footer */}
          <div className="pt-8 border-t border-stone-200 grid grid-cols-2 gap-8 text-xs">
            <div>
              <span className="text-stone-400 block text-[10px]">{L('formulator_lbl')}</span>
              <div className="mt-4 border-b border-stone-300 w-48" />
              <span className="text-[11px] text-stone-600 mt-1 block">{L('signature')}</span>
            </div>
            <div className={rtl ? 'text-left' : 'text-right'}>
              <span className="text-stone-400 block text-[10px]">{L('qc_lbl')}</span>
              <div className={`mt-4 border-b border-stone-300 w-48 ${rtl ? 'mr-auto' : 'ml-auto'}`} />
              <span className="text-[11px] text-stone-600 mt-1 block">{L('stamp')}</span>
            </div>
          </div>

        </div>

        {/* Bottom Actions Bar (Hidden in Print) */}
        <div className="p-4 sm:p-6 bg-stone-100 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 sm:px-5 py-2.5 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>{L('print_doc')}</span>
            </button>
            <button
              onClick={handleCopySummary}
              className="px-3.5 sm:px-4 py-2.5 bg-white hover:bg-stone-50 text-stone-800 border border-stone-300 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 cursor-pointer transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? L('copied_ok') : L('copy_summary')}</span>
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-5 sm:px-6 py-2.5 bg-stone-900 hover:bg-rose-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer shadow-md transition-all hover:scale-102"
          >
            <X className="w-4 h-4 text-rose-300" />
            <span>{L('close_return')}</span>
          </button>
        </div>

      </div>

      {/* Floating Corner Quick-Close Button (Always visible on all screens regardless of scroll position) */}
      <div className={`fixed bottom-6 ${rtl ? 'left-6' : 'right-6'} z-50 no-print`}>
        <button
          onClick={onClose}
          className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-2xl border-2 border-white/40 cursor-pointer transition-all hover:scale-105 active:scale-95 animate-in fade-in"
          title={L('close_tooltip')}
        >
          <X className="w-4 h-4" />
          <span>{L('close_fab')}</span>
        </button>
      </div>

    </div>
  );
};
