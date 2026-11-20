import React, { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, CalendarDays, ChevronDown, Globe2, MapPin, Newspaper, Pause, Play, RefreshCw, X } from 'lucide-react';
import type { SupportedLanguage } from '../../types/i18n';
import { isRTL } from '../../لغات/localizedContent';
import { fmt, loc, makeT } from '../../لغات/localize';
import { formatLocalizedNumber } from '../../لغات/numerals';
import { HEADLINE_PUBLISHERS, localHeadlineEdition, WORLD_HEADLINE_EDITION, type HeadlineEdition, type HeadlinePublisher } from '../../data/homeHeadlineEditions';
import { HEADLINE_PHOTO_LICENSES, type HeadlinePhoto } from '../../utils/headlinePhoto';
import { HEADLINE_ROTATE_MS, emptyHeadlines, headlineRotation, type HeadlineSection, type HomeHeadline } from '../../utils/homeHeadlines';
import { isStaticHosting } from '../../utils/api';
import { clockLocale } from './clockText';
import { HEADLINE_TEXT } from './homeHeadlineText';
import { PressShowcase } from './PressShowcase';
import { useHomeHeadlines } from './useHomeHeadlines';
import './headlines.css';

type EditionKey = 'local' | 'world';
type View = EditionKey | 'press';
type StoryFormat = { lang: SupportedLanguage; dates: ReturnType<typeof storyDates> };
type StoryProps = StoryFormat & { article: HomeHeadline };
const VIEWS = [{ value: 'local', Icon: MapPin }, { value: 'world', Icon: Globe2 }, { value: 'press', Icon: Newspaper }] as const;
const NO_HEADLINES = emptyHeadlines();
const DESK_SIZE = 4;
const motionQuery = '(prefers-reduced-motion: reduce)';
const narrowDesk = '(max-width: 720px)';
const linkProps = { target: '_blank', rel: 'noopener noreferrer' } as const;

function storyDates(lang: SupportedLanguage, timeZone: string) {
  const { locale, numberingSystem } = clockLocale(lang);
  return {
    time: new Intl.DateTimeFormat(locale, { timeZone, numberingSystem, hour: '2-digit', minute: '2-digit' }),
    date: new Intl.DateTimeFormat(locale, { timeZone, numberingSystem, month: 'short', day: 'numeric' }),
  };
}

function StoryMeta({ article, lang, dates }: StoryProps) {
  const date = (article.dateKind === 'date' ? dates.date : dates.time).format(new Date(article.datedAt));
  return <div className="hn-byline">
    <bdi className="hn-source">{loc(lang, HEADLINE_PUBLISHERS[article.publisher].name)}</bdi><span aria-hidden="true">·</span>
    <time dateTime={article.datedAt}>{article.dateKind === 'updated' && `${makeT(lang, HEADLINE_TEXT)('updated')} `}{date}</time>
    {article.author && <><span aria-hidden="true">·</span><bdi>{article.author}</bdi></>}
  </div>;
}

function HeadlineLicense({ article, lang }: Omit<StoryProps, 'dates'>) {
  const source = HEADLINE_PUBLISHERS[article.publisher];
  if (!('license' in source)) return null;
  return <a className="hn-license" href={source.license.url} {...linkProps} lang={source.lang}
    aria-label={`${makeT(lang, HEADLINE_TEXT)('headlineCredit')}: ${source.license.name}`}><bdi>{source.license.name}</bdi></a>;
}

function StoryTitle({ article }: Pick<StoryProps, 'article'>) {
  return <bdi lang={HEADLINE_PUBLISHERS[article.publisher].lang}>{article.title}</bdi>;
}

// Photos reach the desk only through readHeadlines' publisher and license checks.
function StoryPhoto({ photo, lang, lazy = false }: { photo: HeadlinePhoto; lang: SupportedLanguage; lazy?: boolean }) {
  const [failed, setFailed] = useState<string>();
  if (failed === photo.url) return null;
  return <figure className="hn-photo">
    <img src={photo.url} alt={photo.alt} width={640} height={360} loading={lazy ? 'lazy' : 'eager'} decoding="async"
      referrerPolicy="no-referrer" onError={() => setFailed(photo.url)} />
    <figcaption>
      {makeT(lang, HEADLINE_TEXT)('photoCredit')}: <a href={photo.source} {...linkProps}><bdi>{photo.credit}</bdi></a>
      <span aria-hidden="true"> · </span><a href={`https://creativecommons.org/licenses/${photo.license}/`} {...linkProps} dir="ltr" lang="en">{HEADLINE_PHOTO_LICENSES[photo.license]}</a>
    </figcaption>
  </figure>;
}

