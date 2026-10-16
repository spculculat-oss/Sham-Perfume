import type { SupportedLanguage } from '../types/i18n';
import { CONTENT_LABELS_EXTS } from './contentLabelsExt';

/**
 * Content chrome labels — the short chips and category names that appear above
 * the news articles, the materials encyclopedia and the fragrance pyramid.
 *
 * Longer editorial content (article bodies, perfume descriptions) follows the
 * Arabic → English fallback contract; these labels are short and are therefore
 * translated for the whole platform, wave by wave, exactly like the hub packs.
 */
export type ContentLabelKey =
  | 'news_trends'
  | 'news_exhibitions'
  | 'news_harvests'
  | 'news_ifra'
  | 'news_niche'
  | 'mat_solvent'
  | 'mat_fixative'
  | 'mat_aromachemical'
  | 'mat_natural_essential'
  | 'mat_natural_resin'
  | 'place_top'
  | 'place_heart'
  | 'place_base'
  | 'place_carrier'
  | 'place_all';

export type ContentLabelPack = Partial<Record<SupportedLanguage, Partial<Record<ContentLabelKey, string>>>>;

/** Base pack — Arabic source plus the nine core platform languages. */
export const CONTENT_LABELS: ContentLabelPack = {
  ar: {
    news_trends: 'صيحات وتقارير',
    news_exhibitions: 'معارض دولية',
    news_harvests: 'حصاد ومواد خام',
    news_ifra: 'لوائح IFRA ومعايير',
    news_niche: 'إصدارات وتقنيات النيش',
    mat_solvent: 'مذيب وأساس حامل',
    mat_fixative: 'مثبت ومرابط كيميائي',
    mat_aromachemical: 'جزيء عطري حديث',
    mat_natural_essential: 'زيت عطري / خلاصة نقية',
    mat_natural_resin: 'راتنج طبيعي وعود ثمين',
    place_top: 'نوتة عليا (الافتتاحية)',
    place_heart: 'نوتة قلب (الوسطى)',
    place_base: 'نوتة قاعدة (أساسية مثبتة)',
    place_carrier: 'مذيب حامل وأساس',
    place_all: 'شامل / كل المستويات',
  },
  en: {
    news_trends: 'Global Trends & Analytics',
    news_exhibitions: 'International Exhibitions & Salons',
    news_harvests: 'Botanical Harvests & Yields',
    news_ifra: 'IFRA Regulations & Safety',
    news_niche: 'Haute Parfumerie & Niche Houses',
    mat_solvent: 'Solvent & Carrier Base',
    mat_fixative: 'Chemical Fixative & Binder',
    mat_aromachemical: 'Modern Aromachemical Molecule',
    mat_natural_essential: 'Pure Essential Oil / Extract',
    mat_natural_resin: 'Natural Resin & Precious Oud',
    place_top: 'Top Note (Opening)',
    place_heart: 'Heart Note (Middle Bouquet)',
    place_base: 'Base Note (Deep Fixative)',
    place_carrier: 'Carrier Solvent & Base',
    place_all: 'Universal / All Levels',
  },
  fr: {
    news_trends: 'Tendances & Analyses Mondiales',
    news_exhibitions: 'Salons & Expositions Internationales',
    news_harvests: 'Récoltes & Rendements Botaniques',
    news_ifra: 'Réglementations & Sécurité IFRA',
    news_niche: 'Haute Parfumerie & Maisons de Niche',
    mat_solvent: 'Solvant & Base Support',
    mat_fixative: 'Fixateur & Liant Chimique',
    mat_aromachemical: 'Molécule Aromatique Moderne',
    mat_natural_essential: 'Huile Essentielle / Extrait Pur',
    mat_natural_resin: 'Résine Naturelle & Oud Précieux',
    place_top: 'Note de Tête (Ouverture)',
    place_heart: 'Note de Cœur (Bouquet Médian)',
    place_base: 'Note de Fond (Fixateur Profond)',
    place_carrier: 'Solvant Support & Base',
    place_all: 'Universel / Tous les Niveaux',
  },
  es: {
    news_trends: 'Tendencias y Análisis Globales',
    news_exhibitions: 'Ferias y Salones Internacionales',
    news_harvests: 'Cosechas y Rendimientos Botánicos',
    news_ifra: 'Normativas y Seguridad IFRA',
    news_niche: 'Alta Perfumería y Casas Nicho',
    mat_solvent: 'Disolvente y Base Portadora',
    mat_fixative: 'Fijador y Aglutinante Químico',
    mat_aromachemical: 'Molécula Aromática Moderna',
    mat_natural_essential: 'Aceite Esencial / Extracto Puro',
    mat_natural_resin: 'Resina Natural y Oud Precioso',
    place_top: 'Nota de Salida (Apertura)',
    place_heart: 'Nota de Corazón (Ramo Medio)',
    place_base: 'Nota de Fondo (Fijador Profundo)',
    place_carrier: 'Disolvente Portador y Base',
    place_all: 'Universal / Todos los Niveles',
  },
  it: {
    news_trends: 'Tendenze e Analisi Globali',
    news_exhibitions: 'Fiere e Saloni Internazionali',
    news_harvests: 'Raccolti e Rese Botaniche',
    news_ifra: 'Regolamenti e Sicurezza IFRA',
    news_niche: 'Alta Profumeria e Case Niche',
    mat_solvent: 'Solvente e Base Vettore',
    mat_fixative: 'Fissativo e Legante Chimico',
    mat_aromachemical: 'Molecola Aromatica Moderna',
    mat_natural_essential: 'Olio Essenziale / Estratto Puro',
    mat_natural_resin: 'Resina Naturale e Oud Prezioso',
    place_top: 'Nota di Testa (Apertura)',
    place_heart: 'Nota di Cuore (Bouquet Centrale)',
    place_base: 'Nota di Fondo (Fissativo Profondo)',
    place_carrier: 'Solvente Vettore e Base',
    place_all: 'Universale / Tutti i Livelli',
  },
  de: {
    news_trends: 'Globale Trends & Analysen',
    news_exhibitions: 'Internationale Messen & Salons',
    news_harvests: 'Botanische Ernten & Ausbeuten',
    news_ifra: 'IFRA-Vorschriften & Sicherheit',
    news_niche: 'Haute Parfumerie & Nischenhäuser',
    mat_solvent: 'Lösungsmittel & Trägerbasis',
    mat_fixative: 'Chemischer Fixierer & Bindemittel',
    mat_aromachemical: 'Moderne Aromachemikalie',
    mat_natural_essential: 'Reines ätherisches Öl / Extrakt',
    mat_natural_resin: 'Naturharz & Kostbares Oud',
    place_top: 'Kopfnote (Auftakt)',
    place_heart: 'Herznote (Mittleres Bouquet)',
    place_base: 'Basisnote (Tiefer Fixierer)',
    place_carrier: 'Trägerlösungsmittel & Basis',
    place_all: 'Universal / Alle Ebenen',
  },
  ru: {
    news_trends: 'Мировые тренды и аналитика',
    news_exhibitions: 'Международные выставки и салоны',
    news_harvests: 'Сборы урожая и выходы сырья',
    news_ifra: 'Регламенты и безопасность IFRA',
    news_niche: 'Высокая парфюмерия и нишевые дома',
    mat_solvent: 'Растворитель и несущая основа',
    mat_fixative: 'Химический фиксатор и связующее',
    mat_aromachemical: 'Современная аромамолекула',
    mat_natural_essential: 'Чистое эфирное масло / экстракт',
    mat_natural_resin: 'Натуральная смола и драгоценный уд',
    place_top: 'Верхняя нота (начало)',
    place_heart: 'Нота сердца (средний букет)',
    place_base: 'Базовая нота (глубокий фиксатор)',
    place_carrier: 'Несущий растворитель и основа',
    place_all: 'Универсально / все уровни',
  },
  zh: {
    news_trends: '全球趋势与分析',
    news_exhibitions: '国际展会与沙龙',
    news_harvests: '植物采收与产量',
    news_ifra: 'IFRA 法规与安全',
    news_niche: '高端香水与小众品牌',
    mat_solvent: '溶剂与载体基底',
    mat_fixative: '化学定香剂与黏合剂',
    mat_aromachemical: '现代香原料分子',
    mat_natural_essential: '纯精油 / 提取物',
    mat_natural_resin: '天然树脂与珍贵乌木',
    place_top: '前调（开场）',
    place_heart: '中调（核心香束）',
    place_base: '后调（深层定香）',
    place_carrier: '载体溶剂与基底',
    place_all: '通用 / 所有层次',
  },
  tr: {
    news_trends: 'Küresel Trendler ve Analizler',
    news_exhibitions: 'Uluslararası Fuarlar ve Salonlar',
    news_harvests: 'Bitkisel Hasat ve Verim',
    news_ifra: 'IFRA Düzenlemeleri ve Güvenlik',
    news_niche: 'Yüksek Parfümeri ve Niş Evler',
    mat_solvent: 'Çözücü ve Taşıyıcı Baz',
    mat_fixative: 'Kimyasal Sabitleyici ve Bağlayıcı',
    mat_aromachemical: 'Modern Aromakimyasal Molekül',
    mat_natural_essential: 'Saf Uçucu Yağ / Ekstrakt',
    mat_natural_resin: 'Doğal Reçine ve Değerli Öd',
    place_top: 'Üst Nota (Açılış)',
    place_heart: 'Kalp Notası (Orta Buket)',
    place_base: 'Dip Nota (Derin Sabitleyici)',
    place_carrier: 'Taşıyıcı Çözücü ve Baz',
    place_all: 'Evrensel / Tüm Katmanlar',
  },
  fa: {
    news_trends: 'روندها و تحلیل‌های جهانی',
    news_exhibitions: 'نمایشگاه‌ها و سالن‌های بین‌المللی',
    news_harvests: 'برداشت و بازده گیاهی',
    news_ifra: 'مقررات و ایمنی IFRA',
    news_niche: 'عطرسازی عالی و خانه‌های نیچ',
    mat_solvent: 'حلال و پایه حامل',
    mat_fixative: 'تثبیت‌کننده و چسباننده شیمیایی',
    mat_aromachemical: 'مولکول عطری مدرن',
    mat_natural_essential: 'اسانس / عصاره خالص',
    mat_natural_resin: 'رزین طبیعی و عود گران‌بها',
    place_top: 'نُت آغازین (سر)',
    place_heart: 'نُت میانی (قلب)',
    place_base: 'نُت پایه (تثبیت عمیق)',
    place_carrier: 'حلال حامل و پایه',
    place_all: 'همگانی / همه سطوح',
  },
};

