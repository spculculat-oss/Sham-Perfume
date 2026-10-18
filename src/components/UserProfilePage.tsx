import React, { useEffect, useMemo } from 'react';
import {
  User,
  ShieldCheck,
  Clock,
  BookOpen,
  Calculator,
  Pyramid,
  Newspaper,
  Bot,
  Printer,
  Globe,
  Award,
  TrendingUp,
  Lock,
  Eye,
  Calendar,
  MapPin,
  Flame,
  AlertCircle,
  Trash2,
  CreditCard,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { UserProfile } from '../types/auth';
import { 
  getUserExperiences, getUserOrders, getUserAnalytics, updateUserAnalytics, saveUserExperience, clearUserSessionData, UserExperience 
} from '../utils/userExperienceStore';
import { PaymentEnvironmentModal } from './PaymentEnvironmentModal';
import { SupportedLanguage } from '../types/i18n';
import { t } from '../لغات/i18n';
import { LText, makeT, pickArEn, localeDate } from '../لغات/localize';
import { uiLabel } from '../لغات/uiTextL10n';
import { isRTL } from '../لغات/localizedContent';

interface UserProfilePageProps {
  user: UserProfile;
  currentLang: SupportedLanguage;
  isAdmin: boolean;
  onLogout: () => void;
  onClose: () => void;
}

const S = {
  title: {
    ar: 'صفحة حسابي الشخصية',
    en: 'My Personal Profile',
    fr: 'Mon Profil Personnel',
    es: 'Mi Perfil Personal',
    it: 'Mio Profilo Personale',
    de: 'Mein persönliches Profil',
    ru: 'Мой личный профиль',
    zh: '我的个人档案',
    tr: 'Kişisel Profilim',
    fa: 'پروفایل شخصی من',
  },
  subtitle: {
    ar: 'تجاربك وطلباتك المحفوظة بأمان',
    en: 'Your saved experiences & orders - securely stored',
    fr: 'Vos expériences et commandes enregistrées en toute sécurité',
    es: 'Tus experiencias y pedidos guardados de forma segura',
    it: 'Le tue esperienze e ordini salvati in sicurezza',
    de: 'Ihre gespeicherten Erfahrungen & Aufträge - sicher abgelegt',
    ru: 'Ваши сохраненные опыт и заказы - в безопасности',
    zh: '您保存的经验与订单 - 安全存储',
    tr: 'Kaydedilen deneyimleriniz ve siparişleriniz - güvende',
    fa: 'تجارب و سفارشات ذخیره‌شده شما - به‌طور امن',
  },
  welcome: {
    ar: 'أهلاً وسهلاً بك،',
    en: 'Welcome back,',
    fr: 'Bienvenue,',
    es: 'Bienvenido,',
    it: 'Benvenuto,',
    de: 'Willkommen zurück,',
    ru: 'Добро пожаловать,',
    zh: '欢迎您，',
    tr: 'Hoş geldiniz,',
    fa: 'خوش آمدید،',
  },
  emptyExperience: {
    ar: 'لا توجد تجارب حتى الآن. ابدأ بحساب أولuego!',
    en: 'No experiences yet. Start with your first calculation!',
    fr: 'Aucune expérience pour le moment. Commencez avec votre premier calcul!',
    es: 'Aún no hay experiencias. ¡Comienza con tu primer cálculo!',
    it: 'Nessuna esperienza ancora. Inizia con il tuo primo calcolo!',
    de: 'Noch keine Erfahrungen. Beginnen Sie mit Ihrer ersten Berechnung!',
    ru: 'Пока нет опыта. Начните с первого расчета!',
    zh: '还没有经验。从第一次计算开始吧！',
    tr: 'Henüz deneyim yok. İlk hesaplamanızla başlayın!',
    fa: 'هنوز تجربه‌ای نیست. با اولین محاسبه شروع کنید!',
  },
  emptyOrders: {
    ar: 'لا توجد طلبيات محفوظة.',
    en: 'No saved orders.',
    fr: 'Aucune commande enregistrée.',
    es: 'Sin pedidos guardados.',
    it: 'Nessun ordine salvato.',
    de: 'Keine gespeicherten Aufträge.',
    ru: 'Нет сохраненных заказов.',
    zh: '没有保存的订单。',
    tr: 'Kayıtlı sipariş yok.',
    fa: 'هیچ سفارش ذخیره‌شده‌ای.',
  },
  experiences_title: {
    ar: 'تجاربي وانشطتي recent',
    en: 'My Recent Experiences & Activities',
    fr: 'Mes Expériences & Activités Récentes',
    es: 'Mis Experiencias y Actividades Recientes',
    it: 'Le Mie Esperienze & Attività Recenti',
    de: 'Meine Letzten Erfahrungen & Aktivitäten',
    ru: 'Мой Недавний Опыт и Активности',
    zh: '我的最近经验与活动',
    tr: 'Son Deneyimlerim ve Aktivitelerim',
    fa: 'تجربيات و فعالیت‌های اخیر من',
  },
  orders_title: {
    ar: 'طلباتي وحداتي المحفوظة',
    en: 'My Saved Orders & Outputs',
    fr: 'Mes Commandes & Sorties Enregistrées',
    es: 'Mis Pedidos y Salidas Guardados',
    it: 'I Miei Ordini & Output Salvati',
    de: 'Meine Gespeicherten Aufträge & Ausgaben',
    ru: 'Мои Сохраненные Заказы и Выходы',
    zh: '我保存的订单与输出',
    tr: 'Kayıtlı Siparişlerim ve Çıktılarım',
    fa: 'سفارشات و خروج‌های ذخیره‌شده من',
  },
  analytics_title: {
    ar: 'إحصائيات نشاطي',
    en: 'My Activity Statistics',
    fr: 'Statistiques d\'Activité',
    es: 'Estadísticas de Actividad',
    it: 'Statistiche delle Attività',
    de: 'Meine Aktivitätsstatistiken',
    ru: 'Статистика Активности',
    zh: '我的活动统计',
    tr: 'Aktivite İstatistiklerim',
    fa: 'آمار فعالیت من',
  },
  security_badge: {
    ar: 'بياناتك مشفرة و محمية',
    en: 'Your data is encrypted & protected',
    fr: 'Vos données sont chiffrées & protégées',
    es: 'Tus datos están cifrados & protegidos',
    it: 'I Tu Dati Sono Cifrati & Protetti',
    de: 'Ihre Daten sind verschlüsselt & geschützt',
    ru: 'Ваши данные зашифрованы и защищены',
    zh: '您的数据已加密并受保护',
    tr: 'Verileriniz şifrelenmiştir ve korunmaktadır',
    fa: 'داده‌های شما رمزنگاری و محافظت شده',
  },
  action_view: {
    ar: 'عرض التفاصيل',
    en: 'View Details',
    fr: 'Voir les Détails',
    es: 'Ver Detalles',
    it: 'Vedi Dettagli',
    de: 'Details Ansehen',
    ru: 'Смотреть Подробности',
    zh: '查看详情',
    tr: 'Detayları Gör',
    fa: 'مشاهده جزئیات',
  },
  action_logout: {
    ar: 'تسجيل الخروج',
    en: 'Sign Out',
    fr: 'Déconnexion',
    es: 'Cerrar Sesión',
    it: 'Esci',
    de: 'Abmelden',
    ru: 'Выйти',
    zh: '退出登录',
    tr: 'Çıkış Yap',
    fa: 'خروج',
  },
  actions_label: {
    ar: 'الإجراءات',
    en: 'Actions',
    fr: 'Actions',
    es: 'Acciones',
    it: 'Azioni',
    de: 'Aktionen',
    ru: 'Действия',
    zh: '操作',
    tr: 'Eylemler',
    fa: 'اقدام‌ها',
  },
  last_active: {
    ar: 'آخر نشاط',
    en: 'Last Active',
    fr: 'Dernière Activité',
    es: 'Última Actividad',
    it: 'Ultima Attività',
    de: 'Letzte Aktivität',
    ru: 'Последняя Активность',
    zh: '上次活动',
    tr: 'Son Aktivite',
    fa: 'آخر فعالیت',
  },
  member_since: {
    ar: 'عضو منذ',
    en: 'Member since',
    fr: 'Membre depuis',
    es: 'Miembro desde',
    it: 'Membro dal',
    de: 'Mitglied seit',
    ru: 'Участник с',
    zh: '会员自',
    tr: 'Üye olduğundan',
    fa: 'اعضا از',
  },
  stats_formulas: {
    ar: 'الخلطات المحفوظة',
    en: 'Saved Formulas',
    fr: 'Formules Enregistrées',
    es: 'Fórmulas Guardadas',
    it: 'Formule Salvate',
    de: 'Gespeicherte Formeln',
    ru: 'Сохраненные Рецепты',
    zh: '已保存配方',
    tr: 'Kayıtlı Formüller',
    fa: 'فرمول‌های ذخیره‌شده',
  },
  stats_calculations: {
    ar: 'الحسابات الم完成的',
    en: 'Completed Calculations',
    fr: 'Calculs Terminés',
    es: 'Cálculos Completados',
    it: 'Calcoli Completati',
    de: 'Abgeschlossene Berechnungen',
    ru: 'Завершенные Расчеты',
    zh: '完成的计算',
    tr: 'Tamamlanan Hesaplamalar',
    fa: 'محاسبات تکمیل‌شده',
  },
  stats_ai: {
    ar: 'استشارات AI',
    en: 'AI Consultations',
    fr: 'Consultations AI',
    es: 'Consultas IA',
    it: 'Consultazioni AI',
    de: 'KI-Beratungen',
    ru: 'AI Консультации',
    zh: 'AI咨询',
    tr: 'AI Danışmanlıkları',
    fa: 'مشاوره‌های هوش مصنوعی',
  },
  stats_prints: {
    ar: 'بطاقات الطباعة',
    en: 'Printed Spec Sheets',
    fr: 'Fiches Techniques Imprimées',
    es: 'Fichas Técnicas Imprimidas',
    it: 'Scheda Tecnica Stampata',
    de: 'Druckgebene Herstellungsdatenblätter',
    ru: 'Распечатанные Технологические Карты',
    zh: '打印规格单',
    tr: 'Yazdırılan Üretim Kartları',
    fa: 'برگه‌های فنی چاپ‌شده',
  },
  type_formula: {
    ar: 'خلطة محفوظة',
    en: 'Saved Formula',
    fr: 'Formule Enregistrée',
    es: 'Fórmula Guardada',
    it: 'Formula Salvata',
    de: 'Gespeicherte Formel',
    ru: 'Сохраненный Рецепт',
    zh: '已保存配方',
    tr: 'Kayıtlı Formül',
    fa: 'فرمول ذخیره‌شده',
  },
  type_calculation: {
    ar: 'حساب معمل',
    en: 'Laboratory Calculation',
    fr: 'Calcul de Laboratoire',
    es: 'Cálculo de Laboratorio',
    it: 'Calcolo di Laboratorio',
    de: 'Laborberechnung',
    ru: 'Лабораторный Расчет',
    zh: '实验室计算',
    tr: 'Laboratuvar Hesaplaması',
    fa: 'محاسبه آزمایشگاهی',
  },
  type_pyramid: {
    ar: 'هرم عطر',
    en: 'Fragrance Pyramid',
    fr: 'Pyramide de Parfum',
    es: 'Pirámide de Fragancia',
    it: 'Piramide Olfattiva',
    de: 'Duftpyramide',
    ru: 'Ароматная Пирамида',
    zh: '香氛金字塔',
    tr: 'Koku Piramidi',
    fa: 'هرم عطر',
  },
  type_news: {
    ar: 'أخبار عطور',
    en: 'Perfume News Viewed',
    fr: 'Actualité Parfum Vue',
    es: 'Noticia de Perfume Vista',
    it: 'Notizia Profumo Vista',
    de: 'Parfümunews Gesehen',
    ru: 'Новость о Духах Просмотрена',
    zh: '香水新闻已阅',
    tr: 'Koku Haberleri Görüntülenmedi',
    fa: 'اخبار عطر دیده‌شده',
  },
  type_ai: {
    ar: 'استشارة AI',
    en: 'AI Consultation',
    fr: 'Consultation IA',
    es: 'Consulta IA',
    it: 'Consultazione AI',
    de: 'KI-Beratung',
    ru: 'AI Консультация',
    zh: 'AI咨询',
    tr: 'AI Danışmanlığı',
    fa: 'مشاوره هوش مصنوعی',
  },
  type_print: {
    ar: 'بطاقة طباعة',
    en: 'Spec Sheet Printed',
    fr: 'Fiche Technique Imprimée',
    es: 'Ficha Técnica Impresa',
    it: 'Scheda Tecnica Stampata',
    de: 'Herstellungsdatenblatt Gedruckt',
    ru: 'Технологическая Карта Распечатаана',
    zh: '规格单已打印',
    tr: 'Üretim Kartı Yazdırıldı',
    fa: 'برگه فنی چاپ‌شده',
  },
  type_address: {
    ar: 'إعداد العنوان',
    en: 'Address Set',
    fr: 'Adresse Définie',
    es: 'Dirección Configurada',
    it: 'Indirizzo Impostato',
    de: 'Adresse Eingestellt',
    ru: 'Адрес Установлен',
    zh: '地址已设置',
    tr: 'Adres Ayarlandı',
    fa: 'آدرس تنظیم‌شده',
  },
  type_language: {
    ar: 'تغيير اللغة',
    en: 'Language Changed',
    fr: 'Langue Changée',
    es: 'Idioma Cambiado',
    tr: 'Dil Değiştirildi',
    fa: 'تغییر زبان',
    it: 'Lingua Cambiata',
    de: 'Sprache Geändert',
    ru: 'Язык Изменен',
    zh: '语言已更改',
  },
  no_data: {
    ar: 'لا توجد بيانات',
    en: 'No Data',
    fr: 'Pas de Données',
    es: 'Sin Datos',
    it: 'Nessun Dato',
    de: 'Keine Daten',
    ru: 'Нет Данных',
    zh: '无数据',
    tr: 'Veri Yok',
    fa: 'داده ندارم',
  },
  public_note: {
    ar: 'هذه الصفحة خاصة بك وللادارة فقط',
    en: 'This page is private to you and administrators only',
    fr: 'Cette page est privée à vous et aux administrateurs',
    es: 'Esta página es privada para usted y los administradores',
    it: 'Questa pagina è privata per te e per gli amministratori',
    de: 'Diese Seite ist nur für Sie und Administratoren privat',
    ru: 'Эта страница частная для вас и администраторов',
    zh: '此页面仅您和管理员可见',
    tr: 'Bu sayfa yalnızca size ve yöneticiler için özeldir',
    fa: 'این صفحه فقط برای شما و مدیران است',
  },
  admin_warning: {
    ar: 'للمستخدمين فقط',
    en: 'For Users Only',
    fr: 'Pour Les Utilisateurs Seulement',
    es: 'Solo Para Usuarios',
    it: 'Solo Per Gli Utenti',
    de: 'Nur Für Benutzer',
    ru: 'Только Для Пользователей',
    zh: '仅供用户',
    tr: 'Sadece Kullanıcılar İçin',
    fa: 'فقط برای کاربران',
  },
  clear_data: {
    ar: 'مسح جميع البيانات',
    en: 'Clear All Data',
    fr: 'Effacer Toutes les Données',
    es: 'Borrar Todos los Datos',
    it: 'Cancella Tutti i Dati',
    de: 'Alle Daten Löschen',
    ru: 'Очистить Все Данные',
    zh: '清除所有数据',
    tr: 'Tüm Verileri Temizle',
    fa: 'پاک کردن همه داده‌ها',
  },
  confirm_clear: {
    ar: 'are you sure? This will delete all your experiences and orders permanently.',
    en: 'are you sure? This will delete all your experiences and orders permanently.',
    fr: 'Êtes-vous sûr? Cela supprimera définitivement toutes vos expériences et commandes.',
    es: '¿Está seguro? Esto eliminará permanentemente todas sus experiencias y pedidos.',
    it: 'Sei sicuro? Questo eliminerà permanentemente tutte le tue esperienze e ordini.',
    de: 'Sind Sie sicher? Dies wird alle Ihre Erfahrungen und Aufträge dauerhaft löschen.',
    ru: 'Вы уверены? Это удалит все ваши опыт и заказы навсегда.',
    zh: '确定吗？这将永久删除您所有的经验和订单。',
    tr: 'Emin misiniz? Bu, tüm deneyimleriniz ve siparişlerinizi kalıcı olarak silecektir.',
    fa: 'آیا مطمئن هستید؟ این کار تمام تجربیات و سفارشات شما را به‌طور همزمان حذف می‌کند.',
  },
  encrypted_badge: {
    ar: '🔒 مشفر',
    en: '🔒 Encrypted',
    fr: '🔒 Chiffré',
    es: '🔒 Cifrado',
    it: '🔒 Crittato',
    de: '🔒 Verschlüsselt',
    ru: '🔒 Зашифрован',
    zh: '🔒 加密',
    tr: '🔒 Şifrelenmiş',
    fa: '🔒 رمزنگاری‌شده',
  },
  vault_title: {
    ar: 'الدفع الإلكتروني',
    en: 'Online payment',
    fr: 'Paiement en ligne',
    es: 'Pago en línea',
    it: 'Pagamento online',
    de: 'Online-Zahlung',
    ru: 'Онлайн-оплата',
    zh: '在线支付',
    tr: 'Çevrimiçi ödeme',
    fa: 'پرداخت آنلاین',
  },
  vault_subtitle: {
    ar: 'الوسائل المتاحة تظهر عند إتمام الطلب حسب البلد واعتماد الحساب. لا نحفظ بيانات بطاقتك.',
    en: 'Available methods appear at checkout based on country and account approval. We do not store your card details.',
    fr: 'Les moyens disponibles dépendent du pays et du compte approuvé. Nous ne conservons pas vos données de carte.',
    es: 'Los métodos disponibles dependen del país y de la aprobación de la cuenta. No guardamos datos de tarjetas.',
    it: 'I metodi disponibili dipendono dal paese e dall’approvazione del conto. Non memorizziamo i dati della carta.',
    de: 'Verfügbare Methoden hängen von Land und Kontofreigabe ab. Wir speichern keine Kartendaten.',
    ru: 'Доступные способы зависят от страны и одобрения аккаунта. Мы не храним данные карты.',
    zh: '可用方式取决于国家和账户审批，结账时显示。我们不存储卡片信息。',
    tr: 'Kullanılabilir yöntemler ülkeye ve hesap onayına bağlıdır. Kart bilgilerinizi saklamayız.',
    fa: 'روش\u200cهای موجود به کشور و تأیید حساب بستگی دارد و هنگام پرداخت نمایش داده می\u200cشود. اطلاعات کارت را ذخیره نمی\u200cکنیم.',
  },
  vault_manage: {
    ar: 'معلومات الدفع',
    en: 'Payment information',
    fr: 'Informations de paiement',
    es: 'Información de pago',
    it: 'Informazioni di pagamento',
    de: 'Zahlungsinformationen',
    ru: 'Информация об оплате',
    zh: '支付信息',
    tr: 'Ödeme bilgileri',
    fa: 'اطلاعات پرداخت',
  },
};

const experienceIcons: Record<string, React.ReactNode> = {
  formula_saved: <Flame className="w-4 h-4 text-amber-600" />,
  calculation_completed: <Calculator className="w-4 h-4 text-emerald-600" />,
  pyramid_created: <Pyramid className="w-4 h-4 text-violet-600" />,
  news_viewed: <Newspaper className="w-4 h-4 text-blue-600" />,
  ai_consulted: <Bot className="w-4 h-4 text-indigo-600" />,
  spec_printed: <Printer className="w-4 h-4 text-orange-600" />,
  address_set: <MapPin className="w-4 h-4 text-teal-600" />,
  language_changed: <Globe className="w-4 h-4 text-cyan-600" />,
};

const experienceLabels: Record<string, { ar: string; en: string; fr?: string; es?: string; it?: string; de?: string; ru?: string; zh?: string; tr?: string; fa?: string }> = {
  formula_saved: S.type_formula,
  calculation_completed: S.type_calculation,
  pyramid_created: S.type_pyramid,
  news_viewed: S.type_news,
  ai_consulted: S.type_ai,
  spec_printed: S.type_print,
  address_set: S.type_address,
  language_changed: S.type_language,
};

export const UserProfilePage: React.FC<UserProfilePageProps> = ({ user, currentLang, isAdmin, onLogout, onClose }) => {
  const rtl = isRTL(currentLang);
  const L = makeT(currentLang, S);

  const [experiences, setExperiences] = React.useState<ReturnType<typeof getUserExperiences>>([]);
  const [orders, setOrders] = React.useState<ReturnType<typeof getUserOrders>>([]);
  const [analytics, setAnalytics] = React.useState<ReturnType<typeof getUserAnalytics>>(null);
  const [confirmClear, setConfirmClear] = React.useState(false);
  const [showPaymentVault, setShowPaymentVault] = React.useState(false);
  useEffect(() => {
    const exps = getUserExperiences(user.id);
    const ords = getUserOrders(user.id);
    const anls = getUserAnalytics(user.id);
    setExperiences(exps);
    setOrders(ords);
    setAnalytics(anls);
    
    // Update last login
    updateUserAnalytics(user, 'login');
    
    // Re-fetch after update
    const updated = getUserAnalytics(user.id);
    setAnalytics(updated);

  }, [user.id]);

  const handleAddExperience = (type: UserExperience['type'], titleAr: string, titleEn: string, descAr?: string, descEn?: string) => {
    const exp = saveUserExperience(user, {
      type,
      titleAr,
      titleEn,
      descriptionAr: descAr,
      descriptionEn: descEn,
    });
    setExperiences(prev => [exp, ...prev]);
    updateUserAnalytics(user, eventTypeMap[type] || 'login');
  };

  const eventTypeMap: Record<string, 'login' | 'formula' | 'calculation' | 'pyramid' | 'ai' | 'print'> = {
    formula_saved: 'formula',
    calculation_completed: 'calculation',
    pyramid_created: 'pyramid',
    news_viewed: 'login',
    ai_consulted: 'ai',
    spec_printed: 'print',
    address_set: 'login',
    language_changed: 'login',
  };

  const formatDescription = (descAr?: string, descEn?: string) => {
    if (currentLang === 'ar' && descAr) return descAr;
    if (currentLang === 'fr' && (experiences as any).fr) return (experiences as any).fr;
    return descEn || descAr || '';
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-4 animate-in fade-in zoom-in-95 text-stone-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-stone-900 via-stone-850 to-amber-950 text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-base border border-amber-500/30">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold font-serif-luxury">
                {L('title')}
              </h3>
              <p className="text-[11px] text-stone-300">
                {L('subtitle')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold border border-emerald-500/30">
                {L('admin_warning')}
              </span>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-white rounded-lg cursor-pointer"
            >
              <Eye className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* User Info */}
        <div className="p-6 border-b border-stone-200 bg-stone-50">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center font-bold text-xl shadow-md shrink-0">
              {user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-stone-900 text-base truncate">
                {user.name || 'Guest User'}
              </h4>
              <p className="text-xs text-stone-500 font-mono truncate">
                {user.email}
              </p>
              <div className="flex items-center gap-3 mt-2">
                {user.craftLevelLabelAr && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-medium border border-amber-200/50">
                    {user.craftLevelLabelAr}
                  </span>
                )}
                {user.avatar && (
                  <img src={user.avatar} alt="avatar" className="object-cover rounded-full" style={{ width: 64, height: 64 }} />
                )}
                <span className="text-[10px] text-stone-500">
                  {L('member_since')}: {localeDate(currentLang, new Date(user.createdAt || Date.now()))}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[600px] overflow-y-auto">
          {/* Security Badge */}
          <div className="flex items-center gap-2 p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/60">
            <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-xs text-emerald-800 font-medium">
              {L('security_badge')}
            </span>
            <span className="ml-auto px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-semibold">
              {L('encrypted_badge')}
            </span>
          </div>

          {/* Customer Payment Vault & Professional Environment */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-stone-900 via-stone-850 to-amber-950 text-white border border-amber-900/40 shadow-md space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold border border-amber-500/30 shrink-0">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h5 className="font-extrabold text-sm sm:text-base text-white">
                      {L('vault_title')}
                    </h5>
                  </div>
                  <p className="text-[11px] text-stone-300 mt-0.5 max-w-lg">
                    {L('vault_subtitle')}
                  </p>
                </div>
              </div>
            </div>

            {/* Hosted payment information; no invented local-card approval or provider badges. */}
            <button
              type="button"
              onClick={() => setShowPaymentVault(true)}
              className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <CreditCard className="w-4 h-4" />
              <span>{L('vault_manage')}</span>
            </button>
          </div>

          {/* Experiences */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h5 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-amber-700" />
                {L('experiences_title')}
              </h5>
              <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 text-[10px] font-medium">
                {experiences.length} {uiLabel('unit_activities', currentLang)}
              </span>
            </div>
            
            {experiences.length === 0 ? (
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-center">
                <AlertCircle className="w-5 h-5 text-stone-400 mx-auto mb-2" />
                <p className="text-xs text-stone-500">{L('emptyExperience')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {experiences.slice(0, 10).map((exp) => (
                  <div
                    key={exp.id}
                    className={`p-3 rounded-xl border transition-all ${
                      currentLang === 'ar' ? 'bg-white border-stone-200' : 'bg-white border-stone-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                        {experienceIcons[exp.type] || <BookOpen className="w-4 h-4 text-stone-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-stone-900 text-sm">
                            {exp.titleAr || exp.titleEn}
                          </span>
                          {exp.type === 'formula_saved' && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-800 text-[9px] font-bold border border-amber-500/30">
                              FORMULA
                            </span>
                          )}
                          {exp.type === 'ai_consulted' && (
                            <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-800 text-[9px] font-bold border border-indigo-500/30">
                              AI
                            </span>
                          )}
                        </div>
                        {exp.descriptionAr || exp.descriptionEn ? (
                          <p className="text-xs text-stone-500 mt-0.5 truncate">
                            {currentLang === 'ar' ? (exp.descriptionAr || '') : (exp.descriptionEn || '')}
                          </p>
                        ) : null}
                        <div className="flex items-center gap-2 mt-1.5">
                          <Clock className="w-3 h-3 text-stone-400" />
                          <span className="text-[10px] text-stone-400">
                            {localeDate(currentLang, new Date(exp.timestamp), { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <span className="text-[10px] text-stone-300">·</span>
                          <span className="text-[10px] text-stone-400">
                            {exp.id.slice(0, 8).toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Orders */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h5 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                <Printer className="w-4 h-4 text-orange-600" />
                {L('orders_title')}
              </h5>
              <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 text-[10px] font-medium">
                {orders.length} {uiLabel('unit_orders', currentLang)}
              </span>
            </div>
            
            {orders.length === 0 ? (
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-center">
                <AlertCircle className="w-5 h-5 text-stone-400 mx-auto mb-2" />
                <p className="text-xs text-stone-500">{L('emptyOrders')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {orders.slice(0, 10).map((ord) => (
                  <div
                    key={ord.id}
                    className="p-3 rounded-xl bg-white border border-stone-200"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Printer className="w-4 h-4 text-orange-500 shrink-0" />
                        <span className="font-medium text-stone-900 text-sm truncate">
                          {ord.titleAr || ord.titleEn}
                        </span>
                      </div>
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-medium ${
                        ord.status === 'completed' 
                          ? 'bg-emerald-500/20 text-emerald-700 border border-emerald-500/30'
                          : ord.status === 'pending'
                          ? 'bg-amber-500/20 text-amber-700 border border-amber-500/30'
                          : 'bg-red-500/20 text-red-700 border border-red-500/30'
                      }`}>
                        {ord.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-stone-400">
                      <Calendar className="w-3 h-3" />
                      <span>{localeDate(currentLang, new Date(ord.timestamp))}</span>
                      {ord.type && (
                        <span className="px-1.5 py-0.2 rounded bg-stone-100 text-stone-500 border border-stone-200">
                          {ord.type}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Analytics */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h5 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                {L('analytics_title')}
              </h5>
            </div>
            
            {analytics ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200/50">
                  <div className="flex items-center gap-1.5 text-amber-800 text-sm font-bold">
                    <Award className="w-4 h-4" />
                    {analytics.totalFormulas}
                  </div>
                  <p className="text-[10px] text-amber-700 font-medium mt-0.5">
                    {L('stats_formulas')}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200/50">
                  <div className="flex items-center gap-1.5 text-emerald-800 text-sm font-bold">
                    <Calculator className="w-4 h-4" />
                    {analytics.totalCalculations}
                  </div>
                  <p className="text-[10px] text-emerald-700 font-medium mt-0.5">
                    {L('stats_calculations')}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/50 border border-indigo-200/50">
                  <div className="flex items-center gap-1.5 text-indigo-800 text-sm font-bold">
                    <Bot className="w-4 h-4" />
                    {analytics.totalAIConsultations}
                  </div>
                  <p className="text-[10px] text-indigo-700 font-medium mt-0.5">
                    {L('stats_ai')}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-orange-50 to-orange-100/50 border border-orange-200/50">
                  <div className="flex items-center gap-1.5 text-orange-800 text-sm font-bold">
                    <Printer className="w-4 h-4" />
                    {analytics.totalSpecPrints}
                  </div>
                  <p className="text-[10px] text-orange-700 font-medium mt-0.5">
                    {L('stats_prints')}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-center">
                <p className="text-xs text-stone-500">{L('no_data')}</p>
              </div>
            )}
          </div>

          {/* Private note */}
          <div className="p-3 rounded-xl bg-stone-100 border border-stone-200/80 text-center">
            <p className="text-[10px] text-stone-500 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              {L('public_note')}
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-amber-800 hover:bg-amber-900 rounded-xl transition-all shadow-sm cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-amber-200" />
              {L('action_logout')}
            </button>
          </div>
          <div className="flex items-center gap-2">
            {confirmClear ? (
              <>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="px-3 py-2 text-xs font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
                >
                  {uiLabel('cancel', currentLang)}
                </button>
                <button
                  onClick={() => {
                    clearUserSessionData(user.id);
                    onLogout();
                  }}
                  className="px-3 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer"
                >
                  {L('clear_data')}
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {L('clear_data')}
              </button>
            )}
          </div>
        </div>
      </div>

      {showPaymentVault && (
        <PaymentEnvironmentModal
          currentLang={currentLang}
          customerId={user.id}
          customerName={user.name || user.email}
          onClose={() => setShowPaymentVault(false)}
        />
      )}
    </div>
  );
};
