/** Unified-context Phase 1: pure conversion, compatibility, privacy-summary and scope-isolation tests. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { chatHistory } from '../src/utils/chatStore';
import type { ChatMessage } from '../src/utils/chatStorage';
import {
  compareLegacyContext,
  coreMessageToUnifiedTurn,
  createUnifiedConversationContext,
  shaheenMessageToUnifiedTurn,
  UNIFIED_CONTEXT_VERSION,
} from '../src/utils/unifiedConversationContext';

test('Unified Context v1 preserves Core roles, message order, citations and metadata', () => {
  const original = [
    { id: 'core-1', role: 'user' as const, text: 'سؤال أول', at: 't1' },
    { id: 'core-2', role: 'assistant' as const, text: 'إجابة بمصدر', at: 't2', citations: [{ id: 'kb-1', title: 'دليل', kind: 'knowledge' }], intent: 'question', engine: 'sham_local' },
  ];
  const context = createUnifiedConversationContext({
    surface: 'sham-core',
    scope: { visitorId: 'visitor-A', conversationId: 'conversation-A' },
    turns: original.map(coreMessageToUnifiedTurn),
  });
  assert.equal(context.version, UNIFIED_CONTEXT_VERSION);
  assert.deepEqual(context.turns.map(({ role, text }) => ({ role, text })), original.map(({ role, text }) => ({ role, text })));
  assert.deepEqual(context.turns[1].sources, original[1].citations);
  assert.equal(context.turns[1].metadata?.intent, 'question');
  assert.equal(context.turns[1].metadata?.engine, 'sham_local');
  assert.equal(context.turns[1].metadata?.at, 't2');
  assert.deepEqual(context.turns[1].metadata?.citations, original[1].citations);
  assert.equal(context.scope?.visitorId, 'visitor-A');
});

test('Unified Context v1 preserves Shaheen source metadata and does not mutate its input', () => {
  const source = [{ title: 'مقال', url: 'https://example.invalid/article' }];
  const input = { id: 'shaheen-1', role: 'assistant' as const, text: 'رد موثق', timestamp: 't1', sources: source, aiEngine: { id: 'auto' },
    perspectives: [{ modelId: 'openai', reply: 'مختصر', privateTag: 'kept-in-memory' }],
    image: { thumb: 'synthetic-thumbnail-payload', text: 'معلومة OCR' } };
  const context = createUnifiedConversationContext({ surface: 'shaheen', turns: [shaheenMessageToUnifiedTurn(input)] });
  assert.deepEqual(context.turns[0].sources, source);
  assert.notEqual(context.turns[0].sources, source, 'source metadata is detached from mutable caller data');
  assert.equal(context.turns[0].metadata?.aiEngine && (context.turns[0].metadata?.aiEngine as { id: string }).id, 'auto');
  assert.deepEqual(context.turns[0].metadata?.perspectives, input.perspectives);
  assert.deepEqual(context.turns[0].metadata?.image, input.image);
  assert.notEqual(context.turns[0].metadata?.image, input.image, 'all original turn metadata is detached');
  assert.equal(input.text, 'رد موثق');
});

test('shadow comparison reports only structure and never emits text, visitor IDs or conversation IDs', () => {
  const secretText = 'PRIVATE synthetic visitor detail';
  const context = createUnifiedConversationContext({
    surface: 'sham-core',
    scope: { visitorId: 'private-visitor-id', conversationId: 'private-conversation-id' },
    turns: [{ role: 'user', text: secretText }],
    currentMessage: { role: 'user', text: 'سؤال نهائي' },
  });
  const summary = compareLegacyContext([{ role: 'user', text: secretText }, { role: 'user', text: 'سؤال نهائي' }], context);
  const serialized = JSON.stringify(summary);
  assert.equal(summary.legacySequencePreserved, true);
  assert.equal(summary.scopeBound, true);
  assert.doesNotMatch(serialized, /PRIVATE|private-visitor-id|private-conversation-id/);
});

test('separate visitor/conversation scopes cannot share turns through the context builder', () => {
  const a = createUnifiedConversationContext({
    surface: 'sham-core', scope: { visitorId: 'visitor-A', conversationId: 'conversation-A' },
    turns: [{ role: 'user', text: 'بيانات A' }],
  });
  const b = createUnifiedConversationContext({
    surface: 'sham-core', scope: { visitorId: 'visitor-B', conversationId: 'conversation-B' },
    turns: [{ role: 'user', text: 'بيانات B' }],
  });
  assert.deepEqual(a.turns.map((turn) => turn.text), ['بيانات A']);
  assert.deepEqual(b.turns.map((turn) => turn.text), ['بيانات B']);
  assert.equal(compareLegacyContext([{ role: 'user', text: 'بيانات B' }], a).legacySequencePreserved, false);
});

test('a shadow snapshot failure cannot change the existing Shaheen history sent to the server', () => {
  const malformed = [{ id: 'legacy-only', role: 'user', text: 'legacy message', timestamp: 't1', toolReport: { unserializable: () => 'private' } }] as unknown as ChatMessage[];
  const history = chatHistory(malformed);
  assert.deepEqual(history.map((turn) => ({ role: turn.role, text: turn.text })), [{ role: 'user', text: 'legacy message' }]);
});

test('Core shadow context contains the full 40-turn transcript and preserves the legacy 10-turn sequence', () => {
  const full = Array.from({ length: 40 }, (_, i) => ({ role: i % 2 ? 'assistant' as const : 'user' as const, text: `core-turn-${i + 1}` }));
  const shadow = createUnifiedConversationContext({
    surface: 'sham-core',
    scope: { visitorId: 'visitor-core', conversationId: 'conversation-core' },
    turns: full,
    currentMessage: { role: 'user', text: 'core-current' },
  });
  const legacy = [...full.slice(-10), { role: 'user' as const, text: 'core-current' }];
  const report = compareLegacyContext(legacy, shadow);
  assert.equal(report.legacyTurnCount, 11);
  assert.equal(report.unifiedTurnCount, 41);
  assert.equal(report.legacySequencePreserved, true);
  assert.equal(report.scopeBound, true);
});

test('Shaheen shadow envelope contains the available 40-turn transcript without reordering legacy history', () => {
  const full = Array.from({ length: 40 }, (_, i) => ({ role: i % 2 ? 'assistant' as const : 'user' as const, text: `shaheen-turn-${i + 1}` }));
  const shadow = createUnifiedConversationContext({ surface: 'shaheen', turns: full });
  const legacy = full.slice(-24);
  const report = compareLegacyContext(legacy, shadow);
  assert.equal(report.legacyTurnCount, 24);
  assert.equal(report.unifiedTurnCount, 40);
  assert.equal(report.legacySequencePreserved, true);
});
