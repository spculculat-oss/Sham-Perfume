/**
 * Identity of «صمم عطرك مع شام» for search engines, and of the agent in charge of them.
 *
 * The agent is «منارة شاهين» — «الخبير شاهين»'s media representative and search-visibility lead.
 * Everything here is public by design (canonical origin, social preview, the IndexNow key): the key
 * is meant to be served as /<key>.txt, so committing it is safe. Secrets (Search Console service
 * account, Bing Webmaster key) never live here — they are server environment variables only.
 */
export const SITE = {
  nameAr: 'صمم عطرك مع شام',
  nameEn: 'Design Your Perfume with Sham',
  shortNameAr: 'شام',
  /** The canonical public origin: the same URL every page's rel=canonical points at. */
  url: 'https://sham-perfume-49bf.vercel.app/',
  /** The static mirror on GitHub Pages (same app, calls the Vercel API). */
  mirrorUrl: 'https://spculculat-oss.github.io/Sham-Perfume/',
  github: 'https://github.com/spculculat-oss/Sham-Perfume',
  locale: 'ar_EG',
  language: 'ar',
  themeColor: '#b45309',
  ogImage: 'og-cover.jpg',
  twitterCard: 'summary_large_image',
  /** Public IndexNow key (served at /<key>.txt). Not a secret. */
  indexNowKey: '743e07fcdce6be6d7bb0d495602ee830',
  /** What the site is, in one honest sentence (used in llms.txt and the media kit). */
  summaryAr: 'منصة عربية لتصميم العطور وتركيبها: حاسبات المعمل، الهرم العطري، التعتيق والتخفيف، موسوعة المواد الخام، مكتبة العطور العالمية، ومتجر شام.',
  summaryEn: 'An Arabic perfume-design platform: lab calculators, fragrance pyramids, maceration and dilution, a raw-materials encyclopedia, an iconic-perfume library, and the Sham store.',
} as const;

/** The agent's public identity. It works under «الخبير شاهين» and never outranks him. */
export const SEO_AGENT = {
  id: 'seo_agent',
  nameAr: 'منارة شاهين',
  nameEn: 'Manaret Shaheen',
  roleAr: 'المندوب الإعلامي وخبير الظهور في محركات البحث',
  roleEn: 'Media representative and search visibility lead',
  reportsToAr: 'الخبير شاهين',
  reportsToEn: 'Master Shahin',
  missionAr: 'يرفع اسم «صمم عطرك مع شام» في نتائج البحث الأولى: يدرس منهجية SEO، يفحص الموقع، يكتب العناوين والأوصاف والبيانات المنظمة، يرسل الصفحات إلى محركات البحث، ثم يقيس ويتعلم ويتطور — تحت إشراف الخبير شاهين.',
  missionEn: 'Earns first-page visibility for «Design Your Perfume with Sham»: studies SEO methodology, audits the site, writes titles/descriptions/structured data, submits pages to search engines, then measures, learns and improves — supervised by Master Shahin.',
  /** Hard limits that no trust level may cross. */
  guardrailsAr: [
    'لا يغيّر الأسعار أو المخزون أو منطق المتجر إطلاقاً.',
    'لا يختلق أرقاماً أو تقييمات أو شهادات أو صفقات أو مصادر.',
    'لا يحجب Googlebot ولا أي زاحف شريف، ولا يستخدم إخفاءً أو حشواً للكلمات.',
    'لا يبني روابط خارجية مدفوعة أو مبادلة روابط؛ الظهور يُكتسب بالمحتوى والبيانات الصحيحة.',
    'لا ينشر أي نص قبل فحصه آلياً (الطول، اللغة، الادعاءات، أسماء الموردين التقنيين).',
    'كل اقتراح يُسجَّل قبل تطبيقه ويمكن التراجع عنه، والتقييم في يد الخبير شاهين.',
  ],
} as const;

export type SearchEngineId =
  | 'google' | 'bing' | 'yandex' | 'naver' | 'seznam' | 'yep' | 'duckduckgo' | 'ecosia' | 'brave' | 'yahoo'
  | 'perplexity' | 'copilot' | 'chatgpt-search';

export interface SearchEngineDef {
  id: SearchEngineId;
  nameAr: string;
  nameEn: string;
  /** What the agent actually does for it. */
  methodAr: string;
  /** submitted = an automated push happened; ready = files/tags are in place; owner = needs a one-time owner action. */
  status: 'submitted' | 'ready' | 'owner';
  /** Which mechanism reaches it. */
  via: 'indexnow' | 'sitemap' | 'gsc' | 'llms' | 'owned-index';
}

/**
 * Honest coverage map (2026): Google has no IndexNow and no public general-purpose indexing API;
 * sitemaps + Search Console are its channels. Bing/Yandex/Naver/Seznam/Yep consume IndexNow directly.
 * DuckDuckGo, Ecosia, Yahoo and Copilot read Bing's index; Perplexity/AI answers read llms.txt and
 * crawl openly. Nothing here claims a ranking — only discovery.
 */
