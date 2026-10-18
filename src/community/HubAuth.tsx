/**
 * The front door of «مجتمع شام»: sign in, or create an account in three short steps
 * (account type → details → privacy), for members and merchants alike.
 */
import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, GraduationCap, Lock, MessageCircle, ShieldCheck, Store, Users } from 'lucide-react';
import { countryOptions, useStoreMoney } from '../utils/storeCheckout';
import { PendingLoginError, completePendingLogin, signIn, signUp } from './session';
import type { PendingLogin } from './api';
import { Btn, Field, errorText, inputClass, tx, type Lang } from './ui';

function strength(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/\d/.test(pw) && /[A-Za-z\u0600-\u06FF]/.test(pw)) score++;
  if (/[^A-Za-z0-9\u0600-\u06FF]/.test(pw) || /[A-Z]/.test(pw)) score++;
  return score;
}

export default function HubAuth({ lang, onDone, initial = 'login' }: { lang: Lang; onDone: (merchant: boolean) => void; initial?: 'login' | 'register' }) {
  const t = tx(lang);
  const Next = lang === 'ar' ? ArrowLeft : ArrowRight;
  const Back = lang === 'ar' ? ArrowRight : ArrowLeft;
  const [mode, setMode] = useState<'login' | 'register'>(initial);
  const [step, setStep] = useState(1);
  const [kind, setKind] = useState<'member' | 'merchant'>('member');
  const money = useStoreMoney(lang, 'EGP');
  const countries = useMemo(() => countryOptions(lang), [lang]);
  const [form, setForm] = useState({ name: '', email: '', password: '', country: '', craftLevel: 'hobbyist', phone: '', city: '' });
  const [show, setShow] = useState(false);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const pw = strength(form.password);
  const pwOk = form.password.length >= 8 && /\d/.test(form.password) && /[A-Za-z\u0600-\u06FF]/.test(form.password);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim());

  const [pending, setPending] = useState<PendingLogin | null>(null);
  const [tfaCode, setTfaCode] = useState('');
  const login = async () => {
    setBusy(true); setError('');
    try {
      const me = await signIn(form.email.trim(), form.password);
      onDone(Boolean(me.merchant));
    } catch (e) {
      if (e instanceof PendingLoginError) setPending(e.pending);
      else setError(errorText(e, lang));
    } finally { setBusy(false); }
  };
  const login2fa = async () => {
    if (!pending) return;
    setBusy(true); setError('');
    try {
      const me = await completePendingLogin(pending.pendingToken, tfaCode);
      onDone(Boolean(me.merchant));
    } catch (e) { setError(errorText(e, lang)); } finally { setBusy(false); }
  };
  const register = async () => {
    setBusy(true); setError('');
    try {
      await signUp({ name: form.name.trim(), email: form.email.trim(), password: form.password, country: form.country || money.country, craftLevel: form.craftLevel, lang, phone: form.phone, city: form.city });
      onDone(kind === 'merchant');
    } catch (e) { setError(errorText(e, lang)); setStep(2); } finally { setBusy(false); }
  };

  const features = [
    { icon: <Users className="h-5 w-5" />, title: t('سوشيال شام', 'Sham Social'), body: t('صفحة عامة وأصدقاء ومنشورات وتعليقات مع صناع العطور', 'A public feed, friends, posts and comments with perfumers') },
    { icon: <MessageCircle className="h-5 w-5" />, title: t('ماسنجر داخلي', 'Built-in messenger'), body: t('محادثات فردية وجماعية وصور ورسائل صوتية وتركيبات', 'Direct and group chats, photos, voice notes, recipes') },
    { icon: <GraduationCap className="h-5 w-5" />, title: t('بوابتك الشخصية', 'Your own portal'), body: t('تركيباتك وتعلّمك وطلباتك محفوظة على كل أجهزتك', 'Your recipes, learning and orders on every device') },
    { icon: <Store className="h-5 w-5" />, title: t('بوابة التجار', 'Merchants’ portal'), body: t('افتح متجرك داخل شام — منتجاتك تتعرض بعد موافقة الإدارة', 'Open your store inside Sham — products go live after review') },
  ];

  return (
    <div className="mx-auto grid grid-cols-[minmax(0,1fr)] max-w-6xl gap-6 px-3 py-6 sm:px-4 lg:grid-cols-[1.05fr_1fr] lg:py-10">
      <section className="relative overflow-hidden rounded-3xl bg-stone-950 p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute -top-24 end-[-6rem] h-72 w-72 rounded-full bg-amber-500/25 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-6rem] start-[-4rem] h-64 w-64 rounded-full bg-rose-500/10 blur-3xl" />
        <p className="relative text-xs font-semibold tracking-widest text-amber-300">{t('مجتمع شام', 'SHAM COMMUNITY')}</p>
        <h1 className="relative mt-2 text-2xl font-black leading-snug sm:text-3xl">{t('بيت صناع العطور العرب — في مكان واحد', 'The home of Arab perfumers — all in one place')}</h1>
        <p className="relative mt-3 max-w-md text-sm leading-relaxed text-stone-300">{t('حساب واحد يفتح لك المجتمع والماسنجر وبوابتك الشخصية ومتجرك لو كنت تاجر.', 'One account opens the community, the messenger, your portal — and your store if you sell.')}</p>
        <div className="relative mt-6 grid gap-3 sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
              <div className="mb-1.5 flex items-center gap-2 text-amber-300">{f.icon}<span className="font-bold text-white">{f.title}</span></div>
              <p className="text-xs leading-relaxed text-stone-300">{f.body}</p>
            </div>
          ))}
        </div>
        <div className="relative mt-6 flex items-start gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-xs leading-relaxed text-emerald-100">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
          {t('كلمة المرور محفوظة بتشفير لا يمكن عكسه، وبياناتك الخاصة (الموبايل والعنوان والرسائل) مشفّرة على السيرفر ولا يراها غيرك وإدارة الموقع عند الضرورة فقط.',
            'Passwords are stored with one-way hashing; your private data (phone, address, messages) is encrypted on the server — only you, and the administration when strictly needed, can see it.')}
        </div>
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-5 grid grid-cols-2 rounded-2xl bg-stone-100 p-1 text-sm font-bold">
          {(['login', 'register'] as const).map((m) => (
            <button key={m} type="button" onClick={() => { setMode(m); setError(''); setStep(1); }}
              className={`rounded-xl py-2.5 transition cursor-pointer ${mode === m ? 'bg-white text-amber-800 shadow-sm' : 'text-stone-500'}`}>
              {m === 'login' ? t('تسجيل الدخول', 'Sign in') : t('حساب جديد', 'Create account')}
            </button>
          ))}
        </div>

        {mode === 'login' && pending ? (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void login2fa(); }}>
            <h2 className="text-xl font-black text-stone-900">{t('التحقق بخطوتين', 'Two-step verification')}</h2>
            <p className="text-sm leading-relaxed text-stone-600">{t('كلمة السر سليمة — اكتب الكود من تطبيق التحقق على موبايلك:', 'Password accepted — enter the code from your authenticator app:')}</p>
            <Field label={t('الكود', 'Code')}>
              <input className={`${inputClass} text-center tracking-[0.4em]`} inputMode="numeric" maxLength={6} autoComplete="one-time-code"
                value={tfaCode} onChange={(e) => setTfaCode(e.target.value.replace(/\D/g, ''))} required dir="ltr" />
            </Field>
            {error && <p className="rounded-xl bg-rose-50 p-2.5 text-sm text-rose-700">{error}</p>}
            <div className="flex gap-2">
              <Btn type="button" variant="soft" className="flex-1" onClick={() => { setPending(null); setTfaCode(''); }}>{t('رجوع', 'Back')}</Btn>
              <Btn type="submit" busy={busy} disabled={tfaCode.length !== 6} className="flex-1">{t('دخول', 'Sign in')}</Btn>
            </div>
          </form>
        ) : mode === 'login' ? (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void login(); }}>
            <h2 className="text-xl font-black text-stone-900">{t('أهلاً بعودتك 👋', 'Welcome back 👋')}</h2>
            <Field label={t('البريد الإلكتروني', 'Email')}><input className={inputClass} type="email" autoComplete="email" value={form.email} onChange={set('email')} required dir="ltr" /></Field>
            <Field label={t('كلمة المرور', 'Password')}>
              <div className="relative">
                <input className={`${inputClass} pe-10`} type={show ? 'text' : 'password'} autoComplete="current-password" value={form.password} onChange={set('password')} required dir="ltr" />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 end-2 my-auto h-7 text-stone-400 cursor-pointer" aria-label="show">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
              </div>
            </Field>
            {error && <p className="rounded-xl bg-rose-50 p-2.5 text-sm text-rose-700">{error}</p>}
            <Btn type="submit" busy={busy} disabled={!emailOk || !form.password} className="w-full">{t('دخول', 'Sign in')}</Btn>
            <p className="text-center text-xs text-stone-500">{t('نسيت كلمة المرور؟ افتح نافذة تسجيل الدخول في الموقع الرئيسي واستخدم «نسيت كلمة المرور؟» — هيوصلك كود على بريدك.', 'Forgot your password? Use the site’s main sign-in window and pick “Forgot your password?” — a code will reach your e-mail.')}</p>
          </form>
        ) : (
          <div className="space-y-4">
            <ol className="flex items-center gap-2 text-[11px] font-semibold">
              {[t('نوع الحساب', 'Account'), t('بياناتك', 'Details'), t('الخصوصية', 'Privacy')].map((label, i) => (
                <li key={label} className={`flex flex-1 items-center gap-1.5 rounded-full px-2.5 py-1.5 ${step > i + 1 ? 'bg-emerald-50 text-emerald-700' : step === i + 1 ? 'bg-amber-100 text-amber-900' : 'bg-stone-100 text-stone-400'}`}>
                  {step > i + 1 ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span>{i + 1}</span>}{label}
                </li>
              ))}
            </ol>

            {step === 1 && (
              <div className="space-y-3">
                <h2 className="text-xl font-black text-stone-900">{t('هتنضم لينا كـ…', 'Join as…')}</h2>
                {([
                  ['member', <Users key="u" className="h-6 w-6" />, t('عضو في المجتمع', 'Community member'), t('صانع عطور أو هاوي: تعلّم واحفظ تركيباتك وتواصل واشترِ من المتجر.', 'Perfumer or hobbyist: learn, save recipes, connect and shop.')],
                  ['merchant', <Store key="m" className="h-6 w-6" />, t('تاجر', 'Merchant'), t('افتح متجرك داخل شام. بعد إنشاء الحساب هتكمّل بيانات المتجر وتراجعها الإدارة.', 'Open your store inside Sham. After sign-up you complete the store file for review.')],
                ] as const).map(([id, icon, title, body]) => (
                  <button key={id} type="button" onClick={() => setKind(id)}
                    className={`flex w-full items-start gap-3 rounded-2xl border-2 p-4 text-start transition cursor-pointer ${kind === id ? 'border-amber-500 bg-amber-50' : 'border-stone-200 hover:border-amber-300'}`}>
                    <span className={`rounded-xl p-2 ${kind === id ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-600'}`}>{icon}</span>
                    <span><span className="block font-bold text-stone-900">{title}</span><span className="block text-xs leading-relaxed text-stone-600">{body}</span></span>
                  </button>
                ))}
                <Btn className="w-full" onClick={() => setStep(2)}>{t('التالي', 'Next')}<Next className="h-4 w-4" /></Btn>
              </div>
            )}

            {step === 2 && (
              <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); setStep(3); }}>
                <Field label={kind === 'merchant' ? t('اسمك (صاحب المتجر)', 'Your name (store owner)') : t('الاسم الظاهر للناس', 'Display name')}>
                  <input className={inputClass} value={form.name} onChange={set('name')} required minLength={2} maxLength={60} autoComplete="name" />
                </Field>
                <Field label={t('البريد الإلكتروني', 'Email')}><input className={inputClass} type="email" value={form.email} onChange={set('email')} required autoComplete="email" dir="ltr" /></Field>
                <Field label={t('كلمة المرور', 'Password')} hint={t('8 أحرف على الأقل وفيها حروف وأرقام', 'At least 8 characters, letters and numbers')}>
                  <div className="relative">
                    <input className={`${inputClass} pe-10`} type={show ? 'text' : 'password'} value={form.password} onChange={set('password')} required autoComplete="new-password" dir="ltr" />
                    <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 end-2 my-auto h-7 text-stone-400 cursor-pointer" aria-label="show">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                  </div>
                  <div className="mt-1.5 grid grid-cols-4 gap-1">{[0, 1, 2, 3].map((i) => <span key={i} className={`h-1.5 rounded-full ${i < pw ? (pw >= 3 ? 'bg-emerald-500' : pw === 2 ? 'bg-amber-500' : 'bg-rose-500') : 'bg-stone-200'}`} />)}</div>
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t('الدولة', 'Country')}>
                    <select className={inputClass} value={form.country || money.country} onChange={set('country')}>
                      {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                    </select>
                  </Field>
                  <Field label={t('مستواك', 'Your level')}>
                    <select className={inputClass} value={form.craftLevel} onChange={set('craftLevel')}>
                      <option value="hobbyist">{t('هاوي', 'Hobbyist')}</option>
                      <option value="perfumer">{t('صانع عطور', 'Perfumer')}</option>
                      <option value="master_lab">{t('معمل / مصنع', 'Lab / factory')}</option>
                    </select>
                  </Field>
                </div>
                {kind === 'merchant' && (
                  <Field label={t('رقم الموبايل (خاص — يظهر للإدارة فقط)', 'Phone (private — administration only)')}><input className={inputClass} value={form.phone} onChange={set('phone')} inputMode="tel" dir="ltr" /></Field>
                )}
                {error && <p className="rounded-xl bg-rose-50 p-2.5 text-sm text-rose-700">{error}</p>}
                <div className="flex gap-2">
                  <Btn variant="ghost" onClick={() => setStep(1)}><Back className="h-4 w-4" />{t('رجوع', 'Back')}</Btn>
                  <Btn type="submit" className="flex-1" disabled={form.name.trim().length < 2 || !emailOk || !pwOk}>{t('التالي', 'Next')}<Next className="h-4 w-4" /></Btn>
                </div>
              </form>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <h2 className="text-xl font-black text-stone-900">{t('خصوصيتك أولاً', 'Your privacy first')}</h2>
                <ul className="space-y-2 text-sm leading-relaxed text-stone-700">
                  {[
                    t('الناس بتشوف اسمك وصورتك ونبذتك ومنشوراتك العامة فقط.', 'People only see your name, photo, bio and public posts.'),
                    t('موبايلك وعنوانك ورسائلك مشفّرة على السيرفر.', 'Your phone, address and messages are encrypted on the server.'),
                    t('الإدارة تقدر تراجع البيانات لحماية المجتمع فقط، وكل مراجعة بتتسجّل.', 'The administration may review data only to protect the community — every access is logged.'),
                    t('تقدر تنزّل نسخة من بياناتك أو تحذف حسابك في أي وقت من «بوابتي».', 'You can download your data or delete your account anytime from “My portal”.'),
                  ].map((line) => <li key={line} className="flex gap-2"><Lock className="mt-1 h-3.5 w-3.5 shrink-0 text-amber-600" />{line}</li>)}
                </ul>
                <label className="flex items-start gap-2 rounded-2xl bg-stone-50 p-3 text-sm text-stone-700">
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 h-4 w-4 accent-amber-700" />
                  {t('موافق على شروط المجتمع وسياسة الخصوصية، وهلتزم بالاحترام وعدم نشر أرقام أو روابط تواصل خارجية.', 'I accept the community rules and privacy policy, and will not post external contacts or links.')}
                </label>
                {error && <p className="rounded-xl bg-rose-50 p-2.5 text-sm text-rose-700">{error}</p>}
                <div className="flex gap-2">
                  <Btn variant="ghost" onClick={() => setStep(2)}><Back className="h-4 w-4" />{t('رجوع', 'Back')}</Btn>
                  <Btn className="flex-1" busy={busy} disabled={!agree} onClick={() => void register()}>
                    {kind === 'merchant' ? t('إنشاء الحساب ومتابعة بيانات المتجر', 'Create account & set up store') : t('إنشاء الحساب', 'Create account')}
                  </Btn>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
