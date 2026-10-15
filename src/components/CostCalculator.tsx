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
import { isRTL } from '../utils/localizedContent';
import { LText, makeT, fmt, pickArEn } from '../utils/localize';

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

  // Sync if parent updates current currency code
  useEffect(() => {
    if (currentCurrencyCode && currentCurrencyCode !== costing.currency) {
      setCosting((prev) => ({ ...prev, currency: currentCurrencyCode }));
    }
  }, [currentCurrencyCode]);

  const costResult = calculatePerfumeCosting(calculationResult, costing);
  const activeCurrency = findCurrencyByCode(costing.currency);

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
    </div>
  );
};
