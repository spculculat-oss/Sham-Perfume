import React, { useState } from 'react';
import { Check, ChevronDown, Languages } from 'lucide-react';
import { SupportedLanguage, SUPPORTED_LANGUAGES, LanguageConfig } from '../types/i18n';
import { LText, makeT } from '../utils/localize';
import { isRTL } from '../utils/localizedContent';

// =========================================
// TOP LANGUAGE HUB — the unified language section at the top of the page.
// Holds the full platform language switcher (all languages, flag grid) and
// the trust-badge row, moved here from the footer so language switching and
// the former bottom-of-page items live in one integrated place up top.
// =========================================

const S = {
  lang_title: { ar: 'خانة تغيير لغة المنصة', en: 'Platform Language Selector', fr: 'Sélecteur de langue de la plateforme', es: 'Selector de idioma de la plataforma', it: 'Selettore lingua della piattaforma', de: 'Sprachauswahl der Plattform', ru: 'Выбор языка платформы', zh: '平台语言选择器', tr: 'Platform dil seçici', fa: 'انتخابگر زبان پلتفرم' },
  lang_sub: { ar: 'اختر لغة العرض المناسبة لك مع التبديل التلقائي لاتجاه النصوص والواجهة (RTL ⇄ LTR)', en: 'Choose your display language with automatic text and layout direction switching (RTL ⇄ LTR)', fr: 'Choisissez votre langue d’affichage avec bascule automatique du sens du texte (RTL ⇄ LTR)', es: 'Elige tu idioma de visualización con cambio automático de dirección (RTL ⇄ LTR)', it: 'Scegli la lingua di visualizzazione con inversione automatica della direzione (RTL ⇄ LTR)', de: 'Wählen Sie Ihre Anzeigesprache mit automatischer Richtungsänderung (RTL ⇄ LTR)', ru: 'Выберите язык интерфейса с автоматическим переключением направления текста (RTL ⇄ LTR)', zh: '选择您的显示语言，自动切换文字与界面方向（RTL ⇄ LTR）', tr: 'Yön otomatik değişimiyle (RTL ⇄ LTR) görüntüleme dilinizi seçin', fa: 'زبان نمایش خود را با تغییر خودکار جهت متن و رابط (RTL ⇄ LTR) انتخاب کنید' },
  badge_scale: { ar: 'دقة ميزان المعمل (0.01g)', en: 'Lab scale precision (0.01g)', fr: 'Précision de balance (0,01 g)', es: 'Precisión de balanza (0.01g)', it: 'Precisione della bilancia (0.01g)', de: 'Waagengenauigkeit (0,01 g)', ru: 'Точность весов (0.01 г)', zh: '实验室天平精度（0.01g）', tr: 'Terazi hassasiyeti (0.01g)', fa: 'دقت ترازوی آزمایشگاه (۰.۰۱ گرم)' },
  badge_ifra: { ar: 'معايير IFRA 51 الدولية', en: 'IFRA 51 International Standards', fr: 'Normes internationales IFRA 51', es: 'Normas internacionales IFRA 51', it: 'Norme internazionali IFRA 51', de: 'IFRA 51 internationale Normen', ru: 'Международные стандарты IFRA 51', zh: 'IFRA 51 国际标准', tr: 'IFRA 51 uluslararası standartları', fa: 'استانداردهای بین‌المللی IFRA 51' },
  badge_encyclopedia: { ar: 'موسوعة الخامات العالمية', en: 'World Raw Materials Encyclopedia', fr: 'Encyclopédie mondiale des matières premières', es: 'Enciclopedia mundial de materias primas', it: 'Enciclopedia mondiale delle materie prime', de: 'Weltweite Rohstoff-Enzyklopädie', ru: 'Мировая энциклопедия сырья', zh: '世界原料百科', tr: 'Dünya hammadde ansiklopedisi', fa: 'دانشنامه جهانی مواد اولیه' },
  badge_observatory: { ar: 'مرصد أخبار العطور', en: 'Fragrance News Observatory', fr: 'Observatoire des actualités parfum', es: 'Observatorio de noticias del perfume', it: 'Osservatorio delle notizie sul profumo', de: 'Duftnews-Observatorium', ru: 'Обсерватория новостей парфюмерии', zh: '香水资讯观察站', tr: 'Parfüm haber gözlemevi', fa: 'رصدخانه اخبار عطر' },
} satisfies Record<string, LText>;

interface TopLanguageHubProps {
  currentLang?: SupportedLanguage;
  onSelectLanguage?: (lang: SupportedLanguage) => void;
}

export const TopLanguageHub: React.FC<TopLanguageHubProps> = ({
  currentLang = 'ar',
  onSelectLanguage,
}) => {
  const rtl = isRTL(currentLang);
  const L = makeT(currentLang, S);
  const [expanded, setExpanded] = useState(true);

  return (
    <section className="bg-stone-950 text-stone-300 border-b border-stone-800 no-print" aria-label={L('lang_title')}>
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-5">
        {/* Section header: title, count badge, subtitle, collapse toggle */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
              <Languages className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-bold text-white flex items-center gap-2">
                <span>{L('lang_title')}</span>
                <span className="text-[10px] text-amber-400 font-normal border border-amber-500/30 px-1.5 py-0.2 rounded-full">
                  Platform Language ({SUPPORTED_LANGUAGES.length} Languages)
                </span>
              </span>
              <span className="text-xs text-stone-400 block mt-0.5">
                {L('lang_sub')}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={L('lang_title')}
            className="self-start md:self-center shrink-0 w-8 h-8 rounded-lg border border-stone-700 bg-stone-900/60 hover:bg-stone-900 hover:border-amber-700/60 text-stone-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {expanded && (
          <>
            {/* Full language grid (moved from the footer, unchanged) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 max-h-64 overflow-y-auto pe-1">
              {SUPPORTED_LANGUAGES.map((lang: LanguageConfig) => {
                const isActive = lang.code === currentLang;
                return (
                  <button
                    key={lang.code}
                    onClick={() => onSelectLanguage && onSelectLanguage(lang.code)}
                    className={`p-2.5 rounded-xl border ${rtl ? 'text-right' : 'text-left'} transition-all flex items-center justify-between cursor-pointer group ${
                      isActive
                        ? 'bg-amber-950/60 border-amber-500 text-white shadow-sm ring-1 ring-amber-500/30'
                        : 'bg-stone-900/60 hover:bg-stone-900 border-stone-800 hover:border-amber-700/60 text-stone-300 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-base group-hover:scale-110 transition-transform">
                        {lang.flag}
                      </span>
                      <div className="truncate">
                        <div className="font-bold text-xs truncate">{lang.nativeName}</div>
                        <div className="text-[10px] text-stone-500 truncate font-mono">
                          {lang.name} · {lang.dir.toUpperCase()}
                        </div>
                      </div>
                    </div>
                    {isActive && (
                      <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 stroke-[3]" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Trust badges (moved from the footer's bottom bar, unchanged) */}
            <div className="pt-4 mt-4 border-t border-stone-850 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-stone-400">
              <span>{L('badge_scale')}</span>
              <span aria-hidden="true">·</span>
              <span>{L('badge_ifra')}</span>
              <span aria-hidden="true">·</span>
              <span>{L('badge_encyclopedia')}</span>
              <span aria-hidden="true">·</span>
              <span>{L('badge_observatory')}</span>
            </div>
          </>
        )}
      </div>
    </section>
  );
};
