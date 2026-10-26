import { UserProfile, CraftLevel } from '../types/auth';
import { CommunityApiError, cx, getSessionToken, setSessionToken, type AuthResult, type Me, type PendingLogin } from '../community/api';

/**
 * Accounts live on the server («مجتمع شام»: hashed passwords, encrypted private data, one account on every
 * device). Only when the server has no community database yet does the site fall back to the old
 * device-only accounts, so signing in never breaks.
 *
 * ⚖️ L-01 Fix (GDPR Art.32 / مصر 151/2020 / SA PDPL): لا يُخزن أي كلمة مرور Plain أبدًا في localStorage.
 * كلمات المرور في الخادم مشفرة بـ scrypt/Argon2. في وضع Fallback المحلي (عند غياب الخادم)،
 * نخزن فقط hash مشتق بـ SHA-256 مع salt، ولا نخزن Plain أبدًا.
 */
const serverUnavailable = (error: unknown) => error instanceof CommunityApiError
  && (error.code === 'COMMUNITY_NOT_CONFIGURED' || error.code === 'NETWORK' || error.code === 'TIMEOUT' || error.status === 404);

/** Stores the signed-in profile for the rest of the site (header, calculator) and returns it. */
export function saveCurrentUserProfile(user: UserProfile): UserProfile {
  try { localStorage.setItem(USER_AUTH_STORAGE_KEY, JSON.stringify(user)); } catch { /* private mode */ }
  return user;
}

export function profileFromMember(me: Me): UserProfile {
  return {
    id: me.id, name: me.name, email: me.email, craftLevel: (me.craftLevel as CraftLevel) || 'hobbyist', createdAt: me.createdAt,
    countryCode: me.country || undefined, avatar: me.avatar || undefined, language: me.lang as UserProfile['language'],
  };
}

const SERVER_ERRORS: Record<string, string> = {
  INVALID_LOGIN: 'err_wrong_password', EMAIL_EXISTS: 'err_email_exists', WEAK_PASSWORD: 'err_password',
  COMMON_PASSWORD: 'err_password', INVALID_EMAIL: 'err_missing_fields',
  ACCOUNT_SUSPENDED: 'err_login_failed', RATE_LIMITED: 'err_login_failed',
  ACCOUNT_LOCKED: 'err_account_locked', EMAIL_UNAVAILABLE: 'err_email_unavailable',
  CODE_LIMITED: 'err_code_limited', CODE_INVALID: 'err_code_invalid',
};

export const USER_AUTH_STORAGE_KEY = 'sham_perfume_current_user_session';
export const REGISTERED_USERS_KEY = 'sham_perfume_registered_users_db';

// ─── L-01: تجزئة آمنة لكلمة المرور في وضع Fallback المحلي ──────────────────
// نستخدم SHA-256 عبر Web Crypto API (متاح في كل المتصفحات الحديثة). لا يُخزن Plain.
// هذا ليس بديلاً عن scrypt/Argon2 في الخادم، لكنه يمنع كشف Plain عند XSS/سرقة localStorage.
export async function hashClientPassword(password: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
      const enc = new TextEncoder().encode(`sham-salt-v1:${password}`);
      const buf = await crypto.subtle.digest('SHA-256', enc);
      const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
      return `sha256$${hex}`;
    }
  } catch { /* fallback below */ }
  // Fallback ضعيف (للبيئات القديمة) — أفضل من Plain، لكن الخادم هو الآمن الحقيقي
  let h = 0x811c9dc5;
  for (let i = 0; i < password.length; i++) {
    h ^= password.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `fallback$${(h >>> 0).toString(16)}`;
}

export async function verifyClientPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashClientPassword(password);
  // مقارنة زمن ثابت تقريبي
  if (computed.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}

// هجرة: إذا وجدت حسابات قديمة بكلمة مرور Plain، حوّلها إلى hash أو احذفها
function migrateLegacyUsers(users: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  let migrated = false;
  for (const u of users) {
    if (typeof u.password === 'string' && u.password.length > 0) {
      // لا يمكننا تجزئة Plain بدون كلمة المرور الأصلية هنا (نحتاج await)،
      // لذا نُعلم أن هذه الحسابات تحتاج إعادة تعيين. نحذف Plain فورًا.
      // الحسابات التي كانت Plain ستُطلب منها إعادة التسجيل/تسجيل دخول جديد ينشئ hash.
      console.warn('[Legal L-01] Migrating legacy plain password — removing plain field for', (u as { email?: string }).email);
      delete u.password;
      migrated = true;
    }
  }
  if (migrated) {
    try { localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(users)); } catch { /* ignore */ }
  }
  return users;
}

