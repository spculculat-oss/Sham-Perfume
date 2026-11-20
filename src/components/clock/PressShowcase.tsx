import { useId, useMemo, useState } from 'react';
import { ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, Globe2, MapPin, Newspaper } from 'lucide-react';
import type { SupportedLanguage } from '../../types/i18n';
import { PRESS_DIRECTORY_COUNTRIES, WORLD_PRESS_INDEX, localPressDirectory } from '../../data/localPressDirectories';
import { countryPressCards, WORLD_PRESS_CARDS, type PressCard } from '../../data/pressShowcase';
import { makeT, loc, type LText } from '../../لغات/localize';
import { formatLocalizedNumber } from '../../لغات/numerals';
import { clockLocale } from './clockText';

const PRESS_TEXT = {
  local: { ar: 'الصحف المحلية', en: 'Local newspapers' },
  world: { ar: 'الصحف العالمية', en: 'World press' },
  localCountry: { ar: 'بلد الصحف المحلية', en: 'Local press country' },
  worldCountry: { ar: 'بلد الصحف العالمية', en: 'World press country' },
  country: { ar: 'البلد', en: 'Country' },
  international: { ar: 'منصات دولية', en: 'International outlets' },
  entry: { ar: 'بلد الدخول', en: 'Entry country' },
  choose: { ar: 'اختار بلدك', en: 'Choose your country' },
  chooseHelp: { ar: 'اختار بلد عشان تشوف الصحف اللي فيه.', en: 'Choose a country to see its newspapers.' },
  empty: { ar: 'لسه مفيش صحف مضافة مباشرة للبلد دي. تقدر تتصفّح الدليل الخارجي.', en: 'No individual outlets are listed for this country yet. You can browse the external directory.' },
  count: { ar: 'صحف ومواقع: {n}', en: 'Outlets: {n}' },
  all: { ar: 'كل الصحف', en: 'All outlets' },
  collapse: { ar: 'عرض أقل', en: 'Show fewer' },
  previous: { ar: 'مجموعة الصحف اللي قبلها', en: 'Previous group of outlets' },
  next: { ar: 'مجموعة الصحف اللي بعدها', en: 'Next group of outlets' },
  page: { ar: 'مجموعة {current} من {total}', en: 'Group {current} of {total}' },
  covers: { ar: 'أغلفة توضيحية من شام · اضغط على الغلاف لفتح موقع الناشر', en: 'Illustrated covers by Sham · Select a cover to open the publisher’s site' },
  index: { ar: 'دليل صحف البلد', en: 'Country newspaper directory' },
  worldIndex: { ar: 'دليل الصحف حسب البلد', en: 'Newspaper directory by country' },
} satisfies Record<string, LText>;

const ART = ['morning', 'print', 'world', 'desk'] as const;
const PAGE_SIZE = 4;
const number = (lang: SupportedLanguage, n: number) => formatLocalizedNumber(lang, n, { grouping: false });

/** Locally bundled artwork; never a newspaper's masthead, front page, or a photo of a news event. */
export function PressIllustration({ variant, className }: { variant: number; className?: string }) {
  return <img className={className} src={`${import.meta.env.BASE_URL}images/press/${ART[variant % ART.length]}.webp`}
    alt="" loading="lazy" decoding="async" width={480} height={320} />;
}

function PressCards({ cards, region, lang, rtl }: { cards: readonly PressCard[]; region: 'local' | 'world'; lang: SupportedLanguage; rtl: boolean }) {
  const label = makeT(lang, PRESS_TEXT);
  const cardsId = useId();
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const pages = Math.ceil(cards.length / PAGE_SIZE);
  const start = expanded ? 0 : page * PAGE_SIZE;
  const shown = expanded ? cards : cards.slice(start, start + PAGE_SIZE);
  const Prev = rtl ? ChevronRight : ChevronLeft;
  const Next = rtl ? ChevronLeft : ChevronRight;
  const step = (delta: number) => setPage((current) => (current + delta + pages) % pages);

  return <>
    {pages > 1 && <div className="clock-press-actions">
      {!expanded && <div className="clock-headline-nav" role="group" aria-label={label(region)}>
        <button type="button" aria-label={label('previous')} aria-controls={cardsId} onClick={() => step(-1)}><Prev size={17} aria-hidden="true" /></button>
        <span className="clock-press-position" role="status">{label('page').replace('{current}', number(lang, page + 1)).replace('{total}', number(lang, pages))}</span>
        <button type="button" aria-label={label('next')} aria-controls={cardsId} onClick={() => step(1)}><Next size={17} aria-hidden="true" /></button>
      </div>}
      <button className="clock-headline-expand" type="button" aria-expanded={expanded} aria-controls={cardsId} onClick={() => setExpanded((current) => !current)}>
        {label(expanded ? 'collapse' : 'all')}<ChevronDown size={14} aria-hidden="true" />
      </button>
    </div>}
    <ul className="clock-press-cards" id={cardsId} role="list">
      {shown.map(({ name, url }, index) => <li key={url}>
        <a className="clock-press-card" href={url} target="_blank" rel="noopener noreferrer">
          <PressIllustration className="clock-press-cover" variant={start + index + (region === 'world' ? 2 : 0)} />
          <span className="clock-press-card-name"><bdi>{loc(lang, name)}</bdi><ArrowUpRight size={14} aria-hidden="true" /></span>
        </a>
      </li>)}
    </ul>
  </>;
}

