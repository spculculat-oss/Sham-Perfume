import React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Beaker,
  Scale,
  Newspaper,
  Award,
  FlaskConical,
  Flame,
} from 'lucide-react';
import heroImg from '../assets/images/hero_luxury_perfume_1791692409081.jpg';
import newsImg from '../assets/images/luxury_perfume_exhibition_1791696134494.jpg';

import { SupportedLanguage } from '../types/i18n';
import { t } from '../utils/i18n';
import { isRTL } from '../utils/localizedContent';
import { LText, makeT } from '../utils/localize';

interface HeroProps {
  onQuickStart: (mode: string) => void;
  currentLang?: SupportedLanguage;
}

const S = {
  news_badge: {
    ar: 'أخبار العطور العالمية',
    en: 'World Perfume Trends',
    fr: 'Actualités mondiales du parfum',
    es: 'Tendencias mundiales del perfume',
    it: 'Tendenze mondiali del profumo',
    de: 'Globale Parfüm-Trends',
    ru: 'Мировые тренды парфюмерии',
    zh: '全球香水资讯',
    tr: 'Dünya parfüm trendleri',
    fa: 'اخبار جهانی عطر',
  },
  news_ticker: {
    ar: 'إيسنس ميلانو وبيوتي وورلد: تصدر نوتات الشاي الصيني، الورد الطبيعي، والعود المعتق لعام 2026.',
    en: 'Esxence Milan & Beautyworld: Smoked tea, natural bio-rose, and aged oud prevail in 2026.',
    fr: 'Esxence Milan et Beautyworld : le thé fumé, la rose bio et l’oud vieillé dominent 2026.',
    es: 'Esxence Milán y Beautyworld: el té ahumado, la rosa bio y el oud añejo dominan 2026.',
    it: 'Esxence Milano e Beautyworld: tè affumicato, rosa bio e oud invecchiato dominano il 2026.',
    de: 'Esxence Mailand & Beautyworld: Rauchtee, Bio-Rose und gereiftes Oud dominieren 2026.',
    ru: 'Esxence Милан и Beautyworld: копчёный чай, био-роза и выдержанный уд доминируют в 2026 году.',
    zh: '米兰 Esxence 与迪拜 Beautyworld：烟熏茶、天然生物玫瑰与陈化乌木领衔 2026。',
    tr: 'Esxence Milano ve Beautyworld: 2026’da dumanlı çay, bio gül ve yaşlı ud öne çıkıyor.',
    fa: 'اسکسنس میلان و بیوتی‌ورلد: چای دودی، گل محمدی طبیعی و عود کهنه در صدر سال ۲۰۲۶.',
  },
  explore_news: {
    ar: 'استعراض الأخبار والصيحات',
    en: 'Explore Trends & Reports',
    fr: 'Explorer les tendances et rapports',
    es: 'Explorar tendencias e informes',
    it: 'Esplora tendenze e report',
    de: 'Trends & Berichte entdecken',
    ru: 'Смотреть тренды и отчёты',
    zh: '浏览趋势与报道',
    tr: 'Trend ve raporları keşfet',
    fa: 'مشاهده اخبار و روندها',
  },
  pro_badge: {
    ar: 'المنصة الاحترافية الأولى لخبراء ومصممي العطور',
    en: 'Premier Professional Suite for Master Perfumers',
    fr: 'La suite professionnelle de référence des maîtres parfumeurs',
    es: 'La suite profesional líder para maestros perfumistas',
    it: 'La suite professionale di riferimento per mastri profumieri',
    de: 'Die professionelle Suite für Meister-Parfümeure',
    ru: 'Ведущая профессиональная платформа для мастеров-парфюмеров',
    zh: '调香大师首选专业平台',
    tr: 'Usta parfümörler için birinci profesyonel platform',
    fa: 'نخستین پلتفرم حرفه‌ای برای خبرگان و طراحان عطر',
  },
  feat_gravity: {
    ar: 'دقة الكثافة النوعية (g / ml)',
    en: 'Specific Gravity Density (g/ml)',
    fr: 'Précision de densité (g/ml)',
    es: 'Precisión de densidad (g/ml)',
    it: 'Precisione di densità (g/ml)',
    de: 'Dichtegenauigkeit (g/ml)',
    ru: 'Точность плотности (г/мл)',
    zh: '比重密度精度 (g/ml)',
    tr: 'Yoğunluk hassasiyeti (g/ml)',
    fa: 'دقت چگالی ویژه (گرم/میلی‌لیتر)',
  },
  feat_ifra: {
    ar: 'تحديثات IFRA ومعايير السلامة',
    en: 'IFRA Standard Compliance',
    fr: 'Conformité aux normes IFRA',
    es: 'Cumplimiento de normas IFRA',
    it: 'Conformità agli standard IFRA',
    de: 'IFRA-Normenkonformität',
    ru: 'Соответствие стандартам IFRA',
    zh: 'IFRA 标准合规',
    tr: 'IFRA standart uyumu',
    fa: 'رعایت استانداردهای IFRA',
  },
  feat_formulas: {
    ar: 'أشهر الوصفات العالمية والأخبار',
    en: 'Iconic Formulas & Trends',
    fr: 'Formules emblématiques & tendances',
    es: 'Fórmulas icónicas y tendencias',
    it: 'Formule iconiche e tendenze',
    de: 'Ikonische Formeln & Trends',
    ru: 'Знаковые формулы и тренды',
    zh: '经典配方与趋势',
    tr: 'İkonik formüller ve trendler',
    fa: 'فرمول‌های معروف جهانی و اخبار',
  },
  atelier_label: {
    ar: 'معمل صمم عطرك مع شام الحرفي',
    en: 'Sham Haute Parfumerie Atelier',
    fr: 'Atelier Sham Haute Parfumerie',
    es: 'Atelier Sham Haute Parfumerie',
    it: 'Atelier Sham Haute Parfumerie',
    de: 'Sham Haute-Parfumerie-Atelier',
    ru: 'Ателье Sham Haute Parfumerie',
    zh: 'Sham 高定香水工坊',
    tr: 'Sham Haute Parfumerie Atölyesi',
    fa: 'کارگاه عطرسازی حرفه‌ای شام',
  },
  quote: {
    ar: '«العطر هو الذاكرة التي لا تشيخ.. نصنعه بالنسب المحسوبة والشغف الخالص»',
    en: '«Fragrance is memory that never ages.. crafted with calibrated precision and pure passion»',
    fr: '«Le parfum est un souvenir qui ne vieillit jamais.. façonné avec précision et passion pure»',
    es: '«El perfume es memoria que nunca envejece.. creado con precisión calibrada y pasión pura»',
    it: '«Il profumo è un ricordo che non invecchia mai.. creato con precisione calibrata e pura passione»',
    de: '„Duft ist Erinnerung, die nie altert.. geschaffen mit kalibrierter Präzision und reiner Leidenschaft“',
    ru: '«Аромат — это память, которая не стареет.. создан с выверенной точностью и чистой страстью»',
    zh: '「香气是永不老去的记忆……以精准配比与纯粹热忱精心缔造」',
    tr: '«Parfüm hiç yaşlanmayan bir hatıradır.. hesaplı hassasiyet ve saf tutkuyla üretilir»',
    fa: '«عطر خاطره‌ای است که هرگز پیر نمی‌شود.. آن را با نسبت‌های دقیق و اشتیاقی خالص می‌سازیم»',
  },
  balance_badge: {
    ar: 'دقة الميزان الكيميائي',
    en: 'Analytical Balance 0.01g',
    fr: 'Balance analytique 0,01g',
    es: 'Balanza analítica 0.01g',
    it: 'Bilancia analitica 0.01g',
    de: 'Analysenwaage 0.01g',
    ru: 'Аналитические весы 0.01g',
    zh: '分析天平 0.01g',
    tr: 'Analitik terazi 0.01g',
    fa: 'دقت ترازوی تحلیلی ۰.۰۱g',
  },
  density_badge: {
    ar: 'حساب كثافة الزيت 0.92g/ml',
    en: 'Oil Density Calibrated 0.92g/ml',
    fr: 'Densité d’huile calibrée 0,92 g/ml',
    es: 'Densidad de aceite calibrada 0.92g/ml',
    it: 'Densità olio calibrata 0.92g/ml',
    de: 'Öldichte kalibriert 0.92g/ml',
    ru: 'Плотность масла откалибрована 0.92 г/мл',
    zh: '精油密度校准 0.92g/ml',
    tr: 'Yağ yoğunluğu kalibre 0.92g/ml',
    fa: 'چگالی روغن کالیبره ۰.۹۲ g/ml',
  },
  kpi_strengths: {
    ar: 'مستويات تركيز قياسية (Extrait إلى Mist)',
    en: 'Standard Strengths (Extrait to Mist)',
    fr: 'Concentrations standards (Extrait à Mist)',
    es: 'Concentraciones estándar (Extrait a Mist)',
    it: 'Concentrazioni standard (da Extrait a Mist)',
    de: 'Standard-Konzentrationen (Extrait bis Mist)',
    ru: 'Стандартные концентрации (от Extrait до Mist)',
    zh: '标准浓度等级（浓香精至清香水）',
    tr: 'Standart konsantrasyonlar (Extrait’ten Mist’e)',
    fa: 'سطوح غلظت استاندارد (از اکستریت تا میست)',
  },
  kpi_precision: {
    ar: 'دقة ميزان المعمل بالكثافة النوعية',
    en: 'Gravimetric 0.01g Scale Precision',
    fr: 'Précision gravimétrique 0,01g',
    es: 'Precisión gravimétrica 0.01g',
    it: 'Precisione gravimetrica 0.01g',
    de: 'Gravimetrische 0.01g-Präzision',
    ru: 'Гравиметрическая точность 0.01g',
    zh: '0.01g 重量法精度',
    tr: 'Gravimetrik 0.01g hassasiyet',
    fa: 'دقت ترازوی ۰.۰۱ گرمی',
  },
  kpi_ifra: {
    ar: 'أحدث المعايير ولوائح السلامة الدولية',
    en: 'Latest IFRA 51 Safety Compliance',
    fr: 'Conformité IFRA 51 (dernière norme)',
    es: 'Cumplimiento IFRA 51 más reciente',
    it: 'Conformità IFRA 51 più recente',
    de: 'Aktuellste IFRA-51-Konformität',
    ru: 'Соответствие последнему IFRA 51',
    zh: '最新 IFRA 51 安全合规',
    tr: 'En güncel IFRA 51 uyumu',
    fa: 'جدیدترین استانداردها و مقررات ایمنی بین‌المللی',
  },
  kpi_costing: {
    ar: 'حساب التكاليف والأرباح وبطاقات التصنيع',
    en: 'Costing Margins & Production Spec',
    fr: 'Marges de coût et fiches de production',
    es: 'Márgenes de costos y fichas de producción',
    it: 'Margini di costo e schede di produzione',
    de: 'Kostenmargen & Produktonsdatenblätter',
    ru: 'Расчёт себестоимости и техкарты',
    zh: '成本利润与生产规格单',
    tr: 'Maliyet marjları ve üretim kartları',
    fa: 'محاسبه هزینه‌ها، سود و کارت‌های تولید',
  },
  hero_alt: {
    ar: 'قارورة عطر فاخرة في مختبر تصميم العطور مع شام',
    en: 'Luxury perfume bottle in the Sham fragrance design laboratory',
    fr: 'Flacon de parfum de luxe dans le laboratoire Sham',
    es: 'Frasco de perfume de lujo en el laboratorio Sham',
    it: 'Flacone di profumo di lusso nel laboratorio Sham',
    de: 'Luxus-Parfümflakon im Sham-Labor',
    ru: 'Роскошный флакон духов в лаборатории Sham',
    zh: 'Sham 调香实验室中的奢华香水瓶',
    tr: 'Sham laboratuvarında lüks parfüm şişesi',
    fa: 'بطری عطر لوکس در آزمایشگاه طراحی عطر شام',
  },
} satisfies Record<string, LText>;

