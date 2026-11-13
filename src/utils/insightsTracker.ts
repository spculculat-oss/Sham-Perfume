/**
 * «خزنة فهم الزوار» — the browser side. Records what a visitor does on the platform (sections, products, searches,
 * chat questions, cart, checkout) and sends it to the administration's vault (server/insights.ts), ONLY when he
 * accepted «التحليل» in the consent banner (src/components/CookieConsent.tsx). Withdrawing erases his record.
 * Texts are cleaned here too (no secrets, e-mails or long numbers leave the page); the server cleans them again.
 *
 * A visitor who has not answered the banner yet is part of «نبض الدول» only: anonymous counts (the event type, the
 * product, the section — no id, no text, nothing written on his device). One who refused is not counted at all.
 * One who accepted also gets «مختار ليك على ذوقك»: the products he viewed are remembered on HIS device only.
 */
import { apiUrl, isStaticHosting, visitorId } from './api';
import { getCurrentUserSession } from './authStorage';
import { INSIGHTS_CONSENT_VERSION, carriesSecret, scrubText, type InsightEvent, type InsightEventType } from './visitorInsights';
import { PULSE_EVENT_TYPES, type PulseEvent, type PulseEventType } from './insightsPulse';

const CONSENT_KEY = 'sham_cookie_consent_v1';
const FLUSH_MS = 6000;
const TASTE_KEY = 'sham_taste_viewed_v1';
const TASTE_MAX = 12;
let queue: InsightEvent[] = [];
let pulseQueue: PulseEvent[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
let context: { country?: string; language?: string } = {};

const storedConsent = (): { analytics?: boolean; version?: string } | null => {
  try { return JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null') as { analytics?: boolean; version?: string } | null; } catch { return null; }
};

/** The visitor accepted «التحليل» under the current consent text. */
export function analyticsAccepted(): boolean {
  if (typeof window === 'undefined') return false;
  const raw = storedConsent();
  return Boolean(raw?.analytics) && raw?.version === INSIGHTS_CONSENT_VERSION;
}

/** True while the visitor's consent (current text version) includes «التحليل» and there is a server to send to. */
export function insightsAllowed(): boolean {
  return !isStaticHosting && analyticsAccepted();
}

/** «نبض الدول» (anonymous counts) unless he refused «التحليل» — under any consent text. */
export function pulseAllowed(): boolean {
  if (typeof window === 'undefined' || isStaticHosting) return false;
  if (/^#\/?(admin|owner|ops)(\/|$|\?)/i.test(window.location.hash || '')) return false;
  const raw = storedConsent();
  return !(raw && raw.analytics === false);
}

/** «مختار ليك على ذوقك»: what he viewed, newest first — on his device, only while he accepts «التحليل». */
export function viewedForTaste(): string[] {
  if (!analyticsAccepted()) return [];
  try {
    const raw = JSON.parse(localStorage.getItem(TASTE_KEY) || '[]') as unknown;
    return Array.isArray(raw) ? raw.filter((s): s is string => typeof s === 'string' && s.length > 0 && s.length < 80).slice(0, TASTE_MAX) : [];
  } catch { return []; }
}
function rememberViewed(sku: string) {
  try { localStorage.setItem(TASTE_KEY, JSON.stringify([sku, ...viewedForTaste().filter((s) => s !== sku)].slice(0, TASTE_MAX))); } catch { /* private mode */ }
}

/** The page's country and language, sent with every batch. */
export function setInsightsContext(next: { country?: string; language?: string }) { context = { ...context, ...next }; }

const device = (): 'mobile' | 'tablet' | 'desktop' => {
  const ua = navigator.userAgent.toLowerCase();
  if (/ipad|tablet|(android(?!.*mobile))/.test(ua)) return 'tablet';
  return /mobi|iphone|ipod|android/.test(ua) ? 'mobile' : 'desktop';
};

const post = (path: '/api/insights/events' | '/api/insights/pulse', body: string) => {
  const url = apiUrl(path);
  // text/plain keeps it a simple request (no CORS preflight from the GitHub Pages site).
  const sent = typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }));
  if (!sent) void fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body, keepalive: true, credentials: 'omit' }).catch(() => undefined);
};

function flushPulse() {
  if (!pulseQueue.length) return;
  const events = pulseQueue.splice(0, 40);
  if (!pulseAllowed() || insightsAllowed()) { pulseQueue = []; return; }
  post('/api/insights/pulse', JSON.stringify({ language: context.language, device: device(), hour: new Date().getHours(), events }));
  if (pulseQueue.length) flushPulse();
}

export function flushInsights() {
  if (timer) { clearTimeout(timer); timer = undefined; }
  flushPulse();
  if (!queue.length) return;
  const events = queue.splice(0, 40);
  if (!insightsAllowed()) { queue = []; return; }
  const account = getCurrentUserSession().user?.id;
  const body = JSON.stringify({
    visitorId: visitorId(), consent: INSIGHTS_CONSENT_VERSION, ...context, device: device(), hour: new Date().getHours(), events,
    ...(account ? { accountId: String(account).slice(0, 80) } : {}),
  });
  post('/api/insights/events', body);
  if (queue.length) flushInsights();
}

const schedule = (size: number) => {
  if (size >= 20) flushInsights();
  else if (!timer) timer = setTimeout(flushInsights, FLUSH_MS);
};

/** One interaction: the vault with consent; otherwise, unless refused, only an anonymous count. */
export function trackInsight(type: InsightEventType, data: Omit<InsightEvent, 'type' | 'at'> = {}) {
  if (type === 'product' && data.sku && analyticsAccepted()) rememberViewed(data.sku);
  if (!insightsAllowed()) {
    if (!PULSE_EVENT_TYPES.includes(type as PulseEventType) || !pulseAllowed()) return;
    const event: PulseEvent = { type: type as PulseEventType };
    if (data.sku) event.sku = data.sku;
    if (data.section) event.section = data.section;
    pulseQueue.push(event);
    schedule(pulseQueue.length);
    return;
  }
  const event: InsightEvent = { type, at: Date.now(), ...data };
  if (data.text !== undefined) {
    if (carriesSecret(data.text)) { delete event.text; event.value = 'secret-dropped'; }
    else { const text = scrubText(data.text); if (!text) return; event.text = text; }
  }
  queue.push(event);
  schedule(queue.length);
}

/** The visitor withdrew «التحليل»: forget the queue and erase his record on the server. */
export function withdrawInsights() {
  queue = [];
  pulseQueue = [];
  try { localStorage.removeItem(TASTE_KEY); } catch { /* nothing kept */ }
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
