import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { blockBuilderReply, buildTool, parseToolSpec, runTool, TOOL_EXAMPLES, TOOL_LIMITS, toolBuilderBench, toolFromReply, type ToolExpr, type ToolSpec, type ToolValue } from '../src/utils/shaheenToolBuilder';
import { PROGRAMMING_PATHS, TOOL_BUILDING_LESSONS } from '../src/utils/shaheenProgramming';
import { quickAnswer } from '../src/utils/shaheenQuickApps';
import { askWorkspace } from '../server/workspace';
import { academyPairs } from '../scripts/shaheen-school/curriculum';
import { knowledgeDocVersion, knowledgeSeedAdditions } from '../server/core/seed';
import BlocksPanel from '../src/workspace/BlocksPanel';

const literal = (value: ToolValue): ToolExpr => ({ kind: 'literal', value });
const operation = (op: string, ...args: ToolExpr[]) => ({ kind: 'op', op, args }) as ToolExpr;
const program = (expr: ToolExpr): ToolSpec => ({ version: 1, title: 'Test', inputs: [], nodes: [{ id: 'out', expr }], outputs: ['out'] });
const result = (expr: ToolExpr) => runTool(program(expr));
const outputs = (tool: ToolSpec, inputs?: Record<string, ToolValue>) => { const r = runTool(tool, inputs); if (!r.ok) throw new Error(r.error); return r.outputs; };
const error = (tool: unknown, expected: string, inputs?: unknown) => { const r = runTool(tool, inputs); assert.equal(r.ok, false); if (r.ok) throw new Error('Unexpected success'); assert.equal(r.error, expected); assert.equal('outputs' in r, false); };

test('all five tools are assembled and really run against independent expected outputs', () => {
  for (const example of TOOL_EXAMPLES) assert.deepEqual(outputs(example.tool), example.expected);
  assert.ok(toolBuilderBench().every((c) => c.ok));
  assert.deepEqual(outputs(TOOL_EXAMPLES[0].tool, { price: 250, percent: 10 }), { total: 225 });
  assert.deepEqual(outputs(TOOL_EXAMPLES[1].tool, { volume: 50, percent: 30 }), { oil: 15, base: 35 });
  assert.deepEqual(outputs(TOOL_EXAMPLES[2].tool, { text: '  مرحبا  ' }), { cleaned: 'مرحبا', count: 5 });
  assert.deepEqual(outputs(TOOL_EXAMPLES[3].tool, { numbers: [0, -2, 3] }), { squares: [0, 4, 9], total: 13 });
  assert.deepEqual(outputs(TOOL_EXAMPLES[4].tool, { score: 30 }), { passed: false });
});

test('every allowed operation has real arithmetic, text, list or boolean semantics', () => {
  const cases: [string, ToolValue[], ToolValue][] = [
    ['add', [2, 3], 5], ['sub', [2, 3], -1], ['mul', [2, 3], 6], ['div', [9, 2], 4.5], ['round', [1.234], 1.23], ['gt', [3, 2], true], ['eq', [[1, 2], [1, 2]], true],
    ['and', [true, false], false], ['or', [false, true], true], ['not', [false], true], ['trim', [' a '], 'a'], ['upper', ['abc'], 'ABC'], ['lower', ['ABC'], 'abc'],
    ['length', [[1, 2]], 2], ['split', ['a,b', ','], ['a', 'b']], ['join', [['a', 'b'], '-'], 'a-b'], ['sum', [[1, 2, -3]], 0], ['sort', [[10, 2, 1]], [1, 2, 10]], ['unique', [[2, 1, 2]], [2, 1]],
  ];
  for (const [op, args, expected] of cases) assert.deepEqual(outputs(program(operation(op, ...args.map(literal)))), { out: expected }, op);
});

test('lazy conditionals, empty maps and scoped nested maps work without mutable global variables', () => {
  assert.deepEqual(outputs(program({ kind: 'if', test: literal(false), yes: operation('div', literal(1), literal(0)), no: literal('safe') })), { out: 'safe' });
  assert.deepEqual(outputs(program({ kind: 'map', list: literal([]), body: operation('div', literal(1), literal(0)) })), { out: [] });
  const item: ToolExpr = { kind: 'item' };
  assert.deepEqual(outputs(program({ kind: 'map', list: literal([[1, 2], [3]]), body: { kind: 'map', list: item, body: operation('mul', item, literal(2)) } })), { out: [[2, 4], [6]] });
});

test('unknown blocks, operations, hidden executable fields and dangerous identifiers are refused', () => {
  for (const kind of ['eval', 'fetch', 'shell', 'import', 'deploy', '__proto__']) error(program({ kind } as unknown as ToolExpr), 'UNKNOWN_BLOCK');
  for (const op of ['eval', 'constructor', 'toString', '__proto__', 'fetch']) error(program(operation(op, literal('alert(1)'))), 'INVALID_OPERATION');
  error({ ...program(literal(1)), code: 'process.exit()' }, 'UNKNOWN_FIELD');
  error({ ...program(literal(1)), nodes: [{ id: 'constructor', expr: literal(1) }] }, 'INVALID_ID');
  error(program({ kind: 'literal', value: { code: 'x' } } as unknown as ToolExpr), 'INVALID_VALUE');
  assert.throws(() => parseToolSpec('{"__proto__": {}, "version": 1}'), /UNKNOWN_FIELD/);
});

