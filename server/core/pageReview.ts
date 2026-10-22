/**
 * «مراجعة الصفحات» — المساعد بيتدرّب على كل صفحة في الموقع، وبعدها بيتراجع.
 *
 * الفكرة: الرد المنطقي بيعتمد على الصفحة اللي الزائر واقف فيها. أول ما المساعد يعرف الصفحة
 * (`server/core/pageGuide.ts` + `page` اللي الودجت بيبعتها مع كل رسالة)، بقى لازم كل سؤال واقعي
 * على كل صفحة يطلع رد صح — مش رد عام ولا رقم مخترع.
 *
 * المراجعة دي بتسأل المحرك المحلي بنفسه (من غير أي مفتاح ذكاء اصطناعي) أسئلة كل صفحة، وتفحص:
 *
 *  1. هل الرد بيخص الصفحة؟ (سعر حقيقي في المتجر، المنتج المفتوح، الأداة اللي قدامه، شاهين، المجتمع…)
 *  2. هل الرد صادق؟ (مفيش «مفيش منتجات» والمتجر مليان، مفيش سعر مش موجود، مفيش هامش أو سعر مورّد،
 *     مفيش اسم شركة ذكاء اصطناعي، مفيش وعد بطلب أو دفع).
 *  3. هل الرد مفيد؟ (مش «مش لاقي إجابة» والزائر واقف في صفحة ليها إجابة، ومعاه زر يفتح اللي بيتكلم عنه).
 *
 * النتيجة بتظهر في لوحة الإدارة ← «الجودة والتعلّم» ← «مراجعة الصفحات»، وبتتنادى من
 * `GET /api/admin/assistant/pages` ومن السطر `npm run review:pages`. الاختبارات بتشغّلها كمان، فأي
 * صفحة ردها اتلخبط بيفشل البناء.
 */
import { Orchestrator } from './orchestrator';
import type { Repository } from './repository';
import { PAGES, type PageExpect, type PageGuide } from './pageGuide';
import { findStorefront, storefrontCatalog, type StoreItem } from './storeGuide';

export interface PageCheck {
  page: string;
  pageLabel: string;
  question: string;
  /** What a sensible answer on this page must contain. */
  expected: string;
  /** What the assistant actually did. */
  actual: string;
  ok: boolean;
  fix: string;
}

export interface PageReview {
  at: string;
  /** 0–100: share of passing checks. */
  score: number;
  passed: number;
  total: number;
  pages: number;
  checks: PageCheck[];
  notes: string[];
}

const REVIEWER = 'pages-review';
/** Any AI vendor name in a visitor-facing answer is a hard fail (AGENTS.md: no vendor names, ever). */
const VENDOR = /\b(openai|chatgpt|gpt-?[0-9]|gemini|anthropic|claude|deepseek|llama|qwen|bard|copilot)\b/i;
/** A promise the assistant cannot keep: only the visitor fills a form, only the store takes money. */
const PROMISE = /(تم (الطلب|الشراء|الحجز)|هيوصل(ك| لك) (الطلب )?(بكرة|غدا|خلال)|أكدت (طلبك|الدفع)|خصم [0-9]+ ?%|كود خصم)/;
/** What the store's empty-catalog answer says — never allowed while products are published. */
const EMPTY_CLAIM = /(مفيش منتجات منشورة|لا توجد منتجات|لسه بيتجهز|not published yet|no published products)/i;
const NO_ANSWER = /(مش لاقي إجابة مؤكدة|could not find a confirmed answer)/;

const EXPECT_LABEL: Record<PageExpect, { ar: string; en: string }> = {
  any: { ar: 'رد حقيقي على السؤال من بيانات المنصة (من غير «مش لاقي إجابة»)', en: 'a real answer from the platform data (not «no answer»)' },
  store: { ar: 'منتج حقيقي من الكتالوج باسمه وسعره', en: 'a real catalog product with its name and price' },
  prices: { ar: 'نطاق السعر الحقيقي ومنتجات بأسعارها الحقيقية', en: 'the real price range and products at their real prices' },
  product: { ar: 'المنتج المفتوح نفسه بسعره الحقيقي', en: 'the open product itself at its real price' },
  orders: { ar: 'مسار التتبع برقم SH- وبيانات التواصل', en: 'the SH- tracking path' },
  support: { ar: 'استمارة طلب أو تحويل لموظف', en: 'a request form or a human hand-off' },
  tool: { ar: 'الأداة اللي الزائر واقف عليها وزر يفتحها', en: 'the tool the visitor is on, and a button to open it' },
  shaheen: { ar: 'اسم «الخبير شاهين» وزر صفحته', en: 'Master Shaheen by name and a button to his page' },
  community: { ar: 'مجتمع شام وسوق التجار وزر يفتحهم', en: 'the Sham community / merchant market and a button' },
};

