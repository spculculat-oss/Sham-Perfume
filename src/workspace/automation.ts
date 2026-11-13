/**
 * «مهام تلقائية»: a task the visitor describes, split by Shaheen into steps (the server's `plan` task answers JSON),
 * then run here one after another with the workspace's own tools. A step can use an earlier step's result: {{1}}.
 * Pure orchestration — the tools are passed in, so it is tested without a network.
 */
export const STEP_TOOLS = ['search', 'read', 'ask', 'image', 'python', 'document', 'save'] as const;
export type StepTool = typeof STEP_TOOLS[number];
export interface PlanStep { tool: StepTool; input: string }
export interface Plan { goal: string; steps: PlanStep[] }
export const MAX_STEPS = 8;

/** The plan in a reply (JSON, maybe fenced or with words around it); undefined when there is none. */
export function parsePlan(reply: string): Plan | undefined {
  const fenced = reply.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const text = fenced ?? reply;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return undefined;
  let data: unknown;
  try { data = JSON.parse(text.slice(start, end + 1)); } catch { return undefined; }
  const raw = data as { goal?: unknown; steps?: unknown };
  if (!Array.isArray(raw.steps)) return undefined;
  const steps = raw.steps.flatMap((s) => {
    const { tool, input } = (s && typeof s === 'object' ? s : {}) as { tool?: unknown; input?: unknown };
    const name = typeof tool === 'string' ? tool.trim().toLowerCase() : '';
    return (STEP_TOOLS as readonly string[]).includes(name) && typeof input === 'string' && input.trim() ? [{ tool: name as StepTool, input: input.trim().slice(0, 20_000) }] : [];
  }).slice(0, MAX_STEPS);
  if (!steps.length) return undefined;
  return { goal: typeof raw.goal === 'string' ? raw.goal.slice(0, 300) : '', steps };
}

/** {{n}} → the result of step n (unknown or later steps are left as they are). */
export function fillRefs(input: string, results: string[]): string {
  return input.replace(/\{\{\s*(\d+)\s*\}\}/g, (whole, n: string) => {
    const i = Number(n) - 1;
    return i >= 0 && i < results.length ? results[i]! : whole;
  });
}

/** «docx: …» → the kind and the content (pdf, xlsx, pptx, docx; default docx). */
export function splitDocument(input: string): { kind: 'docx' | 'xlsx' | 'pptx' | 'pdf'; content: string } {
  const m = input.match(/^\s*(docx|xlsx|pptx|pdf|word|excel|powerpoint)\s*:\s*/i);
  const map: Record<string, 'docx' | 'xlsx' | 'pptx' | 'pdf'> = { docx: 'docx', word: 'docx', xlsx: 'xlsx', excel: 'xlsx', pptx: 'pptx', powerpoint: 'pptx', pdf: 'pdf' };
  return { kind: m ? map[m[1]!.toLowerCase()]! : 'docx', content: m ? input.slice(m[0].length) : input };
}
/** «report.md: …» → a safe file name and the content. */
export function splitSave(input: string): { name: string; content: string } {
  const m = input.match(/^\s*([^\s:/\\]{1,80}\.[A-Za-z0-9]{1,6})\s*:\s*/);
  return m ? { name: m[1]!, content: input.slice(m[0].length) } : { name: 'shaheen-result.md', content: input };
}

export interface StepTools {
  search(q: string): Promise<string>;
  read(url: string): Promise<string>;
  ask(prompt: string, earlier: string[]): Promise<string>;
  image(prompt: string): Promise<string>;
  python(code: string): Promise<string>;
  document(kind: 'docx' | 'xlsx' | 'pptx' | 'pdf', content: string): Promise<string>;
  save(name: string, content: string): Promise<string>;
}
export type StepState = { status: 'waiting' | 'running' | 'done' | 'failed'; result?: string; error?: string };

/** Runs the steps in order; a failed step is reported and the rest still run with what is available. */
export async function runPlan(plan: Plan, tools: StepTools, { onStep, signal }: { onStep?: (index: number, state: StepState) => void; signal?: AbortSignal } = {}): Promise<{ results: string[]; states: StepState[] }> {
  const results: string[] = [];
  const states: StepState[] = plan.steps.map(() => ({ status: 'waiting' }));
  for (let i = 0; i < plan.steps.length; i += 1) {
    if (signal?.aborted) break;
    const step = plan.steps[i]!;
    states[i] = { status: 'running' };
    onStep?.(i, states[i]!);
    const input = fillRefs(step.input, results);
    try {
      let result: string;
      switch (step.tool) {
        case 'search': result = await tools.search(input); break;
        case 'read': result = await tools.read(input.trim()); break;
        case 'ask': result = await tools.ask(input, results.slice()); break;
        case 'image': result = await tools.image(input); break;
        case 'python': result = await tools.python(input); break;
        case 'document': { const d = splitDocument(input); result = await tools.document(d.kind, d.content); break; }
        case 'save': { const s = splitSave(input); result = await tools.save(s.name, s.content); break; }
      }
      results.push(String(result ?? '').slice(0, 30_000));
      states[i] = { status: 'done', result: results[i] };
    } catch (error) {
      results.push('');
      states[i] = { status: 'failed', error: error instanceof Error ? error.message : String(error) };
    }
    onStep?.(i, states[i]!);
  }
  return { results, states };
}
