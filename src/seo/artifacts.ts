/**
 * Everything «منارة شاهين» publishes as files: sitemap, robots, llms.txt, RSS, the IndexNow key,
 * verification files, the static tool landing pages, and the home page's head tags. Pure string
 * builders, so a test can prove each file before it reaches production.
 */
import { absoluteUrl, SEO_AGENT, SITE, socialLinks } from './site';
import { WEBSUB_DEFAULT_HUB, webSubLinks } from './discovery';
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
    entries.push({ loc: absoluteUrl('media/', input.siteUrl), lastmod: now, changefreq: 'monthly', priority: 0.6 });
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
    `Sitemap: ${absoluteUrl('feed.xml', siteUrl)}`,
    '# The RSS feed is listed as a second sitemap: search engines accept feeds as sitemaps.',
    `# llms.txt: ${absoluteUrl('llms.txt', siteUrl)}`,
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
    `- [feed.xml](${absoluteUrl('feed.xml', siteUrl)}): خلاصة RSS لأحدث الأدوات والمنتجات.`,
    `- [الملف الإعلامي](${absoluteUrl('media/', siteUrl)}): نصوص جاهزة للاقتباس وبطاقات المشاركة والهوية الرسمية.`,
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

export function renderFeed(input: { siteUrl: string; products?: ProductRef[]; now?: Date; hub?: string }): string {
  const now = input.now || new Date();
  const items: { title: string; link: string; description: string; date: string }[] = [
    ...SEO_PAGES.slice(0, 8).map((p) => ({ title: p.h1, link: absoluteUrl(p.path, input.siteUrl), description: p.description, date: now.toISOString() })),
    ...(input.products || []).slice(0, 20).map((p) => ({ title: `${(p as ProductRef & { nameAr?: string }).nameAr || p.slug} | متجر شام`, link: absoluteUrl(`p/${p.slug}.html`, input.siteUrl), description: 'منتج من متجر شام مع الصور والنوتات والسعر.', date: p.updatedAt && !Number.isNaN(Date.parse(p.updatedAt)) ? p.updatedAt : now.toISOString() })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
<title>${escapeXml(SITE.nameAr)}</title>
<link>${escapeXml(input.siteUrl)}</link>
<description>${escapeXml(SITE.summaryAr)}</description>
<language>ar</language>
<lastBuildDate>${now.toUTCString()}</lastBuildDate>
${webSubLinks(absoluteUrl('feed.xml', input.siteUrl), input.hub || WEBSUB_DEFAULT_HUB)}
${items.map((i) => `<item><title>${escapeXml(i.title)}</title><link>${escapeXml(i.link)}</link><description>${escapeXml(i.description)}</description><pubDate>${new Date(i.date).toUTCString()}</pubDate><guid>${escapeXml(i.link)}</guid></item>`).join('\n')}
</channel></rss>
`;
}

/** Google/Bing/Yandex verification files from environment values (nothing invented when unset). */
export function verificationFiles(env: Record<string, string | undefined>): { name: string; content: string }[] {
  const files: { name: string; content: string }[] = [];
  // The site's own Search Console token is committed, so every build serves the verification file
  // even when the environment is empty. A valid env token (another property) wins; junk is ignored
  // instead of dropping verification altogether.
  const googleToken = env.GOOGLE_SITE_VERIFICATION?.trim() || '';
  const google = /^[A-Za-z0-9_-]{10,120}$/.test(googleToken) ? googleToken : SITE.googleVerification;
  if (google && /^[A-Za-z0-9_-]{10,120}$/.test(google)) files.push({ name: `google${google}.html`, content: `google-site-verification: google${google}.html` });
  const bing = env.BING_SITE_VERIFICATION?.trim();
  if (bing && /^[A-Za-z0-9_-]{10,120}$/.test(bing)) files.push({ name: 'BingSiteAuth.xml', content: `<?xml version="1.0"?>\n<users><user>${bing}</user></users>\n` });
  const yandex = env.YANDEX_SITE_VERIFICATION?.trim();
  if (yandex && /^[A-Za-z0-9_-]{8,120}$/.test(yandex)) {
    files.push({
      name: `yandex_${yandex}.html`,
      content: `<html>\n    <head>\n        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">\n    </head>\n    <body>Verification: ${yandex}</body>\n</html>\n`,
    });
  }
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
.share-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;background:#fff;border:1px solid #e7e5e4;border-radius:16px;padding:12px 16px;margin:16px 0}
.share-bar b{color:#92400e;margin-inline-end:6px;font-size:.92rem}
.share-btn{display:inline-flex;align-items:center;gap:6px;background:#faf7f2;border:1px solid #d6d3d1;color:#1c1917;padding:6px 14px;border-radius:999px;text-decoration:none;font-size:.86rem;font-weight:700;cursor:pointer;font-family:inherit}
.share-btn:hover{border-color:#d97706;background:#fff7ed;color:#92400e}
.copy-box{background:#fff;border:1px solid #e7e5e4;border-radius:14px;padding:14px 16px;margin-top:10px}
.copy-box pre{white-space:pre-wrap;word-break:break-word;background:#faf7f2;border:1px solid #e7e5e4;border-radius:10px;padding:10px 12px;margin:8px 0;font-size:.88rem;font-family:inherit}
footer{max-width:900px;margin:26px auto 0;padding:18px 20px;color:#78716c;font-size:.85rem;border-top:1px solid #e7e5e4}
footer nav{display:flex;gap:14px;flex-wrap:wrap;margin-top:6px}
@media(max-width:600px){main{padding:16px 14px 4px}.hero{padding:16px}header{padding:10px 14px}}
`;

const appUrl = (siteUrl: string, tab: string) => `${siteUrl}#${tab}`;
const PIN_TOOLS = new Set(['concentration', 'alcohol', 'maceration_simulator']);

function renderShareBar(page: SeoPageDef, h1: string, description: string, url: string, siteUrl: string): string {
  const shareText = `${h1} — ${description} (${SITE.nameAr})`;
  const wa = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${url}`)}`;
  const tg = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`;
  const xUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`;
  const pinMedia = absoluteUrl(PIN_TOOLS.has(page.id) ? `og/pin-${page.id}.png` : `og/${page.id}.png`, siteUrl);
  const pin = `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&media=${encodeURIComponent(pinMedia)}&description=${encodeURIComponent(shareText)}`;
  return `<div class="share-bar" aria-label="مشاركة الأداة"><b>شارك الأداة:</b>`
    + `<a class="share-btn" href="${escapeHtml(wa)}" target="_blank" rel="noopener noreferrer">واتساب</a>`
    + `<a class="share-btn" href="${escapeHtml(tg)}" target="_blank" rel="noopener noreferrer">تلجرام</a>`
    + `<a class="share-btn" href="${escapeHtml(xUrl)}" target="_blank" rel="noopener noreferrer">X / تويتر</a>`
    + `<a class="share-btn" href="${escapeHtml(pin)}" target="_blank" rel="noopener noreferrer">بينترست</a>`
    + `<button type="button" class="share-btn" data-copy-url="${escapeHtml(url)}" onclick="navigator.clipboard&&navigator.clipboard.writeText(this.getAttribute('data-copy-url'));this.textContent='تم نسخ الرابط ✓'">نسخ الرابط</button>`
    + `</div>`;
}

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
  const image = absoluteUrl(`og/${page.id}.png`, siteUrl);
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
<meta property="og:url" content="${escapeHtml(url)}"><meta property="og:image" content="${escapeHtml(image)}"><meta property="og:image:alt" content="${escapeHtml(h1)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
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
${renderShareBar(page, h1, description, url, siteUrl)}
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
<p class="small">آخر تحديث: ${escapeHtml(now.toISOString().slice(0, 10))} · <a href="${escapeHtml(appUrl(siteUrl, 'store'))}">متجر شام</a> · <a href="${escapeHtml(absoluteUrl('p/', siteUrl))}">كل المنتجات</a> · <a href="${escapeHtml(absoluteUrl('media/', siteUrl))}">الملف الإعلامي</a></p>
</main>
<footer><b>${escapeHtml(SITE.nameAr)}</b> — ${escapeHtml(SITE.summaryAr)}
<nav><a href="${escapeHtml(siteUrl)}">الرئيسية</a><a href="${escapeHtml(absoluteUrl('tools/', siteUrl))}">الأدوات</a><a href="${escapeHtml(absoluteUrl('media/', siteUrl))}">الملف الإعلامي</a><a href="${escapeHtml(appUrl(siteUrl, 'perfume_news'))}">أخبار العطور</a><a href="${escapeHtml(absoluteUrl('sitemap.xml', siteUrl))}">خريطة الموقع</a><a href="${escapeHtml(absoluteUrl('llms.txt', siteUrl))}">llms.txt</a></nav>
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
<footer><b>${escapeHtml(SITE.nameAr)}</b> — ${escapeHtml(SITE.summaryAr)}<nav><a href="${escapeHtml(siteUrl)}">الرئيسية</a><a href="${escapeHtml(absoluteUrl('p/', siteUrl))}">المنتجات</a><a href="${escapeHtml(absoluteUrl('media/', siteUrl))}">الملف الإعلامي</a><a href="${escapeHtml(absoluteUrl('sitemap.xml', siteUrl))}">خريطة الموقع</a></nav> آخر تحديث: ${escapeHtml(now.toISOString().slice(0, 10))}</footer>
</body></html>
`;
}

export interface MediaKitOptions { siteUrl: string; productsCount?: number; env?: Record<string, string | undefined>; now?: Date }

/**
 * `/media/` (`media/index.html`) — the public press & media kit of «صمم عطرك مع شام».
 * Gives bloggers, fragrance communities, journalists and answer engines ready-to-copy descriptions,
 * verified tool links, Open Graph/Pinterest share cards and clean HTML/Markdown citation snippets.
 */
export function renderMediaKit(options: MediaKitOptions): string {
  const siteUrl = options.siteUrl;
  const now = options.now || new Date();
  const productsCount = options.productsCount ?? 1114;
  const url = absoluteUrl('media/', siteUrl);
  const image = absoluteUrl('og/media.png', siteUrl);
  const title = 'الملف الإعلامي لمعمل شام: تعريف المنصة وبطاقات النشر';
  const description = 'الملف الإعلامي الرسمي لمنصة صمم عطرك مع شام: فقرات تعريفية جاهزة للنسخ، روابط الأدوات، بطاقات المشاركة، وطريقة الاقتباس الصحيحة.';
  const h1 = 'الملف الإعلامي وبطاقة التعريف — صمم عطرك مع شام';
  const profiles = socialLinks(options.env);
  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'AboutPage', name: title, url, description, inLanguage: 'ar',
      isPartOf: { '@type': 'WebSite', name: SITE.nameAr, url: siteUrl },
    },
    {
      '@context': 'https://schema.org', '@type': 'Organization', '@id': `${siteUrl}#organization`,
      name: SITE.nameAr, alternateName: SITE.nameEn, url: siteUrl, logo: absoluteUrl('favicon.svg', siteUrl),
      sameAs: profiles, description: SITE.summaryAr,
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: SITE.nameAr, item: siteUrl },
        { '@type': 'ListItem', position: 2, name: 'الملف الإعلامي', item: url },
      ],
    },
  ];
  const shortBoilerplate = `${SITE.nameAr} — ${SITE.summaryAr}`;
  const blogBoilerplate = `منصة «${SITE.nameAr}» هي معمل عربي مفتوح في المتصفح لتصميم العطور وحساب تراكيزها بدقة 0.01 جرام: يضم ${SEO_PAGES.length} أداة ودليلاً مجانياً لتخفيف الكحول، ترتيب الهرم العطري، محاكاة التعتيق، وحساب تكلفة الزجاجة، إلى جانب موسوعة المواد الخام ومتجر يضم ${productsCount} عطراً موثقاً بالنوتات والأسعار.`;
  const htmlCitation = `<a href="${siteUrl}">${SITE.nameAr} — أدوات تركيب العطور وحاسبات المعمل</a>`;
  const mdCitation = `[${SITE.nameAr} — أدوات تركيب العطور وحاسبات المعمل](${siteUrl})`;

  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${escapeHtml(url)}">
<link rel="alternate" hreflang="ar" href="${escapeHtml(url)}"><link rel="alternate" hreflang="x-default" href="${escapeHtml(url)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="${escapeHtml(SITE.nameAr)}"><meta property="og:locale" content="${SITE.locale}">
<meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(url)}"><meta property="og:image" content="${escapeHtml(image)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="${SITE.twitterCard}"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${escapeHtml(image)}">
<meta name="theme-color" content="${SITE.themeColor}"><link rel="icon" href="${escapeHtml(absoluteUrl('favicon.svg', siteUrl))}" type="image/svg+xml">
${ld.map((block) => `<script type="application/ld+json" data-seo-agent="true">${JSON.stringify(block).replace(/</g, '\\u003c')}</script>`).join('')}
<style>${STYLE}</style></head><body>
<header><a href="${escapeHtml(siteUrl)}">${escapeHtml(SITE.nameAr)}</a><nav><a href="${escapeHtml(absoluteUrl('tools/', siteUrl))}">كل الأدوات</a><a href="${escapeHtml(absoluteUrl('p/', siteUrl))}">المنتجات</a><a href="${escapeHtml(appUrl(siteUrl, 'master_ai'))}">الخبير شاهين</a></nav></header>
<main>
<nav class="crumb" aria-label="مسار التنقل"><a href="${escapeHtml(siteUrl)}">الرئيسية</a> ← الملف الإعلامي</nav>
<div class="hero">
<h1>${escapeHtml(h1)}</h1>
<p class="lede">مرجع رسمي للمدونات والمجتمعات العطرية والصحافة ومحركات الإجابة: كل النصوص والبطاقات والروابط هنا متاحة للاقتباس المباشر مع ذكر المصدر.</p>
<a class="cta" href="${escapeHtml(absoluteUrl('tools/', siteUrl))}">استكشف أدوات المعمل</a>
<a class="cta alt" href="${escapeHtml(siteUrl)}">افتح المنصة الرئيسية</a>
<p class="small">إشراف تحريري: «${escapeHtml(SEO_AGENT.reportsToAr)}» · إدارة الظهور والإعلام: «${escapeHtml(SEO_AGENT.nameAr)}»</p>
</div>

<section><h2>نصوص تعريفية جاهزة للنسخ</h2>
<div class="copy-box"><b>تعريف في سطر واحد (للبايو والمقدمات السريعة)</b><pre id="bio-short">${escapeHtml(shortBoilerplate)}</pre><button type="button" class="share-btn" onclick="navigator.clipboard&&navigator.clipboard.writeText(document.getElementById('bio-short').textContent);this.textContent='تم النسخ ✓'">نسخ التعريف القصير</button></div>
<div class="copy-box"><b>فقرة تعريفية للمقالات والمدونات</b><pre id="bio-blog">${escapeHtml(blogBoilerplate)}</pre><button type="button" class="share-btn" onclick="navigator.clipboard&&navigator.clipboard.writeText(document.getElementById('bio-blog').textContent);this.textContent='تم النسخ ✓'">نسخ الفقرة الكاملة</button></div>
<div class="copy-box"><b>English Summary</b><pre id="bio-en">${escapeHtml(`${SITE.nameEn} (${SITE.nameAr}) — ${SITE.summaryEn}`)}</pre><button type="button" class="share-btn" onclick="navigator.clipboard&&navigator.clipboard.writeText(document.getElementById('bio-en').textContent);this.textContent='Copied ✓'">Copy English Summary</button></div>
</section>

<section><h2>حقائق وأرقام موثقة من المنصة</h2>
<ul class="steps">
<li><b><span class="num">1</span>${SEO_PAGES.length} أداة ودليلاً مجانياً في المتصفح</b>حاسبات تركيب العطور وتخفيف الكحول والهرم العطري ومحاكي التعتيق وحاسبة التكلفة تعمل مباشرة على الهاتف والحاسوب دون تسجيل.</li>
<li><b><span class="num">2</span>${productsCount} صفحة منتج مستقلة في متجر شام</b>لكل عطر صفحة HTML كاملة بالعربية والإنجليزية مع الهرم العطري والسعر والبيانات المنظمة.</li>
<li><b><span class="num">3</span>قنوات اكتشاف مفتوحة للمحركات والذكاء الاصطناعي</b>خريطة موقع <code>sitemap.xml</code> وخلاصة <code>feed.xml</code> وملف <code>llms.txt</code> وإشعارات WebSub وIndexNow.</li>
</ul>
</section>

<section><h2>روابط الأدوات الأساسية للاقتباس المباشر</h2>
<div class="cards">${SEO_PAGES.map((p) => `<a class="card" href="${escapeHtml(absoluteUrl(p.path, siteUrl))}"><b>${escapeHtml(p.h1)}</b><span>${escapeHtml(p.description)}</span></a>`).join('')}</div>
</section>

<section><h2>بطاقات المشاركة والصور الرسمية (Open Graph &amp; Pinterest)</h2>
<p>صُممت لكل أداة بطاقة مشاركة عربية بمقاس 1200×630، بالإضافة إلى بطاقات طولية بمقاس 1000×1500 لمنصة بينترست والقصص المصورة:</p>
<div class="cards">
<a class="card" href="${escapeHtml(absoluteUrl('og/home.png', siteUrl))}"><b>بطاقة المنصة الرئيسية (1200×630)</b><span>og/home.png</span></a>
<a class="card" href="${escapeHtml(absoluteUrl('og/concentration.png', siteUrl))}"><b>بطاقة حاسبة التركيب (1200×630)</b><span>og/concentration.png</span></a>
<a class="card" href="${escapeHtml(absoluteUrl('og/pin-concentration.png', siteUrl))}"><b>Pin حاسبة تركيب العطور (1000×1500)</b><span>og/pin-concentration.png</span></a>
<a class="card" href="${escapeHtml(absoluteUrl('og/pin-alcohol.png', siteUrl))}"><b>Pin تخفيف الكحول (1000×1500)</b><span>og/pin-alcohol.png</span></a>
<a class="card" href="${escapeHtml(absoluteUrl('og/pin-maceration_simulator.png', siteUrl))}"><b>Pin محاكي التعتيق (1000×1500)</b><span>og/pin-maceration_simulator.png</span></a>
<a class="card" href="${escapeHtml(absoluteUrl('favicon.svg', siteUrl))}"><b>شعار المنصة المتجه (SVG)</b><span>favicon.svg</span></a>
</div>
</section>

<section><h2>صيغة الإشارة المرجعية (للمواقع والمدونات)</h2>
<div class="copy-box"><b>كود HTML جاهز للمقالات</b><pre id="cite-html">${escapeHtml(htmlCitation)}</pre><button type="button" class="share-btn" onclick="navigator.clipboard&&navigator.clipboard.writeText(document.getElementById('cite-html').textContent);this.textContent='تم النسخ ✓'">نسخ كود HTML</button></div>
<div class="copy-box"><b>كود Markdown جاهز للمجتمعات والتوثيق</b><pre id="cite-md">${escapeHtml(mdCitation)}</pre><button type="button" class="share-btn" onclick="navigator.clipboard&&navigator.clipboard.writeText(document.getElementById('cite-md').textContent);this.textContent='تم النسخ ✓'">نسخ Markdown</button></div>
</section>
</main>
<footer><b>${escapeHtml(SITE.nameAr)}</b> — ${escapeHtml(SITE.summaryAr)}<nav><a href="${escapeHtml(siteUrl)}">الرئيسية</a><a href="${escapeHtml(absoluteUrl('tools/', siteUrl))}">الأدوات</a><a href="${escapeHtml(absoluteUrl('p/', siteUrl))}">المنتجات</a><a href="${escapeHtml(absoluteUrl('sitemap.xml', siteUrl))}">خريطة الموقع</a><a href="${escapeHtml(absoluteUrl('llms.txt', siteUrl))}">llms.txt</a></nav> آخر تحديث: ${escapeHtml(now.toISOString().slice(0, 10))}</footer>
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
  const yandex = options.env?.YANDEX_SITE_VERIFICATION?.trim();
  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'Organization', '@id': `${siteUrl}#organization`,
      name: SITE.nameAr, alternateName: SITE.nameEn, url: siteUrl, logo: absoluteUrl('favicon.svg', siteUrl), image,
      sameAs: socialLinks(options.env), description: SITE.summaryAr, inLanguage: 'ar',
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
${yandex ? `<meta name="yandex-verification" content="${escapeHtml(yandex)}">` : ''}
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
  out = out.replace(/<meta\s+name=["']yandex-verification["'][^>]*>/gi, '');
  out = out.replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*data-seo-agent=["']true["'][^>]*>[\s\S]*?<\/script>/gi, '');
  // A static fallback title/description in noscript content must survive; only head tags were removed above.
  if (/<\/head>/i.test(out)) out = out.replace(/<\/head>/i, `${block}\n</head>`);
  else out = `${block}\n${out}`;
  return out;
}


/* ---------- crawlable home fallback ----------
 * The app is a client-rendered SPA, so the served HTML used to be a ten-word shell. React clears
 * this block the moment it mounts (createRoot replaces the container's children), but before that —
 * and for every crawler that does not run JavaScript — it is the real home page: an H1, sections,
 * and working links into the tools. Keeping it inside #root means no duplicated content after boot.
 */
const HOME_TOOL_LINKS: { id: string; note: string }[] = [
  { id: 'concentration', note: 'نسب الزيت والكحول والماء لأي حجم زجاجة وتركيز.' },
  { id: 'alcohol', note: 'تخفيف الكحول إلى النسبة المناسبة قبل المزج.' },
  { id: 'costing', note: 'تكلفة الزجاجة وسعر البيع وهامش الربح.' },
  { id: 'pyramid', note: 'توزيع النوتات العليا والقلبية والقاعدية ومحاكاة الرش.' },
  { id: 'maceration_simulator', note: 'متابعة التعتيق يوماً بيوم حتى ينضج العطر.' },
  { id: 'guide', note: 'دليل المثبتات وطرق التعتيق خطوة بخطوة.' },
  { id: 'raw_materials', note: 'بطاقات المواد الخام وخصائصها ونسب استخدامها.' },
  { id: 'world_perfumes', note: 'أرشيف العطور الأيقونية ووصف كل عطر.' },
  { id: 'perfume_news', note: 'مرصد أخبار العطور العالمية وتحديثات السوق.' },
  { id: 'library', note: 'وصفات محفوظة جاهزة للتعديل والاستخدام.' },
  { id: 'master_ai', note: 'مساعد خبير يجيب عن أسئلة التركيب والتصميم.' },
  { id: 'store', note: 'عطور مختارة بعناية لمن يريد البدء بزجاجة جاهزة.' },
];

const homeLink = (id: string, note: string) => {
  const page = SEO_PAGES.find((entry) => entry.id === id);
  if (!page) return '';
  return `<li style="margin:0 0 8px"><a href="${escapeHtml(page.path)}" style="color:#7a4a1d;font-weight:600;text-decoration:none">${escapeHtml(page.h1)}</a>`
    + `<span style="color:#5d4b3c"> — ${escapeHtml(note)}</span></li>`;
};

const homeList = (ids: string[]) => `<ul style="margin:12px 0 0;padding:0 18px 0 0;line-height:1.9">${ids
  .map((id) => { const item = HOME_TOOL_LINKS.find((entry) => entry.id === id); return item ? homeLink(item.id, item.note) : ''; })
  .join('')}</ul>`;

const homeSection = (title: string, body: string) => `<h2 style="font-size:1.35rem;margin:30px 0 10px;color:#3a2a1c">${escapeHtml(title)}</h2>${body}`;

/** The static home page: real Arabic copy, one H1, five H2 sections and links into every tool. */
export function renderHomeFallback(): string {
  const body = [
    `<p style="font-size:1.05rem;line-height:1.95;margin:14px 0">معمل شام مساحة عربية لتصميم العطر خطوة بخطوة: تبدأ بفكرة أو نوتة تحبها، `
      + `تحسب نسب الزيت والكحول والماء، ترتّب الهرم العطري، ثم تحفظ الوصفة وتتابع تعتيقها. كل ذلك داخل المتصفح دون تنزيل برامج، `
      + `مع مراجع عطرية ومتجر يضم خلاصات مختارة بعناية.</p>`,
    homeSection('حاسبات التركيب والتكلفة',
      `<p style="line-height:1.95;margin:12px 0">الحاسبة تحوّل الفكرة إلى أرقام: تدخل حجم الزجاجة والتركيز المطلوب، فتحصل على وزن كل مكوّن `
        + `بالمليلتر والجرام بدقة 0.01. وإذا أردت معرفة تكلفة الزجاجة قبل أن تصنعها، فحاسبة التكلفة تجمع سعر الخامات وتحسب هامش الربح.</p>`
        + homeList(['concentration', 'alcohol', 'costing'])),
    homeSection('الهرم العطري والتعتيق',
      `<p style="line-height:1.95;margin:12px 0">بعد أن تصبح النسب جاهزة يأتي دور التذوق: وزّع النوتات على الهرم العطري لتعرف ما ستشمه أولاً `
        + `وما يبقى على الجلد، ثم اختبر أثر التعتيق قبل أن تلتزم بوصفتك. محاكي التعتيق يمنحك صورة عن تغيّر العطر مع الأسابيع، `
        + `والدليل يشرح دور المثبتات وطرق التخزين.</p>`
        + homeList(['pyramid', 'maceration_simulator', 'guide'])),
    homeSection('مراجع للمبتدئ والمحترف',
      `<p style="line-height:1.95;margin:12px 0">المواد الخام ليست أسماء غامضة: لكل مادة بطاقة توضح أصلها وثباتها ونسب استخدامها في التركيب. `
        + `وإلى جانب الموسوعة تجد مكتبة العطور العالمية لقراءة وصفات أيقونات الصناعة، ومرصد الأخبار لمتابعة الإصدارات، `
        + `ومكتبة الوصفات لتبدأ من صيغة جاهزة وتعدّلها.</p>`
        + homeList(['raw_materials', 'world_perfumes', 'perfume_news', 'library', 'master_ai'])),
    homeSection('كيف تبدأ في ثلاث خطوات؟',
      `<ol style="margin:12px 0 0;padding:0 18px 0 0;line-height:1.95">`
        + `<li>اختر التركيز والحجم: حدد سعة الزجاجة ونسبة الزيت، مثل EDP أو EDT، وراجع الكميات التي تظهر لك.</li>`
        + `<li>رتّب النوتات: جرّب توزيع النوتات على الهرم العطري، واحفظ الوصفة في مكتبتك إذا أعجبتك الفكرة.</li>`
        + `<li>اختبر ثم عدّل: راقب التعتيق، احسب التكلفة، وعدّل النسب قبل أن تعيد التصنيع.</li>`
        + `</ol>`),
    homeSection('لمن صُمم هذا المعمل؟',
      `<p style="line-height:1.95;margin:12px 0">للمبتدئ الذي يريد أول تركيبة واضحة، ولصاحب المشروع الصغير الذي يحتاج حساباً دقيقاً للتكلفة `
        + `قبل الشراء، وللمهتم بقراءة العطور وفهم موادها. كل الأدوات تعمل على الهاتف قبل الحاسوب، وتُحفظ وصفاتك على جهازك، `
        + `ويمكنك التنقل بين الحاسبات دون أن تفقد ما كتبته.</p>`
        + homeList(['store'])),
  ].join('\n');

  return `<!--seo-agent:body:start-->\n<div dir="rtl" lang="ar" style="max-width:880px;margin:0 auto;padding:28px 20px 44px;`
    + `font-family:system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif;color:#2c2118;background:#fffaf4;line-height:1.9">`
    + `<h1 style="font-size:1.9rem;line-height:1.5;margin:0 0 12px;color:#3a2a1c">${escapeHtml(HOME_PAGE.h1)}</h1>\n`
    + `${body}\n</div>\n<!--seo-agent:body:end-->`;
}

/** Injects the static home copy inside #root (idempotent). React replaces it on mount. */
export function injectHomeFallback(html: string): string {
  const block = renderHomeFallback();
  const out = html.replace(/\n?<!--seo-agent:body:start-->[\s\S]*?<!--seo-agent:body:end-->\n?/i, '');
  const root = /<div\s+id=["']root["'][^>]*>/i;
  if (root.test(out)) return out.replace(root, (tag) => `${tag}\n${block}`);
  return out.replace(/<body([^>]*)>/i, (tag) => `${tag}\n${block}`);
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
    files: ['robots.txt', 'sitemap.xml', 'feed.xml', 'llms.txt', `${SITE.indexNowKey}.txt`, 'tools/index.html', 'media/index.html', ...SEO_PAGES.map((p) => p.path)],
  }, null, 1) + '\n';
}

/** Counts the structured-data types in a generated page (used by the build self-check). */
export function pageSchemaTypes(html: string): string[] { return schemaTypes(html); }
