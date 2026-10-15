import type { SupportedLanguage } from '../types/i18n';
import { noteMetric } from './noteL10n';
import { PyramidNote } from '../types/perfume';

export interface EnrichedPyramidNote extends PyramidNote {
  volatilityRank: number;
  evaporationTime: string;
  diffusionRadius: string;
  scentFamily?: string;
  qualityGrade?: string;
}

export function enrichPyramidNote(note: PyramidNote, lang: SupportedLanguage = 'ar'): EnrichedPyramidNote {
  let volatilityRank = 5;
  let evaporationTime = noteMetric('evap_default', lang);
  let diffusionRadius = noteMetric('radius_default', lang);
  let scentFamily = noteMetric('family_default', lang);
  const qualityGrade = noteMetric('grade_a', lang);

  if (note.category === 'top') {
    volatilityRank = 2;
    evaporationTime = noteMetric('evap_top', lang);
    diffusionRadius = noteMetric('radius_top', lang);
    scentFamily = noteMetric('family_top', lang);
  } else if (note.category === 'heart') {
    volatilityRank = 5;
    evaporationTime = noteMetric('evap_heart', lang);
    diffusionRadius = noteMetric('radius_heart', lang);
    scentFamily = noteMetric('family_heart', lang);
  } else if (note.category === 'base') {
    volatilityRank = 9;
    evaporationTime = noteMetric('evap_base', lang);
    diffusionRadius = noteMetric('radius_base', lang);
    scentFamily = noteMetric('family_base', lang);
  }

  return {
    ...note,
    volatilityRank,
    evaporationTime,
    diffusionRadius,
    scentFamily,
    qualityGrade,
  };
}

export function sortNotesByVolatilityOrder<T extends { category: string }>(notes: T[]): T[] {
  const order: Record<string, number> = { top: 1, heart: 2, base: 3 };
  return [...notes].sort((a, b) => (order[a.category] || 2) - (order[b.category] || 2));
}

export interface EvolutionScenarioStage {
  id?: string;
  timeMinutes: number;
  timeLabelAr: string;
  timeLabelEn?: string;
  stageNameAr?: string;
  stageNameEn?: string;
  stageSubtitleAr?: string;
  stageSubtitleEn?: string;
  dominantPhase?: string;
  skinAdhesionPercent?: number;
  evaporationStateAr?: string;
  evaporationStateEn?: string;
  sillageRating: string;
  sillageRatingEn?: string;
  sillagePercent: number;
  whatHappensTextAr: string;
  whatHappensTextEn?: string;
  olfactoryPerceptionTextAr: string;
  olfactoryPerceptionTextEn?: string;
  adviceForWearerAr: string;
  adviceForWearerEn?: string;
}

export interface EvolutionScenario {
  summaryStory: string;
  summaryStoryEn?: string;
  fastestFlyerName?: string;
  fastestFlyerNameEn?: string;
  deepestAnchorName?: string;
  deepestAnchorNameEn?: string;
  stages: EvolutionScenarioStage[];
}

