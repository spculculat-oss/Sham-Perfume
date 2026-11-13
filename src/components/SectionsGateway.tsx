import React from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Calculator, Database, FlaskConical, Leaf, PenLine, Store } from 'lucide-react';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../types/i18n';
import { cosmeticsText, type CosmeticsUiKey } from '../لغات/cosmeticsL10n';
import { t as ui } from '../لغات/i18n';
import { designersText } from '../لغات/designersL10n';
import { wsText } from '../workspace/strings';

interface Props {
  currentLang: SupportedLanguage;
  onNavigate: (tab: string) => void;
}

/**
 * The top of the home page: the platform's two sections side by side — «العطور» and «مستحضرات التجميل» — with a few
 * tools of each, so the home is a mix of both (the perfume hub follows below it).
 */
export function SectionsGateway({ currentLang, onNavigate }: Props) {
  const ct = (k: CosmeticsUiKey) => cosmeticsText(currentLang, k);
  const Arrow = SUPPORTED_LANGUAGES.find((l) => l.code === currentLang)?.dir === 'rtl' ? ArrowLeft : ArrowRight;
  const perfumeTools = [
    { tab: 'concentration', label: ui('nav_calc', currentLang), icon: Calculator },
    { tab: 'raw_materials', label: ui('nav_raw_materials', currentLang), icon: Database },
    { tab: 'perfume_designers', label: designersText(currentLang, 'hubButton'), icon: PenLine },
    { tab: 'store?section=perfumes', label: ct('sectionPerfumes'), icon: Store },
  ];
  const cosmeticTools = [
    { tab: 'cosmetics', label: ct('tabFormulator'), icon: FlaskConical },
    { tab: 'cosmetics', label: ct('tabLibrary'), icon: Leaf },
    { tab: 'cosmetics', label: ct('tabScience'), icon: BookOpen },
    { tab: 'cosmetic_designers', label: designersText(currentLang, 'hubButton'), icon: PenLine },
  ];
  const card = (
    tab: string, title: string, text: string, tools: typeof perfumeTools, tone: 'amber' | 'rose', emoji: string, id: string,
  ) => (
    <article data-testid={`gateway-${id}`} className={`relative overflow-hidden rounded-3xl border p-6 sm:p-7 shadow-xs flex flex-col gap-4 ${
      tone === 'amber' ? 'border-amber-200 bg-gradient-to-br from-amber-50 via-white to-stone-50' : 'border-rose-200 bg-gradient-to-br from-rose-50 via-white to-pink-50'}`}>
      <div className="flex items-center gap-3">
        <span className="text-4xl" aria-hidden>{emoji}</span>
        <h2 className="text-xl sm:text-2xl font-black text-stone-900">{title}</h2>
      </div>
      <p className="text-sm text-stone-600 leading-relaxed">{text}</p>
      <div className="flex flex-wrap gap-2">
        {tools.map(({ tab: to, label, icon: Icon }) => (
          <button key={label} type="button" onClick={() => onNavigate(to)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/90 border border-stone-200 text-xs font-bold text-stone-800 hover:border-stone-400 cursor-pointer">
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => onNavigate(tab)}
        className={`mt-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-white text-sm font-black cursor-pointer shadow-xs ${
          tone === 'amber' ? 'bg-amber-800 hover:bg-amber-900' : 'bg-rose-700 hover:bg-rose-800'}`}>
        {ct('enter')} <Arrow className="w-4 h-4" />
      </button>
    </article>
  );
  return (
    <section className="mb-8 space-y-5" data-testid="sections-gateway">
      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-black text-stone-900">{ct('homeTitle')}</h1>
        <p className="text-sm text-stone-600 max-w-2xl mx-auto">{ct('homeSubtitle')}</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {card('perfumes', ct('navPerfumes'), ct('perfumeCardText'), perfumeTools, 'amber', '🌹', 'perfumes')}
        {card('cosmetics', ct('sectionCosmetics'), ct('cosmeticCardText'), cosmeticTools, 'rose', '🧴', 'cosmetics')}
      </div>
      {/* «مساحة شاهين»: the general assistant — open to any subject, not only perfume and cosmetics. */}
      <button type="button" onClick={() => onNavigate('workspace')} data-testid="gateway-workspace"
        className="w-full flex items-center gap-4 rounded-3xl border border-violet-200 bg-gradient-to-br from-stone-900 via-stone-800 to-violet-900 p-5 text-start text-white shadow-xs hover:shadow-md cursor-pointer">
        <span className="text-4xl" aria-hidden>🦅</span>
        <span className="flex-1 min-w-0">
          <span className="block text-lg sm:text-xl font-black">{wsText(currentLang, 'title')}</span>
          <span className="block text-xs sm:text-sm text-violet-100/90 leading-relaxed">{wsText(currentLang, 'subtitle')}</span>
        </span>
        <Arrow className="w-5 h-5 shrink-0" />
      </button>
    </section>
  );
}
