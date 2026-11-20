import { useCallback, useEffect, useRef, useState } from 'react';
import { isStaticHosting, requestApi } from '../../utils/api';
import { ageHeadlines, HEADLINE_REFRESH_MS, HEADLINE_REQUEST_MS, HEADLINE_RETRY_MS, nextHeadlineChange, readHeadlines, type HomeHeadlines } from '../../utils/homeHeadlines';

interface CheckedBriefing { briefing: HomeHeadlines; tick: number; wallTime: number }

export function useHomeHeadlines() {
  // No cross-mount browser cache: each mount asks the API to resolve its entry country anew.
  const checked = useRef<CheckedBriefing | undefined>(undefined);
  const request = useRef<AbortController | null>(null);
  const [data, setData] = useState<HomeHeadlines>();
  const [loading, setLoading] = useState(!isStaticHosting);
  const [visible, setVisible] = useState(() => typeof document !== 'undefined' && !document.hidden);
  const [nextCheck, setNextCheck] = useState<number>();
  const [expires, setExpires] = useState<number>();

  const showAvailable = useCallback((failed = false) => {
    const last = checked.current;
    if (!last) return;
    // Anchor to checked server time. A suspended device may only advance the wall clock;
    // a backwards change to its date must never prolong old headlines.
    const tick = performance.now();
    const wallTime = Date.now();
    const asOf = last.briefing.asOf + Math.max(0, tick - last.tick, wallTime - last.wallTime);
    const briefing = ageHeadlines(last.briefing, asOf, failed);
    checked.current = { briefing, tick, wallTime };
    setData(briefing);
    setExpires(tick + nextHeadlineChange(briefing) - asOf);
  }, []);
  const refresh = useCallback(async () => {
    if (isStaticHosting || request.current) return;
    if (navigator.onLine === false) { showAvailable(true); setLoading(false); return; }
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    try {
      const payload = await requestApi<unknown>('/api/home-headlines', { cache: 'no-store', signal: controller.signal }, HEADLINE_REQUEST_MS);
      if (controller.signal.aborted) return;
      const briefing = readHeadlines(payload);
      const received = performance.now();
      checked.current = { briefing, tick: received, wallTime: Date.now() };
      showAvailable();
      const ok = [briefing.local.status, briefing.world.status].every((status) => status === 'fresh' || status === 'empty' || status === 'unsupported');
      setNextCheck(received + (ok ? HEADLINE_REFRESH_MS : HEADLINE_RETRY_MS));
    } catch {
      if (!controller.signal.aborted) { showAvailable(true); setNextCheck(performance.now() + HEADLINE_RETRY_MS); }
    } finally {
      if (request.current === controller) { request.current = null; setLoading(false); }
    }
  }, [showAvailable]);

  useEffect(() => {
    const wake = () => {
      if (document.hidden) return;
      showAvailable(navigator.onLine === false);
      void refresh();
    };
    const visibility = () => { setVisible(!document.hidden); wake(); };
    const offline = () => { request.current?.abort(); showAvailable(true); };
    wake();
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('online', wake);
    window.addEventListener('offline', offline);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('online', wake);
      window.removeEventListener('offline', offline);
      request.current?.abort();
      request.current = null;
    };
  }, [refresh, showAvailable]);

  useEffect(() => {
    if (!visible || nextCheck === undefined) return;
    const timer = window.setTimeout(() => { if (!document.hidden) void refresh(); }, Math.max(0, nextCheck - performance.now()));
    return () => window.clearTimeout(timer);
  }, [visible, nextCheck, refresh]);

  useEffect(() => {
    if (expires === undefined) return;
    // On midnight, update the heading; on age expiry, remove old stories. Neither adds network traffic.
    const timer = window.setTimeout(() => showAvailable(), Math.max(0, expires - performance.now()) + 25);
    return () => window.clearTimeout(timer);
  }, [expires, showAvailable]);

  return { data, loading, visible, refresh };
}
