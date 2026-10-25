import React, { useState, useEffect, useMemo } from 'react';
import {
  Radio,
  Clock,
  ExternalLink,
  Sparkles,
  Search,
  Filter,
  Share2,
  Bookmark,
  FlaskConical,
  Flame,
  Globe,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Layers,
  ArrowRight,
  Info,
  Check,
  Tag,
  Building,
  RefreshCw,
} from 'lucide-react';
import { PERFUME_NEWS_DATA, type PerfumeNewsItem } from '../data/perfumeNews';
import { loadLiveNews, relativeTime, type NewsFile, type NewsItem } from '../utils/liveNews';
import { tx, type Lang, Card, Badge, Btn, Avatar } from './ui';

interface Props {
  lang: Lang;
  go: (route: string) => void;
  toast: (text: string) => void;
  compactTickerOnly?: boolean;
}

export function GeneralNewsPeriodic({ lang, go, toast, compactTickerOnly }: Props) {
  const isArabic = lang === 'ar';
  const t = tx(lang);

  const [liveData, setLiveData] = useState<NewsFile | null>(null);
  const [loadingLive, setLoadingLive] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<PerfumeNewsItem | null>(null);
  const [activeTickerIndex, setActiveTickerIndex] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadLiveNews()
      .then((data) => {
        if (alive) {
          setLiveData(data);
          setLoadingLive(false);
        }
      })
      .catch(() => {
        if (alive) setLoadingLive(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Ticker items combining curated breaking items and live items
  const tickerItems = useMemo(() => {
    const list: Array<{ title: string; category: string; source: string; isHot?: boolean }> = [];
    if (liveData?.items) {
      liveData.items.slice(0, 6).forEach((item) => {
        list.push({
          title: isArabic ? item.title.ar : item.title.en,
          category: item.category,
          source: typeof item.source === 'string' ? item.source : (item.source as any)?.name || 'محرر الأخبار',
          isHot: true,
        });
      });
    }
    PERFUME_NEWS_DATA.slice(0, 5).forEach((p) => {
      list.push({
        title: isArabic ? p.titleAr : p.titleEn,
        category: p.categoryLabelAr,
        source: isArabic ? p.source || 'معمل شام' : p.sourceEn || 'Sham Lab',
        isHot: p.isHot,
      });
    });
    return list;
  }, [liveData, isArabic]);

  // Rolling periodic ticker animation
  useEffect(() => {
    if (!tickerItems.length) return;
    const interval = setInterval(() => {
      setActiveTickerIndex((prev) => (prev + 1) % tickerItems.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [tickerItems.length]);

  const filteredArticles = useMemo(() => {
    return PERFUME_NEWS_DATA.filter((item) => {
      if (activeCategory !== 'all' && item.category !== activeCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const text = `${item.titleAr} ${item.titleEn} ${item.summaryAr} ${item.tags?.join(' ') || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [activeCategory, searchQuery]);

  const handleShareToFeed = (title: string) => {
    try {
      localStorage.setItem(
        'sham_composer_prefill',
        JSON.stringify({
          content: `📌 خبر دوري للنقاش من منصة أخبار العامة:\n«${title}»\nما رأي صناع العطور والخبراء في مجتمع شام حول هذا التوجه؟`,
          tag: 'news',
        })
      );
      toast(isArabic ? 'تم تجهيز الخبر للنشر في تدوينة جديدة بالموجز!' : 'Ready to share in news feed!');
      go('');
    } catch {
      toast(isArabic ? 'تم نسخ عنوان الخبر' : 'News title copied');
    }
  };

  const handleCopyLink = (id: string) => {
    setCopiedId(id);
    toast(isArabic ? 'تم نسخ رابط الخبر الدوري' : 'Link copied');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const currentTicker = tickerItems[activeTickerIndex];

  // If only compact ticker requested (for central feed embedding)
  if (compactTickerOnly) {
    return (
      <div className="rounded-2xl border border-rose-200/80 bg-gradient-to-r from-rose-50 via-amber-50/60 to-white p-3 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          {/* Periodic Title Badge */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-600" />
            </span>
            <span className="text-xs font-black text-rose-950 flex items-center gap-1">
              <span>{isArabic ? 'النشرة الدورية — أخبار العامة' : 'Periodic News Ticker'}</span>
              <span className="bg-rose-600 text-white text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                {isArabic ? 'دورية حية' : 'Live'}
              </span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => go('general-news')}
            className="text-[11px] font-bold text-amber-900 hover:text-amber-950 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
          >
            <span>{isArabic ? 'عرض كل الأخبار' : 'All News'}</span>
            <ArrowRight className="w-3 h-3 rtl:rotate-180" />
          </button>
        </div>

        {/* Dynamic rolling ticker headline */}
        {currentTicker && (
          <div className="mt-2 flex items-center gap-2 rounded-xl bg-white/90 border border-stone-200/70 px-3 py-1.5 text-xs text-stone-800 transition-all">
            <span className="shrink-0 text-[10px] font-bold bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded">
              {currentTicker.category}
            </span>
            <p className="truncate font-semibold flex-1 text-stone-900 text-[11px]">
              {currentTicker.title}
            </p>
            <span className="shrink-0 text-[10px] text-stone-400 font-mono hidden sm:inline">
              {currentTicker.source}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dynamic Periodic Title & Header Banner */}
      <div className="rounded-3xl border border-rose-200/80 bg-gradient-to-br from-stone-900 via-stone-900 to-amber-950 p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        {/* Ambient background ornament */}
        <div className="absolute -top-12 -end-12 w-64 h-64 rounded-full bg-rose-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -start-12 w-64 h-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-600/90 text-white shadow-lg shadow-rose-900/30">
                <Radio className="h-5 w-5 animate-pulse" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                    {isArabic ? 'النشرة الدورية — أخبار العامة' : 'Periodic Bulletin — General News'}
                  </h1>
                  <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-black tracking-wider text-white uppercase animate-pulse shadow-xs">
                    {isArabic ? 'بث دوري متجدد' : 'Periodic Live'}
                  </span>
                </div>
                <p className="text-xs text-amber-200/90 font-medium">
                  {isArabic
                    ? 'منصة شام الاجتماعية — التحديث الدوري الشامل لصناعة العطور والمعارض العالمية'
                    : 'Sham Social Platform — Periodic global fragrance & industry bulletin'}
                </p>
              </div>
            </div>

            {/* Interval indicator */}
            <div className="flex items-center gap-2 rounded-2xl bg-white/10 backdrop-blur-md px-3.5 py-1.5 text-xs text-amber-200 border border-white/10">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>{isArabic ? 'تحديث تلقائي كل 12 ساعة' : 'Refreshed every 12 hours'}</span>
            </div>
          </div>

          {/* User Requested Periodic Notice: Community activation feed */}
          <div className="rounded-2xl bg-white/10 backdrop-blur-sm border border-amber-400/20 p-3.5 flex items-start gap-3 text-xs text-amber-100">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="text-white font-bold block mb-0.5">
                {isArabic ? '📌 قسم الأخبار العامة (تغذية دورية لتنشيط المنصة):' : '📌 Community Activation Notice:'}
              </strong>
              {isArabic
                ? 'تم إدراج هذه النشرة الدورية مؤقتاً ضمن منصة شام الاجتماعية لتزويد الأعضاء بأحدث المستجدات، المعارض الدولية، وأسرار كبار العطارين لضمان تفاعل دائم حتى اكتمال انضمام الأفراد وتنشيط المجتمع بكامل طاقته.'
                : 'This periodic general news feed is active to keep the platform vibrant and continuously updated until member registrations and community interactions scale up.'}
            </div>
          </div>

          {/* Dynamic Rolling Headline Ticker */}
          {currentTicker && (
            <div className="rounded-2xl bg-black/40 border border-white/10 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="px-2 py-0.5 rounded-full bg-rose-600 text-[10px] font-bold text-white shrink-0">
                  {isArabic ? 'عاجل دوري' : 'Periodic Ticker'}
                </span>
                <span className="truncate font-semibold text-stone-100">
                  {currentTicker.title}
                </span>
              </div>
              <div className="flex items-center gap-2 text-stone-400 text-[11px] shrink-0">
                <span>{currentTicker.source}</span>
                <div className="flex items-center gap-1 ms-2">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveTickerIndex(
                        (prev) => (prev - 1 + tickerItems.length) % tickerItems.length
                      )
                    }
                    className="p-1 rounded-lg hover:bg-white/10 text-stone-300 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 rtl:rotate-180" />
                  </button>
                  <span className="font-mono text-[10px] text-amber-300">
                    {activeTickerIndex + 1}/{tickerItems.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTickerIndex((prev) => (prev + 1) % tickerItems.length)}
                    className="p-1 rounded-lg hover:bg-white/10 text-stone-300 cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Categories & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: 'all', label: isArabic ? 'كل الأخبار والتقارير' : 'All Reports' },
            { id: 'exhibitions', label: isArabic ? '🏛️ المعارض الدولية' : 'Exhibitions' },
            { id: 'harvests', label: isArabic ? '🌿 مواسم الحصاد' : 'Harvests' },
            { id: 'trends', label: isArabic ? '📈 صيحات النيش' : 'Trends' },
            { id: 'ifra', label: isArabic ? '⚖️ معايير IFRA' : 'IFRA Safety' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`rounded-2xl px-4 py-2 text-xs font-bold transition cursor-pointer shrink-0 ${
                activeCategory === cat.id
                  ? 'bg-amber-900 text-white shadow-sm'
                  : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute inset-y-0 start-3 my-auto h-4 w-4 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isArabic ? 'بحث في الأخبار الدورية…' : 'Search news…'}
            className="w-full rounded-2xl border border-stone-200 bg-white py-2 ps-9 pe-4 text-xs text-stone-900 outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-200"
          />
        </div>
      </div>

      {/* Curated Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredArticles.map((article) => (
          <article
            key={article.id}
            className="group rounded-3xl border border-stone-200/90 bg-white overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col hover:-translate-y-0.5"
          >
            {/* Image Banner */}
            <div className="relative aspect-video w-full overflow-hidden bg-stone-100">
              {article.imageUrl ? (
                <img loading="lazy" decoding="async"
                  src={article.imageUrl}
                  alt={article.titleAr}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-100 to-stone-200">
                  <Globe className="w-10 h-10 text-amber-700/40" />
                </div>
              )}
              <div className="absolute top-3 start-3">
                <span className="px-2.5 py-1 rounded-xl bg-stone-900/85 backdrop-blur-md text-white text-[10px] font-bold shadow-xs">
                  {article.categoryLabelAr}
                </span>
              </div>
              {article.isHot && (
                <div className="absolute top-3 end-3">
                  <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[9px] font-black flex items-center gap-1 shadow-xs">
                    <Flame className="w-3 h-3 fill-white" />
                    <span>{isArabic ? 'مميز' : 'HOT'}</span>
                  </span>
                </div>
              )}
            </div>

            {/* Card Content */}
            <div className="p-5 flex-1 flex flex-col space-y-3">
              <div className="flex items-center justify-between text-[11px] text-stone-400">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>{article.date || 'أكتوبر 2026'}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{article.readTime || '3 دقائق'}</span>
                </span>
              </div>

              <h2 className="text-sm font-bold text-stone-900 group-hover:text-amber-800 transition-colors line-clamp-2 leading-snug">
                {isArabic ? article.titleAr : article.titleEn}
              </h2>

              <p className="text-xs text-stone-600 line-clamp-3 leading-relaxed">
                {isArabic ? article.summaryAr : article.summaryEn || article.summaryAr}
              </p>

              {/* Olfactory Key Notes Preview */}
              {article.keyNotes && article.keyNotes.length > 0 && (
                <div className="p-2.5 rounded-2xl bg-amber-50/60 border border-amber-200/50 space-y-1">
                  <span className="text-[10px] font-bold text-amber-900 block">
                    {isArabic ? 'نوتات عطرية مرتبطة:' : 'Key Olfactory Notes:'}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {article.keyNotes.slice(0, 3).map((kn, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md bg-white text-[10px] text-stone-700 font-medium border border-amber-100"
                      >
                        {kn.nameAr}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Source & Actions */}
              <div className="mt-auto pt-3 border-t border-stone-100 flex items-center justify-between gap-2 text-xs">
                <span className="text-[10px] text-stone-400 font-medium truncate max-w-[130px]">
                  {article.source}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleShareToFeed(article.titleAr)}
                    title={isArabic ? 'مشاركة في تدوينة بالموجز' : 'Share to feed'}
                    className="p-1.5 rounded-xl hover:bg-stone-100 text-stone-500 hover:text-amber-800 transition cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedArticle(article)}
                    className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-amber-800 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    <span>{isArabic ? 'قراءة التفاصيل' : 'Read'}</span>
                    <ArrowRight className="w-3 h-3 rtl:rotate-180" />
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Article Detail Modal / Sheet */}
      {selectedArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-5 sm:p-7 shadow-2xl border border-stone-200 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-xs font-bold">
                  {selectedArticle.categoryLabelAr}
                </span>
                <h3 className="text-lg font-black text-stone-900 mt-2 leading-snug">
                  {isArabic ? selectedArticle.titleAr : selectedArticle.titleEn}
                </h3>
                <div className="flex items-center gap-3 text-xs text-stone-400 mt-1">
                  <span>{selectedArticle.date}</span>
                  <span>·</span>
                  <span>{selectedArticle.source}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedArticle(null)}
                className="rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {selectedArticle.imageUrl && (
              <div className="rounded-2xl overflow-hidden aspect-video">
                <img loading="lazy" decoding="async"
                  src={selectedArticle.imageUrl}
                  alt={selectedArticle.titleAr}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="space-y-3 text-xs sm:text-sm text-stone-700 leading-relaxed whitespace-pre-line">
              <p className="font-semibold text-stone-900">{selectedArticle.summaryAr}</p>
              <p>{selectedArticle.contentAr}</p>
            </div>

            {/* Expert Verdict */}
            {selectedArticle.expertVerdict && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-1">
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                  <span>{isArabic ? 'رأي الخبير شاهين:' : "Master Shahin's Verdict:"}</span>
                </span>
                <p className="text-xs text-amber-950 leading-relaxed">
                  {selectedArticle.expertVerdict}
                </p>
              </div>
            )}

            {/* Key Notes Accord Breakdown */}
            {selectedArticle.keyNotes && (
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2">
                <h4 className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <FlaskConical className="w-3.5 h-3.5 text-amber-700" />
                  <span>{isArabic ? 'الهرم العطري المقترح والنسب:' : 'Suggested Accord:'}</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {selectedArticle.keyNotes.map((kn, i) => (
                    <div key={i} className="p-2 rounded-xl bg-white border border-stone-200 text-center">
                      <p className="text-[11px] font-bold text-stone-800">{kn.nameAr}</p>
                      {kn.percentageHint && (
                        <p className="text-[10px] text-amber-800 font-mono font-bold mt-0.5">
                          {kn.percentageHint}%
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleShareToFeed(selectedArticle.titleAr)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-xs"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{isArabic ? 'نشر في الموجز الاجتماعي' : 'Post to Social Feed'}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedArticle(null)}
                className="px-4 py-2 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 text-xs font-semibold cursor-pointer"
              >
                {isArabic ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
