import type { LText } from '../لغات/localize';
import { HEADLINE_PUBLISHERS, MORE_WORLD_NEWS_LINKS, WORLD_HEADLINE_PUBLISHERS } from './homeHeadlineEditions';
import { localPressDirectory } from './localPressDirectories';

export interface PressCard {
  name: LText;
  url: string;
}

// The picture directory is built from the registry, not from the latest API results. A paper
// never disappears when it has no current headline, permissions or working feed.
export const WORLD_PRESS_CARDS: readonly PressCard[] = [
  ...MORE_WORLD_NEWS_LINKS,
  ...WORLD_HEADLINE_PUBLISHERS.map((publisher) => ({ name: HEADLINE_PUBLISHERS[publisher].name, url: HEADLINE_PUBLISHERS[publisher].page })),
];

export function countryPressCards(country: string | null): PressCard[] {
  return localPressDirectory(country)?.links.map(([name, url, en]) => ({ name: { ar: name, en: en || name }, url })) ?? [];
}
