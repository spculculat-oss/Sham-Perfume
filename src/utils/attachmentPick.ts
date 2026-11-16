/**
 * «استقبال الملفات»: whatever a visitor attaches — a photo (iPhone HEIC included), a PDF (typed or scanned), Word,
 * Excel, PowerPoint or a text/code file — becomes something Shaheen can read, right in his browser:
 *   picture  → a small JPEG (+ thumbnail) that the platform's eyes read (src/utils/imageReading.ts)
 *   document → its text; a scanned PDF (no text inside) → its first pages as pictures, read the same way
 * Shared by Sham's chat (src/utils/chatStore.ts) and the workspace chat (src/workspace/ChatPanel.tsx).
 */
import type { SupportedLanguage } from '../types/i18n';
import { IMAGE_READ, parseImageDataUrl, type ImageReading } from './imageReading';
import { ImagePickError, shrinkImage, type PickedImage } from './imageShrink';
import { fileText, isTextLike } from '../workspace/fileText';
import { readOnDevice } from './browserOcr';
import { ApiError, requestApi } from './api';

export type PickedAttachment =
  | ({ kind: 'image' } & PickedImage)
  | { kind: 'file'; name: string; text: string; pages?: number; scans?: string[] };

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif|tiff?)$/i;
const OFFICE_EXT = /\.(pdf|docx|xlsx|pptx)$/i;
const HEIC = /\.(heic|heif)$/i;
/** What the attach button offers (the phone's gallery and camera, and documents). */
export const ATTACH_ACCEPT = 'image/*,.heic,.heif,application/pdf,.pdf,.docx,.xlsx,.pptx,.txt,.md,.csv,.tsv,.json,.xml,.html,.htm,.log,.srt,'
  + 'application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,'
  + 'application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv';

export const isPictureFile = (file: { name?: string; type?: string }) => Boolean(file.type?.startsWith('image/') || IMAGE_EXT.test(file.name || ''));
export const isDocumentFile = (file: { name?: string; type?: string }) => OFFICE_EXT.test(file.name || '') || file.type === 'application/pdf' || isTextLike(file.name || '', file.type || '');
const isPdf = (file: { name?: string; type?: string }) => /\.pdf$/i.test(file.name || '') || file.type === 'application/pdf';

const asDataUrl = (blob: Blob, type: string) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).replace(/^data:[^;]*;/, `data:${type};`));
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

/** A small "HEIC" card as the thumbnail of a photo this browser cannot draw (the platform still reads it). */
function placeholderThumb(label: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 120; canvas.height = 120;
  const ctx = canvas.getContext('2d');
  if (!ctx) return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  ctx.fillStyle = '#fef3c7'; ctx.fillRect(0, 0, 120, 120);
  ctx.fillStyle = '#92400e'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, 60, 60);
  return canvas.toDataURL('image/jpeg', 0.8);
}

/** A scanned PDF's first pages as pictures (the PDF reader draws them; loaded only when needed). */
export async function pdfPagesAsPictures(blob: Blob, max: number = IMAGE_READ.scanPages): Promise<{ scans: string[]; pages: number }> {
  const { getDocumentProxy, renderPageAsImage } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(await blob.arrayBuffer()));
  const scans: string[] = [];
  for (let n = 1; n <= Math.min(max, pdf.numPages); n++) {
    try {
      const url = await renderPageAsImage(pdf, n, { width: IMAGE_READ.maxSide, format: 'jpeg', quality: 0.82, toDataURL: true });
      if (url.length <= IMAGE_READ.maxDataUrl) scans.push(url);
    } catch { /* the next page */ }
  }
  return { scans, pages: pdf.numPages };
}

