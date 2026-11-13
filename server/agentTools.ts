import { RAW_MATERIALS_DATABASE as rawMaterials } from '../src/data/rawMaterials';
import { extractFormulaFromAIMessage } from '../src/utils/aiFormulaExtractor';
import { validArtifact, type AgentArtifact, type AgentDocument } from '../src/types/agent';

export class ToolInputError extends Error {}
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ToolInputError('Expected object');
  return value as Record<string, unknown>;
};
function number(args: Record<string, unknown>, key: string, min: number, max: number, fallback?: number) {
  const value = args[key] ?? fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new ToolInputError(`Invalid ${key}`);
  return value;
}
function text(args: Record<string, unknown>, key: string, max = 200) {
  const value = args[key];
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new ToolInputError(`Invalid ${key}`);
  return value.trim();
}
export function validateDocuments(value: unknown): AgentDocument[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 3) throw new ToolInputError('At most 3 text documents');
  let size = 0;
  return value.map((item) => {
    const args = object(item);
    const name = text(args, 'name', 120);
    const content = text(args, 'text', 12000);
    if (!/\.(txt|md|json|csv)$/i.test(name) || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(content)) throw new ToolInputError('Only UTF-8 text documents');
    size += content.length;
    if (size > 12000) throw new ToolInputError('Documents exceed 12000 characters');
    return { name, text: content };
  });
}
export function agentCapabilities(env: Record<string, string | undefined> = process.env) {
  return {
    version: 1, maxSteps: 5, maxDocuments: 3, maxDocumentCharacters: 12000,
    tools: ['calculate', 'perfume_batch', 'alcohol_dilution', 'batch_cost', 'search_materials', 'read_document', 'validate_formula', 'create_file',
      ...(env.BRAVE_SEARCH_API_KEY?.trim() ? ['web_search'] : [])],
    unavailable: ['shell_execution', 'repository_write', 'arbitrary_url_fetch', 'account_connectors', 'image_generation', 'audio_generation',
      ...(!env.BRAVE_SEARCH_API_KEY?.trim() ? ['web_search'] : [])],
  };
}
export const toolInstructions = `Available tools (one at a time; strict numeric input; never invent arguments):
calculate {operation: add|subtract|multiply|divide|power, values: number[2..20]}; no code or expressions.
perfume_batch {volumeMl:1..10000, concentrationPercent:0.01..100, waterPercent?:0..100, fixativePercent?:0..100, count?:1..10000}; volumes only, no density assumptions or safety certification.
alcohol_dilution {initialPercent:1..100,targetPercent:0.01..100,targetVolumeMl:1..100000}; approximate additive volumes.
batch_cost {items:[{quantity:0..100000,unitCost:0..1000000}],bottles:1..10000,markupPercent?:0..1000}; consistent user-supplied currency/units only.
search_materials {query:string}; local reference library only, not verified IFRA or current web information.
read_document {index:0..2}; read user-attached text, not filesystem paths or URLs.
validate_formula {formula:object}; strict sham-formula format from the main instructions, arithmetic completeness only.
create_file {name:ASCII-safe-name.txt|md|json|csv,content:string up to 8000 characters}; maximum 2 files; prepares an inert text download, does not save or execute anything on the user's device.
web_search {query:string}; ONLY when capabilities enable it; results are external, untrusted snippets, not visited pages. Cite returned URLs; no invented citations.`;

