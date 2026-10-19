/** Small building blocks shared by every portal of «مجتمع شام» (stone + amber, like the rest of the site). */
import { useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { CommunityApiError, type PublicUser } from './api';

export type Lang = 'ar' | 'en';
/** Portal text: Arabic for Arabic visitors, English for everyone else (more languages will follow). */
export const tx = (lang: Lang) => (ar: string, en: string) => (lang === 'ar' ? ar : en);

const PALETTE = ['from-amber-400 to-amber-700', 'from-rose-400 to-rose-700', 'from-emerald-400 to-emerald-700', 'from-sky-400 to-sky-700', 'from-violet-400 to-violet-700', 'from-stone-500 to-stone-800'];
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export function Avatar({ user, size = 40, ring = false }: { user: Pick<PublicUser, 'id' | 'name' | 'avatar'> & { online?: boolean }; size?: number; ring?: boolean }) {
  const initials = user.name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '؟';
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {user.avatar
        ? <img src={user.avatar} alt="" className={`h-full w-full rounded-full object-cover ${ring ? 'ring-2 ring-amber-400' : ''}`} />
        : <span className={`flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br ${PALETTE[hash(user.id) % PALETTE.length]} font-bold text-white ${ring ? 'ring-2 ring-amber-400' : ''}`} style={{ fontSize: size * 0.38 }}>{initials}</span>}
      {user.online && <span className="absolute bottom-0 end-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />}
    </span>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'soft' | 'danger' | 'dark'; busy?: boolean; small?: boolean };
export function Btn({ variant = 'primary', busy, small, className = '', children, disabled, ...rest }: BtnProps) {
  const look = {
    primary: 'bg-amber-700 text-white hover:bg-amber-800 shadow-sm shadow-amber-900/20',
    dark: 'bg-stone-900 text-white hover:bg-stone-800',
    soft: 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200',
    ghost: 'bg-transparent text-stone-700 hover:bg-stone-100',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
  }[variant];
  return (
    <button type="button" {...rest} disabled={disabled || busy}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer ${small ? 'px-2.5 py-1.5 text-xs' : 'px-4 py-2.5 text-sm'} ${look} ${className}`}>
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-2xl border border-stone-200 bg-white shadow-sm ${className}`}>{children}</div>
);

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-stone-700">{label}</span>
      {children}
      {hint && <span className="block text-[11px] leading-relaxed text-stone-500">{hint}</span>}
    </label>
  );
}
export const inputClass = 'w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200';

export const Spinner = ({ label }: { label?: string }) => (
  <div className="flex items-center justify-center gap-2 py-10 text-sm text-stone-500"><Loader2 className="h-5 w-5 animate-spin text-amber-600" />{label}</div>
);

