import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupportedLanguage } from '../types/i18n';
import { shaheenSpeechLocale, splitShaheenSpeech } from '../utils/shaheenVoice';

export interface ShaheenVoiceMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  kind?: string;
}

type VoiceError = 'unsupported' | 'permission' | 'microphone' | 'network' | 'recognition' | 'speech' | 'too_long';

interface RecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: { readonly transcript: string };
}

interface RecognitionEventLike {
  readonly resultIndex: number;
  readonly results: ArrayLike<RecognitionResultLike>;
}

interface RecognitionErrorLike {
  readonly error: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: RecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type RecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

interface PendingTurn {
  previousUserId?: string;
  previousAssistantId?: string;
}

export interface UseShaheenVoiceModeOptions {
  language: SupportedLanguage;
  messages: readonly ShaheenVoiceMessage[];
  isLoading: boolean;
  disabled?: boolean;
  onSend: (text: string) => Promise<boolean | void>;
}

function recognitionConstructor(): SpeechRecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  const speechWindow = window as RecognitionWindow;
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
}

function latestMessageId(messages: readonly ShaheenVoiceMessage[], role: ShaheenVoiceMessage['role']): string | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === role) return messages[index].id;
  }
  return undefined;
}

export function shaheenVoiceSupported(): boolean {
  return typeof window !== 'undefined'
    && Boolean(recognitionConstructor())
    && typeof window.speechSynthesis !== 'undefined'
    && typeof window.SpeechSynthesisUtterance !== 'undefined';
}

