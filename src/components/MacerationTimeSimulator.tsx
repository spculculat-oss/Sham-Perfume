import { LegalDisclaimer } from './LegalDisclaimer';
import { LocalizedNumberInput } from './LocalizedNumberInput';
import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Thermometer,
  SunDim,
  Layers,
  Printer,
  Download,
  Share2,
  Bot,
  HelpCircle,
  RotateCcw,
  FlaskConical,
  Flame,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { SupportedLanguage } from '../types/i18n';
import { isRTL } from '../لغات/localizedContent';
import { LText, loc, makeT, fmt, localeDate } from '../لغات/localize';

interface MacerationTimeSimulatorProps {
  currentLang?: SupportedLanguage;
  initialStartDate?: string;
  initialMacerationDays?: number;
  formulaTitle?: string;
  batchCode?: string;
  onOpenConsultation?: (prompt: string) => void;
  onMacerationDaysChange?: (days: number) => void;
  onStartDateChange?: (date: string) => void;
  onNavigateToTab?: (tab: string) => void;
}

interface MacerationPreset {
  id: string;
  name: LText;
  days: number;
  category: LText;
  description: LText;
  idealTemp: string;
}

const MACERATION_PRESETS: MacerationPreset[] = [
  {
    id: 'citrus_aquatic',
    name: {
      ar: 'العطور الحمضية والبحرية المنعشة',
      en: 'Citrus & Marine Aquatics',
      fr: 'Agrumes & Aquatiques Marins',
      es: 'Cítricos y Acuáticos Marinos',
      it: 'Agrumi e Acquatici Marini',
      de: 'Zitrus- & Meeresnoten',
      ru: 'Цитрусовые и морские аккорды',
      zh: '柑橘与海洋水生调',
      tr: 'Narenciye ve Denizsu Notaları',
      fa: 'مرکبات و آکوای مارین خنک',
    },
    days: 18,
    category: {
      ar: 'كولونيا وEDT خفيف',
      en: 'Cologne / Fresh EDT',
      fr: 'Cologne / EDT frais',
      es: 'Colonia / EDT fresco',
      it: 'Colonia / EDT fresco',
      de: 'Kölnisch / frisches EDT',
      ru: 'Кёльнская вода и лёгкий EDT',
      zh: '古龙与清新淡香水',
      tr: 'Kolonya ve hafif EDT',
      fa: 'کلن و EDT سبک',
    },
    description: {
      ar: 'جزيئات ليمونين وبرغموت خفيفة سريعة الأكسدة؛ تعتيق قصير لحماية البريق والانتعاش الصيفي.',
      en: 'Volatile citrus terpenes; short maceration preserves initial effervescence and fresh sparkle.',
      fr: 'Terpènes d’agrumes volatils ; une macération courte préserve l’effervescence initiale.',
      es: 'Terpenos cítricos volátiles; la maceración corta preserva la efervescencia inicial.',
      it: 'Terpeni agrumati volatili; la breve macerazione preserva l’effervescenza iniziale.',
      de: 'Flüchtige Zitrusterpene; kurze Mazeration bewahrt die anfängliche Spritzigkeit.',
      ru: 'Летучие цитрусовые терпены; короткая мацерация сохраняет исходное искристое сияние.',
      zh: '柑橘萜烯易挥发；短时陈化可保留初始的闪亮清新。',
      tr: 'Uçucu narenciye terpenleri; kısa dinlendirme baştaki köpüklü canlılığı korur.',
      fa: 'ترپن‌های مرکبات فرار؛ کهنه‌سازی کوتاه درخشش اولیه و طراوت را حفظ می‌کند.',
    },
    idealTemp: '14°C - 16°C',
  },
  {
    id: 'floral_fruity',
    name: {
      ar: 'العطور الزهرية والفاكهية المتوازنة',
      en: 'Floral Bouquets & Sweet Fruits',
      fr: 'Bouquets Floraux et Fruits Gourmands',
      es: 'Ramos Florales y Frutas Dulces',
      it: 'Bouquet Floreali e Frutti Dolci',
      de: 'Florale Bouquets & süße Früchte',
      ru: 'Цветочные букеты и сладкие фрукты',
      zh: '花香与甜果调',
      tr: 'Çiçek Buketleri ve Tatlı Meyveler',
      fa: 'باکت‌های گلی و میوه‌های شیرین',
    },
    days: 30,
    category: {
      ar: 'أو دو بارفان (EDP)',
      en: 'Eau de Parfum (EDP)',
      fr: 'Eau de Parfum (EDP)',
      es: 'Eau de Parfum (EDP)',
      it: 'Eau de Parfum (EDP)',
      de: 'Eau de Parfum (EDP)',
      ru: 'Eau de Parfum (EDP)',
      zh: '淡香精 (EDP)',
      tr: 'Eau de Parfum (EDP)',
      fa: 'او دو پرفیوم (EDP)',
    },
    description: {
      ar: 'تتطلب 4 أسابيع لتتآلف نوتات الياسمين والورد مع الكحول وتختفي اللسعة الكحولية تماماً.',
      en: 'Requires 4 weeks for rose, jasmine and fruit aldehydes to smoothly bind into perfumer’s ethanol.',
      fr: 'Nécessite 4 semaines pour que rose, jasmin et aldéhydes fruités se lient harmonieusement à l’éthanol.',
      es: 'Requiere 4 semanas para que rosa, jazmín y aldehídos frutales se integren en el etanol.',
      it: 'Richiede 4 settimane perché rosa, gelsomino e aldeidi fruttati si leghino all’etanolo.',
      de: 'Benötigt 4 Wochen, damit Rose, Jasmin und Fruchtaldehyde sich mit dem Ethanol verbinden.',
      ru: 'Требуется 4 недели, чтобы роза, жасмин и фруктовые альдегиды соединились с этанолом.',
      zh: '需要 4 周让玫瑰、茉莉与果香醛充分融入乙醇。',
      tr: 'Gül, yasemin ve meyve aldehitlerinin etanole yerleşmesi 4 hafta ister.',
      fa: 'نیازمند ۴ هفته است تا گل محمدی، یاس و آلدهیدهای میوه‌ای کاملاً در اتانول حل شوند.',
    },
    idealTemp: '16°C - 18°C',
  },
  {
    id: 'woody_spicy',
    name: {
      ar: 'العطور الخشبية والتابلية الدافئة',
      en: 'Woody, Spices & Resins',
      fr: 'Boisés, Épices et Résines',
      es: 'Maderas, Especias y Resinas',
      it: 'Legnosi, Spezie e Resine',
      de: 'Hölzer, Gewürze & Harze',
      ru: 'Древесные, пряные и смолистые',
      zh: '木质、辛香与树脂',
      tr: 'Odunsu, Baharat ve Reçineler',
      fa: 'چوبی، ادویه‌ای و رزینی',
    },
    days: 42,
    category: {
      ar: 'EDP فاخر / نيش',
      en: 'Luxury EDP / Niche',
      fr: 'EDP de luxe / niche',
      es: 'EDP de lujo / nicho',
      it: 'EDP di lusso / nicchia',
      de: 'Luxus-EDP / Nische',
      ru: 'Люкс EDP / нишевый',
      zh: '高端小众 EDP',
      tr: 'Lüks EDP / niş',
      fa: 'EDP لوکس / نیش',
    },
    description: {
      ar: 'خشب الأرز، الهيل، وخشب الصندل تحتاج 6 أسابيع لتشابك الروابط الإستيرية وتثبيت الفوحان.',
      en: 'Cedar, sandalwood and cardamom require 6 weeks for deep ester cross-linking and diffusion aura.',
      fr: 'Cèdre, santal et cardamome exigent 6 semaines de liaisons estériques profondes.',
      es: 'Cedro, sándalo y cardamomo requieren 6 semanas de enlaces estéricos profundos.',
      it: 'Cedro, sandalo e cardamomo richiedono 6 settimane di legami esterici profondi.',
      de: 'Zeder, Sandelholz und Kardamom benötigen 6 Wochen für tiefe Estervernetzungen.',
      ru: 'Кедр, сандал и кардамон требуют 6 недель для глубоких эфирных связей и фиксации шлейфа.',
      zh: '雪松、檀香与豆蔻需 6 周完成深层酯键交联与气场定香。',
      tr: 'Sedir, sandal ve kakule derin ester bağları için 6 hafta ister.',
      fa: 'سدر، صندل و هل برای پیوندهای استری عمیق و تثبیت پخش بو به ۶ هفته نیاز دارند.',
    },
    idealTemp: '16°C - 18°C',
  },
  {
    id: 'oriental_oud_amber',
    name: {
      ar: 'العطور الشرقية الثقيلة، العود والعنبر',
      en: 'Oriental, Aged Oud & Amber',
      fr: 'Orientaux, Oud Vieilli et Ambre',
      es: 'Orientales, Oud Añejo y Ámbar',
      it: 'Orientali, Oud Invecchiato e Ambra',
      de: 'Oriental, gereiftes Oud & Amber',
      ru: 'Восточные, выдержанный уд и амбра',
      zh: '东方调、陈化乌木与琥珀',
      tr: 'Oryantal, Yaşlı Ud ve Amber',
      fa: 'شرقی، عود کهنه و عنبر',
    },
    days: 55,
    category: {
      ar: 'إكستري دي بارفان (Extrait)',
      en: 'Extrait de Parfum',
      fr: 'Extrait de Parfum',
      es: 'Extrait de Parfum',
      it: 'Extrait de Parfum',
      de: 'Extrait de Parfum',
      ru: 'Экстракт духов (Extrait)',
      zh: '浓香精 (Extrait)',
      tr: 'Extrait de Parfum',
      fa: 'اکستریت دو پرفیوم',
    },
    description: {
      ar: 'الراتنجات الثقيلة، البخور، والعود المعتق تتطلب وقتاً طويلاً لتفكيك الحدة وظهور الدفء المخملي الملكي.',
      en: 'Heavy balsamic resins and aged oud require 8 weeks to unlock sweet velvety opulence.',
      fr: 'Résines balsamiques lourdes et oud vieilli exigent 8 semaines pour révéler l’opulence veloutée.',
      es: 'Resinas balsámicas pesadas y oud añejo requieren 8 semanas para revelar su opulencia aterciopelada.',
      it: 'Resine balsamiche pesanti e oud invecchiato richiedono 8 settimane per rivelare l’opulenza vellutata.',
      de: 'Schwere balsamische Harze und gereiftes Oud brauchen 8 Wochen für samtigen Glanz.',
      ru: 'Тяжёлые бальзамические смолы и выдержанный уд требуют 8 недель, чтобы раскрыть бархатную роскошь.',
      zh: '重脂树脂与陈化乌木需 8 周方能释放丝绒般的华贵。',
      tr: 'Ağır balsamik reçineler ve yaşlı ud 8 haftada kadife gibi zenginliği açar.',
      fa: 'رزین‌های سنگین، بخور و عود کهنه برای باز شدن شکوه مخملی به زمان طولانی نیاز دارند.',
    },
    idealTemp: '17°C - 19°C',
  },
  {
    id: 'pure_attar_royal',
    name: {
      ar: 'الخلطات المعتقة الفاخرة ودهن العود النقي',
      en: 'Pure Aged Royal Attar / Niche Extrait',
      fr: 'Attars Royaux Pures Vieillis',
      es: 'Attar Real Puro Añejado',
      it: 'Attar Reali Invecchiati',
      de: 'Reines gereiftes Royal Attar',
      ru: 'Королевские выдержанные аттары',
      zh: '纯正皇家陈化香油',
      tr: 'Saf Yaşlı Royal Attar',
      fa: 'عطرهای سلطنتی خالص کهنه',
    },
    days: 75,
    category: {
      ar: 'تعتيق نيش ملكي طويل',
      en: 'Royal Maceration Masterpiece',
      fr: 'Chef-d’œuvre de macération royale',
      es: 'Obra maestra de maceración real',
      it: 'Capolavoro di macerazione reale',
      de: 'Königliches Mazerationsmeisterwerk',
      ru: 'Королевский шедевр мацерации',
      zh: '皇家陈化杰作',
      tr: 'Kraliyet dinlendirme başyapıtı',
      fa: 'شاهکار کهنه‌سازی سلطنتی',
    },
    description: {
      ar: 'تعتيق كلاسيكي طويل للوصول إلى ذروة التناغم الكيميائي واستقرار وثبات يدوم لأيام على الأقمشة.',
      en: 'Classic prolonged maceration achieving supreme olfactory harmony and multi-day textile tenacity.',
      fr: 'Macération longue classique atteignant l’harmonie olfactive suprême et une tenue de plusieurs jours sur tissu.',
      es: 'Maceración clásica prolongada que logra armonía suprema y fijación de días en telas.',
      it: 'Macerazione classica prolungata per un’armonia suprema e una tenuta di giorni sui tessuti.',
      de: 'Klassische Langzeitmazeration für höchste olfaktorische Harmonie und mehrtägige Haltbarkeit auf Textilien.',
      ru: 'Классическая длительная мацерация, дающая высшую гармонию и многодневную стойкость на тканях.',
      zh: '经典长时陈化，达成至高嗅觉和谐与数日织物留香。',
      tr: 'Klasik uzun dinlendirme; üstün koku uyumu ve kumaşta günlerce kalıcılık sağlar.',
      fa: 'کهنه‌سازی کلاسیک طولانی برای رسیدن به اوج هماهنگی شیمیایی و ماندگاری چندروزه روی پارچه.',
    },
    idealTemp: '16°C - 18°C',
  },
];

