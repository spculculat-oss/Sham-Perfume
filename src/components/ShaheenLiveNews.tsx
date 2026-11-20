import React, { useEffect, useId, useMemo, useState } from 'react';
import { ExternalLink, ImageOff, Loader2, MessageCircle, Newspaper, Radio, Search, Sparkles } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { fmt, makeT } from '../لغات/localize';
import { formatLocalizedNumber } from '../لغات/numerals';
import { makeNewsT } from '../لغات/newsL10n';
import type { NewsTextKey } from '../لغات/newsKeys';
import { NEWS_DESK_TEXT } from '../لغات/newsDeskL10n';
import { storeLocalized } from '../لغات/storeL10n';
import { loadBundledNews, loadLiveNews, newsItemPicture, type NewsFile, type NewsItem } from '../utils/liveNews';
import { isStaticHosting, requestApi } from '../utils/api';
import { matchesNewsQuery, newsDate } from './news/newsDesk';
import { explainText } from './newsExplainText';

export function useNewsEdition(enabled = true) {
  const [news, setNews] = useState<NewsFile | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const show = (data: NewsFile) => { if (alive) setNews(data); };
    // Put the bundled edition on screen immediately; a slow network must not hide the front page.
    void loadBundledNews().then(show, () => {});
    void loadLiveNews().then(show, () => {});
    return () => { alive = false; };
  }, [enabled]);
  return news;
}

function PublisherPhoto({ item, lang }: { item: NewsItem; lang: SupportedLanguage }) {
  const L = makeNewsT(lang);
  const [failed, setFailed] = useState(false);
  // Real headlines use only the picture from their own feed, not an unrelated editorial image.
  const photo = newsItemPicture(item);
  return photo && !failed ? (
    <figure className="sn-source-photo">
      <img src={photo} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      <figcaption>{L('photo_source')}</figcaption>
    </figure>
  ) : <p className="sn-photo-absent"><ImageOff size={15} aria-hidden="true" />{failed ? makeT(lang, NEWS_DESK_TEXT)('photoUnavailable') : L('photo_none')}</p>;
}

