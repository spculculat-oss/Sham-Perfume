import { UserProfile, CraftLevel } from '../types/auth';
import { CommunityApiError, cx, getSessionToken, setSessionToken, type AuthResult, type Me } from '../community/api';

/**
 * Accounts live on the server («مجتمع شام»: hashed passwords, encrypted private data, one account on every
 * device). Only when the server has no community database yet does the site fall back to the old
 * device-only accounts, so signing in never breaks.
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
  INVALID_LOGIN: 'err_wrong_password', EMAIL_EXISTS: 'err_email_exists', WEAK_PASSWORD: 'err_password', INVALID_EMAIL: 'err_missing_fields',
  ACCOUNT_SUSPENDED: 'err_login_failed', RATE_LIMITED: 'err_login_failed',
};

export const USER_AUTH_STORAGE_KEY = 'sham_perfume_current_user_session';
export const REGISTERED_USERS_KEY = 'sham_perfume_registered_users_db';

export interface AuthResponse {
  success: boolean;
  user?: UserProfile;
  error?: string;
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
      const result = await cx<AuthResult>('/community/auth/login', { body: { email, password } });
      setSessionToken(result.token);
      const user = profileFromMember(result.me);
      localStorage.setItem(USER_AUTH_STORAGE_KEY, JSON.stringify(user));
      return { success: true, user };
    } catch (error) {
      if (!serverUnavailable(error)) return { success: false, error: SERVER_ERRORS[(error as CommunityApiError).code] || 'err_login_failed' };
    }

    const rawUsers = localStorage.getItem(REGISTERED_USERS_KEY);
    const users: Array<UserProfile & { password?: string }> = rawUsers ? JSON.parse(rawUsers) : [];

    const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      if (existing.password && existing.password !== password) {
        return { success: false, error: 'err_wrong_password' };
      }
      const { password: _, ...cleanUser } = existing;
      localStorage.setItem(USER_AUTH_STORAGE_KEY, JSON.stringify(cleanUser));
      return { success: true, user: cleanUser };
    }

    // Auto-create for convenience if valid email
    const newUser: UserProfile = {
      id: 'usr-' + Date.now(),
      name: email.split('@')[0],
      email,
      craftLevel: 'perfumer',
      createdAt: new Date().toISOString(),
    };
    users.push({ ...newUser, password });
    localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(users));
    localStorage.setItem(USER_AUTH_STORAGE_KEY, JSON.stringify(newUser));
    return { success: true, user: newUser };
  } catch (e: any) {
    return { success: false, error: 'err_login_failed' };
  }
}

export async function registerUser(
  name: string,
  email: string,
  password: string,
  craftLevel: CraftLevel = 'perfumer',
  regionId?: string
): Promise<AuthResponse> {
  try {
    try {
      const result = await cx<AuthResult>('/community/auth/register', { body: { name, email, password, craftLevel, lang: document.documentElement.lang || 'ar' } });
      setSessionToken(result.token);
      const user = { ...profileFromMember(result.me), regionId };
      localStorage.setItem(USER_AUTH_STORAGE_KEY, JSON.stringify(user));
      return { success: true, user };
    } catch (error) {
      if (!serverUnavailable(error)) return { success: false, error: SERVER_ERRORS[(error as CommunityApiError).code] || 'err_register_failed' };
    }
    const rawUsers = localStorage.getItem(REGISTERED_USERS_KEY);
    const users: Array<UserProfile & { password?: string }> = rawUsers ? JSON.parse(rawUsers) : [];

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

    users.push({ ...newUser, password });
    localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(users));
    localStorage.setItem(USER_AUTH_STORAGE_KEY, JSON.stringify(newUser));
    return { success: true, user: newUser };
  } catch (e: any) {
    return { success: false, error: 'err_register_failed' };
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
  } catch (e) {}
}

export function exportAllUserData(user: UserProfile): void {
  try {
    const rawFormulas = localStorage.getItem('miyaar_perfume_saved_formulas');
    const rawAddress = localStorage.getItem('sham_perfume_user_detailed_address');
    const exportData = {
      user,
      exportedAt: new Date().toISOString(),
      formulas: rawFormulas ? JSON.parse(rawFormulas) : [],
      detailedAddress: rawAddress ? JSON.parse(rawAddress) : null,
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