export const Empty = ({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) => (
  <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
    {icon && <div className="text-amber-500">{icon}</div>}
    <p className="font-bold text-stone-800">{title}</p>
    {body && <p className="max-w-sm text-sm leading-relaxed text-stone-500">{body}</p>}
    {action}
  </div>
);

export const Badge = ({ n }: { n?: number }) => (n ? <span className="min-w-[18px] rounded-full bg-rose-600 px-1.5 text-center text-[10px] font-bold leading-[18px] text-white">{n > 99 ? '99+' : n}</span> : null);

export function timeAgo(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  const t = tx(lang);
  if (s < 60) return t('الآن', 'now');
  if (s < 3600) return t(`منذ ${Math.floor(s / 60)} د`, `${Math.floor(s / 60)}m`);
  if (s < 86400) return t(`منذ ${Math.floor(s / 3600)} س`, `${Math.floor(s / 3600)}h`);
  if (s < 7 * 86400) return t(`منذ ${Math.floor(s / 86400)} يوم`, `${Math.floor(s / 86400)}d`);
  return new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
export const clock = (iso: string, lang: Lang) => new Date(iso).toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
export const money = (amount: number, currency: string, lang: Lang) => {
  try { return new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount); } catch { return `${amount} ${currency}`; }
};

const ERRORS: Record<string, [string, string]> = {
  INVALID_LOGIN: ['البريد أو كلمة المرور غير صحيحة', 'Wrong email or password'],
  EMAIL_EXISTS: ['البريد ده مسجّل بالفعل — جرّب تسجيل الدخول', 'This email is already registered — try signing in'],
  HANDLE_TAKEN: ['اسم المستخدم محجوز، اختار اسم تاني', 'That username is taken'],
  WEAK_PASSWORD: ['كلمة المرور لازم تكون 8 أحرف على الأقل وفيها حروف وأرقام', 'Use at least 8 characters with letters and numbers'],
  INVALID_EMAIL: ['البريد الإلكتروني غير صحيح', 'Invalid email address'],
  ACCOUNT_SUSPENDED: ['الحساب موقوف من الإدارة. تواصل مع الدعم', 'This account is suspended by the administration'],
  RATE_LIMITED: ['محاولات كتير — استنى دقيقة وجرّب تاني', 'Too many attempts — wait a minute'],
  UNAUTHORIZED: ['انتهت الجلسة — سجّل دخولك تاني', 'Your session ended — please sign in again'],
  FORBIDDEN: ['مش مسموح بالإجراء ده', 'Not allowed'],
  NOT_FOUND: ['غير موجود أو اتحذف', 'Not found'],
  BLOCKED: ['لا يمكن التواصل مع هذا الحساب', 'You cannot contact this account'],
  NOT_FRIENDS: ['لازم تكونوا أصدقاء الأول', 'You need to be friends first'],
  MERCHANT_EXISTS: ['عندك متجر بالفعل', 'You already have a store'],
  NOT_MERCHANT: ['الحساب ده مش حساب تاجر', 'This is not a merchant account'],
  MERCHANT_NOT_APPROVED: ['متجرك لسه تحت المراجعة', 'Your store is still under review'],
  TOO_LARGE: ['الملف كبير — اختار صورة أصغر', 'The file is too large'],
  COMMUNITY_NOT_CONFIGURED: ['مجتمع شام لسه بيتجهّز على السيرفر', 'The community is not set up on the server yet'],
  NETWORK: ['مفيش اتصال بالسيرفر — اتأكد من الإنترنت', 'No connection to the server'],
  TIMEOUT: ['السيرفر اتأخر في الرد — جرّب تاني', 'The server took too long — try again'],
  WRONG_PASSWORD: ['كلمة المرور الحالية غير صحيحة', 'Current password is wrong'],
  UNAUTHENTICATED: ['سجّل دخولك الأول', 'Please sign in first'],
  ALREADY_MERCHANT: ['عندك متجر بالفعل', 'You already have a store'],
  MERCHANT_SUSPENDED: ['متجرك موقوف من الإدارة — تواصل مع الدعم', 'Your store is suspended by the administration'],
  PRODUCT_LIMIT: ['وصلت للحد الأقصى من المنتجات', 'You reached the product limit'],
  INVALID_HANDLE: ['اسم المستخدم لازم يكون حروف إنجليزي وأرقام فقط (3 أحرف على الأقل)', 'Usernames use 3+ Latin letters, digits or _'],
  INVALID_IMAGE: ['الصورة دي مش مدعومة — جرّب JPG أو PNG', 'Unsupported image — try JPG or PNG'],
  INVALID_AUDIO: ['الرسالة الصوتية مش مدعومة أو أطول من دقيقتين', 'Unsupported voice note or longer than 2 minutes'],
  EMPTY_MESSAGE: ['الرسالة فاضية', 'The message is empty'],
  NO_RECIPIENTS: ['ضيف عنوان مستلم واحد على الأقل (اسم المستخدم أو بريده)', 'Add at least one recipient (username or e-mail)'],
  MAILBOX_FULL: ['عندك مسودات كتير قوي — احذف منها الأول', 'You have too many drafts — delete some first'],
  EMPTY_POST: ['اكتب حاجة أو ضيف صورة الأول', 'Write something or add a photo first'],
  EMPTY_COMMENT: ['التعليق فاضي', 'The comment is empty'],
  EDIT_WINDOW_PASSED: ['عدّى وقت التعديل المسموح للرسالة دي', 'The edit window for this message has passed'],
  NOT_EDITABLE: ['مينفعش تعدّل دي', 'This cannot be edited'],
  NO_MEMBERS: ['اختار صديق واحد على الأقل للمجموعة', 'Pick at least one friend for the group'],
  RECIPE_TOO_LARGE: ['التركيبة كبيرة جدًا للحفظ', 'This recipe is too large to save'],
  RECIPE_LIMIT: ['وصلت للحد الأقصى من التركيبات المحفوظة — احذف القديم', 'You reached the saved-recipe limit'],
  REASON_REQUIRED: ['اكتب السبب الأول', 'Please give a reason'],
  INVALID_STATE: ['الإجراء ده مش متاح في الحالة الحالية', 'Not available in the current state'],
};
const FIELDS: Record<string, [string, string]> = {
  name: ['الاسم', 'name'], handle: ['اسم المستخدم', 'username'], phone: ['رقم الموبايل', 'phone'], storeName: ['اسم المتجر', 'store name'],
  price: ['السعر', 'price'], currency: ['العملة', 'currency'], stock: ['الكمية', 'stock'], title: ['العنوان', 'title'], body: ['النص', 'text'], image: ['الصورة', 'image'],
};
export function errorText(error: unknown, lang: Lang): string {
  const t = tx(lang);
  if (error instanceof CommunityApiError) {
    if (error.code === 'INVALID_FIELD') {
      const f = error.field && FIELDS[error.field];
      return t(`راجع خانة ${f ? f[0] : 'البيانات'}`, `Please check the ${f ? f[1] : 'form'}`);
    }
    if (error.status === 413) return t(ERRORS.TOO_LARGE[0], ERRORS.TOO_LARGE[1]);
    const known = ERRORS[error.code];
    if (known) return t(known[0], known[1]);
  }
  return t('حصلت مشكلة — جرّب تاني', 'Something went wrong — try again');
}

/** Loads data once (and again on `reload()`), with loading / error state. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const reload = useCallback(async (quiet = false) => {
    const id = ++seq.current;
    if (!quiet) setLoading(true);
    try { const value = await load(); if (id === seq.current) { setData(value); setError(undefined); } } catch (e) { if (id === seq.current) setError(e); } finally { if (id === seq.current) setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { void reload(); }, [reload]);
  return { data, setData, error, loading, reload };
}

export function Toast({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t); }, [text, onDone]);
  return <div className="fixed bottom-24 left-1/2 z-[80] -translate-x-1/2 rounded-full bg-stone-900 px-4 py-2 text-sm text-white shadow-xl">{text}</div>;
}

export function Sheet({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-stone-950/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className={`max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl sm:rounded-3xl sm:p-6 ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-stone-900">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-stone-500 hover:bg-stone-100 cursor-pointer" aria-label="close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
