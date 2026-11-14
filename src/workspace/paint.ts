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

/** What a painted picture was made from: kept beside it so it can be redrawn, exported sharper, or moved in depth. */
export interface PaintedInfo { idea: string; look: { style?: ImageStyleId; aspect?: ImageAspect }; seed: number; painting: Painting }
const PAINTED = new Map<string, PaintedInfo>();
export const paintedInfo = (src: string): PaintedInfo | undefined => PAINTED.get(src);
function remember(src: string, info: PaintedInfo): void {
  PAINTED.set(src, info);
  if (PAINTED.size > 12) PAINTED.delete(PAINTED.keys().next().value as string);
}

/** One SVG sheet onto a canvas; `scale` 2 gives the sharp export (the drawing is vector, so nothing is lost). */
export async function svgCanvas(svg: string, width: number, height: number, scale = 1): Promise<HTMLCanvasElement> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve(); image.onerror = () => reject(new Error('PAINT_FAILED'));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('PAINT_FAILED');
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function paintPng(idea: string, look: { style?: ImageStyleId; aspect?: ImageAspect; seed?: number } = {}): Promise<{ src: string; painting: Painting }> {
  const seed = look.seed ?? 1;
  const painting = paintScene(idea, { ...look, seed });
  const src = (await svgCanvas(painting.svg, painting.width, painting.height)).toDataURL('image/png');
  remember(src, { idea, look: { style: look.style, aspect: look.aspect }, seed, painting });
  return { src, painting };
}

export const HD_SCALE = 2;
/** The painter's professional tools on a picture it drew: another take, a sharp export, a print file, depth layers. */
export const paintAgain = async (info: PaintedInfo): Promise<string> => (await paintPng(info.idea, { ...info.look, seed: info.seed + 1 + Math.floor(Math.random() * 100_000) })).src;
export const paintedHd = (info: PaintedInfo): Promise<HTMLCanvasElement> => svgCanvas(info.painting.svg, info.painting.width, info.painting.height, HD_SCALE);
export const paintedSvg = (info: PaintedInfo): Blob => new Blob([info.painting.svg], { type: 'image/svg+xml' });
export const paintedLayers = (info: PaintedInfo): Promise<HTMLCanvasElement[]> => Promise.all([info.painting.layers.back, info.painting.layers.front].map((sheet) => svgCanvas(sheet, info.painting.width, info.painting.height)));

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