const S = {
  official_tool: {
    ar: 'أداة معملية معتمدة',
    en: 'Official Laboratory Tool',
    fr: 'Outil de laboratoire certifié',
    es: 'Herramienta de laboratorio certificada',
    it: 'Strumento di laboratorio certificato',
    de: 'Zertifiziertes Laborwerkzeug',
    ru: 'Сертифицированный лабораторный инструмент',
    zh: '认证实验室工具',
    tr: 'Sertifikalı Laboratuvar Aracı',
    fa: 'ابزار آزمایشگاهی مورد تأیید',
  },
  page_title: {
    ar: 'محاكي التعتيق الزمني وحساب تاريخ نضوج العطر',
    en: 'Maceration & Aging Time Simulator',
    fr: 'Simulateur de macération et date de maturation',
    es: 'Simulador de maceración y envejecimiento',
    it: 'Simulatore di macerazione e invecchiamento',
    de: 'Reifungs- und Mazerationssimulator',
    ru: 'Симулятор мацерации и созревания духов',
    zh: '熟成陈化时间模拟器',
    tr: 'Dinlendirme ve Olgunlaşma Simülatörü',
    fa: 'شبیه‌ساز کهنه‌سازی و محاسبه تاریخ رسیدن عطر',
  },
  page_desc: {
    ar: 'حساب دقيق لتاريخ اكتمال نضوج العطر (Maceration Maturation Date) مع خط زمني تفاعلي لمراحل التفاعل الجزيئي.',
    en: 'Exact completion date forecasting for perfume maturation with an interactive molecular transformation timeline.',
    fr: 'Prévision précise de la date de maturation du parfum avec une chronologie interactive des transformations moléculaires.',
    es: 'Pronóstico exacto de la fecha de maduración del perfume con una línea de tiempo interactiva de transformación molecular.',
    it: 'Previsione precisa della data di maturazione del profumo con una timeline interattiva delle trasformazioni molecolari.',
    de: 'Exakte Vorhersage des Reifedatums mit interaktiver Zeitachse der molekularen Umwandlungen.',
    ru: 'Точный прогноз даты созревания парфюма с интерактивной шкалой молекулярных превращений.',
    zh: '精准预测香水熟成完成日期，并配有分子转变互动时间轴。',
    tr: 'Parfüm olgunlaşma tarihinin kesin tahmini ve moleküler dönüşüm etkileşimli zaman çizelgesi.',
    fa: 'پیش‌بینی دقیق تاریخ کامل رسیدن عطر همراه با خط زمانی تعاملی مراحل تبدیل مولکولی.',
  },
  consult_short: {
    ar: 'استشارة الخبير شاهين للتعتيق 🧙‍♂️',
    en: 'Consult Shahin AI on Aging 🧙‍♂️',
    fr: 'Consulter Shahin sur la macération 🧙‍♂️',
    es: 'Consultar a Shahin sobre maceración 🧙‍♂️',
    it: 'Chiedi a Shahin della macerazione 🧙‍♂️',
    de: 'Shahin zur Reifung befragen 🧙‍♂️',
    ru: 'Консультация Шахина по мацерации 🧙‍♂️',
    zh: '咨询沙欣大师陈化建议 🧙‍♂️',
    tr: 'Dinlendirme için Şahin’e danış 🧙‍♂️',
    fa: 'مشاوره با شاهین درباره کهنه‌سازی 🧙‍♂️',
  },
  inputs_heading: {
    ar: '1. إدخال تاريخ البدء ومدة التعتيق بالنظام',
    en: '1. Enter Start Date & Duration',
    fr: '1. Saisir la date de début et la durée',
    es: '1. Ingrese fecha de inicio y duración',
    it: '1. Inserisci data di inizio e durata',
    de: '1. Startdatum und Dauer eingeben',
    ru: '1. Введите дату начала и срок',
    zh: '1. 输入开始日期与时长',
    tr: '1. Başlangıç tarihi ve süreyi girin',
    fa: '1. وارد کردن تاریخ شروع و مدت زمان',
  },
  start_date_label: {
    ar: 'تاريخ بدء التعتيق والخلط:',
    en: 'Aging Start Date:',
    fr: 'Date de début de macération :',
    es: 'Fecha de inicio de la maceración:',
    it: 'Data di inizio macerazione:',
    de: 'Beginn der Reifung:',
    ru: 'Дата начала мацерации:',
    zh: '陈化开始日期：',
    tr: 'Dinlendirme başlangıç tarihi:',
    fa: 'تاریخ شروع کهنه‌سازی:',
  },
  quick: {
    ar: 'ضبط سريع:',
    en: 'Quick:',
    fr: 'Rapide :',
    es: 'Rápido:',
    it: 'Rapido:',
    de: 'Schnell:',
    ru: 'Быстро:',
    zh: '快速：',
    tr: 'Hızlı:',
    fa: 'تنظیم سریع:',
  },
  today: {
    ar: 'اليوم',
    en: 'Today',
    fr: 'Aujourd’hui',
    es: 'Hoy',
    it: 'Oggi',
    de: 'Heute',
    ru: 'Сегодня',
    zh: '今天',
    tr: 'Bugün',
    fa: 'امروز',
  },
  minus_7: {
    ar: 'منذ 7 أيام',
    en: '-7 Days',
    fr: '-7 jours',
    es: '-7 días',
    it: '-7 giorni',
    de: '-7 Tage',
    ru: '-7 дней',
    zh: '-7天',
    tr: '-7 gün',
    fa: '۷ روز پیش',
  },
  minus_14: {
    ar: 'منذ أسبوعين',
    en: '-14 Days',
    fr: '-14 jours',
    es: '-14 días',
    it: '-14 giorni',
    de: '-14 Tage',
    ru: '-14 дней',
    zh: '-14天',
    tr: '-14 gün',
    fa: '۱۴ روز پیش',
  },
  days_label: {
    ar: 'عدد أيام التعتيق المقررة:',
    en: 'Maceration Period (Days):',
    fr: 'Durée de macération (jours) :',
    es: 'Período de maceración (días):',
    it: 'Periodo di macerazione (giorni):',
    de: 'Reifedauer (Tage):',
    ru: 'Срок мацерации (дней):',
    zh: '陈化天数：',
    tr: 'Dinlendirme süresi (gün):',
    fa: 'مدت کهنه‌سازی (روز):',
  },
  days_unit: {
    ar: 'يوماً',
    en: 'days',
    fr: 'jours',
    es: 'días',
    it: 'giorni',
    de: 'Tage',
    ru: 'дней',
    zh: '天',
    tr: 'gün',
    fa: 'روز',
  },
  day_letter: {
    ar: 'يوم',
    en: 'd',
    fr: 'j',
    es: 'd',
    it: 'g',
    de: 'T',
    ru: 'д',
    zh: '天',
    tr: 'g',
    fa: 'روز',
  },
  presets_heading: {
    ar: '2. اختيار المعيار الموصى به حسب العائلة العطرية',
    en: '2. Recommended Period by Olfactory Family',
    fr: '2. Durée recommandée par famille olfactive',
    es: '2. Duración recomendada por familia olfativa',
    it: '2. Durata consigliata per famiglia olfattiva',
    de: '2. Empfohlene Dauer nach Duftfamilie',
    ru: '2. Рекомендуемый срок по семейству аромата',
    zh: '2. 按香调家族推荐时长',
    tr: '2. Koku ailesine göre önerilen süre',
    fa: '2. انتخاب مدت پیشنهادی بر اساس خانواده عطر',
  },
  click_to_apply: {
    ar: 'انقر لتطبيق عدد الأيام',
    en: 'Click to apply duration',
    fr: 'Cliquez pour appliquer la durée',
    es: 'Haga clic para aplicar la duración',
    it: 'Clicca per applicare la durata',
    de: 'Klicken, um die Dauer zu übernehmen',
    ru: 'Нажмите, чтобы применить срок',
    zh: '点击应用该时长',
    tr: 'Süreyi uygulamak için tıklayın',
    fa: 'برای اعمال مدت کلیک کنید',
  },
  storage_label: {
    ar: 'وعاء حفظ الزجاجة في المعمل:',
    en: 'Storage Vessel Medium:',
    fr: 'Récipient de conservation :',
    es: 'Recipiente de almacenamiento:',
    it: 'Contenitore di conservazione:',
    de: 'Aufbewahrungsgefäß:',
    ru: 'Сосуд для хранения:',
    zh: '存储容器：',
    tr: 'Saklama kabı:',
    fa: 'ظرف نگهداری بطری:',
  },
  storage_hint: {
    ar: 'يؤثر على عزل الأشعة فوق البنفسجية والأكسدة',
    en: 'Guards against UV photodegradation',
    fr: 'Protège de la photodégradation UV',
    es: 'Protege contra la fotodegradación UV',
    it: 'Protegge dalla fotodegradazione UV',
    de: 'Schützt vor UV-Photodegradation',
    ru: 'Защита от УФ-деградации',
    zh: '防紫外线光降解',
    tr: 'UV ışık bozulmasına karşı korur',
    fa: 'محافظت در برابر تخریب نوری UV',
  },
  amber_glass: {
    ar: 'زجاج عسلي (Amber)',
    en: 'Amber Glass',
    fr: 'Verre ambré',
    es: 'Vidrio ámbar',
    it: 'Vetro ambrato',
    de: 'Braunglas',
    ru: 'Тёмное стекло',
    zh: '琥珀玻璃',
    tr: 'Amber cam şişe',
    fa: 'شیشه کهربایی',
  },
  dark_chamber: {
    ar: 'خزانة مظلمة',
    en: 'Dark Chamber',
    fr: 'Armoire sombre',
    es: 'Cámara oscura',
    it: 'Camera oscura',
    de: 'Dunkle Kammer',
    ru: 'Тёмный шкаф',
    zh: '暗柜',
    tr: 'Karanlık dolap',
    fa: 'کابینت تاریک',
  },
  aluminum_flacon: {
    ar: 'ألومنيوم معتم',
    en: 'Aluminum Flacon',
    fr: 'Flacon en aluminium',
    es: 'Frasco de aluminio',
    it: 'Flacone in alluminio',
    de: 'Aluminiumflakon',
    ru: 'Алюминиевый флакон',
    zh: '铝瓶',
    tr: 'Alüminyum şişe',
    fa: 'شیشه آلومینیومی تیره',
  },
  predicted_label: {
    ar: 'تاريخ الانتهاء المتوقع لنضوج العطر',
    en: 'Predicted Maturation Date',
    fr: 'Date de maturation prévue',
    es: 'Fecha de maduración prevista',
    it: 'Data di maturazione prevista',
    de: 'Voraussichtliches Reifedatum',
    ru: 'Прогнозируемая дата созревания',
    zh: '预计熟成日期',
    tr: 'Tahmini olgunlaşma tarihi',
    fa: 'تاریخ پیش‌بینی‌شده رسیدن عطر',
  },
  matured: {
    ar: 'مكتمل النضوج ✅',
    en: 'Fully Matured ✅',
    fr: 'Maturation terminée ✅',
    es: 'Maduración completa ✅',
    it: 'Maturazione completata ✅',
    de: 'Vollständig gereift ✅',
    ru: 'Полностью созрел ✅',
    zh: '完全熟成 ✅',
    tr: 'Tamamen olgunlaştı ✅',
    fa: 'کاملاً رسیده ✅',
  },
  scheduled: {
    ar: 'مجدول مستقبلاً',
    en: 'Scheduled',
    fr: 'Planifié',
    es: 'Programado',
    it: 'Programmata',
    de: 'Geplant',
    ru: 'Запланировано',
    zh: '已排期',
    tr: 'Planlanmış',
    fa: 'زمان‌بندی‌شده',
  },
  remaining_tpl: {
    ar: 'باقي {d} يوماً',
    en: '{d}d remaining',
    fr: '{d} j restantes',
    es: 'Quedan {d}d',
    it: '{d}g rimanenti',
    de: '{d} T. verbleiben',
    ru: 'Осталось {d} дн.',
    zh: '剩余 {d} 天',
    tr: '{d} gün kaldı',
    fa: '{d} روز باقی مانده',
  },
  days_from_start_tpl: {
    ar: '{d} يوماً من تاريخ البدء',
    en: '{d} days from start',
    fr: '{d} jours depuis le début',
    es: '{d} días desde el inicio',
    it: '{d} giorni dall’inizio',
    de: '{d} Tage ab Beginn',
    ru: '{d} дней с начала',
    zh: '自开始起 {d} 天',
    tr: 'Başlangıçtan itibaren {d} gün',
    fa: '{d} روز از تاریخ شروع',
  },
  progress_label: {
    ar: 'التقدم الزمني نحو النضوج التام:',
    en: 'Maturation Progress:',
    fr: 'Progression de la maturation :',
    es: 'Progreso de maduración:',
    it: 'Progresso della maturazione:',
    de: 'Reifefortschritt:',
    ru: 'Прогресс созревания:',
    zh: '熟成进度：',
    tr: 'Olgunlaşma ilerlemesi:',
    fa: 'پیشرفت زمانی رسیدن:',
  },
  started: {
    ar: 'بدأ:',
    en: 'Started',
    fr: 'Débuté',
    es: 'Iniciado',
    it: 'Iniziato',
    de: 'Begonnen',
    ru: 'Начато',
    zh: '已开始',
    tr: 'Başladı',
    fa: 'آغاز شد',
  },
  passed_tpl: {
    ar: 'منقضي: {d} يوم',
    en: '{d}d passed',
    fr: '{d} j écoulés',
    es: '{d}d transcurridos',
    it: '{d}g trascorsi',
    de: '{d} T. vergangen',
    ru: 'Прошло: {d} дн.',
    zh: '已过 {d} 天',
    tr: '{d} gün geçti',
    fa: 'گذشته: {d} روز',
  },
  ideal_temp: {
    ar: 'الحرارة المعملية المثالية:',
    en: 'Ideal Laboratory Temp:',
    fr: 'Température idéale :',
    es: 'Temperatura ideal:',
    it: 'Temperatura ideale:',
    de: 'Ideale Labortemperatur:',
    ru: 'Идеальная температура:',
    zh: '理想实验室温度：',
    tr: 'İdeal laboratuvar sıcaklığı:',
    fa: 'دمای ایده‌آل آزمایشگاه:',
  },
  filtration_label: {
    ar: 'الفلترة المخبرية:',
    en: 'Micro-Filtration:',
    fr: 'Micro-filtration :',
    es: 'Microfiltración:',
    it: 'Micro-filtrazione:',
    de: 'Mikrofiltration:',
    ru: 'Микрофильтрация:',
    zh: '微孔过滤：',
    tr: 'Mikro filtrasyon:',
    fa: 'میکروفیلتراسیون:',
  },
  post_maceration: {
    ar: 'بعد النضوج',
    en: 'Post-Maceration',
    fr: 'Après maturation',
    es: 'Posmaduración',
    it: 'Post-macerazione',
    de: 'Nach der Reifung',
    ru: 'После мацерации',
    zh: '熟成后',
    tr: 'Dinlendirmeden sonra',
    fa: 'پس از رسیدن',
  },
  ics_button: {
    ar: 'تنبيه التقويم (.ics)',
    en: 'Add to Calendar (.ics)',
    fr: 'Ajouter au calendrier (.ics)',
    es: 'Añadir al calendario (.ics)',
    it: 'Aggiungi al calendario (.ics)',
    de: 'Zum Kalender hinzufügen (.ics)',
    ru: 'Добавить в календарь (.ics)',
    zh: '添加到日历 (.ics)',
    tr: 'Takvime ekle (.ics)',
    fa: 'افزودن به تقویم (.ics)',
  },
  copy_tag: {
    ar: 'نسخ بطاقة الزجاجة 🏷️',
    en: 'Copy Bottle Tag 🏷️',
    fr: 'Copier l’étiquette 🏷️',
    es: 'Copiar etiqueta 🏷️',
    it: 'Copia etichetta 🏷️',
    de: 'Etikett kopieren 🏷️',
    ru: 'Скопировать ярлык 🏷️',
    zh: '复制瓶标签 🏷️',
    tr: 'Şişe etiketini kopyala 🏷️',
    fa: 'کپی برچسب بطری 🏷️',
  },
  copied_tag: {
    ar: 'تم نسخ البطاقة!',
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
  shahin_rule_title: {
    ar: 'قاعدة الخبير شاهين لنضوج وتعتيق العطور:',
    en: 'Master Shahin’s Golden Maceration Rule:',
    fr: 'Règle d’or de Shahin pour la macération :',
    es: 'Regla de oro de Shahin para la maceración:',
    it: 'Regola d’oro di Shahin per la macerazione:',
    de: 'Shahins goldene Reifungsregel:',
    ru: 'Золотое правило мацерации Шахина:',
    zh: '沙欣大师陈化黄金法则：',
    tr: 'Şahin’in altın dinlendirme kuralı:',
    fa: 'قانون طلایی شاهین برای رسیدن و کهنه‌سازی عطر:',
  },
  shahin_rule_text: {
    ar: '«لا تتعجل في فتح الزجاجة قبل يوم {date}، لأن الإسترات العطرية (Ester bonds) كائن يتنفس ببطء. التعتيق الهادئ في الظلام هو ما يفصل بين العطر التجاري الرخيص والعطر النيش الفاخر ذي الفوحان الأرستقراطي.»',
    en: 'Never rush the bottle before {date}. Ester cross-linking requires patient darkness to transform raw solvent into aristocratic sillage.',
    fr: 'N’ouvrez pas le flacon avant le {date} : les liaisons estériques respirent lentement. Une macération patiente à l’obscurité sépare le parfum commercial du niche d’exception au sillage aristocratique.',
    es: 'No abras el frasco antes del {date}: los enlaces éster respiran lentamente. La maceración paciente en oscuridad separa al perfume comercial del nicho de lujo con estela aristocrática.',
    it: 'Non aprire il flacone prima del {date}: i legami esterici respirano lentamente. La paziente macerazione al buio separa il profumo commerciale dalla nicchia di lusso dallo sillage aristocratico.',
    de: 'Öffnen Sie das Flakon nicht vor dem {date}: Esterbindungen atmen langsam. Geduldige Reifung im Dunkeln trennt den kommerziellen Duft von der Luxus-Nische mit aristokratischer Sillage.',
    ru: 'Не спешите открывать флакон до {date}: эфирные связи дышат медленно. Терпеливое вызревание в темноте отличает коммерческий парфюм от нишевого с аристократическим шлейфом.',
    zh: '在 {date} 之前切勿急于开瓶——酯键如同缓慢呼吸的生命。黑暗中的静置陈化，正是廉价商业香与贵族气息小众香的分界线。',
    tr: 'Şişeyi {date} tarihinden önce açmayın: ester bağları yavaşça nefes alır. Karanlıkta sabırla dinlenmek, ticari parfümü aristokrat sisli niş parfümden ayırır.',
    fa: '«شیشه را قبل از {date} باز نکنید؛ پیوندهای استری موجودی هستند که آهسته نفس می‌کشند. کهنه‌سازی آرام در تاریکی همان چیزی است که عطر تجاری ارزان را از عطر نیش فاخر با پخش بوی اشرافی جدا می‌کند.»',
  },
  timeline_heading: {
    ar: 'مراحل التحول الكيميائي على مدار أيام التعتيق (ماذا يحدث داخل الزجاجة؟):',
    en: 'Molecular Transformation Timeline Stages:',
    fr: 'Étapes de transformation moléculaire :',
    es: 'Etapas de transformación molecular:',
    it: 'Fasi di trasformazione molecolare:',
    de: 'Phasen der molekularen Umwandlung:',
    ru: 'Этапы молекулярных превращений:',
    zh: '分子转变时间轴阶段：',
    tr: 'Moleküler dönüşüm aşamaları:',
    fa: 'مراحل تبدیل شیمیایی در طول روزهای کهنه‌سازی (داخل شیشه چه می‌گذرد؟):',
  },
  days_breakdown_tpl: {
    ar: '{d} يوماً مقسمة علمياً',
    en: '{d} days scientific breakdown',
    fr: '{d} jours de répartition scientifique',
    es: '{d} días de desglose científico',
    it: '{d} giorni di scomposizione scientifica',
    de: '{d} Tage wissenschaftliche Aufschlüsselung',
    ru: '{d} дней научной разбивки',
    zh: '{d} 天科学分解',
    tr: '{d} gün bilimsel dağılım',
    fa: '{d} روز تقسیم‌بندی علمی',
  },
  stage1_title: {
    ar: 'تلاشي لسعة الكحول',
    en: 'Ethanol Flash-Off',
    fr: 'Dissipation de l’âpreté alcoolique',
    es: 'Disipación del ardor alcohólico',
    it: 'Dissipazione dell’asprezza alcolica',
    de: 'Abklingen der Alkoholschärfe',
    ru: 'Затухание резкости спирта',
    zh: '乙醇刺激感消退',
    tr: 'Alkol sertliğinin kaybolması',
    fa: 'محو شدن تندی الکل',
  },
  stage1_desc: {
    ar: 'تهدأ الجزيئات النفاذة في الإيثانول الطبي، وتبدأ المذيبات في الإحاطة بمركبات الزيت الخفيف دون تصادم.',
    en: 'Harsh alcohol molecules settle; solvents gently envelope the lighter odorant terpenes.',
    fr: 'Les molécules agressives de l’éthanol s’apaisent ; les solvants enveloppent délicatement les terpènes volatils.',
    es: 'Las moléculas agresivas del etanol se calman; los solventes envuelven suavemente los terpenos volátiles.',
    it: 'Le molecole aggressive dell’etanolo si placano; i solventi avvolgono delicatamente i terpeni volatili.',
    de: 'Aggressive Ethanolmoleküle beruhigen sich; Lösungsmittel hüllen die leichteren Terpene sanft ein.',
    ru: 'Агрессивные молекулы этанола успокаиваются; растворители мягко обволакивают лёгкие терпены.',
    zh: '乙醇的刺激性分子逐渐安定，溶剂温柔包裹较轻的萜烯香气分子。',
    tr: 'Etanolün agresif molekülleri sakinleşir; çözücüler hafif terpenleri yumuşakça sarar.',
    fa: 'مولکول‌های تند اتانول آرام می‌گیرند؛ حلال‌ها به‌آرامی ترپن‌های سبک را در بر می‌گیرند.',
  },
  stage2_title: {
    ar: 'التشابك الإستيري',
    en: 'Esterification',
    fr: 'Estérification',
    es: 'Esterificación',
    it: 'Esterificazione',
    de: 'Veresterung',
    ru: 'Этерификация',
    zh: '酯化反应',
    tr: 'Esterifikasyon',
    fa: 'استری شدن',
  },
  stage2_desc: {
    ar: 'تتفاعل الأحماض مع الكحول منتجة إسترات تمنح العطر طابعاً مخملياً فاخراً وتبرز باقة قلب العطر الزهرية.',
    en: 'Organic acids bind with ethanol, producing aromatic esters that soften and enrich the floral heart.',
    fr: 'Les acides organiques se lient à l’éthanol, produisant des esters aromatiques qui adoucissent le cœur floral.',
    es: 'Los ácidos orgánicos se unen al etanol produciendo ésteres aromáticos que suavizan el corazón floral.',
    it: 'Gli acidi organici si legano all’etanolo producendo esteri aromatici che ammorbidiscono il cuore floreale.',
    de: 'Organische Säuren verbinden sich mit Ethanol und bilden aromatische Ester, die das florale Herz mildern.',
    ru: 'Органические кислоты связываются с этанолом, образуя ароматные эфиры, смягчающие цветочное сердце.',
    zh: '有机酸与乙醇结合生成芳香酯，柔化并丰盈花香核心。',
    tr: 'Organik asitler etanolle birleşerek çiçeksel kalbi yumuşatan aromatik esterler üretir.',
    fa: 'اسیدهای آلی با اتانول پیوند می‌خورند و استرهای معطری می‌سازند که قلب گلی عطر را نرم و غنی می‌کنند.',
  },
  stage3_title: {
    ar: 'تثبيت القاعدة والعمق',
    en: 'Fixation & Depth',
    fr: 'Fixation et profondeur',
    es: 'Fijación y profundidad',
    it: 'Fissazione e profondità',
    de: 'Fixierung & Tiefe',
    ru: 'Фиксация и глубина',
    zh: '定香与深度',
    tr: 'Sabitleşme ve derinlik',
    fa: 'تثبیت قاعده و عمق',
  },
  stage3_desc: {
    ar: 'تندمج المثبتات (Ambroxan / Iso E) مع الأخشاب والراتنجات، مما يرفع ثبات العطر إلى أقصى طاقته التصميمية.',
    en: 'Fixatives lock into woods and resins, maximizing tenacity and the sillage envelope.',
    fr: 'Les fixateurs se verrouillent dans les bois et résines, maximisant la tenue et le halo de sillage.',
    es: 'Los fijadores se anclan en maderas y resinas, maximizando la fijación y el halo de estela.',
    it: 'I fissativi si agganciano a legni e resine, massimizzando persistenza e alone di scia.',
    de: 'Fixateure verankern sich in Hölzern und Harzen und maximieren Haltbarkeit und Sillage-Hülle.',
    ru: 'Фиксаторы закрепляются в древесных и смолистых нотах, максимально усиливая стойкость и шлейф.',
    zh: '定香剂与木质、树脂深度结合，将留香与气场推向设计极限。',
    tr: 'Fiksatörler odunlara ve reçinelere kilitlenerek kalıcılığı ve sillage zarfını en üst düzeye çıkarır.',
    fa: 'تثبیت‌کننده‌ها با چوب‌ها و رزین‌ها پیوند می‌خورند و ماندگاری و هاله پخش بو را به بیشترین حد طراحی می‌رسانند.',
  },
  stage4_title: {
    ar: 'النضوج التام والفلترة',
    en: 'Full Maturation',
    fr: 'Maturation complète',
    es: 'Maduración completa',
    it: 'Maturazione completa',
    de: 'Vollständige Reifung',
    ru: 'Полное созревание',
    zh: '完全熟成',
    tr: 'Tam olgunlaşma',
    fa: 'رسیدن کامل',
  },
  stage4_desc: {
    ar: 'اكتمال التفاعل الكيميائي. جاهز للتبريد المخبري (Chilling) والفلترة النهائية لصفاء بلوري نقي وتعبئة الزجاجات.',
    en: 'Reaction completed. Ready for chilling, micro-filtration, and luxury bottling.',
    fr: 'Réaction achevée. Prêt pour le refroidissement, la micro-filtration et l’embouteillage de luxe.',
    es: 'Reacción completada. Listo para enfriamiento, microfiltración y embotellado de lujo.',
    it: 'Reazione completata. Pronto per il raffreddamento, la micro-filtrazione e l’imbottigliamento di lusso.',
    de: 'Reaktion abgeschlossen. Bereit für Abkühlung, Mikrofiltration und Luxus-Abfüllung.',
    ru: 'Реакция завершена. Готов к охлаждению, микрофильтрации и роскошному розливу.',
    zh: '化学反应完成，可进行冷冻、微孔过滤与精品灌装。',
    tr: 'Reaksiyon tamamlandı. Soğutma, mikro filtrasyon ve lüks dolum için hazır.',
    fa: 'واکنش شیمیایی کامل شد. آماده سرمایش آزمایشگاهی، میکروفیلتراسیون نهایی و پرکردن بطری‌ها.',
  },
  final_day_tpl: {
    ar: 'اليوم {d} 🎯',
    en: 'Day {d} 🎯',
    fr: 'Jour {d} 🎯',
    es: 'Día {d} 🎯',
    it: 'Giorno {d} 🎯',
    de: 'Tag {d} 🎯',
    ru: 'День {d} 🎯',
    zh: '第 {d} 天 🎯',
    tr: '{d}. gün 🎯',
    fa: 'روز {d} 🎯',
  },
  advisory_title: {
    ar: 'استشارات الخبير شاهين المعملية حول نضوج هذه التشغيلة',
    en: 'Master Shahin’s Expert Maturation Advisory',
    fr: 'Conseil expert de Shahin sur la maturation',
    es: 'Asesoría experta de Shahin sobre maduración',
    it: 'Consulenza esperta di Shahin sulla maturazione',
    de: 'Shahins Expertenberatung zur Reifung',
    ru: 'Экспертная консультация Шахина по созреванию',
    zh: '沙欣大师熟成专家顾问',
    tr: 'Şahin’in uzman olgunlaşma danışmanlığı',
    fa: 'مشاوره تخصصی شاهین درباره رسیدن این پارت',
  },
  live_shahin: {
    ar: 'مباشر مع شاهين AI',
    en: 'Live Shahin AI',
    fr: 'Shahin IA en direct',
    es: 'Shahin IA en vivo',
    it: 'Shahin AI in diretta',
    de: 'Live Shahin KI',
    ru: 'Шахин ИИ в прямом эфире',
    zh: '沙欣 AI 直连',
    tr: 'Canlı Şahin AI',
    fa: 'شاهین AI زنده',
  },
  advisory_summary_tpl: {
    ar: 'التشغيلة: {batch} · مدة التعتيق: {days} يوماً · تاريخ النضوج المتوقع: {date}',
    en: 'Batch: {batch} · Period: {days} days · Forecast: {date}',
    fr: 'Lot : {batch} · Durée : {days} jours · Prévision : {date}',
    es: 'Lote: {batch} · Duración: {days} días · Previsión: {date}',
    it: 'Lotto: {batch} · Durata: {days} giorni · Previsione: {date}',
    de: 'Charge: {batch} · Dauer: {days} Tage · Prognose: {date}',
    ru: 'Партия: {batch} · Срок: {days} дн. · Прогноз: {date}',
    zh: '批次：{batch} · 时长：{days} 天 · 预计：{date}',
    tr: 'Parti: {batch} · Süre: {days} gün · Tahmin: {date}',
    fa: 'پارت: {batch} · مدت: {days} روز · پیش‌بینی: {date}',
  },
  full_consultation: {
    ar: 'استشارة شاملة مع الخبير شاهين 🧙‍♂️',
    en: 'Full Shahin Consultation 🧙‍♂️',
    fr: 'Consultation complète avec Shahin 🧙‍♂️',
    es: 'Consulta completa con Shahin 🧙‍♂️',
    it: 'Consulenza completa con Shahin 🧙‍♂️',
    de: 'Vollständige Shahin-Beratung 🧙‍♂️',
    ru: 'Полная консультация Шахина 🧙‍♂️',
    zh: '沙欣全面咨询 🧙‍♂️',
    tr: 'Şahin ile tam danışma 🧙‍♂️',
    fa: 'مشاوره کامل با شاهین 🧙‍♂️',
  },
  quick_pick: {
    ar: 'اختر سؤالاً سريعاً لإرساله فوراً إلى شيخ العطارين شاهين:',
    en: 'Click to ask Master Shahin instantly:',
    fr: 'Choisissez une question rapide pour Maître Shahin :',
    es: 'Elija una pregunta rápida para el Maestro Shahin:',
    it: 'Scegli una domanda rapida per il Maestro Shahin:',
    de: 'Wählen Sie eine Schnellfrage für Meister Shahin:',
    ru: 'Выберите быстрый вопрос мастеру Шахину:',
    zh: '点击即刻向沙欣大师提问：',
    tr: 'Usta Şahin’e hızlı soru seçin:',
    fa: 'یک سؤال سریع برای استاد عطرسازها شاهین انتخاب کنید:',
  },
  chip1_tpl: {
    ar: 'هل تكفي مدة {d} يوماً لهذا النمط؟',
    en: 'Is {d}d optimal for this style?',
    fr: '{d} j suffisent-ils pour ce style ?',
    es: '¿Son óptimos {d} días para este estilo?',
    it: '{d}g sono ottimali per questo stile?',
    de: 'Sind {d} Tage optimal für diesen Stil?',
    ru: 'Оптимально ли {d} дн. для этого стиля?',
    zh: '{d} 天适合这种风格吗？',
    tr: 'Bu stil için {d} gün ideal mi?',
    fa: 'آیا {d} روز برای این سبک کافی است؟',
  },
  chip2: {
    ar: 'كيف أطبق التعتيق البارد (4°C) والفلترة؟',
    en: 'Cold Maceration (4°C) & Filtration',
    fr: 'Macération à froid (4 °C) et filtration',
    es: 'Maceración en frío (4 °C) y filtración',
    it: 'Macerazione a freddo (4 °C) e filtrazione',
    de: 'Kaltmazeration (4 °C) & Filtration',
    ru: 'Холодная мацерация (4 °C) и фильтрация',
    zh: '冷陈化（4°C）与过滤',
    tr: 'Soğuk dinlendirme (4°C) ve filtrasyon',
    fa: 'کهنه‌سازی سرد (۴°C) و فیلتراسیون',
  },
  chip3: {
    ar: 'حماية النوتات العليا ومثبتات الفوحان',
    en: 'Top notes protection & fixatives',
    fr: 'Protection des notes de tête et fixateurs',
    es: 'Protección de notas de salida y fijadores',
    it: 'Protezione note di testa e fissativi',
    de: 'Schutz der Kopfnoten & Fixateure',
    ru: 'Защита верхних нот и фиксаторы',
    zh: '前调保护与定香剂',
    tr: 'Üst nota koruması ve fiksatörler',
    fa: 'محافظت از نت‌های ابتدایی و تثبیت‌کننده‌ها',
  },
  related_tools: {
    ar: 'أدوات معملية مرتبطة بنضوج العطر:',
    en: 'Related laboratory tools:',
    fr: 'Outils de laboratoire associés :',
    es: 'Herramientas de laboratorio relacionadas:',
    it: 'Strumenti di laboratorio correlati:',
    de: 'Verwandte Laborwerkzeuge:',
    ru: 'Связанные лабораторные инструменты:',
    zh: '相关实验室工具：',
    tr: 'İlgili laboratuvar araçları:',
    fa: 'ابزارهای آزمایشگاهی مرتبط با رسیدن عطر:',
  },
  back_to_calc: {
    ar: 'العودة لحاسبة التركيب',
    en: 'Concentration Lab',
    fr: 'Retour au laboratoire',
    es: 'Volver al laboratorio',
    it: 'Torna al laboratorio',
    de: 'Zurück zum Labor',
    ru: 'Вернуться в лабораторию',
    zh: '返回浓度实验室',
    tr: 'Konsantrasyon laboratuvarı',
    fa: 'بازگشت به آزمایشگاه غلظت',
  },
  guide_btn: {
    ar: 'دليل المثبتات والتعتيق',
    en: 'Fixatives & Aging Guide',
    fr: 'Guide des fixateurs et macération',
    es: 'Guía de fijadores y maceración',
    it: 'Guida fissativi e macerazione',
    de: 'Leitfaden Fixateure & Reifung',
    ru: 'Справочник фиксаторов и мацерации',
    zh: '定香与陈化指南',
    tr: 'Fiksatör ve dinlendirme rehberi',
    fa: 'راهنمای تثبیت‌کننده‌ها و کهنه‌سازی',
  },
  ai_lab_btn: {
    ar: 'معمل الخبير شاهين AI',
    en: 'Shahin AI Master Lab',
    fr: 'Laboratoire Shahin IA',
    es: 'Laboratorio Shahin IA',
    it: 'Laboratorio Shahin AI',
    de: 'Shahin KI-Meisterlabor',
    ru: 'Лаборатория Шахина ИИ',
    zh: '沙欣 AI 大师实验室',
    tr: 'Şahin AI Usta Laboratuvarı',
    fa: 'آزمایشگاه استاد شاهین AI',
  },
  default_formula_title: {
    ar: 'توليفة المعمل الملكية',
    en: 'Royal Laboratory Blend',
    fr: 'Composition royale du laboratoire',
    es: 'Mezcla real de laboratorio',
    it: 'Composizione reale di laboratorio',
    de: 'Königliche Labor-Komposition',
    ru: 'Королевская лабораторная композиция',
    zh: '皇家实验室配方',
    tr: 'Kraliyet laboratuvar harmanı',
    fa: 'ترکیب سلطنتی آزمایشگاه',
  },
  ics_title_tpl: {
    ar: 'اكتمال نضوج العطر: {f}',
    en: 'Perfume Maturation Complete: {f}',
    fr: 'Maturation du parfum terminée : {f}',
    es: 'Maduración del perfume completada: {f}',
    it: 'Maturazione del profumo completata: {f}',
    de: 'Parfüm-Reifung abgeschlossen: {f}',
    ru: 'Созревание парфюма завершено: {f}',
    zh: '香水熟成完成：{f}',
    tr: 'Parfüm olgunlaşması tamamlandı: {f}',
    fa: 'رسیدن عطر کامل شد: {f}',
  },
  ics_desc_tpl: {
    ar: 'انتهت فترة التعتيق المقررة ({d} يوماً). العطر جاهز الآن للفلترة النهائية المخبرية واختبار الثبات والفوحان الفعلي.',
    en: 'Maceration period ({d} days) completed! Ready for final filtration and sillage assessment.',
    fr: 'La période de macération ({d} jours) est terminée ! Prêt pour la filtration finale et l’évaluation du sillage.',
    es: '¡El período de maceración ({d} días) ha terminado! Listo para la filtración final y evaluación.',
    it: 'Il periodo di macerazione ({d} giorni) è terminato! Pronto per la filtrazione finale e la valutazione.',
    de: 'Mazerationszeit ({d} Tage) abgeschlossen! Bereit für Endfiltration und Sillage-Bewertung.',
    ru: 'Период мацерации ({d} дн.) завершён! Готов к финальной фильтрации и оценке шлейфа.',
    zh: '陈化期（{d} 天）已结束！可进行最终过滤与留香测试。',
    tr: 'Dinlendirme süresi ({d} gün) tamamlandı! Son filtrasyon ve sillage değerlendirmesine hazır.',
    fa: 'مدت کهنه‌سازی ({d} روز) به پایان رسید! آماده فیلتراسیون نهایی و ارزیابی ماندگاری و پخش بو.',
  },
  ics_filename: {
    ar: 'تذكير_نضوج',
    en: 'maturation-reminder',
    fr: 'rappel-maturation',
    es: 'recordatorio-maduracion',
    it: 'promemoria-maturazione',
    de: 'reifung-erinnerung',
    ru: 'напоминание-созревание',
    zh: '熟成提醒',
    tr: 'olgunlasma-hatirlatici',
    fa: 'یادآوری-رسیدن',
  },
  tag_header: {
    ar: 'بطاقة تعتيق زجاجة المعمل · منصة صمم عطرك مع شام',
    en: 'Lab Bottle Maceration Tag · Sham Perfume Platform',
    fr: 'Étiquette de macération · Plateforme Sham',
    es: 'Etiqueta de maceración · Plataforma Sham',
    it: 'Etichetta di macerazione · Piattaforma Sham',
    de: 'Mazerationsetikett · Sham-Plattform',
    ru: 'Ярлык мацерации · Платформа Sham',
    zh: '实验室陈化瓶标 · Sham 平台',
    tr: 'Şişe dinlendirme etiketi · Sham Platformu',
    fa: 'برچسب کهنه‌سازی بطری · پلتفرم شام',
  },
  tag_formula: {
    ar: 'اسم التركيبة',
    en: 'Formula Name',
    fr: 'Nom de la formule',
    es: 'Nombre de la fórmula',
    it: 'Nome della formula',
    de: 'Formelname',
    ru: 'Название формулы',
    zh: '配方名称',
    tr: 'Formül adı',
    fa: 'نام ترکیب',
  },
  tag_batch: {
    ar: 'كود التشغيلة',
    en: 'Batch Code',
    fr: 'Code de lot',
    es: 'Código de lote',
    it: 'Codice lotto',
    de: 'Chargennummer',
    ru: 'Код партии',
    zh: '批次代码',
    tr: 'Parti kodu',
    fa: 'کد پارت',
  },
  tag_duration: {
    ar: 'مدة التعتيق المقررة',
    en: 'Planned Maceration Duration',
    fr: 'Durée de macération prévue',
    es: 'Duración de maceración prevista',
    it: 'Durata di macerazione prevista',
    de: 'Geplante Reifedauer',
    ru: 'Планируемый срок мацерации',
    zh: '计划陈化时长',
    tr: 'Planlanan dinlendirme süresi',
    fa: 'مدت کهنه‌سازی برنامه‌ریزی‌شده',
  },
  tag_start: {
    ar: 'تاريخ بدء الخلط والتعتيق',
    en: 'Blending & Aging Start Date',
    fr: 'Date de début du mélange et de la macération',
    es: 'Fecha de inicio de mezcla y maceración',
    it: 'Data di inizio miscelazione e macerazione',
    de: 'Beginn von Mischung und Reifung',
    ru: 'Дата начала смешивания и мацерации',
    zh: '调配与陈化开始日期',
    tr: 'Karım ve dinlendirme başlangıç tarihi',
    fa: 'تاریخ شروع ترکیب و کهنه‌سازی',
  },
  tag_end: {
    ar: 'تاريخ الانتهاء والنضوج التام',
    en: 'Completion & Full Maturation Date',
    fr: 'Date d’achèvement et de maturation complète',
    es: 'Fecha de finalización y maduración completa',
    it: 'Data di completamento e maturazione completa',
    de: 'Abschluss- und Vollreifungsdatum',
    ru: 'Дата завершения и полного созревания',
    zh: '完成与完全熟成日期',
    tr: 'Tamamlanma ve tam olgunlaşma tarihi',
    fa: 'تاریخ پایان و رسیدن کامل',
  },
  tag_temp: {
    ar: 'درجة الحرارة المثالية',
    en: 'Ideal Temperature',
    fr: 'Température idéale',
    es: 'Temperatura ideal',
    it: 'Temperatura ideale',
    de: 'Ideale Temperatur',
    ru: 'Идеальная температура',
    zh: '理想温度',
    tr: 'İdeal sıcaklık',
    fa: 'دمای ایده‌آل',
  },
  tag_vessel: {
    ar: 'وعاء الحفظ',
    en: 'Storage Vessel',
    fr: 'Récipient de conservation',
    es: 'Recipiente de almacenamiento',
    it: 'Contenitore di conservazione',
    de: 'Aufbewahrungsgefäß',
    ru: 'Сосуд хранения',
    zh: '存储容器',
    tr: 'Saklama kabı',
    fa: 'ظرف نگهداری',
  },
  tag_status_done: {
    ar: 'مكتمل 100% وجاهز للفلترة والاستخدام',
    en: '100% complete — ready to filter & wear',
    fr: 'Terminée à 100 % — prête à filtrer et à porter',
    es: '100 % completada — lista para filtrar y usar',
    it: 'Completata al 100% — pronta da filtrare e indossare',
    de: '100 % abgeschlossen — filtrier- und tragefertig',
    ru: 'Завершено на 100% — готово к фильтрации и использованию',
    zh: '100% 完成——可过滤使用',
    tr: '%100 tamamlandı — filtrelenebilir ve kullanılabilir',
    fa: '۱۰۰٪ کامل — آماده فیلتر و استفاده',
  },
  tag_status_progress_tpl: {
    ar: 'قيد التعتيق (باقي {d} يوماً)',
    en: 'Aging in progress ({d} days left)',
    fr: 'Macération en cours ({d} jours restants)',
    es: 'En maceración (quedan {d} días)',
    it: 'In maturazione ({d} giorni rimanenti)',
    de: 'Reifung läuft ({d} Tage verbleiben)',
    ru: 'Мацерация идёт (осталось {d} дн.)',
    zh: '陈化中（剩余 {d} 天）',
    tr: 'Dinlendirmede ({d} gün kaldı)',
    fa: 'در حال کهنه‌سازی ({d} روز باقی مانده)',
  },
  consult_prompt_tpl: {
    ar: 'أيها الخبير شاهين، أقوم حالياً بتعتيق تركيبة «{f}» برقم تشغيلة «{b}».\nتاريخ بدء التعتيق: {s}\nعدد الأيام المقررة للنضوج: {d} يوماً\nتاريخ الانتهاء المتوقع لنضوج العطر: {e}\nهل تناسب هذه المدة العائلة العطرية؟ وما هي نصيحتك لتسريع النضوج الكيميائي ومنع تعكر العطر أو أكسدة النوتات العليا؟',
    en: 'Dear Master Shahin, I am currently macerating formula "{f}" (batch {b}).\nAging start date: {s}\nPlanned maturation days: {d}\nExpected completion date: {e}\nIs this duration suitable for the olfactory family? What is your advice to accelerate maturation and prevent cloudiness or oxidation of top notes?',
    fr: 'Cher Maître Shahin, je fais actuellement macérer la formule « {f} » (lot {b}).\nDébut de macération : {s}\nDurée prévue : {d} jours\nDate d’achèvement prévue : {e}\nCette durée convient-elle à la famille olfactive ? Que conseillez-vous pour accélérer la maturation et éviter le trouble ou l’oxydation des notes de tête ?',
    es: 'Querido Maestro Shahin, actualmente estoy macerando la fórmula «{f}» (lote {b}).\nInicio de maceración: {s}\nDías previstos: {d}\nFecha de finalización prevista: {e}\n¿Es esta duración adecuada para la familia olfativa? ¿Qué aconseja para acelerar la maduración y evitar turbidez u oxidación de las notas de salida?',
    it: 'Caro Maestro Shahin, sto macerando la formula "{f}" (lotto {b}).\nInizio macerazione: {s}\nGiorni previsti: {d}\nData di completamento prevista: {e}\nQuesta durata è adatta alla famiglia olfattiva? Come accelerare la maturazione ed evitare torbidità o ossidazione delle note di testa?',
    de: 'Lieber Meister Shahin, ich lasse derzeit die Formel „{f}“ reifen (Charge {b}).\nReifungsbeginn: {s}\nGeplante Tage: {d}\nErwartetes Abschlussdatum: {e}\nIst diese Dauer für die Duftfamilie geeignet? Wie beschleunige ich die Reifung und verhindere Trübung oder Oxidation der Kopfnoten?',
    ru: 'Уважаемый мастер Шахин, я выдерживаю формулу «{f}» (партия {b}).\nДата начала: {s}\nПланируемых дней: {d}\nОжидаемая дата завершения: {e}\nПодходит ли этот срок для данного семейства аромата? Как ускорить созревание и предотвратить помутнение или окисление верхних нот?',
    zh: '尊敬的沙欣大师，我正在陈化配方「{f}」（批次 {b}）。\n陈化开始日期：{s}\n计划天数：{d}\n预计完成日期：{e}\n这个时长适合该香调家族吗？如何加速熟成并防止浑浊或前调氧化？',
    tr: 'Değerli Usta Şahin, "{f}" formülünü (parti {b}) dinlendiriyorum.\nBaşlangıç tarihi: {s}\nPlanlanan gün: {d}\nTahmini tamamlanma: {e}\nBu süre koku ailesi için uygun mu? Olgunlaşmayı hızlatmak ve bulanıklığı veya üst notaların oksidasyonunu önlemek için ne önerirsiniz?',
    fa: 'استاد گرامی شاهین، در حال کهنه‌سازی ترکیب «{f}» با کد پارت «{b}» هستم.\nتاریخ شروع: {s}\nروزهای برنامه‌ریزی‌شده: {d}\nتاریخ پیش‌بینی‌شده پایان: {e}\nآیا این مدت برای خانواده عطر مناسب است؟ برای تسریع رسیدن و جلوگیری از کدورت یا اکسیدشدن نت‌های ابتدایی چه توصیه‌ای دارید؟',
  },
  chip1_q_tpl: {
    ar: 'أيها الخبير شاهين، هل تناسب مدة الـ {d} يوماً المقررة لتعتيق «{f}» نوع العطر؟ وما نصيحتك لثبات أعلى؟',
    en: 'Master Shahin, is the planned {d}-day maceration for "{f}" suited to this perfume style? Any tips for greater longevity?',
    fr: 'Maître Shahin, la macération de {d} jours prévue pour « {f} » convient-elle à ce style ? Conseils pour une meilleure tenue ?',
    es: 'Maestro Shahin, ¿los {d} días previstos para «{f}» son adecuados para este estilo? ¿Consejos para mayor fijación?',
    it: 'Maestro Shahin, i {d} giorni previsti per "{f}" sono adatti a questo stile? Consigli per maggiore persistenza?',
    de: 'Meister Shahin, sind die geplanten {d} Tage für „{f}“ passend? Tipps für mehr Haltbarkeit?',
    ru: 'Мастер Шахин, подходит ли планируемых {d} дней для «{f}»? Советы для большей стойкости?',
    zh: '沙欣大师，「{f}」计划陈化 {d} 天是否合适？有何提升留香的建议？',
    tr: 'Usta Şahin, "{f}" için planlanan {d} gün uygun mu? Daha kalıcı olması için öneriniz var mı?',
    fa: 'استاد شاهین، آیا {d} روز برنامه‌ریزی‌شده برای کهنه‌سازی «{f}» مناسب است؟ برای ماندگاری بیشتر چه پیشنهادی دارید؟',
  },
  chip2_q: {
    ar: 'أيها الخبير شاهين، كيف أقوم بخطوة التعتيق البارد (Cold Maceration 4°C) والفلترة بالورق الصيدلاني لمنع تعكر العطر تماماً؟',
    en: 'Master Shahin, how do I perform cold maceration (4°C) and pharmaceutical paper filtration to completely prevent perfume cloudiness?',
    fr: 'Maître Shahin, comment réaliser la macération à froid (4 °C) et la filtration sur papier pharmaceutique pour éviter tout trouble ?',
    es: 'Maestro Shahin, ¿cómo realizo la maceración en frío (4 °C) y la filtración con papel farmacéutico para evitar la turbidez?',
    it: 'Maestro Shahin, come eseguo la macerazione a freddo (4 °C) e la filtrazione con carta farmaceutica per evitare torbidità?',
    de: 'Meister Shahin, wie führe ich Kaltmazeration (4 °C) und Filtration mit pharmazeutischem Papier durch, um Trübung zu verhindern?',
    ru: 'Мастер Шахин, как провести холодную мацерацию (4 °C) и фильтрацию фармацевтической бумагой, чтобы полностью избежать помутнения?',
    zh: '沙欣大师，如何进行冷陈化（4°C）与药用滤纸过滤，彻底避免香水浑浊？',
    tr: 'Usta Şahin, soğuk dinlendirmeyi (4°C) ve eczacılık kâğıdıyla filtrasyonu bulanıklığı tamamen önlemek için nasıl yapmalıyım?',
    fa: 'استاد شاهین، کهنه‌سازی سرد (۴ درجه) و فیلتراسیون با کاغذ دارویی را برای جلوگیری کامل از کدورت عطر چگونه انجام دهم؟',
  },
  chip3_q_tpl: {
    ar: 'أيها الخبير شاهين، ما أفضل مثبت عطري كيميائي أو طبيعي لتركيبة «{f}» يحافظ على النوتات العليا أثناء التعتيق؟',
    en: 'Master Shahin, what is the best natural or aromachemical fixative for "{f}" that preserves top notes during maceration?',
    fr: 'Maître Shahin, quel est le meilleur fixateur naturel ou synthétique pour « {f} » préservant les notes de tête pendant la macération ?',
    es: 'Maestro Shahin, ¿cuál es el mejor fijador natural o sintético para «{f}» que preserve las notas de salida durante la maceración?',
    it: 'Maestro Shahin, qual è il miglior fissativo naturale o sintetico per "{f}" che preservi le note di testa durante la macerazione?',
    de: 'Meister Shahin, welches ist der beste natürliche oder synthetische Fixateur für „{f}“, der die Kopfnoten während der Reifung bewahrt?',
    ru: 'Мастер Шахин, какой фиксатор (натуральный или ароматический) лучше всего подходит для «{f}» и сохраняет верхние ноты при мацерации?',
    zh: '沙欣大师，「{f}」在陈化期间保持前调的最佳天然或合成定香剂是什么？',
    tr: 'Usta Şahin, "{f}" için dinlendirme sırasında üst notaları koruyan en iyi doğal veya sentetik fiksatör nedir?',
    fa: 'استاد شاهین، بهترین تثبیت‌کننده طبیعی یا شیمیایی برای ترکیب «{f}» که نت‌های ابتدایی را در طول کهنه‌سازی حفظ کند چیست؟',
  },
} satisfies Record<string, LText>;

export const MacerationTimeSimulator: React.FC<MacerationTimeSimulatorProps> = ({
  currentLang = 'ar',
  initialStartDate,
  initialMacerationDays = 30,
  formulaTitle,
  batchCode = 'BATCH-SHAM-2026',
  onOpenConsultation,
  onMacerationDaysChange,
  onStartDateChange,
  onNavigateToTab,
}) => {
  const rtl = isRTL(currentLang);
  const L = makeT(currentLang, S);
  const resolvedFormulaTitle = formulaTitle || L('default_formula_title');

  // Today's ISO date string
  const todayIso = useMemo(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }, []);

  // State
  const [startDate, setStartDate] = useState<string>(initialStartDate || todayIso);
  const [macerationDays, setMacerationDays] = useState<number>(initialMacerationDays);
  const [activePresetId, setActivePresetId] = useState<string>('floral_fruity');
  const [storageType, setStorageType] = useState<'amber_glass' | 'dark_cupboard' | 'aluminum_flacon'>('amber_glass');
  const [isCopiedTag, setIsCopiedTag] = useState(false);

  // Sync internal state if props change from outside
  useEffect(() => {
    if (initialMacerationDays && initialMacerationDays !== macerationDays) {
      setMacerationDays(initialMacerationDays);
    }
  }, [initialMacerationDays]);

  useEffect(() => {
    if (initialStartDate && initialStartDate !== startDate) {
      setStartDate(initialStartDate);
    }
  }, [initialStartDate]);

  const updateDays = (days: number) => {
    const safeDays = Math.max(1, Math.min(365, days));
    setMacerationDays(safeDays);
    onMacerationDaysChange?.(safeDays);
  };

  const updateStartDate = (d: string) => {
    setStartDate(d);
    onStartDateChange?.(d);
  };

  // Calculations
  const calculation = useMemo(() => {
    const start = new Date(startDate);
    const startValid = !isNaN(start.getTime());
    const safeStart = startValid ? start : new Date();

    const days = Math.max(1, Math.min(365, macerationDays || 30));

    // End date = Start Date + (days * 24 * 60 * 60 * 1000)
    const end = new Date(safeStart.getTime() + days * 24 * 60 * 60 * 1000);
    const today = new Date();

    // Reset hours for clean day math
    const startDay = new Date(safeStart.getFullYear(), safeStart.getMonth(), safeStart.getDate()).getTime();
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
    const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

    const totalDurationMs = endDay - startDay;
    const elapsedMs = Math.max(0, todayDay - startDay);
    const remainingMs = Math.max(0, endDay - todayDay);

    const elapsedDays = Math.min(days, Math.floor(elapsedMs / (1000 * 60 * 60 * 24)));
    const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

    const progressPercent = Math.min(100, Math.max(0, Math.round((elapsedDays / days) * 100)));

    const isFinished = todayDay >= endDay;
    const isFutureStart = todayDay < startDay;

    // Date formatted in the visitor's language locale
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };

    return {
      startDateFormatted: localeDate(currentLang, safeStart, options),
      endDateFormatted: localeDate(currentLang, end, options),
      endDateIso: end.toISOString().split('T')[0],
      totalDays: days,
      elapsedDays,
      remainingDays,
      progressPercent,
      isFinished,
      isFutureStart,
    };
  }, [startDate, macerationDays, currentLang]);

  const storageTypeLabel = (): string => {
    if (storageType === 'amber_glass') return L('amber_glass');
    if (storageType === 'dark_cupboard') return L('dark_chamber');
    return L('aluminum_flacon');
  };

  const handleApplyPreset = (preset: MacerationPreset) => {
    setActivePresetId(preset.id);
    updateDays(preset.days);
  };

  const handleSetQuickDate = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    updateStartDate(d.toISOString().split('T')[0]);
  };

  // Download iCal (.ics) file so user gets notification on completion date
  const handleDownloadCalendarEvent = () => {
    const title = fmt(L('ics_title_tpl'), { f: resolvedFormulaTitle });
    const desc = fmt(L('ics_desc_tpl'), { d: macerationDays });

    const startObj = new Date(calculation.endDateIso);
    const y = startObj.getFullYear();
    const m = String(startObj.getMonth() + 1).padStart(2, '0');
    const d = String(startObj.getDate()).padStart(2, '0');
    const icsDate = `${y}${m}${d}`;

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Sham Perfumes//Maceration Simulator//AR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:maceration-${Date.now()}@shamperfumes.com`,
      `DTSTAMP:${icsDate}T090000Z`,
      `DTSTART;VALUE=DATE:${icsDate}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${desc}`,
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-PT12H',
      'ACTION:DISPLAY',
      `DESCRIPTION:${title}`,
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${L('ics_filename')}_${resolvedFormulaTitle.replace(/\s+/g, '_')}_${calculation.endDateIso}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Copy Laboratory Bottle Tag
  const handleCopyBottleTag = () => {
    const tag = `═══════════════════════════════════════════
🏷️ ${L('tag_header')}
═══════════════════════════════════════════
📌 ${L('tag_formula')}: ${resolvedFormulaTitle}
🔢 ${L('tag_batch')}: ${batchCode}
⏳ ${L('tag_duration')}: ${macerationDays} ${L('days_unit')}
📅 ${L('tag_start')}: ${calculation.startDateFormatted}
🎯 ${L('tag_end')}: ${calculation.endDateFormatted}
🌡️ ${L('tag_temp')}: 15°C - 18°C
🛡️ ${L('tag_vessel')}: ${storageTypeLabel()}
═══════════════════════════════════════════
${calculation.isFinished ? L('tag_status_done') : fmt(L('tag_status_progress_tpl'), { d: calculation.remainingDays })}
═══════════════════════════════════════════`;

    navigator.clipboard.writeText(tag);
    setIsCopiedTag(true);
    setTimeout(() => setIsCopiedTag(false), 2500);
  };

  const handleConsultShahin = () => {
    const prompt = fmt(L('consult_prompt_tpl'), {
      f: resolvedFormulaTitle,
      b: batchCode,
      s: startDate,
      d: macerationDays,
      e: calculation.endDateFormatted,
    });

    if (onOpenConsultation) {
      onOpenConsultation(prompt);
    } else {
      window.dispatchEvent(new CustomEvent('open-ai-chat-with-prompt', { detail: prompt }));
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-stone-200/90 shadow-md p-5 sm:p-7 space-y-6">
      
      {/* Tool Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-700 via-amber-800 to-amber-950 text-white flex items-center justify-center font-bold text-xl shadow-md border border-amber-600/30">
            ⏳
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100/80 text-amber-900 text-[10px] font-bold border border-amber-300/60 mb-0.5">
              <Sparkles className="w-3 h-3 text-amber-700" />
              <span>{L('official_tool')}</span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-stone-900 font-serif-luxury">
              {L('page_title')}
            </h3>
            <p className="text-xs text-stone-500">
              {L('page_desc')}
            </p>
          </div>
        </div>

        {/* Shahin AI Consultation Button */}
        <button
          type="button"
          onClick={handleConsultShahin}
          className="self-start sm:self-center px-3.5 py-2 rounded-xl bg-gradient-to-r from-stone-900 to-amber-950 hover:from-black hover:to-amber-900 text-amber-300 font-bold text-xs flex items-center gap-2 border border-amber-500/30 shadow-xs cursor-pointer transition-all hover:scale-[1.02]"
        >
          <Bot className="w-4 h-4 text-amber-400" />
          <span>{L('consult_short')}</span>
        </button>
      </div>

      {/* Main Grid: Inputs vs. Live Forecast Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column (Inputs & Presets): 7 cols */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* 1. Date & Days Controls */}
          <div className="bg-stone-50/80 p-4 sm:p-5 rounded-2xl border border-stone-200/80 space-y-4">
            <span className="text-xs font-bold text-stone-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-700" />
              <span>{L('inputs_heading')}</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Start Date */}
              <div>
                <label className="text-[11px] font-bold text-stone-700 block mb-1.5">
                  {L('start_date_label')}
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => updateStartDate(e.target.value)}
                    className="w-full p-2.5 bg-white border border-stone-300 rounded-xl text-xs font-bold font-mono-numbers text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/20 focus:border-amber-800"
                  />
                </div>
                {/* Quick Date Buttons */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span className="text-[10px] text-stone-400 font-medium">{L('quick')}</span>
                  <button
                    type="button"
                    onClick={() => handleSetQuickDate(0)}
                    className="px-2 py-0.5 rounded text-[10px] bg-white border border-stone-200 hover:bg-stone-100 font-semibold text-stone-700 cursor-pointer"
                  >
                    {L('today')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetQuickDate(-7)}
                    className="px-2 py-0.5 rounded text-[10px] bg-white border border-stone-200 hover:bg-stone-100 font-semibold text-stone-700 cursor-pointer"
                  >
                    {L('minus_7')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetQuickDate(-14)}
                    className="px-2 py-0.5 rounded text-[10px] bg-white border border-stone-200 hover:bg-stone-100 font-semibold text-stone-700 cursor-pointer"
                  >
                    {L('minus_14')}
                  </button>
                </div>
              </div>

              {/* Number of Days */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-stone-700">
                    {L('days_label')}
                  </label>
                  <span className="font-mono-numbers font-black text-amber-900 text-sm">
                    {macerationDays} {L('days_unit')}
                  </span>
                </div>
                <LocalizedNumberInput
                  lang={currentLang}
                  integer
                  min={3}
                  max={365}
                  value={macerationDays}
                  onValue={(n) => updateDays(Math.trunc(n) || 1)}
                  className="w-full p-2.5 bg-white border border-stone-300 rounded-xl text-xs font-bold font-mono-numbers text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/20 focus:border-amber-800"
                />
                <input
                  type="range"
                  min="7"
                  max="120"
                  step="1"
                  value={macerationDays}
                  onChange={(e) => updateDays(parseInt(e.target.value) || 30)}
                  className="w-full accent-amber-800 cursor-pointer mt-2"
                />
              </div>
            </div>
          </div>

          {/* 2. Fragrance Family Presets */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                <FlaskConical className="w-3.5 h-3.5 text-amber-700" />
                <span>{L('presets_heading')}</span>
              </span>
              <span className="text-[10px] text-stone-400">
                {L('click_to_apply')}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {MACERATION_PRESETS.map((preset) => {
                const isSelected = activePresetId === preset.id && macerationDays === preset.days;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className={`p-3 ${rtl ? 'text-right' : 'text-left'} rounded-xl border transition-all text-xs flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-amber-950 text-white border-amber-800 shadow-xs'
                        : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-800'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full gap-2">
                      <span className="font-bold text-xs truncate">
                        {loc(currentLang, preset.name)}
                      </span>
                      <span
                        className={`font-mono-numbers text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          isSelected
                            ? 'bg-amber-800 text-amber-200'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {preset.days} {L('day_letter')}
                      </span>
                    </div>
                    <p
                      className={`text-[10px] leading-relaxed mt-1 ${rtl ? 'text-right' : 'text-left'} ${
                        isSelected ? 'text-stone-300' : 'text-stone-500'
                      }`}
                    >
                      {loc(currentLang, preset.description)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Storage Medium Selector */}
          <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
              <div>
                <span className="font-bold text-stone-900 block">
                  {L('storage_label')}
                </span>
                <span className="text-[10px] text-stone-500">
                  {L('storage_hint')}
                </span>
              </div>
            </div>

            <div className="inline-flex p-1 bg-white rounded-lg border border-stone-300 text-[11px] font-semibold shrink-0">
              <button
                type="button"
                onClick={() => setStorageType('amber_glass')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  storageType === 'amber_glass' ? 'bg-amber-900 text-white font-bold' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {L('amber_glass')}
              </button>
              <button
                type="button"
                onClick={() => setStorageType('dark_cupboard')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  storageType === 'dark_cupboard' ? 'bg-amber-900 text-white font-bold' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {L('dark_chamber')}
              </button>
              <button
                type="button"
                onClick={() => setStorageType('aluminum_flacon')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  storageType === 'aluminum_flacon' ? 'bg-amber-900 text-white font-bold' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {L('aluminum_flacon')}
              </button>
            </div>
          </div>

        </div>

        {/* Right Column: Live Forecast Showcase (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* HERO COMPLETION DATE CARD */}
          <div className="bg-gradient-to-br from-stone-900 via-amber-950 to-stone-950 text-white p-6 rounded-2xl border-2 border-amber-600/40 shadow-xl space-y-5 relative overflow-hidden">
            {/* Ambient background glow */}
            <div className="absolute top-0 right-0 w-44 h-44 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between pb-3 border-b border-amber-500/20 gap-2">
              <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" style={{ animationDuration: '8s' }} />
                <span>{L('predicted_label')}</span>
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                  calculation.isFinished
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : calculation.isFutureStart
                    ? 'bg-stone-700 text-stone-300'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                }`}
              >
                {calculation.isFinished
                  ? L('matured')
                  : calculation.isFutureStart
                  ? L('scheduled')
                  : fmt(L('remaining_tpl'), { d: calculation.remainingDays })}
              </span>
            </div>

            {/* BIG HIGHLIGHT DATE */}
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-black text-amber-100 font-serif-luxury tracking-tight leading-snug">
                {calculation.endDateFormatted}
              </div>
              <div className="text-xs font-mono-numbers text-amber-300/80">
                {calculation.endDateIso} · {fmt(L('days_from_start_tpl'), { d: calculation.totalDays })}
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-300 text-[11px]">
                  {L('progress_label')}
                </span>
                <span className="font-mono-numbers font-bold text-amber-300">
                  {calculation.progressPercent}%
                </span>
              </div>
              <div className="h-3 rounded-full bg-stone-800 p-0.5 border border-amber-500/30 overflow-hidden flex">
                <div
                  style={{ width: `${calculation.progressPercent}%` }}
                  className={`h-full bg-gradient-to-r from-amber-600 via-amber-500 to-amber-300 rounded-full transition-all duration-500 shadow-sm ${rtl ? '' : ''}`}
                />
              </div>
              <div className="flex justify-between text-[10px] text-stone-400 pt-0.5">
                <span>{L('started')} {calculation.startDateFormatted.split('،')[0].split(',')[0]}</span>
                <span>
                  {fmt(L('passed_tpl'), { d: calculation.elapsedDays })}
                </span>
              </div>
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-2 gap-2.5 pt-1 text-xs">
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] text-stone-400 block mb-0.5">
                  {L('ideal_temp')}
                </span>
                <span className="font-bold text-amber-200 font-mono-numbers">
                  15°C - 18°C
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] text-stone-400 block mb-0.5">
                  {L('filtration_label')}
                </span>
                <span className="font-bold text-amber-200">
                  0.22µm {L('post_maceration')}
                </span>
              </div>
            </div>

            {/* Action Buttons: iCal & Bottle Tag */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={handleDownloadCalendarEvent}
                className="py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Calendar className="w-3.5 h-3.5 text-stone-950" />
                <span>{L('ics_button')}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyBottleTag}
                className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-white/10"
              >
                {isCopiedTag ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Printer className="w-3.5 h-3.5 text-amber-300" />}
                <span>{isCopiedTag ? L('copied_tag') : L('copy_tag')}</span>
              </button>
            </div>

          </div>

          {/* Shahin's Laboratory Seal */}
          <div className="bg-amber-50/80 p-4 rounded-2xl border border-amber-200 text-xs text-amber-950 space-y-2 shadow-2xs">
            <div className="font-bold text-stone-900 flex items-center gap-2">
              <span className="text-base">🧙‍♂️</span>
              <span>{L('shahin_rule_title')}</span>
            </div>
            <p className="text-[11px] leading-relaxed text-stone-700">
              {fmt(L('shahin_rule_text'), {
                date:
                  calculation.endDateFormatted.split('،')[1]?.trim() ||
                  calculation.endDateFormatted.split(',')[1]?.trim() ||
                  calculation.endDateFormatted,
              })}
            </p>
          </div>

        </div>

      </div>

      {/* 4. Visual 4-Stage Molecular Transformation Timeline */}
      <div className="pt-4 border-t border-stone-200/80 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-stone-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-700" />
            <span>{L('timeline_heading')}</span>
          </span>
          <span className="text-[10px] text-stone-400 font-mono-numbers shrink-0">
            {fmt(L('days_breakdown_tpl'), { d: calculation.totalDays })}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          
          {/* Stage 1 */}
          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/90 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 font-bold flex items-center justify-center text-[10px] shrink-0">
                  1
                </span>
                <span>{L('stage1_title')}</span>
              </span>
              <span className="text-[10px] font-mono-numbers text-stone-500 shrink-0">
                1 - {Math.max(3, Math.round(calculation.totalDays * 0.2))} {L('day_letter')}
              </span>
            </div>
            <p className="text-[11px] text-stone-600 leading-relaxed">
              {L('stage1_desc')}
            </p>
          </div>

          {/* Stage 2 */}
          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/90 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 font-bold flex items-center justify-center text-[10px] shrink-0">
                  2
                </span>
                <span>{L('stage2_title')}</span>
              </span>
              <span className="text-[10px] font-mono-numbers text-stone-500 shrink-0">
                {Math.max(4, Math.round(calculation.totalDays * 0.2) + 1)} - {Math.round(calculation.totalDays * 0.55)} {L('day_letter')}
              </span>
            </div>
            <p className="text-[11px] text-stone-600 leading-relaxed">
              {L('stage2_desc')}
            </p>
          </div>

          {/* Stage 3 */}
          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/90 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 font-bold flex items-center justify-center text-[10px] shrink-0">
                  3
                </span>
                <span>{L('stage3_title')}</span>
              </span>
              <span className="text-[10px] font-mono-numbers text-stone-500 shrink-0">
                {Math.round(calculation.totalDays * 0.55) + 1} - {Math.round(calculation.totalDays * 0.85)} {L('day_letter')}
              </span>
            </div>
            <p className="text-[11px] text-stone-600 leading-relaxed">
              {L('stage3_desc')}
            </p>
          </div>

          {/* Stage 4 */}
          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0">
                  4
                </span>
                <span>{L('stage4_title')}</span>
              </span>
              <span className="text-[10px] font-mono-numbers text-amber-900 font-bold shrink-0">
                {fmt(L('final_day_tpl'), { d: calculation.totalDays })}
              </span>
            </div>
            <p className="text-[11px] text-amber-950 leading-relaxed">
              {L('stage4_desc')}
            </p>
          </div>

        </div>
      </div>

      {/* 5. Master Perfumer Shahin Interactive Council & Direct Consultation */}
      <div className="pt-4 border-t border-stone-200/80 space-y-3.5">
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-stone-900 via-amber-950 to-stone-900 text-white border border-amber-600/30 shadow-md space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center font-bold text-lg shrink-0">
                🧙‍♂️
              </div>
              <div>
                <h4 className="font-bold text-sm text-amber-200 flex items-center gap-1.5 font-serif-luxury flex-wrap">
                  <span>{L('advisory_title')}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                    {L('live_shahin')}
                  </span>
                </h4>
                <p className="text-[11px] text-stone-300">
                  {fmt(L('advisory_summary_tpl'), {
                    batch: batchCode,
                    days: macerationDays,
                    date: calculation.isFinished ? calculation.endDateIso : calculation.endDateFormatted,
                  })}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleConsultShahin}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-stone-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer shrink-0"
            >
              <Bot className="w-4 h-4 text-stone-950" />
              <span>{L('full_consultation')}</span>
            </button>
          </div>

          {/* Quick Consultation Prompt Chips */}
          <div className="pt-2">
            <span className="text-[10px] text-amber-300/80 font-bold block mb-2">
              {L('quick_pick')}
            </span>
            <div className="flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  const q = fmt(L('chip1_q_tpl'), { d: macerationDays, f: resolvedFormulaTitle });
                  if (onOpenConsultation) onOpenConsultation(q);
                  else window.dispatchEvent(new CustomEvent('open-ai-chat-with-prompt', { detail: q }));
                }}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-amber-500/30 text-stone-200 hover:text-amber-200 border border-white/15 text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>💡</span>
                <span>{fmt(L('chip1_tpl'), { d: macerationDays })}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const q = L('chip2_q');
                  if (onOpenConsultation) onOpenConsultation(q);
                  else window.dispatchEvent(new CustomEvent('open-ai-chat-with-prompt', { detail: q }));
                }}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-amber-500/30 text-stone-200 hover:text-amber-200 border border-white/15 text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>❄️</span>
                <span>{L('chip2')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const q = fmt(L('chip3_q_tpl'), { f: resolvedFormulaTitle });
                  if (onOpenConsultation) onOpenConsultation(q);
                  else window.dispatchEvent(new CustomEvent('open-ai-chat-with-prompt', { detail: q }));
                }}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-amber-500/30 text-stone-200 hover:text-amber-200 border border-white/15 text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>🛡️</span>
                <span>{L('chip3')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Cross-Tool Quick Navigation */}
        {onNavigateToTab && (
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 text-xs">
            <span className="text-[11px] text-stone-500 font-semibold">
              {L('related_tools')}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigateToTab('concentration')}
                className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold transition-colors cursor-pointer flex items-center gap-1.5 text-xs"
              >
                <FlaskConical className="w-3.5 h-3.5 text-amber-700" />
                <span>{L('back_to_calc')}</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigateToTab('guide')}
                className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 font-semibold transition-colors cursor-pointer flex items-center gap-1.5 text-xs"
              >
                <Layers className="w-3.5 h-3.5 text-stone-600" />
                <span>{L('guide_btn')}</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigateToTab('master_ai')}
                className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold transition-colors cursor-pointer flex items-center gap-1.5 text-xs"
              >
                <Bot className="w-3.5 h-3.5 text-emerald-700" />
                <span>{L('ai_lab_btn')}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <LegalDisclaimer type="chemical" lang={currentLang as SupportedLanguage} />
    </div>
  );
};
