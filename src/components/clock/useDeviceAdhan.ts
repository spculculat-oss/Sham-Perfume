import { useEffect, useRef, useState } from 'react';
import type { AdhanVariant } from '../../data/adhanVoices';
import {
  InvalidAdhanRecording, deviceAdhanResetChannel, loadDeviceAdhan, removeDeviceAdhan, saveDeviceAdhan, selectDeviceAdhan,
  type SavedAdhan, type SavedAdhanFiles,
} from '../../utils/deviceAdhan';
import { PRAYER_CLEARED } from '../../utils/prayerConfig';

type Update = 'save' | 'select' | 'remove';
type FileIssue = 'invalidFile' | 'invalidAudio' | 'saveFailed' | 'selectionFailed' | 'removeFailed';
type FileFeedback = { pending: Update } | { issue: FileIssue } | { removed: true };
const failure: Record<Update, FileIssue> = { save: 'saveFailed', select: 'selectionFailed', remove: 'removeFailed' };

/** Load the sounds lazily with the prayer dialog, independently of location or opt-in. */
export function useDeviceAdhan() {
  const [files, setFiles] = useState<SavedAdhanFiles>({});
  const [loading, setLoading] = useState(true);
  const [readFailed, setReadFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [feedback, setFeedback] = useState<Partial<Record<AdhanVariant, FileFeedback>>>({});
  const lifecycle = useRef<AbortController>(null);
  const working = useRef(new Set<AdhanVariant>());

  useEffect(() => {
    const controller = new AbortController();
    lifecycle.current = controller;
    const cancel = () => controller.abort();
    void loadDeviceAdhan(controller.signal).then((saved) => {
      if (!controller.signal.aborted) setFiles(saved);
    }, () => {
      if (!controller.signal.aborted) setReadFailed(true);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    window.addEventListener(PRAYER_CLEARED, cancel);
    const channel = deviceAdhanResetChannel();
    if (channel) channel.onmessage = (event) => {
      if (event.data === 'clear') window.dispatchEvent(new Event(PRAYER_CLEARED));
    };
    return () => { cancel(); channel?.close(); window.removeEventListener(PRAYER_CLEARED, cancel); };
  }, []);

  const mutate = async (variant: AdhanVariant, update: Update, operation: (signal: AbortSignal) => Promise<SavedAdhan | undefined>,
    commit?: () => void): Promise<void> => {
    const signal = lifecycle.current?.signal;
    if (loading || !signal || signal.aborted || working.current.has(variant)) return;
    working.current.add(variant);
    setFeedback((old) => ({ ...old, [variant]: { pending: update } }));
    try {
      const saved = await operation(signal);
      if (signal.aborted) return;
      setFiles((old) => ({ ...old, [variant]: saved }));
      setRevision((previous) => previous + 1);
      commit?.();
      setFeedback((old) => ({ ...old, [variant]: update === 'remove' ? { removed: true } : undefined }));
    } catch (error) {
      const issue = error instanceof InvalidAdhanRecording ? (error.reason === 'file' ? 'invalidFile' : 'invalidAudio') : failure[update];
      if (!signal.aborted) setFeedback((old) => ({ ...old, [variant]: { issue } }));
    } finally { working.current.delete(variant); }
  };

  return {
    files, loading, readFailed, revision, feedback,
    cancel: () => lifecycle.current?.abort(),
    save: (variant: AdhanVariant, file: File) => mutate(variant, 'save', (signal) => saveDeviceAdhan(variant, file, signal)),
    remove: (variant: AdhanVariant) => mutate(variant, 'remove', (signal) => removeDeviceAdhan(variant, signal)),
    select: (variant: AdhanVariant, selected: boolean, commit?: () => void) => mutate(variant, 'select',
      (signal) => selectDeviceAdhan(variant, selected, signal), commit),
  };
}