export function useShaheenVoiceMode({ language, messages, isLoading, disabled = false, onSend }: UseShaheenVoiceModeOptions) {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<VoiceError | null>(null);
  const [replyReady, setReplyReady] = useState(false);

  const activeRef = useRef(false);
  const listeningRef = useRef(false);
  const speakingRef = useRef(false);
  const waitingRef = useRef(false);
  const disabledRef = useRef(disabled);
  const loadingRef = useRef(isLoading);
  const languageRef = useRef(language);
  const messagesRef = useRef(messages);
  const onSendRef = useRef(onSend);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const pendingTurnRef = useRef<PendingTurn | null>(null);
  const listenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechSequenceRef = useRef(0);
  const startListeningRef = useRef<() => void>(() => undefined);

  // Browser APIs are checked after mount so this hook remains safe during server rendering.
  useEffect(() => {
    setSupported(shaheenVoiceSupported());
  }, []);
  useEffect(() => { disabledRef.current = disabled; }, [disabled]);
  useEffect(() => { loadingRef.current = isLoading; }, [isLoading]);
  useEffect(() => { languageRef.current = language; }, [language]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { onSendRef.current = onSend; }, [onSend]);

  const clearListenTimer = useCallback(() => {
    if (listenTimerRef.current !== null) {
      clearTimeout(listenTimerRef.current);
      listenTimerRef.current = null;
    }
  }, []);

  const cancelRecognition = useCallback(() => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    listeningRef.current = false;
    setListening(false);
    if (!recognition) return;
    recognition.onstart = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    try { recognition.abort(); } catch { /* It may already have ended. */ }
  }, []);

  const cancelSpeech = useCallback(() => {
    speechSequenceRef.current += 1;
    speakingRef.current = false;
    setSpeaking(false);
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch { /* A browser may not have a speech queue. */ }
    }
  }, []);

  const clearPendingTurn = useCallback(() => {
    pendingTurnRef.current = null;
    waitingRef.current = false;
    setWaiting(false);
    setReplyReady(false);
  }, []);

  const stop = useCallback(() => {
    const wasUsingVoice = activeRef.current || Boolean(recognitionRef.current) || speakingRef.current;
    activeRef.current = false;
    setActive(false);
    clearListenTimer();
    if (wasUsingVoice) {
      cancelRecognition();
      cancelSpeech();
    }
    clearPendingTurn();
    setInterim('');
    setError(null);
  }, [cancelRecognition, cancelSpeech, clearListenTimer, clearPendingTurn]);

  const fail = useCallback((reason: VoiceError) => {
    activeRef.current = false;
    setActive(false);
    clearListenTimer();
    cancelRecognition();
    cancelSpeech();
    clearPendingTurn();
    setInterim('');
    setError(reason);
  }, [cancelRecognition, cancelSpeech, clearListenTimer, clearPendingTurn]);

  const speakReply = useCallback((text: string, onComplete: () => void) => {
    if (typeof window === 'undefined' || !window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      setError('speech');
      onComplete();
      return;
    }
    const chunks = splitShaheenSpeech(text);
    if (!chunks.length) { onComplete(); return; }

    cancelSpeech();
    const sequence = speechSequenceRef.current;
    const locale = shaheenSpeechLocale(languageRef.current);
    const voice = window.speechSynthesis.getVoices().find((candidate) => candidate.lang.toLowerCase() === locale.toLowerCase())
      || window.speechSynthesis.getVoices().find((candidate) => candidate.lang.toLowerCase().startsWith(`${languageRef.current}-`));
    let index = 0;
    let finished = false;
    speakingRef.current = true;
    setSpeaking(true);

    const finish = (failed = false) => {
      if (finished || sequence !== speechSequenceRef.current) return;
      finished = true;
      speakingRef.current = false;
      setSpeaking(false);
      if (failed) setError('speech');
      onComplete();
    };
    const speakNext = () => {
      if (sequence !== speechSequenceRef.current || !activeRef.current) { finish(); return; }
      if (index >= chunks.length) { finish(); return; }
      try {
        const utterance = new window.SpeechSynthesisUtterance(chunks[index]);
        utterance.lang = locale;
        utterance.rate = 0.96;
        if (voice) utterance.voice = voice;
        utterance.onend = () => { index += 1; speakNext(); };
        utterance.onerror = () => finish(true);
        window.speechSynthesis.speak(utterance);
      } catch {
        finish(true);
      }
    };
    speakNext();
  }, [cancelSpeech]);

  const scheduleListening = useCallback((delay = 250) => {
    clearListenTimer();
    if (!activeRef.current || disabledRef.current || loadingRef.current || waitingRef.current || speakingRef.current) return;
    listenTimerRef.current = setTimeout(() => {
      listenTimerRef.current = null;
      startListeningRef.current();
    }, delay);
  }, [clearListenTimer]);

  const beginOutgoingTurn = useCallback(() => {
    if (!activeRef.current) return false;
    clearListenTimer();
    cancelRecognition();
    cancelSpeech();
    pendingTurnRef.current = {
      previousUserId: latestMessageId(messagesRef.current, 'user'),
      previousAssistantId: latestMessageId(messagesRef.current, 'assistant'),
    };
    waitingRef.current = true;
    setWaiting(true);
    setReplyReady(false);
    setInterim('');
    return true;
  }, [cancelRecognition, cancelSpeech, clearListenTimer]);

  const finishOutgoingTurn = useCallback((sent: boolean) => {
    if (!waitingRef.current) return;
    if (!sent) {
      clearPendingTurn();
      scheduleListening();
      return;
    }
    setReplyReady(true);
  }, [clearPendingTurn, scheduleListening]);

  const sendRecognizedText = useCallback(async (rawText: string) => {
    const text = rawText.replace(/\s+/g, ' ').trim();
    if (!text || !activeRef.current) {
      scheduleListening();
      return;
    }
    if (text.length > 4000) {
      setError('too_long');
      scheduleListening();
      return;
    }
    const started = beginOutgoingTurn();
    if (!started) return;
    try {
      const accepted = await onSendRef.current(text);
      finishOutgoingTurn(accepted !== false);
    } catch {
      finishOutgoingTurn(false);
    }
  }, [beginOutgoingTurn, finishOutgoingTurn, scheduleListening]);

  const startListening = useCallback(() => {
    if (!activeRef.current || disabledRef.current || loadingRef.current || waitingRef.current || speakingRef.current || recognitionRef.current) return;
    const Recognition = recognitionConstructor();
    if (!Recognition) { fail('unsupported'); return; }

    let finalText = '';
    let interimText = '';
    let recognition: SpeechRecognitionLike;
    try {
      recognition = new Recognition();
    } catch {
      fail('recognition');
      return;
    }
    recognition.lang = shaheenSpeechLocale(languageRef.current);
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      listeningRef.current = true;
      setListening(true);
    };
    recognition.onresult = (event) => {
      setError(null);
      finalText = '';
      interimText = '';
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript || '';
        if (result?.isFinal) finalText += ` ${transcript}`;
        else interimText += ` ${transcript}`;
      }
      setInterim((finalText || interimText).replace(/\s+/g, ' ').trim());
    };
    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') fail('permission');
      else if (event.error === 'audio-capture') fail('microphone');
      else if (event.error === 'network') fail('network');
      else fail('recognition');
    };
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      recognitionRef.current = null;
      listeningRef.current = false;
      setListening(false);
      if (!activeRef.current) return;
      const heard = (finalText || interimText).replace(/\s+/g, ' ').trim();
      setInterim(heard);
      if (heard) void sendRecognizedText(heard);
      else scheduleListening(350);
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      // Set optimistically; onstart will confirm, while an immediate exception is handled below.
      listeningRef.current = true;
      setListening(true);
    } catch {
      recognitionRef.current = null;
      listeningRef.current = false;
      setListening(false);
      fail('microphone');
    }
  }, [fail, scheduleListening, sendRecognizedText]);

  useEffect(() => { startListeningRef.current = startListening; }, [startListening]);

  const start = useCallback(() => {
    if (disabledRef.current) return false;
    if (!shaheenVoiceSupported()) {
      setError('unsupported');
      return false;
    }
    clearListenTimer();
    clearPendingTurn();
    cancelSpeech();
    setError(null);
    activeRef.current = true;
    setActive(true);
    setInterim('');
    // This runs from the user's confirmation click, which is required by browser microphone permission.
    startListeningRef.current();
    return true;
  }, [cancelSpeech, clearListenTimer, clearPendingTurn]);

  useEffect(() => {
    if (disabled && activeRef.current) stop();
  }, [disabled, stop]);

  useEffect(() => {
    if (!isLoading || !activeRef.current || waitingRef.current || !listeningRef.current) return;
    // A manually submitted text message should not leave microphone recognition running underneath it.
    cancelRecognition();
  }, [cancelRecognition, isLoading]);

  useEffect(() => {
    if (!active || !waiting || !replyReady || isLoading) return;
    const pending = pendingTurnRef.current;
    if (!pending) return;
    const latestUserIndex = (() => {
      for (let index = messages.length - 1; index >= 0; index -= 1) if (messages[index].role === 'user') return index;
      return -1;
    })();
    const latestAssistantIndex = (() => {
      for (let index = messages.length - 1; index >= 0; index -= 1) if (messages[index].role === 'assistant') return index;
      return -1;
    })();
    if (latestUserIndex < 0 || messages[latestUserIndex].id === pending.previousUserId) {
      clearPendingTurn();
      scheduleListening();
      return;
    }
    if (latestAssistantIndex <= latestUserIndex) return;
    const response = messages[latestAssistantIndex];
    if (!response || response.id === pending.previousAssistantId) return;

    pendingTurnRef.current = null;
    waitingRef.current = false;
    setWaiting(false);
    setReplyReady(false);
    setInterim('');
    speakReply(response.text, () => scheduleListening(350));
  }, [active, clearPendingTurn, isLoading, messages, replyReady, scheduleListening, speakReply, waiting]);

  useEffect(() => () => {
    activeRef.current = false;
    clearListenTimer();
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try { recognition.abort(); } catch { /* The recognition session already ended. */ }
    }
    speechSequenceRef.current += 1;
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch { /* The browser has no active speech queue. */ }
    }
  }, [clearListenTimer]);

  return {
    supported,
    active,
    listening,
    speaking,
    waiting,
    interim,
    error,
    start,
    stop,
    beginOutgoingTurn,
    finishOutgoingTurn,
  };
}
