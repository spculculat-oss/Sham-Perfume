import { memo, useId, type CSSProperties } from 'react';
import { Compass, Power } from 'lucide-react';
import type { SupportedLanguage } from '../../types/i18n';
import { makeT, type LText } from '../../لغات/localize';
import { formatLocalizedNumber } from '../../لغات/numerals';
import { compassPoint, compassXY, normalizeBearing } from '../../utils/visitorCompass';
import { qiblaDial } from '../../utils/qibla';
import { QiblaControls } from './QiblaControls';
import { useDeviceCompass } from './useDeviceCompass';
import { useQibla } from './useQibla';

const TEXT = {
  compass: { ar: 'البوصلة', en: 'Compass' },
  enable: { ar: 'فعّل البوصلة', en: 'Enable compass' },
  stop: { ar: 'إيقاف البوصلة', en: 'Stop compass' },
  idle: { ar: 'فعّل الحساس عشان تعرف اتجاه الموبايل.', en: 'Turn on the sensor to see your device heading.' },
  requesting: { ar: 'اسمح للمتصفح باستخدام الحساس.', en: 'Allow access to the compass sensor.' },
  waiting: { ar: 'امسك الموبايل بشكل أفقي ولفّه بالراحة.', en: 'Hold the phone flat and turn it slowly.' },
  ready: { ar: 'قراءة مغناطيسية من حساس الجهاز', en: 'Magnetic heading from your device' },
  corrected: { ar: 'قراءة من الجهاز مصحّحة للشمال الجغرافي', en: 'Device heading corrected to geographic north' },
  paused: { ar: 'البوصلة متوقفة أثناء إخفاء الصفحة.', en: 'Compass paused while this page is hidden.' },
  stale: { ar: 'لفّ الموبايل شوية عشان البوصلة تستقبل قراءة جديدة.', en: 'Turn the phone slightly to refresh the heading.' },
  denied: { ar: 'السماح بالحساس مرفوض. جرّب تفتح الصفحة في تبويب مستقل وتسمح بيه.', en: 'Sensor access was denied. Try opening this page in its own tab and allowing access.' },
  unsupported: { ar: 'البوصلة مش مدعومة هنا. جرّب من موبايل ومتصفح بيدعموا الحساس.', en: 'Compass is unavailable here. Try a phone and browser with compass support.' },
  noData: { ar: 'مفيش قراءة اتجاه. جرّب على موبايل يدعم البوصلة وفي تبويب مستقل.', en: 'No compass reading. Try a phone with a compass and open this page in its own tab.' },
  north: { ar: 'شمال', en: 'North' }, northeast: { ar: 'شمال شرق', en: 'Northeast' },
  east: { ar: 'شرق', en: 'East' }, southeast: { ar: 'جنوب شرق', en: 'Southeast' },
  south: { ar: 'جنوب', en: 'South' }, southwest: { ar: 'جنوب غرب', en: 'Southwest' },
  west: { ar: 'غرب', en: 'West' }, northwest: { ar: 'شمال غرب', en: 'Northwest' },
  dialNorth: { ar: 'شمال', en: 'N' }, dialEast: { ar: 'شرق', en: 'E' },
  dialSouth: { ar: 'جنوب', en: 'S' }, dialWest: { ar: 'غرب', en: 'W' },
} satisfies Record<string, LText>;

const CENTER = 96;
const TICKS = Array.from({ length: 72 }, (_, index) => {
  const degree = index * 5;
  const from = compassXY(degree, degree % 30 === 0 ? 75 : degree % 10 === 0 ? 79 : 82, CENTER);
  return { degree, from, to: compassXY(degree, 86, CENTER) };
});
const CARDINALS = ['dialNorth', 'dialEast', 'dialSouth', 'dialWest'] as const;
const Marks = memo(function Marks({ lang }: { lang: SupportedLanguage }) {
  const label = makeT(lang, TEXT);
  return <>
    {TICKS.map(({ degree, from, to }) => <line key={degree} data-major={degree % 30 === 0} data-north={degree === 0} className="clock-compass-tick" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />)}
    {TICKS.filter(({ degree }) => degree % 30 === 0).map(({ degree }) => <text key={degree} {...compassXY(degree, 63, CENTER)} className="clock-compass-mark" data-degree={degree}>
      {formatLocalizedNumber(lang, degree, { grouping: false })}
    </text>)}
    {CARDINALS.map((key, i) => <text key={key} {...compassXY(i * 90, 42, CENTER)} className="clock-compass-cardinal" data-north={i === 0}>{label(key)}</text>)}
  </>;
});

