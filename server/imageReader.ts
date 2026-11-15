/**
 * «شاهين يقرا الصور» on the server (rules: src/utils/imageReading.ts): the AI platform's eyes read every word in a
 * visitor's picture and say what it shows. POST /api/workspace/read-image { image: dataURL, language? }.
 * Nothing is stored or logged — the picture and what was read only pass through.
 */
import { GEMINI_DEFAULT_MODEL, geminiThinking } from './core/engines';
import { IMAGE_READ_INSTRUCTION, parseImageDataUrl, readingFromModel, type ImageReading } from '../src/utils/imageReading';

type Env = Record<string, string | undefined>;

export class ImageReadError extends Error {
  constructor(public status: number, public code: 'BAD_IMAGE' | 'NO_VISION_ENGINE' | 'VISION_FAILED' | 'VISION_REFUSED', message: string) { super(message); }
}

/** The models tried in turn: the configured one, the rolling Flash, then the light one (its own free quota). */
const visionModels = (env: Env) => [...new Set([env.SHAM_VISION_MODEL?.trim(), GEMINI_DEFAULT_MODEL, 'gemini-flash-lite-latest'].filter((m): m is string => Boolean(m)))];

export async function readImage(image: unknown, language: string, { env, fetch: request = fetch, signal }: { env: Env; fetch?: typeof fetch; signal?: AbortSignal }): Promise<ImageReading> {
  const inline = parseImageDataUrl(image);
  if (!inline) throw new ImageReadError(400, 'BAD_IMAGE', 'A png, jpeg or webp image up to 3 MB is required');
  const key = env.GEMINI_API_KEY?.trim();
  if (!key || env.SHAM_VISION?.trim().toLowerCase() === 'off') throw new ImageReadError(503, 'NO_VISION_ENGINE', 'No image reader is connected');
  let refused = false;
  for (const model of visionModels(env)) {
    try {
      const response = await request(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000),
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: IMAGE_READ_INSTRUCTION }] },
          contents: [{ role: 'user', parts: [{ inlineData: { mimeType: inline.mimeType, data: inline.data } }, { text: `Requested language for the description: ${language}.` }] }],
          generationConfig: { temperature: 0, responseMimeType: 'application/json', ...geminiThinking(model, 3072) },
        }),
      });
      if (!response.ok) continue; // quota (429), a retired model (404), a busy one (503): the next model
      const data = await response.json() as { promptFeedback?: { blockReason?: string }; candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> };
      if (data.promptFeedback?.blockReason) { refused = true; continue; }
      const text = (data.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('');
      const reading = readingFromModel(text);
      if (reading) return reading;
    } catch (error) {
      if (signal?.aborted) throw error;
    }
  }
  if (refused) throw new ImageReadError(422, 'VISION_REFUSED', 'The image could not be read');
  throw new ImageReadError(502, 'VISION_FAILED', 'The image reader did not answer');
}