test('missing/cyclic references, duplicate node/input names and unknown outputs fail before execution', () => {
  error(program({ kind: 'ref', name: 'out' }), 'FORWARD_OR_UNKNOWN_REFERENCE');
  error(program({ kind: 'input', name: 'x' }), 'UNKNOWN_INPUT');
  error(program({ kind: 'item' }), 'ITEM_OUTSIDE_MAP');
  error({ ...program(literal(1)), nodes: [{ id: 'out', expr: literal(1) }, { id: 'out', expr: literal(2) }] }, 'DUPLICATE_ID');
  error({ ...program(literal(1)), outputs: ['absent'] }, 'UNKNOWN_OUTPUT');
  error({ ...program(literal(1)), inputs: [{ id: 'out', type: 'number', label: 'n', default: 1 }] }, 'DUPLICATE_ID');
});

test('runtime rejects wrong types, unsafe numbers and division by zero with no partial output', () => {
  error(program(operation('add', literal('2'), literal(1))), 'EXPECTED_NUMBER');
  error(program(operation('div', literal(1), literal(0))), 'DIVISION_BY_ZERO');
  error(program(operation('mul', literal(1e12), literal(1e12))), 'INVALID_VALUE');
  error(program(operation('and', literal(false), literal(42))), 'EXPECTED_BOOLEAN');
  error(program(operation('or', literal(true), literal(42))), 'EXPECTED_BOOLEAN');
  error(program(operation('sort', literal([1, '2']))), 'EXPECTED_NUMBER');
  error(TOOL_EXAMPLES[0].tool, 'INPUT_TYPE_MISMATCH', { price: '100' });
  error(TOOL_EXAMPLES[0].tool, 'INVALID_VALUE', { price: Infinity });
  error(TOOL_EXAMPLES[0].tool, 'UNKNOWN_FIELD', { admin: true });
  error({ ...program(literal(1)), nodes: [{ id: 'first', expr: literal(9) }, { id: 'out', expr: operation('div', literal(1), literal(0)) }] }, 'DIVISION_BY_ZERO');
});

test('program, expression depth, value size and repeated work are bounded', () => {
  assert.throws(() => parseToolSpec(' '.repeat(TOOL_LIMITS.bytes + 1)), /PROGRAM_TOO_LARGE/);
  error(program(literal(new Array(101).fill(1))), 'INVALID_VALUE');
  error(program(literal('x'.repeat(4001))), 'INVALID_VALUE');
  let nested = literal(true); for (let i = 0; i < 20; i++) nested = operation('not', nested);
  error(program(nested), 'PROGRAM_TOO_COMPLEX');
  const repeated: ToolExpr = { kind: 'map', list: literal(new Array(100).fill(1)), body: { kind: 'map', list: literal(new Array(100).fill(1)), body: operation('add', literal(1), literal(2)) } };
  error(program(repeated), 'STEP_LIMIT');
  const v: ToolValue = new Array(100).fill('x'.repeat(1000));
  error(program(literal(v)), 'PROGRAM_TOO_LARGE');
  const deepValues: ToolValue = new Array(50).fill(new Array(50).fill(1));
  error(program(literal(deepValues)), 'VALUE_TOO_LARGE');
});

test('building does not mutate examples or pretend an unsupported request succeeded', () => {
  assert.ok(buildTool('ابني حاسبة خصم', true).tool);
  assert.equal(buildTool('ابني أداة خصم وتركيز', true).tool, undefined);
  assert.equal(buildTool('ابني تطبيق مكالمات', true).tool, undefined);
  const built = buildTool('discount calculator'); built.tool!.nodes[0].id = 'changed';
  assert.equal(TOOL_EXAMPLES[0].tool.nodes[0].id, 'reduction');
  assert.equal(blockBuilderReply('اعمل خصم على عطر', 'ar'), undefined);
  assert.equal(blockBuilderReply('Write a JavaScript function', 'en'), undefined);
  assert.equal(blockBuilderReply('build a discount tool using blocks', 'fr'), undefined);
  const reply = blockBuilderReply('ابني بالبلوكات حاسبة خصم', 'ar')!;
  assert.ok(reply.includes('الافتراضية فقط')); assert.ok(toolFromReply(reply));
  assert.equal(toolFromReply('```json\n{"hello":1}\n```'), undefined);
  assert.equal(quickAnswer('ابني بالبلوكات حاسبة خصم', 'ar')?.app, 'blocks');
});

test('workspace chat assembles a supported tool without an engine, key or outbound network', async () => {
  let calls = 0;
  const reply = await askWorkspace({ messages: [{ role: 'user', text: 'build a discount calculator with blocks' }], language: 'en' }, { env: {}, fetch: (async () => { calls++; throw new Error('No network'); }) as typeof fetch });
  assert.equal(calls, 0); assert.deepEqual(reply.sources, []); assert.ok(toolFromReply(reply.reply));
});

test('school receives practical block-building lessons and existing stores get the new guide', () => {
  const pairs = academyPairs();
  for (const entry of TOOL_BUILDING_LESSONS) assert.ok(pairs.some((p) => p.lesson.id === entry.id));
  assert.ok(PROGRAMMING_PATHS.length >= 10);
  assert.equal(knowledgeDocVersion('kb-platform-block-tools'), 13);
  assert.ok(knowledgeSeedAdditions(12).some((d) => d.id === 'kb-platform-block-tools'));
});

test('workshop renders locally with genuine run/save controls and non-Arabic fallback', () => {
  for (const lang of ['en', 'de'] as const) {
    const html = renderToStaticMarkup(React.createElement(BlocksPanel, { lang }));
    assert.ok(html.includes('Run tool')); assert.ok(html.includes('Save on device')); assert.ok(html.includes('not account') || html.includes('not execution'));
    assert.doesNotMatch(html.replace(/<[^>]+>/g, ''), /[\u0600-\u06ff]/);
    assert.doesNotMatch(html, /type="number"/);
  }
  assert.match(renderToStaticMarkup(React.createElement(BlocksPanel, { lang: 'ar' })), /مصنع أدوات شاهين/);
});