export const SEARCH_ENGINES: SearchEngineDef[] = [
  { id: 'google', nameAr: 'Google', nameEn: 'Google', methodAr: 'خريطة الموقع + ملف التحقق + Search Console (تسليم الخريطة آلي عند ربط حساب الخدمة)', status: 'ready', via: 'gsc' },
  { id: 'bing', nameAr: 'Bing', nameEn: 'Bing', methodAr: 'IndexNow فوراً + خريطة الموقع (ويربط Bing Webmaster API إن وُجد المفتاح)', status: 'ready', via: 'indexnow' },
  { id: 'yandex', nameAr: 'Yandex', nameEn: 'Yandex', methodAr: 'IndexNow فوراً + خريطة الموقع', status: 'ready', via: 'indexnow' },
  { id: 'naver', nameAr: 'Naver', nameEn: 'Naver', methodAr: 'IndexNow فوراً', status: 'ready', via: 'indexnow' },
  { id: 'seznam', nameAr: 'Seznam', nameEn: 'Seznam', methodAr: 'IndexNow فوراً', status: 'ready', via: 'indexnow' },
  { id: 'yep', nameAr: 'Yep', nameEn: 'Yep', methodAr: 'IndexNow فوراً', status: 'ready', via: 'indexnow' },
  { id: 'duckduckgo', nameAr: 'DuckDuckGo', nameEn: 'DuckDuckGo', methodAr: 'يقرأ فهرس Bing: يصل عبر IndexNow وخريطة الموقع', status: 'ready', via: 'owned-index' },
  { id: 'ecosia', nameAr: 'Ecosia', nameEn: 'Ecosia', methodAr: 'يقرأ فهرس Bing: يصل عبر IndexNow وخريطة الموقع', status: 'ready', via: 'owned-index' },
  { id: 'yahoo', nameAr: 'Yahoo', nameEn: 'Yahoo', methodAr: 'يقرأ فهرس Bing: يصل عبر IndexNow وخريطة الموقع', status: 'ready', via: 'owned-index' },
  { id: 'brave', nameAr: 'Brave Search', nameEn: 'Brave Search', methodAr: 'فهرسه مستقل: يعتمد خريطة الموقع والزحف العادي', status: 'ready', via: 'sitemap' },
  { id: 'perplexity', nameAr: 'Perplexity', nameEn: 'Perplexity', methodAr: 'يلجأ إلى llms.txt والزحف المفتوح (مسموح في robots)', status: 'ready', via: 'llms' },
  { id: 'copilot', nameAr: 'Microsoft Copilot', nameEn: 'Microsoft Copilot', methodAr: 'يقرأ فهرس Bing وIndexNow', status: 'ready', via: 'owned-index' },
  { id: 'chatgpt-search', nameAr: 'البحث في المساعدات الذكية', nameEn: 'AI assistants search', methodAr: 'llms.txt + سماح صريح للزوار الآليين المحترمين', status: 'ready', via: 'llms' },
];

/** Search Console service account is optional; without it Google is fed by sitemap + verification. */
export function hasGoogleConsole(env: Record<string, string | undefined>) {
  return Boolean(env.GSC_SERVICE_ACCOUNT_JSON?.trim() && (env.GSC_SITE_URL?.trim() || env.SEO_SITE_URL?.trim() || env.APP_URL?.trim()));
}
export const hasBingWebmaster = (env: Record<string, string | undefined>) => Boolean(env.BING_WEBMASTER_API_KEY?.trim());

/** Canonical origin for this deployment: an explicit env wins, otherwise the primary Vercel site. */
export function canonicalSiteUrl(env: Record<string, string | undefined> = {}): string {
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const raw = env.SEO_SITE_URL?.trim() || env.APP_URL?.trim() || (vercel ? `https://${vercel.replace(/^https?:\/\//, '').replace(/\/+$/, '')}/` : '') || SITE.url;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && !/^(localhost|127\.0\.0\.1)$/.test(url.hostname)) return SITE.url;
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}/`;
  } catch { return SITE.url; }
}

/** Absolute URL for a path under the canonical origin. */
export function absoluteUrl(path: string, siteUrl: string = SITE.url): string {
  return new URL(path.replace(/^\/+/, ''), siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`).href;
}

/** Path of the IndexNow key file served at the site root. */
export const indexNowKeyPath = `${SITE.indexNowKey}.txt`;

/** The trust ladder of the agent (the actual state machine lives in src/seo/agentState.ts). */
export const SEO_TRUST_LEVELS = [
  { id: 'trainee' as const, labelAr: 'متدرّب تحت الإشراف', labelEn: 'Trainee under supervision', noteAr: 'يدرس ويفحص ويقترح، ولا يغيّر نصاً منشوراً.' },
  { id: 'guided' as const, labelAr: 'يعمل بتوجيه شاهين', labelEn: 'Guided by Shahin', noteAr: 'يطبّق تحسينات آمنة (عناوين، أوصاف، أسئلة شائعة، بيانات منظمة) بعد فحصها، وشاهين يراجع كل دورة.' },
  { id: 'autonomous' as const, labelAr: 'يعتمد على نفسه', labelEn: 'Self-reliant', noteAr: 'يقود خطة الظهور اليومية بنفسه داخل الحدود الثابتة، مع مراجعة دورية من شاهين وتراجع تلقائي عند أي هبوط.' },
];
export type SeoTrustLevel = (typeof SEO_TRUST_LEVELS)[number]['id'];
