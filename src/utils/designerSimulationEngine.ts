import { RAW_MATERIALS_DATABASE, type RawMaterialItem } from '../data/rawMaterials';
import type { CalculationResult, FormulationState, PyramidNote } from '../types/perfume';
import { calculatePerfumeFormulation } from './calculations';

export type SafetyStatus = 'pass' | 'caution' | 'fail';

export interface IfraRuleSpec {
  id: string;
  patterns: RegExp[];
  maxFinalPercent: number | null; // IFRA Cat 4 max % in final consumer product
  maxOilPercentNote?: string;
  concernAr: string;
  concernEn: string;
  fixHintAr: string;
  fixHintEn: string;
}

export interface IfraAuditRow {
  noteId: string;
  nameAr: string;
  nameEn: string;
  category: 'top' | 'heart' | 'base';
  oilPercent: number;
  finalProductPercent: number;
  ifraCeilingFinalPercent: number | null;
  maxSafeOilPercent: number | null;
  status: SafetyStatus;
  casNumber?: string;
  noteAr: string;
  noteEn: string;
}

export interface CarrierSafetyCheck {
  id: string;
  labelAr: string;
  labelEn: string;
  valueLabel: string;
  status: SafetyStatus;
  detailAr: string;
  detailEn: string;
}

export interface EvaporationPoint {
  minute: number;
  label: string;
  topIntensity: number;
  heartIntensity: number;
  baseIntensity: number;
  compositeSillage: number;
  projectionMeters: number;
}

export interface RadarScores {
  topRadiance: number;
  heartCohesion: number;
  baseTenacity: number;
  sillageProjection: number;
  climateResilience: number;
  solubilityClarity: number;
}

export type DeveloperPatch =
  | {
      type: 'set_formulation';
      updates: Partial<Pick<FormulationState, 'concentrationPercent' | 'alcoholPercentage' | 'waterPercent' | 'fixativePercent'>>;
      macerationDays?: number;
    }
  | {
      type: 'scale_note';
      noteNameMatch: string;
      targetOilPercent: number;
    }
  | {
      type: 'add_note';
      nameAr: string;
      nameEn: string;
      category: 'top' | 'heart' | 'base';
      percentageOfOil: number;
    };

export interface DeveloperFixSuggestion {
  id: string;
  severity: 'critical' | 'recommended' | 'enhancement';
  area: 'safety' | 'pyramid' | 'solubility' | 'climate';
  titleAr: string;
  titleEn: string;
  reasonAr: string;
  reasonEn: string;
  patchLabelAr: string;
  patchLabelEn: string;
  patch: DeveloperPatch;
}

export interface DesignerSimulationResult {
  calculation: CalculationResult;
  effectiveAbv: number;
  totalOilDrops: number;
  tierTotals: { top: number; heart: number; base: number; total: number };
  normalizedTiers: { top: number; heart: number; base: number };
  clarityStatus: SafetyStatus;
  clarityRiskAr: string;
  clarityRiskEn: string;
  chillFilterTempC: number;
  estimatedLongevityHours: number;
  peakProjectionMeters: number;
  readinessScore: number;
  readinessStatus: SafetyStatus;
  radar: RadarScores;
  evaporationCurve: EvaporationPoint[];
  ifraRows: IfraAuditRow[];
  carrierChecks: CarrierSafetyCheck[];
  ifraComplianceScore: number;
  safetyVerdict: SafetyStatus;
  pyramidVerdictAr: string;
  pyramidVerdictEn: string;
  hasBridgeGap: boolean;
  suggestions: DeveloperFixSuggestion[];
}

export interface DesignerTrialInput {
  formulation: FormulationState;
  pyramidNotes: PyramidNote[];
  macerationDays: number;
  ambientTempC: number;
  humidityPct: number;
}

const IFRA_RULES: IfraRuleSpec[] = [
  {
    id: 'damascenone',
    patterns: [/damascenone|داماسينون|damascone/i],
    maxFinalPercent: 0.043,
    concernAr: 'الحد الأقصى لكيتونات الورد في الفئة الرابعة حسب تعديل IFRA 51 هو 0.043% من المنتج النهائي.',
    concernEn: 'IFRA 51st Cat 4 cap for Rose Ketones (Damascenone) is 0.043% in finished product.',
    fixHintAr: 'خفض نسبة الداماسينون أو استخدم محلولاً مخففاً 1% في DPG.',
    fixHintEn: 'Reduce Damascenone ratio or pre-dilute to 1% in DPG.',
  },
  {
    id: 'taif_rose',
    patterns: [/طائفي|دمشقي|damascena|rose\s*(absolute|otto|oil)|خلاصة الورد|ورد طائفي/i],
    maxFinalPercent: 2.5,
    concernAr: 'الورد الطبيعي يحتوي على الميثيل يوجينول (الحد الصارم ~0.05% كمادة نقية، أي ~2.5% خلاصة ورد في المنتج النهائي).',
    concernEn: 'Natural rose contains Methyl Eugenol (~0.05% strict ceiling, ~2.5% rose oil max in Cat 4).',
    fixHintAr: 'عوض جزءاً من الورد الطبيعي بجزيء الهيديون أو جيرانيول نقي لتحقيق تفتح زهري آمن.',
    fixHintEn: 'Blend part of natural rose with Hedione to preserve bloom within IFRA limits.',
  },
  {
    id: 'bergamot',
    patterns: [/bergamot|برغموت|بيرغاموت/i],
    maxFinalPercent: 0.4,
    concernAr: 'البرغموت غير المنزوع البرغابتين مقيّد عند 0.4% بالمنتج النهائي للوقاية من التحسس الضوئي (استخدم درجة FCF لتجاوز القيد بأمان).',
    concernEn: 'Non-FCF Bergamot is capped at 0.4% finished product due to phototoxicity (Bergamot FCF removes this limit).',
    fixHintAr: 'تأكد من اعتماد برغموت منزوع البرغابتين (Bergamot FCF) أو خفف نسبته.',
    fixHintEn: 'Verify FCF (Furocoumarin-Free) grade or lower non-FCF Bergamot dosage.',
  },
  {
    id: 'coumarin',
    patterns: [/coumarin|كومارين|tonka|تونكا/i],
    maxFinalPercent: 1.6,
    concernAr: 'الكومارين وبذور التونكا محددة بسقف أمان جلدي ~1.6% في العطور البخاخة.',
    concernEn: 'Coumarin / Tonka extracts carry a Category 4 dermal sensitization ceiling near 1.6%.',
    fixHintAr: 'خفض التونكا/الكومارين أو استعِن بالفانيلين وخشب الصندل لدعم الدفء البلسمي.',
    fixHintEn: 'Trim Coumarin/Tonka and support warmth with Vanillin or Sandalwood.',
  },
  {
    id: 'cashmeran',
    patterns: [/cashmeran|كشميران/i],
    maxFinalPercent: 3.8,
    concernAr: 'الحد الموصى به للكشميران في عطور الفئة الرابعة هو 3.8% من المنتج النهائي.',
    concernEn: 'Cashmeran IFRA Cat 4 limit is 3.8% in the finished fragrance.',
    fixHintAr: 'اضبط جرعة الكشميران واستكمل الملمس المخملي بخشب الصندل أو المسك.',
    fixHintEn: 'Lower Cashmeran and complement velvety depth with Sandalwood.',
  },
  {
    id: 'galaxolide',
    patterns: [/galaxolide|جالاكسوليد|hhcb/i],
    maxFinalPercent: 4.3,
    concernAr: 'الجالاكسوليد يخضع لسقف ~4.3% في المنتج النهائي حسب الإرشادات البيئية والجلدية.',
    concernEn: 'Galaxolide (HHCB) carries a ~4.3% benchmark ceiling in fine fragrance.',
    fixHintAr: 'وازن المسك الأبيض بين الجالاكسوليد والأمبروكسان أو سيتالوكس.',
    fixHintEn: 'Split white musk base across Galaxolide and Cetalox/Ambroxan.',
  },
  {
    id: 'iso_e_super',
    patterns: [/iso\s*e\s*super|إيزو إي سوبر|ايزو اي سوبر/i],
    maxFinalPercent: 21.4,
    concernAr: 'سقف إيزو إي سوبر وفق IFRA في الفئة الرابعة يبلغ 21.4% من المنتج النهائي.',
    concernEn: 'Iso E Super is capped at 21.4% in Category 4 fine fragrance.',
    fixHintAr: 'قلل إيزو إي سوبر أو أضف خشب الأرز الطبيعي لإطالة الأفق الخشبي.',
    fixHintEn: 'Keep Iso E Super under 21.4% finished concentration.',
  },
  {
    id: 'evernyl',
    patterns: [/oakmoss|طحلب السنديان/i],
    maxFinalPercent: 0.1,
    concernAr: 'طحلب السنديان الطبيعي مقيّد بشدة عند 0.1% بسبب الأترانول (يفضل استبداله بـ Evernyl).',
    concernEn: 'Natural Oakmoss is restricted to 0.1% due to atranol; replace with Evernyl.',
    fixHintAr: 'استبدل طحلب السنديان بجزيء Evernyl الآمن المعتمد.',
    fixHintEn: 'Switch natural Oakmoss to IFRA-safe Evernyl.',
  },
  {
    id: 'calone',
    patterns: [/calone|كالون/i],
    maxFinalPercent: 0.45,
    concernAr: 'الكالون مركز جداً؛ تجاوز ~0.45% في المنتج النهائي يرفع خطر التحسس ويطغى برائحة مائية حادة.',
    concernEn: 'Calone above ~0.45% in finished product increases sensitization and metallic marine harshness.',
    fixHintAr: 'خفف الكالون إلى ≤ 1.5% من الزيت العطري.',
    fixHintEn: 'Keep Calone ≤ 1.5% of fragrance oil.',
  },
  {
    id: 'aldehydes',
    patterns: [/aldehyde|ألدهيد|الدهيد/i],
    maxFinalPercent: 0.25,
    concernAr: 'الألدهيدات الأليفاتية مقيّدة النسب لمنع تهيج الجلد واحتراق الافتتاحية.',
    concernEn: 'Aliphatic Aldehydes require strict dilution to avoid dermal sensitization and harsh soapiness.',
    fixHintAr: 'احصر الألدهيدات تحت 1% من الزيت العطري.',
    fixHintEn: 'Keep Aldehydes under 1% of aromatic concentrate.',
  },
];

