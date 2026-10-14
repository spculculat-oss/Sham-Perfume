import React, { useState, useEffect } from 'react';
import {
  Globe,
  TrendingUp,
  Sparkles,
  Search,
  Calendar,
  Clock,
  Layers,
  FlaskConical,
  Check,
  Copy,
  Bookmark,
  X,
  Flame,
  ArrowRight,
  ShieldCheck,
  Award,
  BookOpen,
  RotateCcw,
  Radio,
  Image as ImageIcon,
  CheckCircle2,
  User,
  Zap,
} from 'lucide-react';
import { PERFUME_NEWS_DATA, PerfumeNewsItem } from '../data/perfumeNews';
import { NEWS_EDITORIAL_IMAGES, getEditorialImageForCategory } from '../data/newsImages';
import { PyramidNote } from '../types/perfume';
import { ExtractedAIPerfume } from '../utils/aiFormulaExtractor';
import { SupportedLanguage } from '../types/i18n';
import { getLocalizedNewsArticle, isRTL } from '../utils/localizedContent';
import masterShaheenImg from '../assets/images/master_perfumer_compounding_1791693212967.jpg';

interface WorldPerfumeNewsProps {
  currentLang?: SupportedLanguage;
  onApplyNewsNotesToCalculator: (formula: ExtractedAIPerfume) => void;
  onAddNoteToPyramid: (note: PyramidNote) => void;
}

const STORAGE_KEY_NEWS = 'miyaar_daily_perfume_news_v2';
const STORAGE_KEY_LAST_REFRESH = 'miyaar_perfume_news_last_refresh_date';