const FIX: Record<PageExpect, string> = {
  any: 'ضيف رد للصفحة في composeLocal (server/core/orchestrator.ts) بدل ما تسيب المساعد يقول «مش لاقي إجابة» وهو واقف في صفحة ليها رد.',
  store: 'راجع search_store في server/core/tools.ts ودمجه في فرع browse_products في composeLocal.',
  prices: 'راجع priceDigest في server/core/storeGuide.ts وفروع الأسعار في composeLocal — السؤال العام عن الأسعار لازم ياخد نطاق حقيقي وأمثلة على طوله، مش آخر أربع منتجات.',
  product: 'راجع فرع المنتج المفتوح في composeLocal (productAnswer) و`productId` اللي الودجت بيبعته.',
  orders: 'راجع نية track_order وأداة track_order، لازم الزائر يعرف إن التتبع برقم SH مع الهاتف أو البريد.',
  support: 'راجع خدمة support وأداة prepare_request_form وزر التحويل لموظف.',
  tool: 'راجع PLATFORM_FEATURES في server/core/platformGuide.ts + فتح التبويب في orchestrator، والرد المفروض يشرح الأداة اللي قدام الزائر.',
  shaheen: 'راجع shaheenHandoff في server/core/shaheenSpecialties.ts وزر صفحة شاهين في orchestrator.',
  community: 'راجع ميزات community وmerchant في server/core/platformGuide.ts وفتح تبويب المجتمع.',
};

const L = (lang: 'ar' | 'en', ar: string, en: string) => (lang === 'ar' ? ar : en);

