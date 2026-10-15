/**
 * ═══════════════════════════════════════════════════════════════════════════
 * بوابة استقبال التحديثات — Update Gateway (الملف الأول)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * هذا الملف هو أول ما يستقبل أي تطوير قادم إلى التطبيق من أي منصة أخرى
 * (منصات تطوير، مساعدات برمجية، أدوات محلية...). لا يستقبل التطبيق أي
 * تحديث إلا من هنا.
 *
 * خط المعالجة (Pipeline):
 *   1) الاستلام والفحص   — validatePackage: رفض الحزم غير الصالحة كلياً.
 *   2) التحليل والمقارنة — مقارنة كل عنصر بالموجود: هل هو زيادة جديدة،
 *                         ترقية فعلية، موجود بنفس المحتوى، أم إصدار أقدم؟
 *   3) قاعدة الملغيات    — أي عنصر أُلغي سابقاً يُرفض فوراً ويبقى ملغىً،
 *                         مهذا حاولت أي منصة إعادة إدخاله.
 *   4) حماية المستخدمين  — صورة لبيانات المستخدمين قبل التطبيق، تحقق
 *                         وردٌّ بعده؛ وأي حمولة تحاول لمس تخزينهم تُرفض.
 *   5) تطبيق الزيادة فقط — لا يُثبَّت إلا الجديد فعلاً أو الأحدث فعلاً.
 *   6) الإدراج في السجل  — قيد في سجل التحديثات ببصمة الحزمة ونتائجها.
 *
 * الاستخدام من أي مكان في التطبيق يكون عبر هذا الملف فقط؛ الملفات الأخرى
 * في src/updates/ أجزاء داخلية للبوابة.
 */

import { classifyAgainstInstalled, packageFingerprint } from './diff';
import { findUserDataViolations, snapshotUserData, verifyAndRestoreUserData } from './userDataGuard';
import { cancelItem, getCanceledItem, listCanceledItems, recordCanceledAttempts, restoreItem } from './canceledRegistry';
import {
  appendLedgerEntry, findLedgerEntry, getInstalledItem, installedIds, isDuplicatePackage,
  listInstalledItems, listLedger, putInstalledItem, removeInstalledItem,
} from './updatesStore';
import type {
  CanceledItem, DevelopmentItem, DevelopmentItemKind, DevelopmentPackage, DevelopmentPlatform,
  InstalledItem, ItemDecision, ItemReport, LedgerEntry, ParsePackageResult, UpdateReport,
} from './types';

export type {
  CanceledItem, DevelopmentItem, DevelopmentItemKind, DevelopmentPackage, DevelopmentPlatform,
  InstalledItem, ItemDecision, ItemReport, LedgerEntry, ParsePackageResult, UpdateReport,
} from './types';

const SCHEMA_VERSION = 1;
const MAX_ITEMS_PER_PACKAGE = 500;
const MAX_PAYLOAD_CHARS = 262_144; // 256KB من JSON المتسلسل لكل حمولة.
const ITEM_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{1,119}$/i;
const ITEM_KINDS: readonly DevelopmentItemKind[] = ['tool', 'feature', 'data', 'content', 'config'];

