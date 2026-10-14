import React, { useState, useEffect } from 'react';
import {
  FlaskConical,
  Beaker,
  Scale,
  Sparkles,
  Newspaper,
  Flame,
  Globe,
  TrendingUp,
  Crown,
  Compass,
  Award,
  BookOpen,
  Leaf,
  Droplets,
  Flower2,
  Gem,
  Layers,
  Wind,
  Atom,
  Sliders,
  Wine,
  Gauge,
  Thermometer,
  ShieldCheck,
  DollarSign,
  Receipt,
  Calculator,
  Bot,
  Brain,
  Wand2,
  MessageSquare,
  BookmarkPlus,
  Archive,
  FileText,
  Hourglass,
  Clock,
  Calendar,
  ShieldAlert,
  MapPin,
  Building,
  Shield,
  Lock,
  Key,
  ChevronRight,
  ChevronLeft,
  Play,
  Pause,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Radio,
  SlidersHorizontal,
} from 'lucide-react';

import heroImg from '../assets/images/hero_luxury_perfume_1791692409081.jpg';
import labImg from '../assets/images/perfume_lab_compounding_1791692420116.jpg';
import newsImg from '../assets/images/niche_perfume_reveal_1791968798991.jpg';
import pyramidImg from '../assets/images/perfume_ingredients_pyramid_1791692429360.jpg';

import { SupportedLanguage } from '../types/i18n';
import { FormulationState, PyramidNote, SavedFormula } from '../types/perfume';
import { UserEnvironmentProfile } from '../utils/environmentAdapter';
import { UserDetailedAddress } from '../types/address';
import { UserProfile } from '../types/auth';
import { STATS_BADGE_EN, PORTAL_NEWS_EN } from '../utils/localizedHub';

interface PortalNewsItem {
  id: string;
  badge: string;
  title: string;
  description: string;
  metric: string;
  timestamp: string;
  actionHint: string;
  onSpecialAction?: () => void;
}

interface PortalDefinition {
  id: string;
  targetTab: string;
  category: 'lab' | 'knowledge' | 'business' | 'ai_news';
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  accentColor: string;
  borderGlow: string;
  icons: Array<React.ComponentType<{ className?: string }>>;
  news: PortalNewsItem[];
  statsBadge: string;
  imageThumbnail?: string;
  onSpecialAction?: () => void;
}

interface HomeHubProps {
  onNavigate: (tabId: string) => void;
  currentLang: SupportedLanguage;
  formulation: FormulationState;
  pyramidNotes: PyramidNote[];
  savedFormulas: SavedFormula[];
  currentEnvironment: UserEnvironmentProfile;
  detailedAddress: UserDetailedAddress;
  currentUser: UserProfile | null;
  onOpenEnvironmentModal: () => void;
  onOpenPrivacyModal: () => void;
  onOpenAuthModal: () => void;
  onOpenSpecModal: () => void;
}

