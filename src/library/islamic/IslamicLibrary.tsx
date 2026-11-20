import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import {
  ArrowDown, BookMarked, BookOpen, Bookmark, ChevronDown, ExternalLink, Feather, Heart, History,
  Languages, Layers, LibraryBig, Scale, ScrollText, Search, X,
} from 'lucide-react';
import type { SupportedLanguage } from '../../types/i18n';
import type { LText } from '../../لغات/localize';
import { formatLocalizedNumber } from '../../لغات/numerals';
import {
  ISLAMIC_BOOKS, ISLAMIC_BOOK_COUNT, ISLAMIC_DIRECTORIES, ISLAMIC_MUSHAF, ISLAMIC_SHELVES, ISLAMIC_SOURCES, SHAMELA_CATEGORIES,
  searchIslamicShelves, type IslamicBook, type IslamicShelfId,
} from './catalog';
import { ISLAMIC_LIBRARY_HASH, ISLAMIC_LIBRARY_TITLE } from './entry';
import { MushafReader } from './MushafReader';
import { QURAN_BOOKMARK_KEY, parseQuranBookmark, type QuranPlace } from './quran';
import { QURAN_SURAHS } from './quranSurahs';
import { islamicBookHash, readIslamicBookHash } from './routes';
import hall from './assets/hall.webp';
import hallSmall from './assets/hall-small.webp';
import './islamicLibrary.css';

const icons = {
  quran: BookOpen, tafsir: Feather, hadith: BookMarked, 'hadith-sciences': Layers, seerah: ScrollText,
  fiqh: Scale, usul: Layers, creed: BookMarked, adhkar: Heart, history: History, language: Languages,
};
const tones = ['pine', 'indigo', 'oxblood', 'umber', 'plum', 'lagoon'] as const;
const toneFor = (shelf: (typeof ISLAMIC_SHELVES)[number], book: IslamicBook) => (
  tones[(ISLAMIC_BOOKS[shelf.id].indexOf(book) + ISLAMIC_SHELVES.indexOf(shelf) * 2) % tones.length]
);
const ui = {
  ar: {
    eyebrow: 'دارُ الكُتُب', tagline: 'من المصحف إلى أمهات كتب التراث. اختَر رفًّا، وافتح كتابًا، وتابع القراءة من نسخته المتاحة.',
    mushaf: 'افتح المصحف', explore: 'تصفّح الأرفف', resume: 'تابع من علامتك', shelves: 'أرفف', titles: 'عنوانًا مختارًا', surahs: 'سورة في المصحف',
    gallery: 'أرفف المكتبة', search: 'البحث في العناوين والمؤلفين', placeholder: 'ابحث عن كتاب أو مؤلّف…', clear: 'امسح البحث',
    filter: 'تصفية حسب الرف', all: 'كل الأرفف', inside: 'قراءة هنا', outside: 'عند المصدر', match: 'العناوين المعروضة:', shelfCount: 'عدد العناوين:',
    noResults: 'لم نجد عنوانًا مطابقًا', tryAgain: 'جرّب اسمًا أقصر، أو ألغِ تحديد الرف للبحث في المكتبة كلها.', reset: 'اعرض كل الأرفف',
    more: 'المزيد في الشاملة', directories: 'فهارس أوسع', scope: 'الأرفف تضم عناوين مختارة، وليست حصرًا لكل الكتب الإسلامية. للمزيد، تصفّح فهارس المكتبات التالية.',
    close: 'إغلاق والعودة إلى الأرفف', edition: 'الطبعة في المصدر', provider: 'مصدر القراءة', read: 'اقرأ عند المصدر',
    externalNote: 'تفتح القراءة في تبويب جديد. الطبعة متاحة على موقع المصدر وليست مستضافة هنا.',
    design: 'رسم تخيّلي لقاعة المكتبة',
  },
  en: {
    eyebrow: 'THE READING HALL', tagline: 'From the Quran to classical works of Islamic scholarship. Choose a shelf, open a book and read the available edition.',
    mushaf: 'Open the Quran', explore: 'Browse the shelves', resume: 'Resume from your bookmark', shelves: 'shelves', titles: 'selected titles', surahs: 'surahs in the Quran',
    gallery: 'Library shelves', search: 'Search titles and authors', placeholder: 'Search for a title or author…', clear: 'Clear search',
    filter: 'Filter by shelf', all: 'All shelves', inside: 'Read here', outside: 'At source', match: 'Titles shown:', shelfCount: 'Titles:',
    noResults: 'No matching titles', tryAgain: 'Try a shorter name, or search across all shelves.', reset: 'Show all shelves',
    more: 'More at Al-Shamela', directories: 'Explore more catalogues', scope: 'These shelves are a selection, not a complete inventory of Islamic books. Browse the wider collections below for more.',
    close: 'Close and return to the shelves', edition: 'Linked edition', provider: 'Reading source', read: 'Read at source',
    externalNote: 'Opens in a new tab. The linked edition lives at the source, not on this site.',
    design: 'An imagined library hall',
  },
};

