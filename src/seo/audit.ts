/**
 * The deterministic half of «منارة شاهين»: audits that need no AI key and give the same answer
 * every time. The agent's AI layer reads this report and turns it into prioritized actions, but it
 * can never hide a failed check or invent a better score.
 */
import type { SeoArea } from './curriculum';
import lexicon from './lexicon.json';

export type Severity = 'critical' | 'major' | 'minor';

export interface SeoFinding {
  /** Stable identity (area:page:check) so repeated runs do not duplicate history. */
  id: string;
  area: SeoArea;
  severity: Severity;
  /** Path or file the finding is about. */
  page: string;
  title: string;
  detail: string;
  fix: string;
}

export interface PageAuditInput {
  url: string;
  html: string;
  /** 0 = home/tool (expects Organization/WebSite/FAQPage), product pages expect Product+Offer. */
  kind: 'home' | 'tool' | 'product' | 'product-index' | 'other';
  /** Fetch time in ms (only passed for one representative page). */
  ms?: number;
  /** Bytes of the HTML body. */
  bytes?: number;
}

const MAX_TITLE = 65;
const MIN_TITLE = 20;
const TARGET_DESC_MIN = 110;
const TARGET_DESC_MAX = 165;
const WORDS = (text: string) => text.trim().split(/\s+/).filter(Boolean);

const AREA_BY_PREFIX: Record<string, SeoArea> = {
  title: 'titles', description: 'titles', canonical: 'crawl', robots: 'crawl', viewport: 'mobile',
  h1: 'content', headings: 'content', og: 'content', twitter: 'content', schema: 'schema', images: 'performance',
  hreflang: 'international', lang: 'international', words: 'content', links: 'crawl', html: 'performance',
  status: 'indexing', sitemap: 'indexing', indexnow: 'indexing', llms: 'ai-search', feed: 'authority',
  headers: 'performance', latency: 'performance', duplicated: 'content', meta: 'content', canonicalDuplicate: 'crawl',
  compression: 'performance', security: 'trust',
};
const areaOf = (prefix: string): SeoArea => AREA_BY_PREFIX[prefix] || 'crawl';

export const decodeEntities = (text: string) => text
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));

/** Visible text without scripts, styles, tags; used for word count and language checks. */
export function visibleText(html: string): string {
  return decodeEntities(html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ').trim();
}

const arabicShare = (text: string) => {
  const letters = text.replace(/[^\p{L}]/gu, '');
  if (!letters) return 0;
  return (letters.match(/[\u0600-\u06FF]/g) || []).length / letters.length;
};

interface TagInfo { name: string; content: string }
function metas(html: string): TagInfo[] {
  return [...html.matchAll(/<meta\b([^>]*)>/gi)].map((m) => {
    const attrs = m[1];
    const name = (attrs.match(/\b(?:name|property)\s*=\s*["']([^"']+)["']/i)?.[1] || '').toLowerCase();
    const content = attrs.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1] || '';
    return { name, content: decodeEntities(content) };
  });
}
const metaContent = (list: TagInfo[], key: string) => list.find((m) => m.name === key)?.content?.trim() || '';
function links(html: string): { rel: string; href: string; hreflang?: string }[] {
  return [...html.matchAll(/<link\b([^>]*)>/gi)].map((m) => {
    const attrs = m[1];
    const rel = (attrs.match(/\brel\s*=\s*["']([^"']+)["']/i)?.[1] || '').toLowerCase();
    const href = decodeEntities(attrs.match(/\bhref\s*=\s*["']([^"']*)["']/i)?.[1] || '');
    const hreflang = attrs.match(/\bhreflang\s*=\s*["']([^"']+)["']/i)?.[1];
    return { rel, href, hreflang };
  });
}
function jsonLdBlocks(html: string): unknown[] {
  const out: unknown[] = [];
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { out.push(JSON.parse(m[1].trim())); } catch { out.push(null); }
  }
  return out;
}
function typesIn(block: unknown): string[] {
  if (!block || typeof block !== 'object') return [];
  if (Array.isArray(block)) return block.flatMap(typesIn);
  const obj = block as Record<string, unknown>;
  const own = typeof obj['@type'] === 'string' ? [obj['@type']] : Array.isArray(obj['@type']) ? obj['@type'].filter((x): x is string => typeof x === 'string') : [];
  return [...own, ...Object.values(obj).flatMap(typesIn)];
}
export function schemaTypes(html: string): string[] {
  return [...new Set(jsonLdBlocks(html).flatMap(typesIn))];
}

