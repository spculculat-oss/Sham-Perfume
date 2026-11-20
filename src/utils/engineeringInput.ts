import { EngineeringError, evaluateEngineeringExpression, normalizeEngineeringInput, parseEngineeringExpression, type EngineeringExpression, type EvaluateOptions } from './engineeringCalculator';

/** A field labelled (%) accepts either 5 or 5%. A mixed expression with ambiguous units is rejected. */
export function engineeringPercentField(text: string, options: EvaluateOptions = {}): number {
  const input = normalizeEngineeringInput(text);
  if (!input.includes('%')) return evaluateEngineeringExpression(text, options) / 100;
  const explicit = (node: EngineeringExpression): boolean => node.kind === 'unary' && (
    node.op === '%' && !hasPercent(node.value) || node.op === '-' && explicit(node.value));
  const hasPercent = (node: EngineeringExpression): boolean => node.kind === 'unary' ? node.op === '%' || hasPercent(node.value)
    : node.kind === 'binary' ? hasPercent(node.left) || hasPercent(node.right) : node.kind === 'call' && node.args.some(hasPercent);
  if (!explicit(parseEngineeringExpression(text))) throw new EngineeringError('syntax', 'Enter a percentage as a number or append one % sign to the whole value.');
  return evaluateEngineeringExpression(text, options);
}

/** Split a list without treating the comma inside log(8,2) as a new measurement. */
export function splitEngineeringValues(text: string, maximum = 180): string[] {
  const values: string[] = [];
  let depth = 0, token = '', hasValue = false, afterSeparator = false;
  const flush = () => {
    const item = token.trim();
    if (!item) return;
    values.push(item);
    if (values.length > maximum) throw new EngineeringError('limit', `Enter up to ${maximum} values.`);
    token = '';
    hasValue = true;
    afterSeparator = false;
  };
  for (const char of text) {
    if (char === '(') depth++;
    if (char === ')' && --depth < 0) throw new EngineeringError('syntax', 'Check the parentheses in the list.');
    if (depth === 0 && /[,،;؛]/.test(char)) {
      flush();
      if (!hasValue) throw new EngineeringError('syntax', 'Do not skip a list item; enter 0 when you mean zero.');
      hasValue = false;
      afterSeparator = true;
    } else if (depth === 0 && /\s/.test(char)) flush();
    else token += char;
  }
  if (depth !== 0) throw new EngineeringError('syntax', 'Check the parentheses in the list.');
  flush();
  if (afterSeparator || !values.length) throw new EngineeringError('syntax', 'Enter all the values in the list.');
  return values;
}
