import React from 'react';
import { BookOpen, Calculator, Clock, DollarSign, Droplets, FlaskConical, Layers, Wrench } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { makeT, type LText } from '../utils/localize';
import type { ShaheenTool, ToolLink } from '../utils/shaheenTools';

const S = {
  title: { ar: 'افتح في أدوات المعمل', en: 'Open in the lab tools', fr: 'Ouvrir dans les outils du labo', es: 'Abrir en las herramientas', de: 'In den Labor-Werkzeugen öffnen', tr: 'Laboratuvar araçlarında aç', fa: 'باز کردن در ابزارهای آزمایشگاه' },
  concentration: { ar: 'حاسبة التركيب', en: 'Compounding calculator', fr: 'Calculateur de formulation', es: 'Calculadora de formulación', de: 'Formulierungsrechner', tr: 'Formül hesaplayıcı', fa: 'ماشین‌حساب ترکیب' },
  pyramid: { ar: 'الهرم العطري', en: 'Fragrance pyramid', fr: 'Pyramide olfactive', es: 'Pirámide olfativa', de: 'Duftpyramide', tr: 'Koku piramidi', fa: 'هرم عطری' },
  maceration: { ar: 'محاكي التعتيق', en: 'Maceration simulator', fr: 'Simulateur de macération', es: 'Simulador de maceración', de: 'Mazerationssimulator', tr: 'Dinlendirme simülatörü', fa: 'شبیه‌ساز تعتیق' },
  alcohol: { ar: 'تخفيف الكحول', en: 'Alcohol dilution', fr: 'Dilution de l’alcool', es: 'Dilución de alcohol', de: 'Alkoholverdünnung', tr: 'Alkol seyreltme', fa: 'رقیق‌سازی الکل' },
  costing: { ar: 'التكاليف والأرباح', en: 'Cost & profit', fr: 'Coûts et marges', es: 'Costes y márgenes', de: 'Kosten & Gewinn', tr: 'Maliyet ve kâr', fa: 'هزینه و سود' },
  raw_materials: { ar: 'موسوعة الخامات', en: 'Raw materials', fr: 'Matières premières', es: 'Materias primas', de: 'Rohstoffe', tr: 'Hammaddeler', fa: 'مواد اولیه' },
  guide: { ar: 'دليل المثبتات والتعتيق', en: 'Fixatives & aging guide', fr: 'Guide fixateurs et vieillissement', es: 'Guía de fijadores', de: 'Fixateure & Reifung', tr: 'Sabitleyici rehberi', fa: 'راهنمای تثبیت‌کننده‌ها' },
  days: { ar: 'يوم', en: 'days', fr: 'jours', es: 'días', de: 'Tage', tr: 'gün', fa: 'روز' },
  ml: { ar: 'مل', en: 'ml' },
} satisfies Record<string, LText>;

const ICONS: Record<ShaheenTool, React.ComponentType<{ className?: string }>> = {
  concentration: FlaskConical, pyramid: Layers, maceration: Clock, alcohol: Droplets,
  costing: DollarSign, raw_materials: BookOpen, guide: Calculator,
};

/** Short summary of the values the tool will open with, e.g. «100 مل · 20%» or «96% → 70%». */
export function toolSummary(link: ToolLink, lang: SupportedLanguage): string {
  const L = makeT(lang, S);
  const parts: string[] = [];
  if (link.tool === 'alcohol') {
    if (link.alcoholFrom !== undefined) parts.push(link.alcoholTo !== undefined ? `${link.alcoholFrom}% → ${link.alcoholTo}%` : `${link.alcoholFrom}%`);
    if (link.finalVolumeMl !== undefined) parts.push(`${link.finalVolumeMl} ${L('ml')}`);
  } else if (link.tool === 'maceration') {
    if (link.macerationDays !== undefined) parts.push(`${link.macerationDays} ${L('days')}`);
  } else if (link.tool === 'raw_materials') {
    if (link.search) parts.push(link.search);
  } else {
    if (link.bottleVolumeMl !== undefined) parts.push(`${link.bottleVolumeMl} ${L('ml')}`);
    if (link.concentrationPercent !== undefined) parts.push(`${link.concentrationPercent}%`);
    if (link.concentrationType && link.concentrationType !== 'custom') parts.push(link.concentrationType.toUpperCase());
  }
  return parts.join(' · ');
}

/** The calculators that fit this answer, one tap each, opened with the values from the conversation. */
export function ShaheenToolLinks({ links, lang, onOpen }: { links: ToolLink[]; lang: SupportedLanguage; onOpen: (link: ToolLink) => void }) {
  if (!links.length) return null;
  const L = makeT(lang, S);
  return (
    <div className="mt-2 rounded-2xl border border-stone-200 bg-stone-50/80 p-2.5 space-y-2 text-xs" data-testid="shaheen-tool-links">
      <div className="flex items-center gap-1.5 font-bold text-stone-700 text-[11px]">
        <Wrench className="w-3.5 h-3.5 text-amber-700" />
        <span>{L('title')}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {links.map((link) => {
          const Icon = ICONS[link.tool];
          const summary = toolSummary(link, lang);
          return (
            <button
              key={link.tool}
              type="button"
              onClick={() => onOpen(link)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-amber-950 hover:bg-amber-50 transition-colors cursor-pointer"
            >
              <Icon className="w-3.5 h-3.5 text-amber-700" />
              <span>{L(link.tool)}</span>
              {summary && <span className="font-mono-numbers text-[10px] text-stone-500" dir="ltr">{summary}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
