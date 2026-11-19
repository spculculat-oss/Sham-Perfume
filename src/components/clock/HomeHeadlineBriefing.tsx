import { memo, useEffect, useId, useState } from 'react';
import { ArrowUpRight, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Globe2, List, MapPin, Newspaper, Pause, Play, RefreshCw } from 'lucide-react';
import type { SupportedLanguage } from '../../types/i18n';
import { SUPPORTED_LANGUAGES } from '../../types/i18n';
import { makeT, loc, type LText } from '../../لغات/localize';
import { formatLocalizedNumber } from '../../لغات/numerals';
import { HEADLINE_PUBLISHERS, localHeadlineEdition, WORLD_HEADLINE_EDITION, type HeadlineEdition } from '../../data/homeHeadlineEditions';
import { HEADLINE_ROTATE_MS, emptyHeadlines, type HeadlineSection, type HomeHeadline } from '../../utils/homeHeadlines';
import { isStaticHosting } from '../../utils/api';
import { clockLocale } from './clockText';
import { useHomeHeadlines } from './useHomeHeadlines';
import './headlines.css';

const NEWS_TEXT = {
  title: { ar: 'موجز الأخبار', en: 'News briefing' },
  today: { ar: 'عناوين اليوم من المصادر المتاحة', en: 'Today’s headlines from available sources' },
  refresh: { ar: 'حدّث الأخبار', en: 'Refresh headlines' },
  checking: { ar: 'بنحدّث الأخبار…', en: 'Checking for headlines…' },
  local: { ar: 'أخبار محلية', en: 'Local news' },
  world: { ar: 'أخبار العالم', en: 'World news' },
  checked: { ar: 'آخر تحديث', en: 'Last checked' },
  updated: { ar: 'تحديث', en: 'Updated' },
  official: { ar: 'من مصادر رسمية', en: 'Official updates' },
  partial: { ar: 'بعض المصادر ما اتحدّثتش.', en: 'Some sources couldn’t be refreshed.' },
  stale: { ar: 'عناوين متاحة من النهارده؛ التحديث تعذّر.', en: 'Last available headlines from today; refresh failed.' },
  unavailable: { ar: 'الأخبار مش متاحة دلوقتي.', en: 'Headlines are unavailable right now.' },
  empty: { ar: 'لسه مفيش عناوين بتاريخ النهارده من المصادر دي.', en: 'These sources have no headlines dated today yet.' },
  unknown: { ar: 'ماقدرناش نحدد بلد الدخول. أخبار العالم في قسم منفصل.', en: 'Your entry country couldn’t be detected. World news has its own edition.' },
  unsupported: { ar: 'لسه مفيش مصادر محلية مفعّلة للبلد دي.', en: 'No local sources are configured for this country yet.' },
  sources: { ar: 'المصادر', en: 'Sources' },
  count: { ar: 'عدد العناوين: {n}', en: 'Headlines: {n}' },
  previous: { ar: 'الخبر اللي قبله', en: 'Previous story' },
  next: { ar: 'الخبر اللي بعده', en: 'Next story' },
  rotationPause: { ar: 'إيقاف التدوير', en: 'Pause rotation' },
  rotationPlay: { ar: 'تشغيل التدوير', en: 'Resume rotation' },
  pause: { ar: 'إيقاف', en: 'Pause' },
  play: { ar: 'تشغيل', en: 'Play' },
  show: { ar: 'كل عناوين اليوم', en: 'All today’s headlines' },
  hide: { ar: 'طيّ القائمة', en: 'Collapse list' },
} satisfies Record<string, LText>;

const motionQuery = '(prefers-reduced-motion: reduce)';
function StoryDetails({ article, timeZone, lang }: { article: HomeHeadline; timeZone: string; lang: SupportedLanguage }) {
  const label = makeT(lang, NEWS_TEXT);
  const source = HEADLINE_PUBLISHERS[article.publisher];
  const { locale, numberingSystem } = clockLocale(lang);
  const date = new Intl.DateTimeFormat(locale, {
    timeZone, numberingSystem, ...(article.dateKind === 'date' ? { month: 'short', day: 'numeric' } : { hour: '2-digit', minute: '2-digit' }),
  }).format(new Date(article.datedAt));
  return <>
    <span className="clock-headline-title" lang={source.lang} dir="auto">{article.title}</span>
    <span className="clock-headline-byline">
      <bdi>{loc(lang, source.name)}</bdi><span aria-hidden="true">·</span>
      <time dateTime={article.datedAt}>{article.dateKind === 'updated' && `${label('updated')} `}{date}</time>
    </span>
  </>;
}

