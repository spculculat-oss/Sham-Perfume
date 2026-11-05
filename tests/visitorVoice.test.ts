/** Voluntary visitor suggestions: consent, minimal data, local topics and manual administration. */
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import express from 'express';
import { MemoryStore } from '../server/core/store';
import { createInsightsService } from '../server/insights';
import {
  analyzeSuggestionTopics, readVisitorSuggestion, suggestionExpired, summarizeVisitorSuggestions,
  VISITOR_SUGGESTION_RETENTION_DAYS, type VisitorSuggestion,
} from '../src/utils/visitorVoice';

class DurableTestStore extends MemoryStore {
  override readonly kind = 'file' as const;
  override readonly persistent = true;
}

async function withService<T>(store: MemoryStore, run: (base: string) => Promise<T>, clock: () => Date = () => new Date('2026-10-18T12:00:00.000Z')) {
  const service = createInsightsService({ store, now: clock, products: [] });
  const app = express();
  app.use(express.json());
  app.use('/api/insights', service.router);
  app.use('/api/admin/insights', service.admin);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  try { return await run(base); }
  finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

const submit = (base: string, body: unknown, headers: Record<string, string> = {}) => fetch(`${base}/insights/suggestions`, {
  method: 'POST', headers: { 'Content-Type': 'text/plain', ...headers }, body: JSON.stringify(body),
});

test('suggestion intake requires explicit agreement, validates fields, and scrubs personal contact data', () => {
  const parsed = readVisitorSuggestion({
    text: 'Please improve fragrance recommendations; contact: hello@example.com, order SH-AB1234, number 123456789.',
    kind: 'idea', language: 'en', agree: true, visitorId: 'not-stored', accountId: 'not-stored-either',
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.redacted, true);
  assert.equal(parsed.input.kind, 'idea');
  assert.equal(parsed.input.language, 'en');
  assert.match(parsed.input.text, /\[بريد\]/);
  assert.match(parsed.input.text, /\[رقم طلب\]/);
  assert.doesNotMatch(parsed.input.text, /hello@example\.com|123456789|SH-AB1234/);
  assert.equal('visitorId' in parsed.input, false);
  assert.equal('accountId' in parsed.input, false);
  assert.equal(readVisitorSuggestion({ text: 'A useful short idea', kind: 'idea', agree: false }).ok, false);
  assert.equal(readVisitorSuggestion({ text: 'Short!', kind: 'idea', agree: true }).ok, false);
  assert.equal(readVisitorSuggestion({ text: 'A clear suggestion for the store', kind: 'other', agree: true }).ok, false);
});

test('suggestion intake refuses secrets and explicit personal details before storage', () => {
  const secret = readVisitorSuggestion({ text: 'Please improve the page; my password is abc12345', kind: 'problem', agree: true });
  assert.deepEqual(secret, { ok: false, reason: 'secret' });
  const name = readVisitorSuggestion({ text: 'اسمي أحمد وأقترح تحسين صفحة الترشيحات', kind: 'idea', agree: true });
  assert.deepEqual(name, { ok: false, reason: 'personal' });
  const address = readVisitorSuggestion({ text: 'My address is 12 Main Street; please fix shipping', kind: 'problem', agree: true });
  assert.deepEqual(address, { ok: false, reason: 'personal' });
});

test('topics are local keyword tags, summaries aggregate topics without an emotional or personal profile', () => {
  assert.deepEqual(analyzeSuggestionTopics('عايز ترشيحات عطور أحسن وشحن أسرع'), ['recommendations', 'catalog', 'delivery']);
  assert.deepEqual(analyzeSuggestionTopics('A pleasant experience'), ['other']);
  const items: VisitorSuggestion[] = [
    { id: 'one', text: 'text', kind: 'idea', topics: ['recommendations', 'catalog'], status: 'new', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' },
    { id: 'two', text: 'text', kind: 'problem', topics: ['delivery'], status: 'reviewed', createdAt: '2026-10-02T00:00:00.000Z', updatedAt: '2026-10-02T00:00:00.000Z' },
  ];
  assert.deepEqual(summarizeVisitorSuggestions(items), {
    total: 2, new: 1,
    kinds: { idea: 1, problem: 1, praise: 0 },
    topics: { recommendations: 1, catalog: 1, navigation: 0, pricing: 0, delivery: 1, support: 0, language: 0, other: 0 },
  });
  assert.equal(VISITOR_SUGGESTION_RETENTION_DAYS, 180);
  assert.equal(suggestionExpired(items[0], new Date('2026-10-01T00:00:00.000Z')), false, 'it is kept before its expiry instant');
  assert.equal(suggestionExpired({ ...items[0], createdAt: '2026-04-04T00:00:00.000Z' }, new Date('2026-10-01T00:00:00.000Z')), true, 'it expires at 180 days exactly');
});

test('public route stores only voluntarily submitted, scrubbed text in durable storage; admin can review, update and delete', async () => {
  const store = new DurableTestStore();
  await withService(store, async (base) => {
    const response = await submit(base, {
      text: 'Please improve perfume recommendations; contact: hello@example.com', kind: 'idea', language: 'en', agree: true,
      visitorId: 'client-visitor-id', accountId: 'client-account-id', email: 'client@example.com',
    });
    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), { accepted: true, redacted: true, persistent: true });

    const records = await store.list('visitorSuggestions');
    assert.equal(records.length, 1);
    const saved = records[0];
    assert.match(saved.id, /^suggestion-[0-9a-f-]{36}$/i);
    assert.match(saved.text, /\[بريد\]/);
    assert.equal(saved.topics.includes('recommendations'), true);
    assert.equal(JSON.stringify(saved).includes('client-visitor-id'), false);
    assert.equal(JSON.stringify(saved).includes('client-account-id'), false);
    assert.equal(JSON.stringify(saved).includes('client@example.com'), false);

    const inbox = await (await fetch(`${base}/admin/insights/suggestions`)).json() as { retentionDays: number; summary: { total: number; new: number }; items: VisitorSuggestion[] };
    assert.equal(inbox.retentionDays, 180);
    assert.deepEqual([inbox.summary.total, inbox.summary.new], [1, 1]);
    assert.equal(inbox.items[0].id, saved.id);

    const changed = await fetch(`${base}/admin/insights/suggestions/${encodeURIComponent(saved.id)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'reviewed' }),
    });
    assert.equal(changed.status, 200);
    assert.equal((await changed.json() as { item: VisitorSuggestion }).item.status, 'reviewed');
    const deleted = await fetch(`${base}/admin/insights/suggestions/${encodeURIComponent(saved.id)}`, { method: 'DELETE' });
    assert.deepEqual(await deleted.json(), { deleted: true });
    assert.equal((await store.list('visitorSuggestions')).length, 0);

    const invalid = await submit(base, { text: 'A helpful suggestion for navigation', kind: 'idea', agree: false });
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json() as { code: string }).code, 'INVALID_SUGGESTION');

    const crawler = await submit(base, { text: 'A helpful suggestion for navigation', kind: 'idea', agree: true }, { 'user-agent': 'Googlebot/2.1' });
    assert.equal((await crawler.json() as { accepted: boolean }).accepted, false);
    assert.equal((await store.list('visitorSuggestions')).length, 0);
  });
});

test('expired suggestions are physically deleted on the first subsequent serverless request', async () => {
  const store = new DurableTestStore();
  const at = new Date('2026-10-18T12:00:00.000Z');
  const createdAt = new Date(at.getTime() - (VISITOR_SUGGESTION_RETENTION_DAYS + 1) * 86_400_000).toISOString();
  await store.create('visitorSuggestions', 'suggestion-expired', {
    id: 'suggestion-expired', text: 'An old suggestion for the store', kind: 'idea', topics: ['other'], status: 'new',
    createdAt, updatedAt: createdAt,
  });
  await withService(store, async (base) => {
    const response = await fetch(`${base}/insights/pulse`, {
      method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}',
    });
    assert.equal(response.status, 202);
    assert.deepEqual(await store.list('visitorSuggestions'), []);
  }, () => at);
});

test('public route refuses non-persistent storage instead of falsely confirming receipt', async () => {
  const store = new MemoryStore();
  await withService(store, async (base) => {
    const response = await submit(base, { text: 'Please improve store navigation', kind: 'idea', agree: true });
    assert.equal(response.status, 503);
    assert.equal((await response.json() as { code: string }).code, 'STORAGE_UNAVAILABLE');
    assert.equal((await store.list('visitorSuggestions')).length, 0);
  });
});
