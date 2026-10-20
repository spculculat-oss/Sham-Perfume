import type { SupportedLanguage } from '../types/i18n';
import { uiLabel, type UiTextKey } from '../لغات/uiTextL10n';

const CATEGORY_KEYS: Readonly<Record<string, UiTextKey>> = {
  'عطور': 'cat_perfumes',
  'ع스토랑': 'cat_perfumes', // legacy typo from the old merchant product form
  'خامات': 'cat_materials',
  'أدوات': 'cat_tools',
  'تغليف': 'cat_packaging',
  'غير ذلك': 'cat_other',
};

const UNIT_KEYS: Readonly<Record<string, UiTextKey>> = {
  'زجاجة': 'u_bottle',
  'زجةقة': 'u_bottle', // legacy typo; display and normalize it as a bottle
  'لتر': 'u_liter',
  'جرام': 'u_gram',
  'مجموعة': 'u_set',
  'قطعة': 'u_piece',
};

export function normalizeMerchantCategory(category: string): string {
  return category === 'ع스토랑' ? 'عطور' : category;
}

export function normalizeMerchantUnit(unit: string): string {
  return unit === 'زجةقة' ? 'زجاجة' : unit;
}

export function merchantCategoryLabel(category: string, lang: SupportedLanguage): string {
  const normalized = normalizeMerchantCategory(category);
  const key = CATEGORY_KEYS[normalized];
  return key ? uiLabel(key, lang) : category;
}

export function merchantUnitLabel(unit: string, lang: SupportedLanguage): string {
  const key = UNIT_KEYS[unit];
  return key ? uiLabel(key, lang) : unit;
}
