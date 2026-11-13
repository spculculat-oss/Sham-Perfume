/**
 * «مرسم شاهين» in the browser: the painter's SVG (src/utils/shaheenPainter.ts) becomes a PNG, and
 * `drawOrPaint` is the one door the chat and the Images tab use — the image engine first; when it is not
 * there (no service, no quota, engine error) Shaheen paints the idea himself and says so. An engine refusal,
 * a rate limit, a real-photo request and an edit of an existing picture are never painted over.
 */
import { paintScene, type Painting } from '../utils/shaheenPainter';
import type { ImageAspect, ImageStyleId } from '../utils/imageCraft';
import { imageErrorKey, makeImage } from './workspaceApi';

export type Painted = 'whole' | 'partial';
export interface DrawnImage { src: string; engine: 'ai' | 'shaheen'; painted?: Painted; missing?: string }

export async function paintPng(idea: string, look: { style?: ImageStyleId; aspect?: ImageAspect; seed?: number } = {}): Promise<{ src: string; painting: Painting }> {
  const painting = paintScene(idea, look);
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve(); image.onerror = () => reject(new Error('PAINT_FAILED'));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(painting.svg)}`;
  });
  const canvas = document.createElement('canvas');
  canvas.width = painting.width; canvas.height = painting.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('PAINT_FAILED');
  ctx.drawImage(image, 0, 0, painting.width, painting.height);
  return { src: canvas.toDataURL('image/png'), painting };
}

/** Which failures mean «the engine is not there» (the painter steps in) rather than «this request is not allowed». */
export function painterStepsIn(error: unknown, editing: boolean): boolean {
  if (editing || typeof document === 'undefined') return false;
  if (error instanceof Error && (error.name === 'AbortError' || error.message === 'REAL_PHOTO_REQUIRES_SEARCH')) return false;
  const why = imageErrorKey(error);
  return why === 'image_unavailable' || why === 'image_quota' || why === 'image_failed';
}

export async function drawOrPaint(prompt: string, image?: string, signal?: AbortSignal, look: { style?: ImageStyleId; aspect?: ImageAspect } = {}): Promise<DrawnImage> {
  try {
    return await makeImage(prompt, image, signal, look);
  } catch (error) {
    if (signal?.aborted || !painterStepsIn(error, Boolean(image))) throw error;
    const { src, painting } = await paintPng(prompt, { ...look, seed: Math.floor(Math.random() * 1_000_000) });
    return { src, engine: 'shaheen', painted: painting.missing ? 'partial' : 'whole', ...(painting.missing ? { missing: painting.missing } : {}) };
  }
}
