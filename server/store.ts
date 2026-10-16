/**
 * «اسأل شاهين» in «متجر شام» — POST /api/store/advise {message, language}
 * The visitor says what they are looking for; «الخبير شاهين» reads the whole catalog (merchant data +
 * his own enrichment from scripts/shaheen-store) and picks the best products with a reason for each.
 * The rule-based advisor (src/utils/storeAdvisor.ts) shortlists first and answers alone when no engine
 * works, so the store never stays silent. Supervised by Shaheen like every AI tool (src/utils/aiTools.ts).
 */
import express from 'express';
import productsData from '../src/data/products.json';
import { recommend } from '../src/utils/storeAdvisor';
import { FAMILY_LABEL, GENDER_LABEL, mergeCatalog, OCCASION_LABEL, SEASON_LABEL, type RawProduct, type StoreCatalogFile, type StoreProduct } from '../src/utils/storeCatalog';
import { callEngine, engineStatuses } from './core/engines';
import { liveStoreCatalog, supervisorGuidance } from './core/liveData';
import { RateLimiter, clientKey } from './core/rateLimit';
import { normalizeQuestion } from './core/capacity';
import type { Repository } from './core/repository';
import type { ModelEngineId, ShaheenSettings } from './core/types';
import { SHAHEEN_SITE_SETTINGS } from './config/shaheen';

type Env = Record<string, string | undefined>;
export interface StoreAdvice { source: 'shaheen' | 'local'; reply: string; picks: { id: string; why: string }[] }
export interface StoreRouterOptions {
  env?: Env; fetch?: typeof fetch; repo?: Repository;
  products?: RawProduct[]; catalog?: () => Promise<StoreCatalogFile | undefined>; timeoutMs?: number;
}

const VENDOR = /\b(?:gemini|google|openai|chat ?gpt|gpt-?\d|claude|anthropic|deepseek|openrouter|llama|mistral)\b|جيميني|شات ?جي ?بي ?تي|كلود|ديب ?سيك/i;
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/```[\s\S]*?```/g, '').replace(/\s+/g, ' ').trim().slice(0, max) : '');

export const ADVISOR_SYSTEM = `أنت «الخبير شاهين»، خبير العطور ومستشار التسوق في «متجر شام».
هويتك «الخبير شاهين» فقط: لا تذكر أي نموذج لغوي أو شركة ذكاء اصطناعي.
الزائر يصف ما يبحث عنه، وأمامك قائمة منتجات المتجر الحقيقية. اختر من 1 إلى 4 منتجات من القائمة فقط تناسب طلبه (الجنس، العائلة العطرية، الموسم، المناسبة، الميزانية، العلامة)، ولكل منتج سبباً قصيراً صادقاً مبنياً على بياناته.
لا تخترع منتجات أو أسعاراً أو خصومات أو نوتات غير مذكورة، ولا تعد بثبات بالساعات. إذا لم يوجد تطابق دقيق فاختر الأقرب وقل ذلك بوضوح.
اكتب بلغة الزائر وبأسلوب ودود ومختصر. أعد JSON فقط.`;

export function catalogLines(products: StoreProduct[]): string {
  return products.slice(0, 120).map((p) => [
    p.sku, p.name.ar, p.name.en !== p.name.ar ? p.name.en : '', p.brand, `${p.price} ج`, p.gender ? GENDER_LABEL[p.gender].ar : '',
    p.families.map((f) => FAMILY_LABEL[f].ar).join('/'), [...p.notes.top, ...p.notes.heart, ...p.notes.base].slice(0, 6).join(', '),
    p.seasons.map((s) => SEASON_LABEL[s].ar).join('/'), p.occasions.map((o) => OCCASION_LABEL[o].ar).join('/'), p.inStock ? '' : 'غير متوفر',
  ].filter(Boolean).join(' | ')).join('\n');
}

/** The rule-based answer: same shape as Shaheen's, in the visitor's language. */
export function localAdvice(products: StoreProduct[], message: string, lang: 'ar' | 'en'): StoreAdvice {
  const { picks, matched } = recommend(products, message, 4);
  const reply = lang === 'ar'
    ? (matched ? `اخترت لك ${picks.length} ${picks.length === 1 ? 'عطراً' : 'عطور'} من المتجر تناسب طلبك:` : 'مش لاقي تطابق دقيق لطلبك، دي أكثر العطور تقييماً في المتجر — قولّي تفاصيل أكتر (رجالي/نسائي، الموسم، الميزانية) وأنا أضيّق الاختيار.')
    : (matched ? `Here ${picks.length === 1 ? 'is 1 perfume' : `are ${picks.length} perfumes`} from the store that ${picks.length === 1 ? 'fits' : 'fit'} your request:` : 'No exact match — these are the best-rated perfumes in the store. Tell me more (men/women, season, budget) to narrow it down.');
  return { source: 'local', reply, picks: picks.map((p) => ({ id: p.product.sku, why: (lang === 'ar' ? p.reasons.ar : p.reasons.en).join(' · ') })) };
}

