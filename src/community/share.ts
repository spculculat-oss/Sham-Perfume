/**
 * «شارك في المجتمع» — any section of the site hands what a visitor made or asked (a formula, a calculator result, a
 * question to Shaheen…) to «مجتمع شام» as a post, a discussion or a story (يومية).
 *
 * Tiny and pure on purpose (loaded with the main page): the draft waits in this tab's sessionStorage while the
 * community bundle opens on `#community/share` (SharePage.tsx), where the member sees it, edits it and chooses where
 * it goes. Nothing is sent before the member presses «انشر»; nothing personal is added — only what the section shows.
 */
import type { FormulationState, PyramidNote } from '../types/perfume';
import type { SupportedLanguage } from '../types/i18n';
import { pickArEn } from '../لغات/localize';

export type ShareKind = 'creation' | 'question';
export type ShareDestination = 'post' | 'discussion' | 'story';

/** A recipe card the community can open in the calculator again («استخدم التركيبة دي», community/sync.ts). */
export interface ShareRecipe { title: string; data: Record<string, unknown> }

export interface ShareDraft {
  /** The section (the site's tab id) it comes from. */
  source: string;
  kind: ShareKind;
  title: string;
  body: string;
  recipe?: ShareRecipe;
  /** Where the section is on the site (filled when the visitor presses the button). */
  link?: string;
}

export const SHARE_ROUTE = 'community/share';
export const SHARE_KEY = 'sham_share_draft_v1';
export const SHARE_LIMITS = { title: 140, body: 4000, story: 280, threadTitle: 160 } as const;
/** The salon's categories (server/community/hub.ts THREAD_CATEGORIES). */
export const SHARE_THREAD_CATEGORIES = ['maceration', 'materials', 'cafe', 'review', 'sourcing'] as const;
export type ShareThreadCategory = typeof SHARE_THREAD_CATEGORIES[number];

/** The sections a visitor can share from, by tab id (Arabic / English; other languages read English). */
export const SHARE_SECTIONS: Record<string, { ar: string; en: string }> = {
  concentration: { ar: 'حاسبة التركيب', en: 'Compounding calculator' },
  pyramid: { ar: 'الهرم العطري', en: 'Fragrance pyramid' },
  alcohol: { ar: 'حاسبة تخفيف الكحول', en: 'Alcohol dilution calculator' },
  costing: { ar: 'حاسبة التكاليف والأرباح', en: 'Cost & profit calculator' },
  maceration_simulator: { ar: 'محاكي التعتيق', en: 'Maceration simulator' },
  molecule_studio: { ar: 'استوديو الجزيئات', en: 'Molecule studio' },
  raw_materials: { ar: 'موسوعة الخامات', en: 'Raw materials encyclopedia' },
  guide: { ar: 'دليل التعتيق والمثبتات', en: 'Aging & fixatives guide' },
  world_perfumes: { ar: 'العطور العالمية', en: 'World perfumes' },
  perfume_news: { ar: 'أخبار العطور', en: 'Perfume news' },
  library: { ar: 'مكتبة التركيبات', en: 'Formula library' },
  studio: { ar: 'استوديو المشاريع', en: 'Project studio' },
  cosmetics: { ar: 'مصمم التركيبات (التجميل)', en: 'Cosmetics formulator' },
  perfume_designers: { ar: 'قسم مصممي العطور', en: 'Perfume designers' },
  cosmetic_designers: { ar: 'قسم مصممي التجميل', en: 'Cosmetics designers' },
  master_ai: { ar: 'خبير المعمل شاهين', en: 'Shaheen, the lab expert' },
  chat: { ar: 'محادثة شاهين', en: 'Chat with Shaheen' },
  store: { ar: 'متجر شام', en: 'Sham store' },
  productDetail: { ar: 'متجر شام', en: 'Sham store' },
};

export const sectionName = (source: string, lang: SupportedLanguage): string => {
  const s = SHARE_SECTIONS[source];
  return s ? pickArEn(lang, s.ar, s.en) : pickArEn(lang, 'شام', 'Sham');
};

/** Where a draft goes unless the member picks otherwise: a question → the discussion salon, the rest → a post. */
export const defaultDestination = (d: Pick<ShareDraft, 'kind'>): ShareDestination => (d.kind === 'question' ? 'discussion' : 'post');

/** The salon's shelf for a section. */
export function threadCategory(source: string): ShareThreadCategory {
  if (source === 'maceration_simulator' || source === 'guide') return 'maceration';
  if (source === 'raw_materials' || source === 'molecule_studio' || source === 'cosmetics') return 'materials';
  if (source === 'costing' || source === 'store' || source === 'productDetail') return 'sourcing';
  if (source === 'world_perfumes' || source === 'perfume_news') return 'review';
  return 'cafe';
}

// ── Cleaning (the draft comes back from storage: only known fields with sane sizes pass) ─────────────────────────
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\u0000/g, '').trim().slice(0, max) : '');
const SOURCE = /^[a-z_]{2,40}$/;

