/**
 * حارس بيانات المستخدمين — أهم قواعد بوابة التحديثات:
 * أي تطوير وارد من أي منصة لا يجوز أن يمس مفاتيح بيانات المستخدمين في
 * التخزين المحلي (الحسابات، التركيبات المحفوظة، المحادثات، العناوين...).
 * قبل تطبيق أي حزمة نأخذ صورة (snapshot) للمفاتيح المحمية، وبعده نتحقق
 * ونرد أي مفتاح تغيّر. وأي عنصر تحمل حمولته إشارة لمفاتيح المستخدمين
 * يُرفض من أساسه.
 */

import { safeStorage } from './storage';
import type { DevelopmentItem } from './types';

/**
 * مفاتيح بيانات المستخدمين الفعلية في التطبيق (مستخرجة من الشيفرة).
 * أي مفتاح هنا + أي مفتاح بالبادئات أدناه يُعد محمياً.
 */
export const USER_DATA_KEYS: readonly string[] = [
  'sham_perfume_current_user_session',
  'sham_perfume_registered_users_db',
  'sham_perfume_user_detailed_address',
  'sham_perfume_user_environment_profile',
  'sham_perfume_user_experience_v1',
  'sham_perfume_user_orders_v1',
  'sham_perfume_user_analytics_v1',
  'sham_perfume_user_country_code',
  'sham_perfume_user_override_lang',
  'sham_perfume_geo_autodetected_once',
  'miyaar_perfume_saved_formulas',
  'miyaar_perfume_default_oil_price',
  'miyaar_perfume_default_alc_price',
  'miyaar_perfume_default_fix_price',
  'miyaar_perfume_default_water_price',
  'miyaar_perfumer_chat_session',
  'shaheen_engine_choice',
  'sham_core_conversation',
  'sham_core_visitor_id',
  'sham_core_consult',
];

/**
 * بادئات التخزين المخصصة لبيانات المستخدمين وجلساتهم. أي مفتاح يبدأ
 * بها يُعد محمياً — ما عدا مفاتيح بوابة التحديثات نفسها (sham_updates_*)
 * لأنها سجل التطبيقات لا بيانات مستخدمين.
 */
export const PROTECTED_PREFIXES: readonly string[] = ['sham_', 'miyaar_', 'shaheen_'];

const GATEWAY_PREFIX = 'sham_updates_';

export function isProtectedStorageKey(key: string): boolean {
  if (key.startsWith(GATEWAY_PREFIX)) return false;
  if (USER_DATA_KEYS.includes(key)) return true;
  return PROTECTED_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/** حقول ممنوعة داخل حمولة أي عنصر تطوير: من شأنها لمس تخزين المستخدمين. */
const FORBIDDEN_PAYLOAD_FIELDS: readonly string[] = [
  'localstorage',
  'localstoragekey',
  'localstoragekeys',
  'sessionstorage',
  'sessionstoragekey',
  'storagekey',
  'storagekeys',
  'userstorage',
  'userstoragekeys',
  'wipestorage',
  'clearstorage',
  'clearusercache',
  'clearuserdata',
  'userdatabase',
  'userdatabases',
];

/** نمط يشبه مفاتيح التخزين المحمية ( sham_… / miyaar_… / shaheen_… ) داخل الحمولة. */
const PROTECTED_KEY_PATTERN = /^(sham|miyaar|shaheen)_[a-z0-9_]+$/i;

export interface UserDataViolation {
  field: string;
  value: string;
}

/** يفحص حمولة العنصر عميقاً بحثاً عن أي محاولة لمس بيانات المستخدمين. */
export function findUserDataViolations(item: DevelopmentItem): UserDataViolation[] {
  const violations: UserDataViolation[] = [];
  const walk = (value: unknown, path: string): void => {
    if (Array.isArray(value)) {
      value.forEach((entry, i) => walk(entry, `${path}[${i}]`));
      return;
    }
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        const normalized = key.toLowerCase().replace(/[-\s]/g, '');
        if (FORBIDDEN_PAYLOAD_FIELDS.includes(normalized)) {
          violations.push({ field: `${path}.${key}`, value: String(child) });
        }
        walk(child, `${path}.${key}`);
      }
      return;
    }
    if (typeof value === 'string' && PROTECTED_KEY_PATTERN.test(value) && isProtectedStorageKey(value)) {
      violations.push({ field: path, value });
    }
  };
  walk(item.payload, 'payload');
  return violations;
}

export interface UserDataSnapshot {
  takenAt: string;
  entries: Array<{ key: string; value: string }>;
}

/**
 * كل المفاتيح المحمية الموجودة الآن: تعداد التخزين إن أمكن، مضافاً إليه
 * قائمة المفاتيح المعروفة (بعض بيئات الاختبار لا تدعم التعداد).
 */
function presentProtectedKeys(): Set<string> {
  const store = safeStorage();
  const found = new Set<string>();
  for (const key of store.keys()) {
    if (isProtectedStorageKey(key)) found.add(key);
  }
  for (const key of USER_DATA_KEYS) {
    if (!found.has(key) && store.getItem(key) !== null) found.add(key);
  }
  return found;
}

/** صورة لكل مفاتيح بيانات المستخدمين الموجودة قبل تطبيق الحزمة. */
export function snapshotUserData(): UserDataSnapshot {
  const store = safeStorage();
  const entries: Array<{ key: string; value: string }> = [];
  for (const key of [...presentProtectedKeys()].sort()) {
    const value = store.getItem(key);
    if (value !== null) entries.push({ key, value });
  }
  return { takenAt: new Date().toISOString(), entries };
}

export interface UserDataVerification {
  preserved: boolean;
  restored: string[];
}

/**
 * بعد التطبيق: هل بقيت كل المفاتيح المحمية كما كانت؟ أي مفتاح تغيّر أو
 * حُذف يُرد فوراً من الصورة، ويُرفع علم أن التطبيق لمس ما لا يجوز لمسه.
 */
export function verifyAndRestoreUserData(snapshot: UserDataSnapshot): UserDataVerification {
  const store = safeStorage();
  const restored: string[] = [];
  for (const { key, value } of snapshot.entries) {
    if (store.getItem(key) !== value) {
      store.setItem(key, value);
      restored.push(key);
    }
  }
  // أي مفتاح محمي جديد ظهر أثناء التطبيق (لم يكن في الصورة) يُحذف.
  for (const key of presentProtectedKeys()) {
    if (!snapshot.entries.some((entry) => entry.key === key)) {
      store.removeItem(key);
      restored.push(key);
    }
  }
  return { preserved: restored.length === 0, restored };
}
