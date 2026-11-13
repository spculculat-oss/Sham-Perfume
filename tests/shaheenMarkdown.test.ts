import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ShaheenMarkdown, stripFormulaBlock } from '../src/components/ShaheenMarkdown';

const formula = '```sham-formula\n{"title":"x"}\n```';

test('speech and copy text drop the machine-readable formula block', () => {
  assert.equal(stripFormulaBlock(`### عطر\nنص${'\n'}${formula}`).includes('sham-formula'), false);
});

test('Markdown is rendered safely: headings, bold, tables, no raw formula JSON, no injected HTML', () => {
  const html = renderToStaticMarkup(createElement(ShaheenMarkdown, {
    text: `### العنوان\n**عريض** و *مائل*\n\n| أ | ب |\n|---|---|\n| 1 | 2 |\n\n- بند\n\n<img src=x onerror=alert(1)>\n${formula}`,
  }));
  assert.match(html, /font-bold[^>]*>العنوان</);
  assert.match(html, /<strong[^>]*>عريض<\/strong>/);
  assert.match(html, /<table/);
  assert.match(html, /<li[^>]*>بند<\/li>/);
  assert.doesNotMatch(html, /sham-formula|"title"/);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/, 'raw HTML is shown as text, never executed');
});
