import React, { useState } from 'react';
import {
  User,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  X,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Beaker,
  Award,
} from 'lucide-react';
import { UserProfile } from '../types/auth';
import { loginUser, registerUser } from '../utils/authStorage';
import { WORLD_COUNTRIES } from '../data/worldCountries';
import { SupportedLanguage } from '../types/i18n';
import { isRTL } from '../utils/localizedContent';

interface AuthModalProps {
  currentLang?: SupportedLanguage;
  onSuccess: (user: UserProfile) => void;
  onOpenPrivacyPolicy: () => void;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  currentLang = 'ar',
  onSuccess,
  onOpenPrivacyPolicy,
  onClose,
}) => {
  const rtl = isRTL(currentLang);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [craftLevel, setCraftLevel] = useState<'hobbyist' | 'perfumer' | 'master_lab'>('perfumer');
  const [regionId, setRegionId] = useState('SA');
  const [privacyAccepted, setPrivacyAccepted] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      if (mode === 'login') {
        const res = await loginUser(email, password);
        if (res.success && res.user) {
          onSuccess(res.user);
          onClose();
        } else {
          setErrorMsg(res.error || 'فشل تسجيل الدخول');
        }
      } else {
        if (!name.trim()) {
          setErrorMsg('يرجى إدخال اسمك أو اسم المعمل');
          setIsLoading(false);
          return;
        }
        if (password.length < 6) {
          setErrorMsg('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
          setIsLoading(false);
          return;
        }
        if (!privacyAccepted) {
          setErrorMsg('يرجى الموافقة على شروط حماية البيانات وخصوصية المستخدم');
          setIsLoading(false);
          return;
        }

        const res = await registerUser(name, email, password, craftLevel, regionId);
        if (res.success && res.user) {
          onSuccess(res.user);
          onClose();
        } else {
          setErrorMsg(res.error || 'فشل إنشاء الحساب');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setIsLoading(true);
    try {
      const res = await loginUser('perfumer@sham.com', 'sham123456');
      if (res.success && res.user) {
        onSuccess(res.user);
        onClose();
      }
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 text-stone-900"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Top Header */}
        <div className="bg-gradient-to-r from-stone-900 via-stone-850 to-amber-950 text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-base border border-amber-500/30">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold font-serif-luxury">
                {mode === 'login'
                  ? (rtl ? 'تسجيل الدخول إلى معملك' : 'Sign in to Your Atelier')
                  : (rtl ? 'إنشاء حساب مصمم عطور جديد' : 'Create Master Perfumer Account')}
              </h3>
              <p className="text-[11px] text-stone-300">
                {rtl ? 'منصة صمم عطرك مع شام · حفظ وحماية الخلطات والبيانات' : 'Sham Haute Parfumerie · Formula Vault & Privacy Protection'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switchers */}
        <div className="flex border-b border-stone-200 bg-stone-50 text-xs font-semibold">
          <button
            onClick={() => {
              setMode('login');
              setErrorMsg(null);
            }}
            className={`flex-1 py-3 text-center transition-colors cursor-pointer ${
              mode === 'login'
                ? 'bg-white text-stone-950 border-b-2 border-amber-800'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            {rtl ? 'تسجيل الدخول' : 'Sign In'}
          </button>
          <button
            onClick={() => {
              setMode('register');
              setErrorMsg(null);
            }}
            className={`flex-1 py-3 text-center transition-colors cursor-pointer ${
              mode === 'register'
                ? 'bg-white text-stone-950 border-b-2 border-amber-800'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            {rtl ? 'إنشاء حساب جديد' : 'Create Account'}
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="font-semibold text-stone-800 block mb-1">
                الاسم الكامل أو اسم الدار العطرية:
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  required
                  placeholder="مثال: م. أحمد الشامي"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-3 pr-9 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
                />
              </div>
            </div>
          )}

          <div>
            <label className="font-semibold text-stone-800 block mb-1">
              البريد الإلكتروني:
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="email"
                required
                placeholder="perfumer@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-3 pr-9 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700 text-left font-mono"
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-stone-800 block mb-1">
              كلمة المرور المشفرة:
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700 text-left font-mono"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {mode === 'register' && (
            <>
              <div>
                <label className="font-semibold text-stone-800 block mb-1">
                  المستوى الحرفي في تصنيع العطور:
                </label>
                <select
                  value={craftLevel}
                  onChange={(e) => setCraftLevel(e.target.value as any)}
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
                >
                  <option value="hobbyist">هاوٍ ومحب لصناعة وتجربة العطور</option>
                  <option value="perfumer">مصمم عطور محترف ومصنع مستقل</option>
                  <option value="master_lab">صاحب معمل ومصنع عطور تجاري</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-stone-800 block mb-1">
                  الدولة / البلد المعتمد للمعمل:
                </label>
                <select
                  value={regionId}
                  onChange={(e) => setRegionId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
                >
                  {WORLD_COUNTRIES.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.flag} {country.nameAr} ({country.currencyCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-1 flex items-start gap-2">
                <input
                  type="checkbox"
                  id="privacy-check"
                  checked={privacyAccepted}
                  onChange={(e) => setPrivacyAccepted(e.target.checked)}
                  className="mt-0.5 rounded text-amber-700 focus:ring-amber-700 cursor-pointer"
                />
                <label htmlFor="privacy-check" className="text-[11px] text-stone-600 leading-snug">
                  أوافق على سياسة حماية بيانات المستخدم المشفرة، وعدم مشاركة خلطاتي وسجلاتي مع أي طرف ثالث.
                  <button
                    type="button"
                    onClick={onOpenPrivacyPolicy}
                    className="text-amber-800 font-semibold underline mr-1 cursor-pointer"
                  >
                    (عرض وثيقة الخصوصية)
                  </button>
                </label>
              </div>
            </>
          )}

          <div className="pt-2 space-y-2">
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-amber-300" />
              <span>{mode === 'login' ? 'دخول آمن للمعمل' : 'تأكيد إنشاء الحساب'}</span>
            </button>

            {mode === 'login' && (
              <button
                type="button"
                onClick={handleDemoLogin}
                className="w-full py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                <span>دخول تجريبي سريع بحساب الخبير معتز (Demo)</span>
              </button>
            )}
          </div>
        </form>

        {/* Security badge footer */}
        <div className="p-3 bg-stone-50 border-t border-stone-200 text-[10px] text-stone-500 flex items-center justify-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>بياناتك وخلطاتك محمية ومحفوظة محلياً بتشفير كامل وفق معايير GDPR</span>
        </div>

      </div>
    </div>
  );
};
