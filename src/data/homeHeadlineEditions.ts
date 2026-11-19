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
} as const;

export type HeadlinePublisher = keyof typeof HEADLINE_PUBLISHERS;
export interface HeadlineFeed { url: string; publisher: HeadlinePublisher }
export interface HeadlineEdition {
  timeZone: string;
  official?: boolean;
  feeds: readonly HeadlineFeed[];
}
const editions: Readonly<Record<string, HeadlineEdition>> = {
  EG: {
    timeZone: 'Africa/Cairo',
    feeds: [{ publisher: 'youm7', url: 'https://www.youm7.com/rss/SectionRss?SectionID=97' }],
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
  feeds: [{ publisher: 'youm7', url: 'https://www.youm7.com/rss/SectionRss?SectionID=286' }],
};