type CountryOption = { code: string; name: string };
function PressShelf({ region, entryCountry, options, lang, rtl }: {
  region: 'local' | 'world'; entryCountry?: string | null; options: readonly CountryOption[]; lang: SupportedLanguage; rtl: boolean;
}) {
  const label = makeT(lang, PRESS_TEXT);
  const headingId = useId();
  const [chosen, setChosen] = useState('');
  const world = region === 'world';
  const country = chosen || entryCountry || null;
  const countryName = options.find(({ code }) => code === country)?.name;
  const entryName = options.find(({ code }) => code === entryCountry)?.name || entryCountry;
  const directory = localPressDirectory(country);
  const cards = world && !chosen ? WORLD_PRESS_CARDS : countryPressCards(country);
  const Icon = world ? Globe2 : MapPin;
  const indexLink = directory?.more || WORLD_PRESS_INDEX;

  return <section className="clock-headline clock-press-shelf" data-press-region={region} aria-labelledby={headingId}>
    <header className="clock-headline-header">
      <div className="clock-headline-edition">
        <span className="clock-headline-icon" aria-hidden="true"><Icon size={17} /></span>
        <h3 id={headingId}>{label(region)}{countryName ? ` · ${countryName}` : ''}</h3>
      </div>
      {cards.length > 0 && <span className="clock-headline-count">{label('count').replace('{n}', number(lang, cards.length))}</span>}
    </header>
    <label className="clock-headline-filter clock-press-select">
      <span>{label('country')}</span>
      <select aria-label={label(world ? 'worldCountry' : 'localCountry')} value={chosen} onChange={(event) => setChosen(event.currentTarget.value)}>
        <option value="">{world ? label('international') : entryName ? `${label('entry')} · ${entryName}` : label('choose')}</option>
        {options.map(({ code, name }) => <option key={code} value={code}>{name}</option>)}
      </select>
    </label>
    {cards.length ? <PressCards key={country || region} {...{ cards, region, lang, rtl }} />
      : <p className="clock-headline-empty">{label(country ? 'empty' : 'chooseHelp')}</p>}
    <a className="clock-press-index" href={indexLink} target="_blank" rel="noopener noreferrer">
      {cards.length ? <Newspaper size={15} aria-hidden="true" /> : <PressIllustration className="clock-press-index-cover" variant={2} />}
      <span>{label(directory?.more ? 'index' : 'worldIndex')}</span>
      <ArrowUpRight size={14} aria-hidden="true" />
    </a>
  </section>;
}

export function PressShowcase({ country, lang, rtl }: { country: string | null; lang: SupportedLanguage; rtl: boolean }) {
  const label = makeT(lang, PRESS_TEXT);
  const { locale } = clockLocale(lang);
  const options = useMemo(() => {
    const display = new Intl.DisplayNames([locale], { type: 'region' });
    const collator = new Intl.Collator(locale);
    return PRESS_DIRECTORY_COUNTRIES.map((code) => ({ code, name: display.of(code) || code })).sort((a, b) => collator.compare(a.name, b.name));
  }, [locale]);
  return <div className="clock-press-showcase">
    <p className="clock-press-note">{label('covers')}</p>
    <div className="clock-press-grid">
      <PressShelf region="local" entryCountry={country} {...{ options, lang, rtl }} />
      <PressShelf region="world" {...{ options, lang, rtl }} />
    </div>
  </div>;
}
