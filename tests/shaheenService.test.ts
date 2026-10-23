/**
 * «مكتب خدمة العملاء الآلي»: the published support knowledge is complete, the live desk is read as aggregates
 * only (no name, phone, e-mail, order reference or message text reaches the report), the SLA queue is honest,
 * and with no live account the report says so instead of showing a zero.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildServiceDesk, feedbackCategories, isServiceFile, serviceInbox, serviceKnowledge, serviceTemplates,
  HANDOFF_SLA_HOURS, REQUEST_SLA_HOURS, SERVICE_REQUIRED_TOPICS,
} from '../scripts/shaheen-service/desk';

const NOW = Date.parse('2026-10-23T12:00:00Z');
const ago = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const live = { checked: true, at: ago(0), failed: [] };

test('the support answers the visitors need are published, complete in Arabic and English, and tagged', () => {
  const knowledge = serviceKnowledge();
  assert.equal(SERVICE_REQUIRED_TOPICS.length, 6);
  assert.deepEqual(knowledge.missing, []);
  assert.deepEqual(knowledge.thin, []);
  assert.equal(knowledge.coverage, 100);
  assert.ok(knowledge.topics.includes('kb-store-tracking'));
  assert.equal(knowledge.shippingZones, 7);
  assert.deepEqual(knowledge.zonesWithoutDays, [], 'every shipping zone states its delivery window');
});

test('ready replies come from the published answer itself — an empty topic never invents one', () => {
  const templates = serviceTemplates();
  assert.equal(templates.length, 6);
  const ids = templates.map((template) => template.topic);
  assert.deepEqual([...ids].sort(), SERVICE_REQUIRED_TOPICS.map((topic) => topic.id).sort());
  for (const template of templates) {
    assert.ok(template.replyAr.length > 120, template.topic);
    assert.ok(template.whenAr.length > 10, template.topic);
    assert.ok(!/gemini|openai|claude|deepseek|chatgpt|\bgpt\b/i.test(template.replyAr), template.topic);
    assert.ok(!/\d+\s*%|خصم اليوم|كود خصم/i.test(template.replyAr), `${template.topic}: no discount promise`);
  }
  assert.match(templates.find((template) => template.topic === 'kb-store-tracking')!.replyAr, /SH-/);
});

test('the live desk is aggregated: waiting conversations and late requests become the queue, never personal data', () => {
  const report = buildServiceDesk({
    now: NOW,
    live,
    overview: { counts: { handoffsOpen: 1, requestsNew: 1, gapsOpen: 1 } },
    conversations: [
      { id: 'c1', status: 'handoff', updatedAt: ago(9), visitorId: 'PRIVATE-VISITOR', lastMessage: 'PRIVATE-MESSAGE' },
      { id: 'c2', status: 'open', updatedAt: ago(1), visitorId: 'PRIVATE-VISITOR-2' },
    ],
    requests: [
      { id: 'r1', status: 'new', createdAt: ago(30), contact: { name: 'PRIVATE-NAME', phone: '01000000000' }, fields: { note: 'PRIVATE-NOTE' }, total: 987654, currency: 'EGP' },
      { id: 'r2', status: 'completed', createdAt: ago(50), items: [{ sku: 'A-1', quantity: 2 }] },
    ],
    gaps: [
      { id: 'g1', status: 'open', count: 4, question: 'PRIVATE-QUESTION', lastAnswer: 'PRIVATE-ANSWER' },
      { id: 'g2', status: 'resolved', count: 9, question: 'PRIVATE-QUESTION-2' },
    ],
    feedback: [
      { rating: 'down', at: ago(2), reason: 'الشحن اتأخر', question: 'PRIVATE-Q', answer: 'PRIVATE-A' },
      { rating: 'down', at: ago(30), reason: 'السعر غالي' },
      { rating: 'up', at: ago(1), reason: 'تمام' },
    ],
  });

  assert.ok(isServiceFile(report));
  assert.equal(report.live.checked, true);
  assert.equal(report.inbox.openHandoffs, 1);
  assert.equal(report.inbox.oldestHandoffHours, 9);
  assert.equal(report.inbox.newRequests, 1);
  assert.equal(report.inbox.unresolvedRequests, 1);
  assert.equal(report.inbox.oldestUnresolvedHours, 30);
  assert.equal(report.inbox.negativeFeedback24h, 1, 'only the last 24 hours');
  assert.equal(report.inbox.openGaps, 1);
  assert.equal(report.inbox.topGapCount, 4);
  assert.ok(report.problems.some((problem) => problem.includes('محادثة مستنية موظف') && problem.includes(String(HANDOFF_SLA_HOURS))));
  assert.ok(report.problems.some((problem) => problem.includes('طلب مفتوح') && problem.includes(String(REQUEST_SLA_HOURS))));
  assert.ok(report.queue.some((item) => item.priority === 'urgent'));
  assert.ok(report.queue.some((item) => /سؤال الزوار/.test(item.textAr)));
  assert.ok(report.summaryAr.includes('تغطية معلومات الدعم 100%'));
  assert.match(report.desk.modeAr, /أرقام حقيقية/);

  const text = JSON.stringify(report);
  for (const secret of ['PRIVATE-VISITOR', 'PRIVATE-MESSAGE', 'PRIVATE-NAME', '01000000000', 'PRIVATE-NOTE', '987654', 'PRIVATE-QUESTION', 'PRIVATE-ANSWER', 'PRIVATE-Q', 'PRIVATE-A']) {
    assert.ok(!text.includes(secret), `${secret} leaked into the public report`);
  }
});

test('a short handoff waits in the queue but is not called late before its SLA', () => {
  const inbox = serviceInbox({
    now: NOW, live,
    conversations: [{ status: 'handoff', updatedAt: ago(2) }],
  });
  assert.equal(inbox.openHandoffs, 1);
  assert.equal(inbox.oldestHandoffHours, 2);
  const report = buildServiceDesk({ now: NOW, live, conversations: [{ status: 'handoff', updatedAt: ago(2) }] });
  assert.ok(!report.problems.some((problem) => problem.includes('محادثة مستنية موظف')));
  assert.ok(report.queue.some((item) => item.priority === 'high'));
});

test('without the live account the report says the numbers are unknown — it never shows zeros or guesses', () => {
  const report = buildServiceDesk({ now: NOW, live: { checked: false, failed: ['token:NO_ADMIN_TOKEN'] } });
  assert.equal(report.live.checked, false);
  assert.deepEqual(report.live.failed, ['token:NO_ADMIN_TOKEN']);
  assert.equal(report.inbox.openHandoffs, null);
  assert.equal(report.inbox.newRequests, null);
  assert.equal(report.inbox.unresolvedRequests, null);
  assert.equal(report.inbox.negativeFeedback24h, null);
  assert.match(report.summaryAr, /مش مقروء/);
  assert.match(report.desk.modeAr, /مش متاحة/);
  assert.equal(report.knowledge.coverage, 100, 'the published knowledge is still audited');
  assert.ok(report.problems.some((problem) => problem.includes('NO_ADMIN_TOKEN')));
  assert.ok(report.templates.length, 'the ready replies are still prepared');
});

test('a partially readable desk keeps the numbers it has and names the failed endpoint', () => {
  const report = buildServiceDesk({
    now: NOW,
    live: { checked: true, failed: ['gaps:HTTP_500'] },
    overview: { counts: { handoffsOpen: 2, requestsNew: 3, gapsOpen: 7 } },
    requests: [{ status: 'new', createdAt: ago(1) }],
    conversations: [{ status: 'handoff', updatedAt: ago(1) }],
  });
  assert.equal(report.inbox.openHandoffs, 1, 'the conversations endpoint is authoritative');
  assert.equal(report.inbox.newRequests, 1);
  assert.equal(report.inbox.openGaps, 7, 'the overview is the fallback when gaps failed');
  assert.ok(report.problems.some((problem) => problem.includes('gaps:HTTP_500')));
});

test('negative ratings are grouped by topic, never by the visitor wording', () => {
  const result = feedbackCategories([
    { rating: 'down', at: ago(1), reason: 'الشحن اتأخر' },
    { rating: 'down', at: ago(2), reason: 'التوصيل بطيء' },
    { rating: 'down', at: ago(3), reason: 'المنتج تالف' },
    { rating: 'down', at: ago(4), reason: 'حاجة غريبة' },
    { rating: 'down', at: ago(40), reason: 'الشحن قديم' },
    { rating: 'up', at: ago(1), reason: 'تمام' },
  ], NOW);
  assert.equal(result.down24, 4);
  assert.deepEqual(result.categories, [{ id: 'delivery', count: 2 }, { id: 'product', count: 1 }, { id: 'other', count: 1 }]);
});