function Cover({ book, ar, tone }: { book: IslamicBook; ar: boolean; tone: (typeof tones)[number] }) {
  const lang = ar ? 'ar' : 'en';
  const L = ui[lang];
  const mushaf = book.access.kind === 'mushaf';
  return <span className="il-cover" data-tone={mushaf ? 'mushaf' : tone}>
    <span className="il-cover-foil" aria-hidden="true" />
    <span className="il-cover-emblem" aria-hidden="true"><BookOpen size={18} strokeWidth={1.3} /></span>
    <span className="il-cover-title">{book.title[lang]}</span>
    <span className="il-cover-author">{book.byline[lang]}</span>
    <span className="il-cover-access">{mushaf ? L.inside : L.outside}</span>
  </span>;
}

function LibraryDialog({ title, eyebrow, closeLabel, close, reader, dir, restore, children }: {
  title: string; eyebrow: string; closeLabel: string; close: () => void; reader: boolean; dir: 'rtl' | 'ltr';
  restore: () => void; children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  // Keep the same native dialog open while paging through verses. Its top-layer modal also makes the shelf inert.
  const restoreRef = useRef(restore);
  restoreRef.current = restore;
  useLayoutEffect(() => {
    const node = dialog.current;
    if (!node) return;
    node.showModal();
    closeButton.current?.focus({ preventScroll: true });
    return () => { node.close(); restoreRef.current(); };
  }, []);
  return <dialog ref={dialog} className={`il-dialog${reader ? ' il-dialog-reader' : ''}`} dir={dir} lang={dir === 'rtl' ? 'ar' : 'en'}
    aria-labelledby="il-dialog-title" onCancel={(e) => { e.preventDefault(); close(); }}>
    <div className="il-dialog-inner">
      <header className="il-dialog-top">
        <div><p>{eyebrow}</p><h2 id="il-dialog-title">{title}</h2></div>
        <button className="il-icon-button" type="button" ref={closeButton} onClick={close} aria-label={closeLabel} title={closeLabel}><X aria-hidden="true" size={21} /></button>
      </header>
      {children}
    </div>
  </dialog>;
}

type Filter = IslamicShelfId | 'all';

export default function IslamicLibrary({ currentLang }: { currentLang: SupportedLanguage }) {
  const ar = currentLang === 'ar';
  const lang = ar ? 'ar' : 'en';
  const L = ui[lang];
  const T = (s: LText) => s[lang];
  const number = (value: number) => formatLocalizedNumber(lang, value);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState(() => readIslamicBookHash(window.location.hash));
  const [saved, setSaved] = useState<QuranPlace | undefined>(() => {
    try { return parseQuranBookmark(localStorage.getItem(QURAN_BOOKMARK_KEY)); } catch { return undefined; }
  });
  const focusBack = useRef<HTMLElement | null>(null);
  const search = useRef<HTMLInputElement>(null);
  const searchSection = useRef<HTMLElement>(null);
  const heroTitle = useRef<HTMLHeadingElement>(null);
  const groups = useMemo(() => searchIslamicShelves(query, filter), [query, filter]);
  const resultCount = groups.reduce((n, { books }) => n + books.length, 0);

  useEffect(() => {
    const sync = () => setOpen(readIslamicBookHash(window.location.hash));
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => { window.removeEventListener('hashchange', sync); window.removeEventListener('popstate', sync); };
  }, []);

  function openBook(e: MouseEvent<HTMLAnchorElement>, bookId: string, place?: QuranPlace) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    e.preventDefault();
    focusBack.current = e.currentTarget;
    const hash = islamicBookHash(bookId, place);
    window.history.pushState({ tab: ISLAMIC_LIBRARY_HASH.slice(1), islamicOverlay: true }, '', hash);
    setOpen(readIslamicBookHash(hash));
  }

  function closeBook() {
    if (window.history.state?.islamicOverlay) { window.history.back(); return; }
    window.history.replaceState({ tab: ISLAMIC_LIBRARY_HASH.slice(1) }, '', ISLAMIC_LIBRARY_HASH);
    setOpen(undefined);
  }

  function moveMushaf(place: QuranPlace) {
    const hash = islamicBookHash(ISLAMIC_MUSHAF.id, place);
    window.history.replaceState(window.history.state, '', hash);
    setOpen(readIslamicBookHash(hash));
  }

  function savePlace(place: QuranPlace) {
    setSaved(place);
    try { localStorage.setItem(QURAN_BOOKMARK_KEY, JSON.stringify(place)); return true; } catch { return false; }
  }

  const activeAccess = open?.book.access;
  const savedChapter = saved && QURAN_SURAHS[saved.surah - 1];
  return (
    <div className="il-library" dir={ar ? 'rtl' : 'ltr'} lang={lang} data-testid="islamic-library">
      <section className="il-hero" aria-labelledby="il-hero-title">
        <div className="il-hero-content">
          <p className="il-eyebrow"><LibraryBig size={17} strokeWidth={1.5} aria-hidden="true" /> {L.eyebrow}</p>
          <h1 id="il-hero-title" tabIndex={-1} ref={heroTitle}>{T(ISLAMIC_LIBRARY_TITLE)}</h1>
          <p className="il-hero-intro">{L.tagline}</p>
          <div className="il-hero-actions">
            <a className="il-button il-button-gold" href={islamicBookHash(ISLAMIC_MUSHAF.id)} onClick={(e) => openBook(e, ISLAMIC_MUSHAF.id)} aria-haspopup="dialog"><BookOpen size={19} aria-hidden="true" /> {L.mushaf}</a>
            <button className="il-button il-button-ghost" type="button" onClick={() => {
              searchSection.current?.scrollIntoView({ block: 'start' });
              searchSection.current?.focus({ preventScroll: true });
            }}>{L.explore} <ArrowDown size={17} aria-hidden="true" /></button>
          </div>
          {saved && savedChapter && <a className="il-resume" href={islamicBookHash(ISLAMIC_MUSHAF.id, saved)} aria-haspopup="dialog" onClick={(e) => openBook(e, ISLAMIC_MUSHAF.id, saved)}>
            <Bookmark size={15} aria-hidden="true" /> {L.resume} <span>· {ar ? savedChapter.ar : savedChapter.en} {number(saved.ayah)}</span>
          </a>}
        </div>
        <figure className="il-hall">
          <picture><source media="(max-width: 640px)" srcSet={hallSmall} /><img src={hall} alt="" width={1536} height={671} decoding="async" fetchPriority="high" /></picture>
          <figcaption>{L.design}</figcaption>
        </figure>
      </section>
      <div className="il-stats" aria-label={ar ? 'محتوى المكتبة' : 'Library contents'}>
        <span><b>{number(ISLAMIC_SHELVES.length)}</b> {L.shelves}</span>
        <span><b>{number(ISLAMIC_BOOK_COUNT)}</b> {L.titles}</span>
        <span><b>{number(QURAN_SURAHS.length)}</b> {L.surahs}</span>
      </div>

      <section className="il-gallery" aria-labelledby="il-shelves-title" ref={searchSection} tabIndex={-1}>
        <div className="il-gallery-top">
          <div><p className="il-kicker"><span aria-hidden="true">✦</span> {ar ? 'الفهرس' : 'THE INDEX'}</p><h2 id="il-shelves-title">{L.gallery}</h2></div>
          <div className="il-search">
            <Search size={19} aria-hidden="true" />
            <input type="search" ref={search} aria-label={L.search} placeholder={L.placeholder} value={query} onChange={(e) => setQuery(e.target.value)} maxLength={120} />
            {query && <button className="il-icon-button" type="button" aria-label={L.clear} onClick={() => { setQuery(''); search.current?.focus(); }}><X size={16} aria-hidden="true" /></button>}
          </div>
        </div>
        <div className="il-filters" role="group" aria-label={L.filter}>
          {(['all', ...ISLAMIC_SHELVES.map((shelf) => shelf.id)] as const).map((id, i) => <button key={id} type="button" onClick={() => setFilter(id)} aria-pressed={filter === id}>
            {id === 'all' ? L.all : T(ISLAMIC_SHELVES[i - 1].title)}
          </button>)}
        </div>
        <div className="il-mobile-filter"><label htmlFor="il-shelf-select">{L.filter}</label><select id="il-shelf-select" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
          <option value="all">{L.all}</option>
          {ISLAMIC_SHELVES.map((shelf) => <option key={shelf.id} value={shelf.id}>{T(shelf.title)}</option>)}
        </select></div>
        <div className="il-gallery-meta">
          <p role="status">{L.match} <b>{number(resultCount)}</b></p>
          <p><span><BookOpen size={15} aria-hidden="true" /> {L.inside}</span><span><ExternalLink size={15} aria-hidden="true" /> {L.outside}</span></p>
        </div>
        {groups.length === 0 && <div className="il-empty">
          <Search size={28} aria-hidden="true" /><h3>{L.noResults}</h3><p>{L.tryAgain}</p>
          <button type="button" className="il-button il-button-dark" onClick={() => { setQuery(''); setFilter('all'); search.current?.focus(); }}>{L.reset}</button>
        </div>}
        <div className="il-shelves">
          {groups.map(({ shelf, books }) => {
            const Icon = icons[shelf.id];
            return <section key={shelf.id} className="il-shelf" data-shelf={shelf.id} aria-labelledby={`il-shelf-${shelf.id}`}>
              <header className="il-shelf-heading">
                <span className="il-shelf-sign" aria-hidden="true"><Icon size={21} strokeWidth={1.55} /></span>
                <div><h3 id={`il-shelf-${shelf.id}`}>{T(shelf.title)}</h3><p>{T(shelf.description)}</p></div>
                <span className="il-shelf-count">{L.shelfCount} {number(books.length)}</span>
              </header>
              <ul className="il-volumes">
                {books.map((book, i) => <li className="il-volume-slot" key={book.id}>
                  <a className="il-volume" data-book={book.id} data-height={i % 3} href={islamicBookHash(book.id)} aria-haspopup="dialog"
                    onClick={(e) => openBook(e, book.id)}>
                    <Cover book={book} ar={ar} tone={toneFor(shelf, book)} />
                  </a>
                </li>)}
              </ul>
              <details className="il-more">
                <summary>{L.more} <ChevronDown size={16} aria-hidden="true" /></summary>
                <ul>{shelf.directories.map((id) => <li key={id}><a href={`https://shamela.ws/category/${id}`} target="_blank" rel="noopener noreferrer">{T(SHAMELA_CATEGORIES[id])} <ExternalLink size={13} aria-hidden="true" /></a></li>)}</ul>
              </details>
            </section>;
          })}
        </div>
      </section>

      <section className="il-directories" aria-labelledby="il-directories-title">
        <p className="il-kicker"><span aria-hidden="true">✦</span> {ar ? 'خارج الأرفف' : 'BEYOND THE SHELVES'}</p>
        <h2 id="il-directories-title">{L.directories}</h2>
        <p>{L.scope}</p>
        <ul>{ISLAMIC_DIRECTORIES.map((directory) => <li key={directory.url}>
          <a href={directory.url} target="_blank" rel="noopener noreferrer"><span><strong>{T(directory.title)}</strong><small>{T(directory.description)}</small></span><ExternalLink size={18} aria-hidden="true" /></a>
        </li>)}</ul>
      </section>

      {open && <LibraryDialog key={open.book.id} title={T(open.book.title)} eyebrow={T(open.shelf.title)} closeLabel={L.close}
        close={closeBook} reader={Boolean(open.place)} dir={ar ? 'rtl' : 'ltr'} restore={() => {
          const trigger = focusBack.current;
          (trigger?.isConnected ? trigger : heroTitle.current)?.focus({ preventScroll: true });
        }}>
        {open.place && <MushafReader ar={ar} place={open.place} saved={saved} setPlace={moveMushaf} save={savePlace} />}
        {activeAccess?.kind === 'source' && <div className="il-book-detail">
          <div className="il-detail-cover" aria-hidden="true"><Cover book={open.book} ar={ar} tone={toneFor(open.shelf, open.book)} /></div>
          <div className="il-detail-info">
            <p className="il-detail-author">{T(open.book.byline)}</p>
            <p>{T(open.book.summary)}</p>
            <dl>
              {activeAccess.edition && <div><dt>{L.edition}</dt><dd>{T(activeAccess.edition)}</dd></div>}
              <div><dt>{L.provider}</dt><dd>{T(ISLAMIC_SOURCES[activeAccess.catalogue])}</dd></div>
            </dl>
            <a className="il-button il-button-dark" href={activeAccess.url} target="_blank" rel="noopener noreferrer">{L.read} <ExternalLink size={16} aria-hidden="true" /></a>
            <p className="il-external-note">{L.externalNote}</p>
          </div>
        </div>}
      </LibraryDialog>}
    </div>
  );
}