export interface AuthResponse {
  success: boolean;
  user?: UserProfile;
  error?: string;
  /** Two-factor login: the password passed; the authenticator or phone code finishes it. */
  pendingToken?: string;
  method?: 'totp' | 'phone';
  /** TOTP secret returned once at registration when enable2fa was chosen. */
  totpSecret?: string;
}

export function getCurrentUserSession(): { user: UserProfile | null } {
  try {
    const raw = localStorage.getItem(USER_AUTH_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.id) {
        return { user: parsed };
      }
    }
  } catch (e) {}
  return { user: null };
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  try {
    if (!email || !password) {
      return { success: false, error: 'err_missing_fields' };
    }
    try {
      const result = await cx<AuthResult | PendingLogin>('/community/auth/login', { body: { email, password } });
      if ('pending' in result) return { success: false, error: 'totp_required', pendingToken: result.pendingToken, method: (result as any).method || 'totp' };
      setSessionToken(result.token);
      const user = profileFromMember(result.me);
      localStorage.setItem(USER_AUTH_STORAGE_KEY, JSON.stringify(user));
      return { success: true, user };
    } catch (error) {
      if (!serverUnavailable(error)) return { success: false, error: SERVER_ERRORS[(error as CommunityApiError).code] || 'err_login_failed' };
    }

    // Fallback محلي آمن: نقارن hash فقط، لا Plain
    const rawUsers = localStorage.getItem(REGISTERED_USERS_KEY);
    let users: Array<UserProfile & { passwordHash?: string; password?: string }> = rawUsers ? JSON.parse(rawUsers) : [];
    users = migrateLegacyUsers(users as unknown as Array<Record<string, unknown>>) as unknown as typeof users;

    const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      // حساب قديم فيه Plain (بعد الهجرة أصبح بدون hash) — اطلب إعادة إنشاء
      if (!existing.passwordHash) {
        // حاول التوافق مع Plain القديم لمرة واحدة ثم هاجر
        if ((existing as unknown as { password?: string }).password) {
          const plain = (existing as unknown as { password?: string }).password!;
          if (plain !== password) return { success: false, error: 'err_wrong_password' };
          // هجرة فورية إلى hash
          const newHash = await hashClientPassword(password);
          existing.passwordHash = newHash;
          delete (existing as unknown as { password?: string }).password;
          localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(users));
        } else {
          return { success: false, error: 'err_login_failed' };
        }
      } else {
        const ok = await verifyClientPassword(password, existing.passwordHash);
        if (!ok) return { success: false, error: 'err_wrong_password' };
      }
      // لا نُعيد كلمة المرور أبدًا في session
      const { passwordHash: _ph, password: _p, ...cleanUser } = existing as UserProfile & { passwordHash?: string; password?: string };
      localStorage.setItem(USER_AUTH_STORAGE_KEY, JSON.stringify(cleanUser));
      return { success: true, user: cleanUser as UserProfile };
    }

    // Auto-create for convenience if valid email — نخزن hash فقط
    const newUser: UserProfile = {
      id: 'usr-' + Date.now(),
      name: email.split('@')[0],
      email,
      craftLevel: 'perfumer',
      createdAt: new Date().toISOString(),
    };
    const passwordHash = await hashClientPassword(password);
    users.push({ ...newUser, passwordHash } as unknown as UserProfile & { passwordHash: string });
    localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(users));
    localStorage.setItem(USER_AUTH_STORAGE_KEY, JSON.stringify(newUser));
    return { success: true, user: newUser };
  } catch (e: unknown) {
    return { success: false, error: 'err_login_failed' };
  }
}

export async function registerUser(
  name: string,
  email: string,
  password: string,
  craftLevel: CraftLevel = 'perfumer',
  regionId?: string,
  enable2fa?: boolean
): Promise<AuthResponse> {
  try {
    try {
      const result = await cx<AuthResult>('/community/auth/register', { body: { name, email, password, craftLevel, lang: document.documentElement.lang || 'ar', enable2fa } });
      setSessionToken(result.token);
      const user = { ...profileFromMember(result.me), regionId };
      localStorage.setItem(USER_AUTH_STORAGE_KEY, JSON.stringify(user));
      return { success: true, user };
    } catch (error) {
      if (!serverUnavailable(error)) return { success: false, error: SERVER_ERRORS[(error as CommunityApiError).code] || 'err_register_failed' };
    }
    const rawUsers = localStorage.getItem(REGISTERED_USERS_KEY);
    let users: Array<UserProfile & { passwordHash?: string; password?: string }> = rawUsers ? JSON.parse(rawUsers) : [];
    users = migrateLegacyUsers(users as unknown as Array<Record<string, unknown>>) as unknown as typeof users;

    const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      return { success: false, error: 'err_email_exists' };
    }

    const newUser: UserProfile = {
      id: 'usr-' + Date.now(),
      name,
      email,
      craftLevel,
      createdAt: new Date().toISOString(),
      regionId,
    };

    const passwordHash = await hashClientPassword(password);
    users.push({ ...newUser, passwordHash } as unknown as UserProfile & { passwordHash: string });
    localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(users));
    localStorage.setItem(USER_AUTH_STORAGE_KEY, JSON.stringify(newUser));
    return { success: true, user: newUser };
  } catch (e: unknown) {
    return { success: false, error: 'err_register_failed' };
  }
}

