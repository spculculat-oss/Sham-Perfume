import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupportedLanguage } from '../types/i18n';
import type { Dialect } from '../utils/arabicDialect';
import { readAloud } from '../utils/readAloud';

/** Own the reader's cancellation handle for both native and local audio, including unmounts. */
export function useReadAloud({ language, dialect, onNoVoice }: {
  language: SupportedLanguage; dialect?: Dialect; onNoVoice?: () => void;
}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const cancelRef = useRef<(() => void) | undefined>(undefined);
  const sequence = useRef(0);
  const cancel = useCallback(() => {
    sequence.current += 1;
    const previous = cancelRef.current;
    cancelRef.current = undefined;
    previous?.();
  }, []);
  const stop = useCallback(() => { cancel(); setIsSpeaking(false); }, [cancel]);
  useEffect(() => cancel, [cancel]);
  useEffect(() => { stop(); }, [language, dialect, stop]);
  const toggle = useCallback((text: string) => {
    if (cancelRef.current) { stop(); return; }
    const token = ++sequence.current;
    let completed = false;
    setIsSpeaking(true);
    const handle = readAloud(text, { language, dialect, onNoVoice, onEnd: () => {
      completed = true;
      if (sequence.current !== token) return;
      cancelRef.current = undefined;
      setIsSpeaking(false);
    } });
    // Unsupported/empty replies may finish synchronously before readAloud returns.
    if (!completed && sequence.current === token) cancelRef.current = handle;
  }, [language, dialect, onNoVoice, stop]);
  return { isSpeaking, toggle, stop };
}
