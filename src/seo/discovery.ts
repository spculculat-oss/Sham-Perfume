/**
 * Discovery without an account.
 *
 * Search Console is free, but it is optional: nothing here needs a Google account, a credit card or a
 * Cloud project. These are the channels «منارة شاهين» can operate on its own, and each one is a real
 * mechanism with a public specification — not a promise about ranking:
 *
 *   sitemap.xml  → listed in robots.txt, with honest lastmod values.
 *   feed.xml     → an RSS document listed as a second sitemap (search engines accept feeds as sitemaps).
 *   WebSub       → the feed advertises a hub; publishing a ping tells readers the feed changed.
 *   IndexNow     → Bing, Yandex, Naver, Seznam and Yep accept a URL the moment it is published.
 *   crawler probe→ fetch our own pages with the crawler's user agent and look for anything that blocks
 *                  indexing (HTTP status, X-Robots-Tag, meta robots) — the checks an owner would run in
 *                  a console, done from the outside.
 *   PageSpeed    → the public, keyless Lighthouse endpoint reports field/lab performance, which is the
 *                  part of a console report that can be measured without owning the property.
 *
 * Pure string helpers only: no Node APIs, no network. The HTTP side lives in server/seo/search.ts.
 */

/** The reference WebSub hub (an open publisher hub); overridable with WEBSUB_HUBS. */
export const WEBSUB_DEFAULT_HUB = 'https://pubsubhubbub.appspot.com/';
export const WEBSUB_DEFAULT_HUBS = [WEBSUB_DEFAULT_HUB, 'https://pubsubhubbub.superfeedr.com/'] as const;

/** User agents used by the crawl probe. A crawler-identifying UA is the honest way to test access. */
export const CRAWLER_AGENTS = {
  googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  bingbot: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
} as const;

export interface DiscoveryChannel {
  id: 'sitemap' | 'feed-sitemap' | 'websub' | 'indexnow' | 'crawler-probe' | 'page-speed' | 'llms';
  nameAr: string;
  /** What the agent actually does. */
  runsAr: string;
  /** What it can and cannot prove. */
  provesAr: string;
}

/**
 * The honest catalogue of account-free channels. Surfaces in the admin panel, the README and the
 * tests, so a claim about "indexing" can always be traced to a mechanism that exists.
 */
export const DISCOVERY_CHANNELS: DiscoveryChannel[] = [
  {
    id: 'sitemap',
    nameAr: 'خريطة الموقع في robots.txt',
    runsAr: 'sitemap.xml تُبنى مع كل نشر، وتُعلَن في robots.txt مع lastmod صحيح لكل رابط.',
    provesAr: 'كل صفحات الموقع معروضة على الزاحف دون أي حساب.',
  },
  {
    id: 'feed-sitemap',
    nameAr: 'الخلاصة كخريطة ثانية',
    runsAr: 'feed.xml تُعلَن أيضاً كخريطة في robots.txt؛ محركات البحث تقبل خلاصات RSS كخرائط.',
    provesAr: 'قناة اكتشاف ثانية مستقلة عن الخريطة الأساسية.',
  },
  {
    id: 'websub',
    nameAr: 'إشعار فوري للخلاصة',
    runsAr: 'الخلاصة تحمل رابط المحور، ويُرسل إشعار نشر عند كل تغيير حقيقي في محتواها.',
    provesAr: 'القارئ يعرف بالتحديث قبل الزحف الدوري القادم.',
  },
  {
    id: 'indexnow',
    nameAr: 'دفع فوري للفهارس',
    runsAr: 'IndexNow يرسل الروابط المتغيرة إلى Bing وYandex وNaver وSeznam وYep مباشرة.',
    provesAr: 'قبول المحرك للرابط لحظة النشر، مع رمز الاستجابة محفوظاً.',
  },
  {
    id: 'crawler-probe',
    nameAr: 'فحص وصول الزاحف',
    runsAr: 'يُطلب الرابط بمعرّف زاحف البحث ويُفحص رمز الاستجابة وX-Robots-Tag ووسم robots.',
    provesAr: 'أي حاجز يمنع الفهرسة يُكتشف من خارج الموقع وقبل الزحف.',
  },
  {
    id: 'page-speed',
    nameAr: 'قياس الأداء الميداني',
    runsAr: 'قراءة تقرير Lighthouse العام (بلا مفتاح) للجوّال مع مؤشرات الويب الأساسية.',
    provesAr: 'حالة الأداء والتجربة التي يراها المستخدم، بديلاً عن تقرير لوحة المالك.',
  },
  {
    id: 'llms',
    nameAr: 'خريطة لمحركات الإجابة',
    runsAr: 'llms.txt يشرح الموقع وأدواته وروابطه لمحركات البحث الذكية.',
    provesAr: 'حضور مفهوم في إجابات المساعدات التي تقرأ الملفات المفتوحة.',
  },
];

/** The channels an agent cycle can verify on its own, in order. */
export const ACCOUNT_FREE_IDS = DISCOVERY_CHANNELS.map((channel) => channel.id);

/** Deterministic 32-bit fingerprint (FNV-1a). Used to ping the hub only when the feed really changed. */
export function feedFingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** The Atom links RSS needs to be a WebSub publisher (self identifies the feed, hub receives pings). */
export function webSubLinks(feedUrl: string, hubUrl: string = WEBSUB_DEFAULT_HUB): string {
  return [
    `<atom:link href="${feedUrl}" rel="self" type="application/rss+xml"/>`,
    `<atom:link href="${hubUrl}" rel="hub"/>`,
  ].join('\n');
}

/** The form body a WebSub hub expects (`hub.mode=publish&hub.url=<feed>`). */
export function webSubPingBody(feedUrl: string): URLSearchParams {
  return new URLSearchParams({ 'hub.mode': 'publish', 'hub.url': feedUrl });
}

/** Hub list from the environment, falling back to the public defaults. */
export function webSubHubs(env: Record<string, string | undefined> = {}): string[] {
  const raw = env.WEBSUB_HUBS?.trim();
  if (!raw) return [...WEBSUB_DEFAULT_HUBS];
  const hubs = raw.split(',').map((hub) => hub.trim()).filter((hub) => /^https:\/\/[a-z0-9.-]+(?::\d+)?\/?$/i.test(hub));
  return hubs.length ? hubs.slice(0, 4) : [...WEBSUB_DEFAULT_HUBS];
}
