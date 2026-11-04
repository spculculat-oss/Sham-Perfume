/**
 * «اختبار ذوقك» — five friendly questions, the way Facebook learns most: by asking people what they like.
 * What a visitor says about himself (declared taste) is the most accurate and the most lawful data there is: he
 * gives it knowingly, for a result he sees at once (picks for his taste). His answers stay on HIS device
 * (localStorage) to sort the store for him; they reach «خزنة فهم الزوار» only if he accepted «التحليل».
 *
 * Also «الأنسب لذوقك»: the store sorted for one visitor (his answers + what he viewed), like a personal feed.
 * Pure (no React); the storage helpers are guarded for the server.
 */
import { FAMILY_LABEL, GENDER_LABEL, type Family, type Gender, type Occasion, type Season, type StoreProduct } from './storeCatalog';

type Text = { ar: string; en: string };
export type QuizKind = 'gender' | 'family' | 'occasion' | 'season' | 'price';
export interface QuizOption { id: string; label: Text; emoji: string; families?: Family[] }
export interface QuizQuestion { kind: QuizKind; title: Text; hint?: Text; multi?: boolean; options: QuizOption[] }

export const QUIZ: QuizQuestion[] = [
  {
    kind: 'gender', title: { ar: 'العطر ده لمين؟', en: 'Who is the perfume for?' },
    options: [
      { id: 'men', emoji: '🧔', label: { ar: 'ليا — رجالي', en: 'Me — men' } },
      { id: 'women', emoji: '👩', label: { ar: 'ليا — نسائي', en: 'Me — women' } },
      { id: 'unisex', emoji: '🤝', label: { ar: 'مش فارقة — للجنسين', en: 'Either — unisex' } },
    ],
  },
  {
    kind: 'family', multi: true, title: { ar: 'إيه الروايح اللي بتشدك؟', en: 'Which scents draw you in?' }, hint: { ar: 'اختار واحدة أو أكتر', en: 'Pick one or more' },
    options: [
      { id: 'oud', emoji: '🪵', label: { ar: 'عود ودخون', en: 'Oud and incense' }, families: ['oud', 'oriental'] },
      { id: 'fresh', emoji: '🍋', label: { ar: 'منعش وحمضي', en: 'Fresh and citrus' }, families: ['fresh', 'citrus', 'aquatic'] },
      { id: 'floral', emoji: '🌹', label: { ar: 'ورد وزهور', en: 'Roses and flowers' }, families: ['floral', 'powdery'] },
      { id: 'sweet', emoji: '🍯', label: { ar: 'حلو ودافي (فانيليا، عنبر)', en: 'Sweet and warm (vanilla, amber)' }, families: ['gourmand', 'amber'] },
      { id: 'woody', emoji: '🌲', label: { ar: 'خشبي وجلدي', en: 'Woody and leathery' }, families: ['woody', 'leather'] },
      { id: 'musk', emoji: '🤍', label: { ar: 'مسك ناعم', en: 'Soft musk' }, families: ['musk'] },
      { id: 'spicy', emoji: '🌶️', label: { ar: 'توابل وبهارات', en: 'Spicy' }, families: ['spicy'] },
    ],
  },
  {
    kind: 'occasion', title: { ar: 'هتلبسه إمتى أكتر؟', en: 'When will you wear it most?' },
    options: [
      { id: 'daily', emoji: '☀️', label: { ar: 'كل يوم', en: 'Every day' } },
      { id: 'work', emoji: '💼', label: { ar: 'الشغل', en: 'Work' } },
      { id: 'evening', emoji: '🌙', label: { ar: 'السهرات', en: 'Evenings' } },
      { id: 'special', emoji: '🎉', label: { ar: 'المناسبات', en: 'Special occasions' } },
      { id: 'gift', emoji: '🎁', label: { ar: 'هدية لحد', en: 'A gift' } },
    ],
  },
  {
    kind: 'season', title: { ar: 'الجو عندك عامل إزاي؟', en: 'What is your weather like?' },
    options: [
      { id: 'summer', emoji: '🔥', label: { ar: 'حر أغلب السنة', en: 'Hot most of the year' } },
      { id: 'winter', emoji: '❄️', label: { ar: 'برد', en: 'Cold' } },
      { id: 'all', emoji: '🌤️', label: { ar: 'معتدل / متغير', en: 'Mild / changing' } },
    ],
  },
  {
    kind: 'price', title: { ar: 'تحب تكون في أنهي حدود سعر؟', en: 'Which price range suits you?' },
    options: [
      { id: 'budget', emoji: '👍', label: { ar: 'اقتصادي', en: 'Budget' } },
      { id: 'mid', emoji: '⭐', label: { ar: 'متوسط', en: 'Mid-range' } },
      { id: 'premium', emoji: '💎', label: { ar: 'فاخر', en: 'Premium' } },
      { id: 'any', emoji: '🤷', label: { ar: 'مش فارقة', en: 'No preference' } },
    ],
  },
];