/** One picked/pasted/dropped file → something to read, or an ImagePickError (NOT_IMAGE = not a supported type). */
export async function pickAttachment(file: File): Promise<PickedAttachment> {
  if (file.size > IMAGE_READ.maxFileBytes) throw new ImagePickError('TOO_BIG');
  if (isPictureFile(file)) {
    try { return { kind: 'image', ...(await shrinkImage(file.type.startsWith('image/') ? file : new Blob([file], { type: HEIC.test(file.name) ? 'image/heic' : 'image/jpeg' }), file.name)) }; }
    catch (error) {
      // An iPhone photo (HEIC) that this browser cannot draw: the platform reads HEIC itself — sent as it is.
      if (!(HEIC.test(file.name) || /heic|heif/i.test(file.type))) throw error;
      if (file.size > IMAGE_READ.maxDataUrl * 0.74) throw new ImagePickError('TOO_BIG');
      const dataUrl = await asDataUrl(file, /heif/i.test(file.type) || /\.heif$/i.test(file.name) ? 'image/heif' : 'image/heic');
      if (!parseImageDataUrl(dataUrl)) throw new ImagePickError('UNREADABLE');
      return { kind: 'image', dataUrl, thumb: placeholderThumb('HEIC'), name: file.name.slice(0, 80) };
    }
  }
  if (!isDocumentFile(file)) throw new ImagePickError('NOT_IMAGE');
  const name = file.name.slice(0, 80);
  const text = (await fileText(file, file.name)).replace(/\r/g, '').trim();
  if (text.replace(/\s+/g, '').length >= 20 || !isPdf(file)) {
    if (!text) throw new ImagePickError('UNREADABLE');
    return { kind: 'file', name, text };
  }
  // A scanned PDF: no text inside — its pages are read as pictures.
  const { scans, pages } = await pdfPagesAsPictures(file).catch(() => ({ scans: [] as string[], pages: 0 }));
  if (!scans.length) throw new ImagePickError('UNREADABLE');
  return { kind: 'file', name, text: '', pages, scans };
}

/**
 * The words in one picture: the platform's eyes first, Shaheen's own on this device when the platform can't
 * (not when it refused the picture). undefined = nobody could read it.
 */
export async function readPictureText(dataUrl: string, lang: SupportedLanguage, { request = requestApi, device = readOnDevice, signal }:
  { request?: typeof requestApi; device?: (dataUrl: string, lang: SupportedLanguage, signal?: AbortSignal) => Promise<ImageReading | undefined>; signal?: AbortSignal } = {}): Promise<ImageReading | undefined> {
  try {
    const r = await request<ImageReading>('/api/workspace/read-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, ...(signal ? { signal } : {}),
      body: JSON.stringify({ image: dataUrl, language: lang }) }, 40_000);
    if (r && typeof r.text === 'string') return { text: r.text, ...(typeof r.description === 'string' && r.description ? { description: r.description } : {}), source: 'ai' };
    return undefined;
  } catch (error) {
    if (signal?.aborted) return undefined;
    const deviceCanTry = !(error instanceof ApiError) || error.status >= 500 || error.status === 429 || error.status === 408;
    // The device reader cannot open HEIC (the browser could not draw it either).
    if (!deviceCanTry || /^data:image\/hei[cf]/.test(dataUrl)) return undefined;
    return device(dataUrl, lang, signal).catch(() => undefined);
  }
}

/** A scanned document's pages, read one after the other and joined (page marks kept). */
export async function readScannedPages(scans: string[], lang: SupportedLanguage, options: Parameters<typeof readPictureText>[2] = {}): Promise<{ text: string; source: 'ai' | 'device' } | undefined> {
  const parts: string[] = []; let source: 'ai' | 'device' = 'ai'; let any = false;
  for (const [i, scan] of scans.entries()) {
    const r = await readPictureText(scan, lang, options);
    if (options.signal?.aborted) return undefined;
    if (!r) continue;
    any = true;
    if (r.source === 'device') source = 'device';
    if (r.text.trim()) parts.push(scans.length > 1 ? `--- صفحة ${i + 1} ---\n${r.text.trim()}` : r.text.trim());
  }
  return any ? { text: parts.join('\n\n'), source } : undefined;
}