export const HomeHub: React.FC<HomeHubProps> = ({
  onNavigate,
  currentLang = 'ar',
  formulation,
  pyramidNotes,
  savedFormulas,
  currentEnvironment,
  detailedAddress,
  currentUser,
  onOpenEnvironmentModal,
  onOpenPrivacyModal,
  onOpenAuthModal,
  onOpenSpecModal,
}) => {
  const isRtl = currentLang === 'ar' || currentLang === 'fa';

  const SUBTITLE_EN_MAP: Record<string, string> = {
    portal_concentration: 'Gravimetric molecular weight calculation at 0.01g precision',
    portal_news: 'Exclusive reports from Milan, Paris, and Dubai exhibitions',
    portal_world_perfumes: 'Analyzing formulas of 8 world iconic fragrances with exact ratios',
    portal_raw_materials: 'Detailed catalog of 28+ pure ingredients with CAS numbers & safety',
    portal_pyramid: 'Three-layer pyramid structure with molecular evaporation simulation',
    portal_alcohol: 'Accurate dilution with distilled water to prevent clouding',
    portal_costing: 'Bottle unit pricing, ingredient costs, and ROI margin estimation',
    portal_master_ai: 'Multi-AI synthesis (Gemini + DeepSeek + ChatGPT + Claude) in one lab',
    portal_library: 'Secure storage, cloud sync, and printable manufacturing specs',
    portal_guide: 'Cold maceration protocol, filtration, and longevity science',
    portal_maceration_simulator: 'Forecasting exact perfume maturation completion date with Master Shahin advice',
    portal_environment: 'Worldwide coverage adapting formula to local temperature & humidity',
    portal_privacy: 'Full encryption of formulas, instant export, and GDPR compliance',
  };

  // Global state for auto-rotation
  const [isAutoCycling, setIsAutoCycling] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'lab' | 'knowledge' | 'business' | 'ai_news'>('all');
  
  // Per-portal active news item and icon index
  const [portalIndexes, setPortalIndexes] = useState<Record<string, number>>({});
  // Animate pulse on index change
  const [animatingPortals, setAnimatingPortals] = useState<Record<string, boolean>>({});

  // Dynamic news definitions utilizing live state
  const portals: PortalDefinition[] = [
    // 1. Formulation & Lab Portal
    {
      id: 'portal_concentration',
      targetTab: 'concentration',
      category: 'lab',
      titleAr: 'حاسبة التركيب والمعمل الحرفي',
      titleEn: 'Formulation & Lab Calculator',
      subtitleAr: 'حساب الأوزان الجزيئية بدقة الميزان التحليلي (0.01g)',
      accentColor: 'from-amber-600 to-amber-700 text-amber-500 bg-amber-500/10',
      borderGlow: 'hover:border-amber-500/50 hover:shadow-amber-900/10',
      icons: [FlaskConical, Beaker, Scale, Sparkles],
      statsBadge: `دقة 0.01g · ${formulation.bottleVolumeMl} مل`,
      imageThumbnail: labImg,
      news: [
        {
          id: 'c1',
          badge: 'التركيبة النشطة الحالية',
          title: `زجاجة ${formulation.bottleVolumeMl} مل بتركيز ${formulation.concentrationPercent}% (${formulation.concentrationType.toUpperCase()})`,
          description: `وزن الزيت المعاير ${(formulation.bottleVolumeMl * (formulation.concentrationPercent / 100) * formulation.oilDensity).toFixed(2)}g متوازن مع كحول إيثيلي نقي ومثبت ${(formulation.bottleVolumeMl * (formulation.fixativePercent / 100)).toFixed(2)}g.`,
          metric: `${formulation.concentrationPercent}% زيت نقي`,
          timestamp: 'قيد المعايرة بالمعمل',
          actionHint: 'تعديل نسب التركيز والأوزان',
        },
        {
          id: 'c2',
          badge: 'توصية التعتيق المقترحة',
          title: '30 يوماً تعتيق في درجات حرارة باردة (18°C)',
          description: 'التعتيق يسمح بتكون الروابط الإستيرية العطرية بين جزيئات الزيت والكحول دون تعكر أو تبخر غير مرغوب.',
          metric: 'معيار شام المعتمد',
          timestamp: 'نصيحة الخبير',
          actionHint: 'فتح حاسبة المعمل',
        },
        {
          id: 'c3',
          badge: 'المطابقة الكيميائية',
          title: 'حساب الكثافة النوعية (0.92 g/ml للزيت · 0.80 g/ml للكحول)',
          description: 'تفادي الخطأ الشائع بخلط الحجم بالوزن، تضمن الحاسبة دقة مطابقة لشهادات التحليل المخبري الصيدلاني.',
          metric: 'دقة ±0.01g',
          timestamp: 'معايير IFRA',
          actionHint: 'معاينة الميزان المعملي',
        },
        {
          id: 'c4',
          badge: 'ملاءمة بيئة المعمل',
          title: `ملائم لمناخ ${currentEnvironment.countryFlag || '🌍'} ${currentEnvironment.countryNameAr.split('(')[0]}`,
          description: `تمت معايرة نسبة التركيز الموصى بها (${currentEnvironment.recommendedConcentrationPercent}%) لتفادي الاختناق العطري وتأمين فوحان يدوم 12+ ساعة.`,
          metric: currentEnvironment.currencyCode,
          timestamp: 'تحديث المناخ اللحظي',
          actionHint: 'تطبيق التوصية في المعمل',
        },
      ],
    },

    // 2. World Perfume News Portal
    {
      id: 'portal_news',
      targetTab: 'perfume_news',
      category: 'ai_news',
      titleAr: 'أخبار وصيحات العطور العالمية',
      titleEn: 'World Perfume News & Trends',
      subtitleAr: 'نشرة يومية مصورة معتمدة من الخبير شاهين من معارض ميلانو وباريس ودبي',
      accentColor: 'from-orange-600 to-amber-600 text-orange-500 bg-orange-500/10',
      borderGlow: 'hover:border-orange-500/50 hover:shadow-orange-900/10',
      icons: [Newspaper, Flame, Globe, TrendingUp],
      statsBadge: '👑 رصد الخبير شاهين اليومي المصور',
      imageThumbnail: newsImg,
      news: [
        {
          id: 'n1',
          badge: 'عاجل من ميلانو',
          title: 'أسبوع Esxence 2026: تصدر نوتات الشاي الصيني المدخن والورد الطبيعي',
          description: 'أكبر ملتقى لدور العطور الحرفية يشهد تحولاً بارزاً نحو النوتات المعدنية والزهور البيضاء ذات التقطير الحيوي المستدام.',
          metric: '360 دار نيش',
          timestamp: 'تحديث اليوم',
          actionHint: 'قراءة التقرير الكامل',
        },
        {
          id: 'n2',
          badge: 'بيوتي وورلد دبي',
          title: 'العود الكمبودي المعتق يتصدر الطلب في الشرق الأوسط وأوروبا',
          description: 'زيادة الإقبال على تقنيات التقطير الهوائي التي تحافظ على نفحات العود العميقة مع خفض الحدة الحيوانية.',
          metric: '+42% نمو سنوي',
          timestamp: 'تقرير اقتصادي',
          actionHint: 'استعراض اتجاهات السوق',
        },
        {
          id: 'n3',
          badge: 'معايير السلامة الدولية',
          title: 'تحديث إرشادات IFRA الصادرة بشأن المركبات الحمضية والأوكموس',
          description: 'توصيات حديثة تضمن استخدام آمن لمستخلصات الليمونين وتفادي الحساسية الجلدية مع الحفاظ على الفوحان.',
          metric: 'IFRA Standard 51',
          timestamp: 'إشعار تنظيمي',
          actionHint: 'فحص نسب السلامة',
        },
        {
          id: 'n4',
          badge: 'صيحات خريف 2026',
          title: 'عودة العطور الفوجير الخضراء النضرة بروح عصرية شرقية',
          description: 'مزيج الخزامى البري مع اللبان العماني وخشب الصندل يبتكر توقيعاً عطرياً جديداً للشباب ورواد الأعمال.',
          metric: 'Top Trend 2026',
          timestamp: 'نشرة دورية',
          actionHint: 'استعراض النوتات الرائجة',
        },
      ],
    },

    // 3. World Perfumes Library Portal
    {
      id: 'portal_world_perfumes',
      targetTab: 'world_perfumes',
      category: 'knowledge',
      titleAr: 'مكتبة العطور العالمية الأيقونية',
      titleEn: 'Iconic World Perfumes Library',
      subtitleAr: 'تحليل أسرار أشهر 8 عطور في التاريخ بنسب المعمل الدقيقة',
      accentColor: 'from-amber-500 to-yellow-600 text-amber-500 bg-amber-500/10',
      borderGlow: 'hover:border-amber-400/50 hover:shadow-amber-900/10',
      icons: [Crown, Compass, Award, Sparkles],
      statsBadge: '8 وصفات أسطورية جاهزة',
      imageThumbnail: heroImg,
      news: [
        {
          id: 'w1',
          badge: 'الأكثر تحميلاً',
          title: 'باكارات روج 540 (Baccarat Rouge 540) - ميزون فرانسيس كوركديجان',
          description: 'توليفة الزعفران الإيراني والياسمين والأمبروكسان وخشب الأرز بتركيز 25% مع نصائح دمج المسك الصناعي.',
          metric: 'جاهزة للتحميل الفوري',
          timestamp: 'وصفة معتمدة',
          actionHint: 'تحميل التركيبة في المعمل',
        },
        {
          id: 'w2',
          badge: 'أيقونة النيش الرجالي',
          title: 'كريد أفينتوس (Creed Aventus) - تناغم الأناناس والدخان والبتولا',
          description: 'سر الموازنة بين نفحات الفواكه المنعشة وعمق الباتشولي والمسك الأسود وثبات يدوم لأكثر من 16 ساعة.',
          metric: 'الباتش الذهبي',
          timestamp: 'الأكثر شهرة',
          actionHint: 'استعراض هرم التركيبة',
        },
        {
          id: 'w3',
          badge: 'السحر الشرقي الفاخر',
          title: 'توباكو فانيل (Tobacco Vanille) - توم فورد',
          description: 'دفء التبغ المجفف وأزهار التبغ وحبوب التونكا والفانيليا مع عصارة الكاكاو والتوابل الدافئة.',
          metric: 'شتاء وخريف',
          timestamp: 'وصفة كلاسيكية',
          actionHint: 'نسخ مقادير التبغ والفانيليا',
        },
        {
          id: 'w4',
          badge: 'انتعاش المحيطات والمدن',
          title: 'بلو دي شانيل (Bleu de Chanel) وسوفاج (Sauvage)',
          description: 'دراسة كيميائية مكثفة لجزيء الأمبروكسان والفلفل الوردي والبرغموت التي صنعت ثورة العطور الزرقاء.',
          metric: 'معيار العالمية',
          timestamp: 'محدث أسبوعياً',
          actionHint: 'تصفح كافة الوصفات',
        },
      ],
    },

    // 4. Raw Materials Encyclopedia Portal
    {
      id: 'portal_raw_materials',
      targetTab: 'raw_materials',
      category: 'knowledge',
      titleAr: 'موسوعة المواد الخام العطرية',
      titleEn: 'Raw Materials Encyclopedia',
      subtitleAr: 'فهرس تفصيلي لـ 24+ مادة نقية مشروحة بأرقام CAS وقواعد الأمان',
      accentColor: 'from-emerald-600 to-teal-700 text-emerald-500 bg-emerald-500/10',
      borderGlow: 'hover:border-emerald-500/50 hover:shadow-emerald-900/10',
      icons: [Leaf, Droplets, Flower2, Gem],
      statsBadge: '24+ خامة نقية · CAS Certified',
      imageThumbnail: pyramidImg,
      news: [
        {
          id: 'm1',
          badge: 'خامة اليوم النادرة',
          title: 'زبدة الأوريس النادرة (Orris Butter) - المستخلصة من جذور السوسن',
          description: 'أغلى خامة في صناعة العطور العالمية؛ تحتاج 3 سنوات تجفيف لإنتاج جزيء الإيرون البودري الفاخر.',
          metric: '$50,000 / كغم',
          timestamp: 'نوتة ملكية',
          actionHint: 'إضافة الأوريس إلى الهرم',
        },
        {
          id: 'm2',
          badge: 'ركيزة التثبيت الخشبي',
          title: 'خشب الصندل الميسوري الطبيعي وزيت الباتشولي الإندونيسي',
          description: 'تمنح العطر عمقاً كريمياً دافئاً وثباتاً يتجاوز 24 ساعة، مع خصائص مضادة للتبخر السريع للقمم الحمضية.',
          metric: 'نوتة قاعدية',
          timestamp: 'دليل الخامات',
          actionHint: 'قراءة مواصفات الصندل',
        },
        {
          id: 'm3',
          badge: 'السلامة والاحتياط',
          title: 'البيرغاموت منزوع البرغابتين (Bergamot FCF) لتفادي التحسس الضوئي',
          description: 'استخدام تقنية التقطير الفراغي يزيل مادة الفوروكومارين المسببة لحروق الشمس مع الحفاظ على العبير الحمضي المنعش.',
          metric: 'معتمد IFRA',
          timestamp: 'إرشادات المعمل',
          actionHint: 'استعراض قواعد الأمان',
        },
        {
          id: 'm4',
          badge: 'جزيئات العصر الحديث',
          title: 'الأمبروكسان (Ambroxan) وأيزو إي سوبر (Iso E Super)',
          description: 'الجزيئات التخليقية التي أحدثت ثورة في صناعة العطور الحرفية لزيادة الفوحان وإعطاء هالة مغناطيسية ناعمة.',
          metric: 'تأثير السيليدج',
          timestamp: 'كيمياء العطور',
          actionHint: 'استعراض الجزيئات الحديثة',
        },
      ],
    },

    // 5. Fragrance Pyramid Portal
    {
      id: 'portal_pyramid',
      targetTab: 'pyramid',
      category: 'lab',
      titleAr: 'جرافيك الهرم العطري وسيناريو الرش 💨',
      titleEn: 'Graphic Fragrance Pyramid & Evolution Simulator',
      subtitleAr: 'جرافيك هرمي ثلاثي الطبقات مع ترتيب التطاير ومحاكي حي لسيناريو ما بعد الرش',
      accentColor: 'from-amber-600 via-orange-600 to-rose-700 text-amber-500 bg-amber-500/10',
      borderGlow: 'hover:border-amber-500/50 hover:shadow-amber-900/10',
      icons: [Layers, Wind, Atom, Sliders],
      statsBadge: `${pyramidNotes.length} نوتة بالهرم الجرافيكي`,
      imageThumbnail: pyramidImg,
      news: [
        {
          id: 'p0',
          badge: 'جديد: محاكي سيناريو ما بعد الرش',
          title: 'سيناريو تخيلي دقيقة بدقيقة: ماذا سيحدث فور رش العطر وعلى مدار 24 ساعة؟',
          description: 'محاكي زمني تفاعلي يتتبع تطاير الجزيئات الأسرع طيراناً أولاً، تفتح القلب في ذروة الفوحان، ورسو القاعدة وثباتها على الجلد.',
          metric: 'محاكاة حية 24h',
          timestamp: 'محاكي الرش الحي',
          actionHint: 'بدء تجربة الرش',
        },
        {
          id: 'p1',
          badge: 'التوزيع الكلاسيكي المتوازن',
          title: 'قاعدة المعيار: 20% قمة (Top) · 30% قلب (Heart) · 50% قاعدة (Base)',
          description: 'التوازن المثالي الذي يضمن انطلاقة منعشة قوية، وانتقالاً سلساً نحو قلب العطر، ثم استقراراً عميقاً يدوم ساعات طويلة.',
          metric: '100% تناغم هرمي',
          timestamp: 'محاكي الفوحان',
          actionHint: 'معايرة نسب الهرم',
        },
        {
          id: 'p2',
          badge: 'النوتات المسجلة حالياً',
          title: `يحتوي هرمك على ${pyramidNotes.length} نوتات عطرية مرتبة بحسب سرعة التطاير والجودة`,
          description: `أبرز النوتات الحالية: ${pyramidNotes.slice(0, 3).map((n) => n.nameAr).join(' · ')} موزعة مع نسبها وأوزانها بالجرام والمللي.`,
          metric: `${pyramidNotes.reduce((acc, curr) => acc + (curr.percentageOfOil || 0), 0)}% إجمالي`,
          timestamp: 'حالة الهرم اللحظية',
          actionHint: 'إضافة أو تعديل نوتة',
        },
        {
          id: 'p3',
          badge: 'ترتيب التطاير والجودة',
          title: 'النوتات العليا (الأسرع طيراناً) ➔ نوتات القلب (متوسطة) ➔ القاعدة (الأعلى ثباتاً)',
          description: 'تصنيف كيميائي تلقائي لجزيئات العطر حسب الوزن الجزيئي ومعدل التبخر مع شارات الجودة والنقاء A+.',
          metric: 'ترتيب التطاير الدقيق',
          timestamp: 'ديناميكا التبخر',
          actionHint: 'عرض ترتيب التطاير',
        },
      ],
    },

    // 6. Alcohol Dilution Portal
    {
      id: 'portal_alcohol',
      targetTab: 'alcohol',
      category: 'lab',
      titleAr: 'حاسبة تخفيف الكحول ومعايير النقاء',
      titleEn: 'Alcohol Dilution Calculator',
      subtitleAr: 'حساب دقيق لنسبة الماء المقطر لمنع التعكر وضمان الأمان الصيدلاني',
      accentColor: 'from-cyan-600 to-blue-700 text-cyan-500 bg-cyan-500/10',
      borderGlow: 'hover:border-cyan-500/50 hover:shadow-cyan-900/10',
      icons: [Wine, Gauge, Thermometer, ShieldCheck],
      statsBadge: 'نقاء 96% ➔ 80% معتمد',
      news: [
        {
          id: 'a1',
          badge: 'معيار السلامة الحتمي',
          title: 'استخدام كحول إيثيلي 96% معتمد صيدلانياً خالٍ تماماً من الميثانول',
          description: 'الميثانول مركب شديد السمية محظور في العطور، الكحول الإيثيلي الطبي يضمن أمان الرش على الجلد دون أي تهيج.',
          metric: '0% ميثانول',
          timestamp: 'معايير نقاء المعمل',
          actionHint: 'حساب تخفيف الباتش',
        },
        {
          id: 'a2',
          badge: 'ظاهرة التعكر (Louching Effect)',
          title: 'تفادي عتامة المستحلب عند انخفاض نسبة الكحول عن 75%',
          description: 'الزيوت العطرية الثقيلة تحتاج وسطاً كحولياً مركزاً لتظل ذائبة كلياً بشكل شفاف دون الحاجة لمواد استحلاب إضافية.',
          metric: 'شفافية بلورية',
          timestamp: 'تنبيه فني',
          actionHint: 'معايرة نسبة الماء المقطر',
        },
        {
          id: 'a3',
          badge: 'درجة حرارة المزج',
          title: 'التفاعل الماص/الطارد للحرارة عند إضافة الماء إلى الكحول',
          description: 'ارتفاع طفيف في درجة حرارة المزيج يحدث طبيعياً بسبب انكماش الحجم الجزيئي؛ يُنصح بترك المزيج يهدأ قبل إضافة الزيت.',
          metric: 'انكماش الحجم الجزيئي',
          timestamp: 'قواعد فيزيائية',
          actionHint: 'قراءة بروتوكول المزج',
        },
        {
          id: 'a4',
          badge: 'تركيز التبخر المثالي',
          title: '80% - 85% كحول إيثيلي يمنح أعلى فوحان دون لسعة كحولية حادة',
          description: 'النسبة الذهبية للـ Eau de Parfum تضمن سرعة انتشار النوتات في الهواء دون أن تطغى رائحة الكحول على اللمسات الأولى.',
          metric: 'النسبة الذهبية',
          timestamp: 'معادلة الفوحان',
          actionHint: 'فتح حاسبة الكحول',
        },
      ],
    },

    // 7. Cost & Commercial Portal
    {
      id: 'portal_costing',
      targetTab: 'costing',
      category: 'business',
      titleAr: 'حاسبة التكاليف وهوامش الأرباح التجارية',
      titleEn: 'Cost & Profit Margins Calculator',
      subtitleAr: 'تسعير الزجاجة وتكلفة المكونات وحساب العائد الاستثماري لمشروعك',
      accentColor: 'from-emerald-600 to-green-700 text-emerald-500 bg-emerald-500/10',
      borderGlow: 'hover:border-emerald-500/50 hover:shadow-emerald-900/10',
      icons: [DollarSign, TrendingUp, Receipt, Calculator],
      statsBadge: `عملة المعمل: ${currentEnvironment.currencyCode}`,
      news: [
        {
          id: 'co1',
          badge: 'تحليل تكلفة القطعة',
          title: 'تفكيك تكلفة الزجاجة: الزيت + الكحول + العبوة + البخاخ + التغليف',
          description: `حساب دقيق لصافي تكلفة القطعة الواحدة بعملة ${currentEnvironment.currencyCode} لضمان هامش ربحي مربح قبل بدء خط الإنتاج.`,
          metric: `${currentEnvironment.currencySymbolAr} لكل مل`,
          timestamp: 'دراسة جدوى حية',
          actionHint: 'تسعير الزجاجة الآن',
        },
        {
          id: 'co2',
          badge: 'مضاعف التسعير التجاري (Markup)',
          title: 'هامش ربح مرن يتراوح بين 100% و 350% حسب نوع السوق وقنوات التوزيع',
          description: 'حدد سعر الجملة وسعر البيع للمستهلك النهائي مع تغطية مصاريف التسويق والشحن وهامش أرباح التجار.',
          metric: 'حساب تلقائي للربح',
          timestamp: 'استراتيجيات التسعير',
          actionHint: 'تحديد هامش الربح',
        },
        {
          id: 'co3',
          badge: 'تخطيط الباتش الصناعي',
          title: 'حساب رأس المال المطلوب لإنتاج باتش تجاري (50 أو 200 أو 1000 زجاجة)',
          description: 'وفر الهدر وخطط لكميات الزيت والكحول والزجاجات المطلوبة بدقة تامة لتفادي تجميد السيولة.',
          metric: 'حساب كميات الباتش',
          timestamp: 'إدارة الإنتاج',
          actionHint: 'حساب كمية الباتش',
        },
        {
          id: 'co4',
          badge: 'دعم جميع العملات العالمية (160+)',
          title: `تسعير فوري ومقارنة تصديرية بعملة ${currentEnvironment.currencyCode} (${currentEnvironment.currencySymbolAr})`,
          description: `دعم كامل لـ 160+ عملة مع جدول تحويل فوري لتسعير زجاجات العطر والتصدير إلى الأسواق العربية والدولية.`,
          metric: '160+ عملة مدعومة',
          timestamp: 'نظام الصرف المرجعي',
          actionHint: 'فتح حاسبة التكاليف ومحول العملات',
        },
      ],
    },

    // 8. Master Perfumer AI Portal (Shahin AI)
    {
      id: 'portal_master_ai',
      targetTab: 'master_ai',
      category: 'ai_news',
      titleAr: 'المعلم العطري الذكي (شاهين AI · Multi-AI Ensemble)',
      titleEn: 'Master Perfumer AI (Shahin · Multi-AI Ensemble)',
      subtitleAr: 'أتمتة دمج الذكاء الاصطناعي (Gemini + DeepSeek + ChatGPT + Claude) في معمل عطري متكامل',
      accentColor: 'from-amber-500 to-emerald-600 text-emerald-400 bg-emerald-500/10',
      borderGlow: 'hover:border-emerald-400/50 hover:shadow-emerald-900/10',
      icons: [Bot, Brain, Wand2, MessageSquare],
      statsBadge: '⚡ مجلس خبراء الذكاء (4 نماذج)',
      news: [
        {
          id: 'ai1',
          badge: '⚡ دمج مؤتمت (4 نماذج)',
          title: 'استشارة متزامنة تجمع بين جيمناي وديب سيك وشات جي بي تي وكلود في إجابة موحدة',
          description: 'اطلب من شاهين ابتكار تركيبة ليجمع لك دقة أوزان جيمناي، كيمياء ديب سيك، أكوردات ChatGPT، وفخامة تعتيق كلود.',
          metric: 'Ensemble متزامن',
          timestamp: 'مباشر الآن',
          actionHint: 'بدء جلسة مع مجلس الخبراء',
        },
        {
          id: 'ai2',
          badge: 'جسر النقل المباشر',
          title: 'نقل أي تركيبة يقترحها شاهين إلى حاسبة المعمل بنقرة زر واحدة!',
          description: 'لا حاجة لنسخ الأرقام يدوياً؛ تضغط زر التطبيق لتعبئة حاسبة التركيز أو الهرم العطري أو دفتر الوصفات فوراً.',
          metric: 'ربط مباشر 1-Click',
          timestamp: 'ميزة متطورة',
          actionHint: 'تجربة النقل التلقائي',
        },
        {
          id: 'ai3',
          badge: 'حفظ وتصدير السجل',
          title: 'تنزيل أرشيف المحادثات الفنية كوثيقة رسمية موقعة باسم معملك',
          description: 'احفظ خلاصة جلساتك مع المعلم العطري لتكون مرجعاً دائماً لورشة عملك ومختبرك الشخصي.',
          metric: 'تصدير نصي مشفر',
          timestamp: 'توثيق صناعي',
          actionHint: 'محادثة الخبير الآن',
        },
        {
          id: 'ai4',
          badge: 'قاعدة بيانات متجددة',
          title: 'مواكب لأحدث أبحاث مدرسة جراس ومقاييس الأمان الكيميائي العالمية',
          description: 'تمت تغذية الخبير بأمهات كتب العطارة القديمة وأحدث دوريات الجمعيات العطرية في أوروبا والشرق.',
          metric: 'مكتبة جراس والشرق',
          timestamp: 'تحديث مستمر',
          actionHint: 'فتح مجلس الخبير شاهين',
        },
      ],
    },

    // 9. Formula Library Portal
    {
      id: 'portal_library',
      targetTab: 'library',
      category: 'knowledge',
      titleAr: 'دفتر الوصفات وسجلات المعمل',
      titleEn: 'Formula Notebook & Archive',
      subtitleAr: 'حفظ آمن ومزامنة سحابية مع Firebase وطباعة استمارات التصنيع',
      accentColor: 'from-amber-700 to-stone-800 text-amber-500 bg-amber-500/10',
      borderGlow: 'hover:border-amber-600/50 hover:shadow-stone-900/10',
      icons: [BookmarkPlus, BookOpen, Archive, FileText],
      statsBadge: `${savedFormulas.length} تركيبة محفوظة`,
      news: [
        {
          id: 'lib1',
          badge: 'سجلاتك المعملية',
          title: `تم توثيق ${savedFormulas.length} تركيبة عطرية في سجلك الشخصي`,
          description: `آخر تركيبة مسجلة: «${savedFormulas[0]?.title || 'عطر شام'}» مع تفاصيل التشغيلة (${savedFormulas[0]?.batchCode || 'B01'}) وأيام التعتيق.`,
          metric: `${savedFormulas.length} وصفة موثقة`,
          timestamp: 'أرشيفك الدائم',
          actionHint: 'فتح دفتر الوصفات',
        },
        {
          id: 'lib2',
          badge: 'بطاقة المواصفات الصناعية',
          title: 'توليد وطباعة استمارة التصنيع الرسمية (Spec Sheet) للإنتاج والمعامل',
          description: 'وثيقة رسمية جاهزة للطباعة تحتوي على تفاصيل الزيت والكحول والماء ومقر المعمل المعتمد وتوقيع العطار.',
          metric: 'وثيقة PDF جاهزة',
          timestamp: 'مواصفات قياسية',
          actionHint: 'طباعة بطاقة التصنيع الحالية',
          onSpecialAction: onOpenSpecModal,
        },
        {
          id: 'lib3',
          badge: 'المزامنة السحابية المزدوجة',
          title: 'حفظ آمن على هاتفك ومتصفحك مع مزامنة فورية على سحابة Firebase',
          description: 'لا خوف من فقدان تركيباتك عند تغيير الجهاز، سجلاتك مربوطة بحسابك الشخصي المشفر.',
          metric: 'Firebase Sync',
          timestamp: 'حماية وتخزين',
          actionHint: 'تصفح الوصفات المحفوظة',
        },
        {
          id: 'lib4',
          badge: 'إعادة الاستدعاء الفوري',
          title: 'تحميل أي تركيبة محفوظة في حاسبة المعمل بنقرة زر واحدة لإعادة التطوير',
          description: 'استعد نسب الزيت والكحول والهرم العطري والملاحظات فوراً لتعديلها أو زيادة حجم الباتش.',
          metric: 'استدعاء فوري',
          timestamp: 'سهولة الاستخدام',
          actionHint: 'استعراض المكتبة',
        },
      ],
    },

    // 10. Aging and Fixatives Portal
    {
      id: 'portal_guide',
      targetTab: 'guide',
      category: 'knowledge',
      titleAr: 'دليل التعتيق والمثبتات العطرية',
      titleEn: 'Aging & Fixatives Guide',
      subtitleAr: 'البروتوكول العلمي للتعتيق البارد، الفلترة، وسر ثبات الأثر العطري',
      accentColor: 'from-amber-600 to-rose-700 text-amber-500 bg-amber-500/10',
      borderGlow: 'hover:border-rose-500/50 hover:shadow-rose-900/10',
      icons: [Hourglass, Clock, Calendar, ShieldAlert],
      statsBadge: 'بروتوكول تعتيق 30 يوماً',
      news: [
        {
          id: 'g1',
          badge: 'قاعدة التعتيق الذهبية',
          title: '21 إلى 45 يوماً للتناغم الكيميائي التام بين جزيئات الزيت والإيثانول',
          description: 'التعتيق في بيئة باردة ومعتمة (15-18°C) يمنح العطر نعومة ويخفف من حدة الحواف العطرية الأولية.',
          metric: '18°C درجة مثالية',
          timestamp: 'بروتوكول عالمي',
          actionHint: 'قراءة دليل التعتيق',
        },
        {
          id: 'g2',
          badge: 'تقنية التعتيق البارد (Cold Maceration)',
          title: 'تبريد المزيج عند 4°C قبل الفلترة يضمن نقاوة بلورية فائقة',
          description: 'التبريد يجبر الشمع النباتي غير المرئي على الترسيب لتتم تصفيته بورق الترشيح الصيدلاني دون أي شوائب.',
          metric: 'فلترة بلورية',
          timestamp: 'أسرار المعامل',
          actionHint: 'استعراض خطوات التبريد',
        },
        {
          id: 'g3',
          badge: 'مقارنة المثبتات',
          title: 'الأمبروكسان vs بنزوات البنزيل vs أيزو إي سوبر',
          description: 'دليل علمي مفصل لاختيار المثبت المناسب لكل عائلة عطرية دون التأثير على طبيعة الرائحة الأصلية.',
          metric: 'تثبيت 18+ ساعة',
          timestamp: 'جدول المثبتات',
          actionHint: 'مقارنة المثبتات',
        },
        {
          id: 'g4',
          badge: 'جدول التقليب الأسبوعي',
          title: 'تقليب الزجاجات مرة أسبوعياً بحركات دائرية هادئة لتسريع التمازج',
          description: 'تجنب الرج العنيف لتفادي إدخال فقاعات الهواء التي تسبب أكسدة الجزيئات الحمضية الدقيقة.',
          metric: 'حركة هادئة دائرية',
          timestamp: 'إرشادات حرفية',
          actionHint: 'فتح الدليل الكامل',
        },
      ],
    },

    // 11. Maceration Time Simulator Portal (محاكي التعتيق الزمني وتاريخ نضوج العطر)
    {
      id: 'portal_maceration_simulator',
      targetTab: 'maceration_simulator',
      category: 'lab',
      titleAr: 'محاكي التعتيق الزمني وتاريخ نضوج العطر',
      titleEn: 'Maceration Time Simulator & Maturation Forecast',
      subtitleAr: 'حساب تاريخ الانتهاء المتوقع لنضوج العطر بدقة بناءً على تاريخ البدء وأيام التعتيق المقررة مع الخبير شاهين',
      accentColor: 'from-amber-700 to-amber-950 text-amber-400 bg-amber-500/10',
      borderGlow: 'hover:border-amber-500/50 hover:shadow-amber-950/20',
      icons: [Hourglass, Calendar, Clock, Sparkles],
      statsBadge: 'معتمد مع الخبير شاهين 🧙‍♂️',
      news: [
        {
          id: 'm1',
          badge: 'تاريخ الانتهاء الدقيق',
          title: 'حساب تاريخ نضوج العطر بدقة متناهية بناءً على تاريخ البدء وأيام النظام',
          description: 'حدد تاريخ بدء الخلط وسيقوم النظام فوراً بحساب اليوم الدقيق لاكتمال التفاعلات الكيميائية والإستيرية داخل الزجاجة.',
          metric: 'دقة باليوم والتقويم',
          timestamp: 'خوارزمية معملية حية',
          actionHint: 'حساب تاريخ نضوج تشغيلتك',
        },
        {
          id: 'm2',
          badge: 'تنبيه التقويم و iCal',
          title: 'تنزيل ملف تقويم (.ics) لتنبيهك بهاتفك في يوم اكتمال نضوج العطر',
          description: 'اربط تاريخ انتهاء التعتيق بتقويم هاتفك ليأتيك إشعار فوري في الموعد المحدد لبدء الفلترة والتعبئة دون نسيان.',
          metric: 'تصدير .ICS فوري',
          timestamp: 'إشعار ذكي',
          actionHint: 'تفعيل تنبيه التقويم',
        },
        {
          id: 'm3',
          badge: 'استشارة الخبير شاهين',
          title: 'توجيهات شيخ العطارين شاهين لكل عائلة عطرية وظروف الحفظ المثالية',
          description: 'احصل على نصيحة شاهين الحصرية لتفادي الأكسدة، معايير التعتيق البارد (4°C)، واختيار أوعية الزجاج العسلي المعتم.',
          metric: 'استشارة فورية 🧙‍♂️',
          timestamp: 'حكمة شيخ العطارين',
          actionHint: 'استشارة الخبير شاهين الآن',
        },
        {
          id: 'm4',
          badge: 'بطاقة زجاجة المعمل',
          title: 'توليد ونسخ بطاقة التعتيق الفورية للصقها على قوارير المختبر',
          description: 'بطاقة توثيق معملية تحوي اسم التركيبة، كود الباتش، تاريخ البدء، وتاريخ الانتهاء المتوقع لحفظ النظام في ورشتك.',
          metric: 'بطاقة مخبرية جاهزة',
          timestamp: 'توثيق صناعي',
          actionHint: 'نسخ بطاقة الزجاجة',
        },
      ],
    },

    // 12. Country, Climate & Facility Portal
    {
      id: 'portal_country',
      targetTab: 'country_modal',
      category: 'business',
      titleAr: 'مقر المعمل، البلد، والمناخ الإقليمي',
      titleEn: 'Country, Climate & Facility Hub',
      subtitleAr: 'تغطية لكافة دول العالم وتكييف معادلة العطر مع حرارة ورطوبة بلدك',
      accentColor: 'from-amber-600 to-emerald-700 text-amber-500 bg-amber-500/10',
      borderGlow: 'hover:border-amber-500/50 hover:shadow-amber-900/10',
      icons: [MapPin, Globe, Compass, Building],
      statsBadge: `${currentEnvironment.countryFlag || '🌍'} ${currentEnvironment.countryNameAr.split('(')[0]}`,
      news: [
        {
          id: 'cnt1',
          badge: 'البلد والبيئة المفعلة',
          title: `${currentEnvironment.countryFlag || '🌍'} ${currentEnvironment.countryNameAr} (العملة: ${currentEnvironment.currencyCode})`,
          description: `المناخ المحدد لمعملك هو: «${currentEnvironment.climateLabelAr}» مع نسبة تركيز مقترحة ${currentEnvironment.recommendedConcentrationPercent}% ومثبت ${currentEnvironment.recommendedFixativePercent}%.`,
          metric: currentEnvironment.currencyCode,
          timestamp: 'إعدادات بلدك',
          actionHint: 'تغيير البلد أو المناخ',
          onSpecialAction: onOpenEnvironmentModal,
        },
        {
          id: 'cnt2',
          badge: 'سجل المقر والعنوان التفصيلي',
          title: `مقر المعمل: ${detailedAddress.labOrFacilityName || 'معمل شام الحرفي'} · ${detailedAddress.city || 'المدينة'}`,
          description: `العنوان موثق (${detailedAddress.street || 'العنوان التفصيلي'}) وجاهز للاستخدام في الشحن واستمارات التصنيع.`,
          metric: detailedAddress.city ? 'مسجل ومعتمد' : 'غير مكتمل',
          timestamp: 'بطاقة المقر',
          actionHint: 'تعديل العنوان ومقر المعمل',
          onSpecialAction: onOpenEnvironmentModal,
        },
        {
          id: 'cnt3',
          badge: 'التكيف التلقائي مع الموقع',
          title: 'التعرف التلقائي على دولة الزائر وضبط لغة العرض والعملة فوراً',
          description: 'عند فتح المنصة من أي دولة في العالم، يتم اقتراح اللغة والعملة ونسب التركيز المناخية المناسبة تلقائياً.',
          metric: '195+ دولة مدعومة',
          timestamp: 'استشعار ذكي',
          actionHint: 'فحص إعدادات الموقع',
          onSpecialAction: onOpenEnvironmentModal,
        },
        {
          id: 'cnt4',
          badge: 'تأثير الرطوبة والحرارة',
          title: 'العطور في المناخ الحار تتطلب تركيزات خفيفة أو مثبتات عنبرية أثقل',
          description: 'المنصة تقدم لك توصية محددة لكل إقليم جغرافي لضمان نجاح عطرك تجارياً بين المستهلكين المحليين.',
          metric: 'توصيات مناخية حية',
          timestamp: 'دراسة بيئية',
          actionHint: 'تطبيق التوصيات المناخية',
          onSpecialAction: onOpenEnvironmentModal,
        },
      ],
    },

    // 12. Data Privacy & GDPR Vault Portal
    {
      id: 'portal_privacy',
      targetTab: 'privacy_modal',
      category: 'ai_news',
      titleAr: 'درع حماية وخصوصية البيانات (GDPR)',
      titleEn: 'Data Privacy & Security Vault',
      subtitleAr: 'تشفير تام لأسرار تركيباتك العطرية، تصدير فوري، وحق النسيان الكامل',
      accentColor: 'from-emerald-700 to-stone-900 text-emerald-400 bg-emerald-500/10',
      borderGlow: 'hover:border-emerald-500/50 hover:shadow-emerald-900/10',
      icons: [Shield, Lock, Key, ShieldCheck],
      statsBadge: currentUser ? 'حساب مؤمن ومشفر' : 'حماية محلية مشفرة',
      news: [
        {
          id: 'pr1',
          badge: 'حصانة الأسرار العطرية',
          title: 'تركيباتك ومعادلاتك العطرية مشفرة محلياً وسحابياً ولا تُشارك أبداً',
          description: 'نظام تشفير خاص يضمن أن أسرار نسب خلطاتك تبقى ملكك الخاص دون أي وصول من أي أطراف تجارية أخرى.',
          metric: 'AES Encryption',
          timestamp: 'أمان قصوى',
          actionHint: 'فحص إعدادات التشفير',
          onSpecialAction: onOpenPrivacyModal,
        },
        {
          id: 'pr2',
          badge: 'حق النسيان الكامل (GDPR)',
          title: 'إمكانية محو كافة بياناتك وسجلاتك الشخصية نهائياً بضغطة زر واحدة',
          description: 'امتثال تام للمعايير الأوروبية والعالمية؛ يمكنك تنزيل نسخة احتياطية مشفرة أو تصفير بياناتك بالكامل في أي وقت.',
          metric: 'Right to be Forgotten',
          timestamp: 'امتثال قانوني',
          actionHint: 'فتح لوحة الخصوصية',
          onSpecialAction: onOpenPrivacyModal,
        },
        {
          id: 'pr3',
          badge: 'حالة الحساب والمصادقة',
          title: currentUser ? `مسجل باسم: ${currentUser.name} (${currentUser.craftLevel})` : 'جلسة ضيف محلية آمنة',
          description: currentUser
            ? `بياناتك متزامنة مع Firebase Authentication وقاعدة البيانات السحابية المشفرة.`
            : 'يمكنك إنشاء حساب مجاني الآن لمزامنة خلطاتك عبر جميع أجهزتك بأعلى درجات الأمان.',
          metric: currentUser ? 'حساب نشط' : 'جلسة محلية',
          timestamp: 'حالة التسجيل',
          actionHint: currentUser ? 'عرض تفاصيل الحساب' : 'تسجيل دخول أو إنشاء حساب',
          onSpecialAction: currentUser ? onOpenPrivacyModal : onOpenAuthModal,
        },
        {
          id: 'pr4',
          badge: 'تصدير السجلات بنقرة واحدة',
          title: 'تنزيل ملف JSON مشفر يحتوي على كافة تركيباتك وسجلات جلساتك',
          description: 'احتفظ بنسخة أوفلاين دائمة لمعملك في وسيط التخزين الخارجي الخاص بك دون أي اعتمادية على الإنترنت.',
          metric: 'Export Data 1-Click',
          timestamp: 'حرية نقل البيانات',
          actionHint: 'تصدير نسختك الاحتياطية',
          onSpecialAction: onOpenPrivacyModal,
        },
      ],
    },
  ];

  // Auto-rotation interval for news & icons
  useEffect(() => {
    if (!isAutoCycling) return;

    const interval = setInterval(() => {
      setPortalIndexes((prev) => {
        const next: Record<string, number> = { ...prev };
        portals.forEach((p) => {
          const currentIndex = prev[p.id] || 0;
          const nextIndex = (currentIndex + 1) % p.news.length;
          next[p.id] = nextIndex;
        });
        return next;
      });

      // trigger brief animation flash
      setAnimatingPortals(() => {
        const flashes: Record<string, boolean> = {};
        portals.forEach((p) => {
          flashes[p.id] = true;
        });
        return flashes;
      });

      setTimeout(() => {
        setAnimatingPortals({});
      }, 500);
    }, 4000); // cycle every 4 seconds

    return () => clearInterval(interval);
  }, [isAutoCycling]);

  // Handle manual navigation for a portal's news item
  const handlePortalStep = (portalId: string, direction: 'next' | 'prev', e: React.MouseEvent) => {
    e.stopPropagation();
    const portal = portals.find((p) => p.id === portalId);
    if (!portal) return;

    setPortalIndexes((prev) => {
      const current = prev[portalId] || 0;
      let nextIndex = direction === 'next' ? current + 1 : current - 1;
      if (nextIndex >= portal.news.length) nextIndex = 0;
      if (nextIndex < 0) nextIndex = portal.news.length - 1;
      return { ...prev, [portalId]: nextIndex };
    });

    setAnimatingPortals((prev) => ({ ...prev, [portalId]: true }));
    setTimeout(() => {
      setAnimatingPortals((prev) => ({ ...prev, [portalId]: false }));
    }, 400);
  };

  // Filter portals by category
  const filteredPortals = portals.filter((p) => {
    if (selectedCategory === 'all') return true;
    return p.category === selectedCategory;
  });

  // Handle click on card action
  const handleCardClick = (portal: PortalDefinition) => {
    if (portal.targetTab === 'country_modal') {
      onOpenEnvironmentModal();
    } else if (portal.targetTab === 'privacy_modal') {
      onOpenPrivacyModal();
    } else {
      onNavigate(portal.targetTab);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* ===================== ZONE 1: TOP LUXURY HERO SHOWCASE & BRAND HUB ===================== */}
      <section className="relative rounded-3xl overflow-hidden bg-gradient-to-b from-stone-900 via-stone-900 to-stone-950 text-white border border-amber-900/30 shadow-2xl p-6 sm:p-10">
        
        {/* Subtle Ambient Glows */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-600/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-80 h-80 bg-emerald-800/10 rounded-full blur-[90px] pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Main Copy */}
          <div className="lg:col-span-7 space-y-4">
            
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 text-xs font-semibold border border-amber-500/30">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{isRtl ? 'البوابة الرئيسية المتكاملة لجميع أقسام المعمل ومنصات العطور' : 'Integrated Master Command Suite for All Laboratory & Perfume Portals'}</span>
            </div>

            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight font-serif-luxury text-white leading-tight">
              {isRtl ? 'صمم عطرك مع شام' : 'Design Your Perfume with Sham'}
              <span className="block text-lg sm:text-2xl text-amber-400 font-sans font-medium mt-1">
                {isRtl ? 'نوافذ احترافية حية تجمع كافة منافذ وأقسام الموقع' : 'Live Interactive Windows Connecting All 12 Laboratory Portals'}
              </span>
            </h1>

            <p className="text-stone-300 text-xs sm:text-sm leading-relaxed max-w-2xl font-light">
              {isRtl
                ? 'مرحباً بك في المركز القيادي الموحد. استعرض أدناه نوافذ الأقسام الاثني عشر التفاعلية؛ حيث تتغير الأيقونات والمحتويات تلقائياً داخل كل نافذة لتعرض لك آخر الأخبار، الحسابات اللحظية، وتحديثات المعمل كأنه خبر متجدد مباشر عن كل منفذ.'
                : 'Welcome to your unified command lab. Explore the 12 dynamic interactive portals below with continuous updates, real-time molecular calculations, and industry insights.'}
            </p>

            {/* Quick Live Stats Strip */}
            <div className="pt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-stone-300">
              <div className="flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span className="text-stone-400">{isRtl ? 'حالة التحديث:' : 'Live Status:'}</span>
                <span className="font-bold text-white">{isRtl ? 'بث أخبار حي ومستمر' : 'Continuous Live Feed'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-stone-400">{isRtl ? 'البلد والمناخ:' : 'Country & Climate:'}</span>
                <button
                  onClick={onOpenEnvironmentModal}
                  className="font-bold text-amber-300 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>{currentEnvironment.countryFlag}</span>
                  <span>{isRtl ? currentEnvironment.countryNameAr.split('(')[0] : currentEnvironment.countryNameEn}</span>
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-stone-400">{isRtl ? 'الوصفات المحفوظة:' : 'Saved Formulas:'}</span>
                <span className="font-bold text-white">{savedFormulas.length} {isRtl ? 'تركيبة' : 'Formulas'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-stone-400">{isRtl ? 'المستخدم:' : 'User:'}</span>
                <span className="font-bold text-amber-200">
                  {currentUser ? currentUser.name : (isRtl ? 'ضيف المعمل' : 'Lab Guest')}
                </span>
              </div>
            </div>

            {/* Direct Quick Launch Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-3">
              <button
                onClick={() => onNavigate('concentration')}
                className="flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold text-stone-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 hover:from-amber-300 hover:to-amber-200 rounded-xl shadow-lg shadow-amber-900/30 transition-all hover:scale-[1.02] cursor-pointer"
              >
                <FlaskConical className="w-4 h-4 text-stone-900" />
                <span>{isRtl ? 'دخول حاسبة المعمل الفورية' : 'Open Lab Calculator'}</span>
                {isRtl ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </button>

              <button
                onClick={() => onNavigate('perfume_news')}
                className="flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-stone-200 bg-stone-800/90 hover:bg-stone-700/90 border border-stone-700 rounded-xl transition-all cursor-pointer"
              >
                <Newspaper className="w-4 h-4 text-amber-400" />
                <span>{isRtl ? 'أحدث أخبار العطور بالعالم' : 'Global Fragrance Trends'}</span>
              </button>

              <button
                onClick={() => onNavigate('master_ai')}
                className="flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-stone-200 bg-stone-800/90 hover:bg-stone-700/90 border border-stone-700 rounded-xl transition-all cursor-pointer"
              >
                <Bot className="w-4 h-4 text-emerald-400" />
                <span>{isRtl ? 'مجلس الخبير شاهين AI' : 'Consult Master Shahin AI'}</span>
              </button>
            </div>
          </div>

          {/* Right Showcase Card */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-2xl overflow-hidden border border-amber-600/30 shadow-xl aspect-16/10 group bg-stone-950">
              <img
                src={heroImg}
                alt="معمل صمم عطرك مع شام"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent flex flex-col justify-end p-5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-[11px] font-bold text-amber-300 tracking-wider">
                    {isRtl ? 'شبكة منافذ منصة شام الحرفية' : 'Sham Artisanal Portals Network'}
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-medium text-stone-200 font-serif-luxury">
                  {isRtl
                    ? '«12 منفذاً تخصصياً يجمع كل ما يحتاجه صانع العطور من الحسابات الرياضية الدقيقة إلى الأخبار العالمية وأسرار الصنعة»'
                    : '«12 specialized portals uniting precision compounding mathematics, world industry reports, and artisan secrets»'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== ZONE 2: LIVE BROADCAST TICKER & TICKER CONTROLS ===================== */}
      <section className="bg-stone-900 text-stone-200 rounded-2xl p-3.5 sm:px-6 border border-stone-800 shadow-md flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        
        {/* Ticker Lead */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 text-white text-[11px] font-bold tracking-wider flex items-center gap-1.5 shadow-xs">
            <Flame className="w-3.5 h-3.5 fill-white text-white" />
            <span>{isRtl ? 'نشرة منافذ المعمل' : 'Lab Portals Dispatch'}</span>
          </span>
          <span className="text-xs text-amber-400 font-semibold hidden sm:inline">
            {isRtl ? 'تحديث دوري كل 4 ثوانٍ:' : 'Live updates every 4s:'}
          </span>
        </div>

        {/* Dynamic Rolling Headline */}
        <div className="flex-1 overflow-hidden min-w-0 py-0.5">
          <div className="text-xs text-stone-200 font-medium truncate flex items-center gap-2">
            <span className="text-amber-400 font-bold shrink-0">
              [{isRtl ? portals[portalIndexes['portal_concentration'] || 0]?.titleAr : (portals[portalIndexes['portal_concentration'] || 0]?.titleEn || portals[portalIndexes['portal_concentration'] || 0]?.titleAr)}]:
            </span>
            <span className="truncate">
              {(() => {
                const n0 = portals[0]?.news[portalIndexes['portal_concentration'] || 0];
                const n1 = portals[1]?.news[portalIndexes['portal_news'] || 0];
                const t0 = !isRtl && n0 && PORTAL_NEWS_EN[n0.id] ? PORTAL_NEWS_EN[n0.id].title : n0?.title;
                const t1 = !isRtl && n1 && PORTAL_NEWS_EN[n1.id] ? PORTAL_NEWS_EN[n1.id].title : n1?.title;
                return `${t0} · ${t1}`;
              })()}
            </span>
          </div>
        </div>

        {/* Auto-Rotation Control Button */}
        <div className="flex items-center gap-2 shrink-0 justify-end">
          <button
            onClick={() => setIsAutoCycling(!isAutoCycling)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
              isAutoCycling
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-stone-800 text-stone-400 border-stone-700 hover:text-white'
            }`}
            title={isAutoCycling ? (isRtl ? 'إيقاف التدوير التلقائي' : 'Pause Auto-Cycle') : (isRtl ? 'تشغيل التدوير التلقائي' : 'Resume Auto-Cycle')}
          >
            {isAutoCycling ? (
              <>
                <Pause className="w-3.5 h-3.5 text-amber-400" />
                <span>{isRtl ? 'إيقاف البث' : 'Pause Feed'}</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isRtl ? 'تشغيل البث' : 'Resume Feed'}</span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* ===================== ZONE 3: CATEGORY FILTER SEGMENTED CONTROLS ===================== */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
        
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-serif-luxury text-stone-900 flex items-center gap-2">
            <span>{isRtl ? 'نوافذ أقسام المعمل ومنافذ المنصة' : 'Laboratory & Platform Portals'}</span>
            <span className="text-xs font-sans font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
              {isRtl ? '12 نافذة متجددة' : '12 Live Portals'}
            </span>
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            {isRtl
              ? 'كل نافذة تعرض أيقونات وأخباراً ومعلومات متغيرة آلياً تمثل النبض الحي لذلك القسم'
              : 'Each portal dynamically displays icons, metrics, and real-time updates representing that department.'}
          </p>
        </div>

        {/* Clean Segmented Filter Tabs (Zero-Pill discipline) */}
        <div className="flex items-center gap-1 p-1 bg-stone-200/80 rounded-xl overflow-x-auto max-w-full">
          {[
            { id: 'all', label: isRtl ? 'كافة المنافذ (12)' : 'All Portals (12)' },
            { id: 'lab', label: isRtl ? 'المعمل والحسابات (4)' : 'Lab & Compounding (4)' },
            { id: 'knowledge', label: isRtl ? 'المعرفة والوصفات (3)' : 'Knowledge & Formulas (3)' },
            { id: 'business', label: isRtl ? 'التجارة والمقر (2)' : 'Business & Facility (2)' },
            { id: 'ai_news', label: isRtl ? 'الذكاء والأخبار (3)' : 'AI & Trends (3)' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id as any)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* ===================== ZONE 4: THE 12 DYNAMIC PORTAL WINDOWS ===================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPortals.map((portal) => {
          const currentNewsIdx = portalIndexes[portal.id] || 0;
          const rawNews = portal.news[currentNewsIdx] || portal.news[0];
          const currentNews =
            !isRtl && PORTAL_NEWS_EN[rawNews.id]
              ? { ...rawNews, ...PORTAL_NEWS_EN[rawNews.id] }
              : rawNews;
          const statsBadge =
            !isRtl && STATS_BADGE_EN[portal.id]
              ? STATS_BADGE_EN[portal.id]
              : portal.statsBadge;
          
          // Current changing icon index
          const iconIdx = currentNewsIdx % portal.icons.length;
          const ActiveIcon = portal.icons[iconIdx];
          const isAnimating = animatingPortals[portal.id];

          return (
            <div
              key={portal.id}
              onClick={() => handleCardClick(portal)}
              className={`group relative flex flex-col justify-between bg-white rounded-2xl border border-stone-200/90 shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden cursor-pointer ${portal.borderGlow}`}
            >
              
              {/* Top Card Header */}
              <div className="p-5 pb-3">
                <div className="flex items-start justify-between gap-3 mb-3">
                  
                  {/* Dynamic Changing Icon Badge with Smooth Animated Rotation */}
                  <div className="relative">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-sm border border-stone-200/80 ${portal.accentColor} ${
                        isAnimating ? 'scale-110 rotate-12 ring-4 ring-amber-400/30' : 'scale-100 rotate-0'
                      }`}
                    >
                      <ActiveIcon className="w-6 h-6 transition-transform duration-300 group-hover:scale-110" />
                    </div>

                    {/* Mini live pulse indicator */}
                    <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white animate-pulse" />
                  </div>

                  {/* Top Stats Tag & Portal Number */}
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md border border-stone-200">
                      {statsBadge}
                    </span>
                    <span className="text-[10px] text-amber-700 font-semibold flex items-center gap-1">
                      <Radio className="w-2.5 h-2.5 text-emerald-500" />
                      <span>{isRtl ? 'متصل بالمعمل' : 'Live Sync'}</span>
                    </span>
                  </div>
                </div>

                {/* Portal Title & Subtitle */}
                <div>
                  <h3 className="text-base sm:text-lg font-bold font-serif-luxury text-stone-900 group-hover:text-amber-800 transition-colors">
                    {isRtl ? portal.titleAr : (portal.titleEn || portal.titleAr)}
                  </h3>
                  <p className="text-[11px] text-stone-500 line-clamp-1 mt-0.5 font-light">
                    {isRtl ? portal.subtitleAr : (SUBTITLE_EN_MAP[portal.id] || portal.subtitleAr)}
                  </p>
                </div>
              </div>

              {/* Dynamic News Window (نافذة المحتوى المتجدد كأنه خبر مستمر عن المنفذ) */}
              <div className="px-5 py-3">
                <div
                  className={`rounded-xl p-3.5 border transition-all duration-300 relative overflow-hidden bg-stone-50/90 border-stone-200/90 group-hover:border-amber-300/80 group-hover:bg-amber-50/40 ${
                    isAnimating ? 'ring-2 ring-amber-400/40 bg-amber-50/70' : ''
                  }`}
                >
                  
                  {/* Subtle Top Indicator: News Badge & Timing */}
                  <div className="flex items-center justify-between gap-2 mb-2 text-[10px]">
                    <span className="font-bold text-amber-800 flex items-center gap-1">
                      <Flame className="w-3 h-3 text-amber-600" />
                      <span>{currentNews.badge}</span>
                    </span>
                    <span className="text-stone-400 font-medium">{currentNews.timestamp}</span>
                  </div>

                  {/* News Title & Detailed Content */}
                  <div className="space-y-1.5 min-h-[72px]">
                    <h4 className="text-xs font-bold text-stone-900 leading-snug line-clamp-2">
                      {currentNews.title}
                    </h4>
                    <p className="text-[11px] text-stone-600 leading-relaxed line-clamp-2 font-normal">
                      {currentNews.description}
                    </p>
                  </div>

                  {/* News Metric Kicker & Navigation Controls */}
                  <div className="pt-2.5 mt-2 border-t border-stone-200/70 flex items-center justify-between text-[10px]">
                    <span className="font-semibold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-300/50">
                      {currentNews.metric}
                    </span>

                    {/* Manual Prev / Next arrows to flick through news inside window */}
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => handlePortalStep(portal.id, 'prev', e)}
                        className="w-5 h-5 rounded-md bg-stone-200/70 hover:bg-stone-300 text-stone-700 flex items-center justify-center transition-colors cursor-pointer"
                        title={isRtl ? 'الخبر السابق عن المنفذ' : 'Previous update'}
                      >
                        {isRtl ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
                      </button>

                      {/* Dots indicator for current news */}
                      <span className="text-[9px] text-stone-400 font-mono px-1">
                        {currentNewsIdx + 1}/{portal.news.length}
                      </span>

                      <button
                        onClick={(e) => handlePortalStep(portal.id, 'next', e)}
                        className="w-5 h-5 rounded-md bg-stone-200/70 hover:bg-stone-300 text-stone-700 flex items-center justify-center transition-colors cursor-pointer"
                        title={isRtl ? 'الخبر التالي عن المنفذ' : 'Next update'}
                      >
                        {isRtl ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Action Footer */}
              <div className="p-5 pt-2 flex items-center justify-between border-t border-stone-100 bg-stone-50/50 mt-1">
                <span className="text-[11px] font-semibold text-stone-500 group-hover:text-amber-800 transition-colors flex items-center gap-1">
                  <span>{currentNews.actionHint}</span>
                </span>

                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 group-hover:text-amber-900 group-hover:translate-x-[-3px] transition-transform">
                  <span>{isRtl ? 'دخول المنفذ' : 'Enter Portal'}</span>
                  {isRtl ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ===================== ZONE 5: BOTTOM LUXURY PERFUMERY TIPS STRIP ===================== */}
      <section className="bg-gradient-to-r from-stone-900 via-stone-900 to-amber-950 text-white rounded-3xl p-6 sm:p-8 border border-amber-800/30 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-right">
          <div className="inline-flex items-center gap-2 text-amber-400 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{isRtl ? 'معيار شام الذهبي لصناعة العطور الفاخرة' : 'Sham Golden Standard for Haute Parfumerie'}</span>
          </div>
          <h3 className="text-lg sm:text-xl font-bold font-serif-luxury text-stone-100">
            {isRtl ? '«العطر ليس مجرد رائحة، بل هو ميزان كيميائي ونوتات متناغمة وهوية لا تُنسى»' : '«A fragrance is not merely a scent; it is chemical equilibrium, harmonious notes, and an unforgettable identity»'}
          </h3>
          <p className="text-xs text-stone-300 max-w-2xl font-light">
            {isRtl
              ? 'استفد من الدمج بين ميزان المعمل التحليلي، حاسبة الكحول، ومكتبة الوصفات العالمية للحصول على تركيبة مطابقة لأعلى معايير الإيفرا العالمية.'
              : 'Leverage the synergy between analytical scales, alcohol dilution calculators, and the iconic formula library for compliance with IFRA standards.'}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onNavigate('concentration')}
            className="px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            {isRtl ? 'بدء تصميم عطر جديد' : 'Start New Formulation'}
          </button>
          <button
            onClick={onOpenSpecModal}
            className="px-4 py-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 font-semibold text-xs transition-all cursor-pointer"
          >
            {isRtl ? 'طباعة بطاقة التصنيع' : 'Print Manufacturing Spec Sheet'}
          </button>
        </div>
      </section>

    </div>
  );
};
