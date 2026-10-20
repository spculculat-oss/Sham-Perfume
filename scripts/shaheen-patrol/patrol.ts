/**
 * «الدورية بالتناوب» — one monitoring shift runs hourly; each role's recorded status is reviewed every 3 hours,
 * so only one group of probes runs at a time (GitHub Actions: shaheen-patrol.yml).
 *
 *   1. Role monitoring: available report age, last run and supervisor scores (the same rules as the pre-meeting
 *      check), plus hands-on probes of the selected scope (prices, currencies, live pages, photos, news…).
 *      Roles without a workflow are not invoked; they are monitored only through existing records.
 *   2. What can be fixed safely is fixed: the bot's robot (or the robot owning the broken scope) is started
 *      again, at most once per 6 h per robot and twice per problem.
 *   3. What cannot be fixed that way goes to «الخبير شاهين»: with an AI engine he diagnoses it; without one,
 *      his recorded playbook answers and the item waits for him honestly (never a fake fix). A serious problem
 *      that stays open becomes a development task («shaheen-task» issue) for the coding agent.
 *   4. A problem spanning several tools gets a task force: every tool involved with its own part.
 *   5. When a bot finishes a run, an expert reviewer of the same scope tests the result by hand (bigger
 *      samples) and approves or rejects it; a rejection becomes a fix or an escalation like any problem.
 *
 * Pure logic only (no network, no files): run.mts does the I/O, probes.ts the live tests.
 */
import { BOTS, botOf, type BotId } from '../../src/utils/shaheenOrg';
import { RERUNNABLE } from '../shaheen-council/council';
import type { BotCheck, Handoff, PrecheckFile } from '../shaheen-council/precheck';

// ── Hands-on tests (probes) ──────────────────────────────────────────────────────────────────────────────
export type ProbeId = 'pricing' | 'catalog' | 'currency' | 'fx' | 'l10n' | 'news_file' | 'site' | 'product_pages' | 'images' | 'sitemap' | 'engine' | 'news_api' | 'payments';
export type Level = 'ok' | 'warn' | 'fail' | 'skip';
export interface ProbeResult {
  id: ProbeId;
  level: Level;
  /** Items tested and how many failed. */
  checked: number;
  failed: number;
  noteAr: string;
  /** A few failing examples (SKUs, paths, countries) — never secrets or amounts of orders. */
  samples?: string[];
  /** Only the store owner can fix it (an account, a payment setting) — reported, not escalated. */
  owner?: boolean;
  /** Ran with the expert reviewer's bigger sample. */
  deep?: boolean;
}

export const PROBES: Record<ProbeId, { nameAr: string; nameEn: string; live: boolean }> = {
  pricing: { nameAr: 'تسعير المنتجات (سعر المورد + 50%)', nameEn: 'Product pricing (supplier + 50%)', live: false },
  catalog: { nameAr: 'سلامة بيانات الكتالوج', nameEn: 'Catalogue data integrity', live: false },
  currency: { nameAr: 'عملة كل دولة', nameEn: 'Currency of every country', live: false },
  fx: { nameAr: 'أسعار الصرف', nameEn: 'Exchange rates', live: false },
  l10n: { nameAr: 'نصوص المتجر في كل اللغات', nameEn: 'Store texts in every language', live: false },
  news_file: { nameAr: 'ملف النشرة', nameEn: 'News bulletin file', live: false },
  site: { nameAr: 'الموقع الأساسي يفتح', nameEn: 'Main site opens', live: true },
  product_pages: { nameAr: 'صفحات المنتجات على الموقع', nameEn: 'Product pages on the site', live: true },
  images: { nameAr: 'صور المنتجات تفتح', nameEn: 'Product photos open', live: true },
  sitemap: { nameAr: 'خريطة الموقع لمحركات البحث', nameEn: 'Sitemap for search engines', live: true },
  engine: { nameAr: 'محرك الموقع (الخادم)', nameEn: 'Site engine (server)', live: true },
  news_api: { nameAr: 'النشرة على الموقع الحي', nameEn: 'News on the live site', live: true },
  payments: { nameAr: 'طرق الدفع', nameEn: 'Payment methods', live: true },
};

const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);
const result = (id: ProbeId, checked: number, bad: string[], failAt: (bad: number) => boolean, okAr: string, badAr: (n: number) => string): ProbeResult => ({
  id, checked, failed: bad.length, level: !bad.length ? 'ok' : failAt(bad.length) ? 'fail' : 'warn',
  noteAr: bad.length ? badAr(bad.length) : okAr, ...(bad.length ? { samples: bad.slice(0, 5) } : {}),
});

/** Every product's price = supplier price × 1.5 (the store's rule), never zero. */
export function probePricing(products: { sku?: string; id?: unknown; supplierPrice?: unknown; ourPrice?: unknown }[], markup = 1.5): ProbeResult {
  const bad: string[] = [];
  let checked = 0;
  for (const p of products) {
    const cost = Number(p.supplierPrice); const price = Number(p.ourPrice);
    const sku = String(p.sku || p.id);
    if (!(price > 0)) { bad.push(`${sku}: بدون سعر`); checked++; continue; }
    if (!(cost > 0)) continue;
    checked++;
    if (Math.abs(price / cost - markup) > 0.011) bad.push(`${sku}: ${price} بدل ${Math.round(cost * markup * 100) / 100}`);
  }
  return result('pricing', checked, bad, () => true, `${checked} منتج سعره = سعر المورد + 50%`, (n) => `${n} منتج سعره مخالف لقاعدة +50%`);
}

