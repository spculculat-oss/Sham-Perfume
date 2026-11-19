import { useCallback, useEffect, useRef, useState } from 'react';
import { isStaticHosting, requestApi } from '../../utils/api';
import { HEADLINE_REFRESH_MS, HEADLINE_RETRY_MS, emptyHeadlines, headlineDay, nextHeadlineDay, readHeadlines, type HomeHeadlines } from '../../utils/homeHeadlines';

interface CheckedBriefing { briefing: HomeHeadlines; received: number }

function currentEdition(checked: CheckedBriefing, unavailable = false): HomeHeadlines {
  const { briefing, received } = checked;
  const day = headlineDay(briefing.asOf + Math.max(0, performance.now() - received), briefing.timeZone);
  if (day !== briefing.day) return {
    ...briefing, day,
    local: briefing.local.status === 'unsupported' ? briefing.local : emptyHeadlines(),
    world: emptyHeadlines(),
  };
  if (!unavailable) return briefing;
  const fallback = (section: HomeHeadlines['local']) => section.status === 'unsupported' ? section
    : section.items.length ? { ...section, status: 'stale' as const } : emptyHeadlines();
  return { ...briefing, local: fallback(briefing.local), world: fallback(briefing.world) };
}

export function useHomeHeadlines() {
  // No cross-mount browser cache: each mount asks the API to resolve its entry country anew.
  const checked = useRef<CheckedBriefing | undefined>(undefined);
  const request = useRef<AbortController | null>(null);
  const [data, setData] = useState<HomeHeadlines>();
  const [loading, setLoading] = useState(!isStaticHosting);
  const [visible, setVisible] = useState(() => typeof document !== 'undefined' && !document.hidden);
  const [nextCheck, setNextCheck] = useState<number>();
  const [expires, setExpires] = useState<number>();

  const retain = useCallback(() => {
    setData(checked.current ? currentEdition(checked.current, true) : undefined);
  }, []);
  const refresh = useCallback(async () => {
    if (isStaticHosting || request.current) return;
    if (navigator.onLine === false) { retain(); setLoading(false); return; }
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    try {
      const payload = await requestApi<unknown>('/api/home-headlines', { cache: 'no-store', signal: controller.signal }, 8000);
      if (controller.signal.aborted) return;
      const briefing = readHeadlines(payload);
      const received = performance.now();
      checked.current = { briefing, received };
      setData(currentEdition(checked.current));
      setExpires(received + nextHeadlineDay(briefing.asOf, briefing.timeZone) - briefing.asOf);
      const ok = [briefing.local.status, briefing.world.status].every((status) => status === 'fresh' || status === 'empty' || status === 'unsupported');
      setNextCheck(received + (ok ? HEADLINE_REFRESH_MS : HEADLINE_RETRY_MS));
    } catch {
      if (!controller.signal.aborted) { retain(); setNextCheck(performance.now() + HEADLINE_RETRY_MS); }
    } finally {
      if (request.current === controller) { request.current = null; setLoading(false); }
    }
  }, [retain]);

  useEffect(() => {
    const wake = () => {
      if (document.hidden) return;
      // Timers may have been suspended. Clear an expired edition before asking the API again.
      const last = checked.current;
      if (last && currentEdition(last).day !== last.briefing.day) setData(currentEdition(last));
      void refresh();
    };
    const visibility = () => { setVisible(!document.hidden); wake(); };
    const offline = () => { request.current?.abort(); retain(); };
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
  }, [refresh, retain]);

  useEffect(() => {
    if (!visible || nextCheck === undefined) return;
    const timer = window.setTimeout(() => { if (!document.hidden) void refresh(); }, Math.max(0, nextCheck - performance.now()));
    return () => window.clearTimeout(timer);
  }, [visible, nextCheck, refresh]);

  useEffect(() => {
    if (expires === undefined) return;
    const timer = window.setTimeout(() => {
      if (checked.current) setData(currentEdition(checked.current));
      if (!document.hidden) void refresh();
    }, Math.max(0, expires - performance.now()) + 25);
    return () => window.clearTimeout(timer);
  }, [expires, refresh]);

  return { data, loading, visible, refresh };
}
