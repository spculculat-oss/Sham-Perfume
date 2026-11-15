import assert from 'node:assert/strict';
import test from 'node:test';
import { askWorkspace, ReadError, workspaceInstruction } from '../server/workspace';
import { runTool, toolFromReply, type ToolSpec } from '../src/utils/shaheenToolBuilder';

const env = { ANTHROPIC_API_KEY: 'test-key-not-a-real-secret' };
const doubled: ToolSpec = {
  version: 1, title: 'Double a number',
  inputs: [{ id: 'number', label: 'Number', type: 'number', default: 4 }],
  nodes: [{ id: 'doubled', expr: { kind: 'op', op: 'mul', args: [{ kind: 'input', name: 'number' }, { kind: 'literal', value: 2 }] } }], outputs: ['doubled'],
};
const body = { messages: [{ role: 'user', text: 'Design a tool that doubles the supplied number' }], task: 'blocks', language: 'en' };
const modelReply = (text: string) => new Response(JSON.stringify({ content: [{ type: 'text', text }] }), { headers: { 'content-type': 'application/json' } });

test('new block definitions use the existing engine adapter and are validated before return', async () => {
  let sent: Record<string, unknown> = {};
  const reply = await askWorkspace(body, { env, fetch: (async (_url, init) => { sent = JSON.parse(String(init?.body)); return modelReply(JSON.stringify(doubled)); }) as typeof fetch });
  assert.match(String(sent.system), /closed Shaheen block language/);
  assert.deepEqual(sent.messages, [{ role: 'user', content: body.messages[0].text }]);
  const tool = toolFromReply(reply.reply); assert.ok(tool);
  assert.deepEqual(runTool(tool, { number: 12 }), { ok: true, outputs: { doubled: 24 }, steps: 3 });
  assert.deepEqual(reply.sources, []);
});

test('generated executable source, hidden capabilities and failing defaults never become successful tools', async () => {
  const unsafe = { ...doubled, nodes: [{ id: 'doubled', expr: { kind: 'eval', code: 'fetch("https://example.com")' } }] };
  const divideZero = { ...doubled, nodes: [{ id: 'doubled', expr: { kind: 'op', op: 'div', args: [{ kind: 'literal', value: 1 }, { kind: 'literal', value: 0 }] } }] };
  for (const text of ['<script>alert(1)</script>', '```javascript\nconsole.log(1)\n```', JSON.stringify(unsafe), JSON.stringify(divideZero), '{"unsupported":"needs a database"}', '{"title":"fake", "deployed":true}']) {
    await assert.rejects(askWorkspace(body, { env, fetch: (async () => modelReply(text)) as typeof fetch }), (e: unknown) => e instanceof ReadError && e.code === 'INVALID_TOOL_DEFINITION');
  }
});

test('no configured engine reports unavailability without fabricating a replacement template', async () => {
  let calls = 0;
  await assert.rejects(askWorkspace(body, { env: {}, fetch: (async () => { calls++; throw new Error('No network'); }) as typeof fetch }), (e: unknown) => e instanceof ReadError && e.code === 'NO_ENGINE');
  assert.equal(calls, 0);
});

test('drafting prompt forbids deployment, invented facts and unrestricted language execution', () => {
  const instruction = workspaceInstruction('ar', 'blocks');
  for (const text of ['NO network', 'No objects or null', '5000', 'not proof', 'Do not invent exchange rates']) assert.ok(instruction.includes(text), text);
});
