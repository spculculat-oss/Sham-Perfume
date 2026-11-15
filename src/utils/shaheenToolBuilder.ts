/** Shaheen's local tool compiler: a closed, typed data-flow language, NOT JavaScript execution.
 * No eval, network, files, browser globals, imports or deployment. All imported JSON is untrusted.
 */
export type ToolValue = number | string | boolean | ToolValue[];
export type ToolType = 'number' | 'text' | 'boolean' | 'list';
export type ToolOp = 'add' | 'sub' | 'mul' | 'div' | 'round' | 'gt' | 'eq' | 'and' | 'or' | 'not' | 'trim' | 'upper' | 'lower' | 'length' | 'split' | 'join' | 'sum' | 'sort' | 'unique';
export type ToolExpr = { kind: 'literal'; value: ToolValue } | { kind: 'input' | 'ref'; name: string } | { kind: 'item' } | { kind: 'op'; op: ToolOp; args: ToolExpr[] } | { kind: 'if'; test: ToolExpr; yes: ToolExpr; no: ToolExpr } | { kind: 'map'; list: ToolExpr; body: ToolExpr };
export interface ToolSpec {
  version: 1; title: string;
  inputs: { id: string; label: string; type: ToolType; default: ToolValue }[];
  nodes: { id: string; expr: ToolExpr }[];
  outputs: string[];
}
export const TOOL_LIMITS = { bytes: 60000, nodes: 60, expressions: 400, depth: 16, list: 100, text: 4000, steps: 5000, number: 1e12 } as const;
const ARITY: Record<ToolOp, number> = { add: 2, sub: 2, mul: 2, div: 2, round: 1, gt: 2, eq: 2, and: 2, or: 2, not: 1, trim: 1, upper: 1, lower: 1, length: 1, split: 2, join: 2, sum: 1, sort: 1, unique: 1 };
export const TOOL_OPS = Object.keys(ARITY) as ToolOp[];
const bad = (message: string): never => { throw new Error(message); };
const object = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v) || ![Object.prototype, null].includes(Object.getPrototypeOf(v))) return bad('INVALID_OBJECT');
  return v as Record<string, unknown>;
};
const exact = (v: Record<string, unknown>, keys: string[]) => { if (Object.keys(v).some((k) => !keys.includes(k))) bad('UNKNOWN_FIELD'); };
const identifier = (v: unknown): string => typeof v === 'string' && /^[a-z][a-z0-9_]{0,39}$/.test(v) && !['constructor', 'prototype', '__proto__'].includes(v) ? v : bad('INVALID_ID');
function value(v: unknown, depth = 0, budget = { count: 0, chars: 0 }): ToolValue {
  if (++budget.count > 1000 || (typeof v === 'string' && (budget.chars += v.length) > 16000)) return bad('VALUE_TOO_LARGE');
  if (depth > 4) return bad('VALUE_DEPTH');
  if (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= TOOL_LIMITS.number) return v;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string' && v.length <= TOOL_LIMITS.text) return v;
  if (Array.isArray(v) && v.length <= TOOL_LIMITS.list) return v.map((x) => value(x, depth + 1, budget));
  return bad('INVALID_VALUE');
}
const matches = (v: ToolValue, type: ToolType) => type === 'list' ? Array.isArray(v) : typeof v === (type === 'text' ? 'string' : type);
export function parseToolSpec(raw: string): ToolSpec {
  if (raw.length > TOOL_LIMITS.bytes) return bad('PROGRAM_TOO_LARGE');
  const root = object(JSON.parse(raw)); exact(root, ['version', 'title', 'inputs', 'nodes', 'outputs']);
  if (root.version !== 1 || typeof root.title !== 'string' || !root.title.trim() || root.title.length > 120) return bad('INVALID_PROGRAM');
  if (!Array.isArray(root.inputs) || root.inputs.length > 12 || !Array.isArray(root.nodes) || !root.nodes.length || root.nodes.length > TOOL_LIMITS.nodes || !Array.isArray(root.outputs) || !root.outputs.length || root.outputs.length > 12) return bad('INVALID_PROGRAM');
  const inputs = new Set<string>(); const refs = new Set<string>();
  for (const rawInput of root.inputs) {
    const input = object(rawInput); exact(input, ['id', 'label', 'type', 'default']); const id = identifier(input.id);
    if (inputs.has(id) || typeof input.label !== 'string' || !input.label.trim() || input.label.length > 120 || !['number', 'text', 'boolean', 'list'].includes(String(input.type)) || !matches(value(input.default), input.type as ToolType)) return bad('INVALID_INPUT');
    inputs.add(id);
  }
  let count = 0;
  const expr = (rawExpr: unknown, depth = 0, inMap = false): void => {
    if (++count > TOOL_LIMITS.expressions || depth > TOOL_LIMITS.depth) bad('PROGRAM_TOO_COMPLEX');
    const e = object(rawExpr);
    switch (e.kind) {
      case 'literal': exact(e, ['kind', 'value']); value(e.value); break;
      case 'input': exact(e, ['kind', 'name']); if (!inputs.has(identifier(e.name))) bad('UNKNOWN_INPUT'); break;
      case 'ref': exact(e, ['kind', 'name']); if (!refs.has(identifier(e.name))) bad('FORWARD_OR_UNKNOWN_REFERENCE'); break;
      case 'item': exact(e, ['kind']); if (!inMap) bad('ITEM_OUTSIDE_MAP'); break;
      case 'op': {
        exact(e, ['kind', 'op', 'args']);
        if (typeof e.op !== 'string' || !Object.hasOwn(ARITY, e.op) || !Array.isArray(e.args) || e.args.length !== ARITY[e.op as ToolOp]) return bad('INVALID_OPERATION');
        e.args.forEach((a) => expr(a, depth + 1, inMap)); break;
      }
      case 'if': exact(e, ['kind', 'test', 'yes', 'no']); [e.test, e.yes, e.no].forEach((a) => expr(a, depth + 1, inMap)); break;
      case 'map': exact(e, ['kind', 'list', 'body']); expr(e.list, depth + 1, inMap); expr(e.body, depth + 1, true); break;
      default: bad('UNKNOWN_BLOCK');
    }
  };
  for (const rawNode of root.nodes) {
    const node = object(rawNode); exact(node, ['id', 'expr']); const id = identifier(node.id);
    if (refs.has(id) || inputs.has(id)) bad('DUPLICATE_ID');
    expr(node.expr); refs.add(id);
  }
  for (const out of root.outputs) if (!refs.has(identifier(out))) bad('UNKNOWN_OUTPUT');
  return root as unknown as ToolSpec;
}
const number = (v: ToolValue) => typeof v === 'number' ? v : bad('EXPECTED_NUMBER');
const text = (v: ToolValue) => typeof v === 'string' ? v : bad('EXPECTED_TEXT');
const bool = (v: ToolValue) => typeof v === 'boolean' ? v : bad('EXPECTED_BOOLEAN');
const list = (v: ToolValue) => Array.isArray(v) ? v : bad('EXPECTED_LIST');
export type ToolRun = { ok: true; outputs: Record<string, ToolValue>; steps: number } | { ok: false; error: string; steps: number };
export function runTool(spec: unknown, supplied: unknown = {}): ToolRun {
  let steps = 0;
  try {
    // Re-parse to validate and detach even programmatically supplied objects. No code is ever evaluated.
    const tool = parseToolSpec(JSON.stringify(spec)); const suppliedInputs = object(supplied);
    exact(suppliedInputs, tool.inputs.map((i) => i.id));
    const inputs = new Map<string, ToolValue>(); const refs = new Map<string, ToolValue>();
    for (const input of tool.inputs) {
      const v = value(Object.hasOwn(suppliedInputs, input.id) ? suppliedInputs[input.id] : input.default);
      if (!matches(v, input.type)) bad('INPUT_TYPE_MISMATCH'); inputs.set(input.id, v);
    }
    const evaluate = (e: ToolExpr, item?: ToolValue): ToolValue => {
      if (++steps > TOOL_LIMITS.steps) return bad('STEP_LIMIT');
      if (e.kind === 'literal') return e.value;
      if (e.kind === 'input') return inputs.get(e.name)!;
      if (e.kind === 'ref') return refs.get(e.name)!;
      if (e.kind === 'item') return item!;
      if (e.kind === 'if') return evaluate(bool(evaluate(e.test, item)) ? e.yes : e.no, item);
      if (e.kind === 'map') return value(list(evaluate(e.list, item)).map((v) => evaluate(e.body, v)));
      if (e.kind !== 'op') return bad('UNKNOWN_BLOCK');
      const a = e.args.map((x) => evaluate(x, item)); let result: ToolValue;
      switch (e.op) {
        case 'add': result = number(a[0]) + number(a[1]); break;
        case 'sub': result = number(a[0]) - number(a[1]); break;
        case 'mul': result = number(a[0]) * number(a[1]); break;
        case 'div': if (number(a[1]) === 0) return bad('DIVISION_BY_ZERO'); result = number(a[0]) / number(a[1]); break;
        case 'round': result = Math.round(number(a[0]) * 100) / 100; break;
        case 'gt': result = number(a[0]) > number(a[1]); break;
        case 'eq': result = JSON.stringify(a[0]) === JSON.stringify(a[1]); break;
        case 'and': result = [bool(a[0]), bool(a[1])].every(Boolean); break;
        case 'or': result = [bool(a[0]), bool(a[1])].some(Boolean); break;
        case 'not': result = !bool(a[0]); break;
        case 'trim': result = text(a[0]).trim(); break;
        case 'upper': result = text(a[0]).toUpperCase(); break;
        case 'lower': result = text(a[0]).toLowerCase(); break;
        case 'length': result = typeof a[0] === 'string' ? a[0].length : list(a[0]).length; break;
        case 'split': result = text(a[0]).split(text(a[1])); break;
        case 'join': result = list(a[0]).map(text).join(text(a[1])); break;
        case 'sum': result = list(a[0]).map(number).reduce((x, y) => x + y, 0); break;
        case 'sort': result = [...list(a[0])].map(number).sort((x, y) => x - y); break;
        case 'unique': result = [...new Map(list(a[0]).map((x) => [JSON.stringify(x), x])).values()]; break;
      }
      return value(result);
    };
    for (const node of tool.nodes) refs.set(node.id, evaluate(node.expr));
    const outputs = Object.fromEntries(tool.outputs.map((id) => [id, refs.get(id)!]));
    if (JSON.stringify(outputs).length > 32000) bad('OUTPUT_TOO_LARGE');
    return { ok: true, outputs, steps };
  } catch (cause) { return { ok: false, error: cause instanceof Error ? cause.message : 'TOOL_FAILED', steps }; }
}
const input = (name: string): ToolExpr => ({ kind: 'input', name });
const ref = (name: string): ToolExpr => ({ kind: 'ref', name });
const literal = (v: ToolValue): ToolExpr => ({ kind: 'literal', value: v });
const op = (operation: ToolOp, ...args: ToolExpr[]): ToolExpr => ({ kind: 'op', op: operation, args });
export const TOOL_EXAMPLES: { id: string; ar: string; en: string; tool: ToolSpec; expected: Record<string, ToolValue> }[] = [
  { id: 'discount', ar: 'حاسبة خصم', en: 'Discount calculator', expected: { total: 80 }, tool: { version: 1, title: 'Discount', inputs: [{ id: 'price', label: 'Price', type: 'number', default: 100 }, { id: 'percent', label: 'Discount %', type: 'number', default: 20 }], nodes: [{ id: 'reduction', expr: op('div', op('mul', input('price'), input('percent')), literal(100)) }, { id: 'total', expr: op('sub', input('price'), ref('reduction')) }], outputs: ['total'] } },
  { id: 'dilution', ar: 'حاسبة تركيز', en: 'Concentration calculator', expected: { oil: 20, base: 80 }, tool: { version: 1, title: 'Concentration', inputs: [{ id: 'volume', label: 'Volume', type: 'number', default: 100 }, { id: 'percent', label: 'Concentration %', type: 'number', default: 20 }], nodes: [{ id: 'oil', expr: op('div', op('mul', input('volume'), input('percent')), literal(100)) }, { id: 'base', expr: op('sub', input('volume'), ref('oil')) }], outputs: ['oil', 'base'] } },
  { id: 'text', ar: 'تنظيف نص وعدّ حروفه', en: 'Clean text and count characters', expected: { cleaned: 'hello', count: 5 }, tool: { version: 1, title: 'Text cleaner', inputs: [{ id: 'text', label: 'Text', type: 'text', default: '  hello  ' }], nodes: [{ id: 'cleaned', expr: op('trim', input('text')) }, { id: 'count', expr: op('length', ref('cleaned')) }], outputs: ['cleaned', 'count'] } },
  { id: 'list', ar: 'تربيع قائمة وجمعها', en: 'Square and sum a list', expected: { squares: [1, 4, 9], total: 14 }, tool: { version: 1, title: 'List processing', inputs: [{ id: 'numbers', label: 'Numbers (JSON)', type: 'list', default: [1, 2, 3] }], nodes: [{ id: 'squares', expr: { kind: 'map', list: input('numbers'), body: op('mul', { kind: 'item' }, { kind: 'item' }) } }, { id: 'total', expr: op('sum', ref('squares')) }], outputs: ['squares', 'total'] } },
  { id: 'condition', ar: 'شرط نجاح بدرجة محددة', en: 'Pass/fail condition', expected: { passed: true }, tool: { version: 1, title: 'Condition', inputs: [{ id: 'score', label: 'Score', type: 'number', default: 75 }], nodes: [{ id: 'passed', expr: { kind: 'if', test: op('gt', input('score'), literal(49)), yes: literal(true), no: literal(false) } }], outputs: ['passed'] } },
];
/** Local assembly is deliberately explicit. Unknown wishes are not silently replaced by an unrelated template. */
export function buildTool(request: string, ar = false): { tool?: ToolSpec; reason: string } {
  const patterns = [/خصم|discount/i, /تركيز|تخفيف|dilut|concentrat/i, /تنظيف.*نص|نص.*تنظيف|حروف|clean.*text|text.*clean|character/i, /تربيع|مربعات|square.*list/i, /نجاح|رسوب|pass.?fail/i];
  const hits = TOOL_EXAMPLES.filter((_, i) => patterns[i].test(request));
  if (request.length > 2000 || hits.length !== 1) return { reason: ar ? 'حدّد المدخلات وطريقة الحساب والنتيجة. البناء المحلي يدعم الأمثلة المعروضة؛ الأدوات الأخرى تحتاج تعريف بلوكات مراجع، ولا تتحول تلقائياً إلى أداة مختلفة.' : 'Specify inputs, logic and outputs. Local assembly supports the shown examples; other tools need a reviewed block definition and are not silently replaced.' };
  const tool = parseToolSpec(JSON.stringify(hits[0].tool)); tool.title = ar ? hits[0].ar : hits[0].en;
  return { tool, reason: ar ? 'تم تركيب الأداة محلياً. اختبر بياناتك قبل الاعتماد عليها؛ لم تُنشر على الموقع.' : 'Assembled locally. Test your data before relying on it; nothing was deployed.' };
}
export function toolBuilderBench() {
  return TOOL_EXAMPLES.map((example) => {
    const built = buildTool(example.ar, true);
    const report = runTool(built.tool);
    return { id: example.id, ok: report.ok && JSON.stringify(report.outputs) === JSON.stringify(example.expected) };
  });
}

