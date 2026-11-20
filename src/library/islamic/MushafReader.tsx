import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Bookmark, ExternalLink, Loader2 } from 'lucide-react';
import { FIRST_AYAH, parseTanzilUthmani, QURAN_ASSET, QURAN_INTEGRITY, QURAN_SOURCE, quranPage, type QuranPlace, type QuranText } from './quran';
import { QURAN_SURAHS } from './quranSurahs';
import { formatLocalizedNumber } from '../../لغات/numerals';

const assetUrl = `${import.meta.env.BASE_URL}${QURAN_ASSET}`;
let request: Promise<QuranText> | undefined;
function loadText() {
  return request ??= fetch(assetUrl, { integrity: QURAN_INTEGRITY }).then(async (response) => {
    if (!response.ok) throw new Error(`Quran text HTTP ${response.status}`);
    return parseTanzilUthmani(await response.text());
  }).catch((error: unknown) => {
    request = undefined;
    throw error;
  });
}

interface Props {
  ar: boolean;
  place: QuranPlace;
  saved?: QuranPlace;
  setPlace: (place: QuranPlace) => void;
  save: (place: QuranPlace) => boolean;
}

const labels = {
  ar: { surah: 'السورة', ayah: 'الآية', index: 'فهرس المصحف', small: 'الخط العادي', large: 'خط أكبر', from: 'نص المصحف: مشروع تنزيل · الرسم العثماني، الإصدار ١٫١', license: 'الرخصة', raw: 'النص الأصلي وإشعار الحقوق', loading: 'جاري تحميل نص المصحف…', error: 'لم يُحمَّل نص المصحف. جرّب مرة أخرى أو اقرأ عند المصدر.', retry: 'إعادة المحاولة', atSource: 'القراءة عند تنزيل', saved: 'تم حفظ الموضع على هذا الجهاز.', savedSession: 'تم حفظ الموضع لهذه الزيارة فقط.', resume: 'العودة إلى العلامة', previous: 'السابق', next: 'التالي', save: 'حفظ موضع الآية' },
  en: { surah: 'Surah', ayah: 'Verse', index: 'Quran index', small: 'Regular type', large: 'Larger type', from: 'Quran text: Tanzil Project · Uthmani, version 1.1', license: 'License', raw: 'Original text and copyright notice', loading: 'Loading the Quran text…', error: 'The Quran text could not be loaded. Try again or read it at the source.', retry: 'Try again', atSource: 'Read at Tanzil', saved: 'Reading place saved on this device.', savedSession: 'Reading place saved for this visit only.', resume: 'Return to bookmark', previous: 'Previous', next: 'Next', save: 'Bookmark verse' },
};

