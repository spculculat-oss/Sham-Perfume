import { useEffect, useRef, useState } from 'react';
import { nextCompassRotation, normalizeBearing, readCompassBearing, type CompassOrientation } from '../../utils/visitorCompass';

type CompassState = { phase: 'ready'; bearing: number; rotation: number }
  | { phase: 'idle' | 'requesting' | 'waiting' | 'paused' | 'stale' | 'denied' | 'unsupported' | 'noData'; bearing?: never; rotation?: never };
type SensorEvent = DeviceOrientationEvent & Pick<CompassOrientation, 'webkitCompassHeading' | 'webkitCompassAccuracy'>;
const screenAngle = () => window.screen.orientation?.angle ?? window.orientation ?? 0;
const INITIAL_WAIT_MS = 5000;
// Some browsers send updates only when orientation changes. Give a stationary phone
// time to be read, but after a longer silence ask for a slight turn to refresh it.
const MAX_READING_AGE_MS = 30_000;

export function useDeviceCompass() {
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
      // Call inside the button gesture. Request the magnetometer as well as the gyro;
      // relative yaw alone has no reference to north. WebKit also supports its own heading.
      const permission = typeof api.requestPermission === 'function' ? await api.requestPermission(true) : 'granted';
      if (request !== generation.current) return;
      if (permission !== 'granted') { setState({ phase: 'denied' }); return; }
    } catch {
      if (request === generation.current) setState({ phase: 'denied' });
      return;
    }

    let sample: CompassOrientation | undefined;
    let receivedAt = 0;
    let frame: number | undefined;
    let noData: number | undefined;
    let freshnessTimer: number | undefined;
    let listening = false;
    const orientation = window.screen.orientation;
    const expire = () => {
      freshnessTimer = undefined;
      if (!listening || !sample) return;
      const remaining = MAX_READING_AGE_MS - (performance.now() - receivedAt);
      if (remaining > 0) {
        freshnessTimer = window.setTimeout(expire, remaining);
      } else {
        sample = undefined;
        setState((previous) => previous.phase === 'ready' ? { phase: 'stale' } : previous);
      }
    };
    const update = () => {
      if (!listening || frame !== undefined) return;
      frame = window.requestAnimationFrame(() => {
        frame = undefined;
        if (request !== generation.current || !listening || !sample) return;
        if (performance.now() - receivedAt >= MAX_READING_AGE_MS) {
          window.clearTimeout(freshnessTimer);
          expire();
          return;
        }
        const angle = readCompassBearing(sample, screenAngle());
        if (angle === undefined) {
          setState((previous) => previous.phase === 'ready' ? { phase: 'noData' } : previous);
          return;
        }
        const bearing = normalizeBearing(Math.round(angle));
        if (noData !== undefined) { window.clearTimeout(noData); noData = undefined; }
        if (freshnessTimer === undefined) freshnessTimer = window.setTimeout(expire, MAX_READING_AGE_MS);
        setState((previous) => previous.bearing === bearing ? previous : {
          phase: 'ready', bearing, rotation: nextCompassRotation(previous.rotation ?? 0, bearing),
        });
      });
    };
    const read = (raw: Event) => {
      const event = raw as SensorEvent;
      const hasWebKitHeading = typeof event.webkitCompassHeading === 'number';
      if (!event.absolute && !hasWebKitHeading) return;
      // An empty absolute stream doesn't override a separate WebKit heading stream.
      if (event.alpha === null && !hasWebKitHeading && sample?.webkitCompassHeading !== undefined) return;
      sample = {
        absolute: event.absolute, alpha: event.alpha, beta: event.beta, gamma: event.gamma,
        webkitCompassHeading: event.webkitCompassHeading, webkitCompassAccuracy: event.webkitCompassAccuracy,
      };
      receivedAt = performance.now();
      update();
    };
    const detach = () => {
      if (!listening) return;
      listening = false;
      window.removeEventListener('deviceorientation', read);
      window.removeEventListener('deviceorientationabsolute', read);
      orientation?.removeEventListener('change', update);
      window.removeEventListener('orientationchange', update);
      window.clearTimeout(noData);
      window.clearTimeout(freshnessTimer);
      noData = freshnessTimer = undefined;
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      frame = undefined;
      sample = undefined;
    };
    const visibility = () => {
      if (document.hidden) {
        detach();
        setState({ phase: 'paused' });
      } else if (!listening) {
        listening = true;
        setState({ phase: 'waiting' });
        window.addEventListener('deviceorientation', read, { passive: true });
        window.addEventListener('deviceorientationabsolute', read, { passive: true });
        orientation?.addEventListener('change', update);
        window.addEventListener('orientationchange', update);
        noData = window.setTimeout(() => {
          noData = undefined;
          setState((previous) => previous.phase === 'waiting' ? { phase: 'noData' } : previous);
        }, INITIAL_WAIT_MS);
      }
    };
    document.addEventListener('visibilitychange', visibility);
    stopListening.current = () => {
      detach();
      document.removeEventListener('visibilitychange', visibility);
    };
    visibility();
  };
  const tracking = ['waiting', 'ready', 'paused', 'noData'].includes(state.phase);
  return { state, tracking, toggle };
}
