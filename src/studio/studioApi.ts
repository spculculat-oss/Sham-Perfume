/**
 * «استوديو شاهين»: the studio's calls — the AI platforms through /api/workspace/ask (tasks «site» and «storyboard»)
 * and pictures through the configured workspace image engine. Site/storyboard templates remain local fallbacks;
 * image generation reports failure rather than switching to an external generator.
 */
import type { SupportedLanguage } from '../types/i18n';
import { ApiError, apiUrl, requestApi, visitorId } from '../utils/api';
import { getToken } from '../admin/adminApi';
import { ask, makeImage, ownerSignedIn, serverReachable, workspaceStatus } from '../workspace/workspaceApi';
import { briefToSpec, type SiteSpec } from './siteSpec';
import { forAi, localEdit, siteFromReply, type EditDone } from './siteEdit';
import { castOf, cleanStoryboard, localStoryboard, SHOT_PROMPT, shotFor, stylePrompt, visualPrompt, type Aspect, type Mood, type Storyboard, type VideoStyle } from './storyboard';
import { jsonFrom } from './siteSpec';

/** Request a picture from the configured engine; dimensions remain hints for callers, not a format guarantee. */
export async function drawPicture(prompt: string, _width = 1024, _height = 1024, signal?: AbortSignal): Promise<string> {
  const { src } = await makeImage(prompt, undefined, signal);
  return src;
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

// ── The professional video engine (real moving footage with sound) ─────────────────────────────────────────────
// Off until the owner turns it on in the server settings; then only for him, or for everyone. One scene = one clip.
export type ProAccess = 'off' | 'owner' | 'everyone';
/** Whether this visitor can make real clips right now (and how many are left today). */
export async function proVideoAccess(signal?: AbortSignal): Promise<{ access: ProAccess; usable: boolean; left: number }> {
  if (!serverReachable()) return { access: 'off', usable: false, left: 0 };
  try {
    const s = await workspaceStatus(signal);
    const access: ProAccess = s.video === 'owner' || s.video === 'everyone' ? s.video : 'off';
    const usable = access === 'everyone' || access === 'owner' && ownerSignedIn();
    return { access, usable: usable && (s.videoLeft ?? 0) > 0, left: s.videoLeft ?? 0 };
  } catch { return { access: 'off', usable: false, left: 0 }; }
}

/** The wording sent for one scene: what happens, the look, the camera, the mood — and the same characters throughout. */
export function clipPrompt(board: Storyboard, i: number): string {
  const scene = board.scenes[i]!;
  const camera: Record<Storyboard['scenes'][number]['motion'], string> = {
    'zoom-in': 'slow push-in towards the subject', 'zoom-out': 'slow pull-back revealing the scene', 'pan-left': 'smooth pan to the left',
    'pan-right': 'smooth pan to the right', 'pan-up': 'gentle tilt up', still: 'locked-off static shot',
  };
  const mood: Record<Storyboard['mood'], string> = { calm: 'calm, peaceful', epic: 'epic, dramatic', happy: 'joyful, bright', mystery: 'mysterious, moody' };
  const before = board.scenes.slice(0, i).map((s) => s.prompt).join(' / ').slice(-300);
  return [
    `${SHOT_PROMPT[shotFor(i, board.scenes.length, scene.prompt)]}: ${stylePrompt(visualPrompt(scene.prompt), board.style)}.`,
    `Main subjects (identical in every shot): ${castOf(board)}.`,
    `Camera: ${camera[scene.motion]}. Mood: ${mood[board.mood]}.`,
    scene.caption ? `Natural ambient sound matching the scene; no on-screen text. Narration idea: «${scene.caption}».` : 'Natural ambient sound matching the scene; no on-screen text.',
    before ? `Keep the same characters, clothes and setting as the earlier shots: ${before}.` : '',
    `Part of the story «${board.title}».`,
  ].filter(Boolean).join(' ').slice(0, 1900);
}

const wait = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason ?? new DOMException('Aborted', 'AbortError')); }, { once: true });
});
const proHeaders = (): Record<string, string> => (ownerSignedIn() ? { Authorization: `Bearer ${getToken()}` } : {});

/** Makes one real clip: starts the job, waits for it (up to ~6 minutes), and returns the video file. */
export async function makeProClip(prompt: string, { seconds, aspect, image }: { seconds: number; aspect: '16:9' | '9:16'; image?: string }, signal?: AbortSignal, onState?: (s: string) => void): Promise<Blob> {
  const start = await requestApi<{ job: string; status: string }>('/api/workspace/video/start', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Sham-Visitor': visitorId(), ...proHeaders() },
    body: JSON.stringify({ prompt, seconds: Math.max(3, Math.min(10, Math.round(seconds))), aspect, ...(image ? { image } : {}) }), signal,
  }, 300_000);
  let status = start.status;
  const deadline = Date.now() + 6 * 60_000;
  while (status !== 'completed') {
    if (status === 'failed' || status === 'cancelled') throw new ApiError(502, 'VIDEO_FAILED');
    if (Date.now() > deadline) throw new ApiError(504, 'VIDEO_TIMEOUT');
    onState?.(status);
    await wait(8_000, signal);
    status = (await requestApi<{ status: string }>(`/api/workspace/video/status?job=${encodeURIComponent(start.job)}`, { signal, headers: proHeaders() }, 30_000)).status;
  }
  let response = await fetch(apiUrl(`/api/workspace/video/file?job=${encodeURIComponent(start.job)}`), { signal, headers: proHeaders() });
  for (let tries = 0; response.status === 409 && tries < 10; tries += 1) {
    await wait(6_000, signal); // the file is still being written
    response = await fetch(apiUrl(`/api/workspace/video/file?job=${encodeURIComponent(start.job)}`), { signal, headers: proHeaders() });
  }
  if (!response.ok) throw new ApiError(response.status, 'VIDEO_FAILED');
  const blob = await response.blob();
  if (!blob.size || !/^video\//.test(blob.type || 'video/mp4')) throw new ApiError(502, 'VIDEO_FAILED');
  return blob;
}

/** The picture prompt of one scene for the free engine: shot size, look, and the same cast throughout. */
export function scenePicturePrompt(board: Storyboard, i: number): string {
  const scene = board.scenes[i]!;
  return `${SHOT_PROMPT[shotFor(i, board.scenes.length, scene.prompt)]}, ${stylePrompt(visualPrompt(scene.prompt), board.style)}, same characters: ${castOf(board)}`;
}
