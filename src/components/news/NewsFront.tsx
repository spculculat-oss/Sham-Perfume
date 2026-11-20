import React, { useState } from 'react';
import { ArrowDown, ArrowUpRight, BookOpen, Newspaper } from 'lucide-react';
import type { SupportedLanguage } from '../../types/i18n';
import { fmt, makeT } from '../../لغات/localize';
import { formatLocalizedNumber } from '../../لغات/numerals';
import { makeNewsT } from '../../لغات/newsL10n';
import { NEWS_DESK_TEXT } from '../../لغات/newsDeskL10n';
import { storeLocalized } from '../../لغات/storeL10n';
import { newsItemPicture, type NewsFile } from '../../utils/liveNews';
import { newsDate } from './newsDesk';
import cover from './assets/journal-cover.webp';
import coverSmall from './assets/journal-cover-small.webp';

export function NewsFront({ edition, lang, onHeadlines, onReports }: {
  edition: NewsFile | null; lang: SupportedLanguage; onHeadlines: () => void; onReports: () => void;
}) {
  const L = makeNewsT(lang);
  const T = makeT(lang, NEWS_DESK_TEXT);
  const lead = edition?.items[0];
  const secondary = edition?.items.slice(1, 4) ?? [];
  const title = lead ? storeLocalized(lead.title, lang) : T('title');
  const summary = lead ? storeLocalized(lead.summary, lang) : '';
  const originalLang = lead && title === lead.original ? lead.lang : undefined;
  const leadSummary = lang === 'ar' && originalLang && originalLang !== 'ar' && edition?.editor === 'feeds' ? T('originalHeadline') : summary;
  const date = newsDate(lead?.publishedAt, lang);
  const publisherPhoto = newsItemPicture(lead);
  const [failedPhoto, setFailedPhoto] = useState<string>();
  const photo = publisherPhoto && publisherPhoto !== failedPhoto ? publisherPhoto : undefined;
  return <div className="sn-front" data-testid="news-front-page">
    <article className="sn-lead">
      <div className="sn-lead-copy">
        <span className="sn-kicker"><span className="sn-dot" />{lead ? T('lead') : T('brand')}</span>
        <h2 dir="auto" lang={originalLang} className={originalLang && originalLang !== 'ar' ? 'sn-leading-original' : undefined}>{title}</h2>
        {lead ? <>
          <p className="sn-meta"><Newspaper size={15} aria-hidden="true" /><bdi>{lead.source}</bdi>{date && <><span aria-hidden="true">·</span><time dateTime={lead.publishedAt}>{date}</time></>}</p>
          {leadSummary && leadSummary !== title && <p className="sn-lead-summary" dir="auto">{leadSummary}</p>}
          <a href={lead.url} target="_blank" rel="noopener noreferrer nofollow" className="sn-button sn-on-dark" data-testid="news-lead-source">{L('live_read')} <ArrowUpRight size={17} aria-hidden="true" /></a>
        </> : <>
          <p className="sn-lead-summary">{T('subtitle')}</p>
          <button type="button" className="sn-button sn-on-dark" onClick={onReports}>{T('browse')} <ArrowDown size={17} aria-hidden="true" /></button>
        </>}
      </div>
      <figure className="sn-lead-art">
        {photo ? <img src={photo} alt="" width={1120} height={840} referrerPolicy="no-referrer" decoding="async" onError={() => setFailedPhoto(photo)} /> : cover && <img src={cover} srcSet={`${coverSmall} 560w, ${cover} 1120w`} sizes="(max-width: 680px) 100vw, (max-width: 980px) 50vw, 480px"
          alt="" width={1120} height={840} decoding="async" fetchPriority="high" />}
        <figcaption>{photo ? L('photo_source') : T('cover')}</figcaption>
      </figure>
    </article>
    <aside className="sn-wire" aria-label={T('headlines')}>
      <header><span className="sn-wire-mark"><Newspaper size={19} aria-hidden="true" /></span><div>
        <h2>{T('headlines')}</h2>
        {edition?.updatedAt && <p className="sn-muted">{fmt(L('live_updated'), { t: newsDate(edition.updatedAt, lang) })}</p>}
      </div></header>
      {secondary.length ? <ol className="sn-wire-list">
        {secondary.map((item, index) => {
          const title = storeLocalized(item.title, lang);
          return <li key={item.id}>
            <a href={item.url} target="_blank" rel="noopener noreferrer nofollow">
              <bdi className="sn-wire-index" aria-hidden="true">{formatLocalizedNumber(lang, index + 2, { grouping: false })}</bdi>
              <span><small><bdi>{item.source}</bdi></small><strong dir="auto" lang={title === item.original ? item.lang : undefined}>{title}</strong></span>
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </li>;
        })}
      </ol> : <p className="sn-wire-empty" role="status"><BookOpen size={16} aria-hidden="true" />{lead ? T('onlyLead') : edition ? L('live_empty') : L('live_loading')}</p>}
      <button type="button" className="sn-text-link sn-wire-link" onClick={onHeadlines}>{T('index')} <ArrowDown size={16} aria-hidden="true" /></button>
    </aside>
  </div>;
}
