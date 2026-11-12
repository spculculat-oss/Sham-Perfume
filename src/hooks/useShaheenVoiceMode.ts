import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SupportedLanguage } from '../types/i18n';
import { bargeIn, mergeHeard, pickShaheenVoice, shaheenSpeechLocale, splitShaheenSpeech } from '../utils/shaheenVoice';
import { dialectLocale, resolveDialect, saveDialectChoice, savedDialectChoice, type Dialect, type DialectChoice } from '../utils/arabicDialect';
import { currentStoreCountry } from '../utils/storeCheckout';

export interface ShaheenVoiceMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  kind?: string;
}

/** What a spoken turn tells the server: what Shaheen had said when the visitor cut in (if he did). */
export interface ShaheenVoiceTurn {
  interrupted?: string;
}

const BARGE_KEY = 'sham_voice_barge_v1';
/**
 * On by default, except on iPhone/iPad: there the microphone takes over the audio session and turns Shaheen's own
 * voice down, so the visitor turns it on himself if he wants it (the tap on the orb always interrupts).
 */
function savedBargeIn(): boolean {
  if (typeof window === 'undefined') return true;
  const apple = /iPhone|iPad|iPod/i.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  try {
    const saved = window.localStorage.getItem(BARGE_KEY);
    return saved ? saved !== 'off' : !apple;
  } catch { return !apple; }
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
  onspeechstart?: (() => void) | null;
  onspeechend?: (() => void) | null;
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
  onSend: (text: string, turn?: ShaheenVoiceTurn) => Promise<boolean | void>;
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
  // The full-screen voice stage: a muted microphone keeps the conversation open without listening; `hearing`
  // is true while the engine detects speech; `spokenText` is the sentence being read aloud now and
  // `speechBeat` ticks on every spoken word so the stage can move with Shaheen's voice.
  const [muted, setMuted] = useState(false);
  const [hearing, setHearing] = useState(false);
  const [spokenText, setSpokenText] = useState('');
  const [speechBeat, setSpeechBeat] = useState(0);
  const [lastHeard, setLastHeard] = useState('');
  // «المقاطعة بالصوت» (on unless the visitor turned it off) and «لهجات شاهين» (his pick, or 'auto').
  const [bargeEnabled, setBargeEnabledState] = useState(true);
  const [dialectChoice, setDialectChoiceState] = useState<DialectChoice>('auto');
  const [bargedIn, setBargedIn] = useState(0);

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
  const mutedRef = useRef(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const localeRef = useRef(shaheenSpeechLocale(language));
  const bargeEnabledRef = useRef(true);
  const bargeRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const bargeRestartsRef = useRef(0);
  const bargePrefixRef = useRef('');
  const interruptedRef = useRef('');
  const replyTextRef = useRef('');
  const spokenSoFarRef = useRef('');

  // Browser APIs are checked after mount so this hook remains safe during server rendering.
  useEffect(() => {
    setSupported(shaheenVoiceSupported());
    const barge = savedBargeIn();
    bargeEnabledRef.current = barge;
    setBargeEnabledState(barge);
    setDialectChoiceState(savedDialectChoice());
  }, []);
  // The dialect this conversation is in: his pick → his own words → his Arab country → Egyptian.
  const dialect: Dialect | undefined = useMemo(() => {
    if (language !== 'ar') return undefined;
    const said = messages.filter((message) => message.role === 'user').slice(-4).reverse().map((message) => message.text);
    return resolveDialect({ choice: dialectChoice, texts: said, country: currentStoreCountry() });
  }, [dialectChoice, language, messages]);
  useEffect(() => {
    localeRef.current = dialect ? dialectLocale(dialect, currentStoreCountry()) : shaheenSpeechLocale(language);
  }, [dialect, language]);
  // Engines load their voice list late (Chrome fills it after the first `voiceschanged`), so keep it fresh.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return undefined;
    const synth = window.speechSynthesis;
    const load = () => { try { voicesRef.current = synth.getVoices(); } catch { voicesRef.current = []; } };
    load();
    try { synth.addEventListener('voiceschanged', load); } catch { return undefined; }
    return () => { try { synth.removeEventListener('voiceschanged', load); } catch { /* Already gone. */ } };
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
    setHearing(false);
    if (!recognition) return;
    recognition.onstart = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    try { recognition.abort(); } catch { /* It may already have ended. */ }
  }, []);

  /** Stop the microphone that listens for an interruption while Shaheen speaks. */
  const stopBargeWatch = useCallback(() => {
    const watch = bargeRecognitionRef.current;
    bargeRecognitionRef.current = null;
    if (!watch) return;
    watch.onstart = null;
    watch.onresult = null;
    watch.onerror = null;
    watch.onend = null;
    try { watch.abort(); } catch { /* Already ended. */ }
  }, []);

  const cancelSpeech = useCallback(() => {
    stopBargeWatch();
    speechSequenceRef.current += 1;
    speakingRef.current = false;
    setSpeaking(false);
    setSpokenText('');
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch { /* A browser may not have a speech queue. */ }
    }
  }, [stopBargeWatch]);

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
    setLastHeard('');
    mutedRef.current = false;
    setMuted(false);
    bargePrefixRef.current = '';
    interruptedRef.current = '';
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

  /**
   * «المقاطعة بالصوت»: while Shaheen speaks, a second listener runs. Hearing only Shaheen's own words (through
   * the speakers) changes nothing; hearing the visitor stops Shaheen at once and hands the turn to him, keeping
   * the words he already said and what Shaheen had said up to that moment (the server is told he was cut off).
   */
  const startBargeWatch = useCallback(() => {
    if (!activeRef.current || !speakingRef.current || mutedRef.current || !bargeEnabledRef.current || bargeRecognitionRef.current) return;
    const Recognition = recognitionConstructor();
    if (!Recognition) return;
    let watch: SpeechRecognitionLike;
    try { watch = new Recognition(); } catch { return; }
    const sequence = speechSequenceRef.current;
    watch.lang = localeRef.current;
    watch.continuous = true;
    watch.interimResults = true;
    watch.maxAlternatives = 1;
    watch.onresult = (event) => {
      if (bargeRecognitionRef.current !== watch || sequence !== speechSequenceRef.current) return;
      let heard = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) heard += ` ${event.results[index]?.[0]?.transcript || ''}`;
      const check = bargeIn(heard, replyTextRef.current);
      if (!check.barge) return;
      interruptedRef.current = spokenSoFarRef.current;
      bargePrefixRef.current = check.said;
      setInterim(check.said);
      setBargedIn((count) => count + 1);
      cancelSpeech();
      // Straight into his turn (the microphone permission is already granted for this page); the short pause lets
      // the engine release the interruption listener first.
      setTimeout(() => startListeningRef.current(), 120);
    };
    watch.onerror = (event) => {
      // A refused microphone ends the watching for this conversation; the tap on the orb still interrupts.
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') bargeRestartsRef.current = Number.POSITIVE_INFINITY;
    };
    watch.onend = () => {
      if (bargeRecognitionRef.current !== watch) return;
      bargeRecognitionRef.current = null;
      // Engines stop after a pause; keep watching while he is still speaking (with a limit per reply).
      if (speakingRef.current && activeRef.current && sequence === speechSequenceRef.current && bargeRestartsRef.current < 12) {
        bargeRestartsRef.current += 1;
        setTimeout(() => { if (sequence === speechSequenceRef.current) startBargeWatchRef.current(); }, 150);
      }
    };
    bargeRecognitionRef.current = watch;
    try { watch.start(); } catch { bargeRecognitionRef.current = null; }
  }, [cancelSpeech]);
  const startBargeWatchRef = useRef<() => void>(() => undefined);
  useEffect(() => { startBargeWatchRef.current = startBargeWatch; }, [startBargeWatch]);

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
    const locale = localeRef.current;
    replyTextRef.current = text;
    spokenSoFarRef.current = '';
    bargeRestartsRef.current = 0;
    let voices = voicesRef.current;
    if (!voices.length) { try { voices = window.speechSynthesis.getVoices(); } catch { voices = []; } }
    const voice = pickShaheenVoice(voices, locale, languageRef.current);
    let index = 0;
    let finished = false;
    speakingRef.current = true;
    setSpeaking(true);

    const finish = (failed = false) => {
      if (finished || sequence !== speechSequenceRef.current) return;
      finished = true;
      stopBargeWatch();
      speakingRef.current = false;
      setSpeaking(false);
      setSpokenText('');
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
        utterance.onstart = () => {
          if (sequence !== speechSequenceRef.current) return;
          setSpokenText(chunks[index] || '');
          spokenSoFarRef.current = chunks.slice(0, index + 1).join(' ');
        };
        utterance.onboundary = (event) => {
          if (sequence !== speechSequenceRef.current) return;
          setSpeechBeat((beat) => (beat + 1) % 1_000_000);
          // Where he is in the sentence, so an interruption tells the server exactly what he had said.
          const at = typeof event?.charIndex === 'number' ? event.charIndex : -1;
          if (at > 0) spokenSoFarRef.current = [...chunks.slice(0, index), (chunks[index] || '').slice(0, at)].join(' ').trim();
        };
        utterance.onend = () => { index += 1; speakNext(); };
        utterance.onerror = () => finish(true);
        window.speechSynthesis.speak(utterance);
      } catch {
        finish(true);
      }
    };
    speakNext();
    // Give the engine a moment to start talking before the interruption listener opens.
    setTimeout(() => { if (sequence === speechSequenceRef.current) startBargeWatchRef.current(); }, 400);
  }, [cancelSpeech, stopBargeWatch]);

  const scheduleListening = useCallback((delay = 250) => {
    clearListenTimer();
    if (!activeRef.current || mutedRef.current || disabledRef.current || loadingRef.current || waitingRef.current || speakingRef.current) return;
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
    setLastHeard(text);
    const turn: ShaheenVoiceTurn = interruptedRef.current ? { interrupted: interruptedRef.current } : {};
    interruptedRef.current = '';
    try {
      const accepted = await onSendRef.current(text, turn);
      finishOutgoingTurn(accepted !== false);
    } catch {
      finishOutgoingTurn(false);
    }
  }, [beginOutgoingTurn, finishOutgoingTurn, scheduleListening]);

  const startListening = useCallback(() => {
    if (!activeRef.current || mutedRef.current || disabledRef.current || loadingRef.current || waitingRef.current || speakingRef.current || recognitionRef.current) return;
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
    recognition.lang = localeRef.current;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      listeningRef.current = true;
      setListening(true);
    };
    recognition.onspeechstart = () => setHearing(true);
    recognition.onspeechend = () => setHearing(false);
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
      setInterim(mergeHeard(bargePrefixRef.current, (finalText || interimText).replace(/\s+/g, ' ').trim()));
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
      setHearing(false);
      if (!activeRef.current) return;
      // After a spoken interruption, his first words were heard by the interruption listener.
      const heard = mergeHeard(bargePrefixRef.current, (finalText || interimText).replace(/\s+/g, ' ').trim());
      bargePrefixRef.current = '';
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
    mutedRef.current = false;
    setMuted(false);
    setInterim('');
    setLastHeard('');
    // This runs from the user's confirmation click, which is required by browser microphone permission.
    startListeningRef.current();
    return true;
  }, [cancelSpeech, clearListenTimer, clearPendingTurn]);

  /** Mute or unmute the microphone without ending the conversation (a reply being read keeps playing). */
  const toggleMute = useCallback(() => {
    if (!activeRef.current) return;
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    if (next) {
      clearListenTimer();
      cancelRecognition();
      stopBargeWatch();
      setInterim('');
    } else {
      setError(null);
      // Called from the visitor's tap, so the engine may open the microphone straight away.
      startListeningRef.current();
    }
  }, [cancelRecognition, clearListenTimer, stopBargeWatch]);

  /** Cut Shaheen off mid-reply and listen at once (tap on the orb). */
  const interrupt = useCallback(() => {
    if (!activeRef.current || !speakingRef.current) return;
    interruptedRef.current = spokenSoFarRef.current;
    cancelSpeech();
    if (mutedRef.current) {
      mutedRef.current = false;
      setMuted(false);
    }
    setTimeout(() => startListeningRef.current(), 120);
  }, [cancelSpeech]);

  /** Turn «المقاطعة بالصوت» on or off (kept in this browser). */
  const setBargeEnabled = useCallback((on: boolean) => {
    bargeEnabledRef.current = on;
    setBargeEnabledState(on);
    try { window.localStorage.setItem(BARGE_KEY, on ? 'on' : 'off'); } catch { /* Private mode. */ }
    if (!on) stopBargeWatch();
    else startBargeWatchRef.current();
  }, [stopBargeWatch]);

  /** His own dialect pick ('auto' = from his words and country), kept in this browser for chat and voice. */
  const setDialectChoice = useCallback((choice: DialectChoice) => {
    saveDialectChoice(choice);
    setDialectChoiceState(choice);
  }, []);

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
    stopBargeWatch();
    speechSequenceRef.current += 1;
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch { /* The browser has no active speech queue. */ }
    }
  }, [clearListenTimer, stopBargeWatch]);

  return {
    supported,
    active,
    listening,
    speaking,
    waiting,
    interim,
    error,
    muted,
    hearing,
    spokenText,
    speechBeat,
    lastHeard,
    bargeEnabled,
    bargedIn,
    dialect,
    dialectChoice,
    setBargeEnabled,
    setDialectChoice,
    start,
    stop,
    toggleMute,
    interrupt,
    beginOutgoingTurn,
    finishOutgoingTurn,
  };
}