export function readAdvice(raw: string, products: StoreProduct[]): Omit<StoreAdvice, 'source'> | undefined {
  const body = raw.replace(/```(?:json)?/gi, '');
  const start = body.indexOf('{'); const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) return undefined;
  let data: { reply?: unknown; picks?: unknown };
  try { data = JSON.parse(body.slice(start, end + 1)); } catch { return undefined; }
  const known = new Set(products.map((p) => p.sku));
  const seen = new Set<string>();
  const picks = (Array.isArray(data.picks) ? data.picks : []).flatMap((p) => {
    const id = String((p as { id?: unknown })?.id ?? '').trim();
    if (!known.has(id) || seen.has(id)) return [];
    seen.add(id);
    const why = clean((p as { why?: unknown }).why, 200);
    return [{ id, why: VENDOR.test(why) ? '' : why }];
  }).slice(0, 4);
  const reply = clean(data.reply, 700);
  if (!picks.length) return undefined;
  return { reply: VENDOR.test(reply) ? '' : reply, picks };
}

export function createStoreRouter(options: StoreRouterOptions = {}) {
  const env = options.env || process.env;
  const router = express.Router();
  const limiter = new RateLimiter(Number(env.SHAM_STORE_RATE_PER_MIN) || 20, 60_000);
  const cache = new Map<string, { at: number; advice: StoreAdvice }>();
  const products = options.products || (productsData as { products?: RawProduct[] }).products || [];
  const catalog = options.catalog || (() => liveStoreCatalog(env, options.fetch || fetch));

  router.post('/store/advise', async (req, res) => {
    const message = clean(req.body?.message, 500);
    const lang: 'ar' | 'en' = req.body?.language === 'en' ? 'en' : 'ar';
    if (message.length < 2) { res.status(400).json({ error: 'Message is required', code: 'INVALID_MESSAGE' }); return; }
    if (!limiter.allow(clientKey(req))) { res.status(429).json({ error: 'Too many requests, please wait a minute', code: 'RATE_LIMITED' }); return; }
    const list = mergeCatalog(products, await catalog().catch(() => undefined));
    const key = `${lang}:${normalizeQuestion(message)}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < 10 * 60_000) { res.json(hit.advice); return; }

    let advice: StoreAdvice | undefined;
    const settings: ShaheenSettings = options.repo ? (await options.repo.settings().catch(() => undefined))?.shaheen || SHAHEEN_SITE_SETTINGS : SHAHEEN_SITE_SETTINGS;
    const configured = new Set(engineStatuses(env).filter((s) => s.configured).map((s) => s.id));
    const engines: ModelEngineId[] = settings.enabled ? settings.engines.filter((id) => configured.has(id)) : [];
    if (engines.length) {
      const shortlist = recommend(list, message, 8).picks.map((p) => p.product.sku);
      const system = ADVISOR_SYSTEM + await supervisorGuidance('store_advisor', env).catch(() => '');
      const prompt = `طلب الزائر (${lang === 'ar' ? 'بالعربية' : 'in English'}): «${message}»
ترشيح مبدئي من فلتر المتجر (قد يكون ناقصاً): ${shortlist.join(', ') || 'لا يوجد'}
منتجات المتجر (المعرّف | الاسم | العلامة | السعر | الجنس | العائلة | النوتات | المواسم | المناسبات):
${catalogLines(list)}

أعد: {"reply":"جملة أو جملتان للزائر بلغته","picks":[{"id":"المعرّف كما في القائمة","why":"سبب قصير"}]}`;
      const signal = AbortSignal.timeout(options.timeoutMs ?? 22_000);
      for (const id of engines) {
        if (signal.aborted) break;
        const raw = await callEngine(id, system, [{ role: 'user', text: prompt }], {
          env, fetch: options.fetch, signal, temperature: 0.4, model: settings.models[id], maxTokens: 1200, maxChars: 8000,
        }).catch(() => undefined);
        const got = raw ? readAdvice(raw, list) : undefined;
        if (got) { advice = { source: 'shaheen', reply: got.reply || localAdvice(list, message, lang).reply, picks: got.picks }; break; }
      }
    }
    advice ||= localAdvice(list, message, lang);
    if (cache.size > 300) cache.clear();
    cache.set(key, { at: Date.now(), advice });
    res.json(advice);
  });
  return router;
}
