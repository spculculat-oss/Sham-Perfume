/**
 * Keys of the products-promo banner (TopPromoHub) — the banner at the top of
 * the home page that showcases store perfumes. Every supported language
 * carries all 21 strings (bannerL10nData1–5), aligned as rows in this order.
 */
export const BANNER_KEYS = [
  'promo_title',
  'campaign_kicker',
  'campaign_headline',
  'campaign_sub',
  'campaign_alt',
  'featured_label',
  'featured_note',
  'product_copy',
  'price_label',
  'view_store',
  'compact_eyebrow',
  'compact_cta',
  'previous',
  'next',
  'show_product',
  'collapse',
  'expand',
  'no_image',
  'curated',
  'cat_sets',
  'cat_perfumes',
] as const;

export type BannerTextKey = (typeof BANNER_KEYS)[number];

/** One language's banner strings, aligned to BANNER_KEYS (21 entries). */
export type BannerRow = readonly [
  string, string, string, string, string, // promo_title … campaign_alt
  string, string, string, string, //         featured_label … price_label
  string, string, string, string, //         view_store … previous
  string, string, string, string, //         next … expand
  string, string, string, string, //         no_image … cat_perfumes
];
