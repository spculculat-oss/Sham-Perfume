import React, { useState, useRef, useEffect } from 'react';
import {
  Printer,
  Sparkles,
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
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const L = makeT(currentLang, S);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = [
    { id: 'home', label: t('nav_home', currentLang), isHome: true },
    { id: 'concentration', label: t('nav_calc', currentLang) },
    { id: 'perfume_news', label: t('nav_news', currentLang), isNew: true },
    { id: 'world_perfumes', label: t('nav_world_perfumes', currentLang) },
    { id: 'raw_materials', label: t('nav_raw_materials', currentLang) },
    { id: 'pyramid', label: t('nav_pyramid', currentLang) },
    { id: 'alcohol', label: t('nav_alcohol', currentLang) },
    { id: 'costing', label: t('nav_costing', currentLang) },
    { id: 'master_ai', label: t('nav_ai_master', currentLang) },
    { id: 'maceration_simulator', label: t('nav_maceration', currentLang, 'محاكي التعتيق الزمني') },
    { id: 'library', label: t('nav_library', currentLang) },
    { id: 'guide', label: t('nav_guide', currentLang) },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200/80 px-3 sm:px-8 py-2.5 no-print shadow-xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
        
        {/* Zone 1: Brand wordmark: صمم عطرك مع شام */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 sm:shrink-0">
          <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-stone-900 to-amber-950 text-amber-400 flex items-center justify-center font-serif-luxury font-bold text-lg shadow-md border border-amber-600/30">
            شام
          </div>
          <button 
            onClick={() => setActiveTab('home')}
            className="text-right flex flex-col items-start cursor-pointer group min-w-0"
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
              className="flex shrink-0 items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold shadow-xs transition-all cursor-pointer mr-1 animate-in fade-in"
              title={L('home_tooltip')}
              aria-label={L('home_btn')}
            >
              <Home className="w-3.5 h-3.5 text-amber-300" />
              <span className="hidden sm:inline text-[11px]">{L('home_btn')}</span>
            </button>
          )}
        </div>

        {/* Zone 2: navigation lives in the scrollable row below at every width — 12 sections never fit inline. */}

        {/* Zone 3: Global Controls (Language, Environment/Homeland, User Auth, Privacy, Print) */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          
          {/* 1. Language Switcher (10 World Languages) — on phones it sits in the row below to free space */}
          <div className="hidden sm:block">
            <LanguageSelector
              currentLang={currentLang}
              onSelectLanguage={onSelectLanguage}
              onAutoDetectLanguage={onAutoDetectLanguage}
            />
          </div>

          {/* 2. Country & Detailed Address Selector */}
          <button
            onClick={onOpenEnvironmentModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50/90 hover:bg-amber-100 text-stone-900 text-xs font-semibold transition-all shadow-2xs cursor-pointer"
            title={L('country_tooltip')}
          >
            <span className="text-base leading-none">
              {currentEnvironment.countryFlag || '🌍'}
            </span>
            <span className="hidden lg:inline truncate max-w-[120px] font-bold">
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
              className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 text-xs font-semibold text-white bg-amber-800 hover:bg-amber-900 rounded-xl transition-all shadow-sm cursor-pointer shrink-0"
              aria-label={L('login')}
              title={L('login')}
            >
              <User className="w-3.5 h-3.5 text-amber-200" />
              <span className="hidden sm:inline">{L('login')}</span>
            </button>
          )}

          {/* 5. Print Spec Sheet */}
          <button
            onClick={onOpenPrintModal}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200/80 rounded-xl transition-all cursor-pointer border border-stone-200 shrink-0"
            title={L('print_tooltip')}
          >
            <Printer className="w-3.5 h-3.5 text-amber-700" />
            <span className="hidden xl:inline">{L('print_btn')}</span>
          </button>

        </div>
      </div>

      {/* Mobile & Tablet Secondary Navigation Strip */}
      <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto pt-2 mt-2 border-t border-stone-100 text-xs no-scrollbar">
        {/* Quick Language Switcher on phones (the header row has the full one from sm up) */}
        <div className="shrink-0 sm:hidden">
          <LanguageSelector
            currentLang={currentLang}
            onSelectLanguage={onSelectLanguage}
            compactMobile
          />
        </div>

        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`whitespace-nowrap px-3 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer shrink-0 ${
              activeTab === item.id
                ? 'bg-amber-900 text-white font-bold shadow-xs'
                : 'text-stone-700 hover:text-stone-900 bg-stone-100/90 font-medium'
            }`}
          >
            {item.isHome && (
              <Home className="w-3.5 h-3.5 text-amber-300" />
            )}
            {item.id === 'perfume_news' && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
            )}
            {item.id === 'master_ai' && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            )}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </header>
  );
};
