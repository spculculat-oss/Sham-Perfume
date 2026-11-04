import type { Post } from './api';

export type FeedScope = 'saved' | 'all' | 'friends' | 'recipes' | 'trending' | 'general-news';

/** Keep the cursor on the raw server page, never on filtered or ranked cards. */
export function feedCursor(page: Post[]): string | undefined {
  return page.at(-1)?.createdAt;
}

export function mergeFeed(previous: Post[], page: Post[], scope: FeedScope): Post[] {
  const unique = [...new Map([...previous, ...page].map(post => [post.id, post])).values()];
  if (scope === 'recipes') return unique.filter(post => Boolean(post.recipe));
  if (scope === 'trending') {
    const score = (post: Post) => Object.values(post.reactions).reduce((sum, n) => sum + n, 0) + post.comments;
    return unique.sort((a, b) => score(b) - score(a) || b.createdAt.localeCompare(a.createdAt));
  }
  return unique;
}
