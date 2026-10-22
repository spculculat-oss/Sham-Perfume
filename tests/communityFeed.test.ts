import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { feedCursor, mergeFeed } from '../src/community/feed';
import CommunityDirectory, { communitySections } from '../src/community/CommunityDirectory';
import type { Post } from '../src/community/api';

const post = (id: string, comments = 0, recipe = false) => ({ id, createdAt: `2026-10-22T00:00:0${id}Z`, comments, reactions: {}, ...(recipe ? { recipe: { id: 'recipe' } } : {}) }) as Post;

test('filtered empty pages retain a server cursor so more recipes can be loaded', () => {
  const page = [post('3'), post('2'), post('1')];
  assert.deepEqual(mergeFeed([], page, 'recipes'), []);
  assert.equal(feedCursor(page), page[2].createdAt);
  assert.equal(feedCursor([]), undefined);
});
test('ranking never determines the pagination cursor and sorts all loaded posts', () => {
  const page = [post('3', 8), post('2', 20), post('1', 9)];
  assert.deepEqual(mergeFeed([post('4', 10)], page, 'trending').map(p => p.id), ['2', '4', '1', '3']);
  assert.equal(feedCursor(page), page[2].createdAt);
});
test('loading overlapping pages updates cards without duplicate keys', () => {
  const result = mergeFeed([post('2'), post('1')], [post('1', 4)], 'all');
  assert.equal(result.length, 2);
  assert.equal(result[1].comments, 4);
  assert.deepEqual(mergeFeed([], [post('2'), post('1', 0, true)], 'recipes').map(p => p.id), ['1']);
});
test('community directory exposes unique real destinations and bilingual copy', () => {
  const routes = communitySections.flatMap(section => section.links.map(link => link.route));
  assert.equal(new Set(routes).size, routes.length);
  for (const lang of ['ar', 'en'] as const) {
    const html = renderToStaticMarkup(React.createElement(CommunityDirectory, { lang, go: () => {} }));
    assert.equal((html.match(/<button/g) || []).length, routes.length);
    assert.ok(html.includes(lang === 'ar' ? 'سوق التجار' : 'Merchants’ market'));
  }
});