/** The visible catalogue: unique SKUs and page addresses, a price, both names and a photo. */
export function probeCatalog(visible: { sku: string; slug: string; price: number; name: { ar: string; en: string }; imageUrl?: string }[]): ProbeResult {
  const seen = new Set<string>(); const slugs = new Set<string>();
  const hard: string[] = []; const soft: string[] = [];
  for (const p of visible) {
    if (seen.has(p.sku)) hard.push(`${p.sku}: مكرر`); seen.add(p.sku);
    if (slugs.has(p.slug)) hard.push(`${p.slug}: عنوان صفحة مكرر`); slugs.add(p.slug);
    if (!(p.price > 0)) hard.push(`${p.sku}: معروض بدون سعر`);
    if (!p.name.ar.trim() || !p.name.en.trim()) soft.push(`${p.sku}: اسم ناقص`);
    if (!p.imageUrl) soft.push(`${p.sku}: بدون صورة`);
  }
  const bad = [...hard, ...soft];
  return result('catalog', visible.length, bad, () => hard.length > 0, `${visible.length} منتج معروض بياناته سليمة`, (n) => `${n} ملاحظة في المنتجات المعروضة${hard.length ? ` (${hard.length} خطيرة)` : ''}`);
}

/** The header, the store and the cart show the same currency for every country (#169). */
export function probeCurrency(countries: string[], headerCurrency: (c: string) => string, storeCurrency: (c: string) => string, rates: Record<string, number>): ProbeResult {
  const bad: string[] = [];
  for (const c of countries) {
    const a = headerCurrency(c); const b = storeCurrency(c);
    if (a !== b) bad.push(`${c}: ${a} ≠ ${b}`);
    else if (!(rates[b] > 0) && b !== 'EGP') bad.push(`${c}: مفيش سعر صرف لـ ${b}`);
  }
  return result('currency', countries.length, bad, () => true, `${countries.length} دولة: عملة واحدة في كل مكان`, (n) => `${n} دولة عملتها مش متطابقة`);
}

export function probeFx(fx: { updatedAt?: string; rates?: Record<string, number> } | undefined, now: number): ProbeResult {
  const age = fx?.updatedAt ? (now - Date.parse(fx.updatedAt)) / 3_600_000 : Infinity;
  const count = Object.keys(fx?.rates || {}).length;
  const level: Level = !count || age > 72 ? 'fail' : age > 30 ? 'warn' : 'ok';
  return { id: 'fx', level, checked: count, failed: level === 'ok' ? 0 : 1, noteAr: !count ? 'جدول أسعار الصرف فاضي' : Number.isFinite(age) ? `آخر تحديث من ${Math.round(age)} ساعة (${count} عملة)` : 'جدول الصرف بدون تاريخ' };
}

/** Every visitor language carries all the store's core texts itself. */
export function probeL10n(coverage: Record<string, number>, total: number): ProbeResult {
  const bad = Object.entries(coverage).filter(([, n]) => n < total).map(([lang, n]) => `${lang}: ${n}/${total}`);
  return result('l10n', Object.keys(coverage).length, bad, () => true, `${Object.keys(coverage).length} لغة كاملة النصوص الأساسية`, (n) => `${n} لغة نصوصها الأساسية ناقصة`);
}

export function probeNewsFile(news: { updatedAt?: string; items?: unknown[] } | undefined, now: number): ProbeResult {
  const items = Array.isArray(news?.items) ? news!.items.length : 0;
  const age = news?.updatedAt ? (now - Date.parse(news.updatedAt)) / 3_600_000 : Infinity;
  const level: Level = !items ? 'fail' : age > 30 ? 'warn' : 'ok';
  return { id: 'news_file', level, checked: items, failed: level === 'ok' ? 0 : 1, noteAr: !items ? 'النشرة فاضية' : `${items} خبر، آخر تحديث من ${Number.isFinite(age) ? Math.round(age) : '؟'} ساعة` };
}

