import { useCallback, useRef, useState, type ClipboardEvent, type DragEvent } from 'react';
import { ImagePlus, X, ScanText } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { imageWords } from '../utils/imageReading';
import { ImagePickError, shrinkImage, type PickedImage } from '../utils/imageShrink';
import type { ChatImage } from '../utils/chatStorage';

/**
 * «شاهين يقرا الصور» in the chat box: attach (button, paste or drop) → a small preview → sent with the question.
 * The picture is made small in the browser first; only a thumbnail and the text read from it stay in the chat.
 */
export function useImagePick(lang: SupportedLanguage) {
  const [picked, setPicked] = useState<PickedImage | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const words = imageWords(lang);
  const pick = useCallback(async (file: File | Blob | null | undefined) => {
    if (!file) return;
    setError(''); setBusy(true);
    try { setPicked(await shrinkImage(file)); }
    catch (e) { setPicked(null); setError(e instanceof ImagePickError && e.code === 'TOO_BIG' ? words.tooBig : e instanceof ImagePickError && e.code === 'NOT_IMAGE' ? words.notImage : words.failed); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ''; }
  }, [words]);
  const clear = useCallback(() => { setPicked(null); setError(''); }, []);
  /** Paste a screenshot straight into the box. */
  const onPaste = useCallback((e: ClipboardEvent) => {
    const file = [...e.clipboardData.items].find((i) => i.kind === 'file' && i.type.startsWith('image/'))?.getAsFile();
    if (file) { e.preventDefault(); void pick(file); }
  }, [pick]);
  const onDrop = useCallback((e: DragEvent) => {
    const file = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/'));
    if (file) { e.preventDefault(); void pick(file); }
  }, [pick]);
  return { picked, error, busy, pick, clear, onPaste, onDrop, inputRef, words };
}
export type ImagePick = ReturnType<typeof useImagePick>;

export function ImageAttachButton({ pick, disabled, className = '' }: { pick: ImagePick; disabled?: boolean; className?: string }) {
  return (
    <>
      <input ref={pick.inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/heic,image/heif,image/*" className="hidden" aria-hidden="true" tabIndex={-1}
        onChange={(e) => { void pick.pick(e.target.files?.[0]); }} />
      <button type="button" disabled={disabled || pick.busy} onClick={() => pick.inputRef.current?.click()} title={pick.words.attach} aria-label={pick.words.attach}
        data-testid="chat-image-attach"
        className={`p-2.5 rounded-xl border border-stone-200 bg-stone-50 text-amber-800 hover:bg-amber-50 hover:border-amber-600 disabled:opacity-40 transition-all shrink-0 cursor-pointer ${className}`}>
        <ImagePlus className={`w-4 h-4 ${pick.busy ? 'animate-pulse' : ''}`} aria-hidden="true" />
      </button>
    </>
  );
}

/** The picture waiting above the box, or why it could not be taken. */
export function ImagePickPreview({ pick, reading }: { pick: ImagePick; reading?: boolean }) {
  if (!pick.picked && !pick.error) return null;
  return (
    <div className="px-3 pt-2 flex items-center gap-2 text-xs" data-testid="chat-image-preview">
      {pick.picked && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-1.5 pe-2 max-w-full">
          <img src={pick.picked.thumb} alt="" className="h-10 w-10 rounded-lg object-cover border border-amber-100" />
          <span className="truncate text-stone-700 max-w-[12rem]" dir="auto">{reading ? pick.words.reading : pick.picked.name}</span>
          <button type="button" onClick={pick.clear} title={pick.words.remove} aria-label={pick.words.remove} className="rounded-full p-1 text-stone-500 hover:bg-amber-100 hover:text-stone-800 cursor-pointer">
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
      {pick.error && <span className="text-red-700" role="alert">{pick.error}</span>}
    </div>
  );
}

/** Under his message: the thumbnail and, folded, the words read from it. */
export function ChatImageCard({ image, lang }: { image: ChatImage; lang: SupportedLanguage }) {
  const words = imageWords(lang);
  return (
    <div className="mb-2 space-y-1.5" data-testid="chat-image-card">
      <img src={image.thumb} alt={image.name || ''} className="max-h-32 rounded-lg border border-white/30 object-contain" />
      {image.text !== undefined && (
        <details className="text-[11px] leading-relaxed">
          <summary className="cursor-pointer select-none opacity-80 flex items-center gap-1"><ScanText className="w-3 h-3" aria-hidden="true" />{image.text ? words.readText : words.noText}</summary>
          {image.text && <pre dir="auto" className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap font-sans opacity-90">{image.text}</pre>}
          {image.description && <p dir="auto" className="mt-1 italic opacity-80">{image.description}</p>}
        </details>
      )}
    </div>
  );
}