/** Original vector, centred on the spindle. Only a gentle tilt follows the phone. */
function Kaaba({ tilt }: { tilt: number }) {
  return <g className="clock-qibla-emblem" data-testid="qibla-kaaba">
    <circle className="clock-qibla-halo" cx={CENTER} cy={CENTER} r="23" />
    <g className="clock-qibla-art" style={{ '--kaaba-tilt': `${tilt}deg` } as CSSProperties}>
      <ellipse cx="96" cy="113" rx="21" ry="5" fill="#110d0b82" />
      <path d="M78 86 95 78 115 86 98 95Z" fill="#48403b" stroke="#a8926f" strokeWidth="0.75" />
      <path d="M78 86 98 94V115L78 107Z" fill="#1e191a" stroke="#71604c" strokeWidth="0.75" />
      <path d="M98 94 115 86V107L98 115Z" fill="#131112" stroke="#71604c" strokeWidth="0.75" />
      <path d="M78 91 98 99 115 91V95L98 103 78 95Z" fill="#d3a964" />
      <path d="M79 93.5 98 101 114 93.5" fill="none" stroke="#fbe3a7" strokeWidth="0.6" />
      <path d="M104 102 110 99.2V107.3L104 110Z" fill="#ac8241" stroke="#f3d199" strokeWidth="0.6" />
      <path d="M82 99.5 94 104.3M82 103 94 107.8" fill="none" stroke="#f4dfb24d" strokeWidth="0.65" />
    </g>
  </g>;
}

export const VisitorCompass = memo(function VisitorCompass({ lang }: { lang: SupportedLanguage }) {
  const label = makeT(lang, TEXT);
  const title = useId();
  const status = useId();
  const { state, tracking, toggle } = useDeviceCompass();
  const qibla = useQibla();
  const dial = qibla.state.direction ? qiblaDial(qibla.state.direction, state.rotation) : undefined;
  const bearing = dial?.live ? normalizeBearing(Math.round(-dial.northRotation)) : state.bearing;
  const tilt = dial?.live ? Math.sin(dial.pointerRotation * Math.PI / 180) * 9 : 0;
  return <section className="clock-compass" aria-labelledby={title} data-testid="visitor-compass" data-state={state.phase}
    data-qibla-mode={dial ? dial.live ? 'live' : 'map' : 'idle'} data-qibla-aligned={dial?.aligned ?? false}>
    <svg className="clock-compass-dial" viewBox="0 0 192 192" aria-hidden="true">
      <circle className="clock-compass-outer" cx={CENTER} cy={CENTER} r="94" />
      <circle className="clock-compass-rim" cx={CENTER} cy={CENTER} r="90" />
      <circle className="clock-compass-inner" cx={CENTER} cy={CENTER} r="73" />
      <path className="clock-compass-rose" d="M96 63 L100 91 L129 96 L100 101 L96 129 L92 101 L63 96 L92 91 Z" />
      <g className="clock-compass-scale" style={{ '--dial-north': `${dial?.northRotation ?? 0}deg` } as CSSProperties}><Marks lang={lang} /></g>
      <g className="clock-compass-arrow" data-bearing={state.bearing} style={{ transform: `rotate(${state.rotation ?? 0}deg)` }}>
        <path className="clock-compass-tail" d="M88 89 L96 132 L104 89 Z" />
        <path className="clock-compass-tip" d="M96 49 L107 99 L96 93 L85 99 Z" />
        <path className="clock-compass-highlight" d="M96 49 L96 93 L85 99 Z" />
      </g>
      {dial && <g className="clock-qibla-needle" data-testid="qibla-needle" style={{ transform: `rotate(${dial.pointerRotation}deg)` }}>
        <path className="clock-qibla-trail" d="M96 71V64" />
        <path className="clock-qibla-tip" d="M96 12 103.5 27 96 24 88.5 27Z" />
      </g>}
      {dial?.live && <path className="clock-qibla-index" d="M91 4H101L96 10Z" />}
      <Kaaba tilt={tilt} />
    </svg>
    <div className="clock-compass-info">
      <h2 id={title}><Compass size={15} aria-hidden="true" />{label('compass')}</h2>
      <div className="clock-compass-reading" aria-live="off">
        <bdi dir="ltr" data-testid="compass-bearing">{bearing !== undefined ? `${formatLocalizedNumber(lang, bearing, { grouping: false })}°` : '—°'}</bdi>
        {bearing !== undefined && <span>{label(compassPoint(bearing))}</span>}
      </div>
      <p id={status} role="status">{label(dial?.live ? 'corrected' : state.phase)}</p>
      <button type="button" aria-describedby={status} aria-pressed={tracking} disabled={state.phase === 'requesting'} onClick={() => { void toggle(); }}>
        <Power size={14} aria-hidden="true" />{label(tracking ? 'stop' : 'enable')}
      </button>
    </div>
    <QiblaControls lang={lang} state={qibla.state} live={dial?.live ?? false} aligned={dial?.aligned ?? false} locate={qibla.locate} selectCity={qibla.selectCity} />
  </section>;
});
