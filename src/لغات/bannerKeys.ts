/**
 * Keys of the products-promo banner (TopPromoHub) — the cinematic showcase at
 * the top of the home page: scene copy, product box, country/currency picker
 * and carousel controls. Every supported language carries all 46 strings
 * (bannerL10nData1–5), aligned as rows in this order. `{count}` in
 * matching_count / search_products_placeholder is filled by the resolver.
 */
export const BANNER_KEYS = [
  'screen_badge',
  'screen_title',
  'live_commercial',
  'product_box_title',
  'add_to_cart',
  'added',
  'shop_now',
  'auto_detected',
  'change_country',
  'choose_country',
  'search_country',
  'price_label',
  'prev_scene',
  'next_scene',
  'pause_reel',
  'play_reel',
  'collapse_screen',
  'expand_screen',
  'in_stock',
  'out_of_stock',
  'sold_out',
  'loading_products',
  'matching_count',
  'newest_first',
  'search_products_label',
  'search_products_placeholder',
  'clear_search',
  'category_label',
  'load_failed',
  'no_matches',
  'show_all',
  'prev_product',
  'next_product',
  'brand_house',
  'scene_man_tag',
  'scene_man_title',
  'scene_man_subtitle',
  'scene_man_mood',
  'scene_woman_tag',
  'scene_woman_title',
  'scene_woman_subtitle',
  'scene_woman_mood',
  'scene_mist_tag',
  'scene_mist_title',
  'scene_mist_subtitle',
  'scene_mist_mood',
] as const;

export type BannerTextKey = (typeof BANNER_KEYS)[number];

/** One language's banner strings, aligned to BANNER_KEYS (46 entries). */
export type BannerRow = readonly string[];
