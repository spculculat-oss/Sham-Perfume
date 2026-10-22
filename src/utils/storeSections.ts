/**
 * The store's two sections: «العطور» and «مستحضرات التجميل». A product belongs to cosmetics when its category says so
 * (the merchant's category, in Arabic or English); everything else is a perfume. Names are never used: a perfume
 * called «Vanilla Cream» stays a perfume. Pricing is the same for both (product + 50 % + shipping per country).
 */
export type StoreSection = 'perfumes' | 'cosmetics';
export const STORE_SECTIONS: StoreSection[] = ['perfumes', 'cosmetics'];

const COSMETIC_CATEGORY = /cosmetic|skin ?care|body ?care|hair ?care|make-?up|cream|lotion|serum|balm|shampoo|conditioner|soap|cleanser|مستحضر|تجميل|عناي[ةه]|بشر[ةه]|كريم|لوشن|سيروم|مرطب|شامبو|بلسم|صابون|غسول|مكياج|ميكب/i;

export function productSection(p: { category?: string }): StoreSection {
  return COSMETIC_CATEGORY.test(p.category || '') ? 'cosmetics' : 'perfumes';
}

/** The section a store link asks for: `#store?section=cosmetics`. */
export function sectionFromHash(hash: string): StoreSection | 'all' {
  const m = hash.match(/[?&]section=(perfumes|cosmetics)\b/);
  return m ? (m[1] as StoreSection) : 'all';
}
