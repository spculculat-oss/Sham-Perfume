import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight, Globe2, MapPin, Newspaper, RefreshCw } from 'lucide-react';
import type { SupportedLanguage } from '../../types/i18n';
import { SUPPORTED_LANGUAGES } from '../../types/i18n';
import { makeT, loc, type LText } from '../../لغات/localize';
import { formatLocalizedNumber } from '../../لغات/numerals';
import { isStaticHosting, requestApi } from '../../utils/api';
import {
  HEADLINE_KEEP_MS, HEADLINE_REFRESH_MS, HEADLINE_REGIONS, HEADLINE_SOURCE, emptyHeadlines, readHeadlines,
  type HeadlineRegion, type HeadlineSection, type HomeHeadline, type HomeHeadlines,
} from '../../utils/homeHeadlines';
import { clockLocale } from './clockText';

const NEWS_TEXT = {
  title: { ar: 'موجز الأخبار', en: 'News briefing' },
  refresh: { ar: 'حدّث الأخبار', en: 'Refresh headlines' },
  checking: { ar: 'بنحدّث الأخبار…', en: 'Checking for headlines…' },
  egypt: { ar: 'أخبار مصر', en: 'Egypt' },
  world: { ar: 'أخبار العالم', en: 'World' },
  updated: { ar: 'آخر تحديث', en: 'Last checked' },
  stale: { ar: 'آخر أخبار متاحة', en: 'Last available headlines' },
  unavailable: { ar: 'الأخبار مش متاحة دلوقتي', en: 'Headlines unavailable right now' },
  source: { ar: 'شوف الأخبار عند المصدر', en: 'Read at the source' },
  previous: { ar: 'الخبر اللي قبله', en: 'Previous story' },
  next: { ar: 'الخبر اللي بعده', en: 'Next story' },
} satisfies Record<string, LText>;

let sessionBriefing: HomeHeadlines | undefined;
let checkedAt = 0;
function retained(section: HeadlineSection | undefined, stale = false): HeadlineSection {
  if (!section?.checkedAt || Date.now() - Date.parse(section.checkedAt) > HEADLINE_KEEP_MS) return emptyHeadlines();
  return stale ? { ...section, status: 'stale' } : section;
}
function lastBriefing(stale = false): HomeHeadlines {
  return { egypt: retained(sessionBriefing?.egypt, stale), world: retained(sessionBriefing?.world, stale) };
}

function useHeadlines() {
  const [data, setData] = useState(() => lastBriefing());
  const [loading, setLoading] = useState(!isStaticHosting && !sessionBriefing);
  const request = useRef<AbortController | null>(null);
  const refresh = useCallback(async (user = false) => {
    if (isStaticHosting || request.current) return;
    if (navigator.onLine === false) {
      setData(sessionBriefing = lastBriefing(true));
      setLoading(false);
      return;
    }
    if (!user && checkedAt && Date.now() - checkedAt < HEADLINE_REFRESH_MS) return;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    checkedAt = Date.now();
    try {
      const response = readHeadlines(await requestApi<unknown>('/api/home-headlines', { signal: controller.signal }, 8000));
      if (controller.signal.aborted) return;
      const previous = sessionBriefing;
      sessionBriefing = {
        egypt: response.egypt.items.length ? response.egypt : retained(previous?.egypt, true),
        world: response.world.items.length ? response.world : retained(previous?.world, true),
      };
      setData(sessionBriefing);
    } catch {
      if (!controller.signal.aborted) setData(sessionBriefing = lastBriefing(true));
    } finally {
      if (request.current === controller) { request.current = null; setLoading(false); }
    }
  }, []);
  useEffect(() => {
    const visible = () => { if (!document.hidden) void refresh(); };
    const online = () => { if (!document.hidden) void refresh(true); };
    const offline = () => setData(sessionBriefing = lastBriefing(true));
    visible();
    const id = window.setInterval(visible, HEADLINE_REFRESH_MS);
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      if (request.current) { request.current.abort(); request.current = null; checkedAt = 0; }
    };
  }, [refresh]);
  return { data, loading, refresh };
}

