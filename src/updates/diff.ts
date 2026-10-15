/**
 * محرك المقارنة — يقارن التطوير الوارد بالموجود لتحديد «الزيادة فقط».
 * مقارنة عميقة مستقرة عن ترتيب المفاتيح، وبصمة محتوى (fingerprint) لكشف
 * الحزم المعادة، ومقارنة إصدارات رقمية صارمة.
 */

import type { DevelopmentItem, DevelopmentPackage } from './types';

/** تسلسل JSON مستقر: مفاتيح الكائنات مرتبة أبجدياً لتستقر المقارنة والبصمة. */
export function stableStringify(value: unknown): string {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(v as Record<string, unknown>).sort()) {
        out[key] = walk((v as Record<string, unknown>)[key]);
      }
      return out;
    }
    return v;
  };
  return JSON.stringify(walk(value));
}

/** بصمة محتوى djb2 بصيغة ست عشرية — تعمل على البيانات التصريحية (JSON). */
export function contentHash(value: unknown): string {
  const text = stableStringify(value);
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** تساوي عميق مستقل عن ترتيب المفاتيح. */
export function deepEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

export type VersionComparison = 'newer' | 'equal' | 'older';

export function compareVersions(installedVersion: number, incomingVersion: number): VersionComparison {
  if (incomingVersion > installedVersion) return 'newer';
  if (incomingVersion < installedVersion) return 'older';
  return 'equal';
}

/**
 * ما الذي تغير فعلاً بين عنصر مثبت وعنصر وارد؟
 * - نفس المحتوى → 'unchanged' حتى لو غيّرت المنصة رقم الإصدار.
 * - محتوى مختلف بإصدار أحدث → 'updated'.
 * - محتوى مختلف بإصدار مساوٍ أو أقدم → 'stale' (المثبت أحدث أو يكفي).
 */
export type ContentChange = 'applied' | 'updated' | 'unchanged' | 'stale';

export function classifyAgainstInstalled(
  installed: { version: number; payload: Record<string, unknown> } | null,
  incoming: DevelopmentItem,
): ContentChange {
  if (!installed) return 'applied';
  const sameContent = deepEqual(installed.payload, incoming.payload);
  if (sameContent) return 'unchanged';
  return compareVersions(installed.version, incoming.version) === 'newer' ? 'updated' : 'stale';
}

/** بصمة حزمة كاملة لكشف الاستقبال المكرر؛ لا تتأثر بترتيب العناصر. */
export function packageFingerprint(pkg: DevelopmentPackage): string {
  const sortedItems = [...pkg.items]
    .map((item) => ({ ...item }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return contentHash({
    schemaVersion: pkg.schemaVersion,
    packageId: pkg.packageId,
    platform: String(pkg.platform),
    items: sortedItems,
  });
}
