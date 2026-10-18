/**
 * Everything «منارة شاهين» publishes as files: sitemap, robots, llms.txt, RSS, the IndexNow key,
 * verification files, the static tool landing pages, and the home page's head tags. Pure string
 * builders, so a test can prove each file before it reaches production.
 */
import { absoluteUrl, SEO_AGENT, SITE } from './site';
import { HOME_PAGE, SEO_PAGES, type SeoFaq, type SeoPageDef } from './pages';
import { escapeHtml, schemaTypes } from './audit';
import type { SeoPageCopy } from './agentState';
import lexicon from './lexicon.json';

export const escapeXml = (text: unknown) => String(text ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export interface SitemapUrl { loc: string; lastmod?: string; changefreq?: string; priority?: number }
export interface ProductRef { id: string | number; slug: string; updatedAt?: string }

export function buildSitemapEntries(input: { siteUrl: string; products?: ProductRef[]; now?: Date; includeTools?: boolean }): SitemapUrl[] {
  const now = (input.now || new Date()).toISOString();
  const entries: SitemapUrl[] = [{ loc: input.siteUrl, lastmod: now, changefreq: 'daily', priority: 1 }];
  if (input.includeTools !== false) {
    entries.push({ loc: absoluteUrl('tools/', input.siteUrl), lastmod: now, changefreq: 'weekly', priority: 0.8 });
    for (const page of SEO_PAGES) entries.push({ loc: absoluteUrl(page.path, input.siteUrl), lastmod: now, changefreq: page.changeFreq, priority: page.priority });
    entries.push({ loc: absoluteUrl('p/', input.siteUrl), lastmod: now, changefreq: 'daily', priority: 0.8 });
  }
  for (const p of input.products || []) {
    entries.push({
      loc: absoluteUrl(`p/${p.slug}.html`, input.siteUrl),
      lastmod: p.updatedAt && !Number.isNaN(Date.parse(p.updatedAt)) ? new Date(p.updatedAt).toISOString() : now,
      changefreq: 'weekly', priority: 0.7,
    });
  }
  const seen = new Set<string>();
  return entries.filter((e) => (seen.has(e.loc) ? false : (seen.add(e.loc), true)));
}

export function renderSitemap(entries: SitemapUrl[]): string {
  const urls = entries.map((e) => [
    '  <url>',
    `    <loc>${escapeXml(e.loc)}</loc>`,
    e.lastmod ? `    <lastmod>${escapeXml(e.lastmod)}</lastmod>` : '',
    e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : '',
    e.priority !== undefined ? `    <priority>${Math.max(0, Math.min(1, e.priority)).toFixed(1)}</priority>` : '',
    '  </url>',
  ].filter(Boolean).join('\n')).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** Sitemap index for very large catalogs (one file per 45,000 URLs). */
export function renderSitemapIndex(parts: string[], siteUrl: string, now = new Date()): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${parts.map((part) => `  <sitemap><loc>${escapeXml(absoluteUrl(part, siteUrl))}</loc><lastmod>${now.toISOString()}</lastmod></sitemap>`).join('\n')}\n</sitemapindex>\n`;
}

/**
 * robots.txt: crawlers that respect it may read the public site; the API and admin are closed.
 * Search and AI crawlers are allowed explicitly — hiding from AI assistants only removes visibility.
 */
export function renderRobots(siteUrl: string): string {
  return [
    '# robots.txt — «صمم عطرك مع شام»',
    '# Public pages are open to search and AI crawlers. The API and admin are not content.',
    '',
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    '',
    'User-agent: Googlebot',
    'Allow: /',
    '',
    'User-agent: Bingbot',
    'Allow: /',
    '',
    '# AI search crawlers are welcome: discovery needs them.',
    ...lexicon.aiCrawlers.flatMap((bot) => [`User-agent: ${bot}`, 'Allow: /', '']),
    `Sitemap: ${absoluteUrl('sitemap.xml', siteUrl)}`,
    `# llms.txt: ${absoluteUrl('llms.txt', siteUrl)}`,
    `# Feed: ${absoluteUrl('feed.xml', siteUrl)}`,
    '',
  ].join('\n');
}

