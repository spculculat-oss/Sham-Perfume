import { localVoiceOptions, resolveLocalVoice } from '../utils/localVoiceCatalog';
import { playLocalVoice, unlockLocalAudio } from '../utils/localVoicePlayer';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SupportedLanguage } from '../types/i18n';
import { bargeIn, deviceLacksVoice, mergeHeard, speechLocaleFor, speechWindow, talkChunks } from '../utils/shaheenVoice';
import { chosenVoice, saveVoiceChoice, savedVoiceChoice, voiceOptions, type VoiceChoice } from '../utils/voiceChoice';
import { tunedVoice, type VoiceMood } from '../utils/voiceMood';
import { resolveDialect, saveDialectChoice, savedDialectChoice, type Dialect, type DialectChoice } from '../utils/arabicDialect';
import { currentStoreCountry } from '../utils/storeCheckout';
import { learnablePair, planVoiceTurn, readingsFrom, type PendingConfirm } from '../utils/heardFix';
import { spokenReply, wantsMore } from '../utils/spokenReply';
import { addressee, askDoneLine, finishedAnswer, joinTurn, learnBarge, patienceLine, restOfReply, saveBargeMemory, savedBargeMemory, settleUnsure, turnState, type BargeMemory } from '../utils/turnTaking';
import { baseLexicon, buildLexicon, type Lexicon } from '../utils/shaheenSpelling';
import { isStaticHosting, requestApi } from '../utils/api';
import { activeVoicePrint, bargeDecision, deleteVoicePrint, earSupported, openEar, otherVoice, savedVoicePrint, saveVoicePrint,
  setVoicePrintOn, voicePrintOn, VoiceGate, type Ear, type EarSlice } from '../utils/voiceEar';
import { adaptPrint, ENROL_SENTENCES, enrolPrint, samePerson, summarize, type VoiceFrame, type VoicePrint } from '../utils/voicePrint';

export interface ShaheenVoiceMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  kind?: string;
}

/** What a spoken turn tells the server: what Shaheen had said when the visitor cut in (if he did). */
export interface ShaheenVoiceTurn {
  interrupted?: string;
  /** «شاهين يصحح اللي اتسمع غلط»: words heard as others and read as the word meant (`confirmed` = he said yes). */
  heard?: { from: string; to: string; confirmed?: boolean }[];
}

const HEARD_KEY = 'sham_heard_fixes_v1';
/** The words this visitor confirmed («قصدك «عود»؟» → «أيوه»): heard word → meant word, kept in this browser. */
function savedHeardFixes(): Record<string, string> {
  try {
    const data: unknown = JSON.parse(window.localStorage.getItem(HEARD_KEY) || '{}');
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    return Object.fromEntries(Object.entries(data as Record<string, unknown>).filter((pair): pair is [string, string] => typeof pair[1] === 'string').slice(-200));
  } catch { return {}; }
}
function saveHeardFix(from: string, to: string) {
  const pair = learnablePair(from, to);
  if (!pair) return;
  try { window.localStorage.setItem(HEARD_KEY, JSON.stringify({ ...savedHeardFixes(), [pair.from]: pair.to })); } catch { /* Private mode. */ }
}

/**
 * The words he compares what he heard with: the perfume dictionary + the store's product names and notes, and the
 * corrections visitors confirmed (shared by the server once several people confirmed the same one). Loaded once,
 * in the background, when the voice conversation starts; until then the built-in words are used.
 */
