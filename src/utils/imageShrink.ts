/**
 * «شاهين يقرا الصور»: the visitor's picture made small in his own browser before anything leaves — a JPEG of at most
 * IMAGE_READ.maxSide pixels (small print stays readable), plus a tiny thumbnail for the chat history.
 */
import { IMAGE_READ } from './imageReading';

export class ImagePickError extends Error {
  constructor(public code: 'NOT_IMAGE' | 'TOO_BIG' | 'UNREADABLE') { super(code); }
}

async function decode(file: Blob): Promise<{ draw: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
      return { draw: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch { /* older Safari: the <img> path below */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { draw: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (error) { URL.revokeObjectURL(url); throw error; }
}

function render(source: CanvasImageSource, width: number, height: number, side: number, quality: number): string {
  const scale = Math.min(1, side / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImagePickError('UNREADABLE');
  ctx.fillStyle = '#ffffff'; // a transparent PNG (a screenshot, a logo) reads as dark text on white
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

export interface PickedImage { dataUrl: string; thumb: string; name: string }

/** A picked/pasted/dropped file → the picture to read and its thumbnail. */
export async function shrinkImage(file: File | Blob, name = (file as File).name || 'image'): Promise<PickedImage> {
  if (!file.type.startsWith('image/')) throw new ImagePickError('NOT_IMAGE');
  if (file.size > IMAGE_READ.maxFileBytes) throw new ImagePickError('TOO_BIG');
  let picture;
  try { picture = await decode(file); } catch { throw new ImagePickError('UNREADABLE'); }
  try {
    let side: number = IMAGE_READ.maxSide; let quality = 0.86;
    let dataUrl = render(picture.draw, picture.width, picture.height, side, quality);
    while (dataUrl.length > IMAGE_READ.maxDataUrl && side > 600) {
      side = Math.round(side * 0.8); quality = Math.max(0.6, quality - 0.08);
      dataUrl = render(picture.draw, picture.width, picture.height, side, quality);
    }
    if (dataUrl.length > IMAGE_READ.maxDataUrl) throw new ImagePickError('TOO_BIG');
    const thumb = render(picture.draw, picture.width, picture.height, IMAGE_READ.thumbSide, 0.7);
    return { dataUrl, thumb, name: name.slice(0, 80) };
  } finally { picture.close(); }
}
