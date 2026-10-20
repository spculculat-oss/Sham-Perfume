import React, { useState, useRef, useEffect } from 'react';
import {
  Printer,
  Sparkles,
  Shield,
  Newspaper,
  FlaskConical,
  User,
  ShieldCheck,
  Compass,
  LogOut,
  ChevronDown,
  Globe,
  Database,
  Bookmark,
  MapPin,
  Home,
  Store,
  Users,
  Atom,
} from 'lucide-react';
import { SupportedLanguage } from '../types/i18n';
import { t } from '../لغات/i18n';
import { LanguageSelector } from './LanguageSelector';
import { AdminMerchantManagement } from './AdminMerchantManagement';
import { UserProfile } from '../types/auth';
import { UserEnvironmentProfile } from '../utils/environmentAdapter';
import { LText, makeT, pickArEn } from '../لغات/localize';
import { uiLabel } from '../لغات/uiTextL10n';


const S = {
  home_tooltip: { ar: 'العودة للصفحة الرئيسية', en: 'Back to Home', fr: 'Retour à l’accueil', es: 'Volver al inicio', it: 'Torna alla home', de: 'Zurück zur Startseite', ru: 'На главную', zh: '返回首页', tr: 'Ana sayfaya dön', fa: 'بازگشت به صفحه اصلی', is: 'Aftur á forsíðu', sq: 'Kthehu në faqen kryesore', ps: 'کورپاڼې ته ورشئ' },
  home_btn: { ar: 'الرئيسية ⌂', en: 'Home ⌂', fr: 'Accueil ⌂', es: 'Inicio ⌂', it: 'Home ⌂', de: 'Start ⌂', ru: 'Главная ⌂', zh: '首页 ⌂', tr: 'Ana Sayfa ⌂', fa: 'خانه ⌂', is: 'Heim ⌂', sq: 'Kryefaqja ⌂', ps: 'کورپاڼه ⌂' },
  country_tooltip: { ar: 'تحديد البلد والمقر والعنوان التفصيلي للمعمل', en: 'Set country, facility, and detailed address', fr: 'Définir pays, établissement et adresse', es: 'Configurar país, instalación y dirección', it: 'Imposta paese, struttura e indirizzo', de: 'Land, Standort und Adresse festlegen', ru: 'Указать страну и адрес лаборатории', zh: '设置国家、实验室与详细地址', tr: 'Ülke, tesis ve adresi belirle', fa: 'تعیین کشور، مقر و نشانی تفصیلی', is: 'Veldu land, rannsóknarstofu og heimilisfang', sq: 'Cakto shtetin, laboratorin dhe adresën', ps: 'هېواد، لابراتوار او پته وټاکئ' },
  privacy_tooltip: { ar: 'حماية وخصوصية بيانات المستخدم (GDPR)', en: 'User data protection & privacy (GDPR)', fr: 'Protection des données (RGPD)', es: 'Protección de datos (GDPR)', it: 'Protezione dei dati (GDPR)', de: 'Datenschutz (DSGVO)', ru: 'Защита данных (GDPR)', zh: '用户数据保护与隐私（GDPR）', tr: 'Veri koruma ve gizlilik (GDPR)', fa: 'حفاظت و حریم خصوصی داده‌ها (GDPR)', is: 'Persónuvernd og vernd notendagagna', sq: 'Mbrojtja dhe privatësia e të dhënave', ps: 'د کارن معلوماتو ساتنه او محرمیت' },
  privacy_btn: { ar: 'الخصوصية', en: 'Privacy', fr: 'Confidentialité', es: 'Privacidad', it: 'Privacy', de: 'Datenschutz', ru: 'Приватность', zh: '隐私', tr: 'Gizlilik', fa: 'حریم خصوصی', is: 'Persónuvernd', sq: 'Privatësia', ps: 'محرمیت' },
  menu_data_backup: { ar: 'حماية البيانات والنسخ الاحتياطي', en: 'Data protection & backup', fr: 'Protection et sauvegarde des données', es: 'Protección y respaldo de datos', it: 'Protezione e backup dei dati', de: 'Datenschutz & Backup', ru: 'Защита и резервное копирование', zh: '数据保护与备份', tr: 'Veri koruma ve yedekleme', fa: 'حفاظت داده و پشتیبان‌گیری', is: 'Gagnavernd og afritun', sq: 'Mbrojtja dhe kopja rezervë e të dhënave', ps: 'د معلوماتو ساتنه او بیک اپ' },
  menu_country: { ar: 'تحديد البلد والعنوان ومقر المعمل', en: 'Set country, address & facility', fr: 'Pays, adresse et établissement', es: 'País, dirección e instalación', it: 'Paese, indirizzo e struttura', de: 'Land, Adresse & Standort', ru: 'Страна, адрес и лаборатория', zh: '设置国家、地址与实验室', tr: 'Ülke, adres ve tesis', fa: 'تعیین کشور، نشانی و مقر', is: 'Veldu land, heimilisfang og rannsóknarstofu', sq: 'Cakto shtetin, adresën dhe laboratorin', ps: 'هېواد، پته او لابراتوار وټاکئ' },
  logout: { ar: 'تسجيل الخروج', en: 'Log out', fr: 'Déconnexion', es: 'Cerrar sesión', it: 'Esci', de: 'Abmelden', ru: 'Выйти', zh: '退出登录', tr: 'Çıkış yap', fa: 'خروج از حساب', is: 'Skrá út', sq: 'Dil', ps: 'وتل' },
  login: { ar: 'تسجيل الدخول', en: 'Log in', fr: 'Connexion', es: 'Iniciar sesión', it: 'Accedi', de: 'Anmelden', ru: 'Войти', zh: '登录', tr: 'Giriş yap', fa: 'ورود', is: 'Skrá inn', sq: 'Hyr', ps: 'ننوتل' },
  print_tooltip: { ar: 'طباعة بطاقة تصنيع العطر', en: 'Print manufacturing spec sheet', fr: 'Imprimer la fiche de fabrication', es: 'Imprimir hoja de fabricación', it: 'Stampa scheda di produzione', de: 'Produktionsblatt drucken', ru: 'Печать производственной карты', zh: '打印生产规格表', tr: 'Üretim föyünü yazdır', fa: 'چاپ کارت تولید عطر', is: 'Prenta framleiðslulýsingu', sq: 'Printo fletën e prodhimit', ps: 'د تولید مشخصات چاپ کړئ' },
  print_btn: { ar: 'طباعة', en: 'Print', fr: 'Imprimer', es: 'Imprimir', it: 'Stampa', de: 'Drucken', ru: 'Печать', zh: '打印', tr: 'Yazdır', fa: 'چاپ', is: 'Prenta', sq: 'Printo', ps: 'چاپ' },
  profile_tooltip: { ar: 'صفحتي الشخصية وبياناتي', en: 'My personal profile & data', fr: 'Mon profil et mes données', es: 'Mi perfil y datos personales', it: 'Il mio profilo personale', de: 'Mein Profil & Daten', ru: 'Мой профиль и данные', zh: '我的个人主页与数据', tr: 'Kişisel profilim ve verilerim', fa: 'پروفایل و داده‌های شخصی من', is: 'Persónuleg síða og gögn', sq: 'Profili dhe të dhënat e mia', ps: 'زما پروفایل او معلومات' },
  profile_btn: { ar: 'حسابي', en: 'My Profile', fr: 'Mon Profil', es: 'Mi Perfil', it: 'Il Mio Profilo', de: 'Mein Profil', ru: 'Мой Профиль', zh: '我的个人主页', tr: 'Kişisel Profilim', fa: 'پروفایل من', is: 'Prófíllinn minn', sq: 'Profili im', ps: 'زما پروفایل' },
  craft_hobbyist: { ar: 'هاوي', en: 'Hobbyist', fr: 'Amateur', es: 'Aficionado', it: 'Hobbista', de: 'Hobbyist', ru: 'Любитель', zh: '爱好者', tr: 'Hobi amaçlı', fa: 'علاقه‌مند', is: 'Áhugamaður', sq: 'Amator', ps: 'شوقي' },
  craft_perfumer: { ar: 'عطّار', en: 'Perfumer', fr: 'Parfumeur', es: 'Perfumista', it: 'Profumiere', de: 'Parfümeur', ru: 'Парфюмер', zh: '调香师', tr: 'Parfümör', fa: 'عطرساز', is: 'Ilmgerðarmaður', sq: 'Parfumier', ps: 'عطر جوړوونکی' },
  craft_master: { ar: 'خبير معمل', en: 'Master perfumer', fr: 'Maître parfumeur', es: 'Maestro perfumista', it: 'Maestro profumiere', de: 'Meisterparfümeur', ru: 'Мастер-парфюмер', zh: '调香大师', tr: 'Usta parfümör', fa: 'استاد عطرساز', is: 'Meistari í ilmgerð', sq: 'Parfumier mjeshtër', ps: 'ماهر عطر جوړوونکی' },
  user_menu: { ar: 'قائمة حساب المستخدم', en: 'User account menu', fr: 'Menu du compte utilisateur', es: 'Menú de la cuenta de usuario', it: 'Menu dell’account utente', de: 'Benutzermenü', ru: 'Меню пользователя', zh: '用户账户菜单', tr: 'Kullanıcı hesabı menüsü', fa: 'فهرست حساب کاربری', is: 'Notandavalmynd', sq: 'Menyja e llogarisë', ps: 'د کارن حساب مینو' },
  primary_navigation: { ar: 'التنقل الرئيسي', en: 'Primary navigation', fr: 'Navigation principale', es: 'Navegación principal', it: 'Navigazione principale', de: 'Hauptnavigation', ru: 'Основная навигация', zh: '主导航', tr: 'Ana gezinme', fa: 'ناوبری اصلی', is: 'Aðalvalmynd', sq: 'Navigimi kryesor', ps: 'اصلي نیویګیشن' },
  nav_scroll_hint: { ar: 'اسحب أفقياً لاستعراض بقية عناصر التنقل', en: 'Scroll horizontally to see more navigation', fr: 'Faites défiler horizontalement pour voir la suite', es: 'Desplázate horizontalmente para ver más opciones', it: 'Scorri orizzontalmente per vedere altre voci', de: 'Horizontal scrollen, um weitere Navigation zu sehen', ru: 'Прокрутите по горизонтали, чтобы увидеть остальные разделы', zh: '横向滚动以查看其他导航项', tr: 'Diğer gezinme öğeleri için yatay kaydırın', fa: 'برای دیدن گزینه‌های بیشتر افقی پیمایش کنید', is: 'Skrunaðu lárétt til að sjá fleiri valkosti', sq: 'Rrëshqit horizontalisht për të parë më shumë opsione', ps: 'د نورو انتخابونو لپاره افقي سکرول وکړئ' },
} satisfies Record<string, LText>;

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenPrintModal: () => void;
  currentLang: SupportedLanguage;
  onSelectLanguage: (lang: SupportedLanguage) => void;
  onAutoDetectLanguage?: () => void;
  currentUser: UserProfile | null;
  onOpenAuthModal: () => void;
  onLogout: () => void;
  currentEnvironment: UserEnvironmentProfile;
  onOpenEnvironmentModal: () => void;
  onOpenPrivacyModal: () => void;
  onOpenProfilePage: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenPrintModal,
  currentLang,
  onSelectLanguage,
  onAutoDetectLanguage,
  currentUser,
  onOpenAuthModal,
  onLogout,
  currentEnvironment,
  onOpenEnvironmentModal,
  onOpenPrivacyModal,
  onOpenProfilePage,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const appHeaderRef = useRef<HTMLElement>(null);
  const L = makeT(currentLang, S);

  useEffect(() => {
    const header = appHeaderRef.current;
    if (!header) return;
    const updateStickyOffset = () => {
      document.documentElement.style.setProperty('--sham-global-header-height', `${Math.ceil(header.getBoundingClientRect().height)}px`);
    };
    updateStickyOffset();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateStickyOffset) : undefined;
    observer?.observe(header);
    window.addEventListener('resize', updateStickyOffset);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateStickyOffset);
      document.documentElement.style.removeProperty('--sham-global-header-height');
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
      // Close navigation dropdowns only if click is outside any nav group
      if (!target?.closest('[data-nav-group]')) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Smart navigation groups keep tool and reference destinations in compact sections.
  const navGroups = [
    {
      id: 'home',
      type: 'single',
      label: t('nav_home_short', currentLang, t('nav_home', currentLang)),
      fullLabel: t('nav_home', currentLang),
      icon: Home,
      iconColor: 'text-amber-700',
    },
    {
      id: 'tools',
      type: 'dropdown',
      label: t('nav_tools_short', currentLang, t('nav_tools', currentLang)),
      fullLabel: t('nav_tools', currentLang),
      icon: FlaskConical,
      iconColor: 'text-amber-600',
      items: [
        { id: 'concentration', label: t('nav_calc_short', currentLang, t('nav_calc', currentLang)), fullLabel: t('nav_calc', currentLang), icon: FlaskConical },
        { id: 'library', label: uiLabel('user_formulations', currentLang), fullLabel: uiLabel('user_formulations', currentLang), icon: Bookmark },
        { id: 'molecule_studio', label: uiLabel('molecule_studio', currentLang), fullLabel: uiLabel('molecule_studio', currentLang), icon: Atom, isNew: true },
        { id: 'alcohol', label: t('nav_alcohol_short', currentLang, t('nav_alcohol', currentLang)), fullLabel: t('nav_alcohol', currentLang), icon: FlaskConical },
        { id: 'costing', label: t('nav_costing_short', currentLang, t('nav_costing', currentLang)), fullLabel: t('nav_costing', currentLang), icon: Newspaper },
        { id: 'maceration_simulator', label: t('nav_maceration_short', currentLang, t('nav_maceration', currentLang)), fullLabel: t('nav_maceration', currentLang, 'محاكي التعتيق الزمني'), icon: FlaskConical },
      ],
    },
    {
      id: 'explore',
      type: 'dropdown',
      label: t('nav_explore_short', currentLang, t('nav_explore', currentLang)),
      fullLabel: t('nav_explore', currentLang),
      icon: Compass,
      iconColor: 'text-amber-600',
      items: [
        { id: 'perfume_news', label: t('nav_news_short', currentLang, t('nav_news', currentLang)), fullLabel: t('nav_news', currentLang), icon: Newspaper, isNew: true },
        { id: 'world_perfumes', label: t('nav_world_perfumes_short', currentLang, t('nav_world_perfumes', currentLang)), fullLabel: t('nav_world_perfumes', currentLang), icon: Compass },
        { id: 'pyramid', label: t('nav_pyramid_short', currentLang, t('nav_pyramid', currentLang)), fullLabel: t('nav_pyramid', currentLang), icon: Compass },
        { id: 'raw_materials', label: t('nav_raw_materials_short', currentLang, t('nav_raw_materials', currentLang)), fullLabel: t('nav_raw_materials', currentLang), icon: Database },
        { id: 'guide', label: t('nav_guide_short', currentLang, t('nav_guide', currentLang)), fullLabel: t('nav_guide', currentLang), icon: Newspaper },
      ],
    },
    {
      id: 'master_ai',
      type: 'single',
      label: t('nav_ai_master_short', currentLang, t('nav_ai_master', currentLang)),
      fullLabel: t('nav_ai_master', currentLang),
      icon: Sparkles,
      iconColor: 'text-emerald-500',
    },
    {
      id: 'community',
      type: 'single',
      label: t('nav_community_short', currentLang, currentLang === 'ar' ? 'المجتمع' : 'Community'),
      fullLabel: t('nav_community', currentLang, currentLang === 'ar' ? 'مجتمع شام — السوشيال والماسنجر وبوابات الأعضاء والتجار' : 'Sham Community — social, messenger, member and merchant portals'),
      icon: Users,
      iconColor: 'text-rose-500',
    },
    {
      id: 'store',
      type: 'single',
      label: t('nav_store_short', currentLang, currentLang === 'ar' ? 'التسوق' : 'Shop'),
      fullLabel: t('nav_store', currentLang, currentLang === 'ar' ? 'متجر الشام - العطور' : 'Sham Perfume Store'),
      icon: Store,
      iconColor: 'text-amber-600',
    },
  ];
  const craftLevelLabels = {
    hobbyist: L('craft_hobbyist'),
    perfumer: L('craft_perfumer'),
    master_lab: L('craft_master'),
  };
  const userCraftLevelLabel = currentUser
    ? (currentLang === 'ar' && currentUser.craftLevelLabelAr ? currentUser.craftLevelLabelAr : craftLevelLabels[currentUser.craftLevel])
    : '';

  return (
    <>
    <header ref={appHeaderRef} className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200/80 px-3 sm:px-8 py-2.5 no-print shadow-xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-1 sm:gap-4">
        
        {/* Zone 1: Brand wordmark: صمم عطرك مع شام */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 sm:shrink-0">
          <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-stone-900 to-amber-950 text-amber-400 flex items-center justify-center font-serif-luxury font-bold text-lg shadow-md border border-amber-600/30">
            شام
          </div>
          <button 
            onClick={() => setActiveTab('home')}
            className="text-start flex flex-col items-start cursor-pointer group min-w-0"
          >
            <span className="max-w-full truncate text-[15px] sm:text-lg font-extrabold tracking-tight text-stone-950 group-hover:text-amber-800 transition-colors font-serif-luxury">
              {t('brand_name', currentLang)}
            </span>
            <span className="text-[10px] text-amber-700 font-medium hidden sm:inline whitespace-nowrap">
              {t('brand_subtitle', currentLang)}
            </span>
          </button>

          {/* Quick Return to Home Button when inside any sub-section */}
          {activeTab !== 'home' && (
            <button
              onClick={() => setActiveTab('home')}
              className="hidden sm:flex shrink-0 items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold shadow-xs transition-all cursor-pointer me-1 animate-in fade-in"
              title={L('home_tooltip')}
            >
              <Home className="w-3.5 h-3.5 text-amber-300" />
              <span className="hidden sm:inline text-[11px]">{L('home_btn')}</span>
            </button>
          )}
        </div>

        {/* Zone 2: Navigation links - Compact icon-only bar with dropdowns */}
        <nav aria-label={L('primary_navigation')} className="hidden xl:block relative flex items-center justify-center py-1">
          {/* Logical edge fades frame the compact navigation in both reading directions. */}
          <div aria-hidden="true" className="absolute start-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white/95 to-transparent pointer-events-none z-10 rtl:bg-gradient-to-l"></div>
          <div aria-hidden="true" className="absolute end-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white/95 to-transparent pointer-events-none z-10 rtl:bg-gradient-to-r"></div>
          <div className="flex items-center gap-1.5 relative z-20">
            {navGroups.map((group) => (
              group.type === 'single' ? (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(group.id);
                    setOpenDropdownId(null);
                  }}
                  className={`transition-all py-1.5 px-2.5 rounded-lg flex items-center gap-1.5 cursor-pointer ${
                    (activeTab === group.id || activeTab.startsWith(`${group.id}/`))
                      ? 'text-stone-950 font-bold bg-stone-100 shadow-2xs border border-stone-200/80'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                  }`}
                  title={group.fullLabel}
                  aria-label={group.fullLabel}
                  aria-current={activeTab === group.id || activeTab.startsWith(`${group.id}/`) ? 'page' : undefined}
                >
                  <group.icon className={`w-4.5 h-4.5 ${group.iconColor} shrink-0`} />
                </button>
              ) : (
                <div key={group.id} className="relative" data-nav-group="true">
                  <button
                    type="button"
                    onClick={() => setOpenDropdownId(prev => prev === group.id ? null : group.id)}
                    className={`transition-all py-1.5 px-2.5 rounded-lg flex items-center gap-1 cursor-pointer ${
                      openDropdownId === group.id || group.items?.some(it => activeTab === it.id)
                        ? 'text-stone-950 font-bold bg-stone-100 shadow-2xs border border-stone-200/80'
                        : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                    }`}
                    title={group.fullLabel}
                    aria-label={group.fullLabel}
                    aria-haspopup="true"
                    aria-expanded={openDropdownId === group.id}
                    aria-controls={openDropdownId === group.id ? `desktop-nav-menu-${group.id}` : undefined}
                  >
                    <group.icon className={`w-4.5 h-4.5 ${group.iconColor} shrink-0`} />
                    <span className="text-xs font-semibold text-stone-800">{group.label}</span>
                    <span className="px-1 py-0 rounded-full bg-amber-700 text-white text-[9px] font-bold leading-none">
                      {group.items?.length}
                    </span>
                    <ChevronDown className={`w-3 h-3 text-stone-600 ms-0.5 shrink-0 transition-transform duration-200 ${openDropdownId === group.id ? 'rotate-180' : ''}`} />
                  </button>
                  {openDropdownId === group.id && (
                    <div id={`desktop-nav-menu-${group.id}`} className="absolute top-full mt-2 z-50 min-w-[280px] rounded-xl bg-white border border-stone-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 ltr:left-0 rtl:right-0">
                      <div className="px-3 py-2 bg-amber-50 border-b border-amber-100 rounded-t-xl">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${group.iconColor?.replace('text-emerald-500', 'bg-emerald-500').replace('text-amber-700', 'bg-amber-500').replace('text-amber-600', 'bg-amber-500')}`}></div>
                          <span className="text-xs font-bold text-amber-900">{group.fullLabel}</span>
                          <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-700 text-[10px] font-medium border border-amber-500/30">
                            {group.items?.length} {uiLabel('unit_tools', currentLang)}
                          </span>
                        </div>
                        <p className="text-[10px] text-amber-700 mt-0.5 leading-tight text-start">
                          {group.id === 'tools' && uiLabel('group_tools_desc', currentLang)}
                          {group.id === 'explore' && uiLabel('group_explore_desc', currentLang)}
                          {group.id === 'home' && uiLabel('group_home_desc', currentLang)}
                          {group.id === 'master_ai' && uiLabel('group_ai_desc', currentLang)}
                        </p>
                      </div>
                      <div className="p-1 space-y-0.5 max-h-[calc(100vh-140px)] overflow-y-auto">
                        {group.items?.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setActiveTab(item.id);
                              setOpenDropdownId(null);
                            }}
                            className={`w-full px-3 py-2 text-start flex items-center justify-between gap-2.5 transition-colors cursor-pointer rounded-lg ${
                              activeTab === item.id
                                ? 'bg-amber-50 text-amber-900 font-semibold border-s-3 border-amber-500 ps-3'
                                : 'hover:bg-stone-50 text-stone-700'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <item.icon className={`w-4 h-4 shrink-0 ${activeTab === item.id ? 'text-amber-700' : 'text-stone-500'}`} />
                              <span className="text-sm font-medium truncate">{item.fullLabel}</span>
                            </div>
                            {item.isNew && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-800 text-[10px] font-bold border border-amber-500/30 shrink-0">
                                NEW
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                      <div className="mt-1 pt-1 border-t border-stone-100">
                        <button
                          type="button"
                          onClick={() => setOpenDropdownId(null)}
                          className="w-full px-3 py-1.5 text-center text-xs text-stone-500 hover:text-stone-700 hover:bg-stone-50 rounded-lg transition-colors cursor-pointer"
                        >
                          {uiLabel('close_menu', currentLang)}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            ))}
          </div>
        </nav>

        {/* Zone 3: Global Controls (Language, Environment/Homeland, User Auth, Privacy, Print) */}
        <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
          
          {/* 1. Unified languages button — the only language list in the platform */}
          <LanguageSelector
            currentLang={currentLang}
            onSelectLanguage={onSelectLanguage}
            onAutoDetectLanguage={onAutoDetectLanguage}
            className="shrink-0"
          />

          {/* 2. Country & Detailed Address Selector */}
          <button
            onClick={onOpenEnvironmentModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50/90 hover:bg-amber-100 text-stone-900 text-xs font-semibold transition-all shadow-2xs cursor-pointer"
            title={L('country_tooltip')}
            aria-label={L('country_tooltip')}
          >
            <span className="text-base leading-none">
              {currentEnvironment.countryFlag || '🌍'}
            </span>
            <span className="hidden lg:inline truncate max-w-[120px] font-bold">
              {pickArEn(currentLang, currentEnvironment.countryNameAr, currentEnvironment.countryNameEn).split('(')[0].trim()}
            </span>
            <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded bg-amber-200/80 text-[10px] font-mono font-bold text-amber-950">
              {pickArEn(currentLang, currentEnvironment.currencySymbolAr, currentEnvironment.currencySymbolEn)}
            </span>
          </button>

          {/* 3. Data Privacy & GDPR Button */}
          <button
            onClick={onOpenPrivacyModal}
            className="p-1.5 sm:px-2 sm:py-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 text-stone-600 text-xs transition-all shadow-2xs cursor-pointer flex items-center gap-1"
            title={L('privacy_tooltip')}
            aria-label={L('privacy_btn')}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="hidden lg:inline text-[11px] font-medium">{L('privacy_btn')}</span>
          </button>

          {/* 4. User Profile & Login System */}
          {currentUser ? (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition-all shadow-sm cursor-pointer"
                aria-label={`${L('user_menu')}: ${currentUser.name}`}
                aria-haspopup="true"
                aria-expanded={isUserMenuOpen}
                aria-controls={isUserMenuOpen ? 'header-user-menu' : undefined}
              >
                <div className="w-5 h-5 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center font-bold text-[10px]">
                  {currentUser.name.slice(0, 1)}
                </div>
                <span className="hidden sm:inline truncate max-w-[90px]">{currentUser.name}</span>
                <ChevronDown className="w-3 h-3 text-stone-200" />
              </button>

              {isUserMenuOpen && (
                <div id="header-user-menu" className="absolute top-full mt-2 z-50 w-64 max-w-[calc(100vw-1rem)] rounded-2xl bg-white border border-stone-200 shadow-xl overflow-hidden py-2 text-xs text-stone-800 animate-in fade-in zoom-in-95 ltr:right-0 ltr:left-auto rtl:left-0 rtl:right-auto">
                  <div className="px-4 py-3 border-b border-stone-100 bg-stone-50">
                    <div className="font-bold text-stone-900 text-sm">{currentUser.name}</div>
                    <div className="text-[11px] text-stone-500 font-mono">{currentUser.email}</div>
                    <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-bold">
                      <Sparkles className="w-3 h-3 text-amber-700" />
                      <span>{userCraftLevelLabel}</span>
                    </div>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenProfilePage();
                      }}
                      className="w-full px-4 py-2 text-start hover:bg-stone-50 flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <User className="w-4 h-4 text-emerald-700" />
                        <span>{L('profile_btn')}</span>
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenPrivacyModal();
                      }}
                      className="w-full px-4 py-2 text-start hover:bg-stone-50 flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>{L('menu_data_backup')}</span>
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenEnvironmentModal();
                      }}
                      className="w-full px-4 py-2 text-start hover:bg-stone-50 flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-amber-700" />
                        <span>{L('menu_country')}</span>
                      </span>
                    </button>
                  </div>

                  <div className="border-t border-stone-100 pt-1 mt-1">
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full px-4 py-2 text-start text-red-600 hover:bg-red-50 flex items-center gap-2 font-semibold cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>{L('logout')}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 text-xs font-semibold text-white bg-amber-800 hover:bg-amber-900 rounded-xl transition-all shadow-sm cursor-pointer shrink-0"
              aria-label={L('login')}
              title={L('login')}
            >
              <User className="w-3.5 h-3.5 text-amber-200" />
              <span className="hidden md:inline">{L('login')}</span>
            </button>
          )}

          {/* 5. Admin Dashboard Button — only for admin users */}
          {currentUser?.isAdmin && (
            <button
              onClick={() => setShowAdminModal(true)}
              className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-xl transition-all shadow-sm cursor-pointer shrink-0"
              title={uiLabel('admin_panel_title', currentLang)}
              aria-label={uiLabel('admin_panel_title', currentLang)}
            >
              <Shield className="w-3.5 h-3.5 text-purple-200" />
              <span className="hidden xl:inline">{uiLabel('admin_panel', currentLang)}</span>
            </button>
          )}

          {/* 6. Print Spec Sheet */}
          <button
            onClick={onOpenPrintModal}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200/80 rounded-xl transition-all cursor-pointer border border-stone-200 shrink-0"
            title={L('print_tooltip')}
            aria-label={L('print_tooltip')}
          >
            <Printer className="w-3.5 h-3.5 text-amber-700" />
            <span className="hidden xl:inline">{L('print_btn')}</span>
          </button>

          {/* 5. My Profile Button - Personal page shortcut */}
          {currentUser && (
            <button
              onClick={onOpenProfilePage}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-all shadow-sm cursor-pointer shrink-0"
              title={L('profile_tooltip')}
              aria-label={L('profile_tooltip')}
            >
              <User className="w-3.5 h-3.5 text-white" />
              <span className="hidden xl:inline">{L('profile_btn')}</span>
            </button>
          )}

        </div>
      </div>

      {/* Mobile & Tablet Navigation — keep every destination reachable without shrinking labels. */}
      <nav aria-label={L('primary_navigation')} className="xl:hidden relative" data-nav-group="true">
        <div className="relative -mx-3 sm:mx-0 mt-2 border-t border-stone-100">
          <div
            role="region"
            aria-label={L('nav_scroll_hint')}
            tabIndex={0}
            className="flex items-center gap-2 overflow-x-auto pt-2 px-3 sm:px-0 text-xs no-scrollbar focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-600"
          >
          {/* Mobile nav groups as scrollable pills */}
          {navGroups.map((group) => {
            if (group.type === 'single') {
              const isActive = activeTab === group.id || activeTab.startsWith(`${group.id}/`);
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(group.id);
                    setOpenDropdownId(null);
                  }}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-lg flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-amber-900 text-white font-bold shadow-xs'
                      : 'text-stone-700 hover:text-stone-900 bg-stone-100/90 font-medium'
                  }`}
                  title={group.fullLabel}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <group.icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-amber-300' : group.iconColor}`} />
                  <span className="text-xs">{group.label}</span>
                </button>
              );
            }
            const isGroupActive = group.items?.some((it) => activeTab === it.id);
            const isOpen = openDropdownId === group.id;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => setOpenDropdownId(prev => prev === group.id ? null : group.id)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-lg flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors ${
                  isOpen || isGroupActive
                    ? 'bg-amber-900 text-white font-bold shadow-xs'
                    : 'text-stone-700 hover:text-stone-900 bg-stone-100/90 font-medium'
                }`}
                title={group.fullLabel}
                aria-haspopup="true"
                aria-expanded={isOpen}
                aria-controls={isOpen ? `mobile-nav-menu-${group.id}` : undefined}
              >
                <group.icon className={`w-3.5 h-3.5 shrink-0 ${isOpen || isGroupActive ? 'text-amber-300' : group.iconColor}`} />
                <span className="text-xs">{group.label}</span>
                <span className={`px-1 py-0.5 rounded-full text-[11px] font-bold ${
                  isOpen || isGroupActive ? 'bg-amber-800 text-amber-200' : 'bg-amber-100 text-amber-800'
                }`}>
                  {group.items?.length}
                </span>
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
              </button>
            );
          })}
          </div>
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-2 start-0 z-10 w-5 bg-gradient-to-r from-white/95 to-transparent rtl:bg-gradient-to-l" />
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-2 end-0 z-10 w-5 bg-gradient-to-l from-white/95 to-transparent rtl:bg-gradient-to-r" />
        </div>

        {/* Mobile Dropdown Panel — OUTSIDE the overflow-x-auto container so it is NEVER clipped */}
        {openDropdownId && (() => {
          const activeGroup = navGroups.find(g => g.id === openDropdownId);
          if (!activeGroup || activeGroup.type !== 'dropdown') return null;
          return (
            <div id={`mobile-nav-menu-${activeGroup.id}`} className="mt-2 p-2.5 rounded-2xl bg-white border border-amber-200/90 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between px-2.5 py-1.5 mb-2 border-b border-stone-100 bg-amber-50/80 rounded-xl">
                <div className="flex items-center gap-2">
                  <activeGroup.icon className={`w-4 h-4 ${activeGroup.iconColor}`} />
                  <span className="text-xs font-bold text-amber-950">{activeGroup.fullLabel}</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-800 text-[10px] font-bold border border-amber-500/30">
                    {activeGroup.items?.length} {uiLabel('unit_tools', currentLang)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenDropdownId(null)}
                  className="text-[11px] font-semibold text-stone-500 hover:text-stone-800 px-2 py-0.5 rounded cursor-pointer"
                >
                  {uiLabel('close', currentLang)} ✕
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-64 overflow-y-auto">
                {activeGroup.items?.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setOpenDropdownId(null);
                    }}
                    className={`w-full px-3 py-2 text-start flex items-center justify-between gap-2 rounded-xl transition-colors cursor-pointer ${
                      activeTab === item.id
                        ? 'bg-amber-100 text-amber-950 font-bold border-s-4 border-amber-600'
                        : 'hover:bg-stone-50 text-stone-700 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <item.icon className={`w-3.5 h-3.5 shrink-0 ${activeTab === item.id ? 'text-amber-700' : 'text-stone-500'}`} />
                      <span className="text-xs truncate">{item.fullLabel}</span>
                    </div>
                    {item.isNew && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-700 text-white text-[9px] font-bold shrink-0">
                        NEW
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}
      </nav>
    </header>
    {/* Admin Management Modal */}
    {showAdminModal && (
      <AdminMerchantManagement
        onClose={() => setShowAdminModal(false)}
        currentLang={currentLang}
      />
    )}
    </>
  );
};
