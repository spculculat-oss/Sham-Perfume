import { useMemo, useState } from 'react';
import { BookOpen, ExternalLink, Plus, RotateCcw, Search } from 'lucide-react';
import { ADHKAR, ADHKAR_CATEGORIES, HISN_AL_MUSLIM_URL, type AdhkarCategory, type Dhikr } from '../../data/prayerAdhkar';
import quranText from '../../data/prayerQuran.txt?raw';
import { prayerSearchKey } from '../../utils/prayerPlaces';
import type { SupportedLanguage } from '../../types/i18n';
import { loc } from '../../لغات/localize';
import { formatLocalizedNumber } from '../../لغات/numerals';
import { prayerT } from './prayerText';

const QURAN = new Map(quranText.split('\n').filter((line) => /^\d+\|\d+\|/.test(line)).map((line) => {
  const [sura, ayah, text] = line.split('|');
  return [`${sura}:${ayah}`, text];
}));
const indexed = ADHKAR.map((entry) => ({ entry, search: prayerSearchKey([
  entry.title.ar, entry.title.en, entry.text ?? entry.verses?.map((v) => QURAN.get(v)).join(' '),
  ...entry.categories.flatMap((category) => Object.values(ADHKAR_CATEGORIES[category])),
].join(' ')) }));

function DhikrCard({ entry, lang, count, onCount }: { entry: Dhikr; lang: SupportedLanguage; count: number; onCount: (n: number) => void }) {
  const label = prayerT(lang);
  const n = (value: number) => formatLocalizedNumber(lang, value);
  return <li className="prayer-dhikr-card">
    <h4>{loc(lang, entry.title)}</h4>
    {entry.text && <p lang="ar" dir="rtl" className="prayer-arabic">{entry.text}</p>}
    {entry.verses && <p lang="ar" dir="rtl" className="prayer-arabic">{entry.verses.map((verse) => <span key={verse}>{QURAN.get(verse)} <span className="prayer-ayah">﴿{formatLocalizedNumber('ar', Number(verse.split(':')[1]))}﴾</span>{' '}</span>)}</p>}
    <footer>
      <a href={entry.source.url} target="_blank" rel="noreferrer"><ExternalLink size={12} aria-hidden="true" /> {loc(lang, entry.source.label)}</a>
      {entry.repeat && entry.repeat > 1 && <div className="prayer-counter">
        <span aria-live="polite" aria-label={label('reps')}><bdi>{n(count)} / {n(entry.repeat)}</bdi></span>
        <button type="button" onClick={() => onCount(count + 1)} disabled={count >= entry.repeat} aria-label={`${label('count')} · ${loc(lang, entry.title)}`}><Plus size={16} aria-hidden="true" /></button>
        <button type="button" onClick={() => onCount(0)} disabled={count === 0} aria-label={`${label('resetCount')} · ${loc(lang, entry.title)}`}><RotateCcw size={14} aria-hidden="true" /></button>
      </div>}
    </footer>
  </li>;
}

export default function AdhkarLibrary({ lang }: { lang: SupportedLanguage }) {
  const label = prayerT(lang);
  const [category, setCategory] = useState<AdhkarCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const results = useMemo(() => {
    const parts = prayerSearchKey(query).split(' ').filter(Boolean);
    return indexed.filter(({ entry, search }) => (category === 'all' || entry.categories.includes(category)) && parts.every((part) => search.includes(part)));
  }, [category, query]);
  return <div className="prayer-adhkar">
    <div className="prayer-card prayer-library-intro">
      <BookOpen size={22} aria-hidden="true" />
      <div><h3>{label('adhkar')}</h3><p>{label('collectionNote')}</p>
        <a href={HISN_AL_MUSLIM_URL} target="_blank" rel="noreferrer">{label('readMore')} <ExternalLink size={13} aria-hidden="true" /></a>
      </div>
    </div>
    <div className="prayer-field-grid">
      <label>{label('searchAdhkar')}<span className="prayer-search"><Search size={16} aria-hidden="true" /><input type="search" dir="auto" placeholder={label('searchExample')} value={query} maxLength={100} onChange={(event) => setQuery(event.target.value)} /></span></label>
      <label>{label('adhkar')}<select aria-label={label('adhkar')} value={category} onChange={(event) => setCategory(event.target.value as AdhkarCategory | 'all')}>
        <option value="all">{label('allAdhkar')}</option>
        {Object.entries(ADHKAR_CATEGORIES).map(([key, value]) => <option key={key} value={key}>{loc(lang, value)}</option>)}
      </select></label>
    </div>
    <div role="status" className="prayer-results-count">{results.length ? `${formatLocalizedNumber(lang, results.length)} · ${label('adhkar')}` : label('noAdhkar')}</div>
    <ul className="prayer-dhikr-list">{results.map(({ entry }) => <DhikrCard key={entry.id} entry={entry} lang={lang} count={counts[entry.id] || 0} onCount={(count) => setCounts((previous) => ({ ...previous, [entry.id]: count }))} />)}</ul>
    <footer className="prayer-help">Quran text: <a href="https://tanzil.net/" target="_blank" rel="noreferrer">Tanzil Project</a> · <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">CC BY 3.0</a></footer>
  </div>;
}