export function generateCustomSprayScenario(
  notes: PyramidNote[],
  bottleVolumeMl = 50,
  concentrationPercent = 20
): EvolutionScenario {
  const topNotes = notes.filter((n) => n.category === 'top');
  const baseNotes = notes.filter((n) => n.category === 'base');
  const fastestFlyer = topNotes[0];
  const deepestAnchor = baseNotes[baseNotes.length - 1] || baseNotes[0];

  const stages: EvolutionScenarioStage[] = [
    {
      id: 'opening',
      dominantPhase: 'top',
      stageNameAr: 'الانفجار الأولي وتبخر الكحول',
      stageNameEn: 'Initial Mist & Alcohol Flash',
      stageSubtitleAr: 'الوهج الإشعاعي الأول وتطاير الجزيئات الخفيفة',
      stageSubtitleEn: 'First olfactory burst and radiant evaporation',
      skinAdhesionPercent: 15,
      evaporationStateAr: 'تبخر متسارع فوار',
      evaporationStateEn: 'Rapid Flash Evaporation',
      timeMinutes: 0,
      timeLabelAr: 'لحظة الرش الأولى (0 - 5 دقائق)',
      timeLabelEn: 'Initial Spray (0 - 5 min)',
      sillageRating: 'إشعاع نفاث فوار (10/10)',
      sillageRatingEn: 'Explosive Sillage (10/10)',
      sillagePercent: 100,
      whatHappensTextAr: 'تبخر فوري للكحول الإيثيلي حاملاً الجزيئات الأخف وزناً في سحابة رذاذية متلألئة.',
      whatHappensTextEn: 'Rapid ethanol flash-off projecting initial volatile top notes into the surrounding air.',
      olfactoryPerceptionTextAr: 'انتعاش باهر تهيمن عليه النوتات العليا المشرقة، مع لمعان حمضي أروماتيك فوار.',
      olfactoryPerceptionTextEn: 'Bright opening dominated by sparkling citrus and fresh opening accords.',
      adviceForWearerAr: 'لا تحكم على العطر فوراً؛ دعه يستقر دقيقتين على الجلد لتهدأ لسعة الكحول.',
      adviceForWearerEn: 'Allow the alcohol mist to settle on warm skin before assessing the opening.',
    },
    {
      id: 'heart_bloom',
      dominantPhase: 'heart',
      stageNameAr: 'تفتح قلب العطر والانسجام الزهري',
      stageNameEn: 'Heart Note Bloom & Spices',
      stageSubtitleAr: 'توازن النوتات المتوسطة وانطلاق الروح الأساسية',
      stageSubtitleEn: 'True olfactory soul and floral/spice harmonic chord',
      skinAdhesionPercent: 55,
      evaporationStateAr: 'تطاير معتدل مستقر',
      evaporationStateEn: 'Steady Moderate Diffusion',
      timeMinutes: 30,
      timeLabelAr: 'انفتاح قلب العطر (15 - 60 دقيقة)',
      timeLabelEn: 'Heart Bloom (15 - 60 min)',
      sillageRating: 'فوحان متألق واسع (8.5/10)',
      sillageRatingEn: 'Radiant Projection (8.5/10)',
      sillagePercent: 85,
      whatHappensTextAr: 'انتقال تدريجي من القمة المتطايرة إلى النوتات الزهرية والتوابل الدافئة في قلب التوليفة.',
      whatHappensTextEn: 'Transitioning from volatile top notes to radiant heart florals and warm spices.',
      olfactoryPerceptionTextAr: 'ظهور الهوية الحقيقية للعطر وباقة الورود والأخشاب المتوسطة بتناغم أنيق.',
      olfactoryPerceptionTextEn: 'The true soul and character of the fragrance emerges in full bloom.',
      adviceForWearerAr: 'هذا هو الوقت المثالي لدخول الاجتماعات والمناسبات بفوحان لافت وراقٍ.',
      adviceForWearerEn: 'Optimal projection window for formal appearances and social gatherings.',
    },
    {
      id: 'base_fusion',
      dominantPhase: 'heart_base',
      stageNameAr: 'اندماج الأخشاب والمثبتات العطرية',
      stageNameEn: 'Fixatives & Precious Woods Fusion',
      stageSubtitleAr: 'الاندماج المخملي مع حرارة البشرة',
      stageSubtitleEn: 'Deep intimate aura anchored by woods and resins',
      skinAdhesionPercent: 85,
      evaporationStateAr: 'تطاير بطيء ثابت',
      evaporationStateEn: 'Slow Tenacious Evaporation',
      timeMinutes: 180,
      timeLabelAr: 'مرحلة الاستقرار والاستدامة (2 - 5 ساعات)',
      timeLabelEn: 'Heart & Base Fusion (2 - 5 hours)',
      sillageRating: 'هالة عطرية متوازنة (7/10)',
      sillageRatingEn: 'Enveloping Aura (7/10)',
      sillagePercent: 70,
      whatHappensTextAr: 'اندماج جزيئات القلب مع الأخشاب والراتنجات والمثبتات في قاعدة العطر.',
      whatHappensTextEn: 'Fixative molecules and base resins integrate smoothly with remaining heart notes.',
      olfactoryPerceptionTextAr: 'دفء مخملي، روائح الأخشاب واللبان والصندل تصبح أكثر وضوحاً ونعومة.',
      olfactoryPerceptionTextEn: 'Warm woody, amber, and musky drydown accords establish lasting skin intimacy.',
      adviceForWearerAr: 'العطر يتفاعل بعمق مع كيمياء بشرتك وحرارة جسمك الطبيعية.',
      adviceForWearerEn: 'The formulation bonds intimately with personal skin chemistry and warmth.',
    },
    {
      id: 'drydown',
      dominantPhase: 'base',
      stageNameAr: 'القاعدة العميقة والدراي داون التام',
      stageNameEn: 'Deep Drydown & Persistent Skin Trail',
      stageSubtitleAr: 'ثبات الأمبروكسان والمسك والعود على الأنسجة',
      stageSubtitleEn: 'Persistent skin scent and fabric retention memory',
      skinAdhesionPercent: 98,
      evaporationStateAr: 'ثبات دائم هادئ',
      evaporationStateEn: 'Ultra-Slow Residual Anchor',
      timeMinutes: 480,
      timeLabelAr: 'القاعدة العميقة والدراي داون (6 - 12+ ساعة)',
      timeLabelEn: 'Deep Drydown (6 - 12+ hours)',
      sillageRating: 'ثبات دائم حميمي (5.5/10)',
      sillageRatingEn: 'Tenacious Skin Scent (5.5/10)',
      sillagePercent: 55,
      whatHappensTextAr: 'استقرار بطيء جداً للأمبروكسان، والمسك النقي، والعود المعتق على الأقمشة ومسامات الجلد.',
      whatHappensTextEn: 'Tenacious base fixatives like Ambroxan, musks, and aged resins persist on fabrics.',
      olfactoryPerceptionTextAr: 'أثر عطري ساحر وثابت يعلق بالملابس ويترك بصمة فاخرة في الذاكرة.',
      olfactoryPerceptionTextEn: 'A mesmerizing residual memory lingering on garments for days.',
      adviceForWearerAr: 'ثبات ممتاز؛ يترك رائحة فارهة على الشماغ والأوشحة تدوم حتى بعد انتهاء اليوم.',
      adviceForWearerEn: 'Exceptional longevity clinging to collars, scarves, and fabrics.',
    },
  ];

  return {
    summaryStory: `عطر بحجم ${bottleVolumeMl} مل وبتركيز ${concentrationPercent}% مصمم وفق أرقى معايير التوزيع الفيزيوكيميائي للنوتات العطرية، متدرج من افتتاحية فوارة إلى قاعدة شرقية خشبية عميقة.`,
    summaryStoryEn: `Formulation (${bottleVolumeMl}ml at ${concentrationPercent}% concentration) engineered for harmonious evaporation kinetics from sparkling opening to deep tenacious drydown.`,
    fastestFlyerName: fastestFlyer?.nameAr || 'البرغموت الإيطالي',
    fastestFlyerNameEn: fastestFlyer?.nameEn || 'Calabrian Bergamot',
    deepestAnchorName: deepestAnchor?.nameAr || 'الأمبروكسان والعود الملكي',
    deepestAnchorNameEn: deepestAnchor?.nameEn || 'Ambroxan & Royal Oud',
    stages,
  };
}