// ── Scopes: the expert reviewer of each bot, and the task forces ─────────────────────────────────────────
export interface Reviewer { nameAr: string; nameEn: string; probes: ProbeId[] }
/** «أداة فحص خبير في نفس الاسكوب»: who checks each bot's finished work, and with which hands-on tests. */
export const REVIEWERS: Partial<Record<BotId, Reviewer>> = {
  importer: { nameAr: 'خبير فحص الاستيراد والأسعار', nameEn: 'Import & pricing reviewer', probes: ['pricing', 'catalog', 'fx', 'images', 'product_pages'] },
  images: { nameAr: 'خبير فحص الصور', nameEn: 'Photo reviewer', probes: ['images'] },
  catalog: { nameAr: 'خبير فحص بيانات الكتالوج', nameEn: 'Catalogue data reviewer', probes: ['catalog'] },
  product_pages: { nameAr: 'خبير فحص صفحات المنتجات', nameEn: 'Product pages reviewer', probes: ['product_pages', 'images'] },
  scout: { nameAr: 'خبير فحص المصادر', nameEn: 'Sources reviewer', probes: [] },
  news: { nameAr: 'خبير فحص النشرة', nameEn: 'News reviewer', probes: ['news_file', 'news_api'] },
  secretary: { nameAr: 'خبير فحص تقييم الأدوات', nameEn: 'Tool-scores reviewer', probes: [] },
  seo: { nameAr: 'خبير فحص الظهور في البحث', nameEn: 'Search reviewer', probes: ['sitemap', 'site'] },
  languages: { nameAr: 'خبير فحص اللغات', nameEn: 'Languages reviewer', probes: ['l10n', 'currency'] },
  deploy: { nameAr: 'خبير فحص النشر', nameEn: 'Deploy reviewer', probes: ['site', 'product_pages', 'sitemap'] },
  live_check: { nameAr: 'خبير فحص المحرك', nameEn: 'Engine reviewer', probes: ['engine', 'news_api'] },
  doctor: { nameAr: 'خبير فحص الصيانة', nameEn: 'Maintenance reviewer', probes: ['engine', 'site'] },
  keys: { nameAr: 'خبير فحص المفاتيح', nameEn: 'Keys reviewer', probes: ['engine'] },
  finance: { nameAr: 'خبير فحص الدفع والأسعار', nameEn: 'Payment & pricing reviewer', probes: ['payments', 'pricing', 'currency'] },
  visitor_tour: { nameAr: 'خبير فحص رحلة الشراء', nameEn: 'Purchase journey reviewer', probes: ['currency', 'product_pages', 'site'] },
  design_audit: { nameAr: 'خبير فحص التصميم واللغات', nameEn: 'Design & languages reviewer', probes: ['l10n', 'site'] },
  school: { nameAr: 'خبير فحص المذاكرة', nameEn: 'School reviewer', probes: [] },
  council: { nameAr: 'خبير فحص قرارات الاجتماع', nameEn: 'Meeting decisions reviewer', probes: [] },
  precheck: { nameAr: 'خبير فحص الفحص الشامل', nameEn: 'Full-check reviewer', probes: [] },
  verifier: { nameAr: 'خبير فحص المراجعة الخارجية', nameEn: 'External review checker', probes: [] },
  inspect: { nameAr: 'خبير فحص إجابات شاهين', nameEn: 'Answers reviewer', probes: ['engine'] },
  intake: { nameAr: 'خبير فحص التحديثات', nameEn: 'Updates reviewer', probes: ['site'] },
  studio_bridge: { nameAr: 'خبير فحص بوابة الاستوديو', nameEn: 'Studio bridge reviewer', probes: ['site'] },
  studio_zip: { nameAr: 'خبير فحص الملفات المضغوطة', nameEn: 'Studio download reviewer', probes: ['site'] },
};
export const reviewerOf = (id: BotId): Reviewer => REVIEWERS[id] || { nameAr: `خبير فحص ${botOf(id)?.nameAr || id}`, nameEn: `${botOf(id)?.nameEn || id} reviewer`, probes: [] };

export interface TeamPart { bot: BotId; roleAr: string }
/** «فريق عمل»: a problem in this scope needs these tools together, each on its own part. */
export const TEAMS: Record<ProbeId, TeamPart[]> = {
  pricing: [{ bot: 'importer', roleAr: 'يعيد حساب السعر من سعر المورد' }, { bot: 'finance', roleAr: 'يتأكد إن الفواتير والدفع بنفس السعر' }],
  catalog: [{ bot: 'catalog', roleAr: 'يصحح البيانات' }, { bot: 'importer', roleAr: 'المراجع يخفي المنتج لحد ما يتصلح' }],
  currency: [{ bot: 'importer', roleAr: 'يحدّث جدول الصرف' }, { bot: 'languages', roleAr: 'يتأكد من العملة واللغة لكل دولة' }, { bot: 'visitor_tour', roleAr: 'يجرب رحلة الشراء بالعملة' }],
  fx: [{ bot: 'importer', roleAr: 'يجيب أسعار الصرف الجديدة' }, { bot: 'finance', roleAr: 'يراجع إن الأسعار المعروضة اتحدثت' }],
  l10n: [{ bot: 'languages', roleAr: 'يكمل الترجمة' }, { bot: 'design_audit', roleAr: 'يتأكد من ظهورها صح' }],
  news_file: [{ bot: 'news', roleAr: 'يجمع النشرة من جديد' }, { bot: 'secretary', roleAr: 'يراجع مصادر الأخبار' }],
  site: [{ bot: 'deploy', roleAr: 'يعيد البناء والنشر' }, { bot: 'doctor', roleAr: 'يكشف سبب العطل' }],
  product_pages: [{ bot: 'deploy', roleAr: 'يعيد نشر الصفحات' }, { bot: 'product_pages', roleAr: 'يفحص الصفحة على الموبايل' }, { bot: 'importer', roleAr: 'يخفي المنتج لو الصفحة مكسورة' }],
  images: [{ bot: 'images', roleAr: 'يعيد معالجة الصورة' }, { bot: 'importer', roleAr: 'المراجع يخفي المنتج لحد ما الصورة تتصلح' }, { bot: 'product_pages', roleAr: 'يتأكد إن الصفحة بتعرض صورة بديلة' }],
  sitemap: [{ bot: 'seo', roleAr: 'يعيد كتابة خريطة الموقع' }, { bot: 'deploy', roleAr: 'ينشرها' }],
  engine: [{ bot: 'doctor', roleAr: 'يكشف ويصلح الخادم' }, { bot: 'live_check', roleAr: 'يتأكد إن شاهين بيرد' }, { bot: 'keys', roleAr: 'يراجع مفاتيح المحركات' }],
  news_api: [{ bot: 'news', roleAr: 'يجهز نشرة احتياطية' }, { bot: 'doctor', roleAr: 'يكشف على الخادم' }],
  payments: [{ bot: 'finance', roleAr: 'يراجع إعدادات الدفع' }, { bot: 'keys', roleAr: 'يتأكد من إعدادات الخادم' }],
};

// ── Shifts (scripts/shaheen-patrol/shifts.ts — browser-safe, the admin panel shows them) ─────────────────
export { SHIFTS, SHIFT_HOURS, shiftAt, shiftOfBot, shiftOfProbe, nextShiftAt, type Shift, type ShiftIndex } from './shifts';
import { SHIFTS, shiftAt, shiftOfBot, shiftOfProbe, nextShiftAt, type ShiftIndex } from './shifts';

