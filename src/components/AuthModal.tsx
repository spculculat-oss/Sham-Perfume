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
import { LText, makeT, pickArEn } from '../utils/localize';

interface AuthModalProps {
  currentLang?: SupportedLanguage;
  onSuccess: (user: UserProfile) => void;
  onOpenPrivacyPolicy: () => void;
  onClose: () => void;
}

const S = {
  login_title: {
    ar: 'تسجيل الدخول إلى معملك',
    en: 'Sign in to Your Atelier',
    fr: 'Connexion à votre atelier',
    es: 'Iniciar sesión en su atelier',
    it: 'Accedi al tuo atelier',
    de: 'Anmelden in Ihrem Atelier',
    ru: 'Вход в вашу лабораторию',
    zh: '登录您的工作室',
    tr: 'Atölyenize giriş yapın',
    fa: 'ورود به آزمایشگاه شما',
  },
  register_title: {
    ar: 'إنشاء حساب مصمم عطور جديد',
    en: 'Create Master Perfumer Account',
    fr: 'Créer un compte maître parfumeur',
    es: 'Crear cuenta de maestro perfumista',
    it: 'Crea account mastro profumiere',
    de: 'Meister-Parfümeur-Konto erstellen',
    ru: 'Создать аккаунт мастера-парфюмера',
    zh: '创建调香大师账户',
    tr: 'Usta parfümör hesabı oluştur',
    fa: 'ایجاد حساب جدید طراح عطر',
  },
  header_sub: {
    ar: 'منصة صمم عطرك مع شام · حفظ وحماية الخلطات والبيانات',
    en: 'Sham Haute Parfumerie · Formula Vault & Privacy Protection',
    fr: 'Sham Haute Parfumerie · Coffre-fort de formules et confidentialité',
    es: 'Sham Haute Parfumerie · Bóveda de fórmulas y privacidad',
    it: 'Sham Haute Parfumerie · Cassa formule e privacy',
    de: 'Sham Haute Parfumerie · Formelschutz & Datenschutz',
    ru: 'Sham Haute Parfumerie · Сейф формул и защита данных',
    zh: 'Sham 高定香水 · 配方保险库与隐私保护',
    tr: 'Sham Haute Parfumerie · Formül kasası ve gizlilik',
    fa: 'شام · حفظ و محافظت از فرمول‌ها و داده‌ها',
  },
  tab_login: {
    ar: 'تسجيل الدخول',
    en: 'Sign In',
    fr: 'Connexion',
    es: 'Iniciar sesión',
    it: 'Accedi',
    de: 'Anmelden',
    ru: 'Вход',
    zh: '登录',
    tr: 'Giriş',
    fa: 'ورود',
  },
  tab_register: {
    ar: 'إنشاء حساب جديد',
    en: 'Create Account',
    fr: 'Créer un compte',
    es: 'Crear cuenta',
    it: 'Crea account',
    de: 'Konto erstellen',
    ru: 'Регистрация',
    zh: '创建账户',
    tr: 'Hesap oluştur',
    fa: 'ایجاد حساب',
  },
  name_label: {
    ar: 'الاسم الكامل أو اسم الدار العطرية:',
    en: 'Full Name or Perfume House:',
    fr: 'Nom complet ou maison de parfum :',
    es: 'Nombre completo o casa de perfumes:',
    it: 'Nome completo o casa profumiera:',
    de: 'Vollständiger Name oder Parfümhaus:',
    ru: 'Полное имя или парфюмерный дом:',
    zh: '全名或香水品牌名：',
    tr: 'Tam ad veya parfüm evi:',
    fa: 'نام کامل یا نام برند عطری:',
  },
  name_ph: {
    ar: 'مثال: م. أحمد الشامي',
    en: 'e.g., Eng. Ahmed Al-Shami',
    fr: 'ex. E. Ahmed Al-Shami',
    es: 'ej. I. Ahmed Al-Shami',
    it: 'es. Ing. Ahmed Al-Shami',
    de: 'z. B. Ing. Ahmed Al-Shami',
    ru: 'напр., инж. Ахмед Аш-Шами',
    zh: '例如：Ahmed Al-Shami',
    tr: 'örn. Müh. Ahmed Şami',
    fa: 'مثال: احمد شامی',
  },
  email_label: {
    ar: 'البريد الإلكتروني:',
    en: 'Email Address:',
    fr: 'Adresse e-mail :',
    es: 'Correo electrónico:',
    it: 'Indirizzo e-mail:',
    de: 'E-Mail-Adresse:',
    ru: 'Электронная почта:',
    zh: '电子邮箱：',
    tr: 'E-posta adresi:',
    fa: 'رایانامه:',
  },
  password_label: {
    ar: 'كلمة المرور المشفرة:',
    en: 'Encrypted Password:',
    fr: 'Mot de passe chiffré :',
    es: 'Contraseña cifrada:',
    it: 'Password cifrata:',
    de: 'Verschlüsseltes Passwort:',
    ru: 'Зашифрованный пароль:',
    zh: '加密密码：',
    tr: 'Şifreli parola:',
    fa: 'گذرواژه رمزنگاری‌شده:',
  },
  craft_label: {
    ar: 'المستوى الحرفي في تصنيع العطور:',
    en: 'Perfumery Craft Level:',
    fr: 'Niveau d’expertise en parfumerie :',
    es: 'Nivel de especialización:',
    it: 'Livello di esperienza:',
    de: 'Parfümerie-Können:',
    ru: 'Уровень мастерства:',
    zh: '调香工艺级别：',
    tr: 'Parfümeri seviyesi:',
    fa: 'سطح مهارت در عطرسازی:',
  },
  craft_hobbyist: {
    ar: 'هاوٍ ومحب لصناعة وتجربة العطور',
    en: 'Hobbyist & Fragrance Enthusiast',
    fr: 'Amateur passionné de parfumerie',
    es: 'Aficionado y entusiasta',
    it: 'Appassionato hobbista',
    de: 'Hobby-Parfümliebhaber',
    ru: 'Любитель и энтузиаст',
    zh: '香水爱好与实验者',
    tr: 'Hobi ve meraklı seviye',
    fa: 'آماتور و علاقه‌مند به ساخت عطر',
  },
  craft_perfumer: {
    ar: 'مصمم عطور محترف ومصنع مستقل',
    en: 'Professional Independent Perfumer',
    fr: 'Parfumeur indépendant professionnel',
    es: 'Perfumista independiente profesional',
    it: 'Profumiere indipendente professionista',
    de: 'Professioneller unabhängiger Parfümeur',
    ru: 'Профессиональный независимый парфюмер',
    zh: '专业独立调香师',
    tr: 'Profesyonel bağımsız parfümör',
    fa: 'عطرساز حرفه‌ای و مستقل',
  },
  craft_master: {
    ar: 'صاحب معمل ومصنع عطور تجاري',
    en: 'Commercial Lab & Factory Owner',
    fr: 'Propriétaire de laboratoire commercial',
    es: 'Propietario de laboratorio comercial',
    it: 'Titolare di laboratorio commerciale',
    de: 'Inhaber eines kommerziellen Labors',
    ru: 'Владелец лаборатории и фабрики',
    zh: '商业实验室与工厂主',
    tr: 'Ticari laboratuvar sahibi',
    fa: 'مالک آزمایشگاه و کارخانه عطر',
  },
  country_label: {
    ar: 'الدولة / البلد المعتمد للمعمل:',
    en: 'Laboratory Country / Region:',
    fr: 'Pays / région du laboratoire :',
    es: 'País / región del laboratorio:',
    it: 'Paese / regione del laboratorio:',
    de: 'Labor-Land / Region:',
    ru: 'Страна / регион лаборатории:',
    zh: '实验室所在国家/地区：',
    tr: 'Laboratuvar ülkesi / bölgesi:',
    fa: 'کشور / منطقه آزمایشگاه:',
  },
  privacy_check: {
    ar: 'أوافق على سياسة حماية بيانات المستخدم المشفرة، وعدم مشاركة خلطاتي وسجلاتي مع أي طرف ثالث.',
    en: 'I agree to the encrypted user-data protection policy and to never sharing my formulas or records with third parties.',
    fr: 'J’accepte la politique de protection chiffrée des données et le non-partage de mes formules avec des tiers.',
    es: 'Acepto la política de protección cifrada de datos y no compartir mis fórmulas con terceros.',
    it: 'Accetto la politica di protezione cifrata dei dati e di non condividere le mie formule con terzi.',
    de: 'Ich stimme der verschlüsselten Datenschutzrichtlinie zu und teile meine Formeln nicht mit Dritten.',
    ru: 'Я согласен с политикой шифрованной защиты данных и неразглашением моих формул третьим лицам.',
    zh: '我同意加密用户数据保护政策，且不与任何第三方共享我的配方与记录。',
    tr: 'Şifreli veri koruma politikasını ve formüllerimin üçüncü taraflarla paylaşılmamasını kabul ediyorum.',
    fa: 'با سیاست حفاظت رمزنگاری‌شده از داده‌های کاربر و عدم اشتراک‌گذاری فرمول‌ها با اشخاص ثالث موافقم.',
  },
  privacy_link: {
    ar: '(عرض وثيقة الخصوصية)',
    en: '(View Privacy Document)',
    fr: '(voir le document de confidentialité)',
    es: '(ver documento de privacidad)',
    it: '(vedi documento privacy)',
    de: '(Datenschutzerklärung ansehen)',
    ru: '(посмотреть политику конфиденциальности)',
    zh: '（查看隐私文档）',
    tr: '(gizlilik belgesini gör)',
    fa: '(مشاهده سند حریم خصوصی)',
  },
  submit_login: {
    ar: 'دخول آمن للمعمل',
    en: 'Secure Atelier Sign-In',
    fr: 'Connexion sécurisée',
    es: 'Acceso seguro',
    it: 'Accesso sicuro',
    de: 'Sichere Anmeldung',
    ru: 'Безопасный вход',
    zh: '安全登录',
    tr: 'Güvenli giriş',
    fa: 'ورود امن به آزمایشگاه',
  },
  submit_register: {
    ar: 'تأكيد إنشاء الحساب',
    en: 'Confirm Account Creation',
    fr: 'Confirmer la création du compte',
    es: 'Confirmar creación de cuenta',
    it: 'Conferma creazione account',
    de: 'Kontoerstellung bestätigen',
    ru: 'Подтвердить создание аккаунта',
    zh: '确认创建账户',
    tr: 'Hesap oluşturmayı onayla',
    fa: 'تأیید ایجاد حساب',
  },
  demo_login: {
    ar: 'دخول تجريبي سريع بحساب الخبير معتز (Demo)',
    en: 'Quick Demo Login with Expert Moataz (Demo)',
    fr: 'Connexion démo avec l’expert Moataz',
    es: 'Acceso demo con el experto Moataz',
    it: 'Accesso demo con l’esperto Moataz',
    de: 'Schneller Demo-Login mit Experte Moataz',
    ru: 'Быстрый демо-вход с экспертом Моатазом',
    zh: '使用专家 Moataz 账号快速体验（Demo）',
    tr: 'Uzman Moataz ile hızlı demo giriş',
    fa: 'ورود آزمایشی سریع با حساب خبره معتز (Demo)',
  },
  footer_security: {
    ar: 'بياناتك وخلطاتك محمية ومحفوظة محلياً بتشفير كامل وفق معايير GDPR',
    en: 'Your data & formulas are locally encrypted and protected under GDPR standards',
    fr: 'Vos données et formules sont chiffrées localement selon le RGPD',
    es: 'Sus datos y fórmulas están cifrados localmente conforme al RGPD',
    it: 'Dati e formule sono cifrati localmente secondo il GDPR',
    de: 'Daten und Formeln sind lokal verschlüsselt gemäß DSGVO',
    ru: 'Ваши данные и формулы зашифрованы локально по стандартам GDPR',
    zh: '您的数据与配方按 GDPR 标准本地加密保存',
    tr: 'Verileriniz ve formülleriniz GDPR standartlarına göre yerel olarak şifrelenir',
    fa: 'داده‌ها و فرمول‌های شما طبق استانداردهای GDPR به‌صورت محلی رمزنگاری و محافظت می‌شوند',
  },
  err_login: {
    ar: 'فشل تسجيل الدخول',
    en: 'Sign-in failed',
    fr: 'Échec de la connexion',
    es: 'Error al iniciar sesión',
    it: 'Accesso non riuscito',
    de: 'Anmeldung fehlgeschlagen',
    ru: 'Не удалось войти',
    zh: '登录失败',
    tr: 'Giriş başarısız',
    fa: 'ورود ناموفق بود',
  },
  err_register: {
    ar: 'فشل إنشاء الحساب',
    en: 'Account creation failed',
    fr: 'Échec de la création du compte',
    es: 'Error al crear la cuenta',
    it: 'Creazione account non riuscita',
    de: 'Kontoerstellung fehlgeschlagen',
    ru: 'Не удалось создать аккаунт',
    zh: '创建账户失败',
    tr: 'Hesap oluşturma başarısız',
    fa: 'ایجاد حساب ناموفق بود',
  },
  err_name: {
    ar: 'يرجى إدخال اسمك أو اسم المعمل',
    en: 'Please enter your name or lab name',
    fr: 'Veuillez saisir votre nom ou celui du laboratoire',
    es: 'Introduzca su nombre o el del laboratorio',
    it: 'Inserisci il tuo nome o quello del laboratorio',
    de: 'Bitte Namen oder Labornamen eingeben',
    ru: 'Пожалуйста, введите имя или название лаборатории',
    zh: '请输入您的姓名或实验室名称',
    tr: 'Lütfen adınızı veya laboratuvar adını girin',
    fa: 'لطفاً نام خود یا نام آزمایشگاه را وارد کنید',
  },
  err_password: {
    ar: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
    en: 'Password must be at least 6 characters',
    fr: 'Le mot de passe doit contenir au moins 6 caractères',
    es: 'La contraseña debe tener al menos 6 caracteres',
    it: 'La password deve contenere almeno 6 caratteri',
    de: 'Das Passwort muss mindestens 6 Zeichen haben',
    ru: 'Пароль должен содержать минимум 6 символов',
    zh: '密码至少需要 6 个字符',
    tr: 'Parola en az 6 karakter olmalı',
    fa: 'گذرواژه باید حداقل ۶ نویسه باشد',
  },
  err_privacy: {
    ar: 'يرجى الموافقة على شروط حماية البيانات وخصوصية المستخدم',
    en: 'Please accept the data protection & privacy terms',
    fr: 'Veuillez accepter les conditions de protection des données',
    es: 'Acepte los términos de protección de datos',
    it: 'Accetta i termini di protezione dei dati',
    de: 'Bitte den Datenschutzbestimmungen zustimmen',
    ru: 'Пожалуйста, примите условия защиты данных',
    zh: '请同意数据保护与隐私条款',
    tr: 'Veri koruma ve gizlilik koşullarını kabul edin',
    fa: 'لطفاً شرایط حفاظت از داده‌ها و حریم خصوصی را بپذیرید',
  },
  err_missing_fields: { ar: 'يرجى إدخال البريد الإلكتروني وكلمة المرور', en: 'Please enter your email and password', fr: 'Veuillez saisir votre e-mail et mot de passe', es: 'Introduce tu correo y contraseña', it: 'Inserisci email e password', de: 'Bitte E-Mail und Passwort eingeben', ru: 'Введите e-mail и пароль', zh: '请输入邮箱和密码', tr: 'Lütfen e-posta ve şifre girin', fa: 'لطفاً ایمیل و رمز عبور را وارد کنید' },
  err_wrong_password: { ar: 'كلمة المرور غير صحيحة', en: 'Incorrect password', fr: 'Mot de passe incorrect', es: 'Contraseña incorrecta', it: 'Password errata', de: 'Falsches Passwort', ru: 'Неверный пароль', zh: '密码错误', tr: 'Hatalı şifre', fa: 'رمز عبور نادرست است' },
  err_login_failed: { ar: 'حدث خطأ أثناء تسجيل الدخول', en: 'An error occurred during login', fr: 'Une erreur est survenue lors de la connexion', es: 'Ocurrió un error al iniciar sesión', it: 'Errore durante l’accesso', de: 'Beim Anmelden ist ein Fehler aufgetreten', ru: 'Произошла ошибка входа', zh: '登录时发生错误', tr: 'Giriş sırasında bir hata oluştu', fa: 'هنگام ورود خطایی رخ داد' },
  err_email_exists: { ar: 'البريد الإلكتروني مسجل بالفعل، يرجى تسجيل الدخول', en: 'Email already registered, please log in', fr: 'E-mail déjà enregistré, connectez-vous', es: 'Correo ya registrado, inicia sesión', it: 'Email già registrata, accedi', de: 'E-Mail bereits registriert, bitte anmelden', ru: 'E-mail уже зарегистрирован, войдите', zh: '该邮箱已注册，请直接登录', tr: 'E-posta zaten kayıtlı, lütfen giriş yapın', fa: 'این ایمیل قبلاً ثبت شده است؛ وارد شوید' },
  err_register_failed: { ar: 'حدث خطأ أثناء إنشاء الحساب', en: 'An error occurred while creating your account', fr: 'Une erreur est survenue lors de la création du compte', es: 'Ocurrió un error al crear la cuenta', it: 'Errore durante la creazione dell’account', de: 'Beim Erstellen des Kontos ist ein Fehler aufgetreten', ru: 'Произошла ошибка при создании аккаунта', zh: '创建账户时发生错误', tr: 'Hesap oluşturulurken bir hata oluştu', fa: 'هنگام ایجاد حساب خطایی رخ داد' },
} satisfies Record<string, LText>;

