import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  Package,
  Layers,
  HelpCircle,
  FileSpreadsheet,
  PieChart,
  Globe,
  Coins,
  ArrowRightLeft,
  Search,
  BarChart3,
  Sliders,
  CheckCircle2,
  Award,
  Sparkles,
  Info,
  Percent,
} from 'lucide-react';
import { CalculationResult, CostingState, FormulationState } from '../types/perfume';
import {
  WORLD_CURRENCIES,
  WorldCurrency,
  findCurrencyByCode,
  convertCurrency,
} from '../data/worldCurrencies';
import { calculatePerfumeCosting, formatNum } from '../utils/calculations';
import { SupportedLanguage } from '../types/i18n';
import { isRTL } from '../لغات/localizedContent';
import { LText, makeT, fmt, pickArEn } from '../لغات/localize';
import { uiLabel } from '../لغات/uiTextL10n';

interface CostCalculatorProps {
  currentLang?: SupportedLanguage;
  formulation: FormulationState;
  calculationResult: CalculationResult;
  currentCurrencyCode?: string;
}

const POPULAR_CURRENCIES = [
  'SAR', 'AED', 'KWD', 'QAR', 'BHD', 'OMR', 'EGP', 'JOD', 'IQD', 'MAD', 'DZD', 'USD', 'EUR', 'GBP', 'TRY'
];


