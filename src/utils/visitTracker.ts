/**
 * Privacy-preserving visitor counter client for «روبوت التعداد — دولة المنصة».
 *
 * Rules:
 *   - Never tracks `#admin`, `#owner`, or `#ops` panels.
 *   - Respects CookieConsent (`getConsent() === 'essential'` -> skips analytics beacon).
 *   - Never sets cookies or writes identifiers to `localStorage`; sends `credentials: 'omit'`.
 *   - Deduplicates repeated renders of the same section within 60 seconds in memory.
 */
import { apiUrl } from './api';
import { getConsent } from '../components/CookieConsent';
import { sanitizeCensusSection, type CensusDevice } from './platformCensus';

const DEDUPE_MS = 60_000;
const recentSections = new Map<string, number>();

function detectClientDevice(): CensusDevice {
  if (typeof window === 'undefined') return 'desktop';
  const w = window.innerWidth || 1280;
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

export function trackPlatformVisit(params: { section?: string; country?: string; lang?: string }): void {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return;
  try {
    const consent = getConsent();
    if (consent && consent.analytics === false) return;
    const hash = window.location.hash || '';
    if (/^#\/?(admin|owner|ops)(\/|$|\?)/i.test(hash)) return;
    const section = sanitizeCensusSection(params.section || hash || 'home');
    if (!section) return;

    const now = Date.now();
    const last = recentSections.get(section) || 0;
    if (now - last < DEDUPE_MS) return;
    recentSections.set(section, now);

    const url = apiUrl('/api/census/visit');
    // On pure static hosting with no configured API backend, skip silently rather than hitting a 404 HTML page.
    if (url.startsWith('/') && /\.github\.io$/i.test(window.location.hostname)) return;

    const payload = JSON.stringify({
      section,
      country: params.country,
      lang: params.lang,
      device: detectClientDevice(),
    });

    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      credentials: 'omit',
      keepalive: true,
    }).catch(() => { /* never disrupt visitor experience */ });
  } catch {
    // ignore
  }
}
