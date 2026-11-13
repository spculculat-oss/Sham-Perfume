/**
 * سجل الملغيات — قلب قاعدة «ما لغيناه قبل كده يفضل ملغي»:
 * كل تطوير أُلغي (يدوياً من الإدارة أو لأنه رُفض) يُدفن هنا، وأي محاولة
 * من أي منصة لإعادة إدخاله تُرفض تلقائياً وتُحتسب كمحاولة مرفوضة.
 * الاستعادة الوحيدة قرار صريح من الإدارة عبر البوابة نفسها.
 */

import { readJson, writeJson, UPDATES_CANCELED_KEY } from './storage';
import type { CanceledItem } from './types';

function loadAll(): Record<string, CanceledItem> {
  const raw = readJson<Record<string, unknown>>(UPDATES_CANCELED_KEY, {});
  const clean: Record<string, CanceledItem> = {};
  // تُقبل القيود الصالحة فقط؛ أي سجل فاسد يُرفض ولا يوقف البقية.
  for (const [id, entry] of Object.entries(raw)) {
    if (
      entry && typeof entry === 'object' &&
      typeof (entry as CanceledItem).id === 'string' &&
      typeof (entry as CanceledItem).canceledAt === 'string' &&
      typeof (entry as CanceledItem).rejectedAttempts === 'number'
    ) {
      clean[id] = entry as CanceledItem;
    }
  }
  return clean;
}

function saveAll(all: Record<string, CanceledItem>): void {
  writeJson(UPDATES_CANCELED_KEY, all);
}

export function listCanceledItems(): CanceledItem[] {
  return Object.values(loadAll()).sort((a, b) => (a.canceledAt < b.canceledAt ? 1 : -1));
}

export function getCanceledItem(id: string): CanceledItem | null {
  return loadAll()[id] ?? null;
}

export function isCanceled(id: string): boolean {
  return getCanceledItem(id) !== null;
}

export interface CancelOptions {
  titleAr?: string;
  titleEn?: string;
  reasonAr?: string;
  reasonEn?: string;
  fromPackageId?: string;
}

/**
 * إلغاء تطوير: يُسجل في سجل الملغيات (ويُزال من المثبتات إن كان مثبتاً —
 * تتكفل البوابة بذلك). إلغاء معرّف لم يصل بعد مسموح أيضاً: نسلبه مسبقاً
 * فلا يُثبّت إذا وصل لاحقاً من أي منصة.
 */
export function cancelItem(id: string, options: CancelOptions = {}): CanceledItem {
  const all = loadAll();
  const existing = all[id];
  const entry: CanceledItem = {
    id,
    titleAr: options.titleAr ?? existing?.titleAr,
    titleEn: options.titleEn ?? existing?.titleEn,
    reasonAr: options.reasonAr ?? existing?.reasonAr,
    reasonEn: options.reasonEn ?? existing?.reasonEn,
    canceledAt: existing?.canceledAt ?? new Date().toISOString(),
    fromPackageId: options.fromPackageId ?? existing?.fromPackageId,
    rejectedAttempts: existing?.rejectedAttempts ?? 0,
    lastAttemptAt: existing?.lastAttemptAt,
  };
  all[id] = entry;
  saveAll(all);
  return entry;
}

/** استعادة صريحة من الإدارة: يخرج من سجل الملغيات ويصبح قابلاً للتثبيت مجدداً. */
export function restoreItem(id: string): boolean {
  const all = loadAll();
  if (!(id in all)) return false;
  delete all[id];
  saveAll(all);
  return true;
}

/** تسجيل محاولة مرفوضة: منصة أعادت إدخال تطوير ملغى فرفضناه ويثبت ذلك. */
export function recordCanceledAttempts(ids: string[]): void {
  if (!ids.length) return;
  const all = loadAll();
  const now = new Date().toISOString();
  for (const id of ids) {
    const entry = all[id];
    if (entry) {
      entry.rejectedAttempts += 1;
      entry.lastAttemptAt = now;
    }
  }
  saveAll(all);
}
