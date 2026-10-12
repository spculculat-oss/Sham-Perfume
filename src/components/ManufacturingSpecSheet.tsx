import React, { useEffect, useState } from 'react';
import { Printer, X, CheckCircle, Calendar, Hash, User, ShieldCheck, ArrowRight, ArrowLeft, Copy, Check } from 'lucide-react';
import {
  CalculationResult,
  FormulationState,
  PyramidNote,
  SavedFormula,
} from '../types/perfume';
import { calculatePyramidBreakdown, formatNum } from '../utils/calculations';

import { UserDetailedAddress, FACILITY_TYPE_LABELS } from '../types/address';
import { SupportedLanguage } from '../types/i18n';
import { isRTL, getCommonLabel } from '../utils/localizedContent';

interface ManufacturingSpecSheetProps {
  formulaTitle: string;
  author: string;
  batchCode: string;
  notes: string;
  macerationDays: number;
  formulation: FormulationState;
  pyramidNotes: PyramidNote[];
  calculationResult: CalculationResult;
  detailedAddress?: UserDetailedAddress;
  currentLang?: SupportedLanguage;
  onClose: () => void;
}

export const ManufacturingSpecSheet: React.FC<ManufacturingSpecSheetProps> = ({
  formulaTitle,
  author,
  batchCode,
  notes,
  macerationDays,
  formulation,
  pyramidNotes,
  calculationResult,
  detailedAddress,
  currentLang = 'ar',
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const rtl = isRTL(currentLang);
  const ActionArrow = rtl ? ArrowLeft : ArrowRight;

  const currentDate = new Date().toISOString().split('T')[0];
  const targetDate = new Date(Date.now() + macerationDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const breakdown = calculatePyramidBreakdown(
    pyramidNotes,
    calculationResult.oilWeightGrams,
    calculationResult.oilVolumeMl
  );

  // Close on Escape key press and lock background scroll
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handlePrint = () => {
    window.print();
  };

  const handleCopySummary = () => {
    const text = `📋 [بطاقة تصنيع معملية - صمم عطرك مع شام]
العطر: ${formulaTitle || 'عطر مخصص'} (${batchCode})
المصمم: ${author || 'معمل شام'} | التاريخ: ${currentDate}
الحجم: ${formulation.bottleVolumeMl} مل × ${formulation.batchCount} عبوة (${formulation.concentrationPercent}% - ${formulation.concentrationType.toUpperCase()})
الزيت العطري الخام: ${formatNum(calculationResult.oilWeightGrams)} جم (${formatNum(calculationResult.batchTotalOilGrams)} جم للتشغيلة)
الكحول الإيثيلي: ${formatNum(calculationResult.alcoholWeightGrams)} جم (${formatNum(calculationResult.batchTotalAlcoholGrams)} جم للتشغيلة)
المثبت: ${formatNum(calculationResult.fixativeWeightGrams)} جم | الماء: ${formatNum(calculationResult.waterWeightGrams)} جم
صافي الزجاجة: ${formatNum(calculationResult.totalWeightGrams)} جم | إجمالي التشغيلة: ${formatNum(calculationResult.batchTotalWeightGrams)} جم
فترة التعتيق: ${macerationDays} يوماً (جاهز في ${targetDate})`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white w-full max-w-4xl rounded-2xl sm:rounded-3xl shadow-2xl border border-stone-200 overflow-hidden text-stone-900 print:border-none print:shadow-none print:rounded-none relative my-4 sm:my-8"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Sticky Top Modal Controls (Hidden in Print) */}
        <div className="sticky top-0 z-50 p-3.5 sm:p-4 bg-stone-950 text-white flex items-center justify-between no-print shadow-lg border-b border-stone-800">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs sm:text-sm font-bold truncate max-w-[200px] sm:max-w-none text-stone-100">
              {rtl ? 'بطاقة مواصفات تصنيع العطر الرسمية (Batch Spec Sheet)' : 'Official Perfume Formulation & Batch Manufacturing Spec Sheet'}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopySummary}
              className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              title={rtl ? 'نسخ ملخص البطاقة' : 'Copy summary'}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copied ? (rtl ? 'تم النسخ!' : 'Copied!') : (rtl ? 'نسخ' : 'Copy')}</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-amber-700 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{rtl ? 'طباعة' : 'Print Spec Sheet'}</span>
            </button>
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-md border border-rose-500 hover:scale-105 active:scale-95"
              title={rtl ? 'إغلاق التقرير (Escape)' : 'Close'}
            >
              <X className="w-4 h-4" />
              <span>{rtl ? 'إغلاق ✕' : 'Close ✕'}</span>
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-8 sm:p-10 space-y-8 bg-white print:p-0">
          
          {/* Header Brand Lockup */}
          <div className="flex justify-between items-start border-b-2 border-stone-900 pb-6">
            <div>
              <div className="text-2xl font-bold tracking-tight text-stone-950 font-serif-luxury">
                {rtl ? 'صمم عطرك مع شام · مختبر وحاسبة العطور' : 'Sham Perfume Atelier & Compounding Laboratory'}
              </div>
              <div className="text-xs text-stone-500 mt-1">
                {rtl ? 'وثيقة تصنيع وتشغيلة إنتاج عطرية معتمدة وفق معايير الجودة والتعتيق' : 'Certified Production Batch Specification & Quality Control Document'}
              </div>
            </div>
            <div className={`${rtl ? 'text-left' : 'text-right'} font-mono-numbers text-xs space-y-1`}>
              <div>
                <span className="text-stone-400">{rtl ? 'رقم التشغيلة: ' : 'Batch ID: '}</span>
                <span className="font-bold text-stone-900">{batchCode || 'SHAM-BATCH-01'}</span>
              </div>
              <div>
                <span className="text-stone-400">{rtl ? 'تاريخ الإصدار: ' : 'Date Issued: '}</span>
                <span>{currentDate}</span>
              </div>
              <div>
                <span className="text-stone-400">{rtl ? 'اكتمال التعتيق: ' : 'Target Maceration: '}</span>
                <span className="font-semibold text-amber-900">{targetDate} ({macerationDays} {rtl ? 'يوم' : 'Days'})</span>
              </div>
            </div>
          </div>

          {/* Perfume Identity Card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-stone-50 rounded-xl border border-stone-200/80 text-xs">
            <div>
              <span className="text-stone-400 block text-[10px]">{rtl ? 'اسم العطر' : 'Fragrance Title'}</span>
              <span className="font-bold text-stone-900 text-sm">{formulaTitle || (rtl ? 'عطر مخصص' : 'Bespoke Perfume')}</span>
            </div>
            <div>
              <span className="text-stone-400 block text-[10px]">{rtl ? 'مصمم العطر / المعمل' : 'Perfumer / Atelier'}</span>
              <span className="font-semibold text-stone-900">{author || (rtl ? 'معمل شام' : 'Sham Atelier')}</span>
            </div>
            <div>
              <span className="text-stone-400 block text-[10px]">{rtl ? 'حجم الزجاجة والكمية' : 'Bottle Volume & Batch'}</span>
              <span className="font-semibold text-stone-900 font-mono-numbers">
                {formulation.bottleVolumeMl} ml × {formulation.batchCount} {rtl ? 'عبوة' : 'Bottles'}
              </span>
            </div>
            <div>
              <span className="text-stone-400 block text-[10px]">{rtl ? 'فئة التركيز' : 'Concentration'}</span>
              <span className="font-bold text-amber-900 font-mono-numbers">
                {formulation.concentrationPercent}% ({formulation.concentrationType.toUpperCase()})
              </span>
            </div>
          </div>

          {/* Perfume Atelier Facility & Detailed Address Lockup */}
          {detailedAddress && (
            <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/80 text-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm">📍</span>
                <span className="font-bold text-stone-900">
                  {detailedAddress.labOrFacilityName || (rtl ? 'مقر المعمل العطري' : 'Atelier Facility')}:
                </span>
                <span className="text-stone-600">
                  {detailedAddress.city}
                  {detailedAddress.district ? `، ${detailedAddress.district}` : ''}
                  {detailedAddress.street ? `، ${detailedAddress.street}` : ''}
                  {` — ${rtl ? detailedAddress.countryNameAr : (detailedAddress.countryNameEn || detailedAddress.countryNameAr)}`}
                </span>
              </div>
              <div className="flex items-center gap-3 text-stone-500 font-mono text-[11px]">
                {detailedAddress.postalCode && (
                  <span>{rtl ? 'الرمز البريدي: ' : 'ZIP: '}{detailedAddress.postalCode}</span>
                )}
                {detailedAddress.phoneNumber && (
                  <span>{rtl ? 'الهاتف: ' : 'Tel: '}{detailedAddress.phoneNumber}</span>
                )}
              </div>
            </div>
          )}

          {/* Primary Formula Breakdown Table */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
              {rtl ? '1. جدول المقادير الكيميائية الأساسية (Formulation Breakdown)' : '1. Core Chemical Formulation Breakdown'}
            </h4>
            <div className="border border-stone-200 rounded-xl overflow-hidden">
              <table className={`w-full ${rtl ? 'text-right' : 'text-left'} text-xs`}>
                <thead className="bg-stone-100 text-stone-700 font-semibold border-b border-stone-200">
                  <tr>
                    <th className="py-2.5 px-4">{rtl ? 'المكون الكيميائي' : 'Chemical Component'}</th>
                    <th className="py-2.5 px-4">{rtl ? 'النسبة المئوية' : 'Ratio %'}</th>
                    <th className="py-2.5 px-4 font-mono-numbers">{rtl ? 'الوزن للعبوة (جم)' : 'Per Bottle (g)'}</th>
                    <th className="py-2.5 px-4 font-mono-numbers">{rtl ? 'الحجم للعبوة (مل)' : 'Per Bottle (ml)'}</th>
                    <th className="py-2.5 px-4 font-mono-numbers">{rtl ? `إجمالي التشغيلة (${formulation.batchCount})` : `Total Batch (${formulation.batchCount})`}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-mono-numbers">
                  <tr>
                    <td className="py-2.5 px-4 font-sans font-medium text-stone-900">
                      {rtl ? 'مركب الزيت العطري الخام (Fragrance Oil)' : 'Raw Fragrance Oil Compound'}
                    </td>
                    <td className="py-2.5 px-4">{formatNum(calculationResult.oilPercent, 1)}%</td>
                    <td className="py-2.5 px-4 font-bold text-amber-900">{formatNum(calculationResult.oilWeightGrams)} g</td>
                    <td className="py-2.5 px-4">{formatNum(calculationResult.oilVolumeMl)} ml</td>
                    <td className="py-2.5 px-4 font-bold">{formatNum(calculationResult.batchTotalOilGrams)} g</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-sans font-medium text-stone-900">
                      {rtl ? 'الكحول الإيثيلي الطبي (Ethanol Alcohol)' : 'Medical Perfumer Ethanol (Alcohol)'}
                    </td>
                    <td className="py-2.5 px-4">{formatNum(calculationResult.alcoholPercent, 1)}%</td>
                    <td className="py-2.5 px-4 font-bold">{formatNum(calculationResult.alcoholWeightGrams)} g</td>
                    <td className="py-2.5 px-4">{formatNum(calculationResult.alcoholVolumeMl)} ml</td>
                    <td className="py-2.5 px-4 font-bold">{formatNum(calculationResult.batchTotalAlcoholGrams)} g</td>
                  </tr>
                  {calculationResult.waterPercent > 0 && (
                    <tr>
                      <td className="py-2.5 px-4 font-sans font-medium text-stone-900">
                        {rtl ? 'ماء مقطر نقي (Pure Distilled Water)' : 'Pure Medical Distilled Water'}
                      </td>
                      <td className="py-2.5 px-4">{formatNum(calculationResult.waterPercent, 1)}%</td>
                      <td className="py-2.5 px-4">{formatNum(calculationResult.waterWeightGrams)} g</td>
                      <td className="py-2.5 px-4">{formatNum(calculationResult.waterVolumeMl)} ml</td>
                      <td className="py-2.5 px-4 font-bold">{formatNum(calculationResult.batchTotalWaterGrams)} g</td>
                    </tr>
                  )}
                  {calculationResult.fixativePercent > 0 && (
                    <tr>
                      <td className="py-2.5 px-4 font-sans font-medium text-stone-900">
                        {rtl ? 'مثبت عطري (DPG / IPM / Iso E Super)' : 'Fixative (DPG / IPM / Iso E Super)'}
                      </td>
                      <td className="py-2.5 px-4">{formatNum(calculationResult.fixativePercent, 1)}%</td>
                      <td className="py-2.5 px-4">{formatNum(calculationResult.fixativeWeightGrams)} g</td>
                      <td className="py-2.5 px-4">{formatNum(calculationResult.fixativeVolumeMl)} ml</td>
                      <td className="py-2.5 px-4 font-bold">{formatNum(calculationResult.batchTotalFixativeGrams)} g</td>
                    </tr>
                  )}
                  <tr className="bg-stone-50/80 font-bold text-stone-950">
                    <td className="py-3 px-4 font-sans">{rtl ? 'الصافي الإجمالي للعبوة والتشغيلة' : 'Total Batch Compounding Yield'}</td>
                    <td className="py-3 px-4">100%</td>
                    <td className="py-3 px-4">{formatNum(calculationResult.totalWeightGrams)} g</td>
                    <td className="py-3 px-4">{calculationResult.totalVolumeMl} ml</td>
                    <td className="py-3 px-4 text-amber-900">{formatNum(calculationResult.batchTotalWeightGrams)} g ({formatNum(calculationResult.batchTotalVolumeMl / 1000, 2)} L)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Pyramid Breakdown Table (if notes present) */}
          {breakdown.notesWithQuantities.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                {rtl ? '2. تفاصيل وتوزيع الهرم العطري (Olfactory Notes Spec)' : '2. Olfactory Pyramid Note Distribution Spec'}
              </h4>
              <div className="border border-stone-200 rounded-xl overflow-hidden">
                <table className={`w-full ${rtl ? 'text-right' : 'text-left'} text-xs`}>
                  <thead className="bg-stone-100 text-stone-700 font-semibold border-b border-stone-200">
                    <tr>
                      <th className="py-2.5 px-4">{rtl ? 'اسم النوتة / الزيت' : 'Fragrance Note / Oil'}</th>
                      <th className="py-2.5 px-4">{rtl ? 'الطبقة الهرمية' : 'Pyramid Level'}</th>
                      <th className="py-2.5 px-4">{rtl ? 'النسبة من الزيت' : '% of Oil'}</th>
                      <th className="py-2.5 px-4 font-mono-numbers">{rtl ? 'الوزن للعبوة (جم)' : 'Per Bottle (g)'}</th>
                      <th className="py-2.5 px-4 font-mono-numbers">{rtl ? 'إجمالي التشغيلة' : 'Batch Total'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 font-mono-numbers">
                    {breakdown.notesWithQuantities.map((note) => (
                      <tr key={note.id}>
                        <td className="py-2.5 px-4 font-sans font-medium text-stone-900">
                          {rtl ? note.nameAr : (note.nameEn || note.nameAr)}
                        </td>
                        <td className="py-2.5 px-4 font-sans text-stone-600">
                          {note.category === 'top'
                            ? (rtl ? 'قمة (Top)' : 'Top Note')
                            : note.category === 'heart'
                            ? (rtl ? 'قلب (Heart)' : 'Heart Note')
                            : (rtl ? 'قاعدة (Base)' : 'Base Note')}
                        </td>
                        <td className="py-2.5 px-4">{note.percentageOfOil}%</td>
                        <td className="py-2.5 px-4 font-semibold text-amber-900">
                          {formatNum(note.weightGrams)} g
                        </td>
                        <td className="py-2.5 px-4 font-bold">
                          {formatNum(note.weightGrams * formulation.batchCount)} g
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Laboratory Instructions & Quality Protocols */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs">
            <div className="p-4 bg-stone-50 rounded-xl border border-stone-200/80 space-y-2">
              <span className="font-bold text-stone-900 block">{rtl ? 'بروتوكول الخلط في المعمل:' : 'Laboratory Compounding Protocol:'}</span>
              <ul className="space-y-1 list-disc list-inside text-stone-600 text-[11px] leading-relaxed">
                <li>{rtl ? 'استخدام ميزان رقمي بدقة 0.01 جرام.' : 'Precision analytical balance (0.01g resolution).'}</li>
                <li>{rtl ? 'خلط نوتات الزيوت العطرية أولاً في درجة حرارة 20°C - 24°C.' : 'Blend raw concentrate first at controlled 20°C - 24°C.'}</li>
                <li>{rtl ? 'إضافة الكحول المصفى والإغلاق المحكم الفوري لمنع تبخر النوتات العلوية.' : 'Add perfumer ethanol; seal hermetically to preserve head notes.'}</li>
                <li>{rtl ? 'ترج الزجاجة بلطف لمدة دقيقة واحدة حتى تمام التجانس.' : 'Gentle uniform agitation for 60 seconds until complete clarity.'}</li>
              </ul>
            </div>

            <div className="p-4 bg-stone-50 rounded-xl border border-stone-200/80 space-y-2">
              <span className="font-bold text-stone-900 block">{rtl ? 'شروط التعتيق والحفظ:' : 'Maceration & Quality Conditions:'}</span>
              <ul className="space-y-1 list-disc list-inside text-stone-600 text-[11px] leading-relaxed">
                <li>{rtl ? 'الحفظ في مكان مظلم تماماً بعيداً عن أشعة الشمس والحرارة.' : 'Total darkness in amber glass containers.'}</li>
                <li>{rtl ? 'درجة حرارة التخزين المثالية: 15°C إلى 18°C.' : 'Optimal cellar temperature: 15°C - 18°C.'}</li>
                <li>{rtl ? `التعتيق المستهدف: ${macerationDays} يوماً لإتمام استقرار الروابط الجزيئية.` : `Target maceration period: ${macerationDays} days for esterification.`}</li>
                <li>{rtl ? 'إجراء اختبار الفلترة (Filtration) قبل التعبئة النهائية عند اللزوم.' : 'Perform lab micro-filtration prior to final bottling.'}</li>
              </ul>
            </div>
          </div>

          {/* Signatures Footer */}
          <div className="pt-8 border-t border-stone-200 grid grid-cols-2 gap-8 text-xs">
            <div>
              <span className="text-stone-400 block text-[10px]">{rtl ? 'مسؤول التركيب والتصنيع:' : 'Compounding Chemist / Formulator:'}</span>
              <div className="mt-4 border-b border-stone-300 w-48" />
              <span className="text-[11px] text-stone-600 mt-1 block">{rtl ? 'التوقيع والاعتماد' : 'Signature & Date'}</span>
            </div>
            <div className={rtl ? 'text-left' : 'text-right'}>
              <span className="text-stone-400 block text-[10px]">{rtl ? 'مراقبة الجودة وفحص المعمل:' : 'Quality Control & Lab Inspection:'}</span>
              <div className={`mt-4 border-b border-stone-300 w-48 ${rtl ? 'mr-auto' : 'ml-auto'}`} />
              <span className="text-[11px] text-stone-600 mt-1 block">{rtl ? 'ختم التشغيلة' : 'Batch Stamp & Release'}</span>
            </div>
          </div>

        </div>

        {/* Bottom Actions Bar (Hidden in Print) */}
        <div className="p-4 sm:p-6 bg-stone-100 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 sm:px-5 py-2.5 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>{rtl ? 'طباعة المستند الرسمي' : 'Print Official Document'}</span>
            </button>
            <button
              onClick={handleCopySummary}
              className="px-3.5 sm:px-4 py-2.5 bg-white hover:bg-stone-50 text-stone-800 border border-stone-300 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 cursor-pointer transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? (rtl ? 'تم النسخ بنجاح' : 'Copied!') : (rtl ? 'نسخ ملخص البطاقة' : 'Copy Spec Summary')}</span>
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-5 sm:px-6 py-2.5 bg-stone-900 hover:bg-rose-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer shadow-md transition-all hover:scale-102"
          >
            <X className="w-4 h-4 text-rose-300" />
            <span>{rtl ? 'إغلاق التقرير والعودة لحاسبة المعمل' : 'Close and Return to Workbench'}</span>
          </button>
        </div>

      </div>

      {/* Floating Corner Quick-Close Button (Always visible on all screens regardless of scroll position) */}
      <div className={`fixed bottom-6 ${rtl ? 'left-6' : 'right-6'} z-50 no-print`}>
        <button
          onClick={onClose}
          className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-2xl border-2 border-white/40 cursor-pointer transition-all hover:scale-105 active:scale-95 animate-in fade-in"
          title={rtl ? 'إغلاق التقرير فوراً (Escape)' : 'Close Spec Sheet (Escape)'}
        >
          <X className="w-4 h-4" />
          <span>{rtl ? 'إغلاق التقرير ✕' : 'Close ✕'}</span>
        </button>
      </div>

    </div>
  );
};