/** Two-factor finish: the pending token from the password step plus the authenticator code. */
export async function completeTwoFactorLogin(pendingToken: string, code: string): Promise<AuthResponse> {
  try {
    const result = await cx<AuthResult>('/community/auth/login/2fa', { body: { pendingToken, code } });
    setSessionToken(result.token);
    const user = profileFromMember(result.me);
    localStorage.setItem(USER_AUTH_STORAGE_KEY, JSON.stringify(user));
    return { success: true, user };
  } catch (error) {
    if (error instanceof CommunityApiError) return { success: false, error: SERVER_ERRORS[error.code] || 'err_login_failed' };
    return { success: false, error: 'err_login_failed' };
  }
}

/* ---------------------------- forgot-password (e-mail code) ---------------------------- */

/** Step 1: ask for the code. The server answers the same whether the e-mail exists or not. */
export async function requestPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    await cx('/community/auth/password-reset/request', { body: { email } });
    return { success: true };
  } catch (error) {
    if (error instanceof CommunityApiError) return { success: false, error: SERVER_ERRORS[error.code] || 'err_login_failed' };
    return { success: false, error: 'err_login_failed' };
  }
}

/** Step 2: the code plus the new password. Every device is signed out afterwards. */
export async function confirmPasswordReset(email: string, code: string, next: string): Promise<{ success: boolean; error?: string }> {
  try {
    await cx('/community/auth/password-reset/confirm', { body: { email, code, next } });
    return { success: true };
  } catch (error) {
    if (error instanceof CommunityApiError) return { success: false, error: SERVER_ERRORS[error.code] || 'err_login_failed' };
    return { success: false, error: 'err_login_failed' };
  }
}

export function logoutUser(): void {
  try {
    if (getSessionToken()) void cx('/community/auth/logout', { body: {} }).catch(() => {});
    setSessionToken('');
    localStorage.removeItem(USER_AUTH_STORAGE_KEY);
  } catch (e) {}
}

export function wipeAllUserData(): void {
  try {
    localStorage.removeItem(USER_AUTH_STORAGE_KEY);
    localStorage.removeItem(REGISTERED_USERS_KEY);
    localStorage.removeItem('miyaar_perfume_saved_formulas');
    localStorage.removeItem('sham_perfume_user_detailed_address');
    localStorage.removeItem('sham_perfume_user_environment_profile');
    // L-24 Fix: مسح إضافي لضمان حق النسيان الكامل
    localStorage.removeItem('sham_community_session_v1');
    localStorage.removeItem('miyaar_daily_perfume_news_v2');
    localStorage.removeItem('miyaar_perfume_news_last_refresh_date');
    // تنظيف أي بقايا plain قديمة
    try {
      const raw = localStorage.getItem(REGISTERED_USERS_KEY);
      if (raw && raw.includes('"password"')) {
        localStorage.removeItem(REGISTERED_USERS_KEY);
      }
    } catch {}
  } catch (e) {}
}

export function exportAllUserData(user: UserProfile): void {
  try {
    const rawFormulas = localStorage.getItem('miyaar_perfume_saved_formulas');
    const rawAddress = localStorage.getItem('sham_perfume_user_detailed_address');
    const rawEnv = localStorage.getItem('sham_perfume_user_environment_profile');
    const rawCommunity = (() => {
      try { return localStorage.getItem('sham_community_session_v1') ? '[session active — export via /api/community/export]' : null; } catch { return null; }
    })();
    const exportData = {
      user,
      exportedAt: new Date().toISOString(),
      // L-24: تصدير شامل — نذكر أن المجتمع يُصدّر من الخادم
      noticeAr: 'هذا التصدير يشمل البيانات المحلية. بيانات المجتمع (منشورات/رسائل/أصدقاء) تُصدّر عبر الخادم: /api/community/export',
      noticeEn: 'Local export. Community data (posts/messages/friends) via server: /api/community/export',
      formulas: rawFormulas ? JSON.parse(rawFormulas) : [],
      detailedAddress: rawAddress ? JSON.parse(rawAddress) : null,
      environmentProfile: rawEnv ? JSON.parse(rawEnv) : null,
      hasCommunitySession: !!rawCommunity,
      legalBasis: 'GDPR Art.20 / مصر 151/2020 / SA PDPL — حق نقل البيانات',
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `perfume_lab_backup_${user.name || 'user'}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('Failed to export user data', e);
  }
}
