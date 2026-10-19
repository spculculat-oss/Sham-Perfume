/**
 * Loads the AI translation pack of one language on demand (Vite splits every src/لغات/ai/<lang>.json into
 * its own small file). Kept apart from aiPacks.ts so tests and the server never touch import.meta.glob.
 */
import { hasAiPack, registerAiPack, type AiPack } from './aiPacks';

const LOADERS = import.meta.glob<{ default: AiPack }>('./ai/*.json');

/** true when a pack was just loaded (the caller re-renders once). */
export async function loadAiPack(lang: string): Promise<boolean> {
  if (hasAiPack(lang)) return false;
  const load = LOADERS[`./ai/${lang}.json`];
  if (!load) return false;
  try {
    registerAiPack(lang, (await load()).default);
    return true;
  } catch {
    return false; // offline or an old cached page: the English fallback stays
  }
}