// ── Safe fixes ───────────────────────────────────────────────────────────────────────────────────────────
/** Robots the patrol may start again: idempotent, no money, no messages to people, no AI credit of note. */
export const PATROL_RERUNNABLE = [...RERUNNABLE, 'shaheen-languages.yml', 'pages.yml', 'product-pages-check.yml', 'live-smoke.yml', 'shaheen-precheck.yml'] as const;
export type PatrolRerunnable = (typeof PATROL_RERUNNABLE)[number];
export const isPatrolRerunnable = (w: unknown): w is PatrolRerunnable => typeof w === 'string' && (PATROL_RERUNNABLE as readonly string[]).includes(w);
/** The robot that repairs a broken scope (none = only Shaheen or the coding agent can). */
export const PROBE_FIX: Partial<Record<ProbeId, PatrolRerunnable>> = {
  fx: 'shaheen-import.yml', images: 'shaheen-import.yml', news_file: 'shaheen-news.yml', news_api: 'shaheen-news.yml',
  site: 'pages.yml', product_pages: 'pages.yml', sitemap: 'shaheen-seo.yml', l10n: 'shaheen-languages.yml', catalog: 'shaheen-news.yml',
};
export const RERUN_GAP_H = 6;
export const MAX_TRIES = 2;
export const MAX_RERUNS_PER_PATROL = 3;
/** Shaheen's questions per shift — the visitors' AI quota comes first. */
export const ASKS_PER_SHIFT = 1;
export const ASK_GAP_H = 24;
/** A serious problem still open after this long (and past Shaheen) becomes a development task. */
export const TASK_AFTER_H = 6;
export const MAX_TASKS_PER_DAY = 2;
export const HEARTBEAT_H = 3;

// ── Shaheen's playbook (his recorded experience — used when no AI engine answers) ────────────────────────
export const PLAYBOOK: Record<string, { diagnosisAr: string; stepsAr: string[]; needsCode: boolean }> = {
  pricing: { diagnosisAr: 'سعر منتج مش ماشي على قاعدة سعر المورد + 50% — غالباً تعديل يدوي أو خطأ في الاستيراد.', stepsAr: ['مراجعة المنتجات المذكورة في ملف المنتجات', 'إعادة الحساب بقاعدة +50%', 'اختبار التسعير'], needsCode: true },
  currency: { diagnosisAr: 'دولة بتظهر بعملة مختلفة في الهيدر عن المتجر أو مالهاش سعر صرف.', stepsAr: ['مطابقة جدول عملات الدول مع محرك التسعير', 'إضافة سعر الصرف الناقص'], needsCode: true },
  catalog: { diagnosisAr: 'منتجات معروضة ببيانات ناقصة أو مكررة.', stepsAr: ['مدرّب الكتالوج يصحح', 'المراجع يخفي المكرر'], needsCode: true },
  engine: { diagnosisAr: 'خادم الموقع مش بيرد — نشر واقف أو إعداد ناقص.', stepsAr: ['طبيب شاهين يكشف', 'إعادة النشر من لوحة الاستضافة لو النسخة قديمة'], needsCode: false },
  payments: { diagnosisAr: 'مفيش طريقة دفع إلكتروني فعالة؛ الطلبات بتوصل بالإيميل.', stepsAr: ['قرار صاحب المتجر: تفعيل الحساب البنكي الداخلي بقاعدة بيانات'], needsCode: false },
  late: { diagnosisAr: 'الروبوت متأخر أو آخر تشغيل فشل.', stepsAr: ['إعادة التشغيل', 'لو فشل تاني: قراءة سجل التشغيل وإصلاح السبب في الكود'], needsCode: true },
  other: { diagnosisAr: 'مشكلة في أرقام الأداة نفسها محتاجة تطوير.', stepsAr: ['تتحول لمهمة تطوير لو استمرت'], needsCode: true },
};

// ── The patrol file ──────────────────────────────────────────────────────────────────────────────────────
export type ItemStatus = 'fixing' | 'waiting_fix' | 'shaheen' | 'waiting_shaheen' | 'task' | 'owner' | 'watch';
export interface ShaheenAnswer { at: string; by: 'ai' | 'playbook'; diagnosisAr: string; stepsAr: string[]; needsCode: boolean; rerun?: PatrolRerunnable }
export interface Item {
  key: string;
  bot: BotId;
  source: 'self' | 'probe';
  /** The shift that checks it (the item waits untouched in the other hours). */
  shift?: ShiftIndex;
  probe?: ProbeId;
  level: 'warn' | 'fail';
  textAr: string;
  owner?: boolean;
  since: string;
  lastSeen: string;
  status: ItemStatus;
  nextAr: string;
  tries: { at: string; workflow: string }[];
  team?: TeamPart[];
  /** Expert reviewers that rejected a run because of this problem. */
  rejectedBy?: BotId[];
  shaheen?: ShaheenAnswer;
  issue?: number;
}
export interface Resolved { key: string; bot: BotId; textAr: string; since: string; resolvedAt: string; howAr: string }
export interface Review {
  bot: BotId;
  reviewerAr: string;
  reviewerEn: string;
  runAt: string;
  verdict: 'approved' | 'rejected';
  tested: { nameAr: string; level: Level; noteAr: string; deep?: boolean }[];
  defects: string[];
}
export interface BotLine { id: BotId; status: BotCheck['status']; problems: number; reviewed?: string }
export interface PatrolFile {
  version: 1;
  updatedAt: string;
  /** When this state was last written to main (publishing happens on change or every HEARTBEAT_H). */
  publishedAt?: string;
  signature: string;
  summaryAr: string;
  health: number;
  bots: BotLine[];
  probes: (ProbeResult & { nameAr?: string; nameEn?: string; at?: string })[];
  open: Item[];
  resolved: Resolved[];
  reviews: Review[];
  /** The last run of each robot the bot reviewer already judged. */
  reviewedRuns: Partial<Record<BotId, string>>;
  reruns: { at: string; workflow: string; key: string }[];
  teams: { key: string; textAr: string; parts: TeamPart[] }[];
  engine: { ready: boolean; noteAr: string };
  /** This hour's shift and when each shift comes round again. */
  shift?: { index: ShiftIndex; nameAr: string; nameEn: string; next: string[] };
}