let voiceWords: Promise<{ lexicon: Lexicon; shared: Record<string, string> }> | undefined;
function loadVoiceWords() {
  voiceWords ??= Promise.all([
    import('../utils/liveStore').then((store) => store.storeProducts()).then((products) => products.flatMap((product) => [
      product.nameAr || '', product.nameEn || '', product.brand || '',
      ...(product.notes ? [...(product.notes.top || []), ...(product.notes.heart || []), ...(product.notes.base || [])] : []),
    ]).filter(Boolean)).catch(() => [] as string[]),
    isStaticHosting ? Promise.resolve({}) : requestApi<{ fixes?: Record<string, string> }>('/api/heard-fixes', undefined, 8000).then((data) => data?.fixes || {}).catch(() => ({})),
  ]).then(([names, shared]) => ({ lexicon: names.length ? buildLexicon({ extra: names }) : baseLexicon(), shared: shared as Record<string, string> }));
  voiceWords.catch(() => { voiceWords = undefined; });
  return voiceWords;
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

/** Android's engine cannot pause and resume speech (it stops instead), so Shaheen is only stopped there. */

/** «بصمتي»: the three sentences read to make it — where it is in them, and whether one is being recorded. */
export interface VoiceEnrolment { step: number; recording: boolean; done?: boolean; error?: 'short' | 'microphone' }

type VoiceError = 'unsupported' | 'permission' | 'microphone' | 'network' | 'recognition' | 'speech' | 'too_long';

interface RecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: { readonly transcript: string; readonly confidence?: number };
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
  /** «قصدك «عود»؟»: what he heard and the question he asked about it, shown in the chat (nothing is sent yet). */
  onAsk?: (heard: string, question: string) => void;
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
    && ((typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined') || typeof AudioContext !== 'undefined');
}

export function useShaheenVoiceMode({ language, messages, isLoading, disabled = false, onSend, onAsk }: UseShaheenVoiceModeOptions) {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<VoiceError | null>(null);
  /** The device has no voice for the conversation's language (the replies stay written). */
  const [noVoice, setNoVoice] = useState(false);
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
  const nativeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const nativeSpeechTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const localStopRef = useRef<(() => void) | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const localeRef = useRef(speechLocaleFor(language, currentStoreCountry()));
  const bargeEnabledRef = useRef(true);
  const bargeRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const bargeRestartsRef = useRef(0);
  const bargePrefixRef = useRef('');
  const interruptedRef = useRef('');
  const replyTextRef = useRef('');
  const spokenSoFarRef = useRef('');
  const onAskRef = useRef(onAsk);
  // «شاهين يصحح اللي اتسمع غلط»: the engine's other readings of the last sentence, the question he is waiting on,
  // the words he compares with, and the dialect for his short lines.
  const alternativesRef = useRef<string[]>([]);
  const confirmRef = useRef<PendingConfirm | null>(null);
  const lexiconRef = useRef<Lexicon | undefined>(undefined);
  const sharedFixesRef = useRef<Record<string, string>>({});
  const dialectRef = useRef<Dialect | undefined>(undefined);
  // «تحب أكمّلك الباقي؟»: what he has not said yet of a long reply (already in spoken form).
  const restRef = useRef('');
  // «ودن شاهين»: the microphone's loudness read directly (computers only), so he goes quiet the moment the visitor
  // starts talking; `duckRef` = when he paused for a sound that is not decided yet. «بصمتي»: the visitor's voice print.
  const [earActive, setEarActive] = useState(false);
  const [ignoredVoices, setIgnoredVoices] = useState(0);
  const [printSaved, setPrintSaved] = useState(false);
  const [printOn, setPrintOnState] = useState(true);
  const [enrolment, setEnrolment] = useState<VoiceEnrolment | null>(null);
  const earRef = useRef<Ear | null>(null);
  const earOpeningRef = useRef(false);
  const gateRef = useRef(new VoiceGate());
  const duckRef = useRef<{ at: number } | null>(null);
  const printRef = useRef<VoicePrint | undefined>(undefined);
  const voicedRef = useRef<VoiceFrame[]>([]);
  const otherVoiceRef = useRef(false);
  const watchHeardRef = useRef('');
  const speakStartRef = useRef(0);
  const enrollingRef = useRef(false);
  const takesRef = useRef<VoiceFrame[][]>([]);
  const takeRef = useRef<{ frames: VoiceFrame[]; done: () => void } | null>(null);
  const sliceRef = useRef<(slice: EarSlice) => void>(() => undefined);
  // «صوت شاهين»: the voice the visitor chose (by name per language, or a gender), how high and how fast.
  const [voiceChoice, setVoiceChoiceState] = useState<VoiceChoice>(() => savedVoiceChoice());
  const voiceChoiceRef = useRef<VoiceChoice>(voiceChoice);
  const [voiceList, setVoiceList] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceMood, setVoiceMood] = useState<VoiceMood>('neutral');
  // «ترتيب الحوار»: the pieces of the visitor's turn so far, whether Shaheen asked «خلصت ولا لسه؟», whether he is
  // listening for the rest of a sentence, and the timer that decides a silence.
  const turnPartsRef = useRef<string[]>([]);
  const askedDoneRef = useRef(false);
  const waitingMoreRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechHeardRef = useRef(false);
  const patienceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // «القطع المناسب»: someone talking while Shaheen talks is judged after about a second; what he learned about this
  // visitor's interruptions; the last «said to someone else» decision and the last cut (to learn from mistakes and to
  // go on with the answer after a stop for nothing); and where he is in the reply.
  const bargeMemoryRef = useRef<BargeMemory>({ bias: 0, words: {} });
  const candidateRef = useRef<{ since: number; said: string; timer: ReturnType<typeof setTimeout> | null } | null>(null);
  const asideRef = useRef<{ said: string; at: number } | null>(null);
  const cutRef = useRef<{ said: string; rest: string; at: number } | null>(null);
  const speechPosRef = useRef<{ chunks: string[]; index: number; at: number } | null>(null);

  // Browser APIs are checked after mount so this hook remains safe during server rendering.
  useEffect(() => {
    setSupported(shaheenVoiceSupported());
    const barge = savedBargeIn();
    bargeEnabledRef.current = barge;
    setBargeEnabledState(barge);
    setDialectChoiceState(savedDialectChoice());
    setPrintSaved(Boolean(savedVoicePrint()));
    setPrintOnState(voicePrintOn());
    bargeMemoryRef.current = savedBargeMemory();
  }, []);
  // The dialect this conversation is in: his pick → his own words → his Arab country → Egyptian.
  const dialect: Dialect | undefined = useMemo(() => {
    if (language !== 'ar') return undefined;
    const said = messages.filter((message) => message.role === 'user').slice(-4).reverse().map((message) => message.text);
    return resolveDialect({ choice: dialectChoice, texts: said, country: currentStoreCountry() });
  }, [dialectChoice, language, messages]);
  useEffect(() => { dialectRef.current = dialect; }, [dialect]);
  useEffect(() => {
    // «بلغة بلده ولهجتها»: Arabic in his dialect's accent, any other language in his country's accent (fr-CA, es-MX …).
    localeRef.current = speechLocaleFor(language, currentStoreCountry(), dialect);
  }, [dialect, language]);
  useEffect(() => { setNoVoice(false); }, [language]);
  // Engines load their voice list late (Chrome fills it after the first `voiceschanged`), so keep it fresh.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return undefined;
    const synth = window.speechSynthesis;
    const load = () => { try { voicesRef.current = synth.getVoices(); } catch { voicesRef.current = []; } setVoiceList(voicesRef.current); };
    load();
    try { synth.addEventListener('voiceschanged', load); } catch { return undefined; }
    return () => { try { synth.removeEventListener('voiceschanged', load); } catch { /* Already gone. */ } };
  }, []);
  useEffect(() => { disabledRef.current = disabled; }, [disabled]);
  useEffect(() => { loadingRef.current = isLoading; }, [isLoading]);
  useEffect(() => { languageRef.current = language; }, [language]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { onSendRef.current = onSend; }, [onSend]);
  useEffect(() => { onAskRef.current = onAsk; }, [onAsk]);

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

  const dropCandidate = useCallback(() => {
    const candidate = candidateRef.current;
    if (candidate?.timer) clearTimeout(candidate.timer);
    candidateRef.current = null;
  }, []);
  const clearPatience = useCallback(() => {
    if (patienceTimerRef.current !== null) { clearTimeout(patienceTimerRef.current); patienceTimerRef.current = null; }
  }, []);
  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current !== null) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
  }, []);
  /** «يتدرب على القطع»: one mistake learned (kept on this device). */
  const learnCut = useCallback((said: string, mistake: 'missed' | 'false') => {
    if (!said.trim()) return;
    bargeMemoryRef.current = learnBarge(bargeMemoryRef.current, said, mistake);
    saveBargeMemory(bargeMemoryRef.current);
  }, []);

  const cancelSpeech = useCallback(() => {
    clearTimeout(nativeSpeechTimerRef.current);
    nativeUtteranceRef.current = null;
    localStopRef.current?.(); localStopRef.current = null;
    stopBargeWatch();
    dropCandidate();
    clearPatience();
    speechSequenceRef.current += 1;
    speakingRef.current = false;
    setSpeaking(false);
    setSpokenText('');
    const wasPaused = Boolean(duckRef.current);
    duckRef.current = null;
    otherVoiceRef.current = false;
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch { /* A browser may not have a speech queue. */ }
      // A paused engine stays paused for the next reply too (Chrome) unless it is resumed.
      if (wasPaused) { try { window.speechSynthesis.resume(); } catch { /* Nothing to resume. */ } }
    }
  }, [clearPatience, dropCandidate, stopBargeWatch]);

  /** Close the microphone the ear listens with. */
  const closeEar = useCallback(() => {
    earRef.current?.close();
    earRef.current = null;
    duckRef.current = null;
    setEarActive(false);
  }, []);
  /** Open it (computers only; from the visitor's tap that started the conversation). */
  const openVoiceEar = useCallback(() => {
    if (earRef.current || earOpeningRef.current || !earSupported()) return;
    earOpeningRef.current = true;
    gateRef.current = new VoiceGate();
    void openEar((slice) => sliceRef.current(slice), () => gateRef.current.floor * 1.5).then((ear) => {
      earOpeningRef.current = false;
      if (!ear) return;
      if (!activeRef.current) { ear.close(); return; }
      earRef.current = ear;
      setEarActive(true);
    });
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
    setLastHeard('');
    mutedRef.current = false;
    setMuted(false);
    bargePrefixRef.current = '';
    interruptedRef.current = '';
    confirmRef.current = null;
    restRef.current = '';
    turnPartsRef.current = [];
    askedDoneRef.current = false;
    waitingMoreRef.current = false;
    clearSilenceTimer();
    asideRef.current = null;
    cutRef.current = null;
    enrollingRef.current = false;
    takeRef.current = null;
    setEnrolment(null);
    closeEar();
    setError(null);
  }, [cancelRecognition, cancelSpeech, clearListenTimer, clearPendingTurn, clearSilenceTimer, closeEar]);

  const fail = useCallback((reason: VoiceError) => {
    activeRef.current = false;
    setActive(false);
    clearListenTimer();
    cancelRecognition();
    cancelSpeech();
    clearPendingTurn();
    setInterim('');
    enrollingRef.current = false;
    setEnrolment(null);
    closeEar();
    setError(reason);
  }, [cancelRecognition, cancelSpeech, clearListenTimer, clearPendingTurn, closeEar]);

  /**
   * «القطع المناسب»: the visitor is talking to Shaheen — he stops, keeps what was heard and what he had said (the
   * server is told he was cut off) and listens. What was left of the answer is kept, in case it was a stop for nothing.
   */
  const cutIn = useCallback((said: string) => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const pos = speechPosRef.current;
    // He had decided «not to me» a moment ago and the visitor is still at him: that was a miss — learned.
    const aside = asideRef.current;
    if (aside && now - aside.at < 6000) learnCut(aside.said, 'missed');
    asideRef.current = null;
    cutRef.current = { said, rest: pos ? restOfReply(pos.chunks, pos.index, pos.at) : '', at: now };
    interruptedRef.current = spokenSoFarRef.current;
    bargePrefixRef.current = said;
    setInterim(said);
    setBargedIn((count) => count + 1);
    cancelSpeech();
    // Straight into his turn (the microphone permission is already granted for this page); the short pause lets
    // the engine release the interruption listener first.
    setTimeout(() => startListeningRef.current(), 100);
  }, [cancelSpeech, learnCut]);

  /** About a second after someone started talking over him: to him → stop; to someone else → go on. */
  const judgeCandidate = useCallback(() => {
    const candidate = candidateRef.current;
    if (!candidate || !speakingRef.current || !activeRef.current) { dropCandidate(); return; }
    candidate.timer = null;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const memory = bargeMemoryRef.current;
    const verdict = addressee(candidate.said, memory);
    if (verdict.to === 'shaheen') { cutIn(candidate.said); return; }
    const elapsed = now - candidate.since;
    // Not clear yet: a little longer (up to about two seconds) for more of his words.
    if (verdict.to === 'unsure' && elapsed < 2100) { candidate.timer = setTimeout(() => judgeCandidateRef.current(), 2200 - elapsed); return; }
    const final = verdict.to === 'unsure' ? settleUnsure(memory) : verdict.to;
    if (final === 'shaheen') { cutIn(candidate.said); return; }
    // Said to someone else (or nothing clear): he goes on with the answer. The listener starts afresh, so the same
    // words are not judged again.
    dropCandidate();
    if (!candidate.said) return;
    asideRef.current = { said: candidate.said, at: now };
    stopBargeWatch();
    setTimeout(() => startBargeWatchRef.current(), 60);
  }, [cutIn, dropCandidate, stopBargeWatch]);
  const judgeCandidateRef = useRef<() => void>(() => undefined);
  useEffect(() => { judgeCandidateRef.current = judgeCandidate; }, [judgeCandidate]);

  /** Someone is talking while Shaheen talks: words that plainly stop him do at once; anything else is judged in a second. */
  const considerBarge = useCallback((said: string) => {
    if (!speakingRef.current || !activeRef.current || mutedRef.current || !bargeEnabledRef.current || otherVoiceRef.current) return;
    if (said && addressee(said, bargeMemoryRef.current).strong) { dropCandidate(); cutIn(said); return; }
    const candidate = candidateRef.current;
    if (candidate) { if (said) candidate.said = said; return; }
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    candidateRef.current = { since: now, said, timer: setTimeout(() => judgeCandidateRef.current(), 1000) };
  }, [cutIn, dropCandidate]);
  const considerBargeRef = useRef<(said: string) => void>(() => undefined);
  useEffect(() => { considerBargeRef.current = considerBarge; }, [considerBarge]);

  /**
   * «المقاطعة بالصوت»: while Shaheen speaks, a second listener runs. Hearing only Shaheen's own words (through
   * the speakers) changes nothing; the visitor's words are judged (to him, or to someone near him).
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
    watch.onspeechstart = () => { if (bargeRecognitionRef.current === watch) considerBargeRef.current(''); };
    watch.onresult = (event) => {
      if (bargeRecognitionRef.current !== watch || sequence !== speechSequenceRef.current) return;
      let heard = '';
      for (let index = 0; index < event.results.length; index += 1) heard += ` ${event.results[index]?.[0]?.transcript || ''}`;
      watchHeardRef.current = heard;
      // The voice print said this sound is someone else (a television, a person nearby): not an interruption.
      if (otherVoiceRef.current) return;
      // Only what he is saying around now can come back through the speakers (the rest of the reply cannot).
      const check = bargeIn(heard, replyTextRef.current, { near: speechWindow(replyTextRef.current, spokenSoFarRef.current), eager: true });
      if (!check.barge || !check.said) return;
      considerBargeRef.current(check.said);
    };
    watch.onerror = (event) => {
      // A refused microphone ends the watching for this conversation; the tap on the orb still interrupts.
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') bargeRestartsRef.current = Number.POSITIVE_INFINITY;
    };
    watch.onend = () => {
      if (bargeRecognitionRef.current !== watch) return;
      bargeRecognitionRef.current = null;
      // Engines stop after a pause; keep watching while he is still speaking (with a limit per reply).
      if (speakingRef.current && activeRef.current && sequence === speechSequenceRef.current && bargeRestartsRef.current < 40) {
        bargeRestartsRef.current += 1;
        setTimeout(() => { if (sequence === speechSequenceRef.current) startBargeWatchRef.current(); }, 60);
      }
    };
    bargeRecognitionRef.current = watch;
    try { watch.start(); } catch { bargeRecognitionRef.current = null; }
  }, []);
  const startBargeWatchRef = useRef<() => void>(() => undefined);
  useEffect(() => { startBargeWatchRef.current = startBargeWatch; }, [startBargeWatch]);

  const speakReply = useCallback((text: string, onComplete: () => void) => {
    const local = resolveLocalVoice(voiceChoiceRef.current.names[languageRef.current], languageRef.current);
    if (typeof window === 'undefined' || (!local && (!window.speechSynthesis || !window.SpeechSynthesisUtterance))) {
      setError('speech');
      onComplete();
      return;
    }
    // The first sentence alone, then a sentence per utterance: he starts talking sooner and breathes between ideas.
    const chunks = talkChunks(text);
    if (!chunks.length) { onComplete(); return; }

    cancelSpeech();
    const sequence = speechSequenceRef.current;
    const locale = localeRef.current;
    replyTextRef.current = text;
    spokenSoFarRef.current = '';
    speechPosRef.current = { chunks, index: 0, at: 0 };
    bargeRestartsRef.current = 0;
    watchHeardRef.current = '';
    speakStartRef.current = typeof performance !== 'undefined' ? performance.now() : 0;
    gateRef.current.startSpeaking();
    let voices = voicesRef.current;
    if (!voices.length) { try { voices = window.speechSynthesis.getVoices(); } catch { voices = []; } }
    // No voice on this device speaks his language: an English voice reading Hindi is gibberish. The reply stays
    // written in the chat, he is told why, and Shaheen goes back to listening.
    if (!local && deviceLacksVoice(voices, languageRef.current)) {
      setNoVoice(true);
      onComplete();
      return;
    }
    setNoVoice(false);
    const choice = voiceChoiceRef.current;
    const voice = chosenVoice(voices, locale, languageRef.current, choice);
    // «مزاج الكلام»: calmer for someone upset, quicker for someone in a hurry (his chosen voice, nudged a little).
    const tune = tunedVoice(choice, messagesRef.current.filter((message) => message.role === 'user').map((message) => message.text));
    setVoiceMood(tune.mood);
    let index = 0;
    let finished = false;
    speakingRef.current = true;
    setSpeaking(true);

    const finish = (failed = false) => {
      if (finished || sequence !== speechSequenceRef.current) return;
      finished = true;
      clearTimeout(nativeSpeechTimerRef.current);
      nativeUtteranceRef.current = null;
      stopBargeWatch();
      speakingRef.current = false;
      setSpeaking(false);
      setSpokenText('');
      if (failed) setError('speech');
      onComplete();
    };
    if (local) {
      localStopRef.current = playLocalVoice(chunks, {
        name: local.name, language: languageRef.current, rate: tune.rate, pitch: tune.pitch,
        onChunk: (chunk, index) => {
          if (sequence !== speechSequenceRef.current) return;
          if (index === 0) { speakStartRef.current = performance.now(); startBargeWatchRef.current(); }
          speechPosRef.current = { chunks, index, at: 0 };
          setSpokenText(chunk); spokenSoFarRef.current = chunks.slice(0, index + 1).join(' ');
          setSpeechBeat((beat) => (beat + 1) % 1_000_000);
        }, onEnd: () => finish(), onError: () => finish(true),
      });
      return;
    }
    const speakNext = () => {
      if (sequence !== speechSequenceRef.current || !activeRef.current) { finish(); return; }
      if (index >= chunks.length) { finish(); return; }
      try {
        const utterance = new window.SpeechSynthesisUtterance(chunks[index]);
        utterance.lang = locale;
        utterance.rate = tune.rate;
        utterance.pitch = tune.pitch;
        if (voice) utterance.voice = voice;
        utterance.onstart = () => {
          if (sequence !== speechSequenceRef.current) return;
          speechPosRef.current = { chunks, index, at: 0 };
          setSpokenText(chunks[index] || '');
          spokenSoFarRef.current = chunks.slice(0, index + 1).join(' ');
        };
        utterance.onboundary = (event) => {
          if (sequence !== speechSequenceRef.current) return;
          setSpeechBeat((beat) => (beat + 1) % 1_000_000);
          // Where he is in the sentence, so an interruption tells the server exactly what he had said.
          const at = typeof event?.charIndex === 'number' ? event.charIndex : -1;
          if (at > 0) {
            spokenSoFarRef.current = [...chunks.slice(0, index), (chunks[index] || '').slice(0, at)].join(' ').trim();
            speechPosRef.current = { chunks, index, at };
          }
        };
        utterance.onend = () => { if (sequence !== speechSequenceRef.current) return; clearTimeout(nativeSpeechTimerRef.current); nativeUtteranceRef.current = null; index += 1; speakNext(); };
        utterance.onerror = () => finish(true);
        nativeSpeechTimerRef.current = setTimeout(() => { try { window.speechSynthesis.cancel(); } catch { /* stalled engine */ } finish(true); }, Math.max(20000, chunks[index].length * 180));
        nativeUtteranceRef.current = utterance;
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
    if (!activeRef.current || mutedRef.current || disabledRef.current || loadingRef.current || waitingRef.current || speakingRef.current || enrollingRef.current) return;
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
    // A typed message (or the answer itself) ends a «قصدك …؟» question and drops the rest of the last reply.
    confirmRef.current = null;
    restRef.current = '';
    turnPartsRef.current = [];
    askedDoneRef.current = false;
    waitingMoreRef.current = false;
    clearSilenceTimer();
    cutRef.current = null;
    pendingTurnRef.current = {
      previousUserId: latestMessageId(messagesRef.current, 'user'),
      previousAssistantId: latestMessageId(messagesRef.current, 'assistant'),
    };
    waitingRef.current = true;
    setWaiting(true);
    setReplyReady(false);
    setInterim('');
    return true;
  }, [cancelRecognition, cancelSpeech, clearListenTimer, clearSilenceTimer]);

  const finishOutgoingTurn = useCallback((sent: boolean) => {
    if (!waitingRef.current) return;
    if (!sent) {
      clearPendingTurn();
      scheduleListening();
      return;
    }
    setReplyReady(true);
  }, [clearPendingTurn, scheduleListening]);

  /**
   * «استنى شوية هدخل أشوف البيانات»: one short line said while he really looks something up (the store, prices,
   * stock, delivery…). Not a reply: the reply cuts it off as soon as it is ready.
   */
  const sayWhileLooking = useCallback((line: string) => {
    // The short loading acknowledgement must not suddenly use a different, possibly wrong-language native voice.
    if (resolveLocalVoice(voiceChoiceRef.current.names[languageRef.current], languageRef.current)) return;
    if (typeof window === 'undefined' || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
    try {
      const utterance = new window.SpeechSynthesisUtterance(line);
      utterance.lang = localeRef.current;
      utterance.rate = Math.min(1.3, voiceChoiceRef.current.rate + 0.04);
      utterance.pitch = voiceChoiceRef.current.pitch;
      let voices = voicesRef.current;
      if (!voices.length) { try { voices = window.speechSynthesis.getVoices(); } catch { voices = []; } }
      const voice = chosenVoice(voices, localeRef.current, languageRef.current, voiceChoiceRef.current);
      if (voice) utterance.voice = voice;
      setSpokenText(line);
      utterance.onend = () => setSpokenText((now) => (now === line ? '' : now));
      window.speechSynthesis.speak(utterance);
    } catch { /* Silence is fine: the chat shows the same line. */ }
  }, []);

  const sendRecognizedText = useCallback(async (rawText: string, confidence?: number) => {
    const said = rawText.replace(/\s+/g, ' ').trim();
    const alternatives = alternativesRef.current;
    alternativesRef.current = [];
    if (!said || !activeRef.current) {
      scheduleListening();
      return;
    }
    if (said.length > 4000) {
      setError('too_long');
      scheduleListening();
      return;
    }
    // «أيوه / كمّل» after «تحب أكمّلك الباقي؟»: he goes on from where he stopped (no new question to the server).
    const more = restRef.current;
    restRef.current = '';
    if (more && !confirmRef.current && wantsMore(said)) {
      clearListenTimer();
      cancelRecognition();
      setLastHeard(said);
      setInterim('');
      const next = spokenReply(more, { language: languageRef.current, dialect: dialectRef.current, words: 90, locale: localeRef.current });
      restRef.current = next.rest;
      speakReply(next.say || more, () => scheduleListening(350));
      return;
    }
    // «شاهين يصحح اللي اتسمع غلط»: the sentence is read again before anything is sent — the engine's readings
    // compared, a word that makes no sense replaced by the closest one that does, and an unsure perfume word asked.
    // «التخمين من سياق الكلام»: his last reply and the visitor's last sentences — a misheard word is most likely one of these.
    const recent = messagesRef.current.slice(-6);
    const lastReply = [...recent].reverse().find((message) => message.role === 'assistant')?.text || '';
    const context = [lastReply.slice(0, 2000), ...recent.filter((message) => message.role === 'user').slice(-2).map((message) => message.text.replace(/\n\n(?:🎧|✍️) [^\n]*$/u, ''))];
    const plan = planVoiceTurn(said, {
      pending: confirmRef.current, alternatives, learned: { ...sharedFixesRef.current, ...savedHeardFixes() },
      lexicon: lexiconRef.current, language: languageRef.current, dialect: dialectRef.current, context,
      ...(confidence !== undefined ? { confidence } : {}),
    });
    if (plan.action === 'repeat') {
      // «ممكن تعيد؟»: nothing is sent (a guess is how a conversation jumps to another topic).
      clearListenTimer();
      cancelRecognition();
      setLastHeard(said);
      setInterim('');
      speakReply(plan.say, () => scheduleListening(300));
      return;
    }
    if (plan.action === 'ask') {
      clearListenTimer();
      cancelRecognition();
      confirmRef.current = plan.pending;
      setLastHeard(said);
      setInterim('');
      onAskRef.current?.(said, plan.say);
      speakReply(plan.say, () => scheduleListening(350));
      return;
    }
    const started = beginOutgoingTurn();
    if (!started) return;
    for (const fix of plan.heard) if (fix.confirmed) saveHeardFix(fix.from, fix.to);
    const text = plan.text;
    setLastHeard(text);
    if (plan.filler) sayWhileLooking(plan.filler);
    // «اصبر عليا هراجع البيانات»: the answer is taking a while — he says so (once), and the answer cuts it off.
    clearPatience();
    if (!plan.filler) {
      patienceTimerRef.current = setTimeout(() => {
        patienceTimerRef.current = null;
        if (waitingRef.current && activeRef.current && !speakingRef.current) sayWhileLooking(patienceLine(languageRef.current, dialectRef.current));
      }, 2600);
    }
    const turn: ShaheenVoiceTurn = {
      ...(interruptedRef.current ? { interrupted: interruptedRef.current } : {}),
      ...(plan.heard.length ? { heard: plan.heard } : {}),
    };
    interruptedRef.current = '';
    try {
      const accepted = await onSendRef.current(text, turn);
      finishOutgoingTurn(accepted !== false);
    } catch {
      finishOutgoingTurn(false);
    }
  }, [beginOutgoingTurn, cancelRecognition, clearListenTimer, clearPatience, finishOutgoingTurn, sayWhileLooking, scheduleListening, speakReply]);

  /** The visitor's turn is complete: all its pieces, in order, gathered into one message. */
  const sendTurn = useCallback((confidence?: number) => {
    clearSilenceTimer();
    const parts = turnPartsRef.current;
    const whole = joinTurn(parts);
    turnPartsRef.current = [];
    askedDoneRef.current = false;
    waitingMoreRef.current = false;
    if (whole) void sendRecognizedText(whole, parts.length === 1 ? confidence : undefined);
    else scheduleListening(300);
  }, [clearSilenceTimer, scheduleListening, sendRecognizedText]);

  /** A silence decides: nothing more within a few seconds. */
  const armSilence = useCallback((ms: number, then: () => void) => {
    clearSilenceTimer();
    speechHeardRef.current = false;
    silenceTimerRef.current = setTimeout(() => {
      silenceTimerRef.current = null;
      if (speechHeardRef.current || !activeRef.current) return;
      cancelRecognition();
      then();
    }, ms);
  }, [cancelRecognition, clearSilenceTimer]);

  /** «خلصت ولا لسه؟» — and if he says nothing, he is taken to be finished. */
  const askIfDone = useCallback(() => {
    askedDoneRef.current = true;
    waitingMoreRef.current = false;
    clearListenTimer();
    cancelRecognition();
    setInterim(joinTurn(turnPartsRef.current));
    speakReply(askDoneLine(languageRef.current, dialectRef.current), () => {
      scheduleListening(150);
      armSilence(4500, () => { if (askedDoneRef.current) sendTurn(); });
    });
  }, [armSilence, cancelRecognition, clearListenTimer, scheduleListening, sendTurn, speakReply]);

  /** He paused in the middle of a sentence: keep listening quietly for the rest; a silence → «خلصت ولا لسه؟». */
  const listenForMore = useCallback(() => {
    waitingMoreRef.current = true;
    scheduleListening(60);
    armSilence(3000, () => {
      if (!waitingMoreRef.current) return;
      waitingMoreRef.current = false;
      if (turnPartsRef.current.length) askIfDone();
      else scheduleListening(300);
    });
  }, [armSilence, askIfDone, scheduleListening]);

  /**
   * «ترتيب الحوار»: one piece of what he said. Answers to Shaheen's own short questions go straight on; otherwise the
   * pieces are gathered until the turn is clearly over, he says he is done, or a silence after «خلصت ولا لسه؟».
   */
  const handleTurnPiece = useCallback((heard: string, confidence?: number) => {
    clearSilenceTimer();
    // «قصدك …؟» and «تحب أكمّلك الباقي؟» are answered in a word: no gathering.
    if (confirmRef.current || restRef.current) {
      turnPartsRef.current = [];
      askedDoneRef.current = false;
      waitingMoreRef.current = false;
      void sendRecognizedText(heard, confidence);
      return;
    }
    if (askedDoneRef.current) {
      askedDoneRef.current = false;
      const answer = finishedAnswer(heard);
      if (answer === 'done') { sendTurn(); return; }
      if (answer === 'more') { listenForMore(); return; }
    }
    waitingMoreRef.current = false;
    turnPartsRef.current = [...turnPartsRef.current, heard].slice(-12);
    const whole = joinTurn(turnPartsRef.current);
    setInterim(whole);
    // Answering his question («رجالي ولا حريمي؟» → «رجالي»): a short answer is a whole turn.
    const lastReply = [...messagesRef.current].reverse().find((message) => message.role === 'assistant')?.text || '';
    const state = turnState(whole, { answering: /[?؟]\s*$/u.test(lastReply.trim()) });
    if (state === 'done') { sendTurn(confidence); return; }
    if (state === 'more') { listenForMore(); return; }
    askIfDone();
  }, [askIfDone, clearSilenceTimer, listenForMore, sendRecognizedText, sendTurn]);

  const startListening = useCallback(() => {
    if (!activeRef.current || mutedRef.current || disabledRef.current || loadingRef.current || waitingRef.current || speakingRef.current || recognitionRef.current || enrollingRef.current) return;
    const Recognition = recognitionConstructor();
    if (!Recognition) { fail('unsupported'); return; }
    voicedRef.current = [];

    let finalText = '';
    let interimText = '';
    let confidence: number | undefined;
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
    // A few readings of each sentence: when the first one makes no sense, another one may.
    recognition.maxAlternatives = 4;
    recognition.onstart = () => {
      listeningRef.current = true;
      setListening(true);
    };
    recognition.onspeechstart = () => { speechHeardRef.current = true; setHearing(true); };
    recognition.onspeechend = () => setHearing(false);
    recognition.onresult = (event) => {
      speechHeardRef.current = true;
      setError(null);
      finalText = '';
      interimText = '';
      const sure: number[] = [];
      const parts: string[][] = [];
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript || '';
        if (result?.isFinal) {
          finalText += ` ${transcript}`;
          const value = result?.[0]?.confidence;
          if (typeof value === 'number' && value > 0) sure.push(value);
        } else interimText += ` ${transcript}`;
        const readings: string[] = [];
        for (let k = 0; k < (result?.length || 0) && k < 4; k += 1) readings.push(result?.[k]?.transcript || '');
        parts.push(readings);
      }
      confidence = sure.length ? sure.reduce((a, b) => a + b, 0) / sure.length : undefined;
      // The other readings, as whole sentences (with what the interruption listener heard first, if anything).
      alternativesRef.current = readingsFrom(parts).slice(1).map((reading) => mergeHeard(bargePrefixRef.current, reading));
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
      const own = (finalText || interimText).replace(/\s+/g, ' ').trim();
      const prefix = bargePrefixRef.current;
      const heard = mergeHeard(prefix, own);
      bargePrefixRef.current = '';
      // Just after Shaheen stopped for him: nothing more said (or «كمّل») means it was not for Shaheen — learned, and
      // he goes on with the answer from the word he was on. «استنى» alone means wait: he waits quietly.
      const cut = cutRef.current;
      cutRef.current = null;
      if (cut && cut.rest) {
        const goOn = /(?:^|\s)(?:كمل|كمّل|كملي|اكمل|أكمل|كمل كلامك|continue|go on|carry on|continue please)(?:\s|$)/iu.test(own);
        const waitOnly = !own && addressee(prefix, bargeMemoryRef.current).strong;
        if (goOn || (!own && !waitOnly && turnState(prefix) !== 'done')) {
          learnCut(cut.said, 'false');
          interruptedRef.current = '';
          setInterim('');
          speakReply(cut.rest, () => scheduleListening(350));
          return;
        }
        if (waitOnly) {
          // Ready when he is: «كمّل» later still goes on with the answer.
          cutRef.current = cut;
          setInterim('');
          scheduleListening(300);
          return;
        }
      }
      const voiced = voicedRef.current;
      voicedRef.current = [];
      // «بصمتي»: a sentence the print clearly says was someone else's (the television, a person nearby) is not his.
      if (heard && earRef.current && otherVoice(printRef.current, voiced)) {
        setIgnoredVoices((count) => count + 1);
        setInterim('');
        scheduleListening(350);
        return;
      }
      // «بصمتي بتتعلم»: a sentence clearly his makes the print a little more like his voice today (on this device only).
      const print = printRef.current;
      if (heard && print && earRef.current) {
        const now = summarize(voiced, 25);
        if (now && samePerson(print, now) === 'yes') {
          const better = adaptPrint(print, now);
          printRef.current = better;
          saveVoicePrint(better);
        }
      }
      setInterim(heard);
      // The engine's own sureness only counts when the visitor's words were all heard by it (not merged with the
      // interruption listener's).
      const sureness = finalText.trim() && heard === finalText.replace(/\s+/g, ' ').trim() ? confidence : undefined;
      if (heard) { handleTurnPiece(heard, sureness); return; }
      // Nothing said: a silence after a paused sentence or after «خلصت ولا لسه؟» decides the turn.
      if (askedDoneRef.current) { sendTurn(); return; }
      if (waitingMoreRef.current) {
        clearSilenceTimer();
        waitingMoreRef.current = false;
        if (turnPartsRef.current.length) { askIfDone(); return; }
      }
      scheduleListening(350);
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
  }, [askIfDone, clearSilenceTimer, fail, handleTurnPiece, learnCut, scheduleListening, sendTurn, speakReply]);

  useEffect(() => { startListeningRef.current = startListening; }, [startListening]);

  const start = useCallback(() => {
    if (resolveLocalVoice(voiceChoiceRef.current.names[languageRef.current], languageRef.current)) { try { unlockLocalAudio(); } catch { setError('speech'); } }
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
    confirmRef.current = null;
    printRef.current = activeVoicePrint();
    openVoiceEar();
    void loadVoiceWords().then(({ lexicon, shared }) => { lexiconRef.current = lexicon; sharedFixesRef.current = shared; }).catch(() => undefined);
    // This runs from the user's confirmation click, which is required by browser microphone permission.
    startListeningRef.current();
    return true;
  }, [cancelSpeech, clearListenTimer, clearPendingTurn, openVoiceEar]);

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
      // Muted means the microphone is really closed (the browser's microphone light goes off).
      if (duckRef.current) { duckRef.current = null; try { window.speechSynthesis?.resume(); } catch { /* Nothing paused. */ } }
      closeEar();
      setInterim('');
    } else {
      setError(null);
      openVoiceEar();
      // Called from the visitor's tap, so the engine may open the microphone straight away.
      startListeningRef.current();
    }
  }, [cancelRecognition, clearListenTimer, closeEar, openVoiceEar, stopBargeWatch]);

  /** Cut Shaheen off mid-reply and listen at once (tap on the orb). */
  const interrupt = useCallback(() => {
    if (!speakingRef.current) return;
    if (!activeRef.current) { cancelSpeech(); return; }
    // He had just decided «not to me»: the tap says it was — learned.
    const aside = asideRef.current;
    if (aside && (typeof performance !== 'undefined' ? performance.now() : Date.now()) - aside.at < 6000) learnCut(aside.said, 'missed');
    asideRef.current = null;
    interruptedRef.current = spokenSoFarRef.current;
    cancelSpeech();
    if (mutedRef.current) {
      mutedRef.current = false;
      setMuted(false);
    }
    setTimeout(() => startListeningRef.current(), 120);
  }, [cancelSpeech, learnCut]);

  /**
   * «ودن شاهين»: every 40 ms slice from the microphone. While Shaheen talks, a voice starting is judged (he keeps
   * talking meanwhile): a short noise (a cough, a knock) or another voice by the print (a television, someone nearby)
   * → nothing; words → judged about a second later (to him → he stops; to someone else → he goes on).
   */
  const handleSlice = useCallback((slice: EarSlice) => {
    const gate = gateRef.current;
    const take = takeRef.current;
    if (take) {
      // «بصمتي»: reading a sentence — only his voiced slices are kept (as numbers), until he stops.
      if (slice.frame.f0 && take.frames.length < 600) take.frames.push(slice.frame);
      const event = gate.push(slice, false);
      if (event?.type === 'end' && event.burst.voicedMs >= 1200) take.done();
      return;
    }
    if (!activeRef.current || mutedRef.current || enrollingRef.current) return;
    const talking = speakingRef.current;
    if (talking && slice.t - speakStartRef.current < 450) { gate.learnEcho(slice.frame.rms); return; }
    const ducked = duckRef.current;
    const event = gate.push(slice, talking && !ducked);
    if (event?.type === 'end') otherVoiceRef.current = false;
    if (!talking) {
      if (listeningRef.current && slice.frame.f0 && voicedRef.current.length < 600) voicedRef.current.push(slice.frame);
      return;
    }
    if (!bargeEnabledRef.current) return;
    // «القطع المناسب»: a voice starting does not cut him any more — he keeps talking while it is judged (about a
    // second). The ear only says what the words cannot: a short noise, or a voice that is clearly not the visitor's.
    if (event?.type === 'start') {
      if (!otherVoiceRef.current) considerBargeRef.current('');
      return;
    }
    const candidate = candidateRef.current;
    if (!candidate) return;
    const burst = event?.type === 'end' ? event.burst : gate.current(slice.t);
    if (!burst) return;
    const decision = bargeDecision(burst, event?.type === 'end', printRef.current, slice.t - candidate.since);
    if (decision === 'ignore') {
      otherVoiceRef.current = event?.type !== 'end';
      setIgnoredVoices((count) => count + 1);
      dropCandidate();
      return;
    }
    // A cough, a knock: no words came with it — nothing to judge.
    if (decision === 'resume' && !candidate.said) dropCandidate();
  }, [dropCandidate]);
  useEffect(() => { sliceRef.current = handleSlice; }, [handleSlice]);

  /** «بصمتي»: start making the print (after he agreed): the microphone stops listening for questions meanwhile. */
  const startEnrolment = useCallback(() => {
    if (!activeRef.current) return;
    clearListenTimer();
    cancelRecognition();
    cancelSpeech();
    enrollingRef.current = true;
    takesRef.current = [];
    takeRef.current = null;
    if (!earRef.current) openVoiceEar();
    setEnrolment({ step: 0, recording: false });
  }, [cancelRecognition, cancelSpeech, clearListenTimer, openVoiceEar]);

  /** Record one sentence (he reads it aloud; it ends when he stops, or after 9 seconds). */
  const recordEnrolment = useCallback(() => {
    if (!enrollingRef.current || takeRef.current) return;
    if (!earRef.current) { setEnrolment((now) => (now ? { ...now, error: 'microphone' } : now)); return; }
    gateRef.current.reset();
    setEnrolment((now) => (now ? { step: now.step, recording: true } : now));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const take = { frames: [] as VoiceFrame[], done: () => {
      if (takeRef.current !== take) return;
      takeRef.current = null;
      clearTimeout(timer);
      if (take.frames.length < 20) { setEnrolment((now) => (now ? { step: now.step, recording: false, error: 'short' } : now)); return; }
      takesRef.current = [...takesRef.current, take.frames];
      const step = takesRef.current.length;
      if (step < 3) { setEnrolment({ step, recording: false }); return; }
      const print = enrolPrint(takesRef.current);
      takesRef.current = [];
      if (!print) { setEnrolment({ step: 0, recording: false, error: 'short' }); return; }
      saveVoicePrint(print);
      printRef.current = print;
      setPrintSaved(true);
      setPrintOnState(true);
      setEnrolment({ step: 3, recording: false, done: true });
    } };
    takeRef.current = take;
    timer = setTimeout(() => take.done(), 9000);
  }, []);

  /** Close the print panel (a print half made is thrown away) and go back to listening. */
  const closeEnrolment = useCallback(() => {
    enrollingRef.current = false;
    takeRef.current = null;
    takesRef.current = [];
    setEnrolment(null);
    scheduleListening(300);
  }, [scheduleListening]);

  /** «بصمتي» on or off (kept), and the one-tap delete (it was only ever in this browser). */
  const setPrintOn = useCallback((on: boolean) => {
    setVoicePrintOn(on);
    setPrintOnState(on);
    printRef.current = on ? savedVoicePrint() : undefined;
  }, []);
  const deletePrint = useCallback(() => {
    deleteVoicePrint();
    printRef.current = undefined;
    setPrintSaved(false);
    setPrintOnState(true);
  }, []);
  const micLevel = useCallback(() => (earRef.current ? earRef.current.level() : null), []);

  /** «صوت شاهين»: keep his choice (voice, pitch, pace); the next sentence Shaheen says uses it. */
  const setVoiceChoice = useCallback((choice: VoiceChoice) => {
    if (resolveLocalVoice(choice.names[languageRef.current], languageRef.current)) { try { unlockLocalAudio(); } catch { setError('speech'); } }
    voiceChoiceRef.current = choice;
    setVoiceChoiceState(choice);
    saveVoiceChoice(choice);
  }, []);
  /** «اسمع»: one short sentence in a voice, so he can hear it before choosing (not while Shaheen is talking). */
  const previewVoice = useCallback((name: string, sample: string) => {
    if (typeof window === 'undefined' || speakingRef.current) return;
    cancelSpeech(); cancelRecognition(); clearListenTimer();
    const sequence = speechSequenceRef.current;
    const local = resolveLocalVoice(name, languageRef.current);
    let finished = false;
    const done = (failed = false) => {
      if (finished || sequence !== speechSequenceRef.current) return;
      finished = true; clearTimeout(nativeSpeechTimerRef.current); nativeUtteranceRef.current = null;
      speakingRef.current = false; setSpeaking(false); setSpokenText('');
      if (failed) setError('speech');
      scheduleListening(300);
    };
    if (local) {
      try { unlockLocalAudio(); } catch { done(true); return; }
      speakingRef.current = true; setSpeaking(true); setSpokenText(sample);
      localStopRef.current = playLocalVoice(talkChunks(sample), { name, language: languageRef.current,
        rate: voiceChoiceRef.current.rate, pitch: voiceChoiceRef.current.pitch,
        onEnd: () => done(), onError: () => done(true),
      });
      return;
    }
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) { done(true); return; }
    const voice = voicesRef.current.find((item) => item.name === name);
    try {
      const utterance = new window.SpeechSynthesisUtterance(sample);
      utterance.lang = voice?.lang || localeRef.current;
      if (voice) utterance.voice = voice;
      utterance.rate = voiceChoiceRef.current.rate; utterance.pitch = voiceChoiceRef.current.pitch;
      utterance.onend = () => done(); utterance.onerror = () => done(true);
      speakingRef.current = true; setSpeaking(true); setSpokenText(sample);
      nativeUtteranceRef.current = utterance;
      nativeSpeechTimerRef.current = setTimeout(() => { done(true); try { window.speechSynthesis.cancel(); } catch { /* Stalled preview. */ } }, 30000);
      window.speechSynthesis.speak(utterance);
    } catch { done(true); }
  }, [cancelRecognition, cancelSpeech, clearListenTimer, scheduleListening]);
  const voices = useMemo(() => [...voiceOptions(voiceList, localeRef.current, language), ...localVoiceOptions(language)], [voiceList, language, dialect]);

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
    // «شاهين بيتكلم مش بيقرا»: the reply said the way people talk, and a long one only up to «تحب أكمّلك الباقي؟».
    // A whole answer (about 90 words) before «تحب أكمّلك الباقي؟» — a shorter cut felt like he stopped mid-answer.
    const spoken = spokenReply(response.text, { language: languageRef.current, dialect: dialectRef.current, words: 90, opener: true, locale: localeRef.current });
    restRef.current = spoken.rest;
    speakReply(spoken.say || response.text, () => scheduleListening(350));
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
    earRef.current?.close();
    earRef.current = null;
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
    noVoice,
    /** The «اسمع الرد» button found no voice for his language (shown next to the voice button). */
    reportNoVoice: () => setNoVoice(true),
    clearNoVoice: () => setNoVoice(false),
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
    earActive,
    micLevel,
    ignoredVoices,
    print: { supported: earActive || earSupported(), saved: printSaved, on: printOn },
    enrolment,
    enrolSentences: ENROL_SENTENCES[language] || ENROL_SENTENCES.en!,
    startEnrolment,
    recordEnrolment,
    closeEnrolment,
    setPrintOn,
    deletePrint,
    language,
    voices,
    voiceChoice,
    setVoiceChoice,
    previewVoice,
    currentVoiceName: resolveLocalVoice(voiceChoice.names[language], language)?.name || chosenVoice(voiceList, localeRef.current, language, voiceChoice)?.name,
    voiceMood,
  };
}
