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
import { LText, makeT } from '../utils/localize';
import { isRTL } from '../utils/localizedContent';


const S = {
  aging_sim_full: { ar: 'محاكي التعتيق الزمني', en: 'Maceration Simulator', fr: 'Simulateur de maturation', es: 'Simulador de maceración', it: 'Simulatore di maturazione', de: 'Mazerationssimulator', ru: 'Симулятор настаивания', zh: '熟成模拟器', tr: 'Maserasyon simülatörü', fa: 'شبیه‌ساز تعریف' },
  ql_concentration: { ar: 'حاسبة التراكيز', en: 'Concentration', fr: 'Concentration', es: 'Concentración', it: 'Concentrazione', de: 'Konzentration', ru: 'Концентрация', zh: '浓度计算', tr: 'Konsantrasyon', fa: 'ماشین‌حساب غلظت' },
  ql_maceration: { ar: 'محاكي التعتيق', en: 'Aging Simulator', fr: 'Maturation', es: 'Maceración', it: 'Maturazione', de: 'Reifung', ru: 'Настаивание', zh: '熟成', tr: 'Maserasyon', fa: 'شبیه‌ساز تعریف' },
  ql_pyramid: { ar: 'الهرم العطري', en: 'Pyramid', fr: 'Pyramide', es: 'Pirámide', it: 'Piramide', de: 'Pyramide', ru: 'Пирамида', zh: '香调金字塔', tr: 'Piramit', fa: 'هرم عطری' },
  ql_alcohol: { ar: 'تخفيف الكحول', en: 'Alcohol', fr: 'Alcool', es: 'Alcohol', it: 'Alcol', de: 'Alkohol', ru: 'Спирт', zh: '酒精稀释', tr: 'Alkol', fa: 'رقیق‌سازی الکل' },
  ql_costing: { ar: 'التكاليف والأرباح', en: 'Costing', fr: 'Coûts', es: 'Costes', it: 'Costi', de: 'Kosten', ru: 'Себестоимость', zh: '成本与利润', tr: 'Maliyet', fa: 'هزینه و سود' },
  ql_news: { ar: 'أخبار العطور', en: 'News', fr: 'Actualités', es: 'Noticias', it: 'Notizie', de: 'News', ru: 'Новости', zh: '香水资讯', tr: 'Haberler', fa: 'اخبار عطر' },
  ql_world: { ar: 'العطور العالمية', en: 'World Iconic', fr: 'Parfums iconiques', es: 'Perfumes icónicos', it: 'Profumi iconici', de: 'Weltweite Ikonen', ru: 'Мировые ароматы', zh: '世界名香', tr: 'Dünya ikonları', fa: 'عطرهای مشهور جهان' },
  ql_raw: { ar: 'المواد الخام', en: 'Raw Materials', fr: 'Matières premières', es: 'Materias primas', it: 'Materie prime', de: 'Rohstoffe', ru: 'Сырьё', zh: '原料', tr: 'Hammaddeler', fa: 'مواد اولیه' },
  ql_ai: { ar: 'خبير العطور AI', en: 'AI Master', fr: 'Maître IA', es: 'Maestro IA', it: 'Maestro IA', de: 'KI-Meister', ru: 'ИИ-мастер', zh: 'AI 调香大师', tr: 'YZ Ustası', fa: 'استاد AI عطر' },
  ql_library: { ar: 'دفتر الوصفات', en: 'My Formulas', fr: 'Mes formules', es: 'Mis fórmulas', it: 'Le mie formule', de: 'Meine Formeln', ru: 'Мои формулы', zh: '我的配方', tr: 'Formüllerim', fa: 'دفتر فرمول‌ها' },
  ql_guide: { ar: 'دليل التعتيق', en: 'Aging Guide', fr: 'Guide de maturation', es: 'Guía de maceración', it: 'Guida alla maturazione', de: 'Reifungsleitfaden', ru: 'Руководство', zh: '熟成指南', tr: 'Maserasyon rehberi', fa: 'راهنمای تعریف' },
  home_tooltip: { ar: 'العودة إلى الصفحة الرئيسية للمنصة', en: 'Back to Home', fr: 'Retour à l’accueil', es: 'Volver al inicio', it: 'Torna alla home', de: 'Zurück zur Startseite', ru: 'На главную', zh: '返回首页', tr: 'Ana sayfaya dön', fa: 'بازگشت به صفحه اصلی' },
  home_btn: { ar: 'العودة للرئيسية', en: 'Home', fr: 'Accueil', es: 'Inicio', it: 'Home', de: 'Start', ru: 'Главная', zh: '首页', tr: 'Ana Sayfa', fa: 'خانه' },
  back_tooltip: { ar: 'رجوع للقسم السابق', en: 'Back to previous section', fr: 'Retour à la section précédente', es: 'Volver a la sección anterior', it: 'Torna alla sezione precedente', de: 'Zurück zum vorherigen Bereich', ru: 'К предыдущему разделу', zh: '返回上一板块', tr: 'Önceki bölüme dön', fa: 'بازگشت به بخش قبلی' },
  back_btn: { ar: 'رجوع', en: 'Back', fr: 'Retour', es: 'Atrás', it: 'Indietro', de: 'Zurück', ru: 'Назад', zh: '返回', tr: 'Geri', fa: 'بازگشت' },
  home_trail: { ar: 'الرئيسية', en: 'Home', fr: 'Accueil', es: 'Inicio', it: 'Home', de: 'Start', ru: 'Главная', zh: '首页', tr: 'Ana Sayfa', fa: 'خانه' },
  print_tooltip: { ar: 'طباعة بطاقة مواصفات تصنيع العطر', en: 'Print Manufacturing Spec Sheet', fr: 'Imprimer la fiche de fabrication', es: 'Imprimir hoja de especificaciones', it: 'Stampa la scheda di produzione', de: 'Produktionsblatt drucken', ru: 'Печать производственной карты', zh: '打印生产规格表', tr: 'Üretim föyünü yazdır', fa: 'چاپ برگه مشخصات تولید' },
  print_btn: { ar: 'طباعة بطاقة التصنيع', en: 'Print Spec Sheet', fr: 'Imprimer la fiche', es: 'Imprimir especificaciones', it: 'Stampa scheda', de: 'Föy drucken', ru: 'Печать карты', zh: '打印规格表', tr: 'Föyü yazdır', fa: 'چاپ کارت تولید' },
  jump_to: { ar: 'انتقال سريع:', en: 'Jump to:', fr: 'Accès rapide :', es: 'Ir a:', it: 'Vai a:', de: 'Schnellzugriff:', ru: 'Быстрый переход:', zh: '快速跳转：', tr: 'Hızlı geçiş:', fa: 'دسترسی سریع:' },
} satisfies Record<string, LText>;

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
  const isRtl = isRTL(currentLang);
  const L = makeT(currentLang, S);
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
    maceration_simulator: { label: L('aging_sim_full'), icon: Hourglass },
    library: { label: t('nav_library', currentLang), icon: BookMarked },
    guide: { label: t('nav_guide', currentLang), icon: BookOpen },
  };

  const currentConfig = tabConfigs[activeTab] || { label: activeTab, icon: Sparkles };
  const TabIcon = currentConfig.icon;

  const quickLinks = [
    { id: 'concentration', label: L('ql_concentration'), icon: FlaskConical },
    { id: 'maceration_simulator', label: L('ql_maceration'), icon: Hourglass },
    { id: 'pyramid', label: L('ql_pyramid'), icon: Layers },
    { id: 'alcohol', label: L('ql_alcohol'), icon: Hourglass },
    { id: 'costing', label: L('ql_costing'), icon: DollarSign },
    { id: 'perfume_news', label: L('ql_news'), icon: Newspaper },
    { id: 'world_perfumes', label: L('ql_world'), icon: Compass },
    { id: 'raw_materials', label: L('ql_raw'), icon: Scale },
    { id: 'master_ai', label: L('ql_ai'), icon: Bot },
    { id: 'library', label: L('ql_library'), icon: BookMarked },
    { id: 'guide', label: L('ql_guide'), icon: BookOpen },
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
            title={L('home_tooltip')}
          >
            <Home className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
            <span>{L('home_btn')}</span>
          </button>

          {/* Back Button */}
          {canGoBack && (
            <button
              onClick={onGoBack}
              className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-stone-200"
              title={L('back_tooltip')}
            >
              <BackIcon className="w-3.5 h-3.5 text-stone-600" />
              <span>{L('back_btn')}</span>
              {previousTabLabel && (
                <span className="hidden md:inline text-stone-500 text-[11px]">
                  ({tabConfigs[previousTabLabel]?.label || previousTabLabel.replace(/_/g, ' ')})
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
              <span>{L('home_trail')}</span>
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
              title={L('print_tooltip')}
            >
              <Printer className="w-3.5 h-3.5 text-amber-800" />
              <span>{L('print_btn')}</span>
            </button>
          </div>
        )}
      </div>

      {/* Jump To Bar */}
      <div className="mt-3 pt-2.5 border-t border-stone-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
        <span className="text-[11px] font-bold text-stone-400 shrink-0 ml-1">
          {L('jump_to')}
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