export const isPatrolFile = (d: unknown): d is PatrolFile => Boolean(d && typeof d === 'object' && (d as PatrolFile).version === 1 && Array.isArray((d as PatrolFile).open) && Array.isArray((d as PatrolFile).reviews));
export const emptyPatrol = (): PatrolFile => ({ version: 1, updatedAt: new Date(0).toISOString(), signature: '', summaryAr: '', health: 0, bots: [], probes: [], open: [], resolved: [], reviews: [], reviewedRuns: {}, reruns: [], teams: [], engine: { ready: false, noteAr: '' } });

/** Stable key of a self-check problem: numbers dropped («متأخر (5 ساعة)» and «(6 ساعة)» are one problem). */
const norm = (s: string) => s.replace(/[\d٠-٩.,%/]+/g, '#').replace(/\s+/g, ' ').trim().slice(0, 80);
export const selfKey = (bot: BotId, problem: string) => `${bot}:${norm(problem)}`;
/** Self-check problems only the store owner can solve (AI credit/keys, the private finance check). */
const OWNER = /محركات متوقفة|مفتاح ذكاء اصطناعي|شحن الرصيد|الفحص المالي|الإدارة المالية/;
const isLate = (t: string) => /متأخر|فشل|اتلغى|خلص وقته|ما كتبش/.test(t);
const hours = (from: string | undefined, now: number) => (from && Date.parse(from) > 0 ? (now - Date.parse(from)) / 3_600_000 : Infinity);

export interface PatrolInput {
  now: number;
  precheck: PrecheckFile;
  probes: ProbeResult[];
  previous?: PatrolFile;
  /** An AI engine can answer for Shaheen this hour. */
  engineReady: boolean;
  /** The shift to monitor (default: this hour's); 'all' = all role records/probes in one manual pass, not all agent invocations. */
  shift?: ShiftIndex | 'all';
}
export interface PatrolPlan {
  file: PatrolFile;
  /** Robots to start now (already recorded in file.reruns). */
  reruns: PatrolRerunnable[];
  /** Items Shaheen should be asked about (AI) this hour. */
  ask: Item[];
  /** Items that should become a development task (issue) now. */
  tasks: Item[];
}

/** Findings of this hour: each bot's own problems (warn/fail) and every failing probe (one per scope). */
export function findings(precheck: PrecheckFile, probes: ProbeResult[], inShift: (id: BotId) => boolean = () => true): Omit<Item, 'since' | 'lastSeen' | 'status' | 'nextAr' | 'tries'>[] {
  const out: Omit<Item, 'since' | 'lastSeen' | 'status' | 'nextAr' | 'tries'>[] = [];
  for (const c of precheck.bots) {
    if (!inShift(c.id)) continue;
    if (c.status !== 'warn' && c.status !== 'fail') continue;
    for (const p of c.problems) out.push({ key: selfKey(c.id, p), bot: c.id, source: 'self', shift: shiftOfBot(c.id), level: c.status === 'fail' && (isLate(p) || c.problems.length === 1) ? 'fail' : 'warn', textAr: `${botOf(c.id)?.nameAr || c.id}: ${p}`, ...(OWNER.test(p) ? { owner: true } : {}) });
  }
  for (const r of probes) {
    if (r.level !== 'warn' && r.level !== 'fail') continue;
    const team = TEAMS[r.id];
    out.push({ key: `probe:${r.id}`, bot: team[0].bot, source: 'probe', shift: shiftOfProbe(r.id), probe: r.id, level: r.level, owner: r.owner, textAr: `${PROBES[r.id].nameAr}: ${r.noteAr}${r.samples?.length ? ` — مثال: ${r.samples.slice(0, 3).join('، ')}` : ''}`, team });
  }
  return out;
}

/** Task forces from the pre-check's help requests touching a bot with an open problem. */
function handoffTeam(bot: BotId, handoffs: Handoff[]): TeamPart[] | undefined {
  const related = handoffs.filter((h) => h.from === bot || h.to === bot);
  if (!related.length) return undefined;
  const parts: TeamPart[] = [{ bot, roleAr: 'صاحب المشكلة — يصلح الجزء بتاعه' }];
  for (const h of related) {
    const other = h.from === bot ? h.to : h.from;
    if (!parts.some((p) => p.bot === other)) parts.push({ bot: other, roleAr: h.textAr });
  }
  return parts.length > 1 ? parts : undefined;
}

/** The workflow that would fix an item, if any. */
export function fixFor(item: Pick<Item, 'source' | 'probe' | 'bot' | 'textAr' | 'owner'>): PatrolRerunnable | undefined {
  if (item.owner) return undefined;
  if (item.source === 'probe') return item.probe ? PROBE_FIX[item.probe] : undefined;
  const wf = botOf(item.bot)?.workflow;
  return isLate(item.textAr) && isPatrolRerunnable(wf) ? wf : undefined;
}

export function playbookFor(item: Pick<Item, 'probe' | 'textAr'>): Omit<ShaheenAnswer, 'at' | 'by'> {
  const p = (item.probe && PLAYBOOK[item.probe]) || (isLate(item.textAr) ? PLAYBOOK.late : PLAYBOOK.other);
  return { diagnosisAr: p.diagnosisAr, stepsAr: p.stepsAr, needsCode: p.needsCode };
}

