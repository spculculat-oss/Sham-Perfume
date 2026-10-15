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
  MapPin,
  Home,
} from 'lucide-react';
import { SupportedLanguage } from '../types/i18n';
import { t } from '../utils/i18n';
import { LanguageSelector } from './LanguageSelector';
import { AdminMerchantManagement } from './AdminMerchantManagement';
import { UserProfile } from '../types/auth';
import { UserEnvironmentProfile } from '../utils/environmentAdapter';
import { LText, makeT, pickArEn } from '../utils/localize';


const S = {
  home_tooltip: { ar: 'العودة للصفحة الرئيسية', en: 'Back to Home', fr: 'Retour à l’accueil', es: 'Volver al inicio', it: 'Torna alla home', de: 'Zurück zur Startseite', ru: 'На главную', zh: '返回首页', tr: 'Ana sayfaya dön', fa: 'بازگشت به صفحه اصلی' },
  home_btn: { ar: 'الرئيسية ⌂', en: 'Home ⌂', fr: 'Accueil ⌂', es: 'Inicio ⌂', it: 'Home ⌂', de: 'Start ⌂', ru: 'Главная ⌂', zh: '首页 ⌂', tr: 'Ana Sayfa ⌂', fa: 'خانه ⌂' },
  country_tooltip: { ar: 'تحديد البلد والمقر والعنوان التفصيلي للمعمل', en: 'Set country, facility, and detailed address', fr: 'Définir pays, établissement et adresse', es: 'Configurar país, instalación y dirección', it: 'Imposta paese, struttura e indirizzo', de: 'Land, Standort und Adresse festlegen', ru: 'Указать страну и адрес лаборатории', zh: '设置国家、实验室与详细地址', tr: 'Ülke, tesis ve adresi belirle', fa: 'تعیین کشور، مقر و نشانی تفصیلی' },
  privacy_tooltip: { ar: 'حماية وخصوصية بيانات المستخدم (GDPR)', en: 'User data protection & privacy (GDPR)', fr: 'Protection des données (RGPD)', es: 'Protección de datos (GDPR)', it: 'Protezione dei dati (GDPR)', de: 'Datenschutz (DSGVO)', ru: 'Защита данных (GDPR)', zh: '用户数据保护与隐私（GDPR）', tr: 'Veri koruma ve gizlilik (GDPR)', fa: 'حفاظت و حریم خصوصی داده‌ها (GDPR)' },
  privacy_btn: { ar: 'الخصوصية', en: 'Privacy', fr: 'Confidentialité', es: 'Privacidad', it: 'Privacy', de: 'Datenschutz', ru: 'Приватность', zh: '隐私', tr: 'Gizlilik', fa: 'حریم خصوصی' },
  menu_data_backup: { ar: 'حماية البيانات والنسخ الاحتياطي', en: 'Data protection & backup', fr: 'Protection et sauvegarde des données', es: 'Protección y respaldo de datos', it: 'Protezione e backup dei dati', de: 'Datenschutz & Backup', ru: 'Защита и резервное копирование', zh: '数据保护与备份', tr: 'Veri koruma ve yedekleme', fa: 'حفاظت داده و پشتیبان‌گیری' },
  menu_country: { ar: 'تحديد البلد والعنوان ومقر المعمل', en: 'Set country, address & facility', fr: 'Pays, adresse et établissement', es: 'País, dirección e instalación', it: 'Paese, indirizzo e struttura', de: 'Land, Adresse & Standort', ru: 'Страна, адрес и лаборатория', zh: '设置国家、地址与实验室', tr: 'Ülke, adres ve tesis', fa: 'تعیین کشور، نشانی و مقر' },
  logout: { ar: 'تسجيل الخروج', en: 'Log out', fr: 'Déconnexion', es: 'Cerrar sesión', it: 'Esci', de: 'Abmelden', ru: 'Выйти', zh: '退出登录', tr: 'Çıkış yap', fa: 'خروج از حساب' },
  login: { ar: 'تسجيل الدخول', en: 'Log in', fr: 'Connexion', es: 'Iniciar sesión', it: 'Accedi', de: 'Anmelden', ru: 'Войти', zh: '登录', tr: 'Giriş yap', fa: 'ورود' },
  print_tooltip: { ar: 'طباعة بطاقة تصنيع العطر', en: 'Print manufacturing spec sheet', fr: 'Imprimer la fiche de fabrication', es: 'Imprimir hoja de fabricación', it: 'Stampa scheda di produzione', de: 'Produktionsblatt drucken', ru: 'Печать производственной карты', zh: '打印生产规格表', tr: 'Üretim föyünü yazdır', fa: 'چاپ کارت تولید عطر' },
  print_btn: { ar: 'طباعة', en: 'Print', fr: 'Imprimer', es: 'Imprimir', it: 'Stampa', de: 'Drucken', ru: 'Печать', zh: '打印', tr: 'Yazdır', fa: 'چاپ' },
  profile_tooltip: { ar: 'صفحتي الشخصية وبياناتي', en: 'My personal profile & data', fr: 'Mon profil et mes données', es: 'Mi perfil y datos personales', it: 'Il mio profilo personale', de: 'Mein Profil & Daten', ru: 'Мой профиль и данные', zh: '我的个人主页与数据', tr: 'Kişisel profilim ve verilerim', fa: 'پروفایل و داده‌های شخصی من' },
  profile_btn: { ar: 'حسابي', en: 'My Profile', fr: 'Mon Profil', es: 'Mi Perfil', it: 'Il Mio Profilo', de: 'Mein Profil', ru: 'Мой Профиль', zh: '我的个人主页', tr: 'Kişisel Profilim', fa: 'پروفایل من' },
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
  const [groupMenuStates, setGroupMenuStates] = useState<Record<string, boolean>>({});
  const userMenuRef = useRef<HTMLDivElement>(null);
  const L = makeT(currentLang, S);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
      // Close group menus when clicking outside
      const groupButtons = document.querySelectorAll('[data-group-menu]');
      const isGroupClick = Array.from(groupButtons).some(btn => btn.contains(e.target as Node));
      if (!isGroupClick) {
        setGroupMenuStates({});
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isGroupMenuOpen = (id: string) => groupMenuStates[id] || false;
  const setIsGroupMenuOpen = (id: string, open: boolean) => {
    setGroupMenuStates(prev => ({ ...prev, [id]: open }));
  };

  // Smart navigation groups - reduces 12 items to 4 main groups with dropdowns
  const navGroups = [
    {
      id: 'home',
      type: 'single',
      label: t('nav_home_short', currentLang),
      fullLabel: t('nav_home', currentLang),
      icon: Home,
      iconColor: 'text-amber-700',
    },
    {
      id: 'tools',
      type: 'dropdown',
      label: t('nav_tools_short', currentLang),
      fullLabel: t('nav_tools', currentLang),
      icon: FlaskConical,
      iconColor: 'text-amber-600',
      items: [
        { id: 'concentration', label: t('nav_calc_short', currentLang), fullLabel: t('nav_calc', currentLang), icon: FlaskConical },
        { id: 'alcohol', label: t('nav_alcohol_short', currentLang), fullLabel: t('nav_alcohol', currentLang), icon: FlaskConical },
        { id: 'costing', label: t('nav_costing_short', currentLang), fullLabel: t('nav_costing', currentLang), icon: Newspaper },
        { id: 'maceration_simulator', label: t('nav_maceration_short', currentLang), fullLabel: t('nav_maceration', currentLang, 'محاكي التعتيق الزمني'), icon: FlaskConical },
      ],
    },
    {
      id: 'explore',
      type: 'dropdown',
      label: t('nav_explore_short', currentLang),
      fullLabel: t('nav_explore', currentLang),
      icon: Compass,
      iconColor: 'text-amber-600',
      items: [
        { id: 'perfume_news', label: t('nav_news_short', currentLang), fullLabel: t('nav_news', currentLang), icon: Newspaper, isNew: true },
        { id: 'world_perfumes', label: t('nav_world_perfumes_short', currentLang), fullLabel: t('nav_world_perfumes', currentLang), icon: Compass },
        { id: 'pyramid', label: t('nav_pyramid_short', currentLang), fullLabel: t('nav_pyramid', currentLang), icon: Compass },
        { id: 'raw_materials', label: t('nav_raw_materials_short', currentLang), fullLabel: t('nav_raw_materials', currentLang), icon: Database },
        { id: 'library', label: t('nav_library_short', currentLang), fullLabel: t('nav_library', currentLang), icon: Database },
        { id: 'guide', label: t('nav_guide_short', currentLang), fullLabel: t('nav_guide', currentLang), icon: Newspaper },
      ],
    },
    {
      id: 'master_ai',
      type: 'single',
      label: t('nav_ai_master_short', currentLang),
      fullLabel: t('nav_ai_master', currentLang),
      icon: Sparkles,
      iconColor: 'text-emerald-500',
    },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200/80 px-4 sm:px-8 py-2.5 no-print shadow-xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        
        {/* Zone 1: Brand wordmark: صمم عطرك مع شام */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-stone-900 to-amber-950 text-amber-400 flex items-center justify-center font-serif-luxury font-bold text-lg shadow-md border border-amber-600/30">
            شام
          </div>
          <button 
            onClick={() => setActiveTab('home')}
            className="text-right flex flex-col items-start cursor-pointer group"
          >
            <span className="text-base sm:text-lg font-extrabold tracking-tight text-stone-950 group-hover:text-amber-800 transition-colors font-serif-luxury">
              {t('brand_name', currentLang)}
            </span>
            <span className="text-[10px] text-amber-700 font-medium hidden sm:inline">
              {t('brand_subtitle', currentLang)}
            </span>
          </button>

          {/* Quick Return to Home Button when inside any sub-section */}
          {activeTab !== 'home' && (
            <button
              onClick={() => setActiveTab('home')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold shadow-xs transition-all cursor-pointer mr-1 animate-in fade-in"
              title={L('home_tooltip')}
            >
              <Home className="w-3.5 h-3.5 text-amber-300" />
              <span className="inline text-[11px]">{L('home_btn')}</span>
            </button>
          )}
        </div>

        {/* Zone 2: Navigation links - Compact icon-only bar with dropdowns */}
        <div className="hidden xl:block relative flex items-center justify-center py-1">
          {/* Gradient fade left edge - visible only if overflow */}
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white/95 to-transparent pointer-events-none z-10"></div>
          {/* Gradient fade right edge */}
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white/95 to-transparent pointer-events-none z-10"></div>
          <div className="flex items-center gap-2 relative z-20">
            {navGroups.map((group) => (
              group.type === 'single' ? (
                <button
                  key={group.id}
                  onClick={() => setActiveTab(group.id)}
                  className={`transition-all py-1.5 px-2.5 rounded-lg flex items-center gap-1.5 cursor-pointer ${
                    activeTab === group.id
                      ? 'text-stone-950 font-bold bg-stone-100 shadow-2xs border border-stone-200/80'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                  }`}
                  title={group.fullLabel}
                  aria-label={group.fullLabel}
                >
                  <group.icon className={`w-4.5 h-4.5 ${group.iconColor} shrink-0`} />
                </button>
              ) : (
                <div key={group.id} className="relative">
                  <button
                    data-group-menu="true"
                    onClick={() => setIsGroupMenuOpen(group.id, !isGroupMenuOpen(group.id))}
                    className={`transition-all py-1.5 px-2.5 rounded-lg flex items-center gap-1 cursor-pointer ${
                      isGroupMenuOpen(group.id)
                        ? 'text-stone-950 font-bold bg-stone-100 shadow-2xs border border-stone-200/80'
                        : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                    }`}
                    title={group.fullLabel}
                    aria-label={group.fullLabel}
                  >
                    <group.icon className={`w-4.5 h-4.5 ${group.iconColor} shrink-0`} />
                    <span className="absolute -top-1.5 -right-1.5 px-1 py-0 rounded-full bg-amber-500 text-white text-[9px] font-bold leading-none">
                      {group.items?.length}
                    </span>
                    <ChevronDown className="w-3 h-3 text-stone-400 ml-0.5 shrink-0" />
                  </button>
                  {isGroupMenuOpen(group.id) && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 min-w-[280px] rounded-xl bg-white border border-stone-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
                      <div className="px-3 py-2 bg-amber-50 border-b border-amber-100 rounded-t-xl">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${group.iconColor?.replace('text-emerald-500', 'bg-emerald-500').replace('text-amber-700', 'bg-amber-500').replace('text-amber-600', 'bg-amber-500')}`}></div>
                          <span className="text-xs font-bold text-amber-900">{group.fullLabel}</span>
                          <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-700 text-[10px] font-medium border border-amber-500/30">
                            {group.items?.length} أداة
                          </span>
                        </div>
                        <p className="text-[10px] text-amber-700 mt-0.5 leading-tight">
                          {group.id === 'tools' && 'جميع أدوات الحسابات المعملية - الكيمياء، المخاليط، والتكلفة'}
                          {group.id === 'explore' && 'مكتبة العطور، الخامات، الإخباريات، والأدلة المرجعية'}
                          {group.id === 'home' && 'العودة للصفحة الرئيسية'}
                          {group.id === 'master_ai' && 'خبير المعمل الذكي بالذكاء الاصطناعي'}
                        </p>
                      </div>
                      <div className="p-1">
                        {group.items?.map((item, idx) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveTab(item.id);
                            setIsGroupMenuOpen(group.id, false);
                          }}
                          className={`w-full px-3 py-2 text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                            activeTab === item.id
                              ? 'bg-amber-50 text-amber-900 font-semibold border-l-3 border-amber-500 rounded-l-lg pl-3'
                              : 'hover:bg-stone-50 text-stone-700 rounded-lg'
                          }`}
                        >
                          {item.isNew && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-800 text-[10px] font-bold border border-amber-500/30 shrink-0 ml-1">
                              NEW
                            </span>
                          )}
                          <item.icon className="w-4 h-4 text-stone-500 shrink-0" />
                          <span className="text-sm font-medium">{item.fullLabel}</span>
                        </button>
                      ))}  // end map
                      </div>  // end items container
                      <div className="mt-1 pt-1 border-t border-stone-100">
                        <button
                          onClick={() => setIsGroupMenuOpen(group.id, false)}
                          className="w-full px-3 py-1.5 text-center text-xs text-stone-500 hover:text-stone-700 hover:bg-stone-50 rounded-lg transition-colors"
                        >
                          {activeTab === group.id ? 'إغلاق' : 'إغلاق القائمة'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            ))}
          </div>
        </div>

        {/* Zone 3: Global Controls (Language, Environment/Homeland, User Auth, Privacy, Print) */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          
          {/* 1. Language Switcher (10 World Languages) */}
          <LanguageSelector
            currentLang={currentLang}
            onSelectLanguage={onSelectLanguage}
            onAutoDetectLanguage={onAutoDetectLanguage}
          />

          {/* 2. Country & Detailed Address Selector */}
          <button
            onClick={onOpenEnvironmentModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50/90 hover:bg-amber-100 text-stone-900 text-xs font-semibold transition-all shadow-2xs cursor-pointer"
            title={L('country_tooltip')}
          >
            <span className="text-base leading-none">
              {currentEnvironment.countryFlag || '🌍'}
            </span>
            <span className="hidden md:inline truncate max-w-[120px] font-bold">
              {pickArEn(currentLang, currentEnvironment.countryNameAr, currentEnvironment.countryNameEn).split('(')[0].trim()}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-amber-200/80 text-[10px] font-mono font-bold text-amber-950">
              {pickArEn(currentLang, currentEnvironment.currencySymbolAr, currentEnvironment.currencySymbolEn)}
            </span>
          </button>

          {/* 3. Data Privacy & GDPR Button */}
          <button
            onClick={onOpenPrivacyModal}
            className="p-1.5 sm:px-2 sm:py-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 text-stone-600 text-xs transition-all shadow-2xs cursor-pointer flex items-center gap-1"
            title={L('privacy_tooltip')}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="hidden lg:inline text-[11px] font-medium">{L('privacy_btn')}</span>
          </button>

          {/* 4. User Profile & Login System */}
          {currentUser ? (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition-all shadow-sm cursor-pointer"
              >
                <div className="w-5 h-5 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center font-bold text-[10px]">
                  {currentUser.name.slice(0, 1)}
                </div>
                <span className="truncate max-w-[90px]">{currentUser.name}</span>
                <ChevronDown className="w-3 h-3 text-stone-400" />
              </button>

              {isUserMenuOpen && (
                <div className="absolute top-full mt-2 left-0 sm:right-0 sm:left-auto z-50 w-64 rounded-2xl bg-white border border-stone-200 shadow-xl overflow-hidden py-2 text-xs text-stone-800 animate-in fade-in zoom-in-95">
                  <div className="px-4 py-3 border-b border-stone-100 bg-stone-50">
                    <div className="font-bold text-stone-900 text-sm">{currentUser.name}</div>
                    <div className="text-[11px] text-stone-500 font-mono">{currentUser.email}</div>
                    <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-bold">
                      <Sparkles className="w-3 h-3 text-amber-700" />
                      <span>{currentUser.craftLevelLabelAr}</span>
                    </div>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenPrivacyModal();
                      }}
                      className="w-full px-4 py-2 text-right hover:bg-stone-50 flex items-center justify-between cursor-pointer"
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
                      className="w-full px-4 py-2 text-right hover:bg-stone-50 flex items-center justify-between cursor-pointer"
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
                      className="w-full px-4 py-2 text-right text-red-600 hover:bg-red-50 flex items-center gap-2 font-semibold cursor-pointer"
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
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-800 hover:bg-amber-900 rounded-xl transition-all shadow-sm cursor-pointer shrink-0"
            >
              <User className="w-3.5 h-3.5 text-amber-200" />
              <span>{L('login')}</span>
            </button>
          )}

          {/* 5. Admin Dashboard Button — only for admin users */}
          {currentUser?.isAdmin && (
            <button
              onClick={() => setShowAdminModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-xl transition-all shadow-sm cursor-pointer shrink-0"
              title="لوحة تحكم الإدارة"
            >
              <Shield className="w-3.5 h-3.5 text-purple-200" />
              <span className="hidden xl:inline">الإدارة</span>
            </button>
          )}

          {/* 6. Print Spec Sheet */}
          <button
            onClick={onOpenPrintModal}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200/80 rounded-xl transition-all cursor-pointer border border-stone-200 shrink-0"
            title={L('print_tooltip')}
          >
            <Printer className="w-3.5 h-3.5 text-amber-700" />
            <span className="hidden xl:inline">{L('print_btn')}</span>
          </button>

          {/* 5. My Profile Button - Personal page shortcut */}
          {currentUser && (
            <button
              onClick={onOpenProfilePage}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-all shadow-sm cursor-pointer shrink-0"
              title={L('profile_tooltip')}
            >
              <User className="w-3.5 h-3.5 text-white" />
              <span className="hidden xl:inline">{L('profile_btn')}</span>
            </button>
          )}

        </div>
      </div>

      {/* Mobile & Tablet Navigation - Condensed grouped view */}
      <div className="xl:hidden">
        <div className="flex items-center gap-2 overflow-x-auto pt-2 mt-2 border-t border-stone-100 text-xs no-scrollbar">
          {/* Quick Language Switcher on Mobile/Tablet */}
          <div className="shrink-0">
            <LanguageSelector
              currentLang={currentLang}
              onSelectLanguage={onSelectLanguage}
              compactMobile
            />
          </div>

          {/* Mobile nav groups as scrollable pills */}
          {navGroups.map((group) => (
            group.type === 'single' ? (
              <button
                key={group.id}
                onClick={() => setActiveTab(group.id)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-lg flex items-center gap-1.5 shrink-0 ${
                  activeTab === group.id
                    ? 'bg-amber-900 text-white font-bold shadow-xs'
                    : 'text-stone-700 hover:text-stone-900 bg-stone-100/90 font-medium'
                }`}
                title={group.fullLabel}
              >
                <group.icon className={`w-3.5 h-3.5 ${group.iconColor.replace('text-emerald-500', 'text-emerald-400').replace('text-amber-700', 'text-amber-300').replace('text-amber-600', 'text-amber-500')} shrink-0`} />
                <span className="text-[11px]">{group.label}</span>
              </button>
            ) : (
              <div key={group.id} className="relative shrink-0">
                {/* Group pill */}
                <button
                  onClick={() => setIsGroupMenuOpen(group.id, !isGroupMenuOpen(group.id))}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-lg flex items-center gap-1.5 shrink-0 ${
                    isGroupMenuOpen(group.id)
                      ? 'bg-amber-900 text-white font-bold shadow-xs'
                      : 'text-stone-700 hover:text-stone-900 bg-stone-100/90 font-medium'
                  }`}
                  title={group.fullLabel}
                >
                  <group.icon className={`w-3.5 h-3.5 ${group.iconColor.replace('text-emerald-500', 'text-emerald-400').replace('text-amber-700', 'text-amber-300').replace('text-amber-600', 'text-amber-500')} shrink-0`} />
                  <span className="text-[11px]">{group.label}</span>
                  <span className="px-1 py-0.5 rounded-full bg-amber-100 text-[10px] font-medium text-amber-800 shrink-0">
                    {group.items?.length}
                  </span>
                </button>
                
                {/* Group dropdown for mobile */}
                {isGroupMenuOpen(group.id) && (
                  <div className="absolute top-full left-0 mt-2 min-w-[240px] rounded-xl bg-white border border-stone-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
                    {group.items?.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveTab(item.id);
                          setIsGroupMenuOpen(group.id, false);
                        }}
                        className={`w-full px-4 py-2 text-left flex items-center gap-2 transition-colors cursor-pointer ${
                          activeTab === item.id
                            ? 'bg-amber-50 text-amber-900 font-semibold'
                            : 'hover:bg-stone-50 text-stone-700'
                        }`}
                      >
                        {item.isNew && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-800 text-[10px] font-bold border border-amber-500/30 shrink-0">
                            NEW
                          </span>
                        )}
                        <item.icon className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                        <span className="text-xs">{item.fullLabel}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          ))}
        </div>
      </div>
    </header>
    {/* Admin Management Modal */}
    {showAdminModal && (
      <AdminMerchantManagement
        onClose={() => setShowAdminModal(false)}
        currentLang={currentLang}
      />
    )}
  );
};
