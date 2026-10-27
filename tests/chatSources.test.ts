import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appendRequestedSources, asksForSources, hideUnrequestedSources, isSourcesFollowUp, requestedSourcesReply, safeChatSources } from '../src/utils/chatSources';

test('distinguishes explicit citation requests from questions about a topic', () => {
  assert.equal(isSourcesFollowUp('مصدر؟'), true);
  assert.equal(isSourcesFollowUp('هات المصادر لو سمحت'), true);
  assert.equal(isSourcesFollowUp("what's your source?"), true);
  assert.equal(isSourcesFollowUp('فين لقيت المعلومة؟'), true);
  assert.equal(isSourcesFollowUp('ممكن أعرف مصادرك؟'), true);
  assert.equal(asksForSources('What sources did you use?'), true);
  assert.equal(asksForSources('هات مصادر عن البخور'), true);
  assert.equal(asksForSources('ما مصادر الطاقة المتجددة؟'), false);
  assert.equal(asksForSources('What are the sources of renewable energy?'), false);
});

test('keeps only bounded public HTTPS source metadata', () => {
  assert.deepEqual(safeChatSources([
    { title: ' Study\n  notes ', url: 'https://example.org/paper' },
    { title: 'Study notes', url: 'https://example.org/paper' },
  ]), [{ title: 'Study notes', url: 'https://example.org/paper' }]);
  for (const url of ['http://example.org', 'https://localhost/paper', 'https://127.0.0.1/paper', 'https://192.168.1.1/paper']) {
    assert.equal(safeChatSources([{ title: 'unsafe', url }]), undefined, url);
  }
  assert.equal(safeChatSources(Array.from({ length: 6 }, (_, index) => ({ title: `source ${index}`, url: `https://example.org/${index}` }))), undefined);
});

test('hides citation-style links and numbered references from ordinary text', () => {
  const reply = `The result [came from a study](https://example.org/paper).
### Sources
- [Wikipedia](https://another.example/paper) [1]`;
  assert.equal(hideUnrequestedSources(reply), 'The result.');
  const product = '[Hawas Ice](/p/hawas-ice.html)';
  assert.equal(hideUnrequestedSources(product), product, 'store product links are not research citations');
  const absoluteProduct = '[Hawas Ice](https://shop.example/p/hawas-ice.html)';
  assert.equal(hideUnrequestedSources(absoluteProduct), absoluteProduct);
});

test('renders links only in an explicit source reply', () => {
  const sources = [{ title: 'A [study]', url: 'https://example.org/paper' }];
  assert.doesNotMatch(requestedSourcesReply([], 'ar'), /https:\/\//);
  assert.match(requestedSourcesReply(sources, 'ar'), /\[A study\]\(https:\/\/example\.org\/paper\)/);
  assert.match(requestedSourcesReply([{ title: 'Wiki', url: 'https://ar.wikipedia.org/wiki/example' }], 'ar'), /CC BY-SA/);
  assert.match(appendRequestedSources('الخلاصة', sources, 'ar'), /المصادر:/);
  assert.match(appendRequestedSources('Summary', [], 'en'), /won't invent references/);
});
