import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  SKY_THEMES,
  nextSkyPhase,
  skyGlowX,
  skyPhaseFor,
  skyTilt,
  type SkyPhase,
} from '../../utils/clockSky';
import { normalizeBearing, readCompassBearing } from '../../utils/visitorCompass';

export type SkyCompass =
  | { phase: 'off' }
  | { phase: 'waiting' }
  | { phase: 'ready'; bearing: number }
  | { phase: 'denied' }
  | { phase: 'unsupported' };

type SensorEvent = DeviceOrientationEvent & { webkitCompassHeading?: number; webkitCompassAccuracy?: number };
const screenAngle = () => window.screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0;

/**
 * The glass sky shared by the Home card and the compact bar: the light follows
 * the visitor's hour, the pointer, a drag, or a tap; and once the visitor turns
 * the compass on, the shine swings to follow the device's heading.
 */
export function useClockSky(now: Date | undefined, timeZone: string) {
  const [manualPhase, setManualPhase] = useState<SkyPhase | undefined>();
  const [tilt, setTilt] = useState(0);
  const [glowX, setGlowX] = useState(50);
  const [compass, setCompass] = useState<SkyCompass>({ phase: 'off' });
  const stopListening = useRef<(() => void) | null>(null);
  const generation = useRef(0);
  const ownBearing = useRef(false);

  useEffect(() => () => {
    generation.current++;
    stopListening.current?.();
    stopListening.current = null;
  }, []);

  const seasonalPhase = skyPhaseFor(now, timeZone);
  const phase = manualPhase ?? seasonalPhase;
  const theme = SKY_THEMES[phase];
  const angle = tilt + (compass.phase === 'ready' ? (compass.bearing > 180 ? compass.bearing - 360 : compass.bearing) * 0.4 : 0);

  const cycle = useCallback(() => {
    setManualPhase((current) => nextSkyPhase(current ?? skyPhaseFor(new Date(), timeZone)));
  }, [timeZone]);

  const followPointer = useCallback((event: { clientX: number; currentTarget: Element }) => {
    const box = event.currentTarget.getBoundingClientRect();
    setGlowX(skyGlowX(event.clientX, box.left, box.width));
  }, []);

  const drag = useRef<{ startX: number; startTilt: number; width: number } | undefined>(undefined);
  const startDrag = useCallback((event: { clientX: number; currentTarget: Element }) => {
    const box = event.currentTarget.getBoundingClientRect();
    drag.current = { startX: event.clientX, startTilt: tilt, width: box.width };
    setGlowX(skyGlowX(event.clientX, box.left, box.width));
  }, [tilt]);
  const moveDrag = useCallback((event: { clientX: number }) => {
    const active = drag.current;
    if (!active) return;
    setTilt(skyTilt(event.clientX - active.startX, active.width) + active.startTilt);
  }, []);
  const endDrag = useCallback(() => { drag.current = undefined; }, []);

  const toggleCompass = useCallback(async () => {
    if (stopListening.current) {
      generation.current++;
      stopListening.current();
      stopListening.current = null;
      ownBearing.current = false;
      setCompass({ phase: 'off' });
      return;
    }
    if (typeof DeviceOrientationEvent === 'undefined' || !window.isSecureContext) {
      setCompass({ phase: 'unsupported' });
      return;
    }
    const request = ++generation.current;
    const api = DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: (absolute?: boolean) => Promise<string> };
    try {
      if (api.requestPermission && (await api.requestPermission(true)) !== 'granted') {
        if (request === generation.current) setCompass({ phase: 'denied' });
        return;
      }
    } catch {
      if (request === generation.current) setCompass({ phase: 'denied' });
      return;
    }
    let frame: number | undefined;
    const read = (raw: Event) => {
      const event = raw as SensorEvent;
      const hasWebKitHeading = typeof event.webkitCompassHeading === 'number';
      if (!event.absolute && !hasWebKitHeading) return;
      if (frame !== undefined || request !== generation.current) return;
      frame = window.requestAnimationFrame(() => {
        frame = undefined;
        const bearing = readCompassBearing({
          absolute: event.absolute, alpha: event.alpha, beta: event.beta, gamma: event.gamma,
          webkitCompassHeading: event.webkitCompassHeading, webkitCompassAccuracy: event.webkitCompassAccuracy,
        }, screenAngle());
        if (request !== generation.current || bearing === undefined) return;
        ownBearing.current = true;
        setCompass({ phase: 'ready', bearing: normalizeBearing(Math.round(bearing)) });
      });
    };
    const orientation = window.screen.orientation;
    window.addEventListener('deviceorientation', read, { passive: true });
    window.addEventListener('deviceorientationabsolute', read, { passive: true });
    orientation?.addEventListener('change', read as EventListener);
    stopListening.current = () => {
      window.removeEventListener('deviceorientation', read);
      window.removeEventListener('deviceorientationabsolute', read);
      orientation?.removeEventListener('change', read as EventListener);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
    };
    setCompass({ phase: 'waiting' });
    window.setTimeout(() => {
      if (request === generation.current && !ownBearing.current) {
        setCompass((previous) => previous.phase === 'waiting' ? { phase: 'unsupported' } : previous);
      }
    }, 6000);
  }, []);

  return {
    phase,
    seasonal: manualPhase === undefined,
    theme,
    angle,
    glowX,
    compass,
    cycle,
    resetPhase: () => setManualPhase(undefined),
    followPointer,
    startDrag,
    moveDrag,
    endDrag,
    toggleCompass,
  };
}

export type ClockSky = ReturnType<typeof useClockSky>;

/** Inline custom properties consumed by `.clock-glass` in clock.css. */
export function skyStyle(sky: ClockSky) {
  return {
    '--sky-glow': sky.theme.glow,
    '--sky-wash': sky.theme.wash,
    '--sky-sheen': sky.theme.sheen,
    '--sky-base': sky.theme.base,
    '--sky-angle': `${sky.angle}deg`,
    '--sky-x': `${sky.glowX}%`,
  } as CSSProperties;
}