export function cleanDraft(raw: unknown): ShareDraft | null {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const source = typeof d.source === 'string' && SOURCE.test(d.source) ? d.source : '';
  if (!source) return null;
  const kind: ShareKind = d.kind === 'question' ? 'question' : 'creation';
  const title = str(d.title, SHARE_LIMITS.title);
  const body = str(d.body, SHARE_LIMITS.body);
  const r = (d.recipe && typeof d.recipe === 'object' ? d.recipe : null) as Record<string, unknown> | null;
  const recipeData = r && r.data && typeof r.data === 'object' && !Array.isArray(r.data) ? r.data as Record<string, unknown> : null;
  const recipe = recipeData && JSON.stringify(recipeData).length <= 50_000
    ? { title: str(r!.title, SHARE_LIMITS.title) || title || 'Sham', data: recipeData } : undefined;
  const link = typeof d.link === 'string' && /^https?:\/\/[^\s]{3,300}$/.test(d.link) ? d.link : undefined;
  if (!title && !body && !recipe && kind !== 'question') return null;
  return { source, kind, title, body, ...(recipe ? { recipe } : {}), ...(link ? { link } : {}) };
}

// ── Storage + navigation ──────────────────────────────────────────────────────────────────────────────────────
export function readShareDraft(): ShareDraft | null {
  try { const raw = sessionStorage.getItem(SHARE_KEY); return raw ? cleanDraft(JSON.parse(raw)) : null; } catch { return null; }
}
export function clearShareDraft() {
  try { sessionStorage.removeItem(SHARE_KEY); } catch { /* storage blocked */ }
}

/** Keeps the draft and opens the community's share page. False when there is nothing to share. */
export function startShare(draft: ShareDraft, navigate?: (tab: string) => void): boolean {
  const link = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}#${draft.source}` : undefined;
  const clean = cleanDraft({ ...draft, link: draft.link || link });
  if (!clean) return false;
  try { sessionStorage.setItem(SHARE_KEY, JSON.stringify(clean)); } catch { return false; }
  if (navigate) navigate(SHARE_ROUTE);
  else window.location.hash = SHARE_ROUTE;
  return true;
}

// ── What a section shares when it has nothing richer to say ───────────────────────────────────────────────────
/** «اسأل المجتمع» from any section: the member writes the question on the share page. */
export const questionDraft = (source: string, lang: SupportedLanguage): ShareDraft => ({
  source, kind: 'question', title: pickArEn(lang, `سؤال عن «${sectionName(source, lang)}»`, `A question about “${sectionName(source, lang)}”`), body: '',
});

/** Shaheen's answer, with the question that led to it. */
export function chatDraft(question: string, answer: string, lang: SupportedLanguage, recipe?: ShareRecipe): ShareDraft {
  const q = question.trim();
  const qLabel = pickArEn(lang, 'السؤال', 'Question');
  const aLabel = pickArEn(lang, 'إجابة شاهين', 'Shaheen’s answer');
  return {
    source: 'chat', kind: 'question',
    title: (q || pickArEn(lang, 'سؤال لشاهين', 'A question to Shaheen')).replace(/\s+/g, ' ').slice(0, 120),
    body: `${q ? `${qLabel}: ${q}\n\n` : ''}${aLabel}:\n${answer.trim()}`.slice(0, SHARE_LIMITS.body),
    ...(recipe ? { recipe } : {}),
  };
}

