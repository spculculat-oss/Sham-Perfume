import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Bookmark, CalendarDays, ChevronDown, LayoutPanelTop, Newspaper, RefreshCw, Search, X } from 'lucide-react';
import { PERFUME_NEWS_DATA, type PerfumeNewsItem } from '../data/perfumeNews';
import type { PyramidNote } from '../types/perfume';
import type { ExtractedAIPerfume } from '../utils/aiFormulaExtractor';
import type { SupportedLanguage } from '../types/i18n';
import { getLocalizedNewsArticle, isRTL } from '../لغات/localizedContent';
import { fmt, makeT } from '../لغات/localize';
import { formatLocalizedNumber } from '../لغات/numerals';
import { makeNewsT } from '../لغات/newsL10n';
import { NEWS_DESK_TEXT } from '../لغات/newsDeskL10n';
import { ApiError, isStaticHosting, requestApi } from '../utils/api';
import { copyChatText } from '../utils/clipboard';
import { isNewsArticle, mergeNewsArticles, restoreNewsCache } from '../utils/newsCache';
import { ShaheenLiveNews, useNewsEdition } from './ShaheenLiveNews';
import { NewsFront } from './news/NewsFront';
import { NewsReader, NewsReportCard } from './news/NewsReports';
import { matchesNewsQuery, newsDate, NEWS_BOOKMARK_KEY, normalizeNewsQuery, readNewsBookmarks } from './news/newsDesk';
import './news/newsDesk.css';

interface WorldPerfumeNewsProps {
  currentLang?: SupportedLanguage;
  onApplyNewsNotesToCalculator: (formula: ExtractedAIPerfume) => void;
  onAddNoteToPyramid: (note: PyramidNote) => void;
}

type View = 'edition' | 'headlines' | 'reports' | 'saved';
const STORAGE_KEY_NEWS = 'miyaar_daily_perfume_news_v2';
const REPORT_PAGE_SIZE = 6;
const readArticleId = () => {
  if (typeof window === 'undefined' || window.location.hash.split('?')[0] !== '#perfume_news') return null;
  const id: unknown = window.history.state?.newsArticleId;
  return typeof id === 'string' ? id : null;
};