export interface ValidationFailure {
  ok: false;
  errorAr: string;
  errorEn: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(errorAr: string, errorEn: string): ValidationFailure {
  return { ok: false, errorAr, errorEn };
}

/** الفحص الكامل للحزمة الواردة قبل أي معالجة — البوابة لا تثق بأحد. */
export function validatePackage(pkg: unknown): ValidationFailure | { ok: true } {
  if (!isPlainObject(pkg)) return fail('الحزمة ليست كائناً صالحاً.', 'Package is not a valid object.');
  if (pkg.schemaVersion !== SCHEMA_VERSION) {
    return fail(`إصدار المخطط ${String(pkg.schemaVersion)} غير مدعوم؛ المطلوب ${SCHEMA_VERSION}.`, `Unsupported schemaVersion ${String(pkg.schemaVersion)}; expected ${SCHEMA_VERSION}.`);
  }
  if (typeof pkg.packageId !== 'string' || !pkg.packageId.trim() || pkg.packageId.length > 200) {
    return fail('معرّف الحزمة (packageId) مفقود أو أطول من 200 حرف.', 'Package id is missing or longer than 200 chars.');
  }
  if (typeof pkg.platform !== 'string' || !pkg.platform.trim() || pkg.platform.length > 100) {
    return fail('منصة المصدر (platform) مفقودة أو غير صالحة.', 'Source platform is missing or invalid.');
  }
  if (pkg.authoredAt !== undefined && typeof pkg.authoredAt !== 'string') {
    return fail('وقت الإنشاء (authoredAt) يجب أن يكون نصاً.', 'authoredAt must be a string.');
  }
  for (const field of ['noteAr', 'noteEn'] as const) {
    if (pkg[field] !== undefined && (typeof pkg[field] !== 'string' || pkg[field].length > 2000)) {
      return fail(`الحقل ${field} يجب أن يكون نصاً بطول 2000 حرف كأقصى.`, `${field} must be a string of at most 2000 chars.`);
    }
  }
  if (!Array.isArray(pkg.items) || pkg.items.length === 0) {
    return fail('الحزمة لا تحتوي على أي عناصر تطوير.', 'Package contains no development items.');
  }
  if (pkg.items.length > MAX_ITEMS_PER_PACKAGE) {
    return fail(`عدد العناصر يتجاوز الحد (${MAX_ITEMS_PER_PACKAGE}).`, `Too many items (limit ${MAX_ITEMS_PER_PACKAGE}).`);
  }

  const seen = new Set<string>();
  for (const entry of pkg.items) {
    const where = `العنصر «${isPlainObject(entry) && typeof entry.id === 'string' ? entry.id : '?'}»`;
    if (!isPlainObject(entry)) return fail(`${where} ليس كائناً صالحاً.`, 'An item is not a valid object.');
    const item: Record<string, unknown> = entry;
    if (typeof item.id !== 'string' || !ITEM_ID_PATTERN.test(item.id)) {
      return fail(`${where}: المعرف يجب أن يتكون من حروف وأرقام ونقاط وشرطات (حرفان على الأقل).`, `${where}: id must match [a-z0-9][a-z0-9._-]{1,119}.`);
    }
    if (seen.has(item.id)) {
      return fail(`المعرف «${item.id}» مكرر داخل الحزمة نفسها.`, `Duplicate item id «${item.id}» inside the package.`);
    }
    seen.add(item.id);
    if (typeof item.kind !== 'string' || !(ITEM_KINDS as readonly string[]).includes(item.kind)) {
      return fail(`${where}: النوع «${String(item.kind)}» غير معروف.`, `${where}: unknown kind.`);
    }
    if (typeof item.version !== 'number' || !Number.isInteger(item.version) || item.version < 1) {
      return fail(`${where}: الإصدار يجب أن يكون عدداً صحيحاً ≥ 1.`, `${where}: version must be an integer ≥ 1.`);
    }
    for (const field of ['titleAr', 'titleEn'] as const) {
      if (typeof item[field] !== 'string' || !String(item[field]).trim() || String(item[field]).length > 300) {
        return fail(`${where}: العنوان ${field} مطلوب (300 حرف كأقصى).`, `${where}: ${field} is required (max 300 chars).`);
      }
    }
    if (!isPlainObject(item.payload)) {
      return fail(`${where}: الحمولة (payload) يجب أن تكون كائناً.`, `${where}: payload must be an object.`);
    }
    let serialized: string;
    try {
      serialized = JSON.stringify(item.payload);
    } catch {
      return fail(`${where}: الحمولة غير قابلة للتسلسل (مرجع دائري؟).`, `${where}: payload is not serializable.`);
    }
    if (serialized.length > MAX_PAYLOAD_CHARS) {
      return fail(`${where}: حجم الحمولة يتجاوز ${MAX_PAYLOAD_CHARS} حرفاً.`, `${where}: payload exceeds the size limit.`);
    }
    if (item.requires !== undefined) {
      const requires: unknown = item.requires;
      if (!Array.isArray(requires) || requires.some((dep: unknown) => typeof dep !== 'string' || !ITEM_ID_PATTERN.test(dep))) {
        return fail(`${where}: قائمة التبعيات غير صالحة.`, `${where}: invalid requires list.`);
      }
      const list = requires as string[];
      if (new Set(list).size !== list.length) {
        return fail(`${where}: تبعيات مكررة.`, `${where}: duplicate dependencies.`);
      }
      if (list.includes(item.id)) {
        return fail(`${where}: العنصر لا يمكن أن يعتمد على نفسه.`, `${where}: an item cannot require itself.`);
      }
    }
    if (item.replaces !== undefined && (typeof item.replaces !== 'string' || !ITEM_ID_PATTERN.test(item.replaces) || item.replaces === item.id)) {
      return fail(`${where}: قيمة replaces غير صالحة.`, `${where}: invalid replaces value.`);
    }
    if (item.files !== undefined) {
      const files: unknown = item.files;
      if (!Array.isArray(files) || files.some((file: unknown) => typeof file !== 'string' || file.length > 500)) {
        return fail(`${where}: قائمة الملفات غير صالحة.`, `${where}: invalid files list.`);
      }
    }
  }
  return { ok: true };
}

function emptyCounts(): Record<ItemDecision, number> {
  return { applied: 0, updated: 0, unchanged: 0, stale: 0, canceled: 0, rejected: 0, deferred: 0 };
}

function rejectedReport(pkgLike: { packageId?: unknown; platform?: unknown }, errorAr: string, errorEn: string): UpdateReport {
  return {
    ok: false,
    dryRun: false,
    duplicate: false,
    packageId: typeof pkgLike.packageId === 'string' ? pkgLike.packageId : '',
    platform: typeof pkgLike.platform === 'string' ? pkgLike.platform : 'unknown',
    receivedAt: new Date().toISOString(),
    counts: emptyCounts(),
    items: [],
    userDataPreserved: true,
    userDataNotesAr: ['لم يُلمس أي شيء: الحزمة رُفضت في الفحص.', 'Nothing was touched: the package failed validation.'],
    errorAr,
    errorEn,
  };
}

/** تحليل نص JSON وارد (لصق من منصة أخرى) وتحويله إلى حزمة مفحوصة. */
export function parseDevelopmentPackage(raw: string): ParsePackageResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, errorAr: 'النص ليس JSON صالحاً.', errorEn: 'Input is not valid JSON.' };
  }
  const validation = validatePackage(parsed);
  if (!validation.ok) return validation;
  return { ok: true, pkg: parsed as DevelopmentPackage };
}

