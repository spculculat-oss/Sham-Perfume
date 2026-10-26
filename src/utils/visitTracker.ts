/**
 * Privacy-preserving visitor counter & live presence heartbeat client for «روبوت التعداد — دولة المنصة».
 *
 * Rules:
 *   - Never tracks `#admin`, `#owner`, or `#ops` panels.
 *   - Respects CookieConsent (`getConsent()?.analytics === false` -> skips analytics beacon).
 *   - Never sets cookies or writes identifiers to `localStorage`; sends `credentials: 'omit'`.
 *   - Sends IANA timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`) to enrich regional fallback,
 *     while Edge/CDN headers on the server provide exact city/governorate entry resolution.
 *   - Maintains a lightweight 45-second visibility-aware heartbeat for «العداد اللحظي» without inflating total visits.
 */
import { apiUrl } from './api';
import { getConsent } from '../components/CookieConsent';
import { sanitizeCensusSection, type CensusDevice } from './platformCensus';

const DEDUPE_MS = 60_000;
const HEARTBEAT_MS = 45_000;
const recentSections = new Map<string, number>();
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let latestParams: { section: string; country?: string; lang?: string } | null = null;

function detectClientDevice(): CensusDevice {
  if (typeof window === 'undefined') return 'desktop';
  const w = window.innerWidth || 1280;
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

function detectClientTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

function isAdminHash(): boolean {
  if (typeof window === 'undefined') return true;
  const hash = window.location.hash || '';
  return /^#\/?(admin|owner|ops)(\/|$|\?)/i.test(hash);
}

function sendBeaconPayload(kind: 'visit' | 'heartbeat', info: { section: string; country?: string; lang?: string }): void {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return;
  const consent = getConsent();
  if (consent && consent.analytics === false) return;
  if (isAdminHash()) return;

  const url = apiUrl('/api/census/visit');
  if (url.startsWith('/') && /\.github\.io$/i.test(window.location.hostname)) return;

  const payload = JSON.stringify({
    kind,
    section: info.section,
    country: info.country,
    lang: info.lang,
    tz: detectClientTimezone(),
    device: detectClientDevice(),
  });

  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    credentials: 'omit',
    keepalive: true,
  }).catch(() => { /* never disrupt visitor experience */ });
}

function ensureHeartbeatStarted(): void {
  if (heartbeatTimer || typeof window === 'undefined') return;
  heartbeatTimer = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    if (!latestParams || isAdminHash()) return;
    sendBeaconPayload('heartbeat', latestParams);
  }, HEARTBEAT_MS);
}

export function trackPlatformVisit(params: { section?: string; country?: string; lang?: string }): void {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return;
  try {
    const consent = getConsent();
    if (consent && consent.analytics === false) return;
    if (isAdminHash()) return;
    const hash = window.location.hash || '';
    const section = sanitizeCensusSection(params.section || hash || 'home');
    if (!section) return;

    latestParams = { section, country: params.country, lang: params.lang };
    ensureHeartbeatStarted();

    const now = Date.now();
    const last = recentSections.get(section) || 0;
    if (now - last < DEDUPE_MS) return;
    recentSections.set(section, now);

    sendBeaconPayload('visit', latestParams);
  } catch {
    // ignore
  }
}
