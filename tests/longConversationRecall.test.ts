/**
 * Long Conversation Recall benchmark: synthetic 40-message conversations, no customer data or external models.
 * General context/memory results are kept separate from the Sham knowledge benchmark.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { Repository } from '../server/core/repository';
import { MemoryStore } from '../server/core/store';
import { Orchestrator } from '../server/core/orchestrator';
import { chatHistory } from '../src/utils/chatStore';
import type { ChatMessage } from '../src/utils/chatStorage';

const visitorId = 'visitor-long-recall-synthetic';

test('Long Conversation Recall: Core recalls opening details after 40 synthetic messages', async () => {
  const repo = new Repository(new MemoryStore(), {});
  const bot = new Orchestrator(repo, { env: {} });
  const first = await bot.chat({
    message: 'اسمي سلمى وبحب العود وميزانيتي في حدود 800',
    visitorId,
    language: 'ar',
  });

  // 18 intervening exchanges add 36 messages; with the opening exchange and final recall exchange,
  // the conversation ends at exactly 40 transcript messages.
  for (let i = 1; i <= 18; i++) {
    await bot.chat({
      message: `اشرح لي معلومة عامة رقم ${i}`,
      visitorId,
      conversationId: first.conversationId,
      language: 'ar',
    });
  }
  const recall = await bot.chat({
    message: 'فاكر ايه عني؟',
    visitorId,
    conversationId: first.conversationId,
    language: 'ar',
  });
  const transcript = await repo.conversation(first.conversationId);
  assert.equal(transcript?.messages.length, 40);
  assert.match(recall.reply, /سلمى/);
  assert.match(recall.reply, /عود/);
  assert.match(recall.reply, /800/);
});

test('Long Conversation Recall: Core retrieves a relevant old exchange only from the same conversation', async () => {
  const repo = new Repository(new MemoryStore(), {});
  const requests: { messages: { role: string; content: string }[] }[] = [];
  const bot = new Orchestrator(repo, {
    env: { SHAM_LLM_BASE_URL: 'http://llm.test/v1', SHAM_LLM_MODEL: 'recall-test' },
    fetch: (async (_url: string | URL, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ choices: [{ message: { content: 'إجابة اختبارية.' } }] }), { status: 200 });
    }) as typeof fetch,
  });

  const first = await bot.chat({ message: 'بفضل العود الدافي في الشتاء', visitorId: 'visitor-recall-owner-001', language: 'ar' });
  for (let i = 0; i < 6; i++) {
    await bot.chat({ message: `احكيلي معلومة عامة رقم ${i + 1}`, visitorId: 'visitor-recall-owner-001', conversationId: first.conversationId, language: 'ar' });
  }
  await bot.chat({ message: 'كنت قلت بحب العود ولا ايه؟', visitorId: 'visitor-recall-owner-001', conversationId: first.conversationId, language: 'ar' });
  const ownerHistory = requests.at(-1)!.messages;
  assert.ok(ownerHistory.some((turn) => turn.content.includes('بفضل العود الدافي في الشتاء')));

  const other = await bot.chat({ message: 'اتكلم عن موضوع عام مختلف', visitorId: 'visitor-recall-other-002', language: 'ar' });
  for (let i = 0; i < 6; i++) {
    await bot.chat({ message: `اشرح معلومة مستقلة رقم ${i + 1}`, visitorId: 'visitor-recall-other-002', conversationId: other.conversationId, language: 'ar' });
  }
  await bot.chat({ message: 'كنت قلت بحب العود ولا ايه؟', visitorId: 'visitor-recall-other-002', conversationId: other.conversationId, language: 'ar' });
  const otherHistory = requests.at(-1)!.messages;
  assert.equal(otherHistory.some((turn) => turn.content.includes('بفضل العود الدافي في الشتاء')), false);
});

test('Long Conversation Recall: raw Shaheen history does not include opening facts after 40 messages', () => {
  const messages = Array.from({ length: 40 }, (_, index) => ({
    id: `shaheen-synthetic-${index + 1}`,
    role: index % 2 === 0 ? 'user' : 'assistant',
    text: index === 0
      ? 'اسمي سلمى وبحب العود وميزانيتي في حدود 800'
      : index === 39 ? 'فاكر ايه عني؟' : `رسالة اصطناعية رقم ${index + 1}`,
  })) as ChatMessage[];
  const outgoingHistory = chatHistory(messages);
  assert.equal(outgoingHistory.some((turn) => /سلمى|عود|800/.test(turn.text)), false);
  assert.equal(outgoingHistory.some((turn) => turn.text === 'فاكر ايه عني؟'), true);
});