/** llms.txt — a concise, honest map for AI assistants and answer engines. */
export function renderLlmsTxt(siteUrl: string, products: ProductRef[] = []): string {
  return [
    `# ${SITE.nameAr}`,
    '',
    `> ${SITE.summaryAr}`,
    '',
    `${SITE.summaryEn}`,
    '',
    '## ما تجده هنا / What this site offers',
    ...SEO_PAGES.map((p) => `- [${p.h1}](${absoluteUrl(p.path, siteUrl)}): ${p.description}`),
    '',
    '## المتجر / Store',
    `- [فهرس المنتجات](${absoluteUrl('p/', siteUrl)}): ${products.length ? `${products.length} منتجاً` : 'منتجات متجر شام'} بالصور والأسعار والنوتات العطرية.`,
    '',
    '## خريطة الموقع / Resources',
    `- [sitemap.xml](${absoluteUrl('sitemap.xml', siteUrl)}): كل الصفحات العامة.`,
    `- [robots.txt](${absoluteUrl('robots.txt', siteUrl)}): قواعد الزحف والسماح للزواحف البحثية.`,
    '',
    '## معلومات الناشر / Publisher',
    `- ${SITE.nameAr}: ${SITE.summaryAr}`,
    `- المسؤول عن المحتوى والتحسين: «${SEO_AGENT.reportsToAr}» و«${SEO_AGENT.nameAr}» (${SEO_AGENT.roleAr}).`,
    `- [الحساب الرسمي](${SITE.github})`,
    '',
    '## قواعد الاستخدام / Usage',
    '- المحتوى التحريري والملخصات ملك لمنصة شام؛ اقتبس مع رابط المصدر واسم المنصة.',
    '- الأسعار والتوفر تُقرأ من صفحة المنتج وقت الزيارة، لا من أي ملخص آلي.',
    '- لا تُقدَّم أي معلومات هنا كنصيحة طبية أو ضمان سلامة.',
    '',
  ].join('\n');
}

