// One editorial edition per entry country. Add only verified publisher feeds that permit this use;
// never derive a feed URL from a request header or silently substitute a different country's feed.
export const HEADLINE_PUBLISHERS = {
  youm7: {
    name: { ar: 'اليوم السابع', en: 'Youm7' }, lang: 'ar',
    page: 'https://www.youm7.com/', hosts: ['www.youm7.com', 'youm7.com'],
    path: /^\/(?:story\/\d{4}\/\d{1,2}\/\d{1,2}\/[^/]+\/)?\d+\/?$/i,
  },
  'service-public': {
    name: { ar: 'www.service-public.gouv.fr', en: 'www.service-public.gouv.fr' }, lang: 'fr',
    page: 'https://www.service-public.gouv.fr/particuliers/actualites',
    hosts: ['www.service-public.gouv.fr', 'entreprendre.service-public.gouv.fr'],
    path: /^\/(?:particuliers\/)?actualites\/A\d+\/?$/,
  },
  'info-gouv': {
    name: { ar: 'الحكومة الفرنسية · info.gouv.fr', en: 'French Government · info.gouv.fr' }, lang: 'fr',
    page: 'https://www.info.gouv.fr/toute-l-actualite', hosts: ['www.info.gouv.fr'],
    path: /^\/actualite\/[^/]+\/?$/,
    license: { name: 'Licence Ouverte 2.0', url: 'https://github.com/etalab/licence-ouverte/blob/master/LO.md' },
  },
  'gov-uk': {
    name: { ar: 'GOV.UK', en: 'GOV.UK' }, lang: 'en',
    page: 'https://www.gov.uk/search/news-and-communications', hosts: ['www.gov.uk'],
    path: /^\/government\/news\/[^/]+\/?$/,
    license: { name: 'Contains public sector information licensed under the Open Government Licence v3.0.', url: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/' },
  },
  'agencia-brasil': {
    name: { ar: 'وكالة أنباء البرازيل', en: 'Agência Brasil' }, lang: 'pt-BR',
    page: 'https://agenciabrasil.ebc.com.br/', hosts: ['agenciabrasil.ebc.com.br'],
    path: /^\/(?:geral|politica)\/noticia\/\d{4}-\d{2}\/[^/]+\/?$/,
    license: { name: 'Reproduction policy', url: 'https://agenciabrasil.ebc.com.br/en/about' },
    byline: true,
  },
  'un-news': {
    name: { ar: 'أخبار الأمم المتحدة', en: 'UN News' }, lang: 'ar',
    page: 'https://news.un.org/ar/', hosts: ['news.un.org'],
    path: /^\/(?:feed\/view\/)?ar\/story\/\d{4}\/\d{2}\/\d+\/?$/,
  },
  'global-voices': {
    name: { ar: 'جلوبال فويسز', en: 'Global Voices' }, lang: 'en',
    page: 'https://globalvoices.org/', hosts: ['globalvoices.org'],
    path: /^\/\d{4}\/\d{2}\/\d{2}\/[^/]+\/?$/,
    license: { name: 'CC BY 3.0', url: 'https://creativecommons.org/licenses/by/3.0/' },
    byline: true,
  },
  mongabay: {
    name: { ar: 'مونجاباي · البيئة', en: 'Mongabay · Environment' }, lang: 'en',
    page: 'https://news.mongabay.com/', hosts: ['news.mongabay.com'],
    path: /^\/(?:short-article\/)?\d{4}\/\d{2}\/[^/]+\/?$/,
    license: { name: 'CC BY-ND 4.0', url: 'https://creativecommons.org/licenses/by-nd/4.0/' },
    byline: true,
  },
  'european-parliament': {
    name: { ar: 'البرلمان الأوروبي · بيانات رسمية', en: 'European Parliament · Official releases' }, lang: 'en',
    page: 'https://www.europarl.europa.eu/news/en/press-room', hosts: ['www.europarl.europa.eu'],
    path: /^\/news\/en\/press-room\/\d{8}IPR\d{5}(?:\/[^/]+)?\/?$/,
    license: { name: '© European Union – EP', url: 'https://www.europarl.europa.eu/legal-notice/en' },
  },
  'arabs-today': {
    name: { ar: 'العرب اليوم', en: 'Arabs Today' }, lang: 'ar',
    page: 'https://www.arabstoday.net/', hosts: ['www.arabstoday.net', 'arabstoday.net'],
    path: /^\/\d{1,5}\/\d{6}-[^/]+\/?$/,
    // The publisher permits display of RSS headlines with a direct story link, not its images.
    license: { name: 'RSS terms of use', url: 'https://www.arabstoday.net/rss' },
  },
  'egypt-today': {
    name: { ar: 'مصر اليوم · الكرة المصرية', en: 'Egypt Today · Egyptian football' }, lang: 'ar',
    page: 'https://www.egypt-today.com/', hosts: ['www.egypt-today.com', 'egypt-today.com'],
    path: /^\/\d{1,5}\/\d{6}-[^/]+\/?$/,
    license: { name: 'RSS terms of use', url: 'https://www.egypt-today.com/rss' },
  },
} as const;

export type HeadlinePublisher = keyof typeof HEADLINE_PUBLISHERS;
export interface HeadlineFeed { url: string; publisher: HeadlinePublisher }
export interface HeadlineEdition {
  timeZone: string;
  official?: boolean;
  feeds: readonly HeadlineFeed[];
}
const editions: Readonly<Record<string, HeadlineEdition>> = {
  BR: {
    timeZone: 'America/Sao_Paulo',
    feeds: [
      { publisher: 'agencia-brasil', url: 'https://agenciabrasil.ebc.com.br/rss/geral/feed.xml' },
      { publisher: 'agencia-brasil', url: 'https://agenciabrasil.ebc.com.br/rss/politica/feed.xml' },
    ],
  },
  EG: {
    timeZone: 'Africa/Cairo',
    feeds: [
      { publisher: 'youm7', url: 'https://www.youm7.com/rss/SectionRss?SectionID=97' },
      { publisher: 'global-voices', url: 'https://globalvoices.org/-/world/middle-east-north-africa/egypt/feed/' },
      { publisher: 'egypt-today', url: 'https://www.egypt-today.com/egypt-football/rss.xml' },
    ],
  },
  FR: {
    timeZone: 'Europe/Paris', official: true,
    feeds: [
      { publisher: 'service-public', url: 'https://www.service-public.gouv.fr/abonnements/rss/actu-actualites-particuliers.rss' },
      { publisher: 'service-public', url: 'https://www.service-public.gouv.fr/abonnements/rss/actu-actu-pro.rss' },
      { publisher: 'info-gouv', url: 'https://www.info.gouv.fr/rss/actualites.xml' },
    ],
  },
  GB: {
    timeZone: 'Europe/London', official: true,
    feeds: [{ publisher: 'gov-uk', url: 'https://www.gov.uk/search/news-and-communications.atom?content_store_document_type=news_story' }],
  },
};
export const localHeadlineEdition = (country: string | null): HeadlineEdition | undefined => country && Object.hasOwn(editions, country)
  ? editions[country] : undefined;
export const WORLD_HEADLINE_EDITION: HeadlineEdition = {
  timeZone: 'UTC',
  feeds: [
    { publisher: 'youm7', url: 'https://www.youm7.com/rss/SectionRss?SectionID=286' },
    { publisher: 'un-news', url: 'https://news.un.org/feed/subscribe/ar/news/all/rss.xml' },
    { publisher: 'global-voices', url: 'https://globalvoices.org/feed/' },
    { publisher: 'mongabay', url: 'https://news.mongabay.com/feed/' },
    { publisher: 'european-parliament', url: 'https://www.europarl.europa.eu/rss/doc/press-releases/en.xml' },
    { publisher: 'arabs-today', url: 'https://www.arabstoday.net/arabstoday-breakingnews/rss.xml' },
  ],
};
export const WORLD_HEADLINE_PUBLISHERS = [...new Set(WORLD_HEADLINE_EDITION.feeds.map(({ publisher }) => publisher))];

// A directory, not a set of feeds: no requests to these sites until the visitor opens a link.
export const MORE_WORLD_NEWS_LINKS = [
  { name: { ar: 'الجزيرة', en: 'Al Jazeera' }, url: 'https://www.aljazeera.net/' },
  { name: { ar: 'بي بي سي عربي', en: 'BBC News Arabic' }, url: 'https://www.bbc.com/arabic' },
  { name: { ar: 'رويترز', en: 'Reuters' }, url: 'https://www.reuters.com/world/' },
  { name: { ar: 'ذا جارديان', en: 'The Guardian' }, url: 'https://www.theguardian.com/world' },
  { name: { ar: 'العربية', en: 'Al Arabiya' }, url: 'https://www.alarabiya.net/' },
  { name: { ar: 'أسوشيتد برس', en: 'Associated Press' }, url: 'https://apnews.com/world-news' },
  { name: { ar: 'سي إن إن بالعربية', en: 'CNN Arabic' }, url: 'https://arabic.cnn.com/' },
  { name: { ar: 'فرانس ٢٤', en: 'France 24' }, url: 'https://www.france24.com/ar/' },
  { name: { ar: 'دويتشه فيله', en: 'Deutsche Welle' }, url: 'https://www.dw.com/ar/' },
  { name: { ar: 'يورونيوز', en: 'Euronews' }, url: 'https://arabic.euronews.com/' },
  { name: { ar: 'إن إتش كيه اليابانية', en: 'NHK World-Japan' }, url: 'https://www3.nhk.or.jp/nhkworld/en/news/' },
] as const;
