import React, { useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { ArrowRight, Bookmark, BookOpen, Check, Clock, Copy, FlaskConical, ImageOff, Layers, X } from 'lucide-react';
import type { PerfumeNewsItem } from '../../data/perfumeNews';
import { NEWS_IMAGE_LIST, getEditorialImageForCategory } from '../../data/newsImages';
import type { SupportedLanguage } from '../../types/i18n';
import { getLocalizedNewsArticle } from '../../لغات/localizedContent';
import { makeT } from '../../لغات/localize';
import { makeNewsT } from '../../لغات/newsL10n';
import { NEWS_DESK_TEXT } from '../../لغات/newsDeskL10n';
import { formatLocalizedNumber, toLatinDigits } from '../../لغات/numerals';
import { newsPictureKind, resolveNewsImage } from '../../utils/newsCache';
import { newsDate } from './newsDesk';

type Report = { item: PerfumeNewsItem; index: number; lang: SupportedLanguage };
type ReportActions = { saved: boolean; onSave: () => void; onCopy: () => void; copied: boolean };

function ReportPhoto({ item, index, lang }: Report) {
  const L = makeNewsT(lang);
  const fallback = getEditorialImageForCategory(item.category, index);
  const [failed, setFailed] = useState<string[]>([]);
  const primary = resolveNewsImage(item.imageUrl, NEWS_IMAGE_LIST, fallback);
  const src = !failed.includes(primary) ? primary : !failed.includes(fallback) ? fallback : undefined;
  // Bundled art is editorial even when an older report stores it in `imageUrl`.
  const publisher = item.imageUrl && /^https?:\/\//i.test(item.imageUrl) ? item.imageUrl : undefined;
  const kind = newsPictureKind(publisher, src);
  return <figure className="sn-report-photo" data-picture-kind={kind}>
    {src ? <img src={src} alt="" width={640} height={400} loading="lazy" decoding="async" referrerPolicy="no-referrer"
      onError={() => setFailed((previous) => [...previous, src])} /> : <span className="sn-photo-placeholder" aria-hidden="true"><ImageOff size={26} /></span>}
    <figcaption>{kind === 'source' ? L('photo_source') : kind === 'editorial' ? L('photo_stock') : L('photo_none')}</figcaption>
  </figure>;
}

function ReportMeta({ item, lang }: Omit<Report, 'index'>) {
  const L = makeNewsT(lang);
  const article = getLocalizedNewsArticle(item, lang);
  const readTime = toLatinDigits(article.readTime || L('read_time_default')).replace(/\d+/g, (digits) => formatLocalizedNumber(lang, Number(digits), { grouping: false }));
  const iso = item.dateIso || (item.date && /^\d{4}-\d{2}-\d{2}/.test(item.date) ? item.date : undefined);
  return <div className="sn-meta">
    {article.source && <bdi>{article.source}</bdi>}
    {iso ? <time dateTime={iso}>{newsDate(iso, lang) || article.date}</time> : article.date && <span>{article.date}</span>}
    <span><Clock size={13} aria-hidden="true" />{readTime}</span>
  </div>;
}

function BookmarkButton({ lang, saved, onSave }: { lang: SupportedLanguage } & Pick<ReportActions, 'saved' | 'onSave'>) {
  const label = makeNewsT(lang)('bookmark_tooltip');
  return <button type="button" className="sn-icon sn-bookmark" aria-label={label} title={label} aria-pressed={saved} onClick={onSave}>
    <Bookmark size={19} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
  </button>;
}

export function NewsReportCard({ item, index, lang, saved, onSave, onOpen }: Report & Pick<ReportActions, 'saved' | 'onSave'> & {
  onOpen: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const L = makeNewsT(lang);
  const titleId = useId();
  const article = getLocalizedNewsArticle(item, lang);
  return <article className="sn-report-card" aria-labelledby={titleId} data-testid="news-report-card">
    <ReportPhoto {...{ item, index, lang }} />
    <div className="sn-story-body">
      <span className="sn-story-topic">{article.categoryLabelAr}</span>
      <h3 id={titleId} dir="auto"><button type="button" onClick={onOpen}>{article.titleAr}</button></h3>
      <ReportMeta item={item} lang={lang} />
      <p className="sn-summary" dir="auto">{article.summaryAr}</p>
      <div className="sn-story-actions sn-report-actions">
        <button type="button" className="sn-text-link" onClick={onOpen}><BookOpen size={16} aria-hidden="true" />{L('read_full_lbl')} <ArrowRight className="sn-direction" size={16} aria-hidden="true" /></button>
        <BookmarkButton {...{ lang, saved, onSave }} />
      </div>
    </div>
  </article>;
}

export function NewsReader({ item, index, lang, saved, onSave, copied, onCopy, onClose, onApply, onAddNote, copyFailed }: Report & ReportActions & {
  copyFailed: boolean;
  onClose: () => void; onApply: () => void; onAddNote: (index: number) => void;
}) {
  const L = makeNewsT(lang);
  const T = makeT(lang, NEWS_DESK_TEXT);
  const article = getLocalizedNewsArticle(item, lang);
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const [added, setAdded] = useState<number[]>([]);
  useEffect(() => {
    const node = dialog.current;
    if (!node || node.open) return;
    node.showModal();
    close.current?.focus({ preventScroll: true });
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { node.close(); document.body.style.overflow = previous; };
  }, []);

  return <dialog ref={dialog} className="sn-reader" aria-labelledby={id}
    onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="sn-reader-inner">
      <div className="sn-reader-bar">
        <span className="sn-kicker"><BookOpen size={16} aria-hidden="true" />{T('reports')}</span>
        <div>
          <BookmarkButton {...{ lang, saved, onSave }} />
          <button type="button" className="sn-icon" ref={close} onClick={onClose} aria-label={L('close_lbl')} title={L('close_lbl')}><X size={22} aria-hidden="true" /></button>
        </div>
      </div>
      <div className="sn-reader-content">
        <span className="sn-story-topic">{article.categoryLabelAr}</span>
        <h2 id={id} dir="auto">{article.titleAr}</h2>
        <ReportMeta item={item} lang={lang} />
        <ReportPhoto {...{ item, index, lang }} />
        <div className="sn-reader-prose" dir="auto">{(article.contentAr || article.summaryAr).split(/\n\s*\n/).filter(Boolean).map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div>
        {(article.expertVerdict || article.marketImpact) && <aside className="sn-column">
          {article.expertVerdict && <><h3>{L('verdict_lbl')}</h3><p dir="auto">{article.expertVerdict}</p></>}
          {article.marketImpact && <p dir="auto"><b>{L('market_impact_lbl')}</b> {article.marketImpact}</p>}
        </aside>}
        {item.keyNotes && item.keyNotes.length > 0 && <section className="sn-accord">
          <h3><Layers size={18} aria-hidden="true" />{L('accord_lbl')}</h3>
          <ul>
            {item.keyNotes.map((note, i) => <li key={i}>
              <strong dir="auto">{(lang === 'ar' ? note.nameAr : note.nameEn) || L('default_note_name')}</strong>
              {typeof note.percentageHint === 'number' && <bdi>{formatLocalizedNumber(lang, note.percentageHint)}%</bdi>}
              <button type="button" className="sn-button sn-quiet" disabled={added.includes(i)} onClick={() => { onAddNote(i); setAdded((list) => [...list, i]); }}>
                {added.includes(i) ? <Check size={15} aria-hidden="true" /> : <Layers size={15} aria-hidden="true" />}{added.includes(i) ? T('noteAdded') : T('addNote')}
              </button>
            </li>)}
          </ul>
          <button type="button" className="sn-button sn-primary" onClick={onApply}><FlaskConical size={17} aria-hidden="true" />{L('apply_full_lbl')}</button>
        </section>}
        <div className="sn-reader-footer">
          <button type="button" className="sn-button" onClick={onCopy}>{copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}{copied ? T('copied') : L('copy_tooltip')}</button>
          <button type="button" className="sn-text-link" onClick={onClose}>{L('close_lbl')}</button>
        </div>
        {copied && <p className="sn-sr" role="status">{T('copied')}</p>}
        {copyFailed && <p className="sn-muted" role="alert">{T('copyFailed')}</p>}
      </div>
    </div>
  </dialog>;
}
