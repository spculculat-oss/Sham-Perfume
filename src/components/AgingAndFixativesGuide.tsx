import React from 'react';
import {
  Clock,
  ShieldCheck,
  Droplet,
  Beaker,
  Thermometer,
  SunDim,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';
import ingredientsImg from '../assets/images/perfume_ingredients_pyramid_1791692429360.jpg';
import { SupportedLanguage } from '../types/i18n';
import { FormulationState } from '../types/perfume';
import { isRTL } from '../utils/localizedContent';
import { LText, makeT } from '../utils/localize';
import { MacerationTimeSimulator } from './MacerationTimeSimulator';


const S = {
  page_title: {
    ar: 'دليل التعتيق، المثبتات، ومحاكي نضوج العطر المعملي',
    en: 'Maceration Protocol, Fixatives & Laboratory Standards',
    fr: 'Protocole de macération, fixateurs et standards de laboratoire',
    es: 'Protocolo de maceración, fijadores y estándares de laboratorio',
    it: 'Protocollo di macerazione, fissativi e standard di laboratorio',
    de: 'Mazerationsprotokoll, Fixative & Laborstandards',
    ru: 'Протокол мацерации, фиксаторы и лабораторные стандарты',
    zh: '陈化规程、定香剂与实验室标准',
    tr: 'Dinlendirme protokolü, fiksatörler ve laboratuvar standartları',
    fa: 'پروتکل کهنه‌سازی، تثبیت‌کننده‌ها و استانداردهای آزمایشگاه',
  },
  page_desc: {
    ar: 'المرجع العلمي لصناع العطور: محاكي التعتيق الزمني، فترات التعتيق النموذجية، خواص المذيبات، وكيفية مضاعفة الثبات والفوحان بأمان.',
    en: 'Scientific guide for perfumers: benchmark maceration timelines, maturation forecasting, and safe sillage/longevity optimization.',
    fr: 'Guide scientifique : chronologies de macération, prévision de maturation et optimisation sécurisée du sillage.',
    es: 'Guía científica: cronologías de maceración, previsión de maduración y optimización segura.',
    it: 'Guida scientifica: cronologie di macerazione, previsione di maturazione e ottimizzazione sicura.',
    de: 'Wissenschaftlicher Leitfaden: Mazerationszeiträume, Reifungsprognose und sichere Optimierung.',
    ru: 'Научное руководство: сроки мацерации, прогноз созревания и безопасная оптимизация.',
    zh: '科学指南：陈化时间表、成熟度预测与安全优化。',
    tr: 'Bilimsel rehber: dinlendirme süreleri, olgunlaşma öngörüsü ve güvenli optimizasyon.',
    fa: 'راهنمای علمی: زمان‌بندی کهنه‌سازی، پیش‌بینی رسیدگی و بهینه‌سازی ایمن.',
  },
  secrets_badge: {
    ar: 'أسرار نضوج العطر في المعمل',
    en: 'Laboratory Maturation Secrets',
    fr: 'Secrets de maturation en laboratoire',
    es: 'Secretos de maduración en laboratorio',
    it: 'Segreti di maturazione in laboratorio',
    de: 'Reifungsgeheimnisse im Labor',
    ru: 'Секреты созревания в лаборатории',
    zh: '实验室熟成秘诀',
    tr: 'Laboratuvarda olgunlaşma sırları',
    fa: 'رازهای رسیدگی عطر در آزمایشگاه',
  },
  maturation_title: {
    ar: 'الفرق بين النضوج (Maturation) والتعتيق (Maceration)',
    en: 'Maturation vs. Maceration: Scientific Distinction',
    fr: 'Maturation vs. macération : la distinction',
    es: 'Maduración vs. maceración: distinción científica',
    it: 'Maturazione vs. macerazione: distinzione scientifica',
    de: 'Reifung vs. Mazeration: der Unterschied',
    ru: 'Созревание vs. мацерация: в чём разница',
    zh: '熟成 vs. 陈化：科学区分',
    tr: 'Olgunlaşma vs. dinlendirme: bilimsel fark',
    fa: 'نضوج در برابر کهنه‌سازی: تفاوت علمی',
  },
  maturation_intro: {
    ar: 'الكثير من المبتدئين يخلطون بين المرحلتين:',
    en: 'Crucial stages often misunderstood by perfumers:',
    fr: 'Deux étapes souvent confondues :',
    es: 'Dos etapas a menudo confundidas:',
    it: 'Due fasi spesso confuse:',
    de: 'Zwei oft verwechselte Phasen:',
    ru: 'Две стадии, которые часто путают:',
    zh: '两个常被混淆的阶段：',
    tr: 'Sık karıştırılan iki aşama:',
    fa: 'دو مرحله که اغلب اشتباه گرفته می‌شوند:',
  },
  maturation_lbl: {
    ar: '1. النضوج (Maturation):',
    en: '1. Maturation:',
    fr: '1. Maturation :',
    es: '1. Maduración:',
    it: '1. Maturazione:',
    de: '1. Reifung:',
    ru: '1. Созревание:',
    zh: '1. 熟成：',
    tr: '1. Olgunlaşma:',
    fa: '۱. نضوج:',
  },
  maturation_desc: {
    ar: 'هو ترك خليط الزيوت العطرية الخام وحدها لتتفاعل جزيئياً لمدة 48 ساعة إلى أسبوعين قبل إضافة أي كحول.',
    en: 'Letting the raw botanical/aromatic concentrate rest unblended for 48 hours to 2 weeks before ethanol introduction, allowing molecular ester cross-linking.',
    fr: 'Laisser reposer le concentré brut 48 h à 2 semaines avant l’ajout d’éthanol, pour permettre les liaisons esters.',
    es: 'Dejar reposar el concentrado crudo de 48 horas a 2 semanas antes de añadir etanol.',
    it: 'Lasciare riposare il concentrato grezzo da 48 ore a 2 settimane prima dell’etanolo.',
    de: 'Das Rohkonzentrat 48 Stunden bis 2 Wochen ruhen lassen, bevor Ethanol zugegeben wird.',
    ru: 'Выстаивание сырого концентрата 48 часов — 2 недели до добавления этанола.',
    zh: '在加入乙醇前，让原料浓缩物单独静置 48 小时至 2 周。',
    tr: 'Etanol eklenmeden önce hammadde konsantresini 48 saat ile 2 hafta arası dinlendirmek.',
    fa: 'اجازه دادن کنسانتره خام ۴۸ ساعت تا ۲ هفته پیش از افزودن الکل استراحت کند.',
  },
  maceration_lbl: {
    ar: '2. التعتيق (Maceration):',
    en: '2. Maceration:',
    fr: '2. Macération :',
    es: '2. Maceración:',
    it: '2. Macerazione:',
    de: '2. Mazeration:',
    ru: '2. Мацерация:',
    zh: '2. 陈化：',
    tr: '2. Dinlendirme:',
    fa: '۲. کهنه‌سازی:',
  },
  maceration_desc: {
    ar: 'هو مرحلة خلط الزيت مع الكحول والماء والمثبت وترك المزيج في قارورة زجاجية داكنة لعدة أسابيع حتى تتشابك روابط الإيثانول مع الجزيئات العطرية ويزول وخز الكحول الحاد.',
    en: 'Resting the fully diluted alcoholic compound (oil + perfumer ethanol + distilled water + fixative) in dark amber glass for weeks, letting harsh ethanol spikes dissipate into a smooth sillage.',
    fr: 'Reposer le composé alcoolique dilué (huile + éthanol + eau + fixateur) en verre ambré pendant des semaines.',
    es: 'Reposar el compuesto alcohólico diluido (aceite + etanol + agua + fijador) en vidrio ámbar durante semanas.',
    it: 'Far riposare il composto alcolico diluito (olio + etanolo + acqua + fissativo) in vetro ambrato per settimane.',
    de: 'Die verdünnte alkoholische Mischung (Öl + Ethanol + Wasser + Fixativ) wochenlang in Braunglas ruhen lassen.',
    ru: 'Выдержка разбавленной спиртовой смеси (масло + этанол + вода + фиксатор) в тёмном стекле неделями.',
    zh: '将稀释后的酒精混合物（油+乙醇+水+定香剂）置于琥珀玻璃中静置数周。',
    tr: 'Seyreltilmiş alkollü karışımı (yağ + etanol + su + fiksatör) amber camda haftalarca dinlendirmek.',
    fa: 'استراحت مخلوط الکلی رقیق‌شده (روغن + الکل + آب + تثبیت‌کننده) در شیشه کهربایی به مدت چند هفته.',
  },
  img_alt: {
    ar: 'مكونات عطرية طبيعية',
    en: 'Natural Perfume Ingredients',
    fr: 'Ingrédients de parfum naturels',
    es: 'Ingredientes de perfume naturales',
    it: 'Ingredienti naturali del profumo',
    de: 'Natürliche Parfümzutaten',
    ru: 'Натуральные парфюмерные ингредиенты',
    zh: '天然香水原料',
    tr: 'Doğal parfüm malzemeleri',
    fa: 'مواد طبیعی عطر',
  },
  simulator_formula_title: {
    ar: 'تركيبة معمل الشام المختارة',
    en: 'Selected Formulation',
    fr: 'Formule sélectionnée',
    es: 'Fórmula seleccionada',
    it: 'Formula selezionata',
    de: 'Ausgewählte Formel',
    ru: 'Выбранная формула',
    zh: '已选配方',
    tr: 'Seçili formül',
    fa: 'فرمول انتخاب‌شده',
  },
  timeline_title: {
    ar: 'جدول فترات التعتيق الموصى بها حسب العائلة العطرية',
    en: 'Recommended Maceration Timeline by Olfactory Family',
    fr: 'Délais de macération recommandés par famille olfactive',
    es: 'Cronología de maceración recomendada por familia olfativa',
    it: 'Tempi di macerazione consigliati per famiglia olfattiva',
    de: 'Empfohlene Mazerationszeiten nach Duftfamilie',
    ru: 'Рекомендуемые сроки мацерации по семействам',
    zh: '按香族划分的建议陈化时间',
    tr: 'Koku ailesine göre önerilen dinlendirme süreleri',
    fa: 'زمان‌بندی پیشنهادی کهنه‌سازی بر اساس خانواده بویی',
  },
  fam_citrus: {
    ar: 'العطور الحمضية والبحرية',
    en: 'Citrus & Marine Aquatics',
    fr: 'Agrumes et marins',
    es: 'Cítricos y marinos',
    it: 'Agrumi e marini',
    de: 'Zitrus & Maritim',
    ru: 'Цитрусовые и морские',
    zh: '柑橘与海洋',
    tr: 'Narenciye ve deniz',
    fa: 'مرکبات و دریایی',
  },
  fam_citrus_days: {
    ar: '14 - 21 يوماً',
    en: '14 - 21 Days',
    fr: '14 - 21 jours',
    es: '14 - 21 días',
    it: '14 - 21 giorni',
    de: '14 - 21 Tage',
    ru: '14 - 21 дней',
    zh: '14 - 21 天',
    tr: '14 - 21 gün',
    fa: '۱۴ تا ۲۱ روز',
  },
  fam_citrus_desc: {
    ar: 'تحتوي على جزيئات ليمونين وبرغموت خفيفة سريعة الأكسدة. التعتيق الزائد عن شهرين قد يضعف نضارتها الصيفية الفواحة.',
    en: 'Dominated by volatile limonene and bergaptene molecules. Over-maceration beyond 60 days can oxidize sparkling top notes.',
    fr: 'Dominées par le limonène volatil. Au-delà de 60 jours, les notes pétillantes s’oxydent.',
    es: 'Dominadas por limoneno volátil. Más de 60 días oxida las notas chispeantes.',
    it: 'Dominati da limonene volatile. Oltre 60 giorni le note frizzanti si ossidano.',
    de: 'Dominiert von flüchtigem Limonen. Über 60 Tage oxidiert die funkelnden Kopfnoten.',
    ru: 'Доминирует летучий лимонен. Свыше 60 дней искристые верхние ноты окисляются.',
    zh: '以挥发性柠檬烯为主。超过 60 天会导致清新前调氧化。',
    tr: 'Uçucu limonen baskın. 60 günden fazla macerasyon üst notaları oksitler.',
    fa: 'غالباً لیمونن فرار. بیش از ۶۰ روز نت‌های سرزنده را اکسید می‌کند.',
  },
  fam_citrus_ex: {
    ar: 'مثال: كولونيا صيفية، أكوا دي جيو، نسيم البحر.',
    en: 'e.g., Summer Cologne, Acqua di Gio, Marine Ozone.',
    fr: 'ex. Cologne d’été, Acqua di Gio, ozone marin.',
    es: 'ej. Colonia de verano, Acqua di Gio, ozono marino.',
    it: 'es. Colonia estiva, Acqua di Gio, ozono marino.',
    de: 'z. B. Sommerkolonie, Acqua di Gio, Meeresozon.',
    ru: 'напр. летняя колония, Acqua di Gio, морской озон.',
    zh: '如：夏季古龙、Acqua di Gio、海洋气息。',
    tr: 'ör. Yaz kolonyası, Acqua di Gio, deniz esintisi.',
    fa: 'مثال: کلنیا تابستانی، آکوا دی جیو، نسیم دریا.',
  },
  fam_floral: {
    ar: 'العطور الزهرية والفاكهية',
    en: 'Florals & Sweet Gourmand',
    fr: 'Floraux et gourmands',
    es: 'Florales y gourmand',
    it: 'Floreali e gourmand',
    de: 'Floral & Gourmand',
    ru: 'Цветочные и гурманские',
    zh: '花香与美食调',
    tr: 'Çiçeksi ve gurme',
    fa: 'گلی و شیرین',
  },
  fam_floral_days: {
    ar: '25 - 35 يوماً',
    en: '25 - 35 Days',
    fr: '25 - 35 jours',
    es: '25 - 35 días',
    it: '25 - 35 giorni',
    de: '25 - 35 Tage',
    ru: '25 - 35 дней',
    zh: '25 - 35 天',
    tr: '25 - 35 gün',
    fa: '۲۵ تا ۳۵ روز',
  },
  fam_floral_desc: {
    ar: 'الزهور كالياسمين والورد تحتاج شهراً تقريباً لتتحد مع نوتات الفانيليا والمسك وتزول الرائحة الكحولية الحادة.',
    en: 'Heart notes like Jasmine and Rose de Mai require 4 weeks to harmonize with vanilla and musk without alcoholic harshness.',
    fr: 'Jasmin et rose exigent 4 semaines pour s’accorder à la vanille et au musc.',
    es: 'Jazmín y rosa requieren 4 semanas para armonizar con vainilla y almizcle.',
    it: 'Gelsomino e rosa richiedono 4 settimane per armonizzarsi con vaniglia e muschio.',
    de: 'Jasmin und Rose brauchen 4 Wochen zur Harmonie mit Vanille und Moschus.',
    ru: 'Жасмин и роза требуют 4 недели для гармонии с ванилью и мускусом.',
    zh: '茉莉与玫瑰需约 4 周才能与香草麝香融合。',
    tr: 'Yasemin ve gül, vanilya ve miskle uyum için 4 hafta ister.',
    fa: 'یاسمین و گل‌محمدی حدود ۴ هفته برای هماهنگی با وانیل و مشک لازم دارند.',
  },
  fam_floral_ex: {
    ar: 'مثال: ورد طائفي وفانيليا، ياسمين أبيض، فواكه استوائية.',
    en: 'e.g., Rose Taifi & Vanilla, White Jasmine, Sweet Fruits.',
    fr: 'ex. Rose de Taïf et vanille, jasmin blanc, fruits sucrés.',
    es: 'ej. Rosa Taif y vainilla, jazmín blanco, frutas dulces.',
    it: 'es. Rosa di Taif e vaniglia, gelsomino bianco, frutti dolci.',
    de: 'z. B. Taif-Rose und Vanille, weißer Jasmin, süße Früchte.',
    ru: 'напр. таифская роза с ванилью, белый жасмин, сладкие фрукты.',
    zh: '如：塔伊夫玫瑰加香草、白茉莉、甜果。',
    tr: 'ör. Taif gülü ve vanilya, beyaz yasemin, tatlı meyveler.',
    fa: 'مثال: گل محمدی طائف و وانیل، یاسمین سفید، میوه‌های گرمسیری.',
  },
  fam_oriental: {
    ar: 'العطور الشرقية، الأخشاب والعود',
    en: 'Oriental, Woody & Precious Oud',
    fr: 'Orientaux, boisés et oud précieux',
    es: 'Orientales, amaderados y oud precioso',
    it: 'Orientali, legnosi e oud prezioso',
    de: 'Orientalisch, Holz & kostbares Oud',
    ru: 'Восточные, древесные и драгоценный уд',
    zh: '东方、木质与珍稀乌木',
    tr: 'Oryantal, odunsu ve değerli oud',
    fa: 'شرقی، چوبی و عود گران‌بها',
  },
  fam_oriental_days: {
    ar: '45 - 60+ يوماً',
    en: '45 - 60+ Days',
    fr: '45 - 60+ jours',
    es: '45 - 60+ días',
    it: '45 - 60+ giorni',
    de: '45 - 60+ Tage',
    ru: '45 - 60+ дней',
    zh: '45 - 60+ 天',
    tr: '45 - 60+ gün',
    fa: '۴۵ تا ۶۰+ روز',
  },
  fam_oriental_desc: {
    ar: 'الجزيئات الثقيلة مثل الراتنجات وخشب الصندل والعنبر والعود المعتق تتطلب وقتاً أطول لتصل إلى عمقها المخملي الفاخر.',
    en: 'Heavy resinous molecules, sandalwood santalols, and aged oud oils require extended time to unlock their velvet opulence.',
    fr: 'Les molécules résineuses, le santal et l’oud âgé exigent plus de temps pour révéler leur opulence.',
    es: 'Moléculas resinosas, sándalo y oud añejo necesitan más tiempo para revelar su opulencia.',
    it: 'Molecole resinose, sandalo e oud invecchiato richiedono più tempo per rivelare la loro opulenza.',
    de: 'Harzige Moleküle, Sandelholz und gereiftes Oud brauchen länger für ihre Samtopulenz.',
    ru: 'Смолистые молекулы, сандал и выдержанный уд требуют больше времени для раскрытия.',
    zh: '树脂类分子、檀香与陈年乌木需要更久才能展现丝绒般的华贵。',
    tr: 'Reçineli moleküller, sandal ağacı ve yaşlanmış oud, ihtişamlarını açmak için daha uzun süre ister.',
    fa: 'مولکول‌های رزینی، صندل و عود کهنه برای رسیدن به شکوه مخملی خود زمان بیشتری می‌خواهند.',
  },
  fam_oriental_ex: {
    ar: 'مثال: سلطان العود، عنبر ملكي، توباكو فانيلا.',
    en: 'e.g., Sultan Oud, Amber Imperial, Tobacco Vanille.',
    fr: 'ex. Sultan Oud, Ambre Impérial, Tobacco Vanille.',
    es: 'ej. Sultan Oud, Ámbar Imperial, Tobacco Vanille.',
    it: 'es. Sultan Oud, Ambra Imperiale, Tobacco Vanille.',
    de: 'z. B. Sultan Oud, Imperial Amber, Tobacco Vanille.',
    ru: 'напр. Sultan Oud, Imperial Amber, Tobacco Vanille.',
    zh: '如：Sultan Oud、皇家琥珀、Tobacco Vanille。',
    tr: 'ör. Sultan Oud, İmparatorluk Amberi, Tobacco Vanille.',
    fa: 'مثال: سلطان عود، عنبر سلطنتی، توباکو وانیل.',
  },
  fixatives_title: {
    ar: 'دليل المثبتات العطرية والمذيبات المتخصصة',
    en: 'Compounding Fixatives & Technical Solvents Guide',
    fr: 'Guide des fixateurs et solvants techniques',
    es: 'Guía de fijadores y disolventes técnicos',
    it: 'Guida ai fissativi e solventi tecnici',
    de: 'Leitfaden: Fixative & technische Lösungsmittel',
    ru: 'Справочник фиксаторов и технических растворителей',
    zh: '定香剂与特种溶剂指南',
    tr: 'Fiksatör ve teknik çözücüler rehberi',
    fa: 'راهنمای تثبیت‌کننده‌ها و حلال‌های فنی',
  },
  th_fixative: {
    ar: 'اسم المثبت / المذيب',
    en: 'Fixative / Solvent',
    fr: 'Fixateur / Solvant',
    es: 'Fijador / Disolvente',
    it: 'Fissativo / Solvente',
    de: 'Fixativ / Lösungsmittel',
    ru: 'Фиксатор / Растворитель',
    zh: '定香剂/溶剂',
    tr: 'Fiksatör / Çözücü',
    fa: 'تثبیت‌کننده / حلال',
  },
  th_ratio: {
    ar: 'النسبة الموصى بها',
    en: 'Usage Ratio',
    fr: 'Dosage',
    es: 'Proporción',
    it: 'Dosaggio',
    de: 'Dosierung',
    ru: 'Дозировка',
    zh: '用量比例',
    tr: 'Kullanım oranı',
    fa: 'نسبت مصرف',
  },
  th_role: {
    ar: 'الدور الوظيفي في العطر',
    en: 'Functional Role',
    fr: 'Rôle fonctionnel',
    es: 'Rol funcional',
    it: 'Ruolo funzionale',
    de: 'Funktionale Rolle',
    ru: 'Функциональная роль',
    zh: '功能作用',
    tr: 'Fonksiyonel rol',
    fa: 'نقش عملکردی',
  },
  th_sillage: {
    ar: 'التأثير على الفوحان',
    en: 'Impact on Sillage',
    fr: 'Impact sur le sillage',
    es: 'Impacto en la estela',
    it: 'Impatto sulla scia',
    de: 'Einfluss auf Sillage',
    ru: 'Влияние на шлейф',
    zh: '对扩散的影响',
    tr: 'İz üzerindeki etkisi',
    fa: 'تأثیر بر انتشار',
  },
  row_dpg: {
    ar: 'دي بروبيلين جلايكول (DPG)',
    en: 'Dipropylene Glycol (DPG)',
    fr: 'Dipropylène glycol (DPG)',
    es: 'Dipropilenglicol (DPG)',
    it: 'Dipropilenglicole (DPG)',
    de: 'Dipropylenglykol (DPG)',
    ru: 'Дипропиленгликоль (DPG)',
    zh: '双丙二醇（DPG）',
    tr: 'Dipropilen glikol (DPG)',
    fa: 'دی‌پروپیلن گلیکول (DPG)',
  },
  dpg_role: {
    ar: 'مذيب ومثبت عديم الرائحة، يبطئ معدل تبخر الزيت ويربطه بالمسامات.',
    en: 'Odorless carrier solvent; moderates evaporation curve and binds to skin.',
    fr: 'Solvant porteur inodore ; module l’évaporation et se fixe à la peau.',
    es: 'Disolvente portador inodoro; modera la evaporación y se fija a la piel.',
    it: 'Solvente veicolo inodore; modera l’evaporazione e si lega alla pelle.',
    de: 'Geruchloses Trägersolvens; dämpft die Verdunstung und haftet auf der Haut.',
    ru: 'Носитель без запаха; смягчает испарение и фиксируется на коже.',
    zh: '无嗅载体溶剂；减缓挥发并附着肌肤。',
    tr: 'Kokusuz taşıyıcı çözücü; buharlaşmayı yavaşlatır ve cilde tutunur.',
    fa: 'حلال حامل بی‌بو؛ سرعت تبخیر را کند می‌کند و به پوست می‌چسبد.',
  },
  dpg_sillage: {
    ar: 'يزيد الثبات بدون التأثير على النوتات.',
    en: 'Enhances longevity without muting top notes.',
    fr: 'Renforce la tenue sans étouffer les notes de tête.',
    es: 'Aumenta la duración sin apagar las notas altas.',
    it: 'Aumenta la persistenza senza smorzare le note di testa.',
    de: 'Verlängert die Haltbarkeit, ohne Kopfnoten zu dämpfen.',
    ru: 'Увеличивает стойкость, не приглушая верхние ноты.',
    zh: '提升留香且不压制前调。',
    tr: 'Üst notaları bastırmadan kalıcılığı artırır.',
    fa: 'ماندگاری را بدون کاهش نت‌های بالا افزایش می‌دهد.',
  },
  row_ipm: {
    ar: 'أيزوبروبيل ميريستات (IPM)',
    en: 'Isopropyl Myristate (IPM)',
    fr: 'Myristate d’isopropyle (IPM)',
    es: 'Miristato de isopropilo (IPM)',
    it: 'Miristato di isopropile (IPM)',
    de: 'Isopropylmyristat (IPM)',
    ru: 'Изопропилмиристат (IPM)',
    zh: '肉豆蔻酸异丙酯（IPM）',
    tr: 'İzopropil miristat (IPM)',
    fa: 'ایزوپروپیل میریستات (IPM)',
  },
  ipm_role: {
    ar: 'يمنح رذاذاً ناعماً سريع الامتصاص على الجلد ويقلل من تلطيخ الملابس.',
    en: 'Emollient ester; delivers ultra-fine mist atomization and prevents textile staining.',
    fr: 'Ester émollient ; brume ultrafine et sans taches sur les textiles.',
    es: 'Éster emoliente; nebulización ultrafina sin manchar tejidos.',
    it: 'Estere emolliente; nebulizzazione finissima che non macchia i tessuti.',
    de: 'Emollient-Ester; ultrafeiner Nebel ohne Textilflecken.',
    ru: 'Эмолентный эфир; сверхтонкое распыление без пятен на ткани.',
    zh: '润肤酯；超细雾化喷洒且不沾污织物。',
    tr: 'Emolyen ester; ultra ince püskürtme, kumaşta leke bırakmaz.',
    fa: 'استر نرم‌کننده؛ اسپری بسیار ریز بدون لکه روی پارچه.',
  },
  ipm_sillage: {
    ar: 'يحسن انتشار الرذاذ الدقيق.',
    en: 'Optimizes nozzle droplet dispersion.',
    fr: 'Optimise la dispersion des gouttelettes.',
    es: 'Optimiza la dispersión de gotas.',
    it: 'Ottimizza la dispersione delle gocce.',
    de: 'Optimiert die Tröpfchenverteilung.',
    ru: 'Оптимизирует распыление капель.',
    zh: '优化喷雾颗粒分布。',
    tr: 'Damla dağılımını optimize eder.',
    fa: 'پخش ذرات اسپری را بهینه می‌کند.',
  },
  row_isoe: {
    ar: 'إيزو إي سوبر (Iso E Super)',
    en: 'Iso E Super',
    fr: 'Iso E Super',
    es: 'Iso E Super',
    it: 'Iso E Super',
    de: 'Iso E Super',
    ru: 'Iso E Super',
    zh: 'Iso E Super',
    tr: 'Iso E Super',
    fa: 'ایزو ای سوپر (Iso E Super)',
  },
  isoe_role: {
    ar: 'جزيء خشبي أرزي مخملي يمنح العطر هالة وإشعاعاً واسعاً (Sillage).',
    en: 'Velvety woody-cedar molecule providing extraordinary diffuse projection.',
    fr: 'Molécule boisée veloutée offrant une projection exceptionnelle.',
    es: 'Molécula amaderada aterciopelada con proyección extraordinaria.',
    it: 'Molecola legnosa vellutata con proiezione straordinaria.',
    de: 'Samtiges Holz-Zedern-Molekül mit außergewöhnlicher Projektion.',
    ru: 'Бархатистая древесно-кедровая молекула с исключительной проекцией.',
    zh: '如丝绒般的雪松木分子，带来非凡扩散力。',
    tr: 'Kadifemsi sedir ağacı molekülü, olağanüstü yayılma sağlar.',
    fa: 'مولکول چوب سدر مخملی با پروجکشن استثنایی.',
  },
  isoe_sillage: {
    ar: 'فوحان وإشراق ملحوظ.',
    en: 'Expansive aura & magnetic trail.',
    fr: 'Halo ample et traînée magnétique.',
    es: 'Aura expansiva y estela magnética.',
    it: 'Aura espansiva e scia magnetica.',
    de: 'Weites Aura & magnetische Spur.',
    ru: 'Широкий ореол и магнитный шлейф.',
    zh: '宽阔光晕与磁性余韵。',
    tr: 'Geniş hale ve manyetik iz.',
    fa: 'هاله گسترده و رد مغناطیسی.',
  },
  row_ambroxan: {
    ar: 'أمبروكسان (Ambroxan)',
    en: 'Ambroxan (C16H28O)',
    fr: 'Ambroxan',
    es: 'Ambroxan',
    it: 'Ambroxan',
    de: 'Ambroxan',
    ru: 'Амброксан',
    zh: '龙涎醚（Ambroxan）',
    tr: 'Ambroksan',
    fa: 'آمبروکسان (Ambroxan)',
  },
  amb_role: {
    ar: 'بديل العنبر الأبيض الأسطوري، يثبت قاعدة العطر لأيام مع نكهة جافة دافئة.',
    en: 'Clean ambergris molecule anchoring base foundation for days with dry warmth.',
    fr: 'Molécule ambrée propre qui ancre la base pendant des jours.',
    es: 'Molécula ambarada limpia que ancla la base durante días.',
    it: 'Molecola ambrata pulita che ancora la base per giorni.',
    de: 'Klares Bernstein-Molekül, das die Basis tagelang verankert.',
    ru: 'Чистая амбровая молекула, держащая базу днями.',
    zh: '洁净龙涎香分子，以干燥暖意锚定基底数日。',
    tr: 'Temiz amber molekülü, tabanı günlerce sabitler.',
    fa: 'مولکول عنبری تمیز که پایه را روزها ثابت نگه می‌دارد.',
  },
  amb_sillage: {
    ar: 'ثبات استثنائي يدوم 48 ساعة.',
    en: 'Exceptional 48h tenacity.',
    fr: 'Tenacité exceptionnelle de 48 h.',
    es: 'Tenacidad excepcional de 48 h.',
    it: 'Tenacia eccezionale di 48 ore.',
    de: 'Außergewöhnliche 48-h-Haltbarkeit.',
    ru: 'Исключительная стойкость 48 часов.',
    zh: '非凡的 48 小时持久力。',
    tr: '48 saatlik olağanüstü kalıcılık.',
    fa: 'ماندگاری استثنایی ۴۸ ساعته.',
  },
  row_hedione: {
    ar: 'هيديون (Hedione)',
    en: 'Hedione (Kharismal)',
    fr: 'Hedione',
    es: 'Hedione',
    it: 'Hedione',
    de: 'Hedione',
    ru: 'Гедион',
    zh: '海利酮（Hedione）',
    tr: 'Hedione',
    fa: 'هیدیون (Hedione)',
  },
  hedione_role: {
    ar: 'مستحلب زهري يمنح العطر انفتاحاً وإشراقاً كضوء الشمس في الافتتاحية.',
    en: 'Transparent floral jasmine note acting as luminous radiance booster.',
    fr: 'Note jasminée transparente, amplificateur de rayonnement.',
    es: 'Nota floral transparente de jazmín que amplifica el brillo.',
    it: 'Nota gelsomino trasparente che amplifica lo splendore.',
    de: 'Transparente Jasminnote als Strahlungsverstärker.',
    ru: 'Прозрачная жасминовая нота — усилитель сияния.',
    zh: '透明茉莉香调，如同阳光般提升光泽。',
    tr: 'Şeffaf yasemin notası, parlaklığı artırır.',
    fa: 'نت یاسمین شفاف، تقویت‌کننده درخشش.',
  },
  hedione_sillage: {
    ar: 'مضاعف إشراق النوتات الزهرية.',
    en: 'Multiplies heart floral radiance.',
    fr: 'Multiplie l’éclat floral du cœur.',
    es: 'Multiplica el brillo floral del corazón.',
    it: 'Moltiplica lo splendore floreale del cuore.',
    de: 'Vervielfacht die florale Strahlkraft.',
    ru: 'Преумножает цветочное сияние сердца.',
    zh: '成倍增强中调花香光彩。',
    tr: 'Kalbin çiçek ışıltısını katlar.',
    fa: 'درخشش گل‌های قلب را چند برابر می‌کند.',
  },
  conditions_title: {
    ar: 'شروط بيئة التعتيق المثالية في المعمل:',
    en: 'Optimal Laboratory Aging Conditions:',
    fr: 'Conditions idéales de vieillissement :',
    es: 'Condiciones ideales de envejecimiento:',
    it: 'Condizioni ideali di invecchiamento:',
    de: 'Optimale Reifungsbedingungen:',
    ru: 'Оптимальные условия выдержки:',
    zh: '最佳陈化环境条件：',
    tr: 'İdeal dinlendirme koşulları:',
    fa: 'شرایط ایده‌آل محیط کهنه‌سازی:',
  },
  cond_temp: {
    ar: 'الحرارة المثالية (15°C - 18°C)',
    en: 'Stable Temp (15°C - 18°C)',
    fr: 'Température stable (15-18 °C)',
    es: 'Temperatura estable (15-18 °C)',
    it: 'Temperatura stabile (15-18 °C)',
    de: 'Stabile Temperatur (15-18 °C)',
    ru: 'Стабильная температура (15-18 °C)',
    zh: '恒温（15-18°C）',
    tr: 'Sabit sıcaklık (15-18 °C)',
    fa: 'دمای ثابت (۱۵-۱۸ درجه)',
  },
  cond_temp_desc: {
    ar: 'الحرارة العالية تسرع أكسدة الروابط، والبرودة المفرطة (كالمجمدات) تجمد الجزيئات وتمنع الامتزاج الكيميائي الطبيعي.',
    en: 'High heat accelerates oxidation, while freezing traps molecular esterification.',
    fr: 'La chaleur accélère l’oxydation ; le gel bloque l’estérification.',
    es: 'El calor acelera la oxidación; la congelación bloquea la esterificación.',
    it: 'Il calore accelera l’ossidazione; il congelamento blocca l’esterificazione.',
    de: 'Hitze beschleunigt die Oxidation; Frost blockiert die Veresterung.',
    ru: 'Жара ускоряет окисление; мороз блокирует этерификацию.',
    zh: '高温加速氧化，冰冻则阻碍酯化反应。',
    tr: 'Sıcaklık oksidasyonu hızlandırır; donma esterifikasyonu engeller.',
    fa: 'گرما اکسایش را سریع می‌کند؛ سرمای شدید استری‌شدن را متوقف می‌کند.',
  },
  cond_dark: {
    ar: 'الظلام التام (Amber Glass)',
    en: 'Zero UV Exposure (Amber Glass)',
    fr: 'Obscurité totale (verre ambré)',
    es: 'Oscuridad total (vidrio ámbar)',
    it: 'Buio totale (vetro ambrato)',
    de: 'Komplette Dunkelheit (Braunglas)',
    ru: 'Полная темнота (тёмное стекло)',
    zh: '完全避光（琥珀玻璃）',
    tr: 'Tam karanlık (amber cam)',
    fa: 'تاریکی مطلق (شیشه کهربایی)',
  },
  cond_dark_desc: {
    ar: 'الأشعة فوق البنفسجية UV تفكك جزيئات العطور الحساسة؛ استخدم دائماً زجاجاً عسلياً داكناً أو خزانات مظلمة.',
    en: 'UV rays degrade delicate terpenes; store in amber or violet glass chambers.',
    fr: 'Les UV dégradent les terpènes ; stockez en verre ambré ou violet.',
    es: 'Los UV degradan los terpenos; almacene en vidrio ámbar o violeta.',
    it: 'Gli UV degradano i terpeni; conservare in vetro ambrato o viola.',
    de: 'UV-Strahlen zersetzen Terpene; in Braun- oder Violettglas lagern.',
    ru: 'УФ-лучи разрушают терпены; храните в тёмном или фиолетовом стекле.',
    zh: '紫外线会分解萜烯；请用琥珀色或紫色玻璃储存。',
    tr: 'UV ışınları terpenleri bozar; amber veya mor camda saklayın.',
    fa: 'اشعه UV ترپن‌ها را تجزیه می‌کند؛ در شیشه کهربایی یا بنفش نگهداری کنید.',
  },
  cond_seal: {
    ar: 'الإغلاق المحكم وفلترة الشوائب',
    en: 'Hermetic Seal & Micro-Filtration',
    fr: 'Scellement hermétique et microfiltration',
    es: 'Sellado hermético y microfiltración',
    it: 'Sigillo ermetico e microfiltrazione',
    de: 'Luftdichter Verschluss & Mikrofiltration',
    ru: 'Герметичность и микрофильтрация',
    zh: '密封与微孔过滤',
    tr: 'Hava sızdırmaz kapatma ve mikro filtrasyon',
    fa: 'دربند محکم و میکروفیلتراسیون',
  },
  cond_seal_desc: {
    ar: 'أحكم إغلاق العبوات لمنع تبخر الإيثانول، وقم بتمرير العطر عبر ورق فلتر مخبري قبل التعبئة النهائية لصفاء ناصع.',
    en: 'Prevent ethanol loss with airtight seals; pass through lab filter paper before final bottling.',
    fr: 'Scellez hermétiquement pour éviter l’évaporation d’éthanol ; filtrez avant l’embouteillage final.',
    es: 'Selle herméticamente para evitar la pérdida de etanol; filtre antes del embotellado final.',
    it: 'Sigillare ermeticamente per evitare l’evaporazione dell’etanolo; filtrare prima dell’imbottigliamento.',
    de: 'Luftdicht verschließen gegen Ethanolverlust; vor der Abfüllung filtrieren.',
    ru: 'Герметично закрывайте от испарения этанола; фильтруйте перед финальным розливом.',
    zh: '密封以防乙醇挥发；灌装前用滤纸过滤。',
    tr: 'Etanol kaybını önlemek için hava sızdırmaz kapatın; son dolumdan önce filtreleyin.',
    fa: 'برای جلوگیری از تبخر الکل دربندی محکم؛ قبل از پرکردن نهایی فیلتر کنید.',
  },
} satisfies Record<string, LText>;

interface AgingAndFixativesGuideProps {
  currentLang?: SupportedLanguage;
  formulation?: FormulationState;
  onOpenConsultation?: (prompt: string) => void;
  onNavigateToTab?: (tab: string) => void;
}

export const AgingAndFixativesGuide: React.FC<AgingAndFixativesGuideProps> = ({
  currentLang = 'ar',
  formulation,
  onOpenConsultation,
  onNavigateToTab,
}) => {
  const rtl = isRTL(currentLang);
  const L = makeT(currentLang, S);

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

      {/* Hero Showcase Card with Generated Ingredients Image */}
      <div className="relative rounded-2xl overflow-hidden border border-stone-200/90 shadow-sm bg-stone-900 text-white">
        <div className="grid grid-cols-1 md:grid-cols-12 items-center">
          <div className="p-6 sm:p-8 md:col-span-7 space-y-3">
            <span className="text-amber-400 text-xs font-semibold uppercase tracking-wider block">
              {L('secrets_badge')}
            </span>
            <h3 className="text-2xl sm:text-3xl font-bold font-serif-luxury text-white">
              {L('maturation_title')}
            </h3>
            <p className="text-stone-300 text-xs sm:text-sm leading-relaxed">
              {L('maturation_intro')}
              <br />
              <strong>{L('maturation_lbl')}</strong> {L('maturation_desc')}
              <br />
              <strong>{L('maceration_lbl')}</strong> {L('maceration_desc')}
            </p>
          </div>
          <div className="md:col-span-5 h-64 md:h-full relative">
            <img
              src={ingredientsImg}
              alt={L('img_alt')}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>

      {/* FEATURED TOOL: MACERATION TIME SIMULATOR */}
      <MacerationTimeSimulator
        currentLang={currentLang}
        initialMacerationDays={formulation ? (formulation.concentrationType === 'extrait' ? 50 : 30) : 30}
        formulaTitle={L('simulator_formula_title')}
        batchCode="BATCH-2026-SHAM"
        onOpenConsultation={onOpenConsultation}
      />

      {/* Grid: Maceration Timeline by Fragrance Family */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-700" />
          <h3 className="font-bold text-stone-950 text-base">
            {L('timeline_title')}
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 1. Fresh / Citrus */}
          <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <span className="font-bold text-stone-900 text-sm">
                {L('fam_citrus')}
              </span>
              <span className="text-xs font-mono-numbers font-semibold text-amber-800">
                {L('fam_citrus_days')}
              </span>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              {L('fam_citrus_desc')}
            </p>
            <div className="p-2.5 bg-stone-50 rounded-lg text-[11px] text-stone-500">
              {L('fam_citrus_ex')}
            </div>
          </div>

          {/* 2. Floral / Gourmand */}
          <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <span className="font-bold text-stone-900 text-sm">
                {L('fam_floral')}
              </span>
              <span className="text-xs font-mono-numbers font-semibold text-amber-800">
                {L('fam_floral_days')}
              </span>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              {L('fam_floral_desc')}
            </p>
            <div className="p-2.5 bg-stone-50 rounded-lg text-[11px] text-stone-500">
              {L('fam_floral_ex')}
            </div>
          </div>

          {/* 3. Oriental / Woody / Oud */}
          <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <span className="font-bold text-stone-900 text-sm">
                {L('fam_oriental')}
              </span>
              <span className="text-xs font-mono-numbers font-semibold text-amber-800">
                {L('fam_oriental_days')}
              </span>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              {L('fam_oriental_desc')}
            </p>
            <div className="p-2.5 bg-stone-50 rounded-lg text-[11px] text-stone-500">
              {L('fam_oriental_ex')}
            </div>
          </div>
        </div>
      </div>

      {/* Fixatives Directory Table */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center gap-2">
          <Droplet className="w-5 h-5 text-amber-700" />
          <h3 className="font-bold text-stone-950 text-base">
            {L('fixatives_title')}
          </h3>
        </div>

        <div className="bg-white rounded-xl border border-stone-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className={`w-full ${rtl ? 'text-right' : 'text-left'} text-xs`}>
              <thead className="bg-stone-100 text-stone-700 font-semibold border-b border-stone-200">
                <tr>
                  <th className="py-3 px-4">{L('th_fixative')}</th>
                  <th className="py-3 px-4">{L('th_ratio')}</th>
                  <th className="py-3 px-4">{L('th_role')}</th>
                  <th className="py-3 px-4">{L('th_sillage')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                <tr>
                  <td className="py-3 px-4 font-bold text-stone-900">
                    {L('row_dpg')}
                  </td>
                  <td className="py-3 px-4 font-mono-numbers font-semibold">0.5% - 2.0%</td>
                  <td className="py-3 px-4 text-stone-600">
                    {L('dpg_role')}
                  </td>
                  <td className="py-3 px-4 text-stone-500">
                    {L('dpg_sillage')}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-stone-900">
                    {L('row_ipm')}
                  </td>
                  <td className="py-3 px-4 font-mono-numbers font-semibold">0.5% - 1.5%</td>
                  <td className="py-3 px-4 text-stone-600">
                    {L('ipm_role')}
                  </td>
                  <td className="py-3 px-4 text-stone-500">
                    {L('ipm_sillage')}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-stone-900">
                    {L('row_isoe')}
                  </td>
                  <td className="py-3 px-4 font-mono-numbers font-semibold">1.0% - 8.0%</td>
                  <td className="py-3 px-4 text-stone-600">
                    {L('isoe_role')}
                  </td>
                  <td className="py-3 px-4 text-amber-900 font-medium">
                    {L('isoe_sillage')}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-stone-900">
                    {L('row_ambroxan')}
                  </td>
                  <td className="py-3 px-4 font-mono-numbers font-semibold">0.2% - 2.0%</td>
                  <td className="py-3 px-4 text-stone-600">
                    {L('amb_role')}
                  </td>
                  <td className="py-3 px-4 text-amber-900 font-medium">
                    {L('amb_sillage')}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-stone-900">
                    {L('row_hedione')}
                  </td>
                  <td className="py-3 px-4 font-mono-numbers font-semibold">1.0% - 5.0%</td>
                  <td className="py-3 px-4 text-stone-600">
                    {L('hedione_role')}
                  </td>
                  <td className="py-3 px-4 text-stone-500">
                    {L('hedione_sillage')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Laboratory Golden Rules & Environment Control */}
      <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200 space-y-4">
        <h4 className="font-bold text-stone-950 text-sm flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-700" />
          <span>{L('conditions_title')}</span>
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-stone-700">
          <div className="bg-white p-4 rounded-xl border border-stone-200/70 space-y-1">
            <div className="font-bold text-stone-900 flex items-center gap-1.5">
              <Thermometer className="w-4 h-4 text-amber-700" />
              <span>{L('cond_temp')}</span>
            </div>
            <p className="text-stone-500 text-[11px] leading-relaxed">
              {L('cond_temp_desc')}
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-stone-200/70 space-y-1">
            <div className="font-bold text-stone-900 flex items-center gap-1.5">
              <SunDim className="w-4 h-4 text-amber-700" />
              <span>{L('cond_dark')}</span>
            </div>
            <p className="text-stone-500 text-[11px] leading-relaxed">
              {L('cond_dark_desc')}
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-stone-200/70 space-y-1">
            <div className="font-bold text-stone-900 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-amber-700" />
              <span>{L('cond_seal')}</span>
            </div>
            <p className="text-stone-500 text-[11px] leading-relaxed">
              {L('cond_seal_desc')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

