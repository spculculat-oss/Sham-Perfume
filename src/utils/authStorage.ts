import { UserProfile, CraftLevel } from '../types/auth';

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
      return { success: false, error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' };
    }

    const rawUsers = localStorage.getItem(REGISTERED_USERS_KEY);
    const users: Array<UserProfile & { password?: string }> = rawUsers ? JSON.parse(rawUsers) : [];

    const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      if (existing.password && existing.password !== password) {
        return { success: false, error: 'كلمة المرور غير صحيحة' };
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
    return { success: false, error: e.message || 'حدث خطأ أثناء تسجيل الدخول' };
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
    const rawUsers = localStorage.getItem(REGISTERED_USERS_KEY);
    const users: Array<UserProfile & { password?: string }> = rawUsers ? JSON.parse(rawUsers) : [];

    const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      return { success: false, error: 'البريد الإلكتروني مسجل بالفعل، يرجى تسجيل الدخول' };
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
    return { success: false, error: e.message || 'حدث خطأ أثناء إنشاء الحساب' };
  }
}

export function logoutUser(): void {
  try {
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