export function renderFeed(input: { siteUrl: string; products?: ProductRef[]; now?: Date }): string {
  const now = input.now || new Date();
  const items: { title: string; link: string; description: string; date: string }[] = [
    ...SEO_PAGES.slice(0, 8).map((p) => ({ title: p.h1, link: absoluteUrl(p.path, input.siteUrl), description: p.description, date: now.toISOString() })),
    ...(input.products || []).slice(0, 20).map((p) => ({ title: `${(p as ProductRef & { nameAr?: string }).nameAr || p.slug} | متجر شام`, link: absoluteUrl(`p/${p.slug}.html`, input.siteUrl), description: 'منتج من متجر شام مع الصور والنوتات والسعر.', date: p.updatedAt && !Number.isNaN(Date.parse(p.updatedAt)) ? p.updatedAt : now.toISOString() })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${escapeXml(SITE.nameAr)}</title>
<link>${escapeXml(input.siteUrl)}</link>
<description>${escapeXml(SITE.summaryAr)}</description>
<language>ar</language>
<lastBuildDate>${now.toUTCString()}</lastBuildDate>
${items.map((i) => `<item><title>${escapeXml(i.title)}</title><link>${escapeXml(i.link)}</link><description>${escapeXml(i.description)}</description><pubDate>${new Date(i.date).toUTCString()}</pubDate><guid>${escapeXml(i.link)}</guid></item>`).join('\n')}
</channel></rss>
`;
}

/** Google/Bing verification files from environment values (nothing invented when unset). */
export function verificationFiles(env: Record<string, string | undefined>): { name: string; content: string }[] {
  const files: { name: string; content: string }[] = [];
  const google = env.GOOGLE_SITE_VERIFICATION?.trim();
  if (google && /^[A-Za-z0-9_-]{10,120}$/.test(google)) files.push({ name: `google${google}.html`, content: `google-site-verification: google${google}.html` });
  const bing = env.BING_SITE_VERIFICATION?.trim();
  if (bing && /^[A-Za-z0-9_-]{10,120}$/.test(bing)) files.push({ name: 'BingSiteAuth.xml', content: `<?xml version="1.0"?>\n<users><user>${bing}</user></users>\n` });
  return files;
}

/** IndexNow body: host + key + key location + the URLs that changed. */
export function indexNowBody(siteUrl: string, urls: string[], key: string = SITE.indexNowKey): Record<string, unknown> {
  const origin = new URL(siteUrl);
  return { host: origin.host, key, keyLocation: absoluteUrl(`${key}.txt`, siteUrl), urlList: [...new Set(urls)].slice(0, 10_000) };
}

// ---------------------------------------------------------------------------
// Static tool landing pages
// ---------------------------------------------------------------------------
const STYLE = `
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,"Noto Naskh Arabic",serif;background:#faf7f2;color:#1c1917;line-height:1.85}
a{color:#b45309}header{background:#1c1917;color:#fbbf24;padding:12px 20px;display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;align-items:center}
header a{color:#fbbf24;text-decoration:none;font-weight:700}header nav{display:flex;gap:14px;font-size:.9rem;flex-wrap:wrap}
main{max-width:900px;margin:0 auto;padding:24px 20px 10px}
.crumb{font-size:.8rem;color:#78716c;margin-bottom:12px}.lede{font-size:1.06rem;color:#44403c}
h1{font-size:clamp(1.55rem,4vw,2.35rem);line-height:1.35;margin:.2em 0 .4em;color:#1c1917}
h2{font-size:1.25rem;margin-top:2em;color:#92400e}h3{font-size:1.05rem;margin-bottom:.2em}
.hero{background:linear-gradient(135deg,#fff7ed,#fef3c7);border:1px solid #fde68a;border-radius:22px;padding:22px 22px 14px;margin-bottom:20px}
.cta{display:inline-block;background:#d97706;color:#fff;padding:12px 22px;border-radius:12px;text-decoration:none;font-weight:800;margin:8px 8px 8px 0}
.cta.alt{background:#1c1917}.small{font-size:.82rem;color:#78716c}
.steps{list-style:none;padding:0;display:grid;gap:12px}.steps li{background:#fff;border:1px solid #e7e5e4;border-radius:16px;padding:14px 16px}
.steps b{display:block;color:#92400e;margin-bottom:2px}.num{display:inline-flex;width:26px;height:26px;border-radius:50%;background:#fef3c7;color:#92400e;align-items:center;justify-content:center;font-weight:800;margin-inline-end:6px}
.faq{background:#fff;border:1px solid #e7e5e4;border-radius:16px;padding:6px 16px;margin-top:10px}
.faq details{border-bottom:1px solid #f5f5f4;padding:10px 0}.faq details:last-child{border-bottom:0}.faq summary{font-weight:700;cursor:pointer}.faq p{margin:.5em 0 .3em;color:#44403c}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin-top:12px}.card{display:block;background:#fff;border:1px solid #e7e5e4;border-radius:14px;padding:14px;text-decoration:none;color:inherit}.card b{display:block;color:#1c1917}.card span{font-size:.85rem;color:#78716c}
.note{background:#fff7ed;border:1px solid #fed7aa;border-radius:14px;padding:12px 16px;font-size:.9rem;margin-top:18px}
footer{max-width:900px;margin:26px auto 0;padding:18px 20px;color:#78716c;font-size:.85rem;border-top:1px solid #e7e5e4}
footer nav{display:flex;gap:14px;flex-wrap:wrap;margin-top:6px}
@media(max-width:600px){main{padding:16px 14px 4px}.hero{padding:16px}header{padding:10px 14px}}
`;

const appUrl = (siteUrl: string, tab: string) => `${siteUrl}#${tab}`;

function faqFor(page: SeoPageDef, override?: SeoPageCopy): SeoFaq[] {
  const list = override?.faq?.length ? override.faq : page.faq;
  return list.slice(0, 5);
}

function breadcrumbLd(page: SeoPageDef, siteUrl: string) {
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE.nameAr, item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'الأدوات', item: absoluteUrl('tools/', siteUrl) },
      { '@type': 'ListItem', position: 3, name: page.h1, item: absoluteUrl(page.path, siteUrl) },
    ],
  };
}

export interface ToolPageOptions { siteUrl: string; override?: SeoPageCopy; now?: Date }
export function renderToolPage(page: SeoPageDef, options: ToolPageOptions): string {
  const siteUrl = options.siteUrl;
  const now = options.now || new Date();
  const copy = options.override;
  const title = copy?.title || `${page.title}`;
  const description = copy?.description || page.description;
  const h1 = copy?.h1 || page.h1;
  const faq = faqFor(page, copy);
  const url = absoluteUrl(page.path, siteUrl);
  const image = absoluteUrl(SITE.ogImage, siteUrl);
  const related = page.related.map((id) => SEO_PAGES.find((p) => p.id === id)).filter((p): p is SeoPageDef => Boolean(p));
  const ld: unknown[] = [
    breadcrumbLd(page, siteUrl),
    {
      '@context': 'https://schema.org', '@type': 'WebApplication', name: h1, url,
      applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any', inLanguage: 'ar',
      description, isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'EGP' },
      publisher: { '@type': 'Organization', name: SITE.nameAr, url: siteUrl },
    },
    ...(faq.length ? [{
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    }] : []),
  ];
  const jsonLd = ld.map((block) => `<script type="application/ld+json" data-seo-agent="true">${JSON.stringify(block).replace(/</g, '\\u003c')}</script>`).join('');

  return `<!doctype html>
<html lang="ar" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">
<link rel="canonical" href="${escapeHtml(url)}">
<link rel="alternate" hreflang="ar" href="${escapeHtml(url)}">
<link rel="alternate" hreflang="x-default" href="${escapeHtml(url)}">
<meta property="og:type" content="article"><meta property="og:site_name" content="${escapeHtml(SITE.nameAr)}"><meta property="og:locale" content="${SITE.locale}">
<meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(url)}"><meta property="og:image" content="${escapeHtml(image)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="${SITE.twitterCard}"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${escapeHtml(image)}">
<meta name="theme-color" content="${SITE.themeColor}">
<link rel="alternate" type="application/rss+xml" title="${escapeHtml(SITE.nameAr)}" href="${escapeHtml(absoluteUrl('feed.xml', siteUrl))}">
<link rel="icon" href="${escapeHtml(absoluteUrl('favicon.svg', siteUrl))}" type="image/svg+xml">
${jsonLd}
<style>${STYLE}</style>
</head><body>
<header><a href="${escapeHtml(siteUrl)}">${escapeHtml(SITE.nameAr)}</a><nav><a href="${escapeHtml(absoluteUrl('tools/', siteUrl))}">كل الأدوات</a><a href="${escapeHtml(appUrl(siteUrl, 'store'))}">المتجر</a><a href="${escapeHtml(appUrl(siteUrl, 'master_ai'))}">الخبير شاهين</a></nav></header>
<main>
<nav class="crumb" aria-label="مسار التنقل"><a href="${escapeHtml(siteUrl)}">الرئيسية</a> ← <a href="${escapeHtml(absoluteUrl('tools/', siteUrl))}">الأدوات</a> ← ${escapeHtml(h1)}</nav>
<div class="hero">
<h1>${escapeHtml(h1)}</h1>
<p class="lede">${escapeHtml(page.intro[0] || description)}</p>
<a class="cta" href="${escapeHtml(appUrl(siteUrl, page.tab))}">افتح ${escapeHtml(page.h1)} في المعمل</a>
<a class="cta alt" href="${escapeHtml(absoluteUrl('tools/', siteUrl))}">تصفح كل أدوات شام</a>
<p class="small">مجاناً وبلا تسجيل · يعمل على الهاتف والحاسوب · جزء من ${escapeHtml(SITE.nameAr)}</p>
</div>
<section><h2>لماذا هذه الأداة؟</h2>
${(page.intro.slice(1).length ? page.intro.slice(1) : page.intro).map((p) => `<p>${escapeHtml(p)}</p>`).join('')}
</section>
<section><h2>كيف تستخدمها خطوة بخطوة</h2>
<ol class="steps">${page.steps.map((s, i) => `<li><b><span class="num">${i + 1}</span>${escapeHtml(s.title)}</b>${escapeHtml(s.text)}</li>`).join('')}</ol>
</section>
<section><h2>أسئلة شائعة</h2>
<div class="faq">${faq.map((f) => `<details><summary>${escapeHtml(f.q)}</summary><p>${escapeHtml(f.a)}</p></details>`).join('')}</div>
</section>
<div class="note"><b>من كتابة من؟</b> هذه الصفحة جزء من ${escapeHtml(SITE.nameAr)}، تُراجع بياناتها وأدواتها تحت إشراف «${escapeHtml(SEO_AGENT.reportsToAr)}». الحسابات والنصائح إرشادية، والاختبار على الجلد أو بطاقة سلامة المورد هو المرجع النهائي.</div>
${related.length ? `<section><h2>أدوات مرتبطة</h2><div class="cards">${related.map((r) => `<a class="card" href="${escapeHtml(absoluteUrl(r.path, siteUrl))}"><b>${escapeHtml(r.h1)}</b><span>${escapeHtml(r.description.slice(0, 110))}…</span></a>`).join('')}</div></section>` : ''}
<p class="small">آخر تحديث: ${escapeHtml(now.toISOString().slice(0, 10))} · <a href="${escapeHtml(appUrl(siteUrl, 'store'))}">متجر شام</a> · <a href="${escapeHtml(absoluteUrl('p/', siteUrl))}">كل المنتجات</a></p>
</main>
<footer><b>${escapeHtml(SITE.nameAr)}</b> — ${escapeHtml(SITE.summaryAr)}
<nav><a href="${escapeHtml(siteUrl)}">الرئيسية</a><a href="${escapeHtml(absoluteUrl('tools/', siteUrl))}">الأدوات</a><a href="${escapeHtml(appUrl(siteUrl, 'perfume_news'))}">أخبار العطور</a><a href="${escapeHtml(absoluteUrl('sitemap.xml', siteUrl))}">خريطة الموقع</a><a href="${escapeHtml(absoluteUrl('llms.txt', siteUrl))}">llms.txt</a></nav>
</footer>
</body></html>
`;
}

export function renderToolsIndex(pages: SeoPageDef[], options: { siteUrl: string; now?: Date }): string {
  const siteUrl = options.siteUrl;
  const now = options.now || new Date();
  const url = absoluteUrl('tools/', siteUrl);
  const title = 'أدوات تركيب العطور في شام: حاسبات وأدلة مجانية';
  const description = 'كل أدوات معمل شام في مكان واحد: تركيب العطر، تخفيف الكحول، الهرم العطري، التعتيق، التكلفة، المواد الخام، والمتجر. ابدأ مجاناً.';
  const ld = [
    { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url, description, inLanguage: 'ar', isPartOf: { '@type': 'WebSite', name: SITE.nameAr, url: siteUrl } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: SITE.nameAr, item: siteUrl }, { '@type': 'ListItem', position: 2, name: 'الأدوات', item: url }] },
    { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: pages.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.h1, url: absoluteUrl(p.path, siteUrl) })) },
  ];
  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${escapeHtml(url)}">
<link rel="alternate" hreflang="ar" href="${escapeHtml(url)}"><link rel="alternate" hreflang="x-default" href="${escapeHtml(url)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="${escapeHtml(SITE.nameAr)}"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(url)}"><meta property="og:image" content="${escapeHtml(absoluteUrl(SITE.ogImage, siteUrl))}">
<meta name="twitter:card" content="${SITE.twitterCard}"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${escapeHtml(absoluteUrl(SITE.ogImage, siteUrl))}">
<meta name="theme-color" content="${SITE.themeColor}"><link rel="icon" href="${escapeHtml(absoluteUrl('favicon.svg', siteUrl))}" type="image/svg+xml">
${ld.map((block) => `<script type="application/ld+json" data-seo-agent="true">${JSON.stringify(block).replace(/</g, '\\u003c')}</script>`).join('')}
<style>${STYLE}</style></head><body>
<header><a href="${escapeHtml(siteUrl)}">${escapeHtml(SITE.nameAr)}</a><nav><a href="${escapeHtml(appUrl(siteUrl, 'store'))}">المتجر</a><a href="${escapeHtml(appUrl(siteUrl, 'master_ai'))}">الخبير شاهين</a></nav></header>
<main><nav class="crumb"><a href="${escapeHtml(siteUrl)}">الرئيسية</a> ← الأدوات</nav>
<div class="hero"><h1>أدوات معمل شام</h1><p class="lede">${escapeHtml(description)}</p><p class="small">${pages.length} أداة ودليل مجاني · تُفتح داخل المنصة وتحفظ نتائجك على جهازك.</p></div>
<h2>الأدوات المتاحة</h2>
<div class="cards">${pages.map((p) => `<a class="card" href="${escapeHtml(absoluteUrl(p.path, siteUrl))}"><b>${escapeHtml(p.h1)}</b><span>${escapeHtml(p.description)}</span></a>`).join('')}</div>
<h2>لماذا أدوات شام؟</h2>
<p>كل أداة هنا لها صفحة كاملة تشرح خطواتها وأسئلتها الشائعة، حتى تقرأ قبل أن تجرب — وحتى يجدها محرك البحث بسهولة. الحسابات تجري داخل متصفحك، والنتائج تُحفظ على جهازك، ولا تحتاج إلى تسجيل. ابدأ بالحاسبة التي تناسب مرحلتك: تصميم التركيبة، ثم الهرم العطري، ثم التعتيق والتكلفة، وأخيراً اختيار الخامات أو منتج جاهز من المتجر.</p>
<div class="note">نصيحة: افتح أي أداة في صفحتها الكاملة لترى الخطوات والأسئلة الشائعة قبل البدء — ثم عُد إلى المعمل لتطبيقها.</div>
</main>
<footer><b>${escapeHtml(SITE.nameAr)}</b> — ${escapeHtml(SITE.summaryAr)}<nav><a href="${escapeHtml(siteUrl)}">الرئيسية</a><a href="${escapeHtml(absoluteUrl('p/', siteUrl))}">المنتجات</a><a href="${escapeHtml(absoluteUrl('sitemap.xml', siteUrl))}">خريطة الموقع</a></nav> آخر تحديث: ${escapeHtml(now.toISOString().slice(0, 10))}</footer>
</body></html>
`;
}

// ---------------------------------------------------------------------------
// Home page head (build-time injection)
// ---------------------------------------------------------------------------
export interface HomeHeadOptions { siteUrl: string; override?: SeoPageCopy; env?: Record<string, string | undefined>; now?: Date }
export function renderHomeHead(options: HomeHeadOptions): string {
  const { siteUrl, override } = options;
  const title = override?.title || HOME_PAGE.title;
  const description = override?.description || HOME_PAGE.description;
  const image = absoluteUrl(SITE.ogImage, siteUrl);
  const google = options.env?.GOOGLE_SITE_VERIFICATION?.trim();
  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'Organization', '@id': `${siteUrl}#organization`,
      name: SITE.nameAr, alternateName: SITE.nameEn, url: siteUrl, logo: absoluteUrl('favicon.svg', siteUrl), image,
      sameAs: [SITE.github], description: SITE.summaryAr, inLanguage: 'ar',
    },
    {
      '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${siteUrl}#website`,
      name: SITE.nameAr, alternateName: SITE.nameEn, url: siteUrl, inLanguage: ['ar', 'en'],
      publisher: { '@id': `${siteUrl}#organization` }, description, about: SITE.summaryAr,
    },
    {
      '@context': 'https://schema.org', '@type': 'WebApplication', name: SITE.nameAr, url: siteUrl,
      applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any', inLanguage: 'ar',
      description, isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'EGP' },
      publisher: { '@id': `${siteUrl}#organization` },
    },
    {
      '@context': 'https://schema.org', '@type': 'ItemList', name: 'أدوات منصة شام',
      itemListElement: SEO_PAGES.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.h1, url: absoluteUrl(p.path, siteUrl) })),
    },
  ];
  return `<!--seo-agent:head:start-->
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">
<link rel="canonical" href="${escapeHtml(siteUrl)}">
<link rel="alternate" hreflang="ar" href="${escapeHtml(siteUrl)}">
<link rel="alternate" hreflang="x-default" href="${escapeHtml(siteUrl)}">
<link rel="alternate" type="application/rss+xml" title="${escapeHtml(SITE.nameAr)}" href="${escapeHtml(absoluteUrl('feed.xml', siteUrl))}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${escapeHtml(SITE.nameAr)}">
<meta property="og:locale" content="${SITE.locale}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(siteUrl)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="${SITE.twitterCard}">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(image)}">
<meta name="theme-color" content="${SITE.themeColor}">
${google ? `<meta name="google-site-verification" content="${escapeHtml(google)}">` : ''}
${ld.map((block) => `<script type="application/ld+json" data-seo-agent="true">${JSON.stringify(block).replace(/</g, '\\u003c')}</script>`).join('\n')}
<!--seo-agent:head:end-->`;
}

/**
 * Replaces the managed head block (and the old title/description from the source template) with
 * the current one. Idempotent: running it twice gives the same HTML.
 */
export function injectHomeHead(html: string, options: HomeHeadOptions): string {
  const block = renderHomeHead(options);
  let out = html.replace(/\n?<!--seo-agent:head:start-->[\s\S]*?<!--seo-agent:head:end-->\n?/i, '');
  out = out.replace(/<title[^>]*>[\s\S]*?<\/title>/i, '');
  out = out.replace(/<meta\s+name=["']description["'][^>]*>/gi, '');
  out = out.replace(/<meta\s+name=["']robots["'][^>]*>/gi, '');
  out = out.replace(/<link\s+rel=["']canonical["'][^>]*>/gi, '');
  out = out.replace(/<link\s+rel=["']alternate["'][^>]*hreflang=["'][^"']+["'][^>]*>/gi, '');
  out = out.replace(/<link\s+rel=["']alternate["'][^>]*type=["']application\/rss\+xml["'][^>]*>/gi, '');
  out = out.replace(/<meta\s+name=["']theme-color["'][^>]*>/gi, '');
  out = out.replace(/<meta\s+property=["']og:[^"']+["'][^>]*>/gi, '');
  out = out.replace(/<meta\s+name=["']twitter:[^"']+["'][^>]*>/gi, '');
  out = out.replace(/<meta\s+name=["']google-site-verification["'][^>]*>/gi, '');
  out = out.replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*data-seo-agent=["']true["'][^>]*>[\s\S]*?<\/script>/gi, '');
  // A static fallback title/description in noscript content must survive; only head tags were removed above.
  if (/<\/head>/i.test(out)) out = out.replace(/<\/head>/i, `${block}\n</head>`);
  else out = `${block}\n${out}`;
  return out;
}

/** What the build learned, kept next to the generated files for the agent and the admin. */
export function renderSeoBuildReport(input: { siteUrl: string; pages: number; products: number; sitemapUrls: number; now?: Date }) {
  return JSON.stringify({
    version: 1,
    generatedAt: (input.now || new Date()).toISOString(),
    siteUrl: input.siteUrl,
    agent: SEO_AGENT.nameAr,
    toolPages: input.pages,
    products: input.products,
    sitemapUrls: input.sitemapUrls,
    files: ['robots.txt', 'sitemap.xml', 'feed.xml', 'llms.txt', `${SITE.indexNowKey}.txt`, 'tools/index.html', ...SEO_PAGES.map((p) => p.path)],
  }, null, 1) + '\n';
}

/** Counts the structured-data types in a generated page (used by the build self-check). */
export function pageSchemaTypes(html: string): string[] { return schemaTypes(html); }