export function MushafReader({ ar, place = FIRST_AYAH, saved, setPlace, save }: Props) {
  const lang = ar ? 'ar' : 'en';
  const L = labels[lang];
  const number = (value: number) => formatLocalizedNumber(lang, value, { grouping: false });
  const [chapters, setChapters] = useState<QuranText>();
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [large, setLarge] = useState(false);
  const [notice, setNotice] = useState('');
  const page = quranPage(place);
  const reading = useRef<HTMLDivElement>(null);
  const paper = useRef<HTMLElement>(null);
  const { surah, ayah } = place;
  const ready = Boolean(chapters);

  useEffect(() => {
    let active = true;
    loadText().then(
      (data) => { if (active) setChapters(data); },
      () => { if (active) setFailed(true); },
    );
    return () => { active = false; };
  }, [attempt]);

  useEffect(() => {
    if (!ready || !reading.current || !paper.current) return;
    const section = reading.current;
    // Scroll only the dialog's reading pane; the shelves remain where the reader left them.
    const verse = section.querySelector<HTMLElement>(`[data-quran-ayah="${ayah}"]`);
    section.scrollTop = ayah === page.start || !verse ? 0 :
      section.scrollTop + verse.getBoundingClientRect().top - section.getBoundingClientRect().top - 12;
  }, [surah, ayah, ready, page.start]);

  const Prev = ar ? ArrowRight : ArrowLeft;
  const Next = ar ? ArrowLeft : ArrowRight;
  function turn(to: QuranPlace) {
    setPlace(to);
    paper.current?.focus({ preventScroll: true });
  }

  return (
    <div className="il-mushaf" data-testid="islamic-mushaf">
      <aside className="il-index" aria-label={L.index}>
        <div className="il-index-heading"><BookOpen aria-hidden="true" size={18} /> {L.index}</div>
        <div className="il-index-fields">
          <div>
            <label htmlFor="il-surah-select">{L.surah}</label>
            <select id="il-surah-select" value={surah} onChange={(e) => setPlace({ surah: Number(e.target.value), ayah: 1 })}>
              {QURAN_SURAHS.map((chapter) => <option key={chapter.number} value={chapter.number}>{number(chapter.number)} · {ar ? chapter.ar : chapter.en}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="il-ayah-select">{L.ayah}</label>
            <select id="il-ayah-select" value={ayah} onChange={(e) => setPlace({ surah, ayah: Number(e.target.value) })}>
              {Array.from({ length: page.chapter.verses }, (_, i) => <option key={i} value={i + 1}>{number(i + 1)}</option>)}
            </select>
          </div>
        </div>
        <div className="il-index-actions">
          <button className="il-button il-button-light" type="button" aria-pressed={large} onClick={() => setLarge(!large)}>
            <span className="il-type-icon" aria-hidden="true">{ar ? 'أ' : 'A'}</span> {large ? L.small : L.large}
          </button>
          {saved && <button className="il-button il-button-light" type="button" onClick={() => setPlace(saved)}>
            <Bookmark aria-hidden="true" size={16} /> {L.resume}
          </button>}
        </div>
        <p className="il-screen-reader" role="status">{notice}</p>
        <div className="il-quran-credit">
          <a href={QURAN_SOURCE} target="_blank" rel="noopener noreferrer">{L.from}</a>
          <div><a href="https://tanzil.net/docs/text_license" target="_blank" rel="noopener noreferrer">{L.license}</a> <span aria-hidden="true">·</span> <a href={assetUrl} target="_blank" rel="noopener noreferrer">{L.raw}</a></div>
        </div>
      </aside>
      <div className="il-reading-scroll" ref={reading} data-testid="islamic-reading-scroll">
        <article className="il-paper" ref={paper} tabIndex={-1} aria-labelledby="il-surah-title" data-large={large || undefined}>
          <header className="il-paper-heading">
            <span className="il-ornament" aria-hidden="true">✦</span>
            <h3 id="il-surah-title"><span lang="ar" dir="rtl">سورة {page.chapter.ar}</span>{!ar && <small>{page.chapter.en}</small>}</h3>
            <p>{ar ? 'الآيات' : 'Verses'} <bdi>{number(page.start)}–{number(page.end)}</bdi> {ar ? 'من' : 'of'} {number(page.chapter.verses)}</p>
          </header>
          {!chapters && (failed
            ? <div className="il-reader-message" role="alert">
              <p>{L.error}</p>
              <div className="il-dialog-actions">
                <button className="il-button il-button-dark" type="button" onClick={() => { setFailed(false); setAttempt(attempt + 1); }}>{L.retry}</button>
                <a className="il-button il-button-light" href={`${QURAN_SOURCE}#${surah}:${ayah}`} target="_blank" rel="noopener noreferrer">{L.atSource} <ExternalLink aria-hidden="true" size={15} /></a>
              </div>
            </div>
            : <div className="il-reader-message" role="status"><Loader2 className="il-spinner" aria-hidden="true" size={22} /> {L.loading}</div>)}
          {chapters && <>
            <ol className="il-verses" dir="rtl" start={page.start}>
              {chapters[surah - 1].slice(page.start - 1, page.end).map((verse, index) => {
                const n = page.start + index;
                const marked = saved?.surah === surah && saved.ayah === n;
                return <li key={`${surah}:${n}`} data-quran-ayah={n} data-active={ayah === n ? 'true' : undefined}>
                  <p lang="ar"><span className="il-quran-text">{verse}</span> <span className="il-verse-number" lang={lang} aria-label={`${L.ayah} ${number(n)}`}>{number(n)}</span></p>
                  <button className="il-mark" type="button" aria-pressed={marked} aria-label={`${L.save} ${number(n)}`}
                    onClick={() => setNotice(save({ surah, ayah: n }) ? L.saved : L.savedSession)}>
                    <Bookmark aria-hidden="true" size={17} fill={marked ? 'currentColor' : 'none'} />
                  </button>
                </li>;
              })}
            </ol>
            <nav className="il-pager" aria-label={ar ? 'التنقّل بين مقاطع القراءة' : 'Navigate reading sections'}>
              <button className="il-button il-button-light" type="button" disabled={!page.previous} onClick={() => page.previous && turn(page.previous)}><Prev aria-hidden="true" size={16} /> {L.previous}</button>
              <span aria-hidden="true">✦</span>
              <button className="il-button il-button-light" type="button" disabled={!page.next} onClick={() => page.next && turn(page.next)}>{L.next} <Next aria-hidden="true" size={16} /></button>
            </nav>
          </>}
        </article>
      </div>
    </div>
  );
}