/** Only explicit block-tool construction requests take this local route; shopping/ordinary code stays untouched. */
export function blockBuilderReply(request: string, language: string): string | undefined {
  if (!['ar', 'en'].includes(language) || request.length > 2000
    || !/(بلوك|بلوكات|\bblocks?\b)/i.test(request)
    || !/(ابن[يى]|بناء|اعمل|ركب|ركّب|اصنع|أنشئ|انشئ|\b(?:build|create|make|assemble)\b)/i.test(request)) return undefined;
  const built = buildTool(request, language === 'ar');
  if (!built.tool) return built.reason;
  const report = runTool(built.tool);
  if (!report.ok) return language === 'ar' ? 'تعذّر اختبار الأداة؛ لم يتم إنشاء أداة ناجحة.' : 'Tool validation failed; no successful tool was produced.';
  const lead = language === 'ar'
    ? 'ركّبت تعريف أداة من بلوكات محلية واختبرت مدخلاتها الافتراضية فقط. افتح مساحة شاهين ← بلوكات، أو زر «افتح في البلوكات» تحت الرد، لتغيير المدخلات وتجربتها. تقدر تستورد JSON ده هناك. مش نشر تلقائي ولا ضمان لكل المدخلات.'
    : 'Assembled a local block definition and tested only its defaults. Open Shaheen Workspace → Blocks, or Open in blocks below, to change inputs and test it. You can import this JSON there. Nothing is deployed and arbitrary inputs are not certified.';
  return `${lead}\n\n\`\`\`json\n${JSON.stringify(built.tool, null, 2)}\n\`\`\``;
}
export function toolFromReply(reply: string): ToolSpec | undefined {
  const match = /\`\`\`json\s*\n([\s\S]*?)\`\`\`/i.exec(reply);
  if (!match) return undefined;
  try { return parseToolSpec(match[1]); } catch { return undefined; }
}

/** The existing workspace engine may draft this data format; its response is never executable source code. */
export const TOOL_BUILDER_INSTRUCTION = `Design a tool in the closed Shaheen block language. Return ONLY a JSON ToolSpec, no prose or source code.
Schema: {"version":1,"title":"short title in the user's language","inputs":[{"id":"number","label":"Number","type":"number","default":2}],"nodes":[{"id":"squared","expr":{"kind":"op","op":"mul","args":[{"kind":"input","name":"number"},{"kind":"input","name":"number"}]}}],"outputs":["squared"]}.
Input types: number, text, boolean, list. Values: finite numbers bounded by 1e12, strings, booleans, bounded arrays. No objects or null.
Expressions: literal with value; input with name; ref with name of an earlier node; op with op and args; if with boolean test, yes and no expressions; map with list and body expressions. Inside a map body, {"kind":"item"} reads the current item. Nested maps scope item locally.
Operations and arities: ${Object.entries(ARITY).map(([name, n]) => `${name}(${n})`).join(', ')}.
Arithmetic takes numbers only. gt is numerical comparison. eq compares supported values. length counts list items or UTF-16 string units. split takes text and separator. join takes a string list and separator. round rounds to two decimals. sort and sum take numerical lists. if is lazy; ordinary operation arguments are evaluated eagerly.
Limits: 12 inputs, 60 nodes, 12 outputs, 400 expressions, expression depth 16, lists 100, strings 4000, 5000 execution steps. Unique lowercase Latin identifiers, no reserved prototype names, no cycles, no forward references or extra fields.
Follow the user's requirements rather than substituting a different tool. Do not invent exchange rates, financial/medical/legal facts or external data. All defaults are examples, not certified real-world facts. Choose defaults that execute safely. There is NO network, filesystem, DOM, SQL access, package installation, imports, eval, shell, secrets, account access or deployment capability. If the request requires unsupported capabilities or missing essential facts, return {"unsupported":"reason"}, not a fake successful tool. Testing defaults is not proof of correctness for arbitrary inputs.`;