export const Hero: React.FC<HeroProps> = ({ onQuickStart, currentLang = 'ar' }) => {
  const rtl = isRTL(currentLang);
  const L = makeT(currentLang, S);
  const ActionArrow = rtl ? ArrowLeft : ArrowRight;

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-stone-900 via-stone-900 to-stone-950 text-white border-b border-stone-800 pt-6 sm:pt-10 pb-12 sm:pb-16 no-print">
      
      {/* Subtle Luxury Golden Ambient Glow */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-amber-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-10 w-[400px] h-[400px] bg-amber-800/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-8 relative z-10">
        
        {/* World News Ticker Strip at the Top of Hero */}
        <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-stone-800/70 backdrop-blur-md rounded-2xl p-3 sm:px-5 border border-stone-700/80 shadow-md">
          <div className="flex items-center gap-3 min-w-0">
            <span className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 text-white text-[11px] font-bold tracking-wider flex items-center gap-1.5 shadow-sm shrink-0">
              <Flame className="w-3.5 h-3.5 fill-white text-white" />
              <span>{L('news_badge')}</span>
            </span>
            <span className="text-xs text-stone-300 font-medium truncate max-w-xl">
              {L('news_ticker')}
            </span>
          </div>

          <button
            onClick={() => onQuickStart('perfume_news')}
            className={`text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 shrink-0 transition-colors cursor-pointer ${rtl ? 'mr-auto sm:mr-0' : 'ml-auto sm:ml-0'}`}
          >
            <span>{L('explore_news')}</span>
            <ActionArrow className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Content Column */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/15 text-amber-300 text-xs font-semibold border border-amber-500/30">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>{L('pro_badge')}</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.2] font-serif-luxury text-balance text-white">
                {t('hero_title', currentLang)}
              </h1>
            </div>

            <p className="text-stone-300 text-xs sm:text-base leading-relaxed max-w-2xl font-light">
              {t('hero_desc', currentLang)}
            </p>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => onQuickStart('concentration')}
                className="flex items-center gap-2 px-6 py-3.5 text-xs sm:text-sm font-bold text-stone-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 hover:from-amber-300 hover:to-amber-200 rounded-xl shadow-lg shadow-amber-900/30 transition-all hover:scale-[1.02] cursor-pointer"
              >
                <FlaskConical className="w-4 h-4 text-stone-900" />
                <span>{t('hero_btn_calc', currentLang)}</span>
                <ActionArrow className="w-4 h-4" />
              </button>

              <button
                onClick={() => onQuickStart('perfume_news')}
                className="flex items-center gap-2 px-5 py-3.5 text-xs sm:text-sm font-semibold text-stone-200 bg-stone-800/90 hover:bg-stone-700/90 border border-stone-700 rounded-xl transition-all cursor-pointer"
              >
                <Newspaper className="w-4 h-4 text-amber-400" />
                <span>{t('hero_btn_news', currentLang)}</span>
              </button>

              <button
                onClick={() => onQuickStart('master_ai')}
                className="flex items-center gap-2 px-5 py-3.5 text-xs sm:text-sm font-semibold text-stone-200 bg-stone-800/90 hover:bg-stone-700/90 border border-stone-700 rounded-xl transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>{t('hero_btn_ai', currentLang)}</span>
              </button>
            </div>

            {/* Feature Highlights */}
            <div className="pt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-stone-400">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{L('feat_gravity')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{L('feat_ifra')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{L('feat_formulas')}</span>
              </div>
            </div>
          </div>

          {/* Right Column: High Graphics Visual Showcase */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-amber-600/30 bg-stone-950 aspect-[16/12] group">
              <img
                src={heroImg}
                alt={L('hero_alt')}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-6">
                <div className="text-white space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-semibold text-amber-300">
                      {L('atelier_label')}
                    </span>
                  </div>
                  <p className="text-sm sm:text-base font-bold font-serif-luxury text-stone-100">
                    {L('quote')}
                  </p>
                </div>
              </div>
            </div>

            {/* Floating Graphic Badge */}
            <div className={`absolute -bottom-4 ${rtl ? '-right-4' : '-left-4'} bg-stone-900/95 backdrop-blur-md border border-amber-500/40 rounded-2xl p-3 shadow-xl flex items-center gap-3 hidden sm:flex`}>
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold font-serif-luxury text-lg border border-amber-500/30">
                0.01
              </div>
              <div className={rtl ? 'text-right' : 'text-left'}>
                <div className="text-xs font-bold text-white">{L('balance_badge')}</div>
                <div className="text-[10px] text-stone-400">{L('density_badge')}</div>
              </div>
            </div>
          </div>

        </div>

        {/* 4-Item Luxury KPI Strip */}
        <div className="mt-12 pt-8 border-t border-stone-800 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className="space-y-1 bg-stone-850/50 p-4 rounded-2xl border border-stone-800">
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono-numbers">
              6
            </div>
            <div className="text-xs text-stone-300 font-medium">
              {L('kpi_strengths')}
            </div>
          </div>
          <div className="space-y-1 bg-stone-850/50 p-4 rounded-2xl border border-stone-800">
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono-numbers">
              0.01g
            </div>
            <div className="text-xs text-stone-300 font-medium">
              {L('kpi_precision')}
            </div>
          </div>
          <div className="space-y-1 bg-stone-850/50 p-4 rounded-2xl border border-stone-800">
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono-numbers">
              IFRA 51
            </div>
            <div className="text-xs text-stone-300 font-medium">
              {L('kpi_ifra')}
            </div>
          </div>
          <div className="space-y-1 bg-stone-850/50 p-4 rounded-2xl border border-stone-800">
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono-numbers">
              100%
            </div>
            <div className="text-xs text-stone-300 font-medium">
              {L('kpi_costing')}
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};