/** The expert reviews of every bot whose robot finished a run since its last review. */
export function reviewsFor(precheck: PrecheckFile, probes: ProbeResult[], reviewed: Partial<Record<BotId, string>>, inShift: (id: BotId) => boolean = () => true): Review[] {
  const byId = new Map(probes.map((p) => [p.id, p]));
  const out: Review[] = [];
  for (const c of precheck.bots) {
    if (!inShift(c.id)) continue;
    const run = c.lastRun;
    if (!run || run.status !== 'completed' || !run.at || reviewed[c.id] === run.at) continue;
    const rv = reviewerOf(c.id);
    const tested: Review['tested'] = [];
    const defects: string[] = [];
    tested.push({ nameAr: 'نتيجة التشغيل', level: run.conclusion === 'success' ? 'ok' : run.conclusion === 'failure' ? 'fail' : 'warn', noteAr: run.conclusion || run.status });
    if (run.conclusion === 'failure') defects.push('التشغيل فشل');
    if (c.reportAt) tested.push({ nameAr: 'التقرير', level: c.problems.some(isLate) ? 'warn' : 'ok', noteAr: `من ${c.ageHours ?? '؟'} ساعة` });
    // The bot's own numbers judge the work only when they are broken (a warning is followed up as a problem).
    if (c.status === 'fail') for (const p of c.problems) if (!defects.includes(p)) defects.push(p);
    for (const id of rv.probes) {
      const r = byId.get(id);
      if (!r || r.level === 'skip') continue;
      tested.push({ nameAr: PROBES[id].nameAr, level: r.level, noteAr: `${r.noteAr} (${r.checked} اختبار)`, deep: r.deep });
      if ((r.level === 'fail' || r.level === 'warn') && !r.owner) defects.push(`${PROBES[id].nameAr}: ${r.noteAr}`);
    }
    out.push({ bot: c.id, reviewerAr: rv.nameAr, reviewerEn: rv.nameEn, runAt: run.at, verdict: defects.length ? 'rejected' : 'approved', tested, defects });
  }
  return out;
}

