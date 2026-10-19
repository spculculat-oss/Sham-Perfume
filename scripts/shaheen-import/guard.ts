/**
 * L-03 Legal Guard — block scraper/import unless SHAM_ALLOW_SCRAPE=1 + permission file exists.
 * Call assertScrapeAllowed() at the start of any import/scrape run.
 */
import { existsSync, readFileSync } from 'node:fs';

export function isScrapeAllowed(): boolean {
  if (process.env.SHAM_ALLOW_SCRAPE !== '1') return false;
  const perm = new URL('../../docs/legal/scraper-permission.md', import.meta.url);
  try {
    const txt = readFileSync(perm, 'utf8');
    return txt.includes('PERMISSION GRANTED') && txt.trim().length > 100;
  } catch {
    return false;
  }
}

export function assertScrapeAllowed() {
  if (!isScrapeAllowed()) {
    const msg = [
      '⛔ SCRAPER BLOCKED (L-03 Legal Fix)',
      'Set SHAM_ALLOW_SCRAPE=1 and add docs/legal/scraper-permission.md with PERMISSION GRANTED + signed license.',
      'See SCRAPER_LEGAL_NOTICE.md and docs/legal/التقرير-القانوني-الشامل-شام-بيرفيوم-2026.md #L-03',
    ].join('\n');
    throw new Error(msg);
  }
}

/**
 * Which stores this run may read (L-03 + L-40). The written permission covering every store (above) opens all of
 * them; otherwise only the stores whose agreement was signed electronically and approved by the legal manager
 * («مسؤول التعاقدات», GET /api/admin/contracts/approved) — matched by domain (no scheme, no www).
 */
export function allowedSources<T extends { base: string }>(sources: T[], permission: { global: boolean; approvedDomains: string[] }): T[] {
  if (permission.global) return sources;
  const approved = new Set(permission.approvedDomains.map((d) => storeDomain(d)).filter(Boolean));
  return sources.filter((s) => approved.has(storeDomain(s.base)));
}
export const storeDomain = (input: string) => String(input || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[/?#:].*$/, '');

/** The approved stores from the server (admin token); [] when it cannot be read — then nothing new is read. */
export async function fetchApprovedDomains(apiBase: string, adminToken: string, request: typeof fetch = fetch): Promise<{ domains: string[]; error?: string }> {
  if (!apiBase || !adminToken) return { domains: [], error: 'no SHAM_API_BASE / SHAM_ADMIN_TOKEN' };
  try {
    const res = await request(`${apiBase.replace(/\/+$/, '')}/api/admin/contracts/approved`, { headers: { Authorization: `Bearer ${adminToken}` }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return { domains: [], error: `HTTP ${res.status}` };
    const data = await res.json() as { stores?: { domain?: string }[] };
    return { domains: (data.stores || []).map((s) => String(s.domain || '')).filter(Boolean) };
  } catch (error) {
    return { domains: [], error: (error as Error).message?.slice(0, 120) || 'failed' };
  }
}
