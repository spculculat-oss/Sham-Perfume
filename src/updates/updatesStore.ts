/**
 * مخزن التحديثات المثبتة وسجلها (ledger) — «الموجود» الذي تُقارن به أي
 * حزمة واردة، إضافة إلى سجل التحديثات المطبقة مع بصمة كل حزمة لكشف
 * الاستقبال المكرر. السجل محدود الحجم كي لا ينمو بلا نهاية في المتصفح.
 */

import { readJson, writeJson, UPDATES_INSTALLED_KEY, UPDATES_LEDGER_KEY } from './storage';
import { packageFingerprint } from './diff';
import type { DevelopmentItem, DevelopmentPlatform, InstalledItem, LedgerEntry, ItemDecision } from './types';

/** أقصى عدد قيود محفوظة في السجل؛ الأقدم يُشال عند تجاوزه. */
export const LEDGER_LIMIT = 200;

function loadInstalled(): Record<string, InstalledItem> {
  const raw = readJson<Record<string, unknown>>(UPDATES_INSTALLED_KEY, {});
  const clean: Record<string, InstalledItem> = {};
  for (const [id, entry] of Object.entries(raw)) {
    if (
      entry && typeof entry === 'object' &&
      typeof (entry as InstalledItem).id === 'string' &&
      typeof (entry as InstalledItem).version === 'number' &&
      (entry as InstalledItem).payload && typeof (entry as InstalledItem).payload === 'object'
    ) {
      clean[id] = entry as InstalledItem;
    }
  }
  return clean;
}

function saveInstalled(all: Record<string, InstalledItem>): void {
  writeJson(UPDATES_INSTALLED_KEY, all);
}

export function listInstalledItems(): InstalledItem[] {
  return Object.values(loadInstalled()).sort((a, b) => (a.appliedAt < b.appliedAt ? 1 : -1));
}

export function getInstalledItem(id: string): InstalledItem | null {
  return loadInstalled()[id] ?? null;
}

export function installedIds(): Set<string> {
  return new Set(Object.keys(loadInstalled()));
}

/** تثبيت عنصر (زيادة جديدة أو ترقية) مع توثيق مصدره ووقته. */
export function putInstalledItem(
  item: DevelopmentItem,
  meta: { platform: DevelopmentPlatform; packageId: string },
): InstalledItem {
  const all = loadInstalled();
  const installed: InstalledItem = {
    id: item.id,
    kind: item.kind,
    version: item.version,
    titleAr: item.titleAr,
    titleEn: item.titleEn,
    payload: item.payload,
    requires: item.requires,
    files: item.files,
    appliedAt: new Date().toISOString(),
    fromPlatform: String(meta.platform),
    fromPackageId: meta.packageId,
  };
  all[item.id] = installed;
  saveInstalled(all);
  return installed;
}

/** إزالة عنصر من المثبتات (عند إلغائه أو عند حلول بديل محله). */
export function removeInstalledItem(id: string): boolean {
  const all = loadInstalled();
  if (!(id in all)) return false;
  delete all[id];
  saveInstalled(all);
  return true;
}

export function listLedger(): LedgerEntry[] {
  const raw = readJson<unknown[]>(UPDATES_LEDGER_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry): entry is LedgerEntry =>
    entry !== null && typeof entry === 'object' &&
    typeof (entry as LedgerEntry).packageId === 'string' &&
    typeof (entry as LedgerEntry).fingerprint === 'string' &&
    typeof (entry as LedgerEntry).counts === 'object');
}

export function findLedgerEntry(packageId: string): LedgerEntry | null {
  return listLedger().find((entry) => entry.packageId === packageId) ?? null;
}

export function appendLedgerEntry(
  pkg: { packageId: string; platform: DevelopmentPlatform; noteAr?: string },
  fingerprint: string,
  counts: Record<ItemDecision, number>,
  revision: boolean,
): LedgerEntry[] {
  const ledger = listLedger();
  ledger.unshift({
    packageId: pkg.packageId,
    platform: String(pkg.platform),
    receivedAt: new Date().toISOString(),
    fingerprint,
    revision,
    counts,
    noteAr: pkg.noteAr,
  });
  const trimmed = ledger.slice(0, LEDGER_LIMIT);
  writeJson(UPDATES_LEDGER_KEY, trimmed);
  return trimmed;
}

/** هل استُقبلت هذه الحزمة نفسها (نفس المعرف والبصمة) من قبل؟ */
export function isDuplicatePackage(
  pkg: { packageId: string; platform: DevelopmentPlatform },
  fingerprint: string,
): { duplicate: boolean; revision: boolean } {
  const previous = findLedgerEntry(pkg.packageId);
  if (!previous) return { duplicate: false, revision: false };
  if (previous.fingerprint === fingerprint) return { duplicate: true, revision: false };
  // نفس المعرف بمحتوى مختلف: نسخة منقحة تعالج من جديد ويُشار لذلك في السجل.
  return { duplicate: false, revision: true };
}