function matchMaterialMeta(note: PyramidNote): RawMaterialItem | undefined {
  const ar = (note.nameAr || '').toLowerCase();
  const en = (note.nameEn || '').toLowerCase();
  return RAW_MATERIALS_DATABASE.find((mat) => {
    const mAr = mat.nameAr.toLowerCase();
    const mEn = mat.nameEn.toLowerCase();
    return (
      (ar && (mAr.includes(ar) || ar.includes(mAr.split('(')[0].trim()))) ||
      (en && (mEn.includes(en) || en.includes(mEn.split('(')[0].trim())))
    );
  });
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function evaluateDesignerTrial(input: DesignerTrialInput): DesignerSimulationResult {
  const { formulation, pyramidNotes, macerationDays, ambientTempC, humidityPct } = input;
  const calculation = calculatePerfumeFormulation(formulation);

  const solventSum = Math.max(0.01, calculation.alcoholPercent + calculation.waterPercent);
  const effectiveAbv = +(
    (formulation.alcoholPercentage * calculation.alcoholPercent) /
    solventSum
  ).toFixed(1);
  const totalOilDrops = Math.round(calculation.oilVolumeMl * 20);

  const tierTotals = pyramidNotes.reduce(
    (acc, n) => {
      const pct = Number.isFinite(Number(n.percentageOfOil)) ? Number(n.percentageOfOil) : 0;
      acc[n.category] = +(acc[n.category] + pct).toFixed(1);
      acc.total = +(acc.total + pct).toFixed(1);
      return acc;
    },
    { top: 0, heart: 0, base: 0, total: 0 },
  );

  const normDenom = Math.max(tierTotals.total, 1);
  const normalizedTiers = {
    top: +((tierTotals.top / normDenom) * 100).toFixed(1),
    heart: +((tierTotals.heart / normDenom) * 100).toFixed(1),
    base: +((tierTotals.base / normDenom) * 100).toFixed(1),
  };

  // Resinous / heavy natural oils affect turbidity risk
  const heavyLoadPct = pyramidNotes.reduce((sum, n) => {
    const txt = `${n.nameAr} ${n.nameEn}`;
    if (/oud|عود|resin|لبان|frankincense|myrrh|patchouli|باتشولي|benzoin|لبان/i.test(txt)) {
      return sum + (n.percentageOfOil || 0);
    }
    return sum;
  }, 0);

  const fcfSafeAll = pyramidNotes.every((n) => {
    const txt = `${n.nameAr} ${n.nameEn}`;
    if (!/bergamot|برغموت|بيرغاموت/i.test(txt)) return true;
    return /fcf|خالي من البرغابتين|furocoumarin/i.test(txt);
  });

  // 1. Clarity & Turbidity Model
  let clarityScore = 96;
  if (effectiveAbv < 72) clarityScore -= 42;
  else if (effectiveAbv < 78) clarityScore -= 18;
  if (formulation.waterPercent > 3) clarityScore -= 28;
  else if (formulation.waterPercent > 2) clarityScore -= 10;
  if (heavyLoadPct > 22 && effectiveAbv < 82) clarityScore -= 16;
  if (ambientTempC < 14 && formulation.waterPercent > 1.5) clarityScore -= 10;
  if (formulation.fixativePercent > 3.5) clarityScore -= 8;
  clarityScore = clamp(Math.round(clarityScore), 15, 100);

  const clarityStatus: SafetyStatus =
    clarityScore >= 78 ? 'pass' : clarityScore >= 55 ? 'caution' : 'fail';
  const clarityRiskAr =
    clarityStatus === 'pass'
      ? 'صفاء بلوري مستقر — ذوبان متكامل للزيوت دون خطر تعكر.'
      : clarityStatus === 'caution'
      ? 'احتمال تعكر خفيف (Louching) عند التبريد — ينصح بالترشيح البارد.'
      : 'خطر تعكر مستحلب مرتفع بسبب انخفاض نقاء الكحول أو زيادة الماء المقطر.';
  const clarityRiskEn =
    clarityStatus === 'pass'
      ? 'Crystal clear phase stability — full oil solubility without turbidity.'
      : clarityStatus === 'caution'
      ? 'Moderate haze risk upon cooling — cold chill-filtration recommended.'
      : 'High louching / turbidity risk due to low effective ABV or excess distilled water.';

  const chillFilterTempC = heavyLoadPct > 15 || formulation.concentrationPercent >= 22 ? 2 : 6;

  // 2. IFRA & Safety Audit
  const ifraRows: IfraAuditRow[] = pyramidNotes.map((note) => {
    const oilPct = clamp(Number(note.percentageOfOil) || 0, 0, 100);
    const finalPct = +((oilPct * formulation.concentrationPercent) / 100).toFixed(4);
    const meta = matchMaterialMeta(note);
    const fullText = `${note.nameAr} ${note.nameEn}`;
    const matchedRule = IFRA_RULES.find((r) => r.patterns.some((p) => p.test(fullText)));

    // Special handling: Bergamot explicitly marked FCF has no bergapten cap
    const isBergamotFcf =
      matchedRule?.id === 'bergamot' && /fcf|خالي من البرغابتين|furocoumarin/i.test(fullText);

    const effectiveCap = isBergamotFcf ? null : matchedRule?.maxFinalPercent ?? null;
    const maxSafeOilPct =
      effectiveCap !== null && formulation.concentrationPercent > 0
        ? +Math.min(100, (effectiveCap / formulation.concentrationPercent) * 100).toFixed(1)
        : null;

    let status: SafetyStatus = 'pass';
    if (effectiveCap !== null) {
      if (finalPct > effectiveCap) status = 'fail';
      else if (finalPct >= effectiveCap * 0.8) status = 'caution';
    }

    return {
      noteId: note.id,
      nameAr: note.nameAr || note.nameEn,
      nameEn: note.nameEn || note.nameAr,
      category: note.category,
      oilPercent: oilPct,
      finalProductPercent: finalPct,
      ifraCeilingFinalPercent: effectiveCap,
      maxSafeOilPercent: maxSafeOilPct,
      status,
      casNumber: meta?.casNumber,
      noteAr: isBergamotFcf
        ? 'نسخة FCF منزوعة البرغابتين — آمنة ضد التحسس الضوئي.'
        : matchedRule
        ? matchedRule.concernAr
        : meta?.ifraLimitPercent || 'ضمن الحدود القياسية لزيوت العطور.',
      noteEn: isBergamotFcf
        ? 'FCF grade — phototoxicity risk eliminated.'
        : matchedRule
        ? matchedRule.concernEn
        : 'Within standard Category 4 fine-fragrance tolerance.',
    };
  });

  const carrierChecks: CarrierSafetyCheck[] = [
    {
      id: 'carrier-abv',
      labelAr: 'الكحول الفعلي بالمحلول (Effective ABV)',
      labelEn: 'Effective Solvent ABV',
      valueLabel: `${effectiveAbv}%`,
      status: effectiveAbv >= 75 ? 'pass' : effectiveAbv >= 68 ? 'caution' : 'fail',
      detailAr:
        effectiveAbv >= 75
          ? 'قوة إذابة ممتازة تمنع انفصال الطور وتحفظ الصفاء.'
          : 'انخفاض الكحول الفعلي يضعف الذوبانية ويرفع احتمال التعكر.',
      detailEn:
        effectiveAbv >= 75
          ? 'Optimal solvent strength for clear oil solubilization.'
          : 'Low effective ABV increases risk of oil emulsion clouding.',
    },
    {
      id: 'carrier-water',
      labelAr: 'الماء المقطر (تلطيف اللسعة)',
      labelEn: 'Deionized Water Share',
      valueLabel: `${formulation.waterPercent}%`,
      status:
        formulation.waterPercent <= 2.5
          ? 'pass'
          : formulation.waterPercent <= 4
          ? 'caution'
          : 'fail',
      detailAr:
        formulation.alcoholPercentage >= 99 && formulation.waterPercent === 0
          ? 'كحول مطلق 99% دون ماء قد يعطي لسعة جلدية عند الرش المباشر.'
          : formulation.waterPercent <= 2.5
          ? 'نسبة مثالية لتلطيف لسعة الكحول دون تعكير.'
          : 'تجاوز 3% ماء مقطر يعكّر العطور الكحولية المركزة.',
      detailEn:
        formulation.alcoholPercentage >= 99 && formulation.waterPercent === 0
          ? 'Anhydrous ethanol at 0% water may feel sharp on skin.'
          : formulation.waterPercent <= 2.5
          ? 'Balanced water percentage to soften initial ethanol sting.'
          : 'Exceeding 3% distilled water destabilizes concentrated perfume oils.',
    },
    {
      id: 'carrier-fixative',
      labelAr: 'نسبة المثبت (DPG / IPM)',
      labelEn: 'Fixative Ratio (DPG / IPM)',
      valueLabel: `${formulation.fixativePercent}%`,
      status:
        formulation.fixativePercent <= 3
          ? formulation.fixativePercent < 0.5 && ambientTempC >= 30
            ? 'caution'
            : 'pass'
          : 'caution',
      detailAr:
        formulation.fixativePercent > 3
          ? 'تجاوز 3% مثبت في البخاخ قد يترك أثر ملمس زيتي على الأقمشة.'
          : formulation.fixativePercent < 0.5 && ambientTempC >= 30
          ? 'في المناخ الحار (>30°C) ينصح برفع المثبت إلى 1%–2% لتقليل التبخر الخاطف.'
          : 'جرعة تثبيت متزنة تدعم التصاق القاعدة بالبشرة.',
      detailEn:
        formulation.fixativePercent > 3
          ? 'Above 3% fixative in sprays can leave slight fabric tackiness.'
          : formulation.fixativePercent < 0.5 && ambientTempC >= 30
          ? 'Warm ambient climate (>30°C) benefits from 1%–2% fixative.'
          : 'Clean fixation dose supporting skin adhesion.',
    },
  ];

  const failedRows = ifraRows.filter((r) => r.status === 'fail').length;
  const cautionRows = ifraRows.filter((r) => r.status === 'caution').length;
  const failedCarriers = carrierChecks.filter((c) => c.status === 'fail').length;
  const cautionCarriers = carrierChecks.filter((c) => c.status === 'caution').length;

  const ifraComplianceScore = clamp(
    100 - failedRows * 26 - cautionRows * 9 - failedCarriers * 16 - cautionCarriers * 6,
    0,
    100,
  );
  const safetyVerdict: SafetyStatus =
    failedRows > 0 || failedCarriers > 0
      ? 'fail'
      : cautionRows > 0 || cautionCarriers > 0
      ? 'caution'
      : 'pass';

  // 3. Pyramid Balance & Radar Evaluation
  const idealTopDiff = Math.abs(normalizedTiers.top - 22);
  const idealHeartDiff = Math.abs(normalizedTiers.heart - 38);
  const idealBaseDiff = Math.abs(normalizedTiers.base - 40);
  const hasBridgeGap =
    pyramidNotes.length > 0 && normalizedTiers.heart < 18 && normalizedTiers.top > 15 && normalizedTiers.base > 25;

  const boosterPresence = pyramidNotes.reduce((acc, n) => {
    if (/iso\s*e|إيزو|ambrox|أمبروكس|hedione|هيديون|cetalox|سيتالوكس/i.test(`${n.nameAr} ${n.nameEn}`)) {
      return acc + (n.percentageOfOil || 0);
    }
    return acc;
  }, 0);

  const topRadiance = clamp(
    Math.round(52 + Math.min(normalizedTiers.top, 36) * 1.15 - Math.max(0, normalizedTiers.top - 42) * 0.8),
    15,
    100,
  );
  const heartCohesion = clamp(
    Math.round(92 - idealHeartDiff * 1.45 - (hasBridgeGap ? 18 : 0) + Math.min(10, boosterPresence * 0.6)),
    15,
    100,
  );
  const baseTenacity = clamp(
    Math.round(
      40 +
        normalizedTiers.base * 0.72 +
        formulation.concentrationPercent * 0.85 +
        formulation.fixativePercent * 4.2 +
        Math.min(12, macerationDays * 0.25),
    ),
    20,
    100,
  );
  const sillageProjection = clamp(
    Math.round(
      38 +
        formulation.concentrationPercent * 1.05 +
        Math.min(18, boosterPresence * 1.1) +
        (ambientTempC - 20) * 0.55 -
        Math.max(0, humidityPct - 75) * 0.25,
    ),
    20,
    100,
  );
  const climateResilience = clamp(
    Math.round(
      85 -
        (ambientTempC > 30 && normalizedTiers.top > 35 ? (normalizedTiers.top - 30) * 0.8 : 0) +
        (ambientTempC > 30 ? Math.min(12, formulation.fixativePercent * 5) : 5) -
        Math.max(0, idealBaseDiff - 20) * 0.4,
    ),
    20,
    100,
  );

  const radar: RadarScores = {
    topRadiance: pyramidNotes.length ? topRadiance : 0,
    heartCohesion: pyramidNotes.length ? heartCohesion : 0,
    baseTenacity: pyramidNotes.length ? baseTenacity : 0,
    sillageProjection: pyramidNotes.length ? sillageProjection : 0,
    climateResilience: pyramidNotes.length ? climateResilience : 0,
    solubilityClarity: clarityScore,
  };

  // Longevity & Projection Physics
  const tempVolatilityFactor = 1 + (ambientTempC - 22) * 0.015;
  const macerationBoost = 1 + Math.min(0.18, macerationDays * 0.004);
  const fixativeRetention = 1 + Math.min(0.28, formulation.fixativePercent * 0.085);

  const estimatedLongevityHours = pyramidNotes.length
    ? +clamp(
        ((2.2 + formulation.concentrationPercent * 0.24 + normalizedTiers.base * 0.075) *
          fixativeRetention *
          macerationBoost) /
          Math.max(0.75, tempVolatilityFactor * 0.92),
        1.5,
        18,
      ).toFixed(1)
    : 0;

  const peakProjectionMeters = pyramidNotes.length
    ? +clamp(
        0.55 +
          (sillageProjection / 100) * 1.45 +
          (formulation.concentrationPercent >= 18 ? 0.25 : 0),
        0.4,
        2.6,
      ).toFixed(2)
    : 0;

  // 4. Time-Domain Evaporation Curve (0m -> 720m)
  const timePoints = [
    { minute: 0, label: '0m' },
    { minute: 15, label: '15m' },
    { minute: 30, label: '30m' },
    { minute: 60, label: '1h' },
    { minute: 120, label: '2h' },
    { minute: 240, label: '4h' },
    { minute: 360, label: '6h' },
    { minute: 480, label: '8h' },
    { minute: 600, label: '10h' },
    { minute: 720, label: '12h' },
  ];

  const topDecayHalfLifeMin = 24 / Math.max(0.75, tempVolatilityFactor);
  const heartDecayHalfLifeMin = (150 * fixativeRetention) / Math.max(0.78, tempVolatilityFactor);
  const baseDecayHalfLifeMin = (420 * fixativeRetention * macerationBoost) / Math.max(0.8, tempVolatilityFactor);

  const evaporationCurve: EvaporationPoint[] = timePoints.map(({ minute, label }) => {
    const topWeight = (normalizedTiers.top / 100) * 1.35;
    const heartWeight = (normalizedTiers.heart / 100) * 1.15;
    const baseWeight = (normalizedTiers.base / 100) * 1.05;

    const topVal =
      pyramidNotes.length === 0
        ? 0
        : clamp(
            Math.round(topWeight * 100 * Math.exp(-minute / topDecayHalfLifeMin)),
            0,
            100,
          );
    const heartBloom = minute === 0 ? 0.55 : Math.min(1.05, 0.55 + (minute / 35) * 0.5);
    const heartVal =
      pyramidNotes.length === 0
        ? 0
        : clamp(
            Math.round(heartWeight * 96 * heartBloom * Math.exp(-Math.max(0, minute - 25) / heartDecayHalfLifeMin)),
            0,
            100,
          );
    const baseBloom = minute < 30 ? 0.35 + (minute / 30) * 0.45 : Math.min(1, 0.8 + ((minute - 30) / 90) * 0.2);
    const baseVal =
      pyramidNotes.length === 0
        ? 0
        : clamp(
            Math.round(baseWeight * 92 * baseBloom * Math.exp(-Math.max(0, minute - 60) / baseDecayHalfLifeMin)),
            0,
            100,
          );

    const compositeSillage = clamp(
      Math.round(topVal * 0.42 + heartVal * 0.36 + baseVal * 0.32 + (boosterPresence > 0 && minute > 10 ? 6 : 0)),
      0,
      100,
    );
    const projectionMeters = +(peakProjectionMeters * (compositeSillage / 100)).toFixed(2);

    return {
      minute,
      label,
      topIntensity: topVal,
      heartIntensity: heartVal,
      baseIntensity: baseVal,
      compositeSillage,
      projectionMeters,
    };
  });

  // 5. Pyramid Verdict Text
  const pyramidVerdictAr =
    pyramidNotes.length === 0
      ? 'لا توجد نوتات مضافة للتجربة بعد.'
      : hasBridgeGap
      ? 'فجوة انتقالية: القلب ضعيف مقارنة بالقمة والقاعدة مما قد يسبب انقطاعاً شمياً بعد أول 30 دقيقة.'
      : idealTopDiff <= 10 && idealHeartDiff <= 12 && idealBaseDiff <= 12
      ? 'توازن هرمي احترافي يضمن تدرجاً سلساً من الافتتاحية وحتى الاستقرار.'
      : normalizedTiers.top > 38
      ? 'التركيبة تميل للقمة السريعة — افتتاحية متفجرة مع ثبات متوسط.'
      : normalizedTiers.base > 58
      ? 'التركيبة مركّزة في القاعدة — ثبات عميق جداً مع افتتاحية هادئة.'
      : 'توازن هرمي جيد وقابل للتطوير عبر تعزيز جسور القلب والقاعدة.';

  const pyramidVerdictEn =
    pyramidNotes.length === 0
      ? 'No notes added to the experiment bench yet.'
      : hasBridgeGap
      ? 'Bridge Gap Detected: weak Heart relative to Top/Base may cause an olfactory drop-off after 30 min.'
      : idealTopDiff <= 10 && idealHeartDiff <= 12 && idealBaseDiff <= 12
      ? 'Professional pyramid equilibrium supporting smooth transition from opening to dry-down.'
      : normalizedTiers.top > 38
      ? 'Top-heavy architecture — radiant opening with moderate longevity.'
      : normalizedTiers.base > 58
      ? 'Base-dominant architecture — deep tenacity with restrained opening.'
      : 'Solid pyramid structure ready for bridge refinement.';

  // 6. Deterministic Actionable Developer Suggestions
  const suggestions: DeveloperFixSuggestion[] = [];

  for (const row of ifraRows) {
    if (row.status === 'fail' && row.maxSafeOilPercent !== null) {
      suggestions.push({
        id: `fix-ifra-${row.noteId}`,
        severity: 'critical',
        area: 'safety',
        titleAr: `تجاوز حد السلامة IFRA في «${row.nameAr}»`,
        titleEn: `IFRA Ceiling Exceeded on "${row.nameEn}"`,
        reasonAr: `نسبتها في المنتج النهائي (${row.finalProductPercent}%) تتعدى الحد المسموح (${row.ifraCeilingFinalPercent}%). يجب خفضها إلى ≤ ${row.maxSafeOilPercent}% من الزيت العطري.`,
        reasonEn: `Finished-product load (${row.finalProductPercent}%) exceeds IFRA cap (${row.ifraCeilingFinalPercent}%). Trim to ≤ ${row.maxSafeOilPercent}% of oil.`,
        patchLabelAr: `ضبط إلى ${row.maxSafeOilPercent}%`,
        patchLabelEn: `Clamp to ${row.maxSafeOilPercent}%`,
        patch: {
          type: 'scale_note',
          noteNameMatch: row.nameEn || row.nameAr,
          targetOilPercent: row.maxSafeOilPercent,
        },
      });
    }
  }

  if (!fcfSafeAll) {
    suggestions.push({
      id: 'fix-bergamot-fcf',
      severity: 'recommended',
      area: 'safety',
      titleAr: 'اعتماد برغموت FCF منزوع البرغابتين للوقاية الضوئية',
      titleEn: 'Switch to Bergamot FCF (Phototoxicity Safe)',
      reasonAr: 'البرغموت القياسي مقيد لتجنب التبقع الضوئي؛ النسخة المنزوعة البرغابتين تحفظ نفس الحموضة الراقية بأمان.',
      reasonEn: 'Standard Bergamot carries phototoxic restrictions; FCF grade removes the restriction cleanly.',
      patchLabelAr: 'تخفيض التركيز 2% أو مراجعة الخامة',
      patchLabelEn: 'Review Bergamot FCF grade',
      patch: {
        type: 'set_formulation',
        updates: { concentrationPercent: Math.max(10, formulation.concentrationPercent - 2) },
      },
    });
  }

  if (clarityStatus !== 'pass') {
    suggestions.push({
      id: 'fix-clarity',
      severity: clarityStatus === 'fail' ? 'critical' : 'recommended',
      area: 'solubility',
      titleAr: 'تحسين الذوبانية ومنع تعكر المحلول (Louching)',
      titleEn: 'Resolve Solubility & Turbidity Risk',
      reasonAr: `نسبة الكحول الفعلية (${effectiveAbv}%) أو الماء (${formulation.waterPercent}%) قد تسبب عتامة للزيوت الثقيلة. ارفع درجة الكحول إلى 96% واخفض الماء إلى 1.5%.`,
      reasonEn: `Effective ABV (${effectiveAbv}%) or water (${formulation.waterPercent}%) risks louching. Set ethanol to 96% and water to 1.5%.`,
      patchLabelAr: 'ضبط الكحول 96% وماء 1.5%',
      patchLabelEn: 'Set 96% Ethanol & 1.5% Water',
      patch: {
        type: 'set_formulation',
        updates: { alcoholPercentage: 96, waterPercent: 1.5 },
      },
    });
  }

  if (hasBridgeGap) {
    suggestions.push({
      id: 'fix-bridge-hedione',
      severity: 'recommended',
      area: 'pyramid',
      titleAr: 'سد الفجوة بين القمة والقاعدة بإضافة جسر الهيديون',
      titleEn: 'Bridge Top-to-Base Transition with Hedione',
      reasonAr: 'طبقة القلب منخفضة؛ إضافة 8% هيديون تخلق جسراً إشعاعياً سلساً وتضاعف انتشار الافتتاحية نحو القلب.',
      reasonEn: 'Low Heart weighting weakens transition. Adding 8% Hedione bridges Top sparkle into Base depth.',
      patchLabelAr: 'إضافة 8% هيديون للقلب',
      patchLabelEn: 'Add +8% Hedione (Heart)',
      patch: {
        type: 'add_note',
        nameAr: 'هيديون (Hedione)',
        nameEn: 'Hedione',
        category: 'heart',
        percentageOfOil: 8,
      },
    });
  }

  if (ambientTempC >= 30 && formulation.fixativePercent < 1.5) {
    suggestions.push({
      id: 'fix-hot-climate',
      severity: 'enhancement',
      area: 'climate',
      titleAr: 'تحصين التركيبة لحرارة الطقس المرتفعة',
      titleEn: 'Fortify Volatility for High Ambient Heat',
      reasonAr: `عند حرارة ${ambientTempC}°C تتبخر القمة بسرعة. رفع المثبت (DPG) إلى 1.8% وتمديد التعتيق إلى 35 يوماً يحفظان الثبات.`,
      reasonEn: `At ${ambientTempC}°C top notes flash rapidly. Setting Fixative to 1.8% and Maceration to 35d anchors dry-down.`,
      patchLabelAr: 'مثبت 1.8% + تعتيق 35 يوم',
      patchLabelEn: 'Fixative 1.8% + 35d Aging',
      patch: {
        type: 'set_formulation',
        updates: { fixativePercent: 1.8 },
        macerationDays: Math.max(35, macerationDays),
      },
    });
  }

  if (pyramidNotes.length > 0 && boosterPresence === 0) {
    suggestions.push({
      id: 'fix-sillage-booster',
      severity: 'enhancement',
      area: 'pyramid',
      titleAr: 'رفع هالة الانتشار المجهري بـ Iso E Super',
      titleEn: 'Boost Horizontal Sillage Aura with Iso E Super',
      reasonAr: 'لا تحتوي التجربة على ناشر جزيئي حديث؛ إضافة 5% Iso E Super تمنح العطر إشعاعاً مخملياً دون تغيير طابعه.',
      reasonEn: 'Adding 5% Iso E Super builds radiant diffusion without overpowering natural oils.',
      patchLabelAr: 'إضافة 5% Iso E Super',
      patchLabelEn: 'Add +5% Iso E Super',
      patch: {
        type: 'add_note',
        nameAr: 'إيزو إي سوبر (Iso E Super)',
        nameEn: 'Iso E Super',
        category: 'base',
        percentageOfOil: 5,
      },
    });
  }

  const avgRadar = pyramidNotes.length
    ? Math.round(
        (radar.topRadiance +
          radar.heartCohesion +
          radar.baseTenacity +
          radar.sillageProjection +
          radar.climateResilience +
          radar.solubilityClarity) /
          6,
      )
    : 0;
  const readinessScore = pyramidNotes.length
    ? clamp(Math.round(avgRadar * 0.55 + ifraComplianceScore * 0.45), 0, 100)
    : 0;
  const readinessStatus: SafetyStatus =
    pyramidNotes.length === 0
      ? 'caution'
      : safetyVerdict === 'fail' || clarityStatus === 'fail'
      ? 'fail'
      : safetyVerdict === 'caution' || clarityStatus === 'caution' || hasBridgeGap
      ? 'caution'
      : 'pass';

  return {
    calculation,
    effectiveAbv,
    totalOilDrops,
    tierTotals,
    normalizedTiers,
    clarityStatus,
    clarityRiskAr,
    clarityRiskEn,
    chillFilterTempC,
    estimatedLongevityHours,
    peakProjectionMeters,
    readinessScore,
    readinessStatus,
    radar,
    evaporationCurve,
    ifraRows,
    carrierChecks,
    ifraComplianceScore,
    safetyVerdict,
    pyramidVerdictAr,
    pyramidVerdictEn,
    hasBridgeGap,
    suggestions,
  };
}

export type SampleSkinType = 'dry' | 'balanced' | 'oily';
export type SampleWearScenario = 'indoor_ac' | 'evening_open' | 'humid_summer';
export type SampleApplicationTarget = 'skin_only' | 'skin_and_fabric';

export interface SampleTestSimulationInput {
  formulaTitle: string;
  formulation: FormulationState;
  pyramidNotes: PyramidNote[];
  macerationDays: number;
  ambientTempC: number;
  humidityPct: number;
  skinType: SampleSkinType;
  sprayCount: number;
  wearScenario: SampleWearScenario;
  applicationTarget: SampleApplicationTarget;
}

export interface SampleTimelineStage {
  stageId: 'opening' | 'heart' | 'drydown' | 'residual';
  windowLabel: string;
  titleAr: string;
  titleEn: string;
  intensityPct: number;
  radiusMeters: number;
  dominantNotesAr: string[];
  dominantNotesEn: string[];
  behaviorAr: string;
  behaviorEn: string;
}

export interface SampleIngredientContribution {
  noteId: string;
  nameAr: string;
  nameEn: string;
  category: 'top' | 'heart' | 'base';
  oilPercent: number;
  longevityContributionPct: number;
  projectionContributionPct: number;
  roleTagAr: string;
  roleTagEn: string;
}

export interface SampleTestReport {
  reportCode: string;
  formulaTitle: string;
  noteCount: number;
  longevityScore: number;
  longevityHours: number;
  skinFadeHour: number;
  clothingResidualHours: number;
  longevityTier: 'skin_scent' | 'moderate' | 'long_lasting' | 'beast_mode';
  longevityGradeAr: string;
  longevityGradeEn: string;
  projectionScore: number;
  peakProjectionMeters: number;
  settledProjectionMeters: number;
  peakWindowMinutes: number;
  projectionTier: 'intimate' | 'moderate' | 'arm_length' | 'room_filler';
  projectionGradeAr: string;
  projectionGradeEn: string;
  sillageTrailScore: number;
  timelineStages: SampleTimelineStage[];
  ingredientContributions: SampleIngredientContribution[];
  verdictSummaryAr: string;
  verdictSummaryEn: string;
  actionableTipAr: string;
  actionableTipEn: string;
}

function classifyMoleculePhysics(note: PyramidNote): {
  longevityFactor: number;
  projectionFactor: number;
  roleTagAr: string;
  roleTagEn: string;
} {
  const mat = matchMaterialMeta(note);
  const label = `${note.nameAr} ${note.nameEn} ${mat?.olfactoryFamily || ''}`.toLowerCase();

  if (/ambrox|أمبروكس|cetalox|سيتالوكس|iso\s*e\s*super|إيزو إي/.test(label)) {
    return {
      longevityFactor: 1.72,
      projectionFactor: 1.65,
      roleTagAr: 'مثبت وناشر جزيئي',
      roleTagEn: 'Molecular Fixative & Diffuser',
    };
  }
  if (/oud|عود|sandal|صندل|patchouli|باتشولي|vanil|فانيل|tonka|تونكا|coumarin|كومارين|evernyl|إيفرنيل|frankincense|لبان|vetiver|نجيل الهند|musk|مسك|galaxolide|جالاكسوليد|cedar|أرز/.test(label)) {
    return {
      longevityFactor: 1.68,
      projectionFactor: 0.92,
      roleTagAr: 'مرساة ثبات عميقة',
      roleTagEn: 'Deep Longevity Anchor',
    };
  }
  if (/hedione|هيديون|damascenone|داماسينون|aldehyde|ألدهيد|calone|كالون|ethyl\s*maltol|مالتول/.test(label)) {
    return {
      longevityFactor: 1.08,
      projectionFactor: 1.75,
      roleTagAr: 'مُضخّم إشعاع وفوحان',
      roleTagEn: 'High-Impact Sillage Booster',
    };
  }
  if (/rose|ورد|jasmine|ياسمين|cashmeran|كشميران|linalool|لينالول/.test(label) || note.category === 'heart') {
    return {
      longevityFactor: 1.15,
      projectionFactor: 1.25,
      roleTagAr: 'جسر وسط وهالة',
      roleTagEn: 'Heart Bridge & Aura',
    };
  }
  if (note.category === 'base' || mat?.category === 'fixative' || mat?.category === 'natural_resin') {
    return {
      longevityFactor: 1.5,
      projectionFactor: 0.95,
      roleTagAr: 'قاعدة تثبيت',
      roleTagEn: 'Base Fixation',
    };
  }
  return {
    longevityFactor: 0.52,
    projectionFactor: 1.48,
    roleTagAr: 'اندفاع افتتاحي سريع',
    roleTagEn: 'Volatile Opening Burst',
  };
}

export function generateSampleTestReport(input: SampleTestSimulationInput): SampleTestReport {
  const {
    formulaTitle,
    formulation,
    pyramidNotes,
    macerationDays,
    ambientTempC,
    humidityPct,
    skinType,
    sprayCount,
    wearScenario,
    applicationTarget,
  } = input;

  const scenarioTemp =
    wearScenario === 'indoor_ac' ? 21 : wearScenario === 'evening_open' ? 24 : Math.max(33, ambientTempC);
  const scenarioHumidity =
    wearScenario === 'indoor_ac' ? 40 : wearScenario === 'evening_open' ? 52 : Math.max(68, humidityPct);

  const baseSim = evaluateDesignerTrial({
    formulation,
    pyramidNotes,
    macerationDays,
    ambientTempC: scenarioTemp,
    humidityPct: scenarioHumidity,
  });

  const skinLongevityMult = skinType === 'dry' ? 0.82 : skinType === 'oily' ? 1.18 : 1.0;
  const skinProjectionMult = skinType === 'dry' ? 0.92 : skinType === 'oily' ? 1.1 : 1.0;

  const scenarioLongevityMult =
    wearScenario === 'indoor_ac' ? 1.12 : wearScenario === 'evening_open' ? 1.03 : 0.86;
  const scenarioProjectionMult =
    wearScenario === 'indoor_ac' ? 0.94 : wearScenario === 'evening_open' ? 1.12 : 1.22;

  const fabricLongevityMult = applicationTarget === 'skin_and_fabric' ? 1.16 : 1.0;
  const clampedSprays = clamp(Math.round(sprayCount || 3), 1, 6);
  const doseProjectionMult = clamp(0.84 + (clampedSprays - 1) * 0.095, 0.84, 1.32);
  const doseLongevityMult = clamp(0.92 + (clampedSprays - 1) * 0.035, 0.92, 1.1);

  const totalPct = Math.max(
    1,
    pyramidNotes.reduce((sum, n) => sum + (Number(n.percentageOfOil) || 0), 0),
  );

  // Per-ingredient contribution physics
  const rawContribs = pyramidNotes.map((note) => {
    const share = (Number(note.percentageOfOil) || 0) / totalPct;
    const phys = classifyMoleculePhysics(note);
    return {
      note,
      rawLong: share * phys.longevityFactor,
      rawProj: share * phys.projectionFactor,
      phys,
    };
  });

  const sumRawLong = Math.max(0.01, rawContribs.reduce((s, r) => s + r.rawLong, 0));
  const sumRawProj = Math.max(0.01, rawContribs.reduce((s, r) => s + r.rawProj, 0));

  const ingredientContributions: SampleIngredientContribution[] = rawContribs
    .map(({ note, rawLong, rawProj, phys }) => ({
      noteId: note.id,
      nameAr: note.nameAr || note.nameEn,
      nameEn: note.nameEn || note.nameAr,
      category: note.category,
      oilPercent: +(Number(note.percentageOfOil) || 0).toFixed(1),
      longevityContributionPct: Math.round((rawLong / sumRawLong) * 100),
      projectionContributionPct: Math.round((rawProj / sumRawProj) * 100),
      roleTagAr: phys.roleTagAr,
      roleTagEn: phys.roleTagEn,
    }))
    .sort((a, b) => b.longevityContributionPct + b.projectionContributionPct - (a.longevityContributionPct + a.projectionContributionPct));

  // Molecular weighted multipliers from active ingredient selection
  const avgLongevityIndex = clamp(sumRawLong, 0.55, 1.65);
  const avgProjectionIndex = clamp(sumRawProj, 0.7, 1.65);

  const longevityHours = pyramidNotes.length
    ? +clamp(
        baseSim.estimatedLongevityHours *
          (0.68 + avgLongevityIndex * 0.35) *
          skinLongevityMult *
          scenarioLongevityMult *
          fabricLongevityMult *
          doseLongevityMult,
        1.5,
        24,
      ).toFixed(1)
    : 0;

  const skinFadeHour = pyramidNotes.length
    ? +clamp(longevityHours * (applicationTarget === 'skin_and_fabric' ? 0.8 : 0.95), 1, 20).toFixed(1)
    : 0;

  const clothingResidualHours = pyramidNotes.length
    ? +clamp(
        longevityHours * (applicationTarget === 'skin_and_fabric' ? 2.4 : 1.55) * (baseSim.normalizedTiers.base >= 35 ? 1.25 : 1),
        2,
        72,
      ).toFixed(0)
    : 0;

  const peakProjectionMeters = pyramidNotes.length
    ? +clamp(
        baseSim.peakProjectionMeters *
          (0.65 + avgProjectionIndex * 0.34) *
          skinProjectionMult *
          scenarioProjectionMult *
          doseProjectionMult,
        0.35,
        3.2,
      ).toFixed(2)
    : 0;

  const settledProjectionMeters = pyramidNotes.length
    ? +clamp(peakProjectionMeters * (0.44 + (baseSim.normalizedTiers.heart + baseSim.normalizedTiers.base) / 220), 0.2, 2.2).toFixed(2)
    : 0;

  const peakWindowMinutes = pyramidNotes.length
    ? Math.round(
        clamp(
          18 + (baseSim.normalizedTiers.top * 0.45 + baseSim.normalizedTiers.heart * 0.65) - (wearScenario === 'humid_summer' ? 8 : 0),
          12,
          75,
        ),
      )
    : 0;

  const longevityScore = pyramidNotes.length ? clamp(Math.round((longevityHours / 14) * 100), 10, 100) : 0;
  const projectionScore = pyramidNotes.length ? clamp(Math.round((peakProjectionMeters / 2.6) * 100), 10, 100) : 0;
  const sillageTrailScore = pyramidNotes.length
    ? clamp(Math.round(longevityScore * 0.45 + projectionScore * 0.55), 10, 100)
    : 0;

  const longevityTier: SampleTestReport['longevityTier'] =
    longevityHours < 4
      ? 'skin_scent'
      : longevityHours < 7.5
      ? 'moderate'
      : longevityHours < 11
      ? 'long_lasting'
      : 'beast_mode';

  const longevityGradeAr =
    longevityTier === 'beast_mode'
      ? 'ثبات أسطوري فائق (نخبة)'
      : longevityTier === 'long_lasting'
      ? 'ثبات طويل ممتاز'
      : longevityTier === 'moderate'
      ? 'ثبات متوسط يومي'
      : 'ثبات خفيف قريب من البشرة';
  const longevityGradeEn =
    longevityTier === 'beast_mode'
      ? 'Beast-Mode Tenacity'
      : longevityTier === 'long_lasting'
      ? 'Long-Lasting Signature'
      : longevityTier === 'moderate'
      ? 'Moderate Daily Wear'
      : 'Intimate / Light Wear';

  const projectionTier: SampleTestReport['projectionTier'] =
    peakProjectionMeters < 0.9
      ? 'intimate'
      : peakProjectionMeters < 1.55
      ? 'moderate'
      : peakProjectionMeters < 2.2
      ? 'arm_length'
      : 'room_filler';

  const projectionGradeAr =
    projectionTier === 'room_filler'
      ? 'فوحان عريض يملأ المكان'
      : projectionTier === 'arm_length'
      ? 'انتشار قوي بطول الذراع+'
      : projectionTier === 'moderate'
      ? 'فوحان متوازن وأنيق'
      : 'هالة شخصية قريبة';
  const projectionGradeEn =
    projectionTier === 'room_filler'
      ? 'High Room-Filling Aura'
      : projectionTier === 'arm_length'
      ? 'Strong Arm-Length+ Projection'
      : projectionTier === 'moderate'
      ? 'Balanced Moderate Halo'
      : 'Close Skin Aura';

  const notesByCat = (cats: Array<'top' | 'heart' | 'base'>) => {
    const picked = pyramidNotes
      .filter((n) => cats.includes(n.category))
      .sort((a, b) => b.percentageOfOil - a.percentageOfOil)
      .slice(0, 3);
    return {
      ar: picked.map((n) => (n.nameAr || n.nameEn).split('(')[0].trim()),
      en: picked.map((n) => (n.nameEn || n.nameAr).split('(')[0].trim()),
    };
  };

  const curveAt = (minTarget: number) =>
    baseSim.evaporationCurve.reduce((best, p) =>
      Math.abs(p.minute - minTarget) < Math.abs(best.minute - minTarget) ? p : best,
    );

  const pOpen = curveAt(15);
  const pHeart = curveAt(120);
  const pBase = curveAt(360);
  const pRes = curveAt(600);

  const openNotes = notesByCat(['top', 'heart']);
  const heartNotes = notesByCat(['heart', 'top']);
  const baseNotes = notesByCat(['base', 'heart']);
  const resNotes = notesByCat(['base']);

  const timelineStages: SampleTimelineStage[] = [
    {
      stageId: 'opening',
      windowLabel: '0m – 30m',
      titleAr: 'انفجار الافتتاحية والانطباع الأول',
      titleEn: 'Opening Blast & First Impression',
      intensityPct: clamp(Math.round(pOpen.compositeSillage * (0.9 + clampedSprays * 0.03)), 0, 100),
      radiusMeters: peakProjectionMeters,
      dominantNotesAr: openNotes.ar,
      dominantNotesEn: openNotes.en,
      behaviorAr:
        baseSim.normalizedTiers.top >= 15
          ? `افتتاحية نشطة بدفع الإيثانول (${formulation.alcoholPercentage}%) تبلغ ذروتها عند ${peakWindowMinutes} دقيقة.`
          : 'افتتاحية هادئة تندفع مباشرة نحو قلب التركيبة.',
      behaviorEn:
        baseSim.normalizedTiers.top >= 15
          ? `Active ethanol lift (${formulation.alcoholPercentage}% ABV) peaking within ~${peakWindowMinutes} min.`
          : 'Restrained opening moving smoothly straight into the floral/woody core.',
    },
    {
      stageId: 'heart',
      windowLabel: '30m – 3h',
      titleAr: 'تفتح القلب وتشكّل الهالة',
      titleEn: 'Heart Bloom & Settled Aura',
      intensityPct: clamp(Math.round(pHeart.compositeSillage * skinProjectionMult), 0, 100),
      radiusMeters: settledProjectionMeters,
      dominantNotesAr: heartNotes.ar,
      dominantNotesEn: heartNotes.en,
      behaviorAr: baseSim.hasBridgeGap
        ? 'انتقال حذر بسبب ضعف نسبة القلب؛ قد يلاحظ المختبِر تراجعاً سريعاً بعد الساعة الأولى.'
        : `تتمدد الهالة بثبات حول المرتدي بمدى ~${settledProjectionMeters} متر مع اندماج سلس.`,
      behaviorEn: baseSim.hasBridgeGap
        ? 'Slightly hollow bridge transition due to lower Heart weighting after hour 1.'
        : `Even spatial bloom around ~${settledProjectionMeters} m with smooth accord transition.`,
    },
    {
      stageId: 'drydown',
      windowLabel: '3h – 8h',
      titleAr: 'الاستقرار العميق وبصمة الجلد',
      titleEn: 'Deep Dry-Down & Base Tenacity',
      intensityPct: clamp(Math.round(pBase.compositeSillage * skinLongevityMult), 0, 100),
      radiusMeters: +(settledProjectionMeters * 0.58).toFixed(2),
      dominantNotesAr: baseNotes.ar,
      dominantNotesEn: baseNotes.en,
      behaviorAr: `تتمسك جزيئات القاعدة والمثبت (${formulation.fixativePercent}%) ببشرة المختبِر وتمنح دفئاً مستقراً حتى ${skinFadeHour} ساعة.`,
      behaviorEn: `Base resins and fixatives (${formulation.fixativePercent}%) anchor dry-down to skin up to ~${skinFadeHour} h.`,
    },
    {
      stageId: 'residual',
      windowLabel: '8h+',
      titleAr: 'الأثر المتبقي على الجلد والقماش',
      titleEn: 'Late Skin Trace & Fabric Residual',
      intensityPct: clamp(Math.round(pRes.compositeSillage * fabricLongevityMult), 0, 100),
      radiusMeters: +(settledProjectionMeters * 0.25).toFixed(2),
      dominantNotesAr: resNotes.ar,
      dominantNotesEn: resNotes.en,
      behaviorAr:
        applicationTarget === 'skin_and_fabric'
          ? `يمتد الأثر النظيف على الأنسجة والملابس حتى ~${clothingResidualHours} ساعة.`
          : `أثر حميمي قريب من المعصم بعد الساعة ${skinFadeHour} (يمتد أطول على الملابس).`,
      behaviorEn:
        applicationTarget === 'skin_and_fabric'
          ? `Lingering fabric trail persists up to ~${clothingResidualHours} h on collars & cuffs.`
          : `Close personal wrist trace after ${skinFadeHour} h (significantly longer if misted on fabric).`,
    },
  ];

  const reportCode = `SMPL-${Math.round(formulation.concentrationPercent)}C-${clampedSprays}S-${baseSim.readinessScore}`;

  const verdictSummaryAr =
    pyramidNotes.length === 0
      ? 'يرجى إضافة نوتات عطرية على طاولة التجارب لتوليد تقرير العينة.'
      : `تُظهر محاكاة العينة لتركيبة «${formulaTitle}» (${formulation.concentrationPercent}% زيت، ${clampedSprays} بخات) ثباتاً متوقعاً يصل إلى ${longevityHours} ساعة على البشرة (${clothingResidualHours} ساعة على الملابس) مع ذروة انتشار ${peakProjectionMeters} متر.`;

  const verdictSummaryEn =
    pyramidNotes.length === 0
      ? 'Add fragrance notes to the trial bench to generate a sample wear report.'
      : `Virtual sample test for "${formulaTitle}" (${formulation.concentrationPercent}% oil, ${clampedSprays} sprays) forecasts ${longevityHours} h skin longevity (~${clothingResidualHours} h on fabric) with a ${peakProjectionMeters} m peak projection halo.`;

  const actionableTipAr =
    longevityHours < 6
      ? 'لرفع ثبات العينة فوق 7 ساعات: زِد نسبة القاعدة الخشبية/العنبرية أو أضف 1.5% أمبروكسان مع رفع المثبت DPG.'
      : peakProjectionMeters < 1.2
      ? 'لزيادة انتشار العينة دون إثقالها: أدخل 8–12% هيديون أو 5% Iso E Super لتوسيع الهالة الهوائية.'
      : baseSim.hasBridgeGap
      ? 'نتيجة العينة قوية، لكن سد الفجوة الجسرية في طبقة القلب سيجعل الانتقال بين الافتتاحية والقاعدة أكثر فخامة.'
      : 'أداء العينة ممتاز في الثبات والانتشار وجاهز للتحضير المعملي الفعلي ومراقبة التعتيق.';

  const actionableTipEn =
    longevityHours < 6
      ? 'To push sample wear past 7h: raise base-note tenacity or add 1.5% Ambroxan + 1.5% DPG fixative.'
      : peakProjectionMeters < 1.2
      ? 'To widen sample projection airiness: dose 8–12% Hedione or 5% Iso E Super for horizontal lift.'
      : baseSim.hasBridgeGap
      ? 'Solid projection/longevity metrics — strengthening the Heart bridge will polish the 1-hour transition.'
      : 'Sample achieves commercial-grade wear and projection balance, ready for bench compounding.';

  return {
    reportCode,
    formulaTitle,
    noteCount: pyramidNotes.length,
    longevityScore,
    longevityHours,
    skinFadeHour,
    clothingResidualHours,
    longevityTier,
    longevityGradeAr,
    longevityGradeEn,
    projectionScore,
    peakProjectionMeters,
    settledProjectionMeters,
    peakWindowMinutes,
    projectionTier,
    projectionGradeAr,
    projectionGradeEn,
    sillageTrailScore,
    timelineStages,
    ingredientContributions,
    verdictSummaryAr,
    verdictSummaryEn,
    actionableTipAr,
    actionableTipEn,
  };
}