function PublisherCredits({ edition, lang }: { edition: HeadlineEdition; lang: SupportedLanguage }) {
  const label = makeT(lang, NEWS_TEXT);
  return <div className="clock-headline-sources"><span>{label('sources')}:</span>
    {[...new Set(edition.feeds.map((feed) => feed.publisher))].map((name) => {
      const source = HEADLINE_PUBLISHERS[name];
      return <span className="clock-headline-credit" key={name}>
        <a href={source.page} target="_blank" rel="noopener noreferrer"><bdi>{loc(lang, source.name)}</bdi></a>
        {'license' in source && <a href={source.license.url} target="_blank" rel="noopener noreferrer" lang={source.lang} dir="auto">{source.license.name}</a>}
      </span>;
    })}
  </div>;
}

function HeadlineRail({ region, edition, countryName, data, loading, visible, lang, timeZone, rtl }: {
  region: 'local' | 'world'; edition?: HeadlineEdition; countryName?: string; data: HeadlineSection;
  loading: boolean; visible: boolean; lang: SupportedLanguage; timeZone: string; rtl: boolean;
}) {
  const label = makeT(lang, NEWS_TEXT);
  const listId = useId();
  const [selected, setSelected] = useState<string>();
  const [expanded, setExpanded] = useState(false);
  const [playing, setPlaying] = useState(() => typeof matchMedia !== 'function' || !matchMedia(motionQuery).matches);
  const [hover, setHover] = useState(false);
  const length = data.items.length;
  const index = Math.max(0, data.items.findIndex((article) => article.url === selected));
  const story = data.items[index];
  const nav = (by: number) => setSelected(data.items[(index + by + length) % length]?.url);
  const rotating = length > 1 && playing && !hover && !expanded && visible;
  useEffect(() => {
    if (!rotating) return;
    const timer = window.setTimeout(() => setSelected(data.items[(index + 1) % length]?.url), HEADLINE_ROTATE_MS);
    return () => window.clearTimeout(timer);
  }, [rotating, index, length, data.items]);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const preference = matchMedia(motionQuery);
    const changed = () => { if (preference.matches) setPlaying(false); };
    preference.addEventListener('change', changed);
    return () => preference.removeEventListener('change', changed);
  }, []);
  const title = countryName ? `${label(region)} · ${countryName}` : label(region);
  const icon = region === 'local' ? <MapPin size={17} /> : <Globe2 size={17} />;
  const Prev = rtl ? ChevronRight : ChevronLeft;
  const Next = rtl ? ChevronLeft : ChevronRight;
  const number = (n: number) => formatLocalizedNumber(lang, n, { grouping: false });
  const emptyMessage = loading && !data.checkedAt ? 'checking' : data.status === 'empty' ? 'empty'
    : data.status === 'unsupported' ? countryName ? 'unsupported' : 'unknown' : 'unavailable';

  return <section className="clock-headline" data-news-region={region} aria-label={title}
    onPointerEnter={(event) => { if (event.pointerType === 'mouse') setHover(true); }}
    onPointerLeave={() => setHover(false)}
    onFocusCapture={(event) => { if (event.target.matches(':focus-visible')) setPlaying(false); }}>
    <header className="clock-headline-header">
      <div className="clock-headline-edition">
        <span className="clock-headline-icon" aria-hidden="true">{icon}</span>
        <div><h3>{title}</h3>{edition?.official && <span className="clock-headline-kind">{label('official')}</span>}</div>
      </div>
      <span className="clock-headline-count">{label('count').replace('{n}', number(length))}</span>
    </header>

    {story ? <>
      <div className="clock-headline-tools">
        {length > 1 && !expanded && <div className="clock-headline-nav" role="group" aria-label={title}>
          <button type="button" className="clock-headline-play" aria-label={label(playing ? 'rotationPause' : 'rotationPlay')}
            onClick={() => setPlaying(!playing)}>
            {playing ? <Pause size={13} aria-hidden="true" /> : <Play size={13} aria-hidden="true" />}{label(playing ? 'pause' : 'play')}
          </button>
          <button type="button" aria-label={label('previous')} title={label('previous')} onClick={() => nav(-1)}><Prev size={17} aria-hidden="true" /></button>
          <span className="clock-headline-position" dir="ltr"><bdi>{number(index + 1)}</bdi><span> / </span><bdi>{number(length)}</bdi></span>
          <button type="button" aria-label={label('next')} title={label('next')} onClick={() => nav(1)}><Next size={17} aria-hidden="true" /></button>
        </div>}
        <button type="button" className="clock-headline-expand" aria-expanded={expanded} aria-controls={listId}
          onClick={() => setExpanded(!expanded)}>
          <List size={15} aria-hidden="true" />{label(expanded ? 'hide' : 'show')}<ChevronDown size={14} aria-hidden="true" />
        </button>
      </div>
      {!expanded && <div aria-live={playing ? 'off' : 'polite'} aria-atomic="true" className="clock-headline-stage">
        <a href={story.url} target="_blank" rel="noopener noreferrer" className="clock-headline-link" title={story.title}>
          <span key={story.url} className="clock-headline-slide"><StoryDetails article={story} lang={lang} timeZone={timeZone} /></span>
          <ArrowUpRight className="clock-headline-out" size={17} aria-hidden="true" />
        </a>
      </div>}
      <div id={listId} hidden={!expanded}>
        {expanded && <ol className="clock-headline-list" role="list">
          {data.items.map((article, i) => <li key={article.url}>
            <a href={article.url} target="_blank" rel="noopener noreferrer" className="clock-headline-link">
              <span className="clock-headline-order" aria-hidden="true">{number(i + 1)}</span>
              <span className="clock-headline-list-copy"><StoryDetails article={article} lang={lang} timeZone={timeZone} /></span>
              <ArrowUpRight className="clock-headline-out" size={15} aria-hidden="true" />
            </a>
          </li>)}
        </ol>}
      </div>
    </> : <p className="clock-headline-empty">{label(emptyMessage)}</p>}
    {(data.status === 'partial' || data.status === 'stale') && <p className="clock-headline-stale" role="status">{label(data.status)}</p>}
    {edition && <PublisherCredits edition={edition} lang={lang} />}
  </section>;
}