const n2 = (x: number | undefined, lang: SupportedLanguage) =>
  typeof x === 'number' && Number.isFinite(x) ? x.toLocaleString(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', { maximumFractionDigits: 2 }) : '—';

export interface FormulaShareInput {
  title?: string;
  formulation: Partial<FormulationState>;
  pyramidNotes: PyramidNote[];
  macerationDays?: number;
  notes?: string;
  result?: { oilWeightGrams?: number; alcoholWeightGrams?: number; waterWeightGrams?: number; fixativeWeightGrams?: number; totalWeightGrams?: number };
}

/** A perfume formula (calculator, pyramid, molecule studio…): readable text plus the recipe card. */
export function formulaDraft(source: string, f: FormulaShareInput, lang: SupportedLanguage): ShareDraft {
  const t = (ar: string, en: string) => pickArEn(lang, ar, en);
  const title = (f.title || '').trim() || t('تركيبتي من شام', 'My formula from Sham');
  const fm = f.formulation;
  const lines: string[] = [];
  if (fm.bottleVolumeMl) lines.push(`${t('حجم الزجاجة', 'Bottle')}: ${n2(fm.bottleVolumeMl, lang)} ${t('مل', 'ml')}${fm.batchCount && fm.batchCount > 1 ? ` × ${n2(fm.batchCount, lang)}` : ''}`);
  if (fm.concentrationPercent !== undefined) lines.push(`${t('تركيز الزيت', 'Oil concentration')}: ${n2(fm.concentrationPercent, lang)}%${fm.concentrationType && fm.concentrationType !== 'custom' ? ` (${fm.concentrationType.toUpperCase()})` : ''}`);
  if (fm.alcoholPercentage !== undefined) lines.push(`${t('نقاء الكحول', 'Alcohol purity')}: ${n2(fm.alcoholPercentage, lang)}%`);
  if (fm.fixativePercent) lines.push(`${t('المثبت', 'Fixative')}: ${n2(fm.fixativePercent, lang)}%`);
  if (fm.waterPercent) lines.push(`${t('الماء', 'Water')}: ${n2(fm.waterPercent, lang)}%`);
  const r = f.result;
  if (r && (r.oilWeightGrams || r.alcoholWeightGrams)) {
    lines.push(`${t('الأوزان', 'Weights')}: ${t('زيت', 'oil')} ${n2(r.oilWeightGrams, lang)} ${t('جم', 'g')} · ${t('كحول', 'alcohol')} ${n2(r.alcoholWeightGrams, lang)} ${t('جم', 'g')}${r.waterWeightGrams ? ` · ${t('ماء', 'water')} ${n2(r.waterWeightGrams, lang)} ${t('جم', 'g')}` : ''}${r.fixativeWeightGrams ? ` · ${t('مثبت', 'fixative')} ${n2(r.fixativeWeightGrams, lang)} ${t('جم', 'g')}` : ''}`);
  }
  const layer = (c: PyramidNote['category'], label: string) => {
    const notes = f.pyramidNotes.filter((x) => x.category === c);
    if (notes.length) lines.push(`${label}: ${notes.map((x) => `${lang === 'ar' ? x.nameAr || x.nameEn : x.nameEn || x.nameAr} ${n2(x.percentageOfOil, lang)}%`).join(lang === 'ar' ? '، ' : ', ')}`);
  };
  layer('top', t('القمة', 'Top'));
  layer('heart', t('القلب', 'Heart'));
  layer('base', t('القاعدة', 'Base'));
  if (f.macerationDays) lines.push(`${t('التعتيق', 'Maceration')}: ${n2(f.macerationDays, lang)} ${t('يوم', 'days')}`);
  if (f.notes?.trim()) lines.push('', f.notes.trim());
  const data: Record<string, unknown> = {
    formulation: f.formulation,
    pyramidNotes: f.pyramidNotes.slice(0, 60).map(({ nameAr, nameEn, category, percentageOfOil }) => ({ nameAr, nameEn, category, percentageOfOil })),
    ...(f.macerationDays ? { macerationDays: f.macerationDays } : {}),
    ...(f.notes ? { notes: f.notes.slice(0, 2000) } : {}),
  };
  return { source, kind: 'creation', title: title.slice(0, SHARE_LIMITS.title), body: lines.join('\n').slice(0, SHARE_LIMITS.body), recipe: { title: title.slice(0, SHARE_LIMITS.title), data } };
}

// ── What each destination receives ────────────────────────────────────────────────────────────────────────────
const signature = (d: ShareDraft, lang: SupportedLanguage) =>
  `— ${pickArEn(lang, 'من', 'From')} «${sectionName(d.source, lang)}» ${pickArEn(lang, 'في شام', 'on Sham')}${d.link ? `\n${d.link}` : ''}`;

/** A post: the title, the text, and where it was made. */
export function postText(d: ShareDraft, lang: SupportedLanguage): string {
  const head = d.title && !d.body.startsWith(d.title) ? `${d.title}\n\n` : '';
  return `${head}${d.body}${d.body || head ? '\n\n' : ''}${signature(d, lang)}`.slice(0, 5000);
}

/** A story (يومية, 24 hours): short. */
export function storyCaption(d: ShareDraft, lang: SupportedLanguage): string {
  const base = d.title || d.body.split('\n')[0] || sectionName(d.source, lang);
  const tail = ` — ${sectionName(d.source, lang)}`;
  return `${base.slice(0, SHARE_LIMITS.story - tail.length)}${tail}`;
}

/** A discussion: a title of at least 5 letters (the server's rule) and the text. */
export function threadDraft(d: ShareDraft, lang: SupportedLanguage): { title: string; body: string; category: ShareThreadCategory; tags: string[] } {
  let title = (d.title || d.body.split('\n')[0] || '').replace(/\s+/g, ' ').trim();
  if (title.length < 5) title = pickArEn(lang, `سؤال عن «${sectionName(d.source, lang)}»`, `A question about “${sectionName(d.source, lang)}”`);
  return { title: title.slice(0, SHARE_LIMITS.threadTitle), body: `${d.body}${d.body ? '\n\n' : ''}${signature(d, lang)}`.slice(0, 6000), category: threadCategory(d.source), tags: [d.source.replace(/_/g, '-')] };
}

// ── Sections with their own state tell the share bar what they have (CosmeticsHub, the alcohol calculator…) ──
type Provider = () => ShareDraft | null;
const providers = new Map<string, Provider>();
const listeners = new Set<() => void>();

/** A section registers what it would share now; returns the cleanup. */
export function registerShareable(source: string, provider: Provider): () => void {
  providers.set(source, provider);
  listeners.forEach((l) => l());
  return () => { if (providers.get(source) === provider) { providers.delete(source); listeners.forEach((l) => l()); } };
}
export const shareableFor = (source: string): ShareDraft | null => { try { return providers.get(source)?.() ?? null; } catch { return null; } };
export const hasShareable = (source: string) => providers.has(source);
export function onShareablesChange(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; }
