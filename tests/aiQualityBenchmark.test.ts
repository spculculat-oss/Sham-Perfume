/**
 * Phase-zero AI quality benchmark: deterministic, offline characterization of existing behavior.
 * These tests do not call an LLM, network service, or production endpoint.
 * They intentionally record current behavior; they are not claims about general model intelligence.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { extractEntities, routeEnhanced } from '../server/core/router';
import { defaultServices } from '../server/core/seed';
import { Repository } from '../server/core/repository';
import { MemoryStore } from '../server/core/store';
import { resolveDialect } from '../src/utils/arabicDialect';
import { chatHistory } from '../src/utils/chatStore';
import type { ChatMessage } from '../src/utils/chatStorage';
import { fromFlatMemory, toFlatMemory, extractPreferencesFromEntities, emptyVisitorMemory } from '../server/core/visitor-memory';

test('quality baseline: detects Egyptian colloquial Arabic and keeps an explicit dialect choice', () => {
  assert.equal(resolveDialect({ texts: ['عايز عطر حلو دلوقتي'] }), 'egyptian');
  assert.equal(resolveDialect({ choice: 'levantine', texts: ['عايز عطر حلو'] }), 'levantine');
});

test('quality baseline: resolves an indirect purchase follow-up using the prior service', () => {
  const decision = routeEnhanced('طيب عايز أطلبه', defaultServices(), 'browse_products', 'store');
  assert.equal(decision.intent, 'service_request');
  assert.equal(decision.serviceId, 'store');
});

test('quality baseline: explicit preferences survive the structured-memory serialization round trip', () => {
  const visitorId = 'visitor-benchmark-offline';
  const entities = extractEntities('اسمي سلمى وبحب العود والمسك وميزانيتي في حدود 800');
  const memory = extractPreferencesFromEntities(emptyVisitorMemory(visitorId), entities);
  const restored = fromFlatMemory(visitorId, toFlatMemory(memory));
  assert.equal(restored.preferences.name, 'سلمى');
  assert.ok(restored.preferences.perfumeNotes?.some((note) => /عود/.test(note)));
  assert.equal(restored.preferences.budget, 800);
});

test('quality baseline: Core history is bounded to recent turns, so an old turn among 30 is not sent', () => {
  const messages = Array.from({ length: 30 }, (_, index) => ({
    id: `benchmark-${index + 1}`,
    role: index % 2 === 0 ? 'user' : 'assistant',
    text: `turn-${index + 1}`,
  })) as ChatMessage[];
  const history = chatHistory(messages);
  assert.ok(history.length <= 24, `expected the existing 24-turn cap, got ${history.length}`);
  assert.equal(history.some((turn) => turn.text === 'turn-30'), true, 'the newest turn is retained');
  assert.equal(history.some((turn) => turn.text === 'turn-1'), false, 'the oldest turn is outside the current request context');
});

 test('quality baseline: Core memory is persisted by visitor id independently of a conversation transcript', async () => {
  const repo = new Repository(new MemoryStore(), {});
  await repo.touchVisitor('visitor-benchmark-offline', 'conversation-a', { preferredNotes: 'عود' });
  const profile = await repo.visitor('visitor-benchmark-offline');
  assert.equal(profile?.memory.preferredNotes, 'عود');
  assert.deepEqual(profile?.conversationIds, ['conversation-a']);
});
