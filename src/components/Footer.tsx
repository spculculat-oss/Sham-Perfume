import React from 'react';
import { Newspaper, Sparkles, Award, Globe, Check, Languages } from 'lucide-react';
import { SupportedLanguage, SUPPORTED_LANGUAGES, LanguageConfig } from '../types/i18n';
import { LText, makeT, fmt } from '../utils/localize';
import { isRTL } from '../utils/localizedContent';


const S = {
  brand_name: { ar: 'صمم عطرك مع شام', en: 'Design Your Perfume with Sham', fr: 'Créez votre parfum avec Sham', es: 'Diseña tu perfume con Sham', it: 'Crea il tuo profumo con Sham', de: 'Gestalten Sie Ihr Parfüm mit Sham', ru: 'Создайте свой аромат с Sham', zh: '与 Sham 一同设计您的香水', tr: 'Parfümünüzü Sham ile tasarlayın', fa: 'عطر خود را با شام بسازید' },
  brand_p: { ar: 'المنصة المتكاملة لصناع ومصممي العطور والمعامل ومتاجر الزيوت؛ تضم حاسبة التراكيز، أشهر الأكوردات العالمية، موسوعة المواد الخام الكيميائية والطبيعية، ومرصد أخبار العطور العالمية.', en: 'The integrated platform for perfumers, labs, and oil boutiques: concentration calculators, world-class accords, a raw-materials encyclopedia, and a global fragrance news observatory.', fr: 'La plateforme intégrée des parfumeurs, laboratoires et boutiques d’huiles : calculateurs de concentration, accords emblématiques, encyclopédie des matières premières et observatoire des actualités.', es: 'La plataforma integrada para perfumistas, laboratorios y boutiques de aceites: calculadoras de concentración, acordes icónicos, enciclopedia de materias primas y observatorio de noticias.', it: 'La piattaforma integrata per profumieri, laboratori e boutique di oli: calcolatori di concentrazione, accordi iconici, enciclopedia delle materie prime e osservatorio delle notizie.', de: 'Die integrierte Plattform für Parfümeure, Labore und Öl-Boutiquen: Konzentrationsrechner, ikonische Akkorde, Rohstoff-Enzyklopädie und Duftnews-Observatorium.', ru: 'Единая платформа для парфюмеров, лабораторий и магазинов масел: калькуляторы концентраций, знаменитые аккорды, энциклопедия сырья и обзоры мировых новостей.', zh: '面向调香师、实验室与精油精品店的一体化平台：浓度计算器、世界经典香调、原料百科与全球香水资讯台。', tr: 'Parfümörler, laboratuvarlar ve yağ butikleri için entegre platform: konsantrasyon hesaplayıcıları, ikonik akorlar, hammadde ansiklopedisi ve küresel haber gözlemevi.', fa: 'پلتفرم یکپارچه عطرسازان، آزمایشگاه‌ها و فروشگاه‌های روغن: ماشین‌حساب غلظت، آکوردهای مشهور جهان، دانشنامه مواد اولیه و رصدخانه اخبار عطر.' },
  ai_badge: { ar: 'مجهزة بخبير المعمل الذكي (الخبير شاهين AI)', en: 'Powered by the smart lab expert (Master Shahin AI)', fr: 'Propulsé par l’expert laboratoire intelligent (Maître Shahin IA)', es: 'Impulsado por el experto inteligente del laboratorio (Maestro Shahin IA)', it: 'Con l’esperto di laboratorio intelligente (Maestro Shahin IA)', de: 'Mit dem intelligenten Laborexperten (Meister Shahin KI)', ru: 'Оснащено умным экспертом лаборатории (мастер Шахин ИИ)', zh: '配备智能实验室专家（Shahin 大师 AI）', tr: 'Akıllı laboratuvar uzmanıyla (Usta Shahin YZ) güçlendirilmiştir', fa: 'مجهز به متخصص هوشمند آزمایشگاه (استاد شاهین AI)' },
  news_title: { ar: 'الأخبار والمكتبات العالمية', en: 'News & World Libraries', fr: 'Actualités et bibliothèques mondiales', es: 'Noticias y bibliotecas mundiales', it: 'Notizie e biblioteche mondiali', de: 'News & Weltbibliotheken', ru: 'Новости и мировые библиотеки', zh: '资讯与世界图书馆', tr: 'Haberler ve dünya kütüphaneleri', fa: 'اخبار و کتابخانه‌های جهانی' },
  link_home: { ar: 'الرئيسية (بوابة منافذ وأقسام المعمل الـ 12)', en: 'Home (12 Lab Portals Gateway)', fr: 'Accueil (portail des 12 laboratoires)', es: 'Inicio (portal de los 12 laboratorios)', it: 'Home (portale dei 12 laboratori)', de: 'Startseite (Portal der 12 Labore)', ru: 'Главная (портал 12 разделов)', zh: '首页（12 个实验室门户）', tr: 'Ana sayfa (12 laboratuvar portalı)', fa: 'خانه (درگاه ۱۲ بخش آزمایشگاه)' },
  link_news: { ar: 'آخر أخبار العطور في العالم (ميلانو، دبي، غراس)', en: 'World Fragrance News (Milan, Dubai, Grasse)', fr: 'Actualités mondiales (Milan, Dubaï, Grasse)', es: 'Noticias globales (Milán, Dubái, Grasse)', it: 'Notizie mondiali (Milano, Dubai, Grasse)', de: 'Weltweite Duftnews (Mailand, Dubai, Grasse)', ru: 'Мировые новости парфюмерии (Милан, Дубай, Грас)', zh: '全球香水资讯（米兰、迪拜、格拉斯）', tr: 'Küresel parfüm haberleri (Milano, Dubai, Grasse)', fa: 'اخبار جهانی عطر (میلان، دبی، گراس)' },
  link_world: { ar: 'أشهر العطور العالمية (بكرات روج، أفينتوس، توم فورد)', en: 'Iconic World Perfumes (Baccarat Rouge, Aventus, Tom Ford)', fr: 'Parfums iconiques (Baccarat Rouge, Aventus, Tom Ford)', es: 'Perfumes icónicos (Baccarat Rouge, Aventus, Tom Ford)', it: 'Profumi iconici (Baccarat Rouge, Aventus, Tom Ford)', de: 'Ikoniche Parfüms (Baccarat Rouge, Aventus, Tom Ford)', ru: 'Знаменитые ароматы (Baccarat Rouge, Aventus, Tom Ford)', zh: '世界名香（Baccarat Rouge、Aventus、Tom Ford）', tr: 'İkonik parfümler (Baccarat Rouge, Aventus, Tom Ford)', fa: 'عطرهای مشهور جهان (باکارا روژ، آونتوس، تام فورد)' },
  link_raw: { ar: 'موسوعة المواد الخام، المذيبات، والأمبروكسان', en: 'Raw Materials, Solvents & Ambroxan Encyclopedia', fr: 'Encyclopédie des matières premières, solvants et ambroxan', es: 'Enciclopedia de materias primas, disolventes y ambroxán', it: 'Enciclopedia di materie prime, solventi e ambroxan', de: 'Enzyklopädie: Rohstoffe, Lösemittel & Ambroxan', ru: 'Энциклопедия сырья, растворителей и амброксана', zh: '原料、溶剂与龙涎香醚百科', tr: 'Hammadde, çözücü ve ambroksan ansiklopedisi', fa: 'دانشنامه مواد اولیه، حلال‌ها و آمبروکسان' },
  link_ai: { ar: 'مجلس الخبير شاهين · استشارة الذكاء الاصطناعي', en: 'Master Shahin Council · AI Consultation', fr: 'Conseil du Maître Shahin · consultation IA', es: 'Consejo del Maestro Shahin · consulta IA', it: 'Consiglio del Maestro Shahin · consulenza IA', de: 'Meister-Shahin-Rat · KI-Beratung', ru: 'Совет мастера Шахина · ИИ-консультации', zh: 'Shahin 大师议会 · AI 咨询', tr: 'Usta Shahin konseyi · YZ danışmanı', fa: 'شورای استاد شاهین · مشاوره هوش مصنوعی' },
  tools_title: { ar: 'الحاسبات والمعايير المعملية', en: 'Lab Calculators & Standards', fr: 'Calculateurs et normes de laboratoire', es: 'Calculadoras y normas de laboratorio', it: 'Calcolatori e norme di laboratorio', de: 'Laborrechner & Normen', ru: 'Калькуляторы и лабораторные стандарты', zh: '实验室计算器与标准', tr: 'Laboratuvar hesaplayıcıları ve standartlar', fa: 'ماشین‌حساب‌ها و استانداردهای آزمایشگاهی' },
  link_conc: { ar: 'حاسبة نسب التركيز وتعبئة الزجاجات (Extrait, EDP, EDT)', en: 'Concentration & Bottling Calculator (Extrait, EDP, EDT)', fr: 'Calculateur de concentration et embouteillage (Extrait, EDP, EDT)', es: 'Calculadora de concentración y embotellado (Extrait, EDP, EDT)', it: 'Calcolatore di concentrazione e imbottigliamento (Extrait, EDP, EDT)', de: 'Konzentrations- & Abfüllrechner (Extrait, EDP, EDT)', ru: 'Калькулятор концентрации и розлива (Extrait, EDP, EDT)', zh: '浓度与灌装计算器（Extrait、EDP、EDT）', tr: 'Konsantrasyon ve dolum hesaplayıcısı (Extrait, EDP, EDT)', fa: 'ماشین‌حساب غلظت و پرکردن بطری (Extrait, EDP, EDT)' },
  link_pyramid: { ar: 'حاسبة الهرم العطري وتوافق النوتات', en: 'Fragrance Pyramid & Note Compatibility Calculator', fr: 'Calculateur de pyramide olfactive et compatibilité', es: 'Calculadora de pirámide olfativa y compatibilidad', it: 'Calcolatore di piramide olfattiva e compatibilità', de: 'Duftpyramiden- & Kompatibilitätsrechner', ru: 'Калькулятор пирамиды и совместимости нот', zh: '香调金字塔与香气协调计算器', tr: 'Koku piramidi ve nota uyum hesaplayıcısı', fa: 'ماشین‌حساب هرم عطری و سازگاری نت‌ها' },
  link_alcohol: { ar: 'حاسبة تخفيف تركيز الكحول (قانون التخفيف C₁V₁)', en: 'Alcohol Dilution Calculator (C₁V₁ Rule)', fr: 'Calculateur de dilution d’alcool (règle C₁V₁)', es: 'Calculadora de dilución de alcohol (regla C₁V₁)', it: 'Calcolatore di diluzione dell’alcol (regola C₁V₁)', de: 'Alkoholverdünnungsrechner (C₁V₁-Regel)', ru: 'Калькулятор разбавления спирта (правило C₁V₁)', zh: '酒精稀释计算器（C₁V₁ 法则）', tr: 'Alkol seyreltme hesaplayıcısı (C₁V₁ kuralı)', fa: 'ماشین‌حساب رقیق‌سازی الکل (قانون C₁V₁)' },
  link_costing: { ar: 'حاسبة التكاليف الصناعية وهوامش الأرباح', en: 'Industrial Costing & Profit Margin Calculator', fr: 'Calculateur de coûts industriels et marges', es: 'Calculadora de costes industriales y márgenes', it: 'Calcolatore di costi industriali e margini', de: 'Industriekosten- & Margenrechner', ru: 'Калькулятор себестоимости и маржи', zh: '工业成本与利润率计算器', tr: 'Endüstriyel maliyet ve kâr marjı hesaplayıcısı', fa: 'ماشین‌حساب هزینه‌های صنعتی و حاشیه سود' },
  link_guide: { ar: 'دليل التعتيق وجداول المثبتات الكيميائية', en: 'Maceration Guide & Chemical Fixative Tables', fr: 'Guide de maturation et tables de fixateurs', es: 'Guía de maceración y tablas de fijadores', it: 'Guida alla maturazione e tabelle dei fissativi', de: 'Mazerationsleitfaden & Fixativtabellen', ru: 'Руководство по настаиванию и таблицы фиксаторов', zh: '熟成指南与化学固定剂表', tr: 'Maserasyon rehberi ve sabitleyici tabloları', fa: 'راهنمای تعریف و جداول ثابت‌کننده‌های شیمیایی' },
  link_maceration: { ar: 'محاكي التعتيق الزمني وتاريخ نضوج العطر', en: 'Timed Maceration Simulator & Maturity Date Forecast', fr: 'Simulateur de maturation et date de maturité', es: 'Simulador de maceración y fecha de madurez', it: 'Simulatore di maturazione e data di maturità', de: 'Mazerationssimulator & Reifedatum', ru: 'Симулятор настаивания и дата готовности', zh: '熟成计时模拟器与成熟日期预测', tr: 'Zamanlı maserasyon simülatörü ve olgunluk tarihi', fa: 'شبیه‌ساز زمانی تعریف و تاریخ رسیدگی عطر' },
  new_badge: { ar: 'جديد', en: 'New', fr: 'Nouveau', es: 'Nuevo', it: 'Nuovo', de: 'Neu', ru: 'Новое', zh: '新', tr: 'Yeni', fa: 'جدید' },
  lang_title: { ar: 'خانة تغيير لغة المنصة', en: 'Platform Language Selector', fr: 'Sélecteur de langue de la plateforme', es: 'Selector de idioma de la plataforma', it: 'Selettore lingua della piattaforma', de: 'Sprachauswahl der Plattform', ru: 'Выбор языка платформы', zh: '平台语言选择器', tr: 'Platform dil seçici', fa: 'انتخابگر زبان پلتفرم' },
  lang_sub: { ar: 'اختر لغة العرض المناسبة لك مع التبديل التلقائي لاتجاه النصوص والواجهة (RTL ⇄ LTR)', en: 'Choose your display language with automatic text and layout direction switching (RTL ⇄ LTR)', fr: 'Choisissez votre langue d’affichage avec bascule automatique du sens du texte (RTL ⇄ LTR)', es: 'Elige tu idioma de visualización con cambio automático de dirección (RTL ⇄ LTR)', it: 'Scegli la lingua di visualizzazione con inversione automatica della direzione (RTL ⇄ LTR)', de: 'Wählen Sie Ihre Anzeigesprache mit automatischer Richtungsänderung (RTL ⇄ LTR)', ru: 'Выберите язык интерфейса с автоматическим переключением направления текста (RTL ⇄ LTR)', zh: '选择您的显示语言，自动切换文字与界面方向（RTL ⇄ LTR）', tr: 'Yön otomatik değişimiyle (RTL ⇄ LTR) görüntüleme dilinizi seçin', fa: 'زبان نمایش خود را با تغییر خودکار جهت متن و رابط (RTL ⇄ LTR) انتخاب کنید' },
  copyright_tpl: { ar: 'جميع الحقوق محفوظة © {y} صمم عطرك مع شام (Sham Perfume Suite).', en: 'All rights reserved © {y} Design Your Perfume with Sham (Sham Perfume Suite).', fr: 'Tous droits réservés © {y} Créez votre parfum avec Sham (Sham Perfume Suite).', es: 'Todos los derechos reservados © {y} Diseña tu perfume con Sham (Sham Perfume Suite).', it: 'Tutti i diritti riservati © {y} Crea il tuo profumo con Sham (Sham Perfume Suite).', de: 'Alle Rechte vorbehalten © {y} Gestalten Sie Ihr Parfüm mit Sham (Sham Perfume Suite).', ru: 'Все права защищены © {y} Создайте свой аромат с Sham (Sham Perfume Suite).', zh: '版权所有 © {y} 与 Sham 一同设计您的香水（Sham Perfume Suite）。', tr: 'Tüm hakları saklıdır © {y} Parfümünüzü Sham ile tasarlayın (Sham Perfume Suite).', fa: 'همه حقوق محفوظ است © {y} عطر خود را با شام بسازید (Sham Perfume Suite).' },
  badge_scale: { ar: 'دقة ميزان المعمل (0.01g)', en: 'Lab scale precision (0.01g)', fr: 'Précision de balance (0,01 g)', es: 'Precisión de balanza (0.01g)', it: 'Precisione della bilancia (0.01g)', de: 'Waagengenauigkeit (0,01 g)', ru: 'Точность весов (0.01 г)', zh: '实验室天平精度（0.01g）', tr: 'Terazi hassasiyeti (0.01g)', fa: 'دقت ترازوی آزمایشگاه (۰.۰۱ گرم)' },
  badge_ifra: { ar: 'معايير IFRA 51 الدولية', en: 'IFRA 51 International Standards', fr: 'Normes internationales IFRA 51', es: 'Normas internacionales IFRA 51', it: 'Norme internazionali IFRA 51', de: 'IFRA 51 internationale Normen', ru: 'Международные стандарты IFRA 51', zh: 'IFRA 51 国际标准', tr: 'IFRA 51 uluslararası standartları', fa: 'استانداردهای بین‌المللی IFRA 51' },
  badge_encyclopedia: { ar: 'موسوعة الخامات العالمية', en: 'World Raw Materials Encyclopedia', fr: 'Encyclopédie mondiale des matières premières', es: 'Enciclopedia mundial de materias primas', it: 'Enciclopedia mondiale delle materie prime', de: 'Weltweite Rohstoff-Enzyklopädie', ru: 'Мировая энциклопедия сырья', zh: '世界原料百科', tr: 'Dünya hammadde ansiklopedisi', fa: 'دانشنامه جهانی مواد اولیه' },
  badge_observatory: { ar: 'مرصد أخبار العطور', en: 'Fragrance News Observatory', fr: 'Observatoire des actualités parfum', es: 'Observatorio de noticias del perfume', it: 'Osservatorio delle notizie sul profumo', de: 'Duftnews-Observatorium', ru: 'Обсерватория новостей парфюмерии', zh: '香水资讯观察站', tr: 'Parfüm haber gözlemevi', fa: 'رصدخانه اخبار عطر' },
} satisfies Record<string, LText>;

