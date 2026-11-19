import { memo, useEffect, useId, useRef, useState } from 'react';
import { Compass, Power } from 'lucide-react';
import type { SupportedLanguage } from '../../types/i18n';
import { makeT, type LText } from '../../لغات/localize';
import { formatLocalizedNumber } from '../../لغات/numerals';
import { compassPoint, compassXY, nextCompassRotation, normalizeBearing, readCompassBearing, type CompassOrientation } from '../../utils/visitorCompass';

const TEXT = {
  compass: { ar: 'البوصلة', en: 'Compass' },
  enable: { ar: 'فعّل البوصلة', en: 'Enable compass' },
  stop: { ar: 'إيقاف البوصلة', en: 'Stop compass' },
  idle: { ar: 'فعّل الحساس عشان تعرف اتجاه الموبايل.', en: 'Turn on the sensor to see your device heading.' },
  requesting: { ar: 'اسمح للمتصفح باستخدام الحساس.', en: 'Allow access to the compass sensor.' },
  waiting: { ar: 'امسك الموبايل بشكل أفقي ولفّه بالراحة.', en: 'Hold the phone flat and turn it slowly.' },
  ready: { ar: 'قراءة من حساس الجهاز', en: 'Reading from your device' },
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

type CompassState = { phase: 'ready'; bearing: number; rotation: number }
  | { phase: 'idle' | 'requesting' | 'waiting' | 'denied' | 'unsupported' | 'noData'; bearing?: never; rotation?: never };
type Phase = CompassState['phase'];
type SensorEvent = DeviceOrientationEvent & Pick<CompassOrientation, 'webkitCompassHeading' | 'webkitCompassAccuracy'>;
const active = (phase: Phase) => phase === 'waiting' || phase === 'ready' || phase === 'noData';
const screenAngle = () => window.screen.orientation?.angle ?? window.orientation ?? 0;

function useDeviceCompass() {
  const [state, setState] = useState<CompassState>({ phase: 'idle' });
  const stopListening = useRef<(() => void) | null>(null);
  const generation = useRef(0);
  useEffect(() => () => {
    generation.current++;
    stopListening.current?.();
    stopListening.current = null;
  }, []);

  const toggle = async () => {
    if (stopListening.current) {
      generation.current++;
      stopListening.current();
      stopListening.current = null;
      setState({ phase: 'idle' });
      return;
    }
    if (state.phase === 'requesting') return;
    if (typeof DeviceOrientationEvent === 'undefined' || !window.isSecureContext) {
      setState({ phase: 'unsupported' });
      return;
    }
    const request = ++generation.current;
    const api = DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: (absolute?: boolean) => Promise<string> };
    setState({ phase: 'requesting' });
    try {
      const permission = api.requestPermission ? await api.requestPermission(true) : 'granted';
      if (request !== generation.current) return;
      if (permission !== 'granted') { setState({ phase: 'denied' }); return; }
    } catch {
      if (request === generation.current) setState({ phase: 'denied' });
      return;
    }

    let sample: CompassOrientation | undefined;
    let frame: number | undefined;
    const noData = window.setTimeout(() => setState((previous) => previous.phase === 'waiting' ? { phase: 'noData' } : previous), 5000);
    const update = () => {
      if (frame !== undefined) return;
      frame = window.requestAnimationFrame(() => {
        frame = undefined;
        if (request !== generation.current || !sample) return;
        const angle = readCompassBearing(sample, screenAngle());
        if (angle === undefined) {
          setState((previous) => previous.phase === 'ready' ? { phase: 'noData' } : previous);
          return;
        }
        const bearing = normalizeBearing(Math.round(angle));
        window.clearTimeout(noData);
        setState((previous) => previous.bearing === bearing ? previous : {
          phase: 'ready', bearing, rotation: nextCompassRotation(previous.rotation ?? 0, bearing),
        });
      });
    };
    const read = (raw: Event) => {
      // Ignore relative events even when the browser delivers them alongside
      // the absolute feed. Otherwise they overwrite the actual north reading.
      const event = raw as SensorEvent;
      const hasWebKitHeading = typeof event.webkitCompassHeading === 'number';
      if (!event.absolute && !hasWebKitHeading) return;
      // Some browsers also signal that their absolute event stream is empty.
      // That is not a loss of a heading supplied by WebKit's separate stream.
      if (event.alpha === null && !hasWebKitHeading && sample?.webkitCompassHeading !== undefined) return;
      sample = {
        absolute: event.absolute, alpha: event.alpha, beta: event.beta, gamma: event.gamma,
        webkitCompassHeading: event.webkitCompassHeading, webkitCompassAccuracy: event.webkitCompassAccuracy,
      };
      update();
    };
    const orientation = window.screen.orientation;
    window.addEventListener('deviceorientation', read, { passive: true });
    window.addEventListener('deviceorientationabsolute', read, { passive: true });
    orientation?.addEventListener('change', update);
    window.addEventListener('orientationchange', update);
    stopListening.current = () => {
      window.removeEventListener('deviceorientation', read);
      window.removeEventListener('deviceorientationabsolute', read);
      orientation?.removeEventListener('change', update);
      window.removeEventListener('orientationchange', update);
      window.clearTimeout(noData);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
    };
    setState({ phase: 'waiting' });
  };
  return { state, toggle };
}

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

export const VisitorCompass = memo(function VisitorCompass({ lang }: { lang: SupportedLanguage }) {
  const label = makeT(lang, TEXT);
  const title = useId();
  const status = useId();
  const { state, toggle } = useDeviceCompass();
  const tracking = active(state.phase);
  const { bearing } = state;
  return <section className="clock-compass" aria-labelledby={title} data-testid="visitor-compass" data-state={state.phase}>
    <svg className="clock-compass-dial" viewBox="0 0 192 192" aria-hidden="true">
      <circle className="clock-compass-outer" cx={CENTER} cy={CENTER} r="94" />
      <circle className="clock-compass-rim" cx={CENTER} cy={CENTER} r="90" />
      <circle className="clock-compass-inner" cx={CENTER} cy={CENTER} r="73" />
      <path className="clock-compass-rose" d="M96 63 L100 91 L129 96 L100 101 L96 129 L92 101 L63 96 L92 91 Z" />
      <Marks lang={lang} />
      <g className="clock-compass-arrow" data-bearing={state.bearing} style={{ transform: `rotate(${state.rotation ?? 0}deg)` }}>
        <path className="clock-compass-tail" d="M88 93 L96 123 L104 93 Z" />
        <path className="clock-compass-tip" d="M96 64 L107 106 L96 98 L85 106 Z" />
        <path className="clock-compass-highlight" d="M96 64 L96 98 L85 106 Z" />
      </g>
      <circle className="clock-compass-pin" cx={CENTER} cy={CENTER} r="4" />
    </svg>
    <div className="clock-compass-info">
      <h2 id={title}><Compass size={15} aria-hidden="true" />{label('compass')}</h2>
      <div className="clock-compass-reading" aria-live="off">
        <bdi dir="ltr" data-testid="compass-bearing">{bearing !== undefined ? `${formatLocalizedNumber(lang, bearing, { grouping: false })}°` : '—°'}</bdi>
        {bearing !== undefined && <span>{label(compassPoint(bearing))}</span>}
      </div>
      <p id={status} role="status">{label(state.phase)}</p>
      <button type="button" aria-describedby={status} aria-pressed={tracking} disabled={state.phase === 'requesting'} onClick={() => { void toggle(); }}>
        <Power size={14} aria-hidden="true" />{label(tracking ? 'stop' : 'enable')}
      </button>
    </div>
  </section>;
});