function LeadStory({ article, lang, dates }: StoryProps) {
  const T = makeT(lang, HEADLINE_TEXT);
  return <article className="hn-lead" data-testid="home-news-lead">
    {article.photo && <StoryPhoto photo={article.photo} lang={lang} />}
    <div className="hn-lead-copy">
      <p className="hn-eyebrow"><span className="hn-dot" />{T('lead')}</p>
      <h4 className="hn-lead-title"><a href={article.url} {...linkProps}><StoryTitle article={article} /></a></h4>
      <StoryMeta {...{ article, lang, dates }} />
      <HeadlineLicense {...{ article, lang }} />
      <a className="hn-button hn-read" href={article.url} {...linkProps}>{T('read')}<ArrowUpRight size={16} aria-hidden="true" /></a>
    </div>
  </article>;
}

function StoryRow({ article, lang, dates, order }: StoryProps & { order: string }) {
  return <li>
    <bdi className="hn-order" aria-hidden="true">{order}</bdi>
    <div className="hn-row-copy">
      <a className="hn-row-link" href={article.url} {...linkProps}>
        <span><StoryTitle article={article} /></span><ArrowUpRight size={15} aria-hidden="true" />
      </a>
      <StoryMeta {...{ article, lang, dates }} />
      <HeadlineLicense {...{ article, lang }} />
      {article.photo && <StoryPhoto photo={article.photo} lang={lang} lazy />}
    </div>
  </li>;
}

function Sources({ lang, publishers }: { lang: SupportedLanguage; publishers: HeadlinePublisher[] }) {
  return <details className="hn-sources">
    <summary>{makeT(lang, HEADLINE_TEXT)('sources')}</summary>
    <ul>{publishers.map((name) => {
      const source = HEADLINE_PUBLISHERS[name];
      return <li key={name}><a href={source.page} {...linkProps}>{loc(lang, source.name)}</a>
        {'license' in source && <a href={source.license.url} {...linkProps} lang={source.lang} dir="auto">{source.license.name}</a>}</li>;
    })}</ul>
  </details>;
}

function Edition({ region, section, edition, countryName, lang, dates, loading, openPress }: {
  region: EditionKey; section: HeadlineSection; edition?: HeadlineEdition; countryName?: string;
  loading: boolean; openPress: () => void;
} & StoryFormat) {
  const T = makeT(lang, HEADLINE_TEXT);
  const titleId = useId();
  const listId = useId();
  const [publisher, setPublisher] = useState<HeadlinePublisher>();
  const [showAll, setShowAll] = useState(false);
  const number = (n: number) => formatLocalizedNumber(lang, n, { grouping: false });
  const publishers = useMemo(() => [...new Set(edition?.feeds.map(({ publisher }) => publisher))], [edition]);
  const counts = useMemo(() => {
    const totals = new Map<HeadlinePublisher, number>();
    for (const item of section.items) totals.set(item.publisher, (totals.get(item.publisher) ?? 0) + 1);
    return totals;
  }, [section.items]);
  const items = publisher ? section.items.filter((item) => item.publisher === publisher) : section.items;
  // Give today's first credited picture front-page space. The remaining list retains publication order.
  const lead = items.find((item) => item.photo) ?? items[0];
  const latest = lead ? items.filter((item) => item.url !== lead.url) : [];
  const title = region === 'local' ? `${T('localTitle')}${countryName ? ` · ${countryName}` : ''}` : T('worldTitle');
  const empty = isStaticHosting ? 'static'
    : loading && !section.checkedAt && section.status !== 'unsupported' ? 'checking'
      : publisher && section.items.length ? 'sourceEmpty' : section.status === 'empty' ? 'empty'
        : section.status === 'unsupported' ? (countryName ? 'unsupported' : 'unknown') : 'unavailable';
  const count = fmt(T(publisher ? 'filteredCount' : 'count'), { n: number(items.length), total: number(section.items.length) });
  const rows = (articles: HomeHeadline[], offset = 0) => articles.map((article, index) => (
    <StoryRow key={article.url} {...{ article, lang, dates }} order={number(offset + index + 1)} />
  ));

  return <section className="hn-edition" data-news-region={region} aria-labelledby={titleId}>
    <header className="hn-section-header">
      <div><h3 id={titleId}>{title}</h3>
        {(edition?.official || (section.items.length > 0 && !latest.length)) && <div className="hn-edition-meta">
          {edition?.official && <span>{T('official')}</span>}
          {section.items.length > 0 && !latest.length && <span role="status">{count}</span>}
        </div>}
      </div>
      {publishers.length > 1 && section.items.length > 0 && <label className="hn-filter">
        <span>{T('sourceFilter')}</span>
        <select value={publisher ?? ''} onChange={(event) => {
          setPublisher(publishers.find((source) => source === event.currentTarget.value));
          setShowAll(false);
        }}>
          <option value="">{T('allSources')}</option>
          {publishers.map((name) => <option key={name} value={name}>{loc(lang, HEADLINE_PUBLISHERS[name].name)} · {number(counts.get(name) ?? 0)}</option>)}
        </select>
      </label>}
    </header>
    {(section.status === 'partial' || section.status === 'stale') && <p className="hn-warning" role="status">{T(section.status)}</p>}
    {lead ? <div className="hn-feature-grid" data-solo={!latest.length}>
      <LeadStory key={lead.url} article={lead} {...{ lang, dates }} />
      {latest.length > 0 && <div className="hn-latest">
        <div className="hn-latest-heading"><h4><span className="hn-dot" />{T('latest')}</h4>
          <span className="hn-count" role="status">{count}</span></div>
        <ol className="hn-list" role="list">{rows(latest.slice(0, DESK_SIZE))}</ol>
        {latest.length > DESK_SIZE && <>
          <button type="button" className="hn-button hn-more" onClick={() => setShowAll(!showAll)}
            aria-controls={listId} aria-expanded={showAll}>{T(showAll ? 'hide' : 'show')}<ChevronDown size={16} aria-hidden="true" /></button>
          <ol className="hn-list hn-list-more" role="list" id={listId} start={DESK_SIZE + 1} hidden={!showAll}>
            {showAll && rows(latest.slice(DESK_SIZE), DESK_SIZE)}
          </ol>
        </>}
      </div>}
    </div> : <div className="hn-empty">
      <Newspaper size={23} aria-hidden="true" /><p role="status">{T(empty)}</p>
      {empty !== 'checking' && empty !== 'sourceEmpty' && <button type="button" className="hn-button" onClick={openPress}>{T('press')}<Newspaper size={16} aria-hidden="true" /></button>}
    </div>}
    {publishers.length > 0 && <Sources {...{ lang, publishers }} />}
  </section>;
}

