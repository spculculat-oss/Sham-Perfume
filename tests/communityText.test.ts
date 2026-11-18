import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CommunityText } from '../src/community/CommunityText';

test('member post text links HTTP(S) and www URLs alongside prose with safe link attributes', () => {
  const html = renderToStaticMarkup(React.createElement(CommunityText, {
    text: 'جرّبت التركيبة اليوم https://example.com/perfume?x=1، وكانت جميلة. ثم www.sham.test/guide', hashtags: true,
  }));
  assert.match(html, /href="https:\/\/example\.com\/perfume\?x=1"/);
  assert.match(html, /target="_blank" rel="noopener noreferrer nofollow"/);
  assert.match(html, /https:\/\/www\.sham\.test\/guide/);
  assert.match(html, /جرّبت التركيبة اليوم/);
  assert.match(html, /كانت جميلة/);
});

test('only http and https are linkified and unsafe markup stays escaped text', () => {
  const html = renderToStaticMarkup(React.createElement(CommunityText, {
    text: 'javascript:alert(1) data:text/html,<b>no</b> https://example.com <script>alert(1)</script>',
  }));
  assert.equal((html.match(/<a\b/g) || []).length, 1);
  assert.doesNotMatch(html, /href="javascript:/i);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /href="https:\/\/example\.com\/"/);
});

test('post links followed by sentence punctuation preserve punctuation outside the clickable URL', () => {
  const html = renderToStaticMarkup(React.createElement(CommunityText, { text: 'See https://example.com/page.' }));
  assert.match(html, /href="https:\/\/example\.com\/page"/);
  assert.match(html, /<\/a>\./);
});