/**
 * ═══════════════════════ استقبال تطوير ═══════════════════════
 * نقطة الدخول الأولى لأي تطوير. بـ dryRun تُحلَّل الحزمة وتُقارن دون أي كتابة.
 */
export function receiveDevelopment(input: unknown, options: { dryRun?: boolean } = {}): UpdateReport {
  const dryRun = options.dryRun === true;
  const validation = validatePackage(input);
  if (!validation.ok) {
    return rejectedReport(input as Record<string, unknown>, validation.errorAr, validation.errorEn);
  }
  const pkg = input as DevelopmentPackage;
  const receivedAt = new Date().toISOString();
  const fingerprint = packageFingerprint(pkg);

  // ── 1) الاستقبال المتكرر: نفس الحزمة تماماً لا تعالج مرتين.
  const { duplicate, revision } = isDuplicatePackage(pkg, fingerprint);
  if (duplicate) {
    return {
      ok: true, dryRun, duplicate: true, packageId: pkg.packageId, platform: String(pkg.platform),
      receivedAt, counts: emptyCounts(), items: [],
      userDataPreserved: true,
      userDataNotesAr: ['استُقبلت هذه الحزمة نفسها من قبل — لا يوجد جديد.', 'This exact package was already received; nothing new.'],
    };
  }

  // ── 2) التحليل: الملغيات أولاً، ثم بيانات المستخدمين، ثم التبعيات، ثم المقارنة.
  const installed = installedIds();
  const eligible = pkg.items.filter((item) => !getCanceledItem(item.id) && findUserDataViolations(item).length === 0);
  const eligibleIds = new Set(eligible.map((item) => item.id));
  // عناصر يحل محلها بديل آخر داخل نفس الحزمة: لا معنى لتثبيتها.
  const replacedInPackage = new Set(
    pkg.items.filter((item) => item.replaces && item.replaces !== item.id).map((item) => item.replaces as string),
  );

  const reports: ItemReport[] = [];
  for (const item of pkg.items) {
    const current = getInstalledItem(item.id);

    const canceledEntry = getCanceledItem(item.id);
    if (canceledEntry) {
      reports.push({
        id: item.id, titleAr: item.titleAr, decision: 'canceled',
        reasonAr: `تطوير ملغى سابقاً — يبقى ملغىً ولا يُثبّت (محاولات مرفوضة سابقة: ${canceledEntry.rejectedAttempts}).`,
        reasonEn: 'Previously canceled development; it stays canceled and is not installed.',
        previousVersion: current?.version,
      });
      continue;
    }

    const violations = findUserDataViolations(item);
    if (violations.length) {
      reports.push({
        id: item.id, titleAr: item.titleAr, decision: 'rejected',
        reasonAr: `الحزمة تحاول لمس بيانات المستخدمين (${violations.map((v) => v.field).join('، ')}) — مرفوض.`,
        reasonEn: `The item attempts to touch user data (${violations.map((v) => v.field).join(', ')}) — rejected.`,
        previousVersion: current?.version,
      });
      continue;
    }

    const missing = (item.requires ?? []).filter((dep) =>
      // التبعية غير مثبتة وغير واردة في هذه الحزمة، أو حل محلها بديل داخلها فستُزال.
      (!installed.has(dep) && !eligibleIds.has(dep)) || replacedInPackage.has(dep));
    if (missing.length) {
      reports.push({
        id: item.id, titleAr: item.titleAr, decision: 'deferred',
        reasonAr: `تبعيات غير متوفرة بعد: ${missing.join('، ')} — يُثبّت عند وصولها.`,
        reasonEn: `Missing dependencies: ${missing.join(', ')}; it will install once they arrive.`,
        previousVersion: current?.version,
      });
      continue;
    }

    if (replacedInPackage.has(item.id)) {
      reports.push({
        id: item.id, titleAr: item.titleAr, decision: 'stale',
        reasonAr: 'حل محلَّه عنصر أحدث ضمن نفس الحزمة (replaces) — لا يُثبّت.',
        reasonEn: 'A newer item in the same package replaces it; not installed.',
        previousVersion: current?.version,
      });
      continue;
    }

    const change = classifyAgainstInstalled(current, item);
    const reasonMap: Record<string, { reasonAr: string; reasonEn: string }> = {
      applied: {
        reasonAr: 'تطوير جديد غير موجود — هذه زيادة فعلية فتُثبّت.',
        reasonEn: 'New development not present before; a real increment, installed.',
      },
      updated: {
        reasonAr: `ترقية فعلية: ${current?.version} ← ${item.version} بمحتوى مختلف.`,
        reasonEn: `Genuine upgrade: ${current?.version} → ${item.version} with different content.`,
      },
      unchanged: {
        reasonAr: 'المحتوى نفسه موجود بالفعل — لا يحتاج تثبيتاً.',
        reasonEn: 'Identical content already installed; nothing to apply.',
      },
      stale: {
        reasonAr: `الإصدار المثبت (${current?.version}) أحدث أو يكفي — يتجاهل الوارد.`,
        reasonEn: `Installed version (${current?.version}) is newer or sufficient; incoming ignored.`,
      },
    };
    reports.push({
      id: item.id, titleAr: item.titleAr, decision: change,
      reasonAr: reasonMap[change].reasonAr, reasonEn: reasonMap[change].reasonEn,
      previousVersion: current?.version,
      appliedVersion: change === 'applied' || change === 'updated' ? item.version : undefined,
    });
  }

  const counts = emptyCounts();
  for (const report of reports) counts[report.decision] += 1;

  // ── 3) تحليل فقط (dryRun): تقرير كامل دون أي كتابة.
  if (dryRun) {
    return {
      ok: true, dryRun: true, duplicate: false, packageId: pkg.packageId, platform: String(pkg.platform),
      receivedAt, counts, items: reports,
      userDataPreserved: true,
      userDataNotesAr: ['تحليل بدون تطبيق: لم يُكتب شيء ولم تُلمس بيانات.', 'Dry run: nothing was written and no data was touched.'],
    };
  }

  // ── 4) حماية بيانات المستخدمين: صورة قبل، تطبيق، تحقق ورد بعده.
  const snapshot = snapshotUserData();
  const toInstall = reports.filter((r) => r.decision === 'applied' || r.decision === 'updated');
  for (const report of toInstall) {
    const item = pkg.items.find((candidate) => candidate.id === report.id) as DevelopmentItem;
    putInstalledItem(item, { platform: pkg.platform, packageId: pkg.packageId });
    if (item.replaces) removeInstalledItem(item.replaces);
  }
  recordCanceledAttempts(reports.filter((r) => r.decision === 'canceled').map((r) => r.id));

  const verification = verifyAndRestoreUserData(snapshot);
  const userDataNotesAr: string[] = [];
  if (!verification.preserved) {
    userDataNotesAr.push(
      `رُدّت مفاتيح بيانات المستخدمين التي حاولت الحزمة لمسها: ${verification.restored.join('، ')}.`,
      `User-data keys touched during apply were restored: ${verification.restored.join(', ')}.`,
    );
  }

  // ── 5) الإدراج في سجل التحديثات.
  appendLedgerEntry(pkg, fingerprint, counts, revision);

  return {
    ok: true, dryRun: false, duplicate: false, packageId: pkg.packageId, platform: String(pkg.platform),
    receivedAt, counts, items: reports,
    userDataPreserved: verification.preserved,
    userDataNotesAr,
  };
}

