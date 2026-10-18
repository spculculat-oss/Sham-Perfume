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
  Fingerprint,
} from 'lucide-react';
import { UserProfile } from '../types/auth';
import { completeTwoFactorLogin, confirmPasswordReset, loginUser, profileFromMember, registerUser, requestPasswordReset } from '../utils/authStorage';
import { CommunityApiError, cx, type AuthResult, type PasskeyGetOptions } from '../community/api';
import { usePasskey, webauthnAvailable } from '../community/passkeys';
import { WORLD_COUNTRIES } from '../data/worldCountries';
import { SupportedLanguage } from '../types/i18n';
import { isRTL } from '../لغات/localizedContent';
import { LText, makeT, pickArEn } from '../لغات/localize';

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
    ar: 'أوافق على الشروط والأحكام وسياسة الخصوصية (GDPR/PDPL) وأقر بأن بياناتي تُعالج بموافقة صريحة قابلة للسحب، ولن تُشارك خلطاتي مع طرف ثالث.',
    en: 'I agree to the Terms & Privacy Policy (GDPR/PDPL) and consent to processing my data (withdrawable), and that my formulas will never be shared with third parties.',
    fr: 'J’accepte les conditions et la politique de confidentialité (RGPD) et consens au traitement de mes données (révocable).',
    es: 'Acepto los Términos y la Política de Privacidad (GDPR/PDPL) y consiento el tratamiento de mis datos (revocable).',
    it: 'Accetto i Termini e la Privacy Policy (GDPR/PDPL) e consento al trattamento dei miei dati (revocabile).',
    de: 'Ich stimme den AGB und der Datenschutzrichtlinie (DSGVO) zu und willige in die Verarbeitung ein (widerruflich).',
    ru: 'Я принимаю Условия и Политику конфиденциальности (GDPR/PDPL) и даю согласие на обработку данных (отзываемое).',
    zh: '我同意条款与隐私政策（GDPR/PDPL），并同意处理我的数据（可撤回），且配方永不与第三方共享。',
    tr: 'Şartlar ve Gizlilik Politikasını (KVKK/GDPR) kabul ediyor ve verilerimin işlenmesine (geri alınabilir) onay veriyorum.',
    fa: 'با شرایط و سیاست حریم خصوصی (GDPR/PDPL) موافقم و به پردازش داده‌هایم (قابل پس‌گیری) رضایت می‌دهم.',
  },
  age_check: {
    ar: 'أؤكد أن عمري 16 سنة أو أكثر (13 سنة للولايات المتحدة) وأتحمل مسؤولية استخدام المنصة.',
    en: 'I confirm I am 16+ (13+ in the US) and responsible for using the platform.',
    fr: 'Je confirme avoir 16 ans ou plus (13+ aux États-Unis) et être responsable de l’utilisation.',
    es: 'Confirmo que tengo 16 años o más (13+ en EE. UU.) y soy responsable del uso.',
    it: 'Confermo di avere 16 anni o più (13+ negli USA) e di essere responsabile dell’uso.',
    de: 'Ich bestätige, 16+ (13+ in den USA) zu sein und verantwortlich zu nutzen.',
    ru: 'Подтверждаю, что мне 16+ (13+ в США) и я несу ответственность за использование.',
    zh: '我确认已年满 16 周岁（美国 13 周岁）并对使用本平台负责。',
    tr: '16+ (ABD’de 13+) olduğumu ve platformu sorumluca kullanacağımı onaylıyorum.',
    fa: 'تأیید می‌کنم ۱۶+ (در آمریکا ۱۳+) هستم و مسئول استفاده از پلتفرم می‌باشم.',
  },
  dob_label: {
    ar: 'تاريخ الميلاد (للتحقق من العمر):',
    en: 'Date of Birth (age verification):',
    fr: 'Date de naissance (vérification d’âge) :',
    es: 'Fecha de nacimiento (verificación de edad):',
    it: 'Data di nascita (verifica età):',
    de: 'Geburtsdatum (Altersprüfung):',
    ru: 'Дата рождения (проверка возраста):',
    zh: '出生日期（年龄验证）：',
    tr: 'Doğum tarihi (yaş doğrulama):',
    fa: 'تاریخ تولد (تأیید سن):',
  },
  err_age: {
    ar: 'يجب أن يكون عمرك 16 سنة على الأقل (13 في أمريكا) لاستخدام المنصة',
    en: 'You must be at least 16 (13 in the US) to use the platform',
    fr: 'Vous devez avoir au moins 16 ans (13 aux États-Unis) pour utiliser la plateforme',
    es: 'Debes tener al menos 16 años (13 en EE. UU.) para usar la plataforma',
    it: 'Devi avere almeno 16 anni (13 negli USA) per usare la piattaforma',
    de: 'Sie müssen mindestens 16 (13 in den USA) sein, um die Plattform zu nutzen',
    ru: 'Вам должно быть не менее 16 лет (13 в США) для использования платформы',
    zh: '您必须年满 16 周岁（美国 13 周岁）才能使用本平台',
    tr: 'Platformu kullanmak için en az 16 (ABD’de 13) yaşında olmalısınız',
    fa: 'برای استفاده از پلتفرم باید حداقل ۱۶ سال (در آمریکا ۱۳ سال) داشته باشید',
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
    ar: 'كلمة المرور لازم تكون 8 أحرف على الأقل وفيها حروف وأرقام',
    en: 'Password must be at least 8 characters with letters and numbers',
    fr: 'Le mot de passe doit contenir au moins 8 caractères, avec lettres et chiffres',
    es: 'La contraseña debe tener al menos 8 caracteres, con letras y números',
    it: 'La password deve avere almeno 8 caratteri, con lettere e numeri',
    de: 'Das Passwort muss mindestens 8 Zeichen mit Buchstaben und Zahlen haben',
    ru: 'Пароль: минимум 8 символов, буквы и цифры',
    zh: '密码至少 8 个字符，且包含字母和数字',
    tr: 'Şifre en az 8 karakter olmalı, harf ve rakam içermeli',
    fa: 'رمز عبور باید حداقل ۸ کاراکتر و شامل حروف و اعداد باشد',
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
  err_account_locked: { ar: 'محاولات كثيرة خاطئة — الحساب مقفول لمدة 15 دقيقة', en: 'Too many wrong attempts — the account is locked for 15 minutes', fr: 'Trop de tentatives — compte verrouillé 15 minutes', es: 'Demasiados intentos: cuenta bloqueada 15 minutos', it: 'Troppi tentativi: account bloccato 15 minuti', de: 'Zu viele Fehlversuche — Konto 15 Minuten gesperrt', ru: 'Слишком много попыток — аккаунт заблокирован на 15 минут', zh: '错误尝试过多，账户已锁定 15 分钟', tr: 'Çok fazla hatalı deneme — hesap 15 dakika kilitli', fa: 'تلاش‌های ناموفق زیاد — حساب ۱۵ دقیقه قفل شد' },
  err_email_unavailable: { ar: 'خدمة البريد غير مفعّلة على السيرفر — كلم الإدارة', en: 'The e-mail service is not configured on this server — contact administration', fr: 'Le service e-mail n’est pas configuré sur ce serveur', es: 'El servicio de correo no está configurado en este servidor', it: 'Il servizio e-mail non è configurato su questo server', de: 'Der E-Mail-Dienst ist auf diesem Server nicht eingerichtet', ru: 'E-mail-сервер не настроен на этом сервере', zh: '此服务器未配置邮件服务，请联系管理员', tr: 'Bu sunucuda e-posta servisi yapılandırılmadı', fa: 'سرویس ایمیل روی این سرور تنظیم نشده است' },
  err_code_limited: { ar: 'أكواد كثيرة في فترة قصيرة — استنى شوية وجرّب تاني', en: 'Too many codes in a short time — wait a moment and retry', fr: 'Trop de codes — patientez puis réessayez', es: 'Demasiados códigos — espera y reintenta', it: 'Troppi codici — attendi e riprova', de: 'Zu viele Codes — bitte warten und erneut versuchen', ru: 'Слишком много кодов — подождите и повторите', zh: '短时间内请求的验证码过多，请稍候再试', tr: 'Kısa sürede çok fazla kod — bekleyip tekrar deneyin', fa: 'کدهای زیاد در زمان کوتاه — صبر کنید و دوباره امتحان کنید' },
  err_code_invalid: { ar: 'الكود مش صحيح أو انتهى — اطلب كود جديد', en: 'The code is not valid or has expired — request a new one', fr: 'Code invalide ou expiré — demandez-en un autre', es: 'Código no válido o caducado — solicita otro', it: 'Codice non valido o scaduto — richiedine uno', de: 'Code ungültig oder abgelaufen — bitte neuen anfordern', ru: 'Код недействителен или просрочен — запросите новый', zh: '验证码无效或已过期，请重新获取', tr: 'Kod geçersiz veya süresi dolmuş — yenisini isteyin', fa: 'کد معتبر نیست یا منقضی شده — کد جدید بگیرید' },
  forgot_link: { ar: 'نسيت كلمة المرور؟', en: 'Forgot your password?', fr: 'Mot de passe oublié ?', es: '¿Olvidaste tu contraseña?', it: 'Password dimenticata?', de: 'Passwort vergessen?', ru: 'Забыли пароль?', zh: '忘记密码？', tr: 'Parolanızı mı unuttunuz?', fa: 'رمز عبور را فراموش کردید؟' },
  totp_title: { ar: 'التحقق بخطوتين', en: 'Two-step verification', fr: 'Vérification en deux étapes', es: 'Verificación en dos pasos', it: 'Verifica in due passaggi', de: 'Zwei-Faktor-Prüfung', ru: 'Двухфакторная проверка', zh: '两步验证', tr: 'İki aşamalı doğrulama', fa: 'تأیید دو مرحله‌ای' },
  totp_hint: { ar: 'اكتب الكود الست أرقام من تطبيق التحقق على موبايلك', en: 'Enter the 6-digit code from your authenticator app', fr: 'Saisissez le code à 6 chiffres de votre application d’authentification', es: 'Introduce el código de 6 dígitos de tu app de autenticación', it: 'Inserisci il codice a 6 cifre della tua app di autenticazione', de: 'Geben Sie den 6-stelligen Code Ihrer Authenticator-App ein', ru: 'Введите 6-значный код из приложения-аутентификатора', zh: '请输入验证应用中的 6 位验证码', tr: 'Doğrulayıcı uygulamanızdaki 6 haneli kodu girin', fa: 'کد ۶ رقمی از برنامه احراز هویت را وارد کنید' },
  totp_submit: { ar: 'تأكيد', en: 'Verify', fr: 'Vérifier', es: 'Verificar', it: 'Verifica', de: 'Bestätigen', ru: 'Подтвердить', zh: '确认', tr: 'Doğrula', fa: 'تأیید' },
  totp_back: { ar: 'رجوع لتسجيل الدخول', en: 'Back to sign in', fr: 'Retour à la connexion', es: 'Volver a iniciar sesión', it: 'Torna all’accesso', de: 'Zurück zur Anmeldung', ru: 'Назад ко входу', zh: '返回登录', tr: 'Girişe dön', fa: 'بازگشت به ورود' },
  forgot_title: { ar: 'تغيير كلمة المرور', en: 'Reset your password', fr: 'Réinitialiser votre mot de passe', es: 'Restablecer tu contraseña', it: 'Reimposta la password', de: 'Passwort zurücksetzen', ru: 'Восстановление пароля', zh: '重置密码', tr: 'Parolanızı sıfırlayın', fa: 'بازنشانی رمز عبور' },
  forgot_sent: { ar: 'لو البريد ده مسجل عندنا، هيوصلك كود تغيير كلمة المرور. أدخله هنا مع كلمة السر الجديدة:', en: 'If this e-mail is registered, a reset code is on its way. Enter it with your new password:', fr: 'Si cet e-mail est enregistré, un code de réinitialisation arrive. Saisissez-le avec votre nouveau mot de passe :', es: 'Si este correo está registrado, llegará un código de restablecimiento. Introdúcelo con tu nueva contraseña:', it: 'Se questa e-mail è registrata, arriverà un codice di reimpostazione. Inseriscilo con la nuova password:', de: 'Falls diese E-Mail registriert ist, ist ein Code unterwegs. Geben Sie ihn mit dem neuen Passwort ein:', ru: 'Если эта e-mail зарегистрирована, будет отправлен код. Введите его вместе с новым паролем:', zh: '如果该邮箱已注册，重置验证码正在发送。请输入验证码和新密码：', tr: 'Bu e-posta kayıtlıysa sıfırlama kodu yolda. Yeni parolanızla birlikte girin:', fa: 'اگر این ایمیل ثبت شده، کد بازنشانی ارسال می‌شود. آن را با رمز عبور جدید وارد کنید:' },
  code_label: { ar: 'الكود', en: 'Code', fr: 'Code', es: 'Código', it: 'Codice', de: 'Code', ru: 'Код', zh: '验证码', tr: 'Kod', fa: 'کد' },
  new_pw_label: { ar: 'كلمة السر الجديدة', en: 'New password', fr: 'Nouveau mot de passe', es: 'Nueva contraseña', it: 'Nuova password', de: 'Neues Passwort', ru: 'Новый пароль', zh: '新密码', tr: 'Yeni parola', fa: 'رمز عبور جدید' },
  reset_submit: { ar: 'تغيير كلمة المرور', en: 'Reset password', fr: 'Réinitialiser', es: 'Restablecer', it: 'Reimposta', de: 'Zurücksetzen', ru: 'Сбросить', zh: '重置密码', tr: 'Parolayı sıfırla', fa: 'بازنشانی رمز عبور' },
  send_code: { ar: 'إرسال الكود', en: 'Send the code', fr: 'Envoyer le code', es: 'Enviar el código', it: 'Invia il codice', de: 'Code senden', ru: 'Отправить код', zh: '发送验证码', tr: 'Kodu gönder', fa: 'ارسال کد' },
  reset_done: { ar: 'اتغيرت كلمة السر. كل الأجهزة اتخارجت — سجّل دخول بالكلمة الجديدة', en: 'Password changed. Every device was signed out — sign in with the new password', fr: 'Mot de passe changé. Tous les appareils sont déconnectés — connectez-vous avec le nouveau mot de passe', es: 'Contraseña cambiada. Todos los dispositivos salieron — inicia sesión con la nueva contraseña', it: 'Password cambiata. Tutti i dispositivi sono usciti — accedi con la nuova password', de: 'Passwort geändert. Alle Geräte wurden abgemeldet — melden Sie sich mit dem neuen Passwort an', ru: 'Пароль изменён. Со всех устройств выполнен выход — войдите с новым паролем', zh: '密码已更改。所有设备已退出，请使用新密码登录', tr: 'Parola değişti. Tüm cihazlardan çıkış yapıldı — yeni parolanızla giriş yapın', fa: 'رمز عبور تغییر کرد. از همه دستگاه‌ها خارج شدید — با رمز جدید وارد شوید' },
  passkey_btn: { ar: 'دخول بالبصمة أو الوجه', en: 'Sign in with fingerprint or face', fr: 'Se connecter avec l’empreinte ou le visage', es: 'Iniciar con huella o rostro', it: 'Accedi con impronta o volto', de: 'Mit Fingerabdruck oder Gesicht anmelden', ru: 'Вход по отпечатку или лицу', zh: '指纹或人脸登录', tr: 'Parmak izi veya yüzle giriş', fa: 'ورود با اثر انگشت یا صورت' },
  err_passkey_none: { ar: 'مفيش بصمة مسجلة بالبريد ده — ضيف واحدة من بوابتك', en: 'No passkey is registered for this e-mail — add one from your portal', fr: 'Aucun passkey pour cet e-mail — ajoutez-en un depuis votre portail', es: 'No hay passkey para este correo — añade uno desde tu portal', it: 'Nessun passkey per questa e-mail — aggiungine uno dal tuo portale', de: 'Kein Passkey für diese E-Mail — fügen Sie einen in Ihrem Portal hinzu', ru: 'Для этой e-mail нет passkey — добавьте его в своём портале', zh: '该邮箱没有 passkey，请从您的个人中心添加', tr: 'Bu e-posta için passkey yok — portalınızdan ekleyin', fa: 'برای این ایمیل passkey‌ای نیست — از پورتالتان اضافه کنید' },
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
  // L-02 Fix: GDPR Art.7 — الموافقة لا تكون افتراضية. يجب أن يختار المستخدم صراحةً.
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [dob, setDob] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);

  /* Account-security steps: the two-factor code, and forgot-password (e-mail code + new password). */
  const [stage, setStage] = useState<'auth' | 'totp' | 'forgot' | 'forgot_code'>('auth');
  const [pendingToken, setPendingToken] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const toStep = (next: 'auth' | 'totp' | 'forgot' | 'forgot_code') => { setStage(next); setErrorMsg(null); setCode(''); setNewPassword(''); };

  const finish = (user: UserProfile) => { onSuccess(user); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      if (stage === 'totp') {
        const res = await completeTwoFactorLogin(pendingToken, code);
        if (res.success && res.user) { finish(res.user); return; }
        setErrorMsg(res.error ? (S[res.error as keyof typeof S] ? L(res.error as keyof typeof S) : res.error) : L('err_login'));
        return;
      }
      if (stage === 'forgot') {
        const res = await requestPasswordReset(email);
        if (!res.success) { setErrorMsg(res.error ? (S[res.error as keyof typeof S] ? L(res.error as keyof typeof S) : res.error) : L('err_login')); return; }
        toStep('forgot_code');
        return;
      }
      if (stage === 'forgot_code') {
        const res = await confirmPasswordReset(email, code, newPassword);
        if (!res.success) { setErrorMsg(res.error ? (S[res.error as keyof typeof S] ? L(res.error as keyof typeof S) : res.error) : L('err_login')); return; }
        toStep('auth');
        setPassword('');
        setErrorMsg(L('reset_done'));
        return;
      }
      if (mode === 'login') {
        const res = await loginUser(email, password);
        if (res.success && res.user) { finish(res.user); return; }
        if (res.error === 'totp_required') { setPendingToken(res.pendingToken || ''); toStep('totp'); return; }
        setErrorMsg(res.error ? (S[res.error as keyof typeof S] ? L(res.error as keyof typeof S) : res.error) : L('err_login'));
        return;
      }
      if (mode === 'register') {
        if (!name.trim()) {
          setErrorMsg(L('err_name'));
          setIsLoading(false);
          return;
        }
        if (password.length < 8 || !/\d/.test(password) || !/[A-Za-z\u0600-\u06FF]/.test(password)) {
          setErrorMsg(L('err_password'));
          setIsLoading(false);
          return;
        }
        if (!privacyAccepted) {
          setErrorMsg(L('err_privacy'));
          setIsLoading(false);
          return;
        }
        // L-02 + L-17: تحقق العمر — GDPR Art.8 (16+) / COPPA (13+)
        if (!ageConfirmed) {
          setErrorMsg(L('err_age'));
          setIsLoading(false);
          return;
        }
        if (dob) {
          const birth = new Date(dob);
          const age = (Date.now() - birth.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
          if (age < 13) {
            setErrorMsg(L('err_age'));
            setIsLoading(false);
            return;
          }
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

  /* Passkey sign-in: the device proves itself; no password typed at all. */
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const handlePasskeyLogin = async () => {
    setErrorMsg(null);
    setPasskeyBusy(true);
    try {
      const begin = await cx<PasskeyGetOptions>('/community/auth/passkey/begin', { body: { email } });
      const res = await usePasskey(begin);
      const result = await cx<AuthResult>('/community/auth/passkey/finish', { body: { challengeId: begin.id, ...res } });
      finish(profileFromMember(result.me));
    } catch (e) {
      if (e instanceof Error && e.message === 'cancelled') setErrorMsg(null);
      else setErrorMsg(e instanceof CommunityApiError && e.code === 'NOT_FOUND' ? L('err_passkey_none') : L('err_login'));
    } finally {
      setPasskeyBusy(false);
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
                {stage === 'totp' ? L('totp_title')
                  : stage === 'forgot' || stage === 'forgot_code' ? L('forgot_title')
                  : mode === 'login' ? L('login_title') : L('register_title')}
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
              toStep('auth');
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
              toStep('auth');
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

          {stage === 'totp' && (
            <>
              <div>
                <label className="font-semibold text-stone-800 block mb-1">{L('totp_title')}</label>
                <p className="text-[11px] text-stone-500 mb-2">{L('totp_hint')}</p>
                <div className="relative">
                  <ShieldCheck className={`w-4 h-4 absolute ${rtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-amber-600`} />
                  <input
                    type="text" required inputMode="numeric" maxLength={6} autoComplete="one-time-code"
                    placeholder="••••••" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    className={`w-full ${rtl ? 'pl-3 pr-9' : 'pl-9 pr-3'} py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 tracking-[0.4em] text-center focus:outline-none focus:border-amber-700`}
                    dir="ltr"
                  />
                </div>
              </div>
              <button type="button" onClick={() => toStep('auth')} className="text-[11px] text-amber-800 underline cursor-pointer self-start">{L('totp_back')}</button>
            </>
          )}

          {stage === 'forgot' && (
            <div>
              <label className="font-semibold text-stone-800 block mb-1">{L('forgot_title')}</label>
              <div className="relative">
                <Mail className={`w-4 h-4 absolute ${rtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-stone-400`} />
                <input
                  type="email" required placeholder="perfumer@domain.com" value={email} onChange={(e) => setEmail(e.target.value)}
                  className={`w-full ${rtl ? 'pl-3 pr-9' : 'pl-9 pr-3'} py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700 text-left font-mono`}
                  dir="ltr"
                />
              </div>
            </div>
          )}

          {stage === 'forgot_code' && (
            <>
              <p className="text-[11px] text-stone-600 leading-snug">{L('forgot_sent')}</p>
              <div>
                <label className="font-semibold text-stone-800 block mb-1">{L('code_label')}</label>
                <input
                  type="text" required inputMode="numeric" maxLength={6} autoComplete="one-time-code"
                  placeholder="••••••" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 tracking-[0.4em] text-center focus:outline-none focus:border-amber-700"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="font-semibold text-stone-800 block mb-1">{L('new_pw_label')}</label>
                <input
                  type="password" required placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700 text-left font-mono"
                  dir="ltr" autoComplete="new-password"
                />
              </div>
              <button type="button" onClick={() => toStep('forgot')} className="text-[11px] text-amber-800 underline cursor-pointer self-start">{L('totp_back')}</button>
            </>
          )}

          {stage === 'auth' && (
          <>
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
                  required
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
                  <span className="text-red-600"> *</span>
                </label>
              </div>

              {/* L-02 + L-17: تأكيد العمر + تاريخ ميلاد اختياري للتحقق */}
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="age-check"
                  checked={ageConfirmed}
                  onChange={(e) => setAgeConfirmed(e.target.checked)}
                  className="mt-0.5 rounded text-amber-700 focus:ring-amber-700 cursor-pointer"
                  required
                />
                <label htmlFor="age-check" className="text-[11px] text-stone-600 leading-snug">
                  {L('age_check')}
                  <span className="text-red-600"> *</span>
                </label>
              </div>

              <div>
                <label className="font-semibold text-stone-800 block mb-1 text-[11px]">
                  {L('dob_label')}
                </label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700 text-xs"
                />
              </div>

              <p className="text-[9px] text-stone-400 leading-snug bg-stone-50 p-2 rounded-lg border border-stone-200">
                {currentLang === 'ar' ? '⚖️ بموافقتك، تُسجل موافقتك مع الطابع الزمني (GDPR Art.7). يمكنك سحبها anytime عبر "مسح بياناتي".' : '⚖️ Consent logged with timestamp (GDPR Art.7). Withdraw anytime via "Erase my data".'}
              </p>
            </>
          )}
          </>
          )}

          <div className="pt-2 space-y-2">
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-amber-300" />
              <span>
                {stage === 'totp' ? L('totp_submit')
                  : stage === 'forgot' ? L('send_code')
                  : stage === 'forgot_code' ? L('reset_submit')
                  : mode === 'login' ? L('submit_login') : L('submit_register')}
              </span>
            </button>

            {mode === 'login' && stage === 'auth' && webauthnAvailable() && email.includes('@') && (
              <button
                type="button"
                onClick={() => void handlePasskeyLogin()}
                disabled={passkeyBusy}
                className="w-full py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 font-semibold text-xs transition-colors hover:bg-amber-100 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Fingerprint className="w-3.5 h-3.5 text-amber-700" />
                <span>{passkeyBusy ? '…' : L('passkey_btn')}</span>
              </button>
            )}

            {mode === 'login' && stage === 'auth' && (
              <button
                type="button"
                onClick={() => toStep('forgot')}
                className="w-full py-2 text-amber-800 hover:text-amber-900 font-semibold text-xs transition-colors cursor-pointer"
              >
                {L('forgot_link')}
              </button>
            )}

            {mode === 'login' && stage === 'auth' && (
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