const S = {
  page_title: {
    ar: 'حاسبة التكاليف الصناعية وهوامش الأرباح والتسعير',
    en: 'Manufacturing Costing, Pricing & Profit Margins',
    fr: 'Coûts de production, tarification et marges',
    es: 'Costos de fabricación, precios y márgenes',
    it: 'Costi di produzione, prezzi e margini',
    de: 'Herstellungskosten, Preisgestaltung & Margen',
    ru: 'Себестоимость, ценообразование и маржа',
    zh: '制造成本、定价与利润核算',
    tr: 'Üretim maliyeti, fiyatlandırma ve kâr marjları',
    fa: 'ماشین‌حساب هزینه‌های صنعتی، حاشیه سود و قیمت‌گذاری',
  },
  page_desc: {
    ar: 'احسب التكلفة المباشرة للزجاجة والكرتونة، وحدد سعر الجملة وسعر البيع المقترح للمستهلك مع هوامش أرباح التشغيلة.',
    en: 'Calculate unit costs per flacon, carton packaging, and optimize wholesale & suggested retail prices with profit forecasts.',
    fr: 'Calculez le coût unitaire du flacon et du carton, et optimisez prix de gros et prix public conseillés.',
    es: 'Calcule costos unitarios por frasco y embalaje, y optimice precios mayoristas y minoristas.',
    it: 'Calcola i costi unitari per flacone e confezione e ottimizza prezzi all’ingrosso e al dettaglio.',
    de: 'Berechnen Sie Stückkosten pro Flakon und Karton und optimieren Sie Groß- und Endverbraucherpreise.',
    ru: 'Рассчитайте себестоимость флакона и упаковки, оптимизируйте оптовые и розничные цены.',
    zh: '计算单瓶与包装成本，优化批发与建议零售价及利润预测。',
    tr: 'Şişe ve ambalaj birim maliyetini hesaplayın; toptan ve perakende fiyatları optimize edin.',
    fa: 'هزینه مستقیم بطری و جعبه را محاسبه کنید و قیمت عمده و پیشنهادی مصرف‌کننده را با حاشیه سود مشخص کنید.',
  },
  inputs_title: {
    ar: 'تكاليف المواد الأولية والتعبئة والتسعير',
    en: 'Raw Materials, Packaging & Compounding Costs',
    fr: 'Matières premières, emballage et coûts',
    es: 'Materias primas, embalaje y costos',
    it: 'Materie prime, imballaggio e costi',
    de: 'Rohstoffe, Verpackung & Kosten',
    ru: 'Сырьё, упаковка и затраты',
    zh: '原料、包装与调配成本',
    tr: 'Hammadde, ambalaj ve maliyetler',
    fa: 'هزینه مواد اولیه، بسته‌بندی و قیمت‌گذاری',
  },
  quick_select: {
    ar: 'اختيار سريع:',
    en: 'Quick Select:',
    fr: 'Sélection rapide :',
    es: 'Selección rápida:',
    it: 'Selezione rapida:',
    de: 'Schnellauswahl:',
    ru: 'Быстрый выбор:',
    zh: '快速选择：',
    tr: 'Hızlı seçim:',
    fa: 'انتخاب سریع:',
  },
  oil_cost_tpl: {
    ar: 'سعر الزيت العطري الخام ({cur} / كجم)',
    en: 'Raw Perfume Oil Cost ({cur} / kg)',
    fr: 'Prix de l’huile de parfum ({cur} / kg)',
    es: 'Precio del aceite de fragancia ({cur} / kg)',
    it: 'Prezzo dell’olio aromatico ({cur} / kg)',
    de: 'Duftöl-Rohpreis ({cur} / kg)',
    ru: 'Цена парфюмерного масла ({cur} / кг)',
    zh: '香精油原料价（{cur}/kg）',
    tr: 'Esans yağı fiyatı ({cur} / kg)',
    fa: 'قیمت روغن عطری خام ({cur} / کیلوگرم)',
  },
  kg_note: {
    ar: '(الكيلو = 1,000 جرام)',
    en: '(1 kg = 1,000 grams)',
    fr: '(1 kg = 1 000 g)',
    es: '(1 kg = 1.000 gramos)',
    it: '(1 kg = 1.000 grammi)',
    de: '(1 kg = 1.000 Gramm)',
    ru: '(1 кг = 1 000 г)',
    zh: '（1 千克 = 1,000 克）',
    tr: '(1 kg = 1.000 gram)',
    fa: '(کیلوگرم = ۱,۰۰۰ گرم)',
  },
  ethanol_cost_tpl: {
    ar: 'سعر الكحول الإيثيلي ({cur} / لتر)',
    en: 'Perfumer Ethanol Cost ({cur} / liter)',
    fr: 'Prix de l’éthanol ({cur} / litre)',
    es: 'Precio del etanol ({cur} / litro)',
    it: 'Prezzo dell’etanolo ({cur} / litro)',
    de: 'Ethanol-Preis ({cur} / Liter)',
    ru: 'Цена этанола ({cur} / литр)',
    zh: '乙醇价格（{cur}/升）',
    tr: 'Etanol fiyatı ({cur} / litre)',
    fa: 'قیمت الکل اتیلیک ({cur} / لیتر)',
  },
  liter_note: {
    ar: '(اللتر = 1,000 مل)',
    en: '(1 liter = 1,000 ml)',
    fr: '(1 L = 1 000 ml)',
    es: '(1 litro = 1.000 ml)',
    it: '(1 litro = 1.000 ml)',
    de: '(1 Liter = 1.000 ml)',
    ru: '(1 л = 1 000 мл)',
    zh: '（1 升 = 1,000 毫升）',
    tr: '(1 litre = 1.000 ml)',
    fa: '(لیتر = ۱,۰۰۰ میلی‌لیتر)',
  },
  bottle_cost_tpl: {
    ar: 'تكلفة الزجاجة + البخاخ + الغطاء ({cur})',
    en: 'Bottle + Atomizer + Cap Unit Cost ({cur})',
    fr: 'Coût flacon + vaporisateur + bouchon ({cur})',
    es: 'Costo frasco + atomizador + tapa ({cur})',
    it: 'Costo flacone + atomizzatore + tappo ({cur})',
    de: 'Flakon + Zerstäuber + Deckel ({cur})',
    ru: 'Флакон + атомайзер + крышка ({cur})',
    zh: '瓶身+喷头+瓶盖单价（{cur}）',
    tr: 'Şişe + pompalı kapak maliyeti ({cur})',
    fa: 'هزینه بطری + اسپری + درپوش ({cur})',
  },
  box_cost_tpl: {
    ar: 'تكلفة العلبة الفاخرة والملصقات ({cur})',
    en: 'Luxury Box + Labels Unit Cost ({cur})',
    fr: 'Coût écrin de luxe + étiquettes ({cur})',
    es: 'Costo caja de lujo + etiquetas ({cur})',
    it: 'Costo astuccio di lusso + etichette ({cur})',
    de: 'Luxusbox + Etiketten ({cur})',
    ru: 'Роскошная коробка + этикетки ({cur})',
    zh: '礼盒+标签单价（{cur}）',
    tr: 'Lüks kutu + etiket maliyeti ({cur})',
    fa: 'هزینه جعبه لوکس و برچسب‌ها ({cur})',
  },
  labor_cost_tpl: {
    ar: 'مصاريف التشغيل والخلط لكل زجاجة ({cur})',
    en: 'Labor & Atelier Overhead per Unit ({cur})',
    fr: 'Main-d’œuvre et frais d’atelier par unité ({cur})',
    es: 'Mano de obra y gastos por unidad ({cur})',
    it: 'Manodopera e costi di atelier per unità ({cur})',
    de: 'Arbeit & Atelier-Overhead pro Stück ({cur})',
    ru: 'Трудозатраты и накладные расходы на единицу ({cur})',
    zh: '单瓶人工与工作室费用（{cur}）',
    tr: 'Birim başına işçilik ve atölye gideri ({cur})',
    fa: 'هزینه عملیات و ترکیب به ازای هر بطری ({cur})',
  },
  batch_label: {
    ar: 'حجم دفعة الإنتاج (عدد الزجاجات)',
    en: 'Production Batch Size (Bottles)',
    fr: 'Taille du lot de production (flacons)',
    es: 'Tamaño del lote de producción (frascos)',
    it: 'Dimensione del lotto di produzione (flaconi)',
    de: 'Produktionschargengröße (Flakons)',
    ru: 'Размер производственной партии (флаконы)',
    zh: '生产批量（瓶数）',
    tr: 'Üretim parti büyüklüğü (şişe)',
    fa: 'حجم پارت تولید (تعداد بطری)',
  },
  margin_label: {
    ar: 'هامش الربح المستهدف للتجزئة (Retail Markup Margin)',
    en: 'Target Retail Markup Margin',
    fr: 'Marge de revente au détail visée',
    es: 'Margen minorista objetivo',
    it: 'Margine al dettaglio target',
    de: 'Ziel-Handelsaufschlag',
    ru: 'Целевая розничная наценка',
    zh: '目标零售加价率',
    tr: 'Hedef perakende kâr marjı',
    fa: 'حاشیه سود هدف خرده‌فروشی',
  },
  margin_economy: {
    ar: 'اقتصادي',
    en: 'Economy',
    fr: 'Économique',
    es: 'Económico',
    it: 'Economico',
    de: 'Economy',
    ru: 'Эконом',
    zh: '经济型',
    tr: 'Ekonomik',
    fa: 'اقتصادی',
  },
  margin_standard: {
    ar: 'متوسط تجاري',
    en: 'Standard',
    fr: 'Standard',
    es: 'Estándar',
    it: 'Standard',
    de: 'Standard',
    ru: 'Стандарт',
    zh: '标准商业',
    tr: 'Standart',
    fa: 'تجاری استاندارد',
  },
  margin_luxury: {
    ar: 'براند نيش فاخر',
    en: 'Luxury Niche',
    fr: 'Niche de luxe',
    es: 'Nicho de lujo',
    it: 'Nicchia di lusso',
    de: 'Luxus-Nische',
    ru: 'Люкс-ниша',
    zh: '高端小众',
    tr: 'Lüks niş',
    fa: 'برند نیش لوکس',
  },
  margin_exclusive: {
    ar: 'حصري',
    en: 'Exclusive',
    fr: 'Exclusif',
    es: 'Exclusivo',
    it: 'Esclusivo',
    de: 'Exklusiv',
    ru: 'Эксклюзив',
    zh: '珍藏级',
    tr: 'Eksklüsif',
    fa: 'انحصاری',
  },
  metrics_title_tpl: {
    ar: 'مؤشرات التسعير والأرباح للزجاجة ({v} مل)',
    en: 'Unit Pricing & Profit Metrics ({v} ml)',
    fr: 'Indicateurs de prix et de profit par flacon ({v} ml)',
    es: 'Métricas de precio y ganancia por frasco ({v} ml)',
    it: 'Metriche di prezzo e profitto per flacone ({v} ml)',
    de: 'Preis- & Gewinnkennzahlen pro Flakon ({v} ml)',
    ru: 'Показатели цены и прибыли на флакон ({v} мл)',
    zh: '单瓶定价与利润指标（{v} 毫升）',
    tr: 'Birim fiyat ve kâr metrikleri ({v} ml)',
    fa: 'شاخص‌های قیمت‌گذاری و سود بطری ({v} میلی‌لیتر)',
  },
  mfg_cost_label: {
    ar: 'تكلفة الإنتاج:',
    en: 'Manufacturing Cost:',
    fr: 'Coût de production :',
    es: 'Costo de producción:',
    it: 'Costo di produzione:',
    de: 'Herstellungskosten:',
    ru: 'Себестоимость:',
    zh: '生产成本：',
    tr: 'Üretim maliyeti:',
    fa: 'هزینه تولید:',
  },
  breakdown_title: {
    ar: 'تفاصيل تكلفة الزجاجة الواحدة:',
    en: 'Per-Bottle Cost Breakdown:',
    fr: 'Détail du coût par flacon :',
    es: 'Desglose de costo por frasco:',
    it: 'Dettaglio del costo per flacone:',
    de: 'Kostenaufschlüsselung pro Flakon:',
    ru: 'Разбивка стоимости на флакон:',
    zh: '单瓶成本明细：',
    tr: 'Şişe başına maliyet dökümü:',
    fa: 'جزئیات هزینه هر بطری:',
  },
  oil_row_tpl: {
    ar: 'الزيت العطري ({g} جم)',
    en: 'Perfume Oil ({g} g)',
    fr: 'Huile de parfum ({g} g)',
    es: 'Aceite de fragancia ({g} g)',
    it: 'Olio aromatico ({g} g)',
    de: 'Duftöl ({g} g)',
    ru: 'Парфюмерное масло ({g} г)',
    zh: '香精油（{g} g）',
    tr: 'Esans yağı ({g} g)',
    fa: 'روغن عطری ({g} گرم)',
  },
  ethanol_row_tpl: {
    ar: 'الكحول والمذيبات ({v} مل)',
    en: 'Ethanol & Solvents ({v} ml)',
    fr: 'Éthanol et solvants ({v} ml)',
    es: 'Etanol y solventes ({v} ml)',
    it: 'Etanolo e solventi ({v} ml)',
    de: 'Ethanol & Lösungsmittel ({v} ml)',
    ru: 'Этанол и растворители ({v} мл)',
    zh: '乙醇与溶剂（{v} ml）',
    tr: 'Etanol ve çözücüler ({v} ml)',
    fa: 'الکل و حلال‌ها ({v} میلی‌لیتر)',
  },
  packaging_row: {
    ar: 'الزجاجة والعلبة والتغليف',
    en: 'Flacon, Atomizer & Packaging',
    fr: 'Flacon, écrin et emballage',
    es: 'Frasco, caja y embalaje',
    it: 'Flacone, astuccio e imballo',
    de: 'Flakon, Box & Verpackung',
    ru: 'Флакон, коробка и упаковка',
    zh: '瓶身、礼盒与包装',
    tr: 'Şişe, kutu ve ambalaj',
    fa: 'بطری، جعبه و بسته‌بندی',
  },
  labor_row: {
    ar: 'المصاريف التشغيلية والعمالة',
    en: 'Overhead & Compounding Labor',
    fr: 'Frais généraux et main-d’œuvre',
    es: 'Gastos generales y mano de obra',
    it: 'Costi generali e manodopera',
    de: 'Overhead & Arbeitskosten',
    ru: 'Накладные расходы и трудозатраты',
    zh: '运营费用与人工',
    tr: 'Genel giderler ve işçilik',
    fa: 'هزینه‌های عملیاتی و نیروی کار',
  },
  wholesale_label: {
    ar: 'سعر الجملة المقترح',
    en: 'Suggested Wholesale',
    fr: 'Prix de gros conseillé',
    es: 'Precio mayorista sugerido',
    it: 'Prezzo all’ingrosso consigliato',
    de: 'Empfohlener Großhandelspreis',
    ru: 'Рекомендуемая оптовая цена',
    zh: '建议批发价',
    tr: 'Önerilen toptan fiyat',
    fa: 'قیمت عمده پیشنهادی',
  },
  retail_label: {
    ar: 'سعر التجزئة المقترح (RRP)',
    en: 'Suggested Retail (RRP)',
    fr: 'Prix de détail conseillé (RRP)',
    es: 'Precio minorista sugerido (RRP)',
    it: 'Prezzo al dettaglio consigliato (RRP)',
    de: 'Empfohlener Verkaufspreis (RRP)',
    ru: 'Рекомендуемая розничная цена (RRP)',
    zh: '建议零售价 (RRP)',
    tr: 'Önerilen perakende fiyat (RRP)',
    fa: 'قیمت خرده‌فروشی پیشنهادی (RRP)',
  },
  net_profit_label: {
    ar: 'صافي الربح:',
    en: 'Net Profit:',
    fr: 'Profit net :',
    es: 'Ganancia neta:',
    it: 'Profitto netto:',
    de: 'Nettogewinn:',
    ru: 'Чистая прибыль:',
    zh: '净利润：',
    tr: 'Net kâr:',
    fa: 'سود خالص:',
  },
  batch_forecast_tpl: {
    ar: 'عوائد التشغيلة الإجمالية ({n} عبوة):',
    en: 'Batch Financial Forecast ({n} Units):',
    fr: 'Prévision financière du lot ({n} unités) :',
    es: 'Pronóstico financiero del lote ({n} unidades):',
    it: 'Previsione finanziaria del lotto ({n} unità):',
    de: 'Finanzprognose der Charge ({n} Stück):',
    ru: 'Финансовый прогноз партии ({n} шт.):',
    zh: '批次财务预测（{n} 瓶）：',
    tr: 'Parti finansal tahmini ({n} adet):',
    fa: 'پیش‌بینی مالی کل پارت ({n} عدد):',
  },
  margin_word: {
    ar: 'ربح',
    en: 'Margin',
    fr: 'marge',
    es: 'margen',
    it: 'margine',
    de: 'Marge',
    ru: 'маржа',
    zh: '利润率',
    tr: 'marj',
    fa: 'سود',
  },
  required_capital: {
    ar: 'رأس المال المطلوب',
    en: 'Required Capital',
    fr: 'Capital requis',
    es: 'Capital requerido',
    it: 'Capitale richiesto',
    de: 'Benötigtes Kapital',
    ru: 'Требуемый капитал',
    zh: '所需资金',
    tr: 'Gerekli sermaye',
    fa: 'سرمایه لازم',
  },
  gross_revenue: {
    ar: 'إجمالي المبيعات',
    en: 'Gross Revenue',
    fr: 'Chiffre d’affaires brut',
    es: 'Ingresos brutos',
    it: 'Ricavi lordi',
    de: 'Bruttoumsatz',
    ru: 'Валовая выручка',
    zh: '总营收',
    tr: 'Brüt gelir',
    fa: 'درآمد ناخالص',
  },
  net_profit: {
    ar: 'صافي الأرباح',
    en: 'Net Profit',
    fr: 'Profit net',
    es: 'Ganancia neta',
    it: 'Profitto netto',
    de: 'Nettogewinn',
    ru: 'Чистая прибыль',
    zh: '净利润',
    tr: 'Net kâr',
    fa: 'سود خالص',
  },
  compare_title: {
    ar: 'جدول مقارنة الأسعار بالعملات العالمية والتصدير',
    en: 'Global Multi-Currency Export Benchmarking',
    fr: 'Comparatif multicritère des devises',
    es: 'Comparativa multimoneda para exportación',
    it: 'Confronto multivaluta per l’esportazione',
    de: 'Globale Multi-Währungs-Benchmark',
    ru: 'Сравнение цен в мировых валютах',
    zh: '全球多币种出口价格对照',
    tr: 'Küresel çoklu para birimi karşılaştırması',
    fa: 'جدول مقایسه قیمت‌ها با ارزهای جهانی و صادرات',
  },
  compare_with: {
    ar: 'مقارنة مع:',
    en: 'Compare with:',
    fr: 'Comparer avec :',
    es: 'Comparar con:',
    it: 'Confronta con:',
    de: 'Vergleichen mit:',
    ru: 'Сравнить с:',
    zh: '对比货币：',
    tr: 'Karşılaştır:',
    fa: 'مقایسه با:',
  },
  th_currency: {
    ar: 'العملة العالمية',
    en: 'Currency',
    fr: 'Devise',
    es: 'Moneda',
    it: 'Valuta',
    de: 'Währung',
    ru: 'Валюта',
    zh: '货币',
    tr: 'Para birimi',
    fa: 'ارز جهانی',
  },
  th_unit_cost: {
    ar: 'تكلفة الزجاجة',
    en: 'Unit Cost',
    fr: 'Coût unitaire',
    es: 'Costo unitario',
    it: 'Costo unitario',
    de: 'Stückkosten',
    ru: 'Цена за штуку',
    zh: '单瓶成本',
    tr: 'Birim maliyet',
    fa: 'هزینه بطری',
  },
  th_wholesale: {
    ar: 'سعر الجملة',
    en: 'Wholesale',
    fr: 'Gros',
    es: 'Mayorista',
    it: 'Ingrosso',
    de: 'Großhandel',
    ru: 'Опт',
    zh: '批发价',
    tr: 'Toptan',
    fa: 'قیمت عمده',
  },
  th_retail: {
    ar: 'سعر التجزئة (RRP)',
    en: 'Retail (RRP)',
    fr: 'Détail (RRP)',
    es: 'Minorista (RRP)',
    it: 'Dettaglio (RRP)',
    de: 'Einzelhandel (RRP)',
    ru: 'Розница (RRP)',
    zh: '零售价 (RRP)',
    tr: 'Perakende (RRP)',
    fa: 'خرده‌فروشی (RRP)',
  },
  th_net: {
    ar: 'صافي الربح',
    en: 'Net Margin',
    fr: 'Marge nette',
    es: 'Margen neto',
    it: 'Margine netto',
    de: 'Nettomarge',
    ru: 'Чистая маржа',
    zh: '净利',
    tr: 'Net marj',
    fa: 'سود خالص',
  },
  fx_note: {
    ar: '* أسعار الصرف مرجعية معيارية مبنية على مؤشر الدولار العالمي (160+ عملة عالمية مدعومة).',
    en: '* Exchange rates are benchmark estimates referenced to global indices (160+ currencies supported).',
    fr: '* Taux de change indicatifs basés sur des indices mondiaux (160+ devises).',
    es: '* Tipos de cambio de referencia basados en índices globales (160+ monedas).',
    it: '* Cambi indicativi basati su indici globali (160+ valute).',
    de: '* Wechselkurse sind Richtwerte globaler Indizes (160+ Währungen).',
    ru: '* Курс — справочный, по глобальным индексам (160+ валют).',
    zh: '* 汇率为基于全球指数的参考估算（支持 160+ 种货币）。',
    tr: '* Kurlar küresel endekslere dayalı tahmini referanslardır (160+ para birimi).',
    fa: '* نرخ‌های ارز مرجع و تقریبی و مبتنی بر شاخص جهانی دلار است (پشتیبانی از بیش از ۱۶۰ ارز).',
  },
  brand: {
    ar: 'منصة صمم عطرك مع شام',
    en: 'Sham Parfumerie Atelier',
    fr: 'Sham Parfumerie Atelier',
    es: 'Sham Parfumerie Atelier',
    it: 'Sham Parfumerie Atelier',
    de: 'Sham Parfumerie Atelier',
    ru: 'Sham Parfumerie Atelier',
    zh: 'Sham 香水工坊',
    tr: 'Sham Parfümerie Atölyesi',
    fa: 'پلتفرم شام',
  },
  chart_section_title: {
    ar: 'الرسم البياني المالي: مقارنة تكلفة الإنتاج وسعر البيع المتوقع بحسب حجم العطر',
    en: 'Financial Decision Chart: Production Cost vs Selling Price by Volume',
    fr: 'Graphique financier : Coût de production vs Prix de vente par volume',
    es: 'Gráfico financiero: Costo de producción vs Precio de venta por volumen',
    it: 'Grafico finanziario: Costo di produzione vs Prezzo di vendita per volume',
    de: 'Finanzdiagramm: Herstellungskosten vs. Verkaufspreis nach Flakongröße',
    ru: 'Финансовый график: Себестоимость vs Цена продажи по объёму',
    zh: '财务决策图表：按香水容量对比制造成本与建议售价',
    tr: 'Finansal Karar Grafiği: Şişe Hacmine Göre Üretim Maliyeti ve Satış Fiyatı',
    fa: 'نمودار تصمیم‌گیری مالی: مقایسه هزینه تولید و قیمت فروش بر اساس حجم عطر',
  },
  chart_section_desc: {
    ar: 'تحليل اقتصادي مرئي يوضح لمصمم العطور ديناميكية تسعير الزجاجات المختلفة وهوامش الربح ووفورات الحجم لاتخاذ قرار مالي وتسويقي مدروس.',
    en: 'Visual unit-economics breakdown showing how production cost, pricing elasticity, and net margins scale across bottle sizes for smart financial decisions.',
    fr: 'Analyse visuelle montrant l’élasticité des coûts, des prix et des marges selon les tailles de flacons pour éclairer les décisions financières.',
    es: 'Análisis visual que muestra cómo escalan costos, precios de venta y márgenes según el tamaño del frasco para una decisión financiera acertada.',
    it: 'Analisi visiva dell’evoluzione di costi, prezzi di vendita e margini per volumi di flacone, a supporto delle decisioni finanziarie.',
    de: 'Visuelle Analyse der Stückkosten-, Preis- und Margenentwicklung über verschiedene Flakongrößen zur fundierten Finanzentscheidung.',
    ru: 'Наглядный анализ себестоимости, розничных цен и чистой прибыли по разным объёмам флаконов для принятия финансовых решений.',
    zh: '直观展示不同容量瓶装下的成本结构、建议售价与净利润率，辅助调香师制定精准商业决策。',
    tr: 'Parfüm tasarımcısının doğru finansal karar almasını sağlayan, şişe boyutlarına göre birim maliyet ve kâr marjı analizi.',
    fa: 'تحلیل اقتصادی تصویری برای طراح عطر جهت بررسی تغییرات هزینه، قیمت‌گذاری و حاشیه سود در اندازه‌های مختلف بطری.',
  },
  chart_view_mode_label: {
    ar: 'مستوى التسعير المعروض:',
    en: 'Displayed Pricing Target:',
    fr: 'Niveau de prix affiché :',
    es: 'Nivel de precio mostrado:',
    it: 'Livello di prezzo visualizzato:',
    de: 'Angezeigte Preisstufe:',
    ru: 'Уровень отображаемой цены:',
    zh: '显示价格梯度：',
    tr: 'Görüntülenen Fiyat Düzeyi:',
    fa: 'سطح قیمت‌گذاری نمایشی:',
  },
  chart_view_retail: {
    ar: 'سعر بيع التجزئة المقترح (Retail)',
    en: 'Suggested Retail Price',
    fr: 'Prix de vente public conseillé',
    es: 'Precio minorista sugerido',
    it: 'Prezzo consigliato al pubblico',
    de: 'Empfohlener Endverbraucherpreis',
    ru: 'Рекомендованная розничная цена',
    zh: '建议零售价',
    tr: 'Önerilen Perakende Satış Fiyatı',
    fa: 'قیمت پیشنهادی خرده‌فروشی',
  },
  chart_view_wholesale: {
    ar: 'سعر بيع الجملة (Wholesale)',
    en: 'Wholesale Price',
    fr: 'Prix de vente en gros',
    es: 'Precio mayorista',
    it: 'Prezzo all’ingrosso',
    de: 'Großhandelspreis',
    ru: 'Оптовая цена',
    zh: '批发价',
    tr: 'Toptan Satış Fiyatı',
    fa: 'قیمت فروش عمده',
  },
  chart_metric_bottle: {
    ar: 'إجمالي الزجاجة (Total Bottle)',
    en: 'Total Per Bottle',
    fr: 'Total par flacon',
    es: 'Total por frasco',
    it: 'Totale per flacone',
    de: 'Gesamt pro Flakon',
    ru: 'Итого за флакон',
    zh: '单瓶总额',
    tr: 'Şişe Başına Toplam',
    fa: 'مجموع هر بطری',
  },
  chart_metric_ml: {
    ar: 'المقياس لكل 1 مل (Per ml Economics)',
    en: 'Per 1 ml Economics',
    fr: 'Économie par 1 ml',
    es: 'Métricas por 1 ml',
    it: 'Metriche per 1 ml',
    de: 'Kennzahlen pro 1 ml',
    ru: 'Экономика на 1 мл',
    zh: '每毫升经济学指标',
    tr: '1 ml Başına Değerler',
    fa: 'شاخص‌های اقتصادی به ازای هر ۱ میل',
  },
  legend_cost: {
    ar: 'تكلفة الإنتاج الإجمالية',
    en: 'Total Production Cost',
    fr: 'Coût total de production',
    es: 'Costo total de producción',
    it: 'Costo totale di produzione',
    de: 'Gesamte Herstellungskosten',
    ru: 'Общая себестоимость',
    zh: '总制造成本',
    tr: 'Toplam Üretim Maliyeti',
    fa: 'مجموع هزینه تولید',
  },
  legend_price: {
    ar: 'سعر البيع المتوقع',
    en: 'Expected Selling Price',
    fr: 'Prix de vente prévu',
    es: 'Precio de venta esperado',
    it: 'Prezzo di vendita atteso',
    de: 'Erwarteter Verkaufspreis',
    ru: 'Ожидаемая цена продажи',
    zh: '预计销售价格',
    tr: 'Beklenen Satış Fiyatı',
    fa: 'قیمت فروش پیش‌بینی‌شده',
  },
  legend_profit: {
    ar: 'صافي الربح المتوقع',
    en: 'Expected Net Profit',
    fr: 'Bénéfice net prévu',
    es: 'Beneficio neto esperado',
    it: 'Profitto netto previsto',
    de: 'Erwarteter Nettogewinn',
    ru: 'Ожидаемая чистая прибыль',
    zh: '预计净利润',
    tr: 'Beklenen Net Kâr',
    fa: 'سود خالص پیش‌بینی‌شده',
  },
  legend_raw_materials: {
    ar: 'الزيت العطري والكحول',
    en: 'Perfume Oil & Ethanol',
    fr: 'Huile de parfum & éthanol',
    es: 'Aceite de fragancia y etanol',
    it: 'Olio profumato ed etanolo',
    de: 'Duftöl & Ethanol',
    ru: 'Ароматическое масло и этанол',
    zh: '香精油与乙醇',
    tr: 'Esans yağı ve etanol',
    fa: 'روغن عطری و اتانول',
  },
  legend_packaging_labor: {
    ar: 'الزجاجة والعلبة والمصنعية',
    en: 'Bottle, Box & Labor',
    fr: 'Flacon, étui & atelier',
    es: 'Frasco, caja y mano de obra',
    it: 'Flacone, scatola e manodopera',
    de: 'Flakon, Verpackung & Handwerk',
    ru: 'Флакон, коробка и работа',
    zh: '瓶身、包装盒与人工',
    tr: 'Şişe, kutu ve işçilik',
    fa: 'بطری، جعبه و دستمزد',
  },
  current_flacon_badge: {
    ar: 'الحجم الحالي المعتمد',
    en: 'Current Master Volume',
    fr: 'Volume actuel sélectionné',
    es: 'Volumen actual seleccionado',
    it: 'Volume attuale selezionato',
    de: 'Aktuell gewähltes Volumen',
    ru: 'Текущий выбранный объём',
    zh: '当前选定容量',
    tr: 'Mevcut Seçili Hacim',
    fa: 'حجم انتخابی کنونی',
  },
  detail_breakdown_title: {
    ar: 'التحليل المالي التفصيلي للزجاجة ({v} مل):',
    en: 'Detailed Unit Economics for Flacon ({v} ml):',
    fr: 'Économie unitaire détaillée pour ({v} ml) :',
    es: 'Economía unitaria detallada para ({v} ml):',
    it: 'Economia unitaria dettagliata per ({v} ml):',
    de: 'Detaillierte Stückkostenrechnung für ({v} ml):',
    ru: 'Детальный расчёт себестоимости флакона ({v} мл):',
    zh: '（{v} 毫升）瓶装详细单件经济学核算：',
    tr: '({v} ml) Şişe İçin Detaylı Birim Maliyet Analizi:',
    fa: 'تحلیل مالی تفصیلی برای بطری ({v} میلی‌لیتر):',
  },
  roi_label: {
    ar: 'معدل العائد على الاستثمار (ROI):',
    en: 'Return on Investment (ROI):',
    fr: 'Retour sur investissement (ROI) :',
    es: 'Retorno de inversión (ROI):',
    it: 'Ritorno sull’investimento (ROI):',
    de: 'Kapitalrendite (ROI):',
    ru: 'Рентабельность инвестиций (ROI):',
    zh: '投资回报率（ROI）：',
    tr: 'Yatırım Getirisi (ROI):',
    fa: 'نرخ بازگشت سرمایه (ROI):',
  },
  margin_rate_label: {
    ar: 'نسبة هامش الربح من البيع:',
    en: 'Profit Margin on Selling Price:',
    fr: 'Marge bénéficiaire sur prix de vente :',
    es: 'Margen de beneficio sobre venta:',
    it: 'Margine di profitto sul prezzo:',
    de: 'Gewinnmarge am Verkaufspreis:',
    ru: 'Маржинальность от цены продажи:',
    zh: '销售利润率：',
    tr: 'Satış Üzerinden Kâr Oranı:',
    fa: 'درصد حاشیه سود از فروش:',
  },
  cost_per_ml_label: {
    ar: 'تكلفة الملي الواحد:',
    en: 'Cost per 1 ml:',
    fr: 'Coût par 1 ml :',
    es: 'Costo por 1 ml:',
    it: 'Costo per 1 ml:',
    de: 'Kosten pro 1 ml:',
    ru: 'Себестоимость 1 мл:',
    zh: '每毫升成本：',
    tr: '1 ml Başına Maliyet:',
    fa: 'هزینه هر ۱ میلی‌لیتر:',
  },
  selling_per_ml_label: {
    ar: 'سعر البيع لكل 1 مل:',
    en: 'Selling price per 1 ml:',
    fr: 'Prix de vente par 1 ml :',
    es: 'Precio de venta por 1 ml:',
    it: 'Prezzo di vendita per 1 ml:',
    de: 'Verkaufspreis pro 1 ml:',
    ru: 'Цена продажи 1 мл:',
    zh: '每毫升售价：',
    tr: '1 ml Satış Fiyatı:',
    fa: 'قیمت فروش هر ۱ میلی‌لیتر:',
  },
  breakeven_units_tpl: {
    ar: 'نقطة التعادل للدفعة ({n} زجاجة): تحتاج بيع {b} زجاجة لاسترداد رأس مال الإنتاج بالكامل.',
    en: 'Batch Breakeven ({n} units): requires selling {b} bottles to fully recoup production capital.',
    fr: 'Seuil de rentabilité ({n} unités) : nécessite la vente de {b} flacons pour couvrir l’investissement.',
    es: 'Punto de equilibrio ({n} uds): requiere vender {b} frascos para recuperar el capital invertido.',
    it: 'Punto di pareggio ({n} flaconi): occorre vendere {b} pezzi per recuperare il capitale di produzione.',
    de: 'Gewinnschwelle ({n} Stück): erfordert den Verkauf von {b} Flakons zur vollen Kostendeckung.',
    ru: 'Точка безубыточности ({n} шт.): продажа {b} флаконов полностью окупает затраты партии.',
    zh: '（{n} 瓶批次）盈亏平衡点：售出 {b} 瓶即可收回全部生产成本。',
    tr: 'Parti Başa Baş Noktası ({n} şişe): Yatırılan sermayeyi karşılamak için {b} şişe satışı gerekir.',
    fa: 'نقطه سربه‌سر برای پارت ({n} بطری): فروش {b} بطری کل سرمایه تولید را بازمی‌گرداند.',
  },
  decision_matrix_title: {
    ar: 'مصفوفة القرار المالي والتسعير بحسب الحجم',
    en: 'Volume & Pricing Decision Matrix',
    fr: 'Matrice de décision financière par volume',
    es: 'Matriz de decisión financiera por volumen',
    it: 'Matrice decisionale finanziaria per volume',
    de: 'Entscheidungsmatrix nach Flakongröße',
    ru: 'Матрица финансовых решений по объёмам',
    zh: '按容量财务决策矩阵',
    tr: 'Hacme Göre Finansal Karar Matrisi',
    fa: 'ماتریس تصمیم‌گیری مالی بر اساس حجم',
  },
  th_flacon_vol: {
    ar: 'سعة الزجاجة',
    en: 'Flacon Volume',
    fr: 'Volume du flacon',
    es: 'Capacidad del frasco',
    it: 'Volume flacone',
    de: 'Flakongröße',
    ru: 'Объём флакона',
    zh: '瓶装容量',
    tr: 'Şişe Hacmi',
    fa: 'حجم بطری',
  },
  th_cost_total: {
    ar: 'تكلفة الإنتاج',
    en: 'Production Cost',
    fr: 'Coût de production',
    es: 'Costo producción',
    it: 'Costo produzione',
    de: 'Herstellkosten',
    ru: 'Себестоимость',
    zh: '制造成本',
    tr: 'Üretim Maliyeti',
    fa: 'هزینه تولید',
  },
  th_suggested_price: {
    ar: 'سعر البيع المقترح',
    en: 'Target Selling Price',
    fr: 'Prix de vente conseillé',
    es: 'Precio sugerido',
    it: 'Prezzo suggerito',
    de: 'Ziel-Verkaufspreis',
    ru: 'Реком. цена продажи',
    zh: '建议售价',
    tr: 'Önerilen Satış Fiyatı',
    fa: 'قیمت فروش پیشنهادی',
  },
  th_net_margin: {
    ar: 'صافي الربح للزجاجة',
    en: 'Net Profit / Unit',
    fr: 'Bénéfice net / unité',
    es: 'Beneficio neto / ud',
    it: 'Utile netto / pezzo',
    de: 'Nettogewinn / Stück',
    ru: 'Чистая прибыль / шт.',
    zh: '单瓶净利',
    tr: 'Birim Başına Net Kâr',
    fa: 'سود خالص هر بطری',
  },
  th_cost_ml: {
    ar: 'تكلفة الملي الواحد',
    en: 'Cost per 1 ml',
    fr: 'Coût / 1 ml',
    es: 'Costo / 1 ml',
    it: 'Costo / 1 ml',
    de: 'Kosten / 1 ml',
    ru: 'Себестоимость / 1 мл',
    zh: '每毫升成本',
    tr: '1 ml Maliyeti',
    fa: 'هزینه هر ۱ میل',
  },
  th_roi: {
    ar: 'العائد (ROI)',
    en: 'ROI %',
    fr: 'ROI %',
    es: 'ROI %',
    it: 'ROI %',
    de: 'ROI %',
    ru: 'Рентабельность (ROI)',
    zh: '投资回报率 (ROI)',
    tr: 'Yatırım Getirisi (ROI)',
    fa: 'بازده سرمایه‌گذاری (ROI)',
  },
  th_financial_verdict: {
    ar: 'التوصية المالية للمصمم',
    en: 'Financial Recommendation',
    fr: 'Recommandation financière',
    es: 'Recomendación financiera',
    it: 'Raccomandazione finanziaria',
    de: 'Finanzielle Empfehlung',
    ru: 'Финансовая рекомендация',
    zh: '设计师财务建议',
    tr: 'Tasarımcı Finansal Önerisi',
    fa: 'توصیه مالی برای طراح',
  },
  verdict_travel_desc: {
    ar: 'حجم استكشاف وسفر: تكلفة الملي مرتفعة ولكن سعر الدخول منخفض، ممتاز لاكتساب عملاء جدد وتجربة العطر.',
    en: 'Discovery & Travel size: higher per-ml cost but accessible price point; ideal for customer onboarding.',
    fr: 'Format voyage : coût au ml plus élevé mais prix d’accès accessible ; idéal pour la découverte.',
    es: 'Formato viaje: mayor costo por ml pero precio de entrada accesible; excelente para captación de clientes.',
    it: 'Formato viaggio: costo al ml più elevato ma prezzo accessibile; ottimo per farsi conoscere.',
    de: 'Reise- & Entdeckungsgröße: höhere Kosten pro ml bei niedrigem Einstiegspreis; ideal zum Kennenlernen.',
    ru: 'Тревел-формат: себестоимость за мл выше, но доступная цена привлекает новых покупателей.',
    zh: '旅行便携装：每毫升成本偏高但总门槛低，非常适合作为拓客拉新体验装。',
    tr: 'Keşif ve seyahat boyu: ml maliyeti yüksek ancak erişilebilir fiyatıyla yeni müşteri kazanımında etkilidir.',
    fa: 'حجم سفری و تست: هزینه هر میل بالاتر است اما قیمت ورودی مناسب مشتریان جدید است.',
  },
  verdict_compact_desc: {
    ar: 'حجم مدمج فاخر: حل وسط بين سعر البيع المناسب وهوامش ربح متماسكة، ممتاز للإهداء ومجموعات البوتيك.',
    en: 'Compact Luxury: solid balance between customer price acceptance and boutique margins.',
    fr: 'Luxe compact : bon équilibre entre prix d’achat attractif et marge saine en boutique.',
    es: 'Lujo compacto: equilibrio entre precio atractivo y buen margen para colecciones boutique.',
    it: 'Lusso compatto: buon equilibrio tra prezzo competitivo e margini solidi per boutique.',
    de: 'Kompakter Luxus: ausgewogene Balance zwischen Endkundenpreis und Boutiquen-Marge.',
    ru: 'Компактный люкс: отличный компромисс между доступной ценой и надёжной маржой.',
    zh: '轻奢精致装：在价格亲和力与精品店稳健毛利率之间取得良好平衡。',
    tr: 'Kompakt lüks: müşteri için makul fiyat ve butik satışı için dengeli kâr marjı sunar.',
    fa: 'لوکس فشرده: تعادل مناسب میان قیمت پذیرفتنی و حاشیه سود پایدار برای بوتیک‌ها.',
  },
  verdict_golden_desc: {
    ar: 'الحجم الذهبي التجاري: أعلى توازن بين كلفة التعبئة وتكلفة المكونات، وهو الأكثر مبيعاً في أسواق العطور العالمية.',
    en: 'Commercial Golden Ratio: peak balance of packaging efficiency and ingredients; global market best-seller.',
    fr: 'Ratio d’or commercial : équilibre parfait emballage/formule, le plus vendu dans la parfumerie mondiale.',
    es: 'Proporción áurea comercial: óptimo equilibrio envase/fórmula, el más vendido a nivel internacional.',
    it: 'Rapporto aureo commerciale: equilibrio perfetto tra packaging e formula, formato più venduto al mondo.',
    de: 'Goldener Schnitt: ideale Balance aus Verpackungs- und Rohstoffkosten; internationaler Bestseller.',
    ru: 'Золотой стандарт: лучшее соотношение затрат на упаковку и объёма духов, мировой бестселлер.',
    zh: '商业黄金标准：包装耗材与原料成本最佳配比，全球香水零售最主流热销规格。',
    tr: 'Ticari altın standart: ambalaj maliyeti ile esans dengesinin zirvesi; küresel pazarda en çok satan hacim.',
    fa: 'استاندارد طلایی تجاری: بهترین تناسب میان هزینه بسته‌بندی و فرمولاسیون و پرفروش‌ترین اندازه در بازار.',
  },
  verdict_niche_desc: {
    ar: 'الحجم المفضل لدور النيش: يرفع القيمة الذهنية والرمزية للعلامة التجارية بهامش ربح مجزي جداً.',
    en: 'Niche House Preference: elevates brand prestige and perceived value with substantial margin upside.',
    fr: 'Préférence niche : renforce le prestige et la valeur perçue de la marque avec une marge généreuse.',
    es: 'Favorito de nicho: eleva el prestigio de marca y el valor percibido con excelente margen.',
    it: 'Preferito dalle maison di nicchia: accresce il prestigio del brand con un margine elevato.',
    de: 'Nischen-Favorit: steigert Markenprestige und gefühlten Wert bei sehr solider Gewinnmarge.',
    ru: 'Нишевый фаворит: подчёркивает премиальность бренда и обеспечивает высокую чистую прибыль.',
    zh: '沙龙小众典范：大幅提升品牌格调与高级感，同时提供极其丰厚的单件利润空间。',
    tr: 'Niş parfüm tercihi: markanın prestij algısını yükseltir ve yüksek kâr marjı sağlar.',
    fa: 'محبوب خانه‌های نیش: افزایش‌دهنده وجهه و ارزش درک‌شده برند با حاشیه سود بسیار مناسب.',
  },
  verdict_flagship_desc: {
    ar: 'حجم الواجهة الأساسية: أعلى عائد مالي مطلق لكل عملية بيع، وأفضل توفير لتكلفة الملي للمستهلك.',
    en: 'Flagship Volume: highest absolute cash profit per unit and best value per milliliter for the buyer.',
    fr: 'Volume phare : rentabilité absolue maximale par unité et meilleur rapport ml/prix pour le client.',
    es: 'Volumen insignia: mayor ganancia neta absoluta por frasco y mejor valor por ml para el consumidor.',
    it: 'Volume di punta: massimo profitto monetario per pezzo e miglior valore al ml per il cliente.',
    de: 'Flaggschiff-Volumen: höchster absoluter Reingewinn pro Flakon und bestes Preis-pro-ml-Verhältnis.',
    ru: 'Флагманский объём: максимальная абсолютная прибыль с флакона и максимальная выгода за мл для клиента.',
    zh: '旗舰核心规格：单瓶现金净利润最高，客户每毫升性价比最佳，极具商业爆发力。',
    tr: 'Amiral gemisi hacmi: şişe başına en yüksek net nakit kârı ve müşteri için en iyi ml değerini sağlar.',
    fa: 'حجم پرچمدار اصلی: بالاترین سود نقدی مطلق به ازای هر فروش و بیشترین صرفه اقتصادی برای مشتری.',
  },
  verdict_salon_desc: {
    ar: 'إصدار صالونات وكولونيا كبرى: قيمة فاتورة مرتفعة جداً (High AOV) وربح استثنائي لهواة الجمع.',
    en: 'Grand Salon Edition: premium average order value with exceptional collector & flacon margin.',
    fr: 'Édition grand salon : panier moyen très élevé et marge exceptionnelle pour collectionneurs.',
    es: 'Edición gran salón: ticket promedio muy alto y rentabilidad destacada para coleccionistas.',
    it: 'Edizione gran salone: scontrino medio elevato e margine eccezionale per collezionisti.',
    de: 'Großsalon-Edition: sehr hoher Warenkorbwert und außergewöhnliche Sammler-Marge.',
    ru: 'Гранд-салон: высокий средний чек и внушительная маржа для ценителей и коллекционеров.',
    zh: '大容量沙龙典藏装：极大提升客单价（High AOV），面向资深藏家的高溢价规格。',
    tr: 'Büyük salon ve kolonya edisyonu: yüksek sepet tutarı ve koleksiyoncular için özel kâr potansiyeli.',
    fa: 'نسخه بزرگ سالنی: میانگین سبد خرید بسیار بالا با سود فوق‌العاده برای مجموعه‌داران.',
  },
  verdict_custom_desc: {
    ar: 'حجم مخصص خاص بالتركيبة الحالية: مبني بدقة على معطيات الزجاجة المدخلة في الحاسبة.',
    en: 'Custom Volume: dynamically computed from your active formulation bottle size.',
    fr: 'Volume sur-mesure : calculé selon les paramètres de votre formule actuelle.',
    es: 'Volumen personalizado: calculado según los parámetros de tu fórmula activa.',
    it: 'Volume personalizzato: calcolato in base alla formula attualmente impostata.',
    de: 'Individuelle Größe: exakt auf die Parameter der aktuellen Rezeptur abgestimmt.',
    ru: 'Индивидуальный объём: рассчитан точно по текущим параметрам вашей формулы.',
    zh: '专属定制容量：依据当前计算器中输入的实际参数精确核算。',
    tr: 'Özel hacim: hesaplayıcıya girilen mevcut formül parametrelerine göre hesaplanmıştır.',
    fa: 'حجم سفارشی: دقیقا بر اساس پارامترهای واردشده در این فرمول محاسبه شده است.',
  },
  insights_card_title: {
    ar: 'نصائح الخبير المالي لمصمم العطور (Financial Advisor Insights):',
    en: 'Perfumer Financial Advisory Insights:',
    fr: 'Conseils financiers pour le créateur de parfum :',
    es: 'Claves financieras para el diseñador de fragancias:',
    it: 'Consigli finanziari per il designer di profumi:',
    de: 'Finanzielle Praxistipps für Parfümeure:',
    ru: 'Финансовые рекомендации для парфюмера:',
    zh: '调香师商业财务决策建议：',
    tr: 'Parfümör İçin Finansal Karar Notları:',
    fa: 'نکات راهبردی مالی برای طراح عطر:',
  },
  scale_tip_title: {
    ar: 'ميزة وفورات الحجم (Packaging Economy):',
    en: 'Packaging Economies of Scale:',
    fr: 'Économies d’échelle sur le packaging :',
    es: 'Economías de escala en packaging:',
    it: 'Economie di scala sul packaging:',
    de: 'Skaleneffekte bei Verpackungen:',
    ru: 'Эффект масштаба упаковки:',
    zh: '包装耗材规模效益：',
    tr: 'Ambalajda Ölçek Ekonomisi:',
    fa: 'مزیت صرفه‌جویی مقیاس بسته‌بندی:',
  },
  scale_tip_text: {
    ar: 'تكلفة البخاخ والغطاء والعلبة تنخفض نسبياً لكل مل كلما كبرت الزجاجة، مما يجعل زجاجات 100 مل تحقق أرباحاً صافية تفوق 3 أضعاف زجاجات 30 مل بالرغم من تقارب كلفة التعبئة.',
    en: 'Pumps, caps, and rigid boxes cost nearly the same regardless of volume. A 100 ml bottle generates >3x the absolute cash profit of a 30 ml bottle despite similar manufacturing handling.',
    fr: 'Pompe, capot et boîte coûtent quasiment autant quel que soit le volume. Un 100 ml dégage >3x le profit d’un 30 ml avec un temps de conditionnement presque identique.',
    es: 'Atomizador, tapa y estuche cuestan casi lo mismo sin importar el volumen. Un frasco de 100 ml genera >3x el beneficio de un 30 ml con similar esfuerzo.',
    it: 'Spruzzino, tappo e scatola incidono quasi allo stesso modo. Un 100 ml genera >3x il profitto netto di un 30 ml a parità di complessità di confezionamento.',
    de: 'Zerstäuber, Kappe und Box kosten fast dasselbe. Ein 100-ml-Flakon bringt >3x mehr Reingewinn als 30 ml bei vergleichbarem Abfüllaufwand.',
    ru: 'Стоимость помпы, крышки и коробки почти одинакова. 100 мл флакон приносит в 3+ раза больше чистой прибыли, чем 30 мл.',
    zh: '喷头、瓶盖和外盒的基础成本变动不大。100 毫升瓶装的实际现金利润通常是 30 毫升的 3 倍以上，极具商业杠杆效应。',
    tr: 'Pompa, kapak ve kutu maliyeti hacim büyüdükçe birim ml başına düşer. 100 ml şişe, benzer işçilikle 30 ml şişeye kıyasla 3 kattan fazla net nakit kâr sağlar.',
    fa: 'هزینه پمپ، درپوش و جعبه در بطری‌های بزرگتر به ازای هر میل کاهش می‌یابد؛ بطری ۱۰۰ میل بیش از ۳ برابر بطری ۳۰ میل سود نقدی ایجاد می‌کند.',
  },
  sweetspot_tip_title: {
    ar: 'استراتيجية الثنائيات (Size Bundling Strategy):',
    en: 'Dual-Size Pricing Strategy:',
    fr: 'Stratégie du double format :',
    es: 'Estrategia de doble formato:',
    it: 'Strategia del doppio formato:',
    de: 'Doppelgrößen-Strategie:',
    ru: 'Стратегия двух форматов:',
    zh: '双规格捆绑策略：',
    tr: 'Çift Boyut Stratejisi:',
    fa: 'استراتژی دو اندازه (پکیج سایزها):',
  },
  sweetspot_tip_text: {
    ar: 'ينصح خبراء العطور بطرح حجمين رئيسيين: 30 مل أو 50 مل كخيار شراء منخفض المخاطرة، و 100 مل كخيار قيمة مضافة يعظم هامش الربح النقدي.',
    en: 'Industry best practice suggests launching two complementary sizes: 30 or 50 ml as an impulse/entry purchase, and 100 ml to maximize cash margin and customer lifetime value.',
    fr: 'La bonne pratique consiste à lancer deux tailles : 30 ou 50 ml pour un achat d’impulsion accessible, et 100 ml pour maximiser la marge nette.',
    es: 'La práctica recomendada es lanzar dos tamaños: 30 o 50 ml para compra de entrada, y 100 ml para maximizar el margen de ganancia neta.',
    it: 'La strategia migliore prevede due formati: 30 o 50 ml per l’acquisto d’impulso, e 100 ml per massimizzare la marginalità complessiva.',
    de: 'Die beste Strategie umfasst zwei Größen: 30 oder 50 ml als Einstiegskauf und 100 ml zur Maximierung des absoluten Gewinns.',
    ru: 'Рекомендуется запускать два формата: 30 или 50 мл для первого знакомства и 100 мл для максимизации абсолютной чистой прибыли.',
    zh: '成熟品牌最佳实践是推出双规格：30 或 50 毫升作为低门槛尝试装，100 毫升作为主力利润放大装。',
    tr: 'Sektörün en başarılı stratejisi iki boyut sunmaktır: kolay satın alma için 30 veya 50 ml, kârı maksimize etmek için 100 ml.',
    fa: 'توصیه متخصصان ارائه دو اندازه مکمل است: ۳۰ یا ۵۰ میل برای ورود و خرید آسان، و ۱۰۰ میل برای به حداکثر رساندن سود خالص نقدی.',
  },
} satisfies Record<string, LText>;

