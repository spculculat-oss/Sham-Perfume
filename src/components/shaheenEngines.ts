import type { SupportedLanguage } from '../types/i18n';
import { loc } from '../utils/localize';
import type { ShaheenEngine } from '../hooks/useShaheenModels';
import type { ShaheenModelChoice } from '../utils/chatStore';

/** Toolbar chip colours (dark toolbar). */
export const ENGINE_CHIP: Record<string, string> = {
  auto: 'border-amber-400 bg-amber-500/20 text-amber-300',
  gemini: 'border-emerald-400 bg-emerald-500/20 text-emerald-300',
  deepseek: 'border-blue-400 bg-blue-500/20 text-blue-300',
  openai: 'border-green-400 bg-green-500/20 text-green-300',
  claude: 'border-purple-400 bg-purple-500/20 text-purple-300',
  self_hosted: 'border-stone-300 bg-stone-500/20 text-stone-100',
  openrouter: 'border-sky-400 bg-sky-500/20 text-sky-300',
};

/** Message badge colours (light bubble). */
export const ENGINE_BADGE: Record<string, string> = {
  gemini: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  deepseek: 'bg-blue-50 text-blue-800 border-blue-200',
  openai: 'bg-green-50 text-green-800 border-green-200',
  claude: 'bg-purple-50 text-purple-800 border-purple-200',
  self_hosted: 'bg-stone-100 text-stone-800 border-stone-300',
  openrouter: 'bg-sky-50 text-sky-800 border-sky-200',
};

const EXTRA_SHORT: Record<string, { ar: string; en: string }> = {
  self_hosted: { ar: '🧠 نموذج شام', en: '🧠 Sham model' },
  openrouter: { ar: '🌐 OpenRouter', en: '🌐 OpenRouter' },
};

export interface EngineChip { id: ShaheenModelChoice; short: string; name: string; color: string; model?: string }

/**
 * Engines to show in a toolbar: "auto" + the engines that are really enabled on the server.
 * `short` labels for the classic four come from the component's own translations.
 */
export function visibleEngines(
  engines: ShaheenEngine[], language: SupportedLanguage, shortLabel: (id: string) => string | undefined,
): EngineChip[] {
  const list = engines.length ? engines : [{ id: 'auto', name: 'auto', hasApiKey: false } as ShaheenEngine];
  return list
    .filter((e) => e.id === 'auto' || e.hasApiKey)
    .map((e) => ({
      id: e.id,
      short: shortLabel(e.id) || (EXTRA_SHORT[e.id] ? loc(language, EXTRA_SHORT[e.id]) : e.name),
      name: e.id === 'auto' ? (shortLabel('auto') || 'Auto') : e.name,
      color: ENGINE_CHIP[e.id] || ENGINE_CHIP.auto,
      model: e.model,
    }));
}

/**
 * Scroll only the chat's own scroll box to its end. `scrollIntoView` also scrolls
 * the page/window, which made the lab page jump down on open and on every reply.
 */
export function scrollChatToEnd(marker: HTMLElement | null, smooth = true): void {
  let box = marker?.parentElement ?? null;
  while (box && box !== document.body) {
    const overflow = getComputedStyle(box).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll') && box.scrollHeight > box.clientHeight) {
      box.scrollTo({ top: box.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
      return;
    }
    box = box.parentElement;
  }
}
