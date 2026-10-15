import type { SupportedLanguage } from '../types/i18n';

/**
 * Pyramid analysis metrics (evaporation time, diffusion radius, scent family and
 * lab grade) shown by the fragrance pyramid and the spray simulator.
 *
 * These used to be Arabic-only literals, so every non-Arabic visitor saw Arabic.
 * They resolve language → English → Arabic and are extended wave by wave like the
 * other content packs.
 */
export type NoteMetricKey =
  | 'evap_top' | 'evap_heart' | 'evap_base' | 'evap_default'
  | 'radius_top' | 'radius_heart' | 'radius_base' | 'radius_default'
  | 'family_top' | 'family_heart' | 'family_base' | 'family_default'
  | 'grade_a';

export type NoteMetricPack = Partial<Record<SupportedLanguage, Partial<Record<NoteMetricKey, string>>>>;

export const NOTE_METRICS: NoteMetricPack = {
  ar: {
    evap_top: '15 - 45 دقيقة',
    evap_heart: '2 - 5 ساعات',
    evap_base: '12 - 24+ ساعة',
    evap_default: '2 - 4 ساعات',
    radius_top: 'إشعاع فوري عريض (~3م)',
    radius_heart: 'هالة متوسطة (~2م)',
    radius_base: 'ثبات حميمي ملتصق (~1م)',
    radius_default: 'نصف قطر متوسط (~1.5م)',
    family_top: 'حمضيات وأروماتيك متطاير',
    family_heart: 'زهور وتوابل دافئة',
    family_base: 'أخشاب وعنبر وراتنجات',
    family_default: 'زهري أروماتيك',
    grade_a: 'نقاء معملي فاخر (Cosmetic Grade A)',
  },
  en: {
    evap_top: '15 - 45 minutes',
    evap_heart: '2 - 5 hours',
    evap_base: '12 - 24+ hours',
    evap_default: '2 - 4 hours',
    radius_top: 'Wide instantaneous diffusion (~3 m)',
    radius_heart: 'Moderate halo (~2 m)',
    radius_base: 'Intimate skin adhesion (~1 m)',
    radius_default: 'Medium radius (~1.5 m)',
    family_top: 'Citrus & volatile aromatics',
    family_heart: 'Warm florals & spices',
    family_base: 'Woods, amber & resins',
    family_default: 'Floral aromatic',
    grade_a: 'Luxury lab purity (Cosmetic Grade A)',
  },
  fr: {
    evap_top: '15 - 45 minutes',
    evap_heart: '2 - 5 heures',
    evap_base: '12 - 24+ heures',
    evap_default: '2 - 4 heures',
    radius_top: 'Diffusion instantanée large (~3 m)',
    radius_heart: 'Halo modéré (~2 m)',
    radius_base: 'Adhérence cutanée intime (~1 m)',
    radius_default: 'Rayon moyen (~1,5 m)',
    family_top: 'Agrumes et aromatiques volatils',
    family_heart: 'Florales chaudes et épices',
    family_base: 'Bois, ambre et résines',
    family_default: 'Floral aromatique',
    grade_a: 'Pureté de laboratoire de luxe (Cosmetic Grade A)',
  },
  es: {
    evap_top: '15 - 45 minutos',
    evap_heart: '2 - 5 horas',
    evap_base: '12 - 24+ horas',
    evap_default: '2 - 4 horas',
    radius_top: 'Difusión instantánea amplia (~3 m)',
    radius_heart: 'Halo moderado (~2 m)',
    radius_base: 'Adherencia íntima a la piel (~1 m)',
    radius_default: 'Radio medio (~1,5 m)',
    family_top: 'Cítricos y aromáticos volátiles',
    family_heart: 'Florales cálidos y especias',
    family_base: 'Maderas, ámbar y resinas',
    family_default: 'Floral aromático',
    grade_a: 'Pureza de laboratorio de lujo (Cosmetic Grade A)',
  },
  it: {
    evap_top: '15 - 45 minuti',
    evap_heart: '2 - 5 ore',
    evap_base: '12 - 24+ ore',
    evap_default: '2 - 4 ore',
    radius_top: 'Diffusione istantanea ampia (~3 m)',
    radius_heart: 'Alone moderato (~2 m)',
    radius_base: 'Aderenza intima alla pelle (~1 m)',
    radius_default: 'Raggio medio (~1,5 m)',
    family_top: 'Agrumi e aromatici volatili',
    family_heart: 'Floreali caldi e spezie',
    family_base: 'Legni, ambra e resine',
    family_default: 'Floreale aromatico',
    grade_a: 'Purezza da laboratorio di lusso (Cosmetic Grade A)',
  },
  de: {
    evap_top: '15 - 45 Minuten',
    evap_heart: '2 - 5 Stunden',
    evap_base: '12 - 24+ Stunden',
    evap_default: '2 - 4 Stunden',
    radius_top: 'Weite sofortige Diffusion (~3 m)',
    radius_heart: 'Moderater Halo (~2 m)',
    radius_base: 'Intime Hauthaftung (~1 m)',
    radius_default: 'Mittlerer Radius (~1,5 m)',
    family_top: 'Zitrus & flüchtige Aromaten',
    family_heart: 'Warme Blüten & Gewürze',
    family_base: 'Hölzer, Amber & Harze',
    family_default: 'Blumig aromatisch',
    grade_a: 'Luxuriöse Laborreinheit (Cosmetic Grade A)',
  },
  ru: {
    evap_top: '15 - 45 минут',
    evap_heart: '2 - 5 часов',
    evap_base: '12 - 24+ часов',
    evap_default: '2 - 4 часа',
    radius_top: 'Широкая мгновенная диффузия (~3 м)',
    radius_heart: 'Умеренное облако (~2 м)',
    radius_base: 'Интимное сцепление с кожей (~1 м)',
    radius_default: 'Средний радиус (~1,5 м)',
    family_top: 'Цитрусы и летучие ароматики',
    family_heart: 'Тёплые цветы и специи',
    family_base: 'Древесина, амбра и смолы',
    family_default: 'Цветочно-ароматический',
    grade_a: 'Люксовая лабораторная чистота (Cosmetic Grade A)',
  },
  zh: {
    evap_top: '15 - 45 分钟',
    evap_heart: '2 - 5 小时',
    evap_base: '12 - 24+ 小时',
    evap_default: '2 - 4 小时',
    radius_top: '宽广瞬时光散（约 3 米）',
    radius_heart: '中等光晕（约 2 米）',
    radius_base: '贴身肌肤留香（约 1 米）',
    radius_default: '中等半径（约 1.5 米）',
    family_top: '柑橘与挥发性芳香',
    family_heart: '温暖花香与香料',
    family_base: '木质、琥珀与树脂',
    family_default: '花香芳香调',
    grade_a: '奢华实验室纯度（Cosmetic Grade A）',
  },
  tr: {
    evap_top: '15 - 45 dakika',
    evap_heart: '2 - 5 saat',
    evap_base: '12 - 24+ saat',
    evap_default: '2 - 4 saat',
    radius_top: 'Geniş anlık yayılım (~3 m)',
    radius_heart: 'Orta halo (~2 m)',
    radius_base: 'Cilde yakın tutunma (~1 m)',
    radius_default: 'Orta yarıçap (~1,5 m)',
    family_top: 'Narenciye ve uçucu aromatikler',
    family_heart: 'Sıcak çiçekler ve baharatlar',
    family_base: 'Ağaçlar, amber ve reçineler',
    family_default: 'Çiçeksi aromatik',
    grade_a: 'Lüks laboratuvar saflığı (Cosmetic Grade A)',
  },
  fa: {
    evap_top: '15 - 45 دقیقه',
    evap_heart: '2 - 5 ساعت',
    evap_base: '12 - 24+ ساعت',
    evap_default: '2 - 4 ساعت',
    radius_top: 'پراکندگی فوری گسترده (~3 متر)',
    radius_heart: 'هاله متعادل (~2 متر)',
    radius_base: 'چسبندگی نزدیک به پوست (~1 متر)',
    radius_default: 'شعاع متوسط (~1.5 متر)',
    family_top: 'مرکبات و آروماتیک‌های فرار',
    family_heart: 'گل‌های گرم و ادویه‌ها',
    family_base: 'چوب، عنبر و رزین‌ها',
    family_default: 'گلی آروماتیک',
    grade_a: 'خلوص آزمایشگاهی لوکس (Cosmetic Grade A)',
  },
};

/** Resolve a pyramid metric label: language → English → Arabic source. */
export const noteMetric = (key: NoteMetricKey, lang: SupportedLanguage): string =>
  NOTE_METRICS[lang]?.[key] || NOTE_METRICS.en?.[key] || NOTE_METRICS.ar?.[key] || key;
