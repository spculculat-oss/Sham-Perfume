/**
 * Where «الخبير شاهين» looks for perfume news. Google News searches cover the whole web (thousands of
 * newspapers and magazines in every language) and the specialist feeds add trade and perfumery press.
 * A source that fails or changes its address is skipped; the others still publish.
 */
export interface FeedSource { id: string; name: string; url: string; lang: 'ar' | 'en' | 'fr'; kind: 'search' | 'trade' }
export interface RawItem { title: string; url: string; source: string; publishedAt?: string; snippet: string; feed: string; lang: FeedSource['lang'] }

const gnews = (q: string, lang: 'ar' | 'en' | 'fr') => {
  const region = { ar: 'hl=ar&gl=EG&ceid=EG:ar', en: 'hl=en-US&gl=US&ceid=US:en', fr: 'hl=fr&gl=FR&ceid=FR:fr' }[lang];
  return `https://news.google.com/rss/search?q=${encodeURIComponent(`${q} when:${lang === 'ar' ? 7 : 3}d`)}&${region}`;
};

export const FEEDS: FeedSource[] = [
  { id: 'gn-ar-perfume', name: 'أخبار جوجل · عطور', url: gnews('عطور OR عطر جديد', 'ar'), lang: 'ar', kind: 'search' },
  { id: 'gn-ar-oud', name: 'أخبار جوجل · عود وبخور', url: gnews('العود OR البخور OR "صناعة العطور" OR "دار عطور"', 'ar'), lang: 'ar', kind: 'search' },
  { id: 'gn-en-launch', name: 'Google News · launches', url: gnews('new fragrance launch OR perfume launch', 'en'), lang: 'en', kind: 'search' },
  { id: 'gn-en-industry', name: 'Google News · industry', url: gnews('fragrance industry OR perfumery OR "fragrance house"', 'en'), lang: 'en', kind: 'search' },
  { id: 'gn-en-ingredients', name: 'Google News · ingredients', url: gnews('fragrance ingredients OR IFRA OR agarwood OR "essential oils" perfume', 'en'), lang: 'en', kind: 'search' },
  { id: 'gn-en-niche', name: 'Google News · niche', url: gnews('niche perfume OR "niche fragrance"', 'en'), lang: 'en', kind: 'search' },
  { id: 'gn-fr-parfum', name: 'Google Actualités · parfum', url: gnews('parfum lancement OR parfumerie', 'fr'), lang: 'fr', kind: 'search' },
  { id: 'nst', name: 'Now Smell This', url: 'https://www.nstperfume.com/feed/', lang: 'en', kind: 'trade' },
  { id: 'cafleurebon', name: 'CaFleureBon', url: 'https://www.cafleurebon.com/feed/', lang: 'en', kind: 'trade' },
  { id: 'boisdejasmin', name: 'Bois de Jasmin', url: 'https://boisdejasmin.com/feed', lang: 'en', kind: 'trade' },
  { id: 'gn-ar-market', name: 'أخبار جوجل · سوق العطور', url: gnews('"سوق العطور" OR "العطور الفاخرة" OR "معرض العطور"', 'ar'), lang: 'ar', kind: 'search' },
  { id: 'premiumbeautynews', name: 'Premium Beauty News', url: 'https://www.premiumbeautynews.com/spip.php?page=backend', lang: 'en', kind: 'trade' },
  { id: 'cosmeticsbusiness', name: 'Cosmetics Business', url: 'https://cosmeticsbusiness.com/rss', lang: 'en', kind: 'trade' },
];

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', ndash: '–', mdash: '—' };
export function decode(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}
export const plain = (html: string) => decode(decode(html)).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const tag = (block: string, name: string) => block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'))?.[1];
const attr = (block: string, name: string, key: string) => block.match(new RegExp(`<${name}\\s[^>]*${key}="([^"]+)"`, 'i'))?.[1];

/** RSS 2.0 items and Atom entries, without an XML dependency. */
export function parseFeed(xml: string, feed: FeedSource): RawItem[] {
  const blocks = [...xml.matchAll(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi)].map((m) => m[0]);
  const items: RawItem[] = [];
  for (const block of blocks) {
    let title = plain(tag(block, 'title') || '');
    const link = plain(tag(block, 'link') || '') || attr(block, 'link', 'href') || '';
    // Google News items carry the publisher in <source> and append « - Publisher» to the title.
    const publisher = plain(tag(block, 'source') || '');
    if (publisher && title.endsWith(` - ${publisher}`)) title = title.slice(0, -publisher.length - 3).trim();
    const date = plain(tag(block, 'pubDate') || tag(block, 'published') || tag(block, 'updated') || tag(block, 'dc:date') || '');
    const published = date && !Number.isNaN(Date.parse(date)) ? new Date(date).toISOString() : undefined;
    let snippet = plain(tag(block, 'description') || tag(block, 'summary') || tag(block, 'content:encoded') || tag(block, 'content') || '');
    if (feed.kind === 'search') snippet = ''; // Google's description only repeats the headline
    if (!title || !/^https?:\/\//.test(link)) continue;
    items.push({ title: title.slice(0, 300), url: link, source: publisher || feed.name, publishedAt: published, snippet: snippet.slice(0, 500), feed: feed.id, lang: feed.lang });
  }
  return items;
}

export async function fetchFeed(feed: FeedSource, request: typeof fetch = fetch): Promise<RawItem[]> {
  const response = await request(feed.url, {
    headers: { 'User-Agent': 'ShamPerfumeNewsBot/1.0 (+https://spculculat-oss.github.io/Sham-Perfume/)', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return parseFeed(await response.text(), feed);
}
