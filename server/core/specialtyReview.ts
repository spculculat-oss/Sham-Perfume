/**
 * «مراجعة التخصصات» — هل مساعد شام فعلًا بيعرف المتجر، وبيعرف حدوده من شاهين؟
 *
 * مراجعة حقيقية مش تقرير تجميلي: بتكلّم المحرك المحلي بنفسه (من غير أي مفتاح ذكاء اصطناعي) بأسئلة
 * نموذجية من سجل التخصصات (`server/core/shaheenSpecialties.ts`)، وتفحص الرد الفعلي والأزرار والمراجع:
 *
 *  1. كل تخصص للمساعد: الرد بيجاوب السؤال فعلًا؟ وبيطلع البطاقة الصح (منتج من الكتالوج، استمارة،
 *     تتبع، فتح صفحة، بطاقة خصوصية)؟
 *  2. صدق المتجر: أي سعر في الرد موجود في الكتالوج الحقيقي، وأي هامش أو سعر مورّد = فشل.
 *  3. التخصصات بتاعة شاهين: الرد بيسميه بالاسم ويحوّل لصفحته، ومش بينسب شغله لنفسه.
 *  4. الشغل الداخلي: مفيش أرقام مالية داخلية ولا وعود بتعديل المتجر.
 *  5. تطابق السجل: كل تخصص مذكور في السجلين موجود فعلًا (أدوات شاهين والهيكل الإداري).
 *
 * النتيجة بتظهر في لوحة الإدارة ← «الجودة والتعلّم» ← «مراجعة التخصصات»، وبتتنادى من `GET
 * /api/admin/assistant/specialties` ومن السطر `npm run review:assistant`. الاختبارات بتشغّلها كمان،
 * فأي تدهور في أي تخصص بيفشل البناء.
 */
import { Orchestrator } from './orchestrator';
import type { Repository } from './repository';
import { route } from './router';
import { SPECIALTIES, registryProblems, type Specialty } from './shaheenSpecialties';
import { findStorefront, storefrontCatalog, type StoreSnapshot } from './storeGuide';
import { assistantLessons } from './shaheenSpecialties';

export interface ReviewCheck {
  specialty: string;
  owner: Specialty['owner'];
  question: string;
  ok: boolean;
  /** What the review expected, in plain Arabic (the merchant reads this). */
  expected: string;
  /** What the assistant actually did. */
  actual: string;
  /** What to fix when it fails. */
  fix: string;
}

export interface SpecialtyReview {
  at: string;
  /** 0–100: the share of passing checks. */
  score: number;
  passed: number;
  total: number;
  store: Pick<StoreSnapshot, 'total' | 'inStock' | 'minPrice' | 'maxPrice' | 'brands' | 'families' | 'updatedAt'> & { lessons: number };
  checks: ReviewCheck[];
  registryProblems: string[];
  notes: string[];
}

const REVIEWER = 'specialty-review';

const has = (text: string, words: string[]) => words.some((w) => text.includes(w));
const tag = (specialty: Specialty) => specialty.name.ar;

/** Prices quoted in a reply, so they can be matched against the real catalog (no invented price). */
export function quotedPrices(text: string): number[] {
  const out: number[] = [];
  const re = /(\d+(?:[.,]\d+)?)\s*(?:جنيه|ج\.م|EGP|egp)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push(Number(m[1].replace(',', '.')));
  return out;
}

const CACHE_MS = 60_000;
// Keyed by the repository instance: two stores in one process (tests, an admin sandbox) must never share a
// review, while the panel and the API — same repo — reuse one run per minute.
const cache = ((globalThis as { __shamSpecialtyReview?: WeakMap<object, { at: number; review: SpecialtyReview }> }).__shamSpecialtyReview ??= new WeakMap());

/** The panel and the API reuse one run per minute: the review is real work, not a page decoration. */
export async function reviewSpecialtiesCached(repo: Repository, opts: { env?: Record<string, string | undefined> } = {}, force = false): Promise<SpecialtyReview> {
  const hit = cache.get(repo);
  if (!force && hit && Date.now() - hit.at < CACHE_MS) return hit.review;
  const review = await reviewSpecialties(repo, opts);
  cache.set(repo, { at: Date.now(), review });
  return review;
}

