import React, { Suspense, lazy, useEffect, useSyncExternalStore } from 'react';
import { ImagePlus, Loader2, RotateCw } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { imageRequest } from '../workspace/codeBlocks';
import { wsText } from '../workspace/strings';
import { imageErrorKey, isGeneratedImageData } from '../workspace/workspaceApi';
import { drawOrPaint } from '../workspace/paint';
import { fitForUpload } from '../workspace/motion';
import { drawReply, drawingOf, freshReplies, previousDrawing, subscribeDrawings } from '../utils/shaheenDrawings';

// The signed picture card (download, motion clip) arrives only when a picture is actually drawn.
const MotionCard = lazy(() => import('../workspace/MotionCard').then((m) => ({ default: m.MotionCard })));

const draw = async (prompt: string, previous?: string) => {
  const out = await drawOrPaint(prompt, previous && isGeneratedImageData(previous) ? await fitForUpload(previous) : undefined);
  return { src: out.src, ...(out.painted ? { painted: out.painted } : {}) };
};

/**
 * The picture under a reply of «اسأل شاهين» that carries a ```sham-image order: drawn once when the reply
 * arrives, shown signed, and — when it could not be drawn — the real reason with a retry, in the visitor's language.
 */
export function ShaheenDrawing({ messageId, text, messageIds, lang }: { messageId: string; text: string; messageIds: readonly string[]; lang: SupportedLanguage }) {
  const line = imageRequest(text);
  const drawing = useSyncExternalStore(subscribeDrawings, () => drawingOf(messageId), () => undefined);
  const start = () => { if (line) void drawReply(messageId, line, draw, imageErrorKey, previousDrawing(messageIds, messageId)); };
  useEffect(() => {
    if (line && !drawingOf(messageId) && freshReplies.has(messageId)) start();
  }, [messageId, line]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!line) return null;
  const button = 'inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-900 cursor-pointer';
  if (drawing?.status === 'done') {
    return (
      <Suspense fallback={<Loader2 className="h-4 w-4 animate-spin text-amber-700" />}>
        <MotionCard src={drawing.src} lang={lang} />
        {drawing.painted && <p role="status" className="text-xs text-stone-600" data-testid="shaheen-painter-note">{wsText(lang, drawing.painted === 'partial' ? 'painter_partial' : 'painter_note')}</p>}
      </Suspense>
    );
  }
  if (drawing?.status === 'busy') {
    return <p role="status" className="flex items-center gap-1.5 text-xs text-stone-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />{wsText(lang, 'drawing')}</p>;
  }
  if (drawing?.status === 'error') {
    return (
      <div role="status" className="space-y-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900" data-testid="shaheen-drawing-error">
        <p>{wsText(lang, drawing.note)}</p>
        <button type="button" onClick={start} className={button}><RotateCw className="h-3.5 w-3.5" />{wsText(lang, 'image_retry')}</button>
      </div>
    );
  }
  return <button type="button" onClick={start} className={button}><ImagePlus className="h-3.5 w-3.5" />{wsText(lang, 'image_draw')}</button>;
}
