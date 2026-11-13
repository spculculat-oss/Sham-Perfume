/**
 * «استوديو شاهين»: the studio's calls — the AI platforms through /api/workspace/ask (tasks «site» and «storyboard»)
 * and pictures through the workspace image engine — each with its own fallback, so the studio always produces
 * something: the built-in templates and storyboard writer, and the open image generator.
 */
import type { SupportedLanguage } from '../types/i18n';
import { ask, makeImage, serverReachable } from '../workspace/workspaceApi';
import { briefToSpec, type SiteSpec } from './siteSpec';
import { forAi, localEdit, siteFromReply, type EditDone } from './siteEdit';
import { cleanStoryboard, localStoryboard, type Aspect, type Mood, type Storyboard, type VideoStyle } from './storyboard';
import { jsonFrom } from './siteSpec';

/** A picture of a given shape. The open generator is asked for that exact size; the AI engine draws its own. */
export async function drawPicture(prompt: string, width = 1024, height = 1024, signal?: AbortSignal): Promise<string> {
  const { src, engine } = await makeImage(prompt, undefined, signal);
  if (engine !== 'open') return src;
  const u = new URL(src);
  u.searchParams.set('width', String(width));
  u.searchParams.set('height', String(height));
  return u.href;
}

export async function buildSite(brief: string, language: SupportedLanguage, { ai, onePage }: { ai: boolean; onePage: boolean }, signal?: AbortSignal): Promise<{ spec: SiteSpec; by: 'ai' | 'local' }> {
  if (ai && serverReachable()) {
    try {
      const { reply } = await ask({ task: 'site', language, messages: [{ role: 'user', text: `${brief}${onePage ? '\n\n(صفحة واحدة فقط / one page only)' : ''}` }] }, signal);
      const spec = siteFromReply(reply, language);
      if (spec) return { spec, by: 'ai' };
    } catch (error) { if (signal?.aborted) throw error; }
  }
  return { spec: briefToSpec(brief, { language, onePage }), by: 'local' };
}

export async function editSite(instruction: string, spec: SiteSpec, page: string, language: SupportedLanguage, { ai }: { ai: boolean }, signal?: AbortSignal): Promise<{ spec: SiteSpec; by: 'local' | 'ai'; done: EditDone[] } | undefined> {
  const local = localEdit(instruction, spec, page);
  if (local.done.length) return { spec: local.spec, by: 'local', done: local.done };
  if (!ai || !serverReachable()) return undefined;
  const { json, restore } = forAi(spec);
  const { reply } = await ask({ task: 'site', language, messages: [{ role: 'user', text: `الموقع الحالي (the current site):\n\`\`\`json\n${json}\n\`\`\`\n\nالصفحة المفتوحة (open page): ${page}\nالتعديل المطلوب (requested change): ${instruction}` }] }, signal);
  const next = siteFromReply(reply, spec.lang, restore);
  return next ? { spec: next, by: 'ai', done: [] } : undefined;
}

export async function writeStoryboard(idea: string, language: SupportedLanguage, opts: { ai: boolean; aspect: Aspect; style: VideoStyle; mood: Mood; seconds: number }, signal?: AbortSignal): Promise<{ board: Storyboard; by: 'ai' | 'local' }> {
  if (opts.ai && serverReachable()) {
    try {
      const { reply } = await ask({ task: 'storyboard', language, messages: [{ role: 'user', text: `${idea}\n\n(${opts.seconds} seconds, ${opts.style} style, ${opts.mood} mood)` }] }, signal);
      const board = cleanStoryboard(jsonFrom(reply), opts);
      if (board) return { board: { ...board, aspect: opts.aspect, style: opts.style, mood: opts.mood }, by: 'ai' };
    } catch (error) { if (signal?.aborted) throw error; }
  }
  return { board: localStoryboard(idea, opts), by: 'local' };
}