export function getNoteActivityAtMinute(volatilityRank: number, currentMinutes: number) {
  // Higher rank = slower evaporation (base note: rank 8-10, heart: 4-7, top: 1-3)
  const halfLifeMinutes = volatilityRank <= 3 ? 35 : volatilityRank <= 7 ? 180 : 540;

  const activeFraction = Math.pow(0.5, currentMinutes / halfLifeMinutes);
  const activePercent = Math.round(Math.max(5, Math.min(100, activeFraction * 100)));
  const evaporatedPercent = 100 - activePercent;

  let statusTextAr = 'نشط وفواح';
  let statusBadgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-300';

  if (activePercent > 80) {
    statusTextAr = 'قمة النشاط والفوحان 🔥';
    statusBadgeClass = 'bg-amber-100 text-amber-900 border-amber-300';
  } else if (activePercent > 40) {
    statusTextAr = 'انتشار معتدل مستقر ✨';
    statusBadgeClass = 'bg-blue-50 text-blue-800 border-blue-300';
  } else if (activePercent > 15) {
    statusTextAr = 'أثر جلدي ناعم 🍃';
    statusBadgeClass = 'bg-stone-100 text-stone-700 border-stone-300';
  } else {
    statusTextAr = 'تبخر كلياً تقريباً 💨';
    statusBadgeClass = 'bg-stone-50 text-stone-400 border-stone-200';
  }

  return {
    activePercent,
    evaporatedPercent,
    statusTextAr,
    statusBadgeClass,
  };
}

export interface EvaporationKinetics {
  alcoholRemainingPct: number;
  oilRemainingOnSkinPct: number;
  evaporationRateMgPerHour: number;
  sillageRadiusMeters: number;
  skinAdsorptionPercent: number;
  topActivePct: number;
  heartActivePct: number;
  baseActivePct: number;
  vaporComposition: {
    topPct: number;
    heartPct: number;
    basePct: number;
  };
  dominantVaporTier: 'top' | 'heart' | 'base';
  phaseStage: 'flash' | 'top_bloom' | 'heart_unfold' | 'base_anchored' | 'drydown_intimate';
}