export const AuthModal: React.FC<AuthModalProps> = ({
  currentLang = 'ar',
  onSuccess,
  onOpenPrivacyPolicy,
  onClose,
}) => {
  const rtl = isRTL(currentLang);
  const L = makeT(currentLang, S);
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
          setErrorMsg(res.error ? (S[res.error as keyof typeof S] ? L(res.error as keyof typeof S) : res.error) : L('err_login'));
        }
      } else {
        if (!name.trim()) {
          setErrorMsg(L('err_name'));
          setIsLoading(false);
          return;
        }
        if (password.length < 6) {
          setErrorMsg(L('err_password'));
          setIsLoading(false);
          return;
        }
        if (!privacyAccepted) {
          setErrorMsg(L('err_privacy'));
          setIsLoading(false);
          return;
        }

        const res = await registerUser(name, email, password, craftLevel, regionId);
        if (res.success && res.user) {
          onSuccess(res.user);
          onClose();
        } else {
          setErrorMsg(res.error ? (S[res.error as keyof typeof S] ? L(res.error as keyof typeof S) : res.error) : L('err_register'));
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
                {mode === 'login' ? L('login_title') : L('register_title')}
              </h3>
              <p className="text-[11px] text-stone-300">
                {L('header_sub')}
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
            {L('tab_login')}
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
            {L('tab_register')}
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
                {L('name_label')}
              </label>
              <div className="relative">
                <User className={`w-4 h-4 absolute ${rtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-stone-400`} />
                <input
                  type="text"
                  required
                  placeholder={L('name_ph')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full ${rtl ? 'pl-3 pr-9' : 'pl-9 pr-3'} py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700`}
                />
              </div>
            </div>
          )}

          <div>
            <label className="font-semibold text-stone-800 block mb-1">
              {L('email_label')}
            </label>
            <div className="relative">
              <Mail className={`w-4 h-4 absolute ${rtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-stone-400`} />
              <input
                type="email"
                required
                placeholder="perfumer@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full ${rtl ? 'pl-3 pr-9' : 'pl-9 pr-3'} py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700 text-left font-mono`}
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-stone-800 block mb-1">
              {L('password_label')}
            </label>
            <div className="relative">
              <Lock className={`w-4 h-4 absolute ${rtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-stone-400`} />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full ${rtl ? 'pl-10 pr-9' : 'pl-9 pr-10'} py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700 text-left font-mono`}
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute ${rtl ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer`}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {mode === 'register' && (
            <>
              <div>
                <label className="font-semibold text-stone-800 block mb-1">
                  {L('craft_label')}
                </label>
                <select
                  value={craftLevel}
                  onChange={(e) => setCraftLevel(e.target.value as any)}
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
                >
                  <option value="hobbyist">{L('craft_hobbyist')}</option>
                  <option value="perfumer">{L('craft_perfumer')}</option>
                  <option value="master_lab">{L('craft_master')}</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-stone-800 block mb-1">
                  {L('country_label')}
                </label>
                <select
                  value={regionId}
                  onChange={(e) => setRegionId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
                >
                  {WORLD_COUNTRIES.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.flag} {pickArEn(currentLang, country.nameAr, country.nameEn)} ({country.currencyCode})
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
                  {L('privacy_check')}
                  <button
                    type="button"
                    onClick={onOpenPrivacyPolicy}
                    className="text-amber-800 font-semibold underline mx-1 cursor-pointer"
                  >
                    {L('privacy_link')}
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
              <span>{mode === 'login' ? L('submit_login') : L('submit_register')}</span>
            </button>

            {mode === 'login' && (
              <button
                type="button"
                onClick={handleDemoLogin}
                className="w-full py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                <span>{L('demo_login')}</span>
              </button>
            )}
          </div>
        </form>

        {/* Security badge footer */}
        <div className="p-3 bg-stone-50 border-t border-stone-200 text-[10px] text-stone-500 flex items-center justify-center gap-2 text-center">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>{L('footer_security')}</span>
        </div>

      </div>
    </div>
  );
};