// The clock above re-renders once a second; the independently timed briefing does not need to.
export const HomeHeadlineBriefing = memo(function HomeHeadlineBriefing({ lang }: { lang: SupportedLanguage }) {
  const label = makeT(lang, NEWS_TEXT);
  const headingId = useId();
  const { data, loading, visible, refresh } = useHomeHeadlines();
  const rtl = SUPPORTED_LANGUAGES.find((item) => item.code === lang)?.dir === 'rtl';
  const { locale, numberingSystem } = clockLocale(lang);
  const countryName = data?.country ? new Intl.DisplayNames([locale], { type: 'region' }).of(data.country) || data.country : undefined;
  const timeZone = data?.timeZone || 'UTC';
  const day = data?.day && new Intl.DateTimeFormat(locale, { timeZone: 'UTC', numberingSystem, month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(`${data.day}T12:00:00Z`));
  const latest = [data?.local.checkedAt, data?.world.checkedAt].filter((value): value is string => Boolean(value)).sort().at(-1);
  return <aside className="clock-headlines" aria-labelledby={headingId} dir={rtl ? 'rtl' : 'ltr'}>
    <header className="clock-headlines-header">
      <div className="clock-headlines-heading">
        <span className="clock-headlines-emblem"><Newspaper size={22} aria-hidden="true" /></span>
        <div><h2 id={headingId}>{label('title')}</h2><p>{label('today')}</p></div>
      </div>
      <div className="clock-headlines-status">
        {day && <span className="clock-headlines-day"><CalendarDays size={14} aria-hidden="true" /><time dateTime={data.day}>{day}</time></span>}
        <span className="clock-headlines-updated" role="status">{loading ? label('checking') : latest ? <>{label('checked')} <time dateTime={latest}>{new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone, numberingSystem }).format(new Date(latest))}</time></> : null}</span>
        {!isStaticHosting && <button type="button" className="clock-headlines-refresh" aria-label={label('refresh')} title={label('refresh')}
          disabled={loading} onClick={() => { void refresh(); }}><RefreshCw size={16} aria-hidden="true" className={loading ? 'motion-safe:animate-spin' : undefined} /></button>}
      </div>
    </header>
    <div className="clock-headline-grid">
      <HeadlineRail key={data?.country || 'unknown'} region="local" edition={localHeadlineEdition(data?.country ?? null)} countryName={countryName}
        data={data?.local ?? emptyHeadlines()} {...{ loading, visible, lang, timeZone, rtl }} />
      <HeadlineRail region="world" edition={WORLD_HEADLINE_EDITION} data={data?.world ?? emptyHeadlines()} {...{ loading, visible, lang, timeZone, rtl }} />
    </div>
  </aside>;
});