export function calculateEvaporationKinetics(
  minutes: number,
  concentrationPercent: number = 20,
  skinTempCelsius: number = 36.5,
  topRatio: number = 30,
  heartRatio: number = 50,
  baseRatio: number = 20
): EvaporationKinetics {
  // Arrhenius temperature scaling relative to 36.5°C normal body temperature
  const tempDelta = skinTempCelsius - 36.5;
  const tempSpeedFactor = Math.pow(1.08, tempDelta); // ~8% speed change per °C

  // Concentration damping factor: higher concentration = more viscous oil film & fixative retention
  const concDamping = 1 + (concentrationPercent - 20) * 0.012;

  // 1. Alcohol Flash-Off: 100% at 0m, drops to 0% by minute 1.5 - 2.0
  const alcoholRemainingPct = minutes <= 0 ? 100 : Math.max(0, Math.round(100 * Math.pow(Math.max(0, 1 - minutes / 1.5), 2)));

  // 2. Individual Tier Remaining fractions (on skin & active)
  const topHalfLife = (32 * concDamping) / tempSpeedFactor;
  const heartHalfLife = (160 * concDamping) / tempSpeedFactor;
  const baseHalfLife = (620 * concDamping) / tempSpeedFactor;

  const topActivePct = Math.round(100 * Math.pow(0.5, minutes / topHalfLife));
  const heartActivePct = Math.round(100 * Math.pow(0.5, minutes / heartHalfLife));
  const baseActivePct = Math.round(100 * Math.pow(0.5, minutes / baseHalfLife));

  // 3. Total Perfume Oil remaining on skin (weighted by formulation tier ratio)
  const totalRatio = (topRatio + heartRatio + baseRatio) || 100;
  const normalizedTop = topRatio / totalRatio;
  const normalizedHeart = heartRatio / totalRatio;
  const normalizedBase = baseRatio / totalRatio;

  const oilRemainingOnSkinPct = Math.max(
    2,
    Math.round(
      normalizedTop * topActivePct +
      normalizedHeart * heartActivePct +
      normalizedBase * baseActivePct
    )
  );

  // 4. Skin Adsorption / Fixation rate:
  // Starts at 20% right upon spraying (floating liquid droplets), quickly reaches 90-98% as alcohol flashes off and base notes anchor to skin sebum/lipids
  const skinAdsorptionPercent = minutes < 1
    ? Math.round(20 + minutes * 55)
    : Math.min(99, Math.round(75 + (1 - Math.exp(-minutes / 15)) * 24));

  // 5. Instantaneous Evaporation Rate (mg/cm²/h):
  // Formula based on Langmuir-Knudsen evaporation model:
  // High initial rate (~2.8 mg/cm²/h) dropping exponentially to a steady skin diffusion (~0.05 mg/cm²/h)
  const initialPeakRate = 2.4 * tempSpeedFactor * (concentrationPercent / 20);
  const evaporationRateMgPerHour = parseFloat(
    Math.max(
      0.02,
      (initialPeakRate * (normalizedTop * (topActivePct / 100) * 1.8 +
       normalizedHeart * (heartActivePct / 100) * 0.6 +
       normalizedBase * (baseActivePct / 100) * 0.12))
    ).toFixed(2)
  );

  // 6. Sillage Projection Radius (meters in 3D air)
  // Explodes to 3.2m at minute 0, gradually contract to skin scent (0.2m)
  const rawRadius = 3.2 * (topActivePct * 0.006 + heartActivePct * 0.003 + baseActivePct * 0.001);
  const sillageRadiusMeters = parseFloat(Math.max(0.15, Math.min(3.5, rawRadius)).toFixed(2));

  // 7. Vapor phase composition in the air right now
  const topVaporWeight = normalizedTop * (topActivePct / 100) * 4.0;
  const heartVaporWeight = normalizedHeart * (heartActivePct / 100) * 1.5;
  const baseVaporWeight = normalizedBase * (baseActivePct / 100) * 0.3;
  const totalVaporWeight = (topVaporWeight + heartVaporWeight + baseVaporWeight) || 1;

  const vaporComposition = {
    topPct: Math.round((topVaporWeight / totalVaporWeight) * 100),
    heartPct: Math.round((heartVaporWeight / totalVaporWeight) * 100),
    basePct: Math.max(0, 100 - Math.round((topVaporWeight / totalVaporWeight) * 100) - Math.round((heartVaporWeight / totalVaporWeight) * 100)),
  };

  let dominantVaporTier: 'top' | 'heart' | 'base' = 'top';
  if (vaporComposition.basePct > vaporComposition.topPct && vaporComposition.basePct > vaporComposition.heartPct) {
    dominantVaporTier = 'base';
  } else if (vaporComposition.heartPct > vaporComposition.topPct) {
    dominantVaporTier = 'heart';
  }

  let phaseStage: EvaporationKinetics['phaseStage'] = 'flash';
  if (minutes < 5) phaseStage = 'flash';
  else if (minutes < 30) phaseStage = 'top_bloom';
  else if (minutes < 180) phaseStage = 'heart_unfold';
  else if (minutes < 480) phaseStage = 'base_anchored';
  else phaseStage = 'drydown_intimate';

  return {
    alcoholRemainingPct,
    oilRemainingOnSkinPct,
    evaporationRateMgPerHour,
    sillageRadiusMeters,
    skinAdsorptionPercent,
    topActivePct,
    heartActivePct,
    baseActivePct,
    vaporComposition,
    dominantVaporTier,
    phaseStage,
  };
}

