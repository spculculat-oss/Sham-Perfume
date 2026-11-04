import React, { useEffect, useState } from 'react';
import {
  User,
  Lock,
  Mail,
  ShieldCheck,
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
import { CommunityApiError, cx, type AuthResult, type PasskeyGetOptions, type PendingLogin } from '../community/api';
import { usePasskey, webauthnAvailable } from '../community/passkeys';
import { WORLD_COUNTRIES } from '../data/worldCountries';
import { localOnlyProfile } from '../utils/paymentAccess';
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
  pay_needs_account: {
    ar: 'الدفع يتم من حساب مسجّل ومؤكَّد فقط. دخولك الحالي محفوظ على هذا الجهاز وحده ولا يكفي للدفع.',
    en: 'Payment is only possible from a registered, verified account. Your current sign-in exists on this device only and cannot pay.',
    fr: 'Le paiement n’est possible que depuis un compte inscrit et vérifié. Votre connexion actuelle n’existe que sur cet appareil.',
    es: 'El pago solo es posible desde una cuenta registrada y verificada. Tu sesión actual solo existe en este dispositivo.',
    it: 'Il pagamento è possibile solo da un account registrato e verificato. L’accesso attuale esiste solo su questo dispositivo.',
    de: 'Bezahlen ist nur mit einem registrierten, bestätigten Konto möglich. Deine aktuelle Anmeldung gibt es nur auf diesem Gerät.',
    ru: 'Оплата возможна только из зарегистрированного подтверждённого аккаунта. Текущий вход существует только на этом устройстве.',
    zh: '只有已注册并验证的账户才能付款。您当前的登录仅保存在本设备上，无法付款。',
    tr: 'Ödeme yalnızca kayıtlı ve doğrulanmış bir hesapla yapılabilir. Mevcut girişiniz yalnızca bu cihazda.',
    fa: 'پرداخت فقط از حساب ثبت‌شده و تأییدشده ممکن است. ورود فعلی شما فقط روی این دستگاه است.',
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
  err_whatsapp_unavailable: { ar: 'إرسال كود واتساب مش متاح دلوقتي؛ إعدادات الأمان ما اتغيرتش.', en: 'WhatsApp code delivery is unavailable right now; your security settings were not changed.' },
  err_phone_legacy: { ar: 'صيغة رقم التحقق القديمة مش مفهومة بأمان؛ تواصل مع دعم الحساب لاستعادة الدخول.', en: 'The saved phone format cannot be safely normalized; contact account support to restore sign-in.' },
  err_sms_unavailable: { ar: 'تعذّر قبول إرسال رسالة التحقق. جرّب تاني أو استخدم طريقة حماية تانية.', en: 'The SMS provider did not accept the verification request. Try again or use another security method.' },
  err_phone_invalid: { ar: 'اكتب رقمك بالصيغة الدولية، يبدأ بـ + ومعاه مفتاح الدولة.', en: 'Enter your phone in international format, starting with + and the country code.' },
  err_server_required: { ar: 'تأكيد واتساب محتاج سيرفر الحسابات، مفيش حساب محلي اتعمل. جرّب لما الخدمة تبقى متاحة.', en: 'WhatsApp verification needs the account server. No local-only account was created; try again when it is available.' },
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
  magic_link_btn: { ar: 'الرابط السحري (بدون كلمة مرور)', en: 'Magic link (passwordless)', fr: 'Lien magique (sans mot de passe)', es: 'Enlace mágico (sin contraseña)', it: 'Link magico (senza password)', de: 'Magischer Link (passwortlos)', ru: 'Волшебная ссылка (без пароля)', zh: '魔法链接 (无密码)', tr: 'Sihirli bağlantı (şifresiz)', fa: 'لینک جادویی (بدون رمز عبور)' },
  remember_me: { ar: 'تذكرني (احفظ الجلسة)', en: 'Remember me', fr: 'Se souvenir de moi', es: 'Recuérdame', it: 'Ricordami', de: 'Angemeldet bleiben', ru: 'Запомнить меня', zh: '记住我', tr: 'Beni hatırla', fa: 'مرا به یاد آور' },
  enable2fa_label: { ar: 'تفعيل التحقق بخطوتين (اختياري) — تضيف بصمة موقتة من تطبيق المصادقة', en: 'Enable two-step verification (optional) — adds a time-based code from your authenticator app', fr: 'Activer la vérification en 2 étapes (optionnel) — ajoute un code temporaire de votre appli d’authentification', es: 'Activar verificación en 2 pasos (opcional) — añade un código temporal de tu app de autenticación', it: 'Attiva verifica in 2 passaggi (opzionale) — aggiunge un codice temporaneo dalla tua app di autenticazione', de: 'Zwei-Schritt-Verifizierung aktivieren (optional) — fügt einen zeitbasierten Code Ihrer Authenticator-App hinzu', ru: 'Включить двухфакторную проверку (опционально) — добавляет код из приложения-аутентификатора', zh: '启用两步验证（可选）—添加身份验证器应用的时间验证码', tr: 'İki adımlı doğrulamayı etkinleştir (isteğe bağlı) — doğrulayıcı uygulamanızdan zaman bazlı kod ekler', fa: 'فعال‌سازی تأیید دو مرحله‌ای (اختیاری) — اضافه کردن کد زمانی از برنامه تأیید هویت' },
  totp_setup_title: { ar: 'إعداد التحقق بخطوتين', en: 'Set up two-step verification', fr: 'Configurer la vérification en 2 étapes', es: 'Configurar verificación en 2 pasos', it: 'Configura verifica in 2 passaggi', de: 'Zwei-Schritt-Verifizierung einrichten', ru: 'Настроить двухфакторную проверку', zh: '设置两步验证', tr: 'İki adımlı doğrulamayı ayarla', fa: 'تنظیم تأیید دو مرحله‌ای' },
  totp_setup_hint: { ar: 'افتح تطبيق المصادقة (جوجل أوثنتاكر، أوثي، إلخ) وأضف حساباً جديداً باستخدام الكود التالي:', en: 'Open your authenticator app (Google Authenticator, Authy, etc.) and add a new account using this code:', fr: 'Ouvrez votre appli d’authentification (Google Authenticator, Authy, etc.) et ajoutez un nouveau compte avec ce code :', es: 'Abre tu app de autenticación (Google Authenticator, Authy, etc.) y agrega una nueva cuenta con este código:', it: 'Apri la tua app di autenticazione (Google Authenticator, Authy, ecc.) e aggiungi un nuovo account con questo codice:', de: 'Öffnen Sie Ihre Authenticator-App (Google Authenticator, Authy usw.) und fügen Sie ein neues Konto mit diesem Code hinzu:', ru: 'Откройте приложение-аутентификатор (Google Authenticator, Authy и т.д.) и добавьте новый аккаунт, используя этот код:', zh: '打开身份验证器应用（Google Authenticator、Authy 等）并使用此代码添加新帐户：', tr: 'Doğrulayıcı uygulamanızı (Google Authenticator, Authy vb.) açın ve yeni bir hesabı bu kodla ekleyin:', fa: 'برنامه تأیید هویت را باز کنید (گالِ Authenticator، Authy و غیره) و با استفاده از این کد یک حساب جدید اضافه کنید:' },
  totp_setup_copy: { ar: 'نسخ الكود', en: 'Copy code', fr: 'Copier le code', es: 'Copiar código', it: 'Copia codice', de: 'Code kopieren', ru: 'Скопировать код', zh: '复制代码', tr: 'Kodu kopyala', fa: 'کپی کد' },
  totp_setup_copied: { ar: 'تم نسخ الكود — ألصقه في تطبيق المصادقة', en: 'Code copied — paste it in your authenticator app', fr: 'Code copié — collez-le dans votre appli d’authentification', es: 'Código copiado — pégalo en tu app de autenticación', it: 'Codice copiato — incollalo nella tua app di autenticazione', de: 'Code kopiert — fügen Sie ihn in Ihrer Authenticator-App ein', ru: 'Код скопирован — вставьте его в приложение-аутентификатор', zh: '代码已复制 — 将其粘贴到您的身份验证器应用中', tr: 'Kod kopyalandı — doğrulayıcı uygulamanıza yapıştırın', fa: 'کد کپی شد — آن را در برنامه تأیید هویت بچسبانید' },
  totp_setup_note: { ar: 'بعد الإضافة، سيعطيك التطبيق كوداً من 6 أرقام كل 30 ثانية. ادخله عند تسجيل الدخول من جهاز جديد.', en: 'After adding, the app gives a 6-digit code every 30 seconds. Enter it when signing in from a new device.', fr: 'Après ajout, l’application génère un code à 6 chiffres toutes les 30 secondes. Saisissez-le lors de la connexion depuis un nouvel appareil.', es: 'Después de agregar, la aplicación genera un código de 6 dígitos cada 30 segundos. Ingrésalo al iniciar sesión desde un dispositivo nuevo.', it: 'Dopo aver aggiunto, l’app genera un codice a 6 cifre ogni 30 secondi. Inseriscilo durante l’accesso da un nuovo dispositivo.', de: 'Nach dem Hinzufügen generiert die App alle 30 Sekunden einen 6-stelligen Code. Geben Sie ihn bei der Anmeldung von einem neuen Gerät ein.', ru: 'После добавления приложение генерирует 6-значный код каждые 30 секунд. Введите его при входе с нового устройства.', zh: '添加后，应用每30秒生成一个6位数验证码。从新设备登录时输入该代码。', tr: 'Ekledikten sonra uygulama her 30 saniyede bir 6 haneli kod oluşturur. Yeni bir cihazdan giriş yaparken bunu girin.', fa: 'پس از اضافه کردن، برنامه هر ۳۰ ثانیه یک کد ۶ رقمی می‌دهد. هنگام ورود از یک دستگاه جدید آن را وارد کنید.' },
  totp_setup_complete: { ar: 'اكتمل الإعداد', en: 'Setup complete', fr: 'Configuration terminée', es: 'Configuración completa', it: 'Configurazione completa', de: 'Einrichtung abgeschlossen', ru: 'Настройка завершена', zh: '设置完成', tr: 'Kurulum tamamlandı', fa: 'تنظیم به پایان رسید' },
  totp_setup_skip: { ar: 'تجاوز الآن', en: 'Skip for now', fr: 'Passer pour l’instant', es: 'Omitir por ahora', it: 'Salta per ora', de: 'Jetzt überspringen', ru: 'Пропустить на сейчас', zh: '暂时跳过', tr: 'Şimdi geç', fa: 'فرار برای حال' },
  err_passkey_none: { ar: 'مفيش بصمة مسجلة بالبريد ده — ضيف واحدة من بوابتك', en: 'No passkey is registered for this e-mail — add one from your portal', fr: 'Aucun passkey pour cet e-mail — ajoutez-en un depuis votre portail', es: 'No hay passkey para este correo — añade uno desde tu portal', it: 'Nessun passkey per questa e-mail — aggiungine uno dal tuo portale', de: 'Kein Passkey für diese E-Mail — fügen Sie einen in Ihrem Portal hinzu', ru: 'Для этой e-mail нет passkey — добавьте его в своём портале', zh: '该邮箱没有 passkey，请从您的个人中心添加', tr: 'Bu e-posta için passkey yok — portalınızdan ekleyin', fa: 'برای این ایمیل passkey‌ای نیست — از پورتالتان اضافه کنید' },
  google_btn: { ar: 'متابعة بجوجل', en: 'Continue with Google', fr: 'Continuer avec Google', es: 'Continuar con Google', it: 'Continua con Google', de: 'Mit Google fortfahren', ru: 'Продолжить с Google', zh: '使用 Google 继续', tr: 'Google ile devam et', fa: 'ادامه با گوگل' },
  facebook_btn: { ar: 'متابعة بفيسبوك', en: 'Continue with Facebook', fr: 'Continuer avec Facebook', es: 'Continuar con Facebook', it: 'Continua con Facebook', de: 'Mit Facebook fortfahren', ru: 'Продолжить с Facebook', zh: '使用 Facebook 继续', tr: 'Facebook ile devam et', fa: 'ادامه با فیسبوک' },
  oauth_divider: { ar: 'أو', en: 'or', fr: 'ou', es: 'o', it: 'o', de: 'oder', ru: 'или', zh: '或', tr: 'veya', fa: 'یا' },
  oauth_coming: { ar: 'جوجل وفيسبوك مش مربوطين على الخادم. مش هنعمل حساب باسمهم من غير نافذتهم.', en: 'Google and Facebook are not connected on the server. Sham will not invent an account in their name.', fr: 'Google et Facebook ne sont pas reliés au serveur. Aucun compte fictif n’est créé.', es: 'Google y Facebook no están conectados en el servidor. No se crea una cuenta ficticia.', it: 'Google e Facebook non sono collegati al server. Nessun account fittizio.', de: 'Google und Facebook sind auf dem Server nicht verbunden. Es wird kein Scheinkonto angelegt.', ru: 'Google и Facebook не подключены на сервере. Фиктивный аккаунт не создаётся.', zh: '服务器尚未连接 Google 和 Facebook。不会伪造账户。', tr: 'Google ve Facebook sunucuya bağlı değil. Sahte hesap açılmaz.', fa: 'گوگل و فیسبوک به سرور وصل نیستند. حساب ساختگی ساخته نمی‌شود.' },
  oauth_failed: { ar: 'النافذة اتقفلت أو المزود مرجعش حساب متأكد. مفيش ربط، ومفيش حساب محلي جديد.', en: 'The window closed, or the provider did not return a verified account. Nothing was linked, and no local account was created.', fr: 'La fenêtre s’est fermée, ou le fournisseur n’a pas renvoyé un compte vérifié. Aucun lien, aucun compte local.', es: 'La ventana se cerró o el proveedor no devolvió una cuenta verificada. No hay vínculo ni cuenta local.', it: 'La finestra si è chiusa, o il fornitore non ha restituito un account verificato. Nessun collegamento.', de: 'Das Fenster wurde geschlossen oder der Anbieter hat kein geprüftes Konto zurückgegeben. Nichts wurde verknüpft.', ru: 'Окно закрылось, или провайдер не вернул проверенный аккаунт. Связи нет.', zh: '窗口已关闭，或提供方没有返回已验证账户。没有绑定。', tr: 'Pencere kapandı veya sağlayıcı doğrulanmış hesap döndürmedi. Bağlantı yok.', fa: 'پنجره بسته شد یا ارائه‌دهنده حساب تأییدشده برنگرداند. پیوندی نیست.' },
  oauth_hint: { ar: 'هتفتح نافذة جوجل أو فيسبوك. الربط يتم بس بعد موافقتك هناك.', en: 'Google or Facebook will open. The account is linked only after you agree there.', fr: 'Google ou Facebook s’ouvre. Le lien se fait seulement après votre accord.', es: 'Se abrirá Google o Facebook. El vínculo ocurre solo después de tu consentimiento.', it: 'Si apre Google o Facebook. Il collegamento avviene solo dopo il consenso.', de: 'Google oder Facebook öffnet sich. Verknüpft wird erst nach Ihrer Zustimmung.', ru: 'Откроется Google или Facebook. Связь только после вашего согласия.', zh: '将打开 Google 或 Facebook。只有在那里同意后才会绑定。', tr: 'Google veya Facebook açılır. Bağlantı yalnızca orada onaydan sonra olur.', fa: 'گوگل یا فیسبوک باز می‌شود. پیوند فقط پس از موافقت آنجاست.' },
  phone_2fa_suggest: { ar: 'عايز أمان أكتر؟ فعّل التحقق بخطوتين برسالة واتساب أو SMS — اختياري ونرشحه لك', en: 'Want extra security? Enable 2-step via WhatsApp or SMS — optional, recommended', fr: 'Sécurité renforcée ? Activez la vérification en 2 étapes par WhatsApp ou SMS — optionnel, recommandé', es: '¿Más seguridad? Activa 2 pasos por WhatsApp o SMS — opcional, recomendado', it: 'Più sicurezza? Attiva 2 passaggi via WhatsApp o SMS — opzionale, consigliato', de: 'Mehr Sicherheit? 2-Schritt per WhatsApp/SMS aktivieren — optional, empfohlen', ru: 'Хотите больше безопасности? Включите 2 шага через WhatsApp/SMS — опционально, рекомендуется', zh: '想要更安全？启用 WhatsApp 或 SMS 两步验证 — 可选，推荐', tr: 'Daha fazla güvenlik? WhatsApp/SMS ile 2 adımı etkinleştir — isteğe bağlı, önerilir', fa: 'امنیت بیشتر؟ تأیید دو مرحله‌ای با واتساپ یا پیامک — اختیاری، پیشنهادی' },
  phone_2fa_whatsapp: { ar: 'رسالة واتساب', en: 'WhatsApp message', fr: 'Message WhatsApp', es: 'Mensaje WhatsApp', it: 'Messaggio WhatsApp', de: 'WhatsApp-Nachricht', ru: 'Сообщение WhatsApp', zh: 'WhatsApp 消息', tr: 'WhatsApp mesajı', fa: 'پیام واتساپ' },
  phone_2fa_sms: { ar: 'رسالة SMS على الموبايل', en: 'SMS to mobile', fr: 'SMS sur mobile', es: 'SMS al móvil', it: 'SMS al cellulare', de: 'SMS aufs Handy', ru: 'SMS на телефон', zh: '手机短信', tr: 'Cep telefonuna SMS', fa: 'پیامک به موبایل' },
  whatsapp_security_title: { ar: 'إعدادات أمان متقدمة — واتساب (اختياري)', en: 'Advanced security — WhatsApp (optional)', fr: 'Sécurité avancée — WhatsApp (facultatif)', es: 'Seguridad avanzada — WhatsApp (opcional)', it: 'Sicurezza avanzata — WhatsApp (facoltativo)', de: 'Erweiterte Sicherheit — WhatsApp (optional)', ru: 'Дополнительная защита — WhatsApp (необязательно)', zh: '高级安全设置 — WhatsApp（可选）', tr: 'Gelişmiş güvenlik — WhatsApp (isteğe bağlı)', fa: 'امنیت پیشرفته — واتساپ (اختیاری)' },
  whatsapp_security_consent: { ar: 'أكّد رقم واتساب بكود وقت التسجيل، واستخدمه كخطوة أمان عند كل دخول. موافقتي اختيارية، والرقم للأمان فقط.', en: 'Verify my WhatsApp number at sign-up and use it as a second step at each sign-in. This is optional and the number is for security only.', fr: 'Vérifier mon numéro WhatsApp à l’inscription et l’utiliser comme seconde étape à chaque connexion. C’est facultatif et réservé à la sécurité.', es: 'Verificar mi número de WhatsApp al registrarme y usarlo como segundo paso en cada inicio de sesión. Es opcional y solo para seguridad.', it: 'Verifica il mio numero WhatsApp alla registrazione e usalo come secondo passaggio a ogni accesso. È facoltativo e solo per la sicurezza.', de: 'Meine WhatsApp-Nummer bei der Registrierung bestätigen und bei jeder Anmeldung als zweiten Schritt verwenden. Optional und nur zur Sicherheit.', ru: 'Подтвердить номер WhatsApp при регистрации и использовать его как второй шаг при каждом входе. Необязательно; номер нужен только для защиты.', zh: '注册时验证我的 WhatsApp 号码，并在每次登录时作为第二步验证。此项可选，号码仅用于安全验证。', tr: 'WhatsApp numaramı kayıtta doğrula ve her girişte ikinci adım olarak kullan. İsteğe bağlıdır; numara yalnızca güvenlik içindir.', fa: 'شماره واتساپ من را هنگام ثبت‌نام تأیید کن و در هر ورود به‌عنوان مرحله دوم استفاده کن. اختیاری است و شماره فقط برای امنیت استفاده می‌شود.' },
  whatsapp_security_note: { ar: 'الرقم يُحفظ مشفّرًا ويُستخدم لأكواد الأمان فقط. مفتاح المرور أو تطبيق المصادقة أقوى.', en: 'Your number is encrypted and used only for security codes. A passkey or authenticator app is stronger.', fr: 'Votre numéro est chiffré et utilisé uniquement pour les codes de sécurité. Une clé d’accès ou une application d’authentification est plus forte.', es: 'Tu número se cifra y solo se usa para códigos de seguridad. Una passkey o app de autenticación es más segura.', it: 'Il numero è cifrato e usato solo per i codici di sicurezza. Una passkey o un’app di autenticazione è più sicura.', de: 'Ihre Nummer wird verschlüsselt und nur für Sicherheitscodes verwendet. Ein Passkey oder eine Authenticator-App ist sicherer.', ru: 'Номер зашифрован и используется только для кодов безопасности. Ключ доступа или приложение-аутентификатор надёжнее.', zh: '号码经过加密，仅用于安全验证码。通行密钥或身份验证器应用更安全。', tr: 'Numaranız şifrelenir ve yalnızca güvenlik kodları için kullanılır. Geçiş anahtarı veya doğrulayıcı uygulaması daha güçlüdür.', fa: 'شماره شما رمزگذاری می‌شود و فقط برای کدهای امنیتی به کار می‌رود. کلید عبور یا برنامه احراز هویت امن‌تر است.' },
  whatsapp_setup_title: { ar: 'تأكيد رقم واتساب', en: 'Verify your WhatsApp number', fr: 'Vérifier votre numéro WhatsApp', es: 'Verifica tu número de WhatsApp', it: 'Verifica il tuo numero WhatsApp', de: 'WhatsApp-Nummer bestätigen', ru: 'Подтвердите номер WhatsApp', zh: '验证 WhatsApp 号码', tr: 'WhatsApp numaranızı doğrulayın', fa: 'شماره واتساپ را تأیید کنید' },
  whatsapp_setup_accepted: { ar: 'طلبنا إرسال كود من 6 أرقام على واتساب. لو وصلك، اكتبه هنا؛ بعد التأكيد هيتطلب عند الدخول.', en: 'We requested a 6-digit WhatsApp code. If it arrives, enter it here; after verification it will be required at sign-in.', fr: 'L’envoi d’un code WhatsApp à 6 chiffres a été demandé. S’il arrive, saisissez-le ici ; il sera requis après confirmation.', es: 'Solicitamos un código de WhatsApp de 6 dígitos. Si llega, introdúcelo aquí; tras verificarlo, se pedirá al iniciar sesión.', it: 'Abbiamo richiesto un codice WhatsApp di 6 cifre. Se arriva, inseriscilo qui; dopo la verifica sarà richiesto all’accesso.', de: 'Ein sechsstelliger WhatsApp-Code wurde angefordert. Wenn er ankommt, geben Sie ihn hier ein; danach ist er bei der Anmeldung erforderlich.', ru: 'Запрошена отправка 6-значного кода WhatsApp. Если он придёт, введите его здесь; после подтверждения он будет нужен при входе.', zh: '已请求发送 WhatsApp 六位验证码。收到后请在此输入；验证后登录时需要此验证码。', tr: '6 haneli WhatsApp kodu gönderilmesi istendi. Ulaşırsa buraya girin; doğrulamadan sonra girişte istenir.', fa: 'درخواست ارسال کد شش‌رقمی واتساپ ثبت شد. اگر دریافتش کردید اینجا وارد کنید؛ پس از تأیید، هنگام ورود لازم است.' },
  whatsapp_setup_waiting: { ar: 'ماقدرناش نأكد قبول إرسال الكود. جرّب إعادة الإرسال، أو كمل من غير تفعيل واتساب.', en: 'We could not confirm Meta accepted the code request. Retry, or continue without WhatsApp.', fr: 'Meta n’a pas confirmé la demande du code. Réessayez ou continuez sans WhatsApp.', es: 'No pudimos confirmar que Meta aceptara el envío. Reintenta o continúa sin WhatsApp.', it: 'Non è stato possibile confermare l’accettazione da Meta. Riprova o continua senza WhatsApp.', de: 'Meta hat die Code-Anfrage nicht bestätigt. Versuchen Sie es erneut oder fahren Sie ohne WhatsApp fort.', ru: 'Не удалось подтвердить принятие запроса Meta. Повторите попытку или продолжите без WhatsApp.', zh: '无法确认 Meta 是否接受了验证码请求。请重试，或不启用 WhatsApp 继续。', tr: 'Meta’nın kod isteğini kabul ettiği doğrulanamadı. Yeniden deneyin veya WhatsApp olmadan devam edin.', fa: 'پذیرش درخواست کد از سوی متا تأیید نشد. دوباره تلاش کنید یا بدون واتساپ ادامه دهید.' },
  whatsapp_login_accepted: { ar: 'طلبنا إرسال كود واتساب. لو ماوصلكش، اطلب إعادة الإرسال.', en: 'We requested a WhatsApp code. If it does not arrive, request another.', fr: 'L’envoi d’un code WhatsApp a été demandé. S’il n’arrive pas, demandez-en un autre.', es: 'Solicitamos un código de WhatsApp. Si no llega, pide otro.', it: 'Abbiamo richiesto un codice WhatsApp. Se non arriva, richiedine un altro.', de: 'Ein WhatsApp-Code wurde angefordert. Falls er nicht ankommt, fordern Sie einen neuen an.', ru: 'Запрошена отправка кода WhatsApp. Если он не придёт, запросите новый.', zh: '已请求发送 WhatsApp 验证码。如未收到，请重新申请。', tr: 'WhatsApp kodu istendi. Ulaşmazsa yeniden isteyin.', fa: 'درخواست ارسال کد واتساپ ثبت شد. اگر نرسید، دوباره درخواست دهید.' },
  whatsapp_login_waiting: { ar: 'ماقدرناش نأكد قبول الإرسال. جرّب إعادة الإرسال.', en: 'We could not confirm Meta accepted the request. Try resending.', fr: 'Meta n’a pas confirmé la demande. Réessayez l’envoi.', es: 'No pudimos confirmar la solicitud de Meta. Intenta reenviarla.', it: 'Non è stato possibile confermare la richiesta a Meta. Riprova.', de: 'Meta hat die Anfrage nicht bestätigt. Versuchen Sie es erneut.', ru: 'Не удалось подтвердить запрос Meta. Попробуйте отправить ещё раз.', zh: '无法确认 Meta 是否接受了请求。请重试。', tr: 'Meta’nın isteği kabul ettiği doğrulanamadı. Yeniden deneyin.', fa: 'پذیرش درخواست از سوی متا تأیید نشد. دوباره تلاش کنید.' },
  phone_code_accepted: { ar: 'طلبنا إرسال كود التحقق لهاتفك. لو ماوصلكش، اطلب إعادة الإرسال.', en: 'We requested a verification code to your phone. If it does not arrive, request another.', fr: 'L’envoi d’un code de vérification sur votre téléphone a été demandé. S’il n’arrive pas, demandez-en un autre.', es: 'Solicitamos un código de verificación para tu teléfono. Si no llega, pide otro.', it: 'Abbiamo richiesto un codice di verifica sul telefono. Se non arriva, richiedine un altro.', de: 'Ein Bestätigungscode für Ihr Telefon wurde angefordert. Falls er nicht ankommt, fordern Sie einen neuen an.', ru: 'Запрошена отправка кода подтверждения на телефон. Если он не придёт, запросите новый.', zh: '已请求向您的手机发送验证码。如未收到，请重新申请。', tr: 'Telefonunuza doğrulama kodu istendi. Ulaşmazsa yeniden isteyin.', fa: 'درخواست ارسال کد تأیید به تلفن شما ثبت شد. اگر نرسید، دوباره درخواست دهید.' },
  phone_code_waiting: { ar: 'ماقدرناش نأكد قبول طلب الإرسال. جرّب إعادة الإرسال.', en: 'We could not confirm the provider accepted the request. Try resending.', fr: 'Le fournisseur n’a pas confirmé la demande. Réessayez.', es: 'No pudimos confirmar que el proveedor aceptara la solicitud. Reintenta.', it: 'Non è stato possibile confermare l’accettazione della richiesta. Riprova.', de: 'Der Anbieter hat die Anfrage nicht bestätigt. Versuchen Sie es erneut.', ru: 'Не удалось подтвердить принятие запроса поставщиком. Попробуйте снова.', zh: '无法确认服务商是否接受了请求。请重试。', tr: 'Sağlayıcının isteği kabul ettiği doğrulanamadı. Yeniden deneyin.', fa: 'پذیرش درخواست از سوی سرویس‌دهنده تأیید نشد. دوباره تلاش کنید.' },
  sms_code_label: { ar: 'كود SMS', en: 'SMS code', fr: 'Code SMS', es: 'Código SMS', it: 'Codice SMS', de: 'SMS-Code', ru: 'Код из SMS', zh: '短信验证码', tr: 'SMS kodu', fa: 'کد پیامک' },
  whatsapp_code_label: { ar: 'كود واتساب', en: 'WhatsApp code', fr: 'Code WhatsApp', es: 'Código de WhatsApp', it: 'Codice WhatsApp', de: 'WhatsApp-Code', ru: 'Код WhatsApp', zh: 'WhatsApp 验证码', tr: 'WhatsApp kodu', fa: 'کد واتساپ' },
  whatsapp_resend: { ar: 'إعادة إرسال كود واتساب', en: 'Resend WhatsApp code', fr: 'Renvoyer le code WhatsApp', es: 'Reenviar código de WhatsApp', it: 'Invia di nuovo il codice WhatsApp', de: 'WhatsApp-Code erneut senden', ru: 'Отправить код WhatsApp повторно', zh: '重新发送 WhatsApp 验证码', tr: 'WhatsApp kodunu yeniden gönder', fa: 'ارسال دوباره کد واتساپ' },
  whatsapp_continue: { ar: 'متابعة من غير واتساب', en: 'Continue without WhatsApp', fr: 'Continuer sans WhatsApp', es: 'Continuar sin WhatsApp', it: 'Continua senza WhatsApp', de: 'Ohne WhatsApp fortfahren', ru: 'Продолжить без WhatsApp', zh: '不使用 WhatsApp，继续', tr: 'WhatsApp olmadan devam et', fa: 'ادامه بدون واتساپ' },
  whatsapp_confirm: { ar: 'تأكيد الرقم وتفعيل الحماية', en: 'Verify number and enable protection', fr: 'Vérifier le numéro et activer la protection', es: 'Verificar número y activar protección', it: 'Verifica il numero e attiva la protezione', de: 'Nummer bestätigen und Schutz aktivieren', ru: 'Подтвердить номер и включить защиту', zh: '验证号码并启用保护', tr: 'Numarayı doğrula ve korumayı etkinleştir', fa: 'تأیید شماره و فعال‌سازی حفاظت' },
  whatsapp_not_configured: { ar: 'تأكيد واتساب هيظهر لما إعدادات Meta المطلوبة تتضاف للسيرفر. لو Meta رفضت الإرسال، هنوضح لك ومش هنقول إن الكود اتبعت.', en: 'WhatsApp verification appears after the required Meta settings are added on the server. If Meta rejects a send, we will say so rather than claim it was sent.', fr: 'La vérification WhatsApp apparaîtra lorsque les paramètres Meta seront configurés sur le serveur. Tout refus sera signalé.', es: 'La verificación de WhatsApp aparecerá cuando se configuren los ajustes de Meta en el servidor. Los rechazos se indicarán claramente.', it: 'La verifica WhatsApp apparirà quando le impostazioni Meta saranno configurate sul server. Eventuali rifiuti saranno segnalati.', de: 'Die WhatsApp-Prüfung erscheint, sobald die Meta-Einstellungen auf dem Server eingerichtet sind. Ablehnungen werden deutlich angezeigt.', ru: 'Проверка WhatsApp появится после настройки Meta на сервере. Отказы будут показаны явно.', zh: '服务器配置 Meta 后将显示 WhatsApp 验证。如发送被拒绝，会明确提示。', tr: 'Meta ayarları sunucuda yapılandırıldığında WhatsApp doğrulaması görünür. Reddedilirse açıkça bildirilir.', fa: 'پس از تنظیم متا روی سرور، تأیید واتساپ نمایش داده می‌شود. رد درخواست به‌روشنی اعلام می‌شود.' },
  whatsapp_config_unknown: { ar: 'مش قادرين نتحقق من إعداد واتساب على السيرفر دلوقتي؛ الخيار مخفي لحد ما الحالة تتأكد.', en: 'We could not check the server’s WhatsApp settings; the option stays hidden until its status can be confirmed.' },
  err_phone_required: { ar: 'أدخل رقم الموبايل أولاً في بوابتك → الأمان', en: 'Add your mobile number first in Portal → Security', fr: 'Ajoutez d’abord votre mobile dans Portail → Sécurité', es: 'Añade tu móvil primero en Portal → Seguridad', it: 'Aggiungi prima il cellulare in Portale → Sicurezza', de: 'Fügen Sie zuerst Ihre Handynummer in Portal → Sicherheit hinzu', ru: 'Сначала добавьте телефон в Портал → Безопасность', zh: '请先在 门户 → 安全 中添加手机号', tr: 'Önce Portal → Güvenlik’te cep numaranızı ekleyin', fa: 'ابتدا شماره موبایل را در پورتال → امنیت اضافه کنید' },
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
  /** التحقق بخطوتين اختياري أثناء التسجيل — لا يُفعَّل unless يختاره المستخدم. */
  const [enable2fa, setEnable2fa] = useState(false);
  const [whatsappAvailable, setWhatsappAvailable] = useState(false);
  const [whatsappConfigLoaded, setWhatsappConfigLoaded] = useState(false);
  const [whatsappConfigError, setWhatsappConfigError] = useState(false);
  const [enableWhatsApp2fa, setEnableWhatsApp2fa] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [phoneSetupUser, setPhoneSetupUser] = useState<UserProfile | null>(null);
  const [phoneResendCooldown, setPhoneResendCooldown] = useState(0);
  const [phoneChannel, setPhoneChannel] = useState<'sms' | 'whatsapp'>('whatsapp');
  /** السر المؤقت لحلقة التحقق بخطوتين بعد التسجيل (يُعرض مرة واحدة). */
  const [totpSetupSecret, setTotpSetupSecret] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Google-style live strength (mirrors server/community/service.ts passwordPolicy)
  const pwStrength = (pw: string) => {
    let s = 0;
    if (pw.length >= 8) s++;
    if (pw.length >= 12) s++;
    if (/\d/.test(pw) && /[A-Za-z\u0600-\u06FF]/.test(pw)) s++;
    if (/[^A-Za-z0-9\u0600-\u06FF]/.test(pw) || /[A-Z]/.test(pw)) s++;
    return s;
  };
  const pwScore = pwStrength(password);
  const pwOk = password.length >= 8 && /\d/.test(password) && /[A-Za-z\u0600-\u06FF]/.test(password);

  const [isLoading, setIsLoading] = useState(false);

  /* Account-security steps: the two-factor code, and forgot-password (e-mail code + new password). */
  const [stage, setStage] = useState<'auth' | 'totp' | 'phone' | 'phone_setup' | 'forgot' | 'forgot_code' | 'totp_setup'>('auth');
  const [pendingToken, setPendingToken] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotCooldown, setForgotCooldown] = useState(0);
  /** «تذكرني»: إن أُطفِئت تُحفظ الجلسة في ذاكرة الجلسة فقط (تُمسح بإغلاق المتصفح). */
  const [rememberMe, setRememberMe] = useState(true);
  /** التحقق المباشر من صيغة البريد أثناء الكتابة. */
  const [emailValid, setEmailValid] = useState(true);
  const emailRe = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

  const toStep = (next: 'auth' | 'totp' | 'phone' | 'phone_setup' | 'forgot' | 'forgot_code' | 'totp_setup') => { setStage(next); setErrorMsg(null); setCode(''); setNewPassword(''); setPhoneCodeRequested(false); };
  React.useEffect(() => {
    if (forgotCooldown <= 0) return;
    const t = setTimeout(() => setForgotCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [forgotCooldown]);
  React.useEffect(() => {
    if (phoneResendCooldown <= 0) return;
    const t = setTimeout(() => setPhoneResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phoneResendCooldown]);
  React.useEffect(() => {
    let live = true;
    cx<{ whatsappOtp: boolean }>('/community/auth/config')
      .then((config) => { if (live) { setWhatsappAvailable(config.whatsappOtp === true); setWhatsappConfigError(false); } })
      .catch(() => { if (live) { setWhatsappAvailable(false); setWhatsappConfigError(true); } })
      .finally(() => { if (live) setWhatsappConfigLoaded(true); });
    return () => { live = false; };
  }, []);

  React.useEffect(() => {
    if (!email) { setEmailValid(true); return; }
    setEmailValid(emailRe.test(email));
  }, [email]);

  const finish = (user: UserProfile) => { onSuccess(user); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      if (stage === 'phone') {
        await verifyPhoneCode();
        return;
      }
      if (stage === 'phone_setup') {
        await verifyPhoneSetupCode();
        return;
      }
      if (stage === 'totp') {
        const res = await completeTwoFactorLogin(pendingToken, code);
        if (res.success && res.user) { finish(res.user); return; }
        setErrorMsg(res.error ? (S[res.error as keyof typeof S] ? L(res.error as keyof typeof S) : res.error) : L('err_login'));
        return;
      }
      if (stage === 'forgot') {
        if (!email || !email.includes('@')) { setErrorMsg(L('err_missing_fields')); return; }
        const res = await requestPasswordReset(email);
        if (!res.success) { setErrorMsg(res.error ? (S[res.error as keyof typeof S] ? L(res.error as keyof typeof S) : res.error) : L('err_login')); return; }
        toStep('forgot_code');
        setForgotCooldown(60);
        return;
      }
      if (stage === 'forgot_code') {
        if (code.length !== 6) { setErrorMsg(L('err_code_invalid')); return; }
        if (newPassword.length < 8 || !/\d/.test(newPassword) || !/[A-Za-z\u0600-\u06FF]/.test(newPassword)) { setErrorMsg(L('err_password')); return; }
        const res = await confirmPasswordReset(email, code, newPassword);
        if (!res.success) { setErrorMsg(res.error ? (S[res.error as keyof typeof S] ? L(res.error as keyof typeof S) : res.error) : L('err_login')); return; }
        toStep('auth');
        setPassword('');
        setForgotCooldown(0);
        setErrorMsg(L('reset_done'));
        return;
      }
      if (mode === 'login') {
        const res = await loginUser(email, password);
        if (res.success && res.user) {
          if (!rememberMe) { try { const raw = localStorage.getItem('sham_auth_user_v1'); if (raw) { sessionStorage.setItem('sham_auth_user_v1', raw); localStorage.removeItem('sham_auth_user_v1'); } } catch {} }
          finish(res.user); return;
        }
        if (res.error === 'totp_required' && res.pendingToken) {
          const method = res.method || 'totp';
          setPendingToken(res.pendingToken);
          if (method === 'phone') setPhoneChannel(res.phoneMethod || 'whatsapp');
          toStep(method === 'phone' ? 'phone' : 'totp');
          if (method === 'phone') await requestPhoneCode(res.pendingToken);
          return;
        }
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

        const formattedPhone = whatsappPhone.replace(/[\s().-]/g, '').replace(/^00/, '+');
        if (enableWhatsApp2fa && !/^\+[1-9]\d{7,14}$/.test(formattedPhone)) {
          setErrorMsg(L('err_phone_invalid'));
          return;
        }
        const res = await registerUser(name, email, password, craftLevel, regionId, enable2fa && !enableWhatsApp2fa, enableWhatsApp2fa);
        if (res.success && res.user) {
          if (res.totpSecret) {
            setTotpSetupSecret(res.totpSecret);
            toStep('totp_setup');
            return;
          }
          if (enableWhatsApp2fa) {
            setPhoneSetupUser(res.user);
            toStep('phone_setup');
            try {
              await cx('/community/me/2fa/phone/setup', { body: { phone: formattedPhone, method: 'whatsapp', password } });
              setPhoneCodeRequested(true);
              setPhoneResendCooldown(60);
            } catch (e) { setErrorMsg(phoneErrorText(e)); }
            return;
          }
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


  /* Phone 2FA: WhatsApp code is requested only after the user opts in or chooses it at sign-in. */
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneCodeRequested, setPhoneCodeRequested] = useState(false);
  const phoneErrorText = (e: unknown) => e instanceof CommunityApiError
    ? e.code === 'WHATSAPP_UNAVAILABLE' ? L('err_whatsapp_unavailable')
      : e.code === 'SMS_UNAVAILABLE' ? L('err_sms_unavailable')
        : e.code === 'INVALID_PHONE' ? L('err_phone_invalid')
        : e.code === 'PHONE_FORMAT_UNSUPPORTED' ? L('err_phone_legacy')
          : e.code === 'CODE_LIMITED' ? L('err_code_limited')
          : e.code === 'CODE_INVALID' ? L('err_code_invalid')
            : L('err_login')
    : L('err_login');
  const requestPhoneCode = async (token = pendingToken) => {
    if (!token) return;
    setPhoneBusy(true);
    setPhoneCodeRequested(false);
    try {
      await cx('/community/auth/login/phone/request', { body: { pendingToken: token } });
      setPhoneCodeRequested(true);
      setPhoneResendCooldown(60);
      setErrorMsg(null);
    } catch (e) { setErrorMsg(phoneErrorText(e)); }
    finally { setPhoneBusy(false); }
  };
  const requestPhoneSetupCode = async () => {
    if (!phoneSetupUser) return;
    setPhoneBusy(true);
    setPhoneCodeRequested(false);
    try {
      await cx('/community/me/2fa/phone/setup', { body: { phone: whatsappPhone, method: 'whatsapp', password } });
      setPhoneCodeRequested(true);
      setPhoneResendCooldown(60);
      setErrorMsg(null);
    } catch (e) { setErrorMsg(phoneErrorText(e)); }
    finally { setPhoneBusy(false); }
  };
  const verifyPhoneCode = async () => {
    if (!pendingToken) return;
    try {
      const result = await cx<AuthResult>('/community/auth/login/phone/verify', { body: { pendingToken, code } });
      finish(profileFromMember(result.me));
    } catch (e) { setErrorMsg(phoneErrorText(e)); }
  };
  const verifyPhoneSetupCode = async () => {
    if (!phoneSetupUser) return;
    try {
      await cx('/community/me/2fa/phone/confirm', { body: { code } });
      const user = phoneSetupUser;
      setPhoneSetupUser(null);
      finish(user);
    } catch (e) { setErrorMsg(phoneErrorText(e)); }
  };
  const continueWithoutWhatsApp = async () => {
    if (!phoneSetupUser) return;
    setPhoneBusy(true);
    try { await cx('/community/me/2fa/phone/cancel', { body: { password } }); } catch { /* An unverified code expires; it never enables the factor by itself. */ }
    const user = phoneSetupUser;
    setPhoneSetupUser(null);
    setPhoneBusy(false);
    finish(user);
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
                {stage === 'phone_setup' ? L('whatsapp_setup_title')
                  : stage === 'phone' || stage === 'totp' ? L('totp_title')
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
            disabled={stage === 'phone_setup'}
            onClick={() => {
              setMode('login');
              toStep('auth');
            }}
            className={`flex-1 py-3 text-center transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
              mode === 'login'
                ? 'bg-white text-stone-950 border-b-2 border-amber-800'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            {L('tab_login')}
          </button>
          <button
            disabled={stage === 'phone_setup'}
            onClick={() => {
              setMode('register');
              toStep('auth');
            }}
            className={`flex-1 py-3 text-center transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
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
          {localOnlyProfile() && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2" role="status" data-testid="auth-pay-needs-account">
              <Lock className="w-4 h-4 shrink-0 text-amber-700" />
              <span>{L('pay_needs_account')}</span>
            </div>
          )}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {stage === 'phone' && (
            <>
              <div>
                <label className="font-semibold text-stone-800 block mb-1">{L(phoneChannel === 'sms' ? 'sms_code_label' : 'whatsapp_code_label')}</label>
                <p className="text-[11px] text-stone-500 mb-2">{phoneCodeRequested ? L('phone_code_accepted') : L('phone_code_waiting')}</p>
                <div className="relative">
                  <ShieldCheck className={`w-4 h-4 absolute ${rtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-emerald-600`} />
                  <input
                    type="text" required inputMode="numeric" maxLength={6} autoComplete="one-time-code"
                    placeholder="••••••" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    className={`w-full ${rtl ? 'pl-3 pr-9' : 'pl-9 pr-3'} py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 tracking-[0.4em] text-center focus:outline-none focus:border-emerald-700`}
                    dir="ltr"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => toStep('auth')} className="flex-1 py-2 text-stone-600 hover:text-stone-800 text-xs underline cursor-pointer">{L('totp_back')}</button>
                <button type="button" onClick={() => void requestPhoneCode()} disabled={phoneBusy || phoneResendCooldown > 0} className="flex-1 py-2 text-emerald-700 hover:text-emerald-800 text-xs font-semibold cursor-pointer disabled:opacity-60">{phoneBusy ? '…' : phoneResendCooldown > 0 ? `${currentLang === 'ar' ? 'إعادة الإرسال بعد' : 'Resend in'} ${phoneResendCooldown}s` : (currentLang === 'ar' ? 'إعادة إرسال الكود' : 'Resend code')}</button>
              </div>
            </>
          )}

          {stage === 'phone_setup' && (
            <div className="space-y-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs font-bold text-emerald-950">{L('whatsapp_setup_title')}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-stone-600">
                  {L(phoneCodeRequested ? 'whatsapp_setup_accepted' : 'whatsapp_setup_waiting')}
                </p>
                <p className="mt-1 font-mono text-xs text-stone-700" dir="ltr">{whatsappPhone}</p>
              </div>
              <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="••••••" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-3 text-center font-mono text-lg tracking-[0.4em]" dir="ltr" />
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <button type="button" onClick={() => void requestPhoneSetupCode()} disabled={phoneBusy || phoneResendCooldown > 0} className="font-semibold text-emerald-800 underline disabled:text-stone-400 disabled:no-underline">
                  {phoneBusy ? '…' : phoneResendCooldown > 0 ? `${currentLang === 'ar' ? 'إعادة الإرسال بعد' : 'Resend in'} ${phoneResendCooldown}s` : L('whatsapp_resend')}
                </button>
                <button type="button" onClick={() => void continueWithoutWhatsApp()} disabled={phoneBusy} className="text-stone-600 underline disabled:opacity-50">
                  {L('whatsapp_continue')}
                </button>
              </div>
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
            <div className="space-y-3">
              <div>
                <label className="font-semibold text-stone-800 block mb-1">{L('forgot_title')}</label>
                <p className="text-[11px] text-stone-500 leading-snug mb-2">{currentLang==='ar' ? 'اكتب بريدك المسجل — لو موجود هنبعتلك كود 6 أرقام صالح 10 دقايق (نفس أسلوب جوجل وميتا).' : 'Enter your registered e-mail — if it exists we will send a 6-digit code valid 10 min (like Google/Meta).'}</p>
                <div className="relative">
                  <Mail className={`w-4 h-4 absolute ${rtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-stone-400`} />
                  <input
                    type="email" required autoFocus placeholder="perfumer@domain.com" value={email} onChange={(e) => setEmail(e.target.value)}
                    className={`w-full ${rtl ? 'pl-3 pr-9' : 'pl-9 pr-3'} py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700 text-left font-mono`}
                    dir="ltr"
                  />
                </div>
              </div>
              <div className="flex justify-between items-center">
                <button type="button" onClick={() => toStep('auth')} className="text-[11px] text-stone-600 underline cursor-pointer">{L('totp_back')}</button>
                <span className="text-[10px] text-stone-400">{currentLang==='ar' ? 'هنرد بنفس الرسالة سواء البريد موجود أو لا (حماية الخصوصية)' : 'Same response whether e-mail exists (privacy protection)'}</span>
              </div>
            </div>
          )}

          {stage === 'forgot_code' && (
            <>
              <div className="rounded-xl bg-sky-50 border border-sky-200 p-3">
                <p className="text-[11px] text-sky-900 leading-snug">{L('forgot_sent')}</p>
                <p className="text-xs font-mono text-stone-700 mt-1" dir="ltr">{email}</p>
              </div>
              <div>
                <label className="font-semibold text-stone-800 block mb-1 text-xs">{L('code_label')} <span className="text-stone-400 font-normal text-[10px]">— 6 أرقام</span></label>
                <input
                  type="text" required inputMode="numeric" maxLength={6} autoComplete="one-time-code"
                  placeholder="••••••" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 tracking-[0.4em] text-center focus:outline-none focus:border-amber-700 text-lg font-mono"
                  dir="ltr"
                  autoFocus
                />
                <div className="flex justify-between items-center mt-2">
                  <button type="button" onClick={() => { if (forgotCooldown>0) return; void (async()=>{ const r=await requestPasswordReset(email); if(r.success) setForgotCooldown(60); })(); }} disabled={forgotCooldown>0} className="text-[11px] text-amber-800 underline cursor-pointer disabled:text-stone-400 disabled:no-underline">
                    {forgotCooldown>0 ? `${currentLang==='ar' ? 'إعادة الإرسال بعد' : 'Resend in'} ${forgotCooldown}s` : (currentLang==='ar' ? 'إعادة إرسال الكود' : 'Resend code')}
                  </button>
                  <button type="button" onClick={() => toStep('forgot')} className="text-[11px] text-stone-600 underline cursor-pointer">{L('totp_back')}</button>
                </div>
              </div>
              <div>
                <label className="font-semibold text-stone-800 block mb-1 text-xs">{L('new_pw_label')}</label>
                <div className="relative">
                  <Lock className={`w-4 h-4 absolute ${rtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-stone-400`} />
                  <input
                    type={showNewPassword ? 'text' : 'password'} required placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    className={`w-full ${rtl ? 'pl-10 pr-9' : 'pl-9 pr-10'} py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700 text-left font-mono`}
                    dir="ltr" autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className={`absolute ${rtl ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer`}>
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {newPassword.length>0 && (
                  <div className="mt-2 space-y-1.5">
                    <div className="grid grid-cols-4 gap-1">
                      {([0,1,2,3] as const).map((i)=>{ const s=newPassword.length>=8 ? (newPassword.length>=12?4:3) : (newPassword.length>=6?1:0); const ok = (/\d/.test(newPassword) && /[A-Za-z\u0600-\u06FF]/.test(newPassword)); const score = ok ? s : Math.max(0,s-1); return <span key={i} className={`h-1.5 rounded-full ${i < score ? (score>=3 ? 'bg-emerald-500' : score===2 ? 'bg-amber-500' : 'bg-rose-500') : 'bg-stone-200'}`} />; })}
                    </div>
                    <p className="text-[10px] text-stone-500">• {newPassword.length>=8 && /\d/.test(newPassword) && /[A-Za-z\u0600-\u06FF]/.test(newPassword) ? '✓ ' : ''}{L('err_password').split('،')[0]} — {newPassword.length>=8? '✓' : ''} 8+ أحرف + أرقام</p>
                  </div>
                )}
              </div>
            </>
          )}

          {stage === 'totp_setup' && (
            <div className="space-y-3">
              <div>
                <label className="font-semibold text-stone-800 block mb-1">{currentLang === 'ar' ? 'إعداد التحقق بخطوتين' : 'Set up two-step verification'}</label>
                <p className="text-[11px] text-stone-500 mb-2">{currentLang === 'ar' ? 'افتح تطبيق المصادقة (جوجل أوثنتاكر، أوثي، إلخ) وأضف حساباً جديداً باستخدام الكود التالي:' : 'Open your authenticator app (Google Authenticator, Authy, etc.) and add a new account using this code:'}</p>
                <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-center font-mono text-lg tracking-wider text-stone-900 select-text">
                  {totpSetupSecret}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (totpSetupSecret) {
                      navigator.clipboard.writeText(totpSetupSecret).then(() => {
                        setErrorMsg(currentLang === 'ar' ? 'تم نسخ الكود — ألصقه في تطبيق المصادقة' : 'Code copied — paste it in your authenticator app');
                      });
                    }
                  }}
                  className="text-[11px] text-amber-800 underline cursor-pointer"
                >
                  {currentLang === 'ar' ? 'نسخ الكود' : 'Copy code'}
                </button>
              </div>
              <p className="text-[10px] text-stone-400 leading-snug bg-stone-50 p-2 rounded-lg border border-stone-200">
                {currentLang === 'ar' ? 'بعد الإضافة، سيعطيك التطبيق كوداً من 6 أرقام setiap 30 ثانية. ادخله عند تسجيل الدخول من جهاز جديد.' : 'After adding, the app gives a 6-digit code every 30 seconds. Enter it when signing in from a new device.'}
              </p>
              <button
                type="button"
                onClick={() => { setTotpSetupSecret(null); onClose(); }}
                className="w-full py-3 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                {currentLang === 'ar' ? 'اكتمل الإعداد' : 'Setup complete'}
              </button>
              <button
                type="button"
                onClick={() => { setTotpSetupSecret(null); toStep('auth'); }}
                className="w-full py-2.5 rounded-xl border border-stone-200 bg-white text-stone-600 font-semibold text-xs transition-colors hover:bg-stone-50 cursor-pointer"
              >
                {currentLang === 'ar' ? 'تجاوز الآن' : 'Skip for now'}
              </button>
            </div>
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
                className={`w-full ${rtl ? 'pl-3 pr-9' : 'pl-9 pr-3'} py-2.5 bg-stone-50 border ${!emailValid && email ? 'border-rose-500' : 'border-stone-200'} rounded-xl text-stone-900 focus:outline-none focus:border-amber-700 text-left font-mono`}
                dir="ltr"
              />
              {!email && !emailValid ? null : email && !emailValid ? (
                <p className="text-[10px] text-rose-600 mt-1">{currentLang === 'ar' ? 'اكتب بريداً صالحاً (مثل perfumer@domain.com)' : 'Please enter a valid e-mail (e.g. perfumer@domain.com)'}</p>
              ) : null}
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
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute ${rtl ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer`}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {mode === 'register' && password.length > 0 && (
              <div className="mt-2 space-y-1.5">
                <div className="grid grid-cols-4 gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className={`h-1.5 rounded-full ${i < pwScore ? (pwScore >= 3 ? 'bg-emerald-500' : pwScore === 2 ? 'bg-amber-500' : 'bg-rose-500') : 'bg-stone-200'}`} />
                  ))}
                </div>
                <ul className="text-[10px] leading-relaxed space-y-0.5">
                  <li className={password.length >= 8 ? 'text-emerald-600' : 'text-stone-500'}>• {password.length >= 8 ? '✓ ' : ''}{L('err_password').split('،')[0]}</li>
                  <li className={pwOk ? 'text-emerald-600' : 'text-stone-500'}>• {currentLang === 'ar' ? 'لا نسمح بكلمات المرور المنتشرة (مثل 123456، password)' : 'We block common passwords (e.g. 123456, password)'} {pwOk ? '✓' : ''}</li>
                </ul>
              </div>
            )}
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
                  id="enable-2fa"
                  checked={enable2fa}
                  onChange={(e) => { setEnable2fa(e.target.checked); if (e.target.checked) setEnableWhatsApp2fa(false); }}
                  className="mt-0.5 rounded text-amber-700 focus:ring-amber-700 cursor-pointer"
                />
                <label htmlFor="enable-2fa" className="text-[11px] text-stone-600 leading-snug cursor-pointer select-none">
                  {currentLang === 'ar' ? 'تفعيل التحقق بخطوتين (اختياري) — كود من تطبيق المصادقة' : 'Enable two-step verification (optional) — a code from your authenticator app'}
                </label>
              </div>

              {whatsappConfigLoaded && whatsappAvailable && (
                <details className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <summary className="cursor-pointer text-[11px] font-bold text-emerald-950">
                    {L('whatsapp_security_title')}
                  </summary>
                  <div className="mt-3 space-y-2">
                    <label className="flex items-start gap-2 text-[11px] leading-snug text-stone-700">
                      <input type="checkbox" checked={enableWhatsApp2fa} onChange={(e) => { setEnableWhatsApp2fa(e.target.checked); if (e.target.checked) setEnable2fa(false); }} className="mt-0.5 rounded text-emerald-700" />
                      <span>{L('whatsapp_security_consent')}</span>
                    </label>
                    {enableWhatsApp2fa && (
                      <>
                        <input type="tel" inputMode="tel" autoComplete="tel" dir="ltr" required placeholder="+201001234567" value={whatsappPhone} onChange={(e) => setWhatsappPhone(e.target.value)} className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-left font-mono text-xs" aria-label={currentLang === 'ar' ? 'رقم واتساب بالصيغة الدولية' : 'WhatsApp number in international format'} />
                        <p className="text-[10px] leading-relaxed text-stone-600">{L('whatsapp_security_note')}</p>
                      </>
                    )}
                  </div>
                </details>
              )}
              {whatsappConfigLoaded && !whatsappAvailable && (
                <p className="rounded-xl border border-stone-200 bg-stone-50 p-2.5 text-[10px] leading-relaxed text-stone-500">
                  {L(whatsappConfigError ? 'whatsapp_config_unknown' : 'whatsapp_not_configured')}
                </p>
              )}

              {/* Sham Security — Google/Apple/Meta practices visible */}
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-[10px] leading-relaxed text-amber-900">
                <div className="flex items-center gap-1.5 font-bold"><ShieldCheck className="w-3.5 h-3.5 text-amber-700" />{currentLang === 'ar' ? 'حماية شام — كما في جوجل وآبل' : 'Sham Security — Google/Apple grade'}</div>
                <ul className="mt-1 list-disc list-inside space-y-0.5 text-stone-700">
                  <li>{currentLang === 'ar' ? 'كلمة المرور تُفحص ضد 10 آلاف كلمة مسرّبة + تشفير scrypt' : 'Password checked vs 10k breached + scrypt hashing'}</li>
                  <li>{currentLang === 'ar' ? 'قفل الحساب 15 دقيقة بعد 5 محاولات خاطئة' : 'Lockout 15 min after 5 failed attempts'}</li>
                  <li>{currentLang === 'ar' ? 'تحقق بخطوتين + دخول بالبصمة/الوجه (Passkey)' : '2-Step + Passkey (fingerprint/face)'}</li>
                  <li>{currentLang === 'ar' ? 'تنبيه بريد عند دخول جهاز جديد + إدارة الأجهزة من بوابتك' : 'New-device e-mail alert + device management'}</li>
                </ul>
              </div>

            </>
          )}
          </>
          )}

          <div className="pt-2 space-y-2">
            {/* Remember me: session kept in localStorage if on, sessionStorage if off */}
            {mode === 'login' && stage === 'auth' && (
              <div className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  id="remember-me"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="mt-0.5 rounded text-amber-700 focus:ring-amber-700 cursor-pointer"
                />
                <label htmlFor="remember-me" className="text-stone-600 cursor-pointer select-none">
                  {currentLang === 'ar' ? 'تذكرني (احفظ الجلسة)' : 'Remember me'}
                </label>
              </div>
            )}

            {mode === 'login' && stage === 'auth' && webauthnAvailable() && email.includes('@') && (
              <button
                type="button"
                onClick={() => void handlePasskeyLogin()}
                disabled={passkeyBusy}
                className="w-full py-2.5 rounded-xl border border-amber-400 bg-amber-600 text-white font-bold text-xs shadow-md transition-all hover:bg-amber-700 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Fingerprint className="w-3.5 h-3.5 text-amber-200" />
                <span>{passkeyBusy ? '…' : L('passkey_btn')}</span>
              </button>
            )}

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-amber-300" />
              <span>
                {stage === 'phone_setup' ? L('whatsapp_confirm')
                  : stage === 'phone' ? L('totp_submit')
                    : stage === 'totp' ? L('totp_submit')
                  : stage === 'forgot' ? L('send_code')
                  : stage === 'forgot_code' ? L('reset_submit')
                  : mode === 'login' ? L('submit_login') : L('submit_register')}
              </span>
            </button>

            {mode === 'login' && stage === 'auth' && email.includes('@') && (
              <button
                type="button"
                onClick={() => { if (forgotCooldown>0) return; void (async()=>{ const r=await requestPasswordReset(email); if(r.success) setForgotCooldown(60); })(); toStep('forgot'); }}
                className="w-full py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 font-semibold text-xs transition-colors hover:bg-amber-100 cursor-pointer flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                <span>{currentLang === 'ar' ? 'الرابط السحري (بدون كلمة مرور)' : 'Magic link (passwordless)'}</span>
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