/** تحليل حزمة دون تطبيقها — يجيب «ماذا سيحدث لو...؟» قبل الاستقبال الفعلي. */
export function analyzePackage(input: unknown): UpdateReport {
  return receiveDevelopment(input, { dryRun: true });
}

/**
 * إلغاء تطوير: يخرج من المثبتات إن كان مثبتاً، ويُدفن في سجل الملغيات
 * فلا يُثبّت مجدداً من أي منصة مهما عاد. يمكن أيضاً إلغاء معرّف لم يصل
 * بعد (إلغاء استباقي).
 */
export function cancelDevelopment(id: string, reasonAr = '', reasonEn = ''): CanceledItem {
  const installed = getInstalledItem(id);
  removeInstalledItem(id);
  return cancelItem(id, {
    titleAr: installed?.titleAr,
    titleEn: installed?.titleEn,
    reasonAr: reasonAr || undefined,
    reasonEn: reasonEn || undefined,
    fromPackageId: installed?.fromPackageId,
  });
}

/** استعادة تطوير ملغى بقرار صريح: يخرج من سجل الملغيات ويصبح قابلاً للتثبيت عند وصوله. */
export function restoreDevelopment(id: string): boolean {
  return restoreItem(id);
}

/** سجل التحديثات المستقبلة (الأحدث أولاً). */
export function listAppliedUpdates(): LedgerEntry[] {
  return listLedger();
}

/** كل التطويرات المثبتة حالياً — «الموجود» الذي تُقارن به الحزم الواردة. */
export function listInstalledDevelopments(): InstalledItem[] {
  return listInstalledItems();
}

export function getInstalledDevelopment(id: string): InstalledItem | null {
  return getInstalledItem(id);
}

/** سجل الملغيات: ما رفضناه ولا يعود. */
export function listCanceledDevelopments(): CanceledItem[] {
  return listCanceledItems();
}

/** هل استُقبلت حزمة بهذا المعرف من قبل؟ (للواجهات الإدارية) */
export function findReceivedPackage(packageId: string): LedgerEntry | null {
  return findLedgerEntry(packageId);
}
