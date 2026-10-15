import { PyramidNote } from '../types/perfume';

export interface EnrichedPyramidNote extends PyramidNote {
  volatilityRank: number;
  evaporationTime: string;
  diffusionRadius: string;
  scentFamily?: string;
  qualityGrade?: string;
}

export function enrichPyramidNote(note: PyramidNote): EnrichedPyramidNote {
  let volatilityRank = 5;
  let evaporationTime = '2 - 4 ساعات';
  let diffusionRadius = 'نصف قطر متوسط (~1.5م)';
  let scentFamily = 'زهري أروماتيك';
  let qualityGrade = 'نقاء معملي فاخر (Cosmetic Grade A)';

  if (note.category === 'top') {
    volatilityRank = 2;
    evaporationTime = '15 - 45 دقيقة';
    diffusionRadius = 'إشعاع فوري عريض (~3م)';
    scentFamily = 'حمضيات وأروماتيك متطاير';
  } else if (note.category === 'heart') {
    volatilityRank = 5;
    evaporationTime = '2 - 5 ساعات';
    diffusionRadius = 'هالة متوسطة (~2م)';
    scentFamily = 'زهور وتوابل دافئة';
  } else if (note.category === 'base') {
    volatilityRank = 9;
    evaporationTime = '12 - 24+ ساعة';
    diffusionRadius = 'ثبات حميمي ملتصق (~1م)';
    scentFamily = 'أخشاب وعنبر وراتنجات';
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

// ─── Real-time evaporation kinetics (spray simulator) ─────────────────────────

export interface EvaporationKinetics {
  /** Perfume oil still on the skin, 0–100 %. */
  oilRemainingOnSkinPct: number;
  /** Carrier alcohol still present, 0–100 %. */
  alcoholRemainingPct: number;
  /** Current evaporation flux of the oil phase. */
  evaporationRateMgPerHour: number;
  /** Which pyramid tier dominates the vapour right now. */
  dominantVaporTier: 'top' | 'heart' | 'base';
  /** Share of each tier in the vapour being released now. */
  vaporComposition: { topPct: number; heartPct: number; basePct: number };
  /** Oil anchored into the skin lipid barrier, 0–100 %. */
  skinAdsorptionPercent: number;
  /** Approximate scent-bubble radius around the wearer. */
  sillageRadiusMeters: number;
}

const clampPct = (v: number) => Math.max(0, Math.min(100, Math.round(v * 10) / 10));

/**
 * First-order evaporation per tier. Rate constants double roughly every +10 °C of skin
 * temperature; a higher oil concentration slows the relative loss of the oil phase.
 */
export function calculateEvaporationKinetics(
  currentMinutes: number,
  concentrationPercent: number,
  skinTempC: number,
  topRatio: number,
  heartRatio: number,
  baseRatio: number,
): EvaporationKinetics {
  const t = Math.max(0, currentMinutes) / 60; // hours
  const tempFactor = Math.pow(2, (skinTempC - 32) / 10);
  const total = Math.max(1, topRatio + heartRatio + baseRatio);
  const share = { top: topRatio / total, heart: heartRatio / total, base: baseRatio / total };
  const concentrationFactor = Math.min(1.6, Math.max(0.6, 15 / Math.max(5, concentrationPercent)));
  const k = {
    top: 1.35 * tempFactor * concentrationFactor,
    heart: 0.34 * tempFactor * concentrationFactor,
    base: 0.055 * tempFactor * concentrationFactor,
    alcohol: 5.5 * tempFactor,
  };
  const remaining = {
    top: Math.exp(-k.top * t),
    heart: Math.exp(-k.heart * t),
    base: Math.exp(-k.base * t),
  };
  const oilRemaining = (share.top * remaining.top + share.heart * remaining.heart + share.base * remaining.base) * 100;
  const flux = {
    top: k.top * remaining.top * share.top,
    heart: k.heart * remaining.heart * share.heart,
    base: k.base * remaining.base * share.base,
  };
  const fluxTotal = Math.max(1e-9, flux.top + flux.heart + flux.base);
  const dominantVaporTier = (flux.top >= flux.heart && flux.top >= flux.base ? 'top' : flux.heart >= flux.base ? 'heart' : 'base') as EvaporationKinetics['dominantVaporTier'];
  // A typical spray deposits ~10–15 mg of oil; scale the flux into mg/h.
  const evaporationRateMgPerHour = Math.round(fluxTotal * 26 * Math.min(2, Math.max(0.5, concentrationPercent / 15)) * 10) / 10;
  const skinAdsorptionPercent = clampPct((1 - oilRemaining / 100) * 45 + share.base * 30 * (1 - Math.exp(-t / 2.5)) + 8 * (1 - Math.exp(-t / 0.5)));
  return {
    oilRemainingOnSkinPct: clampPct(oilRemaining),
    alcoholRemainingPct: clampPct(Math.exp(-k.alcohol * t) * 100),
    evaporationRateMgPerHour,
    dominantVaporTier,
    vaporComposition: {
      topPct: Math.round((flux.top / fluxTotal) * 100),
      heartPct: Math.round((flux.heart / fluxTotal) * 100),
      basePct: Math.round((flux.base / fluxTotal) * 100),
    },
    skinAdsorptionPercent,
    sillageRadiusMeters: Math.round(Math.max(0.2, Math.min(3.5, evaporationRateMgPerHour / 9)) * 100) / 100,
  };
}
