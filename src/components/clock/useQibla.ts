import { useCallback, useEffect, useRef, useState } from 'react';
import { WORLD_CITIES, type GazetteerCity } from '../../data/worldEntryGazetteer';
import { qiblaAt, type QiblaDirection } from '../../utils/qibla';

export type QiblaState = { phase: 'ready'; direction: QiblaDirection; city?: GazetteerCity }
  | { phase: 'idle' | 'locating' | 'denied' | 'timeout' | 'unsupported' | 'failed' | 'uncertain'; direction?: never; city?: never };

/** Location is requested only by the compass button; keep just the angle, not a GPS fix. */
export function useQibla() {
  const [state, setState] = useState<QiblaState>({ phase: 'idle' });
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);

  const locate = useCallback(() => {
    const id = ++generation.current;
    if (!window.isSecureContext || !navigator.geolocation) { setState({ phase: 'unsupported' }); return; }
    setState({ phase: 'locating' });
    try {
      navigator.geolocation.getCurrentPosition(({ coords }) => {
        if (generation.current !== id) return;
        const direction = qiblaAt(coords.latitude, coords.longitude, coords.accuracy);
        setState(direction ? { phase: 'ready', direction } : { phase: 'uncertain' });
      }, (error) => {
        if (generation.current !== id) return;
        setState({ phase: error.code === 1 ? 'denied' : error.code === 3 ? 'timeout' : 'failed' });
      }, { enableHighAccuracy: true, maximumAge: 0, timeout: 12_000 });
    } catch {
      if (generation.current === id) setState({ phase: 'failed' });
    }
  }, []);

  const selectCity = useCallback((key: string) => {
    generation.current++;
    const city = WORLD_CITIES.find((candidate) => candidate.key === key);
    if (!city) { setState({ phase: 'idle' }); return; }
    const direction = qiblaAt(city.lat, city.lon);
    setState(direction ? { phase: 'ready', direction, city } : { phase: 'uncertain' });
  }, []);

  return { state, locate, selectCity };
}