/** One patrol: merge this hour's findings with the open items, decide fixes, escalations and tasks. */
export function runPatrol(input: PatrolInput): PatrolPlan {
  const { now, precheck, probes, engineReady } = input;
  const prev = input.previous && isPatrolFile(input.previous) ? input.previous : emptyPatrol();
  const at = new Date(now).toISOString();
  const shift = input.shift ?? shiftAt(now);
  const inShift = (id: BotId) => shift === 'all' || shiftOfBot(id) === shift;
  const itemShift = (i: Pick<Item, 'shift' | 'probe' | 'bot'>): ShiftIndex => i.shift ?? (i.probe ? shiftOfProbe(i.probe) : shiftOfBot(i.bot));
  const found = findings(precheck, probes, inShift);
  const before = new Map(prev.open.map((i) => [i.key, i]));
  const reruns = prev.reruns.filter((r) => hours(r.at, now) < 48);
  const startNow: PatrolRerunnable[] = [];
  const ask: Item[] = [];
  const tasks: Item[] = [];
  const runOf = (wf: string | undefined) => precheck.bots.map((b) => b.lastRun && botOf(b.id)?.workflow === wf ? b.lastRun : undefined).find(Boolean);

  // Expert reviews first: a rejection marks the matching items.
  const reviews = reviewsFor(precheck, probes, prev.reviewedRuns, inShift);
  const reviewedRuns = { ...prev.reviewedRuns };
  for (const r of reviews) reviewedRuns[r.bot] = r.runAt;

  const open: Item[] = [];
  for (const f of found) {
    const old = before.get(f.key);
    const item: Item = { ...f, since: old?.since || at, lastSeen: at, status: 'watch', nextAr: '', tries: (old?.tries || []).filter((t) => hours(t.at, now) < 48), team: f.team || handoffTeam(f.bot, precheck.handoffs), shaheen: old?.shaheen, issue: old?.issue };
    const rejected = reviews.filter((r) => r.verdict === 'rejected' && r.defects.some((d) => f.textAr.includes(d) || (f.probe && d.startsWith(PROBES[f.probe].nameAr)))).map((r) => r.bot);
    if (rejected.length || old?.rejectedBy?.length) item.rejectedBy = [...new Set([...(old?.rejectedBy || []), ...rejected])];

    if (item.owner) {
      item.status = 'owner';
      item.nextAr = 'محتاج قرار صاحب المتجر — مش هيتصعد لشاهين ولا يتعمل له إصلاح آلي';
      open.push(item);
      continue;
    }
    const wf = fixFor(item);
    const lastTry = item.tries[item.tries.length - 1];
    const running = wf ? runOf(wf)?.status !== undefined && runOf(wf)?.status !== 'completed' : false;
    if (wf && item.tries.length < MAX_TRIES) {
      const recent = reruns.find((r) => r.workflow === wf && hours(r.at, now) < RERUN_GAP_H);
      if (running) { item.status = 'waiting_fix'; item.nextAr = `${wf} شغال دلوقتي — المراجع هيتأكد بعده`; }
      else if (recent) { item.status = 'waiting_fix'; item.nextAr = `${wf} اتشغل الساعة ${recent.at.slice(11, 16)} UTC — مستنيين نتيجته قبل أي تشغيل تاني`; }
      else if (startNow.length < MAX_RERUNS_PER_PATROL || startNow.includes(wf)) {
        if (!startNow.includes(wf)) startNow.push(wf);
        item.tries = [...item.tries, { at, workflow: wf }];
        reruns.push({ at, workflow: wf, key: item.key });
        item.status = 'fixing';
        item.nextAr = `اتصلح آلياً: ${wf} اتشغل تاني (محاولة ${item.tries.length}/${MAX_TRIES}) — الدورية الجاية تتأكد بالتجربة`;
      } else { item.status = 'waiting_fix'; item.nextAr = 'في الدور لإعادة التشغيل في الدورية الجاية'; }
      open.push(item);
      continue;
    }
    // No safe fix left (or the fixes did not work): Shaheen helps.
    const why = wf ? `اتشغل ${item.tries.length} مرات ولسه المشكلة موجودة${lastTry ? ` (آخر مرة ${lastTry.at.slice(11, 16)} UTC)` : ''}` : 'مفيش إصلاح آلي آمن';
    const answered = item.shaheen?.by === 'ai' && hours(item.shaheen.at, now) < ASK_GAP_H;
    if (engineReady && !answered) ask.push(item);
    if (!item.shaheen || (item.shaheen.by === 'ai' && !answered)) item.shaheen = { at, by: 'playbook', ...playbookFor(item) };
    // «shaheen» only once he really answered; run.mts upgrades the items he answers this hour.
    item.status = answered ? 'shaheen' : 'waiting_shaheen';
    item.nextAr = answered
      ? `${why} — شاهين شخّصها: ${item.shaheen.diagnosisAr.slice(0, 160)}`
      : engineReady
        ? `${why} — في دور شاهين يشخصها (سؤال واحد بس في كل وردية عشان باقة الزوار)`
        : `${why} — اتحوّل لشاهين؛ مفيش محرك ذكاء اصطناعي شغال دلوقتي، فرد من خبرته المسجلة والمشكلة مستنياه (مش هنعمل إصلاح وهمي)`;
    if (item.issue) { item.status = 'task'; item.nextAr = `مهمة تطوير #${item.issue} لوكيل البرمجة («نفذ مهام شاهين»)`; }
    else if (item.level === 'fail' && hours(item.since, now) >= TASK_AFTER_H && (item.shaheen?.needsCode ?? true)) tasks.push(item);
    open.push(item);
  }

  // Resolved since the last patrol: gone from this hour's tests.
  // Items of the other shifts were not checked this hour: they wait as they are for their own shift.
  const checked = new Set(open.map((i) => i.key));
  const tested = new Set(probes.map((p) => p.id));
  for (const old of prev.open) if (!checked.has(old.key) && shift !== 'all' && itemShift(old) !== shift && !(old.probe && tested.has(old.probe))) open.push({ ...old, shift: itemShift(old) });
  const stillOpen = new Set(open.map((i) => i.key));
  const resolved: Resolved[] = [
    ...prev.open.filter((i) => !stillOpen.has(i.key)).map((i) => ({
      key: i.key, bot: i.bot, textAr: i.textAr, since: i.since, resolvedAt: at,
      howAr: i.tries.length ? `اتصلح بعد إعادة تشغيل ${i.tries[i.tries.length - 1].workflow} — اتأكدنا بالتجربة في الدورية دي` : i.issue ? `اتقفل بعد مهمة التطوير #${i.issue} — اتأكدنا بالتجربة` : 'اختفى في فحص الدورية دي',
    })),
    ...prev.resolved,
  ].slice(0, 40);

  const teams = open.filter((i) => i.team && i.team.length > 1).map((i) => ({ key: i.key, textAr: i.textAr, parts: i.team! }));
  const counts = { ok: 0, warn: 0, fail: 0, idle: 0 };
  for (const b of precheck.bots) counts[b.status]++;
  const measured = precheck.bots.length - counts.idle;
  const probeFails = probes.filter((p) => p.level === 'fail' && !p.owner).length;
  const health = measured ? Math.max(0, Math.round((100 * (counts.ok + counts.warn * 0.5)) / measured) - probeFails * 3) : 0;
  const approved = reviews.filter((r) => r.verdict === 'approved').length;
  const shiftName = shift === 'all' ? 'دورية كاملة (كل الأدوات)' : SHIFTS[shift].nameAr;
  const summaryAr = `${shiftName} ${at.slice(11, 16)} UTC: ${probes.filter((p) => p.level !== 'skip').length} اختبار عملي (${probes.filter((p) => p.level === 'ok').length} سليم)، `
    + `${open.length} مشكلة مفتوحة — ${open.filter((i) => i.status === 'fixing').length} بتتصلح آلياً، ${open.filter((i) => i.status === 'shaheen' || i.status === 'waiting_shaheen').length} عند شاهين، ${open.filter((i) => i.status === 'task').length} مهمة تطوير، ${open.filter((i) => i.status === 'owner').length} محتاجة قرارك؛ `
    + `${reviews.length ? `${reviews.length} مراجعة خبير (${approved} اتقبلت، ${reviews.length - approved} اترفضت)` : 'مفيش شغل جديد للمراجعة'}؛ ${resolved.filter((r) => r.resolvedAt === at).length} اتصلحت من آخر دورية.`;

  const file: PatrolFile = {
    version: 1, updatedAt: at, publishedAt: prev.publishedAt, signature: '', summaryAr, health,
    bots: precheck.bots.map((b) => ({ id: b.id, status: b.status, problems: b.problems.length, reviewed: reviewedRuns[b.id] })),
    // Every test's latest result: this shift's, and the other shifts' from their last turn.
    probes: [
      ...probes.map((p) => ({ ...p, at, nameAr: PROBES[p.id].nameAr, nameEn: PROBES[p.id].nameEn })),
      ...prev.probes.filter((p) => !probes.some((q) => q.id === p.id) && p.id in PROBES),
    ].sort((a, b) => Object.keys(PROBES).indexOf(a.id) - Object.keys(PROBES).indexOf(b.id)),
    open, resolved, reviews: [...reviews, ...prev.reviews].slice(0, 30), reviewedRuns, reruns, teams,
    shift: shift === 'all' ? undefined : { index: shift, nameAr: SHIFTS[shift].nameAr, nameEn: SHIFTS[shift].nameEn, next: SHIFTS.map((x) => nextShiftAt(x.index, now)) },
    engine: { ready: engineReady, noteAr: engineReady ? 'محرك ذكاء اصطناعي جاهز لشاهين' : 'مفيش محرك ذكاء اصطناعي شغال — شاهين بيرد من خبرته المسجلة والمشاكل اللي محتاجة تشخيص مستنياه' },
  };
  file.signature = signatureOf(file);
  return { file, reruns: startNow, ask, tasks };
}

