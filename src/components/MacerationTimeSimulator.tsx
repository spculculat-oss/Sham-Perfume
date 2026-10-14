import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Thermometer,
  SunDim,
  Layers,
  Printer,
  Download,
  Share2,
  Bot,
  HelpCircle,
  RotateCcw,
  FlaskConical,
  Flame,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { SupportedLanguage } from '../types/i18n';
import { isRTL } from '../utils/localizedContent';

interface MacerationTimeSimulatorProps {
  currentLang?: SupportedLanguage;
  initialStartDate?: string;
  initialMacerationDays?: number;
  formulaTitle?: string;
  batchCode?: string;
  onOpenConsultation?: (prompt: string) => void;
  onMacerationDaysChange?: (days: number) => void;
  onStartDateChange?: (date: string) => void;
  onNavigateToTab?: (tab: string) => void;
}

interface MacerationPreset {
  id: string;
  nameAr: string;
  nameEn: string;
  days: number;
  categoryAr: string;
  categoryEn: string;
  descriptionAr: string;
  descriptionEn: string;
  idealTemp: string;
}

const MACERATION_PRESETS: MacerationPreset[] = [
  {
    id: 'citrus_aquatic',
    nameAr: 'العطور الحمضية والبحرية المنعشة',
    nameEn: 'Citrus & Marine Aquatics',
    days: 18,
    categoryAr: 'كولونيا وEDT خفيف',
    categoryEn: 'Cologne / Fresh EDT',
    descriptionAr: 'جزيئات ليمونين وبرغموت خفيفة سريعة الأكسدة؛ تعتيق قصير لحماية البريق والانتعاش الصيفي.',
    descriptionEn: 'Volatile citrus terpenes; short maceration preserves initial effervescence and fresh sparkle.',
    idealTemp: '14°C - 16°C',
  },
  {
    id: 'floral_fruity',
    nameAr: 'العطور الزهرية والفاكهية المتوازنة',
    nameEn: 'Floral Bouquets & Sweet Fruits',
    days: 30,
    categoryAr: 'أو دو بارفان (EDP)',
    categoryEn: 'Eau de Parfum (EDP)',
    descriptionAr: 'تتطلب 4 أسابيع لتتآلف نوتات الياسمين والورد مع الكحول وتختفي اللسعة الكحولية تماماً.',
    descriptionEn: 'Requires 4 weeks for rose, jasmine and fruit aldehydes to smoothly bind into perfumers ethanol.',
    idealTemp: '16°C - 18°C',
  },
  {
    id: 'woody_spicy',
    nameAr: 'العطور الخشبية والتابلية الدافئة',
    nameEn: 'Woody, Spices & Resins',
    days: 42,
    categoryAr: 'EDP فاخر / نيش',
    categoryEn: 'Luxury EDP / Niche',
    descriptionAr: 'خشب الأرز، الهيل، وخشب الصندل تحتاج 6 أسابيع لتشابك الروابط الإستيرية وتثبيت الفوحان.',
    descriptionEn: 'Cedar, sandalwood and cardamom require 6 weeks for deep ester cross-linking and diffusion aura.',
    idealTemp: '16°C - 18°C',
  },
  {
    id: 'oriental_oud_amber',
    nameAr: 'العطور الشرقية الثقيلة، العود والعنبر',
    nameEn: 'Oriental, Aged Oud & Ambergris',
    days: 55,
    categoryAr: 'إكستري دي بارفان (Extrait)',
    categoryEn: 'Extrait de Parfum',
    descriptionAr: 'الراتنجات الثقيلة، البخور، والعود المعتق تتطلب وقتاً طويلاً لتفكيك الحدة وظهور الدفء المخملي الملكي.',
    descriptionEn: 'Heavy balsamic resins and aged oud require 8 weeks to unlock sweet velvety opulence.',
    idealTemp: '17°C - 19°C',
  },
  {
    id: 'pure_attar_royal',
    nameAr: 'الخلطات المعتقة الفاخرة ودهن العود النقي',
    nameEn: 'Pure Aged Royal Attar / Niche Extrait',
    days: 75,
    categoryAr: 'تعتيق نيش ملكي طويل',
    categoryEn: 'Royal Maceration Masterpiece',
    descriptionAr: 'تعتيق كلاسيكي طويل للوصول إلى ذروة التناغم الكيميائي واستقرار وثبات يدوم لأيام على الأقمشة.',
    descriptionEn: 'Classic prolonged maceration achieving supreme olfactory harmony and multi-day textile tenacity.',
    idealTemp: '16°C - 18°C',
  },
];