export const CostCalculator: React.FC<CostCalculatorProps> = ({
  currentLang = 'ar',
  formulation,
  calculationResult,
  currentCurrencyCode = 'SAR',
}) => {
  const rtl = isRTL(currentLang);
  const L = makeT(currentLang, S);
  const [costing, setCosting] = useState<CostingState>({
    oilCostPerKg: 650, // default SAR per kg for premium French/Oriental oil
    alcoholCostPerLiter: 35, // default SAR per liter
    bottleUnitCost: 18, // bottle + atomizer + cap
    packagingUnitCost: 12, // luxury outer box + cellophane + labels
    laborAndOverheadPerUnit: 6, // labor & blending
    batchSize: 50, // default batch of 50 bottles
    targetMarginPercent: 80, // 80% markup
    currency: currentCurrencyCode || 'SAR',
  });

  // Comparison custom currency for export benchmarking
  const [comparisonCurrency, setComparisonCurrency] = useState<string>('USD');

  // Chart interactive controls: pricing target (retail vs wholesale) and metric mode (bottle vs per_ml)
  const [chartPriceMode, setChartPriceMode] = useState<'retail' | 'wholesale'>('retail');
  const [chartMetricMode, setChartMetricMode] = useState<'bottle' | 'per_ml'>('bottle');
  const [selectedVolume, setSelectedVolume] = useState<number>(formulation.bottleVolumeMl || 50);

  // Sync selectedVolume if formulation bottleVolumeMl updates
  useEffect(() => {
    if (formulation.bottleVolumeMl && formulation.bottleVolumeMl > 0) {
      setSelectedVolume(formulation.bottleVolumeMl);
    }
  }, [formulation.bottleVolumeMl]);

  // Sync if parent updates current currency code
  useEffect(() => {
    if (currentCurrencyCode && currentCurrencyCode !== costing.currency) {
      setCosting((prev) => ({ ...prev, currency: currentCurrencyCode }));
    }
  }, [currentCurrencyCode]);

  const costResult = calculatePerfumeCosting(calculationResult, costing);
  const activeCurrency = findCurrencyByCode(costing.currency);

  // Multi-Volume Financial Economics Dataset
  const standardVolumes = [15, 30, 50, 75, 100, 200];
  const allVolumes = Array.from(new Set([...standardVolumes, formulation.bottleVolumeMl]))
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);

  const baseVolume = formulation.bottleVolumeMl > 0 ? formulation.bottleVolumeMl : 50;

  const volumeEconomics = allVolumes.map((vol) => {
    // Proportional fragrance oil weight & cost
    const oilRatio = baseVolume > 0
      ? (calculationResult.oilWeightGrams / baseVolume)
      : (formulation.concentrationPercent / 100);
    const oilWeightGrams = vol * oilRatio;
    const oilCost = (oilWeightGrams / 1000) * (costing.oilCostPerKg || 0);

    // Proportional alcohol volume & cost
    const alcoholRatio = baseVolume > 0
      ? (calculationResult.alcoholVolumeMl / baseVolume)
      : Math.max(0, (100 - formulation.concentrationPercent) / 100);
    const alcoholVolumeMl = vol * alcoholRatio;
    const alcoholCost = (alcoholVolumeMl / 1000) * (costing.alcoholCostPerLiter || 0);

    // Packaging cost scaling (sub-linear elasticity for bottle glass, crimp pump & box)
    const packagingFactor = Math.pow(vol / baseVolume, 0.35);
    const bottleCost = (costing.bottleUnitCost || 0) * packagingFactor;
    const boxCost = (costing.packagingUnitCost || 0) * packagingFactor;
    const packagingCost = bottleCost + boxCost;

    // Labor overhead
    const laborCost = (costing.laborAndOverheadPerUnit || 0) * (0.85 + 0.15 * (vol / baseVolume));

    const totalCost = oilCost + alcoholCost + packagingCost + laborCost;
    const rawMaterialsCost = oilCost + alcoholCost;
    const packagingAndLaborCost = packagingCost + laborCost;

    const wholesalePrice = totalCost * (1 + ((costing.targetMarginPercent || 50) * 0.4) / 100);
    const retailPrice = totalCost * (1 + (costing.targetMarginPercent || 50) / 100);

    const activeSellingPrice = chartPriceMode === 'retail' ? retailPrice : wholesalePrice;
    const netProfit = activeSellingPrice - totalCost;
    const profitMarginPercent = activeSellingPrice > 0 ? (netProfit / activeSellingPrice) * 100 : 0;
    const roiPercent = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;

    const costPerMl = totalCost / vol;
    const sellingPricePerMl = activeSellingPrice / vol;
    const profitPerMl = netProfit / vol;

    let verdictKey: keyof typeof S = 'verdict_custom_desc';
    if (vol <= 20) verdictKey = 'verdict_travel_desc';
    else if (vol <= 35) verdictKey = 'verdict_compact_desc';
    else if (vol <= 60) verdictKey = 'verdict_golden_desc';
    else if (vol <= 85) verdictKey = 'verdict_niche_desc';
    else if (vol <= 120) verdictKey = 'verdict_flagship_desc';
    else if (vol >= 180) verdictKey = 'verdict_salon_desc';

    return {
      volume: vol,
      isCurrent: vol === formulation.bottleVolumeMl,
      oilWeightGrams,
      oilCost,
      alcoholVolumeMl,
      alcoholCost,
      bottleCost,
      boxCost,
      packagingCost,
      laborCost,
      rawMaterialsCost,
      packagingAndLaborCost,
      totalCost,
      wholesalePrice,
      retailPrice,
      activeSellingPrice,
      netProfit,
      profitMarginPercent,
      roiPercent,
      costPerMl,
      sellingPricePerMl,
      profitPerMl,
      verdictKey,
    };
  });

  const maxBottleValue = Math.max(...volumeEconomics.map((item) => item.activeSellingPrice), 1);
  const maxPerMlValue = Math.max(...volumeEconomics.map((item) => item.sellingPricePerMl), 0.1);

  const selectedItem = volumeEconomics.find((item) => item.volume === selectedVolume) || volumeEconomics[0];
  const breakevenBottles = selectedItem && selectedItem.netProfit > 0
    ? Math.ceil((selectedItem.totalCost * costing.batchSize) / selectedItem.activeSellingPrice)
    : costing.batchSize;

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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Cost Inputs */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-5">
            <div className="space-y-3 pb-3 border-b border-stone-100">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <span className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-amber-700" />
                  <span>{L('inputs_title')}</span>
                </span>
                
                {/* All World Currencies Selector */}
                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs">
                    <span className="text-base">{activeCurrency.flag}</span>
                    <select
                      value={costing.currency}
                      onChange={(e) =>
                        setCosting((prev) => ({ ...prev, currency: e.target.value }))
                      }
                      className="bg-transparent font-bold text-stone-900 focus:outline-none cursor-pointer max-w-[220px]"
                    >
                      {WORLD_CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.code} - {pickArEn(currentLang, c.nameAr, c.nameEn)} ({pickArEn(currentLang, c.symbolAr, c.code)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Quick Popular Currency Selector Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
                <span className="text-stone-400 font-semibold shrink-0">{L('quick_select')}</span>
                {POPULAR_CURRENCIES.map((code) => {
                  const curr = findCurrencyByCode(code);
                  const isSelected = costing.currency === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setCosting((prev) => ({ ...prev, currency: code }))}
                      className={`whitespace-nowrap px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-800 text-white shadow-xs scale-105'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      <span>{curr.flag}</span>
                      <span>{code}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Input Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Fragrance Oil Cost */}
              <div>
                <label className="text-xs font-medium text-stone-700 mb-1 block">
                  {fmt(L('oil_cost_tpl'), { cur: costing.currency })}
                </label>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={costing.oilCostPerKg}
                  onChange={(e) =>
                    setCosting((prev) => ({
                      ...prev,
                      oilCostPerKg: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className={`w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm font-mono-numbers text-stone-900 focus:outline-none focus:border-amber-700 ${rtl ? 'text-right' : 'text-left'}`}
                />
                <span className="text-[10px] text-stone-400">
                  {L('kg_note')}
                </span>
              </div>

              {/* Alcohol Cost */}
              <div>
                <label className="text-xs font-medium text-stone-700 mb-1 block">
                  {fmt(L('ethanol_cost_tpl'), { cur: costing.currency })}
                </label>
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={costing.alcoholCostPerLiter}
                  onChange={(e) =>
                    setCosting((prev) => ({
                      ...prev,
                      alcoholCostPerLiter: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className={`w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm font-mono-numbers text-stone-900 focus:outline-none focus:border-amber-700 ${rtl ? 'text-right' : 'text-left'}`}
                />
                <span className="text-[10px] text-stone-400">
                  {L('liter_note')}
                </span>
              </div>

              {/* Bottle & Atomizer */}
              <div>
                <label className="text-xs font-medium text-stone-700 mb-1 block">
                  {fmt(L('bottle_cost_tpl'), { cur: costing.currency })}
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={costing.bottleUnitCost}
                  onChange={(e) =>
                    setCosting((prev) => ({
                      ...prev,
                      bottleUnitCost: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className={`w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm font-mono-numbers text-stone-900 focus:outline-none focus:border-amber-700 ${rtl ? 'text-right' : 'text-left'}`}
                />
              </div>

              {/* Outer Box & Packaging */}
              <div>
                <label className="text-xs font-medium text-stone-700 mb-1 block">
                  {fmt(L('box_cost_tpl'), { cur: costing.currency })}
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={costing.packagingUnitCost}
                  onChange={(e) =>
                    setCosting((prev) => ({
                      ...prev,
                      packagingUnitCost: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className={`w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm font-mono-numbers text-stone-900 focus:outline-none focus:border-amber-700 ${rtl ? 'text-right' : 'text-left'}`}
                />
              </div>

              {/* Labor & Overhead */}
              <div>
                <label className="text-xs font-medium text-stone-700 mb-1 block">
                  {fmt(L('labor_cost_tpl'), { cur: costing.currency })}
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={costing.laborAndOverheadPerUnit}
                  onChange={(e) =>
                    setCosting((prev) => ({
                      ...prev,
                      laborAndOverheadPerUnit: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className={`w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm font-mono-numbers text-stone-900 focus:outline-none focus:border-amber-700 ${rtl ? 'text-right' : 'text-left'}`}
                />
              </div>

              {/* Batch Size */}
              <div>
                <label className="text-xs font-medium text-stone-700 mb-1 block">
                  {L('batch_label')}
                </label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  step="10"
                  value={costing.batchSize}
                  onChange={(e) =>
                    setCosting((prev) => ({
                      ...prev,
                      batchSize: Math.max(1, parseInt(e.target.value) || 1),
                    }))
                  }
                  className={`w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm font-mono-numbers text-stone-900 focus:outline-none focus:border-amber-700 ${rtl ? 'text-right' : 'text-left'}`}
                />
              </div>
            </div>

            {/* Profit Margin Slider */}
            <div className="pt-4 border-t border-stone-100 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-stone-800">
                  {L('margin_label')}
                </span>
                <span className="font-mono-numbers font-bold text-amber-900 bg-amber-50 px-2.5 py-0.5 rounded">
                  {costing.targetMarginPercent}%
                </span>
              </div>
              <input
                type="range"
                min="20"
                max="300"
                step="5"
                value={costing.targetMarginPercent}
                onChange={(e) =>
                  setCosting((prev) => ({
                    ...prev,
                    targetMarginPercent: parseFloat(e.target.value),
                  }))
                }
                className="w-full accent-amber-800 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-stone-400 font-mono-numbers">
                <span>30% ({L('margin_economy')})</span>
                <span>80% ({L('margin_standard')})</span>
                <span>150% ({L('margin_luxury')})</span>
                <span>300% ({L('margin_exclusive')})</span>
              </div>
            </div>

          </div>
        </div>

        {/* Right Column: Pricing & ROI Dashboard */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-md space-y-6">
            <div className="border-b border-stone-100 pb-3">
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wider block">
                {fmt(L('metrics_title_tpl'), { v: formulation.bottleVolumeMl })}
              </span>
              <h3 className="text-lg font-bold text-stone-950 mt-0.5">
                {L('mfg_cost_label')} {formatNum(costResult.totalCostPerBottle)} {costing.currency}
              </h3>
            </div>

            {/* Breakdown per Bottle */}
            <div className="space-y-2.5">
              <div className="text-xs font-semibold text-stone-700">
                {L('breakdown_title')}
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-stone-100 text-stone-600">
                  <span>{fmt(L('oil_row_tpl'), { g: formatNum(calculationResult.oilWeightGrams) })}</span>
                  <span className="font-mono-numbers font-medium text-stone-900">
                    {formatNum(costResult.oilCostPerBottle)} {costing.currency}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-stone-100 text-stone-600">
                  <span>{fmt(L('ethanol_row_tpl'), { v: formatNum(calculationResult.alcoholVolumeMl) })}</span>
                  <span className="font-mono-numbers font-medium text-stone-900">
                    {formatNum(costResult.alcoholCostPerBottle)} {costing.currency}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-stone-100 text-stone-600">
                  <span>{L('packaging_row')}</span>
                  <span className="font-mono-numbers font-medium text-stone-900">
                    {formatNum(costResult.packagingCostPerBottle)} {costing.currency}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-stone-100 text-stone-600">
                  <span>{L('labor_row')}</span>
                  <span className="font-mono-numbers font-medium text-stone-900">
                    {formatNum(costResult.laborCostPerBottle)} {costing.currency}
                  </span>
                </div>
              </div>
            </div>

            {/* Recommended Pricing Targets */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl space-y-1">
                <span className="text-[11px] text-stone-500 font-medium block">
                  {L('wholesale_label')}
                </span>
                <div className="text-base font-extrabold text-stone-900 font-mono-numbers">
                  {formatNum(costResult.suggestedWholesalePrice)} {costing.currency}
                </div>
              </div>

              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                <span className="text-[11px] text-amber-900 font-medium block">
                  {L('retail_label')}
                </span>
                <div className="text-lg font-extrabold text-amber-950 font-mono-numbers">
                  {formatNum(costResult.suggestedRetailPrice)} {costing.currency}
                </div>
                <div className="text-[10px] text-amber-700">
                  {L('net_profit_label')} +{formatNum(costResult.profitPerBottleRetail)} {costing.currency}
                </div>
              </div>
            </div>

            {/* Batch Totals Summary */}
            <div className="p-4 bg-stone-900 text-white rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-stone-800">
                <span className="text-stone-300 font-medium">
                  {fmt(L('batch_forecast_tpl'), { n: costing.batchSize })}
                </span>
                <span className="text-amber-400 font-mono-numbers font-bold">
                  +{costing.targetMarginPercent}% {L('margin_word')}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] text-stone-400">{L('required_capital')}</div>
                  <div className="text-xs sm:text-sm font-bold font-mono-numbers text-stone-200 mt-0.5">
                    {formatNum(costResult.totalBatchCost)} {costing.currency}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-stone-400">{L('gross_revenue')}</div>
                  <div className="text-xs sm:text-sm font-bold font-mono-numbers text-white mt-0.5">
                    {formatNum(costResult.totalBatchRevenueRetail)} {costing.currency}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-amber-400">{L('net_profit')}</div>
                  <div className="text-xs sm:text-sm font-bold font-mono-numbers text-amber-400 mt-0.5">
                    +{formatNum(costResult.totalBatchProfitRetail)} {costing.currency}
                  </div>
                </div>
              </div>
            </div>

            {/* Global Multi-Currency Export & Pricing Table */}
            <div className="p-4 sm:p-5 bg-gradient-to-br from-stone-50 via-white to-amber-50/50 border border-amber-200 rounded-2xl shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-stone-200/80 pb-3">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-amber-700" />
                  <span className="text-xs font-bold text-stone-900">
                    {L('compare_title')}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="text-stone-500">{L('compare_with')}</span>
                  <select
                    value={comparisonCurrency}
                    onChange={(e) => setComparisonCurrency(e.target.value)}
                    className="px-2 py-0.5 bg-white border border-stone-300 rounded-lg text-xs font-bold text-stone-800 cursor-pointer"
                  >
                    {WORLD_CURRENCIES.map((c) => (
                      <option key={`comp-${c.code}`} value={c.code}>
                        {c.flag} {c.code} ({pickArEn(currentLang, c.symbolAr, c.code)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-[11px] text-stone-500 leading-relaxed">
                {L('fx_note')}
              </p>

              <div className="overflow-x-auto">
                <table className={`w-full ${rtl ? 'text-right' : 'text-left'} text-xs`}>
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-500 font-semibold text-[11px]">
                      <th className="pb-2">{L('th_currency')}</th>
                      <th className="pb-2">{L('th_unit_cost')}</th>
                      <th className="pb-2">{L('th_wholesale')}</th>
                      <th className="pb-2 text-amber-900 font-bold">{L('th_retail')}</th>
                      <th className="pb-2 text-emerald-700">{L('th_net')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 font-mono-numbers">
                    {[
                      'USD',
                      'EUR',
                      'GBP',
                      'SAR',
                      'AED',
                      'EGP',
                      'KWD',
                      comparisonCurrency !== 'USD' &&
                      comparisonCurrency !== 'EUR' &&
                      comparisonCurrency !== 'GBP' &&
                      comparisonCurrency !== 'SAR' &&
                      comparisonCurrency !== 'AED' &&
                      comparisonCurrency !== 'EGP' &&
                      comparisonCurrency !== 'KWD'
                        ? comparisonCurrency
                        : 'TRY',
                    ].map((code) => {
                      const curr = findCurrencyByCode(code);
                      const costConv = convertCurrency(costResult.totalCostPerBottle, costing.currency, code);
                      const wholesaleConv = convertCurrency(costResult.suggestedWholesalePrice, costing.currency, code);
                      const retailConv = convertCurrency(costResult.suggestedRetailPrice, costing.currency, code);
                      const profitConv = convertCurrency(costResult.profitPerBottleRetail, costing.currency, code);
                      const isCostingBase = costing.currency === code;

                      return (
                        <tr
                          key={`row-${code}`}
                          className={`hover:bg-amber-50/50 transition-colors ${
                            isCostingBase ? 'bg-amber-100/50 font-bold' : ''
                          }`}
                        >
                          <td className="py-2.5 font-sans flex items-center gap-1.5 font-semibold text-stone-900">
                            <span>{curr.flag}</span>
                            <span>{pickArEn(currentLang, curr.nameAr, curr.nameEn)}</span>
                            <span className="text-[10px] text-stone-500 font-mono">({code})</span>
                          </td>
                          <td className="py-2.5 text-stone-700">
                            {formatNum(costConv)} {pickArEn(currentLang, curr.symbolAr, curr.code)}
                          </td>
                          <td className="py-2.5 text-stone-800">
                            {formatNum(wholesaleConv)} {pickArEn(currentLang, curr.symbolAr, curr.code)}
                          </td>
                          <td className="py-2.5 font-bold text-amber-900">
                            {formatNum(retailConv)} {pickArEn(currentLang, curr.symbolAr, curr.code)}
                          </td>
                          <td className="py-2.5 font-bold text-emerald-700">
                            +{formatNum(profitConv)} {pickArEn(currentLang, curr.symbolAr, curr.code)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="pt-2 border-t border-stone-200/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[10px] text-stone-400 font-mono">
                <span>{L('fx_note')}</span>
                <span className="text-amber-800 font-semibold">{L('brand')}</span>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FINANCIAL DECISION CHART: PRODUCTION COST VS EXPECTED SELLING PRICE BY VOLUME */}
      {/* ========================================================================= */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-stone-200/90 shadow-md space-y-6">
        {/* Section Header & Interactive Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-stone-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center shadow-xs">
                <BarChart3 className="w-4 h-4" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-stone-900">
                {L('chart_section_title')}
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-stone-500 max-w-3xl leading-relaxed">
              {L('chart_section_desc')}
            </p>
          </div>

          {/* Interactive Mode Switches */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Price Target Mode (Retail vs Wholesale) */}
            <div className="bg-stone-100 p-1 rounded-xl flex items-center text-xs font-semibold">
              <button
                type="button"
                onClick={() => setChartPriceMode('retail')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  chartPriceMode === 'retail'
                    ? 'bg-amber-900 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {L('chart_view_retail')}
              </button>
              <button
                type="button"
                onClick={() => setChartPriceMode('wholesale')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  chartPriceMode === 'wholesale'
                    ? 'bg-amber-900 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {L('chart_view_wholesale')}
              </button>
            </div>

            {/* Metric Mode (Per Bottle vs Per 1 ml) */}
            <div className="bg-stone-100 p-1 rounded-xl flex items-center text-xs font-semibold">
              <button
                type="button"
                onClick={() => setChartMetricMode('bottle')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  chartMetricMode === 'bottle'
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {L('chart_metric_bottle')}
              </button>
              <button
                type="button"
                onClick={() => setChartMetricMode('per_ml')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  chartMetricMode === 'per_ml'
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {L('chart_metric_ml')}
              </button>
            </div>
          </div>
        </div>

        {/* Legend Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-stone-50/80 p-3 rounded-2xl border border-stone-200/60">
          <div className="flex flex-wrap items-center gap-4 text-stone-700">
            {/* Cost Legend */}
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-md bg-stone-800 shrink-0 inline-block" />
              <span className="font-semibold">{L('legend_cost')}</span>
              <span className="text-[11px] text-stone-400">
                ({L('legend_raw_materials')} + {L('legend_packaging_labor')})
              </span>
            </div>

            {/* Selling Price Legend */}
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-md bg-amber-600 shrink-0 inline-block" />
              <span className="font-semibold">{L('legend_price')}</span>
            </div>

            {/* Net Profit Margin Legend */}
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-md bg-emerald-600 shrink-0 inline-block" />
              <span className="font-semibold text-emerald-800">{L('legend_profit')}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-stone-500 font-mono-numbers">
            <span className="font-bold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded-md">
              {costing.currency}
            </span>
            <span>+{costing.targetMarginPercent}% {L('margin_word')}</span>
          </div>
        </div>

        {/* Visual Dual-Bar Comparison Graphic */}
        <div className="overflow-x-auto pb-4 pt-2">
          <div className="min-w-[720px] grid grid-cols-6 gap-3 sm:gap-4">
            {volumeEconomics.map((item) => {
              const isSelected = item.volume === selectedVolume;
              const costVal = chartMetricMode === 'bottle' ? item.totalCost : item.costPerMl;
              const priceVal = chartMetricMode === 'bottle' ? item.activeSellingPrice : item.sellingPricePerMl;
              const profitVal = chartMetricMode === 'bottle' ? item.netProfit : item.profitPerMl;

              const maxRef = chartMetricMode === 'bottle' ? maxBottleValue : maxPerMlValue;
              const costHeightPercent = Math.max(12, Math.min(100, (costVal / maxRef) * 100));
              const priceHeightPercent = Math.max(16, Math.min(100, (priceVal / maxRef) * 100));

              // Raw materials portion inside the cost bar
              const rawMaterialsRatio = item.totalCost > 0 ? item.rawMaterialsCost / item.totalCost : 0.5;

              return (
                <div
                  key={`vol-bar-${item.volume}`}
                  onClick={() => setSelectedVolume(item.volume)}
                  className={`group relative flex flex-col justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-50/60 border-amber-500 ring-2 ring-amber-500/30 shadow-md scale-[1.02]'
                      : 'bg-white hover:bg-stone-50/70 border-stone-200 hover:border-stone-300 shadow-xs'
                  }`}
                >
                  {/* Top: Volume Badge & Tags */}
                  <div className="space-y-1 text-center pb-2 border-b border-stone-100">
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-sm font-extrabold font-mono-numbers text-stone-900">
                        {item.volume}
                      </span>
                      <span className="text-[11px] font-semibold text-stone-500">{uiLabel('unit_ml', currentLang)}</span>
                    </div>

                    {item.isCurrent && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded-full">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        <span>{L('current_flacon_badge')}</span>
                      </span>
                    )}

                    {!item.isCurrent && item.volume === 100 && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                        <Award className="w-2.5 h-2.5" />
                        <span>{uiLabel('top_profit', currentLang)}</span>
                      </span>
                    )}

                    {!item.isCurrent && item.volume === 50 && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-purple-800 bg-purple-100 px-1.5 py-0.5 rounded-full">
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>{uiLabel('golden_size', currentLang)}</span>
                      </span>
                    )}
                  </div>

                  {/* Visual Dual Bars (Height 210px) */}
                  <div className="h-[210px] flex items-end justify-center gap-2.5 sm:gap-3 py-3 px-1">
                    {/* Bar 1: Cost Bar */}
                    <div className="flex-1 flex flex-col items-center h-full justify-end">
                      <span className="text-[10px] font-mono-numbers font-semibold text-stone-600 mb-1 leading-none text-center">
                        {formatNum(costVal)}
                      </span>
                      <div
                        style={{ height: `${costHeightPercent}%` }}
                        className="w-full max-w-[28px] rounded-t-lg overflow-hidden flex flex-col justify-end shadow-xs bg-stone-200 transition-all duration-300"
                        title={`${L('legend_cost')}: ${formatNum(item.totalCost)} ${costing.currency}`}
                      >
                        {/* Packaging & Labor segment */}
                        <div
                          style={{ height: `${Math.round((1 - rawMaterialsRatio) * 100)}%` }}
                          className="w-full bg-stone-500/90"
                        />
                        {/* Raw materials segment */}
                        <div
                          style={{ height: `${Math.round(rawMaterialsRatio * 100)}%` }}
                          className="w-full bg-amber-800"
                        />
                      </div>
                      <span className="text-[9px] font-bold text-stone-400 mt-1 uppercase">
                        {L('th_cost_total')}
                      </span>
                    </div>

                    {/* Bar 2: Selling Price Bar */}
                    <div className="flex-1 flex flex-col items-center h-full justify-end">
                      <div className="mb-1 flex flex-col items-center leading-none">
                        <span className="text-[9px] font-mono-numbers font-bold text-emerald-700 bg-emerald-50 px-1 rounded">
                          +{formatNum(item.profitMarginPercent)}%
                        </span>
                        <span className="text-[10px] font-mono-numbers font-bold text-stone-900 mt-0.5">
                          {formatNum(priceVal)}
                        </span>
                      </div>
                      <div
                        style={{ height: `${priceHeightPercent}%` }}
                        className="w-full max-w-[28px] rounded-t-lg overflow-hidden flex flex-col justify-end shadow-xs bg-amber-100 transition-all duration-300"
                        title={`${L('legend_price')}: ${formatNum(item.activeSellingPrice)} ${costing.currency}`}
                      >
                        {/* Net Profit segment */}
                        <div
                          style={{
                            height: `${item.activeSellingPrice > 0 ? Math.round((item.netProfit / item.activeSellingPrice) * 100) : 50}%`,
                          }}
                          className="w-full bg-emerald-600"
                        />
                        {/* Cost Base segment */}
                        <div
                          style={{
                            height: `${item.activeSellingPrice > 0 ? Math.round((item.totalCost / item.activeSellingPrice) * 100) : 50}%`,
                          }}
                          className="w-full bg-amber-600/80"
                        />
                      </div>
                      <span className="text-[9px] font-bold text-amber-800 mt-1 uppercase">
                        {chartPriceMode === 'retail' ? 'تجزئة' : 'جملة'}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Stats Card */}
                  <div className="space-y-1.5 pt-2.5 border-t border-stone-100 text-xs">
                    <div className="flex justify-between items-center text-[11px] text-stone-600">
                      <span>{L('legend_profit')}</span>
                      <span className="font-mono-numbers font-bold text-emerald-700">
                        +{formatNum(profitVal)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-stone-400">
                      <span>{L('cost_per_ml_label')}</span>
                      <span className="font-mono-numbers font-medium text-stone-600">
                        {formatNum(item.costPerMl)} {costing.currency}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Volume Financial Deep Dive Card */}
        {selectedItem && (
          <div className="bg-gradient-to-br from-amber-50/70 via-stone-50 to-white p-5 sm:p-6 rounded-2xl border border-amber-200/90 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-amber-200/60 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-800 text-white flex items-center justify-center font-mono-numbers text-xs font-bold">
                  {selectedItem.volume}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-stone-900">
                    {fmt(L('detail_breakdown_title'), { v: selectedItem.volume })}
                  </h4>
                  <span className="text-xs text-amber-800 font-medium">
                    {chartPriceMode === 'retail' ? L('chart_view_retail') : L('chart_view_wholesale')}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-500">{L('roi_label')}</span>
                <span className="text-sm font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-lg font-mono-numbers">
                  +{formatNum(selectedItem.roiPercent)}%
                </span>
              </div>
            </div>

            {/* 4 KPI Summary Cards for Selected Volume */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3 bg-white rounded-xl border border-stone-200/80 space-y-1">
                <span className="text-[11px] text-stone-500 font-medium block">
                  {L('th_cost_total')}
                </span>
                <div className="text-base font-extrabold text-stone-900 font-mono-numbers">
                  {formatNum(selectedItem.totalCost)} {costing.currency}
                </div>
                <div className="text-[10px] text-stone-400">
                  {L('legend_raw_materials')}: {formatNum(selectedItem.rawMaterialsCost)} {costing.currency}
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-stone-200/80 space-y-1">
                <span className="text-[11px] text-stone-500 font-medium block">
                  {L('th_suggested_price')}
                </span>
                <div className="text-base font-extrabold text-amber-900 font-mono-numbers">
                  {formatNum(selectedItem.activeSellingPrice)} {costing.currency}
                </div>
                <div className="text-[10px] text-stone-400">
                  {L('margin_rate_label')} {formatNum(selectedItem.profitMarginPercent)}%
                </div>
              </div>

              <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 space-y-1">
                <span className="text-[11px] text-emerald-800 font-medium block">
                  {L('th_net_margin')}
                </span>
                <div className="text-base font-extrabold text-emerald-700 font-mono-numbers">
                  +{formatNum(selectedItem.netProfit)} {costing.currency}
                </div>
                <div className="text-[10px] text-emerald-600 font-mono-numbers">
                  +{formatNum(selectedItem.profitPerMl)} {costing.currency} / {uiLabel('unit_ml', currentLang)}
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-stone-200/80 space-y-1">
                <span className="text-[11px] text-stone-500 font-medium block">
                  {L('th_cost_ml')}
                </span>
                <div className="text-base font-extrabold text-stone-800 font-mono-numbers">
                  {formatNum(selectedItem.costPerMl)} {costing.currency}
                </div>
                <div className="text-[10px] text-stone-400">
                  {L('selling_per_ml_label')} {formatNum(selectedItem.sellingPricePerMl)} {costing.currency}
                </div>
              </div>
            </div>

            {/* Breakeven Banner & Financial Verdict */}
            <div className="p-3.5 bg-stone-900 text-white rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  {fmt(L('breakeven_units_tpl'), {
                    n: costing.batchSize,
                    b: breakevenBottles,
                  })}
                </span>
              </div>
              <span className="text-amber-400 font-semibold shrink-0">
                {selectedItem.isCurrent ? `★ ${L('current_flacon_badge')}` : `الحجم: ${selectedItem.volume} مل`}
              </span>
            </div>

            <div className="text-xs text-stone-600 bg-white/80 p-3 rounded-xl border border-stone-200/70">
              <span className="font-bold text-stone-900 ml-1">
                {L('th_financial_verdict')}:
              </span>
              <span>{L(selectedItem.verdictKey)}</span>
            </div>
          </div>
        )}

        {/* Multi-Volume Financial Decision Matrix Table */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-800" />
            <h4 className="text-sm font-bold text-stone-900">
              {L('decision_matrix_title')}
            </h4>
          </div>

          <div className="overflow-x-auto border border-stone-200 rounded-2xl shadow-xs">
            <table className={`w-full ${rtl ? 'text-right' : 'text-left'} text-xs`}>
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-3.5">{L('th_flacon_vol')}</th>
                  <th className="py-3 px-3.5">{L('th_cost_total')}</th>
                  <th className="py-3 px-3.5 text-amber-900 font-bold">{L('th_suggested_price')}</th>
                  <th className="py-3 px-3.5 text-emerald-800 font-bold">{L('th_net_margin')}</th>
                  <th className="py-3 px-3.5">{L('th_cost_ml')}</th>
                  <th className="py-3 px-3.5 text-center">{L('th_roi')}</th>
                  <th className="py-3 px-3.5 min-w-[200px]">{L('th_financial_verdict')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-mono-numbers">
                {volumeEconomics.map((item) => {
                  const isCur = item.volume === formulation.bottleVolumeMl;
                  const isSel = item.volume === selectedVolume;
                  return (
                    <tr
                      key={`matrix-row-${item.volume}`}
                      onClick={() => setSelectedVolume(item.volume)}
                      className={`transition-colors cursor-pointer ${
                        isSel
                          ? 'bg-amber-100/60 font-bold'
                          : isCur
                            ? 'bg-amber-50/50'
                            : 'hover:bg-stone-50'
                      }`}
                    >
                      <td className="py-3 px-3.5 font-sans font-bold text-stone-900 flex items-center gap-1.5">
                        <span>{item.volume} {uiLabel('unit_ml', currentLang)}</span>
                        {isCur && (
                          <span className="text-[9px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded-full font-bold">
                            {uiLabel('certified', currentLang)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-stone-700">
                        {formatNum(item.totalCost)} {costing.currency}
                      </td>
                      <td className="py-3 px-3.5 font-bold text-amber-900">
                        {formatNum(item.activeSellingPrice)} {costing.currency}
                      </td>
                      <td className="py-3 px-3.5 font-bold text-emerald-700">
                        +{formatNum(item.netProfit)} {costing.currency}
                      </td>
                      <td className="py-3 px-3.5 text-stone-600">
                        {formatNum(item.costPerMl)} {costing.currency} / {uiLabel('unit_ml', currentLang)}
                      </td>
                      <td className="py-3 px-3.5 text-center text-emerald-800 font-bold">
                        +{formatNum(item.roiPercent)}%
                      </td>
                      <td className="py-3 px-3.5 font-sans text-stone-600 text-[11px] leading-relaxed">
                        {L(item.verdictKey)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Executive Perfumer Financial Advisory Insights */}
        <div className="p-4 sm:p-5 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-700" />
            <h4 className="text-xs sm:text-sm font-bold text-stone-900">
              {L('insights_card_title')}
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 bg-white rounded-xl border border-stone-200/70 space-y-1">
              <span className="font-bold text-stone-900 block">
                {L('scale_tip_title')}
              </span>
              <p className="text-stone-600 leading-relaxed text-[11px]">
                {L('scale_tip_text')}
              </p>
            </div>

            <div className="p-3.5 bg-white rounded-xl border border-stone-200/70 space-y-1">
              <span className="font-bold text-stone-900 block">
                {L('sweetspot_tip_title')}
              </span>
              <p className="text-stone-600 leading-relaxed text-[11px]">
                {L('sweetspot_tip_text')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