export async function reviewPages(repo: Repository, opts: { env?: Record<string, string | undefined>; pages?: string[] } = {}): Promise<PageReview> {
  // A model-free orchestrator on purpose: this proves the built-in answers, the ones every visitor gets
  // even when no engine is configured or every engine is down.
  const bot = new Orchestrator(repo, { env: {} });
  const { items, snapshot } = await storefrontCatalog(opts.env || {});
  const prices = new Set(items.map((i) => Math.round(i.price)));
  const names = items.map((i) => i.nameAr);
  const openProduct = items.find((i) => i.inStock) || items[0];
  const checks: PageCheck[] = [];
  const pages = opts.pages?.length ? PAGES.filter((p) => opts.pages!.includes(p.id)) : PAGES;

  for (const page of pages) {
    for (const question of page.questions) {
      const out = await bot.chat({
        message: question.ar,
        visitorId: `${REVIEWER}-${Math.random().toString(36).slice(2, 10)}`,
        language: 'ar',
        page: page.id,
        ...(page.detail && openProduct ? { productId: openProduct.id } : {}),
      });
      const reply = out.reply || '';
      const actions = out.actions || [];
      const tabs = actions.filter((a) => a.type === 'open_tab').map((a) => a.tab || '');
      const problems: string[] = [];

      // ── honesty, on every page ──
      if (VENDOR.test(reply)) problems.push(L('ar', 'اسم شركة ذكاء اصطناعي في الرد', 'an AI vendor name in the reply'));
      if (PROMISE.test(reply)) problems.push(L('ar', 'وعد بطلب أو دفع أو خصم', 'a promise of an order, payment or discount'));
      if (EMPTY_CLAIM.test(reply) && !snapshot.empty) problems.push(L('ar', 'بيقول مفيش منتجات والمتجر فيه ١١٦١ منتج', 'claims an empty store while products are published'));
      // Saying «بدون أي هامش» is a promise of privacy, not a leak: only an actual figure counts.
      if (/(هامش|سعر المورّد|supplier price|margin)[^\d\n]{0,24}\d/i.test(reply)) problems.push(L('ar', 'كشف هامش المنصة أو سعر المورّد برقم', 'disclosed the margin or a supplier price with a figure'));
      const quoted = [...reply.matchAll(/(\d{3,5})\s*(?:جنيه|ج\.م|EGP|egp)/g)].map((m) => Number(m[1]));
      const invented = quoted.filter((n) => !prices.has(n) && n !== snapshot.minPrice && n !== snapshot.maxPrice && n !== snapshot.total && n !== snapshot.inStock);
      if (invented.length) problems.push(L('ar', `سعر مش موجود في المتجر: ${invented.join(', ')}`, `a price that is not in the store: ${invented.join(', ')}`));

      // ── does the answer fit the page? ──
      const realName = names.some((n) => n && reply.includes(n));
      switch (question.expect) {
        case 'any':
          if (reply.trim().length < 40) problems.push(L('ar', 'رد قصير جداً', 'answer too short'));
          if (NO_ANSWER.test(reply)) problems.push(L('ar', '«مش لاقي إجابة» والزائر واقف في صفحة ليها رد', '«no answer» while the visitor stands on a page that has one'));
          break;
        case 'store':
          if (!realName) problems.push(L('ar', 'مفيش منتج حقيقي بالاسم', 'no real product name'));
          if (!tabs.includes('store')) problems.push(L('ar', 'مفيش زر يفتح المتجر', 'no button to the store'));
          break;
        case 'prices': {
          const rangeShown = quoted.length > 0 || /(\d{3,5})\s*(?:جنيه|EGP)/.test(reply);
          if (!rangeShown) problems.push(L('ar', 'مفيش سعر حقيقي في الرد', 'no real price in the reply'));
          if (!realName) problems.push(L('ar', 'مفيش منتجات بأسمائها', 'no products by name'));
          if (!tabs.includes('store')) problems.push(L('ar', 'مفيش زر يفتح المتجر', 'no button to the store'));
          break;
        }
        case 'product':
          if (!openProduct) problems.push(L('ar', 'الكتالوج فاضي', 'the catalog is empty'));
          else if (!reply.includes(openProduct.nameAr)) problems.push(L('ar', `الرد مش بيذكر المنتج المفتوح (${openProduct.nameAr})`, `the reply does not mention the open product (${openProduct.nameAr})`));
          break;
        case 'orders':
          if (!/SH-/.test(reply)) problems.push(L('ar', 'مفيش ذكر لرقم الطلب SH-', 'no SH- reference path'));
          break;
        case 'support':
          if (!actions.some((a) => a.type === 'request_form' || a.type === 'handoff')) problems.push(L('ar', 'مفيش استمارة ولا تحويل لموظف', 'no form and no hand-off'));
          break;
        case 'tool':
          if (!tabs.length) problems.push(L('ar', 'مفيش زر يفتح الأداة', 'no button to the tool'));
          break;
        case 'shaheen':
          if (!/شاهين/.test(reply)) problems.push(L('ar', 'مفيش ذكر للخبير شاهين', 'Shaheen is not named'));
          if (!tabs.some((t) => ['master_ai', 'perfume_news', 'store'].includes(t))) problems.push(L('ar', 'مفيش زر لصفحة شاهين', 'no button to Shaheen'));
          break;
        case 'community':
          if (!/مجتمع|التجار|merchant|community/i.test(reply)) problems.push(L('ar', 'مفيش ذكر للمجتمع أو سوق التجار', 'no mention of the community or merchant market'));
          if (!tabs.some((t) => t.startsWith('community'))) problems.push(L('ar', 'مفيش زر يفتح المجتمع', 'no button to the community'));
          break;
      }

      checks.push({
        page: page.id,
        pageLabel: page.label.ar,
        question: question.ar,
        expected: EXPECT_LABEL[question.expect].ar,
        actual: problems.length ? problems.join(' · ') : `تمام — النية: ${out.intent}${tabs.length ? ` · الأزرار: ${tabs.join(', ')}` : ''} · سؤال حقيقي بمنتج/سعر من الكتالوج`,
        ok: problems.length === 0,
        fix: FIX[question.expect],
      });
    }
  }

  const passed = checks.filter((c) => c.ok).length;
  return {
    at: new Date().toISOString(),
    score: checks.length ? Math.round((passed / checks.length) * 100) : 0,
    passed,
    total: checks.length,
    pages: pages.length,
    checks,
    notes: [
      L('ar', `${pages.length} صفحة × أسئلتها الواقعية، والفحص بيشغّل المحرك المحلي من غير أي مفتاح ذكاء اصطناعي.`,
        `${pages.length} pages × their realistic questions, run against the local engine with no AI key.`),
      ...(snapshot.empty ? [L('ar', 'الكتالوج فاضي في هذه البيئة، ففحوص الأسعار بتتحقق من الصدق بس.', 'The catalog is empty in this environment, so price checks only verify honesty.')] : []),
    ],
  };
}

const CACHE_MS = 60_000;
// Keyed by the repository instance: two stores in one process (tests, an admin sandbox) must never share a
// review, while the panel and the API — same repo — reuse one run per minute.
const cache = ((globalThis as { __shamPageReview?: WeakMap<object, { at: number; review: PageReview }> }).__shamPageReview ??= new WeakMap());

/** The panel and the API reuse one run per minute. */
export async function reviewPagesCached(repo: Repository, opts: { env?: Record<string, string | undefined> } = {}, force = false): Promise<PageReview> {
  const hit = cache.get(repo);
  if (!force && hit && Date.now() - hit.at < CACHE_MS) return hit.review;
  const review = await reviewPages(repo, opts);
  cache.set(repo, { at: Date.now(), review });
  return review;
}

/** Kept for the review page and for tests: a page's questions, in order. */
export const pageQuestions = (page: PageGuide) => page.questions.map((q) => q.ar);

export { findStorefront, type StoreItem };
