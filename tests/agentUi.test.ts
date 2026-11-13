import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ShaheenAgentPanel, ShaheenAgentReport } from '../src/components/ShaheenAgentPanel';
import { agentSettings } from '../src/hooks/useShaheenAgent';
import { ApiError } from '../src/utils/api';
import { chatErrorText } from '../src/components/ShaheenServiceStatus';

test('agent controls disclose limits and default to opt-in, with shared ephemeral documents', () => {
  agentSettings.update({ agent: false, documents: [], webSearch: false });
  const first = renderToStaticMarkup(createElement(ShaheenAgentPanel, { language: 'ar' }));
  assert.match(first, /وضع الوكيل/);
  assert.match(first, /حتى 5 طلبات/);
  assert.match(first, /لا ينفّذ كوداً/);
  assert.doesNotMatch(first, /checked=""/);
  agentSettings.update({ agent: true, documents: [{ name: 'notes.txt', text: 'confidential' }] });
  const second = renderToStaticMarkup(createElement(ShaheenAgentPanel, { language: 'en' }));
  assert.match(second, /notes.txt/);
  assert.match(second, /Attach text file/);
  assert.match(second, /Web search unavailable/);
  assert.doesNotMatch(second, /confidential/); // never auto-render attachment contents
  agentSettings.clearDocuments();
  assert.deepEqual(agentSettings.getSnapshot().documents, []);
  agentSettings.update({ agent: false });
});

test('tool reports render actual step status and download controls, not active content', () => {
  const markup = renderToStaticMarkup(createElement(ShaheenAgentReport, { language: 'en', report: {
    steps: [{ tool: 'calculate', status: 'completed' }, { tool: 'web_search', status: 'failed' }],
    artifacts: [{ name: 'report.txt', content: '<script>not executable or rendered</script>' }],
  } }));
  assert.match(markup, /calculate — completed/);
  assert.match(markup, /web_search — failed/);
  assert.match(markup, /Download prepared file/);
  assert.doesNotMatch(markup, /<script>|not executable or rendered/);
  const unsafe = renderToStaticMarkup(createElement(ShaheenAgentReport, { language: 'en', report: {
    steps: [], artifacts: [{ name: '../a.html', content: 'bad' }],
  } }));
  assert.equal(unsafe, '');
});

test('quota and auth failures produce distinct useful messages instead of the old generic notice', () => {
  const quota = chatErrorText('ar', new ApiError(503, 'PROVIDER_RATE_LIMITED'));
  assert.match(quota, /الحصة/);
  assert.match(quota, /تغيير المفتاح/);
  assert.notEqual(quota, chatErrorText('ar', new ApiError(503, 'PROVIDER_AUTH_FAILED')));
  assert.match(chatErrorText('en', new ApiError(502, 'AGENT_INVALID_RESPONSE')), /step budget/);
});
