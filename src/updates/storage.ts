/**
 * طبقة تخزين آمنة لبوابة التحديثات — تعمل في المتصفح (localStorage) وفي
 * بيئة Node للاختبارات (ذاكرة مؤقتة). أي فشل قراءة/كتابة لا يُسقط التطبيق:
 * القيم غير الصالحة تُرفض وتُتجاهل، ولا تُفبرك بيانات بدلاً منها.
 */

const memory = new Map<string, string>();

function hasBrowserLocalStorage(): boolean {
  try {
    return typeof globalThis.localStorage === 'object' && globalThis.localStorage !== null;
  } catch {
    return false;
  }
}

export interface SafeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): boolean;
  removeItem(key: string): void;
  keys(): string[];
}

export function safeStorage(): SafeStorage {
  if (hasBrowserLocalStorage()) {
    const store = globalThis.localStorage;
    return {
      getItem: (key) => {
        try { return store.getItem(key); } catch { return memory.get(key) ?? null; }
      },
      setItem: (key, value) => {
        try { store.setItem(key, value); return true; } catch { return false; }
      },
      removeItem: (key) => {
        try { store.removeItem(key); } catch { memory.delete(key); }
      },
      keys: () => {
        try {
          const found: string[] = [];
          for (let i = 0; i < store.length; i++) {
            const key = store.key(i);
            if (key !== null) found.push(key);
          }
          return found;
        } catch { return [...memory.keys()]; }
      },
    };
  }
  return {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => { memory.set(key, value); return true; },
    removeItem: (key) => { memory.delete(key); },
    keys: () => [...memory.keys()],
  };
}

/** قراءة JSON محفوظ؛ القيمة الفاسدة تُزال ويُعاد الاحتياطي كما هو. */
export function readJson<T>(key: string, fallback: T): T {
  const store = safeStorage();
  const raw = store.getItem(key);
  if (raw === null) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed as T;
  } catch {
    store.removeItem(key);
    return fallback;
  }
}

/** كتابة JSON؛ تعيد false إذا فشلت (وضع خاص مثلاً). */
export function writeJson(key: string, value: unknown): boolean {
  try {
    return safeStorage().setItem(key, JSON.stringify(value));
  } catch {
    return false;
  }
}

/** مفاتيح بوابة التحديثات نفسها — ليست بيانات مستخدمين ولا تُحمى من الكتابة. */
export const UPDATES_INSTALLED_KEY = 'sham_updates_installed_v1';
export const UPDATES_LEDGER_KEY = 'sham_updates_ledger_v1';
export const UPDATES_CANCELED_KEY = 'sham_updates_canceled_v1';
