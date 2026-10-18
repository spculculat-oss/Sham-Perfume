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
