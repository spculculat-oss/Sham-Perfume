/**
 * «خزنة فهم الزوار» — the browser side. Records what a visitor does on the platform (sections, products, searches,
 * chat questions, cart, checkout) and sends it to the administration's vault (server/insights.ts), ONLY when he
 * accepted «التحليل» in the consent banner (src/components/CookieConsent.tsx). Withdrawing erases his record.
 * Texts are cleaned here too (no secrets, e-mails or long numbers leave the page); the server cleans them again.
 */
import { apiUrl, isStaticHosting, visitorId } from './api';
import { getCurrentUserSession } from './authStorage';
import { INSIGHTS_CONSENT_VERSION, carriesSecret, scrubText, type InsightEvent, type InsightEventType } from './visitorInsights';

const CONSENT_KEY = 'sham_cookie_consent_v1';
const FLUSH_MS = 6000;
let queue: InsightEvent[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
let context: { country?: string; language?: string } = {};

/** True while the visitor's consent (current text version) includes «التحليل». */
export function insightsAllowed(): boolean {
  if (typeof window === 'undefined' || isStaticHosting) return false;
  try {
    const raw = JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null') as { analytics?: boolean; version?: string } | null;
    return Boolean(raw?.analytics) && raw?.version === INSIGHTS_CONSENT_VERSION;
  } catch { return false; }
}

/** The page's country and language, sent with every batch. */
export function setInsightsContext(next: { country?: string; language?: string }) { context = { ...context, ...next }; }

const device = (): 'mobile' | 'tablet' | 'desktop' => {
  const ua = navigator.userAgent.toLowerCase();
  if (/ipad|tablet|(android(?!.*mobile))/.test(ua)) return 'tablet';
  return /mobi|iphone|ipod|android/.test(ua) ? 'mobile' : 'desktop';
};

export function flushInsights() {
  if (timer) { clearTimeout(timer); timer = undefined; }
  if (!queue.length) return;
  const events = queue.splice(0, 40);
  if (!insightsAllowed()) { queue = []; return; }
  const account = getCurrentUserSession().user?.id;
  const body = JSON.stringify({
    visitorId: visitorId(), consent: INSIGHTS_CONSENT_VERSION, ...context, device: device(), hour: new Date().getHours(), events,
    ...(account ? { accountId: String(account).slice(0, 80) } : {}),
  });
  const url = apiUrl('/api/insights/events');
  // text/plain keeps it a simple request (no CORS preflight from the GitHub Pages site).
  const sent = typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }));
  if (!sent) void fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body, keepalive: true }).catch(() => undefined);
  if (queue.length) flushInsights();
}

/** One interaction. Nothing happens without consent. */
export function trackInsight(type: InsightEventType, data: Omit<InsightEvent, 'type' | 'at'> = {}) {
  if (!insightsAllowed()) return;
  const event: InsightEvent = { type, at: Date.now(), ...data };
  if (data.text !== undefined) {
    if (carriesSecret(data.text)) { delete event.text; event.value = 'secret-dropped'; }
    else { const text = scrubText(data.text); if (!text) return; event.text = text; }
  }
  queue.push(event);
  if (queue.length >= 20) flushInsights();
  else if (!timer) timer = setTimeout(flushInsights, FLUSH_MS);
}

/** The visitor withdrew «التحليل»: forget the queue and erase his record on the server. */
export function withdrawInsights() {
  queue = [];
  if (typeof window === 'undefined' || isStaticHosting) return;
  void fetch(apiUrl(`/api/insights/me?visitorId=${encodeURIComponent(visitorId())}`), { method: 'DELETE', keepalive: true }).catch(() => undefined);
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushInsights);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushInsights(); });
  window.addEventListener('cookie-consent-updated', (e) => {
    const detail = (e as CustomEvent<{ analytics?: boolean }>).detail;
    if (detail && !detail.analytics) withdrawInsights();
  });
}
