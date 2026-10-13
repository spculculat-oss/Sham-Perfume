import React, { useState, useEffect } from 'react';
import {
  Globe,
  TrendingUp,
  Sparkles,
  Search,
  Calendar,
  Clock,
  ExternalLink,
  Layers,
  FlaskConical,
  Check,
  Copy,
  Bookmark,
  Share2,
  X,
  Flame,
  ArrowRight,
  ShieldCheck,
  Award,
  BookOpen,
} from 'lucide-react';
import { PERFUME_NEWS_DATA, PerfumeNewsItem } from '../data/perfumeNews';
import { PyramidNote } from '../types/perfume';
import { ExtractedAIPerfume } from '../utils/aiFormulaExtractor';

import { SupportedLanguage } from '../types/i18n';
import { getLocalizedNewsArticle, getCommonLabel, isRTL } from '../utils/localizedContent';

interface WorldPerfumeNewsProps {
  currentLang?: SupportedLanguage;
  onApplyNewsNotesToCalculator: (formula: ExtractedAIPerfume) => void;
  onAddNoteToPyramid: (note: PyramidNote) => void;
}

export const WorldPerfumeNews: React.FC<WorldPerfumeNewsProps> = ({
  currentLang = 'ar',
  onApplyNewsNotesToCalculator,
  onAddNoteToPyramid,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedArticle, setSelectedArticle] = useState<PerfumeNewsItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
  const [transferSuccessId, setTransferSuccessId] = useState<string | null>(null);

  const rtl = isRTL(currentLang);

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

  const categories = [
    { id: 'all', label: rtl ? 'جميع الأخبار والتقارير' : 'All News & Reports' },
    { id: 'trends', label: rtl ? 'صيحات وتقارير السوق' : 'Market Trends & Analytics' },
    { id: 'exhibitions', label: rtl ? 'المعارض الدولية الكبرى' : 'International Exhibitions' },
    { id: 'harvests', label: rtl ? 'مواسم الحصاد والمواد الخام' : 'Botanical Harvests & Crops' },
    { id: 'ifra', label: rtl ? 'لوائح وتحديثات IFRA' : 'IFRA Regulations & Updates' },
    { id: 'niche', label: rtl ? 'ابتكارات النيش والكيمياء' : 'Niche Perfumery & Chemistry' },
  ];

  // Filtering
  const filteredNews = PERFUME_NEWS_DATA.filter((item) => {
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
    const text = `📰 [${rtl ? 'أخبار العطور العالمية - صمم عطرك مع شام' : 'World Perfume News - Sham Atelier'}]\n${loc.titleAr}\n📅 ${item.date} | 🏛️ ${rtl ? 'المصدر:' : 'Source:'} ${item.source}\n\n${item.summaryAr}\n\n${rtl ? 'رأي الخبير:' : 'Master Verdict:'} ${item.expertVerdict}`;
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
      description: `${rtl ? 'مستوحى من تقرير:' : 'Inspired by:'} ${loc.titleAr}`,
    }));

    const formula: ExtractedAIPerfume = {
      title: `${rtl ? 'توليفة تقرير:' : 'Report Accord:'} ${loc.titleAr.slice(0, 32)}...`,
      author: rtl ? 'تقرير أخبار العطور العالمية (شام)' : 'World Perfume Trends (Sham)',
      bottleVolumeMl: 50,
      concentrationPercent: 20,
      concentrationType: 'edp',
      alcoholPercentage: 96,
      waterPercent: 0,
      fixativePercent: 1.5,
      macerationDays: 35,
      summary: `${rtl ? 'توليفة حديثة مبنية على توجهات السوق العالمية في' : 'Modern formula based on global market trends in'} ${loc.titleAr}.\n${item.expertVerdict || ''}`,
      pyramidNotes: transformedNotes,
    };

    onApplyNewsNotesToCalculator(formula);
    setTransferSuccessId(item.id);
    setTimeout(() => setTransferSuccessId(null), 3000);
  };

  const rawFeatured = PERFUME_NEWS_DATA.find((n) => n.isHot) || PERFUME_NEWS_DATA[0];
  const featuredHotNews = getLocalizedNewsArticle(rawFeatured, currentLang);

  return (
    <div className="space-y-10">
      
      {/* Top Header with High Graphics luxury aesthetic */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950 text-white p-6 sm:p-10 border border-amber-900/40 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-700/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl space-y-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-semibold border border-amber-500/30">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>مرصد أخبار العطور العالمية</span>
            </span>
            <span className="text-stone-400 text-xs flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>تحديثات حية ومواكبة دور النيش ومواسم الحصاد الدولية</span>
            </span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-extrabold font-serif-luxury tracking-tight text-white leading-tight">
            آخر أخبار وتحولات عالم العطور وصيحات النيش الدولية
          </h2>

          <p className="text-stone-300 text-xs sm:text-sm leading-relaxed max-w-2xl">
            مساحتك المتجددة للاطلاع على قرارات منظمة IFRA العالمية، نتائج معارض ميلانو ودبي وباريس، مواسم حصاد الورود والعود النقي، مع إمكانية تحويل أي نوتات متصدرة في الأخبار مباشرة إلى معملك وحاسبة التركيب بنقرة واحدة!
          </p>

          {/* Quick Breaking Ticker */}
          <div className="pt-2 flex items-center gap-3 bg-stone-900/80 backdrop-blur-md rounded-xl p-2.5 sm:p-3 border border-stone-800 text-xs text-stone-300">
            <span className="px-2 py-0.5 rounded bg-red-600 text-white font-bold text-[10px] uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Flame className="w-3 h-3" />
              عاجل
            </span>
            <div className="truncate flex-1 font-medium">
              «إيسنس ميلانو» يؤكد صعود عطور الشاي المدخن والأمبروكسان المعدني، وحصاد استثنائي لورد غراس والطائف لعام 2026.
            </div>
          </div>
        </div>
      </div>

      {/* Featured Spotlight Card */}
      {featuredHotNews && (
        <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-lg hover:shadow-xl transition-all">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            <div className="lg:col-span-5 relative aspect-[16/10] lg:aspect-auto">
              <img
                src={featuredHotNews.imageUrl}
                alt={featuredHotNews.titleAr}
                className="w-full h-full object-cover object-center"
              />
              <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-stone-900/80 backdrop-blur-md text-amber-400 text-xs font-semibold flex items-center gap-1.5 shadow-md">
                <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>التقرير الأبرز هذا الأسبوع</span>
              </div>
            </div>

            <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-xs text-stone-500">
                  <span className="font-semibold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                    {featuredHotNews.categoryLabelAr}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{featuredHotNews.date}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{featuredHotNews.readTime}</span>
                  </span>
                </div>

                <h3 className="text-xl sm:text-2xl font-bold font-serif-luxury text-stone-950 leading-snug">
                  {featuredHotNews.titleAr}
                </h3>

                <p className="text-stone-600 text-xs sm:text-sm leading-relaxed">
                  {featuredHotNews.summaryAr}
                </p>

                {/* Key notes preview */}
                {featuredHotNews.keyNotes && (
                  <div className="pt-2">
                    <span className="text-xs font-semibold text-stone-700 block mb-2">
                      النوتات المتصدرة في التقرير:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {featuredHotNews.keyNotes.map((note, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-800 text-xs font-medium border border-stone-200 flex items-center gap-1"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                          <span>{note.nameAr}</span>
                          <span className="text-stone-400 text-[10px]">({note.percentageHint}%)</span>
                        </span>
                      ))}
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
                    className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium transition-all cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4 text-stone-600" />
                    <span>قراءة التقرير بالكامل</span>
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

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-4">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-stone-900 text-white shadow-sm'
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
            placeholder={rtl ? 'ابحث في الأخبار، المعارض، أو المكونات...' : 'Search trends, exhibitions, or notes...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full ${rtl ? 'pr-10 pl-4 text-right' : 'pl-10 pr-4 text-left'} py-2 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-700 shadow-xs`}
          />
        </div>
      </div>

      {/* Articles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredNews.map((item) => {
          const loc = getLocalizedNewsArticle(item, currentLang);
          const isBookmarked = bookmarkedIds.includes(item.id);
          const isCopied = copiedId === item.id;
          const isTransferred = transferSuccessId === item.id;

          return (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-stone-200/90 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                {/* Article Image */}
                <div className="relative aspect-[16/10] overflow-hidden bg-stone-100">
                  <img
                    src={item.imageUrl}
                    alt={loc.titleAr}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className={`absolute top-2.5 ${rtl ? 'right-2.5' : 'left-2.5'} px-2.5 py-1 rounded-md bg-stone-900/80 backdrop-blur-xs text-amber-300 text-[10px] font-semibold`}>
                    {loc.categoryLabelAr}
                  </div>
                  <div className={`absolute bottom-2.5 ${rtl ? 'left-2.5' : 'right-2.5'} px-2 py-0.5 rounded bg-black/60 backdrop-blur-xs text-white text-[10px] flex items-center gap-1 font-mono-numbers`}>
                    <Clock className="w-3 h-3 text-stone-300" />
                    <span>{item.readTime}</span>
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

                  {/* Notes Tag list */}
                  {item.keyNotes && item.keyNotes.length > 0 && (
                    <div className="pt-2 flex flex-wrap gap-1.5">
                      {item.keyNotes.slice(0, 3).map((note, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded bg-stone-50 text-stone-700 text-[10px] font-medium border border-stone-200"
                        >
                          {rtl ? note.nameAr : note.nameEn}
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
              <div className="p-4 bg-stone-50/80 border-t border-stone-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleTransferToWorkbench(item)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-800 hover:bg-amber-900 text-white text-[11px] font-semibold transition-all shadow-xs cursor-pointer"
                >
                  {isTransferred ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>{rtl ? 'تم النقل للمعمل' : 'Transferred'}</span>
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
                    title={rtl ? 'قراءة كاملة' : 'Read Full Report'}
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

      {/* Global Market Pulse & Trends Summary */}
      <div className="mt-12 rounded-3xl bg-stone-900 text-white p-6 sm:p-8 border border-stone-800 space-y-6">
        <div className="flex items-center justify-between border-b border-stone-800 pb-4">
          <div className="flex items-center gap-2.5">
            <TrendingUp className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-bold font-serif-luxury text-white">
              {rtl ? 'لوحة مؤشرات سوق العطور العالمية (Global Fragrance Pulse 2026)' : 'Global Fragrance Pulse & Market Indicators 2026'}
            </h3>
          </div>
          <span className="text-xs text-stone-400 hidden sm:inline">
            {rtl ? 'تحليل دوري معتمد لمصممي العطور والمعامل' : 'Certified periodic intelligence for perfumers & compounding labs'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          <div className="p-4 rounded-2xl bg-stone-800/60 border border-stone-700/60 space-y-2">
            <div className="text-amber-400 font-bold text-sm flex items-center gap-1.5">
              <span>{rtl ? '🔥 النوتات الأسرع صعوداً في الطلب' : '🔥 Fastest Growing Fragrance Notes'}</span>
            </div>
            <p className="text-stone-300 leading-relaxed">
              {rtl
                ? 'شاي أولونغ الصيني (+45%)، الفستق الحلبي المحمص (+60%)، دهن العود المستدام المعالج بيولوجياً (+38%).'
                : 'Chinese Oolong Tea (+45%), Roasted Pistachio (+60%), Bio-distilled Sustainable Oud (+38%).'}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-stone-800/60 border border-stone-700/60 space-y-2">
            <div className="text-amber-400 font-bold text-sm flex items-center gap-1.5">
              <span>⚖️ الامتثال لمعايير IFRA 51</span>
            </div>
            <p className="text-stone-300 leading-relaxed">
              {rtl
                ? 'حظر مادة الليليال بات إلزامياً دولياً؛ الاعتماد الكلي على الهيديون النقي والفلورالوزون كبدائل آمنة في النوتات الزهرية.'
                : 'Lilial ban is strictly enforced globally; total reliance on pure Hedione and Floralozone for transparent florals.'}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-stone-800/60 border border-stone-700/60 space-y-2">
            <div className="text-amber-400 font-bold text-sm flex items-center gap-1.5">
              <span>{rtl ? '💡 نصيحة «معمل شام» للمصممين' : '💡 Master Sham Atelier Verdict'}</span>
            </div>
            <p className="text-stone-300 leading-relaxed">
              {rtl
                ? '«التوليفات الهجينة بين الانتعاش الحمضي الغربي والقواعد البخورية الشرقية هي الاتجاه الأكثر ربحية وانتشاراً عالمياً حالياً».'
                : '«Hybrid creations merging crisp Western citrus brilliance with rich Oriental incense anchors offer the highest global market traction.»'}
            </p>
          </div>
        </div>
      </div>

      {/* Full Article Reader Modal */}
      {selectedArticle && (() => {
        const modalLoc = getLocalizedNewsArticle(selectedArticle, currentLang);
        return (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-8 animate-in fade-in zoom-in-95">
              {/* Header Image */}
              <div className="relative aspect-[16/9] w-full">
                <img
                  src={selectedArticle.imageUrl}
                  alt={modalLoc.titleAr}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={closeArticleReader}
                  className={`absolute top-4 ${rtl ? 'left-4' : 'right-4'} p-2 rounded-full bg-black/60 hover:bg-black text-white transition-colors cursor-pointer`}
                >
                  <X className="w-5 h-5" />
                </button>
                <div className={`absolute bottom-4 ${rtl ? 'right-4' : 'left-4'} px-3 py-1 rounded-lg bg-stone-900/90 text-amber-300 text-xs font-semibold`}>
                  {modalLoc.categoryLabelAr}
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 sm:p-8 space-y-5 text-stone-800">
                <div className="flex items-center gap-3 text-xs text-stone-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{selectedArticle.date}</span>
                  </span>
                  <span>·</span>
                  <span>{rtl ? 'المصدر:' : 'Source:'} {selectedArticle.source}</span>
                  <span>·</span>
                  <span>{rtl ? 'وقت القراءة:' : 'Read Time:'} {selectedArticle.readTime}</span>
                </div>

                <h3 className="text-xl sm:text-2xl font-bold font-serif-luxury text-stone-950 leading-snug">
                  {modalLoc.titleAr}
                </h3>

                <div className="prose text-xs sm:text-sm text-stone-700 leading-relaxed whitespace-pre-line">
                  {selectedArticle.contentAr}
                </div>

                {/* Expert Verdict Box */}
                <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-2">
                  <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-700" />
                    <span>{rtl ? 'رأي خبير المعمل وتأثيره الصناعي' : 'Master Perfumer Laboratory Verdict & Impact'}</span>
                  </span>
                  <p className="text-xs text-amber-950 leading-relaxed italic">
                    {selectedArticle.expertVerdict}
                  </p>
                  <div className="text-[11px] text-amber-800 pt-1 font-medium">
                    📊 {rtl ? 'أثر السوق:' : 'Market Impact:'} {selectedArticle.marketImpact}
                  </div>
                </div>

                {/* Mentioned Key Notes breakdown with button */}
                {selectedArticle.keyNotes && selectedArticle.keyNotes.length > 0 && (
                  <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-900">
                        {rtl ? 'النوتات الموصى بها في هذا التقرير:' : 'Recommended Notes in This Report:'}
                      </span>
                      <span className="text-[10px] text-stone-500">
                        {rtl ? 'جاهزة للتصدير المباشر' : 'Export Ready'}
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
