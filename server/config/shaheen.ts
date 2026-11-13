/**
 * Shared settings of «الخبير شاهين» — ONE place for every deployment.
 *
 * The GitHub Pages site has no server of its own: it calls the Vercel API. So whatever this file
 * says is what visitors get on BOTH sites after the next deploy (a push to main redeploys Vercel and
 * Pages together). The admin dashboard (/#admin → «الخبير شاهين») can override these values at
 * runtime, but those overrides only survive when the server uses a persistent store
 * (SHAM_STORE=firestore on Vercel, or the file store on a VPS). Without one, change them here.
 *
 * Secrets never go in this file: API keys stay in the server environment (Vercel → Settings →
 * Environment Variables).
 */
import type { ModelEngineId, ShaheenSettings } from '../core/types';

export const SHAHEEN_ENGINES: ModelEngineId[] = ['gemini', 'perplexity', 'deepseek', 'openai', 'claude', 'self_hosted', 'openrouter'];

/**
 * What visitors choose between. They never see engine or vendor names — only Shaheen and these modes.
 *  auto    : the admin's failover order (below), default answer style
 *  fast    : short, direct answers; prefers the quickest engines
 *  deep    : detailed analysis (reasoning, alternatives, risks, step-by-step numbers); prefers the strongest engines
 *  council : several engines discuss, one synthesised answer (only offered when 2+ council seats work)
 */
export const SHAHEEN_MODES = ['auto', 'fast', 'deep', 'council'] as const;
export type ShaheenMode = typeof SHAHEEN_MODES[number];

/** Engine preference per mode, filtered by the engines the admin enabled and the keys that exist. */
export const SHAHEEN_MODE_ORDER: Record<'fast' | 'deep', ModelEngineId[]> = {
  fast: ['gemini', 'deepseek', 'openai', 'perplexity', 'self_hosted', 'openrouter', 'claude'],
  deep: ['claude', 'openai', 'gemini', 'perplexity', 'deepseek', 'openrouter', 'self_hosted'],
};

export const SHAHEEN_SITE_SETTINGS: ShaheenSettings = {
  enabled: true,
  // Failover order for "auto". Engines without a key are skipped automatically.
  engines: ['gemini', 'perplexity', 'deepseek', 'openai', 'claude', 'self_hosted', 'openrouter'],
  // Empty = GEMINI_MODEL / OPENAI_MODEL / … from the server env, else the built-in default.
  models: {},
  temperature: 0.5,
  maxTokens: 4096,
  instructions: '',
  allowVisitorChoice: true,
};

export class ShaheenConfigError extends Error {
  constructor(message: string) { super(message); this.name = 'ShaheenConfigError'; }
}

const MODEL_ID = /^[A-Za-z0-9._:/@-]{1,120}$/;

/** Validates an admin patch on top of the current settings (unknown keys are ignored). */
export function normalizeShaheen(input: unknown, current: ShaheenSettings = SHAHEEN_SITE_SETTINGS): ShaheenSettings {
  if (input === undefined) return { ...current };
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ShaheenConfigError('Shaheen settings must be an object');
  const patch = input as Partial<Record<keyof ShaheenSettings, unknown>>;
  const next: ShaheenSettings = { ...current, models: { ...current.models } };
  if (patch.enabled !== undefined) next.enabled = Boolean(patch.enabled);
  if (patch.allowVisitorChoice !== undefined) next.allowVisitorChoice = Boolean(patch.allowVisitorChoice);
  if (patch.engines !== undefined) {
    if (!Array.isArray(patch.engines) || patch.engines.some((id) => !SHAHEEN_ENGINES.includes(id as ModelEngineId))) {
      throw new ShaheenConfigError('Unknown engine in Shaheen engines');
    }
    next.engines = [...new Set(patch.engines as ModelEngineId[])];
  }
  if (patch.models !== undefined) {
    if (!patch.models || typeof patch.models !== 'object' || Array.isArray(patch.models)) throw new ShaheenConfigError('models must be an object');
    const models: ShaheenSettings['models'] = {};
    for (const [id, value] of Object.entries(patch.models as Record<string, unknown>)) {
      if (!SHAHEEN_ENGINES.includes(id as ModelEngineId)) throw new ShaheenConfigError(`Unknown engine ${id}`);
      if (value === undefined || value === null || value === '') continue;
      if (typeof value !== 'string' || !MODEL_ID.test(value.trim())) throw new ShaheenConfigError(`Invalid model id for ${id}`);
      models[id as ModelEngineId] = value.trim();
    }
    next.models = models;
  }
  if (patch.temperature !== undefined) {
    const t = Number(patch.temperature);
    if (!Number.isFinite(t) || t < 0 || t > 1) throw new ShaheenConfigError('Temperature must be between 0 and 1');
    next.temperature = t;
  }
  if (patch.maxTokens !== undefined) {
    const n = Number(patch.maxTokens);
    if (!Number.isInteger(n) || n < 256 || n > 8192) throw new ShaheenConfigError('maxTokens must be an integer between 256 and 8192');
    next.maxTokens = n;
  }
  if (patch.instructions !== undefined) {
    if (typeof patch.instructions !== 'string') throw new ShaheenConfigError('instructions must be text');
    next.instructions = patch.instructions.trim().slice(0, 2000);
  }
  return next;
}

/** Settings saved before a field existed (or before Shaheen settings existed) get the file defaults. */
export function withShaheenDefaults(stored: Partial<ShaheenSettings> | undefined): ShaheenSettings {
  if (!stored) return { ...SHAHEEN_SITE_SETTINGS, models: { ...SHAHEEN_SITE_SETTINGS.models } };
  try { return normalizeShaheen(stored, SHAHEEN_SITE_SETTINGS); } catch { return { ...SHAHEEN_SITE_SETTINGS }; }
}
