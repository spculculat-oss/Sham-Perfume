/**
 * «شاهين يقرا الصور» — Shaheen's own eyes: when the AI platform can't read the picture (no key, quota, no
 * connection), the words are read right here in the visitor's browser (open-source Tesseract, loaded only then).
 * Text only, no description; the picture never leaves the device on this path.
 */
import type { SupportedLanguage } from '../types/i18n';
import { cleanOcrText, ocrLanguages, type ImageReading } from './imageReading';

export async function readOnDevice(dataUrl: string, lang: SupportedLanguage, signal?: AbortSignal): Promise<ImageReading | undefined> {
  if (typeof window === 'undefined') return undefined;
  const { createWorker } = await import('tesseract.js');
  if (signal?.aborted) return undefined;
  const worker = await createWorker(ocrLanguages(lang));
  const stop = () => { void worker.terminate(); };
  signal?.addEventListener('abort', stop, { once: true });
  try {
    const { data } = await worker.recognize(dataUrl);
    const text = cleanOcrText(data.text || '');
    // Tesseract always "finds" something; very low confidence on a photo with no words is noise, not text.
    if (!text || (data.confidence ?? 0) < 35) return { text: '', source: 'device' };
    return { text, source: 'device' };
  } catch {
    return undefined;
  } finally {
    signal?.removeEventListener('abort', stop);
    void worker.terminate().catch(() => undefined);
  }
}