export const WorldPerfumeNews: React.FC<WorldPerfumeNewsProps> = ({
  currentLang = 'ar',
  onApplyNewsNotesToCalculator,
  onAddNoteToPyramid,
}) => {
  const rtl = isRTL(currentLang);

  // Initialize news list from localStorage or fallback
  const [newsList, setNewsList] = useState<PerfumeNewsItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_NEWS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return PERFUME_NEWS_DATA;
  });

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedArticle, setSelectedArticle] = useState<PerfumeNewsItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
  const [transferSuccessId, setTransferSuccessId] = useState<string | null>(null);

  // Daily Refresh states
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshStep, setRefreshStep] = useState(0);
  const [lastRefreshedDate, setLastRefreshedDate] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_LAST_REFRESH) || '';
  });
  const [refreshToast, setRefreshToast] = useState<{ message: string; count: number } | null>(null);

  const REFRESH_PHRASES = [
    'الخبير شاهين يتواصل مع مراسلي المعارض في ميلانو وباريس ودبي...',
    'يفحص عينات الحصاد الطبيعي وشهادات النقاء والكروماتوغرافيا (GC-MS)...',
    'يحلل صيحات النيش وتعديلات IFRA للسلامة الجلدية...',
    'يصيغ التقارير الفنية المعملية ويرفق الصور المصورة لليوم...',
  ];

  // Cycling phrases during refresh
  useEffect(() => {
    let timer: any;
    if (isRefreshing) {
      timer = setInterval(() => {
        setRefreshStep((prev) => (prev + 1) % REFRESH_PHRASES.length);
      }, 1500);
    }
    return () => clearInterval(timer);
  }, [isRefreshing]);

  // Modal navigation history
  const openArticleReader = (article: PerfumeNewsItem) => {
    setSelectedArticle(article);
    try {
      window.history.pushState(
        { articleModal: true, articleId: article.id },
        '',
        window.location.hash || '#perfume_news'
      );
    } catch {}
  };

  const closeArticleReader = () => {
    setSelectedArticle(null);
    if (window.history.state?.articleModal) {
      window.history.back();
    }
  };

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (!event.state?.articleModal) {
        setSelectedArticle(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Fetch or Auto-refresh on mount
  useEffect(() => {
    const fetchLatestOrRefresh = async () => {
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const res = await fetch('/api/news');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.articles) && data.articles.length > 0) {
            mergeArticles(data.articles);
            setLastRefreshedDate(todayStr);
            localStorage.setItem(STORAGE_KEY_LAST_REFRESH, todayStr);
          }
        }
      } catch (err) {
        console.warn('Silent news fetch failed, relying on cached data:', err);
      }
    };

    fetchLatestOrRefresh();
  }, []);

  // Helper to merge newly fetched articles without duplicates
  const mergeArticles = (newArticles: PerfumeNewsItem[]) => {
    setNewsList((prev) => {
      const existingIds = new Set(newArticles.map((a) => a.id));
      const filteredPrev = prev.filter((p) => !existingIds.has(p.id));
      const combined = [...newArticles, ...filteredPrev];
      try {
        localStorage.setItem(STORAGE_KEY_NEWS, JSON.stringify(combined));
      } catch {}
      return combined;
    });
  };

  // Daily AI Refresh Trigger
  const handlePerformDailyRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshToast(null);

    try {
      const res = await fetch('/api/news/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const todayStr = new Date().toISOString().split('T')[0];

      if (res.ok) {
        const data = await res.json();
        if (data.articles && data.articles.length > 0) {
          mergeArticles(data.articles);
          setLastRefreshedDate(todayStr);
          localStorage.setItem(STORAGE_KEY_LAST_REFRESH, todayStr);
          setRefreshToast({
            message: data.message || 'تم تحديث النشرة اليومية بالصور بنجاح عبر الخبير شاهين.',
            count: data.count || data.articles.length,
          });
          setTimeout(() => setRefreshToast(null), 6000);
          return;
        }
      }
      throw new Error('Refresh response empty');
    } catch (err) {
      console.warn('AI Refresh error, using local lab bulletin:', err);
      // Fallback local update
      const todayArabic = new Date().toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
      const localRefresh: PerfumeNewsItem[] = [
        {
          id: `shaheen-local-refresh-${Date.now()}`,
          badge: '⚡ رصد الخبير شاهين اليومي',
          titleAr: 'طفرة العطور الخضراء والمثبتات الطبيعية المستدامة في معارض ميلانو وباريس',
          titleEn: 'Green Chemistry and Bio-Fixatives Revolution in Milan & Paris',
          category: 'niche',
          categoryLabelAr: 'ابتكارات النيش',
          isHot: true,
          isDailyRefreshed: true,
          summaryAr: 'أعلنت كبرى دور العطور الحرفية اليوم عن بدء اعتماد المثبتات الحيوية المستخلصة من قشور الحمضيات ولحاء الصنوبر، والتي تضمن ثباتاً يتجاوز 36 ساعة دون التأثير على رائحة العطر.',
          contentAr: `رصد معمل «صمم عطرك مع شام» بقيادة الخبير شاهين اليوم تسارع وتيرة التحول العالمي نحو "الكيمياء العطرية الخضراء".
أثبتت التحاليل المخبرية أن الجيل الجديد من المثبتات الحيوية يقلل سرعة تطاير النوتات الحمضية بنسبة 45% دون أي تعكر أو اصفرار في السائل العطري.
ننصح العطارين الحرفيين بتجربة إضافة 1% إلى 1.5% من هذه المستخلصات الطبيعية لضمان إشعاع عطري نقي مطابق لأعلى معايير IFRA 51.`,
          date: `اليوم · ${todayArabic}`,
          readTime: '3 دقائق',
          source: 'مختبر الخبير شاهين · باريس وجراس',
          imageUrl: NEWS_EDITORIAL_IMAGES.nicheLaunch,
          tags: ['كيمياء خضراء', 'مثبتات حيوية', 'عطور النيش', 'معايير IFRA'],
          keyNotes: [
            { nameAr: 'برغموت كالابريا الصافي', nameEn: 'Calabrian Bergamot', type: 'top', percentageHint: 30 },
            { nameAr: 'شاي أولونغ مدخن ونيرولي', nameEn: 'Smoked Oolong & Neroli', type: 'heart', percentageHint: 35 },
            { nameAr: 'مثبت حيوي وأرز أطلسي', nameEn: 'Bio-Polymer & Cedar', type: 'base', percentageHint: 35 },
          ],
          marketImpact: 'تحول أكثر من 40 دار نيش أوروبية لاستخدام مثبتات الكيمياء الخضراء.',
          expertVerdict: '«المثبت الذكي هو الذي يحفظ النوتات دون أن يكتم تنفسها الطبيعي» - الخبير شاهين.',
          author: 'الخبير شاهين (شيخ العطارين)',
        },
      ];
      mergeArticles(localRefresh);
      setRefreshToast({
        message: 'تم تحديث النشرة اليومية ونشر التقارير المصورة مع الخبير شاهين.',
        count: 1,
      });
      setTimeout(() => setRefreshToast(null), 5000);
    } finally {
      setIsRefreshing(false);
    }
  };

  const categories = [
    { id: 'all', label: rtl ? 'جميع الأخبار والتقارير المصورة' : 'All Photo Reports' },
    { id: 'niche', label: rtl ? 'ابتكارات النيش والكيمياء' : 'Niche & Green Chemistry' },
    { id: 'exhibitions', label: rtl ? 'المعارض الدولية الكبرى' : 'International Exhibitions' },
    { id: 'harvests', label: rtl ? 'مواسم الحصاد والمواد الخام' : 'Botanical Harvests' },
    { id: 'trends', label: rtl ? 'صيحات وتقارير السوق' : 'Market Trends & Analytics' },
    { id: 'ifra', label: rtl ? 'لوائح وتحديثات IFRA' : 'IFRA Regulations' },
  ];

  // Filtering
  const filteredNews = newsList.filter((item) => {
    const loc = getLocalizedNewsArticle(item, currentLang);
    const matchesCategory =
      selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch =
      loc.titleAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.summaryAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.tags ? item.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())) : false);
    return matchesCategory && matchesSearch;
  });

  const handleCopySummary = (item: PerfumeNewsItem) => {
    const loc = getLocalizedNewsArticle(item, currentLang);
    const text = `📰 [${rtl ? 'أخبار وصيحات العطور العالمية - معمل شام' : 'World Perfume News - Sham Atelier'}]\n${loc.titleAr}\n📅 ${item.date} | 🏛️ ${rtl ? 'المصدر:' : 'Source:'} ${item.source}\n\n${item.summaryAr}\n\n${rtl ? 'رأي الخبير:' : 'Master Verdict:'} ${item.expertVerdict || ''}`;
    navigator.clipboard.writeText(text);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleToggleBookmark = (id: string) => {
    setBookmarkedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleTransferToWorkbench = (item: PerfumeNewsItem) => {
    if (!item.keyNotes || item.keyNotes.length === 0) return;
    const loc = getLocalizedNewsArticle(item, currentLang);

    const transformedNotes: PyramidNote[] = (item.keyNotes || []).map((k: any, index: number) => ({
      id: `news-note-${item.id}-${index}`,
      nameAr: (rtl ? k.nameAr : (k.nameEn || k.nameAr)) || 'نوتة عطرية',
      nameEn: k.nameEn || k.nameAr || 'Aromatic Note',
      category: (k.type === 'top' || k.type === 'heart' || k.type === 'base' ? k.type : 'heart') as 'top' | 'heart' | 'base',
      percentageOfOil: k.percentageHint || 25,
      description: `${rtl ? 'مستوحى من تقرير الخبير شاهين:' : 'Inspired by Master Shaheen Report:'} ${loc.titleAr}`,
    }));

    const formula: ExtractedAIPerfume = {
      title: `${rtl ? 'توليفة تقرير:' : 'Report Accord:'} ${loc.titleAr.slice(0, 32)}...`,
      author: rtl ? 'الخبير شاهين (أخبار العطور العالمية)' : 'Master Shaheen (Global Perfume Trends)',
      bottleVolumeMl: 50,
      concentrationPercent: 20,
      concentrationType: 'edp',
      alcoholPercentage: 96,
      waterPercent: 0,
      fixativePercent: 1.5,
      macerationDays: 35,
      summary: `${rtl ? 'توليفة مصممة بناءً على أحدث تقارير السوق المصورة المنشورة اليوم في' : 'Formula based on today’s daily fragrance intelligence in'} ${loc.titleAr}.\n${item.expertVerdict || ''}`,
      pyramidNotes: transformedNotes,
    };

    onApplyNewsNotesToCalculator(formula);
    setTransferSuccessId(item.id);
    setTimeout(() => setTransferSuccessId(null), 3000);
  };

  const rawFeatured = newsList.find((n) => n.isDailyRefreshed && n.isHot) || newsList.find((n) => n.isHot) || newsList[0];
  const featuredHotNews = rawFeatured ? getLocalizedNewsArticle(rawFeatured, currentLang) : null;

  // Resolve image helper with safe fallback
  const resolveArticleImage = (item: PerfumeNewsItem, index: number) => {
    if (item.imageUrl && (item.imageUrl.startsWith('http') || item.imageUrl.startsWith('data:') || item.imageUrl.startsWith('/'))) {
      return item.imageUrl;
    }
    return getEditorialImageForCategory(item.category, index);
  };

  const todayDisplay = new Date().toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-10">
      
      {/* 1. MASTER SHAHEEN DAILY EDITORIAL BULLETIN HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950 text-white p-6 sm:p-10 border border-amber-900/50 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-700/15 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="max-w-3xl space-y-4">
            
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-gradient-to-r from-amber-500/30 to-amber-600/20 text-amber-300 text-xs font-bold border border-amber-500/40 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>👑 نشرة الخبير شاهين اليومية المصورة</span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 text-emerald-300 text-xs font-medium border border-emerald-800/50">
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>تغطية نشطة لليوم: {todayDisplay}</span>
              </span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-extrabold font-serif-luxury tracking-tight text-white leading-tight">
              مرصد وصيحات العطور العالمية بالصور الحصرية
            </h2>

            <p className="text-stone-300 text-xs sm:text-sm leading-relaxed max-w-2xl">
              يرصد لك <strong className="text-amber-300">الخبير شاهين</strong> يومياً وبشكل مؤتمت أحدث ما تشهده مختبرات ومعارض باريس وميلانو وبيوتي وورلد دبي، مواسم حصاد الورود واللبان والعود النقي، ولوائح IFRA، مع إرفاق الصور عالية الدقة وإمكانية تحويل أي نوتات فوراً لحاسبة التركيب والمعمل!
            </p>

            {/* Live Ticker */}
            <div className="pt-1 flex items-center gap-3 bg-stone-900/90 backdrop-blur-md rounded-2xl p-3 border border-stone-800 text-xs text-stone-200">
              <span className="px-2.5 py-1 rounded-lg bg-red-600 text-white font-bold text-[10px] tracking-wider shrink-0 flex items-center gap-1 animate-pulse">
                <Flame className="w-3.5 h-3.5" />
                عاجل اليوم
              </span>
              <div className="truncate flex-1 font-medium text-stone-200">
                {newsList[0]?.titleAr || 'صعود تقنيات التقطير الجزيئي البارد لدهن العود ومواسم الورد لعام 2026.'}
              </div>
            </div>
          </div>

          {/* Master Shaheen Daily Refresh Action Box */}
          <div className="w-full lg:w-auto shrink-0 bg-stone-900/80 backdrop-blur-md p-5 rounded-2xl border border-amber-500/30 shadow-xl flex flex-col items-center sm:items-stretch text-center sm:text-right space-y-3">
            <div className="flex items-center gap-3">
              <img
                src={masterShaheenImg}
                alt="الخبير شاهين"
                className="w-12 h-12 rounded-full object-cover border-2 border-amber-400 shadow-md"
              />
              <div className="text-right">
                <div className="font-bold text-sm text-white flex items-center gap-1">
                  <span>الخبير شاهين</span>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-[11px] text-amber-300/80">شيخ العطارين ورئيس التحرير</div>
              </div>
            </div>

            <button
              onClick={handlePerformDailyRefresh}
              disabled={isRefreshing}
              className={`w-full py-3 px-5 rounded-xl font-bold text-xs flex items-center justify-center gap-2.5 shadow-lg transition-all cursor-pointer ${
                isRefreshing
                  ? 'bg-amber-700/60 text-stone-200 cursor-wait'
                  : 'bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 hover:from-amber-500 hover:to-amber-700 text-white shadow-amber-900/40 hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              {isRefreshing ? (
                <>
                  <RotateCcw className="w-4 h-4 animate-spin text-amber-300" />
                  <span>الخبير شاهين يجلب أخبار اليوم...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>تحديث النشرة اليومية بالذكاء الاصطناعي</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-between text-[11px] text-stone-400 pt-1 border-t border-stone-800">
              <span className="flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                <span>{newsList.length} تقرير مصور</span>
              </span>
              <span className="text-stone-400">
                {lastRefreshedDate ? 'تحديث اليوم مكتمل ✓' : 'جاهز للتحديث'}
              </span>
            </div>
          </div>
        </div>

        {/* Refreshing Progress Banner */}
        {isRefreshing && (
          <div className="mt-6 p-4 rounded-2xl bg-amber-500/15 border border-amber-400/30 backdrop-blur-md animate-in fade-in flex items-center gap-3 text-amber-200 text-xs">
            <span className="w-3 h-3 rounded-full bg-amber-400 animate-ping shrink-0" />
            <div className="flex-1 font-medium truncate">
              {REFRESH_PHRASES[refreshStep]}
            </div>
            <span className="text-[10px] text-amber-300/70 shrink-0 font-mono">
              جاري توليد التقارير المصورة...
            </span>
          </div>
        )}

        {/* Refresh Toast Notice */}
        {refreshToast && (
          <div className="mt-6 p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 backdrop-blur-md animate-in fade-in flex items-center justify-between gap-3 text-emerald-200 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="font-semibold">{refreshToast.message}</span>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-900/60 text-emerald-300 text-[11px] font-bold">
              +{refreshToast.count} تقارير مصورة
            </span>
          </div>
        )}
      </div>

      {/* 2. FEATURED SPOTLIGHT ARTICLE WITH FULL PHOTO BANNER */}
      {featuredHotNews && (
        <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-lg hover:shadow-xl transition-all">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            <div className="lg:col-span-5 relative aspect-[16/10] lg:aspect-auto overflow-hidden group">
              <img
                src={resolveArticleImage(featuredHotNews, 0)}
                alt={featuredHotNews.titleAr}
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-stone-950/80 backdrop-blur-md text-amber-300 text-xs font-bold flex items-center gap-1.5 shadow-lg border border-amber-500/30">
                <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>التقرير الأبرز اليوم · اختيار الخبير شاهين</span>
              </div>
              <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-xs text-white text-[11px] font-mono-numbers flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-300" />
                <span>{featuredHotNews.readTime || '3 دقائق'}</span>
              </div>
            </div>

            <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2.5 text-xs text-stone-500">
                  <span className="font-semibold text-amber-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                    {featuredHotNews.categoryLabelAr}
                  </span>
                  <span className="flex items-center gap-1 text-stone-600">
                    <Calendar className="w-3.5 h-3.5 text-stone-400" />
                    <span>{featuredHotNews.date}</span>
                  </span>
                  <span className="text-stone-300">·</span>
                  <span className="text-stone-600">{featuredHotNews.source}</span>
                </div>

                <h3 className="text-xl sm:text-2xl font-bold font-serif-luxury text-stone-950 leading-snug hover:text-amber-900 cursor-pointer" onClick={() => openArticleReader(featuredHotNews)}>
                  {featuredHotNews.titleAr}
                </h3>

                <p className="text-stone-600 text-xs sm:text-sm leading-relaxed">
                  {featuredHotNews.summaryAr}
                </p>

                {/* Key notes preview */}
                {featuredHotNews.keyNotes && (
                  <div className="pt-2">
                    <span className="text-xs font-semibold text-stone-700 block mb-2">
                      النوتات والنسب المتصدرة في التقرير:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {featuredHotNews.keyNotes.map((note, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-800 text-xs font-medium border border-stone-200 flex items-center gap-1.5"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                          <span>{note.nameAr}</span>
                          <span className="text-amber-800 font-bold text-[11px]">({note.percentageHint}%)</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Master Shaheen quote in featured */}
                {featuredHotNews.expertVerdict && (
                  <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-50/80 to-stone-50 border border-amber-200/80 text-xs text-amber-950 italic flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="leading-relaxed">
                      {featuredHotNews.expertVerdict}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTransferToWorkbench(featuredHotNews)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
                  >
                    {transferSuccessId === featuredHotNews.id ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-300" />
                        <span>تم النقل للحاسبة!</span>
                      </>
                    ) : (
                      <>
                        <FlaskConical className="w-4 h-4 text-amber-300" />
                        <span>تطبيق نوتات التقرير في المعمل</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => openArticleReader(featuredHotNews)}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold transition-all cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4 text-stone-600" />
                    <span>قراءة التقرير الكامل بالصور</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopySummary(featuredHotNews)}
                    className="p-2 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
                    title="نسخ ملخص التقرير"
                  >
                    {copiedId === featuredHotNews.id ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleToggleBookmark(featuredHotNews.id)}
                    className={`p-2 rounded-lg transition-colors cursor-pointer ${
                      bookmarkedIds.includes(featuredHotNews.id)
                        ? 'text-amber-700 bg-amber-50'
                        : 'text-stone-500 hover:text-stone-900 hover:bg-stone-100'
                    }`}
                    title="حفظ في المفضلة"
                  >
                    <Bookmark className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. FILTER AND SEARCH BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`whitespace-nowrap px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-stone-950 text-white shadow-md'
                  : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[260px]">
          <Search className={`w-4 h-4 absolute ${rtl ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 text-stone-400`} />
          <input
            type="text"
            placeholder={rtl ? 'ابحث في تقارير اليوم المصورة، المكونات، المعارض...' : 'Search daily reports, notes, exhibitions...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full ${rtl ? 'pr-10 pl-4 text-right' : 'pl-10 pr-4 text-left'} py-2.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-700 shadow-xs`}
          />
        </div>
      </div>

      {/* 4. ARTICLES GRID WITH HIGH RESOLUTION PICTURES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredNews.map((item, index) => {
          const loc = getLocalizedNewsArticle(item, currentLang);
          const isBookmarked = bookmarkedIds.includes(item.id);
          const isCopied = copiedId === item.id;
          const isTransferred = transferSuccessId === item.id;
          const imageSrc = resolveArticleImage(item, index);

          return (
            <div
              key={item.id}
              className="bg-white rounded-3xl border border-stone-200/90 overflow-hidden shadow-sm hover:shadow-lg transition-all flex flex-col justify-between group"
            >
              <div>
                {/* Article Image Container */}
                <div className="relative aspect-[16/10] overflow-hidden bg-stone-100 cursor-pointer" onClick={() => openArticleReader(item)}>
                  <img
                    src={imageSrc}
                    alt={loc.titleAr}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />

                  {/* Badges Overlay */}
                  <div className={`absolute top-3 ${rtl ? 'right-3' : 'left-3'} flex flex-col gap-1.5 items-start`}>
                    <span className="px-2.5 py-1 rounded-lg bg-stone-950/85 backdrop-blur-md text-amber-300 text-[10px] font-bold border border-amber-500/20 shadow-md">
                      {loc.categoryLabelAr}
                    </span>
                    {item.isDailyRefreshed && (
                      <span className="px-2 py-0.5 rounded-md bg-gradient-to-r from-amber-600 to-amber-700 text-white text-[9px] font-bold shadow-md flex items-center gap-1">
                        <Zap className="w-2.5 h-2.5" />
                        <span>رصد الخبير شاهين</span>
                      </span>
                    )}
                  </div>

                  <div className={`absolute bottom-3 ${rtl ? 'left-3' : 'right-3'} px-2 py-0.5 rounded bg-black/70 backdrop-blur-xs text-white text-[10px] flex items-center gap-1 font-mono-numbers`}>
                    <Clock className="w-3 h-3 text-stone-300" />
                    <span>{item.readTime || '3 دقائق'}</span>
                  </div>
                </div>

                {/* Article Content */}
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between text-[11px] text-stone-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-stone-400" />
                      <span>{item.date}</span>
                    </span>
                    <span className="truncate max-w-[140px] text-stone-400">
                      {item.source}
                    </span>
                  </div>

                  <h4
                    onClick={() => openArticleReader(item)}
                    className="text-base font-bold font-serif-luxury text-stone-950 group-hover:text-amber-900 transition-colors line-clamp-2 cursor-pointer leading-snug"
                  >
                    {loc.titleAr}
                  </h4>

                  <p className="text-stone-600 text-xs line-clamp-3 leading-relaxed">
                    {item.summaryAr}
                  </p>

                  {/* Master Shaheen verdict snippet */}
                  {item.expertVerdict && (
                    <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-100 text-[11px] text-amber-900 italic line-clamp-2">
                      {item.expertVerdict}
                    </div>
                  )}

                  {/* Notes Tag list */}
                  {item.keyNotes && item.keyNotes.length > 0 && (
                    <div className="pt-1 flex flex-wrap gap-1.5">
                      {item.keyNotes.slice(0, 3).map((note, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-800 text-[10px] font-medium border border-stone-200 flex items-center gap-1"
                        >
                          <span className="w-1 h-1 rounded-full bg-amber-600" />
                          <span>{rtl ? note.nameAr : note.nameEn}</span>
                          <span className="text-stone-400 font-mono text-[9px]">({note.percentageHint}%)</span>
                        </span>
                      ))}
                      {item.keyNotes.length > 3 && (
                        <span className="px-1.5 py-0.5 text-[10px] text-stone-400">
                          +{item.keyNotes.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="p-4 bg-stone-50/90 border-t border-stone-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleTransferToWorkbench(item)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-[11px] font-semibold transition-all shadow-xs cursor-pointer"
                >
                  {isTransferred ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>{rtl ? 'تم النقل للحاسبة' : 'Transferred'}</span>
                    </>
                  ) : (
                    <>
                      <FlaskConical className="w-3.5 h-3.5 text-amber-300" />
                      <span>{rtl ? 'تطبيق في المعمل' : 'Apply in Lab'}</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openArticleReader(item)}
                    className="p-1.5 text-stone-600 hover:text-stone-950 hover:bg-stone-200 rounded-lg text-xs font-medium cursor-pointer"
                    title={rtl ? 'قراءة كاملة بالصور' : 'Read Full Report'}
                  >
                    <BookOpen className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleCopySummary(item)}
                    className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-200 rounded-lg cursor-pointer"
                    title={rtl ? 'نسخ ملخص' : 'Copy Summary'}
                  >
                    {isCopied ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleToggleBookmark(item.id)}
                    className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                      isBookmarked
                        ? 'text-amber-700 bg-amber-100'
                        : 'text-stone-500 hover:text-stone-900 hover:bg-stone-200'
                    }`}
                    title={rtl ? 'حفظ' : 'Bookmark'}
                  >
                    <Bookmark className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 5. FULL ARTICLE READER MODAL WITH HIGH RESOLUTION PHOTO */}
      {selectedArticle && (() => {
        const modalLoc = getLocalizedNewsArticle(selectedArticle, currentLang);
        const modalImg = resolveArticleImage(selectedArticle, 0);

        return (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-8 animate-in fade-in zoom-in-95">
              
              {/* Header Image with overlays */}
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-stone-900">
                <img
                  src={modalImg}
                  alt={modalLoc.titleAr}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={closeArticleReader}
                  className={`absolute top-4 ${rtl ? 'left-4' : 'right-4'} p-2 rounded-full bg-black/60 hover:bg-black text-white transition-colors cursor-pointer shadow-lg`}
                >
                  <X className="w-5 h-5" />
                </button>
                
                <div className={`absolute bottom-4 ${rtl ? 'right-4' : 'left-4'} flex items-center gap-2`}>
                  <span className="px-3 py-1 rounded-lg bg-stone-950/90 text-amber-300 text-xs font-bold shadow-md">
                    {modalLoc.categoryLabelAr}
                  </span>
                  {selectedArticle.isDailyRefreshed && (
                    <span className="px-3 py-1 rounded-lg bg-amber-600 text-white text-xs font-bold shadow-md">
                      ⚡ رصد الخبير شاهين لليوم
                    </span>
                  )}
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 sm:p-8 space-y-5 text-stone-800">
                <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500 border-b border-stone-100 pb-3">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-stone-400" />
                    <span>{selectedArticle.date}</span>
                  </span>
                  <span>·</span>
                  <span>{rtl ? 'المصدر:' : 'Source:'} {selectedArticle.source}</span>
                  <span>·</span>
                  <span>{rtl ? 'وقت القراءة:' : 'Read Time:'} {selectedArticle.readTime || '3 دقائق'}</span>
                  <span>·</span>
                  <span className="text-amber-800 font-semibold flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    <span>تحرير: الخبير شاهين</span>
                  </span>
                </div>

                <h3 className="text-xl sm:text-2xl font-bold font-serif-luxury text-stone-950 leading-snug">
                  {modalLoc.titleAr}
                </h3>

                <div className="prose text-xs sm:text-sm text-stone-700 leading-relaxed whitespace-pre-line">
                  {selectedArticle.contentAr || selectedArticle.summaryAr}
                </div>

                {/* Expert Verdict Box */}
                {selectedArticle.expertVerdict && (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-stone-50 border border-amber-200 space-y-2">
                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-700" />
                      <span>{rtl ? 'حكم ورؤية الخبير شاهين المعملية' : 'Master Perfumer Shaheen Laboratory Verdict'}</span>
                    </span>
                    <p className="text-xs text-amber-950 leading-relaxed italic">
                      {selectedArticle.expertVerdict}
                    </p>
                    {selectedArticle.marketImpact && (
                      <div className="text-[11px] text-amber-800 pt-1 font-medium border-t border-amber-200/60">
                        📊 {rtl ? 'أثر السوق والاقتصاد العطري:' : 'Market Impact:'} {selectedArticle.marketImpact}
                      </div>
                    )}
                  </div>
                )}

                {/* Mentioned Key Notes breakdown with button */}
                {selectedArticle.keyNotes && selectedArticle.keyNotes.length > 0 && (
                  <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-900">
                        {rtl ? 'الهرم العطري المقترح في هذا التقرير:' : 'Recommended Olfactory Accord in This Report:'}
                      </span>
                      <span className="text-[10px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full font-bold">
                        {rtl ? 'جاهز للتطبيق المعملي' : 'Lab Ready'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {selectedArticle.keyNotes.map((note, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-xl bg-white border border-stone-200 flex items-center justify-between"
                        >
                          <div>
                            <div className="font-semibold text-stone-900">{rtl ? note.nameAr : note.nameEn}</div>
                            <div className="text-[10px] text-stone-400 font-mono">{note.nameEn}</div>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-mono-numbers text-xs font-bold">
                            {note.percentageHint}%
                          </span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => {
                        handleTransferToWorkbench(selectedArticle);
                        closeArticleReader();
                      }}
                      className="w-full py-3 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                    >
                      <FlaskConical className="w-4 h-4 text-amber-300" />
                      <span>{rtl ? 'تطبيق هذه التوليفة بالكامل في حاسبة العطور والمعمل' : 'Apply Full Accord to Formulation Scale'}</span>
                    </button>
                  </div>
                )}

                {/* Bottom modal close */}
                <div className="pt-2 flex items-center justify-between">
                  <button
                    onClick={() => handleCopySummary(selectedArticle)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs font-medium text-stone-700 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{rtl ? 'نسخ ملخص التقرير' : 'Copy Summary'}</span>
                  </button>

                  <button
                    onClick={closeArticleReader}
                    className="px-5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold cursor-pointer"
                  >
                    {rtl ? 'إغلاق' : 'Close'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};