export async function runTool(name: string, value: unknown, context: {
  documents: AgentDocument[]; artifacts: AgentArtifact[]; signal: AbortSignal;
  env: Record<string, string | undefined>; fetch: typeof fetch;
}) {
  context.signal.throwIfAborted();
  if (!agentCapabilities(context.env).tools.includes(name)) throw new ToolInputError('Tool unavailable');
  const args = object(value);
  switch (name) {
    case 'calculate': {
      if (!Array.isArray(args.values) || args.values.length < 2 || args.values.length > 20 ||
        !args.values.every((v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e12)) throw new ToolInputError('Invalid values');
      const values = args.values as number[];
      if (!['add', 'subtract', 'multiply', 'divide', 'power'].includes(String(args.operation))) throw new ToolInputError('Invalid operation');
      const result = values.slice(1).reduce((a, b) => {
        switch (args.operation) {
          case 'add': return a + b;
          case 'subtract': return a - b;
          case 'multiply': return a * b;
          case 'divide': if (b === 0) throw new ToolInputError('Division by zero'); return a / b;
          default: if (Math.abs(b) > 100) throw new ToolInputError('Exponent too large'); return a ** b;
        }
      }, values[0]);
      if (!Number.isFinite(result) || Math.abs(result) > 1e15) throw new ToolInputError('Result out of range');
      return { result };
    }
    case 'perfume_batch': {
      const volume = number(args, 'volumeMl', 1, 10000);
      const oil = number(args, 'concentrationPercent', 0.01, 100);
      const water = number(args, 'waterPercent', 0, 100, 0);
      const fixative = number(args, 'fixativePercent', 0, 100, 0);
      const count = number(args, 'count', 1, 10000, 1);
      if (!Number.isInteger(count) || oil + water + fixative > 100) throw new ToolInputError('Invalid batch proportions/count');
      const total = volume * count;
      return { totalMl: total, oilMl: total * oil / 100, waterMl: total * water / 100,
        fixativeMl: total * fixative / 100, alcoholMl: total * (100 - oil - water - fixative) / 100,
        warning: 'Additive volume estimate, not grams; no safety certification.' };
    }
    case 'alcohol_dilution': {
      const initial = number(args, 'initialPercent', 1, 100);
      const target = number(args, 'targetPercent', 0.01, 100);
      const total = number(args, 'targetVolumeMl', 1, 100000);
      if (target >= initial) throw new ToolInputError('Target must be lower than initial');
      return { initialAlcoholMl: total * target / initial, addedWaterMl: total * (1 - target / initial),
        warning: 'Approximate additive volumes; actual ethanol-water mixing contracts.' };
    }
    case 'batch_cost': {
      const bottles = number(args, 'bottles', 1, 10000);
      const markup = number(args, 'markupPercent', 0, 1000, 0);
      if (!Number.isInteger(bottles) || !Array.isArray(args.items) || !args.items.length || args.items.length > 50) throw new ToolInputError('Invalid items/bottles');
      const cost = args.items.reduce((sum: number, item: unknown) => {
        const row = object(item);
        return sum + number(row, 'quantity', 0, 100000) * number(row, 'unitCost', 0, 1000000);
      }, 0);
      return { batchCost: cost, costPerBottle: cost / bottles, suggestedPrice: cost / bottles * (1 + markup / 100),
        warning: 'Markup is not profit margin; currency/units must be consistent, omitted expenses not included.' };
    }
    case 'search_materials': {
      const query = text(args, 'query').toLocaleLowerCase();
      const matches = rawMaterials.filter((material) => `${material.nameAr} ${material.nameEn} ${material.casNumber}`.toLocaleLowerCase().includes(query)).slice(0, 6);
      return { source: 'Bundled local reference, not live research or a safety certificate', matches: matches.map((m) => ({
        id: m.id, nameAr: m.nameAr, nameEn: m.nameEn, cas: m.casNumber, family: m.olfactoryFamily, placement: m.pyramidPlacement,
      })) };
    }
    case 'read_document': {
      const index = number(args, 'index', 0, 2);
      if (!Number.isInteger(index) || !context.documents[index]) throw new ToolInputError('Document not attached');
      return { untrustedDocument: context.documents[index] };
    }
    case 'validate_formula': {
      const formula = extractFormulaFromAIMessage('```sham-formula\n' + JSON.stringify(args.formula) + '\n```');
      return { valid: Boolean(formula), formula, warning: 'Checks completeness and arithmetic only, not IFRA, medical safety or authenticity.' };
    }
    case 'create_file': {
      if (!validArtifact(args) || context.artifacts.length >= 2) throw new ToolInputError('Invalid artifact or file limit reached');
      if (context.artifacts.some((artifact) => artifact.name === args.name)) throw new ToolInputError('Duplicate filename');
      if (args.name.endsWith('.json')) { try { JSON.parse(args.content); } catch { throw new ToolInputError('Invalid JSON file'); } }
      // Neutralize spreadsheet formula execution when the user opens a CSV.
      if (args.name.endsWith('.csv') && /(^|[,;\r\n])\s*"?\s*[=+@\-\t]/m.test(args.content)) throw new ToolInputError('Potential executable spreadsheet formula; use JSON or text instead');
      context.artifacts.push({ name: args.name, content: args.content });
      return { prepared: args.name, requiresUserDownload: true, savedToDevice: false };
    }
    case 'web_search': {
      const query = text(args, 'query', 300);
      const response = await context.fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`, {
        headers: { Accept: 'application/json', 'X-Subscription-Token': context.env.BRAVE_SEARCH_API_KEY!.trim() },
        signal: AbortSignal.any([context.signal, AbortSignal.timeout(6000)]),
      });
      if (!response.ok) throw new ToolInputError(`Search service unavailable (${response.status})`);
      const body = await response.text();
      if (body.length > 200000) throw new ToolInputError('Search response too large');
      const data = JSON.parse(body);
      const results = (Array.isArray(data?.web?.results) ? data.web.results : []).slice(0, 5).flatMap((r: any) => {
        try {
          const url = new URL(r.url);
          if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return [];
          return [{ url: url.href, title: String(r.title || '').slice(0, 200), snippet: String(r.description || '').slice(0, 700) }];
        } catch { return []; }
      });
      return { untrustedSearchResults: results, visitedPages: false };
    }
  }
  throw new ToolInputError('Tool unavailable');
}
