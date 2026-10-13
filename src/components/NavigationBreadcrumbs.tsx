import React from 'react';
import {
  Home,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  FlaskConical,
  Layers,
  Scale,
  Sparkles,
  DollarSign,
  Globe,
  Compass,
  BookOpen,
  Printer,
  Newspaper,
  BookMarked,
  Hourglass,
  Bot,
} from 'lucide-react';
import { SupportedLanguage } from '../types/i18n';
import { t } from '../utils/i18n';

interface NavigationBreadcrumbsProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
  onGoBack: () => void;
  canGoBack: boolean;
  previousTabLabel?: string;
  currentLang?: SupportedLanguage;
  onOpenPrintModal?: () => void;
}

export const NavigationBreadcrumbs: React.FC<NavigationBreadcrumbsProps> = ({
  activeTab,
  onNavigate,
  onGoBack,
  canGoBack,
  previousTabLabel,
  currentLang = 'ar',
  onOpenPrintModal,
}) => {
  const isRtl = currentLang === 'ar' || currentLang === 'fa';
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const Separator = isRtl ? ChevronLeft : ChevronRight;

  const tabConfigs: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
    home: { label: t('nav_home', currentLang), icon: Home },
    concentration: { label: t('nav_calc', currentLang), icon: FlaskConical },
    perfume_news: { label: t('nav_news', currentLang), icon: Newspaper },
    world_perfumes: { label: t('nav_world_perfumes', currentLang), icon: Compass },
    raw_materials: { label: t('nav_raw_materials', currentLang), icon: Scale },
    pyramid: { label: t('nav_pyramid', currentLang), icon: Layers },
    alcohol: { label: t('nav_alcohol', currentLang), icon: Hourglass },
    costing: { label: t('nav_costing', currentLang), icon: DollarSign },
    master_ai: { label: t('nav_ai_master', currentLang), icon: Bot },
    library: { label: t('nav_library', currentLang), icon: BookMarked },
    guide: { label: t('nav_guide', currentLang), icon: BookOpen },
  };

  const currentConfig = tabConfigs[activeTab] || { label: activeTab, icon: Sparkles };
  const TabIcon = currentConfig.icon;

  const quickLinks = [
    { id: 'concentration', label: isRtl ? 'حاسبة التراكيز' : 'Concentration', icon: FlaskConical },
    { id: 'pyramid', label: isRtl ? 'الهرم العطري' : 'Pyramid', icon: Layers },
    { id: 'alcohol', label: isRtl ? 'تخفيف الكحول' : 'Alcohol', icon: Hourglass },
    { id: 'costing', label: isRtl ? 'التكاليف والأرباح' : 'Costing', icon: DollarSign },
    { id: 'perfume_news', label: isRtl ? 'أخبار العطور' : 'News', icon: Newspaper },
    { id: 'world_perfumes', label: isRtl ? 'العطور العالمية' : 'World Iconic', icon: Compass },
    { id: 'raw_materials', label: isRtl ? 'المواد الخام' : 'Raw Materials', icon: Scale },
    { id: 'master_ai', label: isRtl ? 'خبير العطور AI' : 'AI Master', icon: Bot },
    { id: 'library', label: isRtl ? 'دفتر الوصفات' : 'My Formulas', icon: BookMarked },
    { id: 'guide', label: isRtl ? 'دليل التعتيق' : 'Aging Guide', icon: BookOpen },
  ];

  if (activeTab === 'home') return null;

  return (
    <div className="mb-6 bg-white/90 backdrop-blur-md border border-stone-200/90 rounded-2xl p-3 sm:p-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Home Button */}
          <button
            onClick={() => onNavigate('home')}
            className="px-3.5 py-2 bg-stone-900 hover:bg-amber-900 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer group"
            title={isRtl ? 'العودة إلى الصفحة الرئيسية للمنصة' : 'Back to Home'}
          >
            <Home className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
            <span>{isRtl ? 'العودة للرئيسية' : 'Home'}</span>
          </button>

          {/* Back Button */}
          {canGoBack && (
            <button
              onClick={onGoBack}
              className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-stone-200"
              title={isRtl ? 'رجوع للقسم السابق' : 'Back to previous section'}
            >
              <BackIcon className="w-3.5 h-3.5 text-stone-600" />
              <span>{isRtl ? 'رجوع' : 'Back'}</span>
              {previousTabLabel && (
                <span className="hidden md:inline text-stone-500 text-[11px]">
                  ({previousTabLabel})
                </span>
              )}
            </button>
          )}

          {/* Breadcrumb Trail */}
          <div className="flex items-center gap-1.5 text-xs text-stone-500 font-medium mr-2">
            <button
              onClick={() => onNavigate('home')}
              className="hover:text-amber-800 cursor-pointer flex items-center gap-1"
            >
              <span>{isRtl ? 'الرئيسية' : 'Home'}</span>
            </button>
            <Separator className="w-3.5 h-3.5 text-stone-400" />
            <div className="flex items-center gap-1.5 font-bold text-stone-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/60">
              <TabIcon className="w-3.5 h-3.5 text-amber-700" />
              <span>{currentConfig.label}</span>
            </div>
          </div>
        </div>

        {/* Spec Sheet Print Shortcut */}
        {onOpenPrintModal && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onOpenPrintModal}
              className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors border border-stone-200 cursor-pointer"
              title={isRtl ? 'طباعة بطاقة مواصفات تصنيع العطر' : 'Print Manufacturing Spec Sheet'}
            >
              <Printer className="w-3.5 h-3.5 text-amber-800" />
              <span>{isRtl ? 'طباعة بطاقة التصنيع' : 'Print Spec Sheet'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Jump To Bar */}
      <div className="mt-3 pt-2.5 border-t border-stone-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
        <span className="text-[11px] font-bold text-stone-400 shrink-0 ml-1">
          {isRtl ? 'انتقال سريع:' : 'Jump to:'}
        </span>
        {quickLinks.map((link) => {
          const Icon = link.icon;
          const isActive = activeTab === link.id;
          return (
            <button
              key={link.id}
              onClick={() => onNavigate(link.id)}
              className={`whitespace-nowrap px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
                isActive
                  ? 'bg-amber-100 text-amber-950 font-bold border border-amber-300'
                  : 'bg-stone-50 text-stone-600 hover:bg-stone-100 hover:text-stone-900 border border-stone-200/60'
              }`}
            >
              <Icon className={`w-3 h-3 ${isActive ? 'text-amber-800' : 'text-stone-500'}`} />
              <span>{link.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