interface FooterProps {
  setActiveTab: (tab: string) => void;
  currentLang?: SupportedLanguage;
  onSelectLanguage?: (lang: SupportedLanguage) => void;
}

export const Footer: React.FC<FooterProps> = ({
  setActiveTab,
  currentLang = 'ar',
  onSelectLanguage,
}) => {
  const rtl = isRTL(currentLang);
  const L = makeT(currentLang, S);
  return (
    <footer className="bg-stone-950 text-stone-300 border-t border-stone-800 mt-20 pt-14 pb-12 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-10 border-b border-stone-850 text-sm">
          
          {/* Brand Col */}
          <div className="md:col-span-4 space-y-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-600 to-amber-700 text-stone-950 flex items-center justify-center font-serif-luxury font-bold text-lg shadow-md">
                شام
              </div>
              <span className="text-xl font-extrabold text-white font-serif-luxury tracking-wide">
                {L('brand_name')}
              </span>
            </div>
            <p className="text-stone-400 text-xs leading-relaxed max-w-sm">
              {L('brand_p')}
            </p>
            <div className="pt-2 flex items-center gap-2 text-xs text-amber-400">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>{L('ai_badge')}</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="md:col-span-4 space-y-3">
            <div className="font-bold text-white text-xs tracking-wider uppercase flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-amber-400" />
              <span>{L('news_title')}</span>
            </div>
            <ul className="space-y-2 text-xs text-stone-400">
              <li>
                <button
                  onClick={() => setActiveTab('home')}
                  className="hover:text-amber-400 transition-colors cursor-pointer flex items-center gap-1.5 text-amber-200 font-semibold"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span>{L('link_home')}</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveTab('perfume_news')}
                  className="hover:text-amber-400 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>{L('link_news')}</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveTab('world_perfumes')}
                  className="hover:text-amber-400 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>{L('link_world')}</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveTab('raw_materials')}
                  className="hover:text-amber-400 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>{L('link_raw')}</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveTab('master_ai')}
                  className="hover:text-amber-400 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>{L('link_ai')}</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Tools */}
          <div className="md:col-span-4 space-y-3">
            <div className="font-bold text-white text-xs tracking-wider uppercase">
              {L('tools_title')}
            </div>
            <ul className="space-y-2 text-xs text-stone-400">
              <li>
                <button
                  onClick={() => setActiveTab('concentration')}
                  className="hover:text-amber-400 transition-colors cursor-pointer"
                >
                  {L('link_conc')}
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveTab('pyramid')}
                  className="hover:text-amber-400 transition-colors cursor-pointer"
                >
                  {L('link_pyramid')}
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveTab('alcohol')}
                  className="hover:text-amber-400 transition-colors cursor-pointer"
                >
                  {L('link_alcohol')}
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveTab('costing')}
                  className="hover:text-amber-400 transition-colors cursor-pointer"
                >
                  {L('link_costing')}
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveTab('guide')}
                  className="hover:text-amber-400 transition-colors cursor-pointer"
                >
                  {L('link_guide')}
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveTab('maceration_simulator')}
                  className="hover:text-amber-400 transition-colors cursor-pointer flex items-center gap-1.5 text-amber-300 font-semibold"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span>{L('link_maceration')}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">{L('new_badge')}</span>
                </button>
              </li>
            </ul>
          </div>

        </div>

        {/* Dedicated Language Switcher Section: خانة تغيير لغة المنصة */}
        <div className="py-7 border-b border-stone-850">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
                <Languages className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-bold text-white flex items-center gap-2">
                  <span>{L('lang_title')}</span>
                  <span className="text-[10px] text-amber-400 font-normal border border-amber-500/30 px-1.5 py-0.2 rounded-full">
                    Platform Language ({SUPPORTED_LANGUAGES.length} Languages)
                  </span>
                </span>
                <span className="text-xs text-stone-400 block mt-0.5">
                  {L('lang_sub')}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
            {SUPPORTED_LANGUAGES.map((lang: LanguageConfig) => {
              const isActive = lang.code === currentLang;
              return (
                <button
                  key={lang.code}
                  onClick={() => onSelectLanguage && onSelectLanguage(lang.code)}
                  className={`p-2.5 rounded-xl border ${rtl ? 'text-right' : 'text-left'} transition-all flex items-center justify-between cursor-pointer group ${
                    isActive
                      ? 'bg-amber-950/60 border-amber-500 text-white shadow-sm ring-1 ring-amber-500/30'
                      : 'bg-stone-900/60 hover:bg-stone-900 border-stone-800 hover:border-amber-700/60 text-stone-300 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-base group-hover:scale-110 transition-transform">
                      {lang.flag}
                    </span>
                    <div className="truncate">
                      <div className="font-bold text-xs truncate">{lang.nativeName}</div>
                      <div className="text-[10px] text-stone-500 truncate font-mono">
                        {lang.name} · {lang.dir.toUpperCase()}
                      </div>
                    </div>
                  </div>
                  {isActive && (
                    <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 stroke-[3]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500">
          <div>
            {fmt(L('copyright_tpl'), { y: new Date().getFullYear() })}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-stone-400">
            <span>{L('badge_scale')}</span>
            <span aria-hidden="true">·</span>
            <span>{L('badge_ifra')}</span>
            <span aria-hidden="true">·</span>
            <span>{L('badge_encyclopedia')}</span>
            <span aria-hidden="true">·</span>
            <span>{L('badge_observatory')}</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