export const MacerationTimeSimulator: React.FC<MacerationTimeSimulatorProps> = ({
  currentLang = 'ar',
  initialStartDate,
  initialMacerationDays = 30,
  formulaTitle = 'توليفة المعمل الملكية',
  batchCode = 'BATCH-SHAM-2026',
  onOpenConsultation,
  onMacerationDaysChange,
  onStartDateChange,
  onNavigateToTab,
}) => {
  const rtl = isRTL(currentLang);

  // Today's ISO date string
  const todayIso = useMemo(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }, []);

  // State
  const [startDate, setStartDate] = useState<string>(initialStartDate || todayIso);
  const [macerationDays, setMacerationDays] = useState<number>(initialMacerationDays);
  const [activePresetId, setActivePresetId] = useState<string>('floral_fruity');
  const [storageType, setStorageType] = useState<'amber_glass' | 'dark_cupboard' | 'aluminum_flacon'>('amber_glass');
  const [isCopiedTag, setIsCopiedTag] = useState(false);

  // Sync internal state if props change from outside
  useEffect(() => {
    if (initialMacerationDays && initialMacerationDays !== macerationDays) {
      setMacerationDays(initialMacerationDays);
    }
  }, [initialMacerationDays]);

  useEffect(() => {
    if (initialStartDate && initialStartDate !== startDate) {
      setStartDate(initialStartDate);
    }
  }, [initialStartDate]);

  const updateDays = (days: number) => {
    const safeDays = Math.max(1, Math.min(365, days));
    setMacerationDays(safeDays);
    onMacerationDaysChange?.(safeDays);
  };

  const updateStartDate = (d: string) => {
    setStartDate(d);
    onStartDateChange?.(d);
  };

  // Calculations
  const calculation = useMemo(() => {
    const start = new Date(startDate);
    const startValid = !isNaN(start.getTime());
    const safeStart = startValid ? start : new Date();

    const days = Math.max(1, Math.min(365, macerationDays || 30));

    // End date = Start Date + (days * 24 * 60 * 60 * 1000)
    const end = new Date(safeStart.getTime() + days * 24 * 60 * 60 * 1000);
    const today = new Date();

    // Reset hours for clean day math
    const startDay = new Date(safeStart.getFullYear(), safeStart.getMonth(), safeStart.getDate()).getTime();
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
    const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

    const totalDurationMs = endDay - startDay;
    const elapsedMs = Math.max(0, todayDay - startDay);
    const remainingMs = Math.max(0, endDay - todayDay);

    const elapsedDays = Math.min(days, Math.floor(elapsedMs / (1000 * 60 * 60 * 24)));
    const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

    const progressPercent = Math.min(100, Math.max(0, Math.round((elapsedDays / days) * 100)));

    const isFinished = todayDay >= endDay;
    const isFutureStart = todayDay < startDay;

    // Date Formatters
    const optionsArabic: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    const optionsEnglish: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };

    const endDateFormattedAr = end.toLocaleDateString('ar-SA', optionsArabic);
    const endDateFormattedEn = end.toLocaleDateString('en-US', optionsEnglish);
    const startDateFormattedAr = safeStart.toLocaleDateString('ar-SA', optionsArabic);
    const startDateFormattedEn = safeStart.toLocaleDateString('en-US', optionsEnglish);

    return {
      startDateFormattedAr,
      startDateFormattedEn,
      endDateFormattedAr,
      endDateFormattedEn,
      endDateIso: end.toISOString().split('T')[0],
      totalDays: days,
      elapsedDays,
      remainingDays,
      progressPercent,
      isFinished,
      isFutureStart,
    };
  }, [startDate, macerationDays]);

  const handleApplyPreset = (preset: MacerationPreset) => {
    setActivePresetId(preset.id);
    updateDays(preset.days);
  };

  const handleSetQuickDate = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    updateStartDate(d.toISOString().split('T')[0]);
  };

  // Download iCal (.ics) file so user gets notification on completion date
  const handleDownloadCalendarEvent = () => {
    const title = rtl ? `اكتمال نضوج العطر: ${formulaTitle}` : `Perfume Maturation Complete: ${formulaTitle}`;
    const desc = rtl
      ? `انتهت فترة التعتيق المقررة (${macerationDays} يوماً). العطر جاهز الآن للفلترة النهائية المخبرية واختبار الثبات والفوحان الفعلي.`
      : `Maceration period (${macerationDays} days) completed! Ready for final filtration and sillage assessment.`;

    const startObj = new Date(calculation.endDateIso);
    const y = startObj.getFullYear();
    const m = String(startObj.getMonth() + 1).padStart(2, '0');
    const d = String(startObj.getDate()).padStart(2, '0');
    const icsDate = `${y}${m}${d}`;

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Sham Perfumes//Maceration Simulator//AR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:maceration-${Date.now()}@shamperfumes.com`,
      `DTSTAMP:${icsDate}T090000Z`,
      `DTSTART;VALUE=DATE:${icsDate}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${desc}`,
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-PT12H',
      'ACTION:DISPLAY',
      `DESCRIPTION:${title}`,
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `تذكير_نضوج_${formulaTitle.replace(/\s+/g, '_')}_${calculation.endDateIso}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Copy Laboratory Bottle Tag
  const handleCopyBottleTag = () => {
    const tag = `═══════════════════════════════════════════
🏷️ بطاقة تعتيق زجاجة المعمل · منصة صمم عطرك مع شام
═══════════════════════════════════════════
📌 اسم التركيبة: ${formulaTitle}
🔢 كود التشغيلة: ${batchCode}
⏳ مدة التعتيق المقررة: ${macerationDays} يوماً
📅 تاريخ بدء الخلط والتعتيق: ${calculation.startDateFormattedAr}
🎯 تاريخ الانتهاء والنضوج التام: ${calculation.endDateFormattedAr}
🌡️ درجة الحرارة المثالية: 15°C - 18°C
🛡️ وعاء الحفظ: ${storageType === 'amber_glass' ? 'زجاج عسلي داكن (Amber Glass)' : storageType === 'dark_cupboard' ? 'قارورة داكنة في خزانة معتمة' : 'قارورة ألومنيوم مخبرية معتمة'}
═══════════════════════════════════════════
حالة النضوج الحالية: ${calculation.isFinished ? 'مكتمل 100% وجاهز للفلترة والاستخدام' : `قيد التعتيق (باقي ${calculation.remainingDays} يوماً)`}
═══════════════════════════════════════════`;

    navigator.clipboard.writeText(tag);
    setIsCopiedTag(true);
    setTimeout(() => setIsCopiedTag(false), 2500);
  };

  const handleConsultShahin = () => {
    const prompt = `أيها الخبير شاهين، أقوم حالياً بتعتيق تركيبة «${formulaTitle}» برقم تشغيلة «${batchCode}».
تاريخ بدء التعتيق: ${startDate}
عدد الأيام المقررة للنضوج: ${macerationDays} يوماً
تاريخ الانتهاء المتوقع لنضوج العطر: ${calculation.endDateFormattedAr}
هل تناسب هذه المدة العائلة العطرية؟ وما هي نصيحتك لتسريع النضوج الكيميائي ومنع تعكر العطر أو أكسدة النوتات العليا؟`;

    if (onOpenConsultation) {
      onOpenConsultation(prompt);
    } else {
      window.dispatchEvent(new CustomEvent('open-ai-chat-with-prompt', { detail: prompt }));
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-stone-200/90 shadow-md p-5 sm:p-7 space-y-6">
      
      {/* Tool Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-700 via-amber-800 to-amber-950 text-white flex items-center justify-center font-bold text-xl shadow-md border border-amber-600/30">
            ⏳
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100/80 text-amber-900 text-[10px] font-bold border border-amber-300/60 mb-0.5">
              <Sparkles className="w-3 h-3 text-amber-700" />
              <span>{rtl ? 'أداة معملية معتمدة' : 'Official Laboratory Tool'}</span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-stone-900 font-serif-luxury">
              {rtl ? 'محاكي التعتيق الزمني وحساب تاريخ نضوج العطر' : 'Maceration & Aging Time Simulator'}
            </h3>
            <p className="text-xs text-stone-500">
              {rtl
                ? 'حساب دقيق لتاريخ اكتمال نضوج العطر (Maceration Maturation Date) مع خط زمني تفاعلي لمراحل التفاعل الجزيئي.'
                : 'Exact completion date forecasting for perfume maturation with molecular transformation timeline.'}
            </p>
          </div>
        </div>

        {/* Shahin AI Consultation Button */}
        <button
          type="button"
          onClick={handleConsultShahin}
          className="self-start sm:self-center px-3.5 py-2 rounded-xl bg-gradient-to-r from-stone-900 to-amber-950 hover:from-black hover:to-amber-900 text-amber-300 font-bold text-xs flex items-center gap-2 border border-amber-500/30 shadow-xs cursor-pointer transition-all hover:scale-[1.02]"
        >
          <Bot className="w-4 h-4 text-amber-400" />
          <span>{rtl ? 'استشارة الخبير شاهين للتعتيق 🧙‍♂️' : 'Consult Shahin AI 🧙‍♂️'}</span>
        </button>
      </div>

      {/* Main Grid: Inputs vs. Live Forecast Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column (Inputs & Presets): 7 cols */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* 1. Date & Days Controls */}
          <div className="bg-stone-50/80 p-4 sm:p-5 rounded-2xl border border-stone-200/80 space-y-4">
            <span className="text-xs font-bold text-stone-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-700" />
              <span>{rtl ? '1. إدخال تاريخ البدء ومدة التعتيق بالنظام' : '1. Enter Start Date & Duration'}</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Start Date */}
              <div>
                <label className="text-[11px] font-bold text-stone-700 block mb-1.5">
                  {rtl ? 'تاريخ بدء التعتيق والخلط:' : 'Aging Start Date:'}
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => updateStartDate(e.target.value)}
                    className="w-full p-2.5 bg-white border border-stone-300 rounded-xl text-xs font-bold font-mono-numbers text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/20 focus:border-amber-800"
                  />
                </div>
                {/* Quick Date Buttons */}
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-stone-400 font-medium">{rtl ? 'ضبط سريع:' : 'Quick:'}</span>
                  <button
                    type="button"
                    onClick={() => handleSetQuickDate(0)}
                    className="px-2 py-0.5 rounded text-[10px] bg-white border border-stone-200 hover:bg-stone-100 font-semibold text-stone-700 cursor-pointer"
                  >
                    {rtl ? 'اليوم' : 'Today'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetQuickDate(-7)}
                    className="px-2 py-0.5 rounded text-[10px] bg-white border border-stone-200 hover:bg-stone-100 font-semibold text-stone-700 cursor-pointer"
                  >
                    {rtl ? 'منذ 7 أيام' : '-7 Days'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetQuickDate(-14)}
                    className="px-2 py-0.5 rounded text-[10px] bg-white border border-stone-200 hover:bg-stone-100 font-semibold text-stone-700 cursor-pointer"
                  >
                    {rtl ? 'منذ أسبوعين' : '-14 Days'}
                  </button>
                </div>
              </div>

              {/* Number of Days */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-stone-700">
                    {rtl ? 'عدد أيام التعتيق المقررة:' : 'Maceration Period (Days):'}
                  </label>
                  <span className="font-mono-numbers font-black text-amber-900 text-sm">
                    {macerationDays} {rtl ? 'يوماً' : 'days'}
                  </span>
                </div>
                <input
                  type="number"
                  min="3"
                  max="365"
                  value={macerationDays}
                  onChange={(e) => updateDays(parseInt(e.target.value) || 1)}
                  className="w-full p-2.5 bg-white border border-stone-300 rounded-xl text-xs font-bold font-mono-numbers text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/20 focus:border-amber-800"
                />
                <input
                  type="range"
                  min="7"
                  max="120"
                  step="1"
                  value={macerationDays}
                  onChange={(e) => updateDays(parseInt(e.target.value) || 30)}
                  className="w-full accent-amber-800 cursor-pointer mt-2"
                />
              </div>
            </div>
          </div>

          {/* 2. Fragrance Family Presets */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                <FlaskConical className="w-3.5 h-3.5 text-amber-700" />
                <span>{rtl ? '2. اختيار المعيار الموصى به حسب العائلة العطرية' : '2. Recommended Period by Olfactory Family'}</span>
              </span>
              <span className="text-[10px] text-stone-400">
                {rtl ? 'انقر لتطبيق عدد الأيام' : 'Click to apply duration'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {MACERATION_PRESETS.map((preset) => {
                const isSelected = activePresetId === preset.id && macerationDays === preset.days;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className={`p-3 text-right rounded-xl border transition-all text-xs flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-amber-950 text-white border-amber-800 shadow-xs'
                        : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-800'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-xs truncate max-w-[170px]">
                        {rtl ? preset.nameAr : preset.nameEn}
                      </span>
                      <span
                        className={`font-mono-numbers text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          isSelected
                            ? 'bg-amber-800 text-amber-200'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {preset.days} {rtl ? 'يوم' : 'd'}
                      </span>
                    </div>
                    <p
                      className={`text-[10px] leading-relaxed mt-1 text-left ${
                        isSelected ? 'text-stone-300' : 'text-stone-500'
                      }`}
                    >
                      {rtl ? preset.descriptionAr : preset.descriptionEn}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Storage Medium Selector */}
          <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
              <div>
                <span className="font-bold text-stone-900 block">
                  {rtl ? 'وعاء حفظ الزجاجة في المعمل:' : 'Storage Vessel Medium:'}
                </span>
                <span className="text-[10px] text-stone-500">
                  {rtl ? 'يؤثر على عزل الأشعة فوق البنفسجية والأكسدة' : 'Guards against UV photodegradation'}
                </span>
              </div>
            </div>

            <div className="inline-flex p-1 bg-white rounded-lg border border-stone-300 text-[11px] font-semibold shrink-0">
              <button
                type="button"
                onClick={() => setStorageType('amber_glass')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  storageType === 'amber_glass' ? 'bg-amber-900 text-white font-bold' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {rtl ? 'زجاج عسلي (Amber)' : 'Amber Glass'}
              </button>
              <button
                type="button"
                onClick={() => setStorageType('dark_cupboard')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  storageType === 'dark_cupboard' ? 'bg-amber-900 text-white font-bold' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {rtl ? 'خزانة مظلمة' : 'Dark Chamber'}
              </button>
              <button
                type="button"
                onClick={() => setStorageType('aluminum_flacon')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  storageType === 'aluminum_flacon' ? 'bg-amber-900 text-white font-bold' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {rtl ? 'ألومنيوم معتم' : 'Aluminum Flacon'}
              </button>
            </div>
          </div>

        </div>

        {/* Right Column: Live Forecast Showcase (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* HERO COMPLETION DATE CARD */}
          <div className="bg-gradient-to-br from-stone-900 via-amber-950 to-stone-950 text-white p-6 rounded-2xl border-2 border-amber-600/40 shadow-xl space-y-5 relative overflow-hidden">
            {/* Ambient background glow */}
            <div className="absolute top-0 right-0 w-44 h-44 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between pb-3 border-b border-amber-500/20">
              <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" style={{ animationDuration: '8s' }} />
                <span>{rtl ? 'تاريخ الانتهاء المتوقع لنضوج العطر' : 'Predicted Maturation Date'}</span>
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  calculation.isFinished
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : calculation.isFutureStart
                    ? 'bg-stone-700 text-stone-300'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                }`}
              >
                {calculation.isFinished
                  ? rtl ? 'مكتمل النضوج ✅' : 'Fully Matured ✅'
                  : calculation.isFutureStart
                  ? rtl ? 'مجدول مستقبلاً' : 'Scheduled'
                  : rtl ? `باقي ${calculation.remainingDays} يوماً` : `${calculation.remainingDays}d remaining`}
              </span>
            </div>

            {/* BIG HIGHLIGHT DATE */}
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-black text-amber-100 font-serif-luxury tracking-tight leading-snug">
                {rtl ? calculation.endDateFormattedAr : calculation.endDateFormattedEn}
              </div>
              <div className="text-xs font-mono-numbers text-amber-300/80">
                {calculation.endDateIso} · {calculation.totalDays} {rtl ? 'يوماً من تاريخ البدء' : 'days from start'}
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-300 text-[11px]">
                  {rtl ? 'التقدم الزمني نحو النضوج التام:' : 'Maturation Progress:'}
                </span>
                <span className="font-mono-numbers font-bold text-amber-300">
                  {calculation.progressPercent}%
                </span>
              </div>
              <div className="h-3 rounded-full bg-stone-800 p-0.5 border border-amber-500/30 overflow-hidden flex">
                <div
                  style={{ width: `${calculation.progressPercent}%` }}
                  className="h-full bg-gradient-to-r from-amber-600 via-amber-500 to-amber-300 rounded-full transition-all duration-500 shadow-sm"
                />
              </div>
              <div className="flex justify-between text-[10px] text-stone-400 pt-0.5">
                <span>{rtl ? `بدأ: ${calculation.startDateFormattedAr.split('،')[0]}` : `Started`}</span>
                <span>
                  {rtl
                    ? `منقضي: ${calculation.elapsedDays} يوم`
                    : `${calculation.elapsedDays}d passed`}
                </span>
              </div>
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-2 gap-2.5 pt-1 text-xs">
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] text-stone-400 block mb-0.5">
                  {rtl ? 'الحرارة المعملية المثالية:' : 'Ideal Laboratory Temp:'}
                </span>
                <span className="font-bold text-amber-200 font-mono-numbers">
                  15°C - 18°C
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] text-stone-400 block mb-0.5">
                  {rtl ? 'الفلترة المخبرية:' : 'Micro-Filtration:'}
                </span>
                <span className="font-bold text-amber-200">
                  0.22µm {rtl ? 'بعد النضوج' : 'Post-Maceration'}
                </span>
              </div>
            </div>

            {/* Action Buttons: iCal & Bottle Tag */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={handleDownloadCalendarEvent}
                className="py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Calendar className="w-3.5 h-3.5 text-stone-950" />
                <span>{rtl ? 'تنبيه التقويم (.ics)' : 'Add to Calendar (.ics)'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyBottleTag}
                className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-white/10"
              >
                {isCopiedTag ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Printer className="w-3.5 h-3.5 text-amber-300" />}
                <span>{isCopiedTag ? (rtl ? 'تم نسخ البطاقة!' : 'Copied!') : (rtl ? 'نسخ بطاقة الزجاجة 🏷️' : 'Copy Bottle Tag 🏷️')}</span>
              </button>
            </div>

          </div>

          {/* Shahin's Laboratory Seal */}
          <div className="bg-amber-50/80 p-4 rounded-2xl border border-amber-200 text-xs text-amber-950 space-y-2 shadow-2xs">
            <div className="font-bold text-stone-900 flex items-center gap-2">
              <span className="text-base">🧙‍♂️</span>
              <span>{rtl ? 'قاعدة الخبير شاهين لنضوج وتعتيق العطور:' : "Master Shahin's Golden Maceration Rule:"}</span>
            </div>
            <p className="text-[11px] leading-relaxed text-stone-700">
              {rtl
                ? `«لا تتعجل في فتح الزجاجة قبل يوم ${calculation.endDateFormattedAr.split('،')[1] || calculation.endDateIso}، لأن الإسترات العطرية (Ester bonds) كائن يتنفس ببطء. التعتيق الهادئ في الظلام هو ما يفصل بين العطر التجاري الرخيص والعطر النيش الفاخر ذي الفوحان الأرستقراطي.»`
                : `"Never rush the bottle before the maturation date. Ester cross-linking requires patient darkness to transform raw solvent into aristocratic sillage."`}
            </p>
          </div>

        </div>

      </div>

      {/* 4. Visual 4-Stage Molecular Transformation Timeline */}
      <div className="pt-4 border-t border-stone-200/80 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-stone-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-700" />
            <span>{rtl ? 'مراحل التحول الكيميائي على مدار أيام التعتيق (ماذا يحدث داخل الزجاجة؟):' : 'Molecular Transformation Timeline Stages:'}</span>
          </span>
          <span className="text-[10px] text-stone-400 font-mono-numbers">
            {calculation.totalDays} {rtl ? 'يوماً مقسمة علمياً' : 'days breakdown'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          
          {/* Stage 1 */}
          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/90 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 font-bold flex items-center justify-center text-[10px]">
                  1
                </span>
                <span>{rtl ? 'تلاشي لسعة الكحول' : 'Ethanol Flash-Off'}</span>
              </span>
              <span className="text-[10px] font-mono-numbers text-stone-500">
                1 - {Math.max(3, Math.round(calculation.totalDays * 0.2))} {rtl ? 'يوم' : 'd'}
              </span>
            </div>
            <p className="text-[11px] text-stone-600 leading-relaxed">
              {rtl
                ? 'تهدأ الجزيئات النفاذة في الإيثانول الطبي، وتبدأ المذيبات في الإحاطة بمركبات الزيت الخفيف دون تصادم.'
                : 'Alcohol harshness calms down; solvent molecules envelope lighter odorant terpenes.'}
            </p>
          </div>

          {/* Stage 2 */}
          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/90 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 font-bold flex items-center justify-center text-[10px]">
                  2
                </span>
                <span>{rtl ? 'التشابك الإستيري' : 'Esterification'}</span>
              </span>
              <span className="text-[10px] font-mono-numbers text-stone-500">
                {Math.max(4, Math.round(calculation.totalDays * 0.2) + 1)} - {Math.round(calculation.totalDays * 0.55)} {rtl ? 'يوم' : 'd'}
              </span>
            </div>
            <p className="text-[11px] text-stone-600 leading-relaxed">
              {rtl
                ? 'تتفاعل الأحماض مع الكحول منتجة إسترات تمنح العطر طابعاً مخملياً فاخراً وتبرز باقة قلب العطر الزهرية.'
                : 'Organic acids bind with ethanol producing aromatic esters that soften the heart bouquet.'}
            </p>
          </div>

          {/* Stage 3 */}
          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/90 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 font-bold flex items-center justify-center text-[10px]">
                  3
                </span>
                <span>{rtl ? 'تثبيت القاعدة والعمق' : 'Fixation & Depth'}</span>
              </span>
              <span className="text-[10px] font-mono-numbers text-stone-500">
                {Math.round(calculation.totalDays * 0.55) + 1} - {Math.round(calculation.totalDays * 0.85)} {rtl ? 'يوم' : 'd'}
              </span>
            </div>
            <p className="text-[11px] text-stone-600 leading-relaxed">
              {rtl
                ? 'تندمج المثبتات (Ambroxan / Iso E) مع الأخشاب والراتنجات، مما يرفع ثبات العطر إلى أقصى طاقته التصميمية.'
                : 'Fixatives lock into woods and resins, maximizing tenacity and sillage envelope.'}
            </p>
          </div>

          {/* Stage 4 */}
          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center text-[10px]">
                  4
                </span>
                <span>{rtl ? 'النضوج التام والفلترة' : 'Full Maturation'}</span>
              </span>
              <span className="text-[10px] font-mono-numbers text-amber-900 font-bold">
                اليوم {calculation.totalDays} 🎯
              </span>
            </div>
            <p className="text-[11px] text-amber-950 leading-relaxed">
              {rtl
                ? 'اكتمال التفاعل الكيميائي. جاهز للتبريد المخبري (Chilling) والفلترة النهائية لصفاء بلوري نقي وتعبئة الزجاجات.'
                : 'Reaction completed. Ready for chilling, micro-filtration, and luxury commercial bottling.'}
            </p>
          </div>

        </div>
      </div>

      {/* 5. Master Perfumer Shahin Interactive Council & Direct Consultation */}
      <div className="pt-4 border-t border-stone-200/80 space-y-3.5">
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-stone-900 via-amber-950 to-stone-900 text-white border border-amber-600/30 shadow-md space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center font-bold text-lg">
                🧙‍♂️
              </div>
              <div>
                <h4 className="font-bold text-sm text-amber-200 flex items-center gap-1.5 font-serif-luxury">
                  <span>{rtl ? 'استشارات الخبير شاهين المعملية حول نضوج هذه التشغيلة' : "Master Shahin's Expert Maturation Advisory"}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                    {rtl ? 'مباشر مع شاهين AI' : 'Live Shahin AI'}
                  </span>
                </h4>
                <p className="text-[11px] text-stone-300">
                  {rtl
                    ? `التشغيلة: ${batchCode} · مدة التعتيق: ${macerationDays} يوماً · تاريخ النضوج المتوقع: ${calculation.endDateFormattedAr}`
                    : `Batch: ${batchCode} · Period: ${macerationDays} days · Forecast Date: ${calculation.endDateIso}`}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleConsultShahin}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-stone-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer shrink-0"
            >
              <Bot className="w-4 h-4 text-stone-950" />
              <span>{rtl ? 'استشارة شاملة مع الخبير شاهين 🧙‍♂️' : 'Full Shahin Consultation'}</span>
            </button>
          </div>

          {/* Quick Consultation Prompt Chips */}
          <div className="pt-2">
            <span className="text-[10px] text-amber-300/80 font-bold block mb-2">
              {rtl ? 'اختر سؤالاً سريعاً لإرساله فوراً إلى شيخ العطارين شاهين:' : 'Click to ask Master Shahin instantly:'}
            </span>
            <div className="flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  const q = `أيها الخبير شاهين، هل تناسب مدة الـ ${macerationDays} يوماً المقررة لتعتيق «${formulaTitle}» نوع العطر؟ وما نصيحتك لثبات أعلى؟`;
                  if (onOpenConsultation) onOpenConsultation(q);
                  else window.dispatchEvent(new CustomEvent('open-ai-chat-with-prompt', { detail: q }));
                }}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-amber-500/30 text-stone-200 hover:text-amber-200 border border-white/15 text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>💡</span>
                <span>{rtl ? `هل تكفي مدة ${macerationDays} يوماً لهذا النمط؟` : `Is ${macerationDays}d optimal for this style?`}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const q = `أيها الخبير شاهين، كيف أقوم بخطوة التعتيق البارد (Cold Maceration 4°C) والفلترة بالورق الصيدلاني لمنع تعكر العطر تماماً؟`;
                  if (onOpenConsultation) onOpenConsultation(q);
                  else window.dispatchEvent(new CustomEvent('open-ai-chat-with-prompt', { detail: q }));
                }}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-amber-500/30 text-stone-200 hover:text-amber-200 border border-white/15 text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>❄️</span>
                <span>{rtl ? 'كيف أطبق التعتيق البارد (4°C) والفلترة؟' : 'Cold Maceration (4°C) & Filtration Protocol'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const q = `أيها الخبير شاهين، ما أفضل مثبت عطري كيميائي أو طبيعي لتركيبة «${formulaTitle}» يحافظ على النوتات العليا أثناء التعتيق؟`;
                  if (onOpenConsultation) onOpenConsultation(q);
                  else window.dispatchEvent(new CustomEvent('open-ai-chat-with-prompt', { detail: q }));
                }}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-amber-500/30 text-stone-200 hover:text-amber-200 border border-white/15 text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>🛡️</span>
                <span>{rtl ? 'حماية النوتات العليا ومثبتات الفوحان' : 'Top notes protection & fixative choice'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Cross-Tool Quick Navigation */}
        {onNavigateToTab && (
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 text-xs">
            <span className="text-[11px] text-stone-500 font-semibold">
              {rtl ? 'أدوات معملية مرتبطة بنضوج العطر:' : 'Related laboratory tools:'}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigateToTab('concentration')}
                className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold transition-colors cursor-pointer flex items-center gap-1.5 text-xs"
              >
                <FlaskConical className="w-3.5 h-3.5 text-amber-700" />
                <span>{rtl ? 'العودة لحاسبة التركيب' : 'Concentration Lab'}</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigateToTab('guide')}
                className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 font-semibold transition-colors cursor-pointer flex items-center gap-1.5 text-xs"
              >
                <Layers className="w-3.5 h-3.5 text-stone-600" />
                <span>{rtl ? 'دليل المثبتات والتعتيق' : 'Fixatives & Aging Guide'}</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigateToTab('master_ai')}
                className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold transition-colors cursor-pointer flex items-center gap-1.5 text-xs"
              >
                <Bot className="w-3.5 h-3.5 text-emerald-700" />
                <span>{rtl ? 'معمل الخبير شاهين AI' : 'Shahin AI Master Lab'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
