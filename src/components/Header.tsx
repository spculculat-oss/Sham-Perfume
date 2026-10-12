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
    { id: 'library', label: t('nav_library', currentLang) },
    { id: 'guide', label: t('nav_guide', currentLang) },
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
              title="العودة للصفحة الرئيسية"
            >
              <Home className="w-3.5 h-3.5 text-amber-300" />
              <span className="inline text-[11px]">الرئيسية ⌂</span>
            </button>
          )}
        </div>

        {/* Zone 2: Navigation links */}
        <nav className="hidden xl:flex items-center gap-2 xl:gap-2.5 text-xs font-medium text-stone-600">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`whitespace-nowrap shrink-0 transition-all py-1.5 px-2 rounded-lg relative flex items-center gap-1.5 cursor-pointer ${
                activeTab === item.id
                  ? 'text-stone-950 font-bold bg-stone-100 shadow-2xs border border-stone-200/80'
                  : 'hover:text-stone-900 hover:bg-stone-50'
              }`}
            >
              {item.isHome && (
                <Home className="w-3.5 h-3.5 text-amber-700" />
              )}
              {item.id === 'perfume_news' && (
                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-800 text-[10px] font-bold border border-amber-500/30">
                  NEW
                </span>
              )}
              {item.id === 'master_ai' && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
              {item.id === 'world_perfumes' && (
                <span className="text-[10px] text-amber-600 font-bold">★</span>
              )}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

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
            title="تحديد البلد والمقر والعنوان التفصيلي للمعمل"
          >
            <span className="text-base leading-none">
              {currentEnvironment.countryFlag || '🌍'}
            </span>
            <span className="hidden md:inline truncate max-w-[120px] font-bold">
              {currentEnvironment.countryNameAr.split('(')[0].trim()}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-amber-200/80 text-[10px] font-mono font-bold text-amber-950">
              {currentEnvironment.currencySymbolAr}
            </span>
          </button>

          {/* 3. Data Privacy & GDPR Button */}
          <button
            onClick={onOpenPrivacyModal}
            className="p-1.5 sm:px-2 sm:py-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 text-stone-600 text-xs transition-all shadow-2xs cursor-pointer flex items-center gap-1"
            title="حماية وخصوصية بيانات المستخدم (GDPR)"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="hidden lg:inline text-[11px] font-medium">الخصوصية</span>
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
                        <span>حماية البيانات والنسخ الاحتياطي</span>
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
                        <span>تحديد البلد والعنوان ومقر المعمل</span>
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
                      <span>تسجيل الخروج</span>
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
              <span>تسجيل الدخول</span>
            </button>
          )}

          {/* 5. Print Spec Sheet */}
          <button
            onClick={onOpenPrintModal}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200/80 rounded-xl transition-all cursor-pointer border border-stone-200 shrink-0"
            title="طباعة بطاقة تصنيع العطر"
          >
            <Printer className="w-3.5 h-3.5 text-amber-700" />
            <span className="hidden xl:inline">طباعة</span>
          </button>

        </div>
      </div>

      {/* Mobile & Tablet Secondary Navigation Strip */}
      <div className="xl:hidden flex items-center gap-2 overflow-x-auto pt-2 mt-2 border-t border-stone-100 text-xs no-scrollbar">
        {/* Quick Language Switcher on Mobile/Tablet */}
        <div className="shrink-0">
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