/** What changed worth publishing (not timestamps): items, their state, reruns, reviews. */
export function signatureOf(f: PatrolFile): string {
  const s = JSON.stringify({
    open: f.open.map((i) => [i.key, i.level, i.status, i.tries.length, i.issue || 0, i.shaheen?.by || '', i.shaheen?.at.slice(0, 10) || '']).sort(),
    reviews: Object.entries(f.reviewedRuns).sort(),
    probes: f.probes.map((p) => [p.id, p.level]).sort(),
  });
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** Publish when the state changed, or as a heartbeat so «the patrol is alive» stays visible. */
export function shouldPublish(file: PatrolFile, previous: PatrolFile | undefined, now: number): boolean {
  if (!previous || !isPatrolFile(previous)) return true;
  if (file.signature !== previous.signature) return true;
  return hours(previous.publishedAt || previous.updatedAt, now) >= HEARTBEAT_H;
}

/** Shaheen's diagnosis request (AI): the problem, the scope, what was tried; a strict JSON answer. */
export const SHAHEEN_SYSTEM = 'أنت «الخبير شاهين»، المدير العام لأدوات منصة شام للعطور. أداة من أدواتك لقت مشكلة في شغلها ومعرفتش تصلحها لوحدها. '
  + 'شخّص السبب باختصار وحدد خطوات إصلاح عملية. لا تخترع نتائج ولا تقل إن حاجة اتصلحت. القرارات القانونية والمالية لصاحب المتجر. '
  + `رد بـ JSON فقط: {"diagnosisAr": "...", "stepsAr": ["..."], "needsCode": true|false, "rerun": "<واحد من: ${PATROL_RERUNNABLE.join(', ')}> أو فاضي"}`;
export function shaheenPrompt(item: Item): string {
  const bot = botOf(item.bot);
  return [
    `الأداة: ${bot?.nameAr || item.bot} — مهامها: ${bot?.dutiesAr || ''}`,
    `المشكلة (${item.level === 'fail' ? 'عطل' : 'تحذير'}) من ${item.since}: ${item.textAr}`,
    item.tries.length ? `اللي اتجرب: ${item.tries.map((t) => `${t.workflow} الساعة ${t.at}`).join('، ')}` : 'مفيش إصلاح آلي آمن متاح',
    item.team ? `فريق العمل: ${item.team.map((p) => `${botOf(p.bot)?.nameAr || p.bot} (${p.roleAr})`).join('، ')}` : '',
  ].filter(Boolean).join('\n');
}
export function parseShaheen(value: unknown, at: string): ShaheenAnswer | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Record<string, unknown>;
  const diagnosisAr = typeof v.diagnosisAr === 'string' ? v.diagnosisAr.replace(/https?:\/\/\S+/g, '').trim().slice(0, 500) : '';
  const stepsAr = Array.isArray(v.stepsAr) ? v.stepsAr.filter((s): s is string => typeof s === 'string').map((s) => s.trim().slice(0, 200)).filter(Boolean).slice(0, 5) : [];
  if (!diagnosisAr || !stepsAr.length) return undefined;
  return { at, by: 'ai', diagnosisAr, stepsAr, needsCode: v.needsCode !== false, ...(isPatrolRerunnable(v.rerun) ? { rerun: v.rerun } : {}) };
}

/** The development task for the coding agent (same flow as the council's tasks, AGENTS.md). */
export const issueMarker = (key: string) => `<!-- shaheen-patrol:${key.replace(/-->/g, '')} -->`;
export function patrolIssue(item: Item): { title: string; body: string; labels: string[] } {
  const bot = botOf(item.bot);
  const s = item.shaheen;
  return {
    title: `مهمة شاهين: ${item.textAr.slice(0, 110)}`,
    body: [
      issueMarker(item.key),
      `**من الدورية كل ساعة** — الأداة: ${bot?.nameAr || item.bot}`,
      '',
      `**المشكلة:** ${item.textAr}`,
      `**من:** ${item.since}`,
      item.tries.length ? `**اللي اتجرب آلياً:** ${item.tries.map((t) => `${t.workflow} (${t.at})`).join('، ')}` : '**مفيش إصلاح آلي آمن متاح.**',
      s ? `**تشخيص شاهين (${s.by === 'ai' ? 'بالذكاء الاصطناعي' : 'من خبرته المسجلة'}):** ${s.diagnosisAr}\n${s.stepsAr.map((x) => `- ${x}`).join('\n')}` : '',
      item.team ? `**فريق العمل:**\n${item.team.map((p) => `- ${botOf(p.bot)?.nameAr || p.bot}: ${p.roleAr}`).join('\n')}` : '',
      '',
      'بعد الإصلاح: lint + test + build، PR واحد فيه `Closes #<رقم المهمة>`؛ الدورية الجاية تتأكد بالتجربة وتقفلها في سجلها.',
    ].filter((l) => l !== '').join('\n'),
    labels: ['shaheen-task', 'shaheen-patrol', `priority-${item.level === 'fail' ? 'high' : 'medium'}`],
  };
}

/** Bots in the structure that the patrol covers (all of them — the test checks it). */
export const patrolled = () => BOTS.map((b) => b.id);