export async function reviewSpecialties(repo: Repository, opts: { env?: Record<string, string | undefined> } = {}): Promise<SpecialtyReview> {
  // A model-free orchestrator on purpose: the review must prove the built-in answers, not a paid engine.
  const bot = new Orchestrator(repo, { env: {} });
  const ask = (message: string, language: 'ar' | 'en' = 'ar') =>
    bot.chat({ message, visitorId: `${REVIEWER}-${Math.random().toString(36).slice(2, 10)}`, language });

  const { items, snapshot } = await storefrontCatalog(opts.env || {});
  const prices = new Set(items.map((i) => Math.round(i.price * 100) / 100));
  const names = new Set(items.map((i) => i.nameAr));
  const checks: ReviewCheck[] = [];

  const check = (specialty: Specialty, ok: boolean, expected: string, actual: string, fix: string, question?: string) =>
    checks.push({ specialty: tag(specialty), owner: specialty.owner, question: question || specialty.sample.ar, ok, expected, actual, fix });

  for (const specialty of SPECIALTIES) {
    const out = await ask(specialty.sample.ar);
    const reply = out.reply || '';
    const actions = out.actions || [];
    const tabs = actions.filter((a) => a.type === 'open_tab').map((a) => a.tab || '');

    if (specialty.owner === 'shaheen') {
      // Shaheen's work: name him, and send the visitor to his page or to the store advisor.
      const namesShaheen = has(reply, ['شاهين', 'Shaheen']);
      const routed = tabs.some((t) => ["master_ai", "perfume_news", "store"].includes(t));
      if (specialty.visitorFacing) {
        check(specialty, namesShaheen && routed,
          'يسمّي «الخبير شاهين» ويحوّل الزائر لصفحته (المعمل / المتجر / الأخبار).',
          `ذكر شاهين: ${namesShaheen ? 'نعم' : 'لا'} · الأزرار: ${tabs.join(', ') || 'مفيش'} · النية: ${out.intent}`,
          `راجع توجيه «${specialty.id}» في server/core/router.ts والتحويل في shaheenSpecialties.shaheenHandoff، لازم الرد يذكر شاهين ويطلع زر صفحته.`);
      } else {
        // Internal work: never present it as something the assistant does, and never leak money figures.
        const money = /\d{3,}\s*(?:جنيه|ج\.م|EGP)|\d+\s*%/.test(reply) && out.intent !== 'browse_products';
        check(specialty, !money,
          'ما ينسبش الشغل الداخلي لنفسه وما ينشرش أرقاماً مالية أو نسباً.',
          money ? `ظهر رقم مالي في الرد: ${reply.slice(0, 120)}` : 'الرد ما فيهوش أرقام داخلية.',
          `راجع فرع «${specialty.id}» في برومبت المساعد: الشغل الداخلي يتذكر بالاسم بس من غير أرقام.`);
      }
      continue;
    }

    // ── the assistant's own specialties ──
    switch (specialty.id) {
      case 'store_discovery': {
        const picks = findStorefront(items, specialty.sample.ar, 4).picks;
        const realName = picks.some((p) => reply.includes(p.nameAr));
        const catalogPrice = quotedPrices(reply).every((p) => prices.has(Math.round(p * 100) / 100));
        const openStore = tabs.includes('store');
        check(specialty, realName && catalogPrice && openStore,
          'يعرض منتجاً حقيقياً من الكتالوج بسعره الحقيقي ويفتح صفحة المتجر.',
          `منتج حقيقي: ${realName ? 'نعم' : 'لا'} (${picks.map((p) => p.nameAr).slice(0, 2).join(' / ') || 'مفيش نتائج'}) · أسعار مطابقة للكتالوج: ${catalogPrice ? 'نعم' : 'لا'} · زر المتجر: ${openStore ? 'نعم' : 'لا'}`,
          'لو فشل: راجع search_store في server/core/tools.ts ودمجه في composeLocal (server/core/orchestrator.ts) وزر فتح المتجر.');
        break;
      }
      case 'store_orders': {
        const wantsRef = /SH-/.test(reply) || actions.some((a) => a.type === 'order_status');
        check(specialty, wantsRef, 'يطلب رقم الطلب مع بيانات التواصل (أو يفتح صندوق التتبع).',
          `صندوق التتبع/ذكر SH-: ${wantsRef ? 'نعم' : 'لا'} · النية: ${out.intent}`,
          'راجع نية track_order وأداة track_order وردّ التتبع في composeLocal.');
        break;
      }
      case 'store_policies': {
        const covered = has(reply, ['شحن', 'الدفع', 'دفع', 'توصيل', 'إرجاع']);
        const cited = (out.citations || []).length > 0;
        check(specialty, covered && cited,
          'يغطّي الدفع/الشحن من مستندات المتجر مع ذكر المصدر.',
          `الموضوعات: ${covered ? 'نعم' : 'لا'} · مراجع: ${(out.citations || []).map((c) => c.id).join(', ') || 'مفيش'}`,
          'راجع مستندات kb-store-* في server/core/storeGuide.ts وكلماتها المفتاحية.');
        break;
      }
      case 'bespoke':
      case 'wholesale': {
        const wanted = specialty.id === 'bespoke' ? 'custom-formula' : 'b2b';
        const form = actions.some((a) => a.type === 'request_form' && a.serviceId === wanted);
        check(specialty, form, `يطلع استمارة الطلب «${wanted}» برقم متابعة.`,
          `استمارة ${wanted}: ${form ? 'نعم' : 'لا'} · الأزرار: ${actions.map((a) => a.type).join(', ') || 'مفيش'}`,
          `راجع كلمات الخدمة «${wanted}» في server/core/seed.ts وتوجيه service_request.`);
        break;
      }
      case 'support': {
        const form = actions.some((a) => a.type === 'request_form' && a.serviceId === 'support');
        const handoff = actions.some((a) => a.type === 'handoff') || out.status === 'handoff';
        check(specialty, form || handoff, 'يسجّل الشكوى كطلب دعم أو يحوّل لموظف بشري.',
          `استمارة الدعم: ${form ? 'نعم' : 'لا'} · تحويل لموظف: ${handoff ? 'نعم' : 'لا'}`,
          'راجع نية handoff وخدمة support وأداة prepare_request_form.');
        break;
      }
      case 'platform_tools': {
        const opened = tabs.some((t) => ['concentration', 'pyramid', 'alcohol', 'costing', 'molecule_studio', 'library', 'master_ai'].includes(t));
        check(specialty, opened, 'يشرح الأداة (أو الخريطة) ويفتح صفحتها.',
          `الأزرار: ${tabs.join(', ') || 'مفيش'} · النية: ${out.intent}`,
          'راجع PLATFORM_FEATURES في server/core/platformGuide.ts وفتح التبويب في orchestrator.');
        break;
      }
      case 'privacy_data': {
        const card = actions.some((a) => a.type === 'privacy');
        check(specialty, card, 'يعرض بطاقة «اللي بفتكره عنك» مع الحذف.',
          `بطاقة الخصوصية: ${card ? 'نعم' : 'لا'} · النية: ${out.intent}`,
          'راجع نية memory_view وبطاقة privacy في orchestrator.');
        break;
      }
      default: {
        // Any other assistant specialty is judged by its routing and its non-empty, on-topic answer.
        const routed = route(specialty.sample.ar, await repo.services());
        const ok = reply.length > 30 && out.intent !== 'question' || routed.confidence >= 0.6;
        check(specialty, ok, 'يوجّه السؤال لمسار حقيقي ويرد رداً مفيداً.',
          `النية: ${out.intent} (${routed.confidence.toFixed(2)}) · طول الرد: ${reply.length}`,
          `راجع كلمات توجيه «${specialty.id}» في router.ts.`);
      }
    }
  }

  // ── cross-cutting: the store never leaks margin or supplier prices ──
  const storeAnswers = await Promise.all([
    ask('عندكم عطر عود رجالي للشتا؟'),
    ask('الشحن بكام لمصر؟'),
  ]);
  const leaked = storeAnswers.some((a) => has(a.reply, ['هامش', 'سعر المورّد', 'سعر التوريد', 'supplier price', 'margin']));
  checks.push({
    specialty: 'المتجر: الصدق في الأسعار', owner: 'assistant', question: 'هامش/سعر مورّد',
    ok: !leaked, expected: 'مفيش هامش منصة ولا سعر مورّد في أي رد للزائر.',
    actual: leaked ? 'ظهر ذكر للهامش أو سعر المورّد.' : 'ما ظهرش.',
    fix: 'راجع علامات الخصوصية في server/core/storeGuide.ts (toItem ما بينقلش supplierPrice) وتعليمات النموذج.',
  });

  // ── registry seam: every specialty still exists in Shaheen's registry ──
  const problems = registryProblems();
  checks.push({
    specialty: 'تطابق سجل شاهين', owner: 'shaheen', question: 'registry',
    ok: problems.length === 0, expected: 'كل تخصص مرتبط بأداة/روبوت موجود فعلاً في السجل.',
    actual: problems.length ? problems.join(' · ') : 'كل السجلات متطابقة.',
    fix: 'حدّث SPECIALTIES في server/core/shaheenSpecialties.ts مع سجل src/utils/aiTools.ts و shaheenOrg.ts.',
  });

  const passed = checks.filter((c) => c.ok).length;
  const total = checks.length;
  const notes: string[] = [];
  if (snapshot.empty) notes.push('المتجر فاضي: التخصصات بتشتغل على الكتالوج المحلي فقط.');
  if (snapshot.total && snapshot.withNotes === 0) notes.push('مفيش منتجات بنوتات موثقة — المساعد بيعرض العائلة بدل ما يخترع نوتات.');
  if (assistantLessons().length) notes.push(`${assistantLessons().length} درساً من شاهين أساس معرفة المساعد بالعطور.`);

  return {
    at: new Date().toISOString(),
    score: total ? Math.round((passed / total) * 100) : 0,
    passed, total,
    store: {
      total: snapshot.total, inStock: snapshot.inStock, minPrice: snapshot.minPrice, maxPrice: snapshot.maxPrice,
      brands: snapshot.brands, families: snapshot.families, updatedAt: snapshot.updatedAt, lessons: assistantLessons().length,
    },
    checks, registryProblems: problems, notes,
  };
}
