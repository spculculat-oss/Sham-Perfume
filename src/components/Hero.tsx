import React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Beaker,
  Scale,
  Newspaper,
  Award,
  FlaskConical,
  Flame,
} from 'lucide-react';
import heroImg from '../assets/images/hero_luxury_perfume_1791692409081.jpg';
import newsImg from '../assets/images/luxury_perfume_exhibition_1791696134494.jpg';

import { SupportedLanguage } from '../types/i18n';
import { t } from '../utils/i18n';
import { isRTL } from '../utils/localizedContent';

interface HeroProps {
  onQuickStart: (mode: string) => void;
  currentLang?: SupportedLanguage;
}

export const Hero: React.FC<HeroProps> = ({ onQuickStart, currentLang = 'ar' }) => {
  const rtl = isRTL(currentLang);
  const ActionArrow = rtl ? ArrowLeft : ArrowRight;

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-stone-900 via-stone-900 to-stone-950 text-white border-b border-stone-800 pt-6 sm:pt-10 pb-12 sm:pb-16 no-print">
      
      {/* Subtle Luxury Golden Ambient Glow */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-amber-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-10 w-[400px] h-[400px] bg-amber-800/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-8 relative z-10">
        
        {/* World News Ticker Strip at the Top of Hero */}
        <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-stone-800/70 backdrop-blur-md rounded-2xl p-3 sm:px-5 border border-stone-700/80 shadow-md">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 text-white text-[11px] font-bold tracking-wider flex items-center gap-1.5 shadow-sm shrink-0">
              <Flame className="w-3.5 h-3.5 fill-white text-white" />
              <span>{rtl ? 'أخبار العطور العالمية' : 'World Perfume Trends'}</span>
            </span>
            <span className="text-xs text-stone-300 font-medium truncate max-w-xl">
              {rtl
                ? 'إيسنس ميلانو وبيوتي وورلد: تصدر نوتات الشاي الصيني، الورد الطبيعي، والعود المعتق لعام 2026.'
                : 'Esxence Milan & Beautyworld: Smoked tea, natural bio-rose, and aged oud prevail in 2026.'}
            </span>
          </div>

          <button
            onClick={() => onQuickStart('perfume_news')}
            className={`text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 shrink-0 transition-colors cursor-pointer ${rtl ? 'mr-auto sm:mr-0' : 'ml-auto sm:ml-0'}`}
          >
            <span>{rtl ? 'استعراض الأخبار والصيحات' : 'Explore Trends & Reports'}</span>
            <ActionArrow className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Content Column */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/15 text-amber-300 text-xs font-semibold border border-amber-500/30">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>{rtl ? 'المنصة الاحترافية الأولى لخبراء ومصممي العطور' : 'Premier Professional Suite for Master Perfumers'}</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.2] font-serif-luxury text-balance text-white">
                {t('hero_title', currentLang)}
              </h1>
            </div>

            <p className="text-stone-300 text-xs sm:text-base leading-relaxed max-w-2xl font-light">
              {t('hero_desc', currentLang)}
            </p>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => onQuickStart('concentration')}
                className="flex items-center gap-2 px-6 py-3.5 text-xs sm:text-sm font-bold text-stone-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 hover:from-amber-300 hover:to-amber-200 rounded-xl shadow-lg shadow-amber-900/30 transition-all hover:scale-[1.02] cursor-pointer"
              >
                <FlaskConical className="w-4 h-4 text-stone-900" />
                <span>{t('hero_btn_calc', currentLang)}</span>
                <ActionArrow className="w-4 h-4" />
              </button>

              <button
                onClick={() => onQuickStart('perfume_news')}
                className="flex items-center gap-2 px-5 py-3.5 text-xs sm:text-sm font-semibold text-stone-200 bg-stone-800/90 hover:bg-stone-700/90 border border-stone-700 rounded-xl transition-all cursor-pointer"
              >
                <Newspaper className="w-4 h-4 text-amber-400" />
                <span>{t('hero_btn_news', currentLang)}</span>
              </button>

              <button
                onClick={() => onQuickStart('master_ai')}
                className="flex items-center gap-2 px-5 py-3.5 text-xs sm:text-sm font-semibold text-stone-200 bg-stone-800/90 hover:bg-stone-700/90 border border-stone-700 rounded-xl transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>{t('hero_btn_ai', currentLang)}</span>
              </button>
            </div>

            {/* Feature Highlights */}
            <div className="pt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-stone-400">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{rtl ? 'دقة الكثافة النوعية (g / ml)' : 'Specific Gravity Density (g/ml)'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{rtl ? 'تحديثات IFRA ومعايير السلامة' : 'IFRA Standard Compliance'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{rtl ? 'أشهر الوصفات العالمية والأخبار' : 'Iconic Formulas & Trends'}</span>
              </div>
            </div>
          </div>

          {/* Right Column: High Graphics Visual Showcase */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-amber-600/30 bg-stone-950 aspect-[16/12] group">
              <img
                src={heroImg}
                alt="قارورة عطر فاخرة في مختبر تصميم العطور مع شام"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-6">
                <div className="text-white space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-semibold text-amber-300">
                      {rtl ? 'معمل صمم عطرك مع شام الحرفي' : 'Sham Haute Parfumerie Atelier'}
                    </span>
                  </div>
                  <p className="text-sm sm:text-base font-bold font-serif-luxury text-stone-100">
                    {rtl
                      ? '«العطر هو الذاكرة التي لا تشيخ.. نصنعه بالنسب المحسوبة والشغف الخالص»'
                      : '«Fragrance is memory that never ages.. crafted with calibrated precision and pure passion»'}
                  </p>
                </div>
              </div>
            </div>

            {/* Floating Graphic Badge */}
            <div className={`absolute -bottom-4 ${rtl ? '-right-4' : '-left-4'} bg-stone-900/95 backdrop-blur-md border border-amber-500/40 rounded-2xl p-3 shadow-xl flex items-center gap-3 hidden sm:flex`}>
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold font-serif-luxury text-lg border border-amber-500/30">
                0.01
              </div>
              <div className={rtl ? 'text-right' : 'text-left'}>
                <div className="text-xs font-bold text-white">{rtl ? 'دقة الميزان الكيميائي' : 'Analytical Balance 0.01g'}</div>
                <div className="text-[10px] text-stone-400">{rtl ? 'حساب كثافة الزيت 0.92g/ml' : 'Oil Density Calibrated 0.92g/ml'}</div>
              </div>
            </div>
          </div>

        </div>

        {/* 4-Item Luxury KPI Strip */}
        <div className="mt-12 pt-8 border-t border-stone-800 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className="space-y-1 bg-stone-850/50 p-4 rounded-2xl border border-stone-800">
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono-numbers">
              6
            </div>
            <div className="text-xs text-stone-300 font-medium">
              {rtl ? 'مستويات تركيز قياسية (Extrait إلى Mist)' : 'Standard Strengths (Extrait to Mist)'}
            </div>
          </div>
          <div className="space-y-1 bg-stone-850/50 p-4 rounded-2xl border border-stone-800">
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono-numbers">
              0.01g
            </div>
            <div className="text-xs text-stone-300 font-medium">
              {rtl ? 'دقة ميزان المعمل بالكثافة النوعية' : 'Gravimetric 0.01g Scale Precision'}
            </div>
          </div>
          <div className="space-y-1 bg-stone-850/50 p-4 rounded-2xl border border-stone-800">
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono-numbers">
              IFRA 51
            </div>
            <div className="text-xs text-stone-300 font-medium">
              {rtl ? 'أحدث المعايير ولوائح السلامة الدولية' : 'Latest IFRA 51 Safety Compliance'}
            </div>
          </div>
          <div className="space-y-1 bg-stone-850/50 p-4 rounded-2xl border border-stone-800">
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono-numbers">
              100%
            </div>
            <div className="text-xs text-stone-300 font-medium">
              {rtl ? 'حساب التكاليف والأرباح وبطاقات التصنيع' : 'Costing Margins & Production Spec'}
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};