export function WorldPerfumeNews({ currentLang = 'ar', onApplyNewsNotesToCalculator, onAddNoteToPyramid }: WorldPerfumeNewsProps) {
  const rtl = isRTL(currentLang);
  const L = makeNewsT(currentLang);
  const T = makeT(currentLang, NEWS_DESK_TEXT);
  const edition = useNewsEdition();
  const [newsList, setNewsList] = useState(() => {
    try { return restoreNewsCache(localStorage.getItem(STORAGE_KEY_NEWS), PERFUME_NEWS_DATA); } catch { return PERFUME_NEWS_DATA; }
  });
  const [saved, setSaved] = useState(() => {
    try { return readNewsBookmarks(localStorage.getItem(NEWS_BOOKMARK_KEY)); } catch { return []; }
  });
  const [view, setView] = useState<View>('edition');
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(REPORT_PAGE_SIZE);
  const [readerId, setReaderId] = useState(readArticleId);
  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'failed'>('idle');
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean }>();
  const search = useRef<HTMLInputElement>(null);
  const results = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const jump = useRef(false);

  useEffect(() => {
    if (isStaticHosting) return;
    const controller = new AbortController();
    requestApi<{ success: boolean; articles: unknown }>('/api/news', { signal: controller.signal }).then((data) => {
      if (controller.signal.aborted || !data.success || !Array.isArray(data.articles)) return;
      const articles = data.articles.filter(isNewsArticle);
      if (articles.length) setNewsList((previous) => mergeNewsArticles(previous, articles));
    }).catch(() => { /* Use the bundled/cached reports when the optional service is unreachable. */ });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_NEWS, JSON.stringify(newsList)); } catch { /* optional cache */ }
  }, [newsList]);
  useEffect(() => {
    try { localStorage.setItem(NEWS_BOOKMARK_KEY, JSON.stringify(saved)); } catch { /* optional cache */ }
  }, [saved]);
  useEffect(() => {
    const onPop = () => { setReaderId(readArticleId()); setCopyState('idle'); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    if (readerId || !opener.current) return;
    if (opener.current.isConnected) opener.current.focus({ preventScroll: true });
    else results.current?.focus({ preventScroll: true });
    opener.current = null;
  }, [readerId]);
  useEffect(() => {
    if (!jump.current) return;
    jump.current = false;
    results.current?.focus({ preventScroll: true });
    results.current?.scrollIntoView({ block: 'start' });
  }, [view]);
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(undefined), feedback.error ? 9000 : 5000);
    return () => window.clearTimeout(timer);
  }, [feedback]);
  useEffect(() => {
    if (copyState === 'idle') return;
    const timer = window.setTimeout(() => setCopyState('idle'), 2500);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  const refresh = async () => {
    if (refreshing || isStaticHosting) return;
    setRefreshing(true);
    setFeedback(undefined);
    try {
      const data = await requestApi<{ success: boolean; articles: unknown }>('/api/news/refresh', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
      });
      const articles = data.success && Array.isArray(data.articles) ? data.articles.filter(isNewsArticle) : [];
      if (!articles.length) throw new Error('No reports returned');
      setNewsList((previous) => mergeNewsArticles(previous, articles));
      setFeedback({ text: T('refreshOk') });
    } catch (error) {
      setFeedback({ text: error instanceof ApiError && error.status === 429 ? L('refresh_limited') : T('refreshFailed'), error: true });
    } finally { setRefreshing(false); }
  };

  const selectView = (next: View, reveal = false) => {
    if (view === next) return;
    jump.current = reveal;
    setView(next);
    setCategory('all');
    setQuery('');
    setShown(REPORT_PAGE_SIZE);
  };
  const searchFor = (next: string) => { setQuery(next); setShown(REPORT_PAGE_SIZE); };
  const toggleSaved = (id: string) => setSaved((previous) => previous.includes(id) ? previous.filter((value) => value !== id) : [id, ...previous]);
  const openReader = (item: PerfumeNewsItem, button: HTMLButtonElement) => {
    opener.current = button;
    setCopyState('idle');
    try { window.history.pushState({ ...window.history.state, tab: 'perfume_news', newsArticleId: item.id }, '', window.location.hash || '#perfume_news'); } catch { /* Reader still opens. */ }
    setReaderId(item.id);
  };
  const closeReader = () => {
    if (readerId && readArticleId() === readerId) window.history.back();
    setReaderId(null);
  };
  const copySummary = async (item: PerfumeNewsItem) => {
    const article = getLocalizedNewsArticle(item, currentLang);
    const text = [L('newsletter_name'), article.titleAr, `${article.date || ''} ${L('source_lbl')} ${article.source || ''}`.trim(), article.summaryAr,
      article.expertVerdict ? `${L('verdict_lbl2')} ${article.expertVerdict}` : ''].filter(Boolean).join('\n\n');
    setCopyState(await copyChatText(text) ? 'ok' : 'failed');
  };
  const notesFor = (item: PerfumeNewsItem): PyramidNote[] => {
    const article = getLocalizedNewsArticle(item, currentLang);
    return (item.keyNotes ?? []).map((note, index) => ({
      id: `news-note-${item.id}-${index}`, nameAr: note.nameAr || L('default_note_name'), nameEn: note.nameEn || L('default_note_name'),
      category: note.type === 'top' || note.type === 'base' ? note.type : 'heart',
      percentageOfOil: note.percentageHint ?? 25, description: fmt(L('inspired_tpl'), { t: article.titleAr }),
    }));
  };
  const applyToLab = (item: PerfumeNewsItem) => {
    const pyramidNotes = notesFor(item);
    if (!pyramidNotes.length) return;
    const article = getLocalizedNewsArticle(item, currentLang);
    if (readArticleId() === item.id) {
      try { window.history.replaceState({ ...window.history.state, newsArticleId: null }, ''); } catch { /* leave original history intact */ }
    }
    setReaderId(null);
    onApplyNewsNotesToCalculator({
      title: fmt(L('accord_title_tpl'), { t: article.titleAr.slice(0, 32) }), author: L('news_author'),
      bottleVolumeMl: 50, concentrationPercent: 20, concentrationType: 'edp', alcoholPercentage: 96, waterPercent: 0,
      fixativePercent: 1.5, macerationDays: 35, pyramidNotes,
      summary: fmt(L('summary_tpl'), { t: article.titleAr, v: article.expertVerdict || '' }),
    });
  };

  const categories = [
    ['all', T('reset')], ['niche', L('cat_niche')], ['exhibitions', L('cat_exhibitions')],
    ['harvests', L('cat_harvests')], ['trends', L('cat_trends')], ['ifra', L('cat_ifra')],
  ] as const;
  const savedCount = newsList.filter((item) => saved.includes(item.id)).length;
  const filtered = useMemo(() => newsList.map((item, index) => ({ item, index })).filter(({ item }) => {
    if ((view === 'saved' && !saved.includes(item.id)) || (category !== 'all' && category !== item.category)) return false;
    const article = getLocalizedNewsArticle(item, currentLang);
    return matchesNewsQuery(query, article.titleAr, item.titleEn, article.summaryAr, article.source, article.categoryLabelAr,
      ...(item.tags ?? []), ...(item.keyNotes ?? []).flatMap((note) => [note.nameAr, note.nameEn]));
  }), [newsList, currentLang, query, saved, view, category]);
  const selectedIndex = newsList.findIndex((item) => item.id === readerId);
  const selected = newsList[selectedIndex];
  const day = newsDate(edition?.updatedAt, currentLang, { weekday: 'long', month: 'long' });
  const frontPage = view === 'edition' && !normalizeNewsQuery(query);
  const searchLabel = T(view === 'headlines' ? 'searchHeadlines' : 'searchReports');
  const emptySaved = view === 'saved' && !savedCount;
  const num = (value: number) => formatLocalizedNumber(currentLang, value);

  return <div className="sham-news" data-testid="news-portal" dir={rtl ? 'rtl' : 'ltr'}>
    <header className="sn-masthead">
      <div className="sn-masthead-copy">
        <div className="sn-kicker sn-brand"><span className="sn-brand-mark"><Newspaper size={21} aria-hidden="true" /></span>{T('brand')}</div>
        <h1>{T('title')}</h1>
        <p>{T('subtitle')}</p>
      </div>
      {day && <div className="sn-edition-meta">
        <span className="sn-kicker">{T('editionDate')}</span>
        <span><CalendarDays size={16} aria-hidden="true" /><time dateTime={edition?.updatedAt}>{day}</time></span>
      </div>}
    </header>

    <div className="sn-toolbar">
      <div className="sn-nav" role="group" aria-label={T('brand')}>
        {([{ id: 'edition', icon: LayoutPanelTop }, { id: 'headlines', icon: Newspaper }, { id: 'reports', icon: BookOpen }, { id: 'saved', icon: Bookmark }] as const).map(({ id, icon: Icon }) => (
          <button key={id} type="button" aria-pressed={view === id} onClick={() => selectView(id)} data-testid={`news-view-${id}`}>
            <Icon size={16} aria-hidden="true" /><span>{T(id)}</span>{id === 'saved' && <bdi className="sn-saved-count">{num(savedCount)}</bdi>}
          </button>
        ))}
      </div>
      <div className="sn-search" role="search">
        <Search size={17} aria-hidden="true" />
        <input type="search" ref={search} aria-label={searchLabel} placeholder={searchLabel} value={query} onChange={(event) => searchFor(event.currentTarget.value)} />
        {query && <button type="button" className="sn-icon" aria-label={T('clear')} title={T('clear')} onClick={() => { searchFor(''); search.current?.focus(); }}><X size={17} aria-hidden="true" /></button>}
      </div>
    </div>

    {frontPage && <NewsFront edition={edition} lang={currentLang} onHeadlines={() => selectView('headlines', true)} onReports={() => selectView('reports', true)} />}
    <div className="sn-results" ref={results} tabIndex={-1}>
      {view === 'headlines' ? <ShaheenLiveNews currentLang={currentLang} edition={edition} query={query} clearSearch={() => searchFor('')} /> : (
        <section aria-labelledby="sham-news-reports-title" className="sn-reports">
          <div className="sn-section-heading">
            <div>
              <h2 id="sham-news-reports-title">{T(view === 'saved' ? 'saved' : 'reports')}</h2>
              <p className="sn-muted sn-section-intro">{T(view === 'saved' ? 'onDevice' : 'reportsIntro')}</p>
            </div>
            {frontPage ? <button type="button" className="sn-text-link" onClick={() => selectView('reports', true)}>{T('allReports')} <ArrowRight size={16} className="sn-direction" aria-hidden="true" /></button> : !isStaticHosting && view !== 'saved' && (
              <button type="button" className="sn-button sn-refresh" disabled={refreshing} onClick={() => void refresh()}>
                <RefreshCw className={refreshing ? 'sn-spin' : undefined} size={16} aria-hidden="true" />{refreshing ? L('loading_news') : T('refresh')}
              </button>
            )}
          </div>
          {feedback && view !== 'saved' && <p className="sn-feedback" role={feedback.error ? 'alert' : 'status'} data-error={Boolean(feedback.error)}>{feedback.text}</p>}
          {!frontPage && !emptySaved && <div className="sn-topics" role="group" aria-label={T('reports')}>
            {categories.map(([id, label]) => <button key={id} type="button" aria-pressed={category === id} onClick={() => { setCategory(id); setShown(REPORT_PAGE_SIZE); }}>{label}</button>)}
          </div>}
          {!frontPage && !emptySaved && <p className="sn-result-count" role="status">{fmt(L('reports_count_tpl'), { n: num(filtered.length) })}</p>}
          {filtered.length ? <div className="sn-report-grid">
            {filtered.slice(0, frontPage ? 3 : shown).map(({ item, index }) => <NewsReportCard key={item.id} item={item} index={index} lang={currentLang}
              saved={saved.includes(item.id)} onSave={() => toggleSaved(item.id)} onOpen={(event) => openReader(item, event.currentTarget)} />)}
          </div> : <div className="sn-state">
            {emptySaved ? <Bookmark aria-hidden="true" /> : <Search aria-hidden="true" />}
            <h3>{T(emptySaved ? 'noSaved' : 'noResults')}</h3><p>{T(emptySaved ? 'saveHelp' : 'tryAgain')}</p>
            <button type="button" className="sn-button" onClick={() => { if (emptySaved) selectView('reports', true); else { searchFor(''); setCategory('all'); } }}>
              {T(emptySaved ? 'browse' : 'reset')}<ArrowRight size={16} className="sn-direction" aria-hidden="true" />
            </button>
          </div>}
          {!frontPage && filtered.length > shown && <button type="button" className="sn-button sn-more" onClick={() => setShown((n) => n + REPORT_PAGE_SIZE)}>{T('moreReports')} <ChevronDown size={16} aria-hidden="true" /></button>}
          <details className="sn-editor-note"><summary>{T('editorialNotes')}</summary><p>{L('ai_disclaimer')}</p><p>{L('photo_stock_note')}</p></details>
        </section>
      )}
    </div>
    {selected && <NewsReader key={selected.id} item={selected} index={selectedIndex} lang={currentLang} saved={saved.includes(selected.id)}
      onSave={() => toggleSaved(selected.id)} onCopy={() => void copySummary(selected)} copied={copyState === 'ok'} copyFailed={copyState === 'failed'}
      onClose={closeReader} onApply={() => applyToLab(selected)} onAddNote={(index) => {
        const note = notesFor(selected)[index];
        if (note) onAddNoteToPyramid({ ...note, id: `${note.id}-${Date.now()}` });
      }} />}
  </div>;
}