const pathOf = (url: string) => {
  try { return new URL(url).pathname || '/'; } catch { return url; }
};

export function auditPage(input: PageAuditInput): SeoFinding[] {
  const { html, kind } = input;
  const page = pathOf(input.url);
  const out: SeoFinding[] = [];
  const add = (check: string, severity: Severity, title: string, detail: string, fix: string) =>
    out.push({ id: `${areaOf(check)}:${page}:${check}`, area: areaOf(check), severity, page, title, detail, fix });
  const meta = metas(html);
  const title = decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim();
  const description = metaContent(meta, 'description');
  const canonical = links(html).filter((l) => l.rel.split(/\s+/).includes('canonical')).map((l) => l.href);
  const robots = metaContent(meta, 'robots').toLowerCase();
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => visibleText(m[1]));
  const h2Count = (html.match(/<h2\b/gi) || []).length;
  const wordCount = WORDS(visibleText(html)).length;

  // ---- title ----
  if (!title) add('title', 'critical', 'لا يوجد عنوان للصفحة', 'وسم <title> غائب أو فارغ.', 'أضف عنواناً فريداً 50–60 حرفاً يبدأ بموضوع الصفحة.');
  else {
    if (title.length < MIN_TITLE) add('title', 'major', 'العنوان أقصر من اللازم', `العنوان «${title}» طوله ${title.length} حرفاً.`, 'اكتب عنواناً وصفياً 50–60 حرفاً يوضح فائدة الصفحة.');
    else if (title.length > MAX_TITLE) add('title', 'major', 'العنوان طويل وسيُقتطع', `طول العنوان ${title.length} حرفاً (الحد العملي 60).`, 'أعد صياغة العنوان في حدود 60 حرفاً وابدأ بالكلمة المفتاحية.');
    else if (title.length > 60) add('title', 'minor', 'العنوان عند حد الاقتطاع', `طول العنوان ${title.length} حرفاً.`, 'اختصره إلى 50–60 حرفاً لتقليل إعادة صياغة Google له.');
    if (kind === 'product' && !/متجر شام|شام/.test(title)) add('title', 'minor', 'عنوان المنتج بلا اسم المتجر', 'العنوان لا يذكر «شام».', 'أضف اسم شام في نهاية عنوان المنتج إذا بقي ضمن 60 حرفاً.');
  }
  // ---- description ----
  if (!description) add('description', 'major', 'لا يوجد وصف تعريف', 'وسم meta description غائب.', 'أضف وصفاً 120–160 حرفاً يشرح ما ستجده الصفحة.');
  else if (description.length < 70) add('description', 'major', 'وصف التعريف قصير جداً', `طوله ${description.length} حرفاً.`, 'وسّعه إلى 120–160 حرفاً بفائدة واضحة ودعوة مناسبة.');
  else if (description.length > TARGET_DESC_MAX) add('description', 'major', 'وصف التعريف سيُقتطع', `طوله ${description.length} حرفاً.`, 'اختصره إلى 120–160 حرفاً مع إبقاء الفائدة في البداية.');
  else if (description.length < TARGET_DESC_MIN) add('description', 'minor', 'وصف التعريف أقصر من المستهدف', `طوله ${description.length} حرفاً.`, 'وسّعه قليلاً (120–160 حرفاً) بذكر ميزة أو خطوة عملية.');

  // ---- indexing ----
  if (robots.includes('noindex')) add('robots', 'critical', 'الصفحة ممنوعة من الفهرسة', 'وسم robots يحتوي noindex.', 'أزل noindex من الصفحات التي تريد ظهورها في البحث.');
  if (!canonical.length) add('canonical', 'major', 'لا يوجد canonical', 'لا يشير أي وسم canonical إلى النسخة الأساسية.', 'أضف <link rel="canonical"> بعنوان مطلق https يطابق عنوان الصفحة.');
  else if (canonical.length > 1) add('canonicalDuplicate', 'major', 'أكثر من canonical', `${canonical.length} وسوم canonical في صفحة واحدة.`, 'احتفظ بوسم واحد فقط.');
  else {
    const href = canonical[0];
    if (!/^https:\/\//.test(href)) add('canonical', 'major', 'canonical ليس رابطاً مطلقاً', `القيمة: ${href}`, 'استخدم رابطاً مطلقاً يبدأ بـ https.');
    else {
      const clean = (u: string) => u.split('#')[0].split('?')[0].replace(/\/+$/, '');
      if (clean(href) !== clean(input.url) && kind !== 'product') {
        add('canonical', 'minor', 'canonical يشير إلى عنوان آخر', `${href} بدلاً من ${input.url}`, 'راجع إن كان ذلك مقصوداً (نسخة أساسية) وإلا اجعل canonical ذاتياً.');
      }
    }
  }
  // ---- mobile ----
  if (!metaContent(meta, 'viewport')) add('viewport', 'major', 'لا يوجد viewport', 'الصفحة غير مهيأة للهاتف.', 'أضف <meta name="viewport" content="width=device-width, initial-scale=1">.');
  // ---- content structure ----
  if (h1s.length === 0) add('h1', 'major', 'لا يوجد H1', 'الصفحة بلا عنوان رئيسي HTML.', 'أضف H1 واحداً يطابق موضوع الصفحة.');
  else if (h1s.length > 1) add('h1', 'minor', 'أكثر من H1', `${h1s.length} عناوين H1: ${h1s.slice(0, 2).join(' / ')}`, 'احتفظ بعنوان H1 واحد وحوّل الباقي إلى H2.');
  if (kind !== 'product' && h2Count === 0) add('headings', 'minor', 'لا أقسام H2', 'الصفحة بلا بنية عناوين فرعية.', 'قسّم المحتوى بأقسام H2 واضحة.');
  if (kind === 'home' || kind === 'tool') {
    if (wordCount < 300) add('words', 'major', 'محتوى رقيق', `النص المرئي ${wordCount} كلمة فقط.`, 'أضف شرحاً وخطوات وأسئلة شائعة (300 كلمة فأكثر) تجيب نية البحث.');
    if (h2Count < 2) add('headings', 'minor', 'بنية محتوى بسيطة', `${h2Count} أقسام H2.`, 'أضف أقساماً: كيف يعمل، خطوات، أسئلة شائعة.');
  }
  // ---- social preview ----
  for (const [key, label, severity] of [
    ['og:title', 'og:title', 'major'], ['og:description', 'og:description', 'major'], ['og:image', 'og:image', 'major'],
    ['og:url', 'og:url', 'minor'], ['og:type', 'og:type', 'minor'], ['og:site_name', 'og:site_name', 'minor'],
  ] as const) {
    if (!metaContent(meta, key)) add('og', severity, `وسم ${label} غائب`, 'معاينة المشاركة على الشبكات الاجتماعية ناقصة.', `أضف <meta property="${key}"> بقيمة صحيحة.`);
  }
  if (!metaContent(meta, 'twitter:card')) add('twitter', 'minor', 'بطاقة Twitter/X غائبة', 'لا يوجد twitter:card.', 'أضف twitter:card=summary_large_image مع صورة وعنوان.');
  if (!metaContent(meta, 'twitter:title') || !metaContent(meta, 'twitter:image')) add('twitter', 'minor', 'حقول Twitter/X ناقصة', 'العنوان أو الصورة غير معرّفين.', 'أضف twitter:title وtwitter:description وtwitter:image.');
  // ---- schema ----
  const blocks = jsonLdBlocks(html);
  if (!blocks.length) add('schema', 'major', 'لا توجد بيانات منظمة', 'لا يوجد JSON-LD صالح على الصفحة.', 'أضف Organization/WebSite للرئيسية، وFAQPage/BreadcrumbList للأدوات، وProduct للمنتجات.');
  else if (blocks.some((b) => b === null)) add('schema', 'major', 'JSON-LD غير صالح', 'كتلة JSON-LD لا تُحلَّل.', 'صحّح صياغة JSON أو أزل الكتلة المعطوبة.');
  else {
    const types = schemaTypes(html);
    const need = kind === 'home' ? ['Organization', 'WebSite'] : kind === 'tool' ? ['FAQPage', 'BreadcrumbList', 'WebApplication'] : kind === 'product' ? ['Product'] : [];
    const missing = need.filter((t) => !types.includes(t));
    if (missing.length) add('schema', missing.includes('Product') ? 'major' : 'minor', 'أنواع بيانات منظمة ناقصة', `المفقود: ${missing.join('، ')} (الموجود: ${types.join('، ') || 'لا شيء'}).`, 'أضف الأنواع المناسبة من بيانات الصفحة الحقيقية فقط.');
    if (kind === 'product') {
      const flat = JSON.stringify(blocks);
      if (!/"priceCurrency"\s*:/.test(flat) || !/"availability"\s*:/.test(flat) || !/"price"\s*:/.test(flat)) {
        add('schema', 'major', 'بيانات المنتج ناقصة', 'Offer بلا price/priceCurrency/availability.', 'أكمل Offer من سعر المنتج وتوفره الحقيقيين.');
      }
    }
    if (/aggregateRating/i.test(JSON.stringify(blocks)) && !/review|rating/i.test(visibleText(html).slice(0, 2000))) {
      add('schema', 'major', 'تقييم منظم بلا مراجعات ظاهرة', 'يوجد aggregateRating دون تقييمات معروضة.', 'أزل التقييم أو اعرض مراجعات حقيقية موثقة.');
    }
  }
  // ---- images ----
  const imgs = [...html.matchAll(/<img\b([^>]*)>/gi)].map((m) => m[1]);
  const noAlt = imgs.filter((attrs) => !/\balt\s*=\s*["'][^"']+["']/i.test(attrs)).length;
  if (noAlt) add('images', noAlt > Math.max(2, imgs.length / 2) ? 'major' : 'minor', 'صور بلا نص بديل', `${noAlt} من ${imgs.length} صورة بلا alt.`, 'أضف alt وصفياً (وفارغاً للزخرفية) مع أبعاد الصورة.');
  // ---- language / hreflang ----
  const htmlTag = html.match(/<html\b([^>]*)>/i)?.[1] || '';
  const lang = htmlTag.match(/\blang\s*=\s*["']([^"']+)["']/i)?.[1] || '';
  if (!lang) add('lang', 'major', 'لا تحدد الصفحة لغتها', 'وسم html بلا lang.', 'أضف lang="ar" وdir="rtl" للصفحة العربية.');
  if (!/\bdir\s*=\s*["'](?:rtl|ltr)["']/i.test(htmlTag)) add('lang', 'minor', 'لا تحدد الصفحة اتجاهها', 'وسم html بلا dir.', 'أضف dir="rtl" للمحتوى العربي.');
  const alts = links(html).filter((l) => l.rel.split(/\s+/).includes('alternate') && l.hreflang);
  if (kind !== 'product' && !alts.some((a) => a.hreflang === 'x-default')) add('hreflang', 'minor', 'لا يوجد x-default', 'لا توجد إشارة hreflang للنسخة الافتراضية.', 'أضف <link rel="alternate" hreflang="x-default"> للصفحة نفسها إذا كانت لغة واحدة تخدم الجميع.');
  if (wordCount > 60 && arabicShare(visibleText(html)) < 0.35) add('lang', 'major', 'لغة المحتوى لا تطابق العربية', 'نسبة الحروف العربية منخفضة في صفحة عربية.', 'راجع اللغة أو حدد لغة الصفحة الصحيحة.');
  // ---- internal links ----
  // Absolute links to the same origin are internal too (the static pages link with their canonical URL).
  const origin = (() => { try { return new URL(input.url).origin; } catch { return ''; } })();
  const internal = [...html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1])
    .filter((href) => {
      if (/^(?:#|mailto:|tel:|javascript:)/i.test(href)) return false;
      try { return new URL(href, input.url).origin === origin; } catch { return false; }
    });
  if (kind !== 'product' && internal.length < 3) add('links', 'minor', 'روابط داخلية قليلة', `${internal.length} روابط داخلية فقط.`, 'أضف روابط إلى الأدوات والمتجر والمحتوى ذي الصلة.');
  // ---- meta keywords (useless, not harmful) ----
  if (metaContent(meta, 'keywords')) add('meta', 'minor', 'وسم keywords غير مستخدم', 'محركات البحث لا تستخدم meta keywords.', 'أزل الوسم أو اتركه؛ لا تعتمد عليه للترتيب.');
  // ---- performance (when known) ----
  if (input.bytes && input.bytes > 250_000) add('html', 'minor', 'HTML كبير', `${Math.round(input.bytes / 1024)} كيلوبايت للصفحة الواحدة.`, 'قلّل المحتوى المضمّن والبيانات غير الضرورية.');
  if (input.ms !== undefined) {
    if (input.ms > 2500) add('latency', 'critical', 'استجابة الصفحة بطيئة جداً', `زمن الاستجابة ${input.ms} مللي.`, 'راجع الاستضافة والتخزين المؤقت؛ استهدف أقل من ثانية للصفحة الرئيسية.');
    else if (input.ms > 1000) add('latency', 'major', 'استجابة الصفحة بطيئة', `زمن الاستجابة ${input.ms} مللي.`, 'فعّل التخزين المؤقت على الحواف وقلّل العمل وقت الطلب.');
  }
  return out;
}

export interface SiteFilesInput {
  robots?: string;
  sitemap?: string;
  llms?: string;
  feed?: string;
  indexNowKeyFile?: string;
  indexNowKey?: string;
  /** Extra URL paths that must be in the sitemap (tool/product samples). */
  expectInSitemap?: string[];
}
export function auditSiteFiles(input: SiteFilesInput): SeoFinding[] {
  const out: SeoFinding[] = [];
  const add = (check: string, severity: Severity, title: string, detail: string, fix: string) =>
    out.push({ id: `${areaOf(check)}:site:${check}`, area: areaOf(check), severity, page: '/', title, detail, fix });
  if (!input.robots) add('robots', 'critical', 'robots.txt غير موجود', 'تعذّر قراءة /robots.txt.', 'انشر robots.txt على الجذر مع خريطة الموقع وبلا حجب للصفحات المهمة.');
  else {
    if (!/sitemap\s*:/i.test(input.robots)) add('robots', 'major', 'robots بلا خريطة موقع', 'لا يوجد سطر Sitemap.', 'أضف Sitemap: https://الموقع/sitemap.xml إلى robots.txt.');
    if (/disallow\s*:\s*\/\s*(?:\r?\n|$)/i.test(input.robots)) add('robots', 'critical', 'robots يحجب الموقع كله', 'Disallow: / يمنع الزحف إلى كل الصفحات.', 'أزل الحجب الكامل؛ اسمح بالصفحات العامة وامنع فقط مسارات الإدارة.');
    if (/(?:user-agent\s*:\s*(?:gptbot|claudebot|perplexitybot|google-extended|ccbot|bingbot|googlebot)[\s\S]{0,120}?disallow\s*:\s*\/\s*(?:\r?\n|$))/i.test(input.robots)) {
      add('robots', 'major', 'robots يحجب زاحفاً مهماً', 'أحد الزواحف البحثية محجوب بالكامل.', 'راجع الحجب: الظهور في البحث والمساعدات يحتاج سماحاً للزواحف المحترمة.');
    }
  }
  if (!input.sitemap) add('sitemap', 'critical', 'sitemap.xml غير موجود', 'تعذّر قراءة خريطة الموقع.', 'أنشئ /sitemap.xml بروابط https مطلقة لكل الصفحات القابلة للفهرسة.');
  else {
    if (!/<urlset\b/i.test(input.sitemap)) add('sitemap', 'major', 'خريطة الموقع ليست urlset', 'الملف لا يبدأ بعنصر urlset.', 'أعد توليد الخريطة بصيغة XML صحيحة.');
    const locs = [...input.sitemap.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => decodeEntities(m[1]));
    if (!locs.length) add('sitemap', 'critical', 'خريطة الموقع فارغة', 'لا روابط داخل الخريطة.', 'أضف الصفحات القابلة للفهرسة وحدّثها عند كل نشر.');
    const relative = locs.filter((loc) => !/^https:\/\//i.test(loc));
    if (relative.length) add('sitemap', 'major', 'روابط غير مطلقة في الخريطة', `${relative.length} روابط لا تبدأ بـ https.`, 'استخدم عناوين مطلقة في <loc>.');
    if (locs.length > 50_000) add('sitemap', 'major', 'خريطة أكبر من الحد', `${locs.length} رابطاً.`, 'قسّمها إلى ملفات وفهرس sitemapindex.');
    for (const path of input.expectInSitemap || []) {
      if (!locs.some((loc) => loc.endsWith(path) || loc.includes(path))) add('sitemap', 'major', 'صفحة مهمة غائبة عن الخريطة', `الصفحة ${path} غير مدرجة.`, 'أضف كل صفحة أدوات ومنتج قابلة للفهرسة إلى الخريطة.');
    }
  }
  if (!input.indexNowKeyFile) add('indexnow', 'major', 'ملف مفتاح IndexNow غير موجود', 'المحركات لا تستطيع التحقق من مفتاح الإرسال السريع.', 'انشر /<key>.txt يحتوي المفتاح نفسه.');
  else if (input.indexNowKey && input.indexNowKeyFile.trim() !== input.indexNowKey) add('indexnow', 'major', 'مفتاح IndexNow لا يطابق الملف', 'محتوى الملف مختلف عن المفتاح المستخدم.', 'اجعل ملف المفتاح يحتوي المفتاح حرفياً.');
  if (!input.llms) add('llms', 'minor', 'llms.txt غير موجود', 'لا ملخص آلي للموقع والمساعدات البحثية.', 'انشر llms.txt يلخص المنصة وأهم الصفحات بصيغة Markdown.');
  if (!input.feed) add('feed', 'minor', 'تغذية RSS غير موجودة', 'فرصة أقل للاكتشاف والاقتباس.', 'انشر feed.xml لأحدث الصفحات والمنتجات.');
  return out;
}

export function auditHeaders(input: { url: string; status?: number; contentType?: string; compression?: string; hsts?: string; cacheControl?: string }): SeoFinding[] {
  const out: SeoFinding[] = [];
  const page = pathOf(input.url);
  const add = (check: string, severity: Severity, title: string, detail: string, fix: string) =>
    out.push({ id: `${areaOf(check)}:${page}:${check}`, area: areaOf(check), severity, page, title, detail, fix });
  if (input.status !== undefined && input.status >= 400) add('status', 'critical', 'الصفحة لا تعمل', `حالة HTTP ${input.status}.`, 'أعد الصفحة إلى حالة 200 أو أزل الرابط من الخريطة.');
  else if (input.status !== undefined && input.status >= 300) add('status', 'major', 'الصفحة تعيد تحويلاً', `حالة HTTP ${input.status}.`, 'استخدم 301 دائماً إلى الوجهة النهائية وتجنب سلاسل التحويل.');
  if (input.contentType && !/text\/html/i.test(input.contentType)) add('headers', 'major', 'نوع المحتوى غير HTML', `content-type: ${input.contentType}`, 'أعد نوع text/html; charset=utf-8 للصفحات.');
  if (!input.compression) add('compression', 'minor', 'لا ضغط للنقل', 'لا يظهر content-encoding.', 'فعّل Brotli أو gzip على الخادم/الحافة.');
  if (!input.hsts) add('security', 'minor', 'HSTS غير مفعّل', 'لا يظهر strict-transport-security.', 'أضف HSTS بعد التأكد من HTTPS كامل.');
  if (input.cacheControl && /no-store/i.test(input.cacheControl) && !/\/api\//.test(page)) add('headers', 'minor', 'منع التخزين المؤقت على صفحة عامة', `cache-control: ${input.cacheControl}`, 'اسمح بتخزين مؤقت قصير للصفحات العامة لتسريعها.');
  return out;
}

const WEIGHT: Record<Severity, number> = { critical: 12, major: 5, minor: 1.5 };
/** 0–100: penalties by severity. A site with no findings scores 100. */
export function scoreFindings(findings: SeoFinding[]): number {
  const penalty = findings.reduce((sum, f) => sum + WEIGHT[f.severity], 0);
  return Math.max(0, Math.min(100, Math.round((100 - penalty) * 10) / 10));
}
export const gradeOf = (score: number) => (score >= 90 ? 'excellent' : score >= 75 ? 'good' : score >= 60 ? 'fair' : 'weak');
export function summarize(findings: SeoFinding[]) {
  const bySeverity = { critical: 0, major: 0, minor: 0 };
  const byArea: Record<string, number> = {};
  for (const f of findings) { bySeverity[f.severity]++; byArea[f.area] = (byArea[f.area] || 0) + 1; }
  return { total: findings.length, bySeverity, byArea };
}
/** Critical first, then major, then by area; unique titles only. */
export function topFixes(findings: SeoFinding[], limit = 6): SeoFinding[] {
  const rank: Record<Severity, number> = { critical: 0, major: 1, minor: 2 };
  const seen = new Set<string>();
  return [...findings].sort((a, b) => rank[a.severity] - rank[b.severity] || a.area.localeCompare(b.area))
    .filter((f) => { const key = `${f.area}:${f.title}`; if (seen.has(key)) return false; seen.add(key); return true; })
    .slice(0, limit);
}
/** The weakest area (most weighted findings) drives which lesson is revisited. */
export function weakestArea(findings: SeoFinding[]): SeoArea | undefined {
  const score: Record<string, number> = {};
  for (const f of findings) score[f.area] = (score[f.area] || 0) + WEIGHT[f.severity];
  return Object.entries(score).sort((a, b) => b[1] - a[1])[0]?.[0] as SeoArea | undefined;
}

// ---------------------------------------------------------------------------
// Guardrails for AI-written copy. Nothing reaches a page before these pass.
// ---------------------------------------------------------------------------
const AI_VENDOR = new RegExp(`\\b(?:${lexicon.vendorNames.join('|')})\\b`, 'i');
const ABSOLUTE_CLAIM = /(?:الأفضل|الأول في|الأولى في|رقم\s*1|رقم واحد|مضمون\s*100|نتائج مضمونة|best in the world|number one|guaranteed)/i;
const FAKE_PROOF = /(?:آلاف العملاء|ملايين العملاء|تقييم\s*4[.,]9|4[.,]9\s*من\s*5|شهادة|حاصل على جائزة|مرخص من|معتمد من)/i;
const LINK = /(?:https?:\/\/|www\.)/i;

export interface CopyCandidate { title: string; description: string; h1?: string; faq?: { q: string; a: string }[] }
export interface CopyRules { minTitle?: number; maxTitle?: number; minDesc?: number; maxDesc?: number; maxFaq?: number; requireFaq?: boolean }
const DEFAULT_RULES: Required<CopyRules> = { minTitle: 25, maxTitle: 60, minDesc: 110, maxDesc: 165, maxFaq: 5, requireFaq: false };

/** Returns the violated rules in Arabic; empty = the copy may be published. */
export function validateSeoCopy(copy: CopyCandidate, rules: CopyRules = {}): string[] {
  const r = { ...DEFAULT_RULES, ...rules };
  const problems: string[] = [];
  const title = (copy.title || '').trim();
  const description = (copy.description || '').trim();
  if (!title) problems.push('العنوان فارغ');
  else if (title.length < r.minTitle || title.length > r.maxTitle) problems.push(`طول العنوان ${title.length} خارج ${r.minTitle}–${r.maxTitle}`);
  if (!description) problems.push('الوصف فارغ');
  else if (description.length < r.minDesc || description.length > r.maxDesc) problems.push(`طول الوصف ${description.length} خارج ${r.minDesc}–${r.maxDesc}`);
  const all = `${title}\n${description}\n${copy.h1 || ''}\n${(copy.faq || []).map((f) => `${f.q} ${f.a}`).join('\n')}`;
  if (AI_VENDOR.test(all)) problems.push('يذكر اسم مورّد أو نموذج ذكاء اصطناعي');
  if (ABSOLUTE_CLAIM.test(all)) problems.push('ادعاء مطلق غير قابل للإثبات');
  if (FAKE_PROOF.test(all)) problems.push('إثبات أو شهادة غير موثقة');
  if (LINK.test(all)) problems.push('يحتوي رابطاً خارجياً');
  if (/<[a-z][^>]*>/i.test(all)) problems.push('يحتوي HTML خاماً');
  if (arabicShare(title + description) < 0.5) problems.push('العربية ضعيفة في العنوان أو الوصف');
  const words = WORDS(`${title} ${description}`.toLowerCase()).filter((w) => w.length > 3);
  const counts = new Map<string, number>();
  for (const w of words) counts.set(w, (counts.get(w) || 0) + 1);
  if ([...counts.values()].some((n) => n >= 4)) problems.push('تكرار كلمة مفتاحية بشكل مفرط');
  if (title && title.toLowerCase() === description.toLowerCase()) problems.push('العنوان والوصف متطابقان');
  const faq = copy.faq || [];
  if (r.requireFaq && faq.length < 2) problems.push('الأسئلة الشائعة أقل من سؤالين');
  if (faq.length > r.maxFaq) problems.push(`الأسئلة الشائعة أكثر من ${r.maxFaq}`);
  for (const item of faq) {
    if (!item.q?.trim() || !item.a?.trim()) problems.push('سؤال أو جواب فارغ');
    else if (item.q.length > 120 || item.q.length < 8) problems.push('طول السؤال غير مناسب');
    else if (item.a.length > 500 || item.a.length < 40) problems.push('طول الجواب غير مناسب');
  }
  return [...new Set(problems)];
}

/** Escapes text for safe inclusion in HTML (AI copy is plain text only). */
export const escapeHtml = (text: unknown) => String(text ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
