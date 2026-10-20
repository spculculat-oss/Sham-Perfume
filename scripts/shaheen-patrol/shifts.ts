/**
 * The patrol's shifts — pure data with no Node imports, so the admin panel can show the rota too.
 */
import type { BotId } from '../../src/utils/shaheenOrg';
import type { ProbeId } from './patrol';

export type ShiftIndex = 0 | 1 | 2;
export interface Shift { index: ShiftIndex; nameAr: string; nameEn: string; bots: BotId[]; probes: ProbeId[] }
/**
 * «بالتناوب»: three shifts, one per hour, so the load on the site stays small — a shift runs only its own probes
 * (the heavy tests — photos, product pages — in the store shift), restarts at most 3 approved workflows and asks
 * Shaheen at most once. Each role is monitored every 3 hours from reports, runs and supervisor scores where available;
 * roles without a workflow (including the design expert) are not invoked automatically.
 */
export const SHIFTS: Shift[] = [
  { index: 0, nameAr: 'وردية المتجر والأسعار', nameEn: 'Store & pricing shift', bots: ['scout', 'importer', 'images', 'catalog', 'product_pages', 'store_advisor', 'finance', 'contracts'], probes: ['pricing', 'catalog', 'currency', 'fx', 'images', 'product_pages', 'payments'] },
  { index: 1, nameAr: 'وردية المحتوى وتجربة الزائر', nameEn: 'Content & visitor shift', bots: ['news', 'seo', 'chat', 'languages', 'design_audit', 'design_expert', 'visitor_tour', 'inspect', 'school', 'secretary'], probes: ['l10n', 'news_file', 'news_api', 'sitemap'] },
  { index: 2, nameAr: 'وردية الجودة والإدارة', nameEn: 'Reliability & leadership shift', bots: ['council', 'precheck', 'patrol', 'legal', 'doctor', 'verifier', 'live_check', 'keys', 'intake', 'studio_bridge', 'studio_zip', 'deploy', 'admin_agent'], probes: ['site', 'engine'] },
];
export const SHIFT_HOURS = SHIFTS.length;
/** The shift of this hour (UTC hours since the epoch, so it never skips across midnight). */
export const shiftAt = (now: number): ShiftIndex => (Math.floor(now / 3_600_000) % SHIFT_HOURS) as ShiftIndex;
export const shiftOfBot = (id: BotId): ShiftIndex => (SHIFTS.find((x) => x.bots.includes(id))?.index ?? 2);
export const shiftOfProbe = (id: ProbeId): ShiftIndex => (SHIFTS.find((x) => x.probes.includes(id))?.index ?? 2);
/** When a shift next comes round (the start of its hour). */
export function nextShiftAt(index: ShiftIndex, now: number): string {
  const hour = Math.floor(now / 3_600_000);
  let h = hour + 1;
  while (h % SHIFT_HOURS !== index) h++;
  return new Date(h * 3_600_000).toISOString();
}

