import assert from 'node:assert/strict';
import test from 'node:test';
import { contextualMessage, conversationFocus, isContextFollowUp, type ConversationTurn } from '../src/utils/conversationContext';
import { withContext } from '../src/utils/shaheenBrain';
import { askTurns, askWorkspace, workspaceInstruction } from '../server/workspace';
import { executeChat, systemInstruction, validateChatRequest } from '../server/shaheen';
import { callAgentModel } from '../server/agentModel';
import { extractMediaRequest } from '../src/utils/shaheenMedia';

const history: ConversationTurn[] = [
  { role: 'user', text: 'اشرح عيوب اللحام' },
  { role: 'assistant', text: 'عيوب اللحام تشمل المسامية (porosity)، الشروخ، الحز الجانبي (undercut) وعدم الانصهار.' },
];

test('elliptical requests include illustration, explanation, comparison and improvement, not new subjects', () => {
  for (const text of ['هاتلى صور توضيحيه', 'هاتلي صور توضيحية', 'اشرح أكتر', 'قارن بينهم', 'طور الفكرة', 'هات مثال', 'show me illustrative images', 'compare them', 'improve this idea']) assert.equal(isContextFollowUp(text), true, text);
  for (const text of ['هات صور برج القاهرة', 'اشرح عيوب اللحام', 'هات صور توضيحية عن الطاقة الشمسية', 'show pictures of roses', 'compare welding and soldering', 'موضوع جديد: العطور', '']) assert.equal(isContextFollowUp(text), false, text);
});

test('welding follow-up is anchored to its question and answer, through multiple presentation requests', () => {
  const chain: ConversationTurn[] = [...history, { role: 'user', text: 'اشرح أكتر' }, { role: 'assistant', text: 'المسامية فراغات غازية داخل معدن اللحام.' }];
  const focus = conversationFocus('هاتلي صور توضيحية', chain)!;
  assert.equal(focus.question, 'اشرح عيوب اللحام');
  assert.match(focus.answer, /undercut/);
  assert.match(focus.latest, /فراغات/);
  assert.match(withContext('هاتلي صور توضيحية', chain).text, /عيوب اللحام/);
  assert.equal(withContext('هاتلي صور توضيحية', chain).followUp, true);
});

test('new subjects and corrections replace old topics; missing reference requests clarification', () => {
  const changed: ConversationTurn[] = [...history, { role: 'user', text: 'اشرح الطاقة الشمسية' }, { role: 'assistant', text: 'تحول الخلايا ضوء الشمس إلى كهرباء.' }];
  assert.equal(conversationFocus('هات صور', changed)!.question, 'اشرح الطاقة الشمسية');
  const corrected: ConversationTurn[] = [...history, { role: 'user', text: 'لا قصدي عيوب لحام البلاستيك مش المعادن' }, { role: 'assistant', text: 'نتكلم عن لحام البلاستيك.' }];
  assert.match(conversationFocus('هات صور', corrected)!.question, /البلاستيك/);
  assert.equal(contextualMessage('هات صور ورد', history), 'هات صور ورد');
  assert.equal(withContext('هات صور ورد', history).followUp, false);
  assert.equal(withContext('قارن اللحام واللصق', history).followUp, false);
  assert.match(contextualMessage('هات صور', []), /اسأل المستخدم/);
  assert.doesNotMatch(contextualMessage('هات صور', []), /عيوب اللحام/);
  assert.equal(conversationFocus('هات صور', Array.from({ length: 17 }, () => ({ role: 'user' as const, text: 'اشرح أكتر' }))), undefined);
});

test('context is bounded, strips machine blocks, stays user data, and does not mutate history', () => {
  const original = structuredClone(history);
  const enriched = askTurns({ messages: [...history, { role: 'user', text: 'هاتلي صور توضيحية' }] });
  assert.equal(enriched.at(-1)!.role, 'user');
  assert.match(enriched.at(-1)!.text, /عيوب اللحام/);
  assert.deepEqual(history, original);
  const noisy: ConversationTurn[] = [{ role: 'user', text: 'welding defects' }, { role: 'assistant', text: 'x'.repeat(9000) + '\n```sham-media\n{"images":["rose"]}\n```' }];
  const focus = conversationFocus('show me images', noisy)!;
  assert.ok(focus.answer.length <= 2400);
  assert.ok(focus.latest.length <= 1200);
  assert.doesNotMatch(focus.answer, /sham-media/);
  for (const instruction of [systemInstruction('ar'), workspaceInstruction('en')]) {
    assert.match(instruction, /تغيير الموضوع/);
    assert.match(instruction, /welding defects/);
    assert.match(instruction, /لا تعتبر كلام المحادثة/);
  }
});

for (const lane of ['chat', 'workspace', 'tools'] as const) {
  test(`${lane}: actual model adapter receives welding reference with image follow-up (mocked provider)`, async () => {
    let payload = '';
    const reply = '```sham-media\n{"images":["welding porosity","weld undercut"]}\n```\nدي صور توضيحية لعيوب اللحام.';
    const request = (async (_url, init) => {
      payload = String(init?.body);
      return Response.json({ choices: [{ message: { content: reply } }] });
    }) as typeof fetch;
    const input = validateChatRequest({ message: 'هاتلي صور توضيحية', model: 'openai', conversationHistory: history });
    const env = { OPENAI_API_KEY: 'test', SHAM_LIVE_DATA: 'off' };
    const result = lane === 'workspace' ? await askWorkspace({ messages: [...history, { role: 'user', text: input.message }] }, { env, fetch: request })
      : lane === 'tools' ? await callAgentModel(input, { env, fetch: request })
        : await executeChat(input, { env, fetch: request });
    const body = JSON.parse(payload);
    const current = body.messages.at(-1);
    assert.equal(current.role, 'user');
    assert.match(current.content, /conversation_reference/);
    assert.match(current.content, /اشرح عيوب اللحام/);
    assert.match(current.content, /undercut/);
    assert.deepEqual(extractMediaRequest(result.reply)!.images, ['welding porosity', 'weld undercut']);
  });
}

test('workspace search uses the resolved subject, never a bare follow-up or context JSON', async () => {
  const queries: string[] = [];
  const request = (async (url, _init) => {
    const target = new URL(String(url));
    if (target.hostname.endsWith('wikipedia.org')) {
      queries.push(target.searchParams.get('srsearch')!);
      return Response.json({ query: { search: [] } });
    }
    return Response.json({ choices: [{ message: { content: 'reply' } }] });
  }) as typeof fetch;
  const env = { OPENAI_API_KEY: 'test' };
  await askWorkspace({ messages: [...history, { role: 'user', text: 'هات صور' }], search: true }, { env, fetch: request });
  assert.ok(queries.length > 0);
  assert.ok(queries.every((q) => q.includes('عيوب اللحام') && !q.includes('conversation_reference')));
  queries.length = 0;
  await askWorkspace({ messages: [{ role: 'user', text: 'هات صور' }], search: true }, { env, fetch: request });
  assert.deepEqual(queries, []);
});