export const QUIZ_UI = {
  open: { ar: 'اكتشف ذوقك في 5 أسئلة', en: 'Discover your taste in 5 questions' },
  openHint: { ar: 'وشاهين يرتبلك المتجر على ذوقك — أقل من دقيقة.', en: 'and Shaheen sorts the store for your taste — under a minute.' },
  chip: { ar: 'اختبار ذوقك', en: 'Taste quiz' },
  next: { ar: 'التالي', en: 'Next' },
  back: { ar: 'رجوع', en: 'Back' },
  skip: { ar: 'تخطي', en: 'Skip' },
  done: { ar: 'شوف النتيجة', en: 'See my picks' },
  resultTitle: { ar: 'ذوقك', en: 'Your taste' },
  resultPicks: { ar: 'مختار ليك على ذوقك', en: 'Picked for your taste' },
  retake: { ar: 'أعيد الاختبار', en: 'Retake' },
  close: { ar: 'إغلاق', en: 'Close' },
  saved: { ar: 'إجاباتك محفوظة على جهازك بس، علشان المتجر يترتب على ذوقك.', en: 'Your answers stay on your device only, to sort the store for you.' },
  sortTaste: { ar: 'الأنسب لذوقك', en: 'Best for your taste' },
  step: { ar: 'سؤال {n} من {total}', en: 'Question {n} of {total}' },
  empty: { ar: 'مالقيناش منتجات مطابقة بالظبط — جرّب تختار روايح أكتر.', en: 'No exact matches — try picking more scents.' },
} as const;

export type QuizAnswers = Partial<Record<QuizKind, string[]>>;
export interface TasteProfile { families: Partial<Record<Family, number>>; gender?: Gender; occasion?: Occasion; season?: Season; price?: 'budget' | 'mid' | 'premium' }

/** The answers as a taste: the families he picked (and their neighbours), his gender, occasion, season and price. */
export function tasteFromAnswers(a: QuizAnswers): TasteProfile {
  const families: Partial<Record<Family, number>> = {};
  for (const id of a.family || []) {
    const option = QUIZ[1].options.find((o) => o.id === id);
    option?.families?.forEach((f, i) => { families[f] = Math.max(families[f] || 0, i === 0 ? 3 : 2); });
  }
  const one = <T extends string>(k: QuizKind, allowed: readonly string[]) => { const v = a[k]?.[0]; return v && allowed.includes(v) ? v as T : undefined; };
  return {
    families,
    ...(one<Gender>('gender', ['men', 'women', 'unisex']) ? { gender: one<Gender>('gender', ['men', 'women', 'unisex']) } : {}),
    ...(one<Occasion>('occasion', ['daily', 'work', 'evening', 'special', 'gift']) ? { occasion: one<Occasion>('occasion', ['daily', 'work', 'evening', 'special', 'gift']) } : {}),
    ...(one<Season>('season', ['summer', 'winter', 'all']) ? { season: one<Season>('season', ['summer', 'winter', 'all']) } : {}),
    ...(one<'budget' | 'mid' | 'premium'>('price', ['budget', 'mid', 'premium']) ? { price: one<'budget' | 'mid' | 'premium'>('price', ['budget', 'mid', 'premium']) } : {}),
  };
}