// The clock above this component changes once a second; the briefing has its own timers.
export const HomeHeadlineBriefing = memo(function HomeHeadlineBriefing({ lang }: { lang: SupportedLanguage }) {
  const T = makeT(lang, HEADLINE_TEXT);
  const id = useId();
  const panelId = useId();
  const paperTitleId = useId();
  const bar = useRef<HTMLDivElement>(null);
  const paper = useRef<HTMLDivElement>(null);
  const pressTab = useRef<HTMLButtonElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<View>();
  const [playing, setPlaying] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(() => typeof matchMedia === 'function' && matchMedia(motionQuery).matches);
  const [hovering, setHovering] = useState(false);
  const [tickerIndex, setTickerIndex] = useState(0);
  const { data, loading, visible, refresh } = useHomeHeadlines();
  const rtl = isRTL(lang);
  const { locale, numberingSystem } = clockLocale(lang);
  const timeZone = data?.timeZone || 'UTC';
  const country = data?.country ?? null;
  const countryName = useMemo(() => country ? (new Intl.DisplayNames([locale], { type: 'region' }).of(country) ?? country) : undefined, [country, locale]);
  const dates = useMemo(() => storyDates(lang, timeZone), [lang, timeZone]);
  const automatic: EditionKey = data?.local.items.length || !data?.world.items.length ? 'local' : 'world';
  const view = chosen ?? automatic;
  const region = view === 'press' ? automatic : view;
  const section = data?.[region] ?? NO_HEADLINES;
  const sequence = useMemo(() => headlineRotation(section.items), [section.items]);
  const current = sequence.length ? sequence[tickerIndex % sequence.length] : undefined;
  // Only explicit play moves the strip. The front page and list never rotate.
  useEffect(() => {
    if (!playing || hovering || !visible || sequence.length < 2 || reduceMotion) return;
    const timer = window.setTimeout(() => setTickerIndex((n) => (n + 1) % sequence.length), HEADLINE_ROTATE_MS);
    return () => window.clearTimeout(timer);
  }, [playing, hovering, visible, sequence, tickerIndex, reduceMotion]);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const preference = matchMedia(motionQuery);
    const update = () => {
      setReduceMotion(preference.matches);
      if (preference.matches) setPlaying(false);
    };
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    // On phones the masthead, not the much taller shared clock, is the start of reading.
    if (open && window.matchMedia(narrowDesk).matches) {
      paper.current?.focus({ preventScroll: true });
      paper.current?.scrollIntoView({ block: 'start' });
    }
  }, [open]);
  const changeView = (value: View) => {
    setChosen(value);
    if (value === view) return;
    setTickerIndex(0);
    setPlaying(false);
  };
  const close = () => {
    setOpen(false);
    setPlaying(false);
    toggle.current?.focus({ preventScroll: true });
    bar.current?.scrollIntoView({ block: 'nearest' });
  };

  const day = data?.day && new Intl.DateTimeFormat(locale, { timeZone: 'UTC', numberingSystem, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    .format(new Date(`${data.day}T12:00:00Z`));
  const checkedAt = section.checkedAt;
  const checkedTime = checkedAt && dates.time.format(new Date(checkedAt));
  const stripStatus = section.status === 'stale' ? 'cached' : section.status === 'partial' ? 'limited' : undefined;

  return <aside className="home-news-desk" aria-labelledby={id} dir={rtl ? 'rtl' : 'ltr'} data-testid="home-news-briefing">
    <div className="hn-bar" ref={bar}>
      <div className="hn-brand">
        <span className="hn-mark"><Newspaper size={20} aria-hidden="true" /></span>
        <div><h2 id={id}>{T('brand')}</h2><p>{T('scope')}</p></div>
      </div>
      <div className="hn-strip" aria-live="off" onPointerEnter={(event) => { if (event.pointerType === 'mouse') setHovering(true); }}
        onPointerLeave={() => setHovering(false)} onFocusCapture={() => setPlaying(false)}>
        {current ? <>
          <span className="hn-strip-label"><span className="hn-dot" />{T(region)}</span>
          <div className="hn-strip-story">
            <a href={current.url} {...linkProps} className="hn-strip-link" title={current.title}><StoryTitle article={current} /><ArrowUpRight size={14} aria-hidden="true" /></a>
            <div className="hn-strip-meta">
              <StoryMeta article={current} {...{ lang, dates }} /><HeadlineLicense article={current} lang={lang} />
              {stripStatus && <span className="hn-strip-status">{T(stripStatus)}</span>}
            </div>
          </div>
        </> : <p className="hn-strip-empty">{T(loading ? 'checking' : 'noHeadlines')}</p>}
      </div>
      <button type="button" ref={toggle} className="hn-button hn-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => {
        if (open) close(); else setOpen(true);
      }}>{T(open ? 'close' : 'open')}<ChevronDown size={16} aria-hidden="true" /></button>
    </div>
    <div id={panelId} hidden={!open} ref={paper} className="hn-paper" tabIndex={-1} role="region" aria-labelledby={open ? paperTitleId : undefined} onKeyDown={(event) => {
      if (event.key === 'Escape' && !event.defaultPrevented && !(event.target instanceof HTMLSelectElement)) {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    }}>
      {open && <>
        <div className="hn-masthead">
          <div className="hn-masthead-intro"><p className="hn-eyebrow"><span className="hn-dot" />{T('brand')}</p><p className="hn-banner" id={paperTitleId}>{T('title')}</p><p className="hn-muted">{T('subtitle')}</p></div>
          <button type="button" className="hn-icon hn-quick-close" onClick={close} aria-label={T('close')}><X size={18} aria-hidden="true" /></button>
          {day && <div className="hn-date"><span>{T('date')}</span><time dateTime={data.day}><CalendarDays size={16} aria-hidden="true" />{day}</time></div>}
        </div>
        <div className="hn-toolbar">
          <div className="hn-tabs" role="group" aria-label={T('title')}>
            {VIEWS.map(({ value, Icon }) => (
              <button type="button" key={value} ref={value === 'press' ? pressTab : undefined} aria-pressed={value === view} onClick={() => changeView(value)}>
                <Icon size={16} aria-hidden="true" />{T(value)}
              </button>
            ))}
          </div>
          {view !== 'press' && <div className="hn-controls">
            <span className="hn-checked" role="status">{loading ? T('checking') : checkedTime && <>{T('checked')} <time dateTime={checkedAt ?? undefined}>{checkedTime}</time></>}</span>
            {!reduceMotion && sequence.length > 1 && <button type="button" className="hn-icon" aria-label={T(playing ? 'rotationPause' : 'rotationPlay')} title={T(playing ? 'rotationPause' : 'rotationPlay')}
              onClick={() => setPlaying(!playing)}>{playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}</button>}
            {!isStaticHosting && <button type="button" className="hn-icon" aria-label={T('refresh')} title={T('refresh')} disabled={loading} onClick={() => void refresh()}>
              <RefreshCw size={16} className={loading ? 'motion-safe:animate-spin' : undefined} aria-hidden="true" />
            </button>}
          </div>}
        </div>
        {view === 'press' ? <PressShowcase {...{ country, lang, rtl }} /> : <Edition key={view === 'local' ? `local-${country}` : 'world'}
          region={view} section={section} edition={view === 'world' ? WORLD_HEADLINE_EDITION : localHeadlineEdition(country)}
          {...{ countryName, lang, dates, loading }} openPress={() => { changeView('press'); pressTab.current?.focus(); }} />}
        <button type="button" className="hn-button hn-done" onClick={close}>{T('close')}<ChevronDown size={16} aria-hidden="true" /></button>
      </>}
    </div>
  </aside>;
});