/**
 * The base pack merged over every wave, so a wave can add a language (or fill a
 * single label) while the base keeps its precedence for the languages it owns.
 */
export const CONTENT_LABELS_ALL: ContentLabelPack = Object.assign(
  {},
  ...CONTENT_LABELS_EXTS,
  CONTENT_LABELS,
);

/** Resolve a content label, degrading language → English → Arabic source. */
export const contentLabel = (key: ContentLabelKey, lang: SupportedLanguage): string =>
  CONTENT_LABELS_ALL[lang]?.[key] || CONTENT_LABELS.en?.[key] || CONTENT_LABELS.ar?.[key] || key;

/**
 * Map the raw data values used by the datasets onto content-label keys, so a new
 * category value can never silently fall back to the Arabic source text.
 */
export const CONTENT_LABEL_KEYS = {
  news: {
    trends: 'news_trends',
    exhibitions: 'news_exhibitions',
    harvests: 'news_harvests',
    ifra: 'news_ifra',
    niche: 'news_niche',
  },
  material: {
    solvent: 'mat_solvent',
    fixative: 'mat_fixative',
    aromachemical: 'mat_aromachemical',
    natural_essential: 'mat_natural_essential',
    natural_resin: 'mat_natural_resin',
  },
  placement: {
    top: 'place_top',
    heart: 'place_heart',
    base: 'place_base',
    carrier: 'place_carrier',
    all: 'place_all',
  },
} as const satisfies Record<string, Record<string, ContentLabelKey>>;