/** What he viewed adds to the taste (lighter than what he said). */
export function withViewed(t: TasteProfile, viewed: StoreProduct[]): TasteProfile {
  const families = { ...t.families };
  viewed.forEach((p, i) => p.families.forEach((f) => { families[f] = (families[f] || 0) + (i < 3 ? 1 : 0.5); }));
  return { ...t, families };
}

export const hasTaste = (t: TasteProfile | undefined) => Boolean(t && (Object.keys(t.families).length || t.gender || t.occasion || t.season || t.price));

/** How well one product fits a taste (0 = not at all). */
export function tasteScore(p: StoreProduct, t: TasteProfile, yardstick: { low: number; high: number }): number {
  let score = 0;
  p.families.forEach((f, i) => { score += (t.families[f] || 0) * (i === 0 ? 1.5 : 1); });
  if (t.gender) {
    if (p.gender === t.gender) score += 3;
    else if (p.gender === 'unisex' || t.gender === 'unisex') score += 1.5;
    else score -= 6;
  }
  if (t.occasion && p.occasions.includes(t.occasion)) score += 1.5;
  if (t.season) {
    if (p.seasons.includes(t.season) || p.seasons.includes('all')) score += 1;
    else if (t.season === 'summer' && p.seasons.includes('winter') && !p.seasons.includes('summer')) score -= 1;
  }
  if (t.price && p.price > 0) {
    const band = p.price <= yardstick.low ? 'budget' : p.price >= yardstick.high ? 'premium' : 'mid';
    score += band === t.price ? 2 : (band === 'mid' || t.price === 'mid') ? 0 : -2;
  }
  if (p.inStock === false) score -= 4;
  return score;
}

/** The store sorted for him: best fit first; the order of equal products is kept (stable). */
export function rankForTaste<T extends StoreProduct>(products: T[], t: TasteProfile, yardstick: { low: number; high: number }): T[] {
  return products.map((p, i) => ({ p, i, s: tasteScore(p, t, yardstick) })).sort((a, b) => b.s - a.s || a.i - b.i).map((x) => x.p);
}

/** A short line describing the taste («عود · منعش — رجالي — سهرات»). */
export function tasteLine(t: TasteProfile, say: (text: Text) => string): string {
  const fams = (Object.entries(t.families) as [Family, number][]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([f]) => (FAMILY_LABEL[f] ? say(FAMILY_LABEL[f]) : f));
  const pick = (k: QuizKind, id?: string) => { const o = id ? QUIZ.find((q) => q.kind === k)?.options.find((x) => x.id === id) : undefined; return o ? say(o.label) : undefined; };
  return [fams.join(' · '), t.gender ? say(GENDER_LABEL[t.gender]) : undefined, pick('occasion', t.occasion), pick('season', t.season)].filter(Boolean).join(' — ');
}

// ── On his device ───────────────────────────────────────────────────────────────────────────────────────────────
const KEY = 'sham_taste_quiz_v1';
export function savedAnswers(): QuizAnswers | undefined {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null') as unknown;
    if (!raw || typeof raw !== 'object') return undefined;
    const out: QuizAnswers = {};
    for (const q of QUIZ) {
      const v = (raw as Record<string, unknown>)[q.kind];
      if (Array.isArray(v)) out[q.kind] = v.filter((x): x is string => typeof x === 'string' && q.options.some((o) => o.id === x)).slice(0, 7);
    }
    return out;
  } catch { return undefined; }
}
export function saveAnswers(a: QuizAnswers) {
  try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* private mode */ }
  try { window.dispatchEvent(new CustomEvent('sham-taste-updated')); } catch { /* server */ }
}