function Photo({ article }: { article?: HomeHeadline }) {
  const [failed, setFailed] = useState(false);
  return <div className="clock-headlines-photo" aria-hidden="true">
    <Newspaper size={24} />
    {article?.imageUrl && !failed && <img src={article.imageUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />}
  </div>;
}

function HeadlineRail({ region, data, loading, lang, timeZone, rtl }: {
  region: HeadlineRegion; data: HeadlineSection; loading: boolean; lang: SupportedLanguage; timeZone: string; rtl: boolean;
}) {
  const label = makeT(lang, NEWS_TEXT);
  const [index, setIndex] = useState(0);
  const length = data.items.length;
  const position = length ? index % length : 0;
  const article = data.items[position];
  const RegionIcon = region === 'egypt' ? MapPin : Globe2;
  const Prev = rtl ? ChevronRight : ChevronLeft;
  const Next = rtl ? ChevronLeft : ChevronRight;
  const value = (n: number) => formatLocalizedNumber(lang, n, { grouping: false });
  const { locale, numberingSystem } = clockLocale(lang);
  const date = (iso: string, style: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { ...style, timeZone, numberingSystem }).format(new Date(iso));
  const dateText = article?.publishedAt ? date(article.publishedAt, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  const attr = article?.publishedAt && dateText ? <time dateTime={article.publishedAt}>{dateText}</time> : null;
  return <section className="clock-headline" data-news-region={region} aria-label={label(region)}>
    <header className="clock-headline-header">
      <h3><RegionIcon size={13} aria-hidden="true" />{label(region)}</h3>
      {length > 1 && <div className="clock-headline-nav" aria-label={label(region)} role="group">
        <button type="button" aria-label={label('previous')} title={label('previous')} onClick={() => setIndex((position + length - 1) % length)}><Prev size={15} aria-hidden="true" /></button>
        <span dir="ltr" aria-live="polite">{value(position + 1)}/{value(length)}</span>
        <button type="button" aria-label={label('next')} title={label('next')} onClick={() => setIndex((position + 1) % length)}><Next size={15} aria-hidden="true" /></button>
      </div>}
    </header>
    {article ? <a href={article.url} target="_blank" rel="noopener noreferrer" className="clock-headline-link" title={article.title}>
      <Photo key={`${article.url}:${article.imageUrl}`} article={article} />
      <span className="clock-headline-title" lang={HEADLINE_SOURCE.lang} dir="rtl">{article.title}</span>
      <span className="clock-headline-byline"><span>{loc(lang, HEADLINE_SOURCE.name)}</span>{attr && <span aria-hidden="true">·</span>}{attr}<ArrowUpRight size={13} aria-hidden="true" /></span>
    </a> : <div className="clock-headline-empty">
      <Photo />
      <span>{label(loading ? 'checking' : 'unavailable')}</span>
      <a href={HEADLINE_SOURCE.sections[region].page} target="_blank" rel="noopener noreferrer">{label('source')} <ArrowUpRight size={13} aria-hidden="true" /></a>
    </div>}
    {data.status === 'stale' && data.checkedAt && <p className="clock-headline-stale">{label('stale')} · <time dateTime={data.checkedAt}>{date(data.checkedAt, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time></p>}
  </section>;
}

// The clock beside this re-renders once a second; the briefing does not need to.
export const HomeHeadlineBriefing = memo(function HomeHeadlineBriefing({ lang, timeZone }: { lang: SupportedLanguage; timeZone: string }) {
  const label = makeT(lang, NEWS_TEXT);
  const { data, loading, refresh } = useHeadlines();
  const rtl = SUPPORTED_LANGUAGES.find((item) => item.code === lang)?.dir === 'rtl';
  const latest = HEADLINE_REGIONS.map((key) => data[key].status === 'fresh' ? data[key].checkedAt : null).filter(Boolean).sort().at(-1);
  const { locale, numberingSystem } = clockLocale(lang);
  return <aside className="clock-headlines" aria-labelledby="clock-headlines-title" dir={rtl ? 'rtl' : 'ltr'}>
    <header className="clock-headlines-header">
      <h2 id="clock-headlines-title"><span className="clock-headlines-emblem"><Newspaper size={16} aria-hidden="true" /></span>{label('title')}</h2>
      <div className="clock-headlines-status">
        <span className="clock-headlines-updated" role="status">{loading ? label('checking') : latest ? <>{label('updated')} <time dateTime={latest}>{new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone, numberingSystem }).format(new Date(latest))}</time></> : null}</span>
        {!isStaticHosting && <button type="button" className="clock-headlines-refresh" aria-label={label('refresh')} title={label('refresh')} disabled={loading} onClick={() => { void refresh(true); }}><RefreshCw size={15} aria-hidden="true" className={loading ? 'motion-safe:animate-spin' : undefined} /></button>}
      </div>
    </header>
    <div className="clock-headline-grid">
      {HEADLINE_REGIONS.map((region) => <HeadlineRail key={region} region={region} data={data[region]} loading={loading} lang={lang} timeZone={timeZone} rtl={rtl} />)}
    </div>
  </aside>;
});