export function ShaheenLiveNews({ currentLang = 'ar', edition, query = '', clearSearch }: {
  currentLang?: SupportedLanguage;
  edition?: NewsFile | null;
  query?: string;
  clearSearch?: () => void;
}) {
  const L = makeNewsT(currentLang);
  const T = makeT(currentLang, NEWS_DESK_TEXT);
  const ownEdition = useNewsEdition(edition === undefined);
  const news = edition === undefined ? ownEdition : edition;
  const headingId = useId();
  const [category, setCategory] = useState('all');
  const [shown, setShown] = useState(8);
  useEffect(() => { setShown(8); }, [query]);
  const categories = useMemo(() => [...new Set((news?.items ?? []).map((item) => item.category))], [news]);
  const label = (category: string) => category === 'all' ? L('live_all') : L(`live_cat_${category}` as NewsTextKey);
  const items = (news?.items ?? []).filter((item) => (category === 'all' || item.category === category) && matchesNewsQuery(
    query, storeLocalized(item.title, currentLang), storeLocalized(item.summary, currentLang), item.title.en, item.source, label(item.category),
  ));
  const updated = newsDate(news?.updatedAt, currentLang, { hour: '2-digit', minute: '2-digit' });

  return <section className="sn-live" data-testid="shaheen-live-news" aria-labelledby={headingId}>
    <header className="sn-section-heading">
      <div><span className="sn-kicker"><Radio size={15} aria-hidden="true" />{fmt(L('live_badge'), { h: formatLocalizedNumber(currentLang, news?.intervalHours || 12) })}</span>
        <h2 id={headingId}>{L('live_title')}</h2></div>
      {updated && <span className="sn-muted">{fmt(L('live_updated'), { t: updated })}</span>}
    </header>
    {!news ? <p className="sn-state" role="status">{L('live_loading')}</p> : !news.items.length ? (
      <p className="sn-state">{L('live_empty')}</p>
    ) : <>
      {news.editor === 'shaheen' && news.digest && <div className="sn-column"><h3>{L('live_digest')}</h3><p dir="auto">{storeLocalized(news.digest, currentLang)}</p></div>}
      {news.editor === 'feeds' && <p className="sn-muted sn-feed-note">{L('live_headlines')}</p>}
      {categories.length > 1 && <div className="sn-topics" role="group" aria-label={L('live_title')}>
        {['all', ...categories].map((id) => <button type="button" key={id} aria-pressed={category === id}
          onClick={() => { setCategory(id); setShown(8); }}>{label(id)}</button>)}
      </div>}
      <p className="sn-result-count" role="status">{formatLocalizedNumber(currentLang, items.length)} · {T('headlines')}</p>
      {!items.length ? <div className="sn-state">
        <Search aria-hidden="true" /><h3>{T('noResults')}</h3><p>{T('tryAgain')}</p>
        <button type="button" className="sn-button" onClick={() => { setCategory('all'); setShown(8); clearSearch?.(); }}>{T('reset')}</button>
      </div> : <ol className="sn-live-grid">
        {items.slice(0, shown).map((item) => {
          const title = storeLocalized(item.title, currentLang);
          const summary = storeLocalized(item.summary, currentLang);
          const date = newsDate(item.publishedAt, currentLang);
          return <li key={item.id} className="sn-live-card">
            <PublisherPhoto key={item.image} item={item} lang={currentLang} />
            <div className="sn-story-body">
              <span className="sn-story-topic">{label(item.category)}</span>
              <p className="sn-meta"><Newspaper size={14} aria-hidden="true" /><bdi>{item.source}</bdi>{date && <><span aria-hidden="true">·</span><time dateTime={item.publishedAt}>{date}</time></>}</p>
              <h3 dir="auto" lang={title === item.original ? item.lang : undefined}><a href={item.url} target="_blank" rel="noopener noreferrer nofollow">{title}</a></h3>
              {summary && summary !== title && <p className="sn-summary" dir="auto">{summary}</p>}
              {item.note && <p className="sn-source-note" dir="auto"><MessageCircle size={15} aria-hidden="true" /><span><b>{L('live_note')}</b> {storeLocalized(item.note, currentLang)}</span></p>}
              <div className="sn-story-actions">
                <a href={item.url} target="_blank" rel="noopener noreferrer nofollow" className="sn-text-link">{L('live_read')} <ExternalLink size={14} aria-hidden="true" /></a>
                {!isStaticHosting && <ExplainButton item={item} lang={currentLang} />}
              </div>
            </div>
          </li>;
        })}
      </ol>}
      {items.length > shown && <button type="button" className="sn-button sn-more" onClick={() => setShown((n) => n + 8)}>{L('live_more')}</button>}
      <p className="sn-editor-note">{L('live_disclaimer')}</p>
    </>}
  </section>;
}

type Explained = { title: string; summary: string; note: string };
/** «شاهين يشرحلك الخبر»: the story explained in the visitor's language, on request (the answer stays under the card). */
function ExplainButton({ item, lang }: { item: NewsItem; lang: SupportedLanguage }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'failed'>('idle');
  const [out, setOut] = useState<Explained | null>(null);
  const explain = async () => {
    if (state === 'busy') return;
    setState('busy');
    try {
      const answer = await requestApi<Explained>('/api/news/explain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, language: lang }) }, 40_000);
      setOut(answer); setState('done');
    } catch { setState('failed'); }
  };
  if (state === 'done' && out) {
    return (
      <div className="sn-explained" role="status" dir="auto" data-testid="news-explained">
        <p className="flex items-center gap-1 text-[11px] font-extrabold text-amber-800"><Sparkles className="h-3.5 w-3.5" aria-hidden />{explainText(lang, 'by')}</p>
        <p className="text-sm font-extrabold text-stone-900">{out.title}</p>
        <p className="text-sm leading-relaxed text-stone-700">{out.summary}</p>
        {out.note && <p className="text-xs leading-relaxed text-amber-950">{out.note}</p>}
      </div>
    );
  }
  return (
    <>
      <button type="button" onClick={() => void explain()} disabled={state === 'busy'} data-testid="news-explain"
        className="sn-button sn-quiet">
        {state === 'busy' ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
        {state === 'busy' ? explainText(lang, 'explaining') : explainText(lang, 'explain')}
      </button>
      {state === 'failed' && <p className="basis-full text-[11px] text-stone-500" role="status">{explainText(lang, 'busy')}</p>}
    </>
  );
}
